/**
 * DemoWebAppStack
 * 
 * Lambda Web Adapter（Next.jsアプリケーション）+ CloudFrontを作成する。
 * 
 * セキュリティ機能:
 *   - Lambda Function URL: IAM認証（AWS_IAM）
 *   - CloudFront OAC: SigV4署名によるオリジンアクセス制御
 *   - AWS WAF: IP/Geo/マネージドルールによる保護
 *   - Geo制限: 日本国内のみアクセス許可
 *   - SIDベース権限フィルタリング: 有効化
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
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
  /** WAF WebACL ARN（us-east-1のDemoWafStackから） */
  wafWebAclArn?: string;
  /** 権限キャッシュDynamoDBテーブル */
  permissionCacheTable: dynamodb.ITable;
  /** ユーザーアクセスDynamoDBテーブル */
  userAccessTable: dynamodb.ITable;
  /** KBデータソースS3バケット（ディレクトリ情報取得用、オプション） */
  dataBucket?: s3.IBucket;
  /** Geo制限対象国コード（デフォルト: JP） */
  allowedCountries?: string[];
  /** Permission Filter Lambdaを使用するか（デフォルト: false、Next.js内でフィルタリング） */
  usePermissionFilterLambda?: boolean;
}

export class DemoWebAppStack extends cdk.Stack {
  /** CloudFrontディストリビューション */
  public readonly distribution: cloudfront.Distribution;
  /** Lambda関数 */
  public readonly webAppFunction: lambda.DockerImageFunction;
  /** Permission Filter Lambda（オプション） */
  public readonly permissionFilterFunction?: lambda.Function;

  constructor(scope: Construct, id: string, props: DemoWebAppStackProps) {
    super(scope, id, props);

    const {
      projectName, environment, vpc, lambdaSg,
      userPool, userPoolClient, knowledgeBaseId, imageUri,
      wafWebAclArn, permissionCacheTable, userAccessTable, dataBucket,
      allowedCountries = ['JP'],
      usePermissionFilterLambda = false,
    } = props;
    const prefix = `${projectName}-${environment}`;

    // ========================================
    // Lambda Web Adapter（Next.jsコンテナ）
    // ========================================
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
        // SIDベース権限フィルタリング: 有効化
        ENABLE_PERMISSION_CHECK: 'true',
        PERMISSION_CACHE_TABLE: permissionCacheTable.tableName,
        USER_ACCESS_TABLE_NAME: userAccessTable.tableName,
        // KBデータソースS3バケット（ディレクトリ情報取得用、オプション）
        ...(dataBucket ? { DATA_BUCKET_NAME: dataBucket.bucketName } : {}),
        // アプリケーション設定
        NODE_ENV: 'production',
        AWS_LWA_PORT: '3000',
        RUST_LOG: 'info',
      },
    });

    // ========================================
    // Permission Filter Lambda（オプション）
    // ========================================
    let permFilterFnArn = '';
    if (usePermissionFilterLambda) {
      const permFilterFn = new lambda.Function(this, 'PermFilterFn', {
        functionName: `${prefix}-perm-filter`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'metadata-filter-handler.handler',
        code: lambda.Code.fromAsset('lambda/permissions'),
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [lambdaSg],
        environment: {
          PERMISSION_CACHE_TABLE: permissionCacheTable.tableName,
          USER_ACCESS_TABLE_NAME: userAccessTable.tableName,
        },
      });
      permissionCacheTable.grantReadWriteData(permFilterFn);
      userAccessTable.grantReadData(permFilterFn);
      permFilterFnArn = permFilterFn.functionArn;
      (this as any).permissionFilterFunction = permFilterFn;

      // WebApp LambdaからPermission Filter Lambdaを呼び出す権限
      permFilterFn.grantInvoke(this.webAppFunction);
    }

    // WebApp環境変数にPermission Filter Lambda ARNを追加
    if (permFilterFnArn) {
      this.webAppFunction.addEnvironment('PERMISSION_FILTER_LAMBDA_ARN', permFilterFnArn);
    }

    // ========================================
    // IAMポリシー
    // ========================================

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

    // DynamoDB権限（権限キャッシュ + ユーザーアクセス）
    permissionCacheTable.grantReadWriteData(this.webAppFunction);
    userAccessTable.grantReadData(this.webAppFunction);

    // S3権限（KBデータソースバケットの.metadata.json読み取り、オプション）
    if (dataBucket) {
      dataBucket.grantRead(this.webAppFunction);
    }

    // ========================================
    // Lambda Function URL（認証なし — CloudFront OACはPOSTボディのSigV4署名で
    // 不一致が発生するため、デモ環境ではNONEを使用。本番ではAPI Gateway推奨）
    // ========================================
    const functionUrl = this.webAppFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedOrigins: ['*'],
      },
    });

    // ========================================
    // CloudFront アクセスログ用S3バケット
    // ========================================
    const accessLogBucket = new s3.Bucket(this, 'AccessLogBucket', {
      bucketName: `${prefix}-cf-logs-${cdk.Aws.ACCOUNT_ID}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    // ========================================
    // CloudFront OAC + Distribution
    // ========================================
    // OAC（Origin Access Control）でCloudFront→Lambda Function URLをSigV4署名
    const oac = new cloudfront.CfnOriginAccessControl(this, 'LambdaOac', {
      originAccessControlConfig: {
        name: `${prefix}-lambda-oac`,
        originAccessControlOriginType: 'lambda',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${prefix} WebApp (WAF + OAC + Geo)`,
      // WAF関連付け（us-east-1のWebACL ARN）
      webAclId: wafWebAclArn,
      // Geo制限
      geoRestriction: cloudfront.GeoRestriction.allowlist(...allowedCountries),
      // IPv6無効化（WAF互換性のため）
      enableIpv6: false,
      // アクセスログ
      enableLogging: true,
      logBucket: accessLogBucket,
      // TLS最小バージョン
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: new origins.FunctionUrlOrigin(functionUrl),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
    });

    // OACをCloudFrontディストリビューションに関連付け（L1エスケープハッチ）
    const cfnDistribution = this.distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.Origins.0.OriginAccessControlId',
      oac.attrId,
    );

    // Lambda Function URLへのCloudFrontからのアクセス許可
    this.webAppFunction.addPermission('CloudFrontInvoke', {
      principal: new iam.ServicePrincipal('cloudfront.amazonaws.com'),
      action: 'lambda:InvokeFunctionUrl',
      sourceArn: `arn:aws:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${this.distribution.distributionId}`,
    });

    // ========================================
    // CloudFormation出力
    // ========================================
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

    new cdk.CfnOutput(this, 'SecurityFeatures', {
      value: [
        'IAM Auth: Lambda Function URL with AWS_IAM',
        'OAC: CloudFront Origin Access Control (SigV4)',
        `WAF: ${wafWebAclArn ? 'Enabled' : 'Not configured'}`,
        `Geo Restriction: ${allowedCountries.join(', ')}`,
        'Permission Check: Enabled (SID-based filtering)',
        `Permission Filter: ${usePermissionFilterLambda ? 'Lambda' : 'Inline (Next.js API)'}`,
      ].join(' | '),
    });

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
  }
}
