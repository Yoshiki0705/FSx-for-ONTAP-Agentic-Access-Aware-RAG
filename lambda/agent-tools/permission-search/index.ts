/**
 * Permission-aware document search — AgentCore Gateway Lambda target.
 *
 * The AgentCore Runtime agent calls this tool through the agent-tools Gateway. It runs
 * Knowledge Base Retrieve and then the SAME permission filter as the web app
 * (`docker/nextjs/src/lib/rag-pipeline/sid-filter.ts`, imported below and bundled by
 * esbuild), so the authorization boundary has one implementation.
 *
 * Event: the tool arguments, flat (`{ query, maxResults, userId }`). The tool name is in
 * `context.clientContext.custom.bedrockAgentCoreToolName` as `<target>___<tool>`.
 *
 * `userId` is set by the agent code from the signed-in user that the web app passed to
 * the Runtime, not by the model: the tool schema the model sees has no `userId`. Only the
 * Runtime's execution role can invoke the Gateway (AWS_IAM), so the caller is trusted to
 * pass the user it was invoked for. A missing `userId` returns no documents (fail-closed),
 * as does a user with no SID record.
 */
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { filterByPermissions } from '../../../docker/nextjs/src/lib/rag-pipeline/sid-filter';
import type { ParsedRetrievalResult } from '../../../docker/nextjs/src/lib/rag-pipeline/types';

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const KB_ID = process.env.KNOWLEDGE_BASE_ID || '';
const MAX_RESULTS_LIMIT = 10;

const kb = new BedrockAgentRuntimeClient({
  region: REGION,
  maxAttempts: 3,
});

export interface SearchEvent {
  query?: unknown;
  maxResults?: unknown;
  userId?: unknown;
}

export interface SearchResult {
  results: { fileName: string; s3Uri: string; content: string; score?: number; rank: number }[];
  count: number;
  /** Only `filterMethod`: nothing about denied documents reaches the model. */
  filterLog: { filterMethod?: unknown; reason?: string };
  error?: string;
}

/** 1..10, default 5. A non-numeric value falls back to the default. */
export function clampMaxResults(value: unknown): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return 5;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_RESULTS_LIMIT);
}

export async function handler(event: SearchEvent): Promise<SearchResult> {
  const query = typeof event.query === 'string' ? event.query.trim() : '';
  const userId = typeof event.userId === 'string' ? event.userId.trim() : '';
  const maxResults = clampMaxResults(event.maxResults);

  if (!query) {
    return { results: [], count: 0, filterLog: { filterMethod: 'NONE' }, error: 'query is required' };
  }
  if (!userId) {
    // Fail-closed: without the user there is nothing to match document SIDs against.
    return { results: [], count: 0, filterLog: { filterMethod: 'DENY_ALL', reason: 'no userId' } };
  }
  if (!KB_ID) {
    return { results: [], count: 0, filterLog: { filterMethod: 'NONE' }, error: 'KNOWLEDGE_BASE_ID is not set' };
  }

  // Retrieve more than needed: the permission filter removes documents after retrieval.
  const response = await kb.send(
    new RetrieveCommand({
      knowledgeBaseId: KB_ID,
      retrievalQuery: { text: query },
      retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: maxResults * 3 } },
    }),
  );
  const parsed: ParsedRetrievalResult[] = (response.retrievalResults || []).map((r) => ({
    content: r.content?.text || '',
    s3Uri: r.location?.s3Location?.uri || '',
    score: r.score,
    metadata: (r.metadata || {}) as Record<string, unknown>,
  }));

  const { allowed, filterLog } = await filterByPermissions(userId, parsed);
  const limited = allowed.slice(0, maxResults);
  console.log(
    JSON.stringify({
      event: 'permission_search',
      retrieved: parsed.length,
      allowed: allowed.length,
      returned: limited.length,
      filterMethod: filterLog.filterMethod,
    }),
  );
  return {
    results: limited.map((d, i) => ({
      fileName: d.fileName,
      s3Uri: d.s3Uri,
      content: d.content,
      score: parsed.find((p) => p.s3Uri === d.s3Uri)?.score ?? undefined,
      rank: i + 1,
    })),
    count: limited.length,
    // Only the method. The full filterLog lists every retrieved document, denied ones
    // included (fileName, documentSIDs), and this object goes to the model: returning it
    // would tell the model the names of documents the user may not read.
    filterLog: { filterMethod: filterLog.filterMethod },
  };
}
