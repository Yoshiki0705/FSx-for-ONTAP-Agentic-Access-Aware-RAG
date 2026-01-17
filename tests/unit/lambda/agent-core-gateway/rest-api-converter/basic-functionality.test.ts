/**
 * REST API Converter - Basic Functionality Tests
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import { handler } from '../../../../../lambda/agent-core-gateway/rest-api-converter/index';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  mockS3JsonResponse,
  mockS3YamlResponse,
  resetAllMocks,
} from './helpers/test-helpers';
import { sampleOpenApiSpec } from './fixtures/sample-openapi-spec';

describe('REST API Converter - 基本機能', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  test('OpenAPI仕様が正しくパースされる（JSON形式）', async () => {
    mockS3JsonResponse(sampleOpenApiSpec);

    const event = {
      openApiSpecPath: 's3://test-bucket/openapi.json',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();
    expect(response.toolDefinitions!.length).toBe(3); // GET /users, POST /users, GET /users/{userId}
  });

  test('OpenAPI仕様が正しくパースされる（YAML形式）', async () => {
    const yamlSpec = `
openapi: 3.0.0
info:
  title: Sample API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: listUsers
      summary: List all users
      responses:
        '200':
          description: Successful response
`;
    mockS3YamlResponse(yamlSpec);

    const event = {
      openApiSpecPath: 's3://test-bucket/openapi.yaml',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();
    expect(response.toolDefinitions!.length).toBe(1); // GET /users
  });

  test('Bedrock Agent Tool定義が正しく生成される', async () => {
    mockS3JsonResponse(sampleOpenApiSpec);

    const event = {
      openApiSpecPath: 's3://test-bucket/openapi.json',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();

    const listUsersTool = response.toolDefinitions!.find(t => t.name === 'listUsers');
    expect(listUsersTool).toBeDefined();
    expect(listUsersTool!.description).toBe('Retrieve a list of all users');
    expect(listUsersTool!.inputSchema.type).toBe('object');
    expect(listUsersTool!.inputSchema.properties).toHaveProperty('limit');
    expect(listUsersTool!.apiEndpoint.method).toBe('GET');
    expect(listUsersTool!.apiEndpoint.path).toBe('/users');
  });

  test('Tool名プレフィックスが正しく適用される', async () => {
    setupTestEnvironment({ TOOL_NAME_PREFIX: 'api' });
    mockS3JsonResponse(sampleOpenApiSpec);

    const event = {
      openApiSpecPath: 's3://test-bucket/openapi.json',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();

    const listUsersTool = response.toolDefinitions!.find(t => t.name === 'api_listUsers');
    expect(listUsersTool).toBeDefined();
  });

  test('除外パターンが正しく適用される', async () => {
    setupTestEnvironment({ EXCLUDE_PATTERNS: JSON.stringify(['/users/\\{userId\\}']) });
    mockS3JsonResponse(sampleOpenApiSpec);

    const event = {
      openApiSpecPath: 's3://test-bucket/openapi.json',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();
    expect(response.toolDefinitions!.length).toBe(2); // GET /users, POST /users のみ

    const getUserTool = response.toolDefinitions!.find(t => t.name === 'getUser');
    expect(getUserTool).toBeUndefined(); // 除外されている
  });
});
