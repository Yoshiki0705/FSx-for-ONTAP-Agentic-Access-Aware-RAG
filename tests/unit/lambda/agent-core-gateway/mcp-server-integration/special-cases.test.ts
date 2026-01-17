/**
 * MCP Server Integration - Special Cases Tests
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import { handler } from '../../../../../lambda/agent-core-gateway/mcp-server-integration/index';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  mockSuccessfulMcpResponse,
  resetAllMocks,
} from './helpers/test-helpers';

// グローバルfetchのモック
global.fetch = jest.fn();

describe('MCP Server Integration - 特殊ケース', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  test('MCPサーバーからToolが返されない場合、空の配列を返す', async () => {
    mockSuccessfulMcpResponse([]);

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toEqual([]);
    expect(response.statistics).toEqual({
      mcpToolsCount: 0,
      bedrockToolsCount: 0,
      filteredToolsCount: 0,
    });
  });

  test('Input SchemaもParametersも持たないToolの場合、デフォルトSchemaが生成される', async () => {
    mockSuccessfulMcpResponse([
      {
        name: 'simple-tool',
        description: 'A simple tool without schema',
      },
    ]);

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();
    expect(response.toolDefinitions!.length).toBe(1);

    const simpleTool = response.toolDefinitions![0];
    expect(simpleTool.name).toBe('simpleTool');
    expect(simpleTool.inputSchema.json.type).toBe('object');
    expect(simpleTool.inputSchema.json.properties).toHaveProperty('input');
    expect(simpleTool.inputSchema.json.properties.input.additionalProperties).toBe(true);
  });

  test('Tool名にハイフン、アンダースコア、ドットが含まれる場合、キャメルケースに変換される', async () => {
    mockSuccessfulMcpResponse([
      {
        name: 'get-user-profile',
        description: 'Get user profile',
      },
      {
        name: 'list_all_users',
        description: 'List all users',
      },
      {
        name: 'create.new.user',
        description: 'Create new user',
      },
    ]);

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();
    expect(response.toolDefinitions!.length).toBe(3);

    const toolNames = response.toolDefinitions!.map(t => t.name);
    expect(toolNames).toContain('getUserProfile');
    expect(toolNames).toContain('listAllUsers');
    expect(toolNames).toContain('createNewUser');
  });

  test('大量のToolが返された場合、全て正しく処理される', async () => {
    // 100個のToolを生成
    const largeMcpTools = Array.from({ length: 100 }, (_, i) => ({
      name: `tool-${i}`,
      description: `Tool ${i}`,
      inputSchema: {
        type: 'object',
        properties: {
          param: { type: 'string' },
        },
      },
    }));

    mockSuccessfulMcpResponse(largeMcpTools);

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();
    expect(response.toolDefinitions!.length).toBe(100);
    expect(response.statistics).toEqual({
      mcpToolsCount: 100,
      bedrockToolsCount: 100,
      filteredToolsCount: 0,
    });
  });
});
