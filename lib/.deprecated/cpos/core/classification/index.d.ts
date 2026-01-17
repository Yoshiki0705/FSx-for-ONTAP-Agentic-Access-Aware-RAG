/**
 * Classification Engine
 * ファイルの自動分類と配置決定を担当
 */
import { ClassificationResult, ClassificationRule } from '../../interfaces';
export interface ClassificationConfig {
    rulesFile: string;
    defaultConfidenceThreshold: number;
    maxContentAnalysisSize: number;
    enableContentAnalysis: boolean;
    enableLearning: boolean;
}
export declare class ClassificationEngine {
    private config;
    private rules;
    private learningData;
    constructor(config: ClassificationConfig);
    /**
     * 分類エンジンを初期化
     */
    initialize(): Promise<void>;
    /**
     * ファイルを分類
     */
    classifyFile(filePath: string, content?: string): Promise<ClassificationResult>;
    /**
     * 拡張子ベース分類
     */
    private classifyByExtension;
    /**
     * ファイル内容ベース分類
     */
    private classifyByContent;
    /**
     * パスベース分類
     */
    private classifyByPath;
    /**
     * 分類結果を統合
     */
    private combineResults;
    /**
     * パターンマッチング
     */
    private matchesPattern;
    /**
     * 内容パターンマッチング
     */
    private matchesContentPattern;
    /**
     * 内容パターンのマッチ数をカウント
     */
    private countContentMatches;
    /**
     * カテゴリを抽出
     */
    private extractCategory;
    /**
     * サブカテゴリを抽出
     */
    private extractSubcategory;
    /**
     * パスを解決
     */
    private resolvePath;
    /**
     * デフォルト分類を取得
     */
    private getDefaultClassification;
    /**
     * 分類ルールを読み込み
     */
    private loadRules;
    /**
     * デフォルト分類ルールを取得
     */
    private getDefaultRules;
    /**
     * 分類ルールを更新
     */
    updateRules(rules: ClassificationRule[]): Promise<void>;
    /**
     * 信頼度を取得
     */
    getConfidence(filePath: string): Promise<number>;
    /**
     * 学習データを追加
     */
    addLearningData(filePath: string, result: ClassificationResult): void;
    /**
     * 学習データをクリア
     */
    clearLearningData(): void;
    /**
     * 統計情報を取得
     */
    getStatistics(): any;
}
