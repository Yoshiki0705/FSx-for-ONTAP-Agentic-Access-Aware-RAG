/**
 * UnifiedPermissions統合テスト
 * 
 * Phase 10: UnifiedPermissions統合のテストケース
 * 
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { UnifiedPermissionService } from '../unified-permission-service';
import { DirectoryPermission } from '../fsx-permission-service';

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
  };
});

// FsxPermissionServiceモック
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
        ] as DirectoryPermission[]),
      };
    }),
  };
});

// モックされたsend関数を取得
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

describe('UnifiedPermissions Integration', () => {
  let service: UnifiedPermissionService;
  let mockSend: jest.Mock;

  beforeEach(() => {
    // 環境変数設定
    process.env.FSX_MANAGEMENT_ENDPOINT = 'https://management.fsx.test.com';
    process.env.FSX_VOLUME_UUID = 'test-volume-uuid';
    process.env.CACHE_ENABLED = 'false';
    process.env.PERMISSION_TABLE = 'test-permission-table';
    process.env.USER_ACCESS_TABLE_NAME = 'test-user-access-table';
    process.env.ONTAP_CREDENTIALS_SECRET_NAME = 'test-ontap-secret';
    process.env.AWS_REGION = 'us-east-1';

    // モックをリセット
    jest.clearAllMocks();

    // mockSendを取得
    const mockClient = DynamoDBDocumentClient.from();
    mockSend = mockClient.send as jest.Mock;

    // モックデータを設定
    mockSend.mockResolvedValue({
      Item: {
        userId: 'testuser',
        displayName: 'Test User',
        role: 'developer',
        permissionLevel: 'project',
        department: 'Engineering',
        permissions: 'read,write,execute',
        SID: [
          'S-1-5-21-1234567890-1234567890-1234567890-1001',
          'S-1-5-21-1234567890-1234567890-1234567890-513',
        ],
        userSID: 'S-1-5-21-1234567890-1234567890-1234567890-1001',
        groups: [
          { Name: 'Domain Users', SID: 'S-1-5-21-1234567890-1234567890-1234567890-513' },
        ],
      },
    });

    service = new UnifiedPermissionService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 28: UnifiedPermissions形式の完全性', () => {
    it('should include all required fields in UnifiedPermissions', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
        ipAddress: '192.168.1.100',
        timestamp: new Date('2024-01-15T10:00:00Z'),
      });

      // 基本フィールド
      expect(result.userId).toBe('testuser');
      expect(result.userName).toBe('Test User');
      expect(result.role).toBe('developer');
      expect(result.permissionLevel).toBe('project');
      expect(result.department).toBe('Engineering');

      // アプリケーション権限
      expect(result.applicationPermissions).toEqual(['read', 'write', 'execute']);

      // アクセス可能なディレクトリ
      expect(result.accessibleDirectories).toBeDefined();
      expect(Array.isArray(result.accessibleDirectories)).toBe(true);

      // 時間制限
      expect(result.timeRestrictions).toBeDefined();
      expect(result.timeRestrictions).toHaveProperty('allowedHours');
      expect(result.timeRestrictions).toHaveProperty('timezone');

      // 地理的制限
      expect(result.geographicRestrictions).toBeDefined();
      expect(result.geographicRestrictions).toHaveProperty('allowedRegions');
      expect(result.geographicRestrictions).toHaveProperty('deniedRegions');

      // 総合的なアクセス判定
      expect(result.overallAccess).toBeDefined();
      expect(result.overallAccess).toHaveProperty('canRead');
      expect(result.overallAccess).toHaveProperty('canWrite');
      expect(result.overallAccess).toHaveProperty('canDelete');
      expect(result.overallAccess).toHaveProperty('canAdmin');

      // SID情報
      expect(result.sidInfo).toBeDefined();
      expect(result.sidInfo.userSID).toBe('S-1-5-21-1234567890-1234567890-1234567890-1001');
      expect(result.sidInfo.groupSIDs).toContain('S-1-5-21-1234567890-1234567890-1234567890-513');
      expect(result.sidInfo.groups).toHaveLength(1);
      expect(result.sidInfo.groups[0].Name).toBe('Domain Users');
    });

    it('should include accessibleDirectories with correct structure', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
      });

      expect(result.accessibleDirectories).toBeDefined();
      expect(result.accessibleDirectories.length).toBeGreaterThan(0);

      const directory = result.accessibleDirectories[0];
      expect(directory).toHaveProperty('path');
      expect(directory).toHaveProperty('permissions');
      expect(directory).toHaveProperty('owner');
      expect(directory).toHaveProperty('group');
      expect(Array.isArray(directory.permissions)).toBe(true);
    });

    it('should include SID information with groups', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
      });

      expect(result.sidInfo).toBeDefined();
      expect(result.sidInfo.userSID).toBeDefined();
      expect(result.sidInfo.groupSIDs).toBeDefined();
      expect(Array.isArray(result.sidInfo.groupSIDs)).toBe(true);
      expect(result.sidInfo.groups).toBeDefined();
      expect(Array.isArray(result.sidInfo.groups)).toBe(true);

      if (result.sidInfo.groups.length > 0) {
        const group = result.sidInfo.groups[0];
        expect(group).toHaveProperty('Name');
        expect(group).toHaveProperty('SID');
      }
    });
  });

  describe('Property 29: 時間制限情報の含有', () => {
    it('should include timeRestrictions field', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
        timestamp: new Date('2024-01-15T10:00:00Z'), // 月曜日 10:00
      });

      expect(result.timeRestrictions).toBeDefined();
      expect(typeof result.timeRestrictions).toBe('object');
    });

    it('should include allowedHours during business hours', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
        timestamp: new Date('2024-01-15T10:00:00Z'), // 月曜日 10:00 (営業時間内)
      });

      expect(result.timeRestrictions.allowedHours).toBeDefined();
      expect(result.timeRestrictions.timezone).toBe('Asia/Tokyo');
    });

    it('should handle non-business hours', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
        timestamp: new Date('2024-01-14T10:00:00Z'), // 日曜日 10:00 (営業時間外)
      });

      expect(result.timeRestrictions).toBeDefined();
      expect(result.timeRestrictions.timezone).toBe('Asia/Tokyo');
    });

    it('should include timezone information', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
      });

      expect(result.timeRestrictions.timezone).toBeDefined();
      expect(typeof result.timeRestrictions.timezone).toBe('string');
    });
  });

  describe('overallAccess field validation', () => {
    it('should include all access flags', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
      });

      expect(result.overallAccess.canRead).toBeDefined();
      expect(result.overallAccess.canWrite).toBeDefined();
      expect(result.overallAccess.canDelete).toBeDefined();
      expect(result.overallAccess.canAdmin).toBeDefined();

      expect(typeof result.overallAccess.canRead).toBe('boolean');
      expect(typeof result.overallAccess.canWrite).toBe('boolean');
      expect(typeof result.overallAccess.canDelete).toBe('boolean');
      expect(typeof result.overallAccess.canAdmin).toBe('boolean');
    });

    it('should set canRead to true when read permission exists', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
      });

      expect(result.overallAccess.canRead).toBe(true);
    });

    it('should set canWrite to true when write permission exists', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
      });

      expect(result.overallAccess.canWrite).toBe(true);
    });
  });

  describe('geographicRestrictions field validation', () => {
    it('should include allowedRegions', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
        ipAddress: '192.168.1.100',
      });

      expect(result.geographicRestrictions.allowedRegions).toBeDefined();
      expect(Array.isArray(result.geographicRestrictions.allowedRegions)).toBe(true);
    });

    it('should include deniedRegions', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
        ipAddress: '192.168.1.100',
      });

      expect(result.geographicRestrictions.deniedRegions).toBeDefined();
      expect(Array.isArray(result.geographicRestrictions.deniedRegions)).toBe(true);
    });
  });

  describe('Integration with multiple sources', () => {
    it('should integrate DynamoDB, FSx, and context information', async () => {
      const result = await service.checkUnifiedPermissions({
        userId: 'testuser',
        path: '/shared/documents',
        ipAddress: '192.168.1.100',
        timestamp: new Date('2024-01-15T10:00:00Z'),
      });

      // DynamoDB情報
      expect(result.userName).toBe('Test User');
      expect(result.permissionLevel).toBe('project');

      // FSx情報
      expect(result.accessibleDirectories.length).toBeGreaterThan(0);

      // コンテキスト情報
      expect(result.timeRestrictions).toBeDefined();
      expect(result.geographicRestrictions).toBeDefined();

      // SID情報
      expect(result.sidInfo.userSID).toBeDefined();
    });
  });
});
