import { useState, useEffect } from 'react';

/**
 * オンライン/オフライン状態を監視するフック
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // 初期状態を設定
    setIsOnline(navigator.onLine);

    // オンラインになったときのハンドラー
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      
      // 3秒後にwasOfflineをリセット
      setTimeout(() => {
        setWasOffline(false);
      }, 3000);
    };

    // オフラインになったときのハンドラー
    const handleOffline = () => {
      setIsOnline(false);
    };

    // イベントリスナーを登録
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // クリーンアップ
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
