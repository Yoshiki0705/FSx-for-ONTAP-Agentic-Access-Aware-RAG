import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface BedrockAgentCoreMemoryConstructProps {
  readonly tableName?: string;
  readonly billingMode?: dynamodb.BillingMode;
  readonly removalPolicy?: cdk.RemovalPolicy;
  readonly enabled?: boolean;
}

export class BedrockAgentCoreMemoryConstruct extends Construct {
  public readonly memoryTable: dynamodb.Table;
  public readonly memoryResourceArn: string;
  public readonly memoryResourceId: string;

  constructor(scope: Construct, id: string, props: BedrockAgentCoreMemoryConstructProps = {}) {
    super(scope, id);

    // Create DynamoDB table for agent memory
    this.memoryTable = new dynamodb.Table(this, 'MemoryTable', {
      tableName: props.tableName,
      partitionKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: props.billingMode || dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.removalPolicy || cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Add GSI for querying by user
    this.memoryTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // Set resource properties
    this.memoryResourceArn = this.memoryTable.tableArn;
    this.memoryResourceId = this.memoryTable.tableName;
  }
}
