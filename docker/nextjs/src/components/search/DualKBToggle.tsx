/**
 * DualKBToggle — toggle between text-only and multimodal search.
 *
 * Only renders when DUAL_KB_MODE=true.
 * Syncs with useMultimodalStore.activeKbType.
 *
 * Requirements: 13.3
 */

'use client';

import React from 'react';
import { useMultimodalStore } from '@/store/useMultimodalStore';
import type { ActiveKBType } from '@/types/multimodal';

interface DualKBToggleProps {
  className?: string;
}

const KB_OPTIONS: { value: ActiveKBType; label: string; icon: string }[] = [
  { value: 'text', label: 'Text Search', icon: '📄' },
  { value: 'multimodal', label: 'Multimodal Search', icon: '🔍' },
];

export function DualKBToggle({ className = '' }: DualKBToggleProps) {
  const dualKbMode = useMultimodalStore((s) => s.dualKbMode);
  const activeKbType = useMultimodalStore((s) => s.activeKbType);
  const setActiveKbType = useMultimodalStore((s) => s.setActiveKbType);

  if (!dualKbMode) return null;

  return (
    <div
      className={`inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden ${className}`}
      role="radiogroup"
      aria-label="Knowledge base mode"
      data-testid="dual-kb-toggle"
    >
      {KB_OPTIONS.map((opt) => {
        const active = activeKbType === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setActiveKbType(opt.value)}
            className={`
              px-3 py-1.5 text-xs font-medium transition-colors
              ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
          >
            <span className="mr-1">{opt.icon}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
