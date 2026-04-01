'use client';

import { useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useImageUpload } from '@/hooks/useImageUpload';
import type { ImageAttachment } from '@/types/image-upload';
import { ALLOWED_MIME_TYPES } from '@/types/image-upload';

export interface ImageUploadZoneProps {
  onImageSelected: (image: ImageAttachment) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  locale: string;
}

/**
 * ImageUploadZone — drag-and-drop area + file picker for image uploads.
 *
 * Validates MIME type (JPEG, PNG, GIF, WebP) and file size (≤5 MB)
 * via the useImageUpload hook. Displays i18n error messages on failure.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.8
 */
export function ImageUploadZone({
  onImageSelected,
  onError,
  disabled = false,
  locale: _locale,
}: ImageUploadZoneProps) {
  const t = useTranslations('imageUpload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    attachedImage,
    uploadError,
    isDragging,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileSelect,
  } = useImageUpload();

  // Propagate attached image to parent
  const prevImageRef = useRef<string | null>(null);
  if (attachedImage && attachedImage.base64Data !== prevImageRef.current) {
    prevImageRef.current = attachedImage.base64Data;
    onImageSelected(attachedImage);
  }

  // Propagate errors to parent
  const prevErrorRef = useRef<string | null>(null);
  if (uploadError && uploadError !== prevErrorRef.current) {
    prevErrorRef.current = uploadError;
    const errorMessage =
      uploadError === 'INVALID_FORMAT'
        ? t('invalidFormat')
        : t('fileTooLarge');
    onError(errorMessage);
  }
  if (!uploadError && prevErrorRef.current) {
    prevErrorRef.current = null;
  }

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      handleDrop(e.nativeEvent as DragEvent);
    },
    [disabled, handleDrop],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      handleDragOver(e.nativeEvent as DragEvent);
    },
    [disabled, handleDragOver],
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      handleDragLeave(e.nativeEvent as DragEvent);
    },
    [handleDragLeave],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [handleFileSelect],
  );

  const openFilePicker = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const acceptTypes = ALLOWED_MIME_TYPES.join(',');

  return (
    <div className="relative flex items-center gap-2">
      {/* Drag-and-drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          flex-1 rounded-md border-2 border-dashed px-3 py-2 text-center text-xs transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        `}
        role="region"
        aria-label={t('dropzone')}
      >
        <span className="text-gray-500 dark:text-gray-400">
          {t('dropzone')}
        </span>
      </div>

      {/* File picker button (clip icon) */}
      <button
        type="button"
        onClick={openFilePicker}
        disabled={disabled}
        className="flex-shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        aria-label={t('selectFile')}
      >
        📎
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        onChange={onFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Error message */}
      {uploadError && (
        <p className="absolute -bottom-5 left-0 text-[11px] text-red-500 dark:text-red-400">
          {uploadError === 'INVALID_FORMAT'
            ? t('invalidFormat')
            : t('fileTooLarge')}
        </p>
      )}
    </div>
  );
}
