import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { RegionalDeploymentManager } from '../deployment/regional-deployment-manager';
import { GlobalRagConfig } from '../../types/global-config';
/**
 * US地域専用デプロイメントスタック
 *
 * 機能:
 * - US全地域への段階的デプロイメント
 * - SOX・HIPAA・CCPA・FedRAMP対応
 * - 高可用性・高性能設定
 * - 連邦政府機関対応
 */
export declare class UsDeploymentStack extends Stack {
    readonly deploymentManager: RegionalDeploymentManager;
    constructor(scope: Construct, id: string, props: StackProps & {
        globalConfig: GlobalRagConfig;
    });
    /**
     * US地域最適化VPC CIDR取得
     */
    private getUsOptimizedVpcCidr;
    /**
     * US地域段階的デプロイメント
     */
    deployToUsRegions(): void;
    /**
     * バージニア北部地域デプロイメント
     */
    deployToVirginia(): void;
    /**
     * オレゴン地域デプロイメント
     */
    deployToOregon(): void;
    /**
     * オハイオ地域デプロイメント
     */
    deployToOhio(): void;
    /**
     * SOX準拠テスト
     */
    testSoxCompliance(): void;
    /**
     * HIPAA準拠テスト
     */
    testHipaaCompliance(): void;
    /**
     * CCPA準拠テスト
     */
    testCcpaCompliance(): void;
    /**
     * FedRAMP準拠テスト
     */
    testFedRampCompliance(): void;
    /**
     * US内災害復旧テスト
     */
    testUsDisasterRecovery(): void;
    /**
     * 高負荷テスト
     */
    testHighLoadCapacity(): void;
    /**
     * 連邦政府機関対応テスト
     */
    testGovernmentCompliance(): void;
}
