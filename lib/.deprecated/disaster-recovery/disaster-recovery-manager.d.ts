import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { GlobalRagConfig } from '../../types/global-config';
/**
 * 災害復旧設定インターフェース
 */
export interface DisasterRecoveryConfig {
    /** 復旧時間目標（分） */
    rtoMinutes: number;
    /** 復旧ポイント目標（分） */
    rpoMinutes: number;
    /** プライマリリージョン */
    primaryRegion: string;
    /** セカンダリリージョン */
    secondaryRegion: string;
    /** ヘルスチェック間隔（分） */
    healthCheckIntervalMinutes: number;
    /** フェイルオーバー閾値 */
    failoverThreshold: number;
}
/**
 * 災害復旧システムの状態
 */
export declare enum DisasterRecoveryState {
    HEALTHY = "HEALTHY",
    DEGRADED = "DEGRADED",
    FAILED = "FAILED",
    FAILOVER_IN_PROGRESS = "FAILOVER_IN_PROGRESS",
    FAILOVER_COMPLETE = "FAILOVER_COMPLETE"
}
/**
 * 災害復旧管理システム
 *
 * 機能:
 * - 東京 ⇔ 大阪間の自動フェイルオーバー
 * - RTO: 4時間以内、RPO: 1時間以内の目標達成
 * - ヘルスチェックと自動切り替え
 * - データレプリケーション監視
 */
export declare class DisasterRecoveryManager extends Construct {
    readonly healthCheckFunction: lambda.Function;
    readonly failoverFunction: lambda.Function;
    readonly statusTable: dynamodb.Table;
    readonly alertTopic: sns.Topic;
    private readonly config;
    private readonly globalConfig;
    constructor(scope: Construct, id: string, props: {
        globalConfig: GlobalRagConfig;
        drConfig: DisasterRecoveryConfig;
    });
    /**
     * 災害復旧状態管理テーブルの作成
     */
    private createStatusTable;
    /**
     * SNS通知トピックの作成
     */
    private createAlertTopic;
    /**
     * ヘルスチェック Lambda関数の作成
     */
    private createHealthCheckFunction;
    /**
     * フェイルオーバー Lambda関数の作成
     */
    private createFailoverFunction;
    /**
     * CloudWatch アラームの作成
     */
    private createCloudWatchAlarms;
    /**
     * 定期ヘルスチェックスケジュールの作成
     */
    private createHealthCheckSchedule;
    /**
     * 権限設定
     */
    grantPermissions(): void;
}
