/**
 * Permission Boundary Classification — プロジェクト横断型定義
 *
 * 全データソースの Permission 保証レベルを分類し、
 * UI・ログ・監査で一貫して使用する。
 *
 * @see docs/design/2026q2-ai-update-roadmap.md
 * @see .kiro/specs/claude-platform-integration/requirements.md — Requirement 6
 */

/**
 * Permission Boundary Type
 *
 * | Type       | Source                | Permission保証                          | Trust |
 * |------------|----------------------|----------------------------------------|-------|
 * | verified   | KB (FSx ONTAP)       | SID matched, Fail-closed applied       | HIGH  |
 * | reference  | Web Search           | NOT APPLICABLE (public data)           | LOW   |
 * | expanded   | Graph RAG expansion  | Real-time SID check (may be stale)     | MED   |
 * | memory     | Agent Memory         | SID scope tagged per entry             | MED   |
 */
export type PermissionBoundaryType = 'verified' | 'reference' | 'expanded' | 'memory';

/**
 * Citation — ソース帰属情報
 */
export interface Citation {
  /** Citation index ([1], [2], ...) */
  index: number;
  /** Source type */
  sourceType: 'kb' | 'web';
  /** Permission boundary classification */
  boundaryType: PermissionBoundaryType;
  /** Source document name or web page title */
  sourceName: string;
  /** S3 path (KB) or URL (Web) */
  sourcePath?: string;
  /** Quoted excerpt (max 200 chars) */
  excerpt: string;
  /** Relevance score (0.0-1.0) */
  relevanceScore: number;
  /** Whether permission was verified for this source */
  permissionVerified: boolean;
}

/**
 * RAG Response with Citations
 */
export interface CitedResponse {
  /** Response text with inline citation markers [1], [2] */
  text: string;
  /** Citation details */
  citations: Citation[];
  /** Summary of boundary types used in this response */
  boundaryTypes: PermissionBoundaryType[];
  /** Model ID used for generation */
  modelId: string;
}

/**
 * UI表示用のBoundary Type metadata
 */
export const BOUNDARY_TYPE_DISPLAY: Record<PermissionBoundaryType, {
  label: { ja: string; en: string };
  icon: string;
  color: string;
  description: { ja: string; en: string };
}> = {
  verified: {
    label: { ja: '社内文書', en: 'Internal Document' },
    icon: '🔒',
    color: 'green',
    description: {
      ja: 'SIDマッチング済み。Permission-verified。',
      en: 'SID matched. Permission-verified.',
    },
  },
  reference: {
    label: { ja: '参考情報（外部）', en: 'Reference (External)' },
    icon: '🌐',
    color: 'blue',
    description: {
      ja: '外部Web検索結果。Permission制御対象外。',
      en: 'External web search result. Not subject to permission control.',
    },
  },
  expanded: {
    label: { ja: '関連ドキュメント', en: 'Related Document' },
    icon: '🔗',
    color: 'orange',
    description: {
      ja: 'Graph展開による関連文書。リアルタイムSIDチェック済み。',
      en: 'Related document via graph expansion. Real-time SID checked.',
    },
  },
  memory: {
    label: { ja: '記憶コンテキスト', en: 'Memory Context' },
    icon: '🧠',
    color: 'purple',
    description: {
      ja: 'Agent Memoryからのコンテキスト。SIDスコープタグ付き。',
      en: 'Context from Agent Memory. SID scope tagged.',
    },
  },
};
