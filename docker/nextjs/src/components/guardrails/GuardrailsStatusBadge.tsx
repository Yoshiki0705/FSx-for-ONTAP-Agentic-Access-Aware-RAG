'use client';

/**
 * GuardrailsStatusBadge
 *
 * Displays a visual badge indicating the Guardrails processing result
 * for a chat response message.
 *
 * - ✅ safe (green) — no filtering applied
 * - ⚠️ filtered (yellow/red) — content was filtered or blocked
 * - ⚠️ check unavailable (gray) — guardrails check failed
 * - Hidden when enableGuardrails=false
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface GuardrailResult {
  status: 'safe' | 'filtered' | 'blocked' | 'error' | 'disabled';
  action: string;
  inputAssessment: 'PASSED' | 'BLOCKED';
  outputAssessment: 'PASSED' | 'BLOCKED' | 'FILTERED';
  filteredCategories: string[];
  guardrailId?: string;
}

export interface GuardrailsStatusBadgeProps {
  guardrailResult?: GuardrailResult;
  enableGuardrails: boolean;
}

export function GuardrailsStatusBadge({ guardrailResult, enableGuardrails }: GuardrailsStatusBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  let t: any;
  try {
    t = useTranslations('chat.guardrailsStatus');
  } catch {
    // Fallback when i18n is not available (e.g., in tests)
    t = (key: string) => key;
  }

  if (!enableGuardrails || !guardrailResult || guardrailResult.status === 'disabled') {
    return null;
  }

  const { status, inputAssessment, outputAssessment, filteredCategories } = guardrailResult;

  let badgeColor = '';
  let badgeText = '';
  let badgeIcon = '';

  switch (status) {
    case 'safe':
      badgeColor = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      badgeText = t('safe');
      badgeIcon = '✅';
      break;
    case 'filtered':
      badgeColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      badgeText = t('filtered');
      badgeIcon = '⚠️';
      break;
    case 'blocked':
      badgeColor = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      badgeText = t('blocked');
      badgeIcon = '⚠️';
      break;
    case 'error':
      badgeColor = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
      badgeText = t('checkUnavailable');
      badgeIcon = '⚠️';
      break;
    default:
      return null;
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor} cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={() => setShowTooltip(!showTooltip)}
        aria-label={`Guardrails status: ${status}`}
        data-testid="guardrails-status-badge"
      >
        <span>{badgeIcon}</span>
        <span>{badgeText}</span>
      </button>

      {showTooltip && (
        <div
          className="absolute z-50 bottom-full left-0 mb-2 w-64 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-sm"
          data-testid="guardrails-tooltip"
        >
          <div className="font-semibold mb-2">{t('tooltipTitle')}</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('inputAssessment')}</span>
              <span className={inputAssessment === 'PASSED' ? 'text-green-600' : 'text-red-600'}>
                {inputAssessment === 'PASSED' ? t('passed') : t('blocked')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('outputAssessment')}</span>
              <span className={outputAssessment === 'PASSED' ? 'text-green-600' : 'text-red-600'}>
                {outputAssessment === 'PASSED' ? t('passed') : t('filtered')}
              </span>
            </div>
            {filteredCategories.length > 0 && (
              <div>
                <span className="text-gray-500">{t('filteredCategories')}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {filteredCategories.map((cat) => (
                    <span
                      key={cat}
                      className="px-1.5 py-0.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
