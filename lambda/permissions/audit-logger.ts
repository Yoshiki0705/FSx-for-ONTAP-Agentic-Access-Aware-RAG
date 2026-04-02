/**
 * AuditLogger — 権限判定監査ログ
 *
 * 各アクセス判定（許可/拒否）を DynamoDB permission-audit テーブルに記録する。
 * 非ブロッキング設計: 書き込み失敗は権限判定に影響しない。
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { randomUUID } from 'crypto';

export interface AuditDocumentEntry {
  fileName: string;
  s3Uri: string;
  decision: 'allow' | 'deny';
  reason: string;
}

export interface AuditRecord {
  auditId: string;
  userId: string;
  timestamp: string;
  action: 'retrieve';
  documents: AuditDocumentEntry[];
  overallDecision: 'allow' | 'deny' | 'partial';
  decisionReason: string;
  metadata: {
    query: string;
    knowledgeBaseId: string;
    region: string;
    totalDocuments: number;
    allowedDocuments: number;
    deniedDocuments: number;
  };
  ttl: number;
}

const DEFAULT_TTL_DAYS = 90;
const MAX_RETRIES = 3;

const tableName = process.env.PERMISSION_AUDIT_TABLE_NAME || '';

let ddbClient: DynamoDBClient | null = null;
function getClient(): DynamoDBClient {
  if (!ddbClient) {
    ddbClient = new DynamoDBClient({});
  }
  return ddbClient;
}

/**
 * 監査レコードを作成するヘルパー
 */
export function createAuditRecord(
  userId: string,
  documents: AuditDocumentEntry[],
  query: string,
  knowledgeBaseId: string,
  region: string,
): AuditRecord {
  const now = new Date();
  const allowedCount = documents.filter(d => d.decision === 'allow').length;
  const deniedCount = documents.filter(d => d.decision === 'deny').length;

  let overallDecision: 'allow' | 'deny' | 'partial';
  let decisionReason: string;
  if (allowedCount === 0) {
    overallDecision = 'deny';
    decisionReason = deniedCount > 0 ? documents[0].reason : 'no_documents';
  } else if (deniedCount === 0) {
    overallDecision = 'allow';
    decisionReason = 'sid_match';
  } else {
    overallDecision = 'partial';
    decisionReason = 'mixed';
  }

  return {
    auditId: randomUUID(),
    userId,
    timestamp: now.toISOString(),
    action: 'retrieve',
    documents,
    overallDecision,
    decisionReason,
    metadata: {
      query,
      knowledgeBaseId,
      region,
      totalDocuments: documents.length,
      allowedDocuments: allowedCount,
      deniedDocuments: deniedCount,
    },
    ttl: Math.floor(now.getTime() / 1000) + DEFAULT_TTL_DAYS * 24 * 60 * 60,
  };
}

/**
 * 監査ログを書き込む（非ブロッキング、リトライ付き）
 */
export async function writeAuditLog(record: AuditRecord): Promise<void> {
  if (!tableName) {
    // テーブル名未設定 → スキップ
    return;
  }

  const client = getClient();
  const item = marshall({
    auditId: record.auditId,
    userId: record.userId,
    timestamp: record.timestamp,
    action: record.action,
    documents: record.documents,
    overallDecision: record.overallDecision,
    decisionReason: record.decisionReason,
    metadata: record.metadata,
    ttl: record.ttl,
  }, { removeUndefinedValues: true });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await client.send(new PutItemCommand({
        TableName: tableName,
        Item: item,
      }));
      return;
    } catch (err) {
      console.error(`[AuditLogger] Write failed (attempt ${attempt}/${MAX_RETRIES}):`, err);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
      }
    }
  }
  // 全リトライ失敗 → ログ出力のみ（非ブロッキング）
  console.error('[AuditLogger] All retries exhausted. Audit log not written:', record.auditId);
}
