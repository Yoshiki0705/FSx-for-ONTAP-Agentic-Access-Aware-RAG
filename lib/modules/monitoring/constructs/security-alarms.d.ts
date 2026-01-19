/**
 * セキュリティアラーム設定
 * VPC Endpoint、Cognito認証、Lambda VPC接続のアラームを設定
 */
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
export interface SecurityAlarmsProps {
    /**
     * プロジェクト名
     */
    projectName: string;
    /**
     * 環境名
     */
    environment: string;
    /**
     * VPC Endpoint（オプション）
     */
    vpcEndpoint?: ec2.IInterfaceVpcEndpoint;
    /**
     * Lambda関数リスト（オプション）
     */
    lambdaFunctions?: lambda.IFunction[];
    /**
     * Cognito User Pool ID（オプション）
     */
    cognitoUserPoolId?: string;
    /**
     * アラーム通知先SNSトピック（オプション）
     */
    alarmTopic?: sns.ITopic;
    /**
     * リージョン
     */
    region: string;
}
export declare class SecurityAlarms extends Construct {
    readonly alarms: cloudwatch.Alarm[];
    constructor(scope: Construct, id: string, props: SecurityAlarmsProps);
    /**
     * VPC Endpointアラーム作成
     */
    private createVpcEndpointAlarms;
    /**
     * Cognitoアラーム作成
     */
    private createCognitoAlarms;
    /**
     * Lambda VPC接続アラーム作成
     */
    private createLambdaVpcAlarms;
}
