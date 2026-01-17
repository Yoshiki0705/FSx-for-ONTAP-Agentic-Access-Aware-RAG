import { useEffect, useRef, RefObject } from 'react';

/**
 * フォーカストラップフック
 * モーダルやダイアログ内でフォーカスを閉じ込める
 */
export function useFocusTrap<T extends HTMLElement>(
  isActive: boolean,
  options?: {
    initialFocus?: RefObject<HTMLElement>;
    returnFocus?: boolean;
  }
): RefObject<T> {
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // 現在のアクティブ要素を保存
    previousActiveElement.current = document.activeElement as HTMLElement;

    // フォーカス可能な要素を取得
    const getFocusableElements = (): HTMLElement[] => {
      if (!containerRef.current) return [];

      const selector = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      return Array.from(containerRef.current.querySelectorAll(selector));
    };

    // 初期フォーカスを設定
    const setInitialFocus = () => {
      if (options?.initialFocus?.current) {
        options.initialFocus.current.focus();
      } else {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    };

    setInitialFocus();

    // Tabキーのハンドリング
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab: 最初の要素から最後の要素へ
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: 最後の要素から最初の要素へ
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // クリーンアップ
    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // フォーカスを元の要素に戻す
      if (options?.returnFocus !== false && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive, options]);

  return containerRef;
}
