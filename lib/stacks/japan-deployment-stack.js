"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JapanDeploymentStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const regional_deployment_manager_1 = require("../deployment/regional-deployment-manager");
const regional_config_factory_1 = require("../deployment/regional-config-factory");
/**
 * 日本地域専用デプロイメントスタック
 *
 * 機能:
 * - 東京・大阪地域への最適化されたデプロイメント
 * - 日本の法規制要件への完全対応
 * - 災害復旧機能（東京⇔大阪）
 * - FISC・個人情報保護法対応
 */
class JapanDeploymentStack extends aws_cdk_lib_1.Stack {
    deploymentManager;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 日本地域設定の取得
        const japanRegions = regional_config_factory_1.RegionalConfigFactory.createJapanRegionConfigs();
        const deploymentStrategies = regional_config_factory_1.RegionalConfigFactory.createDeploymentStrategies();
        const japanStrategy = deploymentStrategies.japanOnly;
        // 地域別デプロイメント管理システムの作成
        this.deploymentManager = new regional_deployment_manager_1.RegionalDeploymentManager(this, 'JapanDeploymentManager', {
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
        aws_cdk_lib_1.Tags.of(this).add('Region', 'Japan');
        aws_cdk_lib_1.Tags.of(this).add('Compliance', 'FISC-PDPA-Japan');
        aws_cdk_lib_1.Tags.of(this).add('DataResidency', 'Japan-Only');
        aws_cdk_lib_1.Tags.of(this).add('DisasterRecovery', 'Tokyo-Osaka');
        aws_cdk_lib_1.Tags.of(this).add('Language', 'Japanese');
        // 日本の営業時間に合わせたメンテナンス設定
        aws_cdk_lib_1.Tags.of(this).add('MaintenanceWindow', 'JST-02:00-04:00');
        aws_cdk_lib_1.Tags.of(this).add('BusinessHours', 'JST-09:00-18:00');
        // コンプライアンス関連タグ
        aws_cdk_lib_1.Tags.of(this).add('DataClassification', 'Confidential');
        aws_cdk_lib_1.Tags.of(this).add('RetentionPeriod', '7-Years');
        aws_cdk_lib_1.Tags.of(this).add('EncryptionRequired', 'True');
        aws_cdk_lib_1.Tags.of(this).add('AuditRequired', 'True');
    }
    /**
     * 東京地域へのデプロイメント開始
     */
    deployToTokyo() {
        this.deploymentManager.startDeployment({
            deploymentId: `tokyo-deploy-${Date.now()}`,
            targetRegions: ['ap-northeast-1'],
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * 大阪地域へのデプロイメント開始
     */
    deployToOsaka() {
        this.deploymentManager.startDeployment({
            deploymentId: `osaka-deploy-${Date.now()}`,
            targetRegions: ['ap-northeast-3'],
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * 東京・大阪同時デプロイメント
     */
    deployToJapanRegions() {
        this.deploymentManager.startDeployment({
            deploymentId: `japan-deploy-${Date.now()}`,
            targetRegions: ['ap-northeast-1', 'ap-northeast-3'],
            strategy: 'BLUE_GREEN'
        });
    }
    /**
     * 災害復旧テスト実行
     */
    testDisasterRecovery() {
        // 東京→大阪フェイルオーバーテスト
        this.deploymentManager.startDeployment({
            deploymentId: `dr-test-${Date.now()}`,
            targetRegions: ['ap-northeast-3'], // 大阪のみ
            strategy: 'BLUE_GREEN'
        });
    }
}
exports.JapanDeploymentStack = JapanDeploymentStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamFwYW4tZGVwbG95bWVudC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImphcGFuLWRlcGxveW1lbnQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsNkNBQXNEO0FBQ3RELDJGQUFzRjtBQUN0RixtRkFBOEU7QUFHOUU7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFhLG9CQUFxQixTQUFRLG1CQUFLO0lBQzdCLGlCQUFpQixDQUE0QjtJQUU3RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBRXpDO1FBQ0MsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsWUFBWTtRQUNaLE1BQU0sWUFBWSxHQUFHLCtDQUFxQixDQUFDLHdCQUF3QixFQUFFLENBQUM7UUFDdEUsTUFBTSxvQkFBb0IsR0FBRywrQ0FBcUIsQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1FBQ2hGLE1BQU0sYUFBYSxHQUFHLG9CQUFvQixDQUFDLFNBQVMsQ0FBQztRQUVyRCxzQkFBc0I7UUFDdEIsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksdURBQXlCLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQ3JGLFlBQVksRUFBRSxLQUFLLENBQUMsWUFBWTtZQUNoQyxnQkFBZ0IsRUFBRTtnQkFDaEIsR0FBRyxhQUFhO2dCQUNoQixhQUFhO2dCQUNiLGFBQWEsRUFBRSxZQUFZLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDekMsR0FBRyxNQUFNO29CQUNULGNBQWM7b0JBQ2Qsc0JBQXNCLEVBQUU7d0JBQ3RCLEdBQUcsTUFBTSxDQUFDLHNCQUFzQjt3QkFDaEMsbUJBQW1CO3dCQUNuQixvQ0FBb0M7d0JBQ3BDLDJDQUEyQztxQkFDNUM7aUJBQ0YsQ0FBQyxDQUFDO2FBQ0o7U0FDRixDQUFDLENBQUM7UUFFSCxjQUFjO1FBQ2Qsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNyQyxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDbkQsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUNqRCxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDckQsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUUxQyx1QkFBdUI7UUFDdkIsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDMUQsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBRXRELGVBQWU7UUFDZixrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDeEQsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ2hELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNoRCxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRDs7T0FFRztJQUNJLGFBQWE7UUFDbEIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsQ0FBQztZQUNyQyxZQUFZLEVBQUUsZ0JBQWdCLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUMxQyxhQUFhLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztZQUNqQyxRQUFRLEVBQUUsWUFBWTtTQUN2QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxhQUFhO1FBQ2xCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7WUFDckMsWUFBWSxFQUFFLGdCQUFnQixJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDMUMsYUFBYSxFQUFFLENBQUMsZ0JBQWdCLENBQUM7WUFDakMsUUFBUSxFQUFFLFlBQVk7U0FDdkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0ksb0JBQW9CO1FBQ3pCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7WUFDckMsWUFBWSxFQUFFLGdCQUFnQixJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDMUMsYUFBYSxFQUFFLENBQUMsZ0JBQWdCLEVBQUUsZ0JBQWdCLENBQUM7WUFDbkQsUUFBUSxFQUFFLFlBQVk7U0FDdkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0ksb0JBQW9CO1FBQ3pCLG1CQUFtQjtRQUNuQixJQUFJLENBQUMsaUJBQWlCLENBQUMsZUFBZSxDQUFDO1lBQ3JDLFlBQVksRUFBRSxXQUFXLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUNyQyxhQUFhLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLE9BQU87WUFDMUMsUUFBUSxFQUFFLFlBQVk7U0FDdkIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBOUZELG9EQThGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMsIFRhZ3MgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBSZWdpb25hbERlcGxveW1lbnRNYW5hZ2VyIH0gZnJvbSAnLi4vZGVwbG95bWVudC9yZWdpb25hbC1kZXBsb3ltZW50LW1hbmFnZXInO1xuaW1wb3J0IHsgUmVnaW9uYWxDb25maWdGYWN0b3J5IH0gZnJvbSAnLi4vZGVwbG95bWVudC9yZWdpb25hbC1jb25maWctZmFjdG9yeSc7XG5pbXBvcnQgeyBHbG9iYWxSYWdDb25maWcgfSBmcm9tICcuLi8uLi90eXBlcy9nbG9iYWwtY29uZmlnJztcblxuLyoqXG4gKiDml6XmnKzlnLDln5/lsILnlKjjg4fjg5fjg63jgqTjg6Hjg7Pjg4jjgrnjgr/jg4Pjgq9cbiAqIFxuICog5qmf6IO9OlxuICogLSDmnbHkuqzjg7vlpKfpmKrlnLDln5/jgbjjga7mnIDpganljJbjgZXjgozjgZ/jg4fjg5fjg63jgqTjg6Hjg7Pjg4hcbiAqIC0g5pel5pys44Gu5rOV6KaP5Yi26KaB5Lu244G444Gu5a6M5YWo5a++5b+cXG4gKiAtIOeBveWus+W+qeaXp+apn+iDve+8iOadseS6rOKHlOWkp+mYqu+8iVxuICogLSBGSVND44O75YCL5Lq65oOF5aCx5L+d6K235rOV5a++5b+cXG4gKi9cbmV4cG9ydCBjbGFzcyBKYXBhbkRlcGxveW1lbnRTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGRlcGxveW1lbnRNYW5hZ2VyOiBSZWdpb25hbERlcGxveW1lbnRNYW5hZ2VyO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTdGFja1Byb3BzICYge1xuICAgIGdsb2JhbENvbmZpZzogR2xvYmFsUmFnQ29uZmlnO1xuICB9KSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyDml6XmnKzlnLDln5/oqK3lrprjga7lj5blvpdcbiAgICBjb25zdCBqYXBhblJlZ2lvbnMgPSBSZWdpb25hbENvbmZpZ0ZhY3RvcnkuY3JlYXRlSmFwYW5SZWdpb25Db25maWdzKCk7XG4gICAgY29uc3QgZGVwbG95bWVudFN0cmF0ZWdpZXMgPSBSZWdpb25hbENvbmZpZ0ZhY3RvcnkuY3JlYXRlRGVwbG95bWVudFN0cmF0ZWdpZXMoKTtcbiAgICBjb25zdCBqYXBhblN0cmF0ZWd5ID0gZGVwbG95bWVudFN0cmF0ZWdpZXMuamFwYW5Pbmx5O1xuXG4gICAgLy8g5Zyw5Z+f5Yil44OH44OX44Ot44Kk44Oh44Oz44OI566h55CG44K344K544OG44Og44Gu5L2c5oiQXG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlciA9IG5ldyBSZWdpb25hbERlcGxveW1lbnRNYW5hZ2VyKHRoaXMsICdKYXBhbkRlcGxveW1lbnRNYW5hZ2VyJywge1xuICAgICAgZ2xvYmFsQ29uZmlnOiBwcm9wcy5nbG9iYWxDb25maWcsXG4gICAgICBkZXBsb3ltZW50Q29uZmlnOiB7XG4gICAgICAgIC4uLmphcGFuU3RyYXRlZ3ksXG4gICAgICAgIC8vIOaXpeacrOeJueacieOBruioreWumuOCkui/veWKoFxuICAgICAgICB0YXJnZXRSZWdpb25zOiBqYXBhblJlZ2lvbnMubWFwKHJlZ2lvbiA9PiAoe1xuICAgICAgICAgIC4uLnJlZ2lvbixcbiAgICAgICAgICAvLyDml6XmnKzjga7ms5Xopo/liLbopoHku7bjgpLlvLfljJZcbiAgICAgICAgICBjb21wbGlhbmNlUmVxdWlyZW1lbnRzOiBbXG4gICAgICAgICAgICAuLi5yZWdpb24uY29tcGxpYW5jZVJlcXVpcmVtZW50cyxcbiAgICAgICAgICAgICdCYW5raW5nLUFjdC1KYXBhbicsXG4gICAgICAgICAgICAnRmluYW5jaWFsLUluc3RydW1lbnRzLUV4Y2hhbmdlLUFjdCcsXG4gICAgICAgICAgICAnQWN0LW9uLVByb3RlY3Rpb24tb2YtUGVyc29uYWwtSW5mb3JtYXRpb24nXG4gICAgICAgICAgXVxuICAgICAgICB9KSlcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIOaXpeacrOWcsOWfn+WbuuacieOBruOCv+OCsOS7mOOBkVxuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdSZWdpb24nLCAnSmFwYW4nKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnQ29tcGxpYW5jZScsICdGSVNDLVBEUEEtSmFwYW4nKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnRGF0YVJlc2lkZW5jeScsICdKYXBhbi1Pbmx5Jyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0Rpc2FzdGVyUmVjb3ZlcnknLCAnVG9reW8tT3Nha2EnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnTGFuZ3VhZ2UnLCAnSmFwYW5lc2UnKTtcblxuICAgIC8vIOaXpeacrOOBruWWtualreaZgumWk+OBq+WQiOOCj+OBm+OBn+ODoeODs+ODhuODiuODs+OCueioreWumlxuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdNYWludGVuYW5jZVdpbmRvdycsICdKU1QtMDI6MDAtMDQ6MDAnKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnQnVzaW5lc3NIb3VycycsICdKU1QtMDk6MDAtMTg6MDAnKTtcblxuICAgIC8vIOOCs+ODs+ODl+ODqeOCpOOCouODs+OCuemWoumAo+OCv+OCsFxuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdEYXRhQ2xhc3NpZmljYXRpb24nLCAnQ29uZmlkZW50aWFsJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ1JldGVudGlvblBlcmlvZCcsICc3LVllYXJzJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0VuY3J5cHRpb25SZXF1aXJlZCcsICdUcnVlJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ0F1ZGl0UmVxdWlyZWQnLCAnVHJ1ZScpO1xuICB9XG5cbiAgLyoqXG4gICAqIOadseS6rOWcsOWfn+OBuOOBruODh+ODl+ODreOCpOODoeODs+ODiOmWi+Wni1xuICAgKi9cbiAgcHVibGljIGRlcGxveVRvVG9reW8oKTogdm9pZCB7XG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgZGVwbG95bWVudElkOiBgdG9reW8tZGVwbG95LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydhcC1ub3J0aGVhc3QtMSddLFxuICAgICAgc3RyYXRlZ3k6ICdCTFVFX0dSRUVOJ1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOWkp+mYquWcsOWfn+OBuOOBruODh+ODl+ODreOCpOODoeODs+ODiOmWi+Wni1xuICAgKi9cbiAgcHVibGljIGRlcGxveVRvT3Nha2EoKTogdm9pZCB7XG4gICAgdGhpcy5kZXBsb3ltZW50TWFuYWdlci5zdGFydERlcGxveW1lbnQoe1xuICAgICAgZGVwbG95bWVudElkOiBgb3Nha2EtZGVwbG95LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydhcC1ub3J0aGVhc3QtMyddLFxuICAgICAgc3RyYXRlZ3k6ICdCTFVFX0dSRUVOJ1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOadseS6rOODu+Wkp+mYquWQjOaZguODh+ODl+ODreOCpOODoeODs+ODiFxuICAgKi9cbiAgcHVibGljIGRlcGxveVRvSmFwYW5SZWdpb25zKCk6IHZvaWQge1xuICAgIHRoaXMuZGVwbG95bWVudE1hbmFnZXIuc3RhcnREZXBsb3ltZW50KHtcbiAgICAgIGRlcGxveW1lbnRJZDogYGphcGFuLWRlcGxveS0ke0RhdGUubm93KCl9YCxcbiAgICAgIHRhcmdldFJlZ2lvbnM6IFsnYXAtbm9ydGhlYXN0LTEnLCAnYXAtbm9ydGhlYXN0LTMnXSxcbiAgICAgIHN0cmF0ZWd5OiAnQkxVRV9HUkVFTidcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDngb3lrrPlvqnml6fjg4bjgrnjg4jlrp/ooYxcbiAgICovXG4gIHB1YmxpYyB0ZXN0RGlzYXN0ZXJSZWNvdmVyeSgpOiB2b2lkIHtcbiAgICAvLyDmnbHkuqzihpLlpKfpmKrjg5XjgqfjgqTjg6vjgqrjg7zjg5Djg7zjg4bjgrnjg4hcbiAgICB0aGlzLmRlcGxveW1lbnRNYW5hZ2VyLnN0YXJ0RGVwbG95bWVudCh7XG4gICAgICBkZXBsb3ltZW50SWQ6IGBkci10ZXN0LSR7RGF0ZS5ub3coKX1gLFxuICAgICAgdGFyZ2V0UmVnaW9uczogWydhcC1ub3J0aGVhc3QtMyddLCAvLyDlpKfpmKrjga7jgb9cbiAgICAgIHN0cmF0ZWd5OiAnQkxVRV9HUkVFTidcbiAgICB9KTtcbiAgfVxufSJdfQ==