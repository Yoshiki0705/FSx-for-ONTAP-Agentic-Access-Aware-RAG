import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface LambdaConfig {
  readonly runtime?: lambda.Runtime;
  readonly timeout?: cdk.Duration;
  readonly memorySize?: number;
  readonly environment?: { [key: string]: string };
}

export interface BedrockAgentCoreRuntimeConstructProps {
  readonly functionName?: string;
  readonly description?: string;
  readonly lambdaConfig?: LambdaConfig;
  readonly logRetention?: logs.RetentionDays;
}

export class BedrockAgentCoreRuntimeConstruct extends Construct {
  public readonly lambdaFunction: lambda.Function;
  public readonly executionRole: iam.Role;

  constructor(scope: Construct, id: string, props: BedrockAgentCoreRuntimeConstructProps = {}) {
    super(scope, id);

    // Create execution role
    this.executionRole = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Create Lambda function
    this.lambdaFunction = new lambda.Function(this, 'Function', {
      functionName: props.functionName,
      description: props.description || 'Bedrock Agent Core Runtime Function',
      runtime: props.lambdaConfig?.runtime || lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/agent-core-runtime'),
      timeout: props.lambdaConfig?.timeout || cdk.Duration.seconds(30),
      memorySize: props.lambdaConfig?.memorySize || 2048,
      environment: props.lambdaConfig?.environment,
      role: this.executionRole,
      logRetention: props.logRetention || logs.RetentionDays.ONE_WEEK,
    });
  }
}
