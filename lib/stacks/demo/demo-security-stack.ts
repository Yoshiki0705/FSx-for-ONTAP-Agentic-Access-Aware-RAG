/**
 * DemoSecurityStack
 * 
 * Cognito User Pool + オプションのAD Sync Lambda。
 * AD Sync LambdaはWindows AD EC2インスタンスIDが提供された場合に有効化され、
 * SSM経由でPowerShellを実行してADユーザーのSIDを自動取得しDynamoDBに保存する。
 */

import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DemoSecurityStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  /** Windows AD EC2インスタンスID（指定時にAD Sync Lambdaを有効化） */
  adEc2InstanceId?: string;
  /** VPC（AD Sync Lambda用、adEc2InstanceId指定時に必須） */
  vpc?: ec2.IVpc;
  /** Lambda用セキュリティグループ（AD Sync Lambda用） */
  lambdaSg?: ec2.ISecurityGroup;
  /** ユーザーアクセスDynamoDBテーブル（AD Sync結果の保存先） */
  userAccessTable?: dynamodb.ITable;
}

export class DemoSecurityStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  /** AD Sync Lambda関数（オプション） */
  public readonly adSyncFunction?: lambda.Function;

  constructor(scope: Construct, id: string, props: DemoSecurityStackProps) {
    super(scope, id, props);

    const { projectName, environment, adEc2InstanceId } = props;
    const prefix = `${projectName}-${environment}`;

    // ========================================
    // Cognito User Pool
    // ========================================
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${prefix}-user-pool`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
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
    // AD Sync Lambda（オプション）
    // ========================================
    if (adEc2InstanceId) {
      if (!props.vpc) {
        throw new Error('vpc is required when adEc2InstanceId is specified');
      }

      this.adSyncFunction = new lambda.Function(this, 'AdSyncFn', {
        functionName: `${prefix}-ad-sync`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset('lambda/agent-core-ad-sync'),
        timeout: cdk.Duration.minutes(2),
        memorySize: 256,
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: props.lambdaSg ? [props.lambdaSg] : undefined,
        environment: {
          AD_EC2_INSTANCE_ID: adEc2InstanceId,
          IDENTITY_TABLE_NAME: props.userAccessTable?.tableName || `${prefix}-user-access`,
          SSM_TIMEOUT: '60',
          SID_CACHE_TTL: '86400',
        },
      });

      // SSM Run Command権限
      this.adSyncFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'ssm:SendCommand',
          'ssm:GetCommandInvocation',
        ],
        resources: [
          `arn:aws:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:instance/${adEc2InstanceId}`,
          `arn:aws:ssm:${cdk.Aws.REGION}::document/AWS-RunPowerShellScript`,
        ],
      }));

      // DynamoDB書き込み権限
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
        description: 'AD Sync Lambda function name (invoke to auto-retrieve SIDs)',
      });

      new cdk.CfnOutput(this, 'AdSyncFunctionArn', {
        value: this.adSyncFunction.functionArn,
      });
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

    new cdk.CfnOutput(this, 'AdSyncEnabled', {
      value: adEc2InstanceId ? 'true' : 'false',
      description: 'Whether AD Sync Lambda is enabled',
    });

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
  }
}
