/**
 * Cache Service プロパティテスト
 * 
 * Property 18-22: キャッシュ機能の正確性
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { CacheService, DEFAULT_CACHE_CONFIG } from '../cache-service';
import { DirectoryPermission, CacheConfig } from '../types';

// DynamoDBのモック
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({
        send: mockSend,
      })),
    },
    GetCommand: jest.fn((params) => params),
    PutCommand: jest.fn((params) => params),
    DeleteCommand: jest.fn((params) => params),
  };
});

describe('Cache Service - Property Tests', () => {
  let cacheService: CacheService;
  let mockDynamoSend: jest.Mock;

  const testConfig: CacheConfig = {
    enabled: true,
    ttlMinutes: 5,
    tableName: 'test-cache-table',
  };

  const samplePermissions: DirectoryPermission[] = [
    {
      path: '/shared/documents',
      permissions: ['read', 'write'],
      owner: 'DOMAIN\\Administrator',
      group: 'DOMAIN\\Domain Users',
    },
    {
      path: '/shared/public',
      permissions: ['read'],
      owner: 'DOMAIN\\Administrator',
      group: 'DOMAIN\\Domain Users',
    },
  ];

  beforeEach(() => {
    process.env.AWS_REGION = 'us-east-1';
    
    jest.clearAllMocks();
    
    // mockDynamoSendを取得
    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
    const mockClient = DynamoDBDocumentClient.from();
    mockDynamoSend = mockClient.send as jest.Mock;
    
    cacheService = new CacheService(testConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 18: キャッシュキー生成の一意性', () => {
    /**
     * 異なるユーザーIDとパスの組み合わせで一意のキャッシュキーが生成されることを検証
     * Validates: Requirements 6.1
     */

    it('should generate unique cache keys for different user-path combinations', () => {
      const testCases = [
        { userId: 'user01', path: '/shared/documents' },
        { userId: 'user02', path: '/shared/documents' },
        { userId: 'user01', path: '/shared/public' },
        { userId: 'user01', path: '/SHARED/DOCUMENTS' }, // 大文字小文字の違い
        { userId: 'user01', path: '\\\\shared\\documents' }, // バックスラッシュ
      ];

      const keys = testCases.map(({ userId, path }) => 
        cacheService.generateCacheKey(userId, path)
      );

      // 正規化により、大文字小文字とスラッシュの違いは同じキーになる
      expect(keys[0]).toBe('user01:/shared/documents');
      expect(keys[1]).toBe('user02:/shared/documents');
      expect(keys[2]).toBe('user01:/shared/public');
      expect(keys[3]).toBe('user01:/shared/documents'); // 正規化により同じ
      expect(keys[4]).toBe('user01:/shared/documents'); // 正規化により同じ

      // 異なるユーザーまたはパスは異なるキー
      expect(keys[0]).not.toBe(keys[1]);
      expect(keys[0]).not.toBe(keys[2]);
    });

    it('should normalize paths consistently', () => {
      const userId = 'testuser';
      const paths = [
        '/shared/documents',
        '/SHARED/DOCUMENTS',
        '\\\\shared\\documents',
        '\\\\SHARED\\DOCUMENTS',
      ];

      const keys = paths.map(path => cacheService.generateCacheKey(userId, path));
      
      // すべて同じキーになることを確認
      const expectedKey = 'testuser:/shared/documents';
      keys.forEach(key => {
        expect(key).toBe(expectedKey);
      });
    });

    it('should handle special characters in paths', () => {
      const testCases = [
        { userId: 'user01', path: '/shared/user\'s folder' },
        { userId: 'user01', path: '/shared/folder with spaces' },
        { userId: 'user01', path: '/shared/folder-with-dashes' },
        { userId: 'user01', path: '/shared/folder_with_underscores' },
      ];

      testCases.forEach(({ userId, path }) => {
        const key = cacheService.generateCacheKey(userId, path);
        expect(key).toContain(userId);
        expect(key).toContain(':');
        expect(key.length).toBeGreaterThan(userId.length + 1);
      });
    });
  });

  describe('Property 19: キャッシュ保存の完全性', () => {
    /**
     * 保存されたキャッシュエントリが必要なフィールドを含むことを検証
     * Validates: Requirements 6.2
     */

    it('should save cache entry with all required fields', async () => {
      mockDynamoSend.mockResolvedValueOnce({});

      const userId = 'user01';
      const path = '/shared/documents';
      const source = 'ontap-api';

      const result = await cacheService.saveToCache(userId, path, samplePermissions, source);

      expect(result.success).toBe(true);
      expect(mockDynamoSend).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: testConfig.tableName,
          Item: expect.objectContaining({
            cacheKey: 'user01:/shared/documents',
            userId,
            path,
            permissions: samplePermissions,
            source,
            timestamp: expect.any(Number),
            ttl: expect.any(Number),
          }),
        })
      );
    });

    it('should set correct TTL based on configuration', async () => {
      mockDynamoSend.mockResolvedValueOnce({});

      const userId = 'user01';
      const path = '/shared/documents';
      const beforeTime = Math.floor(Date.now() / 1000);

      await cacheService.saveToCache(userId, path, samplePermissions, 'ontap-api');

      const afterTime = Math.floor(Date.now() / 1000);
      const expectedMinTtl = beforeTime + (testConfig.ttlMinutes * 60);
      const expectedMaxTtl = afterTime + (testConfig.ttlMinutes * 60);

      expect(mockDynamoSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Item: expect.objectContaining({
            ttl: expect.any(Number),
          }),
        })
      );

      const actualTtl = mockDynamoSend.mock.calls[0][0].Item.ttl;
      expect(actualTtl).toBeGreaterThanOrEqual(expectedMinTtl);
      expect(actualTtl).toBeLessThanOrEqual(expectedMaxTtl);
    });

    it('should handle save errors gracefully', async () => {
      const error = new Error('DynamoDB save error');
      mockDynamoSend.mockRejectedValueOnce(error);

      const result = await cacheService.saveToCache(
        'user01',
        '/shared/documents',
        samplePermissions,
        'ontap-api'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cache save error');
    });

    it('should not save when cache is disabled', async () => {
      const disabledCacheService = new CacheService({ ...testConfig, enabled: false });

      const result = await disabledCacheService.saveToCache(
        'user01',
        '/shared/documents',
        samplePermissions,
        'ontap-api'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cache disabled');
      expect(mockDynamoSend).not.toHaveBeenCalled();
    });
  });

  describe('Property 20: キャッシュ取得の正確性', () => {
    /**
     * キャッシュから取得されるデータが保存時と同じであることを検証
     * Validates: Requirements 6.3
     */

    it('should retrieve cached data correctly', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const cacheEntry = {
        cacheKey: 'user01:/shared/documents',
        userId: 'user01',
        path: '/shared/documents',
        permissions: samplePermissions,
        timestamp: currentTime,
        ttl: currentTime + 300, // 5分後
        source: 'ontap-api',
      };

      mockDynamoSend.mockResolvedValueOnce({ Item: cacheEntry });

      const result = await cacheService.getFromCache('user01', '/shared/documents');

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
      expect(result.data).toEqual(samplePermissions);
      expect(mockDynamoSend).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: testConfig.tableName,
          Key: { cacheKey: 'user01:/shared/documents' },
        })
      );
    });

    it('should handle cache miss', async () => {
      mockDynamoSend.mockResolvedValueOnce({}); // Item not found

      const result = await cacheService.getFromCache('user01', '/shared/documents');

      expect(result.success).toBe(false);
      expect(result.fromCache).toBe(false);
      expect(result.error).toBe('Cache miss');
    });

    it('should handle expired cache entries', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expiredEntry = {
        cacheKey: 'user01:/shared/documents',
        userId: 'user01',
        path: '/shared/documents',
        permissions: samplePermissions,
        timestamp: currentTime - 600,
        ttl: currentTime - 300, // 5分前に期限切れ
        source: 'ontap-api',
      };

      mockDynamoSend
        .mockResolvedValueOnce({ Item: expiredEntry }) // Get
        .mockResolvedValueOnce({}); // Delete

      const result = await cacheService.getFromCache('user01', '/shared/documents');

      expect(result.success).toBe(false);
      expect(result.fromCache).toBe(false);
      expect(result.error).toBe('Cache expired');
      
      // 期限切れエントリが削除されることを確認
      expect(mockDynamoSend).toHaveBeenCalledTimes(2);
    });

    it('should handle get errors gracefully', async () => {
      const error = new Error('DynamoDB get error');
      mockDynamoSend.mockRejectedValueOnce(error);

      const result = await cacheService.getFromCache('user01', '/shared/documents');

      expect(result.success).toBe(false);
      expect(result.fromCache).toBe(false);
      expect(result.error).toContain('Cache get error');
    });

    it('should not get when cache is disabled', async () => {
      const disabledCacheService = new CacheService({ ...testConfig, enabled: false });

      const result = await disabledCacheService.getFromCache('user01', '/shared/documents');

      expect(result.success).toBe(false);
      expect(result.fromCache).toBe(false);
      expect(result.error).toBe('Cache disabled');
      expect(mockDynamoSend).not.toHaveBeenCalled();
    });
  });

  describe('Property 21: TTL期限切れの正確性', () => {
    /**
     * TTLが正しく設定され、期限切れエントリが適切に処理されることを検証
     * Validates: Requirements 6.2, 6.3, 6.5
     */

    it('should calculate TTL correctly for different configurations', () => {
      const testConfigs = [
        { ttlMinutes: 1 },
        { ttlMinutes: 5 },
        { ttlMinutes: 15 },
        { ttlMinutes: 60 },
      ];

      testConfigs.forEach(({ ttlMinutes }) => {
        const service = new CacheService({ ...testConfig, ttlMinutes });
        mockDynamoSend.mockResolvedValueOnce({});

        const beforeTime = Math.floor(Date.now() / 1000);
        service.saveToCache('user01', '/test', samplePermissions, 'ontap-api');
        const afterTime = Math.floor(Date.now() / 1000);

        const expectedMinTtl = beforeTime + (ttlMinutes * 60);
        const expectedMaxTtl = afterTime + (ttlMinutes * 60);

        const actualTtl = mockDynamoSend.mock.calls[mockDynamoSend.mock.calls.length - 1][0].Item.ttl;
        expect(actualTtl).toBeGreaterThanOrEqual(expectedMinTtl);
        expect(actualTtl).toBeLessThanOrEqual(expectedMaxTtl);
      });
    });

    it('should detect expired entries accurately', async () => {
      const testCases = [
        { ttl: Math.floor(Date.now() / 1000) - 1, shouldBeExpired: true },   // 1秒前に期限切れ
        { ttl: Math.floor(Date.now() / 1000), shouldBeExpired: true },       // ちょうど期限切れ
        { ttl: Math.floor(Date.now() / 1000) + 1, shouldBeExpired: false },  // 1秒後に期限切れ
        { ttl: Math.floor(Date.now() / 1000) + 300, shouldBeExpired: false }, // 5分後に期限切れ
      ];

      for (const { ttl, shouldBeExpired } of testCases) {
        const currentTime = Math.floor(Date.now() / 1000);
        const entry = {
          cacheKey: 'user01:/test',
          userId: 'user01',
          path: '/test',
          permissions: samplePermissions,
          timestamp: currentTime - 300,
          ttl,
          source: 'ontap-api' as const,
        };

        if (shouldBeExpired) {
          mockDynamoSend
            .mockResolvedValueOnce({ Item: entry }) // Get
            .mockResolvedValueOnce({}); // Delete
        } else {
          mockDynamoSend.mockResolvedValueOnce({ Item: entry });
        }

        const result = await cacheService.getFromCache('user01', '/test');

        if (shouldBeExpired) {
          expect(result.success).toBe(false);
          expect(result.error).toBe('Cache expired');
        } else {
          expect(result.success).toBe(true);
          expect(result.data).toEqual(samplePermissions);
        }
      }
    });
  });

  describe('Property 22: キャッシュエラーハンドリング', () => {
    /**
     * DynamoDBエラー時に適切なフォールバック処理が行われることを検証
     * Validates: Requirements 6.4
     */

    it('should handle DynamoDB connection errors', async () => {
      const connectionError = new Error('Unable to connect to DynamoDB');
      
      // Get操作のエラー
      mockDynamoSend.mockRejectedValueOnce(connectionError);
      const getResult = await cacheService.getFromCache('user01', '/test');
      expect(getResult.success).toBe(false);
      expect(getResult.error).toContain('Cache get error');

      // Save操作のエラー
      mockDynamoSend.mockRejectedValueOnce(connectionError);
      const saveResult = await cacheService.saveToCache('user01', '/test', samplePermissions, 'ontap-api');
      expect(saveResult.success).toBe(false);
      expect(saveResult.error).toContain('Cache save error');

      // Delete操作のエラー
      mockDynamoSend.mockRejectedValueOnce(connectionError);
      const deleteResult = await cacheService.deleteFromCache('user01', '/test');
      expect(deleteResult.success).toBe(false);
      expect(deleteResult.error).toContain('Cache delete error');
    });

    it('should handle DynamoDB throttling errors', async () => {
      const throttlingError = new Error('ProvisionedThroughputExceededException');
      mockDynamoSend.mockRejectedValue(throttlingError);

      const result = await cacheService.getFromCache('user01', '/test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('ProvisionedThroughputExceededException');
    });

    it('should handle malformed cache entries', async () => {
      const malformedEntry = {
        cacheKey: 'user01:/test',
        // 必須フィールドが不足
      };

      mockDynamoSend.mockResolvedValueOnce({ Item: malformedEntry });

      const result = await cacheService.getFromCache('user01', '/test');
      
      // malformedEntryでもTTLチェックは実行される（undefinedは0より小さいとして扱われる）
      expect(result.success).toBe(false);
    });

    it('should handle cache deletion errors gracefully', async () => {
      const deleteError = new Error('DynamoDB delete error');
      mockDynamoSend.mockRejectedValueOnce(deleteError);

      const result = await cacheService.deleteFromCache('user01', '/test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cache delete error');
    });
  });

  describe('Cache Configuration and Stats', () => {
    it('should return correct cache stats', () => {
      const stats = cacheService.getCacheStats();
      
      expect(stats).toEqual({
        enabled: testConfig.enabled,
        ttlMinutes: testConfig.ttlMinutes,
        tableName: testConfig.tableName,
      });
    });

    it('should update cache configuration', () => {
      const newConfig = { ttlMinutes: 10, enabled: false };
      cacheService.updateConfig(newConfig);
      
      const stats = cacheService.getCacheStats();
      expect(stats.ttlMinutes).toBe(10);
      expect(stats.enabled).toBe(false);
      expect(stats.tableName).toBe(testConfig.tableName); // 変更されていない
    });
  });
});
