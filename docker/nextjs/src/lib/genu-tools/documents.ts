/**
 * Internal documents as tool input: Knowledge Base retrieval, then the same SID filter as
 * KB mode. Only documents the signed-in user may read come back. Nothing about the others
 * (file names, SIDs, counts per file) is returned, because the result goes to the model.
 */
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { filterByPermissions } from '@/lib/rag-pipeline/sid-filter';
import type { ParsedRetrievalResult } from '@/lib/rag-pipeline/types';

const MAX_DOCS = 5;
/** Characters of each document passed on; the tools' input limit applies to the total. */
const MAX_DOC_CHARS = 5_000;

let kb: BedrockAgentRuntimeClient | null = null;
function client(): BedrockAgentRuntimeClient {
  kb ??= new BedrockAgentRuntimeClient({
    region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-northeast-1',
    maxAttempts: 3,
  });
  return kb;
}

export function __setKbClient(c: { send: (cmd: unknown) => Promise<unknown> } | null): void {
  kb = c as BedrockAgentRuntimeClient | null;
}

export interface ToolDocument {
  fileName: string;
  content: string;
}

export async function allowedDocuments(userId: string, query: string, max = MAX_DOCS): Promise<ToolDocument[]> {
  const knowledgeBaseId = process.env.BEDROCK_KB_ID || '';
  if (!userId || !query.trim() || !knowledgeBaseId) return [];
  const limit = Math.min(Math.max(1, Math.trunc(max)), MAX_DOCS);
  const out = (await client().send(
    new RetrieveCommand({
      knowledgeBaseId,
      retrievalQuery: { text: query.slice(0, 1000) },
      retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: limit * 3 } },
    }),
  )) as { retrievalResults?: { content?: { text?: string }; location?: { s3Location?: { uri?: string } }; score?: number; metadata?: Record<string, unknown> }[] };
  const parsed: ParsedRetrievalResult[] = (out.retrievalResults || []).map((r) => ({
    content: r.content?.text || '',
    s3Uri: r.location?.s3Location?.uri || '',
    score: r.score,
    metadata: (r.metadata || {}) as Record<string, unknown>,
  }));
  const { allowed } = await filterByPermissions(userId, parsed);
  // Merge chunks of the same file, keep the order of relevance.
  const byFile = new Map<string, string[]>();
  for (const d of allowed) {
    const list = byFile.get(d.fileName) || [];
    list.push(d.content);
    byFile.set(d.fileName, list);
  }
  return [...byFile.entries()].slice(0, limit).map(([fileName, parts]) => ({
    fileName,
    content: parts.join('\n').slice(0, MAX_DOC_CHARS),
  }));
}
