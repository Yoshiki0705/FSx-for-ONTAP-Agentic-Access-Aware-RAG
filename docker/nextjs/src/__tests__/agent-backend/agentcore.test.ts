// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SignJWT } from 'jose';

const cookieStore = { value: undefined as string | undefined };
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'session-token' && cookieStore.value ? { value: cookieStore.value } : undefined) }),
}));

import {
  __setClients,
  agentBackend,
  buildDefinition,
  invokeAgent,
  invokeTeam,
  normalizeTools,
  runtimeSessionId,
  toAgent,
  toSummary,
  ValidationError,
  type AgentDefinition,
} from '@/lib/agent-backend';
import { resolveUser } from '@/lib/agent-backend/routes';

const SECRET = 'test-secret';

async function signIn(userId: string) {
  cookieStore.value = await new SignJWT({ userId, username: userId }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(SECRET));
}

/** Records commands and answers them by name. */
function fakeClient(answers: Record<string, (input: any) => unknown>) {
  const sent: { name: string; input: any }[] = [];
  return {
    sent,
    client: {
      send: async (command: any) => {
        const name = command.constructor.name;
        sent.push({ name, input: command.input });
        const answer = answers[name];
        if (!answer) throw new Error(`unexpected ${name}`);
        return answer(command.input);
      },
    } as any,
  };
}

const stored: AgentDefinition = {
  agentId: 'agent-1',
  agentName: 'Legal reviewer',
  instruction: 'Review contracts.',
  foundationModel: 'apac.anthropic.claude-haiku-4-5-20251001-v1:0',
  tools: ['PermissionAwareSearch'],
  agentStatus: 'PREPARED',
  createdAt: '2026-11-14T00:00:00.000Z',
  updatedAt: '2026-11-14T00:00:00.000Z',
};

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
  process.env.AGENT_DEFINITIONS_TABLE_NAME = 'defs';
  process.env.AGENT_RUNTIME_ARN = 'arn:aws:bedrock-agentcore:ap-northeast-1:111122223333:runtime/x';
  cookieStore.value = undefined;
});
afterEach(() => {
  delete process.env.AGENT_BACKEND;
});

describe('agentBackend', () => {
  it('follows AGENT_BACKEND, and a runtime ARN when it is not set', () => {
    process.env.AGENT_BACKEND = 'bedrock-agents';
    expect(agentBackend()).toBe('bedrock-agents');
    delete process.env.AGENT_BACKEND;
    expect(agentBackend()).toBe('agentcore');
    delete process.env.AGENT_RUNTIME_ARN;
    expect(agentBackend()).toBe('bedrock-agents');
  });
});

describe('definitions', () => {
  it('builds a new definition with defaults and a generated id', () => {
    const d = buildDefinition({ agentName: '  Contract agent  ' }, undefined, '2026-11-14T01:00:00.000Z');
    expect(d.agentId).toMatch(/^agent-[0-9a-f]{8}$/);
    expect(d.agentName).toBe('Contract agent');
    expect(d.tools).toEqual(['PermissionAwareSearch']);
    expect(d.agentStatus).toBe('PREPARED');
    expect(d.createdAt).toBe(d.updatedAt);
  });

  it('keeps the id and creation time on update and changes only the given fields', () => {
    const d = buildDefinition({ instruction: 'New' }, stored, '2026-11-15T00:00:00.000Z');
    expect(d).toMatchObject({ agentId: 'agent-1', agentName: 'Legal reviewer', instruction: 'New', createdAt: stored.createdAt, updatedAt: '2026-11-15T00:00:00.000Z' });
  });

  it('requires a name and drops unknown tools', () => {
    expect(() => buildDefinition({})).toThrow(ValidationError);
    expect(normalizeTools({ actionGroups: ['PermissionAwareSearch', 'Browser'] })).toEqual(['PermissionAwareSearch']);
    expect(normalizeTools({ tools: [] })).toEqual([]);
  });

  it('presents a definition in the Bedrock Agents shapes the screens read', () => {
    expect(toSummary(stored)).toMatchObject({ agentId: 'agent-1', agentStatus: 'PREPARED', status: 'PREPARED', latestAgentVersion: '1' });
    expect(toAgent({ ...stored, guardrailId: 'g1' }).guardrailConfiguration).toEqual({ guardrailIdentifier: 'g1', guardrailVersion: 'DRAFT' });
  });
});

describe('runtime', () => {
  it('pads a session ID to the 33 characters AgentCore requires', () => {
    expect(runtimeSessionId('s', 'u').length).toBeGreaterThanOrEqual(33);
    const long = 'x'.repeat(40);
    expect(runtimeSessionId(long, 'u')).toBe(long);
  });

  it('sends the stored definition and the given user to the runtime', async () => {
    const ddb = fakeClient({ GetCommand: () => ({ Item: stored }) });
    const rt = fakeClient({
      InvokeAgentRuntimeCommand: () => ({ response: { transformToString: async () => JSON.stringify({ answer: 'ok', searches: [] }) } }),
    });
    __setClients({ ddb: ddb.client, runtime: rt.client });
    const out = await invokeAgent({ agentId: 'agent-1', message: 'hello', userId: 'legal-b@example.com' });
    expect(out.result.answer).toBe('ok');
    const payload = JSON.parse(new TextDecoder().decode(rt.sent[0].input.payload));
    expect(payload).toEqual({
      mode: 'single',
      agent: { agentName: 'Legal reviewer', instruction: 'Review contracts.', foundationModel: stored.foundationModel, tools: ['PermissionAwareSearch'] },
      message: 'hello',
      userId: 'legal-b@example.com',
    });
    expect(rt.sent[0].input.runtimeSessionId.length).toBeGreaterThanOrEqual(33);
  });

  it('reports an error the runtime returns', async () => {
    const ddb = fakeClient({ GetCommand: () => ({ Item: stored }) });
    const rt = fakeClient({ InvokeAgentRuntimeCommand: () => ({ response: { transformToString: async () => '{"error":"message is required"}' } }) });
    __setClients({ ddb: ddb.client, runtime: rt.client });
    await expect(invokeAgent({ agentId: 'agent-1', message: 'x', userId: 'u' })).rejects.toThrow('Agent runtime: message is required');
  });

  it('sends a team as collaborators with the search tool and builds a trace', async () => {
    const rt = fakeClient({
      InvokeAgentRuntimeCommand: () => ({ response: { transformToString: async () => JSON.stringify({ answer: 'team', searches: [{ query: 'q', count: 2, files: ['a', 'b'] }] }) } }),
    });
    __setClients({ runtime: rt.client });
    const team: any = {
      teamId: 't1', teamName: 'T', description: '', supervisorAgentId: 's', supervisorAliasId: '', routingMode: 'supervisor', autoRouting: false,
      collaborators: [{ agentId: 'c1', agentAliasId: '', agentName: 'Retrieval Agent', role: 'retrieval', foundationModel: '', toolProfiles: [], trustLevel: 'user-safe', dataBoundary: 'permission-scoped', instruction: 'Find.' }],
      createdAt: '', updatedAt: '',
    };
    const out = await invokeTeam({ team, message: 'q', userId: 'u' });
    const payload = JSON.parse(new TextDecoder().decode(rt.sent[0].input.payload));
    expect(payload.mode).toBe('team');
    expect(payload.team.collaborators[0]).toMatchObject({ agentName: 'Retrieval Agent', role: 'retrieval', instruction: 'Find.', tools: ['PermissionAwareSearch'] });
    expect(out.trace.collaboratorTraces[0]).toMatchObject({ collaboratorName: 'Retrieval Agent', citationsReturned: 2, status: 'COMPLETED' });
  });
});

describe('resolveUser', () => {
  it('uses the session user', async () => {
    await signIn('legal-b@example.com');
    expect(await resolveUser(undefined)).toEqual({ userId: 'legal-b@example.com' });
    expect(await resolveUser('legal-b@example.com')).toEqual({ userId: 'legal-b@example.com' });
  });

  it('refuses a body userId that names another user', async () => {
    await signIn('legal-a@example.com');
    const out = await resolveUser('legal-b@example.com');
    expect((out as Response).status).toBe(403);
  });

  it('refuses a request without a valid session', async () => {
    expect(((await resolveUser('u')) as Response).status).toBe(401);
    cookieStore.value = 'not-a-jwt';
    expect(((await resolveUser('u')) as Response).status).toBe(401);
  });
});
