/**
 * MCP Server Integration - Error Handling Tests
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import { handler } from '../../../../../lambda/agent-core-gateway/mcp-server-integration/index';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  mockMcpError,
  mockHttpError,
  mockNetworkError,
  mockSecretsManagerSuccess,
  mockSecretsManagerError,
  resetAllMocks,
} from './helpers/test-helpers';

// グローバルfetchのモック
global.fetch = jest.fn();

describe('MCP Server Integration - エラーハンドリング', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  test('serverEndpointが指定されていない場合、エラーを返す', async () => {
    const event = {
      authenticationType: 'NONE' as const,
    } as any;

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toContain('serverEndpointは必須です');
    expect(response.errorCode).toBe('INVALID_INPUT');
  });

  test('MCPサーバーからエラーレスポンスが返された場合、エラーを返す', async () => {
    mockMcpError('MCPサーバー内部エラー');

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toContain('MCPサーバーエラー');
    expect(response.errorCode).toBe('INTEGRATION_ERROR');
  });

  test('MCPサーバーへの接続に失敗した場合、エラーを返す', async () => {
    mockNetworkError();

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toContain('MCPサーバー接続に失敗');
    expect(response.errorCode).toBe('INTEGRATION_ERROR');
  });

  test('MCPサーバーからHTTPエラーが返された場合、エラーを返す', async () => {
    mockHttpError(500, 'Internal Server Error');

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toContain('MCPサーバーからのレスポンスエラー');
    expect(response.errorCode).toBe('INTEGRATION_ERROR');
  });

  test('Secrets Managerからのシークレット取得に失敗した場合、エラーを返す', async () => {
    mockSecretsManagerError();

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'API_KEY' as const,
      apiKeySecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:test-api-key',
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toContain('シークレット取得に失敗');
    expect(response.errorCode).toBe('INTEGRATION_ERROR');
  });

  test('OAuth2トークン取得に失敗した場合、エラーを返す', async () => {
    mockSecretsManagerSuccess('test-client-secret');
    mockHttpError(401, 'Unauthorized');

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'OAUTH2' as const,
      oauth2Config: {
        clientId: 'test-client-id',
        clientSecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:test-client-secret',
        tokenEndpoint: 'https://auth.example.com/oauth2/token',
      },
    };

    const response = await handler(event);

    expect(response.success).toBe(false);
    expect(response.error).toContain('OAuth2トークン取得に失敗');
    expect(response.errorCode).toBe('INTEGRATION_ERROR');
  });

  test('Tool名フィルターの正規表現が無効な場合、フィルターなしで処理される', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        type: 'tools',
        tools: [
          { name: 'tool1', description: 'Tool 1' },
          { name: 'tool2', description: 'Tool 2' },
          { name: 'tool3', description: 'Tool 3' },
        ],
      }),
    });

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
      toolNameFilter: '[invalid-regex',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();
    expect(response.toolDefinitions!.length).toBe(3);
  });
});
