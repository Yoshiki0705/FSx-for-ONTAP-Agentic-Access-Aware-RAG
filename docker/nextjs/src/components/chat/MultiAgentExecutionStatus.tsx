'use client';

import React, { useEffect, useRef, useState } from 'react';
import type {
  MultiAgentExecutionStatus as ExecutionStatusType,
  CollaboratorRole,
} from '@/types/multi-agent';

// ===== Status icon / label helpers =====

const STATUS_DISPLAY: Record<
  'pending' | 'running' | 'completed' | 'failed' | 'skipped',
  { icon: string; label: string }
> = {
  pending: { icon: '○', label: '待機中' },
  running: { icon: '⏳', label: '実行中...' },
  completed: { icon: '✅', label: '完了' },
  failed: { icon: '❌', label: 'エラー' },
  skipped: { icon: '⏭️', label: 'スキップ' },
};

const PHASE_DISPLAY: Record<
  ExecutionStatusType['currentPhase'],
  { icon: string; label: string }
> = {
  routing: { icon: '🔄', label: 'Supervisor: タスク分解中...' },
  executing: { icon: '🔄', label: 'Supervisor: Collaborator実行中...' },
  aggregating: { icon: '🔄', label: 'Supervisor: 結果統合中...' },
  completed: { icon: '✅', label: 'Supervisor: 完了' },
  error: { icon: '❌', label: 'Supervisor: エラー' },
};

const ROLE_ICON: Record<CollaboratorRole, string> = {
  'permission-resolver': '🔒',
  retrieval: '📚',
  analysis: '📊',
  output: '📝',
  vision: '👁️',
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `~$${usd.toFixed(4)}`;
  return `~$${usd.toFixed(2)}`;
}

// ===== Props =====

export interface MultiAgentExecutionStatusProps {
  status: ExecutionStatusType;
}

/**
 * マルチエージェント実行中のリアルタイムステータス表示コンポーネント。
 *
 * - 各 Collaborator の状態表示: ○ 待機中 → ⏳ 実行中 → ✅ 完了 / ❌ エラー / ⏭️ スキップ
 * - 実行時間のリアルタイム更新（100ms 間隔）
 * - 推定コスト表示
 * - パルスアニメーション（`animate-pulse`）を実行中 Collaborator に適用
 * - `role="status"` + `aria-live="polite"` でスクリーンリーダー対応
 *
 * Requirements: 7.1, 7.6, 15.1
 */
export default function MultiAgentExecutionStatus({
  status,
}: MultiAgentExecutionStatusProps) {
  const { currentPhase, collaboratorStatuses, elapsedMs, estimatedCostUsd } =
    status;

  // --- Real-time elapsed time ticker (100ms interval) ---
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const isActive =
      currentPhase === 'routing' ||
      currentPhase === 'executing' ||
      currentPhase === 'aggregating';

    if (isActive) {
      intervalRef.current = setInterval(() => setTick((t) => t + 1), 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentPhase]);

  // Convert Map to array for rendering (stable order by insertion)
  const collaborators = Array.from(collaboratorStatuses.entries());

  const phase = PHASE_DISPLAY[currentPhase];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="マルチエージェント実行ステータス"
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3 text-sm"
    >
      {/* Current phase indicator */}
      <div className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-200 mb-2">
        <span
          className={
            currentPhase === 'routing' ||
            currentPhase === 'executing' ||
            currentPhase === 'aggregating'
              ? 'animate-spin inline-block'
              : ''
          }
        >
          {phase.icon}
        </span>
        <span>{phase.label}</span>
      </div>

      {/* Collaborator list */}
      <ul className="space-y-1 ml-1 border-l-2 border-gray-200 dark:border-gray-600 pl-3">
        {collaborators.map(([id, collab], idx) => {
          const isLast = idx === collaborators.length - 1;
          const statusInfo = STATUS_DISPLAY[collab.status];
          const roleIcon = ROLE_ICON[collab.role] ?? '🤖';
          const isRunning = collab.status === 'running';

          return (
            <li
              key={id}
              className={`
                flex items-center gap-2 py-0.5 text-gray-700 dark:text-gray-300
                ${isRunning ? 'animate-pulse' : ''}
              `}
            >
              {/* Tree connector */}
              <span className="text-gray-400 dark:text-gray-500 text-xs select-none">
                {isLast ? '└──' : '├──'}
              </span>

              {/* Status icon */}
              <span className="flex-shrink-0 w-5 text-center" aria-hidden="true">
                {statusInfo.icon}
              </span>

              {/* Agent name */}
              <span className="font-medium truncate max-w-[160px]">
                {collab.name}
              </span>

              {/* Elapsed time */}
              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums min-w-[48px] text-right">
                {collab.status === 'pending' ? '---' : formatMs(collab.elapsedMs)}
              </span>

              {/* Role icon + short status label */}
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                {roleIcon}
                <span className="hidden sm:inline">{statusInfo.label}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {/* Footer: total elapsed time + estimated cost */}
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          ⏱️ 経過時間:
          <span className="font-medium tabular-nums text-gray-700 dark:text-gray-300">
            {formatMs(elapsedMs)}
          </span>
        </span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="flex items-center gap-1" aria-label="Estimated cost">
          📊 推定コスト:
          <span className="font-medium tabular-nums text-gray-700 dark:text-gray-300">
            {formatCost(estimatedCostUsd)}
          </span>
        </span>
      </div>
    </div>
  );
}
