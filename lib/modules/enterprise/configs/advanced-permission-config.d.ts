/**
 * 高度な権限制御設定
 *
 * 時間ベース制限、地理的制限、動的権限の統合設定
 * エンタープライズグレードのセキュリティ要件対応
 */
import { PermissionFilterConfig, TimeBasedRestriction, RoleLevel, DataClassificationLevel } from '../interfaces/permission-config';
/**
 * 東京本社向け高度権限制御設定
 */
export declare const TokyoAdvancedPermissionConfig: PermissionFilterConfig;
/**
 * 開発環境向け緩和設定
 */
export declare const DevelopmentAdvancedPermissionConfig: PermissionFilterConfig;
/**
 * 本番環境向け厳格設定
 */
export declare const ProductionAdvancedPermissionConfig: PermissionFilterConfig;
/**
 * 環境別設定取得関数
 */
export declare function getAdvancedPermissionConfig(environment: string): PermissionFilterConfig;
/**
 * 役職レベル階層定義
 */
export declare const RoleLevelHierarchy: Record<RoleLevel, RoleLevel[]>;
/**
 * データ分類レベル階層定義
 */
export declare const DataClassificationHierarchy: Record<DataClassificationLevel, DataClassificationLevel[]>;
/**
 * 営業時間判定関数（改善版）
 */
export declare function isBusinessHours(date: Date, config: TimeBasedRestriction, timezone?: string): boolean;
/**
 * IP範囲チェック関数（改善版）
 */
export declare function isIpInRange(ipAddress: string, allowedRanges: string[]): boolean;
/**
 * 権限継承計算関数
 */
export declare function calculateInheritedPermissions(userRole: RoleLevel, dataClassification: DataClassificationLevel): {
    allowedRoles: RoleLevel[];
    allowedClassifications: DataClassificationLevel[];
};
/**
 * 設定検証関数
 */
export declare function validatePermissionConfig(config: PermissionFilterConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
};
