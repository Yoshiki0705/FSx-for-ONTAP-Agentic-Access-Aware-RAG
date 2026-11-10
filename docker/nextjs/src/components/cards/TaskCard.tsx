'use client';

import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { CardData } from '@/constants/card-constants';

export interface TaskCardProps {
  card: CardData;
  isFavorite: boolean;
  isHighlighted?: boolean;
  onFavoriteToggle: (cardId: string) => void;
  onClick: (promptTemplate: string, label: string, cardId?: string) => void;
  locale: string;
}

export function TaskCard({ card, isFavorite, isHighlighted, onFavoriteToggle, onClick, locale }: TaskCardProps) {
  const t = useTranslations('cards');

  // Strip 'cards.' prefix from keys for use with useTranslations('cards')
  const stripPrefix = (key: string) => key.replace(/^cards\./, '');

  const title = t(stripPrefix(card.titleKey));
  const description = t(stripPrefix(card.descriptionKey));
  const prompt = t(stripPrefix(card.promptTemplateKey));
  const favoriteAriaLabel = isFavorite
    ? t('favorites.removeFromFavorites')
    : t('favorites.addToFavorites');

  return (
    <div
      role="button"
      tabIndex={0}
      className={`relative flex flex-col gap-2 p-4 rounded-xl border shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-[box-shadow,border-color] cursor-pointer ${
        isHighlighted
          ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
      onClick={() => onClick(prompt, title, card.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(prompt, title, card.id);
        }
      }}
    >
      <div className="flex items-start justify-between">
        <card.icon className="w-6 h-6" aria-hidden="true" />
        <button
          type="button"
          aria-label={favoriteAriaLabel}
          className="text-lg hover:opacity-70 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle(card.id);
          }}
        >
          {isFavorite ? (
            <Star className="w-5 h-5 text-yellow-500" fill="currentColor" aria-hidden="true" />
          ) : (
            <Star className="w-5 h-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
          )}
        </button>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
        {description}
      </p>
    </div>
  );
}
