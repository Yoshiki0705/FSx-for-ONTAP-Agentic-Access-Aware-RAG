import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { GlobalRagConfig } from '../../types/global-config';
/**
 * データレプリケーション設定
 */
export interface DataReplicationConfig {
    /** プライマリリージョン */
    primaryRegion: string;
    /** セカンダリリージョン */
    secondaryRegion: string;
    /** レプリケーション間隔（分） */
    replicationIntervalMinutes: number;
    /** バックアップ保持期間（日） */
    backupRetentionDays: number;
    /** 暗号化設定 */
    encryptionEnabled: boolean;
}
/**
 * レプリケーション状態
 */
export declare enum ReplicationStatus {
    HEALTHY = "HEALTHY",
    LAGGING = "LAGGING",
    FAILED = "FAILED",
    SYNCING = "SYNCING"
}
/**
 * データレプリケーション管理システム
 *
 * 機能:
 * - DynamoDB Global Tables設定
 * - FSx SnapMirror設定
 * - OpenSearch クロスリージョンレプリケーション
 * - レプリケーション監視とアラート
 */
export declare class DataReplicationManager extends Construct {
    readonly replicationStatusTable: dynamodb.Table;
    readonly replicationMonitorFunction: lambda.Function;
    readonly syncFunction: lambda.Function;
    private readonly config;
    private readonly globalConfig;
    constructor(scope: Construct, id: string, props: {
        globalConfig: GlobalRagConfig;
        replicationConfig: DataReplicationConfig;
    });
    /**
     * レプリケーション状態管理テーブルの作成
     */
    private createReplicationStatusTable;
    /**
     * レプリケーション監視Lambda関数の作成
     */
    private createReplicationMonitorFunction;
    /**
     * データ同期Lambda関数の作成
     */
    private createSyncFunction;
    /**
     * 定期監視スケジュールの作成
     */
    private createMonitoringSchedule;
    /**
     * DynamoDB Global Tablesの設定
     */
    setupDynamoDBGlobalTables(tables: dynamodb.Table[]): void;
    /**
     * 権限設定
     */
    grantPermissions(): void;
    /**
     * レプリケーション状態の取得
     */
    getReplicationStatus(): dynamodb.Table;
}
