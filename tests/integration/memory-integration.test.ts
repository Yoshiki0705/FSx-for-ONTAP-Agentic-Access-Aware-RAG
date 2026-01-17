/**
 * Amazon Bedrock AgentCore Memory - 統合テスト
 * 
 * DataStackへの統合テストを実施
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BedrockAgentCoreMemoryConstruct } from '../../lib/modules/ai/constructs/bedrock-agent-core-memory-construct';

describe('Memory Integration Tests', () => {
  describe('DataStackへの統合テスト', () => {
    test('Memory ConstructがDataStackに正しく統合される', () => {
      // Arrange
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'DataStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
      });

      // Act
      const memoryConstruct = new BedrockAgentCoreMemoryConstruct(stack, 'Memory', {
        enabled: true,
        projectName: 'permission-aware-rag',
        environment: 'prod',
        eventExpiryDuration: 90,
      });

      // Assert
      expect(memoryConstruct).toBeDefined();
      expect(memoryConstruct.memoryResourceArn).toBeDefined();
      expect(memoryConstruct.memoryResourceId).toBeDefined();

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::BedrockAgentCore::Memory', 1);
    });

    test('設定が正しく読み込まれる', () => {
      // Arrange
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'DataStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
      });

      // Act
      new BedrockAgentCoreMemoryConstruct(stack, 'Memory', {
        enabled: true,
        projectName: 'permission-aware-rag',
        environment: 'prod',
        eventExpiryDuration: 180,
        memoryStrategy: {
          enableSemantic: true,
          enableSummary: true,
          enableUserPreference: true,
          semanticNamespaces: ['default', 'technical'],
          summaryNamespaces: ['default', 'daily'],
          userPreferenceNamespaces: ['default', 'preferences'],
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        EventExpiryDuration: 180,
        MemoryStrategies: Match.arrayWith([
          Match.objectLike({
            SemanticMemoryStrategy: Match.objectLike({
              Namespaces: ['default', 'technical'],
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

    test('他のConstructと競合しない', () => {
      // Arrange
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'DataStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
      });

      // Act - 複数のConstructを作成
      const memory1 = new BedrockAgentCoreMemoryConstruct(stack, 'Memory1', {
        enabled: true,
        projectName: 'permission-aware-rag',
        environment: 'prod',
      });

      const memory2 = new BedrockAgentCoreMemoryConstruct(stack, 'Memory2', {
        enabled: true,
        projectName: 'permission-aware-rag',
        environment: 'dev',
      });

      // Assert
      expect(memory1.memoryResourceArn).toBeDefined();
      expect(memory2.memoryResourceArn).toBeDefined();
      expect(memory1.memoryResourceArn).not.toBe(memory2.memoryResourceArn);

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::BedrockAgentCore::Memory', 2);
    });

    test('KMS暗号化が他のリソースと統合される', () => {
      // Arrange
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'DataStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
      });

      // Act
      new BedrockAgentCoreMemoryConstruct(stack, 'Memory', {
        enabled: true,
        projectName: 'permission-aware-rag',
        environment: 'prod',
        kms: {
          keyAliasPrefix: 'permission-aware-rag-memory',
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::KMS::Key', 1);
      template.resourceCountIs('AWS::KMS::Alias', 1);
      
      // KMS KeyがMemory Resourceに関連付けられていることを確認
      template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        EncryptionKeyArn: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('.*KmsKey.*')]),
        }),
      });
    });

    test('IAM Roleが他のリソースと統合される', () => {
      // Arrange
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'DataStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
      });

      // Act
      new BedrockAgentCoreMemoryConstruct(stack, 'Memory', {
        enabled: true,
        projectName: 'permission-aware-rag',
        environment: 'prod',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::IAM::Role', 1);
      template.resourceCountIs('AWS::IAM::Policy', 1);
      
      // IAM RoleがMemory Resourceに関連付けられていることを確認
      template.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        MemoryExecutionRoleArn: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('.*ExecutionRole.*')]),
        }),
      });
    });

    test('CDK synthが成功する', () => {
      // Arrange
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'DataStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
      });

      // Act
      new BedrockAgentCoreMemoryConstruct(stack, 'Memory', {
        enabled: true,
        projectName: 'permission-aware-rag',
        environment: 'prod',
      });

      // Assert - synthが例外を投げないことを確認
      expect(() => {
        app.synth();
      }).not.toThrow();
    });

    test('複数環境での統合が動作する', () => {
      // Arrange
      const app = new cdk.App();
      const prodStack = new cdk.Stack(app, 'DataStackProd', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
      });
      const devStack = new cdk.Stack(app, 'DataStackDev', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
      });

      // Act
      const prodMemory = new BedrockAgentCoreMemoryConstruct(prodStack, 'Memory', {
        enabled: true,
        projectName: 'permission-aware-rag',
        environment: 'prod',
      });

      const devMemory = new BedrockAgentCoreMemoryConstruct(devStack, 'Memory', {
        enabled: true,
        projectName: 'permission-aware-rag',
        environment: 'dev',
      });

      // Assert
      expect(prodMemory.memoryResourceArn).toBeDefined();
      expect(devMemory.memoryResourceArn).toBeDefined();

      const prodTemplate = Template.fromStack(prodStack);
      const devTemplate = Template.fromStack(devStack);

      prodTemplate.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        Name: Match.stringLikeRegexp('.*-prod-Memory-Resource'),
      });

      devTemplate.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        Name: Match.stringLikeRegexp('.*-dev-Memory-Resource'),
      });
    });

    test('リージョン間での統合が動作する', () => {
      // Arrange
      const app = new cdk.App();
      const tokyoStack = new cdk.Stack(app, 'DataStackTokyo', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
      });
      const virginiaStack = new cdk.Stack(app, 'DataStackVirginia', {
        env: {
          account: '123456789012',
          region: 'us-east-1',
        },
      });

      // Act
      new BedrockAgentCoreMemoryConstruct(tokyoStack, 'Memory', {
        enabled: true,
        projectName: 'permission-aware-rag',
        environment: 'prod',
      });

      new BedrockAgentCoreMemoryConstruct(virginiaStack, 'Memory', {
        enabled: true,
        projectName: 'permission-aware-rag',
        environment: 'prod',
      });

      // Assert
      const tokyoTemplate = Template.fromStack(tokyoStack);
      const virginiaTemplate = Template.fromStack(virginiaStack);

      tokyoTemplate.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        Name: Match.stringLikeRegexp('^TokyoRegion-'),
      });

      virginiaTemplate.hasResourceProperties('AWS::BedrockAgentCore::Memory', {
        Name: Match.stringLikeRegexp('^NorthVirginiaRegion-'),
      });
    });

    test('タグが正しく伝播される', () => {
      // Arrange
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'DataStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
        tags: {
          Application: 'PermissionAwareRAG',
          CostCenter: 'Engineering',
        },
      });

      // Act
      new BedrockAgentCoreMemoryConstruct(stack, 'Memory', {
        enabled: true,
        projectName: 'permission-aware-rag',
        environment: 'prod',
        tags: {
          Owner: 'DataTeam',
          Compliance: 'GDPR',
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      const resources = template.findResources('AWS::BedrockAgentCore::Memory');
      const memoryResource = Object.values(resources)[0];

      expect(memoryResource.Properties.Tags).toMatchObject({
        Owner: 'DataTeam',
        Compliance: 'GDPR',
        Project: 'permission-aware-rag',
        Environment: 'prod',
        Component: 'BedrockAgentCoreMemory',
        ManagedBy: 'CDK',
      });
    });

    test('無効化された場合にリソースが作成されない', () => {
      // Arrange
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'DataStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
      });

      // Act
      new BedrockAgentCoreMemoryConstruct(stack, 'Memory', {
        enabled: false,
        projectName: 'permission-aware-rag',
        environment: 'prod',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::BedrockAgentCore::Memory', 0);
      template.resourceCountIs('AWS::KMS::Key', 0);
      template.resourceCountIs('AWS::IAM::Role', 0);
    });
  });
});
