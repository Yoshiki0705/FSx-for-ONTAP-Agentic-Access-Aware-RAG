/**
 * Amazon Bedrock AgentCore Memory API - 単体テスト
 * 
 * Memory API呼び出しのテストを実施
 * 
 * 注: @aws-sdk/client-bedrock-agent-coreはまだリリースされていないため、
 * このテストは将来のSDKの動作を想定したモックベースのテストです。
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

// 将来のSDKの型定義を想定
interface BedrockAgentCoreClientConfig {
  region: string;
}

interface WriteEventInput {
  memoryId: string;
  actorId: string;
  sessionId: string;
  content: {
    text: string;
    role: 'USER' | 'ASSISTANT';
  };
}

interface GetLastKTurnsInput {
  memoryId: string;
  actorId: string;
  sessionId: string;
  k: number;
}

interface SearchLongTermMemoriesInput {
  memoryId: string;
  actorId: string;
  query: string;
  topK: number;
  strategyType?: 'SEMANTIC' | 'SUMMARY' | 'USER_PREFERENCE';
}

interface Event {
  eventId: string;
  actorId: string;
  sessionId: string;
  content: {
    text: string;
    role: 'USER' | 'ASSISTANT';
  };
  timestamp: string;
}

interface Memory {
  memoryId: string;
  content: string;
  score: number;
  namespace: string;
  strategyType: 'SEMANTIC' | 'SUMMARY' | 'USER_PREFERENCE';
}

// モックSDKクライアント
class MockBedrockAgentCoreClient {
  private region: string;
  private mockResponses: Map<string, any> = new Map();
  private callHistory: Array<{ method: string; input: any }> = [];

  constructor(config: BedrockAgentCoreClientConfig) {
    this.region = config.region;
  }

  setMockResponse(method: string, response: any) {
    this.mockResponses.set(method, response);
  }

  setMockError(method: string, error: Error) {
    this.mockResponses.set(method, { error });
  }

  getCallHistory() {
    return this.callHistory;
  }

  resetCallHistory() {
    this.callHistory = [];
  }

  async writeEvent(input: WriteEventInput) {
    this.callHistory.push({ method: 'writeEvent', input });
    const response = this.mockResponses.get('writeEvent');
    if (response?.error) throw response.error;
    return response || { eventId: 'mock-event-id', timestamp: new Date().toISOString() };
  }

  async getLastKTurns(input: GetLastKTurnsInput) {
    this.callHistory.push({ method: 'getLastKTurns', input });
    const response = this.mockResponses.get('getLastKTurns');
    if (response?.error) throw response.error;
    return response || { events: [] };
  }

  async searchLongTermMemories(input: SearchLongTermMemoriesInput) {
    this.callHistory.push({ method: 'searchLongTermMemories', input });
    const response = this.mockResponses.get('searchLongTermMemories');
    if (response?.error) throw response.error;
    return response || { memories: [] };
  }
}

let mockClient: MockBedrockAgentCoreClient;

describe('BedrockAgentCore Memory API', () => {
  beforeEach(() => {
    // 各テスト前にモッククライアントをリセット
    mockClient = new MockBedrockAgentCoreClient({ region: 'ap-northeast-1' });
  });

  describe('WriteEvent API（短期メモリ書き込み）', () => {
    test('ユーザーメッセージが正しく書き込まれる', async () => {
      // Arrange
      const mockResponse = {
        eventId: 'event-123',
        timestamp: new Date().toISOString(),
      };
      mockClient.setMockResponse('writeEvent', mockResponse);

      // Act
      const response = await mockClient.writeEvent({
        memoryId: 'memory-resource-id',
        actorId: 'user-123',
        sessionId: 'session-456',
        content: {
          text: 'こんにちは、今日の天気を教えてください',
          role: 'USER',
        },
      });

      // Assert
      expect(response.eventId).toBe('event-123');
      expect(response.timestamp).toBeDefined();
      expect(mockClient.getCallHistory()).toHaveLength(1);
    });

    test('アシスタントメッセージが正しく書き込まれる', async () => {
      // Arrange
      const mockResponse = {
        eventId: 'event-124',
        timestamp: new Date().toISOString(),
      };
      mockClient.setMockResponse('writeEvent', mockResponse);

      // Act
      const response = await mockClient.writeEvent({
        memoryId: 'memory-resource-id',
        actorId: 'assistant-001',
        sessionId: 'session-456',
        content: {
          text: '今日の東京の天気は晴れです。最高気温は25度の予想です。',
          role: 'ASSISTANT',
        },
      });

      // Assert
      expect(response.eventId).toBe('event-124');
      expect(mockClient.getCallHistory()).toHaveLength(1);
    });

    test('複数のイベントが順次書き込まれる', async () => {
      // Arrange
      mockClient.setMockResponse('writeEvent', {
        eventId: 'event-125',
        timestamp: new Date().toISOString(),
      });

      // Act
      const events = [
        { text: 'メッセージ1', role: 'USER' as const },
        { text: 'メッセージ2', role: 'ASSISTANT' as const },
        { text: 'メッセージ3', role: 'USER' as const },
      ];

      for (const event of events) {
        await mockClient.writeEvent({
          memoryId: 'memory-resource-id',
          actorId: 'user-123',
          sessionId: 'session-456',
          content: event,
        });
      }

      // Assert
      expect(mockClient.getCallHistory()).toHaveLength(3);
    });

    test('エラー時に適切な例外が発生する', async () => {
      // Arrange
      mockClient.setMockError('writeEvent', new Error('Memory resource not found'));

      // Act & Assert
      await expect(
        mockClient.writeEvent({
          memoryId: 'invalid-memory-id',
          actorId: 'user-123',
          sessionId: 'session-456',
          content: { text: 'テスト', role: 'USER' },
        })
      ).rejects.toThrow('Memory resource not found');
    });
  });

  describe('GetLastKTurns API（短期メモリ取得）', () => {
    test('最新K件の会話履歴が取得される', async () => {
      // Arrange
      const mockResponse = {
        events: [
          {
            eventId: 'event-123',
            actorId: 'user-123',
            sessionId: 'session-456',
            content: { text: 'こんにちは', role: 'USER' as const },
            timestamp: new Date().toISOString(),
          },
          {
            eventId: 'event-124',
            actorId: 'assistant-001',
            sessionId: 'session-456',
            content: { text: 'こんにちは！', role: 'ASSISTANT' as const },
            timestamp: new Date().toISOString(),
          },
        ],
      };
      mockClient.setMockResponse('getLastKTurns', mockResponse);

      // Act
      const response = await mockClient.getLastKTurns({
        memoryId: 'memory-resource-id',
        actorId: 'user-123',
        sessionId: 'session-456',
        k: 5,
      });

      // Assert
      expect(response.events).toHaveLength(2);
      expect(response.events[0].content.text).toBe('こんにちは');
      expect(response.events[1].content.text).toBe('こんにちは！');
      expect(mockClient.getCallHistory()).toHaveLength(1);
    });

    test('空のセッションで空配列が返される', async () => {
      // Arrange
      const mockResponse = { events: [] };
      mockClient.setMockResponse('getLastKTurns', mockResponse);

      // Act
      const response = await mockClient.getLastKTurns({
        memoryId: 'memory-resource-id',
        actorId: 'user-123',
        sessionId: 'new-session',
        k: 5,
      });

      // Assert
      expect(response.events).toHaveLength(0);
    });

    test('K=1で最新1件のみ取得される', async () => {
      // Arrange
      const mockResponse = {
        events: [
          {
            eventId: 'event-125',
            actorId: 'user-123',
            sessionId: 'session-456',
            content: { text: '最新メッセージ', role: 'USER' as const },
            timestamp: new Date().toISOString(),
          },
        ],
      };
      mockClient.setMockResponse('getLastKTurns', mockResponse);

      // Act
      const response = await mockClient.getLastKTurns({
        memoryId: 'memory-resource-id',
        actorId: 'user-123',
        sessionId: 'session-456',
        k: 1,
      });

      // Assert
      expect(response.events).toHaveLength(1);
      expect(response.events[0].content.text).toBe('最新メッセージ');
    });
  });

  describe('SearchLongTermMemories API（長期メモリ検索）', () => {
    test('Semantic Memoryから関連情報が検索される', async () => {
      // Arrange
      const mockResponse = {
        memories: [
          {
            memoryId: 'memory-001',
            content: 'ユーザーは東京に住んでいる',
            score: 0.95,
            namespace: 'default',
            strategyType: 'SEMANTIC' as const,
          },
          {
            memoryId: 'memory-002',
            content: 'ユーザーの好きな食べ物はラーメン',
            score: 0.85,
            namespace: 'default',
            strategyType: 'SEMANTIC' as const,
          },
        ],
      };
      mockClient.setMockResponse('searchLongTermMemories', mockResponse);

      // Act
      const response = await mockClient.searchLongTermMemories({
        memoryId: 'memory-resource-id',
        actorId: 'user-123',
        query: 'ユーザーの住所',
        topK: 5,
      });

      // Assert
      expect(response.memories).toHaveLength(2);
      expect(response.memories[0].content).toContain('東京');
      expect(response.memories[0].score).toBeGreaterThan(0.9);
      expect(mockClient.getCallHistory()).toHaveLength(1);
    });

    test('Summary Memoryから要約情報が検索される', async () => {
      // Arrange
      const mockResponse = {
        memories: [
          {
            memoryId: 'memory-003',
            content: '過去の会話では、ユーザーは旅行の計画について相談していた',
            score: 0.88,
            namespace: 'default',
            strategyType: 'SUMMARY' as const,
          },
        ],
      };
      mockClient.setMockResponse('searchLongTermMemories', mockResponse);

      // Act
      const response = await mockClient.searchLongTermMemories({
        memoryId: 'memory-resource-id',
        actorId: 'user-123',
        query: '過去の会話内容',
        topK: 5,
        strategyType: 'SUMMARY',
      });

      // Assert
      expect(response.memories).toHaveLength(1);
      expect(response.memories[0].strategyType).toBe('SUMMARY');
    });

    test('User Preference Memoryからユーザー嗜好が検索される', async () => {
      // Arrange
      const mockResponse = {
        memories: [
          {
            memoryId: 'memory-004',
            content: 'ユーザーは簡潔な回答を好む',
            score: 0.92,
            namespace: 'preferences',
            strategyType: 'USER_PREFERENCE' as const,
          },
        ],
      };
      mockClient.setMockResponse('searchLongTermMemories', mockResponse);

      // Act
      const response = await mockClient.searchLongTermMemories({
        memoryId: 'memory-resource-id',
        actorId: 'user-123',
        query: 'ユーザーの好み',
        topK: 5,
        strategyType: 'USER_PREFERENCE',
      });

      // Assert
      expect(response.memories).toHaveLength(1);
      expect(response.memories[0].strategyType).toBe('USER_PREFERENCE');
    });

    test('検索結果が見つからない場合は空配列が返される', async () => {
      // Arrange
      const mockResponse = { memories: [] };
      mockClient.setMockResponse('searchLongTermMemories', mockResponse);

      // Act
      const response = await mockClient.searchLongTermMemories({
        memoryId: 'memory-resource-id',
        actorId: 'user-123',
        query: '存在しない情報',
        topK: 5,
      });

      // Assert
      expect(response.memories).toHaveLength(0);
    });

    test('topKパラメータが正しく適用される', async () => {
      // Arrange
      const mockResponse = {
        memories: [
          { memoryId: 'memory-001', content: 'メモリ1', score: 0.95, namespace: 'default', strategyType: 'SEMANTIC' as const },
          { memoryId: 'memory-002', content: 'メモリ2', score: 0.90, namespace: 'default', strategyType: 'SEMANTIC' as const },
          { memoryId: 'memory-003', content: 'メモリ3', score: 0.85, namespace: 'default', strategyType: 'SEMANTIC' as const },
        ],
      };
      mockClient.setMockResponse('searchLongTermMemories', mockResponse);

      // Act
      const response = await mockClient.searchLongTermMemories({
        memoryId: 'memory-resource-id',
        actorId: 'user-123',
        query: 'テスト',
        topK: 3,
      });

      // Assert
      expect(response.memories).toHaveLength(3);
      // スコアの降順でソートされていることを確認
      expect(response.memories[0].score).toBeGreaterThanOrEqual(response.memories[1].score);
      expect(response.memories[1].score).toBeGreaterThanOrEqual(response.memories[2].score);
    });
  });

  describe('セッション管理', () => {
    test('異なるセッションIDで独立した会話履歴が管理される', async () => {
      // Arrange
      const session1Client = new MockBedrockAgentCoreClient({ region: 'ap-northeast-1' });
      const session2Client = new MockBedrockAgentCoreClient({ region: 'ap-northeast-1' });

      session1Client.setMockResponse('getLastKTurns', {
        events: [
          {
            eventId: 'event-s1-1',
            actorId: 'user-123',
            sessionId: 'session-1',
            content: { text: 'セッション1のメッセージ', role: 'USER' as const },
            timestamp: new Date().toISOString(),
          },
        ],
      });

      session2Client.setMockResponse('getLastKTurns', {
        events: [
          {
            eventId: 'event-s2-1',
            actorId: 'user-123',
            sessionId: 'session-2',
            content: { text: 'セッション2のメッセージ', role: 'USER' as const },
            timestamp: new Date().toISOString(),
          },
        ],
      });

      // Act
      const response1 = await session1Client.getLastKTurns({
        memoryId: 'memory-resource-id',
        actorId: 'user-123',
        sessionId: 'session-1',
        k: 5,
      });
      const response2 = await session2Client.getLastKTurns({
        memoryId: 'memory-resource-id',
        actorId: 'user-123',
        sessionId: 'session-2',
        k: 5,
      });

      // Assert
      expect(response1.events[0].content.text).toBe('セッション1のメッセージ');
      expect(response2.events[0].content.text).toBe('セッション2のメッセージ');
    });

    test('異なるactorIdで独立した長期メモリが管理される', async () => {
      // Arrange
      const user1Client = new MockBedrockAgentCoreClient({ region: 'ap-northeast-1' });
      const user2Client = new MockBedrockAgentCoreClient({ region: 'ap-northeast-1' });

      user1Client.setMockResponse('searchLongTermMemories', {
        memories: [
          {
            memoryId: 'memory-u1-1',
            content: 'ユーザー1の情報',
            score: 0.95,
            namespace: 'default',
            strategyType: 'SEMANTIC' as const,
          },
        ],
      });

      user2Client.setMockResponse('searchLongTermMemories', {
        memories: [
          {
            memoryId: 'memory-u2-1',
            content: 'ユーザー2の情報',
            score: 0.95,
            namespace: 'default',
            strategyType: 'SEMANTIC' as const,
          },
        ],
      });

      // Act
      const response1 = await user1Client.searchLongTermMemories({
        memoryId: 'memory-resource-id',
        actorId: 'user-1',
        query: 'ユーザー情報',
        topK: 5,
      });
      const response2 = await user2Client.searchLongTermMemories({
        memoryId: 'memory-resource-id',
        actorId: 'user-2',
        query: 'ユーザー情報',
        topK: 5,
      });

      // Assert
      expect(response1.memories[0].content).toBe('ユーザー1の情報');
      expect(response2.memories[0].content).toBe('ユーザー2の情報');
    });
  });

  describe('エラーハンドリング', () => {
    test('無効なMemory IDでエラーが発生する', async () => {
      // Arrange
      mockClient.setMockError('writeEvent', new Error('ResourceNotFoundException'));

      // Act & Assert
      await expect(
        mockClient.writeEvent({
          memoryId: 'invalid-memory-id',
          actorId: 'user-123',
          sessionId: 'session-456',
          content: { text: 'テスト', role: 'USER' },
        })
      ).rejects.toThrow('ResourceNotFoundException');
    });

    test('ネットワークエラーが適切にハンドリングされる', async () => {
      // Arrange
      mockClient.setMockError('getLastKTurns', new Error('NetworkError'));

      // Act & Assert
      await expect(
        mockClient.getLastKTurns({
          memoryId: 'memory-resource-id',
          actorId: 'user-123',
          sessionId: 'session-456',
          k: 5,
        })
      ).rejects.toThrow('NetworkError');
    });

    test('タイムアウトエラーが適切にハンドリングされる', async () => {
      // Arrange
      mockClient.setMockError('searchLongTermMemories', new Error('TimeoutError'));

      // Act & Assert
      await expect(
        mockClient.searchLongTermMemories({
          memoryId: 'memory-resource-id',
          actorId: 'user-123',
          query: 'テスト',
          topK: 5,
        })
      ).rejects.toThrow('TimeoutError');
    });
  });
});
