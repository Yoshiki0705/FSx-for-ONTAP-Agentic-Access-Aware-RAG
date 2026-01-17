'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ChatSession } from '@/types/chat';

interface ChatHistoryItemProps {
  session: ChatSession;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export function ChatHistoryItem({
  session,
  isActive,
  onClick,
  onDelete
}: ChatHistoryItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  // セッションタイトル生成（最初のメッセージから）
  const title = session.messages[0]?.content.slice(0, 30) || '新しいチャット';
  const messageCount = session.messages.length;
  const lastUpdated = new Date(session.updatedAt);
  
  // 相対時間表示
  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return date.toLocaleDateString('ja-JP');
  };

  return (
    <div
      className={`
        relative p-3 rounded-lg cursor-pointer transition-all
        ${isActive 
          ? 'bg-blue-50 border-2 border-blue-500' 
          : 'bg-white border border-gray-200 hover:border-gray-300'
        }
      `}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* アクティブインジケーター */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-lg"></div>
      )}
      
      {/* セッション情報 */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-900' : 'text-gray-900'}`}>
            {title}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {messageCount}件 • {getRelativeTime(lastUpdated)}
          </p>
        </div>
        
        {/* 削除ボタン */}
        {isHovered && !isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
            aria-label="削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
