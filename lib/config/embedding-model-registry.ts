/**
 * Embedding Model Registry
 *
 * 埋め込みモデル定義を構成オブジェクトとして管理し、
 * 新モデル追加時にカタログへの登録のみで対応可能にする。
 */

/** 埋め込みモデルのモダリティ */
export type Modality = 'text' | 'image' | 'video' | 'audio';

/** 埋め込みモデル定義 */
export interface EmbeddingModelDefinition {
  /** CDK コンテキストパラメータ値（例: 'titan-text-v2'） */
  paramKey: string;
  /** Bedrock モデル ID（例: 'amazon.titan-embed-text-v2:0'） */
  modelId: string;
  /** 表示名 */
  displayName: string;
  /** ベクトル次元数 */
  dimensions: number;
  /** 対応モダリティ */
  modalities: Modality[];
  /** BDA Parser が必要か */
  requiresBdaParser: boolean;
  /** 利用可能リージョン */
  availableRegions: string[];
  /** コストティア（将来拡張用） */
  costTier?: 'low' | 'medium' | 'high';
}

/** モデルカタログ（新モデル追加はここに1行追加するだけ） */
const MODEL_CATALOG: Record<string, EmbeddingModelDefinition> = {
  'titan-text-v2': {
    paramKey: 'titan-text-v2',
    modelId: 'amazon.titan-embed-text-v2:0',
    displayName: 'Amazon Titan Text Embeddings v2',
    dimensions: 1024,
    modalities: ['text'],
    requiresBdaParser: false,
    availableRegions: ['us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-west-1', 'ap-southeast-1', 'eu-central-1'],
    costTier: 'low',
  },
  'nova-multimodal': {
    paramKey: 'nova-multimodal',
    modelId: 'amazon.nova-embed-multimodal-v1:0',
    displayName: 'Amazon Nova Multimodal Embeddings',
    dimensions: 1024,
    modalities: ['text', 'image', 'video', 'audio'],
    requiresBdaParser: true,
    availableRegions: ['us-east-1', 'us-west-2'],
    costTier: 'medium',
  },
};

/** multimodalKbMode の有効値 */
export const VALID_KB_MODES = ['replace', 'dual'] as const;
export type MultimodalKbMode = typeof VALID_KB_MODES[number];

/**
 * Embedding Model Registry
 *
 * モデル定義の解決・バリデーション・クエリを提供する。
 */
export class EmbeddingModelRegistry {
  /**
   * パラメータキーからモデル定義を解決する。
   * 無効なキーの場合はエラーをスローする。
   */
  static resolve(paramKey: string): EmbeddingModelDefinition {
    if (!Object.prototype.hasOwnProperty.call(MODEL_CATALOG, paramKey)) {
      const validKeys = EmbeddingModelRegistry.getValidKeys();
      throw new Error(
        `Invalid embeddingModel: '${paramKey}'. Valid values are: ${validKeys.join(', ')}`
      );
    }
    return MODEL_CATALOG[paramKey];
  }

  /**
   * パラメータキーとリージョンの組み合わせをバリデーションする。
   * 無効なキーまたはリージョン非対応の場合はエラーをスローする。
   */
  static validate(paramKey: string, region: string): void {
    const model = EmbeddingModelRegistry.resolve(paramKey);
    if (!model.availableRegions.includes(region)) {
      throw new Error(
        `Embedding model '${paramKey}' (${model.displayName}) is not available in region '${region}'. ` +
        `Available regions: ${model.availableRegions.join(', ')}`
      );
    }
  }

  /**
   * 有効なパラメータキー一覧を返す。
   */
  static getValidKeys(): string[] {
    return Object.keys(MODEL_CATALOG);
  }

  /**
   * 指定モデルがマルチモーダル対応かどうかを返す。
   */
  static isMultimodal(paramKey: string): boolean {
    const model = EmbeddingModelRegistry.resolve(paramKey);
    return model.modalities.length > 1;
  }

  /**
   * multimodalKbMode パラメータをバリデーションする。
   */
  static validateKbMode(mode: string): void {
    if (!(VALID_KB_MODES as readonly string[]).includes(mode)) {
      throw new Error(
        `Invalid multimodalKbMode: '${mode}'. Valid values are: ${VALID_KB_MODES.join(', ')}`
      );
    }
  }
}
