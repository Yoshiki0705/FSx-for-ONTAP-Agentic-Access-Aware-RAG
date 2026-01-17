/**
 * Bedrock Agent 型定義 - Permission-aware RAG System
 * 
 * 機能:
 * - Agent情報の型安全性確保
 * - データ変換前後の型定義
 * - バリデーション用の型定義
 * - エラーハンドリング強化
 * 
 * @version 1.0.0
 * @author Permission-aware RAG Team
 */

// 基本的な識別子型（型安全性強化）
export type AgentId = string & { readonly __brand: 'AgentId' };
export type AliasId = string & { readonly __brand: 'AliasId' };
export type AgentVersion = number & { readonly __brand: 'AgentVersion' };

// 生のAgent情報(APIから取得される形式)
export interface RawAgentInfo {
  readonly agentId?: string;
  readonly aliasName?: string | null;  // null も許容
  readonly aliasId?: string | null;    // null も許容
  readonly version?: string | number;
  readonly status?: string;
  readonly description?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly foundationModel?: string;
  readonly instruction?: string;
  readonly agentResourceRoleArn?: string;
  readonly customerEncryptionKeyArn?: string;
  readonly idleSessionTTLInSeconds?: number;
}

// 正規化されたAgent情報（UI表示用）
export interface NormalizedAgentInfo {
  readonly agentId: AgentId;
  readonly alias: string;
  readonly version: AgentVersion;
  readonly status: AgentStatus;
  readonly description?: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
  readonly foundationModel?: string;
  readonly instruction?: string;
  readonly isActive: boolean;
  readonly lastUsed?: Date;
}

// Agent ステータス列挙型（より詳細な状態管理）
export const AgentStatus = {
  CREATING: 'CREATING',
  PREPARING: 'PREPARING', 
  PREPARED: 'PREPARED',
  NOT_PREPARED: 'NOT_PREPARED',
  DELETING: 'DELETING',
  FAILED: 'FAILED',
  VERSIONING: 'VERSIONING',
  UPDATING: 'UPDATING',
  UNKNOWN: 'UNKNOWN'
} as const;

export type AgentStatus = typeof AgentStatus[keyof typeof AgentStatus];

// Agent ステータス分類
export const AgentStatusCategory = {
  ACTIVE: [AgentStatus.PREPARED],
  PROCESSING: [AgentStatus.CREATING, AgentStatus.PREPARING, AgentStatus.VERSIONING, AgentStatus.UPDATING],
  INACTIVE: [AgentStatus.NOT_PREPARED, AgentStatus.FAILED],
  DELETING: [AgentStatus.DELETING],
  UNKNOWN: [AgentStatus.UNKNOWN]
} as const;

// バリデーション結果（セキュリティ強化）
export interface AgentValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
  readonly securityChecks: readonly SecurityCheckResult[];
}

// バリデーションエラー詳細
export interface ValidationError {
  readonly field: string;
  readonly code: ValidationErrorCode;
  readonly message: string;
  readonly severity: 'error' | 'critical';
}

// バリデーション警告
export interface ValidationWarning {
  readonly field: string;
  readonly code: ValidationWarningCode;
  readonly message: string;
  readonly recommendation?: string;
}

// セキュリティチェック結果
export interface SecurityCheckResult {
  readonly checkType: SecurityCheckType;
  readonly passed: boolean;
  readonly message: string;
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// バリデーションエラーコード
export const ValidationErrorCode = {
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_LENGTH: 'INVALID_LENGTH',
  INVALID_CHARACTERS: 'INVALID_CHARACTERS',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
} as const;

export type ValidationErrorCode = typeof ValidationErrorCode[keyof typeof ValidationErrorCode];

// バリデーション警告コード
export const ValidationWarningCode = {
  DEPRECATED_FIELD: 'DEPRECATED_FIELD',
  PERFORMANCE_IMPACT: 'PERFORMANCE_IMPACT',
  SECURITY_RECOMMENDATION: 'SECURITY_RECOMMENDATION'
} as const;

export type ValidationWarningCode = typeof ValidationWarningCode[keyof typeof ValidationWarningCode];

// セキュリティチェックタイプ
export const SecurityCheckType = {
  ROLE_ARN_VALIDATION: 'ROLE_ARN_VALIDATION',
  INSTRUCTION_CONTENT_SCAN: 'INSTRUCTION_CONTENT_SCAN',
  MODEL_PERMISSION_CHECK: 'MODEL_PERMISSION_CHECK',
  ENCRYPTION_VALIDATION: 'ENCRYPTION_VALIDATION'
} as const;

export type SecurityCheckType = typeof SecurityCheckType[keyof typeof SecurityCheckType];

// Agent作成パラメータ（バリデーション強化）
export interface CreateAgentParams {
  readonly agentName: string;
  readonly description?: string;
  readonly foundationModel: string;
  readonly instruction: string;
  readonly roleArn: string;
  readonly customerEncryptionKeyArn?: string;
  readonly idleSessionTTLInSeconds?: number;
  readonly tags?: Record<string, string>;
}

// Agent更新パラメータ（部分更新対応）
export interface UpdateAgentParams {
  readonly agentId: AgentId;
  readonly agentName?: string;
  readonly description?: string;
  readonly foundationModel?: string;
  readonly instruction?: string;
  readonly idleSessionTTLInSeconds?: number;
  readonly tags?: Record<string, string>;
}

// Agent削除パラメータ（安全性強化）
export interface DeleteAgentParams {
  readonly agentId: AgentId;
  readonly skipResourceInUseCheck?: boolean;
  readonly forceDelete?: boolean;
  readonly confirmationToken?: string;
}

// Agent情報取得パラメータ（キャッシュ対応）
export interface GetAgentParams {
  readonly agentId: AgentId;
  readonly includeDetails?: boolean;
  readonly useCache?: boolean;
  readonly cacheMaxAge?: number;
}

// Agent一覧取得パラメータ（フィルタリング・ソート対応）
export interface ListAgentsParams {
  readonly maxResults?: number;
  readonly nextToken?: string;
  readonly statusFilter?: readonly AgentStatus[];
  readonly nameFilter?: string;
  readonly sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'status';
  readonly sortOrder?: 'asc' | 'desc';
  readonly includeInactive?: boolean;
}

// Agent API レスポンス（エラーハンドリング強化）
export interface AgentApiResponse<T = any> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: AgentApiError;
  readonly message?: string;
  readonly timestamp: string;
  readonly requestId?: string;
  readonly metadata?: ResponseMetadata;
}

// API エラー詳細
export interface AgentApiError {
  readonly code: AgentErrorCode;
  readonly message: string;
  readonly details?: Record<string, any>;
  readonly retryable: boolean;
  readonly retryAfter?: number;
}

// レスポンスメタデータ
export interface ResponseMetadata {
  readonly version: string;
  readonly region: string;
  readonly executionTime: number;
  readonly cacheHit?: boolean;
  readonly rateLimitRemaining?: number;
}

// エラーコード定義
export const AgentErrorCode = {
  // 認証・認可エラー
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // リソースエラー
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_ALREADY_EXISTS: 'AGENT_ALREADY_EXISTS',
  RESOURCE_IN_USE: 'RESOURCE_IN_USE',
  
  // バリデーションエラー
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  MISSING_PARAMETER: 'MISSING_PARAMETER',
  PARAMETER_OUT_OF_RANGE: 'PARAMETER_OUT_OF_RANGE',
  
  // システムエラー
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TIMEOUT: 'TIMEOUT',
  
  // 設定エラー
  INVALID_MODEL: 'INVALID_MODEL',
  INVALID_ROLE_ARN: 'INVALID_ROLE_ARN',
  ENCRYPTION_ERROR: 'ENCRYPTION_ERROR'
} as const;

export type AgentErrorCode = typeof AgentErrorCode[keyof typeof AgentErrorCode];

// Agent作成レスポンス（詳細情報追加）
export interface CreateAgentResponse extends AgentApiResponse {
  readonly data?: {
    readonly agentId: AgentId;
    readonly agentName: string;
    readonly agentArn: string;
    readonly agentStatus: AgentStatus;
    readonly agentVersion: AgentVersion;
    readonly createdAt: string;
    readonly estimatedReadyTime?: string;
  };
}

// Agent情報取得レスポンス（キャッシュ情報追加）
export interface GetAgentResponse extends AgentApiResponse {
  readonly data?: RawAgentInfo;
  readonly cached?: boolean;
  readonly cacheAge?: number;
}

// Agent一覧取得レスポンス（統計情報追加）
export interface ListAgentsResponse extends AgentApiResponse {
  readonly data?: {
    readonly agentSummaries: readonly RawAgentInfo[];
    readonly nextToken?: string;
    readonly totalCount?: number;
    readonly statusCounts?: Record<AgentStatus, number>;
  };
}

// Agent操作レスポンス（汎用）
export interface AgentOperationResponse extends AgentApiResponse {
  readonly data?: {
    readonly agentId: AgentId;
    readonly operationType: AgentOperationType;
    readonly operationStatus: OperationStatus;
    readonly operationId?: string;
  };
}

// 操作タイプ
export const AgentOperationType = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  PREPARE: 'PREPARE',
  VERSION: 'VERSION'
} as const;

export type AgentOperationType = typeof AgentOperationType[keyof typeof AgentOperationType];

// 操作ステータス
export const OperationStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
} as const;

export type OperationStatus = typeof OperationStatus[keyof typeof OperationStatus];

// 型ガード関数
export const isAgentId = (value: string): value is AgentId => {
  return typeof value === 'string' && value.length > 0 && /^[A-Z0-9]{10}$/.test(value);
};

export const isAliasId = (value: string): value is AliasId => {
  return typeof value === 'string' && value.length > 0 && /^[A-Z0-9]{10}$/.test(value);
};

export const isValidAgentStatus = (status: string): status is AgentStatus => {
  return Object.values(AgentStatus).includes(status as AgentStatus);
};

// ユーティリティ関数
export const getAgentStatusCategory = (status: AgentStatus): keyof typeof AgentStatusCategory => {
  for (const [category, statuses] of Object.entries(AgentStatusCategory)) {
    if ((statuses as readonly AgentStatus[]).includes(status)) {
      return category as keyof typeof AgentStatusCategory;
    }
  }
  return 'UNKNOWN';
};

export const isAgentActive = (agent: NormalizedAgentInfo): boolean => {
  return agent.status === AgentStatus.PREPARED && agent.isActive;
};

export const formatAgentError = (error: AgentApiError): string => {
  return `${error.code}: ${error.message}${error.details ? ` (${JSON.stringify(error.details)})` : ''}`;
};