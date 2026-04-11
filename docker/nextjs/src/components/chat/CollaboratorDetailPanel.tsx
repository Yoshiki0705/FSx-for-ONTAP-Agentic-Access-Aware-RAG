'use client';

import React, { useState } from 'react';
import type {
  AgentTeamTraceEvent,
  CollaboratorRole,
} from '@/types/multi-agent';

// ===== Role color mapping (same as MultiAgentTraceTimeline) =====

const ROLE_COLORS: Record<
  CollaboratorRole,
  { bg: string; text: string; border: string }
> = {
  'permission-resolver': {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-700',
  },
  retrieval: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-700',
  },
  analysis: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-700',
  },
  output: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-700',
  },
  vision: {
    bg: 'bg-pink-50 dark:bg-pink-900/20',
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

const STATUS_DISPLAY: Record<
  AgentTeamTraceEvent['status'],
  { icon: string; label: string; className: string }
> = {
  PENDING: { icon: '○', label: '待機中', className: 'text-gray-500 dark:text-gray-400' },
  IN_PROGRESS: { icon: '⏳', label: '実行中', className: 'text-yellow-600 dark:text-yellow-400' },
  COMPLETED: { icon: '✅', label: '完了', className: 'text-green-600 dark:text-green-400' },
  FAILED: { icon: '❌', label: 'エラー', className: 'text-red-600 dark:text-red-400' },
  SKIPPED: { icon: '⏭️', label: 'スキップ', className: 'text-gray-500 dark:text-gray-400' },
};

// ===== Helpers =====

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(count: number | undefined): string {
  if (count === undefined || count === null) return '—';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

function getRoleColor(role: CollaboratorRole) {
  return ROLE_COLORS[role] ?? ROLE_COLORS['analysis'];
}

// ===== Collapsible JSON viewer =====

function CollapsibleJson({
  label,
  data,
}: {
  label: string;
  data: Record<string, unknown> | undefined;
}) {
  const [open, setOpen] = useState(false);

  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        aria-expanded={open}
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>{label}</span>
      </button>
      {open && (
        <pre className="mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700/60 text-[11px] text-gray-700 dark:text-gray-300 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}


// ===== Permission Resolver detail section =====

function PermissionResolverDetails({ trace }: { trace: AgentTeamTraceEvent }) {
  const output = trace.outputContext ?? {};
  const sids = output.sids as string[] | undefined;
  const groupSids = output.groupSids as string[] | undefined;
  const uid = output.uid as string | number | undefined;
  const gid = output.gid as string | number | undefined;
  const unixGroups = output.unixGroups as string[] | undefined;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
        🔑 権限解決結果
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <span className="text-gray-500 dark:text-gray-400">SID: </span>
          <span className="font-mono text-gray-800 dark:text-gray-200">
            {sids && sids.length > 0 ? sids.join(', ') : 'なし'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">グループSID: </span>
          <span className="font-mono text-gray-800 dark:text-gray-200">
            {groupSids && groupSids.length > 0 ? groupSids.join(', ') : 'なし'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">UID: </span>
          <span className="font-mono text-gray-800 dark:text-gray-200">
            {uid !== undefined ? String(uid) : 'なし'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">GID: </span>
          <span className="font-mono text-gray-800 dark:text-gray-200">
            {gid !== undefined ? String(gid) : 'なし'}
          </span>
        </div>
        {unixGroups && unixGroups.length > 0 && (
          <div className="sm:col-span-2">
            <span className="text-gray-500 dark:text-gray-400">UNIXグループ: </span>
            <span className="font-mono text-gray-800 dark:text-gray-200">
              {unixGroups.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Retrieval Agent detail section =====

function RetrievalDetails({ trace }: { trace: AgentTeamTraceEvent }) {
  const output = trace.outputContext ?? {};
  const kbId = output.kbId as string | undefined;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
        📚 検索結果詳細
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {kbId && (
          <div className="sm:col-span-2">
            <span className="text-gray-500 dark:text-gray-400">KB ID: </span>
            <span className="font-mono text-gray-800 dark:text-gray-200">{kbId}</span>
          </div>
        )}
        {trace.kbFiltersApplied && Object.keys(trace.kbFiltersApplied).length > 0 && (
          <div className="sm:col-span-2">
            <span className="text-gray-500 dark:text-gray-400">フィルタ条件: </span>
            <span className="font-mono text-gray-800 dark:text-gray-200">
              {Object.entries(trace.kbFiltersApplied)
                .map(([key, vals]) => `${key}: [${vals.join(', ')}]`)
                .join(' | ')}
            </span>
          </div>
        )}
        <div>
          <span className="text-gray-500 dark:text-gray-400">Citations返却: </span>
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {trace.citationsReturned !== undefined ? `${trace.citationsReturned}件` : '—'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Citations除外: </span>
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {trace.citationsFiltered !== undefined ? `${trace.citationsFiltered}件` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ===== Access denied warning =====

function AccessDeniedWarning({ trace }: { trace: AgentTeamTraceEvent }) {
  if (!trace.accessDenied) return null;

  return (
    <div
      className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <span className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true">⚠️</span>
        <div className="text-xs space-y-1">
          <div className="font-semibold text-red-700 dark:text-red-300">
            アクセス拒否が発生しました
          </div>
          <div className="text-red-600 dark:text-red-400">
            <span className="text-red-500 dark:text-red-400">発生箇所: </span>
            <span className="font-medium">{trace.collaboratorName}</span>
          </div>
          {trace.accessDeniedReason && (
            <div className="text-red-600 dark:text-red-400">
              <span className="text-red-500 dark:text-red-400">理由: </span>
              <span>{trace.accessDeniedReason}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Main component =====

export interface CollaboratorDetailPanelProps {
  trace: AgentTeamTraceEvent;
  /** Start collapsed (default: true) */
  defaultCollapsed?: boolean;
}

/**
 * Collapsible detail panel for a single Collaborator Agent trace event.
 *
 * Displays:
 * 1. Agent name, role, status (header — always visible)
 * 2. Token counts (input/output) and execution time
 * 3. Role-specific details:
 *    - Permission Resolver: resolved SID/UID/GID, access denied reason
 *    - Retrieval Agent: KB ID, filter conditions, citation count (returned/excluded)
 * 4. Input/output context (collapsible JSON view)
 * 5. Access denied warning with reason when accessDenied=true
 *
 * Requirements: 7.2, 7.3, 7.4, 7.5
 */
export default function CollaboratorDetailPanel({
  trace,
  defaultCollapsed = true,
}: CollaboratorDetailPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const colors = getRoleColor(trace.collaboratorRole);
  const statusInfo = STATUS_DISPLAY[trace.status] ?? STATUS_DISPLAY.PENDING;

  return (
    <div
      className={`rounded-lg border ${colors.border} ${colors.bg} text-sm overflow-hidden`}
      role="region"
      aria-label={`${trace.collaboratorName} 詳細パネル`}
    >
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/40 dark:hover:bg-white/5 transition-colors"
        aria-expanded={!isCollapsed}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span aria-hidden="true">
            {ROLE_ICON[trace.collaboratorRole] ?? '🤖'}
          </span>
          <span className={`font-semibold ${colors.text} truncate`}>
            {trace.collaboratorName}
          </span>
          <span
            className={`text-xs ${statusInfo.className} flex-shrink-0`}
            aria-label={`ステータス: ${statusInfo.label}`}
          >
            {statusInfo.icon} {statusInfo.label}
          </span>
          {trace.accessDenied && (
            <span
              className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded flex-shrink-0"
              aria-label="アクセス拒否"
            >
              🚫 拒否
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {formatMs(trace.executionTimeMs)}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {!isCollapsed && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-200/60 dark:border-gray-600/40">
          {/* Access denied warning — prominent at top */}
          <div className="mt-3">
            <AccessDeniedWarning trace={trace} />
          </div>

          {/* Token counts & execution time */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md bg-white/60 dark:bg-gray-800/40 p-2 text-center">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                入力トークン
              </div>
              <div className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                {formatTokens(trace.inputTokens)}
              </div>
            </div>
            <div className="rounded-md bg-white/60 dark:bg-gray-800/40 p-2 text-center">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                出力トークン
              </div>
              <div className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                {formatTokens(trace.outputTokens)}
              </div>
            </div>
            <div className="rounded-md bg-white/60 dark:bg-gray-800/40 p-2 text-center">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                実行時間
              </div>
              <div className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                {formatMs(trace.executionTimeMs)}
              </div>
            </div>
          </div>

          {/* Role-specific details */}
          {trace.collaboratorRole === 'permission-resolver' && (
            <PermissionResolverDetails trace={trace} />
          )}
          {trace.collaboratorRole === 'retrieval' && (
            <RetrievalDetails trace={trace} />
          )}

          {/* Error display */}
          {trace.error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-2 text-xs text-red-700 dark:text-red-300">
              <span className="font-semibold">エラー: </span>
              {trace.error}
            </div>
          )}

          {/* Collapsible input/output context */}
          <CollapsibleJson label="入力コンテキスト" data={trace.inputContext} />
          <CollapsibleJson label="出力コンテキスト" data={trace.outputContext} />
        </div>
      )}
    </div>
  );
}
