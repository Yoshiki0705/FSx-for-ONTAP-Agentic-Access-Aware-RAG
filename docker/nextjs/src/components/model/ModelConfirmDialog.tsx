'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { BedrockModel } from '@/config/bedrock-models';
import { AlertTriangle, X } from 'lucide-react';

interface ModelConfirmDialogProps {
  isOpen: boolean;
  model: BedrockModel | null | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ModelConfirmDialog: React.FC<ModelConfirmDialogProps> = ({
  isOpen,
  model,
  onConfirm,
  onCancel,
}) => {
  if (!model) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 animate-in fade-in-0 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[90vw] max-w-md animate-in fade-in-0 zoom-in-95 duration-200 z-50">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                モデルを変更しますか？
              </Dialog.Title>
            </div>
            
            <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <strong>{model.name}</strong> に変更します。現在の会話は継続されますが、応答の特性が変わる可能性があります。
            </Dialog.Description>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                変更する
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};