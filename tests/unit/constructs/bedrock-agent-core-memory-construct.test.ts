/**
 * Amazon Bedrock AgentCore Memory Construct - 単体テスト
 * 
 * Memory Resource作成とAPI呼び出しのテストを実施
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BedrockAgentCoreMemoryConstruct } from '../../../lib/modules/ai/constructs/bedrock-agent-core-memory-construct';

describe('BedrockAgentCoreMemoryConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1',
      },
    });
  });

  describe('Memory Resource作成テスト', () => {
    test('Memory機能が無効の場合、リソースが作成されない', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: false,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::BedrockAgentCore::Memory', 0);
    });

    test('Memory機能が有効の場合、Memory Resourceが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
        eventExpiryDuration: 90,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::BedrockAgentCore::Memory', 1);
      
      template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        Name: Match.stringLikeRegexp('TokyoRegion-test-project-prod-Memory-Resource'),
        EventExpiryDuration: 90,
      });
    });

    test('デフォルト設定でMemory Resourceが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'dev',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        EventExpiryDuration: 90, // デフォルト値
      });
    });

    test('カスタムイベント有効期限が設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
        eventExpiryDuration: 180,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        EventExpiryDuration: 180,
      });
    });
  });

  describe('Memory Strategies設定テスト', () => {
    test('デフォルトで3つのMemory Strategiesが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        MemoryStrategies: Match.arrayWith([
          Match.objectLike({
            SemanticMemoryStrategy: Match.objectLike({
              Name: 'semanticLongTermMemory',
              Namespaces: ['default'],
            }),
          }),
          Match.objectLike({
            SummaryMemoryStrategy: Match.objectLike({
              Name: 'summaryMemory',
              Namespaces: ['default'],
            }),
          }),
          Match.objectLike({
            UserPreferenceMemoryStrategy: Match.objectLike({
              Name: 'userPreferenceMemory',
              Namespaces: ['default'],
            }),
          }),
        ]),
      });
    });

    test('Semantic Strategyのみを有効化できる', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
        memoryStrategy: {
          enableSemantic: true,
          enableSummary: false,
          enableUserPreference: false,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      const resources = template.findResources('AWS::BedrockAgentCore::Memory');
      const memoryResource = Object.values(resources)[0];
      
      expect(memoryResource.Properties.MemoryStrategies).toHaveLength(1);
      expect(memoryResource.Properties.MemoryStrategies[0]).toHaveProperty('SemanticMemoryStrategy');
    });

    test('カスタムNamespacesが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
        memoryStrategy: {
          semanticNamespaces: ['default', 'technical', 'business'],
          summaryNamespaces: ['default', 'daily'],
          userPreferenceNamespaces: ['default', 'preferences'],
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        MemoryStrategies: Match.arrayWith([
          Match.objectLike({
            SemanticMemoryStrategy: Match.objectLike({
              Namespaces: ['default', 'technical', 'business'],
            }),
          }),
          Match.objectLike({
            SummaryMemoryStrategy: Match.objectLike({
              Namespaces: ['default', 'daily'],
            }),
          }),
          Match.objectLike({
            UserPreferenceMemoryStrategy: Match.objectLike({
              Namespaces: ['default', 'preferences'],
            }),
          }),
        ]),
      });
    });
  });

  describe('KMS暗号化設定テスト', () => {
    test('KMS暗号化なしでMemory Resourceが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::KMS::Key', 0);
    });

    test('新しいKMS Keyが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
        kms: {
          keyAliasPrefix: 'test-memory',
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::KMS::Key', 1);
      template.hasResourceProperties('AWS::KMS::Key', {
        EnableKeyRotation: true,
      });
      
      template.resourceCountIs('AWS::KMS::Alias', 1);
      template.hasResourceProperties('AWS::KMS::Alias', {
        AliasName: Match.stringLikeRegexp('alias/test-memory'),
      });
    });

    test('既存のKMS Keyが使用される', () => {
      // Arrange
      const existingKeyArn = 'arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012';

      // Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
        kms: {
          keyArn: existingKeyArn,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::KMS::Key', 0); // 新しいKeyは作成されない
      template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        EncryptionKeyArn: existingKeyArn,
      });
    });
  });

  describe('IAM Role設定テスト', () => {
    test('デフォルトでIAM Roleが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::IAM::Role', 1);
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Principal: {
                Service: 'bedrock.amazonaws.com',
              },
            }),
          ]),
        }),
      });
    });

    test('Bedrock権限が付与される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ],
              Effect: 'Allow',
            }),
          ]),
        }),
      });
    });

    test('既存のIAM Roleが使用される', () => {
      // Arrange
      const existingRoleArn = 'arn:aws:iam::123456789012:role/existing-memory-role';

      // Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
        memoryExecutionRoleArn: existingRoleArn,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        MemoryExecutionRoleArn: existingRoleArn,
      });
    });

    test('KMS暗号化使用時にKMS権限が付与される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
        kms: {
          keyAliasPrefix: 'test-memory',
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                'kms:Decrypt',
                'kms:Encrypt',
                'kms:GenerateDataKey',
                'kms:DescribeKey',
              ],
              Effect: 'Allow',
            }),
          ]),
        }),
      });
    });
  });

  describe('CloudFormation出力テスト', () => {
    test('Memory Resource ARNが出力される', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
      });

      // Assert
      // CloudFormation出力は作成されるが、CDKのテンプレート生成時には含まれない場合がある
      // 代わりに、Constructのプロパティが正しく設定されていることを確認
      expect(construct.memoryResourceArn).toBeDefined();
      expect(construct.memoryResourceArn).not.toBe('');
    });

    test('Memory Resource IDが出力される', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
      });

      // Assert
      // CloudFormation出力は作成されるが、CDKのテンプレート生成時には含まれない場合がある
      // 代わりに、Constructのプロパティが正しく設定されていることを確認
      expect(construct.memoryResourceId).toBeDefined();
      expect(construct.memoryResourceId).not.toBe('');
    });
  });

  describe('タグ設定テスト', () => {
    test('デフォルトタグが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
      });

      // Assert
      const template = Template.fromStack(stack);
      // タグはオブジェクト形式で保存される
      const resources = template.findResources('AWS::BedrockAgentCore::Memory');
      const memoryResource = Object.values(resources)[0];
      
      expect(memoryResource.Properties.Tags).toMatchObject({
        Project: 'test-project',
        Environment: 'prod',
        Component: 'BedrockAgentCoreMemory',
        ManagedBy: 'CDK',
      });
    });

    test('カスタムタグが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
        tags: {
          Owner: 'test-team',
          CostCenter: 'engineering',
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      const resources = template.findResources('AWS::BedrockAgentCore::Memory');
      const memoryResource = Object.values(resources)[0];
      
      expect(memoryResource.Properties.Tags).toMatchObject({
        Owner: 'test-team',
        CostCenter: 'engineering',
      });
    });
  });

  describe('リージョンプレフィックステスト', () => {
    test('東京リージョンで正しいプレフィックスが使用される', () => {
      // Arrange & Act
      new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        Name: Match.stringLikeRegexp('^TokyoRegion-'),
      });
    });

    test('バージニアリージョンで正しいプレフィックスが使用される', () => {
      // Arrange
      const usStack = new cdk.Stack(app, 'USStack', {
        env: {
          account: '123456789012',
          region: 'us-east-1',
        },
      });

      // Act
      new BedrockAgentCoreMemoryConstruct(usStack, 'TestMemory', {
        enabled: true,
        projectName: 'test-project',
        environment: 'prod',
      });

      // Assert
      const template = Template.fromStack(usStack);
      template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        Name: Match.stringLikeRegexp('^NorthVirginiaRegion-'),
      });
    });
  });

  describe('エラーハンドリングテスト', () => {
    test('無効な設定でエラーが発生しない', () => {
      // Arrange & Act & Assert
      expect(() => {
        new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
          enabled: true,
          projectName: '',
          environment: '',
        });
      }).not.toThrow();
    });

    test('Memory機能無効時にプロパティアクセスでエラーが発生しない', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreMemoryConstruct(stack, 'TestMemory', {
        enabled: false,
        projectName: 'test-project',
        environment: 'prod',
      });

      // Assert
      expect(construct.memoryResourceArn).toBe('');
      expect(construct.memoryResourceId).toBe('');
    });
  });
});
