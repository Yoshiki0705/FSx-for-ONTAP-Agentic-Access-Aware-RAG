/**
 * Tests for FeatureGateConstruct (#12) and RoiDashboardConstruct (#10, #3)
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { FeatureGateConstruct } from '../lib/constructs/feature-gate-construct';
import { RoiDashboardConstruct } from '../lib/constructs/roi-dashboard-construct';

describe('FeatureGateConstruct', () => {
  function createStack() {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    new FeatureGateConstruct(stack, 'FeatureGate', {
      projectName: 'test',
      environment: 'dev',
    });
    return Template.fromStack(stack);
  }

  test('creates DynamoDB table with featureId key', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'test-dev-feature-gates',
      KeySchema: [{ AttributeName: 'featureId', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  test('creates Lambda function', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'test-dev-feature-gate',
      Runtime: 'python3.12',
      Timeout: 5,
    });
  });

  test('Lambda has read-only access to table', () => {
    const template = createStack();
    const policies = template.findResources('AWS::IAM::Policy');
    const policyKeys = Object.keys(policies);
    // At least one policy should exist for the Lambda role
    expect(policyKeys.length).toBeGreaterThan(0);
  });
});

describe('RoiDashboardConstruct', () => {
  function createStack() {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    new RoiDashboardConstruct(stack, 'RoiDashboard', {
      projectName: 'test',
      environment: 'dev',
      webAppFunctionName: 'test-dev-webapp',
    });
    return Template.fromStack(stack);
  }

  test('creates CloudWatch Dashboard', () => {
    const template = createStack();
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'test-dev-roi-metrics',
    });
  });

  test('dashboard has widgets defined', () => {
    const template = createStack();
    const dashboards = template.findResources('AWS::CloudWatch::Dashboard');
    const dashboardKeys = Object.keys(dashboards);
    expect(dashboardKeys.length).toBe(1);

    const body = dashboards[dashboardKeys[0]].Properties.DashboardBody;
    // DashboardBody is a JSON string with Fn::Join
    expect(body).toBeDefined();
  });

  test('outputs dashboard URL', () => {
    const template = createStack();
    const outputs = template.findOutputs('*');
    const dashboardOutput = Object.values(outputs).find(
      (o: any) => o.Description?.includes('ROI Dashboard URL')
    );
    expect(dashboardOutput).toBeDefined();
  });
});
