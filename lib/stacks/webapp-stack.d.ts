/**
 * WebApp Stack
 * API・フロントエンド統合スタック
 *
 * 統合機能:
 * - REST API、GraphQL、WebSocket、Next.js フロントエンド
 */
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { GlobalRagConfig } from '../../types/global-config';
export interface WebAppStackProps extends StackProps {
    config: GlobalRagConfig;
    userPool?: cognito.IUserPool;
    ragQueryFunction?: lambda.IFunction;
    documentProcessorFunction?: lambda.IFunction;
}
export declare class WebAppStack extends Stack {
    restApi?: apigateway.RestApi;
    webAppBucket?: s3.Bucket;
    distribution?: cloudfront.Distribution;
    apiUrl?: string;
    webAppUrl?: string;
    constructor(scope: Construct, id: string, props: WebAppStackProps);
    private createRestApi;
    private createFrontendHosting;
    private generateSampleWebApp;
}
