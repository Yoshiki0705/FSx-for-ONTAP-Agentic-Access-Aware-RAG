/**
 * 統合ファイル整理システム - パターンマッチングエンジン
 *
 * ファイル名パターンとファイル内容の解析により、
 * 適切な分類を行うためのマッチングエンジンを提供します。
 */
import { FileInfo, ClassificationRule } from '../types/index.js';
/**
 * パターンマッチング結果
 */
export interface MatchResult {
    /** マッチしたかどうか */
    matched: boolean;
    /** マッチした信頼度（0-1） */
    confidence: number;
    /** マッチしたパターン */
    matchedPattern: string;
    /** マッチした理由 */
    reason: string;
    /** 適用されたルール */
    rule: ClassificationRule;
}
/**
 * パターンマッチングエンジン
 *
 * ファイル名、拡張子、内容に基づいてファイルを分類するための
 * 高度なパターンマッチング機能を提供します。
 */
export declare class PatternMatcher {
    private readonly rules;
    private readonly contentAnalysisEnabled;
    constructor(rules: Record<string, Record<string, ClassificationRule>>, contentAnalysisEnabled?: boolean);
    /**
     * ファイルに最適なルールを見つける
     */
    findBestMatch(file: FileInfo): MatchResult | null;
    /**
     * 複数のマッチ候補を取得
     */
    findAllMatches(file: FileInfo, minConfidence?: number): MatchResult[];
    /**
     * 特定のカテゴリでマッチングを実行
     */
    matchCategory(file: FileInfo, category: string): MatchResult | null;
    /**
     * ルールを評価
     */
    private evaluateRule;
    /**
     * パターンマッチング
     */
    private matchPatterns;
    /**
     * 単一パターンマッチング
     */
    private matchSinglePattern;
    /**
     * 拡張子マッチング
     */
    private matchExtension;
    /**
     * ファイル内容マッチング
     */
    private matchContent;
    /**
     * パスマッチング
     */
    private matchPath;
    /**
     * サイズベースマッチング
     */
    private matchSize;
    /**
     * カテゴリ別内容パターンを取得
     */
    private getContentPatterns;
    /**
     * グロブパターンを正規表現に変換
     */
    private globToRegex;
    /**
     * ルールを読み込み
     */
    private loadRules;
    /**
     * ルールを追加
     */
    addRule(category: string, rule: ClassificationRule): void;
    /**
     * ルールを削除
     */
    removeRule(category: string, ruleName: string): boolean;
    /**
     * ルールを有効/無効化
     */
    toggleRule(category: string, ruleName: string, enabled: boolean): boolean;
    /**
     * 統計情報を取得
     */
    getStatistics(): {
        totalRules: number;
        enabledRules: number;
        categoryCounts: Record<string, number>;
    };
    /**
     * マッチング結果をテスト
     */
    testPattern(fileName: string, pattern: string): boolean;
}
