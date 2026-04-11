'use client';

import React, { useMemo } from 'react';
import type {
  MultiAgentTraceResult,
  AgentTeamTraceEvent,
  CollaboratorRole,
} from '@/types/multi-agent';
import { calculateEstimatedCost } from '@/types/multi-agent';

// ===== Role color mapping (consistent with MultiAgentTraceTimeline) =====

const ROLE_BAR_COLORS: Record<CollaboratorRole, string> = {
  'permission-resolver': 'bg-blue-500 dark:bg-blue-400',
  retrieval: 'bg-green-500 dark:bg-green-400',
  analysis: 'bg-purple-500 dark:bg-purple-400',
  output: 'bg-orange-500 dark:bg-orange-400',
  vision: 'bg-pink-500 dark:bg-pink-400',
};

const ROLE_TEXT_COLORS: Record<CollaboratorRole, string> = {
  'permission-resolver': 'text-blue-700 dark:text-blue-300',
  retrieval: 'text-green-700 dark:text-green-300',
  analysis: 'text-purple-700 dark:text-purple-300',
  output: 'text-orange-700 dark:text-orange-300',
  vision: 'text-pink-700 dark:text-pink-300',
};

const SUPERVISOR_BAR_COLOR = 'bg-gray-500 dark:bg-gray-400';

// ===== Helpers =====

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(usd: number): string {
  if (usd < 0.001) return '<$0.001';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

// ===== Per-collaborator cost breakdown =====

interface CollaboratorCostItem {
  name: string;
  role: CollaboratorRole | 'supervisor';
  cost: number;
  percentage: number;
  inputTokens: number;
  outputTokens: number;
  executionTimeMs: number;
}

function computeCostBreakdown(
  trace: MultiAgentTraceResult,
): CollaboratorCostItem[] {
  const totalCost = trace.estimatedCostUsd;
  if (totalCost <= 0) return [];

  const items: CollaboratorCostItem[] = [];

  // Per-collaborator costs
  for (const ct of trace.collaboratorTraces) {
    const cost = calculateEstimatedCost([ct]);
    items.push({
      name: ct.collaboratorName,
      role: ct.collaboratorRole,
      cost,
      percentage: (cost / totalCost) * 100,
      inputTokens: ct.inputTokens ?? 0,
      outputTokens: ct.outputTokens ?? 0,
      executionTimeMs: ct.executionTimeMs,
    });
  }

  // Supervisor routing overhead as a separate line item
  const collaboratorCostSum = items.reduce((sum, i) => sum + i.cost, 0);
  const supervisorCost = Math.max(totalCost - collaboratorCostSum, 0);
  if (supervisorCost > 0 || trace.routingOverheadMs > 0) {
    items.push({
      name: 'Supervisor',
      role: 'supervisor',
      cost: supervisorCost,
      percentage: (supervisorCost / totalCost) * 100,
      inputTokens: 0,
      outputTokens: 0,
      executionTimeMs: trace.routingOverheadMs,
    });
  }

  // Sort by cost descending
  items.sort((a, b) => b.cost - a.cost);

  return items;
}

/**
 * Estimate what a single-agent execution would cost.
 * Heuristic: ~1/3 of multi-agent cost (single agent handles everything
 * in one pass with fewer total tokens).
 */
function estimateSingleAgentCost(multiAgentCost: number): number {
  return multiAgentCost / 3;
}

// ===== Sub-components =====

interface CostBarProps {
  item: CollaboratorCostItem;
  maxPercentage: number;
}

function CostBar({ item, maxPercentage }: CostBarProps) {
  const barColor =
    item.role === 'supervisor'
      ? SUPERVISOR_BAR_COLOR
      : ROLE_BAR_COLORS[item.role] ?? 'bg-gray-400';
  const textColor =
    item.role === 'supervisor'
      ? 'text-gray-700 dark:text-gray-300'
      : ROLE_TEXT_COLORS[item.role] ?? 'text-gray-700 dark:text-gray-300';

  // Scale bar width relative to the largest item
  const barWidthPct = maxPercentage > 0 ? (item.percentage / maxPercentage) * 100 : 0;

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Name */}
      <div className={`w-28 flex-shrink-0 text-xs font-medium truncate ${textColor}`}>
        {item.name}
      </div>

      {/* Bar */}
      <div className="flex-1 relative h-5 bg-gray-100 dark:bg-gray-700/40 rounded overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full rounded ${barColor} opacity-80 transition-all`}
          style={{ width: `${barWidthPct}%` }}
        />
        {/* Cost label */}
        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-gray-800 dark:text-gray-200 pointer-events-none">
          {formatCost(item.cost)}
        </span>
      </div>

      {/* Percentage */}
      <div className="w-12 flex-shrink-0 text-right text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
        {item.percentage.toFixed(0)}%
      </div>
    </div>
  );
}

// ===== Main component =====

export interface CostSummaryProps {
  trace: MultiAgentTraceResult;
  /** Start collapsed (default: false) */
  defaultCollapsed?: boolean;
}

/**
 * Cost summary component for multi-agent execution traces.
 *
 * Displays:
 * 1. Total metrics: execution time, input/output tokens, estimated cost
 * 2. Per-collaborator cost breakdown as horizontal bars (percentage-based)
 * 3. Single Agent mode estimated cost comparison
 * 4. Supervisor routing overhead as a separate line item
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */
export default function CostSummary({
  trace,
  defaultCollapsed = false,
}: CostSummaryProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const costBreakdown = useMemo(() => computeCostBreakdown(trace), [trace]);
  const maxPercentage = useMemo(
    () => Math.max(...costBreakdown.map((i) => i.percentage), 1),
    [costBreakdown],
  );

  const singleAgentEstimate = useMemo(
    () => estimateSingleAgentCost(trace.estimatedCostUsd),
    [trace.estimatedCostUsd],
  );

  const costIncrease = trace.estimatedCostUsd - singleAgentEstimate;
  const costIncreasePercent =
    singleAgentEstimate > 0
      ? ((costIncrease / singleAgentEstimate) * 100).toFixed(0)
      : '0';

  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm overflow-hidden"
      role="region"
      aria-label="コストサマリー"
    >
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        aria-expanded={!isCollapsed}
      >
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">💰</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            コスト推定
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({formatCost(trace.estimatedCostUsd)})
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
          {/* ── Total metrics ── */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="合計実行時間"
              value={formatMs(trace.totalExecutionTimeMs)}
              icon="⏱️"
            />
            <MetricCard
              label="入力トークン"
              value={formatTokens(trace.totalInputTokens)}
              icon="📥"
            />
            <MetricCard
              label="出力トークン"
              value={formatTokens(trace.totalOutputTokens)}
              icon="📤"
            />
            <MetricCard
              label="推定コスト"
              value={formatCost(trace.estimatedCostUsd)}
              icon="💵"
              highlight
            />
          </div>

          {/* ── Per-collaborator cost breakdown ── */}
          {costBreakdown.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                Per-Collaborator コスト内訳
              </div>
              <div role="list" aria-label="Collaboratorコスト内訳">
                {costBreakdown.map((item) => (
                  <CostBar
                    key={`${item.role}-${item.name}`}
                    item={item}
                    maxPercentage={maxPercentage}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Supervisor routing overhead ── */}
          {trace.routingOverheadMs > 0 && (
            <div className="rounded-md bg-gray-50 dark:bg-gray-700/40 p-3">
              <div className="flex items-center gap-2 text-xs">
                <span aria-hidden="true">🧭</span>
                <span className="text-gray-500 dark:text-gray-400">
                  Supervisorルーティングオーバーヘッド:
                </span>
                <span className="font-medium tabular-nums text-gray-800 dark:text-gray-200">
                  {formatMs(trace.routingOverheadMs)}
                </span>
              </div>
            </div>
          )}

          {/* ── Single Agent mode comparison ── */}
          <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span aria-hidden="true">💡</span>
              <span className="font-medium text-blue-800 dark:text-blue-200">
                Single Agentモードでの推定:
              </span>
              <span className="font-semibold tabular-nums text-blue-900 dark:text-blue-100">
                {formatCost(singleAgentEstimate)}
              </span>
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300">
              マルチエージェントによる増加:{' '}
              <span className="font-medium tabular-nums">
                +{formatCost(costIncrease)} (+{costIncreasePercent}%)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Metric card sub-component =====

interface MetricCardProps {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}

function MetricCard({ label, value, icon, highlight }: MetricCardProps) {
  return (
    <div
      className={`rounded-md p-2.5 ${
        highlight
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700'
          : 'bg-gray-50 dark:bg-gray-700/40'
      }`}
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
        <span aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </div>
      <div
        className={`text-sm font-semibold tabular-nums ${
          highlight
            ? 'text-emerald-800 dark:text-emerald-200'
            : 'text-gray-900 dark:text-gray-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
