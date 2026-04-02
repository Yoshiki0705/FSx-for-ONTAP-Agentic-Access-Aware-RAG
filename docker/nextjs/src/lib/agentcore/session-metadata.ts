/**
 * AgentCore セッションメタデータ管理
 *
 * DynamoDB `perm-cache` テーブル（既存）にセッションメタデータを保存・取得・更新する。
 *
 * テーブルスキーマ: PK のみ（cacheKey: STRING）、TTL属性: ttl
 * キーパターン: cacheKey = `memory-session#{userId}#{sessionId}`
 *
 * セッション一覧取得は Scan + begins_with フィルタで実現。
 * （perm-cache テーブルにはソートキーがないため Query by PK prefix は不可）
 *
 * Requirements: 4.1, 4.2
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

// 環境変数
const TABLE_NAME = process.env.PERMISSION_CACHE_TABLE || 'permission-cache';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

// TTL: 7日間（秒）
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** セッションメタデータの型定義 */
export interface SessionMetadata {
  title: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/** DynamoDB に保存されるセッションメタデータレコード */
export interface SessionMetadataRecord extends SessionMetadata {
  cacheKey: string; // `memory-session#{userId}#{sessionId}`
  sessionId: string;
  userId: string;
  ttl: number;
}

// DynamoDBDocumentClient の遅延初期化
let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({ region: AWS_REGION });
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

/**
 * cacheKey を生成する
 */
function buildCacheKey(userId: string, sessionId: string): string {
  return `memory-session#${userId}#${sessionId}`;
}

/**
 * cacheKey のプレフィックスを生成する（一覧取得用）
 */
function buildCacheKeyPrefix(userId: string): string {
  return `memory-session#${userId}#`;
}

/**
 * TTL を計算する（現在時刻 + 7日間、epoch seconds）
 */
function calculateTTL(): number {
  return Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
}

/**
 * セッションメタデータを保存（PutItem）
 */
export async function saveSessionMetadata(
  userId: string,
  sessionId: string,
  metadata: Partial<SessionMetadata>,
): Promise<void> {
  const now = new Date().toISOString();
  const client = getDocClient();

  const item: SessionMetadataRecord = {
    cacheKey: buildCacheKey(userId, sessionId),
    sessionId,
    userId,
    title: metadata.title || '',
    mode: metadata.mode || 'agent',
    createdAt: metadata.createdAt || now,
    updatedAt: metadata.updatedAt || now,
    messageCount: metadata.messageCount ?? 0,
    ttl: calculateTTL(),
  };

  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    }),
  );

  console.log('[SessionMetadata] 保存完了:', { userId, sessionId });
}

/**
 * セッション一覧取得（Scan + begins_with フィルタ）
 *
 * perm-cache テーブルにはソートキーがないため、
 * Scan + FilterExpression で `memory-session#{userId}#` プレフィックスのアイテムを取得する。
 */
export async function getSessionList(
  userId: string,
): Promise<SessionMetadataRecord[]> {
  const client = getDocClient();
  const prefix = buildCacheKeyPrefix(userId);
  const items: SessionMetadataRecord[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(cacheKey, :prefix)',
        ExpressionAttributeValues: {
          ':prefix': prefix,
        },
        ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
      }),
    );

    if (result.Items) {
      items.push(...(result.Items as SessionMetadataRecord[]));
    }
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // updatedAt 降順でソート（新しい順）
  items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  console.log('[SessionMetadata] 一覧取得:', { userId, count: items.length });
  return items;
}

/**
 * セッション更新（messageCount, updatedAt）
 */
export async function updateSessionMetadata(
  userId: string,
  sessionId: string,
  updates: { messageCount?: number; updatedAt?: string; title?: string },
): Promise<void> {
  const client = getDocClient();

  const expressionParts: string[] = [];
  const expressionValues: Record<string, any> = {};
  const expressionNames: Record<string, string> = {};

  // updatedAt は常に更新
  expressionParts.push('#updatedAt = :updatedAt');
  expressionValues[':updatedAt'] = updates.updatedAt || new Date().toISOString();
  expressionNames['#updatedAt'] = 'updatedAt';

  // TTL を更新（7日間延長）
  expressionParts.push('#ttl = :ttl');
  expressionValues[':ttl'] = calculateTTL();
  expressionNames['#ttl'] = 'ttl';

  if (updates.messageCount !== undefined) {
    expressionParts.push('#messageCount = :messageCount');
    expressionValues[':messageCount'] = updates.messageCount;
    expressionNames['#messageCount'] = 'messageCount';
  }

  if (updates.title !== undefined) {
    expressionParts.push('#title = :title');
    expressionValues[':title'] = updates.title;
    expressionNames['#title'] = 'title';
  }

  await client.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        cacheKey: buildCacheKey(userId, sessionId),
      },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeValues: expressionValues,
      ExpressionAttributeNames: expressionNames,
    }),
  );

  console.log('[SessionMetadata] 更新完了:', { userId, sessionId, updates });
}
