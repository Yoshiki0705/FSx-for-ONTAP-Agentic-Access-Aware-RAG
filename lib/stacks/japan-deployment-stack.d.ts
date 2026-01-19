import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { RegionalDeploymentManager } from '../deployment/regional-deployment-manager';
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
export declare class JapanDeploymentStack extends Stack {
    readonly deploymentManager: RegionalDeploymentManager;
    constructor(scope: Construct, id: string, props: StackProps & {
        globalConfig: GlobalRagConfig;
    });
    /**
     * 東京地域へのデプロイメント開始
     */
    deployToTokyo(): void;
    /**
     * 大阪地域へのデプロイメント開始
     */
    deployToOsaka(): void;
    /**
     * 東京・大阪同時デプロイメント
     */
    deployToJapanRegions(): void;
    /**
     * 災害復旧テスト実行
     */
    testDisasterRecovery(): void;
}
