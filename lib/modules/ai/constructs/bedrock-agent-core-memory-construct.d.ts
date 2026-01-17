import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
export interface BedrockAgentCoreMemoryConstructProps {
    readonly tableName?: string;
    readonly billingMode?: dynamodb.BillingMode;
    readonly removalPolicy?: cdk.RemovalPolicy;
    readonly enabled?: boolean;
}
export declare class BedrockAgentCoreMemoryConstruct extends Construct {
    readonly memoryTable: dynamodb.Table;
    readonly memoryResourceArn: string;
    readonly memoryResourceId: string;
    constructor(scope: Construct, id: string, props?: BedrockAgentCoreMemoryConstructProps);
}
