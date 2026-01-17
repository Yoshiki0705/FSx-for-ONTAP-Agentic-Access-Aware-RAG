/**
 * Bedrock Agent Core Policy Construct単体テスト
 */

import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BedrockAgentCorePolicyConstruct } from '../../../lib/modules/ai/constructs/bedrock-agent-core-policy-construct';

describe('BedrockAgentCorePolicyConstruct', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  const defaultProps = {
    enabled: true,
    projectName: 'test-project',
    environment: 'test',
    naturalLanguagePolicyConfig: {
      enabled: true,
    },
    cedarIntegrationConfig: {
      enabled: true,
    },
    policyManagementConfig: {
      enabled: true,
    },
  };

  describe('Construct作成', () => {
    test('デフォルト設定でConstructが作成される', () => {
      // Act
      new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', defaultProps);

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::S3::Bucket', 1);
      template.resourceCountIs('AWS::DynamoDB::Table', 2);
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });

    test('無効化された場合はダミーリソースが作成される', () => {
      // Act
      new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', {
        ...defaultProps,
        enabled: false,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::S3::Bucket', 1);
      template.resourceCountIs('AWS::DynamoDB::Table', 1);
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });
  });

  describe('S3バケット設定', () => {
    test('ポリシーバケットが正しく設定される', () => {
      // Act
      new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', defaultProps);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: {
          Status: 'Enabled',
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    test('バケット暗号化が有効化される', () => {
      // Act
      new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', defaultProps);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: Match.arrayWith([
            Match.objectLike({
              ServerSideEncryptionByDefault: Match.objectLike({
                SSEAlgorithm: Match.anyValue(),
              }),
            }),
          ]),
        },
      });
    });
  });

  describe('DynamoDBテーブル設定', () => {
    test('ポリシーメタデータテーブルが正しく設定される', () => {
      // Act
      new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', defaultProps);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          {
            AttributeName: 'policyId',
            KeyType: 'HASH',
          },
          {
            AttributeName: 'version',
            KeyType: 'RANGE',
          },
        ],
      });
    });

    test('監査ログテーブルが正しく設定される', () => {
      // Act
      new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', defaultProps);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          {
            AttributeName: 'logId',
            KeyType: 'HASH',
          },
          {
            AttributeName: 'timestamp',
            KeyType: 'RANGE',
          },
        ],
      });
    });

    test('DynamoDBテーブルが暗号化される', () => {
      // Act
      new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', defaultProps);

      // Assert
      const template = Template.fromStack(stack);
      template.allResourcesProperties('AWS::DynamoDB::Table', {
        SSESpecification: Match.objectLike({
          SSEEnabled: true,
        }),
      });
    });
  });

  describe('CloudWatch Logs設定', () => {
    test('ロググループが作成される', () => {
      // Act
      new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', defaultProps);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 30,
      });
    });
  });

  describe('設定オプション', () => {
    test('自然言語ポリシーが有効化される', () => {
      // Act
      const construct = new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', {
        ...defaultProps,
        naturalLanguagePolicyConfig: {
          enabled: true,
          autoConversion: true,
          useTemplates: true,
        },
      });

      // Assert
      expect(construct).toBeDefined();
      expect(construct.policyBucket).toBeDefined();
    });

    test('Cedar統合が有効化される', () => {
      // Act
      const construct = new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', {
        ...defaultProps,
        cedarIntegrationConfig: {
          enabled: true,
          formalVerification: true,
          conflictDetection: true,
        },
      });

      // Assert
      expect(construct).toBeDefined();
      expect(construct.policyTable).toBeDefined();
    });

    test('ポリシー管理が有効化される', () => {
      // Act
      const construct = new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', {
        ...defaultProps,
        policyManagementConfig: {
          enabled: true,
          versionControl: true,
          auditLogging: true,
          approvalWorkflow: true,
        },
      });

      // Assert
      expect(construct).toBeDefined();
      expect(construct.auditLogTable).toBeDefined();
    });

    test('カスタム保持期間が設定される', () => {
      // Act
      const construct = new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', {
        ...defaultProps,
        policyRetentionDays: 180,
      });

      // Assert
      expect(construct).toBeDefined();
    });
  });

  describe('タグ設定', () => {
    test('カスタムタグが設定される', () => {
      // Act
      new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', {
        ...defaultProps,
        tags: {
          Environment: 'test',
          Project: 'bedrock-agent-core',
          Component: 'policy',
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        Tags: Match.arrayWith([
          { Key: 'Environment', Value: 'test' },
          { Key: 'Project', Value: 'bedrock-agent-core' },
          { Key: 'Component', Value: 'policy' },
        ]),
      });
    });
  });

  describe('パブリックプロパティ', () => {
    test('全てのパブリックプロパティが公開される', () => {
      // Act
      const construct = new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', defaultProps);

      // Assert
      expect(construct.policyBucket).toBeDefined();
      expect(construct.policyTable).toBeDefined();
      expect(construct.auditLogTable).toBeDefined();
      expect(construct.logGroup).toBeDefined();
    });
  });

  describe('権限管理', () => {
    test('grantPolicyBucketAccessが動作する', () => {
      // Arrange
      const { Role, ServicePrincipal } = require('aws-cdk-lib/aws-iam');
      const role = new Role(stack, 'TestRole', {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      });

      const construct = new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', defaultProps);

      // Act
      construct.grantPolicyBucketAccess(role);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    test('grantPolicyTableAccessが動作する', () => {
      // Arrange
      const { Role, ServicePrincipal } = require('aws-cdk-lib/aws-iam');
      const role = new Role(stack, 'TestRole', {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      });

      const construct = new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', defaultProps);

      // Act
      construct.grantPolicyTableAccess(role);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    test('grantAuditLogTableAccessが動作する', () => {
      // Arrange
      const { Role, ServicePrincipal } = require('aws-cdk-lib/aws-iam');
      const role = new Role(stack, 'TestRole', {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      });

      const construct = new BedrockAgentCorePolicyConstruct(stack, 'TestPolicyConstruct', defaultProps);

      // Act
      construct.grantAuditLogTableAccess(role);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });
});
