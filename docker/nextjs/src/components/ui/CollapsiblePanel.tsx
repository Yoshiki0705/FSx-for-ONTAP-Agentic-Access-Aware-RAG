'use client';

import React, { useId } from 'react';
import { useSidebarStore } from '@/store/useSidebarStore';

export interface CollapsiblePanelProps {
  /** セクションタイトル */
  title: string;
  /** タイトル横に表示するアイコン（絵文字等） */
  icon?: string;
  /** 初期展開状態（デフォルト: false = 折りたたみ） */
  defaultExpanded?: boolean;
  /** localStorage永続化用キー */
  storageKey: string;
  /** パネル内コンテンツ */
  children: React.ReactNode;
}

/**
 * 折りたたみ可能なパネルコンポーネント
 *
 * KBモード・Agentモード共通で使用する。
 * useSidebarStore経由でlocalStorageに展開/折りたたみ状態を永続化する。
 */
export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  icon,
  defaultExpanded = false,
  storageKey,
  children,
}) => {
  const contentId = useId();
  const { systemSettingsExpanded, toggleSystemSettings } = useSidebarStore();

  // 現時点ではstorageKeyに関わらずsystemSettingsExpandedを使用
  // 将来的に複数パネル対応時はstorageKeyで分岐可能
  const isExpanded = systemSettingsExpanded;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      {/* ヘッダー（常時表示） */}
      <button
        type="button"
        onClick={toggleSystemSettings}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className="flex w-full items-center justify-between px-3 py-2.5
          text-sm font-medium text-gray-700 dark:text-gray-200
          hover:bg-gray-100 dark:hover:bg-gray-700/50
          transition-colors duration-150 cursor-pointer select-none"
      >
        <span className="flex items-center gap-1.5">
          {icon && <span>{icon}</span>}
          <span>{title}</span>
        </span>
        {/* トグル矢印アイコン */}
        <svg
          className={`h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400
            transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* コンテンツ（展開/折りたたみ） */}
      <div
        id={contentId}
        role="region"
        className={`overflow-hidden transition-all duration-200 ease-in-out
          ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-3 pb-3 pt-1">
          {children}
        </div>
      </div>
    </div>
  );
};

CollapsiblePanel.displayName = 'CollapsiblePanel';
