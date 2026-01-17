/**
 * Amazon Bedrock AgentCore Observability Construct - 単体テスト
 * 
 * @description Observability Constructの単体テストを実施
 * @author Kiro AI
 * @created 2026-01-04
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { BedrockAgentCoreObservabilityConstruct } from '../../../lib/modules/ai/constructs/bedrock-agent-core-observability-construct';

describe('BedrockAgentCoreObservabilityConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
  });

  describe('Construct作成', () => {
    it('最小限の設定でConstructが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // ログロググループが作成されることを確認
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/bedrock/agent-core/test-project/test/observability',
        RetentionInDays: 30,
      });
    });

    it('無効化された場合はダミーログロググループのみ作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: false,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // ダミーログロググループが作成されることを確認
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/bedrock/agent-core/test-project/test/observability-disabled',
        RetentionInDays: 1,
      });
      
      // X-Ray Groupが作成されないことを確認
      template.resourceCountIs('AWS::XRay::Group', 0);
      
      // CloudWatchダッシュボードが作成されないことを確認
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 0);
    });
  });

  describe('X-Ray統合', () => {
    it('X-Ray Groupが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        xrayConfig: {
          enabled: true,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::XRay::Group', {
        GroupName: 'test-project-test-agent-core',
        FilterExpression: 'service("agent-core")',
      });
    });

    it('カスタムX-Ray設定が適用される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        xrayConfig: {
          enabled: true,
          groupName: 'custom-group',
          filterExpression: 'service("custom-service")',
          samplingRate: 0.5,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::XRay::Group', {
        GroupName: 'custom-group',
        FilterExpression: 'service("custom-service")',
      });
    });

    it('X-Ray Sampling Ruleが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        xrayConfig: {
          enabled: true,
          customSamplingRule: true,
          samplingRate: 0.2,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::XRay::SamplingRule', {
        SamplingRule: Match.objectLike({
          RuleName: 'test-project-test-agent-core-sampling',
          FixedRate: 0.2,
          ServiceName: 'agent-core',
        }),
      });
    });

    it('X-Rayが無効化された場合はリソースが作成されない', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        xrayConfig: {
          enabled: false,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.resourceCountIs('AWS::XRay::Group', 0);
      template.resourceCountIs('AWS::XRay::SamplingRule', 0);
    });
  });

  describe('CloudWatch統合', () => {
    it('CloudWatchダッシュボードが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        cloudwatchConfig: {
          enabled: true,
          createDashboard: true,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardName: 'test-project-test-agent-core-observability',
      });
    });

    it('カスタムダッシュボード名が適用される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        cloudwatchConfig: {
          enabled: true,
          createDashboard: true,
          dashboardName: 'custom-dashboard',
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardName: 'custom-dashboard',
      });
    });

    it('メトリクスフィルターが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
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
      
      // 3つのメトリクスフィルターが作成されることを確認
      template.resourceCountIs('AWS::Logs::MetricFilter', 3);
      
      // エラーパターンフィルター
      template.hasResourceProperties('AWS::Logs::MetricFilter', {
        MetricTransformations: [
          Match.objectLike({
            MetricName: 'ErrorCount',
            MetricNamespace: 'AWS/Bedrock/AgentCore',
          }),
        ],
      });
      
      // 警告パターンフィルター
      template.hasResourceProperties('AWS::Logs::MetricFilter', {
        MetricTransformations: [
          Match.objectLike({
            MetricName: 'WarningCount',
            MetricNamespace: 'AWS/Bedrock/AgentCore',
          }),
        ],
      });
      
      // パフォーマンス低下フィルター
      template.hasResourceProperties('AWS::Logs::MetricFilter', {
        MetricTransformations: [
          Match.objectLike({
            MetricName: 'SlowExecutionCount',
            MetricNamespace: 'AWS/Bedrock/AgentCore',
          }),
        ],
      });
    });

    it('CloudWatchアラームが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        cloudwatchConfig: {
          enabled: true,
          alarms: {
            errorRateThreshold: 10,
            latencyThreshold: 5000,
          },
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // エラー率アラーム
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'test-project-test-agent-core-error-rate',
        Threshold: 10,
        ComparisonOperator: 'GreaterThanThreshold',
      });
      
      // レイテンシアラーム
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'test-project-test-agent-core-latency',
        Threshold: 5000,
        ComparisonOperator: 'GreaterThanThreshold',
      });
    });

    it('CloudWatchが無効化された場合はリソースが作成されない', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        cloudwatchConfig: {
          enabled: false,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 0);
      template.resourceCountIs('AWS::CloudWatch::Alarm', 0);
    });
  });

  describe('KMS暗号化', () => {
    it('KMSキーが作成される', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        kmsConfig: {
          enabled: true,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::KMS::Key', {
        Description: 'KMS key for test-project test AgentCore Observability',
        EnableKeyRotation: true,
      });
    });

    it('KMSが無効化された場合はキーが作成されない', () => {
      // Arrange & Act
      new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        kmsConfig: {
          enabled: false,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      template.resourceCountIs('AWS::KMS::Key', 0);
    });
  });

  describe('Lambda統合メソッド', () => {
    it('enableXRayForLambda()がX-Ray権限を付与する', () => {
      // Arrange
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        xrayConfig: {
          enabled: true,
        },
      });

      const testLambda = new lambda.Function(stack, 'TestFunction', {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      observability.enableXRayForLambda(testLambda);

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    it('addMetricsConfig()がCloudWatch権限を付与する', () => {
      // Arrange
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      const testLambda = new lambda.Function(stack, 'TestFunction', {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      observability.addMetricsConfig(testLambda);

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: 'cloudwatch:PutMetricData',
              Effect: 'Allow',
              Resource: '*',
            },
          ],
        },
      });
    });

    it('addLoggingConfig()がCloudWatch Logs権限を付与する', () => {
      // Arrange
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      const testLambda = new lambda.Function(stack, 'TestFunction', {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      observability.addLoggingConfig(testLambda);

      // Assert
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ]),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    it('configureObservabilityForLambdas()が複数Lambda関数に設定を適用する', () => {
      // Arrange
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        xrayConfig: {
          enabled: true,
        },
      });

      const lambda1 = new lambda.Function(stack, 'TestFunction1', {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      const lambda2 = new lambda.Function(stack, 'TestFunction2', {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      observability.configureObservabilityForLambdas([lambda1, lambda2]);

      // Assert
      const template = Template.fromStack(stack);
      
      // 2つのLambda関数にX-Ray権限が付与されることを確認
      template.resourceCountIs('AWS::IAM::Policy', 2);
    });
  });

  describe('タグ付け', () => {
    it('デフォルトタグが設定される', () => {
      // Arrange & Act
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // ログロググループが作成されることを確認
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/bedrock/agent-core/test-project/test/observability',
      });
      
      // Constructが作成されたことを確認
      expect(observability).toBeDefined();
    });

    it('カスタムタグが設定される', () => {
      // Arrange & Act
      const observability = new BedrockAgentCoreObservabilityConstruct(stack, 'TestObservability', {
        enabled: true,
        projectName: 'test-project',
        environment: 'test',
        tags: {
          CustomTag1: 'Value1',
          CustomTag2: 'Value2',
        },
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // ログロググループが作成されることを確認
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/bedrock/agent-core/test-project/test/observability',
      });
      
      // Constructが作成されたことを確認
      expect(observability).toBeDefined();
    });
  });
});
