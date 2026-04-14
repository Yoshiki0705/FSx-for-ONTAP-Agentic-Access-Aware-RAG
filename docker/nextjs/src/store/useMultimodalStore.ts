/**
 * Multimodal RAG Search — Zustand Store
 *
 * Manages multimodal search UI state: feature flags, active KB type,
 * media type filter, and embedding model display name.
 *
 * Requirements: 4.6, 13.3
 */

import { create } from 'zustand';
import type { ActiveKBType, MediaTypeFilter } from '@/types/multimodal';

export interface MultimodalState {
  /** Whether multimodal search is enabled (MULTIMODAL_ENABLED env var) */
  multimodalEnabled: boolean;
  /** Whether dual KB mode is active (DUAL_KB_MODE env var) */
  dualKbMode: boolean;
  /** Currently active KB type in dual mode */
  activeKbType: ActiveKBType;
  /** Current media type filter selection */
  mediaTypeFilter: MediaTypeFilter;
  /** Display name of the current embedding model */
  embeddingModelName: string;

  /** Switch active KB type (dual mode) */
  setActiveKbType: (type: ActiveKBType) => void;
  /** Set media type filter */
  setMediaTypeFilter: (filter: MediaTypeFilter) => void;
}

export const useMultimodalStore = create<MultimodalState>((set) => ({
  multimodalEnabled: process.env.NEXT_PUBLIC_MULTIMODAL_ENABLED === 'true',
  dualKbMode: process.env.NEXT_PUBLIC_DUAL_KB_MODE === 'true',
  activeKbType: 'text',
  mediaTypeFilter: 'all',
  embeddingModelName:
    process.env.NEXT_PUBLIC_EMBEDDING_MODEL_DISPLAY_NAME || 'Amazon Titan Text Embeddings v2',

  setActiveKbType: (type) => set({ activeKbType: type }),
  setMediaTypeFilter: (filter) => set({ mediaTypeFilter: filter }),
}));
