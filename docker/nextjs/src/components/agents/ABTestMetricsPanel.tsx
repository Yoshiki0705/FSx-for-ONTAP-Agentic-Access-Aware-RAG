'use client';

/**
 * ABTestMetricsPanel — A/B Test Metrics Aggregation & Comparison
 *
 * Displays average latency, tokens, error rate per version for A/B testing.
 * Used in the Agent Directory A/B tab.
 *
 * Validates: Requirements 17.5
 */

import React from 'react';
import type { ABTestMetrics } from '@/types/multi-agent';

export interface ABTestMetricsPanelProps {
  /** Metrics for the control version */
  controlMetrics: ABTestMetrics;
  /** Metrics for the experiment version */
  experimentMetrics: ABTestMetrics;
}

// ===== Helpers =====

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatTokens(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(Math.round(count));
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

/** Color class based on comparison: green if better, red if worse */
function comparisonColor(experiment: number, control: number, lowerIsBetter: boolean): string {
  if (experiment === control) return 'text-gray-600 dark:text-gray-400';
  const isBetter = lowerIsBetter
    ? experiment < control
    : experiment > control;
  return isBetter
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';
}

function diffLabel(experiment: number, control: number): string {
  if (control === 0) return '—';
  const diff = ((experiment - control) / control) * 100;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}%`;
}

// ===== Metric Row =====

function MetricRow({
  label,
  controlValue,
  experimentValue,
  formatter,
  lowerIsBetter = true,
  control,
  experiment,
}: {
  label: string;
  controlValue: string;
  experimentValue: string;
  formatter?: (v: number) => string;
  lowerIsBetter?: boolean;
  control: number;
  experiment: number;
}) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700/50">
      <td className="py-2 pr-4 text-xs text-gray-600 dark:text-gray-400 font-medium">
        {label}
      </td>
      <td className="py-2 px-4 text-xs text-right tabular-nums text-gray-800 dark:text-gray-200">
        {controlValue}
      </td>
      <td className="py-2 px-4 text-xs text-right tabular-nums text-gray-800 dark:text-gray-200">
        {experimentValue}
      </td>
      <td className={`py-2 pl-4 text-xs text-right tabular-nums font-medium ${comparisonColor(experiment, control, lowerIsBetter)}`}>
        {diffLabel(experiment, control)}
      </td>
    </tr>
  );
}

// ===== Main Component =====

/**
 * Displays A/B test metrics comparison between control and experiment versions.
 */
export default function ABTestMetricsPanel({
  controlMetrics,
  experimentMetrics,
}: ABTestMetricsPanelProps) {
  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
      role="region"
      aria-label="A/Bテストメトリクス比較"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">📊</span>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            A/Bテスト メトリクス比較
          </h3>
        </div>
      </div>

      {/* Version labels */}
      <div className="px-4 py-2 grid grid-cols-2 gap-4 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Control: {controlMetrics.version}
          </span>
          <span className="text-[10px] text-gray-400">
            ({controlMetrics.totalRequests} req)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Experiment: {experimentMetrics.version}
          </span>
          <span className="text-[10px] text-gray-400">
            ({experimentMetrics.totalRequests} req)
          </span>
        </div>
      </div>

      {/* Metrics table */}
      <div className="px-4 py-2">
        <table className="w-full" aria-label="メトリクス比較テーブル">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-4 text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                メトリクス
              </th>
              <th className="py-2 px-4 text-right text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Control
              </th>
              <th className="py-2 px-4 text-right text-[10px] uppercase tracking-wide text-orange-600 dark:text-orange-400">
                Experiment
              </th>
              <th className="py-2 pl-4 text-right text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                差分
              </th>
            </tr>
          </thead>
          <tbody>
            <MetricRow
              label="平均レイテンシ"
              controlValue={formatMs(controlMetrics.avgLatencyMs)}
              experimentValue={formatMs(experimentMetrics.avgLatencyMs)}
              lowerIsBetter={true}
              control={controlMetrics.avgLatencyMs}
              experiment={experimentMetrics.avgLatencyMs}
            />
            <MetricRow
              label="平均入力トークン"
              controlValue={formatTokens(controlMetrics.avgInputTokens)}
              experimentValue={formatTokens(experimentMetrics.avgInputTokens)}
              lowerIsBetter={true}
              control={controlMetrics.avgInputTokens}
              experiment={experimentMetrics.avgInputTokens}
            />
            <MetricRow
              label="平均出力トークン"
              controlValue={formatTokens(controlMetrics.avgOutputTokens)}
              experimentValue={formatTokens(experimentMetrics.avgOutputTokens)}
              lowerIsBetter={true}
              control={controlMetrics.avgOutputTokens}
              experiment={experimentMetrics.avgOutputTokens}
            />
            <MetricRow
              label="エラー率"
              controlValue={formatPercent(controlMetrics.errorRate)}
              experimentValue={formatPercent(experimentMetrics.errorRate)}
              lowerIsBetter={true}
              control={controlMetrics.errorRate}
              experiment={experimentMetrics.errorRate}
            />
            <MetricRow
              label="平均コスト"
              controlValue={formatCost(controlMetrics.avgCostUsd)}
              experimentValue={formatCost(experimentMetrics.avgCostUsd)}
              lowerIsBetter={true}
              control={controlMetrics.avgCostUsd}
              experiment={experimentMetrics.avgCostUsd}
            />
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          💡 緑色は改善、赤色は悪化を示します。差分はControl基準の変化率です。
        </div>
      </div>
    </div>
  );
}
