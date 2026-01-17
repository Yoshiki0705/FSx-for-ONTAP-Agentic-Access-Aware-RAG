/**
 * Environment Manager
 * 環境別設定の管理と暗号化対応
 */
import { CPOSConfig } from './index';
export interface EnvironmentSettings {
    name: string;
    encrypted: boolean;
    configPath: string;
    secretsPath?: string;
}
export declare class EnvironmentManager {
    private configManager;
    private encryptionManager;
    private environments;
    private currentEnvironment;
    constructor();
    /**
     * デフォルト環境を設定
     */
    private setupDefaultEnvironments;
    /**
     * 現在の環境を設定
     */
    setCurrentEnvironment(environment: string): void;
    /**
     * 現在の環境を取得
     */
    getCurrentEnvironment(): string;
    /**
     * 環境設定を読み込み
     */
    loadEnvironmentConfig(environment?: string): Promise<CPOSConfig>;
    /**
     * 環境設定を保存
     */
    saveEnvironmentConfig(config: CPOSConfig, environment?: string): Promise<void>;
    /**
     * シークレット情報を読み込み
     */
    private loadSecrets;
    /**
     * 設定からシークレット情報を分離
     */
    private separateSecrets;
    /**
     * シークレット情報を設定にマージ
     */
    private mergeSecrets;
    /**
     * 環境用のパスワードを取得
     */
    private getEnvironmentPassword;
    /**
     * 環境設定を初期化
     */
    initializeEnvironment(environment: string, password?: string): Promise<void>;
    /**
     * 利用可能な環境一覧を取得
     */
    getAvailableEnvironments(): string[];
    /**
     * 環境設定の詳細を取得
     */
    getEnvironmentSettings(environment: string): EnvironmentSettings | undefined;
    /**
     * 設定ファイルの存在確認
     */
    checkEnvironmentConfig(environment: string): Promise<boolean>;
}
