import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { RegionalDeploymentManager } from '../deployment/regional-deployment-manager';
import { GlobalRagConfig } from '../../types/global-config';
/**
 * APAC地域専用デプロイメントスタック
 *
 * 機能:
 * - APAC全地域への段階的デプロイメント
 * - 地域別法規制要件への対応
 * - 多言語・多通貨対応
 * - 地域間レプリケーション
 */
export declare class ApacDeploymentStack extends Stack {
    readonly deploymentManager: RegionalDeploymentManager;
    constructor(scope: Construct, id: string, props: StackProps & {
        globalConfig: GlobalRagConfig;
    });
    /**
     * 地域別最適化VPC CIDR取得
     */
    private getOptimizedVpcCidr;
    /**
     * 段階的APAC地域デプロイメント
     */
    deployToApacRegions(): void;
    /**
     * シンガポール地域デプロイメント
     */
    deployToSingapore(): void;
    /**
     * オーストラリア地域デプロイメント
     */
    deployToAustralia(): void;
    /**
     * インド地域デプロイメント
     */
    deployToIndia(): void;
    /**
     * 韓国地域デプロイメント
     */
    deployToKorea(): void;
    /**
     * APAC地域間フェイルオーバーテスト
     */
    testApacFailover(): void;
    /**
     * 地域別コンプライアンステスト
     */
    testRegionalCompliance(): void;
}
