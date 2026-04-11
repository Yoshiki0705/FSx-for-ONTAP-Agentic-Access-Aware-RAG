'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Users, User, Info } from 'lucide-react';

export interface AgentModeToggleProps {
  mode: 'single' | 'multi';
  onModeChange: (mode: 'single' | 'multi') => void;
  multiAgentAvailable: boolean;
  disabled?: boolean;
}

/**
 * チャットヘッダー用の Single/Multi エージェントモード切替トグル。
 *
 * - `role="radiogroup"` + `aria-label="Agent mode"` でアクセシビリティ対応
 * - Agent Team 構成が利用不可の場合はトグル無効化 + ツールチップ表示
 * - モード切替時に `onModeChange` を呼び出し、呼び出し元で新セッション開始を制御
 *
 * Requirements: 11.4, 11.6
 */
export default function AgentModeToggle({
  mode,
  onModeChange,
  multiAgentAvailable,
  disabled = false,
}: AgentModeToggleProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (selected: 'single' | 'multi') => {
      if (disabled) return;
      if (selected === 'multi' && !multiAgentAvailable) return;
      if (selected === mode) return;
      onModeChange(selected);
    },
    [disabled, multiAgentAvailable, mode, onModeChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;

      let next: 'single' | 'multi' | null = null;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        next = mode === 'single' ? 'multi' : 'single';
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        next = mode === 'single' ? 'multi' : 'single';
      }

      if (next) {
        if (next === 'multi' && !multiAgentAvailable) return;
        handleSelect(next);
        // Focus the newly selected radio button
        const container = groupRef.current;
        if (container) {
          const btn = container.querySelector<HTMLButtonElement>(
            `[data-mode="${next}"]`,
          );
          btn?.focus();
        }
      }
    },
    [disabled, mode, multiAgentAvailable, handleSelect],
  );

  const isMultiDisabled = !multiAgentAvailable || disabled;

  return (
    <div className="relative inline-flex items-center">
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Agent mode"
        className="inline-flex items-center rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5"
      >
        {/* Single mode */}
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'single'}
          aria-label="Single agent mode"
          data-mode="single"
          tabIndex={mode === 'single' ? 0 : -1}
          disabled={disabled}
          onClick={() => handleSelect('single')}
          onKeyDown={handleKeyDown}
          className={`
            inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium
            transition-colors focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-blue-500 focus-visible:ring-offset-1
            ${
              mode === 'single'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <User className="w-3.5 h-3.5" />
          <span>Single</span>
        </button>

        {/* Multi mode */}
        <div
          className="relative"
          onMouseEnter={() => {
            if (isMultiDisabled) setShowTooltip(true);
          }}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'multi'}
            aria-label="Multi agent mode"
            aria-disabled={isMultiDisabled || undefined}
            data-mode="multi"
            tabIndex={mode === 'multi' ? 0 : -1}
            disabled={isMultiDisabled}
            onClick={() => handleSelect('multi')}
            onKeyDown={handleKeyDown}
            className={`
              inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium
              transition-colors focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-blue-500 focus-visible:ring-offset-1
              ${
                mode === 'multi'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }
              ${isMultiDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Multi</span>
          </button>

          {/* Tooltip: shown when multi-agent is unavailable */}
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
              {/* Tooltip arrow */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rotate-45 bg-gray-800 border-l border-t border-gray-600" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
