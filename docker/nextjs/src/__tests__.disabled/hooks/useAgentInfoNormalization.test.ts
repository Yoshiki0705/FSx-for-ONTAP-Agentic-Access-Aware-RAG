/**
 * useAgentInfoNormalization フックのテストケース
 * 
 * テスト対象:
 * - データ変換ロジック
 * - バリデーション機能
 * - エラーハンドリング
 * - パフォーマンス
 */

import { renderHook } from '@testing-library/react';
import { useAgentInfoNormalization } from '../../hooks/useAgentInfoNormalization';
import { RawAgentInfo, AgentStatus } from '../../types/bedrock-agent';

// モック設定
jest.mock('../../utils/agent-logger', () => ({
  agentLogger: {
    setComponent: jest.fn(),
    logAgentNormalization: jest.fn(),
    logValidationError: jest.fn(),
    logValidationWarning: jest.fn(),
    logPerformance: jest.fn()
  }
}));

describe('useAgentInfoNormalization', () => {
  
  describe('正常ケース', () => {
    it('完全なAgent情報を正しく正規化する', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 'TestAgent',
        aliasId: 'KLMNOPQRST',
        version: '2',
        status: 'PREPARED',
        description: 'テスト用Agent',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        foundationModel: 'anthropic.claude-v2',
        instruction: 'テスト指示'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.isValid).toBe(true);
      expect(result.current.normalizedAgentInfo).toEqual({
        agentId: 'ABCDEFGHIJ',
        alias: 'TestAgent',
        version: 2,
        status: 'PREPARED',
        description: 'テスト用Agent',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
        foundationModel: 'anthropic.claude-v2',
        instruction: 'テスト指示',
        isActive: true,
        lastUsed: new Date('2024-01-02T00:00:00Z')
      });
      expect(result.current.errorMessage).toBeNull();
      expect(result.current.warningMessages).toEqual([]);
    });

    it('最小限のAgent情報を正しく正規化する', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.isValid).toBe(true);
      expect(result.current.normalizedAgentInfo).toEqual({
        agentId: 'ABCDEFGHIJ',
        alias: 'N/A',
        version: 1,
        status: 'UNKNOWN',
        description: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        foundationModel: undefined,
        instruction: undefined,
        isActive: false,
        lastUsed: undefined
      });
    });

    it('aliasNameが優先されることを確認', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 'PrimaryAlias',
        aliasId: 'SecondaryAlias'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo?.alias).toBe('PrimaryAlias');
    });

    it('aliasIdがフォールバックとして使用されることを確認', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasId: 'FallbackAlias'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo?.alias).toBe('FallbackAlias');
    });
  });

  describe('バージョン処理', () => {
    it('文字列バージョンを数値に変換する', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        version: '5'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo?.version).toBe(5);
    });

    it('数値バージョンをそのまま使用する', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        version: 3
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo?.version).toBe(3);
    });

    it('無効なバージョンをデフォルト値に変換する', () => {
      const testCases = [
        { version: 'invalid', expected: 1 },
        { version: '', expected: 1 },
        { version: -1, expected: 1 },
        { version: NaN, expected: 1 },
        { version: undefined, expected: 1 }
      ];

      testCases.forEach(({ version, expected }) => {
        const rawAgentInfo: RawAgentInfo = {
          agentId: 'ABCDEFGHIJ',
          version
        };

        const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

        expect(result.current.normalizedAgentInfo?.version).toBe(expected);
      });
    });

    it('小数点バージョンを整数に変換する', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        version: '2.5'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo?.version).toBe(2);
    });
  });

  describe('ステータス処理', () => {
    it('有効なステータスを正規化する', () => {
      const validStatuses: AgentStatus[] = [
        'CREATING', 'PREPARING', 'PREPARED', 'NOT_PREPARED',
        'DELETING', 'FAILED', 'VERSIONING', 'UPDATING'
      ];

      validStatuses.forEach(status => {
        const rawAgentInfo: RawAgentInfo = {
          agentId: 'ABCDEFGHIJ',
          status
        };

        const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

        expect(result.current.normalizedAgentInfo?.status).toBe(status);
      });
    });

    it('無効なステータスをUNKNOWNに変換する', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        status: 'INVALID_STATUS'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo?.status).toBe('UNKNOWN');
    });

    it('小文字ステータスを大文字に正規化する', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        status: 'prepared'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo?.status).toBe('PREPARED');
    });
  });

  describe('アクティブ状態判定', () => {
    it('PREPAREDステータスをアクティブと判定する', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        status: 'PREPARED'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo?.isActive).toBe(true);
    });

    it('PREPARED以外のステータスを非アクティブと判定する', () => {
      const inactiveStatuses: AgentStatus[] = [
        'CREATING', 'PREPARING', 'NOT_PREPARED', 'DELETING', 
        'FAILED', 'VERSIONING', 'UPDATING', 'UNKNOWN'
      ];

      inactiveStatuses.forEach(status => {
        const rawAgentInfo: RawAgentInfo = {
          agentId: 'ABCDEFGHIJ',
          status
        };

        const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

        expect(result.current.normalizedAgentInfo?.isActive).toBe(false);
      });
    });
  });

  describe('日付処理', () => {
    it('有効な日付文字列をDateオブジェクトに変換する', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T12:30:45Z'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo?.createdAt).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(result.current.normalizedAgentInfo?.updatedAt).toEqual(new Date('2024-01-02T12:30:45Z'));
      expect(result.current.normalizedAgentInfo?.lastUsed).toEqual(new Date('2024-01-02T12:30:45Z'));
    });

    it('無効な日付文字列をundefinedに変換する', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        createdAt: 'invalid-date',
        updatedAt: ''
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo?.createdAt).toBeUndefined();
      expect(result.current.normalizedAgentInfo?.updatedAt).toBeUndefined();
      expect(result.current.normalizedAgentInfo?.lastUsed).toBeUndefined();
    });
  });

  describe('エラーケース', () => {
    it('nullの場合は適切に処理する', () => {
      const { result } = renderHook(() => useAgentInfoNormalization(null));

      expect(result.current.normalizedAgentInfo).toBeNull();
      expect(result.current.isValid).toBe(false);
      expect(result.current.errorMessage).toBeNull();
      expect(result.current.validationResult).toBeNull();
    });

    it('undefinedの場合は適切に処理する', () => {
      const { result } = renderHook(() => useAgentInfoNormalization(undefined));

      expect(result.current.normalizedAgentInfo).toBeNull();
      expect(result.current.isValid).toBe(false);
      expect(result.current.errorMessage).toBeNull();
      expect(result.current.validationResult).toBeNull();
    });

    it('agentIdが欠けている場合はエラーを返す', () => {
      const rawAgentInfo: RawAgentInfo = {
        aliasName: 'TestAgent'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo).toBeNull();
      expect(result.current.isValid).toBe(false);
      expect(result.current.errorMessage).toContain('agentIdは必須フィールドです');
    });

    it('空のagentIdの場合はエラーを返す', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: ''
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo).toBeNull();
      expect(result.current.isValid).toBe(false);
      expect(result.current.errorMessage).toContain('agentIdは空文字列にできません');
    });
  });

  describe('警告ケース', () => {
    it('型が正しくないフィールドで警告を出す', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 123 as any, // 意図的に間違った型
        version: 'invalid-version'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.isValid).toBe(true); // 警告は成功を妨げない
      expect(result.current.warningMessages.length).toBeGreaterThan(0);
    });
  });

  describe('パフォーマンス', () => {
    it('処理時間を測定する', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 'TestAgent'
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.processingTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.current.processingTime).toBe('number');
    });

    it('同じ入力に対してメモ化が機能する', () => {
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 'TestAgent'
      };

      const { result, rerender } = renderHook(
        ({ agentInfo }) => useAgentInfoNormalization(agentInfo),
        { initialProps: { agentInfo: rawAgentInfo } }
      );

      const firstResult = result.current.normalizedAgentInfo;

      // 同じデータで再レンダリング
      rerender({ agentInfo: rawAgentInfo });

      // 参照が同じであることを確認（メモ化が機能している）
      expect(result.current.normalizedAgentInfo).toBe(firstResult);
    });

    it('異なる入力に対して新しい結果を返す', () => {
      const rawAgentInfo1: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: 'TestAgent1'
      };

      const rawAgentInfo2: RawAgentInfo = {
        agentId: 'KLMNOPQRST',
        aliasName: 'TestAgent2'
      };

      const { result, rerender } = renderHook(
        ({ agentInfo }) => useAgentInfoNormalization(agentInfo),
        { initialProps: { agentInfo: rawAgentInfo1 } }
      );

      const firstResult = result.current.normalizedAgentInfo;

      // 異なるデータで再レンダリング
      rerender({ agentInfo: rawAgentInfo2 });

      // 参照が異なることを確認（新しい結果が生成されている）
      expect(result.current.normalizedAgentInfo).not.toBe(firstResult);
      expect(result.current.normalizedAgentInfo?.agentId).toBe('KLMNOPQRST');
      expect(result.current.normalizedAgentInfo?.alias).toBe('TestAgent2');
    });
  });

  describe('エッジケース', () => {
    it('空オブジェクトを適切に処理する', () => {
      const rawAgentInfo: RawAgentInfo = {};

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.normalizedAgentInfo).toBeNull();
      expect(result.current.isValid).toBe(false);
    });

    it('非常に長い文字列を適切に処理する', () => {
      const longString = 'a'.repeat(10000);
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: longString,
        description: longString
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.isValid).toBe(true);
      expect(result.current.normalizedAgentInfo?.alias).toBe(longString);
      expect(result.current.normalizedAgentInfo?.description).toBe(longString);
    });

    it('特殊文字を含む文字列を適切に処理する', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const rawAgentInfo: RawAgentInfo = {
        agentId: 'ABCDEFGHIJ',
        aliasName: specialChars,
        description: specialChars
      };

      const { result } = renderHook(() => useAgentInfoNormalization(rawAgentInfo));

      expect(result.current.isValid).toBe(true);
      expect(result.current.normalizedAgentInfo?.alias).toBe(specialChars);
      expect(result.current.normalizedAgentInfo?.description).toBe(specialChars);
    });
  });
});