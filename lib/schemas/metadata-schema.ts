/**
 * .metadata.json — 正式スキーマ定義
 *
 * FSx for ONTAP 上のドキュメントに付与する Permission メタデータの
 * 公式フォーマット定義。Bedrock KB の metadata filtering に使用される。
 *
 * ## 正式仕様
 *
 * `allowed_group_sids` は **配列形式** を正式仕様とする。
 * カンマ区切り文字列は後方互換として許容するが、新規作成時は配列を使用すること。
 *
 * ## ファイル配置ルール
 *
 * メタデータファイルは対象ドキュメントと同じパスに `.metadata.json` サフィックスで配置:
 *   - ドキュメント: `reports/esg/2026-06-06/report-id.json`
 *   - メタデータ: `reports/esg/2026-06-06/report-id.json.metadata.json`
 *
 * ## Bedrock KB 統合
 *
 * Bedrock KB は `.metadata.json` ファイルを自動検出し、
 * `metadataAttributes` 内のフィールドを検索時のフィルタリングに使用する。
 *
 * @see docs/design/2026q2-ai-update-roadmap.md
 * @see tests/permission-matrix/
 */

/**
 * .metadata.json ファイルの正式スキーマ
 */
export interface DocumentMetadata {
  metadataAttributes: MetadataAttributes;
}

/**
 * メタデータ属性
 */
export interface MetadataAttributes {
  /**
   * アクセス許可SIDリスト
   *
   * 正式形式: 文字列配列
   *   例: ["S-1-1-0", "S-1-5-21-xxx-512"]
   *
   * 後方互換形式: カンマ区切り文字列
   *   例: "S-1-1-0,S-1-5-21-xxx-512"
   *
   * このフィールドが未設定または空の場合、Fail-Closed原則により
   * ドキュメントは全ユーザーからアクセス不可となる。
   */
  allowed_group_sids: string[] | string;

  /**
   * ドキュメントカテゴリ（オプション）
   * 例: "esg", "financial", "policy", "manual"
   */
  category?: string;

  /**
   * ドキュメント所有者（オプション）
   * 例: "engineering-team", "hr-department"
   */
  owner?: string;

  /**
   * 機密レベル（オプション）
   * 例: "public", "internal", "confidential", "restricted"
   */
  classification?: 'public' | 'internal' | 'confidential' | 'restricted';
}

// ─── Validation ─────────────────────────────────────────────

/** SID 形式パターン (S-1-5-21-xxx or S-1-1-0 etc.) */
const SID_PATTERN = /^S-\d+-\d+(-\d+)*$/;

/**
 * SID 文字列のフォーマット検証
 */
export function isValidSID(sid: string): boolean {
  return SID_PATTERN.test(sid.trim());
}

/**
 * allowed_group_sids を正規化された配列に変換する。
 *
 * 対応形式:
 * 1. 配列: ["S-1-1-0", "S-1-5-21-xxx-512"] → そのまま
 * 2. カンマ区切り: "S-1-1-0,S-1-5-21-xxx-512" → 分割
 * 3. JSON文字列: '["S-1-1-0"]' → パース
 * 4. 単一SID: "S-1-1-0" → [value]
 */
export function normalizeAllowedSIDs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(s => String(s).trim()).filter(s => s.length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    // Try JSON array parse
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(s => String(s).trim()).filter(s => s.length > 0);
        }
      } catch {
        // Fall through to other formats
      }
    }

    // Comma-separated
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    // Single value
    return [trimmed];
  }

  return [];
}

/**
 * メタデータのバリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedSIDs: string[];
}

/**
 * .metadata.json の内容を検証する。
 *
 * @param content - パースされたJSONオブジェクト
 * @returns バリデーション結果
 */
export function validateMetadata(content: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || typeof content !== 'object') {
    return { valid: false, errors: ['Content must be a JSON object'], warnings: [], normalizedSIDs: [] };
  }

  const obj = content as Record<string, unknown>;

  // Check top-level structure
  const attributes = obj.metadataAttributes as Record<string, unknown> | undefined;
  if (!attributes) {
    return { valid: false, errors: ['Missing required field: metadataAttributes'], warnings: [], normalizedSIDs: [] };
  }

  // Validate allowed_group_sids
  const rawSIDs = attributes.allowed_group_sids;
  if (rawSIDs === undefined || rawSIDs === null) {
    errors.push('Missing required field: metadataAttributes.allowed_group_sids');
    return { valid: false, errors, warnings, normalizedSIDs: [] };
  }

  // Normalize and validate SIDs
  const normalizedSIDs = normalizeAllowedSIDs(rawSIDs);

  if (normalizedSIDs.length === 0) {
    errors.push('allowed_group_sids must contain at least one SID (Fail-Closed: empty SIDs means no access)');
  }

  // Validate each SID format
  for (const sid of normalizedSIDs) {
    if (!isValidSID(sid)) {
      warnings.push(`Invalid SID format: "${sid}" (expected pattern: S-X-X-X-...-X)`);
    }
  }

  // Check if comma-separated string was used (warn about preferred format)
  if (typeof rawSIDs === 'string' && rawSIDs.includes(',')) {
    warnings.push('allowed_group_sids uses comma-separated format. Preferred format is JSON array: ["S-1-1-0", "S-1-5-21-xxx-512"]');
  }

  // Validate optional fields
  if (attributes.classification) {
    const validClassifications = ['public', 'internal', 'confidential', 'restricted'];
    if (!validClassifications.includes(attributes.classification as string)) {
      warnings.push(`Invalid classification: "${attributes.classification}". Valid values: ${validClassifications.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedSIDs,
  };
}

/**
 * 正式形式の .metadata.json を生成する。
 *
 * @param sids - SID配列
 * @param options - 追加メタデータオプション
 * @returns 正式形式のメタデータオブジェクト
 */
export function createMetadata(
  sids: string[],
  options?: { category?: string; owner?: string; classification?: MetadataAttributes['classification'] },
): DocumentMetadata {
  return {
    metadataAttributes: {
      allowed_group_sids: sids, // 配列形式（正式仕様）
      ...(options?.category ? { category: options.category } : {}),
      ...(options?.owner ? { owner: options.owner } : {}),
      ...(options?.classification ? { classification: options.classification } : {}),
    },
  };
}
