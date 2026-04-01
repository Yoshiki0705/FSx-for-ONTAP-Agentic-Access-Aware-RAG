'use client';

import type { ImageAttachment } from '@/types/image-upload';

export interface ImagePreviewProps {
  image: ImageAttachment;
  onRemove: () => void;
}

/**
 * ImagePreview — displays an attached image preview above the input area
 * with a "×" remove button in the top-right corner.
 *
 * Requirements: 1.4, 1.9, 1.10
 */
export function ImagePreview({ image, onRemove }: ImagePreviewProps) {
  return (
    <div className="relative inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.previewUrl}
        alt={image.fileName}
        className="h-20 w-20 rounded-md border border-gray-200 object-cover dark:border-gray-600"
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-xs text-white hover:bg-red-600 dark:bg-gray-500 dark:hover:bg-red-500"
        aria-label="Remove image"
      >
        ×
      </button>
    </div>
  );
}
