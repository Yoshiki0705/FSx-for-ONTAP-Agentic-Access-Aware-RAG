/**
 * ポリシー管理機能
 * 
 * ポリシーのCRUD操作、バージョン管理、監査ログ記録を提供します。
 * S3とDynamoDBを使用してポリシーを永続化します。
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { CedarPolicy } from './cedar-converter';
import { ParsedPolicy } from './natural-language-parser';

// ポリシーメタデータ
export interface PolicyMetadata {
  policyId: string;
  version: number;
  agentId: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  description: string;
  tags: Record<string, string>;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
}

// ポリシーストレージ
export interface StoredPolicy {
  metadata: PolicyMetadata;
  parsedPolicy: ParsedPolicy;
  cedarPolicy: CedarPolicy;
  cedarText: string;
}

// 監査ログエントリ
export interface AuditLogEntry {
  logId: string;
  policyId: string;
  timestamp: number;
  action: 'create' | 'update' | 'delete' | 'activate' | 'deactivate' | 'approve' | 'reject';
  userId: string;
  changes?: Record<string, any>;
  reason?: string;
  ipAddress?: string;
}

// ポリシー検索クエリ
export interface PolicySearchQuery {
  agentId?: string;
  status?: PolicyMetadata['status'];
  createdBy?: string;
  tags?: Record<string, string>;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  nextToken?: string;
}

// ポリシー管理設定
export interface PolicyManagerConfig {
  policyBucket: string;
  policyTable: string;
  auditLogTable: string;
  enableVersioning: boolean;
  enableAuditLogging: boolean;
  requireApproval: boolean;
}

export class PolicyManager {
  private s3Client: S3Client;
  private dynamoClient: DynamoDBDocumentClient;
  private config: PolicyManagerConfig;

  constructor(config: PolicyManagerConfig) {
    this.s3Client = new S3Client({});
    const ddbClient = new DynamoDBClient({});
    this.dynamoClient = DynamoDBDocumentClient.from(ddbClient);
    this.config = config;
  }

  /**
   * ポリシーを作成
   */
  async createPolicy(
    policy: StoredPolicy,
    userId: string,
    reason?: string
  ): Promise<{ policyId: string; version: number }> {
    const policyId = policy.metadata.policyId;
    const version = 1;

    // メタデータ設定
    policy.metadata.version = version;
    policy.metadata.createdBy = userId;
    policy.metadata.createdAt = new Date().toISOString();
    policy.metadata.updatedBy = userId;
    policy.metadata.updatedAt = new Date().toISOString();
    policy.metadata.status = this.config.requireApproval ? 'draft' : 'active';

    // S3にポリシー本体を保存
    await this.savePolicyToS3(policyId, version, policy);

    // DynamoDBにメタデータを保存
    await this.savePolicyMetadata(policy.metadata);

    // 監査ログ記録
    if (this.config.enableAuditLogging) {
      await this.logAudit({
        logId: `${policyId}-${Date.now()}`,
        policyId,
        timestamp: Date.now(),
        action: 'create',
        userId,
        reason,
      });
    }

    return { policyId, version };
  }

  /**
   * ポリシーを取得
   */
  async getPolicy(policyId: string, version?: number): Promise<StoredPolicy | null> {
    // メタデータ取得
    const metadata = await this.getPolicyMetadata(policyId, version);
    if (!metadata) {
      return null;
    }

    // S3からポリシー本体を取得
    const policy = await this.loadPolicyFromS3(policyId, metadata.version);

    return policy;
  }

  /**
   * ポリシーを更新
   */
  async updatePolicy(
    policyId: string,
    updates: Partial<StoredPolicy>,
    userId: string,
    reason?: string
  ): Promise<{ policyId: string; version: number }> {
    // 既存ポリシー取得
    const existing = await this.getPolicy(policyId);
    if (!existing) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    // 新バージョン作成
    const newVersion = this.config.enableVersioning ? existing.metadata.version + 1 : existing.metadata.version;

    // 更新内容をマージ
    const updated: StoredPolicy = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        version: newVersion,
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      },
    };

    // S3に保存
    await this.savePolicyToS3(policyId, newVersion, updated);

    // DynamoDBメタデータ更新
    await this.savePolicyMetadata(updated.metadata);

    // 監査ログ記録
    if (this.config.enableAuditLogging) {
      await this.logAudit({
        logId: `${policyId}-${Date.now()}`,
        policyId,
        timestamp: Date.now(),
        action: 'update',
        userId,
        changes: updates,
        reason,
      });
    }

    return { policyId, version: newVersion };
  }

  /**
   * ポリシーを削除
   */
  async deletePolicy(policyId: string, userId: string, reason?: string): Promise<void> {
    // 既存ポリシー取得
    const existing = await this.getPolicy(policyId);
    if (!existing) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    // S3から削除
    await this.deletePolicyFromS3(policyId, existing.metadata.version);

    // DynamoDBから削除
    await this.deletePolicyMetadata(policyId, existing.metadata.version);

    // 監査ログ記録
    if (this.config.enableAuditLogging) {
      await this.logAudit({
        logId: `${policyId}-${Date.now()}`,
        policyId,
        timestamp: Date.now(),
        action: 'delete',
        userId,
        reason,
      });
    }
  }

  /**
   * ポリシーを検索
   */
  async searchPolicies(query: PolicySearchQuery): Promise<{
    policies: PolicyMetadata[];
    nextToken?: string;
  }> {
    const params: any = {
      TableName: this.config.policyTable,
      Limit: query.limit || 50,
    };

    // agentIdでクエリ
    if (query.agentId) {
      params.IndexName = 'agentId-createdAt-index';
      params.KeyConditionExpression = 'agentId = :agentId';
      params.ExpressionAttributeValues = {
        ':agentId': query.agentId,
      };

      // 日付範囲フィルター
      if (query.fromDate) {
        params.KeyConditionExpression += ' AND createdAt >= :fromDate';
        params.ExpressionAttributeValues[':fromDate'] = query.fromDate;
      }
    }

    // statusでフィルター
    if (query.status) {
      params.IndexName = 'status-updatedAt-index';
      params.KeyConditionExpression = 'status = :status';
      params.ExpressionAttributeValues = {
        ':status': query.status,
      };
    }

    // ページネーション
    if (query.nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(query.nextToken, 'base64').toString());
    }

    const result = await this.dynamoClient.send(new QueryCommand(params));

    const policies = (result.Items || []) as PolicyMetadata[];
    const nextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return { policies, nextToken };
  }

  /**
   * ポリシーをアクティブ化
   */
  async activatePolicy(policyId: string, userId: string): Promise<void> {
    await this.updatePolicyStatus(policyId, 'active', userId, 'activate');
  }

  /**
   * ポリシーを非アクティブ化
   */
  async deactivatePolicy(policyId: string, userId: string): Promise<void> {
    await this.updatePolicyStatus(policyId, 'inactive', userId, 'deactivate');
  }

  /**
   * ポリシーを承認
   */
  async approvePolicy(policyId: string, userId: string): Promise<void> {
    const existing = await this.getPolicy(policyId);
    if (!existing) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    existing.metadata.approvalStatus = 'approved';
    existing.metadata.approvedBy = userId;
    existing.metadata.approvedAt = new Date().toISOString();
    existing.metadata.status = 'active';

    await this.savePolicyMetadata(existing.metadata);

    if (this.config.enableAuditLogging) {
      await this.logAudit({
        logId: `${policyId}-${Date.now()}`,
        policyId,
        timestamp: Date.now(),
        action: 'approve',
        userId,
      });
    }
  }

  /**
   * ポリシーを却下
   */
  async rejectPolicy(policyId: string, userId: string, reason: string): Promise<void> {
    const existing = await this.getPolicy(policyId);
    if (!existing) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    existing.metadata.approvalStatus = 'rejected';
    existing.metadata.status = 'inactive';

    await this.savePolicyMetadata(existing.metadata);

    if (this.config.enableAuditLogging) {
      await this.logAudit({
        logId: `${policyId}-${Date.now()}`,
        policyId,
        timestamp: Date.now(),
        action: 'reject',
        userId,
        reason,
      });
    }
  }

  /**
   * 監査ログを取得
   */
  async getAuditLogs(policyId: string, limit: number = 50): Promise<AuditLogEntry[]> {
    const params = {
      TableName: this.config.auditLogTable,
      IndexName: 'policyId-timestamp-index',
      KeyConditionExpression: 'policyId = :policyId',
      ExpressionAttributeValues: {
        ':policyId': policyId,
      },
      Limit: limit,
      ScanIndexForward: false, // 降順（最新から）
    };

    const result = await this.dynamoClient.send(new QueryCommand(params));
    return (result.Items || []) as AuditLogEntry[];
  }

  /**
   * ポリシーバージョン履歴を取得
   */
  async getPolicyVersions(policyId: string): Promise<PolicyMetadata[]> {
    const params = {
      TableName: this.config.policyTable,
      KeyConditionExpression: 'policyId = :policyId',
      ExpressionAttributeValues: {
        ':policyId': policyId,
      },
      ScanIndexForward: false, // 降順（最新から）
    };

    const result = await this.dynamoClient.send(new QueryCommand(params));
    return (result.Items || []) as PolicyMetadata[];
  }

  /**
   * S3にポリシーを保存
   */
  private async savePolicyToS3(policyId: string, version: number, policy: StoredPolicy): Promise<void> {
    const key = `policies/${policyId}/v${version}.json`;
    
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.config.policyBucket,
        Key: key,
        Body: JSON.stringify(policy),
        ContentType: 'application/json',
      })
    );
  }

  /**
   * S3からポリシーを読み込み
   */
  private async loadPolicyFromS3(policyId: string, version: number): Promise<StoredPolicy> {
    const key = `policies/${policyId}/v${version}.json`;
    
    const result = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.config.policyBucket,
        Key: key,
      })
    );

    const body = await result.Body?.transformToString();
    if (!body) {
      throw new Error(`Policy not found in S3: ${key}`);
    }

    return JSON.parse(body);
  }

  /**
   * S3からポリシーを削除
   */
  private async deletePolicyFromS3(policyId: string, version: number): Promise<void> {
    const key = `policies/${policyId}/v${version}.json`;
    
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.config.policyBucket,
        Key: key,
      })
    );
  }

  /**
   * DynamoDBにメタデータを保存
   */
  private async savePolicyMetadata(metadata: PolicyMetadata): Promise<void> {
    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.config.policyTable,
        Item: metadata,
      })
    );
  }

  /**
   * DynamoDBからメタデータを取得
   */
  private async getPolicyMetadata(policyId: string, version?: number): Promise<PolicyMetadata | null> {
    if (version) {
      // 特定バージョン取得
      const result = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.config.policyTable,
          Key: { policyId, version },
        })
      );
      return (result.Item as PolicyMetadata) || null;
    } else {
      // 最新バージョン取得
      const result = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.config.policyTable,
          KeyConditionExpression: 'policyId = :policyId',
          ExpressionAttributeValues: {
            ':policyId': policyId,
          },
          Limit: 1,
          ScanIndexForward: false, // 降順
        })
      );

      return result.Items && result.Items.length > 0 ? (result.Items[0] as PolicyMetadata) : null;
    }
  }

  /**
   * DynamoDBからメタデータを削除
   */
  private async deletePolicyMetadata(policyId: string, version: number): Promise<void> {
    await this.dynamoClient.send(
      new DeleteCommand({
        TableName: this.config.policyTable,
        Key: { policyId, version },
      })
    );
  }

  /**
   * ポリシーステータスを更新
   */
  private async updatePolicyStatus(
    policyId: string,
    status: PolicyMetadata['status'],
    userId: string,
    action: AuditLogEntry['action']
  ): Promise<void> {
    const existing = await this.getPolicy(policyId);
    if (!existing) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    existing.metadata.status = status;
    existing.metadata.updatedBy = userId;
    existing.metadata.updatedAt = new Date().toISOString();

    await this.savePolicyMetadata(existing.metadata);

    if (this.config.enableAuditLogging) {
      await this.logAudit({
        logId: `${policyId}-${Date.now()}`,
        policyId,
        timestamp: Date.now(),
        action,
        userId,
      });
    }
  }

  /**
   * 監査ログを記録
   */
  private async logAudit(entry: AuditLogEntry): Promise<void> {
    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.config.auditLogTable,
        Item: entry,
      })
    );
  }
}
