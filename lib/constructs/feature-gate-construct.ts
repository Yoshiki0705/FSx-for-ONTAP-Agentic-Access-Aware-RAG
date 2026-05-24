/**
 * FeatureGateConstruct (#12)
 *
 * 段階的機能開放（Feature Gate）を実現する。
 * ユーザーのグループ/ロールに基づいて機能の有効/無効を制御。
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface FeatureGateConstructProps {
  projectName: string;
  environment: string;
}

export class FeatureGateConstruct extends Construct {
  public readonly function: lambda.Function;
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: FeatureGateConstructProps) {
    super(scope, id);

    const prefix = `${props.projectName}-${props.environment}`;

    // DynamoDB Feature Gate Table
    this.table = new dynamodb.Table(this, 'GateTable', {
      tableName: `${prefix}-feature-gates`,
      partitionKey: { name: 'featureId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Function
    this.function = new lambda.Function(this, 'GateFn', {
      functionName: `${prefix}-feature-gate`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambda/feature-gate'),
      timeout: cdk.Duration.seconds(5),
      memorySize: 128,
      environment: {
        FEATURE_GATE_TABLE: this.table.tableName,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    this.table.grantReadData(this.function);

    new cdk.CfnOutput(this, 'FeatureGateTableName', {
      value: this.table.tableName,
    });
  }
}
