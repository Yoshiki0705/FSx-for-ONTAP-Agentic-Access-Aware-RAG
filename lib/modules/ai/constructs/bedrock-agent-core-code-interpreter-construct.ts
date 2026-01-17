/**
 * Amazon Bedrock AgentCore Code Interpreter Construct
 * 
 * Pythonコードを安全なサンドボックス環境で実行する機能を提供します。
 * 
 * 主要機能:
 * - セッション管理（開始、停止）
 * - コード実行（Python）
 * - ファイル操作（書き込み、読み込み、削除、一覧）
 * - ターミナルコマンド実行
 * - FSx for ONTAP統合（オプション）
 * 
 * @author Kiro AI
 * @date 2026-01-04
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * Code Interpreter Construct設定インターフェース
 */
export interface BedrockAgentCoreCodeInterpreterConstructProps {
  /**
   * 機能の有効化フラグ
   */
  readonly enabled: boolean;

  /**
   * プロジェクト名
   */
  readonly projectName: string;

  /**
   * 環境名（prod, dev等）
   */
  readonly environment: string;

  /**
   * VPC設定（オプション）
   */
  readonly vpc?: ec2.IVpc;

  /**
   * セキュリティグループ（オプション）
   */
  readonly securityGroup?: ec2.ISecurityGroup;

  /**
   * FSx for ONTAP S3 Access Point ARN（オプション）
   * 指定された場合、ファイル操作でFSx for ONTAPを使用
   */
  readonly fsxS3AccessPointArn?: string;

  /**
   * KMS暗号化キー（オプション）
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * Lambda関数設定（オプション）
   */
  readonly lambdaConfig?: {
    /**
     * メモリサイズ（MB）
     * @default 2048
     */
    memorySize?: number;

    /**
     * タイムアウト（秒）
     * @default 300
     */
    timeout?: number;

    /**
     * Ephemeral Storage（MB）
     * @default 2048
     */
    ephemeralStorageSize?: number;

    /**
     * Reserved Concurrency
     * @default undefined（無制限）
     */
    reservedConcurrentExecutions?: number;
  };

  /**
   * サンドボックス設定（オプション）
   */
  readonly sandboxConfig?: {
    /**
     * Python実行タイムアウト（秒）
     * @default 60
     */
    executionTimeout?: number;

    /**
     * メモリ制限（MB）
     * @default 512
     */
    memoryLimit?: number;

    /**
     * 許可されるPythonパッケージ
     * @default ['numpy', 'pandas', 'matplotlib', 'scipy']
     */
    allowedPackages?: string[];

    /**
     * ネットワークアクセス許可
     * @default false
     */
    allowNetworkAccess?: boolean;
  };

  /**
   * セッション設定（オプション）
   */
  readonly sessionConfig?: {
    /**
     * セッションタイムアウト（秒）
     * @default 3600
     */
    sessionTimeout?: number;

    /**
     * 最大同時セッション数
     * @default 10
     */
    maxConcurrentSessions?: number;
  };
}

/**
 * Amazon Bedrock AgentCore Code Interpreter Construct
 * 
 * Pythonコードを安全なサンドボックス環境で実行する機能を提供します。
 */
export class BedrockAgentCoreCodeInterpreterConstruct extends Construct {
  /**
   * Code Interpreter Lambda関数
   */
  public readonly interpreterFunction?: lambda.Function;

  /**
   * KMS暗号化キー
   */
  public readonly encryptionKey?: kms.Key;

  /**
   * IAM実行ロール
   */
  public readonly executionRole?: iam.Role;

  constructor(scope: Construct, id: string, props: BedrockAgentCoreCodeInterpreterConstructProps) {
    super(scope, id);

    // 機能が無効化されている場合は何もしない
    if (!props.enabled) {
      return;
    }

    // KMS暗号化キーの作成または使用
    this.encryptionKey = props.encryptionKey as kms.Key | undefined || this.createEncryptionKey(props);

    // IAM実行ロールの作成
    this.executionRole = this.createExecutionRole(props);

    // Code Interpreter Lambda関数の作成
    this.interpreterFunction = this.createInterpreterFunction(props);

    // タグ付け
    this.applyTags(props);
  }

  /**
   * KMS暗号化キーを作成
   */
  private createEncryptionKey(props: BedrockAgentCoreCodeInterpreterConstructProps): kms.Key {
    return new kms.Key(this, 'EncryptionKey', {
      description: `${props.projectName}-${props.environment}-agent-core-code-interpreter-key`,
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }

  /**
   * IAM実行ロールを作成
   */
  private createExecutionRole(props: BedrockAgentCoreCodeInterpreterConstructProps): iam.Role {
    const role = new iam.Role(this, 'ExecutionRole', {
      roleName: `${props.projectName}-${props.environment}-code-interpreter-execution-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for AgentCore Code Interpreter Lambda function',
    });

    // CloudWatch Logs権限
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    );

    // VPC統合権限（VPCが指定されている場合）
    if (props.vpc) {
      role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
      );
    }

    // FSx for ONTAP S3 Access Point権限
    if (props.fsxS3AccessPointArn) {
      role.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket',
          ],
          resources: [
            props.fsxS3AccessPointArn,
            `${props.fsxS3AccessPointArn}/*`,
          ],
        })
      );
    }

    // Bedrock権限（Code Interpreter API）
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: ['*'],
      })
    );

    // KMS権限
    if (this.encryptionKey) {
      this.encryptionKey.grantEncryptDecrypt(role);
    }

    return role;
  }

  /**
   * Code Interpreter Lambda関数を作成
   */
  private createInterpreterFunction(props: BedrockAgentCoreCodeInterpreterConstructProps): lambda.Function {
    const memorySize = props.lambdaConfig?.memorySize || 2048;
    const timeout = props.lambdaConfig?.timeout || 300;
    const ephemeralStorageSize = props.lambdaConfig?.ephemeralStorageSize || 2048;

    const func = new lambda.Function(this, 'InterpreterFunction', {
      functionName: `${props.projectName}-${props.environment}-agent-core-code-interpreter`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/agent-core-code-interpreter'),
      role: this.executionRole,
      memorySize,
      timeout: cdk.Duration.seconds(timeout),
      ephemeralStorageSize: cdk.Size.mebibytes(ephemeralStorageSize),
      reservedConcurrentExecutions: props.lambdaConfig?.reservedConcurrentExecutions,
      vpc: props.vpc,
      vpcSubnets: props.vpc ? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } : undefined,
      securityGroups: props.securityGroup ? [props.securityGroup] : undefined,
      environment: {
        PROJECT_NAME: props.projectName,
        ENVIRONMENT: props.environment,
        FSX_S3_ACCESS_POINT_ARN: props.fsxS3AccessPointArn || '',
        EXECUTION_TIMEOUT: String(props.sandboxConfig?.executionTimeout || 60),
        MEMORY_LIMIT: String(props.sandboxConfig?.memoryLimit || 512),
        ALLOWED_PACKAGES: JSON.stringify(props.sandboxConfig?.allowedPackages || ['numpy', 'pandas', 'matplotlib', 'scipy']),
        ALLOW_NETWORK_ACCESS: String(props.sandboxConfig?.allowNetworkAccess ?? false),
        SESSION_TIMEOUT: String(props.sessionConfig?.sessionTimeout || 3600),
        MAX_CONCURRENT_SESSIONS: String(props.sessionConfig?.maxConcurrentSessions || 10),
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    return func;
  }

  /**
   * タグを適用
   */
  private applyTags(props: BedrockAgentCoreCodeInterpreterConstructProps): void {
    const tags = {
      Project: props.projectName,
      Environment: props.environment,
      Component: 'AgentCore-CodeInterpreter',
      ManagedBy: 'CDK',
    };

    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}
