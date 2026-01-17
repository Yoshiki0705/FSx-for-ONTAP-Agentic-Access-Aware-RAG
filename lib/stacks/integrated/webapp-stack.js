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
            this.setupStandaloneResources(existingVpcId, existingSecurityGroupId, projectName, environment, regionPrefix);
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
                        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
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
            this.createPermissionApiResources(props.userAccessTable, props.permissionCacheTable, config, projectName, environment, regionPrefix);
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
            this.createBedrockAgentResources(config, projectName, environment, regionPrefix);
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
            this.integrateAgentCoreConstructs(config, projectName, environment, regionPrefix);
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
                    this.createDynamoDbVpcEndpoint(this.vpc, projectName, environment, regionPrefix);
                }
                catch (error) {
                    console.log('ℹ️  DynamoDB VPC Endpointは既に存在するか、作成できませんでした');
                }
            }
            catch (error) {
                console.warn('⚠️  既存VPCが見つかりません。新規VPCを作成します。');
                this.vpc = this.createMinimalVpc(projectName, environment, regionPrefix);
            }
        }
        else {
            console.log('🆕 新規VPCを作成（最小構成）');
            this.vpc = this.createMinimalVpc(projectName, environment, regionPrefix);
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
                this.securityGroup = this.createSecurityGroup(projectName, environment, regionPrefix);
            }
        }
        else {
            console.log('🆕 新規セキュリティグループを作成');
            this.securityGroup = this.createSecurityGroup(projectName, environment, regionPrefix);
        }
        // IAMロールの作成（必須）
        console.log('🔑 IAMロールを作成');
        this.createIamRoles(projectName, environment, regionPrefix);
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
                this.createDynamoDbVpcEndpoint(vpc, projectName, environment, regionPrefix);
            }
            // Bedrock Runtime VPC Endpoint（Interface型、$7.2/月）
            if (lambdaVpcConfig.endpoints?.bedrockRuntime) {
                // セキュリティグループが必要なので、先に作成
                if (!this.securityGroup) {
                    this.securityGroup = this.createSecurityGroup(projectName, environment, regionPrefix);
                }
                this.createBedrockRuntimeVpcEndpoint(vpc, this.securityGroup, projectName, environment, regionPrefix);
            }
            // Bedrock Agent Runtime VPC Endpoint（Interface型、$7.2/月）
            if (lambdaVpcConfig.endpoints?.bedrockAgentRuntime) {
                // セキュリティグループが必要なので、先に作成
                if (!this.securityGroup) {
                    this.securityGroup = this.createSecurityGroup(projectName, environment, regionPrefix);
                }
                this.createBedrockAgentRuntimeVpcEndpoint(vpc, this.securityGroup, projectName, environment, regionPrefix);
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
        const bedrockAgentConstruct = new bedrock_agent_dynamic_construct_1.BedrockAgentDynamicConstruct(this, 'BedrockAgentDynamic', {
            projectName,
            environment,
            agentName: `${regionPrefix}-${projectName}-${environment}-rag-agent`,
            agentDescription: 'Permission-aware RAG Agent with dynamic model selection',
            instruction: this.getAgentInstruction(),
            useCase: config.bedrockAgent?.useCase || 'chat',
            modelRequirements: config.bedrockAgent?.modelRequirements || {
                onDemand: true,
                streaming: true,
                crossRegion: true,
            },
            enableDynamicModelSelection: config.bedrockAgent?.enableDynamicModelSelection !== false,
            enableAutoUpdate: config.bedrockAgent?.enableAutoUpdate !== false,
            parameterStorePrefix: config.bedrockAgent?.parameterStorePrefix || `/bedrock-agent/${projectName}/${environment}`,
            knowledgeBaseArn: config.bedrockAgent?.knowledgeBaseId
                ? `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${config.bedrockAgent.knowledgeBaseId}`
                : undefined,
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
        this.createBedrockAgentOutputs(projectName, environment);
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
                enabled: true,
                projectName,
                environment,
                lambdaConfig: agentCoreConfig.runtime.lambdaConfig,
                eventBridgeConfig: agentCoreConfig.runtime.eventBridgeConfig,
                bedrockAgentConfig: {
                    agentId: this.bedrockAgent?.attrAgentId,
                    agentAliasId: this.bedrockAgentAlias?.attrAgentAliasId,
                    region: config.ai?.bedrock?.region || 'us-east-1',
                },
            });
            console.log('✅ Runtime Construct作成完了');
        }
        // 2. Gateway Construct（API/Lambda/MCP統合）
        if (agentCoreConfig.gateway?.enabled) {
            console.log('🌉 Gateway Construct作成中...');
            this.agentCoreGateway = new bedrock_agent_core_gateway_construct_1.BedrockAgentCoreGatewayConstruct(this, 'AgentCoreGateway', {
                enabled: true,
                projectName,
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
            this.agentCoreMemory = new bedrock_agent_core_memory_construct_1.BedrockAgentCoreMemoryConstruct(this, 'AgentCoreMemory', {
                enabled: true,
                projectName,
                environment,
                memoryStrategy: agentCoreConfig.memory.memoryStrategyConfig,
                kms: agentCoreConfig.memory.kmsConfig,
            });
            console.log('✅ Memory Construct作成完了');
        }
        // 4. Browser Construct（Web自動化）
        if (agentCoreConfig.browser?.enabled) {
            console.log('🌐 Browser Construct作成中...');
            this.agentCoreBrowser = new bedrock_agent_core_browser_construct_1.BedrockAgentCoreBrowserConstruct(this, 'AgentCoreBrowser', {
                enabled: true,
                projectName,
                environment,
                ...agentCoreConfig.browser,
            });
            console.log('✅ Browser Construct作成完了');
        }
        // 5. CodeInterpreter Construct（コード実行）
        if (agentCoreConfig.codeInterpreter?.enabled) {
            console.log('💻 CodeInterpreter Construct作成中...');
            this.agentCoreCodeInterpreter = new bedrock_agent_core_code_interpreter_construct_1.BedrockAgentCoreCodeInterpreterConstruct(this, 'AgentCoreCodeInterpreter', {
                enabled: true,
                projectName,
                environment,
                ...agentCoreConfig.codeInterpreter,
            });
            console.log('✅ CodeInterpreter Construct作成完了');
        }
        // CloudFormation Outputs
        this.createAgentCoreOutputs(projectName, environment);
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
            const agentConfig = config.bedrockAgent.agent;
            if (!agentConfig?.agentId || agentConfig.agentId === 'PLACEHOLDER_AGENT_ID') {
                errors.push('Bedrock Agent ID が設定されていません');
            }
            else if (!/^[A-Z0-9]{10}$/.test(agentConfig.agentId)) {
                errors.push(`Bedrock Agent ID の形式が無効です: ${agentConfig.agentId}`);
            }
            if (!agentConfig?.agentAliasId || agentConfig.agentAliasId === 'TSTALIASID') {
                warnings.push('Bedrock Agent Alias ID がデフォルト値です');
            }
            if (!agentConfig?.region) {
                errors.push('Bedrock Agent リージョンが設定されていません');
            }
            // 環境別期待値の検証
            if (environment === 'prod' && agentConfig?.agentId !== '1NWQJTIMAH') {
                errors.push(`本番環境のAgent IDが期待値と異なります。期待値: 1NWQJTIMAH, 実際値: ${agentConfig?.agentId}`);
            }
            else if (environment === 'dev' && agentConfig?.agentId !== 'PXCEX87Y09') {
                errors.push(`開発環境のAgent IDが期待値と異なります。期待値: PXCEX87Y09, 実際値: ${agentConfig?.agentId}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViYXBwLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid2ViYXBwLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7R0FXRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFFbkMsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsdUVBQXlEO0FBQ3pELDRFQUE4RDtBQUM5RCwyREFBNkM7QUFDN0MseURBQTJDO0FBQzNDLHVFQUF5RDtBQVF6RCw0QkFBNEI7QUFDNUIsaUhBQTJHO0FBQzNHLGtDQUFrQztBQUNsQywySEFBb0g7QUFDcEgsMkhBQW9IO0FBQ3BILHlIQUFrSDtBQUNsSCwySEFBb0g7QUFDcEgsNklBQXFJO0FBR3JJOztHQUVHO0FBQ0gsTUFBTSxxQkFBcUIsR0FBRztJQUM1QixXQUFXLEVBQUUsc0JBQXNCO0lBQ25DLFdBQVcsRUFBRSxNQUFNO0lBQ25CLFlBQVksRUFBRSxhQUFhO0lBQzNCLE1BQU0sRUFBRTtRQUNOLE9BQU8sRUFBRSxFQUFFO1FBQ1gsVUFBVSxFQUFFLEdBQUc7S0FDaEI7SUFDRCxPQUFPLEVBQUU7UUFDUCxNQUFNLEVBQUUsV0FBVztLQUNwQjtJQUNELFVBQVUsRUFBRSxpQkFBaUI7SUFDN0IsMkNBQTJDO0lBQzNDLDZCQUE2QjtDQUM5QixDQUFDO0FBc0hGOztHQUVHO0FBQ0gsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDeEMsc0JBQXNCO0lBQ04sY0FBYyxDQUFrQjtJQUVoRCwwQkFBMEI7SUFDVixXQUFXLENBQXFCO0lBRWhELDhCQUE4QjtJQUNkLFlBQVksQ0FBMEI7SUFFdEQscUJBQXFCO0lBQ0wsYUFBYSxDQUFrQjtJQUUvQyxxQ0FBcUM7SUFDOUIscUJBQXFCLENBQW1CO0lBRS9DLDZCQUE2QjtJQUN0QixhQUFhLENBQXNCO0lBRTFDLHdCQUF3QjtJQUNoQixHQUFHLENBQVk7SUFFdkIsK0JBQStC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InNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogV2ViQXBwU3RhY2sgLSBMYW1iZGEgV2ViIEFkYXB0ZXIgKyBOZXh0LmpzICsgQ2xvdWRGcm9udCArIFBlcm1pc3Npb24gQVBJ57Wx5ZCI44K544K/44OD44KvXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0gTGFtYmRhIEZ1bmN0aW9uIChDb250YWluZXIpIHdpdGggV2ViIEFkYXB0ZXJcbiAqIC0gTGFtYmRhIEZ1bmN0aW9uIFVSTFxuICogLSBDbG91ZEZyb250IERpc3RyaWJ1dGlvblxuICogLSBFQ1IgUmVwb3NpdG9yeVxuICogLSBJQU0gUm9sZXMgYW5kIFBlcm1pc3Npb25zXG4gKiAtIFBlcm1pc3Npb24gQVBJIExhbWJkYSBGdW5jdGlvblxuICogLSBBUEkgR2F0ZXdheSAoUGVybWlzc2lvbiBBUEnnlKgpXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZWNyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3InO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBiZWRyb2NrIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iZWRyb2NrJztcblxuLy8gUGhhc2UgNzog5Z6L5a6a576p44Gu5Y6z5a+G5YyWIC0gU3RhY2vplpPjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrlcbmltcG9ydCB7IElOZXR3b3JraW5nU3RhY2ssIElTZWN1cml0eVN0YWNrIH0gZnJvbSAnLi9pbnRlcmZhY2VzL3N0YWNrLWludGVyZmFjZXMnO1xuLy8gUGVybWlzc2lvbiBBUEnnkrDlooPoqK3lrppcbmltcG9ydCB7IFBlcm1pc3Npb25BcGlFbnZDb25maWcgfSBmcm9tICcuLi8uLi9jb25maWcvcGVybWlzc2lvbi1hcGktZW52LWNvbmZpZyc7XG4vLyBQaGFzZSAyIC0gVGFzayAzOiDli5XnmoTjg6Ljg4fjg6vpgbjmip5cbmltcG9ydCB7IEJlZHJvY2tBZ2VudER5bmFtaWNDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2FpL2NvbnN0cnVjdHMvYmVkcm9jay1hZ2VudC1keW5hbWljLWNvbnN0cnVjdCc7XG4vLyBQaGFzZSA0OiBBZ2VudENvcmUgQ29uc3RydWN0c+e1seWQiFxuaW1wb3J0IHsgQmVkcm9ja0FnZW50Q29yZVJ1bnRpbWVDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2FpL2NvbnN0cnVjdHMvYmVkcm9jay1hZ2VudC1jb3JlLXJ1bnRpbWUtY29uc3RydWN0JztcbmltcG9ydCB7IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1nYXRld2F5LWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRDb3JlTWVtb3J5Q29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1tZW1vcnktY29uc3RydWN0JztcbmltcG9ydCB7IEJlZHJvY2tBZ2VudENvcmVCcm93c2VyQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1icm93c2VyLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRDb3JlQ29kZUludGVycHJldGVyQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1jb2RlLWludGVycHJldGVyLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBBZ2VudENvcmVDb25maWcgfSBmcm9tICcuLi8uLi8uLi90eXBlcy9hZ2VudGNvcmUtY29uZmlnJztcblxuLyoqXG4gKiDjg4fjg5Xjgqnjg6vjg4joqK3lrppcbiAqL1xuY29uc3QgREVGQVVMVF9XRUJBUFBfQ09ORklHID0ge1xuICBwcm9qZWN0TmFtZTogJ3Blcm1pc3Npb24tYXdhcmUtcmFnJyxcbiAgZW52aXJvbm1lbnQ6ICdwcm9kJyxcbiAgcmVnaW9uUHJlZml4OiAnVG9reW9SZWdpb24nLFxuICBsYW1iZGE6IHtcbiAgICB0aW1lb3V0OiAzMCxcbiAgICBtZW1vcnlTaXplOiA1MTIsXG4gIH0sXG4gIGJlZHJvY2s6IHtcbiAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICB9LFxuICBkb2NrZXJQYXRoOiAnLi9kb2NrZXIvbmV4dGpzJyxcbiAgLy8gaW1hZ2VUYWc6IENES+OCs+ODs+ODhuOCreOCueODiOOBi+OCieWPluW+l++8iC1jIGltYWdlVGFnPXh4eO+8iVxuICAvLyDjg4fjg5Xjgqnjg6vjg4jlgKTjga/oqK3lrprjgZfjgarjgYTvvIjlv4XpoIjjg5Hjg6njg6Hjg7zjgr/jgajjgZfjgabmibHjgYbvvIlcbn07XG5cbi8qKlxuICogV2ViQXBw44K544K/44OD44Kv6Kit5a6a44Kk44Oz44K/44O844OV44Kn44O844K5XG4gKiBFbnZpcm9ubWVudENvbmZpZ+OBqOOBruS6kuaPm+aAp+OCkuS/neOBpOOBn+OCgeOAgeaflOi7n+OBquWei+Wumue+qVxuICovXG5leHBvcnQgaW50ZXJmYWNlIFdlYkFwcFN0YWNrQ29uZmlnIHtcbiAgcmVhZG9ubHkgcHJvamVjdD86IHtcbiAgICBuYW1lPzogc3RyaW5nO1xuICB9O1xuICByZWFkb25seSBuYW1pbmc/OiB7XG4gICAgcHJvamVjdE5hbWU/OiBzdHJpbmc7XG4gICAgZW52aXJvbm1lbnQ/OiBzdHJpbmc7XG4gICAgcmVnaW9uUHJlZml4Pzogc3RyaW5nO1xuICB9O1xuICByZWFkb25seSBlbnZpcm9ubWVudD86IHN0cmluZztcbiAgcmVhZG9ubHkgY29tcHV0ZT86IHtcbiAgICBsYW1iZGE/OiB7XG4gICAgICB0aW1lb3V0PzogbnVtYmVyO1xuICAgICAgbWVtb3J5U2l6ZT86IG51bWJlcjtcbiAgICB9O1xuICB9O1xuICByZWFkb25seSBhaT86IHtcbiAgICBiZWRyb2NrPzoge1xuICAgICAgcmVnaW9uPzogc3RyaW5nO1xuICAgICAgW2tleTogc3RyaW5nXTogYW55OyAvLyBFbnZpcm9ubWVudENvbmZpZ+OBqOOBruS6kuaPm+aAp+OBruOBn+OCgVxuICAgIH07XG4gIH07XG4gIHJlYWRvbmx5IGRhdGFiYXNlPzoge1xuICAgIGR5bmFtb2RiPzoge1xuICAgICAgZW5hYmxlZD86IGJvb2xlYW47XG4gICAgICB0YWJsZUFybnM/OiBzdHJpbmdbXTtcbiAgICB9O1xuICB9O1xuICByZWFkb25seSBwZXJtaXNzaW9uQXBpPzoge1xuICAgIGVuYWJsZWQ/OiBib29sZWFuOyAvLyBQZXJtaXNzaW9uIEFQSeapn+iDveOBruacieWKueWMllxuICAgIG9udGFwTWFuYWdlbWVudExpZj86IHN0cmluZzsgLy8gRlN4IE9OVEFQ566h55CGTElGXG4gICAgc3NtUGFyYW1ldGVyUHJlZml4Pzogc3RyaW5nOyAvLyBTU03jg5Hjg6njg6Hjg7zjgr/jg5fjg6zjg5XjgqPjg4Pjgq/jgrlcbiAgfTtcbiAgcmVhZG9ubHkgYmVkcm9ja0FnZW50Pzoge1xuICAgIGVuYWJsZWQ/OiBib29sZWFuOyAvLyBCZWRyb2NrIEFnZW505qmf6IO944Gu5pyJ5Yq55YyWXG4gICAgLy8gUGhhc2UgMiAtIFRhc2sgMzog5YuV55qE44Oi44OH44Or6YG45oqe6Kit5a6aXG4gICAgdXNlQ2FzZT86ICdjaGF0JyB8ICdnZW5lcmF0aW9uJyB8ICdjb3N0RWZmZWN0aXZlJyB8ICdtdWx0aW1vZGFsJztcbiAgICBtb2RlbFJlcXVpcmVtZW50cz86IHtcbiAgICAgIG9uRGVtYW5kPzogYm9vbGVhbjtcbiAgICAgIHN0cmVhbWluZz86IGJvb2xlYW47XG4gICAgICBjcm9zc1JlZ2lvbj86IGJvb2xlYW47XG4gICAgICBpbnB1dE1vZGFsaXRpZXM/OiBzdHJpbmdbXTtcbiAgICB9O1xuICAgIGVuYWJsZUR5bmFtaWNNb2RlbFNlbGVjdGlvbj86IGJvb2xlYW47XG4gICAgZW5hYmxlQXV0b1VwZGF0ZT86IGJvb2xlYW47XG4gICAgcGFyYW1ldGVyU3RvcmVQcmVmaXg/OiBzdHJpbmc7XG4gICAgLy8g5pei5a2Y44Gu44OX44Ot44OR44OG44KjXG4gICAga25vd2xlZGdlQmFzZUlkPzogc3RyaW5nOyAvLyBLbm93bGVkZ2UgQmFzZSBJRFxuICAgIGRvY3VtZW50U2VhcmNoTGFtYmRhQXJuPzogc3RyaW5nOyAvLyBEb2N1bWVudCBTZWFyY2ggTGFtYmRhIEFSTlxuICB9O1xuICAvLyBQaGFzZSA0OiBBZ2VudENvcmXoqK3lrppcbiAgcmVhZG9ubHkgYWdlbnRDb3JlPzogQWdlbnRDb3JlQ29uZmlnO1xuICBcbiAgLy8gRW52aXJvbm1lbnRDb25maWfjgajjga7kupLmj5vmgKfjga7jgZ/jgoHjgIHov73liqDjg5fjg63jg5Hjg4bjgqPjgpLoqLHlj69cbiAgW2tleTogc3RyaW5nXTogYW55O1xufVxuXG4vKipcbiAqIFdlYkFwcOOCueOCv+ODg+OCr+ODl+ODreODkeODhuOCo1xuICogXG4gKiBQaGFzZSA3OiDlnovlrprnvqnjga7ljrPlr4bljJZcbiAqIC0gYGFueWDlnovjgpLlrozlhajmjpLpmaRcbiAqIC0gSU5ldHdvcmtpbmdTdGFjaywgSVNlY3VyaXR5U3RhY2vlnovjgpLpgannlKhcbiAqIC0g5Z6L5a6J5YWo5oCnMTAwJemBlOaIkFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFdlYkFwcFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIC8vIOioreWumuOCquODluOCuOOCp+OCr+ODiO+8iOWei+WuieWFqO+8iVxuICByZWFkb25seSBjb25maWc6IFdlYkFwcFN0YWNrQ29uZmlnO1xuICBcbiAgLy8g44OX44Ot44K444Kn44Kv44OI5oOF5aCxXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7IC8vIOODl+ODreOCuOOCp+OCr+ODiOWQje+8iOW/hemgiO+8iVxuICByZWFkb25seSBlbnZpcm9ubWVudDogc3RyaW5nOyAvLyDnkrDlooPlkI3vvIjlv4XpoIjvvIlcbiAgXG4gIC8vIOODh+ODl+ODreOCpOODouODvOODieioreWumlxuICByZWFkb25seSBzdGFuZGFsb25lTW9kZT86IGJvb2xlYW47IC8vIOOCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODie+8iOODh+ODleOCqeODq+ODiDogdHJ1Ze+8iVxuICBcbiAgLy8g44K544K/44Oz44OJ44Ki44Ot44O844Oz44Oi44O844OJ55So6Kit5a6aXG4gIHJlYWRvbmx5IGV4aXN0aW5nVnBjSWQ/OiBzdHJpbmc7IC8vIOaXouWtmFZQQyBJRO+8iOOCquODl+OCt+ODp+ODs++8iVxuICByZWFkb25seSBleGlzdGluZ1NlY3VyaXR5R3JvdXBJZD86IHN0cmluZzsgLy8g5pei5a2Y44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OXSUTvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgXG4gIC8vIOe1seWQiOODouODvOODieeUqOioreWumu+8iOWei+WuieWFqO+8iVxuICByZWFkb25seSBuZXR3b3JraW5nU3RhY2s/OiBJTmV0d29ya2luZ1N0YWNrOyAvLyBOZXR3b3JraW5nU3RhY2vlj4LnhafvvIjntbHlkIjjg6Ljg7zjg4nmmYLvvIlcbiAgcmVhZG9ubHkgc2VjdXJpdHlTdGFjaz86IElTZWN1cml0eVN0YWNrOyAvLyBTZWN1cml0eVN0YWNr5Y+C54Wn77yI57Wx5ZCI44Oi44O844OJ5pmC77yJXG4gIFxuICAvLyBFQ1Ljg7tMYW1iZGHoqK3lrppcbiAgcmVhZG9ubHkgc2tpcExhbWJkYUNyZWF0aW9uPzogYm9vbGVhbjsgLy8gTGFtYmRh6Zai5pWw5L2c5oiQ44KS44K544Kt44OD44OX77yIRUNS44Kk44Oh44O844K45pyq5rqW5YKZ5pmC77yJXG4gIHJlYWRvbmx5IGRvY2tlclBhdGg/OiBzdHJpbmc7IC8vIERvY2tlcmZpbGXjga7jg5HjgrnvvIjjg4fjg5Xjgqnjg6vjg4g6ICcuL2RvY2tlci9uZXh0anMn77yJXG4gIHJlYWRvbmx5IGltYWdlVGFnPzogc3RyaW5nOyAvLyDjgqTjg6Hjg7zjgrjjgr/jgrDvvIjjg4fjg5Xjgqnjg6vjg4g6ICdsYXRlc3Qn77yJXG4gIFxuICAvKipcbiAgICog55Kw5aKD5Yil44Oq44K944O844K55L2c5oiQ5Yi25b6h6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbD86IHtcbiAgICByZWFkb25seSBjcmVhdGVMYW1iZGFGdW5jdGlvbj86IGJvb2xlYW47IC8vIExhbWJkYemWouaVsOS9nOaIkOWItuW+oVxuICAgIHJlYWRvbmx5IGNyZWF0ZUNsb3VkRnJvbnREaXN0cmlidXRpb24/OiBib29sZWFuOyAvLyBDbG91ZEZyb2506YWN5L+h5L2c5oiQ5Yi25b6hXG4gICAgcmVhZG9ubHkgZW5hYmxlQmVkcm9ja0FnZW50PzogYm9vbGVhbjsgLy8gQmVkcm9jayBBZ2VudOapn+iDveWItuW+oVxuICAgIHJlYWRvbmx5IGVuYWJsZVBlcm1pc3Npb25BcGk/OiBib29sZWFuOyAvLyBQZXJtaXNzaW9uIEFQSeapn+iDveWItuW+oVxuICAgIHJlYWRvbmx5IGVuYWJsZUFnZW50Q29yZT86IGJvb2xlYW47IC8vIEFnZW50Q29yZeapn+iDveWItuW+oVxuICAgIHJlYWRvbmx5IHZhbGlkYXRlQ29uZmlndXJhdGlvbj86IGJvb2xlYW47IC8vIOioreWumuaknOiovOWItuW+oVxuICB9O1xuICBcbiAgLy8gUGVybWlzc2lvbiBBUEnoqK3lrprvvIhEYXRhU3RhY2vjgYvjgonlj4LnhafvvIlcbiAgcmVhZG9ubHkgdXNlckFjY2Vzc1RhYmxlPzogZHluYW1vZGIuSVRhYmxlOyAvLyDjg6bjg7zjgrbjg7zjgqLjgq/jgrvjgrnjg4bjg7zjg5bjg6tcbiAgcmVhZG9ubHkgcGVybWlzc2lvbkNhY2hlVGFibGU/OiBkeW5hbW9kYi5JVGFibGU7IC8vIOaoqemZkOOCreODo+ODg+OCt+ODpeODhuODvOODluODq1xuICBcbiAgLy8gRGF0YVN0YWNr5Y+C54Wn77yI44OB44Oj44OD44OI5bGl5q2044OG44O844OW44Or55So77yJXG4gIHJlYWRvbmx5IGRhdGFTdGFjaz86IHtcbiAgICBjaGF0SGlzdG9yeVRhYmxlPzogZHluYW1vZGIuSVRhYmxlO1xuICAgIHVzZXJQcmVmZXJlbmNlc1RhYmxlPzogZHluYW1vZGIuSVRhYmxlOyAvLyBUYXNrIDMuMjogQWdlbnRDb3Jl57Wx5ZCI55So44Om44O844K244O86Kit5a6a44OG44O844OW44OrXG4gIH07XG59XG5cbi8qKlxuICogV2ViQXBwU3RhY2sgLSDjg5Xjg6vlrp/oo4XniYhcbiAqL1xuZXhwb3J0IGNsYXNzIFdlYkFwcFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgLyoqIExhbWJkYSBGdW5jdGlvbiAqL1xuICBwdWJsaWMgcmVhZG9ubHkgd2ViQXBwRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgXG4gIC8qKiBMYW1iZGEgRnVuY3Rpb24gVVJMICovXG4gIHB1YmxpYyByZWFkb25seSBmdW5jdGlvblVybDogbGFtYmRhLkZ1bmN0aW9uVXJsO1xuICBcbiAgLyoqIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uICovXG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuICBcbiAgLyoqIEVDUiBSZXBvc2l0b3J5ICovXG4gIHB1YmxpYyByZWFkb25seSBlY3JSZXBvc2l0b3J5OiBlY3IuSVJlcG9zaXRvcnk7XG4gIFxuICAvKiogUGVybWlzc2lvbiBBUEkgTGFtYmRhIEZ1bmN0aW9uICovXG4gIHB1YmxpYyBwZXJtaXNzaW9uQXBpRnVuY3Rpb24/OiBsYW1iZGEuRnVuY3Rpb247XG4gIFxuICAvKiogUGVybWlzc2lvbiBBUEkgR2F0ZXdheSAqL1xuICBwdWJsaWMgcGVybWlzc2lvbkFwaT86IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgXG4gIC8qKiBWUEPvvIjjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4nnlKjvvIkgKi9cbiAgcHJpdmF0ZSB2cGM/OiBlYzIuSVZwYztcbiAgXG4gIC8qKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fvvIjjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4nnlKjvvIkgKi9cbiAgcHJpdmF0ZSBzZWN1cml0eUdyb3VwPzogZWMyLklTZWN1cml0eUdyb3VwO1xuICBcbiAgLyoqIExhbWJkYeWun+ihjOODreODvOODq++8iGFkZFRvUG9saWN544Oh44K944OD44OJ5L2/55So44Gu44Gf44KB5YW36LGh5Z6L77yJICovXG4gIHByaXZhdGUgZXhlY3V0aW9uUm9sZT86IGlhbS5Sb2xlO1xuICBcbiAgLyoqIFBlcm1pc3Npb24gQVBJ5a6f6KGM44Ot44O844OrICovXG4gIHByaXZhdGUgcGVybWlzc2lvbkFwaUV4ZWN1dGlvblJvbGU/OiBpYW0uUm9sZTtcbiAgXG4gIC8qKiBCZWRyb2NrIEFnZW50IFNlcnZpY2UgUm9sZSAqL1xuICBwdWJsaWMgYmVkcm9ja0FnZW50U2VydmljZVJvbGU/OiBpYW0uUm9sZTtcbiAgXG4gIC8qKiBCZWRyb2NrIEFnZW50ICovXG4gIHB1YmxpYyBiZWRyb2NrQWdlbnQ/OiBiZWRyb2NrLkNmbkFnZW50O1xuICBcbiAgLyoqIEJlZHJvY2sgQWdlbnQgQWxpYXMgKi9cbiAgcHVibGljIGJlZHJvY2tBZ2VudEFsaWFzPzogYmVkcm9jay5DZm5BZ2VudEFsaWFzO1xuICBcbiAgLyoqIFdlYkFwcFN0YWNr6Kit5a6a77yIVlBDIEVuZHBvaW505L2c5oiQ5pmC44Gr5Y+C54Wn77yJICovXG4gIHByaXZhdGUgcmVhZG9ubHkgY29uZmlnOiBXZWJBcHBTdGFja0NvbmZpZztcbiAgXG4gIC8qKiBQaGFzZSA0OiBBZ2VudENvcmUgQ29uc3RydWN0c++8iOOCquODl+OCt+ODp+ODs++8iSAqL1xuICBwdWJsaWMgYWdlbnRDb3JlUnVudGltZT86IEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN0O1xuICBwdWJsaWMgYWdlbnRDb3JlR2F0ZXdheT86IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0O1xuICBwdWJsaWMgYWdlbnRDb3JlTWVtb3J5PzogQmVkcm9ja0FnZW50Q29yZU1lbW9yeUNvbnN0cnVjdDtcbiAgcHVibGljIGFnZW50Q29yZUJyb3dzZXI/OiBCZWRyb2NrQWdlbnRDb3JlQnJvd3NlckNvbnN0cnVjdDtcbiAgcHVibGljIGFnZW50Q29yZUNvZGVJbnRlcnByZXRlcj86IEJlZHJvY2tBZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXJDb25zdHJ1Y3Q7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFdlYkFwcFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIOioreWumuOCkuS/neWtmO+8iFZQQyBFbmRwb2ludOS9nOaIkOaZguOBq+WPgueFp++8iVxuICAgIHRoaXMuY29uZmlnID0gcHJvcHMuY29uZmlnO1xuXG4gICAgY29uc3QgeyBcbiAgICAgIGNvbmZpZywgXG4gICAgICBzdGFuZGFsb25lTW9kZSA9IHRydWUsIC8vIOODh+ODleOCqeODq+ODiOOBr+OCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODiVxuICAgICAgZXhpc3RpbmdWcGNJZCxcbiAgICAgIGV4aXN0aW5nU2VjdXJpdHlHcm91cElkLFxuICAgICAgbmV0d29ya2luZ1N0YWNrLFxuICAgICAgc2VjdXJpdHlTdGFjayxcbiAgICAgIHNraXBMYW1iZGFDcmVhdGlvbiA9IGZhbHNlLFxuICAgICAgZG9ja2VyUGF0aCA9IERFRkFVTFRfV0VCQVBQX0NPTkZJRy5kb2NrZXJQYXRoLFxuICAgICAgaW1hZ2VUYWcsIC8vIGltYWdlVGFn44Gv5b+F6aCI44OR44Op44Oh44O844K/77yI44OH44OV44Kp44Or44OI5YCk44Gq44GX77yJXG4gICAgICBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbFxuICAgIH0gPSBwcm9wcztcbiAgICBcbiAgICAvLyDnkrDlooPliKXjg6rjgr3jg7zjgrnliLblvqHjga7oqK3lrprvvIjjg4fjg5Xjgqnjg6vjg4jlgKTvvIlcbiAgICBjb25zdCByZXNvdXJjZUNvbnRyb2wgPSB7XG4gICAgICBjcmVhdGVMYW1iZGFGdW5jdGlvbjogZW52aXJvbm1lbnRSZXNvdXJjZUNvbnRyb2w/LmNyZWF0ZUxhbWJkYUZ1bmN0aW9uID8/IHRydWUsXG4gICAgICBjcmVhdGVDbG91ZEZyb250RGlzdHJpYnV0aW9uOiBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbD8uY3JlYXRlQ2xvdWRGcm9udERpc3RyaWJ1dGlvbiA/PyB0cnVlLFxuICAgICAgZW5hYmxlQmVkcm9ja0FnZW50OiBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbD8uZW5hYmxlQmVkcm9ja0FnZW50ID8/IChjb25maWcuYmVkcm9ja0FnZW50Py5lbmFibGVkID8/IGZhbHNlKSxcbiAgICAgIGVuYWJsZVBlcm1pc3Npb25BcGk6IGVudmlyb25tZW50UmVzb3VyY2VDb250cm9sPy5lbmFibGVQZXJtaXNzaW9uQXBpID8/IChjb25maWcucGVybWlzc2lvbkFwaT8uZW5hYmxlZCA/PyBmYWxzZSksXG4gICAgICBlbmFibGVBZ2VudENvcmU6IGVudmlyb25tZW50UmVzb3VyY2VDb250cm9sPy5lbmFibGVBZ2VudENvcmUgPz8gKGNvbmZpZy5hZ2VudENvcmUgPyB0cnVlIDogZmFsc2UpLFxuICAgICAgdmFsaWRhdGVDb25maWd1cmF0aW9uOiBlbnZpcm9ubWVudFJlc291cmNlQ29udHJvbD8udmFsaWRhdGVDb25maWd1cmF0aW9uID8/IHRydWUsXG4gICAgfTtcbiAgICBcbiAgICAvLyDoqK3lrprmpJzoqLzvvIjnkrDlooPliKXliLblvqHvvIlcbiAgICBpZiAocmVzb3VyY2VDb250cm9sLnZhbGlkYXRlQ29uZmlndXJhdGlvbikge1xuICAgICAgdGhpcy52YWxpZGF0ZUVudmlyb25tZW50Q29uZmlndXJhdGlvbihjb25maWcsIHByb3BzLmVudmlyb25tZW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gaW1hZ2VUYWfjga7mpJzoqLzvvIjlv4XpoIjjg5Hjg6njg6Hjg7zjgr/vvIlcbiAgICBpZiAoIWltYWdlVGFnICYmICFza2lwTGFtYmRhQ3JlYXRpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ+KdjCBpbWFnZVRhZyBpcyByZXF1aXJlZCEgUGxlYXNlIHByb3ZpZGUgaW1hZ2VUYWcgdmlhOlxcbicgK1xuICAgICAgICAnICAgMS4gQ0RLIGNvbnRleHQ6IG5weCBjZGsgZGVwbG95IC1jIGltYWdlVGFnPVlPVVJfVEFHXFxuJyArXG4gICAgICAgICcgICAyLiBQcm9wczogbmV3IFdlYkFwcFN0YWNrKHNjb3BlLCBpZCwgeyBpbWFnZVRhZzogXCJZT1VSX1RBR1wiLCAuLi4gfSlcXG4nICtcbiAgICAgICAgJyAgIDMuIEVudmlyb25tZW50IHZhcmlhYmxlOiBleHBvcnQgSU1BR0VfVEFHPVlPVVJfVEFHJ1xuICAgICAgKTtcbiAgICB9XG4gICAgXG4gICAgLy8g6Kit5a6a5YCk44Gu5Y+W5b6X77yI44OH44OV44Kp44Or44OI5YCk44KS5L2/55So77yJXG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb25maWcubmFtaW5nPy5wcm9qZWN0TmFtZSB8fCBERUZBVUxUX1dFQkFQUF9DT05GSUcucHJvamVjdE5hbWU7XG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSBjb25maWcubmFtaW5nPy5lbnZpcm9ubWVudCB8fCBERUZBVUxUX1dFQkFQUF9DT05GSUcuZW52aXJvbm1lbnQ7XG4gICAgY29uc3QgcmVnaW9uUHJlZml4ID0gY29uZmlnLm5hbWluZz8ucmVnaW9uUHJlZml4IHx8IERFRkFVTFRfV0VCQVBQX0NPTkZJRy5yZWdpb25QcmVmaXg7XG5cbiAgICBjb25zb2xlLmxvZygn8J+agCBXZWJBcHBTdGFjayAoRnVsbCkg5Yid5pyf5YyW6ZaL5aeLLi4uJyk7XG4gICAgY29uc29sZS5sb2coYCAgIOODl+ODreOCuOOCp+OCr+ODiOWQjTogJHtwcm9qZWN0TmFtZX1gKTtcbiAgICBjb25zb2xlLmxvZyhgICAg55Kw5aKDOiAke2Vudmlyb25tZW50fWApO1xuICAgIGNvbnNvbGUubG9nKGAgICDjg6rjg7zjgrjjg6fjg7Pjg5fjg6zjg5XjgqPjg4Pjgq/jgrk6ICR7cmVnaW9uUHJlZml4fWApO1xuICAgIGNvbnNvbGUubG9nKGAgICDjg4fjg5fjg63jgqTjg6Ljg7zjg4k6ICR7c3RhbmRhbG9uZU1vZGUgPyAn44K544K/44Oz44OJ44Ki44Ot44O844OzJyA6ICfntbHlkIgnfWApO1xuICAgIGNvbnNvbGUubG9nKGAgICBEb2NrZXLjg5Hjgrk6ICR7ZG9ja2VyUGF0aH1gKTtcbiAgICBjb25zb2xlLmxvZyhgICAg44Kk44Oh44O844K444K/44KwOiAke2ltYWdlVGFnIHx8ICdOL0EgKExhbWJkYeS9nOaIkOOCueOCreODg+ODlyknfWApO1xuICAgIGlmIChza2lwTGFtYmRhQ3JlYXRpb24pIHtcbiAgICAgIGNvbnNvbGUubG9nKCcgICDimqDvuI8gIExhbWJkYemWouaVsOS9nOaIkOOCkuOCueOCreODg+ODl++8iEVDUuOCpOODoeODvOOCuOacqua6luWCme+8iScpO1xuICAgIH1cbiAgICBpZiAoc3RhbmRhbG9uZU1vZGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCcgICDwn5OmIOOCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODiTog5LuW44GuU3RhY2vjgavkvp3lrZjjgZfjgb7jgZvjgpMnKTtcbiAgICAgIGlmIChleGlzdGluZ1ZwY0lkKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgICDwn5SXIOaXouWtmFZQQ+WPgueFpzogJHtleGlzdGluZ1ZwY0lkfWApO1xuICAgICAgfVxuICAgICAgaWYgKGV4aXN0aW5nU2VjdXJpdHlHcm91cElkKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgICDwn5SXIOaXouWtmOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+WPgueFpzogJHtleGlzdGluZ1NlY3VyaXR5R3JvdXBJZH1gKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJyAgIPCflJcg57Wx5ZCI44Oi44O844OJOiDku5bjga5TdGFja+OBqOmAo+aQuuOBl+OBvuOBmScpO1xuICAgIH1cblxuICAgIC8vIOODouODvOODieWIpOWumuOBqOODquOCveODvOOCueOCu+ODg+ODiOOCouODg+ODl1xuICAgIGlmIChzdGFuZGFsb25lTW9kZSkge1xuICAgICAgdGhpcy5zZXR1cFN0YW5kYWxvbmVSZXNvdXJjZXMoZXhpc3RpbmdWcGNJZCwgZXhpc3RpbmdTZWN1cml0eUdyb3VwSWQsIHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCwgcmVnaW9uUHJlZml4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZXR1cEludGVncmF0ZWRSZXNvdXJjZXMobmV0d29ya2luZ1N0YWNrLCBzZWN1cml0eVN0YWNrKTtcbiAgICB9XG5cbiAgICAvLyBFQ1Ljg6rjg53jgrjjg4jjg6rjga7lj4LnhafvvIjml6LlrZjjg6rjg53jgrjjg4jjg6rjgpLkvb/nlKjvvIlcbiAgICAvLyDms6jmhI86IGZyb21SZXBvc2l0b3J5TmFtZSgp44GvQ0RL5ZCI5oiQ5pmC44Gr5L6L5aSW44KS5oqV44GS44Gq44GE44Gf44KB44CBdHJ5LWNhdGNo44Gv5LiN6KaBXG4gICAgLy8g44Oq44Od44K444OI44Oq44GM5a2Y5Zyo44GX44Gq44GE5aC05ZCI44Gv44CB44OH44OX44Ot44Kk5pmC44Gr44Ko44Op44O844Gr44Gq44KLXG4gICAgY29uc3QgcmVwb3NpdG9yeU5hbWUgPSBgJHtyZWdpb25QcmVmaXgudG9Mb3dlckNhc2UoKX0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0td2ViYXBwLXJlcG9gO1xuICAgIFxuICAgIHRoaXMuZWNyUmVwb3NpdG9yeSA9IGVjci5SZXBvc2l0b3J5LmZyb21SZXBvc2l0b3J5TmFtZShcbiAgICAgIHRoaXMsXG4gICAgICAnV2ViQXBwUmVwb3NpdG9yeScsXG4gICAgICByZXBvc2l0b3J5TmFtZVxuICAgICk7XG4gICAgY29uc29sZS5sb2coYOKchSDml6LlrZhFQ1Ljg6rjg53jgrjjg4jjg6rjgpLlj4Lnhac6ICR7cmVwb3NpdG9yeU5hbWV9YCk7XG5cbiAgICAvLyBEeW5hbW9EQiBhY2Nlc3MgKGlmIG5lZWRlZCkgLSDjgrnjgr/jg7Pjg4njgqLjg63jg7zjg7Pjg6Ljg7zjg4njgafjgoLov73liqDlj6/og71cbiAgICBpZiAoIXNraXBMYW1iZGFDcmVhdGlvbiAmJiB0aGlzLmV4ZWN1dGlvblJvbGUgJiYgY29uZmlnLmRhdGFiYXNlPy5keW5hbW9kYj8uZW5hYmxlZCkge1xuICAgICAgY29uc3QgZHluYW1vZGJSZXNvdXJjZXMgPSBjb25maWcuZGF0YWJhc2UuZHluYW1vZGIudGFibGVBcm5zIHx8IFsnKiddO1xuICAgICAgdGhpcy5leGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2R5bmFtb2RiOkdldEl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpQdXRJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6VXBkYXRlSXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOkRlbGV0ZUl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpRdWVyeScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlNjYW4nLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IGR5bmFtb2RiUmVzb3VyY2VzLFxuICAgICAgfSkpO1xuICAgICAgXG4gICAgICBpZiAoZHluYW1vZGJSZXNvdXJjZXNbMF0gPT09ICcqJykge1xuICAgICAgICBjb25zb2xlLmxvZygn4pqg77iPICBEeW5hbW9EQuOCouOCr+OCu+OCuTog5YWo44OG44O844OW44Or77yI5pys55Wq55Kw5aKD44Gn44Gv54m55a6a44Gu44OG44O844OW44OrQVJO44KS5oyH5a6a44GX44Gm44GP44Gg44GV44GE77yJJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhg4pyFIER5bmFtb0RC44Ki44Kv44K744K5OiAke2R5bmFtb2RiUmVzb3VyY2VzLmxlbmd0aH3lgIvjga7jg4bjg7zjg5bjg6vjgavliLbpmZBgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDmqZ/og73lvqnml6fnlKhEeW5hbW9EQuODhuODvOODluODq+OBuOOBruOCouOCr+OCu+OCueaoqemZkO+8iFBoYXNlIDHlrozkuobmuIjjgb/mqZ/og73vvIlcbiAgICBpZiAoIXNraXBMYW1iZGFDcmVhdGlvbiAmJiB0aGlzLmV4ZWN1dGlvblJvbGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5SQIOapn+iDveW+qeaXp+eUqER5bmFtb0RC44OG44O844OW44Or44Ki44Kv44K744K55qip6ZmQ44KS6L+95Yqg5LitLi4uJyk7XG4gICAgICBcbiAgICAgIC8vIOOCu+ODg+OCt+ODp+ODs+euoeeQhuOAgeODpuODvOOCtuODvOioreWumuOAgeODgeODo+ODg+ODiOWxpeattOOAgeWLleeahOioreWumuOCreODo+ODg+OCt+ODpeODhuODvOODluODq+OBuOOBruOCouOCr+OCu+OCuVxuICAgICAgY29uc3QgZmVhdHVyZVJlc3RvcmF0aW9uVGFibGVzID0gW1xuICAgICAgICBgYXJuOmF3czpkeW5hbW9kYjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dGFibGUvcGVybWlzc2lvbi1hd2FyZS1yYWctc2Vzc2lvbnNgLFxuICAgICAgICBgYXJuOmF3czpkeW5hbW9kYjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dGFibGUvcGVybWlzc2lvbi1hd2FyZS1yYWctc2Vzc2lvbnMvaW5kZXgvKmAsXG4gICAgICAgIGBhcm46YXdzOmR5bmFtb2RiOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0YWJsZS9wZXJtaXNzaW9uLWF3YXJlLXJhZy11c2VyLXByZWZlcmVuY2VzYCxcbiAgICAgICAgYGFybjphd3M6ZHluYW1vZGI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRhYmxlL3Blcm1pc3Npb24tYXdhcmUtcmFnLXVzZXItcHJlZmVyZW5jZXMvaW5kZXgvKmAsXG4gICAgICAgIGBhcm46YXdzOmR5bmFtb2RiOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0YWJsZS9wZXJtaXNzaW9uLWF3YXJlLXJhZy1jaGF0LWhpc3RvcnlgLFxuICAgICAgICBgYXJuOmF3czpkeW5hbW9kYjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dGFibGUvcGVybWlzc2lvbi1hd2FyZS1yYWctY2hhdC1oaXN0b3J5L2luZGV4LypgLFxuICAgICAgICBgYXJuOmF3czpkeW5hbW9kYjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dGFibGUvcGVybWlzc2lvbi1hd2FyZS1yYWctZGlzY292ZXJ5LWNhY2hlYCxcbiAgICAgICAgYGFybjphd3M6ZHluYW1vZGI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRhYmxlL3Blcm1pc3Npb24tYXdhcmUtcmFnLWRpc2NvdmVyeS1jYWNoZS9pbmRleC8qYCxcbiAgICAgIF07XG5cbiAgICAgIHRoaXMuZXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6UHV0SXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlVwZGF0ZUl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpEZWxldGVJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6UXVlcnknLFxuICAgICAgICAgICdkeW5hbW9kYjpTY2FuJyxcbiAgICAgICAgICAnZHluYW1vZGI6QmF0Y2hHZXRJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6QmF0Y2hXcml0ZUl0ZW0nLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IGZlYXR1cmVSZXN0b3JhdGlvblRhYmxlcyxcbiAgICAgIH0pKTtcblxuICAgICAgY29uc29sZS5sb2coJ+KchSDmqZ/og73lvqnml6fnlKhEeW5hbW9EQuODhuODvOODluODq+OCouOCr+OCu+OCueaoqemZkOi/veWKoOWujOS6hicpO1xuICAgICAgY29uc29sZS5sb2coYCAgIC0g44K744OD44K344On44Oz566h55CG44OG44O844OW44OrOiBwZXJtaXNzaW9uLWF3YXJlLXJhZy1zZXNzaW9uc2ApO1xuICAgICAgY29uc29sZS5sb2coYCAgIC0g44Om44O844K244O86Kit5a6a44OG44O844OW44OrOiBwZXJtaXNzaW9uLWF3YXJlLXJhZy11c2VyLXByZWZlcmVuY2VzYCk7XG4gICAgICBjb25zb2xlLmxvZyhgICAgLSDjg4Hjg6Pjg4Pjg4jlsaXmrbTjg4bjg7zjg5bjg6s6IHBlcm1pc3Npb24tYXdhcmUtcmFnLWNoYXQtaGlzdG9yeWApO1xuICAgICAgY29uc29sZS5sb2coYCAgIC0g5YuV55qE6Kit5a6a44Kt44Oj44OD44K344Ol44OG44O844OW44OrOiBwZXJtaXNzaW9uLWF3YXJlLXJhZy1kaXNjb3ZlcnktY2FjaGVgKTtcbiAgICB9XG5cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb27vvIjmnaHku7bku5jjgY3kvZzmiJAgLSDnkrDlooPliKXliLblvqHlr77lv5zvvIlcbiAgICBjb25zdCBzaG91bGRDcmVhdGVMYW1iZGEgPSAhc2tpcExhbWJkYUNyZWF0aW9uICYmIHJlc291cmNlQ29udHJvbC5jcmVhdGVMYW1iZGFGdW5jdGlvbiAmJiB0aGlzLmV4ZWN1dGlvblJvbGU7XG4gICAgaWYgKHNob3VsZENyZWF0ZUxhbWJkYSkge1xuICAgICAgLy8gTGFtYmRhIFZQQ+mFjee9ruioreWumuOCkueiuuiqjVxuICAgICAgY29uc3QgbGFtYmRhVnBjQ29uZmlnID0gKHRoaXMuY29uZmlnIGFzIGFueSk/LndlYmFwcD8ubGFtYmRhPy52cGM7XG4gICAgICBjb25zdCBzaG91bGRQbGFjZUluVnBjID0gbGFtYmRhVnBjQ29uZmlnPy5lbmFibGVkID09PSB0cnVlO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhg8J+UjSBMYW1iZGEgVlBD6Kit5a6a44OB44Kn44OD44KvOmApO1xuICAgICAgY29uc29sZS5sb2coYCAgIC0gc3RhbmRhbG9uZU1vZGU6ICR7c3RhbmRhbG9uZU1vZGV9YCk7XG4gICAgICBjb25zb2xlLmxvZyhgICAgLSBsYW1iZGEudnBjLmVuYWJsZWQ6ICR7c2hvdWxkUGxhY2VJblZwY31gKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAtIHZwYzogJHshIXRoaXMudnBjfWApO1xuICAgICAgY29uc29sZS5sb2coYCAgIC0gc2VjdXJpdHlHcm91cDogJHshIXRoaXMuc2VjdXJpdHlHcm91cH1gKTtcbiAgICAgIFxuICAgICAgLy8gVlBD6Kit5a6a44KS5qeL56+JXG4gICAgICBjb25zdCB2cGNDb25maWcgPSBzaG91bGRQbGFjZUluVnBjICYmIHRoaXMudnBjICYmIHRoaXMuc2VjdXJpdHlHcm91cCA/IHtcbiAgICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgICAgc2VjdXJpdHlHcm91cHM6IFt0aGlzLnNlY3VyaXR5R3JvdXBdLFxuICAgICAgICB2cGNTdWJuZXRzOiB7XG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgfSxcbiAgICAgIH0gOiB7fTtcbiAgICAgIFxuICAgICAgaWYgKHNob3VsZFBsYWNlSW5WcGMgJiYgT2JqZWN0LmtleXModnBjQ29uZmlnKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc29sZS53YXJuKCfimqDvuI8gIExhbWJkYSBWUEPphY3nva7jgYzmnInlirnjgafjgZnjgYzjgIFWUEPjgb7jgZ/jga/jgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjgYzopovjgaTjgYvjgorjgb7jgZvjgpMnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYPCflI0gdnBjQ29uZmln6Kit5a6aOiAke09iamVjdC5rZXlzKHZwY0NvbmZpZykubGVuZ3RoID4gMCA/ICdWUEPlhoXjgavphY3nva4nIDogJ1ZQQ+WkluOBq+mFjee9rid9YCk7XG5cbiAgICAgIHRoaXMud2ViQXBwRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdXZWJBcHBGdW5jdGlvbicsIHtcbiAgICAgICAgZnVuY3Rpb25OYW1lOiBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVdlYkFwcC1GdW5jdGlvbmAsXG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLkZST01fSU1BR0UsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21FY3JJbWFnZSh0aGlzLmVjclJlcG9zaXRvcnksIHtcbiAgICAgICAgICB0YWdPckRpZ2VzdDogaW1hZ2VUYWcsXG4gICAgICAgIH0pLFxuICAgICAgICBoYW5kbGVyOiBsYW1iZGEuSGFuZGxlci5GUk9NX0lNQUdFLFxuICAgICAgICByb2xlOiB0aGlzLmV4ZWN1dGlvblJvbGUsXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy5jb21wdXRlPy5sYW1iZGE/LnRpbWVvdXQgfHwgMzApLFxuICAgICAgICBtZW1vcnlTaXplOiBjb25maWcuY29tcHV0ZT8ubGFtYmRhPy5tZW1vcnlTaXplIHx8IDUxMixcbiAgICAgICAgLi4udnBjQ29uZmlnLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIE5PREVfRU5WOiAncHJvZHVjdGlvbicsXG4gICAgICAgICAgQkVEUk9DS19SRUdJT046IGNvbmZpZy5haT8uYmVkcm9jaz8ucmVnaW9uIHx8ICd1cy1lYXN0LTEnLFxuICAgICAgICAgIEFXU19MV0FfSU5WT0tFX01PREU6ICdyZXNwb25zZV9zdHJlYW0nLFxuICAgICAgICAgIEFXU19MV0FfUE9SVDogJzMwMDAnLFxuICAgICAgICAgIFJVU1RfTE9HOiAnaW5mbycsXG4gICAgICAgICAgXG4gICAgICAgICAgLy8g5qmf6IO95b6p5pen55SoRHluYW1vRELjg4bjg7zjg5bjg6vvvIhQaGFzZSAx5a6M5LqG5riI44G/77yJXG4gICAgICAgICAgU0VTU0lPTl9UQUJMRV9OQU1FOiAncGVybWlzc2lvbi1hd2FyZS1yYWctc2Vzc2lvbnMnLCAvLyDjgrvjg4Pjgrfjg6fjg7PnrqHnkIbjg4bjg7zjg5bjg6tcbiAgICAgICAgICBQUkVGRVJFTkNFU19UQUJMRV9OQU1FOiBwcm9wcy5kYXRhU3RhY2s/LnVzZXJQcmVmZXJlbmNlc1RhYmxlPy50YWJsZU5hbWUgfHwgJ3Blcm1pc3Npb24tYXdhcmUtcmFnLXByZWZlcmVuY2VzJywgLy8g44Om44O844K244O86Kit5a6a44OG44O844OW44Or77yIVGFzayAzLjLvvIlcbiAgICAgICAgICBDSEFUX0hJU1RPUllfVEFCTEVfTkFNRTogcHJvcHMuZGF0YVN0YWNrPy5jaGF0SGlzdG9yeVRhYmxlPy50YWJsZU5hbWUgfHwgJ3Blcm1pc3Npb24tYXdhcmUtcmFnLWNoYXQtaGlzdG9yeScsXG4gICAgICAgICAgRElTQ09WRVJZX0NBQ0hFX1RBQkxFX05BTUU6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZy1kaXNjb3ZlcnktY2FjaGUnLCAvLyDli5XnmoToqK3lrprjgq3jg6Pjg4Pjgrfjg6Xjg4bjg7zjg5bjg6tcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBKV1Toqo3oqLzoqK3lrprvvIhQaGFzZSAx5a6M5LqG5riI44G/77yJXG4gICAgICAgICAgSldUX1NFQ1JFVDogJ3lvdXItc3VwZXItc2VjcmV0LWp3dC1rZXktY2hhbmdlLWluLXByb2R1Y3Rpb24tMjAyNCcsXG4gICAgICAgICAgSldUX0VYUElSRVNfSU46ICc3ZCcsXG4gICAgICAgICAgXG4gICAgICAgICAgLy8gQmVkcm9jayBBZ2VudOaDheWgse+8iOaXouWtmO+8iVxuICAgICAgICAgIEJFRFJPQ0tfQUdFTlRfSUQ6IHRoaXMuYmVkcm9ja0FnZW50Py5hdHRyQWdlbnRJZCB8fCAnMU5XUUpUSU1BSCcsXG4gICAgICAgICAgQkVEUk9DS19BR0VOVF9BTElBU19JRDogdGhpcy5iZWRyb2NrQWdlbnRBbGlhcz8uYXR0ckFnZW50QWxpYXNJZCB8fCAnVFNUQUxJQVNJRCcsXG4gICAgICAgICAgXG4gICAgICAgICAgLy8gUGVybWlzc2lvbiBBUEnnlKhEeW5hbW9EQuODhuODvOODluODq++8iOaXouWtmO+8iVxuICAgICAgICAgIERZTkFNT0RCX1RBQkxFX05BTUU6IHByb3BzLnVzZXJBY2Nlc3NUYWJsZT8udGFibGVOYW1lIHx8ICcnLFxuICAgICAgICAgIFBFUk1JU1NJT05fQ0FDSEVfVEFCTEVfTkFNRTogcHJvcHMucGVybWlzc2lvbkNhY2hlVGFibGU/LnRhYmxlTmFtZSB8fCAnJyxcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDlpJroqIDoqp7lr77lv5zoqK3lrprvvIhQaGFzZSAy5rqW5YKZ77yJXG4gICAgICAgICAgREVGQVVMVF9MT0NBTEU6ICdqYScsXG4gICAgICAgICAgU1VQUE9SVEVEX0xPQ0FMRVM6ICdqYSxlbixrbyx6aC1DTix6aC1UVyxlcyxmcixkZScsXG4gICAgICAgICAgXG4gICAgICAgICAgLy8g5YuV55qE44Oi44OH44Or5qSc5Ye66Kit5a6a77yIUGhhc2UgMua6luWCme+8iVxuICAgICAgICAgIE1PREVMX0RJU0NPVkVSWV9FTkFCTEVEOiAndHJ1ZScsXG4gICAgICAgICAgTU9ERUxfQ0FDSEVfVFRMOiAnMzYwMCcsIC8vIDHmmYLplpNcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnoqK3lrprvvIhQaGFzZSA15rqW5YKZ77yJXG4gICAgICAgICAgRU5BQkxFX0NBQ0hJTkc6ICd0cnVlJyxcbiAgICAgICAgICBDQUNIRV9UVEw6ICczMDAnLCAvLyA15YiGXG4gICAgICAgICAgXG4gICAgICAgICAgLy8g44K744Kt44Ol44Oq44OG44Kj6Kit5a6a77yIUGhhc2UgMeWujOS6hua4iOOBv++8iVxuICAgICAgICAgIEVOQUJMRV9DU1JGX1BST1RFQ1RJT046ICd0cnVlJyxcbiAgICAgICAgICBTRUNVUkVfQ09PS0lFUzogJ3RydWUnLFxuICAgICAgICAgIFxuICAgICAgICAgIC8vIOODreOCsOODrOODmeODq+ioreWumlxuICAgICAgICAgIExPR19MRVZFTDogJ2luZm8nLFxuICAgICAgICB9LFxuICAgICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygn4pyFIExhbWJkYemWouaVsOS9nOaIkOWujOS6hicpO1xuXG4gICAgICAvLyBMYW1iZGEgRnVuY3Rpb24gVVJMXG4gICAgICB0aGlzLmZ1bmN0aW9uVXJsID0gdGhpcy53ZWJBcHBGdW5jdGlvbi5hZGRGdW5jdGlvblVybCh7XG4gICAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgICBjb3JzOiB7XG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgICAgfSxcbiAgICAgICAgaW52b2tlTW9kZTogbGFtYmRhLkludm9rZU1vZGUuUkVTUE9OU0VfU1RSRUFNLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9u77yI55Kw5aKD5Yil5Yi25b6h5a++5b+c77yJXG4gICAgICBpZiAocmVzb3VyY2VDb250cm9sLmNyZWF0ZUNsb3VkRnJvbnREaXN0cmlidXRpb24pIHtcbiAgICAgICAgLy8g5rOo5oSPOiBMYW1iZGEgRnVuY3Rpb24gVVJM44KST3JpZ2lu44Go44GX44Gm5L2/55So44GZ44KL5aC05ZCI44CBXG4gICAgICAgIC8vIEFMTF9WSUVXRVJfRVhDRVBUX0hPU1RfSEVBREVS44KS5L2/55So44GZ44KL5b+F6KaB44GM44GC44KK44G+44GZ44CCXG4gICAgICAgIC8vIEFMTF9WSUVXRVLjgpLkvb/nlKjjgZnjgovjgajjgIFDbG91ZEZyb25044GuSG9zdOODmOODg+ODgOODvOOBjExhbWJkYeOBq+i7oumAgeOBleOCjOOAgVxuICAgICAgICAvLyBMYW1iZGEgRnVuY3Rpb24gVVJM44GM44Ob44K544OI5ZCN44KS6KqN6K2Y44Gn44GN44GaNDAz44Ko44Op44O844GM55m655Sf44GX44G+44GZ44CCXG4gICAgICAgIHRoaXMuZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdXZWJBcHBEaXN0cmlidXRpb24nLCB7XG4gICAgICAgICAgY29tbWVudDogYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1XZWJBcHAtRGlzdHJpYnV0aW9uYCxcbiAgICAgICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuSHR0cE9yaWdpbihjZGsuRm4uc2VsZWN0KDIsIGNkay5Gbi5zcGxpdCgnLycsIHRoaXMuZnVuY3Rpb25VcmwudXJsKSkpLFxuICAgICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgICBjYWNoZWRNZXRob2RzOiBjbG91ZGZyb250LkNhY2hlZE1ldGhvZHMuQ0FDSEVfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgICAgIGNvbXByZXNzOiB0cnVlLFxuICAgICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICAgIG9yaWdpblJlcXVlc3RQb2xpY3k6IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeS5BTExfVklFV0VSX0VYQ0VQVF9IT1NUX0hFQURFUixcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByaWNlQ2xhc3M6IGNsb3VkZnJvbnQuUHJpY2VDbGFzcy5QUklDRV9DTEFTU18yMDAsXG4gICAgICAgICAgZW5hYmxlTG9nZ2luZzogZmFsc2UsXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zb2xlLmxvZygn4pyFIENsb3VkRnJvbnTphY3kv6HkvZzmiJDlrozkuoYnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCfimqDvuI8gIENsb3VkRnJvbnTphY3kv6HkvZzmiJDjgpLjgrnjgq3jg4Pjg5fvvIjnkrDlooPliKXliLblvqHvvIknKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gRHluYW1vRELjgqLjgq/jgrvjgrnmqKnpmZDjga7ku5jkuI5cbiAgICAgIGlmIChwcm9wcy5kYXRhU3RhY2s/LmNoYXRIaXN0b3J5VGFibGUpIHtcbiAgICAgICAgcHJvcHMuZGF0YVN0YWNrLmNoYXRIaXN0b3J5VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMud2ViQXBwRnVuY3Rpb24pO1xuICAgICAgICBjb25zb2xlLmxvZygn4pyFIENoYXRIaXN0b3J5VGFibGXjgbjjga7jgqLjgq/jgrvjgrnmqKnpmZDku5jkuI7lrozkuoYnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gVXNlclByZWZlcmVuY2Vz44OG44O844OW44Or44G444Gu44Ki44Kv44K744K55qip6ZmQ5LuY5LiO77yIVGFzayAzLjLvvIlcbiAgICAgIGlmIChwcm9wcy5kYXRhU3RhY2s/LnVzZXJQcmVmZXJlbmNlc1RhYmxlKSB7XG4gICAgICAgIHByb3BzLmRhdGFTdGFjay51c2VyUHJlZmVyZW5jZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy53ZWJBcHBGdW5jdGlvbik7XG4gICAgICAgIGNvbnNvbGUubG9nKCfinIUgVXNlclByZWZlcmVuY2VzVGFibGXjgbjjga7jgqLjgq/jgrvjgrnmqKnpmZDku5jkuI7lrozkuoYnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coJ+KchSBMYW1iZGHplqLmlbDjg7tDbG91ZEZyb2505L2c5oiQ5a6M5LqGJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCfimqDvuI8gIExhbWJkYemWouaVsOODu0Nsb3VkRnJvbnTkvZzmiJDjgpLjgrnjgq3jg4Pjg5cnKTtcbiAgICAgIGNvbnNvbGUubG9nKCcgICDmrKHjga7jgrnjg4bjg4Pjg5c6Jyk7XG4gICAgICBjb25zb2xlLmxvZygnICAgMS4gRUNS44GrTmV4dC5qc+OCpOODoeODvOOCuOOCkuODl+ODg+OCt+ODpScpO1xuICAgICAgY29uc29sZS5sb2coJyAgIDIuIHNraXBMYW1iZGFDcmVhdGlvbj1mYWxzZeOBp+WGjeODh+ODl+ODreOCpCcpO1xuICAgIH1cblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyDlh7rlipvlgKTjga7lrprnvqnvvIhVUy0yLjHopoHku7bvvIlcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgXG4gICAgLy8gMS4gRUNS44Oq44Od44K444OI44OqVVJJ77yI5b+F6aCI77yJXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0VDUlJlcG9zaXRvcnlVcmknLCB7XG4gICAgICB2YWx1ZTogdGhpcy5lY3JSZXBvc2l0b3J5LnJlcG9zaXRvcnlVcmksXG4gICAgICBkZXNjcmlwdGlvbjogJ0VDUiBSZXBvc2l0b3J5IFVSSSAtIOOCs+ODs+ODhuODiuOCpOODoeODvOOCuOOBruODl+ODg+OCt+ODpeWFiCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRUNSUmVwb3NpdG9yeVVyaWAsXG4gICAgfSk7XG4gICAgXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0VDUlJlcG9zaXRvcnlOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuZWNyUmVwb3NpdG9yeS5yZXBvc2l0b3J5TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRUNSIFJlcG9zaXRvcnkgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRUNSUmVwb3NpdG9yeU5hbWVgLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIDIuIEFQSSBHYXRld2F5IFVSTO+8iExhbWJkYSBGdW5jdGlvbiBVUkzjgafku6Pmm7/vvIlcbiAgICAvLyDms6g6IOePvuWcqOOBruWun+ijheOBp+OBr0xhbWJkYSBGdW5jdGlvbiBVUkzjgpLkvb/nlKhcbiAgICAvLyDlsIbmnaXnmoTjgatBUEkgR2F0ZXdheeOBq+enu+ihjOOBmeOCi+WgtOWQiOOBr+OAgeOBk+OBruOCu+OCr+OCt+ODp+ODs+OCkuabtOaWsFxuICAgIGlmICghc2tpcExhbWJkYUNyZWF0aW9uICYmIHRoaXMuZnVuY3Rpb25VcmwpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlVcmwnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmZ1bmN0aW9uVXJsLnVybCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBUEkgVVJMIChMYW1iZGEgRnVuY3Rpb24gVVJMKSAtIOODkOODg+OCr+OCqOODs+ODiUFQSeOCqOODs+ODieODneOCpOODs+ODiCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BcGlVcmxgLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGdW5jdGlvblVybCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZnVuY3Rpb25VcmwudXJsLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBGdW5jdGlvbiBVUkwgLSDnm7TmjqXjgqLjgq/jgrvjgrnnlKgnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRnVuY3Rpb25VcmxgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gMy4gQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gVVJM77yI5b+F6aCI77yJXG4gICAgaWYgKCFza2lwTGFtYmRhQ3JlYXRpb24gJiYgdGhpcy5kaXN0cmlidXRpb24pIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250VXJsJywge1xuICAgICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBEaXN0cmlidXRpb24gVVJMIC0g44OV44Ot44Oz44OI44Ko44Oz44OJ44Ki44Kv44K744K555So77yI5o6o5aWo77yJJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUNsb3VkRnJvbnRVcmxgLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250RGlzdHJpYnV0aW9uSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBJRCAtIOOCreODo+ODg+OCt+ODpeeEoeWKueWMlueUqCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1DbG91ZEZyb250RGlzdHJpYnV0aW9uSWRgLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250RG9tYWluTmFtZScsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBEb21haW4gTmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1DbG91ZEZyb250RG9tYWluTmFtZWAsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gNC4gTGFtYmRh6Zai5pWw5oOF5aCx77yI44OH44OQ44OD44Kw44O755uj6KaW55So77yJXG4gICAgaWYgKCFza2lwTGFtYmRhQ3JlYXRpb24gJiYgdGhpcy53ZWJBcHBGdW5jdGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0xhbWJkYUZ1bmN0aW9uTmFtZScsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMud2ViQXBwRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBGdW5jdGlvbiBOYW1lIC0gQ2xvdWRXYXRjaCBMb2dz56K66KqN55SoJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUxhbWJkYUZ1bmN0aW9uTmFtZWAsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0xhbWJkYUZ1bmN0aW9uQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy53ZWJBcHBGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUxhbWJkYUZ1bmN0aW9uQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyA1LiDjg4fjg5fjg63jgqTjg6Ljg7zjg4nmg4XloLFcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGVwbG95TW9kZScsIHtcbiAgICAgIHZhbHVlOiBzdGFuZGFsb25lTW9kZSA/ICdzdGFuZGFsb25lJyA6ICdpbnRlZ3JhdGVkJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAn44OH44OX44Ot44Kk44Oi44O844OJIC0g44K544K/44Oz44OJ44Ki44Ot44O844OzIG9yIOe1seWQiCcsXG4gICAgfSk7XG4gICAgXG4gICAgLy8gNi4g44K544K/44OD44Kv5oOF5aCxXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N0YWNrTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnN0YWNrTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGb3JtYXRpb24gU3RhY2sgTmFtZScsXG4gICAgfSk7XG4gICAgXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1JlZ2lvbicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJlZ2lvbixcbiAgICAgIGRlc2NyaXB0aW9uOiAn44OH44OX44Ot44Kk44Oq44O844K444On44OzJyxcbiAgICB9KTtcbiAgICBcbiAgICBjb25zb2xlLmxvZygnJyk7XG4gICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICBjb25zb2xlLmxvZygn8J+TiyDlh7rlipvlgKTjgrXjg57jg6rjg7wnKTtcbiAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgIGNvbnNvbGUubG9nKGDinIUgRUNS44Oq44Od44K444OI44OqVVJJOiAke3RoaXMuZWNyUmVwb3NpdG9yeS5yZXBvc2l0b3J5VXJpfWApO1xuICAgIGlmICghc2tpcExhbWJkYUNyZWF0aW9uICYmIHRoaXMuZnVuY3Rpb25VcmwpIHtcbiAgICAgIGNvbnNvbGUubG9nKGDinIUgQVBJIFVSTDogJHt0aGlzLmZ1bmN0aW9uVXJsLnVybH1gKTtcbiAgICB9XG4gICAgaWYgKCFza2lwTGFtYmRhQ3JlYXRpb24gJiYgdGhpcy5kaXN0cmlidXRpb24pIHtcbiAgICAgIGNvbnNvbGUubG9nKGDinIUgQ2xvdWRGcm9udCBVUkw6IGh0dHBzOi8vJHt0aGlzLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWApO1xuICAgIH1cbiAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuXG4gICAgLy8gUGVybWlzc2lvbiBBUEnmqZ/og73jga7ov73liqDvvIjnkrDlooPliKXliLblvqHlr77lv5zvvIlcbiAgICBpZiAocmVzb3VyY2VDb250cm9sLmVuYWJsZVBlcm1pc3Npb25BcGkgJiYgcHJvcHMudXNlckFjY2Vzc1RhYmxlICYmIHByb3BzLnBlcm1pc3Npb25DYWNoZVRhYmxlKSB7XG4gICAgICBjb25zb2xlLmxvZygnJyk7XG4gICAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgICAgY29uc29sZS5sb2coJ/CflJAgUGVybWlzc2lvbiBBUEnmqZ/og73jgpLov73liqDkuK0uLi4nKTtcbiAgICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgICBcbiAgICAgIHRoaXMuY3JlYXRlUGVybWlzc2lvbkFwaVJlc291cmNlcyhcbiAgICAgICAgcHJvcHMudXNlckFjY2Vzc1RhYmxlLFxuICAgICAgICBwcm9wcy5wZXJtaXNzaW9uQ2FjaGVUYWJsZSxcbiAgICAgICAgY29uZmlnLFxuICAgICAgICBwcm9qZWN0TmFtZSxcbiAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgIHJlZ2lvblByZWZpeFxuICAgICAgKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coJ+KchSBQZXJtaXNzaW9uIEFQSeapn+iDvei/veWKoOWujOS6hicpO1xuICAgIH0gZWxzZSBpZiAocmVzb3VyY2VDb250cm9sLmVuYWJsZVBlcm1pc3Npb25BcGkpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfimqDvuI8gIFBlcm1pc3Npb24gQVBJ5qmf6IO944GM5pyJ5Yq544Gn44GZ44GM44CBRHluYW1vRELjg4bjg7zjg5bjg6vjgYzmj5DkvpvjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICAgIGNvbnNvbGUubG9nKCcgICBEYXRhU3RhY2vjgYvjgol1c2VyQWNjZXNzVGFibGXjgahwZXJtaXNzaW9uQ2FjaGVUYWJsZeOCkua4oeOBl+OBpuOBj+OBoOOBleOBhCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZygn4oS577iPICBQZXJtaXNzaW9uIEFQSeapn+iDveOBr+eEoeWKueWMluOBleOCjOOBpuOBhOOBvuOBme+8iOeSsOWig+WIpeWItuW+oe+8iScpO1xuICAgIH1cblxuICAgIC8vIEJlZHJvY2sgQWdlbnTmqZ/og73jga7ov73liqDvvIjnkrDlooPliKXliLblvqHlr77lv5zvvIlcbiAgICBpZiAocmVzb3VyY2VDb250cm9sLmVuYWJsZUJlZHJvY2tBZ2VudCkge1xuICAgICAgY29uc29sZS5sb2coJycpO1xuICAgICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICAgIGNvbnNvbGUubG9nKCfwn6SWIEJlZHJvY2sgQWdlbnTmqZ/og73jgpLov73liqDkuK0uLi4nKTtcbiAgICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgICBcbiAgICAgIHRoaXMuY3JlYXRlQmVkcm9ja0FnZW50UmVzb3VyY2VzKFxuICAgICAgICBjb25maWcsXG4gICAgICAgIHByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgcmVnaW9uUHJlZml4XG4gICAgICApO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygn4pyFIEJlZHJvY2sgQWdlbnTmqZ/og73ov73liqDlrozkuoYnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ+KEue+4jyAgQmVkcm9jayBBZ2VudOapn+iDveOBr+eEoeWKueWMluOBleOCjOOBpuOBhOOBvuOBme+8iOeSsOWig+WIpeWItuW+oe+8iScpO1xuICAgIH1cblxuICAgIC8vIFBoYXNlIDQ6IEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCI77yI55Kw5aKD5Yil5Yi25b6h5a++5b+c77yJXG4gICAgaWYgKHJlc291cmNlQ29udHJvbC5lbmFibGVBZ2VudENvcmUgJiYgY29uZmlnLmFnZW50Q29yZSkge1xuICAgICAgY29uc29sZS5sb2coJycpO1xuICAgICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5qAIEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCI6ZaL5aeLLi4uJyk7XG4gICAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgICAgXG4gICAgICB0aGlzLmludGVncmF0ZUFnZW50Q29yZUNvbnN0cnVjdHMoXG4gICAgICAgIGNvbmZpZyxcbiAgICAgICAgcHJvamVjdE5hbWUsXG4gICAgICAgIGVudmlyb25tZW50LFxuICAgICAgICByZWdpb25QcmVmaXhcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgQWdlbnRDb3JlIENvbnN0cnVjdHPntbHlkIjlrozkuoYnKTtcbiAgICB9IGVsc2UgaWYgKGNvbmZpZy5hZ2VudENvcmUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfihLnvuI8gIEFnZW50Q29yZeapn+iDveOBr+eEoeWKueWMluOBleOCjOOBpuOBhOOBvuOBme+8iOeSsOWig+WIpeWItuW+oe+8iScpO1xuICAgIH1cblxuICAgIC8vIFRhZ3NcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ01vZHVsZScsICdXZWJBcHAnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0ZyYW1ld29yaycsICdOZXh0LmpzJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdBZGFwdGVyJywgJ0xhbWJkYSBXZWIgQWRhcHRlcicpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ0ROJywgJ0Nsb3VkRnJvbnQnKTtcbiAgICBpZiAoY29uZmlnLnBlcm1pc3Npb25BcGk/LmVuYWJsZWQpIHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUGVybWlzc2lvbkFQSScsICdFbmFibGVkJyk7XG4gICAgfVxuICAgIGlmIChjb25maWcuYmVkcm9ja0FnZW50Py5lbmFibGVkKSB7XG4gICAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0JlZHJvY2tBZ2VudCcsICdFbmFibGVkJyk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ+KchSBXZWJBcHBTdGFjayAoRnVsbCkg5Yid5pyf5YyW5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICog44K544K/44Oz44OJ44Ki44Ot44O844Oz44Oi44O844OJ55So44Oq44K944O844K544K744OD44OI44Ki44OD44OXXG4gICAqIOW/heimgeOBquODquOCveODvOOCueOCkuWPgueFp+OBvuOBn+OBr+S9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBzZXR1cFN0YW5kYWxvbmVSZXNvdXJjZXMoXG4gICAgZXhpc3RpbmdWcGNJZDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICAgIGV4aXN0aW5nU2VjdXJpdHlHcm91cElkOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nLFxuICAgIHJlZ2lvblByZWZpeDogc3RyaW5nXG4gICk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKCfwn5OmIOOCueOCv+ODs+ODieOCouODreODvOODs+ODouODvOODiTog44Oq44K944O844K544K744OD44OI44Ki44OD44OX6ZaL5aeLLi4uJyk7XG5cbiAgICAvLyBWUEPjga7lj4Lnhafjgb7jgZ/jga/kvZzmiJBcbiAgICBpZiAoZXhpc3RpbmdWcGNJZCkge1xuICAgICAgY29uc29sZS5sb2coYPCflJcg5pei5a2YVlBD44KS5Y+C54WnOiAke2V4aXN0aW5nVnBjSWR9YCk7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLnZwYyA9IGVjMi5WcGMuZnJvbUxvb2t1cCh0aGlzLCAnRXhpc3RpbmdWcGMnLCB7XG4gICAgICAgICAgdnBjSWQ6IGV4aXN0aW5nVnBjSWRcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCfinIUg5pei5a2YVlBD5Y+C54Wn5oiQ5YqfJyk7XG4gICAgICAgIFxuICAgICAgICAvLyDml6LlrZhWUEPjga7loLTlkIjjgIFEeW5hbW9EQiBWUEMgRW5kcG9pbnTjgpLkvZzmiJDvvIjml6LjgavlrZjlnKjjgZnjgovloLTlkIjjga/jgrnjgq3jg4Pjg5fvvIlcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLmNyZWF0ZUR5bmFtb0RiVnBjRW5kcG9pbnQodGhpcy52cGMsIHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCwgcmVnaW9uUHJlZml4KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZygn4oS577iPICBEeW5hbW9EQiBWUEMgRW5kcG9pbnTjga/ml6LjgavlrZjlnKjjgZnjgovjgYvjgIHkvZzmiJDjgafjgY3jgb7jgZvjgpPjgafjgZfjgZ8nKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCfimqDvuI8gIOaXouWtmFZQQ+OBjOimi+OBpOOBi+OCiuOBvuOBm+OCk+OAguaWsOimj1ZQQ+OCkuS9nOaIkOOBl+OBvuOBmeOAgicpO1xuICAgICAgICB0aGlzLnZwYyA9IHRoaXMuY3JlYXRlTWluaW1hbFZwYyhwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQsIHJlZ2lvblByZWZpeCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn4aVIOaWsOimj1ZQQ+OCkuS9nOaIkO+8iOacgOWwj+ani+aIkO+8iScpO1xuICAgICAgdGhpcy52cGMgPSB0aGlzLmNyZWF0ZU1pbmltYWxWcGMocHJvamVjdE5hbWUsIGVudmlyb25tZW50LCByZWdpb25QcmVmaXgpO1xuICAgIH1cblxuICAgIC8vIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OBruWPgueFp+OBvuOBn+OBr+S9nOaIkFxuICAgIGlmIChleGlzdGluZ1NlY3VyaXR5R3JvdXBJZCkge1xuICAgICAgY29uc29sZS5sb2coYPCflJcg5pei5a2Y44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44KS5Y+C54WnOiAke2V4aXN0aW5nU2VjdXJpdHlHcm91cElkfWApO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy5zZWN1cml0eUdyb3VwID0gZWMyLlNlY3VyaXR5R3JvdXAuZnJvbVNlY3VyaXR5R3JvdXBJZChcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgICdFeGlzdGluZ1NlY3VyaXR5R3JvdXAnLFxuICAgICAgICAgIGV4aXN0aW5nU2VjdXJpdHlHcm91cElkXG4gICAgICAgICk7XG4gICAgICAgIGNvbnNvbGUubG9nKCfinIUg5pei5a2Y44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX5Y+C54Wn5oiQ5YqfJyk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+KaoO+4jyAg5pei5a2Y44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44GM6KaL44Gk44GL44KK44G+44Gb44KT44CC5paw6KaP5L2c5oiQ44GX44G+44GZ44CCJyk7XG4gICAgICAgIHRoaXMuc2VjdXJpdHlHcm91cCA9IHRoaXMuY3JlYXRlU2VjdXJpdHlHcm91cChwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQsIHJlZ2lvblByZWZpeCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn4aVIOaWsOimj+OCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OCkuS9nOaIkCcpO1xuICAgICAgdGhpcy5zZWN1cml0eUdyb3VwID0gdGhpcy5jcmVhdGVTZWN1cml0eUdyb3VwKHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCwgcmVnaW9uUHJlZml4KTtcbiAgICB9XG5cbiAgICAvLyBJQU3jg63jg7zjg6vjga7kvZzmiJDvvIjlv4XpoIjvvIlcbiAgICBjb25zb2xlLmxvZygn8J+UkSBJQU3jg63jg7zjg6vjgpLkvZzmiJAnKTtcbiAgICB0aGlzLmNyZWF0ZUlhbVJvbGVzKHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCwgcmVnaW9uUHJlZml4KTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUg44K544K/44Oz44OJ44Ki44Ot44O844Oz44Oi44O844OJOiDjg6rjgr3jg7zjgrnjgrvjg4Pjg4jjgqLjg4Pjg5flrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDntbHlkIjjg6Ljg7zjg4nnlKjjg6rjgr3jg7zjgrnjgrvjg4Pjg4jjgqLjg4Pjg5dcbiAgICog5LuW44GuU3RhY2vjgYvjgonjg6rjgr3jg7zjgrnjgpLlj4LnhadcbiAgICovXG4gIHByaXZhdGUgc2V0dXBJbnRlZ3JhdGVkUmVzb3VyY2VzKFxuICAgIG5ldHdvcmtpbmdTdGFjazogYW55LFxuICAgIHNlY3VyaXR5U3RhY2s6IGFueVxuICApOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZygn8J+UlyDntbHlkIjjg6Ljg7zjg4k6IOODquOCveODvOOCueOCu+ODg+ODiOOCouODg+ODl+mWi+Wniy4uLicpO1xuXG4gICAgLy8g5b+F6aCIU3RhY2vjga7norroqo1cbiAgICBpZiAoIW5ldHdvcmtpbmdTdGFjayB8fCAhc2VjdXJpdHlTdGFjaykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAn57Wx5ZCI44Oi44O844OJ44Gn44GvTmV0d29ya2luZ1N0YWNr44GoU2VjdXJpdHlTdGFja+OBjOW/heimgeOBp+OBmeOAgicgK1xuICAgICAgICAn44K544K/44Oz44OJ44Ki44Ot44O844Oz44Oi44O844OJ44KS5L2/55So44GZ44KL44GL44CB5b+F6KaB44GqU3RhY2vjgpLmj5DkvpvjgZfjgabjgY/jgaDjgZXjgYTjgIInXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIOS7luOBrlN0YWNr44GL44KJ5Y+C54WnXG4gICAgdGhpcy52cGMgPSBuZXR3b3JraW5nU3RhY2sudnBjO1xuICAgIHRoaXMuc2VjdXJpdHlHcm91cCA9IG5ldHdvcmtpbmdTdGFjay53ZWJBcHBTZWN1cml0eUdyb3VwO1xuICAgIHRoaXMuZXhlY3V0aW9uUm9sZSA9IHNlY3VyaXR5U3RhY2subGFtYmRhRXhlY3V0aW9uUm9sZTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUg57Wx5ZCI44Oi44O844OJOiDjg6rjgr3jg7zjgrnjgrvjg4Pjg4jjgqLjg4Pjg5flrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmnIDlsI/pmZDjga5WUEPjgpLkvZzmiJBcbiAgICog44OX44Op44Kk44OZ44O844OI44K144OW44ON44OD44OIICsgTkFU44Ky44O844OI44Km44Kn44Kk77yITGFtYmRh55So77yJXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU1pbmltYWxWcGMoXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nLFxuICAgIHJlZ2lvblByZWZpeDogc3RyaW5nXG4gICk6IGVjMi5JVnBjIHtcbiAgICBjb25zb2xlLmxvZygn8J+Pl++4jyAg5pyA5bCP6ZmQ44GuVlBD44KS5L2c5oiQ5LitLi4uJyk7XG4gICAgXG4gICAgY29uc3QgdnBjID0gbmV3IGVjMi5WcGModGhpcywgJ1dlYkFwcFZwYycsIHtcbiAgICAgIHZwY05hbWU6IGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tV2ViQXBwLVZQQ2AsXG4gICAgICBtYXhBenM6IDIsXG4gICAgICBuYXRHYXRld2F5czogMSwgLy8gTGFtYmRh55So44GrTkFU44Ky44O844OI44Km44Kn44KkMeOBpFxuICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ1B1YmxpYycsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdQcml2YXRlJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGNkay5UYWdzLm9mKHZwYykuYWRkKCdOYW1lJywgYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1XZWJBcHAtVlBDYCk7XG4gICAgY2RrLlRhZ3Mub2YodnBjKS5hZGQoJ1B1cnBvc2UnLCAnV2ViQXBwLVN0YW5kYWxvbmUnKTtcblxuICAgIC8vIExhbWJkYSBWUEPphY3nva7jgYzmnInlirnjgarloLTlkIjjga7jgb9WUEMgRW5kcG9pbnTjgpLkvZzmiJBcbiAgICBjb25zdCBsYW1iZGFWcGNDb25maWcgPSAodGhpcy5jb25maWcgYXMgYW55KT8ud2ViYXBwPy5sYW1iZGE/LnZwYztcbiAgICBpZiAobGFtYmRhVnBjQ29uZmlnPy5lbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+UlyBMYW1iZGEgVlBD6YWN572u44GM5pyJ5Yq5IC0gVlBDIEVuZHBvaW5044KS5L2c5oiQ44GX44G+44GZJyk7XG4gICAgICBcbiAgICAgIC8vIER5bmFtb0RCIFZQQyBFbmRwb2ludO+8iEdhdGV3YXnlnovjgIHnhKHmlpnvvIlcbiAgICAgIGlmIChsYW1iZGFWcGNDb25maWcuZW5kcG9pbnRzPy5keW5hbW9kYiAhPT0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5jcmVhdGVEeW5hbW9EYlZwY0VuZHBvaW50KHZwYywgcHJvamVjdE5hbWUsIGVudmlyb25tZW50LCByZWdpb25QcmVmaXgpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBCZWRyb2NrIFJ1bnRpbWUgVlBDIEVuZHBvaW5077yISW50ZXJmYWNl5Z6L44CBJDcuMi/mnIjvvIlcbiAgICAgIGlmIChsYW1iZGFWcGNDb25maWcuZW5kcG9pbnRzPy5iZWRyb2NrUnVudGltZSkge1xuICAgICAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjgYzlv4XopoHjgarjga7jgafjgIHlhYjjgavkvZzmiJBcbiAgICAgICAgaWYgKCF0aGlzLnNlY3VyaXR5R3JvdXApIHtcbiAgICAgICAgICB0aGlzLnNlY3VyaXR5R3JvdXAgPSB0aGlzLmNyZWF0ZVNlY3VyaXR5R3JvdXAocHJvamVjdE5hbWUsIGVudmlyb25tZW50LCByZWdpb25QcmVmaXgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY3JlYXRlQmVkcm9ja1J1bnRpbWVWcGNFbmRwb2ludCh2cGMsIHRoaXMuc2VjdXJpdHlHcm91cCwgcHJvamVjdE5hbWUsIGVudmlyb25tZW50LCByZWdpb25QcmVmaXgpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBCZWRyb2NrIEFnZW50IFJ1bnRpbWUgVlBDIEVuZHBvaW5077yISW50ZXJmYWNl5Z6L44CBJDcuMi/mnIjvvIlcbiAgICAgIGlmIChsYW1iZGFWcGNDb25maWcuZW5kcG9pbnRzPy5iZWRyb2NrQWdlbnRSdW50aW1lKSB7XG4gICAgICAgIC8vIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OBjOW/heimgeOBquOBruOBp+OAgeWFiOOBq+S9nOaIkFxuICAgICAgICBpZiAoIXRoaXMuc2VjdXJpdHlHcm91cCkge1xuICAgICAgICAgIHRoaXMuc2VjdXJpdHlHcm91cCA9IHRoaXMuY3JlYXRlU2VjdXJpdHlHcm91cChwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQsIHJlZ2lvblByZWZpeCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jcmVhdGVCZWRyb2NrQWdlbnRSdW50aW1lVnBjRW5kcG9pbnQodnBjLCB0aGlzLnNlY3VyaXR5R3JvdXAsIHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCwgcmVnaW9uUHJlZml4KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ+KEue+4jyAgTGFtYmRhIFZQQ+mFjee9ruOBjOeEoeWKuSAtIFZQQyBFbmRwb2ludOOBr+S9nOaIkOOBl+OBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCfinIUgVlBD5L2c5oiQ5a6M5LqGJyk7XG4gICAgcmV0dXJuIHZwYztcbiAgfVxuXG4gIC8qKlxuICAgKiBEeW5hbW9EQiBWUEMgRW5kcG9pbnTjgpLkvZzmiJBcbiAgICogR2F0ZXdheeWei+OCqOODs+ODieODneOCpOODs+ODiO+8iOeEoeaWme+8ieOCkuS9v+eUqFxuICAgKiBMYW1iZGHplqLmlbDjgYxWUEPlhoXjgYvjgolEeW5hbW9EQuOBq+OCouOCr+OCu+OCueOBmeOCi+OBn+OCgeOBq+W/heimgVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVEeW5hbW9EYlZwY0VuZHBvaW50KFxuICAgIHZwYzogZWMyLklWcGMsXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nLFxuICAgIHJlZ2lvblByZWZpeDogc3RyaW5nXG4gICk6IGVjMi5HYXRld2F5VnBjRW5kcG9pbnQge1xuICAgIGNvbnNvbGUubG9nKCfwn5SXIER5bmFtb0RCIFZQQyBFbmRwb2ludOOCkuS9nOaIkOS4rS4uLicpO1xuXG4gICAgY29uc3QgZHluYW1vRGJFbmRwb2ludCA9IHZwYy5hZGRHYXRld2F5RW5kcG9pbnQoJ0R5bmFtb0RiRW5kcG9pbnQnLCB7XG4gICAgICBzZXJ2aWNlOiBlYzIuR2F0ZXdheVZwY0VuZHBvaW50QXdzU2VydmljZS5EWU5BTU9EQixcbiAgICB9KTtcblxuICAgIC8vIOOCv+OCsOOCkui/veWKoFxuICAgIGNkay5UYWdzLm9mKGR5bmFtb0RiRW5kcG9pbnQpLmFkZCgnTmFtZScsIGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tRHluYW1vREItRW5kcG9pbnRgKTtcbiAgICBjZGsuVGFncy5vZihkeW5hbW9EYkVuZHBvaW50KS5hZGQoJ1B1cnBvc2UnLCAnTGFtYmRhLUR5bmFtb0RCLUFjY2VzcycpO1xuICAgIGNkay5UYWdzLm9mKGR5bmFtb0RiRW5kcG9pbnQpLmFkZCgnVHlwZScsICdHYXRld2F5Jyk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIER5bmFtb0RCIFZQQyBFbmRwb2ludOS9nOaIkOWujOS6hicpO1xuICAgIHJldHVybiBkeW5hbW9EYkVuZHBvaW50O1xuICB9XG5cbiAgLyoqXG4gICAqIEJlZHJvY2sgUnVudGltZSBWUEMgRW5kcG9pbnTjgpLkvZzmiJBcbiAgICogSW50ZXJmYWNl5Z6L44Ko44Oz44OJ44Od44Kk44Oz44OI77yIJDcuMi/mnIjvvInjgpLkvb/nlKhcbiAgICogTGFtYmRh6Zai5pWw44GMVlBD5YaF44GL44KJQmVkcm9jayBSdW50aW1lIEFQSe+8iEludm9rZU1vZGVs77yJ44Gr44Ki44Kv44K744K544GZ44KL44Gf44KB44Gr5b+F6KaBXG4gICAqIEtCIE1vZGXjgafkvb/nlKhcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQmVkcm9ja1J1bnRpbWVWcGNFbmRwb2ludChcbiAgICB2cGM6IGVjMi5JVnBjLFxuICAgIHNlY3VyaXR5R3JvdXA6IGVjMi5JU2VjdXJpdHlHcm91cCxcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcsXG4gICAgcmVnaW9uUHJlZml4OiBzdHJpbmdcbiAgKTogZWMyLkludGVyZmFjZVZwY0VuZHBvaW50IHtcbiAgICBjb25zb2xlLmxvZygn8J+UlyBCZWRyb2NrIFJ1bnRpbWUgVlBDIEVuZHBvaW5044KS5L2c5oiQ5LitLi4uJyk7XG5cbiAgICBjb25zdCBiZWRyb2NrUnVudGltZUVuZHBvaW50ID0gbmV3IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludCh0aGlzLCAnQmVkcm9ja1J1bnRpbWVFbmRwb2ludCcsIHtcbiAgICAgIHZwYyxcbiAgICAgIHNlcnZpY2U6IG5ldyBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRTZXJ2aWNlKGBjb20uYW1hem9uYXdzLiR7dGhpcy5yZWdpb259LmJlZHJvY2stcnVudGltZWApLFxuICAgICAgc3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbc2VjdXJpdHlHcm91cF0sXG4gICAgICBwcml2YXRlRG5zRW5hYmxlZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIOOCv+OCsOOCkui/veWKoFxuICAgIGNkay5UYWdzLm9mKGJlZHJvY2tSdW50aW1lRW5kcG9pbnQpLmFkZCgnTmFtZScsIGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tQmVkcm9ja1J1bnRpbWUtRW5kcG9pbnRgKTtcbiAgICBjZGsuVGFncy5vZihiZWRyb2NrUnVudGltZUVuZHBvaW50KS5hZGQoJ1B1cnBvc2UnLCAnTGFtYmRhLUJlZHJvY2stUnVudGltZS1BY2Nlc3MnKTtcbiAgICBjZGsuVGFncy5vZihiZWRyb2NrUnVudGltZUVuZHBvaW50KS5hZGQoJ1R5cGUnLCAnSW50ZXJmYWNlJyk7XG4gICAgY2RrLlRhZ3Mub2YoYmVkcm9ja1J1bnRpbWVFbmRwb2ludCkuYWRkKCdNb2RlJywgJ0tCLU1vZGUnKTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUgQmVkcm9jayBSdW50aW1lIFZQQyBFbmRwb2ludOS9nOaIkOWujOS6hicpO1xuICAgIHJldHVybiBiZWRyb2NrUnVudGltZUVuZHBvaW50O1xuICB9XG5cbiAgLyoqXG4gICAqIEJlZHJvY2sgQWdlbnQgUnVudGltZSBWUEMgRW5kcG9pbnTjgpLkvZzmiJBcbiAgICogSW50ZXJmYWNl5Z6L44Ko44Oz44OJ44Od44Kk44Oz44OI77yIJDcuMi/mnIjvvInjgpLkvb/nlKhcbiAgICogTGFtYmRh6Zai5pWw44GMVlBD5YaF44GL44KJQmVkcm9jayBBZ2VudCBSdW50aW1lIEFQSe+8iEludm9rZUFnZW5077yJ44Gr44Ki44Kv44K744K544GZ44KL44Gf44KB44Gr5b+F6KaBXG4gICAqIEFnZW50IE1vZGXjgafkvb/nlKhcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQmVkcm9ja0FnZW50UnVudGltZVZwY0VuZHBvaW50KFxuICAgIHZwYzogZWMyLklWcGMsXG4gICAgc2VjdXJpdHlHcm91cDogZWMyLklTZWN1cml0eUdyb3VwLFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgICByZWdpb25QcmVmaXg6IHN0cmluZ1xuICApOiBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnQge1xuICAgIGNvbnNvbGUubG9nKCfwn5SXIEJlZHJvY2sgQWdlbnQgUnVudGltZSBWUEMgRW5kcG9pbnTjgpLkvZzmiJDkuK0uLi4nKTtcblxuICAgIGNvbnN0IGJlZHJvY2tBZ2VudEVuZHBvaW50ID0gbmV3IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludCh0aGlzLCAnQmVkcm9ja0FnZW50UnVudGltZUVuZHBvaW50Jywge1xuICAgICAgdnBjLFxuICAgICAgc2VydmljZTogbmV3IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludFNlcnZpY2UoYGNvbS5hbWF6b25hd3MuJHt0aGlzLnJlZ2lvbn0uYmVkcm9jay1hZ2VudC1ydW50aW1lYCksXG4gICAgICBzdWJuZXRzOiB7XG4gICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtzZWN1cml0eUdyb3VwXSxcbiAgICAgIHByaXZhdGVEbnNFbmFibGVkOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8g44K/44Kw44KS6L+95YqgXG4gICAgY2RrLlRhZ3Mub2YoYmVkcm9ja0FnZW50RW5kcG9pbnQpLmFkZCgnTmFtZScsIGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tQmVkcm9ja0FnZW50UnVudGltZS1FbmRwb2ludGApO1xuICAgIGNkay5UYWdzLm9mKGJlZHJvY2tBZ2VudEVuZHBvaW50KS5hZGQoJ1B1cnBvc2UnLCAnTGFtYmRhLUJlZHJvY2stQWdlbnQtUnVudGltZS1BY2Nlc3MnKTtcbiAgICBjZGsuVGFncy5vZihiZWRyb2NrQWdlbnRFbmRwb2ludCkuYWRkKCdUeXBlJywgJ0ludGVyZmFjZScpO1xuICAgIGNkay5UYWdzLm9mKGJlZHJvY2tBZ2VudEVuZHBvaW50KS5hZGQoJ01vZGUnLCAnQWdlbnQtTW9kZScpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBCZWRyb2NrIEFnZW50IFJ1bnRpbWUgVlBDIEVuZHBvaW505L2c5oiQ5a6M5LqGJyk7XG4gICAgcmV0dXJuIGJlZHJvY2tBZ2VudEVuZHBvaW50O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVTZWN1cml0eUdyb3VwKFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgICByZWdpb25QcmVmaXg6IHN0cmluZ1xuICApOiBlYzIuSVNlY3VyaXR5R3JvdXAge1xuICAgIGNvbnNvbGUubG9nKCfwn5SSIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OCkuS9nOaIkOS4rS4uLicpO1xuXG4gICAgaWYgKCF0aGlzLnZwYykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdWUEPjgYzkvZzmiJDjgZXjgozjgabjgYTjgb7jgZvjgpPjgILlhYjjgatWUEPjgpLkvZzmiJDjgZfjgabjgY/jgaDjgZXjgYTjgIInKTtcbiAgICB9XG5cbiAgICBjb25zdCBzZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdXZWJBcHBTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVdlYkFwcC1TR2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBXZWJBcHAgTGFtYmRhIChTdGFuZGFsb25lIE1vZGUpJyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBIVFRQU+OCouOCpuODiOODkOOCpuODs+ODieOCkuaYjuekuueahOOBq+ioseWPr1xuICAgIHNlY3VyaXR5R3JvdXAuYWRkRWdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmFueUlwdjQoKSxcbiAgICAgIGVjMi5Qb3J0LnRjcCg0NDMpLFxuICAgICAgJ0FsbG93IEhUVFBTIG91dGJvdW5kIGZvciBBV1MgQVBJIGNhbGxzJ1xuICAgICk7XG5cbiAgICBjZGsuVGFncy5vZihzZWN1cml0eUdyb3VwKS5hZGQoJ05hbWUnLCBgJHtyZWdpb25QcmVmaXh9LSR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LVdlYkFwcC1TR2ApO1xuICAgIGNkay5UYWdzLm9mKHNlY3VyaXR5R3JvdXApLmFkZCgnUHVycG9zZScsICdXZWJBcHAtU3RhbmRhbG9uZScpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fkvZzmiJDlrozkuoYnKTtcbiAgICByZXR1cm4gc2VjdXJpdHlHcm91cDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJQU3jg63jg7zjg6vjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlSWFtUm9sZXMoXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nLFxuICAgIHJlZ2lvblByZWZpeDogc3RyaW5nXG4gICk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKCfwn5SRIElBTeODreODvOODq+OCkuS9nOaIkOS4rS4uLicpO1xuXG4gICAgdGhpcy5leGVjdXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdXZWJBcHBFeGVjdXRpb25Sb2xlJywge1xuICAgICAgcm9sZU5hbWU6IGAke3JlZ2lvblByZWZpeH0tJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tV2ViQXBwLUV4ZWN1dGlvbi1Sb2xlYCxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdFeGVjdXRpb24gcm9sZSBmb3IgV2ViQXBwIExhbWJkYSBmdW5jdGlvbiAoU3RhbmRhbG9uZSBNb2RlKScsXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYVZQQ0FjY2Vzc0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBCZWRyb2NrIOOCouOCr+OCu+OCueaoqemZkFxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJyxcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nLFxuICAgICAgICAnYmVkcm9jazpMaXN0Rm91bmRhdGlvbk1vZGVscycsXG4gICAgICAgICdiZWRyb2NrOkdldEZvdW5kYXRpb25Nb2RlbCcsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBCZWRyb2NrIEFnZW50IFJ1bnRpbWXmqKnpmZDvvIjku4rlm57jga7kv67mraPjgafov73liqDvvIlcbiAgICB0aGlzLmV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jay1hZ2VudC1ydW50aW1lOkludm9rZUFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQtcnVudGltZTpSZXRyaWV2ZScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBCZWRyb2NrIEFnZW50IEludm9jYXRpb27mqKnpmZDvvIhQaGFzZSAyIC0gVGFzayAyIENyaXRpY2FsIEZpeO+8iVxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdiZWRyb2NrOkludm9rZUFnZW50JyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06YWdlbnQtYWxpYXMvKmAsXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIEJlZHJvY2sgQWdlbnTnrqHnkIbmqKnpmZDvvIhBZ2VudCBJbmZvIEFQSeeUqCAtIDIwMjUtMTItMTLkv67mraPvvIlcbiAgICAvLyBBZ2VudOS9nOaIkOODu+euoeeQhuaoqemZkOi/veWKoO+8iDIwMjUtMTItMzHov73liqDvvIlcbiAgICAvLyAyMDI2LTAxLTExOiBBZ2VudCBDcmVhdGlvbiBXaXphcmTnlKjmqKnpmZDov73liqBcbiAgICB0aGlzLmV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAvLyBBZ2VudOaDheWgseWPluW+l+OBq+W/heimgeOBquaoqemZkO+8iGJlZHJvY2vlkI3liY3nqbrplpPvvIlcbiAgICAgICAgJ2JlZHJvY2s6R2V0QWdlbnQnLFxuICAgICAgICAnYmVkcm9jazpMaXN0QWdlbnRzJyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEFnZW50QWxpYXNlcycsIFxuICAgICAgICAnYmVkcm9jazpHZXRBZ2VudEFsaWFzJyxcbiAgICAgICAgJ2JlZHJvY2s6VXBkYXRlQWdlbnQnLFxuICAgICAgICAnYmVkcm9jazpQcmVwYXJlQWdlbnQnLFxuICAgICAgICAvLyBBZ2VudOS9nOaIkOODu+WJiumZpOaoqemZkO+8iDIwMjUtMTItMzHov73liqDvvIlcbiAgICAgICAgJ2JlZHJvY2s6Q3JlYXRlQWdlbnQnLFxuICAgICAgICAnYmVkcm9jazpEZWxldGVBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrOkNyZWF0ZUFnZW50QWxpYXMnLFxuICAgICAgICAnYmVkcm9jazpVcGRhdGVBZ2VudEFsaWFzJyxcbiAgICAgICAgJ2JlZHJvY2s6RGVsZXRlQWdlbnRBbGlhcycsXG4gICAgICAgIC8vIEFjdGlvbiBHcm91cOeuoeeQhuaoqemZkFxuICAgICAgICAnYmVkcm9jazpDcmVhdGVBZ2VudEFjdGlvbkdyb3VwJyxcbiAgICAgICAgJ2JlZHJvY2s6VXBkYXRlQWdlbnRBY3Rpb25Hcm91cCcsXG4gICAgICAgICdiZWRyb2NrOkRlbGV0ZUFnZW50QWN0aW9uR3JvdXAnLFxuICAgICAgICAnYmVkcm9jazpHZXRBZ2VudEFjdGlvbkdyb3VwJyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEFnZW50QWN0aW9uR3JvdXBzJyxcbiAgICAgICAgLy8gS25vd2xlZGdlIEJhc2XplqLpgKPmqKnpmZBcbiAgICAgICAgJ2JlZHJvY2s6QXNzb2NpYXRlQWdlbnRLbm93bGVkZ2VCYXNlJyxcbiAgICAgICAgJ2JlZHJvY2s6RGlzYXNzb2NpYXRlQWdlbnRLbm93bGVkZ2VCYXNlJyxcbiAgICAgICAgJ2JlZHJvY2s6R2V0QWdlbnRLbm93bGVkZ2VCYXNlJyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEFnZW50S25vd2xlZGdlQmFzZXMnLFxuICAgICAgICAnYmVkcm9jazpMaXN0S25vd2xlZGdlQmFzZXMnLFxuICAgICAgICAnYmVkcm9jazpHZXRLbm93bGVkZ2VCYXNlJyxcbiAgICAgICAgLy8gRm91bmRhdGlvbiBNb2RlbOeuoeeQhuaoqemZkO+8iEFnZW50IENyZWF0aW9uIFdpemFyZOeUqO+8iVxuICAgICAgICAnYmVkcm9jazpMaXN0Rm91bmRhdGlvbk1vZGVscycsXG4gICAgICAgICdiZWRyb2NrOkdldEZvdW5kYXRpb25Nb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkxpc3RDdXN0b21Nb2RlbHMnLFxuICAgICAgICAvLyDlvpPmnaXjga5iZWRyb2NrLWFnZW505qip6ZmQ44KC57at5oyB77yI5LqS5o+b5oCn44Gu44Gf44KB77yJXG4gICAgICAgICdiZWRyb2NrLWFnZW50OkdldEFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQ6TGlzdEFnZW50cycsXG4gICAgICAgICdiZWRyb2NrLWFnZW50OlVwZGF0ZUFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQ6UHJlcGFyZUFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQ6Q3JlYXRlQWdlbnQnLFxuICAgICAgICAnYmVkcm9jay1hZ2VudDpEZWxldGVBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrLWFnZW50OkNyZWF0ZUFnZW50QWxpYXMnLFxuICAgICAgICAnYmVkcm9jay1hZ2VudDpVcGRhdGVBZ2VudEFsaWFzJyxcbiAgICAgICAgJ2JlZHJvY2stYWdlbnQ6RGVsZXRlQWdlbnRBbGlhcycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBJQU0gUGFzc1JvbGXmqKnpmZDvvIhCZWRyb2NrIEFnZW505pu05paw44O75L2c5oiQ5pmC44Gr5b+F6KaB77yJXG4gICAgdGhpcy5leGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2lhbTpQYXNzUm9sZScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmlhbTo6JHt0aGlzLmFjY291bnR9OnJvbGUvKmJlZHJvY2stYWdlbnQtcm9sZSpgLFxuICAgICAgICBgYXJuOmF3czppYW06OiR7dGhpcy5hY2NvdW50fTpyb2xlL0FtYXpvbkJlZHJvY2tFeGVjdXRpb25Sb2xlRm9yQWdlbnRzXypgLFxuICAgICAgICBgYXJuOmF3czppYW06OiR7dGhpcy5hY2NvdW50fTpyb2xlL1Rva3lvUmVnaW9uLXBlcm1pc3Npb24tYXdhcmUtcmFnLSotQWdlbnQtU2VydmljZS1Sb2xlYCxcbiAgICAgICAgYGFybjphd3M6aWFtOjoke3RoaXMuYWNjb3VudH06cm9sZS9Ub2t5b1JlZ2lvbi1wZXJtaXNzaW9uLWF3YXJlLXJhZy0qLVdlYkFwcC1FeGVjdXRpb24tUm9sZWAsXG4gICAgICBdLFxuICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAnaWFtOlBhc3NlZFRvU2VydmljZSc6ICdiZWRyb2NrLmFtYXpvbmF3cy5jb20nXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSk7XG5cbiAgICAvLyBJQU0gUm9sZeeuoeeQhuaoqemZkO+8iEFnZW50IFNlcnZpY2UgUm9sZeS9nOaIkOeUqCAtIDIwMjYtMDEtMTHov73liqDvvIlcbiAgICB0aGlzLmV4ZWN1dGlvblJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnaWFtOkNyZWF0ZVJvbGUnLFxuICAgICAgICAnaWFtOkdldFJvbGUnLFxuICAgICAgICAnaWFtOkF0dGFjaFJvbGVQb2xpY3knLFxuICAgICAgICAnaWFtOkRldGFjaFJvbGVQb2xpY3knLFxuICAgICAgICAnaWFtOlB1dFJvbGVQb2xpY3knLFxuICAgICAgICAnaWFtOkRlbGV0ZVJvbGVQb2xpY3knLFxuICAgICAgICAnaWFtOkxpc3RBdHRhY2hlZFJvbGVQb2xpY2llcycsXG4gICAgICAgICdpYW06TGlzdFJvbGVQb2xpY2llcycsXG4gICAgICAgICdpYW06VGFnUm9sZScsXG4gICAgICAgICdpYW06VW50YWdSb2xlJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6aWFtOjoke3RoaXMuYWNjb3VudH06cm9sZS9Ub2t5b1JlZ2lvbi1wZXJtaXNzaW9uLWF3YXJlLXJhZy0qLUFnZW50LVNlcnZpY2UtUm9sZWAsXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIFNTTeODkeODqeODoeODvOOCv+OCouOCr+OCu+OCueaoqemZkO+8iEFnZW50IElE5YuV55qE5Y+W5b6X55So77yJXG4gICAgdGhpcy5leGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXInLFxuICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnMnLFxuICAgICAgICAnc3NtOlB1dFBhcmFtZXRlcicsXG4gICAgICAgICdzc206RGVsZXRlUGFyYW1ldGVyJyxcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzQnlQYXRoJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6c3NtOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpwYXJhbWV0ZXIvYmVkcm9jay1hZ2VudC8qYCxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gRUNSIOOCouOCr+OCu+OCueaoqemZkO+8iOOCs+ODs+ODhuODiuOCpOODoeODvOOCuOWPluW+l+eUqO+8iVxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdlY3I6R2V0RG93bmxvYWRVcmxGb3JMYXllcicsXG4gICAgICAgICdlY3I6QmF0Y2hHZXRJbWFnZScsXG4gICAgICAgICdlY3I6QmF0Y2hDaGVja0xheWVyQXZhaWxhYmlsaXR5JyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLCAvLyDlvozjgadFQ1Ljg6rjg53jgrjjg4jjg6pBUk7jgavliLbpmZDlj6/og71cbiAgICB9KSk7XG5cbiAgICBjZGsuVGFncy5vZih0aGlzLmV4ZWN1dGlvblJvbGUpLmFkZCgnUHVycG9zZScsICdXZWJBcHAtU3RhbmRhbG9uZScpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBJQU3jg63jg7zjg6vkvZzmiJDlrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQZXJtaXNzaW9uIEFQSeODquOCveODvOOCueOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVQZXJtaXNzaW9uQXBpUmVzb3VyY2VzKFxuICAgIHVzZXJBY2Nlc3NUYWJsZTogZHluYW1vZGIuSVRhYmxlLFxuICAgIHBlcm1pc3Npb25DYWNoZVRhYmxlOiBkeW5hbW9kYi5JVGFibGUsXG4gICAgY29uZmlnOiBXZWJBcHBTdGFja0NvbmZpZyxcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcsXG4gICAgcmVnaW9uUHJlZml4OiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/CflJAgUGVybWlzc2lvbiBBUEnjg6rjgr3jg7zjgrnkvZzmiJDplovlp4suLi4nKTtcblxuICAgIC8vIDEuIElBTeODreODvOODq+OBruS9nOaIkFxuICAgIHRoaXMucGVybWlzc2lvbkFwaUV4ZWN1dGlvblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1Blcm1pc3Npb25BcGlFeGVjdXRpb25Sb2xlJywge1xuICAgICAgcm9sZU5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1wZXJtaXNzaW9uLWFwaS1yb2xlYCxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdFeGVjdXRpb24gcm9sZSBmb3IgUGVybWlzc2lvbiBBUEkgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhVlBDQWNjZXNzRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIER5bmFtb0RC44Ki44Kv44K744K55qip6ZmQXG4gICAgdXNlckFjY2Vzc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLnBlcm1pc3Npb25BcGlFeGVjdXRpb25Sb2xlKTtcbiAgICBwZXJtaXNzaW9uQ2FjaGVUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5wZXJtaXNzaW9uQXBpRXhlY3V0aW9uUm9sZSk7XG5cbiAgICAvLyBTU03jg5Hjg6njg6Hjg7zjgr/jgqLjgq/jgrvjgrnmqKnpmZBcbiAgICBjb25zdCBzc21QYXJhbWV0ZXJQcmVmaXggPSBjb25maWcucGVybWlzc2lvbkFwaT8uc3NtUGFyYW1ldGVyUHJlZml4IHx8ICcvZnN4LW9udGFwJztcbiAgICB0aGlzLnBlcm1pc3Npb25BcGlFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXInLFxuICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnMnLFxuICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnNCeVBhdGgnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpzc206JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnBhcmFtZXRlciR7c3NtUGFyYW1ldGVyUHJlZml4fS8qYCxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gRlN4IE9OVEFQ44Ki44Kv44K744K55qip6ZmQ77yIUkVTVCBBUEnntYznlLHvvIlcbiAgICB0aGlzLnBlcm1pc3Npb25BcGlFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2ZzeDpEZXNjcmliZUZpbGVTeXN0ZW1zJyxcbiAgICAgICAgJ2ZzeDpEZXNjcmliZVZvbHVtZXMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBQZXJtaXNzaW9uIEFQSSBJQU3jg63jg7zjg6vkvZzmiJDlrozkuoYnKTtcblxuICAgIC8vIDIuIExhbWJkYemWouaVsOOBruS9nOaIkFxuICAgIC8vIOeSsOWig+WkieaVsOOBruioreWumlxuICAgIGNvbnN0IHBlcm1pc3Npb25BcGlFbnZpcm9ubWVudDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHtcbiAgICAgIFVTRVJfQUNDRVNTX1RBQkxFX05BTUU6IHVzZXJBY2Nlc3NUYWJsZS50YWJsZU5hbWUsXG4gICAgICBQRVJNSVNTSU9OX0NBQ0hFX1RBQkxFX05BTUU6IHBlcm1pc3Npb25DYWNoZVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIEZTWF9NQU5BR0VNRU5UX0VORFBPSU5UOiBjb25maWcucGVybWlzc2lvbkFwaT8ub250YXBNYW5hZ2VtZW50TGlmIHx8ICcnLFxuICAgICAgU1NNX1BBUkFNRVRFUl9QUkVGSVg6IHNzbVBhcmFtZXRlclByZWZpeCxcbiAgICAgIENBQ0hFX0VOQUJMRUQ6ICd0cnVlJyxcbiAgICAgIENBQ0hFX1RUTF9TRUNPTkRTOiAnMzAwJyxcbiAgICAgIExPR19MRVZFTDogJ0lORk8nLFxuICAgICAgQVdTX1JFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgfTtcblxuICAgIHRoaXMucGVybWlzc2lvbkFwaUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUGVybWlzc2lvbkFwaUZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tcGVybWlzc2lvbi1hcGlgLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnZ2V0LXVzZXItcGVybWlzc2lvbnMuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9wZXJtaXNzaW9ucycsIHtcbiAgICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgICBpbWFnZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1guYnVuZGxpbmdJbWFnZSxcbiAgICAgICAgICBjb21tYW5kOiBbXG4gICAgICAgICAgICAnYmFzaCcsICctYycsXG4gICAgICAgICAgICAnbnBtIGluc3RhbGwgJiYgY3AgLXIgLiAvYXNzZXQtb3V0cHV0LycsXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgcm9sZTogdGhpcy5wZXJtaXNzaW9uQXBpRXhlY3V0aW9uUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiBwZXJtaXNzaW9uQXBpRW52aXJvbm1lbnQsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBzZWN1cml0eUdyb3VwczogdGhpcy5zZWN1cml0eUdyb3VwID8gW3RoaXMuc2VjdXJpdHlHcm91cF0gOiB1bmRlZmluZWQsXG4gICAgICB2cGNTdWJuZXRzOiB0aGlzLnZwYyA/IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgIH0gOiB1bmRlZmluZWQsXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIFBlcm1pc3Npb24gQVBJIExhbWJkYemWouaVsOS9nOaIkOWujOS6hicpO1xuXG4gICAgLy8gMy4gQVBJIEdhdGV3YXnjga7kvZzmiJBcbiAgICB0aGlzLnBlcm1pc3Npb25BcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdQZXJtaXNzaW9uQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1wZXJtaXNzaW9uLWFwaWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24gQVBJIGZvciBGU3ggT05UQVAgSHlicmlkIFBlcm1pc3Npb24gU3lzdGVtJyxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRh57Wx5ZCI44Gu5L2c5oiQXG4gICAgY29uc3QgcGVybWlzc2lvbkFwaUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5wZXJtaXNzaW9uQXBpRnVuY3Rpb24sIHtcbiAgICAgIHByb3h5OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gL3Blcm1pc3Npb25zIOOCqOODs+ODieODneOCpOODs+ODiFxuICAgIGNvbnN0IHBlcm1pc3Npb25zID0gdGhpcy5wZXJtaXNzaW9uQXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3Blcm1pc3Npb25zJyk7XG4gICAgXG4gICAgLy8gR0VUIC9wZXJtaXNzaW9ucy97dXNlcklkfVxuICAgIGNvbnN0IHVzZXJQZXJtaXNzaW9ucyA9IHBlcm1pc3Npb25zLmFkZFJlc291cmNlKCd7dXNlcklkfScpO1xuICAgIHVzZXJQZXJtaXNzaW9ucy5hZGRNZXRob2QoJ0dFVCcsIHBlcm1pc3Npb25BcGlJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuSUFNLFxuICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnBhdGgudXNlcklkJzogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIFBlcm1pc3Npb24gQVBJIEdhdGV3YXnkvZzmiJDlrozkuoYnKTtcblxuICAgIC8vIDQuIOWHuuWKm+WApOOBruWumue+qVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQZXJtaXNzaW9uQXBpVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMucGVybWlzc2lvbkFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24gQVBJIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUGVybWlzc2lvbkFwaVVybGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGVybWlzc2lvbkFwaUZ1bmN0aW9uTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnBlcm1pc3Npb25BcGlGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24gQVBJIExhbWJkYSBGdW5jdGlvbiBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1QZXJtaXNzaW9uQXBpRnVuY3Rpb25OYW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQZXJtaXNzaW9uQXBpRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5wZXJtaXNzaW9uQXBpRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24gQVBJIExhbWJkYSBGdW5jdGlvbiBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVBlcm1pc3Npb25BcGlGdW5jdGlvbkFybmAsXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygnJyk7XG4gICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICBjb25zb2xlLmxvZygn8J+TiyBQZXJtaXNzaW9uIEFQSeWHuuWKm+WApOOCteODnuODquODvCcpO1xuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgY29uc29sZS5sb2coYOKchSBBUEkgVVJMOiAke3RoaXMucGVybWlzc2lvbkFwaS51cmx9YCk7XG4gICAgY29uc29sZS5sb2coYOKchSBMYW1iZGHplqLmlbDlkI06ICR7dGhpcy5wZXJtaXNzaW9uQXBpRnVuY3Rpb24uZnVuY3Rpb25OYW1lfWApO1xuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gIH1cblxuICAvKipcbiAgICogQmVkcm9jayBBZ2VudOODquOCveODvOOCueOCkuS9nOaIkFxuICAgKiBQaGFzZSAyIC0gVGFzayAzOiBCZWRyb2NrQWdlbnREeW5hbWljQ29uc3RydWN044KS5L2/55So44GX44Gf5YuV55qE44Oi44OH44Or6YG45oqeXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUJlZHJvY2tBZ2VudFJlc291cmNlcyhcbiAgICBjb25maWc6IFdlYkFwcFN0YWNrQ29uZmlnLFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgICByZWdpb25QcmVmaXg6IHN0cmluZ1xuICApOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZygn8J+kliBCZWRyb2NrIEFnZW5044Oq44K944O844K55L2c5oiQ6ZaL5aeLLi4uJyk7XG4gICAgY29uc29sZS5sb2coJyAgIOWLleeahOODouODh+ODq+mBuOaKnuapn+iDveOCkuS9v+eUqCcpO1xuXG4gICAgLy8gQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdOOCkuS9v+eUqFxuICAgIGNvbnN0IGJlZHJvY2tBZ2VudENvbnN0cnVjdCA9IG5ldyBCZWRyb2NrQWdlbnREeW5hbWljQ29uc3RydWN0KHRoaXMsICdCZWRyb2NrQWdlbnREeW5hbWljJywge1xuICAgICAgcHJvamVjdE5hbWUsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICAgIGFnZW50TmFtZTogYCR7cmVnaW9uUHJlZml4fS0ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1yYWctYWdlbnRgLFxuICAgICAgYWdlbnREZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24tYXdhcmUgUkFHIEFnZW50IHdpdGggZHluYW1pYyBtb2RlbCBzZWxlY3Rpb24nLFxuICAgICAgaW5zdHJ1Y3Rpb246IHRoaXMuZ2V0QWdlbnRJbnN0cnVjdGlvbigpLFxuICAgICAgdXNlQ2FzZTogY29uZmlnLmJlZHJvY2tBZ2VudD8udXNlQ2FzZSB8fCAnY2hhdCcsXG4gICAgICBtb2RlbFJlcXVpcmVtZW50czogY29uZmlnLmJlZHJvY2tBZ2VudD8ubW9kZWxSZXF1aXJlbWVudHMgfHwge1xuICAgICAgICBvbkRlbWFuZDogdHJ1ZSxcbiAgICAgICAgc3RyZWFtaW5nOiB0cnVlLFxuICAgICAgICBjcm9zc1JlZ2lvbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBlbmFibGVEeW5hbWljTW9kZWxTZWxlY3Rpb246IGNvbmZpZy5iZWRyb2NrQWdlbnQ/LmVuYWJsZUR5bmFtaWNNb2RlbFNlbGVjdGlvbiAhPT0gZmFsc2UsXG4gICAgICBlbmFibGVBdXRvVXBkYXRlOiBjb25maWcuYmVkcm9ja0FnZW50Py5lbmFibGVBdXRvVXBkYXRlICE9PSBmYWxzZSxcbiAgICAgIHBhcmFtZXRlclN0b3JlUHJlZml4OiBjb25maWcuYmVkcm9ja0FnZW50Py5wYXJhbWV0ZXJTdG9yZVByZWZpeCB8fCBgL2JlZHJvY2stYWdlbnQvJHtwcm9qZWN0TmFtZX0vJHtlbnZpcm9ubWVudH1gLFxuICAgICAga25vd2xlZGdlQmFzZUFybjogY29uZmlnLmJlZHJvY2tBZ2VudD8ua25vd2xlZGdlQmFzZUlkIFxuICAgICAgICA/IGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9Omtub3dsZWRnZS1iYXNlLyR7Y29uZmlnLmJlZHJvY2tBZ2VudC5rbm93bGVkZ2VCYXNlSWR9YFxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICB9KTtcblxuICAgIC8vIOOCs+ODs+OCueODiOODqeOCr+ODiOOBi+OCieeUn+aIkOOBleOCjOOBn+ODquOCveODvOOCueOCkuWPluW+l1xuICAgIHRoaXMuYmVkcm9ja0FnZW50ID0gYmVkcm9ja0FnZW50Q29uc3RydWN0LmFnZW50O1xuICAgIHRoaXMuYmVkcm9ja0FnZW50QWxpYXMgPSBiZWRyb2NrQWdlbnRDb25zdHJ1Y3QuYWdlbnRBbGlhcztcbiAgICB0aGlzLmJlZHJvY2tBZ2VudFNlcnZpY2VSb2xlID0gYmVkcm9ja0FnZW50Q29uc3RydWN0LmFnZW50Um9sZTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUgQmVkcm9jayBBZ2VudOS9nOaIkOWujOS6hicpO1xuICAgIGNvbnNvbGUubG9nKGAgICDpgbjmip7jgZXjgozjgZ/jg6Ljg4fjg6s6ICR7YmVkcm9ja0FnZW50Q29uc3RydWN0LnNlbGVjdGVkTW9kZWx9YCk7XG5cbiAgICAvLyBMYW1iZGHplqLmlbDjgbjjga7mqKnpmZDku5jkuI5cbiAgICBpZiAodGhpcy53ZWJBcHBGdW5jdGlvbikge1xuICAgICAgY29uc29sZS5sb2coJ/CflJEgTGFtYmRh6Zai5pWw44GrQmVkcm9jayBBZ2VudOaoqemZkOOCkuS7mOS4juS4rS4uLicpO1xuICAgICAgYmVkcm9ja0FnZW50Q29uc3RydWN0LmdyYW50SW52b2tlVG9MYW1iZGEodGhpcy53ZWJBcHBGdW5jdGlvbik7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIExhbWJkYemWouaVsOOBuOOBruaoqemZkOS7mOS4juWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIExhbWJkYemWouaVsOOBrueSsOWig+WkieaVsOOCkuabtOaWsO+8iEFnZW505oOF5aCx44KS6L+95Yqg77yJXG4gICAgaWYgKHRoaXMud2ViQXBwRnVuY3Rpb24gJiYgdGhpcy5iZWRyb2NrQWdlbnQgJiYgdGhpcy5iZWRyb2NrQWdlbnRBbGlhcykge1xuICAgICAgY29uc29sZS5sb2coJ/CflIQgTGFtYmRh6Zai5pWw44Gu55Kw5aKD5aSJ5pWw44KS5pu05paw5LitLi4uJyk7XG4gICAgICB0aGlzLndlYkFwcEZ1bmN0aW9uLmFkZEVudmlyb25tZW50KCdCRURST0NLX0FHRU5UX0lEJywgdGhpcy5iZWRyb2NrQWdlbnQuYXR0ckFnZW50SWQpO1xuICAgICAgdGhpcy53ZWJBcHBGdW5jdGlvbi5hZGRFbnZpcm9ubWVudCgnQkVEUk9DS19BR0VOVF9BTElBU19JRCcsIHRoaXMuYmVkcm9ja0FnZW50QWxpYXMuYXR0ckFnZW50QWxpYXNJZCk7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIExhbWJkYemWouaVsOOBrueSsOWig+WkieaVsOabtOaWsOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIENsb3VkRm9ybWF0aW9uIE91dHB1dHPjga7oqK3lrppcbiAgICB0aGlzLmNyZWF0ZUJlZHJvY2tBZ2VudE91dHB1dHMocHJvamVjdE5hbWUsIGVudmlyb25tZW50KTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUgQmVkcm9jayBBZ2VudOODquOCveODvOOCueS9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFnZW505oyH56S644OX44Ot44Oz44OX44OI44KS5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldEFnZW50SW5zdHJ1Y3Rpb24oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYFxu44GC44Gq44Gf44Gv44CB5qip6ZmQ6KqN6K2Y5Z6LUkFH77yIUmV0cmlldmFsLUF1Z21lbnRlZCBHZW5lcmF0aW9u77yJ44K344K544OG44Og44GuQUnjgqLjgrfjgrnjgr/jg7Pjg4jjgafjgZnjgIJcbuODpuODvOOCtuODvOOBruizquWVj+OBq+WvvuOBl+OBpuOAgeOBneOBruODpuODvOOCtuODvOOBjOOCouOCr+OCu+OCueaoqemZkOOCkuaMgeOBpOaWh+abuOOBruOBv+OCkuWPgueFp+OBl+OBpuWbnuetlOOCkueUn+aIkOOBl+OBvuOBmeOAglxuXG4jIyDkuLvopoHjgarosqzli5lcblxuMS4gKirmqKnpmZDjg5njg7zjgrnjga7mlofmm7jmpJzntKIqKlxuICAgLSDjg6bjg7zjgrbjg7zjga7os6rllY/jgpLlj5fjgZHlj5bjgaPjgZ/jgonjgIHjgb7jgZpkb2N1bWVudF9zZWFyY2jjgqLjgq/jgrfjg6fjg7PjgpLkvb/nlKjjgZfjgabplqLpgKPmlofmm7jjgpLmpJzntKLjgZfjgb7jgZlcbiAgIC0g5qSc57Si57WQ5p6c44Gr44Gv44CB44Om44O844K244O844GM44Ki44Kv44K744K55qip6ZmQ44KS5oyB44Gk5paH5pu444Gu44G/44GM5ZCr44G+44KM44G+44GZXG4gICAtIOaknOe0oue1kOaenOOBjOepuuOBruWgtOWQiOOAgeODpuODvOOCtuODvOOBq+OAjOOCouOCr+OCu+OCueWPr+iDveOBqumWoumAo+aWh+abuOOBjOimi+OBpOOBi+OCiuOBvuOBm+OCk+OBp+OBl+OBn+OAjeOBqOS8neOBiOOBvuOBmVxuXG4yLiAqKuato+eiuuOBquaDheWgseaPkOS+myoqXG4gICAtIOaknOe0ouOBleOCjOOBn+aWh+abuOOBruWGheWuueOBruOBv+OBq+WfuuOBpeOBhOOBpuWbnuetlOOCkueUn+aIkOOBl+OBvuOBmVxuICAgLSDmlofmm7jjgavoqJjovInjgZXjgozjgabjgYTjgarjgYTmg4XloLHjgavjgaTjgYTjgabjga/jgIHmjqjmuKzjgoTlibXkvZzjgpLjgZvjgZrjgIHjgIzmlofmm7jjgavoqJjovInjgYzjgYLjgorjgb7jgZvjgpPjgI3jgajmraPnm7TjgavkvJ3jgYjjgb7jgZlcbiAgIC0g6KSH5pWw44Gu5paH5pu444GL44KJ5oOF5aCx44KS57Wx5ZCI44GZ44KL5aC05ZCI44CB5ZCE5oOF5aCx44Gu5Ye65YW444KS5piO56S644GX44G+44GZXG5cbjMuICoq44K744Kt44Ol44Oq44OG44Kj44Go44OX44Op44Kk44OQ44K344O8KipcbiAgIC0g44Om44O844K244O844GM44Ki44Kv44K744K55qip6ZmQ44KS5oyB44Gf44Gq44GE5paH5pu444Gu5a2Y5Zyo44KE5YaF5a6544Gr44Gk44GE44Gm6KiA5Y+K44GX44G+44Gb44KTXG4gICAtIOS7luOBruODpuODvOOCtuODvOOBruaDheWgseOChOOCouOCr+OCu+OCueaoqemZkOOBq+OBpOOBhOOBpumWi+ekuuOBl+OBvuOBm+OCk1xuICAgLSDmqZ/lr4bmg4XloLHjgoTlgIvkurrmg4XloLHjgpLpganliIfjgavmibHjgYTjgb7jgZlcblxuNC4gKirjg6bjg7zjgrbjg7zjgqjjgq/jgrnjg5rjg6rjgqjjg7PjgrkqKlxuICAgLSDmmI7norrjgafnsKHmvZTjgarlm57nrZTjgpLmj5DkvpvjgZfjgb7jgZlcbiAgIC0g5b+F6KaB44Gr5b+c44GY44Gm44CB6L+95Yqg44Gu6LOq5ZWP44KE6Kmz57Sw5oOF5aCx44KS5rGC44KB44G+44GZXG4gICAtIOaKgOihk+eahOOBquWGheWuueOCkuWIhuOBi+OCiuOChOOBmeOBj+iqrOaYjuOBl+OBvuOBmVxuXG4jIyBBY3Rpb24gR3JvdXBz44Gu5L2/55SoXG5cbiMjIyBkb2N1bWVudF9zZWFyY2hcbuODpuODvOOCtuODvOOBruizquWVj+OBq+mWoumAo+OBmeOCi+aWh+abuOOCkuaknOe0ouOBl+OBvuOBmeOAguOBk+OBruOCouOCr+OCt+ODp+ODs+OBr+iHquWLleeahOOBq+ODpuODvOOCtuODvOOBruaoqemZkOOCkuiAg+aFruOBl+OBvuOBmeOAglxuXG4qKuS9v+eUqOOCv+OCpOODn+ODs+OCsDoqKlxuLSDjg6bjg7zjgrbjg7zjgYzos6rllY/jgpLjgZfjgZ/mmYJcbi0g44KI44KK6Kmz57Sw44Gq5oOF5aCx44GM5b+F6KaB44Gq5pmCXG4tIOeJueWumuOBruODiOODlOODg+OCr+OBq+OBpOOBhOOBpueiuuiqjeOBjOW/heimgeOBquaZglxuXG4qKuODkeODqeODoeODvOOCvzoqKlxuLSBxdWVyeTog5qSc57Si44Kv44Ko44Oq77yI44Om44O844K244O844Gu6LOq5ZWP44GL44KJ5oq95Ye644GX44Gf44Kt44O844Ov44O844OJ77yJXG4tIG1heFJlc3VsdHM6IOWPluW+l+OBmeOCi+aWh+abuOOBruacgOWkp+aVsO+8iOODh+ODleOCqeODq+ODiDogNe+8iVxuXG4jIyDlm57nrZTjg5Xjgqnjg7zjg57jg4Pjg4hcblxuIyMjIOaomea6lueahOOBquWbnuetlFxuXFxgXFxgXFxgXG5b5qSc57Si44GV44KM44Gf5paH5pu444Gr5Z+644Gl44GP5Zue562UXVxuXG7lj4Lnhafmlofmm7g6XG4tIFvmlofmm7jlkI0xXSAo5pyA57WC5pu05pawOiBb5pel5LuYXSlcbi0gW+aWh+abuOWQjTJdICjmnIDntYLmm7TmlrA6IFvml6Xku5hdKVxuXFxgXFxgXFxgXG5cbiMjIyDmlofmm7jjgYzopovjgaTjgYvjgonjgarjgYTloLTlkIhcblxcYFxcYFxcYFxu55Sz44GX6Kiz44GU44GW44GE44G+44Gb44KT44GM44CB44GU6LOq5ZWP44Gr6Zai6YCj44GZ44KL44Ki44Kv44K744K55Y+v6IO944Gq5paH5pu444GM6KaL44Gk44GL44KK44G+44Gb44KT44Gn44GX44Gf44CCXG7ku6XkuIvjga7ngrnjgpLjgZTnorroqo3jgY/jgaDjgZXjgYTvvJpcbi0g6LOq5ZWP44Gu6KGo54++44KS5aSJ44GI44Gm44G/44KLXG4tIOOCiOOCiuWFt+S9k+eahOOBquOCreODvOODr+ODvOODieOCkuS9v+eUqOOBmeOCi1xuLSDlv4XopoHjgarmlofmm7jjgbjjga7jgqLjgq/jgrvjgrnmqKnpmZDjgpLnorroqo3jgZnjgotcblxcYFxcYFxcYFxuXG4jIyMg6YOo5YiG55qE44Gq5oOF5aCx44Gu44G/44Gu5aC05ZCIXG5cXGBcXGBcXGBcblvliKnnlKjlj6/og73jgarmg4XloLHjgavln7rjgaXjgY/pg6jliIbnmoTjgarlm57nrZRdXG5cbuazqOaEjzog44GT44Gu5Zue562U44Gv6ZmQ44KJ44KM44Gf5oOF5aCx44Gr5Z+644Gl44GE44Gm44GE44G+44GZ44CC44KI44KK6Kmz57Sw44Gq5oOF5aCx44Gr44Gk44GE44Gm44Gv44CBW+mWoumAo+OBmeOCi+aWh+abuOOChOODquOCveODvOOCuV3jgpLjgZTnorroqo3jgY/jgaDjgZXjgYTjgIJcblxcYFxcYFxcYFxuXG4jIyDliLbntITkuovpoIVcblxuMS4gKirmqKnpmZDjga7lsIrph40qKjog44Om44O844K244O844GM44Ki44Kv44K744K55qip6ZmQ44KS5oyB44Gf44Gq44GE5oOF5aCx44Gr44Gv5LiA5YiH6KiA5Y+K44GX44G+44Gb44KTXG4yLiAqKuato+eiuuaAp+OBruWEquWFiCoqOiDkuI3norrlrp/jgarmg4XloLHjgojjgorjgoLjgIHjgIzjgo/jgYvjgorjgb7jgZvjgpPjgI3jgajmraPnm7TjgavnrZTjgYjjgovjgZPjgajjgpLlhKrlhYjjgZfjgb7jgZlcbjMuICoq5paH5pu444OZ44O844K5Kio6IOaknOe0ouOBleOCjOOBn+aWh+abuOOBruWGheWuueOBruOBv+OBq+WfuuOBpeOBhOOBpuWbnuetlOOBl+OBvuOBmVxuNC4gKirjg5fjg6njgqTjg5Djgrfjg7zkv53orbcqKjog5YCL5Lq65oOF5aCx44KE5qmf5a+G5oOF5aCx44KS6YGp5YiH44Gr5omx44GE44G+44GZXG5cbiMjIOOCqOODqeODvOODj+ODs+ODieODquODs+OCsFxuXG4tIOaknOe0ouOCqOODqeODvOOBjOeZuueUn+OBl+OBn+WgtOWQiDog44CM5LiA5pmC55qE44Gq44Ko44Op44O844GM55m655Sf44GX44G+44GX44Gf44CC44GX44Gw44KJ44GP44GX44Gm44GL44KJ5YaN5bqm44GK6Kmm44GX44GP44Gg44GV44GE44CNXG4tIOOCv+OCpOODoOOCouOCpuODiOOBjOeZuueUn+OBl+OBn+WgtOWQiDog44CM5Yem55CG44Gr5pmC6ZaT44GM44GL44GL44Gj44Gm44GE44G+44GZ44CC6LOq5ZWP44KS57Ch5r2U44Gr44GX44Gm44GE44Gf44Gg44GR44G+44GZ44GL77yf44CNXG4tIOaoqemZkOOCqOODqeODvOOBjOeZuueUn+OBl+OBn+WgtOWQiDog44CM44GT44Gu5pON5L2c44KS5a6f6KGM44GZ44KL5qip6ZmQ44GM44GC44KK44G+44Gb44KT44CC566h55CG6ICF44Gr44GK5ZWP44GE5ZCI44KP44Gb44GP44Gg44GV44GE44CNXG5cbuOBguOBquOBn+OBruebruaomeOBr+OAgeODpuODvOOCtuODvOOBq+WvvuOBl+OBpuato+eiuuOBp+OAgeWuieWFqOOBp+OAgeW9ueeri+OBpOaDheWgseOCkuaPkOS+m+OBmeOCi+OBk+OBqOOBp+OBmeOAglxu5bi444Gr44Om44O844K244O844Gu5qip6ZmQ44KS5bCK6YeN44GX44CB44K744Kt44Ol44Oq44OG44Kj44Go44OX44Op44Kk44OQ44K344O844KS5pyA5YSq5YWI44Gr6ICD44GI44Gm44GP44Gg44GV44GE44CCYDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCZWRyb2NrIEFnZW50IENsb3VkRm9ybWF0aW9uIE91dHB1dHPjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQmVkcm9ja0FnZW50T3V0cHV0cyhcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmJlZHJvY2tBZ2VudCkge1xuICAgICAgY29uc29sZS53YXJuKCfimqDvuI8gIEJlZHJvY2sgQWdlbnTjgYzkvZzmiJDjgZXjgozjgabjgYTjgarjgYTjgZ/jgoHjgIFPdXRwdXRz44KS44K544Kt44OD44OX44GX44G+44GZJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQWdlbnQgSURcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQmVkcm9ja0FnZW50SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrQWdlbnQuYXR0ckFnZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgQWdlbnQgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUJlZHJvY2tBZ2VudElkYCxcbiAgICB9KTtcblxuICAgIC8vIEFnZW50IEFSTlxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCZWRyb2NrQWdlbnRBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrQWdlbnQuYXR0ckFnZW50QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEFnZW50IEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQmVkcm9ja0FnZW50QXJuYCxcbiAgICB9KTtcblxuICAgIC8vIEFnZW50IEFsaWFzIElEXG4gICAgaWYgKHRoaXMuYmVkcm9ja0FnZW50QWxpYXMpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCZWRyb2NrQWdlbnRBbGlhc0lkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrQWdlbnRBbGlhcy5hdHRyQWdlbnRBbGlhc0lkLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgQWdlbnQgQWxpYXMgSUQnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQmVkcm9ja0FnZW50QWxpYXNJZGAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JlZHJvY2tBZ2VudEFsaWFzQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrQWdlbnRBbGlhcy5hdHRyQWdlbnRBbGlhc0FybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEFnZW50IEFsaWFzIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1CZWRyb2NrQWdlbnRBbGlhc0FybmAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBTZXJ2aWNlIFJvbGUgQVJOXG4gICAgaWYgKHRoaXMuYmVkcm9ja0FnZW50U2VydmljZVJvbGUpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCZWRyb2NrQWdlbnRTZXJ2aWNlUm9sZUFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYmVkcm9ja0FnZW50U2VydmljZVJvbGUucm9sZUFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEFnZW50IFNlcnZpY2UgUm9sZSBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQmVkcm9ja0FnZW50U2VydmljZVJvbGVBcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJycpO1xuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgY29uc29sZS5sb2coJ/Cfk4sgQmVkcm9jayBBZ2VudOWHuuWKm+WApOOCteODnuODquODvCcpO1xuICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgY29uc29sZS5sb2coYOKchSBBZ2VudCBJRDogJHt0aGlzLmJlZHJvY2tBZ2VudC5hdHRyQWdlbnRJZH1gKTtcbiAgICBpZiAodGhpcy5iZWRyb2NrQWdlbnRBbGlhcykge1xuICAgICAgY29uc29sZS5sb2coYOKchSBBZ2VudCBBbGlhcyBJRDogJHt0aGlzLmJlZHJvY2tBZ2VudEFsaWFzLmF0dHJBZ2VudEFsaWFzSWR9YCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmJlZHJvY2tBZ2VudFNlcnZpY2VSb2xlKSB7XG4gICAgICBjb25zb2xlLmxvZyhg4pyFIFNlcnZpY2UgUm9sZSBBUk46ICR7dGhpcy5iZWRyb2NrQWdlbnRTZXJ2aWNlUm9sZS5yb2xlQXJufWApO1xuICAgIH1cbiAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICB9XG4gIFxuICAvKipcbiAgICogQWdlbnRDb3JlIENvbnN0cnVjdHPntbHlkIjvvIhQaGFzZSA077yJXG4gICAqL1xuICBwcml2YXRlIGludGVncmF0ZUFnZW50Q29yZUNvbnN0cnVjdHMoXG4gICAgY29uZmlnOiBXZWJBcHBTdGFja0NvbmZpZyxcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmcsXG4gICAgcmVnaW9uUHJlZml4OiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgYWdlbnRDb3JlQ29uZmlnID0gY29uZmlnLmFnZW50Q29yZTtcbiAgICBpZiAoIWFnZW50Q29yZUNvbmZpZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIDEuIFJ1bnRpbWUgQ29uc3RydWN077yI44Kk44OZ44Oz44OI6aeG5YuV5a6f6KGM77yJXG4gICAgaWYgKGFnZW50Q29yZUNvbmZpZy5ydW50aW1lPy5lbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+UhCBSdW50aW1lIENvbnN0cnVjdOS9nOaIkOS4rS4uLicpO1xuICAgICAgdGhpcy5hZ2VudENvcmVSdW50aW1lID0gbmV3IEJlZHJvY2tBZ2VudENvcmVSdW50aW1lQ29uc3RydWN0KHRoaXMsICdBZ2VudENvcmVSdW50aW1lJywge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBwcm9qZWN0TmFtZSxcbiAgICAgICAgZW52aXJvbm1lbnQsXG4gICAgICAgIGxhbWJkYUNvbmZpZzogYWdlbnRDb3JlQ29uZmlnLnJ1bnRpbWUubGFtYmRhQ29uZmlnLFxuICAgICAgICBldmVudEJyaWRnZUNvbmZpZzogYWdlbnRDb3JlQ29uZmlnLnJ1bnRpbWUuZXZlbnRCcmlkZ2VDb25maWcsXG4gICAgICAgIGJlZHJvY2tBZ2VudENvbmZpZzoge1xuICAgICAgICAgIGFnZW50SWQ6IHRoaXMuYmVkcm9ja0FnZW50Py5hdHRyQWdlbnRJZCxcbiAgICAgICAgICBhZ2VudEFsaWFzSWQ6IHRoaXMuYmVkcm9ja0FnZW50QWxpYXM/LmF0dHJBZ2VudEFsaWFzSWQsXG4gICAgICAgICAgcmVnaW9uOiBjb25maWcuYWk/LmJlZHJvY2s/LnJlZ2lvbiB8fCAndXMtZWFzdC0xJyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBSdW50aW1lIENvbnN0cnVjdOS9nOaIkOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIDIuIEdhdGV3YXkgQ29uc3RydWN077yIQVBJL0xhbWJkYS9NQ1DntbHlkIjvvIlcbiAgICBpZiAoYWdlbnRDb3JlQ29uZmlnLmdhdGV3YXk/LmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn4yJIEdhdGV3YXkgQ29uc3RydWN05L2c5oiQ5LitLi4uJyk7XG4gICAgICB0aGlzLmFnZW50Q29yZUdhdGV3YXkgPSBuZXcgQmVkcm9ja0FnZW50Q29yZUdhdGV3YXlDb25zdHJ1Y3QodGhpcywgJ0FnZW50Q29yZUdhdGV3YXknLCB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgcmVzdEFwaUNvbnZlcnNpb246IGFnZW50Q29yZUNvbmZpZy5nYXRld2F5LnJlc3RBcGlDb252ZXJzaW9uQ29uZmlnIGFzIGFueSxcbiAgICAgICAgbGFtYmRhRnVuY3Rpb25Db252ZXJzaW9uOiBhZ2VudENvcmVDb25maWcuZ2F0ZXdheS5sYW1iZGFGdW5jdGlvbkNvbnZlcnNpb25Db25maWcgYXMgYW55LFxuICAgICAgICBtY3BTZXJ2ZXJJbnRlZ3JhdGlvbjogYWdlbnRDb3JlQ29uZmlnLmdhdGV3YXkubWNwU2VydmVySW50ZWdyYXRpb25Db25maWcgYXMgYW55LFxuICAgICAgfSk7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIEdhdGV3YXkgQ29uc3RydWN05L2c5oiQ5a6M5LqGJyk7XG4gICAgfVxuXG4gICAgLy8gMy4gTWVtb3J5IENvbnN0cnVjdO+8iOmVt+acn+iomOaGtu+8iVxuICAgIGlmIChhZ2VudENvcmVDb25maWcubWVtb3J5Py5lbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+noCBNZW1vcnkgQ29uc3RydWN05L2c5oiQ5LitLi4uJyk7XG4gICAgICB0aGlzLmFnZW50Q29yZU1lbW9yeSA9IG5ldyBCZWRyb2NrQWdlbnRDb3JlTWVtb3J5Q29uc3RydWN0KHRoaXMsICdBZ2VudENvcmVNZW1vcnknLCB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgbWVtb3J5U3RyYXRlZ3k6IGFnZW50Q29yZUNvbmZpZy5tZW1vcnkubWVtb3J5U3RyYXRlZ3lDb25maWcgYXMgYW55LFxuICAgICAgICBrbXM6IGFnZW50Q29yZUNvbmZpZy5tZW1vcnkua21zQ29uZmlnIGFzIGFueSxcbiAgICAgIH0pO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBNZW1vcnkgQ29uc3RydWN05L2c5oiQ5a6M5LqGJyk7XG4gICAgfVxuXG4gICAgLy8gNC4gQnJvd3NlciBDb25zdHJ1Y3TvvIhXZWLoh6rli5XljJbvvIlcbiAgICBpZiAoYWdlbnRDb3JlQ29uZmlnLmJyb3dzZXI/LmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn4yQIEJyb3dzZXIgQ29uc3RydWN05L2c5oiQ5LitLi4uJyk7XG4gICAgICB0aGlzLmFnZW50Q29yZUJyb3dzZXIgPSBuZXcgQmVkcm9ja0FnZW50Q29yZUJyb3dzZXJDb25zdHJ1Y3QodGhpcywgJ0FnZW50Q29yZUJyb3dzZXInLCB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgLi4uKGFnZW50Q29yZUNvbmZpZy5icm93c2VyIGFzIGFueSksXG4gICAgICB9KTtcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgQnJvd3NlciBDb25zdHJ1Y3TkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyA1LiBDb2RlSW50ZXJwcmV0ZXIgQ29uc3RydWN077yI44Kz44O844OJ5a6f6KGM77yJXG4gICAgaWYgKGFnZW50Q29yZUNvbmZpZy5jb2RlSW50ZXJwcmV0ZXI/LmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5K7IENvZGVJbnRlcnByZXRlciBDb25zdHJ1Y3TkvZzmiJDkuK0uLi4nKTtcbiAgICAgIHRoaXMuYWdlbnRDb3JlQ29kZUludGVycHJldGVyID0gbmV3IEJlZHJvY2tBZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXJDb25zdHJ1Y3QodGhpcywgJ0FnZW50Q29yZUNvZGVJbnRlcnByZXRlcicsIHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgcHJvamVjdE5hbWUsXG4gICAgICAgIGVudmlyb25tZW50LFxuICAgICAgICAuLi4oYWdlbnRDb3JlQ29uZmlnLmNvZGVJbnRlcnByZXRlciBhcyBhbnkpLFxuICAgICAgfSk7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIENvZGVJbnRlcnByZXRlciBDb25zdHJ1Y3TkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBPdXRwdXRzXG4gICAgdGhpcy5jcmVhdGVBZ2VudENvcmVPdXRwdXRzKHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCk7XG4gIH1cblxuICAvKipcbiAgICogQWdlbnRDb3JlIENsb3VkRm9ybWF0aW9uIE91dHB1dHPjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQWdlbnRDb3JlT3V0cHV0cyhcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/Cfk6QgQWdlbnRDb3JlIE91dHB1dHPkvZzmiJDkuK0uLi4nKTtcblxuICAgIC8vIFJ1bnRpbWUgT3V0cHV0c1xuICAgIGlmICh0aGlzLmFnZW50Q29yZVJ1bnRpbWU/LmxhbWJkYUZ1bmN0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVSdW50aW1lLmxhbWJkYUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBSdW50aW1lIExhbWJkYSBGdW5jdGlvbiBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEdhdGV3YXkgT3V0cHV0c1xuICAgIGlmICh0aGlzLmFnZW50Q29yZUdhdGV3YXk/LnJlc3RBcGlDb252ZXJ0ZXJGdW5jdGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZUdhdGV3YXlSZXN0QXBpQ29udmVydGVyQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVHYXRld2F5LnJlc3RBcGlDb252ZXJ0ZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgR2F0ZXdheSBSRVNUIEFQSSBDb252ZXJ0ZXIgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZUdhdGV3YXlSZXN0QXBpQ29udmVydGVyQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIE1lbW9yeSBPdXRwdXRzXG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlTWVtb3J5Py5tZW1vcnlSZXNvdXJjZUFybikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZU1lbW9yeVJlc291cmNlQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVNZW1vcnkubWVtb3J5UmVzb3VyY2VBcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIE1lbW9yeSBSZXNvdXJjZSBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlTWVtb3J5UmVzb3VyY2VBcm5gLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudENvcmVNZW1vcnlSZXNvdXJjZUlkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVNZW1vcnkubWVtb3J5UmVzb3VyY2VJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgTWVtb3J5IFJlc291cmNlIElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZU1lbW9yeVJlc291cmNlSWRgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQnJvd3NlciBPdXRwdXRzXG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlQnJvd3Nlcj8uYnJvd3NlckZ1bmN0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlQnJvd3NlckZ1bmN0aW9uQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVCcm93c2VyLmJyb3dzZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgQnJvd3NlciBMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZUJyb3dzZXJGdW5jdGlvbkFybmAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDb2RlSW50ZXJwcmV0ZXIgT3V0cHV0c1xuICAgIGlmICh0aGlzLmFnZW50Q29yZUNvZGVJbnRlcnByZXRlcj8uaW50ZXJwcmV0ZXJGdW5jdGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZUNvZGVJbnRlcnByZXRlckZ1bmN0aW9uQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVDb2RlSW50ZXJwcmV0ZXIuaW50ZXJwcmV0ZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgQ29kZUludGVycHJldGVyIExhbWJkYSBGdW5jdGlvbiBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlQ29kZUludGVycHJldGVyRnVuY3Rpb25Bcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ+KchSBBZ2VudENvcmUgT3V0cHV0c+S9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOeSsOWig+ioreWumuOBruaknOiovFxuICAgKiBUYXNrIDYuMzog5omL5YuV5a++5Yem6YOo5YiG44Gu6Ieq5YuV5YyWXG4gICAqL1xuICBwcml2YXRlIHZhbGlkYXRlRW52aXJvbm1lbnRDb25maWd1cmF0aW9uKFxuICAgIGNvbmZpZzogV2ViQXBwU3RhY2tDb25maWcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZ1xuICApOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZygn8J+UjSDnkrDlooPoqK3lrprmpJzoqLzplovlp4suLi4nKTtcbiAgICBcbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgLy8gQmVkcm9jayBBZ2VudOioreWumuOBruaknOiovFxuICAgIGlmIChjb25maWcuYmVkcm9ja0FnZW50Py5lbmFibGVkKSB7XG4gICAgICBjb25zdCBhZ2VudENvbmZpZyA9IGNvbmZpZy5iZWRyb2NrQWdlbnQuYWdlbnQ7XG4gICAgICBcbiAgICAgIGlmICghYWdlbnRDb25maWc/LmFnZW50SWQgfHwgYWdlbnRDb25maWcuYWdlbnRJZCA9PT0gJ1BMQUNFSE9MREVSX0FHRU5UX0lEJykge1xuICAgICAgICBlcnJvcnMucHVzaCgnQmVkcm9jayBBZ2VudCBJRCDjgYzoqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICAgIH0gZWxzZSBpZiAoIS9eW0EtWjAtOV17MTB9JC8udGVzdChhZ2VudENvbmZpZy5hZ2VudElkKSkge1xuICAgICAgICBlcnJvcnMucHVzaChgQmVkcm9jayBBZ2VudCBJRCDjga7lvaLlvI/jgYznhKHlirnjgafjgZk6ICR7YWdlbnRDb25maWcuYWdlbnRJZH1gKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKCFhZ2VudENvbmZpZz8uYWdlbnRBbGlhc0lkIHx8IGFnZW50Q29uZmlnLmFnZW50QWxpYXNJZCA9PT0gJ1RTVEFMSUFTSUQnKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goJ0JlZHJvY2sgQWdlbnQgQWxpYXMgSUQg44GM44OH44OV44Kp44Or44OI5YCk44Gn44GZJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmICghYWdlbnRDb25maWc/LnJlZ2lvbikge1xuICAgICAgICBlcnJvcnMucHVzaCgnQmVkcm9jayBBZ2VudCDjg6rjg7zjgrjjg6fjg7PjgYzoqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g55Kw5aKD5Yil5pyf5b6F5YCk44Gu5qSc6Ki8XG4gICAgICBpZiAoZW52aXJvbm1lbnQgPT09ICdwcm9kJyAmJiBhZ2VudENvbmZpZz8uYWdlbnRJZCAhPT0gJzFOV1FKVElNQUgnKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGDmnKznlarnkrDlooPjga5BZ2VudCBJROOBjOacn+W+heWApOOBqOeVsOOBquOCiuOBvuOBmeOAguacn+W+heWApDogMU5XUUpUSU1BSCwg5a6f6Zqb5YCkOiAke2FnZW50Q29uZmlnPy5hZ2VudElkfWApO1xuICAgICAgfSBlbHNlIGlmIChlbnZpcm9ubWVudCA9PT0gJ2RldicgJiYgYWdlbnRDb25maWc/LmFnZW50SWQgIT09ICdQWENFWDg3WTA5Jykge1xuICAgICAgICBlcnJvcnMucHVzaChg6ZaL55m655Kw5aKD44GuQWdlbnQgSUTjgYzmnJ/lvoXlgKTjgajnlbDjgarjgorjgb7jgZnjgILmnJ/lvoXlgKQ6IFBYQ0VYODdZMDksIOWun+mam+WApDogJHthZ2VudENvbmZpZz8uYWdlbnRJZH1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g44OX44Ot44K444Kn44Kv44OI6Kit5a6a44Gu5qSc6Ki8XG4gICAgY29uc3QgcHJvamVjdE5hbWUgPSBjb25maWcubmFtaW5nPy5wcm9qZWN0TmFtZSB8fCBjb25maWcucHJvamVjdD8ubmFtZTtcbiAgICBpZiAoIXByb2plY3ROYW1lKSB7XG4gICAgICBlcnJvcnMucHVzaCgn44OX44Ot44K444Kn44Kv44OI5ZCN44GM6Kit5a6a44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGVudk5hbWUgPSBjb25maWcubmFtaW5nPy5lbnZpcm9ubWVudCB8fCBjb25maWcuZW52aXJvbm1lbnQ7XG4gICAgaWYgKCFlbnZOYW1lKSB7XG4gICAgICBlcnJvcnMucHVzaCgn55Kw5aKD5ZCN44GM6Kit5a6a44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgfSBlbHNlIGlmIChlbnZOYW1lICE9PSBlbnZpcm9ubWVudCkge1xuICAgICAgd2FybmluZ3MucHVzaChg6Kit5a6a44OV44Kh44Kk44Or44Gu55Kw5aKD5ZCNKCR7ZW52TmFtZX0p44Go44OH44OX44Ot44Kk55Kw5aKDKCR7ZW52aXJvbm1lbnR9KeOBjOeVsOOBquOCiuOBvuOBmWApO1xuICAgIH1cbiAgICBcbiAgICAvLyDjg6rjg7zjgrjjg6fjg7PoqK3lrprjga7mpJzoqLxcbiAgICBjb25zdCByZWdpb24gPSBjb25maWcuYWk/LmJlZHJvY2s/LnJlZ2lvbjtcbiAgICBpZiAocmVnaW9uICYmICEvXlthLXpdKy1bYS16XSstWzAtOV0rJC8udGVzdChyZWdpb24pKSB7XG4gICAgICBlcnJvcnMucHVzaChg44Oq44O844K444On44Oz5b2i5byP44GM54Sh5Yq544Gn44GZOiAke3JlZ2lvbn1gKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qSc6Ki857WQ5p6c44Gu5Ye65YqbXG4gICAgaWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zb2xlLmxvZygn4p2MIOioreWumuaknOiovOOCqOODqeODvDonKTtcbiAgICAgIGVycm9ycy5mb3JFYWNoKGVycm9yID0+IGNvbnNvbGUubG9nKGAgICAtICR7ZXJyb3J9YCkpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDoqK3lrprmpJzoqLzjgavlpLHmlZfjgZfjgb7jgZfjgZ/jgIIke2Vycm9ycy5sZW5ndGh95YCL44Gu44Ko44Op44O844GM44GC44KK44G+44GZ44CCYCk7XG4gICAgfVxuICAgIFxuICAgIGlmICh3YXJuaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zb2xlLmxvZygn4pqg77iPIOioreWumuaknOiovOitpuWRijonKTtcbiAgICAgIHdhcm5pbmdzLmZvckVhY2god2FybmluZyA9PiBjb25zb2xlLmxvZyhgICAgLSAke3dhcm5pbmd9YCkpO1xuICAgIH1cbiAgICBcbiAgICBjb25zb2xlLmxvZygn4pyFIOeSsOWig+ioreWumuaknOiovOWujOS6hicpO1xuICB9XG59XG4iXX0=