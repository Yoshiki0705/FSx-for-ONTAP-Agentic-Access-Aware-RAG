import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import { GlobalRagConfig } from '../../types/global-config';
/**
 * 地域別デプロイメント設定
 */
export interface RegionalDeploymentConfig {
    /** 対象地域リスト */
    targetRegions: RegionConfig[];
    /** デプロイメント戦略 */
    deploymentStrategy: 'BLUE_GREEN' | 'ROLLING' | 'CANARY';
    /** ロールバック設定 */
    rollbackConfig: {
        enabled: boolean;
        healthCheckThreshold: number;
        rollbackTimeoutMinutes: number;
    };
    /** 地域間レプリケーション */
    crossRegionReplication: boolean;
    /** 災害復旧設定 */
    disasterRecovery: {
        enabled: boolean;
        rtoMinutes: number;
        rpoMinutes: number;
    };
}
/**
 * 地域設定
 */
export interface RegionConfig {
    /** AWS地域名 */
    region: string;
    /** 地域表示名 */
    displayName: string;
    /** 優先度 */
    priority: number;
    /** 法規制要件 */
    complianceRequirements: string[];
    /** データ居住性制約 */
    dataResidencyRestrictions: boolean;
    /** 可用性ゾーン数 */
    availabilityZones: number;
    /** 環境固有設定 */
    environmentConfig: {
        instanceTypes: string[];
        storageTypes: string[];
        networkConfig: {
            vpcCidr: string;
            publicSubnets: string[];
            privateSubnets: string[];
        };
    };
}
/**
 * デプロイメント状態
 */
export declare enum DeploymentStatus {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    ROLLING_BACK = "ROLLING_BACK",
    ROLLED_BACK = "ROLLED_BACK"
}
/**
 * 地域別デプロイメント管理システム
 *
 * 機能:
 * - 地域別デプロイメント戦略実行
 * - ブルーグリーン・カナリア・ローリングデプロイメント
 * - 自動ロールバック機能
 * - 地域間データレプリケーション
 * - 災害復旧自動化
 */
export declare class RegionalDeploymentManager extends Construct {
    readonly deploymentTable: dynamodb.Table;
    readonly deploymentArtifactsBucket: s3.Bucket;
    readonly deploymentOrchestratorFunction: lambda.Function;
    readonly healthCheckFunction: lambda.Function;
    readonly rollbackFunction: lambda.Function;
    readonly replicationManagerFunction: lambda.Function;
    readonly deploymentWorkflow: stepfunctions.StateMachine;
    readonly deploymentAlertTopic: sns.Topic;
    private readonly globalConfig;
    private readonly deploymentConfig;
    constructor(scope: Construct, id: string, props: {
        globalConfig: GlobalRagConfig;
        deploymentConfig: RegionalDeploymentConfig;
    });
    /**
     * デプロイメントテーブルの作成
     */
    private createDeploymentTable;
    /**
     * デプロイメント成果物S3バケットの作成
     */
    private createDeploymentArtifactsBucket;
    /**
     * デプロイメントアラートトピックの作成
     */
    private createDeploymentAlertTopic;
    /**
     * 基本Lambda関数の作成（簡略化版）
     */
    private createDeploymentOrchestratorFunction;
    private createHealthCheckFunction;
    private createRollbackFunction;
    private createReplicationManagerFunction;
    /**
     * Step Functions ワークフローの作成
     */
    private createDeploymentWorkflow;
    /**
     * ヘルスチェックスケジュールの作成
     */
    private createHealthCheckSchedule;
    /**
     * 必要なIAM権限の設定
     */
    private setupIamPermissions;
    /**
     * デプロイメント開始
     */
    startDeployment(deploymentConfig: {
        deploymentId?: string;
        targetRegions?: string[];
        strategy?: string;
    }): void;
}
