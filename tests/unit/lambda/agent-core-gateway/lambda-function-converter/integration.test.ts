/**
 * Lambda Function Converter - Integration Tests
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

describe('Lambda Function Converter - 統合テスト', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  it('完全なTool定義が正しく生成される', async () => {
    const customSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID',
        },
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete'],
          description: 'Action to perform',
        },
      },
      required: ['userId', 'action'],
    };

    mockLambdaFunction({
      functionName: 'user-management-function',
      description: 'Manages user operations',
      runtime: 'nodejs20.x',
      memorySize: 512,
      timeout: 60,
      tags: {
        InputSchema: JSON.stringify(customSchema),
        Environment: 'production',
      },
    });

    const event: LambdaFunctionConverterEvent = {
      functionName: 'user-management-function',
      schemaGenerationMethod: 'tags',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition).toEqual({
      name: 'userManagementFunction',
      description: 'Manages user operations',
      inputSchema: {
        json: customSchema,
      },
    });
  });
});
