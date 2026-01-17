'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock } from 'lucide-react';

interface QueueResult {
  success: number;
  failed: number;
  total: number;
}

// モック関数（実際の実装では適切なAPIを呼び出す）
async function processQueue(): Promise<QueueResult | undefined> {
  try {
    // 実際のキュー処理ロジックをここに実装
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      success: 5,
      failed: 0,
      total: 5
    };
  } catch (error) {
    console.error('Queue processing failed:', error);
    return undefined;
  }
}

export function QueueStatus() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  const handleProcessQueue = async () => {
    setIsProcessing(true);
    try {
      const result = await processQueue();
      if (result && result.success > 0) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to process queue:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    // キューの状態を定期的にチェック
    const interval = setInterval(() => {
      // 実際の実装では適切なAPIを呼び出してキューの状態を取得
      setQueueCount(Math.floor(Math.random() * 10));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (showSuccess) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm">キューの処理が完了しました</span>
      </div>
    );
  }

  if (queueCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 text-amber-600">
        <Clock className="h-4 w-4" />
        <span className="text-sm">{queueCount}件の処理待ち</span>
      </div>
      <button
        onClick={handleProcessQueue}
        disabled={isProcessing}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
      >
        {isProcessing ? '処理中...' : '処理実行'}
      </button>
    </div>
  );
}
