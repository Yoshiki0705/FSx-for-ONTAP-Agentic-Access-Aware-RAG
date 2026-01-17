/**
 * Amazon Bedrock AgentCore Runtime - Lambda関数単体テスト
 * 
 * @description Lambda関数の単体テストを実施
 * @author Kiro AI
 * @created 2026-01-03
 */

import { handler } from '../../../../lambda/agent-core-runtime/index';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { mockClient } from 'aws-sdk-client-mock';

// AWS SDK Mockの作成
const bedrockMock = mockClient(BedrockAgentRuntimeClient);

describe('AgentCore Runtime Lambda Handler', () => {
  // 各テスト前にモックをリセット
  beforeEach(() => {
    bedrockMock.reset();
    
    // 環境変数を設定
    process.env.PROJECT_NAME = 'test-project';
    process.env.ENVIRONMENT = 'test';
    process.env.BEDROCK_AGENT_ID = 'test-agent-id';
    process.env.BEDROCK_AGENT_ALIAS_ID = 'test-alias-id';
    process.env.BEDROCK_REGION = 'us-east-1';
  });

  // 各テスト後に環境変数をクリア
  afterEach(() => {
    delete process.env.PROJECT_NAME;
    delete process.env.ENVIRONMENT;
    delete process.env.BEDROCK_AGENT_ID;
    delete process.env.BEDROCK_AGENT_ALIAS_ID;
    delete process.env.BEDROCK_REGION;
  });

  describe('環境変数の読み込み', () => {
    it('必須環境変数が正しく読み込まれる', async () => {
      // Arrange
      const event = {
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
        inputText: 'Hello, world!',
      };

      bedrockMock.on(InvokeAgentCommand).resolves({
        completion: [
          {
            chunk: {
              bytes: Buffer.from(JSON.stringify({ text: 'Response' })),
            },
          },
        ],
        sessionId: 'test-session-id',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result).toBeDefined();
      expect(result.statusCode).toBe(200);
    });

    it('環境変数が欠落している場合はエラーを返す', async () => {
      // Arrange
      delete process.env.BEDROCK_AGENT_ID;
      
      const event = {
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
        inputText: 'Hello, world!',
      };

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('環境変数が設定されていません');
    });
  });

  describe('Bedrock Agent呼び出し', () => {
    it('Bedrock Agentが正しく呼び出される', async () => {
      // Arrange
      const event = {
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
        inputText: 'Hello, world!',
      };

      const mockResponse = {
        completion: [
          {
            chunk: {
              bytes: Buffer.from(JSON.stringify({ text: 'Hello from Bedrock!' })),
            },
          },
        ],
        sessionId: 'test-session-id',
      };

      bedrockMock.on(InvokeAgentCommand).resolves(mockResponse);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(bedrockMock.calls()).toHaveLength(1);
      
      const call = bedrockMock.call(0);
      expect(call.args[0].input).toMatchObject({
        agentId: 'test-agent-id',
        agentAliasId: 'test-alias-id',
        sessionId: 'test-session-id',
        inputText: 'Hello, world!',
      });
    });

    it('ストリーミングレスポンスが正しく処理される', async () => {
      // Arrange
      const event = {
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
        inputText: 'Tell me a story',
        enableTrace: true,
      };

      const mockResponse = {
        completion: [
          {
            chunk: {
              bytes: Buffer.from(JSON.stringify({ text: 'Once upon a time' })),
            },
          },
          {
            chunk: {
              bytes: Buffer.from(JSON.stringify({ text: ', there was a kingdom' })),
            },
          },
          {
            chunk: {
              bytes: Buffer.from(JSON.stringify({ text: '.' })),
            },
          },
        ],
        sessionId: 'test-session-id',
      };

      bedrockMock.on(InvokeAgentCommand).resolves(mockResponse);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.response).toContain('Once upon a time');
      expect(body.response).toContain('there was a kingdom');
    });

    it('トレース機能が有効な場合、トレース情報が含まれる', async () => {
      // Arrange
      const event = {
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
        inputText: 'Hello',
        enableTrace: true,
      };

      const mockResponse = {
        completion: [
          {
            chunk: {
              bytes: Buffer.from(JSON.stringify({ text: 'Response' })),
            },
          },
        ],
        trace: {
          orchestrationTrace: {
            modelInvocationInput: {
              text: 'Hello',
            },
          },
        },
        sessionId: 'test-session-id',
      };

      bedrockMock.on(InvokeAgentCommand).resolves(mockResponse);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.trace).toBeDefined();
    });
  });

  describe('エラーハンドリング', () => {
    it('Bedrock APIエラーが正しくハンドリングされる', async () => {
      // Arrange
      const event = {
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
        inputText: 'Hello',
      };

      bedrockMock.on(InvokeAgentCommand).rejects(new Error('Bedrock API Error'));

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('Bedrock Agent呼び出しエラー');
    });

    it('無効なイベントパラメータの場合はエラーを返す', async () => {
      // Arrange
      const event = {
        // agentId が欠落
        sessionId: 'test-session-id',
        inputText: 'Hello',
      };

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('必須パラメータが欠落しています');
    });

    it('タイムアウトエラーが正しくハンドリングされる', async () => {
      // Arrange
      const event = {
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
        inputText: 'Hello',
      };

      bedrockMock.on(InvokeAgentCommand).rejects({
        name: 'TimeoutError',
        message: 'Request timed out',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(504);
      expect(result.body).toContain('タイムアウト');
    });

    it('認証エラーが正しくハンドリングされる', async () => {
      // Arrange
      const event = {
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
        inputText: 'Hello',
      };

      bedrockMock.on(InvokeAgentCommand).rejects({
        name: 'UnauthorizedException',
        message: 'Unauthorized',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(403);
      expect(result.body).toContain('認証エラー');
    });
  });

  describe('パラメータ抽出', () => {
    it('オプションパラメータが正しく抽出される', async () => {
      // Arrange
      const event = {
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
        inputText: 'Hello',
        enableTrace: true,
        endSession: false,
        sessionState: {
          sessionAttributes: {
            key1: 'value1',
          },
        },
      };

      bedrockMock.on(InvokeAgentCommand).resolves({
        completion: [
          {
            chunk: {
              bytes: Buffer.from(JSON.stringify({ text: 'Response' })),
            },
          },
        ],
        sessionId: 'test-session-id',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(200);
      
      const call = bedrockMock.call(0);
      expect(call.args[0].input.enableTrace).toBe(true);
      expect(call.args[0].input.endSession).toBe(false);
      expect(call.args[0].input.sessionState).toBeDefined();
    });

    it('デフォルト値が正しく適用される', async () => {
      // Arrange
      const event = {
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
        inputText: 'Hello',
        // enableTrace, endSession は省略
      };

      bedrockMock.on(InvokeAgentCommand).resolves({
        completion: [
          {
            chunk: {
              bytes: Buffer.from(JSON.stringify({ text: 'Response' })),
            },
          },
        ],
        sessionId: 'test-session-id',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(200);
      
      const call = bedrockMock.call(0);
      expect(call.args[0].input.enableTrace).toBe(false);
      expect(call.args[0].input.endSession).toBe(false);
    });
  });

  describe('レスポンス生成', () => {
    it('成功レスポンスが正しく生成される', async () => {
      // Arrange
      const event = {
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
        inputText: 'Hello',
      };

      bedrockMock.on(InvokeAgentCommand).resolves({
        completion: [
          {
            chunk: {
              bytes: Buffer.from(JSON.stringify({ text: 'Hello from Bedrock!' })),
            },
          },
        ],
        sessionId: 'test-session-id',
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
      });
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.sessionId).toBe('test-session-id');
      expect(body.response).toBeDefined();
    });

    it('エラーレスポンスが正しく生成される', async () => {
      // Arrange
      const event = {
        agentId: 'test-agent-id',
        sessionId: 'test-session-id',
        inputText: 'Hello',
      };

      bedrockMock.on(InvokeAgentCommand).rejects(new Error('Test Error'));

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(500);
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
      });
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.message).toContain('Bedrock Agent呼び出しエラー');
    });
  });
});
