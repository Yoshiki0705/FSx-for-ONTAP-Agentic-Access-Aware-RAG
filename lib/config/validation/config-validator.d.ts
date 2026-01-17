/**
 * 環境設定バリデーター
 *
 * FSx for ONTAP と Serverless 統合システムの設定をバリデーションします。
 *
 * @author Kiro AI
 * @date 2026-01-08
 * @version 1.0.0
 */
import { EnvironmentConfig, FsxIntegrationConfig } from '../interfaces/environment-config';
/**
 * バリデーション結果
 */
export interface ValidationResult {
    /**
     * バリデーション成功フラグ
     */
    readonly isValid: boolean;
    /**
     * エラーメッセージリスト
     */
    readonly errors: string[];
    /**
     * 警告メッセージリスト
     */
    readonly warnings: string[];
}
/**
 * 互換性チェック結果
 */
export interface CompatibilityResult {
    /**
     * 互換性チェック成功フラグ
     */
    readonly isCompatible: boolean;
    /**
     * 警告メッセージリスト
     */
    readonly warnings: string[];
    /**
     * エラーメッセージリスト
     */
    readonly errors: string[];
}
/**
 * 設定バリデータークラス
 */
export declare class ConfigValidator {
    /**
     * 環境設定をバリデーション
     *
     * @param config 環境設定
     * @returns バリデーション結果
     */
    static validateEnvironmentConfig(config: EnvironmentConfig): ValidationResult;
    /**
     * FSx統合設定をバリデーション
     *
     * @param config FSx統合設定
     * @returns バリデーション結果
     */
    static validateFsxIntegrationConfig(config: FsxIntegrationConfig): ValidationResult;
    /**
     * 互換性チェック
     *
     * @param config 環境設定
     * @returns 互換性チェック結果
     */
    static validateCompatibility(config: EnvironmentConfig): CompatibilityResult;
    /**
     * FSx-Serverless互換性チェック
     *
     * @param config FSx統合設定
     * @returns 互換性チェック結果
     */
    static validateFsxServerlessCompatibility(config: FsxIntegrationConfig): CompatibilityResult;
    /**
     * 最適化提案の取得
     *
     * @param config 環境設定
     * @returns 最適化提案リスト
     */
    static getOptimizationSuggestions(config: EnvironmentConfig): string[];
    /**
     * FSx統合最適化提案の取得
     *
     * @param config FSx統合設定
     * @returns 最適化提案リスト
     */
    static getFsxOptimizationSuggestions(config: FsxIntegrationConfig): string[];
    /**
     * 基本設定のバリデーション
     */
    private static validateBasicConfig;
    /**
     * FSx統合基本設定のバリデーション
     */
    private static validateFsxIntegrationBasicConfig;
    /**
     * FSx ONTAP設定のバリデーション（既存システム用）
     */
    private static validateFsxOntapConfig;
    /**
     * FSx設定のバリデーション（統合システム用）
     */
    private static validateFsxConfig;
    /**
     * Serverless設定のバリデーション
     */
    private static validateServerlessConfig;
    /**
     * FSxとServerlessの互換性チェック
     */
    private static checkFsxServerlessCompatibility;
    /**
     * リージョン互換性チェック
     */
    private static checkRegionCompatibility;
    /**
     * FSx統合リージョン互換性チェック
     */
    private static checkFsxIntegrationRegionCompatibility;
    /**
     * FSx ONTAP最適化提案（既存システム用）
     */
    private static getFsxOntapOptimizationSuggestions;
    /**
     * FSx統合最適化提案
     */
    private static getFsxIntegrationOptimizationSuggestions;
    /**
     * Serverless最適化提案
     */
    private static getServerlessOptimizationSuggestions;
}
