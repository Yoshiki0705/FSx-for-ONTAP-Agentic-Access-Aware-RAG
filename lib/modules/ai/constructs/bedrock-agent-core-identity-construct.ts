/**
 * AgentCore Identity Construct
 * 
 * Active Directory SID自動取得とIdentity管理機能を提供
 * 
 * Features:
 * - AD SID自動取得（Lambda + SSM Run Command）
 * - DynamoDB Identity Table（SIDキャッシュ）
 * - IAM権限管理
 * - VPC統合
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface BedrockAgentCoreIdentityConstructProps {
  /**
   * 機能の有効化フラグ
   */
  readonly enabled: boolean;

  /**
   * プロジェクト名
   */
  readonly projectName: string;

  /**
   * 環境名（prod/dev/staging）
   */
  readonly environment: string;

  /**
   * AD SID自動取得の有効化
   */
  readonly adSyncEnabled?: boolean;

  /**
   * Active Directory EC2インスタンスID
   */
  readonly adEc2InstanceId?: string;

  /**
   * Identity DynamoDBテーブル名
   */
  readonly identityTableName?: string;

  /**
   * SIDキャッシュTTL（秒）
   * @default 86400 (24時間)
   */
  readonly sidCacheTtl?: number;

  /**
   * SSMタイムアウト（秒）
   * @default 30
   */
  readonly ssmTimeout?: number;

  /**
   * VPC統合設定
   */
  readonly vpcConfig?: {
    readonly vpcId: string;
    readonly subnetIds: string[];
    readonly securityGroupIds: string[];
  };
}

export class BedrockAgentCoreIdentityConstruct extends Construct {
  /**
   * Identity DynamoDBテーブル
   */
  public readonly identityTable: dynamodb.Table;

  /**
   * AD Sync Lambda関数
   */
  public readonly adSyncFunction?: lambda.Function;

  /**
   * Lambda実行ロール
   */
  public readonly lambdaRole: iam.Role;

  constructor(scope: Construct, id: string, props: BedrockAgentCoreIdentityConstructProps) {
    super(scope, id);

    if (!props.enabled) {
      console.log('AgentCore Identity is disabled');
      return;
    }

    // Identity DynamoDBテーブル作成
    const tableName = props.identityTableName || 
      `${props.projectName}-${props.environment}-identity`;

    this.identityTable = new dynamodb.Table(this, 'IdentityTable', {
      tableName: tableName,
      partitionKey: {
        name: 'username',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true
    });

    // Lambda実行ロール作成
    this.lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'AgentCore Identity Lambda execution role',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // DynamoDB権限追加
    this.identityTable.grantReadWriteData(this.lambdaRole);

    // AD Sync機能が有効な場合
    if (props.adSyncEnabled && props.adEc2InstanceId) {
      // SSM Run Command権限追加
      this.lambdaRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ssm:SendCommand',
          'ssm:GetCommandInvocation'
        ],
        resources: [
          `arn:aws:ec2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:instance/${props.adEc2InstanceId}`,
          `arn:aws:ssm:${cdk.Stack.of(this).region}::document/AWS-RunPowerShellScript`
        ]
      }));

      // VPC統合が有効な場合、VPC権限追加
      if (props.vpcConfig) {
        this.lambdaRole.addToPolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ec2:CreateNetworkInterface',
            'ec2:DescribeNetworkInterfaces',
            'ec2:DeleteNetworkInterface',
            'ec2:AssignPrivateIpAddresses',
            'ec2:UnassignPrivateIpAddresses'
          ],
          resources: ['*']
        }));
      }

      // AD Sync Lambda関数作成
      this.adSyncFunction = new lambda.Function(this, 'AdSyncFunction', {
        functionName: `${props.projectName}-${props.environment}-ad-sync`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset('lambda/agent-core-ad-sync'),
        role: this.lambdaRole,
        timeout: cdk.Duration.seconds(props.ssmTimeout ? props.ssmTimeout + 30 : 60),
        memorySize: 512,
        environment: {
          AD_EC2_INSTANCE_ID: props.adEc2InstanceId,
          IDENTITY_TABLE_NAME: this.identityTable.tableName,
          SSM_TIMEOUT: (props.ssmTimeout || 30).toString(),
          SID_CACHE_TTL: (props.sidCacheTtl || 86400).toString()
        },
        logRetention: logs.RetentionDays.ONE_MONTH,
        description: 'AgentCore AD Sync - Active Directory SID自動取得'
      });

      // タグ追加
      cdk.Tags.of(this.adSyncFunction).add('Project', props.projectName);
      cdk.Tags.of(this.adSyncFunction).add('Environment', props.environment);
      cdk.Tags.of(this.adSyncFunction).add('Component', 'AgentCore-Identity');
    }

    // タグ追加
    cdk.Tags.of(this.identityTable).add('Project', props.projectName);
    cdk.Tags.of(this.identityTable).add('Environment', props.environment);
    cdk.Tags.of(this.identityTable).add('Component', 'AgentCore-Identity');

    // CloudFormation出力
    new cdk.CfnOutput(this, 'IdentityTableName', {
      value: this.identityTable.tableName,
      description: 'AgentCore Identity DynamoDB Table Name',
      exportName: `${props.projectName}-${props.environment}-identity-table-name`
    });

    if (this.adSyncFunction) {
      new cdk.CfnOutput(this, 'AdSyncFunctionArn', {
        value: this.adSyncFunction.functionArn,
        description: 'AgentCore AD Sync Lambda Function ARN',
        exportName: `${props.projectName}-${props.environment}-ad-sync-function-arn`
      });
    }
  }
}
