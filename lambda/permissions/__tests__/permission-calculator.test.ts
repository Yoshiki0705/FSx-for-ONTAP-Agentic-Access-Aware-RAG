/**
 * 権限計算ロジック プロパティテスト
 * 
 * Property 5-10: 権限計算の正確性
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import {
  calculateEffectivePermissions,
  buildDirectoryPermission,
  calculateMultipleDirectoryPermissions,
  generatePermissionSummary,
} from '../permission-calculator';
import { OntapAclRecord, CalculatedPermissions } from '../types';

describe('Permission Calculator - Property Tests', () => {
  describe('Property 5: 権限レベルの優先順位', () => {
    /**
     * 複数の権限がマッチする場合、最も強い権限（full_control > change > read）を採用する
     * Validates: Requirements 3.2
     */

    it('should prioritize full_control over change and read', () => {
      const userSIDs = ['S-1-5-21-123-456-789-1001'];
      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'read', type: 'allow' },
        { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'change', type: 'allow' },
        { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'full_control', type: 'allow' },
      ];

      const result = calculateEffectivePermissions(userSIDs, aclRecords);

      expect(result.read).toBe(true);
      expect(result.write).toBe(true);
      expect(result.admin).toBe(true);
    });

    it('should prioritize change over read', () => {
      const userSIDs = ['S-1-5-21-123-456-789-1001'];
      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'read', type: 'allow' },
        { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'change', type: 'allow' },
      ];

      const result = calculateEffectivePermissions(userSIDs, aclRecords);

      expect(result.read).toBe(true);
      expect(result.write).toBe(true);
      expect(result.admin).toBe(false);
    });

    it('should handle multiple SIDs with different permissions', () => {
      const userSIDs = [
        'S-1-5-21-123-456-789-1001', // 個人SID
        'S-1-5-21-123-456-789-512',  // グループSID (Administrators)
      ];
      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'read', type: 'allow' },
        { user_or_group: 'S-1-5-21-123-456-789-512', permission: 'full_control', type: 'allow' },
      ];

      const result = calculateEffectivePermissions(userSIDs, aclRecords);

      // グループの full_control が優先される
      expect(result.read).toBe(true);
      expect(result.write).toBe(true);
      expect(result.admin).toBe(true);
    });
  });

  describe('Property 6: full_control権限のマッピング', () => {
    /**
     * full_control権限を持つACLエントリは、read、write、adminすべてをtrueにマッピングする
     * Validates: Requirements 3.3
     */

    it('should map full_control to all permissions true', () => {
      const userSIDs = ['S-1-5-21-123-456-789-512'];
      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-512', permission: 'full_control', type: 'allow' },
      ];

      const result = calculateEffectivePermissions(userSIDs, aclRecords);

      expect(result).toEqual({
        read: true,
        write: true,
        admin: true,
      });
    });

    it('should consistently map full_control across different SIDs', () => {
      const testSIDs = [
        'S-1-5-21-111-222-333-512',
        'S-1-5-21-444-555-666-1001',
        'S-1-5-32-544', // Well-known SID
      ];

      testSIDs.forEach(sid => {
        const aclRecords: OntapAclRecord[] = [
          { user_or_group: sid, permission: 'full_control', type: 'allow' },
        ];

        const result = calculateEffectivePermissions([sid], aclRecords);

        expect(result.read).toBe(true);
        expect(result.write).toBe(true);
        expect(result.admin).toBe(true);
      });
    });
  });

  describe('Property 7: change権限のマッピング', () => {
    /**
     * change権限を持つACLエントリは、readとwriteをtrueにマッピングする
     * Validates: Requirements 3.4
     */

    it('should map change to read and write true, admin false', () => {
      const userSIDs = ['S-1-5-21-123-456-789-1001'];
      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'change', type: 'allow' },
      ];

      const result = calculateEffectivePermissions(userSIDs, aclRecords);

      expect(result).toEqual({
        read: true,
        write: true,
        admin: false,
      });
    });
  });

  describe('Property 8: read権限のマッピング', () => {
    /**
     * read権限のみを持つACLエントリは、readのみをtrueにマッピングする
     * Validates: Requirements 3.5
     */

    it('should map read to read only true', () => {
      const userSIDs = ['S-1-5-21-123-456-789-1002'];
      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-1002', permission: 'read', type: 'allow' },
      ];

      const result = calculateEffectivePermissions(userSIDs, aclRecords);

      expect(result).toEqual({
        read: true,
        write: false,
        admin: false,
      });
    });
  });

  describe('Property 9: 権限マッチなし時のデフォルト', () => {
    /**
     * どのSIDもマッチしない場合、すべての権限をfalseとする
     * Validates: Requirements 3.6
     */

    it('should return all false when no SID matches', () => {
      const userSIDs = ['S-1-5-21-123-456-789-9999'];
      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'full_control', type: 'allow' },
        { user_or_group: 'S-1-5-21-123-456-789-1002', permission: 'change', type: 'allow' },
      ];

      const result = calculateEffectivePermissions(userSIDs, aclRecords);

      expect(result).toEqual({
        read: false,
        write: false,
        admin: false,
      });
    });

    it('should return all false when ACL records are empty', () => {
      const userSIDs = ['S-1-5-21-123-456-789-1001'];
      const aclRecords: OntapAclRecord[] = [];

      const result = calculateEffectivePermissions(userSIDs, aclRecords);

      expect(result).toEqual({
        read: false,
        write: false,
        admin: false,
      });
    });

    it('should return all false when user SIDs are empty', () => {
      const userSIDs: string[] = [];
      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'full_control', type: 'allow' },
      ];

      const result = calculateEffectivePermissions(userSIDs, aclRecords);

      expect(result).toEqual({
        read: false,
        write: false,
        admin: false,
      });
    });
  });

  describe('Property 10: DirectoryPermission形式の一貫性', () => {
    /**
     * 結果がpath、permissions、owner、groupフィールドを含むDirectoryPermission形式であることを検証
     * Validates: Requirements 3.7
     */

    it('should build DirectoryPermission with all required fields', () => {
      const calculatedPermissions: CalculatedPermissions = {
        read: true,
        write: true,
        admin: false,
      };

      const result = buildDirectoryPermission(
        '/shared/documents',
        calculatedPermissions,
        'S-1-5-21-123-456-789-500',
        'S-1-5-21-123-456-789-512'
      );

      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('permissions');
      expect(result).toHaveProperty('owner');
      expect(result).toHaveProperty('group');

      expect(result.path).toBe('/shared/documents');
      expect(result.permissions).toEqual(['read', 'write']);
      expect(result.owner).toBe('S-1-5-21-123-456-789-500');
      expect(result.group).toBe('S-1-5-21-123-456-789-512');
    });

    it('should handle read-only permissions', () => {
      const calculatedPermissions: CalculatedPermissions = {
        read: true,
        write: false,
        admin: false,
      };

      const result = buildDirectoryPermission('/shared/readonly', calculatedPermissions);

      expect(result.permissions).toEqual(['read']);
    });

    it('should handle no permissions', () => {
      const calculatedPermissions: CalculatedPermissions = {
        read: false,
        write: false,
        admin: false,
      };

      const result = buildDirectoryPermission('/shared/noaccess', calculatedPermissions);

      expect(result.permissions).toEqual([]);
    });

    it('should use default values for owner and group when not provided', () => {
      const calculatedPermissions: CalculatedPermissions = {
        read: true,
        write: false,
        admin: false,
      };

      const result = buildDirectoryPermission('/shared/test', calculatedPermissions);

      expect(result.owner).toBe('unknown');
      expect(result.group).toBe('unknown');
    });
  });

  describe('Multiple Directory Permissions', () => {
    it('should calculate permissions for multiple directories', () => {
      const userSIDs = ['S-1-5-21-123-456-789-1001', 'S-1-5-21-123-456-789-512'];
      
      const pathAclMap = new Map<string, OntapAclRecord[]>([
        ['/shared/documents', [
          { user_or_group: 'S-1-5-21-123-456-789-512', permission: 'full_control', type: 'allow' },
        ]],
        ['/shared/readonly', [
          { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'read', type: 'allow' },
        ]],
        ['/shared/noaccess', [
          { user_or_group: 'S-1-5-21-999-999-999-9999', permission: 'full_control', type: 'allow' },
        ]],
      ]);

      const results = calculateMultipleDirectoryPermissions(userSIDs, pathAclMap);

      expect(results).toHaveLength(3);

      // /shared/documents - full_control
      const documentsPermission = results.find(r => r.path === '/shared/documents');
      expect(documentsPermission?.permissions).toEqual(['read', 'write']);

      // /shared/readonly - read only
      const readonlyPermission = results.find(r => r.path === '/shared/readonly');
      expect(readonlyPermission?.permissions).toEqual(['read']);

      // /shared/noaccess - no access
      const noaccessPermission = results.find(r => r.path === '/shared/noaccess');
      expect(noaccessPermission?.permissions).toEqual([]);
    });
  });

  describe('Permission Summary Generation', () => {
    it('should generate summary for full permissions', () => {
      const userSIDs = ['S-1-5-21-123-456-789-512'];
      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-512', permission: 'full_control', type: 'allow' },
      ];
      const result: CalculatedPermissions = {
        read: true,
        write: true,
        admin: true,
      };

      const summary = generatePermissionSummary(userSIDs, aclRecords, result);

      expect(summary).toContain('読取');
      expect(summary).toContain('書込');
      expect(summary).toContain('管理');
      expect(summary).toContain('1/1');
    });

    it('should generate summary for no permissions', () => {
      const userSIDs = ['S-1-5-21-123-456-789-9999'];
      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'full_control', type: 'allow' },
      ];
      const result: CalculatedPermissions = {
        read: false,
        write: false,
        admin: false,
      };

      const summary = generatePermissionSummary(userSIDs, aclRecords, result);

      expect(summary).toContain('権限なし');
      expect(summary).toContain('0/1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle no_access permission', () => {
      const userSIDs = ['S-1-5-21-123-456-789-1001'];
      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'no_access', type: 'deny' },
      ];

      const result = calculateEffectivePermissions(userSIDs, aclRecords);

      expect(result).toEqual({
        read: false,
        write: false,
        admin: false,
      });
    });

    it('should handle very long SID lists', () => {
      // 100個のSIDを生成
      const userSIDs = Array.from({ length: 100 }, (_, i) => 
        `S-1-5-21-123-456-789-${1000 + i}`
      );

      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-1050', permission: 'full_control', type: 'allow' },
      ];

      const result = calculateEffectivePermissions(userSIDs, aclRecords);

      expect(result.read).toBe(true);
      expect(result.write).toBe(true);
      expect(result.admin).toBe(true);
    });

    it('should handle duplicate SIDs in user list', () => {
      const userSIDs = [
        'S-1-5-21-123-456-789-1001',
        'S-1-5-21-123-456-789-1001', // 重複
        'S-1-5-21-123-456-789-512',
      ];

      const aclRecords: OntapAclRecord[] = [
        { user_or_group: 'S-1-5-21-123-456-789-1001', permission: 'read', type: 'allow' },
      ];

      const result = calculateEffectivePermissions(userSIDs, aclRecords);

      expect(result.read).toBe(true);
      expect(result.write).toBe(false);
      expect(result.admin).toBe(false);
    });
  });
});
