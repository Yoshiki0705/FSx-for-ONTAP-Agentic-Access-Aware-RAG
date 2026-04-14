/**
 * MediaPreview — inline preview for image / video / audio search results.
 *
 * - Image: thumbnail (max 200px width)
 * - Video: thumbnail + timestamp range
 * - Audio: play button + duration
 * - Fallback: placeholder icon + file name on load failure
 * - Auto-refreshes expired presigned URLs (up to 3 retries)
 *
 * Only renders when MULTIMODAL_ENABLED=true.
 *
 * Requirements: 4.2, 4.3, 4.4, 11.3, 12.3
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useMultimodalStore } from '@/store/useMultimodalStore';
import { getMediaTypeIcon } from './MediaTypeIndicator';
import type { MediaType } from '@/types/multimodal';

interface MediaPreviewProps {
  mediaType: MediaType;
  presignedUrl?: string;
  fileName: string;
  duration?: number;
  timestampRange?: { start: number; end: number };
  onRefreshUrl?: () => Promise<string | undefined>;
  className?: string;
}

const MAX_RETRIES = 3;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MediaPreview({
  mediaType,
  presignedUrl,
  fileName,
  duration,
  timestampRange,
  onRefreshUrl,
  className = '',
}: MediaPreviewProps) {
  const multimodalEnabled = useMultimodalStore((s) => s.multimodalEnabled);
  const [url, setUrl] = useState(presignedUrl);
  const [failed, setFailed] = useState(false);
  const retryCount = useRef(0);

  useEffect(() => {
    setUrl(presignedUrl);
    setFailed(false);
    retryCount.current = 0;
  }, [presignedUrl]);

  const handleLoadError = useCallback(async () => {
    if (retryCount.current >= MAX_RETRIES || !onRefreshUrl) {
      setFailed(true);
      return;
    }
    retryCount.current += 1;
    try {
      const newUrl = await onRefreshUrl();
      if (newUrl) {
        setUrl(newUrl);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    }
  }, [onRefreshUrl]);

  if (!multimodalEnabled) return null;

  // Placeholder on failure or missing URL
  if (failed || !url) {
    return (
      <div
        className={`flex items-center gap-2 p-2 rounded bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 ${className}`}
        data-testid="media-preview-placeholder"
      >
        <span>{getMediaTypeIcon(mediaType)}</span>
        <span className="truncate max-w-[180px]">{fileName}</span>
      </div>
    );
  }

  if (mediaType === 'image') {
    return (
      <div className={`inline-block ${className}`} data-testid="media-preview-image">
        <img
          src={url}
          alt={fileName}
          className="max-w-[200px] rounded border border-gray-200 dark:border-gray-700"
          onError={handleLoadError}
          loading="lazy"
        />
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div
        className={`flex items-center gap-2 p-2 rounded bg-gray-100 dark:bg-gray-800 ${className}`}
        data-testid="media-preview-video"
      >
        <span className="text-lg">🎥</span>
        <div className="text-xs">
          <div className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[160px]">
            {fileName}
          </div>
          {timestampRange && (
            <div className="text-gray-500 dark:text-gray-400">
              {formatDuration(timestampRange.start)} – {formatDuration(timestampRange.end)}
            </div>
          )}
          {duration != null && !timestampRange && (
            <div className="text-gray-500 dark:text-gray-400">{formatDuration(duration)}</div>
          )}
        </div>
      </div>
    );
  }

  if (mediaType === 'audio') {
    return (
      <div
        className={`flex items-center gap-2 p-2 rounded bg-gray-100 dark:bg-gray-800 ${className}`}
        data-testid="media-preview-audio"
      >
        <button
          type="button"
          className="text-lg hover:opacity-80 transition-opacity"
          aria-label={`Play ${fileName}`}
          onClick={() => {
            const audio = new Audio(url);
            audio.play().catch(() => {});
          }}
        >
          🔊
        </button>
        <div className="text-xs">
          <div className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[160px]">
            {fileName}
          </div>
          {duration != null && (
            <div className="text-gray-500 dark:text-gray-400">{formatDuration(duration)}</div>
          )}
        </div>
      </div>
    );
  }

  // text or unknown — just show icon + name
  return (
    <div
      className={`flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 ${className}`}
      data-testid="media-preview-text"
    >
      <span>{getMediaTypeIcon(mediaType)}</span>
      <span className="truncate max-w-[180px]">{fileName}</span>
    </div>
  );
}
