/**
 * Auto-Routing Logic for Supervisor Agent
 *
 * Analyzes query complexity and selects the optimal routing mode:
 * - Simple queries → `supervisor_router` (low latency, minimal collaborators)
 * - Complex queries → `supervisor` (task decomposition, full collaborator chain)
 *
 * When `supervisorAutoRouting=false`, uses the fixed mode from config.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.6
 */

import type { RoutingMode } from '@/types/multi-agent';

// ===== Complexity Indicators =====

/** Keywords/patterns that indicate a complex query requiring full supervisor mode */
const COMPLEX_INDICATORS: RegExp[] = [
  // Multi-document analysis
  /比較|横断|分析|まとめ|統合|サマリ|レポート/,
  /compare|cross[-\s]?document|analyze|summarize|aggregate|report/i,
  // Document generation
  /作成|生成|提案書|議事録|ドキュメント/,
  /generate|create|proposal|minutes|document/i,
  // Multi-step reasoning
  /なぜ|理由|原因|影響|推論|考察/,
  /why|reason|cause|impact|inference|consider/i,
  // Image analysis
  /画像|図|チャート|グラフ|ダイアグラム/,
  /image|diagram|chart|graph|figure/i,
  // Explicit multi-step
  /ステップ|手順|フロー|プロセス/,
  /step|procedure|flow|process/i,
];

/** Keywords that indicate a simple factual query */
const SIMPLE_INDICATORS: RegExp[] = [
  // Direct lookup
  /とは|って何|教えて|確認/,
  /what is|tell me|check|find|look up/i,
  // Single fact
  /いつ|どこ|誰|いくら/,
  /when|where|who|how much/i,
];

// ===== Complexity Analysis =====

export interface ComplexityAnalysis {
  /** Computed complexity score (0.0 = simple, 1.0 = complex) */
  score: number;
  /** Human-readable reason for the classification */
  reason: string;
  /** Matched indicator patterns */
  matchedPatterns: string[];
}

/**
 * Analyze query complexity to determine routing mode.
 *
 * Scoring:
 * - Base score: 0.3
 * - Each complex indicator match: +0.15
 * - Each simple indicator match: -0.1
 * - Long queries (>100 chars): +0.1
 * - Question marks (multiple): +0.05 each
 *
 * @param query - User query text
 * @returns Complexity analysis with score and reason
 */
export function analyzeQueryComplexity(query: string): ComplexityAnalysis {
  let score = 0.3;
  const matchedPatterns: string[] = [];

  // Check complex indicators
  for (const pattern of COMPLEX_INDICATORS) {
    if (pattern.test(query)) {
      score += 0.15;
      matchedPatterns.push(`complex:${pattern.source.substring(0, 30)}`);
    }
  }

  // Check simple indicators
  for (const pattern of SIMPLE_INDICATORS) {
    if (pattern.test(query)) {
      score -= 0.1;
      matchedPatterns.push(`simple:${pattern.source.substring(0, 30)}`);
    }
  }

  // Length heuristic
  if (query.length > 100) {
    score += 0.1;
    matchedPatterns.push('long_query');
  }

  // Multiple questions
  const questionMarks = (query.match(/[?？]/g) || []).length;
  if (questionMarks > 1) {
    score += 0.05 * (questionMarks - 1);
    matchedPatterns.push(`multi_question:${questionMarks}`);
  }

  // Clamp to [0, 1]
  score = Math.max(0, Math.min(1, score));

  // Generate reason
  let reason: string;
  if (score < 0.4) {
    reason = '単純な事実確認クエリ — 最小限のCollaborator呼び出しで対応';
  } else if (score < 0.6) {
    reason = '中程度の複雑さ — 標準的なCollaboratorチェーンで対応';
  } else {
    reason = '複雑なクエリ — タスク分解と複数Collaboratorの協調が必要';
  }

  return { score, reason, matchedPatterns };
}

// ===== Auto-Routing =====

export interface AutoRoutingResult {
  /** Selected routing mode */
  mode: RoutingMode;
  /** Reason for the selection */
  reason: string;
  /** Whether auto-routing was used */
  isAutoRouted: boolean;
  /** Complexity analysis (only when auto-routed) */
  complexity?: ComplexityAnalysis;
}

/** Complexity threshold: below this → supervisor_router, above → supervisor */
const COMPLEXITY_THRESHOLD = 0.5;

/**
 * Determine the routing mode for a given query.
 *
 * - If `autoRouting` is false, returns the fixed `configuredMode`.
 * - If `autoRouting` is true, analyzes query complexity and selects mode.
 *
 * @param query - User query text
 * @param autoRouting - Whether auto-routing is enabled
 * @param configuredMode - The fixed routing mode from config
 * @returns Routing decision with mode, reason, and analysis
 */
export function determineRoutingMode(
  query: string,
  autoRouting: boolean,
  configuredMode: RoutingMode,
): AutoRoutingResult {
  // Requirement 10.6: When autoRouting is disabled, use fixed mode
  if (!autoRouting) {
    return {
      mode: configuredMode,
      reason: `固定モード使用: ${configuredMode}（自動ルーティング無効）`,
      isAutoRouted: false,
    };
  }

  // Requirement 10.1-10.4: Analyze complexity and auto-select
  const complexity = analyzeQueryComplexity(query);

  const mode: RoutingMode =
    complexity.score < COMPLEXITY_THRESHOLD ? 'supervisor_router' : 'supervisor';

  return {
    mode,
    reason: complexity.reason,
    isAutoRouted: true,
    complexity,
  };
}
