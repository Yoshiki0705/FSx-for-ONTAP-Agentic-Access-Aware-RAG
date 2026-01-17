/**
 * agent-validation ユーティリティのテストケース
 * 
 * テスト対象:
 * - バリデーション機能
 * - データサニタイズ
 * - 型変換機能
 * - エラーハンドリング
 */

import {
  validateAgentInfo,
  validateAgentId,
  validateAgentAlias,
  safeParseVersion,
  normalizeAgentStatus,
  sanitizeAgentInfo,
  checkAgentInfoCompleteness
} from '../../utils/agent-validation';
import { RawAgentInfo, AgentStatus } from '../../types/bedrock-agent';

describe('agent-validation', () => {
  
  describe('validateAgentInfo', () => {
    it('有効なAgent情報を正しく検証する', () => {
      const agentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 'TestAgent',
        version: '2',
        status: 'PREPARED',
        createdAt: '2024-01-01T00:00:00Z'
      };

      const result = validateAgentInfo(agentInfo);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('null/undefinedの場合はエラーを返す', () => {
      const result1 = validateAgentInfo(null);
      const result2 = validateAgentInfo(undefined);

      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Agent情報が提供されていません');
      
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Agent情報が提供されていません');
    });

    it('agentIdが欠けている場合はエラーを返す', () => {
      const agentInfo = { aliasName: 'TestAgent' };

      const result = validateAgentInfo(agentInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('agentIdは必須フィールドです');
    });

    it('agentIdが文字列でない場合はエラーを返す', () => {
      const agentInfo = { agentId: 123 };

      const result = validateAgentInfo(agentInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('agentIdは文字列である必要があります');
    });

    it('agentIdが空文字列の場合はエラーを返す', () => {
      const agentInfo = { agentId: '' };

      const result = validateAgentInfo(agentInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('agentIdは空文字列にできません');
    });

    it('agentIdが空白のみの場合はエラーを返す', () => {
      const agentInfo = { agentId: '   ' };

      const result = validateAgentInfo(agentInfo);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('agentIdは空文字列にできません');
    });

    it('型が正しくないオプションフィールドで警告を出す', () => {
      const agentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 123,
        aliasId: true,
        version: 'invalid',
        status: 'INVALID_STATUS'
      };

      const result = validateAgentInfo(agentInfo);

      expect(result.isValid).toBe(true); // 警告は成功を妨げない
      expect(result.warnings).toContain('aliasNameは文字列である必要があります');
      expect(result.warnings).toContain('aliasIdは文字列である必要があります');
      expect(result.warnings).toContain('versionは0以上の数値である必要があります');
      expect(result.warnings.some(w => w.includes('無効なステータス'))).toBe(true);
    });

    it('無効な日付フィールドで警告を出す', () => {
      const agentInfo = {
        agentId: 'ABCDEFGHIJ',
        createdAt: 'invalid-date',
        updatedAt: '2024-13-45T25:70:90Z' // 無効な日付
      };

      const result = validateAgentInfo(agentInfo);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('createdAtは有効な日付形式である必要があります');
      expect(result.warnings).toContain('updatedAtは有効な日付形式である必要があります');
    });
  });

  describe('validateAgentId', () => {
    it('有効なAgentIDを正しく検証する', () => {
      const validIds = [
        'ABCDEFGHIJ',
        '1234567890',
        'A1B2C3D4E5'
      ];

      validIds.forEach(id => {
        expect(validateAgentId(id)).toBe(true);
      });
    });

    it('無効なAgentIDを正しく検証する', () => {
      const invalidIds = [
        '',
        'abc', // 短すぎる
        'ABCDEFGHIJK', // 長すぎる
        'abcdefghij', // 小文字
        'ABCDEFGHI-', // ハイフン含む
        'ABCDEFGHI@', // 特殊文字含む
        null,
        undefined,
        123
      ];

      invalidIds.forEach(id => {
        expect(validateAgentId(id as any)).toBe(false);
      });
    });
  });

  describe('validateAgentAlias', () => {
    it('有効なエイリアスを正しく検証する', () => {
      const validAliases = [
        'TestAgent',
        'test-agent',
        'test_agent',
        'Agent123',
        'a',
        'A'.repeat(100) // 最大長
      ];

      validAliases.forEach(alias => {
        expect(validateAgentAlias(alias)).toBe(true);
      });
    });

    it('無効なエイリアスを正しく検証する', () => {
      const invalidAliases = [
        '',
        'A'.repeat(101), // 長すぎる
        'test agent', // スペース含む
        'test@agent', // 特殊文字含む
        'test.agent', // ドット含む
        null,
        undefined,
        123
      ];

      invalidAliases.forEach(alias => {
        expect(validateAgentAlias(alias as any)).toBe(false);
      });
    });
  });

  describe('safeParseVersion', () => {
    it('有効な文字列バージョンを数値に変換する', () => {
      expect(safeParseVersion('1')).toBe(1);
      expect(safeParseVersion('5')).toBe(5);
      expect(safeParseVersion('10')).toBe(10);
      expect(safeParseVersion('2.5')).toBe(2); // 小数点は切り捨て
    });

    it('有効な数値バージョンをそのまま返す', () => {
      expect(safeParseVersion(1)).toBe(1);
      expect(safeParseVersion(5)).toBe(5);
      expect(safeParseVersion(10)).toBe(10);
      expect(safeParseVersion(2.5)).toBe(2); // 小数点は切り捨て
    });

    it('無効な値をデフォルト値(1)に変換する', () => {
      expect(safeParseVersion(undefined)).toBe(1);
      expect(safeParseVersion(null)).toBe(1);
      expect(safeParseVersion('')).toBe(1);
      expect(safeParseVersion('invalid')).toBe(1);
      expect(safeParseVersion(NaN)).toBe(1);
      expect(safeParseVersion(-1)).toBe(1);
      expect(safeParseVersion(-5)).toBe(1);
    });

    it('空白を含む文字列を正しく処理する', () => {
      expect(safeParseVersion('  5  ')).toBe(5);
      expect(safeParseVersion('\t3\n')).toBe(3);
    });
  });

  describe('normalizeAgentStatus', () => {
    it('有効なステータスを正しく正規化する', () => {
      const validStatuses: AgentStatus[] = [
        'CREATING', 'PREPARING', 'PREPARED', 'NOT_PREPARED',
        'DELETING', 'FAILED', 'VERSIONING', 'UPDATING'
      ];

      validStatuses.forEach(status => {
        expect(normalizeAgentStatus(status)).toBe(status);
      });
    });

    it('小文字ステータスを大文字に変換する', () => {
      expect(normalizeAgentStatus('prepared')).toBe('PREPARED');
      expect(normalizeAgentStatus('creating')).toBe('CREATING');
      expect(normalizeAgentStatus('failed')).toBe('FAILED');
    });

    it('無効なステータスをUNKNOWNに変換する', () => {
      expect(normalizeAgentStatus('INVALID')).toBe('UNKNOWN');
      expect(normalizeAgentStatus('random')).toBe('UNKNOWN');
      expect(normalizeAgentStatus('')).toBe('UNKNOWN');
      expect(normalizeAgentStatus(undefined)).toBe('UNKNOWN');
      expect(normalizeAgentStatus(null as any)).toBe('UNKNOWN');
    });
  });

  describe('sanitizeAgentInfo', () => {
    it('文字列フィールドをトリムする', () => {
      const agentInfo: RawAgentInfo = {
        agentId: '  ABCDEFGHIJ  ',
        aliasName: '\tTestAgent\n',
        aliasId: '  ALIAS123  ',
        description: '  テスト説明  ',
        foundationModel: '  claude-v2  ',
        instruction: '  テスト指示  ',
        status: '  PREPARED  ',
        createdAt: '  2024-01-01T00:00:00Z  ',
        updatedAt: '  2024-01-02T00:00:00Z  '
      };

      const sanitized = sanitizeAgentInfo(agentInfo);

      expect(sanitized.agentId).toBe('ABCDEFGHIJ');
      expect(sanitized.aliasName).toBe('TestAgent');
      expect(sanitized.aliasId).toBe('ALIAS123');
      expect(sanitized.description).toBe('テスト説明');
      expect(sanitized.foundationModel).toBe('claude-v2');
      expect(sanitized.instruction).toBe('テスト指示');
      expect(sanitized.status).toBe('PREPARED');
      expect(sanitized.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(sanitized.updatedAt).toBe('2024-01-02T00:00:00Z');
    });

    it('数値フィールドをそのまま保持する', () => {
      const agentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        version: 5
      };

      const sanitized = sanitizeAgentInfo(agentInfo);

      expect(sanitized.version).toBe(5);
    });

    it('undefinedフィールドを適切に処理する', () => {
      const agentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ'
      };

      const sanitized = sanitizeAgentInfo(agentInfo);

      expect(sanitized.aliasName).toBeUndefined();
      expect(sanitized.description).toBeUndefined();
      expect(sanitized.version).toBeUndefined();
    });

    it('空のオブジェクトを適切に処理する', () => {
      const agentInfo: RawAgentInfo = {};

      const sanitized = sanitizeAgentInfo(agentInfo);

      expect(Object.keys(sanitized)).toEqual([]);
    });
  });

  describe('checkAgentInfoCompleteness', () => {
    it('完全なAgent情報の完全性をチェックする', () => {
      const agentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 'TestAgent',
        aliasId: 'ALIAS123',
        version: '2',
        status: 'PREPARED',
        description: 'テスト説明'
      };

      const result = checkAgentInfoCompleteness(agentInfo);

      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toEqual([]);
      expect(result.optionalFields).toEqual([
        'aliasName', 'aliasId', 'version', 'status', 'description'
      ]);
    });

    it('最小限のAgent情報の完全性をチェックする', () => {
      const agentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ'
      };

      const result = checkAgentInfoCompleteness(agentInfo);

      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toEqual([]);
      expect(result.optionalFields).toEqual([]);
    });

    it('不完全なAgent情報の完全性をチェックする', () => {
      const agentInfo: RawAgentInfo = {
        aliasName: 'TestAgent'
      };

      const result = checkAgentInfoCompleteness(agentInfo);

      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toEqual(['agentId']);
      expect(result.optionalFields).toEqual(['aliasName']);
    });

    it('空のオブジェクトの完全性をチェックする', () => {
      const agentInfo: RawAgentInfo = {};

      const result = checkAgentInfoCompleteness(agentInfo);

      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toEqual(['agentId']);
      expect(result.optionalFields).toEqual([]);
    });
  });

  describe('エッジケース', () => {
    it('非常に長い文字列を適切に処理する', () => {
      const longString = 'a'.repeat(10000);
      const agentInfo: RawAgentInfo = {
        agentId: longString,
        aliasName: longString,
        description: longString
      };

      const sanitized = sanitizeAgentInfo(agentInfo);
      const validation = validateAgentInfo(sanitized);

      expect(sanitized.agentId).toBe(longString);
      expect(sanitized.aliasName).toBe(longString);
      expect(sanitized.description).toBe(longString);
      expect(validation.isValid).toBe(true);
    });

    it('特殊文字を含む文字列を適切に処理する', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const agentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: specialChars,
        description: specialChars
      };

      const sanitized = sanitizeAgentInfo(agentInfo);
      const validation = validateAgentInfo(sanitized);

      expect(sanitized.aliasName).toBe(specialChars);
      expect(sanitized.description).toBe(specialChars);
      expect(validation.isValid).toBe(true);
    });

    it('Unicode文字を含む文字列を適切に処理する', () => {
      const unicodeString = 'テスト🚀エージェント';
      const agentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: unicodeString,
        description: unicodeString
      };

      const sanitized = sanitizeAgentInfo(agentInfo);
      const validation = validateAgentInfo(sanitized);

      expect(sanitized.aliasName).toBe(unicodeString);
      expect(sanitized.description).toBe(unicodeString);
      expect(validation.isValid).toBe(true);
    });
  });
});