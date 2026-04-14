/**
 * ImageSearchAction — action picker shown when an image is uploaded.
 *
 * Two actions:
 *   1. "Vision Analysis" — always available
 *   2. "Similarity Search" — only when embedding model is nova-multimodal
 *
 * Requirements: 6.1, 6.4, 9.2
 */

'use client';

import React from 'react';
import { useMultimodalStore } from '@/store/useMultimodalStore';

export type ImageAction = 'vision' | 'similarity';

interface ImageSearchActionProps {
  onSelect: (action: ImageAction) => void;
  className?: string;
}

export function ImageSearchAction({ onSelect, className = '' }: ImageSearchActionProps) {
  const multimodalEnabled = useMultimodalStore((s) => s.multimodalEnabled);

  return (
    <div
      className={`flex gap-2 ${className}`}
      role="group"
      aria-label="Image search actions"
      data-testid="image-search-action"
    >
      <button
        type="button"
        onClick={() => onSelect('vision')}
        className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      >
        🔍 Vision Analysis
      </button>

      {multimodalEnabled && (
        <button
          type="button"
          onClick={() => onSelect('similarity')}
          className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          data-testid="similarity-search-button"
        >
          🖼️ Similarity Search
        </button>
      )}
    </div>
  );
}
