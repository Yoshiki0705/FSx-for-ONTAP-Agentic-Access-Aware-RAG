/**
 * 統合ファイル整理システム - TypeScript型定義
 * 
 * ローカル環境とEC2環境の両方で平置きファイルを整理するための
 * 型安全なインターフェースと型定義を提供します。
 */

// ============================================================================
// 基本型定義
// ============================================================================

/**
 * 実行環境の種類
 */
export type Environment = 'local' | 'ec2';

/**
 * ファイルタイプの分類
 */
export enum FileType {
  // スクリプトファイル
  SCRIPT_DEPLOYMENT = 'script_deployment',
  SCRIPT_ANALYSIS = 'script_analysis',
  SCRIPT_MAINTENANCE = 'script_maintenance',
  SCRIPT_UTILITIES = 'script_utilities',
  SCRIPT_LEGACY = 'script_legacy',
  
  // ドキュメントファイル
  DOC_TROUBLESHOOTING = 'doc_troubleshooting',
  DOC_DEPLOYMENT = 'doc_deployment',
  DOC_GUIDES = 'doc_guides',
  DOC_REPORTS = 'doc_reports',
  DOC_LEGACY = 'doc_legacy',
  
  // 設定ファイル
  CONFIG_MAIN = 'config_main',
  CONFIG_ENVIRONMENT = 'config_environment',
  CONFIG_SAMPLES = 'config_samples',
  CONFIG_LEGACY = 'config_legacy',
  
  // テストファイル
  TEST_PAYLOADS = 'test_payloads',
  TEST_UNIT = 'test_unit',
  TEST_INTEGRATION = 'test_integration',
  TEST_LEGACY = 'test_legacy',
  
  // 一時ファイル
  TEMP_WORKING = 'temp_working',
  TEMP_CACHE = 'temp_cache',
  
  // アーカイブファイル
  ARCHIVE_LEGACY = 'archive_legacy',
  ARCHIVE_PROJECTS = 'archive_projects',
  
  // セキュリティファイル
  SECURITY_KEYS = 'security_keys',
  SECURITY_SECRETS = 'security_secrets',
  
  // 不明・その他
  UNKNOWN = 'unknown'
}

/**
 * ファイル情報
 */
export interface FileInfo {
  /** ファイルの絶対パス */
  path: string;
  /** ファイル名 */
  name: string;
  /** ファイル拡張子 */
  extension: string;
  /** ファイルサイズ（バイト） */
  size: number;
  /** ファイル権限 */
  permissions: string;
  /** 最終更新日時 */
  lastModified: Date;
  /** ファイル内容（小さなファイルの場合） */
  content?: string;
  /** 実行環境 */
  environment: Environment;
  /** 相対パス */
  relativePath: string;
  /** ディレクトリかどうか */
  isDirectory: boolean;
  /** 隠しファイルかどうか */
  isHidden: boolean;
}

/**
 * 平置きファイルレポート
 */
export interface FlatFileReport {
  /** 実行環境 */
  environment: Environment;
  /** 総ファイル数 */
  totalFiles: number;
  /** タイプ別ファイル数 */
  filesByType: Map<string, FileInfo[]>;
  /** 疑わしいファイル */
  suspiciousFiles: FileInfo[];
  /** 大きなファイル */
  largeFiles: FileInfo[];
  /** スキャン実行時刻 */
  scanTime: Date;
  /** スキャン対象パス */
  scanPath: string;
}

/**
 * 構造分析結果
 */
export interface StructureAnalysis {
  /** 実行環境 */
  environment: Environment;
  /** 平置きファイル数 */
  flatFileCount: number;
  /** ディレクトリ構造 */
  directoryStructure: DirectoryNode[];
  /** 分析実行時刻 */
  analysisTime: Date;
  /** 問題のあるファイル */
  problematicFiles: FileInfo[];
}

/**
 * ディレクトリノード
 */
export interface DirectoryNode {
  /** ディレクトリ名 */
  name: string;
  /** パス */
  path: string;
  /** 子ディレクトリ */
  children: DirectoryNode[];
  /** ファイル数 */
  fileCount: number;
  /** サブディレクトリ数 */
  directoryCount: number;
}

// ============================================================================
// 分類関連型定義
// ============================================================================

/**
 * 分類結果
 */
export interface ClassificationResult {
  /** ファイル情報 */
  file: FileInfo;
  /** 分類されたファイルタイプ */
  fileType: FileType;
  /** 移動先パス */
  targetPath: string;
  /** 分類の信頼度（0-1） */
  confidence: number;
  /** 分類理由 */
  reasoning: string[];
  /** レビューが必要かどうか */
  requiresReview: boolean;
  /** 分類実行時刻 */
  classificationTime: Date;
  /** 適用されたルール */
  appliedRule: string;
}

/**
 * 分類ルール
 */
export interface ClassificationRule {
  /** ルール名 */
  name: string;
  /** 説明 */
  description: string;
  /** マッチングパターン */
  patterns: string[];
  /** 移動先パス */
  targetPath: string;
  /** ファイル権限 */
  permissions: string;
  /** 優先度（高いほど優先） */
  priority: number;
  /** 有効かどうか */
  enabled: boolean;
}

/**
 * 分類設定
 */
export interface ClassificationConfig {
  /** バージョン */
  version: string;
  /** 説明 */
  description: string;
  /** 環境設定 */
  environments: Record<Environment, EnvironmentConfig>;
  /** 分類ルール */
  classificationRules: Record<string, Record<string, ClassificationRule>>;
  /** ディレクトリ構造 */
  directoryStructure: Record<string, any>;
  /** 特別ルール */
  specialRules: SpecialRules;
  /** バリデーション設定 */
  validation: ValidationConfig;
  /** 簡易ルール（後方互換性のため） */
  rules?: Record<string, {
    patterns: string[];
    keywords: string[];
    targetDirectory: string;
    confidence: number;
  }>;
}

/**
 * 環境設定
 */
export interface EnvironmentConfig {
  /** ルートパス */
  rootPath: string;
  /** ホームディレクトリ（EC2の場合） */
  homeDirectory?: string;
  /** 除外パターン */
  excludePatterns: string[];
}

/**
 * 特別ルール
 */
export interface SpecialRules {
  /** 無視するファイル */
  ignoreFiles: string[];
  /** 保持するファイル */
  preserveFiles: string[];
  /** レビューが必要なファイル */
  requireReview: string[];
}

/**
 * バリデーション設定
 */
export interface ValidationConfig {
  /** 最大ファイルサイズ */
  maxFileSize: number;
  /** 許可される拡張子 */
  allowedExtensions: string[];
  /** 必須ディレクトリ */
  requiredDirectories: string[];
}

// ============================================================================
// ファイル操作関連型定義
// ============================================================================

/**
 * ファイル移動オプション
 */
export interface MoveOptions {
  /** バックアップを作成するかどうか */
  createBackup: boolean;
  /** 既存ファイルを上書きするかどうか */
  overwriteExisting: boolean;
  /** 権限を保持するかどうか */
  preservePermissions: boolean;
  /** ドライランモード */
  dryRun: boolean;
  /** 実行環境 */
  environment: Environment;
}

/**
 * ファイル移動結果
 */
export interface MoveResult {
  /** 移動ID */
  moveId: string;
  /** 成功したかどうか */
  success: boolean;
  /** 元のパス */
  originalPath: string;
  /** 新しいパス */
  newPath: string;
  /** バックアップパス */
  backupPath?: string;
  /** エラーメッセージ */
  error?: string;
  /** 移動実行時刻 */
  moveTime: Date;
  /** 実行環境 */
  environment: Environment;
}

/**
 * ロールバック結果
 */
export interface RollbackResult {
  /** ロールバックID */
  rollbackId: string;
  /** 成功したかどうか */
  success: boolean;
  /** 復元されたファイル数 */
  restoredFileCount: number;
  /** エラーメッセージ */
  error?: string;
  /** ロールバック実行時刻 */
  rollbackTime: Date;
  /** 実行環境 */
  environment: Environment;
}

// ============================================================================
// バックアップ関連型定義
// ============================================================================

/**
 * バックアップ結果
 */
export interface BackupResult {
  /** バックアップID */
  backupId: string;
  /** タイムスタンプ */
  timestamp: Date;
  /** バックアップされたファイル */
  files: BackupFileInfo[];
  /** 総サイズ */
  totalSize: number;
  /** 成功したかどうか */
  success: boolean;
  /** エラーメッセージ */
  error?: string;
  /** 実行環境 */
  environment: Environment;
  /** バックアップパス */
  backupPath: string;
}

/**
 * バックアップファイル情報
 */
export interface BackupFileInfo {
  /** 元のパス */
  originalPath: string;
  /** バックアップパス */
  backupPath: string;
  /** ファイルサイズ */
  size: number;
  /** チェックサム */
  checksum: string;
  /** バックアップ時刻 */
  backupTime: Date;
}

/**
 * 復元結果
 */
export interface RestoreResult {
  /** 復元ID */
  restoreId: string;
  /** 成功したかどうか */
  success: boolean;
  /** 復元されたファイル数 */
  restoredFileCount: number;
  /** 復元されたファイル */
  restoredFiles: string[];
  /** エラーメッセージ */
  error?: string;
  /** 復元実行時刻 */
  restoreTime: Date;
  /** 実行環境 */
  environment: Environment;
}

/**
 * バックアップ情報
 */
export interface BackupInfo {
  /** バックアップID */
  backupId: string;
  /** 作成日時 */
  createdAt: Date;
  /** ファイル数 */
  fileCount: number;
  /** 総サイズ */
  totalSize: number;
  /** 説明 */
  description: string;
  /** 実行環境 */
  environment: Environment;
  /** バックアップパス */
  backupPath: string;
}

// ============================================================================
// 同期関連型定義
// ============================================================================

/**
 * 構造差分
 */
export interface StructureDiff {
  /** ローカルのみに存在するファイル */
  localOnly: string[];
  /** リモートのみに存在するファイル */
  remoteOnly: string[];
  /** 異なるファイル */
  different: DiffItem[];
  /** 同一ファイル */
  identical: string[];
  /** 比較実行時刻 */
  comparisonTime: Date;
}

/**
 * 差分項目
 */
export interface DiffItem {
  /** ファイルパス */
  path: string;
  /** ローカルファイル情報 */
  localInfo: FileInfo;
  /** リモートファイル情報 */
  remoteInfo: FileInfo;
  /** 差分内容 */
  differences: string[];
}

/**
 * 同期結果
 */
export interface SyncResult {
  /** 同期ID */
  syncId: string;
  /** 成功したかどうか */
  success: boolean;
  /** 同期されたファイル数 */
  syncedFileCount: number;
  /** 同期されたファイル */
  syncedFiles: string[];
  /** エラーメッセージ */
  error?: string;
  /** 同期実行時刻 */
  syncTime: Date;
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  /** バリデーションID */
  validationId: string;
  /** 成功したかどうか */
  success: boolean;
  /** 検証されたファイル数 */
  validatedFileCount: number;
  /** エラー */
  errors: ValidationError[];
  /** 警告 */
  warnings: ValidationWarning[];
  /** バリデーション実行時刻 */
  validationTime: Date;
}

/**
 * バリデーションエラー
 */
export interface ValidationError {
  /** ファイルパス */
  filePath: string;
  /** エラーメッセージ */
  message: string;
  /** エラーコード */
  code: string;
}

/**
 * バリデーション警告
 */
export interface ValidationWarning {
  /** ファイルパス */
  filePath: string;
  /** 警告メッセージ */
  message: string;
  /** 警告コード */
  code: string;
}

// ============================================================================
// 統合実行関連型定義
// ============================================================================

/**
 * 整理結果
 */
export interface OrganizationResult {
  /** 整理ID */
  organizationId: string;
  /** 成功したかどうか */
  success: boolean;
  /** ローカル環境結果 */
  localResult: EnvironmentResult;
  /** EC2環境結果 */
  ec2Result: EnvironmentResult;
  /** 同期結果 */
  syncResult?: SyncResult;
  /** 全体レポート */
  report: OrganizationReport;
  /** バックアップ情報 */
  backups: Record<Environment, BackupResult>;
  /** 実行時間 */
  executionTime: number;
  /** 開始時刻 */
  startTime: Date;
  /** 終了時刻 */
  endTime: Date;
}

/**
 * 環境別結果
 */
export interface EnvironmentResult {
  /** 実行環境 */
  environment: Environment;
  /** 成功したかどうか */
  success: boolean;
  /** 処理されたファイル数 */
  processedFileCount: number;
  /** 移動されたファイル数 */
  movedFileCount: number;
  /** 平置きファイル数（処理前） */
  flatFilesBefore: number;
  /** 平置きファイル数（処理後） */
  flatFilesAfter: number;
  /** 分類結果 */
  classificationResults: ClassificationResult[];
  /** 移動結果 */
  moveResults: MoveResult[];
  /** エラー */
  errors: string[];
}

/**
 * 整理レポート
 */
export interface OrganizationReport {
  /** レポートID */
  reportId: string;
  /** 生成時刻 */
  generatedAt: Date;
  /** サマリー */
  summary: OrganizationSummary;
  /** 詳細結果 */
  details: OrganizationDetails;
  /** 推奨事項 */
  recommendations: string[];
}

/**
 * 整理サマリー
 */
export interface OrganizationSummary {
  /** 総処理ファイル数 */
  totalProcessedFiles: number;
  /** 総移動ファイル数 */
  totalMovedFiles: number;
  /** 平置きファイル削減数 */
  flatFilesReduced: number;
  /** 成功率 */
  successRate: number;
  /** 実行時間 */
  executionTime: number;
  /** Agent Steering準拠率 */
  complianceRate: number;
}

/**
 * 整理詳細
 */
export interface OrganizationDetails {
  /** 環境別詳細 */
  environmentDetails: Record<Environment, EnvironmentDetails>;
  /** ファイルタイプ別統計 */
  fileTypeStatistics: Record<FileType, number>;
  /** エラー詳細 */
  errorDetails: ErrorDetail[];
}

/**
 * 環境別詳細
 */
export interface EnvironmentDetails {
  /** 実行環境 */
  environment: Environment;
  /** 処理前状態 */
  beforeState: EnvironmentState;
  /** 処理後状態 */
  afterState: EnvironmentState;
  /** 移動されたファイル */
  movedFiles: MovedFileInfo[];
}

/**
 * 環境状態
 */
export interface EnvironmentState {
  /** 平置きファイル数 */
  flatFileCount: number;
  /** 総ファイル数 */
  totalFileCount: number;
  /** ディレクトリ数 */
  directoryCount: number;
  /** 総サイズ */
  totalSize: number;
}

/**
 * 移動されたファイル情報
 */
export interface MovedFileInfo {
  /** 元のパス */
  originalPath: string;
  /** 新しいパス */
  newPath: string;
  /** ファイルタイプ */
  fileType: FileType;
  /** 移動理由 */
  reason: string;
}

/**
 * エラー詳細
 */
export interface ErrorDetail {
  /** エラーコード */
  code: string;
  /** エラーメッセージ */
  message: string;
  /** ファイルパス */
  filePath?: string;
  /** 実行環境 */
  environment?: Environment;
  /** 発生時刻 */
  timestamp: Date;
}

// ============================================================================
// インターフェース定義
// ============================================================================

/**
 * ファイルスキャナーインターフェース
 */
export interface FileScanner {
  /**
   * ディレクトリをスキャンしてファイル情報を取得
   */
  scanDirectory(path: string): Promise<FileInfo[]>;
  
  /**
   * 平置きファイルを検出
   */
  detectFlatFiles(rootPath: string): Promise<FlatFileReport>;
  
  /**
   * ファイル構造を分析
   */
  analyzeFileStructure(path: string): Promise<StructureAnalysis>;
}

/**
 * ファイル分類器インターフェース
 */
export interface FileClassifier {
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
}

/**
 * ファイル移動器インターフェース
 */
export interface FileMover {
  /**
   * ファイルを移動
   */
  moveFile(source: string, target: string, options: MoveOptions): Promise<MoveResult>;
  
  /**
   * ディレクトリ構造を作成
   */
  createDirectoryStructure(basePath: string): Promise<void>;
  
  /**
   * ファイル権限を設定
   */
  setFilePermissions(filePath: string, permissions: string): Promise<void>;
  
  /**
   * 移動をロールバック
   */
  rollbackMove(moveId: string): Promise<RollbackResult>;
}

/**
 * バックアップマネージャーインターフェース
 */
export interface BackupManager {
  /**
   * バックアップを作成
   */
  createBackup(files: string[], backupId: string): Promise<BackupResult>;
  
  /**
   * バックアップを復元
   */
  restoreBackup(backupId: string): Promise<RestoreResult>;
  
  /**
   * バックアップ一覧を取得
   */
  listBackups(): Promise<BackupInfo[]>;
  
  /**
   * 古いバックアップを削除
   */
  cleanupOldBackups(retentionDays: number): Promise<void>;
}

/**
 * 同期マネージャーインターフェース
 */
export interface SyncManager {
  /**
   * 構造を比較
   */
  compareStructures(localPath: string, remotePath: string): Promise<StructureDiff>;
  
  /**
   * 構造を同期
   */
  syncStructures(diff: StructureDiff): Promise<SyncResult>;
  
  /**
   * 同期を検証
   */
  validateSync(localPath: string, remotePath: string): Promise<ValidationResult>;
}

/**
 * 統合実行エンジンインターフェース
 */
export interface IntegratedExecutionEngine {
  /**
   * 完全な整理を実行
   */
  executeFullOrganization(): Promise<OrganizationResult>;
  
  /**
   * 環境別整理を実行
   */
  executeEnvironmentOrganization(environment: Environment): Promise<EnvironmentResult>;
  
  /**
   * 進捗を取得
   */
  getProgress(): Promise<ExecutionProgress>;
}

/**
 * 実行進捗
 */
export interface ExecutionProgress {
  /** 進捗ID */
  progressId: string;
  /** 現在のフェーズ */
  currentPhase: string;
  /** 進捗率（0-100） */
  progressPercentage: number;
  /** 処理済みファイル数 */
  processedFiles: number;
  /** 総ファイル数 */
  totalFiles: number;
  /** 開始時刻 */
  startTime: Date;
  /** 推定残り時間（秒） */
  estimatedRemainingTime?: number;
  /** 現在の操作 */
  currentOperation: string;
}

/**
 * 実行オプション
 */
export interface ExecutionOptions {
  /** 対象ディレクトリ */
  targetDirectory: string;
  /** ドライランモード */
  dryRun: boolean;
  /** バックアップを作成するかどうか */
  createBackup: boolean;
  /** 既存ファイルを上書きするかどうか */
  overwriteExisting: boolean;
  /** 権限を保持するかどうか */
  preservePermissions: boolean;
  /** 並列処理を使用するかどうか */
  parallelProcessing: boolean;
  /** 実行環境 */
  environment?: Environment;
  /** 詳細ログを出力するかどうか */
  verbose?: boolean;
}

/**
 * 実行結果
 */
export interface ExecutionResult {
  /** 実行ID */
  executionId: string;
  /** 成功したかどうか */
  success: boolean;
  /** ドライランモードだったかどうか */
  dryRun: boolean;
  /** 処理されたファイル数 */
  processedFiles: number;
  /** 移動されたファイル数 */
  movedFiles: number;
  /** 失敗したファイル数 */
  failedFiles: number;
  /** バックアップが作成されたかどうか */
  backupCreated: boolean;
  /** バックアップパス */
  backupPath?: string;
  /** 実行時間（ミリ秒） */
  duration: number;
  /** エラーメッセージ */
  errors?: string[];
  /** 警告メッセージ */
  warnings?: string[];
  /** 分類結果 */
  classificationResults?: Record<string, number>;
  /** ネットワーク転送回数（EC2の場合） */
  networkTransfers?: number;
  /** SSH接続回数（EC2の場合） */
  sshConnections?: number;
  /** 実行開始時刻 */
  startTime: Date;
  /** 実行終了時刻 */
  endTime: Date;
}

// ============================================================================
// エラー型定義
// ============================================================================

/**
 * 整理エラーの種類
 */
export enum OrganizationErrorType {
  SCAN_FAILED = 'SCAN_FAILED',
  CLASSIFICATION_FAILED = 'CLASSIFICATION_FAILED',
  BACKUP_FAILED = 'BACKUP_FAILED',
  MOVE_FAILED = 'MOVE_FAILED',
  PERMISSION_FAILED = 'PERMISSION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  SYNC_FAILED = 'SYNC_FAILED',
  SSH_CONNECTION_FAILED = 'SSH_CONNECTION_FAILED',
  ROLLBACK_FAILED = 'ROLLBACK_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 整理エラー
 */
export class OrganizationError extends Error {
  constructor(
    public readonly type: OrganizationErrorType,
    public readonly message: string,
    public readonly filePath?: string,
    public readonly environment?: Environment,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'OrganizationError';
  }
}

// ============================================================================
// ユーティリティ型
// ============================================================================

/**
 * 部分的な型（一部のプロパティのみ必須）
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * 必須の型（一部のプロパティを必須に）
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * 環境固有の設定
 */
export type EnvironmentSpecific<T> = Record<Environment, T>;

/**
 * ファイルタイプ固有の設定
 */
export type FileTypeSpecific<T> = Record<FileType, T>;