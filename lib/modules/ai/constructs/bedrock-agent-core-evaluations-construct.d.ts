/**
 * Amazon Bedrock AgentCore Evaluations Construct
 *
 * このConstructは、Bedrock Agentの品質評価・A/Bテスト・パフォーマンス測定機能を提供します。
 * 13の組み込み評価器、A/Bテスト、統計的有意性検定、自動最適化を統合します。
 *
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
 */
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
/**
 * 品質メトリクス設定
 */
export interface QualityMetricsConfig {
    /**
     * 品質メトリクスを有効化
     * @default true
     */
    readonly enabled: boolean;
    /**
     * 正確性（Accuracy）評価を有効化
     * @default true
     */
    readonly accuracy?: boolean;
    /**
     * 関連性（Relevance）評価を有効化
     * @default true
     */
    readonly relevance?: boolean;
    /**
     * 有用性（Helpfulness）評価を有効化
     * @default true
     */
    readonly helpfulness?: boolean;
    /**
     * 一貫性（Consistency）評価を有効化
     * @default true
     */
    readonly consistency?: boolean;
    /**
     * 完全性（Completeness）評価を有効化
     * @default true
     */
    readonly completeness?: boolean;
    /**
     * 簡潔性（Conciseness）評価を有効化
     * @default true
     */
    readonly conciseness?: boolean;
    /**
     * 明瞭性（Clarity）評価を有効化
     * @default true
     */
    readonly clarity?: boolean;
    /**
     * 文法（Grammar）評価を有効化
     * @default true
     */
    readonly grammar?: boolean;
    /**
     * トーン（Tone）評価を有効化
     * @default true
     */
    readonly tone?: boolean;
    /**
     * バイアス（Bias）評価を有効化
     * @default true
     */
    readonly bias?: boolean;
    /**
     * 有害性（Toxicity）評価を有効化
     * @default true
     */
    readonly toxicity?: boolean;
    /**
     * 事実性（Factuality）評価を有効化
     * @default true
     */
    readonly factuality?: boolean;
    /**
     * 引用品質（Citation Quality）評価を有効化
     * @default true
     */
    readonly citationQuality?: boolean;
    /**
     * 評価結果の保存先S3バケット
     */
    readonly resultsBucket?: s3.IBucket;
    /**
     * 評価結果の保存先S3プレフィックス
     * @default 'evaluations/quality-metrics/'
     */
    readonly resultsPrefix?: string;
}
/**
 * A/Bテスト設定
 */
export interface ABTestConfig {
    /**
     * A/Bテストを有効化
     * @default true
     */
    readonly enabled: boolean;
    /**
     * トラフィック分割比率（A:B）
     * @default [50, 50]
     */
    readonly trafficSplit?: [number, number];
    /**
     * 統計的有意性の閾値（p値）
     * @default 0.05
     */
    readonly significanceThreshold?: number;
    /**
     * 最小サンプルサイズ
     * @default 100
     */
    readonly minSampleSize?: number;
    /**
     * 自動最適化を有効化
     * @default true
     */
    readonly autoOptimization?: boolean;
    /**
     * 自動最適化の閾値（勝率）
     * @default 0.95
     */
    readonly autoOptimizationThreshold?: number;
    /**
     * テスト結果の保存先S3バケット
     */
    readonly resultsBucket?: s3.IBucket;
    /**
     * テスト結果の保存先S3プレフィックス
     * @default 'evaluations/ab-tests/'
     */
    readonly resultsPrefix?: string;
}
/**
 * パフォーマンス評価設定
 */
export interface PerformanceEvaluationConfig {
    /**
     * パフォーマンス評価を有効化
     * @default true
     */
    readonly enabled: boolean;
    /**
     * レイテンシ測定を有効化
     * @default true
     */
    readonly latencyMeasurement?: boolean;
    /**
     * スループット測定を有効化
     * @default true
     */
    readonly throughputMeasurement?: boolean;
    /**
     * コスト分析を有効化
     * @default true
     */
    readonly costAnalysis?: boolean;
    /**
     * 最適化提案を有効化
     * @default true
     */
    readonly optimizationSuggestions?: boolean;
    /**
     * レイテンシ閾値（ミリ秒）
     * @default 3000
     */
    readonly latencyThreshold?: number;
    /**
     * スループット閾値（リクエスト/分）
     * @default 100
     */
    readonly throughputThreshold?: number;
    /**
     * コスト閾値（USD/1000リクエスト）
     * @default 10
     */
    readonly costThreshold?: number;
}
/**
 * BedrockAgentCoreEvaluationsConstructのプロパティ
 */
export interface BedrockAgentCoreEvaluationsConstructProps {
    /**
     * Evaluations機能を有効化するかどうか
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
     * 品質メトリクス設定
     */
    readonly qualityMetricsConfig?: QualityMetricsConfig;
    /**
     * A/Bテスト設定
     */
    readonly abTestConfig?: ABTestConfig;
    /**
     * パフォーマンス評価設定
     */
    readonly performanceEvaluationConfig?: PerformanceEvaluationConfig;
    /**
     * 評価結果の保持期間（日数）
     * @default 90
     */
    readonly resultsRetentionDays?: number;
    /**
     * タグ
     */
    readonly tags?: {
        [key: string]: string;
    };
}
/**
 * Amazon Bedrock AgentCore Evaluations Construct
 *
 * Bedrock Agentの品質評価・A/Bテスト・パフォーマンス測定機能を提供するConstruct。
 *
 * 主な機能:
 * - 13の組み込み品質評価器
 * - A/Bテスト機能
 * - 統計的有意性検定
 * - 自動最適化
 * - パフォーマンス測定
 * - コスト分析
 * - 最適化提案
 *
 * 使用例:
 * ```typescript
 * const evaluations = new BedrockAgentCoreEvaluationsConstruct(this, 'Evaluations', {
 *   enabled: true,
 *   projectName: 'my-project',
 *   environment: 'production',
 *   qualityMetricsConfig: {
 *     enabled: true,
 *     accuracy: true,
 *     relevance: true,
 *   },
 *   abTestConfig: {
 *     enabled: true,
 *     trafficSplit: [50, 50],
 *   },
 *   performanceEvaluationConfig: {
 *     enabled: true,
 *     latencyMeasurement: true,
 *   },
 * });
 * ```
 */
export declare class BedrockAgentCoreEvaluationsConstruct extends Construct {
    /**
     * 評価結果保存用S3バケット
     */
    readonly resultsBucket: s3.Bucket;
    /**
     * 評価結果保存用DynamoDBテーブル
     */
    readonly resultsTable: dynamodb.Table;
    /**
     * CloudWatchダッシュボード
     */
    readonly dashboard?: cloudwatch.Dashboard;
    /**
     * ログループ
     */
    readonly logGroup: logs.LogGroup;
    constructor(scope: Construct, id: string, props: BedrockAgentCoreEvaluationsConstructProps);
    /**
     * CloudWatchダッシュボードを作成
     */
    private createDashboard;
    /**
     * 品質メトリクスウィジェットを作成
     */
    private createQualityMetricsWidget;
    /**
     * A/Bテストウィジェットを作成
     */
    private createABTestWidget;
    /**
     * パフォーマンスウィジェットを作成
     */
    private createPerformanceWidget;
    /**
     * Lambda関数に評価権限を付与
     */
    addEvaluationPermissions(lambdaFunction: lambda.IFunction): void;
    /**
     * 複数のLambda関数に評価権限を一括付与
     */
    addEvaluationPermissionsToLambdas(lambdaFunctions: lambda.IFunction[]): void;
}
