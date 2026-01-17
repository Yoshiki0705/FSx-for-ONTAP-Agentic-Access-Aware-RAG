'use client';

import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';
import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SessionTimeoutWarningProps {
  /** 警告表示フラグ */
  show: boolean;
  /** 残り時間（秒） */
  remainingTime: number;
  /** 継続ボタンクリック時のコールバック */
  onContinue: () => void;
  /** サインアウトボタンクリック時のコールバック */
  onSignOut: () => void;
}

/**
 * セッションタイムアウト警告ダイアログ
 */
  const locale = useLocale();
  const t = useCustomTranslations(locale);

export function SessionTimeoutWarning({
  show,
  remainingTime,
  onContinue,
  onSignOut,
}: SessionTimeoutWarningProps) {
  const [timeLeft, setTimeLeft] = useState(remainingTime);

  useEffect(() => {
    if (!show) return;

    setTimeLeft(remainingTime);

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [show, remainingTime]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <Dialog.Root open={show}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 z-50">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="flex-1">
              <Dialog.Title className="text-lg font-semibold mb-2">
                セッションタイムアウト警告
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                非アクティブ状態が続いています。
                <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {minutes}分{seconds}秒
                </span>
                後に自動的にサインアウトされます。
              </Dialog.Description>
              <div className="flex space-x-3">
                <Button
                  variant="default"
                  onClick={onContinue}
                  className="flex-1"
                >
                  セッションを継続
                </Button>
                <Button
                  variant="secondary"
                  onClick={onSignOut}
                >
                  サインアウト
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
