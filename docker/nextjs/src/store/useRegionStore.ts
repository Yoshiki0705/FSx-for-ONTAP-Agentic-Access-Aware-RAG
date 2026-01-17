import { create } from 'zustand';

export interface RegionState {
  selectedRegion: string;
  isChangingRegion: boolean;
  setRegion: (region: string) => void;
  setChangingRegion: (changing: boolean) => void;
}

// Lambda環境チェック（localStorage利用可能性）
const isClient = typeof window !== 'undefined';
const hasLocalStorage = isClient && typeof localStorage !== 'undefined';

export const useRegionStore = create<RegionState>((set) => {
  // 初期状態をlocalStorageから復元（可能な場合のみ）
  let initialRegion = 'ap-northeast-1'; // デフォルトは東京リージョン

  if (hasLocalStorage) {
    try {
      const stored = localStorage.getItem('region-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.state && parsed.state.selectedRegion) {
          initialRegion = parsed.state.selectedRegion;
        }
      }
    } catch (error) {
      console.warn('[RegionStore] localStorage読み込みエラー:', error);
    }
  }

  return {
    selectedRegion: initialRegion,
    isChangingRegion: false,
    
    setRegion: (region: string) => {
      set({ selectedRegion: region });
      
      // localStorageに保存（可能な場合のみ）
      if (hasLocalStorage) {
        try {
          localStorage.setItem('region-storage', JSON.stringify({ 
            state: { selectedRegion: region } 
          }));
        } catch (error) {
          console.warn('[RegionStore] localStorage保存エラー:', error);
        }
      }
    },
    
    setChangingRegion: (changing: boolean) => set({ isChangingRegion: changing }),
  };
});
