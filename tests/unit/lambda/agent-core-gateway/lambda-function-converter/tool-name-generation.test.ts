/**
 * Lambda Function Converter - Tool Name Generation Tests
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

describe('Lambda Function Converter - Tool名生成', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  it('Lambda関数名からキャメルケースのTool名が生成される', async () => {
    mockLambdaFunction({
      functionName: 'my-lambda-function',
    });

    const event: LambdaFunctionConverterEvent = {
      functionName: 'my-lambda-function',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition?.name).toBe('myLambdaFunction');
  });

  it('カスタムTool名が優先される', async () => {
    mockLambdaFunction({
      functionName: 'my-lambda-function',
    });

    const event: LambdaFunctionConverterEvent = {
      functionName: 'my-lambda-function',
      toolName: 'customToolName',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition?.name).toBe('customToolName');
  });

  it('アンダースコアを含む関数名が正しく変換される', async () => {
    mockLambdaFunction({
      functionName: 'my_lambda_function',
    });

    const event: LambdaFunctionConverterEvent = {
      functionName: 'my_lambda_function',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition?.name).toBe('myLambdaFunction');
  });
});
