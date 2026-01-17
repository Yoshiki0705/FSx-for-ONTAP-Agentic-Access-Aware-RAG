import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import { MonitoringConfig } from '../interfaces/monitoring-config';

export interface MonitoringConstructProps {
  config: MonitoringConfig;
  projectName?: string;
  environment?: string;
}

export interface MonitoringOutputs {
  dashboard?: cloudwatch.Dashboard;
  alarmTopic?: sns.Topic;
  logGroups?: { [key: string]: logs.LogGroup };
}

export class MonitoringConstruct extends Construct {
  public readonly outputs: MonitoringOutputs = {};
  public readonly dashboard?: cloudwatch.Dashboard;
  public readonly alarmTopic?: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringConstructProps) {
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
      this.dashboard.addWidgets(
        new cloudwatch.TextWidget({
          markdown: `# ${projectName} Monitoring Dashboard\n\nEnvironment: ${environment}`,
          width: 24,
          height: 2,
        })
      );

      this.outputs.dashboard = this.dashboard;

      new cdk.CfnOutput(this, 'DashboardName', {
        value: this.dashboard.dashboardName,
        description: 'CloudWatch Dashboard Name',
        exportName: `${projectName}-${environment}-DashboardName`,
      });

      console.log('✅ CloudWatchダッシュボード作成完了');
    }

    // ログ保持期間設定
    const logRetentionDays = (props.config as any)?.logs?.retentionDays || 7;
    console.log(`📝 ログ保持期間: ${logRetentionDays}日`);

    console.log('✅ MonitoringConstruct初期化完了');
  }

  /**
   * Lambda関数のメトリクスをダッシュボードに追加
   */
  public addLambdaMetrics(functionName: string, functionArn: string): void {
    if (!this.dashboard) return;

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
  public createAlarm(id: string, metric: cloudwatch.IMetric, threshold: number): cloudwatch.Alarm {
    const alarm = new cloudwatch.Alarm(this, id, {
      metric,
      threshold,
      evaluationPeriods: 1,
      alarmDescription: `Alarm for ${id}`,
    });

    if (this.alarmTopic) {
      alarm.addAlarmAction({
        bind: () => ({ alarmActionArn: this.alarmTopic!.topicArn }),
      });
    }

    return alarm;
  }
}
