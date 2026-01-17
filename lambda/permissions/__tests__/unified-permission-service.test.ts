/**
 * UnifiedPermissionService テスト
 * 
 * Property 1-2: SID情報取得の正確性とエラー処理
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5, 8.1
 */

import { UnifiedPermissionService } from '../unified-permission-service';

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

// モックされたsend関数を取得
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

describe('UnifiedPermissionService - SID情報取得', () => {
  let service: UnifiedPermissionService;
  let mockSend: jest.Mock;

  beforeEach(() => {
    // 環境変数を設定
    process.env.USER_ACCESS_TABLE_NAME = 'test-user-access-table';
    process.env.PERMISSION_TABLE = 'test-permission-table';
    process.env.FSX_MANAGEMENT_ENDPOINT = 'https://test-fsx-endpoint.example.com';
    process.env.ONTAP_CREDENTIALS_SECRET_NAME = 'test-ontap-secret';
    process.env.AWS_REGION = 'us-east-1';

    // モックをリセット
    jest.clearAllMocks();

    // mockSendを取得
    const mockClient = DynamoDBDocumentClient.from();
    mockSend = mockClient.send as jest.Mock;

    service = new UnifiedPermissionService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 1: SID情報取得の完全性', () => {
    /**
     * 任意の有効なユーザーIDに対して、userSIDとSID配列が含まれることを検証
     * Validates: Requirements 1.1, 1.2, 1.5
     */

    it('should extract userSID from explicit userSID field', async () => {
      // パターン1: userSIDフィールドが明示的に存在
      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'user01',
          userSID: 'S-1-5-21-123-456-789-1001',
          SID: [
            'S-1-5-21-123-456-789-1001',
            'S-1-5-21-123-456-789-512',
            'S-1-5-21-123-456-789-513',
          ],
        },
      });

      const result = await service.getUserSIDInfo('user01');

      expect(result.userSID).toBe('S-1-5-21-123-456-789-1001');
      expect(result.groupSIDs).toHaveLength(2);
      expect(result.groupSIDs).toContain('S-1-5-21-123-456-789-512');
      expect(result.groupSIDs).toContain('S-1-5-21-123-456-789-513');
      expect(result.groups).toHaveLength(2);
    });

    it('should extract userSID from first element of SID array when userSID field is missing', async () => {
      // パターン2: userSIDフィールドがなく、SID配列のみ
      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'user02',
          SID: [
            'S-1-5-21-111-222-333-1002',
            'S-1-5-21-111-222-333-512',
            'S-1-5-21-111-222-333-513',
          ],
        },
      });

      const result = await service.getUserSIDInfo('user02');

      expect(result.userSID).toBe('S-1-5-21-111-222-333-1002');
      expect(result.groupSIDs).toHaveLength(2);
      expect(result.groups).toHaveLength(2);
    });

    it('should extract group SIDs from groups field', async () => {
      // パターン3: groupsフィールドからグループSIDを取得
      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'user03',
          userSID: 'S-1-5-21-444-555-666-1003',
          SID: ['S-1-5-21-444-555-666-1003'],
          groups: [
            { name: 'Administrators', sid: 'S-1-5-32-544' },
            { name: 'Users', sid: 'S-1-5-32-545' },
          ],
        },
      });

      const result = await service.getUserSIDInfo('user03');

      expect(result.userSID).toBe('S-1-5-21-444-555-666-1003');
      expect(result.groupSIDs).toHaveLength(2);
      expect(result.groupSIDs).toContain('S-1-5-32-544');
      expect(result.groupSIDs).toContain('S-1-5-32-545');
    });

    it('should merge group SIDs from both SID array and groups field', async () => {
      // パターン4: SID配列とgroupsフィールドの両方からグループSIDを取得
      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'user04',
          userSID: 'S-1-5-21-777-888-999-1004',
          SID: [
            'S-1-5-21-777-888-999-1004',
            'S-1-5-21-777-888-999-512',
          ],
          groups: [
            { name: 'Administrators', sid: 'S-1-5-32-544' },
            { name: 'Domain Admins', sid: 'S-1-5-21-777-888-999-512' }, // 重複
          ],
        },
      });

      const result = await service.getUserSIDInfo('user04');

      expect(result.userSID).toBe('S-1-5-21-777-888-999-1004');
      // 重複を除いて2個のグループSID
      expect(result.groupSIDs).toHaveLength(2);
      expect(result.groupSIDs).toContain('S-1-5-21-777-888-999-512');
      expect(result.groupSIDs).toContain('S-1-5-32-544');
    });

    it('should handle user with only userSID and no groups', async () => {
      // グループに所属していないユーザー
      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'user05',
          userSID: 'S-1-5-21-100-200-300-1005',
          SID: ['S-1-5-21-100-200-300-1005'],
        },
      });

      const result = await service.getUserSIDInfo('user05');

      expect(result.userSID).toBe('S-1-5-21-100-200-300-1005');
      expect(result.groupSIDs).toHaveLength(0);
    });
  });

  describe('Property 2: 存在しないユーザーのエラー処理', () => {
    /**
     * 任意の存在しないユーザーIDに対して、エラーが返されることを検証
     * Validates: Requirements 1.3, 8.1
     */

    it('should throw error when user does not exist', async () => {
      mockSend.mockResolvedValueOnce({
        Item: undefined,
      });

      await expect(service.getUserSIDInfo('nonexistent-user')).rejects.toThrow(
        'User not found: nonexistent-user'
      );
    });

    it('should throw error when userSID cannot be determined', async () => {
      // userSIDフィールドもSID配列も存在しない
      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'user06',
          // userSIDもSIDも存在しない
        },
      });

      await expect(service.getUserSIDInfo('user06')).rejects.toThrow(
        'User SID not found for user: user06'
      );
    });

    it('should throw error when SID array is empty', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'user07',
          SID: [], // 空の配列
        },
      });

      await expect(service.getUserSIDInfo('user07')).rejects.toThrow(
        'User SID not found for user: user07'
      );
    });

    it('should handle DynamoDB errors gracefully', async () => {
      mockSend.mockRejectedValueOnce(new Error('DynamoDB connection error'));

      await expect(service.getUserSIDInfo('user08')).rejects.toThrow(
        'DynamoDB connection error'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle groups field with invalid structure', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'user09',
          userSID: 'S-1-5-21-123-456-789-1009',
          SID: ['S-1-5-21-123-456-789-1009'],
          groups: [
            { name: 'ValidGroup', sid: 'S-1-5-32-544' },
            { name: 'InvalidGroup' }, // sidフィールドがない
            'InvalidFormat', // オブジェクトではない
          ],
        },
      });

      const result = await service.getUserSIDInfo('user09');

      expect(result.userSID).toBe('S-1-5-21-123-456-789-1009');
      expect(result.groupSIDs).toHaveLength(1);
      expect(result.groupSIDs).toContain('S-1-5-32-544');
    });

    it('should handle very long SID arrays', async () => {
      // 100個のグループSIDを持つユーザー
      const groupSIDs = Array.from({ length: 100 }, (_, i) => 
        `S-1-5-21-123-456-789-${2000 + i}`
      );

      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'user10',
          userSID: 'S-1-5-21-123-456-789-1010',
          SID: ['S-1-5-21-123-456-789-1010', ...groupSIDs],
        },
      });

      const result = await service.getUserSIDInfo('user10');

      expect(result.userSID).toBe('S-1-5-21-123-456-789-1010');
      expect(result.groupSIDs).toHaveLength(100);
    });

    it('should handle duplicate SIDs in different fields', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'user11',
          userSID: 'S-1-5-21-123-456-789-1011',
          SID: [
            'S-1-5-21-123-456-789-1011',
            'S-1-5-32-544',
            'S-1-5-32-545',
          ],
          groups: [
            { name: 'Administrators', sid: 'S-1-5-32-544' }, // 重複
            { name: 'Users', sid: 'S-1-5-32-545' }, // 重複
            { name: 'PowerUsers', sid: 'S-1-5-32-547' }, // 新規
          ],
        },
      });

      const result = await service.getUserSIDInfo('user11');

      expect(result.userSID).toBe('S-1-5-21-123-456-789-1011');
      // 重複を除いて3個のグループSID
      expect(result.groupSIDs).toHaveLength(3);
      expect(new Set(result.groupSIDs).size).toBe(3); // 重複がないことを確認
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle typical AD user with domain groups', async () => {
      // 典型的なActive Directoryユーザー
      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'john.doe@example.com',
          userSID: 'S-1-5-21-1234567890-1234567890-1234567890-1001',
          SID: [
            'S-1-5-21-1234567890-1234567890-1234567890-1001', // 個人SID
            'S-1-5-21-1234567890-1234567890-1234567890-512',  // Domain Admins
            'S-1-5-21-1234567890-1234567890-1234567890-513',  // Domain Users
          ],
          groups: [
            { name: 'Domain Admins', sid: 'S-1-5-21-1234567890-1234567890-1234567890-512' },
            { name: 'Domain Users', sid: 'S-1-5-21-1234567890-1234567890-1234567890-513' },
            { name: 'Administrators', sid: 'S-1-5-32-544' },
          ],
        },
      });

      const result = await service.getUserSIDInfo('john.doe@example.com');

      expect(result.userSID).toBe('S-1-5-21-1234567890-1234567890-1234567890-1001');
      expect(result.groupSIDs).toHaveLength(3);
    });
  });
});
