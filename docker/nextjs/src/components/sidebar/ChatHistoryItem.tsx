import React from 'react';
import { useTranslations } from 'next-intl';

interface ChatHistoryItemProps {
  session: any;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  locale: string;
}

export function ChatHistoryItem({ session, isActive, onClick, onDelete, locale }: ChatHistoryItemProps) {
  const t = useTranslations('chat');
  
  // 簡単な日付フォーマット関数
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US');
  };

  return (
    <div className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
      isActive 
        ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700' 
        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
    }`}>
      <div onClick={onClick} className="flex-1">
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {session.title || t('untitledChat')}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {formatDate(session.createdAt)}
        </div>
      </div>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 
                   transition-opacity duration-200 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
        title={t('delete')}
      >
        <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
