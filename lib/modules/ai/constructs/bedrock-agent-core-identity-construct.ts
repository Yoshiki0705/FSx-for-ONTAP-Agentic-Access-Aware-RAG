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
  readonly environment?: { [key: string]: string };
  readonly logRetention?: logs.RetentionDays;
}

export class BedrockAgentCoreIdentityConstruct extends Construct {
  public readonly lambdaFunction: lambda.Function;
  public readonly executionRole: iam.Role;
  public readonly identityTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: BedrockAgentCoreIdentityConstructProps = {}) {
    super(scope, id);

    // Create identity table
    this.identityTable = new dynamodb.Table(this, 'IdentityTable', {
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create execution role
    this.executionRole = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant DynamoDB permissions
    this.identityTable.grantReadWriteData(this.executionRole);

    // Create Lambda function
    this.lambdaFunction = new lambda.Function(this, 'Function', {
      functionName: props.functionName,
      description: props.description || 'Bedrock Agent Core Identity Function',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Bedrock Agent Core Identity Function' })
          };
        };
      `),
      timeout: props.timeout || cdk.Duration.seconds(30),
      memorySize: props.memorySize || 128,
      environment: {
        ...props.environment,
        IDENTITY_TABLE_NAME: this.identityTable.tableName,
      },
      role: this.executionRole,
      logRetention: props.logRetention || logs.RetentionDays.ONE_WEEK,
    });
  }
}
