'use client';

import { useState, useEffect } from 'react';

/**
 * prefers-reduced-motionメディアクエリを検出するカスタムフック
 * ユーザーがアニメーションの削減を希望している場合にtrueを返す
 * 
 * Requirements: 11.5
 * 
 * @returns {boolean} アニメーション削減が有効な場合はtrue
 * 
 * @example
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 * 
 * if (prefersReducedMotion) {
 *   // アニメーションなしのUIを表示
 *   return <div>{content}</div>;
 * }
 * 
 * // アニメーション付きのUIを表示
 * return <motion.div animate={{ opacity: 1 }}>{content}</motion.div>;
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // prefers-reduced-motionメディアクエリを作成
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    // 初期値を設定
    setPrefersReducedMotion(mediaQuery.matches);

    // メディアクエリの変更を監視
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // イベントリスナーを追加
    mediaQuery.addEventListener('change', handleChange);

    // クリーンアップ
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}
