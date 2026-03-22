/**
 * DemoWebAppStack
 * 
 * Lambda Web Adapter（Next.jsアプリケーション）+ CloudFrontを作成する。
 * 環境変数でCognito、Bedrock KB、FSx設定を注入。
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface DemoWebAppStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.IVpc;
  lambdaSg: ec2.ISecurityGroup;
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
  knowledgeBaseId: string;
  imageUri: string;
}

export class DemoWebAppStack extends cdk.Stack {
  /** CloudFrontディストリビューション */
  public readonly distribution: cloudfront.Distribution;
  /** Lambda関数 */
  public readonly webAppFunction: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: DemoWebAppStackProps) {
    super(scope, id, props);

    const { projectName, environment, vpc, lambdaSg, userPool, userPoolClient, knowledgeBaseId, imageUri } = props;
    const prefix = `${projectName}-${environment}`;

    // Lambda Web Adapter（Next.jsコンテナ）
    this.webAppFunction = new lambda.DockerImageFunction(this, 'WebAppFn', {
      functionName: `${prefix}-webapp`,
      code: lambda.DockerImageCode.fromEcr(
        cdk.aws_ecr.Repository.fromRepositoryName(this, 'EcrRepo', 'permission-aware-rag-webapp'),
        { tagOrDigest: imageUri },
      ),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: {
        // Cognito設定
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        COGNITO_REGION: cdk.Aws.REGION,
        // Bedrock KB設定
        BEDROCK_KB_ID: knowledgeBaseId,
        BEDROCK_REGION: cdk.Aws.REGION,
        // Permission check無効化（デモ環境ではPermission Filter Lambdaを使わない）
        ENABLE_PERMISSION_CHECK: 'false',
        // アプリケーション設定
        NODE_ENV: 'production',
        AWS_LWA_PORT: '3000',
        RUST_LOG: 'info',
      },
    });

    // Bedrock呼び出し権限
    this.webAppFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:Retrieve',
        'bedrock:RetrieveAndGenerate',
        'bedrock:ListFoundationModels',
        'bedrock:GetInferenceProfile',
        'bedrock:ListInferenceProfiles',
      ],
      resources: ['*'],
    }));

    // Lambda Function URL
    const functionUrl = this.webAppFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // CloudFrontディストリビューション
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${prefix} WebApp`,
      defaultBehavior: {
        origin: new origins.FunctionUrlOrigin(functionUrl),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
    });

    // CloudFormation出力
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      exportName: `${prefix}-CloudFrontUrl`,
    });

    new cdk.CfnOutput(this, 'LambdaFunctionUrl', {
      value: functionUrl.url,
      exportName: `${prefix}-LambdaFunctionUrl`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      exportName: `${prefix}-DistributionId`,
    });

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
  }
}
