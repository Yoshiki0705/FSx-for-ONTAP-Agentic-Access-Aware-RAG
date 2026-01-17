import { isValidAwsRegion } from '../bedrock/bedrock-config';
import type { RegionChangeRequest } from '../../types/bedrock-api';

/**
 * API入力値検証ユーティリティ
 */

/**
 * リージョン変更リクエストを検証
 */
export function validateRegionChangeRequest(body: unknown): {
  isValid: boolean;
  data?: RegionChangeRequest;
  error?: string;
} {
  // 基本的な型チェック
  if (!body || typeof body !== 'object') {
    return {
      isValid: false,
      error: 'リクエストボディが無効です',
    };
  }

  const request = body as Record<string, unknown>;

  // newRegionフィールドの存在チェック
  if (!request.newRegion || typeof request.newRegion !== 'string') {
    return {
      isValid: false,
      error: 'newRegionフィールドが必要です',
    };
  }

  const newRegion = request.newRegion.trim();

  // 空文字チェック
  if (!newRegion) {
    return {
      isValid: false,
      error: 'newRegionは空にできません',
    };
  }

  // リージョン形式の検証
  if (!isValidAwsRegion(newRegion)) {
    return {
      isValid: false,
      error: `無効なAWSリージョンです: ${newRegion}`,
    };
  }

  return {
    isValid: true,
    data: { newRegion },
  };
}

/**
 * リクエストのレート制限チェック（将来の拡張用）
 */
export function checkRateLimit(clientId: string): boolean {
  // TODO: 実際のレート制限ロジックを実装
  return true;
}