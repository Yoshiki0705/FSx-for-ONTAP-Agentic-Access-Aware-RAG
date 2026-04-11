'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { useHeaderStore } from '@/store/useHeaderStore';
import type { ChatMode } from '@/utils/modelCompatibility';

export { type ChatMode } from '@/utils/modelCompatibility';

export interface UnifiedModeToggleProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  multiAgentAvailable: boolean;
  disabled?: boolean;
}

/** Maps ChatMode → URL query param value (undefined = remove param) */
export function getModeQueryParam(mode: ChatMode): string | undefined {
  switch (mode) {
    case 'kb':
      return undefined;
    case 'single-agent':
      return 'agent';
    case 'multi-agent':
      return 'multi-agent';
  }
}

const MODES: ChatMode[] = ['kb', 'single-agent', 'multi-agent'];
const DISPLAY_LABELS: Record<ChatMode, string> = {
  kb: 'KB',
  'single-agent': 'Single Agent',
  'multi-agent': 'Multi Agent',
};

/**
 * 統合3モードトグル: KB / Single Agent / Multi Agent
 *
 * - `role="radiogroup"` + 各ボタン `role="radio"` でアクセシビリティ対応
 * - 矢印キーでフォーカス移動（roving tabindex パターン）
 * - KB: 青系、Agent系: 紫系のアクティブ状態スタイル
 * - `min-width` 固定で幅変動を防止
 * - Multi Agent 無効時はツールチップ表示
 * - モード選択時に URL クエリパラメータを更新し useHeaderStore.setChatMode を呼び出す
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.3, 9.1, 9.5
 */
export default function UnifiedModeToggle({
  mode,
  onModeChange,
  multiAgentAvailable,
  disabled = false,
}: UnifiedModeToggleProps) {
  const t = useTranslations('modeToggle');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setChatMode = useHeaderStore((s) => s.setChatMode);

  const [showTooltip, setShowTooltip] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

  const updateUrlParams = useCallback(
    (newMode: ChatMode) => {
      const params = new URLSearchParams(searchParams.toString());
      const qp = getModeQueryParam(newMode);
      if (qp) {
        params.set('mode', qp);
      } else {
        params.delete('mode');
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const handleSelect = useCallback(
    (selected: ChatMode) => {
      if (disabled) return;
      if (selected === 'multi-agent' && !multiAgentAvailable) return;
      if (selected === mode) return;
      setChatMode(selected);
      onModeChange(selected);
      updateUrlParams(selected);
    },
    [disabled, multiAgentAvailable, mode, setChatMode, onModeChange, updateUrlParams],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;

      const currentIndex = MODES.indexOf(mode);
      let nextIndex = -1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % MODES.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + MODES.length) % MODES.length;
      }

      if (nextIndex < 0) return;

      const next = MODES[nextIndex];
      // Skip disabled multi-agent
      if (next === 'multi-agent' && !multiAgentAvailable) {
        // Try the next one in the same direction
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          nextIndex = (nextIndex + 1) % MODES.length;
        } else {
          nextIndex = (nextIndex - 1 + MODES.length) % MODES.length;
        }
      }

      const finalMode = MODES[nextIndex];
      if (finalMode === 'multi-agent' && !multiAgentAvailable) return;
      if (finalMode === mode) return;

      handleSelect(finalMode);
      // Focus the newly selected radio button
      const container = groupRef.current;
      if (container) {
        const btn = container.querySelector<HTMLButtonElement>(
          `[data-mode="${finalMode}"]`,
        );
        btn?.focus();
      }
    },
    [disabled, mode, multiAgentAvailable, handleSelect],
  );

  const getActiveStyles = (m: ChatMode, isActive: boolean): string => {
    if (!isActive) {
      return 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200';
    }
    if (m === 'kb') {
      return 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm';
    }
    // Agent modes (single-agent, multi-agent)
    return 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 shadow-sm';
  };

  const ariaLabel = t('label');

  return (
    <div className="relative inline-flex items-center">
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={ariaLabel}
        className="inline-flex items-center rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5"
        style={{ minWidth: '280px' }}
      >
        {MODES.map((m) => {
          const isActive = mode === m;
          const isMultiDisabled = m === 'multi-agent' && (!multiAgentAvailable || disabled);
          const isButtonDisabled = disabled || isMultiDisabled;

          const translationKey =
            m === 'kb' ? 'kb' : m === 'single-agent' ? 'singleAgent' : 'multiAgent';
          const label = t(translationKey);

          const button = (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={label}
              aria-disabled={isButtonDisabled || undefined}
              data-mode={m}
              tabIndex={isActive ? 0 : -1}
              disabled={isButtonDisabled}
              onClick={() => handleSelect(m)}
              onKeyDown={handleKeyDown}
              className={`
                inline-flex items-center justify-center rounded-md px-3 py-1.5
                text-sm font-medium transition-colors
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-blue-500 focus-visible:ring-offset-1
                ${getActiveStyles(m, isActive)}
                ${isButtonDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              style={{ minWidth: '80px' }}
            >
              <span>{DISPLAY_LABELS[m]}</span>
            </button>
          );

          // Wrap multi-agent button with tooltip container when disabled
          if (m === 'multi-agent') {
            return (
              <div
                key={m}
                className="relative"
                onMouseEnter={() => {
                  if (isMultiDisabled) setShowTooltip(true);
                }}
                onMouseLeave={() => setShowTooltip(false)}
              >
                {button}
                {showTooltip && isMultiDisabled && (
                  <div
                    role="tooltip"
                    className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-2 w-56
                               rounded-md bg-gray-800 px-3 py-2 text-xs text-white shadow-lg
                               border border-gray-600"
                  >
                    <div className="flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-yellow-400" />
                      <span>
                        マルチエージェントが有効化されていません。CDK設定で
                        <code className="mx-0.5 rounded bg-gray-700 px-1 py-0.5 font-mono text-[10px]">
                          enableMultiAgent
                        </code>
                        を有効にしてください。
                      </span>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rotate-45 bg-gray-800 border-l border-t border-gray-600" />
                  </div>
                )}
              </div>
            );
          }

          return button;
        })}
      </div>
    </div>
  );
}
