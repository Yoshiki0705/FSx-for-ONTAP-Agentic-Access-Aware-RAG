'use client';

import React from 'react';
import { Filter, X } from 'lucide-react';

interface ModelFilterProps {
  providerFilter: string;
  modalityFilter: string;
  availabilityFilter: string;
  onProviderChange: (provider: string) => void;
  onModalityChange: (modality: string) => void;
  onAvailabilityChange: (availability: string) => void;
  onClearFilters: () => void;
}

export const ModelFilter: React.FC<ModelFilterProps> = ({
  providerFilter,
  modalityFilter,
  availabilityFilter,
  onProviderChange,
  onModalityChange,
  onAvailabilityChange,
  onClearFilters,
}) => {
  const hasFilters = providerFilter || modalityFilter || availabilityFilter;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center space-x-2">
        <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          フィルター:
        </span>
      </div>
      
      <select
        value={providerFilter}
        onChange={(e) => onProviderChange(e.target.value)}
        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      >
        <option value="">全プロバイダー</option>
        <option value="Amazon">Amazon</option>
        <option value="Anthropic">Anthropic</option>
      </select>
      
      <select
        value={modalityFilter}
        onChange={(e) => onModalityChange(e.target.value)}
        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      >
        <option value="">全モダリティ</option>
        <option value="text">テキスト</option>
        <option value="image">画像</option>
      </select>
      
      <select
        value={availabilityFilter}
        onChange={(e) => onAvailabilityChange(e.target.value)}
        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      >
        <option value="">全て</option>
        <option value="available">利用可能</option>
        <option value="unavailable">利用不可</option>
      </select>
      
      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="flex items-center space-x-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <X className="w-3 h-3" />
          <span>クリア</span>
        </button>
      )}
    </div>
  );
};