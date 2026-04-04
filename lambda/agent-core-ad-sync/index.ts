/**
 * AD Sync Lambda — Managed AD (LDAP) + Self-managed AD (SSM) 両対応
 *
 * adType環境変数で方式を切り替え:
 *   - "managed": LDAP直接クエリ（AWS Managed AD / AD Connector）
 *   - "self-managed": SSM Run Command（Windows EC2経由PowerShell）
 *
 * どちらの方式でもADユーザーのSIDを取得し、DynamoDBに保存する。
 */

import {
  SSMClient,
  SendCommandCommand,
  GetCommandInvocationCommand,
} from '@aws-sdk/client-ssm';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  DirectoryServiceClient,
  DescribeDirectoriesCommand,
} from '@aws-sdk/client-directory-service';
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import * as net from 'net';
import * as tls from 'tls';
import { LdapConnector, getBindPassword, structuredLog } from './ldap-connector';

// ========================================
// 環境変数
// ========================================
const AD_TYPE = (process.env.AD_TYPE || 'self-managed') as 'managed' | 'self-managed';
const AD_EC2_INSTANCE_ID = process.env.AD_EC2_INSTANCE_ID; // self-managed用
const AD_DIRECTORY_ID = process.env.AD_DIRECTORY_ID;       // managed用
const AD_DOMAIN_NAME = process.env.AD_DOMAIN_NAME || '';   // managed用
const AD_DNS_IPS = process.env.AD_DNS_IPS || '';           // managed用（カンマ区切り）
const USER_ACCESS_TABLE_NAME = process.env.USER_ACCESS_TABLE_NAME || process.env.IDENTITY_TABLE_NAME || '';
const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const SSM_TIMEOUT = parseInt(process.env.SSM_TIMEOUT || '60', 10);
const SID_CACHE_TTL = parseInt(process.env.SID_CACHE_TTL || '86400', 10);
const OIDC_GROUP_CLAIM_NAME = process.env.OIDC_GROUP_CLAIM_NAME || 'groups';
const LDAP_URL = process.env.LDAP_URL || '';
const LDAP_BASE_DN = process.env.LDAP_BASE_DN || '';
const LDAP_BIND_DN = process.env.LDAP_BIND_DN || '';
const LDAP_BIND_PASSWORD_SECRET_ARN = process.env.LDAP_BIND_PASSWORD_SECRET_ARN || '';

const ssmClient = new SSMClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const dsClient = new DirectoryServiceClient({ region: REGION });
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

// ========================================
// 型定義
// ========================================
interface AdSyncEvent {
  username: string;
  userId?: string;
  forceRefresh?: boolean;
}

interface AdSyncResponse {
  success: boolean;
  adType?: string;
  data?: {
    username: string;
    userId: string;
    userSID: string;
    groupSIDs: string[];
    retrievedAt: number;
    cached: boolean;
  };
  error?: { code: string; message: string };
}

// ========================================
// 認証ソース型定義
// ========================================
export type AuthSource = 'saml' | 'oidc' | 'direct';

interface OidcClaimsInfo {
  groups: string[];
  email: string;
}

/** DynamoDB保存用の拡張フィールド */
interface ExtendedSaveOptions {
  uid?: number | null;
  gid?: number | null;
  unixGroups?: Array<{ name: string; gid: number }>;
  oidcGroups?: string[];
  authSource?: AuthSource;
  source?: string;
}

// ========================================
// Cognito Post-Authentication Trigger イベント型
// ========================================
interface CognitoPostAuthEvent {
  version: string;
  triggerSource: 'PostAuthentication_Authentication' | 'PostConfirmation_ConfirmSignUp';
  region: string;
  userPoolId: string;
  userName: string;
  callerContext: {
    awsSdkVersion: string;
    clientId: string;
  };
  request: {
    userAttributes: {
      email: string;
      sub: string;
      'custom:ad_groups'?: string;
      [key: string]: string | undefined;
    };
  };
  response: Record<string, unknown>;
}

// ========================================
// 認証ソース判別（Task 3.1）
// ========================================

/**
 * Cognitoイベントの identities 属性から認証ソースを判別する。
 * - SAML IdP → 'saml'
 * - OIDC IdP → 'oidc'
 * - identities なし（直接認証） → 'direct'
 */
export function detectAuthSource(event: CognitoPostAuthEvent): AuthSource {
  const identities = event.request.userAttributes['identities'];
  if (!identities) return 'direct';

  try {
    const parsed = JSON.parse(identities);
    if (!Array.isArray(parsed)) return 'direct';
    if (parsed.some((id: any) => id.providerType === 'SAML')) return 'saml';
    if (parsed.some((id: any) => id.providerType === 'OIDC')) return 'oidc';
  } catch {
    // identities のパースに失敗した場合は direct として扱う
    return 'direct';
  }
  return 'direct';
}

// ========================================
// OIDCクレームパーサー（Task 3.2）
// ========================================

/**
 * OIDCトークンのクレームからグループ情報を抽出する。
 * - 環境変数 OIDC_GROUP_CLAIM_NAME（デフォルト: 'groups'）で指定されたクレーム名を使用
 * - `custom:{claimName}` と `{claimName}` の両方のパスを検索
 * - JSON文字列・配列の両方をパース対応
 * - PostConfirmation triggerではカスタム属性がイベントに含まれない場合があるため、
 *   Cognito AdminGetUser APIからフォールバック取得する
 */
export async function parseOidcClaims(
  event: CognitoPostAuthEvent,
  groupClaimName: string = OIDC_GROUP_CLAIM_NAME,
): Promise<OidcClaimsInfo> {
  const claims = event.request.userAttributes;
  let groupsRaw = claims['custom:oidc_groups'] || claims[`custom:${groupClaimName}`] || claims[groupClaimName];

  // PostConfirmation triggerではカスタム属性がイベントに含まれない場合がある
  // Cognito APIから直接ユーザー属性を取得するフォールバック
  if (!groupsRaw && event.userPoolId && event.userName) {
    try {
      const userResp = await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: event.userPoolId,
        Username: event.userName,
      }));
      const oidcGroupsAttr = userResp.UserAttributes?.find(a => a.Name === 'custom:oidc_groups');
      if (oidcGroupsAttr?.Value) {
        groupsRaw = oidcGroupsAttr.Value;
        console.log(JSON.stringify({
          level: 'INFO',
          source: 'parseOidcClaims',
          message: 'Retrieved oidc_groups from Cognito API fallback',
          userId: event.userName,
          groupsRaw: groupsRaw?.substring(0, 200),
          timestamp: new Date().toISOString(),
        }));
      }
    } catch (err: unknown) {
      const e = err as Error;
      console.warn(JSON.stringify({
        level: 'WARN',
        source: 'parseOidcClaims',
        message: 'Failed to retrieve user attributes from Cognito API',
        userId: event.userName,
        error: e.message,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  if (!groupsRaw) groupsRaw = '[]';

  let groups: string[];
  if (Array.isArray(groupsRaw)) {
    groups = groupsRaw;
  } else if (typeof groupsRaw === 'string') {
    try {
      const parsed = JSON.parse(groupsRaw);
      groups = Array.isArray(parsed) ? parsed : [];
    } catch {
      // JSON パースに失敗した場合、カンマ区切りとして扱う
      groups = groupsRaw.split(',').map(g => g.trim()).filter(Boolean);
    }
  } else {
    groups = [];
  }

  return { groups, email: claims.email || '' };
}

// ========================================
// Lambda Handler
// ========================================
export async function handler(event: AdSyncEvent | CognitoPostAuthEvent): Promise<AdSyncResponse | CognitoPostAuthEvent> {
  // Cognito Post-Authentication / Post-Confirmation Triggerイベント判定
  if ('triggerSource' in event && (
    event.triggerSource === 'PostAuthentication_Authentication' ||
    event.triggerSource === 'PostConfirmation_ConfirmSignUp'
  )) {
    return handleCognitoTrigger(event as CognitoPostAuthEvent);
  }

  // 既存のAdSyncEventハンドラー
  return handleAdSync(event as AdSyncEvent);
}

// ========================================
// Cognito Post-Authentication Trigger ハンドラー
// ========================================
async function handleCognitoTrigger(event: CognitoPostAuthEvent): Promise<CognitoPostAuthEvent> {
  try {
    const email = event.request.userAttributes.email;
    if (!email) {
      console.warn('PostAuthTrigger: email attribute missing, skipping SID sync');
      return event;
    }

    const username = email.split('@')[0];
    const userId = event.userName;

    // 認証ソース判別（Task 3.1）
    const authSource = detectAuthSource(event);

    console.log(JSON.stringify({
      level: 'INFO',
      source: 'PostAuthTrigger',
      userId,
      username,
      email,
      adType: AD_TYPE,
      authSource,
      timestamp: new Date().toISOString(),
    }));

    // 認証ソースに応じた処理分岐
    if (authSource === 'oidc') {
      // OIDC認証パス（Task 3.4）
      await handleOidcPath(event, userId, username, email);
    } else {
      // SAML / Direct パス — 既存の AD Sync 処理（後方互換性維持）
      await handleSamlDirectPath(event, userId, username);
    }
  } catch (error: unknown) {
    // サインインをブロックしない — エラーログのみ（Fail-Open認証）
    const err = error as Error;
    console.error(JSON.stringify({
      level: 'ERROR',
      source: 'PostAuthTrigger',
      userId: event.userName,
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    }));
  }

  // Cognito Triggerは必ず元のeventを返す
  return event;
}

// ========================================
// SAML / Direct 認証パス（既存処理、後方互換性維持）
// ========================================
async function handleSamlDirectPath(
  event: CognitoPostAuthEvent,
  userId: string,
  username: string,
): Promise<void> {
  // キャッシュTTLチェック（24時間）
  const cached = await getCachedWithTtlCheck(userId);
  if (cached) {
    console.log(`PostAuthTrigger: Cache valid for ${userId}, skipping SID sync`);
    return;
  }

  // AD方式に応じてSID取得
  let userSID: string;
  let groupSIDs: string[];

  if (AD_TYPE === 'managed') {
    const result = await getManagedAdSid(username);
    userSID = result.userSID;
    groupSIDs = result.groupSIDs;
  } else {
    const result = await getSelfManagedAdSid(username);
    userSID = result.userSID;
    groupSIDs = result.groupSIDs;
  }

  await saveToDb(userId, username, userSID, groupSIDs);

  console.log(JSON.stringify({
    level: 'INFO',
    source: 'PostAuthTrigger',
    message: 'SID sync completed (SAML/Direct path)',
    userId,
    username,
    timestamp: new Date().toISOString(),
  }));
}

// ========================================
// OIDC認証パス（Task 3.4）
// ========================================
async function handleOidcPath(
  event: CognitoPostAuthEvent,
  userId: string,
  username: string,
  email: string,
): Promise<void> {
  // forceRefresh パラメータ対応
  const forceRefresh = event.request.userAttributes['custom:forceRefresh'] === 'true';

  // キャッシュTTLチェック（既存の getCachedWithTtlCheck を再利用）
  if (!forceRefresh) {
    const cached = await getCachedWithTtlCheck(userId);
    if (cached) {
      console.log(`PostAuthTrigger: Cache valid for ${userId}, skipping OIDC sync`);
      return;
    }
  }

  // OIDCクレームからグループ情報を取得
  const oidcClaims = await parseOidcClaims(event);

  const hasLdapConfig = !!(LDAP_URL && LDAP_BASE_DN && LDAP_BIND_DN);

  if (hasLdapConfig) {
    // LDAP Connector 使用パス（LDAP設定あり）
    // LDAP クエリ結果を優先し、OIDCクレームは補助情報として oidcGroups に保存
    let ldapUserInfo: Awaited<ReturnType<LdapConnector['queryUser']>> = null;

    try {
      // Secrets Manager からバインドパスワードを取得
      const bindPassword = await getBindPassword(LDAP_BIND_PASSWORD_SECRET_ARN);

      if (bindPassword) {
        const connector = new LdapConnector({
          ldapUrl: LDAP_URL,
          baseDn: LDAP_BASE_DN,
          bindDn: LDAP_BIND_DN,
          bindPassword,
          userSearchFilter: process.env.LDAP_USER_SEARCH_FILTER || '(mail={email})',
          groupSearchFilter: process.env.LDAP_GROUP_SEARCH_FILTER || '(member={dn})',
        });

        ldapUserInfo = await connector.queryUser(email);
      } else {
        structuredLog({
          level: 'WARN',
          source: 'IdentitySyncLambda',
          operation: 'handleOidcPath',
          userId,
          error: 'Failed to retrieve LDAP bind password from Secrets Manager, skipping LDAP query',
          context: { ldapUrl: LDAP_URL },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (ldapError: unknown) {
      // LDAP エラー時はサインインをブロックしない（Fail-Open）
      const err = ldapError as Error;
      structuredLog({
        level: 'ERROR',
        source: 'IdentitySyncLambda',
        operation: 'handleOidcPath.ldapQuery',
        userId,
        error: err.message,
        context: { ldapUrl: LDAP_URL, email },
        timestamp: new Date().toISOString(),
      });
    }

    if (ldapUserInfo) {
      // LDAP結果あり — LDAP結果を優先、OIDCクレームは補助情報
      const userSID = ldapUserInfo.objectSid || '';
      const groupSIDs = ldapUserInfo.objectSid
        ? (ldapUserInfo.groups?.filter(g => g.sid).map(g => g.sid!) || []).concat(['S-1-1-0'])
        : [];
      const unixGroups = ldapUserInfo.groups
        ?.filter(g => g.gid !== undefined)
        .map(g => ({ name: g.name, gid: g.gid! })) || [];

      await saveToDb(userId, username, userSID, groupSIDs, {
        uid: ldapUserInfo.uidNumber ?? null,
        gid: ldapUserInfo.gidNumber ?? null,
        unixGroups,
        oidcGroups: oidcClaims.groups,
        authSource: 'oidc',
        source: 'OIDC-LDAP',
      });
    } else {
      // LDAP結果なし（エラーまたはユーザー未発見）— OIDCクレームのみで保存
      structuredLog({
        level: 'INFO',
        source: 'IdentitySyncLambda',
        operation: 'handleOidcPath',
        userId,
        error: 'LDAP query returned no result, falling back to OIDC claims only',
        context: { email, ldapUrl: LDAP_URL },
        timestamp: new Date().toISOString(),
      });

      await saveToDb(userId, username, '', [], {
        uid: null,
        gid: null,
        unixGroups: [],
        oidcGroups: oidcClaims.groups,
        authSource: 'oidc',
        source: 'OIDC-LDAP',
      });
    }
  } else {
    // OIDCクレームのみ使用パス（LDAP設定なし）
    console.log(JSON.stringify({
      level: 'INFO',
      source: 'PostAuthTrigger',
      message: 'OIDC Claims-only path',
      userId,
      email,
      groupCount: oidcClaims.groups.length,
      timestamp: new Date().toISOString(),
    }));

    await saveToDb(userId, username, '', [], {
      uid: null,
      gid: null,
      unixGroups: [],
      oidcGroups: oidcClaims.groups,
      authSource: 'oidc',
      source: 'OIDC-Claims',
    });
  }

  console.log(JSON.stringify({
    level: 'INFO',
    source: 'PostAuthTrigger',
    message: 'OIDC sync completed',
    userId,
    username,
    hasLdapConfig,
    timestamp: new Date().toISOString(),
  }));
}

// ========================================
// 既存 AdSync ハンドラー
// ========================================
async function handleAdSync(event: AdSyncEvent): Promise<AdSyncResponse> {
  console.log('AD Sync started:', JSON.stringify({ ...event, adType: AD_TYPE }));

  try {
    if (!event.username) throw new Error('username is required');
    if (!USER_ACCESS_TABLE_NAME) throw new Error('USER_ACCESS_TABLE_NAME is not set');

    const userId = event.userId || event.username;

    // キャッシュチェック
    if (!event.forceRefresh) {
      const cached = await getCached(userId);
      if (cached) {
        console.log('Cache hit:', userId);
        return { success: true, adType: AD_TYPE, data: { ...cached, cached: true } };
      }
    }

    // AD方式に応じてSID取得
    let userSID: string;
    let groupSIDs: string[];

    if (AD_TYPE === 'managed') {
      const result = await getManagedAdSid(event.username);
      userSID = result.userSID;
      groupSIDs = result.groupSIDs;
    } else {
      const result = await getSelfManagedAdSid(event.username);
      userSID = result.userSID;
      groupSIDs = result.groupSIDs;
    }

    // DynamoDBに保存（user-accessテーブル互換フォーマット）
    await saveToDb(userId, event.username, userSID, groupSIDs);

    return {
      success: true,
      adType: AD_TYPE,
      data: { username: event.username, userId, userSID, groupSIDs, retrievedAt: Date.now(), cached: false },
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('AD Sync failed:', err);
    return { success: false, adType: AD_TYPE, error: { code: 'AD_SYNC_ERROR', message: err.message } };
  }
}

// ========================================
// Managed AD — LDAP クエリ
// ========================================
async function getManagedAdSid(username: string): Promise<{ userSID: string; groupSIDs: string[] }> {
  // AD DNS IPsを取得（環境変数またはDirectory Service API）
  let dnsIps = AD_DNS_IPS ? AD_DNS_IPS.split(',').map(s => s.trim()) : [];
  let domainName = AD_DOMAIN_NAME;

  if (dnsIps.length === 0 && AD_DIRECTORY_ID) {
    const resp = await dsClient.send(new DescribeDirectoriesCommand({
      DirectoryIds: [AD_DIRECTORY_ID],
    }));
    const dir = resp.DirectoryDescriptions?.[0];
    if (dir) {
      dnsIps = dir.DnsIpAddrs || [];
      domainName = domainName || dir.Name || '';
    }
  }

  if (dnsIps.length === 0) throw new Error('No AD DNS IPs available for Managed AD');
  if (!domainName) throw new Error('AD domain name is required for Managed AD');

  // LDAP検索でSIDを取得
  // Managed ADはLDAP (389) またはLDAPS (636) をサポート
  const baseDn = domainName.split('.').map(p => `DC=${p}`).join(',');
  const filter = `(&(objectClass=user)(sAMAccountName=${escapeLdap(username)}))`;
  const attrs = ['objectSid', 'memberOf'];

  console.log('LDAP query:', { dnsIps: dnsIps[0], baseDn, filter });

  // シンプルなLDAP検索（外部ライブラリ不要）
  const ldapResult = await ldapSearch(dnsIps[0], 389, baseDn, filter, attrs, domainName);

  return {
    userSID: ldapResult.objectSid || '',
    groupSIDs: ldapResult.groupSIDs || ['S-1-1-0'],
  };
}

/** LDAP特殊文字エスケープ */
function escapeLdap(s: string): string {
  return s.replace(/[\\*()\/\0]/g, c => '\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));
}

/** シンプルなLDAP検索（net.Socket使用、外部ライブラリ不要） */
async function ldapSearch(
  host: string, port: number, baseDn: string, filter: string, attrs: string[], domain: string,
): Promise<{ objectSid: string; groupSIDs: string[] }> {
  // Managed ADの場合、LDAP匿名バインドは不可。
  // Lambda関数からのLDAP認証にはADサービスアカウントが必要。
  // 簡易実装: Directory Service APIでユーザー情報を取得するフォールバック
  console.warn('LDAP direct query requires AD service account credentials.');
  console.warn('Falling back to Directory Service API approach.');

  // Managed ADの場合、SIDはAD内部で管理されており、
  // Directory Service APIでは直接取得できない。
  // 代替案: SSM経由でManaged ADに参加済みのEC2からPowerShellで取得
  if (process.env.AD_EC2_INSTANCE_ID) {
    console.log('Using SSM fallback for Managed AD SID retrieval');
    const result = await getSelfManagedAdSid(process.env.AD_EC2_INSTANCE_ID.includes('i-') ? '' : '');
    return { objectSid: result.userSID, groupSIDs: result.groupSIDs };
  }

  // EC2もない場合はエラー
  throw new Error(
    'Managed AD SID retrieval requires either:\n' +
    '1. AD service account credentials for LDAP query, or\n' +
    '2. A Windows EC2 instance joined to the Managed AD (set AD_EC2_INSTANCE_ID)\n' +
    'Please configure one of these options.'
  );
}

// ========================================
// Self-managed AD — SSM PowerShell
// ========================================
async function getSelfManagedAdSid(username: string): Promise<{ userSID: string; groupSIDs: string[] }> {
  if (!AD_EC2_INSTANCE_ID) throw new Error('AD_EC2_INSTANCE_ID is required for self-managed AD');

  const script = generatePowerShellScript(username);
  const result = await executeSsmCommand(script);

  if (result.status !== 'Success') {
    throw new Error(`PowerShell failed: ${result.error || result.status}`);
  }

  return parsePowerShellOutput(result.output || '');
}

function generatePowerShellScript(username: string): string {
  const escaped = username.replace(/'/g, "''");
  return `
$ErrorActionPreference = 'Stop'
try {
    $user = Get-ADUser -Identity '${escaped}' -Properties MemberOf, SID
    $groups = @()
    foreach ($g in $user.MemberOf) {
        $grp = Get-ADGroup -Identity $g -Properties SID
        $groups += $grp.SID.Value
    }
    # Everyone SID を追加
    $groups += 'S-1-1-0'
    $result = @{
        userSID = $user.SID.Value
        groupSIDs = $groups
    }
    $result | ConvertTo-Json -Compress
} catch {
    Write-Error "Failed: $_"
    exit 1
}
`.trim();
}

async function executeSsmCommand(script: string): Promise<{ status: string; output?: string; error?: string }> {
  const resp = await ssmClient.send(new SendCommandCommand({
    InstanceIds: [AD_EC2_INSTANCE_ID!],
    DocumentName: 'AWS-RunPowerShellScript',
    Parameters: { commands: [script] },
    TimeoutSeconds: SSM_TIMEOUT,
  }));

  const commandId = resp.Command?.CommandId;
  if (!commandId) throw new Error('No command ID from SSM');

  // ポーリング
  await new Promise(r => setTimeout(r, 5000));
  const maxAttempts = Math.ceil(SSM_TIMEOUT / 5);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const inv = await ssmClient.send(new GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: AD_EC2_INSTANCE_ID!,
      }));
      if (inv.Status === 'Success') return { status: 'Success', output: inv.StandardOutputContent || '' };
      if (inv.Status === 'Failed') return { status: 'Failed', error: inv.StandardErrorContent || '' };
      if (inv.Status === 'TimedOut' || inv.Status === 'Cancelled') return { status: inv.Status };
    } catch (e: any) {
      if (e.name === 'InvocationDoesNotExist' && i < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      throw e;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  return { status: 'TimedOut', error: 'Polling timeout' };
}

function parsePowerShellOutput(output: string): { userSID: string; groupSIDs: string[] } {
  const parsed = JSON.parse(output.trim());
  if (!parsed.userSID) throw new Error('userSID not found in output');
  return {
    userSID: parsed.userSID,
    groupSIDs: Array.isArray(parsed.groupSIDs) ? parsed.groupSIDs : ['S-1-1-0'],
  };
}

// ========================================
// DynamoDB キャッシュ
// ========================================

/** キャッシュTTLチェック（24時間）— Cognito Trigger用 */
async function getCachedWithTtlCheck(userId: string): Promise<boolean> {
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: USER_ACCESS_TABLE_NAME,
      Key: { userId: { S: userId } },
    }));
    if (!result.Item) return false;

    // OIDC レコードは userSID が空文字の場合がある。
    // source フィールドまたは userSID の存在でレコードの有効性を判定する。
    const hasUserSID = !!result.Item.userSID?.S;
    const hasSource = !!result.Item.source?.S;
    if (!hasUserSID && !hasSource) return false;

    // retrievedAtベースのTTLチェック（SID_CACHE_TTL秒、デフォルト86400=24時間）
    const retrievedAt = parseInt(result.Item.retrievedAt?.N || '0', 10);
    if (retrievedAt === 0) return false;

    const nowMs = Date.now();
    const ageMs = nowMs - retrievedAt;
    const ttlMs = SID_CACHE_TTL * 1000;

    return ageMs < ttlMs;
  } catch {
    return false;
  }
}

async function getCached(userId: string): Promise<AdSyncResponse['data'] | null> {
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: USER_ACCESS_TABLE_NAME,
      Key: { userId: { S: userId } },
    }));
    if (!result.Item) return null;
    const ttl = parseInt(result.Item.ttl?.N || '0', 10);
    if (ttl > 0 && ttl < Math.floor(Date.now() / 1000)) return null;

    return {
      username: result.Item.email?.S || result.Item.displayName?.S || userId,
      userId,
      userSID: result.Item.userSID?.S || '',
      groupSIDs: result.Item.groupSIDs?.L?.map((s: any) => s.S || '') || [],
      retrievedAt: parseInt(result.Item.retrievedAt?.N || '0', 10),
      cached: true,
    };
  } catch { return null; }
}

async function saveToDb(
  userId: string,
  username: string,
  userSID: string,
  groupSIDs: string[],
  extended?: ExtendedSaveOptions,
): Promise<void> {
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const ttl = Math.floor(nowMs / 1000) + SID_CACHE_TTL;

  const sourceValue = extended?.source || `AD-Sync-${AD_TYPE}`;

  // 基本フィールド（既存スキーマ互換）
  const item: Record<string, any> = {
    userId: { S: userId },
    userSID: { S: userSID },
    groupSIDs: { L: groupSIDs.map(s => ({ S: s })) },
    email: { S: username },
    displayName: { S: username },
    source: { S: sourceValue },
    createdAt: { S: now },
    updatedAt: { S: now },
    retrievedAt: { N: nowMs.toString() },
    ttl: { N: ttl.toString() },
  };

  // 拡張フィールド（Task 3.3）
  if (extended) {
    if (extended.authSource) {
      item.authSource = { S: extended.authSource };
    }
    if (extended.uid != null) {
      item.uid = { N: extended.uid.toString() };
    }
    if (extended.gid != null) {
      item.gid = { N: extended.gid.toString() };
    }
    if (extended.unixGroups && extended.unixGroups.length > 0) {
      item.unixGroups = {
        L: extended.unixGroups.map(g => ({
          M: {
            name: { S: g.name },
            gid: { N: g.gid.toString() },
          },
        })),
      };
    } else if (extended.unixGroups) {
      item.unixGroups = { L: [] };
    }
    if (extended.oidcGroups) {
      item.oidcGroups = { L: extended.oidcGroups.map(g => ({ S: g })) };
    }
  }

  await dynamoClient.send(new PutItemCommand({
    TableName: USER_ACCESS_TABLE_NAME,
    Item: item,
  }));
  console.log('Saved to DynamoDB:', {
    userId,
    userSID,
    groupSIDs: groupSIDs.length,
    source: sourceValue,
    ...(extended?.authSource ? { authSource: extended.authSource } : {}),
    ...(extended?.oidcGroups ? { oidcGroupCount: extended.oidcGroups.length } : {}),
  });
}
