/**
 * Agent Triggers API Route
 *
 * Manages Event-Driven Agent Trigger configurations and execution history.
 * Reads from the DynamoDB execution table created by EventDrivenAgentConstruct.
 *
 * Actions:
 * - listTriggers: List configured triggers (derived from environment)
 * - listExecutions: List execution history for a trigger
 * - toggleTrigger: Enable/disable a trigger (future: EventBridge rule enable/disable)
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const EXECUTION_TABLE_NAME = process.env.AGENT_TRIGGER_EXECUTION_TABLE || '';
const AGENT_ID = process.env.BEDROCK_AGENT_ID || '';
const ENABLE_EVENT_DRIVEN_TRIGGER = process.env.ENABLE_EVENT_DRIVEN_AGENT_TRIGGER === 'true';

const dynamoClient = EXECUTION_TABLE_NAME
  ? new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' })
  : null;

interface TriggerAction {
  action: 'listTriggers' | 'listExecutions' | 'toggleTrigger';
  triggerId?: string;
  enabled?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: TriggerAction = await request.json();

    switch (body.action) {
      case 'listTriggers':
        return handleListTriggers();
      case 'listExecutions':
        return handleListExecutions(body.triggerId);
      case 'toggleTrigger':
        return handleToggleTrigger(body.triggerId, body.enabled);
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[AgentTriggers] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * List configured triggers.
 * Currently derived from environment variables (CDK-managed).
 * Future: Read from DynamoDB triggers table for user-defined triggers.
 */
async function handleListTriggers() {
  if (!ENABLE_EVENT_DRIVEN_TRIGGER) {
    return NextResponse.json({ success: true, triggers: [] });
  }

  // Built-in triggers (CDK-managed via EventDrivenAgentConstruct)
  const triggers = [
    {
      triggerId: 'KB_INGESTION_COMPLETE',
      triggerType: 'KB_INGESTION_COMPLETE',
      name: 'KB Ingestion Complete',
      description: 'Automatically invokes the Agent when a Knowledge Base ingestion job completes successfully. The Agent summarizes new documents and can notify stakeholders.',
      agentId: AGENT_ID,
      enabled: true,
      prompt: process.env.KB_INGESTION_AGENT_PROMPT || 'New documents have been ingested into the knowledge base. Please summarize the key changes and notify relevant stakeholders.',
      lastExecutionAt: undefined as string | undefined,
      lastStatus: undefined as 'SUCCESS' | 'FAILURE' | undefined,
    },
  ];

  // Add BREAK_GLASS trigger if enabled
  if (process.env.ENABLE_BREAK_GLASS_TRIGGER === 'true') {
    triggers.push({
      triggerId: 'BREAK_GLASS',
      triggerType: 'BREAK_GLASS' as any,
      name: 'BREAK_GLASS Activation',
      description: 'Automatically invokes the Agent when a Capacity Guardrail BREAK_GLASS override is activated. The Agent assesses risk and generates an incident summary.',
      agentId: AGENT_ID,
      enabled: true,
      prompt: process.env.BREAK_GLASS_AGENT_PROMPT || 'A BREAK_GLASS capacity override has been activated. Please review the action, assess risk, and generate an incident summary.',
      lastExecutionAt: undefined,
      lastStatus: undefined,
    });
  }

  // Enrich with last execution data from DynamoDB
  if (dynamoClient && EXECUTION_TABLE_NAME) {
    for (const trigger of triggers) {
      try {
        const result = await dynamoClient.send(new QueryCommand({
          TableName: EXECUTION_TABLE_NAME,
          KeyConditionExpression: 'triggerId = :tid',
          ExpressionAttributeValues: { ':tid': { S: trigger.triggerId } },
          ScanIndexForward: false,
          Limit: 1,
        }));
        if (result.Items && result.Items.length > 0) {
          const item = unmarshall(result.Items[0]);
          trigger.lastExecutionAt = item.executedAt;
          trigger.lastStatus = item.status;
        }
      } catch {
        // Non-fatal: continue without execution data
      }
    }
  }

  return NextResponse.json({ success: true, triggers });
}

/**
 * List execution history for a specific trigger.
 */
async function handleListExecutions(triggerId?: string) {
  if (!triggerId || !dynamoClient || !EXECUTION_TABLE_NAME) {
    return NextResponse.json({ success: true, executions: [] });
  }

  try {
    const result = await dynamoClient.send(new QueryCommand({
      TableName: EXECUTION_TABLE_NAME,
      KeyConditionExpression: 'triggerId = :tid',
      ExpressionAttributeValues: { ':tid': { S: triggerId } },
      ScanIndexForward: false,
      Limit: 20,
    }));

    const executions = (result.Items || []).map(item => unmarshall(item));
    return NextResponse.json({ success: true, executions });
  } catch (error) {
    console.error('[AgentTriggers] Failed to query executions:', error);
    return NextResponse.json({ success: true, executions: [] });
  }
}

/**
 * Toggle a trigger's enabled state.
 * Future: This will enable/disable the EventBridge rule via API.
 * Currently returns success (state is managed by CDK).
 */
async function handleToggleTrigger(triggerId?: string, enabled?: boolean) {
  if (!triggerId) {
    return NextResponse.json({ success: false, error: 'triggerId required' }, { status: 400 });
  }

  // TODO: Implement EventBridge rule enable/disable via SDK
  // const client = new EventBridgeClient({ region: ... });
  // await client.send(new EnableRuleCommand/DisableRuleCommand({ Name: ruleName }));

  console.log(`[AgentTriggers] Toggle trigger ${triggerId}: enabled=${enabled}`);
  return NextResponse.json({ success: true, triggerId, enabled });
}
