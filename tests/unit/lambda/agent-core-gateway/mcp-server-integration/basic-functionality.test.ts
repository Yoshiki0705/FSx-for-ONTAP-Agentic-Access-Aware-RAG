/**
 * MCP Server Integration - Basic Functionality Tests
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
import { sampleMcpTools } from './fixtures/sample-tools';

// グローバルfetchのモック
global.fetch = jest.fn();

describe('MCP Server Integration - 基本機能', () => {
  beforeEach(() => {
    resetAllMocks();
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  test('MCPサーバーからTool定義が正しく取得される', async () => {
    mockSuccessfulMcpResponse(sampleMcpTools);

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();
    expect(response.toolDefinitions!.length).toBe(3);
    expect(response.statistics).toEqual({
      mcpToolsCount: 3,
      bedrockToolsCount: 3,
      filteredToolsCount: 0,
    });
  });

  test('Bedrock Agent Tool定義が正しく生成される', async () => {
    mockSuccessfulMcpResponse(sampleMcpTools);

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();

    const getUserTool = response.toolDefinitions!.find(t => t.name === 'getUser');
    expect(getUserTool).toBeDefined();
    expect(getUserTool!.description).toBe('Get user information by ID');
    expect(getUserTool!.inputSchema.json.type).toBe('object');
    expect(getUserTool!.inputSchema.json.properties).toHaveProperty('userId');
    expect(getUserTool!.inputSchema.json.required).toContain('userId');
  });

  test('パラメータからInput Schemaが正しく生成される', async () => {
    mockSuccessfulMcpResponse(sampleMcpTools);

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();

    const listUsersTool = response.toolDefinitions!.find(t => t.name === 'listUsers');
    expect(listUsersTool).toBeDefined();
    expect(listUsersTool!.inputSchema.json.type).toBe('object');
    expect(listUsersTool!.inputSchema.json.properties).toHaveProperty('limit');
    expect(listUsersTool!.inputSchema.json.properties).toHaveProperty('offset');
    expect(listUsersTool!.inputSchema.json.properties.limit.type).toBe('integer');
  });

  test('Tool名プレフィックスが正しく適用される', async () => {
    mockSuccessfulMcpResponse(sampleMcpTools);

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
      toolNamePrefix: 'mcp',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();

    const getUserTool = response.toolDefinitions!.find(t => t.name === 'mcpGetUser');
    expect(getUserTool).toBeDefined();

    const listUsersTool = response.toolDefinitions!.find(t => t.name === 'mcpListUsers');
    expect(listUsersTool).toBeDefined();
  });

  test('Tool名フィルターが正しく適用される', async () => {
    mockSuccessfulMcpResponse(sampleMcpTools);

    const event = {
      serverEndpoint: 'https://mcp-server.example.com',
      authenticationType: 'NONE' as const,
      toolNameFilter: '^get-',
    };

    const response = await handler(event);

    expect(response.success).toBe(true);
    expect(response.toolDefinitions).toBeDefined();
    expect(response.toolDefinitions!.length).toBe(1);
    expect(response.statistics).toEqual({
      mcpToolsCount: 3,
      bedrockToolsCount: 1,
      filteredToolsCount: 2,
    });

    const getUserTool = response.toolDefinitions!.find(t => t.name === 'getUser');
    expect(getUserTool).toBeDefined();
  });
});
