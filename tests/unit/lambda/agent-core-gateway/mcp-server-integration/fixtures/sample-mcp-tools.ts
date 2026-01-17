/**
 * MCP Server Integration - Test Fixtures
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

/**
 * サンプルMCP Tool定義
 * 
 * 3つの異なるパターンのToolを含む：
 * 1. inputSchemaを持つTool（get-user）
 * 2. parametersを持つTool（list-users）
 * 3. inputSchemaを持つTool（create-user）
 */
export const sampleMcpTools = [
  {
    name: 'get-user',
    description: 'Get user information by ID',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID',
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'list-users',
    description: 'List all users',
    parameters: [
      {
        name: 'limit',
        type: 'integer',
        description: 'Maximum number of users to return',
        required: false,
      },
      {
        name: 'offset',
        type: 'integer',
        description: 'Offset for pagination',
        required: false,
      },
    ],
  },
  {
    name: 'create-user',
    description: 'Create a new user',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'User name',
        },
        email: {
          type: 'string',
          description: 'User email',
        },
      },
      required: ['name', 'email'],
    },
  },
];

/**
 * 大量のToolを生成するヘルパー関数
 * 
 * @param count - 生成するTool数
 * @returns MCP Tool定義の配列
 */
export function generateLargeMcpTools(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `tool-${i}`,
    description: `Tool ${i}`,
    inputSchema: {
      type: 'object',
      properties: {
        param: { type: 'string' },
      },
    },
  }));
}
