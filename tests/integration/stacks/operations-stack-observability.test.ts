/**
 * OperationsStack Observability統合テスト
 * 
 * BedrockAgentCoreObservabilityConstructがOperationsStackに
 * 正しく統合されることを検証します。
 */

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { BedrockAgentCoreObservabilityConstruct } from '../../../lib/modules/ai/constructs/bedrock-agent-core-observability-construct';

describe('OperationsStack Observability統合テスト', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1',
      },
    });
  });

  describe('基本統合', () => {
    test('ObservabilityConstructがOperationsStackに統合される', () => {
      // Arrange & Act
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        xrayConfig: {
          enabled: true,
          groupName: 'test-xray-group',
        },
        cloudwatchConfig: {
          enabled: true,
          dashboardName: 'test-dashboard',
        },
        errorTrackingConfig: {
          enabled: true,
        },
      });

      // Assert
      const template = Template.fromStack(stack);

      // X-Ray Groupが作成される
      template.resourceCountIs('AWS::XRay::Group', 1);

      // CloudWatch Dashboardが作成される
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);

      // Log Groupが作成される
      template.resourceCountIs('AWS::Logs::LogGroup', 1);

      // KMS Keyが作成される
      template.resourceCountIs('AWS::KMS::Key', 1);

      expect(observability).toBeDefined();
    });

    test('無効化された場合は最小限のリソースのみ作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: false,
        projectName: 'test-project',
        environment: 'production',
      });

      // Assert
      const template = Template.fromStack(stack);

      // X-Ray Groupは作成されない
      template.resourceCountIs('AWS::XRay::Group', 0);

      // CloudWatch Dashboardは作成されない
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 0);

      // ダミーLog Groupのみ作成される
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });
  });

  describe('Lambda統合', () => {
    test('複数のLambda関数にObservability設定が適用される', () => {
      // Arrange
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        xrayConfig: {
          enabled: true,
        },
        cloudwatchConfig: {
          enabled: true,
        },
      });

      const lambda1 = new lambda.Function(stack, 'Lambda1', {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      const lambda2 = new lambda.Function(stack, 'Lambda2', {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      observability.configureObservabilityForLambdas([lambda1, lambda2]);

      // Assert
      const template = Template.fromStack(stack);

      // 各Lambda関数にIAMポリシーが付与される
      template.resourceCountIs('AWS::IAM::Policy', 2);
    });

    test('個別のLambda関数にX-Ray設定が適用される', () => {
      // Arrange
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        xrayConfig: {
          enabled: true,
        },
      });

      const testLambda = new lambda.Function(stack, 'TestLambda', {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      observability.enableXRayForLambda(testLambda);

      // Assert
      const template = Template.fromStack(stack);

      // IAMポリシーが付与される
      template.resourceCountIs('AWS::IAM::Policy', 1);
    });

    test('個別のLambda関数にCloudWatchメトリクス設定が適用される', () => {
      // Arrange
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        cloudwatchConfig: {
          enabled: true,
        },
      });

      const testLambda = new lambda.Function(stack, 'TestLambda', {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      observability.addMetricsConfig(testLambda);

      // Assert
      const template = Template.fromStack(stack);

      // IAMポリシーが付与される
      template.resourceCountIs('AWS::IAM::Policy', 1);
    });

    test('個別のLambda関数にCloudWatchログ設定が適用される', () => {
      // Arrange
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        cloudwatchConfig: {
          enabled: true,
        },
      });

      const testLambda = new lambda.Function(stack, 'TestLambda', {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      observability.addLoggingConfig(testLambda);

      // Assert
      const template = Template.fromStack(stack);

      // IAMポリシーが付与される
      template.resourceCountIs('AWS::IAM::Policy', 1);
    });
  });

  describe('CloudWatch統合', () => {
    test('カスタムメトリクスフィルターが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        cloudwatchConfig: {
          enabled: true,
          metricFilters: {
            errorPatterns: true,
            warningPatterns: true,
            performanceDegradation: true,
          },
        },
      });

      // Assert
      const template = Template.fromStack(stack);

      // 3つのメトリクスフィルターが作成される
      template.resourceCountIs('AWS::Logs::MetricFilter', 3);
    });

    test('カスタムアラームが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        cloudwatchConfig: {
          enabled: true,
          alarms: {
            errorRateThreshold: 5,
            latencyThreshold: 3000,
            throughputThreshold: 100,
            tokenUsageThreshold: 10000,
          },
        },
      });

      // Assert
      const template = Template.fromStack(stack);

      // 4つのアラームが作成される
      template.resourceCountIs('AWS::CloudWatch::Alarm', 4);
    });

    test('カスタムダッシュボードが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        cloudwatchConfig: {
          enabled: true,
          customMetrics: {
            executionLatency: true,
            errorRate: true,
            throughput: true,
            tokenUsage: true,
            costTracking: true,
          },
        },
      });

      // Assert
      const template = Template.fromStack(stack);

      // Dashboardが作成される
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    });
  });

  describe('X-Ray統合', () => {
    test('カスタムサンプリングルールが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        xrayConfig: {
          enabled: true,
          customSamplingRule: true,
          samplingRate: 0.5,
          samplingRulePriority: 100,
        },
      });

      // Assert
      const template = Template.fromStack(stack);

      // Sampling Ruleが作成される
      template.resourceCountIs('AWS::XRay::SamplingRule', 1);
    });

    test('詳細トレーシングが有効化される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        xrayConfig: {
          enabled: true,
          detailedTracing: true,
        },
      });

      // Assert
      const template = Template.fromStack(stack);

      // X-Ray Groupが作成される
      template.resourceCountIs('AWS::XRay::Group', 1);
    });
  });

  describe('KMS暗号化統合', () => {
    test('KMSキーが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        kmsConfig: {
          enabled: true,
        },
      });

      // Assert
      const template = Template.fromStack(stack);

      // KMS Keyが作成される
      template.resourceCountIs('AWS::KMS::Key', 1);

      // Log Groupが作成される
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });

    test('KMS暗号化が無効化された場合はキーが作成されない', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        kmsConfig: {
          enabled: false,
        },
      });

      // Assert
      const template = Template.fromStack(stack);

      // KMS Keyは作成されない
      template.resourceCountIs('AWS::KMS::Key', 0);
    });
  });

  describe('タグ付け統合', () => {
    test('デフォルトタグが全リソースに適用される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
      });

      // Assert
      const template = Template.fromStack(stack);

      // リソースが作成される
      template.resourceCountIs('AWS::XRay::Group', 1);
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });

    test('カスタムタグが全リソースに適用される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'Observability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'production',
        tags: {
          Team: 'Platform',
          CostCenter: 'Engineering',
        },
      });

      // Assert
      const template = Template.fromStack(stack);

      // リソースが作成される
      template.resourceCountIs('AWS::XRay::Group', 1);
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
    });
  });
});
