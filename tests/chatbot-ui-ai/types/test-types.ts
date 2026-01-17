/**
 * Chatbot UI AI統合テスト用の型定義
 * 
 * テスト結果、設定、レポート等の型安全性を確保するための包括的な型定義
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

/**
 * テスト実行ステータス
 */
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'running';

/**
 * テストカテゴリ
 */
export type TestCategory = 'UI' | 'AI' | 'RAG' | 'Security' | 'Performance' | 'Integration' | 'Nova Integration' | 'Multi-Region';

/**
 * テスト重要度レベル
 */
export type TestPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * 個別テスト結果
 */
export interface TestResult {
  /** テスト名 */
  testName: string;
  
  /** テストカテゴリ */
  category: TestCategory;
  
  /** 実行ステータス */
  status: TestStatus;
  
  /** 実行時間（ミリ秒） */
  duration: number;
  
  /** エラーメッセージ（失敗時） */
  error?: string;
  
  /** 実行タイムスタンプ */
  timestamp: Date;
  
  /** 詳細情報 */
  details?: Record<string, any>;
  
  /** テスト重要度 */
  priority?: TestPriority;
  
  /** 期待値 */
  expected?: any;
  
  /** 実際の値 */
  actual?: any;
  
  /** スクリーンショット（UIテスト用） */
  screenshot?: string;
  
  /** パフォーマンスメトリクス */
  metrics?: PerformanceMetrics;
}

/**
 * 統合テスト結果
 */
export interface IntegratedTestResult {
  /** テスト結果サマリー */
  summary: TestSummary;
  
  /** 個別テスト結果 */
  results: TestResult[];
  
  /** カテゴリ別結果 */
  categories: Record<string, CategoryResult>;
  
  /** 実行タイムスタンプ */
  timestamp: Date;
  
  /** テスト設定 */
  configuration: TestConfiguration;
  
  /** 実行環境 */
  environment: string;
  
  /** UX分析結果（手動ブラウザテスト用） */
  uxAnalysis?: UXAnalysisResult;
  
  /** エラー情報（全体的なエラー時） */
  error?: string;
}

/**
 * テスト結果サマリー
 */
export interface TestSummary {
  /** 総テスト数 */
  totalTests: number;
  
  /** 成功テスト数 */
  passed: number;
  
  /** 失敗テスト数 */
  failed: number;
  
  /** スキップテスト数 */
  skipped: number;
  
  /** 総実行時間（ミリ秒） */
  totalDuration: number;
  
  /** 成功率（%） */
  successRate: number;
  
  /** 実行ステータス */
  status?: TestStatus;
  
  /** エラー情報（全体的なエラー時） */
  error?: string;
  
  /** 成功テスト数（別名） */
  passedTests?: number;
  
  /** 失敗テスト数（別名） */
  failedTests?: number;
  
  /** スキップテスト数（別名） */
  skippedTests?: number;
  
  /** 実行時間（ミリ秒）（別名） */
  duration?: number;
  
  /** 開始時刻 */
  startTime?: Date;
  
  /** 終了時刻 */
  endTime?: Date;
  
  /** カテゴリ別統計 */
  categoryStats?: Record<string, CategoryResult>;
  
  /** 優先度別統計 */
  priorityStats?: Record<string, CategoryResult>;
  
  /** 個別テスト結果 */
  testResults?: TestResult[];
}

/**
 * カテゴリ別結果
 */
export interface CategoryResult {
  /** カテゴリ内総テスト数 */
  total: number;
  
  /** カテゴリ内成功テスト数 */
  passed: number;
  
  /** カテゴリ内失敗テスト数 */
  failed: number;
  
  /** カテゴリ内スキップテスト数 */
  skipped: number;
  
  /** カテゴリ内成功率（%） */
  successRate: number;
  
  /** カテゴリ固有メトリクス */
  metrics?: Record<string, any>;
}

/**
 * UX分析結果
 */
export interface UXAnalysisResult {
  /** UI要素配置分析 */
  uiElementAnalysis: UIElementAnalysis;
  
  /** 操作フロー分析 */
  operationFlowAnalysis: OperationFlowAnalysis;
  
  /** エラー状態分析 */
  errorStateAnalysis: ErrorStateAnalysis;
  
  /** パフォーマンス影響分析 */
  performanceImpactAnalysis: PerformanceImpactAnalysis;
  
  /** 改善提案 */
  improvementSuggestions: ImprovementSuggestion[];
  
  /** 総合UXスコア */
  overallUXScore: number;
}

/**
 * UI要素配置分析
 */
export interface UIElementAnalysis {
  /** 要素配置の適切性 */
  elementPlacementScore: number;
  
  /** アクセシビリティスコア */
  accessibilityScore: number;
  
  /** レスポンシブ対応スコア */
  responsiveScore: number;
  
  /** 問題のある要素 */
  problematicElements: UIElement[];
}

/**
 * 操作フロー分析
 */
export interface OperationFlowAnalysis {
  /** フロー効率性スコア */
  flowEfficiencyScore: number;
  
  /** 平均操作時間 */
  averageOperationTime: number;
  
  /** ボトルネック操作 */
  bottleneckOperations: Operation[];
  
  /** 推奨フロー改善 */
  recommendedFlowImprovements: FlowImprovement[];
}

/**
 * エラー状態分析
 */
export interface ErrorStateAnalysis {
  /** エラーハンドリング品質スコア */
  errorHandlingScore: number;
  
  /** エラーメッセージ明確性スコア */
  errorMessageClarityScore: number;
  
  /** 復旧可能性スコア */
  recoverabilityScore: number;
  
  /** 検出されたエラー状態 */
  detectedErrorStates: ErrorState[];
}

/**
 * パフォーマンス影響分析
 */
export interface PerformanceImpactAnalysis {
  /** レンダリングパフォーマンススコア */
  renderingPerformanceScore: number;
  
  /** インタラクション応答性スコア */
  interactionResponsivenessScore: number;
  
  /** リソース使用効率スコア */
  resourceEfficiencyScore: number;
  
  /** パフォーマンスボトルネック */
  performanceBottlenecks: PerformanceBottleneck[];
}

/**
 * 改善提案
 */
export interface ImprovementSuggestion {
  /** 提案カテゴリ */
  category: 'UI' | 'UX' | 'Performance' | 'Accessibility' | 'Security';
  
  /** 重要度 */
  priority: TestPriority;
  
  /** 提案タイトル */
  title: string;
  
  /** 提案詳細 */
  description: string;
  
  /** 期待される効果 */
  expectedImpact: string;
  
  /** 実装難易度 */
  implementationDifficulty: 'easy' | 'medium' | 'hard';
  
  /** 推定工数（時間） */
  estimatedEffort: number;
}

/**
 * テスト設定
 */
export interface TestConfiguration {
  /** UI設定 */
  ui: UITestConfig;
  
  /** AI設定 */
  ai: AITestConfig;
  
  /** RAG設定 */
  rag: RAGTestConfig;
  
  /** セキュリティ設定 */
  security: SecurityTestConfig;
  
  /** パフォーマンス設定 */
  performance: PerformanceTestConfig;
  
  /** 環境設定 */
  environment: EnvironmentConfig;
}

/**
 * UI テスト設定
 */
export interface UITestConfig {
  /** レスポンシブテスト有効化 */
  enableResponsiveTests: boolean;
  
  /** アクセシビリティテスト有効化 */
  enableAccessibilityTests: boolean;
  
  /** ブラウザタイムアウト（ミリ秒） */
  browserTimeout: number;
  
  /** テスト対象ブラウザ */
  targetBrowsers?: string[];
  
  /** スクリーンショット取得 */
  captureScreenshots?: boolean;
  
  /** ビューポートサイズ */
  viewportSizes?: ViewportSize[];
}

/**
 * AI テスト設定
 */
export interface AITestConfig {
  /** 日本語テスト有効化 */
  enableJapaneseTests: boolean;
  
  /** ストリーミングテスト有効化 */
  enableStreamingTests: boolean;
  
  /** Bedrockリージョン */
  bedrockRegion: string;
  
  /** モデルタイムアウト（ミリ秒） */
  modelTimeout: number;
  
  /** テスト対象モデル */
  targetModels?: string[];
  
  /** 応答品質閾値 */
  qualityThreshold?: number;
}

/**
 * RAG テスト設定
 */
export interface RAGTestConfig {
  /** コンテキスト統合テスト有効化 */
  enableContextIntegrationTests: boolean;
  
  /** ベクトル検索テスト有効化 */
  enableVectorSearchTests: boolean;
  
  /** 検索タイムアウト（ミリ秒） */
  searchTimeout: number;
  
  /** 検索精度閾値 */
  accuracyThreshold?: number;
  
  /** テストデータセット */
  testDataset?: string;
}

/**
 * セキュリティ テスト設定
 */
export interface SecurityTestConfig {
  /** 認証セッションテスト有効化 */
  enableAuthSessionTests: boolean;
  
  /** SIDテスト有効化 */
  enableSIDTests: boolean;
  
  /** セキュリティタイムアウト（ミリ秒） */
  securityTimeout: number;
  
  /** テスト用ユーザー */
  testUsers?: TestUser[];
  
  /** 権限テストケース */
  permissionTestCases?: PermissionTestCase[];
}

/**
 * パフォーマンス テスト設定
 */
export interface PerformanceTestConfig {
  /** スケーラビリティテスト有効化 */
  enableScalabilityTests: boolean;
  
  /** 負荷テスト有効化 */
  enableLoadTests: boolean;
  
  /** 最大応答時間（ミリ秒） */
  maxResponseTime: number;
  
  /** 最大ストリーミング開始時間（ミリ秒） */
  maxStreamingStartTime: number;
  
  /** 同時ユーザー数 */
  concurrentUsers?: number;
  
  /** 負荷テスト継続時間（秒） */
  loadTestDuration?: number;
}

/**
 * 環境設定
 */
export interface EnvironmentConfig {
  /** テストデータパス */
  testDataPath: string;
  
  /** 出力パス */
  outputPath: string;
  
  /** ログレベル */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  /** 並列実行数 */
  parallelExecutions?: number;
  
  /** リトライ回数 */
  retryCount?: number;
}

/**
 * テストレポート
 */
export interface TestReport {
  /** レポートタイトル */
  title: string;
  
  /** 生成日時 */
  generatedAt: Date;
  
  /** テスト結果サマリー */
  summary: TestSummary;
  
  /** カテゴリ別結果 */
  categories: Record<string, CategoryResult>;
  
  /** 詳細テスト結果 */
  details: TestResult[];
  
  /** テスト設定 */
  configuration: TestConfiguration;
  
  /** 実行環境情報 */
  environment: EnvironmentInfo;
  
  /** 推奨事項 */
  recommendations: string[];
  
  /** 添付ファイル（スクリーンショット等） */
  attachments?: Attachment[];
}

/**
 * パフォーマンスメトリクス
 */
export interface PerformanceMetrics {
  /** 応答時間（ミリ秒） */
  responseTime: number;
  
  /** スループット（req/sec） */
  throughput?: number;
  
  /** CPU使用率（%） */
  cpuUsage?: number;
  
  /** メモリ使用量（MB） */
  memoryUsage?: number;
  
  /** ネットワーク使用量（KB） */
  networkUsage?: number;
}

/**
 * UI要素
 */
export interface UIElement {
  /** 要素ID */
  id: string;
  
  /** 要素タイプ */
  type: string;
  
  /** 要素位置 */
  position: Position;
  
  /** 要素サイズ */
  size: Size;
  
  /** 問題の説明 */
  issue: string;
  
  /** 重要度 */
  severity: TestPriority;
}

/**
 * 操作
 */
export interface Operation {
  /** 操作名 */
  name: string;
  
  /** 操作時間（ミリ秒） */
  duration: number;
  
  /** 操作ステップ */
  steps: OperationStep[];
  
  /** 問題の説明 */
  issue?: string;
}

/**
 * フロー改善
 */
export interface FlowImprovement {
  /** 改善対象フロー */
  targetFlow: string;
  
  /** 改善提案 */
  suggestion: string;
  
  /** 期待される効果 */
  expectedImprovement: string;
  
  /** 実装優先度 */
  priority: TestPriority;
}

/**
 * エラー状態
 */
export interface ErrorState {
  /** エラータイプ */
  type: string;
  
  /** エラーメッセージ */
  message: string;
  
  /** 発生頻度 */
  frequency: number;
  
  /** 重要度 */
  severity: TestPriority;
  
  /** 復旧方法 */
  recoveryMethod?: string;
}

/**
 * パフォーマンスボトルネック
 */
export interface PerformanceBottleneck {
  /** ボトルネック箇所 */
  location: string;
  
  /** 影響度 */
  impact: number;
  
  /** 原因 */
  cause: string;
  
  /** 改善提案 */
  suggestion: string;
}

/**
 * ビューポートサイズ
 */
export interface ViewportSize {
  /** 幅 */
  width: number;
  
  /** 高さ */
  height: number;
  
  /** デバイス名 */
  deviceName: string;
}

/**
 * テストユーザー
 */
export interface TestUser {
  /** ユーザーID */
  userId: string;
  
  /** ユーザー名 */
  username: string;
  
  /** 権限レベル */
  permissions: string[];
  
  /** グループ */
  groups: string[];
}

/**
 * 権限テストケース
 */
export interface PermissionTestCase {
  /** テストケース名 */
  name: string;
  
  /** 対象リソース */
  resource: string;
  
  /** 期待される権限 */
  expectedPermissions: string[];
  
  /** テストユーザー */
  testUser: string;
}

/**
 * 実行環境情報
 */
export interface EnvironmentInfo {
  /** Node.jsバージョン */
  nodeVersion: string;
  
  /** プラットフォーム */
  platform: string;
  
  /** 環境名 */
  environment: string;
  
  /** タイムスタンプ */
  timestamp: Date;
  
  /** 追加情報 */
  additionalInfo?: Record<string, any>;
}

/**
 * 添付ファイル
 */
export interface Attachment {
  /** ファイル名 */
  filename: string;
  
  /** ファイルパス */
  path: string;
  
  /** ファイルタイプ */
  type: 'screenshot' | 'log' | 'report' | 'other';
  
  /** 説明 */
  description?: string;
}

/**
 * 位置
 */
export interface Position {
  /** X座標 */
  x: number;
  
  /** Y座標 */
  y: number;
}

/**
 * サイズ
 */
export interface Size {
  /** 幅 */
  width: number;
  
  /** 高さ */
  height: number;
}

/**
 * 操作ステップ
 */
export interface OperationStep {
  /** ステップ名 */
  name: string;
  
  /** 実行時間（ミリ秒） */
  duration: number;
  
  /** ステップの説明 */
  description?: string;
}

/**
 * 検証結果
 */
export interface ValidationResult {
  /** 検証成功フラグ */
  isValid: boolean;
  
  /** エラーメッセージ */
  errors: string[];
  
  /** 警告メッセージ */
  warnings: string[];
}

/**
 * テスト実行コンテキスト
 */
export interface TestExecutionContext {
  /** 実行ID */
  executionId: string;
  
  /** 開始時刻 */
  startTime: Date;
  
  /** 実行者 */
  executor: string;
  
  /** 実行環境 */
  environment: string;
  
  /** 設定 */
  configuration: TestConfiguration;
}

/**
 * エラー詳細情報
 */
export interface ErrorDetails {
  /** エラーコード */
  code: string;
  
  /** エラーメッセージ */
  message: string;
  
  /** スタックトレース */
  stack?: string;
  
  /** 追加情報 */
  additionalInfo?: Record<string, any>;
}

export default {
  TestResult,
  IntegratedTestResult,
  UXAnalysisResult,
  TestConfiguration,
  TestReport
};