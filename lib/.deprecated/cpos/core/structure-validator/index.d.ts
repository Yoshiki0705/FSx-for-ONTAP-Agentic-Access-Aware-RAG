/**
 * Directory Structure Validator
 * ディレクトリ構造検証機能 - プロジェクト構造の検証と自動修正
 */
import { ProjectStructure, DirectoryRule, CustomRule } from '../../interfaces';
export interface ValidationResult {
    valid: boolean;
    violations: StructureViolation[];
    suggestions: StructureSuggestion[];
    summary: ValidationSummary;
}
export interface StructureViolation {
    type: 'missing_directory' | 'invalid_permission' | 'size_exceeded' | 'custom_rule_violation';
    path: string;
    rule: DirectoryRule | CustomRule;
    severity: 'error' | 'warning' | 'info';
    description: string;
    autoFixable: boolean;
}
export interface StructureSuggestion {
    type: 'create_directory' | 'fix_permission' | 'move_file' | 'cleanup';
    path: string;
    action: string;
    description: string;
    priority: number;
}
export interface ValidationSummary {
    totalDirectories: number;
    validDirectories: number;
    missingDirectories: number;
    violationCount: number;
    autoFixableCount: number;
}
export interface StructureValidatorConfig {
    structureDefinitionPath: string;
    autoCreateDirectories: boolean;
    autoFixPermissions: boolean;
    enableCustomRules: boolean;
    maxDirectorySize: number;
    excludePatterns: string[];
}
export declare class DirectoryStructureValidator {
    private config;
    private projectStructure;
    private basePath;
    constructor(config: StructureValidatorConfig, basePath?: string);
    /**
     * 構造検証機能を初期化
     */
    initialize(): Promise<void>;
    /**
     * プロジェクト構造を検証
     */
    validateStructure(): Promise<ValidationResult>;
    /**
     * ディレクトリルールを検証
     */
    private validateDirectoryRule;
    /**
     * パーミッションを検証
     */
    private validatePermissions;
    /**
     * ディレクトリサイズを検証
     */
    private validateDirectorySize;
    /**
     * カスタムルールを検証
     */
    private validateCustomRule;
    /**
     * ファイルタイプルールを検証
     */
    private validateFileTypeRules;
    /**
     * 違反に対する修正提案を生成
     */
    private generateSuggestion;
    /**
     * 自動修正を実行
     */
    autoFix(suggestions: StructureSuggestion[]): Promise<{
        success: boolean;
        results: string[];
    }>;
    /**
     * 修正提案を実行
     */
    private executeSuggestion;
    /**
     * プロジェクト構造定義を読み込み
     */
    private loadProjectStructure;
    /**
     * デフォルトプロジェクト構造を取得
     */
    private getDefaultProjectStructure;
    /**
     * 検証サマリーを生成
     */
    private generateValidationSummary;
    /**
     * ディレクトリサイズを計算
     */
    private calculateDirectorySize;
    /**
     * 全ファイルをスキャン
     */
    private scanAllFiles;
    /**
     * 除外パターンをチェック
     */
    private isExcluded;
    /**
     * パスが期待される場所にあるかチェック
     */
    private isPathInExpectedLocation;
    /**
     * カスタムルール条件を評価
     */
    private evaluateCustomRuleCondition;
    /**
     * カスタムルールアクションを評価
     */
    private evaluateCustomRuleAction;
    /**
     * 構造定義を更新
     */
    updateStructureDefinition(structure: ProjectStructure): Promise<void>;
    /**
     * 構造定義を取得
     */
    getStructureDefinition(): ProjectStructure | null;
    /**
     * 設定を取得
     */
    getConfig(): StructureValidatorConfig;
}
