/**
 * コンピュートコンストラクト
 * 
 * Lambda、AWS Batch、ECSの統合管理を提供
 * 既存の監視・分析実装と自動スケーリング機能を統合
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { ComputeConfig, ComputeOutputs, LambdaFunctionConfig, LambdaAutoScalingConfig } from '../interfaces/compute-config';
import { LambdaFunctionFactory, BasicLambdaStrategy } from './lambda-construct-factory';
import { LambdaConfigBuilder, LambdaConfigTemplates } from './compute-config-builder';
import { ConfigurationValidator } from './validation-chain';

/**
 * Lambda関数のデフォルト設定定数
 */
const LAMBDA_DEFAULTS = {
  RUNTIME: 'nodejs20.x' as const,
  HANDLER: 'index.handler' as const,
  ARCHITECTURE: lambda.Architecture.ARM_64,
  LOG_RETENTION_DAYS: logs.RetentionDays.TWO_WEEKS,
  WARMUP_INTERVAL_MINUTES: 5,
} as const;

/**
 * ECRリポジトリ設定定数
 */
const ECR_DEFAULTS = {
  MAX_IMAGE_COUNT: 10,
  EMBEDDING_MAX_IMAGE_COUNT: 5,
  SCAN_ON_PUSH: true,
} as const;

/**
 * 自動スケーリング設定定数
 */
const AUTO_SCALING_DEFAULTS = {
  MIN_CONCURRENCY: 10,
  MAX_CONCURRENCY: 1000,
  TARGET_UTILIZATION: 70,
  SCALE_OUT_COOLDOWN_SECONDS: 60,
  SCALE_IN_COOLDOWN_SECONDS: 300,
} as const;

/**
 * Lambda関数設定のベースインターフェース
 */
interface BaseLambdaConfig {
  functionName: string;
  runtime: string;
  handler: string;
  timeout: number;
  memorySize: number;
  environment: { [key: string]: string };
}

/**
 * Lambda関数設定ファクトリー
 */
class LambdaConfigFactory {
  constructor(
    private projectName: string,
    private environment: string,
    private sessionTableName?: string
  ) {}

  /**
   * 基本設定を生成
   */
  private createBaseConfig(functionType: string): Partial<BaseLambdaConfig> {
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
  createMetricsCollectorConfig(): BaseLambdaConfig {
    return {
      ...this.createBaseConfig('metrics-collector'),
      timeout: 300,
      memorySize: 512,
    } as BaseLambdaConfig;
  }

  /**
   * アラート処理Lambda設定
   */
  createAlertProcessorConfig(): BaseLambdaConfig {
    return {
      ...this.createBaseConfig('alert-processor'),
      timeout: 180,
      memorySize: 256,
    } as BaseLambdaConfig;
  }

  /**
   * ML処理Lambda設定
   */
  createMLProcessorConfig(): BaseLambdaConfig {
    return {
      ...this.createBaseConfig('ml-processor'),
      timeout: 900,
      memorySize: 1024,
    } as BaseLambdaConfig;
  }

  /**
   * テナント管理Lambda設定
   */
  createTenantManagerConfig(): BaseLambdaConfig {
    const config = {
      ...this.createBaseConfig('tenant-manager'),
      timeout: 300,
      memorySize: 512,
    } as BaseLambdaConfig;

    if (this.sessionTableName) {
      config.environment.SESSION_TABLE = this.sessionTableName;
    }

    return config;
  }
}

export interface ComputeConstructProps {
  config: ComputeConfig;
  projectName: string;
  environment: string;
  vpc?: ec2.IVpc;
  kmsKey?: kms.IKey;
  privateSubnetIds?: string[];
  documentsBucket?: s3.IBucket;
  embeddingsBucket?: s3.IBucket;
  sessionTable?: dynamodb.ITable;
  openSearchCollection?: any;
}

export class ComputeConstruct extends Construct {
  public readonly outputs: ComputeOutputs;
  public readonly lambdaFunctions: { [key: string]: lambda.Function } = {};
  public readonly lambdaRole: iam.Role;
  public readonly autoScalingTargets: { [key: string]: applicationautoscaling.ScalableTarget } = {};
  public readonly batchComputeEnvironment?: batch.CfnComputeEnvironment;
  public readonly batchJobQueue?: batch.CfnJobQueue;
  public readonly ecsCluster?: ecs.Cluster;
  public readonly ecrRepositories: { [key: string]: ecr.Repository } = {};

  constructor(scope: Construct, id: string, private props: ComputeConstructProps) {
    super(scope, id);

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
    } catch (error) {
      console.error(`❌ ComputeConstruct初期化エラー: ${error}`);
      throw error;
    }
  }

  /**
   * 設定検証（Chain of Responsibility パターン）
   */
  private validateConfigurationWithChain(): void {
    const validationResult = ConfigurationValidator.validate(this.props);
    
    // 検証結果をログ出力
    ConfigurationValidator.logValidationResult(validationResult);
    
    // エラーがある場合は例外をスロー
    if (!validationResult.isValid) {
      throw new Error(`設定検証に失敗しました: ${validationResult.errors.join(', ')}`);
    }
  }

  /**
   * 設定検証（従来版 - 後方互換性のため保持）
   * @deprecated validateConfigurationWithChain() を使用してください
   */
  private validateConfiguration(): void {
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
  private createLambdaExecutionRole(): iam.Role {
    const role = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: `Lambda execution role for ${this.props.projectName}`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // VPC設定が有効な場合
    if (this.props.config.lambda.common.vpcConfig?.enabled) {
      role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
      );
    }

    // X-Ray設定が有効な場合
    if (this.props.config.lambda.common.enableXRayTracing) {
      role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
      );
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
  private createECRRepositories(): void {
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
  private createLambdaFunctionsWithFactory(): void {
    const functions = this.props.config.lambda.functions;

    // Lambda関数ファクトリーを初期化
    const strategy = new BasicLambdaStrategy(
      this.props.config.lambda.common.logRetention,
      this.props.config.lambda.common.architecture === 'arm64' 
        ? lambda.Architecture.ARM_64 
        : lambda.Architecture.X86_64
    );
    const factory = new LambdaFunctionFactory(strategy);

    // 基本RAG関数
    this.createBasicRAGFunctionsWithFactory(functions, factory);

    // 監視・分析統合関数
    this.createMonitoringAnalyticsFunctionsWithFactory(functions, factory);
  }

  /**
   * Lambda関数作成（従来版 - 後方互換性のため保持）
   * @deprecated createLambdaFunctionsWithFactory() を使用してください
   */
  private createLambdaFunctions(): void {
    const functions = this.props.config.lambda.functions;

    // 基本RAG関数
    this.createBasicRAGFunctions(functions);

    // 監視・分析統合関数
    this.createMonitoringAnalyticsFunctions(functions);
  }

  /**
   * 基本RAG関数作成
   */
  private createBasicRAGFunctions(functions: any): void {
    // ドキュメント処理Lambda
    if (functions.documentProcessor.enabled) {
      this.lambdaFunctions.documentProcessor = this.createLambdaFunction(
        'DocumentProcessor',
        {
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
        },
        'documentprocessor'
      );
    }

    // 埋め込み生成Lambda
    if (functions.embeddingGenerator.enabled) {
      this.lambdaFunctions.embeddingGenerator = this.createLambdaFunction(
        'EmbeddingGenerator',
        {
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
        },
        'embeddinggenerator'
      );
    }

    // クエリ処理Lambda
    if (functions.queryProcessor.enabled) {
      this.lambdaFunctions.queryProcessor = this.createLambdaFunction(
        'QueryProcessor',
        {
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
        },
        'queryprocessor'
      );
    }

    // チャットハンドラーLambda
    if (functions.chatHandler.enabled) {
      this.lambdaFunctions.chatHandler = this.createLambdaFunction(
        'ChatHandler',
        {
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
        },
        'chathandler'
      );
    }

    // 認証ハンドラーLambda
    if (functions.authHandler.enabled) {
      this.lambdaFunctions.authHandler = this.createLambdaFunction(
        'AuthHandler',
        {
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
        },
        'authhandler'
      );
    }
  }

  /**
   * 基本RAG関数作成（Factory パターン）
   */
  private createBasicRAGFunctionsWithFactory(functions: any, factory: LambdaFunctionFactory): void {
    // ドキュメント処理Lambda
    if (functions.documentProcessor?.enabled) {
      const config = LambdaConfigTemplates
        .heavyProcessing(`${this.props.projectName}-${this.props.environment}-document-processor`)
        .withRuntime(functions.documentProcessor.runtime)
        .withTimeout(functions.documentProcessor.timeout)
        .withMemorySize(functions.documentProcessor.memorySize)
        .addEnvironmentVariable('DOCUMENTS_BUCKET', this.props.documentsBucket?.bucketName || '')
        .addEnvironmentVariable('EMBEDDINGS_BUCKET', this.props.embeddingsBucket?.bucketName || '')
        .build();

      this.lambdaFunctions.documentProcessor = factory.createFunction(
        this, 'DocumentProcessor', config, this.lambdaRole
      );
    }

    // 埋め込み生成Lambda
    if (functions.embeddingGenerator?.enabled) {
      const config = LambdaConfigTemplates
        .heavyProcessing(`${this.props.projectName}-${this.props.environment}-embedding-generator`)
        .withRuntime(functions.embeddingGenerator.runtime)
        .withTimeout(functions.embeddingGenerator.timeout)
        .withMemorySize(functions.embeddingGenerator.memorySize)
        .addEnvironmentVariable('EMBEDDINGS_BUCKET', this.props.embeddingsBucket?.bucketName || '')
        .build();

      this.lambdaFunctions.embeddingGenerator = factory.createFunction(
        this, 'EmbeddingGenerator', config, this.lambdaRole
      );
    }

    // クエリ処理Lambda
    if (functions.queryProcessor?.enabled) {
      const config = LambdaConfigTemplates
        .realtime(`${this.props.projectName}-${this.props.environment}-query-processor`)
        .withRuntime(functions.queryProcessor.runtime)
        .withTimeout(functions.queryProcessor.timeout)
        .withMemorySize(functions.queryProcessor.memorySize)
        .addEnvironmentVariable('SESSION_TABLE', this.props.sessionTable?.tableName || '')
        .build();

      this.lambdaFunctions.queryProcessor = factory.createFunction(
        this, 'QueryProcessor', config, this.lambdaRole
      );
    }

    // チャットハンドラーLambda
    if (functions.chatHandler?.enabled) {
      const config = LambdaConfigTemplates
        .lightweightApi(`${this.props.projectName}-${this.props.environment}-chat-handler`)
        .withRuntime(functions.chatHandler.runtime)
        .withTimeout(functions.chatHandler.timeout)
        .withMemorySize(functions.chatHandler.memorySize)
        .addEnvironmentVariable('SESSION_TABLE', this.props.sessionTable?.tableName || '')
        .build();

      this.lambdaFunctions.chatHandler = factory.createFunction(
        this, 'ChatHandler', config, this.lambdaRole
      );
    }

    // 認証ハンドラーLambda
    if (functions.authHandler?.enabled) {
      const config = LambdaConfigTemplates
        .lightweightApi(`${this.props.projectName}-${this.props.environment}-auth-handler`)
        .withRuntime(functions.authHandler.runtime)
        .withTimeout(functions.authHandler.timeout)
        .withMemorySize(functions.authHandler.memorySize)
        .addEnvironmentVariable('SESSION_TABLE', this.props.sessionTable?.tableName || '')
        .build();

      this.lambdaFunctions.authHandler = factory.createFunction(
        this, 'AuthHandler', config, this.lambdaRole
      );
    }
  }

  /**
   * 監視・分析統合関数作成（Factory パターン）
   */
  private createMonitoringAnalyticsFunctionsWithFactory(functions: any, factory: LambdaFunctionFactory): void {
    if (!functions.monitoringAnalytics?.enabled) return;

    // メトリクス収集Lambda
    if (functions.monitoringAnalytics.metricsCollector?.enabled) {
      const config = LambdaConfigTemplates
        .lightweightApi(`${this.props.projectName}-${this.props.environment}-metrics-collector`)
        .withTimeout(300)
        .withMemorySize(512)
        .build();

      this.lambdaFunctions.metricsCollector = factory.createFunction(
        this, 'MetricsCollector', config, this.lambdaRole
      );
    }

    // アラート処理Lambda
    if (functions.monitoringAnalytics.alertProcessor?.enabled) {
      const config = LambdaConfigTemplates
        .lightweightApi(`${this.props.projectName}-${this.props.environment}-alert-processor`)
        .withTimeout(180)
        .withMemorySize(256)
        .build();

      this.lambdaFunctions.alertProcessor = factory.createFunction(
        this, 'AlertProcessor', config, this.lambdaRole
      );
    }

    // ML処理Lambda
    if (functions.monitoringAnalytics.mlProcessor?.enabled) {
      const config = LambdaConfigTemplates
        .heavyProcessing(`${this.props.projectName}-${this.props.environment}-ml-processor`)
        .withTimeout(900)
        .withMemorySize(1024)
        .build();

      this.lambdaFunctions.mlProcessor = factory.createFunction(
        this, 'MLProcessor', config, this.lambdaRole
      );
    }

    // テナント管理Lambda
    if (functions.monitoringAnalytics.tenantManager?.enabled) {
      const config = LambdaConfigTemplates
        .lightweightApi(`${this.props.projectName}-${this.props.environment}-tenant-manager`)
        .withTimeout(300)
        .withMemorySize(512)
        .addEnvironmentVariable('SESSION_TABLE', this.props.sessionTable?.tableName || '')
        .build();

      this.lambdaFunctions.tenantManager = factory.createFunction(
        this, 'TenantManager', config, this.lambdaRole
      );
    }
  }

  /**
   * 監視・分析統合関数作成（従来版 - 後方互換性のため保持）
   * @deprecated createMonitoringAnalyticsFunctionsWithFactory() を使用してください
   */
  private createMonitoringAnalyticsFunctions(functions: any): void {
    if (!functions.monitoringAnalytics?.enabled) return;

    this.createMetricsCollectorFunction();
    this.createAlertProcessorFunction();
    this.createMLProcessorFunction();
    this.createTenantManagerFunction();
  }

  /**
   * メトリクス収集Lambda関数作成
   */
  private createMetricsCollectorFunction(): void {
    const configFactory = new LambdaConfigFactory(
      this.props.projectName,
      this.props.environment,
      this.props.sessionTable?.tableName
    );
    
    const config = configFactory.createMetricsCollectorConfig();
    this.lambdaFunctions.metricsCollector = this.createLambdaFunction(
      'MetricsCollector',
      config,
      'metrics-collector'
    );
  }

  /**
   * アラート処理Lambda関数作成
   */
  private createAlertProcessorFunction(): void {
    const configFactory = new LambdaConfigFactory(
      this.props.projectName,
      this.props.environment,
      this.props.sessionTable?.tableName
    );
    
    const config = configFactory.createAlertProcessorConfig();
    this.lambdaFunctions.alertProcessor = this.createLambdaFunction(
      'AlertProcessor',
      config,
      'alert-processor'
    );
  }

  /**
   * ML処理Lambda関数作成
   */
  private createMLProcessorFunction(): void {
    const configFactory = new LambdaConfigFactory(
      this.props.projectName,
      this.props.environment,
      this.props.sessionTable?.tableName
    );
    
    const config = configFactory.createMLProcessorConfig();
    this.lambdaFunctions.mlProcessor = this.createLambdaFunction(
      'MLProcessor',
      config,
      'ml-processor'
    );
  }

  /**
   * テナント管理Lambda関数作成
   */
  private createTenantManagerFunction(): void {
    const configFactory = new LambdaConfigFactory(
      this.props.projectName,
      this.props.environment,
      this.props.sessionTable?.tableName
    );
    
    const config = configFactory.createTenantManagerConfig();
    this.lambdaFunctions.tenantManager = this.createLambdaFunction(
      'TenantManager',
      config,
      'tenant-manager'
    );
  }

  /**
   * Lambda関数作成ヘルパー
   */
  private createLambdaFunction(id: string, config: LambdaFunctionConfig, codeDir?: string): lambda.Function {
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
  private createBatchResources(): void {
    if (!this.props.config.batch.enabled) return;

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
  private createECSResources(): void {
    if (!this.props.config.ecs.enabled) return;

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
  private setupAutoScaling(): void {
    if (!this.props.config.lambda.common.enableAutoScaling) return;

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
  private getLambdaRuntime(runtime: string): lambda.Runtime {
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
  private createOutputs(): ComputeOutputs {
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
  private applyTags(): void {
    const tags = this.props.config.tags;

    // 最重要タグのみ（IAM制限対応）
    cdk.Tags.of(this).add('ComputeType', tags.ComputeType);
  }
}