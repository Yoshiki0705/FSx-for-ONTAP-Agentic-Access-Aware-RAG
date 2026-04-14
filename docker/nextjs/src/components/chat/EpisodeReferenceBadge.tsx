'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface EpisodeReferenceBadgeProps {
  episodeCount: number;
}

/**
 * EpisodeReferenceBadge — 類似エピソード参照バッジ
 *
 * episodeCount > 0 時に「📚 過去の経験を参照 (N件)」バッジを表示する。
 *
 * Requirements: 5.4
 */
export function EpisodeReferenceBadge({ episodeCount }: EpisodeReferenceBadgeProps) {
  const t = useTranslations();

  if (!episodeCount || episodeCount <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700">
      📚 {t('agentcore.episodes.referenceBadge')} ({episodeCount})
    </span>
  );
}
