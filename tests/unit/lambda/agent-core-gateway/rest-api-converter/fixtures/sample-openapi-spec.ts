/**
 * REST API Converter - Sample OpenAPI Specification
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

/**
 * テスト用OpenAPI仕様
 */
export const sampleOpenApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Sample API',
    version: '1.0.0',
    description: 'Sample REST API for testing',
  },
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        summary: 'List all users',
        description: 'Retrieve a list of all users',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of users to return',
            required: false,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'object' },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: 'createUser',
        summary: 'Create a new user',
        description: 'Create a new user with the provided data',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'User name' },
                  email: { type: 'string', description: 'User email' },
                },
                required: ['name', 'email'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created successfully',
          },
        },
      },
    },
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        summary: 'Get user by ID',
        description: 'Retrieve a specific user by their ID',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            description: 'User ID',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
          },
        },
      },
    },
  },
};
