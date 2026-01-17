'use client';

import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';
import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { ModelGrid } from './ModelGrid';
import { ModelFilter } from './ModelFilter';
import { ModelConfirmDialog } from './ModelConfirmDialog';
import { useModelStore } from '@/store/useModelStore';
import { AVAILABLE_MODELS, getModelById } from '@/config/bedrock-models';

interface ModelSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModelId: string;
  availableModels: string[];
  onModelChange: (modelId: string) => void;
}

export const ModelSelectionModal: React.FC<ModelSelectionModalProps> = ({
  isOpen,
  onClose,
  currentModelId,
  availableModels,
  onModelChange,
}) => {
  const {
    providerFilter,
    modalityFilter,
    availabilityFilter,
    showConfirmDialog,
    pendingModelId,
    setProviderFilter,
    setModalityFilter,
    setAvailabilityFilter,
    clearFilters,
    selectModel,
    confirmSelection,
    cancelSelection,
  } = useModelStore();

  const [localSelectedModel, setLocalSelectedModel] = useState(currentModelId);

  useEffect(() => {
    setLocalSelectedModel(currentModelId);
  }, [currentModelId]);

  const handleModelSelect = (modelId: string) => {
    setLocalSelectedModel(modelId);
    selectModel(modelId);
  };

  const handleConfirm = () => {
    if (pendingModelId) {
      onModelChange(pendingModelId);
      confirmSelection();
      onClose();
    }
  };

  const handleCancel = () => {
    cancelSelection();
    setLocalSelectedModel(currentModelId);
  };

  const pendingModel = pendingModelId ? getModelById(pendingModelId) : null;

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          {/* オーバーレイ */}
          <Dialog.Overlay className="fixed inset-0 bg-black/50 animate-in fade-in-0 z-50" />

          {/* コンテンツ */}
          <Dialog.Content
            className="
              fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
              bg-white dark:bg-gray-800 rounded-lg shadow-xl
              w-[95vw] max-w-7xl h-[90vh]
              animate-in fade-in-0 zoom-in-95 duration-200
              z-50 flex flex-col
            "
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <Dialog.Title className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  モデルを選択
                </Dialog.Title>
                <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  使用するAIモデルを選択してください
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="閉じる"
                >
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* フィルター */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <ModelFilter
                providerFilter={providerFilter}
                modalityFilter={modalityFilter}
                availabilityFilter={availabilityFilter}
                onProviderChange={setProviderFilter}
                onModalityChange={setModalityFilter}
                onAvailabilityChange={setAvailabilityFilter}
                onClearFilters={clearFilters}
              />
            </div>

            {/* モデルグリッド */}
            <div className="flex-1 overflow-y-auto p-6">
              <ModelGrid
                models={AVAILABLE_MODELS}
                selectedModelId={localSelectedModel}
                availableModels={availableModels}
                onModelSelect={handleModelSelect}
                providerFilter={providerFilter}
                modalityFilter={modalityFilter}
                availabilityFilter={availabilityFilter}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 確認ダイアログ */}
      <ModelConfirmDialog
        isOpen={showConfirmDialog}
        model={pendingModel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};