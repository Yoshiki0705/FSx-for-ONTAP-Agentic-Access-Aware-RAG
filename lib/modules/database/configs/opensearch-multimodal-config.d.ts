/**
 * OpenSearch Multimodal Embedding設定
 *
 * 環境別の最適化された設定を提供
 */
import { OpenSearchMultimodalConfig } from '../constructs/opensearch-multimodal-construct';
/**
 * 開発環境用設定
 */
export declare const developmentConfig: OpenSearchMultimodalConfig;
/**
 * ステージング環境用設定
 */
export declare const stagingConfig: OpenSearchMultimodalConfig;
/**
 * 本番環境用設定
 */
export declare const productionConfig: OpenSearchMultimodalConfig;
/**
 * 高性能環境用設定（大量データ処理用）
 */
export declare const highPerformanceConfig: OpenSearchMultimodalConfig;
/**
 * 環境に応じた設定取得
 */
export declare function getOpenSearchMultimodalConfig(environment: string, performanceTier?: 'standard' | 'high'): OpenSearchMultimodalConfig;
/**
 * コスト最適化設定
 */
export declare const costOptimizedConfig: Partial<OpenSearchMultimodalConfig>;
/**
 * パフォーマンス最適化設定
 */
export declare const performanceOptimizedConfig: Partial<OpenSearchMultimodalConfig>;
/**
 * セキュリティ強化設定
 */
export declare const securityEnhancedConfig: Partial<OpenSearchMultimodalConfig>;
