/**
 * Lambda Function Converter - Tool Description Generation Tests
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

describe('Lambda Function Converter - Tool説明生成', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  it('Lambda関数の説明がTool説明として使用される', async () => {
    mockLambdaFunction({
      functionName: 'test-function',
      description: 'This function processes user data',
    });

    const event: LambdaFunctionConverterEvent = {
      functionName: 'test-function',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition?.description).toBe('This function processes user data');
  });

  it('カスタム説明が優先される', async () => {
    mockLambdaFunction({
      functionName: 'test-function',
      description: 'Original description',
    });

    const event: LambdaFunctionConverterEvent = {
      functionName: 'test-function',
      description: 'Custom tool description',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition?.description).toBe('Custom tool description');
  });
});
