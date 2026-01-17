/**
 * Structure Validator Factory
 * 構造検証機能のファクトリークラス
 */
import { DirectoryStructureValidator, StructureValidatorConfig } from './index';
import { CPOSConfig } from '../configuration';
export declare class StructureValidatorFactory {
    /**
     * デフォルト設定で構造検証機能を作成
     */
    static createDefault(basePath?: string): DirectoryStructureValidator;
    /**
     * CPOS設定から構造検証機能を作成
     */
    static createFromConfig(cposConfig: CPOSConfig, basePath?: string): DirectoryStructureValidator;
    /**
     * カスタム設定で構造検証機能を作成
     */
    static createCustom(config: Partial<StructureValidatorConfig>, basePath?: string): DirectoryStructureValidator;
    /**
     * 厳格モードで構造検証機能を作成
     */
    static createStrictMode(basePath?: string): DirectoryStructureValidator;
    /**
     * 開発環境用設定で構造検証機能を作成
     */
    static createForDevelopment(basePath?: string): DirectoryStructureValidator;
    /**
     * 本番環境用設定で構造検証機能を作成
     */
    static createForProduction(basePath?: string): DirectoryStructureValidator;
    /**
     * プロジェクトタイプ別設定で構造検証機能を作成
     */
    static createForProjectType(projectType: 'cdk' | 'nextjs' | 'lambda' | 'library', basePath?: string): DirectoryStructureValidator;
    /**
     * 設定の妥当性をチェック
     */
    static validateConfig(config: StructureValidatorConfig): {
        valid: boolean;
        errors: string[];
    };
    /**
     * 設定の推奨値をチェック
     */
    static getConfigRecommendations(config: StructureValidatorConfig): string[];
    /**
     * プロジェクトタイプを自動検出
     */
    static detectProjectType(basePath?: string): Promise<'cdk' | 'nextjs' | 'lambda' | 'library' | 'unknown'>;
}
