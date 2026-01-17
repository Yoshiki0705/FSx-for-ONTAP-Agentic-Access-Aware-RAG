/**
 * チャットボット機能テスト設定
 * 
 * 実本番環境でのチャットボット機能テストに関する設定を管理
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

/**
 * チャットボットテスト設定インターフェース
 */
export interface ChatbotTestConfig {
  // テスト実行設定
  execution: {
    timeout: number;
    retryCount: number;
    maxConcurrency: number;
    failFast: boolean;
  };

  // Bedrockモデル設定
  models: {
    primaryModel: string;
    fallbackModel: string;
    streamingModel: string;
    complexQuestionModel: string;
  };

  // 応答品質設定
  qualityThresholds: {
    japaneseQuality: number;
    responseTime: number;
    ragRelevance: number;
    streamingConsistency: number;
  };

  // テスト質問設定
  testQuestions: {
    enabledCategories: string[];
    maxQuestionsPerCategory: number;
    includeComplexQuestions: boolean;
  };

  // RAG機能設定
  rag: {
    maxDocuments: number;
    relevanceThreshold: number;
    enableCitationCheck: boolean;
    documentContextLength: number;
  };

  // ストリーミング設定
  streaming: {
    enableStreamingTests: boolean;
    maxChunkSize: number;
    timeoutPerChunk: number;
    errorTolerance: number;
  };

  // レポート設定
  reporting: {
    generateDetailedReport: boolean;
    includeResponseText: boolean;
    includePerformanceMetrics: boolean;
    saveToFile: boolean;
  };
}

/**
 * デフォルトチャットボットテスト設定
 */
export const defaultChatbotTestConfig: ChatbotTestConfig = {
  execution: {
    timeout: 60000, // 60秒
    retryCount: 2,
    maxConcurrency: 1, // チャットボットテストは順次実行
    failFast: false
  },

  models: {
    primaryModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    fallbackModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    streamingModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    complexQuestionModel: 'anthropic.claude-3-sonnet-20240229-v1:0'
  },

  qualityThresholds: {
    japaneseQuality: 0.7,
    responseTime: 10000, // 10秒
    ragRelevance: 0.7,
    streamingConsistency: 0.8
  },

  testQuestions: {
    enabledCategories: ['general', 'document-based', 'technical', 'conversational'],
    maxQuestionsPerCategory: 3,
    includeComplexQuestions: true
  },

  rag: {
    maxDocuments: 10,
    relevanceThreshold: 0.5,
    enableCitationCheck: true,
    documentContextLength: 300
  },

  streaming: {
    enableStreamingTests: true,
    maxChunkSize: 100,
    timeoutPerChunk: 5000,
    errorTolerance: 0.1
  },

  reporting: {
    generateDetailedReport: true,
    includeResponseText: true,
    includePerformanceMetrics: true,
    saveToFile: true
  }
};

/**
 * 本番環境用チャットボットテスト設定
 */
export const productionChatbotTestConfig: ChatbotTestConfig = {
  ...defaultChatbotTestConfig,
  
  execution: {
    ...defaultChatbotTestConfig.execution,
    timeout: 90000, // 本番環境では90秒
    retryCount: 1   // 本番環境では再試行を最小限に
  },

  qualityThresholds: {
    ...defaultChatbotTestConfig.qualityThresholds,
    japaneseQuality: 0.8, // 本番環境では高い品質を要求
    responseTime: 8000,    // 8秒以内
    ragRelevance: 0.8,
    streamingConsistency: 0.9
  },

  testQuestions: {
    ...defaultChatbotTestConfig.testQuestions,
    maxQuestionsPerCategory: 2, // 本番環境では質問数を制限
    includeComplexQuestions: true
  }
};

/**
 * 開発環境用チャットボットテスト設定
 */
export const developmentChatbotTestConfig: ChatbotTestConfig = {
  ...defaultChatbotTestConfig,
  
  execution: {
    ...defaultChatbotTestConfig.execution,
    timeout: 45000, // 開発環境では45秒
    retryCount: 3   // 開発環境では再試行を多めに
  },

  qualityThresholds: {
    ...defaultChatbotTestConfig.qualityThresholds,
    japaneseQuality: 0.6, // 開発環境では緩い基準
    responseTime: 15000,   // 15秒
    ragRelevance: 0.6,
    streamingConsistency: 0.7
  },

  testQuestions: {
    ...defaultChatbotTestConfig.testQuestions,
    maxQuestionsPerCategory: 5, // 開発環境では多くの質問をテスト
    includeComplexQuestions: true
  }
};

/**
 * 環境に応じた設定の取得
 */
export function getChatbotTestConfig(environment: string): ChatbotTestConfig {
  switch (environment.toLowerCase()) {
    case 'production':
    case 'prod':
      return productionChatbotTestConfig;
    
    case 'development':
    case 'dev':
      return developmentChatbotTestConfig;
    
    default:
      return defaultChatbotTestConfig;
  }
}

/**
 * Bedrockモデル定義
 */
export const BEDROCK_MODELS = {
  CLAUDE_3_HAIKU: 'anthropic.claude-3-haiku-20240307-v1:0',
  CLAUDE_3_SONNET: 'anthropic.claude-3-sonnet-20240229-v1:0',
  CLAUDE_3_OPUS: 'anthropic.claude-3-opus-20240229-v1:0'
} as const;

/**
 * テスト質問カテゴリ定義
 */
export const TEST_QUESTION_CATEGORIES = {
  GENERAL: 'general',
  DOCUMENT_BASED: 'document-based',
  TECHNICAL: 'technical',
  CONVERSATIONAL: 'conversational'
} as const;

/**
 * 日本語品質評価基準
 */
export const JAPANESE_QUALITY_CRITERIA = {
  GRAMMAR_WEIGHT: 0.25,
  NATURALNESS_WEIGHT: 0.25,
  POLITENESS_WEIGHT: 0.2,
  CLARITY_WEIGHT: 0.15,
  COMPLETENESS_WEIGHT: 0.15
} as const;

/**
 * RAG評価基準
 */
export const RAG_EVALUATION_CRITERIA = {
  DOCUMENT_RELEVANCE_WEIGHT: 0.4,
  CITATION_ACCURACY_WEIGHT: 0.3,
  CONTENT_INTEGRATION_WEIGHT: 0.3
} as const;

/**
 * ストリーミング品質基準
 */
export const STREAMING_QUALITY_CRITERIA = {
  CONSISTENCY_WEIGHT: 0.4,
  SMOOTHNESS_WEIGHT: 0.3,
  COMPLETENESS_WEIGHT: 0.3,
  MAX_ERROR_RATE: 0.1,
  MIN_CHUNK_SIZE: 10,
  MAX_CHUNK_SIZE: 200
} as const;

/**
 * エラーハンドリングシナリオ定義
 */
export const ERROR_HANDLING_SCENARIOS = {
  INAPPROPRIATE_CONTENT: {
    type: 'inappropriate_content',
    expectedBehavior: 'polite_refusal',
    keywords: ['申し訳', '恐れ入り', 'お答えできません', '提供できません']
  },
  AMBIGUOUS_QUESTION: {
    type: 'ambiguous_question',
    expectedBehavior: 'clarification_request',
    keywords: ['詳しく', '具体的に', 'どの', '何について', '明確に']
  },
  OUT_OF_SCOPE: {
    type: 'out_of_scope',
    expectedBehavior: 'scope_explanation',
    keywords: ['専門', '範囲', '対象', 'システム', '文書']
  }
} as const;

/**
 * パフォーマンス評価基準
 */
export const PERFORMANCE_BENCHMARKS = {
  RESPONSE_TIME: {
    EXCELLENT: 3000,  // 3秒以内
    GOOD: 5000,       // 5秒以内
    ACCEPTABLE: 8000, // 8秒以内
    POOR: 10000       // 10秒超過
  },
  THROUGHPUT: {
    MIN_TOKENS_PER_SECOND: 10,
    TARGET_TOKENS_PER_SECOND: 50,
    EXCELLENT_TOKENS_PER_SECOND: 100
  },
  ERROR_RATES: {
    EXCELLENT: 0.01,  // 1%以下
    GOOD: 0.05,       // 5%以下
    ACCEPTABLE: 0.1,  // 10%以下
    POOR: 0.2         // 20%超過
  }
} as const;

/**
 * チャットボットテスト結果の評価基準
 */
export const CHATBOT_EVALUATION_CRITERIA = {
  // 総合品質スコア重み付け
  OVERALL_QUALITY_WEIGHTS: {
    JAPANESE_QUALITY: 0.3,
    RAG_EFFECTIVENESS: 0.25,
    RESPONSE_TIME: 0.2,
    STREAMING_QUALITY: 0.15,
    ERROR_HANDLING: 0.1
  },

  // 成功率閾値
  SUCCESS_RATE_THRESHOLDS: {
    EXCELLENT: 0.95,
    GOOD: 0.85,
    ACCEPTABLE: 0.75,
    NEEDS_IMPROVEMENT: 0.60
  },

  // 品質スコア閾値
  QUALITY_SCORE_THRESHOLDS: {
    EXCELLENT: 0.9,
    GOOD: 0.75,
    ACCEPTABLE: 0.6,
    CRITICAL: 0.4
  }
};

export default {
  defaultChatbotTestConfig,
  productionChatbotTestConfig,
  developmentChatbotTestConfig,
  getChatbotTestConfig,
  BEDROCK_MODELS,
  TEST_QUESTION_CATEGORIES,
  JAPANESE_QUALITY_CRITERIA,
  RAG_EVALUATION_CRITERIA,
  STREAMING_QUALITY_CRITERIA,
  ERROR_HANDLING_SCENARIOS,
  PERFORMANCE_BENCHMARKS,
  CHATBOT_EVALUATION_CRITERIA
};