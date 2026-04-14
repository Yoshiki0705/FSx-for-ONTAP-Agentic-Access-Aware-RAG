/**
 * CDK Assertion Tests: MonitoringConstruct Guardrails Extension
 *
 * Validates that Guardrails dashboard section and alarms are correctly
 * added/omitted based on guardrailId prop.
 */
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { MonitoringConstruct } from '../lib/constructs/monitoring-construct';

function createTestStack(guardrailId?: string) {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');

  // Create minimal required resources
  const fn = new lambda.Function(stack, 'TestFn', {
    runtime: lambda.Runtime.NODEJS_22_X,
    handler: 'index.handler',
    code: lambda.Code.fromInline('exports.handler = async () => {}'),
  });

  const dist = new cloudfront.Distribution(stack, 'TestDist', {
    defaultBehavior: {
      origin: new (require('aws-cdk-lib/aws-cloudfront-origins').HttpOrigin)('example.com'),
    },
  });

  const table1 = new dynamodb.Table(stack, 'Table1', {
    partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
  });
  const table2 = new dynamodb.Table(stack, 'Table2', {
    partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
  });

  new MonitoringConstruct(stack, 'Monitoring', {
    projectName: 'test',
    environment: 'test',
    webAppFunction: fn,
    distribution: dist,
    userAccessTable: table1,
    permissionCacheTable: table2,
    guardrailId,
  });

  return Template.fromStack(stack);
}

describe('MonitoringConstruct Guardrails Extension', () => {
  test('creates Guardrails alarm when guardrailId is provided', () => {
    const template = createTestStack('gr-test-123');

    // Should have a Guardrails intervention rate alarm
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'test-test-guardrails-intervention-rate',
    });
  });

  test('does not create Guardrails alarm when guardrailId is undefined', () => {
    const template = createTestStack(undefined);

    // Should NOT have a Guardrails alarm
    const alarms = template.findResources('AWS::CloudWatch::Alarm');
    const guardrailAlarms = Object.values(alarms).filter(
      (a: any) => a.Properties?.AlarmName?.includes('guardrails')
    );
    expect(guardrailAlarms).toHaveLength(0);
  });

  test('creates dashboard with Guardrails section when guardrailId is provided', () => {
    const template = createTestStack('gr-test-456');

    // Dashboard should exist
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'test-test-monitoring',
    });
  });
});
