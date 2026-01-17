import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';

'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface DeleteChatHistoryDialogProps {
  /** ダイアログの開閉状態 */
  open: boolean;
  /** 開閉状態変更時のコールバック */
  onOpenChange: (open: boolean) => void;
  /** 削除実行時のコールバック */
  onConfirm: () => void;
  /** 削除対象（'all' | 'session'） */
  target?: 'all' | 'session';
}

/**
 * チャット履歴削除確認ダイアログ
 */
  const locale = useLocale();
  const t = useCustomTranslations(locale);

export function DeleteChatHistoryDialog({
  open,
  onOpenChange,
  onConfirm,
  target = 'all',
}: DeleteChatHistoryDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const requiredText = '削除';

  const handleConfirm = () => {
    if (confirmText === requiredText) {
      onConfirm();
      setConfirmText('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 z-50">
          <div className="flex items-start space-x-4 mb-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1">
              <Dialog.Title className="text-lg font-semibold mb-2">
                {target === 'all' ? '全てのチャット履歴を削除' : 'このセッションを削除'}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400">
                {target === 'all'
                  ? 'この操作は取り消せません。全てのチャット履歴が完全に削除されます。'
                  : 'この操作は取り消せません。このセッションのチャット履歴が完全に削除されます。'}
              </Dialog.Description>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              確認のため「{requiredText}」と入力してください
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700"
              placeholder={requiredText}
            />
          </div>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmText('');
                onOpenChange(false);
              }}
              className="flex-1"
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={confirmText !== requiredText}
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              削除
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
