/**
 * Configuration Loader
 * 環境別設定の動的読み込み機能
 */
import { GlobalRagConfig } from '../../types/global-config';
import { MarkitdownConfig, SupportedFileFormat, ProcessingStrategy } from '../../types/markitdown-config';
/**
 * Markitdown設定を読み込む
 */
export declare function loadMarkitdownConfig(environment?: string): MarkitdownConfig;
/**
 * 環境別設定を読み込む
 */
export declare function loadEnvironmentConfig(environment: string, region: string, projectName: string): GlobalRagConfig;
/**
 * Markitdown設定を検証する
 */
export declare function validateMarkitdownConfig(config: MarkitdownConfig): boolean;
/**
 * ファイル形式の処理方法を動的に変更する
 */
export declare function updateProcessingStrategy(config: MarkitdownConfig, format: SupportedFileFormat, strategy: ProcessingStrategy): MarkitdownConfig;
/**
 * 複数のファイル形式の処理方法を一括変更
 */
export declare function updateMultipleProcessingStrategies(config: MarkitdownConfig, updates: Record<SupportedFileFormat, ProcessingStrategy>): MarkitdownConfig;
/**
 * 処理方法の使用状況レポートを生成
 */
export declare function generateProcessingMethodReport(config: MarkitdownConfig): {
    summary: {
        totalFormats: number;
        markitdownOnlyFormats: number;
        langchainOnlyFormats: number;
        hybridFormats: number;
        qualityComparisonFormats: number;
    };
    details: Array<{
        format: SupportedFileFormat;
        strategy: ProcessingStrategy;
        useMarkitdown: boolean;
        useLangChain: boolean;
        qualityComparison: boolean;
    }>;
};
/**
 * Markitdown設定テンプレートを生成する
 */
export declare function generateMarkitdownConfigTemplate(): MarkitdownConfig;
/**
 * 地域別のデフォルト設定を取得
 */
export declare function getRegionalDefaults(region: string): Partial<GlobalRagConfig>;
