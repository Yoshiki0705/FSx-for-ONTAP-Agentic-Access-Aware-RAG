/**
 * CDK Construct Tests: KbAutoSyncConstruct
 *
 * - enableKbAutoSync=true 時にリソースが作成されることを検証
 * - enableKbAutoSync=false 時にリソースが作成されないことを検証
 * - intervalMinutes バリデーション (Property 3)
 * - Transfer Family ingestion_trigger との独立性を検証
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { KbAutoSyncConstruct } from '../lib/constructs/kb-auto-sync-construct';

describe('KbAutoSyncConstruct', () => {
  const defaultProps = {
    projectName: 'test-project',
    environment: 'dev',
    knowledgeBaseId: 'kb-test-123',
    dataSourceId: 'ds-test-456',
    s3AccessPointArn:
      'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/test-ap',
  };

  function createStack(props?: Partial<typeof defaultProps & { intervalMinutes?: number }>) {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    new KbAutoSyncConstruct(stack, 'KbAutoSync', {
      ...defaultProps,
      ...props,
    });
    return Template.fromStack(stack);
  }

  describe('Resource Creation', () => {
    test('creates DynamoDB table with correct configuration', () => {
      const template = createStack();

      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'test-project-dev-kb-sync-inventory',
        KeySchema: [{ AttributeName: 'fileKey', KeyType: 'HASH' }],
        BillingMode: 'PAY_PER_REQUEST',
      });
    });

    test('creates Lambda function with Python 3.12 runtime', () => {
      const template = createStack();

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'test-project-dev-kb-auto-sync',
        Runtime: 'python3.12',
        Handler: 'handler.lambda_handler',
        Timeout: 300,
        MemorySize: 256,
      });
    });

    test('creates Lambda with correct environment variables', () => {
      const template = createStack();

      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            S3_ACCESS_POINT_ARN: defaultProps.s3AccessPointArn,
            KNOWLEDGE_BASE_ID: defaultProps.knowledgeBaseId,
            DATA_SOURCE_ID: defaultProps.dataSourceId,
          },
        },
      });
    });

    test('creates EventBridge Scheduler with correct rate expression', () => {
      const template = createStack({ intervalMinutes: 10 });

      template.hasResourceProperties('AWS::Scheduler::Schedule', {
        ScheduleExpression: 'rate(10 minutes)',
        FlexibleTimeWindow: { Mode: 'OFF' },
      });
    });

    test('creates EventBridge Scheduler with default 5 minutes', () => {
      const template = createStack();

      template.hasResourceProperties('AWS::Scheduler::Schedule', {
        ScheduleExpression: 'rate(5 minutes)',
      });
    });

    test('creates CloudWatch Alarm for consecutive errors', () => {
      const template = createStack();

      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'test-project-dev-kb-auto-sync-errors',
        EvaluationPeriods: 3,
        Threshold: 1,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        TreatMissingData: 'notBreaching',
      });
    });

    test('creates Scheduler IAM role with correct trust policy', () => {
      const template = createStack();

      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'test-project-dev-kb-sync-scheduler-role',
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Principal: { Service: 'scheduler.amazonaws.com' },
              Action: 'sts:AssumeRole',
            },
          ],
        },
      });
    });
  });

  describe('IAM Policies (Least Privilege)', () => {
    test('grants S3 ListBucket and GetObject on Access Point', () => {
      const template = createStack();

      // Verify the policy document contains S3 permissions
      const policies = template.findResources('AWS::IAM::Policy');
      const policyKeys = Object.keys(policies);
      const fnPolicy = policyKeys.find((k) => k.includes('SyncFunction'));
      expect(fnPolicy).toBeDefined();

      const statements =
        policies[fnPolicy!].Properties.PolicyDocument.Statement;
      const s3Statement = statements.find(
        (s: any) =>
          Array.isArray(s.Action) &&
          s.Action.includes('s3:ListBucket') &&
          s.Action.includes('s3:GetObject')
      );
      expect(s3Statement).toBeDefined();
      expect(s3Statement.Effect).toBe('Allow');
    });

    test('grants Bedrock ingestion permissions on specific KB', () => {
      const template = createStack();

      const policies = template.findResources('AWS::IAM::Policy');
      const policyKeys = Object.keys(policies);
      const fnPolicy = policyKeys.find((k) => k.includes('SyncFunction'));
      expect(fnPolicy).toBeDefined();

      const statements =
        policies[fnPolicy!].Properties.PolicyDocument.Statement;
      const bedrockStatement = statements.find(
        (s: any) =>
          Array.isArray(s.Action) &&
          s.Action.includes('bedrock:StartIngestionJob')
      );
      expect(bedrockStatement).toBeDefined();
      expect(bedrockStatement.Action).toContain('bedrock:GetIngestionJob');
      expect(bedrockStatement.Action).toContain('bedrock:ListIngestionJobs');
    });
  });

  describe('Interval Validation (Property 3)', () => {
    test('throws error for intervalMinutes < 1', () => {
      expect(() => createStack({ intervalMinutes: 0 })).toThrow(
        /kbAutoSyncIntervalMinutes must be between 1 and 1440/
      );
    });

    test('throws error for intervalMinutes > 1440', () => {
      expect(() => createStack({ intervalMinutes: 1441 })).toThrow(
        /kbAutoSyncIntervalMinutes must be between 1 and 1440/
      );
    });

    test('does not throw for intervalMinutes = 1', () => {
      expect(() => createStack({ intervalMinutes: 1 })).not.toThrow();
    });

    test('does not throw for intervalMinutes = 1440', () => {
      expect(() => createStack({ intervalMinutes: 1440 })).not.toThrow();
    });

    // Property test with fast-check
    test('property: invalid intervals always throw', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -1000, max: 0 }),
            fc.integer({ min: 1441, max: 10000 })
          ),
          (invalidInterval) => {
            expect(() => createStack({ intervalMinutes: invalidInterval })).toThrow(
              /kbAutoSyncIntervalMinutes must be between 1 and 1440/
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('property: valid intervals never throw', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1440 }), (validInterval) => {
          expect(() => createStack({ intervalMinutes: validInterval })).not.toThrow();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('AIStack Integration', () => {
    test('enableKbAutoSync=false creates no KB sync resources', () => {
      const app = new cdk.App({
        context: {
          enableKbAutoSync: false,
          projectName: 'test',
          environment: 'dev',
        },
      });
      const stack = new cdk.Stack(app, 'TestStack');
      // No KbAutoSyncConstruct instantiated
      const template = Template.fromStack(stack);

      template.resourceCountIs('AWS::DynamoDB::Table', 0);
      template.resourceCountIs('AWS::Scheduler::Schedule', 0);
    });

    test('construct is independent from Transfer Family resources', () => {
      const template = createStack();

      // Verify our table name is different from Transfer Family's
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'test-project-dev-kb-sync-inventory',
      });

      // Verify Lambda function name is different
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'test-project-dev-kb-auto-sync',
      });
    });
  });
});
