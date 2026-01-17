'use client';

import React from 'react';
import { X, Bot, Settings, User, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTranslations } from 'next-intl';
import type { ChatSession } from '@/types/chat';
import { AgentInfoSection } from '@/components/bedrock/AgentInfoSection';
import { RegionSelector } from '@/components/bedrock/RegionSelector';
import { AgentModelSelector } from '@/components/bedrock/AgentModelSelector';
import { useAgentInfo } from '@/hooks/useAgentInfo';

interface AgentModeSidebarProps {
  locale: string;
  isOpen: boolean;
  onClose: () => void;
  currentSessionId?: string;
  sessions?: ChatSession[];
  onNewChat: () => void;
  onSessionSwitch?: (sessionId: string) => void;
  onSessionDelete?: (sessionId: string) => void;
  userName?: string;
  userEmail?: string;
  onCreateAgent?: () => void;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
}

export function AgentModeSidebar({
  locale,
  isOpen,
  onClose,
  onNewChat,
  userName = 'ユーザー',
  userEmail,
  selectedModelId,
  onModelChange,
}: AgentModeSidebarProps) {
  const t = useTranslations();
  const tModel = useTranslations('model.selector');  // ✅ モデル選択用の翻訳フック追加
  
  // 環境変数からAgent IDを取得
  const agentId = typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_BEDROCK_AGENT_ID || ''
    : '';
  
  // Agent情報を取得（Agent IDが存在する場合のみ）
  const { agentInfo, isLoading, error } = useAgentInfo({
    agentId,
    enabled: !!agentId,
    onSuccess: (data) => {
      console.log('✅ [AgentModeSidebar] Agent情報取得成功:', data);
    },
    onError: (error) => {
      console.error('❌ [AgentModeSidebar] Agent情報取得エラー:', error);
    }
  });
  
  if (!isOpen) {
    return null;
  }

  const handleSettings = () => {
    console.log('🔧 [AgentModeSidebar] Settings button clicked');
    alert(t('common.loading') + ' - ' + t('sidebar.settings'));
  };

  return (
    <div className="h-full bg-white dark:bg-gray-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {userName}
            </h2>
            {userEmail && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {userEmail}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewChat}
            className="p-2"
            aria-label={t('sidebar.newChat')}
            title={`${t('sidebar.newChat')} (Ctrl+N)`}
          >
            <Plus className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSettings}
            className="p-2"
            aria-label={t('sidebar.settings')}
            title={t('sidebar.settings')}
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

      {/* Mode Badge */}
      <div className="px-4 pt-3">
        <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
          <div className="w-2 h-2 rounded-full bg-purple-500 mr-2 animate-pulse"></div>
          <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
            {t('sidebar.agentMode')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Agent Information Section - 過去の実装を復旧 */}
        <AgentInfoSection agentInfo={agentInfo} />

        <div className="border-t border-gray-200 dark:border-gray-700" />

        {/* Region Selection Section - 復旧 */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('sidebar.regionSelection')}
          </h3>
          <RegionSelector />
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700" />

        {/* Agent Model Selection Section - 復旧 */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {tModel('title')}
          </h3>
          {agentId && (
            <AgentModelSelector
              agentId={agentId}
              currentModelId={agentInfo?.foundationModel || selectedModelId || ''}
              locale={locale}
              onModelChange={(modelId) => {
                console.log('🔄 [AgentModeSidebar] Agent モデル変更:', modelId);
                if (onModelChange) {
                  onModelChange(modelId);
                }
              }}
            />
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700" />

        {/* Chat History Settings Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('sidebar.chatHistorySettings')}
          </h3>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
              />
              <span>{t('sidebar.saveHistory')}</span>
            </label>
            <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
              />
              <span>{t('sidebar.autoTitleGeneration')}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{t('sidebar.agentMode')}</span>
          <span className="text-purple-600 dark:text-purple-400">
            {t('sidebar.sessionActive')}
          </span>
        </div>
      </div>
    </div>
  );
}