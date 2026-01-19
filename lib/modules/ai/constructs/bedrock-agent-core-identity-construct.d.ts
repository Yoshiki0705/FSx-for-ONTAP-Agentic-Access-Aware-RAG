/**
 * AgentCore Identity Construct
 *
 * Active Directory SID自動取得とIdentity管理機能を提供
 *
 * Features:
 * - AD SID自動取得（Lambda + SSM Run Command）
 * - DynamoDB Identity Table（SIDキャッシュ）
 * - IAM権限管理
 * - VPC統合
 */
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
export interface BedrockAgentCoreIdentityConstructProps {
    /**
     * 機能の有効化フラグ
     */
    readonly enabled: boolean;
    /**
     * プロジェクト名
     */
    readonly projectName: string;
    /**
     * 環境名（prod/dev/staging）
     */
    readonly environment: string;
    /**
     * AD SID自動取得の有効化
     */
    readonly adSyncEnabled?: boolean;
    /**
     * Active Directory EC2インスタンスID
     */
    readonly adEc2InstanceId?: string;
    /**
     * Identity DynamoDBテーブル名
     */
    readonly identityTableName?: string;
    /**
     * SIDキャッシュTTL（秒）
     * @default 86400 (24時間)
     */
    readonly sidCacheTtl?: number;
    /**
     * SSMタイムアウト（秒）
     * @default 30
     */
    readonly ssmTimeout?: number;
    /**
     * VPC統合設定
     */
    readonly vpcConfig?: {
        readonly vpcId: string;
        readonly subnetIds: string[];
        readonly securityGroupIds: string[];
    };
}
export declare class BedrockAgentCoreIdentityConstruct extends Construct {
    /**
     * Identity DynamoDBテーブル
     */
    readonly identityTable: dynamodb.Table;
    /**
     * AD Sync Lambda関数
     */
    readonly adSyncFunction?: lambda.Function;
    /**
     * Lambda実行ロール
     */
    readonly lambdaRole: iam.Role;
    constructor(scope: Construct, id: string, props: BedrockAgentCoreIdentityConstructProps);
}
