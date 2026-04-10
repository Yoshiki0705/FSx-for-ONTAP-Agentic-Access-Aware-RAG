/**
 * Metadata-based Permission Filter Handler
 * 
 * Bedrock KB検索結果をユーザーのSID情報と.metadata.jsonのallowed_group_sidsに基づいて
 * フィルタリングする。Next.js API Route内のインラインフィルタリングを置き換える
 * サーバーサイドLambda実装。
 * 
 * UID/GIDベースのフィルタリングにも対応し、Permission Resolution Strategyに基づいて
 * SID / UID-GID / Hybrid のいずれかの戦略でフィルタリングを実行する。
 * 
 * 権限チェック失敗時は安全側フォールバック（全ドキュメントアクセス拒否）。
 */

import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getOntapClient, resolveWindowsUser, NameMappingRule } from './ontap-rest-api-client';

// ========================================
// インターフェース定義
// ========================================

/** Lambda呼び出しリクエスト */
export interface MetadataFilterRequest {
  userId: string;
  /** Bedrock KB Retrieve APIの検索結果 */
  retrievalResults: RetrievalResult[];
}

/** Bedrock KB検索結果の1件 */
export interface RetrievalResult {
  content: string;
  s3Uri: string;
  score?: number;
  metadata: Record<string, unknown>;
}

/** フィルタリングレスポンス */
export interface MetadataFilterResponse {
  userId: string;
  totalDocuments: number;
  allowedDocuments: number;
  deniedDocuments: number;
  filterMethod: string;
  userSIDs: string[];
  allowed: FilteredResult[];
  filterLog: FilterDetail[];
}

/** フィルタリング済み結果 */
interface FilteredResult {
  fileName: string;
  s3Uri: string;
  content: string;
  metadata: Record<string, unknown>;
}

/** フィルタリング詳細ログ */
interface FilterDetail {
  fileName: string;
  documentSIDs: string[];
  matched: boolean;
  matchedSID?: string;
}

/** DynamoDB user-accessレコード */
export interface UserAccessRecord {
  userId: string;
  userSID: string;
  groupSIDs: string[];
  uid?: number;
  gid?: number;
  unixGroups?: Array<{ name: string; gid: number }>;
  oidcGroups?: string[];
}

/** Permission Resolution Strategy */
export interface PermissionResolutionStrategy {
  type: 'sid' | 'uid-gid' | 'hybrid';
  userSIDs?: string[];
  uid?: number;
  gid?: number;
  unixGroups?: Array<{ name: string; gid: number }>;
}

// ========================================
// 定数・クライアント
// ========================================

const CACHE_TTL_MINUTES = 5;
const CACHE_TABLE_NAME = process.env.PERMISSION_CACHE_TABLE || 'permission-cache';
const USER_ACCESS_TABLE_NAME = process.env.USER_ACCESS_TABLE_NAME || 'user-access';
const ONTAP_NAME_MAPPING_ENABLED = process.env.ONTAP_NAME_MAPPING_ENABLED === 'true';
const SVM_UUID = process.env.SVM_UUID || '';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

// ========================================
// DynamoDB操作
// ========================================

/** ユーザーの権限情報をDynamoDBから取得（SID + UID/GID + OIDCグループ） */
export async function getUserPermissions(userId: string): Promise<UserAccessRecord | null> {
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: USER_ACCESS_TABLE_NAME,
      Key: marshall({ userId }),
    }));
    if (!result.Item) return null;
    const item = unmarshall(result.Item) as UserAccessRecord;
    return item;
  } catch (error) {
    console.error('ユーザー権限情報取得エラー:', error);
    return null;
  }
}

/** キャッシュからフィルタリング結果を取得 */
async function getCachedResult(cacheKey: string): Promise<boolean | null> {
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: CACHE_TABLE_NAME,
      Key: marshall({ cacheKey }),
    }));
    if (!result.Item) return null;
    const item = unmarshall(result.Item);
    if (item.ttl && item.ttl < Math.floor(Date.now() / 1000)) return null;
    return item.allowed as boolean;
  } catch {
    return null;
  }
}

/** フィルタリング結果をキャッシュに保存 */
async function setCachedResult(cacheKey: string, userId: string, documentId: string, allowed: boolean): Promise<void> {
  try {
    await dynamoClient.send(new PutItemCommand({
      TableName: CACHE_TABLE_NAME,
      Item: marshall({
        cacheKey,
        userId,
        documentId,
        allowed,
        ttl: Math.floor(Date.now() / 1000) + CACHE_TTL_MINUTES * 60,
        createdAt: new Date().toISOString(),
      }),
    }));
  } catch { /* キャッシュ書き込み失敗は無視 */ }
}

// ========================================
// SIDマッチング
// ========================================

/** ドキュメントメタデータからallowed_group_sidsを抽出 */
function extractDocumentSIDs(metadata: Record<string, unknown>): string[] {
  const raw = metadata?.allowed_group_sids
    ?? (metadata?.metadataAttributes as Record<string, unknown>)?.allowed_group_sids;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return [raw]; }
  }
  return [];
}

/** ユーザーSIDとドキュメントSIDの交差チェック */
function checkSIDAccess(userSIDs: string[], docSIDs: string[]): { matched: boolean; matchedSID?: string } {
  if (!Array.isArray(docSIDs) || docSIDs.length === 0) return { matched: false };
  const matchedSID = userSIDs.find(sid => docSIDs.includes(sid));
  return matchedSID ? { matched: true, matchedSID } : { matched: false };
}

// ========================================
// UID/GIDメタデータ抽出
// ========================================

/** ドキュメントメタデータからallowed_uids, allowed_gids, allowed_oidc_groupsを抽出 */
export function extractDocumentUidGidPermissions(metadata: Record<string, unknown>): {
  allowedUids: number[];
  allowedGids: number[];
  allowedOidcGroups: string[];
} {
  const attrs = metadata?.metadataAttributes as Record<string, unknown> | undefined;
  const source = attrs ?? metadata;

  const allowedUids = parseNumberArray(source?.allowed_uids);
  const allowedGids = parseNumberArray(source?.allowed_gids);
  const allowedOidcGroups = parseStringArray(source?.allowed_oidc_groups);

  return { allowedUids, allowedGids, allowedOidcGroups };
}

function parseNumberArray(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.filter((v): v is number => typeof v === 'number');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((v): v is number => typeof v === 'number');
    } catch { /* ignore */ }
  }
  return [];
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    } catch { /* ignore */ }
  }
  return [];
}

// ========================================
// Permission Resolution Strategy (Task 6.2)
// ========================================

/** ユーザーレコードから適切な権限解決戦略を選択する */
export function resolvePermissionStrategy(userRecord: UserAccessRecord): PermissionResolutionStrategy {
  const hasSID = !!userRecord.userSID;
  const hasUID = userRecord.uid !== undefined && userRecord.gid !== undefined;

  if (hasSID && hasUID) {
    return {
      type: 'hybrid',
      userSIDs: [userRecord.userSID, ...(Array.isArray(userRecord.groupSIDs) ? userRecord.groupSIDs : [])],
      uid: userRecord.uid,
      gid: userRecord.gid,
      unixGroups: userRecord.unixGroups,
    };
  }
  if (hasSID) {
    return {
      type: 'sid',
      userSIDs: [userRecord.userSID, ...(Array.isArray(userRecord.groupSIDs) ? userRecord.groupSIDs : [])],
    };
  }
  if (hasUID) {
    return {
      type: 'uid-gid',
      uid: userRecord.uid,
      gid: userRecord.gid,
      unixGroups: userRecord.unixGroups,
    };
  }

  // 権限情報なし → Fail-Closed
  throw new Error('No permission data available');
}

// ========================================
// UID/GIDドキュメントマッチング (Task 6.3)
// ========================================

/** UID/GIDベースのアクセスチェック */
export function checkUidGidAccess(
  uid: number,
  gid: number,
  unixGroups: Array<{ name: string; gid: number }> | undefined,
  allowedUids: number[],
  allowedGids: number[],
): boolean {
  // UID match
  if (allowedUids.length > 0 && allowedUids.includes(uid)) {
    return true;
  }

  // GID match: primary gid or any unix group gid
  if (allowedGids.length > 0) {
    if (allowedGids.includes(gid)) return true;
    if (Array.isArray(unixGroups)) {
      for (const group of unixGroups) {
        if (allowedGids.includes(group.gid)) return true;
      }
    }
  }

  return false;
}

// ========================================
// OIDCグループドキュメントマッチング (Task 13.1)
// ========================================

/** OIDCグループベースのアクセスチェック */
export function checkOidcGroupAccess(
  userOidcGroups: string[],
  allowedOidcGroups: string[],
): boolean {
  if (!Array.isArray(userOidcGroups) || userOidcGroups.length === 0) return false;
  if (!Array.isArray(allowedOidcGroups) || allowedOidcGroups.length === 0) return false;
  return userOidcGroups.some(group => allowedOidcGroups.includes(group));
}

// ========================================
// ONTAP Name-Mapping統合 (Task 7.3)
// ========================================

/**
 * ONTAP name-mappingを使用してUID/GID戦略をSID戦略に拡張する
 * 
 * ontapNameMappingEnabled=true の場合、UNIXユーザー名からWindowsユーザー名への
 * マッピングを試み、成功した場合はマッピングされたWindowsユーザーのSIDで
 * SIDフィルタリングを実行する。
 * 
 * ONTAP REST API接続失敗時はname-mappingなしで継続し、エラーをログに記録する。
 * 
 * @param strategy - 現在の権限解決戦略
 * @param userRecord - ユーザーアクセスレコード
 * @returns 拡張された権限解決戦略（変更がない場合は元の戦略）
 */
export async function applyNameMapping(
  strategy: PermissionResolutionStrategy,
  userRecord: UserAccessRecord,
): Promise<PermissionResolutionStrategy> {
  if (!ONTAP_NAME_MAPPING_ENABLED || !SVM_UUID) {
    return strategy;
  }

  // SID戦略の場合はname-mapping不要
  if (strategy.type === 'sid') {
    return strategy;
  }

  // UID/GIDまたはhybrid戦略でUNIXユーザー名がある場合にname-mappingを試行
  const unixUsername = userRecord.userId;
  if (!unixUsername) {
    return strategy;
  }

  try {
    const client = getOntapClient();
    const rules = await client.getNameMappingRules(SVM_UUID);

    if (rules.length === 0) {
      console.log(`[PermFilter] No name-mapping rules found for SVM ${SVM_UUID}`);
      return strategy;
    }

    const windowsUser = resolveWindowsUser(unixUsername, rules);
    if (!windowsUser) {
      console.log(`[PermFilter] No name-mapping match for user ${unixUsername}`);
      return strategy;
    }

    console.log(`[PermFilter] Name-mapping resolved: ${unixUsername} → ${windowsUser}`);

    // マッピング成功: WindowsユーザーのSIDでSIDフィルタリングを実行するため
    // 戦略をhybridに拡張し、マッピングされたWindowsユーザー名をSIDsに追加
    // 注: 実際のSID解決はDynamoDBのWindowsユーザーレコードから取得する必要がある
    // ここではマッピングされたWindowsユーザー名をSIDとして使用する
    const mappedUserSIDs = [windowsUser, ...(strategy.userSIDs ?? [])];

    return {
      ...strategy,
      type: 'hybrid',
      userSIDs: mappedUserSIDs,
    };
  } catch (error) {
    // ONTAP REST API接続失敗時はname-mappingなしで継続
    console.error(`[PermFilter] ONTAP name-mapping failed, continuing without:`, (error as Error).message);
    return strategy;
  }
}

// ========================================
// メインハンドラー
// ========================================

export async function handler(event: MetadataFilterRequest): Promise<MetadataFilterResponse> {
  const { userId, retrievalResults } = event;
  console.log(`[PermFilter] Start: userId=${userId}, docs=${retrievalResults.length}`);

  try {
    // Step 1: ユーザー権限情報取得
    const userRecord = await getUserPermissions(userId);
    if (!userRecord) {
      console.warn(`[PermFilter] No record for user ${userId}, DENY_ALL`);
      return createDenyAllResponse(userId, retrievalResults);
    }

    // Step 2: 権限解決戦略を選択
    let strategy: PermissionResolutionStrategy;
    try {
      strategy = resolvePermissionStrategy(userRecord);
    } catch {
      console.warn(`[PermFilter] No permission data for user ${userId}, DENY_ALL`);
      return createDenyAllResponse(userId, retrievalResults);
    }

    console.log(`[PermFilter] Strategy: ${strategy.type} for user ${userId}`);

    // Step 2.5: ONTAP name-mapping統合 (Task 7.3)
    strategy = await applyNameMapping(strategy, userRecord);

    // Step 3: 各ドキュメントをフィルタリング
    const allowed: FilteredResult[] = [];
    const filterLog: FilterDetail[] = [];
    const userSIDs = strategy.userSIDs ?? [];
    const oidcGroups = userRecord.oidcGroups;
    let usedOidcFallback = false;

    for (const r of retrievalResults) {
      const fileName = r.s3Uri.split('/').pop() || r.s3Uri;
      const docSIDs = extractDocumentSIDs(r.metadata);

      // キャッシュチェック
      const cacheKey = `${userId}:${fileName}`;
      const cached = await getCachedResult(cacheKey);

      let matchResult: { matched: boolean; matchedSID?: string; usedOidcFallback?: boolean };

      if (cached !== null) {
        matchResult = { matched: cached };
      } else {
        matchResult = filterByStrategy(strategy, r.metadata, docSIDs, oidcGroups);
        await setCachedResult(cacheKey, userId, fileName, matchResult.matched);
      }

      if (matchResult.usedOidcFallback) {
        usedOidcFallback = true;
      }

      filterLog.push({
        fileName,
        documentSIDs: docSIDs,
        matched: matchResult.matched,
        matchedSID: matchResult.matchedSID,
      });

      if (matchResult.matched) {
        allowed.push({ fileName, s3Uri: r.s3Uri, content: r.content, metadata: r.metadata });
      }
    }

    const filterMethodMap: Record<PermissionResolutionStrategy['type'], string> = {
      'sid': 'SID_MATCHING',
      'uid-gid': 'UID_GID_MATCHING',
      'hybrid': 'HYBRID_MATCHING',
    };

    let filterMethod = filterMethodMap[strategy.type];
    if (usedOidcFallback) {
      filterMethod += '+OIDC_GROUP_FALLBACK';
    }

    const response: MetadataFilterResponse = {
      userId,
      totalDocuments: retrievalResults.length,
      allowedDocuments: allowed.length,
      deniedDocuments: retrievalResults.length - allowed.length,
      filterMethod,
      userSIDs,
      allowed,
      filterLog,
    };

    console.log(`[PermFilter] Done: ${allowed.length}/${retrievalResults.length} allowed (${strategy.type}${usedOidcFallback ? '+OIDC_FALLBACK' : ''})`);
    return response;
  } catch (error) {
    console.error(`[PermFilter] Error (DENY_ALL fallback):`, error);
    return createDenyAllResponse(userId, retrievalResults);
  }
}

/** 戦略に応じたフィルタリングを実行（OIDCグループフォールバック付き） */
export function filterByStrategy(
  strategy: PermissionResolutionStrategy,
  metadata: Record<string, unknown>,
  docSIDs: string[],
  oidcGroups?: string[],
): { matched: boolean; matchedSID?: string; usedOidcFallback?: boolean } {
  let primaryResult: { matched: boolean; matchedSID?: string } = { matched: false };

  if (strategy.type === 'sid') {
    primaryResult = checkSIDAccess(strategy.userSIDs!, docSIDs);
  } else if (strategy.type === 'uid-gid') {
    const { allowedUids, allowedGids } = extractDocumentUidGidPermissions(metadata);
    if (allowedUids.length > 0 || allowedGids.length > 0) {
      const matched = checkUidGidAccess(strategy.uid!, strategy.gid!, strategy.unixGroups, allowedUids, allowedGids);
      primaryResult = { matched };
    }
  } else if (strategy.type === 'hybrid') {
    // SIDマッチを優先
    const sidResult = checkSIDAccess(strategy.userSIDs!, docSIDs);
    if (sidResult.matched) return sidResult;

    // SIDマッチ失敗時にUID/GIDフォールバック
    const { allowedUids, allowedGids } = extractDocumentUidGidPermissions(metadata);
    if (allowedUids.length > 0 || allowedGids.length > 0) {
      const matched = checkUidGidAccess(strategy.uid!, strategy.gid!, strategy.unixGroups, allowedUids, allowedGids);
      primaryResult = { matched };
    }
  }

  // プライマリ戦略で許可された場合はそのまま返す
  if (primaryResult.matched) return primaryResult;

  // OIDCグループフォールバック: プライマリ戦略が拒否 + oidcGroupsあり + allowed_oidc_groupsあり
  if (Array.isArray(oidcGroups) && oidcGroups.length > 0) {
    const { allowedOidcGroups } = extractDocumentUidGidPermissions(metadata);
    if (allowedOidcGroups.length > 0 && checkOidcGroupAccess(oidcGroups, allowedOidcGroups)) {
      return { matched: true, usedOidcFallback: true };
    }
  }

  return { matched: false };
}

/** 安全側フォールバック: 全ドキュメントアクセス拒否 */
function createDenyAllResponse(userId: string, results: RetrievalResult[]): MetadataFilterResponse {
  return {
    userId,
    totalDocuments: results.length,
    allowedDocuments: 0,
    deniedDocuments: results.length,
    filterMethod: 'DENY_ALL_FALLBACK',
    userSIDs: [],
    allowed: [],
    filterLog: results.map(r => ({
      fileName: r.s3Uri.split('/').pop() || r.s3Uri,
      documentSIDs: [],
      matched: false,
    })),
  };
}
