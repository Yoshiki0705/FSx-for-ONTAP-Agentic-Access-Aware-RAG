/**
 * Which agent backend the API routes use, and who the signed-in user is.
 *
 * `AGENT_BACKEND` is set by CDK from the `agentBackend` context: `agentcore` (default) runs
 * agents on AgentCore Runtime with definitions in DynamoDB; `bedrock-agents` keeps the
 * Amazon Bedrock Agents (Agents Classic) handlers for accounts that already use them, for
 * one release. Without the variable (local development), a configured runtime ARN means
 * AgentCore and anything else falls back to the existing handlers.
 */
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export type AgentBackend = 'agentcore' | 'bedrock-agents';

export function agentBackend(): AgentBackend {
  const configured = process.env.AGENT_BACKEND;
  if (configured === 'agentcore' || configured === 'bedrock-agents') return configured;
  return process.env.AGENT_RUNTIME_ARN ? 'agentcore' : 'bedrock-agents';
}

export function isAgentCore(): boolean {
  return agentBackend() === 'agentcore';
}

/**
 * The signed-in user from the `session-token` cookie, as the user-access table keys it
 * (the email for Cognito sign-in). The permission-aware search runs for this user, so it
 * must not come from the request body: a body field can name any user.
 */
export async function sessionUserId(): Promise<string | null> {
  try {
    const token = (await cookies()).get('session-token')?.value;
    if (!token) return null;
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
    const { payload } = await jwtVerify(token, secret);
    const userId = (payload.userId as string) || (payload.username as string);
    return userId || null;
  } catch {
    return null;
  }
}

export * from './agentcore';
