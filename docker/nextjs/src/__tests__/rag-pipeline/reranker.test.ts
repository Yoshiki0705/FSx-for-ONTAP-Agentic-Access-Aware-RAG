// @vitest-environment node
/**
 * Reranking after the permission filter. The route test runs the real SID filter with
 * DynamoDB, Retrieve and Converse replaced, and checks what reaches the reranker.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { calls, userRecords, kbDocs, rerankBehaviour } = vi.hoisted(() => ({
  calls: { retrieve: [] as any[], rerank: [] as any[] },
  userRecords: new Map<string, Record<string, unknown>>(),
  kbDocs: [] as { name: string; sids: string[]; text: string }[],
  rerankBehaviour: { mode: 'reverse' as 'reverse' | 'fail' | 'hang' },
}));

vi.mock('@aws-sdk/client-bedrock', () => import('../model-catalog/bedrock-control-plane-mock'));
vi.mock('@aws-sdk/client-dynamodb', () => {
  class GetItemCommand { constructor(public input: { Key: { userId: { S: string } } }) {} }
  class PutItemCommand { constructor(public input: unknown) {} }
  class QueryCommand { constructor(public input: unknown) {} }
  class DynamoDBClient {
    async send(cmd: unknown) {
      if (cmd instanceof GetItemCommand) {
        const item = userRecords.get(cmd.input.Key.userId.S);
        return item ? { Item: item } : {};
      }
      return {};
    }
  }
  return { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand };
});
vi.mock('@aws-sdk/client-bedrock-agent-runtime', () => {
  class RetrieveCommand { constructor(public input: any) {} }
  class RerankCommand { constructor(public input: any) {} }
  class BedrockAgentRuntimeClient {
    async send(cmd: any, opts?: { abortSignal?: AbortSignal }) {
      if (cmd instanceof RetrieveCommand) {
        calls.retrieve.push(cmd.input);
        return {
          retrievalResults: kbDocs.map((d) => ({
            content: { text: d.text },
            location: { s3Location: { uri: `s3://bucket/${d.name}` } },
            score: 0.5,
            metadata: { allowed_group_sids: JSON.stringify(d.sids) },
          })),
        };
      }
      if (cmd instanceof RerankCommand) {
        calls.rerank.push(cmd.input);
        if (rerankBehaviour.mode === 'fail') throw new Error('AccessDeniedException');
        if (rerankBehaviour.mode === 'hang') {
          await new Promise((_, reject) => opts?.abortSignal?.addEventListener('abort', () => reject(new Error('aborted'))));
        }
        const n = cmd.input.sources.length;
        return { results: Array.from({ length: n }, (_, i) => ({ index: n - 1 - i, relevanceScore: 1 - i / n })) };
      }
      throw new Error(`unexpected ${cmd.constructor.name}`);
    }
  }
  return { BedrockAgentRuntimeClient, RetrieveCommand, RerankCommand };
});
vi.mock('@aws-sdk/client-bedrock-runtime', async (importOriginal) => {
  const real = await importOriginal<typeof import('@aws-sdk/client-bedrock-runtime')>();
  class BedrockRuntimeClient {
    async send(cmd: any) {
      const text = JSON.stringify(cmd.input?.messages ?? cmd.input ?? '');
      return { output: { message: { content: [{ text: `answer based on ${text.length} chars` }] } }, usage: { inputTokens: 1, outputTokens: 1 } };
    }
  }
  return { ...real, BedrockRuntimeClient };
});
vi.mock('@/lib/agent-backend/routes', () => ({ resolveUser: async () => ({ userId: 'dev@example.com' }) }));

import { NextRequest } from 'next/server';
import { __setRerankClient, rerankAllowed, rerankConfig } from '@/lib/rag-pipeline/reranker';
import type { AllowedDocument } from '@/lib/rag-pipeline/types';

const doc = (name: string, content: string, mediaType?: 'text' | 'image'): AllowedDocument => ({ fileName: name, s3Uri: `s3://b/${name}`, content, metadata: {}, ...(mediaType ? { mediaType } : {}) });
const cfg = { modelId: 'amazon.rerank-v1:0', topN: 2, timeoutMs: 200 };

beforeEach(() => {
  calls.retrieve.length = 0;
  calls.rerank.length = 0;
  kbDocs.length = 0;
  rerankBehaviour.mode = 'reverse';
  userRecords.clear();
  userRecords.set('dev@example.com', { userId: { S: 'dev@example.com' }, userSID: { S: 'S-1-5-21-1-1100' }, groupSIDs: { L: [{ S: 'S-1-1-0' }] } });
  process.env.BEDROCK_KB_ID = 'KBTEST';
  process.env.USER_ACCESS_TABLE_NAME = 'user-access';
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  __setRerankClient(null);
  delete process.env.RERANK_MODEL_ID;
  delete process.env.RERANK_CANDIDATES;
  vi.restoreAllMocks();
});

describe('rerankConfig', () => {
  it('is off without a model, and for a model it does not know', () => {
    expect(rerankConfig({})).toBeNull();
    expect(rerankConfig({ RERANK_MODEL_ID: 'cohere.rerank-v9' })).toBeNull();
  });
  it('reads the model, the top N and the timeout', () => {
    expect(rerankConfig({ RERANK_MODEL_ID: 'cohere.rerank-v3-5:0', RERANK_TOP_N: '5' })).toEqual({ modelId: 'cohere.rerank-v3-5:0', topN: 5, timeoutMs: 3000 });
    expect(rerankConfig({ RERANK_MODEL_ID: 'amazon.rerank-v1:0', RERANK_TOP_N: '0' })?.topN).toBe(10);
  });
});

describe('rerankAllowed', () => {
  it('does nothing while off', async () => {
    const docs = [doc('a', 'A'), doc('b', 'B')];
    const out = await rerankAllowed('q', docs, 'ap-northeast-1', null);
    expect(out).toMatchObject({ method: 'SKIPPED_DISABLED', docs });
    expect(calls.rerank).toHaveLength(0);
  });

  it('reorders by the reranker, keeps the top N, and sends only the given text', async () => {
    const out = await rerankAllowed('q', [doc('a', 'A'), doc('b', 'B'), doc('c', 'C')], 'ap-northeast-1', cfg);
    expect(out.method).toBe('RERANKED');
    expect(out.docs.map((d) => d.fileName)).toEqual(['c', 'b']);
    const sent = calls.rerank[0];
    expect(sent.sources.map((s: any) => s.inlineDocumentSource.textDocument.text)).toEqual(['A', 'B', 'C']);
    expect(sent.rerankingConfiguration.bedrockRerankingConfiguration.modelConfiguration.modelArn)
      .toBe('arn:aws:bedrock:ap-northeast-1::foundation-model/amazon.rerank-v1:0');
  });

  it('puts chunks of other media after the reranked text and does not send them', async () => {
    const out = await rerankAllowed('q', [doc('img', '', 'image'), doc('a', 'A'), doc('b', 'B')], 'ap-northeast-1', { ...cfg, topN: 3 });
    expect(out.docs.map((d) => d.fileName)).toEqual(['b', 'a', 'img']);
    expect(calls.rerank[0].sources).toHaveLength(2);
  });

  it('keeps the filtered order on an error (fail-open) and on a timeout', async () => {
    rerankBehaviour.mode = 'fail';
    const docs = [doc('a', 'A'), doc('b', 'B'), doc('c', 'C')];
    expect(await rerankAllowed('q', docs, 'ap-northeast-1', cfg)).toMatchObject({ method: 'FAILED', docs: docs.slice(0, 2) });
    rerankBehaviour.mode = 'hang';
    const out = await rerankAllowed('q', docs, 'ap-northeast-1', cfg);
    expect(out).toMatchObject({ method: 'FAILED', docs: docs.slice(0, 2) });
    expect(out.error).toMatch(/timed out/);
  });

  it('skips the call with fewer than two text chunks', async () => {
    expect((await rerankAllowed('q', [doc('a', 'A')], 'ap-northeast-1', cfg)).method).toBe('SKIPPED_FEW');
    expect(calls.rerank).toHaveLength(0);
  });
});

describe('/api/bedrock/kb/retrieve with reranking', () => {
  const post = () => new NextRequest('http://l/api/bedrock/kb/retrieve', { method: 'POST', body: JSON.stringify({ query: 'salary policy' }) });
  beforeEach(() => {
    kbDocs.push(
      { name: 'public-guideline.md', sids: ['S-1-1-0'], text: 'public guideline text' },
      { name: 'hr-salary-table.md', sids: ['S-1-5-21-1-9999'], text: 'SECRET salary table' },
      { name: 'dev-handbook.md', sids: ['S-1-5-21-1-1100'], text: 'development handbook' },
    );
  });

  it('sends the reranker only the chunks the user may read, and asks Retrieve for more candidates', async () => {
    process.env.RERANK_MODEL_ID = 'amazon.rerank-v1:0';
    process.env.RERANK_CANDIDATES = '30';
    const { POST } = await import('@/app/api/bedrock/kb/retrieve/route');
    const res = await POST(post());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(calls.retrieve[0].retrievalConfiguration.vectorSearchConfiguration.numberOfResults).toBe(30);
    const texts = calls.rerank[0].sources.map((s: any) => s.inlineDocumentSource.textDocument.text);
    expect(texts).toEqual(['public guideline text', 'development handbook']);
    expect(JSON.stringify(calls.rerank)).not.toContain('SECRET');
    expect(data.metadata.rerank).toMatchObject({ method: 'RERANKED', modelId: 'amazon.rerank-v1:0' });
    expect(data.citations.map((c: any) => c.fileName)).toEqual(['dev-handbook.md', 'public-guideline.md']);
  });

  it('does not call the reranker and keeps 10 candidates while off', async () => {
    const { POST } = await import('@/app/api/bedrock/kb/retrieve/route');
    const data = await (await POST(post())).json();
    expect(calls.rerank).toHaveLength(0);
    expect(calls.retrieve[0].retrievalConfiguration.vectorSearchConfiguration.numberOfResults).toBe(10);
    expect(data.metadata.rerank).toBeUndefined();
  });
});
