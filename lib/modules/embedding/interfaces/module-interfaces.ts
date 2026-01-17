/**
 * モジュール間インターフェース定義
 * 
 * Agent Steeringルール準拠:
 * - モジュラーアーキテクチャ強制（lib/modules/compute/interfaces/）
 * - AWS Batch、ECS、Spot Fleet間の連携インターフェース定義
 * - 共通リソース（VPC、セキュリティグループ）の管理インターフェース
 * 
 * Requirements: 4.5
 */

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';

/**
 * Embeddingモジュール間共通インターフェース
 */
export interface EmbeddingModuleInterface {
  /** モジュール名 */
  readonly moduleName: string;
  
  /** モジュール有効化状態 */
  readonly enabled: boolean;
  
  /** 共通リソース参照 */
  readonly commonResources: EmbeddingCommonResources;
  
  /** モジュール固有リソース */
  readonly moduleResources: EmbeddingModuleResources;
  
  /** 他モジュールとの依存関係 */
  readonly dependencies: EmbeddingModuleDependencies;
}

/**
 * Embedding共通リソース
 * 
 * 全モジュールで共有されるリソース
 */
export interface EmbeddingCommonResources {
  /** VPCリソース */
  readonly vpc: EmbeddingVpcResources;
  
  /** セキュリティグループリソース */
  readonly securityGroups: EmbeddingSecurityGroupResources;
  
  /** IAMリソース */
  readonly iam: EmbeddingIamResources;
  
  /** ログリソース */
  readonly logging: EmbeddingLoggingResources;
  
  /** ストレージリソース */
  readonly storage: EmbeddingStorageResources;
}

/**
 * Embedding VPCリソース
 */
export interface EmbeddingVpcResources {
  /** VPC */
  readonly vpc: ec2.IVpc;
  
  /** プライベートサブネット */
  readonly privateSubnets: ec2.ISubnet[];
  
  /** パブリックサブネット */
  readonly publicSubnets?: ec2.ISubnet[];
  
  /** アベイラビリティゾーン */
  readonly availabilityZones: string[];
}

/**
 * Embeddingセキュリティグループリソース
 */
export interface EmbeddingSecurityGroupResources {
  /** Batch用セキュリティグループ */
  readonly batchSecurityGroup?: ec2.ISecurityGroup;
  
  /** ECS用セキュリティグループ */
  readonly ecsSecurityGroup?: ec2.ISecurityGroup;
  
  /** Spot Fleet用セキュリティグループ */
  readonly spotFleetSecurityGroup?: ec2.ISecurityGroup;
  
  /** 共通セキュリティグループ */
  readonly commonSecurityGroup: ec2.ISecurityGroup;
  
  /** FSxアクセス用セキュリティグループ */
  readonly fsxSecurityGroup?: ec2.ISecurityGroup;
}

/**
 * Embedding IAMリソース
 */
export interface EmbeddingIamResources {
  /** Batch実行ロール */
  readonly batchExecutionRole?: iam.IRole;
  
  /** Batchジョブロール */
  readonly batchJobRole?: iam.IRole;
  
  /** ECSタスク実行ロール */
  readonly ecsTaskExecutionRole?: iam.IRole;
  
  /** ECSタスクロール */
  readonly ecsTaskRole?: iam.IRole;
  
  /** Spot Fleet実行ロール */
  readonly spotFleetRole?: iam.IRole;
  
  /** 共通サービスロール */
  readonly commonServiceRole: iam.IRole;
}

/**
 * Embeddingログリソース
 */
export interface EmbeddingLoggingResources {
  /** Batch用ロググループ */
  readonly batchLogGroup?: logs.ILogGroup;
  
  /** ECS用ロググループ */
  readonly ecsLogGroup?: logs.ILogGroup;
  
  /** Spot Fleet用ロググループ */
  readonly spotFleetLogGroup?: logs.ILogGroup;
  
  /** 共通ロググループ */
  readonly commonLogGroup: logs.ILogGroup;
}

/**
 * Embeddingストレージリソース
 */
export interface EmbeddingStorageResources {
  /** FSx for NetApp ONTAPファイルシステム */
  readonly fsxFileSystem?: any; // FSx construct type
  
  
  /** ECRリポジトリ */
  readonly ecrRepository?: any; // ECR construct type
  
  /** S3バケット（ログ・アーティファクト用） */
  readonly s3Bucket?: any; // S3 construct type
}

/**
 * Embeddingモジュール固有リソース
 */
export interface EmbeddingModuleResources {
  /** AWS Batchリソース */
  readonly batch?: EmbeddingBatchResources;
  
  /** ECS on EC2リソース */
  readonly ecs?: EmbeddingEcsResources;
  
  /** Spot Fleetリソース */
  readonly spotFleet?: EmbeddingSpotFleetResources;
}

/**
 * Embedding AWS Batchリソース
 */
export interface EmbeddingBatchResources {
  /** コンピュート環境 */
  readonly computeEnvironment: any; // Batch ComputeEnvironment construct
  
  /** ジョブ定義 */
  readonly jobDefinition: any; // Batch JobDefinition construct
  
  /** ジョブキュー */
  readonly jobQueue: any; // Batch JobQueue construct
  
  /** 起動テンプレート */
  readonly launchTemplate?: ec2.ILaunchTemplate;
}

/**
 * Embedding ECSリソース
 */
export interface EmbeddingEcsResources {
  /** ECSクラスター */
  readonly cluster: any; // ECS Cluster construct
  
  /** タスク定義 */
  readonly taskDefinition: any; // ECS TaskDefinition construct
  
  /** サービス */
  readonly service: any; // ECS Service construct
  
  /** 容量プロバイダー */
  readonly capacityProvider?: any; // ECS CapacityProvider construct
}

/**
 * Embedding Spot Fleetリソース
 */
export interface EmbeddingSpotFleetResources {
  /** Spot Fleetリクエスト */
  readonly spotFleetRequest: any; // EC2 SpotFleet construct
  
  /** 起動テンプレート */
  readonly launchTemplate: ec2.ILaunchTemplate;
  
  /** Auto Scalingグループ */
  readonly autoScalingGroup?: any; // AutoScaling construct
}

/**
 * Embeddingモジュール依存関係
 */
export interface EmbeddingModuleDependencies {
  /** 必須依存モジュール */
  readonly requiredModules: string[];
  
  /** オプション依存モジュール */
  readonly optionalModules?: string[];
  
  /** 依存リソース */
  readonly requiredResources: EmbeddingRequiredResources;
  
  /** 提供リソース */
  readonly providedResources: EmbeddingProvidedResources;
}

/**
 * Embedding必須リソース
 */
export interface EmbeddingRequiredResources {
  /** VPC必須 */
  readonly requiresVpc: boolean;
  
  /** セキュリティグループ必須 */
  readonly requiresSecurityGroup: boolean;
  
  /** IAMロール必須 */
  readonly requiresIamRole: boolean;
  
  /** ストレージ必須 */
  readonly requiresStorage: boolean;
  
  /** ログ必須 */
  readonly requiresLogging: boolean;
}

/**
 * Embedding提供リソース
 */
export interface EmbeddingProvidedResources {
  /** コンピュートリソース提供 */
  readonly providesCompute: boolean;
  
  /** ストレージリソース提供 */
  readonly providesStorage: boolean;
  
  /** ネットワークリソース提供 */
  readonly providesNetwork: boolean;
  
  /** 監視リソース提供 */
  readonly providesMonitoring: boolean;
}

/**
 * Embeddingモジュール間通信インターフェース
 */
export interface EmbeddingModuleCommunication {
  /** 送信者モジュール */
  readonly sourceModule: string;
  
  /** 受信者モジュール */
  readonly targetModule: string;
  
  /** 通信タイプ */
  readonly communicationType: EmbeddingCommunicationType;
  
  /** 通信設定 */
  readonly communicationConfig: EmbeddingCommunicationConfig;
}

/**
 * Embedding通信タイプ
 */
export enum EmbeddingCommunicationType {
  /** 直接API呼び出し */
  DIRECT_API = 'DIRECT_API',
  
  /** SQSキュー経由 */
  SQS_QUEUE = 'SQS_QUEUE',
  
  /** SNSトピック経由 */
  SNS_TOPIC = 'SNS_TOPIC',
  
  /** EventBridge経由 */
  EVENT_BRIDGE = 'EVENT_BRIDGE',
  
  /** 共有ストレージ経由 */
  SHARED_STORAGE = 'SHARED_STORAGE',
}

/**
 * Embedding通信設定
 */
export interface EmbeddingCommunicationConfig {
  /** エンドポイント */
  readonly endpoint?: string;
  
  /** 認証設定 */
  readonly authentication?: EmbeddingAuthenticationConfig;
  
  /** 暗号化設定 */
  readonly encryption?: EmbeddingEncryptionConfig;
  
  /** 再試行設定 */
  readonly retryConfig?: EmbeddingRetryConfig;
}

/**
 * Embedding認証設定
 */
export interface EmbeddingAuthenticationConfig {
  /** 認証タイプ */
  readonly type: 'IAM' | 'API_KEY' | 'OAUTH' | 'NONE';
  
  /** 認証パラメータ */
  readonly parameters?: Record<string, string>;
}

/**
 * Embedding暗号化設定
 */
export interface EmbeddingEncryptionConfig {
  /** 転送時暗号化 */
  readonly encryptionInTransit: boolean;
  
  /** 保存時暗号化 */
  readonly encryptionAtRest: boolean;
  
  /** KMSキーARN */
  readonly kmsKeyArn?: string;
}

/**
 * Embedding再試行設定
 */
export interface EmbeddingRetryConfig {
  /** 最大再試行回数 */
  readonly maxRetries: number;
  
  /** 初期遅延（ミリ秒） */
  readonly initialDelay: number;
  
  /** 最大遅延（ミリ秒） */
  readonly maxDelay: number;
  
  /** バックオフ戦略 */
  readonly backoffStrategy: 'EXPONENTIAL' | 'LINEAR' | 'FIXED';
}

/**
 * Embeddingリソース共有インターフェース
 */
export interface EmbeddingResourceSharing {
  /** 共有リソースタイプ */
  readonly resourceType: EmbeddingSharedResourceType;
  
  /** リソース識別子 */
  readonly resourceId: string;
  
  /** 共有権限 */
  readonly permissions: EmbeddingResourcePermissions;
  
  /** アクセス制御 */
  readonly accessControl: EmbeddingResourceAccessControl;
}

/**
 * Embedding共有リソースタイプ
 */
export enum EmbeddingSharedResourceType {
  /** VPC */
  VPC = 'VPC',
  
  /** セキュリティグループ */
  SECURITY_GROUP = 'SECURITY_GROUP',
  
  /** IAMロール */
  IAM_ROLE = 'IAM_ROLE',
  
  /** ロググループ */
  LOG_GROUP = 'LOG_GROUP',
  
  /** FSxファイルシステム */
  FSX_FILESYSTEM = 'FSX_FILESYSTEM',
  
  /** ECRリポジトリ */
  ECR_REPOSITORY = 'ECR_REPOSITORY',
}

/**
 * Embeddingリソース権限
 */
export interface EmbeddingResourcePermissions {
  /** 読み取り権限 */
  readonly read: boolean;
  
  /** 書き込み権限 */
  readonly write: boolean;
  
  /** 削除権限 */
  readonly delete: boolean;
  
  /** 管理権限 */
  readonly admin: boolean;
}

/**
 * Embeddingリソースアクセス制御
 */
export interface EmbeddingResourceAccessControl {
  /** 許可されたモジュール */
  readonly allowedModules: string[];
  
  /** 拒否されたモジュール */
  readonly deniedModules?: string[];
  
  /** 条件付きアクセス */
  readonly conditionalAccess?: EmbeddingConditionalAccess[];
}

/**
 * Embedding条件付きアクセス
 */
export interface EmbeddingConditionalAccess {
  /** 条件 */
  readonly condition: string;
  
  /** 条件が真の場合の権限 */
  readonly permissionsIfTrue: EmbeddingResourcePermissions;
  
  /** 条件が偽の場合の権限 */
  readonly permissionsIfFalse: EmbeddingResourcePermissions;
}

/**
 * Embeddingモジュール状態管理インターフェース
 */
export interface EmbeddingModuleState {
  /** モジュール名 */
  readonly moduleName: string;
  
  /** 現在の状態 */
  readonly currentState: EmbeddingModuleStatus;
  
  /** 前回の状態 */
  readonly previousState?: EmbeddingModuleStatus;
  
  /** 状態変更履歴 */
  readonly stateHistory: EmbeddingStateChange[];
  
  /** ヘルスチェック結果 */
  readonly healthCheck: EmbeddingModuleHealthCheck;
}

/**
 * Embeddingモジュール状態
 */
export enum EmbeddingModuleStatus {
  /** 初期化中 */
  INITIALIZING = 'INITIALIZING',
  
  /** 実行中 */
  RUNNING = 'RUNNING',
  
  /** 停止中 */
  STOPPING = 'STOPPING',
  
  /** 停止済み */
  STOPPED = 'STOPPED',
  
  /** エラー */
  ERROR = 'ERROR',
  
  /** メンテナンス中 */
  MAINTENANCE = 'MAINTENANCE',
}

/**
 * Embedding状態変更
 */
export interface EmbeddingStateChange {
  /** 変更時刻 */
  readonly timestamp: Date;
  
  /** 変更前状態 */
  readonly fromState: EmbeddingModuleStatus;
  
  /** 変更後状態 */
  readonly toState: EmbeddingModuleStatus;
  
  /** 変更理由 */
  readonly reason: string;
  
  /** 変更者 */
  readonly changedBy: string;
}

/**
 * Embeddingモジュールヘルスチェック
 */
export interface EmbeddingModuleHealthCheck {
  /** ヘルスチェック状態 */
  readonly status: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN';
  
  /** 最終チェック時刻 */
  readonly lastCheckTime: Date;
  
  /** チェック結果詳細 */
  readonly details: EmbeddingHealthCheckDetail[];
  
  /** メトリクス */
  readonly metrics: Record<string, number>;
}

/**
 * Embeddingヘルスチェック詳細
 */
export interface EmbeddingHealthCheckDetail {
  /** チェック項目名 */
  readonly checkName: string;
  
  /** チェック結果 */
  readonly result: 'PASS' | 'FAIL' | 'WARN';
  
  /** メッセージ */
  readonly message: string;
  
  /** チェック時刻 */
  readonly timestamp: Date;
}