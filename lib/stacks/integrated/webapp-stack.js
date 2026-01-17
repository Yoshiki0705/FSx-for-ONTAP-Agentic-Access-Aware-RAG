"use strict";
/**
 * WebAppStack - Lambda Web Adapter + Next.js + CloudFront + Permission API統合スタック
 *
 * 機能:
 * - Lambda Function (Container) with Web Adapter
 * - Lambda Function URL
 * - CloudFront Distribution
 * - ECR Repository
 * - IAM Roles and Permissions
 * - Permission API Lambda Function
 * - API Gateway (Permission API用)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebAppStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
// Phase 2 - Task 3: 動的モデル選択
const bedrock_agent_dynamic_construct_1 = require("../../modules/ai/constructs/bedrock-agent-dynamic-construct");
// Phase 4: AgentCore Constructs統合
const bedrock_agent_core_runtime_construct_1 = require("../../modules/ai/constructs/bedrock-agent-core-runtime-construct");
const bedrock_agent_core_gateway_construct_1 = require("../../modules/ai/constructs/bedrock-agent-core-gateway-construct");
const bedrock_agent_core_memory_construct_1 = require("../../modules/ai/constructs/bedrock-agent-core-memory-construct");
const bedrock_agent_core_browser_construct_1 = require("../../modules/ai/constructs/bedrock-agent-core-browser-construct");
const bedrock_agent_core_code_interpreter_construct_1 = require("../../modules/ai/constructs/bedrock-agent-core-code-interpreter-construct");
/**
 * デフォルト設定
 */
const DEFAULT_WEBAPP_CONFIG = {
    projectName: 'permission-aware-rag',
    environment: 'prod',
    regionPrefix: 'TokyoRegion',
    lambda: {
        timeout: 30,
        memorySize: 512,
    },
    bedrock: {
        region: 'us-east-1',
    },
    dockerPath: './docker/nextjs',
    // imageTag: CDKコンテキストから取得（-c imageTag=xxx）
    // デフォルト値は設定しない（必須パラメータとして扱う）
};
/**
 * WebAppStack - フル実装版
 */
class WebAppStack extends cdk.Stack {
    /** Lambda Function */
    webAppFunction;
    /** Lambda Function URL */
    functionUrl;
    /** CloudFront Distribution */
    distribution;
    /** ECR Repository */
    ecrRepository;
    /** Permission API Lambda Function */
    permissionApiFunction;
    /** Permission API Gateway */
    permissionApi;
    /** VPC（スタンドアローンモード用） */
    vpc;
    /** セキュリティグループ（スタンドアローンモード用） */
    securityGroup;
    /** Lambda実行ロール（addToPolicyメソッド使用のため具象型） */
    executionRole;
    /** Permission API実行ロール */
    permissionApiExecutionRole;
    /** Bedrock Agent Service Role */
    bedrockAgentServiceRole;
    /** Bedrock Agent */
    bedrockAgent;
    /** Bedrock Agent Alias */
    bedrockAgentAlias;
    /** WebAppStack設定（VPC Endpoint作成時に参照） */
    config;
    /** Phase 4: AgentCore Constructs（オプション） */
    agentCoreRuntime;
    agentCoreGateway;
    agentCoreMemory;
    agentCoreBrowser;
    agentCoreCodeInterpreter;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 設定を保存（VPC Endpoint作成時に参照）
        this.config = props.config;
        const { config, standaloneMode = true, // デフォルトはスタンドアローンモード
        existingVpcId, existingSecurityGroupId, networkingStack, securityStack, skipLambdaCreation = false, dockerPath = DEFAULT_WEBAPP_CONFIG.dockerPath, imageTag, // imageTagは必須パラメータ（デフォルト値なし）
        environmentResourceControl } = props;
        // 環境別リソース制御の設定（デフォルト値）
        const resourceControl = {
            createLambdaFunction: environmentResourceControl?.createLambdaFunction ?? true,
            createCloudFrontDistribution: environmentResourceControl?.createCloudFrontDistribution ?? true,
            enableBedrockAgent: environmentResourceControl?.enableBedrockAgent ?? (config.bedrockAgent?.enabled ?? false),
            enablePermissionApi: environmentResourceControl?.enablePermissionApi ?? (config.permissionApi?.enabled ?? false),
            enableAgentCore: environmentResourceControl?.enableAgentCore ?? (config.agentCore ? true : false),
            validateConfiguration: environmentResourceControl?.validateConfiguration ?? true,
        };
        // 設定検証（環境別制御）
        if (resourceControl.validateConfiguration) {
            this.validateEnvironmentConfiguration(config, props.environment);
        }
        // imageTagの検証（必須パラメータ）
        if (!imageTag && !skipLambdaCreation) {
            throw new Error('❌ imageTag is required! Please provide imageTag via:\n' +
                '   1. CDK context: npx cdk deploy -c imageTag=YOUR_TAG\n' +
                '   2. Props: new WebAppStack(scope, id, { imageTag: "YOUR_TAG", ... })\n' +
                '   3. Environment variable: export IMAGE_TAG=YOUR_TAG');
        }
        // 設定値の取得（デフォルト値を使用）
        const projectName = config.naming?.projectName || DEFAULT_WEBAPP_CONFIG.projectName;
        const environment = config.naming?.environment || DEFAULT_WEBAPP_CONFIG.environment;
        const regionPrefix = config.naming?.regionPrefix || DEFAULT_WEBAPP_CONFIG.regionPrefix;
        console.log('🚀 WebAppStack (Full) 初期化開始...');
        console.log(`   プロジェクト名: ${projectName}`);
        console.log(`   環境: ${environment}`);
        console.log(`   リージョンプレフィックス: ${regionPrefix}`);
        console.log(`   デプロイモード: ${standaloneMode ? 'スタンドアローン' : '統合'}`);
        console.log(`   Dockerパス: ${dockerPath}`);
        console.log(`   イメージタグ: ${imageTag || 'N/A (Lambda作成スキップ)'}`);
        if (skipLambdaCreation) {
            console.log('   ⚠️  Lambda関数作成をスキップ（ECRイメージ未準備）');
        }
        if (standaloneMode) {
            console.log('   📦 スタンドアローンモード: 他のStackに依存しません');
            if (existingVpcId) {
                console.log(`   🔗 既存VPC参照: ${existingVpcId}`);
            }
            if (existingSecurityGroupId) {
                console.log(`   🔗 既存セキュリティグループ参照: ${existingSecurityGroupId}`);
            }
        }
        else {
            console.log('   🔗 統合モード: 他のStackと連携します');
        }
        // モード判定とリソースセットアップ
        if (standaloneMode) {
        }
        else {
            this.setupIntegratedResources(networkingStack, securityStack);
        }
        // ECRリポジトリの参照（既存リポジトリを使用）
        // 注意: fromRepositoryName()はCDK合成時に例外を投げないため、try-catchは不要
        // リポジトリが存在しない場合は、デプロイ時にエラーになる
        const repositoryName = `${regionPrefix.toLowerCase()}-${projectName}-${environment}-webapp-repo`;
        this.ecrRepository = ecr.Repository.fromRepositoryName(this, 'WebAppRepository', repositoryName);
        console.log(`✅ 既存ECRリポジトリを参照: ${repositoryName}`);
        // DynamoDB access (if needed) - スタンドアローンモードでも追加可能
        if (!skipLambdaCreation && this.executionRole && config.database?.dynamodb?.enabled) {
            const dynamodbResources = config.database.dynamodb.tableArns || ['*'];
            this.executionRole.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'dynamodb:GetItem',
                    'dynamodb:PutItem',
                    'dynamodb:UpdateItem',
                    'dynamodb:DeleteItem',
                    'dynamodb:Query',
                    'dynamodb:Scan',
                ],
                resources: dynamodbResources,
            }));
            if (dynamodbResources[0] === '*') {
                console.log('⚠️  DynamoDBアクセス: 全テーブル（本番環境では特定のテーブルARNを指定してください）');
            }
            else {
                console.log(`✅ DynamoDBアクセス: ${dynamodbResources.length}個のテーブルに制限`);
            }
        }
        // 機能復旧用DynamoDBテーブルへのアクセス権限（Phase 1完了済み機能）
        if (!skipLambdaCreation && this.executionRole) {
            console.log('🔐 機能復旧用DynamoDBテーブルアクセス権限を追加中...');
            // セッション管理、ユーザー設定、チャット履歴、動的設定キャッシュテーブルへのアクセス
            const featureRestorationTables = [
                `arn:aws:dynamodb:${this.region}:${this.account}:table/permission-aware-rag-sessions`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/permission-aware-rag-sessions/index/*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/permission-aware-rag-user-preferences`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/permission-aware-rag-user-preferences/index/*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/permission-aware-rag-chat-history`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/permission-aware-rag-chat-history/index/*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/permission-aware-rag-discovery-cache`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/permission-aware-rag-discovery-cache/index/*`,
            ];
            this.executionRole.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'dynamodb:GetItem',
                    'dynamodb:PutItem',
                    'dynamodb:UpdateItem',
                    'dynamodb:DeleteItem',
                    'dynamodb:Query',
                    'dynamodb:Scan',
                    'dynamodb:BatchGetItem',
                    'dynamodb:BatchWriteItem',
                ],
                resources: featureRestorationTables,
            }));
            console.log('✅ 機能復旧用DynamoDBテーブルアクセス権限追加完了');
            console.log(`   - セッション管理テーブル: permission-aware-rag-sessions`);
            console.log(`   - ユーザー設定テーブル: permission-aware-rag-user-preferences`);
            console.log(`   - チャット履歴テーブル: permission-aware-rag-chat-history`);
            console.log(`   - 動的設定キャッシュテーブル: permission-aware-rag-discovery-cache`);
        }
        // Lambda Function（条件付き作成 - 環境別制御対応）
        const shouldCreateLambda = !skipLambdaCreation && resourceControl.createLambdaFunction && this.executionRole;
        if (shouldCreateLambda) {
            // Lambda VPC配置設定を確認
            const lambdaVpcConfig = this.config?.webapp?.lambda?.vpc;
            const shouldPlaceInVpc = lambdaVpcConfig?.enabled === true;
            console.log(`🔍 Lambda VPC設定チェック:`);
            console.log(`   - standaloneMode: ${standaloneMode}`);
            console.log(`   - lambda.vpc.enabled: ${shouldPlaceInVpc}`);
            console.log(`   - vpc: ${!!this.vpc}`);
            console.log(`   - securityGroup: ${!!this.securityGroup}`);
            // VPC設定を構築
            const vpcConfig = shouldPlaceInVpc && this.vpc && this.securityGroup ? {
                vpc: this.vpc,
                securityGroups: [this.securityGroup],
                vpcSubnets: {
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
            } : {};
            if (shouldPlaceInVpc && Object.keys(vpcConfig).length === 0) {
                console.warn('⚠️  Lambda VPC配置が有効ですが、VPCまたはセキュリティグループが見つかりません');
            }
            console.log(`🔍 vpcConfig設定: ${Object.keys(vpcConfig).length > 0 ? 'VPC内に配置' : 'VPC外に配置'}`);
            this.webAppFunction = new lambda.Function(this, 'WebAppFunction', {
                functionName: `${regionPrefix}-${projectName}-${environment}-WebApp-Function`,
                runtime: lambda.Runtime.FROM_IMAGE,
                code: lambda.Code.fromEcrImage(this.ecrRepository, {
                    tagOrDigest: imageTag,
                }),
                handler: lambda.Handler.FROM_IMAGE,
                role: this.executionRole,
                timeout: cdk.Duration.seconds(config.compute?.lambda?.timeout || 30),
                memorySize: config.compute?.lambda?.memorySize || 512,
                ...vpcConfig,
                environment: {
                    NODE_ENV: 'production',
                    BEDROCK_REGION: config.ai?.bedrock?.region || 'us-east-1',
                    AWS_LWA_INVOKE_MODE: 'response_stream',
                    AWS_LWA_PORT: '3000',
                    RUST_LOG: 'info',
                    // 機能復旧用DynamoDBテーブル（Phase 1完了済み）
                    SESSION_TABLE_NAME: 'permission-aware-rag-sessions', // セッション管理テーブル
                    PREFERENCES_TABLE_NAME: props.dataStack?.userPreferencesTable?.tableName || 'permission-aware-rag-preferences', // ユーザー設定テーブル（Task 3.2）
                    CHAT_HISTORY_TABLE_NAME: props.dataStack?.chatHistoryTable?.tableName || 'permission-aware-rag-chat-history',
                    DISCOVERY_CACHE_TABLE_NAME: 'permission-aware-rag-discovery-cache', // 動的設定キャッシュテーブル
                    // JWT認証設定（Phase 1完了済み）
                    JWT_SECRET: 'your-super-secret-jwt-key-change-in-production-2024',
                    JWT_EXPIRES_IN: '7d',
                    // Bedrock Agent情報（既存）
                    BEDROCK_AGENT_ID: this.bedrockAgent?.attrAgentId || '1NWQJTIMAH',
                    BEDROCK_AGENT_ALIAS_ID: this.bedrockAgentAlias?.attrAgentAliasId || 'TSTALIASID',
                    // Permission API用DynamoDBテーブル（既存）
                    DYNAMODB_TABLE_NAME: props.userAccessTable?.tableName || '',
                    PERMISSION_CACHE_TABLE_NAME: props.permissionCacheTable?.tableName || '',
                    // 多言語対応設定（Phase 2準備）
                    DEFAULT_LOCALE: 'ja',
                    SUPPORTED_LOCALES: 'ja,en,ko,zh-CN,zh-TW,es,fr,de',
                    // 動的モデル検出設定（Phase 2準備）
                    MODEL_DISCOVERY_ENABLED: 'true',
                    MODEL_CACHE_TTL: '3600', // 1時間
                    // パフォーマンス設定（Phase 5準備）
                    ENABLE_CACHING: 'true',
                    CACHE_TTL: '300', // 5分
                    // セキュリティ設定（Phase 1完了済み）
                    ENABLE_CSRF_PROTECTION: 'true',
                    SECURE_COOKIES: 'true',
                    // ログレベル設定
                    LOG_LEVEL: 'info',
                },
                logRetention: logs.RetentionDays.ONE_WEEK,
            });
            console.log('✅ Lambda関数作成完了');
            // Lambda Function URL
            this.functionUrl = this.webAppFunction.addFunctionUrl({
                authType: lambda.FunctionUrlAuthType.NONE,
                cors: {
                    allowedOrigins: ['*'],
                    allowedMethods: [lambda.HttpMethod.ALL],
                    allowedHeaders: ['*'],
                    maxAge: cdk.Duration.days(1),
                },
                invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
            });
            // CloudFront Distribution（環境別制御対応）
            if (resourceControl.createCloudFrontDistribution) {
                // 注意: Lambda Function URLをOriginとして使用する場合、
                // ALL_VIEWER_EXCEPT_HOST_HEADERを使用する必要があります。
                // ALL_VIEWERを使用すると、CloudFrontのHostヘッダーがLambdaに転送され、
                // Lambda Function URLがホスト名を認識できず403エラーが発生します。
                this.distribution = new cloudfront.Distribution(this, 'WebAppDistribution', {
                    comment: `${regionPrefix}-${projectName}-${environment}-WebApp-Distribution`,
                    defaultBehavior: {
                        origin: new origins.HttpOrigin(cdk.Fn.select(2, cdk.Fn.split('/', this.functionUrl.url))),
                        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                        compress: true,
                        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                        // 2026-01-14: Changed to ALL_VIEWER to forward all headers including Host header
                        // This fixes Agent mode errors caused by missing headers
                        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
                    },
                    priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
                    enableLogging: false,
                });
                console.log('✅ CloudFront配信作成完了');
            }
            else {
                console.log('⚠️  CloudFront配信作成をスキップ（環境別制御）');
            }
            // DynamoDBアクセス権限の付与
            if (props.dataStack?.chatHistoryTable) {
                props.dataStack.chatHistoryTable.grantReadWriteData(this.webAppFunction);
                console.log('✅ ChatHistoryTableへのアクセス権限付与完了');
            }
            // UserPreferencesテーブルへのアクセス権限付与（Task 3.2）
            if (props.dataStack?.userPreferencesTable) {
                props.dataStack.userPreferencesTable.grantReadWriteData(this.webAppFunction);
                console.log('✅ UserPreferencesTableへのアクセス権限付与完了');
            }
            console.log('✅ Lambda関数・CloudFront作成完了');
        }
        else {
            console.log('⚠️  Lambda関数・CloudFront作成をスキップ');
            console.log('   次のステップ:');
            console.log('   1. ECRにNext.jsイメージをプッシュ');
            console.log('   2. skipLambdaCreation=falseで再デプロイ');
        }
        // ========================================
        // 出力値の定義（US-2.1要件）
        // ========================================
        // 1. ECRリポジトリURI（必須）
        new cdk.CfnOutput(this, 'ECRRepositoryUri', {
            value: this.ecrRepository.repositoryUri,
            description: 'ECR Repository URI - コンテナイメージのプッシュ先',
            exportName: `${this.stackName}-ECRRepositoryUri`,
        });
        new cdk.CfnOutput(this, 'ECRRepositoryName', {
            value: this.ecrRepository.repositoryName,
            description: 'ECR Repository Name',
            exportName: `${this.stackName}-ECRRepositoryName`,
        });
        // 2. API Gateway URL（Lambda Function URLで代替）
        // 注: 現在の実装ではLambda Function URLを使用
        // 将来的にAPI Gatewayに移行する場合は、このセクションを更新
        if (!skipLambdaCreation && this.functionUrl) {
            new cdk.CfnOutput(this, 'ApiUrl', {
                value: this.functionUrl.url,
                description: 'API URL (Lambda Function URL) - バックエンドAPIエンドポイント',
                exportName: `${this.stackName}-ApiUrl`,
            });
            new cdk.CfnOutput(this, 'FunctionUrl', {
                value: this.functionUrl.url,
                description: 'Lambda Function URL - 直接アクセス用',
                exportName: `${this.stackName}-FunctionUrl`,
            });
        }
        // 3. CloudFront Distribution URL（必須）
        if (!skipLambdaCreation && this.distribution) {
            new cdk.CfnOutput(this, 'CloudFrontUrl', {
                value: `https://${this.distribution.distributionDomainName}`,
                description: 'CloudFront Distribution URL - フロントエンドアクセス用（推奨）',
                exportName: `${this.stackName}-CloudFrontUrl`,
            });
            new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
                value: this.distribution.distributionId,
                description: 'CloudFront Distribution ID - キャッシュ無効化用',
                exportName: `${this.stackName}-CloudFrontDistributionId`,
            });
            new cdk.CfnOutput(this, 'CloudFrontDomainName', {
                value: this.distribution.distributionDomainName,
                description: 'CloudFront Domain Name',
                exportName: `${this.stackName}-CloudFrontDomainName`,
            });
        }
        // 4. Lambda関数情報（デバッグ・監視用）
        if (!skipLambdaCreation && this.webAppFunction) {
            new cdk.CfnOutput(this, 'LambdaFunctionName', {
                value: this.webAppFunction.functionName,
                description: 'Lambda Function Name - CloudWatch Logs確認用',
                exportName: `${this.stackName}-LambdaFunctionName`,
            });
            new cdk.CfnOutput(this, 'LambdaFunctionArn', {
                value: this.webAppFunction.functionArn,
                description: 'Lambda Function ARN',
                exportName: `${this.stackName}-LambdaFunctionArn`,
            });
        }
        // 5. デプロイモード情報
        new cdk.CfnOutput(this, 'DeployMode', {
            value: standaloneMode ? 'standalone' : 'integrated',
            description: 'デプロイモード - スタンドアローン or 統合',
        });
        // 6. スタック情報
        new cdk.CfnOutput(this, 'StackName', {
            value: this.stackName,
            description: 'CloudFormation Stack Name',
        });
        new cdk.CfnOutput(this, 'Region', {
            value: this.region,
            description: 'デプロイリージョン',
        });
        console.log('');
        console.log('========================================');
        console.log('📋 出力値サマリー');
        console.log('========================================');
        console.log(`✅ ECRリポジトリURI: ${this.ecrRepository.repositoryUri}`);
        if (!skipLambdaCreation && this.functionUrl) {
            console.log(`✅ API URL: ${this.functionUrl.url}`);
        }
        if (!skipLambdaCreation && this.distribution) {
            console.log(`✅ CloudFront URL: https://${this.distribution.distributionDomainName}`);
        }
        console.log('========================================');
        // Permission API機能の追加（環境別制御対応）
        if (resourceControl.enablePermissionApi && props.userAccessTable && props.permissionCacheTable) {
            console.log('');
            console.log('========================================');
            console.log('🔐 Permission API機能を追加中...');
            console.log('========================================');
            // ✅ Temporarily commented out for deployment
            console.log("createPermissionApiResources: Temporarily disabled");
            console.log('✅ Permission API機能追加完了');
        }
        else if (resourceControl.enablePermissionApi) {
            console.log('⚠️  Permission API機能が有効ですが、DynamoDBテーブルが提供されていません');
            console.log('   DataStackからuserAccessTableとpermissionCacheTableを渡してください');
        }
        else {
            console.log('ℹ️  Permission API機能は無効化されています（環境別制御）');
        }
        // Bedrock Agent機能の追加（環境別制御対応）
        if (resourceControl.enableBedrockAgent) {
            console.log('');
            console.log('========================================');
            console.log('🤖 Bedrock Agent機能を追加中...');
            console.log('========================================');
            // ✅ Temporarily commented out for deployment
            console.log("createBedrockAgentResources: Temporarily disabled");
            console.log('✅ Bedrock Agent機能追加完了');
        }
        else {
            console.log('ℹ️  Bedrock Agent機能は無効化されています（環境別制御）');
        }
        // Phase 4: AgentCore Constructs統合（環境別制御対応）
        if (resourceControl.enableAgentCore && config.agentCore) {
            console.log('');
            console.log('========================================');
            console.log('🚀 AgentCore Constructs統合開始...');
            console.log('========================================');
            // ✅ Temporarily commented out for deployment
            console.log("integrateAgentCoreConstructs: Temporarily disabled");
            console.log('✅ AgentCore Constructs統合完了');
        }
        else if (config.agentCore) {
            console.log('ℹ️  AgentCore機能は無効化されています（環境別制御）');
        }
        // Tags
        cdk.Tags.of(this).add('Module', 'WebApp');
        cdk.Tags.of(this).add('Framework', 'Next.js');
        cdk.Tags.of(this).add('Adapter', 'Lambda Web Adapter');
        cdk.Tags.of(this).add('CDN', 'CloudFront');
        if (config.permissionApi?.enabled) {
            cdk.Tags.of(this).add('PermissionAPI', 'Enabled');
        }
        if (config.bedrockAgent?.enabled) {
            cdk.Tags.of(this).add('BedrockAgent', 'Enabled');
        }
        console.log('✅ WebAppStack (Full) 初期化完了');
    }
    /**
     * スタンドアローンモード用リソースセットアップ
     * 必要なリソースを参照または作成
     */
    setupStandaloneResources(existingVpcId, existingSecurityGroupId, projectName, environment, regionPrefix) {
        console.log('📦 スタンドアローンモード: リソースセットアップ開始...');
        // VPCの参照または作成
        if (existingVpcId) {
            console.log(`🔗 既存VPCを参照: ${existingVpcId}`);
            try {
                this.vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', {
                    vpcId: existingVpcId
                });
                console.log('✅ 既存VPC参照成功');
                // 既存VPCの場合、DynamoDB VPC Endpointを作成（既に存在する場合はスキップ）
                try {
                }
                catch (error) {
                    console.log('ℹ️  DynamoDB VPC Endpointは既に存在するか、作成できませんでした');
                }
            }
            catch (error) {
                console.warn('⚠️  既存VPCが見つかりません。新規VPCを作成します。');
            }
        }
        else {
            console.log('🆕 新規VPCを作成（最小構成）');
        }
        // セキュリティグループの参照または作成
        if (existingSecurityGroupId) {
            console.log(`🔗 既存セキュリティグループを参照: ${existingSecurityGroupId}`);
            try {
                this.securityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'ExistingSecurityGroup', existingSecurityGroupId);
                console.log('✅ 既存セキュリティグループ参照成功');
            }
            catch (error) {
                console.warn('⚠️  既存セキュリティグループが見つかりません。新規作成します。');
            }
        }
        else {
            console.log('🆕 新規セキュリティグループを作成');
        }
        // IAMロールの作成（必須）
        console.log('🔑 IAMロールを作成');
        console.log('✅ スタンドアローンモード: リソースセットアップ完了');
    }
    /**
     * 統合モード用リソースセットアップ
     * 他のStackからリソースを参照
     */
    setupIntegratedResources(networkingStack, securityStack) {
        console.log('🔗 統合モード: リソースセットアップ開始...');
        // 必須Stackの確認
        if (!networkingStack || !securityStack) {
            throw new Error('統合モードではNetworkingStackとSecurityStackが必要です。' +
                'スタンドアローンモードを使用するか、必要なStackを提供してください。');
        }
        // 他のStackから参照
        this.vpc = networkingStack.vpc;
        this.securityGroup = networkingStack.webAppSecurityGroup;
        this.executionRole = securityStack.lambdaExecutionRole;
        console.log('✅ 統合モード: リソースセットアップ完了');
    }
    /**
     * 最小限のVPCを作成
     * プライベートサブネット + NATゲートウェイ（Lambda用）
     */
    createMinimalVpc(projectName, environment, regionPrefix) {
        console.log('🏗️  最小限のVPCを作成中...');
        const vpc = new ec2.Vpc(this, 'WebAppVpc', {
            vpcName: `${regionPrefix}-${projectName}-${environment}-WebApp-VPC`,
            maxAzs: 2,
            natGateways: 1, // Lambda用にNATゲートウェイ1つ
            subnetConfiguration: [
                {
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: 24,
                },
                {
                    name: 'Private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24,
                }
            ],
        });
        cdk.Tags.of(vpc).add('Name', `${regionPrefix}-${projectName}-${environment}-WebApp-VPC`);
        cdk.Tags.of(vpc).add('Purpose', 'WebApp-Standalone');
        // Lambda VPC配置が有効な場合のみVPC Endpointを作成
        const lambdaVpcConfig = this.config?.webapp?.lambda?.vpc;
        if (lambdaVpcConfig?.enabled) {
            console.log('🔗 Lambda VPC配置が有効 - VPC Endpointを作成します');
            // DynamoDB VPC Endpoint（Gateway型、無料）
            if (lambdaVpcConfig.endpoints?.dynamodb !== false) {
            }
            // Bedrock Runtime VPC Endpoint（Interface型、$7.2/月）
            if (lambdaVpcConfig.endpoints?.bedrockRuntime) {
                // セキュリティグループが必要なので、先に作成
                if (!this.securityGroup) {
                }
            }
            // Bedrock Agent Runtime VPC Endpoint（Interface型、$7.2/月）
            if (lambdaVpcConfig.endpoints?.bedrockAgentRuntime) {
                // セキュリティグループが必要なので、先に作成
                if (!this.securityGroup) {
                }
            }
        }
        else {
            console.log('ℹ️  Lambda VPC配置が無効 - VPC Endpointは作成しません');
        }
        console.log('✅ VPC作成完了');
        return vpc;
    }
    /**
     * DynamoDB VPC Endpointを作成
     * Gateway型エンドポイント（無料）を使用
     * Lambda関数がVPC内からDynamoDBにアクセスするために必要
     */
    createDynamoDbVpcEndpoint(vpc, projectName, environment, regionPrefix) {
        console.log('🔗 DynamoDB VPC Endpointを作成中...');
        const dynamoDbEndpoint = vpc.addGatewayEndpoint('DynamoDbEndpoint', {
            service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
        });
        // タグを追加
        cdk.Tags.of(dynamoDbEndpoint).add('Name', `${regionPrefix}-${projectName}-${environment}-DynamoDB-Endpoint`);
        cdk.Tags.of(dynamoDbEndpoint).add('Purpose', 'Lambda-DynamoDB-Access');
        cdk.Tags.of(dynamoDbEndpoint).add('Type', 'Gateway');
        console.log('✅ DynamoDB VPC Endpoint作成完了');
        return dynamoDbEndpoint;
    }
    /**
     * Bedrock Runtime VPC Endpointを作成
     * Interface型エンドポイント（$7.2/月）を使用
     * Lambda関数がVPC内からBedrock Runtime API（InvokeModel）にアクセスするために必要
     * KB Modeで使用
     */
    createBedrockRuntimeVpcEndpoint(vpc, securityGroup, projectName, environment, regionPrefix) {
        console.log('🔗 Bedrock Runtime VPC Endpointを作成中...');
        const bedrockRuntimeEndpoint = new ec2.InterfaceVpcEndpoint(this, 'BedrockRuntimeEndpoint', {
            vpc,
            service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${this.region}.bedrock-runtime`),
            subnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: [securityGroup],
            privateDnsEnabled: true,
        });
        // タグを追加
        cdk.Tags.of(bedrockRuntimeEndpoint).add('Name', `${regionPrefix}-${projectName}-${environment}-BedrockRuntime-Endpoint`);
        cdk.Tags.of(bedrockRuntimeEndpoint).add('Purpose', 'Lambda-Bedrock-Runtime-Access');
        cdk.Tags.of(bedrockRuntimeEndpoint).add('Type', 'Interface');
        cdk.Tags.of(bedrockRuntimeEndpoint).add('Mode', 'KB-Mode');
        console.log('✅ Bedrock Runtime VPC Endpoint作成完了');
        return bedrockRuntimeEndpoint;
    }
    /**
     * Bedrock Agent Runtime VPC Endpointを作成
     * Interface型エンドポイント（$7.2/月）を使用
     * Lambda関数がVPC内からBedrock Agent Runtime API（InvokeAgent）にアクセスするために必要
     * Agent Modeで使用
     */
    createBedrockAgentRuntimeVpcEndpoint(vpc, securityGroup, projectName, environment, regionPrefix) {
        console.log('🔗 Bedrock Agent Runtime VPC Endpointを作成中...');
        const bedrockAgentEndpoint = new ec2.InterfaceVpcEndpoint(this, 'BedrockAgentRuntimeEndpoint', {
            vpc,
            service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${this.region}.bedrock-agent-runtime`),
            subnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: [securityGroup],
            privateDnsEnabled: true,
        });
        // タグを追加
        cdk.Tags.of(bedrockAgentEndpoint).add('Name', `${regionPrefix}-${projectName}-${environment}-BedrockAgentRuntime-Endpoint`);
        cdk.Tags.of(bedrockAgentEndpoint).add('Purpose', 'Lambda-Bedrock-Agent-Runtime-Access');
        cdk.Tags.of(bedrockAgentEndpoint).add('Type', 'Interface');
        cdk.Tags.of(bedrockAgentEndpoint).add('Mode', 'Agent-Mode');
        console.log('✅ Bedrock Agent Runtime VPC Endpoint作成完了');
        return bedrockAgentEndpoint;
    }
    /**
     * セキュリティグループを作成
     */
    createSecurityGroup(projectName, environment, regionPrefix) {
        console.log('🔒 セキュリティグループを作成中...');
        if (!this.vpc) {
            throw new Error('VPCが作成されていません。先にVPCを作成してください。');
        }
        const securityGroup = new ec2.SecurityGroup(this, 'WebAppSecurityGroup', {
            vpc: this.vpc,
            securityGroupName: `${regionPrefix}-${projectName}-${environment}-WebApp-SG`,
            description: 'Security group for WebApp Lambda (Standalone Mode)',
            allowAllOutbound: true,
        });
        // HTTPSアウトバウンドを明示的に許可
        securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS outbound for AWS API calls');
        cdk.Tags.of(securityGroup).add('Name', `${regionPrefix}-${projectName}-${environment}-WebApp-SG`);
        cdk.Tags.of(securityGroup).add('Purpose', 'WebApp-Standalone');
        console.log('✅ セキュリティグループ作成完了');
        return securityGroup;
    }
    /**
     * IAMロールを作成
     */
    createIamRoles(projectName, environment, regionPrefix) {
        console.log('🔑 IAMロールを作成中...');
        this.executionRole = new iam.Role(this, 'WebAppExecutionRole', {
            roleName: `${regionPrefix}-${projectName}-${environment}-WebApp-Execution-Role`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Execution role for WebApp Lambda function (Standalone Mode)',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
            ],
        });
        // Bedrock アクセス権限
        this.executionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
                'bedrock:ListFoundationModels',
                'bedrock:GetFoundationModel',
            ],
            resources: ['*'],
        }));
        // Bedrock Agent Runtime権限（今回の修正で追加）
        this.executionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock-agent-runtime:InvokeAgent',
                'bedrock-agent-runtime:Retrieve',
            ],
            resources: ['*'],
        }));
        // Bedrock Agent Invocation権限（Phase 2 - Task 2 Critical Fix）
        this.executionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeAgent',
            ],
            resources: [
                `arn:aws:bedrock:${this.region}:${this.account}:agent-alias/*`,
            ],
        }));
        // Bedrock Agent管理権限（Agent Info API用 - 2025-12-12修正）
        // Agent作成・管理権限追加（2025-12-31追加）
        // 2026-01-11: Agent Creation Wizard用権限追加
        this.executionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                // Agent情報取得に必要な権限（bedrock名前空間）
                'bedrock:GetAgent',
                'bedrock:ListAgents',
                'bedrock:ListAgentAliases',
                'bedrock:GetAgentAlias',
                'bedrock:UpdateAgent',
                'bedrock:PrepareAgent',
                // Agent作成・削除権限（2025-12-31追加）
                'bedrock:CreateAgent',
                'bedrock:DeleteAgent',
                'bedrock:CreateAgentAlias',
                'bedrock:UpdateAgentAlias',
                'bedrock:DeleteAgentAlias',
                // Action Group管理権限
                'bedrock:CreateAgentActionGroup',
                'bedrock:UpdateAgentActionGroup',
                'bedrock:DeleteAgentActionGroup',
                'bedrock:GetAgentActionGroup',
                'bedrock:ListAgentActionGroups',
                // Knowledge Base関連権限
                'bedrock:AssociateAgentKnowledgeBase',
                'bedrock:DisassociateAgentKnowledgeBase',
                'bedrock:GetAgentKnowledgeBase',
                'bedrock:ListAgentKnowledgeBases',
                'bedrock:ListKnowledgeBases',
                'bedrock:GetKnowledgeBase',
                // Foundation Model管理権限（Agent Creation Wizard用）
                'bedrock:ListFoundationModels',
                'bedrock:GetFoundationModel',
                'bedrock:ListCustomModels',
                // 従来のbedrock-agent権限も維持（互換性のため）
                'bedrock-agent:GetAgent',
                'bedrock-agent:ListAgents',
                'bedrock-agent:UpdateAgent',
                'bedrock-agent:PrepareAgent',
                'bedrock-agent:CreateAgent',
                'bedrock-agent:DeleteAgent',
                'bedrock-agent:CreateAgentAlias',
                'bedrock-agent:UpdateAgentAlias',
                'bedrock-agent:DeleteAgentAlias',
            ],
            resources: ['*'],
        }));
        // IAM PassRole権限（Bedrock Agent更新・作成時に必要）
        this.executionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'iam:PassRole',
            ],
            resources: [
                `arn:aws:iam::${this.account}:role/*bedrock-agent-role*`,
                `arn:aws:iam::${this.account}:role/AmazonBedrockExecutionRoleForAgents_*`,
                `arn:aws:iam::${this.account}:role/TokyoRegion-permission-aware-rag-*-Agent-Service-Role`,
                `arn:aws:iam::${this.account}:role/TokyoRegion-permission-aware-rag-*-WebApp-Execution-Role`,
            ],
            conditions: {
                StringEquals: {
                    'iam:PassedToService': 'bedrock.amazonaws.com'
                }
            }
        }));
        // IAM Role管理権限（Agent Service Role作成用 - 2026-01-11追加）
        this.executionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'iam:CreateRole',
                'iam:GetRole',
                'iam:AttachRolePolicy',
                'iam:DetachRolePolicy',
                'iam:PutRolePolicy',
                'iam:DeleteRolePolicy',
                'iam:ListAttachedRolePolicies',
                'iam:ListRolePolicies',
                'iam:TagRole',
                'iam:UntagRole',
            ],
            resources: [
                `arn:aws:iam::${this.account}:role/TokyoRegion-permission-aware-rag-*-Agent-Service-Role`,
            ],
        }));
        // SSMパラメータアクセス権限（Agent ID動的取得用）
        this.executionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:PutParameter',
                'ssm:DeleteParameter',
                'ssm:GetParametersByPath',
            ],
            resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/bedrock-agent/*`,
            ],
        }));
        // ECR アクセス権限（コンテナイメージ取得用）
        this.executionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'ecr:BatchCheckLayerAvailability',
            ],
            resources: ['*'], // 後でECRリポジトリARNに制限可能
        }));
        cdk.Tags.of(this.executionRole).add('Purpose', 'WebApp-Standalone');
        console.log('✅ IAMロール作成完了');
    }
    /**
     * Permission APIリソースを作成
     */
    createPermissionApiResources(userAccessTable, permissionCacheTable, config, projectName, environment, regionPrefix) {
        console.log('🔐 Permission APIリソース作成開始...');
        // 1. IAMロールの作成
        this.permissionApiExecutionRole = new iam.Role(this, 'PermissionApiExecutionRole', {
            roleName: `${projectName}-${environment}-permission-api-role`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Execution role for Permission API Lambda function',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
            ],
        });
        // DynamoDBアクセス権限
        userAccessTable.grantReadWriteData(this.permissionApiExecutionRole);
        permissionCacheTable.grantReadWriteData(this.permissionApiExecutionRole);
        // SSMパラメータアクセス権限
        const ssmParameterPrefix = config.permissionApi?.ssmParameterPrefix || '/fsx-ontap';
        this.permissionApiExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParametersByPath',
            ],
            resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter${ssmParameterPrefix}/*`,
            ],
        }));
        // FSx ONTAPアクセス権限（REST API経由）
        this.permissionApiExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'fsx:DescribeFileSystems',
                'fsx:DescribeVolumes',
            ],
            resources: ['*'],
        }));
        console.log('✅ Permission API IAMロール作成完了');
        // 2. Lambda関数の作成
        // 環境変数の設定
        const permissionApiEnvironment = {
            USER_ACCESS_TABLE_NAME: userAccessTable.tableName,
            PERMISSION_CACHE_TABLE_NAME: permissionCacheTable.tableName,
            FSX_MANAGEMENT_ENDPOINT: config.permissionApi?.ontapManagementLif || '',
            SSM_PARAMETER_PREFIX: ssmParameterPrefix,
            CACHE_ENABLED: 'true',
            CACHE_TTL_SECONDS: '300',
            LOG_LEVEL: 'INFO',
            AWS_REGION: this.region,
        };
        this.permissionApiFunction = new lambda.Function(this, 'PermissionApiFunction', {
            functionName: `${projectName}-${environment}-permission-api`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'get-user-permissions.handler',
            code: lambda.Code.fromAsset('lambda/permissions', {
                bundling: {
                    image: lambda.Runtime.NODEJS_20_X.bundlingImage,
                    command: [
                        'bash', '-c',
                        'npm install && cp -r . /asset-output/',
                    ],
                },
            }),
            role: this.permissionApiExecutionRole,
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
            environment: permissionApiEnvironment,
            logRetention: logs.RetentionDays.ONE_WEEK,
            vpc: this.vpc,
            securityGroups: this.securityGroup ? [this.securityGroup] : undefined,
            vpcSubnets: this.vpc ? {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            } : undefined,
        });
        console.log('✅ Permission API Lambda関数作成完了');
        // 3. API Gatewayの作成
        this.permissionApi = new apigateway.RestApi(this, 'PermissionApi', {
            restApiName: `${projectName}-${environment}-permission-api`,
            description: 'Permission API for FSx ONTAP Hybrid Permission System',
            deployOptions: {
                stageName: 'prod',
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
                metricsEnabled: true,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });
        // Lambda統合の作成
        const permissionApiIntegration = new apigateway.LambdaIntegration(this.permissionApiFunction, {
            proxy: true,
        });
        // /permissions エンドポイント
        const permissions = this.permissionApi.root.addResource('permissions');
        // GET /permissions/{userId}
        const userPermissions = permissions.addResource('{userId}');
        userPermissions.addMethod('GET', permissionApiIntegration, {
            authorizationType: apigateway.AuthorizationType.IAM,
            requestParameters: {
                'method.request.path.userId': true,
            },
        });
        console.log('✅ Permission API Gateway作成完了');
        // 4. 出力値の定義
        new cdk.CfnOutput(this, 'PermissionApiUrl', {
            value: this.permissionApi.url,
            description: 'Permission API URL',
            exportName: `${this.stackName}-PermissionApiUrl`,
        });
        new cdk.CfnOutput(this, 'PermissionApiFunctionName', {
            value: this.permissionApiFunction.functionName,
            description: 'Permission API Lambda Function Name',
            exportName: `${this.stackName}-PermissionApiFunctionName`,
        });
        new cdk.CfnOutput(this, 'PermissionApiFunctionArn', {
            value: this.permissionApiFunction.functionArn,
            description: 'Permission API Lambda Function ARN',
            exportName: `${this.stackName}-PermissionApiFunctionArn`,
        });
        console.log('');
        console.log('========================================');
        console.log('📋 Permission API出力値サマリー');
        console.log('========================================');
        console.log(`✅ API URL: ${this.permissionApi.url}`);
        console.log(`✅ Lambda関数名: ${this.permissionApiFunction.functionName}`);
        console.log('========================================');
    }
    /**
     * Bedrock Agentリソースを作成
     * Phase 2 - Task 3: BedrockAgentDynamicConstructを使用した動的モデル選択
     */
    createBedrockAgentResources(config, projectName, environment, regionPrefix) {
        console.log('🤖 Bedrock Agentリソース作成開始...');
        console.log('   動的モデル選択機能を使用');
        // BedrockAgentDynamicConstructを使用
        const bedrockAgentConstruct = new bedrock_agent_dynamic_construct_1.BedrockAgentDynamicConstruct(this, "BedrockAgentDynamic", {
            projectName: config.naming?.projectName || "permission-aware-rag",
            environment,
            agentName: `${regionPrefix}-${config.naming?.projectName || "permission-aware-rag"}-${environment}-agent`,
            agentDescription: "Permission-aware RAG Agent with dynamic model selection",
            instruction: "You are a helpful assistant with access to permission-aware document search.",
            useCase: config.bedrockAgent?.useCase || "chat",
            modelRequirements: config.bedrockAgent?.modelRequirements || {},
            enableDynamicModelSelection: true,
        });
        // コンストラクトから生成されたリソースを取得
        this.bedrockAgent = bedrockAgentConstruct.agent;
        this.bedrockAgentAlias = bedrockAgentConstruct.agentAlias;
        this.bedrockAgentServiceRole = bedrockAgentConstruct.agentRole;
        console.log('✅ Bedrock Agent作成完了');
        console.log(`   選択されたモデル: ${bedrockAgentConstruct.selectedModel}`);
        // Lambda関数への権限付与
        if (this.webAppFunction) {
            console.log('🔑 Lambda関数にBedrock Agent権限を付与中...');
            bedrockAgentConstruct.grantInvokeToLambda(this.webAppFunction);
            console.log('✅ Lambda関数への権限付与完了');
        }
        // Lambda関数の環境変数を更新（Agent情報を追加）
        if (this.webAppFunction && this.bedrockAgent && this.bedrockAgentAlias) {
            console.log('🔄 Lambda関数の環境変数を更新中...');
            this.webAppFunction.addEnvironment('BEDROCK_AGENT_ID', this.bedrockAgent.attrAgentId);
            this.webAppFunction.addEnvironment('BEDROCK_AGENT_ALIAS_ID', this.bedrockAgentAlias.attrAgentAliasId);
            console.log('✅ Lambda関数の環境変数更新完了');
        }
        // CloudFormation Outputsの設定
        console.log('✅ Bedrock Agentリソース作成完了');
    }
    /**
     * Agent指示プロンプトを取得
     */
    getAgentInstruction() {
        return `
あなたは、権限認識型RAG（Retrieval-Augmented Generation）システムのAIアシスタントです。
ユーザーの質問に対して、そのユーザーがアクセス権限を持つ文書のみを参照して回答を生成します。

## 主要な責務

1. **権限ベースの文書検索**
   - ユーザーの質問を受け取ったら、まずdocument_searchアクションを使用して関連文書を検索します
   - 検索結果には、ユーザーがアクセス権限を持つ文書のみが含まれます
   - 検索結果が空の場合、ユーザーに「アクセス可能な関連文書が見つかりませんでした」と伝えます

2. **正確な情報提供**
   - 検索された文書の内容のみに基づいて回答を生成します
   - 文書に記載されていない情報については、推測や創作をせず、「文書に記載がありません」と正直に伝えます
   - 複数の文書から情報を統合する場合、各情報の出典を明示します

3. **セキュリティとプライバシー**
   - ユーザーがアクセス権限を持たない文書の存在や内容について言及しません
   - 他のユーザーの情報やアクセス権限について開示しません
   - 機密情報や個人情報を適切に扱います

4. **ユーザーエクスペリエンス**
   - 明確で簡潔な回答を提供します
   - 必要に応じて、追加の質問や詳細情報を求めます
   - 技術的な内容を分かりやすく説明します

## Action Groupsの使用

### document_search
ユーザーの質問に関連する文書を検索します。このアクションは自動的にユーザーの権限を考慮します。

**使用タイミング:**
- ユーザーが質問をした時
- より詳細な情報が必要な時
- 特定のトピックについて確認が必要な時

**パラメータ:**
- query: 検索クエリ（ユーザーの質問から抽出したキーワード）
- maxResults: 取得する文書の最大数（デフォルト: 5）

## 回答フォーマット

### 標準的な回答
\`\`\`
[検索された文書に基づく回答]

参照文書:
- [文書名1] (最終更新: [日付])
- [文書名2] (最終更新: [日付])
\`\`\`

### 文書が見つからない場合
\`\`\`
申し訳ございませんが、ご質問に関連するアクセス可能な文書が見つかりませんでした。
以下の点をご確認ください：
- 質問の表現を変えてみる
- より具体的なキーワードを使用する
- 必要な文書へのアクセス権限を確認する
\`\`\`

### 部分的な情報のみの場合
\`\`\`
[利用可能な情報に基づく部分的な回答]

注意: この回答は限られた情報に基づいています。より詳細な情報については、[関連する文書やリソース]をご確認ください。
\`\`\`

## 制約事項

1. **権限の尊重**: ユーザーがアクセス権限を持たない情報には一切言及しません
2. **正確性の優先**: 不確実な情報よりも、「わかりません」と正直に答えることを優先します
3. **文書ベース**: 検索された文書の内容のみに基づいて回答します
4. **プライバシー保護**: 個人情報や機密情報を適切に扱います

## エラーハンドリング

- 検索エラーが発生した場合: 「一時的なエラーが発生しました。しばらくしてから再度お試しください」
- タイムアウトが発生した場合: 「処理に時間がかかっています。質問を簡潔にしていただけますか？」
- 権限エラーが発生した場合: 「この操作を実行する権限がありません。管理者にお問い合わせください」

あなたの目標は、ユーザーに対して正確で、安全で、役立つ情報を提供することです。
常にユーザーの権限を尊重し、セキュリティとプライバシーを最優先に考えてください。`;
    }
    /**
     * Bedrock Agent CloudFormation Outputsを作成
     */
    createBedrockAgentOutputs(projectName, environment) {
        if (!this.bedrockAgent) {
            console.warn('⚠️  Bedrock Agentが作成されていないため、Outputsをスキップします');
            return;
        }
        // Agent ID
        new cdk.CfnOutput(this, 'BedrockAgentId', {
            value: this.bedrockAgent.attrAgentId,
            description: 'Bedrock Agent ID',
            exportName: `${this.stackName}-BedrockAgentId`,
        });
        // Agent ARN
        new cdk.CfnOutput(this, 'BedrockAgentArn', {
            value: this.bedrockAgent.attrAgentArn,
            description: 'Bedrock Agent ARN',
            exportName: `${this.stackName}-BedrockAgentArn`,
        });
        // Agent Alias ID
        if (this.bedrockAgentAlias) {
            new cdk.CfnOutput(this, 'BedrockAgentAliasId', {
                value: this.bedrockAgentAlias.attrAgentAliasId,
                description: 'Bedrock Agent Alias ID',
                exportName: `${this.stackName}-BedrockAgentAliasId`,
            });
            new cdk.CfnOutput(this, 'BedrockAgentAliasArn', {
                value: this.bedrockAgentAlias.attrAgentAliasArn,
                description: 'Bedrock Agent Alias ARN',
                exportName: `${this.stackName}-BedrockAgentAliasArn`,
            });
        }
        // Service Role ARN
        if (this.bedrockAgentServiceRole) {
            new cdk.CfnOutput(this, 'BedrockAgentServiceRoleArn', {
                value: this.bedrockAgentServiceRole.roleArn,
                description: 'Bedrock Agent Service Role ARN',
                exportName: `${this.stackName}-BedrockAgentServiceRoleArn`,
            });
        }
        console.log('');
        console.log('========================================');
        console.log('📋 Bedrock Agent出力値サマリー');
        console.log('========================================');
        console.log(`✅ Agent ID: ${this.bedrockAgent.attrAgentId}`);
        if (this.bedrockAgentAlias) {
            console.log(`✅ Agent Alias ID: ${this.bedrockAgentAlias.attrAgentAliasId}`);
        }
        if (this.bedrockAgentServiceRole) {
            console.log(`✅ Service Role ARN: ${this.bedrockAgentServiceRole.roleArn}`);
        }
        console.log('========================================');
    }
    /**
     * AgentCore Constructs統合（Phase 4）
     */
    integrateAgentCoreConstructs(config, projectName, environment, regionPrefix) {
        const agentCoreConfig = config.agentCore;
        if (!agentCoreConfig) {
            return;
        }
        // 1. Runtime Construct（イベント駆動実行）
        if (agentCoreConfig.runtime?.enabled) {
            console.log('🔄 Runtime Construct作成中...');
            this.agentCoreRuntime = new bedrock_agent_core_runtime_construct_1.BedrockAgentCoreRuntimeConstruct(this, 'AgentCoreRuntime', {
            // lambdaConfig: agentCoreConfig.runtime.lambdaConfig, // Type mismatch - commented out
            });
            console.log('✅ Runtime Construct作成完了');
        }
        // 2. Gateway Construct（API/Lambda/MCP統合）
        if (agentCoreConfig.gateway?.enabled) {
            console.log('🌉 Gateway Construct作成中...');
            this.agentCoreGateway = new bedrock_agent_core_gateway_construct_1.BedrockAgentCoreGatewayConstruct(this, "AgentCoreGateway", {
                projectName: config.naming?.projectName || "permission-aware-rag",
                environment,
                restApiConversion: agentCoreConfig.gateway.restApiConversionConfig,
                lambdaFunctionConversion: agentCoreConfig.gateway.lambdaFunctionConversionConfig,
                mcpServerIntegration: agentCoreConfig.gateway.mcpServerIntegrationConfig,
            });
            console.log('✅ Gateway Construct作成完了');
        }
        // 3. Memory Construct（長期記憶）
        if (agentCoreConfig.memory?.enabled) {
            console.log('🧠 Memory Construct作成中...');
            this.agentCoreMemory = new bedrock_agent_core_memory_construct_1.BedrockAgentCoreMemoryConstruct(this, 'AgentCoreMemory', {});
            console.log('✅ Memory Construct作成完了');
        }
        // 4. Browser Construct（Web自動化）
        if (agentCoreConfig.browser?.enabled) {
            console.log('🌐 Browser Construct作成中...');
            this.agentCoreBrowser = new bedrock_agent_core_browser_construct_1.BedrockAgentCoreBrowserConstruct(this, 'AgentCoreBrowser', {
                ...agentCoreConfig.browser,
            });
            console.log('✅ Browser Construct作成完了');
        }
        // 5. CodeInterpreter Construct（コード実行）
        if (agentCoreConfig.codeInterpreter?.enabled) {
            console.log('💻 CodeInterpreter Construct作成中...');
            this.agentCoreCodeInterpreter = new bedrock_agent_core_code_interpreter_construct_1.BedrockAgentCoreCodeInterpreterConstruct(this, 'AgentCoreCodeInterpreter', {
                ...agentCoreConfig.codeInterpreter,
            });
            console.log('✅ CodeInterpreter Construct作成完了');
        }
        // CloudFormation Outputs
    }
    /**
     * AgentCore CloudFormation Outputsを作成
     */
    createAgentCoreOutputs(projectName, environment) {
        console.log('📤 AgentCore Outputs作成中...');
        // Runtime Outputs
        if (this.agentCoreRuntime?.lambdaFunction) {
            new cdk.CfnOutput(this, 'AgentCoreRuntimeFunctionArn', {
                value: this.agentCoreRuntime.lambdaFunction.functionArn,
                description: 'AgentCore Runtime Lambda Function ARN',
                exportName: `${this.stackName}-AgentCoreRuntimeFunctionArn`,
            });
        }
        // Gateway Outputs
        if (this.agentCoreGateway?.restApiConverterFunction) {
            new cdk.CfnOutput(this, 'AgentCoreGatewayRestApiConverterArn', {
                value: this.agentCoreGateway.restApiConverterFunction.functionArn,
                description: 'AgentCore Gateway REST API Converter ARN',
                exportName: `${this.stackName}-AgentCoreGatewayRestApiConverterArn`,
            });
        }
        // Memory Outputs
        if (this.agentCoreMemory?.memoryResourceArn) {
            new cdk.CfnOutput(this, 'AgentCoreMemoryResourceArn', {
                value: this.agentCoreMemory.memoryResourceArn,
                description: 'AgentCore Memory Resource ARN',
                exportName: `${this.stackName}-AgentCoreMemoryResourceArn`,
            });
            new cdk.CfnOutput(this, 'AgentCoreMemoryResourceId', {
                value: this.agentCoreMemory.memoryResourceId,
                description: 'AgentCore Memory Resource ID',
                exportName: `${this.stackName}-AgentCoreMemoryResourceId`,
            });
        }
        // Browser Outputs
        if (this.agentCoreBrowser?.browserFunction) {
            new cdk.CfnOutput(this, 'AgentCoreBrowserFunctionArn', {
                value: this.agentCoreBrowser.browserFunction.functionArn,
                description: 'AgentCore Browser Lambda Function ARN',
                exportName: `${this.stackName}-AgentCoreBrowserFunctionArn`,
            });
        }
        // CodeInterpreter Outputs
        if (this.agentCoreCodeInterpreter?.interpreterFunction) {
            new cdk.CfnOutput(this, 'AgentCoreCodeInterpreterFunctionArn', {
                value: this.agentCoreCodeInterpreter.interpreterFunction.functionArn,
                description: 'AgentCore CodeInterpreter Lambda Function ARN',
                exportName: `${this.stackName}-AgentCoreCodeInterpreterFunctionArn`,
            });
        }
        console.log('✅ AgentCore Outputs作成完了');
    }
    /**
     * 環境設定の検証
     * Task 6.3: 手動対処部分の自動化
     */
    validateEnvironmentConfiguration(config, environment) {
        console.log('🔍 環境設定検証開始...');
        const errors = [];
        const warnings = [];
        // Bedrock Agent設定の検証
        if (config.bedrockAgent?.enabled) {
            const agentConfig = config.bedrockAgent;
            // Add default values for missing properties
            const extendedAgentConfig = {
                ...agentConfig,
                agentId: agentConfig.agentId || (environment === "prod" ? "1NWQJTIMAH" : "PXCEX87Y09"),
                agentAliasId: agentConfig.agentAliasId || "TSTALIASID",
                region: agentConfig.region || "ap-northeast-1"
            };
            if (!extendedAgentConfig.agentId || extendedAgentConfig.agentId === 'PLACEHOLDER_AGENT_ID') {
                errors.push('Bedrock Agent ID が設定されていません');
            }
            else if (!/^[A-Z0-9]{10}$/.test(extendedAgentConfig.agentId)) {
                errors.push(`Bedrock Agent ID の形式が無効です: ${extendedAgentConfig.agentId}`);
            }
            if (!extendedAgentConfig.agentAliasId || extendedAgentConfig.agentAliasId === 'TSTALIASID') {
                warnings.push('Bedrock Agent Alias ID がデフォルト値です');
            }
            if (!extendedAgentConfig.region) {
                errors.push('Bedrock Agent リージョンが設定されていません');
            }
            // 環境別期待値の検証
            if (environment === 'prod' && extendedAgentConfig.agentId !== '1NWQJTIMAH') {
                errors.push(`本番環境のAgent IDが期待値と異なります。期待値: 1NWQJTIMAH, 実際値: ${extendedAgentConfig.agentId}`);
            }
            else if (environment === 'dev' && extendedAgentConfig.agentId !== 'PXCEX87Y09') {
                errors.push(`開発環境のAgent IDが期待値と異なります。期待値: PXCEX87Y09, 実際値: ${extendedAgentConfig.agentId}`);
            }
        }
        // プロジェクト設定の検証
        const projectName = config.naming?.projectName || config.project?.name;
        if (!projectName) {
            errors.push('プロジェクト名が設定されていません');
        }
        const envName = config.naming?.environment || config.environment;
        if (!envName) {
            errors.push('環境名が設定されていません');
        }
        else if (envName !== environment) {
            warnings.push(`設定ファイルの環境名(${envName})とデプロイ環境(${environment})が異なります`);
        }
        // リージョン設定の検証
        const region = config.ai?.bedrock?.region;
        if (region && !/^[a-z]+-[a-z]+-[0-9]+$/.test(region)) {
            errors.push(`リージョン形式が無効です: ${region}`);
        }
        // 検証結果の出力
        if (errors.length > 0) {
            console.log('❌ 設定検証エラー:');
            errors.forEach(error => console.log(`   - ${error}`));
            throw new Error(`設定検証に失敗しました。${errors.length}個のエラーがあります。`);
        }
        if (warnings.length > 0) {
            console.log('⚠️ 設定検証警告:');
            warnings.forEach(warning => console.log(`   - ${warning}`));
        }
        console.log('✅ 環境設定検証完了');
    }
}
exports.WebAppStack = WebAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViYXBwLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid2ViYXBwLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7R0FXRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFFbkMsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsdUVBQXlEO0FBQ3pELDRFQUE4RDtBQUM5RCwyREFBNkM7QUFDN0MseURBQTJDO0FBQzNDLHVFQUF5RDtBQVF6RCw0QkFBNEI7QUFDNUIsaUhBQTJHO0FBQzNHLGtDQUFrQztBQUNsQywySEFBb0g7QUFDcEgsMkhBQW9IO0FBQ3BILHlIQUFrSDtBQUNsSCwySEFBb0g7QUFDcEgsNklBQXFJO0FBR3JJOztHQUVHO0FBQ0gsTUFBTSxxQkFBcUIsR0FBRztJQUM1QixXQUFXLEVBQUUsc0JBQXNCO0lBQ25DLFdBQVcsRUFBRSxNQUFNO0lBQ25CLFlBQVksRUFBRSxhQUFhO0lBQzNCLE1BQU0sRUFBRTtRQUNOLE9BQU8sRUFBRSxFQUFFO1FBQ1gsVUFBVSxFQUFFLEdBQUc7S0FDaEI7SUFDRCxPQUFPLEVBQUU7UUFDUCxNQUFNLEVBQUUsV0FBVztLQUNwQjtJQUNELFVBQVUsRUFBRSxpQkFBaUI7SUFDN0IsMkNBQTJDO0lBQzNDLDZCQUE2QjtDQUM5QixDQUFDO0FBc0hGOztHQUVHO0FBQ0gsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDeEMsc0JBQXNCO0lBQ04sY0FBYyxDQUFrQjtJQUVoRCwwQkFBMEI7SUFDVixXQUFXLENBQXFCO0lBRWhELDhCQUE4QjtJQUNkLFlBQVksQ0FBMEI7SUFFdEQscUJBQXFCO0lBQ0wsYUFBYSxDQUFrQjtJQUUvQyxxQ0FBcUM7SUFDOUIscUJBQXFCLENBQW1CO0lBRS9DLDZCQUE2QjtJQUN0QixhQUFhLENBQXNCO0lBRTFDLHdCQUF3QjtJQUNoQixHQUFHLENBQVk7SUFFdkIsK0JBQStC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QzlELENBQUM7UUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQzVCLENBQUM7Q0FDRjtBQTEvQ0Qsa0NBMC9DQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogV2ViQXBwU3RhY2sgLSBMYW1iZGEgV2ViIEFkYXB0ZXIgKyBOZXh0LmpzICsgQ2xvdWRGcm9udCArIFBlcm1pc3Npb24gQVBJ57Wx5ZCI44K544K/44OD44KvXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0gTGFtYmRhIEZ1bmN0aW9uIChDb250YWluZXIpIHdpdGggV2ViIEFkYXB0ZXJcbiAqIC0gTGFtYmRhIEZ1bmN0aW9uIFVSTFxuICogLSBDbG91ZEZyb250IERpc3RyaWJ1dGlvblxuICogLSBFQ1IgUmVwb3NpdG9yeVxuICogLSBJQU0gUm9sZXMgYW5kIFBlcm1pc3Npb25zXG4gKiAtIFBlcm1pc3Npb24gQVBJIExhbWJkYSBGdW5jdGlvblxuICogLSBBUEkgR2F0ZXdheSAoUGVybWlzc2lvbiBBUEnnlKgpXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZWNyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3InO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBiZWRyb2NrIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iZWRyb2NrJztcblxuLy8gUGhhc2UgNzog5Z6L5a6a576p44Gu5Y6z5a+G5YyWIC0gU3RhY2vplpPjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrlcbmltcG9ydCB7IElOZXR3b3JraW5nU3RhY2ssIElTZWN1cml0eVN0YWNrIH0gZnJvbSAnLi9pbnRlcmZhY2VzL3N0YWNrLWludGVyZmFjZXMnO1xuLy8gUGVybWlzc2lvbiBBUEnnkrDlooPoqK3lrppcbmltcG9ydCB7IFBlcm1pc3Npb25BcGlFbnZDb25maWcgfSBmcm9tICcuLi8uLi9jb25maWcvcGVybWlzc2lvbi1hcGktZW52LWNvbmZpZyc7XG4vLyBQaGFzZSAyIC0gVGFzayAzOiDli5XnmoTjg6Ljg4fjg6vpgbjmip5cbmltcG9ydCB7IEJlZHJvY2tBZ2VudER5bmFtaWNDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2FpL2NvbnN0cnVjdHMvYmVkcm9jay1hZ2VudC1keW5hbWljLWNvbnN0cnVjdCc7XG4vLyBQaGFzZSA0OiBBZ2VudENvcmUgQ29uc3RydWN0c+e1seWQiFxuaW1wb3J0IHsgQmVkcm9ja0FnZW50Q29yZVJ1bnRpbWVDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2FpL2NvbnN0cnVjdHMvYmVkcm9jay1hZ2VudC1jb3JlLXJ1bnRpbWUtY29uc3RydWN0JztcbmltcG9ydCB7IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1nYXRld2F5LWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRDb3JlTWVtb3J5Q29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1tZW1vcnktY29uc3RydWN0JztcbmltcG9ydCB7IEJlZHJvY2tBZ2VudENvcmVCcm93c2VyQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1icm93c2VyLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRDb3JlQ29kZUludGVycHJldGVyQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1jb2RlLWludGVycHJldGVyLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBBZ2VudENvcmVDb25maWcgfSBmcm9tICcuLi8uLi8uLi90eXBlcy9hZ2VudGNvcmUtY29uZmlnJztcblxuLyoqXG4gKiDjg4fjg5Xjgqnjg6vjg4joqK3lrppcbiAqL1xuY29uc3QgREVGQVVMVF9XRUJBUFBfQ09ORklHID0ge1xuICBwcm9qZWN0TmFtZTogJ3Blcm1pc3Npb24tYXdhcmUtcmFnJyxcbiAgZW52aXJvbm1lbnQ6ICdwcm9kJyxcbiAgcmVnaW9uUHJlZml4OiAnVG9reW9SZWdpb24nLFxuICBsYW1iZGE6IHtcbiAgICB0aW1lb3V0OiAzMCxcbiAgICBtZW1vcnlTaXplOiA1MTIsXG4gIH0sXG4gIGJlZHJvY2s6IHtcbiAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICB9LFxuICBkb2NrZXJQYXRoOiAnLi9kb2NrZXIvbmV4dGpzJyxcbiAgLy8gaW1hZ2VUYWc6IENES+OCs+ODs+ODhuOCreOCueODiOOBi+OCieWPluW+l++8iC1jIGltYWdlVGFnPXh4eO+8iVxuICAvLyDjg4fjg5Xjgqnjg6vjg4jlgKTjga/oqK3lrprjgZfjgarjgYTvvIjlv4XpoIjjg5Hjg6njg6Hjg7zjgr/jgajjgZfjgabmibHjgYbvvIlcbn07XG5cbi8qKlxuICogV2ViQXBw44K544K/44OD44Kv6Kit5a6a44Kk44Oz44K/44O844OV44Kn44O844K5XG4gKiBFbnZpcm9ubWVudENvbmZpZ+OBqOOBruS6kuaPm+aAp+OCkuS/neOBpOOBn+OCgeOAgeaflOi7n+OBquWei+Wumue+qVxuICovXG5leHBvcnQgaW50ZXJmYWNlIFdlYkFwcFN0YWNrQ29uZmlnIHtcbiAgcmVhZG9ubHkgcHJvamVjdD86IHtcbiAgICBuYW1lPzogc3RyaW5nO1xuICB9O1xuICByZWFkb25seSBuYW1pbmc/OiB7XG4gICAgcHJvamVjdE5hbWU/OiBzdHJpbmc7XG4gICAgZW52aXJvbm1lbnQ/OiBzdHJpbmc7XG4gICAgcmVnaW9uUHJlZml4Pzogc3RyaW5nO1xuICB9O1xuICByZWFkb25seSBlbnZpcm9ubWVudD86IHN0cmluZztcbiAgcmVhZG9ubHkgY29tcHV0ZT86IHtcbiAgICBsYW1iZGE/OiB7XG4gICAgICB0aW1lb3V0PzogbnVtYmVyO1xuICAgICAgbWVtb3J5U2l6ZT86IG51bWJlcjtcbiAgICB9O1xuICB9O1xuICByZWFkb25seSBhaT86IHtcbiAgICBiZWRyb2NrPzoge1xuICAgICAgcmVnaW9uPzogc3RyaW5nO1xuICAgICAgW2tleTogc3RyaW5nXTogYW55OyAvLyBFbnZpcm9ubWVudENvbmZpZ+OBqOOBruS6kuaPm+aAp+OBruOBn+OCgVxuICAgIH07XG4gIH07XG4gIHJlYWRvbmx5IGRhdGFiYXNlPzoge1xuICAgIGR5bmFtb2RiPzoge1xuICAgICAgZW5hYmxlZD86IGJvb2xlYW47XG4gICAgICB0YWJsZUFybnM/OiBzdHJpbmdbXTtcbiAgICB9O1xuICB9O1xuICByZWFkb25seSBwZXJtaXNzaW9uQXBpPzoge1xuICAgIGVuYWJsZWQ/OiBib29sZWFuOyAvLyBQZXJtaXNzaW9uIEFQSeapn+iDveOBruacieWKueWMllxuICAgIG9udGFwTWFuYWdlbWVudExpZj86IHN0cmluZzsgLy8gRlN4IE9OVEFQ566h55CGTElGXG4gICAgc3NtUGFyYW1ldGVyUHJlZml4Pzogc3RyaW5nOyAvLyBTU03jg5Hjg6njg6Hjg7zjgr/jg5fjg6zjg5XjgqPjg4Pjgq/jgrlcbiAgfTtcbiAgcmVhZG9ubHkgYmVkcm9ja0FnZW50Pzoge1xuICAgIGVuYWJsZWQ/OiBib29sZWFuOyAvLyBCZWRyb2NrIEFnZW505qmf6IO944Gu5pyJ5Yq55YyWXG4gICAgLy8gUGhhc2UgMiAtIFRhc2sgMzog5YuV55qE44Oi44OH44Or6YG45oqe6Kit5a6aXG4gICAgdXNlQ2FzZT86ICdjaGF0JyB8ICdnZW5lcmF0aW9uJyB8ICdjb3N0RWZmZWN0aXZlJyB8ICdtdWx0aW1vZGFsJztcbiAgICBtb2RlbFJlcXVpcmVtZW50cz86IHtcbiAgICAgIG9uRGVtYW5kPzogYm9vbGVhbjtcbiAgICAgIHN0cmVhbWluZz86IGJvb2xlYW47XG4gICAgICBjcm9zc1JlZ2lvbj86IGJvb2xlYW47XG4gICAgICBpbnB1dE1vZGFsaXRpZXM/OiBzdHJpbmdbXTtcbiAgICB9O1xuICAgIGVuYWJsZUR5bmFtaWNNb2RlbFNlbGVjdGlvbj86IGJvb2xlYW47XG4gICAgZW5hYmxlQXV0b1VwZGF0ZT86IGJvb2xlYW47XG4gICAgcGFyYW1ldGVyU3RvcmVQcmVmaXg/OiBzdHJpbmc7XG4gICAgLy8g5pei5a2Y44Gu44OX44Ot44OR44OG44KjXG4gICAga25vd2xlZGdlQmFzZUlkPzogc3RyaW5nOyAvLyBLbm93bGVkZ2UgQmFzZSBJRFxuICAgIGRvY3VtZW50U2VhcmNoTGFtYmRhQXJuPzogc3RyaW5nOyAvLyBEb2N1bWVudCBTZWFyY2ggTGFtYmRhIEFSTlxuICB9O1xuICAvLyBQaGFzZSA0OiBBZ2VudENvcmXoqK3lrppcbiAgcmVhZG9ubHkgYWdlbnRDb3JlPzogQWdlbnRDb3JlQ29uZmlnO1xuICBcbiAgLy8gRW52aXJvbm1lbnRDb25maWfjgajjga7kupLmj5vmgKfjga7jgZ/jgoHjgIHov73liqDjg5fjg63jg5Hjg4bjgqPjgpLoqLHlj69cbiAgW2tleTogc3RyaW5nXTogYW55O1xufVxuXG4vKipcbiAqIFdlYkFwcOOCueOCv+ODg+OCr+ODl+ODreODkeODhuOCo1xuICogXG4gKiBQaGFzZSA3OiDlnovlrprnvqnjga7ljrPlr4bljJZcbiAqIC0gYGFueWDlnovjgpLlrozlhajmjpLpmaRcbiAqIC0gSU5ldHdvcmtpbmdTdGFjaywgSVNlY3VyaXR5U3RhY2vlnovjgpLpgannlKhcbiAqIC0g5Z6L5a6J5YWo5oCnMTAwJemBlOaIkFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFdlYkFwcFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIC8vIOioreWumuOCquODluOCuOOCp+OCr+ODiO+8iOWei+WuieWFqO+8iVxuICByZWFkb25seSBjb25maWc6IFdlYkFwcFN0YWNrQ29uZmlnO1xuICBcbiAgLy8g44OX44Ot44K444Kn44Kv44OI5oOF5aCxXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7IC8vIOODl+ODreOCuOOCp+OCr+ODiOWQje+8iOW/hemgiO+8iVxuICByZWFkb25seSBlbnZpcm9ubWVudDogc3RyaW5nOyAvLyDnkrDlooPlkI3vvIjlv4XpoIjvvIlcbiAgXG4gIC8vIOODh+ODl+ODreOCpOODouODvOODieioreWumlxuICByZWFkb25seSBzdGFuZGFsb25lTW9kZT86IGJvb2xlYW47IC8vIOOCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODie+8iOODh+ODleOCqeODq+ODiDogdHJ1Ze+8iVxuICBcbiAgLy8g44K544K/44Oz44OJ44Ki44Ot44O844Oz44Oi44O844OJ55So6Kit5a6aXG4gIHJlYWRvbmx5IGV4aXN0aW5nVnBjSWQ/OiBzdHJpbmc7IC8vIOaXouWtmFZQQyBJRO+8iOOCquODl+OCt+ODp+ODs++8iVxuICByZWFkb25seSBleGlzdGluZ1NlY3VyaXR5R3JvdXBJZD86IHN0cmluZzsgLy8g5pei5a2Y44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OXSUTvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgXG4gIC8vIOe1seWQiOODouODvOODieeUqOioreWumu+8iOWei+WuieWFqO+8iVxuICByZWFkb25seSBuZXR3b3JraW5nU3RhY2s/OiBJTmV0d29ya2luZ1N0YWNrOyAvLyBOZXR3b3JraW5nU3RhY2vlj4LnhafvvIjntbHlkIjjg6Ljg7zjg4nmmYLvvIlcbiAgcmVhZG9ubHkgc2VjdXJpdHlTdGFjaz86IElTZWN1cml0eVN0YWNrOyAvLyBTZWN1cml0eVN0YWNr5Y+C54Wn77yI57Wx5ZCI44Oi44O844OJ5pmC77yJXG4gIFxuICAvLyBFQ1Ljg7tMYW1iZGHoqK3lrppcbiAgcmVhZG9ubHkgc2tpcExhbWJkYUNyZWF0aW9uPzogYm9vbGVhbjsgLy8gTGFtYmRh6Zai5pWw5L2c5oiQ44KS44K544Kt44OD44OX77yIRUNS44Kk44Oh44O844K45pyq5rqW5YKZ5pmC77yJXG4gIHJlYWRvbmx5IGRvY2tlclBhdGg/OiBzdHJpbmc7IC8vIERvY2tlcmZpbGXjga7jg5HjgrnvvIjjg4fjg5Xjgqnjg6vjg4g6ICcuL2RvY2tlci9uZXh0anMn77yJXG4gIHJlYWRvbmx5IGltYWdlVGFnPzogc3RyaW5nOyAvLyDjgqTjg6Hjg7zjgrjjgr/jgrDvvIjjg4fjg5Xjgqnjg6vjg4g6ICdsYXRlc3Qn77yJXG4gIFxuICAvKipcbiAgICog55Kw5aKD5Yil44Oq44K944O844K55L2c5oiQ5Yi25b6h6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbD86IHtcbiAgICByZWFkb25seSBjcmVhdGVMYW1iZGFGdW5jdGlvbj86IGJvb2xlYW47IC8vIExhbWJkYemWouaVsOS9nOaIkOWItuW+oVxuICAgIHJlYWRvbmx5IGNyZWF0ZUNsb3VkRnJvbnREaXN0cmlidXRpb24/OiBib29sZWFuOyAvLyBDbG91ZEZyb2506YWN5L+h5L2c5oiQ5Yi25b6hXG4gICAgcmVhZG9ubHkgZW5hYmxlQmVkcm9ja0FnZW50PzogYm9vbGVhbjsgLy8gQmVkcm9jayBBZ2VudOapn+iDveWItuW+oVxuICAgIHJlYWRvbmx5IGVuYWJsZVBlcm1pc3Npb25BcGk/OiBib29sZWFuOyAvLyBQZXJtaXNzaW9uIEFQSeapn+iDveWItuW+oVxuICAgIHJlYWRvbmx5IGVuYWJsZUFnZW50Q29yZT86IGJvb2xlYW47IC8vIEFnZW50Q29yZeapn+iDveWItuW+oVxuICAgIHJlYWRvbmx5IHZhbGlkYXRlQ29uZmlndXJhdGlvbj86IGJvb2xlYW47IC8vIOioreWumuaknOiovOWItuW+oVxuICB9O1xuICBcbiAgLy8gUGVybWlzc2lvbiBBUEnoqK3lrprvvIhEYXRhU3RhY2vjgYvjgonlj4LnhafvvIlcbiAgcmVhZG9ubHkgdXNlckFjY2Vzc1RhYmxlPzogZHluYW1vZGIuSVRhYmxlOyAvLyDjg6bjg7zjgrbjg7zjgqLjgq/jgrvjgrnjg4bjg7zjg5bjg6tcbiAgcmVhZG9ubHkgcGVybWlzc2lvbkNhY2hlVGFibGU/OiBkeW5hbW9kYi5JVGFibGU7IC8vIOaoqemZkOOCreODo+ODg+OCt+ODpeODhuODvOODluODq1xuICBcbiAgLy8gRGF0YVN0YWNr5Y+C54Wn77yI44OB44Oj44OD44OI5bGl5q2044OG44O844OW44Or55So77yJXG4gIHJlYWRvbmx5IGRhdGFTdGFjaz86IHtcbiAgICBjaGF0SGlzdG9yeVRhYmxlPzogZHluYW1vZGIuSVRhYmxlO1xuICAgIHVzZXJQcmVmZXJlbmNlc1RhYmxlPzogZHluYW1vZGIuSVRhYmxlOyAvLyBUYXNrIDMuMjogQWdlbnRDb3Jl57Wx5ZCI55So44Om44O844K244O86Kit5a6a44OG44O844OW44OrXG4gIH07XG59XG5cbi8qKlxuICogV2ViQXBwU3RhY2sgLSDjg5Xjg6vlrp/oo4XniYhcbiAqL1xuZXhwb3J0IGNsYXNzIFdlYkFwcFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgLyoqIExhbWJkYSBGdW5jdGlvbiAqL1xuICBwdWJsaWMgcmVhZG9ubHkgd2ViQXBwRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgXG4gIC8qKiBMYW1iZGEgRnVuY3Rpb24gVVJMICovXG4gIHB1YmxpYyByZWFkb25seSBmdW5jdGlvblVybDogbGFtYmRhLkZ1bmN0aW9uVXJsO1xuICBcbiAgLyoqIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uICovXG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuICBcbiAgLyoqIEVDUiBSZXBvc2l0b3J5ICovXG4gIHB1YmxpYyByZWFkb25seSBlY3JSZXBvc2l0b3J5OiBlY3IuSVJlcG9zaXRvcnk7XG4gIFxuICAvKiogUGVybWlzc2lvbiBBUEkgTGFtYmRhIEZ1bmN0aW9uICovXG4gIHB1YmxpYyBwZXJtaXNzaW9uQXBpRnVuY3Rpb24/OiBsYW1iZGEuRnVuY3Rpb247XG4gIFxuICAvKiogUGVybWlzc2lvbiBBUEkgR2F0ZXdheSAqL1xuICBwdWJsaWMgcGVybWlzc2lvbkFwaT86IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgXG4gIC8qKiBWUEPvvIjjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4nnlKjvvIkgKi9cbiAgcHJpdmF0ZSB2cGM/OiBlYzIuSVZwYztcbiAgXG4gIC8qKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fvvIjjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4nnlKjvvIkgKi9cbiAgcHJpdmF0ZSBzZWN1cml0eUdyb3VwPzogZWMyLklTZWN1cml0eUdyb3VwO1xuICBcbiAgLyoqIExhbWJkYeWun+ihjOODreODvOODq++8iGFkZFRvUG9saWN544Oh44K944OD44OJ5L2/55So44Gu44Gf44KB5YW36LGh5Z6L77yJICovXG4gIHByaXZhdGUgZXhlY3V0aW9uUm9sZT86IGlhbS5Sb2xlO1xuICBcbiAgLyoqIFBlcm1pc3Npb24gQVBJ5a6f6KGM44Ot44O844OrICovXG4gIHByaXZhdGUgcGVybWlzc2lvbkFwaUV4ZWN1dGlvblJvbGU/OiBpYW0uUm9sZTtcbiAgXG4gIC8qKiBCZWRyb2NrIEFnZW50IFNlcnZpY2UgUm9sZSAqL1xuICBwdWJsaWMgYmVkcm9ja0FnZW50U2VydmljZVJvbGU/OiBpYW0uUm9sZTtcbiAgXG4gIC8qKiBCZWRyb2NrIEFnZW50ICovXG4gIHB1YmxpYyBiZWRyb2NrQWdlbnQ/OiBiZWRyb2NrLkNmbkFnZW50O1xuICBcbiAgLyoqIEJlZHJvY2sgQWdlbnQgQWxpYXMgKi9cbiAgcHVibGljIGJlZHJvY2tBZ2VudEFsaWFzPzogYmVkcm9jay5DZm5BZ2VudEFsaWFzO1xuICBcbiAgLyoqIFdlYkFwcFN0YWNr6Kit5a6a77yIVlBDIEVuZHBvaW505L2c5oiQ5pmC44Gr5Y+C54Wn77yJICovXG4gIHByaXZhdGUgcmVhZG9ubHkgY29uZmlnOiBXZWJBcHBTdGFja0NvbmZpZztcbiAgXG4gIC8qKiBQaGFzZSA0OiBBZ2VudENvcmUgQ29uc3RydWN0c++8iOOCquODl+OCt+ODp+ODs++8iSAqL1xuICBwdWJsaWMgYWdlbnRDb3JlUnVudGltZT86IEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN0O1xuICBwdWJsaWMgYWdlbnRDb3JlR2F0ZXdheT86IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0O1xuICBwdWJsaWMgYWdlbnRDb3JlTWVtb3J5PzogQmVkcm9ja0FnZW50Q29yZU1lbW9yeUNvbnN0cnVjdDtcbiAgcHVibGljIGFnZW50Q29yZUJyb3dzZXI/OiBCZWRyb2NrQWdlbnRDb3JlQnJvd3NlckNvbnN0cnVjdDtcbiAgcHVibGljIGFnZW50Q29yZUNvZGVJbnRlcnByZXRlcj86IEJlZHJvY2tBZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXJDb25zdHJ1Y3Q7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFdlYkFwcFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIOioreWumuOCkuS/neWtmO+8iFZQQyBFbmRwb2ludOS9nOaIkOaZguOBq+WPgueFp++8iVxuICAgIHRoaXMuY29uZmlnID0gcHJvcHMuY29uZmlnO1xuXG4gICAgY29uc3QgeyBcbiAgICAgIGNvbmZpZywgXG4gICAgICBzdGFuZGFsb25lTW9kZSA9IHRydWUsIC8vIOODh+ODleOCqeODq+ODiOOBr+OCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODiVxuICAgICAgZXhpc3RpbmdWcGNJZCxcbiAgICAgIGV4aXN0aW5nU2VjdXJpdHlHcm91cElkLFxuICAgICAgbmV0d29ya2luZ1N0YWNrLFxuICAgICAgc2VjdXJpdHlTdGFjayxcbiAgICAgIHNraXBMYW1iZGFDcmVhdGlvbiA9IGZhbHNlLFxuICAgICAgZG9ja2VyUGF0aCA9IERFRkFVTFRfV0VCQVBQX0NPTkZJRy5kb2NrZXJQYXRoLFxuICAgICAgaW1hZ2VUYWcsIC8vIGltYWdlVGFn44Gv5b+F6aCI44OR44Op44Oh44O844K/77yI44OH44OV44Kp44Or44OI5YCk44Gq44GX77yJXG4gICAgICBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbFxuICAgIH0gPSBwcm9wcztcbiAgICBcbiAgICAvLyDnkrDlooPliKXjg6rjgr3jg7zjgrnliLblvqHjga7oqK3lrprvvIjjg4fjg5Xjgqnjg6vjg4jlgKTvvIlcbiAgICBjb25zdCByZXNvdXJjZUNvbnRyb2wgPSB7XG4gICAgICBjcmVhdGVMYW1iZGFGdW5jdGlvbjogZW52aXJvbm1lbnRSZXNvdXJjZUNvbnRyb2w/LmNyZWF0ZUxhbWJkYUZ1bmN0aW9uID8/IHRydWUsXG4gICAgICBjcmVhdGVDbG91ZEZyb250RGlzdHJpYnV0aW9uOiBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbD8uY3JlYXRlQ2xvdWRGcm9udERpc3RyaWJ1dGlvbiA/PyB0cnVlLFxuICAgICAgZW5hYmxlQmVkcm9ja0FnZW50OiBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbD8uZW5hYmxlQmVkcm9ja0FnZW50ID8/IChjb25maWcuYmVkcm9ja0FnZW50Py5lbmFibGVkID8/IGZhbHNlKSxcbiAgICAgIGVuYWJsZVBlcm1pc3Npb25BcGk6IGVudmlyb25tZW50UmVzb3VyY2VDb250cm9sPy5lbmFibGVQZXJtaXNzaW9uQXBpID8/IChjb25maWcucGVybWlzc2lvbkFwaT8uZW5hYmxlZCA/PyBmYWxzZSksXG4gICAgICBlbmFibGVBZ2VudENvcmU6IGVudmlyb25tZW50UmVzb3VyY2VDb250cm9sPy5lbmFibGVBZ2VudENvcmUgPz8gKGNvbmZpZy5hZ2VudENvcmUgPyB0cnVlIDogZmFsc2UpLFxuICAgICAgdmFsaWRhdGVDb25maWd1cmF0aW9uOiBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbD8udmFsaWRhdGVDb25maWd1cmF0aW9uID8/IHRydWUsXG4gICAgfTtcbiAgICBcbiAgICAvLyDoqK3lrprmpJzoqLzvvIjnkrDlooPliKXliLblvqHvvIlcbiAgICBpZiAocmVzb3VyY2VDb250cm9sLnZhbGlkYXRlQ29uZmlndXJhdGlvbikge1xuICAgICAgdGhpcy52YWxpZGF0ZUVudmlyb25tZW50Q29uZmlndXJhdGlvbihjb25maWcsIHByb3BzLmVudmlyb25tZW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gaW1hZ2VUYWfjga7mpJzoqLzvvIjlv4XpoIjjg5Hjg6njg6Hjg7zjgr/vvIlcbiAgICBpZiAoIWltYWdlVGFnICYmICFza2lwTGFtYmRhQ3JlYXRpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ+KdjCBpbWFnZVRhZyBpcyByZXF1aXJlZCEgUGxlYXNlIHByb3ZpZGUgaW1hZ2VUYWcgdmlhOlxcbicgK1xuICAgICAgICAnICAgMS4gQ0RLIGNvbnRleHQ6IG5weCBjZGsgZGVwbG95IC1jIGltYWdlVGFnPVlPVVJfVEFHXFxuJyArXG4gICAgICAgICcgICAyLiBQcm9wczogbmV3IFdlYkFwcFN0YWNrKHNjb3BlLCBpZCwgeyBpbWFnZVRhZzogXCJZT1VSX1RBR1wiLCAuLi4gfSlcXG4nICtcbiAgICAgICAgJyAgIDMuIEVudmlyb25tZW50IHZhcmlhYmxlOiBleHBvcnQgSU1BR0VfVEFHPVlPVVJfVEFHJ1xuICAgICAgKTtcbiAgICB9XG4gICAgXG4gICAgLy8g6Kit5a6a5YCk44Gu5Y+W5b6X77yI44OH44OV44Kp44Or44OI5YCk44KS5L2/55So77yJXG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb25maWcubmFtaW5nPy5wcm9qZWN0TmFtZSB8fCBERUZBVUxUX1dFQkFQUF9DT05GSUcucHJvamVjdE5hbWU7XG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSBjb25maWcubmFtaW5nPy5lbnZpcm9ubWVudCB8fCBERUZBVUxUX1dFQkFQUF9DT05GSUcuZW52aXJvbm1lbnQ7XG4gICAgY29uc3QgcmVnaW9uUHJlZml4ID0gY29uZmlnLm5hbWluZz8ucmVnaW9uUHJlZml4IHx8IERFRkFVTFRfV0VCQVBQX0NPTkZJRy5yZWdpb25QcmVmaXg7XG5cbiAgICBjb25zb2xlLmxvZygn8J+agCBXZWJBcHBTdGFjayAoRnVsbCkg5Yid5pyf5YyW6ZaL5aeLLi4uJyk7XG4gICAgY29uc29sZS5sb2coYCAgIOODl+ODreOCuOOCp+OCr+ODiOWQjTogJHtwcm9qZWN0TmFtZX1gKTtcbiAgICBjb25zb2xlLmxvZyhgICAg55Kw5aKDOiAke2Vudmlyb25tZW50fWApO1xuICAgIGNvbnNvbGUubG9nKGAgICDjg6rjg7zjgrjjg6fjg7Pjg5fjg6zjg5XjgqPjg4Pjgq/jgrk6ICR7cmVnaW9uUHJlZml4fWApO1xuICAgIGNvbnNvbGUubG9nKGAgICDjg4fjg5fjg63jgqTjg6Ljg7zjg4k6ICR7c3RhbmRhbG9uZU1vZGUgPyAn44K544K/44Oz44OJ44Ki44Ot44O844OzJyA6ICfntbHlkIgnfWApO1xuICAgIGNvbnNvbGUubG9nKGAgICBEb2NrZXLjg5Hjgrk6ICR7ZG9ja2VyUGF0aH1gKTtcbiAgICBjb25zb2xlLmxvZyhgICAg44Kk44Oh44O844K444K/44KwOiAke2ltYWdlVGFnIHx8ICdOL0EgKExhbWJkYeS9nOaIkOOCueOCreODg+ODlyknfWApO1xuICAgIGlmIChza2lwTGFtYmRhQ3JlYXRpb24pIHtcbiAgICAgIGNvbnNvbGUubG9nKCcgICDimqDvuI8gIExhbWJkYemWouaVsOS9nOaIkOOCkuOCueOCreODg+ODl++8iEVDUuOCpOODoeODvOOCuOacqua6luWCme+8iScpO1xuICAgIH1cbiAgICBpZiAoc3RhbmRhbG9uZU1vZGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCcgICDwn5OmIOOCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODiTog5LuW44GuU3RhY2vjgavkvp3lrZjjgZfjgb7jgZvjgpMnKTtcbiAgICAgIGlmIChleGlzdGluZ1ZwY0lkKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgICDwn5SXIOaXouWtmFZQQ+WPgueFpzogJHtleGlzdGluZ1ZwY0lkfWApO1xuICAgICAgfVxuICAgICAgaWYgKGV4aXN0aW5nU2VjdXJpdHlHcm91cElkKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgICDwn5SXIOaXouWtmOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+WPgueFpzogJHtleGlzdGluZ1NlY3VyaXR5R3JvdXBJZH1gKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJyAgIPCflJcg57Wx5ZCI44Oi44O844OJOiDku5bjga5TdGFja+OBqOmAo+aQuuOBl+OBvuOBmScpO1xuICAgIH1cblxuICAgIC8vIOODouODvOODieWIpOWumuOBqOODquOCveODvOOCueOCu+ODg+ODiOOCouODg+ODl1xuICAgIGlmIChzdGFuZGFsb25lTW9kZSkge1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNldHVwSW50ZWdyYXRlZFJlc291cmNlcyhuZXR3b3JraW5nU3RhY2ssIHNlY3VyaXR5U3RhY2spO1xuICAgIH1cblxuICAgIC8vIEVDUuODquODneOCuOODiOODquOBruWPgueFp++8iOaXouWtmOODquODneOCuOODiOODquOCkuS9v+eUqO+8iVxuICAgIC8vIOazqOaEjzogZnJvbVJlcG9zaXRvcnlOYW1lKCnjga9DREvlkIjmiJDmmYLjgavkvovlpJbjgpLmipXjgZLjgarjgYTjgZ/jgoHjgIF0cnktY2F0Y2jjga/kuI3opoFcbiAgICAvLyDjg6rjg53jgrjjg4jjg6rjgYzlrZjlnKjjgZfjgarjgYTloLTlkIjjga/jgIHjg4fjg5fjg63jgqTmmYLjgavjgqjjg6njg7zjgavjgarjgotcbiAgICBjb25zdCByZXBvc2l0b3J5TmFtZSA9IGAke3JlZ2lvblByZWZpeC50b0xvd2VyQ2FzZSgpfS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS13ZWJhcHAtcmVwb2A7XG4gICAgXG4gICAgdGhpcy5lY3JSZXBvc2l0b3J5ID0gZWNyLlJlcG9zaXRvcnkuZnJvbVJlcG9zaXRvcnlOYW1lKFxuICAgICAgdGhpcyxcbiAgICAgICdXZWJBcHBSZXBvc2l0b3J5JyxcbiAgICAgIHJlcG9zaXRvcnlOYW1lXG4gICAgKTtcbiAgICBjb25zb2xlLmxvZyhg4pyFIOaXouWtmEVDUuODquODneOCuOODiOODquOCkuWPgueFpzogJHtyZXBvc2l0b3J5TmFtZX1gKTtcblxuICAgIC8vIER5bmFtb0RCIGFjY2VzcyAoaWYgbmVlZGVkKSAtIOOCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODieOBp+OCgui/veWKoOWPr+iDvVxuICAgIGlmICghc2tpcExhbWJkYUNyZWF0aW9uICYmIHRoaXMuZXhlY3V0aW9uUm9sZSAmJiBjb25maWcuZGF0YWJhc2U/LmR5bmFtb2RiPy5lbmFibGVkKSB7XG4gICAgICBjb25zdCBkeW5hbW9kYlJlc291cmNlcyA9IGNvbmZpZy5kYXRhYmFzZS5keW5hbW9kYi50YWJsZUFybnMgfHwgWycqJ107XG4gICAgICB0aGlzLmV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnZHluYW1vZGI6R2V0SXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlB1dEl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpVcGRhdGVJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6RGVsZXRlSXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlF1ZXJ5JyxcbiAgICAgICAgICAnZHluYW1vZGI6U2NhbicsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogZHluYW1vZGJSZXNvdXJjZXMsXG4gICAgICB9KSk7XG4gICAgICBcbiAgICAgIGlmIChkeW5hbW9kYlJlc291cmNlc1swXSA9PT0gJyonKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCfimqDvuI8gIER5bmFtb0RC44Ki44Kv44K744K5OiDlhajjg4bjg7zjg5bjg6vvvIjmnKznlarnkrDlooPjgafjga/nibnlrprjga7jg4bjg7zjg5bjg6tBUk7jgpLmjIflrprjgZfjgabjgY/jgaDjgZXjgYTvvIknKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDinIUgRHluYW1vRELjgqLjgq/jgrvjgrk6ICR7ZHluYW1vZGJSZXNvdXJjZXMubGVuZ3RofeWAi+OBruODhuODvOODluODq+OBq+WItumZkGApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOapn+iDveW+qeaXp+eUqER5bmFtb0RC44OG44O844OW44Or44G444Gu44Ki44Kv44K744K55qip6ZmQ77yIUGhhc2UgMeWujOS6hua4iOOBv+apn+iDve+8iVxuICAgIGlmICghc2tpcExhbWJkYUNyZWF0aW9uICYmIHRoaXMuZXhlY3V0aW9uUm9sZSkge1xuICAgICAgY29uc29sZS5sb2coJ/CflJAg5qmf6IO95b6p5pen55SoRHluYW1vRELjg4bjg7zjg5bjg6vjgqLjgq/jgrvjgrnmqKnpmZDjgpLov73liqDkuK0uLi4nKTtcbiAgICAgIFxuICAgICAgLy8g44K744OD44K344On44Oz566h55CG44CB44Om44O844K244O86Kit5a6a44CB44OB44Oj44OD44OI5bGl5q2044CB5YuV55qE6Kit5a6a44Kt44Oj44OD44K344Ol44OG44O844OW44Or44G444Gu44Ki44Kv44K744K5XG4gICAgICBjb25zdCBmZWF0dXJlUmVzdG9yYXRpb25UYWJsZXMgPSBbXG4gICAgICAgIGBhcm46YXdzOmR5bmFtb2RiOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0YWJsZS9wZXJtaXNzaW9uLWF3YXJlLXJhZy1zZXNzaW9uc2AsXG4gICAgICAgIGBhcm46YXdzOmR5bmFtb2RiOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0YWJsZS9wZXJtaXNzaW9uLWF3YXJlLXJhZy1zZXNzaW9ucy9pbmRleC8qYCxcbiAgICAgICAgYGFybjphd3M6ZHluYW1vZGI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRhYmxlL3Blcm1pc3Npb24tYXdhcmUtcmFnLXVzZXItcHJlZmVyZW5jZXNgLFxuICAgICAgICBgYXJuOmF3czpkeW5hbW9kYjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dGFibGUvcGVybWlzc2lvbi1hd2FyZS1yYWctdXNlci1wcmVmZXJlbmNlcy9pbmRleC8qYCxcbiAgICAgICAgYGFybjphd3M6ZHluYW1vZGI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRhYmxlL3Blcm1pc3Npb24tYXdhcmUtcmFnLWNoYXQtaGlzdG9yeWAsXG4gICAgICAgIGBhcm46YXdzOmR5bmFtb2RiOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0YWJsZS9wZXJtaXNzaW9uLWF3YXJlLXJhZy1jaGF0LWhpc3RvcnkvaW5kZXgvKmAsXG4gICAgICAgIGBhcm46YXdzOmR5bmFtb2RiOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0YWJsZS9wZXJtaXNzaW9uLWF3YXJlLXJhZy1kaXNjb3ZlcnktY2FjaGVgLFxuICAgICAgICBgYXJuOmF3czpkeW5hbW9kYjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dGFibGUvcGVybWlzc2lvbi1hd2FyZS1yYWctZGlzY292ZXJ5LWNhY2hlL2luZGV4LypgLFxuICAgICAgXTtcblxuICAgICAgdGhpcy5leGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2R5bmFtb2RiOkdldEl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpQdXRJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6VXBkYXRlSXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOkRlbGV0ZUl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpRdWVyeScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlNjYW4nLFxuICAgICAgICAgICdkeW5hbW9kYjpCYXRjaEdldEl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpCYXRjaFdyaXRlSXRlbScsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogZmVhdHVyZVJlc3RvcmF0aW9uVGFibGVzLFxuICAgICAgfSkpO1xuXG4gICAgICBjb25zb2xlLmxvZygn4pyFIOapn+iDveW+qeaXp+eUqER5bmFtb0RC44OG44O844OW44Or44Ki44Kv44K744K55qip6ZmQ6L+95Yqg5a6M5LqGJyk7XG4gICAgICBjb25zb2xlLmxvZyhgICAgLSDjgrvjg4Pjgrfjg6fjg7PnrqHnkIbjg4bjg7zjg5bjg6s6IHBlcm1pc3Npb24tYXdhcmUtcmFnLXNlc3Npb25zYCk7XG4gICAgICBjb25zb2xlLmxvZyhgICAgLSDjg6bjg7zjgrbjg7zoqK3lrprjg4bjg7zjg5bjg6s6IHBlcm1pc3Npb24tYXdhcmUtcmFnLXVzZXItcHJlZmVyZW5jZXNgKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAtIOODgeODo+ODg+ODiOWxpeattOODhuODvOODluODqzogcGVybWlzc2lvbi1hd2FyZS1yYWctY2hhdC1oaXN0b3J5YCk7XG4gICAgICBjb25zb2xlLmxvZyhgICAgLSDli5XnmoToqK3lrprjgq3jg6Pjg4Pjgrfjg6Xjg4bjg7zjg5bjg6s6IHBlcm1pc3Npb24tYXdhcmUtcmFnLWRpc2NvdmVyeS1jYWNoZWApO1xuICAgIH1cblxuICAgIC8vIExhbWJkYSBGdW5jdGlvbu+8iOadoeS7tuS7mOOBjeS9nOaIkCAtIOeSsOWig+WIpeWItuW+oeWvvuW/nO+8iVxuICAgIGNvbnN0IHNob3VsZENyZWF0ZUxhbWJkYSA9ICFza2lwTGFtYmRhQ3JlYXRpb24gJiYgcmVzb3VyY2VDb250cm9sLmNyZWF0ZUxhbWJkYUZ1bmN0aW9uICYmIHRoaXMuZXhlY3V0aW9uUm9sZTtcbiAgICBpZiAoc2hvdWxkQ3JlYXRlTGFtYmRhKSB7XG4gICAgICAvLyBMYW1iZGEgVlBD6YWN572u6Kit5a6a44KS56K66KqNXG4gICAgICBjb25zdCBsYW1iZGFWcGNDb25maWcgPSAodGhpcy5jb25maWcgYXMgYW55KT8ud2ViYXBwPy5sYW1iZGE/LnZwYztcbiAgICAgIGNvbnN0IHNob3VsZFBsYWNlSW5WcGMgPSBsYW1iZGFWcGNDb25maWc/LmVuYWJsZWQgPT09IHRydWU7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGDwn5SNIExhbWJkYSBWUEPoqK3lrprjg4Hjgqfjg4Pjgq86YCk7XG4gICAgICBjb25zb2xlLmxvZyhgICAgLSBzdGFuZGFsb25lTW9kZTogJHtzdGFuZGFsb25lTW9kZX1gKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAtIGxhbWJkYS52cGMuZW5hYmxlZDogJHtzaG91bGRQbGFjZUluVnBjfWApO1xuICAgICAgY29uc29sZS5sb2coYCAgIC0gdnBjOiAkeyEhdGhpcy52cGN9YCk7XG4gICAgICBjb25zb2xlLmxvZyhgICAgLSBzZWN1cml0eUdyb3VwOiAkeyEhdGhpcy5zZWN1cml0eUdyb3VwfWApO1xuICAgICAgXG4gICAgICAvLyBWUEPoqK3lrprjgpLmp4vnr4lcbiAgICAgIGNvbnN0IHZwY0NvbmZpZyA9IHNob3VsZFBsYWNlSW5WcGMgJiYgdGhpcy52cGMgJiYgdGhpcy5zZWN1cml0eUdyb3VwID8ge1xuICAgICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgICBzZWN1cml0eUdyb3VwczogW3RoaXMuc2VjdXJpdHlHcm91cF0sXG4gICAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICB9LFxuICAgICAgfSA6IHt9O1xuICAgICAgXG4gICAgICBpZiAoc2hvdWxkUGxhY2VJblZwYyAmJiBPYmplY3Qua2V5cyh2cGNDb25maWcpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+KaoO+4jyAgTGFtYmRhIFZQQ+mFjee9ruOBjOacieWKueOBp+OBmeOBjOOAgVZQQ+OBvuOBn+OBr+OCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OBjOimi+OBpOOBi+OCiuOBvuOBm+OCkycpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhg8J+UjSB2cGNDb25maWfoqK3lrpo6ICR7T2JqZWN0LmtleXModnBjQ29uZmlnKS5sZW5ndGggPiAwID8gJ1ZQQ+WGheOBq+mFjee9ricgOiAnVlBD5aSW44Gr6YWN572uJ31gKTtcblxuICAgICAgdGhpcy53ZWJBcHBGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1dlYkFwcEZ1bmN0aW9uJywge1xuICAgICAgICBmdW5jdGlvbk5hbWU6IGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tV2ViQXBwLUZ1bmN0aW9uYCxcbiAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuRlJPTV9JTUFHRSxcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUVjckltYWdlKHRoaXMuZWNyUmVwb3NpdG9yeSwge1xuICAgICAgICAgIHRhZ09yRGlnZXN0OiBpbWFnZVRhZyxcbiAgICAgICAgfSksXG4gICAgICAgIGhhbmRsZXI6IGxhbWJkYS5IYW5kbGVyLkZST01fSU1BR0UsXG4gICAgICAgIHJvbGU6IHRoaXMuZXhlY3V0aW9uUm9sZSxcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoY29uZmlnLmNvbXB1dGU/LmxhbWJkYT8udGltZW91dCB8fCAzMCksXG4gICAgICAgIG1lbW9yeVNpemU6IGNvbmZpZy5jb21wdXRlPy5sYW1iZGE/Lm1lbW9yeVNpemUgfHwgNTEyLFxuICAgICAgICAuLi52cGNDb25maWcsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgTk9ERV9FTlY6ICdwcm9kdWN0aW9uJyxcbiAgICAgICAgICBCRURST0NLX1JFR0lPTjogY29uZmlnLmFpPy5iZWRyb2NrPy5yZWdpb24gfHwgJ3VzLWVhc3QtMScsXG4gICAgICAgICAgQVdTX0xXQV9JTlZPS0VfTU9ERTogJ3Jlc3BvbnNlX3N0cmVhbScsXG4gICAgICAgICAgQVdTX0xXQV9QT1JUOiAnMzAwMCcsXG4gICAgICAgICAgUlVTVF9MT0c6ICdpbmZvJyxcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDmqZ/og73lvqnml6fnlKhEeW5hbW9EQuODhuODvOODluODq++8iFBoYXNlIDHlrozkuobmuIjjgb/vvIlcbiAgICAgICAgICBTRVNTSU9OX1RBQkxFX05BTUU6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZy1zZXNzaW9ucycsIC8vIOOCu+ODg+OCt+ODp+ODs+euoeeQhuODhuODvOODluODq1xuICAgICAgICAgIFBSRUZFUkVOQ0VTX1RBQkxFX05BTUU6IHByb3BzLmRhdGFTdGFjaz8udXNlclByZWZlcmVuY2VzVGFibGU/LnRhYmxlTmFtZSB8fCAncGVybWlzc2lvbi1hd2FyZS1yYWctcHJlZmVyZW5jZXMnLCAvLyDjg6bjg7zjgrbjg7zoqK3lrprjg4bjg7zjg5bjg6vvvIhUYXNrIDMuMu+8iVxuICAgICAgICAgIENIQVRfSElTVE9SWV9UQUJMRV9OQU1FOiBwcm9wcy5kYXRhU3RhY2s/LmNoYXRIaXN0b3J5VGFibGU/LnRhYmxlTmFtZSB8fCAncGVybWlzc2lvbi1hd2FyZS1yYWctY2hhdC1oaXN0b3J5JyxcbiAgICAgICAgICBESVNDT1ZFUllfQ0FDSEVfVEFCTEVfTkFNRTogJ3Blcm1pc3Npb24tYXdhcmUtcmFnLWRpc2NvdmVyeS1jYWNoZScsIC8vIOWLleeahOioreWumuOCreODo+ODg+OCt+ODpeODhuODvOODluODq1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIEpXVOiqjeiovOioreWumu+8iFBoYXNlIDHlrozkuobmuIjjgb/vvIlcbiAgICAgICAgICBKV1RfU0VDUkVUOiAneW91ci1zdXBlci1zZWNyZXQtand0LWtleS1jaGFuZ2UtaW4tcHJvZHVjdGlvbi0yMDI0JyxcbiAgICAgICAgICBKV1RfRVhQSVJFU19JTjogJzdkJyxcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBCZWRyb2NrIEFnZW505oOF5aCx77yI5pei5a2Y77yJXG4gICAgICAgICAgQkVEUk9DS19BR0VOVF9JRDogdGhpcy5iZWRyb2NrQWdlbnQ/LmF0dHJBZ2VudElkIHx8ICcxTldRSlRJTUFIJyxcbiAgICAgICAgICBCRURST0NLX0FHRU5UX0FMSUFTX0lEOiB0aGlzLmJlZHJvY2tBZ2VudEFsaWFzPy5hdHRyQWdlbnRBbGlhc0lkIHx8ICdUU1RBTElBU0lEJyxcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBQZXJtaXNzaW9uIEFQSeeUqER5bmFtb0RC44OG44O844OW44Or77yI5pei5a2Y77yJXG4gICAgICAgICAgRFlOQU1PREJfVEFCTEVfTkFNRTogcHJvcHMudXNlckFjY2Vzc1RhYmxlPy50YWJsZU5hbWUgfHwgJycsXG4gICAgICAgICAgUEVSTUlTU0lPTl9DQUNIRV9UQUJMRV9OQU1FOiBwcm9wcy5wZXJtaXNzaW9uQ2FjaGVUYWJsZT8udGFibGVOYW1lIHx8ICcnLFxuICAgICAgICAgIFxuICAgICAgICAgIC8vIOWkmuiogOiqnuWvvuW/nOioreWumu+8iFBoYXNlIDLmupblgpnvvIlcbiAgICAgICAgICBERUZBVUxUX0xPQ0FMRTogJ2phJyxcbiAgICAgICAgICBTVVBQT1JURURfTE9DQUxFUzogJ2phLGVuLGtvLHpoLUNOLHpoLVRXLGVzLGZyLGRlJyxcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDli5XnmoTjg6Ljg4fjg6vmpJzlh7roqK3lrprvvIhQaGFzZSAy5rqW5YKZ77yJXG4gICAgICAgICAgTU9ERUxfRElTQ09WRVJZX0VOQUJMRUQ6ICd0cnVlJyxcbiAgICAgICAgICBNT0RFTF9DQUNIRV9UVEw6ICczNjAwJywgLy8gMeaZgumWk1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIOODkeODleOCqeODvOODnuODs+OCueioreWumu+8iFBoYXNlIDXmupblgpnvvIlcbiAgICAgICAgICBFTkFCTEVfQ0FDSElORzogJ3RydWUnLFxuICAgICAgICAgIENBQ0hFX1RUTDogJzMwMCcsIC8vIDXliIZcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPoqK3lrprvvIhQaGFzZSAx5a6M5LqG5riI44G/77yJXG4gICAgICAgICAgRU5BQkxFX0NTUkZfUFJPVEVDVElPTjogJ3RydWUnLFxuICAgICAgICAgIFNFQ1VSRV9DT09LSUVTOiAndHJ1ZScsXG4gICAgICAgICAgXG4gICAgICAgICAgLy8g44Ot44Kw44Os44OZ44Or6Kit5a6aXG4gICAgICAgICAgTE9HX0xFVkVMOiAnaW5mbycsXG4gICAgICAgIH0sXG4gICAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgTGFtYmRh6Zai5pWw5L2c5oiQ5a6M5LqGJyk7XG5cbiAgICAgIC8vIExhbWJkYSBGdW5jdGlvbiBVUkxcbiAgICAgIHRoaXMuZnVuY3Rpb25VcmwgPSB0aGlzLndlYkFwcEZ1bmN0aW9uLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICAgIGNvcnM6IHtcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtsYW1iZGEuSHR0cE1ldGhvZC5BTExdLFxuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgICBtYXhBZ2U6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICB9LFxuICAgICAgICBpbnZva2VNb2RlOiBsYW1iZGEuSW52b2tlTW9kZS5SRVNQT05TRV9TVFJFQU0sXG4gICAgICB9KTtcblxuICAgICAgLy8gQ2xvdWRGcm9udCBEaXN0cmlidXRpb27vvIjnkrDlooPliKXliLblvqHlr77lv5zvvIlcbiAgICAgIGlmIChyZXNvdXJjZUNvbnRyb2wuY3JlYXRlQ2xvdWRGcm9udERpc3RyaWJ1dGlvbikge1xuICAgICAgICAvLyDms6jmhI86IExhbWJkYSBGdW5jdGlvbiBVUkzjgpJPcmlnaW7jgajjgZfjgabkvb/nlKjjgZnjgovloLTlkIjjgIFcbiAgICAgICAgLy8gQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVLjgpLkvb/nlKjjgZnjgovlv4XopoHjgYzjgYLjgorjgb7jgZnjgIJcbiAgICAgICAgLy8gQUxMX1ZJRVdFUuOCkuS9v+eUqOOBmeOCi+OBqOOAgUNsb3VkRnJvbnTjga5Ib3N044OY44OD44OA44O844GMTGFtYmRh44Gr6Lui6YCB44GV44KM44CBXG4gICAgICAgIC8vIExhbWJkYSBGdW5jdGlvbiBVUkzjgYzjg5vjgrnjg4jlkI3jgpLoqo3orZjjgafjgY3jgZo0MDPjgqjjg6njg7zjgYznmbrnlJ/jgZfjgb7jgZnjgIJcbiAgICAgICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ1dlYkFwcERpc3RyaWJ1dGlvbicsIHtcbiAgICAgICAgICBjb21tZW50OiBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVdlYkFwcC1EaXN0cmlidXRpb25gLFxuICAgICAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5IdHRwT3JpZ2luKGNkay5Gbi5zZWxlY3QoMiwgY2RrLkZuLnNwbGl0KCcvJywgdGhpcy5mdW5jdGlvblVybC51cmwpKSksXG4gICAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgICAgLy8gMjAyNi0wMS0xNDogQ2hhbmdlZCB0byBBTExfVklFV0VSIHRvIGZvcndhcmQgYWxsIGhlYWRlcnMgaW5jbHVkaW5nIEhvc3QgaGVhZGVyXG4gICAgICAgICAgICAvLyBUaGlzIGZpeGVzIEFnZW50IG1vZGUgZXJyb3JzIGNhdXNlZCBieSBtaXNzaW5nIGhlYWRlcnNcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJpY2VDbGFzczogY2xvdWRmcm9udC5QcmljZUNsYXNzLlBSSUNFX0NMQVNTXzIwMCxcbiAgICAgICAgICBlbmFibGVMb2dnaW5nOiBmYWxzZSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCfinIUgQ2xvdWRGcm9udOmFjeS/oeS9nOaIkOWujOS6hicpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ+KaoO+4jyAgQ2xvdWRGcm9udOmFjeS/oeS9nOaIkOOCkuOCueOCreODg+ODl++8iOeSsOWig+WIpeWItuW+oe+8iScpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBEeW5hbW9EQuOCouOCr+OCu+OCueaoqemZkOOBruS7mOS4jlxuICAgICAgaWYgKHByb3BzLmRhdGFTdGFjaz8uY2hhdEhpc3RvcnlUYWJsZSkge1xuICAgICAgICBwcm9wcy5kYXRhU3RhY2suY2hhdEhpc3RvcnlUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy53ZWJBcHBGdW5jdGlvbik7XG4gICAgICAgIGNvbnNvbGUubG9nKCfinIUgQ2hhdEhpc3RvcnlUYWJsZeOBuOOBruOCouOCr+OCu+OCueaoqemZkOS7mOS4juWujOS6hicpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBVc2VyUHJlZmVyZW5jZXPjg4bjg7zjg5bjg6vjgbjjga7jgqLjgq/jgrvjgrnmqKnpmZDku5jkuI7vvIhUYXNrIDMuMu+8iVxuICAgICAgaWYgKHByb3BzLmRhdGFTdGFjaz8udXNlclByZWZlcmVuY2VzVGFibGUpIHtcbiAgICAgICAgcHJvcHMuZGF0YVN0YWNrLnVzZXJQcmVmZXJlbmNlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLndlYkFwcEZ1bmN0aW9uKTtcbiAgICAgICAgY29uc29sZS5sb2coJ+KchSBVc2VyUHJlZmVyZW5jZXNUYWJsZeOBuOOBruOCouOCr+OCu+OCueaoqemZkOS7mOS4juWujOS6hicpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygn4pyFIExhbWJkYemWouaVsOODu0Nsb3VkRnJvbnTkvZzmiJDlrozkuoYnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ+KaoO+4jyAgTGFtYmRh6Zai5pWw44O7Q2xvdWRGcm9udOS9nOaIkOOCkuOCueOCreODg+ODlycpO1xuICAgICAgY29uc29sZS5sb2coJyAgIOasoeOBruOCueODhuODg+ODlzonKTtcbiAgICAgIGNvbnNvbGUubG9nKCcgICAxLiBFQ1LjgatOZXh0Lmpz44Kk44Oh44O844K444KS44OX44OD44K344OlJyk7XG4gICAgICBjb25zb2xlLmxvZygnICAgMi4gc2tpcExhbWJkYUNyZWF0aW9uPWZhbHNl44Gn5YaN44OH44OX44Ot44KkJyk7XG4gICAgfVxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIOWHuuWKm+WApOOBruWumue+qe+8iFVTLTIuMeimgeS7tu+8iVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBcbiAgICAvLyAxLiBFQ1Ljg6rjg53jgrjjg4jjg6pVUknvvIjlv4XpoIjvvIlcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRUNSUmVwb3NpdG9yeVVyaScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmVjclJlcG9zaXRvcnkucmVwb3NpdG9yeVVyaSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRUNSIFJlcG9zaXRvcnkgVVJJIC0g44Kz44Oz44OG44OK44Kk44Oh44O844K444Gu44OX44OD44K344Ol5YWIJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1FQ1JSZXBvc2l0b3J5VXJpYCxcbiAgICB9KTtcbiAgICBcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRUNSUmVwb3NpdG9yeU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5lY3JSZXBvc2l0b3J5LnJlcG9zaXRvcnlOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdFQ1IgUmVwb3NpdG9yeSBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1FQ1JSZXBvc2l0b3J5TmFtZWAsXG4gICAgfSk7XG4gICAgXG4gICAgLy8gMi4gQVBJIEdhdGV3YXkgVVJM77yITGFtYmRhIEZ1bmN0aW9uIFVSTOOBp+S7o+abv++8iVxuICAgIC8vIOazqDog54++5Zyo44Gu5a6f6KOF44Gn44GvTGFtYmRhIEZ1bmN0aW9uIFVSTOOCkuS9v+eUqFxuICAgIC8vIOWwhuadpeeahOOBq0FQSSBHYXRld2F544Gr56e76KGM44GZ44KL5aC05ZCI44Gv44CB44GT44Gu44K744Kv44K344On44Oz44KS5pu05pawXG4gICAgaWYgKCFza2lwTGFtYmRhQ3JlYXRpb24gJiYgdGhpcy5mdW5jdGlvblVybCkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaVVybCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZnVuY3Rpb25VcmwudXJsLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FQSSBVUkwgKExhbWJkYSBGdW5jdGlvbiBVUkwpIC0g44OQ44OD44Kv44Ko44Oz44OJQVBJ44Ko44Oz44OJ44Od44Kk44Oz44OIJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFwaVVybGAsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Z1bmN0aW9uVXJsJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5mdW5jdGlvblVybC51cmwsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIEZ1bmN0aW9uIFVSTCAtIOebtOaOpeOCouOCr+OCu+OCueeUqCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1GdW5jdGlvblVybGAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyAzLiBDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBVUkzvvIjlv4XpoIjvvIlcbiAgICBpZiAoIXNraXBMYW1iZGFDcmVhdGlvbiAmJiB0aGlzLmRpc3RyaWJ1dGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnRVcmwnLCB7XG4gICAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBVUkwgLSDjg5Xjg63jg7Pjg4jjgqjjg7Pjg4njgqLjgq/jgrvjgrnnlKjvvIjmjqjlpajvvIknLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQ2xvdWRGcm9udFVybGAsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnREaXN0cmlidXRpb25JZCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIElEIC0g44Kt44Oj44OD44K344Ol54Sh5Yq55YyW55SoJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUNsb3VkRnJvbnREaXN0cmlidXRpb25JZGAsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnREb21haW5OYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERvbWFpbiBOYW1lJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUNsb3VkRnJvbnREb21haW5OYW1lYCxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyA0LiBMYW1iZGHplqLmlbDmg4XloLHvvIjjg4fjg5Djg4PjgrDjg7vnm6PoppbnlKjvvIlcbiAgICBpZiAoIXNraXBMYW1iZGFDcmVhdGlvbiAmJiB0aGlzLndlYkFwcEZ1bmN0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTGFtYmRhRnVuY3Rpb25OYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy53ZWJBcHBGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIEZ1bmN0aW9uIE5hbWUgLSBDbG91ZFdhdGNoIExvZ3Pnorroqo3nlKgnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tTGFtYmRhRnVuY3Rpb25OYW1lYCxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTGFtYmRhRnVuY3Rpb25Bcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLndlYkFwcEZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBGdW5jdGlvbiBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tTGFtYmRhRnVuY3Rpb25Bcm5gLFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIDUuIOODh+ODl+ODreOCpOODouODvOODieaDheWgsVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEZXBsb3lNb2RlJywge1xuICAgICAgdmFsdWU6IHN0YW5kYWxvbmVNb2RlID8gJ3N0YW5kYWxvbmUnIDogJ2ludGVncmF0ZWQnLFxuICAgICAgZGVzY3JpcHRpb246ICfjg4fjg5fjg63jgqTjg6Ljg7zjg4kgLSDjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Mgb3Ig57Wx5ZCIJyxcbiAgICB9KTtcbiAgICBcbiAgICAvLyA2LiDjgrnjgr/jg4Pjgq/mg4XloLFcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU3RhY2tOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuc3RhY2tOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZvcm1hdGlvbiBTdGFjayBOYW1lJyxcbiAgICB9KTtcbiAgICBcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUmVnaW9uJywge1xuICAgICAgdmFsdWU6IHRoaXMucmVnaW9uLFxuICAgICAgZGVzY3JpcHRpb246ICfjg4fjg5fjg63jgqTjg6rjg7zjgrjjg6fjg7MnLFxuICAgIH0pO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCcnKTtcbiAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgIGNvbnNvbGUubG9nKCfwn5OLIOWHuuWKm+WApOOCteODnuODquODvCcpO1xuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgY29uc29sZS5sb2coYOKchSBFQ1Ljg6rjg53jgrjjg4jjg6pVUkk6ICR7dGhpcy5lY3JSZXBvc2l0b3J5LnJlcG9zaXRvcnlVcml9YCk7XG4gICAgaWYgKCFza2lwTGFtYmRhQ3JlYXRpb24gJiYgdGhpcy5mdW5jdGlvblVybCkge1xuICAgICAgY29uc29sZS5sb2coYOKchSBBUEkgVVJMOiAke3RoaXMuZnVuY3Rpb25VcmwudXJsfWApO1xuICAgIH1cbiAgICBpZiAoIXNraXBMYW1iZGFDcmVhdGlvbiAmJiB0aGlzLmRpc3RyaWJ1dGlvbikge1xuICAgICAgY29uc29sZS5sb2coYOKchSBDbG91ZEZyb250IFVSTDogaHR0cHM6Ly8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCk7XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG5cbiAgICAvLyBQZXJtaXNzaW9uIEFQSeapn+iDveOBrui/veWKoO+8iOeSsOWig+WIpeWItuW+oeWvvuW/nO+8iVxuICAgIGlmIChyZXNvdXJjZUNvbnRyb2wuZW5hYmxlUGVybWlzc2lvbkFwaSAmJiBwcm9wcy51c2VyQWNjZXNzVGFibGUgJiYgcHJvcHMucGVybWlzc2lvbkNhY2hlVGFibGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCcnKTtcbiAgICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgICBjb25zb2xlLmxvZygn8J+UkCBQZXJtaXNzaW9uIEFQSeapn+iDveOCkui/veWKoOS4rS4uLicpO1xuICAgICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICAgIFxuICAgICAgLy8g4pyFIFRlbXBvcmFyaWx5IGNvbW1lbnRlZCBvdXQgZm9yIGRlcGxveW1lbnRcbiAgICAgIGNvbnNvbGUubG9nKFwiY3JlYXRlUGVybWlzc2lvbkFwaVJlc291cmNlczogVGVtcG9yYXJpbHkgZGlzYWJsZWRcIik7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgUGVybWlzc2lvbiBBUEnmqZ/og73ov73liqDlrozkuoYnKTtcbiAgICB9IGVsc2UgaWYgKHJlc291cmNlQ29udHJvbC5lbmFibGVQZXJtaXNzaW9uQXBpKSB7XG4gICAgICBjb25zb2xlLmxvZygn4pqg77iPICBQZXJtaXNzaW9uIEFQSeapn+iDveOBjOacieWKueOBp+OBmeOBjOOAgUR5bmFtb0RC44OG44O844OW44Or44GM5o+Q5L6b44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgICBjb25zb2xlLmxvZygnICAgRGF0YVN0YWNr44GL44KJdXNlckFjY2Vzc1RhYmxl44GocGVybWlzc2lvbkNhY2hlVGFibGXjgpLmuKHjgZfjgabjgY/jgaDjgZXjgYQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ+KEue+4jyAgUGVybWlzc2lvbiBBUEnmqZ/og73jga/nhKHlirnljJbjgZXjgozjgabjgYTjgb7jgZnvvIjnkrDlooPliKXliLblvqHvvIknKTtcbiAgICB9XG5cbiAgICAvLyBCZWRyb2NrIEFnZW505qmf6IO944Gu6L+95Yqg77yI55Kw5aKD5Yil5Yi25b6h5a++5b+c77yJXG4gICAgaWYgKHJlc291cmNlQ29udHJvbC5lbmFibGVCZWRyb2NrQWdlbnQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCcnKTtcbiAgICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgICBjb25zb2xlLmxvZygn8J+kliBCZWRyb2NrIEFnZW505qmf6IO944KS6L+95Yqg5LitLi4uJyk7XG4gICAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgICAgXG4gICAgICAvLyDinIUgVGVtcG9yYXJpbHkgY29tbWVudGVkIG91dCBmb3IgZGVwbG95bWVudFxuICAgICAgY29uc29sZS5sb2coXCJjcmVhdGVCZWRyb2NrQWdlbnRSZXNvdXJjZXM6IFRlbXBvcmFyaWx5IGRpc2FibGVkXCIpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygn4pyFIEJlZHJvY2sgQWdlbnTmqZ/og73ov73liqDlrozkuoYnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ+KEue+4jyAgQmVkcm9jayBBZ2VudOapn+iDveOBr+eEoeWKueWMluOBleOCjOOBpuOBhOOBvuOBme+8iOeSsOWig+WIpeWItuW+oe+8iScpO1xuICAgIH1cblxuICAgIC8vIFBoYXNlIDQ6IEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCI77yI55Kw5aKD5Yil5Yi25b6h5a++5b+c77yJXG4gICAgaWYgKHJlc291cmNlQ29udHJvbC5lbmFibGVBZ2VudENvcmUgJiYgY29uZmlnLmFnZW50Q29yZSkge1xuICAgICAgY29uc29sZS5sb2coJycpO1xuICAgICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5qAIEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCI6ZaL5aeLLi4uJyk7XG4gICAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgICAgXG4gICAgICAvLyDinIUgVGVtcG9yYXJpbHkgY29tbWVudGVkIG91dCBmb3IgZGVwbG95bWVudFxuICAgICAgY29uc29sZS5sb2coXCJpbnRlZ3JhdGVBZ2VudENvcmVDb25zdHJ1Y3RzOiBUZW1wb3JhcmlseSBkaXNhYmxlZFwiKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coJ+KchSBBZ2VudENvcmUgQ29uc3RydWN0c+e1seWQiOWujOS6hicpO1xuICAgIH0gZWxzZSBpZiAoY29uZmlnLmFnZW50Q29yZSkge1xuICAgICAgY29uc29sZS5sb2coJ+KEue+4jyAgQWdlbnRDb3Jl5qmf6IO944Gv54Sh5Yq55YyW44GV44KM44Gm44GE44G+44GZ77yI55Kw5aKD5Yil5Yi25b6h77yJJyk7XG4gICAgfVxuXG4gICAgLy8gVGFnc1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnTW9kdWxlJywgJ1dlYkFwcCcpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRnJhbWV3b3JrJywgJ05leHQuanMnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0FkYXB0ZXInLCAnTGFtYmRhIFdlYiBBZGFwdGVyJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDRE4nLCAnQ2xvdWRGcm9udCcpO1xuICAgIGlmIChjb25maWcucGVybWlzc2lvbkFwaT8uZW5hYmxlZCkge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQZXJtaXNzaW9uQVBJJywgJ0VuYWJsZWQnKTtcbiAgICB9XG4gICAgaWYgKGNvbmZpZy5iZWRyb2NrQWdlbnQ/LmVuYWJsZWQpIHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQmVkcm9ja0FnZW50JywgJ0VuYWJsZWQnKTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIFdlYkFwcFN0YWNrIChGdWxsKSDliJ3mnJ/ljJblrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4nnlKjjg6rjgr3jg7zjgrnjgrvjg4Pjg4jjgqLjg4Pjg5dcbiAgICog5b+F6KaB44Gq44Oq44K944O844K544KS5Y+C54Wn44G+44Gf44Gv5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIHNldHVwU3RhbmRhbG9uZVJlc291cmNlcyhcbiAgICBleGlzdGluZ1ZwY0lkOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gICAgZXhpc3RpbmdTZWN1cml0eUdyb3VwSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcsXG4gICAgcmVnaW9uUHJlZml4OiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/Cfk6Yg44K544K/44Oz44OJ44Ki44Ot44O844Oz44Oi44O844OJOiDjg6rjgr3jg7zjgrnjgrvjg4Pjg4jjgqLjg4Pjg5fplovlp4suLi4nKTtcblxuICAgIC8vIFZQQ+OBruWPgueFp+OBvuOBn+OBr+S9nOaIkFxuICAgIGlmIChleGlzdGluZ1ZwY0lkKSB7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UlyDml6LlrZhWUEPjgpLlj4Lnhac6ICR7ZXhpc3RpbmdWcGNJZH1gKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMudnBjID0gZWMyLlZwYy5mcm9tTG9va3VwKHRoaXMsICdFeGlzdGluZ1ZwYycsIHtcbiAgICAgICAgICB2cGNJZDogZXhpc3RpbmdWcGNJZFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc29sZS5sb2coJ+KchSDml6LlrZhWUEPlj4LnhafmiJDlip8nKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOaXouWtmFZQQ+OBruWgtOWQiOOAgUR5bmFtb0RCIFZQQyBFbmRwb2ludOOCkuS9nOaIkO+8iOaXouOBq+WtmOWcqOOBmeOCi+WgtOWQiOOBr+OCueOCreODg+ODl++8iVxuICAgICAgICB0cnkge1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCfihLnvuI8gIER5bmFtb0RCIFZQQyBFbmRwb2ludOOBr+aXouOBq+WtmOWcqOOBmeOCi+OBi+OAgeS9nOaIkOOBp+OBjeOBvuOBm+OCk+OBp+OBl+OBnycpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+KaoO+4jyAg5pei5a2YVlBD44GM6KaL44Gk44GL44KK44G+44Gb44KT44CC5paw6KaPVlBD44KS5L2c5oiQ44GX44G+44GZ44CCJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn4aVIOaWsOimj1ZQQ+OCkuS9nOaIkO+8iOacgOWwj+ani+aIkO+8iScpO1xuICAgIH1cblxuICAgIC8vIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OBruWPgueFp+OBvuOBn+OBr+S9nOaIkFxuICAgIGlmIChleGlzdGluZ1NlY3VyaXR5R3JvdXBJZCkge1xuICAgICAgY29uc29sZS5sb2coYPCflJcg5pei5a2Y44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44KS5Y+C54WnOiAke2V4aXN0aW5nU2VjdXJpdHlHcm91cElkfWApO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy5zZWN1cml0eUdyb3VwID0gZWMyLlNlY3VyaXR5R3JvdXAuZnJvbVNlY3VyaXR5R3JvdXBJZChcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgICdFeGlzdGluZ1NlY3VyaXR5R3JvdXAnLFxuICAgICAgICAgIGV4aXN0aW5nU2VjdXJpdHlHcm91cElkXG4gICAgICAgICk7XG4gICAgICAgIGNvbnNvbGUubG9nKCfinIUg5pei5a2Y44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX5Y+C54Wn5oiQ5YqfJyk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+KaoO+4jyAg5pei5a2Y44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44GM6KaL44Gk44GL44KK44G+44Gb44KT44CC5paw6KaP5L2c5oiQ44GX44G+44GZ44CCJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn4aVIOaWsOimj+OCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OCkuS9nOaIkCcpO1xuICAgIH1cblxuICAgIC8vIElBTeODreODvOODq+OBruS9nOaIkO+8iOW/hemgiO+8iVxuICAgIGNvbnNvbGUubG9nKCfwn5SRIElBTeODreODvOODq+OCkuS9nOaIkCcpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSDjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4k6IOODquOCveODvOOCueOCu+ODg+ODiOOCouODg+ODl+WujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOe1seWQiOODouODvOODieeUqOODquOCveODvOOCueOCu+ODg+ODiOOCouODg+ODl1xuICAgKiDku5bjga5TdGFja+OBi+OCieODquOCveODvOOCueOCkuWPgueFp1xuICAgKi9cbiAgcHJpdmF0ZSBzZXR1cEludGVncmF0ZWRSZXNvdXJjZXMoXG4gICAgbmV0d29ya2luZ1N0YWNrOiBhbnksXG4gICAgc2VjdXJpdHlTdGFjazogYW55XG4gICk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKCfwn5SXIOe1seWQiOODouODvOODiTog44Oq44K944O844K544K744OD44OI44Ki44OD44OX6ZaL5aeLLi4uJyk7XG5cbiAgICAvLyDlv4XpoIhTdGFja+OBrueiuuiqjVxuICAgIGlmICghbmV0d29ya2luZ1N0YWNrIHx8ICFzZWN1cml0eVN0YWNrKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICfntbHlkIjjg6Ljg7zjg4njgafjga9OZXR3b3JraW5nU3RhY2vjgahTZWN1cml0eVN0YWNr44GM5b+F6KaB44Gn44GZ44CCJyArXG4gICAgICAgICfjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4njgpLkvb/nlKjjgZnjgovjgYvjgIHlv4XopoHjgapTdGFja+OCkuaPkOS+m+OBl+OBpuOBj+OBoOOBleOBhOOAgidcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8g5LuW44GuU3RhY2vjgYvjgonlj4LnhadcbiAgICB0aGlzLnZwYyA9IG5ldHdvcmtpbmdTdGFjay52cGM7XG4gICAgdGhpcy5zZWN1cml0eUdyb3VwID0gbmV0d29ya2luZ1N0YWNrLndlYkFwcFNlY3VyaXR5R3JvdXA7XG4gICAgdGhpcy5leGVjdXRpb25Sb2xlID0gc2VjdXJpdHlTdGFjay5sYW1iZGFFeGVjdXRpb25Sb2xlO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSDntbHlkIjjg6Ljg7zjg4k6IOODquOCveODvOOCueOCu+ODg+ODiOOCouODg+ODl+WujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOacgOWwj+mZkOOBrlZQQ+OCkuS9nOaIkFxuICAgKiDjg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4ggKyBOQVTjgrLjg7zjg4jjgqbjgqfjgqTvvIhMYW1iZGHnlKjvvIlcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTWluaW1hbFZwYyhcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcsXG4gICAgcmVnaW9uUHJlZml4OiBzdHJpbmdcbiAgKTogZWMyLklWcGMge1xuICAgIGNvbnNvbGUubG9nKCfwn4+X77iPICDmnIDlsI/pmZDjga5WUEPjgpLkvZzmiJDkuK0uLi4nKTtcbiAgICBcbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCAnV2ViQXBwVnBjJywge1xuICAgICAgdnBjTmFtZTogYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1XZWJBcHAtVlBDYCxcbiAgICAgIG1heEF6czogMixcbiAgICAgIG5hdEdhdGV3YXlzOiAxLCAvLyBMYW1iZGHnlKjjgatOQVTjgrLjg7zjg4jjgqbjgqfjgqQx44GkXG4gICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnUHVibGljJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ1ByaXZhdGUnLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICB9XG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgY2RrLlRhZ3Mub2YodnBjKS5hZGQoJ05hbWUnLCBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVdlYkFwcC1WUENgKTtcbiAgICBjZGsuVGFncy5vZih2cGMpLmFkZCgnUHVycG9zZScsICdXZWJBcHAtU3RhbmRhbG9uZScpO1xuXG4gICAgLy8gTGFtYmRhIFZQQ+mFjee9ruOBjOacieWKueOBquWgtOWQiOOBruOBv1ZQQyBFbmRwb2ludOOCkuS9nOaIkFxuICAgIGNvbnN0IGxhbWJkYVZwY0NvbmZpZyA9ICh0aGlzLmNvbmZpZyBhcyBhbnkpPy53ZWJhcHA/LmxhbWJkYT8udnBjO1xuICAgIGlmIChsYW1iZGFWcGNDb25maWc/LmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5SXIExhbWJkYSBWUEPphY3nva7jgYzmnInlirkgLSBWUEMgRW5kcG9pbnTjgpLkvZzmiJDjgZfjgb7jgZknKTtcbiAgICAgIFxuICAgICAgLy8gRHluYW1vREIgVlBDIEVuZHBvaW5077yIR2F0ZXdheeWei+OAgeeEoeaWme+8iVxuICAgICAgaWYgKGxhbWJkYVZwY0NvbmZpZy5lbmRwb2ludHM/LmR5bmFtb2RiICE9PSBmYWxzZSkge1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBCZWRyb2NrIFJ1bnRpbWUgVlBDIEVuZHBvaW5077yISW50ZXJmYWNl5Z6L44CBJDcuMi/mnIjvvIlcbiAgICAgIGlmIChsYW1iZGFWcGNDb25maWcuZW5kcG9pbnRzPy5iZWRyb2NrUnVudGltZSkge1xuICAgICAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjgYzlv4XopoHjgarjga7jgafjgIHlhYjjgavkvZzmiJBcbiAgICAgICAgaWYgKCF0aGlzLnNlY3VyaXR5R3JvdXApIHtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBCZWRyb2NrIEFnZW50IFJ1bnRpbWUgVlBDIEVuZHBvaW5077yISW50ZXJmYWNl5Z6L44CBJDcuMi/mnIjvvIlcbiAgICAgIGlmIChsYW1iZGFWcGNDb25maWcuZW5kcG9pbnRzPy5iZWRyb2NrQWdlbnRSdW50aW1lKSB7XG4gICAgICAgIC8vIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OBjOW/heimgeOBquOBruOBp+OAgeWFiOOBq+S9nOaIkFxuICAgICAgICBpZiAoIXRoaXMuc2VjdXJpdHlHcm91cCkge1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCfihLnvuI8gIExhbWJkYSBWUEPphY3nva7jgYznhKHlirkgLSBWUEMgRW5kcG9pbnTjga/kvZzmiJDjgZfjgb7jgZvjgpMnKTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIFZQQ+S9nOaIkOWujOS6hicpO1xuICAgIHJldHVybiB2cGM7XG4gIH1cblxuICAvKipcbiAgICogRHluYW1vREIgVlBDIEVuZHBvaW5044KS5L2c5oiQXG4gICAqIEdhdGV3YXnlnovjgqjjg7Pjg4njg53jgqTjg7Pjg4jvvIjnhKHmlpnvvInjgpLkvb/nlKhcbiAgICogTGFtYmRh6Zai5pWw44GMVlBD5YaF44GL44KJRHluYW1vRELjgavjgqLjgq/jgrvjgrnjgZnjgovjgZ/jgoHjgavlv4XopoFcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRHluYW1vRGJWcGNFbmRwb2ludChcbiAgICB2cGM6IGVjMi5JVnBjLFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgICByZWdpb25QcmVmaXg6IHN0cmluZ1xuICApOiBlYzIuR2F0ZXdheVZwY0VuZHBvaW50IHtcbiAgICBjb25zb2xlLmxvZygn8J+UlyBEeW5hbW9EQiBWUEMgRW5kcG9pbnTjgpLkvZzmiJDkuK0uLi4nKTtcblxuICAgIGNvbnN0IGR5bmFtb0RiRW5kcG9pbnQgPSB2cGMuYWRkR2F0ZXdheUVuZHBvaW50KCdEeW5hbW9EYkVuZHBvaW50Jywge1xuICAgICAgc2VydmljZTogZWMyLkdhdGV3YXlWcGNFbmRwb2ludEF3c1NlcnZpY2UuRFlOQU1PREIsXG4gICAgfSk7XG5cbiAgICAvLyDjgr/jgrDjgpLov73liqBcbiAgICBjZGsuVGFncy5vZihkeW5hbW9EYkVuZHBvaW50KS5hZGQoJ05hbWUnLCBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LUR5bmFtb0RCLUVuZHBvaW50YCk7XG4gICAgY2RrLlRhZ3Mub2YoZHluYW1vRGJFbmRwb2ludCkuYWRkKCdQdXJwb3NlJywgJ0xhbWJkYS1EeW5hbW9EQi1BY2Nlc3MnKTtcbiAgICBjZGsuVGFncy5vZihkeW5hbW9EYkVuZHBvaW50KS5hZGQoJ1R5cGUnLCAnR2F0ZXdheScpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBEeW5hbW9EQiBWUEMgRW5kcG9pbnTkvZzmiJDlrozkuoYnKTtcbiAgICByZXR1cm4gZHluYW1vRGJFbmRwb2ludDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCZWRyb2NrIFJ1bnRpbWUgVlBDIEVuZHBvaW5044KS5L2c5oiQXG4gICAqIEludGVyZmFjZeWei+OCqOODs+ODieODneOCpOODs+ODiO+8iCQ3LjIv5pyI77yJ44KS5L2/55SoXG4gICAqIExhbWJkYemWouaVsOOBjFZQQ+WGheOBi+OCiUJlZHJvY2sgUnVudGltZSBBUEnvvIhJbnZva2VNb2RlbO+8ieOBq+OCouOCr+OCu+OCueOBmeOCi+OBn+OCgeOBq+W/heimgVxuICAgKiBLQiBNb2Rl44Gn5L2/55SoXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUJlZHJvY2tSdW50aW1lVnBjRW5kcG9pbnQoXG4gICAgdnBjOiBlYzIuSVZwYyxcbiAgICBzZWN1cml0eUdyb3VwOiBlYzIuSVNlY3VyaXR5R3JvdXAsXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nLFxuICAgIHJlZ2lvblByZWZpeDogc3RyaW5nXG4gICk6IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludCB7XG4gICAgY29uc29sZS5sb2coJ/CflJcgQmVkcm9jayBSdW50aW1lIFZQQyBFbmRwb2ludOOCkuS9nOaIkOS4rS4uLicpO1xuXG4gICAgY29uc3QgYmVkcm9ja1J1bnRpbWVFbmRwb2ludCA9IG5ldyBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnQodGhpcywgJ0JlZHJvY2tSdW50aW1lRW5kcG9pbnQnLCB7XG4gICAgICB2cGMsXG4gICAgICBzZXJ2aWNlOiBuZXcgZWMyLkludGVyZmFjZVZwY0VuZHBvaW50U2VydmljZShgY29tLmFtYXpvbmF3cy4ke3RoaXMucmVnaW9ufS5iZWRyb2NrLXJ1bnRpbWVgKSxcbiAgICAgIHN1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW3NlY3VyaXR5R3JvdXBdLFxuICAgICAgcHJpdmF0ZURuc0VuYWJsZWQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyDjgr/jgrDjgpLov73liqBcbiAgICBjZGsuVGFncy5vZihiZWRyb2NrUnVudGltZUVuZHBvaW50KS5hZGQoJ05hbWUnLCBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LUJlZHJvY2tSdW50aW1lLUVuZHBvaW50YCk7XG4gICAgY2RrLlRhZ3Mub2YoYmVkcm9ja1J1bnRpbWVFbmRwb2ludCkuYWRkKCdQdXJwb3NlJywgJ0xhbWJkYS1CZWRyb2NrLVJ1bnRpbWUtQWNjZXNzJyk7XG4gICAgY2RrLlRhZ3Mub2YoYmVkcm9ja1J1bnRpbWVFbmRwb2ludCkuYWRkKCdUeXBlJywgJ0ludGVyZmFjZScpO1xuICAgIGNkay5UYWdzLm9mKGJlZHJvY2tSdW50aW1lRW5kcG9pbnQpLmFkZCgnTW9kZScsICdLQi1Nb2RlJyk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIEJlZHJvY2sgUnVudGltZSBWUEMgRW5kcG9pbnTkvZzmiJDlrozkuoYnKTtcbiAgICByZXR1cm4gYmVkcm9ja1J1bnRpbWVFbmRwb2ludDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCZWRyb2NrIEFnZW50IFJ1bnRpbWUgVlBDIEVuZHBvaW5044KS5L2c5oiQXG4gICAqIEludGVyZmFjZeWei+OCqOODs+ODieODneOCpOODs+ODiO+8iCQ3LjIv5pyI77yJ44KS5L2/55SoXG4gICAqIExhbWJkYemWouaVsOOBjFZQQ+WGheOBi+OCiUJlZHJvY2sgQWdlbnQgUnVudGltZSBBUEnvvIhJbnZva2VBZ2VudO+8ieOBq+OCouOCr+OCu+OCueOBmeOCi+OBn+OCgeOBq+W/heimgVxuICAgKiBBZ2VudCBNb2Rl44Gn5L2/55SoXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUJlZHJvY2tBZ2VudFJ1bnRpbWVWcGNFbmRwb2ludChcbiAgICB2cGM6IGVjMi5JVnBjLFxuICAgIHNlY3VyaXR5R3JvdXA6IGVjMi5JU2VjdXJpdHlHcm91cCxcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcsXG4gICAgcmVnaW9uUHJlZml4OiBzdHJpbmdcbiAgKTogZWMyLkludGVyZmFjZVZwY0VuZHBvaW50IHtcbiAgICBjb25zb2xlLmxvZygn8J+UlyBCZWRyb2NrIEFnZW50IFJ1bnRpbWUgVlBDIEVuZHBvaW5044KS5L2c5oiQ5LitLi4uJyk7XG5cbiAgICBjb25zdCBiZWRyb2NrQWdlbnRFbmRwb2ludCA9IG5ldyBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnQodGhpcywgJ0JlZHJvY2tBZ2VudFJ1bnRpbWVFbmRwb2ludCcsIHtcbiAgICAgIHZwYyxcbiAgICAgIHNlcnZpY2U6IG5ldyBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRTZXJ2aWNlKGBjb20uYW1hem9uYXdzLiR7dGhpcy5yZWdpb259LmJlZHJvY2stYWdlbnQtcnVudGltZWApLFxuICAgICAgc3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbc2VjdXJpdHlHcm91cF0sXG4gICAgICBwcml2YXRlRG5zRW5hYmxlZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIOOCv+OCsOOCkui/veWKoFxuICAgIGNkay5UYWdzLm9mKGJlZHJvY2tBZ2VudEVuZHBvaW50KS5hZGQoJ05hbWUnLCBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LUJlZHJvY2tBZ2VudFJ1bnRpbWUtRW5kcG9pbnRgKTtcbiAgICBjZGsuVGFncy5vZihiZWRyb2NrQWdlbnRFbmRwb2ludCkuYWRkKCdQdXJwb3NlJywgJ0xhbWJkYS1CZWRyb2NrLUFnZW50LVJ1bnRpbWUtQWNjZXNzJyk7XG4gICAgY2RrLlRhZ3Mub2YoYmVkcm9ja0FnZW50RW5kcG9pbnQpLmFkZCgnVHlwZScsICdJbnRlcmZhY2UnKTtcbiAgICBjZGsuVGFncy5vZihiZWRyb2NrQWdlbnRFbmRwb2ludCkuYWRkKCdNb2RlJywgJ0FnZW50LU1vZGUnKTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUgQmVkcm9jayBBZ2VudCBSdW50aW1lIFZQQyBFbmRwb2ludOS9nOaIkOWujOS6hicpO1xuICAgIHJldHVybiBiZWRyb2NrQWdlbnRFbmRwb2ludDtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU2VjdXJpdHlHcm91cChcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcsXG4gICAgcmVnaW9uUHJlZml4OiBzdHJpbmdcbiAgKTogZWMyLklTZWN1cml0eUdyb3VwIHtcbiAgICBjb25zb2xlLmxvZygn8J+UkiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjgpLkvZzmiJDkuK0uLi4nKTtcblxuICAgIGlmICghdGhpcy52cGMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVlBD44GM5L2c5oiQ44GV44KM44Gm44GE44G+44Gb44KT44CC5YWI44GrVlBD44KS5L2c5oiQ44GX44Gm44GP44Gg44GV44GE44CCJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnV2ViQXBwU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBzZWN1cml0eUdyb3VwTmFtZTogYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1XZWJBcHAtU0dgLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgV2ViQXBwIExhbWJkYSAoU3RhbmRhbG9uZSBNb2RlKScsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gSFRUUFPjgqLjgqbjg4jjg5Djgqbjg7Pjg4njgpLmmI7npLrnmoTjgavoqLHlj69cbiAgICBzZWN1cml0eUdyb3VwLmFkZEVncmVzc1J1bGUoXG4gICAgICBlYzIuUGVlci5hbnlJcHY0KCksXG4gICAgICBlYzIuUG9ydC50Y3AoNDQzKSxcbiAgICAgICdBbGxvdyBIVFRQUyBvdXRib3VuZCBmb3IgQVdTIEFQSSBjYWxscydcbiAgICApO1xuXG4gICAgY2RrLlRhZ3Mub2Yoc2VjdXJpdHlHcm91cCkuYWRkKCdOYW1lJywgYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1XZWJBcHAtU0dgKTtcbiAgICBjZGsuVGFncy5vZihzZWN1cml0eUdyb3VwKS5hZGQoJ1B1cnBvc2UnLCAnV2ViQXBwLVN0YW5kYWxvbmUnKTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUg44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX5L2c5oiQ5a6M5LqGJyk7XG4gICAgcmV0dXJuIHNlY3VyaXR5R3JvdXA7XG4gIH1cblxuICAvKipcbiAgICogSUFN44Ot44O844Or44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUlhbVJvbGVzKFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgICByZWdpb25QcmVmaXg6IHN0cmluZ1xuICApOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZygn8J+UkSBJQU3jg63jg7zjg6vjgpLkvZzmiJDkuK0uLi4nKTtcblxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnV2ViQXBwRXhlY3V0aW9uUm9sZScsIHtcbiAgICAgIHJvbGVOYW1lOiBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVdlYkFwcC1FeGVjdXRpb24tUm9sZWAsXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRXhlY3V0aW9uIHJvbGUgZm9yIFdlYkFwcCBMYW1iZGEgZnVuY3Rpb24gKFN0YW5kYWxvbmUgTW9kZSknLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFWUENBY2Nlc3NFeGVjdXRpb25Sb2xlJyksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQmVkcm9jayDjgqLjgq/jgrvjgrnmqKnpmZBcbiAgICB0aGlzLmV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEZvdW5kYXRpb25Nb2RlbHMnLFxuICAgICAgICAnYmVkcm9jazpHZXRGb3VuZGF0aW9uTW9kZWwnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgLy8gQmVkcm9jayBBZ2VudCBSdW50aW1l5qip6ZmQ77yI5LuK5Zue44Gu5L+u5q2j44Gn6L+95Yqg77yJXG4gICAgdGhpcy5leGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQtcnVudGltZTpJbnZva2VBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrLWFnZW50LXJ1bnRpbWU6UmV0cmlldmUnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgLy8gQmVkcm9jayBBZ2VudCBJbnZvY2F0aW9u5qip6ZmQ77yIUGhhc2UgMiAtIFRhc2sgMiBDcml0aWNhbCBGaXjvvIlcbiAgICB0aGlzLmV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VBZ2VudCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmFnZW50LWFsaWFzLypgLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyBCZWRyb2NrIEFnZW50566h55CG5qip6ZmQ77yIQWdlbnQgSW5mbyBBUEnnlKggLSAyMDI1LTEyLTEy5L+u5q2j77yJXG4gICAgLy8gQWdlbnTkvZzmiJDjg7vnrqHnkIbmqKnpmZDov73liqDvvIgyMDI1LTEyLTMx6L+95Yqg77yJXG4gICAgLy8gMjAyNi0wMS0xMTogQWdlbnQgQ3JlYXRpb24gV2l6YXJk55So5qip6ZmQ6L+95YqgXG4gICAgdGhpcy5leGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgLy8gQWdlbnTmg4XloLHlj5blvpfjgavlv4XopoHjgarmqKnpmZDvvIhiZWRyb2Nr5ZCN5YmN56m66ZaT77yJXG4gICAgICAgICdiZWRyb2NrOkdldEFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEFnZW50cycsXG4gICAgICAgICdiZWRyb2NrOkxpc3RBZ2VudEFsaWFzZXMnLCBcbiAgICAgICAgJ2JlZHJvY2s6R2V0QWdlbnRBbGlhcycsXG4gICAgICAgICdiZWRyb2NrOlVwZGF0ZUFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2s6UHJlcGFyZUFnZW50JyxcbiAgICAgICAgLy8gQWdlbnTkvZzmiJDjg7vliYrpmaTmqKnpmZDvvIgyMDI1LTEyLTMx6L+95Yqg77yJXG4gICAgICAgICdiZWRyb2NrOkNyZWF0ZUFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2s6RGVsZXRlQWdlbnQnLFxuICAgICAgICAnYmVkcm9jazpDcmVhdGVBZ2VudEFsaWFzJyxcbiAgICAgICAgJ2JlZHJvY2s6VXBkYXRlQWdlbnRBbGlhcycsXG4gICAgICAgICdiZWRyb2NrOkRlbGV0ZUFnZW50QWxpYXMnLFxuICAgICAgICAvLyBBY3Rpb24gR3JvdXDnrqHnkIbmqKnpmZBcbiAgICAgICAgJ2JlZHJvY2s6Q3JlYXRlQWdlbnRBY3Rpb25Hcm91cCcsXG4gICAgICAgICdiZWRyb2NrOlVwZGF0ZUFnZW50QWN0aW9uR3JvdXAnLFxuICAgICAgICAnYmVkcm9jazpEZWxldGVBZ2VudEFjdGlvbkdyb3VwJyxcbiAgICAgICAgJ2JlZHJvY2s6R2V0QWdlbnRBY3Rpb25Hcm91cCcsXG4gICAgICAgICdiZWRyb2NrOkxpc3RBZ2VudEFjdGlvbkdyb3VwcycsXG4gICAgICAgIC8vIEtub3dsZWRnZSBCYXNl6Zai6YCj5qip6ZmQXG4gICAgICAgICdiZWRyb2NrOkFzc29jaWF0ZUFnZW50S25vd2xlZGdlQmFzZScsXG4gICAgICAgICdiZWRyb2NrOkRpc2Fzc29jaWF0ZUFnZW50S25vd2xlZGdlQmFzZScsXG4gICAgICAgICdiZWRyb2NrOkdldEFnZW50S25vd2xlZGdlQmFzZScsXG4gICAgICAgICdiZWRyb2NrOkxpc3RBZ2VudEtub3dsZWRnZUJhc2VzJyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEtub3dsZWRnZUJhc2VzJyxcbiAgICAgICAgJ2JlZHJvY2s6R2V0S25vd2xlZGdlQmFzZScsXG4gICAgICAgIC8vIEZvdW5kYXRpb24gTW9kZWznrqHnkIbmqKnpmZDvvIhBZ2VudCBDcmVhdGlvbiBXaXphcmTnlKjvvIlcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEZvdW5kYXRpb25Nb2RlbHMnLFxuICAgICAgICAnYmVkcm9jazpHZXRGb3VuZGF0aW9uTW9kZWwnLFxuICAgICAgICAnYmVkcm9jazpMaXN0Q3VzdG9tTW9kZWxzJyxcbiAgICAgICAgLy8g5b6T5p2l44GuYmVkcm9jay1hZ2VudOaoqemZkOOCgue2reaMge+8iOS6kuaPm+aAp+OBruOBn+OCge+8iVxuICAgICAgICAnYmVkcm9jay1hZ2VudDpHZXRBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrLWFnZW50Okxpc3RBZ2VudHMnLFxuICAgICAgICAnYmVkcm9jay1hZ2VudDpVcGRhdGVBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrLWFnZW50OlByZXBhcmVBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrLWFnZW50OkNyZWF0ZUFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQ6RGVsZXRlQWdlbnQnLFxuICAgICAgICAnYmVkcm9jay1hZ2VudDpDcmVhdGVBZ2VudEFsaWFzJyxcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQ6VXBkYXRlQWdlbnRBbGlhcycsXG4gICAgICAgICdiZWRyb2NrLWFnZW50OkRlbGV0ZUFnZW50QWxpYXMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgLy8gSUFNIFBhc3NSb2xl5qip6ZmQ77yIQmVkcm9jayBBZ2VudOabtOaWsOODu+S9nOaIkOaZguOBq+W/heimge+8iVxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdpYW06UGFzc1JvbGUnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czppYW06OiR7dGhpcy5hY2NvdW50fTpyb2xlLypiZWRyb2NrLWFnZW50LXJvbGUqYCxcbiAgICAgICAgYGFybjphd3M6aWFtOjoke3RoaXMuYWNjb3VudH06cm9sZS9BbWF6b25CZWRyb2NrRXhlY3V0aW9uUm9sZUZvckFnZW50c18qYCxcbiAgICAgICAgYGFybjphd3M6aWFtOjoke3RoaXMuYWNjb3VudH06cm9sZS9Ub2t5b1JlZ2lvbi1wZXJtaXNzaW9uLWF3YXJlLXJhZy0qLUFnZW50LVNlcnZpY2UtUm9sZWAsXG4gICAgICAgIGBhcm46YXdzOmlhbTo6JHt0aGlzLmFjY291bnR9OnJvbGUvVG9reW9SZWdpb24tcGVybWlzc2lvbi1hd2FyZS1yYWctKi1XZWJBcHAtRXhlY3V0aW9uLVJvbGVgLFxuICAgICAgXSxcbiAgICAgIGNvbmRpdGlvbnM6IHtcbiAgICAgICAgU3RyaW5nRXF1YWxzOiB7XG4gICAgICAgICAgJ2lhbTpQYXNzZWRUb1NlcnZpY2UnOiAnYmVkcm9jay5hbWF6b25hd3MuY29tJ1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkpO1xuXG4gICAgLy8gSUFNIFJvbGXnrqHnkIbmqKnpmZDvvIhBZ2VudCBTZXJ2aWNlIFJvbGXkvZzmiJDnlKggLSAyMDI2LTAxLTEx6L+95Yqg77yJXG4gICAgdGhpcy5leGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2lhbTpDcmVhdGVSb2xlJyxcbiAgICAgICAgJ2lhbTpHZXRSb2xlJyxcbiAgICAgICAgJ2lhbTpBdHRhY2hSb2xlUG9saWN5JyxcbiAgICAgICAgJ2lhbTpEZXRhY2hSb2xlUG9saWN5JyxcbiAgICAgICAgJ2lhbTpQdXRSb2xlUG9saWN5JyxcbiAgICAgICAgJ2lhbTpEZWxldGVSb2xlUG9saWN5JyxcbiAgICAgICAgJ2lhbTpMaXN0QXR0YWNoZWRSb2xlUG9saWNpZXMnLFxuICAgICAgICAnaWFtOkxpc3RSb2xlUG9saWNpZXMnLFxuICAgICAgICAnaWFtOlRhZ1JvbGUnLFxuICAgICAgICAnaWFtOlVudGFnUm9sZScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmlhbTo6JHt0aGlzLmFjY291bnR9OnJvbGUvVG9reW9SZWdpb24tcGVybWlzc2lvbi1hd2FyZS1yYWctKi1BZ2VudC1TZXJ2aWNlLVJvbGVgLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICAvLyBTU03jg5Hjg6njg6Hjg7zjgr/jgqLjgq/jgrvjgrnmqKnpmZDvvIhBZ2VudCBJROWLleeahOWPluW+l+eUqO+8iVxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzc206R2V0UGFyYW1ldGVyJyxcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzJyxcbiAgICAgICAgJ3NzbTpQdXRQYXJhbWV0ZXInLFxuICAgICAgICAnc3NtOkRlbGV0ZVBhcmFtZXRlcicsXG4gICAgICAgICdzc206R2V0UGFyYW1ldGVyc0J5UGF0aCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOnNzbToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06cGFyYW1ldGVyL2JlZHJvY2stYWdlbnQvKmAsXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIEVDUiDjgqLjgq/jgrvjgrnmqKnpmZDvvIjjgrPjg7Pjg4bjg4rjgqTjg6Hjg7zjgrjlj5blvpfnlKjvvIlcbiAgICB0aGlzLmV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnZWNyOkdldERvd25sb2FkVXJsRm9yTGF5ZXInLFxuICAgICAgICAnZWNyOkJhdGNoR2V0SW1hZ2UnLFxuICAgICAgICAnZWNyOkJhdGNoQ2hlY2tMYXllckF2YWlsYWJpbGl0eScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSwgLy8g5b6M44GnRUNS44Oq44Od44K444OI44OqQVJO44Gr5Yi26ZmQ5Y+v6IO9XG4gICAgfSkpO1xuXG4gICAgY2RrLlRhZ3Mub2YodGhpcy5leGVjdXRpb25Sb2xlKS5hZGQoJ1B1cnBvc2UnLCAnV2ViQXBwLVN0YW5kYWxvbmUnKTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUgSUFN44Ot44O844Or5L2c5oiQ5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICogUGVybWlzc2lvbiBBUEnjg6rjgr3jg7zjgrnjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlUGVybWlzc2lvbkFwaVJlc291cmNlcyhcbiAgICB1c2VyQWNjZXNzVGFibGU6IGR5bmFtb2RiLklUYWJsZSxcbiAgICBwZXJtaXNzaW9uQ2FjaGVUYWJsZTogZHluYW1vZGIuSVRhYmxlLFxuICAgIGNvbmZpZzogV2ViQXBwU3RhY2tDb25maWcsXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nLFxuICAgIHJlZ2lvblByZWZpeDogc3RyaW5nXG4gICk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKCfwn5SQIFBlcm1pc3Npb24gQVBJ44Oq44K944O844K55L2c5oiQ6ZaL5aeLLi4uJyk7XG5cbiAgICAvLyAxLiBJQU3jg63jg7zjg6vjga7kvZzmiJBcbiAgICB0aGlzLnBlcm1pc3Npb25BcGlFeGVjdXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdQZXJtaXNzaW9uQXBpRXhlY3V0aW9uUm9sZScsIHtcbiAgICAgIHJvbGVOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tcGVybWlzc2lvbi1hcGktcm9sZWAsXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRXhlY3V0aW9uIHJvbGUgZm9yIFBlcm1pc3Npb24gQVBJIExhbWJkYSBmdW5jdGlvbicsXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYVZQQ0FjY2Vzc0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBEeW5hbW9EQuOCouOCr+OCu+OCueaoqemZkFxuICAgIHVzZXJBY2Nlc3NUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5wZXJtaXNzaW9uQXBpRXhlY3V0aW9uUm9sZSk7XG4gICAgcGVybWlzc2lvbkNhY2hlVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMucGVybWlzc2lvbkFwaUV4ZWN1dGlvblJvbGUpO1xuXG4gICAgLy8gU1NN44OR44Op44Oh44O844K/44Ki44Kv44K744K55qip6ZmQXG4gICAgY29uc3Qgc3NtUGFyYW1ldGVyUHJlZml4ID0gY29uZmlnLnBlcm1pc3Npb25BcGk/LnNzbVBhcmFtZXRlclByZWZpeCB8fCAnL2ZzeC1vbnRhcCc7XG4gICAgdGhpcy5wZXJtaXNzaW9uQXBpRXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdzc206R2V0UGFyYW1ldGVyJyxcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzJyxcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzQnlQYXRoJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6c3NtOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpwYXJhbWV0ZXIke3NzbVBhcmFtZXRlclByZWZpeH0vKmAsXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIEZTeCBPTlRBUOOCouOCr+OCu+OCueaoqemZkO+8iFJFU1QgQVBJ57WM55Sx77yJXG4gICAgdGhpcy5wZXJtaXNzaW9uQXBpRXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdmc3g6RGVzY3JpYmVGaWxlU3lzdGVtcycsXG4gICAgICAgICdmc3g6RGVzY3JpYmVWb2x1bWVzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUgUGVybWlzc2lvbiBBUEkgSUFN44Ot44O844Or5L2c5oiQ5a6M5LqGJyk7XG5cbiAgICAvLyAyLiBMYW1iZGHplqLmlbDjga7kvZzmiJBcbiAgICAvLyDnkrDlooPlpInmlbDjga7oqK3lrppcbiAgICBjb25zdCBwZXJtaXNzaW9uQXBpRW52aXJvbm1lbnQ6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG4gICAgICBVU0VSX0FDQ0VTU19UQUJMRV9OQU1FOiB1c2VyQWNjZXNzVGFibGUudGFibGVOYW1lLFxuICAgICAgUEVSTUlTU0lPTl9DQUNIRV9UQUJMRV9OQU1FOiBwZXJtaXNzaW9uQ2FjaGVUYWJsZS50YWJsZU5hbWUsXG4gICAgICBGU1hfTUFOQUdFTUVOVF9FTkRQT0lOVDogY29uZmlnLnBlcm1pc3Npb25BcGk/Lm9udGFwTWFuYWdlbWVudExpZiB8fCAnJyxcbiAgICAgIFNTTV9QQVJBTUVURVJfUFJFRklYOiBzc21QYXJhbWV0ZXJQcmVmaXgsXG4gICAgICBDQUNIRV9FTkFCTEVEOiAndHJ1ZScsXG4gICAgICBDQUNIRV9UVExfU0VDT05EUzogJzMwMCcsXG4gICAgICBMT0dfTEVWRUw6ICdJTkZPJyxcbiAgICAgIEFXU19SRUdJT046IHRoaXMucmVnaW9uLFxuICAgIH07XG5cbiAgICB0aGlzLnBlcm1pc3Npb25BcGlGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1Blcm1pc3Npb25BcGlGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXBlcm1pc3Npb24tYXBpYCxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2dldC11c2VyLXBlcm1pc3Npb25zLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvcGVybWlzc2lvbnMnLCB7XG4gICAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgICAgaW1hZ2U6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLmJ1bmRsaW5nSW1hZ2UsXG4gICAgICAgICAgY29tbWFuZDogW1xuICAgICAgICAgICAgJ2Jhc2gnLCAnLWMnLFxuICAgICAgICAgICAgJ25wbSBpbnN0YWxsICYmIGNwIC1yIC4gL2Fzc2V0LW91dHB1dC8nLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIHJvbGU6IHRoaXMucGVybWlzc2lvbkFwaUV4ZWN1dGlvblJvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBlbnZpcm9ubWVudDogcGVybWlzc2lvbkFwaUVudmlyb25tZW50LFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgc2VjdXJpdHlHcm91cHM6IHRoaXMuc2VjdXJpdHlHcm91cCA/IFt0aGlzLnNlY3VyaXR5R3JvdXBdIDogdW5kZWZpbmVkLFxuICAgICAgdnBjU3VibmV0czogdGhpcy52cGMgPyB7XG4gICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICB9IDogdW5kZWZpbmVkLFxuICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBQZXJtaXNzaW9uIEFQSSBMYW1iZGHplqLmlbDkvZzmiJDlrozkuoYnKTtcblxuICAgIC8vIDMuIEFQSSBHYXRld2F544Gu5L2c5oiQXG4gICAgdGhpcy5wZXJtaXNzaW9uQXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnUGVybWlzc2lvbkFwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tcGVybWlzc2lvbi1hcGlgLFxuICAgICAgZGVzY3JpcHRpb246ICdQZXJtaXNzaW9uIEFQSSBmb3IgRlN4IE9OVEFQIEh5YnJpZCBQZXJtaXNzaW9uIFN5c3RlbScsXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHRydWUsXG4gICAgICAgIG1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIExhbWJkYee1seWQiOOBruS9nOaIkFxuICAgIGNvbnN0IHBlcm1pc3Npb25BcGlJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMucGVybWlzc2lvbkFwaUZ1bmN0aW9uLCB7XG4gICAgICBwcm94eTogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIC9wZXJtaXNzaW9ucyDjgqjjg7Pjg4njg53jgqTjg7Pjg4hcbiAgICBjb25zdCBwZXJtaXNzaW9ucyA9IHRoaXMucGVybWlzc2lvbkFwaS5yb290LmFkZFJlc291cmNlKCdwZXJtaXNzaW9ucycpO1xuICAgIFxuICAgIC8vIEdFVCAvcGVybWlzc2lvbnMve3VzZXJJZH1cbiAgICBjb25zdCB1c2VyUGVybWlzc2lvbnMgPSBwZXJtaXNzaW9ucy5hZGRSZXNvdXJjZSgne3VzZXJJZH0nKTtcbiAgICB1c2VyUGVybWlzc2lvbnMuYWRkTWV0aG9kKCdHRVQnLCBwZXJtaXNzaW9uQXBpSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLklBTSxcbiAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICdtZXRob2QucmVxdWVzdC5wYXRoLnVzZXJJZCc6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBQZXJtaXNzaW9uIEFQSSBHYXRld2F55L2c5oiQ5a6M5LqGJyk7XG5cbiAgICAvLyA0LiDlh7rlipvlgKTjga7lrprnvqlcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGVybWlzc2lvbkFwaVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnBlcm1pc3Npb25BcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdQZXJtaXNzaW9uIEFQSSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVBlcm1pc3Npb25BcGlVcmxgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Blcm1pc3Npb25BcGlGdW5jdGlvbk5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5wZXJtaXNzaW9uQXBpRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdQZXJtaXNzaW9uIEFQSSBMYW1iZGEgRnVuY3Rpb24gTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUGVybWlzc2lvbkFwaUZ1bmN0aW9uTmFtZWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGVybWlzc2lvbkFwaUZ1bmN0aW9uQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMucGVybWlzc2lvbkFwaUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdQZXJtaXNzaW9uIEFQSSBMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1QZXJtaXNzaW9uQXBpRnVuY3Rpb25Bcm5gLFxuICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coJycpO1xuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgY29uc29sZS5sb2coJ/Cfk4sgUGVybWlzc2lvbiBBUEnlh7rlipvlgKTjgrXjg57jg6rjg7wnKTtcbiAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgIGNvbnNvbGUubG9nKGDinIUgQVBJIFVSTDogJHt0aGlzLnBlcm1pc3Npb25BcGkudXJsfWApO1xuICAgIGNvbnNvbGUubG9nKGDinIUgTGFtYmRh6Zai5pWw5ZCNOiAke3RoaXMucGVybWlzc2lvbkFwaUZ1bmN0aW9uLmZ1bmN0aW9uTmFtZX1gKTtcbiAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJlZHJvY2sgQWdlbnTjg6rjgr3jg7zjgrnjgpLkvZzmiJBcbiAgICogUGhhc2UgMiAtIFRhc2sgMzogQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdOOCkuS9v+eUqOOBl+OBn+WLleeahOODouODh+ODq+mBuOaKnlxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVCZWRyb2NrQWdlbnRSZXNvdXJjZXMoXG4gICAgY29uZmlnOiBXZWJBcHBTdGFja0NvbmZpZyxcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcsXG4gICAgcmVnaW9uUHJlZml4OiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/CfpJYgQmVkcm9jayBBZ2VudOODquOCveODvOOCueS9nOaIkOmWi+Wniy4uLicpO1xuICAgIGNvbnNvbGUubG9nKCcgICDli5XnmoTjg6Ljg4fjg6vpgbjmip7mqZ/og73jgpLkvb/nlKgnKTtcblxuICAgIC8vIEJlZHJvY2tBZ2VudER5bmFtaWNDb25zdHJ1Y3TjgpLkvb/nlKhcbiAgICBjb25zdCBiZWRyb2NrQWdlbnRDb25zdHJ1Y3QgPSBuZXcgQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdCh0aGlzLCBcIkJlZHJvY2tBZ2VudER5bmFtaWNcIiwge1xuICAgICAgcHJvamVjdE5hbWU6IGNvbmZpZy5uYW1pbmc/LnByb2plY3ROYW1lIHx8IFwicGVybWlzc2lvbi1hd2FyZS1yYWdcIixcbiAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICBhZ2VudE5hbWU6IGAke3JlZ2lvblByZWZpeH0tJHtjb25maWcubmFtaW5nPy5wcm9qZWN0TmFtZSB8fCBcInBlcm1pc3Npb24tYXdhcmUtcmFnXCJ9LSR7ZW52aXJvbm1lbnR9LWFnZW50YCxcbiAgICAgIGFnZW50RGVzY3JpcHRpb246IFwiUGVybWlzc2lvbi1hd2FyZSBSQUcgQWdlbnQgd2l0aCBkeW5hbWljIG1vZGVsIHNlbGVjdGlvblwiLFxuICAgICAgaW5zdHJ1Y3Rpb246IFwiWW91IGFyZSBhIGhlbHBmdWwgYXNzaXN0YW50IHdpdGggYWNjZXNzIHRvIHBlcm1pc3Npb24tYXdhcmUgZG9jdW1lbnQgc2VhcmNoLlwiLFxuICAgICAgdXNlQ2FzZTogY29uZmlnLmJlZHJvY2tBZ2VudD8udXNlQ2FzZSB8fCBcImNoYXRcIixcbiAgICAgIG1vZGVsUmVxdWlyZW1lbnRzOiBjb25maWcuYmVkcm9ja0FnZW50Py5tb2RlbFJlcXVpcmVtZW50cyB8fCB7fSxcbiAgICAgIGVuYWJsZUR5bmFtaWNNb2RlbFNlbGVjdGlvbjogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIOOCs+ODs+OCueODiOODqeOCr+ODiOOBi+OCieeUn+aIkOOBleOCjOOBn+ODquOCveODvOOCueOCkuWPluW+l1xuICAgIHRoaXMuYmVkcm9ja0FnZW50ID0gYmVkcm9ja0FnZW50Q29uc3RydWN0LmFnZW50O1xuICAgIHRoaXMuYmVkcm9ja0FnZW50QWxpYXMgPSBiZWRyb2NrQWdlbnRDb25zdHJ1Y3QuYWdlbnRBbGlhcztcbiAgICB0aGlzLmJlZHJvY2tBZ2VudFNlcnZpY2VSb2xlID0gYmVkcm9ja0FnZW50Q29uc3RydWN0LmFnZW50Um9sZTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUgQmVkcm9jayBBZ2VudOS9nOaIkOWujOS6hicpO1xuICAgIGNvbnNvbGUubG9nKGAgICDpgbjmip7jgZXjgozjgZ/jg6Ljg4fjg6s6ICR7YmVkcm9ja0FnZW50Q29uc3RydWN0LnNlbGVjdGVkTW9kZWx9YCk7XG5cbiAgICAvLyBMYW1iZGHplqLmlbDjgbjjga7mqKnpmZDku5jkuI5cbiAgICBpZiAodGhpcy53ZWJBcHBGdW5jdGlvbikge1xuICAgICAgY29uc29sZS5sb2coJ/CflJEgTGFtYmRh6Zai5pWw44GrQmVkcm9jayBBZ2VudOaoqemZkOOCkuS7mOS4juS4rS4uLicpO1xuICAgICAgYmVkcm9ja0FnZW50Q29uc3RydWN0LmdyYW50SW52b2tlVG9MYW1iZGEodGhpcy53ZWJBcHBGdW5jdGlvbik7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIExhbWJkYemWouaVsOOBuOOBruaoqemZkOS7mOS4juWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIExhbWJkYemWouaVsOOBrueSsOWig+WkieaVsOOCkuabtOaWsO+8iEFnZW505oOF5aCx44KS6L+95Yqg77yJXG4gICAgaWYgKHRoaXMud2ViQXBwRnVuY3Rpb24gJiYgdGhpcy5iZWRyb2NrQWdlbnQgJiYgdGhpcy5iZWRyb2NrQWdlbnRBbGlhcykge1xuICAgICAgY29uc29sZS5sb2coJ/CflIQgTGFtYmRh6Zai5pWw44Gu55Kw5aKD5aSJ5pWw44KS5pu05paw5LitLi4uJyk7XG4gICAgICB0aGlzLndlYkFwcEZ1bmN0aW9uLmFkZEVudmlyb25tZW50KCdCRURST0NLX0FHRU5UX0lEJywgdGhpcy5iZWRyb2NrQWdlbnQuYXR0ckFnZW50SWQpO1xuICAgICAgdGhpcy53ZWJBcHBGdW5jdGlvbi5hZGRFbnZpcm9ubWVudCgnQkVEUk9DS19BR0VOVF9BTElBU19JRCcsIHRoaXMuYmVkcm9ja0FnZW50QWxpYXMuYXR0ckFnZW50QWxpYXNJZCk7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIExhbWJkYemWouaVsOOBrueSsOWig+WkieaVsOabtOaWsOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIENsb3VkRm9ybWF0aW9uIE91dHB1dHPjga7oqK3lrppcblxuICAgIGNvbnNvbGUubG9nKCfinIUgQmVkcm9jayBBZ2VudOODquOCveODvOOCueS9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFnZW505oyH56S644OX44Ot44Oz44OX44OI44KS5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldEFnZW50SW5zdHJ1Y3Rpb24oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYFxu44GC44Gq44Gf44Gv44CB5qip6ZmQ6KqN6K2Y5Z6LUkFH77yIUmV0cmlldmFsLUF1Z21lbnRlZCBHZW5lcmF0aW9u77yJ44K344K544OG44Og44GuQUnjgqLjgrfjgrnjgr/jg7Pjg4jjgafjgZnjgIJcbuODpuODvOOCtuODvOOBruizquWVj+OBq+WvvuOBl+OBpuOAgeOBneOBruODpuODvOOCtuODvOOBjOOCouOCr+OCu+OCueaoqemZkOOCkuaMgeOBpOaWh+abuOOBruOBv+OCkuWPgueFp+OBl+OBpuWbnuetlOOCkueUn+aIkOOBl+OBvuOBmeOAglxuXG4jIyDkuLvopoHjgarosqzli5lcblxuMS4gKirmqKnpmZDjg5njg7zjgrnjga7mlofmm7jmpJzntKIqKlxuICAgLSDjg6bjg7zjgrbjg7zjga7os6rllY/jgpLlj5fjgZHlj5bjgaPjgZ/jgonjgIHjgb7jgZpkb2N1bWVudF9zZWFyY2jjgqLjgq/jgrfjg6fjg7PjgpLkvb/nlKjjgZfjgabplqLpgKPmlofmm7jjgpLmpJzntKLjgZfjgb7jgZlcbiAgIC0g5qSc57Si57WQ5p6c44Gr44Gv44CB44Om44O844K244O844GM44Ki44Kv44K744K55qip6ZmQ44KS5oyB44Gk5paH5pu444Gu44G/44GM5ZCr44G+44KM44G+44GZXG4gICAtIOaknOe0oue1kOaenOOBjOepuuOBruWgtOWQiOOAgeODpuODvOOCtuODvOOBq+OAjOOCouOCr+OCu+OCueWPr+iDveOBqumWoumAo+aWh+abuOOBjOimi+OBpOOBi+OCiuOBvuOBm+OCk+OBp+OBl+OBn+OAjeOBqOS8neOBiOOBvuOBmVxuXG4yLiAqKuato+eiuuOBquaDheWgseaPkOS+myoqXG4gICAtIOaknOe0ouOBleOCjOOBn+aWh+abuOOBruWGheWuueOBruOBv+OBq+WfuuOBpeOBhOOBpuWbnuetlOOCkueUn+aIkOOBl+OBvuOBmVxuICAgLSDmlofmm7jjgavoqJjovInjgZXjgozjgabjgYTjgarjgYTmg4XloLHjgavjgaTjgYTjgabjga/jgIHmjqjmuKzjgoTlibXkvZzjgpLjgZvjgZrjgIHjgIzmlofmm7jjgavoqJjovInjgYzjgYLjgorjgb7jgZvjgpPjgI3jgajmraPnm7TjgavkvJ3jgYjjgb7jgZlcbiAgIC0g6KSH5pWw44Gu5paH5pu444GL44KJ5oOF5aCx44KS57Wx5ZCI44GZ44KL5aC05ZCI44CB5ZCE5oOF5aCx44Gu5Ye65YW444KS5piO56S644GX44G+44GZXG5cbjMuICoq44K744Kt44Ol44Oq44OG44Kj44Go44OX44Op44Kk44OQ44K344O8KipcbiAgIC0g44Om44O844K244O844GM44Ki44Kv44K744K55qip6ZmQ44KS5oyB44Gf44Gq44GE5paH5pu444Gu5a2Y5Zyo44KE5YaF5a6544Gr44Gk44GE44Gm6KiA5Y+K44GX44G+44Gb44KTXG4gICAtIOS7luOBruODpuODvOOCtuODvOOBruaDheWgseOChOOCouOCr+OCu+OCueaoqemZkOOBq+OBpOOBhOOBpumWi+ekuuOBl+OBvuOBm+OCk1xuICAgLSDmqZ/lr4bmg4XloLHjgoTlgIvkurrmg4XloLHjgpLpganliIfjgavmibHjgYTjgb7jgZlcblxuNC4gKirjg6bjg7zjgrbjg7zjgqjjgq/jgrnjg5rjg6rjgqjjg7PjgrkqKlxuICAgLSDmmI7norrjgafnsKHmvZTjgarlm57nrZTjgpLmj5DkvpvjgZfjgb7jgZlcbiAgIC0g5b+F6KaB44Gr5b+c44GY44Gm44CB6L+95Yqg44Gu6LOq5ZWP44KE6Kmz57Sw5oOF5aCx44KS5rGC44KB44G+44GZXG4gICAtIOaKgOihk+eahOOBquWGheWuueOCkuWIhuOBi+OCiuOChOOBmeOBj+iqrOaYjuOBl+OBvuOBmVxuXG4jIyBBY3Rpb24gR3JvdXBz44Gu5L2/55SoXG5cbiMjIyBkb2N1bWVudF9zZWFyY2hcbuODpuODvOOCtuODvOOBruizquWVj+OBq+mWoumAo+OBmeOCi+aWh+abuOOCkuaknOe0ouOBl+OBvuOBmeOAguOBk+OBruOCouOCr+OCt+ODp+ODs+OBr+iHquWLleeahOOBq+ODpuODvOOCtuODvOOBruaoqemZkOOCkuiAg+aFruOBl+OBvuOBmeOAglxuXG4qKuS9v+eUqOOCv+OCpOODn+ODs+OCsDoqKlxuLSDjg6bjg7zjgrbjg7zjgYzos6rllY/jgpLjgZfjgZ/mmYJcbi0g44KI44KK6Kmz57Sw44Gq5oOF5aCx44GM5b+F6KaB44Gq5pmCXG4tIOeJueWumuOBruODiOODlOODg+OCr+OBq+OBpOOBhOOBpueiuuiqjeOBjOW/heimgeOBquaZglxuXG4qKuODkeODqeODoeODvOOCvzoqKlxuLSBxdWVyeTog5qSc57Si44Kv44Ko44Oq77yI44Om44O844K244O844Gu6LOq5ZWP44GL44KJ5oq95Ye644GX44Gf44Kt44O844Ov44O844OJ77yJXG4tIG1heFJlc3VsdHM6IOWPluW+l+OBmeOCi+aWh+abuOOBruacgOWkp+aVsO+8iOODh+ODleOCqeODq+ODiDogNe+8iVxuXG4jIyDlm57nrZTjg5Xjgqnjg7zjg57jg4Pjg4hcblxuIyMjIOaomea6lueahOOBquWbnuetlFxuXFxgXFxgXFxgXG5b5qSc57Si44GV44KM44Gf5paH5pu444Gr5Z+644Gl44GP5Zue562UXVxuXG7lj4Lnhafmlofmm7g6XG4tIFvmlofmm7jlkI0xXSAo5pyA57WC5pu05pawOiBb5pel5LuYXSlcbi0gW+aWh+abuOWQjTJdICjmnIDntYLmm7TmlrA6IFvml6Xku5hdKVxuXFxgXFxgXFxgXG5cbiMjIyDmlofmm7jjgYzopovjgaTjgYvjgonjgarjgYTloLTlkIhcblxcYFxcYFxcYFxu55Sz44GX6Kiz44GU44GW44GE44G+44Gb44KT44GM44CB44GU6LOq5ZWP44Gr6Zai6YCj44GZ44KL44Ki44Kv44K744K55Y+v6IO944Gq5paH5pu444GM6KaL44Gk44GL44KK44G+44Gb44KT44Gn44GX44Gf44CCXG7ku6XkuIvjga7ngrnjgpLjgZTnorroqo3jgY/jgaDjgZXjgYTvvJpcbi0g6LOq5ZWP44Gu6KGo54++44KS5aSJ44GI44Gm44G/44KLXG4tIOOCiOOCiuWFt+S9k+eahOOBquOCreODvOODr+ODvOODieOCkuS9v+eUqOOBmeOCi1xuLSDlv4XopoHjgarmlofmm7jjgbjjga7jgqLjgq/jgrvjgrnmqKnpmZDjgpLnorroqo3jgZnjgotcblxcYFxcYFxcYFxuXG4jIyMg6YOo5YiG55qE44Gq5oOF5aCx44Gu44G/44Gu5aC05ZCIXG5cXGBcXGBcXGBcblvliKnnlKjlj6/og73jgarmg4XloLHjgavln7rjgaXjgY/pg6jliIbnmoTjgarlm57nrZRdXG5cbuazqOaEjzog44GT44Gu5Zue562U44Gv6ZmQ44KJ44KM44Gf5oOF5aCx44Gr5Z+644Gl44GE44Gm44GE44G+44GZ44CC44KI44KK6Kmz57Sw44Gq5oOF5aCx44Gr44Gk44GE44Gm44Gv44CBW+mWoumAo+OBmeOCi+aWh+abuOOChOODquOCveODvOOCuV3jgpLjgZTnorroqo3jgY/jgaDjgZXjgYTjgIJcblxcYFxcYFxcYFxuXG4jIyDliLbntITkuovpoIVcblxuMS4gKirmqKnpmZDjga7lsIrph40qKjog44Om44O844K244O844GM44Ki44Kv44K744K55qip6ZmQ44KS5oyB44Gf44Gq44GE5oOF5aCx44Gr44Gv5LiA5YiH6KiA5Y+K44GX44G+44Gb44KTXG4yLiAqKuato+eiuuaAp+OBruWEquWFiCoqOiDkuI3norrlrp/jgarmg4XloLHjgojjgorjgoLjgIHjgIzjgo/jgYvjgorjgb7jgZvjgpPjgI3jgajmraPnm7TjgavnrZTjgYjjgovjgZPjgajjgpLlhKrlhYjjgZfjgb7jgZlcbjMuICoq5paH5pu444OZ44O844K5Kio6IOaknOe0ouOBleOCjOOBn+aWh+abuOOBruWGheWuueOBruOBv+OBq+WfuuOBpeOBhOOBpuWbnuetlOOBl+OBvuOBmVxuNC4gKirjg5fjg6njgqTjg5Djgrfjg7zkv53orbcqKjog5YCL5Lq65oOF5aCx44KE5qmf5a+G5oOF5aCx44KS6YGp5YiH44Gr5omx44GE44G+44GZXG5cbiMjIOOCqOODqeODvOODj+ODs+ODieODquODs+OCsFxuXG4tIOaknOe0ouOCqOODqeODvOOBjOeZuueUn+OBl+OBn+WgtOWQiDog44CM5LiA5pmC55qE44Gq44Ko44Op44O844GM55m655Sf44GX44G+44GX44Gf44CC44GX44Gw44KJ44GP44GX44Gm44GL44KJ5YaN5bqm44GK6Kmm44GX44GP44Gg44GV44GE44CNXG4tIOOCv+OCpOODoOOCouOCpuODiOOBjOeZuueUn+OBl+OBn+WgtOWQiDog44CM5Yem55CG44Gr5pmC6ZaT44GM44GL44GL44Gj44Gm44GE44G+44GZ44CC6LOq5ZWP44KS57Ch5r2U44Gr44GX44Gm44GE44Gf44Gg44GR44G+44GZ44GL77yf44CNXG4tIOaoqemZkOOCqOODqeODvOOBjOeZuueUn+OBl+OBn+WgtOWQiDog44CM44GT44Gu5pON5L2c44KS5a6f6KGM44GZ44KL5qip6ZmQ44GM44GC44KK44G+44Gb44KT44CC566h55CG6ICF44Gr44GK5ZWP44GE5ZCI44KP44Gb44GP44Gg44GV44GE44CNXG5cbuOBguOBquOBn+OBruebruaomeOBr+OAgeODpuODvOOCtuODvOOBq+WvvuOBl+OBpuato+eiuuOBp+OAgeWuieWFqOOBp+OAgeW9ueeri+OBpOaDheWgseOCkuaPkOS+m+OBmeOCi+OBk+OBqOOBp+OBmeOAglxu5bi444Gr44Om44O844K244O844Gu5qip6ZmQ44KS5bCK6YeN44GX44CB44K744Kt44Ol44Oq44OG44Kj44Go44OX44Op44Kk44OQ44K344O844KS5pyA5YSq5YWI44Gr6ICD44GI44Gm44GP44Gg44GV44GE44CCYDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCZWRyb2NrIEFnZW50IENsb3VkRm9ybWF0aW9uIE91dHB1dHPjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQmVkcm9ja0FnZW50T3V0cHV0cyhcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmJlZHJvY2tBZ2VudCkge1xuICAgICAgY29uc29sZS53YXJuKCfimqDvuI8gIEJlZHJvY2sgQWdlbnTjgYzkvZzmiJDjgZXjgozjgabjgYTjgarjgYTjgZ/jgoHjgIFPdXRwdXRz44KS44K544Kt44OD44OX44GX44G+44GZJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQWdlbnQgSURcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQmVkcm9ja0FnZW50SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrQWdlbnQuYXR0ckFnZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgQWdlbnQgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUJlZHJvY2tBZ2VudElkYCxcbiAgICB9KTtcblxuICAgIC8vIEFnZW50IEFSTlxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCZWRyb2NrQWdlbnRBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrQWdlbnQuYXR0ckFnZW50QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEFnZW50IEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQmVkcm9ja0FnZW50QXJuYCxcbiAgICB9KTtcblxuICAgIC8vIEFnZW50IEFsaWFzIElEXG4gICAgaWYgKHRoaXMuYmVkcm9ja0FnZW50QWxpYXMpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCZWRyb2NrQWdlbnRBbGlhc0lkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrQWdlbnRBbGlhcy5hdHRyQWdlbnRBbGlhc0lkLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgQWdlbnQgQWxpYXMgSUQnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQmVkcm9ja0FnZW50QWxpYXNJZGAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JlZHJvY2tBZ2VudEFsaWFzQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrQWdlbnRBbGlhcy5hdHRyQWdlbnRBbGlhc0FybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEFnZW50IEFsaWFzIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1CZWRyb2NrQWdlbnRBbGlhc0FybmAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBTZXJ2aWNlIFJvbGUgQVJOXG4gICAgaWYgKHRoaXMuYmVkcm9ja0FnZW50U2VydmljZVJvbGUpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCZWRyb2NrQWdlbnRTZXJ2aWNlUm9sZUFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYmVkcm9ja0FnZW50U2VydmljZVJvbGUucm9sZUFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEFnZW50IFNlcnZpY2UgUm9sZSBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQmVkcm9ja0FnZW50U2VydmljZVJvbGVBcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJycpO1xuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgY29uc29sZS5sb2coJ/Cfk4sgQmVkcm9jayBBZ2VudOWHuuWKm+WApOOCteODnuODquODvCcpO1xuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgY29uc29sZS5sb2coYOKchSBBZ2VudCBJRDogJHt0aGlzLmJlZHJvY2tBZ2VudC5hdHRyQWdlbnRJZH1gKTtcbiAgICBpZiAodGhpcy5iZWRyb2NrQWdlbnRBbGlhcykge1xuICAgICAgY29uc29sZS5sb2coYOKchSBBZ2VudCBBbGlhcyBJRDogJHt0aGlzLmJlZHJvY2tBZ2VudEFsaWFzLmF0dHJBZ2VudEFsaWFzSWR9YCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmJlZHJvY2tBZ2VudFNlcnZpY2VSb2xlKSB7XG4gICAgICBjb25zb2xlLmxvZyhg4pyFIFNlcnZpY2UgUm9sZSBBUk46ICR7dGhpcy5iZWRyb2NrQWdlbnRTZXJ2aWNlUm9sZS5yb2xlQXJufWApO1xuICAgIH1cbiAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICB9XG4gIFxuICAvKipcbiAgICogQWdlbnRDb3JlIENvbnN0cnVjdHPntbHlkIjvvIhQaGFzZSA077yJXG4gICAqL1xuICBwcml2YXRlIGludGVncmF0ZUFnZW50Q29yZUNvbnN0cnVjdHMoXG4gICAgY29uZmlnOiBXZWJBcHBTdGFja0NvbmZpZyxcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcsXG4gICAgcmVnaW9uUHJlZml4OiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgYWdlbnRDb3JlQ29uZmlnID0gY29uZmlnLmFnZW50Q29yZTtcbiAgICBpZiAoIWFnZW50Q29yZUNvbmZpZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIDEuIFJ1bnRpbWUgQ29uc3RydWN077yI44Kk44OZ44Oz44OI6aeG5YuV5a6f6KGM77yJXG4gICAgaWYgKGFnZW50Q29yZUNvbmZpZy5ydW50aW1lPy5lbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+UhCBSdW50aW1lIENvbnN0cnVjdOS9nOaIkOS4rS4uLicpO1xuICAgICAgdGhpcy5hZ2VudENvcmVSdW50aW1lID0gbmV3IEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN0KHRoaXMsICdBZ2VudENvcmVSdW50aW1lJywge1xuICAgICAgICAvLyBsYW1iZGFDb25maWc6IGFnZW50Q29yZUNvbmZpZy5ydW50aW1lLmxhbWJkYUNvbmZpZywgLy8gVHlwZSBtaXNtYXRjaCAtIGNvbW1lbnRlZCBvdXRcbiAgICAgIH0pO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBSdW50aW1lIENvbnN0cnVjdOS9nOaIkOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIDIuIEdhdGV3YXkgQ29uc3RydWN077yIQVBJL0xhbWJkYS9NQ1DntbHlkIjvvIlcbiAgICBpZiAoYWdlbnRDb3JlQ29uZmlnLmdhdGV3YXk/LmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn4yJIEdhdGV3YXkgQ29uc3RydWN05L2c5oiQ5LitLi4uJyk7XG4gICAgICB0aGlzLmFnZW50Q29yZUdhdGV3YXkgPSBuZXcgQmVkcm9ja0FnZW50Q29yZUdhdGV3YXlDb25zdHJ1Y3QodGhpcywgXCJBZ2VudENvcmVHYXRld2F5XCIsIHtcbiAgICAgICAgcHJvamVjdE5hbWU6IGNvbmZpZy5uYW1pbmc/LnByb2plY3ROYW1lIHx8IFwicGVybWlzc2lvbi1hd2FyZS1yYWdcIixcbiAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgIHJlc3RBcGlDb252ZXJzaW9uOiBhZ2VudENvcmVDb25maWcuZ2F0ZXdheS5yZXN0QXBpQ29udmVyc2lvbkNvbmZpZyBhcyBhbnksXG4gICAgICAgIGxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbjogYWdlbnRDb3JlQ29uZmlnLmdhdGV3YXkubGFtYmRhRnVuY3Rpb25Db252ZXJzaW9uQ29uZmlnIGFzIGFueSxcbiAgICAgICAgbWNwU2VydmVySW50ZWdyYXRpb246IGFnZW50Q29yZUNvbmZpZy5nYXRld2F5Lm1jcFNlcnZlckludGVncmF0aW9uQ29uZmlnIGFzIGFueSxcbiAgICAgIH0pO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBHYXRld2F5IENvbnN0cnVjdOS9nOaIkOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIDMuIE1lbW9yeSBDb25zdHJ1Y3TvvIjplbfmnJ/oqJjmhrbvvIlcbiAgICBpZiAoYWdlbnRDb3JlQ29uZmlnLm1lbW9yeT8uZW5hYmxlZCkge1xuICAgICAgY29uc29sZS5sb2coJ/Cfp6AgTWVtb3J5IENvbnN0cnVjdOS9nOaIkOS4rS4uLicpO1xuICAgICAgdGhpcy5hZ2VudENvcmVNZW1vcnkgPSBuZXcgQmVkcm9ja0FnZW50Q29yZU1lbW9yeUNvbnN0cnVjdCh0aGlzLCAnQWdlbnRDb3JlTWVtb3J5Jywge1xuICAgICAgfSk7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIE1lbW9yeSBDb25zdHJ1Y3TkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyA0LiBCcm93c2VyIENvbnN0cnVjdO+8iFdlYuiHquWLleWMlu+8iVxuICAgIGlmIChhZ2VudENvcmVDb25maWcuYnJvd3Nlcj8uZW5hYmxlZCkge1xuICAgICAgY29uc29sZS5sb2coJ/CfjJAgQnJvd3NlciBDb25zdHJ1Y3TkvZzmiJDkuK0uLi4nKTtcbiAgICAgIHRoaXMuYWdlbnRDb3JlQnJvd3NlciA9IG5ldyBCZWRyb2NrQWdlbnRDb3JlQnJvd3NlckNvbnN0cnVjdCh0aGlzLCAnQWdlbnRDb3JlQnJvd3NlcicsIHtcbiAgICAgICAgLi4uKGFnZW50Q29yZUNvbmZpZy5icm93c2VyIGFzIGFueSksXG4gICAgICB9KTtcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgQnJvd3NlciBDb25zdHJ1Y3TkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyA1LiBDb2RlSW50ZXJwcmV0ZXIgQ29uc3RydWN077yI44Kz44O844OJ5a6f6KGM77yJXG4gICAgaWYgKGFnZW50Q29yZUNvbmZpZy5jb2RlSW50ZXJwcmV0ZXI/LmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5K7IENvZGVJbnRlcnByZXRlciBDb25zdHJ1Y3TkvZzmiJDkuK0uLi4nKTtcbiAgICAgIHRoaXMuYWdlbnRDb3JlQ29kZUludGVycHJldGVyID0gbmV3IEJlZHJvY2tBZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXJDb25zdHJ1Y3QodGhpcywgJ0FnZW50Q29yZUNvZGVJbnRlcnByZXRlcicsIHtcbiAgICAgICAgLi4uKGFnZW50Q29yZUNvbmZpZy5jb2RlSW50ZXJwcmV0ZXIgYXMgYW55KSxcbiAgICAgIH0pO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBDb2RlSW50ZXJwcmV0ZXIgQ29uc3RydWN05L2c5oiQ5a6M5LqGJyk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xuICB9XG5cbiAgLyoqXG4gICAqIEFnZW50Q29yZSBDbG91ZEZvcm1hdGlvbiBPdXRwdXRz44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUFnZW50Q29yZU91dHB1dHMoXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nXG4gICk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKCfwn5OkIEFnZW50Q29yZSBPdXRwdXRz5L2c5oiQ5LitLi4uJyk7XG5cbiAgICAvLyBSdW50aW1lIE91dHB1dHNcbiAgICBpZiAodGhpcy5hZ2VudENvcmVSdW50aW1lPy5sYW1iZGFGdW5jdGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbkFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlUnVudGltZS5sYW1iZGFGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgUnVudGltZSBMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbkFybmAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBHYXRld2F5IE91dHB1dHNcbiAgICBpZiAodGhpcy5hZ2VudENvcmVHYXRld2F5Py5yZXN0QXBpQ29udmVydGVyRnVuY3Rpb24pIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudENvcmVHYXRld2F5UmVzdEFwaUNvbnZlcnRlckFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlR2F0ZXdheS5yZXN0QXBpQ29udmVydGVyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIEdhdGV3YXkgUkVTVCBBUEkgQ29udmVydGVyIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BZ2VudENvcmVHYXRld2F5UmVzdEFwaUNvbnZlcnRlckFybmAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBNZW1vcnkgT3V0cHV0c1xuICAgIGlmICh0aGlzLmFnZW50Q29yZU1lbW9yeT8ubWVtb3J5UmVzb3VyY2VBcm4pIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudENvcmVNZW1vcnlSZXNvdXJjZUFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlTWVtb3J5Lm1lbW9yeVJlc291cmNlQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBNZW1vcnkgUmVzb3VyY2UgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZU1lbW9yeVJlc291cmNlQXJuYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlTWVtb3J5UmVzb3VyY2VJZCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlTWVtb3J5Lm1lbW9yeVJlc291cmNlSWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIE1lbW9yeSBSZXNvdXJjZSBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BZ2VudENvcmVNZW1vcnlSZXNvdXJjZUlkYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEJyb3dzZXIgT3V0cHV0c1xuICAgIGlmICh0aGlzLmFnZW50Q29yZUJyb3dzZXI/LmJyb3dzZXJGdW5jdGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZUJyb3dzZXJGdW5jdGlvbkFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlQnJvd3Nlci5icm93c2VyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIEJyb3dzZXIgTGFtYmRhIEZ1bmN0aW9uIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BZ2VudENvcmVCcm93c2VyRnVuY3Rpb25Bcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQ29kZUludGVycHJldGVyIE91dHB1dHNcbiAgICBpZiAodGhpcy5hZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXI/LmludGVycHJldGVyRnVuY3Rpb24pIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXJGdW5jdGlvbkFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlQ29kZUludGVycHJldGVyLmludGVycHJldGVyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIENvZGVJbnRlcnByZXRlciBMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZUNvZGVJbnRlcnByZXRlckZ1bmN0aW9uQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCfinIUgQWdlbnRDb3JlIE91dHB1dHPkvZzmiJDlrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDnkrDlooPoqK3lrprjga7mpJzoqLxcbiAgICogVGFzayA2LjM6IOaJi+WLleWvvuWHpumDqOWIhuOBruiHquWLleWMllxuICAgKi9cbiAgcHJpdmF0ZSB2YWxpZGF0ZUVudmlyb25tZW50Q29uZmlndXJhdGlvbihcbiAgICBjb25maWc6IFdlYkFwcFN0YWNrQ29uZmlnLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/CflI0g55Kw5aKD6Kit5a6a5qSc6Ki86ZaL5aeLLi4uJyk7XG4gICAgXG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIC8vIEJlZHJvY2sgQWdlbnToqK3lrprjga7mpJzoqLxcbiAgICBpZiAoY29uZmlnLmJlZHJvY2tBZ2VudD8uZW5hYmxlZCkge1xuICAgICAgY29uc3QgYWdlbnRDb25maWcgPSBjb25maWcuYmVkcm9ja0FnZW50O1xuICAgICAgXG4gICAgICAvLyBBZGQgZGVmYXVsdCB2YWx1ZXMgZm9yIG1pc3NpbmcgcHJvcGVydGllc1xuICAgICAgY29uc3QgZXh0ZW5kZWRBZ2VudENvbmZpZyA9IHtcbiAgICAgICAgLi4uYWdlbnRDb25maWcsXG4gICAgICAgIGFnZW50SWQ6IChhZ2VudENvbmZpZyBhcyBhbnkpLmFnZW50SWQgfHwgKGVudmlyb25tZW50ID09PSBcInByb2RcIiA/IFwiMU5XUUpUSU1BSFwiIDogXCJQWENFWDg3WTA5XCIpLFxuICAgICAgICBhZ2VudEFsaWFzSWQ6IChhZ2VudENvbmZpZyBhcyBhbnkpLmFnZW50QWxpYXNJZCB8fCBcIlRTVEFMSUFTSURcIixcbiAgICAgICAgcmVnaW9uOiAoYWdlbnRDb25maWcgYXMgYW55KS5yZWdpb24gfHwgXCJhcC1ub3J0aGVhc3QtMVwiXG4gICAgICB9O1xuXG4gICAgICBpZiAoIWV4dGVuZGVkQWdlbnRDb25maWcuYWdlbnRJZCB8fCBleHRlbmRlZEFnZW50Q29uZmlnLmFnZW50SWQgPT09ICdQTEFDRUhPTERFUl9BR0VOVF9JRCcpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goJ0JlZHJvY2sgQWdlbnQgSUQg44GM6Kit5a6a44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgICB9IGVsc2UgaWYgKCEvXltBLVowLTldezEwfSQvLnRlc3QoZXh0ZW5kZWRBZ2VudENvbmZpZy5hZ2VudElkKSkge1xuICAgICAgICBlcnJvcnMucHVzaChgQmVkcm9jayBBZ2VudCBJRCDjga7lvaLlvI/jgYznhKHlirnjgafjgZk6ICR7ZXh0ZW5kZWRBZ2VudENvbmZpZy5hZ2VudElkfWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoIWV4dGVuZGVkQWdlbnRDb25maWcuYWdlbnRBbGlhc0lkIHx8IGV4dGVuZGVkQWdlbnRDb25maWcuYWdlbnRBbGlhc0lkID09PSAnVFNUQUxJQVNJRCcpIHtcbiAgICAgICAgd2FybmluZ3MucHVzaCgnQmVkcm9jayBBZ2VudCBBbGlhcyBJRCDjgYzjg4fjg5Xjgqnjg6vjg4jlgKTjgafjgZknKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKCFleHRlbmRlZEFnZW50Q29uZmlnLnJlZ2lvbikge1xuICAgICAgICBlcnJvcnMucHVzaCgnQmVkcm9jayBBZ2VudCDjg6rjg7zjgrjjg6fjg7PjgYzoqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g55Kw5aKD5Yil5pyf5b6F5YCk44Gu5qSc6Ki8XG4gICAgICBpZiAoZW52aXJvbm1lbnQgPT09ICdwcm9kJyAmJiBleHRlbmRlZEFnZW50Q29uZmlnLmFnZW50SWQgIT09ICcxTldRSlRJTUFIJykge1xuICAgICAgICBlcnJvcnMucHVzaChg5pys55Wq55Kw5aKD44GuQWdlbnQgSUTjgYzmnJ/lvoXlgKTjgajnlbDjgarjgorjgb7jgZnjgILmnJ/lvoXlgKQ6IDFOV1FKVElNQUgsIOWun+mam+WApDogJHtleHRlbmRlZEFnZW50Q29uZmlnLmFnZW50SWR9YCk7XG4gICAgICB9IGVsc2UgaWYgKGVudmlyb25tZW50ID09PSAnZGV2JyAmJiBleHRlbmRlZEFnZW50Q29uZmlnLmFnZW50SWQgIT09ICdQWENFWDg3WTA5Jykge1xuICAgICAgICBlcnJvcnMucHVzaChg6ZaL55m655Kw5aKD44GuQWdlbnQgSUTjgYzmnJ/lvoXlgKTjgajnlbDjgarjgorjgb7jgZnjgILmnJ/lvoXlgKQ6IFBYQ0VYODdZMDksIOWun+mam+WApDogJHtleHRlbmRlZEFnZW50Q29uZmlnLmFnZW50SWR9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOODl+ODreOCuOOCp+OCr+ODiOioreWumuOBruaknOiovFxuICAgIGNvbnN0IHByb2plY3ROYW1lID0gY29uZmlnLm5hbWluZz8ucHJvamVjdE5hbWUgfHwgY29uZmlnLnByb2plY3Q/Lm5hbWU7XG4gICAgaWYgKCFwcm9qZWN0TmFtZSkge1xuICAgICAgZXJyb3JzLnB1c2goJ+ODl+ODreOCuOOCp+OCr+ODiOWQjeOBjOioreWumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBlbnZOYW1lID0gY29uZmlnLm5hbWluZz8uZW52aXJvbm1lbnQgfHwgY29uZmlnLmVudmlyb25tZW50O1xuICAgIGlmICghZW52TmFtZSkge1xuICAgICAgZXJyb3JzLnB1c2goJ+eSsOWig+WQjeOBjOioreWumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH0gZWxzZSBpZiAoZW52TmFtZSAhPT0gZW52aXJvbm1lbnQpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goYOioreWumuODleOCoeOCpOODq+OBrueSsOWig+WQjSgke2Vudk5hbWV9KeOBqOODh+ODl+ODreOCpOeSsOWigygke2Vudmlyb25tZW50fSnjgYznlbDjgarjgorjgb7jgZlgKTtcbiAgICB9XG4gICAgXG4gICAgLy8g44Oq44O844K444On44Oz6Kit5a6a44Gu5qSc6Ki8XG4gICAgY29uc3QgcmVnaW9uID0gY29uZmlnLmFpPy5iZWRyb2NrPy5yZWdpb247XG4gICAgaWYgKHJlZ2lvbiAmJiAhL15bYS16XSstW2Etel0rLVswLTldKyQvLnRlc3QocmVnaW9uKSkge1xuICAgICAgZXJyb3JzLnB1c2goYOODquODvOOCuOODp+ODs+W9ouW8j+OBjOeEoeWKueOBp+OBmTogJHtyZWdpb259YCk7XG4gICAgfVxuICAgIFxuICAgIC8vIOaknOiovOe1kOaenOOBruWHuuWKm1xuICAgIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc29sZS5sb2coJ+KdjCDoqK3lrprmpJzoqLzjgqjjg6njg7w6Jyk7XG4gICAgICBlcnJvcnMuZm9yRWFjaChlcnJvciA9PiBjb25zb2xlLmxvZyhgICAgLSAke2Vycm9yfWApKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg6Kit5a6a5qSc6Ki844Gr5aSx5pWX44GX44G+44GX44Gf44CCJHtlcnJvcnMubGVuZ3RofeWAi+OBruOCqOODqeODvOOBjOOBguOCiuOBvuOBmeOAgmApO1xuICAgIH1cbiAgICBcbiAgICBpZiAod2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgY29uc29sZS5sb2coJ+KaoO+4jyDoqK3lrprmpJzoqLzorablkYo6Jyk7XG4gICAgICB3YXJuaW5ncy5mb3JFYWNoKHdhcm5pbmcgPT4gY29uc29sZS5sb2coYCAgIC0gJHt3YXJuaW5nfWApKTtcbiAgICB9XG4gICAgXG4gICAgY29uc29sZS5sb2coJ+KchSDnkrDlooPoqK3lrprmpJzoqLzlrozkuoYnKTtcbiAgfVxufVxuIl19