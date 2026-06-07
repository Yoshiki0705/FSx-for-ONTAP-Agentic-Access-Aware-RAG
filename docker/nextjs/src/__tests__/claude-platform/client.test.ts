/**
 * Claude Platform Client — Unit Tests (fetch mock)
 *
 * Tests cover:
 * 1. Successful web search call
 * 2. API error handling (non-200 response)
 * 3. Network timeout (AbortController)
 * 4. Missing API key → returns null
 * 5. Platform disabled → returns null
 * 6. Response parsing (text + citations extraction)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callWithWebSearch, isClaudePlatformAvailable } from '@/lib/claude-platform/client';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('callWithWebSearch', () => {
  beforeEach(() => {
    vi.stubEnv('CLAUDE_PLATFORM_MODE', 'web-search-only');
    vi.stubEnv('CLAUDE_PLATFORM_API_KEY', 'test-api-key-123');
    vi.stubEnv('CLAUDE_PLATFORM_REGION', 'ap-northeast-1');
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns parsed response on successful API call', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: 'AWS Bedrock is a managed AI service.',
            citations: [
              { title: 'AWS Docs', url: 'https://docs.aws.amazon.com/bedrock/', cited_text: 'Bedrock overview' },
            ],
          },
        ],
        model: 'claude-sonnet-4-6-20260220',
        usage: { input_tokens: 150, output_tokens: 50 },
      }),
    });

    const result = await callWithWebSearch('What is Amazon Bedrock?', 'You are a helpful assistant.');

    expect(result).not.toBeNull();
    expect(result!.text).toContain('AWS Bedrock is a managed AI service');
    expect(result!.citations).toHaveLength(1);
    expect(result!.citations![0].title).toBe('AWS Docs');
    expect(result!.citations![0].url).toBe('https://docs.aws.amazon.com/bedrock/');
    expect(result!.model).toBe('claude-sonnet-4-6-20260220');
    expect(result!.usage.inputTokens).toBe(150);
    expect(result!.usage.outputTokens).toBe(50);
  });

  it('returns null on API error (non-200)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });

    const result = await callWithWebSearch('test query', 'system');

    expect(result).toBeNull();
  });

  it('returns null on network timeout', async () => {
    mockFetch.mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        setTimeout(() => reject(error), 50);
      });
    });

    const result = await callWithWebSearch('test query', 'system');

    expect(result).toBeNull();
  });

  it('returns null when platform is disabled', async () => {
    vi.stubEnv('CLAUDE_PLATFORM_MODE', 'disabled');

    const result = await callWithWebSearch('test query', 'system');

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null when API key is missing', async () => {
    // Need to reimport to clear module-level cache from previous tests
    vi.resetModules();
    vi.stubEnv('CLAUDE_PLATFORM_MODE', 'web-search-only');
    vi.stubEnv('CLAUDE_PLATFORM_API_KEY', '');
    const { callWithWebSearch: freshCall } = await import('@/lib/claude-platform/client');

    const result = await freshCall('test query', 'system');

    expect(result).toBeNull();
  });

  it('sends correct headers and body to API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-sonnet-4-6-20260220',
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });

    await callWithWebSearch('test query', 'system prompt', 'claude-sonnet-4-6-20260220');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    expect(url).toContain('/v1/messages');
    expect(options.method).toBe('POST');
    expect(options.headers['x-api-key']).toBe('test-api-key-123');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(options.body);
    expect(body.model).toBe('claude-sonnet-4-6-20260220');
    expect(body.system).toBe('system prompt');
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].type).toBe('web_search_20260209');
    expect(body.messages[0].content).toBe('test query');
  });

  it('handles response without citations gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Simple answer without citations' }],
        model: 'claude-sonnet-4-6-20260220',
        usage: { input_tokens: 30, output_tokens: 10 },
      }),
    });

    const result = await callWithWebSearch('simple question', 'system');

    expect(result).not.toBeNull();
    expect(result!.text).toBe('Simple answer without citations');
    expect(result!.citations).toBeUndefined();
  });

  it('includes AbortSignal in fetch request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'ok' }],
        model: 'test',
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });

    await callWithWebSearch('test', 'system');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.signal).toBeDefined();
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('isClaudePlatformAvailable', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when mode is enabled and API key is set', () => {
    vi.stubEnv('CLAUDE_PLATFORM_MODE', 'web-search-only');
    vi.stubEnv('CLAUDE_PLATFORM_API_KEY', 'key-123');

    expect(isClaudePlatformAvailable()).toBe(true);
  });

  it('returns false when mode is disabled', () => {
    vi.stubEnv('CLAUDE_PLATFORM_MODE', 'disabled');
    vi.stubEnv('CLAUDE_PLATFORM_API_KEY', 'key-123');

    expect(isClaudePlatformAvailable()).toBe(false);
  });

  it('returns false when API key is missing', () => {
    vi.stubEnv('CLAUDE_PLATFORM_MODE', 'web-search-only');
    vi.stubEnv('CLAUDE_PLATFORM_API_KEY', '');

    expect(isClaudePlatformAvailable()).toBe(false);
  });
});
