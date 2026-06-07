/**
 * Invocation Router — Bedrock / Claude Platform パス振り分け
 *
 * クエリの特性とKB検索結果に応じて、Bedrock Converse API または
 * Claude Platform Messages API のどちらを使用するか決定する。
 *
 * Decision logic:
 * 1. CLAUDE_PLATFORM_MODE=disabled → Always Bedrock
 * 2. KB results sufficient (score ≥ threshold) → Bedrock (with Citations)
 * 3. KB results insufficient + Web Search enabled → Claude Platform (Web Search)
 * 4. Explicit user web search request → Claude Platform
 *
 * @see .kiro/specs/claude-platform-integration/requirements.md — Requirement 7
 */

import { buildClaudePlatformConfig, type ClaudePlatformMode } from './client';
import { shouldFallbackToWebSearch, buildWebSearchConfig } from '@/lib/web-search/sanitizer';

// ─── Types ─────────────────────────────────────────────────

export type InvocationPath = 'bedrock' | 'claude-platform';

export interface RoutingDecision {
  /** Which API to use */
  path: InvocationPath;
  /** Reason for the decision */
  reason: string;
  /** Whether web search should be used */
  useWebSearch: boolean;
}

// ─── Router ────────────────────────────────────────────────

/**
 * Determine which invocation path to use based on query characteristics
 * and KB search results.
 *
 * @param kbScores - Relevance scores from KB Retrieve (empty if no results)
 * @param userRequestedWebSearch - Whether user explicitly toggled web search
 * @param queryContainsWebPrefix - Whether query starts with "web:" prefix
 */
export function routeInvocation(
  kbScores: number[],
  userRequestedWebSearch: boolean = false,
  queryContainsWebPrefix: boolean = false,
): RoutingDecision {
  const platformConfig = buildClaudePlatformConfig();
  const webSearchConfig = buildWebSearchConfig();

  // Rule 1: Platform disabled → always Bedrock
  if (platformConfig.mode === 'disabled') {
    return {
      path: 'bedrock',
      reason: 'Claude Platform disabled (CLAUDE_PLATFORM_MODE=disabled)',
      useWebSearch: false,
    };
  }

  // Rule 2: Web Search not enabled → always Bedrock
  if (!webSearchConfig.enabled) {
    return {
      path: 'bedrock',
      reason: 'Web Search not enabled (ENABLE_WEB_SEARCH=false)',
      useWebSearch: false,
    };
  }

  // Rule 3: Explicit user request for web search
  if (userRequestedWebSearch || queryContainsWebPrefix) {
    return {
      path: 'claude-platform',
      reason: 'User explicitly requested web search',
      useWebSearch: true,
    };
  }

  // Rule 4: KB results insufficient → fallback to web search
  if (shouldFallbackToWebSearch(kbScores, webSearchConfig.fallbackThreshold)) {
    return {
      path: 'claude-platform',
      reason: `KB results insufficient (max score < ${webSearchConfig.fallbackThreshold})`,
      useWebSearch: true,
    };
  }

  // Default: KB results sufficient → use Bedrock
  return {
    path: 'bedrock',
    reason: 'KB results sufficient, using Bedrock Converse',
    useWebSearch: false,
  };
}

/**
 * Emit routing decision as CloudWatch EMF metric.
 */
export function emitRoutingDecisionMetric(decision: RoutingDecision): void {
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: 'RAG/InvocationRouting',
            Dimensions: [['InvocationPath']],
            Metrics: [
              { Name: 'RoutingDecisions', Unit: 'Count' },
            ],
          },
        ],
      },
      InvocationPath: decision.path,
      RoutingDecisions: 1,
      UseWebSearch: decision.useWebSearch ? 1 : 0,
      Reason: decision.reason,
    })
  );
}
