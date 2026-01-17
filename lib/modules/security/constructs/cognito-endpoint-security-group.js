"use strict";
/**
 * Cognito VPC Endpoint用セキュリティグループコンストラクト
 *
 * VPC内からのHTTPS通信を許可し、Cognito User Poolsへの閉域網接続を実現
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CognitoEndpointSecurityGroup = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const constructs_1 = require("constructs");
/**
 * Cognito VPC Endpoint用セキュリティグループコンストラクト
 *
 * VPC内からのHTTPS（ポート443）通信を許可し、
 * Cognito User Poolsへの閉域網接続を実現します。
 *
 * 使用例:
 * ```typescript
 * const cognitoSg = new CognitoEndpointSecurityGroup(this, 'CognitoSG', {
 *   vpc,
 *   enabled: true,
 *   projectName: 'permission-aware-rag',
 *   environment: 'prod',
 * });
 * ```
 */
class CognitoEndpointSecurityGroup extends constructs_1.Construct {
    /**
     * 作成されたセキュリティグループ（enabledがtrueの場合のみ）
     */
    securityGroup;
    /**
     * セキュリティグループが有効かどうか
     */
    isEnabled;
    constructor(scope, id, props) {
        super(scope, id);
        // CDKコンテキスト変数からenabled設定を取得（propsが優先）
        const contextEnabled = scope.node.tryGetContext('cognitoPrivateEndpoint') === true;
        this.isEnabled = props.enabled ?? contextEnabled;
        if (!this.isEnabled) {
            console.log('ℹ️  Cognito Endpoint Security Group: 無効');
            return;
        }
        console.log('✅ Cognito Endpoint Security Group: 有効');
        // セキュリティグループ作成
        this.securityGroup = new ec2.SecurityGroup(this, 'CognitoEndpointSecurityGroup', {
            vpc: props.vpc,
            description: props.description ?? 'Security group for Cognito VPC Endpoint',
            allowAllOutbound: true, // Cognitoへのアウトバウンド通信を許可
        });
        // インバウンドルール: VPC内からのHTTPS通信を許可
        const allowedCidrs = props.allowedCidrs ?? [props.vpc.vpcCidrBlock];
        allowedCidrs.forEach((cidr, index) => {
            this.securityGroup.addIngressRule(ec2.Peer.ipv4(cidr), ec2.Port.tcp(443), `Allow HTTPS from ${cidr}`);
            console.log(`📝 インバウンドルール追加: ${cidr} → 443/tcp`);
        });
        // タグ設定
        cdk.Tags.of(this.securityGroup).add('Name', `${props.projectName}-${props.environment}-cognito-endpoint-sg`);
        cdk.Tags.of(this.securityGroup).add('Service', 'Cognito');
        cdk.Tags.of(this.securityGroup).add('Purpose', 'VPC-Endpoint');
        cdk.Tags.of(this.securityGroup).add('Project', props.projectName);
        cdk.Tags.of(this.securityGroup).add('Environment', props.environment);
        // 出力値
        new cdk.CfnOutput(this, 'CognitoEndpointSecurityGroupId', {
            value: this.securityGroup.securityGroupId,
            description: 'Cognito VPC Endpoint Security Group ID',
            exportName: `${cdk.Stack.of(this).stackName}-CognitoEndpointSecurityGroupId`,
        });
        console.log(`📝 Cognito Endpoint Security Group作成完了: ${this.securityGroup.securityGroupId}`);
    }
    /**
     * セキュリティグループIDを取得
     */
    getSecurityGroupId() {
        return this.securityGroup?.securityGroupId;
    }
    /**
     * Lambda関数などからの接続を許可
     *
     * @param peer 接続元（セキュリティグループまたはCIDR）
     * @param description ルールの説明
     */
    allowConnectionFrom(peer, description) {
        if (!this.securityGroup) {
            console.warn('⚠️  セキュリティグループが無効のため、接続許可を追加できません');
            return;
        }
        this.securityGroup.addIngressRule(peer, ec2.Port.tcp(443), description ?? 'Allow HTTPS connection');
        console.log(`📝 接続許可追加: ${description ?? 'Custom peer'}`);
    }
}
exports.CognitoEndpointSecurityGroup = CognitoEndpointSecurityGroup;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29nbml0by1lbmRwb2ludC1zZWN1cml0eS1ncm91cC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvZ25pdG8tZW5kcG9pbnQtc2VjdXJpdHktZ3JvdXAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQywyQ0FBdUM7QUFzQ3ZDOzs7Ozs7Ozs7Ozs7Ozs7R0FlRztBQUNILE1BQWEsNEJBQTZCLFNBQVEsc0JBQVM7SUFDekQ7O09BRUc7SUFDYSxhQUFhLENBQXFCO0lBRWxEOztPQUVHO0lBQ2EsU0FBUyxDQUFVO0lBRW5DLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0M7UUFDaEYsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixzQ0FBc0M7UUFDdEMsTUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsS0FBSyxJQUFJLENBQUM7UUFDbkYsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsT0FBTyxJQUFJLGNBQWMsQ0FBQztRQUVqRCxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3BCLE9BQU8sQ0FBQyxHQUFHLENBQUMseUNBQXlDLENBQUMsQ0FBQztZQUN2RCxPQUFPO1FBQ1QsQ0FBQztRQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMsdUNBQXVDLENBQUMsQ0FBQztRQUVyRCxlQUFlO1FBQ2YsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLDhCQUE4QixFQUFFO1lBQy9FLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRztZQUNkLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVyxJQUFJLHlDQUF5QztZQUMzRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsd0JBQXdCO1NBQ2pELENBQUMsQ0FBQztRQUVILCtCQUErQjtRQUMvQixNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsWUFBWSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUVwRSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ25DLElBQUksQ0FBQyxhQUFjLENBQUMsY0FBYyxDQUNoQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFDbkIsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQ2pCLG9CQUFvQixJQUFJLEVBQUUsQ0FDM0IsQ0FBQztZQUVGLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLElBQUksWUFBWSxDQUFDLENBQUM7UUFDbkQsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQyxXQUFXLHNCQUFzQixDQUFDLENBQUM7UUFDN0csR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDMUQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDL0QsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ2xFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUV0RSxNQUFNO1FBQ04sSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxnQ0FBZ0MsRUFBRTtZQUN4RCxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxlQUFlO1lBQ3pDLFdBQVcsRUFBRSx3Q0FBd0M7WUFDckQsVUFBVSxFQUFFLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxpQ0FBaUM7U0FDN0UsQ0FBQyxDQUFDO1FBRUgsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQ0FBMkMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDO0lBQy9GLENBQUM7SUFFRDs7T0FFRztJQUNJLGtCQUFrQjtRQUN2QixPQUFPLElBQUksQ0FBQyxhQUFhLEVBQUUsZUFBZSxDQUFDO0lBQzdDLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNJLG1CQUFtQixDQUFDLElBQWUsRUFBRSxXQUFvQjtRQUM5RCxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3hCLE9BQU8sQ0FBQyxJQUFJLENBQUMsbUNBQW1DLENBQUMsQ0FBQztZQUNsRCxPQUFPO1FBQ1QsQ0FBQztRQUVELElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUMvQixJQUFJLEVBQ0osR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQ2pCLFdBQVcsSUFBSSx3QkFBd0IsQ0FDeEMsQ0FBQztRQUVGLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxXQUFXLElBQUksYUFBYSxFQUFFLENBQUMsQ0FBQztJQUM1RCxDQUFDO0NBQ0Y7QUF6RkQsb0VBeUZDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb2duaXRvIFZQQyBFbmRwb2ludOeUqOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OCs+ODs+OCueODiOODqeOCr+ODiFxuICogXG4gKiBWUEPlhoXjgYvjgonjga5IVFRQU+mAmuS/oeOCkuioseWPr+OBl+OAgUNvZ25pdG8gVXNlciBQb29sc+OBuOOBrumWieWfn+e2suaOpee2muOCkuWun+ePvlxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBDb2duaXRvRW5kcG9pbnRTZWN1cml0eUdyb3VwUHJvcHMge1xuICAvKipcbiAgICog44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44KS5L2c5oiQ44GZ44KLVlBDXG4gICAqL1xuICB2cGM6IGVjMi5JVnBjO1xuXG4gIC8qKlxuICAgKiDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjga7oqqzmmI5cbiAgICogQGRlZmF1bHQgJ1NlY3VyaXR5IGdyb3VwIGZvciBDb2duaXRvIFZQQyBFbmRwb2ludCdcbiAgICovXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDjgqTjg7Pjg5Djgqbjg7Pjg4njg4jjg6njg5XjgqPjg4Pjgq/jgpLoqLHlj6/jgZnjgotDSURS44OW44Ot44OD44KvXG4gICAqIEBkZWZhdWx0IFZQQyBDSURSXG4gICAqL1xuICBhbGxvd2VkQ2lkcnM/OiBzdHJpbmdbXTtcblxuICAvKipcbiAgICog44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX44KS5L2c5oiQ44GZ44KL44GL44Gp44GG44GLXG4gICAqIENES+OCs+ODs+ODhuOCreOCueODiOWkieaVsCBgY29nbml0b1ByaXZhdGVFbmRwb2ludGAg44Gn5Yi25b6hXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICBlbmFibGVkPzogYm9vbGVhbjtcblxuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5ZCN77yI44K/44Kw5LuY44GR55So77yJXG4gICAqL1xuICBwcm9qZWN0TmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDnkrDlooPlkI3vvIjjgr/jgrDku5jjgZHnlKjvvIlcbiAgICovXG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG59XG5cbi8qKlxuICogQ29nbml0byBWUEMgRW5kcG9pbnTnlKjjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjgrPjg7Pjgrnjg4jjg6njgq/jg4hcbiAqIFxuICogVlBD5YaF44GL44KJ44GuSFRUUFPvvIjjg53jg7zjg4g0NDPvvInpgJrkv6HjgpLoqLHlj6/jgZfjgIFcbiAqIENvZ25pdG8gVXNlciBQb29sc+OBuOOBrumWieWfn+e2suaOpee2muOCkuWun+ePvuOBl+OBvuOBmeOAglxuICogXG4gKiDkvb/nlKjkvos6XG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCBjb2duaXRvU2cgPSBuZXcgQ29nbml0b0VuZHBvaW50U2VjdXJpdHlHcm91cCh0aGlzLCAnQ29nbml0b1NHJywge1xuICogICB2cGMsXG4gKiAgIGVuYWJsZWQ6IHRydWUsXG4gKiAgIHByb2plY3ROYW1lOiAncGVybWlzc2lvbi1hd2FyZS1yYWcnLFxuICogICBlbnZpcm9ubWVudDogJ3Byb2QnLFxuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIENvZ25pdG9FbmRwb2ludFNlY3VyaXR5R3JvdXAgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAvKipcbiAgICog5L2c5oiQ44GV44KM44Gf44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX77yIZW5hYmxlZOOBjHRydWXjga7loLTlkIjjga7jgb/vvIlcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBzZWN1cml0eUdyb3VwPzogZWMyLlNlY3VyaXR5R3JvdXA7XG5cbiAgLyoqXG4gICAqIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OBjOacieWKueOBi+OBqeOBhuOBi1xuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGlzRW5hYmxlZDogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQ29nbml0b0VuZHBvaW50U2VjdXJpdHlHcm91cFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIENES+OCs+ODs+ODhuOCreOCueODiOWkieaVsOOBi+OCiWVuYWJsZWToqK3lrprjgpLlj5blvpfvvIhwcm9wc+OBjOWEquWFiO+8iVxuICAgIGNvbnN0IGNvbnRleHRFbmFibGVkID0gc2NvcGUubm9kZS50cnlHZXRDb250ZXh0KCdjb2duaXRvUHJpdmF0ZUVuZHBvaW50JykgPT09IHRydWU7XG4gICAgdGhpcy5pc0VuYWJsZWQgPSBwcm9wcy5lbmFibGVkID8/IGNvbnRleHRFbmFibGVkO1xuXG4gICAgaWYgKCF0aGlzLmlzRW5hYmxlZCkge1xuICAgICAgY29uc29sZS5sb2coJ+KEue+4jyAgQ29nbml0byBFbmRwb2ludCBTZWN1cml0eSBHcm91cDog54Sh5Yq5Jyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ+KchSBDb2duaXRvIEVuZHBvaW50IFNlY3VyaXR5IEdyb3VwOiDmnInlirknKTtcblxuICAgIC8vIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+S9nOaIkFxuICAgIHRoaXMuc2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnQ29nbml0b0VuZHBvaW50U2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYzogcHJvcHMudnBjLFxuICAgICAgZGVzY3JpcHRpb246IHByb3BzLmRlc2NyaXB0aW9uID8/ICdTZWN1cml0eSBncm91cCBmb3IgQ29nbml0byBWUEMgRW5kcG9pbnQnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSwgLy8gQ29nbml0b+OBuOOBruOCouOCpuODiOODkOOCpuODs+ODiemAmuS/oeOCkuioseWPr1xuICAgIH0pO1xuXG4gICAgLy8g44Kk44Oz44OQ44Km44Oz44OJ44Or44O844OrOiBWUEPlhoXjgYvjgonjga5IVFRQU+mAmuS/oeOCkuioseWPr1xuICAgIGNvbnN0IGFsbG93ZWRDaWRycyA9IHByb3BzLmFsbG93ZWRDaWRycyA/PyBbcHJvcHMudnBjLnZwY0NpZHJCbG9ja107XG4gICAgXG4gICAgYWxsb3dlZENpZHJzLmZvckVhY2goKGNpZHIsIGluZGV4KSA9PiB7XG4gICAgICB0aGlzLnNlY3VyaXR5R3JvdXAhLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgICBlYzIuUGVlci5pcHY0KGNpZHIpLFxuICAgICAgICBlYzIuUG9ydC50Y3AoNDQzKSxcbiAgICAgICAgYEFsbG93IEhUVFBTIGZyb20gJHtjaWRyfWBcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGDwn5OdIOOCpOODs+ODkOOCpuODs+ODieODq+ODvOODq+i/veWKoDogJHtjaWRyfSDihpIgNDQzL3RjcGApO1xuICAgIH0pO1xuXG4gICAgLy8g44K/44Kw6Kit5a6aXG4gICAgY2RrLlRhZ3Mub2YodGhpcy5zZWN1cml0eUdyb3VwKS5hZGQoJ05hbWUnLCBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tY29nbml0by1lbmRwb2ludC1zZ2ApO1xuICAgIGNkay5UYWdzLm9mKHRoaXMuc2VjdXJpdHlHcm91cCkuYWRkKCdTZXJ2aWNlJywgJ0NvZ25pdG8nKTtcbiAgICBjZGsuVGFncy5vZih0aGlzLnNlY3VyaXR5R3JvdXApLmFkZCgnUHVycG9zZScsICdWUEMtRW5kcG9pbnQnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzLnNlY3VyaXR5R3JvdXApLmFkZCgnUHJvamVjdCcsIHByb3BzLnByb2plY3ROYW1lKTtcbiAgICBjZGsuVGFncy5vZih0aGlzLnNlY3VyaXR5R3JvdXApLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG5cbiAgICAvLyDlh7rlipvlgKRcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29nbml0b0VuZHBvaW50U2VjdXJpdHlHcm91cElkJywge1xuICAgICAgdmFsdWU6IHRoaXMuc2VjdXJpdHlHcm91cC5zZWN1cml0eUdyb3VwSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVlBDIEVuZHBvaW50IFNlY3VyaXR5IEdyb3VwIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Nkay5TdGFjay5vZih0aGlzKS5zdGFja05hbWV9LUNvZ25pdG9FbmRwb2ludFNlY3VyaXR5R3JvdXBJZGAsXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZyhg8J+TnSBDb2duaXRvIEVuZHBvaW50IFNlY3VyaXR5IEdyb3Vw5L2c5oiQ5a6M5LqGOiAke3RoaXMuc2VjdXJpdHlHcm91cC5zZWN1cml0eUdyb3VwSWR9YCk7XG4gIH1cblxuICAvKipcbiAgICog44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OXSUTjgpLlj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRTZWN1cml0eUdyb3VwSWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5zZWN1cml0eUdyb3VwPy5zZWN1cml0eUdyb3VwSWQ7XG4gIH1cblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44Gq44Gp44GL44KJ44Gu5o6l57aa44KS6Kix5Y+vXG4gICAqIFxuICAgKiBAcGFyYW0gcGVlciDmjqXntprlhYPvvIjjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjgb7jgZ/jga9DSURS77yJXG4gICAqIEBwYXJhbSBkZXNjcmlwdGlvbiDjg6vjg7zjg6vjga7oqqzmmI5cbiAgICovXG4gIHB1YmxpYyBhbGxvd0Nvbm5lY3Rpb25Gcm9tKHBlZXI6IGVjMi5JUGVlciwgZGVzY3JpcHRpb24/OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuc2VjdXJpdHlHcm91cCkge1xuICAgICAgY29uc29sZS53YXJuKCfimqDvuI8gIOOCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl+OBjOeEoeWKueOBruOBn+OCgeOAgeaOpee2muioseWPr+OCkui/veWKoOOBp+OBjeOBvuOBm+OCkycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIHBlZXIsXG4gICAgICBlYzIuUG9ydC50Y3AoNDQzKSxcbiAgICAgIGRlc2NyaXB0aW9uID8/ICdBbGxvdyBIVFRQUyBjb25uZWN0aW9uJ1xuICAgICk7XG5cbiAgICBjb25zb2xlLmxvZyhg8J+TnSDmjqXntproqLHlj6/ov73liqA6ICR7ZGVzY3JpcHRpb24gPz8gJ0N1c3RvbSBwZWVyJ31gKTtcbiAgfVxufVxuIl19