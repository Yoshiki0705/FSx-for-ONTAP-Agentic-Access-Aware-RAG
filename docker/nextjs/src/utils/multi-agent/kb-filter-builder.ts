/**
 * KB Metadata Filter Builder
 *
 * FilteredContext（SID/UID/GID/OIDCグループ）からBedrock KB Retrieve API用の
 * メタデータフィルタを構築し、検索結果から生の権限メタデータをサニタイズする。
 *
 * Validates: Requirements 3.3, 5.4
 */

import type { FilteredContext } from './permission-resolver';

// ===== KB Metadata Filter Types (Bedrock KB Retrieve API format) =====

/**
 * KB メタデータフィルタ構造。
 * Bedrock KB Retrieve API の RetrievalFilter 形式に準拠。
 */
export interface KbMetadataFilter {
  andAll?: KbFilterCondition[];
  orAll?: KbFilterCondition[];
}

export interface KbFilterCondition {
  equals?: { key: string; value: string };
  listContains?: { key: string; value: string };
  in?: { key: string; value: string[] };
}

// ===== Search Result Types =====

export interface SearchResult {
  content: string;
  source: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface SanitizedSearchResult {
  content: string;
  source: string;
  score: number;
}

// ===== Regex patterns for permission metadata detection =====

/**
 * Windows SID パターン: S-1-5-21-... 形式
 */
const SID_PATTERN = /S-1-\d+-\d+(-\d+)*/g;

/**
 * UNIX UID/GID パターン: uid=1001, gid=1001, uidNumber: 1001 等
 */
const UID_GID_PATTERN = /\b(uid|gid|uidNumber|gidNumber)\s*[:=]\s*\d+/gi;

/**
 * NTFS ACL エントリパターン: ACL, ACE, DACL, SACL 等
 */
const NTFS_ACL_PATTERN = /\b(DACL|SACL|ACE|ACL)\s*[:=]\s*\S+/gi;

/**
 * SID 参照パターン: sid=..., objectSid: ... 等
 */
const SID_REF_PATTERN = /\b(sid|objectSid|groupSid|securityIdentifier)\s*[:=]\s*\S+/gi;

// ===== Filter Builder =====

/**
 * FilteredContext から KB メタデータフィルタを構築する。
 *
 * 1. accessDenied=true → null を返却（検索を実行しない）
 * 2. SID / groupSID から OR 条件を構築
 * 3. UID/GID が存在する場合は条件を追加
 * 4. OIDC グループ（unixGroups）が存在する場合は条件を追加
 * 5. 全条件が空の場合は null を返却
 *
 * @param context - Permission Resolver から受け取った FilteredContext
 * @returns KB メタデータフィルタ、またはフィルタ不要/アクセス拒否時は null
 */
export function buildKbMetadataFilter(
  context: FilteredContext,
): KbMetadataFilter | null {
  // accessDenied=true → 検索を実行しない
  if (context.accessDenied) {
    return null;
  }

  const orConditions: KbFilterCondition[] = [];

  // SID 条件: 各 SID に対して listContains 条件を生成
  for (const sid of context.sids) {
    if (sid.trim() !== '') {
      orConditions.push({
        listContains: { key: 'allowedSids', value: sid },
      });
    }
  }

  // グループ SID 条件
  for (const groupSid of context.groupSids) {
    if (groupSid.trim() !== '') {
      orConditions.push({
        listContains: { key: 'allowedGroupSids', value: groupSid },
      });
    }
  }

  // UID 条件
  if (context.uid && context.uid.trim() !== '') {
    orConditions.push({
      equals: { key: 'allowedUid', value: context.uid },
    });
  }

  // GID 条件
  if (context.gid && context.gid.trim() !== '') {
    orConditions.push({
      equals: { key: 'allowedGid', value: context.gid },
    });
  }

  // OIDC グループ / UNIX グループ条件
  for (const group of context.unixGroups) {
    if (group.trim() !== '') {
      orConditions.push({
        listContains: { key: 'allowedGroups', value: group },
      });
    }
  }

  // 全条件が空の場合は null
  if (orConditions.length === 0) {
    return null;
  }

  return { orAll: orConditions };
}

// ===== Search Result Sanitization =====

/**
 * 検索結果から生の権限メタデータをサニタイズする。
 *
 * 1. metadata フィールドを完全に除去
 * 2. content 文字列から SID/UID/GID パターンを正規表現で除去
 * 3. content, source, score のみを含むクリーンな結果を返却
 *
 * @param results - KB 検索結果の配列
 * @returns サニタイズ済み検索結果の配列
 */
export function sanitizeSearchResults(
  results: SearchResult[],
): SanitizedSearchResult[] {
  return results.map((result) => ({
    content: sanitizeContent(result.content),
    source: result.source,
    score: result.score,
  }));
}

/**
 * コンテンツ文字列から生の権限メタデータパターンを除去する。
 */
function sanitizeContent(content: string): string {
  return content
    .replace(SID_PATTERN, '')
    .replace(UID_GID_PATTERN, '')
    .replace(NTFS_ACL_PATTERN, '')
    .replace(SID_REF_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
