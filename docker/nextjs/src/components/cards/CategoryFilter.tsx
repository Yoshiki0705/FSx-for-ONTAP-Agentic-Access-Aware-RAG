'use client';

import { useTranslations } from 'next-intl';
import { CategoryData } from '@/constants/card-constants';

export interface CategoryFilterProps {
  categories: CategoryData[];
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  locale: string;
}

export function CategoryFilter({ categories, selectedCategory, onCategoryChange, locale }: CategoryFilterProps) {
  const t = useTranslations('cards');

  // Strip 'cards.' prefix from keys for use with useTranslations('cards')
  const stripPrefix = (key: string) => key.replace(/^cards\./, '');

  // Ensure 'all' category is always first
  const sorted = [...categories].sort((a, b) => {
    if (a.id === 'all') return -1;
    if (b.id === 'all') return 1;
    return 0;
  });

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Category filter">
      {sorted.map((category) => {
        const isSelected = category.id === selectedCategory;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onCategoryChange(category.id)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              isSelected
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {t(stripPrefix(category.labelKey))}
          </button>
        );
      })}
    </div>
  );
}
