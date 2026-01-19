"use strict";
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
exports.MonitoringConstruct = void 0;
const constructs_1 = require("constructs");
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
class MonitoringConstruct extends constructs_1.Construct {
    outputs = {};
    dashboard;
    alarmTopic;
    constructor(scope, id, props) {
        super(scope, id);
        console.log('📊 MonitoringConstruct初期化開始...');
        const projectName = props.projectName || 'permission-aware-rag';
        const environment = props.environment || 'prod';
        // SNSトピック作成（アラート通知用）
        if (props.config?.sns?.enabled !== false) {
            this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
                displayName: `${projectName}-${environment}-alarms`,
                topicName: `${projectName}-${environment}-alarms`,
            });
            this.outputs.alarmTopic = this.alarmTopic;
            new cdk.CfnOutput(this, 'AlarmTopicArn', {
                value: this.alarmTopic.topicArn,
                description: 'SNS Topic ARN for Alarms',
                exportName: `${projectName}-${environment}-AlarmTopicArn`,
            });
            console.log('✅ SNSトピック作成完了');
        }
        // CloudWatchダッシュボード作成
        if (props.config?.cloudWatch?.enabled !== false) {
            this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
                dashboardName: `${projectName}-${environment}-dashboard`,
            });
            // 基本的なウィジェットを追加
            this.dashboard.addWidgets(new cloudwatch.TextWidget({
                markdown: `# ${projectName} Monitoring Dashboard\n\nEnvironment: ${environment}`,
                width: 24,
                height: 2,
            }));
            this.outputs.dashboard = this.dashboard;
            new cdk.CfnOutput(this, 'DashboardName', {
                value: this.dashboard.dashboardName,
                description: 'CloudWatch Dashboard Name',
                exportName: `${projectName}-${environment}-DashboardName`,
            });
            console.log('✅ CloudWatchダッシュボード作成完了');
        }
        // ログ保持期間設定
        const logRetentionDays = props.config?.logs?.retentionDays || 7;
        console.log(`📝 ログ保持期間: ${logRetentionDays}日`);
        console.log('✅ MonitoringConstruct初期化完了');
    }
    /**
     * Lambda関数のメトリクスをダッシュボードに追加
     */
    addLambdaMetrics(functionName, functionArn) {
        if (!this.dashboard)
            return;
        const widget = new cloudwatch.GraphWidget({
            title: `Lambda: ${functionName}`,
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/Lambda',
                    metricName: 'Invocations',
                    dimensionsMap: { FunctionName: functionName },
                    statistic: 'Sum',
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/Lambda',
                    metricName: 'Errors',
                    dimensionsMap: { FunctionName: functionName },
                    statistic: 'Sum',
                }),
            ],
            width: 12,
        });
        this.dashboard.addWidgets(widget);
    }
    /**
     * アラームを作成
     */
    createAlarm(id, metric, threshold) {
        const alarm = new cloudwatch.Alarm(this, id, {
            metric,
            threshold,
            evaluationPeriods: 1,
            alarmDescription: `Alarm for ${id}`,
        });
        if (this.alarmTopic) {
            alarm.addAlarmAction({
                bind: () => ({ alarmActionArn: this.alarmTopic.topicArn }),
            });
        }
        return alarm;
    }
}
exports.MonitoringConstruct = MonitoringConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJtb25pdG9yaW5nLWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDJDQUF1QztBQUN2QyxpREFBbUM7QUFDbkMsdUVBQXlEO0FBQ3pELHlEQUEyQztBQWdCM0MsTUFBYSxtQkFBb0IsU0FBUSxzQkFBUztJQUNoQyxPQUFPLEdBQXNCLEVBQUUsQ0FBQztJQUNoQyxTQUFTLENBQXdCO0lBQ2pDLFVBQVUsQ0FBYTtJQUV2QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQStCO1FBQ3ZFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1FBRTlDLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksc0JBQXNCLENBQUM7UUFDaEUsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxNQUFNLENBQUM7UUFFaEQscUJBQXFCO1FBQ3JCLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsT0FBTyxLQUFLLEtBQUssRUFBRSxDQUFDO1lBQ3pDLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7Z0JBQ2xELFdBQVcsRUFBRSxHQUFHLFdBQVcsSUFBSSxXQUFXLFNBQVM7Z0JBQ25ELFNBQVMsRUFBRSxHQUFHLFdBQVcsSUFBSSxXQUFXLFNBQVM7YUFDbEQsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztZQUUxQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtnQkFDdkMsS0FBSyxFQUFFLElBQUksQ0FBQyxV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QUFDO1FBRUgsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDcEIsS0FBSyxDQUFDLGNBQWMsQ0FBQztnQkFDbkIsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLFVBQVcsQ0FBQyxRQUFRLEVBQUUsQ0FBQzthQUM1RCxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0Y7QUEvR0Qsa0RBK0dDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCB7IE1vbml0b3JpbmdDb25maWcgfSBmcm9tICcuLi9pbnRlcmZhY2VzL21vbml0b3JpbmctY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBNb25pdG9yaW5nQ29uc3RydWN0UHJvcHMge1xuICBjb25maWc6IE1vbml0b3JpbmdDb25maWc7XG4gIHByb2plY3ROYW1lPzogc3RyaW5nO1xuICBlbnZpcm9ubWVudD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBNb25pdG9yaW5nT3V0cHV0cyB7XG4gIGRhc2hib2FyZD86IGNsb3Vkd2F0Y2guRGFzaGJvYXJkO1xuICBhbGFybVRvcGljPzogc25zLlRvcGljO1xuICBsb2dHcm91cHM/OiB7IFtrZXk6IHN0cmluZ106IGxvZ3MuTG9nR3JvdXAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIE1vbml0b3JpbmdDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgb3V0cHV0czogTW9uaXRvcmluZ091dHB1dHMgPSB7fTtcbiAgcHVibGljIHJlYWRvbmx5IGRhc2hib2FyZD86IGNsb3Vkd2F0Y2guRGFzaGJvYXJkO1xuICBwdWJsaWMgcmVhZG9ubHkgYWxhcm1Ub3BpYz86IHNucy5Ub3BpYztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTW9uaXRvcmluZ0NvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZygn8J+TiiBNb25pdG9yaW5nQ29uc3RydWN05Yid5pyf5YyW6ZaL5aeLLi4uJyk7XG5cbiAgICBjb25zdCBwcm9qZWN0TmFtZSA9IHByb3BzLnByb2plY3ROYW1lIHx8ICdwZXJtaXNzaW9uLWF3YXJlLXJhZyc7XG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSBwcm9wcy5lbnZpcm9ubWVudCB8fCAncHJvZCc7XG5cbiAgICAvLyBTTlPjg4jjg5Tjg4Pjgq/kvZzmiJDvvIjjgqLjg6njg7zjg4jpgJrnn6XnlKjvvIlcbiAgICBpZiAocHJvcHMuY29uZmlnPy5zbnM/LmVuYWJsZWQgIT09IGZhbHNlKSB7XG4gICAgICB0aGlzLmFsYXJtVG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdBbGFybVRvcGljJywge1xuICAgICAgICBkaXNwbGF5TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWFsYXJtc2AsXG4gICAgICAgIHRvcGljTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWFsYXJtc2AsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5vdXRwdXRzLmFsYXJtVG9waWMgPSB0aGlzLmFsYXJtVG9waWM7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBbGFybVRvcGljQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hbGFybVRvcGljLnRvcGljQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1NOUyBUb3BpYyBBUk4gZm9yIEFsYXJtcycsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1BbGFybVRvcGljQXJuYCxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zb2xlLmxvZygn4pyFIFNOU+ODiOODlOODg+OCr+S9nOaIkOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIENsb3VkV2F0Y2jjg4Djg4Pjgrfjg6Xjg5zjg7zjg4nkvZzmiJBcbiAgICBpZiAocHJvcHMuY29uZmlnPy5jbG91ZFdhdGNoPy5lbmFibGVkICE9PSBmYWxzZSkge1xuICAgICAgdGhpcy5kYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0Rhc2hib2FyZCcsIHtcbiAgICAgICAgZGFzaGJvYXJkTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWRhc2hib2FyZGAsXG4gICAgICB9KTtcblxuICAgICAgLy8g5Z+65pys55qE44Gq44Km44Kj44K444Kn44OD44OI44KS6L+95YqgXG4gICAgICB0aGlzLmRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5UZXh0V2lkZ2V0KHtcbiAgICAgICAgICBtYXJrZG93bjogYCMgJHtwcm9qZWN0TmFtZX0gTW9uaXRvcmluZyBEYXNoYm9hcmRcXG5cXG5FbnZpcm9ubWVudDogJHtlbnZpcm9ubWVudH1gLFxuICAgICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgICBoZWlnaHQ6IDIsXG4gICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgICB0aGlzLm91dHB1dHMuZGFzaGJvYXJkID0gdGhpcy5kYXNoYm9hcmQ7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXNoYm9hcmROYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5kYXNoYm9hcmQuZGFzaGJvYXJkTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdDbG91ZFdhdGNoIERhc2hib2FyZCBOYW1lJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LURhc2hib2FyZE5hbWVgLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnNvbGUubG9nKCfinIUgQ2xvdWRXYXRjaOODgOODg+OCt+ODpeODnOODvOODieS9nOaIkOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIOODreOCsOS/neaMgeacn+mWk+ioreWumlxuICAgIGNvbnN0IGxvZ1JldGVudGlvbkRheXMgPSAocHJvcHMuY29uZmlnIGFzIGFueSk/LmxvZ3M/LnJldGVudGlvbkRheXMgfHwgNztcbiAgICBjb25zb2xlLmxvZyhg8J+TnSDjg63jgrDkv53mjIHmnJ/plpM6ICR7bG9nUmV0ZW50aW9uRGF5c33ml6VgKTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUgTW9uaXRvcmluZ0NvbnN0cnVjdOWIneacn+WMluWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIExhbWJkYemWouaVsOOBruODoeODiOODquOCr+OCueOCkuODgOODg+OCt+ODpeODnOODvOODieOBq+i/veWKoFxuICAgKi9cbiAgcHVibGljIGFkZExhbWJkYU1ldHJpY3MoZnVuY3Rpb25OYW1lOiBzdHJpbmcsIGZ1bmN0aW9uQXJuOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuZGFzaGJvYXJkKSByZXR1cm47XG5cbiAgICBjb25zdCB3aWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogYExhbWJkYTogJHtmdW5jdGlvbk5hbWV9YCxcbiAgICAgIGxlZnQ6IFtcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnSW52b2NhdGlvbnMnLFxuICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHsgRnVuY3Rpb25OYW1lOiBmdW5jdGlvbk5hbWUgfSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnRXJyb3JzJyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IEZ1bmN0aW9uTmFtZTogZnVuY3Rpb25OYW1lIH0sXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgICAgd2lkdGg6IDEyLFxuICAgIH0pO1xuXG4gICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyh3aWRnZXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCouODqeODvOODoOOCkuS9nOaIkFxuICAgKi9cbiAgcHVibGljIGNyZWF0ZUFsYXJtKGlkOiBzdHJpbmcsIG1ldHJpYzogY2xvdWR3YXRjaC5JTWV0cmljLCB0aHJlc2hvbGQ6IG51bWJlcik6IGNsb3Vkd2F0Y2guQWxhcm0ge1xuICAgIGNvbnN0IGFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgaWQsIHtcbiAgICAgIG1ldHJpYyxcbiAgICAgIHRocmVzaG9sZCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogYEFsYXJtIGZvciAke2lkfWAsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5hbGFybVRvcGljKSB7XG4gICAgICBhbGFybS5hZGRBbGFybUFjdGlvbih7XG4gICAgICAgIGJpbmQ6ICgpID0+ICh7IGFsYXJtQWN0aW9uQXJuOiB0aGlzLmFsYXJtVG9waWMhLnRvcGljQXJuIH0pLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFsYXJtO1xuICB9XG59XG4iXX0=