/**
 * Metadata-based Permission Filter Handler
 * 
 * Bedrock KB検索結果をユーザーのSID情報と.metadata.jsonのallowed_group_sidsに基づいて
 * フィルタリングする。Next.js API Route内のインラインフィルタリングを置き換える
 * サーバーサイドLambda実装。
 * 
 * 権限チェック失敗時は安全側フォールバック（全ドキュメントアクセス拒否）。
 */

import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

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
interface UserAccessRecord {
  userId: string;
  userSID: string;
  groupSIDs: string[];
}

// ========================================
// 定数・クライアント
// ========================================

const CACHE_TTL_MINUTES = 5;
const CACHE_TABLE_NAME = process.env.PERMISSION_CACHE_TABLE || 'permission-cache';
const USER_ACCESS_TABLE_NAME = process.env.USER_ACCESS_TABLE_NAME || 'user-access';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

// ========================================
// DynamoDB操作
// ========================================

/** ユーザーのSID情報をDynamoDBから取得 */
async function getUserSIDs(userId: string): Promise<string[]> {
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: USER_ACCESS_TABLE_NAME,
      Key: marshall({ userId }),
    }));
    if (!result.Item) return [];
    const item = unmarshall(result.Item) as UserAccessRecord;
    const sids: string[] = [];
    if (item.userSID) sids.push(item.userSID);
    if (Array.isArray(item.groupSIDs)) sids.push(...item.groupSIDs);
    return sids;
  } catch (error) {
    console.error('ユーザーSID取得エラー:', error);
    return [];
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
// メインハンドラー
// ========================================

export async function handler(event: MetadataFilterRequest): Promise<MetadataFilterResponse> {
  const { userId, retrievalResults } = event;
  console.log(`[PermFilter] Start: userId=${userId}, docs=${retrievalResults.length}`);

  try {
    // Step 1: ユーザーSID取得
    const userSIDs = await getUserSIDs(userId);
    if (userSIDs.length === 0) {
      console.warn(`[PermFilter] No SIDs for user ${userId}, DENY_ALL`);
      return createDenyAllResponse(userId, retrievalResults);
    }

    // Step 2: 各ドキュメントをフィルタリング
    const allowed: FilteredResult[] = [];
    const filterLog: FilterDetail[] = [];

    for (const r of retrievalResults) {
      const fileName = r.s3Uri.split('/').pop() || r.s3Uri;
      const docSIDs = extractDocumentSIDs(r.metadata);

      // キャッシュチェック
      const cacheKey = `${userId}:${fileName}`;
      const cached = await getCachedResult(cacheKey);

      let matchResult: { matched: boolean; matchedSID?: string };
      if (cached !== null) {
        matchResult = { matched: cached };
      } else {
        matchResult = checkSIDAccess(userSIDs, docSIDs);
        await setCachedResult(cacheKey, userId, fileName, matchResult.matched);
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

    const response: MetadataFilterResponse = {
      userId,
      totalDocuments: retrievalResults.length,
      allowedDocuments: allowed.length,
      deniedDocuments: retrievalResults.length - allowed.length,
      filterMethod: 'SID_MATCHING',
      userSIDs,
      allowed,
      filterLog,
    };

    console.log(`[PermFilter] Done: ${allowed.length}/${retrievalResults.length} allowed`);
    return response;
  } catch (error) {
    console.error(`[PermFilter] Error (DENY_ALL fallback):`, error);
    return createDenyAllResponse(userId, retrievalResults);
  }
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
