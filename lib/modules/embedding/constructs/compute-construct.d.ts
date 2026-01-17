/**
 * コンピュートコンストラクト
 *
 * Lambda、AWS Batch、ECSの統合管理を提供
 * 既存の監視・分析実装と自動スケーリング機能を統合
 */
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import { Construct } from 'constructs';
import { ComputeConfig, ComputeOutputs } from '../interfaces/compute-config';
export interface ComputeConstructProps {
    config: ComputeConfig;
    projectName: string;
    environment: string;
    vpc?: ec2.IVpc;
    kmsKey?: kms.IKey;
    privateSubnetIds?: string[];
    documentsBucket?: s3.IBucket;
    embeddingsBucket?: s3.IBucket;
    sessionTable?: dynamodb.ITable;
    openSearchCollection?: any;
}
export declare class ComputeConstruct extends Construct {
    private props;
    readonly outputs: ComputeOutputs;
    readonly lambdaFunctions: {
        [key: string]: lambda.Function;
    };
    readonly lambdaRole: iam.Role;
    readonly autoScalingTargets: {
        [key: string]: applicationautoscaling.ScalableTarget;
    };
    readonly batchComputeEnvironment?: batch.CfnComputeEnvironment;
    readonly batchJobQueue?: batch.CfnJobQueue;
    readonly ecsCluster?: ecs.Cluster;
    readonly ecrRepositories: {
        [key: string]: ecr.Repository;
    };
    constructor(scope: Construct, id: string, props: ComputeConstructProps);
    /**
     * 設定検証（Chain of Responsibility パターン）
     */
    private validateConfigurationWithChain;
    /**
     * 設定検証（従来版 - 後方互換性のため保持）
     * @deprecated validateConfigurationWithChain() を使用してください
     */
    private validateConfiguration;
    /**
     * Lambda実行ロール作成
     */
    private createLambdaExecutionRole;
    /**
     * ECRリポジトリ作成
     */
    private createECRRepositories;
    /**
     * Lambda関数作成（Factory パターン）
     */
    private createLambdaFunctionsWithFactory;
    /**
     * Lambda関数作成（従来版 - 後方互換性のため保持）
     * @deprecated createLambdaFunctionsWithFactory() を使用してください
     */
    private createLambdaFunctions;
    /**
     * 基本RAG関数作成
     */
    private createBasicRAGFunctions;
    /**
     * 基本RAG関数作成（Factory パターン）
     */
    private createBasicRAGFunctionsWithFactory;
    /**
     * 監視・分析統合関数作成（Factory パターン）
     */
    private createMonitoringAnalyticsFunctionsWithFactory;
    /**
     * 監視・分析統合関数作成（従来版 - 後方互換性のため保持）
     * @deprecated createMonitoringAnalyticsFunctionsWithFactory() を使用してください
     */
    private createMonitoringAnalyticsFunctions;
    /**
     * メトリクス収集Lambda関数作成
     */
    private createMetricsCollectorFunction;
    /**
     * アラート処理Lambda関数作成
     */
    private createAlertProcessorFunction;
    /**
     * ML処理Lambda関数作成
     */
    private createMLProcessorFunction;
    /**
     * テナント管理Lambda関数作成
     */
    private createTenantManagerFunction;
    /**
     * Lambda関数作成ヘルパー
     */
    private createLambdaFunction;
    /**
     * AWS Batchリソース作成
     */
    private createBatchResources;
    /**
     * ECSリソース作成
     */
    private createECSResources;
    /**
     * 自動スケーリング設定
     */
    private setupAutoScaling;
    /**
     * Lambda Runtime変換
     */
    private getLambdaRuntime;
    /**
     * 出力値作成
     */
    private createOutputs;
    /**
     * タグ適用（IAM制限対応）
     */
    private applyTags;
}
