import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';

'use client';

import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { useRef, useMemo } from 'react';
import { ChatSession } from '@/types/chat';
import { ChatHistoryItem } from './ChatHistoryItem';

interface VirtualChatHistoryProps {
  /** チャットセッション一覧 */
  sessions: ChatSession[];
  /** アクティブなセッションID */
  activeSessionId?: string;
  /** セッション選択時のコールバック */
  onSessionSelect: (sessionId: string) => void;
  /** セッション削除時のコールバック */
  onSessionDelete?: (sessionId: string) => void;
  /** 検索クエリ */
  searchQuery?: string;
}

/**
 * 仮想スクロールt("permissions.available")のチャット履歴コンポーネント
 * @tanstack/react-virtualを使用して大量のデータを効率的に表示
 */
  const locale = useLocale();
  const t = useCustomTranslations(locale);

export function VirtualChatHistory({
  sessions,
  activeSessionId,
  onSessionSelect,
  onSessionDelete,
  searchQuery = ''
}: VirtualChatHistoryProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // 検索クエリでフィルタリング
  const filteredSessions = useMemo(() => {
    if (!sessions || !Array.isArray(sessions)) return [];
    if (!searchQuery.trim()) return sessions;
    
    const query = searchQuery.toLowerCase();
    return sessions.filter(session => 
      session.title?.toLowerCase().includes(query) ||
      session.messages?.some(message => 
        message.content?.toLowerCase().includes(query)
      )
    );
  }, [sessions, searchQuery]);

  // 仮想スクロールの設定
  const virtualizer = useVirtualizer({
    count: filteredSessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // 各アイテムの推定高さ（px）
    overscan: 5, // 画面外にレンダリングするアイテム数
    getItemKey: (index: number) => filteredSessions[index]?.id || index
  });

  // セッションが空の場合
  if (filteredSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
        {searchQuery ? (
          <>
            <div className="text-sm">検索結果が見つかりません</div>
            <div className="text-xs mt-1">「{searchQuery}」に一致するチャットがありません</div>
          </>
        ) : (
          <>
            <div className="text-sm">チャット履歴がありません</div>
            <div className="text-xs mt-1">新しいチャットを開始してください</div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto"
      role="list"
      aria-label="チャット履歴"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem: VirtualItem) => {
          const session = filteredSessions[virtualItem.index];
          if (!session) return null;

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`
              }}
              role="listitem"
            >
              <ChatHistoryItem
                session={session}
                isActive={session.id === activeSessionId}
                onClick={() => onSessionSelect(session.id)}
                onDelete={onSessionDelete ? (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onSessionDelete(session.id);
                } : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
