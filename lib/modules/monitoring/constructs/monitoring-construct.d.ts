import { Construct } from 'constructs';
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
    logGroups?: {
        [key: string]: logs.LogGroup;
    };
}
export declare class MonitoringConstruct extends Construct {
    readonly outputs: MonitoringOutputs;
    readonly dashboard?: cloudwatch.Dashboard;
    readonly alarmTopic?: sns.Topic;
    constructor(scope: Construct, id: string, props: MonitoringConstructProps);
    /**
     * Lambda関数のメトリクスをダッシュボードに追加
     */
    addLambdaMetrics(functionName: string, functionArn: string): void;
    /**
     * アラームを作成
     */
    createAlarm(id: string, metric: cloudwatch.IMetric, threshold: number): cloudwatch.Alarm;
}
