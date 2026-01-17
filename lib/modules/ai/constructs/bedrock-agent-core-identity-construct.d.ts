import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
export interface BedrockAgentCoreIdentityConstructProps {
    readonly functionName?: string;
    readonly description?: string;
    readonly timeout?: cdk.Duration;
    readonly memorySize?: number;
    readonly environment?: {
        [key: string]: string;
    };
    readonly logRetention?: logs.RetentionDays;
}
export declare class BedrockAgentCoreIdentityConstruct extends Construct {
    readonly lambdaFunction: lambda.Function;
    readonly executionRole: iam.Role;
    readonly identityTable: dynamodb.Table;
    constructor(scope: Construct, id: string, props?: BedrockAgentCoreIdentityConstructProps);
}
