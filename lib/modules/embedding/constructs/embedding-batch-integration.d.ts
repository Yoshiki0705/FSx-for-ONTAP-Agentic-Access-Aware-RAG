/**
 * Embedding Batch統合コンストラクト
 *
 * Agent Steeringルール準拠:
 * - モジュラーアーキテクチャ強制（lib/modules/compute/constructs/）
 * - EmbeddingStackでのBatch統合機能
 * - 自動スケーリング・自動復旧機能付きJob Queue管理
 *
 * Requirements: 1.3, 5.1
 */
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { BatchConstruct } from './batch-construct';
import { EmbeddingConfig } from '../interfaces/embedding-config';
import { EmbeddingCommonResources } from '../interfaces/module-interfaces';
export interface EmbeddingBatchIntegrationProps {
    /** Embedding設定 */
    readonly config: EmbeddingConfig;
    /** プロジェクト名 */
    readonly projectName: string;
    /** 環境名 */
    readonly environment: string;
    /** 共通リソース */
    readonly commonResources: EmbeddingCommonResources;
    /** ECRイメージパス */
    readonly imagePath: string;
    /** イメージタグ */
    readonly imageTag: string;
}
/**
 * Embedding Batch統合コンストラクト
 *
 * 機能:
 * - BatchConstructの統合管理
 * - EmbeddingStackでの統一インターフェース提供
 * - ジョブ実行・監視・管理機能
 * - 自動スケーリング・自動復旧機能
 */
export declare class EmbeddingBatchIntegration extends Construct {
    /** Batchコンストラクト */
    readonly batchConstruct: BatchConstruct;
    /** ジョブ管理Lambda関数 */
    readonly jobManagerFunction: lambda.Function;
    /** 統合監視SNSトピック */
    readonly integrationTopic: sns.Topic;
    /** ジョブスケジューラー */
    readonly jobScheduler: events.Rule;
    constructor(scope: Construct, id: string, props: EmbeddingBatchIntegrationProps);
    /**
     * 統合監視SNSトピック作成
     */
    private createIntegrationTopic;
    /**
     * ジョブ管理Lambda関数作成
     */
    private createJobManagerFunction;
    /**
     * ジョブスケジューラー作成
     */
    private createJobScheduler;
    /**
     * 統合監視設定
     */
    private configureIntegrationMonitoring;
    /**
     * 統合ダッシュボード作成
     */
    private createIntegrationDashboard;
    /**
     * タグ設定
     */
    private applyTags;
    /**
     * ジョブ実行インターフェース
     */
    submitEmbeddingJob(jobName: string, parameters: Record<string, string>): Promise<string>;
    /**
     * ジョブ状況取得
     */
    getJobStatus(): Record<string, any>;
    /**
     * 統合リソース情報取得
     */
    getIntegrationInfo(): Record<string, any>;
}
