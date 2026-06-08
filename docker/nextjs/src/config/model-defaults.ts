/**
 * Bedrock モデルID 一元管理
 *
 * モデル廃止対応時はこのファイルのみ変更すればよい。
 * 各ファイルはここからインポートして使用する。
 *
 * 2026 Q2 Model Lifecycle Update:
 *   - Heavy: Claude Opus 4.8 (2026-05)
 *   - Powerful: Claude Sonnet 4.6 (2026-02)
 *   - Lightweight / Fallback: Nova 2 Lite (2025-12 GA)
 *   - GPT-5.5: ap-northeast-1 未提供。Cross-Region Inference (us-east-1) 経由のみ。
 *
 * @see docs/design/2026q2-ai-update-roadmap.md
 * @see development/docs/bedrock-model-lifecycle-guide.md
 */

// ─── チャット / セッション デフォルト ───────────────────────
/** 新規チャットセッション作成時のデフォルトモデル */
export const DEFAULT_CHAT_MODEL = 'anthropic.claude-sonnet-4-6';

/** ユーザー設定（preferences）のデフォルトモデル */
export const DEFAULT_PREFERENCE_MODEL = 'anthropic.claude-sonnet-4-6';

// ─── フォールバック ────────────────────────────────────────
/** API障害時のフォールバックモデル（Nova 2 Lite） */
export const FALLBACK_MODEL_ID = 'amazon.nova-2-lite-v1:0';

/** JP Inference Profile 付きフォールバック */
export const FALLBACK_MODEL_ID_JP = 'jp.amazon.nova-2-lite-v1:0';

/** @deprecated APAC profile は JP profile に統合。互換性のため残存。 */
export const FALLBACK_MODEL_ID_APAC = 'jp.amazon.nova-2-lite-v1:0';

/** KB Converse API フォールバックチェーン
 *
 * NOTE: このフォールバックパスで使用されるモデル（Nova 2 Lite等）は
 * Permission filtering 判定能力が未検証だが、問題にならない。
 * 理由: Permission filtering は KB Retrieve API レベルで実施済み
 * （SIDマッチング → フィルタ済みチャンクのみが Converse に渡る）。
 * Converse API に到達するコンテキストは既に Permission-verified。
 */
export const KB_CONVERSE_FALLBACK_MODELS = [
  'jp.amazon.nova-2-lite-v1:0',
  'anthropic.claude-haiku-4-5-20251001-v1:0',
] as const;

// ─── 推奨モデル ────────────────────────────────────────────
/** /api/bedrock/models が返す推奨モデルリスト（ベースID、Inference Profile 解決前） */
export const BASE_RECOMMENDED_MODELS = [
  'amazon.nova-2-lite-v1:0',
  'anthropic.claude-sonnet-4-6',
  'anthropic.claude-opus-4-8',
] as const;

/** フロントエンド FALLBACK_MODELS 用の推奨リスト（JP Inference Profile 付き） */
export const FALLBACK_RECOMMENDED_MODELS = [
  'jp.amazon.nova-2-lite-v1:0',
  'jp.anthropic.claude-sonnet-4-6',
] as const;

// ─── デフォルトリージョン ──────────────────────────────────
export const DEFAULT_REGION = 'ap-northeast-1';

// ─── On-Demand ブロックモデル ──────────────────────────────
/**
 * On-Demand スループットが利用できないモデル（Cross-Region Inference Profile が必要）。
 * Converse API 呼び出し時にこれらのモデルIDが来た場合、フォールバックモデルに切り替える。
 */
export const ON_DEMAND_BLOCKED_MODELS = new Set([
  'amazon.nova-pro-v1:0',
  'amazon.nova-micro-v1:0',
  'nvidia.nemotron-super-3-120b',
]);

// ─── Inference Profile 解決マップ ─────────────────────────
/**
 * ベースモデルID → リージョナル Inference Profile ID のマッピング。
 * ap-northeast-1 では多くの Anthropic Claude モデルが on-demand 呼び出し不可。
 * Inference Profile (jp.* / apac.*) 経由での呼び出しが必須。
 *
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles.html
 */
export const INFERENCE_PROFILE_MAP: Record<string, string> = {
  // Claude Sonnet 4.6
  'anthropic.claude-sonnet-4-6': 'jp.anthropic.claude-sonnet-4-6',
  // Claude Opus 4.8
  'anthropic.claude-opus-4-8': 'jp.anthropic.claude-opus-4-8',
  // Claude Sonnet 4.5
  'anthropic.claude-sonnet-4-5-20250929-v1:0': 'jp.anthropic.claude-sonnet-4-5-20250929-v1:0',
  // Claude Opus 4.5
  'anthropic.claude-opus-4-5-20250929-v1:0': 'jp.anthropic.claude-opus-4-5-20250929-v1:0',
  // Claude Sonnet 4 (base)
  'anthropic.claude-sonnet-4-20250514-v1:0': 'apac.anthropic.claude-sonnet-4-20250514-v1:0',
  // Claude Opus 4 (base)
  'anthropic.claude-opus-4-0-20250514-v1:0': 'apac.anthropic.claude-opus-4-0-20250514-v1:0',
  // Claude Haiku 4.5
  'anthropic.claude-haiku-4-5-20251001-v1:0': 'apac.anthropic.claude-haiku-4-5-20251001-v1:0',
  // Nova 2 Lite
  'amazon.nova-2-lite-v1:0': 'jp.amazon.nova-2-lite-v1:0',
};

// ─── Deprecated Model 互換マッピング ──────────────────────
/**
 * 旧モデルID → 新モデルIDのマッピング。
 * 外部連携やユーザー設定で旧IDが使われた場合に透過的にリダイレクトする。
 */
export const DEPRECATED_MODEL_MAP: Record<string, string> = {
  // Opus 4.0 → Opus 4.8
  'anthropic.claude-opus-4-0-20250514-v1:0': 'anthropic.claude-opus-4-8',
  // Sonnet 3.5 v2 → Sonnet 4.6
  'anthropic.claude-3-5-sonnet-20241022-v2:0': 'anthropic.claude-sonnet-4-6',
  // Sonnet 4 → Sonnet 4.6
  'anthropic.claude-sonnet-4-20250514-v1:0': 'anthropic.claude-sonnet-4-6',
  // Nova Pro v1 → Nova 2 Lite
  'amazon.nova-pro-v1:0': 'amazon.nova-2-lite-v1:0',
  // Old APAC profiles
  'apac.amazon.nova-pro-v1:0': 'jp.amazon.nova-2-lite-v1:0',
  'apac.anthropic.claude-3-5-sonnet-20241022-v2:0': 'jp.anthropic.claude-sonnet-4-6',
  'apac.amazon.nova-lite-v1:0': 'jp.amazon.nova-2-lite-v1:0',
};

/**
 * リクエストされたモデルIDを解決する。
 * Deprecatedモデルの場合は新モデルにリダイレクトし、警告を出力する。
 */
export function resolveModelId(requestedId: string): {
  modelId: string;
  isDeprecated: boolean;
  originalId?: string;
} {
  const replacement = DEPRECATED_MODEL_MAP[requestedId];
  if (replacement) {
    console.warn(
      `[ModelLifecycle] Deprecated model "${requestedId}" → "${replacement}". ` +
      'Update your configuration to use the new model ID.'
    );
    return { modelId: replacement, isDeprecated: true, originalId: requestedId };
  }
  return { modelId: requestedId, isDeprecated: false };
}
