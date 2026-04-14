'use client';

import { useRegistryStore } from '@/store/useRegistryStore';
import { RegistryCard } from './RegistryCard';

interface RegistryCardGridProps {
  onCardClick: (resourceId: string) => void;
  onLoadMore: () => void;
}

/**
 * Registry カードグリッドレイアウト
 * Requirements: 2.2, 2.5
 */
export function RegistryCardGrid({ onCardClick, onLoadMore }: RegistryCardGridProps) {
  const { records, isLoading, nextToken, resourceTypeFilter } = useRegistryStore();

  const filtered =
    resourceTypeFilter === 'all'
      ? records
      : records.filter((r) => r.resourceType === resourceTypeFilter);

  if (isLoading && filtered.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!isLoading && filtered.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
        No registry records found.
      </p>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((record) => (
          <RegistryCard
            key={record.resourceId}
            record={record}
            onClick={onCardClick}
          />
        ))}
      </div>

      {nextToken && (
        <div className="flex justify-center mt-6">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
