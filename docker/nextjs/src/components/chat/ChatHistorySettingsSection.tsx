'use client';

import React, { useCallback } from 'react';
import { useSafeTranslations } from '../../hooks/useSafeTranslations';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { SaveStatus } from '@/hooks/useChatHistory';

interface ChatHistorySettingsSectionProps {
  chatSettings: {
    autoSave: boolean;
  };
  updateChat: (settings: { autoSave: boolean }) => void;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  className?: string;
}

export function ChatHistorySettingsSection({
  chatSettings,
  updateChat,
  saveStatus,
  lastSavedAt,
  className = ''
}: ChatHistorySettingsSectionProps) {
  const { t } = useSafeTranslations();

  const handleAutoSaveChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateChat({ autoSave: e.target.checked });
  }, [updateChat]);

  return (
    <div className={`border-t border-gray-200 pt-4 mt-4 mb-6 ${className}`}>
      <h3 className="flex items-center gap-2 mb-4 text-base font-semibold text-gray-800">
        💾 {t('chat.chatHistory', 'Chat History')}
      </h3>
      
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        {/* Auto-save Toggle */}
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input
              type="checkbox"
              checked={chatSettings.autoSave}
              onChange={handleAutoSaveChange}
              className="w-4 h-4 cursor-pointer accent-blue-600"
            />
            {t('sidebar.autoSave', 'Auto Save')}
          </label>
          
          {/* Auto-save Indicator */}
          {chatSettings.autoSave && (
            <AutoSaveIndicator
              status={saveStatus}
              lastSavedAt={lastSavedAt}
              className="ml-2"
            />
          )}
        </div>
        
        {/* Description */}
        <p className="text-xs text-gray-600 leading-relaxed m-0">
          {t('sidebar.autoSave', 'Automatically save chat history')}
        </p>
      </div>
    </div>
  );
}