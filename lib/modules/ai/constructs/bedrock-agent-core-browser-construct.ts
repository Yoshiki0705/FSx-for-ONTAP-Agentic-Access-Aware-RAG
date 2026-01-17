/**
 * Amazon Bedrock AgentCore Browser Construct
 * 
 * Headless Chromeによるブラウザ自動化機能を提供します。
 * 
 * 主要機能:
 * - Headless Chrome統合（Puppeteer）
 * - Webスクレイピング（Cheerio）
 * - スクリーンショット撮影
 * - FSx for ONTAP + S3 Access Points統合
 * 
 * @author Kiro AI
 * @date 2026-01-04
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * Browser Construct設定インターフェース
 */
export interface BedrockAgentCoreBrowserConstructProps {
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
   * スクリーンショット保存用S3バケット（オプション）
   */
  readonly screenshotBucket?: s3.IBucket;

  /**
   * FSx for ONTAP S3 Access Point ARN（オプション）
   * 指定された場合、S3バケットの代わりにFSx for ONTAPを使用
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
   * スクリーンショット設定（オプション）
   */
  readonly screenshotConfig?: {
    /**
     * 画像フォーマット
     * @default 'png'
     */
    format?: 'png' | 'jpeg' | 'webp';

    /**
     * 保存期間（日）
     * @default 7
     */
    retentionDays?: number;

    /**
     * サムネイル生成
     * @default true
     */
    generateThumbnail?: boolean;
  };

  /**
   * Webスクレイピング設定（オプション）
   */
  readonly scrapingConfig?: {
    /**
     * レート制限（リクエスト/分/ドメイン）
     * @default 10
     */
    rateLimit?: number;

    /**
     * robots.txt尊重
     * @default true
     */
    respectRobotsTxt?: boolean;

    /**
     * ユーザーエージェント
     * @default 'BedrockAgentCore-Browser/1.0'
     */
    userAgent?: string;
  };
}

/**
 * Amazon Bedrock AgentCore Browser Construct
 * 
 * Headless Chromeによるブラウザ自動化機能を提供します。
 */
export class BedrockAgentCoreBrowserConstruct extends Construct {
  /**
   * Browser Lambda関数
   */
  public readonly browserFunction?: lambda.Function;

  /**
   * スクリーンショット保存用S3バケット
   */
  public readonly screenshotBucket?: s3.Bucket;

  /**
   * KMS暗号化キー
   */
  public readonly encryptionKey?: kms.Key;

  /**
   * IAM実行ロール
   */
  public readonly executionRole?: iam.Role;

  constructor(scope: Construct, id: string, props: BedrockAgentCoreBrowserConstructProps) {
    super(scope, id);

    // 機能が無効化されている場合は何もしない
    if (!props.enabled) {
      return;
    }

    // KMS暗号化キーの作成または使用
    this.encryptionKey = props.encryptionKey as kms.Key | undefined || this.createEncryptionKey(props);

    // スクリーンショット保存用S3バケットの作成または使用
    this.screenshotBucket = props.screenshotBucket as s3.Bucket | undefined || this.createScreenshotBucket(props);

    // IAM実行ロールの作成
    this.executionRole = this.createExecutionRole(props);

    // Browser Lambda関数の作成
    this.browserFunction = this.createBrowserFunction(props);

    // タグ付け
    this.applyTags(props);
  }

  /**
   * KMS暗号化キーを作成
   */
  private createEncryptionKey(props: BedrockAgentCoreBrowserConstructProps): kms.Key {
    return new kms.Key(this, 'EncryptionKey', {
      description: `${props.projectName}-${props.environment}-agent-core-browser-key`,
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }

  /**
   * スクリーンショット保存用S3バケットを作成
   */
  private createScreenshotBucket(props: BedrockAgentCoreBrowserConstructProps): s3.Bucket {
    const retentionDays = props.screenshotConfig?.retentionDays || 7;

    return new s3.Bucket(this, 'ScreenshotBucket', {
      bucketName: `${props.projectName}-${props.environment}-browser-screenshots`.toLowerCase(),
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'DeleteOldScreenshots',
          enabled: true,
          expiration: cdk.Duration.days(retentionDays),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }

  /**
   * IAM実行ロールを作成
   */
  private createExecutionRole(props: BedrockAgentCoreBrowserConstructProps): iam.Role {
    const role = new iam.Role(this, 'ExecutionRole', {
      roleName: `${props.projectName}-${props.environment}-browser-execution-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for AgentCore Browser Lambda function',
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

    // S3アクセス権限
    if (this.screenshotBucket) {
      this.screenshotBucket.grantReadWrite(role);
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

    // KMS権限
    if (this.encryptionKey) {
      this.encryptionKey.grantEncryptDecrypt(role);
    }

    return role;
  }

  /**
   * Browser Lambda関数を作成
   */
  private createBrowserFunction(props: BedrockAgentCoreBrowserConstructProps): lambda.Function {
    const memorySize = props.lambdaConfig?.memorySize || 2048;
    const timeout = props.lambdaConfig?.timeout || 300;
    const ephemeralStorageSize = props.lambdaConfig?.ephemeralStorageSize || 2048;

    const func = new lambda.Function(this, 'BrowserFunction', {
      functionName: `${props.projectName}-${props.environment}-agent-core-browser`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/agent-core-browser'),
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
        SCREENSHOT_BUCKET: this.screenshotBucket?.bucketName || '',
        FSX_S3_ACCESS_POINT_ARN: props.fsxS3AccessPointArn || '',
        SCREENSHOT_FORMAT: props.screenshotConfig?.format || 'png',
        GENERATE_THUMBNAIL: String(props.screenshotConfig?.generateThumbnail ?? true),
        RATE_LIMIT: String(props.scrapingConfig?.rateLimit || 10),
        RESPECT_ROBOTS_TXT: String(props.scrapingConfig?.respectRobotsTxt ?? true),
        USER_AGENT: props.scrapingConfig?.userAgent || 'BedrockAgentCore-Browser/1.0',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    return func;
  }

  /**
   * タグを適用
   */
  private applyTags(props: BedrockAgentCoreBrowserConstructProps): void {
    const tags = {
      Project: props.projectName,
      Environment: props.environment,
      Component: 'AgentCore-Browser',
      ManagedBy: 'CDK',
    };

    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}
