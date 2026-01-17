/**
 * Embedding専用設定インターフェース
 *
 * Agent Steeringルール準拠:
 * - モジュラーアーキテクチャ強制（lib/modules/compute/interfaces/）
 * - TypeScript型安全性の強制
 * - 設定・変更容易性を担保するモジュール化アーキテクチャ
 *
 * 機能:
 * - AWS Batch、ECS on EC2、Spot Fleet の有効化/無効化制御
 * - デプロイ時・運用時パラメータ調整機能
 * - FSx for NetApp ONTAP統合設定
 * - OpenSearch Serverless統合設定
 */
import * as ecs from 'aws-cdk-lib/aws-ecs';
/**
 * Embedding統合設定
 *
 * Requirements: 4.3, 4.4, 4.5
 */
export interface EmbeddingConfig {
    /** プロジェクト名 */
    readonly projectName: string;
    /** 環境名 */
    readonly environment: string;
    /** AWS Batch設定 */
    readonly awsBatch: EmbeddingBatchConfig;
    /** ECS on EC2設定 */
    readonly ecsOnEC2: EmbeddingEcsConfig;
    /** Spot Fleet設定 */
    readonly spotFleet: EmbeddingSpotFleetConfig;
    /** 共通リソース設定 */
    readonly commonResources: EmbeddingCommonResourcesConfig;
    /** 監視・ログ設定 */
    readonly monitoring: EmbeddingMonitoringConfig;
    /** Job Definition設定 */
    readonly jobDefinition: EmbeddingJobDefinitionConfig;
    /** FSx統合設定 */
    readonly fsxIntegration: EmbeddingFsxIntegrationConfig;
    /** Active Directory設定 */
    readonly activeDirectory: EmbeddingActiveDirectoryConfig;
    /** Bedrock設定 */
    readonly bedrock: EmbeddingBedrockConfig;
    /** OpenSearch設定 */
    readonly openSearch: EmbeddingOpenSearchIntegrationConfig;
    /** RDS設定（OpenSearchの代替） */
    readonly rds?: EmbeddingRdsConfig;
}
/**
 * Embedding AWS Batch設定
 *
 * 最優先実装モジュール
 * Requirements: 1.1, 1.2, 1.3, 5.1
 */
export interface EmbeddingBatchConfig {
    /** AWS Batch有効化フラグ */
    readonly enabled: boolean;
    /** コンピュート環境設定 */
    readonly computeEnvironment: EmbeddingBatchComputeEnvironment;
    /** ジョブ定義設定 */
    readonly jobDefinition: EmbeddingBatchJobDefinition;
    /** ジョブキュー設定 */
    readonly jobQueue: EmbeddingBatchJobQueue;
    /** 自動スケーリング設定 */
    readonly autoScaling: EmbeddingBatchAutoScaling;
}
/**
 * Embedding Batchコンピュート環境
 */
export interface EmbeddingBatchComputeEnvironment {
    /** 環境名プレフィックス */
    readonly namePrefix: string;
    /** コンピュートタイプ */
    readonly type: 'MANAGED' | 'UNMANAGED';
    /** インスタンスタイプ */
    readonly instanceTypes: string[];
    /** 最小vCPU */
    readonly minvCpus: number;
    /** 最大vCPU */
    readonly maxvCpus: number;
    /** 希望vCPU */
    readonly desiredvCpus?: number;
    /** Multi-AZ配置 */
    readonly multiAz: boolean;
    /** スポットインスタンス使用 */
    readonly useSpotInstances?: boolean;
    /** スポット価格上限（%） */
    readonly spotBidPercentage?: number;
} /**
 *
 Embedding Batchジョブ定義
 */
export interface EmbeddingBatchJobDefinition {
    /** ジョブ定義名プレフィックス */
    readonly namePrefix: string;
    /** ECRイメージURI */
    readonly imageUri: string;
    /** vCPU設定 */
    readonly vcpus: number;
    /** メモリ設定（MB） */
    readonly memory: number;
    /** ジョブロールARN */
    readonly jobRoleArn?: string;
    /** 環境変数 */
    readonly environment: Record<string, string>;
    /** FSx マウント設定 */
    readonly fsxMount: EmbeddingFsxMountConfig;
    /** タイムアウト（秒） */
    readonly timeout?: number;
    /** 再試行戦略 */
    readonly retryStrategy?: EmbeddingRetryStrategy;
}
/**
 * Embedding FSx マウント設定
 */
export interface EmbeddingFsxMountConfig {
    /** FSx ファイルシステムID */
    readonly fileSystemId: string;
    /** SMB/CIFS マウントポイント */
    readonly mountPoint: string;
    /** 読み取り専用モード */
    readonly readOnly: boolean;
    /** マウントオプション */
    readonly mountOptions?: string[];
}
/**
 * Embedding 再試行戦略
 */
export interface EmbeddingRetryStrategy {
    /** 最大試行回数 */
    readonly attempts: number;
}
/**
 * Embedding Batchジョブキュー
 */
export interface EmbeddingBatchJobQueue {
    /** キュー名プレフィックス */
    readonly namePrefix: string;
    /** 優先度 */
    readonly priority: number;
    /** 状態 */
    readonly state: 'ENABLED' | 'DISABLED';
}
/**
 * Embedding Batch自動スケーリング
 */
export interface EmbeddingBatchAutoScaling {
    /** 自動スケーリング有効化 */
    readonly enabled: boolean;
    /** スケールアウト閾値（CPU使用率%） */
    readonly scaleOutThreshold: number;
    /** スケールイン閾値（CPU使用率%） */
    readonly scaleInThreshold: number;
    /** クールダウン期間（秒） */
    readonly cooldownPeriod: number;
} /**

 * Embedding ECS on EC2設定
 *
 * 第2優先実装モジュール
 * Requirements: 2.1, 2.2, 3.1, 3.2
 */
export interface EmbeddingEcsConfig {
    /** ECS有効化フラグ */
    readonly enabled: boolean;
    /** クラスター設定 */
    readonly cluster: EmbeddingEcsCluster;
    /** タスク定義設定 */
    readonly taskDefinition: EmbeddingEcsTaskDefinition;
    /** サービス設定 */
    readonly service: EmbeddingEcsService;
    /** 自動スケーリング設定 */
    readonly autoScaling: EmbeddingEcsAutoScaling;
}
/**
 * Embedding ECSクラスター
 */
export interface EmbeddingEcsCluster {
    /** クラスター名プレフィックス */
    readonly namePrefix: string;
    /** 容量プロバイダー */
    readonly capacityProviders: string[];
    /** コンテナインサイト有効化 */
    readonly containerInsights: boolean;
    /** Multi-AZ配置 */
    readonly multiAz: boolean;
}
/**
 * Embedding ECSタスク定義
 */
export interface EmbeddingEcsTaskDefinition {
    /** タスク定義名プレフィックス */
    readonly namePrefix: string;
    /** ネットワークモード */
    readonly networkMode: ecs.NetworkMode;
    /** 互換性 */
    readonly compatibility: ecs.Compatibility;
    /** CPU */
    readonly cpu: string;
    /** メモリ */
    readonly memory: string;
    /** タスクロールARN */
    readonly taskRoleArn?: string;
    /** 実行ロールARN */
    readonly executionRoleArn?: string;
    /** コンテナ定義 */
    readonly containerDefinition: EmbeddingEcsContainer;
}
/**
 * Embedding ECSコンテナ定義
 */
export interface EmbeddingEcsContainer {
    /** コンテナ名 */
    readonly name: string;
    /** ECRイメージURI */
    readonly imageUri: string;
    /** CPU */
    readonly cpu: number;
    /** メモリ */
    readonly memory: number;
    /** 必須フラグ */
    readonly essential: boolean;
    /** 環境変数 */
    readonly environment: Record<string, string>;
    /** ポートマッピング */
    readonly portMappings?: EmbeddingEcsPortMapping[];
    /** ログ設定 */
    readonly logging: EmbeddingEcsLogging;
    /** ヘルスチェック */
    readonly healthCheck?: EmbeddingEcsHealthCheck;
}
/**
 * Embedding ECSポートマッピング
 */
export interface EmbeddingEcsPortMapping {
    /** コンテナポート */
    readonly containerPort: number;
    /** ホストポート */
    readonly hostPort?: number;
    /** プロトコル */
    readonly protocol: ecs.Protocol;
}
/**
 * Embedding ECSログ設定
 */
export interface EmbeddingEcsLogging {
    /** ログドライバー */
    readonly logDriver: string;
    /** ロググループ名 */
    readonly logGroup: string;
    /** ログストリームプレフィックス */
    readonly logStreamPrefix: string;
}
/**
 * Embedding ECSヘルスチェック
 */
export interface EmbeddingEcsHealthCheck {
    /** ヘルスチェックコマンド */
    readonly command: string[];
    /** 間隔（秒） */
    readonly interval: number;
    /** タイムアウト（秒） */
    readonly timeout: number;
    /** 再試行回数 */
    readonly retries: number;
    /** 開始期間（秒） */
    readonly startPeriod: number;
}
/**
 * Embedding ECSサービス
 */
export interface EmbeddingEcsService {
    /** サービス名プレフィックス */
    readonly namePrefix: string;
    /** 希望タスク数 */
    readonly desiredCount: number;
    /** 起動タイプ */
    readonly launchType: ecs.LaunchType;
    /** ネットワーク設定 */
    readonly networkConfiguration: EmbeddingEcsNetworkConfig;
}
/**
 * Embedding ECSネットワーク設定
 */
export interface EmbeddingEcsNetworkConfig {
    /** サブネットID */
    readonly subnets: string[];
    /** セキュリティグループID */
    readonly securityGroups: string[];
    /** パブリックIP割り当て */
    readonly assignPublicIp: boolean;
}
/**
 * Embedding ECS自動スケーリング
 */
export interface EmbeddingEcsAutoScaling {
    /** 自動スケーリング有効化 */
    readonly enabled: boolean;
    /** 最小容量 */
    readonly minCapacity: number;
    /** 最大容量 */
    readonly maxCapacity: number;
    /** 目標CPU使用率（%） */
    readonly targetCpuUtilization: number;
}
/**
 * Embedding Spot Fleet設定
 *
 * コスト最適化モジュール
 * Requirements: 4.5
 */
export interface EmbeddingSpotFleetConfig {
    /** Spot Fleet有効化フラグ */
    readonly enabled: boolean;
    /** スポット価格上限（USD/時間） */
    readonly spotPrice: number;
    /** ターゲット容量 */
    readonly targetCapacity: number;
    /** インスタンスタイプ（優先度順） */
    readonly instanceTypes: EmbeddingSpotInstanceType[];
    /** Multi-AZ配置 */
    readonly multiAz: boolean;
    /** 自動スケーリング設定 */
    readonly autoScaling: EmbeddingSpotFleetAutoScaling;
    /** 割り込み処理設定 */
    readonly interruptionHandling: EmbeddingSpotInterruptionConfig;
    /** コスト最適化設定 */
    readonly costOptimization: EmbeddingSpotCostOptimizationConfig;
}
/**
 * Embedding Spotインスタンスタイプ設定
 */
export interface EmbeddingSpotInstanceType {
    /** インスタンスタイプ */
    readonly instanceType: string;
    /** 重み（容量計算用） */
    readonly weight: number;
    /** 優先度（1-20、低いほど高優先） */
    readonly priority: number;
    /** 最大スポット価格 */
    readonly maxSpotPrice?: number;
}
/**
 * Embedding Spot割り込み処理設定
 */
export interface EmbeddingSpotInterruptionConfig {
    /** 割り込み通知処理 */
    readonly notificationHandling: boolean;
    /** グレースフルシャットダウン時間（秒） */
    readonly gracefulShutdownSeconds: number;
    /** 作業保存戦略 */
    readonly workSaveStrategy: 'checkpoint' | 'queue' | 'restart';
    /** 代替インスタンス起動 */
    readonly launchReplacement: boolean;
}
/**
 * Embedding Spotコスト最適化設定
 */
export interface EmbeddingSpotCostOptimizationConfig {
    /** 価格履歴分析 */
    readonly priceHistoryAnalysis: boolean;
    /** 動的価格調整 */
    readonly dynamicPriceAdjustment: boolean;
    /** コスト上限（USD/月） */
    readonly monthlyCostLimit?: number;
    /** アラート設定 */
    readonly costAlerts: EmbeddingSpotCostAlertConfig[];
}
/**
 * Embedding Spotコストアラート設定
 */
export interface EmbeddingSpotCostAlertConfig {
    /** アラート閾値（USD） */
    readonly threshold: number;
    /** 期間（daily/weekly/monthly） */
    readonly period: 'daily' | 'weekly' | 'monthly';
    /** 通知先 */
    readonly notificationTargets: string[];
}
/**
 * Embedding Spot Fleet自動スケーリング
 */
export interface EmbeddingSpotFleetAutoScaling {
    /** 自動スケーリング有効化 */
    readonly enabled: boolean;
    /** 最小容量 */
    readonly minCapacity: number;
    /** 最大容量 */
    readonly maxCapacity: number;
    /** スケーリングポリシー */
    readonly scalingPolicy: EmbeddingSpotFleetScalingPolicy;
}
/**
 * Embedding Spot Fleetスケーリングポリシー
 */
export interface EmbeddingSpotFleetScalingPolicy {
    /** メトリクス名（定義済みメトリクスのみ） */
    readonly metricName: EmbeddingScalingMetricType;
    /** 目標値 */
    readonly targetValue: number;
    /** スケールアウトクールダウン（秒） */
    readonly scaleOutCooldown: number;
    /** スケールインクールダウン（秒） */
    readonly scaleInCooldown: number;
    /** スケーリング動作設定 */
    readonly scalingBehavior: EmbeddingScalingBehaviorConfig;
    /** 予測スケーリング */
    readonly predictiveScaling?: EmbeddingPredictiveScalingConfig;
}
/**
 * Embedding スケーリングメトリクスタイプ
 */
export type EmbeddingScalingMetricType = 'CPUUtilization' | 'MemoryUtilization' | 'NetworkIn' | 'NetworkOut' | 'QueueLength' | 'ProcessingLatency' | 'EmbeddingThroughput' | 'CustomMetric';
/**
 * Embedding スケーリング動作設定
 */
export interface EmbeddingScalingBehaviorConfig {
    /** スケールアウト動作 */
    readonly scaleOut: EmbeddingScalingActionConfig;
    /** スケールイン動作 */
    readonly scaleIn: EmbeddingScalingActionConfig;
}
/**
 * Embedding スケーリングアクション設定
 */
export interface EmbeddingScalingActionConfig {
    /** スケーリング調整タイプ */
    readonly adjustmentType: 'ChangeInCapacity' | 'ExactCapacity' | 'PercentChangeInCapacity';
    /** 調整値 */
    readonly adjustmentValue: number;
    /** 最小調整ステップ */
    readonly minAdjustmentStep?: number;
    /** 最大調整ステップ */
    readonly maxAdjustmentStep?: number;
}
/**
 * Embedding 予測スケーリング設定
 */
export interface EmbeddingPredictiveScalingConfig {
    /** 予測スケーリング有効化 */
    readonly enabled: boolean;
    /** 予測期間（分） */
    readonly forecastPeriodMinutes: number;
    /** スケジュールベース予測 */
    readonly scheduleBasedForecasting: boolean;
    /** 機械学習ベース予測 */
    readonly mlBasedForecasting: boolean;
}
/**
 * Embedding共通リソース設定
 *
 * VPC、セキュリティグループ、FSx等の共通リソース管理
 * Requirements: 4.5
 */
export interface EmbeddingCommonResourcesConfig {
    /** VPC設定 */
    readonly vpc: EmbeddingVpcConfig;
    /** セキュリティグループ設定 */
    readonly securityGroups: EmbeddingSecurityGroupConfig;
    /** FSx for NetApp ONTAP設定 */
    readonly fsxNetApp: EmbeddingFsxNetAppConfig;
    /** OpenSearch Serverless設定 */
    readonly openSearchServerless: EmbeddingOpenSearchConfig;
    /** ECR設定 */
    readonly ecr: EmbeddingEcrConfig;
}
/**
 * Embedding VPC設定
 */
export interface EmbeddingVpcConfig {
    /** 既存VPC ID（指定時は既存VPCを使用） */
    readonly existingVpcId?: string;
    /** 新規VPC作成時のCIDR */
    readonly cidr?: string;
    /** サブネット設定 */
    readonly subnets: EmbeddingSubnetConfig;
    /** Multi-AZ配置 */
    readonly multiAz: boolean;
}
/**
 * Embedding サブネット設定
 */
export interface EmbeddingSubnetConfig {
    /** プライベートサブネットID */
    readonly privateSubnetIds: string[];
    /** パブリックサブネットID（必要時） */
    readonly publicSubnetIds?: string[];
}
/**
 * Embedding セキュリティグループ設定
 */
export interface EmbeddingSecurityGroupConfig {
    /** 既存セキュリティグループID */
    readonly existingSecurityGroupIds?: string[];
    /** 新規作成時の設定 */
    readonly newSecurityGroup?: EmbeddingNewSecurityGroupConfig;
}
/**
 * Embedding 新規セキュリティグループ設定
 */
export interface EmbeddingNewSecurityGroupConfig {
    /** セキュリティグループ名プレフィックス */
    readonly namePrefix: string;
    /** インバウンドルール */
    readonly inboundRules: EmbeddingSecurityGroupRule[];
    /** アウトバウンドルール */
    readonly outboundRules: EmbeddingSecurityGroupRule[];
}
/**
 * Embedding セキュリティグループルール
 */
export interface EmbeddingSecurityGroupRule {
    /** プロトコル（tcp/udp/icmp/-1） */
    readonly protocol: 'tcp' | 'udp' | 'icmp' | '-1';
    /** 開始ポート */
    readonly fromPort: number;
    /** 終了ポート */
    readonly toPort: number;
    /** ソース/デスティネーション（CIDR/セキュリティグループID） */
    readonly source: string;
    /** ルールタイプ */
    readonly type: 'ingress' | 'egress';
    /** 説明 */
    readonly description: string;
    /** 一時的ルールフラグ（セキュリティ監査用） */
    readonly temporary?: boolean;
    /** 有効期限（一時的ルールの場合） */
    readonly expirationDate?: string;
}
/**
 * Embedding FSx for NetApp ONTAP設定（統合版）
 */
export interface EmbeddingFsxNetAppConfig {
    /** 既存FSxファイルシステムID */
    readonly existingFileSystemId?: string;
    /** 新規作成時の設定 */
    readonly newFileSystem?: EmbeddingFsxNewFileSystemConfig;
    /** マウントターゲット設定 */
    readonly mountTargets: EmbeddingFsxMountTargetConfig[];
    /** パフォーマンス設定 */
    readonly performance: EmbeddingFsxPerformanceConfig;
    /** SMB/CIFS設定 */
    readonly smbCifs: EmbeddingFsxSmbCifsConfig;
}
/**
 * Embedding FSx新規ファイルシステム設定
 */
export interface EmbeddingFsxNewFileSystemConfig {
    /** ストレージ容量（GB） */
    readonly storageCapacity: number;
    /** スループット容量（MBps） */
    readonly throughputCapacity: number;
    /** 暗号化設定 */
    readonly encryption: EmbeddingFsxEncryptionConfig;
    /** バックアップ設定 */
    readonly backup: EmbeddingFsxBackupConfig;
}
/**
 * Embedding FSxマウントターゲット設定
 */
export interface EmbeddingFsxMountTargetConfig {
    /** サブネットID */
    readonly subnetId: string;
    /** セキュリティグループID */
    readonly securityGroupIds: string[];
    /** IPアドレス（オプション） */
    readonly ipAddress?: string;
}
/**
 * Embedding FSxパフォーマンス設定
 */
export interface EmbeddingFsxPerformanceConfig {
    /** IOPS設定 */
    readonly iops?: number;
    /** スループット最適化 */
    readonly throughputOptimization: boolean;
    /** キャッシュ設定 */
    readonly cache: EmbeddingFsxCacheConfig;
}
/**
 * Embedding FSx暗号化設定
 */
export interface EmbeddingFsxEncryptionConfig {
    /** 暗号化有効化 */
    readonly enabled: boolean;
    /** KMSキーID */
    readonly kmsKeyId?: string;
}
/**
 * Embedding FSxバックアップ設定
 */
export interface EmbeddingFsxBackupConfig {
    /** 自動バックアップ有効化 */
    readonly enabled: boolean;
    /** バックアップ保持期間（日） */
    readonly retentionDays: number;
    /** バックアップウィンドウ */
    readonly backupWindow?: string;
}
/**
 * Embedding FSxキャッシュ設定
 */
export interface EmbeddingFsxCacheConfig {
    /** キャッシュ有効化 */
    readonly enabled: boolean;
    /** キャッシュサイズ（GB） */
    readonly sizeGb?: number;
    /** キャッシュタイプ */
    readonly type: 'read' | 'write' | 'readwrite';
}
/**
 * Embedding OpenSearch Serverless設定
 */
export interface EmbeddingOpenSearchConfig {
    /** コレクション名 */
    readonly collectionName: string;
    /** インデックス設定 */
    readonly indices: EmbeddingOpenSearchIndexConfig[];
    /** セキュリティ設定 */
    readonly security: EmbeddingOpenSearchSecurityConfig;
    /** 容量設定 */
    readonly capacity: EmbeddingOpenSearchCapacityConfig;
}
/**
 * Embedding OpenSearchインデックス設定
 */
export interface EmbeddingOpenSearchIndexConfig {
    /** インデックス名 */
    readonly name: string;
    /** ベクトル次元数 */
    readonly vectorDimension: number;
    /** 距離関数 */
    readonly distanceFunction: 'cosine' | 'euclidean' | 'dot_product';
    /** マッピング設定 */
    readonly mapping: Record<string, any>;
}
/**
 * Embedding OpenSearchセキュリティ設定
 */
export interface EmbeddingOpenSearchSecurityConfig {
    /** 暗号化設定 */
    readonly encryption: EmbeddingOpenSearchEncryptionConfig;
    /** アクセス制御 */
    readonly accessControl: EmbeddingOpenSearchAccessControlConfig;
}
/**
 * Embedding OpenSearch暗号化設定
 */
export interface EmbeddingOpenSearchEncryptionConfig {
    /** 保存時暗号化 */
    readonly encryptionAtRest: boolean;
    /** 転送時暗号化 */
    readonly encryptionInTransit: boolean;
    /** KMSキーID */
    readonly kmsKeyId?: string;
}
/**
 * Embedding OpenSearchアクセス制御設定
 */
export interface EmbeddingOpenSearchAccessControlConfig {
    /** IAMロールベースアクセス */
    readonly iamRoleBasedAccess: boolean;
    /** 許可されたIAMロールARN */
    readonly allowedRoleArns: string[];
    /** VPCエンドポイント設定 */
    readonly vpcEndpoint?: EmbeddingOpenSearchVpcEndpointConfig;
}
/**
 * Embedding OpenSearch VPCエンドポイント設定
 */
export interface EmbeddingOpenSearchVpcEndpointConfig {
    /** VPC ID */
    readonly vpcId: string;
    /** サブネットID */
    readonly subnetIds: string[];
    /** セキュリティグループID */
    readonly securityGroupIds: string[];
}
/**
 * Embedding OpenSearch容量設定
 */
export interface EmbeddingOpenSearchCapacityConfig {
    /** 最大容量単位 */
    readonly maxCapacityUnits: number;
    /** 最小容量単位 */
    readonly minCapacityUnits: number;
    /** 自動スケーリング有効化 */
    readonly autoScaling: boolean;
}
/**
 * Embedding ECR設定
 */
export interface EmbeddingEcrConfig {
    /** リポジトリ名 */
    readonly repositoryName: string;
    /** イメージタグ変更可能性 */
    readonly imageTagMutability: 'MUTABLE' | 'IMMUTABLE';
    /** イメージスキャン設定 */
    readonly imageScanningConfiguration: EmbeddingEcrScanConfig;
    /** ライフサイクルポリシー */
    readonly lifecyclePolicy?: EmbeddingEcrLifecyclePolicyConfig;
}
/**
 * Embedding ECRスキャン設定
 */
export interface EmbeddingEcrScanConfig {
    /** プッシュ時スキャン */
    readonly scanOnPush: boolean;
    /** 脆弱性スキャン */
    readonly vulnerabilityScanning: boolean;
}
/**
 * Embedding ECRライフサイクルポリシー設定
 */
export interface EmbeddingEcrLifecyclePolicyConfig {
    /** 最大イメージ数 */
    readonly maxImageCount: number;
    /** 保持期間（日） */
    readonly retentionDays: number;
    /** タグ付きイメージの保持 */
    readonly keepTaggedImages: boolean;
}
/**
 * Embedding FSx NetApp新規作成設定（EmbeddingFsxNewFileSystemConfigに統合）
 */
export interface EmbeddingFsxNetAppNewConfig extends EmbeddingFsxNewFileSystemConfig {
    /** Multi-AZ配置 */
    readonly multiAz: boolean;
}
/**
 * Embedding FSx SMB/CIFS設定
 */
export interface EmbeddingFsxSmbCifsConfig {
    /** 共有名 */
    readonly shareName: string;
    /** マウントポイント */
    readonly mountPoint: string;
    /** 読み取り専用アクセス */
    readonly readOnlyAccess: boolean;
    /** 認証設定 */
    readonly authentication?: EmbeddingFsxAuthConfig;
}
/**
 * Embedding FSx認証設定
 */
export interface EmbeddingFsxAuthConfig {
    /** Active Directory統合 */
    readonly activeDirectory?: boolean;
    /** ユーザー名 */
    readonly username?: string;
    /** パスワードSecrets Manager ARN */
    readonly passwordSecretArn?: string;
}
/**
 * Embedding OpenSearch Serverless設定
 */
export interface EmbeddingOpenSearchConfig {
    /** 既存コレクション名 */
    readonly existingCollectionName?: string;
    /** 新規作成時の設定 */
    readonly newCollection?: EmbeddingOpenSearchNewConfig;
    /** インデックス設定 */
    readonly indexConfig: EmbeddingOpenSearchIndexConfig;
}
/**
 * Embedding OpenSearch新規作成設定
 */
export interface EmbeddingOpenSearchNewConfig {
    /** コレクション名プレフィックス */
    readonly namePrefix: string;
    /** コレクションタイプ */
    readonly type: 'SEARCH' | 'TIMESERIES';
}
/**
 * Embedding OpenSearchインデックス設定
 */
export interface EmbeddingOpenSearchIndexConfig {
    /** インデックス名 */
    readonly indexName: string;
    /** ベクトル次元数 */
    readonly vectorDimensions: number;
    /** 類似度メトリクス */
    readonly similarityMetric: 'cosine' | 'euclidean' | 'dot_product';
}
/**
 * Embedding ECR設定
 */
export interface EmbeddingEcrConfig {
    /** 既存ECRリポジトリURI */
    readonly existingRepositoryUri?: string;
    /** 新規作成時の設定 */
    readonly newRepository?: EmbeddingEcrNewConfig;
    /** イメージタグ */
    readonly imageTag: string;
}
/**
 * Embedding ECR新規作成設定
 */
export interface EmbeddingEcrNewConfig {
    /** リポジトリ名プレフィックス */
    readonly namePrefix: string;
    /** イメージスキャン有効化 */
    readonly imageScanOnPush: boolean;
    /** ライフサイクルポリシー */
    readonly lifecyclePolicy?: EmbeddingEcrLifecyclePolicy;
}
/**
 * Embedding ECRライフサイクルポリシー
 */
export interface EmbeddingEcrLifecyclePolicy {
    /** 最大イメージ数 */
    readonly maxImageCount: number;
    /** 最大保持日数 */
    readonly maxImageAge: number;
}
/**
 * Embedding監視・ログ設定
 *
 * Requirements: 7.4, 7.5
 */
export interface EmbeddingMonitoringConfig {
    /** CloudWatch監視 */
    readonly cloudWatch: EmbeddingCloudWatchConfig;
    /** X-Rayトレーシング */
    readonly xray: EmbeddingXRayConfig;
    /** ログ設定 */
    readonly logging: EmbeddingLoggingConfig;
    /** アラート設定 */
    readonly alerts: EmbeddingAlertConfig;
}
/**
 * Embedding CloudWatch設定
 */
export interface EmbeddingCloudWatchConfig {
    /** メトリクス有効化 */
    readonly metricsEnabled: boolean;
    /** カスタムメトリクス */
    readonly customMetrics?: EmbeddingCustomMetric[];
    /** ダッシュボード作成 */
    readonly createDashboard: boolean;
}
/**
 * Embedding カスタムメトリクス
 */
export interface EmbeddingCustomMetric {
    /** メトリクス名 */
    readonly metricName: string;
    /** 名前空間 */
    readonly namespace: string;
    /** 単位 */
    readonly unit: string;
}
/**
 * Embedding X-Ray設定
 */
export interface EmbeddingXRayConfig {
    /** トレーシング有効化 */
    readonly tracingEnabled: boolean;
    /** サンプリングレート */
    readonly samplingRate?: number;
}
/**
 * Embedding ログ設定
 */
export interface EmbeddingLoggingConfig {
    /** ログレベル */
    readonly logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    /** ログ保持期間（日） */
    readonly retentionDays: number;
    /** 構造化ログ有効化 */
    readonly structuredLogging: boolean;
}
/**
 * Embedding アラート設定
 */
export interface EmbeddingAlertConfig {
    /** アラート有効化 */
    readonly enabled: boolean;
    /** SNSトピックARN */
    readonly snsTopicArn?: string;
    /** アラートルール */
    readonly rules: EmbeddingAlertRule[];
}
/**
 * Embedding アラートルール
 */
export interface EmbeddingAlertRule {
    /** ルール名 */
    readonly ruleName: string;
    /** メトリクス名 */
    readonly metricName: string;
    /** 閾値 */
    readonly threshold: number;
    /** 比較演算子 */
    readonly comparisonOperator: 'GreaterThanThreshold' | 'LessThanThreshold' | 'GreaterThanOrEqualToThreshold' | 'LessThanOrEqualToThreshold';
    /** 評価期間 */
    readonly evaluationPeriods: number;
    /** データポイント */
    readonly datapointsToAlarm: number;
}
/**

 * Embedding設定バリデーション結果
 */
export interface EmbeddingConfigValidationResult {
    /** バリデーション成功フラグ */
    readonly isValid: boolean;
    /** エラーメッセージ */
    readonly errors: EmbeddingConfigValidationError[];
    /** 警告メッセージ */
    readonly warnings: EmbeddingConfigValidationWarning[];
    /** 推奨設定 */
    readonly recommendations: EmbeddingConfigRecommendation[];
}
/**
 * Embedding設定バリデーションエラー
 */
export interface EmbeddingConfigValidationError {
    /** エラーコード */
    readonly code: string;
    /** エラーメッセージ */
    readonly message: string;
    /** 対象フィールドパス */
    readonly fieldPath: string;
    /** 重要度 */
    readonly severity: 'critical' | 'high' | 'medium' | 'low';
}
/**
 * Embedding設定バリデーション警告
 */
export interface EmbeddingConfigValidationWarning {
    /** 警告コード */
    readonly code: string;
    /** 警告メッセージ */
    readonly message: string;
    /** 対象フィールドパス */
    readonly fieldPath: string;
    /** 推奨アクション */
    readonly recommendedAction?: string;
}
/**
 * Embedding設定推奨事項
 */
export interface EmbeddingConfigRecommendation {
    /** 推奨事項タイプ */
    readonly type: 'performance' | 'cost' | 'security' | 'reliability';
    /** 推奨メッセージ */
    readonly message: string;
    /** 対象フィールドパス */
    readonly fieldPath: string;
    /** 推奨値 */
    readonly recommendedValue?: any;
    /** 期待される効果 */
    readonly expectedBenefit: string;
}
/**
 * Embedding設定バリデーター
 */
export interface EmbeddingConfigValidator {
    /** 設定全体のバリデーション */
    validateConfig(config: any): EmbeddingConfigValidationResult;
    /** Spot Fleet設定のバリデーション */
    validateSpotFleetConfig(config: EmbeddingSpotFleetConfig): EmbeddingConfigValidationResult;
    /** 共通リソース設定のバリデーション */
    validateCommonResourcesConfig(config: EmbeddingCommonResourcesConfig): EmbeddingConfigValidationResult;
    /** セキュリティ設定のバリデーション */
    validateSecurityConfig(config: EmbeddingSecurityGroupConfig): EmbeddingConfigValidationResult;
}
/**

 * Embedding Job Definition設定
 *
 * AWS Batch Job Definition用の設定
 */
export interface EmbeddingJobDefinitionConfig {
    /** Job Definition名 */
    readonly jobDefinitionName: string;
    /** CPU設定 */
    readonly cpu: number;
    /** メモリ設定（MiB） */
    readonly memoryMiB: number;
    /** タイムアウト（時間） */
    readonly timeoutHours: number;
    /** 再試行回数 */
    readonly retryAttempts: number;
    /** プラットフォーム機能 */
    readonly platformCapabilities: string[];
}
/**
 * Embedding FSx統合設定
 *
 * FSx for NetApp ONTAP統合用の設定
 */
export interface EmbeddingFsxIntegrationConfig {
    /** FSxファイルシステムID */
    readonly fileSystemId?: string;
    /** SVM参照 */
    readonly svmRef?: string;
    /** SVM ID */
    readonly svmId?: string;
    /** CIFSデータボリューム名 */
    readonly cifsdataVolName?: string;
    /** RAGDBボリュームパス */
    readonly ragdbVolPath?: string;
}
/**
 * Embedding Active Directory設定
 *
 * Active Directory統合用の設定
 */
export interface EmbeddingActiveDirectoryConfig {
    /** ドメイン名 */
    readonly domain: string;
    /** ユーザー名 */
    readonly username: string;
    /** パスワードSecrets Manager ARN */
    readonly passwordSecretArn: string;
}
/**
 * Embedding Bedrock設定
 *
 * Amazon Bedrock統合用の設定
 */
export interface EmbeddingBedrockConfig {
    /** リージョン */
    readonly region?: string;
    /** モデルID */
    readonly modelId: string;
}
/**
 * Embedding OpenSearch統合設定
 *
 * OpenSearch Serverless統合用の設定
 */
export interface EmbeddingOpenSearchIntegrationConfig {
    /** コレクション名 */
    readonly collectionName?: string;
    /** インデックス名 */
    readonly indexName?: string;
}
/**
 * Embedding RDS設定
 *
 * RDS統合用の設定（OpenSearchの代替）
 */
export interface EmbeddingRdsConfig {
    /** シークレット名 */
    readonly secretName: string;
    /** シークレットARN */
    readonly secretArn: string;
    /** クラスターARN */
    readonly clusterArn: string;
}
