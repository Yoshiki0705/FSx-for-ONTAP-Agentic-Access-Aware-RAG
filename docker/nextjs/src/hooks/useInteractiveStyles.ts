/**
 * インタラクティブ要素の統一スタイルを提供するカスタムフック
 */

'use client';

import { useTheme } from '../contexts/ThemeContext';
import { interactiveStyles, buttonStyles, linkStyles } from '../lib/color-utils';

/**
 * インタラクティブ要素の統一スタイルを取得するフック
 * 
 * 使用例:
 * ```tsx
 * const { getHoverStyle, getFocusStyle, getButtonStyle } = useInteractiveStyles();
 * 
 * <button className={`${getButtonStyle('primary')} ${getFocusStyle()}`}>
 *   クリック
 * </button>
 * ```
 */
export function useInteractiveStyles() {
  const { theme } = useTheme();

  /**
   * ホバースタイルを取得
   */
  const getHoverStyle = () => {
    return interactiveStyles.hover[theme];
  };

  /**
   * フォーカススタイルを取得
   */
  const getFocusStyle = () => {
    return interactiveStyles.focus[theme];
  };

  /**
   * アクティブスタイルを取得
   */
  const getActiveStyle = () => {
    return interactiveStyles.active[theme];
  };

  /**
   * ボタンスタイルを取得
   */
  const getButtonStyle = (variant: 'primary' | 'secondary' | 'destructive' | 'ghost') => {
    return buttonStyles[variant][theme];
  };

  /**
   * リンクスタイルを取得
   */
  const getLinkStyle = () => {
    return linkStyles[theme];
  };

  /**
   * 統合されたインタラクティブスタイルを取得
   * ホバー、フォーカス、アクティブを全て含む
   */
  const getInteractiveStyle = () => {
    return `${getHoverStyle()} ${getFocusStyle()} ${getActiveStyle()}`;
  };

  return {
    getHoverStyle,
    getFocusStyle,
    getActiveStyle,
    getButtonStyle,
    getLinkStyle,
    getInteractiveStyle
  };
}
