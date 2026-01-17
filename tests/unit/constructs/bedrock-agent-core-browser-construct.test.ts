/**
 * Amazon Bedrock AgentCore Browser Construct - 単体テスト
 * 
 * @description Browser Constructの単体テストを実施
 * @author Kiro AI
 * @created 2026-01-03
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BedrockAgentCoreBrowserConstruct } from '../../../lib/modules/ai/constructs/bedrock-agent-core-browser-construct';

describe('BedrockAgentCoreBrowserConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
  });

  describe('Construct作成', () => {
    it('最小限の設定でConstructが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // Lambda関数が作成されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs20.x',
        Timeout: 30,
        MemorySize: 2048,
      });
    });

    it('無効化された場合はリソースが作成されない', () => {
      // Arrange & Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
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

  describe('FSx for ONTAP + S3 Access Points統合', () => {
    it('FSx for ONTAP + S3 Access Pointが作成される', () => {
      // Arrange
      const vpc = new cdk.aws_ec2.Vpc(stack, 'TestVpc');
      const privateSubnets = vpc.selectSubnets({
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnets;

      // Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        fsxOntapConfig: {
          fileSystemId: 'fs-12345678',
          volumePath: '/browser-volume',
          vpc: vpc,
          privateSubnets: privateSubnets,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // S3 Access Pointが作成されることを確認
      template.hasResourceProperties('AWS::S3::AccessPoint', {
        Name: Match.stringLikeRegexp('browser'),
      });
    });

    it('Lambda関数にBROWSER_ACCESS_POINT_ARN環境変数が設定される', () => {
      // Arrange
      const vpc = new cdk.aws_ec2.Vpc(stack, 'TestVpc');
      const privateSubnets = vpc.selectSubnets({
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnets;

      // Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        fsxOntapConfig: {
          fileSystemId: 'fs-12345678',
          volumePath: '/browser-volume',
          vpc: vpc,
          privateSubnets: privateSubnets,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            BROWSER_ACCESS_POINT_ARN: Match.anyValue(),
          },
        },
      });
    });

    it('Lambda関数にFSx for ONTAP + S3 Access Pointsへのアクセス権限が付与される', () => {
      // Arrange
      const vpc = new cdk.aws_ec2.Vpc(stack, 'TestVpc');
      const privateSubnets = vpc.selectSubnets({
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnets;

      // Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        fsxOntapConfig: {
          fileSystemId: 'fs-12345678',
          volumePath: '/browser-volume',
          vpc: vpc,
          privateSubnets: privateSubnets,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // IAM Policyが作成されることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['s3:GetObject', 's3:PutObject']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('Lambda関数設定', () => {
    it('環境変数が正しく設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            NODE_ENV: 'production',
            PROJECT_NAME: 'test-project',
            ENVIRONMENT: 'test',
          },
        },
      });
    });

    it('カスタムタイムアウトが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        lambdaConfig: {
          timeout: 60,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        Timeout: 60,
      });
    });

    it('カスタムメモリサイズが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        lambdaConfig: {
          memorySize: 4096,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 4096,
      });
    });
  });

  describe('VPC統合', () => {
    it('VPC設定が適用される', () => {
      // Arrange
      const vpc = new cdk.aws_ec2.Vpc(stack, 'TestVpc');
      
      // Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        lambdaConfig: {
          vpcConfig: {
            vpc: vpc,
          },
        },
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

  describe('KMS暗号化', () => {
    it('KMS Keyが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
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
  });

  describe('IAM権限', () => {
    it('Lambda実行ロールが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
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
  });

  describe('タグ付け', () => {
    it('リソースにタグが付与される', () => {
      // Arrange & Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
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
            Value: 'AgentCore-Browser',
          },
        ]),
      });
    });
  });

  describe('リソース数検証', () => {
    it('期待されるリソース数が作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreBrowserConstruct(stack, 'TestBrowser', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // 各リソースタイプの数を確認
      template.resourceCountIs('AWS::Lambda::Function', 1);
      template.resourceCountIs('AWS::KMS::Key', 1);
      template.resourceCountIs('AWS::IAM::Role', 1);
    });
  });
});
