/**
 * Smart Routing 型定義 - Advanced RAG Features
 *
 * コスト最適化ルーティング機能で使用する型を定義。
 * ComplexityClassifierの分類結果、SmartRouterのルーティング判断、
 * Zustandストアの状態管理インターフェースを含む。
 *
 * @version 1.0.0
 */

/** クエリ複雑度の分類結果 */
export interface ClassificationResult {
  /** クエリの分類: simple（単純）または complex（複雑） */
  classification: 'simple' | 'complex';
  /** 分類の信頼度スコア (0.0〜1.0) */
  confidence: number;
  /** 分類に使用された特徴量 */
  features: {
    charCount: number;
    sentenceCount: number;
    hasAnalyticalKeywords: boolean;
    hasMultipleQuestions: boolean;
  };
}

/** SmartRouterのルーティング判断結果 */
export interface RoutingDecision {
  /** 選択されたモデルID */
  modelId: string;
  /** 分類結果（Smart Routing OFF時はnull） */
  classification: ClassificationResult | null;
  /** 自動ルーティングされたかどうか */
  isAutoRouted: boolean;
  /** ルーティング理由の説明 */
  reason: string;
}

/** SmartRouterの設定 */
export interface SmartRouterConfig {
  /** 軽量モデルID（simple分類時に使用） */
  lightweightModelId: string;
  /** 高性能モデルID（complex分類時に使用） */
  powerfulModelId: string;
}

/** Smart Routing Zustandストアの状態・アクション */
export interface SmartRoutingState {
  /** Smart Routing有効/無効 */
  isEnabled: boolean;
  /** 自動選択モード */
  isAutoMode: boolean;
  /** 軽量モデルID */
  lightweightModelId: string;
  /** 高性能モデルID */
  powerfulModelId: string;
  /** 最後の分類結果 */
  lastClassification: ClassificationResult | null;
  /** Smart Routingの有効/無効を設定 */
  setEnabled: (enabled: boolean) => void;
  /** 自動選択モードを設定 */
  setAutoMode: (auto: boolean) => void;
  /** 軽量モデルIDを設定 */
  setLightweightModelId: (id: string) => void;
  /** 高性能モデルIDを設定 */
  setPowerfulModelId: (id: string) => void;
  /** 最後の分類結果を設定 */
  setLastClassification: (result: ClassificationResult | null) => void;
}
