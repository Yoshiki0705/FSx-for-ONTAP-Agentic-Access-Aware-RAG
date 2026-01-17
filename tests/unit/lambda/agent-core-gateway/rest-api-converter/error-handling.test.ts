/**
 * REST API Converter - Error Handling Tests
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import { handler } from '../../../../../lambda/agent-core-gateway/rest-api-converter/index';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  mockS3EmptyResponse,
  mockS3JsonResponse,
  mockS3YamlResponse,
  resetAllMocks,
} from './helpers/test-helpers';
import { Readable } from 'stream';
import { s3Mock } from './helpers/test-helpers';
import { GetObjectCommand } from '@aws-sdk/client-s3';

describe('REST API Converter - エラーハンドリング', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  test('必須環境変数が設定されていない場合、エラーを返す', async () => {
    delete process.env.FSX_ONTAP_ACCESS_POINT_ARN;

    const event = {
      openApiSpecPath: 's3://test-bucket/openapi.json',
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toContain('必須環境変数が設定されていません');
    expect(response.error).toContain('FSX_ONTAP_ACCESS_POINT_ARN');
  });

  test('無効なS3 URIの場合、エラーを返す', async () => {
    const event = {
      openApiSpecPath: 'invalid-uri',
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });

  test('S3オブジェクトが見つからない場合、エラーを返す', async () => {
    mockS3EmptyResponse();

    const event = {
      openApiSpecPath: 's3://test-bucket/openapi.json',
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toContain('S3オブジェクトが見つかりません');
  });

  test('無効なJSON形式の場合、エラーを返す', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: Readable.from(['invalid json']),
    });

    const event = {
      openApiSpecPath: 's3://test-bucket/openapi.json',
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });

  test('無効なYAML形式の場合、エラーを返す', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: Readable.from(['invalid: yaml: format:']),
    });

    const event = {
      openApiSpecPath: 's3://test-bucket/openapi.yaml',
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });
});
