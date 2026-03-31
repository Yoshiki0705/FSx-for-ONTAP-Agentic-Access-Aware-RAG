/**
 * Agent Schedules API
 * EventBridge Scheduler + Lambda によるAgent定期実行管理
 */

import { NextRequest, NextResponse } from 'next/server';

const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1';
const EXECUTION_TABLE = process.env.AGENT_EXECUTION_TABLE || '';
const SCHEDULER_LAMBDA_ARN = process.env.AGENT_SCHEDULER_LAMBDA_ARN || '';
const SCHEDULER_GROUP = process.env.AGENT_SCHEDULER_GROUP || 'agent-schedules';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'createSchedule':
        return await handleCreateSchedule(body);
      case 'updateSchedule':
        return await handleUpdateSchedule(body);
      case 'deleteSchedule':
        return await handleDeleteSchedule(body);
      case 'listSchedules':
        return await handleListSchedules(body);
      case 'getExecutionHistory':
        return await handleGetExecutionHistory(body);
      case 'manualTrigger':
        return await handleManualTrigger(body);
      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[Agent Schedules API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleCreateSchedule(body: any): Promise<NextResponse> {
  const { agentId, cronExpression, description, inputPrompt, enabled } = body;
  if (!agentId || !cronExpression || !inputPrompt) {
    return NextResponse.json({ success: false, error: 'agentId, cronExpression, and inputPrompt are required' }, { status: 400 });
  }
  if (!SCHEDULER_LAMBDA_ARN) {
    return NextResponse.json({ success: false, error: 'Scheduler Lambda not configured (AGENT_SCHEDULER_LAMBDA_ARN)' }, { status: 500 });
  }

  const { SchedulerClient, CreateScheduleCommand } = await import('@aws-sdk/client-scheduler');
  const client = new SchedulerClient({ region: REGION });
  const scheduleName = `agent-${agentId}-${Date.now()}`;

  await client.send(new CreateScheduleCommand({
    Name: scheduleName,
    GroupName: SCHEDULER_GROUP,
    ScheduleExpression: cronExpression,
    State: enabled ? 'ENABLED' : 'DISABLED',
    FlexibleTimeWindow: { Mode: 'OFF' },
    Target: {
      Arn: SCHEDULER_LAMBDA_ARN,
      RoleArn: process.env.SCHEDULER_ROLE_ARN || '',
      Input: JSON.stringify({ agentId, prompt: inputPrompt, scheduleId: scheduleName }),
    },
    Description: description || '',
  }));

  return NextResponse.json({
    success: true,
    schedule: { scheduleId: scheduleName, agentId, cronExpression, description, inputPrompt, enabled, createdAt: new Date().toISOString() },
  });
}

async function handleUpdateSchedule(body: any): Promise<NextResponse> {
  const { scheduleId, cronExpression, description, inputPrompt, enabled, agentId } = body;
  if (!scheduleId) {
    return NextResponse.json({ success: false, error: 'scheduleId is required' }, { status: 400 });
  }

  const { SchedulerClient, UpdateScheduleCommand } = await import('@aws-sdk/client-scheduler');
  const client = new SchedulerClient({ region: REGION });

  await client.send(new UpdateScheduleCommand({
    Name: scheduleId,
    GroupName: SCHEDULER_GROUP,
    ScheduleExpression: cronExpression,
    State: enabled ? 'ENABLED' : 'DISABLED',
    FlexibleTimeWindow: { Mode: 'OFF' },
    Target: {
      Arn: SCHEDULER_LAMBDA_ARN,
      RoleArn: process.env.SCHEDULER_ROLE_ARN || '',
      Input: JSON.stringify({ agentId, prompt: inputPrompt, scheduleId }),
    },
    Description: description || '',
  }));

  return NextResponse.json({ success: true, message: 'Schedule updated' });
}

async function handleDeleteSchedule(body: any): Promise<NextResponse> {
  const { scheduleId } = body;
  if (!scheduleId) {
    return NextResponse.json({ success: false, error: 'scheduleId is required' }, { status: 400 });
  }

  const { SchedulerClient, DeleteScheduleCommand } = await import('@aws-sdk/client-scheduler');
  const client = new SchedulerClient({ region: REGION });

  await client.send(new DeleteScheduleCommand({ Name: scheduleId, GroupName: SCHEDULER_GROUP }));
  return NextResponse.json({ success: true, message: 'Schedule deleted' });
}

async function handleListSchedules(body: any): Promise<NextResponse> {
  const { agentId } = body;
  const { SchedulerClient, ListSchedulesCommand } = await import('@aws-sdk/client-scheduler');
  const client = new SchedulerClient({ region: REGION });

  try {
    const response = await client.send(new ListSchedulesCommand({
      GroupName: SCHEDULER_GROUP,
      NamePrefix: agentId ? `agent-${agentId}` : 'agent-',
      MaxResults: 50,
    }));

    const schedules = (response.Schedules || []).map(s => ({
      scheduleId: s.Name || '',
      agentId: s.Name?.split('-')[1] || '',
      cronExpression: s.ScheduleExpression || '',
      description: '',
      enabled: s.State === 'ENABLED',
      createdAt: s.CreationDate?.toISOString() || '',
      updatedAt: s.LastModificationDate?.toISOString() || '',
    }));

    return NextResponse.json({ success: true, schedules });
  } catch (err: any) {
    // Schedule group may not exist yet — return empty list
    if (err.name === 'ResourceNotFoundException') {
      return NextResponse.json({ success: true, schedules: [] });
    }
    throw err;
  }
}

async function handleGetExecutionHistory(body: any): Promise<NextResponse> {
  const { scheduleId } = body;
  if (!scheduleId || !EXECUTION_TABLE) {
    return NextResponse.json({ success: false, error: 'scheduleId required and execution table must be configured' }, { status: 400 });
  }

  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, QueryCommand } = await import('@aws-sdk/lib-dynamodb');
  const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  const response = await ddbClient.send(new QueryCommand({
    TableName: EXECUTION_TABLE,
    IndexName: 'scheduleId-startedAt-index',
    KeyConditionExpression: 'scheduleId = :sid',
    ExpressionAttributeValues: { ':sid': scheduleId },
    ScanIndexForward: false,
    Limit: 50,
  }));

  return NextResponse.json({ success: true, executions: response.Items || [] });
}

async function handleManualTrigger(body: any): Promise<NextResponse> {
  const { agentId, inputPrompt } = body;
  if (!agentId || !inputPrompt) {
    return NextResponse.json({ success: false, error: 'agentId and inputPrompt are required' }, { status: 400 });
  }

  if (SCHEDULER_LAMBDA_ARN) {
    const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
    const lambdaClient = new LambdaClient({ region: REGION });
    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: SCHEDULER_LAMBDA_ARN,
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify({ agentId, prompt: inputPrompt, scheduleId: `manual-${Date.now()}` })),
    }));
    const payload = response.Payload ? JSON.parse(Buffer.from(response.Payload).toString()) : {};
    return NextResponse.json({ success: true, result: payload });
  }

  // Fallback: direct InvokeAgent
  const { BedrockAgentRuntimeClient, InvokeAgentCommand } = await import('@aws-sdk/client-bedrock-agent-runtime');
  const agentRuntime = new BedrockAgentRuntimeClient({ region: REGION });
  const agentResponse = await agentRuntime.send(new InvokeAgentCommand({
    agentId,
    agentAliasId: 'TSTALIASID',
    sessionId: `manual-${Date.now()}`,
    inputText: inputPrompt,
  }));

  let fullResponse = '';
  if (agentResponse.completion) {
    for await (const event of agentResponse.completion) {
      if (event.chunk?.bytes) {
        fullResponse += new TextDecoder().decode(event.chunk.bytes);
      }
    }
  }

  return NextResponse.json({ success: true, result: { answer: fullResponse } });
}
