'use client';

import { useState, useEffect } from 'react';
import {
  getCardsByMode,
  getCategoriesByMode,
  filterCardsByCategory,
  sortCardsByFavorites,
} from '@/constants/card-constants';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { InfoBanner } from './InfoBanner';
import { CategoryFilter } from './CategoryFilter';
import { TaskCard } from './TaskCard';

export interface CardGridProps {
  mode: 'kb' | 'agent';
  locale: string;
  onCardClick: (promptTemplate: string, label: string) => void;
  username: string;
  role: string;
  userDirectories: any | null;
}

export function CardGrid({
  mode,
  locale,
  onCardClick,
  username,
  role,
  userDirectories,
}: CardGridProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [infoBannerExpanded, setInfoBannerExpanded] = useState(false);

  const { favorites, toggleFavorite, isFavorite } = useFavoritesStore();

  // Reset category to 'all' when mode changes
  useEffect(() => {
    setSelectedCategory('all');
  }, [mode]);

  // Get cards and categories for current mode
  const cards = getCardsByMode(mode);
  const categories = getCategoriesByMode(mode);

  // Filter by selected category, then sort by favorites
  const filteredCards = filterCardsByCategory(cards, selectedCategory);
  const sortedCards = sortCardsByFavorites(filteredCards, favorites);

  return (
    <div className="w-full max-w-4xl mx-auto px-2">
      <InfoBanner
        username={username}
        role={role}
        userDirectories={userDirectories}
        locale={locale}
        isExpanded={infoBannerExpanded}
        onToggleExpand={() => setInfoBannerExpanded((prev) => !prev)}
      />

      <div className="mb-4">
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          locale={locale}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedCards.map((card) => (
          <TaskCard
            key={card.id}
            card={card}
            isFavorite={isFavorite(card.id)}
            onFavoriteToggle={toggleFavorite}
            onClick={onCardClick}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}
