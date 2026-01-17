'use client';

import React from 'react';
import { ChatHistoryItem } from './ChatHistoryItem';
import type { ChatSession } from '@/types/chat';

interface ChatHistoryListProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
  isLoading: boolean;
}

export function ChatHistoryList({
  sessions,
  currentSessionId,
  onSessionSelect,
  onSessionDelete,
  isLoading
}: ChatHistoryListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p className="text-sm">チャット履歴がありません</p>
        <p className="text-xs mt-1">新しいチャットを開始してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 overflow-y-auto max-h-[calc(100vh-300px)]">
      {(sessions || []).map((session) => (
        <ChatHistoryItem
          key={session.id}
          session={session}
          isActive={session.id === currentSessionId}
          onClick={() => onSessionSelect(session.id)}
          onDelete={() => onSessionDelete(session.id)}
        />
      ))}
    </div>
  );
}
