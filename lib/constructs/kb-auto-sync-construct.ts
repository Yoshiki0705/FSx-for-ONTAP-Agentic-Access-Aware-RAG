/**
 * KbAutoSyncConstruct
 *
 * FSx ONTAP S3 Access Point 上のファイル変更をポーリングベースで検出し、
 * Bedrock Knowledge Base のインジェスションジョブを自動トリガーする。
 *
 * 含まれるリソース:
 * - Lambda 関数 (Python 3.12)
 * - DynamoDB インベントリテーブル
 * - EventBridge Scheduler
 * - CloudWatch Alarm (3回連続エラー)
 * - IAM ロール (最小権限)
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import { Construct } from 'constructs';

export interface KbAutoSyncConstructProps {
  /** プロジェクト名 */
  projectName: string;
  /** 環境名 */
  environment: string;
  /** Bedrock Knowledge Base ID */
  knowledgeBaseId: string;
  /** Bedrock KB Data Source ID */
  dataSourceId: string;
  /** FSx ONTAP S3 Access Point ARN */
  s3AccessPointArn: string;
  /** ポーリング間隔（分）。デフォルト: 5 */
  intervalMinutes?: number;
  /**
   * FSx for ONTAP SVM ID（オプション）。
   * 指定時、AD参加 SVM での S3 AP AccessDenied 発生時に
   * FSx API 経由で AD DC 到達性を診断し、より精度の高いエラー情報を提供する。
   * AD参加 SVM では全ての S3 AP データ操作に AD DC 到達性が必須。
   */
  svmId?: string;
}

export class KbAutoSyncConstruct extends Construct {
  /** Lambda 関数名 */
  public readonly functionName: string;
  /** DynamoDB テーブル名 */
  public readonly tableName: string;
  /** EventBridge Scheduler ARN */
  public readonly schedulerArn: string;
  /** Lambda 関数（監視用） */
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: KbAutoSyncConstructProps) {
    super(scope, id);

    const { projectName, environment } = props;
    const prefix = `${projectName}-${environment}`;
    const intervalMinutes = props.intervalMinutes ?? 5;

    // --- バリデーション: 間隔は 1〜1440 分 (Task 4.4) ---
    if (intervalMinutes < 1 || intervalMinutes > 1440) {
      throw new Error(
        `kbAutoSyncIntervalMinutes must be between 1 and 1440, got: ${intervalMinutes}`
      );
    }

    // --- DynamoDB Inventory Table (Task 4.1) ---
    const inventoryTable = new dynamodb.Table(this, 'InventoryTable', {
      tableName: `${prefix}-kb-sync-inventory`,
      partitionKey: { name: 'fileKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // --- Lambda Function (Task 4.1) ---
    const fn = new lambda.Function(this, 'SyncFunction', {
      functionName: `${prefix}-kb-auto-sync`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset('lambda/kb-auto-sync'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        S3_ACCESS_POINT_ARN: props.s3AccessPointArn,
        KNOWLEDGE_BASE_ID: props.knowledgeBaseId,
        DATA_SOURCE_ID: props.dataSourceId,
        INVENTORY_TABLE_NAME: inventoryTable.tableName,
        ...(props.svmId ? { SVM_ID: props.svmId } : {}),
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // --- IAM Policy (最小権限) (Task 4.2) ---
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket', 's3:GetObject'],
        resources: [
          props.s3AccessPointArn,
          `${props.s3AccessPointArn}/object/*`,
        ],
      })
    );

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'bedrock:StartIngestionJob',
          'bedrock:GetIngestionJob',
          'bedrock:ListIngestionJobs',
        ],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:knowledge-base/${props.knowledgeBaseId}`,
        ],
      })
    );

    inventoryTable.grantReadWriteData(fn);

    // --- IAM Policy: FSx SVM AD診断（svmId指定時のみ） ---
    if (props.svmId) {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['fsx:DescribeStorageVirtualMachines'],
          resources: ['*'],
        })
      );
    }

    // --- EventBridge Scheduler (Task 4.3) ---
    const schedulerRole = new iam.Role(this, 'SchedulerRole', {
      roleName: `${prefix}-kb-sync-scheduler-role`,
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });

    fn.grantInvoke(schedulerRole);

    const schedule = new scheduler.CfnSchedule(this, 'Schedule', {
      name: `${prefix}-kb-auto-sync-schedule`,
      scheduleExpression: `rate(${intervalMinutes} minutes)`,
      flexibleTimeWindow: { mode: 'OFF' },
      target: {
        arn: fn.functionArn,
        roleArn: schedulerRole.roleArn,
      },
    });

    // --- CloudWatch Alarm (3回連続エラー) (Task 4.6) ---
    new cloudwatch.Alarm(this, 'ConsecutiveErrors', {
      alarmName: `${prefix}-kb-auto-sync-errors`,
      metric: fn.metricErrors({ period: cdk.Duration.minutes(intervalMinutes) }),
      threshold: 1,
      evaluationPeriods: 3,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // --- Construct プロパティの公開 (Task 4.7) ---
    this.functionName = fn.functionName;
    this.tableName = inventoryTable.tableName;
    this.schedulerArn = schedule.attrArn;
    this.function = fn;
  }
}
