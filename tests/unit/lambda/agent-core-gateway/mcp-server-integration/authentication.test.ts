/**
 * MCP Server Integration - Authentication Tests
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import { handler } from '../../../../../lambda/agent-core-gateway/mcp-server-integration/index';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  mockSuccessfulMcpResponse,
  mockOAuth2TokenResponse,
  mockSecretsManagerSuccess,
  resetAllMocks,
} from './helpers/test-helpers';
import { sampleMcpTools } from './fixtures/sample-tools';

// グローバルfetchのモック
global.fetch = jest.fn();

describe('MCP Server Integration - 認証', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  test('APIキー認証が正しく動作する', async () => {
    mockSecretsManagerSuccess('test-api-key-12345');
    mockSuccessfulMcpResponse(sampleMcpTools);

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'API_KEY' as const,
      apiKeySecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:test-api-key',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);

    // fetchが正しい認証ヘッダーで呼ばれたことを確認
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mcp-server.example.com/tools',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-key-12345',
        }),
      })
    );
  });

  test('OAuth2認証が正しく動作する', async () => {
    mockSecretsManagerSuccess('test-client-secret');
    mockOAuth2TokenResponse('test-oauth2-token');
    mockSuccessfulMcpResponse(sampleMcpTools);

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

    expect(response.success).toBe(true);

    // fetchが2回呼ばれたことを確認（トークン取得 + MCPサーバー）
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // トークンエンドポイントが正しく呼ばれたことを確認
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://auth.example.com/oauth2/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      })
    );

    // MCPサーバーが正しい認証ヘッダーで呼ばれたことを確認
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://mcp-server.example.com/tools',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-oauth2-token',
        }),
      })
    );
  });

  test('認証なしで正しく動作する', async () => {
    mockSuccessfulMcpResponse(sampleMcpTools);

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
    };

    const response = await handler(event);

    expect(response.success).toBe(true);

    // fetchが認証ヘッダーなしで呼ばれたことを確認
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mcp-server.example.com/tools',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          'Authorization': expect.anything(),
        }),
      })
    );
  });
});
