/**
 * Enterprise Configuration Interface
 * エンタープライズ機能の設定インターフェース
 */
export interface EnterpriseConfig {
    enabled: boolean;
    accessControl?: {
        enabled: boolean;
    };
    analytics?: {
        enabled: boolean;
    };
    organization?: {
        enabled: boolean;
    };
}
