import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { RegionalDeploymentManager } from '../deployment/regional-deployment-manager';
import { GlobalRagConfig } from '../../types/global-config';
/**
 * EU地域専用デプロイメントスタック
 *
 * 機能:
 * - EU全地域への段階的デプロイメント
 * - GDPR完全対応
 * - データ居住性制約への厳格な対応
 * - Brexit後のUK対応
 */
export declare class EuDeploymentStack extends Stack {
    readonly deploymentManager: RegionalDeploymentManager;
    constructor(scope: Construct, id: string, props: StackProps & {
        globalConfig: GlobalRagConfig;
    });
    /**
     * GDPR準拠VPC CIDR取得
     */
    private getGdprCompliantVpcCidr;
    /**
     * EU地域段階的デプロイメント
     */
    deployToEuRegions(): void;
    /**
     * フランクフルト地域デプロイメント
     */
    deployToFrankfurt(): void;
    /**
     * アイルランド地域デプロイメント
     */
    deployToIreland(): void;
    /**
     * ロンドン地域デプロイメント（Brexit対応）
     */
    deployToLondon(): void;
    /**
     * GDPR準拠テスト
     */
    testGdprCompliance(): void;
    /**
     * EU内災害復旧テスト
     */
    testEuDisasterRecovery(): void;
    /**
     * Brexit対応テスト
     */
    testBrexitCompliance(): void;
    /**
     * データ主権テスト
     */
    testDataSovereignty(): void;
}
