/**
 * Classification Rule Manager
 * 分類ルールの管理機能
 */
import { ClassificationRule } from '../../interfaces';
export interface RuleValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare class ClassificationRuleManager {
    private rulesFile;
    private rules;
    constructor(rulesFile: string);
    /**
     * ルールを読み込み
     */
    loadRules(): Promise<ClassificationRule[]>;
    /**
     * ルールを保存
     */
    saveRules(rules: ClassificationRule[]): Promise<void>;
    /**
     * ルールを追加
     */
    addRule(rule: ClassificationRule): Promise<void>;
    /**
     * ルールを更新
     */
    updateRule(name: string, updatedRule: ClassificationRule): Promise<void>;
    /**
     * ルールを削除
     */
    deleteRule(name: string): Promise<void>;
    /**
     * ルールを検索
     */
    findRules(query: string): ClassificationRule[];
    /**
     * カテゴリ別ルールを取得
     */
    getRulesByCategory(category: string): ClassificationRule[];
    /**
     * ルールを検証
     */
    validateRule(rule: ClassificationRule): RuleValidationResult;
    /**
     * 複数ルールを検証
     */
    validateRules(rules: ClassificationRule[]): RuleValidationResult;
    /**
     * ルール競合を検出
     */
    private detectRuleConflicts;
    /**
     * パターンの重複をチェック
     */
    private patternsOverlap;
    /**
     * カテゴリを抽出
     */
    private extractCategory;
    /**
     * 組み込みルールを取得
     */
    private getBuiltinRules;
    /**
     * 統計情報を取得
     */
    getStatistics(): any;
    /**
     * 現在のルールを取得
     */
    getRules(): ClassificationRule[];
}
