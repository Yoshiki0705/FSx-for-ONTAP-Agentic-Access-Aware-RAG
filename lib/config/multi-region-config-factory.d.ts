/**
 * マルチリージョン設定ファクトリー
 *
 * 機能:
 * - リージョン別設定の一元管理
 * - 設定バリデーション
 * - 自動CIDR計算
 * - コンプライアンス要件チェック
 */
import { MultiRegionConfig, Region } from './interfaces/multi-region-config';
/**
 * 設定バリデーション結果
 */
export interface ConfigValidationResult {
    readonly isValid: boolean;
    readonly errors: string[];
    readonly warnings: string[];
}
/**
 * マルチリージョン設定ファクトリー
 */
export declare class MultiRegionConfigFactory {
    private static readonly REGION_CONFIGS;
    /**
     * リージョン設定取得（文字列リージョンから）
     */
    static getRegionConfig(regionString: string): {
        regionName: string;
        regionPrefix: string;
    };
    /**
     * 文字列からRegion enumに変換
     */
    static parseRegion(regionString: string): Region;
    /**
     * リージョン設定取得
     */
    static getConfig(region: Region): MultiRegionConfig;
    /**
     * 利用可能リージョン一覧取得
     */
    static getAvailableRegions(): Region[];
    /**
     * 地域別リージョン取得
     */
    static getRegionsByArea(): Record<string, Region[]>;
    /**
     * 設定バリデーション
     */
    static validateConfig(config: MultiRegionConfig): ConfigValidationResult;
    /**
     * リージョンの地域取得
     */
    private static getRegionArea;
    /**
     * カスタム設定作成
     */
    static createCustomConfig(baseRegion: Region, overrides: Partial<MultiRegionConfig>): MultiRegionConfig;
    /**
     * 災害復旧ペア設定取得
     */
    static getDisasterRecoveryPairs(): Record<Region, Region | undefined>;
    /**
     * コンプライアンス要件サマリー取得
     */
    static getComplianceSummary(region: Region): string[];
}
