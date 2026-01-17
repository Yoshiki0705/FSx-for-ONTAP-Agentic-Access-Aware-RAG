/**
 * REST API Converter - FSx for ONTAP + S3 Access Points Integration Tests
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import { handler } from '../../../../../lambda/agent-core-gateway/rest-api-converter/index';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  mockS3JsonResponse,
  mockS3Error,
  s3Mock,
  resetAllMocks,
} from './helpers/test-helpers';
import { sampleOpenApiSpec } from './fixtures/sample-openapi-spec';

describe('REST API Converter - FSx for ONTAP + S3 Access Points統合', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  test('S3 Access Point ARNとキーが正しく使用される', async () => {
    mockS3JsonResponse(sampleOpenApiSpec);

    const event = {
      openApiSpecPath: 's3://my-bucket/path/to/openapi.json',
    };

    const response = await handler(event);

    // S3 Mockが正しく呼ばれたことを検証
    expect(s3Mock.calls()).toHaveLength(1);
    const call = s3Mock.call(0);
    
    // FSx for ONTAP + S3 Access Point ARNが使用されていることを確認
    expect(call.args[0].input).toEqual({
      Bucket: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/test-fsx-ontap-access-point',
      Key: 'path/to/openapi.json',
    });

    expect(response.success).toBe(true);
  });

  test('S3エラーが正しくハンドリングされる', async () => {
    mockS3Error('S3 Access Denied');

    const event = {
      openApiSpecPath: 's3://test-bucket/openapi.json',
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toContain('S3 Access Denied');
  });

  test('大きなOpenAPI仕様が正しく処理される', async () => {
    const largeSpec = {
      ...sampleOpenApiSpec,
      paths: {},
    };

    // 100個のパスを追加
    for (let i = 0; i < 100; i++) {
      largeSpec.paths[`/resource${i}`] = {
        get: {
          operationId: `getResource${i}`,
          summary: `Get resource ${i}`,
          responses: {
            '200': { description: 'Success' },
          },
        },
      };
    }

    mockS3JsonResponse(largeSpec);

    const event = {
      openApiSpecPath: 's3://test-bucket/openapi.json',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();
    expect(response.toolDefinitions!.length).toBe(100);
  });

  test('複数のコンテンツタイプが正しく処理される', async () => {
    const multiContentSpec = {
      openapi: '3.0.0',
      info: { title: 'Multi Content API', version: '1.0.0' },
      paths: {
        '/data': {
          post: {
            operationId: 'uploadData',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'string' },
                    },
                  },
                },
                'application/xml': {
                  schema: {
                    type: 'string',
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Success' },
            },
          },
        },
      },
    };

    mockS3JsonResponse(multiContentSpec);

    const event = {
      openApiSpecPath: 's3://test-bucket/openapi.json',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();
    expect(response.toolDefinitions!.length).toBe(1);

    const uploadDataTool = response.toolDefinitions![0];
    expect(uploadDataTool.inputSchema.properties).toHaveProperty('data');
  });

  test('環境変数のデフォルト値が正しく使用される', async () => {
    mockS3JsonResponse(sampleOpenApiSpec);

    const event = {};

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();

    // API Gateway IDとStageが環境変数から取得されていることを確認
    const tool = response.toolDefinitions![0];
    expect(tool.apiEndpoint.apiGatewayId).toBe('test-api-gateway');
    expect(tool.apiEndpoint.stage).toBe('prod');
  });
});
