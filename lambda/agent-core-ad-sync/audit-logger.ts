/**
 * 監査ログ書き込みモジュール
 *
 * 認証イベントの監査証跡をDynamoDB監査テーブルに記録する。
 * 書き込み失敗時はサインインをブロックしない（非同期、エラーログのみ）。
 *
 * Requirements: 17.4, 17.7
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import * as crypto from 'crypto';

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const dynamoClient = new DynamoDBClient({ region: REGION });

export interface AuditLogEntry {
  userId: string;
  email: string;
  authSource: string;
  idpName: string;
  eventType: 'sign-in' | 'sign-in-failed' | 'token-refresh';
  details?: Record<string, unknown>;
}

/**
 * 監査ログをDynamoDB監査テーブルに書き込む。
 * 書き込み失敗時はエラーログを記録するのみで、例外をスローしない。
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const tableName = process.env.AUDIT_LOG_TABLE_NAME;
  if (!tableName) return;

  const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10);
  const now = new Date();
  const eventId = crypto.randomUUID();
  const timestamp = now.toISOString();
  const expiresAt = Math.floor(now.getTime() / 1000) + retentionDays * 86400;

  const item: Record<string, any> = {
    eventId: { S: eventId },
    userId: { S: entry.userId },
    email: { S: entry.email },
    authSource: { S: entry.authSource },
    idpName: { S: entry.idpName },
    eventType: { S: entry.eventType },
    timestamp: { S: timestamp },
    expiresAt: { N: expiresAt.toString() },
  };

  if (entry.details) {
    item.details = { S: JSON.stringify(entry.details) };
  }

  try {
    await dynamoClient.send(new PutItemCommand({
      TableName: tableName,
      Item: item,
    }));
  } catch (err: unknown) {
    const e = err as Error;
    console.error(JSON.stringify({
      level: 'ERROR',
      source: 'AuditLogger',
      operation: 'writeAuditLog',
      eventType: entry.eventType,
      userId: entry.userId,
      error: e.message,
      timestamp: new Date().toISOString(),
    }));
  }
}
