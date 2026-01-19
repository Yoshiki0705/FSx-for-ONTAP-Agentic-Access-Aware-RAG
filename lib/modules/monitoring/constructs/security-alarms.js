"use strict";
/**
 * セキュリティアラーム設定
 * VPC Endpoint、Cognito認証、Lambda VPC接続のアラームを設定
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
exports.SecurityAlarms = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatch_actions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const constructs_1 = require("constructs");
class SecurityAlarms extends constructs_1.Construct {
    alarms = [];
    constructor(scope, id, props) {
        super(scope, id);
        // VPC Endpointアラーム（存在する場合）
        if (props.vpcEndpoint) {
            this.alarms.push(...this.createVpcEndpointAlarms(props));
        }
        // Cognitoアラーム（User Pool IDが指定されている場合）
        if (props.cognitoUserPoolId) {
            this.alarms.push(...this.createCognitoAlarms(props));
        }
        // Lambda VPC接続アラーム（Lambda関数が指定されている場合）
        if (props.lambdaFunctions && props.lambdaFunctions.length > 0) {
            this.alarms.push(...this.createLambdaVpcAlarms(props));
        }
        // SNSトピックが指定されている場合、全アラームにアクション追加
        if (props.alarmTopic) {
            this.alarms.forEach((alarm) => {
                alarm.addAlarmAction(new cloudwatch_actions.SnsAction(props.alarmTopic));
            });
        }
    }
    /**
     * VPC Endpointアラーム作成
     */
    createVpcEndpointAlarms(props) {
        const alarms = [];
        // VPC Endpoint接続エラーアラーム
        // 注: PrivateLinkには直接的なエラーメトリクスがないため、
        // 接続数の急激な減少を検知
        const connectionMetric = new cloudwatch.Metric({
            namespace: 'AWS/PrivateLink',
            metricName: 'ActiveConnections',
            dimensionsMap: {
                VpcEndpointId: props.vpcEndpoint.vpcEndpointId,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
        });
        const connectionAlarm = new cloudwatch.Alarm(this, 'VpcEndpointConnectionAlarm', {
            alarmName: `${props.projectName}-${props.environment}-vpc-endpoint-connection-low`,
            alarmDescription: 'VPC Endpoint接続数が異常に低下しています',
            metric: connectionMetric,
            threshold: 1,
            evaluationPeriods: 2,
            datapointsToAlarm: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.BREACHING,
        });
        alarms.push(connectionAlarm);
        return alarms;
    }
    /**
     * Cognitoアラーム作成
     */
    createCognitoAlarms(props) {
        const alarms = [];
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
        // 認証失敗率アラーム（20%以上）
        const failureRateMetric = new cloudwatch.MathExpression({
            expression: '(m2 / (m1 + m2)) * 100',
            usingMetrics: {
                m1: signInSuccessMetric,
                m2: signInFailureMetric,
            },
            label: '認証失敗率 (%)',
            period: cdk.Duration.minutes(5),
        });
        const failureRateAlarm = new cloudwatch.Alarm(this, 'CognitoFailureRateAlarm', {
            alarmName: `${props.projectName}-${props.environment}-cognito-failure-rate-high`,
            alarmDescription: 'Cognito認証失敗率が20%を超えています',
            metric: failureRateMetric,
            threshold: 20,
            evaluationPeriods: 2,
            datapointsToAlarm: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        alarms.push(failureRateAlarm);
        // 認証失敗数アラーム（絶対数：10回以上/5分）
        const failureCountAlarm = new cloudwatch.Alarm(this, 'CognitoFailureCountAlarm', {
            alarmName: `${props.projectName}-${props.environment}-cognito-failure-count-high`,
            alarmDescription: 'Cognito認証失敗数が異常に多くなっています（潜在的な攻撃の可能性）',
            metric: signInFailureMetric,
            threshold: 10,
            evaluationPeriods: 1,
            datapointsToAlarm: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        alarms.push(failureCountAlarm);
        return alarms;
    }
    /**
     * Lambda VPC接続アラーム作成
     */
    createLambdaVpcAlarms(props) {
        const alarms = [];
        props.lambdaFunctions.forEach((fn) => {
            // Lambda VPC接続タイムアウトアラーム
            const durationMetric = fn.metricDuration({
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
            });
            // タイムアウトの80%を超えた場合にアラーム
            // 注: Lambda関数のタイムアウト設定を取得できないため、
            // 一般的な閾値（25秒 = 30秒タイムアウトの83%）を使用
            const durationAlarm = new cloudwatch.Alarm(this, `LambdaDurationAlarm-${fn.functionName}`, {
                alarmName: `${props.projectName}-${props.environment}-lambda-${fn.functionName}-duration-high`,
                alarmDescription: `Lambda関数 ${fn.functionName} の実行時間が長くなっています（VPC接続の問題の可能性）`,
                metric: durationMetric,
                threshold: 25000, // 25秒（ミリ秒）
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            alarms.push(durationAlarm);
            // Lambda エラー率アラーム（5%以上）
            const errorsMetric = fn.metricErrors({
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            });
            const invocationsMetric = fn.metricInvocations({
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            });
            const errorRateMetric = new cloudwatch.MathExpression({
                expression: '(m1 / m2) * 100',
                usingMetrics: {
                    m1: errorsMetric,
                    m2: invocationsMetric,
                },
                label: 'エラー率 (%)',
                period: cdk.Duration.minutes(5),
            });
            const errorRateAlarm = new cloudwatch.Alarm(this, `LambdaErrorRateAlarm-${fn.functionName}`, {
                alarmName: `${props.projectName}-${props.environment}-lambda-${fn.functionName}-error-rate-high`,
                alarmDescription: `Lambda関数 ${fn.functionName} のエラー率が5%を超えています`,
                metric: errorRateMetric,
                threshold: 5,
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            alarms.push(errorRateAlarm);
            // Lambda スロットルアラーム
            const throttlesMetric = fn.metricThrottles({
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            });
            const throttleAlarm = new cloudwatch.Alarm(this, `LambdaThrottleAlarm-${fn.functionName}`, {
                alarmName: `${props.projectName}-${props.environment}-lambda-${fn.functionName}-throttled`,
                alarmDescription: `Lambda関数 ${fn.functionName} がスロットルされています`,
                metric: throttlesMetric,
                threshold: 1,
                evaluationPeriods: 1,
                datapointsToAlarm: 1,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            alarms.push(throttleAlarm);
        });
        return alarms;
    }
}
exports.SecurityAlarms = SecurityAlarms;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktYWxhcm1zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VjdXJpdHktYWxhcm1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCx1RkFBeUU7QUFJekUsMkNBQXVDO0FBdUN2QyxNQUFhLGNBQWUsU0FBUSxzQkFBUztJQUMzQixNQUFNLEdBQXVCLEVBQUUsQ0FBQztJQUVoRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTBCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsMkJBQTJCO1FBQzNCLElBQUksS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3RCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDM0QsQ0FBQztRQUVELHNDQUFzQztRQUN0QyxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzVCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDdkQsQ0FBQztRQUVELHVDQUF1QztRQUN2QyxJQUFJLEtBQUssQ0FBQyxlQUFlLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDOUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUN6RCxDQUFDO1FBRUQsa0NBQWtDO1FBQ2xDLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3JCLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxF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LENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFLENBQUMsWUFBWSxFQUFFLEVBQUU7Z0JBQ3pGLFNBQVMsRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsV0FBVyxFQUFFLENBQUMsWUFBWSxZQUFZO2dCQUMxRixnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsQ0FBQyxZQUFZLGVBQWU7Z0JBQzVELE1BQU0sRUFBRSxlQUFlO2dCQUN2QixTQUFTLEVBQUUsQ0FBQztnQkFDWixpQkFBaUIsRUFBRSxDQUFDO2dCQUNwQixpQkFBaUIsRUFBRSxDQUFDO2dCQUNwQixrQkFBa0IsRUFBRSxVQUFVLENBQUMsa0JBQWtCLENBQUMsa0NBQWtDO2dCQUNwRixnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsYUFBYTthQUM1RCxDQUFDLENBQUM7WUFFSCxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQzdCLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUNGO0FBMU5ELHdDQTBOQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog44K744Kt44Ol44Oq44OG44Kj44Ki44Op44O844Og6Kit5a6aXG4gKiBWUEMgRW5kcG9pbnTjgIFDb2duaXRv6KqN6Ki844CBTGFtYmRhIFZQQ+aOpee2muOBruOCouODqeODvOODoOOCkuioreWumlxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2hfYWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNlY3VyaXR5QWxhcm1zUHJvcHMge1xuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5ZCNXG4gICAqL1xuICBwcm9qZWN0TmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDnkrDlooPlkI1cbiAgICovXG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFZQQyBFbmRwb2ludO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgKi9cbiAgdnBjRW5kcG9pbnQ/OiBlYzIuSUludGVyZmFjZVZwY0VuZHBvaW50O1xuXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDjg6rjgrnjg4jvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICovXG4gIGxhbWJkYUZ1bmN0aW9ucz86IGxhbWJkYS5JRnVuY3Rpb25bXTtcblxuICAvKipcbiAgICogQ29nbml0byBVc2VyIFBvb2wgSUTvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICovXG4gIGNvZ25pdG9Vc2VyUG9vbElkPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDjgqLjg6njg7zjg6DpgJrnn6XlhYhTTlPjg4jjg5Tjg4Pjgq/vvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICovXG4gIGFsYXJtVG9waWM/OiBzbnMuSVRvcGljO1xuXG4gIC8qKlxuICAgKiDjg6rjg7zjgrjjg6fjg7NcbiAgICovXG4gIHJlZ2lvbjogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgU2VjdXJpdHlBbGFybXMgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgYWxhcm1zOiBjbG91ZHdhdGNoLkFsYXJtW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogU2VjdXJpdHlBbGFybXNQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBWUEMgRW5kcG9pbnTjgqLjg6njg7zjg6DvvIjlrZjlnKjjgZnjgovloLTlkIjvvIlcbiAgICBpZiAocHJvcHMudnBjRW5kcG9pbnQpIHtcbiAgICAgIHRoaXMuYWxhcm1zLnB1c2goLi4udGhpcy5jcmVhdGVWcGNFbmRwb2ludEFsYXJtcyhwcm9wcykpO1xuICAgIH1cblxuICAgIC8vIENvZ25pdG/jgqLjg6njg7zjg6DvvIhVc2VyIFBvb2wgSUTjgYzmjIflrprjgZXjgozjgabjgYTjgovloLTlkIjvvIlcbiAgICBpZiAocHJvcHMuY29nbml0b1VzZXJQb29sSWQpIHtcbiAgICAgIHRoaXMuYWxhcm1zLnB1c2goLi4udGhpcy5jcmVhdGVDb2duaXRvQWxhcm1zKHByb3BzKSk7XG4gICAgfVxuXG4gICAgLy8gTGFtYmRhIFZQQ+aOpee2muOCouODqeODvOODoO+8iExhbWJkYemWouaVsOOBjOaMh+WumuOBleOCjOOBpuOBhOOCi+WgtOWQiO+8iVxuICAgIGlmIChwcm9wcy5sYW1iZGFGdW5jdGlvbnMgJiYgcHJvcHMubGFtYmRhRnVuY3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuYWxhcm1zLnB1c2goLi4udGhpcy5jcmVhdGVMYW1iZGFWcGNBbGFybXMocHJvcHMpKTtcbiAgICB9XG5cbiAgICAvLyBTTlPjg4jjg5Tjg4Pjgq/jgYzmjIflrprjgZXjgozjgabjgYTjgovloLTlkIjjgIHlhajjgqLjg6njg7zjg6DjgavjgqLjgq/jgrfjg6fjg7Pov73liqBcbiAgICBpZiAocHJvcHMuYWxhcm1Ub3BpYykge1xuICAgICAgdGhpcy5hbGFybXMuZm9yRWFjaCgoYWxhcm0pID0+IHtcbiAgICAgICAgYWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24ocHJvcHMuYWxhcm1Ub3BpYyEpKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBWUEMgRW5kcG9pbnTjgqLjg6njg7zjg6DkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlVnBjRW5kcG9pbnRBbGFybXMocHJvcHM6IFNlY3VyaXR5QWxhcm1zUHJvcHMpOiBjbG91ZHdhdGNoLkFsYXJtW10ge1xuICAgIGNvbnN0IGFsYXJtczogY2xvdWR3YXRjaC5BbGFybVtdID0gW107XG5cbiAgICAvLyBWUEMgRW5kcG9pbnTmjqXntprjgqjjg6njg7zjgqLjg6njg7zjg6BcbiAgICAvLyDms6g6IFByaXZhdGVMaW5r44Gr44Gv55u05o6l55qE44Gq44Ko44Op44O844Oh44OI44Oq44Kv44K544GM44Gq44GE44Gf44KB44CBXG4gICAgLy8g5o6l57aa5pWw44Gu5oCl5r+A44Gq5rib5bCR44KS5qSc55+lXG4gICAgY29uc3QgY29ubmVjdGlvbk1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvUHJpdmF0ZUxpbmsnLFxuICAgICAgbWV0cmljTmFtZTogJ0FjdGl2ZUNvbm5lY3Rpb25zJyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgVnBjRW5kcG9pbnRJZDogcHJvcHMudnBjRW5kcG9pbnQhLnZwY0VuZHBvaW50SWQsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY29ubmVjdGlvbkFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ1ZwY0VuZHBvaW50Q29ubmVjdGlvbkFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tdnBjLWVuZHBvaW50LWNvbm5lY3Rpb24tbG93YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdWUEMgRW5kcG9pbnTmjqXntprmlbDjgYznlbDluLjjgavkvY7kuIvjgZfjgabjgYTjgb7jgZknLFxuICAgICAgbWV0cmljOiBjb25uZWN0aW9uTWV0cmljLFxuICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICBkYXRhcG9pbnRzVG9BbGFybTogMixcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuTEVTU19USEFOX1RIUkVTSE9MRCxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICBhbGFybXMucHVzaChjb25uZWN0aW9uQWxhcm0pO1xuXG4gICAgcmV0dXJuIGFsYXJtcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDb2duaXRv44Ki44Op44O844Og5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUNvZ25pdG9BbGFybXMocHJvcHM6IFNlY3VyaXR5QWxhcm1zUHJvcHMpOiBjbG91ZHdhdGNoLkFsYXJtW10ge1xuICAgIGNvbnN0IGFsYXJtczogY2xvdWR3YXRjaC5BbGFybVtdID0gW107XG5cbiAgICAvLyDjgrXjgqTjg7PjgqTjg7PmiJDlip/mlbBcbiAgICBjb25zdCBzaWduSW5TdWNjZXNzTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9Db2duaXRvJyxcbiAgICAgIG1ldHJpY05hbWU6ICdVc2VyQXV0aGVudGljYXRpb24nLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBVc2VyUG9vbDogcHJvcHMuY29nbml0b1VzZXJQb29sSWQhLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgLy8g44K144Kk44Oz44Kk44Oz5aSx5pWX5pWwXG4gICAgY29uc3Qgc2lnbkluRmFpbHVyZU1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvQ29nbml0bycsXG4gICAgICBtZXRyaWNOYW1lOiAnVXNlckF1dGhlbnRpY2F0aW9uRmFpbHVyZScsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIFVzZXJQb29sOiBwcm9wcy5jb2duaXRvVXNlclBvb2xJZCEsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICAvLyDoqo3oqLzlpLHmlZfnjofjgqLjg6njg7zjg6DvvIgyMCXku6XkuIrvvIlcbiAgICBjb25zdCBmYWlsdXJlUmF0ZU1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1hdGhFeHByZXNzaW9uKHtcbiAgICAgIGV4cHJlc3Npb246ICcobTIgLyAobTEgKyBtMikpICogMTAwJyxcbiAgICAgIHVzaW5nTWV0cmljczoge1xuICAgICAgICBtMTogc2lnbkluU3VjY2Vzc01ldHJpYyxcbiAgICAgICAgbTI6IHNpZ25JbkZhaWx1cmVNZXRyaWMsXG4gICAgICB9LFxuICAgICAgbGFiZWw6ICfoqo3oqLzlpLHmlZfnjocgKCUpJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBmYWlsdXJlUmF0ZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0NvZ25pdG9GYWlsdXJlUmF0ZUFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tY29nbml0by1mYWlsdXJlLXJhdGUtaGlnaGAsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQ29nbml0b+iqjeiovOWkseaVl+eOh+OBjDIwJeOCkui2heOBiOOBpuOBhOOBvuOBmScsXG4gICAgICBtZXRyaWM6IGZhaWx1cmVSYXRlTWV0cmljLFxuICAgICAgdGhyZXNob2xkOiAyMCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgZGF0YXBvaW50c1RvQWxhcm06IDIsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcblxuICAgIGFsYXJtcy5wdXNoKGZhaWx1cmVSYXRlQWxhcm0pO1xuXG4gICAgLy8g6KqN6Ki85aSx5pWX5pWw44Ki44Op44O844Og77yI57W25a++5pWw77yaMTDlm57ku6XkuIovNeWIhu+8iVxuICAgIGNvbnN0IGZhaWx1cmVDb3VudEFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0NvZ25pdG9GYWlsdXJlQ291bnRBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWNvZ25pdG8tZmFpbHVyZS1jb3VudC1oaWdoYCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdDb2duaXRv6KqN6Ki85aSx5pWX5pWw44GM55Ww5bi444Gr5aSa44GP44Gq44Gj44Gm44GE44G+44GZ77yI5r2c5Zyo55qE44Gq5pS75pKD44Gu5Y+v6IO95oCn77yJJyxcbiAgICAgIG1ldHJpYzogc2lnbkluRmFpbHVyZU1ldHJpYyxcbiAgICAgIHRocmVzaG9sZDogMTAsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIGRhdGFwb2ludHNUb0FsYXJtOiAxLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICBhbGFybXMucHVzaChmYWlsdXJlQ291bnRBbGFybSk7XG5cbiAgICByZXR1cm4gYWxhcm1zO1xuICB9XG5cbiAgLyoqXG4gICAqIExhbWJkYSBWUEPmjqXntprjgqLjg6njg7zjg6DkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhVnBjQWxhcm1zKHByb3BzOiBTZWN1cml0eUFsYXJtc1Byb3BzKTogY2xvdWR3YXRjaC5BbGFybVtdIHtcbiAgICBjb25zdCBhbGFybXM6IGNsb3Vkd2F0Y2guQWxhcm1bXSA9IFtdO1xuXG4gICAgcHJvcHMubGFtYmRhRnVuY3Rpb25zIS5mb3JFYWNoKChmbikgPT4ge1xuICAgICAgLy8gTGFtYmRhIFZQQ+aOpee2muOCv+OCpOODoOOCouOCpuODiOOCouODqeODvOODoFxuICAgICAgY29uc3QgZHVyYXRpb25NZXRyaWMgPSBmbi5tZXRyaWNEdXJhdGlvbih7XG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIOOCv+OCpOODoOOCouOCpuODiOOBrjgwJeOCkui2heOBiOOBn+WgtOWQiOOBq+OCouODqeODvOODoFxuICAgICAgLy8g5rOoOiBMYW1iZGHplqLmlbDjga7jgr/jgqTjg6DjgqLjgqbjg4joqK3lrprjgpLlj5blvpfjgafjgY3jgarjgYTjgZ/jgoHjgIFcbiAgICAgIC8vIOS4gOiIrOeahOOBqumWvuWApO+8iDI156eSID0gMzDnp5Ljgr/jgqTjg6DjgqLjgqbjg4jjga44MyXvvInjgpLkvb/nlKhcbiAgICAgIGNvbnN0IGR1cmF0aW9uQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCBgTGFtYmRhRHVyYXRpb25BbGFybS0ke2ZuLmZ1bmN0aW9uTmFtZX1gLCB7XG4gICAgICAgIGFsYXJtTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWxhbWJkYS0ke2ZuLmZ1bmN0aW9uTmFtZX0tZHVyYXRpb24taGlnaGAsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246IGBMYW1iZGHplqLmlbAgJHtmbi5mdW5jdGlvbk5hbWV9IOOBruWun+ihjOaZgumWk+OBjOmVt+OBj+OBquOBo+OBpuOBhOOBvuOBme+8iFZQQ+aOpee2muOBruWVj+mhjOOBruWPr+iDveaAp++8iWAsXG4gICAgICAgIG1ldHJpYzogZHVyYXRpb25NZXRyaWMsXG4gICAgICAgIHRocmVzaG9sZDogMjUwMDAsIC8vIDI156eS77yI44Of44Oq56eS77yJXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICBkYXRhcG9pbnRzVG9BbGFybTogMixcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pO1xuXG4gICAgICBhbGFybXMucHVzaChkdXJhdGlvbkFsYXJtKTtcblxuICAgICAgLy8gTGFtYmRhIOOCqOODqeODvOeOh+OCouODqeODvOODoO+8iDUl5Lul5LiK77yJXG4gICAgICBjb25zdCBlcnJvcnNNZXRyaWMgPSBmbi5tZXRyaWNFcnJvcnMoe1xuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGludm9jYXRpb25zTWV0cmljID0gZm4ubWV0cmljSW52b2NhdGlvbnMoe1xuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGVycm9yUmF0ZU1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1hdGhFeHByZXNzaW9uKHtcbiAgICAgICAgZXhwcmVzc2lvbjogJyhtMSAvIG0yKSAqIDEwMCcsXG4gICAgICAgIHVzaW5nTWV0cmljczoge1xuICAgICAgICAgIG0xOiBlcnJvcnNNZXRyaWMsXG4gICAgICAgICAgbTI6IGludm9jYXRpb25zTWV0cmljLFxuICAgICAgICB9LFxuICAgICAgICBsYWJlbDogJ+OCqOODqeODvOeOhyAoJSknLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGVycm9yUmF0ZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgYExhbWJkYUVycm9yUmF0ZUFsYXJtLSR7Zm4uZnVuY3Rpb25OYW1lfWAsIHtcbiAgICAgICAgYWxhcm1OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tbGFtYmRhLSR7Zm4uZnVuY3Rpb25OYW1lfS1lcnJvci1yYXRlLWhpZ2hgLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBgTGFtYmRh6Zai5pWwICR7Zm4uZnVuY3Rpb25OYW1lfSDjga7jgqjjg6njg7znjofjgYw1JeOCkui2heOBiOOBpuOBhOOBvuOBmWAsXG4gICAgICAgIG1ldHJpYzogZXJyb3JSYXRlTWV0cmljLFxuICAgICAgICB0aHJlc2hvbGQ6IDUsXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICBkYXRhcG9pbnRzVG9BbGFybTogMixcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pO1xuXG4gICAgICBhbGFybXMucHVzaChlcnJvclJhdGVBbGFybSk7XG5cbiAgICAgIC8vIExhbWJkYSDjgrnjg63jg4Pjg4jjg6vjgqLjg6njg7zjg6BcbiAgICAgIGNvbnN0IHRocm90dGxlc01ldHJpYyA9IGZuLm1ldHJpY1Rocm90dGxlcyh7XG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgdGhyb3R0bGVBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIGBMYW1iZGFUaHJvdHRsZUFsYXJtLSR7Zm4uZnVuY3Rpb25OYW1lfWAsIHtcbiAgICAgICAgYWxhcm1OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tbGFtYmRhLSR7Zm4uZnVuY3Rpb25OYW1lfS10aHJvdHRsZWRgLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBgTGFtYmRh6Zai5pWwICR7Zm4uZnVuY3Rpb25OYW1lfSDjgYzjgrnjg63jg4Pjg4jjg6vjgZXjgozjgabjgYTjgb7jgZlgLFxuICAgICAgICBtZXRyaWM6IHRocm90dGxlc01ldHJpYyxcbiAgICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgZGF0YXBvaW50c1RvQWxhcm06IDEsXG4gICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX09SX0VRVUFMX1RPX1RIUkVTSE9MRCxcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICB9KTtcblxuICAgICAgYWxhcm1zLnB1c2godGhyb3R0bGVBbGFybSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gYWxhcm1zO1xuICB9XG59XG4iXX0=