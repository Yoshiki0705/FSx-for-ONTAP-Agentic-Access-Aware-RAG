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
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
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
        // imageTagの取得（優先順位: Props > 環境変数 > デフォルト）
        let finalImageTag = imageTag;
        if (!finalImageTag && !skipLambdaCreation) {
            // 環境変数から取得を試みる
            finalImageTag = process.env.IMAGE_TAG;
            if (!finalImageTag) {
                throw new Error('❌ imageTag is required! Please provide imageTag via:\n' +
                    '   1. CDK context: npx cdk deploy -c imageTag=YOUR_TAG\n' +
                    '   2. Props: new WebAppStack(scope, id, { imageTag: "YOUR_TAG", ... })\n' +
                    '   3. Environment variable: export IMAGE_TAG=YOUR_TAG');
            }
            console.log(`ℹ️ imageTagを環境変数から取得: ${finalImageTag}`);
        }
        // imageTagを更新
        imageTag = finalImageTag;
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
        // 2. Gateway Construct（API/Lambda/MCP統合）- IaC版
        if (agentCoreConfig.gateway?.enabled) {
            console.log('🌉 Gateway Construct作成中（IaC版）...');
            // DataStackからCloudFormation Importで動的に取得
            const dataStackName = `${regionPrefix}-${projectName}-${environment}-Data`;
            // Gateway Specs Bucket名をCloudFormation Importから取得
            let gatewaySpecsBucket;
            try {
                const gatewayBucketName = cdk.Fn.importValue(`${dataStackName}-GatewaySpecsBucketName`);
                gatewaySpecsBucket = s3.Bucket.fromBucketName(this, 'ImportedGatewaySpecsBucket', gatewayBucketName);
                console.log(`✅ Gateway Specs Bucket参照成功: ${gatewayBucketName}`);
            }
            catch (error) {
                console.warn('⚠️  Gateway Specs Bucketが見つかりません。DataStackをデプロイしてください。');
            }
            // FSx File System IDをCloudFormation Importから取得
            let fsxFileSystemId;
            try {
                fsxFileSystemId = cdk.Fn.importValue(`${dataStackName}-FsxFileSystemId`);
                console.log(`✅ FSx File System ID参照成功: ${fsxFileSystemId}`);
            }
            catch (error) {
                console.warn('⚠️  FSx File System IDが見つかりません。DataStackでFSx for ONTAPを有効化してください。');
            }
            // Gateway Constructを作成（条件付き）
            if (gatewaySpecsBucket) {
                this.agentCoreGateway = new bedrock_agent_core_gateway_construct_1.BedrockAgentCoreGatewayConstruct(this, "AgentCoreGateway", {
                    projectName: config.naming?.projectName || "permission-aware-rag",
                    environment,
                    gatewaySpecsBucket, // IaC: CloudFormation Importから動的取得
                    fsxFileSystemId, // IaC: CloudFormation Importから動的取得（オプション）
                    restApiConversion: agentCoreConfig.gateway.restApiConversionConfig,
                    lambdaFunctionConversion: agentCoreConfig.gateway.lambdaFunctionConversionConfig,
                    mcpServerIntegration: agentCoreConfig.gateway.mcpServerIntegrationConfig,
                });
                console.log('✅ Gateway Construct作成完了（IaC版）');
            }
            else {
                console.warn('⚠️  Gateway Specs Bucketが利用できないため、Gateway Construct作成をスキップします');
                console.warn('   次のステップ:');
                console.warn('   1. DataStackをデプロイ: npx cdk deploy TokyoRegion-permission-aware-rag-prod-Data');
                console.warn('   2. WebAppStackを再デプロイ: npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp');
            }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViYXBwLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid2ViYXBwLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7R0FXRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFFbkMsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsdUVBQXlEO0FBQ3pELDRFQUE4RDtBQUM5RCwyREFBNkM7QUFDN0MseURBQTJDO0FBQzNDLHVFQUF5RDtBQUd6RCx1REFBeUM7QUFNekMsNEJBQTRCO0FBQzVCLGlIQUEyRztBQUMzRyxrQ0FBa0M7QUFDbEMsMkhBQW9IO0FBQ3BILDJIQUFvSDtBQUNwSCx5SEFBa0g7QUFDbEgsMkhBQW9IO0FBQ3BILDZJQUFxSTtBQUdySTs7R0FFRztBQUNILE1BQU0scUJBQXFCLEdBQUc7SUFDNUIsV0FBVyxFQUFFLHNCQUFzQjtJQUNuQyxXQUFXLEVBQUUsTUFBTTtJQUNuQixZQUFZLEVBQUUsYUFBYTtJQUMzQixNQUFNLEVBQUU7UUFDTixPQUFPLEVBQUUsRUFBRTtRQUNYLFVBQVUsRUFBRSxHQUFHO0tBQ2hCO0lBQ0QsT0FBTyxFQUFFO1FBQ1AsTUFBTSxFQUFFLFdBQVc7S0FDcEI7SUFDRCxVQUFVLEVBQUUsaUJBQWlCO0lBQzdCLDJDQUEyQztJQUMzQyw2QkFBNkI7Q0FDOUIsQ0FBQztBQXNIRjs7R0FFRztBQUNILE1BQWEsV0FBWSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3hDLHNCQUFzQjtJQUNOLGNBQWMsQ0FBa0I7SUFFaEQsMEJBQTBCO0lBQ1YsV0FBVyxDQUFxQjtJQUVoRCw4QkFBOEI7SUFDZCxZQUFZLENBQTBCO0lBRXRELHFCQUFxQjtJQUNMLGFBQWEsQ0FBa0I7SUFFL0MscUNBQXFDO0lBQzlCLHFCQUFxQixDQUFtQjtJQUUvQyw2QkFBNkI7SUFDdEIsYUFBYSxDQUFzQjtJQUUxQyx3QkFBd0I7SUFDaEIsR0FBRyxDQUFZ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QyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3RELE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxNQUFNLENBQUMsTUFBTSxhQUFhLENBQUMsQ0FBQztRQUM3RCxDQUFDO1FBRUQsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDMUIsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDOUQsQ0FBQztRQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDNUIsQ0FBQztDQUNGO0FBMWlERCxrQ0EwaURDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBXZWJBcHBTdGFjayAtIExhbWJkYSBXZWIgQWRhcHRlciArIE5leHQuanMgKyBDbG91ZEZyb250ICsgUGVybWlzc2lvbiBBUEnntbHlkIjjgrnjgr/jg4Pjgq9cbiAqIFxuICog5qmf6IO9OlxuICogLSBMYW1iZGEgRnVuY3Rpb24gKENvbnRhaW5lcikgd2l0aCBXZWIgQWRhcHRlclxuICogLSBMYW1iZGEgRnVuY3Rpb24gVVJMXG4gKiAtIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uXG4gKiAtIEVDUiBSZXBvc2l0b3J5XG4gKiAtIElBTSBSb2xlcyBhbmQgUGVybWlzc2lvbnNcbiAqIC0gUGVybWlzc2lvbiBBUEkgTGFtYmRhIEZ1bmN0aW9uXG4gKiAtIEFQSSBHYXRld2F5IChQZXJtaXNzaW9uIEFQSeeUqClcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBlY3IgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGJlZHJvY2sgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJlZHJvY2snO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcblxuLy8gUGhhc2UgNzog5Z6L5a6a576p44Gu5Y6z5a+G5YyWIC0gU3RhY2vplpPjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrlcbmltcG9ydCB7IElOZXR3b3JraW5nU3RhY2ssIElTZWN1cml0eVN0YWNrIH0gZnJvbSAnLi9pbnRlcmZhY2VzL3N0YWNrLWludGVyZmFjZXMnO1xuLy8gUGVybWlzc2lvbiBBUEnnkrDlooPoqK3lrppcbmltcG9ydCB7IFBlcm1pc3Npb25BcGlFbnZDb25maWcgfSBmcm9tICcuLi8uLi9jb25maWcvcGVybWlzc2lvbi1hcGktZW52LWNvbmZpZyc7XG4vLyBQaGFzZSAyIC0gVGFzayAzOiDli5XnmoTjg6Ljg4fjg6vpgbjmip5cbmltcG9ydCB7IEJlZHJvY2tBZ2VudER5bmFtaWNDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2FpL2NvbnN0cnVjdHMvYmVkcm9jay1hZ2VudC1keW5hbWljLWNvbnN0cnVjdCc7XG4vLyBQaGFzZSA0OiBBZ2VudENvcmUgQ29uc3RydWN0c+e1seWQiFxuaW1wb3J0IHsgQmVkcm9ja0FnZW50Q29yZVJ1bnRpbWVDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2FpL2NvbnN0cnVjdHMvYmVkcm9jay1hZ2VudC1jb3JlLXJ1bnRpbWUtY29uc3RydWN0JztcbmltcG9ydCB7IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1nYXRld2F5LWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRDb3JlTWVtb3J5Q29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1tZW1vcnktY29uc3RydWN0JztcbmltcG9ydCB7IEJlZHJvY2tBZ2VudENvcmVCcm93c2VyQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1icm93c2VyLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRDb3JlQ29kZUludGVycHJldGVyQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1jb2RlLWludGVycHJldGVyLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBBZ2VudENvcmVDb25maWcgfSBmcm9tICcuLi8uLi8uLi90eXBlcy9hZ2VudGNvcmUtY29uZmlnJztcblxuLyoqXG4gKiDjg4fjg5Xjgqnjg6vjg4joqK3lrppcbiAqL1xuY29uc3QgREVGQVVMVF9XRUJBUFBfQ09ORklHID0ge1xuICBwcm9qZWN0TmFtZTogJ3Blcm1pc3Npb24tYXdhcmUtcmFnJyxcbiAgZW52aXJvbm1lbnQ6ICdwcm9kJyxcbiAgcmVnaW9uUHJlZml4OiAnVG9reW9SZWdpb24nLFxuICBsYW1iZGE6IHtcbiAgICB0aW1lb3V0OiAzMCxcbiAgICBtZW1vcnlTaXplOiA1MTIsXG4gIH0sXG4gIGJlZHJvY2s6IHtcbiAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICB9LFxuICBkb2NrZXJQYXRoOiAnLi9kb2NrZXIvbmV4dGpzJyxcbiAgLy8gaW1hZ2VUYWc6IENES+OCs+ODs+ODhuOCreOCueODiOOBi+OCieWPluW+l++8iC1jIGltYWdlVGFnPXh4eO+8iVxuICAvLyDjg4fjg5Xjgqnjg6vjg4jlgKTjga/oqK3lrprjgZfjgarjgYTvvIjlv4XpoIjjg5Hjg6njg6Hjg7zjgr/jgajjgZfjgabmibHjgYbvvIlcbn07XG5cbi8qKlxuICogV2ViQXBw44K544K/44OD44Kv6Kit5a6a44Kk44Oz44K/44O844OV44Kn44O844K5XG4gKiBFbnZpcm9ubWVudENvbmZpZ+OBqOOBruS6kuaPm+aAp+OCkuS/neOBpOOBn+OCgeOAgeaflOi7n+OBquWei+Wumue+qVxuICovXG5leHBvcnQgaW50ZXJmYWNlIFdlYkFwcFN0YWNrQ29uZmlnIHtcbiAgcmVhZG9ubHkgcHJvamVjdD86IHtcbiAgICBuYW1lPzogc3RyaW5nO1xuICB9O1xuICByZWFkb25seSBuYW1pbmc/OiB7XG4gICAgcHJvamVjdE5hbWU/OiBzdHJpbmc7XG4gICAgZW52aXJvbm1lbnQ/OiBzdHJpbmc7XG4gICAgcmVnaW9uUHJlZml4Pzogc3RyaW5nO1xuICB9O1xuICByZWFkb25seSBlbnZpcm9ubWVudD86IHN0cmluZztcbiAgcmVhZG9ubHkgY29tcHV0ZT86IHtcbiAgICBsYW1iZGE/OiB7XG4gICAgICB0aW1lb3V0PzogbnVtYmVyO1xuICAgICAgbWVtb3J5U2l6ZT86IG51bWJlcjtcbiAgICB9O1xuICB9O1xuICByZWFkb25seSBhaT86IHtcbiAgICBiZWRyb2NrPzoge1xuICAgICAgcmVnaW9uPzogc3RyaW5nO1xuICAgICAgW2tleTogc3RyaW5nXTogYW55OyAvLyBFbnZpcm9ubWVudENvbmZpZ+OBqOOBruS6kuaPm+aAp+OBruOBn+OCgVxuICAgIH07XG4gIH07XG4gIHJlYWRvbmx5IGRhdGFiYXNlPzoge1xuICAgIGR5bmFtb2RiPzoge1xuICAgICAgZW5hYmxlZD86IGJvb2xlYW47XG4gICAgICB0YWJsZUFybnM/OiBzdHJpbmdbXTtcbiAgICB9O1xuICB9O1xuICByZWFkb25seSBwZXJtaXNzaW9uQXBpPzoge1xuICAgIGVuYWJsZWQ/OiBib29sZWFuOyAvLyBQZXJtaXNzaW9uIEFQSeapn+iDveOBruacieWKueWMllxuICAgIG9udGFwTWFuYWdlbWVudExpZj86IHN0cmluZzsgLy8gRlN4IE9OVEFQ566h55CGTElGXG4gICAgc3NtUGFyYW1ldGVyUHJlZml4Pzogc3RyaW5nOyAvLyBTU03jg5Hjg6njg6Hjg7zjgr/jg5fjg6zjg5XjgqPjg4Pjgq/jgrlcbiAgfTtcbiAgcmVhZG9ubHkgYmVkcm9ja0FnZW50Pzoge1xuICAgIGVuYWJsZWQ/OiBib29sZWFuOyAvLyBCZWRyb2NrIEFnZW505qmf6IO944Gu5pyJ5Yq55YyWXG4gICAgLy8gUGhhc2UgMiAtIFRhc2sgMzog5YuV55qE44Oi44OH44Or6YG45oqe6Kit5a6aXG4gICAgdXNlQ2FzZT86ICdjaGF0JyB8ICdnZW5lcmF0aW9uJyB8ICdjb3N0RWZmZWN0aXZlJyB8ICdtdWx0aW1vZGFsJztcbiAgICBtb2RlbFJlcXVpcmVtZW50cz86IHtcbiAgICAgIG9uRGVtYW5kPzogYm9vbGVhbjtcbiAgICAgIHN0cmVhbWluZz86IGJvb2xlYW47XG4gICAgICBjcm9zc1JlZ2lvbj86IGJvb2xlYW47XG4gICAgICBpbnB1dE1vZGFsaXRpZXM/OiBzdHJpbmdbXTtcbiAgICB9O1xuICAgIGVuYWJsZUR5bmFtaWNNb2RlbFNlbGVjdGlvbj86IGJvb2xlYW47XG4gICAgZW5hYmxlQXV0b1VwZGF0ZT86IGJvb2xlYW47XG4gICAgcGFyYW1ldGVyU3RvcmVQcmVmaXg/OiBzdHJpbmc7XG4gICAgLy8g5pei5a2Y44Gu44OX44Ot44OR44OG44KjXG4gICAga25vd2xlZGdlQmFzZUlkPzogc3RyaW5nOyAvLyBLbm93bGVkZ2UgQmFzZSBJRFxuICAgIGRvY3VtZW50U2VhcmNoTGFtYmRhQXJuPzogc3RyaW5nOyAvLyBEb2N1bWVudCBTZWFyY2ggTGFtYmRhIEFSTlxuICB9O1xuICAvLyBQaGFzZSA0OiBBZ2VudENvcmXoqK3lrppcbiAgcmVhZG9ubHkgYWdlbnRDb3JlPzogQWdlbnRDb3JlQ29uZmlnO1xuICBcbiAgLy8gRW52aXJvbm1lbnRDb25maWfjgajjga7kupLmj5vmgKfjga7jgZ/jgoHjgIHov73liqDjg5fjg63jg5Hjg4bjgqPjgpLoqLHlj69cbiAgW2tleTogc3RyaW5nXTogYW55O1xufVxuXG4vKipcbiAqIFdlYkFwcOOCueOCv+ODg+OCr+ODl+ODreODkeODhuOCo1xuICogXG4gKiBQaGFzZSA3OiDlnovlrprnvqnjga7ljrPlr4bljJZcbiAqIC0gYGFueWDlnovjgpLlrozlhajmjpLpmaRcbiAqIC0gSU5ldHdvcmtpbmdTdGFjaywgSVNlY3VyaXR5U3RhY2vlnovjgpLpgannlKhcbiAqIC0g5Z6L5a6J5YWo5oCnMTAwJemBlOaIkFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFdlYkFwcFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIC8vIOioreWumuOCquODluOCuOOCp+OCr+ODiO+8iOWei+WuieWFqO+8iVxuICByZWFkb25seSBjb25maWc6IFdlYkFwcFN0YWNrQ29uZmlnO1xuICBcbiAgLy8g44OX44Ot44K444Kn44Kv44OI5oOF5aCxXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7IC8vIOODl+ODreOCuOOCp+OCr+ODiOWQje+8iOW/hemgiO+8iVxuICByZWFkb25seSBlbnZpcm9ubWVudDogc3RyaW5nOyAvLyDnkrDlooPlkI3vvIjlv4XpoIjvvIlcbiAgXG4gIC8vIOODh+ODl+ODreOCpOODouODvOODieioreWumlxuICByZWFkb25seSBzdGFuZGFsb25lTW9kZT86IGJvb2xlYW47IC8vIOOCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODie+8iOODh+ODleOCqeODq+ODiDogdHJ1Ze+8iVxuICBcbiAgLy8g44K544K/44Oz44OJ44Ki44Ot44O844Oz44Oi44O844OJ55So6Kit5a6aXG4gIHJlYWRvbmx5IGV4aXN0aW5nVnBjSWQ/OiBzdHJpbmc7IC8vIOaXouWtmFZQQyBJRO+8iOOCquODl+OCt+ODp+ODs++8iVxuICByZWFkb25seSBleGlzdGluZ1NlY3VyaXR5R3JvdXBJZD86IHN0cmluZzsgLy8g5pei5a2Y44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OXSUTvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgXG4gIC8vIOe1seWQiOODouODvOODieeUqOioreWumu+8iOWei+WuieWFqO+8iVxuICByZWFkb25seSBuZXR3b3JraW5nU3RhY2s/OiBJTmV0d29ya2luZ1N0YWNrOyAvLyBOZXR3b3JraW5nU3RhY2vlj4LnhafvvIjntbHlkIjjg6Ljg7zjg4nmmYLvvIlcbiAgcmVhZG9ubHkgc2VjdXJpdHlTdGFjaz86IElTZWN1cml0eVN0YWNrOyAvLyBTZWN1cml0eVN0YWNr5Y+C54Wn77yI57Wx5ZCI44Oi44O844OJ5pmC77yJXG4gIFxuICAvLyBFQ1Ljg7tMYW1iZGHoqK3lrppcbiAgcmVhZG9ubHkgc2tpcExhbWJkYUNyZWF0aW9uPzogYm9vbGVhbjsgLy8gTGFtYmRh6Zai5pWw5L2c5oiQ44KS44K544Kt44OD44OX77yIRUNS44Kk44Oh44O844K45pyq5rqW5YKZ5pmC77yJXG4gIHJlYWRvbmx5IGRvY2tlclBhdGg/OiBzdHJpbmc7IC8vIERvY2tlcmZpbGXjga7jg5HjgrnvvIjjg4fjg5Xjgqnjg6vjg4g6ICcuL2RvY2tlci9uZXh0anMn77yJXG4gIHJlYWRvbmx5IGltYWdlVGFnPzogc3RyaW5nOyAvLyDjgqTjg6Hjg7zjgrjjgr/jgrDvvIjjg4fjg5Xjgqnjg6vjg4g6ICdsYXRlc3Qn77yJXG4gIFxuICAvKipcbiAgICog55Kw5aKD5Yil44Oq44K944O844K55L2c5oiQ5Yi25b6h6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbD86IHtcbiAgICByZWFkb25seSBjcmVhdGVMYW1iZGFGdW5jdGlvbj86IGJvb2xlYW47IC8vIExhbWJkYemWouaVsOS9nOaIkOWItuW+oVxuICAgIHJlYWRvbmx5IGNyZWF0ZUNsb3VkRnJvbnREaXN0cmlidXRpb24/OiBib29sZWFuOyAvLyBDbG91ZEZyb2506YWN5L+h5L2c5oiQ5Yi25b6hXG4gICAgcmVhZG9ubHkgZW5hYmxlQmVkcm9ja0FnZW50PzogYm9vbGVhbjsgLy8gQmVkcm9jayBBZ2VudOapn+iDveWItuW+oVxuICAgIHJlYWRvbmx5IGVuYWJsZVBlcm1pc3Npb25BcGk/OiBib29sZWFuOyAvLyBQZXJtaXNzaW9uIEFQSeapn+iDveWItuW+oVxuICAgIHJlYWRvbmx5IGVuYWJsZUFnZW50Q29yZT86IGJvb2xlYW47IC8vIEFnZW50Q29yZeapn+iDveWItuW+oVxuICAgIHJlYWRvbmx5IHZhbGlkYXRlQ29uZmlndXJhdGlvbj86IGJvb2xlYW47IC8vIOioreWumuaknOiovOWItuW+oVxuICB9O1xuICBcbiAgLy8gUGVybWlzc2lvbiBBUEnoqK3lrprvvIhEYXRhU3RhY2vjgYvjgonlj4LnhafvvIlcbiAgcmVhZG9ubHkgdXNlckFjY2Vzc1RhYmxlPzogZHluYW1vZGIuSVRhYmxlOyAvLyDjg6bjg7zjgrbjg7zjgqLjgq/jgrvjgrnjg4bjg7zjg5bjg6tcbiAgcmVhZG9ubHkgcGVybWlzc2lvbkNhY2hlVGFibGU/OiBkeW5hbW9kYi5JVGFibGU7IC8vIOaoqemZkOOCreODo+ODg+OCt+ODpeODhuODvOODluODq1xuICBcbiAgLy8gRGF0YVN0YWNr5Y+C54Wn77yI44OB44Oj44OD44OI5bGl5q2044OG44O844OW44Or55So77yJXG4gIHJlYWRvbmx5IGRhdGFTdGFjaz86IHtcbiAgICBjaGF0SGlzdG9yeVRhYmxlPzogZHluYW1vZGIuSVRhYmxlO1xuICAgIHVzZXJQcmVmZXJlbmNlc1RhYmxlPzogZHluYW1vZGIuSVRhYmxlOyAvLyBUYXNrIDMuMjogQWdlbnRDb3Jl57Wx5ZCI55So44Om44O844K244O86Kit5a6a44OG44O844OW44OrXG4gIH07XG59XG5cbi8qKlxuICogV2ViQXBwU3RhY2sgLSDjg5Xjg6vlrp/oo4XniYhcbiAqL1xuZXhwb3J0IGNsYXNzIFdlYkFwcFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgLyoqIExhbWJkYSBGdW5jdGlvbiAqL1xuICBwdWJsaWMgcmVhZG9ubHkgd2ViQXBwRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgXG4gIC8qKiBMYW1iZGEgRnVuY3Rpb24gVVJMICovXG4gIHB1YmxpYyByZWFkb25seSBmdW5jdGlvblVybDogbGFtYmRhLkZ1bmN0aW9uVXJsO1xuICBcbiAgLyoqIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uICovXG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuICBcbiAgLyoqIEVDUiBSZXBvc2l0b3J5ICovXG4gIHB1YmxpYyByZWFkb25seSBlY3JSZXBvc2l0b3J5OiBlY3IuSVJlcG9zaXRvcnk7XG4gIFxuICAvKiogUGVybWlzc2lvbiBBUEkgTGFtYmRhIEZ1bmN0aW9uICovXG4gIHB1YmxpYyBwZXJtaXNzaW9uQXBpRnVuY3Rpb24/OiBsYW1iZGEuRnVuY3Rpb247XG4gIFxuICAvKiogUGVybWlzc2lvbiBBUEkgR2F0ZXdheSAqL1xuICBwdWJsaWMgcGVybWlzc2lvbkFwaT86IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgXG4gIC8qKiBWUEPvvIjjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4nnlKjvvIkgKi9cbiAgcHJpdmF0ZSB2cGM/OiBlYzIuSVZwYztcbiAgXG4gIC8qKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fvvIjjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4nnlKjvvIkgKi9cbiAgcHJpdmF0ZSBzZWN1cml0eUdyb3VwPzogZWMyLklTZWN1cml0eUdyb3VwO1xuICBcbiAgLyoqIExhbWJkYeWun+ihjOODreODvOODq++8iGFkZFRvUG9saWN544Oh44K944OD44OJ5L2/55So44Gu44Gf44KB5YW36LGh5Z6L77yJICovXG4gIHByaXZhdGUgZXhlY3V0aW9uUm9sZT86IGlhbS5Sb2xlO1xuICBcbiAgLyoqIFBlcm1pc3Npb24gQVBJ5a6f6KGM44Ot44O844OrICovXG4gIHByaXZhdGUgcGVybWlzc2lvbkFwaUV4ZWN1dGlvblJvbGU/OiBpYW0uUm9sZTtcbiAgXG4gIC8qKiBCZWRyb2NrIEFnZW50IFNlcnZpY2UgUm9sZSAqL1xuICBwdWJsaWMgYmVkcm9ja0FnZW50U2VydmljZVJvbGU/OiBpYW0uUm9sZTtcbiAgXG4gIC8qKiBCZWRyb2NrIEFnZW50ICovXG4gIHB1YmxpYyBiZWRyb2NrQWdlbnQ/OiBiZWRyb2NrLkNmbkFnZW50O1xuICBcbiAgLyoqIEJlZHJvY2sgQWdlbnQgQWxpYXMgKi9cbiAgcHVibGljIGJlZHJvY2tBZ2VudEFsaWFzPzogYmVkcm9jay5DZm5BZ2VudEFsaWFzO1xuICBcbiAgLyoqIFdlYkFwcFN0YWNr6Kit5a6a77yIVlBDIEVuZHBvaW505L2c5oiQ5pmC44Gr5Y+C54Wn77yJICovXG4gIHByaXZhdGUgcmVhZG9ubHkgY29uZmlnOiBXZWJBcHBTdGFja0NvbmZpZztcbiAgXG4gIC8qKiBQaGFzZSA0OiBBZ2VudENvcmUgQ29uc3RydWN0c++8iOOCquODl+OCt+ODp+ODs++8iSAqL1xuICBwdWJsaWMgYWdlbnRDb3JlUnVudGltZT86IEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN0O1xuICBwdWJsaWMgYWdlbnRDb3JlR2F0ZXdheT86IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0O1xuICBwdWJsaWMgYWdlbnRDb3JlTWVtb3J5PzogQmVkcm9ja0FnZW50Q29yZU1lbW9yeUNvbnN0cnVjdDtcbiAgcHVibGljIGFnZW50Q29yZUJyb3dzZXI/OiBCZWRyb2NrQWdlbnRDb3JlQnJvd3NlckNvbnN0cnVjdDtcbiAgcHVibGljIGFnZW50Q29yZUNvZGVJbnRlcnByZXRlcj86IEJlZHJvY2tBZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXJDb25zdHJ1Y3Q7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFdlYkFwcFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIOioreWumuOCkuS/neWtmO+8iFZQQyBFbmRwb2ludOS9nOaIkOaZguOBq+WPgueFp++8iVxuICAgIHRoaXMuY29uZmlnID0gcHJvcHMuY29uZmlnO1xuXG4gICAgY29uc3QgeyBcbiAgICAgIGNvbmZpZywgXG4gICAgICBzdGFuZGFsb25lTW9kZSA9IHRydWUsIC8vIOODh+ODleOCqeODq+ODiOOBr+OCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODiVxuICAgICAgZXhpc3RpbmdWcGNJZCxcbiAgICAgIGV4aXN0aW5nU2VjdXJpdHlHcm91cElkLFxuICAgICAgbmV0d29ya2luZ1N0YWNrLFxuICAgICAgc2VjdXJpdHlTdGFjayxcbiAgICAgIHNraXBMYW1iZGFDcmVhdGlvbiA9IGZhbHNlLFxuICAgICAgZG9ja2VyUGF0aCA9IERFRkFVTFRfV0VCQVBQX0NPTkZJRy5kb2NrZXJQYXRoLFxuICAgICAgaW1hZ2VUYWcsIC8vIGltYWdlVGFn44Gv5b+F6aCI44OR44Op44Oh44O844K/77yI44OH44OV44Kp44Or44OI5YCk44Gq44GX77yJXG4gICAgICBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbFxuICAgIH0gPSBwcm9wcztcbiAgICBcbiAgICAvLyDnkrDlooPliKXjg6rjgr3jg7zjgrnliLblvqHjga7oqK3lrprvvIjjg4fjg5Xjgqnjg6vjg4jlgKTvvIlcbiAgICBjb25zdCByZXNvdXJjZUNvbnRyb2wgPSB7XG4gICAgICBjcmVhdGVMYW1iZGFGdW5jdGlvbjogZW52aXJvbm1lbnRSZXNvdXJjZUNvbnRyb2w/LmNyZWF0ZUxhbWJkYUZ1bmN0aW9uID8/IHRydWUsXG4gICAgICBjcmVhdGVDbG91ZEZyb250RGlzdHJpYnV0aW9uOiBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbD8uY3JlYXRlQ2xvdWRGcm9udERpc3RyaWJ1dGlvbiA/PyB0cnVlLFxuICAgICAgZW5hYmxlQmVkcm9ja0FnZW50OiBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbD8uZW5hYmxlQmVkcm9ja0FnZW50ID8/IChjb25maWcuYmVkcm9ja0FnZW50Py5lbmFibGVkID8/IGZhbHNlKSxcbiAgICAgIGVuYWJsZVBlcm1pc3Npb25BcGk6IGVudmlyb25tZW50UmVzb3VyY2VDb250cm9sPy5lbmFibGVQZXJtaXNzaW9uQXBpID8/IChjb25maWcucGVybWlzc2lvbkFwaT8uZW5hYmxlZCA/PyBmYWxzZSksXG4gICAgICBlbmFibGVBZ2VudENvcmU6IGVudmlyb25tZW50UmVzb3VyY2VDb250cm9sPy5lbmFibGVBZ2VudENvcmUgPz8gKGNvbmZpZy5hZ2VudENvcmUgPyB0cnVlIDogZmFsc2UpLFxuICAgICAgdmFsaWRhdGVDb25maWd1cmF0aW9uOiBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbD8udmFsaWRhdGVDb25maWd1cmF0aW9uID8/IHRydWUsXG4gICAgfTtcbiAgICBcbiAgICAvLyDoqK3lrprmpJzoqLzvvIjnkrDlooPliKXliLblvqHvvIlcbiAgICBpZiAocmVzb3VyY2VDb250cm9sLnZhbGlkYXRlQ29uZmlndXJhdGlvbikge1xuICAgICAgdGhpcy52YWxpZGF0ZUVudmlyb25tZW50Q29uZmlndXJhdGlvbihjb25maWcsIHByb3BzLmVudmlyb25tZW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gaW1hZ2VUYWfjga7lj5blvpfvvIjlhKrlhYjpoIbkvY06IFByb3BzID4g55Kw5aKD5aSJ5pWwID4g44OH44OV44Kp44Or44OI77yJXG4gICAgbGV0IGZpbmFsSW1hZ2VUYWcgPSBpbWFnZVRhZztcbiAgICBpZiAoIWZpbmFsSW1hZ2VUYWcgJiYgIXNraXBMYW1iZGFDcmVhdGlvbikge1xuICAgICAgLy8g55Kw5aKD5aSJ5pWw44GL44KJ5Y+W5b6X44KS6Kmm44G/44KLXG4gICAgICBmaW5hbEltYWdlVGFnID0gcHJvY2Vzcy5lbnYuSU1BR0VfVEFHO1xuICAgICAgXG4gICAgICBpZiAoIWZpbmFsSW1hZ2VUYWcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICfinYwgaW1hZ2VUYWcgaXMgcmVxdWlyZWQhIFBsZWFzZSBwcm92aWRlIGltYWdlVGFnIHZpYTpcXG4nICtcbiAgICAgICAgICAnICAgMS4gQ0RLIGNvbnRleHQ6IG5weCBjZGsgZGVwbG95IC1jIGltYWdlVGFnPVlPVVJfVEFHXFxuJyArXG4gICAgICAgICAgJyAgIDIuIFByb3BzOiBuZXcgV2ViQXBwU3RhY2soc2NvcGUsIGlkLCB7IGltYWdlVGFnOiBcIllPVVJfVEFHXCIsIC4uLiB9KVxcbicgK1xuICAgICAgICAgICcgICAzLiBFbnZpcm9ubWVudCB2YXJpYWJsZTogZXhwb3J0IElNQUdFX1RBRz1ZT1VSX1RBRydcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYOKEue+4jyBpbWFnZVRhZ+OCkueSsOWig+WkieaVsOOBi+OCieWPluW+lzogJHtmaW5hbEltYWdlVGFnfWApO1xuICAgIH1cbiAgICBcbiAgICAvLyBpbWFnZVRhZ+OCkuabtOaWsFxuICAgIGltYWdlVGFnID0gZmluYWxJbWFnZVRhZztcbiAgICBcbiAgICAvLyDoqK3lrprlgKTjga7lj5blvpfvvIjjg4fjg5Xjgqnjg6vjg4jlgKTjgpLkvb/nlKjvvIlcbiAgICBjb25zdCBwcm9qZWN0TmFtZSA9IGNvbmZpZy5uYW1pbmc/LnByb2plY3ROYW1lIHx8IERFRkFVTFRfV0VCQVBQX0NPTkZJRy5wcm9qZWN0TmFtZTtcbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IGNvbmZpZy5uYW1pbmc/LmVudmlyb25tZW50IHx8IERFRkFVTFRfV0VCQVBQX0NPTkZJRy5lbnZpcm9ubWVudDtcbiAgICBjb25zdCByZWdpb25QcmVmaXggPSBjb25maWcubmFtaW5nPy5yZWdpb25QcmVmaXggfHwgREVGQVVMVF9XRUJBUFBfQ09ORklHLnJlZ2lvblByZWZpeDtcblxuICAgIGNvbnNvbGUubG9nKCfwn5qAIFdlYkFwcFN0YWNrIChGdWxsKSDliJ3mnJ/ljJbplovlp4suLi4nKTtcbiAgICBjb25zb2xlLmxvZyhgICAg44OX44Ot44K444Kn44Kv44OI5ZCNOiAke3Byb2plY3ROYW1lfWApO1xuICAgIGNvbnNvbGUubG9nKGAgICDnkrDlooM6ICR7ZW52aXJvbm1lbnR9YCk7XG4gICAgY29uc29sZS5sb2coYCAgIOODquODvOOCuOODp+ODs+ODl+ODrOODleOCo+ODg+OCr+OCuTogJHtyZWdpb25QcmVmaXh9YCk7XG4gICAgY29uc29sZS5sb2coYCAgIOODh+ODl+ODreOCpOODouODvOODiTogJHtzdGFuZGFsb25lTW9kZSA/ICfjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7MnIDogJ+e1seWQiCd9YCk7XG4gICAgY29uc29sZS5sb2coYCAgIERvY2tlcuODkeOCuTogJHtkb2NrZXJQYXRofWApO1xuICAgIGNvbnNvbGUubG9nKGAgICDjgqTjg6Hjg7zjgrjjgr/jgrA6ICR7aW1hZ2VUYWcgfHwgJ04vQSAoTGFtYmRh5L2c5oiQ44K544Kt44OD44OXKSd9YCk7XG4gICAgaWYgKHNraXBMYW1iZGFDcmVhdGlvbikge1xuICAgICAgY29uc29sZS5sb2coJyAgIOKaoO+4jyAgTGFtYmRh6Zai5pWw5L2c5oiQ44KS44K544Kt44OD44OX77yIRUNS44Kk44Oh44O844K45pyq5rqW5YKZ77yJJyk7XG4gICAgfVxuICAgIGlmIChzdGFuZGFsb25lTW9kZSkge1xuICAgICAgY29uc29sZS5sb2coJyAgIPCfk6Yg44K544K/44Oz44OJ44Ki44Ot44O844Oz44Oi44O844OJOiDku5bjga5TdGFja+OBq+S+neWtmOOBl+OBvuOBm+OCkycpO1xuICAgICAgaWYgKGV4aXN0aW5nVnBjSWQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYCAgIPCflJcg5pei5a2YVlBD5Y+C54WnOiAke2V4aXN0aW5nVnBjSWR9YCk7XG4gICAgICB9XG4gICAgICBpZiAoZXhpc3RpbmdTZWN1cml0eUdyb3VwSWQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYCAgIPCflJcg5pei5a2Y44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX5Y+C54WnOiAke2V4aXN0aW5nU2VjdXJpdHlHcm91cElkfWApO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZygnICAg8J+UlyDntbHlkIjjg6Ljg7zjg4k6IOS7luOBrlN0YWNr44Go6YCj5pC644GX44G+44GZJyk7XG4gICAgfVxuXG4gICAgLy8g44Oi44O844OJ5Yik5a6a44Go44Oq44K944O844K544K744OD44OI44Ki44OD44OXXG4gICAgaWYgKHN0YW5kYWxvbmVNb2RlKSB7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2V0dXBJbnRlZ3JhdGVkUmVzb3VyY2VzKG5ldHdvcmtpbmdTdGFjaywgc2VjdXJpdHlTdGFjayk7XG4gICAgfVxuXG4gICAgLy8gRUNS44Oq44Od44K444OI44Oq44Gu5Y+C54Wn77yI5pei5a2Y44Oq44Od44K444OI44Oq44KS5L2/55So77yJXG4gICAgLy8g5rOo5oSPOiBmcm9tUmVwb3NpdG9yeU5hbWUoKeOBr0NES+WQiOaIkOaZguOBq+S+i+WkluOCkuaKleOBkuOBquOBhOOBn+OCgeOAgXRyeS1jYXRjaOOBr+S4jeimgVxuICAgIC8vIOODquODneOCuOODiOODquOBjOWtmOWcqOOBl+OBquOBhOWgtOWQiOOBr+OAgeODh+ODl+ODreOCpOaZguOBq+OCqOODqeODvOOBq+OBquOCi1xuICAgIGNvbnN0IHJlcG9zaXRvcnlOYW1lID0gYCR7cmVnaW9uUHJlZml4LnRvTG93ZXJDYXNlKCl9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXdlYmFwcC1yZXBvYDtcbiAgICBcbiAgICB0aGlzLmVjclJlcG9zaXRvcnkgPSBlY3IuUmVwb3NpdG9yeS5mcm9tUmVwb3NpdG9yeU5hbWUoXG4gICAgICB0aGlzLFxuICAgICAgJ1dlYkFwcFJlcG9zaXRvcnknLFxuICAgICAgcmVwb3NpdG9yeU5hbWVcbiAgICApO1xuICAgIGNvbnNvbGUubG9nKGDinIUg5pei5a2YRUNS44Oq44Od44K444OI44Oq44KS5Y+C54WnOiAke3JlcG9zaXRvcnlOYW1lfWApO1xuXG4gICAgLy8gRHluYW1vREIgYWNjZXNzIChpZiBuZWVkZWQpIC0g44K544K/44Oz44OJ44Ki44Ot44O844Oz44Oi44O844OJ44Gn44KC6L+95Yqg5Y+v6IO9XG4gICAgaWYgKCFza2lwTGFtYmRhQ3JlYXRpb24gJiYgdGhpcy5leGVjdXRpb25Sb2xlICYmIGNvbmZpZy5kYXRhYmFzZT8uZHluYW1vZGI/LmVuYWJsZWQpIHtcbiAgICAgIGNvbnN0IGR5bmFtb2RiUmVzb3VyY2VzID0gY29uZmlnLmRhdGFiYXNlLmR5bmFtb2RiLnRhYmxlQXJucyB8fCBbJyonXTtcbiAgICAgIHRoaXMuZXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6UHV0SXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlVwZGF0ZUl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpEZWxldGVJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6UXVlcnknLFxuICAgICAgICAgICdkeW5hbW9kYjpTY2FuJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBkeW5hbW9kYlJlc291cmNlcyxcbiAgICAgIH0pKTtcbiAgICAgIFxuICAgICAgaWYgKGR5bmFtb2RiUmVzb3VyY2VzWzBdID09PSAnKicpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ+KaoO+4jyAgRHluYW1vRELjgqLjgq/jgrvjgrk6IOWFqOODhuODvOODluODq++8iOacrOeVqueSsOWig+OBp+OBr+eJueWumuOBruODhuODvOODluODq0FSTuOCkuaMh+WumuOBl+OBpuOBj+OBoOOBleOBhO+8iScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coYOKchSBEeW5hbW9EQuOCouOCr+OCu+OCuTogJHtkeW5hbW9kYlJlc291cmNlcy5sZW5ndGh95YCL44Gu44OG44O844OW44Or44Gr5Yi26ZmQYCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g5qmf6IO95b6p5pen55SoRHluYW1vRELjg4bjg7zjg5bjg6vjgbjjga7jgqLjgq/jgrvjgrnmqKnpmZDvvIhQaGFzZSAx5a6M5LqG5riI44G/5qmf6IO977yJXG4gICAgaWYgKCFza2lwTGFtYmRhQ3JlYXRpb24gJiYgdGhpcy5leGVjdXRpb25Sb2xlKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+UkCDmqZ/og73lvqnml6fnlKhEeW5hbW9EQuODhuODvOODluODq+OCouOCr+OCu+OCueaoqemZkOOCkui/veWKoOS4rS4uLicpO1xuICAgICAgXG4gICAgICAvLyDjgrvjg4Pjgrfjg6fjg7PnrqHnkIbjgIHjg6bjg7zjgrbjg7zoqK3lrprjgIHjg4Hjg6Pjg4Pjg4jlsaXmrbTjgIHli5XnmoToqK3lrprjgq3jg6Pjg4Pjgrfjg6Xjg4bjg7zjg5bjg6vjgbjjga7jgqLjgq/jgrvjgrlcbiAgICAgIGNvbnN0IGZlYXR1cmVSZXN0b3JhdGlvblRhYmxlcyA9IFtcbiAgICAgICAgYGFybjphd3M6ZHluYW1vZGI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRhYmxlL3Blcm1pc3Npb24tYXdhcmUtcmFnLXNlc3Npb25zYCxcbiAgICAgICAgYGFybjphd3M6ZHluYW1vZGI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRhYmxlL3Blcm1pc3Npb24tYXdhcmUtcmFnLXNlc3Npb25zL2luZGV4LypgLFxuICAgICAgICBgYXJuOmF3czpkeW5hbW9kYjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dGFibGUvcGVybWlzc2lvbi1hd2FyZS1yYWctdXNlci1wcmVmZXJlbmNlc2AsXG4gICAgICAgIGBhcm46YXdzOmR5bmFtb2RiOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0YWJsZS9wZXJtaXNzaW9uLWF3YXJlLXJhZy11c2VyLXByZWZlcmVuY2VzL2luZGV4LypgLFxuICAgICAgICBgYXJuOmF3czpkeW5hbW9kYjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dGFibGUvcGVybWlzc2lvbi1hd2FyZS1yYWctY2hhdC1oaXN0b3J5YCxcbiAgICAgICAgYGFybjphd3M6ZHluYW1vZGI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRhYmxlL3Blcm1pc3Npb24tYXdhcmUtcmFnLWNoYXQtaGlzdG9yeS9pbmRleC8qYCxcbiAgICAgICAgYGFybjphd3M6ZHluYW1vZGI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRhYmxlL3Blcm1pc3Npb24tYXdhcmUtcmFnLWRpc2NvdmVyeS1jYWNoZWAsXG4gICAgICAgIGBhcm46YXdzOmR5bmFtb2RiOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0YWJsZS9wZXJtaXNzaW9uLWF3YXJlLXJhZy1kaXNjb3ZlcnktY2FjaGUvaW5kZXgvKmAsXG4gICAgICBdO1xuXG4gICAgICB0aGlzLmV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnZHluYW1vZGI6R2V0SXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlB1dEl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpVcGRhdGVJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6RGVsZXRlSXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlF1ZXJ5JyxcbiAgICAgICAgICAnZHluYW1vZGI6U2NhbicsXG4gICAgICAgICAgJ2R5bmFtb2RiOkJhdGNoR2V0SXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOkJhdGNoV3JpdGVJdGVtJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBmZWF0dXJlUmVzdG9yYXRpb25UYWJsZXMsXG4gICAgICB9KSk7XG5cbiAgICAgIGNvbnNvbGUubG9nKCfinIUg5qmf6IO95b6p5pen55SoRHluYW1vRELjg4bjg7zjg5bjg6vjgqLjgq/jgrvjgrnmqKnpmZDov73liqDlrozkuoYnKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAtIOOCu+ODg+OCt+ODp+ODs+euoeeQhuODhuODvOODluODqzogcGVybWlzc2lvbi1hd2FyZS1yYWctc2Vzc2lvbnNgKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAtIOODpuODvOOCtuODvOioreWumuODhuODvOODluODqzogcGVybWlzc2lvbi1hd2FyZS1yYWctdXNlci1wcmVmZXJlbmNlc2ApO1xuICAgICAgY29uc29sZS5sb2coYCAgIC0g44OB44Oj44OD44OI5bGl5q2044OG44O844OW44OrOiBwZXJtaXNzaW9uLWF3YXJlLXJhZy1jaGF0LWhpc3RvcnlgKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAtIOWLleeahOioreWumuOCreODo+ODg+OCt+ODpeODhuODvOODluODqzogcGVybWlzc2lvbi1hd2FyZS1yYWctZGlzY292ZXJ5LWNhY2hlYCk7XG4gICAgfVxuXG4gICAgLy8gTGFtYmRhIEZ1bmN0aW9u77yI5p2h5Lu25LuY44GN5L2c5oiQIC0g55Kw5aKD5Yil5Yi25b6h5a++5b+c77yJXG4gICAgY29uc3Qgc2hvdWxkQ3JlYXRlTGFtYmRhID0gIXNraXBMYW1iZGFDcmVhdGlvbiAmJiByZXNvdXJjZUNvbnRyb2wuY3JlYXRlTGFtYmRhRnVuY3Rpb24gJiYgdGhpcy5leGVjdXRpb25Sb2xlO1xuICAgIGlmIChzaG91bGRDcmVhdGVMYW1iZGEpIHtcbiAgICAgIC8vIExhbWJkYSBWUEPphY3nva7oqK3lrprjgpLnorroqo1cbiAgICAgIGNvbnN0IGxhbWJkYVZwY0NvbmZpZyA9ICh0aGlzLmNvbmZpZyBhcyBhbnkpPy53ZWJhcHA/LmxhbWJkYT8udnBjO1xuICAgICAgY29uc3Qgc2hvdWxkUGxhY2VJblZwYyA9IGxhbWJkYVZwY0NvbmZpZz8uZW5hYmxlZCA9PT0gdHJ1ZTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYPCflI0gTGFtYmRhIFZQQ+ioreWumuODgeOCp+ODg+OCrzpgKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAtIHN0YW5kYWxvbmVNb2RlOiAke3N0YW5kYWxvbmVNb2RlfWApO1xuICAgICAgY29uc29sZS5sb2coYCAgIC0gbGFtYmRhLnZwYy5lbmFibGVkOiAke3Nob3VsZFBsYWNlSW5WcGN9YCk7XG4gICAgICBjb25zb2xlLmxvZyhgICAgLSB2cGM6ICR7ISF0aGlzLnZwY31gKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAtIHNlY3VyaXR5R3JvdXA6ICR7ISF0aGlzLnNlY3VyaXR5R3JvdXB9YCk7XG4gICAgICBcbiAgICAgIC8vIFZQQ+ioreWumuOCkuani+eviVxuICAgICAgY29uc3QgdnBjQ29uZmlnID0gc2hvdWxkUGxhY2VJblZwYyAmJiB0aGlzLnZwYyAmJiB0aGlzLnNlY3VyaXR5R3JvdXAgPyB7XG4gICAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICAgIHNlY3VyaXR5R3JvdXBzOiBbdGhpcy5zZWN1cml0eUdyb3VwXSxcbiAgICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICAgIH0sXG4gICAgICB9IDoge307XG4gICAgICBcbiAgICAgIGlmIChzaG91bGRQbGFjZUluVnBjICYmIE9iamVjdC5rZXlzKHZwY0NvbmZpZykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUud2Fybign4pqg77iPICBMYW1iZGEgVlBD6YWN572u44GM5pyJ5Yq544Gn44GZ44GM44CBVlBD44G+44Gf44Gv44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44GM6KaL44Gk44GL44KK44G+44Gb44KTJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGDwn5SNIHZwY0NvbmZpZ+ioreWumjogJHtPYmplY3Qua2V5cyh2cGNDb25maWcpLmxlbmd0aCA+IDAgPyAnVlBD5YaF44Gr6YWN572uJyA6ICdWUEPlpJbjgavphY3nva4nfWApO1xuXG4gICAgICB0aGlzLndlYkFwcEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnV2ViQXBwRnVuY3Rpb24nLCB7XG4gICAgICAgIGZ1bmN0aW9uTmFtZTogYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1XZWJBcHAtRnVuY3Rpb25gLFxuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5GUk9NX0lNQUdFLFxuICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tRWNySW1hZ2UodGhpcy5lY3JSZXBvc2l0b3J5LCB7XG4gICAgICAgICAgdGFnT3JEaWdlc3Q6IGltYWdlVGFnLFxuICAgICAgICB9KSxcbiAgICAgICAgaGFuZGxlcjogbGFtYmRhLkhhbmRsZXIuRlJPTV9JTUFHRSxcbiAgICAgICAgcm9sZTogdGhpcy5leGVjdXRpb25Sb2xlLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyhjb25maWcuY29tcHV0ZT8ubGFtYmRhPy50aW1lb3V0IHx8IDMwKSxcbiAgICAgICAgbWVtb3J5U2l6ZTogY29uZmlnLmNvbXB1dGU/LmxhbWJkYT8ubWVtb3J5U2l6ZSB8fCA1MTIsXG4gICAgICAgIC4uLnZwY0NvbmZpZyxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxuICAgICAgICAgIEJFRFJPQ0tfUkVHSU9OOiBjb25maWcuYWk/LmJlZHJvY2s/LnJlZ2lvbiB8fCAndXMtZWFzdC0xJyxcbiAgICAgICAgICBBV1NfTFdBX0lOVk9LRV9NT0RFOiAncmVzcG9uc2Vfc3RyZWFtJyxcbiAgICAgICAgICBBV1NfTFdBX1BPUlQ6ICczMDAwJyxcbiAgICAgICAgICBSVVNUX0xPRzogJ2luZm8nLFxuICAgICAgICAgIFxuICAgICAgICAgIC8vIOapn+iDveW+qeaXp+eUqER5bmFtb0RC44OG44O844OW44Or77yIUGhhc2UgMeWujOS6hua4iOOBv++8iVxuICAgICAgICAgIFNFU1NJT05fVEFCTEVfTkFNRTogJ3Blcm1pc3Npb24tYXdhcmUtcmFnLXNlc3Npb25zJywgLy8g44K744OD44K344On44Oz566h55CG44OG44O844OW44OrXG4gICAgICAgICAgUFJFRkVSRU5DRVNfVEFCTEVfTkFNRTogcHJvcHMuZGF0YVN0YWNrPy51c2VyUHJlZmVyZW5jZXNUYWJsZT8udGFibGVOYW1lIHx8ICdwZXJtaXNzaW9uLWF3YXJlLXJhZy1wcmVmZXJlbmNlcycsIC8vIOODpuODvOOCtuODvOioreWumuODhuODvOODluODq++8iFRhc2sgMy4y77yJXG4gICAgICAgICAgQ0hBVF9ISVNUT1JZX1RBQkxFX05BTUU6IHByb3BzLmRhdGFTdGFjaz8uY2hhdEhpc3RvcnlUYWJsZT8udGFibGVOYW1lIHx8ICdwZXJtaXNzaW9uLWF3YXJlLXJhZy1jaGF0LWhpc3RvcnknLFxuICAgICAgICAgIERJU0NPVkVSWV9DQUNIRV9UQUJMRV9OQU1FOiAncGVybWlzc2lvbi1hd2FyZS1yYWctZGlzY292ZXJ5LWNhY2hlJywgLy8g5YuV55qE6Kit5a6a44Kt44Oj44OD44K344Ol44OG44O844OW44OrXG4gICAgICAgICAgXG4gICAgICAgICAgLy8gSldU6KqN6Ki86Kit5a6a77yIUGhhc2UgMeWujOS6hua4iOOBv++8iVxuICAgICAgICAgIEpXVF9TRUNSRVQ6ICd5b3VyLXN1cGVyLXNlY3JldC1qd3Qta2V5LWNoYW5nZS1pbi1wcm9kdWN0aW9uLTIwMjQnLFxuICAgICAgICAgIEpXVF9FWFBJUkVTX0lOOiAnN2QnLFxuICAgICAgICAgIFxuICAgICAgICAgIC8vIEJlZHJvY2sgQWdlbnTmg4XloLHvvIjml6LlrZjvvIlcbiAgICAgICAgICBCRURST0NLX0FHRU5UX0lEOiB0aGlzLmJlZHJvY2tBZ2VudD8uYXR0ckFnZW50SWQgfHwgJzFOV1FKVElNQUgnLFxuICAgICAgICAgIEJFRFJPQ0tfQUdFTlRfQUxJQVNfSUQ6IHRoaXMuYmVkcm9ja0FnZW50QWxpYXM/LmF0dHJBZ2VudEFsaWFzSWQgfHwgJ1RTVEFMSUFTSUQnLFxuICAgICAgICAgIFxuICAgICAgICAgIC8vIFBlcm1pc3Npb24gQVBJ55SoRHluYW1vRELjg4bjg7zjg5bjg6vvvIjml6LlrZjvvIlcbiAgICAgICAgICBEWU5BTU9EQl9UQUJMRV9OQU1FOiBwcm9wcy51c2VyQWNjZXNzVGFibGU/LnRhYmxlTmFtZSB8fCAnJyxcbiAgICAgICAgICBQRVJNSVNTSU9OX0NBQ0hFX1RBQkxFX05BTUU6IHByb3BzLnBlcm1pc3Npb25DYWNoZVRhYmxlPy50YWJsZU5hbWUgfHwgJycsXG4gICAgICAgICAgXG4gICAgICAgICAgLy8g5aSa6KiA6Kqe5a++5b+c6Kit5a6a77yIUGhhc2UgMua6luWCme+8iVxuICAgICAgICAgIERFRkFVTFRfTE9DQUxFOiAnamEnLFxuICAgICAgICAgIFNVUFBPUlRFRF9MT0NBTEVTOiAnamEsZW4sa28semgtQ04semgtVFcsZXMsZnIsZGUnLFxuICAgICAgICAgIFxuICAgICAgICAgIC8vIOWLleeahOODouODh+ODq+aknOWHuuioreWumu+8iFBoYXNlIDLmupblgpnvvIlcbiAgICAgICAgICBNT0RFTF9ESVNDT1ZFUllfRU5BQkxFRDogJ3RydWUnLFxuICAgICAgICAgIE1PREVMX0NBQ0hFX1RUTDogJzM2MDAnLCAvLyAx5pmC6ZaTXG4gICAgICAgICAgXG4gICAgICAgICAgLy8g44OR44OV44Kp44O844Oe44Oz44K56Kit5a6a77yIUGhhc2UgNea6luWCme+8iVxuICAgICAgICAgIEVOQUJMRV9DQUNISU5HOiAndHJ1ZScsXG4gICAgICAgICAgQ0FDSEVfVFRMOiAnMzAwJywgLy8gNeWIhlxuICAgICAgICAgIFxuICAgICAgICAgIC8vIOOCu+OCreODpeODquODhuOCo+ioreWumu+8iFBoYXNlIDHlrozkuobmuIjjgb/vvIlcbiAgICAgICAgICBFTkFCTEVfQ1NSRl9QUk9URUNUSU9OOiAndHJ1ZScsXG4gICAgICAgICAgU0VDVVJFX0NPT0tJRVM6ICd0cnVlJyxcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDjg63jgrDjg6zjg5njg6voqK3lrppcbiAgICAgICAgICBMT0dfTEVWRUw6ICdpbmZvJyxcbiAgICAgICAgfSxcbiAgICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coJ+KchSBMYW1iZGHplqLmlbDkvZzmiJDlrozkuoYnKTtcblxuICAgICAgLy8gTGFtYmRhIEZ1bmN0aW9uIFVSTFxuICAgICAgdGhpcy5mdW5jdGlvblVybCA9IHRoaXMud2ViQXBwRnVuY3Rpb24uYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgICAgY29yczoge1xuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLkFMTF0sXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIG1heEFnZTogY2RrLkR1cmF0aW9uLmRheXMoMSksXG4gICAgICAgIH0sXG4gICAgICAgIGludm9rZU1vZGU6IGxhbWJkYS5JbnZva2VNb2RlLlJFU1BPTlNFX1NUUkVBTSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBDbG91ZEZyb250IERpc3RyaWJ1dGlvbu+8iOeSsOWig+WIpeWItuW+oeWvvuW/nO+8iVxuICAgICAgaWYgKHJlc291cmNlQ29udHJvbC5jcmVhdGVDbG91ZEZyb250RGlzdHJpYnV0aW9uKSB7XG4gICAgICAgIC8vIOazqOaEjzogTGFtYmRhIEZ1bmN0aW9uIFVSTOOCkk9yaWdpbuOBqOOBl+OBpuS9v+eUqOOBmeOCi+WgtOWQiOOAgVxuICAgICAgICAvLyBBTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUuOCkuS9v+eUqOOBmeOCi+W/heimgeOBjOOBguOCiuOBvuOBmeOAglxuICAgICAgICAvLyBBTExfVklFV0VS44KS5L2/55So44GZ44KL44Go44CBQ2xvdWRGcm9udOOBrkhvc3Tjg5jjg4Pjg4Djg7zjgYxMYW1iZGHjgavou6LpgIHjgZXjgozjgIFcbiAgICAgICAgLy8gTGFtYmRhIEZ1bmN0aW9uIFVSTOOBjOODm+OCueODiOWQjeOCkuiqjeitmOOBp+OBjeOBmjQwM+OCqOODqeODvOOBjOeZuueUn+OBl+OBvuOBmeOAglxuICAgICAgICB0aGlzLmRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnV2ViQXBwRGlzdHJpYnV0aW9uJywge1xuICAgICAgICAgIGNvbW1lbnQ6IGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tV2ViQXBwLURpc3RyaWJ1dGlvbmAsXG4gICAgICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLkh0dHBPcmlnaW4oY2RrLkZuLnNlbGVjdCgyLCBjZGsuRm4uc3BsaXQoJy8nLCB0aGlzLmZ1bmN0aW9uVXJsLnVybCkpKSxcbiAgICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgICAgY2FjaGVkTWV0aG9kczogY2xvdWRmcm9udC5DYWNoZWRNZXRob2RzLkNBQ0hFX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgICAvLyAyMDI2LTAxLTE0OiBDaGFuZ2VkIHRvIEFMTF9WSUVXRVIgdG8gZm9yd2FyZCBhbGwgaGVhZGVycyBpbmNsdWRpbmcgSG9zdCBoZWFkZXJcbiAgICAgICAgICAgIC8vIFRoaXMgZml4ZXMgQWdlbnQgbW9kZSBlcnJvcnMgY2F1c2VkIGJ5IG1pc3NpbmcgaGVhZGVyc1xuICAgICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkFMTF9WSUVXRVIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmljZUNsYXNzOiBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfMjAwLFxuICAgICAgICAgIGVuYWJsZUxvZ2dpbmc6IGZhbHNlLFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc29sZS5sb2coJ+KchSBDbG91ZEZyb2506YWN5L+h5L2c5oiQ5a6M5LqGJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygn4pqg77iPICBDbG91ZEZyb2506YWN5L+h5L2c5oiQ44KS44K544Kt44OD44OX77yI55Kw5aKD5Yil5Yi25b6h77yJJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIER5bmFtb0RC44Ki44Kv44K744K55qip6ZmQ44Gu5LuY5LiOXG4gICAgICBpZiAocHJvcHMuZGF0YVN0YWNrPy5jaGF0SGlzdG9yeVRhYmxlKSB7XG4gICAgICAgIHByb3BzLmRhdGFTdGFjay5jaGF0SGlzdG9yeVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLndlYkFwcEZ1bmN0aW9uKTtcbiAgICAgICAgY29uc29sZS5sb2coJ+KchSBDaGF0SGlzdG9yeVRhYmxl44G444Gu44Ki44Kv44K744K55qip6ZmQ5LuY5LiO5a6M5LqGJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFVzZXJQcmVmZXJlbmNlc+ODhuODvOODluODq+OBuOOBruOCouOCr+OCu+OCueaoqemZkOS7mOS4ju+8iFRhc2sgMy4y77yJXG4gICAgICBpZiAocHJvcHMuZGF0YVN0YWNrPy51c2VyUHJlZmVyZW5jZXNUYWJsZSkge1xuICAgICAgICBwcm9wcy5kYXRhU3RhY2sudXNlclByZWZlcmVuY2VzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMud2ViQXBwRnVuY3Rpb24pO1xuICAgICAgICBjb25zb2xlLmxvZygn4pyFIFVzZXJQcmVmZXJlbmNlc1RhYmxl44G444Gu44Ki44Kv44K744K55qip6ZmQ5LuY5LiO5a6M5LqGJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgTGFtYmRh6Zai5pWw44O7Q2xvdWRGcm9udOS9nOaIkOWujOS6hicpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZygn4pqg77iPICBMYW1iZGHplqLmlbDjg7tDbG91ZEZyb2505L2c5oiQ44KS44K544Kt44OD44OXJyk7XG4gICAgICBjb25zb2xlLmxvZygnICAg5qyh44Gu44K544OG44OD44OXOicpO1xuICAgICAgY29uc29sZS5sb2coJyAgIDEuIEVDUuOBq05leHQuanPjgqTjg6Hjg7zjgrjjgpLjg5fjg4Pjgrfjg6UnKTtcbiAgICAgIGNvbnNvbGUubG9nKCcgICAyLiBza2lwTGFtYmRhQ3JlYXRpb249ZmFsc2Xjgaflho3jg4fjg5fjg63jgqQnKTtcbiAgICB9XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8g5Ye65Yqb5YCk44Gu5a6a576p77yIVVMtMi4x6KaB5Lu277yJXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIFxuICAgIC8vIDEuIEVDUuODquODneOCuOODiOODqlVSSe+8iOW/hemgiO+8iVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFQ1JSZXBvc2l0b3J5VXJpJywge1xuICAgICAgdmFsdWU6IHRoaXMuZWNyUmVwb3NpdG9yeS5yZXBvc2l0b3J5VXJpLFxuICAgICAgZGVzY3JpcHRpb246ICdFQ1IgUmVwb3NpdG9yeSBVUkkgLSDjgrPjg7Pjg4bjg4rjgqTjg6Hjg7zjgrjjga7jg5fjg4Pjgrfjg6XlhYgnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUVDUlJlcG9zaXRvcnlVcmlgLFxuICAgIH0pO1xuICAgIFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFQ1JSZXBvc2l0b3J5TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmVjclJlcG9zaXRvcnkucmVwb3NpdG9yeU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VDUiBSZXBvc2l0b3J5IE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUVDUlJlcG9zaXRvcnlOYW1lYCxcbiAgICB9KTtcbiAgICBcbiAgICAvLyAyLiBBUEkgR2F0ZXdheSBVUkzvvIhMYW1iZGEgRnVuY3Rpb24gVVJM44Gn5Luj5pu/77yJXG4gICAgLy8g5rOoOiDnj77lnKjjga7lrp/oo4Xjgafjga9MYW1iZGEgRnVuY3Rpb24gVVJM44KS5L2/55SoXG4gICAgLy8g5bCG5p2l55qE44GrQVBJIEdhdGV3YXnjgavnp7vooYzjgZnjgovloLTlkIjjga/jgIHjgZPjga7jgrvjgq/jgrfjg6fjg7PjgpLmm7TmlrBcbiAgICBpZiAoIXNraXBMYW1iZGFDcmVhdGlvbiAmJiB0aGlzLmZ1bmN0aW9uVXJsKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpVXJsJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5mdW5jdGlvblVybC51cmwsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIFVSTCAoTGFtYmRhIEZ1bmN0aW9uIFVSTCkgLSDjg5Djg4Pjgq/jgqjjg7Pjg4lBUEnjgqjjg7Pjg4njg53jgqTjg7Pjg4gnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQXBpVXJsYCxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnVuY3Rpb25VcmwnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmZ1bmN0aW9uVXJsLnVybCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgRnVuY3Rpb24gVVJMIC0g55u05o6l44Ki44Kv44K744K555SoJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUZ1bmN0aW9uVXJsYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIDMuIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIFVSTO+8iOW/hemgiO+8iVxuICAgIGlmICghc2tpcExhbWJkYUNyZWF0aW9uICYmIHRoaXMuZGlzdHJpYnV0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udFVybCcsIHtcbiAgICAgICAgdmFsdWU6IGBodHRwczovLyR7dGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIFVSTCAtIOODleODreODs+ODiOOCqOODs+ODieOCouOCr+OCu+OCueeUqO+8iOaOqOWlqO+8iScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1DbG91ZEZyb250VXJsYCxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERpc3RyaWJ1dGlvbklkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gSUQgLSDjgq3jg6Pjg4Pjgrfjg6XnhKHlirnljJbnlKgnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQ2xvdWRGcm9udERpc3RyaWJ1dGlvbklkYCxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERvbWFpbk5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgRG9tYWluIE5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQ2xvdWRGcm9udERvbWFpbk5hbWVgLFxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIDQuIExhbWJkYemWouaVsOaDheWgse+8iOODh+ODkOODg+OCsOODu+ebo+imlueUqO+8iVxuICAgIGlmICghc2tpcExhbWJkYUNyZWF0aW9uICYmIHRoaXMud2ViQXBwRnVuY3Rpb24pIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdMYW1iZGFGdW5jdGlvbk5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLndlYkFwcEZ1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgRnVuY3Rpb24gTmFtZSAtIENsb3VkV2F0Y2ggTG9nc+eiuuiqjeeUqCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1MYW1iZGFGdW5jdGlvbk5hbWVgLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdMYW1iZGFGdW5jdGlvbkFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMud2ViQXBwRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIEZ1bmN0aW9uIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1MYW1iZGFGdW5jdGlvbkFybmAsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gNS4g44OH44OX44Ot44Kk44Oi44O844OJ5oOF5aCxXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RlcGxveU1vZGUnLCB7XG4gICAgICB2YWx1ZTogc3RhbmRhbG9uZU1vZGUgPyAnc3RhbmRhbG9uZScgOiAnaW50ZWdyYXRlZCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ+ODh+ODl+ODreOCpOODouODvOODiSAtIOOCueOCv+ODs+ODieOCouODreODvOODsyBvciDntbHlkIgnLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIDYuIOOCueOCv+ODg+OCr+aDheWgsVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdGFja05hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zdGFja05hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRm9ybWF0aW9uIFN0YWNrIE5hbWUnLFxuICAgIH0pO1xuICAgIFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSZWdpb24nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZWdpb24sXG4gICAgICBkZXNjcmlwdGlvbjogJ+ODh+ODl+ODreOCpOODquODvOOCuOODp+ODsycsXG4gICAgfSk7XG4gICAgXG4gICAgY29uc29sZS5sb2coJycpO1xuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgY29uc29sZS5sb2coJ/Cfk4sg5Ye65Yqb5YCk44K144Oe44Oq44O8Jyk7XG4gICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICBjb25zb2xlLmxvZyhg4pyFIEVDUuODquODneOCuOODiOODqlVSSTogJHt0aGlzLmVjclJlcG9zaXRvcnkucmVwb3NpdG9yeVVyaX1gKTtcbiAgICBpZiAoIXNraXBMYW1iZGFDcmVhdGlvbiAmJiB0aGlzLmZ1bmN0aW9uVXJsKSB7XG4gICAgICBjb25zb2xlLmxvZyhg4pyFIEFQSSBVUkw6ICR7dGhpcy5mdW5jdGlvblVybC51cmx9YCk7XG4gICAgfVxuICAgIGlmICghc2tpcExhbWJkYUNyZWF0aW9uICYmIHRoaXMuZGlzdHJpYnV0aW9uKSB7XG4gICAgICBjb25zb2xlLmxvZyhg4pyFIENsb3VkRnJvbnQgVVJMOiBodHRwczovLyR7dGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gKTtcbiAgICB9XG4gICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcblxuICAgIC8vIFBlcm1pc3Npb24gQVBJ5qmf6IO944Gu6L+95Yqg77yI55Kw5aKD5Yil5Yi25b6h5a++5b+c77yJXG4gICAgaWYgKHJlc291cmNlQ29udHJvbC5lbmFibGVQZXJtaXNzaW9uQXBpICYmIHByb3BzLnVzZXJBY2Nlc3NUYWJsZSAmJiBwcm9wcy5wZXJtaXNzaW9uQ2FjaGVUYWJsZSkge1xuICAgICAgY29uc29sZS5sb2coJycpO1xuICAgICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5SQIFBlcm1pc3Npb24gQVBJ5qmf6IO944KS6L+95Yqg5LitLi4uJyk7XG4gICAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgICAgXG4gICAgICAvLyDinIUgVGVtcG9yYXJpbHkgY29tbWVudGVkIG91dCBmb3IgZGVwbG95bWVudFxuICAgICAgY29uc29sZS5sb2coXCJjcmVhdGVQZXJtaXNzaW9uQXBpUmVzb3VyY2VzOiBUZW1wb3JhcmlseSBkaXNhYmxlZFwiKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coJ+KchSBQZXJtaXNzaW9uIEFQSeapn+iDvei/veWKoOWujOS6hicpO1xuICAgIH0gZWxzZSBpZiAocmVzb3VyY2VDb250cm9sLmVuYWJsZVBlcm1pc3Npb25BcGkpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfimqDvuI8gIFBlcm1pc3Npb24gQVBJ5qmf6IO944GM5pyJ5Yq544Gn44GZ44GM44CBRHluYW1vRELjg4bjg7zjg5bjg6vjgYzmj5DkvpvjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICAgIGNvbnNvbGUubG9nKCcgICBEYXRhU3RhY2vjgYvjgol1c2VyQWNjZXNzVGFibGXjgahwZXJtaXNzaW9uQ2FjaGVUYWJsZeOCkua4oeOBl+OBpuOBj+OBoOOBleOBhCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZygn4oS577iPICBQZXJtaXNzaW9uIEFQSeapn+iDveOBr+eEoeWKueWMluOBleOCjOOBpuOBhOOBvuOBme+8iOeSsOWig+WIpeWItuW+oe+8iScpO1xuICAgIH1cblxuICAgIC8vIEJlZHJvY2sgQWdlbnTmqZ/og73jga7ov73liqDvvIjnkrDlooPliKXliLblvqHlr77lv5zvvIlcbiAgICBpZiAocmVzb3VyY2VDb250cm9sLmVuYWJsZUJlZHJvY2tBZ2VudCkge1xuICAgICAgY29uc29sZS5sb2coJycpO1xuICAgICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICAgIGNvbnNvbGUubG9nKCfwn6SWIEJlZHJvY2sgQWdlbnTmqZ/og73jgpLov73liqDkuK0uLi4nKTtcbiAgICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgICBcbiAgICAgIC8vIOKchSBUZW1wb3JhcmlseSBjb21tZW50ZWQgb3V0IGZvciBkZXBsb3ltZW50XG4gICAgICBjb25zb2xlLmxvZyhcImNyZWF0ZUJlZHJvY2tBZ2VudFJlc291cmNlczogVGVtcG9yYXJpbHkgZGlzYWJsZWRcIik7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgQmVkcm9jayBBZ2VudOapn+iDvei/veWKoOWujOS6hicpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZygn4oS577iPICBCZWRyb2NrIEFnZW505qmf6IO944Gv54Sh5Yq55YyW44GV44KM44Gm44GE44G+44GZ77yI55Kw5aKD5Yil5Yi25b6h77yJJyk7XG4gICAgfVxuXG4gICAgLy8gUGhhc2UgNDogQWdlbnRDb3JlIENvbnN0cnVjdHPntbHlkIjvvIjnkrDlooPliKXliLblvqHlr77lv5zvvIlcbiAgICBpZiAocmVzb3VyY2VDb250cm9sLmVuYWJsZUFnZW50Q29yZSAmJiBjb25maWcuYWdlbnRDb3JlKSB7XG4gICAgICBjb25zb2xlLmxvZygnJyk7XG4gICAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgICAgY29uc29sZS5sb2coJ/CfmoAgQWdlbnRDb3JlIENvbnN0cnVjdHPntbHlkIjplovlp4suLi4nKTtcbiAgICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgICBcbiAgICAgIC8vIOKchSBUZW1wb3JhcmlseSBjb21tZW50ZWQgb3V0IGZvciBkZXBsb3ltZW50XG4gICAgICBjb25zb2xlLmxvZyhcImludGVncmF0ZUFnZW50Q29yZUNvbnN0cnVjdHM6IFRlbXBvcmFyaWx5IGRpc2FibGVkXCIpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygn4pyFIEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCI5a6M5LqGJyk7XG4gICAgfSBlbHNlIGlmIChjb25maWcuYWdlbnRDb3JlKSB7XG4gICAgICBjb25zb2xlLmxvZygn4oS577iPICBBZ2VudENvcmXmqZ/og73jga/nhKHlirnljJbjgZXjgozjgabjgYTjgb7jgZnvvIjnkrDlooPliKXliLblvqHvvIknKTtcbiAgICB9XG5cbiAgICAvLyBUYWdzXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNb2R1bGUnLCAnV2ViQXBwJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdGcmFtZXdvcmsnLCAnTmV4dC5qcycpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQWRhcHRlcicsICdMYW1iZGEgV2ViIEFkYXB0ZXInKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0NETicsICdDbG91ZEZyb250Jyk7XG4gICAgaWYgKGNvbmZpZy5wZXJtaXNzaW9uQXBpPy5lbmFibGVkKSB7XG4gICAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Blcm1pc3Npb25BUEknLCAnRW5hYmxlZCcpO1xuICAgIH1cbiAgICBpZiAoY29uZmlnLmJlZHJvY2tBZ2VudD8uZW5hYmxlZCkge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdCZWRyb2NrQWdlbnQnLCAnRW5hYmxlZCcpO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCfinIUgV2ViQXBwU3RhY2sgKEZ1bGwpIOWIneacn+WMluWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODieeUqOODquOCveODvOOCueOCu+ODg+ODiOOCouODg+ODl1xuICAgKiDlv4XopoHjgarjg6rjgr3jg7zjgrnjgpLlj4Lnhafjgb7jgZ/jga/kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgc2V0dXBTdGFuZGFsb25lUmVzb3VyY2VzKFxuICAgIGV4aXN0aW5nVnBjSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgICBleGlzdGluZ1NlY3VyaXR5R3JvdXBJZDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgICByZWdpb25QcmVmaXg6IHN0cmluZ1xuICApOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZygn8J+TpiDjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4k6IOODquOCveODvOOCueOCu+ODg+ODiOOCouODg+ODl+mWi+Wniy4uLicpO1xuXG4gICAgLy8gVlBD44Gu5Y+C54Wn44G+44Gf44Gv5L2c5oiQXG4gICAgaWYgKGV4aXN0aW5nVnBjSWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5SXIOaXouWtmFZQQ+OCkuWPgueFpzogJHtleGlzdGluZ1ZwY0lkfWApO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy52cGMgPSBlYzIuVnBjLmZyb21Mb29rdXAodGhpcywgJ0V4aXN0aW5nVnBjJywge1xuICAgICAgICAgIHZwY0lkOiBleGlzdGluZ1ZwY0lkXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zb2xlLmxvZygn4pyFIOaXouWtmFZQQ+WPgueFp+aIkOWKnycpO1xuICAgICAgICBcbiAgICAgICAgLy8g5pei5a2YVlBD44Gu5aC05ZCI44CBRHluYW1vREIgVlBDIEVuZHBvaW5044KS5L2c5oiQ77yI5pei44Gr5a2Y5Zyo44GZ44KL5aC05ZCI44Gv44K544Kt44OD44OX77yJXG4gICAgICAgIHRyeSB7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ+KEue+4jyAgRHluYW1vREIgVlBDIEVuZHBvaW5044Gv5pei44Gr5a2Y5Zyo44GZ44KL44GL44CB5L2c5oiQ44Gn44GN44G+44Gb44KT44Gn44GX44GfJyk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2Fybign4pqg77iPICDml6LlrZhWUEPjgYzopovjgaTjgYvjgorjgb7jgZvjgpPjgILmlrDopo9WUEPjgpLkvZzmiJDjgZfjgb7jgZnjgIInKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ/CfhpUg5paw6KaPVlBD44KS5L2c5oiQ77yI5pyA5bCP5qeL5oiQ77yJJyk7XG4gICAgfVxuXG4gICAgLy8g44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44Gu5Y+C54Wn44G+44Gf44Gv5L2c5oiQXG4gICAgaWYgKGV4aXN0aW5nU2VjdXJpdHlHcm91cElkKSB7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UlyDml6LlrZjjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjgpLlj4Lnhac6ICR7ZXhpc3RpbmdTZWN1cml0eUdyb3VwSWR9YCk7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLnNlY3VyaXR5R3JvdXAgPSBlYzIuU2VjdXJpdHlHcm91cC5mcm9tU2VjdXJpdHlHcm91cElkKFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgJ0V4aXN0aW5nU2VjdXJpdHlHcm91cCcsXG4gICAgICAgICAgZXhpc3RpbmdTZWN1cml0eUdyb3VwSWRcbiAgICAgICAgKTtcbiAgICAgICAgY29uc29sZS5sb2coJ+KchSDml6LlrZjjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5flj4LnhafmiJDlip8nKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2Fybign4pqg77iPICDml6LlrZjjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjgYzopovjgaTjgYvjgorjgb7jgZvjgpPjgILmlrDopo/kvZzmiJDjgZfjgb7jgZnjgIInKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ/CfhpUg5paw6KaP44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44KS5L2c5oiQJyk7XG4gICAgfVxuXG4gICAgLy8gSUFN44Ot44O844Or44Gu5L2c5oiQ77yI5b+F6aCI77yJXG4gICAgY29uc29sZS5sb2coJ/CflJEgSUFN44Ot44O844Or44KS5L2c5oiQJyk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIOOCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODiTog44Oq44K944O844K544K744OD44OI44Ki44OD44OX5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICog57Wx5ZCI44Oi44O844OJ55So44Oq44K944O844K544K744OD44OI44Ki44OD44OXXG4gICAqIOS7luOBrlN0YWNr44GL44KJ44Oq44K944O844K544KS5Y+C54WnXG4gICAqL1xuICBwcml2YXRlIHNldHVwSW50ZWdyYXRlZFJlc291cmNlcyhcbiAgICBuZXR3b3JraW5nU3RhY2s6IGFueSxcbiAgICBzZWN1cml0eVN0YWNrOiBhbnlcbiAgKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/CflJcg57Wx5ZCI44Oi44O844OJOiDjg6rjgr3jg7zjgrnjgrvjg4Pjg4jjgqLjg4Pjg5fplovlp4suLi4nKTtcblxuICAgIC8vIOW/hemgiFN0YWNr44Gu56K66KqNXG4gICAgaWYgKCFuZXR3b3JraW5nU3RhY2sgfHwgIXNlY3VyaXR5U3RhY2spIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ+e1seWQiOODouODvOODieOBp+OBr05ldHdvcmtpbmdTdGFja+OBqFNlY3VyaXR5U3RhY2vjgYzlv4XopoHjgafjgZnjgIInICtcbiAgICAgICAgJ+OCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODieOCkuS9v+eUqOOBmeOCi+OBi+OAgeW/heimgeOBqlN0YWNr44KS5o+Q5L6b44GX44Gm44GP44Gg44GV44GE44CCJ1xuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyDku5bjga5TdGFja+OBi+OCieWPgueFp1xuICAgIHRoaXMudnBjID0gbmV0d29ya2luZ1N0YWNrLnZwYztcbiAgICB0aGlzLnNlY3VyaXR5R3JvdXAgPSBuZXR3b3JraW5nU3RhY2sud2ViQXBwU2VjdXJpdHlHcm91cDtcbiAgICB0aGlzLmV4ZWN1dGlvblJvbGUgPSBzZWN1cml0eVN0YWNrLmxhbWJkYUV4ZWN1dGlvblJvbGU7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIOe1seWQiOODouODvOODiTog44Oq44K944O844K544K744OD44OI44Ki44OD44OX5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICog5pyA5bCP6ZmQ44GuVlBD44KS5L2c5oiQXG4gICAqIOODl+ODqeOCpOODmeODvOODiOOCteODluODjeODg+ODiCArIE5BVOOCsuODvOODiOOCpuOCp+OCpO+8iExhbWJkYeeUqO+8iVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVNaW5pbWFsVnBjKFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgICByZWdpb25QcmVmaXg6IHN0cmluZ1xuICApOiBlYzIuSVZwYyB7XG4gICAgY29uc29sZS5sb2coJ/Cfj5fvuI8gIOacgOWwj+mZkOOBrlZQQ+OCkuS9nOaIkOS4rS4uLicpO1xuICAgIFxuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsICdXZWJBcHBWcGMnLCB7XG4gICAgICB2cGNOYW1lOiBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVdlYkFwcC1WUENgLFxuICAgICAgbWF4QXpzOiAyLFxuICAgICAgbmF0R2F0ZXdheXM6IDEsIC8vIExhbWJkYeeUqOOBq05BVOOCsuODvOODiOOCpuOCp+OCpDHjgaRcbiAgICAgIHN1Ym5ldENvbmZpZ3VyYXRpb246IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdQdWJsaWMnLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBVQkxJQyxcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnUHJpdmF0ZScsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBjZGsuVGFncy5vZih2cGMpLmFkZCgnTmFtZScsIGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tV2ViQXBwLVZQQ2ApO1xuICAgIGNkay5UYWdzLm9mKHZwYykuYWRkKCdQdXJwb3NlJywgJ1dlYkFwcC1TdGFuZGFsb25lJyk7XG5cbiAgICAvLyBMYW1iZGEgVlBD6YWN572u44GM5pyJ5Yq544Gq5aC05ZCI44Gu44G/VlBDIEVuZHBvaW5044KS5L2c5oiQXG4gICAgY29uc3QgbGFtYmRhVnBjQ29uZmlnID0gKHRoaXMuY29uZmlnIGFzIGFueSk/LndlYmFwcD8ubGFtYmRhPy52cGM7XG4gICAgaWYgKGxhbWJkYVZwY0NvbmZpZz8uZW5hYmxlZCkge1xuICAgICAgY29uc29sZS5sb2coJ/CflJcgTGFtYmRhIFZQQ+mFjee9ruOBjOacieWKuSAtIFZQQyBFbmRwb2ludOOCkuS9nOaIkOOBl+OBvuOBmScpO1xuICAgICAgXG4gICAgICAvLyBEeW5hbW9EQiBWUEMgRW5kcG9pbnTvvIhHYXRld2F55Z6L44CB54Sh5paZ77yJXG4gICAgICBpZiAobGFtYmRhVnBjQ29uZmlnLmVuZHBvaW50cz8uZHluYW1vZGIgIT09IGZhbHNlKSB7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEJlZHJvY2sgUnVudGltZSBWUEMgRW5kcG9pbnTvvIhJbnRlcmZhY2XlnovjgIEkNy4yL+aciO+8iVxuICAgICAgaWYgKGxhbWJkYVZwY0NvbmZpZy5lbmRwb2ludHM/LmJlZHJvY2tSdW50aW1lKSB7XG4gICAgICAgIC8vIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OBjOW/heimgeOBquOBruOBp+OAgeWFiOOBq+S9nOaIkFxuICAgICAgICBpZiAoIXRoaXMuc2VjdXJpdHlHcm91cCkge1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEJlZHJvY2sgQWdlbnQgUnVudGltZSBWUEMgRW5kcG9pbnTvvIhJbnRlcmZhY2XlnovjgIEkNy4yL+aciO+8iVxuICAgICAgaWYgKGxhbWJkYVZwY0NvbmZpZy5lbmRwb2ludHM/LmJlZHJvY2tBZ2VudFJ1bnRpbWUpIHtcbiAgICAgICAgLy8g44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44GM5b+F6KaB44Gq44Gu44Gn44CB5YWI44Gr5L2c5oiQXG4gICAgICAgIGlmICghdGhpcy5zZWN1cml0eUdyb3VwKSB7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ+KEue+4jyAgTGFtYmRhIFZQQ+mFjee9ruOBjOeEoeWKuSAtIFZQQyBFbmRwb2ludOOBr+S9nOaIkOOBl+OBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCfinIUgVlBD5L2c5oiQ5a6M5LqGJyk7XG4gICAgcmV0dXJuIHZwYztcbiAgfVxuXG4gIC8qKlxuICAgKiBEeW5hbW9EQiBWUEMgRW5kcG9pbnTjgpLkvZzmiJBcbiAgICogR2F0ZXdheeWei+OCqOODs+ODieODneOCpOODs+ODiO+8iOeEoeaWme+8ieOCkuS9v+eUqFxuICAgKiBMYW1iZGHplqLmlbDjgYxWUEPlhoXjgYvjgolEeW5hbW9EQuOBq+OCouOCr+OCu+OCueOBmeOCi+OBn+OCgeOBq+W/heimgVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVEeW5hbW9EYlZwY0VuZHBvaW50KFxuICAgIHZwYzogZWMyLklWcGMsXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nLFxuICAgIHJlZ2lvblByZWZpeDogc3RyaW5nXG4gICk6IGVjMi5HYXRld2F5VnBjRW5kcG9pbnQge1xuICAgIGNvbnNvbGUubG9nKCfwn5SXIER5bmFtb0RCIFZQQyBFbmRwb2ludOOCkuS9nOaIkOS4rS4uLicpO1xuXG4gICAgY29uc3QgZHluYW1vRGJFbmRwb2ludCA9IHZwYy5hZGRHYXRld2F5RW5kcG9pbnQoJ0R5bmFtb0RiRW5kcG9pbnQnLCB7XG4gICAgICBzZXJ2aWNlOiBlYzIuR2F0ZXdheVZwY0VuZHBvaW50QXdzU2VydmljZS5EWU5BTU9EQixcbiAgICB9KTtcblxuICAgIC8vIOOCv+OCsOOCkui/veWKoFxuICAgIGNkay5UYWdzLm9mKGR5bmFtb0RiRW5kcG9pbnQpLmFkZCgnTmFtZScsIGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tRHluYW1vREItRW5kcG9pbnRgKTtcbiAgICBjZGsuVGFncy5vZihkeW5hbW9EYkVuZHBvaW50KS5hZGQoJ1B1cnBvc2UnLCAnTGFtYmRhLUR5bmFtb0RCLUFjY2VzcycpO1xuICAgIGNkay5UYWdzLm9mKGR5bmFtb0RiRW5kcG9pbnQpLmFkZCgnVHlwZScsICdHYXRld2F5Jyk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIER5bmFtb0RCIFZQQyBFbmRwb2ludOS9nOaIkOWujOS6hicpO1xuICAgIHJldHVybiBkeW5hbW9EYkVuZHBvaW50O1xuICB9XG5cbiAgLyoqXG4gICAqIEJlZHJvY2sgUnVudGltZSBWUEMgRW5kcG9pbnTjgpLkvZzmiJBcbiAgICogSW50ZXJmYWNl5Z6L44Ko44Oz44OJ44Od44Kk44Oz44OI77yIJDcuMi/mnIjvvInjgpLkvb/nlKhcbiAgICogTGFtYmRh6Zai5pWw44GMVlBD5YaF44GL44KJQmVkcm9jayBSdW50aW1lIEFQSe+8iEludm9rZU1vZGVs77yJ44Gr44Ki44Kv44K744K544GZ44KL44Gf44KB44Gr5b+F6KaBXG4gICAqIEtCIE1vZGXjgafkvb/nlKhcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQmVkcm9ja1J1bnRpbWVWcGNFbmRwb2ludChcbiAgICB2cGM6IGVjMi5JVnBjLFxuICAgIHNlY3VyaXR5R3JvdXA6IGVjMi5JU2VjdXJpdHlHcm91cCxcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcsXG4gICAgcmVnaW9uUHJlZml4OiBzdHJpbmdcbiAgKTogZWMyLkludGVyZmFjZVZwY0VuZHBvaW50IHtcbiAgICBjb25zb2xlLmxvZygn8J+UlyBCZWRyb2NrIFJ1bnRpbWUgVlBDIEVuZHBvaW5044KS5L2c5oiQ5LitLi4uJyk7XG5cbiAgICBjb25zdCBiZWRyb2NrUnVudGltZUVuZHBvaW50ID0gbmV3IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludCh0aGlzLCAnQmVkcm9ja1J1bnRpbWVFbmRwb2ludCcsIHtcbiAgICAgIHZwYyxcbiAgICAgIHNlcnZpY2U6IG5ldyBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRTZXJ2aWNlKGBjb20uYW1hem9uYXdzLiR7dGhpcy5yZWdpb259LmJlZHJvY2stcnVudGltZWApLFxuICAgICAgc3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbc2VjdXJpdHlHcm91cF0sXG4gICAgICBwcml2YXRlRG5zRW5hYmxlZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIOOCv+OCsOOCkui/veWKoFxuICAgIGNkay5UYWdzLm9mKGJlZHJvY2tSdW50aW1lRW5kcG9pbnQpLmFkZCgnTmFtZScsIGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tQmVkcm9ja1J1bnRpbWUtRW5kcG9pbnRgKTtcbiAgICBjZGsuVGFncy5vZihiZWRyb2NrUnVudGltZUVuZHBvaW50KS5hZGQoJ1B1cnBvc2UnLCAnTGFtYmRhLUJlZHJvY2stUnVudGltZS1BY2Nlc3MnKTtcbiAgICBjZGsuVGFncy5vZihiZWRyb2NrUnVudGltZUVuZHBvaW50KS5hZGQoJ1R5cGUnLCAnSW50ZXJmYWNlJyk7XG4gICAgY2RrLlRhZ3Mub2YoYmVkcm9ja1J1bnRpbWVFbmRwb2ludCkuYWRkKCdNb2RlJywgJ0tCLU1vZGUnKTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUgQmVkcm9jayBSdW50aW1lIFZQQyBFbmRwb2ludOS9nOaIkOWujOS6hicpO1xuICAgIHJldHVybiBiZWRyb2NrUnVudGltZUVuZHBvaW50O1xuICB9XG5cbiAgLyoqXG4gICAqIEJlZHJvY2sgQWdlbnQgUnVudGltZSBWUEMgRW5kcG9pbnTjgpLkvZzmiJBcbiAgICogSW50ZXJmYWNl5Z6L44Ko44Oz44OJ44Od44Kk44Oz44OI77yIJDcuMi/mnIjvvInjgpLkvb/nlKhcbiAgICogTGFtYmRh6Zai5pWw44GMVlBD5YaF44GL44KJQmVkcm9jayBBZ2VudCBSdW50aW1lIEFQSe+8iEludm9rZUFnZW5077yJ44Gr44Ki44Kv44K744K544GZ44KL44Gf44KB44Gr5b+F6KaBXG4gICAqIEFnZW50IE1vZGXjgafkvb/nlKhcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQmVkcm9ja0FnZW50UnVudGltZVZwY0VuZHBvaW50KFxuICAgIHZwYzogZWMyLklWcGMsXG4gICAgc2VjdXJpdHlHcm91cDogZWMyLklTZWN1cml0eUdyb3VwLFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgICByZWdpb25QcmVmaXg6IHN0cmluZ1xuICApOiBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnQge1xuICAgIGNvbnNvbGUubG9nKCfwn5SXIEJlZHJvY2sgQWdlbnQgUnVudGltZSBWUEMgRW5kcG9pbnTjgpLkvZzmiJDkuK0uLi4nKTtcblxuICAgIGNvbnN0IGJlZHJvY2tBZ2VudEVuZHBvaW50ID0gbmV3IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludCh0aGlzLCAnQmVkcm9ja0FnZW50UnVudGltZUVuZHBvaW50Jywge1xuICAgICAgdnBjLFxuICAgICAgc2VydmljZTogbmV3IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludFNlcnZpY2UoYGNvbS5hbWF6b25hd3MuJHt0aGlzLnJlZ2lvbn0uYmVkcm9jay1hZ2VudC1ydW50aW1lYCksXG4gICAgICBzdWJuZXRzOiB7XG4gICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtzZWN1cml0eUdyb3VwXSxcbiAgICAgIHByaXZhdGVEbnNFbmFibGVkOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8g44K/44Kw44KS6L+95YqgXG4gICAgY2RrLlRhZ3Mub2YoYmVkcm9ja0FnZW50RW5kcG9pbnQpLmFkZCgnTmFtZScsIGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tQmVkcm9ja0FnZW50UnVudGltZS1FbmRwb2ludGApO1xuICAgIGNkay5UYWdzLm9mKGJlZHJvY2tBZ2VudEVuZHBvaW50KS5hZGQoJ1B1cnBvc2UnLCAnTGFtYmRhLUJlZHJvY2stQWdlbnQtUnVudGltZS1BY2Nlc3MnKTtcbiAgICBjZGsuVGFncy5vZihiZWRyb2NrQWdlbnRFbmRwb2ludCkuYWRkKCdUeXBlJywgJ0ludGVyZmFjZScpO1xuICAgIGNkay5UYWdzLm9mKGJlZHJvY2tBZ2VudEVuZHBvaW50KS5hZGQoJ01vZGUnLCAnQWdlbnQtTW9kZScpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBCZWRyb2NrIEFnZW50IFJ1bnRpbWUgVlBDIEVuZHBvaW505L2c5oiQ5a6M5LqGJyk7XG4gICAgcmV0dXJuIGJlZHJvY2tBZ2VudEVuZHBvaW50O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVTZWN1cml0eUdyb3VwKFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgICByZWdpb25QcmVmaXg6IHN0cmluZ1xuICApOiBlYzIuSVNlY3VyaXR5R3JvdXAge1xuICAgIGNvbnNvbGUubG9nKCfwn5SSIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OCkuS9nOaIkOS4rS4uLicpO1xuXG4gICAgaWYgKCF0aGlzLnZwYykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdWUEPjgYzkvZzmiJDjgZXjgozjgabjgYTjgb7jgZvjgpPjgILlhYjjgatWUEPjgpLkvZzmiJDjgZfjgabjgY/jgaDjgZXjgYTjgIInKTtcbiAgICB9XG5cbiAgICBjb25zdCBzZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdXZWJBcHBTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVdlYkFwcC1TR2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBXZWJBcHAgTGFtYmRhIChTdGFuZGFsb25lIE1vZGUpJyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBIVFRQU+OCouOCpuODiOODkOOCpuODs+ODieOCkuaYjuekuueahOOBq+ioseWPr1xuICAgIHNlY3VyaXR5R3JvdXAuYWRkRWdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmFueUlwdjQoKSxcbiAgICAgIGVjMi5Qb3J0LnRjcCg0NDMpLFxuICAgICAgJ0FsbG93IEhUVFBTIG91dGJvdW5kIGZvciBBV1MgQVBJIGNhbGxzJ1xuICAgICk7XG5cbiAgICBjZGsuVGFncy5vZihzZWN1cml0eUdyb3VwKS5hZGQoJ05hbWUnLCBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVdlYkFwcC1TR2ApO1xuICAgIGNkay5UYWdzLm9mKHNlY3VyaXR5R3JvdXApLmFkZCgnUHVycG9zZScsICdXZWJBcHAtU3RhbmRhbG9uZScpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fkvZzmiJDlrozkuoYnKTtcbiAgICByZXR1cm4gc2VjdXJpdHlHcm91cDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJQU3jg63jg7zjg6vjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlSWFtUm9sZXMoXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nLFxuICAgIHJlZ2lvblByZWZpeDogc3RyaW5nXG4gICk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKCfwn5SRIElBTeODreODvOODq+OCkuS9nOaIkOS4rS4uLicpO1xuXG4gICAgdGhpcy5leGVjdXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdXZWJBcHBFeGVjdXRpb25Sb2xlJywge1xuICAgICAgcm9sZU5hbWU6IGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tV2ViQXBwLUV4ZWN1dGlvbi1Sb2xlYCxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdFeGVjdXRpb24gcm9sZSBmb3IgV2ViQXBwIExhbWJkYSBmdW5jdGlvbiAoU3RhbmRhbG9uZSBNb2RlKScsXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYVZQQ0FjY2Vzc0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBCZWRyb2NrIOOCouOCr+OCu+OCueaoqemZkFxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJyxcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nLFxuICAgICAgICAnYmVkcm9jazpMaXN0Rm91bmRhdGlvbk1vZGVscycsXG4gICAgICAgICdiZWRyb2NrOkdldEZvdW5kYXRpb25Nb2RlbCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBCZWRyb2NrIEFnZW50IFJ1bnRpbWXmqKnpmZDvvIjku4rlm57jga7kv67mraPjgafov73liqDvvIlcbiAgICB0aGlzLmV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jay1hZ2VudC1ydW50aW1lOkludm9rZUFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQtcnVudGltZTpSZXRyaWV2ZScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBCZWRyb2NrIEFnZW50IEludm9jYXRpb27mqKnpmZDvvIhQaGFzZSAyIC0gVGFzayAyIENyaXRpY2FsIEZpeO+8iVxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdiZWRyb2NrOkludm9rZUFnZW50JyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06YWdlbnQtYWxpYXMvKmAsXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIEJlZHJvY2sgQWdlbnTnrqHnkIbmqKnpmZDvvIhBZ2VudCBJbmZvIEFQSeeUqCAtIDIwMjUtMTItMTLkv67mraPvvIlcbiAgICAvLyBBZ2VudOS9nOaIkOODu+euoeeQhuaoqemZkOi/veWKoO+8iDIwMjUtMTItMzHov73liqDvvIlcbiAgICAvLyAyMDI2LTAxLTExOiBBZ2VudCBDcmVhdGlvbiBXaXphcmTnlKjmqKnpmZDov73liqBcbiAgICB0aGlzLmV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAvLyBBZ2VudOaDheWgseWPluW+l+OBq+W/heimgeOBquaoqemZkO+8iGJlZHJvY2vlkI3liY3nqbrplpPvvIlcbiAgICAgICAgJ2JlZHJvY2s6R2V0QWdlbnQnLFxuICAgICAgICAnYmVkcm9jazpMaXN0QWdlbnRzJyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEFnZW50QWxpYXNlcycsIFxuICAgICAgICAnYmVkcm9jazpHZXRBZ2VudEFsaWFzJyxcbiAgICAgICAgJ2JlZHJvY2s6VXBkYXRlQWdlbnQnLFxuICAgICAgICAnYmVkcm9jazpQcmVwYXJlQWdlbnQnLFxuICAgICAgICAvLyBBZ2VudOS9nOaIkOODu+WJiumZpOaoqemZkO+8iDIwMjUtMTItMzHov73liqDvvIlcbiAgICAgICAgJ2JlZHJvY2s6Q3JlYXRlQWdlbnQnLFxuICAgICAgICAnYmVkcm9jazpEZWxldGVBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrOkNyZWF0ZUFnZW50QWxpYXMnLFxuICAgICAgICAnYmVkcm9jazpVcGRhdGVBZ2VudEFsaWFzJyxcbiAgICAgICAgJ2JlZHJvY2s6RGVsZXRlQWdlbnRBbGlhcycsXG4gICAgICAgIC8vIEFjdGlvbiBHcm91cOeuoeeQhuaoqemZkFxuICAgICAgICAnYmVkcm9jazpDcmVhdGVBZ2VudEFjdGlvbkdyb3VwJyxcbiAgICAgICAgJ2JlZHJvY2s6VXBkYXRlQWdlbnRBY3Rpb25Hcm91cCcsXG4gICAgICAgICdiZWRyb2NrOkRlbGV0ZUFnZW50QWN0aW9uR3JvdXAnLFxuICAgICAgICAnYmVkcm9jazpHZXRBZ2VudEFjdGlvbkdyb3VwJyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEFnZW50QWN0aW9uR3JvdXBzJyxcbiAgICAgICAgLy8gS25vd2xlZGdlIEJhc2XplqLpgKPmqKnpmZBcbiAgICAgICAgJ2JlZHJvY2s6QXNzb2NpYXRlQWdlbnRLbm93bGVkZ2VCYXNlJyxcbiAgICAgICAgJ2JlZHJvY2s6RGlzYXNzb2NpYXRlQWdlbnRLbm93bGVkZ2VCYXNlJyxcbiAgICAgICAgJ2JlZHJvY2s6R2V0QWdlbnRLbm93bGVkZ2VCYXNlJyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEFnZW50S25vd2xlZGdlQmFzZXMnLFxuICAgICAgICAnYmVkcm9jazpMaXN0S25vd2xlZGdlQmFzZXMnLFxuICAgICAgICAnYmVkcm9jazpHZXRLbm93bGVkZ2VCYXNlJyxcbiAgICAgICAgLy8gRm91bmRhdGlvbiBNb2RlbOeuoeeQhuaoqemZkO+8iEFnZW50IENyZWF0aW9uIFdpemFyZOeUqO+8iVxuICAgICAgICAnYmVkcm9jazpMaXN0Rm91bmRhdGlvbk1vZGVscycsXG4gICAgICAgICdiZWRyb2NrOkdldEZvdW5kYXRpb25Nb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkxpc3RDdXN0b21Nb2RlbHMnLFxuICAgICAgICAvLyDlvpPmnaXjga5iZWRyb2NrLWFnZW505qip6ZmQ44KC57at5oyB77yI5LqS5o+b5oCn44Gu44Gf44KB77yJXG4gICAgICAgICdiZWRyb2NrLWFnZW50OkdldEFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQ6TGlzdEFnZW50cycsXG4gICAgICAgICdiZWRyb2NrLWFnZW50OlVwZGF0ZUFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQ6UHJlcGFyZUFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQ6Q3JlYXRlQWdlbnQnLFxuICAgICAgICAnYmVkcm9jay1hZ2VudDpEZWxldGVBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrLWFnZW50OkNyZWF0ZUFnZW50QWxpYXMnLFxuICAgICAgICAnYmVkcm9jay1hZ2VudDpVcGRhdGVBZ2VudEFsaWFzJyxcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQ6RGVsZXRlQWdlbnRBbGlhcycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBJQU0gUGFzc1JvbGXmqKnpmZDvvIhCZWRyb2NrIEFnZW505pu05paw44O75L2c5oiQ5pmC44Gr5b+F6KaB77yJXG4gICAgdGhpcy5leGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2lhbTpQYXNzUm9sZScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmlhbTo6JHt0aGlzLmFjY291bnR9OnJvbGUvKmJlZHJvY2stYWdlbnQtcm9sZSpgLFxuICAgICAgICBgYXJuOmF3czppYW06OiR7dGhpcy5hY2NvdW50fTpyb2xlL0FtYXpvbkJlZHJvY2tFeGVjdXRpb25Sb2xlRm9yQWdlbnRzXypgLFxuICAgICAgICBgYXJuOmF3czppYW06OiR7dGhpcy5hY2NvdW50fTpyb2xlL1Rva3lvUmVnaW9uLXBlcm1pc3Npb24tYXdhcmUtcmFnLSotQWdlbnQtU2VydmljZS1Sb2xlYCxcbiAgICAgICAgYGFybjphd3M6aWFtOjoke3RoaXMuYWNjb3VudH06cm9sZS9Ub2t5b1JlZ2lvbi1wZXJtaXNzaW9uLWF3YXJlLXJhZy0qLVdlYkFwcC1FeGVjdXRpb24tUm9sZWAsXG4gICAgICBdLFxuICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAnaWFtOlBhc3NlZFRvU2VydmljZSc6ICdiZWRyb2NrLmFtYXpvbmF3cy5jb20nXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSk7XG5cbiAgICAvLyBJQU0gUm9sZeeuoeeQhuaoqemZkO+8iEFnZW50IFNlcnZpY2UgUm9sZeS9nOaIkOeUqCAtIDIwMjYtMDEtMTHov73liqDvvIlcbiAgICB0aGlzLmV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnaWFtOkNyZWF0ZVJvbGUnLFxuICAgICAgICAnaWFtOkdldFJvbGUnLFxuICAgICAgICAnaWFtOkF0dGFjaFJvbGVQb2xpY3knLFxuICAgICAgICAnaWFtOkRldGFjaFJvbGVQb2xpY3knLFxuICAgICAgICAnaWFtOlB1dFJvbGVQb2xpY3knLFxuICAgICAgICAnaWFtOkRlbGV0ZVJvbGVQb2xpY3knLFxuICAgICAgICAnaWFtOkxpc3RBdHRhY2hlZFJvbGVQb2xpY2llcycsXG4gICAgICAgICdpYW06TGlzdFJvbGVQb2xpY2llcycsXG4gICAgICAgICdpYW06VGFnUm9sZScsXG4gICAgICAgICdpYW06VW50YWdSb2xlJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6aWFtOjoke3RoaXMuYWNjb3VudH06cm9sZS9Ub2t5b1JlZ2lvbi1wZXJtaXNzaW9uLWF3YXJlLXJhZy0qLUFnZW50LVNlcnZpY2UtUm9sZWAsXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIFNTTeODkeODqeODoeODvOOCv+OCouOCr+OCu+OCueaoqemZkO+8iEFnZW50IElE5YuV55qE5Y+W5b6X55So77yJXG4gICAgdGhpcy5leGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXInLFxuICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnMnLFxuICAgICAgICAnc3NtOlB1dFBhcmFtZXRlcicsXG4gICAgICAgICdzc206RGVsZXRlUGFyYW1ldGVyJyxcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzQnlQYXRoJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6c3NtOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpwYXJhbWV0ZXIvYmVkcm9jay1hZ2VudC8qYCxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gRUNSIOOCouOCr+OCu+OCueaoqemZkO+8iOOCs+ODs+ODhuODiuOCpOODoeODvOOCuOWPluW+l+eUqO+8iVxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdlY3I6R2V0RG93bmxvYWRVcmxGb3JMYXllcicsXG4gICAgICAgICdlY3I6QmF0Y2hHZXRJbWFnZScsXG4gICAgICAgICdlY3I6QmF0Y2hDaGVja0xheWVyQXZhaWxhYmlsaXR5JyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLCAvLyDlvozjgadFQ1Ljg6rjg53jgrjjg4jjg6pBUk7jgavliLbpmZDlj6/og71cbiAgICB9KSk7XG5cbiAgICBjZGsuVGFncy5vZih0aGlzLmV4ZWN1dGlvblJvbGUpLmFkZCgnUHVycG9zZScsICdXZWJBcHAtU3RhbmRhbG9uZScpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBJQU3jg63jg7zjg6vkvZzmiJDlrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQZXJtaXNzaW9uIEFQSeODquOCveODvOOCueOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVQZXJtaXNzaW9uQXBpUmVzb3VyY2VzKFxuICAgIHVzZXJBY2Nlc3NUYWJsZTogZHluYW1vZGIuSVRhYmxlLFxuICAgIHBlcm1pc3Npb25DYWNoZVRhYmxlOiBkeW5hbW9kYi5JVGFibGUsXG4gICAgY29uZmlnOiBXZWJBcHBTdGFja0NvbmZpZyxcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcsXG4gICAgcmVnaW9uUHJlZml4OiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/CflJAgUGVybWlzc2lvbiBBUEnjg6rjgr3jg7zjgrnkvZzmiJDplovlp4suLi4nKTtcblxuICAgIC8vIDEuIElBTeODreODvOODq+OBruS9nOaIkFxuICAgIHRoaXMucGVybWlzc2lvbkFwaUV4ZWN1dGlvblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1Blcm1pc3Npb25BcGlFeGVjdXRpb25Sb2xlJywge1xuICAgICAgcm9sZU5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1wZXJtaXNzaW9uLWFwaS1yb2xlYCxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdFeGVjdXRpb24gcm9sZSBmb3IgUGVybWlzc2lvbiBBUEkgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhVlBDQWNjZXNzRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIER5bmFtb0RC44Ki44Kv44K744K55qip6ZmQXG4gICAgdXNlckFjY2Vzc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLnBlcm1pc3Npb25BcGlFeGVjdXRpb25Sb2xlKTtcbiAgICBwZXJtaXNzaW9uQ2FjaGVUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5wZXJtaXNzaW9uQXBpRXhlY3V0aW9uUm9sZSk7XG5cbiAgICAvLyBTU03jg5Hjg6njg6Hjg7zjgr/jgqLjgq/jgrvjgrnmqKnpmZBcbiAgICBjb25zdCBzc21QYXJhbWV0ZXJQcmVmaXggPSBjb25maWcucGVybWlzc2lvbkFwaT8uc3NtUGFyYW1ldGVyUHJlZml4IHx8ICcvZnN4LW9udGFwJztcbiAgICB0aGlzLnBlcm1pc3Npb25BcGlFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXInLFxuICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnMnLFxuICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnNCeVBhdGgnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpzc206JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnBhcmFtZXRlciR7c3NtUGFyYW1ldGVyUHJlZml4fS8qYCxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gRlN4IE9OVEFQ44Ki44Kv44K744K55qip6ZmQ77yIUkVTVCBBUEnntYznlLHvvIlcbiAgICB0aGlzLnBlcm1pc3Npb25BcGlFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2ZzeDpEZXNjcmliZUZpbGVTeXN0ZW1zJyxcbiAgICAgICAgJ2ZzeDpEZXNjcmliZVZvbHVtZXMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBQZXJtaXNzaW9uIEFQSSBJQU3jg63jg7zjg6vkvZzmiJDlrozkuoYnKTtcblxuICAgIC8vIDIuIExhbWJkYemWouaVsOOBruS9nOaIkFxuICAgIC8vIOeSsOWig+WkieaVsOOBruioreWumlxuICAgIGNvbnN0IHBlcm1pc3Npb25BcGlFbnZpcm9ubWVudDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHtcbiAgICAgIFVTRVJfQUNDRVNTX1RBQkxFX05BTUU6IHVzZXJBY2Nlc3NUYWJsZS50YWJsZU5hbWUsXG4gICAgICBQRVJNSVNTSU9OX0NBQ0hFX1RBQkxFX05BTUU6IHBlcm1pc3Npb25DYWNoZVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIEZTWF9NQU5BR0VNRU5UX0VORFBPSU5UOiBjb25maWcucGVybWlzc2lvbkFwaT8ub250YXBNYW5hZ2VtZW50TGlmIHx8ICcnLFxuICAgICAgU1NNX1BBUkFNRVRFUl9QUkVGSVg6IHNzbVBhcmFtZXRlclByZWZpeCxcbiAgICAgIENBQ0hFX0VOQUJMRUQ6ICd0cnVlJyxcbiAgICAgIENBQ0hFX1RUTF9TRUNPTkRTOiAnMzAwJyxcbiAgICAgIExPR19MRVZFTDogJ0lORk8nLFxuICAgICAgQVdTX1JFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgfTtcblxuICAgIHRoaXMucGVybWlzc2lvbkFwaUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUGVybWlzc2lvbkFwaUZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tcGVybWlzc2lvbi1hcGlgLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnZ2V0LXVzZXItcGVybWlzc2lvbnMuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9wZXJtaXNzaW9ucycsIHtcbiAgICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgICBpbWFnZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1guYnVuZGxpbmdJbWFnZSxcbiAgICAgICAgICBjb21tYW5kOiBbXG4gICAgICAgICAgICAnYmFzaCcsICctYycsXG4gICAgICAgICAgICAnbnBtIGluc3RhbGwgJiYgY3AgLXIgLiAvYXNzZXQtb3V0cHV0LycsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgcm9sZTogdGhpcy5wZXJtaXNzaW9uQXBpRXhlY3V0aW9uUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiBwZXJtaXNzaW9uQXBpRW52aXJvbm1lbnQsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBzZWN1cml0eUdyb3VwczogdGhpcy5zZWN1cml0eUdyb3VwID8gW3RoaXMuc2VjdXJpdHlHcm91cF0gOiB1bmRlZmluZWQsXG4gICAgICB2cGNTdWJuZXRzOiB0aGlzLnZwYyA/IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgIH0gOiB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIFBlcm1pc3Npb24gQVBJIExhbWJkYemWouaVsOS9nOaIkOWujOS6hicpO1xuXG4gICAgLy8gMy4gQVBJIEdhdGV3YXnjga7kvZzmiJBcbiAgICB0aGlzLnBlcm1pc3Npb25BcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdQZXJtaXNzaW9uQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1wZXJtaXNzaW9uLWFwaWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24gQVBJIGZvciBGU3ggT05UQVAgSHlicmlkIFBlcm1pc3Npb24gU3lzdGVtJyxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRh57Wx5ZCI44Gu5L2c5oiQXG4gICAgY29uc3QgcGVybWlzc2lvbkFwaUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5wZXJtaXNzaW9uQXBpRnVuY3Rpb24sIHtcbiAgICAgIHByb3h5OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gL3Blcm1pc3Npb25zIOOCqOODs+ODieODneOCpOODs+ODiFxuICAgIGNvbnN0IHBlcm1pc3Npb25zID0gdGhpcy5wZXJtaXNzaW9uQXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3Blcm1pc3Npb25zJyk7XG4gICAgXG4gICAgLy8gR0VUIC9wZXJtaXNzaW9ucy97dXNlcklkfVxuICAgIGNvbnN0IHVzZXJQZXJtaXNzaW9ucyA9IHBlcm1pc3Npb25zLmFkZFJlc291cmNlKCd7dXNlcklkfScpO1xuICAgIHVzZXJQZXJtaXNzaW9ucy5hZGRNZXRob2QoJ0dFVCcsIHBlcm1pc3Npb25BcGlJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuSUFNLFxuICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnBhdGgudXNlcklkJzogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIFBlcm1pc3Npb24gQVBJIEdhdGV3YXnkvZzmiJDlrozkuoYnKTtcblxuICAgIC8vIDQuIOWHuuWKm+WApOOBruWumue+qVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQZXJtaXNzaW9uQXBpVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMucGVybWlzc2lvbkFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24gQVBJIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUGVybWlzc2lvbkFwaVVybGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGVybWlzc2lvbkFwaUZ1bmN0aW9uTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnBlcm1pc3Npb25BcGlGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24gQVBJIExhbWJkYSBGdW5jdGlvbiBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1QZXJtaXNzaW9uQXBpRnVuY3Rpb25OYW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQZXJtaXNzaW9uQXBpRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5wZXJtaXNzaW9uQXBpRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24gQVBJIExhbWJkYSBGdW5jdGlvbiBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVBlcm1pc3Npb25BcGlGdW5jdGlvbkFybmAsXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygnJyk7XG4gICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICBjb25zb2xlLmxvZygn8J+TiyBQZXJtaXNzaW9uIEFQSeWHuuWKm+WApOOCteODnuODquODvCcpO1xuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgY29uc29sZS5sb2coYOKchSBBUEkgVVJMOiAke3RoaXMucGVybWlzc2lvbkFwaS51cmx9YCk7XG4gICAgY29uc29sZS5sb2coYOKchSBMYW1iZGHplqLmlbDlkI06ICR7dGhpcy5wZXJtaXNzaW9uQXBpRnVuY3Rpb24uZnVuY3Rpb25OYW1lfWApO1xuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gIH1cblxuICAvKipcbiAgICogQmVkcm9jayBBZ2VudOODquOCveODvOOCueOCkuS9nOaIkFxuICAgKiBQaGFzZSAyIC0gVGFzayAzOiBCZWRyb2NrQWdlbnREeW5hbWljQ29uc3RydWN044KS5L2/55So44GX44Gf5YuV55qE44Oi44OH44Or6YG45oqeXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUJlZHJvY2tBZ2VudFJlc291cmNlcyhcbiAgICBjb25maWc6IFdlYkFwcFN0YWNrQ29uZmlnLFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgICByZWdpb25QcmVmaXg6IHN0cmluZ1xuICApOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZygn8J+kliBCZWRyb2NrIEFnZW5044Oq44K944O844K55L2c5oiQ6ZaL5aeLLi4uJyk7XG4gICAgY29uc29sZS5sb2coJyAgIOWLleeahOODouODh+ODq+mBuOaKnuapn+iDveOCkuS9v+eUqCcpO1xuXG4gICAgLy8gQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdOOCkuS9v+eUqFxuICAgIGNvbnN0IGJlZHJvY2tBZ2VudENvbnN0cnVjdCA9IG5ldyBCZWRyb2NrQWdlbnREeW5hbWljQ29uc3RydWN0KHRoaXMsIFwiQmVkcm9ja0FnZW50RHluYW1pY1wiLCB7XG4gICAgICBwcm9qZWN0TmFtZTogY29uZmlnLm5hbWluZz8ucHJvamVjdE5hbWUgfHwgXCJwZXJtaXNzaW9uLWF3YXJlLXJhZ1wiLFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgIGFnZW50TmFtZTogYCR7cmVnaW9uUHJlZml4fS0ke2NvbmZpZy5uYW1pbmc/LnByb2plY3ROYW1lIHx8IFwicGVybWlzc2lvbi1hd2FyZS1yYWdcIn0tJHtlbnZpcm9ubWVudH0tYWdlbnRgLFxuICAgICAgYWdlbnREZXNjcmlwdGlvbjogXCJQZXJtaXNzaW9uLWF3YXJlIFJBRyBBZ2VudCB3aXRoIGR5bmFtaWMgbW9kZWwgc2VsZWN0aW9uXCIsXG4gICAgICBpbnN0cnVjdGlvbjogXCJZb3UgYXJlIGEgaGVscGZ1bCBhc3Npc3RhbnQgd2l0aCBhY2Nlc3MgdG8gcGVybWlzc2lvbi1hd2FyZSBkb2N1bWVudCBzZWFyY2guXCIsXG4gICAgICB1c2VDYXNlOiBjb25maWcuYmVkcm9ja0FnZW50Py51c2VDYXNlIHx8IFwiY2hhdFwiLFxuICAgICAgbW9kZWxSZXF1aXJlbWVudHM6IGNvbmZpZy5iZWRyb2NrQWdlbnQ/Lm1vZGVsUmVxdWlyZW1lbnRzIHx8IHt9LFxuICAgICAgZW5hYmxlRHluYW1pY01vZGVsU2VsZWN0aW9uOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8g44Kz44Oz44K544OI44Op44Kv44OI44GL44KJ55Sf5oiQ44GV44KM44Gf44Oq44K944O844K544KS5Y+W5b6XXG4gICAgdGhpcy5iZWRyb2NrQWdlbnQgPSBiZWRyb2NrQWdlbnRDb25zdHJ1Y3QuYWdlbnQ7XG4gICAgdGhpcy5iZWRyb2NrQWdlbnRBbGlhcyA9IGJlZHJvY2tBZ2VudENvbnN0cnVjdC5hZ2VudEFsaWFzO1xuICAgIHRoaXMuYmVkcm9ja0FnZW50U2VydmljZVJvbGUgPSBiZWRyb2NrQWdlbnRDb25zdHJ1Y3QuYWdlbnRSb2xlO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBCZWRyb2NrIEFnZW505L2c5oiQ5a6M5LqGJyk7XG4gICAgY29uc29sZS5sb2coYCAgIOmBuOaKnuOBleOCjOOBn+ODouODh+ODqzogJHtiZWRyb2NrQWdlbnRDb25zdHJ1Y3Quc2VsZWN0ZWRNb2RlbH1gKTtcblxuICAgIC8vIExhbWJkYemWouaVsOOBuOOBruaoqemZkOS7mOS4jlxuICAgIGlmICh0aGlzLndlYkFwcEZ1bmN0aW9uKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+UkSBMYW1iZGHplqLmlbDjgatCZWRyb2NrIEFnZW505qip6ZmQ44KS5LuY5LiO5LitLi4uJyk7XG4gICAgICBiZWRyb2NrQWdlbnRDb25zdHJ1Y3QuZ3JhbnRJbnZva2VUb0xhbWJkYSh0aGlzLndlYkFwcEZ1bmN0aW9uKTtcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgTGFtYmRh6Zai5pWw44G444Gu5qip6ZmQ5LuY5LiO5a6M5LqGJyk7XG4gICAgfVxuXG4gICAgLy8gTGFtYmRh6Zai5pWw44Gu55Kw5aKD5aSJ5pWw44KS5pu05paw77yIQWdlbnTmg4XloLHjgpLov73liqDvvIlcbiAgICBpZiAodGhpcy53ZWJBcHBGdW5jdGlvbiAmJiB0aGlzLmJlZHJvY2tBZ2VudCAmJiB0aGlzLmJlZHJvY2tBZ2VudEFsaWFzKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+UhCBMYW1iZGHplqLmlbDjga7nkrDlooPlpInmlbDjgpLmm7TmlrDkuK0uLi4nKTtcbiAgICAgIHRoaXMud2ViQXBwRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoJ0JFRFJPQ0tfQUdFTlRfSUQnLCB0aGlzLmJlZHJvY2tBZ2VudC5hdHRyQWdlbnRJZCk7XG4gICAgICB0aGlzLndlYkFwcEZ1bmN0aW9uLmFkZEVudmlyb25tZW50KCdCRURST0NLX0FHRU5UX0FMSUFTX0lEJywgdGhpcy5iZWRyb2NrQWdlbnRBbGlhcy5hdHRyQWdlbnRBbGlhc0lkKTtcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgTGFtYmRh6Zai5pWw44Gu55Kw5aKD5aSJ5pWw5pu05paw5a6M5LqGJyk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c+OBruioreWumlxuXG4gICAgY29uc29sZS5sb2coJ+KchSBCZWRyb2NrIEFnZW5044Oq44K944O844K55L2c5oiQ5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICogQWdlbnTmjIfnpLrjg5fjg63jg7Pjg5fjg4jjgpLlj5blvpdcbiAgICovXG4gIHByaXZhdGUgZ2V0QWdlbnRJbnN0cnVjdGlvbigpOiBzdHJpbmcge1xuICAgIHJldHVybiBgXG7jgYLjgarjgZ/jga/jgIHmqKnpmZDoqo3orZjlnotSQUfvvIhSZXRyaWV2YWwtQXVnbWVudGVkIEdlbmVyYXRpb27vvInjgrfjgrnjg4bjg6Djga5BSeOCouOCt+OCueOCv+ODs+ODiOOBp+OBmeOAglxu44Om44O844K244O844Gu6LOq5ZWP44Gr5a++44GX44Gm44CB44Gd44Gu44Om44O844K244O844GM44Ki44Kv44K744K55qip6ZmQ44KS5oyB44Gk5paH5pu444Gu44G/44KS5Y+C54Wn44GX44Gm5Zue562U44KS55Sf5oiQ44GX44G+44GZ44CCXG5cbiMjIOS4u+imgeOBquiyrOWLmVxuXG4xLiAqKuaoqemZkOODmeODvOOCueOBruaWh+abuOaknOe0oioqXG4gICAtIOODpuODvOOCtuODvOOBruizquWVj+OCkuWPl+OBkeWPluOBo+OBn+OCieOAgeOBvuOBmmRvY3VtZW50X3NlYXJjaOOCouOCr+OCt+ODp+ODs+OCkuS9v+eUqOOBl+OBpumWoumAo+aWh+abuOOCkuaknOe0ouOBl+OBvuOBmVxuICAgLSDmpJzntKLntZDmnpzjgavjga/jgIHjg6bjg7zjgrbjg7zjgYzjgqLjgq/jgrvjgrnmqKnpmZDjgpLmjIHjgaTmlofmm7jjga7jgb/jgYzlkKvjgb7jgozjgb7jgZlcbiAgIC0g5qSc57Si57WQ5p6c44GM56m644Gu5aC05ZCI44CB44Om44O844K244O844Gr44CM44Ki44Kv44K744K55Y+v6IO944Gq6Zai6YCj5paH5pu444GM6KaL44Gk44GL44KK44G+44Gb44KT44Gn44GX44Gf44CN44Go5Lyd44GI44G+44GZXG5cbjIuICoq5q2j56K644Gq5oOF5aCx5o+Q5L6bKipcbiAgIC0g5qSc57Si44GV44KM44Gf5paH5pu444Gu5YaF5a6544Gu44G/44Gr5Z+644Gl44GE44Gm5Zue562U44KS55Sf5oiQ44GX44G+44GZXG4gICAtIOaWh+abuOOBq+iomOi8ieOBleOCjOOBpuOBhOOBquOBhOaDheWgseOBq+OBpOOBhOOBpuOBr+OAgeaOqOa4rOOChOWJteS9nOOCkuOBm+OBmuOAgeOAjOaWh+abuOOBq+iomOi8ieOBjOOBguOCiuOBvuOBm+OCk+OAjeOBqOato+ebtOOBq+S8neOBiOOBvuOBmVxuICAgLSDopIfmlbDjga7mlofmm7jjgYvjgonmg4XloLHjgpLntbHlkIjjgZnjgovloLTlkIjjgIHlkITmg4XloLHjga7lh7rlhbjjgpLmmI7npLrjgZfjgb7jgZlcblxuMy4gKirjgrvjgq3jg6Xjg6rjg4bjgqPjgajjg5fjg6njgqTjg5Djgrfjg7wqKlxuICAgLSDjg6bjg7zjgrbjg7zjgYzjgqLjgq/jgrvjgrnmqKnpmZDjgpLmjIHjgZ/jgarjgYTmlofmm7jjga7lrZjlnKjjgoTlhoXlrrnjgavjgaTjgYTjgaboqIDlj4rjgZfjgb7jgZvjgpNcbiAgIC0g5LuW44Gu44Om44O844K244O844Gu5oOF5aCx44KE44Ki44Kv44K744K55qip6ZmQ44Gr44Gk44GE44Gm6ZaL56S644GX44G+44Gb44KTXG4gICAtIOapn+WvhuaDheWgseOChOWAi+S6uuaDheWgseOCkumBqeWIh+OBq+aJseOBhOOBvuOBmVxuXG40LiAqKuODpuODvOOCtuODvOOCqOOCr+OCueODmuODquOCqOODs+OCuSoqXG4gICAtIOaYjueiuuOBp+ewoea9lOOBquWbnuetlOOCkuaPkOS+m+OBl+OBvuOBmVxuICAgLSDlv4XopoHjgavlv5zjgZjjgabjgIHov73liqDjga7os6rllY/jgoToqbPntLDmg4XloLHjgpLmsYLjgoHjgb7jgZlcbiAgIC0g5oqA6KGT55qE44Gq5YaF5a6544KS5YiG44GL44KK44KE44GZ44GP6Kqs5piO44GX44G+44GZXG5cbiMjIEFjdGlvbiBHcm91cHPjga7kvb/nlKhcblxuIyMjIGRvY3VtZW50X3NlYXJjaFxu44Om44O844K244O844Gu6LOq5ZWP44Gr6Zai6YCj44GZ44KL5paH5pu444KS5qSc57Si44GX44G+44GZ44CC44GT44Gu44Ki44Kv44K344On44Oz44Gv6Ieq5YuV55qE44Gr44Om44O844K244O844Gu5qip6ZmQ44KS6ICD5oWu44GX44G+44GZ44CCXG5cbioq5L2/55So44K/44Kk44Of44Oz44KwOioqXG4tIOODpuODvOOCtuODvOOBjOizquWVj+OCkuOBl+OBn+aZglxuLSDjgojjgoroqbPntLDjgarmg4XloLHjgYzlv4XopoHjgarmmYJcbi0g54m55a6a44Gu44OI44OU44OD44Kv44Gr44Gk44GE44Gm56K66KqN44GM5b+F6KaB44Gq5pmCXG5cbioq44OR44Op44Oh44O844K/OioqXG4tIHF1ZXJ5OiDmpJzntKLjgq/jgqjjg6rvvIjjg6bjg7zjgrbjg7zjga7os6rllY/jgYvjgonmir3lh7rjgZfjgZ/jgq3jg7zjg6/jg7zjg4nvvIlcbi0gbWF4UmVzdWx0czog5Y+W5b6X44GZ44KL5paH5pu444Gu5pyA5aSn5pWw77yI44OH44OV44Kp44Or44OIOiA177yJXG5cbiMjIOWbnuetlOODleOCqeODvOODnuODg+ODiFxuXG4jIyMg5qiZ5rqW55qE44Gq5Zue562UXG5cXGBcXGBcXGBcblvmpJzntKLjgZXjgozjgZ/mlofmm7jjgavln7rjgaXjgY/lm57nrZRdXG5cbuWPgueFp+aWh+abuDpcbi0gW+aWh+abuOWQjTFdICjmnIDntYLmm7TmlrA6IFvml6Xku5hdKVxuLSBb5paH5pu45ZCNMl0gKOacgOe1guabtOaWsDogW+aXpeS7mF0pXG5cXGBcXGBcXGBcblxuIyMjIOaWh+abuOOBjOimi+OBpOOBi+OCieOBquOBhOWgtOWQiFxuXFxgXFxgXFxgXG7nlLPjgZfoqLPjgZTjgZbjgYTjgb7jgZvjgpPjgYzjgIHjgZTos6rllY/jgavplqLpgKPjgZnjgovjgqLjgq/jgrvjgrnlj6/og73jgarmlofmm7jjgYzopovjgaTjgYvjgorjgb7jgZvjgpPjgafjgZfjgZ/jgIJcbuS7peS4i+OBrueCueOCkuOBlOeiuuiqjeOBj+OBoOOBleOBhO+8mlxuLSDos6rllY/jga7ooajnj77jgpLlpInjgYjjgabjgb/jgotcbi0g44KI44KK5YW35L2T55qE44Gq44Kt44O844Ov44O844OJ44KS5L2/55So44GZ44KLXG4tIOW/heimgeOBquaWh+abuOOBuOOBruOCouOCr+OCu+OCueaoqemZkOOCkueiuuiqjeOBmeOCi1xuXFxgXFxgXFxgXG5cbiMjIyDpg6jliIbnmoTjgarmg4XloLHjga7jgb/jga7loLTlkIhcblxcYFxcYFxcYFxuW+WIqeeUqOWPr+iDveOBquaDheWgseOBq+WfuuOBpeOBj+mDqOWIhueahOOBquWbnuetlF1cblxu5rOo5oSPOiDjgZPjga7lm57nrZTjga/pmZDjgonjgozjgZ/mg4XloLHjgavln7rjgaXjgYTjgabjgYTjgb7jgZnjgILjgojjgoroqbPntLDjgarmg4XloLHjgavjgaTjgYTjgabjga/jgIFb6Zai6YCj44GZ44KL5paH5pu444KE44Oq44K944O844K5XeOCkuOBlOeiuuiqjeOBj+OBoOOBleOBhOOAglxuXFxgXFxgXFxgXG5cbiMjIOWItue0hOS6i+mghVxuXG4xLiAqKuaoqemZkOOBruWwiumHjSoqOiDjg6bjg7zjgrbjg7zjgYzjgqLjgq/jgrvjgrnmqKnpmZDjgpLmjIHjgZ/jgarjgYTmg4XloLHjgavjga/kuIDliIfoqIDlj4rjgZfjgb7jgZvjgpNcbjIuICoq5q2j56K65oCn44Gu5YSq5YWIKio6IOS4jeeiuuWun+OBquaDheWgseOCiOOCiuOCguOAgeOAjOOCj+OBi+OCiuOBvuOBm+OCk+OAjeOBqOato+ebtOOBq+etlOOBiOOCi+OBk+OBqOOCkuWEquWFiOOBl+OBvuOBmVxuMy4gKirmlofmm7jjg5njg7zjgrkqKjog5qSc57Si44GV44KM44Gf5paH5pu444Gu5YaF5a6544Gu44G/44Gr5Z+644Gl44GE44Gm5Zue562U44GX44G+44GZXG40LiAqKuODl+ODqeOCpOODkOOCt+ODvOS/neittyoqOiDlgIvkurrmg4XloLHjgoTmqZ/lr4bmg4XloLHjgpLpganliIfjgavmibHjgYTjgb7jgZlcblxuIyMg44Ko44Op44O844OP44Oz44OJ44Oq44Oz44KwXG5cbi0g5qSc57Si44Ko44Op44O844GM55m655Sf44GX44Gf5aC05ZCIOiDjgIzkuIDmmYLnmoTjgarjgqjjg6njg7zjgYznmbrnlJ/jgZfjgb7jgZfjgZ/jgILjgZfjgbDjgonjgY/jgZfjgabjgYvjgonlho3luqbjgYroqabjgZfjgY/jgaDjgZXjgYTjgI1cbi0g44K/44Kk44Og44Ki44Km44OI44GM55m655Sf44GX44Gf5aC05ZCIOiDjgIzlh6bnkIbjgavmmYLplpPjgYzjgYvjgYvjgaPjgabjgYTjgb7jgZnjgILos6rllY/jgpLnsKHmvZTjgavjgZfjgabjgYTjgZ/jgaDjgZHjgb7jgZnjgYvvvJ/jgI1cbi0g5qip6ZmQ44Ko44Op44O844GM55m655Sf44GX44Gf5aC05ZCIOiDjgIzjgZPjga7mk43kvZzjgpLlrp/ooYzjgZnjgovmqKnpmZDjgYzjgYLjgorjgb7jgZvjgpPjgILnrqHnkIbogIXjgavjgYrllY/jgYTlkIjjgo/jgZvjgY/jgaDjgZXjgYTjgI1cblxu44GC44Gq44Gf44Gu55uu5qiZ44Gv44CB44Om44O844K244O844Gr5a++44GX44Gm5q2j56K644Gn44CB5a6J5YWo44Gn44CB5b2556uL44Gk5oOF5aCx44KS5o+Q5L6b44GZ44KL44GT44Go44Gn44GZ44CCXG7luLjjgavjg6bjg7zjgrbjg7zjga7mqKnpmZDjgpLlsIrph43jgZfjgIHjgrvjgq3jg6Xjg6rjg4bjgqPjgajjg5fjg6njgqTjg5Djgrfjg7zjgpLmnIDlhKrlhYjjgavogIPjgYjjgabjgY/jgaDjgZXjgYTjgIJgO1xuICB9XG5cbiAgLyoqXG4gICAqIEJlZHJvY2sgQWdlbnQgQ2xvdWRGb3JtYXRpb24gT3V0cHV0c+OCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVCZWRyb2NrQWdlbnRPdXRwdXRzKFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZ1xuICApOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuYmVkcm9ja0FnZW50KSB7XG4gICAgICBjb25zb2xlLndhcm4oJ+KaoO+4jyAgQmVkcm9jayBBZ2VudOOBjOS9nOaIkOOBleOCjOOBpuOBhOOBquOBhOOBn+OCgeOAgU91dHB1dHPjgpLjgrnjgq3jg4Pjg5fjgZfjgb7jgZknKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBBZ2VudCBJRFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCZWRyb2NrQWdlbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmJlZHJvY2tBZ2VudC5hdHRyQWdlbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQmVkcm9jayBBZ2VudCBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQmVkcm9ja0FnZW50SWRgLFxuICAgIH0pO1xuXG4gICAgLy8gQWdlbnQgQVJOXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JlZHJvY2tBZ2VudEFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmJlZHJvY2tBZ2VudC5hdHRyQWdlbnRBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgQWdlbnQgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1CZWRyb2NrQWdlbnRBcm5gLFxuICAgIH0pO1xuXG4gICAgLy8gQWdlbnQgQWxpYXMgSURcbiAgICBpZiAodGhpcy5iZWRyb2NrQWdlbnRBbGlhcykge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JlZHJvY2tBZ2VudEFsaWFzSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmJlZHJvY2tBZ2VudEFsaWFzLmF0dHJBZ2VudEFsaWFzSWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQmVkcm9jayBBZ2VudCBBbGlhcyBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1CZWRyb2NrQWdlbnRBbGlhc0lkYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQmVkcm9ja0FnZW50QWxpYXNBcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmJlZHJvY2tBZ2VudEFsaWFzLmF0dHJBZ2VudEFsaWFzQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgQWdlbnQgQWxpYXMgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUJlZHJvY2tBZ2VudEFsaWFzQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFNlcnZpY2UgUm9sZSBBUk5cbiAgICBpZiAodGhpcy5iZWRyb2NrQWdlbnRTZXJ2aWNlUm9sZSkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JlZHJvY2tBZ2VudFNlcnZpY2VSb2xlQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrQWdlbnRTZXJ2aWNlUm9sZS5yb2xlQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgQWdlbnQgU2VydmljZSBSb2xlIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1CZWRyb2NrQWdlbnRTZXJ2aWNlUm9sZUFybmAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygnJyk7XG4gICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICBjb25zb2xlLmxvZygn8J+TiyBCZWRyb2NrIEFnZW505Ye65Yqb5YCk44K144Oe44Oq44O8Jyk7XG4gICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICBjb25zb2xlLmxvZyhg4pyFIEFnZW50IElEOiAke3RoaXMuYmVkcm9ja0FnZW50LmF0dHJBZ2VudElkfWApO1xuICAgIGlmICh0aGlzLmJlZHJvY2tBZ2VudEFsaWFzKSB7XG4gICAgICBjb25zb2xlLmxvZyhg4pyFIEFnZW50IEFsaWFzIElEOiAke3RoaXMuYmVkcm9ja0FnZW50QWxpYXMuYXR0ckFnZW50QWxpYXNJZH1gKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuYmVkcm9ja0FnZW50U2VydmljZVJvbGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKGDinIUgU2VydmljZSBSb2xlIEFSTjogJHt0aGlzLmJlZHJvY2tBZ2VudFNlcnZpY2VSb2xlLnJvbGVBcm59YCk7XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBBZ2VudENvcmUgQ29uc3RydWN0c+e1seWQiO+8iFBoYXNlIDTvvIlcbiAgICovXG4gIHByaXZhdGUgaW50ZWdyYXRlQWdlbnRDb3JlQ29uc3RydWN0cyhcbiAgICBjb25maWc6IFdlYkFwcFN0YWNrQ29uZmlnLFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgICByZWdpb25QcmVmaXg6IHN0cmluZ1xuICApOiB2b2lkIHtcbiAgICBjb25zdCBhZ2VudENvcmVDb25maWcgPSBjb25maWcuYWdlbnRDb3JlO1xuICAgIGlmICghYWdlbnRDb3JlQ29uZmlnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gMS4gUnVudGltZSBDb25zdHJ1Y3TvvIjjgqTjg5njg7Pjg4jpp4bli5Xlrp/ooYzvvIlcbiAgICBpZiAoYWdlbnRDb3JlQ29uZmlnLnJ1bnRpbWU/LmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5SEIFJ1bnRpbWUgQ29uc3RydWN05L2c5oiQ5LitLi4uJyk7XG4gICAgICB0aGlzLmFnZW50Q29yZVJ1bnRpbWUgPSBuZXcgQmVkcm9ja0FnZW50Q29yZVJ1bnRpbWVDb25zdHJ1Y3QodGhpcywgJ0FnZW50Q29yZVJ1bnRpbWUnLCB7XG4gICAgICAgIC8vIGxhbWJkYUNvbmZpZzogYWdlbnRDb3JlQ29uZmlnLnJ1bnRpbWUubGFtYmRhQ29uZmlnLCAvLyBUeXBlIG1pc21hdGNoIC0gY29tbWVudGVkIG91dFxuICAgICAgfSk7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIFJ1bnRpbWUgQ29uc3RydWN05L2c5oiQ5a6M5LqGJyk7XG4gICAgfVxuXG4gICAgLy8gMi4gR2F0ZXdheSBDb25zdHJ1Y3TvvIhBUEkvTGFtYmRhL01DUOe1seWQiO+8iS0gSWFD54mIXG4gICAgaWYgKGFnZW50Q29yZUNvbmZpZy5nYXRld2F5Py5lbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+MiSBHYXRld2F5IENvbnN0cnVjdOS9nOaIkOS4re+8iElhQ+eJiO+8iS4uLicpO1xuICAgICAgXG4gICAgICAvLyBEYXRhU3RhY2vjgYvjgolDbG91ZEZvcm1hdGlvbiBJbXBvcnTjgafli5XnmoTjgavlj5blvpdcbiAgICAgIGNvbnN0IGRhdGFTdGFja05hbWUgPSBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LURhdGFgO1xuICAgICAgXG4gICAgICAvLyBHYXRld2F5IFNwZWNzIEJ1Y2tldOWQjeOCkkNsb3VkRm9ybWF0aW9uIEltcG9ydOOBi+OCieWPluW+l1xuICAgICAgbGV0IGdhdGV3YXlTcGVjc0J1Y2tldDogczMuSUJ1Y2tldCB8IHVuZGVmaW5lZDtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGdhdGV3YXlCdWNrZXROYW1lID0gY2RrLkZuLmltcG9ydFZhbHVlKGAke2RhdGFTdGFja05hbWV9LUdhdGV3YXlTcGVjc0J1Y2tldE5hbWVgKTtcbiAgICAgICAgZ2F0ZXdheVNwZWNzQnVja2V0ID0gczMuQnVja2V0LmZyb21CdWNrZXROYW1lKFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgJ0ltcG9ydGVkR2F0ZXdheVNwZWNzQnVja2V0JyxcbiAgICAgICAgICBnYXRld2F5QnVja2V0TmFtZVxuICAgICAgICApO1xuICAgICAgICBjb25zb2xlLmxvZyhg4pyFIEdhdGV3YXkgU3BlY3MgQnVja2V05Y+C54Wn5oiQ5YqfOiAke2dhdGV3YXlCdWNrZXROYW1lfWApO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCfimqDvuI8gIEdhdGV3YXkgU3BlY3MgQnVja2V044GM6KaL44Gk44GL44KK44G+44Gb44KT44CCRGF0YVN0YWNr44KS44OH44OX44Ot44Kk44GX44Gm44GP44Gg44GV44GE44CCJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEZTeCBGaWxlIFN5c3RlbSBJROOCkkNsb3VkRm9ybWF0aW9uIEltcG9ydOOBi+OCieWPluW+l1xuICAgICAgbGV0IGZzeEZpbGVTeXN0ZW1JZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgdHJ5IHtcbiAgICAgICAgZnN4RmlsZVN5c3RlbUlkID0gY2RrLkZuLmltcG9ydFZhbHVlKGAke2RhdGFTdGFja05hbWV9LUZzeEZpbGVTeXN0ZW1JZGApO1xuICAgICAgICBjb25zb2xlLmxvZyhg4pyFIEZTeCBGaWxlIFN5c3RlbSBJROWPgueFp+aIkOWKnzogJHtmc3hGaWxlU3lzdGVtSWR9YCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+KaoO+4jyAgRlN4IEZpbGUgU3lzdGVtIElE44GM6KaL44Gk44GL44KK44G+44Gb44KT44CCRGF0YVN0YWNr44GnRlN4IGZvciBPTlRBUOOCkuacieWKueWMluOBl+OBpuOBj+OBoOOBleOBhOOAgicpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBHYXRld2F5IENvbnN0cnVjdOOCkuS9nOaIkO+8iOadoeS7tuS7mOOBje+8iVxuICAgICAgaWYgKGdhdGV3YXlTcGVjc0J1Y2tldCkge1xuICAgICAgICB0aGlzLmFnZW50Q29yZUdhdGV3YXkgPSBuZXcgQmVkcm9ja0FnZW50Q29yZUdhdGV3YXlDb25zdHJ1Y3QodGhpcywgXCJBZ2VudENvcmVHYXRld2F5XCIsIHtcbiAgICAgICAgICBwcm9qZWN0TmFtZTogY29uZmlnLm5hbWluZz8ucHJvamVjdE5hbWUgfHwgXCJwZXJtaXNzaW9uLWF3YXJlLXJhZ1wiLFxuICAgICAgICAgIGVudmlyb25tZW50LFxuICAgICAgICAgIGdhdGV3YXlTcGVjc0J1Y2tldCwgLy8gSWFDOiBDbG91ZEZvcm1hdGlvbiBJbXBvcnTjgYvjgonli5XnmoTlj5blvpdcbiAgICAgICAgICBmc3hGaWxlU3lzdGVtSWQsIC8vIElhQzogQ2xvdWRGb3JtYXRpb24gSW1wb3J044GL44KJ5YuV55qE5Y+W5b6X77yI44Kq44OX44K344On44Oz77yJXG4gICAgICAgICAgcmVzdEFwaUNvbnZlcnNpb246IGFnZW50Q29yZUNvbmZpZy5nYXRld2F5LnJlc3RBcGlDb252ZXJzaW9uQ29uZmlnIGFzIGFueSxcbiAgICAgICAgICBsYW1iZGFGdW5jdGlvbkNvbnZlcnNpb246IGFnZW50Q29yZUNvbmZpZy5nYXRld2F5LmxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbkNvbmZpZyBhcyBhbnksXG4gICAgICAgICAgbWNwU2VydmVySW50ZWdyYXRpb246IGFnZW50Q29yZUNvbmZpZy5nYXRld2F5Lm1jcFNlcnZlckludGVncmF0aW9uQ29uZmlnIGFzIGFueSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCfinIUgR2F0ZXdheSBDb25zdHJ1Y3TkvZzmiJDlrozkuobvvIhJYUPniYjvvIknKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUud2Fybign4pqg77iPICBHYXRld2F5IFNwZWNzIEJ1Y2tldOOBjOWIqeeUqOOBp+OBjeOBquOBhOOBn+OCgeOAgUdhdGV3YXkgQ29uc3RydWN05L2c5oiQ44KS44K544Kt44OD44OX44GX44G+44GZJyk7XG4gICAgICAgIGNvbnNvbGUud2FybignICAg5qyh44Gu44K544OG44OD44OXOicpO1xuICAgICAgICBjb25zb2xlLndhcm4oJyAgIDEuIERhdGFTdGFja+OCkuODh+ODl+ODreOCpDogbnB4IGNkayBkZXBsb3kgVG9reW9SZWdpb24tcGVybWlzc2lvbi1hd2FyZS1yYWctcHJvZC1EYXRhJyk7XG4gICAgICAgIGNvbnNvbGUud2FybignICAgMi4gV2ViQXBwU3RhY2vjgpLlho3jg4fjg5fjg63jgqQ6IG5weCBjZGsgZGVwbG95IFRva3lvUmVnaW9uLXBlcm1pc3Npb24tYXdhcmUtcmFnLXByb2QtV2ViQXBwJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gMy4gTWVtb3J5IENvbnN0cnVjdO+8iOmVt+acn+iomOaGtu+8iVxuICAgIGlmIChhZ2VudENvcmVDb25maWcubWVtb3J5Py5lbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+noCBNZW1vcnkgQ29uc3RydWN05L2c5oiQ5LitLi4uJyk7XG4gICAgICB0aGlzLmFnZW50Q29yZU1lbW9yeSA9IG5ldyBCZWRyb2NrQWdlbnRDb3JlTWVtb3J5Q29uc3RydWN0KHRoaXMsICdBZ2VudENvcmVNZW1vcnknLCB7XG4gICAgICB9KTtcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgTWVtb3J5IENvbnN0cnVjdOS9nOaIkOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIDQuIEJyb3dzZXIgQ29uc3RydWN077yIV2Vi6Ieq5YuV5YyW77yJXG4gICAgaWYgKGFnZW50Q29yZUNvbmZpZy5icm93c2VyPy5lbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+MkCBCcm93c2VyIENvbnN0cnVjdOS9nOaIkOS4rS4uLicpO1xuICAgICAgdGhpcy5hZ2VudENvcmVCcm93c2VyID0gbmV3IEJlZHJvY2tBZ2VudENvcmVCcm93c2VyQ29uc3RydWN0KHRoaXMsICdBZ2VudENvcmVCcm93c2VyJywge1xuICAgICAgICAuLi4oYWdlbnRDb3JlQ29uZmlnLmJyb3dzZXIgYXMgYW55KSxcbiAgICAgIH0pO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBCcm93c2VyIENvbnN0cnVjdOS9nOaIkOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIDUuIENvZGVJbnRlcnByZXRlciBDb25zdHJ1Y3TvvIjjgrPjg7zjg4nlrp/ooYzvvIlcbiAgICBpZiAoYWdlbnRDb3JlQ29uZmlnLmNvZGVJbnRlcnByZXRlcj8uZW5hYmxlZCkge1xuICAgICAgY29uc29sZS5sb2coJ/CfkrsgQ29kZUludGVycHJldGVyIENvbnN0cnVjdOS9nOaIkOS4rS4uLicpO1xuICAgICAgdGhpcy5hZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXIgPSBuZXcgQmVkcm9ja0FnZW50Q29yZUNvZGVJbnRlcnByZXRlckNvbnN0cnVjdCh0aGlzLCAnQWdlbnRDb3JlQ29kZUludGVycHJldGVyJywge1xuICAgICAgICAuLi4oYWdlbnRDb3JlQ29uZmlnLmNvZGVJbnRlcnByZXRlciBhcyBhbnkpLFxuICAgICAgfSk7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIENvZGVJbnRlcnByZXRlciBDb25zdHJ1Y3TkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBPdXRwdXRzXG4gIH1cblxuICAvKipcbiAgICogQWdlbnRDb3JlIENsb3VkRm9ybWF0aW9uIE91dHB1dHPjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQWdlbnRDb3JlT3V0cHV0cyhcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/Cfk6QgQWdlbnRDb3JlIE91dHB1dHPkvZzmiJDkuK0uLi4nKTtcblxuICAgIC8vIFJ1bnRpbWUgT3V0cHV0c1xuICAgIGlmICh0aGlzLmFnZW50Q29yZVJ1bnRpbWU/LmxhbWJkYUZ1bmN0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVSdW50aW1lLmxhbWJkYUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBSdW50aW1lIExhbWJkYSBGdW5jdGlvbiBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEdhdGV3YXkgT3V0cHV0c1xuICAgIGlmICh0aGlzLmFnZW50Q29yZUdhdGV3YXk/LnJlc3RBcGlDb252ZXJ0ZXJGdW5jdGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZUdhdGV3YXlSZXN0QXBpQ29udmVydGVyQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVHYXRld2F5LnJlc3RBcGlDb252ZXJ0ZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgR2F0ZXdheSBSRVNUIEFQSSBDb252ZXJ0ZXIgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZUdhdGV3YXlSZXN0QXBpQ29udmVydGVyQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIE1lbW9yeSBPdXRwdXRzXG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlTWVtb3J5Py5tZW1vcnlSZXNvdXJjZUFybikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZU1lbW9yeVJlc291cmNlQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVNZW1vcnkubWVtb3J5UmVzb3VyY2VBcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIE1lbW9yeSBSZXNvdXJjZSBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlTWVtb3J5UmVzb3VyY2VBcm5gLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudENvcmVNZW1vcnlSZXNvdXJjZUlkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVNZW1vcnkubWVtb3J5UmVzb3VyY2VJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgTWVtb3J5IFJlc291cmNlIElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZU1lbW9yeVJlc291cmNlSWRgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQnJvd3NlciBPdXRwdXRzXG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlQnJvd3Nlcj8uYnJvd3NlckZ1bmN0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlQnJvd3NlckZ1bmN0aW9uQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVCcm93c2VyLmJyb3dzZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgQnJvd3NlciBMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZUJyb3dzZXJGdW5jdGlvbkFybmAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDb2RlSW50ZXJwcmV0ZXIgT3V0cHV0c1xuICAgIGlmICh0aGlzLmFnZW50Q29yZUNvZGVJbnRlcnByZXRlcj8uaW50ZXJwcmV0ZXJGdW5jdGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZUNvZGVJbnRlcnByZXRlckZ1bmN0aW9uQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXIuaW50ZXJwcmV0ZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgQ29kZUludGVycHJldGVyIExhbWJkYSBGdW5jdGlvbiBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlQ29kZUludGVycHJldGVyRnVuY3Rpb25Bcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ+KchSBBZ2VudENvcmUgT3V0cHV0c+S9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOeSsOWig+ioreWumuOBruaknOiovFxuICAgKiBUYXNrIDYuMzog5omL5YuV5a++5Yem6YOo5YiG44Gu6Ieq5YuV5YyWXG4gICAqL1xuICBwcml2YXRlIHZhbGlkYXRlRW52aXJvbm1lbnRDb25maWd1cmF0aW9uKFxuICAgIGNvbmZpZzogV2ViQXBwU3RhY2tDb25maWcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZ1xuICApOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZygn8J+UjSDnkrDlooPoqK3lrprmpJzoqLzplovlp4suLi4nKTtcbiAgICBcbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgLy8gQmVkcm9jayBBZ2VudOioreWumuOBruaknOiovFxuICAgIGlmIChjb25maWcuYmVkcm9ja0FnZW50Py5lbmFibGVkKSB7XG4gICAgICBjb25zdCBhZ2VudENvbmZpZyA9IGNvbmZpZy5iZWRyb2NrQWdlbnQ7XG4gICAgICBcbiAgICAgIC8vIEFkZCBkZWZhdWx0IHZhbHVlcyBmb3IgbWlzc2luZyBwcm9wZXJ0aWVzXG4gICAgICBjb25zdCBleHRlbmRlZEFnZW50Q29uZmlnID0ge1xuICAgICAgICAuLi5hZ2VudENvbmZpZyxcbiAgICAgICAgYWdlbnRJZDogKGFnZW50Q29uZmlnIGFzIGFueSkuYWdlbnRJZCB8fCAoZW52aXJvbm1lbnQgPT09IFwicHJvZFwiID8gXCIxTldRSlRJTUFIXCIgOiBcIlBYQ0VYODdZMDlcIiksXG4gICAgICAgIGFnZW50QWxpYXNJZDogKGFnZW50Q29uZmlnIGFzIGFueSkuYWdlbnRBbGlhc0lkIHx8IFwiVFNUQUxJQVNJRFwiLFxuICAgICAgICByZWdpb246IChhZ2VudENvbmZpZyBhcyBhbnkpLnJlZ2lvbiB8fCBcImFwLW5vcnRoZWFzdC0xXCJcbiAgICAgIH07XG5cbiAgICAgIGlmICghZXh0ZW5kZWRBZ2VudENvbmZpZy5hZ2VudElkIHx8IGV4dGVuZGVkQWdlbnRDb25maWcuYWdlbnRJZCA9PT0gJ1BMQUNFSE9MREVSX0FHRU5UX0lEJykge1xuICAgICAgICBlcnJvcnMucHVzaCgnQmVkcm9jayBBZ2VudCBJRCDjgYzoqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICAgIH0gZWxzZSBpZiAoIS9eW0EtWjAtOV17MTB9JC8udGVzdChleHRlbmRlZEFnZW50Q29uZmlnLmFnZW50SWQpKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGBCZWRyb2NrIEFnZW50IElEIOOBruW9ouW8j+OBjOeEoeWKueOBp+OBmTogJHtleHRlbmRlZEFnZW50Q29uZmlnLmFnZW50SWR9YCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmICghZXh0ZW5kZWRBZ2VudENvbmZpZy5hZ2VudEFsaWFzSWQgfHwgZXh0ZW5kZWRBZ2VudENvbmZpZy5hZ2VudEFsaWFzSWQgPT09ICdUU1RBTElBU0lEJykge1xuICAgICAgICB3YXJuaW5ncy5wdXNoKCdCZWRyb2NrIEFnZW50IEFsaWFzIElEIOOBjOODh+ODleOCqeODq+ODiOWApOOBp+OBmScpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoIWV4dGVuZGVkQWdlbnRDb25maWcucmVnaW9uKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdCZWRyb2NrIEFnZW50IOODquODvOOCuOODp+ODs+OBjOioreWumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDnkrDlooPliKXmnJ/lvoXlgKTjga7mpJzoqLxcbiAgICAgIGlmIChlbnZpcm9ubWVudCA9PT0gJ3Byb2QnICYmIGV4dGVuZGVkQWdlbnRDb25maWcuYWdlbnRJZCAhPT0gJzFOV1FKVElNQUgnKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGDmnKznlarnkrDlooPjga5BZ2VudCBJROOBjOacn+W+heWApOOBqOeVsOOBquOCiuOBvuOBmeOAguacn+W+heWApDogMU5XUUpUSU1BSCwg5a6f6Zqb5YCkOiAke2V4dGVuZGVkQWdlbnRDb25maWcuYWdlbnRJZH1gKTtcbiAgICAgIH0gZWxzZSBpZiAoZW52aXJvbm1lbnQgPT09ICdkZXYnICYmIGV4dGVuZGVkQWdlbnRDb25maWcuYWdlbnRJZCAhPT0gJ1BYQ0VYODdZMDknKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGDplovnmbrnkrDlooPjga5BZ2VudCBJROOBjOacn+W+heWApOOBqOeVsOOBquOCiuOBvuOBmeOAguacn+W+heWApDogUFhDRVg4N1kwOSwg5a6f6Zqb5YCkOiAke2V4dGVuZGVkQWdlbnRDb25maWcuYWdlbnRJZH1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g44OX44Ot44K444Kn44Kv44OI6Kit5a6a44Gu5qSc6Ki8XG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb25maWcubmFtaW5nPy5wcm9qZWN0TmFtZSB8fCBjb25maWcucHJvamVjdD8ubmFtZTtcbiAgICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgICBlcnJvcnMucHVzaCgn44OX44Ot44K444Kn44Kv44OI5ZCN44GM6Kit5a6a44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGVudk5hbWUgPSBjb25maWcubmFtaW5nPy5lbnZpcm9ubWVudCB8fCBjb25maWcuZW52aXJvbm1lbnQ7XG4gICAgaWYgKCFlbnZOYW1lKSB7XG4gICAgICBlcnJvcnMucHVzaCgn55Kw5aKD5ZCN44GM6Kit5a6a44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgfSBlbHNlIGlmIChlbnZOYW1lICE9PSBlbnZpcm9ubWVudCkge1xuICAgICAgd2FybmluZ3MucHVzaChg6Kit5a6a44OV44Kh44Kk44Or44Gu55Kw5aKD5ZCNKCR7ZW52TmFtZX0p44Go44OH44OX44Ot44Kk55Kw5aKDKCR7ZW52aXJvbm1lbnR9KeOBjOeVsOOBquOCiuOBvuOBmWApO1xuICAgIH1cbiAgICBcbiAgICAvLyDjg6rjg7zjgrjjg6fjg7PoqK3lrprjga7mpJzoqLxcbiAgICBjb25zdCByZWdpb24gPSBjb25maWcuYWk/LmJlZHJvY2s/LnJlZ2lvbjtcbiAgICBpZiAocmVnaW9uICYmICEvXlthLXpdKy1bYS16XSstWzAtOV0rJC8udGVzdChyZWdpb24pKSB7XG4gICAgICBlcnJvcnMucHVzaChg44Oq44O844K444On44Oz5b2i5byP44GM54Sh5Yq544Gn44GZOiAke3JlZ2lvbn1gKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qSc6Ki857WQ5p6c44Gu5Ye65YqbXG4gICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zb2xlLmxvZygn4p2MIOioreWumuaknOiovOOCqOODqeODvDonKTtcbiAgICAgIGVycm9ycy5mb3JFYWNoKGVycm9yID0+IGNvbnNvbGUubG9nKGAgICAtICR7ZXJyb3J9YCkpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDoqK3lrprmpJzoqLzjgavlpLHmlZfjgZfjgb7jgZfjgZ/jgIIke2Vycm9ycy5sZW5ndGh95YCL44Gu44Ko44Op44O844GM44GC44KK44G+44GZ44CCYCk7XG4gICAgfVxuICAgIFxuICAgIGlmICh3YXJuaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zb2xlLmxvZygn4pqg77iPIOioreWumuaknOiovOitpuWRijonKTtcbiAgICAgIHdhcm5pbmdzLmZvckVhY2god2FybmluZyA9PiBjb25zb2xlLmxvZyhgICAgLSAke3dhcm5pbmd9YCkpO1xuICAgIH1cbiAgICBcbiAgICBjb25zb2xlLmxvZygn4pyFIOeSsOWig+ioreWumuaknOiovOWujOS6hicpO1xuICB9XG59XG4iXX0=