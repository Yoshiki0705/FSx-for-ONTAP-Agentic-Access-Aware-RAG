/**
 * Markitdown設定型定義
 * Microsoft Markitdownライブラリ統合用の設定インターフェース
 *
 * @version 1.0.0
 * @author Permission-aware RAG System Team
 * @since 2024-10-19
 */
/**
 * Markitdown統合設定のメインインターフェース
 */
export interface MarkitdownConfig {
    /** Markitdown機能の有効/無効 */
    enabled: boolean;
    /** サポートするファイル形式の設定 */
    supportedFormats: Record<string, FormatConfig>;
    /** パフォーマンス関連設定 */
    performance: PerformanceConfig;
    /** フォールバック機能設定 */
    fallback: FallbackConfig;
    /** セキュリティ設定 */
    security: SecurityConfig;
    /** ログ出力設定 */
    logging: LoggingConfig;
    /** 変換品質設定 */
    quality: QualityConfig;
}
/**
 * 処理方法の優先順位設定
 */
export type ProcessingStrategy = 'markitdown-only' | 'langchain-only' | 'markitdown-first' | 'langchain-first' | 'both-compare' | 'auto-select';
/**
 * 処理戦略の詳細情報
 */
export declare const PROCESSING_STRATEGY_INFO: Record<ProcessingStrategy, {
    description: string;
    useMarkitdown: boolean;
    useLangChain: boolean;
    requiresComparison: boolean;
    priority: number;
}>;
/**
 * ファイル形式別設定
 */
export interface FormatConfig {
    /** この形式の処理を有効にするか */
    enabled: boolean;
    /** 処理タイムアウト時間（秒） */
    timeout: number;
    /** OCR機能を使用するか（画像・PDF用） */
    ocr?: boolean;
    /** 形式の説明 */
    description: string;
    /** 処理方法の優先順位 */
    processingStrategy: ProcessingStrategy;
    /** Markitdownを使用するか（この形式で） */
    useMarkitdown: boolean;
    /** LangChainを使用するか（この形式で） */
    useLangChain: boolean;
    /** 品質比較を行うか */
    enableQualityComparison?: boolean;
}
/**
 * パフォーマンス設定
 */
export interface PerformanceConfig {
    /** 最大ファイルサイズ（文字列表記） */
    maxFileSize: string;
    /** 最大ファイルサイズ（バイト数） */
    maxFileSizeBytes: number;
    /** メモリ制限（文字列表記） */
    memoryLimit: string;
    /** メモリ制限（MB） */
    memoryLimitMB: number;
    /** 並列処理を有効にするか */
    parallelProcessing: boolean;
    /** 最大同時処理数 */
    maxConcurrentProcesses: number;
}
/**
 * フォールバック機能設定
 */
export interface FallbackConfig {
    /** フォールバック機能を有効にするか */
    enabled: boolean;
    /** Markitdown失敗時にLangChainを使用するか */
    useLangChainOnFailure: boolean;
    /** リトライ回数 */
    retryAttempts: number;
    /** リトライ間隔（ミリ秒） */
    retryDelayMs: number;
}
/**
 * セキュリティ設定
 */
export interface SecurityConfig {
    /** ファイルタイプ検証を行うか */
    validateFileType: boolean;
    /** ファイルサイズ検証を行うか */
    validateFileSize: boolean;
    /** 一時ファイルを暗号化するか */
    encryptTempFiles: boolean;
    /** 一時ファイルを自動削除するか */
    autoDeleteTempFiles: boolean;
    /** 一時ファイル保持時間（分） */
    tempFileRetentionMinutes: number;
    /** マルウェアスキャンを有効にするか */
    enableMalwareScan?: boolean;
    /** 許可されるMIMEタイプのリスト */
    allowedMimeTypes?: string[];
    /** ファイル内容の検証を行うか */
    validateFileContent?: boolean;
    /** セキュリティログを有効にするか */
    enableSecurityLogging?: boolean;
}
/**
 * ログ出力設定
 */
export interface LoggingConfig {
    /** ログレベル */
    level: 'debug' | 'info' | 'warn' | 'error';
    /** 詳細ログを有効にするか */
    enableDetailedLogs: boolean;
    /** パフォーマンスログを有効にするか */
    enablePerformanceLogs: boolean;
    /** エラー追跡を有効にするか */
    enableErrorTracking: boolean;
}
/**
 * 変換品質設定
 */
export interface QualityConfig {
    /** OCR精度設定 */
    ocrAccuracy: 'low' | 'medium' | 'high';
    /** テキスト抽出品質 */
    textExtractionQuality: 'low' | 'medium' | 'high';
    /** フォーマット保持するか */
    preserveFormatting: boolean;
    /** 画像を保持するか */
    preserveImages: boolean;
}
/**
 * サポートされるファイル形式の型定義
 */
export type SupportedFileFormat = 'docx' | 'xlsx' | 'pptx' | 'pdf' | 'png' | 'jpg' | 'jpeg' | 'gif' | 'html' | 'xml' | 'csv' | 'tsv';
/**
 * ファイル形式のカテゴリ分類
 */
export declare const FILE_FORMAT_CATEGORIES: {
    readonly OFFICE: readonly ["docx", "xlsx", "pptx"];
    readonly DOCUMENT: readonly ["pdf", "html", "xml"];
    readonly IMAGE: readonly ["png", "jpg", "jpeg", "gif"];
    readonly DATA: readonly ["csv", "tsv"];
};
/**
 * ファイル形式の最大サイズ制限（バイト）
 */
export declare const FILE_SIZE_LIMITS: Record<SupportedFileFormat, number>;
/**
 * 処理方法の詳細情報
 */
export interface ProcessingMethodDetails {
    /** 使用された処理方法 */
    method: 'markitdown' | 'langchain';
    /** 処理時間（ミリ秒） */
    processingTime: number;
    /** 変換後の文字数 */
    outputLength: number;
    /** 品質スコア（0-100） */
    qualityScore: number;
    /** エラー情報（存在する場合） */
    error?: MarkitdownError;
    /** 成功したか */
    success: boolean;
    /** メモリ使用量（MB） */
    memoryUsage?: number;
    /** CPU使用率（%） */
    cpuUsage?: number;
    /** 処理開始時刻 */
    startTime: string;
    /** 処理完了時刻 */
    endTime: string;
    /** 中間処理ステップの詳細 */
    processingSteps?: ProcessingStep[];
}
/**
 * 処理ステップの詳細情報
 */
export interface ProcessingStep {
    /** ステップ名 */
    stepName: string;
    /** ステップ開始時刻 */
    startTime: string;
    /** ステップ完了時刻 */
    endTime: string;
    /** ステップ実行時間（ミリ秒） */
    duration: number;
    /** ステップの成功/失敗 */
    success: boolean;
    /** ステップ固有のメタデータ */
    metadata?: Record<string, unknown>;
}
/**
 * 文書処理メタデータ
 */
export interface DocumentProcessingMetadata {
    /** 元ファイル名 */
    originalFileName: string;
    /** ファイル形式 */
    fileType: SupportedFileFormat;
    /** ファイルサイズ（バイト） */
    fileSize: number;
    /** 使用された処理戦略 */
    processingStrategy: ProcessingStrategy;
    /** 最終的に選択された処理方法 */
    selectedMethod: 'markitdown' | 'langchain';
    /** 試行された処理方法の詳細 */
    attemptedMethods: ProcessingMethodDetails[];
    /** 総変換処理時間（ミリ秒） */
    totalConversionTime: number;
    /** 変換後のマークダウン文字数 */
    markdownLength: number;
    /** 処理開始時刻 */
    startTime: string;
    /** 処理完了時刻 */
    endTime: string;
    /** エラー情報（存在する場合） */
    errors?: string[];
    /** 警告情報（存在する場合） */
    warnings?: string[];
    /** OCRが使用されたか */
    ocrUsed?: boolean;
    /** 最終的な変換品質スコア（0-100） */
    finalQualityScore?: number;
    /** Markitdownが利用されたか */
    markitdownUsed: boolean;
    /** LangChainが利用されたか */
    langchainUsed: boolean;
    /** 品質比較が実行されたか */
    qualityComparisonPerformed?: boolean;
}
/**
 * エラーコードの定義
 */
export declare enum MarkitdownErrorCode {
    CONVERSION_FAILED = "CONVERSION_FAILED",
    TIMEOUT_ERROR = "TIMEOUT_ERROR",
    FILE_TOO_LARGE = "FILE_TOO_LARGE",
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
    SECURITY_VIOLATION = "SECURITY_VIOLATION",
    MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED",
    OCR_FAILED = "OCR_FAILED",
    NETWORK_ERROR = "NETWORK_ERROR"
}
/**
 * エラー情報の詳細定義
 */
export interface MarkitdownError {
    /** エラーコード */
    code: MarkitdownErrorCode;
    /** エラーメッセージ */
    message: string;
    /** 詳細情報 */
    details?: Record<string, unknown>;
    /** エラー発生時刻 */
    timestamp: string;
    /** スタックトレース（開発環境のみ） */
    stack?: string;
}
/**
 * Markitdown処理結果
 */
export interface MarkitdownProcessingResult {
    /** 処理が成功したか */
    success: boolean;
    /** 変換されたマークダウンテキスト */
    markdownContent?: string;
    /** 処理メタデータ */
    metadata: DocumentProcessingMetadata;
    /** エラー情報（失敗時） */
    error?: MarkitdownError;
}
/**
 * 環境別Markitdown設定オーバーライド
 */
export interface EnvironmentMarkitdownConfig {
    /** 開発環境用設定 */
    dev?: Partial<MarkitdownConfig>;
    /** ステージング環境用設定 */
    staging?: Partial<MarkitdownConfig>;
    /** 本番環境用設定 */
    prod?: Partial<MarkitdownConfig>;
}
/**
 * 設定値の検証関数
 */
export declare function validateMarkitdownConfig(config: Partial<MarkitdownConfig>): string[];
/**
 * ファイル形式が有効かチェック
 */
export declare function isFormatEnabled(config: MarkitdownConfig, format: SupportedFileFormat): boolean;
/**
 * ファイルサイズが制限内かチェック
 */
export declare function isFileSizeValid(config: MarkitdownConfig, format: SupportedFileFormat, sizeBytes: number): boolean;
/**
 * ファイル形式に対してMarkitdownを使用するかチェック
 */
export declare function shouldUseMarkitdown(config: MarkitdownConfig, format: SupportedFileFormat): boolean;
/**
 * ファイル形式に対してLangChainを使用するかチェック
 */
export declare function shouldUseLangChain(config: MarkitdownConfig, format: SupportedFileFormat): boolean;
/**
 * 処理戦略に基づいて実行順序を決定
 */
export declare function getProcessingOrder(config: MarkitdownConfig, format: SupportedFileFormat): ('markitdown' | 'langchain')[];
/**
 * 品質比較が必要かチェック
 */
export declare function shouldPerformQualityComparison(config: MarkitdownConfig, format: SupportedFileFormat): boolean;
/**
 * 処理メタデータからEmbedding情報を抽出
 */
export interface EmbeddingProcessingInfo {
    /** ファイル名 */
    fileName: string;
    /** ファイル形式 */
    fileFormat: SupportedFileFormat;
    /** Markitdownが使用されたか */
    usedMarkitdown: boolean;
    /** LangChainが使用されたか */
    usedLangChain: boolean;
    /** 最終的に選択された処理方法 */
    finalMethod: 'markitdown' | 'langchain';
    /** 処理戦略 */
    strategy: ProcessingStrategy;
    /** 処理時間（ミリ秒） */
    processingTime: number;
    /** 品質スコア */
    qualityScore?: number;
    /** 処理日時 */
    processedAt: string;
}
/**
 * 処理メタデータからEmbedding情報を生成
 */
export declare function extractEmbeddingInfo(metadata: DocumentProcessingMetadata): EmbeddingProcessingInfo;
/**
 * 処理戦略から設定を自動生成
 */
export declare function generateFormatConfigFromStrategy(strategy: ProcessingStrategy, timeout?: number, description?: string, ocrEnabled?: boolean): Omit<FormatConfig, 'enabled'>;
/**
 * ファイル形式に推奨される処理戦略を取得
 */
export declare function getRecommendedStrategy(format: SupportedFileFormat): ProcessingStrategy;
/**
 * 設定の整合性を自動修正
 */
export declare function normalizeFormatConfig(config: FormatConfig): FormatConfig;
/**
 * デフォルトのMarkitdown設定
 */
export declare const DEFAULT_MARKITDOWN_CONFIG: MarkitdownConfig;
/**
 * 環境別デフォルト設定
 */
export declare const ENVIRONMENT_DEFAULTS: EnvironmentMarkitdownConfig;
