'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface ModeSwitcherProps {
  agentMode: boolean;
  onModeChange: (agentMode: boolean) => void;
  className?: string;
}

/**
 * モード切り替えコンポーネント（ドロップダウン形式）
 * 
 * Phase 12/15 Feature Restoration:
 * - Agent/KBモードをドロップダウンで切り替え
 * - ライトモード/ダークモード対応
 */
export function ModeSwitcher({ 
  agentMode, 
  onModeChange,
  className = '' 
}: ModeSwitcherProps) {
  const t = useTranslations('chatbot.mode');  // chatbot.mode名前空間を使用
  const tCommon = useTranslations('chatbot');  // 共通の翻訳用
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const switchMode = (newMode: boolean) => {
    console.log(`[ModeSwitcher] モード切り替え: ${agentMode ? 'Agent' : 'KB'} → ${newMode ? 'Agent' : 'KB'}`);
    onModeChange(newMode);
    setIsOpen(false);
  };

  // SSR時は何も表示しない（hydration mismatch回避）
  if (!isMounted) {
    return null;
  }

  const modes = [
    {
      id: 'agent',
      value: true,
      icon: '🤖',
      label: 'Agent',
      description: t('agent'),
      color: 'purple'
    },
    {
      id: 'kb',
      value: false,
      icon: '📚',
      label: 'Knowledge Base',
      description: t('knowledgeBase'),
      color: 'blue'
    }
  ];

  const currentMode = modes.find(m => m.value === agentMode) || modes[1];

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-4 py-2 text-sm font-bold text-white rounded-lg transition-all shadow-md hover:shadow-lg ${
          agentMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
        }`}
        title={`${tCommon('mode.switch')}: ${currentMode.description}`}
      >
        <span>{currentMode.icon}</span>
        <span>{currentMode.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* ドロップダウンメニュー */}
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-20">
            <div className="py-1">
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => switchMode(mode.value)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    agentMode === mode.value
                      ? mode.color === 'purple'
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{mode.icon}</span>
                    <div className="flex-1">
                      <div className="font-bold">{mode.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {mode.description}
                      </div>
                    </div>
                    {agentMode === mode.value && (
                      <span className={mode.color === 'purple' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}>✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
