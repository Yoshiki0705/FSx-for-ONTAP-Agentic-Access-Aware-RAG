/**
 * Configuration Manager
 * システム全体の設定管理と環境固有設定の処理を担当
 */
export interface CPOSConfig {
    version: string;
    environments: {
        local: EnvironmentConfig;
        ec2: EnvironmentConfig;
    };
    classification: ClassificationConfig;
    sync: SyncConfig;
    backup: BackupConfig;
}
export interface EnvironmentConfig {
    basePath: string;
    tempPath: string;
    backupPath: string;
    host?: string;
    user?: string;
    keyPath?: string;
}
export interface ClassificationConfig {
    rules: string;
    confidence: number;
    autoApply: boolean;
}
export interface SyncConfig {
    interval: string;
    conflictResolution: 'prompt' | 'auto' | 'manual';
    excludePatterns: string[];
}
export interface BackupConfig {
    schedule: {
        incremental: string;
        full: string;
        archive: string;
    };
    retention: {
        daily: number;
        weekly: number;
        monthly: number;
    };
}
export declare class ConfigurationManager {
    private config;
    private configPath;
    constructor(configPath?: string);
    /**
     * 設定ファイルを読み込む
     */
    loadConfig(): Promise<CPOSConfig>;
    /**
     * デフォルト設定を取得
     */
    getDefaultConfig(): CPOSConfig;
    /**
     * 設定を保存
     */
    saveConfig(config: CPOSConfig): Promise<void>;
    /**
     * 現在の設定を取得
     */
    getConfig(): CPOSConfig;
    /**
     * 環境固有の設定を取得
     */
    getEnvironmentConfig(environment: 'local' | 'ec2'): EnvironmentConfig;
    /**
     * 設定の検証
     */
    validateConfig(config: CPOSConfig): boolean;
}
