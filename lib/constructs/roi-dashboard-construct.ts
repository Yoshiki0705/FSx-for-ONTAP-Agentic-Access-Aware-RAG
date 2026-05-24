/**
 * RoiDashboardConstruct (#10, #3)
 *
 * ROI自動計測 + 顧客向けダッシュボードを CloudWatch Dashboard で実現。
 * 利用状況、回答品質、コスト推移を可視化する。
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface RoiDashboardConstructProps {
  projectName: string;
  environment: string;
  /** WebApp Lambda 関数名 */
  webAppFunctionName: string;
}

export class RoiDashboardConstruct extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: RoiDashboardConstructProps) {
    super(scope, id);

    const prefix = `${props.projectName}-${props.environment}`;

    this.dashboard = new cloudwatch.Dashboard(this, 'RoiDashboard', {
      dashboardName: `${prefix}-roi-metrics`,
      periodOverride: cloudwatch.PeriodOverride.AUTO,
    });

    // --- Row 1: Usage Overview ---
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# ${prefix} — ROI & Usage Dashboard\nUpdated automatically. Share this dashboard URL with stakeholders.`,
        width: 24,
        height: 1,
      }),
    );

    this.dashboard.addWidgets(
      // Daily query count
      new cloudwatch.GraphWidget({
        title: 'Daily Query Count',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Invocations',
            dimensionsMap: { FunctionName: props.webAppFunctionName },
            statistic: 'Sum',
            period: cdk.Duration.days(1),
          }),
        ],
        width: 8,
        height: 6,
      }),
      // Smart Routing distribution
      new cloudwatch.GraphWidget({
        title: 'Smart Routing Distribution',
        left: [
          new cloudwatch.Metric({
            namespace: 'SmartRouting',
            metricName: 'RoutingCount',
            dimensionsMap: { RoutingTier: 'simple' },
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
            label: 'Simple (Haiku)',
          }),
          new cloudwatch.Metric({
            namespace: 'SmartRouting',
            metricName: 'RoutingCount',
            dimensionsMap: { RoutingTier: 'complex' },
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
            label: 'Complex (Sonnet)',
          }),
          new cloudwatch.Metric({
            namespace: 'SmartRouting',
            metricName: 'RoutingCount',
            dimensionsMap: { RoutingTier: 'full-context' },
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
            label: 'Full-context (Opus)',
          }),
        ],
        width: 8,
        height: 6,
      }),
      // User feedback
      new cloudwatch.GraphWidget({
        title: 'User Feedback (👍/👎)',
        left: [
          new cloudwatch.Metric({
            namespace: 'RAGFeedback',
            metricName: 'FeedbackCount',
            dimensionsMap: { Rating: 'positive' },
            statistic: 'Sum',
            period: cdk.Duration.days(1),
            label: '👍 Positive',
          }),
          new cloudwatch.Metric({
            namespace: 'RAGFeedback',
            metricName: 'FeedbackCount',
            dimensionsMap: { Rating: 'negative' },
            statistic: 'Sum',
            period: cdk.Duration.days(1),
            label: '👎 Negative',
          }),
        ],
        width: 8,
        height: 6,
      }),
    );

    // --- Row 2: Performance & Security ---
    this.dashboard.addWidgets(
      // Response time
      new cloudwatch.GraphWidget({
        title: 'Response Time (P50/P95/P99)',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            dimensionsMap: { FunctionName: props.webAppFunctionName },
            statistic: 'p50',
            period: cdk.Duration.hours(1),
            label: 'P50',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            dimensionsMap: { FunctionName: props.webAppFunctionName },
            statistic: 'p95',
            period: cdk.Duration.hours(1),
            label: 'P95',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            dimensionsMap: { FunctionName: props.webAppFunctionName },
            statistic: 'p99',
            period: cdk.Duration.hours(1),
            label: 'P99',
          }),
        ],
        width: 8,
        height: 6,
      }),
      // Permission filtering
      new cloudwatch.GraphWidget({
        title: 'Permission Filtering (Suppressed Documents)',
        left: [
          new cloudwatch.Metric({
            namespace: 'RAGProvenance',
            metricName: 'DocumentSuppressedByPermission',
            dimensionsMap: { EventType: 'PERMISSION_DENIED' },
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
          }),
        ],
        width: 8,
        height: 6,
      }),
      // Cache invalidations
      new cloudwatch.GraphWidget({
        title: 'Permission Cache Invalidations',
        left: [
          new cloudwatch.Metric({
            namespace: 'PermissionCache',
            metricName: 'CacheInvalidations',
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
          }),
        ],
        width: 8,
        height: 6,
      }),
    );

    // --- Row 3: KB Sync & Guardrails ---
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'KB Auto-Sync Activity',
        left: [
          new cloudwatch.Metric({
            namespace: 'KbAutoSync',
            metricName: 'ChangedFileCount',
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
            label: 'Changed Files',
          }),
          new cloudwatch.Metric({
            namespace: 'KbAutoSync',
            metricName: 'IngestionJobTriggered',
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
            label: 'Ingestion Jobs',
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Guardrail Decisions',
        left: [
          new cloudwatch.Metric({
            namespace: 'FSxNOps/Guardrails',
            metricName: 'GuardrailDecision',
            dimensionsMap: { Decision: 'Allowed' },
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
            label: 'Allowed',
          }),
          new cloudwatch.Metric({
            namespace: 'FSxNOps/Guardrails',
            metricName: 'GuardrailDecision',
            dimensionsMap: { Decision: 'Blocked' },
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
            label: 'Blocked',
          }),
        ],
        width: 12,
        height: 6,
      }),
    );

    // Output
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${cdk.Aws.REGION}.console.aws.amazon.com/cloudwatch/home#dashboards:name=${prefix}-roi-metrics`,
      description: 'ROI Dashboard URL (share with stakeholders)',
    });
  }
}
