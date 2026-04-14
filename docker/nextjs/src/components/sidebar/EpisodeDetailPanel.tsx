'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { Episode } from '@/types/episode';

interface EpisodeDetailPanelProps {
  episode: Episode;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (episodeId: string) => void;
}

/**
 * 折りたたみ可能なセクション
 */
function CollapsibleSection({ title, children, defaultOpen = false }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-gray-200 dark:border-gray-600">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center w-full py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
      >
        {open ? <ChevronDown className="w-3 h-3 mr-1" /> : <ChevronRight className="w-3 h-3 mr-1" />}
        {title}
      </button>
      {open && <div className="pb-2 text-xs text-gray-600 dark:text-gray-400">{children}</div>}
    </div>
  );
}

/**
 * EpisodeDetailPanel — エピソード詳細パネル
 *
 * Requirements: 4.2, 4.4, 7.5
 */
export function EpisodeDetailPanel({ episode, isOpen, onClose, onDelete }: EpisodeDetailPanelProps) {
  const t = useTranslations();

  if (!isOpen) return null;

  const statusLabel = episode.outcome?.status === 'success'
    ? t('agentcore.episodes.statusSuccess')
    : episode.outcome?.status === 'partial'
      ? t('agentcore.episodes.statusPartial')
      : t('agentcore.episodes.statusFailure');

  return (
    <div className="mt-2 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            {t('agentcore.episodes.goal')}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
            {episode.goal || '—'}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => onDelete(episode.id)}
            className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
            aria-label={t('common.delete')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 結果 */}
      <div className="mb-2">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          {t('agentcore.episodes.outcome')} — {statusLabel}
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
          {episode.outcome?.summary || '—'}
        </div>
      </div>

      {/* 推論ステップ（折りたたみ） */}
      <CollapsibleSection title={t('agentcore.episodes.steps')}>
        {episode.steps && episode.steps.length > 0 ? (
          <ol className="list-decimal list-inside space-y-1">
            {episode.steps.map((step, i) => (
              <li key={i}>{step.reasoning}</li>
            ))}
          </ol>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </CollapsibleSection>

      {/* アクション（折りたたみ） */}
      <CollapsibleSection title={t('agentcore.episodes.actions')}>
        {episode.actions && episode.actions.length > 0 ? (
          <ul className="space-y-1">
            {episode.actions.map((action, i) => (
              <li key={i} className="flex flex-col">
                <span className="font-medium">{action.name}</span>
                {action.input && <span className="text-gray-400 truncate">→ {action.input}</span>}
                {action.result && <span className="text-gray-400 truncate">← {action.result}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </CollapsibleSection>

      {/* 振り返り（折りたたみ） */}
      <CollapsibleSection title={t('agentcore.episodes.reflection')}>
        <div>{episode.reflection || '—'}</div>
      </CollapsibleSection>
    </div>
  );
}
