/**
 * EmbeddingModelInfo — read-only display of the current embedding model.
 *
 * Shows model name, "Multimodal" or "Text-only" badge, and a note
 * about CDK redeploy requirement. No selection/switching capability.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

'use client';

import React from 'react';
import { useMultimodalStore } from '@/store/useMultimodalStore';

interface EmbeddingModelInfoProps {
  className?: string;
}

export function EmbeddingModelInfo({ className = '' }: EmbeddingModelInfoProps) {
  const embeddingModelName = useMultimodalStore((s) => s.embeddingModelName);
  const multimodalEnabled = useMultimodalStore((s) => s.multimodalEnabled);

  return (
    <div
      className={`p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 ${className}`}
      data-testid="embedding-model-info"
    >
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
        Embedding Model
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
          {embeddingModelName}
        </span>

        {multimodalEnabled ? (
          <span
            className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            data-testid="multimodal-badge"
          >
            Multimodal
          </span>
        ) : (
          <span
            className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            data-testid="text-only-badge"
          >
            Text-only
          </span>
        )}
      </div>

      {multimodalEnabled && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">
          Supported: Text · Image · Video · Audio
        </div>
      )}

      <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
        Changing the embedding model requires CDK redeploy and full data re-ingestion.
      </div>
    </div>
  );
}
