/**
 * Tests for ProvenanceLoggerConstruct (#7)
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ProvenanceLoggerConstruct } from '../lib/constructs/provenance-logger-construct';

describe('ProvenanceLoggerConstruct', () => {
  function createStack(props?: { ttlDays?: number }) {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    new ProvenanceLoggerConstruct(stack, 'Provenance', {
      projectName: 'test',
      environment: 'dev',
      ...props,
    });

    return Template.fromStack(stack);
  }

  test('creates DynamoDB table with correct schema', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'test-dev-rag-provenance',
      KeySchema: [
        { AttributeName: 'responseId', KeyType: 'HASH' },
        { AttributeName: 'timestamp', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      TimeToLiveSpecification: {
        AttributeName: 'ttlEpoch',
        Enabled: true,
      },
    });
  });

  test('creates GSI for userId queries', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: [
        {
          IndexName: 'userId-timestamp-index',
          KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' },
            { AttributeName: 'timestamp', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    });
  });

  test('creates Lambda function with correct configuration', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-dev-provenance-logger',
      Runtime: 'python3.12',
      Handler: 'handler.handler',
      Timeout: 10,
      MemorySize: 128,
    });
  });

  test('Lambda has correct environment variables', () => {
    const template = createStack({ ttlDays: 30 });
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          TTL_DAYS: '30',
        },
      },
    });
  });

  test('default TTL is 90 days', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          TTL_DAYS: '90',
        },
      },
    });
  });
});
