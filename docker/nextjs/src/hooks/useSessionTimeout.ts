'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface UseSessionTimeoutOptions {
  /** タイムアウト時間（ミリ秒）デフォルト: 30分 */
  timeout?: number;
  /** タイムアウト時のコールバック */
  onTimeout?: () => void;
  /** 警告時間（ミリ秒）デフォルト: 5分前 */
  warningTime?: number;
  /** 警告時のコールバック */
  onWarning?: () => void;
}

/**
 * セッションタイムアウトフック
 * 一定時間非アクティブの場合、自動的にサインアウトする
 */
export function useSessionTimeout(options: UseSessionTimeoutOptions = {}) {
  const {
    timeout = 30 * 60 * 1000, // 30分
    onTimeout,
    warningTime = 5 * 60 * 1000, // 5分
    onWarning,
  } = options;

  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(Date.now());

  // タイムアウト処理
  const handleTimeout = useCallback(() => {
    console.log('セッションタイムアウト');
    
    // ローカルストレージをクリア（機密情報を削除）
    if (typeof window !== 'undefined') {
      // チャット履歴以外のセッション情報をクリア
      const keysToRemove = ['auth-token', 'session-id', 'user-credentials'];
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    // コールバック実行
    if (onTimeout) {
      onTimeout();
    }

    // サインインページへリダイレクト
    router.push('/signin?reason=timeout');
  }, [onTimeout, router]);

  // 警告処理
  const handleWarning = useCallback(() => {
    console.log('セッションタイムアウト警告');
    
    if (onWarning) {
      onWarning();
    }
  }, [onWarning]);

  // タイマーをリセット
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    // 既存のタイマーをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }

    // 警告タイマーを設定
    const warningDelay = timeout - warningTime;
    if (warningDelay > 0) {
      warningRef.current = setTimeout(handleWarning, warningDelay);
    }

    // タイムアウトタイマーを設定
    timeoutRef.current = setTimeout(handleTimeout, timeout);
  }, [timeout, warningTime, handleTimeout, handleWarning]);

  // アクティビティイベントを監視
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      resetTimer();
    };

    // イベントリスナーを登録
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // 初回タイマー設定
    resetTimer();

    // クリーンアップ
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current);
      }
    };
  }, [resetTimer]);

  return {
    resetTimer,
    lastActivity: lastActivityRef.current,
  };
}
