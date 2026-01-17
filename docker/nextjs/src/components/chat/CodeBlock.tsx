'use client';

import { useState } from 'react';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';

interface CodeBlockProps {
  code: string;
  language?: string;
}

/**
 * コードブロックコンポーネント
 * シンタックスハイライトとコピー機能を提供
 */
export function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const locale = useLocale();
  const t = useCustomTranslations(locale);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  return (
    <div className="relative group my-4">
      {/* 言語表示とコピーボタン */}
      <div className="flex items-center justify-between bg-gray-800 dark:bg-gray-900 px-4 py-2 rounded-t-lg">
        <span className="text-xs font-mono text-gray-400 uppercase">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors rounded hover:bg-gray-700"
          aria-label="コードをコピー"
        >
          {copied ? (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>コピー済み</span>
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>コピー</span>
            </>
          )}
        </button>
      </div>

      {/* コードブロック */}
      <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-b-lg overflow-x-auto">
        <code className="text-sm font-mono">{code}</code>
      </pre>
    </div>
  );
}

/**
 * インラインコードコンポーネント
 */
export function InlineCode({ children }: { children: string }) {
  const locale = useLocale();
  const t = useCustomTranslations(locale);
  
  return (
    <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 rounded text-sm font-mono">
      {children}
    </code>
  );
}
