/**
 * AgentCore Web Search Gateway Client (Mechanism C)
 *
 * us-east-1 の AgentCore Gateway に MCP protocol で Web Search ツールを呼び出す。
 * SigV4 署名付き HTTP POST でリクエストし、JSON-RPC レスポンスから
 * 検索結果（title, URL, snippet）を抽出する。
 *
 * 設計方針:
 * - Graceful degradation: 5 秒タイムアウト。失敗時は null を返し呼び出し側が KB のみで回答
 * - クエリ安全性: sanitizeWebSearchQuery() で事前サニタイズ済みの前提
 * - 引用分離: boundaryType='reference' / permissionVerified=false
 * - プロンプトインジェクション防御: wrapWebSearchResults() で結果を境界タグで囲む
 *
 * @see docs/investigations/agentcore-web-search-integration.md — §9.1, §11
 */

import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { HttpRequest } from '@smithy/protocol-http';

// ─── Configuration ─────────────────────────────────────────

const WEB_SEARCH_GATEWAY_URL = process.env.WEB_SEARCH_GATEWAY_URL || '';
const WEB_SEARCH_GATEWAY_REGION = process.env.WEB_SEARCH_GATEWAY_REGION || 'us-east-1';
/** Gateway call timeout (ms). Requests exceeding this are aborted. */
const WEB_SEARCH_GATEWAY_TIMEOUT_MS = parseInt(
  process.env.WEB_SEARCH_GATEWAY_TIMEOUT_MS || '5000',
  10,
);
const WEB_SEARCH_MAX_RESULTS = parseInt(process.env.WEB_SEARCH_MAX_RESULTS || '5', 10);

// ─── Types ─────────────────────────────────────────────────

export interface GatewayWebSearchCitation {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export interface GatewayWebSearchResult {
  /** Concatenated text from web search results */
  text: string;
  /** Extracted citations */
  citations: GatewayWebSearchCitation[];
  /** Latency in ms */
  latencyMs: number;
}

// ─── Public API ────────────────────────────────────────────

/**
 * Check if AgentCore Web Search Gateway (mechanism C) is configured.
 */
export function isGatewayWebSearchAvailable(): boolean {
  return WEB_SEARCH_GATEWAY_URL.length > 0;
}

/**
 * Invoke the AgentCore Web Search Tool via the us-east-1 Gateway.
 *
 * Returns null on any failure (timeout, network error, invalid response).
 * Caller should treat null as "Gateway unavailable, proceed with KB-only".
 *
 * @param query - Pre-sanitized search query (max 200 chars enforced here)
 * @param maxResults - Max number of results (default: env or 5)
 */
export async function invokeGatewayWebSearch(
  query: string,
  maxResults: number = WEB_SEARCH_MAX_RESULTS,
): Promise<GatewayWebSearchResult | null> {
  if (!WEB_SEARCH_GATEWAY_URL) {
    return null;
  }

  const startTime = Date.now();

  try {
    // Enforce the 200-char query limit (AgentCore Web Search constraint)
    const truncatedQuery = query.length > 200 ? query.substring(0, 200) : query;

    // Build MCP JSON-RPC request payload
    const mcpPayload = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'web_search',
        arguments: {
          query: truncatedQuery,
          max_results: maxResults,
        },
      },
      id: `ws-${Date.now()}`,
    });

    // Parse Gateway URL for signing
    const url = new URL(WEB_SEARCH_GATEWAY_URL);

    // Build the HTTP request for SigV4 signing
    const request = new HttpRequest({
      method: 'POST',
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port ? parseInt(url.port, 10) : undefined,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        host: url.hostname,
      },
      body: mcpPayload,
    });

    // Sign with SigV4 (service: bedrock-agentcore)
    const signer = new SignatureV4({
      credentials: defaultProvider(),
      region: WEB_SEARCH_GATEWAY_REGION,
      service: 'bedrock-agentcore',
      sha256: Sha256,
    });

    const signedRequest = await signer.sign(request);

    // Execute with timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEB_SEARCH_GATEWAY_TIMEOUT_MS);

    const response = await fetch(WEB_SEARCH_GATEWAY_URL, {
      method: 'POST',
      headers: signedRequest.headers as Record<string, string>,
      body: mcpPayload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[WebSearchGateway] HTTP error:', response.status, errorText.substring(0, 200));
      emitGatewayMetric('error', Date.now() - startTime, { statusCode: response.status });
      return null;
    }

    const responseBody = await response.json();
    const result = parseMcpResponse(responseBody);
    const latencyMs = Date.now() - startTime;

    emitGatewayMetric('success', latencyMs, { citationCount: result.citations.length });

    return { ...result, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorType = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network';
    console.error(`[WebSearchGateway] ${errorType}:`, error instanceof Error ? error.message : error);
    emitGatewayMetric(errorType, latencyMs);
    return null;
  }
}

// ─── Response Parsing ──────────────────────────────────────

/**
 * Parse the MCP JSON-RPC response from the Gateway into structured results.
 *
 * Expected shape (based on §9.1 verified PoC):
 * ```json
 * {
 *   "jsonrpc": "2.0",
 *   "result": {
 *     "content": [
 *       { "type": "text", "text": "..." },
 *       ...
 *     ]
 *   }
 * }
 * ```
 */
function parseMcpResponse(body: unknown): Omit<GatewayWebSearchResult, 'latencyMs'> {
  const citations: GatewayWebSearchCitation[] = [];
  let text = '';

  if (!body || typeof body !== 'object') {
    return { text: '', citations: [] };
  }

  const rpcResult = (body as Record<string, unknown>).result;
  if (!rpcResult || typeof rpcResult !== 'object') {
    // Check if it's an error response
    const rpcError = (body as Record<string, unknown>).error;
    if (rpcError) {
      console.warn('[WebSearchGateway] MCP error:', JSON.stringify(rpcError).substring(0, 300));
    }
    return { text: '', citations: [] };
  }

  const content = (rpcResult as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    return { text: '', citations: [] };
  }

  // Extract text blocks and web search result entries
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const typedBlock = block as Record<string, unknown>;

    if (typedBlock.type === 'text' && typeof typedBlock.text === 'string') {
      text += (text ? '\n' : '') + typedBlock.text;
    }

    // Web search results may come as structured resource entries
    if (typedBlock.type === 'resource' && typedBlock.resource && typeof typedBlock.resource === 'object') {
      const resource = typedBlock.resource as Record<string, unknown>;
      const title = (resource.name as string) || '';
      const uri = (resource.uri as string) || '';
      const snippet = typeof resource.text === 'string' ? resource.text : '';
      if (uri) {
        citations.push({ title, url: uri, snippet: snippet.substring(0, 500) });
      }
    }

    // Alternative: citations embedded in text block metadata
    if (typedBlock.type === 'text' && Array.isArray(typedBlock.annotations)) {
      for (const ann of typedBlock.annotations) {
        if (ann && typeof ann === 'object' && (ann as Record<string, unknown>).type === 'citation') {
          const citAnn = ann as Record<string, unknown>;
          citations.push({
            title: (citAnn.title as string) || '',
            url: (citAnn.url as string) || '',
            snippet: (citAnn.cited_text as string)?.substring(0, 500) || '',
            publishedDate: (citAnn.publishedDate as string) || undefined,
          });
        }
      }
    }
  }

  return { text, citations };
}

// ─── Observability ─────────────────────────────────────────

function emitGatewayMetric(
  outcome: 'success' | 'error' | 'timeout' | 'network',
  latencyMs: number,
  extra?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: 'RAG/WebSearchGateway',
            Dimensions: [['Outcome']],
            Metrics: [
              { Name: 'Invocations', Unit: 'Count' },
              { Name: 'LatencyMs', Unit: 'Milliseconds' },
            ],
          },
        ],
      },
      Outcome: outcome,
      Invocations: 1,
      LatencyMs: latencyMs,
      ...extra,
    }),
  );
}
