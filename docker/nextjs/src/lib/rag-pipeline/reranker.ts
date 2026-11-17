/**
 * Reranking after the permission filter (RERANK_MODEL_ID set by `-c enableRerank=true`).
 *
 * Knowledge Base Retrieve can rerank on its own, but it runs before the SID filter, so the
 * reranker would receive chunks the user may not read. Here the Rerank API gets only the
 * chunks that passed the SID filter (and the chunk safety filter), and the top ones go to
 * the answer model.
 *
 * Fail-open: on an error or timeout the chunks keep the Retrieve order. This only affects
 * relevance, not permissions: whatever happens, the input is already filtered.
 *
 * Reranking is for text only, so chunks of other media types keep their place after the
 * reranked text chunks.
 */
import { BedrockAgentRuntimeClient, RerankCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import type { AllowedDocument } from './types';

/**
 * A rerank model ID (`<provider>.rerank-<version>`). Which models are allowed is decided at
 * synth time (`rerankModelId` in bin/demo-app.ts); here only the shape is checked.
 */
const RERANK_MODEL_ID = /^[a-z0-9-]+\.rerank-[a-z0-9.:-]+$/;
/** Documents per Rerank call; one call is one search unit (Bedrock user guide, rerank pricing). */
export const MAX_RERANK_SOURCES = 100;
export const DEFAULT_TOP_N = 10;
const DEFAULT_TIMEOUT_MS = 3000;

export interface RerankConfig {
  modelId: string;
  topN: number;
  timeoutMs: number;
}

export interface RerankOutcome {
  docs: AllowedDocument[];
  method: 'RERANKED' | 'SKIPPED_DISABLED' | 'SKIPPED_FEW' | 'FAILED';
  latencyMs: number;
  modelId?: string;
  error?: string;
}

/** The configuration from the environment, or null while reranking is off. */
export function rerankConfig(env: Record<string, string | undefined> = process.env): RerankConfig | null {
  const modelId = env.RERANK_MODEL_ID;
  if (!modelId) return null;
  if (!RERANK_MODEL_ID.test(modelId)) {
    console.warn(JSON.stringify({ event: 'rerank_config', error: `RERANK_MODEL_ID ${modelId} is not a rerank model ID; reranking is off` }));
    return null;
  }
  const topN = Number(env.RERANK_TOP_N || DEFAULT_TOP_N);
  const timeoutMs = Number(env.RERANK_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return {
    modelId,
    topN: Number.isInteger(topN) && topN >= 1 && topN <= MAX_RERANK_SOURCES ? topN : DEFAULT_TOP_N,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  };
}

type Sender = { send: (cmd: RerankCommand, opts?: { abortSignal?: AbortSignal }) => Promise<{ results?: { index?: number; relevanceScore?: number }[] }> };
let injected: Sender | null = null;
export function __setRerankClient(c: Sender | null): void {
  injected = c;
}

/**
 * Reorder `allowed` (already permission-filtered) by relevance to `query` and keep the top
 * `topN`. Returns the input order (trimmed) when reranking is off, has nothing to reorder,
 * or fails.
 */
export async function rerankAllowed(
  query: string,
  allowed: AllowedDocument[],
  region: string,
  config: RerankConfig | null = rerankConfig(),
): Promise<RerankOutcome> {
  const start = Date.now();
  if (!config) return { docs: allowed, method: 'SKIPPED_DISABLED', latencyMs: 0 };
  const text = allowed.filter((d) => (d.mediaType ?? 'text') === 'text' && d.content.trim());
  const other = allowed.filter((d) => !text.includes(d));
  if (text.length < 2) {
    return { docs: [...text, ...other].slice(0, config.topN), method: 'SKIPPED_FEW', latencyMs: 0, modelId: config.modelId };
  }
  const sources = text.slice(0, MAX_RERANK_SOURCES);
  const client: Sender = injected ?? (new BedrockAgentRuntimeClient({ region }) as unknown as Sender);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), config.timeoutMs);
  try {
    const resp = await client.send(
      new RerankCommand({
        queries: [{ type: 'TEXT', textQuery: { text: query } }],
        sources: sources.map((d) => ({ type: 'INLINE', inlineDocumentSource: { type: 'TEXT', textDocument: { text: d.content } } })),
        rerankingConfiguration: {
          type: 'BEDROCK_RERANKING_MODEL',
          bedrockRerankingConfiguration: {
            numberOfResults: Math.min(config.topN, sources.length),
            modelConfiguration: { modelArn: `arn:aws:bedrock:${region}::foundation-model/${config.modelId}` },
          },
        },
      }),
      { abortSignal: abort.signal },
    );
    const ranked = (resp.results || [])
      .map((r) => (typeof r.index === 'number' ? sources[r.index] : undefined))
      .filter((d): d is AllowedDocument => !!d);
    if (ranked.length === 0) throw new Error('the reranker returned no results');
    return {
      docs: [...ranked, ...other].slice(0, config.topN),
      method: 'RERANKED',
      latencyMs: Date.now() - start,
      modelId: config.modelId,
    };
  } catch (error) {
    const message = abort.signal.aborted ? `timed out after ${config.timeoutMs} ms` : error instanceof Error ? error.message : String(error);
    console.warn(JSON.stringify({ event: 'rerank_failed', modelId: config.modelId, error: message }));
    return { docs: allowed.slice(0, config.topN), method: 'FAILED', latencyMs: Date.now() - start, modelId: config.modelId, error: message };
  } finally {
    clearTimeout(timer);
  }
}
