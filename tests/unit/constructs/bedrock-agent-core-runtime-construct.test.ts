/**
 * Amazon Bedrock AgentCore Runtime Construct - 単体テスト
 * 
 * @description Runtime Constructの単体テストを実施
 * @author Kiro AI
 * @created 2026-01-03
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BedrockAgentCoreRuntimeConstruct } from '../../../lib/modules/ai/constructs/bedrock-agent-core-runtime-construct';

describe('BedrockAgentCoreRuntimeConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
  });

  describe('Construct作成', () => {
    it('最小限の設定でConstructが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // Lambda関数が作成されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs22.x',
        Timeout: 30,
        MemorySize: 2048,
      });
    });

    it('無効化された場合はリソースが作成されない', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: false,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // Lambda関数が作成されないことを確認
      template.resourceCountIs('AWS::Lambda::Function', 0);
    });
  });

  describe('Lambda関数設定', () => {
    it('環境変数が正しく設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        bedrockAgentId: 'test-agent-id',
        bedrockAgentAliasId: 'test-alias-id',
        bedrockRegion: 'us-east-1',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            PROJECT_NAME: 'test-project',
            ENVIRONMENT: 'test',
            BEDROCK_AGENT_ID: 'test-agent-id',
            BEDROCK_AGENT_ALIAS_ID: 'test-alias-id',
            BEDROCK_REGION: 'us-east-1',
          },
        },
      });
    });

    it('カスタムタイムアウトが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        timeout: 60,
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        Timeout: 60,
      });
    });

    it('カスタムメモリサイズが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        memorySize: 4096,
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 4096,
      });
    });

    it('Reserved Concurrencyが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        reservedConcurrentExecutions: 5,
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        ReservedConcurrentExecutions: 5,
      });
    });
  });

  describe('EventBridge統合', () => {
    it('EventBridge Ruleが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // EventBridge Ruleが作成されることを確認
      template.hasResourceProperties('AWS::Events::Rule', {
        State: 'ENABLED',
        EventPattern: {
          source: ['bedrock.agent.runtime'],
          'detail-type': ['Agent Invocation Request'],
        },
      });
    });

    it('Lambda関数がEventBridgeターゲットに設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // EventBridge Ruleのターゲットが設定されることを確認
      template.hasResourceProperties('AWS::Events::Rule', {
        Targets: Match.arrayWith([
          Match.objectLike({
            Arn: Match.anyValue(),
            RetryPolicy: {
              MaximumRetryAttempts: 3,
              MaximumEventAge: 86400,
            },
          }),
        ]),
      });
    });

    it('カスタムイベントパターンが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        eventPattern: {
          source: ['custom.source'],
          detailType: ['Custom Event'],
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Events::Rule', {
        EventPattern: {
          source: ['custom.source'],
          'detail-type': ['Custom Event'],
        },
      });
    });
  });

  describe('Dead Letter Queue (DLQ)', () => {
    it('DLQが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // SQS Queueが作成されることを確認
      template.hasResourceProperties('AWS::SQS::Queue', {
        MessageRetentionPeriod: 1209600, // 14日
      });
    });

    it('Lambda関数にDLQが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        DeadLetterConfig: {
          TargetArn: Match.anyValue(),
        },
      });
    });
  });

  describe('KMS暗号化', () => {
    it('KMS Keyが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // KMS Keyが作成されることを確認
      template.hasResourceProperties('AWS::KMS::Key', {
        EnableKeyRotation: true,
      });
    });

    it('Lambda環境変数がKMSで暗号化される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        KmsKeyArn: Match.anyValue(),
      });
    });
  });

  describe('IAM権限', () => {
    it('Lambda実行ロールが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // IAM Roleが作成されることを確認
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
            }),
          ]),
        },
      });
    });

    it('Bedrock実行権限が付与される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // IAM Policyが作成されることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'bedrock:InvokeAgent',
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    it('KMS復号化権限が付与される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['kms:Decrypt', 'kms:DescribeKey']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('VPC統合', () => {
    it('VPC設定が適用される', () => {
      // Arrange
      const vpc = new cdk.aws_ec2.Vpc(stack, 'TestVpc');
      
      // Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        vpc: vpc,
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        VpcConfig: {
          SubnetIds: Match.anyValue(),
          SecurityGroupIds: Match.anyValue(),
        },
      });
    });
  });

  describe('Provisioned Concurrency', () => {
    it('Provisioned Concurrencyが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        provisionedConcurrentExecutions: 2,
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // Lambda Aliasが作成されることを確認
      template.hasResourceProperties('AWS::Lambda::Alias', {
        Name: 'live',
      });
      
      // Provisioned Concurrency Configが作成されることを確認
      template.hasResourceProperties('AWS::Lambda::Version', Match.anyValue());
    });

    it('Auto Scalingが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        provisionedConcurrentExecutions: 2,
        maxProvisionedConcurrentExecutions: 10,
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // Application Auto Scaling Targetが作成されることを確認
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', {
        MinCapacity: 2,
        MaxCapacity: 20, // maxProvisionedConcurrentExecutions * 2
      });
      
      // Scaling Policyが作成されることを確認
      template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
        PolicyType: 'TargetTrackingScaling',
        TargetTrackingScalingPolicyConfiguration: {
          TargetValue: 0.7, // 70% CPU使用率
        },
      });
    });
  });

  describe('タグ付け', () => {
    it('リソースにタグが付与される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // Lambda関数にタグが付与されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        Tags: Match.arrayWith([
          {
            Key: 'Project',
            Value: 'test-project',
          },
          {
            Key: 'Environment',
            Value: 'test',
          },
          {
            Key: 'Component',
            Value: 'AgentCore-Runtime',
          },
        ]),
      });
    });
  });

  describe('リソース数検証', () => {
    it('期待されるリソース数が作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreRuntimeConstruct(stack, 'TestRuntime', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // 各リソースタイプの数を確認
      template.resourceCountIs('AWS::Lambda::Function', 1);
      template.resourceCountIs('AWS::Events::Rule', 1);
      template.resourceCountIs('AWS::SQS::Queue', 1);
      template.resourceCountIs('AWS::KMS::Key', 1);
      template.resourceCountIs('AWS::IAM::Role', 1);
    });
  });
});
