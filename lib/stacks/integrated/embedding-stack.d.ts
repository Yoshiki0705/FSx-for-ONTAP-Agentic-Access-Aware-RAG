/**
 * 統合Embeddingスタック
 *
 * モジュラーアーキテクチャに基づくEmbedding・AI統合管理
 * - Lambda 関数（Embedding処理）
 * - AI/ML サービス (Bedrock)
 * - バッチ処理（AWS Batch）
 * - コンテナサービス (ECS)
 * - 統一命名規則: Component="Embedding"
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BedrockAgentConstruct } from '../../modules/ai/constructs/bedrock-agent-construct';
import { EmbeddingBatchIntegration } from '../../modules/embedding/constructs/embedding-batch-integration';
import { SqliteLoadTest } from '../../modules/embedding/constructs/sqlite-load-test';
import { WindowsSqlite } from '../../modules/embedding/constructs/windows-sqlite';
import { AiConfig } from '../../modules/ai/interfaces/ai-config';
import { EmbeddingConfig } from '../../modules/ai/interfaces/embedding-config';
export interface EmbeddingStackConfig {
    readonly ai?: any;
}
export interface EmbeddingStackProps extends cdk.StackProps {
    readonly config: EmbeddingStackConfig;
    readonly projectName: string;
    readonly environment: string;
    readonly vpc?: any;
    readonly privateSubnetIds?: string[];
    readonly publicSubnetIds?: string[];
    readonly s3BucketNames?: {
        [key: string]: string;
    };
    aiConfig?: AiConfig;
    embeddingConfig?: EmbeddingConfig;
    vpcId?: string;
    securityGroupIds?: string[];
    kmsKeyArn?: string;
    s3BucketArns?: string[];
    dynamoDbTableArns?: string[];
    openSearchCollectionArn?: string;
    enableBatchIntegration?: boolean;
    enableBatchTesting?: boolean;
    imagePath?: string;
    imageTag?: string;
    enableSqliteLoadTest?: boolean;
    enableWindowsLoadTest?: boolean;
    fsxFileSystemId?: string;
    fsxSvmId?: string;
    fsxVolumeId?: string;
    fsxMountPath?: string;
    fsxNfsEndpoint?: string;
    fsxCifsEndpoint?: string;
    fsxCifsShareName?: string;
    keyPairName?: string;
    bedrockRegion?: string;
    bedrockModelId?: string;
    scheduleExpression?: string;
    maxvCpus?: number;
    instanceTypes?: string[];
    windowsInstanceType?: string;
    useBedrockAgent?: boolean;
    knowledgeBaseArn?: string;
    documentSearchLambdaArn?: string;
    agentInstructionPreset?: 'standard' | 'financial' | 'healthcare';
    foundationModel?: string;
    guardrailArn?: string;
}
export declare class EmbeddingStack extends cdk.Stack {
    readonly embeddingBatchIntegration?: EmbeddingBatchIntegration;
    readonly embeddingConfig?: EmbeddingConfig;
    readonly sqliteLoadTest?: SqliteLoadTest;
    readonly windowsSqlite?: WindowsSqlite;
    readonly lambdaFunctions: {
        [key: string]: cdk.aws_lambda.Function;
    };
    readonly ecsCluster?: cdk.aws_ecs.Cluster;
    readonly batchJobQueue?: cdk.aws_batch.JobQueue;
    readonly bedrockModels: {
        [key: string]: string;
    };
    readonly embeddingFunction?: cdk.aws_lambda.Function;
    readonly bedrockAgent?: BedrockAgentConstruct;
    readonly agentArn?: string;
    readonly agentAliasArn?: string;
    readonly guardrailArn?: string;
    constructor(scope: Construct, id: string, props: EmbeddingStackProps);
    /**
     * 共通リソース作成
     */
    private createCommonResources;
    /**
     * 共通サービスロール作成
     */
    private createCommonServiceRole;
    /**
     * 共通ロググループ作成（既存実装を保持）
     */
    private createCommonLogGroup;
    /**
     * CloudFormation出力の作成（統一命名規則適用）
     * 既存実装を保持 + Phase 4のBedrock Agent統合
     */
    private createOutputs;
    /**
     * スタックレベルのタグ設定（統一命名規則適用）
     */
    private applyStackTags;
    /**
     * 他のスタックで使用するためのEmbeddingリソース情報を取得
     */
    getEmbeddingInfo(): {
        lambdaFunctions: {
            [key: string]: cdk.aws_lambda.Function;
        };
        ecsCluster: cdk.aws_ecs.Cluster;
        batchJobQueue: cdk.aws_batch.JobQueue;
        bedrockModels: {
            [key: string]: string;
        };
        embeddingFunction: cdk.aws_lambda.Function;
    };
    /**
     * 特定のLambda関数を取得
     */
    getLambdaFunction(name: string): cdk.aws_lambda.Function | undefined;
    /**
     * 特定のBedrockモデルIDを取得
     */
    getBedrockModelId(name: string): string | undefined;
    /**
     * Lambda関数用のIAMポリシーステートメントを生成
     */
    getLambdaExecutionPolicyStatements(): cdk.aws_iam.PolicyStatement[];
    /**
     * ECS タスク用のIAMポリシーステートメントを生成
     */
    getEcsTaskPolicyStatements(): cdk.aws_iam.PolicyStatement[];
    /**
     * Batch統合情報を取得（既存実装を保持）
     */
    getBatchIntegrationInfo(): Record<string, any> | undefined;
    /**
     * Batchジョブを実行（既存実装を保持）
     */
    submitBatchJob(jobName: string, parameters: Record<string, string>): Promise<string | undefined>;
    /**
     * Batchジョブ状況を取得（既存実装を保持）
     */
    getBatchJobStatus(): Record<string, any> | undefined;
    /**
     * Batch統合テスト実行（Phase 1未実装）
     */
    /**
     * Embedding設定を取得（既存実装を保持）
     */
    getEmbeddingConfig(): EmbeddingConfig | undefined;
    /**
     * SQLite負荷試験ジョブを実行
     */
    submitSqliteLoadTestJob(jobName?: string): string | undefined;
    /**
     * SQLite負荷試験統合情報を取得
     */
    getSqliteLoadTestInfo(): Record<string, any> | undefined;
    /**
     * Windows SQLite負荷試験情報を取得
     */
    getWindowsSqliteInfo(): Record<string, any> | undefined;
    /**
     * Bedrock Agent作成（Phase 4統合）
     * 最小限実装のため、一時的にコメントアウト
     */
    /**
     * CDKコンテキスト設定例を取得
     */
    static getContextExample(environment: string): Record<string, any>;
}
