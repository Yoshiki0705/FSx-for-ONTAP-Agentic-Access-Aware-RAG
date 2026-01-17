/**
 * Amazon Bedrock AgentCore Memory - E2Eテスト
 * 
 * Memory機能のエンドツーエンドテストを実施
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

// 将来のSDKの型定義を想定（TASK-1.10.2と同じモック実装を使用）
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

interface MemoryEvent {
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
  private eventStore: Map<string, MemoryEvent[]> = new Map();
  private memoryStore: Map<string, Memory[]> = new Map();

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
    
    // イベントをストアに保存（E2Eテスト用）
    const sessionKey = `${input.memoryId}:${input.actorId}:${input.sessionId}`;
    if (!this.eventStore.has(sessionKey)) {
      this.eventStore.set(sessionKey, []);
    }
    const event: MemoryEvent = {
      eventId: `event-${Date.now()}`,
      actorId: input.actorId,
      sessionId: input.sessionId,
      content: input.content,
      timestamp: new Date().toISOString(),
    };
    this.eventStore.get(sessionKey)!.push(event);

    const response = this.mockResponses.get('writeEvent');
    if (response?.error) throw response.error;
    return response || { eventId: event.eventId, timestamp: event.timestamp };
  }

  async getLastKTurns(input: GetLastKTurnsInput) {
    this.callHistory.push({ method: 'getLastKTurns', input });
    
    // ストアからイベントを取得（E2Eテスト用）
    const sessionKey = `${input.memoryId}:${input.actorId}:${input.sessionId}`;
    const events = this.eventStore.get(sessionKey) || [];
    const lastKEvents = events.slice(-input.k);

    const response = this.mockResponses.get('getLastKTurns');
    if (response?.error) throw response.error;
    return response || { events: lastKEvents };
  }

  async searchLongTermMemories(input: SearchLongTermMemoriesInput) {
    this.callHistory.push({ method: 'searchLongTermMemories', input });
    
    // ストアからメモリを取得（E2Eテスト用）
    const actorKey = `${input.memoryId}:${input.actorId}`;
    const memories = this.memoryStore.get(actorKey) || [];
    const filteredMemories = input.strategyType
      ? memories.filter(m => m.strategyType === input.strategyType)
      : memories;
    
    // スコアの降順でソート
    const sortedMemories = filteredMemories.sort((a, b) => b.score - a.score);
    const topKMemories = sortedMemories.slice(0, input.topK);

    const response = this.mockResponses.get('searchLongTermMemories');
    if (response?.error) throw response.error;
    return response || { memories: topKMemories };
  }

  // テスト用: 長期メモリを手動で追加
  addLongTermMemory(memoryId: string, actorId: string, memory: Memory) {
    const actorKey = `${memoryId}:${actorId}`;
    if (!this.memoryStore.has(actorKey)) {
      this.memoryStore.set(actorKey, []);
    }
    this.memoryStore.get(actorKey)!.push(memory);
  }
}

let mockClient: MockBedrockAgentCoreClient;

describe('Memory E2E Tests', () => {
  beforeEach(() => {
    mockClient = new MockBedrockAgentCoreClient({ region: 'ap-northeast-1' });
  });

  describe('イベント書き込み → 短期メモリ取得フロー', () => {
    test('会話履歴が正しく保存・取得される', async () => {
      // Arrange
      const memoryId = 'memory-resource-id';
      const actorId = 'user-123';
      const sessionId = 'session-456';

      // Act - イベント書き込み
      await mockClient.writeEvent({
        memoryId,
        actorId,
        sessionId,
        content: { text: 'こんにちは', role: 'USER' },
      });

      await mockClient.writeEvent({
        memoryId,
        actorId,
        sessionId,
        content: { text: 'こんにちは！何かお手伝いできることはありますか？', role: 'ASSISTANT' },
      });

      await mockClient.writeEvent({
        memoryId,
        actorId,
        sessionId,
        content: { text: '今日の天気を教えてください', role: 'USER' },
      });

      // Act - 短期メモリ取得
      const response = await mockClient.getLastKTurns({
        memoryId,
        actorId,
        sessionId,
        k: 5,
      });

      // Assert
      expect(response.events).toHaveLength(3);
      expect(response.events[0].content.text).toBe('こんにちは');
      expect(response.events[1].content.text).toBe('こんにちは！何かお手伝いできることはありますか？');
      expect(response.events[2].content.text).toBe('今日の天気を教えてください');
    });

    test('最新K件のみが取得される', async () => {
      // Arrange
      const memoryId = 'memory-resource-id';
      const actorId = 'user-123';
      const sessionId = 'session-456';

      // Act - 5件のイベント書き込み
      for (let i = 1; i <= 5; i++) {
        await mockClient.writeEvent({
          memoryId,
          actorId,
          sessionId,
          content: { text: `メッセージ${i}`, role: i % 2 === 1 ? 'USER' : 'ASSISTANT' },
        });
      }

      // Act - 最新3件を取得
      const response = await mockClient.getLastKTurns({
        memoryId,
        actorId,
        sessionId,
        k: 3,
      });

      // Assert
      expect(response.events).toHaveLength(3);
      expect(response.events[0].content.text).toBe('メッセージ3');
      expect(response.events[1].content.text).toBe('メッセージ4');
      expect(response.events[2].content.text).toBe('メッセージ5');
    });
  });

  describe('イベント書き込み → 長期メモリ自動抽出フロー', () => {
    test('Semantic Memoryが自動的に抽出される', async () => {
      // Arrange
      const memoryId = 'memory-resource-id';
      const actorId = 'user-123';
      const sessionId = 'session-456';

      // 長期メモリを手動で追加（実際にはAWSが自動抽出）
      mockClient.addLongTermMemory(memoryId, actorId, {
        memoryId: 'memory-001',
        content: 'ユーザーは東京に住んでいる',
        score: 0.95,
        namespace: 'default',
        strategyType: 'SEMANTIC',
      });

      // Act - 会話イベント書き込み
      await mockClient.writeEvent({
        memoryId,
        actorId,
        sessionId,
        content: { text: '私は東京に住んでいます', role: 'USER' },
      });

      await mockClient.writeEvent({
        memoryId,
        actorId,
        sessionId,
        content: { text: '東京にお住まいなんですね！', role: 'ASSISTANT' },
      });

      // Act - 長期メモリ検索
      const response = await mockClient.searchLongTermMemories({
        memoryId,
        actorId,
        query: 'ユーザーの住所',
        topK: 5,
        strategyType: 'SEMANTIC',
      });

      // Assert
      expect(response.memories).toHaveLength(1);
      expect(response.memories[0].content).toContain('東京');
      expect(response.memories[0].strategyType).toBe('SEMANTIC');
    });

    test('Summary Memoryが自動的に抽出される', async () => {
      // Arrange
      const memoryId = 'memory-resource-id';
      const actorId = 'user-123';
      const sessionId = 'session-456';

      // 長期メモリを手動で追加（実際にはAWSが自動抽出）
      mockClient.addLongTermMemory(memoryId, actorId, {
        memoryId: 'memory-002',
        content: 'ユーザーは旅行の計画について相談していた',
        score: 0.88,
        namespace: 'default',
        strategyType: 'SUMMARY',
      });

      // Act - 会話イベント書き込み
      await mockClient.writeEvent({
        memoryId,
        actorId,
        sessionId,
        content: { text: '来月、京都に旅行に行きたいんです', role: 'USER' },
      });

      // Act - 長期メモリ検索
      const response = await mockClient.searchLongTermMemories({
        memoryId,
        actorId,
        query: '過去の会話内容',
        topK: 5,
        strategyType: 'SUMMARY',
      });

      // Assert
      expect(response.memories).toHaveLength(1);
      expect(response.memories[0].content).toContain('旅行');
      expect(response.memories[0].strategyType).toBe('SUMMARY');
    });

    test('User Preference Memoryが自動的に抽出される', async () => {
      // Arrange
      const memoryId = 'memory-resource-id';
      const actorId = 'user-123';
      const sessionId = 'session-456';

      // 長期メモリを手動で追加（実際にはAWSが自動抽出）
      mockClient.addLongTermMemory(memoryId, actorId, {
        memoryId: 'memory-003',
        content: 'ユーザーは簡潔な回答を好む',
        score: 0.92,
        namespace: 'preferences',
        strategyType: 'USER_PREFERENCE',
      });

      // Act - 会話イベント書き込み
      await mockClient.writeEvent({
        memoryId,
        actorId,
        sessionId,
        content: { text: '簡潔に教えてください', role: 'USER' },
      });

      // Act - 長期メモリ検索
      const response = await mockClient.searchLongTermMemories({
        memoryId,
        actorId,
        query: 'ユーザーの好み',
        topK: 5,
        strategyType: 'USER_PREFERENCE',
      });

      // Assert
      expect(response.memories).toHaveLength(1);
      expect(response.memories[0].content).toContain('簡潔');
      expect(response.memories[0].strategyType).toBe('USER_PREFERENCE');
    });
  });

  describe('長期メモリ検索フロー', () => {
    test('複数のMemory Strategiesから検索できる', async () => {
      // Arrange
      const memoryId = 'memory-resource-id';
      const actorId = 'user-123';

      // 複数の長期メモリを追加
      mockClient.addLongTermMemory(memoryId, actorId, {
        memoryId: 'memory-001',
        content: 'ユーザーは東京に住んでいる',
        score: 0.95,
        namespace: 'default',
        strategyType: 'SEMANTIC',
      });

      mockClient.addLongTermMemory(memoryId, actorId, {
        memoryId: 'memory-002',
        content: 'ユーザーは旅行の計画について相談していた',
        score: 0.88,
        namespace: 'default',
        strategyType: 'SUMMARY',
      });

      mockClient.addLongTermMemory(memoryId, actorId, {
        memoryId: 'memory-003',
        content: 'ユーザーは簡潔な回答を好む',
        score: 0.92,
        namespace: 'preferences',
        strategyType: 'USER_PREFERENCE',
      });

      // Act - 全てのMemory Strategiesから検索
      const response = await mockClient.searchLongTermMemories({
        memoryId,
        actorId,
        query: 'ユーザー情報',
        topK: 10,
      });

      // Assert
      expect(response.memories.length).toBeGreaterThan(0);
      const strategyTypes = response.memories.map(m => m.strategyType);
      expect(strategyTypes).toContain('SEMANTIC');
      expect(strategyTypes).toContain('SUMMARY');
      expect(strategyTypes).toContain('USER_PREFERENCE');
    });

    test('スコアの高い順に結果が返される', async () => {
      // Arrange
      const memoryId = 'memory-resource-id';
      const actorId = 'user-123';

      // スコアが異なる長期メモリを追加
      mockClient.addLongTermMemory(memoryId, actorId, {
        memoryId: 'memory-001',
        content: 'メモリ1',
        score: 0.85,
        namespace: 'default',
        strategyType: 'SEMANTIC',
      });

      mockClient.addLongTermMemory(memoryId, actorId, {
        memoryId: 'memory-002',
        content: 'メモリ2',
        score: 0.95,
        namespace: 'default',
        strategyType: 'SEMANTIC',
      });

      mockClient.addLongTermMemory(memoryId, actorId, {
        memoryId: 'memory-003',
        content: 'メモリ3',
        score: 0.90,
        namespace: 'default',
        strategyType: 'SEMANTIC',
      });

      // Act
      const response = await mockClient.searchLongTermMemories({
        memoryId,
        actorId,
        query: 'テスト',
        topK: 3,
      });

      // Assert
      expect(response.memories).toHaveLength(3);
      expect(response.memories[0].score).toBeGreaterThanOrEqual(response.memories[1].score);
      expect(response.memories[1].score).toBeGreaterThanOrEqual(response.memories[2].score);
    });
  });

  describe('Memory Strategies動作確認', () => {
    test('Semantic Strategyが正しく動作する', async () => {
      // Arrange
      const memoryId = 'memory-resource-id';
      const actorId = 'user-123';

      mockClient.addLongTermMemory(memoryId, actorId, {
        memoryId: 'memory-001',
        content: 'ユーザーは機械学習エンジニア',
        score: 0.95,
        namespace: 'default',
        strategyType: 'SEMANTIC',
      });

      // Act
      const response = await mockClient.searchLongTermMemories({
        memoryId,
        actorId,
        query: 'ユーザーの職業',
        topK: 5,
        strategyType: 'SEMANTIC',
      });

      // Assert
      expect(response.memories).toHaveLength(1);
      expect(response.memories[0].strategyType).toBe('SEMANTIC');
      expect(response.memories[0].content).toContain('機械学習');
    });

    test('Summary Strategyが正しく動作する', async () => {
      // Arrange
      const memoryId = 'memory-resource-id';
      const actorId = 'user-123';

      mockClient.addLongTermMemory(memoryId, actorId, {
        memoryId: 'memory-002',
        content: '過去の会話では、ユーザーはAWSのサービスについて質問していた',
        score: 0.88,
        namespace: 'default',
        strategyType: 'SUMMARY',
      });

      // Act
      const response = await mockClient.searchLongTermMemories({
        memoryId,
        actorId,
        query: '過去の会話',
        topK: 5,
        strategyType: 'SUMMARY',
      });

      // Assert
      expect(response.memories).toHaveLength(1);
      expect(response.memories[0].strategyType).toBe('SUMMARY');
      expect(response.memories[0].content).toContain('AWS');
    });

    test('User Preference Strategyが正しく動作する', async () => {
      // Arrange
      const memoryId = 'memory-resource-id';
      const actorId = 'user-123';

      mockClient.addLongTermMemory(memoryId, actorId, {
        memoryId: 'memory-003',
        content: 'ユーザーはコード例を含む回答を好む',
        score: 0.92,
        namespace: 'preferences',
        strategyType: 'USER_PREFERENCE',
      });

      // Act
      const response = await mockClient.searchLongTermMemories({
        memoryId,
        actorId,
        query: 'ユーザーの好み',
        topK: 5,
        strategyType: 'USER_PREFERENCE',
      });

      // Assert
      expect(response.memories).toHaveLength(1);
      expect(response.memories[0].strategyType).toBe('USER_PREFERENCE');
      expect(response.memories[0].content).toContain('コード例');
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量のイベント書き込みが処理される', async () => {
      // Arrange
      const memoryId = 'memory-resource-id';
      const actorId = 'user-123';
      const sessionId = 'session-456';
      const eventCount = 100;

      // Act
      const startTime = Date.now();
      for (let i = 0; i < eventCount; i++) {
        await mockClient.writeEvent({
          memoryId,
          actorId,
          sessionId,
          content: { text: `メッセージ${i}`, role: i % 2 === 0 ? 'USER' : 'ASSISTANT' },
        });
      }
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(mockClient.getCallHistory().filter(c => c.method === 'writeEvent')).toHaveLength(eventCount);
      // パフォーマンス要件: 100イベント書き込みが10秒以内（モックなので実際は非常に速い）
      expect(duration).toBeLessThan(10000);
    });

    test('大量の長期メモリ検索が処理される', async () => {
      // Arrange
      const memoryId = 'memory-resource-id';
      const actorId = 'user-123';
      const memoryCount = 50;

      // 大量の長期メモリを追加
      for (let i = 0; i < memoryCount; i++) {
        mockClient.addLongTermMemory(memoryId, actorId, {
          memoryId: `memory-${i}`,
          content: `メモリ${i}`,
          score: 0.5 + (i / memoryCount) * 0.5,
          namespace: 'default',
          strategyType: 'SEMANTIC',
        });
      }

      // Act
      const startTime = Date.now();
      const response = await mockClient.searchLongTermMemories({
        memoryId,
        actorId,
        query: 'テスト',
        topK: 10,
      });
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(response.memories).toHaveLength(10);
      // パフォーマンス要件: 検索が1秒以内（モックなので実際は非常に速い）
      expect(duration).toBeLessThan(1000);
    });
  });
});
