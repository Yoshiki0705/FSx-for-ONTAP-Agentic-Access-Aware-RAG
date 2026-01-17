/**
 * AWS Batch 統合テストコンストラクト
 *
 * Agent Steeringルール準拠:
 * - モジュラーアーキテクチャ強制（lib/modules/compute/constructs/）
 * - Job実行テストとFSxマウント確認
 * - 自動復旧機能のテスト
 *
 * Requirements: 1.4, 1.5
 */
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EmbeddingBatchIntegration } from './embedding-batch-integration';
import { EmbeddingConfig } from '../interfaces/embedding-config';
export interface BatchIntegrationTestProps {
    /** Embedding Batch統合 */
    readonly batchIntegration: EmbeddingBatchIntegration;
    /** Embedding設定 */
    readonly config: EmbeddingConfig;
    /** プロジェクト名 */
    readonly projectName: string;
    /** 環境名 */
    readonly environment: string;
    /** テスト通知用SNSトピックARN */
    readonly notificationTopicArn?: string;
}
/**
 * AWS Batch 統合テストコンストラクト
 *
 * 機能:
 * - Job実行テストの自動化
 * - FSxマウント確認テスト
 * - 自動復旧機能のテスト
 * - テスト結果の監視・通知
 */
export declare class BatchIntegrationTest extends Construct {
    /** テスト実行Lambda関数 */
    readonly testRunnerFunction: lambda.Function;
    /** FSxマウントテストLambda関数 */
    readonly fsxMountTestFunction: lambda.Function;
    /** 自動復旧テストLambda関数 */
    readonly autoRecoveryTestFunction: lambda.Function;
    /** テスト結果通知SNSトピック */
    readonly testNotificationTopic: sns.Topic;
    /** テストスケジューラー */
    readonly testScheduler: events.Rule;
    /** テスト結果ログ */
    readonly testLogGroup: logs.LogGroup;
    constructor(scope: Construct, id: string, props: BatchIntegrationTestProps);
    /**
     * テスト結果ログ作成
     */
    private createTestLogGroup;
    /**
     * テスト結果通知SNSトピック作成
     */
    private createTestNotificationTopic;
    /**
     * テスト実行Lambda関数作成
     */
    private createTestRunnerFunction;
    /**
     * FSxマウントテストLambda関数作成
     */
    private createFsxMountTestFunction;
    /**
     * 自動復旧テストLambda関数作成
     */
    private createAutoRecoveryTestFunction;
    /**
     * テストスケジューラー作成
     */
    private createTestScheduler;
    /**
     * テスト監視設定
     */
    private configureTestMonitoring;
    /**
     * テスト統合ダッシュボード作成
     */
    private createTestDashboard;
    /**
     * タグ設定
     */
    private applyTags;
    /**
     * 手動テスト実行メソッド
     */
    runBasicTest(): Promise<string>;
    runFsxMountTest(): Promise<string>;
    runAutoRecoveryTest(): Promise<string>;
    /**
     * テスト結果取得
     */
    getTestInfo(): Record<string, any>;
}
