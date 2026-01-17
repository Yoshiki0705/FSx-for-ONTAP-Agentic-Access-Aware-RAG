import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';

'use client';

import { useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { AnimatedSidebar, AnimatedSidebarContent, AnimatedSidebarItem } from './AnimatedSidebar';
import { ChatHistorySearch } from './ChatHistorySearch';
import { SidebarSections } from './SidebarSections';
import { Plus, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId?: string;
  onNewChat: () => void;
  onSessionSelect: (sessionId: string) => void;
}

export function Sidebar({ isOpen, onClose, currentSessionId, onNewChat, onSessionSelect }: SidebarProps) {
  const locale = useLocale();
  const t = useCustomTranslations(locale);
  
  // searchQueryをローカルstateに変更
  const [searchQuery, setSearchQuery] = useState('');

  // チャットストアから実際のセッションを取得
  const { chatSessions, deleteChatSession } = useChatStore();

  // セッションを日付でソート（新しい順）
  const sortedSessions = [...chatSessions].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const handleSessionDelete = (sessionId: string) => {
    if (confirm('このチャットを削除しますか？')) {
      deleteChatSession(sessionId);
    }
  };

  const handleSettings = () => {
    console.log('Open settings');
  };
  
  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <AnimatedSidebar isOpen={isOpen}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            チャット履歴
          </h2>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewChat}
              className="p-2"
              aria-label="新しいチャット"
              title="新しいチャット (Ctrl+N)"
            >
              <Plus className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSettings}
              className="p-2"
              aria-label="設定"
              title="設定"
            >
              <Settings className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2 md:hidden"
              aria-label="サイドバーを閉じる"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="mt-3">
          <ChatHistorySearch
            onSearch={setSearchQuery}
            initialValue={searchQuery}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarSections
          sessions={sortedSessions}
          activeSessionId={currentSessionId}
          onSessionSelect={onSessionSelect}
          onSessionDelete={handleSessionDelete}
          searchQuery={searchQuery}
        />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{sortedSessions.length}件のチャット</span>
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              検索をクリア
            </button>
          )}
        </div>
      </div>
    </AnimatedSidebar>
  );
}
