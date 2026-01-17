/**
 * チャットボット機能テストモジュール統合エクスポート
 * 
 * 実本番Amazon Bedrockでのチャットボット機能テスト
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

export { default as ChatbotTestModule } from './chatbot-test-module';
export { default as ChatbotTestRunner } from './chatbot-test-runner';

export type {
  ChatbotTestResult,
  TestQuestion,
  JapaneseQualityMetrics
} from './chatbot-test-module';

export type {
  ChatbotTestConfig
} from './chatbot-config';

export {
  getChatbotTestConfig,
  BEDROCK_MODELS,
  TEST_QUESTION_CATEGORIES,
  JAPANESE_QUALITY_CRITERIA,
  RAG_EVALUATION_CRITERIA,
  STREAMING_QUALITY_CRITERIA,
  ERROR_HANDLING_SCENARIOS,
  PERFORMANCE_BENCHMARKS,
  CHATBOT_EVALUATION_CRITERIA
} from './chatbot-config';

// テストカテゴリの定義
export const CHATBOT_TEST_CATEGORIES = {
  JAPANESE_QUALITY: 'japanese-quality',
  DOCUMENT_BASED: 'document-based',
  STREAMING: 'streaming',
  ERROR_HANDLING: 'error-handling',
  COMPLEX_QUESTIONS: 'complex-questions'
} as const;

// テスト重要度の定義
export const CHATBOT_TEST_PRIORITIES = {
  CRITICAL: 'critical',    // 基本的な日本語応答
  HIGH: 'high',           // 文書ベース応答
  MEDIUM: 'medium',       // ストリーミング機能
  LOW: 'low'              // 複雑な質問対応
} as const;

// AI品質スコア閾値
export const AI_QUALITY_THRESHOLDS = {
  EXCELLENT: 0.9,
  GOOD: 0.75,
  ACCEPTABLE: 0.6,
  NEEDS_IMPROVEMENT: 0.4
} as const;