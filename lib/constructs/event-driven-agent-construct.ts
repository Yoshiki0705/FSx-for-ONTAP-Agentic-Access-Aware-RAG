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
      handler: 'index.handler',
      code: lambda.Code.fromInline(this.generateTriggerLambdaCode()),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        AGENT_ID: props.agentId,
        AGENT_ALIAS_ID: props.agentAliasId,
        EXECUTION_TABLE_NAME: `${prefix}-agent-trigger-executions`,
        AWS_REGION_OVERRIDE: region,
        KB_INGESTION_PROMPT: props.kbIngestionPrompt || 'New documents have been ingested into the knowledge base. Please summarize the key changes and notify relevant stakeholders.',
        BREAK_GLASS_PROMPT: props.breakGlassPrompt || 'A BREAK_GLASS capacity override has been activated. Please review the action, assess risk, and generate an incident summary.',
        SCHEDULED_PROMPT: props.scheduledPrompt || 'Generate a daily summary report of RAG system usage, including query counts, model routing distribution, and any permission-denied events.',
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

  /**
   * Generate inline Lambda code for the Agent Trigger.
   *
   * This is a lightweight handler that:
   * 1. Determines trigger type from the event
   * 2. Invokes the Bedrock Agent with the appropriate prompt
   * 3. Records execution in DynamoDB
   *
   * For production, this should be extracted to a separate file with
   * proper error handling and retry logic.
   */
  private generateTriggerLambdaCode(): string {
    return `
const { BedrockAgentRuntimeClient, InvokeAgentCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');

const agentClient = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION_OVERRIDE || process.env.AWS_REGION,
});
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION_OVERRIDE || process.env.AWS_REGION,
});

exports.handler = async (event) => {
  const startTime = Date.now();
  const executionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  const triggerType = event.triggerType || 'UNKNOWN';

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Agent trigger received',
    triggerType,
    executionId,
    eventTime: event.time,
  }));

  // Determine prompt based on trigger type
  let prompt;
  switch (triggerType) {
    case 'KB_INGESTION_COMPLETE':
      const kbId = event.detail?.knowledgeBaseId || 'unknown';
      const docsProcessed = event.detail?.statistics?.numberOfDocumentsScanned || 0;
      prompt = process.env.KB_INGESTION_PROMPT +
        ' Knowledge Base ID: ' + kbId +
        '. Documents processed: ' + docsProcessed + '.';
      break;
    case 'BREAK_GLASS':
      const action = event.detail?.action || 'unknown';
      const reason = event.detail?.reason || 'not specified';
      prompt = process.env.BREAK_GLASS_PROMPT +
        ' Action: ' + action +
        '. Reason: ' + reason + '.';
      break;
    case 'SCHEDULE':
      prompt = process.env.SCHEDULED_PROMPT +
        ' Execution time: ' + (event.time || new Date().toISOString()) + '.';
      break;
    default:
      prompt = 'An event occurred: ' + JSON.stringify(event).substring(0, 500);
  }

  let sessionId;
  let status = 'SUCCESS';
  let errorMessage;

  try {
    // Generate unique session ID for this trigger execution
    sessionId = 'trigger-' + executionId;

    // Invoke Bedrock Agent (fire-and-forget pattern)
    // SECURITY: Pass triggerOwnerId so the Agent executes with the
    // trigger owner's SID permissions, not a Machine User's.
    const command = new InvokeAgentCommand({
      agentId: process.env.AGENT_ID,
      agentAliasId: process.env.AGENT_ALIAS_ID,
      sessionId,
      inputText: prompt,
      sessionState: {
        sessionAttributes: {
          triggerOwnerId: event.detail?.triggerOwnerId || 'system',
          triggerType: triggerType,
        },
      },
    });

    const response = await agentClient.send(command);

    // Collect response text from stream
    let responseText = '';
    if (response.completion) {
      for await (const chunk of response.completion) {
        if (chunk.chunk?.bytes) {
          responseText += new TextDecoder().decode(chunk.chunk.bytes);
        }
      }
    }

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Agent invocation completed',
      triggerType,
      executionId,
      sessionId,
      responseLength: responseText.length,
      durationMs: Date.now() - startTime,
    }));
  } catch (error) {
    status = 'FAILURE';
    errorMessage = error.message || String(error);
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Agent invocation failed',
      triggerType,
      executionId,
      error: errorMessage,
      durationMs: Date.now() - startTime,
    }));
  }

  // Record execution in DynamoDB
  try {
    const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days
    await dynamoClient.send(new PutItemCommand({
      TableName: process.env.EXECUTION_TABLE_NAME,
      Item: {
        triggerId: { S: triggerType },
        executionId: { S: executionId },
        sessionId: { S: sessionId || 'none' },
        status: { S: status },
        triggerType: { S: triggerType },
        eventTime: { S: event.time || new Date().toISOString() },
        executedAt: { S: new Date().toISOString() },
        durationMs: { N: String(Date.now() - startTime) },
        ...(errorMessage ? { error: { S: errorMessage } } : {}),
        ttl: { N: String(ttl) },
      },
    }));
  } catch (dbError) {
    console.error('Failed to record execution:', dbError.message);
  }

  return {
    statusCode: status === 'SUCCESS' ? 200 : 500,
    body: JSON.stringify({ executionId, triggerType, status, sessionId }),
  };
};
`;
  }
}
