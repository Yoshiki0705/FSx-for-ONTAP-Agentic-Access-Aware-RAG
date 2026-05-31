# Agent Trigger Lambda

Event-Driven Agent Trigger handler. Invokes a Bedrock Agent when EventBridge events occur.

## Trigger Types

| Type | Event Source | Description |
|------|-------------|-------------|
| `KB_INGESTION_COMPLETE` | `aws.bedrock` | KB ingestion job completed |
| `BREAK_GLASS` | `custom.fsxn-ops` | Capacity guardrail emergency bypass |
| `SCHEDULE` | EventBridge Scheduler | Daily report generation |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AGENT_ID` | Bedrock Agent ID |
| `AGENT_ALIAS_ID` | Bedrock Agent Alias ID |
| `EXECUTION_TABLE_NAME` | DynamoDB table for execution history |
| `KB_INGESTION_PROMPT` | Prompt for KB ingestion trigger |
| `BREAK_GLASS_PROMPT` | Prompt for BREAK_GLASS trigger |
| `SCHEDULED_PROMPT` | Prompt for scheduled trigger |

## Security

- Agent is invoked with `triggerOwnerId` in session attributes
- The Agent's Action Group uses `triggerOwnerId` for SID filtering
- This ensures the Agent only accesses documents the trigger owner can see

## Testing

```bash
# Local invocation test (requires AWS credentials)
node -e "
const handler = require('./handler');
handler.handler({
  triggerType: 'KB_INGESTION_COMPLETE',
  time: new Date().toISOString(),
  detail: { knowledgeBaseId: 'test-kb', statistics: { numberOfDocumentsScanned: 5 } }
}).then(console.log);
"
```
