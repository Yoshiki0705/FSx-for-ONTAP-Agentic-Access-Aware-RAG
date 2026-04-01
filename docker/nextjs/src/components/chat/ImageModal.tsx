'use client';

export interface ImageModalProps {
  base64Data: string;
  mimeType: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * ImageModal — displays a full-size image in a modal overlay.
 *
 * Provides a close button (×) and backdrop click to dismiss.
 *
 * Requirements: 4.3
 */
export function ImageModal({ base64Data, mimeType, isOpen, onClose }: ImageModalProps) {
  if (!isOpen) return null;

  const src = `data:${mimeType};base64,${base64Data}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-lg text-white hover:bg-gray-600"
        aria-label="Close"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Full size image"
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
