/**
 * Agent Trigger Lambda Handler
 *
 * Invokes a Bedrock Agent when EventBridge events occur:
 * - KB_INGESTION_COMPLETE: Knowledge Base ingestion job completed
 * - BREAK_GLASS: Capacity Guardrail emergency bypass activated
 * - SCHEDULE: Daily report generation
 *
 * Security: Uses triggerOwnerId in sessionState for SID-scoped execution.
 */

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
