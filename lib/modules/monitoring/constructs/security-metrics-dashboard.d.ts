/**
 * セキュリティメトリクスダッシュボード
 * VPC Endpoint、Cognito認証、Lambda VPC接続のメトリクスを可視化
 */
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
export interface SecurityMetricsDashboardProps {
    /**
     * ダッシュボード名
     */
    dashboardName: string;
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
     * リージョン
     */
    region: string;
}
export declare class SecurityMetricsDashboard extends Construct {
    readonly dashboard: cloudwatch.Dashboard;
    constructor(scope: Construct, id: string, props: SecurityMetricsDashboardProps);
    /**
     * VPC Endpointメトリクスウィジェット作成
     */
    private createVpcEndpointWidgets;
    /**
     * Cognitoメトリクスウィジェット作成
     */
    private createCognitoWidgets;
    /**
     * Lambda VPC接続メトリクスウィジェット作成
     */
    private createLambdaVpcWidgets;
}
