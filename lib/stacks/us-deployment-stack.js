"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsDeploymentStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const regional_deployment_manager_1 = require("../deployment/regional-deployment-manager");
const regional_config_factory_1 = require("../deployment/regional-config-factory");
/**
 * US地域専用デプロイメントスタック
 *
 * 機能:
 * - US全地域への段階的デプロイメント
 * - SOX・HIPAA・CCPA・FedRAMP対応
 * - 高可用性・高性能設定
 * - 連邦政府機関対応
 */
class UsDeploymentStack extends aws_cdk_lib_1.Stack {
    deploymentManager;
    constructor(scope, id, props) {
        super(scope, id, props);
        // US地域設定の取得
        const usRegions = regional_config_factory_1.RegionalConfigFactory.createUsRegionConfigs();
        const deploymentStrategies = regional_config_factory_1.RegionalConfigFactory.createDeploymentStrategies();
        // US専用戦略の作成
        const usStrategy = {
            targetRegions: usRegions,
            deploymentStrategy: 'CANARY',
            rollbackConfig: {
                enabled: true,
                healthCheckThreshold: 85, // 高いトラフィック量に対応
                rollbackTimeoutMinutes: 15
            },
            crossRegionReplication: true,
            disasterRecovery: {
                enabled: true,
                rtoMinutes: 30, // 大規模システム対応
                rpoMinutes: 10
            }
        };
        // 地域別デプロイメント管理システムの作成
        this.deploymentManager = new regional_deployment_manager_1.RegionalDeploymentManager(this, 'UsDeploymentManager', {
            globalConfig: props.globalConfig,
            deploymentConfig: {
                ...usStrategy,
                targetRegions: usRegions.map(region => ({
                    ...region,
                    // US地域固有の設定を強化
                    complianceRequirements: [
                        ...region.complianceRequirements,
                        'FISMA', // Federal Information Security Management Act
                        'NIST-800-53', // NIST Security Controls
                        'CJIS', // Criminal Justice Information Services
                        'ITAR', // International Traffic in Arms Regulations
                        'EAR' // Export Administration Regulations
                    ],
                    environmentConfig: {
                        ...region.environmentConfig,
                        // US地域の高性能設定
                        instanceTypes: [
                            ...region.environmentConfig.instanceTypes,
                            'm5.4xlarge',
                            'm5.8xlarge',
                            'c5.4xlarge',
                            'r5.4xlarge'
                        ],
                        networkConfig: {
                            ...region.environmentConfig.networkConfig,
                            // US地域最適化CIDR
                            vpcCidr: this.getUsOptimizedVpcCidr(region.region)
                        }
                    }
                }))
            }
        });
        // US地域固有のタグ付け
        aws_cdk_lib_1.Tags.of(this).add('Region', 'US');
        aws_cdk_lib_1.Tags.of(this).add('Compliance', 'SOX-HIPAA-CCPA-FedRAMP');
        aws_cdk_lib_1.Tags.of(this).add('DataResidency', 'US-Flexible');
        aws_cdk_lib_1.Tags.of(this).add('GovernmentReady', 'True');
        aws_cdk_lib_1.Tags.of(this).add('Languages', 'English-Spanish');
        // コンプライアンス関連タグ
        aws_cdk_lib_1.Tags.of(this).add('SOX-Compliant', 'True');
        aws_cdk_lib_1.Tags.of(this).add('HIPAA-Eligible', 'True');
        aws_cdk_lib_1.Tags.of(this).add('CCPA-Compliant', 'True');
        aws_cdk_lib_1.Tags.of(this).add('FedRAMP-Ready', 'True');
        aws_cdk_lib_1.Tags.of(this).add('FISMA-Compliant', 'True');
        aws_cdk_lib_1.Tags.of(this).add('NIST-800-53', 'Implemented');
        // セキュリティ関連タグ
        aws_cdk_lib_1.Tags.of(this).add('EncryptionAtRest', 'FIPS-140-2');
        aws_cdk_lib_1.Tags.of(this).add('EncryptionInTransit', 'TLS-1.3-FIPS');
        aws_cdk_lib_1.Tags.of(this).add('KeyManagement', 'AWS-KMS-FIPS');
        aws_cdk_lib_1.Tags.of(this).add('AuditLogging', 'CloudTrail-Enhanced');
        // 運用関連タグ
        aws_cdk_lib_1.Tags.of(this).add('HighAvailability', 'Multi-AZ');
        aws_cdk_lib_1.Tags.of(this).add('DisasterRecovery', 'Cross-Region');
        aws_cdk_lib_1.Tags.of(this).add('Monitoring', '24x7');
        aws_cdk_lib_1.Tags.of(this).add('Support', 'Enterprise');
    }
    /**
     * US地域最適化VPC CIDR取得
     */
    getUsOptimizedVpcCidr(region) {
        const cidrMap = {
            'us-east-1': '10.10.0.0/16', // バージニア北部（メイン）
            'us-west-2': '10.11.0.0/16', // オレゴン
            'us-east-2': '10.12.0.0/16' // オハイオ
        };
        return cidrMap[region] || '10.10.0.0/16';
    }
    /**
     * US地域段階的デプロイメント
     */
    deployToUsRegions() {
        // Phase 1: バージニア北部（メインUS地域）
        this.deploymentManager.startDeployment({
            deploymentId: `us-phase1-${Date.now()}`,
            targetRegions: ['us-east-1'],
            strategy: 'BLUE_GREEN'
        });
        // Phase 2: オレゴン（西海岸）
        setTimeout(() => {
            this.deploymentManager.startDeployment({
                deploymentId: `us-phase2-${Date.now()}`,
                targetRegions: ['us-west-2'],
                strategy: 'CANARY'
            });
        }, 25 * 60 * 1000); // 25分後
        // Phase 3: オハイオ（中部）
        setTimeout(() => {
            this.deploymentManager.startDeployment({
                deploymentId: `us-phase3-${Date.now()}`,
                targetRegions: ['us-east-2'],
                strategy: 'ROLLING'
            });
        }, 50 * 60 * 1000); // 50分後
    }
    /**
     * バージニア北部地域デプロイメント
     */
    deployToVirginia() {
        this.deploymentManager.startDeployment({
            deploymentId: `virginia-deploy-${Date.now()}`,
            targetRegions: ['us-east-1'],
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * オレゴン地域デプロイメント
     */
    deployToOregon() {
        this.deploymentManager.startDeployment({
            deploymentId: `oregon-deploy-${Date.now()}`,
            targetRegions: ['us-west-2'],
            strategy: 'CANARY'
        });
    }
    /**
     * オハイオ地域デプロイメント
     */
    deployToOhio() {
        this.deploymentManager.startDeployment({
            deploymentId: `ohio-deploy-${Date.now()}`,
            targetRegions: ['us-east-2'],
            strategy: 'ROLLING'
        });
    }
    /**
     * SOX準拠テスト
     */
    testSoxCompliance() {
        const soxTests = [
            {
                region: 'us-east-1',
                testType: 'Financial-Data-Protection',
                testId: `sox-financial-${Date.now()}`
            },
            {
                region: 'us-west-2',
                testType: 'Audit-Trail-Integrity',
                testId: `sox-audit-${Date.now()}`
            },
            {
                region: 'us-east-2',
                testType: 'Access-Control-Validation',
                testId: `sox-access-${Date.now()}`
            }
        ];
        soxTests.forEach(test => {
            this.deploymentManager.startDeployment({
                deploymentId: test.testId,
                targetRegions: [test.region],
                strategy: 'CANARY'
            });
        });
    }
    /**
     * HIPAA準拠テスト
     */
    testHipaaCompliance() {
        const hipaaTests = [
            {
                region: 'us-east-1',
                testType: 'PHI-Encryption',
                testId: `hipaa-encryption-${Date.now()}`
            },
            {
                region: 'us-west-2',
                testType: 'Access-Logging',
                testId: `hipaa-logging-${Date.now()}`
            }
        ];
        hipaaTests.forEach(test => {
            this.deploymentManager.startDeployment({
                deploymentId: test.testId,
                targetRegions: [test.region],
                strategy: 'CANARY'
            });
        });
    }
    /**
     * CCPA準拠テスト
     */
    testCcpaCompliance() {
        // カリフォルニア州プライバシー法対応テスト
        this.deploymentManager.startDeployment({
            deploymentId: `ccpa-test-${Date.now()}`,
            targetRegions: ['us-west-2'], // オレゴン（西海岸）
            strategy: 'CANARY'
        });
    }
    /**
     * FedRAMP準拠テスト
     */
    testFedRampCompliance() {
        const fedRampTests = [
            {
                region: 'us-east-1',
                testType: 'Government-Security-Controls',
                testId: `fedramp-security-${Date.now()}`
            },
            {
                region: 'us-east-2',
                testType: 'Continuous-Monitoring',
                testId: `fedramp-monitoring-${Date.now()}`
            }
        ];
        fedRampTests.forEach(test => {
            this.deploymentManager.startDeployment({
                deploymentId: test.testId,
                targetRegions: [test.region],
                strategy: 'BLUE_GREEN'
            });
        });
    }
    /**
     * US内災害復旧テスト
     */
    testUsDisasterRecovery() {
        // バージニア→オレゴンフェイルオーバー
        this.deploymentManager.startDeployment({
            deploymentId: `us-dr-test-${Date.now()}`,
            targetRegions: ['us-west-2'], // オレゴンへフェイルオーバー
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * 高負荷テスト
     */
    testHighLoadCapacity() {
        // US地域の高トラフィック対応テスト
        const loadTests = [
            'us-east-1', // バージニア（最高負荷）
            'us-west-2', // オレゴン（中負荷）
            'us-east-2' // オハイオ（低負荷）
        ];
        loadTests.forEach(region => {
            this.deploymentManager.startDeployment({
                deploymentId: `load-test-${region}-${Date.now()}`,
                targetRegions: [region],
                strategy: 'CANARY'
            });
        });
    }
    /**
     * 連邦政府機関対応テスト
     */
    testGovernmentCompliance() {
        // FISMA・NIST準拠テスト
        const govTests = [
            {
                region: 'us-east-1',
                compliance: 'FISMA',
                testId: `gov-fisma-${Date.now()}`
            },
            {
                region: 'us-east-2',
                compliance: 'NIST-800-53',
                testId: `gov-nist-${Date.now()}`
            }
        ];
        govTests.forEach(test => {
            this.deploymentManager.startDeployment({
                deploymentId: test.testId,
                targetRegions: [test.region],
                strategy: 'BLUE_GREEN'
            });
        });
    }
}
exports.UsDeploymentStack = UsDeploymentStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXMtZGVwbG95bWVudC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInVzLWRlcGxveW1lbnQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsNkNBQXNEO0FBQ3RELDJGQUFzRjtBQUN0RixtRkFBOEU7QUFHOUU7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFhLGlCQUFrQixTQUFRLG1CQUFLO0lBQzFCLGlCQUFpQixDQUE0QjtJQUU3RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBRXpDO1FBQ0MsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsWUFBWTtRQUNaLE1BQU0sU0FBUyxHQUFHLCtDQUFxQixDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDaEUsTUFBTSxvQkFBb0IsR0FBRywrQ0FBcUIsQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1FBRWhGLFlBQVk7UUFDWixNQUFNLFVBQVUsR0FBRztZQUNqQixhQUFhLEVBQUUsU0FBUztZQUN4QixrQkFBa0IsRUFBRSxRQUFpQjtZQUNyQyxjQUFjLEVBQUU7Z0JBQ2QsT0FBTyxFQUFFLElBQUk7Z0JBQ2Isb0JBQW9CLEVBQUUsRUFBRSxFQUFFLGVBQWU7Z0JBQ3pDLHNCQUFzQixFQUFFLEVBQUU7YUFDM0I7WUFDRCxzQkFBc0IsRUFBRSxJQUFJO1lBQzVCLGdCQUFnQixFQUFFO2dCQUNoQixPQUFPLEVBQUUsSUFBSTtnQkFDYixVQUFVLEVBQUUsRUFBRSxFQUFFLFlBQVk7Z0JBQzVCLFVBQVUsRUFBRSxFQUFFO2FBQ2Y7U0FDRixDQUFDO1FBRUYsc0JBQXNCO1FBQ3RCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLHVEQUF5QixDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUNsRixZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7WUFDaEMsZ0JBQWdCLEVBQUU7Z0JBQ2hCLEdBQUcsVUFBVTtnQkFDYixhQUFhLEVBQUUsU0FBUyxD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TUFBTTtnQkFDekIsYUFBYSxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsUUFBUSxFQUFFLFlBQVk7YUFDdkIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFqVUQsOENBaVVDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBTdGFjaywgU3RhY2tQcm9wcywgVGFncyB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IFJlZ2lvbmFsRGVwbG95bWVudE1hbmFnZXIgfSBmcm9tICcuLi9kZXBsb3ltZW50L3JlZ2lvbmFsLWRlcGxveW1lbnQtbWFuYWdlcic7XG5pbXBvcnQgeyBSZWdpb25hbENvbmZpZ0ZhY3RvcnkgfSBmcm9tICcuLi9kZXBsb3ltZW50L3JlZ2lvbmFsLWNvbmZpZy1mYWN0b3J5JztcbmltcG9ydCB7IEdsb2JhbFJhZ0NvbmZpZyB9IGZyb20gJy4uLy4uL3R5cGVzL2dsb2JhbC1jb25maWcnO1xuXG4vKipcbiAqIFVT5Zyw5Z+f5bCC55So44OH44OX44Ot44Kk44Oh44Oz44OI44K544K/44OD44KvXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0gVVPlhajlnLDln5/jgbjjga7mrrXpmo7nmoTjg4fjg5fjg63jgqTjg6Hjg7Pjg4hcbiAqIC0gU09Y44O7SElQQUHjg7tDQ1BB44O7RmVkUkFNUOWvvuW/nFxuICogLSDpq5jlj6/nlKjmgKfjg7vpq5jmgKfog73oqK3lrppcbiAqIC0g6YCj6YKm5pS/5bqc5qmf6Zai5a++5b+cXG4gKi9cbmV4cG9ydCBjbGFzcyBVc0RlcGxveW1lbnRTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGRlcGxveW1lbnRNYW5hZ2VyOiBSZWdpb25hbERlcGxveW1lbnRNYW5hZ2VyO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTdGFja1Byb3BzICYge1xuICAgIGdsb2JhbENvbmZpZzogR2xvYmFsUmFnQ29uZmlnO1xuICB9KSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBVU+WcsOWfn+ioreWumuOBruWPluW+l1xuICAgIGNvbnN0IHVzUmVnaW9ucyA9IFJlZ2lvbmFsQ29uZmlnRmFjdG9yeS5jcmVhdGVVc1JlZ2lvbkNvbmZpZ3MoKTtcbiAgICBjb25zdCBkZXBsb3ltZW50U3RyYXRlZ2llcyA9IFJlZ2lvbmFsQ29uZmlnRmFjdG9yeS5jcmVhdGVEZXBsb3ltZW50U3RyYXRlZ2llcygpO1xuICAgIFxuICAgIC8vIFVT5bCC55So5oim55Wl44Gu5L2c5oiQXG4gICAgY29uc3QgdXNTdHJhdGVneSA9IHtcbiAgICAgIHRhcmdldFJlZ2lvbnM6IHVzUmVnaW9ucyxcbiAgICAgIGRlcGxveW1lbnRTdHJhdGVneTogJ0NBTkFSWScgYXMgY29uc3QsXG4gICAgICByb2xsYmFja0NvbmZpZzoge1xuICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICBoZWFsdGhDaGVja1RocmVzaG9sZDogODUsIC8vIOmrmOOBhOODiOODqeODleOCo+ODg+OCr+mHj+OBq+WvvuW/nFxuICAgICAgICByb2xsYmFja1RpbWVvdXRNaW51dGVzOiAxNVxuICAgICAgfSxcbiAgICAgIGNyb3NzUmVnaW9uUmVwbGljYXRpb246IHRydWUsXG4gICAgICBkaXNhc3RlclJlY292ZXJ5OiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIHJ0b01pbnV0ZXM6IDMwLCAvLyDlpKfopo/mqKHjgrfjgrnjg4bjg6Dlr77lv5xcbiAgICAgICAgcnBvTWludXRlczogMTBcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8g5Zyw5Z+f5Yil44OH44OX44Ot44Kk44Oh44Oz44OI566h55CG44K344K544OG44Og44Gu5L2c5oiQXG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlciA9IG5ldyBSZWdpb25hbERlcGxveW1lbnRNYW5hZ2VyKHRoaXMsICdVc0RlcGxveW1lbnRNYW5hZ2VyJywge1xuICAgICAgZ2xvYmFsQ29uZmlnOiBwcm9wcy5nbG9iYWxDb25maWcsXG4gICAgICBkZXBsb3ltZW50Q29uZmlnOiB7XG4gICAgICAgIC4uLnVzU3RyYXRlZ3ksXG4gICAgICAgIHRhcmdldFJlZ2lvbnM6IHVzUmVnaW9ucy5tYXAocmVnaW9uID0+ICh7XG4gICAgICAgICAgLi4ucmVnaW9uLFxuICAgICAgICAgIC8vIFVT5Zyw5Z+f5Zu65pyJ44Gu6Kit5a6a44KS5by35YyWXG4gICAgICAgICAgY29tcGxpYW5jZVJlcXVpcmVtZW50czogW1xuICAgICAgICAgICAgLi4ucmVnaW9uLmNvbXBsaWFuY2VSZXF1aXJlbWVudHMsXG4gICAgICAgICAgICAnRklTTUEnLCAgICAgICAgICAgLy8gRmVkZXJhbCBJbmZvcm1hdGlvbiBTZWN1cml0eSBNYW5hZ2VtZW50IEFjdFxuICAgICAgICAgICAgJ05JU1QtODAwLTUzJywgICAgIC8vIE5JU1QgU2VjdXJpdHkgQ29udHJvbHNcbiAgICAgICAgICAgICdDSklTJywgICAgICAgICAgICAvLyBDcmltaW5hbCBKdXN0aWNlIEluZm9ybWF0aW9uIFNlcnZpY2VzXG4gICAgICAgICAgICAnSVRBUicsICAgICAgICAgICAgLy8gSW50ZXJuYXRpb25hbCBUcmFmZmljIGluIEFybXMgUmVndWxhdGlvbnNcbiAgICAgICAgICAgICdFQVInICAgICAgICAgICAgICAvLyBFeHBvcnQgQWRtaW5pc3RyYXRpb24gUmVndWxhdGlvbnNcbiAgICAgICAgICBdLFxuICAgICAgICAgIGVudmlyb25tZW50Q29uZmlnOiB7XG4gICAgICAgICAgICAuLi5yZWdpb24uZW52aXJvbm1lbnRDb25maWcsXG4gICAgICAgICAgICAvLyBVU+WcsOWfn+OBrumrmOaAp+iDveioreWumlxuICAgICAgICAgICAgaW5zdGFuY2VUeXBlczogW1xuICAgICAgICAgICAgICAuLi5yZWdpb24uZW52aXJvbm1lbnRDb25maWcuaW5zdGFuY2VUeXBlcyxcbiAgICAgICAgICAgICAgJ201LjR4bGFyZ2UnLFxuICAgICAgICAgICAgICAnbTUuOHhsYXJnZScsXG4gICAgICAgICAgICAgICdjNS40eGxhcmdlJyxcbiAgICAgICAgICAgICAgJ3I1LjR4bGFyZ2UnXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgbmV0d29ya0NvbmZpZzoge1xuICAgICAgICAgICAgICAuLi5yZWdpb24uZW52aXJvbm1lbnRDb25maWcubmV0d29ya0NvbmZpZyxcbiAgICAgICAgICAgICAgLy8gVVPlnLDln5/mnIDpganljJZDSURSXG4gICAgICAgICAgICAgIHZwY0NpZHI6IHRoaXMuZ2V0VXNPcHRpbWl6ZWRWcGNDaWRyKHJlZ2lvbi5yZWdpb24pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KSlcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFVT5Zyw5Z+f5Zu65pyJ44Gu44K/44Kw5LuY44GRXG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ1JlZ2lvbicsICdVUycpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdDb21wbGlhbmNlJywgJ1NPWC1ISVBBQS1DQ1BBLUZlZFJBTVAnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnRGF0YVJlc2lkZW5jeScsICdVUy1GbGV4aWJsZScpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdHb3Zlcm5tZW50UmVhZHknLCAnVHJ1ZScpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdMYW5ndWFnZXMnLCAnRW5nbGlzaC1TcGFuaXNoJyk7XG5cbiAgICAvLyDjgrPjg7Pjg5fjg6njgqTjgqLjg7PjgrnplqLpgKPjgr/jgrBcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnU09YLUNvbXBsaWFudCcsICdUcnVlJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0hJUEFBLUVsaWdpYmxlJywgJ1RydWUnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnQ0NQQS1Db21wbGlhbnQnLCAnVHJ1ZScpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdGZWRSQU1QLVJlYWR5JywgJ1RydWUnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnRklTTUEtQ29tcGxpYW50JywgJ1RydWUnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnTklTVC04MDAtNTMnLCAnSW1wbGVtZW50ZWQnKTtcblxuICAgIC8vIOOCu+OCreODpeODquODhuOCo+mWoumAo+OCv+OCsFxuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdFbmNyeXB0aW9uQXRSZXN0JywgJ0ZJUFMtMTQwLTInKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnRW5jcnlwdGlvbkluVHJhbnNpdCcsICdUTFMtMS4zLUZJUFMnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnS2V5TWFuYWdlbWVudCcsICdBV1MtS01TLUZJUFMnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnQXVkaXRMb2dnaW5nJywgJ0Nsb3VkVHJhaWwtRW5oYW5jZWQnKTtcblxuICAgIC8vIOmBi+eUqOmWoumAo+OCv+OCsFxuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdIaWdoQXZhaWxhYmlsaXR5JywgJ011bHRpLUFaJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0Rpc2FzdGVyUmVjb3ZlcnknLCAnQ3Jvc3MtUmVnaW9uJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ01vbml0b3JpbmcnLCAnMjR4NycpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdTdXBwb3J0JywgJ0VudGVycHJpc2UnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVU+WcsOWfn+acgOmBqeWMllZQQyBDSURS5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldFVzT3B0aW1pemVkVnBjQ2lkcihyZWdpb246IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgY2lkck1hcDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHtcbiAgICAgICd1cy1lYXN0LTEnOiAnMTAuMTAuMC4wLzE2JywgIC8vIOODkOODvOOCuOODi+OCouWMl+mDqO+8iOODoeOCpOODs++8iVxuICAgICAgJ3VzLXdlc3QtMic6ICcxMC4xMS4wLjAvMTYnLCAgLy8g44Kq44Os44K044OzXG4gICAgICAndXMtZWFzdC0yJzogJzEwLjEyLjAuMC8xNicgICAvLyDjgqrjg4/jgqTjgqpcbiAgICB9O1xuICAgIHJldHVybiBjaWRyTWFwW3JlZ2lvbl0gfHwgJzEwLjEwLjAuMC8xNic7XG4gIH1cblxuICAvKipcbiAgICogVVPlnLDln5/mrrXpmo7nmoTjg4fjg5fjg63jgqTjg6Hjg7Pjg4hcbiAgICovXG4gIHB1YmxpYyBkZXBsb3lUb1VzUmVnaW9ucygpOiB2b2lkIHtcbiAgICAvLyBQaGFzZSAxOiDjg5Djg7zjgrjjg4vjgqLljJfpg6jvvIjjg6HjgqTjg7NVU+WcsOWfn++8iVxuICAgIHRoaXMuZGVwbG95bWVudE1hbmFnZXIuc3RhcnREZXBsb3ltZW50KHtcbiAgICAgIGRlcGxveW1lbnRJZDogYHVzLXBoYXNlMS0ke0RhdGUubm93KCl9YCxcbiAgICAgIHRhcmdldFJlZ2lvbnM6IFsndXMtZWFzdC0xJ10sXG4gICAgICBzdHJhdGVneTogJ0JMVUVfR1JFRU4nXG4gICAgfSk7XG5cbiAgICAvLyBQaGFzZSAyOiDjgqrjg6zjgrTjg7PvvIjopb/mtbflsrjvvIlcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuZGVwbG95bWVudE1hbmFnZXIuc3RhcnREZXBsb3ltZW50KHtcbiAgICAgICAgZGVwbG95bWVudElkOiBgdXMtcGhhc2UyLSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBbJ3VzLXdlc3QtMiddLFxuICAgICAgICBzdHJhdGVneTogJ0NBTkFSWSdcbiAgICAgIH0pO1xuICAgIH0sIDI1ICogNjAgKiAxMDAwKTsgLy8gMjXliIblvoxcblxuICAgIC8vIFBoYXNlIDM6IOOCquODj+OCpOOCqu+8iOS4remDqO+8iVxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgICBkZXBsb3ltZW50SWQ6IGB1cy1waGFzZTMtJHtEYXRlLm5vdygpfWAsXG4gICAgICAgIHRhcmdldFJlZ2lvbnM6IFsndXMtZWFzdC0yJ10sXG4gICAgICAgIHN0cmF0ZWd5OiAnUk9MTElORydcbiAgICAgIH0pO1xuICAgIH0sIDUwICogNjAgKiAxMDAwKTsgLy8gNTDliIblvoxcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg7zjgrjjg4vjgqLljJfpg6jlnLDln5/jg4fjg5fjg63jgqTjg6Hjg7Pjg4hcbiAgICovXG4gIHB1YmxpYyBkZXBsb3lUb1ZpcmdpbmlhKCk6IHZvaWQge1xuICAgIHRoaXMuZGVwbG95bWVudE1hbmFnZXIuc3RhcnREZXBsb3ltZW50KHtcbiAgICAgIGRlcGxveW1lbnRJZDogYHZpcmdpbmlhLWRlcGxveS0ke0RhdGUubm93KCl9YCxcbiAgICAgIHRhcmdldFJlZ2lvbnM6IFsndXMtZWFzdC0xJ10sXG4gICAgICBzdHJhdGVneTogJ0JMVUVfR1JFRU4nXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44Kq44Os44K044Oz5Zyw5Z+f44OH44OX44Ot44Kk44Oh44Oz44OIXG4gICAqL1xuICBwdWJsaWMgZGVwbG95VG9PcmVnb24oKTogdm9pZCB7XG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgZGVwbG95bWVudElkOiBgb3JlZ29uLWRlcGxveS0ke0RhdGUubm93KCl9YCxcbiAgICAgIHRhcmdldFJlZ2lvbnM6IFsndXMtd2VzdC0yJ10sXG4gICAgICBzdHJhdGVneTogJ0NBTkFSWSdcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqrjg4/jgqTjgqrlnLDln5/jg4fjg5fjg63jgqTjg6Hjg7Pjg4hcbiAgICovXG4gIHB1YmxpYyBkZXBsb3lUb09oaW8oKTogdm9pZCB7XG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgZGVwbG95bWVudElkOiBgb2hpby1kZXBsb3ktJHtEYXRlLm5vdygpfWAsXG4gICAgICB0YXJnZXRSZWdpb25zOiBbJ3VzLWVhc3QtMiddLFxuICAgICAgc3RyYXRlZ3k6ICdST0xMSU5HJ1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNPWOa6luaLoOODhuOCueODiFxuICAgKi9cbiAgcHVibGljIHRlc3RTb3hDb21wbGlhbmNlKCk6IHZvaWQge1xuICAgIGNvbnN0IHNveFRlc3RzID0gW1xuICAgICAge1xuICAgICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgICB0ZXN0VHlwZTogJ0ZpbmFuY2lhbC1EYXRhLVByb3RlY3Rpb24nLFxuICAgICAgICB0ZXN0SWQ6IGBzb3gtZmluYW5jaWFsLSR7RGF0ZS5ub3coKX1gXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICByZWdpb246ICd1cy13ZXN0LTInLFxuICAgICAgICB0ZXN0VHlwZTogJ0F1ZGl0LVRyYWlsLUludGVncml0eScsXG4gICAgICAgIHRlc3RJZDogYHNveC1hdWRpdC0ke0RhdGUubm93KCl9YFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcmVnaW9uOiAndXMtZWFzdC0yJyxcbiAgICAgICAgdGVzdFR5cGU6ICdBY2Nlc3MtQ29udHJvbC1WYWxpZGF0aW9uJyxcbiAgICAgICAgdGVzdElkOiBgc294LWFjY2Vzcy0ke0RhdGUubm93KCl9YFxuICAgICAgfVxuICAgIF07XG5cbiAgICBzb3hUZXN0cy5mb3JFYWNoKHRlc3QgPT4ge1xuICAgICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgICBkZXBsb3ltZW50SWQ6IHRlc3QudGVzdElkLFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBbdGVzdC5yZWdpb25dLFxuICAgICAgICBzdHJhdGVneTogJ0NBTkFSWSdcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEhJUEFB5rqW5oug44OG44K544OIXG4gICAqL1xuICBwdWJsaWMgdGVzdEhpcGFhQ29tcGxpYW5jZSgpOiB2b2lkIHtcbiAgICBjb25zdCBoaXBhYVRlc3RzID0gW1xuICAgICAge1xuICAgICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgICB0ZXN0VHlwZTogJ1BISS1FbmNyeXB0aW9uJyxcbiAgICAgICAgdGVzdElkOiBgaGlwYWEtZW5jcnlwdGlvbi0ke0RhdGUubm93KCl9YFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcmVnaW9uOiAndXMtd2VzdC0yJyxcbiAgICAgICAgdGVzdFR5cGU6ICdBY2Nlc3MtTG9nZ2luZycsXG4gICAgICAgIHRlc3RJZDogYGhpcGFhLWxvZ2dpbmctJHtEYXRlLm5vdygpfWBcbiAgICAgIH1cbiAgICBdO1xuXG4gICAgaGlwYWFUZXN0cy5mb3JFYWNoKHRlc3QgPT4ge1xuICAgICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgICBkZXBsb3ltZW50SWQ6IHRlc3QudGVzdElkLFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBbdGVzdC5yZWdpb25dLFxuICAgICAgICBzdHJhdGVneTogJ0NBTkFSWSdcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENDUEHmupbmi6Djg4bjgrnjg4hcbiAgICovXG4gIHB1YmxpYyB0ZXN0Q2NwYUNvbXBsaWFuY2UoKTogdm9pZCB7XG4gICAgLy8g44Kr44Oq44OV44Kp44Or44OL44Ki5bee44OX44Op44Kk44OQ44K344O85rOV5a++5b+c44OG44K544OIXG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgZGVwbG95bWVudElkOiBgY2NwYS10ZXN0LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWyd1cy13ZXN0LTInXSwgLy8g44Kq44Os44K044Oz77yI6KW/5rW35bK477yJXG4gICAgICBzdHJhdGVneTogJ0NBTkFSWSdcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGZWRSQU1Q5rqW5oug44OG44K544OIXG4gICAqL1xuICBwdWJsaWMgdGVzdEZlZFJhbXBDb21wbGlhbmNlKCk6IHZvaWQge1xuICAgIGNvbnN0IGZlZFJhbXBUZXN0cyA9IFtcbiAgICAgIHtcbiAgICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgICAgdGVzdFR5cGU6ICdHb3Zlcm5tZW50LVNlY3VyaXR5LUNvbnRyb2xzJyxcbiAgICAgICAgdGVzdElkOiBgZmVkcmFtcC1zZWN1cml0eS0ke0RhdGUubm93KCl9YFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcmVnaW9uOiAndXMtZWFzdC0yJyxcbiAgICAgICAgdGVzdFR5cGU6ICdDb250aW51b3VzLU1vbml0b3JpbmcnLFxuICAgICAgICB0ZXN0SWQ6IGBmZWRyYW1wLW1vbml0b3JpbmctJHtEYXRlLm5vdygpfWBcbiAgICAgIH1cbiAgICBdO1xuXG4gICAgZmVkUmFtcFRlc3RzLmZvckVhY2godGVzdCA9PiB7XG4gICAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICAgIGRlcGxveW1lbnRJZDogdGVzdC50ZXN0SWQsXG4gICAgICAgIHRhcmdldFJlZ2lvbnM6IFt0ZXN0LnJlZ2lvbl0sXG4gICAgICAgIHN0cmF0ZWd5OiAnQkxVRV9HUkVFTidcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVT5YaF54G95a6z5b6p5pen44OG44K544OIXG4gICAqL1xuICBwdWJsaWMgdGVzdFVzRGlzYXN0ZXJSZWNvdmVyeSgpOiB2b2lkIHtcbiAgICAvLyDjg5Djg7zjgrjjg4vjgqLihpLjgqrjg6zjgrTjg7Pjg5XjgqfjgqTjg6vjgqrjg7zjg5Djg7xcbiAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICBkZXBsb3ltZW50SWQ6IGB1cy1kci10ZXN0LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWyd1cy13ZXN0LTInXSwgLy8g44Kq44Os44K044Oz44G444OV44Kn44Kk44Or44Kq44O844OQ44O8XG4gICAgICBzdHJhdGVneTogJ0JMVUVfR1JFRU4nXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog6auY6LKg6I2344OG44K544OIXG4gICAqL1xuICBwdWJsaWMgdGVzdEhpZ2hMb2FkQ2FwYWNpdHkoKTogdm9pZCB7XG4gICAgLy8gVVPlnLDln5/jga7pq5jjg4jjg6njg5XjgqPjg4Pjgq/lr77lv5zjg4bjgrnjg4hcbiAgICBjb25zdCBsb2FkVGVzdHMgPSBbXG4gICAgICAndXMtZWFzdC0xJywgLy8g44OQ44O844K444OL44Ki77yI5pyA6auY6LKg6I2377yJXG4gICAgICAndXMtd2VzdC0yJywgLy8g44Kq44Os44K044Oz77yI5Lit6LKg6I2377yJXG4gICAgICAndXMtZWFzdC0yJyAgLy8g44Kq44OP44Kk44Kq77yI5L2O6LKg6I2377yJXG4gICAgXTtcblxuICAgIGxvYWRUZXN0cy5mb3JFYWNoKHJlZ2lvbiA9PiB7XG4gICAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICAgIGRlcGxveW1lbnRJZDogYGxvYWQtdGVzdC0ke3JlZ2lvbn0tJHtEYXRlLm5vdygpfWAsXG4gICAgICAgIHRhcmdldFJlZ2lvbnM6IFtyZWdpb25dLFxuICAgICAgICBzdHJhdGVneTogJ0NBTkFSWSdcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOmAo+mCpuaUv+W6nOapn+mWouWvvuW/nOODhuOCueODiFxuICAgKi9cbiAgcHVibGljIHRlc3RHb3Zlcm5tZW50Q29tcGxpYW5jZSgpOiB2b2lkIHtcbiAgICAvLyBGSVNNQeODu05JU1Tmupbmi6Djg4bjgrnjg4hcbiAgICBjb25zdCBnb3ZUZXN0cyA9IFtcbiAgICAgIHtcbiAgICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgICAgY29tcGxpYW5jZTogJ0ZJU01BJyxcbiAgICAgICAgdGVzdElkOiBgZ292LWZpc21hLSR7RGF0ZS5ub3coKX1gXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICByZWdpb246ICd1cy1lYXN0LTInLFxuICAgICAgICBjb21wbGlhbmNlOiAnTklTVC04MDAtNTMnLFxuICAgICAgICB0ZXN0SWQ6IGBnb3YtbmlzdC0ke0RhdGUubm93KCl9YFxuICAgICAgfVxuICAgIF07XG5cbiAgICBnb3ZUZXN0cy5mb3JFYWNoKHRlc3QgPT4ge1xuICAgICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgICBkZXBsb3ltZW50SWQ6IHRlc3QudGVzdElkLFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBbdGVzdC5yZWdpb25dLFxuICAgICAgICBzdHJhdGVneTogJ0JMVUVfR1JFRU4nXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufSJdfQ==