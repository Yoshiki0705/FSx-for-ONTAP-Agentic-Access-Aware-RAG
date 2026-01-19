/**
 * Amazon Bedrock AgentCore Policy Construct
 *
 * このConstructは、Bedrock Agentのポリシー管理機能を提供します。
 * 自然言語ポリシー、Cedar統合、形式的検証、競合検出を統合します。
 *
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
 */
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
/**
 * 自然言語ポリシー設定
 */
export interface NaturalLanguagePolicyConfig {
    /**
     * 自然言語ポリシーを有効化
     * @default true
     */
    readonly enabled: boolean;
    /**
     * パーサーモデル
     * @default 'anthropic.claude-3-sonnet-20240229-v1:0'
     */
    readonly parserModel?: string;
    /**
     * 自動Cedar変換を有効化
     * @default true
     */
    readonly autoConversion?: boolean;
    /**
     * ポリシーテンプレートを使用
     * @default true
     */
    readonly useTemplates?: boolean;
}
/**
 * Cedar統合設定
 */
export interface CedarIntegrationConfig {
    /**
     * Cedar統合を有効化
     * @default true
     */
    readonly enabled: boolean;
    /**
     * 形式的検証を有効化
     * @default true
     */
    readonly formalVerification?: boolean;
    /**
     * 競合検出を有効化
     * @default true
     */
    readonly conflictDetection?: boolean;
    /**
     * ポリシー最適化を有効化
     * @default false
     */
    readonly policyOptimization?: boolean;
}
/**
 * ポリシー管理設定
 */
export interface PolicyManagementConfig {
    /**
     * ポリシー管理を有効化
     * @default true
     */
    readonly enabled: boolean;
    /**
     * バージョン管理を有効化
     * @default true
     */
    readonly versionControl?: boolean;
    /**
     * 監査ログを有効化
     * @default true
     */
    readonly auditLogging?: boolean;
    /**
     * ポリシー承認ワークフローを有効化
     * @default false
     */
    readonly approvalWorkflow?: boolean;
    /**
     * ポリシーレビュー期間（日数）
     * @default 90
     */
    readonly reviewPeriodDays?: number;
}
/**
 * BedrockAgentCorePolicyConstructのプロパティ
 */
export interface BedrockAgentCorePolicyConstructProps {
    /**
     * Policy機能を有効化するかどうか
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
     * 自然言語ポリシー設定
     */
    readonly naturalLanguagePolicyConfig?: NaturalLanguagePolicyConfig;
    /**
     * Cedar統合設定
     */
    readonly cedarIntegrationConfig?: CedarIntegrationConfig;
    /**
     * ポリシー管理設定
     */
    readonly policyManagementConfig?: PolicyManagementConfig;
    /**
     * ポリシーの保持期間（日数）
     * @default 365
     */
    readonly policyRetentionDays?: number;
    /**
     * タグ
     */
    readonly tags?: {
        [key: string]: string;
    };
}
/**
 * Amazon Bedrock AgentCore Policy Construct
 *
 * Bedrock Agentのポリシー管理機能を提供するConstruct。
 *
 * 主な機能:
 * - 自然言語ポリシー作成
 * - Cedar統合による形式的検証
 * - ポリシー競合検出
 * - ポリシー管理API
 * - 監査ログ
 *
 * 使用例:
 * ```typescript
 * const policy = new BedrockAgentCorePolicyConstruct(this, 'Policy', {
 *   enabled: true,
 *   projectName: 'my-project',
 *   environment: 'production',
 *   naturalLanguagePolicyConfig: {
 *     enabled: true,
 *     autoConversion: true,
 *   },
 *   cedarIntegrationConfig: {
 *     enabled: true,
 *     formalVerification: true,
 *     conflictDetection: true,
 *   },
 *   policyManagementConfig: {
 *     enabled: true,
 *     versionControl: true,
 *     auditLogging: true,
 *   },
 * });
 * ```
 */
export declare class BedrockAgentCorePolicyConstruct extends Construct {
    /**
     * ポリシー保存用S3バケット
     */
    readonly policyBucket: s3.Bucket;
    /**
     * ポリシーメタデータ保存用DynamoDBテーブル
     */
    readonly policyTable: dynamodb.Table;
    /**
     * 監査ログ保存用DynamoDBテーブル
     */
    readonly auditLogTable?: dynamodb.Table;
    /**
     * ログループ
     */
    readonly logGroup: logs.LogGroup;
    /**
     * ポリシー管理Lambda関数
     */
    readonly policyFunction?: lambda.Function;
    constructor(scope: Construct, id: string, props: BedrockAgentCorePolicyConstructProps);
    /**
     * Lambda関数にポリシーバケットへのアクセス権限を付与
     */
    grantPolicyBucketAccess(grantee: iam.IGrantable): iam.Grant;
    /**
     * Lambda関数にポリシーテーブルへのアクセス権限を付与
     */
    grantPolicyTableAccess(grantee: iam.IGrantable): iam.Grant;
    /**
     * Lambda関数に監査ログテーブルへのアクセス権限を付与
     */
    grantAuditLogTableAccess(grantee: iam.IGrantable): iam.Grant | undefined;
}
