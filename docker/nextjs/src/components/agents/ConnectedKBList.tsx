'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBases';
import type { KnowledgeBaseSummary } from '@/types/kb-selector';

interface ConnectedKBListProps {
  agentId: string;
  locale: string;
}

/** Map KB status to badge color classes (same as KBSelector) */
function getStatusBadgeClasses(status: KnowledgeBaseSummary['status']): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'CREATING':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'FAILED':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

export function ConnectedKBList({ agentId, locale: _locale }: ConnectedKBListProps) {
  const t = useTranslations('kbSelector');
  const { knowledgeBases, connectedKBIds, isLoading, error, fetchConnectedKBs, refetch } = useKnowledgeBases();

  // Fetch connected KBs on mount
  useEffect(() => {
    if (agentId) {
      fetchConnectedKBs(agentId);
    }
  }, [agentId, fetchConnectedKBs]);

  // Filter KB list to only connected ones
  const connectedKBs = knowledgeBases.filter((kb) => connectedKBIds.includes(kb.id));

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-between">
        <span className="text-sm text-red-600 dark:text-red-400">
          {t('loadError')}
        </span>
        <button
          type="button"
          onClick={refetch}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  // Empty state
  if (connectedKBs.length === 0) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 py-2">
        {t('noKBConnected')}
      </p>
    );
  }

  // Connected KB list
  return (
    <div className="space-y-2">
      {connectedKBs.map((kb) => (
        <div
          key={kb.id}
          className="p-3 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {kb.name}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${getStatusBadgeClasses(kb.status)}`}
            >
              {kb.status}
            </span>
          </div>
          {kb.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
              {kb.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
