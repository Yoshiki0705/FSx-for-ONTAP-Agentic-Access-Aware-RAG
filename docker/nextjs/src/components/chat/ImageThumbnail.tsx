'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface ImageThumbnailProps {
  base64Data: string;
  mimeType: string;
  onClick: () => void;
}

/**
 * ImageThumbnail — displays an image thumbnail inside a user message bubble.
 *
 * Shows a skeleton loader while the image is loading, then renders the image
 * constrained to max 200×200px. Clicking the image triggers the onClick
 * callback for modal expansion.
 *
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */
export function ImageThumbnail({ base64Data, mimeType, onClick }: ImageThumbnailProps) {
  const t = useTranslations('imageUpload');
  const [isLoading, setIsLoading] = useState(true);

  const src = `data:${mimeType};base64,${base64Data}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="block cursor-pointer rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label={t('uploadedImage')}
    >
      {/* Skeleton loader */}
      {isLoading && (
        <div className="h-[120px] w-[120px] animate-pulse rounded-md bg-gray-200 dark:bg-gray-600" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={t('uploadedImage')}
        onLoad={() => setIsLoading(false)}
        className={`max-h-[200px] max-w-[200px] rounded-md object-contain ${isLoading ? 'hidden' : 'block'}`}
      />
    </button>
  );
}
