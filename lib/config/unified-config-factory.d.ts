/**
 * 統一設定ファクトリー
 * タスク3.3: 統一設定システムの構築
 */
import * as cdk from 'aws-cdk-lib';
import { UnifiedConfig, Environment, Region, IConfigFactory, IConfigProvider, ConfigValidationResult } from './interfaces/unified-config';
/**
 * 統一設定ファクトリー実装
 */
export declare class UnifiedConfigFactory implements IConfigFactory {
    /**
     * 環境別設定を取得
     */
    getConfig(environment: Environment, region: Region): UnifiedConfig;
    /**
     * 設定をバリデーション
     */
    validateConfig(config: UnifiedConfig): ConfigValidationResult;
    /**
     * 設定をマージ
     */
    mergeConfigs(base: Partial<UnifiedConfig>, override: Partial<UnifiedConfig>): UnifiedConfig;
    /**
     * リージョン固有の設定を適用
     */
    private applyRegionSpecificConfig;
    /**
     * リージョン別の利用可能なBedrockモデルを取得
     */
    private getAvailableModelsForRegion;
    /**
     * CIDR形式の妥当性チェック
     */
    private isValidCidr;
    /**
     * AWSリージョンの妥当性チェック
     */
    private isValidRegion;
    /**
     * オブジェクトの深いマージ
     */
    private deepMerge;
}
/**
 * 統一設定プロバイダー実装
 */
export declare class UnifiedConfigProvider implements IConfigProvider {
    private configFactory;
    constructor();
    /**
     * 現在の設定を取得
     */
    getCurrentConfig(): UnifiedConfig;
    /**
     * 環境変数から設定を読み込み
     */
    loadFromEnvironment(): Partial<UnifiedConfig>;
    /**
     * CDKコンテキストから設定を読み込み
     */
    loadFromContext(app: cdk.App): Partial<UnifiedConfig>;
}
/**
 * 統一設定マネージャー
 */
export declare class UnifiedConfigManager {
    private factory;
    private provider;
    constructor();
    /**
     * 完全な設定を取得（環境変数とCDKコンテキストを統合）
     */
    getCompleteConfig(app?: cdk.App): UnifiedConfig;
    /**
     * 環境とリージョンを指定して設定を取得
     */
    getConfigForEnvironmentAndRegion(environment: Environment, region: Region): UnifiedConfig;
}
export declare const configManager: UnifiedConfigManager;
