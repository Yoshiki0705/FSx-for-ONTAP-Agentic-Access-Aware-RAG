// 動的Bedrockモデル設定（自動検出対応版）

/**
 * リクエスト形式の種類
 * - anthropic: Anthropic Messages API形式
 * - amazon: Amazon InferenceConfig形式
 * - prompt-based: シンプルなプロンプトベース形式
 */
export type RequestFormat = 'anthropic' | 'amazon' | 'prompt-based';

/**
 * レスポンス形式の種類
 * 各プロバイダーのレスポンスからテキストを抽出するフィールドパス
 */
export type ResponseFormat = 
  | 'content[0].text'              // Anthropic
  | 'output.message.content[0].text' // Amazon
  | 'generation'                   // Meta Llama
  | 'text'                         // Cohere, Mistral (直接)
  | 'generations[0].text'          // Cohere (配列)
  | 'completions[0].data.text'     // AI21
  | 'outputs[0].text'              // Mistral (配列)
  | 'choices[0].message.content';  // OpenAI, DeepSeek, Qwen

/**
 * パラメータマッピング
 * 各プロバイダーの異なるパラメータ名を統一的に扱うためのマッピング
 */
export interface ParameterMapping {
  /** トークン数制限パラメータ名 (例: 'max_tokens', 'max_gen_len', 'maxTokens') */
  maxTokens?: string;
  /** Temperature パラメータ名 (通常は 'temperature') */
  temperature?: string;
  /** Top-P パラメータ名 (例: 'top_p', 'p', 'topP') */
  topP?: string;
  /** Top-K パラメータ名 (例: 'top_k', 'k') */
  topK?: string;
}

/**
 * Bedrockモデルの設定
 */
export interface BedrockModel {
  /** モデルID (例: 'anthropic.claude-3-sonnet-20240229-v1:0') */
  id: string;
  /** モデル表示名 */
  name: string;
  /** モデルの説明 */
  description: string;
  /** プロバイダー名 */
  provider: 'anthropic' | 'amazon' | 'meta' | 'mistral' | 'ai21' | 'cohere' | 'stability' | 'openai' | 'deepseek' | 'google' | 'nvidia' | 'minimax' | 'zai' | 'moonshot' | 'twelvelabs' | 'unknown';
  /** モデルカテゴリー */
  category: 'chat' | 'embedding' | 'image';
  /** 最大トークン数 */
  maxTokens: number;
  /** デフォルトTemperature */
  temperature: number;
  /** デフォルトTop-P */
  topP: number;
  
  // 新規追加: モデル固有の設定
  /** リクエスト形式 (ペイロード構築に使用) */
  requestFormat?: RequestFormat;
  /** レスポンス形式 (テキスト抽出に使用) */
  responseFormat?: ResponseFormat;
  /** パラメータマッピング (プロバイダー固有のパラメータ名) */
  parameterMapping?: ParameterMapping;
}

// 静的フォールバックモデル（API失敗時用）
const FALLBACK_MODELS: BedrockModel[] = [
  {
    id: 'apac.amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro',
    description: 'Amazon Nova Pro - Amazon最新・推奨モデル',
    provider: 'amazon',
    category: 'chat',
    maxTokens: 4000,
    temperature: 0.7,
    topP: 0.9
  },
  {
    id: 'apac.amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite',
    description: 'Amazon Nova Lite - 軽量・高速版',
    provider: 'amazon',
    category: 'chat',
    maxTokens: 2000,
    temperature: 0.7,
    topP: 0.9
  },
  {
    id: 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0',
    name: 'Claude 3.5 Sonnet',
    description: 'Claude 3.5 Sonnet - Anthropic高性能モデル',
    provider: 'anthropic',
    category: 'chat',
    maxTokens: 4000,
    temperature: 0.7,
    topP: 0.9
  },
  // Note: Claude 3 Sonnet (apac.anthropic.claude-3-sonnet-20240229-v1:0) は
  // Legacyモデルとしてアクセス拒否されるため、フォールバックリストから除外
];

// 動的モデルデータ（キャッシュ用）
let cachedModels: BedrockModel[] | null = null;
let cachedRecommendedModels: string[] = [];
let cachedDefaultModelId: string = 'apac.amazon.nova-pro-v1:0';
let lastFetchTime: number = 0;
const CACHE_DURATION = 0; // キャッシュ無効化（常に最新データを取得）

/**
 * Bedrockから動的にモデル一覧を取得
 */
export async function fetchAvailableModels(): Promise<{
  models: BedrockModel[];
  recommendedModels: string[];
  defaultModelId: string;
}> {
  // キャッシュチェック
  const now = Date.now();
  if (cachedModels && (now - lastFetchTime) < CACHE_DURATION) {
    return {
      models: cachedModels,
      recommendedModels: cachedRecommendedModels,
      defaultModelId: cachedDefaultModelId
    };
  }

  try {
    const response = await fetch('/api/bedrock/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.data) {
      // キャッシュ更新
      cachedModels = data.data.models;
      cachedRecommendedModels = data.data.recommendedModels || [];
      cachedDefaultModelId = data.data.defaultModelId || 'apac.amazon.nova-pro-v1:0';
      lastFetchTime = now;
      
      return {
        models: cachedModels,
        recommendedModels: cachedRecommendedModels,
        defaultModelId: cachedDefaultModelId
      };
    }
  } catch (error) {
    console.warn('Failed to fetch dynamic models, using fallback:', error);
  }

  // フォールバック
  return {
    models: FALLBACK_MODELS,
    recommendedModels: ['apac.amazon.nova-pro-v1:0', 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0'],
    defaultModelId: 'apac.amazon.nova-pro-v1:0'
  };
}

// 同期的なアクセス用（後方互換性）
export let AVAILABLE_MODELS: BedrockModel[] = FALLBACK_MODELS;
export let RECOMMENDED_MODELS: string[] = ['amazon.nova-pro-v1:0'];
export let DEFAULT_MODEL_ID: string = 'amazon.nova-pro-v1:0';

// 初期化時にモデルを取得
if (typeof window !== 'undefined') {
  fetchAvailableModels().then(data => {
    AVAILABLE_MODELS = data.models;
    RECOMMENDED_MODELS = data.recommendedModels;
    DEFAULT_MODEL_ID = data.defaultModelId;
  }).catch(() => {
    // フォールバックは既に設定済み
  });
}

/**
 * モデルIDからモデル情報を取得
 */
export function getModelById(modelId: string): BedrockModel | undefined {
  return AVAILABLE_MODELS.find(model => model.id === modelId);
}

/**
 * プロバイダー別にモデルを取得
 */
export function getModelsByProvider(provider: BedrockModel['provider']): BedrockModel[] {
  return AVAILABLE_MODELS.filter(model => model.provider === provider);
}

/**
 * カテゴリ別にモデルを取得
 */
export function getModelsByCategory(category: BedrockModel['category']): BedrockModel[] {
  return AVAILABLE_MODELS.filter(model => model.category === category);
}

/**
 * 推奨モデルを取得
 */
export function getRecommendedModels(): BedrockModel[] {
  return RECOMMENDED_MODELS
    .map(id => getModelById(id))
    .filter((model): model is BedrockModel => model !== undefined);
}

/**
 * モデル検索
 */
export function searchModels(query: string): BedrockModel[] {
  const queryLower = query.toLowerCase();
  return AVAILABLE_MODELS.filter(model => 
    model.name.toLowerCase().includes(queryLower) ||
    model.description.toLowerCase().includes(queryLower)
  );
}

/**
 * モデルデータを強制更新
 */
export async function refreshModels(): Promise<void> {
  cachedModels = null; // キャッシュクリア
  const data = await fetchAvailableModels();
  AVAILABLE_MODELS = data.models;
  RECOMMENDED_MODELS = data.recommendedModels;
  DEFAULT_MODEL_ID = data.defaultModelId;
}
