/**
 * Image Upload 型定義 - Advanced RAG Features
 *
 * 画像アップロード機能で使用する型、バリデーション定数を定義。
 * Bedrock Vision API（Claude 3 / Nova）との連携に必要な
 * MIMEタイプ制約とファイルサイズ制限を含む。
 *
 * @version 1.0.0
 */

// 許可されるMIMEタイプ
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// ファイルサイズ上限: 3MB
// Lambda Function URLの同期呼び出しペイロード上限（6MB）を考慮。
// Base64エンコードで約33%増加するため、3MB画像 → ~4MB Base64 + JSONオーバーヘッド ≈ 4.5MB。
export const MAX_FILE_SIZE = 3 * 1024 * 1024;

/**
 * 添付画像データ
 *
 * Chat_Input から Vision API へ渡される画像情報を表す。
 * base64Data は FileReader.readAsDataURL() で取得した
 * データ部分（data:... プレフィックスを除く）を格納する。
 */
export interface ImageAttachment {
  /** Base64エンコード済み画像データ */
  base64Data: string;
  /** 画像のMIMEタイプ */
  mimeType: AllowedMimeType;
  /** 元のファイル名 */
  fileName: string;
  /** ファイルサイズ（バイト） */
  fileSizeBytes: number;
  /** プレビュー用URL（URL.createObjectURL() で生成） */
  previewUrl: string;
}

/**
 * 画像アップロードエラー
 */
export type ImageUploadError = 'INVALID_FORMAT' | 'FILE_TOO_LARGE';
