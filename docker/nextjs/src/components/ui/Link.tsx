'use client';

import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';

/**
 * 統一されたリンクコンポーネント
 * WCAG 2.1 AA準拠、カラーブラインドネスt('common.text', 'Text')
 */

import { AnchorHTMLAttributes, forwardRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { linkStyles } from '../../lib/color-utils';

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  external?: boolean;
}

/**
 * 統一されたリンクコンポーネント
 * 
 * 特徴:
 * - WCAG 2.1 AAレベルのコントラスト比
 * - 統一されたホバー効果（underline）
 * - 統一されたフォーカス状態（ring-2）
 * - 外部リンクの自動処理
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  (
    {
      external = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const { theme } = useTheme();

    // 基本スタイル
    const baseStyles = [
      linkStyles[theme],
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'transition-colors duration-200',
      className
    ].filter(Boolean).join(' ');

    // 外部リンクの場合の追加属性
    const externalProps = external
      ? {
          target: '_blank',
          rel: 'noopener noreferrer'
        }
      : {};

    return (
      <a
        ref={ref}
        className={baseStyles}
        {...externalProps}
        {...props}
      >
        {children}
        {external && (
          <span className="ml-1 inline-block" aria-label="外部リンク">
            ↗
          </span>
        )}
      </a>
    );
  }
);

Link.displayName = 'Link';
