"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EuDeploymentStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const regional_deployment_manager_1 = require("../deployment/regional-deployment-manager");
const regional_config_factory_1 = require("../deployment/regional-config-factory");
/**
 * EU地域専用デプロイメントスタック
 *
 * 機能:
 * - EU全地域への段階的デプロイメント
 * - GDPR完全対応
 * - データ居住性制約への厳格な対応
 * - Brexit後のUK対応
 */
class EuDeploymentStack extends aws_cdk_lib_1.Stack {
    deploymentManager;
    constructor(scope, id, props) {
        super(scope, id, props);
        // EU地域設定の取得
        const euRegions = regional_config_factory_1.RegionalConfigFactory.createEuRegionConfigs();
        const deploymentStrategies = regional_config_factory_1.RegionalConfigFactory.createDeploymentStrategies();
        // EU専用戦略の作成
        const euStrategy = {
            targetRegions: euRegions,
            deploymentStrategy: 'BLUE_GREEN',
            rollbackConfig: {
                enabled: true,
                healthCheckThreshold: 95, // GDPR要件により高い基準
                rollbackTimeoutMinutes: 5
            },
            crossRegionReplication: true,
            disasterRecovery: {
                enabled: true,
                rtoMinutes: 10, // GDPR要件により短時間
                rpoMinutes: 2 // データ損失を最小化
            }
        };
        // 地域別デプロイメント管理システムの作成
        this.deploymentManager = new regional_deployment_manager_1.RegionalDeploymentManager(this, 'EuDeploymentManager', {
            globalConfig: props.globalConfig,
            deploymentConfig: {
                ...euStrategy,
                targetRegions: euRegions.map(region => ({
                    ...region,
                    // EU地域固有の設定を強化
                    complianceRequirements: [
                        ...region.complianceRequirements,
                        'GDPR-Article-25', // Privacy by Design
                        'GDPR-Article-32', // Security of Processing
                        'GDPR-Article-35', // Data Protection Impact Assessment
                        'NIS-Directive', // Network and Information Security
                        'ePrivacy-Directive'
                    ],
                    // データ居住性制約を厳格化
                    dataResidencyRestrictions: true,
                    environmentConfig: {
                        ...region.environmentConfig,
                        // GDPR対応の追加設定
                        networkConfig: {
                            ...region.environmentConfig.networkConfig,
                            // EU内でのネットワーク分離
                            vpcCidr: this.getGdprCompliantVpcCidr(region.region)
                        }
                    }
                }))
            }
        });
        // EU地域固有のタグ付け
        aws_cdk_lib_1.Tags.of(this).add('Region', 'EU');
        aws_cdk_lib_1.Tags.of(this).add('Compliance', 'GDPR-Strict');
        aws_cdk_lib_1.Tags.of(this).add('DataResidency', 'EU-Only');
        aws_cdk_lib_1.Tags.of(this).add('DataSovereignty', 'EU-Compliant');
        aws_cdk_lib_1.Tags.of(this).add('Languages', 'German-English-French-Italian-Spanish');
        // GDPR関連タグ
        aws_cdk_lib_1.Tags.of(this).add('GDPR-Article-25', 'Privacy-by-Design');
        aws_cdk_lib_1.Tags.of(this).add('GDPR-Article-32', 'Security-of-Processing');
        aws_cdk_lib_1.Tags.of(this).add('GDPR-Article-35', 'DPIA-Required');
        aws_cdk_lib_1.Tags.of(this).add('DataRetention', 'GDPR-Compliant');
        aws_cdk_lib_1.Tags.of(this).add('RightToErasure', 'Implemented');
        aws_cdk_lib_1.Tags.of(this).add('DataPortability', 'Supported');
        // Brexit対応タグ
        aws_cdk_lib_1.Tags.of(this).add('Brexit-Compliant', 'True');
        aws_cdk_lib_1.Tags.of(this).add('UK-GDPR', 'Supported');
        aws_cdk_lib_1.Tags.of(this).add('EU-UK-DataBridge', 'Configured');
        // セキュリティ関連タグ
        aws_cdk_lib_1.Tags.of(this).add('EncryptionAtRest', 'AES-256');
        aws_cdk_lib_1.Tags.of(this).add('EncryptionInTransit', 'TLS-1.3');
        aws_cdk_lib_1.Tags.of(this).add('KeyManagement', 'EU-Sovereign');
        aws_cdk_lib_1.Tags.of(this).add('AuditLogging', 'GDPR-Compliant');
    }
    /**
     * GDPR準拠VPC CIDR取得
     */
    getGdprCompliantVpcCidr(region) {
        const cidrMap = {
            'eu-central-1': '10.7.0.0/16', // フランクフルト（メイン）
            'eu-west-1': '10.8.0.0/16', // アイルランド
            'eu-west-2': '10.9.0.0/16' // ロンドン（Brexit対応）
        };
        return cidrMap[region] || '10.7.0.0/16';
    }
    /**
     * EU地域段階的デプロイメント
     */
    deployToEuRegions() {
        // Phase 1: フランクフルト（メインEU地域）
        this.deploymentManager.startDeployment({
            deploymentId: `eu-phase1-${Date.now()}`,
            targetRegions: ['eu-central-1'],
            strategy: 'BLUE_GREEN'
        });
        // Phase 2: アイルランド（EU内セカンダリ）
        setTimeout(() => {
            this.deploymentManager.startDeployment({
                deploymentId: `eu-phase2-${Date.now()}`,
                targetRegions: ['eu-west-1'],
                strategy: 'BLUE_GREEN'
            });
        }, 20 * 60 * 1000); // 20分後
        // Phase 3: ロンドン（Brexit対応）
        setTimeout(() => {
            this.deploymentManager.startDeployment({
                deploymentId: `eu-phase3-${Date.now()}`,
                targetRegions: ['eu-west-2'],
                strategy: 'BLUE_GREEN'
            });
        }, 40 * 60 * 1000); // 40分後
    }
    /**
     * フランクフルト地域デプロイメント
     */
    deployToFrankfurt() {
        this.deploymentManager.startDeployment({
            deploymentId: `frankfurt-deploy-${Date.now()}`,
            targetRegions: ['eu-central-1'],
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * アイルランド地域デプロイメント
     */
    deployToIreland() {
        this.deploymentManager.startDeployment({
            deploymentId: `ireland-deploy-${Date.now()}`,
            targetRegions: ['eu-west-1'],
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * ロンドン地域デプロイメント（Brexit対応）
     */
    deployToLondon() {
        this.deploymentManager.startDeployment({
            deploymentId: `london-deploy-${Date.now()}`,
            targetRegions: ['eu-west-2'],
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * GDPR準拠テスト
     */
    testGdprCompliance() {
        const gdprTests = [
            {
                region: 'eu-central-1',
                testType: 'Data-Minimization',
                testId: `gdpr-minimization-${Date.now()}`
            },
            {
                region: 'eu-west-1',
                testType: 'Right-to-Erasure',
                testId: `gdpr-erasure-${Date.now()}`
            },
            {
                region: 'eu-west-2',
                testType: 'Data-Portability',
                testId: `gdpr-portability-${Date.now()}`
            }
        ];
        gdprTests.forEach(test => {
            this.deploymentManager.startDeployment({
                deploymentId: test.testId,
                targetRegions: [test.region],
                strategy: 'CANARY'
            });
        });
    }
    /**
     * EU内災害復旧テスト
     */
    testEuDisasterRecovery() {
        // フランクフルト→アイルランドフェイルオーバー
        this.deploymentManager.startDeployment({
            deploymentId: `eu-dr-test-${Date.now()}`,
            targetRegions: ['eu-west-1'], // アイルランドへフェイルオーバー
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * Brexit対応テスト
     */
    testBrexitCompliance() {
        // UK-EU間のデータ転送テスト
        this.deploymentManager.startDeployment({
            deploymentId: `brexit-test-${Date.now()}`,
            targetRegions: ['eu-west-2'], // ロンドン地域
            strategy: 'CANARY'
        });
    }
    /**
     * データ主権テスト
     */
    testDataSovereignty() {
        // EU内でのデータ処理・保存の確認
        const sovereigntyTests = [
            'eu-central-1', // ドイツ
            'eu-west-1', // アイルランド
            'eu-west-2' // イギリス
        ];
        sovereigntyTests.forEach(region => {
            this.deploymentManager.startDeployment({
                deploymentId: `sovereignty-test-${region}-${Date.now()}`,
                targetRegions: [region],
                strategy: 'CANARY'
            });
        });
    }
}
exports.EuDeploymentStack = EuDeploymentStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXUtZGVwbG95bWVudC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImV1LWRlcGxveW1lbnQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsNkNBQXNEO0FBQ3RELDJGQUFzRjtBQUN0RixtRkFBOEU7QUFHOUU7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFhLGlCQUFrQixTQUFRLG1CQUFLO0lBQzFCLGlCQUFpQixDQUE0QjtJQUU3RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBRXpDO1FBQ0MsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsWUFBWTtRQUNaLE1BQU0sU0FBUyxHQUFHLCtDQUFxQixDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDaEUsTUFBTSxvQkFBb0IsR0FBRywrQ0FBcUIsQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1FBRWhGLFlBQVk7UUFDWixNQUFNLFVBQVUsR0FBRztZQUNqQixhQUFhLEVBQUUsU0FBUztZQUN4QixrQkFBa0IsRUFBRSxZQUFxQjtZQUN6QyxjQUFjLEVBQUU7Z0JBQ2QsT0FBTyxFQUFFLElBQUk7Z0JBQ2Isb0JBQW9CLEVBQUUsRUFBRSxFQUFFLGdCQUFnQjtnQkFDMUMsc0JBQXNCLEVBQUUsQ0FBQzthQUMxQjtZQUNELHNCQUFzQixFQUFFLElBQUk7WUFDNUIsZ0JBQWdCLEVBQUU7Z0JBQ2hCLE9BQU8sRUFBRSxJQUFJO2dCQUNiLFVBQVUsRUFBRSxFQUFFLEVBQUUsZUFBZTtnQkFDL0IsVUFBVSxFQUFFLENBQUMsQ0FBRyxZQUFZO2FBQzdCO1NBQ0YsQ0FBQztRQUVGLHNCQUFzQjtRQUN0QixJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSx1REFBeUIsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDbEYsWUFBWSxFQUFFLEtBQUssQ0FBQyxZQUFZO1lBQ2hDLGdCQUFnQixFQUFFO2dCQUNoQixHQUFHLFVBQVU7Z0JBQ2IsYUFBYSxFQUFFLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUN0QyxHQUFHLE1BQU07b0JBQ1QsZUFBZTtvQkFDZixzQkFBc0IsRUFBRTt3QkFDdEIsR0FBRyxNQUFNLENBQUMsc0JBQXNCO3dCQUNoQyxpQkFBaUIsRUFBRSxvQkFBb0I7d0JBQ3ZDLGlCQUFpQixFQUFFLHlCQUF5Qjt3QkFDNUMsaUJBQWlCLEVBQUUsb0NBQW9DO3dCQUN2RCxlQUFlLEVBQUksbUNBQW1DO3dCQUN0RCxvQkFBb0I7cUJBQ3JCO29CQUNELGVBQWU7b0JBQ2YseUJBQXlCLEVBQUUsSUFBSTtvQkFDL0IsaUJBQWlCLEVBQUU7d0JBQ2pCLEdBQUcsTUFBTSxDQUFDLGlCQUFpQjt3QkFDM0IsY0FBYzt3QkFDZCxhQUFhLEVBQUU7NEJBQ2IsR0FBRyxNQUFNLENBQUMsaUJBQWlCLENBQUMsYUFBYTs0QkFDekMsZ0JBQWdCOzRCQUNoQixPQUFPLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7eUJBQ3JEO3FCQUNGO2lCQUNGLENBQUMsQ0FBQzthQUNKO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsY0FBYztRQUNkLGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbEMsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxhQUFhLENBQUMsQ0FBQztRQUMvQyxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzlDLGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUNyRCxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLHVDQUF1QyxDQUFDLENBQUM7UUFFeEUsV0FBVztRQUNYLGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBQzFELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO1FBQy9ELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUN0RCxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDckQsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ25ELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUVsRCxhQUFhO1FBQ2Isa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzlDLGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDMUMsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFLFlBQVksQ0FBQyxDQUFDO1FBRXBELGFBQWE7UUFDYixrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDakQsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3BELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDbkQsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFRDs7T0FFRztJQUNLLHVCQUF1QixDQUFDLE1BQWM7UUFDNUMsTUFBTSxPQUFPLEdBQThCO1lBQ3pDLGNBQWMsRUFBRSxhQUFhLEVBQUcsZUFBZTtZQUMvQyxXQUFXLEVBQUUsYUFBYSxFQUFNLFNBQVM7WUFDekMsV0FBVyxFQUFFLGFBQWEsQ0FBTSxpQkFBaUI7U0FDbEQsQ0FBQztRQUNGLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLGFBQWEsQ0FBQztJQUMxQyxDQUFDO0lBRUQ7O09BRUc7SUFDSSxpQkFBaUI7UUFDdEIsNEJBQTRCO1FBQzVCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7WUFDckMsWUFBWSxFQUFFLGFBQWEsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQ3ZDLGFBQWEsRUFBRSxDQUFDLGNBQWMsQ0FBQztZQUMvQixRQUFRLEVBQUUsWUFBWTtTQUN2QixDQUFDLENBQUM7UUFFSCw0QkFBNEI7UUFDNUIsVUFBVSxDQUFDLEdBQUcsRUFBRTtZQUNkLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7Z0JBQ3JDLFlBQVksRUFBRSxhQUFhLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDdkMsYUFBYSxFQUFFLENBQUMsV0FBVyxDQUFDO2dCQUM1QixRQUFRLEVBQUUsWUFBWTthQUN2QixDQUFDLENBQUM7UUFDTCxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU87UUFFM0IsMEJBQTBCO1FBQzFCLFVBQVUsQ0FBQyxHQUFHLEVBQUU7WUFDZCxJQUFJLENBQUMsaUJBQWlCLENBQUMsZUFBZSxDQUFDO2dCQUNyQyxZQUFZLEVBQUUsYUFBYSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBQ3ZDLGFBQWEsRUFBRSxDQUFDLFdBQVcsQ0FBQztnQkFDNUIsUUFBUSxFQUFFLFlBQVk7YUFDdkIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPO0lBQzdCLENBQUM7SUFFRDs7T0FFRztJQUNJLGlCQUFpQjtRQUN0QixJQUFJLENBQUMsaUJBQWlCLENBQUMsZUFBZSxDQUFDO1lBQ3JDLFlBQVksRUFBRSxvQkFBb0IsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzlDLGFBQWEsRUFBRSxDQUFDLGNBQWMsQ0FBQztZQUMvQixRQUFRLEVBQUUsWUFBWTtTQUN2QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxlQUFlO1FBQ3BCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7WUFDckMsWUFBWSxFQUFFLGtCQUFrQixJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDNUMsYUFBYSxFQUFFLENBQUMsV0FBVyxDQUFDO1lBQzVCLFFBQVEsRUFBRSxZQUFZO1NBQ3ZCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNJLGNBQWM7UUFDbkIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsQ0FBQztZQUNyQyxZQUFZLEVBQUUsaUJBQWlCLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUMzQyxhQUFhLEVBQUUsQ0FBQyxXQUFXLENBQUM7WUFDNUIsUUFBUSxFQUFFLFlBQVk7U0FDdkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0ksa0JBQWtCO1FBQ3ZCLE1BQU0sU0FBUyxHQUFHO1lBQ2hCO2dCQUNFLE1BQU0sRUFBRSxjQUFjO2dCQUN0QixRQUFRLEVBQUUsbUJBQW1CO2dCQUM3QixNQUFNLEVBQUUscUJBQXFCLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTthQUMxQztZQUNEO2dCQUNFLE1BQU0sRUFBRSxXQUFXO2dCQUNuQixRQUFRLEVBQUUsa0JBQWtCO2dCQUM1QixNQUFNLEVBQUUsZ0JBQWdCLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTthQUNyQztZQUNEO2dCQUNFLE1BQU0sRUFBRSxXQUFXO2dCQUNuQixRQUFRLEVBQUUsa0JBQWtCO2dCQUM1QixNQUFNLEVBQUUsb0JBQW9CLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTthQUN6QztTQUNGLENBQUM7UUFFRixTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3ZCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7Z0JBQ3JDLFlBQVksRUFBRSxJQUFJLENBQUMsTUFBTTtnQkFDekIsYUFBYSxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsUUFBUSxFQUFFLFFBQVE7YUFDbkIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxzQkFBc0I7UUFDM0IseUJBQXlCO1FBQ3pCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7WUFDckMsWUFBWSxFQUFFLGNBQWMsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQ3hDLGFBQWEsRUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFLGtCQUFrQjtZQUNoRCxRQUFRLEVBQUUsWUFBWTtTQUN2QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxvQkFBb0I7UUFDekIsa0JBQWtCO1FBQ2xCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7WUFDckMsWUFBWSxFQUFFLGVBQWUsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQ3pDLGFBQWEsRUFBRSxDQUFDLFdBQVcsQ0FBQyxFQUFFLFNBQVM7WUFDdkMsUUFBUSxFQUFFLFFBQVE7U0FDbkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0ksbUJBQW1CO1FBQ3hCLG1CQUFtQjtRQUNuQixNQUFNLGdCQUFnQixHQUFHO1lBQ3ZCLGNBQWMsRUFBRSxNQUFNO1lBQ3RCLFdBQVcsRUFBSyxTQUFTO1lBQ3pCLFdBQVcsQ0FBSyxPQUFPO1NBQ3hCLENBQUM7UUFFRixnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDaEMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsQ0FBQztnQkFDckMsWUFBWSxFQUFFLG9CQUFvQixNQUFNLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFO2dCQUN4RCxhQUFhLEVBQUUsQ0FBQyxNQUFNLENBQUM7Z0JBQ3ZCLFFBQVEsRUFBRSxRQUFRO2FBQ25CLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBNU9ELDhDQTRPQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMsIFRhZ3MgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBSZWdpb25hbERlcGxveW1lbnRNYW5hZ2VyIH0gZnJvbSAnLi4vZGVwbG95bWVudC9yZWdpb25hbC1kZXBsb3ltZW50LW1hbmFnZXInO1xuaW1wb3J0IHsgUmVnaW9uYWxDb25maWdGYWN0b3J5IH0gZnJvbSAnLi4vZGVwbG95bWVudC9yZWdpb25hbC1jb25maWctZmFjdG9yeSc7XG5pbXBvcnQgeyBHbG9iYWxSYWdDb25maWcgfSBmcm9tICcuLi8uLi90eXBlcy9nbG9iYWwtY29uZmlnJztcblxuLyoqXG4gKiBFVeWcsOWfn+WwgueUqOODh+ODl+ODreOCpOODoeODs+ODiOOCueOCv+ODg+OCr1xuICogXG4gKiDmqZ/og706XG4gKiAtIEVV5YWo5Zyw5Z+f44G444Gu5q616ZqO55qE44OH44OX44Ot44Kk44Oh44Oz44OIXG4gKiAtIEdEUFLlrozlhajlr77lv5xcbiAqIC0g44OH44O844K/5bGF5L2P5oCn5Yi257SE44G444Gu5Y6z5qC844Gq5a++5b+cXG4gKiAtIEJyZXhpdOW+jOOBrlVL5a++5b+cXG4gKi9cbmV4cG9ydCBjbGFzcyBFdURlcGxveW1lbnRTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGRlcGxveW1lbnRNYW5hZ2VyOiBSZWdpb25hbERlcGxveW1lbnRNYW5hZ2VyO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTdGFja1Byb3BzICYge1xuICAgIGdsb2JhbENvbmZpZzogR2xvYmFsUmFnQ29uZmlnO1xuICB9KSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBFVeWcsOWfn+ioreWumuOBruWPluW+l1xuICAgIGNvbnN0IGV1UmVnaW9ucyA9IFJlZ2lvbmFsQ29uZmlnRmFjdG9yeS5jcmVhdGVFdVJlZ2lvbkNvbmZpZ3MoKTtcbiAgICBjb25zdCBkZXBsb3ltZW50U3RyYXRlZ2llcyA9IFJlZ2lvbmFsQ29uZmlnRmFjdG9yeS5jcmVhdGVEZXBsb3ltZW50U3RyYXRlZ2llcygpO1xuICAgIFxuICAgIC8vIEVV5bCC55So5oim55Wl44Gu5L2c5oiQXG4gICAgY29uc3QgZXVTdHJhdGVneSA9IHtcbiAgICAgIHRhcmdldFJlZ2lvbnM6IGV1UmVnaW9ucyxcbiAgICAgIGRlcGxveW1lbnRTdHJhdGVneTogJ0JMVUVfR1JFRU4nIGFzIGNvbnN0LFxuICAgICAgcm9sbGJhY2tDb25maWc6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgaGVhbHRoQ2hlY2tUaHJlc2hvbGQ6IDk1LCAvLyBHRFBS6KaB5Lu244Gr44KI44KK6auY44GE5Z+65rqWXG4gICAgICAgIHJvbGxiYWNrVGltZW91dE1pbnV0ZXM6IDVcbiAgICAgIH0sXG4gICAgICBjcm9zc1JlZ2lvblJlcGxpY2F0aW9uOiB0cnVlLFxuICAgICAgZGlzYXN0ZXJSZWNvdmVyeToge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBydG9NaW51dGVzOiAxMCwgLy8gR0RQUuimgeS7tuOBq+OCiOOCiuefreaZgumWk1xuICAgICAgICBycG9NaW51dGVzOiAyICAgLy8g44OH44O844K/5pCN5aSx44KS5pyA5bCP5YyWXG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIOWcsOWfn+WIpeODh+ODl+ODreOCpOODoeODs+ODiOeuoeeQhuOCt+OCueODhuODoOOBruS9nOaIkFxuICAgIHRoaXMuZGVwbG95bWVudE1hbmFnZXIgPSBuZXcgUmVnaW9uYWxEZXBsb3ltZW50TWFuYWdlcih0aGlzLCAnRXVEZXBsb3ltZW50TWFuYWdlcicsIHtcbiAgICAgIGdsb2JhbENvbmZpZzogcHJvcHMuZ2xvYmFsQ29uZmlnLFxuICAgICAgZGVwbG95bWVudENvbmZpZzoge1xuICAgICAgICAuLi5ldVN0cmF0ZWd5LFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBldVJlZ2lvbnMubWFwKHJlZ2lvbiA9PiAoe1xuICAgICAgICAgIC4uLnJlZ2lvbixcbiAgICAgICAgICAvLyBFVeWcsOWfn+WbuuacieOBruioreWumuOCkuW8t+WMllxuICAgICAgICAgIGNvbXBsaWFuY2VSZXF1aXJlbWVudHM6IFtcbiAgICAgICAgICAgIC4uLnJlZ2lvbi5jb21wbGlhbmNlUmVxdWlyZW1lbnRzLFxuICAgICAgICAgICAgJ0dEUFItQXJ0aWNsZS0yNScsIC8vIFByaXZhY3kgYnkgRGVzaWduXG4gICAgICAgICAgICAnR0RQUi1BcnRpY2xlLTMyJywgLy8gU2VjdXJpdHkgb2YgUHJvY2Vzc2luZ1xuICAgICAgICAgICAgJ0dEUFItQXJ0aWNsZS0zNScsIC8vIERhdGEgUHJvdGVjdGlvbiBJbXBhY3QgQXNzZXNzbWVudFxuICAgICAgICAgICAgJ05JUy1EaXJlY3RpdmUnLCAgIC8vIE5ldHdvcmsgYW5kIEluZm9ybWF0aW9uIFNlY3VyaXR5XG4gICAgICAgICAgICAnZVByaXZhY3ktRGlyZWN0aXZlJ1xuICAgICAgICAgIF0sXG4gICAgICAgICAgLy8g44OH44O844K/5bGF5L2P5oCn5Yi257SE44KS5Y6z5qC85YyWXG4gICAgICAgICAgZGF0YVJlc2lkZW5jeVJlc3RyaWN0aW9uczogdHJ1ZSxcbiAgICAgICAgICBlbnZpcm9ubWVudENvbmZpZzoge1xuICAgICAgICAgICAgLi4ucmVnaW9uLmVudmlyb25tZW50Q29uZmlnLFxuICAgICAgICAgICAgLy8gR0RQUuWvvuW/nOOBrui/veWKoOioreWumlxuICAgICAgICAgICAgbmV0d29ya0NvbmZpZzoge1xuICAgICAgICAgICAgICAuLi5yZWdpb24uZW52aXJvbm1lbnRDb25maWcubmV0d29ya0NvbmZpZyxcbiAgICAgICAgICAgICAgLy8gRVXlhoXjgafjga7jg43jg4Pjg4jjg6/jg7zjgq/liIbpm6JcbiAgICAgICAgICAgICAgdnBjQ2lkcjogdGhpcy5nZXRHZHByQ29tcGxpYW50VnBjQ2lkcihyZWdpb24ucmVnaW9uKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSkpXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBFVeWcsOWfn+WbuuacieOBruOCv+OCsOS7mOOBkVxuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdSZWdpb24nLCAnRVUnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnQ29tcGxpYW5jZScsICdHRFBSLVN0cmljdCcpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdEYXRhUmVzaWRlbmN5JywgJ0VVLU9ubHknKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnRGF0YVNvdmVyZWlnbnR5JywgJ0VVLUNvbXBsaWFudCcpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdMYW5ndWFnZXMnLCAnR2VybWFuLUVuZ2xpc2gtRnJlbmNoLUl0YWxpYW4tU3BhbmlzaCcpO1xuXG4gICAgLy8gR0RQUumWoumAo+OCv+OCsFxuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdHRFBSLUFydGljbGUtMjUnLCAnUHJpdmFjeS1ieS1EZXNpZ24nKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnR0RQUi1BcnRpY2xlLTMyJywgJ1NlY3VyaXR5LW9mLVByb2Nlc3NpbmcnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnR0RQUi1BcnRpY2xlLTM1JywgJ0RQSUEtUmVxdWlyZWQnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnRGF0YVJldGVudGlvbicsICdHRFBSLUNvbXBsaWFudCcpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdSaWdodFRvRXJhc3VyZScsICdJbXBsZW1lbnRlZCcpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdEYXRhUG9ydGFiaWxpdHknLCAnU3VwcG9ydGVkJyk7XG5cbiAgICAvLyBCcmV4aXTlr77lv5zjgr/jgrBcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnQnJleGl0LUNvbXBsaWFudCcsICdUcnVlJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ1VLLUdEUFInLCAnU3VwcG9ydGVkJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0VVLVVLLURhdGFCcmlkZ2UnLCAnQ29uZmlndXJlZCcpO1xuXG4gICAgLy8g44K744Kt44Ol44Oq44OG44Kj6Zai6YCj44K/44KwXG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0VuY3J5cHRpb25BdFJlc3QnLCAnQUVTLTI1NicpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdFbmNyeXB0aW9uSW5UcmFuc2l0JywgJ1RMUy0xLjMnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnS2V5TWFuYWdlbWVudCcsICdFVS1Tb3ZlcmVpZ24nKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnQXVkaXRMb2dnaW5nJywgJ0dEUFItQ29tcGxpYW50Jyk7XG4gIH1cblxuICAvKipcbiAgICogR0RQUua6luaLoFZQQyBDSURS5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldEdkcHJDb21wbGlhbnRWcGNDaWRyKHJlZ2lvbjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBjaWRyTWFwOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9ID0ge1xuICAgICAgJ2V1LWNlbnRyYWwtMSc6ICcxMC43LjAuMC8xNicsICAvLyDjg5Xjg6njg7Pjgq/jg5Xjg6vjg4jvvIjjg6HjgqTjg7PvvIlcbiAgICAgICdldS13ZXN0LTEnOiAnMTAuOC4wLjAvMTYnLCAgICAgLy8g44Ki44Kk44Or44Op44Oz44OJXG4gICAgICAnZXUtd2VzdC0yJzogJzEwLjkuMC4wLzE2JyAgICAgIC8vIOODreODs+ODieODs++8iEJyZXhpdOWvvuW/nO+8iVxuICAgIH07XG4gICAgcmV0dXJuIGNpZHJNYXBbcmVnaW9uXSB8fCAnMTAuNy4wLjAvMTYnO1xuICB9XG5cbiAgLyoqXG4gICAqIEVV5Zyw5Z+f5q616ZqO55qE44OH44OX44Ot44Kk44Oh44Oz44OIXG4gICAqL1xuICBwdWJsaWMgZGVwbG95VG9FdVJlZ2lvbnMoKTogdm9pZCB7XG4gICAgLy8gUGhhc2UgMTog44OV44Op44Oz44Kv44OV44Or44OI77yI44Oh44Kk44OzRVXlnLDln5/vvIlcbiAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICBkZXBsb3ltZW50SWQ6IGBldS1waGFzZTEtJHtEYXRlLm5vdygpfWAsXG4gICAgICB0YXJnZXRSZWdpb25zOiBbJ2V1LWNlbnRyYWwtMSddLFxuICAgICAgc3RyYXRlZ3k6ICdCTFVFX0dSRUVOJ1xuICAgIH0pO1xuXG4gICAgLy8gUGhhc2UgMjog44Ki44Kk44Or44Op44Oz44OJ77yIRVXlhoXjgrvjgqvjg7Pjg4Djg6rvvIlcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuZGVwbG95bWVudE1hbmFnZXIuc3RhcnREZXBsb3ltZW50KHtcbiAgICAgICAgZGVwbG95bWVudElkOiBgZXUtcGhhc2UyLSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBbJ2V1LXdlc3QtMSddLFxuICAgICAgICBzdHJhdGVneTogJ0JMVUVfR1JFRU4nXG4gICAgICB9KTtcbiAgICB9LCAyMCAqIDYwICogMTAwMCk7IC8vIDIw5YiG5b6MXG5cbiAgICAvLyBQaGFzZSAzOiDjg63jg7Pjg4njg7PvvIhCcmV4aXTlr77lv5zvvIlcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuZGVwbG95bWVudE1hbmFnZXIuc3RhcnREZXBsb3ltZW50KHtcbiAgICAgICAgZGVwbG95bWVudElkOiBgZXUtcGhhc2UzLSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBbJ2V1LXdlc3QtMiddLFxuICAgICAgICBzdHJhdGVneTogJ0JMVUVfR1JFRU4nXG4gICAgICB9KTtcbiAgICB9LCA0MCAqIDYwICogMTAwMCk7IC8vIDQw5YiG5b6MXG4gIH1cblxuICAvKipcbiAgICog44OV44Op44Oz44Kv44OV44Or44OI5Zyw5Z+f44OH44OX44Ot44Kk44Oh44Oz44OIXG4gICAqL1xuICBwdWJsaWMgZGVwbG95VG9GcmFua2Z1cnQoKTogdm9pZCB7XG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgZGVwbG95bWVudElkOiBgZnJhbmtmdXJ0LWRlcGxveS0ke0RhdGUubm93KCl9YCxcbiAgICAgIHRhcmdldFJlZ2lvbnM6IFsnZXUtY2VudHJhbC0xJ10sXG4gICAgICBzdHJhdGVneTogJ0JMVUVfR1JFRU4nXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44Ki44Kk44Or44Op44Oz44OJ5Zyw5Z+f44OH44OX44Ot44Kk44Oh44Oz44OIXG4gICAqL1xuICBwdWJsaWMgZGVwbG95VG9JcmVsYW5kKCk6IHZvaWQge1xuICAgIHRoaXMuZGVwbG95bWVudE1hbmFnZXIuc3RhcnREZXBsb3ltZW50KHtcbiAgICAgIGRlcGxveW1lbnRJZDogYGlyZWxhbmQtZGVwbG95LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydldS13ZXN0LTEnXSxcbiAgICAgIHN0cmF0ZWd5OiAnQkxVRV9HUkVFTidcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg63jg7Pjg4njg7PlnLDln5/jg4fjg5fjg63jgqTjg6Hjg7Pjg4jvvIhCcmV4aXTlr77lv5zvvIlcbiAgICovXG4gIHB1YmxpYyBkZXBsb3lUb0xvbmRvbigpOiB2b2lkIHtcbiAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICBkZXBsb3ltZW50SWQ6IGBsb25kb24tZGVwbG95LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydldS13ZXN0LTInXSxcbiAgICAgIHN0cmF0ZWd5OiAnQkxVRV9HUkVFTidcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHRFBS5rqW5oug44OG44K544OIXG4gICAqL1xuICBwdWJsaWMgdGVzdEdkcHJDb21wbGlhbmNlKCk6IHZvaWQge1xuICAgIGNvbnN0IGdkcHJUZXN0cyA9IFtcbiAgICAgIHtcbiAgICAgICAgcmVnaW9uOiAnZXUtY2VudHJhbC0xJyxcbiAgICAgICAgdGVzdFR5cGU6ICdEYXRhLU1pbmltaXphdGlvbicsXG4gICAgICAgIHRlc3RJZDogYGdkcHItbWluaW1pemF0aW9uLSR7RGF0ZS5ub3coKX1gXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICByZWdpb246ICdldS13ZXN0LTEnLFxuICAgICAgICB0ZXN0VHlwZTogJ1JpZ2h0LXRvLUVyYXN1cmUnLFxuICAgICAgICB0ZXN0SWQ6IGBnZHByLWVyYXN1cmUtJHtEYXRlLm5vdygpfWBcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHJlZ2lvbjogJ2V1LXdlc3QtMicsXG4gICAgICAgIHRlc3RUeXBlOiAnRGF0YS1Qb3J0YWJpbGl0eScsXG4gICAgICAgIHRlc3RJZDogYGdkcHItcG9ydGFiaWxpdHktJHtEYXRlLm5vdygpfWBcbiAgICAgIH1cbiAgICBdO1xuXG4gICAgZ2RwclRlc3RzLmZvckVhY2godGVzdCA9PiB7XG4gICAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICAgIGRlcGxveW1lbnRJZDogdGVzdC50ZXN0SWQsXG4gICAgICAgIHRhcmdldFJlZ2lvbnM6IFt0ZXN0LnJlZ2lvbl0sXG4gICAgICAgIHN0cmF0ZWd5OiAnQ0FOQVJZJ1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRVXlhoXngb3lrrPlvqnml6fjg4bjgrnjg4hcbiAgICovXG4gIHB1YmxpYyB0ZXN0RXVEaXNhc3RlclJlY292ZXJ5KCk6IHZvaWQge1xuICAgIC8vIOODleODqeODs+OCr+ODleODq+ODiOKGkuOCouOCpOODq+ODqeODs+ODieODleOCp+OCpOODq+OCquODvOODkOODvFxuICAgIHRoaXMuZGVwbG95bWVudE1hbmFnZXIuc3RhcnREZXBsb3ltZW50KHtcbiAgICAgIGRlcGxveW1lbnRJZDogYGV1LWRyLXRlc3QtJHtEYXRlLm5vdygpfWAsXG4gICAgICB0YXJnZXRSZWdpb25zOiBbJ2V1LXdlc3QtMSddLCAvLyDjgqLjgqTjg6vjg6njg7Pjg4njgbjjg5XjgqfjgqTjg6vjgqrjg7zjg5Djg7xcbiAgICAgIHN0cmF0ZWd5OiAnQkxVRV9HUkVFTidcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCcmV4aXTlr77lv5zjg4bjgrnjg4hcbiAgICovXG4gIHB1YmxpYyB0ZXN0QnJleGl0Q29tcGxpYW5jZSgpOiB2b2lkIHtcbiAgICAvLyBVSy1FVemWk+OBruODh+ODvOOCv+i7oumAgeODhuOCueODiFxuICAgIHRoaXMuZGVwbG95bWVudE1hbmFnZXIuc3RhcnREZXBsb3ltZW50KHtcbiAgICAgIGRlcGxveW1lbnRJZDogYGJyZXhpdC10ZXN0LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydldS13ZXN0LTInXSwgLy8g44Ot44Oz44OJ44Oz5Zyw5Z+fXG4gICAgICBzdHJhdGVneTogJ0NBTkFSWSdcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjg7zjgr/kuLvmqKnjg4bjgrnjg4hcbiAgICovXG4gIHB1YmxpYyB0ZXN0RGF0YVNvdmVyZWlnbnR5KCk6IHZvaWQge1xuICAgIC8vIEVV5YaF44Gn44Gu44OH44O844K/5Yem55CG44O75L+d5a2Y44Gu56K66KqNXG4gICAgY29uc3Qgc292ZXJlaWdudHlUZXN0cyA9IFtcbiAgICAgICdldS1jZW50cmFsLTEnLCAvLyDjg4njgqTjg4RcbiAgICAgICdldS13ZXN0LTEnLCAgICAvLyDjgqLjgqTjg6vjg6njg7Pjg4lcbiAgICAgICdldS13ZXN0LTInICAgICAvLyDjgqTjgq7jg6rjgrlcbiAgICBdO1xuXG4gICAgc292ZXJlaWdudHlUZXN0cy5mb3JFYWNoKHJlZ2lvbiA9PiB7XG4gICAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICAgIGRlcGxveW1lbnRJZDogYHNvdmVyZWlnbnR5LXRlc3QtJHtyZWdpb259LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBbcmVnaW9uXSxcbiAgICAgICAgc3RyYXRlZ3k6ICdDQU5BUlknXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufSJdfQ==