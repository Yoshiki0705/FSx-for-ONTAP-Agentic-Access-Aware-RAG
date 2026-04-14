'use client';

import type { RegistryRecord } from '@/types/registry';

interface RegistryCardProps {
  record: RegistryRecord;
  onClick: (resourceId: string) => void;
}

const TYPE_STYLES: Record<string, string> = {
  Agent: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  Tool: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  McpServer: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  Custom: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const STATUS_STYLES: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

/**
 * Registry レコードカード
 * name, description, resourceType, publisherName を表示
 * Requirements: 2.2
 */
export function RegistryCard({ record, onClick }: RegistryCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(record.resourceId)}
      className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer"
      aria-label={record.resourceName}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
          {record.resourceName}
        </h3>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
            TYPE_STYLES[record.resourceType] || TYPE_STYLES.Custom
          }`}
        >
          {record.resourceType}
        </span>
      </div>

      {record.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
          {record.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">
          {record.publisherName}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
            STATUS_STYLES[record.approvalStatus] || ''
          }`}
        >
          {record.approvalStatus}
        </span>
      </div>
    </button>
  );
}
