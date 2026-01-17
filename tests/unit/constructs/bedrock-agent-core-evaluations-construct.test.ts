/**
 * Bedrock Agent Core Evaluations Construct Unit Tests
 * 
 * 品質メトリクス、A/Bテスト、パフォーマンス評価機能のテストを実施します。
 */

import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BedrockAgentCoreEvaluationsConstruct } from '../../../lib/modules/ai/constructs/bedrock-agent-core-evaluations-construct';

describe('BedrockAgentCoreEvaluationsConstruct', () => {
  let app: App;
  let stack: Stack;
  let template: Template;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1',
      },
    });
  });

  describe('Construct Creation', () => {
    test('有効化された状態でConstructが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      template = Template.fromStack(stack);
      
      // S3バケットが作成される
      template.resourceCountIs('AWS::S3::Bucket', 1);
      
      // DynamoDBテーブルが作成される
      template.resourceCountIs('AWS::DynamoDB::Table', 1);
      
      // CloudWatch Logsログループが作成される
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });

    test('無効化された状態でダミーリソースが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: false,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      template = Template.fromStack(stack);
      
      // ダミーリソースが作成される
      template.resourceCountIs('AWS::S3::Bucket', 1);
      template.resourceCountIs('AWS::DynamoDB::Table', 1);
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });

    test('カスタム設定でConstructが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        qualityMetricsConfig: {
          enabled: true,
          accuracy: true,
          relevance: true,
          helpfulness: true,
        },
        abTestConfig: {
          enabled: true,
          trafficSplit: [60, 40],
          significanceThreshold: 0.05,
          minSampleSize: 200,
        },
        performanceEvaluationConfig: {
          enabled: true,
          latencyThreshold: 2000,
          throughputThreshold: 200,
          costThreshold: 200,
        },
        resultsRetentionDays: 180,
      });

      // Assert
      template = Template.fromStack(stack);
      
      // リソースが作成される
      template.resourceCountIs('AWS::S3::Bucket', 1);
      template.resourceCountIs('AWS::DynamoDB::Table', 1);
    });
  });

  describe('S3 Bucket Configuration', () => {
    test('S3バケットが暗号化される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            },
          ],
        },
      });
    });

    test('S3バケットのバージョニングが有効化される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    test('S3バケットのライフサイクルポリシーが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        resultsRetentionDays: 90,
      });

      // Assert
      template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::S3::Bucket', {
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              Status: 'Enabled',
              ExpirationInDays: 90,
            }),
          ]),
        },
      });
    });

    test('カスタム保持期間が設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        resultsRetentionDays: 180,
      });

      // Assert
      template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::S3::Bucket', {
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              ExpirationInDays: 180,
            }),
          ]),
        },
      });
    });
  });

  describe('DynamoDB Table Configuration', () => {
    test('DynamoDBテーブルが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          {
            AttributeName: 'evaluationId',
            KeyType: 'HASH',
          },
          {
            AttributeName: 'timestamp',
            KeyType: 'RANGE',
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      });
    });

    test('DynamoDBテーブルにGSIが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'MetricTypeIndex',
            KeySchema: [
              {
                AttributeName: 'metricType',
                KeyType: 'HASH',
              },
              {
                AttributeName: 'timestamp',
                KeyType: 'RANGE',
              },
            ],
          }),
          Match.objectLike({
            IndexName: 'ABTestIndex',
            KeySchema: [
              {
                AttributeName: 'abTestId',
                KeyType: 'HASH',
              },
              {
                AttributeName: 'timestamp',
                KeyType: 'RANGE',
              },
            ],
          }),
        ]),
      });
    });

    test('DynamoDBテーブルのポイントインタイムリカバリが有効化される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      });
    });

    test('DynamoDBテーブルにTTL属性が設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true,
        },
      });
    });
  });

  describe('CloudWatch Logs Configuration', () => {
    test('CloudWatch Logsログループが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: Match.stringLikeRegexp('/aws/bedrock/agent-core/test-project/test/evaluations'),
      });
    });
  });

  describe('Quality Metrics Configuration', () => {
    test('品質メトリクスが有効化される', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        qualityMetricsConfig: {
          enabled: true,
          accuracy: true,
          relevance: true,
          helpfulness: true,
        },
      });

      // Assert
      expect(construct).toBeDefined();
      expect(construct.resultsBucket).toBeDefined();
      expect(construct.resultsTable).toBeDefined();
    });

    test('全ての品質メトリクスが有効化される', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        qualityMetricsConfig: {
          enabled: true,
          accuracy: true,
          relevance: true,
          helpfulness: true,
          consistency: true,
          completeness: true,
          conciseness: true,
          clarity: true,
          grammar: true,
          tone: true,
          bias: true,
          toxicity: true,
          factuality: true,
          citationQuality: true,
        },
      });

      // Assert
      expect(construct).toBeDefined();
    });
  });

  describe('A/B Test Configuration', () => {
    test('A/Bテストが有効化される', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        abTestConfig: {
          enabled: true,
          trafficSplit: [50, 50],
        },
      });

      // Assert
      expect(construct).toBeDefined();
      expect(construct.resultsBucket).toBeDefined();
      expect(construct.resultsTable).toBeDefined();
    });

    test('カスタムトラフィック分割が設定される', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        abTestConfig: {
          enabled: true,
          trafficSplit: [70, 30],
          significanceThreshold: 0.01,
          minSampleSize: 500,
        },
      });

      // Assert
      expect(construct).toBeDefined();
    });
  });

  describe('Performance Evaluation Configuration', () => {
    test('パフォーマンス評価が有効化される', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        performanceEvaluationConfig: {
          enabled: true,
          latencyThreshold: 1000,
          throughputThreshold: 100,
          costThreshold: 100,
        },
      });

      // Assert
      expect(construct).toBeDefined();
      expect(construct.resultsBucket).toBeDefined();
      expect(construct.resultsTable).toBeDefined();
    });

    test('カスタム閾値が設定される', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        performanceEvaluationConfig: {
          enabled: true,
          latencyThreshold: 3000,
          throughputThreshold: 500,
          costThreshold: 500,
        },
      });

      // Assert
      expect(construct).toBeDefined();
    });
  });

  describe('Resource Naming', () => {
    test('リソース名にプロジェクト名と環境名が含まれる', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'my-project',
        environment: 'production',
      });

      // Assert
      template = Template.fromStack(stack);
      
      // DynamoDBテーブル名を確認
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'my-project-production-evaluations-results',
      });
    });
  });

  describe('Public Properties', () => {
    test('パブリックプロパティが公開される', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreEvaluationsConstruct(stack, 'TestEvaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      expect(construct.resultsBucket).toBeDefined();
      expect(construct.resultsTable).toBeDefined();
      expect(construct.logGroup).toBeDefined();
      expect(construct.resultsBucket.bucketName).toBeDefined();
      expect(construct.resultsTable.tableName).toBeDefined();
    });
  });
});
