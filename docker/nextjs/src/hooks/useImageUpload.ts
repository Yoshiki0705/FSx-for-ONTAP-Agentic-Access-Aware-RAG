/**
 * 画像アップロード カスタムフック
 *
 * ドラッグ＆ドロップ / ファイルピッカーによる画像アップロードの
 * バリデーション、Base64変換、状態管理を提供する。
 *
 * @version 1.0.0
 */

import { useCallback, useState } from 'react';
import type { ImageAttachment, ImageUploadError, AllowedMimeType } from '@/types/image-upload';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/types/image-upload';

/**
 * useImageUpload フックの戻り値型
 */
export interface UseImageUploadReturn {
  attachedImage: ImageAttachment | null;
  uploadError: string | null;
  isDragging: boolean;
  handleDrop: (e: DragEvent) => void;
  handleDragOver: (e: DragEvent) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleFileSelect: (file: File) => void;
  removeImage: () => void;
}

/**
 * ファイルバリデーション（純粋関数）
 *
 * MIMEタイプとファイルサイズを検証し、エラーがあれば返す。
 * テスト容易性のため named export として公開。
 */
export function validateImageFile(file: File): ImageUploadError | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    return 'INVALID_FORMAT';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'FILE_TOO_LARGE';
  }
  return null;
}

/**
 * 画像アップロード カスタムフック
 */
export function useImageUpload(): UseImageUploadReturn {
  const [attachedImage, setAttachedImage] = useState<ImageAttachment | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    // バリデーション
    const error = validateImageFile(file);
    if (error) {
      setUploadError(error);
      setAttachedImage(null);
      return;
    }

    // エラーをクリア
    setUploadError(null);

    // プレビューURL生成
    const previewUrl = URL.createObjectURL(file);

    // Base64変換
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:image/png;base64,XXXX... からBase64部分を抽出
      const base64Data = result.split(',')[1] || '';

      setAttachedImage({
        base64Data,
        mimeType: file.type as AllowedMimeType,
        fileName: file.name,
        fileSizeBytes: file.size,
        previewUrl,
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer?.files[0];
    if (file) {
      // handleFileSelect のロジックをインラインで実行（useCallback 安定参照のため）
      const error = validateImageFile(file);
      if (error) {
        setUploadError(error);
        setAttachedImage(null);
        return;
      }

      setUploadError(null);
      const previewUrl = URL.createObjectURL(file);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1] || '';
        setAttachedImage({
          base64Data,
          mimeType: file.type as AllowedMimeType,
          fileName: file.name,
          fileSizeBytes: file.size,
          previewUrl,
        });
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    setIsDragging(false);
  }, []);

  const removeImage = useCallback(() => {
    setAttachedImage((prev) => {
      if (prev?.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
    setUploadError(null);
  }, []);

  return {
    attachedImage,
    uploadError,
    isDragging,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileSelect,
    removeImage,
  };
}
