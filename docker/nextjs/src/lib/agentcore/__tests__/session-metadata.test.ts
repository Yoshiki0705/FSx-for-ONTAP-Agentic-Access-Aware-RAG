/**
 * セッションメタデータ管理のユニットテスト
 *
 * Requirements: 4.1, 4.2
 */

// jest.mock は hoisting されるため、__mocks__ パターンを使用
// mockSend を jest.mock factory 内で定義し、外部から参照する
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({ __mock: true })),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  // mockSend は hoisting 後もアクセス可能（const → var 的に扱われる）
  return {
    DynamoDBDocumentClient: {
      from: jest.fn().mockImplementation(() => ({
        send: (...args: any[]) => mockSend(...args),
      })),
    },
    PutCommand: jest.fn().mockImplementation((input: any) => ({ input })),
    ScanCommand: jest.fn().mockImplementation((input: any) => ({ input })),
    UpdateCommand: jest.fn().mockImplementation((input: any) => ({ input })),
  };
});

// モック定義後にインポート
import {
  saveSessionMetadata,
  getSessionList,
  updateSessionMetadata,
} from '../session-metadata';

describe('session-metadata', () => {
  beforeEach(() => {
    mockSend.mockReset();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const userId = 'test-user-001';
  const sessionId = 'sess-abc-123';

  describe('saveSessionMetadata', () => {
    it('should save with correct cacheKey pattern and attributes', async () => {
      mockSend.mockResolvedValueOnce({});

      await saveSessionMetadata(userId, sessionId, {
        mode: 'agent',
        title: 'Test Session',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const item = mockSend.mock.calls[0][0].input.Item;

      expect(item.cacheKey).toBe(`memory-session#${userId}#${sessionId}`);
      expect(item.sessionId).toBe(sessionId);
      expect(item.userId).toBe(userId);
      expect(item.mode).toBe('agent');
      expect(item.title).toBe('Test Session');
      expect(item.messageCount).toBe(0);
      expect(item.createdAt).toBe('2025-06-15T12:00:00.000Z');
      expect(item.updatedAt).toBe('2025-06-15T12:00:00.000Z');
    });

    it('should set TTL to 7 days from now', async () => {
      mockSend.mockResolvedValueOnce({});

      await saveSessionMetadata(userId, sessionId, { mode: 'kb' });

      const item = mockSend.mock.calls[0][0].input.Item;
      const nowEpoch = Math.floor(new Date('2025-06-15T12:00:00Z').getTime() / 1000);
      const sevenDays = 7 * 24 * 60 * 60;

      expect(item.ttl).toBe(nowEpoch + sevenDays);
    });

    it('should default mode to agent when not provided', async () => {
      mockSend.mockResolvedValueOnce({});

      await saveSessionMetadata(userId, sessionId, {});

      expect(mockSend.mock.calls[0][0].input.Item.mode).toBe('agent');
    });
  });

  describe('getSessionList', () => {
    it('should scan with begins_with filter and sort by updatedAt desc', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { sessionId: 'sess-1', updatedAt: '2025-06-15T11:00:00Z', messageCount: 5 },
          { sessionId: 'sess-2', updatedAt: '2025-06-15T12:00:00Z', messageCount: 3 },
        ],
        LastEvaluatedKey: undefined,
      });

      const result = await getSessionList(userId);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.FilterExpression).toBe('begins_with(cacheKey, :prefix)');
      expect(cmd.input.ExpressionAttributeValues[':prefix']).toBe(
        `memory-session#${userId}#`,
      );

      // updatedAt 降順
      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe('sess-2');
      expect(result[1].sessionId).toBe('sess-1');
    });

    it('should handle pagination across multiple scans', async () => {
      mockSend
        .mockResolvedValueOnce({
          Items: [{ sessionId: 'sess-1', updatedAt: '2025-06-15T10:00:00Z' }],
          LastEvaluatedKey: { cacheKey: 'some-key' },
        })
        .mockResolvedValueOnce({
          Items: [{ sessionId: 'sess-2', updatedAt: '2025-06-15T11:00:00Z' }],
          LastEvaluatedKey: undefined,
        });

      const result = await getSessionList(userId);

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no sessions exist', async () => {
      mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });

      const result = await getSessionList(userId);
      expect(result).toHaveLength(0);
    });
  });

  describe('updateSessionMetadata', () => {
    it('should update messageCount with correct key and expression', async () => {
      mockSend.mockResolvedValueOnce({});

      await updateSessionMetadata(userId, sessionId, { messageCount: 10 });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const input = mockSend.mock.calls[0][0].input;

      expect(input.Key.cacheKey).toBe(`memory-session#${userId}#${sessionId}`);
      expect(input.UpdateExpression).toContain('#messageCount = :messageCount');
      expect(input.UpdateExpression).toContain('#updatedAt = :updatedAt');
      expect(input.UpdateExpression).toContain('#ttl = :ttl');
      expect(input.ExpressionAttributeValues[':messageCount']).toBe(10);
    });

    it('should always update updatedAt and TTL', async () => {
      mockSend.mockResolvedValueOnce({});

      await updateSessionMetadata(userId, sessionId, {});

      const input = mockSend.mock.calls[0][0].input;
      expect(input.UpdateExpression).toContain('#updatedAt = :updatedAt');
      expect(input.UpdateExpression).toContain('#ttl = :ttl');
      expect(input.ExpressionAttributeValues[':updatedAt']).toBe('2025-06-15T12:00:00.000Z');
    });

    it('should update title when provided', async () => {
      mockSend.mockResolvedValueOnce({});

      await updateSessionMetadata(userId, sessionId, { title: 'New Title' });

      const input = mockSend.mock.calls[0][0].input;
      expect(input.UpdateExpression).toContain('#title = :title');
      expect(input.ExpressionAttributeValues[':title']).toBe('New Title');
    });
  });
});
