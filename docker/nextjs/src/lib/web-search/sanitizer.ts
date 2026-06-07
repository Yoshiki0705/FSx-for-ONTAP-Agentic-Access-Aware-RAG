/**
 * Web Search Query Sanitizer
 *
 * Web検索クエリからPII、内部情報、機密コンテンツを除去し、
 * 安全な検索クエリを構築する。
 *
 * Security controls:
 * - AWS Account IDs除去
 * - メールアドレス除去
 * - SID/UID/GID除去
 * - 内部ドキュメント引用除去
 * - ドメインブロックリストチェック
 *
 * @see .kiro/specs/claude-platform-integration/requirements.md — Requirement 2
 */

/**
 * Web Search設定
 */
export interface WebSearchConfig {
  /** Web検索有効化 */
  enabled: boolean;
  /** ブロックドメインリスト（カンマ区切り） */
  domainBlocklist: string[];
  /** KB検索スコア閾値（これ未満でWeb Search発動） */
  fallbackThreshold: number;
}

/**
 * デフォルトのブロックドメイン
 * 競合他社サイト、内部ドメインなどを除外
 */
const DEFAULT_BLOCKED_DOMAINS = [
  'internal.',
  '.corp.',
  '.local',
  'intranet.',
];

/**
 * Web検索クエリをサニタイズする。
 *
 * 以下のパターンを除去:
 * - AWS Account IDs (12桁数字)
 * - メールアドレス
 * - SID/UID/GID参照
 * - 日本語引用符で囲まれた内部コンテンツ
 * - 英語引用符で囲まれた内部コンテンツ
 * - IPアドレス（プライベート）
 *
 * @param query - ユーザーの元のクエリ
 * @returns サニタイズされたクエリ
 */
export function sanitizeWebSearchQuery(query: string): string {
  let sanitized = query;

  // AWS Account IDs (12桁数字パターン)
  sanitized = sanitized.replace(/\b\d{12}\b/g, '');

  // メールアドレス
  sanitized = sanitized.replace(/\b[\w.+%-]+@[\w.-]+\.\w+\b/g, '');

  // SID/UID/GID参照 (S-1-5-21-xxx or UID:xxx or GID:xxx)
  sanitized = sanitized.replace(/\bS-1-5-21[-\d]+/g, '');
  sanitized = sanitized.replace(/\b(SID|UID|GID)[-:\s]\S+/g, '');

  // 日本語引用符で囲まれたコンテンツ（内部文書の引用）
  sanitized = sanitized.replace(/「[^」]*」/g, '');

  // 英語引用符で囲まれた長いコンテンツ（50文字以上 = 内部文書の引用可能性が高い）
  sanitized = sanitized.replace(/"[^"]{50,}"/g, '');

  // プライベートIPアドレス
  sanitized = sanitized.replace(/\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '');
  sanitized = sanitized.replace(/\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/g, '');
  sanitized = sanitized.replace(/\b192\.168\.\d{1,3}\.\d{1,3}\b/g, '');

  // ファイルパス（内部ストレージパス）
  sanitized = sanitized.replace(/\\\\[\w.-]+\\[\w\\.-]+/g, ''); // UNC path
  sanitized = sanitized.replace(/\/(?:home|mnt|opt|var|data)\/[\w/.-]+/g, ''); // Unix path

  // 連続空白を正規化
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * ドメインがブロックリストに含まれるか確認する。
 *
 * @param url - チェック対象URL
 * @param blocklist - ブロックドメインリスト
 * @returns ブロックされる場合 true
 */
export function isDomainBlocked(url: string, blocklist?: string[]): boolean {
  const domains = blocklist ?? DEFAULT_BLOCKED_DOMAINS;

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return domains.some((blocked) => hostname.includes(blocked.toLowerCase()));
  } catch {
    // Invalid URL — block it to be safe
    return true;
  }
}

/**
 * KB検索結果のスコアがWeb Searchフォールバック閾値未満か判定する。
 *
 * @param scores - KB検索結果のスコア配列
 * @param threshold - フォールバック閾値（デフォルト: 0.3）
 * @returns Web Searchにフォールバックすべき場合 true
 */
export function shouldFallbackToWebSearch(
  scores: number[],
  threshold: number = 0.3,
): boolean {
  // 結果なし → フォールバック
  if (scores.length === 0) return true;

  // 全スコアが閾値未満 → フォールバック
  const maxScore = Math.max(...scores);
  return maxScore < threshold;
}

/**
 * Web Search設定を環境変数から構築する。
 */
export function buildWebSearchConfig(): WebSearchConfig {
  const enabled = process.env.ENABLE_WEB_SEARCH === 'true';
  const blocklistRaw = process.env.WEB_SEARCH_DOMAIN_BLOCKLIST || '';
  const domainBlocklist = blocklistRaw
    ? blocklistRaw.split(',').map((d) => d.trim()).filter(Boolean)
    : DEFAULT_BLOCKED_DOMAINS;
  const fallbackThreshold = parseFloat(process.env.WEB_SEARCH_FALLBACK_THRESHOLD || '0.3');

  return { enabled, domainBlocklist, fallbackThreshold };
}
