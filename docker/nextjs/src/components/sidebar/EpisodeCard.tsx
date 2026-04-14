'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import type { Episode } from '@/types/episode';

interface EpisodeCardProps {
  episode: Episode;
  onDelete: (episodeId: string) => void;
  onSelect: (episodeId: string) => void;
}

/**
 * ステータスアイコンを返す
 */
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'success':
      return <span title="Success">✅</span>;
    case 'partial':
      return <span title="Partial">⚠️</span>;
    case 'failure':
      return <span title="Failure">❌</span>;
    default:
      return <span>❓</span>;
  }
}

/**
 * EpisodeCard — エピソード概要カード
 *
 * Requirements: 4.1, 4.2, 4.3, 7.1
 */
export function EpisodeCard({ episode, onDelete, onSelect }: EpisodeCardProps) {
  const t = useTranslations();

  return (
    <div
      className="group flex items-start space-x-2 p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
      onClick={() => onSelect(episode.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(episode.id); }}
    >
      {/* ステータスアイコン */}
      <div className="flex-shrink-0 mt-0.5">
        <StatusIcon status={episode.outcome?.status || 'failure'} />
      </div>

      {/* コンテンツ */}
      <div className="flex-1 min-w-0">
        {/* 目標（最大2行） */}
        <div className="text-gray-700 dark:text-gray-200 line-clamp-2 font-medium">
          {episode.goal || '—'}
        </div>
        {/* ステップ数 + 結果サマリー */}
        <div className="mt-1 flex items-center gap-2 text-gray-400 dark:text-gray-500">
          <span>{t('agentcore.episodes.stepCount', { count: episode.steps?.length || 0 })}</span>
          <span className="truncate">{episode.outcome?.summary || ''}</span>
        </div>
        {/* 作成日時 */}
        {episode.createdAt && (
          <div className="mt-0.5 text-gray-400 dark:text-gray-500">
            {new Date(episode.createdAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* 削除ボタン（ホバー時表示） */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(episode.id); }}
        className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
        aria-label={t('common.delete')}
        title={t('common.delete')}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
