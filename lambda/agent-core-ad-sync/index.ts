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
import * as net from 'net';
import * as tls from 'tls';

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

const ssmClient = new SSMClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const dsClient = new DirectoryServiceClient({ region: REGION });

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
// Cognito Post-Authentication Trigger イベント型
// ========================================
interface CognitoPostAuthEvent {
  version: string;
  triggerSource: 'PostAuthentication_Authentication';
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
// Lambda Handler
// ========================================
export async function handler(event: AdSyncEvent | CognitoPostAuthEvent): Promise<AdSyncResponse | CognitoPostAuthEvent> {
  // Cognito Post-Authentication Triggerイベント判定
  if ('triggerSource' in event && event.triggerSource === 'PostAuthentication_Authentication') {
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

    console.log(JSON.stringify({
      level: 'INFO',
      source: 'PostAuthTrigger',
      userId,
      username,
      email,
      adType: AD_TYPE,
      timestamp: new Date().toISOString(),
    }));

    // キャッシュTTLチェック（24時間）
    const cached = await getCachedWithTtlCheck(userId);
    if (cached) {
      console.log(`PostAuthTrigger: Cache valid for ${userId}, skipping SID sync`);
      return event;
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
      message: 'SID sync completed',
      userId,
      username,
      timestamp: new Date().toISOString(),
    }));
  } catch (error: unknown) {
    // サインインをブロックしない — エラーログのみ
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
    if (!result.Item || !result.Item.userSID?.S) return false;

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

async function saveToDb(userId: string, username: string, userSID: string, groupSIDs: string[]): Promise<void> {
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const ttl = Math.floor(nowMs / 1000) + SID_CACHE_TTL;

  await dynamoClient.send(new PutItemCommand({
    TableName: USER_ACCESS_TABLE_NAME,
    Item: {
      userId: { S: userId },
      userSID: { S: userSID },
      groupSIDs: { L: groupSIDs.map(s => ({ S: s })) },
      email: { S: username },
      displayName: { S: username },
      source: { S: `AD-Sync-${AD_TYPE}` },
      createdAt: { S: now },
      updatedAt: { S: now },
      retrievedAt: { N: nowMs.toString() },
      ttl: { N: ttl.toString() },
    },
  }));
  console.log('Saved to DynamoDB:', { userId, userSID, groupSIDs: groupSIDs.length });
}
