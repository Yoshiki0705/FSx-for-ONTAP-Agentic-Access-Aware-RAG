import { useEffect, useRef } from 'react';

/**
 * スクリーンリーダー用アナウンサーフック
 * 動的なコンテンツ変更をスクリーンリーダーに通知
 * 
 * @param message - アナウンスするメッセージ
 * @param priority - アナウンスの優先度（'polite' | 'assertive'）
 */
export function useAnnouncer(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // アナウンサー要素が存在しない場合は作成
    if (!announcerRef.current) {
      const announcer = document.createElement('div');
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', priority);
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only'; // スクリーンリーダー専用（視覚的に非表示）
      announcer.style.position = 'absolute';
      announcer.style.left = '-10000px';
      announcer.style.width = '1px';
      announcer.style.height = '1px';
      announcer.style.overflow = 'hidden';
      document.body.appendChild(announcer);
      announcerRef.current = announcer;
    }

    // メッセージを更新
    if (message && announcerRef.current) {
      announcerRef.current.textContent = message;
    }

    // クリーンアップ
    return () => {
      if (announcerRef.current && !message) {
        document.body.removeChild(announcerRef.current);
        announcerRef.current = null;
      }
    };
  }, [message, priority]);
}
