import { Stack, StackProps, Tags } from 'aws-cdk-lib';
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
export class DisasterRecoveryStack extends Stack {
  public readonly disasterRecoveryManager: DisasterRecoveryManager;
  public readonly dataReplicationManager: DataReplicationManager;

  constructor(scope: Construct, id: string, props: DisasterRecoveryStackProps) {
    super(scope, id, props);

    // 災害復旧設定
    const drConfig = {
      rtoMinutes: 240, // 4時間
      rpoMinutes: 60,  // 1時間
      primaryRegion: props.primaryRegion,
      secondaryRegion: props.secondaryRegion,
      healthCheckIntervalMinutes: 5,
      failoverThreshold: 3
    };

    // データレプリケーション設定
    const replicationConfig = {
      primaryRegion: props.primaryRegion,
      secondaryRegion: props.secondaryRegion,
      replicationIntervalMinutes: 15,
      backupRetentionDays: 30,
      encryptionEnabled: true
    };

    // 災害復旧管理システム
    this.disasterRecoveryManager = new DisasterRecoveryManager(this, 'DisasterRecoveryManager', {
      globalConfig: props.globalConfig,
      drConfig
    });

    // データレプリケーション管理システム
    this.dataReplicationManager = new DataReplicationManager(this, 'DataReplicationManager', {
      globalConfig: props.globalConfig,
      replicationConfig
    });

    // 権限設定
    this.setupPermissions();

    // タグ設定
    this.setupTags(props.globalConfig);
  }

  /**
   * 権限設定
   */
  private setupPermissions(): void {
    this.disasterRecoveryManager.grantPermissions();
    this.dataReplicationManager.grantPermissions();
  }

  /**
   * タグ設定
   */
  private setupTags(config: GlobalRagConfig): void {
    Tags.of(this).add('Project', config.projectName);
    Tags.of(this).add('Environment', config.environment);
    Tags.of(this).add('Component', 'DisasterRecovery');
    Tags.of(this).add('Region', config.region);
    Tags.of(this).add('CostCenter', 'Infrastructure');
    Tags.of(this).add('Owner', 'NetApp-Japan-Tech-Team');
    Tags.of(this).add('Purpose', 'Business-Continuity');
  }

  /**
   * 出力値の定義
   */
  public getOutputs() {
    return {
      disasterRecoveryStatusTableName: this.disasterRecoveryManager.statusTable.tableName,
      replicationStatusTableName: this.dataReplicationManager.getReplicationStatus().tableName,
      healthCheckFunctionArn: this.disasterRecoveryManager.healthCheckFunction.functionArn,
      failoverFunctionArn: this.disasterRecoveryManager.failoverFunction.functionArn,
      alertTopicArn: this.disasterRecoveryManager.alertTopic.topicArn
    };
  }
}