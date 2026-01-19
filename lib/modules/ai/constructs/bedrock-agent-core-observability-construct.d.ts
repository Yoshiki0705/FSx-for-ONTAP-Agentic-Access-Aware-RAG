/**
 * Amazon Bedrock AgentCore Observability Construct
 *
 * このConstructは、Bedrock Agentの監視・トレーシング・デバッグ機能を提供します。
 * X-Ray統合、CloudWatch統合、エラー追跡を統合します。
 *
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
 */
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as xray from 'aws-cdk-lib/aws-xray';
import { Construct } from 'constructs';
/**
 * X-Ray設定
 */
export interface XRayConfig {
    /**
     * X-Ray統合を有効化
     * @default true
     */
    readonly enabled: boolean;
    /**
     * サンプリングレート（0.0-1.0）
     * @default 0.1
     */
    readonly samplingRate?: number;
    /**
     * X-Ray Group名
     * @default `${projectName}-${environment}-agent-core`
     */
    readonly groupName?: string;
    /**
     * フィルター式
     * @default 'service("agent-core")'
     */
    readonly filterExpression?: string;
    /**
     * 詳細トレーシングを有効化
     * @default true
     */
    readonly detailedTracing?: boolean;
    /**
     * カスタムサンプリングルールを有効化
     * @default true
     */
    readonly customSamplingRule?: boolean;
    /**
     * サンプリングルール優先度
     * @default 1000
     */
    readonly samplingRulePriority?: number;
}
/**
 * CloudWatch設定
 */
export interface CloudWatchConfig {
    /**
     * CloudWatch統合を有効化
     * @default true
     */
    readonly enabled: boolean;
    /**
     * カスタムメトリクスの名前空間
     * @default 'AWS/Bedrock/AgentCore'
     */
    readonly namespace?: string;
    /**
     * ダッシュボード自動生成
     * @default true
     */
    readonly createDashboard?: boolean;
    /**
     * ダッシュボード名
     * @default `${projectName}-${environment}-agent-core-observability`
     */
    readonly dashboardName?: string;
    /**
     * カスタムメトリクス定義
     */
    readonly customMetrics?: {
        /**
         * エージェント実行レイテンシを追跡
         * @default true
         */
        readonly executionLatency?: boolean;
        /**
         * エラー率を追跡
         * @default true
         */
        readonly errorRate?: boolean;
        /**
         * スループットを追跡
         * @default true
         */
        readonly throughput?: boolean;
        /**
         * トークン使用量を追跡
         * @default true
         */
        readonly tokenUsage?: boolean;
        /**
         * コスト追跡
         * @default true
         */
        readonly costTracking?: boolean;
    };
    /**
     * メトリクスフィルター設定
     */
    readonly metricFilters?: {
        /**
         * エラーパターンフィルター
         * @default true
         */
        readonly errorPatterns?: boolean;
        /**
         * 警告パターンフィルター
         * @default true
         */
        readonly warningPatterns?: boolean;
        /**
         * パフォーマンス低下パターンフィルター
         * @default true
         */
        readonly performanceDegradation?: boolean;
    };
    /**
     * アラーム設定
     */
    readonly alarms?: {
        /**
         * エラー率アラーム閾値（%）
         * @default 5
         */
        readonly errorRateThreshold?: number;
        /**
         * レイテンシアラーム閾値（ミリ秒）
         * @default 3000
         */
        readonly latencyThreshold?: number;
        /**
         * スループット低下アラーム閾値
         * @default 10
         */
        readonly throughputThreshold?: number;
        /**
         * トークン使用量アラーム閾値
         * @default 100000
         */
        readonly tokenUsageThreshold?: number;
        /**
         * SNSトピックARN（アラート通知先）
         */
        readonly snsTopicArn?: string;
    };
}
/**
 * エラー追跡設定
 */
export interface ErrorTrackingConfig {
    /**
     * エラー追跡を有効化
     * @default true
     */
    readonly enabled: boolean;
    /**
     * ログ保持期間（日数）
     * @default 30
     */
    readonly logRetentionDays?: number;
    /**
     * エラーパターン分析を有効化
     * @default true
     */
    readonly patternAnalysis?: boolean;
    /**
     * 根本原因分析（RCA）を有効化
     * @default true
     */
    readonly rootCauseAnalysis?: boolean;
}
/**
 * BedrockAgentCoreObservabilityConstructのプロパティ
 */
export interface BedrockAgentCoreObservabilityConstructProps {
    /**
     * Observability機能を有効化するかどうか
     * @default false
     */
    readonly enabled: boolean;
    /**
     * プロジェクト名
     */
    readonly projectName: string;
    /**
     * 環境名（dev, staging, prod等）
     */
    readonly environment: string;
    /**
     * X-Ray設定
     */
    readonly xrayConfig?: XRayConfig;
    /**
     * CloudWatch設定
     */
    readonly cloudwatchConfig?: CloudWatchConfig;
    /**
     * エラー追跡設定
     */
    readonly errorTrackingConfig?: ErrorTrackingConfig;
    /**
     * KMS暗号化設定
     */
    readonly kmsConfig?: {
        /**
         * KMS暗号化を有効化
         * @default true
         */
        readonly enabled: boolean;
        /**
         * 既存のKMSキーARN（指定しない場合は新規作成）
         */
        readonly kmsKeyArn?: string;
    };
    /**
     * タグ
     */
    readonly tags?: {
        [key: string]: string;
    };
}
/**
 * Amazon Bedrock AgentCore Observability Construct
 *
 * Bedrock Agentの監視・トレーシング・デバッグ機能を提供するConstruct。
 * X-Ray統合、CloudWatch統合、エラー追跡を統合します。
 */
export declare class BedrockAgentCoreObservabilityConstruct extends Construct {
    /**
     * KMS暗号化キー
     */
    readonly kmsKey?: kms.IKey;
    /**
     * X-Ray Group
     */
    xrayGroup?: xray.CfnGroup;
    /**
     * X-Ray Sampling Rule
     */
    xraySamplingRule?: xray.CfnSamplingRule;
    /**
     * CloudWatchダッシュボード
     */
    dashboard?: cloudwatch.Dashboard;
    /**
     * ログロググループ
     */
    readonly logGroup: logs.LogGroup;
    /**
     * エラー率アラーム
     */
    errorRateAlarm?: cloudwatch.Alarm;
    /**
     * レイテンシアラーム
     */
    latencyAlarm?: cloudwatch.Alarm;
    /**
     * スループットアラーム
     */
    throughputAlarm?: cloudwatch.Alarm;
    /**
     * トークン使用量アラーム
     */
    tokenUsageAlarm?: cloudwatch.Alarm;
    /**
     * メトリクスフィルター（エラーパターン）
     */
    errorPatternFilter?: logs.MetricFilter;
    /**
     * メトリクスフィルター（警告パターン）
     */
    warningPatternFilter?: logs.MetricFilter;
    /**
     * メトリクスフィルター（パフォーマンス低下）
     */
    performanceDegradationFilter?: logs.MetricFilter;
    constructor(scope: Construct, id: string, props: BedrockAgentCoreObservabilityConstructProps);
    /**
     * X-Ray統合を作成
     */
    private createXRayIntegration;
    /**
     * X-Rayサンプリングルールを作成
     */
    private createXRaySamplingRule;
    /**
     * Lambda関数にX-Rayトレーシングを有効化
     *
     * @param lambdaFunction - トレーシングを有効化するLambda関数
     * @param detailedTracing - 詳細トレーシングを有効化（デフォルト: true）
     * @returns Lambda関数（チェーン可能）
     */
    enableXRayForLambda(lambdaFunction: lambda.Function, detailedTracing?: boolean): lambda.Function;
    /**
     * 複数のLambda関数にX-Rayトレーシングを一括有効化
     *
     * @param lambdaFunctions - トレーシングを有効化するLambda関数の配列
     * @param detailedTracing - 詳細トレーシングを有効化（デフォルト: true）
     */
    enableXRayForLambdas(lambdaFunctions: lambda.Function[], detailedTracing?: boolean): void;
    /**
     * カスタムセグメント追加用の環境変数を設定
     *
     * Lambda関数内でカスタムセグメントを追加するための設定を行います。
     *
     * @param lambdaFunction - 設定対象のLambda関数
     * @param segmentName - カスタムセグメント名
     */
    addCustomSegmentConfig(lambdaFunction: lambda.Function, segmentName: string): void;
    /**
     * CloudWatch統合を作成
     */
    private createCloudWatchIntegration;
    /**
     * メトリクスフィルターを作成
     */
    private createMetricFilters;
    /**
     * ダッシュボードウィジェットを追加
     */
    private addDashboardWidgets;
    /**
     * アラームを作成
     */
    private createAlarms;
    /**
     * ログ保持期間を取得
     */
    private getLogRetention;
    /**
     * Lambda関数にカスタムメトリクス送信の環境変数を設定
     *
     * @param lambdaFunction - 設定対象のLambda関数
     * @param namespace - CloudWatchメトリクスの名前空間
     */
    addMetricsConfig(lambdaFunction: lambda.Function, namespace?: string): void;
    /**
     * Lambda関数にログ集約の環境変数を設定
     *
     * @param lambdaFunction - 設定対象のLambda関数
     */
    addLoggingConfig(lambdaFunction: lambda.Function): void;
    /**
     * 複数のLambda関数に監視設定を一括適用
     *
     * @param lambdaFunctions - 設定対象のLambda関数の配列
     * @param options - 設定オプション
     */
    configureObservabilityForLambdas(lambdaFunctions: lambda.Function[], options?: {
        enableXRay?: boolean;
        enableMetrics?: boolean;
        enableLogging?: boolean;
        namespace?: string;
    }): void;
    /**
     * Lambda関数にエラー追跡設定を追加
     *
     * @param lambdaFunction - 設定対象のLambda関数
     */
    addErrorTrackingConfig(lambdaFunction: lambda.Function): void;
    /**
     * エラー通知用のSNSトピックを設定
     *
     * @param snsTopicArn - SNSトピックARN
     * @returns SNSトピック
     */
    configureErrorNotifications(snsTopicArn: string): sns.ITopic;
    /**
     * エラー追跡用のメトリクスフィルターを取得
     *
     * @returns エラー追跡用のメトリクスフィルターの配列
     */
    getErrorTrackingFilters(): logs.MetricFilter[];
}
