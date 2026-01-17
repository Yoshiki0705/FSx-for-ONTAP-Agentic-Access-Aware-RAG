/**
 * Amazon Bedrock AgentCore Identity Construct
 *
 * このConstructは、Bedrock Agentの認証・認可機能を提供します。
 * エージェントID管理、RBAC、ABACを統合します。
 *
 * @author Kiro AI
 * @date 2026-01-03
 * @version 1.0.0
 */
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
/**
 * ロール定義
 */
export declare enum AgentRole {
    ADMIN = "Admin",
    USER = "User",
    READ_ONLY = "ReadOnly"
}
/**
 * 属性定義（ABAC用）
 */
export interface AgentAttributes {
    /**
     * 部署
     */
    readonly department?: string;
    /**
     * プロジェクト
     */
    readonly project?: string;
    /**
     * 機密度レベル（public, internal, confidential, secret）
     */
    readonly sensitivity?: 'public' | 'internal' | 'confidential' | 'secret';
    /**
     * カスタム属性
     */
    readonly customAttributes?: {
        [key: string]: string;
    };
}
/**
 * BedrockAgentCoreIdentityConstructのプロパティ
 */
export interface BedrockAgentCoreIdentityConstructProps {
    /**
     * Identity機能を有効化するかどうか
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
     * DynamoDBテーブル設定
     */
    readonly dynamoDbConfig?: {
        /**
         * テーブル名
         * @default `${projectName}-${environment}-agent-identity`
         */
        readonly tableName?: string;
        /**
         * 読み取りキャパシティユニット
         * @default 5
         */
        readonly readCapacity?: number;
        /**
         * 書き込みキャパシティユニット
         * @default 5
         */
        readonly writeCapacity?: number;
        /**
         * Point-in-Time Recoveryを有効化
         * @default true
         */
        readonly pointInTimeRecovery?: boolean;
        /**
         * 削除保護を有効化
         * @default true（本番環境）
         */
        readonly deletionProtection?: boolean;
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
     * RBAC設定
     */
    readonly rbacConfig?: {
        /**
         * RBACを有効化するかどうか
         * @default true
         */
        readonly enabled?: boolean;
        /**
         * デフォルトロール
         * @default AgentRole.USER
         */
        readonly defaultRole?: AgentRole;
        /**
         * カスタムロール定義
         */
        readonly customRoles?: {
            [roleName: string]: {
                permissions: string[];
                description: string;
            };
        };
    };
    /**
     * ABAC設定
     */
    readonly abacConfig?: {
        /**
         * ABACを有効化するかどうか
         * @default true
         */
        readonly enabled?: boolean;
        /**
         * 必須属性
         */
        readonly requiredAttributes?: string[];
        /**
         * 属性検証ルール
         */
        readonly validationRules?: {
            [attributeName: string]: {
                type: 'string' | 'number' | 'boolean' | 'enum';
                required?: boolean;
                pattern?: string;
                enumValues?: string[];
            };
        };
    };
}
/**
 * Amazon Bedrock AgentCore Identity Construct
 *
 * このConstructは、以下の機能を提供します：
 * - エージェントID管理（DynamoDB）
 * - RBAC（Role-Based Access Control）
 * - ABAC（Attribute-Based Access Control）
 * - KMS暗号化によるデータ保護
 * - IAM統合
 */
export declare class BedrockAgentCoreIdentityConstruct extends Construct {
    /**
     * DynamoDBテーブル（エージェントID管理）
     */
    readonly identityTable?: dynamodb.Table;
    /**
     * KMS Key
     */
    readonly kmsKey?: kms.IKey;
    /**
     * IAM Role（Identity管理ロール）
     */
    readonly managementRole?: iam.Role;
    /**
     * ロール定義マップ
     */
    readonly roles: Map<string, iam.Role>;
    /**
     * Lambda関数（Identity管理API）
     */
    readonly lambdaFunction?: lambda.Function;
    constructor(scope: Construct, id: string, props: BedrockAgentCoreIdentityConstructProps);
    /**
     * KMS Key作成
     */
    private createKmsKey;
    /**
     * DynamoDBテーブル作成
     */
    private createIdentityTable;
    /**
     * IAM Role作成
     */
    private createManagementRole;
    /**
     * RBAC設定
     */
    private setupRbac;
    /**
     * 標準ロール作成
     */
    private createStandardRoles;
    /**
     * カスタムロール作成
     */
    private createCustomRoles;
    /**
     * エージェントID生成
     */
    generateAgentId(): string;
    /**
     * ロール取得
     */
    getRole(roleName: string): iam.Role | undefined;
    /**
     * DynamoDBテーブルへのアクセス権限付与
     */
    grantReadWrite(grantee: iam.IGrantable): iam.Grant;
    /**
     * DynamoDBテーブルへの読み取り権限付与
     */
    grantRead(grantee: iam.IGrantable): iam.Grant;
    /**
     * Lambda関数作成
     */
    private createLambdaFunction;
}
