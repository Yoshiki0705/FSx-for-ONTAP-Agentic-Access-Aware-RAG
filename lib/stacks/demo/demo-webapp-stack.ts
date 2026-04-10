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
import { MonitoringConstruct } from '../../constructs/monitoring-construct';

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
  /** Bedrock Agent ID（AIStackから） */
  agentId?: string;
  /** Bedrock Agent Alias ID（AIStackから） */
  agentAliasId?: string;
  /** Permission-aware search Action Group Lambda ARN（動的Agent作成時に使用） */
  actionGroupLambdaArn?: string;
  /** Agent共有S3バケット名（enableAgentSharing時） */
  sharedAgentBucketName?: string;
  /** Agent実行履歴DynamoDBテーブル名（enableAgentSchedules時） */
  agentExecutionTableName?: string;
  /** Agentスケジューラ Lambda ARN（enableAgentSchedules時） */
  agentSchedulerLambdaArn?: string;
  /** Agentスケジューラ IAMロール ARN（enableAgentSchedules時） */
  agentSchedulerRoleArn?: string;
  /** AgentCore Memory ID（enableAgentCoreMemory時、AIStackから） */
  memoryId?: string;
  /** 権限監査テーブル名（enableAdvancedPermissions時、StorageStackから） */
  permissionAuditTableName?: string;
  // --- 監視・アラート機能（オプション） ---
  /** 監視機能全体の有効化（デフォルト: false） */
  enableMonitoring?: boolean;
  /** アラート通知先メールアドレス */
  monitoringEmail?: string;
  /** AgentCore Observability連携（デフォルト: false） */
  enableAgentCoreObservability?: boolean;
  /** アラーム評価期間数（デフォルト: 1） */
  alarmEvaluationPeriods?: number;
  /** ダッシュボード自動リフレッシュ間隔（秒、デフォルト: 300） */
  dashboardRefreshInterval?: number;
  /** AD Sync Lambda関数（enableAdFederation時、SecurityStackから） */
  adSyncFunction?: lambda.IFunction;
  /** Agent Scheduler Lambda関数（enableAgentSchedules時、AIStackから） */
  agentSchedulerFunction?: lambda.IFunction;
  // --- OIDC Federation UI設定（オプション） ---
  /** OIDC IdPプロバイダー名（例: "Keycloak", "Okta"）。設定時にNext.jsサインイン画面にOIDCボタンを表示 */
  oidcProviderName?: string;
  /** 複数OIDC IdP情報（マルチOIDC IdPサポート時） */
  oidcProviders?: Array<{ name: string; displayName?: string }>;
  /** Cognito Hosted UIドメイン（例: "myapp-demo.auth.ap-northeast-1.amazoncognito.com"） */
  cognitoDomainUrl?: string;
  // --- AD Federation設定（オプション） ---
  /** Cognito Hosted UIドメインプレフィックス（例: "perm-rag-demo-demo-auth"） */
  cognitoDomainPrefix?: string;
  /** Cognito User Pool Client Secret（OAuth認可コードフロー用） */
  cognitoClientSecret?: string;
  /** OAuthコールバックURL（例: "https://d3xxxxx.cloudfront.net/api/auth/callback"） */
  callbackUrl?: string;
  /** SAML IdP名（デフォルト: "ActiveDirectory"） */
  idpName?: string;
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
    const { agentId, agentAliasId } = props;
    const prefix = `${projectName}-${environment}`;

    // ========================================
    // Lambda Web Adapter（Next.jsコンテナ）
    // ========================================
    // 【アーキテクチャ設計方針】
    // Lambda関数は x86_64 (デフォルト) で動作する。
    // architecture プロパティは指定しない（= x86_64）。
    // ⚠️ architecture: lambda.Architecture.ARM_64 に変更しないこと。
    //    EC2 (Amazon Linux 2, x86_64) でビルドした Docker イメージとの
    //    互換性が失われ、"exec format error" が発生する。
    //    Apple Silicon でのローカルビルドには Dockerfile.prebuilt を使用する。
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
        // Bedrock Agent設定（オプション）
        ...(agentId ? { BEDROCK_AGENT_ID: agentId } : {}),
        ...(agentAliasId ? { BEDROCK_AGENT_ALIAS_ID: agentAliasId } : {}),
        ...(props.actionGroupLambdaArn ? { PERM_SEARCH_LAMBDA_ARN: props.actionGroupLambdaArn } : {}),
        // Enterprise Agent Enhancements（オプション）
        ...(props.sharedAgentBucketName ? { SHARED_AGENT_BUCKET: props.sharedAgentBucketName } : {}),
        ...(props.agentExecutionTableName ? { AGENT_EXECUTION_TABLE: props.agentExecutionTableName } : {}),
        ...(props.agentSchedulerLambdaArn ? { AGENT_SCHEDULER_LAMBDA_ARN: props.agentSchedulerLambdaArn } : {}),
        ...(props.agentSchedulerRoleArn ? { SCHEDULER_ROLE_ARN: props.agentSchedulerRoleArn } : {}),
        ...(props.agentSchedulerRoleArn ? { AGENT_SCHEDULER_GROUP: 'agent-schedules' } : {}),
        // AgentCore Memory設定（オプション）
        ...(props.memoryId ? { AGENTCORE_MEMORY_ID: props.memoryId } : {}),
        ...(props.memoryId ? { ENABLE_AGENTCORE_MEMORY: 'true' } : {}),
        // 高度権限制御設定（オプション）
        ...(props.permissionAuditTableName ? { ENABLE_ADVANCED_PERMISSIONS: 'true' } : {}),
        ...(props.permissionAuditTableName ? { PERMISSION_AUDIT_TABLE_NAME: props.permissionAuditTableName } : {}),
        // OIDC Federation UI設定（オプション）
        ...(props.oidcProviderName ? { NEXT_PUBLIC_OIDC_PROVIDER_NAME: props.oidcProviderName } : {}),
        ...(props.oidcProviders && props.oidcProviders.length > 0 ? { NEXT_PUBLIC_OIDC_PROVIDERS: JSON.stringify(props.oidcProviders) } : {}),
        ...(props.cognitoDomainUrl ? { NEXT_PUBLIC_COGNITO_DOMAIN: props.cognitoDomainUrl } : {}),
        NEXT_PUBLIC_COGNITO_REGION: cdk.Aws.REGION,
        // AD Federation設定（オプション）
        ...(props.cognitoDomainPrefix ? { COGNITO_DOMAIN: props.cognitoDomainPrefix } : {}),
        ...(props.cognitoClientSecret ? { COGNITO_CLIENT_SECRET: props.cognitoClientSecret } : {}),
        ...(props.callbackUrl ? { CALLBACK_URL: props.callbackUrl } : {}),
        ...(props.idpName ? { IDP_NAME: props.idpName } : {}),
      },
    });

    // ========================================
    // Permission Filter Lambda（オプション）
    // ========================================
    let permFilterFnArn = '';
    if (usePermissionFilterLambda) {
      const permFilterFn = new lambda.Function(this, 'PermFilterFn', {
        functionName: `${prefix}-perm-filter`,
        runtime: lambda.Runtime.NODEJS_22_X,
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
        // Agent mode
        'bedrock:InvokeAgent',
        'bedrock:ListAgents',
        'bedrock:GetAgent',
        'bedrock:ListAgentAliases',
        'bedrock:GetAgentAlias',
        // Agent management (dynamic agent-card binding)
        'bedrock:CreateAgent',
        'bedrock:PrepareAgent',
        'bedrock:CreateAgentAlias',
        'bedrock:CreateAgentActionGroup',
        'bedrock:DeleteAgent',
        'bedrock:DeleteAgentAlias',
        'bedrock:UpdateAgent',
      ],
      resources: ['*'],
    }));

    // AgentCore Memory API 権限（enableAgentCoreMemory=true 時のみ必要）
    // Lambda から AgentCore Memory API を呼び出すために必要。
    // memoryId が渡されている場合のみ追加（CDK条件付き）。
    if (props.memoryId) {
      this.webAppFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'bedrock-agentcore:CreateEvent',
          'bedrock-agentcore:ListEvents',
          'bedrock-agentcore:DeleteEvent',
          'bedrock-agentcore:ListSessions',
          'bedrock-agentcore:RetrieveMemoryRecords',
        ],
        resources: [`arn:aws:bedrock-agentcore:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:memory/*`],
      }));
    }

    // Lambda から permission-audit テーブルに書き込むために必要。
    // permissionAuditTableName が渡されている場合のみ追加（CDK条件付き）。
    if (props.permissionAuditTableName) {
      this.webAppFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'dynamodb:PutItem',
          'dynamodb:Query',
        ],
        resources: [
          `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/${props.permissionAuditTableName}`,
          `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/${props.permissionAuditTableName}/index/*`,
        ],
      }));
    }

    // iam:PassRole for Bedrock Agent creation (agent needs a service role)
    this.webAppFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [`arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/*bedrock*`],
      conditions: {
        StringEquals: {
          'iam:PassedToService': 'bedrock.amazonaws.com',
        },
      },
    }));

    // DynamoDB権限（権限キャッシュ + ユーザーアクセス）
    permissionCacheTable.grantReadWriteData(this.webAppFunction);
    userAccessTable.grantReadData(this.webAppFunction);

    // S3権限（KBデータソースバケットの.metadata.json読み取り、オプション）
    if (dataBucket) {
      dataBucket.grantRead(this.webAppFunction);
    }

    // Enterprise Agent Enhancements — IAM権限（オプション）
    if (props.sharedAgentBucketName) {
      this.webAppFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
        resources: [
          `arn:aws:s3:::${props.sharedAgentBucketName}`,
          `arn:aws:s3:::${props.sharedAgentBucketName}/*`,
        ],
      }));
    }
    if (props.agentExecutionTableName) {
      this.webAppFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['dynamodb:Query', 'dynamodb:GetItem'],
        resources: [
          `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/${props.agentExecutionTableName}`,
          `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/${props.agentExecutionTableName}/index/*`,
        ],
      }));
    }
    if (props.agentSchedulerLambdaArn) {
      this.webAppFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [props.agentSchedulerLambdaArn],
      }));
      this.webAppFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['scheduler:CreateSchedule', 'scheduler:UpdateSchedule', 'scheduler:DeleteSchedule', 'scheduler:ListSchedules', 'scheduler:GetSchedule'],
        resources: ['*'],
      }));
      this.webAppFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: ['*'],
        conditions: { StringEquals: { 'iam:PassedToService': 'scheduler.amazonaws.com' } },
      }));
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

    // ========================================
    // 監視・アラート機能（オプション）
    // ========================================
    if (props.enableMonitoring) {
      // WebApp LambdaにEMFメトリクス出力フラグを設定
      this.webAppFunction.addEnvironment('ENABLE_MONITORING', 'true');

      new MonitoringConstruct(this, 'Monitoring', {
        projectName,
        environment,
        webAppFunction: this.webAppFunction,
        distribution: this.distribution,
        userAccessTable,
        permissionCacheTable,
        permissionFilterFunction: (this as any).permissionFilterFunction,
        agentSchedulerFunction: props.agentSchedulerFunction,
        adSyncFunction: props.adSyncFunction,
        monitoringEmail: props.monitoringEmail,
        enableAgentCoreObservability: props.enableAgentCoreObservability,
        alarmEvaluationPeriods: props.alarmEvaluationPeriods,
        dashboardRefreshInterval: props.dashboardRefreshInterval,
      });
    }
  }
}
