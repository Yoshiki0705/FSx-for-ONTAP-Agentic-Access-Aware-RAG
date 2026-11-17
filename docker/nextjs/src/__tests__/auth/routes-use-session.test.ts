// @vitest-environment node
/**
 * Routes that act for a user take the user from the session. A user named in the request
 * that is not the signed-in user is refused before any lookup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { session } = vi.hoisted(() => ({ session: { user: 'a@example.com' as string | null } }));
vi.mock('@/lib/agent-backend', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/agent-backend')>();
  return { ...real, sessionUserId: async () => session.user };
});
// The routes below must not reach AWS in these cases; fail loudly if they try.
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class { send() { throw new Error('DynamoDB must not be called'); } },
  GetItemCommand: class {},
  QueryCommand: class {},
  PutItemCommand: class {},
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send() { throw new Error('DynamoDB must not be called'); } }) },
  QueryCommand: class {},
  PutCommand: class {},
  GetCommand: class {},
}));

import { NextRequest } from 'next/server';

beforeEach(() => {
  session.user = 'a@example.com';
  process.env.BEDROCK_KB_ID = 'KB';
  process.env.CHAT_HISTORY_TABLE_NAME = 't';
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const json = (url: string, body: unknown) => new NextRequest(url, { method: 'POST', body: JSON.stringify(body) });

describe('kb/retrieve', () => {
  it('refuses another user named in the body (403)', async () => {
    const { POST } = await import('@/app/api/bedrock/kb/retrieve/route');
    const res = await POST(json('http://localhost/api/bedrock/kb/retrieve', { query: 'q', userId: 'b@example.com' }));
    expect(res.status).toBe(403);
  });
  it('refuses without a session (401)', async () => {
    session.user = null;
    const { POST } = await import('@/app/api/bedrock/kb/retrieve/route');
    expect((await POST(json('http://localhost/api/bedrock/kb/retrieve', { query: 'q' }))).status).toBe(401);
  });
});

describe('kb/image-search', () => {
  it('refuses another user named in the body (403)', async () => {
    const { POST } = await import('@/app/api/bedrock/kb/image-search/route');
    const res = await POST(json('http://localhost/api/bedrock/kb/image-search', { imageData: 'eA==', imageMimeType: 'image/png', userId: 'b@example.com' }));
    expect([400, 403]).toContain(res.status);
    if (res.status === 400) expect((await res.json()).error).not.toMatch(/userId/);
  });
});

describe('chat history', () => {
  it("refuses another user's history in the path (403)", async () => {
    const { GET } = await import('@/app/api/chat/history/[userId]/route');
    const res = await GET(new NextRequest('http://localhost/api/chat/history/b@example.com'), { params: Promise.resolve({ userId: 'b@example.com' }) });
    expect(res.status).toBe(403);
  });
  it('refuses to save under another user (403)', async () => {
    const { POST } = await import('@/app/api/chat/save/route');
    const res = await POST(json('http://localhost/api/chat/save', { sessionId: 's', userId: 'b@example.com', messages: [] }));
    expect(res.status).toBe(403);
  });
});

describe('fsx/directories', () => {
  it('refuses another username in the query (403)', async () => {
    const { GET } = await import('@/app/api/fsx/directories/route');
    const res = await GET(new NextRequest('http://localhost/api/fsx/directories?username=b@example.com'));
    expect(res.status).toBe(403);
  });
});

describe('bedrock/chat', () => {
  it('refuses another user named in the body (403)', async () => {
    const { POST } = await import('@/app/api/bedrock/chat/route');
    const res = await POST(json('http://localhost/api/bedrock/chat', { message: 'hi', userId: 'b@example.com' }));
    expect(res.status).toBe(403);
  });
});

describe('auth/session', () => {
  it('no longer creates, updates or deletes sessions', async () => {
    const mod = await import('@/app/api/auth/session/route');
    for (const m of ['POST', 'PUT', 'DELETE'] as const) {
      const res = await (mod[m] as () => Response)();
      expect(res.status).toBe(405);
    }
  });
});
