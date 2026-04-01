/**
 * ComplexityClassifier — クエリ複雑度分類モジュール
 *
 * クエリテキストを分析し、simple / complex に分類する純粋関数。
 * 日本語・英語の両方に対応。
 *
 * @version 1.0.0
 */

import { ClassificationResult } from '@/types/smart-routing';

/** 日本語の分析的キーワード */
const JAPANESE_ANALYTICAL_KEYWORDS = ['比較', '分析', '要約', '説明', '評価', '検討'];

/** 英語の分析的キーワード */
const ENGLISH_ANALYTICAL_KEYWORDS = [
  'explain',
  'compare',
  'analyze',
  'summarize',
  'evaluate',
  'discuss',
];

/**
 * 文の数をカウントする。
 * 日本語: 「。」「？」で分割
 * 英語: 「.」「?」で分割
 */
function countSentences(query: string): number {
  // Split by Japanese and English sentence terminators
  const sentences = query
    .split(/[。？.?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return Math.max(sentences.length, 1);
}

/**
 * 疑問符（? または ？）の数をカウントする。
 */
function countQuestionMarks(query: string): number {
  const matches = query.match(/[?？]/g);
  return matches ? matches.length : 0;
}

/**
 * 分析的キーワードが含まれているかチェックする。
 * 日本語・英語両方のキーワードリストを検索。
 */
function hasAnalyticalKeywords(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  for (const keyword of JAPANESE_ANALYTICAL_KEYWORDS) {
    if (query.includes(keyword)) return true;
  }

  for (const keyword of ENGLISH_ANALYTICAL_KEYWORDS) {
    if (lowerQuery.includes(keyword)) return true;
  }

  return false;
}

/**
 * クエリテキストの複雑度を分類する純粋関数。
 *
 * 分類アルゴリズム:
 * 1. 文字数: ≤100 → simple +0.3, >100 → complex +0.3
 * 2. 文の数: 1文 → simple +0.2, 複数文 → complex +0.2
 * 3. 分析的キーワード: 存在 → complex +0.3
 * 4. 複数質問: 疑問符2つ以上 → complex +0.2
 *
 * スコア合算: <0.5 → simple, ≥0.5 → complex
 * 信頼度 = |score - 0.5| * 2
 *
 * @param query - 分類対象のクエリテキスト
 * @returns ClassificationResult
 */
export function classifyQuery(query: string): ClassificationResult {
  const trimmed = query.trim();

  const charCount = trimmed.length;
  const sentenceCount = countSentences(trimmed);
  const analyticalKeywordsFound = hasAnalyticalKeywords(trimmed);
  const questionMarkCount = countQuestionMarks(trimmed);
  const multipleQuestions = questionMarkCount >= 2;

  let simpleScore = 0;
  let complexScore = 0;

  // Feature 1: Character count
  if (charCount <= 100) {
    simpleScore += 0.3;
  } else {
    complexScore += 0.3;
  }

  // Feature 2: Sentence count
  if (sentenceCount <= 1) {
    simpleScore += 0.2;
  } else {
    complexScore += 0.2;
  }

  // Feature 3: Analytical keywords
  if (analyticalKeywordsFound) {
    complexScore += 0.3;
  }

  // Feature 4: Multiple questions
  if (multipleQuestions) {
    complexScore += 0.2;
  }

  // Score aggregation
  const total = simpleScore + complexScore;
  const score = total > 0 ? complexScore / total : 0;

  const classification: 'simple' | 'complex' = score >= 0.5 ? 'complex' : 'simple';
  const confidence = Math.abs(score - 0.5) * 2;

  return {
    classification,
    confidence: Math.min(confidence, 1.0),
    features: {
      charCount,
      sentenceCount,
      hasAnalyticalKeywords: analyticalKeywordsFound,
      hasMultipleQuestions: multipleQuestions,
    },
  };
}
