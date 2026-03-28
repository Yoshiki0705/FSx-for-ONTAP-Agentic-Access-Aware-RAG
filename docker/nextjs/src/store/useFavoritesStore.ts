/**
 * お気に入りカード管理用Zustandストア
 * カードのお気に入り状態をlocalStorageに永続化
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * FavoritesStore State
 */
interface FavoritesStore {
  /** お気に入りカードIDリスト */
  favorites: string[];

  /** お気に入りをトグル（追加/削除） */
  toggleFavorite: (cardId: string) => void;

  /** カードがお気に入りかどうかを判定 */
  isFavorite: (cardId: string) => boolean;
}

/**
 * お気に入りストア
 *
 * カードのお気に入り状態を管理します。
 * localStorageに永続化されます。
 *
 * @example
 * ```typescript
 * const { favorites, toggleFavorite, isFavorite } = useFavoritesStore();
 *
 * // お気に入りをトグル
 * toggleFavorite('kb-doc-search');
 *
 * // お気に入り判定
 * const fav = isFavorite('kb-doc-search');
 * ```
 */
export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],

      toggleFavorite: (cardId: string) => {
        const { favorites } = get();
        const newFavorites = favorites.includes(cardId)
          ? favorites.filter(id => id !== cardId)
          : [...favorites, cardId];
        set({ favorites: newFavorites });
      },

      isFavorite: (cardId: string) => {
        return get().favorites.includes(cardId);
      },
    }),
    {
      name: 'card-favorites-storage',
    }
  )
);
