'use client';


import React, { useState } from 'react';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { Modal } from '@/components/ui/Modal';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';

interface Shortcut {
  key: string;
  description: string;
  category: string;
}

/**
 * キーボードショートカットヘルプモーダル
 * 利用可能なショートカットを表示
 */
export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const locale = useLocale();
  const t = useCustomTranslations(locale);

  // ? キーでヘルプを開く
  useKeyboardShortcut({ key: '?' }, () => setIsOpen(true));

  const shortcuts: Shortcut[] = [
    {
      key: '?',
      description: t('shortcuts.help') || 'このヘルプを表示',
      category: t('shortcuts.general') || '一般',
    },
    {
      key: 'Esc',
      description: t('shortcuts.close') || 'モーダルを閉じる',
      category: t('shortcuts.general') || '一般',
    },
    {
      key: 'Ctrl/Cmd + K',
      description: t('shortcuts.search') || '検索を開く',
      category: t('shortcuts.navigation') || 'ナビゲーション',
    },
    {
      key: 'Tab',
      description: t('shortcuts.nextElement') || '次の要素へ移動',
      category: t('shortcuts.navigation') || 'ナビゲーション',
    },
    {
      key: 'Shift + Tab',
      description: t('shortcuts.prevElement') || '前の要素へ移動',
      category: t('shortcuts.navigation') || 'ナビゲーション',
    },
    {
      key: 'Enter',
      description: t('shortcuts.submit') || '送信/実行',
      category: t('shortcuts.actions') || 'アクション',
    },
    {
      key: 'Space',
      description: t('shortcuts.select') || '選択/トグル',
      category: t('shortcuts.actions') || 'アクション',
    },
  ];

  // カテゴリ別にグループ化
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title={t('shortcuts.title') || 'キーボードショートカット'}
      size="lg"
    >
      <div className="space-y-6">
        {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
              {category}
            </h3>
            <div className="space-y-2">
              {categoryShortcuts.map((shortcut) => (
                <div
                  key={shortcut.key}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-gray-50 dark:bg-gray-800"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    {shortcut.description}
                  </span>
                  <kbd className="px-3 py-1 text-sm font-semibold text-gray-800 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
