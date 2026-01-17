/**
 * WebAppStack - Lambda Web Adapter + Next.js + CloudFront統合スタック
 *
 * 機能:
 * - Lambda Function (Container) with Web Adapter
 * - Lambda Function URL
 * - CloudFront Distribution
 * - ECR Repository
 * - IAM Roles and Permissions
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
export interface WebAppStackProps extends cdk.StackProps {
    readonly config: any;
}
/**
 * WebAppStack - フル実装版
 */
export declare class WebAppStack extends cdk.Stack {
    /** Lambda Function */
    readonly webAppFunction: lambda.Function;
    /** Lambda Function URL */
    readonly functionUrl: lambda.FunctionUrl;
    /** CloudFront Distribution */
    readonly distribution: cloudfront.Distribution;
    /** ECR Repository */
    readonly ecrRepository: ecr.Repository;
    constructor(scope: Construct, id: string, props: WebAppStackProps);
}
