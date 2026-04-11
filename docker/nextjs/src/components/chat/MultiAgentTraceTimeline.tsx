'use client';

import React, { useState } from 'react';
import type {
  MultiAgentTraceResult,
  AgentTeamTraceEvent,
  CollaboratorRole,
} from '@/types/multi-agent';

// ===== Role color mapping =====

const ROLE_COLORS: Record<
  CollaboratorRole,
  { bg: string; bar: string; text: string; border: string }
> = {
  'permission-resolver': {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    bar: 'bg-blue-500 dark:bg-blue-400',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-700',
  },
  retrieval: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    bar: 'bg-green-500 dark:bg-green-400',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-700',
  },
  analysis: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    bar: 'bg-purple-500 dark:bg-purple-400',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-700',
  },
  output: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    bar: 'bg-orange-500 dark:bg-orange-400',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-700',
  },
  vision: {
    bg: 'bg-pink-50 dark:bg-pink-900/20',
    bar: 'bg-pink-500 dark:bg-pink-400',
    text: 'text-pink-700 dark:text-pink-300',
    border: 'border-pink-200 dark:border-pink-700',
  },
};

const ROLE_ICON: Record<CollaboratorRole, string> = {
  'permission-resolver': '🔒',
  retrieval: '📚',
  analysis: '📊',
  output: '📝',
  vision: '👁️',
};

// ===== Helpers =====

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getRoleColor(role: CollaboratorRole) {
  return ROLE_COLORS[role] ?? ROLE_COLORS['analysis'];
}

/**
 * Generate time axis tick marks for the timeline header.
 * Returns 5–6 evenly spaced tick values from 0 to totalMs.
 */
function generateTicks(totalMs: number): number[] {
  if (totalMs <= 0) return [0];
  const count = 5;
  const step = totalMs / count;
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round(step * i));
  }
  return ticks;
}

// ===== Sub-components =====

interface TimelineBarProps {
  trace: AgentTeamTraceEvent;
  totalMs: number;
}

function TimelineBar({ trace, totalMs }: TimelineBarProps) {
  const colors = getRoleColor(trace.collaboratorRole);
  const leftPct = totalMs > 0 ? (trace.startTimeMs / totalMs) * 100 : 0;
  const widthPct =
    totalMs > 0 ? Math.max((trace.executionTimeMs / totalMs) * 100, 1) : 100;

  const statusIcon =
    trace.status === 'COMPLETED'
      ? '✅'
      : trace.status === 'FAILED'
        ? '❌'
        : trace.status === 'SKIPPED'
          ? '⏭️'
          : trace.status === 'IN_PROGRESS'
            ? '⏳'
            : '○';

  return (
    <div className="flex items-center gap-2 py-1 group" role="listitem">
      {/* Agent label */}
      <div className="w-36 flex-shrink-0 flex items-center gap-1.5 text-xs truncate">
        <span aria-hidden="true">{ROLE_ICON[trace.collaboratorRole] ?? '🤖'}</span>
        <span className={`font-medium ${colors.text} truncate`}>
          {trace.collaboratorName}
        </span>
        <span className="flex-shrink-0" aria-hidden="true">
          {statusIcon}
        </span>
      </div>

      {/* Bar area */}
      <div className="flex-1 relative h-6 bg-gray-100 dark:bg-gray-700/40 rounded overflow-hidden">
        <div
          className={`absolute top-0 h-full rounded ${colors.bar} opacity-80 group-hover:opacity-100 transition-opacity`}
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
          }}
          title={`${trace.collaboratorName}: ${formatMs(trace.startTimeMs)} → ${formatMs(trace.startTimeMs + trace.executionTimeMs)} (${formatMs(trace.executionTimeMs)})`}
        />
        {/* Duration label inside bar */}
        <span
          className="absolute top-0 h-full flex items-center text-[10px] font-medium text-white dark:text-gray-100 pointer-events-none px-1"
          style={{ left: `${leftPct}%` }}
        >
          {formatMs(trace.executionTimeMs)}
        </span>
      </div>
    </div>
  );
}

// ===== Main component =====

export interface MultiAgentTraceTimelineProps {
  trace: MultiAgentTraceResult;
  /** Start collapsed (default: true) */
  defaultCollapsed?: boolean;
}

/**
 * Waterfall-style timeline showing Collaborator invocations for a
 * multi-agent execution trace.
 *
 * Displays:
 * 1. Routing decision section (mode, reason, overhead)
 * 2. Waterfall timeline with horizontal bars per collaborator
 * 3. Color-coded by role
 * 4. Time axis at the top
 * 5. Collapsible/expandable
 *
 * Requirements: 7.1, 7.6, 7.7, 7.8
 */
export default function MultiAgentTraceTimeline({
  trace,
  defaultCollapsed = true,
}: MultiAgentTraceTimelineProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const {
    routingMode,
    routingReason,
    routingOverheadMs,
    collaboratorTraces,
    totalExecutionTimeMs,
  } = trace;

  const ticks = generateTicks(totalExecutionTimeMs);

  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm overflow-hidden"
      role="region"
      aria-label="マルチエージェントトレースタイムライン"
    >
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        aria-expanded={!isCollapsed}
      >
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">📊</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            Agent実行トレース
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({collaboratorTraces.length} collaborators · {formatMs(totalExecutionTimeMs)})
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
          {/* ── Routing decision section ── */}
          <div className="mt-3 rounded-md bg-gray-50 dark:bg-gray-700/40 p-3 space-y-1">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
              🧭 ルーティング判断
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400">モード: </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {routingMode}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">オーバーヘッド: </span>
                <span className="font-medium tabular-nums text-gray-800 dark:text-gray-200">
                  {formatMs(routingOverheadMs)}
                </span>
              </div>
              {routingReason && (
                <div className="sm:col-span-1">
                  <span className="text-gray-500 dark:text-gray-400">判断理由: </span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {routingReason}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Waterfall timeline ── */}
          <div>
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
              ⏱️ タイムライン
            </div>

            {/* Time axis */}
            <div className="flex items-center gap-2 mb-1">
              {/* Spacer matching label column */}
              <div className="w-36 flex-shrink-0" />
              <div className="flex-1 relative h-4">
                {ticks.map((t, i) => {
                  const leftPct =
                    totalExecutionTimeMs > 0
                      ? (t / totalExecutionTimeMs) * 100
                      : 0;
                  return (
                    <span
                      key={i}
                      className="absolute text-[10px] text-gray-400 dark:text-gray-500 tabular-nums -translate-x-1/2"
                      style={{ left: `${leftPct}%` }}
                    >
                      {formatMs(t)}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Bars */}
            <div role="list" aria-label="Collaborator実行タイムライン">
              {collaboratorTraces.map((ct) => (
                <TimelineBar
                  key={ct.collaboratorAgentId}
                  trace={ct}
                  totalMs={totalExecutionTimeMs}
                />
              ))}
            </div>
          </div>

          {/* ── Role legend ── */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            {(Object.keys(ROLE_COLORS) as CollaboratorRole[]).map((role) => {
              const colors = ROLE_COLORS[role];
              return (
                <div key={role} className="flex items-center gap-1 text-[10px]">
                  <span
                    className={`inline-block w-3 h-3 rounded-sm ${colors.bar}`}
                    aria-hidden="true"
                  />
                  <span className="text-gray-600 dark:text-gray-400">{role}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
