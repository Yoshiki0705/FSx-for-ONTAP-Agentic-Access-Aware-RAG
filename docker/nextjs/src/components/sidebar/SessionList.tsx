'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, MessageSquare, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * AgentCore Memory セッション情報
 */
interface AgentCoreSession {
  sessionId: string;
  title?: string;
  mode?: string;
  createdAt?: string;
  updatedAt?: string;
  messageCount?: number;
}

interface SessionListProps {
  /** 現在アクティブなセッションID */
  activeSessionId?: string;
  /** セッション選択時のコールバック */
  onSessionSelect: (sessionId: string) => void;
  /** 新しいチャット作成時のコールバック */
  onNewChat: () => void;
  /** ロケール */
  locale: string;
}

/**
 * SessionList — AgentCore Memory セッション一覧コンポーネント
 *
 * GET /api/agentcore/memory/session からセッション一覧を取得し、
 * サイドバーに表示する。セッション選択で会話履歴を読み込み、
 * 「新しいチャット」ボタンで新規セッションを作成する。
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export function SessionList({
  activeSessionId,
  onSessionSelect,
  onNewChat,
  locale,
}: SessionListProps) {
  const t = useTranslations();

  const [sessions, setSessions] = useState<AgentCoreSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  /**
   * セッション一覧を取得
   */
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agentcore/memory/session');
      if (!res.ok) {
        // 501 = Memory無効 → 空リスト表示
        if (res.status === 501) {
          setSessions([]);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      } else {
        setSessions([]);
      }
    } catch (err: any) {
      console.error('[SessionList] セッション一覧取得エラー:', err);
      setError(err.message || 'Failed to fetch sessions');
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 新しいセッションを作成
   */
  const handleCreateSession = useCallback(async () => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/agentcore/memory/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'agent' }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && data.session?.sessionId) {
        // 新しいセッションをリストの先頭に追加
        setSessions((prev) => [
          {
            sessionId: data.session.sessionId,
            title: undefined,
            mode: data.session.mode,
            createdAt: data.session.createdAt,
            updatedAt: data.session.createdAt,
            messageCount: 0,
          },
          ...prev,
        ]);
        // 親コンポーネントに新しいチャット作成を通知
        onNewChat();
        // 新しいセッションを選択
        onSessionSelect(data.session.sessionId);
      }
    } catch (err: any) {
      console.error('[SessionList] セッション作成エラー:', err);
    } finally {
      setIsCreating(false);
    }
  }, [onNewChat, onSessionSelect]);

  /**
   * セッション選択 → 会話履歴を読み込み
   */
  const handleSessionClick = useCallback(
    async (sessionId: string) => {
      onSessionSelect(sessionId);
    },
    [onSessionSelect]
  );

  // 初回マウント時にセッション一覧を取得
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  /**
   * 日時フォーマット
   */
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(locale === 'ja' ? 'ja-JP' : locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-2">
      {/* ヘッダー: セッション一覧タイトル + 新規作成ボタン */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t('agentcore.session.title')}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCreateSession}
          disabled={isCreating}
          className="p-1.5"
          aria-label={t('agentcore.session.newSession')}
          title={t('agentcore.session.newSession')}
        >
          {isCreating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* ローディング */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
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

      {/* セッション一覧 */}
      {!isLoading && !error && sessions.length === 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">
          {t('agentcore.session.noSessions')}
        </div>
      )}

      {!isLoading && sessions.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {sessions.map((session) => (
            <button
              key={session.sessionId}
              onClick={() => handleSessionClick(session.sessionId)}
              className={`w-full text-left p-2 rounded-md text-xs transition-colors ${
                activeSessionId === session.sessionId
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <div className="font-medium truncate">
                {session.title || `Session ${session.sessionId.substring(0, 8)}...`}
              </div>
              <div className="flex items-center justify-between mt-1 text-gray-500 dark:text-gray-400">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(session.updatedAt || session.createdAt)}</span>
                </span>
                {session.messageCount !== undefined && (
                  <span className="flex items-center space-x-1">
                    <MessageSquare className="w-3 h-3" />
                    <span>{session.messageCount}</span>
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
