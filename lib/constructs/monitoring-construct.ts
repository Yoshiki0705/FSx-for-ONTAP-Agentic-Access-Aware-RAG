/**
 * MonitoringConstruct
 *
 * CloudWatchダッシュボード、SNSアラート、EventBridge連携を提供するオプション機能。
 * enableMonitoring=true 時のみ DemoWebAppStack 内でインスタンス化される。
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface MonitoringConstructProps {
  projectName: string;
  environment: string;

  // 必須リソース参照
  webAppFunction: lambda.IFunction;
  distribution: cloudfront.IDistribution;
  userAccessTable: dynamodb.ITable;
  permissionCacheTable: dynamodb.ITable;

  // オプションリソース参照（条件付き機能）
  permissionFilterFunction?: lambda.IFunction;
  agentSchedulerFunction?: lambda.IFunction;
  adSyncFunction?: lambda.IFunction;

  // WAF（us-east-1のWebACL名 — メトリクス参照用）
  wafWebAclName?: string;

  // 設定パラメータ
  monitoringEmail?: string;
  enableAgentCoreObservability?: boolean;
  alarmEvaluationPeriods?: number;
  dashboardRefreshInterval?: number;
  /** Guardrail ID（enableGuardrails=true 時のみ設定） */
  guardrailId?: string;
  /** AgentCore Policy 有効化フラグ（enableAgentPolicy=true 時のみ設定） */
  enableAgentPolicy?: boolean;
}

export class MonitoringConstruct extends Construct {
  public readonly snsTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringConstructProps) {
    super(scope, id);

    const { projectName, environment } = props;
    const prefix = `${projectName}-${environment}`;

    // パラメータバリデーション
    const evaluationPeriods = (props.alarmEvaluationPeriods && props.alarmEvaluationPeriods > 0)
      ? props.alarmEvaluationPeriods : 1;
    const refreshInterval = (props.dashboardRefreshInterval && props.dashboardRefreshInterval > 0)
      ? props.dashboardRefreshInterval : 300;

    // ========================================
    // SNS Topic + Email Subscription
    // ========================================
    this.snsTopic = new sns.Topic(this, 'AlertsTopic', {
      topicName: `${prefix}-monitoring-alerts`,
      displayName: `${prefix} Monitoring Alerts`,
    });

    if (props.monitoringEmail) {
      this.snsTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(props.monitoringEmail),
      );
    }

    // ========================================
    // CloudWatch Alarms — コア
    // ========================================
    const alarmActions = [new cdk.aws_cloudwatch_actions.SnsAction(this.snsTopic)];

    // WebApp Lambda エラー率 > 5%
    const webAppErrorAlarm = new cloudwatch.Alarm(this, 'WebAppErrorRate', {
      alarmName: `${prefix}-webapp-error-rate`,
      metric: new cloudwatch.MathExpression({
        expression: '(errors / invocations) * 100',
        usingMetrics: {
          errors: props.webAppFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
          invocations: props.webAppFunction.metricInvocations({ period: cdk.Duration.minutes(5) }),
        },
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    webAppErrorAlarm.addAlarmAction(...alarmActions);
    webAppErrorAlarm.addOkAction(...alarmActions);

    // WebApp Lambda Duration P99 > 25,000ms
    const webAppP99Alarm = new cloudwatch.Alarm(this, 'WebAppP99Duration', {
      alarmName: `${prefix}-webapp-p99-duration`,
      metric: props.webAppFunction.metricDuration({
        period: cdk.Duration.minutes(5),
        statistic: 'p99',
      }),
      threshold: 25000,
      evaluationPeriods,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    webAppP99Alarm.addAlarmAction(...alarmActions);
    webAppP99Alarm.addOkAction(...alarmActions);

    // CloudFront 5xx エラー率 > 1%
    // Note: CloudFrontメトリクスはus-east-1にのみ存在するが、
    // クロスリージョンアラームはCDKで直接作成できないため、
    // region指定なしで作成する（ダッシュボードウィジェットでは可視化）
    const cf5xxAlarm = new cloudwatch.Alarm(this, 'CloudFront5xxRate', {
      alarmName: `${prefix}-cloudfront-5xx-rate`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CloudFront',
        metricName: '5xxErrorRate',
        dimensionsMap: {
          DistributionId: props.distribution.distributionId,
          Region: 'Global',
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 1,
      evaluationPeriods,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cf5xxAlarm.addAlarmAction(...alarmActions);
    cf5xxAlarm.addOkAction(...alarmActions);

    // DynamoDB スロットリング（user-access + perm-cache）
    for (const [label, table] of [
      ['UserAccess', props.userAccessTable],
      ['PermCache', props.permissionCacheTable],
    ] as const) {
      const throttleAlarm = new cloudwatch.Alarm(this, `DynamoDB${label}Throttle`, {
        alarmName: `${prefix}-dynamodb-${label.toLowerCase()}-throttle`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ThrottledRequests',
          dimensionsMap: { TableName: table.tableName },
          period: cdk.Duration.minutes(1),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      throttleAlarm.addAlarmAction(...alarmActions);
      throttleAlarm.addOkAction(...alarmActions);
    }

    // ========================================
    // CloudWatch Alarms — 条件付き
    // ========================================

    // Permission Filter Lambda エラー率 > 10%
    if (props.permissionFilterFunction) {
      const permFilterAlarm = new cloudwatch.Alarm(this, 'PermFilterErrorRate', {
        alarmName: `${prefix}-permfilter-error-rate`,
        metric: new cloudwatch.MathExpression({
          expression: '(errors / invocations) * 100',
          usingMetrics: {
            errors: props.permissionFilterFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
            invocations: props.permissionFilterFunction.metricInvocations({ period: cdk.Duration.minutes(5) }),
          },
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10,
        evaluationPeriods,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      permFilterAlarm.addAlarmAction(...alarmActions);
      permFilterAlarm.addOkAction(...alarmActions);
    }

    // Vision API タイムアウト率 > 20%（カスタムメトリクス）
    const visionTimeoutAlarm = new cloudwatch.Alarm(this, 'VisionApiTimeoutRate', {
      alarmName: `${prefix}-vision-api-timeout-rate`,
      metric: new cloudwatch.MathExpression({
        expression: '(timeouts / invocations) * 100',
        usingMetrics: {
          timeouts: new cloudwatch.Metric({
            namespace: 'PermissionAwareRAG/AdvancedFeatures',
            metricName: 'VisionApiTimeouts',
            dimensionsMap: { Operation: 'vision' },
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
          }),
          invocations: new cloudwatch.Metric({
            namespace: 'PermissionAwareRAG/AdvancedFeatures',
            metricName: 'VisionApiInvocations',
            dimensionsMap: { Operation: 'vision' },
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
          }),
        },
        period: cdk.Duration.minutes(5),
      }),
      threshold: 20,
      evaluationPeriods,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    visionTimeoutAlarm.addAlarmAction(...alarmActions);
    visionTimeoutAlarm.addOkAction(...alarmActions);

    // Agent 実行エラー率 > 10%（enableAgentCoreObservability時のみ）
    if (props.enableAgentCoreObservability) {
      const agentErrorAlarm = new cloudwatch.Alarm(this, 'AgentExecutionErrorRate', {
        alarmName: `${prefix}-agent-execution-error-rate`,
        metric: new cloudwatch.MathExpression({
          expression: '(errors / invocations) * 100',
          usingMetrics: {
            errors: new cloudwatch.Metric({
              namespace: 'AWS/BedrockAgentCore',
              metricName: 'Errors',
              period: cdk.Duration.minutes(5),
              statistic: 'Sum',
            }),
            invocations: new cloudwatch.Metric({
              namespace: 'AWS/BedrockAgentCore',
              metricName: 'Invocations',
              period: cdk.Duration.minutes(5),
              statistic: 'Sum',
            }),
          },
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10,
        evaluationPeriods,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      agentErrorAlarm.addAlarmAction(...alarmActions);
      agentErrorAlarm.addOkAction(...alarmActions);
    }

    // ========================================
    // EventBridge Rule — KB Ingestion Job 失敗通知
    // ========================================
    const kbIngestionRule = new events.Rule(this, 'KbIngestionFailedRule', {
      ruleName: `${prefix}-kb-ingestion-failed`,
      eventPattern: {
        source: ['aws.bedrock'],
        detailType: ['Bedrock Knowledge Base Ingestion Job State Change'],
        detail: { status: ['FAILED'] },
      },
    });
    kbIngestionRule.addTarget(new eventsTargets.SnsTopic(this.snsTopic));

    // ========================================
    // CloudWatch Dashboard
    // ========================================
    const dashboardName = `${prefix}-monitoring`;
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName,
      periodOverride: cloudwatch.PeriodOverride.AUTO,
      defaultInterval: cdk.Duration.seconds(refreshInterval),
    });

    // --- Lambda Overview ---
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({ markdown: '# Lambda Overview', width: 24, height: 1 }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'WebApp Lambda — Invocations & Errors',
        left: [
          props.webAppFunction.metricInvocations({ period: cdk.Duration.minutes(5) }),
          props.webAppFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'WebApp Lambda — Duration (P50/P99)',
        left: [
          props.webAppFunction.metricDuration({ period: cdk.Duration.minutes(5), statistic: 'p50' }),
          props.webAppFunction.metricDuration({ period: cdk.Duration.minutes(5), statistic: 'p99' }),
        ],
        width: 12,
      }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'WebApp Lambda — Concurrent Executions',
        left: [props.webAppFunction.metric('ConcurrentExecutions', { period: cdk.Duration.minutes(5), statistic: 'Maximum' })],
        width: 12,
      }),
    );

    // Optional Lambda widgets
    const optionalLambdaWidgets: cloudwatch.IWidget[] = [];
    if (props.permissionFilterFunction) {
      optionalLambdaWidgets.push(new cloudwatch.GraphWidget({
        title: 'Permission Filter Lambda',
        left: [
          props.permissionFilterFunction.metricInvocations({ period: cdk.Duration.minutes(5) }),
          props.permissionFilterFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
          props.permissionFilterFunction.metricDuration({ period: cdk.Duration.minutes(5), statistic: 'p99' }),
        ],
        width: 12,
      }));
    }
    if (props.agentSchedulerFunction) {
      optionalLambdaWidgets.push(new cloudwatch.GraphWidget({
        title: 'Agent Scheduler Lambda',
        left: [
          props.agentSchedulerFunction.metricInvocations({ period: cdk.Duration.minutes(5) }),
          props.agentSchedulerFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      }));
    }
    if (props.adSyncFunction) {
      optionalLambdaWidgets.push(new cloudwatch.GraphWidget({
        title: 'AD Sync Lambda',
        left: [
          props.adSyncFunction.metricInvocations({ period: cdk.Duration.minutes(5) }),
          props.adSyncFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      }));
    }
    if (optionalLambdaWidgets.length > 0) {
      this.dashboard.addWidgets(...optionalLambdaWidgets);
    }

    // --- CloudFront ---
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({ markdown: '# CloudFront', width: 24, height: 1 }),
    );
    const cfDims = { DistributionId: props.distribution.distributionId, Region: 'Global' };
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'CloudFront — Requests & Error Rates',
        left: [
          new cloudwatch.Metric({ namespace: 'AWS/CloudFront', metricName: 'Requests', dimensionsMap: cfDims, period: cdk.Duration.minutes(5), statistic: 'Sum', region: 'us-east-1' }),
          new cloudwatch.Metric({ namespace: 'AWS/CloudFront', metricName: '4xxErrorRate', dimensionsMap: cfDims, period: cdk.Duration.minutes(5), statistic: 'Average', region: 'us-east-1' }),
          new cloudwatch.Metric({ namespace: 'AWS/CloudFront', metricName: '5xxErrorRate', dimensionsMap: cfDims, period: cdk.Duration.minutes(5), statistic: 'Average', region: 'us-east-1' }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'CloudFront — Cache Hit Rate',
        left: [
          new cloudwatch.Metric({ namespace: 'AWS/CloudFront', metricName: 'CacheHitRate', dimensionsMap: cfDims, period: cdk.Duration.minutes(5), statistic: 'Average', region: 'us-east-1' }),
        ],
        width: 12,
      }),
    );

    // --- DynamoDB ---
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({ markdown: '# DynamoDB', width: 24, height: 1 }),
    );
    for (const [label, table] of [
      ['user-access', props.userAccessTable],
      ['perm-cache', props.permissionCacheTable],
    ] as const) {
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: `DynamoDB ${label} — Capacity`,
          left: [
            new cloudwatch.Metric({ namespace: 'AWS/DynamoDB', metricName: 'ConsumedReadCapacityUnits', dimensionsMap: { TableName: table.tableName }, period: cdk.Duration.minutes(5), statistic: 'Sum' }),
            new cloudwatch.Metric({ namespace: 'AWS/DynamoDB', metricName: 'ConsumedWriteCapacityUnits', dimensionsMap: { TableName: table.tableName }, period: cdk.Duration.minutes(5), statistic: 'Sum' }),
          ],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: `DynamoDB ${label} — Throttling`,
          left: [
            new cloudwatch.Metric({ namespace: 'AWS/DynamoDB', metricName: 'ThrottledRequests', dimensionsMap: { TableName: table.tableName }, period: cdk.Duration.minutes(1), statistic: 'Sum' }),
          ],
          width: 12,
        }),
      );
    }

    // --- Bedrock ---
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({ markdown: '# Bedrock', width: 24, height: 1 }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Bedrock — API Invocations',
        left: [
          new cloudwatch.Metric({ namespace: 'AWS/Bedrock', metricName: 'Invocations', period: cdk.Duration.minutes(5), statistic: 'Sum' }),
          new cloudwatch.Metric({ namespace: 'AWS/Bedrock', metricName: 'InvocationLatency', period: cdk.Duration.minutes(5), statistic: 'Average' }),
        ],
        width: 12,
      }),
    );

    // --- WAF ---
    if (props.wafWebAclName) {
      this.dashboard.addWidgets(
        new cloudwatch.TextWidget({ markdown: '# WAF', width: 24, height: 1 }),
      );
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'WAF — Blocked Requests',
          left: [
            new cloudwatch.Metric({ namespace: 'AWS/WAFV2', metricName: 'BlockedRequests', dimensionsMap: { WebACL: props.wafWebAclName, Rule: 'ALL', Region: 'us-east-1' }, period: cdk.Duration.minutes(5), statistic: 'Sum', region: 'us-east-1' }),
          ],
          width: 12,
        }),
      );
    }

    // --- Advanced RAG Features ---
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({ markdown: '# Advanced RAG Features', width: 24, height: 1 }),
    );
    const advNs = 'PermissionAwareRAG/AdvancedFeatures';
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Vision API — Invocations & Timeouts',
        left: [
          new cloudwatch.Metric({ namespace: advNs, metricName: 'VisionApiInvocations', dimensionsMap: { Operation: 'vision' }, period: cdk.Duration.minutes(5), statistic: 'Sum' }),
          new cloudwatch.Metric({ namespace: advNs, metricName: 'VisionApiTimeouts', dimensionsMap: { Operation: 'vision' }, period: cdk.Duration.minutes(5), statistic: 'Sum' }),
          new cloudwatch.Metric({ namespace: advNs, metricName: 'VisionApiFallbacks', dimensionsMap: { Operation: 'vision' }, period: cdk.Duration.minutes(5), statistic: 'Sum' }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Vision API — Latency',
        left: [
          new cloudwatch.Metric({ namespace: advNs, metricName: 'VisionApiLatency', dimensionsMap: { Operation: 'vision' }, period: cdk.Duration.minutes(5), statistic: 'Average' }),
        ],
        width: 12,
      }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Smart Routing — Model Selection',
        left: [
          new cloudwatch.Metric({ namespace: advNs, metricName: 'SmartRoutingSimple', dimensionsMap: { Operation: 'routing' }, period: cdk.Duration.minutes(5), statistic: 'Sum' }),
          new cloudwatch.Metric({ namespace: advNs, metricName: 'SmartRoutingComplex', dimensionsMap: { Operation: 'routing' }, period: cdk.Duration.minutes(5), statistic: 'Sum' }),
          new cloudwatch.Metric({ namespace: advNs, metricName: 'SmartRoutingAutoSelect', dimensionsMap: { Operation: 'routing' }, period: cdk.Duration.minutes(5), statistic: 'Sum' }),
          new cloudwatch.Metric({ namespace: advNs, metricName: 'SmartRoutingManualOverride', dimensionsMap: { Operation: 'routing' }, period: cdk.Duration.minutes(5), statistic: 'Sum' }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'KB Connection Management',
        left: [
          new cloudwatch.Metric({ namespace: advNs, metricName: 'KbAssociateInvocations', dimensionsMap: { Operation: 'kb-mgmt' }, period: cdk.Duration.minutes(5), statistic: 'Sum' }),
          new cloudwatch.Metric({ namespace: advNs, metricName: 'KbDisassociateInvocations', dimensionsMap: { Operation: 'kb-mgmt' }, period: cdk.Duration.minutes(5), statistic: 'Sum' }),
          new cloudwatch.Metric({ namespace: advNs, metricName: 'KbMgmtErrors', dimensionsMap: { Operation: 'kb-mgmt' }, period: cdk.Duration.minutes(5), statistic: 'Sum' }),
        ],
        width: 12,
      }),
    );

    // --- AgentCore（条件付き） ---
    if (props.enableAgentCoreObservability) {
      this.dashboard.addWidgets(
        new cloudwatch.TextWidget({ markdown: '# AgentCore', width: 24, height: 1 }),
      );
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'AgentCore — Invocations & Errors',
          left: [
            new cloudwatch.Metric({ namespace: 'AWS/BedrockAgentCore', metricName: 'Invocations', period: cdk.Duration.minutes(5), statistic: 'Sum' }),
            new cloudwatch.Metric({ namespace: 'AWS/BedrockAgentCore', metricName: 'Errors', period: cdk.Duration.minutes(5), statistic: 'Sum' }),
          ],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'AgentCore — Latency & Memory',
          left: [
            new cloudwatch.Metric({ namespace: 'AWS/BedrockAgentCore', metricName: 'Latency', period: cdk.Duration.minutes(5), statistic: 'Average' }),
          ],
          right: [
            new cloudwatch.Metric({ namespace: 'AWS/BedrockAgentCore', metricName: 'MemoryEvents', period: cdk.Duration.minutes(5), statistic: 'Sum' }),
            new cloudwatch.Metric({ namespace: 'AWS/BedrockAgentCore', metricName: 'MemorySessions', period: cdk.Duration.minutes(5), statistic: 'Sum' }),
          ],
          width: 12,
        }),
      );
    }

    // --- Guardrails（条件付き） ---
    if (props.guardrailId) {
      const grNs = 'PermissionAwareRAG/Guardrails';
      const grDims = { Operation: 'guardrails' };

      this.dashboard.addWidgets(
        new cloudwatch.TextWidget({ markdown: '# Guardrails', width: 24, height: 1 }),
      );
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Guardrails — Input Blocked',
          left: [
            new cloudwatch.Metric({ namespace: grNs, metricName: 'GuardrailsInputBlocked', dimensionsMap: grDims, statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          ],
          width: 8, height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: 'Guardrails — Output Filtered',
          left: [
            new cloudwatch.Metric({ namespace: grNs, metricName: 'GuardrailsOutputFiltered', dimensionsMap: grDims, statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          ],
          width: 8, height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: 'Guardrails — Passthrough',
          left: [
            new cloudwatch.Metric({ namespace: grNs, metricName: 'GuardrailsPassthrough', dimensionsMap: grDims, statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          ],
          width: 8, height: 6,
        }),
      );

      // Guardrails Intervention Rate Alarm (> 10%)
      const guardrailsInterventionAlarm = new cloudwatch.Alarm(this, 'GuardrailsInterventionRate', {
        alarmName: `${prefix}-guardrails-intervention-rate`,
        metric: new cloudwatch.MathExpression({
          expression: '((blocked + filtered) / (blocked + filtered + passed)) * 100',
          usingMetrics: {
            blocked: new cloudwatch.Metric({ namespace: grNs, metricName: 'GuardrailsInputBlocked', dimensionsMap: grDims, statistic: 'Sum', period: cdk.Duration.minutes(5) }),
            filtered: new cloudwatch.Metric({ namespace: grNs, metricName: 'GuardrailsOutputFiltered', dimensionsMap: grDims, statistic: 'Sum', period: cdk.Duration.minutes(5) }),
            passed: new cloudwatch.Metric({ namespace: grNs, metricName: 'GuardrailsPassthrough', dimensionsMap: grDims, statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          },
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10,
        evaluationPeriods,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      guardrailsInterventionAlarm.addAlarmAction(...alarmActions);
      guardrailsInterventionAlarm.addOkAction(...alarmActions);
    }

    // --- AgentCore Policy（条件付き） ---
    if (props.enableAgentPolicy) {
      const policyNs = 'PermissionAwareRAG/AgentPolicy';
      this.dashboard.addWidgets(
        new cloudwatch.TextWidget({ markdown: '# AgentCore Policy', width: 24, height: 1 }),
      );
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Policy — Evaluation Count',
          left: [
            new cloudwatch.Metric({ namespace: policyNs, metricName: 'PolicyEvaluationCount', statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          ],
          width: 8, height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: 'Policy — Violation Count',
          left: [
            new cloudwatch.Metric({ namespace: policyNs, metricName: 'PolicyViolationCount', statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          ],
          width: 8, height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: 'Policy — Evaluation Latency',
          left: [
            new cloudwatch.Metric({ namespace: policyNs, metricName: 'PolicyEvaluationLatency', statistic: 'Average', period: cdk.Duration.minutes(5) }),
          ],
          width: 8, height: 6,
        }),
      );
    }

    // --- KB Ingestion ---
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({ markdown: '# KB Ingestion Jobs', width: 24, height: 1 }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
        title: 'KB Ingestion Job History',
        logGroupNames: ['/aws/events/bedrock'],
        queryLines: [
          'fields @timestamp, detail.knowledgeBaseId, detail.dataSourceId, detail.status',
          'filter source = "aws.bedrock"',
          'sort @timestamp desc',
          'limit 20',
        ],
        width: 24,
        height: 6,
      }),
    );

    // ========================================
    // CloudFormation出力
    // ========================================
    const stack = cdk.Stack.of(this);
    new cdk.CfnOutput(stack, 'DashboardUrl', {
      value: `https://${cdk.Aws.REGION}.console.aws.amazon.com/cloudwatch/home#dashboards:name=${dashboardName}`,
    });
    new cdk.CfnOutput(stack, 'SnsTopicArn', {
      value: this.snsTopic.topicArn,
    });
    new cdk.CfnOutput(stack, 'MonitoringEnabled', {
      value: 'true',
    });
  }
}
