// @vitest-environment node
/**
 * Administrator role: decided only from groups an administrator sets, and required by every
 * route action that changes what all users share.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';

const { jar } = vi.hoisted(() => ({ jar: { token: undefined as string | undefined } }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'session-token' && jar.token ? { value: jar.token } : undefined) }),
}));

import { NextRequest } from 'next/server';
import { jwtSecretKey } from '@/lib/auth/secrets';
import { ADMIN_ROLE, roleFromIdTokenClaims } from '@/lib/auth/roles';

async function signIn(role: string | null) {
  jar.token = role === null
    ? undefined
    : await new SignJWT({ userId: 'u@example.com', role }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(jwtSecretKey());
}

beforeEach(() => {
  delete process.env.ADMIN_GROUP_NAMES;
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('roleFromIdTokenClaims', () => {
  const federated = { identities: [{ providerName: 'AD', providerType: 'SAML' }] };

  it('grants administrator through the Cognito admins group', () => {
    expect(roleFromIdTokenClaims({ 'cognito:groups': ['admins'] })).toBe(ADMIN_ROLE);
    expect(roleFromIdTokenClaims({ 'cognito:groups': ['Admins'] })).toBe(ADMIN_ROLE);
  });

  it('does not grant administrator from the email address', () => {
    expect(roleFromIdTokenClaims({ email: 'admin@example.com' })).toBe('user');
  });

  it('does not grant administrator for a group name that only contains "admin"', () => {
    expect(roleFromIdTokenClaims({ 'cognito:groups': ['not-admins', 'sysadmin'] })).toBe('user');
    expect(roleFromIdTokenClaims({ ...federated, 'custom:ad_groups': 'Domain Admins' })).toBe('user');
  });

  it('ignores custom:role', () => {
    expect(roleFromIdTokenClaims({ 'custom:role': 'admin' })).toBe('user');
  });

  it('reads provider groups only for a federated user', () => {
    expect(roleFromIdTokenClaims({ 'custom:ad_groups': 'admins' })).toBe('user');
    expect(roleFromIdTokenClaims({ 'custom:oidc_groups': 'admins' })).toBe('user');
    expect(roleFromIdTokenClaims({ ...federated, 'custom:ad_groups': 'Domain Users, admins' })).toBe(ADMIN_ROLE);
    expect(roleFromIdTokenClaims({ ...federated, 'custom:oidc_groups': 'admins' })).toBe(ADMIN_ROLE);
  });

  it('uses ADMIN_GROUP_NAMES when set', () => {
    process.env.ADMIN_GROUP_NAMES = 'Domain Admins, rag-operators';
    expect(roleFromIdTokenClaims({ ...federated, 'custom:ad_groups': 'domain admins' })).toBe(ADMIN_ROLE);
    expect(roleFromIdTokenClaims({ 'cognito:groups': ['rag-operators'] })).toBe(ADMIN_ROLE);
    expect(roleFromIdTokenClaims({ 'cognito:groups': ['admins'] })).toBe('user');
  });
});

const post = (url: string, body: unknown) => new NextRequest(url, { method: 'POST', body: JSON.stringify(body) });

// Each case builds a request for one guarded operation.
const guarded: Array<[string, () => Promise<Response>]> = [
  ['agents/delete DELETE', async () => (await import('@/app/api/bedrock/agents/delete/route')).DELETE(new NextRequest('http://l/api/bedrock/agents/delete?agentId=A', { method: 'DELETE' }))],
  ['create-agent POST', async () => (await import('@/app/api/bedrock/create-agent/route')).POST(post('http://l/api/bedrock/create-agent', { name: 'x' }))],
  ['update-agent-model POST', async () => (await import('@/app/api/bedrock/update-agent-model/route')).POST(post('http://l/api/bedrock/update-agent-model', {}))],
  ['agent-policy POST', async () => (await import('@/app/api/bedrock/agent-policy/route')).POST(post('http://l/api/bedrock/agent-policy', {}))],
  ['agent-policy PUT', async () => (await import('@/app/api/bedrock/agent-policy/route')).PUT(new NextRequest('http://l/api/bedrock/agent-policy', { method: 'PUT', body: '{}' }))],
  ['agent-policy DELETE', async () => (await import('@/app/api/bedrock/agent-policy/route')).DELETE(new NextRequest('http://l/api/bedrock/agent-policy?policyEngineId=e&policyId=p', { method: 'DELETE' }))],
  ['agent-registry/publish POST', async () => (await import('@/app/api/bedrock/agent-registry/publish/route')).POST(post('http://l/api/bedrock/agent-registry/publish', {}))],
  ['agent-registry/import POST', async () => (await import('@/app/api/bedrock/agent-registry/import/route')).POST(post('http://l/api/bedrock/agent-registry/import', {}))],
  ['audit-logs GET', async () => (await import('@/app/api/bedrock/audit-logs/route')).GET(new NextRequest('http://l/api/bedrock/audit-logs'))],
  ...['createSchedule', 'updateSchedule', 'deleteSchedule', 'manualTrigger'].map((action): [string, () => Promise<Response>] => [`agent-schedules ${action}`, async () => (await import('@/app/api/bedrock/agent-schedules/route')).POST(post('http://l/api/bedrock/agent-schedules', { action }))]),
  ...['uploadSharedConfig', 'importConfig'].map((action): [string, () => Promise<Response>] => [`agent-sharing ${action}`, async () => (await import('@/app/api/bedrock/agent-sharing/route')).POST(post('http://l/api/bedrock/agent-sharing', { action }))]),
  ...['create', 'update', 'delete'].map((action): [string, () => Promise<Response>] => [`agent-team ${action}`, async () => (await import('@/app/api/bedrock/agent-team/route')).POST(post('http://l/api/bedrock/agent-team', { action }))]),
  ...['save', 'delete'].map((action): [string, () => Promise<Response>] => [`agent-team/templates ${action}`, async () => (await import('@/app/api/bedrock/agent-team/templates/route')).POST(post('http://l/api/bedrock/agent-team/templates', { action }))]),
  ...['create', 'update', 'delete', 'associateKnowledgeBase', 'disassociateKnowledgeBase'].map((action): [string, () => Promise<Response>] => [`agent ${action}`, async () => (await import('@/app/api/bedrock/agent/route')).POST(post('http://l/api/bedrock/agent', { action }))]),
];

describe.each(guarded)('%s', (_name, call) => {
  it('refuses a signed-in user who is not an administrator (403)', async () => {
    await signIn('user');
    expect((await call()).status).toBe(403);
  });
  it('refuses without a session (401)', async () => {
    await signIn(null);
    expect((await call()).status).toBe(401);
  });
});

describe('an administrator passes the check', () => {
  it('reaches the route body (agents/delete without agentId gives 400)', async () => {
    await signIn(ADMIN_ROLE);
    const { DELETE } = await import('@/app/api/bedrock/agents/delete/route');
    expect((await DELETE(new NextRequest('http://l/api/bedrock/agents/delete', { method: 'DELETE' }))).status).toBe(400);
  });
});
