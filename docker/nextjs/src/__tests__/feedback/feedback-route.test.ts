// @vitest-environment node
/**
 * POST /api/feedback: when it refuses, when it reports success, and what it sends to the
 * collector. The session and the Lambda are fakes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { session } = vi.hoisted(() => ({ session: { user: 'real-user@example.com' as string | null } }));
vi.mock('@/lib/agent-backend', () => ({ sessionUserId: async () => session.user }));

import { NextRequest } from 'next/server';
import { __setLambdaClient, POST } from '@/app/api/feedback/route';
import { docIdOf, docIdsOf } from '@/lib/feedback/doc-id';

let invoked: Record<string, unknown>[] = [];
function lambdaAnswers(answer: { FunctionError?: string; payload?: unknown } | Error) {
  __setLambdaClient({
    send: async (cmd: { input: { Payload: Buffer } }) => {
      invoked.push(JSON.parse(cmd.input.Payload.toString()));
      if (answer instanceof Error) throw answer;
      return { FunctionError: answer.FunctionError, Payload: new TextEncoder().encode(JSON.stringify(answer.payload ?? {})) };
    },
  });
}
const post = (body: unknown, raw?: string) =>
  POST(new NextRequest('http://localhost/api/feedback', { method: 'POST', body: raw ?? JSON.stringify(body) }));

beforeEach(() => {
  process.env.FEEDBACK_FUNCTION_NAME = 'collector';
  session.user = 'real-user@example.com';
  invoked = [];
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  __setLambdaClient(null);
  delete process.env.FEEDBACK_FUNCTION_NAME;
  vi.restoreAllMocks();
});

const ok = { rating: 'positive', responseId: 'sess-1-m2' };

describe('refusals', () => {
  it('answers 503 when no collector is configured, and never reports success', async () => {
    delete process.env.FEEDBACK_FUNCTION_NAME;
    lambdaAnswers({ payload: { statusCode: 200, feedbackId: 'x' } });
    const res = await post(ok);
    expect(res.status).toBe(503);
    expect((await res.json()).success).toBe(false);
    expect(invoked).toHaveLength(0);
  });
  it('answers 401 without a session', async () => {
    session.user = null;
    lambdaAnswers({ payload: { statusCode: 200, feedbackId: 'x' } });
    expect((await post(ok)).status).toBe(401);
    expect(invoked).toHaveLength(0);
  });
  it.each([
    [{ ...ok, rating: 'meh' }],
    [{ ...ok, rating: undefined }],
    [{ ...ok, responseId: '' }],
    [{ ...ok, responseId: '../x' }],
    [{ ...ok, responseId: 'x'.repeat(65) }],
  ])('answers 400 for %j and does not call the Lambda', async (body) => {
    lambdaAnswers({ payload: { statusCode: 200, feedbackId: 'x' } });
    expect((await post(body)).status).toBe(400);
    expect(invoked).toHaveLength(0);
  });
  it('answers 400 for a body that is not JSON', async () => {
    expect((await post(null, 'not json')).status).toBe(400);
  });
});

describe('what is reported', () => {
  it('reports success with the id only when the Lambda saved it', async () => {
    lambdaAnswers({ payload: { statusCode: 200, feedbackId: 'fb-1' } });
    const res = await post(ok);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, feedbackId: 'fb-1' });
  });
  it.each([
    ['a Lambda error', { FunctionError: 'Unhandled' }],
    ['a 500 from the Lambda', { payload: { statusCode: 500, error: 'failed to save feedback' } }],
    ['an answer with no id', { payload: { statusCode: 200 } }],
    ['an unknown status', { payload: { statusCode: 302 } }],
  ])('answers 502 on %s', async (_label, answer) => {
    lambdaAnswers(answer as { FunctionError?: string; payload?: unknown });
    const res = await post(ok);
    expect(res.status).toBe(502);
    expect((await res.json()).success).toBe(false);
  });
  it('answers 502 when the invoke itself fails', async () => {
    lambdaAnswers(new Error('AccessDenied'));
    expect((await post(ok)).status).toBe(502);
  });
  it('passes a 400 from the Lambda on as 400', async () => {
    lambdaAnswers({ payload: { statusCode: 400, error: 'modelId has an unsupported form' } });
    const res = await post({ ...ok, modelId: 'bad model' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('modelId');
  });
});

describe('what is sent to the Lambda', () => {
  it('takes the user from the session, not from the body or a cookie', async () => {
    lambdaAnswers({ payload: { statusCode: 200, feedbackId: 'x' } });
    await post({ ...ok, userId: 'victim@example.com' });
    expect(invoked[0].userId).toBe('real-user@example.com');
  });
  it('sends hashes of the cited URIs, never the URIs or file names', async () => {
    lambdaAnswers({ payload: { statusCode: 200, feedbackId: 'x' } });
    await post({ ...ok, sourcePaths: ['s3://alias/hr/salary-table.md', 's3://alias/hr/salary-table.md', 's3://alias/public/guide.md'] });
    const sent = JSON.stringify(invoked[0]);
    expect(sent).not.toContain('salary-table');
    expect(sent).not.toContain('s3://');
    expect(invoked[0].sourceDocIds).toEqual([docIdOf('s3://alias/hr/salary-table.md'), docIdOf('s3://alias/public/guide.md')]);
  });
  it('cuts long text and keeps only the fields the collector stores', async () => {
    lambdaAnswers({ payload: { statusCode: 200, feedbackId: 'x' } });
    await post({ ...ok, comment: 'c'.repeat(5000), query: 'q'.repeat(5000), answer: 'THE ANSWER', documents: ['DOC'] });
    expect((invoked[0].comment as string).length).toBe(1000);
    expect((invoked[0].query as string).length).toBe(500);
    expect(JSON.stringify(invoked[0])).not.toContain('THE ANSWER');
    expect(Object.keys(invoked[0]).sort()).toEqual(['comment', 'modelId', 'query', 'rating', 'responseId', 'routingTier', 'sourceDocIds', 'userId']);
  });
});

describe('document ids', () => {
  it('are 24 hex characters, stable, and capped at 20', () => {
    expect(docIdOf('s3://a/b')).toMatch(/^[0-9a-f]{24}$/);
    expect(docIdOf('s3://a/b')).toBe(docIdOf('s3://a/b'));
    // The same vector is in scripts/resolve-feedback-doc-ids.py's self-test.
    expect(docIdOf('s3://example-alias/legal/nda.md')).toBe('8e7bb18f7b9542ddd7f6c9a6');
    expect(docIdsOf(Array.from({ length: 30 }, (_, i) => `s3://a/${i}`))).toHaveLength(20);
    expect(docIdsOf('not a list')).toEqual([]);
    expect(docIdsOf([1, null, '', 's3://ok'])).toEqual([docIdOf('s3://ok')]);
  });
});
