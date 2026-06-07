/**
 * Document Name Resolver — S3 URIから人間が読める表示名を生成
 *
 * S3キー形式（UUID付きJSON等）をユーザーフレンドリーな表示名に変換する。
 *
 * 変換ルール:
 * 1. パスからカテゴリ/サブカテゴリを抽出（reports/esg → "ESGレポート"）
 * 2. UUID部分を除去
 * 3. 拡張子を非表示
 * 4. 日付情報を保持
 * 5. フォールバック: 変換不能な場合はファイル名そのまま
 *
 * @see tests/rag-evaluation/results/deploy-verification-20260608.json — Finding UX-001
 */

/**
 * Known category mappings for FSx ONTAP document paths
 */
const CATEGORY_LABELS: Record<string, { ja: string; en: string }> = {
  'reports/esg': { ja: 'ESGレポート', en: 'ESG Report' },
  'reports/grants': { ja: '助成金レポート', en: 'Grants Report' },
  'reports/transportation': { ja: '交通レポート', en: 'Transportation Report' },
  'reports/utilities': { ja: 'ユーティリティレポート', en: 'Utilities Report' },
  'reports/financial': { ja: '財務レポート', en: 'Financial Report' },
  'uploads': { ja: 'アップロード文書', en: 'Uploaded Document' },
  'policies': { ja: '社内規程', en: 'Internal Policy' },
  'manuals': { ja: 'マニュアル', en: 'Manual' },
  'contracts': { ja: '契約書', en: 'Contract' },
};

/** UUID pattern (8-4-4-4-12 hex) */
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Date pattern in path (YYYY-MM-DD or YYYY/MM/DD) */
const DATE_PATTERN = /(\d{4})[/-](\d{2})[/-](\d{2})/;

/**
 * Resolve a human-readable document name from an S3 URI or key.
 *
 * @param s3UriOrKey - Full S3 URI or just the object key
 * @param locale - Display locale ('ja' or 'en'), defaults to 'ja'
 * @returns Human-readable display name
 *
 * Examples:
 *   "reports/esg/2026-06-06/5578ceee-ac4d-4bb7-a431-d82afed79f04.json"
 *   → "ESGレポート (2026-06-06)"
 *
 *   "uploads/demo-user/quarterly-report.pdf"
 *   → "quarterly-report.pdf"
 *
 *   "policies/security/access-control-policy.md"
 *   → "access-control-policy.md"
 */
export function resolveDocumentName(s3UriOrKey: string, locale: 'ja' | 'en' = 'ja'): string {
  // Strip S3 URI prefix if present
  let key = s3UriOrKey;
  if (key.includes('s3://')) {
    const parts = key.replace('s3://', '').split('/');
    key = parts.slice(1).join('/'); // Remove bucket name
  }

  // Try category-based resolution
  for (const [prefix, labels] of Object.entries(CATEGORY_LABELS)) {
    if (key.startsWith(prefix)) {
      const label = locale === 'ja' ? labels.ja : labels.en;

      // Extract date if present
      const dateMatch = key.match(DATE_PATTERN);
      const dateStr = dateMatch ? ` (${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]})` : '';

      // Check if filename is UUID-based
      const filename = key.split('/').pop() || '';
      if (UUID_PATTERN.test(filename)) {
        return `${label}${dateStr}`;
      }

      // Non-UUID filename — use it
      const cleanName = filename.replace(/\.[^.]+$/, ''); // Remove extension
      return cleanName || `${label}${dateStr}`;
    }
  }

  // Fallback: use the filename part, strip UUID if present
  const filename = key.split('/').pop() || key;
  if (UUID_PATTERN.test(filename)) {
    // UUID-only filename — use parent directory as context
    const parts = key.split('/');
    if (parts.length >= 2) {
      const parent = parts[parts.length - 2];
      const dateMatch = key.match(DATE_PATTERN);
      const dateStr = dateMatch ? ` (${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]})` : '';
      return `${parent}${dateStr}`;
    }
  }

  return filename;
}

/**
 * Resolve display name with original path tooltip.
 * Returns both display name and full path for UI rendering.
 */
export function resolveDocumentDisplay(s3UriOrKey: string, locale: 'ja' | 'en' = 'ja'): {
  displayName: string;
  fullPath: string;
} {
  return {
    displayName: resolveDocumentName(s3UriOrKey, locale),
    fullPath: s3UriOrKey,
  };
}
