'use client';

import React, { useState } from 'react';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';
import { X, Settings, Moon, Sun, Globe, Save } from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';
import * as Dialog from '@radix-ui/react-dialog';

export function SettingsPanel() {
  const locale = useLocale();
  const t = useCustomTranslations(locale);
  const [isOpen, setIsOpen] = useState(false);
  const { 
    chat, 
    theme, 
    language, 
    updateChat, 
    updateTheme, 
    updateLanguage 
  } = useSettingsStore();

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors">
          <Settings className="h-4 w-4" />
          {t('sidebar.settings')}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md z-50">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold">
              {t('sidebar.settings')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={`${t('sidebar.settings')}を閉じる`}
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6">
            {/* チャット自動保存設定 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                {t('settings.autoSave')}
              </label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {t('settings.autoSaveDescription')}
                </span>
                <button
                  onClick={() => updateChat({ autoSave: !chat.autoSave })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    chat.autoSave 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {chat.autoSave ? t('common.enabled') : t('common.disabled')}
                </button>
              </div>
            </div>

            {/* テーマ設定 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                {t('settings.theme')}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateTheme('light')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    theme === 'light'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  {t('settings.lightTheme')}
                </button>
                <button
                  onClick={() => updateTheme('dark')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    theme === 'dark'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  {t('settings.darkTheme')}
                </button>
              </div>
            </div>

            {/* 言語設定 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                {t('settings.language')}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateLanguage('ja')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    language === 'ja'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Globe className="h-4 w-4" />
                  日本語
                </button>
                <button
                  onClick={() => updateLanguage('en')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    language === 'en'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Globe className="h-4 w-4" />
                  English
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                {t('common.cancel')}
              </button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                <Save className="h-4 w-4" />
                {t('common.save')}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}