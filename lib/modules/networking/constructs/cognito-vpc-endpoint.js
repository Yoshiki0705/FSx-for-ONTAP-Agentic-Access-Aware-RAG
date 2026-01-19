"use strict";
/**
 * Cognito VPC Endpointコンストラクト
 *
 * AWS PrivateLinkを使用してCognito User Poolsへの閉域網接続を提供
 * CDKコンテキスト変数 `cognitoPrivateEndpoint` で有効化
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
exports.CognitoVpcEndpoint = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const constructs_1 = require("constructs");
/**
 * Cognito VPC Endpointコンストラクト
 *
 * AWS PrivateLinkを使用してCognito User Poolsへの閉域網接続を提供します。
 *
 * 使用例:
 * ```typescript
 * const cognitoEndpoint = new CognitoVpcEndpoint(this, 'CognitoEndpoint', {
 *   vpc,
 *   subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
 *   securityGroups: [cognitoEndpointSg],
 *   enabled: true,
 *   projectName: 'permission-aware-rag',
 *   environment: 'prod',
 * });
 * ```
 */
class CognitoVpcEndpoint extends constructs_1.Construct {
    /**
     * 作成されたVPC Endpoint（enabledがtrueの場合のみ）
     */
    vpcEndpoint;
    /**
     * VPC Endpointが有効かどうか
     */
    isEnabled;
    constructor(scope, id, props) {
        super(scope, id);
        // CDKコンテキスト変数からenabled設定を取得（propsが優先）
        const contextEnabled = scope.node.tryGetContext('cognitoPrivateEndpoint') === true;
        this.isEnabled = props.enabled ?? contextEnabled;
        if (!this.isEnabled) {
            console.log('ℹ️  Cognito VPC Endpoint: 無効（Public Endpoint使用）');
            return;
        }
        console.log('✅ Cognito VPC Endpoint: 有効（Private Endpoint使用）');
        // リージョンを取得
        const region = cdk.Stack.of(this).region;
        // Cognito User Pools用のVPC Endpointサービス名
        const serviceName = `com.amazonaws.${region}.cognito-idp`;
        // デフォルトのサブネット選択（プライベートサブネット）
        const subnetSelection = props.subnets ?? {
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        };
        // VPC Endpoint作成
        this.vpcEndpoint = new ec2.InterfaceVpcEndpoint(this, 'CognitoVpcEndpoint', {
            vpc: props.vpc,
            service: new ec2.InterfaceVpcEndpointService(serviceName),
            subnets: subnetSelection,
            securityGroups: props.securityGroups,
            privateDnsEnabled: props.enablePrivateDns ?? true,
        });
        // タグ設定
        cdk.Tags.of(this.vpcEndpoint).add('Name', `${props.projectName}-${props.environment}-cognito-endpoint`);
        cdk.Tags.of(this.vpcEndpoint).add('Service', 'Cognito');
        cdk.Tags.of(this.vpcEndpoint).add('ConnectionType', 'PrivateLink');
        cdk.Tags.of(this.vpcEndpoint).add('Project', props.projectName);
        cdk.Tags.of(this.vpcEndpoint).add('Environment', props.environment);
        // 出力値
        new cdk.CfnOutput(this, 'CognitoVpcEndpointId', {
            value: this.vpcEndpoint.vpcEndpointId,
            description: 'Cognito VPC Endpoint ID',
            exportName: `${cdk.Stack.of(this).stackName}-CognitoVpcEndpointId`,
        });
        new cdk.CfnOutput(this, 'CognitoVpcEndpointDnsEntries', {
            value: cdk.Fn.join(',', this.vpcEndpoint.vpcEndpointDnsEntries),
            description: 'Cognito VPC Endpoint DNS Entries',
            exportName: `${cdk.Stack.of(this).stackName}-CognitoVpcEndpointDnsEntries`,
        });
        console.log(`📝 Cognito VPC Endpoint作成完了: ${serviceName}`);
    }
    /**
     * VPC EndpointのDNSエントリを取得
     */
    getDnsEntries() {
        return this.vpcEndpoint?.vpcEndpointDnsEntries ?? [];
    }
    /**
     * VPC Endpoint IDを取得
     */
    getEndpointId() {
        return this.vpcEndpoint?.vpcEndpointId;
    }
}
exports.CognitoVpcEndpoint = CognitoVpcEndpoint;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29nbml0by12cGMtZW5kcG9pbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjb2duaXRvLXZwYy1lbmRwb2ludC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQywyQ0FBdUM7QUEyQ3ZDOzs7Ozs7Ozs7Ozs7Ozs7O0dBZ0JHO0FBQ0gsTUFBYSxrQkFBbUIsU0FBUSxzQkFBUztJQUMvQzs7T0FFRztJQUNhLFdBQVcsQ0FBNEI7SUFFdkQ7O09BRUc7SUFDYSxTQUFTLENBQVU7SUFFbkMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE4QjtRQUN0RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLHNDQUFzQztRQUN0QyxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLElBQUksQ0FBQztRQUNuRixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQyxPQUFPLElBQUksY0FBYyxDQUFDO1FBRWpELElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDcEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO1lBQy9ELE9BQU87UUFDVCxDQUFDO1FBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnREFBZ0QsQ0FBQyxDQUFDO1FBRTlELFdBQVc7UUFDWCxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFFekMsd0NBQXdDO1FBQ3hDLE1BQU0sV0FBVyxHQUFHLGlCQUFpQixNQUFNLGNBQWMsQ0FBQztRQUUxRCw2QkFBNkI7UUFDN0IsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLE9BQU8sSUFBSTtZQUN2QyxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxtQkFBbUI7U0FDL0MsQ0FBQztRQUVGLGlCQUFpQjtRQUNqQixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksR0FBRyxDQUFDLG9CQUFvQixDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUMxRSxHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUc7WUFDZCxPQUFPLEVBQUUsSUFBSSxHQUFHLENBQUMsMkJBQTJCLENBQUMsV0FBVyxDQUFDO1lBQ3pELE9BQU8sRUFBRSxlQUFlO1lBQ3hCLGNBQWMsRUFBRSxLQUFLLENBQUMsY0FBYztZQUNwQyxpQkFBaUIsRUFBRSxLQUFLLENBQUMsZ0JBQWdCLElBQUksSUFBSTtTQUNsRCxDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQyxXQUFXLG1CQUFtQixDQUFDLENBQUM7UUFDeEcsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDeEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUNuRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDaEUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXBFLE1BQU07UUFDTixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzlDLEtBQUssRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLGFBQWE7WUFDckMsV0FBVyxFQUFFLHlCQUF5QjtZQUN0QyxVQUFVLEVBQUUsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLHVCQUF1QjtTQUNuRSxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDhCQUE4QixFQUFFO1lBQ3RELEtBQUssRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxxQkFBcUIsQ0FBQztZQUMvRCxXQUFXLEVBQUUsa0NBQWtDO1lBQy9DLFVBQVUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsK0JBQStCO1NBQzNFLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0NBQWdDLFdBQVcsRUFBRSxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUVEOztPQUVHO0lBQ0ksYUFBYTtRQUNsQixPQUFPLElBQUksQ0FBQyxXQUFXLEVBQUUscUJBQXFCLElBQUksRUFBRSxDQUFDO0lBQ3ZELENBQUM7SUFFRDs7T0FFRztJQUNJLGFBQWE7UUFDbEIsT0FBTyxJQUFJLENBQUMsV0FBVyxFQUFFLGFBQWEsQ0FBQztJQUN6QyxDQUFDO0NBQ0Y7QUFqRkQsZ0RBaUZDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb2duaXRvIFZQQyBFbmRwb2ludOOCs+ODs+OCueODiOODqeOCr+ODiFxuICogXG4gKiBBV1MgUHJpdmF0ZUxpbmvjgpLkvb/nlKjjgZfjgaZDb2duaXRvIFVzZXIgUG9vbHPjgbjjga7plonln5/ntrLmjqXntprjgpLmj5DkvptcbiAqIENES+OCs+ODs+ODhuOCreOCueODiOWkieaVsCBgY29nbml0b1ByaXZhdGVFbmRwb2ludGAg44Gn5pyJ5Yq55YyWXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvZ25pdG9WcGNFbmRwb2ludFByb3BzIHtcbiAgLyoqXG4gICAqIFZQQyBFbmRwb2ludOOCkuS9nOaIkOOBmeOCi1ZQQ1xuICAgKi9cbiAgdnBjOiBlYzIuSVZwYztcblxuICAvKipcbiAgICogVlBDIEVuZHBvaW5044KS6YWN572u44GZ44KL44K144OW44ON44OD44OIXG4gICAqIOODl+ODqeOCpOODmeODvOODiOOCteODluODjeODg+ODiOOCkuaOqOWlqFxuICAgKi9cbiAgc3VibmV0cz86IGVjMi5TdWJuZXRTZWxlY3Rpb247XG5cbiAgLyoqXG4gICAqIFZQQyBFbmRwb2ludOOBq+mWoumAo+S7mOOBkeOCi+OCu+OCreODpeODquODhuOCo+OCsOODq+ODvOODl1xuICAgKi9cbiAgc2VjdXJpdHlHcm91cHM/OiBlYzIuSVNlY3VyaXR5R3JvdXBbXTtcblxuICAvKipcbiAgICog44OX44Op44Kk44OZ44O844OIRE5T44KS5pyJ5Yq55YyW44GZ44KL44GL44Gp44GG44GLXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIGVuYWJsZVByaXZhdGVEbnM/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBWUEMgRW5kcG9pbnTjgpLkvZzmiJDjgZnjgovjgYvjganjgYbjgYtcbiAgICogQ0RL44Kz44Oz44OG44Kt44K544OI5aSJ5pWwIGBjb2duaXRvUHJpdmF0ZUVuZHBvaW50YCDjgafliLblvqFcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIGVuYWJsZWQ/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDjg5fjg63jgrjjgqfjgq/jg4jlkI3vvIjjgr/jgrDku5jjgZHnlKjvvIlcbiAgICovXG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOeSsOWig+WQje+8iOOCv+OCsOS7mOOBkeeUqO+8iVxuICAgKi9cbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbn1cblxuLyoqXG4gKiBDb2duaXRvIFZQQyBFbmRwb2ludOOCs+ODs+OCueODiOODqeOCr+ODiFxuICogXG4gKiBBV1MgUHJpdmF0ZUxpbmvjgpLkvb/nlKjjgZfjgaZDb2duaXRvIFVzZXIgUG9vbHPjgbjjga7plonln5/ntrLmjqXntprjgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqIFxuICog5L2/55So5L6LOlxuICogYGBgdHlwZXNjcmlwdFxuICogY29uc3QgY29nbml0b0VuZHBvaW50ID0gbmV3IENvZ25pdG9WcGNFbmRwb2ludCh0aGlzLCAnQ29nbml0b0VuZHBvaW50Jywge1xuICogICB2cGMsXG4gKiAgIHN1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxuICogICBzZWN1cml0eUdyb3VwczogW2NvZ25pdG9FbmRwb2ludFNnXSxcbiAqICAgZW5hYmxlZDogdHJ1ZSxcbiAqICAgcHJvamVjdE5hbWU6ICdwZXJtaXNzaW9uLWF3YXJlLXJhZycsXG4gKiAgIGVudmlyb25tZW50OiAncHJvZCcsXG4gKiB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgQ29nbml0b1ZwY0VuZHBvaW50IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgLyoqXG4gICAqIOS9nOaIkOOBleOCjOOBn1ZQQyBFbmRwb2ludO+8iGVuYWJsZWTjgYx0cnVl44Gu5aC05ZCI44Gu44G/77yJXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgdnBjRW5kcG9pbnQ/OiBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnQ7XG5cbiAgLyoqXG4gICAqIFZQQyBFbmRwb2ludOOBjOacieWKueOBi+OBqeOBhuOBi1xuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGlzRW5hYmxlZDogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQ29nbml0b1ZwY0VuZHBvaW50UHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8gQ0RL44Kz44Oz44OG44Kt44K544OI5aSJ5pWw44GL44KJZW5hYmxlZOioreWumuOCkuWPluW+l++8iHByb3Bz44GM5YSq5YWI77yJXG4gICAgY29uc3QgY29udGV4dEVuYWJsZWQgPSBzY29wZS5ub2RlLnRyeUdldENvbnRleHQoJ2NvZ25pdG9Qcml2YXRlRW5kcG9pbnQnKSA9PT0gdHJ1ZTtcbiAgICB0aGlzLmlzRW5hYmxlZCA9IHByb3BzLmVuYWJsZWQgPz8gY29udGV4dEVuYWJsZWQ7XG5cbiAgICBpZiAoIXRoaXMuaXNFbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn4oS577iPICBDb2duaXRvIFZQQyBFbmRwb2ludDog54Sh5Yq577yIUHVibGljIEVuZHBvaW505L2/55So77yJJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ+KchSBDb2duaXRvIFZQQyBFbmRwb2ludDog5pyJ5Yq577yIUHJpdmF0ZSBFbmRwb2ludOS9v+eUqO+8iScpO1xuXG4gICAgLy8g44Oq44O844K444On44Oz44KS5Y+W5b6XXG4gICAgY29uc3QgcmVnaW9uID0gY2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbjtcblxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sc+eUqOOBrlZQQyBFbmRwb2ludOOCteODvOODk+OCueWQjVxuICAgIGNvbnN0IHNlcnZpY2VOYW1lID0gYGNvbS5hbWF6b25hd3MuJHtyZWdpb259LmNvZ25pdG8taWRwYDtcblxuICAgIC8vIOODh+ODleOCqeODq+ODiOOBruOCteODluODjeODg+ODiOmBuOaKnu+8iOODl+ODqeOCpOODmeODvOODiOOCteODluODjeODg+ODiO+8iVxuICAgIGNvbnN0IHN1Ym5ldFNlbGVjdGlvbiA9IHByb3BzLnN1Ym5ldHMgPz8ge1xuICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICB9O1xuXG4gICAgLy8gVlBDIEVuZHBvaW505L2c5oiQXG4gICAgdGhpcy52cGNFbmRwb2ludCA9IG5ldyBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnQodGhpcywgJ0NvZ25pdG9WcGNFbmRwb2ludCcsIHtcbiAgICAgIHZwYzogcHJvcHMudnBjLFxuICAgICAgc2VydmljZTogbmV3IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludFNlcnZpY2Uoc2VydmljZU5hbWUpLFxuICAgICAgc3VibmV0czogc3VibmV0U2VsZWN0aW9uLFxuICAgICAgc2VjdXJpdHlHcm91cHM6IHByb3BzLnNlY3VyaXR5R3JvdXBzLFxuICAgICAgcHJpdmF0ZURuc0VuYWJsZWQ6IHByb3BzLmVuYWJsZVByaXZhdGVEbnMgPz8gdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIOOCv+OCsOioreWumlxuICAgIGNkay5UYWdzLm9mKHRoaXMudnBjRW5kcG9pbnQpLmFkZCgnTmFtZScsIGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1jb2duaXRvLWVuZHBvaW50YCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy52cGNFbmRwb2ludCkuYWRkKCdTZXJ2aWNlJywgJ0NvZ25pdG8nKTtcbiAgICBjZGsuVGFncy5vZih0aGlzLnZwY0VuZHBvaW50KS5hZGQoJ0Nvbm5lY3Rpb25UeXBlJywgJ1ByaXZhdGVMaW5rJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcy52cGNFbmRwb2ludCkuYWRkKCdQcm9qZWN0JywgcHJvcHMucHJvamVjdE5hbWUpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMudnBjRW5kcG9pbnQpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG5cbiAgICAvLyDlh7rlipvlgKRcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29nbml0b1ZwY0VuZHBvaW50SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy52cGNFbmRwb2ludC52cGNFbmRwb2ludElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFZQQyBFbmRwb2ludCBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgJHtjZGsuU3RhY2sub2YodGhpcykuc3RhY2tOYW1lfS1Db2duaXRvVnBjRW5kcG9pbnRJZGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29nbml0b1ZwY0VuZHBvaW50RG5zRW50cmllcycsIHtcbiAgICAgIHZhbHVlOiBjZGsuRm4uam9pbignLCcsIHRoaXMudnBjRW5kcG9pbnQudnBjRW5kcG9pbnREbnNFbnRyaWVzKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBWUEMgRW5kcG9pbnQgRE5TIEVudHJpZXMnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7Y2RrLlN0YWNrLm9mKHRoaXMpLnN0YWNrTmFtZX0tQ29nbml0b1ZwY0VuZHBvaW50RG5zRW50cmllc2AsXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZyhg8J+TnSBDb2duaXRvIFZQQyBFbmRwb2ludOS9nOaIkOWujOS6hjogJHtzZXJ2aWNlTmFtZX1gKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBWUEMgRW5kcG9pbnTjga5ETlPjgqjjg7Pjg4jjg6rjgpLlj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXREbnNFbnRyaWVzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gdGhpcy52cGNFbmRwb2ludD8udnBjRW5kcG9pbnREbnNFbnRyaWVzID8/IFtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFZQQyBFbmRwb2ludCBJROOCkuWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldEVuZHBvaW50SWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy52cGNFbmRwb2ludD8udnBjRW5kcG9pbnRJZDtcbiAgfVxufVxuIl19