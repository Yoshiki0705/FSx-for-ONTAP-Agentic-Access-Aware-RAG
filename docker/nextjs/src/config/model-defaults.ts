/**
 * Bedrock モデルID 一元管理
 *
 * モデル廃止対応時はこのファイルのみ変更すればよい。
 * 各ファイルはここからインポートして使用する。
 *
 * @see development/docs/bedrock-model-lifecycle-guide.md
 */

// ─── チャット / セッション デフォルト ───────────────────────
/** 新規チャットセッション作成時のデフォルトモデル */
export const DEFAULT_CHAT_MODEL = 'anthropic.claude-sonnet-4-20250514-v1:0';

/** ユーザー設定（preferences）のデフォルトモデル */
export const DEFAULT_PREFERENCE_MODEL = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

// ─── フォールバック ────────────────────────────────────────
/** API障害時のフォールバックモデル（Amazon Nova Pro） */
export const FALLBACK_MODEL_ID = 'amazon.nova-pro-v1:0';

/** APAC Inference Profile 付きフォールバック */
export const FALLBACK_MODEL_ID_APAC = 'apac.amazon.nova-pro-v1:0';

/** KB Converse API フォールバックチェーン */
export const KB_CONVERSE_FALLBACK_MODELS = [
  'apac.amazon.nova-lite-v1:0',
  'anthropic.claude-3-haiku-20240307-v1:0',
] as const;

// ─── 推奨モデル ────────────────────────────────────────────
/** /api/bedrock/models が返す推奨モデルリスト（ベースID、Inference Profile 解決前） */
export const BASE_RECOMMENDED_MODELS = [
  'amazon.nova-pro-v1:0',
  'anthropic.claude-3-5-sonnet-20241022-v2:0',
  'deepseek.v3-v1:0',
] as const;

/** フロントエンド FALLBACK_MODELS 用の推奨リスト（APAC Inference Profile 付き） */
export const FALLBACK_RECOMMENDED_MODELS = [
  'apac.amazon.nova-pro-v1:0',
  'apac.anthropic.claude-3-5-sonnet-20241022-v2:0',
] as const;

// ─── デフォルトリージョン ──────────────────────────────────
export const DEFAULT_REGION = 'ap-northeast-1';
