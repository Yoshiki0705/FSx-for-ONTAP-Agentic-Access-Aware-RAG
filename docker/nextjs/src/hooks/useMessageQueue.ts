'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  queueMessage,
  getQueuedMessages,
  getQueueCount,
  processQueue,
  registerBackgroundSync,
  type QueuedMessage,
} from '@/lib/message-queue';

/**
 * メッセージキュー管理フック
 */
export function useMessageQueue() {
  const [queueCount, setQueueCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // キュー数を更新
  const updateQueueCount = useCallback(async () => {
    try {
      const count = await getQueueCount();
      setQueueCount(count);
    } catch (error) {
      console.error('キュー数の取得に失敗:', error);
    }
  }, []);

  // メッセージをキューに追加
  const addToQueue = useCallback(
    async (data: any) => {
      try {
        await queueMessage(data);
        await updateQueueCount();
        return true;
      } catch (error) {
        console.error('メッセージのキューイングに失敗:', error);
        return false;
      }
    },
    [updateQueueCount]
  );

  // キューを処理
  const processQueueMessages = useCallback(async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      const result = await processQueue();
      await updateQueueCount();
      return result;
    } catch (error) {
      console.error('キューの処理に失敗:', error);
      return { success: 0, failed: 0, errors: [] };
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, updateQueueCount]);

  // オンライン/オフライン状態の監視
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // オンライン復旧時にキューを処理
      if (queueCount > 0) {
        await processQueueMessages();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queueCount, processQueueMessages]);

  // 初期化時にキュー数を取得
  useEffect(() => {
    updateQueueCount();
  }, [updateQueueCount]);

  // バックグラウンド同期を登録
  useEffect(() => {
    registerBackgroundSync();
  }, []);

  return {
    queueCount,
    isProcessing,
    isOnline,
    addToQueue,
    processQueue: processQueueMessages,
    updateQueueCount,
  };
}
