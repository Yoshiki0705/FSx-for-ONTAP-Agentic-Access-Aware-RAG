/**
 * Amazon Bedrock AgentCore Runtime Construct
 *
 * このConstructは、Bedrock Agentのイベント駆動実行を提供します。
 * Lambda関数、EventBridge、自動スケーリング、KMS暗号化を統合します。
 *
 * @author Kiro AI
 * @date 2026-01-03
 * @version 1.0.0
 */
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
/**
 * BedrockAgentCoreRuntimeConstructのプロパティ
 */
export interface BedrockAgentCoreRuntimeConstructProps {
    /**
     * Runtime機能を有効化するかどうか
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
     * Lambda関数設定
     */
    readonly lambdaConfig?: {
        /**
         * Lambda関数のタイムアウト（秒）
         * @default 30
         */
        readonly timeout?: number;
        /**
         * Lambda関数のメモリサイズ（MB）
         * @default 2048
         */
        readonly memorySize?: number;
        /**
         * Lambda関数のランタイム
         * @default lambda.Runtime.NODEJS_22_X
         */
        readonly runtime?: lambda.Runtime;
        /**
         * 環境変数
         */
        readonly environment?: {
            [key: string]: string;
        };
        /**
         * VPC設定
         */
        readonly vpcConfig?: {
            readonly vpc: ec2.IVpc;
            readonly subnetSelection?: ec2.SubnetSelection;
            readonly securityGroups?: ec2.ISecurityGroup[];
        };
        /**
         * Reserved Concurrency設定
         * @default undefined（制限なし）
         */
        readonly reservedConcurrentExecutions?: number;
        /**
         * Provisioned Concurrency設定
         * @default undefined（無効）
         */
        readonly provisionedConcurrentExecutions?: number;
    };
    /**
     * EventBridge設定
     */
    readonly eventBridgeConfig?: {
        /**
         * EventBridge Ruleを有効化するかどうか
         * @default true
         */
        readonly enabled?: boolean;
        /**
         * イベントパターン
         */
        readonly eventPattern?: events.EventPattern;
        /**
         * スケジュール式（cron式またはrate式）
         */
        readonly schedule?: events.Schedule;
    };
    /**
     * KMS暗号化設定
     */
    readonly kmsConfig?: {
        /**
         * KMS暗号化を有効化するかどうか
         * @default true
         */
        readonly enabled?: boolean;
        /**
         * 既存のKMS Keyを使用する場合
         */
        readonly kmsKey?: kms.IKey;
    };
    /**
     * Bedrock Agent設定
     */
    readonly bedrockAgentConfig?: {
        /**
         * Bedrock Agent ID
         */
        readonly agentId?: string;
        /**
         * Bedrock Agent Alias ID
         */
        readonly agentAliasId?: string;
        /**
         * Bedrockリージョン
         * @default 'ap-northeast-1'
         */
        readonly region?: string;
    };
    /**
     * FSx for ONTAP + S3 Access Points設定（Memory機能用）
     */
    readonly fsxOntapConfig?: {
        /**
         * FSx for ONTAPファイルシステムID
         */
        readonly fileSystemId: string;
        /**
         * Memoryボリュームパス
         * @default '/memory-volume'
         */
        readonly volumePath?: string;
        /**
         * VPC
         */
        readonly vpc: ec2.IVpc;
        /**
         * プライベートサブネット
         */
        readonly privateSubnets: ec2.ISubnet[];
    };
}
/**
 * Amazon Bedrock AgentCore Runtime Construct
 *
 * このConstructは、以下の機能を提供します：
 * - Lambda関数によるイベント駆動実行
 * - EventBridgeによる非同期処理
 * - 自動スケーリング（Reserved/Provisioned Concurrency）
 * - KMS暗号化による環境変数保護
 * - DLQ（Dead Letter Queue）によるエラーハンドリング
 * - FSx for ONTAP + S3 Access Points統合（Memory機能）
 */
export declare class BedrockAgentCoreRuntimeConstruct extends Construct {
    /**
     * Lambda関数
     */
    readonly lambdaFunction?: lambda.Function;
    /**
     * EventBridge Rule
     */
    readonly eventRule?: events.Rule;
    /**
     * KMS Key
     */
    readonly kmsKey?: kms.IKey;
    /**
     * Dead Letter Queue
     */
    readonly deadLetterQueue?: sqs.Queue;
    /**
     * IAM Role（Lambda実行ロール）
     */
    readonly executionRole?: iam.Role;
    /**
     * FSx for ONTAP + S3 Access Point（Memory機能用）
     * Phase 1未実装: FSx ONTAP統合は将来実装予定
     */
    constructor(scope: Construct, id: string, props: BedrockAgentCoreRuntimeConstructProps);
    /**
     * 自動スケーリング設定
     */
    private configureAutoScaling;
    /**
     * FSx for ONTAP + S3 Access Point作成（Memory機能用）
     * Phase 1未実装: FSx ONTAP統合は将来実装予定
     */
    /**
     * KMS Key作成
     */
    private createKmsKey;
    /**
     * Dead Letter Queue作成
     */
    private createDeadLetterQueue;
    /**
     * IAM Role作成
     */
    private createExecutionRole;
    /**
     * Lambda関数作成
     */
    private createLambdaFunction;
    /**
     * EventBridge Rule作成
     */
    private createEventBridgeRule;
}
