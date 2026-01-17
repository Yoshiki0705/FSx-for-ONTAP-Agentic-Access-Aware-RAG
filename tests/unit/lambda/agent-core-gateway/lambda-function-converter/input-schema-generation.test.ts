/**
 * Lambda Function Converter - Input Schema Generation Tests
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

describe('Lambda Function Converter - Input Schema生成', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  it('自動生成（デフォルト）でInput Schemaが生成される', async () => {
    mockLambdaFunction({
      functionName: 'test-function',
    });

    const event: LambdaFunctionConverterEvent = {
      functionName: 'test-function',
      schemaGenerationMethod: 'auto',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition?.inputSchema.json).toEqual({
      type: 'object',
      properties: {
        input: {
          type: 'object',
          description: 'Lambda関数への入力パラメータ',
          additionalProperties: true,
        },
      },
      required: [],
    });
  });

  it('タグからInput Schemaが生成される', async () => {
    const customSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID',
        },
        action: {
          type: 'string',
          description: 'Action to perform',
        },
      },
      required: ['userId'],
    };

    mockLambdaFunction({
      functionName: 'test-function',
      tags: {
        InputSchema: JSON.stringify(customSchema),
      },
    });

    const event: LambdaFunctionConverterEvent = {
      functionName: 'test-function',
      schemaGenerationMethod: 'tags',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition?.inputSchema.json).toEqual(customSchema);
  });

  it('手動指定のInput Schemaが使用される', async () => {
    const manualSchema = {
      type: 'object',
      properties: {
        customField: {
          type: 'string',
          description: 'Custom field',
        },
      },
      required: ['customField'],
    };

    mockLambdaFunction({
      functionName: 'test-function',
    });

    const event: LambdaFunctionConverterEvent = {
      functionName: 'test-function',
      schemaGenerationMethod: 'manual',
      inputSchema: manualSchema,
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinition?.inputSchema.json).toEqual(manualSchema);
  });
});
