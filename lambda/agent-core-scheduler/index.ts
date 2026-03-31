/**
 * Agent Scheduler Lambda
 * EventBridge Schedulerから呼び出され、Bedrock Agentを実行し結果をDynamoDBに記録
 */

import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
const TABLE_NAME = process.env.EXECUTION_TABLE_NAME || '';

const agentRuntime = new BedrockAgentRuntimeClient({ region: REGION });
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

interface ScheduleEvent {
  agentId: string;
  agentAliasId?: string;
  prompt: string;
  scheduleId: string;
}

export async function handler(event: ScheduleEvent) {
  const { agentId, agentAliasId, prompt, scheduleId } = event;
  const executionId = `${scheduleId}#${Date.now()}`;
  const startedAt = new Date().toISOString();

  console.log(`[Scheduler] Starting execution: ${executionId}`, { agentId, scheduleId });

  // Record RUNNING status
  if (TABLE_NAME) {
    await ddbClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        executionId,
        scheduleId,
        agentId,
        status: 'RUNNING',
        inputPrompt: prompt,
        startedAt,
        ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
      },
    }));
  }

  try {
    const response = await agentRuntime.send(new InvokeAgentCommand({
      agentId,
      agentAliasId: agentAliasId || 'TSTALIASID',
      sessionId: `sched-${Date.now()}`,
      inputText: prompt,
    }));

    let fullResponse = '';
    if (response.completion) {
      for await (const event of response.completion) {
        if (event.chunk?.bytes) {
          fullResponse += new TextDecoder().decode(event.chunk.bytes);
        }
      }
    }

    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // Record SUCCESS
    if (TABLE_NAME) {
      await ddbClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          executionId,
          scheduleId,
          agentId,
          status: 'SUCCESS',
          inputPrompt: prompt,
          responseSummary: fullResponse.substring(0, 500),
          startedAt,
          completedAt,
          durationMs,
          ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
        },
      }));
    }

    console.log(`[Scheduler] Execution SUCCESS: ${executionId}, duration: ${durationMs}ms`);
    return { statusCode: 200, body: { executionId, status: 'SUCCESS', durationMs } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const completedAt = new Date().toISOString();

    // Record FAILED
    if (TABLE_NAME) {
      await ddbClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          executionId,
          scheduleId,
          agentId,
          status: 'FAILED',
          inputPrompt: prompt,
          errorMessage,
          startedAt,
          completedAt,
          ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
        },
      }));
    }

    console.error(`[Scheduler] Execution FAILED: ${executionId}`, errorMessage);
    return { statusCode: 500, body: { executionId, status: 'FAILED', error: errorMessage } };
  }
}
