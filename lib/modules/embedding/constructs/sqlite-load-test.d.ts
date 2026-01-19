/**
 * SQLite負荷試験統合コンストラクト
 *
 * FSx for ONTAP上でのSQLite負荷試験とEmbedding処理の統合
 * - AWS Batch統合
 * - EventBridge定期実行
 * - CloudWatch監視
 * - IAM権限管理
 */
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
export interface SqliteLoadTestProps {
    readonly projectName: string;
    readonly environment: string;
    readonly vpc: ec2.IVpc;
    readonly privateSubnets: ec2.ISubnet[];
    readonly securityGroup: ec2.ISecurityGroup;
    readonly fsxFileSystemId: string;
    readonly fsxSvmId: string;
    readonly fsxVolumeId: string;
    readonly fsxMountPath: string;
    readonly fsxNfsEndpoint: string;
    readonly bedrockRegion: string;
    readonly bedrockModelId: string;
    readonly scheduleExpression: string;
    readonly enableScheduledExecution: boolean;
    readonly maxvCpus?: number;
    readonly instanceTypes?: string[];
}
export declare class SqliteLoadTest extends Construct {
    readonly computeEnvironment: batch.CfnComputeEnvironment;
    readonly jobQueue: batch.CfnJobQueue;
    readonly jobDefinition: batch.CfnJobDefinition;
    readonly logGroup: logs.LogGroup;
    readonly scheduledRule?: events.Rule;
    private readonly serviceRole;
    private readonly jobRole;
    private readonly eventRole;
    constructor(scope: Construct, id: string, props: SqliteLoadTestProps);
    /**
     * Batch Service Role作成
     */
    private createBatchServiceRole;
    /**
     * Job Execution Role作成
     */
    private createJobExecutionRole;
    /**
     * EventBridge Role作成
     */
    private createEventBridgeRole;
    /**
     * CloudWatch Log Group作成
     */
    private createLogGroup;
    /**
     * Batch Compute Environment作成
     */
    private createComputeEnvironment;
    /**
     * Batch Job Queue作成
     */
    private createJobQueue;
    /**
     * Batch Job Definition作成
     */
    private createJobDefinition;
    /**
     * EventBridge定期実行ルール作成
     */
    private createScheduledRule;
    /**
     * ジョブコマンド生成
     */
    private generateJobCommand;
    /**
     * タグ適用
     */
    private applyTags;
    /**
     * ジョブ投入
     */
    submitJob(jobName?: string): string;
    /**
     * 統合情報取得
     */
    getIntegrationInfo(): Record<string, any>;
}
