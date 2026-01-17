#!/usr/bin/env node
/**
 * FSx for NetApp ONTAP Embedding Batch Workload Template
 * CDK Application Entry Point - 型安全性とエラーハンドリング強化版
 */

/// <reference types="node" />
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { getDeploymentConfig } from '../lib/config/deployment-config';
import { DeploymentConfig } from '../lib/config/interfaces/deployment-config-interfaces';
import { ConfigurationValidator } from '../lib/config/validation';
import { EmbeddingWorkloadStack } from '../lib/stacks/embedding-workload-stack';

/**
 * 設定サマリーインターフェース
 */
interface ConfigSummary {
  readonly projectName: string;
  readonly environment: string;
  readonly region: string;
}

/**
 * 環境変数インターフェース
 */
interface EnvironmentVariables {
  readonly CDK_DEFAULT_ACCOUNT?: string;
  readonly NODE_ENV?: string;
}

/**
 * ログレベル列挙型
 */
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * アプリケーション定数
 */
const APP_CONSTANTS = {
  TEMPLATE_VERSION: '1.0.0',
  TEMPLATE_NAME: 'embedding-batch-workload-template',
  COMPONENT_NAME: 'EmbeddingWorkload',
  MANAGED_BY: 'CDK',
  ARCHITECTURE: 'Modular',
  SUPPORTED_NODE_ENVS: ['development', 'production', 'test'] as const,
  AWS_ACCOUNT_ID_PATTERN: /^\d{12}$/,
} as const;

/**
 * 構造化ログクラス
 */
class Logger {
  private static level: LogLevel = LogLevel.INFO;

  static info(message: string, data?: any): void {
    if (this.level <= LogLevel.INFO) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ℹ️ ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  static warn(message: string, data?: any): void {
    if (this.level <= LogLevel.WARN) {
      const timestamp = new Date().toISOString();
      console.warn(`[${timestamp}] ⚠️ ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  static error(message: string, data?: any): void {
    if (this.level <= LogLevel.ERROR) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] ❌ ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }
}

/**
 * 設定情報のサニタイズ（機密情報マスキング）
 */
function sanitizeConfig(config: DeploymentConfig): ConfigSummary {
  return {
    projectName: config.projectName,
    environment: config.environment,
    region: config.region
  };
}

/**
 * 環境変数の検証
 */
function validateEnvironmentVariables(env: EnvironmentVariables): void {
  const errors: string[] = [];

  // AWS アカウントID検証
  if (env.CDK_DEFAULT_ACCOUNT && !APP_CONSTANTS.AWS_ACCOUNT_ID_PATTERN.test(env.CDK_DEFAULT_ACCOUNT)) {
    errors.push('CDK_DEFAULT_ACCOUNT must be a 12-digit AWS account ID');
  }

  // NODE_ENV検証
  if (env.NODE_ENV && !APP_CONSTANTS.SUPPORTED_NODE_ENVS.includes(env.NODE_ENV as any)) {
    errors.push(`NODE_ENV must be one of: ${APP_CONSTANTS.SUPPORTED_NODE_ENVS.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * 環境変数の型安全な取得
 */
function getEnvironmentVariables(): EnvironmentVariables {
  return {
    CDK_DEFAULT_ACCOUNT: process.env.CDK_DEFAULT_ACCOUNT,
    NODE_ENV: process.env.NODE_ENV
  };
}

/**
 * スタック名生成関数
 */
function generateStackName(config: DeploymentConfig): string {
  // リージョンプレフィックスの決定
  const regionPrefix = getRegionPrefix(config.region);
  return `${regionPrefix}-${config.projectName}-${config.environment}-Embedding`;
}

/**
 * リージョンプレフィックス取得
 */
function getRegionPrefix(region: string): string {
  const regionPrefixMap: Record<string, string> = {
    'ap-northeast-1': 'TokyoRegion',
    'ap-northeast-3': 'OsakaRegion',
    'us-east-1': 'VirginiaNorthRegion',
    'us-west-2': 'OregonRegion',
    'eu-west-1': 'IrelandRegion',
    'ap-southeast-1': 'SingaporeRegion'
  };

  return regionPrefixMap[region] || 'UnknownRegion';
}

/**
 * EmbeddingWorkloadStack作成関数
 */
function createEmbeddingWorkloadStack(
  app: cdk.App,
  stackName: string,
  config: DeploymentConfig,
  env: EnvironmentVariables,
  computeType: string = 'batch'
): EmbeddingWorkloadStack {
  return new EmbeddingWorkloadStack(app, stackName, {
    env: {
      account: env.CDK_DEFAULT_ACCOUNT || config.aws?.account,
      region: config.region,
    },
    description: `FSx for NetApp ONTAP Embedding Workload (${computeType}) - ${config.environment}`,
    tags: createStackTags(config, computeType),
    config: config,
    computeType: computeType as 'batch' | 'spot-fleet' | 'ecs' | 'all',
  });
}

/**
 * 安全なEmbeddingWorkloadStack作成関数
 */
async function createEmbeddingWorkloadStackSafely(
  app: cdk.App,
  stackName: string,
  config: DeploymentConfig,
  env: EnvironmentVariables,
  computeType: string = 'batch'
): Promise<EmbeddingWorkloadStack> {
  try {
    const stack = createEmbeddingWorkloadStack(app, stackName, config, env, computeType);

    // スタック作成後の検証
    validateStackConfiguration(stack, config);

    return stack;
  } catch (error) {
    Logger.error('Failed to create EmbeddingWorkloadStack', {
      stackName,
      computeType,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * スタック設定検証
 */
function validateStackConfiguration(stack: EmbeddingWorkloadStack, config: DeploymentConfig): void {
  if (!stack.stackName) {
    throw new Error('Stack name is not defined');
  }

  if (!stack.region) {
    throw new Error('Stack region is not defined');
  }

  if (stack.region !== config.region) {
    throw new Error(`Stack region mismatch: expected ${config.region}, got ${stack.region}`);
  }
}

/**
 * スタック作成成功ログ
 */
function logStackCreationSuccess(embeddingStack: EmbeddingWorkloadStack, computeType: string): void {
  try {
    const components: string[] = [];

    // コンピュートタイプに応じたコンポーネント情報を収集
    if (embeddingStack.batchIntegration) {
      components.push('BatchIntegration');
    }
    if (embeddingStack.spotFleetIntegration) {
      components.push('SpotFleetIntegration');
    }
    if (embeddingStack.ecsIntegration) {
      components.push('EcsIntegration');
    }

    Logger.info('Embedding Workload Stack created successfully', {
      stackName: embeddingStack.stackName,
      computeType: computeType,
      components: components,
      lambdaFunction: embeddingStack.getDocumentProcessorLambda().functionName,
      vectorDatabaseIntegration: embeddingStack.vectorDatabaseIntegration.node.id
    });
  } catch (error) {
    Logger.warn('Failed to log stack creation details', {
      stackName: embeddingStack.stackName,
      computeType: computeType,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * スタックタグ作成関数
 */
function createStackTags(config: DeploymentConfig, computeType: string = 'batch'): Record<string, string> {
  return {
    Project: config.projectName,
    Environment: config.environment,
    Component: APP_CONSTANTS.COMPONENT_NAME,
    ComputeType: computeType,
    ManagedBy: APP_CONSTANTS.MANAGED_BY,
    Template: APP_CONSTANTS.TEMPLATE_NAME,
    Version: APP_CONSTANTS.TEMPLATE_VERSION,
    CreatedAt: new Date().toISOString(),
    Region: config.region,
    Architecture: APP_CONSTANTS.ARCHITECTURE,
  };
}

/**
 * グレースフルシャットダウンの設定
 */
function setupGracefulShutdown(): void {
  process.on('SIGINT', () => {
    Logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    Logger.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  const app = new cdk.App();

  try {
    Logger.info('Starting CDK application...');

    // グレースフルシャットダウンの設定
    setupGracefulShutdown();

    // 並列処理で効率化
    const [config, env] = await Promise.all([
      Promise.resolve(getDeploymentConfig()),
      Promise.resolve(getEnvironmentVariables())
    ]);

    // 環境変数検証
    validateEnvironmentVariables(env);

    // 設定検証の実行
    const validationResult = ConfigurationValidator.validateConfig(config);
    if (!validationResult.isValid) {
      Logger.error('Configuration validation failed', { errors: validationResult.errors });
      process.exit(1);
    }

    if (validationResult.warnings.length > 0) {
      Logger.warn('Configuration warnings detected', { warnings: validationResult.warnings });
    }

    // サニタイズされた設定情報の表示
    const configSummary = sanitizeConfig(config);
    Logger.info('Configuration loaded successfully', configSummary);

    // Agent Steeringルール準拠のスタック名生成
    const stackName = generateStackName(config);

    Logger.info('Creating Embedding Workload Stack', { stackName });

    // コンピュートタイプの決定と検証
    const computeType = config.computeType || 'batch';

    // 型安全性とセキュリティのための検証
    const validComputeTypes = ['batch', 'spot-fleet', 'ecs', 'all'] as const;
    if (!validComputeTypes.includes(computeType as any)) {
      Logger.error('Invalid compute type specified', {
        computeType,
        validTypes: validComputeTypes
      });
      throw new Error(`Invalid compute type: ${computeType}. Must be one of: ${validComputeTypes.join(', ')}`);
    }

    Logger.info('Compute type configuration validated', {
      computeType,
      isDefault: !config.computeType,
      availableTypes: validComputeTypes
    });

    // 完全なEmbedding Workload Stackの作成
    const embeddingStack = await createEmbeddingWorkloadStackSafely(app, stackName, config, env, computeType);

    // スタック作成成功ログ
    logStackCreationSuccess(embeddingStack, computeType);

    // CloudFormation テンプレート出力用のメタデータ
    app.node.setContext('@aws-cdk/core:enableStackNameDuplicates', true);
    app.node.setContext('aws-cdk:enableDiffNoFail', true);

    // デプロイされたコンポーネントの動的リスト作成
    const componentsDeployed: string[] = ['VectorDatabaseIntegration', 'DocumentProcessorLambda'];

    if (computeType === 'batch' || computeType === 'all') {
      componentsDeployed.push('SimplifiedBatchIntegration', 'DocumentProcessingJob', 'EmbeddingGenerationJob');
    }
    if (computeType === 'spot-fleet' || computeType === 'all') {
      componentsDeployed.push('SpotFleetIntegration');
    }
    if (computeType === 'ecs' || computeType === 'all') {
      componentsDeployed.push('EcsIntegration');
    }

    Logger.info('CDK Application initialized successfully', {
      stackName,
      region: config.region,
      environment: config.environment,
      computeType: computeType,
      componentsDeployed: componentsDeployed
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    Logger.error('CDK Application initialization failed', {
      message: errorMessage,
      stack: env.NODE_ENV === 'development' ? errorStack : undefined,
      timestamp: new Date().toISOString()
    });

    // 開発環境では詳細なスタックトレースを表示
    if (env.NODE_ENV === 'development' && errorStack) {
      console.error('\nDetailed stack trace:');
      console.error(errorStack);
    }

    process.exit(1);
  }
}

// 環境変数の取得（グローバルスコープで必要）
const env = getEnvironmentVariables();

// メイン処理の実行
main().catch((error) => {
  Logger.error('Unhandled error in main process', {
    message: error instanceof Error ? error.message : String(error),
    stack: env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});