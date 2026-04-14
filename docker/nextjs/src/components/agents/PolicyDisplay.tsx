'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface PolicyDisplayProps {
  policyText: string | null;
  policyId?: string;
}

export function PolicyDisplay({ policyText, policyId }: PolicyDisplayProps) {
  const t = useTranslations('agentDirectory.policy');
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {t('detailTitle')}
      </h3>
      {policyText ? (
        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-1"
          >
            {expanded ? '▼' : '▶'} {policyId || t('detailTitle')}
          </button>
          {expanded && (
            <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg whitespace-pre-wrap">
              {policyText}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('noPolicy')}</p>
      )}
    </div>
  );
}
