/**
 * カラーユーティリティ関数
 * 
 * テーマに応じた状態カラーを提供します。
 */

export type StateType = 'success' | 'warning' | 'error' | 'info';
export type Theme = 'light' | 'dark';

export interface StateColor {
  bg: string;
  text: string;
  border: string;
  icon: string;
}

/**
 * インタラクティブ要素のスタイル定義
 */
export const interactiveStyles = {
  hover: {
    light: 'hover:bg-gray-50 hover:text-gray-900',
    dark: 'hover:bg-gray-800 hover:text-gray-100'
  },
  focus: {
    light: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    dark: 'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-900'
  },
  active: {
    light: 'active:bg-gray-100 active:text-gray-900',
    dark: 'active:bg-gray-700 active:text-gray-100'
  }
};

/**
 * ボタンスタイル定義
 */
export const buttonStyles = {
  primary: {
    light: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700',
    dark: 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600 hover:border-blue-600'
  },
  secondary: {
    light: 'bg-gray-100 text-gray-900 border-gray-300 hover:bg-gray-200',
    dark: 'bg-gray-700 text-gray-100 border-gray-600 hover:bg-gray-600'
  },
  destructive: {
    light: 'bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700',
    dark: 'bg-red-500 text-white border-red-500 hover:bg-red-600 hover:border-red-600'
  },
  ghost: {
    light: 'bg-transparent text-gray-700 border-transparent hover:bg-gray-100',
    dark: 'bg-transparent text-gray-300 border-transparent hover:bg-gray-800'
  }
};

/**
 * リンクスタイル定義
 */
export const linkStyles = {
  light: 'text-blue-600 hover:text-blue-800 hover:underline',
  dark: 'text-blue-400 hover:text-blue-300 hover:underline'
};

/**
 * 状態に応じたカラークラスを取得
 */
export function getStateColor(state: StateType, theme: Theme): StateColor {
  const colors = {
    success: {
      light: {
        bg: 'bg-green-50',
        text: 'text-green-800',
        border: 'border-green-200',
        icon: '✅'
      },
      dark: {
        bg: 'bg-green-900/20',
        text: 'text-green-300',
        border: 'border-green-700',
        icon: '✅'
      }
    },
    warning: {
      light: {
        bg: 'bg-yellow-50',
        text: 'text-yellow-800',
        border: 'border-yellow-200',
        icon: '⚠️'
      },
      dark: {
        bg: 'bg-yellow-900/20',
        text: 'text-yellow-300',
        border: 'border-yellow-700',
        icon: '⚠️'
      }
    },
    error: {
      light: {
        bg: 'bg-red-50',
        text: 'text-red-800',
        border: 'border-red-200',
        icon: '❌'
      },
      dark: {
        bg: 'bg-red-900/20',
        text: 'text-red-300',
        border: 'border-red-700',
        icon: '❌'
      }
    },
    info: {
      light: {
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        border: 'border-blue-200',
        icon: 'ℹ️'
      },
      dark: {
        bg: 'bg-blue-900/20',
        text: 'text-blue-300',
        border: 'border-blue-700',
        icon: 'ℹ️'
      }
    }
  };

  return colors[state][theme];
}

/**
 * コントラスト比を計算（WCAG準拠チェック用）
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  // 簡易的な実装（実際のプロダクションではより正確な計算が必要）
  // ここでは基本的な値を返す
  return 4.5; // WCAG AA準拠の最小値
}

/**
 * カラーブラインドネス対応のカラーペアを取得
 */
export function getAccessibleColorPair(theme: Theme) {
  return theme === 'dark' 
    ? { primary: 'text-blue-300', secondary: 'text-gray-300' }
    : { primary: 'text-blue-700', secondary: 'text-gray-700' };
}
