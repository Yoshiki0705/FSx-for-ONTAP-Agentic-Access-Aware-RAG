'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { EpisodeCard } from './EpisodeCard';
import { EpisodeDetailPanel } from './EpisodeDetailPanel';
import { EpisodeSearch } from './EpisodeSearch';
import type { Episode } from '@/types/episode';

interface EpisodeTabProps {
  locale: string;
}

/**
 * EpisodeTab — エピソード一覧・検索・詳細表示タブ
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.2, 8.5, 9.1
 */
export function EpisodeTab({ locale }: EpisodeTabProps) {
  const t = useTranslations();

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const fetchEpisodes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agentcore/memory/episodes?limit=20');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.episodes)) {
        setEpisodes(data.episodes);
      } else {
        setEpisodes([]);
      }
    } catch (err: any) {
      console.error('[EpisodeTab] エピソード取得エラー:', err);
      setError(t('agentcore.episodes.fetchError'));
      setEpisodes([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      fetchEpisodes();
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch('/api/agentcore/memory/episodes/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 20 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setEpisodes(data.results);
      } else {
        setEpisodes([]);
      }
    } catch (err: any) {
      console.error('[EpisodeTab] 検索エラー:', err);
      setError(t('agentcore.episodes.fetchError'));
    } finally {
      setIsSearching(false);
    }
  }, [t, fetchEpisodes]);

  const handleDelete = useCallback(async (episodeId: string) => {
    const confirmed = window.confirm(t('agentcore.episodes.deleteConfirm'));
    if (!confirmed) return;

    // 楽観的UI更新
    const previousEpisodes = [...episodes];
    setEpisodes((prev) => prev.filter((ep) => ep.id !== episodeId));

    try {
      const res = await fetch('/api/agentcore/memory/episodes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // 詳細パネルが開いていたら閉じる
      if (selectedEpisode?.id === episodeId) {
        setSelectedEpisode(null);
      }
    } catch (err: any) {
      console.error('[EpisodeTab] 削除エラー:', err);
      // ロールバック
      setEpisodes(previousEpisodes);
      setError(t('agentcore.episodes.deleteError'));
    }
  }, [episodes, selectedEpisode, t]);

  const handleSelect = useCallback((episodeId: string) => {
    const ep = episodes.find((e) => e.id === episodeId);
    setSelectedEpisode(ep || null);
  }, [episodes]);

  return (
    <div className="space-y-2">
      {/* 検索 + リフレッシュ */}
      <div className="flex items-center gap-1">
        <div className="flex-1">
          <EpisodeSearch onSearch={handleSearch} />
        </div>
        <button
          onClick={fetchEpisodes}
          disabled={isLoading}
          className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label={t('agentcore.episodes.refreshButton')}
          title={t('agentcore.episodes.refreshButton')}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ローディング */}
      {(isLoading || isSearching) && (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      )}

      {/* エラー */}
      {error && !isLoading && (
        <div className="flex items-center space-x-2 p-2 rounded-md bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* エピソードなし */}
      {!isLoading && !isSearching && !error && episodes.length === 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">
          {t('agentcore.episodes.noEpisodes')}
        </div>
      )}

      {/* エピソード一覧 */}
      {!isLoading && episodes.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {episodes.map((episode) => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              onDelete={handleDelete}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {/* 詳細パネル */}
      {selectedEpisode && (
        <EpisodeDetailPanel
          episode={selectedEpisode}
          isOpen={true}
          onClose={() => setSelectedEpisode(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
