/**
 * MediaTypeIndicator — displays an emoji icon for each media type.
 *
 * 📄 text | 🖼️ image | 🎥 video | 🔊 audio
 * Unknown types fall back to 📄.
 * Only renders when MULTIMODAL_ENABLED=true.
 *
 * Requirements: 4.1, 9.3
 */

'use client';

import React from 'react';
import { useMultimodalStore } from '@/store/useMultimodalStore';
import type { MediaType } from '@/types/multimodal';

/** Deterministic icon mapping — exported for testing */
export const MEDIA_TYPE_ICONS: Record<string, string> = {
  text: '📄',
  image: '🖼️',
  video: '🎥',
  audio: '🔊',
};

/** Returns the icon for a given mediaType (defaults to 📄) */
export function getMediaTypeIcon(mediaType: string | undefined): string {
  if (!mediaType) return MEDIA_TYPE_ICONS.text;
  return Object.hasOwn(MEDIA_TYPE_ICONS, mediaType)
    ? MEDIA_TYPE_ICONS[mediaType]
    : MEDIA_TYPE_ICONS.text;
}

interface MediaTypeIndicatorProps {
  mediaType?: MediaType | string;
  className?: string;
}

export function MediaTypeIndicator({ mediaType, className = '' }: MediaTypeIndicatorProps) {
  const multimodalEnabled = useMultimodalStore((s) => s.multimodalEnabled);

  if (!multimodalEnabled) return null;

  return (
    <span
      className={`inline-flex items-center text-sm ${className}`}
      role="img"
      aria-label={mediaType ?? 'text'}
    >
      {getMediaTypeIcon(mediaType)}
    </span>
  );
}
