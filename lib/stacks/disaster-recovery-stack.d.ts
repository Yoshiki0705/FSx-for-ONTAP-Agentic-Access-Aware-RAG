import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DisasterRecoveryManager } from '../disaster-recovery/disaster-recovery-manager';
import { DataReplicationManager } from '../disaster-recovery/data-replication-manager';
import { GlobalRagConfig } from '../../types/global-config';
/**
 * 災害復旧スタック設定
 */
export interface DisasterRecoveryStackProps extends StackProps {
    globalConfig: GlobalRagConfig;
    primaryRegion: string;
    secondaryRegion: string;
}
/**
 * 災害復旧システム統合スタック
 *
 * 機能:
 * - 東京 ⇔ 大阪間災害復旧システム
 * - データレプリケーション管理
 * - 自動フェイルオーバー機能
 * - RTO: 4時間以内、RPO: 1時間以内の目標達成
 */
export declare class DisasterRecoveryStack extends Stack {
    readonly disasterRecoveryManager: DisasterRecoveryManager;
    readonly dataReplicationManager: DataReplicationManager;
    constructor(scope: Construct, id: string, props: DisasterRecoveryStackProps);
    /**
     * 権限設定
     */
    private setupPermissions;
    /**
     * タグ設定
     */
    private setupTags;
    /**
     * 出力値の定義
     */
    getOutputs(): {
        disasterRecoveryStatusTableName: any;
        replicationStatusTableName: any;
        healthCheckFunctionArn: any;
        failoverFunctionArn: any;
        alertTopicArn: any;
    };
}
