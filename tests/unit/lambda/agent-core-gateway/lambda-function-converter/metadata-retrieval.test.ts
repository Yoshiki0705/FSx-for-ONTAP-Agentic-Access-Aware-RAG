/**
 * Lambda Function Converter - Metadata Retrieval Tests
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import { handler, LambdaFunctionConverterEvent } from '../../../../../lambda/agent-core-gateway/lambda-function-converter/index';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  mockLambdaFunction,
  mockLambdaFunctionNotFound,
  mockListTagsError,
  resetAllMocks,
} from './helpers/test-helpers';

describe('Lambda Function Converter - メタデータ取得', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  it('Lambda関数メタデータが正しく取得される', async () => {
    mockLambdaFunction({
      functionName: 'my-test-function',
      description: 'This is a test function',
      runtime: 'nodejs20.x',
      memorySize: 256,
      timeout: 30,
      environment: {
        KEY1: 'value1',
        KEY2: 'value2',
      },
      tags: {
        Environment: 'test',
        Project: 'test-project',
      },
    });

    const event: LambdaFunctionConverterEvent = {
      functionName: 'my-test-function',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition).toBeDefined();
    expect(response.toolDefinition?.name).toBe('myTestFunction');
    expect(response.toolDefinition?.description).toBe('This is a test function');
  });

  it('Lambda関数が存在しない場合はエラーを返す', async () => {
    mockLambdaFunctionNotFound();

    const event: LambdaFunctionConverterEvent = {
      functionName: 'non-existent-function',
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toContain('Lambda関数メタデータの取得に失敗');
    expect(response.errorCode).toBe('CONVERSION_ERROR');
  });

  it('タグ取得失敗時も処理を継続する', async () => {
    mockLambdaFunction({
      functionName: 'test-function',
    });
    mockListTagsError();

    const event: LambdaFunctionConverterEvent = {
      functionName: 'test-function',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition).toBeDefined();
  });
});
