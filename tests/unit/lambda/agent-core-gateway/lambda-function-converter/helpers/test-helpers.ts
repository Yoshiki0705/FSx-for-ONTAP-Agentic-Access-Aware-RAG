/**
 * Lambda Function Converter - Test Helpers
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import { 
  LambdaClient, 
  GetFunctionCommand, 
  GetFunctionConfigurationCommand, 
  ListTagsCommand,
  ResourceNotFoundException 
} from '@aws-sdk/client-lambda';
import { mockClient } from 'aws-sdk-client-mock';

// Lambda Clientのモック
export const lambdaMock = mockClient(LambdaClient);

/**
 * デフォルトのLambda設定
 */
export const DEFAULT_LAMBDA_CONFIG = {
  runtime: 'nodejs20.x',
  memorySize: 128,
  timeout: 3,
  region: 'ap-northeast-1',
  accountId: '123456789012',
} as const;

/**
 * Lambda関数モック設定の型定義
 */
export interface MockLambdaFunctionConfig {
  functionName: string;
  functionArn?: string;
  description?: string;
  runtime?: string;
  memorySize?: number;
  timeout?: number;
  environment?: Record<string, string>;
  tags?: Record<string, string>;
}

/**
 * テスト環境のセットアップ
 * 
 * @param overrides - 環境変数のオーバーライド
 * @throws {Error} 必須環境変数が不足している場合
 */
export function setupTestEnvironment(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  const defaults = {
    AWS_REGION: 'ap-northeast-1',
    PROJECT_NAME: 'test-project',
    ENVIRONMENT: 'test',
  };
  
  const config = { ...defaults, ...overrides };
  
  // 必須環境変数のバリデーション
  const required = ['AWS_REGION', 'PROJECT_NAME', 'ENVIRONMENT'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  Object.assign(process.env, config);
}

/**
 * テスト環境のクリーンアップ
 */
export function cleanupTestEnvironment() {
  delete process.env.AWS_REGION;
  delete process.env.PROJECT_NAME;
  delete process.env.ENVIRONMENT;
}

/**
 * Lambda関数メタデータをモック
 * 
 * @param config - Lambda関数設定
 */
export function mockLambdaFunction(config: MockLambdaFunctionConfig) {
  const arn = config.functionArn || 
    `arn:aws:lambda:${DEFAULT_LAMBDA_CONFIG.region}:${DEFAULT_LAMBDA_CONFIG.accountId}:function:${config.functionName}`;
  
  lambdaMock.on(GetFunctionConfigurationCommand).resolves({
    FunctionName: config.functionName,
    FunctionArn: arn,
    Description: config.description,
    Runtime: config.runtime || DEFAULT_LAMBDA_CONFIG.runtime,
    MemorySize: config.memorySize || DEFAULT_LAMBDA_CONFIG.memorySize,
    Timeout: config.timeout || DEFAULT_LAMBDA_CONFIG.timeout,
    Environment: config.environment ? { Variables: config.environment } : undefined,
  });

  lambdaMock.on(GetFunctionCommand).resolves({
    Configuration: {
      FunctionName: config.functionName,
      FunctionArn: arn,
    },
  });

  lambdaMock.on(ListTagsCommand).resolves({
    Tags: config.tags || {},
  });
}

/**
 * Lambda関数が存在しないエラーをモック
 * 
 * @param functionName - 関数名（オプション）
 */
export function mockLambdaFunctionNotFound(functionName?: string) {
  const error = new ResourceNotFoundException({
    $metadata: { httpStatusCode: 404 },
    message: functionName 
      ? `Function not found: ${functionName}` 
      : 'Function not found',
  });
  
  lambdaMock.on(GetFunctionConfigurationCommand).rejects(error);
}

/**
 * Lambda APIエラーをモック
 * 
 * @param errorMessage - エラーメッセージ
 */
export function mockLambdaApiError(errorMessage: string = 'AccessDeniedException: User is not authorized') {
  lambdaMock.on(GetFunctionConfigurationCommand).rejects(
    new Error(errorMessage)
  );
}

/**
 * タグ取得エラーをモック
 */
export function mockListTagsError() {
  lambdaMock.on(ListTagsCommand).rejects(
    new Error('Access denied')
  );
}

/**
 * 全てのモックをリセット
 */
export function resetAllMocks() {
  lambdaMock.reset();
}

/**
 * モック呼び出しの検証ヘルパー
 * 
 * @returns モック呼び出し情報
 */
export function verifyLambdaMockCalls() {
  return {
    getFunctionConfigurationCalls: lambdaMock.commandCalls(GetFunctionConfigurationCommand),
    getFunctionCalls: lambdaMock.commandCalls(GetFunctionCommand),
    listTagsCalls: lambdaMock.commandCalls(ListTagsCommand),
  };
}

/**
 * モックが指定回数呼び出されたことを検証
 * 
 * @param command - 検証するコマンド
 * @param times - 期待される呼び出し回数
 * @throws {Error} 呼び出し回数が一致しない場合
 */
export function assertLambdaMockCalled(command: any, times: number = 1) {
  const calls = lambdaMock.commandCalls(command);
  if (calls.length !== times) {
    throw new Error(
      `Expected ${command.name} to be called ${times} times, but was called ${calls.length} times`
    );
  }
}
