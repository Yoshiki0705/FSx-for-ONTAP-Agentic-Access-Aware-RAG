import { Construct } from "constructs";
import * as batch from "aws-cdk-lib/aws-batch";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { EmbeddingConfig } from "../interfaces/embedding-config";
import { ECR } from "../../../constructs/repository";
/**
 * AWS Batch Job Definition構築用のプロパティ
 */
export interface BatchJobDefinitionProps {
    /** 埋め込み処理設定 */
    readonly embeddingConfig: EmbeddingConfig;
    /** 実行ロール */
    readonly executionRole: iam.IRole;
    /** タスクロール */
    readonly taskRole: iam.IRole;
    /** ECRイメージパス */
    readonly imagePath: string;
    /** イメージタグ */
    readonly imageTag: string;
    /** リージョン */
    readonly region: string;
    /** アカウントID */
    readonly accountId: string;
    /** プロジェクト名 */
    readonly projectName: string;
    /** 環境名 */
    readonly environment: string;
}
/**
 * AWS Batch Job Definition構築クラス
 *
 * 既存のEC2ベースembedding-serverからAWS Batchへの移行用Job Definition
 * FSx for NetApp ONTAP統合、Bedrock連携、OpenSearch Serverless対応
 *
 * Requirements: 1.2, 2.1, 2.3
 */
export declare class BatchJobDefinitionConstruct extends Construct {
    /** Job Definition */
    readonly jobDefinition: batch.EcsJobDefinition;
    /** ECRリポジトリ */
    readonly ecrRepository: ECR;
    /** CloudWatch Logs グループ */
    readonly logGroup: logs.LogGroup;
    constructor(scope: Construct, id: string, props: BatchJobDefinitionProps);
    /**
     * プロパティ検証
     */
    private validateProps;
    /**
     * CloudWatch Logs グループ作成
     */
    private createLogGroup;
    /**
     * コンテナ定義作成
     */
    private createContainerDefinition;
    /**
     * 環境変数設定作成
     */
    private createEnvironmentVariables;
    /**
     * FSx環境変数の安全な追加
     */
    private addFsxEnvironmentVariables;
    /**
     * Active Directory環境変数の安全な追加
     */
    private addActiveDirectoryEnvironmentVariables;
    /**
     * Bedrock環境変数の安全な追加
     */
    private addBedrockEnvironmentVariables;
    /**
     * OpenSearch環境変数の安全な追加
     */
    private addOpenSearchEnvironmentVariables;
    /**
     * RDS環境変数の安全な追加
     */
    private addRdsEnvironmentVariables;
    /**
     * マウントポイント設定作成
     */
    private createMountPoints;
    /**
     * ボリューム設定作成
     */
    private createVolumes;
    /**
     * タグ設定
     */
    private applyTags;
    /**
     * CDK Nag抑制設定追加
     */
    private addNagSuppressions;
    /**
     * Job Definition ARN取得
     */
    get jobDefinitionArn(): string;
    /**
     * Job Definition名取得
     */
    get jobDefinitionName(): string;
}
