import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { RegionalDeploymentManager } from '../deployment/regional-deployment-manager';
import { GlobalRagConfig } from '../../types/global-config';
/**
 * 南米地域専用デプロイメントスタック
 *
 * 機能:
 * - ブラジル（サンパウロ）地域デプロイメント
 * - LGPD（Lei Geral de Proteção de Dados）完全対応
 * - ポルトガル語・スペイン語対応
 * - 南米地域データ主権対応
 */
export declare class SouthAmericaDeploymentStack extends Stack {
    readonly deploymentManager: RegionalDeploymentManager;
    constructor(scope: Construct, id: string, props: StackProps & {
        globalConfig: GlobalRagConfig;
    });
    /**
     * サンパウロ地域デプロイメント
     */
    deployToSaoPaulo(): void;
    /**
     * LGPD準拠テスト
     */
    testLgpdCompliance(): void;
    /**
     * データ主権テスト
     */
    testBrazilianDataSovereignty(): void;
    /**
     * Marco Civil da Internet準拠テスト
     */
    testMarcoCivilCompliance(): void;
    /**
     * ANPD（ブラジル個人データ保護庁）準拠テスト
     */
    testAnpdCompliance(): void;
    /**
     * 多言語対応テスト
     */
    testMultiLanguageSupport(): void;
    /**
     * 南米地域災害復旧テスト
     */
    testSouthAmericaDisasterRecovery(): void;
    /**
     * ブラジル時間帯対応テスト
     */
    testBrazilianTimezoneSupport(): void;
    /**
     * 南米地域パフォーマンステスト
     */
    testSouthAmericaPerformance(): void;
    /**
     * ブラジル通貨（レアル）対応テスト
     */
    testBrazilianCurrencySupport(): void;
    /**
     * 南米地域ネットワーク最適化テスト
     */
    testNetworkOptimization(): void;
}
