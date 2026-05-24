/**
 * CacheInvalidatorConstruct (#13)
 *
 * DynamoDB Streams (user-access テーブル) → Lambda → permission-cache 削除
 * ユーザーの権限情報が変更された際に、キャッシュを自動的に無効化する。
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface CacheInvalidatorConstructProps {
  projectName: string;
  environment: string;
  /** user-access テーブル（Streams 有効化済み） */
  userAccessTable: dynamodb.ITable;
  /** permission-cache テーブル */
  permissionCacheTable: dynamodb.ITable;
}

export class CacheInvalidatorConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: CacheInvalidatorConstructProps) {
    super(scope, id);

    const prefix = `${props.projectName}-${props.environment}`;

    // Lambda Function
    this.function = new lambda.Function(this, 'InvalidatorFn', {
      functionName: `${prefix}-cache-invalidator`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambda/cache-invalidator'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        PERMISSION_CACHE_TABLE: props.permissionCacheTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant permission to delete from cache table
    props.permissionCacheTable.grantReadWriteData(this.function);

    // DLQ for failed stream processing
    const dlq = new sqs.Queue(this, 'DLQ', {
      queueName: `${prefix}-cache-invalidator-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // DynamoDB Streams event source with DLQ
    this.function.addEventSource(
      new lambdaEventSources.DynamoEventSource(props.userAccessTable, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 10,
        maxBatchingWindow: cdk.Duration.seconds(5),
        retryAttempts: 3,
        onFailure: new lambdaEventSources.SqsDlq(dlq),
      })
    );
  }
}
