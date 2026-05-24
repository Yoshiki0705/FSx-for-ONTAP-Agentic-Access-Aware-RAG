/**
 * FeedbackCollectorConstruct (#11)
 *
 * ユーザーフィードバック（👍/👎）を収集し、RAG品質改善に活用する。
 * WebApp から Lambda Function URL 経由で呼び出される。
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface FeedbackCollectorConstructProps {
  projectName: string;
  environment: string;
  /** レコード保持日数（デフォルト: 365） */
  ttlDays?: number;
}

export class FeedbackCollectorConstruct extends Construct {
  public readonly function: lambda.Function;
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: FeedbackCollectorConstructProps) {
    super(scope, id);

    const prefix = `${props.projectName}-${props.environment}`;
    const ttlDays = props.ttlDays ?? 365;

    // DynamoDB Feedback Table
    this.table = new dynamodb.Table(this, 'FeedbackTable', {
      tableName: `${prefix}-rag-feedback`,
      partitionKey: { name: 'feedbackId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttlEpoch',
    });

    // GSI: 日付別集計用
    this.table.addGlobalSecondaryIndex({
      indexName: 'date-rating-index',
      partitionKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'rating', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: ユーザー別フィードバック
    this.table.addGlobalSecondaryIndex({
      indexName: 'userId-timestamp-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // Lambda Function
    this.function = new lambda.Function(this, 'CollectorFn', {
      functionName: `${prefix}-feedback-collector`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambda/feedback-collector'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        FEEDBACK_TABLE: this.table.tableName,
        TTL_DAYS: String(ttlDays),
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    this.table.grantWriteData(this.function);

    // Outputs
    new cdk.CfnOutput(this, 'FeedbackTableName', {
      value: this.table.tableName,
    });
    new cdk.CfnOutput(this, 'FeedbackFunctionArn', {
      value: this.function.functionArn,
    });
  }
}
