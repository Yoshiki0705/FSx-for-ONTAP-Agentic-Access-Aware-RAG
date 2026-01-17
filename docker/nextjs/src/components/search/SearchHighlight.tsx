'use client';

import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';

interface SearchHighlightProps {
  /** ハイライト対象のテキスト */
  text: string;
  /** 検索クエリ */
  query: string;
  /** ハイライトのクラス名 */
  highlightClassName?: string;
  /** テキストのクラス名 */
  textClassName?: string;
}

/**
 * 検索結果ハイライトコンポーネント
 * テキスト内の検索クエリにマッチする部分をハイライト表示
 */
  const locale = useLocale();
  const t = useCustomTranslations(locale);

export function SearchHighlight({
  text,
  query,
  highlightClassName = 'bg-yellow-200 dark:bg-yellow-900 font-semibold',
  textClassName = ''
}: SearchHighlightProps) {
  /**
   * テキストをハイライト付きの要素に分割
   */
  const highlightedContent = useMemo(() => {
    if (!query || !text) {
      return <span className={textClassName}>{text}</span>;
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const parts: Array<{ text: string; isHighlight: boolean }> = [];
    let lastIndex = 0;

    // マッチする全ての位置を見つける
    let index = lowerText.indexOf(lowerQuery);
    while (index !== -1) {
      // マッチ前のテキスト
      if (index > lastIndex) {
        parts.push({
          text: text.substring(lastIndex, index),
          isHighlight: false
        });
      }

      // マッチしたテキスト
      parts.push({
        text: text.substring(index, index + query.length),
        isHighlight: true
      });

      lastIndex = index + query.length;
      index = lowerText.indexOf(lowerQuery, lastIndex);
    }

    // 残りのテキスト
    if (lastIndex < text.length) {
      parts.push({
        text: text.substring(lastIndex),
        isHighlight: false
      });
    }

    return (
      <span className={textClassName}>
        {parts.map((part, index) => (
          part.isHighlight ? (
            <mark
              key={index}
              className={highlightClassName}
            >
              {part.text}
            </mark>
          ) : (
            <span key={index}>{part.text}</span>
          )
        ))}
      </span>
    );
  }, [text, query, highlightClassName, textClassName]);

  return <>{highlightedContent}</>;
}
