'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface ResponseMetadataProps {
  modelName: string;
  isAutoRouted: boolean;
  isManualOverride: boolean;
  classification?: 'simple' | 'complex';
  confidence?: number;
  hasImageAnalysis?: boolean;
  locale: string;
}

/**
 * ResponseMetadata — displays model info below assistant messages.
 *
 * Shows the model name, Auto/Manual badge, camera icon for image analysis,
 * classification tooltip on hover, and a clickable model name popover.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 14.3
 */
export function ResponseMetadata({
  modelName,
  isAutoRouted,
  isManualOverride,
  classification,
  confidence,
  hasImageAnalysis,
  locale: _locale,
}: ResponseMetadataProps) {
  const t = useTranslations('smartRouting');
  const [showPopover, setShowPopover] = useState(false);

  return (
    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
      {/* Model name — clickable to show popover */}
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setShowPopover((prev) => !prev)}
          className="hover:text-gray-600 dark:hover:text-gray-300 underline decoration-dotted cursor-pointer"
        >
          {t('modelUsed')}: {modelName}
        </button>

        {showPopover && (
          <div className="absolute bottom-full left-0 mb-1 z-50 w-64 rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300">
            <p className="font-medium mb-1">{modelName}</p>
            <button
              type="button"
              onClick={() => setShowPopover(false)}
              className="mt-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-500"
            >
              {t('title')} ✕
            </button>
          </div>
        )}
      </div>

      {/* Auto badge (blue) */}
      {isAutoRouted && (
        <span
          className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          title={
            classification
              ? `${t(classification)}${confidence != null ? ` (${t('confidence')}: ${Math.round(confidence * 100)}%)` : ''}`
              : undefined
          }
        >
          {t('autoRouted')}
        </span>
      )}

      {/* Manual badge (grey) */}
      {isManualOverride && (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {t('manualOverride')}
        </span>
      )}

      {/* Camera icon for image analysis */}
      {hasImageAnalysis && (
        <span title="Image Analysis" className="text-xs">
          📷
        </span>
      )}
    </div>
  );
}
