/**
 * 監視モジュール設定インターフェース
 *
 * 機能:
 * - CloudWatch・X-Ray・SNS設定の型定義
 * - ログ管理・アラート・ダッシュボード設定
 * - パフォーマンス監視・トレーシング設定
 */
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
/**
 * CloudWatch設定
 */
export interface CloudWatchConfig {
    /** CloudWatch有効化 */
    readonly enabled: boolean;
    /** ログ保持期間（日） */
    readonly retentionDays: number;
    /** 詳細監視 */
    readonly detailedMonitoring: boolean;
    /** ダッシュボード設定 */
    readonly dashboards?: CloudWatchDashboardConfig[];
    /** アラーム設定 */
    readonly alarms?: CloudWatchAlarmConfig[];
    /** メトリクスフィルター */
    readonly metricFilters?: CloudWatchMetricFilterConfig[];
    /** カスタムメトリクス */
    readonly customMetrics?: CloudWatchCustomMetricConfig[];
    /** 複合アラーム */
    readonly compositeAlarms?: CloudWatchCompositeAlarmConfig[];
}
/**
 * CloudWatchダッシュボード設定
 */
export interface CloudWatchDashboardConfig {
    /** ダッシュボード名 */
    readonly dashboardName: string;
    /** ウィジェット設定 */
    readonly widgets: CloudWatchWidgetConfig[];
    /** 期間設定 */
    readonly period?: CloudWatchPeriodConfig;
}
/**
 * CloudWatchウィジェット設定
 */
export interface CloudWatchWidgetConfig {
    /** ウィジェットタイプ */
    readonly type: 'metric' | 'log' | 'text' | 'number';
    /** タイトル */
    readonly title: string;
    /** 位置 */
    readonly position: CloudWatchWidgetPosition;
    /** サイズ */
    readonly size: CloudWatchWidgetSize;
    /** メトリクス設定 */
    readonly metrics?: CloudWatchMetricConfig[];
    /** ログクエリ */
    readonly logQuery?: string;
    /** テキスト内容 */
    readonly textContent?: string;
}
/**
 * CloudWatchウィジェット位置
 */
export interface CloudWatchWidgetPosition {
    /** X座標 */
    readonly x: number;
    /** Y座標 */
    readonly y: number;
}
/**
 * CloudWatchウィジェットサイズ
 */
export interface CloudWatchWidgetSize {
    /** 幅 */
    readonly width: number;
    /** 高さ */
    readonly height: number;
}
/**
 * CloudWatchメトリクス設定
 */
export interface CloudWatchMetricConfig {
    /** 名前空間 */
    readonly namespace: string;
    /** メトリクス名 */
    readonly metricName: string;
    /** ディメンション */
    readonly dimensions?: Record<string, string>;
    /** 統計 */
    readonly statistic?: cloudwatch.Statistic;
    /** 期間 */
    readonly period?: number;
    /** ラベル */
    readonly label?: string;
}
/**
 * CloudWatch期間設定
 */
export interface CloudWatchPeriodConfig {
    /** 開始時間 */
    readonly start?: string;
    /** 終了時間 */
    readonly end?: string;
    /** 期間 */
    readonly period?: string;
} /**
 
* CloudWatchアラーム設定
 */
export interface CloudWatchAlarmConfig {
    /** アラーム名 */
    readonly alarmName: string;
    /** 説明 */
    readonly description?: string;
    /** メトリクス */
    readonly metric: CloudWatchMetricConfig;
    /** 閾値 */
    readonly threshold: number;
    /** 比較演算子 */
    readonly comparisonOperator: cloudwatch.ComparisonOperator;
    /** 評価期間 */
    readonly evaluationPeriods: number;
    /** データポイント */
    readonly datapointsToAlarm?: number;
    /** 欠損データ処理 */
    readonly treatMissingData?: cloudwatch.TreatMissingData;
    /** アクション */
    readonly actions?: CloudWatchAlarmAction[];
}
/**
 * CloudWatchアラームアクション
 */
export interface CloudWatchAlarmAction {
    /** アクションタイプ */
    readonly type: 'SNS' | 'AUTO_SCALING' | 'EC2' | 'LAMBDA';
    /** ターゲットARN */
    readonly targetArn: string;
    /** 状態 */
    readonly state: 'ALARM' | 'OK' | 'INSUFFICIENT_DATA';
}
/**
 * CloudWatchメトリクスフィルター設定
 */
export interface CloudWatchMetricFilterConfig {
    /** フィルター名 */
    readonly filterName: string;
    /** ロググループ名 */
    readonly logGroupName: string;
    /** フィルターパターン */
    readonly filterPattern: string;
    /** メトリクス変換 */
    readonly metricTransformation: CloudWatchMetricTransformation;
}
/**
 * CloudWatchメトリクス変換
 */
export interface CloudWatchMetricTransformation {
    /** メトリクス名 */
    readonly metricName: string;
    /** 名前空間 */
    readonly metricNamespace: string;
    /** メトリクス値 */
    readonly metricValue: string;
    /** デフォルト値 */
    readonly defaultValue?: number;
}
/**
 * CloudWatchカスタムメトリクス設定
 */
export interface CloudWatchCustomMetricConfig {
    /** メトリクス名 */
    readonly metricName: string;
    /** 名前空間 */
    readonly namespace: string;
    /** ディメンション */
    readonly dimensions?: Record<string, string>;
    /** 単位 */
    readonly unit?: cloudwatch.Unit;
    /** 値 */
    readonly value?: number;
}
/**
 * CloudWatch複合アラーム設定
 */
export interface CloudWatchCompositeAlarmConfig {
    /** アラーム名 */
    readonly alarmName: string;
    /** 説明 */
    readonly description?: string;
    /** アラームルール */
    readonly alarmRule: string;
    /** アクション */
    readonly actions?: CloudWatchAlarmAction[];
}
/**
 * X-Ray設定
 */
export interface XRayConfig {
    /** X-Ray有効化 */
    readonly enabled: boolean;
    /** サンプリングレート */
    readonly samplingRate: number;
    /** サンプリングルール */
    readonly samplingRules?: XRaySamplingRule[];
    /** 暗号化設定 */
    readonly encryption?: XRayEncryptionConfig;
    /** サービスマップ設定 */
    readonly serviceMap?: XRayServiceMapConfig;
    /** インサイト設定 */
    readonly insights?: XRayInsightsConfig;
}
/**
 * X-Rayサンプリングルール
 */
export interface XRaySamplingRule {
    /** ルール名 */
    readonly ruleName: string;
    /** 優先度 */
    readonly priority: number;
    /** 固定レート */
    readonly fixedRate: number;
    /** リザーバーサイズ */
    readonly reservoirSize: number;
    /** サービス名 */
    readonly serviceName?: string;
    /** HTTPメソッド */
    readonly httpMethod?: string;
    /** URLパス */
    readonly urlPath?: string;
    /** ホスト */
    readonly host?: string;
}
/**
 * X-Ray暗号化設定
 */
export interface XRayEncryptionConfig {
    /** 暗号化有効化 */
    readonly enabled: boolean;
    /** KMSキーARN */
    readonly kmsKeyArn?: string;
}
/**
 * X-Rayサービスマップ設定
 */
export interface XRayServiceMapConfig {
    /** サービスマップ有効化 */
    readonly enabled: boolean;
    /** 依存関係追跡 */
    readonly dependencyTracking?: boolean;
    /** パフォーマンス分析 */
    readonly performanceAnalysis?: boolean;
}
/**
 * X-Rayインサイト設定
 */
export interface XRayInsightsConfig {
    /** インサイト有効化 */
    readonly enabled: boolean;
    /** 通知設定 */
    readonly notifications?: XRayInsightNotificationConfig[];
}
/**
 * X-Rayインサイト通知設定
 */
export interface XRayInsightNotificationConfig {
    /** 通知タイプ */
    readonly type: 'ANOMALY' | 'PERFORMANCE' | 'ERROR';
    /** SNSトピックARN */
    readonly snsTopicArn: string;
    /** 閾値 */
    readonly threshold?: number;
} /**

 * SNS設定
 */
export interface SnsConfig {
    /** SNS有効化 */
    readonly enabled: boolean;
    /** 暗号化設定 */
    readonly encryption: SnsEncryptionConfig;
    /** トピック設定 */
    readonly topics: SnsTopicConfig[];
    /** サブスクリプション設定 */
    readonly subscriptions?: SnsSubscriptionConfig[];
    /** 配信ポリシー */
    readonly deliveryPolicy?: SnsDeliveryPolicyConfig;
    /** アクセスポリシー */
    readonly accessPolicy?: any;
}
/**
 * SNS暗号化設定
 */
export interface SnsEncryptionConfig {
    /** 暗号化有効化 */
    readonly enabled: boolean;
    /** KMS管理暗号化 */
    readonly kmsManaged: boolean;
    /** カスタムKMSキーARN */
    readonly customKmsKeyArn?: string;
}
/**
 * SNSトピック設定
 */
export interface SnsTopicConfig {
    /** トピック名 */
    readonly topicName: string;
    /** 表示名 */
    readonly displayName?: string;
    /** FIFO */
    readonly fifo?: boolean;
    /** 重複排除 */
    readonly contentBasedDeduplication?: boolean;
    /** KMSキーARN */
    readonly kmsKeyArn?: string;
}
/**
 * SNSサブスクリプション設定
 */
export interface SnsSubscriptionConfig {
    /** トピック名 */
    readonly topicName: string;
    /** プロトコル */
    readonly protocol: sns.SubscriptionProtocol;
    /** エンドポイント */
    readonly endpoint: string;
    /** フィルターポリシー */
    readonly filterPolicy?: Record<string, sns.SubscriptionFilter>;
    /** 配信遅延ポリシー */
    readonly deliveryDelayPolicy?: SnsDeliveryDelayPolicy;
}
/**
 * SNS配信遅延ポリシー
 */
export interface SnsDeliveryDelayPolicy {
    /** 線形遅延 */
    readonly linear?: number;
    /** 指数遅延 */
    readonly exponential?: SnsExponentialDelayPolicy;
    /** 幾何遅延 */
    readonly geometric?: number;
    /** 算術遅延 */
    readonly arithmetic?: SnsArithmeticDelayPolicy;
}
/**
 * SNS指数遅延ポリシー
 */
export interface SnsExponentialDelayPolicy {
    /** 基数 */
    readonly base: number;
    /** 最大遅延 */
    readonly maxDelay?: number;
}
/**
 * SNS算術遅延ポリシー
 */
export interface SnsArithmeticDelayPolicy {
    /** 初期遅延 */
    readonly initialDelay: number;
    /** 増分 */
    readonly increment: number;
    /** 最大遅延 */
    readonly maxDelay?: number;
}
/**
 * SNS配信ポリシー設定
 */
export interface SnsDeliveryPolicyConfig {
    /** HTTP設定 */
    readonly http?: SnsHttpDeliveryPolicy;
    /** SQS設定 */
    readonly sqs?: SnsSqsDeliveryPolicy;
    /** Lambda設定 */
    readonly lambda?: SnsLambdaDeliveryPolicy;
}
/**
 * SNS HTTP配信ポリシー
 */
export interface SnsHttpDeliveryPolicy {
    /** 再試行回数 */
    readonly numRetries?: number;
    /** 再試行間隔 */
    readonly retryDelayPolicy?: SnsDeliveryDelayPolicy;
    /** 無効化閾値 */
    readonly disableSubscriptionOnFailure?: boolean;
}
/**
 * SNS SQS配信ポリシー
 */
export interface SnsSqsDeliveryPolicy {
    /** 再試行回数 */
    readonly numRetries?: number;
    /** 再試行間隔 */
    readonly retryDelayPolicy?: SnsDeliveryDelayPolicy;
}
/**
 * SNS Lambda配信ポリシー
 */
export interface SnsLambdaDeliveryPolicy {
    /** 再試行回数 */
    readonly numRetries?: number;
    /** 再試行間隔 */
    readonly retryDelayPolicy?: SnsDeliveryDelayPolicy;
}
/**
 * ログ管理設定
 */
export interface LoggingConfig {
    /** ログ管理有効化 */
    readonly enabled: boolean;
    /** 中央集約ログ */
    readonly centralizedLogging: boolean;
    /** ログ保持期間（日） */
    readonly logRetention: number;
    /** ロググループ設定 */
    readonly logGroups?: LogGroupConfig[];
    /** ログストリーム設定 */
    readonly logStreams?: LogStreamConfig[];
    /** ログ配信設定 */
    readonly logDestinations?: LogDestinationConfig[];
    /** ログ分析設定 */
    readonly logAnalytics?: LogAnalyticsConfig;
}
/**
 * ロググループ設定
 */
export interface LogGroupConfig {
    /** ロググループ名 */
    readonly logGroupName: string;
    /** 保持期間 */
    readonly retentionInDays: logs.RetentionDays;
    /** KMSキーARN */
    readonly kmsKeyArn?: string;
    /** メトリクスフィルター */
    readonly metricFilters?: CloudWatchMetricFilterConfig[];
}
/**
 * ログストリーム設定
 */
export interface LogStreamConfig {
    /** ログストリーム名 */
    readonly logStreamName: string;
    /** ロググループ名 */
    readonly logGroupName: string;
}
/**
 * ログ配信設定
 */
export interface LogDestinationConfig {
    /** 配信先名 */
    readonly destinationName: string;
    /** 配信先ARN */
    readonly destinationArn: string;
    /** ロールARN */
    readonly roleArn: string;
    /** フィルターパターン */
    readonly filterPattern?: string;
}
/**
 * ログ分析設定
 */
export interface LogAnalyticsConfig {
    /** CloudWatch Insights有効化 */
    readonly insights: boolean;
    /** 保存クエリ */
    readonly savedQueries?: LogInsightsSavedQuery[];
    /** 自動分析 */
    readonly autoAnalysis?: boolean;
}
/**
 * CloudWatch Insights保存クエリ
 */
export interface LogInsightsSavedQuery {
    /** クエリ名 */
    readonly queryName: string;
    /** クエリ文字列 */
    readonly queryString: string;
    /** ロググループ */
    readonly logGroups: string[];
}
/**
 * 監視統合設定
 */
export interface MonitoringConfig {
    /** CloudWatch設定 */
    readonly cloudWatch: CloudWatchConfig;
    /** X-Ray設定 */
    readonly xray: XRayConfig;
    /** SNS設定 */
    readonly sns: SnsConfig;
    /** ログ管理設定 */
    readonly logging: LoggingConfig;
    /** パフォーマンス監視 */
    readonly performance?: PerformanceMonitoringConfig;
    /** セキュリティ監視 */
    readonly security?: SecurityMonitoringConfig;
    /** コスト監視 */
    readonly cost?: CostMonitoringConfig;
}
/**
 * パフォーマンス監視設定
 */
export interface PerformanceMonitoringConfig {
    /** APM有効化 */
    readonly apmEnabled: boolean;
    /** レスポンス時間監視 */
    readonly responseTimeMonitoring?: boolean;
    /** スループット監視 */
    readonly throughputMonitoring?: boolean;
    /** エラー率監視 */
    readonly errorRateMonitoring?: boolean;
    /** SLA監視 */
    readonly slaMonitoring?: SlaMonitoringConfig[];
}
/**
 * SLA監視設定
 */
export interface SlaMonitoringConfig {
    /** SLA名 */
    readonly slaName: string;
    /** 目標値 */
    readonly target: number;
    /** メトリクス */
    readonly metric: string;
    /** 期間 */
    readonly period: string;
}
/**
 * セキュリティ監視設定
 */
export interface SecurityMonitoringConfig {
    /** 異常検出 */
    readonly anomalyDetection: boolean;
    /** 脅威検出 */
    readonly threatDetection?: boolean;
    /** アクセス監視 */
    readonly accessMonitoring?: boolean;
    /** コンプライアンス監視 */
    readonly complianceMonitoring?: boolean;
}
/**
 * コスト監視設定
 */
export interface CostMonitoringConfig {
    /** 予算監視 */
    readonly budgetMonitoring: boolean;
    /** 予算設定 */
    readonly budgets?: CostBudgetConfig[];
    /** コスト異常検出 */
    readonly costAnomalyDetection?: boolean;
    /** 使用量監視 */
    readonly usageMonitoring?: boolean;
}
/**
 * コスト予算設定
 */
export interface CostBudgetConfig {
    /** 予算名 */
    readonly budgetName: string;
    /** 予算額 */
    readonly budgetAmount: number;
    /** 通貨 */
    readonly currency: string;
    /** 期間 */
    readonly timeUnit: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
    /** アラート設定 */
    readonly alerts?: CostBudgetAlert[];
}
/**
 * コスト予算アラート
 */
export interface CostBudgetAlert {
    /** 閾値（%） */
    readonly thresholdPercentage: number;
    /** 通知先 */
    readonly notificationTargets: string[];
    /** アラートタイプ */
    readonly alertType: 'ACTUAL' | 'FORECASTED';
}
