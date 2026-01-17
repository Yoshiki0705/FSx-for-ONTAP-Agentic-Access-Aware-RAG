'use client';

import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';
import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

/**
 * PWAインストールプロンプトコンポーネント
 */
  const locale = useLocale();
  const t = useCustomTranslations(locale);

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // インストール済みかチェック
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    if (isInstalled) return;

    // 以前に却下されたかチェック
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;

    // beforeinstallpromptイベントをリッスン
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // インストールプロンプトを表示
    deferredPrompt.prompt();

    // ユーザーの選択を待つ
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWAインストールが承認されました');
    } else {
      console.log('PWAインストールが却下されました');
    }

    // プロンプトをクリア
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        {/* 閉じるボタン */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="閉じる"
        >
          <X className="w-4 h-4" />
        </button>

        {/* アイコン */}
        <div className="flex items-start space-x-3 mb-3">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <Download className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              アプリをインストール
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ホーム画面に追加して、いつでも素早くアクセスできます
            </p>
          </div>
        </div>

        {/* 機能リスト */}
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4 ml-15">
          <li>• オフラインでも利用可能</li>
          <li>• 高速な起動</li>
          <li>• プッシュ通知t("permissions.available")</li>
        </ul>

        {/* アクションボタン */}
        <div className="flex space-x-2">
          <button
            onClick={handleInstall}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
          >
            インストール
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors duration-200"
          >
            後で
          </button>
        </div>
      </div>
    </div>
  );
}
