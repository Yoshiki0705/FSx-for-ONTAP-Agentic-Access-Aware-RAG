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
export type ProcessingStrategy = 
  | 'markitdown-only'      // Markitdownのみ使用
  | 'langchain-only'       // LangChainのみ使用
  | 'markitdown-first'     // Markitdown優先、失敗時LangChain
  | 'langchain-first'      // LangChain優先、失敗時Markitdown
  | 'both-compare'         // 両方実行して品質比較
  | 'auto-select';         // ファイル特性に基づく自動選択

/**
 * 処理戦略の詳細情報
 */
export const PROCESSING_STRATEGY_INFO: Record<ProcessingStrategy, {
  description: string;
  useMarkitdown: boolean;
  useLangChain: boolean;
  requiresComparison: boolean;
  priority: number;
}> = {
  'markitdown-only': {
    description: 'Markitdownライブラリのみを使用した変換',
    useMarkitdown: true,
    useLangChain: false,
    requiresComparison: false,
    priority: 1
  },
  'langchain-only': {
    description: 'LangChainローダーのみを使用した変換',
    useMarkitdown: false,
    useLangChain: true,
    requiresComparison: false,
    priority: 1
  },
  'markitdown-first': {
    description: 'Markitdown優先、失敗時LangChainフォールバック',
    useMarkitdown: true,
    useLangChain: true,
    requiresComparison: false,
    priority: 2
  },
  'langchain-first': {
    description: 'LangChain優先、失敗時Markitdownフォールバック',
    useMarkitdown: true,
    useLangChain: true,
    requiresComparison: false,
    priority: 2
  },
  'both-compare': {
    description: '両方実行して品質比較による最適選択',
    useMarkitdown: true,
    useLangChain: true,
    requiresComparison: true,
    priority: 3
  },
  'auto-select': {
    description: 'ファイル特性に基づく自動選択',
    useMarkitdown: true,
    useLangChain: true,
    requiresComparison: false,
    priority: 4
  }
} as const;

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
export type SupportedFileFormat = 
  | 'docx'  // Microsoft Word
  | 'xlsx'  // Microsoft Excel
  | 'pptx'  // Microsoft PowerPoint
  | 'pdf'   // PDF文書
  | 'png'   // PNG画像
  | 'jpg'   // JPEG画像
  | 'jpeg'  // JPEG画像
  | 'gif'   // GIF画像
  | 'html'  // HTML文書
  | 'xml'   // XML文書
  | 'csv'   // CSV文書
  | 'tsv';  // TSV文書

/**
 * ファイル形式のカテゴリ分類
 */
export const FILE_FORMAT_CATEGORIES = {
  OFFICE: ['docx', 'xlsx', 'pptx'] as const,
  DOCUMENT: ['pdf', 'html', 'xml'] as const,
  IMAGE: ['png', 'jpg', 'jpeg', 'gif'] as const,
  DATA: ['csv', 'tsv'] as const
} as const;

/**
 * ファイル形式の最大サイズ制限（バイト）
 */
export const FILE_SIZE_LIMITS: Record<SupportedFileFormat, number> = {
  docx: 50 * 1024 * 1024,  // 50MB
  xlsx: 100 * 1024 * 1024, // 100MB
  pptx: 200 * 1024 * 1024, // 200MB
  pdf: 100 * 1024 * 1024,  // 100MB
  png: 20 * 1024 * 1024,   // 20MB
  jpg: 20 * 1024 * 1024,   // 20MB
  jpeg: 20 * 1024 * 1024,  // 20MB
  gif: 10 * 1024 * 1024,   // 10MB
  html: 5 * 1024 * 1024,   // 5MB
  xml: 5 * 1024 * 1024,    // 5MB
  csv: 50 * 1024 * 1024,   // 50MB
  tsv: 50 * 1024 * 1024    // 50MB
};

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
export enum MarkitdownErrorCode {
  CONVERSION_FAILED = 'CONVERSION_FAILED',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  OCR_FAILED = 'OCR_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR'
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
export function validateMarkitdownConfig(config: Partial<MarkitdownConfig>): string[] {
  const errors: string[] = [];

  // 基本設定の検証
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    errors.push('enabled設定はboolean型である必要があります');
  }

  // サポートファイル形式の検証
  if (config.supportedFormats) {
    for (const [format, formatConfig] of Object.entries(config.supportedFormats)) {
      const formatErrors = validateFormatConfig(format, formatConfig);
      errors.push(...formatErrors);
    }
  }

  // パフォーマンス設定の検証
  if (config.performance) {
    if (config.performance.maxFileSizeBytes && config.performance.maxFileSizeBytes > 500 * 1024 * 1024) {
      errors.push('最大ファイルサイズは500MBを超えることはできません');
    }
    if (config.performance.memoryLimitMB && config.performance.memoryLimitMB > 3008) {
      errors.push('メモリ制限はLambdaの最大値3008MBを超えることはできません');
    }
    if (config.performance.maxConcurrentProcesses && config.performance.maxConcurrentProcesses > 10) {
      errors.push('最大同時処理数は10を超えることはできません');
    }
    if (config.performance.maxConcurrentProcesses && config.performance.maxConcurrentProcesses < 1) {
      errors.push('最大同時処理数は1以上である必要があります');
    }
  }

  // セキュリティ設定の検証
  if (config.security?.tempFileRetentionMinutes && config.security.tempFileRetentionMinutes > 1440) {
    errors.push('一時ファイル保持時間は24時間（1440分）を超えることはできません');
  }

  return errors;
}

/**
 * ファイル形式設定の検証
 */
function validateFormatConfig(format: string, formatConfig: FormatConfig): string[] {
  const errors: string[] = [];

  // 基本設定の検証
  if (typeof formatConfig.enabled !== 'boolean') {
    errors.push(`${format}: enabled設定はboolean型である必要があります`);
  }

  if (typeof formatConfig.timeout !== 'number' || formatConfig.timeout <= 0) {
    errors.push(`${format}: timeout設定は正の数値である必要があります`);
  }

  if (formatConfig.timeout > 900) { // Lambda最大実行時間
    errors.push(`${format}: timeout設定は900秒を超えることはできません`);
  }

  // 処理戦略の整合性検証
  const strategyInfo = PROCESSING_STRATEGY_INFO[formatConfig.processingStrategy];
  if (!strategyInfo) {
    errors.push(`${format}: 無効な処理戦略が指定されています: ${formatConfig.processingStrategy}`);
    return errors;
  }

  // useMarkitdown/useLangChainと処理戦略の整合性チェック
  if (formatConfig.useMarkitdown !== strategyInfo.useMarkitdown) {
    errors.push(`${format}: useMarkitdown設定が処理戦略と一致しません`);
  }

  if (formatConfig.useLangChain !== strategyInfo.useLangChain) {
    errors.push(`${format}: useLangChain設定が処理戦略と一致しません`);
  }

  // 品質比較設定の整合性チェック
  if (formatConfig.enableQualityComparison && !strategyInfo.requiresComparison) {
    errors.push(`${format}: 品質比較は'both-compare'戦略でのみ有効です`);
  }

  return errors;
}

/**
 * ファイル形式が有効かチェック
 */
export function isFormatEnabled(config: MarkitdownConfig, format: SupportedFileFormat): boolean {
  return config.enabled && 
         config.supportedFormats[format]?.enabled === true;
}

/**
 * ファイルサイズが制限内かチェック
 */
export function isFileSizeValid(config: MarkitdownConfig, format: SupportedFileFormat, sizeBytes: number): boolean {
  const formatLimit = FILE_SIZE_LIMITS[format];
  const globalLimit = config.performance.maxFileSizeBytes;
  return sizeBytes <= Math.min(formatLimit, globalLimit);
}

/**
 * ファイル形式に対してMarkitdownを使用するかチェック
 */
export function shouldUseMarkitdown(config: MarkitdownConfig, format: SupportedFileFormat): boolean {
  const formatConfig = config.supportedFormats[format];
  return config.enabled && 
         formatConfig?.enabled === true && 
         formatConfig?.useMarkitdown === true;
}

/**
 * ファイル形式に対してLangChainを使用するかチェック
 */
export function shouldUseLangChain(config: MarkitdownConfig, format: SupportedFileFormat): boolean {
  const formatConfig = config.supportedFormats[format];
  return formatConfig?.enabled === true && 
         formatConfig?.useLangChain === true;
}

/**
 * 処理戦略に基づいて実行順序を決定
 */
export function getProcessingOrder(config: MarkitdownConfig, format: SupportedFileFormat): ('markitdown' | 'langchain')[] {
  const formatConfig = config.supportedFormats[format];
  if (!formatConfig?.enabled) return [];

  switch (formatConfig.processingStrategy) {
    case 'markitdown-only':
      return formatConfig.useMarkitdown ? ['markitdown'] : [];
    case 'langchain-only':
      return formatConfig.useLangChain ? ['langchain'] : [];
    case 'markitdown-first':
      const markitdownFirst: ('markitdown' | 'langchain')[] = [];
      if (formatConfig.useMarkitdown) markitdownFirst.push('markitdown');
      if (formatConfig.useLangChain) markitdownFirst.push('langchain');
      return markitdownFirst;
    case 'langchain-first':
      const langchainFirst: ('markitdown' | 'langchain')[] = [];
      if (formatConfig.useLangChain) langchainFirst.push('langchain');
      if (formatConfig.useMarkitdown) langchainFirst.push('markitdown');
      return langchainFirst;
    case 'both-compare':
      const both: ('markitdown' | 'langchain')[] = [];
      if (formatConfig.useMarkitdown) both.push('markitdown');
      if (formatConfig.useLangChain) both.push('langchain');
      return both;
    case 'auto-select':
      return getAutoSelectedOrder(format);
    default:
      return [];
  }
}

/**
 * ファイル形式に基づく自動選択ロジック
 */
function getAutoSelectedOrder(format: SupportedFileFormat): ('markitdown' | 'langchain')[] {
  // Office文書: Markitdown優先
  if (FILE_FORMAT_CATEGORIES.OFFICE.includes(format as any)) {
    return ['markitdown', 'langchain'];
  }
  // 画像: Markitdownのみ（OCR機能）
  if (FILE_FORMAT_CATEGORIES.IMAGE.includes(format as any)) {
    return ['markitdown'];
  }
  // データファイル: LangChainのみ
  if (FILE_FORMAT_CATEGORIES.DATA.includes(format as any)) {
    return ['langchain'];
  }
  // その他: LangChain優先
  return ['langchain', 'markitdown'];
}

/**
 * 品質比較が必要かチェック
 */
export function shouldPerformQualityComparison(config: MarkitdownConfig, format: SupportedFileFormat): boolean {
  const formatConfig = config.supportedFormats[format];
  return formatConfig?.enableQualityComparison === true &&
         formatConfig?.processingStrategy === 'both-compare';
}

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
export function extractEmbeddingInfo(metadata: DocumentProcessingMetadata): EmbeddingProcessingInfo {
  return {
    fileName: metadata.originalFileName,
    fileFormat: metadata.fileType,
    usedMarkitdown: metadata.markitdownUsed,
    usedLangChain: metadata.langchainUsed,
    finalMethod: metadata.selectedMethod,
    strategy: metadata.processingStrategy,
    processingTime: metadata.totalConversionTime,
    qualityScore: metadata.finalQualityScore,
    processedAt: metadata.endTime
  };
}

/**
 * 処理戦略から設定を自動生成
 */
export function generateFormatConfigFromStrategy(
  strategy: ProcessingStrategy,
  timeout: number = 30,
  description: string = '',
  ocrEnabled: boolean = false
): Omit<FormatConfig, 'enabled'> {
  const strategyInfo = PROCESSING_STRATEGY_INFO[strategy];
  
  return {
    timeout,
    description,
    ocr: ocrEnabled,
    processingStrategy: strategy,
    useMarkitdown: strategyInfo.useMarkitdown,
    useLangChain: strategyInfo.useLangChain,
    enableQualityComparison: strategyInfo.requiresComparison
  };
}

/**
 * ファイル形式に推奨される処理戦略を取得
 */
export function getRecommendedStrategy(format: SupportedFileFormat): ProcessingStrategy {
  // Office文書: Markitdown優先
  if (FILE_FORMAT_CATEGORIES.OFFICE.includes(format as any)) {
    return 'markitdown-first';
  }
  
  // 画像: Markitdownのみ（OCR機能）
  if (FILE_FORMAT_CATEGORIES.IMAGE.includes(format as any)) {
    return 'markitdown-only';
  }
  
  // データファイル: LangChainのみ
  if (FILE_FORMAT_CATEGORIES.DATA.includes(format as any)) {
    return 'langchain-only';
  }
  
  // PDF: 品質比較
  if (format === 'pdf') {
    return 'both-compare';
  }
  
  // その他: LangChain優先
  return 'langchain-first';
}

/**
 * 設定の整合性を自動修正
 */
export function normalizeFormatConfig(config: FormatConfig): FormatConfig {
  const strategyInfo = PROCESSING_STRATEGY_INFO[config.processingStrategy];
  
  return {
    ...config,
    useMarkitdown: strategyInfo.useMarkitdown,
    useLangChain: strategyInfo.useLangChain,
    enableQualityComparison: strategyInfo.requiresComparison ? config.enableQualityComparison : false
  };
}

/**
 * デフォルトのMarkitdown設定
 */
export const DEFAULT_MARKITDOWN_CONFIG: MarkitdownConfig = {
  enabled: true,
  supportedFormats: {
    docx: { 
      enabled: true, 
      timeout: 30, 
      description: 'Microsoft Word文書',
      processingStrategy: 'markitdown-first',
      useMarkitdown: true,
      useLangChain: true,
      enableQualityComparison: false
    },
    xlsx: { 
      enabled: true, 
      timeout: 45, 
      description: 'Microsoft Excel文書',
      processingStrategy: 'markitdown-first',
      useMarkitdown: true,
      useLangChain: true,
      enableQualityComparison: false
    },
    pptx: { 
      enabled: true, 
      timeout: 60, 
      description: 'Microsoft PowerPoint文書',
      processingStrategy: 'markitdown-first',
      useMarkitdown: true,
      useLangChain: true,
      enableQualityComparison: false
    },
    pdf: { 
      enabled: true, 
      timeout: 120, 
      ocr: true, 
      description: 'PDF文書（OCR対応）',
      processingStrategy: 'both-compare',
      useMarkitdown: true,
      useLangChain: true,
      enableQualityComparison: true
    },
    png: { 
      enabled: true, 
      timeout: 90, 
      ocr: true, 
      description: 'PNG画像（OCR対応）',
      processingStrategy: 'markitdown-only',
      useMarkitdown: true,
      useLangChain: false,
      enableQualityComparison: false
    },
    jpg: { 
      enabled: true, 
      timeout: 90, 
      ocr: true, 
      description: 'JPEG画像（OCR対応）',
      processingStrategy: 'markitdown-only',
      useMarkitdown: true,
      useLangChain: false,
      enableQualityComparison: false
    },
    jpeg: { 
      enabled: true, 
      timeout: 90, 
      ocr: true, 
      description: 'JPEG画像（OCR対応）',
      processingStrategy: 'markitdown-only',
      useMarkitdown: true,
      useLangChain: false,
      enableQualityComparison: false
    },
    gif: { 
      enabled: true, 
      timeout: 90, 
      ocr: true, 
      description: 'GIF画像（OCR対応）',
      processingStrategy: 'markitdown-only',
      useMarkitdown: true,
      useLangChain: false,
      enableQualityComparison: false
    },
    html: { 
      enabled: true, 
      timeout: 30, 
      description: 'HTML文書',
      processingStrategy: 'langchain-first',
      useMarkitdown: true,
      useLangChain: true,
      enableQualityComparison: false
    },
    xml: { 
      enabled: true, 
      timeout: 30, 
      description: 'XML文書',
      processingStrategy: 'langchain-first',
      useMarkitdown: true,
      useLangChain: true,
      enableQualityComparison: false
    },
    csv: { 
      enabled: true, 
      timeout: 15, 
      description: 'CSV文書',
      processingStrategy: 'langchain-only',
      useMarkitdown: false,
      useLangChain: true,
      enableQualityComparison: false
    },
    tsv: { 
      enabled: true, 
      timeout: 15, 
      description: 'TSV文書',
      processingStrategy: 'langchain-only',
      useMarkitdown: false,
      useLangChain: true,
      enableQualityComparison: false
    }
  },
  performance: {
    maxFileSize: '10MB',
    maxFileSizeBytes: 10485760,
    memoryLimit: '1024MB',
    memoryLimitMB: 1024,
    parallelProcessing: true,
    maxConcurrentProcesses: 3
  },
  fallback: {
    enabled: true,
    useLangChainOnFailure: true,
    retryAttempts: 2,
    retryDelayMs: 1000
  },
  security: {
    validateFileType: true,
    validateFileSize: true,
    encryptTempFiles: true,
    autoDeleteTempFiles: true,
    tempFileRetentionMinutes: 30
  },
  logging: {
    level: 'info',
    enableDetailedLogs: true,
    enablePerformanceLogs: true,
    enableErrorTracking: true
  },
  quality: {
    ocrAccuracy: 'high',
    textExtractionQuality: 'high',
    preserveFormatting: true,
    preserveImages: false
  }
};

/**
 * 環境別デフォルト設定
 */
export const ENVIRONMENT_DEFAULTS: EnvironmentMarkitdownConfig = {
  dev: {
    logging: {
      level: 'debug',
      enableDetailedLogs: true,
      enablePerformanceLogs: true,
      enableErrorTracking: true
    },
    performance: {
      maxFileSize: '5MB',
      maxFileSizeBytes: 5242880,
      memoryLimit: '512MB',
      memoryLimitMB: 512,
      parallelProcessing: false,
      maxConcurrentProcesses: 1
    }
  },
  staging: {
    logging: {
      level: 'info',
      enableDetailedLogs: true,
      enablePerformanceLogs: true,
      enableErrorTracking: true
    },
    performance: {
      maxFileSize: '10MB',
      maxFileSizeBytes: 10485760,
      memoryLimit: '1024MB',
      memoryLimitMB: 1024,
      parallelProcessing: true,
      maxConcurrentProcesses: 2
    }
  },
  prod: {
    logging: {
      level: 'warn',
      enableDetailedLogs: false,
      enablePerformanceLogs: true,
      enableErrorTracking: true
    },
    performance: {
      maxFileSize: '50MB',
      maxFileSizeBytes: 52428800,
      memoryLimit: '3008MB',
      memoryLimitMB: 3008,
      parallelProcessing: true,
      maxConcurrentProcesses: 5
    }
  }
};