import { Construct } from 'constructs';
import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { RegionalDeploymentManager } from '../deployment/regional-deployment-manager';
import { RegionalConfigFactory } from '../deployment/regional-config-factory';
import { GlobalRagConfig } from '../../types/global-config';

/**
 * 日本地域専用デプロイメントスタック
 * 
 * 機能:
 * - 東京・大阪地域への最適化されたデプロイメント
 * - 日本の法規制要件への完全対応
 * - 災害復旧機能（東京⇔大阪）
 * - FISC・個人情報保護法対応
 */
export class JapanDeploymentStack extends Stack {
  public readonly deploymentManager: RegionalDeploymentManager;

  constructor(scope: Construct, id: string, props: StackProps & {
    globalConfig: GlobalRagConfig;
  }) {
    super(scope, id, props);

    // 日本地域設定の取得
    const japanRegions = RegionalConfigFactory.createJapanRegionConfigs();
    const deploymentStrategies = RegionalConfigFactory.createDeploymentStrategies();
    const japanStrategy = deploymentStrategies.japanOnly;

    // 地域別デプロイメント管理システムの作成
    this.deploymentManager = new RegionalDeploymentManager(this, 'JapanDeploymentManager', {
      globalConfig: props.globalConfig,
      deploymentConfig: {
        ...japanStrategy,
        // 日本特有の設定を追加
        targetRegions: japanRegions.map(region => ({
          ...region,
          // 日本の法規制要件を強化
          complianceRequirements: [
            ...region.complianceRequirements,
            'Banking-Act-Japan',
            'Financial-Instruments-Exchange-Act',
            'Act-on-Protection-of-Personal-Information'
          ]
        }))
      }
    });

    // 日本地域固有のタグ付け
    Tags.of(this).add('Region', 'Japan');
    Tags.of(this).add('Compliance', 'FISC-PDPA-Japan');
    Tags.of(this).add('DataResidency', 'Japan-Only');
    Tags.of(this).add('DisasterRecovery', 'Tokyo-Osaka');
    Tags.of(this).add('Language', 'Japanese');

    // 日本の営業時間に合わせたメンテナンス設定
    Tags.of(this).add('MaintenanceWindow', 'JST-02:00-04:00');
    Tags.of(this).add('BusinessHours', 'JST-09:00-18:00');

    // コンプライアンス関連タグ
    Tags.of(this).add('DataClassification', 'Confidential');
    Tags.of(this).add('RetentionPeriod', '7-Years');
    Tags.of(this).add('EncryptionRequired', 'True');
    Tags.of(this).add('AuditRequired', 'True');
  }

  /**
   * 東京地域へのデプロイメント開始
   */
  public deployToTokyo(): void {
    this.deploymentManager.startDeployment({
      deploymentId: `tokyo-deploy-${Date.now()}`,
      targetRegions: ['ap-northeast-1'],
      strategy: 'BLUE_GREEN'
    });
  }

  /**
   * 大阪地域へのデプロイメント開始
   */
  public deployToOsaka(): void {
    this.deploymentManager.startDeployment({
      deploymentId: `osaka-deploy-${Date.now()}`,
      targetRegions: ['ap-northeast-3'],
      strategy: 'BLUE_GREEN'
    });
  }

  /**
   * 東京・大阪同時デプロイメント
   */
  public deployToJapanRegions(): void {
    this.deploymentManager.startDeployment({
      deploymentId: `japan-deploy-${Date.now()}`,
      targetRegions: ['ap-northeast-1', 'ap-northeast-3'],
      strategy: 'BLUE_GREEN'
    });
  }

  /**
   * 災害復旧テスト実行
   */
  public testDisasterRecovery(): void {
    // 東京→大阪フェイルオーバーテスト
    this.deploymentManager.startDeployment({
      deploymentId: `dr-test-${Date.now()}`,
      targetRegions: ['ap-northeast-3'], // 大阪のみ
      strategy: 'BLUE_GREEN'
    });
  }
}