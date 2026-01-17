/**
 * データベースモジュール設定インターフェース
 * 
 * 機能:
 * - DynamoDB・OpenSearch・RDS設定の型定義
 * - パフォーマンス・スケーリング・バックアップ設定
 * - セキュリティ・監視設定
 */

import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as rds from 'aws-cdk-lib/aws-rds';

/**
 * DynamoDB設定
 */
export interface DynamoDbConfig {
  /** 課金モード */
  readonly billingMode: dynamodb.BillingMode;
  
  /** 暗号化設定 */
  readonly encryption: DynamoDbEncryptionConfig;
  
  /** ポイントインタイムリカバリ */
  readonly pointInTimeRecovery: boolean;
  
  /** グローバルテーブル設定 */
  readonly globalTables?: DynamoDbGlobalTablesConfig;
  
  /** ストリーム設定 */
  readonly streams?: DynamoDbStreamConfig;
  
  /** バックアップ設定 */
  readonly backup?: DynamoDbBackupConfig;
  
  /** 自動スケーリング設定 */
  readonly autoScaling?: DynamoDbAutoScalingConfig;
  
  /** カスタムテーブル */
  readonly customTables?: DynamoDbCustomTable[];
  
  /** TTL設定 */
  readonly ttl?: DynamoDbTtlConfig[];
}

/**
 * DynamoDB暗号化設定
 */
export interface DynamoDbEncryptionConfig {
  /** 暗号化有効化 */
  readonly enabled: boolean;
  
  /** KMS管理暗号化 */
  readonly kmsManaged: boolean;
  
  /** カスタムKMSキーARN */
  readonly customKmsKeyArn?: string;
}

/**
 * DynamoDBグローバルテーブル設定
 */
export interface DynamoDbGlobalTablesConfig {
  /** グローバルテーブル有効化 */
  readonly enabled: boolean;
  
  /** レプリケーション対象リージョン */
  readonly regions: string[];
  
  /** 競合解決 */
  readonly conflictResolution?: 'OPTIMISTIC_CONCURRENCY' | 'AUTOMERGE';
}

/**
 * DynamoDBストリーム設定
 */
export interface DynamoDbStreamConfig {
  /** ストリーム有効化 */
  readonly enabled: boolean;
  
  /** ストリーム仕様 */
  readonly streamSpecification: dynamodb.StreamViewType;
  
  /** Lambda統合 */
  readonly lambdaIntegration?: DynamoDbLambdaIntegration[];
}

/**
 * DynamoDB Lambda統合設定
 */
export interface DynamoDbLambdaIntegration {
  /** Lambda関数ARN */
  readonly functionArn: string;
  
  /** バッチサイズ */
  readonly batchSize?: number;
  
  /** 開始位置 */
  readonly startingPosition: 'TRIM_HORIZON' | 'LATEST';
  
  /** 最大バッチング時間 */
  readonly maxBatchingWindowInSeconds?: number;
}

/**
 * DynamoDBバックアップ設定
 */
export interface DynamoDbBackupConfig {
  /** 継続的バックアップ */
  readonly continuousBackups: boolean;
  
  /** オンデマンドバックアップ */
  readonly onDemandBackup?: DynamoDbOnDemandBackupConfig;
  
  /** 削除保護 */
  readonly deletionProtection?: boolean;
}

/**
 * DynamoDBオンデマンドバックアップ設定
 */
export interface DynamoDbOnDemandBackupConfig {
  /** バックアップ名プレフィックス */
  readonly backupNamePrefix: string;
  
  /** 保持期間（日） */
  readonly retentionDays: number;
  
  /** スケジュール */
  readonly schedule?: string;
}

/**
 * DynamoDB自動スケーリング設定
 */
export interface DynamoDbAutoScalingConfig {
  /** 読み取り自動スケーリング */
  readonly readAutoScaling?: DynamoDbCapacityAutoScaling;
  
  /** 書き込み自動スケーリング */
  readonly writeAutoScaling?: DynamoDbCapacityAutoScaling;
}

/**
 * DynamoDB容量自動スケーリング設定
 */
export interface DynamoDbCapacityAutoScaling {
  /** 最小容量 */
  readonly minCapacity: number;
  
  /** 最大容量 */
  readonly maxCapacity: number;
  
  /** 目標使用率 */
  readonly targetUtilization: number;
  
  /** スケールアップクールダウン */
  readonly scaleUpCooldown?: number;
  
  /** スケールダウンクールダウン */
  readonly scaleDownCooldown?: number;
}

/**
 * DynamoDBカスタムテーブル
 */
export interface DynamoDbCustomTable {
  /** テーブル名 */
  readonly tableName: string;
  
  /** パーティションキー */
  readonly partitionKey: dynamodb.Attribute;
  
  /** ソートキー */
  readonly sortKey?: dynamodb.Attribute;
  
  /** グローバルセカンダリインデックス */
  readonly globalSecondaryIndexes?: DynamoDbGlobalSecondaryIndex[];
  
  /** ローカルセカンダリインデックス */
  readonly localSecondaryIndexes?: DynamoDbLocalSecondaryIndex[];
  
  /** 課金モード */
  readonly billingMode?: dynamodb.BillingMode;
  
  /** プロビジョンド容量 */
  readonly provisionedCapacity?: DynamoDbProvisionedCapacity;
}

/**
 * DynamoDBグローバルセカンダリインデックス
 */
export interface DynamoDbGlobalSecondaryIndex {
  /** インデックス名 */
  readonly indexName: string;
  
  /** パーティションキー */
  readonly partitionKey: dynamodb.Attribute;
  
  /** ソートキー */
  readonly sortKey?: dynamodb.Attribute;
  
  /** プロジェクション */
  readonly projection?: dynamodb.ProjectionType;
  
  /** プロビジョンド容量 */
  readonly provisionedCapacity?: DynamoDbProvisionedCapacity;
}

/**
 * DynamoDBローカルセカンダリインデックス
 */
export interface DynamoDbLocalSecondaryIndex {
  /** インデックス名 */
  readonly indexName: string;
  
  /** ソートキー */
  readonly sortKey: dynamodb.Attribute;
  
  /** プロジェクション */
  readonly projection?: dynamodb.ProjectionType;
}

/**
 * DynamoDBプロビジョンド容量
 */
export interface DynamoDbProvisionedCapacity {
  /** 読み取り容量 */
  readonly readCapacity: number;
  
  /** 書き込み容量 */
  readonly writeCapacity: number;
}

/**
 * DynamoDB TTL設定
 */
export interface DynamoDbTtlConfig {
  /** テーブル名 */
  readonly tableName: string;
  
  /** TTL属性名 */
  readonly attributeName: string;
}

/**
 * OpenSearch設定
 */
export interface OpenSearchConfig {
  /** OpenSearch有効化 */
  readonly enabled: boolean;
  
  /** サーバーレス使用 */
  readonly serverless: boolean;
  
  /** 暗号化設定 */
  readonly encryption: OpenSearchEncryptionConfig;
  
  /** VPC設定 */
  readonly vpc?: OpenSearchVpcConfig;
  
  /** アクセスポリシー */
  readonly accessPolicy?: OpenSearchAccessPolicy;
  
  /** ドメイン設定 */
  readonly domainConfig?: OpenSearchDomainConfig;
  
  /** インデックス設定 */
  readonly indexConfig?: OpenSearchIndexConfig[];
  
  /** 監視設定 */
  readonly monitoring?: OpenSearchMonitoringConfig;
}

/**
 * OpenSearch暗号化設定
 */
export interface OpenSearchEncryptionConfig {
  /** 暗号化有効化 */
  readonly enabled: boolean;
  
  /** KMS管理暗号化 */
  readonly kmsManaged: boolean;
  
  /** カスタムKMSキーARN */
  readonly customKmsKeyArn?: string;
  
  /** ノード間暗号化 */
  readonly nodeToNodeEncryption?: boolean;
}

/**
 * OpenSearch VPC設定
 */
export interface OpenSearchVpcConfig {
  /** VPC有効化 */
  readonly enabled: boolean;
  
  /** セキュリティグループID */
  readonly securityGroupIds?: string[];
  
  /** サブネットID */
  readonly subnetIds?: string[];
}

/**
 * OpenSearchアクセスポリシー
 */
export interface OpenSearchAccessPolicy {
  /** プリンシパル */
  readonly principals: string[];
  
  /** アクション */
  readonly actions: string[];
  
  /** リソース */
  readonly resources?: string[];
  
  /** 条件 */
  readonly conditions?: Record<string, any>;
}

/**
 * OpenSearchドメイン設定
 */
export interface OpenSearchDomainConfig {
  /** ドメイン名 */
  readonly domainName: string;
  
  /** エンジンバージョン */
  readonly engineVersion: string;
  
  /** インスタンスタイプ */
  readonly instanceType: string;
  
  /** インスタンス数 */
  readonly instanceCount: number;
  
  /** マスターノード設定 */
  readonly masterNodes?: OpenSearchMasterNodeConfig;
  
  /** ストレージ設定 */
  readonly storage?: OpenSearchStorageConfig;
}

/**
 * OpenSearchマスターノード設定
 */
export interface OpenSearchMasterNodeConfig {
  /** マスターノード有効化 */
  readonly enabled: boolean;
  
  /** インスタンスタイプ */
  readonly instanceType: string;
  
  /** インスタンス数 */
  readonly instanceCount: number;
}

/**
 * OpenSearchストレージ設定
 */
export interface OpenSearchStorageConfig {
  /** ストレージタイプ */
  readonly storageType: 'gp2' | 'gp3' | 'io1';
  
  /** ストレージサイズ（GB） */
  readonly volumeSize: number;
  
  /** IOPS */
  readonly iops?: number;
}

/**
 * OpenSearchインデックス設定
 */
export interface OpenSearchIndexConfig {
  /** インデックス名 */
  readonly indexName: string;
  
  /** マッピング */
  readonly mapping: Record<string, any>;
  
  /** 設定 */
  readonly settings?: Record<string, any>;
  
  /** エイリアス */
  readonly aliases?: string[];
}

/**
 * OpenSearch監視設定
 */
export interface OpenSearchMonitoringConfig {
  /** CloudWatchログ */
  readonly cloudWatchLogs: boolean;
  
  /** スローログ */
  readonly slowLogs?: boolean;
  
  /** アプリケーションログ */
  readonly applicationLogs?: boolean;
  
  /** インデックススローログ */
  readonly indexSlowLogs?: boolean;
}

/**
 * RDS設定
 */
export interface RdsConfig {
  /** RDS有効化 */
  readonly enabled: boolean;
  
  /** エンジン */
  readonly engine: rds.IEngine;
  
  /** インスタンスクラス */
  
  /** インスタンスサイズ */
  
  /** マルチAZ */
  readonly multiAz?: boolean;
  
  /** 暗号化設定 */
  readonly encryption?: RdsEncryptionConfig;
  
  /** バックアップ設定 */
  readonly backup?: RdsBackupConfig;
  
  /** 監視設定 */
  readonly monitoring?: RdsMonitoringConfig;
  
  /** パラメータグループ */
  readonly parameterGroup?: RdsParameterGroupConfig;
  
  /** セキュリティグループ */
  readonly securityGroups?: string[];
}

/**
 * RDS暗号化設定
 */
export interface RdsEncryptionConfig {
  /** 暗号化有効化 */
  readonly enabled: boolean;
  
  /** KMSキーARN */
  readonly kmsKeyArn?: string;
}

/**
 * RDSバックアップ設定
 */
export interface RdsBackupConfig {
  /** 自動バックアップ */
  readonly automaticBackup: boolean;
  
  /** バックアップ保持期間（日） */
  readonly retentionDays: number;
  
  /** バックアップウィンドウ */
  readonly backupWindow?: string;
  
  /** メンテナンスウィンドウ */
  readonly maintenanceWindow?: string;
  
  /** 削除保護 */
  readonly deletionProtection?: boolean;
}

/**
 * RDS監視設定
 */
export interface RdsMonitoringConfig {
  /** 拡張監視 */
  readonly enhancedMonitoring: boolean;
  
  /** 監視間隔（秒） */
  readonly monitoringInterval?: number;
  
  /** 監視ロールARN */
  readonly monitoringRoleArn?: string;
  
  /** パフォーマンスインサイト */
  readonly performanceInsights?: boolean;
}

/**
 * RDSパラメータグループ設定
 */
export interface RdsParameterGroupConfig {
  /** パラメータグループ名 */
  readonly groupName: string;
  
  /** 説明 */
  readonly description: string;
  
  /** パラメータ */
  readonly parameters: Record<string, string>;
}

/**
 * データベース統合設定
 */
export interface DatabaseConfig {
  /** DynamoDB設定 */
  readonly dynamoDb: DynamoDbConfig;
  
  /** OpenSearch設定 */
  readonly openSearch: OpenSearchConfig;
  
  /** RDS設定 */
  readonly rds: RdsConfig;
  
  /** データ移行設定 */
  readonly migration?: DatabaseMigrationConfig;
  
  /** 監視設定 */
  readonly monitoring?: DatabaseMonitoringConfig;
  
  /** バックアップ設定 */
  readonly backup?: DatabaseBackupConfig;
}

/**
 * データベース移行設定
 */
export interface DatabaseMigrationConfig {
  /** DMS有効化 */
  readonly dmsEnabled: boolean;
  
  /** 移行タスク */
  readonly migrationTasks?: DatabaseMigrationTask[];
}

/**
 * データベース移行タスク
 */
export interface DatabaseMigrationTask {
  /** タスク名 */
  readonly taskName: string;
  
  /** ソースエンドポイント */
  readonly sourceEndpoint: string;
  
  /** ターゲットエンドポイント */
  readonly targetEndpoint: string;
  
  /** 移行タイプ */
  readonly migrationType: 'full-load' | 'cdc' | 'full-load-and-cdc';
}

/**
 * データベース監視設定
 */
export interface DatabaseMonitoringConfig {
  /** CloudWatchメトリクス */
  readonly cloudWatchMetrics: boolean;
  
  /** アラート設定 */
  readonly alerts?: DatabaseAlertConfig[];
  
  /** パフォーマンス監視 */
  readonly performanceMonitoring?: boolean;
}

/**
 * データベースアラート設定
 */
export interface DatabaseAlertConfig {
  /** メトリクス名 */
  readonly metricName: string;
  
  /** 閾値 */
  readonly threshold: number;
  
  /** 比較演算子 */
  readonly comparisonOperator: string;
  
  /** 通知先 */
  readonly notificationTargets: string[];
}

/**
 * データベースバックアップ設定
 */
export interface DatabaseBackupConfig {
  /** クロスリージョンバックアップ */
  readonly crossRegionBackup: boolean;
  
  /** バックアップ暗号化 */
  readonly backupEncryption?: boolean;
  
  /** 保持期間（日） */
  readonly retentionDays?: number;
}