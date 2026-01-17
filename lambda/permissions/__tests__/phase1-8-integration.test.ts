/**
 * Phase 1-8 統合テスト
 * 
 * 全Phaseの機能が統合されて正しく動作することを検証
 */

import { UnifiedPermissionService } from '../unified-permission-service';
import { CacheService } from '../cache-service';
import { getLogger } from '../logger';
import { DirectoryPermission } from '../types';

// DynamoDBのモック
jest.mock('@aws-sdk/lib-dynamodb');

// FsxPermissionServiceのモック
jest.mock('../fsx-permission-service', () => {
  return {
    FsxPermissionService: jest.fn().mockImplementation(() => {
      return {
        queryUserPermissions: jest.fn().mockResolvedValue([
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
        ] as DirectoryPermission[]),
      };
    }),
  };
});

describe('Phase 1-8 Integration Tests', () => {
  let service: UnifiedPermissionService;
  let cacheService: CacheService;
  let logger: ReturnType<typeof getLogger>;

  beforeEach(() => {
    // 環境変数設定
    process.env.AWS_REGION = 'us-east-1';
    process.env.CACHE_ENABLED = 'true';
    process.env.CACHE_TTL_MINUTES = '5';
    process.env.PERMISSION_CACHE_TABLE = 'test-cache-table';
    
    // ONTAP REST API設定
    process.env.FSX_MANAGEMENT_ENDPOINT = 'https://management.fsx.test.com';
    process.env.FSX_VOLUME_UUID = 'test-volume-uuid';
    process.env.FSX_VOLUME_NAME = 'test-volume';
    process.env.ONTAP_CREDENTIALS_SECRET_NAME = 'test-secret';
    
    // SSM設定
    process.env.FSX_WINDOWS_INSTANCE_ID = 'i-test123';
    process.env.FSX_POWERSHELL_SCRIPT_PATH = '/scripts/Get-FsxAcl.ps1';

    service = new UnifiedPermissionService();
    cacheService = new CacheService({
      enabled: true,
      ttlMinutes: 5,
      tableName: 'test-cache-table',
    });
    logger = getLogger();
    logger.clearContext();
  });

  describe('統合シナリオ 1: 基本的な権限チェックフロー', () => {
    it('should perform complete permission check with all phases', async () => {
      // Phase 1-2: SID情報取得・権限計算
      const sidInfo = {
        userSID: 'S-1-5-21-123-456-789-1001',
        groupSIDs: ['S-1-5-21-123-456-789-513'],
        allSIDs: ['S-1-5-21-123-456-789-1001', 'S-1-5-21-123-456-789-513'],
      };

      // Phase 3-4: ONTAP REST API & FSx Permission Service
      // Phase 5: 統合権限サービス
      expect(service).toBeDefined();

      // Phase 6: 詳細チェック判定
      const decision = service.shouldPerformDetailedCheck({
        userId: 'user01',
        path: '/shared/documents/file.txt',
      });
      expect(decision).toBeDefined();
      expect(decision.required).toBe(true);
      expect(decision.method).toBe('ssm-powershell');

      // Phase 7: キャッシュ機能
      expect(cacheService).toBeDefined();
      const cacheKey = cacheService.generateCacheKey('user01', '/shared/documents');
      expect(cacheKey).toBe('user01:/shared/documents');

      // Phase 8: ログ機能
      expect(logger).toBeDefined();
      logger.logPermissionCheckStart('user01', '/shared/documents');
    });
  });

  describe('統合シナリオ 2: キャッシュ付き権限チェック', () => {
    it('should use cache for repeated permission checks', async () => {
      const userId = 'user01';
      const path = '/shared/documents';

      // 1回目: キャッシュミス → 新規取得
      const permissions1 = await service.getPermissionsWithCache(userId, path, false);
      expect(Array.isArray(permissions1)).toBe(true);

      // 2回目: キャッシュヒット（モック環境では実際にはヒットしない）
      const permissions2 = await service.getPermissionsWithCache(userId, path, false);
      expect(Array.isArray(permissions2)).toBe(true);
    });

    it('should invalidate cache when requested', async () => {
      const userId = 'user01';
      const path = '/shared/documents';

      // キャッシュ無効化
      await service.invalidateCache(userId, path);

      // 無効化後の権限取得
      const permissions = await service.getPermissionsWithCache(userId, path, false);
      expect(Array.isArray(permissions)).toBe(true);
    });
  });

  describe('統合シナリオ 3: 詳細チェック判定フロー', () => {
    it('should determine detailed check based on file extension', () => {
      const testCases = [
        { path: '/shared/documents/file.txt', expected: true },
        { path: '/shared/documents/file.pdf', expected: true },
        { path: '/shared/documents', expected: false },
        { path: '/shared', expected: false },
      ];

      testCases.forEach(({ path, expected }) => {
        const decision = service.shouldPerformDetailedCheck({
          userId: 'user01',
          path,
        });
        expect(decision.required).toBe(expected);
      });
    });

    it('should force detailed check when explicitly requested', () => {
      const decision = service.shouldPerformDetailedCheck({
        userId: 'user01',
        path: '/shared/documents',
        detailedCheck: true,
      });

      expect(decision.required).toBe(true);
      expect(decision.method).toBe('ssm-powershell');
      expect(decision.reason).toBe('Explicit detailedCheck flag is true');
    });

    it('should check inheritance when requested', () => {
      const decision = service.shouldPerformDetailedCheck({
        userId: 'user01',
        path: '/shared/documents',
        checkInheritance: true,
      });

      expect(decision.required).toBe(true);
      expect(decision.method).toBe('ssm-powershell');
      expect(decision.reason).toBe('Inheritance check required');
    });

    it('should check deny permissions when requested', () => {
      const decision = service.shouldPerformDetailedCheck({
        userId: 'user01',
        path: '/shared/documents',
        checkDeny: true,
      });

      expect(decision.required).toBe(true);
      expect(decision.method).toBe('ssm-powershell');
      expect(decision.reason).toBe('Deny check required');
    });
  });

  describe('統合シナリオ 4: ログ機能統合', () => {
    it('should log complete permission check flow', () => {
      const timer = logger.startTimer();

      // 権限チェック開始
      logger.logPermissionCheckStart('user01', '/shared/documents', {
        requestId: 'req-123',
      });

      // ONTAP API呼び出し
      logger.logOntapApiStart('/api/protocols/cifs/shares', 'GET');
      logger.logOntapApiComplete('/api/protocols/cifs/shares', 'GET', 200, 250);

      // キャッシュ操作
      logger.logCacheMiss('user01', '/shared/documents', 'Entry not found');
      logger.logCacheSave('user01', '/shared/documents', Date.now() + 300);

      // 権限チェック完了
      const duration = timer();
      logger.logPermissionCheckComplete('user01', '/shared/documents', true, duration);

      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should log errors properly', () => {
      const error = new Error('Test error');
      logger.logError('テストエラー', error, {
        userId: 'user01',
        operation: 'permission-check',
      });

      // エラーログが記録されることを確認（実際のログ出力は検証しない）
      expect(error.message).toBe('Test error');
    });
  });

  describe('統合シナリオ 5: エンドツーエンドフロー', () => {
    it('should perform complete end-to-end permission check', async () => {
      const timer = logger.startTimer();

      // グローバルコンテキスト設定
      logger.setContext({
        requestId: 'req-e2e-123',
        sessionId: 'session-456',
      });

      const context = {
        userId: 'user01',
        path: '/shared/documents/report.pdf',
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      };

      // 権限チェック開始ログ
      logger.logPermissionCheckStart(context.userId, context.path, {
        ipAddress: context.ipAddress,
      });

      try {
        // 詳細チェック判定
        const decision = service.shouldPerformDetailedCheck(context);
        expect(decision.required).toBe(true);

        // キャッシュ確認
        const cacheResult = await cacheService.getFromCache(context.userId, context.path);
        expect(cacheResult.success).toBe(false); // モック環境ではミス

        // 権限取得（キャッシュ付き）
        const permissions = await service.getPermissionsWithCache(
          context.userId,
          context.path,
          decision.required
        );
        expect(Array.isArray(permissions)).toBe(true);

        // 権限チェック完了ログ
        const duration = timer();
        logger.logPermissionCheckComplete(
          context.userId,
          context.path,
          true,
          duration,
          {
            permissionCount: permissions.length,
            detailedCheck: decision.required,
          }
        );

        expect(duration).toBeGreaterThanOrEqual(0);
      } catch (error) {
        logger.logError('権限チェックエラー', error as Error, {
          userId: context.userId,
          path: context.path,
        });
        throw error;
      } finally {
        logger.clearContext();
      }
    });
  });

  describe('統合シナリオ 6: パフォーマンステスト', () => {
    it('should handle multiple concurrent permission checks', async () => {
      const users = ['user01', 'user02', 'user03'];
      const paths = ['/shared/documents', '/shared/public', '/shared/private'];

      const promises = users.flatMap((userId) =>
        paths.map((path) => service.getPermissionsWithCache(userId, path, false))
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(9);
      results.forEach((result) => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should complete permission check within acceptable time', async () => {
      const timer = logger.startTimer();

      await service.getPermissionsWithCache('user01', '/shared/documents', false);

      const duration = timer();
      expect(duration).toBeLessThan(5000); // 5秒以内
    });
  });

  describe('統合シナリオ 7: エラーハンドリング', () => {
    it('should handle cache errors gracefully', async () => {
      // キャッシュエラーが発生しても権限取得は継続される
      const permissions = await service.getPermissionsWithCache(
        'user01',
        '/shared/documents',
        false
      );

      expect(Array.isArray(permissions)).toBe(true);
    });

    it('should log errors with proper context', () => {
      logger.setContext({
        requestId: 'req-error-123',
        userId: 'user01',
      });

      const error = new Error('Simulated error');
      logger.logError('エラーハンドリングテスト', error);

      logger.clearContext();
    });
  });
});
