'use client';

import { useTranslations } from 'next-intl';
import { useKnowledgeBases } from '@/hooks/useKnowledgeBases';
import type { KnowledgeBaseSummary } from '@/types/kb-selector';

interface KBSelectorProps {
  selectedKBIds: string[];
  connectedKBIds?: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
  locale: string;
}

/** Map KB status to badge color classes */
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

export function KBSelector({
  selectedKBIds,
  connectedKBIds: _connectedKBIds,
  onChange,
  disabled,
  locale: _locale,
}: KBSelectorProps) {
  const t = useTranslations('kbSelector');
  const { knowledgeBases, isLoading, error, refetch } = useKnowledgeBases();

  const handleToggle = (kbId: string) => {
    if (disabled) return;
    const newSelection = selectedKBIds.includes(kbId)
      ? selectedKBIds.filter((id) => id !== kbId)
      : [...selectedKBIds, kbId];
    onChange(newSelection);
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {t('title')}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        {t('selectKB')}
      </p>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
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
      )}

      {/* KB list */}
      {!isLoading && !error && (
        <div className="space-y-2">
          {knowledgeBases.map((kb) => {
            const isActive = kb.status === 'ACTIVE';
            const isSelected = selectedKBIds.includes(kb.id);

            return (
              <label
                key={kb.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                } ${!isActive ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(kb.id)}
                  disabled={disabled || !isActive}
                  className="mt-0.5 rounded border-gray-300"
                />
                <div className="flex-1 min-w-0">
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
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {t('dataSources')}: {kb.dataSourceCount}
                  </p>
                </div>
              </label>
            );
          })}
          {knowledgeBases.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 py-2">
              {t('noKBConnected')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
