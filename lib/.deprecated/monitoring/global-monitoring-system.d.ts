import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import { GlobalRagConfig } from '../../types/global-config';
/**
 * グローバル監視設定インターフェース
 */
export interface GlobalMonitoringConfig {
    /** 監視対象リージョンリスト */
    monitoredRegions: string[];
    /** メトリクス収集間隔（分） */
    metricsCollectionIntervalMinutes: number;
    /** アラート閾値設定 */
    alertThresholds: AlertThresholds;
    /** ダッシュボード設定 */
    dashboardConfig: DashboardConfig;
    /** データ保持期間（日） */
    dataRetentionDays: number;
}
/**
 * アラート閾値設定
 */
export interface AlertThresholds {
    /** CPU使用率閾値（%） */
    cpuUtilizationThreshold: number;
    /** メモリ使用率閾値（%） */
    memoryUtilizationThreshold: number;
    /** エラー率閾値（%） */
    errorRateThreshold: number;
    /** レスポンス時間閾値（ms） */
    responseTimeThreshold: number;
    /** 可用性閾値（%） */
    availabilityThreshold: number;
}
/**
 * ダッシュボード設定
 */
export interface DashboardConfig {
    /** 自動更新間隔（分） */
    autoRefreshIntervalMinutes: number;
    /** 表示期間（時間） */
    displayPeriodHours: number;
    /** 地域別表示有効化 */
    enableRegionalView: boolean;
    /** コンプライアンス表示有効化 */
    enableComplianceView: boolean;
}
export declare enum MonitoringMetricType {
    PERFORMANCE = "PERFORMANCE",
    AVAILABILITY = "AVAILABILITY",
    SECURITY = "SECURITY",
    COMPLIANCE = "COMPLIANCE",
    COST = "COST"
}
/**
 * アラート重要度
 */
export declare enum AlertSeverity {
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR",
    CRITICAL = "CRITICAL"
}
/**
 * グローバル統合監視システム
 *
 * 機能:
 * - 14地域統合監視ダッシュボード
 * - リアルタイムメトリクス収集
 * - 地域別パフォーマンス監視
 * - 自動アラート・エスカレーション
 * - コンプライアンス監視統合
 * - セキュリティ監視統合
 */
export declare class GlobalMonitoringSystem extends Construct {
    readonly metricsTable: dynamodb.Table;
    readonly alertsTable: dynamodb.Table;
    readonly dashboardConfigTable: dynamodb.Table;
    readonly globalDashboard: cloudwatch.Dashboard;
    readonly metricsCollectorFunction: lambda.Function;
    readonly alertProcessorFunction: lambda.Function;
    readonly dashboardUpdaterFunction: lambda.Function;
    readonly complianceMonitorFunction: lambda.Function;
    readonly securityMonitorFunction: lambda.Function;
    readonly alertTopic: sns.Topic;
    readonly logGroup: logs.LogGroup;
    private readonly config;
    private readonly globalConfig;
    constructor(scope: Construct, id: string, props: {
        globalConfig: GlobalRagConfig;
        monitoringConfig: GlobalMonitoringConfig;
    });
    /**
     * メトリクステーブルの作成
     */
    private createMetricsTable;
    /**
     * アラートテーブルの作成
     */
    private createAlertsTable;
    /**
     * ダッシュボード設定テーブルの作成
     */
    private createDashboardConfigTable;
    /**
     * CloudWatch Logsグループの作成
     */
    private createLogGroup;
    /**
     * SNS通知トピックの作成
     */
    private createAlertTopic;
    private createMetricsCollectorFunction;
    private createAlertProcessorFunction;
    /**
     * ダッシュボード更新Lambda関数
     */
    private createDashboardUpdaterFunction; /**
  
     * コンプライアンス監視Lambda関数
     */
    private createComplianceMonitorFunction;
    /**
     * セキュリティ監視Lambda関数
     */
    private createSecurityMonitorFunction; /**
  
     * グローバルCloudWatchダッシュボードの作成
     */
    private createGlobalDashboard;
    /**
     * 定期実行スケジュールの作成
     */
    private createScheduledTasks;
    /**
     * 必要なIAM権限の付与
     */
    private grantPermissions;
}
