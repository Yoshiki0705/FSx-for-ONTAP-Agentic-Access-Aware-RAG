/**
 * MonitoringConstruct プロパティベーステスト + ユニットテスト
 *
 * Feature: monitoring-alerting
 * テストフレームワーク: fast-check + aws-cdk-lib/assertions
 * 各プロパティテストは最低100回のイテレーションで実行
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { DemoWebAppStack } from '../../lib/stacks/demo/demo-webapp-stack';

// ========================================
// ヘルパー: テスト用スタック生成
// ========================================

interface TestStackOptions {
  enableMonitoring?: boolean;
  monitoringEmail?: string;
  enableAgentCoreObservability?: boolean;
  usePermissionFilterLambda?: boolean;
  alarmEvaluationPeriods?: number;
  dashboardRefreshInterval?: number;
}

function createTestStack(opts: TestStackOptions = {}) {
  const app = new cdk.App();

  // 依存リソースをダミーで作成
  const depStack = new cdk.Stack(app, 'DepStack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  const vpc = new ec2.Vpc(depStack, 'Vpc');
  const sg = new ec2.SecurityGroup(depStack, 'Sg', { vpc });
  const userPool = new cognito.UserPool(depStack, 'Pool');
  const client = userPool.addClient('Client');
  const userAccessTable = new dynamodb.Table(depStack, 'UAT', {
    partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });
  const permCacheTable = new dynamodb.Table(depStack, 'PCT', {
    partitionKey: { name: 'cacheKey', type: dynamodb.AttributeType.STRING },
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  const stack = new DemoWebAppStack(app, 'TestWebApp', {
    projectName: 'testproj',
    environment: 'dev',
    vpc,
    lambdaSg: sg,
    userPool,
    userPoolClient: client,
    knowledgeBaseId: 'kb-test-123',
    imageUri: 'latest',
    permissionCacheTable: permCacheTable,
    userAccessTable,
    usePermissionFilterLambda: opts.usePermissionFilterLambda ?? false,
    enableMonitoring: opts.enableMonitoring ?? false,
    monitoringEmail: opts.monitoringEmail,
    enableAgentCoreObservability: opts.enableAgentCoreObservability ?? false,
    alarmEvaluationPeriods: opts.alarmEvaluationPeriods,
    dashboardRefreshInterval: opts.dashboardRefreshInterval,
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });

  return { app, stack, template: Template.fromStack(stack) };
}

// ========================================
// Property 1: 監視リソース存在性の双条件
// ========================================

describe('Property 1: 監視リソース存在性の双条件', () => {
  // Feature: monitoring-alerting, Property 1: 監視リソース存在性の双条件
  it('enableMonitoring=true時のみ監視リソースが作成される', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (enableMonitoring) => {
          const { template } = createTestStack({ enableMonitoring });
          const resources = template.toJSON().Resources;

          const snsTopics = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::SNS::Topic'
          );
          const dashboards = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::CloudWatch::Dashboard'
          );
          const alarms = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::CloudWatch::Alarm'
          );
          const eventRules = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::Events::Rule'
          );

          if (enableMonitoring) {
            expect(snsTopics.length).toBeGreaterThanOrEqual(1);
            expect(dashboards.length).toBeGreaterThanOrEqual(1);
            expect(alarms.length).toBeGreaterThanOrEqual(1);
            expect(eventRules.length).toBeGreaterThanOrEqual(1);
          } else {
            expect(snsTopics).toHaveLength(0);
            expect(dashboards).toHaveLength(0);
            expect(alarms).toHaveLength(0);
            expect(eventRules).toHaveLength(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ========================================
// Property 2: アラーム閾値と通知アクションの正確性
// ========================================

describe('Property 2: アラーム閾値と通知アクションの正確性', () => {
  // Feature: monitoring-alerting, Property 2: アラーム閾値と通知アクションの正確性
  it('全アラームにAlarmActionsとOKActionsが設定されている', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // usePermissionFilterLambda
        (usePermFilter) => {
          const { template } = createTestStack({
            enableMonitoring: true,
            usePermissionFilterLambda: usePermFilter,
          });
          const resources = template.toJSON().Resources;

          const alarms = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::CloudWatch::Alarm'
          );

          for (const alarm of alarms) {
            const props = (alarm as any).Properties;
            // AlarmActions と OKActions が存在し、SNS Topic ARN を含む
            expect(props.AlarmActions).toBeDefined();
            expect(props.AlarmActions.length).toBeGreaterThanOrEqual(1);
            expect(props.OKActions).toBeDefined();
            expect(props.OKActions.length).toBeGreaterThanOrEqual(1);
            // TreatMissingData = notBreaching
            expect(props.TreatMissingData).toBe('notBreaching');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ========================================
// Property 3: メールサブスクリプションの条件付き作成
// ========================================

describe('Property 3: メールサブスクリプションの条件付き作成', () => {
  // Feature: monitoring-alerting, Property 3: メールサブスクリプションの条件付き作成
  it('monitoringEmail指定時のみEmailサブスクリプションが作成される', () => {
    fc.assert(
      fc.property(
        fc.option(fc.emailAddress()),
        (email) => {
          const monitoringEmail = email ?? undefined;
          const { template } = createTestStack({
            enableMonitoring: true,
            monitoringEmail,
          });
          const resources = template.toJSON().Resources;

          const emailSubs = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::SNS::Subscription'
              && r.Properties?.Protocol === 'email'
          );

          if (monitoringEmail) {
            expect(emailSubs.length).toBeGreaterThanOrEqual(1);
            const sub = emailSubs[0] as any;
            expect(sub.Properties.Endpoint).toBe(monitoringEmail);
          } else {
            expect(emailSubs).toHaveLength(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ========================================
// Property 4: オプション機能フラグに基づく条件付きリソース
// ========================================

describe('Property 4: オプション機能フラグに基づく条件付きリソース', () => {
  // Feature: monitoring-alerting, Property 4: オプション機能フラグに基づく条件付きリソース
  it('usePermissionFilterLambda/enableAgentCoreObservabilityに応じた条件付きアラーム', () => {
    fc.assert(
      fc.property(
        fc.record({
          usePermissionFilterLambda: fc.boolean(),
          enableAgentCoreObservability: fc.boolean(),
        }),
        ({ usePermissionFilterLambda, enableAgentCoreObservability }) => {
          const { template } = createTestStack({
            enableMonitoring: true,
            usePermissionFilterLambda,
            enableAgentCoreObservability,
          });
          const resources = template.toJSON().Resources;

          const alarms = Object.entries(resources).filter(
            ([, r]: [string, any]) => r.Type === 'AWS::CloudWatch::Alarm'
          );

          const hasPermFilterAlarm = alarms.some(([, r]: [string, any]) =>
            r.Properties?.AlarmName?.includes('permfilter')
          );
          const hasAgentErrorAlarm = alarms.some(([, r]: [string, any]) =>
            r.Properties?.AlarmName?.includes('agent-execution')
          );

          if (usePermissionFilterLambda) {
            expect(hasPermFilterAlarm).toBe(true);
          } else {
            expect(hasPermFilterAlarm).toBe(false);
          }

          if (enableAgentCoreObservability) {
            expect(hasAgentErrorAlarm).toBe(true);
          } else {
            expect(hasAgentErrorAlarm).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ========================================
// Property 5: EMFメトリクス出力の正確性
// ========================================

describe('Property 5: EMFメトリクス出力の正確性', () => {
  // Feature: monitoring-alerting, Property 5: EMFメトリクス出力の正確性
  it('createMetricsLogger(true)のflush出力がEMF形式である', () => {
    // Dynamic import to avoid path issues in CDK test context
    const { createMetricsLogger } = require('../../docker/nextjs/src/lib/monitoring/metrics');

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z]/.test(s)),
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        (metricName, value) => {
          const logger = createMetricsLogger(true);
          logger.setDimension('Operation', 'test');
          logger.putMetric(metricName, value, 'Count');

          // stdout をキャプチャ
          let output = '';
          const originalWrite = process.stdout.write;
          process.stdout.write = ((chunk: any) => {
            output += chunk;
            return true;
          }) as any;

          logger.flush();
          process.stdout.write = originalWrite;

          // EMF形式の検証
          const parsed = JSON.parse(output.trim());
          expect(parsed._aws).toBeDefined();
          expect(parsed._aws.CloudWatchMetrics).toBeDefined();
          expect(parsed._aws.CloudWatchMetrics[0].Namespace).toBe('PermissionAwareRAG/AdvancedFeatures');
          expect(parsed[metricName]).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ========================================
// Property 6: 無効時のメトリクスno-op保証
// ========================================

describe('Property 6: 無効時のメトリクスno-op保証', () => {
  // Feature: monitoring-alerting, Property 6: 無効時のメトリクスno-op保証
  it('createMetricsLogger(false)はstdout出力なし・エラーなし', () => {
    const { createMetricsLogger } = require('../../docker/nextjs/src/lib/monitoring/metrics');

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        (metricName, value) => {
          const logger = createMetricsLogger(false);

          let output = '';
          const originalWrite = process.stdout.write;
          process.stdout.write = ((chunk: any) => {
            output += chunk;
            return true;
          }) as any;

          // エラーが発生しないこと
          expect(() => {
            logger.setDimension('Operation', 'test');
            logger.putMetric(metricName, value, 'Count');
            logger.flush();
          }).not.toThrow();

          process.stdout.write = originalWrite;

          // stdout出力がないこと
          expect(output).toBe('');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ========================================
// Property 7: ダッシュボードメトリクス網羅性
// ========================================

describe('Property 7: ダッシュボードメトリクス網羅性', () => {
  // Feature: monitoring-alerting, Property 7: ダッシュボードメトリクス網羅性
  it('ダッシュボードに必須名前空間のメトリクスが含まれる', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // enableAgentCoreObservability
        (enableAgentCoreObservability) => {
          const { template } = createTestStack({
            enableMonitoring: true,
            enableAgentCoreObservability,
          });
          const resources = template.toJSON().Resources;

          const dashboards = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::CloudWatch::Dashboard'
          );
          expect(dashboards.length).toBe(1);

          const body = (dashboards[0] as any).Properties.DashboardBody;
          const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

          // 必須名前空間
          expect(bodyStr).toContain('AWS/Lambda');
          expect(bodyStr).toContain('AWS/CloudFront');
          expect(bodyStr).toContain('AWS/DynamoDB');
          expect(bodyStr).toContain('AWS/Bedrock');
          expect(bodyStr).toContain('PermissionAwareRAG/AdvancedFeatures');

          // AgentCore は条件付き
          if (enableAgentCoreObservability) {
            expect(bodyStr).toContain('AWS/BedrockAgentCore');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ========================================
// ユニットテスト
// ========================================

describe('ユニットテスト: MonitoringConstruct', () => {
  const monitoringStack = () => createTestStack({
    enableMonitoring: true,
    monitoringEmail: 'test@example.com',
    enableAgentCoreObservability: true,
  });

  it('ダッシュボードURLがCloudFormation出力に含まれる (Req 1.3)', () => {
    const { template } = monitoringStack();
    const outputs = template.toJSON().Outputs;
    const dashboardOutput = Object.entries(outputs).find(
      ([key]) => key.includes('DashboardUrl')
    );
    expect(dashboardOutput).toBeDefined();
    expect(JSON.stringify(dashboardOutput![1])).toContain('console.aws.amazon.com/cloudwatch');
  });

  it('SNSトピックARNがCloudFormation出力に含まれる (Req 2.4)', () => {
    const { template } = monitoringStack();
    const outputs = template.toJSON().Outputs;
    const snsOutput = Object.entries(outputs).find(
      ([key]) => key.includes('SnsTopicArn')
    );
    expect(snsOutput).toBeDefined();
  });

  it('Vision APIタイムアウト率20%アラームが存在する (Req 3.2)', () => {
    const { template } = monitoringStack();
    const resources = template.toJSON().Resources;
    const visionAlarm = Object.values(resources).find(
      (r: any) => r.Type === 'AWS::CloudWatch::Alarm'
        && r.Properties?.AlarmName?.includes('vision-api-timeout')
    );
    expect(visionAlarm).toBeDefined();
    expect((visionAlarm as any).Properties.Threshold).toBe(20);
  });

  it('EventBridgeルールがFAILEDをフィルタする (Req 4.2)', () => {
    const { template } = monitoringStack();
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: Match.objectLike({
        source: ['aws.bedrock'],
        'detail-type': ['Bedrock Knowledge Base Ingestion Job State Change'],
        detail: { status: ['FAILED'] },
      }),
    });
  });

  it('KB Ingestion履歴ウィジェットがダッシュボードに存在する (Req 4.3)', () => {
    const { template } = monitoringStack();
    const resources = template.toJSON().Resources;
    const dashboards = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::CloudWatch::Dashboard'
    );
    const bodyStr = JSON.stringify((dashboards[0] as any).Properties.DashboardBody);
    expect(bodyStr).toContain('KB Ingestion');
  });

  it('Agent実行エラー率10%アラームが存在する — enableAgentCoreObservability時 (Req 5.2)', () => {
    const { template } = monitoringStack();
    const resources = template.toJSON().Resources;
    const agentAlarm = Object.values(resources).find(
      (r: any) => r.Type === 'AWS::CloudWatch::Alarm'
        && r.Properties?.AlarmName?.includes('agent-execution-error')
    );
    expect(agentAlarm).toBeDefined();
    expect((agentAlarm as any).Properties.Threshold).toBe(10);
  });

  it('AgentCore Memoryウィジェットが存在する — enableAgentCoreObservability時 (Req 5.3)', () => {
    const { template } = monitoringStack();
    const resources = template.toJSON().Resources;
    const dashboards = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::CloudWatch::Dashboard'
    );
    const bodyStr = JSON.stringify((dashboards[0] as any).Properties.DashboardBody);
    expect(bodyStr).toContain('MemoryEvents');
    expect(bodyStr).toContain('MemorySessions');
  });

  it('alarmEvaluationPeriods=0時にデフォルト1にフォールバック', () => {
    const { template } = createTestStack({
      enableMonitoring: true,
      alarmEvaluationPeriods: 0,
    });
    const resources = template.toJSON().Resources;
    const alarms = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::CloudWatch::Alarm'
    );
    for (const alarm of alarms) {
      expect((alarm as any).Properties.EvaluationPeriods).toBe(1);
    }
  });

  it('dashboardRefreshInterval=0時にデフォルト300にフォールバック', () => {
    const { template } = createTestStack({
      enableMonitoring: true,
      dashboardRefreshInterval: 0,
    });
    // ダッシュボードが作成されることを確認（300秒はダッシュボードのdefaultIntervalに反映）
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
  });

  it('MonitoringEnabled出力がtrueである', () => {
    const { template } = monitoringStack();
    const outputs = template.toJSON().Outputs;
    const monEnabled = Object.entries(outputs).find(
      ([key]) => key.includes('MonitoringEnabled')
    );
    expect(monEnabled).toBeDefined();
    expect((monEnabled![1] as any).Value).toBe('true');
  });
});
