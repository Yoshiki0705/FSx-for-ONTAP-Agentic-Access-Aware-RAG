/**
 * AWS Batch Construct
 *
 * Agent Steeringルール準拠:
 * - モジュラーアーキテクチャ強制（lib/modules/compute/constructs/）
 * - 単一障害点排除とメンテナンス負荷軽減を最重要視
 * - Multi-AZ 構成でのマネージド EC2 環境
 *
 * Requirements: 1.1, 1.2, 1.3, 5.1
 */
import * as cdk from 'aws-cdk-lib';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EmbeddingBatchConfig, EmbeddingJobDefinitionConfig, EmbeddingFsxIntegrationConfig, EmbeddingActiveDirectoryConfig, EmbeddingBedrockConfig, EmbeddingOpenSearchIntegrationConfig, EmbeddingRdsConfig } from '../interfaces/embedding-config';
import { EmbeddingModuleInterface, EmbeddingCommonResources } from '../interfaces/module-interfaces';
export interface BatchConstructProps {
    /** Batch設定 */
    readonly config: EmbeddingBatchConfig;
    /** Job Definition設定 */
    readonly jobDefinitionConfig: EmbeddingJobDefinitionConfig;
    /** FSx統合設定 */
    readonly fsxIntegrationConfig: EmbeddingFsxIntegrationConfig;
    /** Active Directory設定 */
    readonly activeDirectoryConfig: EmbeddingActiveDirectoryConfig;
    /** Bedrock設定 */
    readonly bedrockConfig: EmbeddingBedrockConfig;
    /** OpenSearch設定 */
    readonly openSearchConfig: EmbeddingOpenSearchIntegrationConfig;
    /** RDS設定（オプション） */
    readonly rdsConfig?: EmbeddingRdsConfig;
    /** ECRイメージパス */
    readonly imagePath: string;
    /** イメージタグ */
    readonly imageTag: string;
    /** プロジェクト名 */
    readonly projectName: string;
    /** 環境名 */
    readonly environment: string;
    /** 共通リソース */
    readonly commonResources: EmbeddingCommonResources;
    /** 統一命名規則ジェネレーター */
    readonly namingGenerator?: any;
}
/**
 * AWS Batch Construct
 *
 * 機能:
 * - Multi-AZ構成でのマネージドEC2環境
 * - 自動スケーリング設定（minvCpus: 0, maxvCpus: 1000）
 * - インスタンスタイプ設定（m5.large, m5.xlarge）
 * - FSx for NetApp ONTAP統合
 */
export declare class BatchConstruct extends Construct implements EmbeddingModuleInterface {
    /** モジュール名 */
    readonly moduleName = "AWS_BATCH";
    /** モジュール有効化状態 */
    readonly enabled: boolean;
    /** 共通リソース参照 */
    readonly commonResources: EmbeddingCommonResources;
    /** Batchコンピュート環境 */
    readonly computeEnvironment: batch.CfnComputeEnvironment;
    /** Batchジョブ定義 */
    readonly jobDefinition: batch.CfnJobDefinition;
    /** Batchジョブキュー */
    readonly jobQueue: batch.CfnJobQueue;
    /** 起動テンプレート */
    readonly launchTemplate: ec2.LaunchTemplate;
    /** サービスロール */
    readonly serviceRole: iam.Role;
    /** インスタンスロール */
    readonly instanceRole: iam.Role;
    /** ジョブロール */
    readonly jobRole: iam.Role;
    /** ロググループ */
    readonly logGroup: logs.LogGroup;
    constructor(scope: Construct, id: string, props: BatchConstructProps);
    /**
     * ロググループ作成
     */
    private createLogGroup;
    /**
     * Batchサービスロール作成
     */
    private createServiceRole;
    /**
     * Batchインスタンスロール作成
     */
    private createInstanceRole;
    /**
     * Batchジョブロール作成
     */
    private createJobRole;
    /**
     * 起動テンプレート作成
     */
    private createLaunchTemplate;
    /**
     * Batchコンピュート環境作成
     */
    private createComputeEnvironment;
    /**
     * Batchジョブ定義作成
     */
    private createJobDefinition;
    /**
     * Job環境変数作成
     */
    private createJobEnvironmentVariables;
    /**
     * Batchジョブキュー作成
     */
    private createJobQueue;
    /**
     * Job Queue自動スケーリング設定
     */
    private configureJobQueueAutoScaling;
    /**
     * Job Queue自動復旧機能設定
     */
    private configureJobQueueAutoRecovery;
    /**
     * 復旧状況ダッシュボード作成
     */
    private createRecoveryDashboard;
    /**
     * タグ設定
     */
    private applyTags;
    /**
     * モジュール固有リソース取得
     */
    get moduleResources(): {
        batch: {
            computeEnvironment: cdk.aws_batch.CfnComputeEnvironment;
            jobDefinition: cdk.aws_batch.CfnJobDefinition;
            jobQueue: cdk.aws_batch.CfnJobQueue;
            launchTemplate: cdk.aws_ec2.LaunchTemplate;
        };
    };
    /**
     * モジュール依存関係取得
     */
    get dependencies(): {
        requiredModules: string[];
        optionalModules: string[];
        requiredResources: {
            requiresVpc: boolean;
            requiresSecurityGroup: boolean;
            requiresIamRole: boolean;
            requiresStorage: boolean;
            requiresLogging: boolean;
        };
        providedResources: {
            providesCompute: boolean;
            providesStorage: boolean;
            providesNetwork: boolean;
            providesMonitoring: boolean;
        };
    };
    /**
     * ジョブ実行メソッド
     */
    submitJob(jobName: string, parameters?: Record<string, string>): string;
    /**
     * Job Queue状態管理
     */
    enableJobQueue(): void;
    disableJobQueue(): void;
    /**
     * Job Queue優先度変更
     */
    updateJobQueuePriority(newPriority: number): void;
    /**
     * Job Queue監視メトリクス取得
     */
    getJobQueueMetrics(): Record<string, any>;
    /**
     * Auto Scaling設定
     */
    configureAutoScaling(props: BatchConstructProps): void;
}
