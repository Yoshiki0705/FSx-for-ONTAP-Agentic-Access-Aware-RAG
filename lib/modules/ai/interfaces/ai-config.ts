/**
 * AIモジュール設定インターフェース
 * 
 * 機能:
 * - Bedrock・Embedding・Model設定の型定義
 * - AI/MLパイプライン・ガードレール設定
 * - パフォーマンス・コスト最適化設定
 */

/**
 * Bedrock設定
 */
export interface BedrockConfig {
  /** Bedrock有効化 */
  readonly enabled: boolean;
  
  /** 利用可能モデル */
  readonly models: BedrockModelsConfig;
  
  /** ガードレール設定 */
  readonly guardrails?: BedrockGuardrailsConfig;
  
  /** 推論設定 */
  readonly inference?: BedrockInferenceConfig;
  
  /** ファインチューニング設定 */
  readonly fineTuning?: BedrockFineTuningConfig;
  
  /** 監視設定 */
  readonly monitoring?: BedrockMonitoringConfig;
}

/**
 * Bedrockモデル設定
 */
export interface BedrockModelsConfig {
  /** Claude 3 Sonnet */
  readonly claude3Sonnet?: boolean;
  
  /** Claude 3 Haiku */
  readonly claude3Haiku?: boolean;
  
  /** Claude 3 Opus */
  readonly claude3Opus?: boolean;
  
  /** Titan Embeddings */
  readonly titanEmbeddings?: boolean;
  
  /** Titan Text */
  readonly titanText?: boolean;
  
  /** Jurassic-2 */
  readonly jurassic2?: boolean;
  
  /** カスタムモデル */
  readonly customModels?: BedrockCustomModel[];
}

/**
 * Bedrockカスタムモデル
 */
export interface BedrockCustomModel {
  /** モデル名 */
  readonly modelName: string;
  
  /** モデルARN */
  readonly modelArn: string;
  
  /** 説明 */
  readonly description?: string;
  
  /** 推論設定 */
  readonly inferenceConfig?: BedrockModelInferenceConfig;
}

/**
 * Bedrockガードレール設定
 */
export interface BedrockGuardrailsConfig {
  /** ガードレール有効化 */
  readonly enabled: boolean;
  
  /** コンテンツフィルタリング */
  readonly contentFiltering?: boolean;
  
  /** 有害コンテンツ検出 */
  readonly toxicityDetection?: BedrockToxicityConfig;
  
  /** PII検出・マスキング */
  readonly piiDetection?: BedrockPiiConfig;
  
  /** カスタムフィルター */
  readonly customFilters?: BedrockCustomFilter[];
  
  /** コンプライアンス設定 */
  readonly complianceFiltering?: boolean;
}

/**
 * Bedrock有害コンテンツ検出設定
 */
export interface BedrockToxicityConfig {
  /** 有効化 */
  readonly enabled: boolean;
  
  /** 閾値 */
  readonly threshold: number;
  
  /** アクション */
  readonly action: 'BLOCK' | 'WARN' | 'LOG';
}

/**
 * Bedrock PII設定
 */
export interface BedrockPiiConfig {
  /** PII検出有効化 */
  readonly enabled: boolean;
  
  /** マスキング有効化 */
  readonly masking?: boolean;
  
  /** 検出対象PII種別 */
  readonly piiTypes?: string[];
  
  /** アクション */
  readonly action: 'BLOCK' | 'MASK' | 'LOG';
}

/**
 * Bedrockカスタムフィルター
 */
export interface BedrockCustomFilter {
  /** フィルター名 */
  readonly filterName: string;
  
  /** パターン */
  readonly pattern: string;
  
  /** アクション */
  readonly action: 'BLOCK' | 'WARN' | 'LOG';
  
  /** 説明 */
  readonly description?: string;
}

/**
 * Bedrock推論設定
 */
export interface BedrockInferenceConfig {
  /** デフォルトパラメータ */
  readonly defaultParameters?: BedrockModelParameters;
  
  /** バッチ推論 */
  readonly batchInference?: BedrockBatchInferenceConfig;
  
  /** ストリーミング */
  readonly streaming?: boolean;
  
  /** キャッシュ設定 */
  readonly caching?: BedrockCacheConfig;
}

/**
 * Bedrockモデルパラメータ
 */
export interface BedrockModelParameters {
  /** 温度 */
  readonly temperature?: number;
  
  /** 最大トークン数 */
  readonly maxTokens?: number;
  
  /** Top P */
  readonly topP?: number;
  
  /** Top K */
  readonly topK?: number;
  
  /** 停止シーケンス */
  readonly stopSequences?: string[];
}

/**
 * Bedrockバッチ推論設定
 */
export interface BedrockBatchInferenceConfig {
  /** 有効化 */
  readonly enabled: boolean;
  
  /** バッチサイズ */
  readonly batchSize?: number;
  
  /** 入力S3バケット */
  readonly inputS3Bucket?: string;
  
  /** 出力S3バケット */
  readonly outputS3Bucket?: string;
}

/**
 * Bedrockキャッシュ設定
 */
export interface BedrockCacheConfig {
  /** キャッシュ有効化 */
  readonly enabled: boolean;
  
  /** TTL（秒） */
  readonly ttlSeconds?: number;
  
  /** キャッシュキー戦略 */
  readonly keyStrategy?: 'HASH' | 'FULL';
}/**

 * Bedrockファインチューニング設定
 */
export interface BedrockFineTuningConfig {
  /** ファインチューニング有効化 */
  readonly enabled: boolean;
  
  /** ベースモデル */
  readonly baseModel: string;
  
  /** トレーニングデータS3パス */
  readonly trainingDataS3Path?: string;
  
  /** 検証データS3パス */
  readonly validationDataS3Path?: string;
  
  /** ハイパーパラメータ */
  readonly hyperParameters?: BedrockHyperParameters;
  
  /** 出力S3パス */
  readonly outputS3Path?: string;
}

/**
 * Bedrockハイパーパラメータ
 */
export interface BedrockHyperParameters {
  /** エポック数 */
  readonly epochs?: number;
  
  /** 学習率 */
  readonly learningRate?: number;
  
  /** バッチサイズ */
  readonly batchSize?: number;
  
  /** ウォームアップステップ */
  readonly warmupSteps?: number;
}

/**
 * Bedrock監視設定
 */
export interface BedrockMonitoringConfig {
  /** CloudWatchメトリクス */
  readonly cloudWatchMetrics: boolean;
  
  /** 使用量監視 */
  readonly usageMonitoring?: boolean;
  
  /** コスト監視 */
  readonly costMonitoring?: boolean;
  
  /** アラート設定 */
  readonly alerts?: BedrockAlertConfig[];
}

/**
 * Bedrockアラート設定
 */
export interface BedrockAlertConfig {
  /** メトリクス名 */
  readonly metricName: string;
  
  /** 閾値 */
  readonly threshold: number;
  
  /** 比較演算子 */
  readonly comparisonOperator: string;
  
  /** 通知先 */
  readonly notificationTargets: string[];
}

/**
 * Bedrockモデル推論設定
 */
export interface BedrockModelInferenceConfig {
  /** パラメータ */
  readonly parameters?: BedrockModelParameters;
  
  /** タイムアウト */
  readonly timeout?: number;
  
  /** 再試行設定 */
  readonly retryConfig?: BedrockRetryConfig;
}

/**
 * Bedrock再試行設定
 */
export interface BedrockRetryConfig {
  /** 最大再試行回数 */
  readonly maxRetries: number;
  
  /** 初期遅延（ミリ秒） */
  readonly initialDelayMs?: number;
  
  /** 最大遅延（ミリ秒） */
  readonly maxDelayMs?: number;
  
  /** バックオフ戦略 */
  readonly backoffStrategy?: 'EXPONENTIAL' | 'LINEAR' | 'FIXED';
}

/**
 * 埋め込み設定
 */
export interface EmbeddingConfig {
  /** 埋め込み有効化 */
  readonly enabled: boolean;
  
  /** モデル */
  readonly model: string;
  
  /** 次元数 */
  readonly dimensions: number;
  
  /** バッチ処理設定 */
  readonly batchProcessing?: EmbeddingBatchConfig;
  
  /** ベクトルストア設定 */
  readonly vectorStore?: EmbeddingVectorStoreConfig;
  
  /** キャッシュ設定 */
  readonly caching?: EmbeddingCacheConfig;
}

/**
 * 埋め込みバッチ処理設定
 */
export interface EmbeddingBatchConfig {
  /** バッチサイズ */
  readonly batchSize: number;
  
  /** 並列処理数 */
  readonly parallelism?: number;
  
  /** タイムアウト */
  readonly timeout?: number;
}

/**
 * 埋め込みベクトルストア設定
 */
export interface EmbeddingVectorStoreConfig {
  /** ストアタイプ */
  readonly storeType: 'OPENSEARCH' | 'PINECONE' | 'FAISS';
  
  /** インデックス名 */
  readonly indexName: string;
  
  /** 類似度メトリクス */
  readonly similarityMetric?: 'COSINE' | 'EUCLIDEAN' | 'DOT_PRODUCT';
  
  /** 検索設定 */
  readonly searchConfig?: EmbeddingSearchConfig;
}

/**
 * 埋め込み検索設定
 */
export interface EmbeddingSearchConfig {
  /** トップK */
  readonly topK: number;
  
  /** 類似度閾値 */
  readonly similarityThreshold?: number;
  
  /** フィルター */
  readonly filters?: Record<string, any>;
}

/**
 * 埋め込みキャッシュ設定
 */
export interface EmbeddingCacheConfig {
  /** キャッシュ有効化 */
  readonly enabled: boolean;
  
  /** TTL（秒） */
  readonly ttlSeconds?: number;
  
  /** キャッシュサイズ */
  readonly maxSize?: number;
}

/**
 * モデル管理設定
 */
export interface ModelConfig {
  /** モデル管理有効化 */
  readonly enabled: boolean;
  
  /** カスタムモデル */
  readonly customModels: boolean;
  
  /** モデルレジストリ */
  readonly modelRegistry?: ModelRegistryConfig;
  
  /** モデルバージョニング */
  readonly versioning?: ModelVersioningConfig;
  
  /** モデルデプロイメント */
  readonly deployment?: ModelDeploymentConfig;
  
  /** A/Bテスト */
  readonly abTesting?: ModelAbTestingConfig;
}

/**
 * モデルレジストリ設定
 */
export interface ModelRegistryConfig {
  /** レジストリ有効化 */
  readonly enabled: boolean;
  
  /** S3バケット */
  readonly s3Bucket?: string;
  
  /** メタデータストア */
  readonly metadataStore?: 'DYNAMODB' | 'RDS';
  
  /** 承認ワークフロー */
  readonly approvalWorkflow?: boolean;
}

/**
 * モデルバージョニング設定
 */
export interface ModelVersioningConfig {
  /** バージョニング戦略 */
  readonly strategy: 'SEMANTIC' | 'TIMESTAMP' | 'INCREMENTAL';
  
  /** 自動バージョニング */
  readonly autoVersioning?: boolean;
  
  /** バージョン保持数 */
  readonly retentionCount?: number;
}

/**
 * モデルデプロイメント設定
 */
export interface ModelDeploymentConfig {
  /** デプロイメント戦略 */
  readonly strategy: 'BLUE_GREEN' | 'CANARY' | 'ROLLING';
  
  /** 自動デプロイメント */
  readonly autoDeployment?: boolean;
  
  /** ヘルスチェック */
  readonly healthCheck?: ModelHealthCheckConfig;
  
  /** ロールバック設定 */
  readonly rollback?: ModelRollbackConfig;
}

/**
 * モデルヘルスチェック設定
 */
export interface ModelHealthCheckConfig {
  /** ヘルスチェック有効化 */
  readonly enabled: boolean;
  
  /** チェック間隔（秒） */
  readonly intervalSeconds?: number;
  
  /** タイムアウト（秒） */
  readonly timeoutSeconds?: number;
  
  /** 失敗閾値 */
  readonly failureThreshold?: number;
}

/**
 * モデルロールバック設定
 */
export interface ModelRollbackConfig {
  /** 自動ロールバック */
  readonly autoRollback: boolean;
  
  /** ロールバック条件 */
  readonly conditions?: ModelRollbackCondition[];
}

/**
 * モデルロールバック条件
 */
export interface ModelRollbackCondition {
  /** メトリクス名 */
  readonly metricName: string;
  
  /** 閾値 */
  readonly threshold: number;
  
  /** 比較演算子 */
  readonly operator: 'GT' | 'LT' | 'EQ';
  
  /** 評価期間（秒） */
  readonly evaluationPeriod?: number;
}

/**
 * モデルA/Bテスト設定
 */
export interface ModelAbTestingConfig {
  /** A/Bテスト有効化 */
  readonly enabled: boolean;
  
  /** トラフィック分割 */
  readonly trafficSplit?: ModelTrafficSplit[];
  
  /** 実験期間（日） */
  readonly experimentDurationDays?: number;
  
  /** 成功メトリクス */
  readonly successMetrics?: string[];
}

/**
 * モデルトラフィック分割
 */
export interface ModelTrafficSplit {
  /** モデルバージョン */
  readonly modelVersion: string;
  
  /** トラフィック割合（%） */
  readonly trafficPercentage: number;
}

/**
 * AI統合設定
 */
export interface AiConfig {
  /** Bedrock設定 */
  readonly bedrock: BedrockConfig;
  
  /** 埋め込み設定 */
  readonly embedding: EmbeddingConfig;
  
  /** モデル管理設定 */
  readonly model: ModelConfig;
  
  /** パイプライン設定 */
  readonly pipeline?: AiPipelineConfig;
  
  /** 監視設定 */
  readonly monitoring?: AiMonitoringConfig;
  
  /** コスト最適化 */
  readonly costOptimization?: AiCostOptimizationConfig;
}

/**
 * AIパイプライン設定
 */
export interface AiPipelineConfig {
  /** パイプライン有効化 */
  readonly enabled: boolean;
  
  /** データ前処理 */
  readonly preprocessing?: AiPreprocessingConfig;
  
  /** 後処理 */
  readonly postprocessing?: AiPostprocessingConfig;
  
  /** オーケストレーション */
  readonly orchestration?: AiOrchestrationConfig;
}

/**
 * AI前処理設定
 */
export interface AiPreprocessingConfig {
  /** テキスト正規化 */
  readonly textNormalization?: boolean;
  
  /** トークン化 */
  readonly tokenization?: boolean;
  
  /** フィルタリング */
  readonly filtering?: AiFilteringConfig;
}

/**
 * AIフィルタリング設定
 */
export interface AiFilteringConfig {
  /** 言語フィルター */
  readonly languageFilter?: string[];
  
  /** 長さフィルター */
  readonly lengthFilter?: AiLengthFilter;
  
  /** 品質フィルター */
  readonly qualityFilter?: boolean;
}

/**
 * AI長さフィルター
 */
export interface AiLengthFilter {
  /** 最小長 */
  readonly minLength?: number;
  
  /** 最大長 */
  readonly maxLength?: number;
}

/**
 * AI後処理設定
 */
export interface AiPostprocessingConfig {
  /** 結果フィルタリング */
  readonly resultFiltering?: boolean;
  
  /** スコアリング */
  readonly scoring?: AiScoringConfig;
  
  /** ランキング */
  readonly ranking?: boolean;
}

/**
 * AIスコアリング設定
 */
export interface AiScoringConfig {
  /** スコアリング手法 */
  readonly method: 'CONFIDENCE' | 'RELEVANCE' | 'CUSTOM';
  
  /** 閾値 */
  readonly threshold?: number;
}

/**
 * AIオーケストレーション設定
 */
export interface AiOrchestrationConfig {
  /** ワークフローエンジン */
  readonly workflowEngine: 'STEP_FUNCTIONS' | 'AIRFLOW' | 'CUSTOM';
  
  /** 並列処理 */
  readonly parallelProcessing?: boolean;
  
  /** エラーハンドリング */
  readonly errorHandling?: AiErrorHandlingConfig;
}

/**
 * AIエラーハンドリング設定
 */
export interface AiErrorHandlingConfig {
  /** 再試行戦略 */
  readonly retryStrategy?: BedrockRetryConfig;
  
  /** フォールバック */
  readonly fallback?: boolean;
  
  /** エラー通知 */
  readonly errorNotification?: boolean;
}

/**
 * AI監視設定
 */
export interface AiMonitoringConfig {
  /** パフォーマンス監視 */
  readonly performanceMonitoring: boolean;
  
  /** 品質監視 */
  readonly qualityMonitoring?: boolean;
  
  /** ドリフト検出 */
  readonly driftDetection?: boolean;
  
  /** アラート設定 */
  readonly alerts?: BedrockAlertConfig[];
}

/**
 * AIコスト最適化設定
 */
export interface AiCostOptimizationConfig {
  /** 使用量最適化 */
  readonly usageOptimization: boolean;
  
  /** モデル選択最適化 */
  readonly modelSelection?: boolean;
  
  /** キャッシュ戦略 */
  readonly cachingStrategy?: boolean;
  
  /** 予算アラート */
  readonly budgetAlerts?: AiBudgetAlert[];
}

/**
 * AI予算アラート
 */
export interface AiBudgetAlert {
  /** 予算額 */
  readonly budgetAmount: number;
  
  /** 通貨 */
  readonly currency: string;
  
  /** 閾値（%） */
  readonly thresholdPercentage: number;
  
  /** 通知先 */
  readonly notificationTargets: string[];
}