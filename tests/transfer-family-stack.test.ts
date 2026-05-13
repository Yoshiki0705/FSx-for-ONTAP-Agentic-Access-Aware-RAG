/**
 * CDK Assertion Tests for DemoTransferFamilyStack
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DemoTransferFamilyStack, DemoTransferFamilyStackProps } from '../lib/stacks/demo/demo-transfer-family-stack';

function createStack(propsOverride?: Partial<DemoTransferFamilyStackProps>): Template {
  const app = new cdk.App();
  const defaultProps: DemoTransferFamilyStackProps = {
    projectName: 'test-project',
    environment: 'test',
    s3AccessPointArn: 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/test-ap',
    s3AccessPointAlias: 'test-ap-ext-s3alias',
    fileSystemId: 'fs-12345',
    svmId: 'svm-12345',
    volumeId: 'fsvol-12345',
    knowledgeBaseId: 'kb-test-12345',
    dataSourceId: 'ds-test-12345',
    env: { account: '123456789012', region: 'ap-northeast-1' },
    ...propsOverride,
  };

  const stack = new DemoTransferFamilyStack(app, 'TestTransferFamilyStack', defaultProps);
  return Template.fromStack(stack);
}

describe('DemoTransferFamilyStack', () => {
  describe('Transfer Family Server', () => {
    test('creates Transfer Family server with correct security policy', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::Transfer::Server', {
        SecurityPolicyName: 'TransferSecurityPolicy-2024-01',
        Protocols: ['SFTP'],
        IdentityProviderType: 'SERVICE_MANAGED',
      });
    });

    test('creates server with PUBLIC endpoint by default', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::Transfer::Server', {
        EndpointType: 'PUBLIC',
      });
    });

    test('creates server with structured logging enabled', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::Transfer::Server', {
        LoggingRole: Match.anyValue(),
        StructuredLogDestinations: Match.anyValue(),
      });
    });
  });

  describe('SFTP Users', () => {
    test('creates default demo user when no users configured', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::Transfer::User', {
        UserName: 'demo-user',
        HomeDirectoryType: 'LOGICAL',
      });
    });

    test('creates configured users with correct home directory', () => {
      const template = createStack({
        transferFamilyUsers: [
          {
            userName: 'partner-a',
            sshPublicKey: 'ssh-rsa AAAA... partner-a@test',
          },
        ],
      });
      template.hasResourceProperties('AWS::Transfer::User', {
        UserName: 'partner-a',
        HomeDirectoryType: 'LOGICAL',
      });
    });

    test('SFTP user IAM policy is scoped to home directory prefix', () => {
      const template = createStack({
        transferFamilyUsers: [
          {
            userName: 'partner-a',
            sshPublicKey: 'ssh-rsa AAAA... partner-a@test',
          },
        ],
      });

      // Verify IAM policy restricts to user's home directory
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Principal: { Service: 'transfer.amazonaws.com' },
            }),
          ]),
        }),
        Policies: Match.arrayWith([
          Match.objectLike({
            PolicyName: 's3Access',
            PolicyDocument: Match.objectLike({
              Statement: Match.arrayWith([
                Match.objectLike({
                  Action: ['s3:PutObject', 's3:GetObject', 's3:GetObjectVersion', 's3:DeleteObject'],
                  Resource: Match.stringLikeRegexp('.*partner-a.*'),
                }),
              ]),
            }),
          }),
        ]),
      });
    });

    test('creates Secrets Manager secret for demo user SSH key', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        Description: Match.stringLikeRegexp('Demo SFTP user SSH key'),
      });
    });
  });

  describe('DynamoDB Tables', () => {
    test('creates scan state table with TTL', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'test-project-test-transfer-scan-state',
        KeySchema: [{ AttributeName: 'scanId', KeyType: 'HASH' }],
        BillingMode: 'PAY_PER_REQUEST',
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true,
        },
      });
    });

    test('creates file inventory table', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'test-project-test-transfer-file-inventory',
        KeySchema: [{ AttributeName: 'fileKey', KeyType: 'HASH' }],
        BillingMode: 'PAY_PER_REQUEST',
      });
    });

    test('creates permission mapping table', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'test-project-test-transfer-permission-mapping',
        KeySchema: [{ AttributeName: 'userName', KeyType: 'HASH' }],
        BillingMode: 'PAY_PER_REQUEST',
      });
    });

    test('scan state table has GSI on scanTimestamp', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'test-project-test-transfer-scan-state',
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'scanTimestamp-index',
          }),
        ]),
      });
    });
  });

  describe('Lambda Functions', () => {
    test('creates Ingestion Trigger Lambda with correct configuration', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'test-project-test-ingestion-trigger',
        Runtime: 'python3.12',
        Timeout: 300,
        MemorySize: 256,
      });
    });

    test('creates Metadata Generator Lambda with correct configuration', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'test-project-test-metadata-generator',
        Runtime: 'python3.12',
        Timeout: 60,
        MemorySize: 128,
      });
    });

    test('Ingestion Trigger Lambda has correct environment variables', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'test-project-test-ingestion-trigger',
        Environment: {
          Variables: Match.objectLike({
            KNOWLEDGE_BASE_ID: 'kb-test-12345',
            DATA_SOURCE_ID: 'ds-test-12345',
            TRIGGER_MODE: 'polling',
          }),
        },
      });
    });
  });

  describe('EventBridge', () => {
    test('creates EventBridge Scheduler in polling mode (default)', () => {
      const template = createStack();
      template.hasResourceProperties('AWS::Scheduler::Schedule', {
        ScheduleExpression: 'rate(5 minutes)',
        State: 'ENABLED',
      });
    });

    test('creates EventBridge Rule in cloudtrail mode', () => {
      const template = createStack({ transferFamilyTriggerMode: 'cloudtrail' });
      template.hasResourceProperties('AWS::Events::Rule', {
        EventPattern: Match.objectLike({
          source: ['aws.s3'],
          'detail-type': ['AWS API Call via CloudTrail'],
        }),
      });
    });

    test('does not create Scheduler in cloudtrail mode', () => {
      const template = createStack({ transferFamilyTriggerMode: 'cloudtrail' });
      template.resourceCountIs('AWS::Scheduler::Schedule', 0);
    });

    test('does not create EventBridge Rule in polling mode', () => {
      const template = createStack({ transferFamilyTriggerMode: 'polling' });
      template.resourceCountIs('AWS::Events::Rule', 0);
    });
  });

  describe('Monitoring', () => {
    test('creates CloudWatch alarms when monitoring enabled', () => {
      const template = createStack({ enableMonitoring: true, snsTopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic' });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'test-project-test-transfer-trigger-errors',
        EvaluationPeriods: 3,
      });
    });

    test('creates CloudWatch dashboard when monitoring enabled', () => {
      const template = createStack({ enableMonitoring: true });
      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardName: 'test-project-test-transfer-family',
      });
    });

    test('does not create monitoring resources when disabled', () => {
      const template = createStack({ enableMonitoring: false });
      template.resourceCountIs('AWS::CloudWatch::Alarm', 0);
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 0);
    });
  });

  describe('CloudFormation Outputs', () => {
    test('exports Transfer Server ID', () => {
      const template = createStack();
      template.hasOutput('TransferServerId', {
        Export: { Name: 'test-project-test-TransferServerId' },
      });
    });

    test('exports Transfer Server Endpoint', () => {
      const template = createStack();
      template.hasOutput('TransferServerEndpoint', {
        Export: { Name: 'test-project-test-TransferServerEndpoint' },
      });
    });

    test('exports Lambda ARNs', () => {
      const template = createStack();
      template.hasOutput('IngestionTriggerLambdaArn', {});
      template.hasOutput('MetadataGeneratorLambdaArn', {});
    });

    test('exports DynamoDB table names', () => {
      const template = createStack();
      template.hasOutput('ScanStateTableName', {});
      template.hasOutput('FileInventoryTableName', {});
      template.hasOutput('PermissionMappingTableName', {});
    });
  });
});
