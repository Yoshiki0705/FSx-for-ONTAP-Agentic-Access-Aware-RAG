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
  /**
   * Source boundary type for trust distinction:
   * - 'verified': Permission-checked KB document (FSx ONTAP, default)
   * - 'reference': External web search result (untrusted, informational only)
   */
  boundaryType?: 'verified' | 'reference';
  /** Whether permission was explicitly verified for this citation */
  permissionVerified?: boolean;
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
 * - Boundary バッジ（認証済み / 参考情報）で信頼境界を視覚区別
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

  // Separate verified (KB) and reference (web) citations
  const verifiedCitations = uniqueCitations.filter((c) => (c.boundaryType || 'verified') === 'verified');
  const referenceCitations = uniqueCitations.filter((c) => c.boundaryType === 'reference');

  return (
    <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
      {/* Verified documents section */}
      {verifiedCitations.length > 0 && (
        <>
          <div className="flex items-center space-x-1 mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              📄 {t('referencedDocuments')} ({verifiedCitations.length})
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              {t('verified')}
            </span>
          </div>
          <div className="space-y-1">
            {verifiedCitations.map((cite, index) => (
              <CitationCard
                key={`verified-${cite.fileName}-${index}`}
                cite={cite}
                index={index}
                expandedIndex={expandedIndex}
                onToggle={setExpandedIndex}
              />
            ))}
          </div>
        </>
      )}

      {/* Reference (web search) section */}
      {referenceCitations.length > 0 && (
        <>
          <div className={`flex items-center space-x-1 mb-2 ${verifiedCitations.length > 0 ? 'mt-3' : ''}`}>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              🌐 {t('webReferences')} ({referenceCitations.length})
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {t('reference')}
            </span>
          </div>
          {/* Responsible AI disclaimer: web results are unverified external data */}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5 italic">
            {t('webDisclaimer')}
          </p>
          <div className="space-y-1">
            {referenceCitations.map((cite, index) => (
              <CitationCard
                key={`reference-${cite.fileName}-${index}`}
                cite={cite}
                index={verifiedCitations.length + index}
                expandedIndex={expandedIndex}
                onToggle={setExpandedIndex}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}


/**
 * Individual citation card — extracted for reuse across verified/reference sections.
 */
function CitationCard({
  cite,
  index,
  expandedIndex,
  onToggle,
}: {
  cite: CitationItem;
  index: number;
  expandedIndex: number | null;
  onToggle: (index: number | null) => void;
}) {
  const info = buildCitationDisplayInfo(cite.s3Uri || cite.fileName, cite.metadata);
  const isReference = cite.boundaryType === 'reference';

  return (
    <div
      className={`rounded-md border bg-gray-50 dark:bg-gray-800/50 ${
        isReference
          ? 'border-blue-200 dark:border-blue-800'
          : 'border-gray-200 dark:border-gray-600'
      }`}
    >
      <button
        onClick={() => onToggle(expandedIndex === index ? null : index)}
        className="w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors rounded-md"
        aria-expanded={expandedIndex === index}
        title={isReference ? cite.s3Uri : `FSx: ${info.fsxVolumePath}`}
      >
        <div className="flex items-center space-x-2 min-w-0">
          <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">
            {isReference ? '🌐' : cite.mediaType ? (
              <MediaTypeIndicator mediaType={cite.mediaType} />
            ) : (
              '📎'
            )}
          </span>
          <span className="text-gray-700 dark:text-gray-300 font-medium truncate">
            {info.displayName}
          </span>
          {!isReference && info.permissionBadge && (
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
          {/* Path info — show URL for references, FSx path for verified */}
          <div className="mt-2 mb-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            {isReference ? (
              <div className="flex items-center space-x-1">
                <span className="text-gray-400">🔗</span>
                <a
                  href={cite.s3Uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {cite.s3Uri}
                </a>
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-1">
                  <span className="text-gray-400">📂</span>
                  <span className="font-mono text-[10px] break-all">{info.filePath}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-gray-400">💾</span>
                  <span className="font-mono text-[10px]">FSx: {info.fsxVolumePath}</span>
                </div>
              </>
            )}
          </div>
          {!isReference && cite.mediaType && cite.mediaType !== 'text' && (
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
}
