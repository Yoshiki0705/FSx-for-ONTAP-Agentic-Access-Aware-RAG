/**
 * Embedding設定ファクトリー
 *
 * Agent Steeringルール準拠:
 * - 設定外部化とフラグ制御システム
 * - CDKコンテキストによる設定制御機能
 * - 各モジュールの独立した有効化/無効化フラグ機能
 *
 * Requirements: 4.4, 4.5
 */
import * as cdk from 'aws-cdk-lib';
import { EmbeddingConfig } from '../../modules/ai/interfaces/embedding-config';
/**
 * Embedding設定ファクトリー
 */
export declare class EmbeddingConfigFactory {
    /**
     * CDKコンテキストから設定を生成
     */
    static createFromContext(app: cdk.App, environment: string): EmbeddingConfig;
    /**
     * 機能フラグを取得
     */
    private static getFeatureFlags;
    /**
     * 環境別設定を取得
     */
    private static getEnvironmentConfig;
    /**
     * Job Definition設定を作成
     */
    private static createJobDefinitionConfig;
    /**
     * FSx統合設定を作成
     */
    private static createFsxIntegrationConfig;
    /**
     * Active Directory設定を作成
     */
    private static createActiveDirectoryConfig;
    /**
     * Bedrock設定を作成
     */
    private static createBedrockConfig;
    /**
     * OpenSearch統合設定を作成
     */
    private static createOpenSearchIntegrationConfig;
    /**
     * RDS設定を作成
     */
    private static createRdsConfig;
    private static createBatchConfig;
    private static createEcsConfig;
    private static createSpotFleetConfig;
    private static createCommonResourcesConfig;
    private static createMonitoringConfig;
}
/**
 * Embedding機能フラグ
 */
export interface EmbeddingFeatureFlags {
    readonly enableAwsBatch: boolean;
    readonly enableEcsOnEC2: boolean;
    readonly enableSpotFleet: boolean;
    readonly enableMonitoring: boolean;
    readonly enableAutoScaling: boolean;
}
/**
 * Embedding環境設定
 */
export interface EmbeddingEnvironmentConfig {
    readonly instanceTypes: string[];
    readonly maxvCpus: number;
    readonly minvCpus: number;
    readonly multiAz: boolean;
}
