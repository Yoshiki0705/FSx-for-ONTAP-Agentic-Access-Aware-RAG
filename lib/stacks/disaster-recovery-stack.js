"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisasterRecoveryStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const disaster_recovery_manager_1 = require("../disaster-recovery/disaster-recovery-manager");
const data_replication_manager_1 = require("../disaster-recovery/data-replication-manager");
/**
 * 災害復旧システム統合スタック
 *
 * 機能:
 * - 東京 ⇔ 大阪間災害復旧システム
 * - データレプリケーション管理
 * - 自動フェイルオーバー機能
 * - RTO: 4時間以内、RPO: 1時間以内の目標達成
 */
class DisasterRecoveryStack extends aws_cdk_lib_1.Stack {
    disasterRecoveryManager;
    dataReplicationManager;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 災害復旧設定
        const drConfig = {
            rtoMinutes: 240, // 4時間
            rpoMinutes: 60, // 1時間
            primaryRegion: props.primaryRegion,
            secondaryRegion: props.secondaryRegion,
            healthCheckIntervalMinutes: 5,
            failoverThreshold: 3
        };
        // データレプリケーション設定
        const replicationConfig = {
            primaryRegion: props.primaryRegion,
            secondaryRegion: props.secondaryRegion,
            replicationIntervalMinutes: 15,
            backupRetentionDays: 30,
            encryptionEnabled: true
        };
        // 災害復旧管理システム
        this.disasterRecoveryManager = new disaster_recovery_manager_1.DisasterRecoveryManager(this, 'DisasterRecoveryManager', {
            globalConfig: props.globalConfig,
            drConfig
        });
        // データレプリケーション管理システム
        this.dataReplicationManager = new data_replication_manager_1.DataReplicationManager(this, 'DataReplicationManager', {
            globalConfig: props.globalConfig,
            replicationConfig
        });
        // 権限設定
        this.setupPermissions();
        // タグ設定
        this.setupTags(props.globalConfig);
    }
    /**
     * 権限設定
     */
    setupPermissions() {
        this.disasterRecoveryManager.grantPermissions();
        this.dataReplicationManager.grantPermissions();
    }
    /**
     * タグ設定
     */
    setupTags(config) {
        aws_cdk_lib_1.Tags.of(this).add('Project', config.projectName);
        aws_cdk_lib_1.Tags.of(this).add('Environment', config.environment);
        aws_cdk_lib_1.Tags.of(this).add('Component', 'DisasterRecovery');
        aws_cdk_lib_1.Tags.of(this).add('Region', config.region);
        aws_cdk_lib_1.Tags.of(this).add('CostCenter', 'Infrastructure');
        aws_cdk_lib_1.Tags.of(this).add('Owner', 'NetApp-Japan-Tech-Team');
        aws_cdk_lib_1.Tags.of(this).add('Purpose', 'Business-Continuity');
    }
    /**
     * 出力値の定義
     */
    getOutputs() {
        return {
            disasterRecoveryStatusTableName: this.disasterRecoveryManager.statusTable.tableName,
            replicationStatusTableName: this.dataReplicationManager.getReplicationStatus().tableName,
            healthCheckFunctionArn: this.disasterRecoveryManager.healthCheckFunction.functionArn,
            failoverFunctionArn: this.disasterRecoveryManager.failoverFunction.functionArn,
            alertTopicArn: this.disasterRecoveryManager.alertTopic.topicArn
        };
    }
}
exports.DisasterRecoveryStack = DisasterRecoveryStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlzYXN0ZXItcmVjb3Zlcnktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkaXNhc3Rlci1yZWNvdmVyeS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FBc0Q7QUFFdEQsOEZBQXlGO0FBQ3pGLDRGQUF1RjtBQVl2Rjs7Ozs7Ozs7R0FRRztBQUNILE1BQWEscUJBQXNCLFNBQVEsbUJBQUs7SUFDOUIsdUJBQXVCLENBQTBCO0lBQ2pELHNCQUFzQixDQUF5QjtJQUUvRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWlDO1FBQ3pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLFNBQVM7UUFDVCxNQUFNLFFBQVEsR0FBRztZQUNmLFVBQVUsRUFBRSxHQUFHLEVBQUUsTUFBTTtZQUN2QixVQUFVLEVBQUUsRUFBRSxFQUFHLE1BQU07WUFDdkIsYUFBYSxFQUFFLEtBQUssQ0FBQyxhQUFhO1lBQ2xDLGVBQWUsRUFBRSxLQUFLLENBQUMsZUFBZTtZQUN0QywwQkFBMEIsRUFBRSxDQUFDO1lBQzdCLGlCQUFpQixFQUFFLENBQUM7U0FDckIsQ0FBQztRQUVGLGdCQUFnQjtRQUNoQixNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLGFBQWEsRUFBRSxLQUFLLENBQUMsYUFBYTtZQUNsQyxlQUFlLEVBQUUsS0FBSyxDQUFDLGVBQWU7WUFDdEMsMEJBQTBCLEVBQUUsRUFBRTtZQUM5QixtQkFBbUIsRUFBRSxFQUFFO1lBQ3ZCLGlCQUFpQixFQUFFLElBQUk7U0FDeEIsQ0FBQztRQUVGLGFBQWE7UUFDYixJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxtREFBdUIsQ0FBQyxJQUFJLEVBQUUseUJBQXlCLEVBQUU7WUFDMUYsWUFBWSxFQUFFLEtBQUssQ0FBQyxZQUFZO1lBQ2hDLFFBQVE7U0FDVCxDQUFDLENBQUM7UUFFSCxvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLHNCQUFzQixHQUFHLElBQUksaURBQXNCLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQ3ZGLFlBQVksRUFBRSxLQUFLLENBQUMsWUFBWTtZQUNoQyxpQkFBaUI7U0FDbEIsQ0FBQyxDQUFDO1FBRUgsT0FBTztRQUNQLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBRXhCLE9BQU87UUFDUCxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRUQ7O09BRUc7SUFDSyxnQkFBZ0I7UUFDdEIsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDaEQsSUFBSSxDQUFDLHNCQUFzQixDQUFDLGdCQUFnQixFQUFFLENBQUM7SUFDakQsQ0FBQztJQUVEOztPQUVHO0lBQ0ssU0FBUyxDQUFDLE1BQXVCO1FBQ3ZDLGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ2pELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3JELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUNuRCxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMzQyxrQkFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDbEQsa0JBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO1FBQ3JELGtCQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUscUJBQXFCLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxVQUFVO1FBQ2YsT0FBTztZQUNMLCtCQUErQixFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXLENBQUMsU0FBUztZQUNuRiwwQkFBMEIsRUFBRSxJQUFJLENBQUMsc0JBQXNCLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxTQUFTO1lBQ3hGLHNCQUFzQixFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXO1lBQ3BGLG1CQUFtQixFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXO1lBQzlFLGFBQWEsRUFBRSxJQUFJLENBQUMsdUJBQXVCLENBQUMsVUFBVSxDQUFDLFFBQVE7U0FDaEUsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQTlFRCxzREE4RUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTdGFjaywgU3RhY2tQcm9wcywgVGFncyB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRGlzYXN0ZXJSZWNvdmVyeU1hbmFnZXIgfSBmcm9tICcuLi9kaXNhc3Rlci1yZWNvdmVyeS9kaXNhc3Rlci1yZWNvdmVyeS1tYW5hZ2VyJztcbmltcG9ydCB7IERhdGFSZXBsaWNhdGlvbk1hbmFnZXIgfSBmcm9tICcuLi9kaXNhc3Rlci1yZWNvdmVyeS9kYXRhLXJlcGxpY2F0aW9uLW1hbmFnZXInO1xuaW1wb3J0IHsgR2xvYmFsUmFnQ29uZmlnIH0gZnJvbSAnLi4vLi4vdHlwZXMvZ2xvYmFsLWNvbmZpZyc7XG5cbi8qKlxuICog54G95a6z5b6p5pen44K544K/44OD44Kv6Kit5a6aXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGlzYXN0ZXJSZWNvdmVyeVN0YWNrUHJvcHMgZXh0ZW5kcyBTdGFja1Byb3BzIHtcbiAgZ2xvYmFsQ29uZmlnOiBHbG9iYWxSYWdDb25maWc7XG4gIHByaW1hcnlSZWdpb246IHN0cmluZztcbiAgc2Vjb25kYXJ5UmVnaW9uOiBzdHJpbmc7XG59XG5cbi8qKlxuICog54G95a6z5b6p5pen44K344K544OG44Og57Wx5ZCI44K544K/44OD44KvXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0g5p2x5LqsIOKHlCDlpKfpmKrplpPngb3lrrPlvqnml6fjgrfjgrnjg4bjg6BcbiAqIC0g44OH44O844K/44Os44OX44Oq44Kx44O844K344On44Oz566h55CGXG4gKiAtIOiHquWLleODleOCp+OCpOODq+OCquODvOODkOODvOapn+iDvVxuICogLSBSVE86IDTmmYLplpPku6XlhoXjgIFSUE86IDHmmYLplpPku6XlhoXjga7nm67mqJnpgZTmiJBcbiAqL1xuZXhwb3J0IGNsYXNzIERpc2FzdGVyUmVjb3ZlcnlTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGRpc2FzdGVyUmVjb3ZlcnlNYW5hZ2VyOiBEaXNhc3RlclJlY292ZXJ5TWFuYWdlcjtcbiAgcHVibGljIHJlYWRvbmx5IGRhdGFSZXBsaWNhdGlvbk1hbmFnZXI6IERhdGFSZXBsaWNhdGlvbk1hbmFnZXI7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IERpc2FzdGVyUmVjb3ZlcnlTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyDngb3lrrPlvqnml6foqK3lrppcbiAgICBjb25zdCBkckNvbmZpZyA9IHtcbiAgICAgIHJ0b01pbnV0ZXM6IDI0MCwgLy8gNOaZgumWk1xuICAgICAgcnBvTWludXRlczogNjAsICAvLyAx5pmC6ZaTXG4gICAgICBwcmltYXJ5UmVnaW9uOiBwcm9wcy5wcmltYXJ5UmVnaW9uLFxuICAgICAgc2Vjb25kYXJ5UmVnaW9uOiBwcm9wcy5zZWNvbmRhcnlSZWdpb24sXG4gICAgICBoZWFsdGhDaGVja0ludGVydmFsTWludXRlczogNSxcbiAgICAgIGZhaWxvdmVyVGhyZXNob2xkOiAzXG4gICAgfTtcblxuICAgIC8vIOODh+ODvOOCv+ODrOODl+ODquOCseODvOOCt+ODp+ODs+ioreWumlxuICAgIGNvbnN0IHJlcGxpY2F0aW9uQ29uZmlnID0ge1xuICAgICAgcHJpbWFyeVJlZ2lvbjogcHJvcHMucHJpbWFyeVJlZ2lvbixcbiAgICAgIHNlY29uZGFyeVJlZ2lvbjogcHJvcHMuc2Vjb25kYXJ5UmVnaW9uLFxuICAgICAgcmVwbGljYXRpb25JbnRlcnZhbE1pbnV0ZXM6IDE1LFxuICAgICAgYmFja3VwUmV0ZW50aW9uRGF5czogMzAsXG4gICAgICBlbmNyeXB0aW9uRW5hYmxlZDogdHJ1ZVxuICAgIH07XG5cbiAgICAvLyDngb3lrrPlvqnml6fnrqHnkIbjgrfjgrnjg4bjg6BcbiAgICB0aGlzLmRpc2FzdGVyUmVjb3ZlcnlNYW5hZ2VyID0gbmV3IERpc2FzdGVyUmVjb3ZlcnlNYW5hZ2VyKHRoaXMsICdEaXNhc3RlclJlY292ZXJ5TWFuYWdlcicsIHtcbiAgICAgIGdsb2JhbENvbmZpZzogcHJvcHMuZ2xvYmFsQ29uZmlnLFxuICAgICAgZHJDb25maWdcbiAgICB9KTtcblxuICAgIC8vIOODh+ODvOOCv+ODrOODl+ODquOCseODvOOCt+ODp+ODs+euoeeQhuOCt+OCueODhuODoFxuICAgIHRoaXMuZGF0YVJlcGxpY2F0aW9uTWFuYWdlciA9IG5ldyBEYXRhUmVwbGljYXRpb25NYW5hZ2VyKHRoaXMsICdEYXRhUmVwbGljYXRpb25NYW5hZ2VyJywge1xuICAgICAgZ2xvYmFsQ29uZmlnOiBwcm9wcy5nbG9iYWxDb25maWcsXG4gICAgICByZXBsaWNhdGlvbkNvbmZpZ1xuICAgIH0pO1xuXG4gICAgLy8g5qip6ZmQ6Kit5a6aXG4gICAgdGhpcy5zZXR1cFBlcm1pc3Npb25zKCk7XG5cbiAgICAvLyDjgr/jgrDoqK3lrppcbiAgICB0aGlzLnNldHVwVGFncyhwcm9wcy5nbG9iYWxDb25maWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIOaoqemZkOioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBzZXR1cFBlcm1pc3Npb25zKCk6IHZvaWQge1xuICAgIHRoaXMuZGlzYXN0ZXJSZWNvdmVyeU1hbmFnZXIuZ3JhbnRQZXJtaXNzaW9ucygpO1xuICAgIHRoaXMuZGF0YVJlcGxpY2F0aW9uTWFuYWdlci5ncmFudFBlcm1pc3Npb25zKCk7XG4gIH1cblxuICAvKipcbiAgICog44K/44Kw6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIHNldHVwVGFncyhjb25maWc6IEdsb2JhbFJhZ0NvbmZpZyk6IHZvaWQge1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgY29uZmlnLnByb2plY3ROYW1lKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBjb25maWcuZW52aXJvbm1lbnQpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdDb21wb25lbnQnLCAnRGlzYXN0ZXJSZWNvdmVyeScpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdSZWdpb24nLCBjb25maWcucmVnaW9uKTtcbiAgICBUYWdzLm9mKHRoaXMpLmFkZCgnQ29zdENlbnRlcicsICdJbmZyYXN0cnVjdHVyZScpO1xuICAgIFRhZ3Mub2YodGhpcykuYWRkKCdPd25lcicsICdOZXRBcHAtSmFwYW4tVGVjaC1UZWFtJyk7XG4gICAgVGFncy5vZih0aGlzKS5hZGQoJ1B1cnBvc2UnLCAnQnVzaW5lc3MtQ29udGludWl0eScpO1xuICB9XG5cbiAgLyoqXG4gICAqIOWHuuWKm+WApOOBruWumue+qVxuICAgKi9cbiAgcHVibGljIGdldE91dHB1dHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGRpc2FzdGVyUmVjb3ZlcnlTdGF0dXNUYWJsZU5hbWU6IHRoaXMuZGlzYXN0ZXJSZWNvdmVyeU1hbmFnZXIuc3RhdHVzVGFibGUudGFibGVOYW1lLFxuICAgICAgcmVwbGljYXRpb25TdGF0dXNUYWJsZU5hbWU6IHRoaXMuZGF0YVJlcGxpY2F0aW9uTWFuYWdlci5nZXRSZXBsaWNhdGlvblN0YXR1cygpLnRhYmxlTmFtZSxcbiAgICAgIGhlYWx0aENoZWNrRnVuY3Rpb25Bcm46IHRoaXMuZGlzYXN0ZXJSZWNvdmVyeU1hbmFnZXIuaGVhbHRoQ2hlY2tGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGZhaWxvdmVyRnVuY3Rpb25Bcm46IHRoaXMuZGlzYXN0ZXJSZWNvdmVyeU1hbmFnZXIuZmFpbG92ZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGFsZXJ0VG9waWNBcm46IHRoaXMuZGlzYXN0ZXJSZWNvdmVyeU1hbmFnZXIuYWxlcnRUb3BpYy50b3BpY0FyblxuICAgIH07XG4gIH1cbn0iXX0=