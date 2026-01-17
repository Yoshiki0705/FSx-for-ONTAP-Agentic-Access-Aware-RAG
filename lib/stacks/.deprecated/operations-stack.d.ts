/**
 * Operations Stack
 * 監視・エンタープライズ統合スタック
 *
 * 統合機能:
 * - CloudWatch、X-Ray、アラーム、ダッシュボード、マルチテナント、課金、コンプライアンス、ガバナンス
 */
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { GlobalRagConfig } from '../../types/global-config';
import { SecurityMonitoringSystem, SecurityMonitoringConfig } from '../security/security-monitoring-system';
export interface OperationsStackProps extends StackProps {
    config: GlobalRagConfig;
    restApi?: apigateway.IRestApi;
    lambdaFunctions?: lambda.IFunction[];
    dynamoTables?: dynamodb.ITable[];
    securityMonitoringConfig?: SecurityMonitoringConfig;
}
export declare class OperationsStack extends Stack {
    dashboard?: cloudwatch.Dashboard;
    alertTopic?: sns.Topic;
    complianceLogGroup?: logs.LogGroup;
    complianceAuditFunction?: lambda.Function;
    securityMonitoring?: SecurityMonitoringSystem;
    constructor(scope: Construct, id: string, props: OperationsStackProps);
    private createAlertTopic;
    private createDashboard;
    private createAlarms;
    private createComplianceLogging;
    private enableXRayTracing;
    globalConfig: config;
    gdprConfig: gdprConfig;
}
