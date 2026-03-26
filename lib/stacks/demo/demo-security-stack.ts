/**
 * DemoSecurityStack
 *
 * Cognito User Pool + オプションのAD Sync Lambda。
 *
 * AD Sync方式:
 *   - managed: AWS Managed AD / AD Connector（LDAP or SSM経由）
 *   - self-managed: セルフマネージドAD（SSM→Windows EC2→PowerShell）
 *   - none: AD Sync無効（手動SID登録）
 */

import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export type AdType = 'managed' | 'self-managed' | 'none';

export interface DemoSecurityStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  /** AD Sync方式（デフォルト: none） */
  adType?: AdType;
  /** Windows AD EC2インスタンスID（self-managed / managed+EC2 で必須） */
  adEc2InstanceId?: string;
  /** AWS Managed AD Directory ID（managed で使用） */
  adDirectoryId?: string;
  /** ADドメイン名（managed で使用） */
  adDomainName?: string;
  /** AD DNS IPs（managed で使用、カンマ区切り） */
  adDnsIps?: string;
  /** VPC（AD Sync Lambda用） */
  vpc?: ec2.IVpc;
  /** Lambda用セキュリティグループ */
  lambdaSg?: ec2.ISecurityGroup;
  /** ユーザーアクセスDynamoDBテーブル */
  userAccessTable?: dynamodb.ITable;
}

export class DemoSecurityStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public adSyncFunction?: lambda.Function;

  constructor(scope: Construct, id: string, props: DemoSecurityStackProps) {
    super(scope, id, props);

    const { projectName, environment } = props;
    const prefix = `${projectName}-${environment}`;
    const adType = props.adType || 'none';

    // ========================================
    // Cognito User Pool
    // ========================================
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${prefix}-user-pool`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
      passwordPolicy: {
        minLength: 8, requireLowercase: true, requireUppercase: true,
        requireDigits: true, requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolClient = this.userPool.addClient('WebAppClient', {
      userPoolClientName: `${prefix}-webapp-client`,
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
    });

    // ========================================
    // AD Sync Lambda（adType != 'none' の場合）
    // ========================================
    if (adType !== 'none') {
      this.createAdSyncLambda(prefix, adType, props);
    }

    // ========================================
    // CloudFormation出力
    // ========================================
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `${prefix}-UserPoolId`,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `${prefix}-UserPoolClientId`,
    });
    new cdk.CfnOutput(this, 'AdSyncMode', {
      value: adType,
      description: 'AD Sync mode: managed | self-managed | none',
    });

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
  }

  private createAdSyncLambda(prefix: string, adType: AdType, props: DemoSecurityStackProps): void {
    // バリデーション
    if (adType === 'self-managed' && !props.adEc2InstanceId) {
      throw new Error('adEc2InstanceId is required for self-managed AD');
    }
    if (adType === 'managed' && !props.adDirectoryId && !props.adDnsIps) {
      throw new Error('adDirectoryId or adDnsIps is required for managed AD');
    }

    const env: Record<string, string> = {
      AD_TYPE: adType,
      USER_ACCESS_TABLE_NAME: props.userAccessTable?.tableName || `${prefix}-user-access`,
      SSM_TIMEOUT: '60',
      SID_CACHE_TTL: '86400',
    };

    if (props.adEc2InstanceId) env.AD_EC2_INSTANCE_ID = props.adEc2InstanceId;
    if (props.adDirectoryId) env.AD_DIRECTORY_ID = props.adDirectoryId;
    if (props.adDomainName) env.AD_DOMAIN_NAME = props.adDomainName;
    if (props.adDnsIps) env.AD_DNS_IPS = props.adDnsIps;

    this.adSyncFunction = new lambda.Function(this, 'AdSyncFn', {
      functionName: `${prefix}-ad-sync`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/agent-core-ad-sync'),
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      ...(props.vpc ? {
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: props.lambdaSg ? [props.lambdaSg] : undefined,
      } : {}),
      environment: env,
    });

    // SSM権限（self-managed / managed+EC2）
    if (props.adEc2InstanceId) {
      this.adSyncFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ssm:SendCommand', 'ssm:GetCommandInvocation'],
        resources: [
          `arn:aws:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:instance/${props.adEc2InstanceId}`,
          `arn:aws:ssm:${cdk.Aws.REGION}::document/AWS-RunPowerShellScript`,
        ],
      }));
    }

    // Directory Service権限（managed）
    if (adType === 'managed') {
      this.adSyncFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ds:DescribeDirectories'],
        resources: ['*'],
      }));
    }

    // DynamoDB権限
    if (props.userAccessTable) {
      props.userAccessTable.grantReadWriteData(this.adSyncFunction);
    } else {
      this.adSyncFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['dynamodb:PutItem', 'dynamodb:GetItem'],
        resources: [`arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/${prefix}-user-access`],
      }));
    }

    new cdk.CfnOutput(this, 'AdSyncFunctionName', {
      value: this.adSyncFunction.functionName,
      description: `AD Sync Lambda (${adType} mode)`,
    });
  }
}
