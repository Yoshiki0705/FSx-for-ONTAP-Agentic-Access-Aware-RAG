import { create } from 'zustand';
import { SmartRoutingState, ClassificationResult } from '@/types/smart-routing';
import { DEFAULT_SMART_ROUTER_CONFIG } from '@/lib/smart-router';

const STORAGE_KEY = 'smart-routing-enabled';

/** Read isEnabled from localStorage, fallback to false on any error */
function readPersistedEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return false;
  } catch {
    return false;
  }
}

/** Write isEnabled to localStorage, silently ignore errors */
function persistEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // localStorage unavailable (SSR, private browsing, quota exceeded) — ignore
  }
}

export const useSmartRoutingStore = create<SmartRoutingState>((set) => ({
  isEnabled: readPersistedEnabled(),
  isAutoMode: true,
  lightweightModelId: DEFAULT_SMART_ROUTER_CONFIG.lightweightModelId,
  powerfulModelId: DEFAULT_SMART_ROUTER_CONFIG.powerfulModelId,
  lastClassification: null,

  setEnabled: (enabled: boolean) => {
    persistEnabled(enabled);
    set({ isEnabled: enabled });
  },
  setAutoMode: (auto: boolean) => set({ isAutoMode: auto }),
  setLightweightModelId: (id: string) => set({ lightweightModelId: id }),
  setPowerfulModelId: (id: string) => set({ powerfulModelId: id }),
  setLastClassification: (result: ClassificationResult | null) =>
    set({ lastClassification: result }),
}));
