/**
 * Amazon Bedrock AgentCore Gateway Construct
 *
 * このConstructは、既存のAPI/Lambda関数/MCPサーバーをBedrock Agent互換ツールに自動変換します。
 *
 * 主要機能:
 * - REST API → Bedrock Agent Tool変換
 * - Lambda関数 → Bedrock Agent Tool変換
 * - MCPサーバー統合
 *
 * @author Kiro AI
 * @date 2026-01-03
 */
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as kms from 'aws-cdk-lib/aws-kms';
/**
 * REST API変換設定
 */
export interface RestApiConversionConfig {
    /**
     * OpenAPI仕様ファイルのパス（S3 URIまたはローカルパス）
     */
    readonly openApiSpecPath: string;
    /**
     * API Gateway統合設定
     */
    readonly apiGatewayIntegration?: {
        /**
         * API Gateway REST APIのID
         */
        readonly apiId: string;
        /**
         * API Gatewayのステージ名
         */
        readonly stageName: string;
        /**
         * 認証タイプ（IAM, COGNITO, API_KEY, NONE）
         */
        readonly authType?: 'IAM' | 'COGNITO' | 'API_KEY' | 'NONE';
    };
    /**
     * 変換オプション
     */
    readonly conversionOptions?: {
        /**
         * 自動的にBedrock Agent Tool定義を生成するか
         */
        readonly autoGenerateToolDefinitions?: boolean;
        /**
         * カスタムツール名プレフィックス
         */
        readonly toolNamePrefix?: string;
        /**
         * 除外するエンドポイントのパターン（正規表現）
         */
        readonly excludePatterns?: string[];
    };
}
/**
 * Lambda関数変換設定
 */
export interface LambdaFunctionConversionConfig {
    /**
     * 変換対象のLambda関数ARNリスト
     */
    readonly functionArns: string[];
    /**
     * Lambda関数のメタデータ取得方法
     */
    readonly metadataSource?: {
        /**
         * 関数のタグからメタデータを取得するか
         */
        readonly useTags?: boolean;
        /**
         * 関数の環境変数からメタデータを取得するか
         */
        readonly useEnvironmentVariables?: boolean;
        /**
         * カスタムメタデータプロバイダー（Lambda関数ARN）
         */
        readonly customMetadataProvider?: string;
    };
    /**
     * 変換オプション
     */
    readonly conversionOptions?: {
        /**
         * 自動的にBedrock Agent Tool定義を生成するか
         */
        readonly autoGenerateToolDefinitions?: boolean;
        /**
         * カスタムツール名プレフィックス
         */
        readonly toolNamePrefix?: string;
        /**
         * タイムアウト設定（秒）
         */
        readonly timeout?: number;
    };
}
/**
 * MCPサーバー統合設定
 */
export interface McpServerIntegrationConfig {
    /**
     * MCPサーバーのエンドポイントURL
     */
    readonly serverEndpoint: string;
    /**
     * MCPサーバーの認証設定
     */
    readonly authentication?: {
        /**
         * 認証タイプ（API_KEY, OAUTH2, NONE）
         */
        readonly type: 'API_KEY' | 'OAUTH2' | 'NONE';
        /**
         * APIキー（Secrets Manager ARN）
         */
        readonly apiKeySecretArn?: string;
        /**
         * OAuth2設定
         */
        readonly oauth2Config?: {
            /**
             * クライアントID
             */
            readonly clientId: string;
            /**
             * クライアントシークレット（Secrets Manager ARN）
             */
            readonly clientSecretArn: string;
            /**
             * トークンエンドポイント
             */
            readonly tokenEndpoint: string;
        };
    };
    /**
     * WebSocket統合設定
     */
    readonly webSocketConfig?: {
        /**
         * WebSocket接続タイムアウト（秒）
         */
        readonly connectionTimeout?: number;
        /**
         * 再接続設定
         */
        readonly reconnectConfig?: {
            /**
             * 最大再接続試行回数
             */
            readonly maxRetries?: number;
            /**
             * 再接続間隔（ミリ秒）
             */
            readonly retryInterval?: number;
        };
    };
    /**
     * 変換オプション
     */
    readonly conversionOptions?: {
        /**
         * 自動的にBedrock Agent Tool定義を生成するか
         */
        readonly autoGenerateToolDefinitions?: boolean;
        /**
         * カスタムツール名プレフィックス
         */
        readonly toolNamePrefix?: string;
        /**
         * 取得するツール定義のフィルター（正規表現）
         */
        readonly toolNameFilter?: string;
    };
}
/**
 * Bedrock AgentCore Gateway Construct プロパティ
 */
export interface BedrockAgentCoreGatewayConstructProps {
    /**
     * Gateway機能を有効化するか
     * @default true
     */
    readonly enabled?: boolean;
    /**
     * プロジェクト名
     */
    readonly projectName: string;
    /**
     * 環境名（dev, staging, prod等）
     */
    readonly environment: string;
    /**
     * REST API変換設定
     */
    readonly restApiConversion?: RestApiConversionConfig;
    /**
     * Lambda関数変換設定
     */
    readonly lambdaFunctionConversion?: LambdaFunctionConversionConfig;
    /**
     * MCPサーバー統合設定
     */
    readonly mcpServerIntegration?: McpServerIntegrationConfig;
    /**
     * KMS暗号化キー（オプション）
     * 指定しない場合は自動生成される
     */
    readonly encryptionKey?: kms.IKey;
    /**
     * ログ保持期間（日数）
     * @default 7
     */
    readonly logRetentionDays?: logs.RetentionDays;
    /**
     * タグ
     */
    readonly tags?: {
        [key: string]: string;
    };
}
/**
 * Bedrock AgentCore Gateway Construct
 *
 * 既存のAPI/Lambda関数/MCPサーバーをBedrock Agent互換ツールに自動変換します。
 */
export declare class BedrockAgentCoreGatewayConstruct extends Construct {
    /**
     * Gateway機能が有効かどうか
     */
    readonly enabled: boolean;
    /**
     * REST API変換Lambda関数
     */
    readonly restApiConverterFunction?: lambda.Function;
    /**
     * Lambda関数変換Lambda関数
     */
    readonly lambdaConverterFunction?: lambda.Function;
    /**
     * MCPサーバー統合Lambda関数
     */
    readonly mcpIntegrationFunction?: lambda.Function;
    /**
     * KMS暗号化キー
     */
    readonly encryptionKey: kms.IKey;
    /**
     * IAM実行ロール
     */
    readonly executionRole: iam.Role;
    /**
     * CloudWatch Logs ロググループ
     */
    readonly logGroup: logs.LogGroup;
    constructor(scope: Construct, id: string, props: BedrockAgentCoreGatewayConstructProps);
    /**
     * KMS暗号化キーを作成
     */
    private createEncryptionKey;
    /**
     * IAM実行ロールを作成
     */
    private createExecutionRole;
    /**
     * CloudWatch Logsロググループを作成
     */
    private createLogGroup;
    /**
     * REST API変換Lambda関数を作成
     */
    private createRestApiConverterFunction;
    /**
     * Lambda関数変換Lambda関数を作成
     */
    private createLambdaConverterFunction;
    /**
     * MCPサーバー統合Lambda関数を作成
     */
    private createMcpIntegrationFunction;
}
