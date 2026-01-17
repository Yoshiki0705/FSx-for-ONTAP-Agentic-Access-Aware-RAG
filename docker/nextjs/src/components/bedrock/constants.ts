/**
 * ModelSelector関連の定数定義
 */

// 表示制限設定
export const MODEL_DISPLAY_LIMITS = {
  DEFAULT_VISIBLE: 5,
  MAX_VISIBLE: 20,
  SEARCH_THRESHOLD: 3,
  UNAVAILABLE_MODELS_PREVIEW: 3,
  UNAVAILABLE_MODELS_FULL: 10,
  RECOMMENDED_MODELS: 3,
} as const;

// プロバイダー一覧
export const PROVIDERS = [
  { value: 'all', label: '全てのプロバイダー' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'meta', label: 'Meta' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'ai21', label: 'AI21' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'stability', label: 'Stability AI' },
] as const;

// 推奨モデルID
export const RECOMMENDED_MODEL_IDS = [
  'apac.amazon.nova-pro-v1:0',
  'apac.amazon.nova-lite-v1:0',
  'apac.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'apac.anthropic.claude-3-sonnet-20240229-v1:0',
] as const;

// UI表示用のクラス名
export const UI_CLASSES = {
  container: 'space-y-2',
  header: 'flex items-center justify-between',
  searchInput: 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  filterSelect: 'px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
  modelButton: 'w-full text-left p-3 border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
  modelButtonSelected: 'w-full text-left p-3 border-2 border-blue-500 bg-blue-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
  modelButtonDisabled: 'w-full text-left p-3 border border-gray-200 rounded-md bg-gray-50 cursor-not-allowed opacity-60',
  badge: 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
  badgeRecommended: 'bg-green-100 text-green-800',
  badgeAvailable: 'bg-blue-100 text-blue-800',
  badgeUnavailable: 'bg-red-100 text-red-800',
} as const;

// アニメーション設定
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;

// デバッグ設定
export const DEBUG_CONFIG = {
  ENABLE_CONSOLE_LOGS: process.env.NODE_ENV === 'development',
  LOG_PREFIX: '🔍 ModelSelector:',
} as const;