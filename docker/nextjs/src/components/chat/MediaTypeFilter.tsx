/**
 * MediaTypeFilter — filter buttons: All / Text / Image / Video / Audio.
 *
 * Syncs with useMultimodalStore.mediaTypeFilter.
 * Only renders when MULTIMODAL_ENABLED=true.
 *
 * Requirements: 4.6, 9.3
 */

'use client';

import React from 'react';
import { useMultimodalStore } from '@/store/useMultimodalStore';
import { MEDIA_TYPE_ICONS } from './MediaTypeIndicator';
import type { MediaTypeFilter as MediaTypeFilterValue } from '@/types/multimodal';

const FILTER_OPTIONS: { value: MediaTypeFilterValue; label: string; icon?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'text', label: 'Text', icon: MEDIA_TYPE_ICONS.text },
  { value: 'image', label: 'Image', icon: MEDIA_TYPE_ICONS.image },
  { value: 'video', label: 'Video', icon: MEDIA_TYPE_ICONS.video },
  { value: 'audio', label: 'Audio', icon: MEDIA_TYPE_ICONS.audio },
];

interface MediaTypeFilterProps {
  className?: string;
}

export function MediaTypeFilter({ className = '' }: MediaTypeFilterProps) {
  const multimodalEnabled = useMultimodalStore((s) => s.multimodalEnabled);
  const mediaTypeFilter = useMultimodalStore((s) => s.mediaTypeFilter);
  const setMediaTypeFilter = useMultimodalStore((s) => s.setMediaTypeFilter);

  if (!multimodalEnabled) return null;

  return (
    <div
      className={`flex flex-wrap gap-1 ${className}`}
      role="group"
      aria-label="Media type filter"
      data-testid="media-type-filter"
    >
      {FILTER_OPTIONS.map((opt) => {
        const active = mediaTypeFilter === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setMediaTypeFilter(opt.value)}
            className={`
              px-2 py-1 text-xs rounded-full border transition-colors
              ${
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
            aria-pressed={active}
          >
            {opt.icon && <span className="mr-1">{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
