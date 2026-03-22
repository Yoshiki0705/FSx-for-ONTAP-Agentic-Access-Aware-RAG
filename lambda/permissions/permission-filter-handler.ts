/**
 * Permission Filter Handler
 * 
 * Bedrock KB検索結果をユーザーのSID/ACL情報に基づいてフィルタリングする。
 * 権限チェック失敗時は安全側フォールバック（全ドキュメントアクセス拒否）。
 * 
 * 要件: 3.1, 3.2, 3.4, 3.5
 */

import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { calculateEffectivePermissions } from './permission-calculator';
import { OntapAclRecord } from './types';

// ========================================
// インターフェース定義
// ========================================

/** フィルタリングリクエスト */
export interface PermissionFilterRequest {
  userId: string;
  userSIDs: string[];
  documents: DocumentWithAcl[];
}

/** ACL付きドキュメント */
export interface DocumentWithAcl {
  documentId: string;
  content: string;
  sourceUri: string;
  score?: number;
  metadata?: Record<string, string>;
  acl: OntapAclRecord[];
}

/** フィルタリングレスポンス */
export interface PermissionFilterResponse {
  userId: string;
  totalDocuments: number;
  allowedDocuments: number;
  deniedDocuments: number;
  documents: FilteredDocument[];
}

/** フィルタリング済みドキュメント */
export interface FilteredDocument {
  documentId: string;
  content: string;
  sourceUri: string;
  score?: number;
  metadata?: Record<string, string>;
  allowed: boolean;
}

// ========================================
// 定数
// ========================================

const CACHE_TTL_MINUTES = 5;
const CACHE_TABLE_NAME = process.env.PERMISSION_CACHE_TABLE || 'permission-cache';

// ========================================
// DynamoDBキャッシュ
// ========================================

const dynamoClient = new DynamoDBClient({});

/**
 * キャッシュからフィルタリング結果を取得
 */
async function getCachedPermission(
  userId: string,
  documentId: string,
): Promise<boolean | null> {
  const cacheKey = `${userId}:${documentId}`;
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: CACHE_TABLE_NAME,
      Key: marshall({ cacheKey }),
    }));

    if (!result.Item) return null;

    const item = unmarshall(result.Item);
    // TTL切れチェック
    if (item.ttl && item.ttl < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return item.allowed as boolean;
  } catch (error) {
    console.warn('キャッシュ読み取りエラー（無視して続行）:', error);
    return null;
  }
}

/**
 * フィルタリング結果をキャッシュに保存
 */
async function setCachedPermission(
  userId: string,
  documentId: string,
  allowed: boolean,
): Promise<void> {
  const cacheKey = `${userId}:${documentId}`;
  const ttl = Math.floor(Date.now() / 1000) + CACHE_TTL_MINUTES * 60;
  try {
    await dynamoClient.send(new PutItemCommand({
      TableName: CACHE_TABLE_NAME,
      Item: marshall({
        cacheKey,
        userId,
        documentId,
        allowed,
        ttl,
        createdAt: new Date().toISOString(),
      }),
    }));
  } catch (error) {
    console.warn('キャッシュ書き込みエラー（無視して続行）:', error);
  }
}

// ========================================
// メインハンドラー
// ========================================

/**
 * Permission Filter Lambda ハンドラー
 * 
 * 権限チェック失敗時は安全側フォールバック（全ドキュメントアクセス拒否）。
 */
export async function handler(event: PermissionFilterRequest): Promise<PermissionFilterResponse> {
  const { userId, userSIDs, documents } = event;

  console.log(`権限フィルタリング開始: userId=${userId}, documents=${documents.length}`);

  try {
    if (!userId || !Array.isArray(userSIDs) || userSIDs.length === 0) {
      console.error('無効なリクエスト: userId またはuserSIDsが不足');
      return createDenyAllResponse(userId, documents);
    }

    const filteredDocuments: FilteredDocument[] = [];
    let allowedCount = 0;
    let deniedCount = 0;

    for (const doc of documents) {
      // キャッシュチェック
      const cached = await getCachedPermission(userId, doc.documentId);
      let allowed: boolean;

      if (cached !== null) {
        allowed = cached;
        console.log(`キャッシュヒット: ${doc.documentId} -> ${allowed}`);
      } else {
        // SID/ACL照合
        const permissions = calculateEffectivePermissions(userSIDs, doc.acl);
        allowed = permissions.read;
        // キャッシュに保存
        await setCachedPermission(userId, doc.documentId, allowed);
        console.log(`権限計算: ${doc.documentId} -> read=${allowed}`);
      }

      if (allowed) {
        allowedCount++;
      } else {
        deniedCount++;
      }

      filteredDocuments.push({
        documentId: doc.documentId,
        content: allowed ? doc.content : '',
        sourceUri: doc.sourceUri,
        score: doc.score,
        metadata: doc.metadata,
        allowed,
      });
    }

    console.log(`フィルタリング完了: total=${documents.length}, allowed=${allowedCount}, denied=${deniedCount}`);

    return {
      userId,
      totalDocuments: documents.length,
      allowedDocuments: allowedCount,
      deniedDocuments: deniedCount,
      documents: filteredDocuments,
    };
  } catch (error) {
    // 安全側フォールバック: 全ドキュメントアクセス拒否
    console.error(`権限チェック失敗（安全側フォールバック）: userId=${userId}, documentCount=${documents.length}, error=${(error as Error).message}`);
    return createDenyAllResponse(userId, documents);
  }
}

/**
 * 全ドキュメントアクセス拒否レスポンスを生成（安全側フォールバック）
 */
function createDenyAllResponse(
  userId: string,
  documents: DocumentWithAcl[],
): PermissionFilterResponse {
  return {
    userId,
    totalDocuments: documents.length,
    allowedDocuments: 0,
    deniedDocuments: documents.length,
    documents: documents.map(doc => ({
      documentId: doc.documentId,
      content: '',
      sourceUri: doc.sourceUri,
      score: doc.score,
      metadata: doc.metadata,
      allowed: false,
    })),
  };
}
