/**
 * Amazon Bedrock AgentCore Memory - Short-Term Memory Lambda関数単体テスト
 * 
 * @description Short-Term Memory Lambda関数の単体テストを実施
 * @author Kiro AI
 * @created 2026-01-03
 */

import { handler, ShortTermMemoryEvent } from '../../../../../lambda/agent-core-memory/short-term-memory/index';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

// AWS SDK Mockの作成
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('Short-Term Memory Lambda Handler', () => {
  beforeEach(() => {
    dynamoMock.reset();
    
    // 環境変数を設定
    process.env.PROJECT_NAME = 'test-project';
    process.env.ENVIRONMENT = 'test';
    process.env.TABLE_NAME = 'test-short-term-memory-table';
    process.env.TTL_SECONDS = '3600';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  afterEach(() => {
    delete process.env.PROJECT_NAME;
    delete process.env.ENVIRONMENT;
    delete process.env.TABLE_NAME;
    delete process.env.TTL_SECONDS;
    delete process.env.AWS_REGION;
  });

  describe('環境変数の読み込み', () => {
    it('必須環境変数が欠落している場合はエラーを返す', async () => {
      delete process.env.TABLE_NAME;
      
      const event: ShortTermMemoryEvent = {
        operation: 'put',
        sessionId: 'test-session',
        data: {
          userMessage: 'Hello',
          assistantResponse: 'Hi there',
        },
      };

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect((result as any).error).toContain('Missing required environment variables');
    });
  });

  describe('put操作', () => {
    it('メモリが正しく保存される', async () => {
      const event: ShortTermMemoryEvent = {
        operation: 'put',
        sessionId: 'test-session',
        data: {
          userMessage: 'Hello',
          assistantResponse: 'Hi there',
          metadata: { key: 'value' },
        },
      };

      dynamoMock.on(PutCommand).resolves({});

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('put');
      expect((result as any).data).toBeDefined();
      expect((result as any).data.sessionId).toBe('test-session');
      expect((result as any).data.timestamp).toBeDefined();
      expect((result as any).data.ttl).toBeDefined();
      expect(dynamoMock.calls()).toHaveLength(1);
    });

    it('dataパラメータが欠落している場合はエラーを返す', async () => {
      const event: ShortTermMemoryEvent = {
        operation: 'put',
        sessionId: 'test-session',
      };

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect((result as any).error).toContain('Missing required parameter: data');
    });
  });

  describe('get操作', () => {
    it('メモリが正しく取得される', async () => {
      const event: ShortTermMemoryEvent = {
        operation: 'get',
        sessionId: 'test-session',
        timestamp: 1234567890,
      };

      const mockItem = {
        sessionId: 'test-session',
        timestamp: 1234567890,
        userMessage: 'Hello',
        assistantResponse: 'Hi there',
      };

      dynamoMock.on(GetCommand).resolves({ Item: mockItem });

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('get');
      expect((result as any).data).toEqual(mockItem);
    });

    it('メモリが存在しない場合はNOT_FOUNDエラーを返す', async () => {
      const event: ShortTermMemoryEvent = {
        operation: 'get',
        sessionId: 'test-session',
        timestamp: 1234567890,
      };

      dynamoMock.on(GetCommand).resolves({});

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect((result as any).error).toBe('Memory not found');
      expect((result as any).errorCode).toBe('NOT_FOUND');
    });

    it('timestampパラメータが欠落している場合はエラーを返す', async () => {
      const event: ShortTermMemoryEvent = {
        operation: 'get',
        sessionId: 'test-session',
      };

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect((result as any).error).toContain('Missing required parameter: timestamp');
    });
  });

  describe('update操作', () => {
    it('メモリが正しく更新される', async () => {
      const event: ShortTermMemoryEvent = {
        operation: 'update',
        sessionId: 'test-session',
        timestamp: 1234567890,
        data: {
          userMessage: 'Updated message',
        },
      };

      const mockUpdatedItem = {
        sessionId: 'test-session',
        timestamp: 1234567890,
        userMessage: 'Updated message',
        updatedAt: new Date().toISOString(),
      };

      dynamoMock.on(UpdateCommand).resolves({ Attributes: mockUpdatedItem });

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('update');
      expect((result as any).data).toEqual(mockUpdatedItem);
    });
  });

  describe('delete操作', () => {
    it('メモリが正しく削除される', async () => {
      const event: ShortTermMemoryEvent = {
        operation: 'delete',
        sessionId: 'test-session',
        timestamp: 1234567890,
      };

      dynamoMock.on(DeleteCommand).resolves({});

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('delete');
      expect(dynamoMock.calls()).toHaveLength(1);
    });
  });

  describe('query操作', () => {
    it('セッション履歴が正しく取得される', async () => {
      const event: ShortTermMemoryEvent = {
        operation: 'query',
        sessionId: 'test-session',
        queryOptions: {
          limit: 10,
        },
      };

      const mockItems = [
        { sessionId: 'test-session', timestamp: 1234567890, userMessage: 'Hello' },
        { sessionId: 'test-session', timestamp: 1234567891, userMessage: 'How are you?' },
      ];

      dynamoMock.on(QueryCommand).resolves({ Items: mockItems });

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('query');
      expect((result as any).data).toEqual(mockItems);
      expect((result as any).count).toBe(2);
    });

    it('タイムスタンプ範囲でフィルタリングされる', async () => {
      const event: ShortTermMemoryEvent = {
        operation: 'query',
        sessionId: 'test-session',
        queryOptions: {
          startTimestamp: 1234567890,
          endTimestamp: 1234567900,
        },
      };

      dynamoMock.on(QueryCommand).resolves({ Items: [] });

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(dynamoMock.calls()).toHaveLength(1);
      
      const call = dynamoMock.call(0);
      const input = call.args[0].input as any;
      expect(input.KeyConditionExpression).toContain('BETWEEN');
    });
  });

  describe('パラメータ検証', () => {
    it('operationパラメータが欠落している場合はエラーを返す', async () => {
      const event = {
        sessionId: 'test-session',
      } as any;

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect((result as any).error).toContain('Missing required parameter: operation');
    });

    it('sessionIdパラメータが欠落している場合はエラーを返す', async () => {
      const event = {
        operation: 'put',
      } as any;

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect((result as any).error).toContain('Missing required parameter: sessionId');
    });

    it('サポートされていない操作の場合はエラーを返す', async () => {
      const event = {
        operation: 'invalid',
        sessionId: 'test-session',
      } as any;

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect((result as any).error).toContain('Unsupported operation');
    });
  });
});
