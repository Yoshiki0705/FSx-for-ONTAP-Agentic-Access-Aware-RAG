'use client';

/**
 * RoutingModeDisplay — Routing Mode Selection Reason in Agent Trace UI
 *
 * Shows the selected Routing Mode and the reason for selection in the
 * multi-agent trace panel.
 *
 * Validates: Requirements 10.5
 */

import React from 'react';
import type { RoutingMode } from '@/types/multi-agent';

export interface RoutingModeDisplayProps {
  /** Selected routing mode */
  mode: RoutingMode;
  /** Human-readable reason for the selection */
  reason?: string;
  /** Routing overhead in milliseconds */
  overheadMs?: number;
  /** Whether auto-routing was used */
  isAutoRouted?: boolean;
}

const MODE_LABELS: Record<RoutingMode, { label: string; icon: string; description: string }> = {
  supervisor_router: {
    label: 'supervisor_router',
    icon: '⚡',
    description: '低レイテンシモード — 最小限のCollaborator呼び出し',
  },
  supervisor: {
    label: 'supervisor',
    icon: '🧠',
    description: 'フルモード — タスク分解と複数Collaborator協調',
  },
};

/**
 * Displays the routing mode selection and reason in the Agent Trace UI.
 */
export default function RoutingModeDisplay({
  mode,
  reason,
  overheadMs,
  isAutoRouted,
}: RoutingModeDisplayProps) {
  const modeInfo = MODE_LABELS[mode] ?? MODE_LABELS.supervisor_router;

  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2"
      role="region"
      aria-label="ルーティング判断"
    >
      <div className="flex items-center gap-2 text-sm">
        <span aria-hidden="true">🧭</span>
        <span className="font-semibold text-gray-700 dark:text-gray-300">
          ルーティング判断
        </span>
        {isAutoRouted && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
            自動選択
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        {/* Mode */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 dark:text-gray-400">モード:</span>
          <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
            {modeInfo.icon} {modeInfo.label}
          </span>
        </div>

        {/* Overhead */}
        {overheadMs !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 dark:text-gray-400">オーバーヘッド:</span>
            <span className="font-mono tabular-nums text-gray-800 dark:text-gray-200">
              {overheadMs < 1000 ? `${Math.round(overheadMs)}ms` : `${(overheadMs / 1000).toFixed(1)}s`}
            </span>
          </div>
        )}

        {/* Auto/Fixed indicator */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 dark:text-gray-400">選択方式:</span>
          <span className="text-gray-800 dark:text-gray-200">
            {isAutoRouted ? '自動（複雑度分析）' : '固定設定'}
          </span>
        </div>
      </div>

      {/* Reason */}
      {reason && (
        <div className="text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
          <span className="text-gray-500 dark:text-gray-400">📝 判断理由: </span>
          <span>{reason}</span>
        </div>
      )}

      {/* Mode description */}
      <div className="text-[11px] text-gray-400 dark:text-gray-500">
        {modeInfo.description}
      </div>
    </div>
  );
}
