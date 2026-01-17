/**
 * AIコンストラクト - 強化版
 *
 * Amazon Bedrock、Embedding処理（4パターン選択式）、ベクトル検索の統合管理を提供
 *
 * 統合機能:
 * - Amazon Bedrock統合（テキスト生成・Embedding）
 * - 4パターン選択式Embedding処理（AWS Batch、EC2 Spot、ECS on EC2、EC2 On-Demand）
 * - ベクトル検索エンジン統合
 * - RAGパイプライン統合
 * - FSx for NetApp ONTAP統合
 */
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { AIConfig, AIOutputs, EmbeddingPattern } from '../interfaces/ai-config';
export interface AIConstructProps {
    config: AIConfig;
    projectName: string;
    environment: string;
    region: string;
    kmsKey?: kms.IKey;
    embeddingsBucket?: s3.IBucket;
    documentsBucket?: s3.IBucket;
    processedBucket?: s3.IBucket;
    metadataBucket?: s3.IBucket;
    lambdaRole?: iam.IRole;
    vpc?: ec2.IVpc;
    databaseStack?: any;
    storageStack?: any;
}
export declare class AIConstruct extends Construct {
    private props;
    readonly outputs: AIOutputs;
    readonly bedrockRole: iam.Role;
    readonly embeddingProcessor?: lambda.Function;
    readonly selectedEmbeddingPattern: EmbeddingPattern;
    readonly patternManagerFunction: lambda.Function;
    readonly monitoringDashboard: cloudwatch.Dashboard;
    batchComputeEnvironment?: batch.CfnComputeEnvironment;
    batchJobQueue?: batch.CfnJobQueue;
    batchJobDefinition?: batch.CfnJobDefinition;
    spotAutoScalingGroup?: autoscaling.AutoScalingGroup;
    spotLaunchTemplate?: ec2.LaunchTemplate;
    ecsCluster?: ecs.Cluster;
    ecsService?: ecs.FargateService;
    ecsTaskDefinition?: ecs.FargateTaskDefinition;
    onDemandInstance?: ec2.Instance;
    constructor(scope: Construct, id: string, props: AIConstructProps);
    /**
     * Bedrock実行ロール作成
     */
    private createBedrockExecutionRole;
    /**
     * Bedrockアクセス設定
     */
    private setupBedrockAccess;
    /**
     * Parameter Store設定作成
     */
    private createParameterStore;
    /**
     * パターン管理Lambda関数作成
     */
    private createPatternManagerFunction;
    /**
     * Embedding処理設定（4パターン選択式）
     */
    private setupEmbeddingProcessing;
    /**
     * AWS Batchリソース作成
     */
    private createAwsBatchResources;
    /**
     * EC2 Spotリソース作成
     */
    private createEc2SpotResources;
    /**
     * ECS on EC2リソース作成
     */
    private createEcsOnEc2Resources;
    /**
     * EC2 On-Demandリソース作成
     */
    private createEc2OnDemandResources;
    /**
     * Bedrock Embedding設定
     */
    private setupBedrockEmbedding;
    /**
     * ベクトル検索設定
     */
    private setupVectorSearch;
    /**
     * RAG設定
     */
    private setupRAGPipeline;
    /**
     * 統合監視ダッシュボード作成
     */
    private createMonitoringDashboard;
    /**
     * EventBridge統合作成
     */
    private createEventBridgeIntegration;
}
