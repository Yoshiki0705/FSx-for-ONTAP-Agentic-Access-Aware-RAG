/**
 * ProvenanceLoggerConstruct (#7)
 *
 * RAG回答の根拠追跡（Provenance）を DynamoDB 監査テーブルに記録する。
 * WebApp Lambda から非同期呼び出しされる。
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ProvenanceLoggerConstructProps {
  projectName: string;
  environment: string;
  /** レコード保持日数（デフォルト: 90） */
  ttlDays?: number;
}

export class ProvenanceLoggerConstruct extends Construct {
  public readonly function: lambda.Function;
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: ProvenanceLoggerConstructProps) {
    super(scope, id);

    const prefix = `${props.projectName}-${props.environment}`;
    const ttlDays = props.ttlDays ?? 90;

    // DynamoDB Provenance Table
    this.table = new dynamodb.Table(this, 'ProvenanceTable', {
      tableName: `${prefix}-rag-provenance`,
      partitionKey: { name: 'responseId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttlEpoch',
    });

    // GSI: userId で検索（特定ユーザーの回答履歴を監査）
    this.table.addGlobalSecondaryIndex({
      indexName: 'userId-timestamp-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Lambda Function
    this.function = new lambda.Function(this, 'LoggerFn', {
      functionName: `${prefix}-provenance-logger`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambda/provenance-logger'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        PROVENANCE_TABLE: this.table.tableName,
        TTL_DAYS: String(ttlDays),
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant write access
    this.table.grantWriteData(this.function);

    // Output
    new cdk.CfnOutput(this, 'ProvenanceTableName', {
      value: this.table.tableName,
      description: 'RAG Provenance audit table name',
    });

    new cdk.CfnOutput(this, 'ProvenanceFunctionArn', {
      value: this.function.functionArn,
      description: 'Provenance Logger Lambda ARN (for async invocation from WebApp)',
    });
  }
}
