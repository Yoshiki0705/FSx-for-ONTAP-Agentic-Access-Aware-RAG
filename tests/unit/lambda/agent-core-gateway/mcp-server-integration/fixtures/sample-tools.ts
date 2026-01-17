/**
 * MCP Server Integration - Sample Tool Definitions
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

/**
 * テスト用MCP Tool定義
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
