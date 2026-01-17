/**
 * Agent バリデーション機能 - Permission-aware RAG System
 * 
 * 機能:
 * - Agent情報の入力値検証
 * - 型安全性の確保
 * - エラーメッセージの標準化
 */

import { 
  RawAgentInfo, 
  AgentValidationResult, 
  AgentStatus,
  ValidationError,
  ValidationWarning,
  ValidationErrorCode,
  ValidationWarningCode
} from '@/types/bedrock-agent';

// 有効なAgentステータス一覧
const VALID_AGENT_STATUSES: AgentStatus[] = [
  'CREATING',
  'PREPARING', 
  'PREPARED',
  'NOT_PREPARED',
  'DELETING',
  'FAILED',
  'VERSIONING',
  'UPDATING',
  'UNKNOWN'
];

/**
 * Agent情報の基本バリデーション
 */
export const validateAgentInfo = (agentInfo: any): AgentValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // null/undefined チェック
  if (!agentInfo) {
    errors.push({
      field: 'agentInfo',
      code: 'REQUIRED_FIELD_MISSING' as ValidationErrorCode,
      message: 'Agent情報が提供されていません',
      severity: 'critical'
    });
    return { isValid: false, errors, warnings, securityChecks: [] };
  }

  // 必須フィールドの検証
  if (!agentInfo.agentId) {
    errors.push({
      field: 'agentId',
      code: 'REQUIRED_FIELD_MISSING' as ValidationErrorCode,
      message: 'agentIdは必須フィールドです',
      severity: 'error'
    });
  } else if (typeof agentInfo.agentId !== 'string') {
    errors.push({
      field: 'agentId',
      code: 'INVALID_TYPE' as ValidationErrorCode,
      message: 'agentIdは文字列である必要があります',
      severity: 'error'
    });
  } else if (agentInfo.agentId.trim().length === 0) {
    errors.push({
      field: 'agentId',
      code: 'INVALID_FORMAT' as ValidationErrorCode,
      message: 'agentIdは空文字列にできません',
      severity: 'error'
    });
  }

  // オプションフィールドの検証
  if (agentInfo.aliasName && typeof agentInfo.aliasName !== 'string') {
    warnings.push({
      field: 'aliasName',
      code: 'INVALID_TYPE' as ValidationWarningCode,
      message: 'aliasNameは文字列である必要があります'
    });
  }

  if (agentInfo.aliasId && typeof agentInfo.aliasId !== 'string') {
    warnings.push({
      field: 'aliasId',
      code: 'INVALID_TYPE' as ValidationWarningCode,
      message: 'aliasIdは文字列である必要があります'
    });
  }

  // バージョンの検証
  if (agentInfo.version !== undefined) {
    const versionNum = parseFloat(String(agentInfo.version));
    if (isNaN(versionNum) || versionNum < 0) {
      warnings.push({
        field: 'version',
        code: 'INVALID_FORMAT' as ValidationWarningCode,
        message: 'versionは0以上の数値である必要があります'
      });
    }
  }

  // ステータスの検証
  if (agentInfo.status && !VALID_AGENT_STATUSES.includes(agentInfo.status)) {
    warnings.push({
      field: 'status',
      code: 'INVALID_VALUE' as ValidationWarningCode,
      message: `無効なステータス: ${agentInfo.status}。有効な値: ${VALID_AGENT_STATUSES.join(', ')}`
    });
  }

  // 日付フィールドの検証
  if (agentInfo.createdAt && !isValidDateString(agentInfo.createdAt)) {
    warnings.push({
      field: 'createdAt',
      code: 'INVALID_FORMAT' as ValidationWarningCode,
      message: 'createdAtは有効な日付形式である必要があります'
    });
  }

  if (agentInfo.updatedAt && !isValidDateString(agentInfo.updatedAt)) {
    warnings.push({
      field: 'updatedAt',
      code: 'INVALID_FORMAT' as ValidationWarningCode,
      message: 'updatedAtは有効な日付形式である必要があります'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    securityChecks: []
  };
};

/**
 * Agent ID の形式検証
 */
export const validateAgentId = (agentId: string): boolean => {
  if (!agentId || typeof agentId !== 'string') {
    return false;
  }

  // Agent ID の基本的な形式チェック（英数字とハイフン）
  const agentIdPattern = /^[A-Z0-9]{10}$/;
  return agentIdPattern.test(agentId);
};

/**
 * Agent エイリアスの検証
 */
export const validateAgentAlias = (alias: string): boolean => {
  if (!alias || typeof alias !== 'string') {
    return false;
  }

  // エイリアス名の基本的な形式チェック
  const aliasPattern = /^[a-zA-Z0-9_-]{1,100}$/;
  return aliasPattern.test(alias);
};

/**
 * Agent バージョンの安全な変換
 */
export const safeParseVersion = (version: string | number | undefined): number => {
  if (version === undefined || version === null) {
    return 1; // デフォルトバージョン
  }

  if (typeof version === 'number') {
    return isNaN(version) || version < 0 ? 1 : Math.floor(version);
  }

  if (typeof version === 'string') {
    const parsed = parseInt(version.trim(), 10);
    return isNaN(parsed) || parsed < 0 ? 1 : parsed;
  }

  return 1;
};

/**
 * Agent ステータスの正規化
 */
export const normalizeAgentStatus = (status: string | undefined): AgentStatus => {
  if (!status || typeof status !== 'string') {
    return 'UNKNOWN';
  }

  const upperStatus = status.toUpperCase() as AgentStatus;
  return VALID_AGENT_STATUSES.includes(upperStatus) ? upperStatus : 'UNKNOWN';
};

/**
 * 日付文字列の検証
 */
const isValidDateString = (dateString: string): boolean => {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }

  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

/**
 * Agent情報のサニタイズ
 */
export const sanitizeAgentInfo = (agentInfo: RawAgentInfo): RawAgentInfo => {
  // 新しいオブジェクトを作成（readonlyプロパティを回避）
  return {
    ...(agentInfo.agentId && { agentId: String(agentInfo.agentId).trim() }),
    ...(agentInfo.aliasName && { aliasName: String(agentInfo.aliasName).trim() }),
    ...(agentInfo.aliasId && { aliasId: String(agentInfo.aliasId).trim() }),
    ...(agentInfo.description && { description: String(agentInfo.description).trim() }),
    ...(agentInfo.foundationModel && { foundationModel: String(agentInfo.foundationModel).trim() }),
    ...(agentInfo.instruction && { instruction: String(agentInfo.instruction).trim() }),
    ...(agentInfo.version !== undefined && { version: agentInfo.version }),
    ...(agentInfo.status && { status: String(agentInfo.status).trim() }),
    ...(agentInfo.createdAt && { createdAt: String(agentInfo.createdAt).trim() }),
    ...(agentInfo.updatedAt && { updatedAt: String(agentInfo.updatedAt).trim() }),
    ...(agentInfo.agentResourceRoleArn && { agentResourceRoleArn: agentInfo.agentResourceRoleArn }),
    ...(agentInfo.customerEncryptionKeyArn && { customerEncryptionKeyArn: agentInfo.customerEncryptionKeyArn }),
    ...(agentInfo.idleSessionTTLInSeconds !== undefined && { idleSessionTTLInSeconds: agentInfo.idleSessionTTLInSeconds })
  };
};

/**
 * Agent情報の完全性チェック
 */
export const checkAgentInfoCompleteness = (agentInfo: RawAgentInfo): {
  isComplete: boolean;
  missingFields: string[];
  optionalFields: string[];
} => {
  const requiredFields = ['agentId'];
  const optionalFields = ['aliasName', 'aliasId', 'version', 'status', 'description'];
  
  const missingFields = requiredFields.filter(field => !agentInfo[field as keyof RawAgentInfo]);
  const presentOptionalFields = optionalFields.filter(field => agentInfo[field as keyof RawAgentInfo]);

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    optionalFields: presentOptionalFields
  };
};