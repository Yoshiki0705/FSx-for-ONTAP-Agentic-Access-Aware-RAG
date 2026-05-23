/**
 * Tests for CacheInvalidatorConstruct (#13)
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Template } from 'aws-cdk-lib/assertions';
import { CacheInvalidatorConstruct } from '../lib/constructs/cache-invalidator-construct';

describe('CacheInvalidatorConstruct', () => {
  function createStack() {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    const userAccessTable = new dynamodb.Table(stack, 'UserAccess', {
      tableName: 'test-user-access',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const cacheTable = new dynamodb.Table(stack, 'PermCache', {
      tableName: 'test-perm-cache',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new CacheInvalidatorConstruct(stack, 'CacheInvalidator', {
      projectName: 'test',
      environment: 'dev',
      userAccessTable,
      permissionCacheTable: cacheTable,
    });

    return Template.fromStack(stack);
  }

  test('creates Lambda function with correct configuration', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-dev-cache-invalidator',
      Runtime: 'python3.12',
      Handler: 'handler.handler',
      Timeout: 30,
      MemorySize: 128,
    });
  });

  test('Lambda has PERMISSION_CACHE_TABLE environment variable', () => {
    const template = createStack();
    // The table name is a Ref (CloudFormation reference), not a literal string
    const functions = template.findResources('AWS::Lambda::Function');
    const invalidatorFn = Object.values(functions).find(
      (f: any) => f.Properties?.FunctionName === 'test-dev-cache-invalidator'
    );
    expect(invalidatorFn).toBeDefined();
    expect(
      invalidatorFn!.Properties.Environment.Variables.PERMISSION_CACHE_TABLE
    ).toBeDefined();
  });

  test('creates DynamoDB event source mapping', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BatchSize: 10,
      MaximumBatchingWindowInSeconds: 5,
      MaximumRetryAttempts: 3,
      StartingPosition: 'TRIM_HORIZON',
    });
  });
});
