"use strict";
/**
 * セキュリティメトリクスダッシュボード
 * VPC Endpoint、Cognito認証、Lambda VPC接続のメトリクスを可視化
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
exports.SecurityMetricsDashboard = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const constructs_1 = require("constructs");
class SecurityMetricsDashboard extends constructs_1.Construct {
    dashboard;
    constructor(scope, id, props) {
        super(scope, id);
        // CloudWatchダッシュボード作成
        this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
            dashboardName: props.dashboardName,
        });
        // ウィジェット配列
        const widgets = [];
        // タイトルウィジェット
        widgets.push(new cloudwatch.TextWidget({
            markdown: `# ${props.projectName} セキュリティメトリクス\n環境: ${props.environment}\n更新: ${new Date().toISOString()}`,
            width: 24,
            height: 2,
        }));
        // VPC Endpointメトリクス（存在する場合）
        if (props.vpcEndpoint) {
            widgets.push(...this.createVpcEndpointWidgets(props));
        }
        // Cognitoメトリクス（User Pool IDが指定されている場合）
        if (props.cognitoUserPoolId) {
            widgets.push(...this.createCognitoWidgets(props));
        }
        // Lambda VPC接続メトリクス（Lambda関数が指定されている場合）
        if (props.lambdaFunctions && props.lambdaFunctions.length > 0) {
            widgets.push(...this.createLambdaVpcWidgets(props));
        }
        // 全ウィジェットをダッシュボードに追加
        widgets.forEach((widget) => {
            this.dashboard.addWidgets(widget);
        });
    }
    /**
     * VPC Endpointメトリクスウィジェット作成
     */
    createVpcEndpointWidgets(props) {
        const widgets = [];
        // セクションタイトル
        widgets.push(new cloudwatch.TextWidget({
            markdown: '## VPC Endpoint メトリクス',
            width: 24,
            height: 1,
        }));
        // VPC Endpoint接続数
        const connectionMetric = new cloudwatch.Metric({
            namespace: 'AWS/PrivateLink',
            metricName: 'ActiveConnections',
            dimensionsMap: {
                VpcEndpointId: props.vpcEndpoint.vpcEndpointId,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
        });
        // VPC Endpointバイト数（送信）
        const bytesOutMetric = new cloudwatch.Metric({
            namespace: 'AWS/PrivateLink',
            metricName: 'BytesProcessed',
            dimensionsMap: {
                VpcEndpointId: props.vpcEndpoint.vpcEndpointId,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
        });
        // VPC Endpointパケット数
        const packetsMetric = new cloudwatch.Metric({
            namespace: 'AWS/PrivateLink',
            metricName: 'PacketsProcessed',
            dimensionsMap: {
                VpcEndpointId: props.vpcEndpoint.vpcEndpointId,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
        });
        // グラフウィジェット
        widgets.push(new cloudwatch.GraphWidget({
            title: 'VPC Endpoint - アクティブ接続数',
            left: [connectionMetric],
            width: 12,
            height: 6,
            leftYAxis: {
                label: '接続数',
                showUnits: false,
            },
        }));
        widgets.push(new cloudwatch.GraphWidget({
            title: 'VPC Endpoint - データ転送量',
            left: [bytesOutMetric],
            width: 12,
            height: 6,
            leftYAxis: {
                label: 'バイト',
                showUnits: false,
            },
        }));
        widgets.push(new cloudwatch.GraphWidget({
            title: 'VPC Endpoint - パケット数',
            left: [packetsMetric],
            width: 12,
            height: 6,
            leftYAxis: {
                label: 'パケット',
                showUnits: false,
            },
        }));
        return widgets;
    }
    /**
     * Cognitoメトリクスウィジェット作成
     */
    createCognitoWidgets(props) {
        const widgets = [];
        // セクションタイトル
        widgets.push(new cloudwatch.TextWidget({
            markdown: '## Cognito 認証メトリクス',
            width: 24,
            height: 1,
        }));
        // サインイン成功数
        const signInSuccessMetric = new cloudwatch.Metric({
            namespace: 'AWS/Cognito',
            metricName: 'UserAuthentication',
            dimensionsMap: {
                UserPool: props.cognitoUserPoolId,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
        });
        // サインイン失敗数
        const signInFailureMetric = new cloudwatch.Metric({
            namespace: 'AWS/Cognito',
            metricName: 'UserAuthenticationFailure',
            dimensionsMap: {
                UserPool: props.cognitoUserPoolId,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
        });
        // トークンリフレッシュ数
        const tokenRefreshMetric = new cloudwatch.Metric({
            namespace: 'AWS/Cognito',
            metricName: 'TokenRefreshSuccesses',
            dimensionsMap: {
                UserPool: props.cognitoUserPoolId,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
        });
        // グラフウィジェット
        widgets.push(new cloudwatch.GraphWidget({
            title: 'Cognito - 認証成功/失敗',
            left: [signInSuccessMetric, signInFailureMetric],
            width: 12,
            height: 6,
            leftYAxis: {
                label: '回数',
                showUnits: false,
            },
        }));
        widgets.push(new cloudwatch.GraphWidget({
            title: 'Cognito - トークンリフレッシュ',
            left: [tokenRefreshMetric],
            width: 12,
            height: 6,
            leftYAxis: {
                label: '回数',
                showUnits: false,
            },
        }));
        // 認証失敗率の計算メトリクス
        const failureRateMetric = new cloudwatch.MathExpression({
            expression: '(m2 / (m1 + m2)) * 100',
            usingMetrics: {
                m1: signInSuccessMetric,
                m2: signInFailureMetric,
            },
            label: '認証失敗率 (%)',
            period: cdk.Duration.minutes(5),
        });
        widgets.push(new cloudwatch.GraphWidget({
            title: 'Cognito - 認証失敗率',
            left: [failureRateMetric],
            width: 12,
            height: 6,
            leftYAxis: {
                label: '失敗率 (%)',
                showUnits: false,
            },
        }));
        return widgets;
    }
    /**
     * Lambda VPC接続メトリクスウィジェット作成
     */
    createLambdaVpcWidgets(props) {
        const widgets = [];
        // セクションタイトル
        widgets.push(new cloudwatch.TextWidget({
            markdown: '## Lambda VPC 接続メトリクス',
            width: 24,
            height: 1,
        }));
        props.lambdaFunctions.forEach((fn, index) => {
            // Lambda実行時間
            const durationMetric = fn.metricDuration({
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
            });
            // Lambda エラー数
            const errorsMetric = fn.metricErrors({
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            });
            // Lambda スロットル数
            const throttlesMetric = fn.metricThrottles({
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            });
            // Lambda 同時実行数
            const concurrentExecutionsMetric = fn.metricInvocations({
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            });
            // グラフウィジェット
            widgets.push(new cloudwatch.GraphWidget({
                title: `Lambda - ${fn.functionName} - 実行時間`,
                left: [durationMetric],
                width: 12,
                height: 6,
                leftYAxis: {
                    label: 'ミリ秒',
                    showUnits: false,
                },
            }));
            widgets.push(new cloudwatch.GraphWidget({
                title: `Lambda - ${fn.functionName} - エラー/スロットル`,
                left: [errorsMetric, throttlesMetric],
                width: 12,
                height: 6,
                leftYAxis: {
                    label: '回数',
                    showUnits: false,
                },
            }));
        });
        return widgets;
    }
}
exports.SecurityMetricsDashboard = SecurityMetricsDashboard;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktbWV0cmljcy1kYXNoYm9hcmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZWN1cml0eS1tZXRyaWNzLWRhc2hib2FyZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyx1RUFBeUQ7QUFHekQsMkNBQXVDO0FBdUN2QyxNQUFhLHdCQUF5QixTQUFRLHNCQUFTO0lBQ3JDLFNBQVMsQ0FBdUI7SUFFaEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFvQztRQUM1RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLHNCQUFzQjtRQUN0QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQzNELGFBQWEsRUFBRSxLQUFLLENBQUMsYUFBYTtTQUNuQyxDQUFDLENBQUM7UUFFSCxXQUFXO1FBQ1gsTUFBTSxPQUFPLEdBQXlCLEVBQUUsQ0FBQztRQUV6QyxhQUFhO1FBQ2IsT0FBTyxDQUFDLElBQUksQ0FDVixJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUM7WUFDeEIsUUFBUSxFQUFFLEtBQUssS0FBSyxDQUFDLFdBQVcscUJBQXFCLEtBQUssQ0FBQyxXQUFXLFNBQVMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUN6RyxLQUFLLEVBQUUsRUFBRTtZQUNULE1BQU0sRUFBRSxDQUFDO1NBQ1YsQ0FBQyxDQUNILENBQUM7UUFFRiw0QkFBNEI7UUFDNUIsSUFBSSxLQUFLLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDdEIsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ3hELENBQUM7UUFFRCx1Q0FBdUM7UUFDdkMsSUFBSSxLQUFLLENBQUMsaUJBQWlC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QUUsSUFBSTtvQkFDWCxTQUFTLEVBQUUsS0FBSztpQkFDakI7YUFDRixDQUFDLENBQ0gsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxPQUFPLENBQUM7SUFDakIsQ0FBQztDQUNGO0FBblRELDREQW1UQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog44K744Kt44Ol44Oq44OG44Kj44Oh44OI44Oq44Kv44K544OA44OD44K344Ol44Oc44O844OJXG4gKiBWUEMgRW5kcG9pbnTjgIFDb2duaXRv6KqN6Ki844CBTGFtYmRhIFZQQ+aOpee2muOBruODoeODiOODquOCr+OCueOCkuWPr+imluWMllxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNlY3VyaXR5TWV0cmljc0Rhc2hib2FyZFByb3BzIHtcbiAgLyoqXG4gICAqIOODgOODg+OCt+ODpeODnOODvOODieWQjVxuICAgKi9cbiAgZGFzaGJvYXJkTmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDjg5fjg63jgrjjgqfjgq/jg4jlkI1cbiAgICovXG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOeSsOWig+WQjVxuICAgKi9cbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcblxuICAvKipcbiAgICogVlBDIEVuZHBvaW5077yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICB2cGNFbmRwb2ludD86IGVjMi5JSW50ZXJmYWNlVnBjRW5kcG9pbnQ7XG5cbiAgLyoqXG4gICAqIExhbWJkYemWouaVsOODquOCueODiO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgKi9cbiAgbGFtYmRhRnVuY3Rpb25zPzogbGFtYmRhLklGdW5jdGlvbltdO1xuXG4gIC8qKlxuICAgKiBDb2duaXRvIFVzZXIgUG9vbCBJRO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgKi9cbiAgY29nbml0b1VzZXJQb29sSWQ/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOODquODvOOCuOODp+ODs1xuICAgKi9cbiAgcmVnaW9uOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTZWN1cml0eU1ldHJpY3NEYXNoYm9hcmQgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgZGFzaGJvYXJkOiBjbG91ZHdhdGNoLkRhc2hib2FyZDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogU2VjdXJpdHlNZXRyaWNzRGFzaGJvYXJkUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaOODgOODg+OCt+ODpeODnOODvOODieS9nOaIkFxuICAgIHRoaXMuZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdEYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiBwcm9wcy5kYXNoYm9hcmROYW1lLFxuICAgIH0pO1xuXG4gICAgLy8g44Km44Kj44K444Kn44OD44OI6YWN5YiXXG4gICAgY29uc3Qgd2lkZ2V0czogY2xvdWR3YXRjaC5JV2lkZ2V0W10gPSBbXTtcblxuICAgIC8vIOOCv+OCpOODiOODq+OCpuOCo+OCuOOCp+ODg+ODiFxuICAgIHdpZGdldHMucHVzaChcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlRleHRXaWRnZXQoe1xuICAgICAgICBtYXJrZG93bjogYCMgJHtwcm9wcy5wcm9qZWN0TmFtZX0g44K744Kt44Ol44Oq44OG44Kj44Oh44OI44Oq44Kv44K5XFxu55Kw5aKDOiAke3Byb3BzLmVudmlyb25tZW50fVxcbuabtOaWsDogJHtuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCl9YCxcbiAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICBoZWlnaHQ6IDIsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBWUEMgRW5kcG9pbnTjg6Hjg4jjg6rjgq/jgrnvvIjlrZjlnKjjgZnjgovloLTlkIjvvIlcbiAgICBpZiAocHJvcHMudnBjRW5kcG9pbnQpIHtcbiAgICAgIHdpZGdldHMucHVzaCguLi50aGlzLmNyZWF0ZVZwY0VuZHBvaW50V2lkZ2V0cyhwcm9wcykpO1xuICAgIH1cblxuICAgIC8vIENvZ25pdG/jg6Hjg4jjg6rjgq/jgrnvvIhVc2VyIFBvb2wgSUTjgYzmjIflrprjgZXjgozjgabjgYTjgovloLTlkIjvvIlcbiAgICBpZiAocHJvcHMuY29nbml0b1VzZXJQb29sSWQpIHtcbiAgICAgIHdpZGdldHMucHVzaCguLi50aGlzLmNyZWF0ZUNvZ25pdG9XaWRnZXRzKHByb3BzKSk7XG4gICAgfVxuXG4gICAgLy8gTGFtYmRhIFZQQ+aOpee2muODoeODiOODquOCr+OCue+8iExhbWJkYemWouaVsOOBjOaMh+WumuOBleOCjOOBpuOBhOOCi+WgtOWQiO+8iVxuICAgIGlmIChwcm9wcy5sYW1iZGFGdW5jdGlvbnMgJiYgcHJvcHMubGFtYmRhRnVuY3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIHdpZGdldHMucHVzaCguLi50aGlzLmNyZWF0ZUxhbWJkYVZwY1dpZGdldHMocHJvcHMpKTtcbiAgICB9XG5cbiAgICAvLyDlhajjgqbjgqPjgrjjgqfjg4Pjg4jjgpLjg4Djg4Pjgrfjg6Xjg5zjg7zjg4njgavov73liqBcbiAgICB3aWRnZXRzLmZvckVhY2goKHdpZGdldCkgPT4ge1xuICAgICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyh3aWRnZXQpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFZQQyBFbmRwb2ludOODoeODiOODquOCr+OCueOCpuOCo+OCuOOCp+ODg+ODiOS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVWcGNFbmRwb2ludFdpZGdldHMocHJvcHM6IFNlY3VyaXR5TWV0cmljc0Rhc2hib2FyZFByb3BzKTogY2xvdWR3YXRjaC5JV2lkZ2V0W10ge1xuICAgIGNvbnN0IHdpZGdldHM6IGNsb3Vkd2F0Y2guSVdpZGdldFtdID0gW107XG5cbiAgICAvLyDjgrvjgq/jgrfjg6fjg7Pjgr/jgqTjg4jjg6tcbiAgICB3aWRnZXRzLnB1c2goXG4gICAgICBuZXcgY2xvdWR3YXRjaC5UZXh0V2lkZ2V0KHtcbiAgICAgICAgbWFya2Rvd246ICcjIyBWUEMgRW5kcG9pbnQg44Oh44OI44Oq44Kv44K5JyxcbiAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICBoZWlnaHQ6IDEsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBWUEMgRW5kcG9pbnTmjqXntprmlbBcbiAgICBjb25zdCBjb25uZWN0aW9uTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9Qcml2YXRlTGluaycsXG4gICAgICBtZXRyaWNOYW1lOiAnQWN0aXZlQ29ubmVjdGlvbnMnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBWcGNFbmRwb2ludElkOiBwcm9wcy52cGNFbmRwb2ludCEudnBjRW5kcG9pbnRJZCxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICAvLyBWUEMgRW5kcG9pbnTjg5DjgqTjg4jmlbDvvIjpgIHkv6HvvIlcbiAgICBjb25zdCBieXRlc091dE1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvUHJpdmF0ZUxpbmsnLFxuICAgICAgbWV0cmljTmFtZTogJ0J5dGVzUHJvY2Vzc2VkJyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgVnBjRW5kcG9pbnRJZDogcHJvcHMudnBjRW5kcG9pbnQhLnZwY0VuZHBvaW50SWQsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICAvLyBWUEMgRW5kcG9pbnTjg5HjgrHjg4Pjg4jmlbBcbiAgICBjb25zdCBwYWNrZXRzTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9Qcml2YXRlTGluaycsXG4gICAgICBtZXRyaWNOYW1lOiAnUGFja2V0c1Byb2Nlc3NlZCcsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIFZwY0VuZHBvaW50SWQ6IHByb3BzLnZwY0VuZHBvaW50IS52cGNFbmRwb2ludElkLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgLy8g44Kw44Op44OV44Km44Kj44K444Kn44OD44OIXG4gICAgd2lkZ2V0cy5wdXNoKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1ZQQyBFbmRwb2ludCAtIOOCouOCr+ODhuOCo+ODluaOpee2muaVsCcsXG4gICAgICAgIGxlZnQ6IFtjb25uZWN0aW9uTWV0cmljXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgIGxlZnRZQXhpczoge1xuICAgICAgICAgIGxhYmVsOiAn5o6l57aa5pWwJyxcbiAgICAgICAgICBzaG93VW5pdHM6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgd2lkZ2V0cy5wdXNoKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1ZQQyBFbmRwb2ludCAtIOODh+ODvOOCv+i7oumAgemHjycsXG4gICAgICAgIGxlZnQ6IFtieXRlc091dE1ldHJpY10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgICBsYWJlbDogJ+ODkOOCpOODiCcsXG4gICAgICAgICAgc2hvd1VuaXRzOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHdpZGdldHMucHVzaChcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdWUEMgRW5kcG9pbnQgLSDjg5HjgrHjg4Pjg4jmlbAnLFxuICAgICAgICBsZWZ0OiBbcGFja2V0c01ldHJpY10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgICBsYWJlbDogJ+ODkeOCseODg+ODiCcsXG4gICAgICAgICAgc2hvd1VuaXRzOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHJldHVybiB3aWRnZXRzO1xuICB9XG5cbiAgLyoqXG4gICAqIENvZ25pdG/jg6Hjg4jjg6rjgq/jgrnjgqbjgqPjgrjjgqfjg4Pjg4jkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQ29nbml0b1dpZGdldHMocHJvcHM6IFNlY3VyaXR5TWV0cmljc0Rhc2hib2FyZFByb3BzKTogY2xvdWR3YXRjaC5JV2lkZ2V0W10ge1xuICAgIGNvbnN0IHdpZGdldHM6IGNsb3Vkd2F0Y2guSVdpZGdldFtdID0gW107XG5cbiAgICAvLyDjgrvjgq/jgrfjg6fjg7Pjgr/jgqTjg4jjg6tcbiAgICB3aWRnZXRzLnB1c2goXG4gICAgICBuZXcgY2xvdWR3YXRjaC5UZXh0V2lkZ2V0KHtcbiAgICAgICAgbWFya2Rvd246ICcjIyBDb2duaXRvIOiqjeiovOODoeODiOODquOCr+OCuScsXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8g44K144Kk44Oz44Kk44Oz5oiQ5Yqf5pWwXG4gICAgY29uc3Qgc2lnbkluU3VjY2Vzc01ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvQ29nbml0bycsXG4gICAgICBtZXRyaWNOYW1lOiAnVXNlckF1dGhlbnRpY2F0aW9uJyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgVXNlclBvb2w6IHByb3BzLmNvZ25pdG9Vc2VyUG9vbElkISxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIC8vIOOCteOCpOODs+OCpOODs+WkseaVl+aVsFxuICAgIGNvbnN0IHNpZ25JbkZhaWx1cmVNZXRyaWMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgbmFtZXNwYWNlOiAnQVdTL0NvZ25pdG8nLFxuICAgICAgbWV0cmljTmFtZTogJ1VzZXJBdXRoZW50aWNhdGlvbkZhaWx1cmUnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBVc2VyUG9vbDogcHJvcHMuY29nbml0b1VzZXJQb29sSWQhLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgLy8g44OI44O844Kv44Oz44Oq44OV44Os44OD44K344Ol5pWwXG4gICAgY29uc3QgdG9rZW5SZWZyZXNoTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9Db2duaXRvJyxcbiAgICAgIG1ldHJpY05hbWU6ICdUb2tlblJlZnJlc2hTdWNjZXNzZXMnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBVc2VyUG9vbDogcHJvcHMuY29nbml0b1VzZXJQb29sSWQhLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgLy8g44Kw44Op44OV44Km44Kj44K444Kn44OD44OIXG4gICAgd2lkZ2V0cy5wdXNoKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0NvZ25pdG8gLSDoqo3oqLzmiJDlip8v5aSx5pWXJyxcbiAgICAgICAgbGVmdDogW3NpZ25JblN1Y2Nlc3NNZXRyaWMsIHNpZ25JbkZhaWx1cmVNZXRyaWNdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgICAgbGFiZWw6ICflm57mlbAnLFxuICAgICAgICAgIHNob3dVbml0czogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICB3aWRnZXRzLnB1c2goXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQ29nbml0byAtIOODiOODvOOCr+ODs+ODquODleODrOODg+OCt+ODpScsXG4gICAgICAgIGxlZnQ6IFt0b2tlblJlZnJlc2hNZXRyaWNdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgICAgbGFiZWw6ICflm57mlbAnLFxuICAgICAgICAgIHNob3dVbml0czogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyDoqo3oqLzlpLHmlZfnjofjga7oqIjnrpfjg6Hjg4jjg6rjgq/jgrlcbiAgICBjb25zdCBmYWlsdXJlUmF0ZU1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1hdGhFeHByZXNzaW9uKHtcbiAgICAgIGV4cHJlc3Npb246ICcobTIgLyAobTEgKyBtMikpICogMTAwJyxcbiAgICAgIHVzaW5nTWV0cmljczoge1xuICAgICAgICBtMTogc2lnbkluU3VjY2Vzc01ldHJpYyxcbiAgICAgICAgbTI6IHNpZ25JbkZhaWx1cmVNZXRyaWMsXG4gICAgICB9LFxuICAgICAgbGFiZWw6ICfoqo3oqLzlpLHmlZfnjocgKCUpJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICB3aWRnZXRzLnB1c2goXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQ29nbml0byAtIOiqjeiovOWkseaVl+eOhycsXG4gICAgICAgIGxlZnQ6IFtmYWlsdXJlUmF0ZU1ldHJpY10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgICBsYWJlbDogJ+WkseaVl+eOhyAoJSknLFxuICAgICAgICAgIHNob3dVbml0czogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICByZXR1cm4gd2lkZ2V0cztcbiAgfVxuXG4gIC8qKlxuICAgKiBMYW1iZGEgVlBD5o6l57aa44Oh44OI44Oq44Kv44K544Km44Kj44K444Kn44OD44OI5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUxhbWJkYVZwY1dpZGdldHMocHJvcHM6IFNlY3VyaXR5TWV0cmljc0Rhc2hib2FyZFByb3BzKTogY2xvdWR3YXRjaC5JV2lkZ2V0W10ge1xuICAgIGNvbnN0IHdpZGdldHM6IGNsb3Vkd2F0Y2guSVdpZGdldFtdID0gW107XG5cbiAgICAvLyDjgrvjgq/jgrfjg6fjg7Pjgr/jgqTjg4jjg6tcbiAgICB3aWRnZXRzLnB1c2goXG4gICAgICBuZXcgY2xvdWR3YXRjaC5UZXh0V2lkZ2V0KHtcbiAgICAgICAgbWFya2Rvd246ICcjIyBMYW1iZGEgVlBDIOaOpee2muODoeODiOODquOCr+OCuScsXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgcHJvcHMubGFtYmRhRnVuY3Rpb25zIS5mb3JFYWNoKChmbiwgaW5kZXgpID0+IHtcbiAgICAgIC8vIExhbWJkYeWun+ihjOaZgumWk1xuICAgICAgY29uc3QgZHVyYXRpb25NZXRyaWMgPSBmbi5tZXRyaWNEdXJhdGlvbih7XG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIExhbWJkYSDjgqjjg6njg7zmlbBcbiAgICAgIGNvbnN0IGVycm9yc01ldHJpYyA9IGZuLm1ldHJpY0Vycm9ycyh7XG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KTtcblxuICAgICAgLy8gTGFtYmRhIOOCueODreODg+ODiOODq+aVsFxuICAgICAgY29uc3QgdGhyb3R0bGVzTWV0cmljID0gZm4ubWV0cmljVGhyb3R0bGVzKHtcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBMYW1iZGEg5ZCM5pmC5a6f6KGM5pWwXG4gICAgICBjb25zdCBjb25jdXJyZW50RXhlY3V0aW9uc01ldHJpYyA9IGZuLm1ldHJpY0ludm9jYXRpb25zKHtcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyDjgrDjg6njg5XjgqbjgqPjgrjjgqfjg4Pjg4hcbiAgICAgIHdpZGdldHMucHVzaChcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgIHRpdGxlOiBgTGFtYmRhIC0gJHtmbi5mdW5jdGlvbk5hbWV9IC0g5a6f6KGM5pmC6ZaTYCxcbiAgICAgICAgICBsZWZ0OiBbZHVyYXRpb25NZXRyaWNdLFxuICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgICAgbGVmdFlBeGlzOiB7XG4gICAgICAgICAgICBsYWJlbDogJ+ODn+ODquenkicsXG4gICAgICAgICAgICBzaG93VW5pdHM6IGZhbHNlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgICB3aWRnZXRzLnB1c2goXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogYExhbWJkYSAtICR7Zm4uZnVuY3Rpb25OYW1lfSAtIOOCqOODqeODvC/jgrnjg63jg4Pjg4jjg6tgLFxuICAgICAgICAgIGxlZnQ6IFtlcnJvcnNNZXRyaWMsIHRocm90dGxlc01ldHJpY10sXG4gICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICBsZWZ0WUF4aXM6IHtcbiAgICAgICAgICAgIGxhYmVsOiAn5Zue5pWwJyxcbiAgICAgICAgICAgIHNob3dVbml0czogZmFsc2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gd2lkZ2V0cztcbiAgfVxufVxuIl19