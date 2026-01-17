/**
 * NFS権限計算ロジックのテスト
 * 
 * Phase 9: NFS対応のテストケース
 * 
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */

import {
  parsePosixMode,
  matchesExportPolicyRule,
  getExportPolicyPermissions,
  calculatePosixPermissions,
  calculateNfsPermissions,
} from '../nfs-permission-calculator';
import {
  UserSIDInfo,
  NfsExportPolicyRule,
  PosixPermissions,
} from '../types';

describe('NFS Permission Calculator', () => {
  // テスト用のユーザーSID情報
  const testUserInfo: UserSIDInfo = {
    userId: 'testuser',
    SID: ['S-1-5-21-1234567890-1234567890-1234567890-1001'],
    userSID: 'S-1-5-21-1234567890-1234567890-1234567890-1001',
    source: 'Lambda-AD',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    uid: 1001,
    gid: 1001,
    unixGroups: [
      { name: 'users', gid: 100 },
      { name: 'developers', gid: 1000 },
    ],
  };

  // テスト用のNFSエクスポートポリシールール
  const testExportRule: NfsExportPolicyRule = {
    clients: [{ match: '0.0.0.0/0' }],
    ro_rule: ['sys'],
    rw_rule: ['sys'],
    superuser: ['sys'],
  };

  describe('parsePosixMode', () => {
    it('should parse 0755 mode correctly', () => {
      const result = parsePosixMode(0o755);
      
      expect(result.owner.read).toBe(true);
      expect(result.owner.write).toBe(true);
      expect(result.owner.execute).toBe(true);
      
      expect(result.group.read).toBe(true);
      expect(result.group.write).toBe(false);
      expect(result.group.execute).toBe(true);
      
      expect(result.other.read).toBe(true);
      expect(result.other.write).toBe(false);
      expect(result.other.execute).toBe(true);
      
      expect(result.mode).toBe('0755');
    });

    it('should parse 0644 mode correctly', () => {
      const result = parsePosixMode(0o644);
      
      expect(result.owner.read).toBe(true);
      expect(result.owner.write).toBe(true);
      expect(result.owner.execute).toBe(false);
      
      expect(result.group.read).toBe(true);
      expect(result.group.write).toBe(false);
      expect(result.group.execute).toBe(false);
      
      expect(result.other.read).toBe(true);
      expect(result.other.write).toBe(false);
      expect(result.other.execute).toBe(false);
      
      expect(result.mode).toBe('0644');
    });

    it('should parse 0700 mode correctly', () => {
      const result = parsePosixMode(0o700);
      
      expect(result.owner.read).toBe(true);
      expect(result.owner.write).toBe(true);
      expect(result.owner.execute).toBe(true);
      
      expect(result.group.read).toBe(false);
      expect(result.group.write).toBe(false);
      expect(result.group.execute).toBe(false);
      
      expect(result.other.read).toBe(false);
      expect(result.other.write).toBe(false);
      expect(result.other.execute).toBe(false);
      
      expect(result.mode).toBe('0700');
    });

    it('should parse 0777 mode correctly', () => {
      const result = parsePosixMode(0o777);
      
      expect(result.owner.read).toBe(true);
      expect(result.owner.write).toBe(true);
      expect(result.owner.execute).toBe(true);
      
      expect(result.group.read).toBe(true);
      expect(result.group.write).toBe(true);
      expect(result.group.execute).toBe(true);
      
      expect(result.other.read).toBe(true);
      expect(result.other.write).toBe(true);
      expect(result.other.execute).toBe(true);
      
      expect(result.mode).toBe('0777');
    });
  });

  describe('matchesExportPolicyRule', () => {
    it('should match 0.0.0.0/0 rule', () => {
      const rule: NfsExportPolicyRule = {
        clients: [{ match: '0.0.0.0/0' }],
        ro_rule: ['sys'],
        rw_rule: ['sys'],
        superuser: ['sys'],
      };
      
      expect(matchesExportPolicyRule(rule, '192.168.1.100')).toBe(true);
      expect(matchesExportPolicyRule(rule, '10.0.0.1')).toBe(true);
    });

    it('should match "any" rule', () => {
      const rule: NfsExportPolicyRule = {
        clients: [{ match: 'any' }],
        ro_rule: ['sys'],
        rw_rule: ['sys'],
        superuser: ['sys'],
      };
      
      expect(matchesExportPolicyRule(rule, '192.168.1.100')).toBe(true);
    });

    it('should match exact IP address', () => {
      const rule: NfsExportPolicyRule = {
        clients: [{ match: '192.168.1.100' }],
        ro_rule: ['sys'],
        rw_rule: ['sys'],
        superuser: ['sys'],
      };
      
      expect(matchesExportPolicyRule(rule, '192.168.1.100')).toBe(true);
      expect(matchesExportPolicyRule(rule, '192.168.1.101')).toBe(false);
    });

    it('should match without client IP', () => {
      const rule: NfsExportPolicyRule = {
        clients: [{ match: '192.168.1.100' }],
        ro_rule: ['sys'],
        rw_rule: ['sys'],
        superuser: ['sys'],
      };
      
      // クライアントIPが指定されていない場合、すべてにマッチ
      expect(matchesExportPolicyRule(rule)).toBe(true);
    });
  });

  describe('getExportPolicyPermissions', () => {
    it('should grant read-only permissions', () => {
      const rule: NfsExportPolicyRule = {
        clients: [{ match: '0.0.0.0/0' }],
        ro_rule: ['sys'],
        rw_rule: [],
        superuser: [],
      };
      
      const result = getExportPolicyPermissions(rule, 'sys');
      
      expect(result.read).toBe(true);
      expect(result.write).toBe(false);
      expect(result.admin).toBe(false);
    });

    it('should grant read-write permissions', () => {
      const rule: NfsExportPolicyRule = {
        clients: [{ match: '0.0.0.0/0' }],
        ro_rule: ['sys'],
        rw_rule: ['sys'],
        superuser: [],
      };
      
      const result = getExportPolicyPermissions(rule, 'sys');
      
      expect(result.read).toBe(true);
      expect(result.write).toBe(true);
      expect(result.admin).toBe(false);
    });

    it('should grant superuser permissions', () => {
      const rule: NfsExportPolicyRule = {
        clients: [{ match: '0.0.0.0/0' }],
        ro_rule: ['sys'],
        rw_rule: ['sys'],
        superuser: ['sys'],
      };
      
      const result = getExportPolicyPermissions(rule, 'sys');
      
      expect(result.read).toBe(true);
      expect(result.write).toBe(true);
      expect(result.admin).toBe(true);
    });

    it('should handle "any" auth type', () => {
      const rule: NfsExportPolicyRule = {
        clients: [{ match: '0.0.0.0/0' }],
        ro_rule: ['any'],
        rw_rule: ['any'],
        superuser: ['any'],
      };
      
      const result = getExportPolicyPermissions(rule, 'krb5');
      
      expect(result.read).toBe(true);
      expect(result.write).toBe(true);
      expect(result.admin).toBe(true);
    });
  });

  describe('calculatePosixPermissions', () => {
    const posixPerms: PosixPermissions = {
      owner: { read: true, write: true, execute: true },
      group: { read: true, write: false, execute: true },
      other: { read: true, write: false, execute: false },
      mode: '0754',
    };

    it('should grant owner permissions', () => {
      const result = calculatePosixPermissions(
        testUserInfo,
        posixPerms,
        1001, // 所有者UID = ユーザーUID
        1001
      );
      
      expect(result.read).toBe(true);
      expect(result.write).toBe(true);
      expect(result.admin).toBe(true);
    });

    it('should grant group permissions', () => {
      const result = calculatePosixPermissions(
        testUserInfo,
        posixPerms,
        2001, // 所有者UID ≠ ユーザーUID
        1001  // グループGID = ユーザーGID
      );
      
      expect(result.read).toBe(true);
      expect(result.write).toBe(false);
      expect(result.admin).toBe(false);
    });

    it('should grant group permissions for secondary groups', () => {
      const result = calculatePosixPermissions(
        testUserInfo,
        posixPerms,
        2001, // 所有者UID ≠ ユーザーUID
        1000  // グループGID = ユーザーのセカンダリグループGID
      );
      
      expect(result.read).toBe(true);
      expect(result.write).toBe(false);
      expect(result.admin).toBe(false);
    });

    it('should grant other permissions', () => {
      const result = calculatePosixPermissions(
        testUserInfo,
        posixPerms,
        2001, // 所有者UID ≠ ユーザーUID
        2001  // グループGID ≠ ユーザーGID
      );
      
      expect(result.read).toBe(true);
      expect(result.write).toBe(false);
      expect(result.admin).toBe(false);
    });

    it('should deny access when UID/GID is missing', () => {
      const userWithoutUid: UserSIDInfo = {
        ...testUserInfo,
        uid: undefined,
        gid: undefined,
      };
      
      const result = calculatePosixPermissions(
        userWithoutUid,
        posixPerms,
        1001,
        1001
      );
      
      expect(result.read).toBe(false);
      expect(result.write).toBe(false);
      expect(result.admin).toBe(false);
    });
  });

  describe('calculateNfsPermissions', () => {
    const posixPerms: PosixPermissions = {
      owner: { read: true, write: true, execute: true },
      group: { read: true, write: false, execute: true },
      other: { read: true, write: false, execute: false },
      mode: '0754',
    };

    it('should grant full permissions when both export policy and POSIX allow', () => {
      const result = calculateNfsPermissions(
        testUserInfo,
        testExportRule,
        posixPerms,
        1001, // 所有者UID = ユーザーUID
        1001,
        '192.168.1.100',
        'sys'
      );
      
      expect(result.read).toBe(true);
      expect(result.write).toBe(true);
      expect(result.admin).toBe(true);
    });

    it('should deny write when export policy allows but POSIX denies', () => {
      const result = calculateNfsPermissions(
        testUserInfo,
        testExportRule,
        posixPerms,
        2001, // 所有者UID ≠ ユーザーUID
        1001, // グループGID = ユーザーGID
        '192.168.1.100',
        'sys'
      );
      
      expect(result.read).toBe(true);
      expect(result.write).toBe(false); // グループは書き込み不可
      expect(result.admin).toBe(false);
    });

    it('should deny write when POSIX allows but export policy denies', () => {
      const readOnlyExportRule: NfsExportPolicyRule = {
        clients: [{ match: '0.0.0.0/0' }],
        ro_rule: ['sys'],
        rw_rule: [], // 読み取り専用
        superuser: [],
      };
      
      const result = calculateNfsPermissions(
        testUserInfo,
        readOnlyExportRule,
        posixPerms,
        1001, // 所有者UID = ユーザーUID
        1001,
        '192.168.1.100',
        'sys'
      );
      
      expect(result.read).toBe(true);
      expect(result.write).toBe(false); // エクスポートポリシーが読み取り専用
      expect(result.admin).toBe(false);
    });

    it('should deny all access when export policy does not match client IP', () => {
      const restrictedExportRule: NfsExportPolicyRule = {
        clients: [{ match: '10.0.0.0/8' }],
        ro_rule: ['sys'],
        rw_rule: ['sys'],
        superuser: ['sys'],
      };
      
      const result = calculateNfsPermissions(
        testUserInfo,
        restrictedExportRule,
        posixPerms,
        1001,
        1001,
        '192.168.1.100', // マッチしないIP
        'sys'
      );
      
      expect(result.read).toBe(false);
      expect(result.write).toBe(false);
      expect(result.admin).toBe(false);
    });

    it('should handle missing client IP', () => {
      const result = calculateNfsPermissions(
        testUserInfo,
        testExportRule,
        posixPerms,
        1001,
        1001,
        undefined, // クライアントIP未指定
        'sys'
      );
      
      expect(result.read).toBe(true);
      expect(result.write).toBe(true);
      expect(result.admin).toBe(true);
    });
  });
});
