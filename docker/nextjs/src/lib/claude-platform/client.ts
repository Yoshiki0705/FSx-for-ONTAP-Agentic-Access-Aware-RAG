/**
 * Claude Platform on AWS — API Client
 *
 * Anthropic's native platform accessible through AWS accounts.
 * Provides Web Search, Citations, MCP Connector, and Managed Agents.
 *
 * Configuration:
 *   - CLAUDE_PLATFORM_MODE: 'disabled' | 'web-search-only' | 'full'
 *   - CLAUDE_PLATFORM_API_KEY: Secrets Manager ARN or direct key
 *   - CLAUDE_PLATFORM_REGION: Region for Claude Platform (default: same as deployment)
 *
 * @see docs/design/2026q2-ai-update-roadmap.md — Phase 3
 * @see .kiro/specs/claude-platform-integration/requirements.md
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// ─── Types ─────────────────────────────────────────────────

export type ClaudePlatformMode = 'disabled' | 'web-search-only' | 'full';

export interface ClaudePlatformConfig {
  mode: ClaudePlatformMode;
  apiKey?: string;
  region: string;
  baseUrl: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export interface ClaudePlatformResponse {
  text: string;
  citations?: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  webSearchResults?: WebSearchResult[];
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ─── Configuration ─────────────────────────────────────────

let cachedApiKey: string | undefined;

/**
 * Build Claude Platform configuration from environment variables.
 */
export function buildClaudePlatformConfig(): ClaudePlatformConfig {
  const mode = (process.env.CLAUDE_PLATFORM_MODE || 'disabled') as ClaudePlatformMode;
  const region = process.env.CLAUDE_PLATFORM_REGION || process.env.AWS_REGION || 'ap-northeast-1';
  const baseUrl = `https://api.claude.${region}.aws.anthropic.com`;

  return { mode, region, baseUrl };
}

/**
 * Resolve API key (from env var or Secrets Manager).
 * Caches the key after first resolution.
 */
async function resolveApiKey(): Promise<string | undefined> {
  if (cachedApiKey) return cachedApiKey;

  const keyOrArn = process.env.CLAUDE_PLATFORM_API_KEY;
  if (!keyOrArn) return undefined;

  // If it looks like a Secrets Manager ARN, fetch the secret
  if (keyOrArn.startsWith('arn:aws:secretsmanager:')) {
    try {
      const client = new SecretsManagerClient({});
      const response = await client.send(
        new GetSecretValueCommand({ SecretId: keyOrArn })
      );
      cachedApiKey = response.SecretString;
      return cachedApiKey;
    } catch (error) {
      console.error('[ClaudePlatform] Failed to resolve API key from Secrets Manager:', error);
      return undefined;
    }
  }

  // Direct key value
  cachedApiKey = keyOrArn;
  return cachedApiKey;
}

// ─── API Client ────────────────────────────────────────────

/**
 * Call Claude Platform Messages API with Web Search tool enabled.
 *
 * This is used when:
 * - KB search returns insufficient results (score < threshold)
 * - User explicitly requests web search
 * - CLAUDE_PLATFORM_MODE is 'web-search-only' or 'full'
 *
 * @param query - Sanitized search query (PII removed by sanitizer)
 * @param systemPrompt - System prompt for response generation
 * @param model - Model to use (default: claude-sonnet-4-6)
 */
export async function callWithWebSearch(
  query: string,
  systemPrompt: string,
  model: string = 'claude-sonnet-4-6-20260220',
): Promise<ClaudePlatformResponse | null> {
  const config = buildClaudePlatformConfig();

  if (config.mode === 'disabled') {
    console.log('[ClaudePlatform] Mode is disabled, skipping web search');
    return null;
  }

  const apiKey = await resolveApiKey();
  if (!apiKey) {
    console.warn('[ClaudePlatform] No API key available, falling back to Bedrock-only mode');
    return null;
  }

  try {
    const response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: systemPrompt,
        tools: [
          {
            type: 'web_search_20260209',
            name: 'web_search',
            // Dynamic filtering enabled for token optimization
          },
        ],
        messages: [
          { role: 'user', content: query },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ClaudePlatform] API error:', response.status, errorText.substring(0, 200));
      return null;
    }

    const data = await response.json();

    // Extract text and citations from response
    const textBlocks = data.content?.filter((b: any) => b.type === 'text') || [];
    const text = textBlocks.map((b: any) => b.text).join('\n');

    // Extract web search citations
    const citations = data.content
      ?.filter((b: any) => b.type === 'text' && b.citations)
      ?.flatMap((b: any) => b.citations || [])
      ?.map((c: any) => ({
        title: c.title || '',
        url: c.url || '',
        snippet: c.cited_text || '',
      })) || [];

    return {
      text,
      citations: citations.length > 0 ? citations : undefined,
      model: data.model || model,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
    };
  } catch (error) {
    console.error('[ClaudePlatform] Request failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Check if Claude Platform is available and configured.
 */
export function isClaudePlatformAvailable(): boolean {
  const config = buildClaudePlatformConfig();
  return config.mode !== 'disabled' && !!process.env.CLAUDE_PLATFORM_API_KEY;
}
