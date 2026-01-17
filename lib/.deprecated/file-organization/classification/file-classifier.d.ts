/**
 * 統合ファイル整理システム - ファイル分類器
 *
 * パターンマッチングエンジンを使用してファイルを分類し、
 * 適切なターゲットパスを決定する機能を提供します。
 */
import { FileClassifier as IFileClassifier, FileInfo, ClassificationResult, FileType, ClassificationConfig, Environment } from '../types/index.js';
/**
 * ファイル分類器
 *
 * ファイルの性質を分析し、適切なカテゴリとターゲットパスを決定します。
 * 分類信頼度の計算と結果の検証機能も提供します。
 */
export declare class FileClassifier implements IFileClassifier {
    private readonly patternMatcher;
    private readonly config;
    private readonly environment;
    constructor(config: ClassificationConfig, environment: Environment);
    /**
     * ファイルを分類
     */
    classifyFile(file: FileInfo): Promise<ClassificationResult>;
    /**
     * ターゲットパスを決定
     */
    determineTargetPath(file: FileInfo, classification: FileType): string;
    /**
     * 分類結果を検証
     */
    validateClassification(file: FileInfo, classification: ClassificationResult): boolean;
    /**
     * 複数ファイルの一括分類
     */
    classifyFiles(files: FileInfo[]): Promise<ClassificationResult[]>;
    /**
     * 分類統計を生成
     */
    generateClassificationStatistics(results: ClassificationResult[]): {
        totalFiles: number;
        byFileType: Record<FileType, number>;
        byConfidence: Record<string, number>;
        requiresReview: number;
        averageConfidence: number;
    };
    /**
     * 無視すべきファイルかどうかを判定
     */
    private shouldIgnore;
    /**
     * 保持すべきファイルかどうかを判定
     */
    private shouldPreserve;
    /**
     * レビューが必要かどうかを判定
     */
    private shouldRequireReview;
    /**
     * ファイルタイプを決定
     */
    private determineFileType;
    /**
     * ルールのカテゴリを見つける
     */
    private findRuleCategory;
    /**
     * ベースターゲットパスを取得
     */
    private getBaseTargetPath;
    /**
     * 環境に応じたパス調整
     */
    private adjustPathForEnvironment;
    /**
     * 重複パスの解決
     */
    private resolveDuplicatePath;
    /**
     * ファイルタイプの整合性チェック
     */
    private isFileTypeConsistent;
    /**
     * ターゲットパスの妥当性チェック
     */
    private isTargetPathValid;
    /**
     * 権限設定の妥当性チェック
     */
    private arePermissionsValid;
    /**
     * 機密ファイルかどうかを判定
     */
    private isSensitiveFile;
    /**
     * 信頼度を調整
     */
    private adjustConfidence;
    /**
     * 分類理由を構築
     */
    private buildReasoning;
    /**
     * パターンマッチング
     */
    private matchesPattern;
    /**
     * 無視結果を作成
     */
    private createIgnoreResult;
    /**
     * 保持結果を作成
     */
    private createPreserveResult;
    /**
     * 不明結果を作成
     */
    private createUnknownResult;
}
