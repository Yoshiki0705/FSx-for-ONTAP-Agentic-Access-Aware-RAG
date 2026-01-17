/**
 * 権限ベースアクセス制御設定インターフェース
 *
 * エンタープライズグレードの権限管理システム
 * ISO 27001、SOC 2 Type II準拠
 */
/** 役職レベル定義 */
export type RoleLevel = 'admin' | 'manager' | 'user' | 'guest';
/** データ分類レベル（ISO 27001準拠） */
export type DataClassificationLevel = 'public' | 'internal' | 'confidential' | 'restricted';
/** アクセス結果タイプ */
export type AccessResult = 'allow' | 'deny' | 'conditional';
/** 地理的制限（ISO 3166-1 alpha-2準拠） */
export interface GeographicRestriction {
    /** 国コード */
    readonly countryCode: string;
    /** 地域名 */
    readonly regionName?: string;
    /** 制限タイプ */
    readonly restrictionType: 'allow' | 'deny';
}
/**
 * フォールバック動作の種類
 */
export type FallbackBehavior = 'deny' | 'allow' | 'cache';
/**
 * 曜日の列挙型
 */
export declare enum DayOfWeek {
    SUNDAY = 0,
    MONDAY = 1,
    TUESDAY = 2,
    WEDNESDAY = 3,
    THURSDAY = 4,
    FRIDAY = 5,
    SATURDAY = 6
}
/**
 * 時間ベース制限設定
 */
export interface TimeBasedRestriction {
    /** 制限有効化 */
    readonly enabled: boolean;
    /** 営業時間設定 */
    readonly businessHours: {
        /** 開始時刻（0-23の範囲） */
        readonly startHour: number;
        /** 終了時刻（0-23の範囲） */
        readonly endHour: number;
        /** 営業日（0=日曜日, 1=月曜日, ..., 6=土曜日） */
        readonly businessDays: number[];
        /** タイムゾーン（IANA形式: Asia/Tokyo等） */
        readonly timezone: string;
    };
    /** 緊急アクセス許可ユーザー */
    readonly emergencyAccessUsers: string[];
    /** 時間外アクセス許可役職レベル */
    readonly afterHoursRoles: RoleLevel[];
    /** 祝日設定 */
    readonly holidays?: {
        /** 祝日リスト（YYYY-MM-DD形式） */
        readonly dates: string[];
        /** 祝日アクセス許可 */
        readonly allowAccess: boolean;
    };
}
/**
 * 高度な地理的制限設定
 */
export interface AdvancedGeographicRestriction {
    /** 制限有効化 */
    readonly enabled: boolean;
    /** 許可国家コード（ISO 3166-1 alpha-2） */
    readonly allowedCountries: string[];
    /** 許可地域 */
    readonly allowedRegions: string[];
    /** 許可IPレンジ（CIDR形式） */
    readonly allowedIpRanges: string[];
    /** VPN検出設定 */
    readonly vpnDetection: {
        /** VPN検出有効化 */
        readonly enabled: boolean;
        /** VPN許可ユーザー */
        readonly allowedVpnUsers: string[];
        /** VPN検出API設定 */
        readonly detectionApi?: {
            readonly endpoint: string;
            /** API キーは環境変数から取得（機密情報保護） */
            readonly apiKeyEnvVar: string;
            readonly timeout: number;
            /** SSL証明書検証 */
            readonly verifySsl: boolean;
        };
    };
    /** 地理的制限例外ユーザー */
    readonly exemptUsers: string[];
    /** リスクベース認証 */
    readonly riskBasedAuth: {
        /** 有効化 */
        readonly enabled: boolean;
        /** 異常な場所からのアクセス検出 */
        readonly anomalyDetection: boolean;
        /** 追加認証要求 */
        readonly requireAdditionalAuth: boolean;
    };
}
/**
 * 動的権限設定
 */
export interface DynamicPermissionConfig {
    /** 動的権限有効化 */
    readonly enabled: boolean;
    /** プロジェクト参加ベース権限 */
    readonly projectBasedAccess: {
        /** 有効化 */
        readonly enabled: boolean;
        /** プロジェクト権限マッピング */
        readonly projectPermissions: Record<string, string[]>;
        /** プロジェクト参加確認API */
        readonly projectMembershipApi?: {
            readonly endpoint: string;
            /** API キーは環境変数から取得（機密情報保護） */
            readonly apiKeyEnvVar: string;
            readonly cacheSeconds: number;
            /** レート制限設定 */
            readonly rateLimitPerMinute: number;
            /** SSL証明書検証 */
            readonly verifySsl: boolean;
        };
        /** 自動権限付与 */
        readonly autoGrantPermissions: boolean;
    };
    /** 組織階層ベース権限 */
    readonly organizationalHierarchy: {
        /** 有効化 */
        readonly enabled: boolean;
        /** 階層定義 */
        readonly hierarchy: Record<string, string[]>;
        /** 継承権限 */
        readonly inheritedPermissions: boolean;
        /** 階層深度制限（最大10レベル） */
        readonly maxDepth: number;
    };
    /** エラーハンドリング設定 */
    readonly errorHandling: {
        /** API呼び出し失敗時のフォールバック動作 */
        readonly fallbackBehavior: 'deny' | 'allow' | 'cache';
        /** リトライ設定 */
        readonly retryConfig: {
            readonly maxRetries: number;
            readonly retryDelayMs: number;
            readonly exponentialBackoff: boolean;
        };
        /** タイムアウト設定（ミリ秒） */
        readonly timeoutMs: number;
    };
    /** 一時的権限付与 */
    readonly temporaryAccess: {
        /** 有効化 */
        readonly enabled: boolean;
        /** デフォルト有効期間（秒） */
        readonly defaultDurationSeconds: number;
        /** 最大有効期間（秒） */
        readonly maxDurationSeconds: number;
        /** 承認者リスト */
        readonly approvers: string[];
        /** 自動承認条件 */
        readonly autoApprovalRules?: {
            readonly maxDurationSeconds: number;
            readonly allowedRoles: RoleLevel[];
            readonly allowedDataClassifications: DataClassificationLevel[];
        };
    };
    /** 権限更新頻度（秒、最小値: 60秒） */
    readonly refreshIntervalSeconds: number;
    /** キャッシュ設定 */
    readonly cacheConfig: {
        /** 権限キャッシュ有効期間（秒） */
        readonly permissionCacheTtlSeconds: number;
        /** 組織階層キャッシュ有効期間（秒） */
        readonly hierarchyCacheTtlSeconds: number;
        /** 最大キャッシュエントリ数 */
        readonly maxCacheEntries: number;
    };
    /** 権限継承ルール */
    readonly inheritanceRules: {
        /** 部署間継承 */
        readonly departmentInheritance: boolean;
        /** プロジェクト間継承 */
        readonly projectInheritance: boolean;
        /** 時間制限継承 */
        readonly timeRestrictionInheritance: boolean;
    };
    /** 監査・ログ設定 */
    readonly auditConfig: {
        /** 権限変更ログ有効化 */
        readonly logPermissionChanges: boolean;
        /** アクセス試行ログ有効化 */
        readonly logAccessAttempts: boolean;
        /** 失敗したアクセス試行のみログ */
        readonly logFailedAttemptsOnly: boolean;
        /** ログ保持期間（日数） */
        readonly logRetentionDays: number;
        /** 機密データアクセスの詳細ログ */
        readonly detailedLoggingForSensitiveData: boolean;
    };
}
export interface UserPermission {
    /** ユーザーID（UUID形式推奨） */
    readonly userId: string;
    /** ユーザー名（PII情報のため暗号化推奨） */
    readonly userName: string;
    /** 所属組織 */
    readonly organization: string;
    /** 部署 */
    readonly department?: string;
    /** 役職レベル */
    readonly roleLevel: RoleLevel;
    /** アクセス可能なタグ（最大100個まで） */
    readonly accessibleTags: string[];
    /** アクセス可能なプロジェクト（最大50個まで） */
    readonly accessibleProjects: string[];
    /** データ分類レベル（ISO 27001準拠） */
    readonly dataClassificationLevel: DataClassificationLevel;
    /** 地理的制限 */
    readonly geographicRestrictions?: GeographicRestriction[];
    /** 有効期限 */
    readonly expiresAt?: Date;
}
export interface DocumentPermission {
    /** ドキュメントID */
    readonly documentId: string;
    /** 所有者 */
    readonly owner: string;
    /** アクセス可能なユーザー */
    readonly allowedUsers: string[];
    /** アクセス可能な組織 */
    readonly allowedOrganizations: string[];
    /** アクセス可能な部署 */
    readonly allowedDepartments: string[];
    /** 必要な役職レベル */
    readonly requiredRoleLevel: RoleLevel;
    /** データ分類 */
    readonly dataClassification: DataClassificationLevel;
    /** タグベース権限 */
    readonly tags: string[];
    /** プロジェクトベース権限 */
    readonly projects: string[];
    /** 地理的制限 */
    readonly geographicRestrictions?: string[];
    /** 時間ベース制限 */
    readonly timeRestrictions?: {
        readonly validFrom?: Date;
        readonly validUntil?: Date;
        readonly allowedHours?: number[];
        readonly allowedDays?: number[];
    };
}
export interface PermissionFilterConfig {
    /** 権限チェック有効化 */
    readonly enabled: boolean;
    /** デフォルト拒否モード */
    readonly defaultDeny: boolean;
    /** 管理者バイパス */
    readonly adminBypass: boolean;
    /** 監査ログ有効化 */
    readonly auditLogging: boolean;
    /** キャッシュ設定 */
    readonly cacheConfig: {
        readonly enabled: boolean;
        readonly ttlSeconds: number;
        readonly maxEntries: number;
    };
    /** パフォーマンス設定 */
    readonly performanceConfig: {
        readonly maxFilterSize: number;
        readonly timeoutMs: number;
        readonly batchSize: number;
    };
    /** 時間ベース制限 */
    readonly timeBasedRestriction: TimeBasedRestriction;
    /** 高度な地理的制限 */
    readonly advancedGeographicRestriction: AdvancedGeographicRestriction;
    /** 動的権限設定 */
    readonly dynamicPermissionConfig: DynamicPermissionConfig;
}
export interface AccessControlResult {
    /** アクセス許可 */
    readonly allowed: boolean;
    /** 理由 */
    readonly reason: string;
    /** 適用されたルール */
    readonly appliedRules: string[];
    /** フィルタリングされたドキュメント数 */
    readonly filteredCount?: number;
    /** 監査情報（SOC 2 Type II準拠） */
    readonly auditInfo: {
        readonly timestamp: Date;
        readonly userId: string;
        readonly sessionId: string;
        readonly ipAddress: string;
        readonly userAgent?: string;
        readonly action: string;
        readonly resource: string;
        readonly result: AccessResult;
        readonly riskScore?: number;
        readonly complianceFlags?: string[];
    };
}
/** 権限設定バリデーション関数 */
export interface PermissionValidator {
    /** ユーザー権限の妥当性検証 */
    validateUserPermission(permission: UserPermission): ValidationResult;
    /** ドキュメント権限の妥当性検証 */
    validateDocumentPermission(permission: DocumentPermission): ValidationResult;
    /** 権限競合の検出 */
    detectPermissionConflicts(permissions: UserPermission[]): ConflictResult[];
}
/** バリデーション結果 */
export interface ValidationResult {
    /** 検証成功フラグ */
    readonly isValid: boolean;
    /** エラーメッセージ */
    readonly errors: string[];
    /** 警告メッセージ */
    readonly warnings: string[];
    /** 推奨事項 */
    readonly recommendations: string[];
}
/** 権限競合結果 */
export interface ConflictResult {
    /** 競合タイプ */
    readonly conflictType: 'role_escalation' | 'data_classification_mismatch' | 'geographic_violation';
    /** 競合する権限ID */
    readonly conflictingPermissions: string[];
    /** 重要度 */
    readonly severity: 'low' | 'medium' | 'high' | 'critical';
    /** 解決提案 */
    readonly resolutionSuggestion: string;
}
