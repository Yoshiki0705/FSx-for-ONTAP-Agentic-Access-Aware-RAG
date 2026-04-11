'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { truncateText } from '@/utils/truncateText';
import { resolveModelForMode } from '@/utils/modelCompatibility';

export interface ModelIndicatorProps {
  /** Currently selected model ID */
  selectedModelId: string;
  /** Display name of the currently selected model */
  selectedModelName: string;
  /** Callback when user selects a different model */
  onModelChange: (modelId: string) => void;
  /** Current chat mode — determines which model list to show */
  mode: 'kb' | 'agent';
  /** Models available for the current mode */
  models: Array<{ modelId: string; modelName: string }>;
  /** Max characters before truncation (default 20, sm breakpoint 12) */
  maxDisplayLength?: number;
}

/**
 * Compact header model indicator with dropdown selection.
 *
 * - Displays the current model name (truncated via `truncateText`)
 * - Click to expand a `position: absolute` dropdown with model list
 * - On selection dispatches a `modelChanged` CustomEvent with `event.detail.modelId`
 * - Shares `selectedModelId` state with sidebar's existing ModelSelector
 * - On mode switch uses `resolveModelForMode` for fallback; shows toast if fallback occurs
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.4, 6.5
 */
export default function ModelIndicator({
  selectedModelId,
  selectedModelName,
  onModelChange,
  mode,
  models,
  maxDisplayLength = 20,
}: ModelIndicatorProps) {
  const t = useTranslations('modelIndicator');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const prevModeRef = useRef(mode);

  // Mode-switch fallback: when mode changes, check if current model is still valid
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;

    const modelIds = models.map((m) => m.modelId);
    if (modelIds.length === 0) return;

    const result = resolveModelForMode(
      selectedModelId,
      mode === 'kb' ? 'kb' : 'single-agent',
      mode === 'kb' ? modelIds : [],
      mode === 'agent' ? modelIds : [],
      modelIds[0],
      modelIds[0],
    );

    if (result.didFallback) {
      onModelChange(result.modelId);

      // Dispatch modelChanged event for sync with sidebar ModelSelector
      window.dispatchEvent(
        new CustomEvent('modelChanged', {
          detail: { modelId: result.modelId },
          bubbles: true,
          cancelable: true,
        }),
      );

      // Toast notification for fallback (requirement 5.5)
      try {
        const fallbackModel = models.find((m) => m.modelId === result.modelId);
        const message = t('fallbackNotice', {
          previous: selectedModelName,
          current: fallbackModel?.modelName ?? result.modelId,
        });
        // Use a simple toast approach — parent can intercept via event or provide a toast lib
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('toastNotification', {
              detail: { message, type: 'info' },
            }),
          );
        }
      } catch {
        // Translation key may not support interpolation; fall back silently
      }
    }
  }, [mode, models, selectedModelId, selectedModelName, onModelChange, t]);

  // Responsive: use shorter truncation on small screens
  const [effectiveMaxLength, setEffectiveMaxLength] = useState(maxDisplayLength);

  useEffect(() => {
    const updateMaxLength = () => {
      // sm breakpoint = 640px
      if (window.innerWidth < 640) {
        setEffectiveMaxLength(12);
      } else {
        setEffectiveMaxLength(maxDisplayLength);
      }
    };

    updateMaxLength();
    window.addEventListener('resize', updateMaxLength);
    return () => window.removeEventListener('resize', updateMaxLength);
  }, [maxDisplayLength]);

  const displayName = truncateText(selectedModelName, effectiveMaxLength);

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleSelect = useCallback(
    (modelId: string) => {
      onModelChange(modelId);

      // Dispatch modelChanged CustomEvent so sidebar ModelSelector stays in sync
      window.dispatchEvent(
        new CustomEvent('modelChanged', {
          detail: { modelId },
          bubbles: true,
          cancelable: true,
        }),
      );

      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onModelChange],
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t('label')}
        onClick={toggleDropdown}
        className="
          inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5
          text-sm font-medium transition-colors
          bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-blue-500 focus-visible:ring-offset-1
          cursor-pointer
        "
      >
        <span
          className="truncate max-w-[160px]"
          title={selectedModelName}
        >
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label={t('label')}
          className="absolute right-0 top-full mt-1 z-50 min-w-[220px] max-w-[360px]
                     rounded-md border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-900 shadow-lg py-1
                     max-h-60 overflow-y-auto"
        >
          {models.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              No models available
            </li>
          ) : (
            models.map((model) => {
              const isSelected = model.modelId === selectedModelId;

              return (
                <li
                  key={model.modelId}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(model.modelId)}
                  className={`
                    flex items-center gap-2 px-3 py-2 text-sm cursor-pointer
                    transition-colors
                    ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  <span
                    className="truncate flex-1 min-w-0"
                    title={model.modelName}
                  >
                    {model.modelName}
                  </span>
                  {isSelected && (
                    <span className="text-blue-500 flex-shrink-0">✓</span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
