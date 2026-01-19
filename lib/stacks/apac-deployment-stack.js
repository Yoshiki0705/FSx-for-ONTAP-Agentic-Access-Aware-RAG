"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApacDeploymentStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const regional_deployment_manager_1 = require("../deployment/regional-deployment-manager");
const regional_config_factory_1 = require("../deployment/regional-config-factory");
/**
 * APAC地域専用デプロイメントスタック
 *
 * 機能:
 * - APAC全地域への段階的デプロイメント
 * - 地域別法規制要件への対応
 * - 多言語・多通貨対応
 * - 地域間レプリケーション
 */
class ApacDeploymentStack extends aws_cdk_lib_1.Stack {
    deploymentManager;
    constructor(scope, id, props) {
        super(scope, id, props);
        // APAC地域設定の取得
        const japanRegions = regional_config_factory_1.RegionalConfigFactory.createJapanRegionConfigs();
        const apacRegions = regional_config_factory_1.RegionalConfigFactory.createApacRegionConfigs();
        const allApacRegions = [...japanRegions, ...apacRegions];
        const deploymentStrategies = regional_config_factory_1.RegionalConfigFactory.createDeploymentStrategies();
        const apacStrategy = deploymentStrategies.apac;
        // 地域別デプロイメント管理システムの作成
        this.deploymentManager = new regional_deployment_manager_1.RegionalDeploymentManager(this, 'ApacDeploymentManager', {
            globalConfig: props.globalConfig,
            deploymentConfig: {
                ...apacStrategy,
                targetRegions: allApacRegions.map(region => ({
                    ...region,
                    // APAC地域固有の設定を追加
                    environmentConfig: {
                        ...region.environmentConfig,
                        // 地域別の最適化設定
                        networkConfig: {
                            ...region.environmentConfig.networkConfig,
                            // レイテンシー最適化のためのCIDR調整
                            vpcCidr: this.getOptimizedVpcCidr(region.region)
                        }
                    }
                }))
            }
        });
        // APAC地域固有のタグ付け
        aws_cdk_lib_1.Tags.of(this).add('Region', 'APAC');
        aws_cdk_lib_1.Tags.of(this).add('MultiRegion', 'True');
        aws_cdk_lib_1.Tags.of(this).add('Languages', 'Japanese-English-Chinese-Korean-Hindi');
        aws_cdk_lib_1.Tags.of(this).add('Currencies', 'JPY-USD-SGD-AUD-INR-KRW');
        aws_cdk_lib_1.Tags.of(this).add('TimeZones', 'JST-SGT-AEST-IST-KST');
        // コンプライアンス関連タグ
        aws_cdk_lib_1.Tags.of(this).add('ComplianceRegions', 'Japan-Singapore-Australia-India-Korea');
        aws_cdk_lib_1.Tags.of(this).add('DataResidency', 'Regional-Restrictions');
        aws_cdk_lib_1.Tags.of(this).add('CrossBorderData', 'Restricted');
        // 運用関連タグ
        aws_cdk_lib_1.Tags.of(this).add('FollowTheSun', 'True');
        aws_cdk_lib_1.Tags.of(this).add('24x7Support', 'True');
        aws_cdk_lib_1.Tags.of(this).add('RegionalFailover', 'Enabled');
    }
    /**
     * 地域別最適化VPC CIDR取得
     */
    getOptimizedVpcCidr(region) {
        const cidrMap = {
            'ap-northeast-1': '10.1.0.0/16', // 東京
            'ap-northeast-3': '10.2.0.0/16', // 大阪
            'ap-southeast-1': '10.3.0.0/16', // シンガポール
            'ap-southeast-2': '10.4.0.0/16', // シドニー
            'ap-south-1': '10.5.0.0/16', // ムンバイ
            'ap-northeast-2': '10.6.0.0/16' // ソウル
        };
        return cidrMap[region] || '10.0.0.0/16';
    }
    /**
     * 段階的APAC地域デプロイメント
     */
    deployToApacRegions() {
        // Phase 1: 日本地域（基盤）
        this.deploymentManager.startDeployment({
            deploymentId: `apac-phase1-${Date.now()}`,
            targetRegions: ['ap-northeast-1', 'ap-northeast-3'],
            strategy: 'BLUE_GREEN'
        });
        // Phase 2: 主要APAC地域
        setTimeout(() => {
            this.deploymentManager.startDeployment({
                deploymentId: `apac-phase2-${Date.now()}`,
                targetRegions: ['ap-southeast-1', 'ap-southeast-2'],
                strategy: 'CANARY'
            });
        }, 30 * 60 * 1000); // 30分後
        // Phase 3: 拡張APAC地域
        setTimeout(() => {
            this.deploymentManager.startDeployment({
                deploymentId: `apac-phase3-${Date.now()}`,
                targetRegions: ['ap-south-1', 'ap-northeast-2'],
                strategy: 'ROLLING'
            });
        }, 60 * 60 * 1000); // 60分後
    }
    /**
     * シンガポール地域デプロイメント
     */
    deployToSingapore() {
        this.deploymentManager.startDeployment({
            deploymentId: `singapore-deploy-${Date.now()}`,
            targetRegions: ['ap-southeast-1'],
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * オーストラリア地域デプロイメント
     */
    deployToAustralia() {
        this.deploymentManager.startDeployment({
            deploymentId: `australia-deploy-${Date.now()}`,
            targetRegions: ['ap-southeast-2'],
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * インド地域デプロイメント
     */
    deployToIndia() {
        this.deploymentManager.startDeployment({
            deploymentId: `india-deploy-${Date.now()}`,
            targetRegions: ['ap-south-1'],
            strategy: 'CANARY'
        });
    }
    /**
     * 韓国地域デプロイメント
     */
    deployToKorea() {
        this.deploymentManager.startDeployment({
            deploymentId: `korea-deploy-${Date.now()}`,
            targetRegions: ['ap-northeast-2'],
            strategy: 'CANARY'
        });
    }
    /**
     * APAC地域間フェイルオーバーテスト
     */
    testApacFailover() {
        // 日本→シンガポールフェイルオーバー
        this.deploymentManager.startDeployment({
            deploymentId: `apac-failover-test-${Date.now()}`,
            targetRegions: ['ap-southeast-1'], // シンガポールへフェイルオーバー
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * 地域別コンプライアンステスト
     */
    testRegionalCompliance() {
        const complianceTests = [
            {
                region: 'ap-southeast-1',
                compliance: 'PDPA-Singapore',
                testId: `singapore-compliance-${Date.now()}`
            },
            {
                region: 'ap-southeast-2',
                compliance: 'Privacy-Act-Australia',
                testId: `australia-compliance-${Date.now()}`
            },
            {
                region: 'ap-south-1',
                compliance: 'DPDP-India',
                testId: `india-compliance-${Date.now()}`
            },
            {
                region: 'ap-northeast-2',
                compliance: 'PIPA-Korea',
                testId: `korea-compliance-${Date.now()}`
            }
        ];
        complianceTests.forEach(test => {
            this.deploymentManager.startDeployment({
                deploymentId: test.testId,
                targetRegions: [test.region],
                strategy: 'CANARY'
            });
        });
    }
}
exports.ApacDeploymentStack = ApacDeploymentStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBhYy1kZXBsb3ltZW50LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBhYy1kZXBsb3ltZW50LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLDZDQUFzRDtBQUN0RCwyRkFBc0Y7QUFDdEYsbUZBQThFO0FBRzlFOzs7Ozs7OztHQVFHO0FBQ0gsTUFBYSxtQkFBb0IsU0FBUSxtQkFBSztJQUM1QixpQkFBaUIsQ0FBNEI7SUFFN0QsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUV6QztRQUNDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGNBQWM7UUFDZCxNQUFNLFlBQVksR0FBRywrQ0FBcUIsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBQ3RFLE1BQU0sV0FBVyxHQUFHLCtDQUFxQixDQUFDLHVCQUF1QixFQUFFLENBQUM7UUFDcEUsTUFBTSxjQUFjLEdBQUcsQ0FBQyxHQUFHLFlBQVksRUFBRSxHQUFHLFdBQVcsQ0FBQyxDQUFDO1FBRXpELE1BQU0sb0JBQW9CLEdBQUcsK0NBQXFCLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztRQUNoRixNQUFNLFlBQVksR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLENBQUM7UUFFL0Msc0JBQXNCO1FBQ3RCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLHVEQUF5QixDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUNwRixZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7WUFDaEMsZ0JBQWdCLEVBQUU7Z0JBQ2hCLEdBQUcsWUFBWTtnQkFDZixhQUFhLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7b0JBQzNDLEdBQUcsTUFBTTtvQkFDVCxpQkFBaUI7b0JBQ2pCLGlCQUFpQixFQUFFO3dCQUNqQixHQUFHLE1BQU0sQ0FBQyxpQkFBaUI7d0JBQzNCLFlBQVk7d0JBQ1osYUFBYSxFQUFFOzRC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QyxFQUFFO1lBQzdCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7Z0JBQ3JDLFlBQVksRUFBRSxJQUFJLENBQUMsTUFBTTtnQkFDekIsYUFBYSxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsUUFBUSxFQUFFLFFBQVE7YUFDbkIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUEvTEQsa0RBK0xDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBTdGFjaywgU3RhY2tQcm9wcywgVGFncyB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IFJlZ2lvbmFsRGVwbG95bWVudE1hbmFnZXIgfSBmcm9tICcuLi9kZXBsb3ltZW50L3JlZ2lvbmFsLWRlcGxveW1lbnQtbWFuYWdlcic7XG5pbXBvcnQgeyBSZWdpb25hbENvbmZpZ0ZhY3RvcnkgfSBmcm9tICcuLi9kZXBsb3ltZW50L3JlZ2lvbmFsLWNvbmZpZy1mYWN0b3J5JztcbmltcG9ydCB7IEdsb2JhbFJhZ0NvbmZpZyB9IGZyb20gJy4uLy4uL3R5cGVzL2dsb2JhbC1jb25maWcnO1xuXG4vKipcbiAqIEFQQUPlnLDln5/lsILnlKjjg4fjg5fjg63jgqTjg6Hjg7Pjg4jjgrnjgr/jg4Pjgq9cbiAqIFxuICog5qmf6IO9OlxuICogLSBBUEFD5YWo5Zyw5Z+f44G444Gu5q616ZqO55qE44OH44OX44Ot44Kk44Oh44Oz44OIXG4gKiAtIOWcsOWfn+WIpeazleimj+WItuimgeS7tuOBuOOBruWvvuW/nFxuICogLSDlpJroqIDoqp7jg7vlpJrpgJrosqjlr77lv5xcbiAqIC0g5Zyw5Z+f6ZaT44Os44OX44Oq44Kx44O844K344On44OzXG4gKi9cbmV4cG9ydCBjbGFzcyBBcGFjRGVwbG95bWVudFN0YWNrIGV4dGVuZHMgU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgZGVwbG95bWVudE1hbmFnZXI6IFJlZ2lvbmFsRGVwbG95bWVudE1hbmFnZXI7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFN0YWNrUHJvcHMgJiB7XG4gICAgZ2xvYmFsQ29uZmlnOiBHbG9iYWxSYWdDb25maWc7XG4gIH0pIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIEFQQUPlnLDln5/oqK3lrprjga7lj5blvpdcbiAgICBjb25zdCBqYXBhblJlZ2lvbnMgPSBSZWdpb25hbENvbmZpZ0ZhY3RvcnkuY3JlYXRlSmFwYW5SZWdpb25Db25maWdzKCk7XG4gICAgY29uc3QgYXBhY1JlZ2lvbnMgPSBSZWdpb25hbENvbmZpZ0ZhY3RvcnkuY3JlYXRlQXBhY1JlZ2lvbkNvbmZpZ3MoKTtcbiAgICBjb25zdCBhbGxBcGFjUmVnaW9ucyA9IFsuLi5qYXBhblJlZ2lvbnMsIC4uLmFwYWNSZWdpb25zXTtcbiAgICBcbiAgICBjb25zdCBkZXBsb3ltZW50U3RyYXRlZ2llcyA9IFJlZ2lvbmFsQ29uZmlnRmFjdG9yeS5jcmVhdGVEZXBsb3ltZW50U3RyYXRlZ2llcygpO1xuICAgIGNvbnN0IGFwYWNTdHJhdGVneSA9IGRlcGxveW1lbnRTdHJhdGVnaWVzLmFwYWM7XG5cbiAgICAvLyDlnLDln5/liKXjg4fjg5fjg63jgqTjg6Hjg7Pjg4jnrqHnkIbjgrfjgrnjg4bjg6Djga7kvZzmiJBcbiAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyID0gbmV3IFJlZ2lvbmFsRGVwbG95bWVudE1hbmFnZXIodGhpcywgJ0FwYWNEZXBsb3ltZW50TWFuYWdlcicsIHtcbiAgICAgIGdsb2JhbENvbmZpZzogcHJvcHMuZ2xvYmFsQ29uZmlnLFxuICAgICAgZGVwbG95bWVudENvbmZpZzoge1xuICAgICAgICAuLi5hcGFjU3RyYXRlZ3ksXG4gICAgICAgIHRhcmdldFJlZ2lvbnM6IGFsbEFwYWNSZWdpb25zLm1hcChyZWdpb24gPT4gKHtcbiAgICAgICAgICAuLi5yZWdpb24sXG4gICAgICAgICAgLy8gQVBBQ+WcsOWfn+WbuuacieOBruioreWumuOCkui/veWKoFxuICAgICAgICAgIGVudmlyb25tZW50Q29uZmlnOiB7XG4gICAgICAgICAgICAuLi5yZWdpb24uZW52aXJvbm1lbnRDb25maWcsXG4gICAgICAgICAgICAvLyDlnLDln5/liKXjga7mnIDpganljJboqK3lrppcbiAgICAgICAgICAgIG5ldHdvcmtDb25maWc6IHtcbiAgICAgICAgICAgICAgLi4ucmVnaW9uLmVudmlyb25tZW50Q29uZmlnLm5ldHdvcmtDb25maWcsXG4gICAgICAgICAgICAgIC8vIOODrOOCpOODhuODs+OCt+ODvOacgOmBqeWMluOBruOBn+OCgeOBrkNJRFLoqr/mlbRcbiAgICAgICAgICAgICAgdnBjQ2lkcjogdGhpcy5nZXRPcHRpbWl6ZWRWcGNDaWRyKHJlZ2lvbi5yZWdpb24pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KSlcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEFQQUPlnLDln5/lm7rmnInjga7jgr/jgrDku5jjgZFcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnUmVnaW9uJywgJ0FQQUMnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnTXVsdGlSZWdpb24nLCAnVHJ1ZScpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdMYW5ndWFnZXMnLCAnSmFwYW5lc2UtRW5nbGlzaC1DaGluZXNlLUtvcmVhbi1IaW5kaScpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdDdXJyZW5jaWVzJywgJ0pQWS1VU0QtU0dELUFVRC1JTlItS1JXJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ1RpbWVab25lcycsICdKU1QtU0dULUFFU1QtSVNULUtTVCcpO1xuXG4gICAgLy8g44Kz44Oz44OX44Op44Kk44Ki44Oz44K56Zai6YCj44K/44KwXG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0NvbXBsaWFuY2VSZWdpb25zJywgJ0phcGFuLVNpbmdhcG9yZS1BdXN0cmFsaWEtSW5kaWEtS29yZWEnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnRGF0YVJlc2lkZW5jeScsICdSZWdpb25hbC1SZXN0cmljdGlvbnMnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnQ3Jvc3NCb3JkZXJEYXRhJywgJ1Jlc3RyaWN0ZWQnKTtcblxuICAgIC8vIOmBi+eUqOmWoumAo+OCv+OCsFxuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdGb2xsb3dUaGVTdW4nLCAnVHJ1ZScpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCcyNHg3U3VwcG9ydCcsICdUcnVlJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ1JlZ2lvbmFsRmFpbG92ZXInLCAnRW5hYmxlZCcpO1xuICB9XG5cbiAgLyoqXG4gICAqIOWcsOWfn+WIpeacgOmBqeWMllZQQyBDSURS5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldE9wdGltaXplZFZwY0NpZHIocmVnaW9uOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IGNpZHJNYXA6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG4gICAgICAnYXAtbm9ydGhlYXN0LTEnOiAnMTAuMS4wLjAvMTYnLCAgLy8g5p2x5LqsXG4gICAgICAnYXAtbm9ydGhlYXN0LTMnOiAnMTAuMi4wLjAvMTYnLCAgLy8g5aSn6ZiqXG4gICAgICAnYXAtc291dGhlYXN0LTEnOiAnMTAuMy4wLjAvMTYnLCAgLy8g44K344Oz44Ks44Od44O844OrXG4gICAgICAnYXAtc291dGhlYXN0LTInOiAnMTAuNC4wLjAvMTYnLCAgLy8g44K344OJ44OL44O8XG4gICAgICAnYXAtc291dGgtMSc6ICcxMC41LjAuMC8xNicsICAgICAgLy8g44Og44Oz44OQ44KkXG4gICAgICAnYXAtbm9ydGhlYXN0LTInOiAnMTAuNi4wLjAvMTYnICAgLy8g44K944Km44OrXG4gICAgfTtcbiAgICByZXR1cm4gY2lkck1hcFtyZWdpb25dIHx8ICcxMC4wLjAuMC8xNic7XG4gIH1cblxuICAvKipcbiAgICog5q616ZqO55qEQVBBQ+WcsOWfn+ODh+ODl+ODreOCpOODoeODs+ODiFxuICAgKi9cbiAgcHVibGljIGRlcGxveVRvQXBhY1JlZ2lvbnMoKTogdm9pZCB7XG4gICAgLy8gUGhhc2UgMTog5pel5pys5Zyw5Z+f77yI5Z+655uk77yJXG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgZGVwbG95bWVudElkOiBgYXBhYy1waGFzZTEtJHtEYXRlLm5vdygpfWAsXG4gICAgICB0YXJnZXRSZWdpb25zOiBbJ2FwLW5vcnRoZWFzdC0xJywgJ2FwLW5vcnRoZWFzdC0zJ10sXG4gICAgICBzdHJhdGVneTogJ0JMVUVfR1JFRU4nXG4gICAgfSk7XG5cbiAgICAvLyBQaGFzZSAyOiDkuLvopoFBUEFD5Zyw5Z+fXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICAgIGRlcGxveW1lbnRJZDogYGFwYWMtcGhhc2UyLSR7RGF0ZS5ub3coKX1gLFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBbJ2FwLXNvdXRoZWFzdC0xJywgJ2FwLXNvdXRoZWFzdC0yJ10sXG4gICAgICAgIHN0cmF0ZWd5OiAnQ0FOQVJZJ1xuICAgICAgfSk7XG4gICAgfSwgMzAgKiA2MCAqIDEwMDApOyAvLyAzMOWIhuW+jFxuXG4gICAgLy8gUGhhc2UgMzog5ouh5by1QVBBQ+WcsOWfn1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgICBkZXBsb3ltZW50SWQ6IGBhcGFjLXBoYXNlMy0ke0RhdGUubm93KCl9YCxcbiAgICAgICAgdGFyZ2V0UmVnaW9uczogWydhcC1zb3V0aC0xJywgJ2FwLW5vcnRoZWFzdC0yJ10sXG4gICAgICAgIHN0cmF0ZWd5OiAnUk9MTElORydcbiAgICAgIH0pO1xuICAgIH0sIDYwICogNjAgKiAxMDAwKTsgLy8gNjDliIblvoxcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrfjg7Pjgqzjg53jg7zjg6vlnLDln5/jg4fjg5fjg63jgqTjg6Hjg7Pjg4hcbiAgICovXG4gIHB1YmxpYyBkZXBsb3lUb1NpbmdhcG9yZSgpOiB2b2lkIHtcbiAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICBkZXBsb3ltZW50SWQ6IGBzaW5nYXBvcmUtZGVwbG95LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydhcC1zb3V0aGVhc3QtMSddLFxuICAgICAgc3RyYXRlZ3k6ICdCTFVFX0dSRUVOJ1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCquODvOOCueODiOODqeODquOCouWcsOWfn+ODh+ODl+ODreOCpOODoeODs+ODiFxuICAgKi9cbiAgcHVibGljIGRlcGxveVRvQXVzdHJhbGlhKCk6IHZvaWQge1xuICAgIHRoaXMuZGVwbG95bWVudE1hbmFnZXIuc3RhcnREZXBsb3ltZW50KHtcbiAgICAgIGRlcGxveW1lbnRJZDogYGF1c3RyYWxpYS1kZXBsb3ktJHtEYXRlLm5vdygpfWAsXG4gICAgICB0YXJnZXRSZWdpb25zOiBbJ2FwLXNvdXRoZWFzdC0yJ10sXG4gICAgICBzdHJhdGVneTogJ0JMVUVfR1JFRU4nXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44Kk44Oz44OJ5Zyw5Z+f44OH44OX44Ot44Kk44Oh44Oz44OIXG4gICAqL1xuICBwdWJsaWMgZGVwbG95VG9JbmRpYSgpOiB2b2lkIHtcbiAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICBkZXBsb3ltZW50SWQ6IGBpbmRpYS1kZXBsb3ktJHtEYXRlLm5vdygpfWAsXG4gICAgICB0YXJnZXRSZWdpb25zOiBbJ2FwLXNvdXRoLTEnXSxcbiAgICAgIHN0cmF0ZWd5OiAnQ0FOQVJZJ1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOmfk+WbveWcsOWfn+ODh+ODl+ODreOCpOODoeODs+ODiFxuICAgKi9cbiAgcHVibGljIGRlcGxveVRvS29yZWEoKTogdm9pZCB7XG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgZGVwbG95bWVudElkOiBga29yZWEtZGVwbG95LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydhcC1ub3J0aGVhc3QtMiddLFxuICAgICAgc3RyYXRlZ3k6ICdDQU5BUlknXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQVBBQ+WcsOWfn+mWk+ODleOCp+OCpOODq+OCquODvOODkOODvOODhuOCueODiFxuICAgKi9cbiAgcHVibGljIHRlc3RBcGFjRmFpbG92ZXIoKTogdm9pZCB7XG4gICAgLy8g5pel5pys4oaS44K344Oz44Ks44Od44O844Or44OV44Kn44Kk44Or44Kq44O844OQ44O8XG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgZGVwbG95bWVudElkOiBgYXBhYy1mYWlsb3Zlci10ZXN0LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydhcC1zb3V0aGVhc3QtMSddLCAvLyDjgrfjg7Pjgqzjg53jg7zjg6vjgbjjg5XjgqfjgqTjg6vjgqrjg7zjg5Djg7xcbiAgICAgIHN0cmF0ZWd5OiAnQkxVRV9HUkVFTidcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlnLDln5/liKXjgrPjg7Pjg5fjg6njgqTjgqLjg7Pjgrnjg4bjgrnjg4hcbiAgICovXG4gIHB1YmxpYyB0ZXN0UmVnaW9uYWxDb21wbGlhbmNlKCk6IHZvaWQge1xuICAgIGNvbnN0IGNvbXBsaWFuY2VUZXN0cyA9IFtcbiAgICAgIHtcbiAgICAgICAgcmVnaW9uOiAnYXAtc291dGhlYXN0LTEnLFxuICAgICAgICBjb21wbGlhbmNlOiAnUERQQS1TaW5nYXBvcmUnLFxuICAgICAgICB0ZXN0SWQ6IGBzaW5nYXBvcmUtY29tcGxpYW5jZS0ke0RhdGUubm93KCl9YFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcmVnaW9uOiAnYXAtc291dGhlYXN0LTInLFxuICAgICAgICBjb21wbGlhbmNlOiAnUHJpdmFjeS1BY3QtQXVzdHJhbGlhJyxcbiAgICAgICAgdGVzdElkOiBgYXVzdHJhbGlhLWNvbXBsaWFuY2UtJHtEYXRlLm5vdygpfWBcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHJlZ2lvbjogJ2FwLXNvdXRoLTEnLFxuICAgICAgICBjb21wbGlhbmNlOiAnRFBEUC1JbmRpYScsXG4gICAgICAgIHRlc3RJZDogYGluZGlhLWNvbXBsaWFuY2UtJHtEYXRlLm5vdygpfWBcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHJlZ2lvbjogJ2FwLW5vcnRoZWFzdC0yJyxcbiAgICAgICAgY29tcGxpYW5jZTogJ1BJUEEtS29yZWEnLFxuICAgICAgICB0ZXN0SWQ6IGBrb3JlYS1jb21wbGlhbmNlLSR7RGF0ZS5ub3coKX1gXG4gICAgICB9XG4gICAgXTtcblxuICAgIGNvbXBsaWFuY2VUZXN0cy5mb3JFYWNoKHRlc3QgPT4ge1xuICAgICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgICBkZXBsb3ltZW50SWQ6IHRlc3QudGVzdElkLFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBbdGVzdC5yZWdpb25dLFxuICAgICAgICBzdHJhdGVneTogJ0NBTkFSWSdcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59Il19