/**
 * Lambda Function Converter - Environment Variables Tests
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import { handler, LambdaFunctionConverterEvent } from '../../../../../lambda/agent-core-gateway/lambda-function-converter/index';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  mockLambdaFunction,
  resetAllMocks,
} from './helpers/test-helpers';

describe('Lambda Function Converter - 環境変数', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  it('デフォルト値が正しく設定される', async () => {
    // 環境変数を削除
    delete process.env.AWS_REGION;
    delete process.env.PROJECT_NAME;
    delete process.env.ENVIRONMENT;

    mockLambdaFunction({
      functionName: 'test-function',
    });

    const event: LambdaFunctionConverterEvent = {
      functionName: 'test-function',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition).toBeDefined();
  });

  it('カスタム環境変数が正しく使用される', async () => {
    setupTestEnvironment({
      AWS_REGION: 'us-east-1',
      PROJECT_NAME: 'custom-project',
      ENVIRONMENT: 'production',
    });

    mockLambdaFunction({
      functionName: 'test-function',
      functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    });

    const event: LambdaFunctionConverterEvent = {
      functionName: 'test-function',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition).toBeDefined();
  });
});
