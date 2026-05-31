/**
 * Event-Driven Agent Trigger Construct
 *
 * Automatically invokes a Bedrock Agent when specific events occur:
 * - KB Ingestion Job completes (COMPLETE status)
 * - Capacity Guardrails BREAK_GLASS mode activated
 * - Scheduled triggers (EventBridge Scheduler)
 *
 * Inspired by aws-samples/sample-multi-agent-orchestration-chat-on-agentcore
 * packages/trigger/ architecture (schedule-handler + custom-event-handler).
 *
 * Architecture:
 *   EventBridge Rule → Agent Trigger Lambda → Bedrock InvokeAgent API
 *   EventBridge Scheduler → Agent Trigger Lambda → Bedrock InvokeAgent API
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import { Construct } from 'constructs';

export interface EventDrivenAgentProps {
  /** Resource name prefix */
  prefix: string;
  /** Bedrock Agent ID to invoke */
  agentId: string;
  /** Bedrock Agent Alias ID */
  agentAliasId: string;
  /** Knowledge Base ID (for event filtering) */
  knowledgeBaseId?: string;
  /** Enable KB Ingestion Complete trigger */
  enableKbIngestionTrigger?: boolean;
  /** Enable BREAK_GLASS trigger */
  enableBreakGlassTrigger?: boolean;
  /** Enable scheduled trigger (daily report, etc.) */
  enableScheduledTrigger?: boolean;
  /** Schedule expression for scheduled trigger (default: daily 09:00 JST) */
  scheduleExpression?: string;
  /** Default prompt for KB Ingestion trigger */
  kbIngestionPrompt?: string;
  /** Default prompt for BREAK_GLASS trigger */
  breakGlassPrompt?: string;
  /** Default prompt for scheduled trigger */
  scheduledPrompt?: string;
  /** Agent prompt locale (default: 'ja'). Determines default prompt language. */
  agentLocale?: string;
  /** AWS Region */
  region?: string;
}

export class EventDrivenAgentConstruct extends Construct {
  public readonly triggerFunction: lambda.Function;
  public readonly executionTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: EventDrivenAgentProps) {
    super(scope, id);

    const prefix = props.prefix;
    const region = props.region || cdk.Stack.of(this).region;
    const locale = props.agentLocale || 'ja';

    // Locale-aware default prompts
    const defaultPrompts = {
      ja: {
        kbIngestion: 'ナレッジベースに新しいドキュメントが取り込まれました。主要な変更点を要約し、関係者に通知してください。',
        breakGlass: 'Capacity Guardrail の BREAK_GLASS オーバーライドが発動されました。アクションを確認し、リスクを評価し、インシデントサマリーを生成してください。',
        scheduled: 'RAG システムの日次利用サマリーレポートを生成してください。クエリ数、モデルルーティング分布、権限拒否イベントを含めてください。',
      },
      en: {
        kbIngestion: 'New documents have been ingested into the knowledge base. Please summarize the key changes and notify relevant stakeholders.',
        breakGlass: 'A BREAK_GLASS capacity override has been activated. Please review the action, assess risk, and generate an incident summary.',
        scheduled: 'Generate a daily summary report of RAG system usage, including query counts, model routing distribution, and any permission-denied events.',
      },
    };
    const prompts = defaultPrompts[locale as keyof typeof defaultPrompts] || defaultPrompts.en;

    // === DynamoDB: Trigger Execution History ===
    this.executionTable = new dynamodb.Table(this, 'ExecutionTable', {
      tableName: `${prefix}-agent-trigger-executions`,
      partitionKey: { name: 'triggerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'executionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    // === Lambda: Agent Trigger Handler ===
    this.triggerFunction = new lambda.Function(this, 'TriggerFunction', {
      functionName: `${prefix}-agent-trigger`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('lambda/agent-trigger'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        AGENT_ID: props.agentId,
        AGENT_ALIAS_ID: props.agentAliasId,
        EXECUTION_TABLE_NAME: `${prefix}-agent-trigger-executions`,
        AWS_REGION_OVERRIDE: region,
        KB_INGESTION_PROMPT: props.kbIngestionPrompt || prompts.kbIngestion,
        BREAK_GLASS_PROMPT: props.breakGlassPrompt || prompts.breakGlass,
        SCHEDULED_PROMPT: props.scheduledPrompt || prompts.scheduled,
        AGENT_LOCALE: locale,
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });

    // IAM: Bedrock Agent invocation
    this.triggerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeAgent'],
      resources: [
        `arn:aws:bedrock:${region}:${cdk.Stack.of(this).account}:agent/${props.agentId}`,
        `arn:aws:bedrock:${region}:${cdk.Stack.of(this).account}:agent-alias/${props.agentId}/${props.agentAliasId}`,
      ],
    }));

    // IAM: DynamoDB execution history
    this.executionTable.grantReadWriteData(this.triggerFunction);

    // === EventBridge Rule: KB Ingestion Complete ===
    if (props.enableKbIngestionTrigger !== false) {
      const kbIngestionRule = new events.Rule(this, 'KbIngestionCompleteRule', {
        ruleName: `${prefix}-kb-ingestion-agent-trigger`,
        eventPattern: {
          source: ['aws.bedrock'],
          detailType: ['Bedrock Knowledge Base Ingestion Job State Change'],
          detail: {
            status: ['COMPLETE'],
            ...(props.knowledgeBaseId ? { knowledgeBaseId: [props.knowledgeBaseId] } : {}),
          },
        },
      });

      kbIngestionRule.addTarget(new eventsTargets.LambdaFunction(this.triggerFunction, {
        event: events.RuleTargetInput.fromObject({
          triggerType: 'KB_INGESTION_COMPLETE',
          source: events.EventField.fromPath('$.source'),
          detail: events.EventField.fromPath('$.detail'),
          time: events.EventField.fromPath('$.time'),
        }),
      }));
    }

    // === EventBridge Rule: BREAK_GLASS Activation ===
    if (props.enableBreakGlassTrigger) {
      const breakGlassRule = new events.Rule(this, 'BreakGlassRule', {
        ruleName: `${prefix}-break-glass-agent-trigger`,
        eventPattern: {
          source: ['custom.fsxn-ops'],
          detailType: ['Capacity Guardrail BREAK_GLASS Activated'],
        },
      });

      breakGlassRule.addTarget(new eventsTargets.LambdaFunction(this.triggerFunction, {
        event: events.RuleTargetInput.fromObject({
          triggerType: 'BREAK_GLASS',
          source: events.EventField.fromPath('$.source'),
          detail: events.EventField.fromPath('$.detail'),
          time: events.EventField.fromPath('$.time'),
        }),
      }));
    }

    // === EventBridge Scheduler: Scheduled Agent Trigger ===
    if (props.enableScheduledTrigger) {
      const schedulerRole = new iam.Role(this, 'SchedulerRole', {
        roleName: `${prefix}-agent-trigger-scheduler-role`,
        assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
      });

      schedulerRole.addToPolicy(new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [this.triggerFunction.functionArn],
      }));

      new scheduler.CfnSchedule(this, 'DailyReportSchedule', {
        name: `${prefix}-daily-report-agent`,
        scheduleExpression: props.scheduleExpression || 'cron(0 0 * * ? *)', // 09:00 JST = 00:00 UTC
        scheduleExpressionTimezone: 'Asia/Tokyo',
        flexibleTimeWindow: { mode: 'OFF' },
        target: {
          arn: this.triggerFunction.functionArn,
          roleArn: schedulerRole.roleArn,
          input: JSON.stringify({
            triggerType: 'SCHEDULE',
            time: '${aws:CurrentTime}',
            detail: { scheduleType: 'daily-report' },
          }),
        },
        state: 'ENABLED',
      });
    }

    // === Outputs ===
    new cdk.CfnOutput(this, 'TriggerFunctionArn', {
      value: this.triggerFunction.functionArn,
      description: 'Agent Trigger Lambda ARN',
    });

    new cdk.CfnOutput(this, 'ExecutionTableName', {
      value: this.executionTable.tableName,
      description: 'Agent Trigger Execution History Table',
    });
  }
}
