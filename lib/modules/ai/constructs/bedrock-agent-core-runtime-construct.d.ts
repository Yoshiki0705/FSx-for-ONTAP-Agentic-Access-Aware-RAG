import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
export interface LambdaConfig {
    readonly runtime?: lambda.Runtime;
    readonly timeout?: cdk.Duration;
    readonly memorySize?: number;
    readonly environment?: {
        [key: string]: string;
    };
}
export interface BedrockAgentCoreRuntimeConstructProps {
    readonly functionName?: string;
    readonly description?: string;
    readonly lambdaConfig?: LambdaConfig;
    readonly logRetention?: logs.RetentionDays;
}
export declare class BedrockAgentCoreRuntimeConstruct extends Construct {
    readonly lambdaFunction: lambda.Function;
    readonly executionRole: iam.Role;
    constructor(scope: Construct, id: string, props?: BedrockAgentCoreRuntimeConstructProps);
}
