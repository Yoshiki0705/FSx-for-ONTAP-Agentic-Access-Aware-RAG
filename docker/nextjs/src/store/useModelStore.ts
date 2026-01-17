import { create } from 'zustand';

interface ModelState {
  providerFilter: string;
  modalityFilter: string;
  availabilityFilter: string;
  showConfirmDialog: boolean;
  pendingModelId: string | null;
  setProviderFilter: (filter: string) => void;
  setModalityFilter: (filter: string) => void;
  setAvailabilityFilter: (filter: string) => void;
  clearFilters: () => void;
  selectModel: (modelId: string) => void;
  confirmSelection: () => void;
  cancelSelection: () => void;
}

export const useModelStore = create<ModelState>((set) => ({
  providerFilter: '',
  modalityFilter: '',
  availabilityFilter: '',
  showConfirmDialog: false,
  pendingModelId: null,
  setProviderFilter: (filter) => set({ providerFilter: filter }),
  setModalityFilter: (filter) => set({ modalityFilter: filter }),
  setAvailabilityFilter: (filter) => set({ availabilityFilter: filter }),
  clearFilters: () => set({ 
    providerFilter: '', 
    modalityFilter: '', 
    availabilityFilter: '' 
  }),
  selectModel: (modelId) => set({ 
    pendingModelId: modelId, 
    showConfirmDialog: true 
  }),
  confirmSelection: () => set({ 
    showConfirmDialog: false, 
    pendingModelId: null 
  }),
  cancelSelection: () => set({ 
    showConfirmDialog: false, 
    pendingModelId: null 
  }),
}));