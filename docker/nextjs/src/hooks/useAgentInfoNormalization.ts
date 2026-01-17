/**
 * Agent情報正規化カスタムフック - Permission-aware RAG System
 * 
 * 機能:
 * - Agent情報のデータ変換ロジック分離
 * - パフォーマンス最適化（useMemo使用）
 * - 型安全性の確保
 * - エラーハンドリング強化
 * - ログ出力の標準化
 * 
 * @version 1.0.0
 * @author Permission-aware RAG Team
 */

import { useMemo } from 'react';
import { 
  RawAgentInfo, 
  NormalizedAgentInfo, 
  AgentId, 
  AgentVersion, 
  AgentStatus,
  AgentValidationResult
} from '@/types/bedrock-agent';
import { 
  validateAgentInfo, 
  safeParseVersion, 
  normalizeAgentStatus, 
  sanitizeAgentInfo 
} from '@/utils/agent-validation';
import { agentLogger } from '@/utils/agent-logger';

/**
 * Agent情報正規化フックの戻り値
 */
export interface UseAgentInfoNormalizationResult {
  /** 正規化されたAgent情報 */
  normalizedAgentInfo: NormalizedAgentInfo | null;
  /** バリデーション結果 */
  validationResult: AgentValidationResult | null;
  /** 正規化処理が成功したかどうか */
  isValid: boolean;
  /** エラーメッセージ（存在する場合） */
  errorMessage: string | null;
  /** 警告メッセージ（存在する場合） */
  warningMessages: string[];
  /** 処理時間（デバッグ用） */
  processingTime: number;
}

/**
 * Agent情報正規化カスタムフック
 * 
 * @param rawAgentInfo - 生のAgent情報
 * @returns 正規化されたAgent情報とバリデーション結果
 */
export function useAgentInfoNormalization(
  rawAgentInfo: RawAgentInfo | null | undefined
): UseAgentInfoNormalizationResult {
  
  return useMemo(() => {
    const startTime = performance.now();
    
    // ログ出力用のコンポーネント設定
    agentLogger.setComponent('useAgentInfoNormalization');
    
    // null/undefined チェック
    if (!rawAgentInfo) {
      agentLogger.logAgentNormalization(null, null);
      return {
        normalizedAgentInfo: null,
        validationResult: null,
        isValid: false,
        errorMessage: null,
        warningMessages: [],
        processingTime: 0
      };
    }

    try {
      // 1. 入力データのサニタイズ
      const sanitizedInfo = sanitizeAgentInfo(rawAgentInfo);
      
      // 2. バリデーション実行
      const validationResult = validateAgentInfo(sanitizedInfo);
      
      // 3. バリデーションエラーのログ出力
      if (!validationResult.isValid) {
        agentLogger.logValidationError(sanitizedInfo, validationResult);
        const endTime = performance.now();
        return {
          normalizedAgentInfo: null,
          validationResult,
          isValid: false,
          errorMessage: validationResult.errors.length > 0 
            ? (typeof validationResult.errors[0] === 'string' 
                ? validationResult.errors[0] 
                : validationResult.errors[0].message)
            : 'バリデーションエラーが発生しました',
          warningMessages: validationResult.warnings.map(w => w.message),
          processingTime: endTime - startTime
        };
      }

      // 4. バリデーション警告のログ出力
      if (validationResult.warnings.length > 0) {
        agentLogger.logValidationWarning(sanitizedInfo, validationResult);
      }

      // 5. データ正規化処理
      const normalizedInfo: NormalizedAgentInfo = {
        agentId: sanitizedInfo.agentId as AgentId,
        alias: determineAlias(sanitizedInfo),
        version: safeParseVersion(sanitizedInfo.version) as AgentVersion,
        status: normalizeAgentStatus(sanitizedInfo.status),
        description: sanitizedInfo.description,
        createdAt: parseDate(sanitizedInfo.createdAt),
        updatedAt: parseDate(sanitizedInfo.updatedAt),
        foundationModel: sanitizedInfo.foundationModel,
        instruction: sanitizedInfo.instruction,
        isActive: isAgentCurrentlyActive(sanitizedInfo),
        lastUsed: calculateLastUsed(sanitizedInfo)
      };

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // 6. 成功ログの出力
      agentLogger.logAgentNormalization(sanitizedInfo, normalizedInfo, validationResult);
      agentLogger.logPerformance('AgentInfoNormalization', processingTime, sanitizedInfo.agentId);

      return {
        normalizedAgentInfo: normalizedInfo,
        validationResult,
        isValid: true,
        errorMessage: null,
        warningMessages: validationResult.warnings.map(w => w.message),
        processingTime
      };

    } catch (error) {
      const endTime = performance.now();
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      
      agentLogger.logValidationError(rawAgentInfo, {
        isValid: false,
        errors: [{
          field: 'general',
          code: 'PROCESSING_ERROR' as any,
          message: errorMessage,
          severity: 'error' as const
        }],
        warnings: [],
        securityChecks: []
      });

      return {
        normalizedAgentInfo: null,
        validationResult: null,
        isValid: false,
        errorMessage,
        warningMessages: [],
        processingTime: endTime - startTime
      };
    }
  }, [rawAgentInfo]);
}

/**
 * Agent エイリアスの決定ロジック
 * 優先順位: aliasName > aliasId > 'N/A'
 */
function determineAlias(agentInfo: RawAgentInfo): string {
  if (agentInfo.aliasName && agentInfo.aliasName.trim().length > 0) {
    return agentInfo.aliasName.trim();
  }
  
  if (agentInfo.aliasId && agentInfo.aliasId.trim().length > 0) {
    return agentInfo.aliasId.trim();
  }
  
  return 'N/A';
}

/**
 * 日付文字列の安全な変換
 */
function parseDate(dateString: string | undefined): Date | undefined {
  if (!dateString || typeof dateString !== 'string') {
    return undefined;
  }

  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
}

/**
 * Agent がアクティブかどうかの判定
 */
function isAgentCurrentlyActive(agentInfo: RawAgentInfo): boolean {
  const status = normalizeAgentStatus(agentInfo.status);
  
  // PREPARED ステータスのみをアクティブとみなす
  return status === 'PREPARED';
}

/**
 * 最終使用日時の計算（現在は updatedAt を使用）
 */
function calculateLastUsed(agentInfo: RawAgentInfo): Date | undefined {
  // 将来的には実際の使用ログから取得する予定
  return parseDate(agentInfo.updatedAt);
}

/**
 * Agent情報の簡易正規化（レガシー互換性用）
 * 
 * @deprecated useAgentInfoNormalization フックを使用してください
 */
export function normalizeAgentInfoLegacy(rawAgentInfo: RawAgentInfo | null) {
  if (!rawAgentInfo) return null;

  return {
    agentId: rawAgentInfo.agentId,
    alias: rawAgentInfo.aliasName || rawAgentInfo.aliasId || 'N/A',
    version: safeParseVersion(rawAgentInfo.version),
    status: normalizeAgentStatus(rawAgentInfo.status)
  };
}

/**
 * Agent情報の表示用フォーマット
 */
export function formatAgentInfoForDisplay(normalizedInfo: NormalizedAgentInfo | null): {
  displayName: string;
  statusText: string;
  versionText: string;
  lastActiveText: string;
} {
  if (!normalizedInfo) {
    return {
      displayName: 'Agent情報なし',
      statusText: '不明',
      versionText: 'v1',
      lastActiveText: '未使用'
    };
  }

  return {
    displayName: `${normalizedInfo.alias} (${normalizedInfo.agentId})`,
    statusText: getStatusDisplayText(normalizedInfo.status),
    versionText: `v${normalizedInfo.version}`,
    lastActiveText: normalizedInfo.lastUsed 
      ? formatRelativeTime(normalizedInfo.lastUsed)
      : '未使用'
  };
}

/**
 * ステータスの表示テキスト取得
 */
function getStatusDisplayText(status: AgentStatus): string {
  const statusMap: Record<AgentStatus, string> = {
    'CREATING': '作成中',
    'PREPARING': '準備中',
    'PREPARED': '準備完了',
    'NOT_PREPARED': '未準備',
    'DELETING': '削除中',
    'FAILED': '失敗',
    'VERSIONING': 'バージョン作成中',
    'UPDATING': '更新中',
    'UNKNOWN': '不明'
  };

  return statusMap[status] || '不明';
}

/**
 * 相対時間のフォーマット
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'たった今';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分前`;
  } else if (diffHours < 24) {
    return `${diffHours}時間前`;
  } else if (diffDays < 7) {
    return `${diffDays}日前`;
  } else {
    return date.toLocaleDateString('ja-JP');
  }
}