/**
 * Tests for FeedbackCollectorConstruct (#11) and AlertEscalationConstruct (#14, #15)
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { FeedbackCollectorConstruct } from '../lib/constructs/feedback-collector-construct';
import { AlertEscalationConstruct } from '../lib/constructs/alert-escalation-construct';

describe('FeedbackCollectorConstruct', () => {
  function createStack(props?: { ttlDays?: number }) {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    new FeedbackCollectorConstruct(stack, 'Feedback', {
      projectName: 'test',
      environment: 'dev',
      ...props,
    });
    return Template.fromStack(stack);
  }

  test('creates DynamoDB table with TTL', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'test-dev-rag-feedback',
      TimeToLiveSpecification: {
        AttributeName: 'ttlEpoch',
        Enabled: true,
      },
    });
  });

  test('creates date-rating GSI for aggregation', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: [
        {
          IndexName: 'date-rating-index',
          KeySchema: [
            { AttributeName: 'date', KeyType: 'HASH' },
            { AttributeName: 'rating', KeyType: 'RANGE' },
          ],
        },
        {
          IndexName: 'userId-timestamp-index',
          KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' },
            { AttributeName: 'timestamp', KeyType: 'RANGE' },
          ],
        },
      ],
    });
  });

  test('creates Lambda with correct function name', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-dev-feedback-collector',
      Runtime: 'python3.12',
    });
  });

  test('custom TTL is passed to Lambda', () => {
    const template = createStack({ ttlDays: 30 });
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          TTL_DAYS: '30',
        },
      },
    });
  });
});

describe('AlertEscalationConstruct', () => {
  function createStack(props?: Partial<{
    webhookUrl: string;
    guardrailBlockThreshold: number;
    fullContextRatioThreshold: number;
  }>) {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    new AlertEscalationConstruct(stack, 'Alerts', {
      projectName: 'test',
      environment: 'dev',
      ...props,
    });
    return Template.fromStack(stack);
  }

  test('creates SNS topic', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'test-dev-alert-escalation',
    });
  });

  test('creates Guardrail violation alarm (#14)', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'test-dev-guardrail-violations-high',
      Namespace: 'FSxNOps/Guardrails',
      MetricName: 'GuardrailDecision',
      Threshold: 5,
    });
  });

  test('creates cost anomaly alarm (#15)', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'test-dev-smart-routing-cost-anomaly',
      Namespace: 'SmartRouting',
      MetricName: 'RoutingCount',
    });
  });

  test('custom thresholds are applied', () => {
    const template = createStack({
      guardrailBlockThreshold: 10,
      fullContextRatioThreshold: 50,
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'test-dev-guardrail-violations-high',
      Threshold: 10,
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'test-dev-smart-routing-cost-anomaly',
      Threshold: 50,
    });
  });

  test('webhook Lambda is created when webhookUrl is provided', () => {
    const template = createStack({ webhookUrl: 'https://hooks.slack.com/test' });
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-dev-alert-webhook',
    });
  });

  test('no webhook Lambda when webhookUrl is not provided', () => {
    const template = createStack();
    const functions = template.findResources('AWS::Lambda::Function');
    const webhookFn = Object.keys(functions).find(k =>
      functions[k].Properties?.FunctionName === 'test-dev-alert-webhook'
    );
    expect(webhookFn).toBeUndefined();
  });
});
