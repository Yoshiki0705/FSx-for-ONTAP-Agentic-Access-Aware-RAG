/**
 * One Converse call for the text tools (translate, proofread, diagram, web extraction,
 * saved use cases). The model is `TOOLS_MODEL_ID`, and base model IDs are mapped to the
 * inference profile the region can call, as the agents do (`runtimeModelId`).
 */
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { runtimeModelId } from '@/lib/agent-backend/agentcore';

export const DEFAULT_TOOLS_MODEL = 'jp.anthropic.claude-haiku-4-5-20251001-v1:0';
/** Longest input the tools accept, in characters. Longer input is rejected, not cut. */
export const MAX_INPUT_CHARS = 30_000;

let client: BedrockRuntimeClient | null = null;
function bedrock(): BedrockRuntimeClient {
  client ??= new BedrockRuntimeClient({
    region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1',
    maxAttempts: 3,
  });
  return client;
}

/** Tests replace the client. */
export function __setTextClient(c: { send: (cmd: unknown) => Promise<unknown> } | null): void {
  client = c as BedrockRuntimeClient | null;
}

export class ToolInputError extends Error {}

export function toolsModelId(): string {
  return runtimeModelId(process.env.TOOLS_MODEL_ID || DEFAULT_TOOLS_MODEL);
}

export async function generateText(params: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ text: string; modelId: string; inputTokens?: number; outputTokens?: number }> {
  if (!params.user.trim()) throw new ToolInputError('input is empty');
  if (params.user.length > MAX_INPUT_CHARS) {
    throw new ToolInputError(`input is longer than ${MAX_INPUT_CHARS} characters`);
  }
  const modelId = toolsModelId();
  const out = (await bedrock().send(
    new ConverseCommand({
      modelId,
      system: [{ text: params.system }],
      messages: [{ role: 'user', content: [{ text: params.user }] }],
      inferenceConfig: { maxTokens: params.maxTokens ?? 4096, temperature: params.temperature ?? 0.2 },
    }),
  )) as {
    output?: { message?: { content?: { text?: string }[] } };
    usage?: { inputTokens?: number; outputTokens?: number };
  };
  const text = (out.output?.message?.content || []).map((c) => c.text || '').join('').trim();
  return { text, modelId, inputTokens: out.usage?.inputTokens, outputTokens: out.usage?.outputTokens };
}
