'use client';

import { useEffect, useCallback } from 'react';
import type { AgentTeamTemplate } from '@/types/multi-agent';
import { AgentMetadataBadges } from './AgentMetadataBadges';

/**
 * TemplateImportPreviewDialog — Team テンプレートインポートプレビューダイアログ
 *
 * AgentTeamTemplate の内容をプレビュー表示し、ユーザーの確認後にインポートを実行する。
 * デザインドキュメントのワイヤーフレーム「テンプレートインポートプレビュー」に準拠。
 *
 * Validates: Requirements 9.7
 */

/** Collaborator role の表示用アイコンマッピング */
const ROLE_ICONS: Record<string, string> = {
  'permission-resolver': '🔑',
  retrieval: '📚',
  analysis: '📊',
  output: '📝',
  vision: '👁️',
};

function getRoleIcon(role: string): string {
  return ROLE_ICONS[role] ?? '🤖';
}

/** RoutingMode の表示ラベル */
function getRoutingModeLabel(mode: string): string {
  switch (mode) {
    case 'supervisor_router':
      return 'Supervisor Router（低レイテンシ）';
    case 'supervisor':
      return 'Supervisor（タスク分解あり）';
    default:
      return mode;
  }
}

export interface TemplateImportPreviewDialogProps {
  /** プレビュー対象のテンプレート */
  template: AgentTeamTemplate;
  /** インポート実行コールバック */
  onImport: () => void;
  /** キャンセルコールバック */
  onCancel: () => void;
  /** インポート処理中フラグ */
  isImporting?: boolean;
}

export function TemplateImportPreviewDialog({
  template,
  onImport,
  onCancel,
  isImporting = false,
}: TemplateImportPreviewDialogProps) {
  // Escape キーでダイアログを閉じる
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isImporting) {
        onCancel();
      }
    },
    [onCancel, isImporting],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Team テンプレートインポート"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span aria-hidden="true">📥</span>
            Team テンプレートインポート
          </h3>
        </div>

        {/* Scrollable content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* Team overview */}
          <div className="space-y-2 mb-5">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-32 shrink-0">
                Team名:
              </span>
              <span className="text-sm text-gray-900 dark:text-gray-100 font-semibold">
                {template.teamName}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-32 shrink-0">
                説明:
              </span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {template.description || '—'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-32 shrink-0">
                ルーティング:
              </span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {getRoutingModeLabel(template.routingMode)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-32 shrink-0">
                自動ルーティング:
              </span>
              <span className="text-sm text-gray-900 dark:text-gray-100">
                {template.autoRouting ? '有効' : '無効'}
              </span>
            </div>
          </div>

          {/* Collaborators list */}
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Collaborators ({template.collaborators.length}):
            </h4>
            <ul
              className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              role="list"
              aria-label="Collaborator 一覧"
            >
              {template.collaborators.map((collab, index) => (
                <li
                  key={`${collab.role}-${index}`}
                  className="px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                  role="listitem"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span aria-hidden="true">{getRoleIcon(collab.role)}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {collab.agentName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({collab.role})
                    </span>
                  </div>
                  <AgentMetadataBadges
                    toolProfiles={collab.toolProfiles}
                    trustLevel={collab.trustLevel}
                    dataBoundary={collab.dataBoundary}
                    compact
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* Warning about missing secrets */}
          <div
            className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
            role="alert"
          >
            <span className="text-yellow-600 dark:text-yellow-400 shrink-0" aria-hidden="true">
              ⚠️
            </span>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              シークレット情報は含まれていません。インポート後にIAMロール等の環境設定が必要です。
            </p>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isImporting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={isImporting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isImporting && (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isImporting ? 'インポート中...' : 'インポート実行'}
          </button>
        </div>
      </div>
    </div>
  );
}
