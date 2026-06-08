'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MediaTypeIndicator } from './MediaTypeIndicator';
import { MediaPreview } from './MediaPreview';
import { buildCitationDisplayInfo } from '@/lib/citations/document-name-resolver';
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
 * ソースドキュメント（Citation）表示コンポーネント
 *
 * - ファイルパスを人間可読形式で表示
 * - FSx ONTAP ボリュームパスをツールチップに表示
 * - Permission バッジ（全員アクセス可 / 管理者のみ / 制限付き）
 * - 展開時にコンテンツプレビューとフルパスを表示
 *
 * Requirements: 4.4, UX-001
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
        {uniqueCitations.map((cite, index) => {
          const info = buildCitationDisplayInfo(cite.s3Uri || cite.fileName, cite.metadata);

          return (
            <div
              key={`${cite.fileName}-${index}`}
              className="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50"
            >
              <button
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                className="w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors rounded-md"
                aria-expanded={expandedIndex === index}
                title={`FSx: ${info.fsxVolumePath}`}
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
                    {info.displayName}
                  </span>
                  {info.permissionBadge && (
                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs ${
                      info.permissionBadge === '全員アクセス可' || info.permissionBadge === 'Everyone'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : info.permissionBadge === '管理者のみ' || info.permissionBadge === 'Admin Only'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {info.permissionBadge}
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
              {expandedIndex === index && (
                <div className="px-3 pb-2 border-t border-gray-200 dark:border-gray-600">
                  {/* File path info */}
                  <div className="mt-2 mb-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-400">📂</span>
                      <span className="font-mono text-[10px] break-all">{info.filePath}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-400">💾</span>
                      <span className="font-mono text-[10px]">FSx: {info.fsxVolumePath}</span>
                    </div>
                  </div>
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
                  {cite.content && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap leading-relaxed border-l-2 border-blue-200 dark:border-blue-700 pl-2">
                      {cite.content.substring(0, 300)}
                      {cite.content.length > 300 && '...'}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
