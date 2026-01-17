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
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface WebAppStackProps extends cdk.StackProps {
  readonly config: any; // 統合設定オブジェクト
}

/**
 * WebAppStack - フル実装版
 */
export class WebAppStack extends cdk.Stack {
  /** Lambda Function */
  public readonly webAppFunction: lambda.Function;
  
  /** Lambda Function URL */
  public readonly functionUrl: lambda.FunctionUrl;
  
  /** CloudFront Distribution */
  public readonly distribution: cloudfront.Distribution;
  
  /** ECR Repository */
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props: WebAppStackProps) {
    super(scope, id, props);

    const { config } = props;
    const projectName = config.project?.name || config.naming?.projectName || 'permission-aware-rag';
    const environment = config.environment || config.naming?.environment || 'prod';
    const regionPrefix = config.naming?.regionPrefix || 'TokyoRegion';

    console.log('🚀 WebAppStack (Full) 初期化開始...');
    console.log(`   プロジェクト名: ${projectName}`);
    console.log(`   環境: ${environment}`);
    console.log(`   リージョンプレフィックス: ${regionPrefix}`);

    // ECR Repository
    this.ecrRepository = new ecr.Repository(this, 'WebAppRepository', {
      repositoryName: `${regionPrefix.toLowerCase()}-${projectName}-${environment}-webapp-repo`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
        },
      ],
    });

    // Lambda Execution Role
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: `${regionPrefix}-${projectName}-${environment}-WebApp-Lambda-Role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Bedrock access
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:ListFoundationModels',
        'bedrock:GetFoundationModel',
      ],
      resources: ['*'],
    }));

    // Bedrock Agent access
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeAgent',
      ],
      resources: ['*'],
    }));

    // DynamoDB access (if needed)
    if (config.database?.dynamodb) {
      lambdaRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: ['*'], // TODO: Scope to specific tables
      }));
    }

    // Lambda Function
    this.webAppFunction = new lambda.Function(this, 'WebAppFunction', {
      functionName: `${regionPrefix}-${projectName}-${environment}-WebApp-Function`,
      runtime: lambda.Runtime.FROM_IMAGE,
      code: lambda.Code.fromEcrImage(this.ecrRepository, {
        tagOrDigest: 'latest',
      }),
      handler: lambda.Handler.FROM_IMAGE,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(config.compute?.lambda?.timeout || 30),
      memorySize: config.compute?.lambda?.memorySize || 512,
      environment: {
        NODE_ENV: 'production',
        BEDROCK_REGION: config.ai?.bedrock?.region || 'us-east-1',
        AWS_LWA_INVOKE_MODE: 'response_stream',
        AWS_LWA_PORT: '3000',
        RUST_LOG: 'info',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Lambda Function URL
    this.functionUrl = this.webAppFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ['*'],
      },
      invokeMode: lambda.InvokeMode.BUFFERED,
    });

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'WebAppDistribution', {
      comment: `${regionPrefix}-${projectName}-${environment}-WebApp-Distribution`,
      defaultBehavior: {
        origin: new origins.HttpOrigin(cdk.Fn.select(2, cdk.Fn.split('/', this.functionUrl.url))),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      enableLogging: false,
    });

    // Outputs
    new cdk.CfnOutput(this, 'FunctionUrl', {
      value: this.functionUrl.url,
      description: 'Lambda Function URL',
      exportName: `${this.stackName}-FunctionUrl`,
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
      exportName: `${this.stackName}-CloudFrontUrl`,
    });

    new cdk.CfnOutput(this, 'ECRRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      description: 'ECR Repository URI',
      exportName: `${this.stackName}-ECRRepositoryUri`,
    });

    // Tags
    cdk.Tags.of(this).add('Module', 'WebApp');
    cdk.Tags.of(this).add('Framework', 'Next.js');
    cdk.Tags.of(this).add('Adapter', 'Lambda Web Adapter');
    cdk.Tags.of(this).add('CDN', 'CloudFront');

    console.log('✅ WebAppStack (Full) 初期化完了');
  }
}
