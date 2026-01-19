/**
 * コンピュートモジュール設定インターフェース
 *
 * 機能:
 * - Lambda・Batch・ECS設定の型定義
 * - 自動スケーリング・パフォーマンス設定
 * - 監視・ログ設定
 */
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecs from 'aws-cdk-lib/aws-ecs';
/**
 * Lambda設定
 */
export interface LambdaConfig {
    /** ランタイム */
    readonly runtime: lambda.Runtime;
    /** タイムアウト（秒） */
    readonly timeout: number;
    /** メモリサイズ（MB） */
    readonly memorySize: number;
    /** VPC設定 */
    readonly vpc?: LambdaVpcConfig;
    /** 環境変数 */
    readonly environment?: Record<string, string>;
    /** レイヤー */
    readonly layers?: LambdaLayerConfig[];
    /** 予約済み同時実行数 */
    readonly reservedConcurrency?: number;
    /** プロビジョンド同時実行数 */
    readonly provisionedConcurrency?: LambdaProvisionedConcurrencyConfig[];
    /** X-Ray設定 */
    readonly xray?: LambdaXRayConfig;
    /** デッドレターキュー */
    readonly deadLetterQueue?: LambdaDeadLetterQueueConfig;
    /** カスタム関数 */
    readonly customFunctions?: LambdaCustomFunction[];
}
/**
 * Lambda VPC設定
 */
export interface LambdaVpcConfig {
    /** VPC有効化 */
    readonly enabled: boolean;
    /** セキュリティグループID */
    readonly securityGroupIds?: string[];
    /** サブネットID */
    readonly subnetIds?: string[];
}
/**
 * Lambdaレイヤー設定
 */
export interface LambdaLayerConfig {
    /** レイヤー名 */
    readonly layerName: string;
    /** レイヤーARN */
    readonly layerArn?: string;
    /** コードパス */
    readonly codePath?: string;
    /** 互換ランタイム */
    readonly compatibleRuntimes: lambda.Runtime[];
    /** 説明 */
    readonly description?: string;
}
/**
 * Lambdaプロビジョンド同時実行設定
 */
export interface LambdaProvisionedConcurrencyConfig {
    /** 関数名 */
    readonly functionName: string;
    /** エイリアス */
    readonly alias: string;
    /** 同時実行数 */
    readonly concurrency: number;
    /** 自動スケーリング */
    readonly autoScaling?: LambdaAutoScalingConfig;
}
/**
 * Lambda自動スケーリング設定
 */
export interface LambdaAutoScalingConfig {
    /** 最小容量 */
    readonly minCapacity: number;
    /** 最大容量 */
    readonly maxCapacity: number;
    /** 目標使用率 */
    readonly targetUtilization: number;
}
/**
 * Lambda X-Ray設定
 */
export interface LambdaXRayConfig {
    /** X-Ray有効化 */
    readonly enabled: boolean;
    /** トレースモード */
    readonly tracingMode?: lambda.Tracing;
}
/**
 * Lambdaデッドレターキュー設定
 */
export interface LambdaDeadLetterQueueConfig {
    /** DLQ有効化 */
    readonly enabled: boolean;
    /** SQSキューARN */
    readonly queueArn?: string;
    /** 最大再試行回数 */
    readonly maxRetries?: number;
}
/**
 * Lambdaカスタム関数
 */
export interface LambdaCustomFunction {
    /** 関数名 */
    readonly functionName: string;
    /** 説明 */
    readonly description: string;
    /** コードパス */
    readonly codePath: string;
    /** ハンドラー */
    readonly handler: string;
    /** ランタイム */
    readonly runtime: lambda.Runtime;
    /** タイムアウト */
    readonly timeout?: number;
    /** メモリサイズ */
    readonly memorySize?: number;
    /** 環境変数 */
    readonly environment?: Record<string, string>;
    /** イベントソース */
    readonly eventSources?: LambdaEventSource[];
}
/**
 * Lambdaイベントソース
 */
export interface LambdaEventSource {
    /** ソースタイプ */
    readonly sourceType: 'S3' | 'DynamoDB' | 'SQS' | 'SNS' | 'API_GATEWAY' | 'CLOUDWATCH_EVENTS';
    /** ソースARN */
    readonly sourceArn: string;
    /** バッチサイズ */
    readonly batchSize?: number;
    /** 開始位置 */
    readonly startingPosition?: 'TRIM_HORIZON' | 'LATEST';
}
/**
 * Batch設定
 */
export interface BatchConfig {
    /** Batch有効化 */
    readonly enabled: boolean;
    /** コンピュート環境 */
    readonly computeEnvironments: BatchComputeEnvironment[];
    /** ジョブキュー */
    readonly jobQueues: BatchJobQueue[];
    /** ジョブ定義 */
    readonly jobDefinitions?: BatchJobDefinition[];
    /** スケジューリング */
    readonly scheduling?: BatchSchedulingConfig;
}
/**
 * Batchコンピュート環境
 */
export interface BatchComputeEnvironment {
    /** 環境名 */
    readonly environmentName: string;
    /** タイプ */
    readonly type: 'MANAGED' | 'UNMANAGED';
    /** 状態 */
    readonly state?: 'ENABLED' | 'DISABLED';
    /** サービスロール */
    readonly serviceRole?: string;
    /** コンピュートリソース */
    readonly computeResources?: BatchComputeResources;
}
/**
 * Batchコンピュートリソース
 */
export interface BatchComputeResources {
    /** タイプ */
    readonly type: 'EC2' | 'SPOT' | 'FARGATE' | 'FARGATE_SPOT';
    /** 最小vCPU */
    readonly minvCpus: number;
    /** 最大vCPU */
    readonly maxvCpus: number;
    /** 希望vCPU */
    readonly desiredvCpus?: number;
    /** インスタンスタイプ */
    readonly instanceTypes: string[];
    /** スポット価格 */
    readonly spotIamFleetRequestRole?: string;
    /** キーペア */
    readonly ec2KeyPair?: string;
    /** セキュリティグループID */
    readonly securityGroupIds?: string[];
    /** サブネットID */
    readonly subnets?: string[];
}
/**
 * Batchジョブキュー
 */
export interface BatchJobQueue {
    /** キュー名 */
    readonly queueName: string;
    /** 状態 */
    readonly state?: 'ENABLED' | 'DISABLED';
    /** 優先度 */
    readonly priority: number;
    /** コンピュート環境順序 */
    readonly computeEnvironmentOrder: BatchComputeEnvironmentOrder[];
}
/**
 * Batchコンピュート環境順序
 */
export interface BatchComputeEnvironmentOrder {
    /** 順序 */
    readonly order: number;
    /** コンピュート環境名 */
    readonly computeEnvironment: string;
}
/**
 * Batchジョブ定義
 */
export interface BatchJobDefinition {
    /** ジョブ定義名 */
    readonly jobDefinitionName: string;
    /** タイプ */
    readonly type: 'container' | 'multinode';
    /** コンテナプロパティ */
    readonly containerProperties?: BatchContainerProperties;
    /** タイムアウト */
    readonly timeout?: number;
    /** 再試行戦略 */
    readonly retryStrategy?: BatchRetryStrategy;
}
/**
 * Batchコンテナプロパティ
 */
export interface BatchContainerProperties {
    /** イメージ */
    readonly image: string;
    /** vCPU */
    readonly vcpus: number;
    /** メモリ（MB） */
    readonly memory: number;
    /** ジョブロールARN */
    readonly jobRoleArn?: string;
    /** 環境変数 */
    readonly environment?: Record<string, string>;
    /** マウントポイント */
    readonly mountPoints?: BatchMountPoint[];
    /** ボリューム */
    readonly volumes?: BatchVolume[];
}
/**
 * Batchマウントポイント
 */
export interface BatchMountPoint {
    /** ソースボリューム */
    readonly sourceVolume: string;
    /** コンテナパス */
    readonly containerPath: string;
    /** 読み取り専用 */
    readonly readOnly?: boolean;
}
/**
 * Batchボリューム
 */
export interface BatchVolume {
    /** 名前 */
    readonly name: string;
    /** ホストパス */
    readonly host?: BatchVolumeHost;
}
/**
 * Batchボリュームホスト
 */
export interface BatchVolumeHost {
    /** ソースパス */
    readonly sourcePath?: string;
}
/**
 * Batch再試行戦略
 */
export interface BatchRetryStrategy {
    /** 試行回数 */
    readonly attempts: number;
}
/**
 * Batchスケジューリング設定
 */
export interface BatchSchedulingConfig {
    /** CloudWatchイベント */
    readonly cloudWatchEvents?: BatchCloudWatchEvent[];
}
/**
 * BatchCloudWatchイベント
 */
export interface BatchCloudWatchEvent {
    /** ルール名 */
    readonly ruleName: string;
    /** スケジュール式 */
    readonly scheduleExpression: string;
    /** ジョブキュー */
    readonly jobQueue: string;
    /** ジョブ定義 */
    readonly jobDefinition: string;
}
/**
 * ECS設定
 */
export interface EcsConfig {
    /** ECS有効化 */
    readonly enabled: boolean;
    /** クラスター設定 */
    readonly cluster: EcsClusterConfig;
    /** サービス設定 */
    readonly services?: EcsServiceConfig[];
    /** タスク定義 */
    readonly taskDefinitions?: EcsTaskDefinitionConfig[];
    /** 自動スケーリング */
    readonly autoScaling?: EcsAutoScalingConfig;
}
/**
 * ECSクラスター設定
 */
export interface EcsClusterConfig {
    /** クラスター名 */
    readonly clusterName?: string;
    /** 容量プロバイダー */
    readonly capacityProviders?: string[];
    /** デフォルト容量プロバイダー戦略 */
    readonly defaultCapacityProviderStrategy?: EcsCapacityProviderStrategy[];
    /** コンテナインサイト */
    readonly containerInsights?: boolean;
}
/**
 * ECS容量プロバイダー戦略
 */
export interface EcsCapacityProviderStrategy {
    /** 容量プロバイダー */
    readonly capacityProvider: string;
    /** 重み */
    readonly weight?: number;
    /** ベース */
    readonly base?: number;
}
/**
 * ECSサービス設定
 */
export interface EcsServiceConfig {
    /** サービス名 */
    readonly serviceName: string;
    /** タスク定義 */
    readonly taskDefinition: string;
    /** 希望タスク数 */
    readonly desiredCount: number;
    /** 起動タイプ */
    readonly launchType?: ecs.LaunchType;
    /** プラットフォームバージョン */
    readonly platformVersion?: ecs.FargatePlatformVersion;
    /** ネットワーク設定 */
    readonly networkConfiguration?: EcsNetworkConfiguration;
    /** ロードバランサー */
    readonly loadBalancers?: EcsLoadBalancer[];
    /** サービス検出 */
    readonly serviceDiscovery?: EcsServiceDiscovery;
}
/**
 * ECSネットワーク設定
 */
export interface EcsNetworkConfiguration {
    /** サブネットID */
    readonly subnets: string[];
    /** セキュリティグループ */
    readonly securityGroups?: string[];
    /** パブリックIP割り当て */
    readonly assignPublicIp?: boolean;
}
/**
 * ECSロードバランサー
 */
export interface EcsLoadBalancer {
    /** ターゲットグループARN */
    readonly targetGroupArn: string;
    /** コンテナ名 */
    readonly containerName: string;
    /** コンテナポート */
    readonly containerPort: number;
}
/**
 * ECSサービス検出
 */
export interface EcsServiceDiscovery {
    /** 名前空間 */
    readonly namespace: string;
    /** サービス名 */
    readonly serviceName: string;
    /** DNS設定 */
    readonly dnsConfig?: EcsDnsConfig;
}
/**
 * ECS DNS設定
 */
export interface EcsDnsConfig {
    /** DNS TTL */
    readonly ttl?: number;
    /** DNS レコードタイプ */
    readonly recordType?: 'A' | 'AAAA' | 'CNAME' | 'SRV';
}
/**
 * ECSタスク定義設定
 */
export interface EcsTaskDefinitionConfig {
    /** タスク定義名 */
    readonly taskDefinitionName: string;
    /** ファミリー */
    readonly family: string;
    /** ネットワークモード */
    readonly networkMode?: ecs.NetworkMode;
    /** 互換性 */
    readonly compatibility: ecs.Compatibility;
    /** CPU */
    readonly cpu?: string;
    /** メモリ */
    readonly memory?: string;
    /** タスクロール */
    readonly taskRole?: string;
    /** 実行ロール */
    readonly executionRole?: string;
    /** コンテナ定義 */
    readonly containerDefinitions: EcsContainerDefinition[];
    /** ボリューム */
    readonly volumes?: EcsVolume[];
}
/**
 * ECSコンテナ定義
 */
export interface EcsContainerDefinition {
    /** コンテナ名 */
    readonly name: string;
    /** イメージ */
    readonly image: string;
    /** CPU */
    readonly cpu?: number;
    /** メモリ */
    readonly memory?: number;
    /** メモリ予約 */
    readonly memoryReservation?: number;
    /** 必須 */
    readonly essential?: boolean;
    /** 環境変数 */
    readonly environment?: Record<string, string>;
    /** ポートマッピング */
    readonly portMappings?: EcsPortMapping[];
    /** ログ設定 */
    readonly logging?: EcsLogConfiguration;
    /** ヘルスチェック */
    readonly healthCheck?: EcsHealthCheck;
}
/**
 * ECSポートマッピング
 */
export interface EcsPortMapping {
    /** コンテナポート */
    readonly containerPort: number;
    /** ホストポート */
    readonly hostPort?: number;
    /** プロトコル */
    readonly protocol?: ecs.Protocol;
}
/**
 * ECSログ設定
 */
export interface EcsLogConfiguration {
    /** ログドライバー */
    readonly logDriver: ecs.LogDriver;
    /** オプション */
    readonly options?: Record<string, string>;
}
/**
 * ECSヘルスチェック
 */
export interface EcsHealthCheck {
    /** コマンド */
    readonly command: string[];
    /** 間隔 */
    readonly interval?: number;
    /** タイムアウト */
    readonly timeout?: number;
    /** 再試行回数 */
    readonly retries?: number;
    /** 開始期間 */
    readonly startPeriod?: number;
}
/**
 * ECSボリューム
 */
export interface EcsVolume {
    /** 名前 */
    readonly name: string;
    /** ホスト */
    readonly host?: EcsVolumeHost;
}
/**
 * ECSボリュームホスト
 */
export interface EcsVolumeHost {
    /** ソースパス */
    readonly sourcePath?: string;
}
/**
 */
/** ファイルシステムID */
/**
 * ECS自動スケーリング設定
 */
export interface EcsAutoScalingConfig {
    /** 最小容量 */
    readonly minCapacity: number;
    /** 最大容量 */
    readonly maxCapacity: number;
    /** スケーリングポリシー */
    readonly scalingPolicies?: EcsScalingPolicy[];
}
/**
 * ECSスケーリングポリシー
 */
export interface EcsScalingPolicy {
    /** ポリシー名 */
    readonly policyName: string;
    /** メトリクス */
    readonly metric: string;
    /** 目標値 */
    readonly targetValue: number;
    /** スケールアウトクールダウン */
    readonly scaleOutCooldown?: number;
    /** スケールインクールダウン */
    readonly scaleInCooldown?: number;
}
/**
 * コンピュート統合設定
 */
export interface ComputeConfig {
    /** Lambda設定 */
    readonly lambda: LambdaConfig;
    /** Batch設定 */
    readonly batch: BatchConfig;
    /** ECS設定 */
    readonly ecs: EcsConfig;
    /** 監視設定 */
    readonly monitoring?: ComputeMonitoringConfig;
    /** コスト最適化 */
    readonly costOptimization?: ComputeCostOptimizationConfig;
}
/**
 * コンピュート監視設定
 */
export interface ComputeMonitoringConfig {
    /** CloudWatchメトリクス */
    readonly cloudWatchMetrics: boolean;
    /** X-Rayトレーシング */
    readonly xrayTracing?: boolean;
    /** アラート設定 */
    readonly alerts?: ComputeAlertConfig[];
}
/**
 * コンピュートアラート設定
 */
export interface ComputeAlertConfig {
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
 * コンピュートコスト最適化設定
 */
export interface ComputeCostOptimizationConfig {
    /** スポットインスタンス使用 */
    readonly useSpotInstances: boolean;
    /** 自動スケーリング */
    readonly autoScaling?: boolean;
    /** 使用量分析 */
    readonly usageAnalytics?: boolean;
}
