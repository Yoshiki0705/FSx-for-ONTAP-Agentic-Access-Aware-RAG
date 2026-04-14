'use client';

import { useTranslations } from 'next-intl';

export interface PolicyBadgeProps {
  hasPolicy: boolean;
}

export function PolicyBadge({ hasPolicy }: PolicyBadgeProps) {
  const t = useTranslations('agentDirectory.policy');

  if (!hasPolicy) return null;

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
      {t('badge')}
    </span>
  );
}
