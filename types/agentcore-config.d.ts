/**
 * AgentCore設定の型定義
 *
 * このファイルは、cdk.context.jsonのagentCore設定セクションの型定義を提供します。
 * 全てのAgentCore機能はオプションであり、有効化/無効化を個別に制御できます。
 *
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
 */
/**
 * Lambda関数設定
 */
export interface LambdaConfig {
    /**
     * Lambda関数のタイムアウト（秒）
     * @default 30
     * @min 1
     * @max 900
     */
    readonly timeout?: number;
    /**
     * Lambda関数のメモリサイズ（MB）
     * @default 2048
     * @min 128
     * @max 10240
     */
    readonly memorySize?: number;
    /**
     * Reserved Concurrency設定
     * @default undefined（制限なし）
     * @min 0
     */
    readonly reservedConcurrentExecutions?: number;
    /**
     * Provisioned Concurrency設定
     * @default undefined（無効）
     * @min 0
     */
    readonly provisionedConcurrentExecutions?: number;
    /**
     * 環境変数
     */
    readonly environment?: {
        [key: string]: string;
    };
}
/**
 * EventBridge設定
 */
export interface EventBridgeConfig {
    /**
     * EventBridge Ruleを有効化するかどうか
     * @default true
     */
    readonly enabled?: boolean;
    /**
     * スケジュール式（rate式またはcron式）
     * @example "rate(5 minutes)"
     * @example "cron(0 12 * * ? *)"
     */
    readonly scheduleExpression?: string;
}
/**
 * Runtime設定
 */
export interface RuntimeConfig {
    /**
     * Runtime機能を有効化するかどうか
     * @default false
     */
    readonly enabled?: boolean;
    /**
     * Lambda関数設定
     */
    readonly lambdaConfig?: LambdaConfig;
    /**
     * EventBridge設定
     */
    readonly eventBridgeConfig?: EventBridgeConfig;
}
/**
 * API Gateway統合設定
 */
export interface ApiGatewayIntegration {
    /**
     * API Gateway REST APIのID
     */
    readonly apiId?: string;
    /**
     * API Gatewayのステージ名
     */
    readonly stageName?: string;
    /**
     * 認証タイプ
     */
    readonly authType?: 'IAM' | 'COGNITO' | 'API_KEY' | 'NONE';
}
/**
 * REST API変換設定
 */
export interface RestApiConversionConfig {
    /**
     * OpenAPI仕様ファイルのパス（S3 URIまたはローカルパス）
     * @example "s3://my-bucket/openapi.yaml"
     * @example "./specs/openapi.yaml"
     */
    readonly openApiSpecPath?: string;
    /**
     * API Gateway統合設定
     */
    readonly apiGatewayIntegration?: ApiGatewayIntegration;
    /**
     * 変換オプション
     */
    readonly conversionOptions?: {
        /**
         * 自動的にBedrock Agent Tool定義を生成するか
         * @default true
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
 * Lambda関数メタデータソース設定
 */
export interface MetadataSource {
    /**
     * 関数のタグからメタデータを取得するか
     * @default true
     */
    readonly useTags?: boolean;
    /**
     * 関数の環境変数からメタデータを取得するか
     * @default true
     */
    readonly useEnvironmentVariables?: boolean;
    /**
     * カスタムメタデータプロバイダー（Lambda関数ARN）
     */
    readonly customMetadataProvider?: string;
}
/**
 * Lambda関数変換設定
 */
export interface LambdaFunctionConversionConfig {
    /**
     * 変換対象のLambda関数ARNリスト
     */
    readonly functionArns?: string[];
    /**
     * Lambda関数のメタデータ取得方法
     */
    readonly metadataSource?: MetadataSource;
}
/**
 * MCPサーバーエンドポイント設定
 */
export interface McpServerEndpoint {
    /**
     * サーバー名
     */
    readonly name: string;
    /**
     * エンドポイントURL
     */
    readonly endpoint: string;
    /**
     * 認証タイプ
     */
    readonly authType: 'API_KEY' | 'OAUTH2' | 'NONE';
    /**
     * API Key（authType='API_KEY'の場合）
     */
    readonly apiKey?: string;
    /**
     * OAuth2設定（authType='OAUTH2'の場合）
     */
    readonly oauth2Config?: {
        readonly clientId: string;
        readonly clientSecret: string;
        readonly tokenEndpoint: string;
    };
}
/**
 * MCPサーバー統合設定
 */
export interface McpServerIntegrationConfig {
    /**
     * MCPサーバーエンドポイントリスト
     */
    readonly serverEndpoints?: McpServerEndpoint[];
    /**
     * ツール名フィルター（正規表現）
     */
    readonly toolNameFilter?: string;
}
/**
 * Gateway設定
 */
export interface GatewayConfig {
    /**
     * Gateway機能を有効化するかどうか
     * @default false
     */
    readonly enabled?: boolean;
    /**
     * REST API変換設定
     */
    readonly restApiConversionConfig?: RestApiConversionConfig;
    /**
     * Lambda関数変換設定
     */
    readonly lambdaFunctionConversionConfig?: LambdaFunctionConversionConfig;
    /**
     * MCPサーバー統合設定
     */
    readonly mcpServerIntegrationConfig?: McpServerIntegrationConfig;
}
/**
 * Memory Strategy設定
 */
export interface MemoryStrategyConfig {
    /**
     * Semantic Memory（意味的長期記憶）の有効化
     * @default true
     */
    readonly enableSemantic?: boolean;
    /**
     * Summary Memory（要約記憶）の有効化
     * @default true
     */
    readonly enableSummary?: boolean;
    /**
     * User Preference Memory（ユーザー嗜好記憶）の有効化
     * @default true
     */
    readonly enableUserPreference?: boolean;
    /**
     * Semantic Memoryのnamespaces
     * @default ['default']
     */
    readonly semanticNamespaces?: string[];
    /**
     * Summary Memoryのnamespaces
     * @default ['default']
     */
    readonly summaryNamespaces?: string[];
    /**
     * User Preference Memoryのnamespaces
     * @default ['default']
     */
    readonly userPreferenceNamespaces?: string[];
}
/**
 * KMS暗号化設定
 */
export interface KmsConfig {
    /**
     * KMS Key ARN（既存のKMS Keyを使用する場合）
     */
    readonly keyArn?: string;
    /**
     * KMS Key Aliasプレフィックス
     */
    readonly keyAliasPrefix?: string;
}
/**
 * Memory設定
 */
export interface MemoryConfig {
    /**
     * Memory機能を有効化するかどうか
     * @default false
     */
    readonly enabled?: boolean;
    /**
     * Memory Strategy設定
     */
    readonly memoryStrategyConfig?: MemoryStrategyConfig;
    /**
     * KMS暗号化設定
     */
    readonly kmsConfig?: KmsConfig;
}
/**
 * DynamoDB設定
 */
export interface DynamoDbConfig {
    /**
     * テーブル名
     */
    readonly tableName?: string;
    /**
     * 読み取りキャパシティユニット
     * @default 5
     * @min 1
     */
    readonly readCapacity?: number;
    /**
     * 書き込みキャパシティユニット
     * @default 5
     * @min 1
     */
    readonly writeCapacity?: number;
    /**
     * Point-in-Time Recoveryを有効化
     * @default true
     */
    readonly pointInTimeRecovery?: boolean;
}
/**
 * カスタムロール定義
 */
export interface CustomRole {
    /**
     * ロール名
     */
    readonly name: string;
    /**
     * 権限リスト
     */
    readonly permissions: string[];
}
/**
 * RBAC設定
 */
export interface RbacConfig {
    /**
     * デフォルトロール
     * @default 'User'
     */
    readonly defaultRole?: 'Admin' | 'User' | 'ReadOnly';
    /**
     * カスタムロール定義
     */
    readonly customRoles?: CustomRole[];
}
/**
 * ABAC設定
 */
export interface AbacConfig {
    /**
     * 部署属性を有効化
     * @default false
     */
    readonly enableDepartmentAttribute?: boolean;
    /**
     * プロジェクト属性を有効化
     * @default false
     */
    readonly enableProjectAttribute?: boolean;
    /**
     * 機密度属性を有効化
     * @default false
     */
    readonly enableSensitivityAttribute?: boolean;
}
/**
 * Windows AD設定
 */
export interface WindowsAdConfig {
    /**
     * Active Directory Domain Name
     * @example "permission-aware-rag.local"
     */
    readonly domainName?: string;
    /**
     * AD EC2インスタンスタイプ
     * @default "t3.medium"
     */
    readonly adInstanceType?: string;
    /**
     * AD EC2のSSH Key Name（nullの場合はSSM Session Managerを使用）
     * @default null
     */
    readonly adKeyName?: string | null;
    /**
     * VPC設定
     */
    readonly vpcConfig?: {
        /**
         * VPCを有効化するかどうか
         * @default true
         */
        readonly enabled: boolean;
    };
}
/**
 * AD SID自動取得設定
 */
export interface AdSyncConfig {
    /**
     * AD SID自動取得機能を有効化するかどうか
     * @default false
     */
    readonly adSyncEnabled?: boolean;
    /**
     * AD EC2インスタンスID（既存のEC2を使用する場合）
     */
    readonly adEc2InstanceId?: string;
    /**
     * Identity DynamoDBテーブル名
     */
    readonly identityTableName?: string;
    /**
     * SIDキャッシュのTTL（秒）
     * @default 86400 (24時間)
     * @min 3600
     */
    readonly sidCacheTtl?: number;
    /**
     * SSM Run Commandのタイムアウト（秒）
     * @default 60
     * @min 10
     * @max 300
     */
    readonly ssmTimeout?: number;
}
/**
 * Identity設定
 */
export interface IdentityConfig {
    /**
     * Identity機能を有効化するかどうか
     * @default false
     */
    readonly enabled?: boolean;
    /**
     * DynamoDB設定
     */
    readonly dynamoDbConfig?: DynamoDbConfig;
    /**
     * RBAC設定
     */
    readonly rbacConfig?: RbacConfig;
    /**
     * ABAC設定
     */
    readonly abacConfig?: AbacConfig;
    /**
     * Windows AD設定
     */
    readonly windowsAdConfig?: WindowsAdConfig;
    /**
     * AD SID自動取得設定
     */
    readonly adSyncConfig?: AdSyncConfig;
}
/**
 * ストレージ設定
 */
export interface StorageConfig {
    /**
     * S3バケット名
     */
    readonly bucketName?: string;
    /**
     * FSx for ONTAP S3 Access Point ARN
     */
    readonly fsxS3AccessPointArn?: string;
}
/**
 * Puppeteer設定
 */
export interface PuppeteerConfig {
    /**
     * ヘッドレスモード
     * @default true
     */
    readonly headless?: boolean;
    /**
     * デフォルトビューポート
     */
    readonly defaultViewport?: {
        readonly width: number;
        readonly height: number;
    };
    /**
     * タイムアウト（ミリ秒）
     * @default 30000
     * @max 300000
     */
    readonly timeout?: number;
}
/**
 * Browser設定
 */
export interface BrowserConfig {
    /**
     * Browser機能を有効化するかどうか
     * @default false
     */
    readonly enabled?: boolean;
    /**
     * ストレージ設定
     */
    readonly storageConfig?: StorageConfig;
    /**
     * Puppeteer設定
     */
    readonly puppeteerConfig?: PuppeteerConfig;
}
/**
 * コード実行設定
 */
export interface ExecutionConfig {
    /**
     * タイムアウト（秒）
     * @default 60
     * @max 300
     */
    readonly timeout?: number;
    /**
     * 最大同時セッション数
     * @default 10
     * @min 1
     */
    readonly maxConcurrentSessions?: number;
    /**
     * 許可する言語
     * @default ['python']
     */
    readonly allowedLanguages?: string[];
}
/**
 * パッケージ管理設定
 */
export interface PackageManagementConfig {
    /**
     * 許可するパッケージリスト（ホワイトリスト）
     */
    readonly allowedPackages?: string[];
    /**
     * パッケージホワイトリスト（非推奨、allowedPackagesを使用）
     * @deprecated Use allowedPackages instead
     */
    readonly packageWhitelist?: string[];
}
/**
 * Code Interpreter設定
 */
export interface CodeInterpreterConfig {
    /**
     * Code Interpreter機能を有効化するかどうか
     * @default false
     */
    readonly enabled?: boolean;
    /**
     * コード実行設定
     */
    readonly executionConfig?: ExecutionConfig;
    /**
     * パッケージ管理設定
     */
    readonly packageManagementConfig?: PackageManagementConfig;
}
/**
 * X-Ray設定
 */
export interface XrayConfig {
    /**
     * サンプリングレート（0.0-1.0）
     * @default 0.1
     * @min 0
     * @max 1
     */
    readonly samplingRate?: number;
    /**
     * アクティブトレーシングを有効化
     * @default true
     */
    readonly enableActiveTracing?: boolean;
}
/**
 * CloudWatch設定
 */
export interface CloudWatchConfig {
    /**
     * ダッシュボード名
     */
    readonly dashboardName?: string;
    /**
     * アラーム通知先メールアドレス
     */
    readonly alarmEmail?: string;
    /**
     * ログ保持期間（日）
     * @default 7
     * @min 1
     */
    readonly logRetentionDays?: number;
}
/**
 * エラー追跡設定
 */
export interface ErrorTrackingConfig {
    /**
     * 根本原因分析（RCA）を有効化
     * @default true
     */
    readonly enableRootCauseAnalysis?: boolean;
    /**
     * エラー閾値（この回数を超えるとアラート）
     * @default 10
     * @min 1
     */
    readonly errorThreshold?: number;
}
/**
 * Observability設定
 */
export interface ObservabilityConfig {
    /**
     * Observability機能を有効化するかどうか
     * @default false
     */
    readonly enabled?: boolean;
    /**
     * X-Ray設定
     */
    readonly xrayConfig?: XrayConfig;
    /**
     * CloudWatch設定
     */
    readonly cloudWatchConfig?: CloudWatchConfig;
    /**
     * エラー追跡設定
     */
    readonly errorTrackingConfig?: ErrorTrackingConfig;
}
/**
 * 品質メトリクス設定
 */
export interface QualityMetricsConfig {
    /**
     * 有効化するメトリクスリスト
     * @default ['accuracy', 'relevance', 'helpfulness']
     */
    readonly enabledMetrics?: string[];
    /**
     * 評価頻度
     * @default 'hourly'
     */
    readonly evaluationFrequency?: 'realtime' | 'hourly' | 'daily';
}
/**
 * A/Bテスト設定
 */
export interface AbTestConfig {
    /**
     * 自動最適化を有効化
     * @default true
     */
    readonly enableAutoOptimization?: boolean;
    /**
     * 最小サンプルサイズ
     * @default 100
     * @min 10
     */
    readonly minSampleSize?: number;
    /**
     * 信頼水準（0.0-1.0）
     * @default 0.95
     * @min 0.5
     * @max 0.99
     */
    readonly confidenceLevel?: number;
}
/**
 * パフォーマンス評価設定
 */
export interface PerformanceEvaluationConfig {
    /**
     * レイテンシ閾値（ミリ秒）
     * @default 1000
     * @min 100
     */
    readonly latencyThreshold?: number;
    /**
     * スループット閾値（リクエスト/秒）
     * @default 100
     * @min 1
     */
    readonly throughputThreshold?: number;
    /**
     * コスト閾値（USD）
     * @default 10.0
     * @min 0.01
     */
    readonly costThreshold?: number;
}
/**
 * Evaluations設定
 */
export interface EvaluationsConfig {
    /**
     * Evaluations機能を有効化するかどうか
     * @default false
     */
    readonly enabled?: boolean;
    /**
     * 品質メトリクス設定
     */
    readonly qualityMetricsConfig?: QualityMetricsConfig;
    /**
     * A/Bテスト設定
     */
    readonly abTestConfig?: AbTestConfig;
    /**
     * パフォーマンス評価設定
     */
    readonly performanceEvaluationConfig?: PerformanceEvaluationConfig;
}
/**
 * 自然言語ポリシー設定
 */
export interface NaturalLanguagePolicyConfig {
    /**
     * 自動変換を有効化
     * @default true
     */
    readonly enableAutoConversion?: boolean;
    /**
     * デフォルトポリシーテンプレート
     * @default 'standard'
     */
    readonly defaultPolicyTemplate?: string;
}
/**
 * Cedar統合設定
 */
export interface CedarIntegrationConfig {
    /**
     * 形式的検証を有効化
     * @default true
     */
    readonly enableFormalVerification?: boolean;
    /**
     * 競合検出を有効化
     * @default true
     */
    readonly enableConflictDetection?: boolean;
}
/**
 * Policy設定
 */
export interface PolicyConfig {
    /**
     * Policy機能を有効化するかどうか
     * @default false
     */
    readonly enabled?: boolean;
    /**
     * 自然言語ポリシー設定
     */
    readonly naturalLanguagePolicyConfig?: NaturalLanguagePolicyConfig;
    /**
     * Cedar統合設定
     */
    readonly cedarIntegrationConfig?: CedarIntegrationConfig;
}
/**
 * AgentCore設定の型定義
 *
 * cdk.context.jsonの"agentCore"セクションの型定義です。
 * 全てのAgentCore機能はオプションであり、有効化/無効化を個別に制御できます。
 */
export interface AgentCoreConfig {
    /**
     * AgentCore機能全体の有効化フラグ
     * @default false
     */
    readonly enabled?: boolean;
    /**
     * Runtime設定
     */
    readonly runtime?: RuntimeConfig;
    /**
     * Gateway設定
     */
    readonly gateway?: GatewayConfig;
    /**
     * Memory設定
     */
    readonly memory?: MemoryConfig;
    /**
     * Identity設定
     */
    readonly identity?: IdentityConfig;
    /**
     * Browser設定
     */
    readonly browser?: BrowserConfig;
    /**
     * Code Interpreter設定
     */
    readonly codeInterpreter?: CodeInterpreterConfig;
    /**
     * Observability設定
     */
    readonly observability?: ObservabilityConfig;
    /**
     * Evaluations設定
     */
    readonly evaluations?: EvaluationsConfig;
    /**
     * Policy設定
     */
    readonly policy?: PolicyConfig;
}
