/**
 * REST API Converter - Test Helpers
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { Readable } from 'stream';

// AWS SDK Mock
export const s3Mock = mockClient(S3Client);

/**
 * テスト環境のセットアップ
 * 
 * @param overrides - 環境変数のオーバーライド
 */
export function setupTestEnvironment(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  const defaults = {
    PROJECT_NAME: 'test-project',
    ENVIRONMENT: 'test',
    OPENAPI_SPEC_PATH: 's3://test-bucket/openapi.yaml',
    FSX_ONTAP_ACCESS_POINT_ARN: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/test-fsx-ontap-access-point',
    API_GATEWAY_ID: 'test-api-gateway',
    API_GATEWAY_STAGE: 'prod',
  };
  
  Object.assign(process.env, defaults, overrides);
}

/**
 * テスト環境のクリーンアップ
 */
export function cleanupTestEnvironment() {
  delete process.env.PROJECT_NAME;
  delete process.env.ENVIRONMENT;
  delete process.env.OPENAPI_SPEC_PATH;
  delete process.env.FSX_ONTAP_ACCESS_POINT_ARN;
  delete process.env.API_GATEWAY_ID;
  delete process.env.API_GATEWAY_STAGE;
  delete process.env.TOOL_NAME_PREFIX;
  delete process.env.EXCLUDE_PATTERNS;
}

/**
 * S3からのJSON取得をモック
 * 
 * @param spec - OpenAPI仕様オブジェクト
 */
export function mockS3JsonResponse(spec: any) {
  const jsonSpec = JSON.stringify(spec);
  s3Mock.on(GetObjectCommand).resolves({
    Body: Readable.from([jsonSpec]),
  });
}

/**
 * S3からのYAML取得をモック
 * 
 * @param yamlContent - YAML文字列
 */
export function mockS3YamlResponse(yamlContent: string) {
  s3Mock.on(GetObjectCommand).resolves({
    Body: Readable.from([yamlContent]),
  });
}

/**
 * S3エラーをモック
 * 
 * @param errorMessage - エラーメッセージ
 */
export function mockS3Error(errorMessage: string = 'S3 Access Denied') {
  s3Mock.on(GetObjectCommand).rejects(new Error(errorMessage));
}

/**
 * S3空レスポンスをモック
 */
export function mockS3EmptyResponse() {
  s3Mock.on(GetObjectCommand).resolves({
    Body: undefined,
  });
}

/**
 * 全てのモックをリセット
 */
export function resetAllMocks() {
  s3Mock.reset();
}
