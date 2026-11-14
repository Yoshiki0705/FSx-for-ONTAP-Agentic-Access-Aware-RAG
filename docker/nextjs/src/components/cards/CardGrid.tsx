'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  getCardsByMode,
  getCategoriesByMode,
  getIndustryCards,
  INDUSTRIES,
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
  onCardClick: (promptTemplate: string, label: string, cardId?: string) => void;
  username: string;
  role: string;
  userDirectories: any | null;
  selectedAgentId?: string | null;
}

export function CardGrid({
  mode,
  locale,
  onCardClick,
  username,
  role,
  userDirectories,
  selectedAgentId,
}: CardGridProps) {
  const t = useTranslations('cards');
  const [selectedCategory, setSelectedCategory] = useState('all');
  // '' = general-purpose cards. Industry cards exist in KB mode only.
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [infoBannerExpanded, setInfoBannerExpanded] = useState(false);

  const { favorites, toggleFavorite, isFavorite } = useFavoritesStore();

  // Reset category to 'all' when mode changes
  useEffect(() => {
    setSelectedCategory('all');
    setSelectedIndustry('');
  }, [mode]);

  // Get cards and categories for current mode
  const industryActive = mode === 'kb' && selectedIndustry !== '';
  const cards = industryActive ? getIndustryCards(selectedIndustry) : getCardsByMode(mode);
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

      {mode === 'kb' && (
        <div className="mb-3 flex items-center gap-2">
          <label htmlFor="industry-select" className="text-sm text-gray-600 dark:text-gray-300">
            {t('industrySelector.label')}
          </label>
          <select
            id="industry-select"
            value={selectedIndustry}
            onChange={(e) => {
              setSelectedIndustry(e.target.value);
              setSelectedCategory('all');
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">{t('industrySelector.general')}</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry.id} value={industry.id}>
                {t(industry.labelKey.replace(/^cards\./, ''))}
              </option>
            ))}
          </select>
        </div>
      )}
      {!industryActive && (
        <div className="mb-4">
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            locale={locale}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedCards.map((card) => (
          <TaskCard
            key={card.id}
            card={card}
            isFavorite={isFavorite(card.id)}
            isHighlighted={
              selectedAgentId != null &&
              card.agentId !== undefined &&
              card.agentId === selectedAgentId
            }
            onFavoriteToggle={toggleFavorite}
            onClick={onCardClick}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}
