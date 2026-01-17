"use strict";
/**
 * コンピュートコンストラクト
 *
 * Lambda、AWS Batch、ECSの統合管理を提供
 * 既存の監視・分析実装と自動スケーリング機能を統合
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
exports.ComputeConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const batch = __importStar(require("aws-cdk-lib/aws-batch"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
const applicationautoscaling = __importStar(require("aws-cdk-lib/aws-applicationautoscaling"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const constructs_1 = require("constructs");
const lambda_construct_factory_1 = require("./lambda-construct-factory");
const compute_config_builder_1 = require("./compute-config-builder");
const validation_chain_1 = require("./validation-chain");
/**
 * Lambda関数のデフォルト設定定数
 */
const LAMBDA_DEFAULTS = {
    RUNTIME: 'nodejs20.x',
    HANDLER: 'index.handler',
    ARCHITECTURE: lambda.Architecture.ARM_64,
    LOG_RETENTION_DAYS: logs.RetentionDays.TWO_WEEKS,
    WARMUP_INTERVAL_MINUTES: 5,
};
/**
 * ECRリポジトリ設定定数
 */
const ECR_DEFAULTS = {
    MAX_IMAGE_COUNT: 10,
    EMBEDDING_MAX_IMAGE_COUNT: 5,
    SCAN_ON_PUSH: true,
};
/**
 * 自動スケーリング設定定数
 */
const AUTO_SCALING_DEFAULTS = {
    MIN_CONCURRENCY: 10,
    MAX_CONCURRENCY: 1000,
    TARGET_UTILIZATION: 70,
    SCALE_OUT_COOLDOWN_SECONDS: 60,
    SCALE_IN_COOLDOWN_SECONDS: 300,
};
/**
 * Lambda関数設定ファクトリー
 */
class LambdaConfigFactory {
    projectName;
    environment;
    sessionTableName;
    constructor(projectName, environment, sessionTableName) {
        this.projectName = projectName;
        this.environment = environment;
        this.sessionTableName = sessionTableName;
    }
    /**
     * 基本設定を生成
     */
    createBaseConfig(functionType) {
        return {
            functionName: `${this.projectName}-${this.environment}-${functionType}`,
            runtime: 'nodejs20.x',
            handler: 'index.handler',
            environment: {
                PROJECT_NAME: this.projectName,
                ENVIRONMENT: this.environment,
            },
        };
    }
    /**
     * メトリクス収集Lambda設定
     */
    createMetricsCollectorConfig() {
        return {
            ...this.createBaseConfig('metrics-collector'),
            timeout: 300,
            memorySize: 512,
        };
    }
    /**
     * アラート処理Lambda設定
     */
    createAlertProcessorConfig() {
        return {
            ...this.createBaseConfig('alert-processor'),
            timeout: 180,
            memorySize: 256,
        };
    }
    /**
     * ML処理Lambda設定
     */
    createMLProcessorConfig() {
        return {
            ...this.createBaseConfig('ml-processor'),
            timeout: 900,
            memorySize: 1024,
        };
    }
    /**
     * テナント管理Lambda設定
     */
    createTenantManagerConfig() {
        const config = {
            ...this.createBaseConfig('tenant-manager'),
            timeout: 300,
            memorySize: 512,
        };
        if (this.sessionTableName) {
            config.environment.SESSION_TABLE = this.sessionTableName;
        }
        return config;
    }
}
class ComputeConstruct extends constructs_1.Construct {
    props;
    outputs;
    lambdaFunctions = {};
    lambdaRole;
    autoScalingTargets = {};
    batchComputeEnvironment;
    batchJobQueue;
    ecsCluster;
    ecrRepositories = {};
    constructor(scope, id, props) {
        super(scope, id);
        this.props = props;
        try {
            // 設定検証（Chain of Responsibility パターン）
            this.validateConfigurationWithChain();
            // Lambda実行ロール作成
            this.lambdaRole = this.createLambdaExecutionRole();
            // ECRリポジトリ作成
            this.createECRRepositories();
            // Lambda関数作成（Factory パターン）
            this.createLambdaFunctionsWithFactory();
            // AWS Batch設定
            if (this.props.config.batch?.enabled) {
                this.createBatchResources();
            }
            // ECS設定
            if (this.props.config.ecs?.enabled) {
                this.createECSResources();
            }
            // 自動スケーリング設定
            this.setupAutoScaling();
            // 出力値の設定
            this.outputs = this.createOutputs();
            // タグ設定
            this.applyTags();
            console.log(`✅ ComputeConstruct初期化完了: ${id}`);
        }
        catch (error) {
            console.error(`❌ ComputeConstruct初期化エラー: ${error}`);
            throw error;
        }
    }
    /**
     * 設定検証（Chain of Responsibility パターン）
     */
    validateConfigurationWithChain() {
        const validationResult = validation_chain_1.ConfigurationValidator.validate(this.props);
        // 検証結果をログ出力
        validation_chain_1.ConfigurationValidator.logValidationResult(validationResult);
        // エラーがある場合は例外をスロー
        if (!validationResult.isValid) {
            throw new Error(`設定検証に失敗しました: ${validationResult.errors.join(', ')}`);
        }
    }
    /**
     * 設定検証（従来版 - 後方互換性のため保持）
     * @deprecated validateConfigurationWithChain() を使用してください
     */
    validateConfiguration() {
        if (!this.props.projectName) {
            throw new Error('プロジェクト名が設定されていません');
        }
        if (!this.props.environment) {
            throw new Error('環境名が設定されていません');
        }
        if (!this.props.config) {
            throw new Error('コンピュート設定が設定されていません');
        }
    }
    /**
     * Lambda実行ロール作成
     */
    createLambdaExecutionRole() {
        const role = new iam.Role(this, 'LambdaExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: `Lambda execution role for ${this.props.projectName}`,
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // VPC設定が有効な場合
        if (this.props.config.lambda.common.vpcConfig?.enabled) {
            role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'));
        }
        // X-Ray設定が有効な場合
        if (this.props.config.lambda.common.enableXRayTracing) {
            role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'));
        }
        // S3アクセス権限
        if (this.props.documentsBucket) {
            this.props.documentsBucket.grantReadWrite(role);
        }
        if (this.props.embeddingsBucket) {
            this.props.embeddingsBucket.grantReadWrite(role);
        }
        // DynamoDBアクセス権限
        if (this.props.sessionTable) {
            this.props.sessionTable.grantReadWriteData(role);
        }
        // KMSアクセス権限
        if (this.props.kmsKey) {
            this.props.kmsKey.grantEncryptDecrypt(role);
        }
        // OpenSearchアクセス権限（将来実装）
        // if (this.props.openSearchCollection) {
        //   // OpenSearch Serverlessのアクセス権限を追加
        // }
        return role;
    }
    /**
     * ECRリポジトリ作成
     */
    createECRRepositories() {
        // Next.js用ECRリポジトリ
        this.ecrRepositories.nextjs = new ecr.Repository(this, 'NextjsRepository', {
            repositoryName: `${this.props.projectName}-${this.props.environment}-nextjs`,
            imageScanOnPush: ECR_DEFAULTS.SCAN_ON_PUSH,
            lifecycleRules: [{
                    maxImageCount: ECR_DEFAULTS.MAX_IMAGE_COUNT,
                    description: `Keep only ${ECR_DEFAULTS.MAX_IMAGE_COUNT} images`,
                }],
        });
        // Embedding用ECRリポジトリ
        this.ecrRepositories.embedding = new ecr.Repository(this, 'EmbeddingRepository', {
            repositoryName: `${this.props.projectName}-${this.props.environment}-embedding`,
            imageScanOnPush: ECR_DEFAULTS.SCAN_ON_PUSH,
            lifecycleRules: [{
                    maxImageCount: ECR_DEFAULTS.EMBEDDING_MAX_IMAGE_COUNT,
                    description: `Keep only ${ECR_DEFAULTS.EMBEDDING_MAX_IMAGE_COUNT} images`,
                }],
        });
    }
    /**
     * Lambda関数作成（Factory パターン）
     */
    createLambdaFunctionsWithFactory() {
        const functions = this.props.config.lambda.functions;
        // Lambda関数ファクトリーを初期化
        const strategy = new lambda_construct_factory_1.BasicLambdaStrategy(this.props.config.lambda.common.logRetention, this.props.config.lambda.common.architecture === 'arm64'
            ? lambda.Architecture.ARM_64
            : lambda.Architecture.X86_64);
        const factory = new lambda_construct_factory_1.LambdaFunctionFactory(strategy);
        // 基本RAG関数
        this.createBasicRAGFunctionsWithFactory(functions, factory);
        // 監視・分析統合関数
        this.createMonitoringAnalyticsFunctionsWithFactory(functions, factory);
    }
    /**
     * Lambda関数作成（従来版 - 後方互換性のため保持）
     * @deprecated createLambdaFunctionsWithFactory() を使用してください
     */
    createLambdaFunctions() {
        const functions = this.props.config.lambda.functions;
        // 基本RAG関数
        this.createBasicRAGFunctions(functions);
        // 監視・分析統合関数
        this.createMonitoringAnalyticsFunctions(functions);
    }
    /**
     * 基本RAG関数作成
     */
    createBasicRAGFunctions(functions) {
        // ドキュメント処理Lambda
        if (functions.documentProcessor.enabled) {
            this.lambdaFunctions.documentProcessor = this.createLambdaFunction('DocumentProcessor', {
                functionName: functions.documentProcessor.functionName ||
                    `${this.props.projectName}-${this.props.environment}-document-processor`,
                runtime: functions.documentProcessor.runtime,
                handler: functions.documentProcessor.handler,
                timeout: functions.documentProcessor.timeout,
                memorySize: functions.documentProcessor.memorySize,
                reservedConcurrency: functions.documentProcessor.reservedConcurrency,
                provisionedConcurrency: functions.documentProcessor.provisionedConcurrency,
                environment: {
                    ...functions.documentProcessor.environment,
                    DOCUMENTS_BUCKET: this.props.documentsBucket?.bucketName || '',
                    EMBEDDINGS_BUCKET: this.props.embeddingsBucket?.bucketName || '',
                    SESSION_TABLE: this.props.sessionTable?.tableName || '',
                },
                layers: functions.documentProcessor.layers,
                deadLetterQueue: functions.documentProcessor.deadLetterQueue,
            }, 'documentprocessor');
        }
        // 埋め込み生成Lambda
        if (functions.embeddingGenerator.enabled) {
            this.lambdaFunctions.embeddingGenerator = this.createLambdaFunction('EmbeddingGenerator', {
                functionName: functions.embeddingGenerator.functionName ||
                    `${this.props.projectName}-${this.props.environment}-embedding-generator`,
                runtime: functions.embeddingGenerator.runtime,
                handler: functions.embeddingGenerator.handler,
                timeout: functions.embeddingGenerator.timeout,
                memorySize: functions.embeddingGenerator.memorySize,
                reservedConcurrency: functions.embeddingGenerator.reservedConcurrency,
                provisionedConcurrency: functions.embeddingGenerator.provisionedConcurrency,
                environment: {
                    ...functions.embeddingGenerator.environment,
                    EMBEDDINGS_BUCKET: this.props.embeddingsBucket?.bucketName || '',
                },
                layers: functions.embeddingGenerator.layers,
            }, 'embeddinggenerator');
        }
        // クエリ処理Lambda
        if (functions.queryProcessor.enabled) {
            this.lambdaFunctions.queryProcessor = this.createLambdaFunction('QueryProcessor', {
                functionName: functions.queryProcessor.functionName ||
                    `${this.props.projectName}-${this.props.environment}-query-processor`,
                runtime: functions.queryProcessor.runtime,
                handler: functions.queryProcessor.handler,
                timeout: functions.queryProcessor.timeout,
                memorySize: functions.queryProcessor.memorySize,
                reservedConcurrency: functions.queryProcessor.reservedConcurrency,
                environment: {
                    ...functions.queryProcessor.environment,
                    SESSION_TABLE: this.props.sessionTable?.tableName || '',
                },
            }, 'queryprocessor');
        }
        // チャットハンドラーLambda
        if (functions.chatHandler.enabled) {
            this.lambdaFunctions.chatHandler = this.createLambdaFunction('ChatHandler', {
                functionName: functions.chatHandler.functionName ||
                    `${this.props.projectName}-${this.props.environment}-chat-handler`,
                runtime: functions.chatHandler.runtime,
                handler: functions.chatHandler.handler,
                timeout: functions.chatHandler.timeout,
                memorySize: functions.chatHandler.memorySize,
                environment: {
                    ...functions.chatHandler.environment,
                    SESSION_TABLE: this.props.sessionTable?.tableName || '',
                    DOCUMENTS_BUCKET: this.props.documentsBucket?.bucketName || '',
                },
            }, 'chathandler');
        }
        // 認証ハンドラーLambda
        if (functions.authHandler.enabled) {
            this.lambdaFunctions.authHandler = this.createLambdaFunction('AuthHandler', {
                functionName: functions.authHandler.functionName ||
                    `${this.props.projectName}-${this.props.environment}-auth-handler`,
                runtime: functions.authHandler.runtime,
                handler: functions.authHandler.handler,
                timeout: functions.authHandler.timeout,
                memorySize: functions.authHandler.memorySize,
                environment: {
                    ...functions.authHandler.environment,
                    SESSION_TABLE: this.props.sessionTable?.tableName || '',
                },
            }, 'authhandler');
        }
    }
    /**
     * 基本RAG関数作成（Factory パターン）
     */
    createBasicRAGFunctionsWithFactory(functions, factory) {
        // ドキュメント処理Lambda
        if (functions.documentProcessor?.enabled) {
            const config = compute_config_builder_1.LambdaConfigTemplates
                .heavyProcessing(`${this.props.projectName}-${this.props.environment}-document-processor`)
                .withRuntime(functions.documentProcessor.runtime)
                .withTimeout(functions.documentProcessor.timeout)
                .withMemorySize(functions.documentProcessor.memorySize)
                .addEnvironmentVariable('DOCUMENTS_BUCKET', this.props.documentsBucket?.bucketName || '')
                .addEnvironmentVariable('EMBEDDINGS_BUCKET', this.props.embeddingsBucket?.bucketName || '')
                .build();
            this.lambdaFunctions.documentProcessor = factory.createFunction(this, 'DocumentProcessor', config, this.lambdaRole);
        }
        // 埋め込み生成Lambda
        if (functions.embeddingGenerator?.enabled) {
            const config = compute_config_builder_1.LambdaConfigTemplates
                .heavyProcessing(`${this.props.projectName}-${this.props.environment}-embedding-generator`)
                .withRuntime(functions.embeddingGenerator.runtime)
                .withTimeout(functions.embeddingGenerator.timeout)
                .withMemorySize(functions.embeddingGenerator.memorySize)
                .addEnvironmentVariable('EMBEDDINGS_BUCKET', this.props.embeddingsBucket?.bucketName || '')
                .build();
            this.lambdaFunctions.embeddingGenerator = factory.createFunction(this, 'EmbeddingGenerator', config, this.lambdaRole);
        }
        // クエリ処理Lambda
        if (functions.queryProcessor?.enabled) {
            const config = compute_config_builder_1.LambdaConfigTemplates
                .realtime(`${this.props.projectName}-${this.props.environment}-query-processor`)
                .withRuntime(functions.queryProcessor.runtime)
                .withTimeout(functions.queryProcessor.timeout)
                .withMemorySize(functions.queryProcessor.memorySize)
                .addEnvironmentVariable('SESSION_TABLE', this.props.sessionTable?.tableName || '')
                .build();
            this.lambdaFunctions.queryProcessor = factory.createFunction(this, 'QueryProcessor', config, this.lambdaRole);
        }
        // チャットハンドラーLambda
        if (functions.chatHandler?.enabled) {
            const config = compute_config_builder_1.LambdaConfigTemplates
                .lightweightApi(`${this.props.projectName}-${this.props.environment}-chat-handler`)
                .withRuntime(functions.chatHandler.runtime)
                .withTimeout(functions.chatHandler.timeout)
                .withMemorySize(functions.chatHandler.memorySize)
                .addEnvironmentVariable('SESSION_TABLE', this.props.sessionTable?.tableName || '')
                .build();
            this.lambdaFunctions.chatHandler = factory.createFunction(this, 'ChatHandler', config, this.lambdaRole);
        }
        // 認証ハンドラーLambda
        if (functions.authHandler?.enabled) {
            const config = compute_config_builder_1.LambdaConfigTemplates
                .lightweightApi(`${this.props.projectName}-${this.props.environment}-auth-handler`)
                .withRuntime(functions.authHandler.runtime)
                .withTimeout(functions.authHandler.timeout)
                .withMemorySize(functions.authHandler.memorySize)
                .addEnvironmentVariable('SESSION_TABLE', this.props.sessionTable?.tableName || '')
                .build();
            this.lambdaFunctions.authHandler = factory.createFunction(this, 'AuthHandler', config, this.lambdaRole);
        }
    }
    /**
     * 監視・分析統合関数作成（Factory パターン）
     */
    createMonitoringAnalyticsFunctionsWithFactory(functions, factory) {
        if (!functions.monitoringAnalytics?.enabled)
            return;
        // メトリクス収集Lambda
        if (functions.monitoringAnalytics.metricsCollector?.enabled) {
            const config = compute_config_builder_1.LambdaConfigTemplates
                .lightweightApi(`${this.props.projectName}-${this.props.environment}-metrics-collector`)
                .withTimeout(300)
                .withMemorySize(512)
                .build();
            this.lambdaFunctions.metricsCollector = factory.createFunction(this, 'MetricsCollector', config, this.lambdaRole);
        }
        // アラート処理Lambda
        if (functions.monitoringAnalytics.alertProcessor?.enabled) {
            const config = compute_config_builder_1.LambdaConfigTemplates
                .lightweightApi(`${this.props.projectName}-${this.props.environment}-alert-processor`)
                .withTimeout(180)
                .withMemorySize(256)
                .build();
            this.lambdaFunctions.alertProcessor = factory.createFunction(this, 'AlertProcessor', config, this.lambdaRole);
        }
        // ML処理Lambda
        if (functions.monitoringAnalytics.mlProcessor?.enabled) {
            const config = compute_config_builder_1.LambdaConfigTemplates
                .heavyProcessing(`${this.props.projectName}-${this.props.environment}-ml-processor`)
                .withTimeout(900)
                .withMemorySize(1024)
                .build();
            this.lambdaFunctions.mlProcessor = factory.createFunction(this, 'MLProcessor', config, this.lambdaRole);
        }
        // テナント管理Lambda
        if (functions.monitoringAnalytics.tenantManager?.enabled) {
            const config = compute_config_builder_1.LambdaConfigTemplates
                .lightweightApi(`${this.props.projectName}-${this.props.environment}-tenant-manager`)
                .withTimeout(300)
                .withMemorySize(512)
                .addEnvironmentVariable('SESSION_TABLE', this.props.sessionTable?.tableName || '')
                .build();
            this.lambdaFunctions.tenantManager = factory.createFunction(this, 'TenantManager', config, this.lambdaRole);
        }
    }
    /**
     * 監視・分析統合関数作成（従来版 - 後方互換性のため保持）
     * @deprecated createMonitoringAnalyticsFunctionsWithFactory() を使用してください
     */
    createMonitoringAnalyticsFunctions(functions) {
        if (!functions.monitoringAnalytics?.enabled)
            return;
        this.createMetricsCollectorFunction();
        this.createAlertProcessorFunction();
        this.createMLProcessorFunction();
        this.createTenantManagerFunction();
    }
    /**
     * メトリクス収集Lambda関数作成
     */
    createMetricsCollectorFunction() {
        const configFactory = new LambdaConfigFactory(this.props.projectName, this.props.environment, this.props.sessionTable?.tableName);
        const config = configFactory.createMetricsCollectorConfig();
        this.lambdaFunctions.metricsCollector = this.createLambdaFunction('MetricsCollector', config, 'metrics-collector');
    }
    /**
     * アラート処理Lambda関数作成
     */
    createAlertProcessorFunction() {
        const configFactory = new LambdaConfigFactory(this.props.projectName, this.props.environment, this.props.sessionTable?.tableName);
        const config = configFactory.createAlertProcessorConfig();
        this.lambdaFunctions.alertProcessor = this.createLambdaFunction('AlertProcessor', config, 'alert-processor');
    }
    /**
     * ML処理Lambda関数作成
     */
    createMLProcessorFunction() {
        const configFactory = new LambdaConfigFactory(this.props.projectName, this.props.environment, this.props.sessionTable?.tableName);
        const config = configFactory.createMLProcessorConfig();
        this.lambdaFunctions.mlProcessor = this.createLambdaFunction('MLProcessor', config, 'ml-processor');
    }
    /**
     * テナント管理Lambda関数作成
     */
    createTenantManagerFunction() {
        const configFactory = new LambdaConfigFactory(this.props.projectName, this.props.environment, this.props.sessionTable?.tableName);
        const config = configFactory.createTenantManagerConfig();
        this.lambdaFunctions.tenantManager = this.createLambdaFunction('TenantManager', config, 'tenant-manager');
    }
    /**
     * Lambda関数作成ヘルパー
     */
    createLambdaFunction(id, config, codeDir) {
        // ロググループ作成
        const logGroup = new logs.LogGroup(this, `${id}LogGroup`, {
            logGroupName: `/aws/lambda/${config.functionName}`,
            retention: this.props.config.lambda.common.logRetention,
            removalPolicy: this.props.environment === 'prod'
                ? cdk.RemovalPolicy.RETAIN
                : cdk.RemovalPolicy.DESTROY,
        });
        // コードディレクトリの決定
        const codePath = codeDir ? `lambda/${codeDir}` : `lambda/${id.toLowerCase()}`;
        // Lambda関数作成
        const lambdaFunction = new lambda.Function(this, id, {
            functionName: config.functionName,
            runtime: this.getLambdaRuntime(config.runtime),
            handler: config.handler,
            code: lambda.Code.fromAsset(codePath),
            timeout: cdk.Duration.seconds(config.timeout),
            memorySize: config.memorySize,
            role: this.lambdaRole,
            environment: config.environment,
            logGroup,
            architecture: this.props.config.lambda.common.architecture === 'arm64'
                ? lambda.Architecture.ARM_64
                : lambda.Architecture.X86_64,
            tracing: this.props.config.lambda.common.enableXRayTracing
                ? lambda.Tracing.ACTIVE
                : lambda.Tracing.DISABLED,
            insightsVersion: this.props.config.lambda.common.enableInsights
                ? lambda.LambdaInsightsVersion.VERSION_1_0_229_0
                : undefined,
            reservedConcurrentExecutions: config.reservedConcurrency,
            vpc: this.props.config.lambda.common.vpcConfig?.enabled ? this.props.vpc : undefined,
            vpcSubnets: this.props.config.lambda.common.vpcConfig?.enabled && this.props.privateSubnetIds ? {
                subnets: this.props.privateSubnetIds.map(id => ec2.Subnet.fromSubnetId(this, `Subnet${id}`, id))
            } : undefined,
        });
        // VPC設定
        if (this.props.config.lambda.common.vpcConfig?.enabled && this.props.vpc) {
            // VPC設定は関数作成時に設定する必要があるため、ここでは省略
            // 実際の実装では、Lambda関数作成時にvpcConfigを設定
        }
        // プロビジョニング済み同時実行数設定
        if (config.provisionedConcurrency) {
            const version = lambdaFunction.currentVersion;
            const alias = new lambda.Alias(this, `${id}Alias`, {
                aliasName: 'live',
                version,
            });
            // プロビジョニング済み同時実行数を別途設定（将来実装）
            // 現在のCDKバージョンでは直接サポートされていないため、コメントアウト
            // new cdk.CfnResource(this, `${id}ProvisionedConcurrency`, {
            //   type: 'AWS::Lambda::ProvisionedConcurrencyConfig',
            //   properties: {
            //     FunctionName: lambdaFunction.functionName,
            //     Qualifier: alias.aliasName,
            //     ProvisionedConcurrencyConfig: config.provisionedConcurrency,
            //   },
            // });
        }
        // デッドレターキュー設定
        if (config.deadLetterQueue) {
            // SQSデッドレターキューの実装（将来実装）
        }
        return lambdaFunction;
    }
    /**
     * AWS Batchリソース作成
     */
    createBatchResources() {
        if (!this.props.config.batch.enabled)
            return;
        const batchConfig = this.props.config.batch;
        // Batch用IAMロール
        const batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
            assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
            ],
        });
        const batchInstanceRole = new iam.Role(this, 'BatchInstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'),
            ],
        });
        const batchInstanceProfile = new iam.CfnInstanceProfile(this, 'BatchInstanceProfile', {
            roles: [batchInstanceRole.roleName],
        });
        // コンピュート環境作成
        if (batchConfig.computeEnvironment) {
            const batchComputeEnvironment = new batch.CfnComputeEnvironment(this, 'BatchComputeEnvironment', {
                computeEnvironmentName: batchConfig.computeEnvironment.name ||
                    `${this.props.projectName}-${this.props.environment}-compute-env`,
                serviceRole: batchServiceRole.roleArn,
                type: batchConfig.computeEnvironment.type,
                state: batchConfig.computeEnvironment.state,
            });
            // ジョブキュー作成
            if (batchConfig.jobQueue) {
                const batchJobQueue = new batch.CfnJobQueue(this, 'BatchJobQueue', {
                    jobQueueName: batchConfig.jobQueue.name ||
                        `${this.props.projectName}-${this.props.environment}-job-queue`,
                    priority: batchConfig.jobQueue.priority,
                    computeEnvironmentOrder: [{
                            computeEnvironment: batchComputeEnvironment.ref,
                            order: 1,
                        }],
                });
            }
        }
    }
    /**
     * ECSリソース作成
     */
    createECSResources() {
        if (!this.props.config.ecs.enabled)
            return;
        const ecsConfig = this.props.config.ecs;
        // ECSクラスター作成
        if (ecsConfig.cluster) {
            const ecsCluster = new ecs.Cluster(this, 'ECSCluster', {
                clusterName: ecsConfig.cluster.name ||
                    `${this.props.projectName}-${this.props.environment}-cluster`,
                vpc: this.props.vpc,
                containerInsights: ecsConfig.cluster.enableContainerInsights,
            });
            // キャパシティプロバイダー設定
            if (ecsConfig.cluster.capacityProviders.includes('FARGATE')) {
                ecsCluster.addCapacity('FargateCapacity', {
                    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
                    minCapacity: 0,
                    maxCapacity: 10,
                });
            }
        }
    }
    /**
     * 自動スケーリング設定
     */
    setupAutoScaling() {
        if (!this.props.config.lambda.common.enableAutoScaling)
            return;
        Object.entries(this.lambdaFunctions).forEach(([name, lambdaFunction]) => {
            const autoScalingConfig = this.props.config.lambda.autoScaling || {
                minConcurrency: 10,
                maxConcurrency: 1000,
                targetUtilization: 70,
                scaleOutCooldown: 60,
                scaleInCooldown: 300,
            };
            // プロビジョニング済み同時実行数の設定
            const alias = lambdaFunction.addAlias('live');
            // Application Auto Scalingターゲット設定
            const scalingTarget = new applicationautoscaling.ScalableTarget(this, `${name}ScalingTarget`, {
                serviceNamespace: applicationautoscaling.ServiceNamespace.LAMBDA,
                scalableDimension: 'lambda:function:ProvisionedConcurrency',
                resourceId: `function:${lambdaFunction.functionName}:live`,
                minCapacity: autoScalingConfig.minConcurrency,
                maxCapacity: autoScalingConfig.maxConcurrency,
            });
            this.autoScalingTargets[name] = scalingTarget;
            // CloudWatchメトリクス設定
            const utilizationMetric = new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'ProvisionedConcurrencyUtilization',
                dimensionsMap: {
                    FunctionName: lambdaFunction.functionName,
                    Resource: `${lambdaFunction.functionName}:live`,
                },
                statistic: 'Average',
                period: cdk.Duration.minutes(1),
            });
            // ターゲット追跡スケーリングポリシー
            scalingTarget.scaleToTrackMetric(`${name}ScalingPolicy`, {
                targetValue: autoScalingConfig.targetUtilization,
                predefinedMetric: applicationautoscaling.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
                scaleOutCooldown: cdk.Duration.seconds(autoScalingConfig.scaleOutCooldown),
                scaleInCooldown: cdk.Duration.seconds(autoScalingConfig.scaleInCooldown),
            });
            // ウォームアップ設定（コールドスタート削減）
            if (this.props.config.lambda.common.enableWarmup) {
                const warmupRule = new events.Rule(this, `${name}WarmupRule`, {
                    schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
                    description: `Lambda関数のウォームアップ - ${lambdaFunction.functionName}`,
                });
                warmupRule.addTarget(new targets.LambdaFunction(alias, {
                    event: events.RuleTargetInput.fromObject({
                        source: 'warmup',
                        action: 'ping',
                        timestamp: events.RuleTargetInput.fromText('$.time'),
                    }),
                }));
            }
        });
    }
    /**
     * Lambda Runtime変換
     */
    getLambdaRuntime(runtime) {
        switch (runtime) {
            case 'nodejs18.x':
                return lambda.Runtime.NODEJS_18_X;
            case 'nodejs20.x':
                return lambda.Runtime.NODEJS_20_X;
            case 'python3.9':
                return lambda.Runtime.PYTHON_3_9;
            case 'python3.10':
                return lambda.Runtime.PYTHON_3_10;
            case 'python3.11':
                return lambda.Runtime.PYTHON_3_11;
            case 'python3.12':
                return lambda.Runtime.PYTHON_3_12;
            default:
                return lambda.Runtime.NODEJS_20_X;
        }
    }
    /**
     * 出力値作成
     */
    createOutputs() {
        return {
            // Lambda出力
            documentProcessorArn: this.lambdaFunctions.documentProcessor?.functionArn,
            embeddingGeneratorArn: this.lambdaFunctions.embeddingGenerator?.functionArn,
            queryProcessorArn: this.lambdaFunctions.queryProcessor?.functionArn,
            chatHandlerArn: this.lambdaFunctions.chatHandler?.functionArn,
            authHandlerArn: this.lambdaFunctions.authHandler?.functionArn,
            // 監視・分析 Lambda出力
            metricsCollectorArn: this.lambdaFunctions.metricsCollector?.functionArn,
            alertProcessorArn: this.lambdaFunctions.alertProcessor?.functionArn,
            mlProcessorArn: this.lambdaFunctions.mlProcessor?.functionArn,
            tenantManagerArn: this.lambdaFunctions.tenantManager?.functionArn,
            // AWS Batch出力
            batchComputeEnvironmentArn: this.batchComputeEnvironment?.attrComputeEnvironmentArn,
            batchJobQueueArn: this.batchJobQueue?.ref,
            // ECS出力
            ecsClusterArn: this.ecsCluster?.clusterArn,
            ecsServiceArns: [], // 将来実装
            // ECR出力
            nextjsRepositoryUri: this.ecrRepositories.nextjs?.repositoryUri,
            embeddingRepositoryUri: this.ecrRepositories.embedding?.repositoryUri,
        };
    }
    /**
     * タグ適用（IAM制限対応）
     */
    applyTags() {
        const tags = this.props.config.tags;
        // 最重要タグのみ（IAM制限対応）
        cdk.Tags.of(this).add('ComputeType', tags.ComputeType);
    }
}
exports.ComputeConstruct = ComputeConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjb21wdXRlLWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCwyREFBNkM7QUFDN0MseURBQTJDO0FBQzNDLHlEQUEyQztBQUkzQyw2REFBK0M7QUFDL0MseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQywrRkFBaUY7QUFDakYsdUVBQXlEO0FBQ3pELCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFDMUQsMkNBQXVDO0FBRXZDLHlFQUF3RjtBQUN4RixxRUFBc0Y7QUFDdEYseURBQTREO0FBRTVEOztHQUVHO0FBQ0gsTUFBTSxlQUFlLEdBQUc7SUFDdEIsT0FBTyxFQUFFLFlBQXFCO0lBQzlCLE9BQU8sRUFBRSxlQUF3QjtJQUNqQyxZQUFZLEVBQUUsTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNO0lBQ3hDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUztJQUNoRCx1QkFBdUIsRUFBRSxDQUFDO0NBQ2xCLENBQUM7QUFFWDs7R0FFRztBQUNILE1BQU0sWUFBWSxHQUFHO0lBQ25CLGVBQWUsRUFBRSxFQUFFO0lBQ25CLHlCQUF5QixFQUFFLENBQUM7SUFDNUIsWUFBWSxFQUFFLElBQUk7Q0FDVixDQUFDO0FBRVg7O0dBRUc7QUFDSCxNQUFNLHFCQUFxQixHQUFHO0lBQzVCLGVBQWUsRUFBRSxFQUFFO0lBQ25CLGVBQWUsRUFBRSxJQUFJO0lBQ3JCLGtCQUFrQixFQUFFLEVBQUU7SUFDdEIsMEJBQTBCLEVBQUUsRUFBRTtJQUM5Qix5QkFBeUIsRUFBRSxHQUFHO0NBQ3RCLENBQUM7QUFjWDs7R0FFRztBQUNILE1BQU0sbUJBQW1CO0lBRWI7SUFDQTtJQUNBO0lBSFYsWUFDVSxXQUFtQixFQUNuQixXQUFtQixFQUNuQixnQkFB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SUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDekQsQ0FBQztDQUNGO0FBenpCRCw0Q0F5ekJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDjgrPjg7Pjg5Tjg6Xjg7zjg4jjgrPjg7Pjgrnjg4jjg6njgq/jg4hcbiAqIFxuICogTGFtYmRh44CBQVdTIEJhdGNo44CBRUNT44Gu57Wx5ZCI566h55CG44KS5o+Q5L6bXG4gKiDml6LlrZjjga7nm6Poppbjg7vliIbmnpDlrp/oo4Xjgajoh6rli5XjgrnjgrHjg7zjg6rjg7PjgrDmqZ/og73jgpLntbHlkIhcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBrbXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWttcyc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGJhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iYXRjaCc7XG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XG5pbXBvcnQgKiBhcyBlY3IgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcic7XG5pbXBvcnQgKiBhcyBhcHBsaWNhdGlvbmF1dG9zY2FsaW5nIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcHBsaWNhdGlvbmF1dG9zY2FsaW5nJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBDb21wdXRlQ29uZmlnLCBDb21wdXRlT3V0cHV0cywgTGFtYmRhRnVuY3Rpb25Db25maWcsIExhbWJkYUF1dG9TY2FsaW5nQ29uZmlnIH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9jb21wdXRlLWNvbmZpZyc7XG5pbXBvcnQgeyBMYW1iZGFGdW5jdGlvbkZhY3RvcnksIEJhc2ljTGFtYmRhU3RyYXRlZ3kgfSBmcm9tICcuL2xhbWJkYS1jb25zdHJ1Y3QtZmFjdG9yeSc7XG5pbXBvcnQgeyBMYW1iZGFDb25maWdCdWlsZGVyLCBMYW1iZGFDb25maWdUZW1wbGF0ZXMgfSBmcm9tICcuL2NvbXB1dGUtY29uZmlnLWJ1aWxkZXInO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblZhbGlkYXRvciB9IGZyb20gJy4vdmFsaWRhdGlvbi1jaGFpbic7XG5cbi8qKlxuICogTGFtYmRh6Zai5pWw44Gu44OH44OV44Kp44Or44OI6Kit5a6a5a6a5pWwXG4gKi9cbmNvbnN0IExBTUJEQV9ERUZBVUxUUyA9IHtcbiAgUlVOVElNRTogJ25vZGVqczIwLngnIGFzIGNvbnN0LFxuICBIQU5ETEVSOiAnaW5kZXguaGFuZGxlcicgYXMgY29uc3QsXG4gIEFSQ0hJVEVDVFVSRTogbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQsXG4gIExPR19SRVRFTlRJT05fREFZUzogbG9ncy5SZXRlbnRpb25EYXlzLlRXT19XRUVLUyxcbiAgV0FSTVVQX0lOVEVSVkFMX01JTlVURVM6IDUsXG59IGFzIGNvbnN0O1xuXG4vKipcbiAqIEVDUuODquODneOCuOODiOODquioreWumuWumuaVsFxuICovXG5jb25zdCBFQ1JfREVGQVVMVFMgPSB7XG4gIE1BWF9JTUFHRV9DT1VOVDogMTAsXG4gIEVNQkVERElOR19NQVhfSU1BR0VfQ09VTlQ6IDUsXG4gIFNDQU5fT05fUFVTSDogdHJ1ZSxcbn0gYXMgY29uc3Q7XG5cbi8qKlxuICog6Ieq5YuV44K544Kx44O844Oq44Oz44Kw6Kit5a6a5a6a5pWwXG4gKi9cbmNvbnN0IEFVVE9fU0NBTElOR19ERUZBVUxUUyA9IHtcbiAgTUlOX0NPTkNVUlJFTkNZOiAxMCxcbiAgTUFYX0NPTkNVUlJFTkNZOiAxMDAwLFxuICBUQVJHRVRfVVRJTElaQVRJT046IDcwLFxuICBTQ0FMRV9PVVRfQ09PTERPV05fU0VDT05EUzogNjAsXG4gIFNDQUxFX0lOX0NPT0xET1dOX1NFQ09ORFM6IDMwMCxcbn0gYXMgY29uc3Q7XG5cbi8qKlxuICogTGFtYmRh6Zai5pWw6Kit5a6a44Gu44OZ44O844K544Kk44Oz44K/44O844OV44Kn44O844K5XG4gKi9cbmludGVyZmFjZSBCYXNlTGFtYmRhQ29uZmlnIHtcbiAgZnVuY3Rpb25OYW1lOiBzdHJpbmc7XG4gIHJ1bnRpbWU6IHN0cmluZztcbiAgaGFuZGxlcjogc3RyaW5nO1xuICB0aW1lb3V0OiBudW1iZXI7XG4gIG1lbW9yeVNpemU6IG51bWJlcjtcbiAgZW52aXJvbm1lbnQ6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH07XG59XG5cbi8qKlxuICogTGFtYmRh6Zai5pWw6Kit5a6a44OV44Kh44Kv44OI44Oq44O8XG4gKi9cbmNsYXNzIExhbWJkYUNvbmZpZ0ZhY3Rvcnkge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgcHJpdmF0ZSBlbnZpcm9ubWVudDogc3RyaW5nLFxuICAgIHByaXZhdGUgc2Vzc2lvblRhYmxlTmFtZT86IHN0cmluZ1xuICApIHt9XG5cbiAgLyoqXG4gICAqIOWfuuacrOioreWumuOCkueUn+aIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVCYXNlQ29uZmlnKGZ1bmN0aW9uVHlwZTogc3RyaW5nKTogUGFydGlhbDxCYXNlTGFtYmRhQ29uZmlnPiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7dGhpcy5wcm9qZWN0TmFtZX0tJHt0aGlzLmVudmlyb25tZW50fS0ke2Z1bmN0aW9uVHlwZX1gLFxuICAgICAgcnVudGltZTogJ25vZGVqczIwLngnLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUFJPSkVDVF9OQU1FOiB0aGlzLnByb2plY3ROYW1lLFxuICAgICAgICBFTlZJUk9OTUVOVDogdGhpcy5lbnZpcm9ubWVudCxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6Hjg4jjg6rjgq/jgrnlj47pm4ZMYW1iZGHoqK3lrppcbiAgICovXG4gIGNyZWF0ZU1ldHJpY3NDb2xsZWN0b3JDb25maWcoKTogQmFzZUxhbWJkYUNvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLnRoaXMuY3JlYXRlQmFzZUNvbmZpZygnbWV0cmljcy1jb2xsZWN0b3InKSxcbiAgICAgIHRpbWVvdXQ6IDMwMCxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9IGFzIEJhc2VMYW1iZGFDb25maWc7XG4gIH1cblxuICAvKipcbiAgICog44Ki44Op44O844OI5Yem55CGTGFtYmRh6Kit5a6aXG4gICAqL1xuICBjcmVhdGVBbGVydFByb2Nlc3NvckNvbmZpZygpOiBCYXNlTGFtYmRhQ29uZmlnIHtcbiAgICByZXR1cm4ge1xuICAgICAgLi4udGhpcy5jcmVhdGVCYXNlQ29uZmlnKCdhbGVydC1wcm9jZXNzb3InKSxcbiAgICAgIHRpbWVvdXQ6IDE4MCxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICB9IGFzIEJhc2VMYW1iZGFDb25maWc7XG4gIH1cblxuICAvKipcbiAgICogTUzlh6bnkIZMYW1iZGHoqK3lrppcbiAgICovXG4gIGNyZWF0ZU1MUHJvY2Vzc29yQ29uZmlnKCk6IEJhc2VMYW1iZGFDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICAuLi50aGlzLmNyZWF0ZUJhc2VDb25maWcoJ21sLXByb2Nlc3NvcicpLFxuICAgICAgdGltZW91dDogOTAwLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICB9IGFzIEJhc2VMYW1iZGFDb25maWc7XG4gIH1cblxuICAvKipcbiAgICog44OG44OK44Oz44OI566h55CGTGFtYmRh6Kit5a6aXG4gICAqL1xuICBjcmVhdGVUZW5hbnRNYW5hZ2VyQ29uZmlnKCk6IEJhc2VMYW1iZGFDb25maWcge1xuICAgIGNvbnN0IGNvbmZpZyA9IHtcbiAgICAgIC4uLnRoaXMuY3JlYXRlQmFzZUNvbmZpZygndGVuYW50LW1hbmFnZXInKSxcbiAgICAgIHRpbWVvdXQ6IDMwMCxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9IGFzIEJhc2VMYW1iZGFDb25maWc7XG5cbiAgICBpZiAodGhpcy5zZXNzaW9uVGFibGVOYW1lKSB7XG4gICAgICBjb25maWcuZW52aXJvbm1lbnQuU0VTU0lPTl9UQUJMRSA9IHRoaXMuc2Vzc2lvblRhYmxlTmFtZTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29uZmlnO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcHV0ZUNvbnN0cnVjdFByb3BzIHtcbiAgY29uZmlnOiBDb21wdXRlQ29uZmlnO1xuICBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICB2cGM/OiBlYzIuSVZwYztcbiAga21zS2V5Pzoga21zLklLZXk7XG4gIHByaXZhdGVTdWJuZXRJZHM/OiBzdHJpbmdbXTtcbiAgZG9jdW1lbnRzQnVja2V0PzogczMuSUJ1Y2tldDtcbiAgZW1iZWRkaW5nc0J1Y2tldD86IHMzLklCdWNrZXQ7XG4gIHNlc3Npb25UYWJsZT86IGR5bmFtb2RiLklUYWJsZTtcbiAgb3BlblNlYXJjaENvbGxlY3Rpb24/OiBhbnk7XG59XG5cbmV4cG9ydCBjbGFzcyBDb21wdXRlQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IG91dHB1dHM6IENvbXB1dGVPdXRwdXRzO1xuICBwdWJsaWMgcmVhZG9ubHkgbGFtYmRhRnVuY3Rpb25zOiB7IFtrZXk6IHN0cmluZ106IGxhbWJkYS5GdW5jdGlvbiB9ID0ge307XG4gIHB1YmxpYyByZWFkb25seSBsYW1iZGFSb2xlOiBpYW0uUm9sZTtcbiAgcHVibGljIHJlYWRvbmx5IGF1dG9TY2FsaW5nVGFyZ2V0czogeyBba2V5OiBzdHJpbmddOiBhcHBsaWNhdGlvbmF1dG9zY2FsaW5nLlNjYWxhYmxlVGFyZ2V0IH0gPSB7fTtcbiAgcHVibGljIHJlYWRvbmx5IGJhdGNoQ29tcHV0ZUVudmlyb25tZW50PzogYmF0Y2guQ2ZuQ29tcHV0ZUVudmlyb25tZW50O1xuICBwdWJsaWMgcmVhZG9ubHkgYmF0Y2hKb2JRdWV1ZT86IGJhdGNoLkNmbkpvYlF1ZXVlO1xuICBwdWJsaWMgcmVhZG9ubHkgZWNzQ2x1c3Rlcj86IGVjcy5DbHVzdGVyO1xuICBwdWJsaWMgcmVhZG9ubHkgZWNyUmVwb3NpdG9yaWVzOiB7IFtrZXk6IHN0cmluZ106IGVjci5SZXBvc2l0b3J5IH0gPSB7fTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcml2YXRlIHByb3BzOiBDb21wdXRlQ29uc3RydWN0UHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIOioreWumuaknOiovO+8iENoYWluIG9mIFJlc3BvbnNpYmlsaXR5IOODkeOCv+ODvOODs++8iVxuICAgICAgdGhpcy52YWxpZGF0ZUNvbmZpZ3VyYXRpb25XaXRoQ2hhaW4oKTtcblxuICAgICAgLy8gTGFtYmRh5a6f6KGM44Ot44O844Or5L2c5oiQXG4gICAgICB0aGlzLmxhbWJkYVJvbGUgPSB0aGlzLmNyZWF0ZUxhbWJkYUV4ZWN1dGlvblJvbGUoKTtcblxuICAgICAgLy8gRUNS44Oq44Od44K444OI44Oq5L2c5oiQXG4gICAgICB0aGlzLmNyZWF0ZUVDUlJlcG9zaXRvcmllcygpO1xuXG4gICAgICAvLyBMYW1iZGHplqLmlbDkvZzmiJDvvIhGYWN0b3J5IOODkeOCv+ODvOODs++8iVxuICAgICAgdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbnNXaXRoRmFjdG9yeSgpO1xuXG4gICAgICAvLyBBV1MgQmF0Y2joqK3lrppcbiAgICAgIGlmICh0aGlzLnByb3BzLmNvbmZpZy5iYXRjaD8uZW5hYmxlZCkge1xuICAgICAgICB0aGlzLmNyZWF0ZUJhdGNoUmVzb3VyY2VzKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIEVDU+ioreWumlxuICAgICAgaWYgKHRoaXMucHJvcHMuY29uZmlnLmVjcz8uZW5hYmxlZCkge1xuICAgICAgICB0aGlzLmNyZWF0ZUVDU1Jlc291cmNlcygpO1xuICAgICAgfVxuXG4gICAgICAvLyDoh6rli5XjgrnjgrHjg7zjg6rjg7PjgrDoqK3lrppcbiAgICAgIHRoaXMuc2V0dXBBdXRvU2NhbGluZygpO1xuXG4gICAgICAvLyDlh7rlipvlgKTjga7oqK3lrppcbiAgICAgIHRoaXMub3V0cHV0cyA9IHRoaXMuY3JlYXRlT3V0cHV0cygpO1xuXG4gICAgICAvLyDjgr/jgrDoqK3lrppcbiAgICAgIHRoaXMuYXBwbHlUYWdzKCk7XG5cbiAgICAgIGNvbnNvbGUubG9nKGDinIUgQ29tcHV0ZUNvbnN0cnVjdOWIneacn+WMluWujOS6hjogJHtpZH1gKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihg4p2MIENvbXB1dGVDb25zdHJ1Y3TliJ3mnJ/ljJbjgqjjg6njg7w6ICR7ZXJyb3J9YCk7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog6Kit5a6a5qSc6Ki877yIQ2hhaW4gb2YgUmVzcG9uc2liaWxpdHkg44OR44K/44O844Oz77yJXG4gICAqL1xuICBwcml2YXRlIHZhbGlkYXRlQ29uZmlndXJhdGlvbldpdGhDaGFpbigpOiB2b2lkIHtcbiAgICBjb25zdCB2YWxpZGF0aW9uUmVzdWx0ID0gQ29uZmlndXJhdGlvblZhbGlkYXRvci52YWxpZGF0ZSh0aGlzLnByb3BzKTtcbiAgICBcbiAgICAvLyDmpJzoqLzntZDmnpzjgpLjg63jgrDlh7rliptcbiAgICBDb25maWd1cmF0aW9uVmFsaWRhdG9yLmxvZ1ZhbGlkYXRpb25SZXN1bHQodmFsaWRhdGlvblJlc3VsdCk7XG4gICAgXG4gICAgLy8g44Ko44Op44O844GM44GC44KL5aC05ZCI44Gv5L6L5aSW44KS44K544Ot44O8XG4gICAgaWYgKCF2YWxpZGF0aW9uUmVzdWx0LmlzVmFsaWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg6Kit5a6a5qSc6Ki844Gr5aSx5pWX44GX44G+44GX44GfOiAke3ZhbGlkYXRpb25SZXN1bHQuZXJyb3JzLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOioreWumuaknOiovO+8iOW+k+adpeeJiCAtIOW+jOaWueS6kuaPm+aAp+OBruOBn+OCgeS/neaMge+8iVxuICAgKiBAZGVwcmVjYXRlZCB2YWxpZGF0ZUNvbmZpZ3VyYXRpb25XaXRoQ2hhaW4oKSDjgpLkvb/nlKjjgZfjgabjgY/jgaDjgZXjgYRcbiAgICovXG4gIHByaXZhdGUgdmFsaWRhdGVDb25maWd1cmF0aW9uKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5wcm9wcy5wcm9qZWN0TmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfjg5fjg63jgrjjgqfjgq/jg4jlkI3jgYzoqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLnByb3BzLmVudmlyb25tZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+eSsOWig+WQjeOBjOioreWumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cbiAgICBpZiAoIXRoaXMucHJvcHMuY29uZmlnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+OCs+ODs+ODlOODpeODvOODiOioreWumuOBjOioreWumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMYW1iZGHlrp/ooYzjg63jg7zjg6vkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhRXhlY3V0aW9uUm9sZSgpOiBpYW0uUm9sZSB7XG4gICAgY29uc3Qgcm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnTGFtYmRhRXhlY3V0aW9uUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246IGBMYW1iZGEgZXhlY3V0aW9uIHJvbGUgZm9yICR7dGhpcy5wcm9wcy5wcm9qZWN0TmFtZX1gLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIFZQQ+ioreWumuOBjOacieWKueOBquWgtOWQiFxuICAgIGlmICh0aGlzLnByb3BzLmNvbmZpZy5sYW1iZGEuY29tbW9uLnZwY0NvbmZpZz8uZW5hYmxlZCkge1xuICAgICAgcm9sZS5hZGRNYW5hZ2VkUG9saWN5KFxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFWUENBY2Nlc3NFeGVjdXRpb25Sb2xlJylcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gWC1SYXnoqK3lrprjgYzmnInlirnjgarloLTlkIhcbiAgICBpZiAodGhpcy5wcm9wcy5jb25maWcubGFtYmRhLmNvbW1vbi5lbmFibGVYUmF5VHJhY2luZykge1xuICAgICAgcm9sZS5hZGRNYW5hZ2VkUG9saWN5KFxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FXU1hSYXlEYWVtb25Xcml0ZUFjY2VzcycpXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFMz44Ki44Kv44K744K55qip6ZmQXG4gICAgaWYgKHRoaXMucHJvcHMuZG9jdW1lbnRzQnVja2V0KSB7XG4gICAgICB0aGlzLnByb3BzLmRvY3VtZW50c0J1Y2tldC5ncmFudFJlYWRXcml0ZShyb2xlKTtcbiAgICB9XG4gICAgaWYgKHRoaXMucHJvcHMuZW1iZWRkaW5nc0J1Y2tldCkge1xuICAgICAgdGhpcy5wcm9wcy5lbWJlZGRpbmdzQnVja2V0LmdyYW50UmVhZFdyaXRlKHJvbGUpO1xuICAgIH1cblxuICAgIC8vIER5bmFtb0RC44Ki44Kv44K744K55qip6ZmQXG4gICAgaWYgKHRoaXMucHJvcHMuc2Vzc2lvblRhYmxlKSB7XG4gICAgICB0aGlzLnByb3BzLnNlc3Npb25UYWJsZS5ncmFudFJlYWRXcml0ZURhdGEocm9sZSk7XG4gICAgfVxuXG4gICAgLy8gS01T44Ki44Kv44K744K55qip6ZmQXG4gICAgaWYgKHRoaXMucHJvcHMua21zS2V5KSB7XG4gICAgICB0aGlzLnByb3BzLmttc0tleS5ncmFudEVuY3J5cHREZWNyeXB0KHJvbGUpO1xuICAgIH1cblxuICAgIC8vIE9wZW5TZWFyY2jjgqLjgq/jgrvjgrnmqKnpmZDvvIjlsIbmnaXlrp/oo4XvvIlcbiAgICAvLyBpZiAodGhpcy5wcm9wcy5vcGVuU2VhcmNoQ29sbGVjdGlvbikge1xuICAgIC8vICAgLy8gT3BlblNlYXJjaCBTZXJ2ZXJsZXNz44Gu44Ki44Kv44K744K55qip6ZmQ44KS6L+95YqgXG4gICAgLy8gfVxuXG4gICAgcmV0dXJuIHJvbGU7XG4gIH1cblxuICAvKipcbiAgICogRUNS44Oq44Od44K444OI44Oq5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUVDUlJlcG9zaXRvcmllcygpOiB2b2lkIHtcbiAgICAvLyBOZXh0Lmpz55SoRUNS44Oq44Od44K444OI44OqXG4gICAgdGhpcy5lY3JSZXBvc2l0b3JpZXMubmV4dGpzID0gbmV3IGVjci5SZXBvc2l0b3J5KHRoaXMsICdOZXh0anNSZXBvc2l0b3J5Jywge1xuICAgICAgcmVwb3NpdG9yeU5hbWU6IGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tbmV4dGpzYCxcbiAgICAgIGltYWdlU2Nhbk9uUHVzaDogRUNSX0RFRkFVTFRTLlNDQU5fT05fUFVTSCxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbe1xuICAgICAgICBtYXhJbWFnZUNvdW50OiBFQ1JfREVGQVVMVFMuTUFYX0lNQUdFX0NPVU5ULFxuICAgICAgICBkZXNjcmlwdGlvbjogYEtlZXAgb25seSAke0VDUl9ERUZBVUxUUy5NQVhfSU1BR0VfQ09VTlR9IGltYWdlc2AsXG4gICAgICB9XSxcbiAgICB9KTtcblxuICAgIC8vIEVtYmVkZGluZ+eUqEVDUuODquODneOCuOODiOODqlxuICAgIHRoaXMuZWNyUmVwb3NpdG9yaWVzLmVtYmVkZGluZyA9IG5ldyBlY3IuUmVwb3NpdG9yeSh0aGlzLCAnRW1iZWRkaW5nUmVwb3NpdG9yeScsIHtcbiAgICAgIHJlcG9zaXRvcnlOYW1lOiBgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LWVtYmVkZGluZ2AsXG4gICAgICBpbWFnZVNjYW5PblB1c2g6IEVDUl9ERUZBVUxUUy5TQ0FOX09OX1BVU0gsXG4gICAgICBsaWZlY3ljbGVSdWxlczogW3tcbiAgICAgICAgbWF4SW1hZ2VDb3VudDogRUNSX0RFRkFVTFRTLkVNQkVERElOR19NQVhfSU1BR0VfQ09VTlQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgS2VlcCBvbmx5ICR7RUNSX0RFRkFVTFRTLkVNQkVERElOR19NQVhfSU1BR0VfQ09VTlR9IGltYWdlc2AsXG4gICAgICB9XSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDkvZzmiJDvvIhGYWN0b3J5IOODkeOCv+ODvOODs++8iVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVMYW1iZGFGdW5jdGlvbnNXaXRoRmFjdG9yeSgpOiB2b2lkIHtcbiAgICBjb25zdCBmdW5jdGlvbnMgPSB0aGlzLnByb3BzLmNvbmZpZy5sYW1iZGEuZnVuY3Rpb25zO1xuXG4gICAgLy8gTGFtYmRh6Zai5pWw44OV44Kh44Kv44OI44Oq44O844KS5Yid5pyf5YyWXG4gICAgY29uc3Qgc3RyYXRlZ3kgPSBuZXcgQmFzaWNMYW1iZGFTdHJhdGVneShcbiAgICAgIHRoaXMucHJvcHMuY29uZmlnLmxhbWJkYS5jb21tb24ubG9nUmV0ZW50aW9uLFxuICAgICAgdGhpcy5wcm9wcy5jb25maWcubGFtYmRhLmNvbW1vbi5hcmNoaXRlY3R1cmUgPT09ICdhcm02NCcgXG4gICAgICAgID8gbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQgXG4gICAgICAgIDogbGFtYmRhLkFyY2hpdGVjdHVyZS5YODZfNjRcbiAgICApO1xuICAgIGNvbnN0IGZhY3RvcnkgPSBuZXcgTGFtYmRhRnVuY3Rpb25GYWN0b3J5KHN0cmF0ZWd5KTtcblxuICAgIC8vIOWfuuacrFJBR+mWouaVsFxuICAgIHRoaXMuY3JlYXRlQmFzaWNSQUdGdW5jdGlvbnNXaXRoRmFjdG9yeShmdW5jdGlvbnMsIGZhY3RvcnkpO1xuXG4gICAgLy8g55uj6KaW44O75YiG5p6Q57Wx5ZCI6Zai5pWwXG4gICAgdGhpcy5jcmVhdGVNb25pdG9yaW5nQW5hbHl0aWNzRnVuY3Rpb25zV2l0aEZhY3RvcnkoZnVuY3Rpb25zLCBmYWN0b3J5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDkvZzmiJDvvIjlvpPmnaXniYggLSDlvozmlrnkupLmj5vmgKfjga7jgZ/jgoHkv53mjIHvvIlcbiAgICogQGRlcHJlY2F0ZWQgY3JlYXRlTGFtYmRhRnVuY3Rpb25zV2l0aEZhY3RvcnkoKSDjgpLkvb/nlKjjgZfjgabjgY/jgaDjgZXjgYRcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhRnVuY3Rpb25zKCk6IHZvaWQge1xuICAgIGNvbnN0IGZ1bmN0aW9ucyA9IHRoaXMucHJvcHMuY29uZmlnLmxhbWJkYS5mdW5jdGlvbnM7XG5cbiAgICAvLyDln7rmnKxSQUfplqLmlbBcbiAgICB0aGlzLmNyZWF0ZUJhc2ljUkFHRnVuY3Rpb25zKGZ1bmN0aW9ucyk7XG5cbiAgICAvLyDnm6Poppbjg7vliIbmnpDntbHlkIjplqLmlbBcbiAgICB0aGlzLmNyZWF0ZU1vbml0b3JpbmdBbmFseXRpY3NGdW5jdGlvbnMoZnVuY3Rpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDln7rmnKxSQUfplqLmlbDkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQmFzaWNSQUdGdW5jdGlvbnMoZnVuY3Rpb25zOiBhbnkpOiB2b2lkIHtcbiAgICAvLyDjg4njgq3jg6Xjg6Hjg7Pjg4jlh6bnkIZMYW1iZGFcbiAgICBpZiAoZnVuY3Rpb25zLmRvY3VtZW50UHJvY2Vzc29yLmVuYWJsZWQpIHtcbiAgICAgIHRoaXMubGFtYmRhRnVuY3Rpb25zLmRvY3VtZW50UHJvY2Vzc29yID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICAgJ0RvY3VtZW50UHJvY2Vzc29yJyxcbiAgICAgICAge1xuICAgICAgICAgIGZ1bmN0aW9uTmFtZTogZnVuY3Rpb25zLmRvY3VtZW50UHJvY2Vzc29yLmZ1bmN0aW9uTmFtZSB8fCBcbiAgICAgICAgICAgIGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tZG9jdW1lbnQtcHJvY2Vzc29yYCxcbiAgICAgICAgICBydW50aW1lOiBmdW5jdGlvbnMuZG9jdW1lbnRQcm9jZXNzb3IucnVudGltZSxcbiAgICAgICAgICBoYW5kbGVyOiBmdW5jdGlvbnMuZG9jdW1lbnRQcm9jZXNzb3IuaGFuZGxlcixcbiAgICAgICAgICB0aW1lb3V0OiBmdW5jdGlvbnMuZG9jdW1lbnRQcm9jZXNzb3IudGltZW91dCxcbiAgICAgICAgICBtZW1vcnlTaXplOiBmdW5jdGlvbnMuZG9jdW1lbnRQcm9jZXNzb3IubWVtb3J5U2l6ZSxcbiAgICAgICAgICByZXNlcnZlZENvbmN1cnJlbmN5OiBmdW5jdGlvbnMuZG9jdW1lbnRQcm9jZXNzb3IucmVzZXJ2ZWRDb25jdXJyZW5jeSxcbiAgICAgICAgICBwcm92aXNpb25lZENvbmN1cnJlbmN5OiBmdW5jdGlvbnMuZG9jdW1lbnRQcm9jZXNzb3IucHJvdmlzaW9uZWRDb25jdXJyZW5jeSxcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgLi4uZnVuY3Rpb25zLmRvY3VtZW50UHJvY2Vzc29yLmVudmlyb25tZW50LFxuICAgICAgICAgICAgRE9DVU1FTlRTX0JVQ0tFVDogdGhpcy5wcm9wcy5kb2N1bWVudHNCdWNrZXQ/LmJ1Y2tldE5hbWUgfHwgJycsXG4gICAgICAgICAgICBFTUJFRERJTkdTX0JVQ0tFVDogdGhpcy5wcm9wcy5lbWJlZGRpbmdzQnVja2V0Py5idWNrZXROYW1lIHx8ICcnLFxuICAgICAgICAgICAgU0VTU0lPTl9UQUJMRTogdGhpcy5wcm9wcy5zZXNzaW9uVGFibGU/LnRhYmxlTmFtZSB8fCAnJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGxheWVyczogZnVuY3Rpb25zLmRvY3VtZW50UHJvY2Vzc29yLmxheWVycyxcbiAgICAgICAgICBkZWFkTGV0dGVyUXVldWU6IGZ1bmN0aW9ucy5kb2N1bWVudFByb2Nlc3Nvci5kZWFkTGV0dGVyUXVldWUsXG4gICAgICAgIH0sXG4gICAgICAgICdkb2N1bWVudHByb2Nlc3NvcidcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8g5Z+L44KB6L6844G/55Sf5oiQTGFtYmRhXG4gICAgaWYgKGZ1bmN0aW9ucy5lbWJlZGRpbmdHZW5lcmF0b3IuZW5hYmxlZCkge1xuICAgICAgdGhpcy5sYW1iZGFGdW5jdGlvbnMuZW1iZWRkaW5nR2VuZXJhdG9yID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICAgJ0VtYmVkZGluZ0dlbmVyYXRvcicsXG4gICAgICAgIHtcbiAgICAgICAgICBmdW5jdGlvbk5hbWU6IGZ1bmN0aW9ucy5lbWJlZGRpbmdHZW5lcmF0b3IuZnVuY3Rpb25OYW1lIHx8IFxuICAgICAgICAgICAgYCR7dGhpcy5wcm9wcy5wcm9qZWN0TmFtZX0tJHt0aGlzLnByb3BzLmVudmlyb25tZW50fS1lbWJlZGRpbmctZ2VuZXJhdG9yYCxcbiAgICAgICAgICBydW50aW1lOiBmdW5jdGlvbnMuZW1iZWRkaW5nR2VuZXJhdG9yLnJ1bnRpbWUsXG4gICAgICAgICAgaGFuZGxlcjogZnVuY3Rpb25zLmVtYmVkZGluZ0dlbmVyYXRvci5oYW5kbGVyLFxuICAgICAgICAgIHRpbWVvdXQ6IGZ1bmN0aW9ucy5lbWJlZGRpbmdHZW5lcmF0b3IudGltZW91dCxcbiAgICAgICAgICBtZW1vcnlTaXplOiBmdW5jdGlvbnMuZW1iZWRkaW5nR2VuZXJhdG9yLm1lbW9yeVNpemUsXG4gICAgICAgICAgcmVzZXJ2ZWRDb25jdXJyZW5jeTogZnVuY3Rpb25zLmVtYmVkZGluZ0dlbmVyYXRvci5yZXNlcnZlZENvbmN1cnJlbmN5LFxuICAgICAgICAgIHByb3Zpc2lvbmVkQ29uY3VycmVuY3k6IGZ1bmN0aW9ucy5lbWJlZGRpbmdHZW5lcmF0b3IucHJvdmlzaW9uZWRDb25jdXJyZW5jeSxcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgLi4uZnVuY3Rpb25zLmVtYmVkZGluZ0dlbmVyYXRvci5lbnZpcm9ubWVudCxcbiAgICAgICAgICAgIEVNQkVERElOR1NfQlVDS0VUOiB0aGlzLnByb3BzLmVtYmVkZGluZ3NCdWNrZXQ/LmJ1Y2tldE5hbWUgfHwgJycsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBsYXllcnM6IGZ1bmN0aW9ucy5lbWJlZGRpbmdHZW5lcmF0b3IubGF5ZXJzLFxuICAgICAgICB9LFxuICAgICAgICAnZW1iZWRkaW5nZ2VuZXJhdG9yJ1xuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyDjgq/jgqjjg6rlh6bnkIZMYW1iZGFcbiAgICBpZiAoZnVuY3Rpb25zLnF1ZXJ5UHJvY2Vzc29yLmVuYWJsZWQpIHtcbiAgICAgIHRoaXMubGFtYmRhRnVuY3Rpb25zLnF1ZXJ5UHJvY2Vzc29yID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICAgJ1F1ZXJ5UHJvY2Vzc29yJyxcbiAgICAgICAge1xuICAgICAgICAgIGZ1bmN0aW9uTmFtZTogZnVuY3Rpb25zLnF1ZXJ5UHJvY2Vzc29yLmZ1bmN0aW9uTmFtZSB8fCBcbiAgICAgICAgICAgIGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tcXVlcnktcHJvY2Vzc29yYCxcbiAgICAgICAgICBydW50aW1lOiBmdW5jdGlvbnMucXVlcnlQcm9jZXNzb3IucnVudGltZSxcbiAgICAgICAgICBoYW5kbGVyOiBmdW5jdGlvbnMucXVlcnlQcm9jZXNzb3IuaGFuZGxlcixcbiAgICAgICAgICB0aW1lb3V0OiBmdW5jdGlvbnMucXVlcnlQcm9jZXNzb3IudGltZW91dCxcbiAgICAgICAgICBtZW1vcnlTaXplOiBmdW5jdGlvbnMucXVlcnlQcm9jZXNzb3IubWVtb3J5U2l6ZSxcbiAgICAgICAgICByZXNlcnZlZENvbmN1cnJlbmN5OiBmdW5jdGlvbnMucXVlcnlQcm9jZXNzb3IucmVzZXJ2ZWRDb25jdXJyZW5jeSxcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgLi4uZnVuY3Rpb25zLnF1ZXJ5UHJvY2Vzc29yLmVudmlyb25tZW50LFxuICAgICAgICAgICAgU0VTU0lPTl9UQUJMRTogdGhpcy5wcm9wcy5zZXNzaW9uVGFibGU/LnRhYmxlTmFtZSB8fCAnJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAncXVlcnlwcm9jZXNzb3InXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIOODgeODo+ODg+ODiOODj+ODs+ODieODqeODvExhbWJkYVxuICAgIGlmIChmdW5jdGlvbnMuY2hhdEhhbmRsZXIuZW5hYmxlZCkge1xuICAgICAgdGhpcy5sYW1iZGFGdW5jdGlvbnMuY2hhdEhhbmRsZXIgPSB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgICAgICAnQ2hhdEhhbmRsZXInLFxuICAgICAgICB7XG4gICAgICAgICAgZnVuY3Rpb25OYW1lOiBmdW5jdGlvbnMuY2hhdEhhbmRsZXIuZnVuY3Rpb25OYW1lIHx8IFxuICAgICAgICAgICAgYCR7dGhpcy5wcm9wcy5wcm9qZWN0TmFtZX0tJHt0aGlzLnByb3BzLmVudmlyb25tZW50fS1jaGF0LWhhbmRsZXJgLFxuICAgICAgICAgIHJ1bnRpbWU6IGZ1bmN0aW9ucy5jaGF0SGFuZGxlci5ydW50aW1lLFxuICAgICAgICAgIGhhbmRsZXI6IGZ1bmN0aW9ucy5jaGF0SGFuZGxlci5oYW5kbGVyLFxuICAgICAgICAgIHRpbWVvdXQ6IGZ1bmN0aW9ucy5jaGF0SGFuZGxlci50aW1lb3V0LFxuICAgICAgICAgIG1lbW9yeVNpemU6IGZ1bmN0aW9ucy5jaGF0SGFuZGxlci5tZW1vcnlTaXplLFxuICAgICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgICAuLi5mdW5jdGlvbnMuY2hhdEhhbmRsZXIuZW52aXJvbm1lbnQsXG4gICAgICAgICAgICBTRVNTSU9OX1RBQkxFOiB0aGlzLnByb3BzLnNlc3Npb25UYWJsZT8udGFibGVOYW1lIHx8ICcnLFxuICAgICAgICAgICAgRE9DVU1FTlRTX0JVQ0tFVDogdGhpcy5wcm9wcy5kb2N1bWVudHNCdWNrZXQ/LmJ1Y2tldE5hbWUgfHwgJycsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgJ2NoYXRoYW5kbGVyJ1xuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyDoqo3oqLzjg4/jg7Pjg4njg6njg7xMYW1iZGFcbiAgICBpZiAoZnVuY3Rpb25zLmF1dGhIYW5kbGVyLmVuYWJsZWQpIHtcbiAgICAgIHRoaXMubGFtYmRhRnVuY3Rpb25zLmF1dGhIYW5kbGVyID0gdGhpcy5jcmVhdGVMYW1iZGFGdW5jdGlvbihcbiAgICAgICAgJ0F1dGhIYW5kbGVyJyxcbiAgICAgICAge1xuICAgICAgICAgIGZ1bmN0aW9uTmFtZTogZnVuY3Rpb25zLmF1dGhIYW5kbGVyLmZ1bmN0aW9uTmFtZSB8fCBcbiAgICAgICAgICAgIGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tYXV0aC1oYW5kbGVyYCxcbiAgICAgICAgICBydW50aW1lOiBmdW5jdGlvbnMuYXV0aEhhbmRsZXIucnVudGltZSxcbiAgICAgICAgICBoYW5kbGVyOiBmdW5jdGlvbnMuYXV0aEhhbmRsZXIuaGFuZGxlcixcbiAgICAgICAgICB0aW1lb3V0OiBmdW5jdGlvbnMuYXV0aEhhbmRsZXIudGltZW91dCxcbiAgICAgICAgICBtZW1vcnlTaXplOiBmdW5jdGlvbnMuYXV0aEhhbmRsZXIubWVtb3J5U2l6ZSxcbiAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgLi4uZnVuY3Rpb25zLmF1dGhIYW5kbGVyLmVudmlyb25tZW50LFxuICAgICAgICAgICAgU0VTU0lPTl9UQUJMRTogdGhpcy5wcm9wcy5zZXNzaW9uVGFibGU/LnRhYmxlTmFtZSB8fCAnJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAnYXV0aGhhbmRsZXInXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDln7rmnKxSQUfplqLmlbDkvZzmiJDvvIhGYWN0b3J5IOODkeOCv+ODvOODs++8iVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVCYXNpY1JBR0Z1bmN0aW9uc1dpdGhGYWN0b3J5KGZ1bmN0aW9uczogYW55LCBmYWN0b3J5OiBMYW1iZGFGdW5jdGlvbkZhY3RvcnkpOiB2b2lkIHtcbiAgICAvLyDjg4njgq3jg6Xjg6Hjg7Pjg4jlh6bnkIZMYW1iZGFcbiAgICBpZiAoZnVuY3Rpb25zLmRvY3VtZW50UHJvY2Vzc29yPy5lbmFibGVkKSB7XG4gICAgICBjb25zdCBjb25maWcgPSBMYW1iZGFDb25maWdUZW1wbGF0ZXNcbiAgICAgICAgLmhlYXZ5UHJvY2Vzc2luZyhgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LWRvY3VtZW50LXByb2Nlc3NvcmApXG4gICAgICAgIC53aXRoUnVudGltZShmdW5jdGlvbnMuZG9jdW1lbnRQcm9jZXNzb3IucnVudGltZSlcbiAgICAgICAgLndpdGhUaW1lb3V0KGZ1bmN0aW9ucy5kb2N1bWVudFByb2Nlc3Nvci50aW1lb3V0KVxuICAgICAgICAud2l0aE1lbW9yeVNpemUoZnVuY3Rpb25zLmRvY3VtZW50UHJvY2Vzc29yLm1lbW9yeVNpemUpXG4gICAgICAgIC5hZGRFbnZpcm9ubWVudFZhcmlhYmxlKCdET0NVTUVOVFNfQlVDS0VUJywgdGhpcy5wcm9wcy5kb2N1bWVudHNCdWNrZXQ/LmJ1Y2tldE5hbWUgfHwgJycpXG4gICAgICAgIC5hZGRFbnZpcm9ubWVudFZhcmlhYmxlKCdFTUJFRERJTkdTX0JVQ0tFVCcsIHRoaXMucHJvcHMuZW1iZWRkaW5nc0J1Y2tldD8uYnVja2V0TmFtZSB8fCAnJylcbiAgICAgICAgLmJ1aWxkKCk7XG5cbiAgICAgIHRoaXMubGFtYmRhRnVuY3Rpb25zLmRvY3VtZW50UHJvY2Vzc29yID0gZmFjdG9yeS5jcmVhdGVGdW5jdGlvbihcbiAgICAgICAgdGhpcywgJ0RvY3VtZW50UHJvY2Vzc29yJywgY29uZmlnLCB0aGlzLmxhbWJkYVJvbGVcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8g5Z+L44KB6L6844G/55Sf5oiQTGFtYmRhXG4gICAgaWYgKGZ1bmN0aW9ucy5lbWJlZGRpbmdHZW5lcmF0b3I/LmVuYWJsZWQpIHtcbiAgICAgIGNvbnN0IGNvbmZpZyA9IExhbWJkYUNvbmZpZ1RlbXBsYXRlc1xuICAgICAgICAuaGVhdnlQcm9jZXNzaW5nKGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tZW1iZWRkaW5nLWdlbmVyYXRvcmApXG4gICAgICAgIC53aXRoUnVudGltZShmdW5jdGlvbnMuZW1iZWRkaW5nR2VuZXJhdG9yLnJ1bnRpbWUpXG4gICAgICAgIC53aXRoVGltZW91dChmdW5jdGlvbnMuZW1iZWRkaW5nR2VuZXJhdG9yLnRpbWVvdXQpXG4gICAgICAgIC53aXRoTWVtb3J5U2l6ZShmdW5jdGlvbnMuZW1iZWRkaW5nR2VuZXJhdG9yLm1lbW9yeVNpemUpXG4gICAgICAgIC5hZGRFbnZpcm9ubWVudFZhcmlhYmxlKCdFTUJFRERJTkdTX0JVQ0tFVCcsIHRoaXMucHJvcHMuZW1iZWRkaW5nc0J1Y2tldD8uYnVja2V0TmFtZSB8fCAnJylcbiAgICAgICAgLmJ1aWxkKCk7XG5cbiAgICAgIHRoaXMubGFtYmRhRnVuY3Rpb25zLmVtYmVkZGluZ0dlbmVyYXRvciA9IGZhY3RvcnkuY3JlYXRlRnVuY3Rpb24oXG4gICAgICAgIHRoaXMsICdFbWJlZGRpbmdHZW5lcmF0b3InLCBjb25maWcsIHRoaXMubGFtYmRhUm9sZVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyDjgq/jgqjjg6rlh6bnkIZMYW1iZGFcbiAgICBpZiAoZnVuY3Rpb25zLnF1ZXJ5UHJvY2Vzc29yPy5lbmFibGVkKSB7XG4gICAgICBjb25zdCBjb25maWcgPSBMYW1iZGFDb25maWdUZW1wbGF0ZXNcbiAgICAgICAgLnJlYWx0aW1lKGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tcXVlcnktcHJvY2Vzc29yYClcbiAgICAgICAgLndpdGhSdW50aW1lKGZ1bmN0aW9ucy5xdWVyeVByb2Nlc3Nvci5ydW50aW1lKVxuICAgICAgICAud2l0aFRpbWVvdXQoZnVuY3Rpb25zLnF1ZXJ5UHJvY2Vzc29yLnRpbWVvdXQpXG4gICAgICAgIC53aXRoTWVtb3J5U2l6ZShmdW5jdGlvbnMucXVlcnlQcm9jZXNzb3IubWVtb3J5U2l6ZSlcbiAgICAgICAgLmFkZEVudmlyb25tZW50VmFyaWFibGUoJ1NFU1NJT05fVEFCTEUnLCB0aGlzLnByb3BzLnNlc3Npb25UYWJsZT8udGFibGVOYW1lIHx8ICcnKVxuICAgICAgICAuYnVpbGQoKTtcblxuICAgICAgdGhpcy5sYW1iZGFGdW5jdGlvbnMucXVlcnlQcm9jZXNzb3IgPSBmYWN0b3J5LmNyZWF0ZUZ1bmN0aW9uKFxuICAgICAgICB0aGlzLCAnUXVlcnlQcm9jZXNzb3InLCBjb25maWcsIHRoaXMubGFtYmRhUm9sZVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyDjg4Hjg6Pjg4Pjg4jjg4/jg7Pjg4njg6njg7xMYW1iZGFcbiAgICBpZiAoZnVuY3Rpb25zLmNoYXRIYW5kbGVyPy5lbmFibGVkKSB7XG4gICAgICBjb25zdCBjb25maWcgPSBMYW1iZGFDb25maWdUZW1wbGF0ZXNcbiAgICAgICAgLmxpZ2h0d2VpZ2h0QXBpKGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tY2hhdC1oYW5kbGVyYClcbiAgICAgICAgLndpdGhSdW50aW1lKGZ1bmN0aW9ucy5jaGF0SGFuZGxlci5ydW50aW1lKVxuICAgICAgICAud2l0aFRpbWVvdXQoZnVuY3Rpb25zLmNoYXRIYW5kbGVyLnRpbWVvdXQpXG4gICAgICAgIC53aXRoTWVtb3J5U2l6ZShmdW5jdGlvbnMuY2hhdEhhbmRsZXIubWVtb3J5U2l6ZSlcbiAgICAgICAgLmFkZEVudmlyb25tZW50VmFyaWFibGUoJ1NFU1NJT05fVEFCTEUnLCB0aGlzLnByb3BzLnNlc3Npb25UYWJsZT8udGFibGVOYW1lIHx8ICcnKVxuICAgICAgICAuYnVpbGQoKTtcblxuICAgICAgdGhpcy5sYW1iZGFGdW5jdGlvbnMuY2hhdEhhbmRsZXIgPSBmYWN0b3J5LmNyZWF0ZUZ1bmN0aW9uKFxuICAgICAgICB0aGlzLCAnQ2hhdEhhbmRsZXInLCBjb25maWcsIHRoaXMubGFtYmRhUm9sZVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyDoqo3oqLzjg4/jg7Pjg4njg6njg7xMYW1iZGFcbiAgICBpZiAoZnVuY3Rpb25zLmF1dGhIYW5kbGVyPy5lbmFibGVkKSB7XG4gICAgICBjb25zdCBjb25maWcgPSBMYW1iZGFDb25maWdUZW1wbGF0ZXNcbiAgICAgICAgLmxpZ2h0d2VpZ2h0QXBpKGAke3RoaXMucHJvcHMucHJvamVjdE5hbWV9LSR7dGhpcy5wcm9wcy5lbnZpcm9ubWVudH0tYXV0aC1oYW5kbGVyYClcbiAgICAgICAgLndpdGhSdW50aW1lKGZ1bmN0aW9ucy5hdXRoSGFuZGxlci5ydW50aW1lKVxuICAgICAgICAud2l0aFRpbWVvdXQoZnVuY3Rpb25zLmF1dGhIYW5kbGVyLnRpbWVvdXQpXG4gICAgICAgIC53aXRoTWVtb3J5U2l6ZShmdW5jdGlvbnMuYXV0aEhhbmRsZXIubWVtb3J5U2l6ZSlcbiAgICAgICAgLmFkZEVudmlyb25tZW50VmFyaWFibGUoJ1NFU1NJT05fVEFCTEUnLCB0aGlzLnByb3BzLnNlc3Npb25UYWJsZT8udGFibGVOYW1lIHx8ICcnKVxuICAgICAgICAuYnVpbGQoKTtcblxuICAgICAgdGhpcy5sYW1iZGFGdW5jdGlvbnMuYXV0aEhhbmRsZXIgPSBmYWN0b3J5LmNyZWF0ZUZ1bmN0aW9uKFxuICAgICAgICB0aGlzLCAnQXV0aEhhbmRsZXInLCBjb25maWcsIHRoaXMubGFtYmRhUm9sZVxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog55uj6KaW44O75YiG5p6Q57Wx5ZCI6Zai5pWw5L2c5oiQ77yIRmFjdG9yeSDjg5Hjgr/jg7zjg7PvvIlcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTW9uaXRvcmluZ0FuYWx5dGljc0Z1bmN0aW9uc1dpdGhGYWN0b3J5KGZ1bmN0aW9uczogYW55LCBmYWN0b3J5OiBMYW1iZGFGdW5jdGlvbkZhY3RvcnkpOiB2b2lkIHtcbiAgICBpZiAoIWZ1bmN0aW9ucy5tb25pdG9yaW5nQW5hbHl0aWNzPy5lbmFibGVkKSByZXR1cm47XG5cbiAgICAvLyDjg6Hjg4jjg6rjgq/jgrnlj47pm4ZMYW1iZGFcbiAgICBpZiAoZnVuY3Rpb25zLm1vbml0b3JpbmdBbmFseXRpY3MubWV0cmljc0NvbGxlY3Rvcj8uZW5hYmxlZCkge1xuICAgICAgY29uc3QgY29uZmlnID0gTGFtYmRhQ29uZmlnVGVtcGxhdGVzXG4gICAgICAgIC5saWdodHdlaWdodEFwaShgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LW1ldHJpY3MtY29sbGVjdG9yYClcbiAgICAgICAgLndpdGhUaW1lb3V0KDMwMClcbiAgICAgICAgLndpdGhNZW1vcnlTaXplKDUxMilcbiAgICAgICAgLmJ1aWxkKCk7XG5cbiAgICAgIHRoaXMubGFtYmRhRnVuY3Rpb25zLm1ldHJpY3NDb2xsZWN0b3IgPSBmYWN0b3J5LmNyZWF0ZUZ1bmN0aW9uKFxuICAgICAgICB0aGlzLCAnTWV0cmljc0NvbGxlY3RvcicsIGNvbmZpZywgdGhpcy5sYW1iZGFSb2xlXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIOOCouODqeODvOODiOWHpueQhkxhbWJkYVxuICAgIGlmIChmdW5jdGlvbnMubW9uaXRvcmluZ0FuYWx5dGljcy5hbGVydFByb2Nlc3Nvcj8uZW5hYmxlZCkge1xuICAgICAgY29uc3QgY29uZmlnID0gTGFtYmRhQ29uZmlnVGVtcGxhdGVzXG4gICAgICAgIC5saWdodHdlaWdodEFwaShgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LWFsZXJ0LXByb2Nlc3NvcmApXG4gICAgICAgIC53aXRoVGltZW91dCgxODApXG4gICAgICAgIC53aXRoTWVtb3J5U2l6ZSgyNTYpXG4gICAgICAgIC5idWlsZCgpO1xuXG4gICAgICB0aGlzLmxhbWJkYUZ1bmN0aW9ucy5hbGVydFByb2Nlc3NvciA9IGZhY3RvcnkuY3JlYXRlRnVuY3Rpb24oXG4gICAgICAgIHRoaXMsICdBbGVydFByb2Nlc3NvcicsIGNvbmZpZywgdGhpcy5sYW1iZGFSb2xlXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIE1M5Yem55CGTGFtYmRhXG4gICAgaWYgKGZ1bmN0aW9ucy5tb25pdG9yaW5nQW5hbHl0aWNzLm1sUHJvY2Vzc29yPy5lbmFibGVkKSB7XG4gICAgICBjb25zdCBjb25maWcgPSBMYW1iZGFDb25maWdUZW1wbGF0ZXNcbiAgICAgICAgLmhlYXZ5UHJvY2Vzc2luZyhgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LW1sLXByb2Nlc3NvcmApXG4gICAgICAgIC53aXRoVGltZW91dCg5MDApXG4gICAgICAgIC53aXRoTWVtb3J5U2l6ZSgxMDI0KVxuICAgICAgICAuYnVpbGQoKTtcblxuICAgICAgdGhpcy5sYW1iZGFGdW5jdGlvbnMubWxQcm9jZXNzb3IgPSBmYWN0b3J5LmNyZWF0ZUZ1bmN0aW9uKFxuICAgICAgICB0aGlzLCAnTUxQcm9jZXNzb3InLCBjb25maWcsIHRoaXMubGFtYmRhUm9sZVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyDjg4bjg4rjg7Pjg4jnrqHnkIZMYW1iZGFcbiAgICBpZiAoZnVuY3Rpb25zLm1vbml0b3JpbmdBbmFseXRpY3MudGVuYW50TWFuYWdlcj8uZW5hYmxlZCkge1xuICAgICAgY29uc3QgY29uZmlnID0gTGFtYmRhQ29uZmlnVGVtcGxhdGVzXG4gICAgICAgIC5saWdodHdlaWdodEFwaShgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LXRlbmFudC1tYW5hZ2VyYClcbiAgICAgICAgLndpdGhUaW1lb3V0KDMwMClcbiAgICAgICAgLndpdGhNZW1vcnlTaXplKDUxMilcbiAgICAgICAgLmFkZEVudmlyb25tZW50VmFyaWFibGUoJ1NFU1NJT05fVEFCTEUnLCB0aGlzLnByb3BzLnNlc3Npb25UYWJsZT8udGFibGVOYW1lIHx8ICcnKVxuICAgICAgICAuYnVpbGQoKTtcblxuICAgICAgdGhpcy5sYW1iZGFGdW5jdGlvbnMudGVuYW50TWFuYWdlciA9IGZhY3RvcnkuY3JlYXRlRnVuY3Rpb24oXG4gICAgICAgIHRoaXMsICdUZW5hbnRNYW5hZ2VyJywgY29uZmlnLCB0aGlzLmxhbWJkYVJvbGVcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOebo+imluODu+WIhuaekOe1seWQiOmWouaVsOS9nOaIkO+8iOW+k+adpeeJiCAtIOW+jOaWueS6kuaPm+aAp+OBruOBn+OCgeS/neaMge+8iVxuICAgKiBAZGVwcmVjYXRlZCBjcmVhdGVNb25pdG9yaW5nQW5hbHl0aWNzRnVuY3Rpb25zV2l0aEZhY3RvcnkoKSDjgpLkvb/nlKjjgZfjgabjgY/jgaDjgZXjgYRcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTW9uaXRvcmluZ0FuYWx5dGljc0Z1bmN0aW9ucyhmdW5jdGlvbnM6IGFueSk6IHZvaWQge1xuICAgIGlmICghZnVuY3Rpb25zLm1vbml0b3JpbmdBbmFseXRpY3M/LmVuYWJsZWQpIHJldHVybjtcblxuICAgIHRoaXMuY3JlYXRlTWV0cmljc0NvbGxlY3RvckZ1bmN0aW9uKCk7XG4gICAgdGhpcy5jcmVhdGVBbGVydFByb2Nlc3NvckZ1bmN0aW9uKCk7XG4gICAgdGhpcy5jcmVhdGVNTFByb2Nlc3NvckZ1bmN0aW9uKCk7XG4gICAgdGhpcy5jcmVhdGVUZW5hbnRNYW5hZ2VyRnVuY3Rpb24oKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6Hjg4jjg6rjgq/jgrnlj47pm4ZMYW1iZGHplqLmlbDkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTWV0cmljc0NvbGxlY3RvckZ1bmN0aW9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGNvbmZpZ0ZhY3RvcnkgPSBuZXcgTGFtYmRhQ29uZmlnRmFjdG9yeShcbiAgICAgIHRoaXMucHJvcHMucHJvamVjdE5hbWUsXG4gICAgICB0aGlzLnByb3BzLmVudmlyb25tZW50LFxuICAgICAgdGhpcy5wcm9wcy5zZXNzaW9uVGFibGU/LnRhYmxlTmFtZVxuICAgICk7XG4gICAgXG4gICAgY29uc3QgY29uZmlnID0gY29uZmlnRmFjdG9yeS5jcmVhdGVNZXRyaWNzQ29sbGVjdG9yQ29uZmlnKCk7XG4gICAgdGhpcy5sYW1iZGFGdW5jdGlvbnMubWV0cmljc0NvbGxlY3RvciA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnTWV0cmljc0NvbGxlY3RvcicsXG4gICAgICBjb25maWcsXG4gICAgICAnbWV0cmljcy1jb2xsZWN0b3InXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqLjg6njg7zjg4jlh6bnkIZMYW1iZGHplqLmlbDkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQWxlcnRQcm9jZXNzb3JGdW5jdGlvbigpOiB2b2lkIHtcbiAgICBjb25zdCBjb25maWdGYWN0b3J5ID0gbmV3IExhbWJkYUNvbmZpZ0ZhY3RvcnkoXG4gICAgICB0aGlzLnByb3BzLnByb2plY3ROYW1lLFxuICAgICAgdGhpcy5wcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIHRoaXMucHJvcHMuc2Vzc2lvblRhYmxlPy50YWJsZU5hbWVcbiAgICApO1xuICAgIFxuICAgIGNvbnN0IGNvbmZpZyA9IGNvbmZpZ0ZhY3RvcnkuY3JlYXRlQWxlcnRQcm9jZXNzb3JDb25maWcoKTtcbiAgICB0aGlzLmxhbWJkYUZ1bmN0aW9ucy5hbGVydFByb2Nlc3NvciA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnQWxlcnRQcm9jZXNzb3InLFxuICAgICAgY29uZmlnLFxuICAgICAgJ2FsZXJ0LXByb2Nlc3NvcidcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIE1M5Yem55CGTGFtYmRh6Zai5pWw5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU1MUHJvY2Vzc29yRnVuY3Rpb24oKTogdm9pZCB7XG4gICAgY29uc3QgY29uZmlnRmFjdG9yeSA9IG5ldyBMYW1iZGFDb25maWdGYWN0b3J5KFxuICAgICAgdGhpcy5wcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIHRoaXMucHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICB0aGlzLnByb3BzLnNlc3Npb25UYWJsZT8udGFibGVOYW1lXG4gICAgKTtcbiAgICBcbiAgICBjb25zdCBjb25maWcgPSBjb25maWdGYWN0b3J5LmNyZWF0ZU1MUHJvY2Vzc29yQ29uZmlnKCk7XG4gICAgdGhpcy5sYW1iZGFGdW5jdGlvbnMubWxQcm9jZXNzb3IgPSB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9uKFxuICAgICAgJ01MUHJvY2Vzc29yJyxcbiAgICAgIGNvbmZpZyxcbiAgICAgICdtbC1wcm9jZXNzb3InXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4bjg4rjg7Pjg4jnrqHnkIZMYW1iZGHplqLmlbDkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlVGVuYW50TWFuYWdlckZ1bmN0aW9uKCk6IHZvaWQge1xuICAgIGNvbnN0IGNvbmZpZ0ZhY3RvcnkgPSBuZXcgTGFtYmRhQ29uZmlnRmFjdG9yeShcbiAgICAgIHRoaXMucHJvcHMucHJvamVjdE5hbWUsXG4gICAgICB0aGlzLnByb3BzLmVudmlyb25tZW50LFxuICAgICAgdGhpcy5wcm9wcy5zZXNzaW9uVGFibGU/LnRhYmxlTmFtZVxuICAgICk7XG4gICAgXG4gICAgY29uc3QgY29uZmlnID0gY29uZmlnRmFjdG9yeS5jcmVhdGVUZW5hbnRNYW5hZ2VyQ29uZmlnKCk7XG4gICAgdGhpcy5sYW1iZGFGdW5jdGlvbnMudGVuYW50TWFuYWdlciA9IHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb24oXG4gICAgICAnVGVuYW50TWFuYWdlcicsXG4gICAgICBjb25maWcsXG4gICAgICAndGVuYW50LW1hbmFnZXInXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDkvZzmiJDjg5jjg6vjg5Hjg7xcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhRnVuY3Rpb24oaWQ6IHN0cmluZywgY29uZmlnOiBMYW1iZGFGdW5jdGlvbkNvbmZpZywgY29kZURpcj86IHN0cmluZyk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgLy8g44Ot44Kw44Kw44Or44O844OX5L2c5oiQXG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCBgJHtpZH1Mb2dHcm91cGAsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvbGFtYmRhLyR7Y29uZmlnLmZ1bmN0aW9uTmFtZX1gLFxuICAgICAgcmV0ZW50aW9uOiB0aGlzLnByb3BzLmNvbmZpZy5sYW1iZGEuY29tbW9uLmxvZ1JldGVudGlvbixcbiAgICAgIHJlbW92YWxQb2xpY3k6IHRoaXMucHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyBcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIOOCs+ODvOODieODh+OCo+ODrOOCr+ODiOODquOBruaxuuWumlxuICAgIGNvbnN0IGNvZGVQYXRoID0gY29kZURpciA/IGBsYW1iZGEvJHtjb2RlRGlyfWAgOiBgbGFtYmRhLyR7aWQudG9Mb3dlckNhc2UoKX1gO1xuXG4gICAgLy8gTGFtYmRh6Zai5pWw5L2c5oiQXG4gICAgY29uc3QgbGFtYmRhRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGlkLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGNvbmZpZy5mdW5jdGlvbk5hbWUsXG4gICAgICBydW50aW1lOiB0aGlzLmdldExhbWJkYVJ1bnRpbWUoY29uZmlnLnJ1bnRpbWUpLFxuICAgICAgaGFuZGxlcjogY29uZmlnLmhhbmRsZXIsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoY29kZVBhdGgpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoY29uZmlnLnRpbWVvdXQpLFxuICAgICAgbWVtb3J5U2l6ZTogY29uZmlnLm1lbW9yeVNpemUsXG4gICAgICByb2xlOiB0aGlzLmxhbWJkYVJvbGUsXG4gICAgICBlbnZpcm9ubWVudDogY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgbG9nR3JvdXAsXG4gICAgICBhcmNoaXRlY3R1cmU6IHRoaXMucHJvcHMuY29uZmlnLmxhbWJkYS5jb21tb24uYXJjaGl0ZWN0dXJlID09PSAnYXJtNjQnIFxuICAgICAgICA/IGxhbWJkYS5BcmNoaXRlY3R1cmUuQVJNXzY0IFxuICAgICAgICA6IGxhbWJkYS5BcmNoaXRlY3R1cmUuWDg2XzY0LFxuICAgICAgdHJhY2luZzogdGhpcy5wcm9wcy5jb25maWcubGFtYmRhLmNvbW1vbi5lbmFibGVYUmF5VHJhY2luZyBcbiAgICAgICAgPyBsYW1iZGEuVHJhY2luZy5BQ1RJVkUgXG4gICAgICAgIDogbGFtYmRhLlRyYWNpbmcuRElTQUJMRUQsXG4gICAgICBpbnNpZ2h0c1ZlcnNpb246IHRoaXMucHJvcHMuY29uZmlnLmxhbWJkYS5jb21tb24uZW5hYmxlSW5zaWdodHMgXG4gICAgICAgID8gbGFtYmRhLkxhbWJkYUluc2lnaHRzVmVyc2lvbi5WRVJTSU9OXzFfMF8yMjlfMCBcbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiBjb25maWcucmVzZXJ2ZWRDb25jdXJyZW5jeSxcbiAgICAgIHZwYzogdGhpcy5wcm9wcy5jb25maWcubGFtYmRhLmNvbW1vbi52cGNDb25maWc/LmVuYWJsZWQgPyB0aGlzLnByb3BzLnZwYyA6IHVuZGVmaW5lZCxcbiAgICAgIHZwY1N1Ym5ldHM6IHRoaXMucHJvcHMuY29uZmlnLmxhbWJkYS5jb21tb24udnBjQ29uZmlnPy5lbmFibGVkICYmIHRoaXMucHJvcHMucHJpdmF0ZVN1Ym5ldElkcyA/IHtcbiAgICAgICAgc3VibmV0czogdGhpcy5wcm9wcy5wcml2YXRlU3VibmV0SWRzLm1hcChpZCA9PiBlYzIuU3VibmV0LmZyb21TdWJuZXRJZCh0aGlzLCBgU3VibmV0JHtpZH1gLCBpZCkpXG4gICAgICB9IDogdW5kZWZpbmVkLFxuICAgIH0pO1xuXG4gICAgLy8gVlBD6Kit5a6aXG4gICAgaWYgKHRoaXMucHJvcHMuY29uZmlnLmxhbWJkYS5jb21tb24udnBjQ29uZmlnPy5lbmFibGVkICYmIHRoaXMucHJvcHMudnBjKSB7XG4gICAgICAvLyBWUEPoqK3lrprjga/plqLmlbDkvZzmiJDmmYLjgavoqK3lrprjgZnjgovlv4XopoHjgYzjgYLjgovjgZ/jgoHjgIHjgZPjgZPjgafjga/nnIHnlaVcbiAgICAgIC8vIOWun+mam+OBruWun+ijheOBp+OBr+OAgUxhbWJkYemWouaVsOS9nOaIkOaZguOBq3ZwY0NvbmZpZ+OCkuioreWumlxuICAgIH1cblxuICAgIC8vIOODl+ODreODk+OCuOODp+ODi+ODs+OCsOa4iOOBv+WQjOaZguWun+ihjOaVsOioreWumlxuICAgIGlmIChjb25maWcucHJvdmlzaW9uZWRDb25jdXJyZW5jeSkge1xuICAgICAgY29uc3QgdmVyc2lvbiA9IGxhbWJkYUZ1bmN0aW9uLmN1cnJlbnRWZXJzaW9uO1xuICAgICAgY29uc3QgYWxpYXMgPSBuZXcgbGFtYmRhLkFsaWFzKHRoaXMsIGAke2lkfUFsaWFzYCwge1xuICAgICAgICBhbGlhc05hbWU6ICdsaXZlJyxcbiAgICAgICAgdmVyc2lvbixcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyDjg5fjg63jg5Pjgrjjg6fjg4vjg7PjgrDmuIjjgb/lkIzmmYLlrp/ooYzmlbDjgpLliKXpgJToqK3lrprvvIjlsIbmnaXlrp/oo4XvvIlcbiAgICAgIC8vIOePvuWcqOOBrkNES+ODkOODvOOCuOODp+ODs+OBp+OBr+ebtOaOpeOCteODneODvOODiOOBleOCjOOBpuOBhOOBquOBhOOBn+OCgeOAgeOCs+ODoeODs+ODiOOCouOCpuODiFxuICAgICAgLy8gbmV3IGNkay5DZm5SZXNvdXJjZSh0aGlzLCBgJHtpZH1Qcm92aXNpb25lZENvbmN1cnJlbmN5YCwge1xuICAgICAgLy8gICB0eXBlOiAnQVdTOjpMYW1iZGE6OlByb3Zpc2lvbmVkQ29uY3VycmVuY3lDb25maWcnLFxuICAgICAgLy8gICBwcm9wZXJ0aWVzOiB7XG4gICAgICAvLyAgICAgRnVuY3Rpb25OYW1lOiBsYW1iZGFGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICAvLyAgICAgUXVhbGlmaWVyOiBhbGlhcy5hbGlhc05hbWUsXG4gICAgICAvLyAgICAgUHJvdmlzaW9uZWRDb25jdXJyZW5jeUNvbmZpZzogY29uZmlnLnByb3Zpc2lvbmVkQ29uY3VycmVuY3ksXG4gICAgICAvLyAgIH0sXG4gICAgICAvLyB9KTtcbiAgICB9XG5cbiAgICAvLyDjg4fjg4Pjg4njg6zjgr/jg7zjgq3jg6Xjg7zoqK3lrppcbiAgICBpZiAoY29uZmlnLmRlYWRMZXR0ZXJRdWV1ZSkge1xuICAgICAgLy8gU1FT44OH44OD44OJ44Os44K/44O844Kt44Ol44O844Gu5a6f6KOF77yI5bCG5p2l5a6f6KOF77yJXG4gICAgfVxuXG4gICAgcmV0dXJuIGxhbWJkYUZ1bmN0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIEFXUyBCYXRjaOODquOCveODvOOCueS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVCYXRjaFJlc291cmNlcygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucHJvcHMuY29uZmlnLmJhdGNoLmVuYWJsZWQpIHJldHVybjtcblxuICAgIGNvbnN0IGJhdGNoQ29uZmlnID0gdGhpcy5wcm9wcy5jb25maWcuYmF0Y2g7XG5cbiAgICAvLyBCYXRjaOeUqElBTeODreODvOODq1xuICAgIGNvbnN0IGJhdGNoU2VydmljZVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0JhdGNoU2VydmljZVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmF0Y2guYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0JhdGNoU2VydmljZVJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBiYXRjaEluc3RhbmNlUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQmF0Y2hJbnN0YW5jZVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnZWMyLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BbWF6b25FQzJDb250YWluZXJTZXJ2aWNlZm9yRUMyUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGJhdGNoSW5zdGFuY2VQcm9maWxlID0gbmV3IGlhbS5DZm5JbnN0YW5jZVByb2ZpbGUodGhpcywgJ0JhdGNoSW5zdGFuY2VQcm9maWxlJywge1xuICAgICAgcm9sZXM6IFtiYXRjaEluc3RhbmNlUm9sZS5yb2xlTmFtZV0sXG4gICAgfSk7XG5cbiAgICAvLyDjgrPjg7Pjg5Tjg6Xjg7zjg4jnkrDlooPkvZzmiJBcbiAgICBpZiAoYmF0Y2hDb25maWcuY29tcHV0ZUVudmlyb25tZW50KSB7XG4gICAgICBjb25zdCBiYXRjaENvbXB1dGVFbnZpcm9ubWVudCA9IG5ldyBiYXRjaC5DZm5Db21wdXRlRW52aXJvbm1lbnQodGhpcywgJ0JhdGNoQ29tcHV0ZUVudmlyb25tZW50Jywge1xuICAgICAgICBjb21wdXRlRW52aXJvbm1lbnROYW1lOiBiYXRjaENvbmZpZy5jb21wdXRlRW52aXJvbm1lbnQubmFtZSB8fCBcbiAgICAgICAgICBgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LWNvbXB1dGUtZW52YCxcbiAgICAgICAgc2VydmljZVJvbGU6IGJhdGNoU2VydmljZVJvbGUucm9sZUFybixcbiAgICAgICAgdHlwZTogYmF0Y2hDb25maWcuY29tcHV0ZUVudmlyb25tZW50LnR5cGUsXG4gICAgICAgIHN0YXRlOiBiYXRjaENvbmZpZy5jb21wdXRlRW52aXJvbm1lbnQuc3RhdGUsXG4gICAgICB9KTtcblxuICAgICAgLy8g44K444On44OW44Kt44Ol44O85L2c5oiQXG4gICAgICBpZiAoYmF0Y2hDb25maWcuam9iUXVldWUpIHtcbiAgICAgICAgY29uc3QgYmF0Y2hKb2JRdWV1ZSA9IG5ldyBiYXRjaC5DZm5Kb2JRdWV1ZSh0aGlzLCAnQmF0Y2hKb2JRdWV1ZScsIHtcbiAgICAgICAgICBqb2JRdWV1ZU5hbWU6IGJhdGNoQ29uZmlnLmpvYlF1ZXVlLm5hbWUgfHwgXG4gICAgICAgICAgICBgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LWpvYi1xdWV1ZWAsXG4gICAgICAgICAgcHJpb3JpdHk6IGJhdGNoQ29uZmlnLmpvYlF1ZXVlLnByaW9yaXR5LFxuICAgICAgICAgIGNvbXB1dGVFbnZpcm9ubWVudE9yZGVyOiBbe1xuICAgICAgICAgICAgY29tcHV0ZUVudmlyb25tZW50OiBiYXRjaENvbXB1dGVFbnZpcm9ubWVudC5yZWYsXG4gICAgICAgICAgICBvcmRlcjogMSxcbiAgICAgICAgICB9XSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEVDU+ODquOCveODvOOCueS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVFQ1NSZXNvdXJjZXMoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnByb3BzLmNvbmZpZy5lY3MuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgZWNzQ29uZmlnID0gdGhpcy5wcm9wcy5jb25maWcuZWNzO1xuXG4gICAgLy8gRUNT44Kv44Op44K544K/44O85L2c5oiQXG4gICAgaWYgKGVjc0NvbmZpZy5jbHVzdGVyKSB7XG4gICAgICBjb25zdCBlY3NDbHVzdGVyID0gbmV3IGVjcy5DbHVzdGVyKHRoaXMsICdFQ1NDbHVzdGVyJywge1xuICAgICAgICBjbHVzdGVyTmFtZTogZWNzQ29uZmlnLmNsdXN0ZXIubmFtZSB8fCBcbiAgICAgICAgICBgJHt0aGlzLnByb3BzLnByb2plY3ROYW1lfS0ke3RoaXMucHJvcHMuZW52aXJvbm1lbnR9LWNsdXN0ZXJgLFxuICAgICAgICB2cGM6IHRoaXMucHJvcHMudnBjLFxuICAgICAgICBjb250YWluZXJJbnNpZ2h0czogZWNzQ29uZmlnLmNsdXN0ZXIuZW5hYmxlQ29udGFpbmVySW5zaWdodHMsXG4gICAgICB9KTtcblxuICAgICAgLy8g44Kt44Oj44OR44K344OG44Kj44OX44Ot44OQ44Kk44OA44O86Kit5a6aXG4gICAgICBpZiAoZWNzQ29uZmlnLmNsdXN0ZXIuY2FwYWNpdHlQcm92aWRlcnMuaW5jbHVkZXMoJ0ZBUkdBVEUnKSkge1xuICAgICAgICBlY3NDbHVzdGVyLmFkZENhcGFjaXR5KCdGYXJnYXRlQ2FwYWNpdHknLCB7XG4gICAgICAgICAgaW5zdGFuY2VUeXBlOiBlYzIuSW5zdGFuY2VUeXBlLm9mKGVjMi5JbnN0YW5jZUNsYXNzLlQzLCBlYzIuSW5zdGFuY2VTaXplLk1JQ1JPKSxcbiAgICAgICAgICBtaW5DYXBhY2l0eTogMCxcbiAgICAgICAgICBtYXhDYXBhY2l0eTogMTAsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDoh6rli5XjgrnjgrHjg7zjg6rjg7PjgrDoqK3lrppcbiAgICovXG4gIHByaXZhdGUgc2V0dXBBdXRvU2NhbGluZygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMucHJvcHMuY29uZmlnLmxhbWJkYS5jb21tb24uZW5hYmxlQXV0b1NjYWxpbmcpIHJldHVybjtcblxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMubGFtYmRhRnVuY3Rpb25zKS5mb3JFYWNoKChbbmFtZSwgbGFtYmRhRnVuY3Rpb25dKSA9PiB7XG4gICAgICBjb25zdCBhdXRvU2NhbGluZ0NvbmZpZyA9IHRoaXMucHJvcHMuY29uZmlnLmxhbWJkYS5hdXRvU2NhbGluZyB8fCB7XG4gICAgICAgIG1pbkNvbmN1cnJlbmN5OiAxMCxcbiAgICAgICAgbWF4Q29uY3VycmVuY3k6IDEwMDAsXG4gICAgICAgIHRhcmdldFV0aWxpemF0aW9uOiA3MCxcbiAgICAgICAgc2NhbGVPdXRDb29sZG93bjogNjAsXG4gICAgICAgIHNjYWxlSW5Db29sZG93bjogMzAwLFxuICAgICAgfTtcblxuICAgICAgLy8g44OX44Ot44OT44K444On44OL44Oz44Kw5riI44G/5ZCM5pmC5a6f6KGM5pWw44Gu6Kit5a6aXG4gICAgICBjb25zdCBhbGlhcyA9IGxhbWJkYUZ1bmN0aW9uLmFkZEFsaWFzKCdsaXZlJyk7XG5cbiAgICAgIC8vIEFwcGxpY2F0aW9uIEF1dG8gU2NhbGluZ+OCv+ODvOOCsuODg+ODiOioreWumlxuICAgICAgY29uc3Qgc2NhbGluZ1RhcmdldCA9IG5ldyBhcHBsaWNhdGlvbmF1dG9zY2FsaW5nLlNjYWxhYmxlVGFyZ2V0KHRoaXMsIGAke25hbWV9U2NhbGluZ1RhcmdldGAsIHtcbiAgICAgICAgc2VydmljZU5hbWVzcGFjZTogYXBwbGljYXRpb25hdXRvc2NhbGluZy5TZXJ2aWNlTmFtZXNwYWNlLkxBTUJEQSxcbiAgICAgICAgc2NhbGFibGVEaW1lbnNpb246ICdsYW1iZGE6ZnVuY3Rpb246UHJvdmlzaW9uZWRDb25jdXJyZW5jeScsXG4gICAgICAgIHJlc291cmNlSWQ6IGBmdW5jdGlvbjoke2xhbWJkYUZ1bmN0aW9uLmZ1bmN0aW9uTmFtZX06bGl2ZWAsXG4gICAgICAgIG1pbkNhcGFjaXR5OiBhdXRvU2NhbGluZ0NvbmZpZy5taW5Db25jdXJyZW5jeSxcbiAgICAgICAgbWF4Q2FwYWNpdHk6IGF1dG9TY2FsaW5nQ29uZmlnLm1heENvbmN1cnJlbmN5LFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuYXV0b1NjYWxpbmdUYXJnZXRzW25hbWVdID0gc2NhbGluZ1RhcmdldDtcblxuICAgICAgLy8gQ2xvdWRXYXRjaOODoeODiOODquOCr+OCueioreWumlxuICAgICAgY29uc3QgdXRpbGl6YXRpb25NZXRyaWMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ1Byb3Zpc2lvbmVkQ29uY3VycmVuY3lVdGlsaXphdGlvbicsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBGdW5jdGlvbk5hbWU6IGxhbWJkYUZ1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgICAgICAgICBSZXNvdXJjZTogYCR7bGFtYmRhRnVuY3Rpb24uZnVuY3Rpb25OYW1lfTpsaXZlYCxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICB9KTtcblxuICAgICAgLy8g44K/44O844Ky44OD44OI6L+96Leh44K544Kx44O844Oq44Oz44Kw44Od44Oq44K344O8XG4gICAgICBzY2FsaW5nVGFyZ2V0LnNjYWxlVG9UcmFja01ldHJpYyhgJHtuYW1lfVNjYWxpbmdQb2xpY3lgLCB7XG4gICAgICAgIHRhcmdldFZhbHVlOiBhdXRvU2NhbGluZ0NvbmZpZy50YXJnZXRVdGlsaXphdGlvbixcbiAgICAgICAgcHJlZGVmaW5lZE1ldHJpYzogYXBwbGljYXRpb25hdXRvc2NhbGluZy5QcmVkZWZpbmVkTWV0cmljLkxBTUJEQV9QUk9WSVNJT05FRF9DT05DVVJSRU5DWV9VVElMSVpBVElPTixcbiAgICAgICAgc2NhbGVPdXRDb29sZG93bjogY2RrLkR1cmF0aW9uLnNlY29uZHMoYXV0b1NjYWxpbmdDb25maWcuc2NhbGVPdXRDb29sZG93biksXG4gICAgICAgIHNjYWxlSW5Db29sZG93bjogY2RrLkR1cmF0aW9uLnNlY29uZHMoYXV0b1NjYWxpbmdDb25maWcuc2NhbGVJbkNvb2xkb3duKSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyDjgqbjgqnjg7zjg6DjgqLjg4Pjg5foqK3lrprvvIjjgrPjg7zjg6vjg4njgrnjgr/jg7zjg4jliYrmuJvvvIlcbiAgICAgIGlmICh0aGlzLnByb3BzLmNvbmZpZy5sYW1iZGEuY29tbW9uLmVuYWJsZVdhcm11cCkge1xuICAgICAgICBjb25zdCB3YXJtdXBSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsIGAke25hbWV9V2FybXVwUnVsZWAsIHtcbiAgICAgICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLnJhdGUoY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkpLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBgTGFtYmRh6Zai5pWw44Gu44Km44Kp44O844Og44Ki44OD44OXIC0gJHtsYW1iZGFGdW5jdGlvbi5mdW5jdGlvbk5hbWV9YCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgd2FybXVwUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oYWxpYXMsIHtcbiAgICAgICAgICBldmVudDogZXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgICAgIHNvdXJjZTogJ3dhcm11cCcsXG4gICAgICAgICAgICBhY3Rpb246ICdwaW5nJyxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogZXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tVGV4dCgnJC50aW1lJyksXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMYW1iZGEgUnVudGltZeWkieaPm1xuICAgKi9cbiAgcHJpdmF0ZSBnZXRMYW1iZGFSdW50aW1lKHJ1bnRpbWU6IHN0cmluZyk6IGxhbWJkYS5SdW50aW1lIHtcbiAgICBzd2l0Y2ggKHJ1bnRpbWUpIHtcbiAgICAgIGNhc2UgJ25vZGVqczE4LngnOlxuICAgICAgICByZXR1cm4gbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1g7XG4gICAgICBjYXNlICdub2RlanMyMC54JzpcbiAgICAgICAgcmV0dXJuIGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YO1xuICAgICAgY2FzZSAncHl0aG9uMy45JzpcbiAgICAgICAgcmV0dXJuIGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzk7XG4gICAgICBjYXNlICdweXRob24zLjEwJzpcbiAgICAgICAgcmV0dXJuIGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzEwO1xuICAgICAgY2FzZSAncHl0aG9uMy4xMSc6XG4gICAgICAgIHJldHVybiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMTtcbiAgICAgIGNhc2UgJ3B5dGhvbjMuMTInOlxuICAgICAgICByZXR1cm4gbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTI7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1g7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWHuuWKm+WApOS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCk6IENvbXB1dGVPdXRwdXRzIHtcbiAgICByZXR1cm4ge1xuICAgICAgLy8gTGFtYmRh5Ye65YqbXG4gICAgICBkb2N1bWVudFByb2Nlc3NvckFybjogdGhpcy5sYW1iZGFGdW5jdGlvbnMuZG9jdW1lbnRQcm9jZXNzb3I/LmZ1bmN0aW9uQXJuLFxuICAgICAgZW1iZWRkaW5nR2VuZXJhdG9yQXJuOiB0aGlzLmxhbWJkYUZ1bmN0aW9ucy5lbWJlZGRpbmdHZW5lcmF0b3I/LmZ1bmN0aW9uQXJuLFxuICAgICAgcXVlcnlQcm9jZXNzb3JBcm46IHRoaXMubGFtYmRhRnVuY3Rpb25zLnF1ZXJ5UHJvY2Vzc29yPy5mdW5jdGlvbkFybixcbiAgICAgIGNoYXRIYW5kbGVyQXJuOiB0aGlzLmxhbWJkYUZ1bmN0aW9ucy5jaGF0SGFuZGxlcj8uZnVuY3Rpb25Bcm4sXG4gICAgICBhdXRoSGFuZGxlckFybjogdGhpcy5sYW1iZGFGdW5jdGlvbnMuYXV0aEhhbmRsZXI/LmZ1bmN0aW9uQXJuLFxuXG4gICAgICAvLyDnm6Poppbjg7vliIbmnpAgTGFtYmRh5Ye65YqbXG4gICAgICBtZXRyaWNzQ29sbGVjdG9yQXJuOiB0aGlzLmxhbWJkYUZ1bmN0aW9ucy5tZXRyaWNzQ29sbGVjdG9yPy5mdW5jdGlvbkFybixcbiAgICAgIGFsZXJ0UHJvY2Vzc29yQXJuOiB0aGlzLmxhbWJkYUZ1bmN0aW9ucy5hbGVydFByb2Nlc3Nvcj8uZnVuY3Rpb25Bcm4sXG4gICAgICBtbFByb2Nlc3NvckFybjogdGhpcy5sYW1iZGFGdW5jdGlvbnMubWxQcm9jZXNzb3I/LmZ1bmN0aW9uQXJuLFxuICAgICAgdGVuYW50TWFuYWdlckFybjogdGhpcy5sYW1iZGFGdW5jdGlvbnMudGVuYW50TWFuYWdlcj8uZnVuY3Rpb25Bcm4sXG5cbiAgICAgIC8vIEFXUyBCYXRjaOWHuuWKm1xuICAgICAgYmF0Y2hDb21wdXRlRW52aXJvbm1lbnRBcm46IHRoaXMuYmF0Y2hDb21wdXRlRW52aXJvbm1lbnQ/LmF0dHJDb21wdXRlRW52aXJvbm1lbnRBcm4sXG4gICAgICBiYXRjaEpvYlF1ZXVlQXJuOiB0aGlzLmJhdGNoSm9iUXVldWU/LnJlZixcblxuICAgICAgLy8gRUNT5Ye65YqbXG4gICAgICBlY3NDbHVzdGVyQXJuOiB0aGlzLmVjc0NsdXN0ZXI/LmNsdXN0ZXJBcm4sXG4gICAgICBlY3NTZXJ2aWNlQXJuczogW10sIC8vIOWwhuadpeWun+ijhVxuXG4gICAgICAvLyBFQ1Llh7rliptcbiAgICAgIG5leHRqc1JlcG9zaXRvcnlVcmk6IHRoaXMuZWNyUmVwb3NpdG9yaWVzLm5leHRqcz8ucmVwb3NpdG9yeVVyaSxcbiAgICAgIGVtYmVkZGluZ1JlcG9zaXRvcnlVcmk6IHRoaXMuZWNyUmVwb3NpdG9yaWVzLmVtYmVkZGluZz8ucmVwb3NpdG9yeVVyaSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCv+OCsOmBqeeUqO+8iElBTeWItumZkOWvvuW/nO+8iVxuICAgKi9cbiAgcHJpdmF0ZSBhcHBseVRhZ3MoKTogdm9pZCB7XG4gICAgY29uc3QgdGFncyA9IHRoaXMucHJvcHMuY29uZmlnLnRhZ3M7XG5cbiAgICAvLyDmnIDph43opoHjgr/jgrDjga7jgb/vvIhJQU3liLbpmZDlr77lv5zvvIlcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0NvbXB1dGVUeXBlJywgdGFncy5Db21wdXRlVHlwZSk7XG4gIH1cbn0iXX0=