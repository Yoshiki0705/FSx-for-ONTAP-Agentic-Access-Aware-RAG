'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Brain,
  FileText,
  Heart,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { EpisodeTab } from './EpisodeTab';

/**
 * メモリレコードの型定義
 */
interface MemoryRecord {
  id: string;
  content: string;
  strategyId?: string;
  score?: number;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

interface MemorySectionProps {
  /** ロケール */
  locale: string;
}

/**
 * strategyId からメモリタイプを推定する
 */
function getMemoryType(strategyId?: string): 'semantic' | 'summary' | 'userPreference' {
  if (!strategyId) return 'semantic';
  const lower = strategyId.toLowerCase();
  if (lower.includes('summary')) return 'summary';
  if (lower.includes('preference') || lower.includes('user')) return 'userPreference';
  return 'semantic';
}

/**
 * メモリタイプに応じたアイコンを返す
 */
function MemoryTypeIcon({ type }: { type: 'semantic' | 'summary' | 'userPreference' }) {
  switch (type) {
    case 'semantic':
      return <Brain className="w-3.5 h-3.5 text-blue-500" />;
    case 'summary':
      return <FileText className="w-3.5 h-3.5 text-amber-500" />;
    case 'userPreference':
      return <Heart className="w-3.5 h-3.5 text-pink-500" />;
  }
}

/**
 * MemorySection — 長期メモリ表示・削除UIコンポーネント
 *
 * POST /api/agentcore/memory/search からメモリレコードを取得し、
 * CollapsiblePanelで表示する。タイプ別アイコン表示、削除機能を提供。
 * AgentCore Memory無効時は非表示。
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export function MemorySection({ locale: _locale }: MemorySectionProps) {
  const t = useTranslations();

  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'memory' | 'episodes'>('memory');
  const [episodicEnabled, setEpisodicEnabled] = useState(false);

  /**
   * AgentCore Memory の有効状態を確認
   */
  useEffect(() => {
    fetch('/api/agentcore/memory/session', { method: 'GET' })
      .then((res) => {
        setMemoryEnabled(res.status !== 501);
      })
      .catch(() => {
        setMemoryEnabled(false);
      });
    // エピソード記憶の有効状態を確認
    fetch('/api/agentcore/memory/episodes', { method: 'GET' })
      .then((res) => {
        setEpisodicEnabled(res.status !== 404);
      })
      .catch(() => {
        setEpisodicEnabled(false);
      });
  }, []);

  /**
   * メモリレコードを取得（セマンティック検索）
   */
  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agentcore/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '*', limit: 20 }),
      });
      if (!res.ok) {
        if (res.status === 501) {
          setMemories([]);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setMemories(data.results);
      } else {
        setMemories([]);
      }
    } catch (err: any) {
      console.error('[MemorySection] メモリ取得エラー:', err);
      setError(err.message || 'Failed to fetch memories');
      setMemories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // パネルが開かれたときにメモリを取得
  useEffect(() => {
    if (isOpen && memoryEnabled) {
      fetchMemories();
    }
  }, [isOpen, memoryEnabled, fetchMemories]);

  /**
   * メモリレコード削除
   */
  const handleDelete = useCallback(
    async (memoryId: string) => {
      const confirmed = window.confirm(t('agentcore.memory.deleteConfirm'));
      if (!confirmed) return;

      setDeletingId(memoryId);
      try {
        const res = await fetch('/api/agentcore/memory/search', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memoryRecordId: memoryId }),
        });
        if (res.ok) {
          setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        } else {
          console.error('[MemorySection] 削除エラー: HTTP', res.status);
        }
      } catch (err: any) {
        console.error('[MemorySection] 削除エラー:', err);
      } finally {
        setDeletingId(null);
      }
    },
    [t]
  );

  /**
   * メモリタイプのラベルを取得
   */
  const getTypeLabel = useCallback(
    (type: 'semantic' | 'summary' | 'userPreference') => {
      switch (type) {
        case 'semantic':
          return t('agentcore.memory.semantic');
        case 'summary':
          return t('agentcore.memory.summary');
        case 'userPreference':
          return t('agentcore.memory.userPreference');
      }
    },
    [t]
  );

  // AgentCore Memory無効時は非表示
  if (memoryEnabled === null || memoryEnabled === false) {
    return null;
  }

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <Collapsible.Trigger asChild>
        <button
          className="flex items-center justify-between w-full text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          aria-label={t('agentcore.memory.title')}
        >
          <span>{t('agentcore.memory.title')}</span>
          {isOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content className="mt-2 space-y-1">
        {/* タブ切替（エピソード記憶有効時のみ） */}
        {episodicEnabled && (
          <div className="flex border-b border-gray-200 dark:border-gray-600 mb-2">
            <button
              onClick={() => setActiveTab('memory')}
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                activeTab === 'memory'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('agentcore.memory.title')}
            </button>
            <button
              onClick={() => setActiveTab('episodes')}
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                activeTab === 'episodes'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('agentcore.episodes.tab')}
            </button>
          </div>
        )}

        {/* エピソードタブ */}
        {activeTab === 'episodes' && episodicEnabled && (
          <EpisodeTab locale={_locale} />
        )}

        {/* メモリタブ（既存） */}
        {activeTab === 'memory' && (<>
        {/* ローディング */}
        {isLoading && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              {t('common.loading')}
            </span>
          </div>
        )}

        {/* エラー */}
        {error && !isLoading && (
          <div className="flex items-center space-x-2 p-2 rounded-md bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* メモリなし */}
        {!isLoading && !error && memories.length === 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">
            {t('agentcore.memory.noMemories')}
          </div>
        )}

        {/* メモリレコード一覧 */}
        {!isLoading && memories.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {memories.map((memory) => {
              const memoryType = getMemoryType(memory.strategyId);
              return (
                <div
                  key={memory.id}
                  className="group flex items-start space-x-2 p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-xs"
                >
                  {/* タイプアイコン */}
                  <div className="flex-shrink-0 mt-0.5" title={getTypeLabel(memoryType)}>
                    <MemoryTypeIcon type={memoryType} />
                  </div>

                  {/* コンテンツ */}
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-600 dark:text-gray-300 line-clamp-2">
                      {memory.content}
                    </div>
                    <div className="mt-1 text-gray-400 dark:text-gray-500">
                      {getTypeLabel(memoryType)}
                    </div>
                  </div>

                  {/* 削除ボタン */}
                  <button
                    onClick={() => handleDelete(memory.id)}
                    disabled={deletingId === memory.id}
                    className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 disabled:opacity-50"
                    aria-label={t('common.delete')}
                    title={t('common.delete')}
                  >
                    {deletingId === memory.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        </>)}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
