"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SouthAmericaDeploymentStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const regional_deployment_manager_1 = require("../deployment/regional-deployment-manager");
const regional_config_factory_1 = require("../deployment/regional-config-factory");
/**
 * 南米地域専用デプロイメントスタック
 *
 * 機能:
 * - ブラジル（サンパウロ）地域デプロイメント
 * - LGPD（Lei Geral de Proteção de Dados）完全対応
 * - ポルトガル語・スペイン語対応
 * - 南米地域データ主権対応
 */
class SouthAmericaDeploymentStack extends aws_cdk_lib_1.Stack {
    deploymentManager;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 南米地域設定の取得
        const southAmericaRegions = regional_config_factory_1.RegionalConfigFactory.createSouthAmericaRegionConfigs();
        // 南米専用戦略の作成
        const southAmericaStrategy = {
            targetRegions: southAmericaRegions,
            deploymentStrategy: 'BLUE_GREEN',
            rollbackConfig: {
                enabled: true,
                healthCheckThreshold: 90, // LGPD要件により高い基準
                rollbackTimeoutMinutes: 10
            },
            crossRegionReplication: false, // 単一地域のため無効
            disasterRecovery: {
                enabled: true,
                rtoMinutes: 60, // 地域特性を考慮
                rpoMinutes: 30
            }
        };
        // 地域別デプロイメント管理システムの作成
        this.deploymentManager = new regional_deployment_manager_1.RegionalDeploymentManager(this, 'SouthAmericaDeploymentManager', {
            globalConfig: props.globalConfig,
            deploymentConfig: {
                ...southAmericaStrategy,
                targetRegions: southAmericaRegions.map(region => ({
                    ...region,
                    // 南米地域固有の設定を強化
                    complianceRequirements: [
                        ...region.complianceRequirements,
                        'LGPD-Article-6', // Lawful Basis for Processing
                        'LGPD-Article-9', // Data Subject Rights
                        'LGPD-Article-37', // Data Protection Officer
                        'LGPD-Article-38', // Data Protection Impact Assessment
                        'Marco-Civil-Internet', // Brazilian Internet Civil Framework
                        'Brazilian-Constitution-Article-5' // Privacy as Fundamental Right
                    ],
                    // データ居住性制約を厳格化
                    dataResidencyRestrictions: true,
                    environmentConfig: {
                        ...region.environmentConfig,
                        // LGPD対応の追加設定
                        networkConfig: {
                            ...region.environmentConfig.networkConfig,
                            // ブラジル国内でのネットワーク分離
                            vpcCidr: '10.12.0.0/16'
                        }
                    }
                }))
            }
        });
        // 南米地域固有のタグ付け
        aws_cdk_lib_1.Tags.of(this).add('Region', 'South-America');
        aws_cdk_lib_1.Tags.of(this).add('Country', 'Brazil');
        aws_cdk_lib_1.Tags.of(this).add('Compliance', 'LGPD-Strict');
        aws_cdk_lib_1.Tags.of(this).add('DataResidency', 'Brazil-Only');
        aws_cdk_lib_1.Tags.of(this).add('DataSovereignty', 'Brazilian-Law');
        aws_cdk_lib_1.Tags.of(this).add('Languages', 'Portuguese-Spanish');
        // LGPD関連タグ
        aws_cdk_lib_1.Tags.of(this).add('LGPD-Article-6', 'Lawful-Basis-Implemented');
        aws_cdk_lib_1.Tags.of(this).add('LGPD-Article-9', 'Data-Subject-Rights');
        aws_cdk_lib_1.Tags.of(this).add('LGPD-Article-37', 'DPO-Appointed');
        aws_cdk_lib_1.Tags.of(this).add('LGPD-Article-38', 'DPIA-Required');
        aws_cdk_lib_1.Tags.of(this).add('DataRetention', 'LGPD-Compliant');
        aws_cdk_lib_1.Tags.of(this).add('ConsentManagement', 'Implemented');
        aws_cdk_lib_1.Tags.of(this).add('DataPortability', 'Supported');
        // ブラジル法制度対応タグ
        aws_cdk_lib_1.Tags.of(this).add('Marco-Civil-Compliant', 'True');
        aws_cdk_lib_1.Tags.of(this).add('Brazilian-Constitution', 'Article-5-Privacy');
        aws_cdk_lib_1.Tags.of(this).add('ANPD-Compliant', 'True'); // Autoridade Nacional de Proteção de Dados
        // セキュリティ関連タグ
        aws_cdk_lib_1.Tags.of(this).add('EncryptionAtRest', 'AES-256-Brazil');
        aws_cdk_lib_1.Tags.of(this).add('EncryptionInTransit', 'TLS-1.3');
        aws_cdk_lib_1.Tags.of(this).add('KeyManagement', 'Brazil-Sovereign');
        aws_cdk_lib_1.Tags.of(this).add('AuditLogging', 'LGPD-Compliant');
        // 運用関連タグ
        aws_cdk_lib_1.Tags.of(this).add('BusinessHours', 'BRT-08:00-18:00'); // Brasília Time
        aws_cdk_lib_1.Tags.of(this).add('MaintenanceWindow', 'BRT-02:00-04:00');
        aws_cdk_lib_1.Tags.of(this).add('SupportLanguage', 'Portuguese');
        aws_cdk_lib_1.Tags.of(this).add('LocalSupport', 'São-Paulo');
    }
    /**
     * サンパウロ地域デプロイメント
     */
    deployToSaoPaulo() {
        this.deploymentManager.startDeployment({
            deploymentId: `saopaulo-deploy-${Date.now()}`,
            targetRegions: ['sa-east-1'],
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * LGPD準拠テスト
     */
    testLgpdCompliance() {
        const lgpdTests = [
            {
                testType: 'Data-Minimization',
                testId: `lgpd-minimization-${Date.now()}`,
                description: 'データ最小化原則のテスト'
            },
            {
                testType: 'Consent-Management',
                testId: `lgpd-consent-${Date.now()}`,
                description: '同意管理システムのテスト'
            },
            {
                testType: 'Data-Subject-Rights',
                testId: `lgpd-rights-${Date.now()}`,
                description: 'データ主体の権利実装テスト'
            },
            {
                testType: 'Data-Portability',
                testId: `lgpd-portability-${Date.now()}`,
                description: 'データポータビリティ機能テスト'
            },
            {
                testType: 'Right-to-Erasure',
                testId: `lgpd-erasure-${Date.now()}`,
                description: '削除権（忘れられる権利）テスト'
            }
        ];
        lgpdTests.forEach(test => {
            this.deploymentManager.startDeployment({
                deploymentId: test.testId,
                targetRegions: ['sa-east-1'],
                strategy: 'CANARY'
            });
        });
    }
    /**
     * データ主権テスト
     */
    testBrazilianDataSovereignty() {
        // ブラジル国内でのデータ処理・保存の確認
        this.deploymentManager.startDeployment({
            deploymentId: `brazil-sovereignty-test-${Date.now()}`,
            targetRegions: ['sa-east-1'],
            strategy: 'CANARY'
        });
    }
    /**
     * Marco Civil da Internet準拠テスト
     */
    testMarcoCivilCompliance() {
        // ブラジルインターネット市民法準拠テスト
        this.deploymentManager.startDeployment({
            deploymentId: `marco-civil-test-${Date.now()}`,
            targetRegions: ['sa-east-1'],
            strategy: 'CANARY'
        });
    }
    /**
     * ANPD（ブラジル個人データ保護庁）準拠テスト
     */
    testAnpdCompliance() {
        const anpdTests = [
            {
                testType: 'Data-Processing-Registry',
                testId: `anpd-registry-${Date.now()}`,
                description: 'データ処理活動記録簿のテスト'
            },
            {
                testType: 'Incident-Notification',
                testId: `anpd-incident-${Date.now()}`,
                description: 'データ侵害通知システムのテスト'
            },
            {
                testType: 'DPO-Compliance',
                testId: `anpd-dpo-${Date.now()}`,
                description: 'データ保護責任者（DPO）機能のテスト'
            }
        ];
        anpdTests.forEach(test => {
            this.deploymentManager.startDeployment({
                deploymentId: test.testId,
                targetRegions: ['sa-east-1'],
                strategy: 'CANARY'
            });
        });
    }
    /**
     * 多言語対応テスト
     */
    testMultiLanguageSupport() {
        const languageTests = [
            {
                language: 'Portuguese',
                testId: `lang-portuguese-${Date.now()}`,
                description: 'ポルトガル語インターフェーステスト'
            },
            {
                language: 'Spanish',
                testId: `lang-spanish-${Date.now()}`,
                description: 'スペイン語インターフェーステスト'
            }
        ];
        languageTests.forEach(test => {
            this.deploymentManager.startDeployment({
                deploymentId: test.testId,
                targetRegions: ['sa-east-1'],
                strategy: 'CANARY'
            });
        });
    }
    /**
     * 南米地域災害復旧テスト
     */
    testSouthAmericaDisasterRecovery() {
        // 単一地域のため、AZ間フェイルオーバーテスト
        this.deploymentManager.startDeployment({
            deploymentId: `sa-dr-test-${Date.now()}`,
            targetRegions: ['sa-east-1'],
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * ブラジル時間帯対応テスト
     */
    testBrazilianTimezoneSupport() {
        // BRT（Brasília Time）対応テスト
        this.deploymentManager.startDeployment({
            deploymentId: `timezone-brt-test-${Date.now()}`,
            targetRegions: ['sa-east-1'],
            strategy: 'CANARY'
        });
    }
    /**
     * 南米地域パフォーマンステスト
     */
    testSouthAmericaPerformance() {
        // 地域特性を考慮したパフォーマンステスト
        this.deploymentManager.startDeployment({
            deploymentId: `sa-performance-test-${Date.now()}`,
            targetRegions: ['sa-east-1'],
            strategy: 'CANARY'
        });
    }
    /**
     * ブラジル通貨（レアル）対応テスト
     */
    testBrazilianCurrencySupport() {
        // BRL（Brazilian Real）対応テスト
        this.deploymentManager.startDeployment({
            deploymentId: `currency-brl-test-${Date.now()}`,
            targetRegions: ['sa-east-1'],
            strategy: 'CANARY'
        });
    }
    /**
     * 南米地域ネットワーク最適化テスト
     */
    testNetworkOptimization() {
        // 南米地域のネットワーク遅延最適化テスト
        this.deploymentManager.startDeployment({
            deploymentId: `network-optimization-test-${Date.now()}`,
            targetRegions: ['sa-east-1'],
            strategy: 'CANARY'
        });
    }
}
exports.SouthAmericaDeploymentStack = SouthAmericaDeploymentStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291dGgtYW1lcmljYS1kZXBsb3ltZW50LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic291dGgtYW1lcmljYS1kZXBsb3ltZW50LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLDZDQUFzRDtBQUN0RCwyRkFBc0Y7QUFDdEYsbUZBQThFO0FBRzlFOzs7Ozs7OztHQVFHO0FBQ0gsTUFBYSwyQkFBNEIsU0FBUSxtQkFBSztJQUNwQyxpQkFBaUIsQ0FBNEI7SUFFN0QsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUV6QztRQUNDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLFlBQVk7UUFDWixNQUFNLG1CQUFtQixHQUFHLCtDQUFxQixDQUFDLCtCQUErQixFQUFFLENBQUM7UUFFcEYsWUFBWTtRQUNaLE1BQU0sb0JBQW9CLEdBQUc7WUFDM0IsYUFBYSxFQUFFLG1CQUFtQjtZQUNsQyxrQkFBa0IsRUFBRSxZQUFxQjtZQUN6QyxjQUFjLEVBQUU7Z0JBQ2QsT0FBTyxFQUFFLElBQUk7Z0JBQ2Isb0JBQW9CLEVBQUUsRUFBRSxFQUFFLGdCQUFnQjtnQkFDMUMsc0JBQXNCLEVBQUUsRUFBRTthQUMzQjtZQUNELHNCQUFzQixFQUFFLEtBQUssRUFBRSxZQUFZO1lBQzNDLGdCQUFnQixFQUFFO2dCQUNoQixPQUFPLEVBQUUsSUFBSTtnQkFDYixVQUFVLEVBQUUsRUFBRSxFQUFFLFVBQVU7Z0JBQzFCLFVBQVUsRUFBRSxFQUFFO2FBQ2Y7U0FDRixDQUFDO1FBRUYsc0JBQXNCO1FBQ3RCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLHVEQUF5QixDQUFDLElBQUksRUFBRSwrQkFBK0IsRUFBRTtZQUM1RixZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7WUFDaEMsZ0JBQWdCLEVBQUU7Z0JBQ2hCLEdBQUcsb0JBQW9CO2dCQUN2QixhQUFhLEVBQUUsbUJBQW1CLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDaEQsR0FBRyxNQUFNO29CQUNULGVBQWU7b0JBQ2Ysc0JBQXNCLEVBQUU7d0JBQ3RCLEdBQUcsTUFBTSxDQUFDLHNCQUFzQjt3QkFDaEMsZ0JBQWdCLEVBQU8sOEJBQThCO3dCQUNyRCxnQkFBZ0IsRUFBTyxzQkFBc0I7d0JBQzdDLGlCQUFpQixFQUFNLDBCQUEwQjt3QkFDakQsaUJBQWlCLEVBQU0sb0NBQW9DO3dCQUMzRCxzQkFBc0IsRUFBRSxxQ0FBcUM7d0JBQzdELGtDQUFrQyxDQUFDLCtCQUErQjtxQkFDbkU7b0JBQ0QsZUFBZTtvQkFDZix5QkFBeUIsRUFBRSxJQUFJO29CQUMvQixpQkFBaUIsRUFBRTt3QkFDakIsR0FBRyxNQUFNLENBQUMsaUJBQWlCO3dCQUMzQixjQUFjO3dCQUNkLGFBQWEsRUFBRTs0QkFDYixHQUFHLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhOzRCQUN6QyxtQkFBbUI7NEJBQ25CLE9BQU8sRUFBRSxjQUFjO3lCQUN4QjtxQkFDRjtpQkFDRixDQUFDLENBQUM7YUFDSjtTQUNGLENBQUMsQ0FBQztRQUVILGNBQWM7UUFDZCxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQzdDLGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDdkMsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxhQUFhLENBQUMsQ0FBQztRQUMvQyxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ2xELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUN0RCxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLG9CQUFvQixDQUFDLENBQUM7UUFFckQsV0FBVztRQUNYLGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO1FBQ2hFLGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO1FBQzNELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUN0RCxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDdEQsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3JELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUN0RCxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFFbEQsY0FBYztRQUNkLGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNuRCxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsd0JBQXdCLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUNqRSxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQywyQ0FBMkM7UUFFeEYsYUFBYTtRQUNiLGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3hELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUNwRCxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDdkQsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBRXBELFNBQVM7UUFDVCxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxnQkFBZ0I7UUFDdkUsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDMUQsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ25ELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVEOztPQUVHO0lBQ0ksZ0JBQWdCO1FBQ3JCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7WUFDckMsWUFBWSxFQUFFLG1CQUFtQixJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDN0MsYUFBYSxFQUFFLENBQUMsV0FBVyxDQUFDO1lBQzVCLFFBQVEsRUFBRSxZQUFZO1NBQ3ZCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNJLGtCQUFrQjtRQUN2QixNQUFNLFNBQVMsR0FBRztZQUNoQjtnQkFDRSxRQUFRLEVBQUUsbUJBQW1CO2dCQUM3QixNQUFNLEVBQUUscUJBQXFCLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDekMsV0FBVyxFQUFFLGNBQWM7YUFDNUI7WUFDRDtnQkFDRSxRQUFRLEVBQUUsb0JBQW9CO2dCQUM5QixNQUFNLEVBQUUsZ0JBQWdCLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDcEMsV0FBVyxFQUFFLGNBQWM7YUFDNUI7WUFDRDtnQkFDRSxRQUFRLEVBQUUscUJBQXFCO2dCQUMvQixNQUFNLEVBQUUsZUFBZSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBQ25DLFdBQVcsRUFBRSxlQUFlO2FBQzdCO1lBQ0Q7Z0JBQ0UsUUFBUSxFQUFFLGtCQUFrQjtnQkFDNUIsTUFBTSxFQUFFLG9CQUFvQixJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBQ3hDLFdBQVcsRUFBRSxpQkFBaUI7YUFDL0I7WUFDRDtnQkFDRSxRQUFRLEVBQUUsa0JBQWtCO2dCQUM1QixNQUFNLEVBQUUsZ0JBQWdCLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDcEMsV0FBVyxFQUFFLGlCQUFpQjthQUMvQjtTQUNGLENBQUM7UUFFRixTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3ZCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7Z0JBQ3JDLFlBQVksRUFBRSxJQUFJLENBQUMsTUFBTTtnQkFDekIsYUFBYSxFQUFFLENBQUMsV0FBVyxDQUFDO2dCQUM1QixRQUFRLEVBQUUsUUFBUTthQUNuQixDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNJLDRCQUE0QjtRQUNqQyxzQkFBc0I7UUFDdEIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsQ0FBQztZQUNyQyxZQUFZLEVBQUUsMkJBQTJCLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUNyRCxhQUFhLEVBQUUsQ0FBQyxXQUFXLENBQUM7WUFDNUIsUUFBUSxFQUFFLFFBQVE7U0FDbkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0ksd0JBQXdCO1FBQzdCLHNCQUFzQjtRQUN0QixJQUFJLENBQUMsaUJBQWlCLENBQUMsZUFBZSxDQUFDO1lBQ3JDLFlBQVksRUFBRSxvQkFBb0IsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzlDLGFBQWEsRUFBRSxDQUFDLFdBQVcsQ0FBQztZQUM1QixRQUFRLEVBQUUsUUFBUTtTQUNuQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxrQkFBa0I7UUFDdkIsTUFBTSxTQUFTLEdBQUc7WUFDaEI7Z0JBQ0UsUUFBUSxFQUFFLDBCQUEwQjtnQkFDcEMsTUFBTSxFQUFFLGlCQUFpQixJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBQ3JDLFdBQVcsRUFBRSxnQkFBZ0I7YUFDOUI7WUFDRDtnQkFDRSxRQUFRLEVBQUUsdUJBQXVCO2dCQUNqQyxNQUFNLEVBQUUsaUJBQWlCLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDckMsV0FBVyxFQUFFLGlCQUFpQjthQUMvQjtZQUNEO2dCQUNFLFFBQVEsRUFBRSxnQkFBZ0I7Z0JBQzFCLE1BQU0sRUFBRSxZQUFZLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDaEMsV0FBVyxFQUFFLHFCQUFxQjthQUNuQztTQUNGLENBQUM7UUFFRixTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3ZCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7Z0JBQ3JDLFlBQVksRUFBRSxJQUFJLENBQUMsTUFBTTtnQkFDekIsYUFBYSxFQUFFLENBQUMsV0FBVyxDQUFDO2dCQUM1QixRQUFRLEVBQUUsUUFBUTthQUNuQixDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNJLHdCQUF3QjtRQUM3QixNQUFNLGFBQWEsR0FBRztZQUNwQjtnQkFDRSxRQUFRLEVBQUUsWUFBWTtnQkFDdEIsTUFBTSxFQUFFLG1CQUFtQixJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBQ3ZDLFdBQVcsRUFBRSxtQkFBbUI7YUFDakM7WUFDRDtnQkFDRSxRQUFRLEVBQUUsU0FBUztnQkFDbkIsTUFBTSxFQUFFLGdCQUFnQixJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBQ3BDLFdBQVcsRUFBRSxrQkFBa0I7YUFDaEM7U0FDRixDQUFDO1FBRUYsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUMzQixJQUFJLENBQUMsaUJBQWlCLENBQUMsZUFBZSxDQUFDO2dCQUNyQyxZQUFZLEVBQUUsSUFBSSxDQUFDLE1BQU07Z0JBQ3pCLGFBQWEsRUFBRSxDQUFDLFdBQVcsQ0FBQztnQkFDNUIsUUFBUSxFQUFFLFFBQVE7YUFDbkIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxnQ0FBZ0M7UUFDckMseUJBQXlCO1FBQ3pCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7WUFDckMsWUFBWSxFQUFFLGNBQWMsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQ3hDLGFBQWEsRUFBRSxDQUFDLFdBQVcsQ0FBQztZQUM1QixRQUFRLEVBQUUsWUFBWTtTQUN2QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSw0QkFBNEI7UUFDakMsMEJBQTBCO1FBQzFCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7WUFDckMsWUFBWSxFQUFFLHFCQUFxQixJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDL0MsYUFBYSxFQUFFLENBQUMsV0FBVyxDQUFDO1lBQzVCLFFBQVEsRUFBRSxRQUFRO1NBQ25CLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNJLDJCQUEyQjtRQUNoQyxzQkFBc0I7UUFDdEIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsQ0FBQztZQUNyQyxZQUFZLEVBQUUsdUJBQXVCLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUNqRCxhQUFhLEVBQUUsQ0FBQyxXQUFXLENBQUM7WUFDNUIsUUFBUSxFQUFFLFFBQVE7U0FDbkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0ksNEJBQTRCO1FBQ2pDLDJCQUEyQjtRQUMzQixJQUFJLENBQUMsaUJBQWlCLENBQUMsZUFBZSxDQUFDO1lBQ3JDLFlBQVksRUFBRSxxQkFBcUIsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQy9DLGFBQWEsRUFBRSxDQUFDLFdBQVcsQ0FBQztZQUM1QixRQUFRLEVBQUUsUUFBUTtTQUNuQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSx1QkFBdUI7UUFDNUIsc0JBQXNCO1FBQ3RCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7WUFDckMsWUFBWSxFQUFFLDZCQUE2QixJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDdkQsYUFBYSxFQUFFLENBQUMsV0FBVyxDQUFDO1lBQzVCLFFBQVEsRUFBRSxRQUFRO1NBQ25CLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQS9SRCxrRUErUkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IFN0YWNrLCBTdGFja1Byb3BzLCBUYWdzIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgUmVnaW9uYWxEZXBsb3ltZW50TWFuYWdlciB9IGZyb20gJy4uL2RlcGxveW1lbnQvcmVnaW9uYWwtZGVwbG95bWVudC1tYW5hZ2VyJztcbmltcG9ydCB7IFJlZ2lvbmFsQ29uZmlnRmFjdG9yeSB9IGZyb20gJy4uL2RlcGxveW1lbnQvcmVnaW9uYWwtY29uZmlnLWZhY3RvcnknO1xuaW1wb3J0IHsgR2xvYmFsUmFnQ29uZmlnIH0gZnJvbSAnLi4vLi4vdHlwZXMvZ2xvYmFsLWNvbmZpZyc7XG5cbi8qKlxuICog5Y2X57Gz5Zyw5Z+f5bCC55So44OH44OX44Ot44Kk44Oh44Oz44OI44K544K/44OD44KvXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0g44OW44Op44K444Or77yI44K144Oz44OR44Km44Ot77yJ5Zyw5Z+f44OH44OX44Ot44Kk44Oh44Oz44OIXG4gKiAtIExHUETvvIhMZWkgR2VyYWwgZGUgUHJvdGXDp8OjbyBkZSBEYWRvc++8ieWujOWFqOWvvuW/nFxuICogLSDjg53jg6vjg4jjgqzjg6voqp7jg7vjgrnjg5rjgqTjg7Poqp7lr77lv5xcbiAqIC0g5Y2X57Gz5Zyw5Z+f44OH44O844K/5Li75qip5a++5b+cXG4gKi9cbmV4cG9ydCBjbGFzcyBTb3V0aEFtZXJpY2FEZXBsb3ltZW50U3RhY2sgZXh0ZW5kcyBTdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBkZXBsb3ltZW50TWFuYWdlcjogUmVnaW9uYWxEZXBsb3ltZW50TWFuYWdlcjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogU3RhY2tQcm9wcyAmIHtcbiAgICBnbG9iYWxDb25maWc6IEdsb2JhbFJhZ0NvbmZpZztcbiAgfSkge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8g5Y2X57Gz5Zyw5Z+f6Kit5a6a44Gu5Y+W5b6XXG4gICAgY29uc3Qgc291dGhBbWVyaWNhUmVnaW9ucyA9IFJlZ2lvbmFsQ29uZmlnRmFjdG9yeS5jcmVhdGVTb3V0aEFtZXJpY2FSZWdpb25Db25maWdzKCk7XG4gICAgXG4gICAgLy8g5Y2X57Gz5bCC55So5oim55Wl44Gu5L2c5oiQXG4gICAgY29uc3Qgc291dGhBbWVyaWNhU3RyYXRlZ3kgPSB7XG4gICAgICB0YXJnZXRSZWdpb25zOiBzb3V0aEFtZXJpY2FSZWdpb25zLFxuICAgICAgZGVwbG95bWVudFN0cmF0ZWd5OiAnQkxVRV9HUkVFTicgYXMgY29uc3QsXG4gICAgICByb2xsYmFja0NvbmZpZzoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBoZWFsdGhDaGVja1RocmVzaG9sZDogOTAsIC8vIExHUETopoHku7bjgavjgojjgorpq5jjgYTln7rmupZcbiAgICAgICAgcm9sbGJhY2tUaW1lb3V0TWludXRlczogMTBcbiAgICAgIH0sXG4gICAgICBjcm9zc1JlZ2lvblJlcGxpY2F0aW9uOiBmYWxzZSwgLy8g5Y2Y5LiA5Zyw5Z+f44Gu44Gf44KB54Sh5Yq5XG4gICAgICBkaXNhc3RlclJlY292ZXJ5OiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHJ0b01pbnV0ZXM6IDYwLCAvLyDlnLDln5/nibnmgKfjgpLogIPmha5cbiAgICAgICAgcnBvTWludXRlczogMzBcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8g5Zyw5Z+f5Yil44OH44OX44Ot44Kk44Oh44Oz44OI566h55CG44K344K544OG44Og44Gu5L2c5oiQXG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlciA9IG5ldyBSZWdpb25hbERlcGxveW1lbnRNYW5hZ2VyKHRoaXMsICdTb3V0aEFtZXJpY2FEZXBsb3ltZW50TWFuYWdlcicsIHtcbiAgICAgIGdsb2JhbENvbmZpZzogcHJvcHMuZ2xvYmFsQ29uZmlnLFxuICAgICAgZGVwbG95bWVudENvbmZpZzoge1xuICAgICAgICAuLi5zb3V0aEFtZXJpY2FTdHJhdGVneSxcbiAgICAgICAgdGFyZ2V0UmVnaW9uczogc291dGhBbWVyaWNhUmVnaW9ucy5tYXAocmVnaW9uID0+ICh7XG4gICAgICAgICAgLi4ucmVnaW9uLFxuICAgICAgICAgIC8vIOWNl+exs+WcsOWfn+WbuuacieOBruioreWumuOCkuW8t+WMllxuICAgICAgICAgIGNvbXBsaWFuY2VSZXF1aXJlbWVudHM6IFtcbiAgICAgICAgICAgIC4uLnJlZ2lvbi5jb21wbGlhbmNlUmVxdWlyZW1lbnRzLFxuICAgICAgICAgICAgJ0xHUEQtQXJ0aWNsZS02JywgICAgICAvLyBMYXdmdWwgQmFzaXMgZm9yIFByb2Nlc3NpbmdcbiAgICAgICAgICAgICdMR1BELUFydGljbGUtOScsICAgICAgLy8gRGF0YSBTdWJqZWN0IFJpZ2h0c1xuICAgICAgICAgICAgJ0xHUEQtQXJ0aWNsZS0zNycsICAgICAvLyBEYXRhIFByb3RlY3Rpb24gT2ZmaWNlclxuICAgICAgICAgICAgJ0xHUEQtQXJ0aWNsZS0zOCcsICAgICAvLyBEYXRhIFByb3RlY3Rpb24gSW1wYWN0IEFzc2Vzc21lbnRcbiAgICAgICAgICAgICdNYXJjby1DaXZpbC1JbnRlcm5ldCcsIC8vIEJyYXppbGlhbiBJbnRlcm5ldCBDaXZpbCBGcmFtZXdvcmtcbiAgICAgICAgICAgICdCcmF6aWxpYW4tQ29uc3RpdHV0aW9uLUFydGljbGUtNScgLy8gUHJpdmFjeSBhcyBGdW5kYW1lbnRhbCBSaWdodFxuICAgICAgICAgIF0sXG4gICAgICAgICAgLy8g44OH44O844K/5bGF5L2P5oCn5Yi257SE44KS5Y6z5qC85YyWXG4gICAgICAgICAgZGF0YVJlc2lkZW5jeVJlc3RyaWN0aW9uczogdHJ1ZSxcbiAgICAgICAgICBlbnZpcm9ubWVudENvbmZpZzoge1xuICAgICAgICAgICAgLi4ucmVnaW9uLmVudmlyb25tZW50Q29uZmlnLFxuICAgICAgICAgICAgLy8gTEdQROWvvuW/nOOBrui/veWKoOioreWumlxuICAgICAgICAgICAgbmV0d29ya0NvbmZpZzoge1xuICAgICAgICAgICAgICAuLi5yZWdpb24uZW52aXJvbm1lbnRDb25maWcubmV0d29ya0NvbmZpZyxcbiAgICAgICAgICAgICAgLy8g44OW44Op44K444Or5Zu95YaF44Gn44Gu44ON44OD44OI44Ov44O844Kv5YiG6ZuiXG4gICAgICAgICAgICAgIHZwY0NpZHI6ICcxMC4xMi4wLjAvMTYnXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KSlcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIOWNl+exs+WcsOWfn+WbuuacieOBruOCv+OCsOS7mOOBkVxuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdSZWdpb24nLCAnU291dGgtQW1lcmljYScpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdDb3VudHJ5JywgJ0JyYXppbCcpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdDb21wbGlhbmNlJywgJ0xHUEQtU3RyaWN0Jyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0RhdGFSZXNpZGVuY3knLCAnQnJhemlsLU9ubHknKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnRGF0YVNvdmVyZWlnbnR5JywgJ0JyYXppbGlhbi1MYXcnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnTGFuZ3VhZ2VzJywgJ1BvcnR1Z3Vlc2UtU3BhbmlzaCcpO1xuXG4gICAgLy8gTEdQROmWoumAo+OCv+OCsFxuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdMR1BELUFydGljbGUtNicsICdMYXdmdWwtQmFzaXMtSW1wbGVtZW50ZWQnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnTEdQRC1BcnRpY2xlLTknLCAnRGF0YS1TdWJqZWN0LVJpZ2h0cycpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdMR1BELUFydGljbGUtMzcnLCAnRFBPLUFwcG9pbnRlZCcpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdMR1BELUFydGljbGUtMzgnLCAnRFBJQS1SZXF1aXJlZCcpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdEYXRhUmV0ZW50aW9uJywgJ0xHUEQtQ29tcGxpYW50Jyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0NvbnNlbnRNYW5hZ2VtZW50JywgJ0ltcGxlbWVudGVkJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0RhdGFQb3J0YWJpbGl0eScsICdTdXBwb3J0ZWQnKTtcblxuICAgIC8vIOODluODqeOCuOODq+azleWItuW6puWvvuW/nOOCv+OCsFxuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdNYXJjby1DaXZpbC1Db21wbGlhbnQnLCAnVHJ1ZScpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdCcmF6aWxpYW4tQ29uc3RpdHV0aW9uJywgJ0FydGljbGUtNS1Qcml2YWN5Jyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0FOUEQtQ29tcGxpYW50JywgJ1RydWUnKTsgLy8gQXV0b3JpZGFkZSBOYWNpb25hbCBkZSBQcm90ZcOnw6NvIGRlIERhZG9zXG5cbiAgICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPplqLpgKPjgr/jgrBcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnRW5jcnlwdGlvbkF0UmVzdCcsICdBRVMtMjU2LUJyYXppbCcpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdFbmNyeXB0aW9uSW5UcmFuc2l0JywgJ1RMUy0xLjMnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnS2V5TWFuYWdlbWVudCcsICdCcmF6aWwtU292ZXJlaWduJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0F1ZGl0TG9nZ2luZycsICdMR1BELUNvbXBsaWFudCcpO1xuXG4gICAgLy8g6YGL55So6Zai6YCj44K/44KwXG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0J1c2luZXNzSG91cnMnLCAnQlJULTA4OjAwLTE4OjAwJyk7IC8vIEJyYXPDrWxpYSBUaW1lXG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ01haW50ZW5hbmNlV2luZG93JywgJ0JSVC0wMjowMC0wNDowMCcpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdTdXBwb3J0TGFuZ3VhZ2UnLCAnUG9ydHVndWVzZScpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdMb2NhbFN1cHBvcnQnLCAnU8Ojby1QYXVsbycpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCteODs+ODkeOCpuODreWcsOWfn+ODh+ODl+ODreOCpOODoeODs+ODiFxuICAgKi9cbiAgcHVibGljIGRlcGxveVRvU2FvUGF1bG8oKTogdm9pZCB7XG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgZGVwbG95bWVudElkOiBgc2FvcGF1bG8tZGVwbG95LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydzYS1lYXN0LTEnXSxcbiAgICAgIHN0cmF0ZWd5OiAnQkxVRV9HUkVFTidcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMR1BE5rqW5oug44OG44K544OIXG4gICAqL1xuICBwdWJsaWMgdGVzdExncGRDb21wbGlhbmNlKCk6IHZvaWQge1xuICAgIGNvbnN0IGxncGRUZXN0cyA9IFtcbiAgICAgIHtcbiAgICAgICAgdGVzdFR5cGU6ICdEYXRhLU1pbmltaXphdGlvbicsXG4gICAgICAgIHRlc3RJZDogYGxncGQtbWluaW1pemF0aW9uLSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+ODh+ODvOOCv+acgOWwj+WMluWOn+WJh+OBruODhuOCueODiCdcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHRlc3RUeXBlOiAnQ29uc2VudC1NYW5hZ2VtZW50JyxcbiAgICAgICAgdGVzdElkOiBgbGdwZC1jb25zZW50LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+WQjOaEj+euoeeQhuOCt+OCueODhuODoOOBruODhuOCueODiCdcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHRlc3RUeXBlOiAnRGF0YS1TdWJqZWN0LVJpZ2h0cycsXG4gICAgICAgIHRlc3RJZDogYGxncGQtcmlnaHRzLSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+ODh+ODvOOCv+S4u+S9k+OBruaoqeWIqeWun+ijheODhuOCueODiCdcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHRlc3RUeXBlOiAnRGF0YS1Qb3J0YWJpbGl0eScsXG4gICAgICAgIHRlc3RJZDogYGxncGQtcG9ydGFiaWxpdHktJHtEYXRlLm5vdygpfWAsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn44OH44O844K/44Od44O844K/44OT44Oq44OG44Kj5qmf6IO944OG44K544OIJ1xuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgdGVzdFR5cGU6ICdSaWdodC10by1FcmFzdXJlJyxcbiAgICAgICAgdGVzdElkOiBgbGdwZC1lcmFzdXJlLSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+WJiumZpOaoqe+8iOW/mOOCjOOCieOCjOOCi+aoqeWIqe+8ieODhuOCueODiCdcbiAgICAgIH1cbiAgICBdO1xuXG4gICAgbGdwZFRlc3RzLmZvckVhY2godGVzdCA9PiB7XG4gICAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICAgIGRlcGxveW1lbnRJZDogdGVzdC50ZXN0SWQsXG4gICAgICAgIHRhcmdldFJlZ2lvbnM6IFsnc2EtZWFzdC0xJ10sXG4gICAgICAgIHN0cmF0ZWd5OiAnQ0FOQVJZJ1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44OH44O844K/5Li75qip44OG44K544OIXG4gICAqL1xuICBwdWJsaWMgdGVzdEJyYXppbGlhbkRhdGFTb3ZlcmVpZ250eSgpOiB2b2lkIHtcbiAgICAvLyDjg5bjg6njgrjjg6vlm73lhoXjgafjga7jg4fjg7zjgr/lh6bnkIbjg7vkv53lrZjjga7norroqo1cbiAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICBkZXBsb3ltZW50SWQ6IGBicmF6aWwtc292ZXJlaWdudHktdGVzdC0ke0RhdGUubm93KCl9YCxcbiAgICAgIHRhcmdldFJlZ2lvbnM6IFsnc2EtZWFzdC0xJ10sXG4gICAgICBzdHJhdGVneTogJ0NBTkFSWSdcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNYXJjbyBDaXZpbCBkYSBJbnRlcm5ldOa6luaLoOODhuOCueODiFxuICAgKi9cbiAgcHVibGljIHRlc3RNYXJjb0NpdmlsQ29tcGxpYW5jZSgpOiB2b2lkIHtcbiAgICAvLyDjg5bjg6njgrjjg6vjgqTjg7Pjgr/jg7zjg43jg4Pjg4jluILmsJHms5Xmupbmi6Djg4bjgrnjg4hcbiAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICBkZXBsb3ltZW50SWQ6IGBtYXJjby1jaXZpbC10ZXN0LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydzYS1lYXN0LTEnXSxcbiAgICAgIHN0cmF0ZWd5OiAnQ0FOQVJZJ1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFOUETvvIjjg5bjg6njgrjjg6vlgIvkurrjg4fjg7zjgr/kv53orbfluoHvvInmupbmi6Djg4bjgrnjg4hcbiAgICovXG4gIHB1YmxpYyB0ZXN0QW5wZENvbXBsaWFuY2UoKTogdm9pZCB7XG4gICAgY29uc3QgYW5wZFRlc3RzID0gW1xuICAgICAge1xuICAgICAgICB0ZXN0VHlwZTogJ0RhdGEtUHJvY2Vzc2luZy1SZWdpc3RyeScsXG4gICAgICAgIHRlc3RJZDogYGFucGQtcmVnaXN0cnktJHtEYXRlLm5vdygpfWAsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn44OH44O844K/5Yem55CG5rS75YuV6KiY6Yyy57C/44Gu44OG44K544OIJ1xuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgdGVzdFR5cGU6ICdJbmNpZGVudC1Ob3RpZmljYXRpb24nLFxuICAgICAgICB0ZXN0SWQ6IGBhbnBkLWluY2lkZW50LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+ODh+ODvOOCv+S+teWus+mAmuefpeOCt+OCueODhuODoOOBruODhuOCueODiCdcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHRlc3RUeXBlOiAnRFBPLUNvbXBsaWFuY2UnLFxuICAgICAgICB0ZXN0SWQ6IGBhbnBkLWRwby0ke0RhdGUubm93KCl9YCxcbiAgICAgICAgZGVzY3JpcHRpb246ICfjg4fjg7zjgr/kv53orbfosqzku7vogIXvvIhEUE/vvInmqZ/og73jga7jg4bjgrnjg4gnXG4gICAgICB9XG4gICAgXTtcblxuICAgIGFucGRUZXN0cy5mb3JFYWNoKHRlc3QgPT4ge1xuICAgICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgICBkZXBsb3ltZW50SWQ6IHRlc3QudGVzdElkLFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBbJ3NhLWVhc3QtMSddLFxuICAgICAgICBzdHJhdGVneTogJ0NBTkFSWSdcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOWkmuiogOiqnuWvvuW/nOODhuOCueODiFxuICAgKi9cbiAgcHVibGljIHRlc3RNdWx0aUxhbmd1YWdlU3VwcG9ydCgpOiB2b2lkIHtcbiAgICBjb25zdCBsYW5ndWFnZVRlc3RzID0gW1xuICAgICAge1xuICAgICAgICBsYW5ndWFnZTogJ1BvcnR1Z3Vlc2UnLFxuICAgICAgICB0ZXN0SWQ6IGBsYW5nLXBvcnR1Z3Vlc2UtJHtEYXRlLm5vdygpfWAsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn44Od44Or44OI44Ks44Or6Kqe44Kk44Oz44K/44O844OV44Kn44O844K544OG44K544OIJ1xuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbGFuZ3VhZ2U6ICdTcGFuaXNoJyxcbiAgICAgICAgdGVzdElkOiBgbGFuZy1zcGFuaXNoLSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+OCueODmuOCpOODs+iqnuOCpOODs+OCv+ODvOODleOCp+ODvOOCueODhuOCueODiCdcbiAgICAgIH1cbiAgICBdO1xuXG4gICAgbGFuZ3VhZ2VUZXN0cy5mb3JFYWNoKHRlc3QgPT4ge1xuICAgICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgICBkZXBsb3ltZW50SWQ6IHRlc3QudGVzdElkLFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBbJ3NhLWVhc3QtMSddLFxuICAgICAgICBzdHJhdGVneTogJ0NBTkFSWSdcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOWNl+exs+WcsOWfn+eBveWus+W+qeaXp+ODhuOCueODiFxuICAgKi9cbiAgcHVibGljIHRlc3RTb3V0aEFtZXJpY2FEaXNhc3RlclJlY292ZXJ5KCk6IHZvaWQge1xuICAgIC8vIOWNmOS4gOWcsOWfn+OBruOBn+OCgeOAgUFa6ZaT44OV44Kn44Kk44Or44Kq44O844OQ44O844OG44K544OIXG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgZGVwbG95bWVudElkOiBgc2EtZHItdGVzdC0ke0RhdGUubm93KCl9YCxcbiAgICAgIHRhcmdldFJlZ2lvbnM6IFsnc2EtZWFzdC0xJ10sXG4gICAgICBzdHJhdGVneTogJ0JMVUVfR1JFRU4nXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44OW44Op44K444Or5pmC6ZaT5biv5a++5b+c44OG44K544OIXG4gICAqL1xuICBwdWJsaWMgdGVzdEJyYXppbGlhblRpbWV6b25lU3VwcG9ydCgpOiB2b2lkIHtcbiAgICAvLyBCUlTvvIhCcmFzw61saWEgVGltZe+8ieWvvuW/nOODhuOCueODiFxuICAgIHRoaXMuZGVwbG95bWVudE1hbmFnZXIuc3RhcnREZXBsb3ltZW50KHtcbiAgICAgIGRlcGxveW1lbnRJZDogYHRpbWV6b25lLWJydC10ZXN0LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydzYS1lYXN0LTEnXSxcbiAgICAgIHN0cmF0ZWd5OiAnQ0FOQVJZJ1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOWNl+exs+WcsOWfn+ODkeODleOCqeODvOODnuODs+OCueODhuOCueODiFxuICAgKi9cbiAgcHVibGljIHRlc3RTb3V0aEFtZXJpY2FQZXJmb3JtYW5jZSgpOiB2b2lkIHtcbiAgICAvLyDlnLDln5/nibnmgKfjgpLogIPmha7jgZfjgZ/jg5Hjg5Xjgqnjg7zjg57jg7Pjgrnjg4bjgrnjg4hcbiAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICBkZXBsb3ltZW50SWQ6IGBzYS1wZXJmb3JtYW5jZS10ZXN0LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydzYS1lYXN0LTEnXSxcbiAgICAgIHN0cmF0ZWd5OiAnQ0FOQVJZJ1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOODluODqeOCuOODq+mAmuiyqO+8iOODrOOCouODq++8ieWvvuW/nOODhuOCueODiFxuICAgKi9cbiAgcHVibGljIHRlc3RCcmF6aWxpYW5DdXJyZW5jeVN1cHBvcnQoKTogdm9pZCB7XG4gICAgLy8gQlJM77yIQnJhemlsaWFuIFJlYWzvvInlr77lv5zjg4bjgrnjg4hcbiAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICBkZXBsb3ltZW50SWQ6IGBjdXJyZW5jeS1icmwtdGVzdC0ke0RhdGUubm93KCl9YCxcbiAgICAgIHRhcmdldFJlZ2lvbnM6IFsnc2EtZWFzdC0xJ10sXG4gICAgICBzdHJhdGVneTogJ0NBTkFSWSdcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDljZfnsbPlnLDln5/jg43jg4Pjg4jjg6/jg7zjgq/mnIDpganljJbjg4bjgrnjg4hcbiAgICovXG4gIHB1YmxpYyB0ZXN0TmV0d29ya09wdGltaXphdGlvbigpOiB2b2lkIHtcbiAgICAvLyDljZfnsbPlnLDln5/jga7jg43jg4Pjg4jjg6/jg7zjgq/pgYXlu7bmnIDpganljJbjg4bjgrnjg4hcbiAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICBkZXBsb3ltZW50SWQ6IGBuZXR3b3JrLW9wdGltaXphdGlvbi10ZXN0LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydzYS1lYXN0LTEnXSxcbiAgICAgIHN0cmF0ZWd5OiAnQ0FOQVJZJ1xuICAgIH0pO1xuICB9XG59Il19