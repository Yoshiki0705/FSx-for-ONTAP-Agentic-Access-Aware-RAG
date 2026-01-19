import { RegionConfig, RegionalDeploymentConfig } from './regional-deployment-manager';
/**
 * 地域別設定ファクトリー
 *
 * 各地域の特性に応じた設定を提供
 */
export declare class RegionalConfigFactory {
    /**
     * 日本地域設定
     */
    static createJapanRegionConfigs(): RegionConfig[];
    /**
     * APAC地域設定
     */
    static createApacRegionConfigs(): RegionConfig[];
    /**
     * EU地域設定
     */
    static createEuRegionConfigs(): RegionConfig[];
    /**
     * US地域設定
     */
    static createUsRegionConfigs(): RegionConfig[];
    /**
     * 南米地域設定
     */
    static createSouthAmericaRegionConfigs(): RegionConfig[];
    /**
     * デプロイメント戦略設定
     */
    static createDeploymentStrategies(): {
        [key: string]: RegionalDeploymentConfig;
    };
    /**
     * 地域別コンプライアンス要件マッピング
     */
    static getComplianceRequirements(): {
        [region: string]: {
            regulations: string[];
            dataResidency: boolean;
            encryptionRequired: boolean;
            auditLogRetention: number;
            accessControlLevel: 'BASIC' | 'ENHANCED' | 'STRICT';
        };
    };
}
