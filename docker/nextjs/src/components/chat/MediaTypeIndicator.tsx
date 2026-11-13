/**
 * MediaTypeIndicator — displays an icon for each media type.
 *
 * FileText text | Image image | Video video | Volume2 audio
 * Unknown types fall back to FileText.
 * Only renders when MULTIMODAL_ENABLED=true.
 *
 * Requirements: 4.1, 9.3
 */

'use client';

import React from 'react';
import { FileText, Image, Video, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMultimodalStore } from '@/store/useMultimodalStore';
import type { MediaType } from '@/types/multimodal';

/** Deterministic icon mapping — exported for testing */
export const MEDIA_TYPE_ICONS: Record<string, LucideIcon> = {
  text: FileText,
  image: Image,
  video: Video,
  audio: Volume2,
};

/** Returns the icon for a given mediaType (defaults to FileText) */
export function getMediaTypeIcon(mediaType: string | undefined): LucideIcon {
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
  const Icon = getMediaTypeIcon(mediaType);

  return (
    <span
      className={`inline-flex items-center text-sm ${className}`}
      role="img"
      aria-label={mediaType ?? 'text'}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
    </span>
  );
}
