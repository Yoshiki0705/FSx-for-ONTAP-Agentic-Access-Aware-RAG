/**
 * Agent Status Utilities
 * Pure functions for status badge styling and loading state detection
 */

const STATUS_STYLES: Record<string, string> = {
  PREPARED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  CREATING: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  PREPARING: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const DEFAULT_STATUS_STYLE = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

const LOADING_STATUSES = ['CREATING', 'PREPARING'];

export function getStatusStyle(status: string): string {
  return Object.prototype.hasOwnProperty.call(STATUS_STYLES, status)
    ? STATUS_STYLES[status]
    : DEFAULT_STATUS_STYLE;
}

export function isLoadingStatus(status: string): boolean {
  return LOADING_STATUSES.includes(status);
}
