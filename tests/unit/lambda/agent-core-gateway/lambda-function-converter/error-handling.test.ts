/**
 * Lambda Function Converter - Error Handling Tests
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import { handler, LambdaFunctionConverterEvent } from '../../../../../lambda/agent-core-gateway/lambda-function-converter/index';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  mockLambdaApiError,
  resetAllMocks,
} from './helpers/test-helpers';

describe('Lambda Function Converter - エラーハンドリング', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  it('functionNameが未指定の場合はエラーを返す', async () => {
    const event: LambdaFunctionConverterEvent = {
      functionName: '',
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toBe('functionNameは必須です');
    expect(response.errorCode).toBe('INVALID_INPUT');
  });

  it('Lambda API エラー時は適切なエラーを返す', async () => {
    mockLambdaApiError();

    const event: LambdaFunctionConverterEvent = {
      functionName: 'test-function',
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toContain('Lambda関数メタデータの取得に失敗');
    expect(response.errorCode).toBe('CONVERSION_ERROR');
  });
});
