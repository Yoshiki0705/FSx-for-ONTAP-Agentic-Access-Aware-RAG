/**
 * Operations Stack Evaluations Integration Tests
 * 
 * OperationsStackへのEvaluations機能統合テストを実施します。
 */

import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BedrockAgentCoreEvaluationsConstruct } from '../../../lib/modules/ai/constructs/bedrock-agent-core-evaluations-construct';

describe('OperationsStack Evaluations Integration', () => {
  let app: App;
  let stack: Stack;
  let template: Template;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestOperationsStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1',
      },
    });
  });

  describe('Evaluations Integration', () => {
    test('EvaluationsがOperationsStackに統合される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
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
          trafficSplit: [50, 50],
        },
        performanceEvaluationConfig: {
          enabled: true,
          latencyThreshold: 1000,
          throughputThreshold: 100,
          costThreshold: 100,
        },
      });

      // Assert
      template = Template.fromStack(stack);
      
      // 必要なリソースが作成される
      template.resourceCountIs('AWS::S3::Bucket', 1);
      template.resourceCountIs('AWS::DynamoDB::Table', 1);
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });

    test('複数のEvaluations Constructが共存できる', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations1', {
        enabled: true,
        projectName: 'project1',
        environment: 'production',
      });

      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations2', {
        enabled: true,
        projectName: 'project2',
        environment: 'production',
      });

      // Assert
      template = Template.fromStack(stack);
      
      // 各Constructのリソースが作成される
      template.resourceCountIs('AWS::S3::Bucket', 2);
      template.resourceCountIs('AWS::DynamoDB::Table', 2);
      template.resourceCountIs('AWS::Logs::LogGroup', 2);
    });
  });

  describe('Quality Metrics Integration', () => {
    test('品質メトリクスが有効化される', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
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
      expect(construct.resultsBucket).toBeDefined();
      expect(construct.resultsTable).toBeDefined();
      expect(construct.logGroup).toBeDefined();
    });

    test('カスタム評価モデルが設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        qualityMetricsConfig: {
          enabled: true,
          accuracy: true,
          relevance: true,
          helpfulness: true,
        },
      });

      // Assert
      template = Template.fromStack(stack);
      template.resourceCountIs('AWS::S3::Bucket', 1);
    });
  });

  describe('A/B Test Integration', () => {
    test('A/Bテストが有効化される', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        abTestConfig: {
          enabled: true,
          trafficSplit: [70, 30],
          significanceThreshold: 0.05,
          minSampleSize: 200,
          autoOptimization: true,
          autoOptimizationThreshold: 0.95,
        },
      });

      // Assert
      expect(construct.resultsBucket).toBeDefined();
      expect(construct.resultsTable).toBeDefined();
      
      template = Template.fromStack(stack);
      
      // DynamoDBテーブルにABTestIndexが作成される
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'ABTestIndex',
          }),
        ]),
      });
    });
  });

  describe('Performance Evaluation Integration', () => {
    test('パフォーマンス評価が有効化される', () => {
      // Arrange & Act
      const construct = new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        performanceEvaluationConfig: {
          enabled: true,
          latencyThreshold: 2000,
          throughputThreshold: 200,
          costThreshold: 200,
          latencyMeasurement: true,
          throughputMeasurement: true,
          costAnalysis: true,
        },
      });

      // Assert
      expect(construct.resultsBucket).toBeDefined();
      expect(construct.resultsTable).toBeDefined();
    });
  });

  describe('Resource Configuration', () => {
    test('S3バケットが正しく設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        resultsRetentionDays: 180,
      });

      // Assert
      template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: {
          Status: 'Enabled',
        },
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            },
          ],
        },
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              Status: 'Enabled',
              ExpirationInDays: 180,
            }),
          ]),
        },
      });
    });

    test('DynamoDBテーブルが正しく設定される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
      });

      // Assert
      template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        BillingMode: 'PAY_PER_REQUEST',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true,
        },
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'MetricTypeIndex',
          }),
          Match.objectLike({
            IndexName: 'ABTestIndex',
          }),
        ]),
      });
    });
  });

  describe('Cross-Stack Integration', () => {
    test('他のスタックと統合できる', () => {
      // Arrange
      const observabilityStack = new Stack(app, 'ObservabilityStack', {
        env: {
          account: '123456789012',
          region: 'ap-northeast-1',
        },
      });

      // Act
      const evaluationsConstruct = new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
      });

      // Assert
      expect(evaluationsConstruct.resultsBucket).toBeDefined();
      expect(evaluationsConstruct.resultsTable).toBeDefined();
      
      // 他のスタックから参照可能
      expect(evaluationsConstruct.resultsBucket.bucketName).toBeDefined();
      expect(evaluationsConstruct.resultsTable.tableName).toBeDefined();
    });
  });

  describe('Tagging Integration', () => {
    test('全てのリソースにタグが付与される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        tags: {
          Project: 'TestProject',
          Environment: 'Production',
          Component: 'Evaluations',
        },
      });

      // Assert
      template = Template.fromStack(stack);
      
      // S3バケットのタグ
      template.hasResourceProperties('AWS::S3::Bucket', {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: 'Project',
            Value: 'TestProject',
          }),
        ]),
      });
      
      // DynamoDBテーブルのタグ
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: 'Project',
            Value: 'TestProject',
          }),
        ]),
      });
    });
  });

  describe('Disabled State Integration', () => {
    test('無効化された状態でダミーリソースが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreEvaluationsConstruct(stack, 'Evaluations', {
        enabled: false,
        projectName: 'test-project',
        environment: 'production',
      });

      // Assert
      template = Template.fromStack(stack);
      
      // ダミーリソースが作成される
      template.resourceCountIs('AWS::S3::Bucket', 1);
      template.resourceCountIs('AWS::DynamoDB::Table', 1);
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });
  });
});
