'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MediaTypeIndicator } from './MediaTypeIndicator';
import { MediaPreview } from './MediaPreview';
import type { MediaType } from '@/types/multimodal';

export interface CitationItem {
  fileName: string;
  s3Uri: string;
  content: string;
  metadata?: Record<string, unknown>;
  /** Multimodal extension fields */
  mediaType?: MediaType;
  presignedUrl?: string;
  duration?: number;
  timestampRange?: { start: number; end: number };
}

interface CitationDisplayProps {
  citations: CitationItem[];
}

/**
 * S3 URIからFSxファイルパスを抽出する
 * 例: s3://alias/confidential/financial-report.md → confidential/financial-report.md
 */
function extractFilePath(s3Uri: string, fileName: string): string {
  if (!s3Uri) return fileName;
  try {
    // S3 URI: s3://bucket-or-alias/path/to/file.md
    const withoutProtocol = s3Uri.replace(/^s3:\/\/[^/]+\//, '');
    return withoutProtocol || fileName;
  } catch {
    return fileName;
  }
}

/**
 * access_levelをロケール対応のラベルに変換する
 */
function getAccessLevelLabel(accessLevel: string, t: (key: string) => string): string {
  switch (accessLevel) {
    case 'public':
      return t('accessPublic');
    case 'confidential':
      return t('accessConfidential');
    case 'restricted':
      return t('accessRestricted');
    default:
      return accessLevel;
  }
}

/**
 * ソースドキュメント（Citation）表示コンポーネント
 * 
 * RAG検索結果のcitation情報（ファイルパス、該当箇所）をレンダリングする。
 * Requirements: 4.4
 */
export function CitationDisplay({ citations }: CitationDisplayProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const t = useTranslations('citation');

  if (!citations || citations.length === 0) {
    return null;
  }

  // 重複ファイル名を除去
  const uniqueCitations = citations.reduce<CitationItem[]>((acc, cite) => {
    if (!acc.find((c) => c.fileName === cite.fileName && c.content === cite.content)) {
      acc.push(cite);
    }
    return acc;
  }, []);

  return (
    <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
      <div className="flex items-center space-x-1 mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          📄 {t('referencedDocuments')} ({uniqueCitations.length})
        </span>
      </div>
      <div className="space-y-1">
        {uniqueCitations.map((cite, index) => (
          <div
            key={`${cite.fileName}-${index}`}
            className="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50"
          >
            <button
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              className="w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors rounded-md"
              aria-expanded={expandedIndex === index}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">
                  {cite.mediaType ? (
                    <MediaTypeIndicator mediaType={cite.mediaType} />
                  ) : (
                    '📎'
                  )}
                </span>
                <span className="text-gray-700 dark:text-gray-300 font-medium truncate">
                  {extractFilePath(cite.s3Uri, cite.fileName)}
                </span>
                {cite.metadata?.access_level && (
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs ${
                    cite.metadata.access_level === 'public'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : cite.metadata.access_level === 'confidential'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {getAccessLevelLabel(String(cite.metadata.access_level), t)}
                  </span>
                )}
              </div>
              <svg
                className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${
                  expandedIndex === index ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedIndex === index && cite.content && (
              <div className="px-3 pb-2 border-t border-gray-200 dark:border-gray-600">
                {cite.mediaType && cite.mediaType !== 'text' && (
                  <MediaPreview
                    mediaType={cite.mediaType}
                    presignedUrl={cite.presignedUrl}
                    fileName={cite.fileName}
                    duration={cite.duration}
                    timestampRange={cite.timestampRange}
                    className="mt-2 mb-1"
                  />
                )}
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap leading-relaxed">
                  {cite.content}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
