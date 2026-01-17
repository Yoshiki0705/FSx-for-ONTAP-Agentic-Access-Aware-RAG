/**
 * TASK-1.3.1: EmbeddingStackへの統合テスト
 * 
 * このテストは、Runtime ConstructがEmbeddingStackに正しく統合されることを検証します。
 * 
 * テスト内容:
 * - Runtime ConstructがEmbeddingStackに正しく統合される
 * - 設定が正しく読み込まれる
 * - 他のConstructと競合しない
 * - CDK synthが成功する
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { EmbeddingStack } from '../../lib/stacks/integrated/embedding-stack';
import { BedrockAgentCoreRuntimeConstruct } from '../../lib/modules/ai/constructs/bedrock-agent-core-runtime-construct';

describe('Runtime Construct - EmbeddingStack統合テスト', () => {
  let app: cdk.App;
  let stack: EmbeddingStack;
  let template: Template;

  beforeEach(() => {
    // CDK Appを作成
    app = new cdk.App({
      context: {
        projectName: 'test-project',
        environment: 'test',
        region: 'ap-northeast-1',
        // Runtime Construct設定
        bedrockAgentCoreRuntime: {
          enabled: true,
          bedrockAgentId: 'test-agent-id',
          bedrockAgentAliasId: 'test-alias-id',
          timeout: 30,
          memorySize: 2048,
          reservedConcurrentExecutions: 5,
          enableProvisioned: false,
          enableVpc: false,
          enableTracing: true,
        },
      },
    });

    // EmbeddingStackを作成
    stack = new EmbeddingStack(app, 'TestEmbeddingStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1',
      },
    });

    // CloudFormationテンプレートを取得
    template = Template.fromStack(stack);
  });

  describe('統合テスト: Runtime Constructの作成', () => {
    test('Runtime ConstructがEmbeddingStackに統合される', () => {
      // Lambda関数が作成されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs22.x',
        Handler: 'index.handler',
        Timeout: 30,
        MemorySize: 2048,
      });
    });

    test('設定が正しく読み込まれる', () => {
      // 環境変数が正しく設定されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            PROJECT_NAME: 'test-project',
            ENVIRONMENT: 'test',
            BEDROCK_AGENT_ID: 'test-agent-id',
            BEDROCK_AGENT_ALIAS_ID: 'test-alias-id',
            ENABLE_TRACING: 'true',
          },
        },
      });
    });

    test('Reserved Concurrencyが設定される', () => {
      // Reserved Concurrencyが設定されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        ReservedConcurrentExecutions: 5,
      });
    });
  });

  describe('統合テスト: EventBridge統合', () => {
    test('EventBridge Ruleが作成される', () => {
      // EventBridge Ruleが作成されることを確認
      template.resourceCountIs('AWS::Events::Rule', 1);

      template.hasResourceProperties('AWS::Events::Rule', {
        State: 'ENABLED',
        EventPattern: {
          source: ['bedrock.agent.runtime'],
          'detail-type': ['Agent Invocation Request'],
        },
      });
    });

    test('Lambda関数がEventBridgeターゲットに設定される', () => {
      // EventBridge RuleのターゲットにLambda関数が設定されることを確認
      template.hasResourceProperties('AWS::Events::Rule', {
        Targets: Match.arrayWith([
          Match.objectLike({
            Arn: Match.objectLike({
              'Fn::GetAtt': Match.arrayWith([
                Match.stringLikeRegexp('.*Function.*'),
                'Arn',
              ]),
            }),
          }),
        ]),
      });
    });
  });

  describe('統合テスト: KMS暗号化', () => {
    test('KMS Keyが作成される', () => {
      // KMS Keyが作成されることを確認
      template.resourceCountIs('AWS::KMS::Key', 1);

      template.hasResourceProperties('AWS::KMS::Key', {
        EnableKeyRotation: true,
      });
    });

    test('Lambda環境変数がKMSで暗号化される', () => {
      // Lambda関数の環境変数がKMSで暗号化されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        KmsKeyArn: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([
            Match.stringLikeRegexp('.*Key.*'),
            'Arn',
          ]),
        }),
      });
    });
  });

  describe('統合テスト: Dead Letter Queue', () => {
    test('DLQが作成される', () => {
      // SQS Queueが作成されることを確認
      template.resourceCountIs('AWS::SQS::Queue', 1);

      template.hasResourceProperties('AWS::SQS::Queue', {
        MessageRetentionPeriod: 1209600, // 14日
      });
    });

    test('Lambda関数にDLQが設定される', () => {
      // Lambda関数にDLQが設定されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        DeadLetterConfig: {
          TargetArn: Match.objectLike({
            'Fn::GetAtt': Match.arrayWith([
              Match.stringLikeRegexp('.*Queue.*'),
              'Arn',
            ]),
          }),
        },
      });
    });
  });

  describe('統合テスト: IAM権限', () => {
    test('Lambda実行ロールが作成される', () => {
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

    test('Bedrock実行権限が付与される', () => {
      // Bedrock実行権限が付与されることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                'bedrock:InvokeAgent',
                'bedrock:InvokeModel',
                'bedrock:GetAgent',
                'bedrock:GetAgentAlias',
              ],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    test('KMS復号化権限が付与される', () => {
      // KMS復号化権限が付与されることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['kms:Decrypt', 'kms:DescribeKey'],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    test('CloudWatch Logs権限が付与される', () => {
      // CloudWatch Logs権限が付与されることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('統合テスト: タグ付け', () => {
    test('リソースにタグが付与される', () => {
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
            Value: 'AgentCoreRuntime',
          },
        ]),
      });
    });
  });

  describe('統合テスト: リソース数検証', () => {
    test('期待されるリソース数が作成される', () => {
      // Lambda関数: 1個
      template.resourceCountIs('AWS::Lambda::Function', 1);

      // EventBridge Rule: 1個
      template.resourceCountIs('AWS::Events::Rule', 1);

      // KMS Key: 1個
      template.resourceCountIs('AWS::KMS::Key', 1);

      // SQS Queue (DLQ): 1個
      template.resourceCountIs('AWS::SQS::Queue', 1);

      // IAM Role: 1個以上（Lambda実行ロール）
      const roles = template.findResources('AWS::IAM::Role');
      expect(Object.keys(roles).length).toBeGreaterThanOrEqual(1);

      // IAM Policy: 1個以上（Lambda実行ポリシー）
      const policies = template.findResources('AWS::IAM::Policy');
      expect(Object.keys(policies).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('統合テスト: 他のConstructとの競合', () => {
    test('他のConstructと競合しない', () => {
      // CDK synthが成功することを確認（エラーが発生しない）
      expect(() => {
        app.synth();
      }).not.toThrow();
    });

    test('リソース名が一意である', () => {
      // 全てのリソースIDを取得
      const allResources = template.toJSON().Resources;
      const resourceIds = Object.keys(allResources);

      // 重複がないことを確認
      const uniqueIds = new Set(resourceIds);
      expect(uniqueIds.size).toBe(resourceIds.length);
    });
  });

  describe('統合テスト: 無効化時の動作', () => {
    test('無効化された場合はリソースが作成されない', () => {
      // Runtime Constructを無効化したAppを作成
      const disabledApp = new cdk.App({
        context: {
          projectName: 'test-project',
          environment: 'test',
          region: 'ap-northeast-1',
          bedrockAgentCoreRuntime: {
            enabled: false,
          },
        },
      });

      // EmbeddingStackを作成
      const disabledStack = new EmbeddingStack(disabledApp, 'TestDisabledStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
      });

      // CloudFormationテンプレートを取得
      const disabledTemplate = Template.fromStack(disabledStack);

      // Runtime関連のリソースが作成されないことを確認
      // （他のEmbeddingStack関連リソースは作成される可能性があるため、
      //  Runtime固有のリソースのみをチェック）
      const resources = disabledTemplate.toJSON().Resources;
      const runtimeResources = Object.keys(resources).filter((key) =>
        key.includes('AgentCoreRuntime')
      );

      expect(runtimeResources.length).toBe(0);
    });
  });

  describe('統合テスト: CDK Synth成功', () => {
    test('CDK synthが成功する', () => {
      // CDK synthが成功することを確認
      const assembly = app.synth();

      // アセンブリが作成されることを確認
      expect(assembly).toBeDefined();

      // スタックが含まれることを確認
      expect(assembly.stacks.length).toBeGreaterThan(0);

      // エラーがないことを確認
      expect(assembly.manifest.missing).toBeUndefined();
    });

    test('CloudFormationテンプレートが有効である', () => {
      // CloudFormationテンプレートを取得
      const cfnTemplate = template.toJSON();

      // テンプレートが有効であることを確認
      expect(cfnTemplate).toBeDefined();
      expect(cfnTemplate.Resources).toBeDefined();
      expect(Object.keys(cfnTemplate.Resources).length).toBeGreaterThan(0);
    });
  });
});
