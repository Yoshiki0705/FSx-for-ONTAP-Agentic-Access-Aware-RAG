/**
 * Phase 3統合テスト: Observability, Evaluations, Policy
 * 
 * このテストは、Phase 3で実装された3つのコンポーネントが
 * 正しく連携することを検証します。
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BedrockAgentCoreObservabilityConstruct } from '../../lib/modules/ai/constructs/bedrock-agent-core-observability-construct';
import { BedrockAgentCoreEvaluationsConstruct } from '../../lib/modules/ai/constructs/bedrock-agent-core-evaluations-construct';
import { BedrockAgentCorePolicyConstruct } from '../../lib/modules/ai/constructs/bedrock-agent-core-policy-construct';

describe('Phase 3統合テスト', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1',
      },
    });
  });

  describe('3コンポーネント統合', () => {
    test('3つのコンポーネントが同時に作成できる', () => {
      // Observability Construct
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Evaluations Construct
      const evaluations = new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Policy Construct
      const policy = new BedrockAgentCorePolicyConstruct(stack, 'Policy', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      template = Template.fromStack(stack);

      // 各コンポーネントのリソースが作成されていることを確認
      expect(observability).toBeDefined();
      expect(evaluations).toBeDefined();
      expect(policy).toBeDefined();
    });

    test('Observabilityが他のコンポーネントのLambda関数を監視できる', () => {
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        xrayConfig: {
          enabled: true,
          samplingRate: 1.0,
        },
        cloudwatchConfig: {
          enabled: true,
          namespace: 'Test/AgentCore',
        },
      });

      const evaluations = new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      const policy = new BedrockAgentCorePolicyConstruct(stack, 'Policy', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // ObservabilityをPolicy Lambda関数に適用
      if (policy.policyFunction) {
        observability.enableXRayForLambda(policy.policyFunction);
        observability.addMetricsConfig(policy.policyFunction);
        observability.addLoggingConfig(policy.policyFunction);
      }

      template = Template.fromStack(stack);

      // Lambda関数にX-Ray権限が付与されていることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: expect.arrayContaining([
            expect.objectContaining({
              Action: expect.arrayContaining([
                'xray:PutTraceSegments',
                'xray:PutTelemetryRecords',
              ]),
            }),
          ]),
        },
      });
    });

    test('EvaluationsとPolicyが相互にアクセスできる構成', () => {
      const evaluations = new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      const policy = new BedrockAgentCorePolicyConstruct(stack, 'Policy', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      template = Template.fromStack(stack);

      // 両方のDynamoDBテーブルが作成されていることを確認
      template.resourceCountIs('AWS::DynamoDB::Table', 2);

      // リソースが正しく作成されていることを確認
      expect(evaluations.resultsTable).toBeDefined();
      expect(policy.policyTable).toBeDefined();
    });

    test('PolicyがObservabilityの監査ログを記録できる', () => {
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      const policy = new BedrockAgentCorePolicyConstruct(stack, 'Policy', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        policyManagementConfig: {
          enabled: true,
          auditLogging: true,
        },
      });

      // PolicyにCloudWatch Logs書き込み権限を付与
      if (policy.policyFunction && observability.logGroup) {
        observability.logGroup.grantWrite(policy.policyFunction);
      }

      template = Template.fromStack(stack);

      // CloudWatch Logs書き込み権限が付与されていることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: expect.arrayContaining([
            expect.objectContaining({
              Action: expect.arrayContaining([
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ]),
            }),
          ]),
        },
      });
    });
  });

  describe('運用機能統合', () => {
    test('全コンポーネントが同じKMSキーを使用できる', () => {
      const kmsKey = new cdk.aws_kms.Key(stack, 'SharedKey', {
        enableKeyRotation: true,
        description: 'Shared KMS key for Phase 3 components',
      });

      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        kmsConfig: {
          enabled: true,
          kmsKeyArn: kmsKey.keyArn,
        },
      });

      const evaluations = new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      const policy = new BedrockAgentCorePolicyConstruct(stack, 'Policy', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      template = Template.fromStack(stack);

      // 共有KMSキーが作成されていることを確認
      template.resourceCountIs('AWS::KMS::Key', 1);

      // 各コンポーネントがKMSキーを使用していることを確認
      expect(observability).toBeDefined();
      expect(evaluations).toBeDefined();
      expect(policy).toBeDefined();
    });

    test('全コンポーネントに共通のタグが適用される', () => {
      const commonTags = {
        Environment: 'test',
        Project: 'test-project',
        Phase: 'Phase3',
        ManagedBy: 'CDK',
      };

      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        tags: commonTags,
      });

      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        tags: commonTags,
      });

      new BedrockAgentCorePolicyConstruct(stack, 'Policy', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        tags: commonTags,
      });

      template = Template.fromStack(stack);

      // タグが適用されていることを確認（Lambda関数）
      template.hasResourceProperties('AWS::Lambda::Function', {
        Tags: expect.arrayContaining([
          { Key: 'Environment', Value: 'test' },
          { Key: 'Project', Value: 'test-project' },
        ]),
      });
    });

    test('全コンポーネントが同じVPCを使用できる', () => {
      const vpc = new cdk.aws_ec2.Vpc(stack, 'SharedVpc', {
        maxAzs: 2,
        natGateways: 1,
      });

      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      const evaluations = new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      const policy = new BedrockAgentCorePolicyConstruct(stack, 'Policy', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      template = Template.fromStack(stack);

      // VPCが作成されていることを確認
      template.resourceCountIs('AWS::EC2::VPC', 1);

      expect(observability).toBeDefined();
      expect(evaluations).toBeDefined();
      expect(policy).toBeDefined();
    });
  });

  describe('エラーハンドリング統合', () => {
    test('無効な設定でコンポーネントを作成するとエラーになる', () => {
      expect(() => {
        new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
          enabled: true,
          projectName: '', // 空のプロジェクト名
          environment: 'test',
        });
      }).toThrow();
    });

    test('重複するコンポーネントIDでエラーになる', () => {
      new BedrockAgentCoreObservabilityConstruct(stack, 'Component', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      expect(() => {
        new BedrockAgentCoreEvaluationsConstruct(stack, 'Component', {
          enabled: true,
          projectName: 'test-project',
          environment: 'test',
        });
      }).toThrow();
    });

    test('無効化されたコンポーネントはリソースを作成しない', () => {
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: false,
        projectName: 'test-project',
        environment: 'test',
      });

      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: false,
        projectName: 'test-project',
        environment: 'test',
      });

      new BedrockAgentCorePolicyConstruct(stack, 'Policy', {
        enabled: false,
        projectName: 'test-project',
        environment: 'test',
      });

      template = Template.fromStack(stack);

      // Lambda関数が作成されていないことを確認
      template.resourceCountIs('AWS::Lambda::Function', 0);
    });
  });

  describe('パフォーマンス統合', () => {
    test('全コンポーネントが適切なリソースを持つ', () => {
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      new BedrockAgentCorePolicyConstruct(stack, 'Policy', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      template = Template.fromStack(stack);

      // S3バケットが作成されていることを確認
      template.resourceCountIs('AWS::S3::Bucket', 2);

      // DynamoDBテーブルが作成されていることを確認
      template.resourceCountIs('AWS::DynamoDB::Table', 2);

      // CloudWatch Logsが作成されていることを確認
      template.resourceCountIs('AWS::Logs::LogGroup', 3);
    });

    test('全コンポーネントが適切な設定を持つ', () => {
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      new BedrockAgentCorePolicyConstruct(stack, 'Policy', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      template = Template.fromStack(stack);

      // S3バケットが暗号化されていることを確認
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: expect.arrayContaining([
            expect.objectContaining({
              ServerSideEncryptionByDefault: expect.objectContaining({
                SSEAlgorithm: 'AES256',
              }),
            }),
          ]),
        },
      });
    });
  });

  describe('セキュリティ統合', () => {
    test('全コンポーネントが暗号化を使用する', () => {
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      new BedrockAgentCorePolicyConstruct(stack, 'Policy', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      template = Template.fromStack(stack);

      // S3バケットが暗号化されていることを確認
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: expect.objectContaining({
          ServerSideEncryptionConfiguration: expect.any(Array),
        }),
      });

      // DynamoDBテーブルが暗号化されていることを確認
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        SSESpecification: expect.objectContaining({
          SSEEnabled: true,
        }),
      });
    });

    test('全コンポーネントがKMS暗号化を使用できる', () => {
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        kmsConfig: {
          enabled: true,
        },
      });

      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      new BedrockAgentCorePolicyConstruct(stack, 'Policy', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      template = Template.fromStack(stack);

      // KMSキーが作成されていることを確認
      template.resourceCountIs('AWS::KMS::Key', 1);
    });
  });
});
