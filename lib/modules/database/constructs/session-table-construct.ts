// CDK Construct for Session Management DynamoDB Table
// セッション管理用DynamoDBテーブルのCDKコンストラクト

import { Construct } from 'constructs';
import { 
  Table, 
  AttributeType, 
  BillingMode, 
  ProjectionType,
  TableEncryption 
} from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';

/**
 * セッションテーブルコンストラクトのプロパティ
 */
export interface SessionTableConstructProps {
  /** テーブル名（命名規則に準拠） */
  tableName: string;
  
  /** 環境名（prod, dev, staging等） */
  environment: string;
  
  /** TTL有効期限（秒）デフォルト: 24時間 */
  defaultTtlSeconds?: number;
}

/**
 * セッション管理用DynamoDBテーブルコンストラクト
 * 
 * 機能:
 * - セッションIDをパーティションキーとした高速アクセス
 * - ユーザーIDによる全セッション検索（GSI）
 * - TTLによる自動期限切れセッション削除
 * - 本番環境での暗号化とバックアップ
 * 
 * 使用例:
 * ```typescript
 * const sessionTable = new SessionTableConstruct(this, 'SessionTable', {
 *   tableName: 'TokyoRegion-permission-aware-rag-prod-Sessions',
 *   environment: 'prod'
 * });
 * ```
 */
export class SessionTableConstruct extends Construct {
  /** DynamoDBテーブルインスタンス */
  public readonly table: Table;

  constructor(scope: Construct, id: string, props: SessionTableConstructProps) {
    super(scope, id);

    // セッション管理用DynamoDBテーブル
    this.table = new Table(this, 'SessionTable', {
      tableName: props.tableName,
      
      // パーティションキー: セッションID
      partitionKey: {
        name: 'sessionId',
        type: AttributeType.STRING
      },
      
      // オンデマンド課金（トラフィック変動に対応）
      billingMode: BillingMode.PAY_PER_REQUEST,
      
      // TTL設定（自動削除）- 設計文書に準拠
      timeToLiveAttribute: 'expiresAt',
      
      // 削除ポリシー: 本番環境では保持
      removalPolicy: props.environment === 'prod' 
        ? RemovalPolicy.RETAIN 
        : RemovalPolicy.DESTROY,

      // ポイントインタイムリカバリ（本番環境のみ）
      pointInTimeRecovery: props.environment === 'prod',

      // AWS管理キーによる暗号化（全環境で必須）
      encryption: TableEncryption.AWS_MANAGED,
    });

    /**
     * GSI: ユーザーIDでの検索用
     * 用途: 特定ユーザーの全セッション取得
     * クエリ例: userId = "user123"
     * パフォーマンス: O(1) - ユーザーIDでの直接アクセス
     */
    this.table.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: {
        name: 'userId',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'createdAt',
        type: AttributeType.NUMBER  // Unix timestamp
      },
      projectionType: ProjectionType.ALL
    });

    /**
     * GSI: 有効期限での検索用
     * 用途: 期限切れセッションのクリーンアップ・監視
     * クエリ例: expiresAt < currentTimestamp
     * 注意: TTLによる自動削除があるため、主に監視目的
     */
    this.table.addGlobalSecondaryIndex({
      indexName: 'ExpiresAtIndex',
      partitionKey: {
        name: 'expiresAt',
        type: AttributeType.NUMBER  // Unix timestamp（数値型に変更）
      },
      projectionType: ProjectionType.KEYS_ONLY  // 最小限の投影
    });
  }
}
