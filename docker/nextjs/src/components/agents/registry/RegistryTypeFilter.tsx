'use client';

import { useRegistryStore } from '@/store/useRegistryStore';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'Agent', label: 'Agent' },
  { key: 'Tool', label: 'Tool' },
  { key: 'McpServer', label: 'MCP Server' },
] as const;

/**
 * リソースタイプフィルタボタン群
 * Requirements: 2.6
 */
export function RegistryTypeFilter() {
  const { resourceTypeFilter, setResourceTypeFilter } = useRegistryStore();

  return (
    <div className="flex gap-1" role="group" aria-label="Resource type filter">
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => setResourceTypeFilter(opt.key)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            resourceTypeFilter === opt.key
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          aria-pressed={resourceTypeFilter === opt.key}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
