/**
 * AlertEscalationConstruct (#14, #15)
 *
 * Guardrails 違反とコスト異常を検知し、自動エスカレーションする。
 *
 * #14: Guardrails 違反が閾値を超えた場合に SNS → Webhook (Slack/PagerDuty)
 * #15: Smart Routing の full-context 比率が異常に高い場合にアラート
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface AlertEscalationConstructProps {
  projectName: string;
  environment: string;
  /** 既存の SNS トピック（オプション、未指定時は新規作成） */
  snsTopicArn?: string;
  /** Webhook URL (Secrets Manager ARN containing Slack/PagerDuty webhook URL) */
  webhookUrl?: string;
  /** Guardrails 違反閾値（1時間あたり、デフォルト: 5） */
  guardrailBlockThreshold?: number;
  /** Smart Routing full-context 比率閾値（%、デフォルト: 20） */
  fullContextRatioThreshold?: number;
}

export class AlertEscalationConstruct extends Construct {
  public readonly topic: sns.ITopic;
  public readonly guardrailAlarm: cloudwatch.Alarm;
  public readonly costAnomalyAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: AlertEscalationConstructProps) {
    super(scope, id);

    const prefix = `${props.projectName}-${props.environment}`;
    const blockThreshold = props.guardrailBlockThreshold ?? 5;
    const fullContextThreshold = props.fullContextRatioThreshold ?? 20;

    // --- SNS Topic ---
    if (props.snsTopicArn) {
      this.topic = sns.Topic.fromTopicArn(this, 'ExistingTopic', props.snsTopicArn);
    } else {
      this.topic = new sns.Topic(this, 'EscalationTopic', {
        topicName: `${prefix}-alert-escalation`,
        displayName: `${prefix} Alert Escalation`,
      });
    }

    // --- Webhook Lambda (Slack/PagerDuty) ---
    if (props.webhookUrl) {
      const webhookFn = new lambda.Function(this, 'WebhookFn', {
        functionName: `${prefix}-alert-webhook`,
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'index.handler',
        code: lambda.Code.fromInline(`
import json
import urllib.request
import os
import boto3

def handler(event, context):
    # Retrieve webhook URL from Secrets Manager (not env var)
    secret_arn = os.environ['WEBHOOK_SECRET_ARN']
    sm = boto3.client('secretsmanager')
    secret = sm.get_secret_value(SecretId=secret_arn)
    webhook_url = secret['SecretString']
    
    for record in event.get('Records', []):
        message = record.get('Sns', {}).get('Message', '')
        subject = record.get('Sns', {}).get('Subject', 'Alert')
        
        # Slack format
        payload = {
            "text": f":rotating_light: *{subject}*\\n{message}"
        }
        
        req = urllib.request.Request(
            webhook_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req)
    
    return {'statusCode': 200}
`),
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          WEBHOOK_SECRET_ARN: props.webhookUrl,  // Now expects a Secrets Manager ARN
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
      });

      // Grant Secrets Manager read access
      webhookFn.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.webhookUrl],
      }));

      this.topic.addSubscription(
        new sns_subscriptions.LambdaSubscription(webhookFn)
      );
    }

    // --- #14: Guardrails Violation Alarm ---
    this.guardrailAlarm = new cloudwatch.Alarm(this, 'GuardrailBlockAlarm', {
      alarmName: `${prefix}-guardrail-violations-high`,
      alarmDescription: `Guardrail BLOCKED decisions exceeded ${blockThreshold}/hour. Possible attack or misconfiguration.`,
      metric: new cloudwatch.Metric({
        namespace: 'FSxNOps/Guardrails',
        metricName: 'GuardrailDecision',
        dimensionsMap: { Decision: 'Blocked' },
        statistic: 'Sum',
        period: cdk.Duration.hours(1),
      }),
      threshold: blockThreshold,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.guardrailAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.topic));

    // --- #15: Cost Anomaly Detection (Smart Routing full-context spike) ---
    this.costAnomalyAlarm = new cloudwatch.Alarm(this, 'FullContextSpikeAlarm', {
      alarmName: `${prefix}-smart-routing-cost-anomaly`,
      alarmDescription: `Smart Routing full-context tier usage exceeded ${fullContextThreshold}%. Possible cost spike.`,
      metric: new cloudwatch.Metric({
        namespace: 'SmartRouting',
        metricName: 'RoutingCount',
        dimensionsMap: { RoutingTier: 'full-context' },
        statistic: 'Sum',
        period: cdk.Duration.hours(1),
      }),
      threshold: fullContextThreshold,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.costAnomalyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.topic));

    // --- Outputs ---
    new cdk.CfnOutput(this, 'EscalationTopicArn', {
      value: this.topic.topicArn,
      description: 'Alert escalation SNS topic ARN',
    });
  }
}
