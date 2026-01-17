// 利用可能なEmbeddingモデルの設定

export interface EmbeddingModel {
  id: string;
  name: string;
  description: string;
  provider: 'amazon' | 'cohere';
  dimensions: number;
  maxInputTokens: number;
  multimodal: boolean;
  region: string;
  status: 'active' | 'preview' | 'deprecated';
}

export const AVAILABLE_EMBEDDING_MODELS: EmbeddingModel[] = [
  // Amazon Nova Multimodal Embeddings (最新・マルチモーダル)
  {
    id: 'amazon.nova-embed-text-v1:0',
    name: 'Amazon Nova Multimodal Embeddings',
    description: '最新のマルチモーダル埋め込みモデル - テキスト・画像・動画対応',
    provider: 'amazon',
    dimensions: 1024,
    maxInputTokens: 8192,
    multimodal: true,
    region: 'us-east-1',
    status: 'active'
  },

  // Amazon Titan Embedding v2 (テキスト専用・高性能)
  {
    id: 'amazon.titan-embed-text-v2:0',
    name: 'Amazon Titan Text Embeddings v2',
    description: 'Titan Embedding v2 - 高性能テキスト埋め込み',
    provider: 'amazon',
    dimensions: 1024,
    maxInputTokens: 8192,
    multimodal: false,
    region: 'ap-northeast-1',
    status: 'active'
  },

  // Amazon Titan Embedding v1 (レガシー)
  {
    id: 'amazon.titan-embed-text-v1',
    name: 'Amazon Titan Text Embeddings v1',
    description: 'Titan Embedding v1 - 従来版',
    provider: 'amazon',
    dimensions: 1536,
    maxInputTokens: 8192,
    multimodal: false,
    region: 'ap-northeast-1',
    status: 'deprecated'
  },

  // Cohere Embed v4 (多言語対応)
  {
    id: 'global.cohere.embed-v4:0',
    name: 'Cohere Embed v4',
    description: 'Cohere Embed v4 - 多言語対応埋め込み',
    provider: 'cohere',
    dimensions: 1024,
    maxInputTokens: 512,
    multimodal: false,
    region: 'ap-northeast-1',
    status: 'active'
  }
];

// 現在使用中のEmbeddingモデル（システム設定）
export const CURRENT_EMBEDDING_MODEL_ID = 'amazon.titan-embed-text-v2:0';

// デフォルトEmbeddingモデル
export const DEFAULT_EMBEDDING_MODEL_ID = 'amazon.titan-embed-text-v2:0';

// 推奨Embeddingモデル
export const RECOMMENDED_EMBEDDING_MODEL_ID = 'amazon.nova-embed-text-v1:0';

// モデルIDからモデル情報を取得
export function getEmbeddingModelById(modelId: string): EmbeddingModel | undefined {
  return AVAILABLE_EMBEDDING_MODELS.find(model => model.id === modelId);
}

// アクティブなモデルのみを取得
export function getActiveEmbeddingModels(): EmbeddingModel[] {
  return AVAILABLE_EMBEDDING_MODELS.filter(model => model.status === 'active');
}

// マルチモーダル対応モデルを取得
export function getMultimodalEmbeddingModels(): EmbeddingModel[] {
  return AVAILABLE_EMBEDDING_MODELS.filter(model => model.multimodal);
}

// リージョン別モデルを取得
export function getEmbeddingModelsByRegion(region: string): EmbeddingModel[] {
  return AVAILABLE_EMBEDDING_MODELS.filter(model => model.region === region);
}

// システム情報（現在の設定）
export const EMBEDDING_SYSTEM_INFO = {
  currentModel: CURRENT_EMBEDDING_MODEL_ID,
  currentModelInfo: getEmbeddingModelById(CURRENT_EMBEDDING_MODEL_ID),
  recommendedModel: RECOMMENDED_EMBEDDING_MODEL_ID,
  recommendedModelInfo: getEmbeddingModelById(RECOMMENDED_EMBEDDING_MODEL_ID),
  supportedRegions: ['us-east-1', 'ap-northeast-1'],
  multimodalSupport: false, // 現在の実装状況
  vectorDimensions: getEmbeddingModelById(CURRENT_EMBEDDING_MODEL_ID)?.dimensions || 1024
};