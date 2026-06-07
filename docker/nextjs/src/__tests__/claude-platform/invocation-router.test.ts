/**
 * Invocation Router — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { routeInvocation } from '@/lib/claude-platform/invocation-router';

describe('routeInvocation', () => {
  beforeEach(() => {
    // Reset env vars
    vi.stubEnv('CLAUDE_PLATFORM_MODE', 'disabled');
    vi.stubEnv('ENABLE_WEB_SEARCH', 'false');
    vi.stubEnv('WEB_SEARCH_FALLBACK_THRESHOLD', '0.3');
  });

  describe('when Claude Platform is disabled', () => {
    it('always routes to Bedrock', () => {
      vi.stubEnv('CLAUDE_PLATFORM_MODE', 'disabled');
      const decision = routeInvocation([0.1], false, false);
      expect(decision.path).toBe('bedrock');
      expect(decision.useWebSearch).toBe(false);
    });

    it('routes to Bedrock even with empty KB scores', () => {
      vi.stubEnv('CLAUDE_PLATFORM_MODE', 'disabled');
      const decision = routeInvocation([], false, false);
      expect(decision.path).toBe('bedrock');
    });
  });

  describe('when Web Search is not enabled', () => {
    it('always routes to Bedrock even if platform is available', () => {
      vi.stubEnv('CLAUDE_PLATFORM_MODE', 'web-search-only');
      vi.stubEnv('ENABLE_WEB_SEARCH', 'false');
      const decision = routeInvocation([], false, false);
      expect(decision.path).toBe('bedrock');
    });
  });

  describe('when both Platform and Web Search are enabled', () => {
    beforeEach(() => {
      vi.stubEnv('CLAUDE_PLATFORM_MODE', 'web-search-only');
      vi.stubEnv('ENABLE_WEB_SEARCH', 'true');
    });

    it('routes to Bedrock when KB scores are sufficient', () => {
      const decision = routeInvocation([0.8, 0.6, 0.4], false, false);
      expect(decision.path).toBe('bedrock');
      expect(decision.useWebSearch).toBe(false);
    });

    it('routes to Claude Platform when KB scores are insufficient', () => {
      const decision = routeInvocation([0.1, 0.2], false, false);
      expect(decision.path).toBe('claude-platform');
      expect(decision.useWebSearch).toBe(true);
    });

    it('routes to Claude Platform when KB returns no results', () => {
      const decision = routeInvocation([], false, false);
      expect(decision.path).toBe('claude-platform');
      expect(decision.useWebSearch).toBe(true);
    });

    it('routes to Claude Platform when user explicitly requests web search', () => {
      const decision = routeInvocation([0.9], true, false);
      expect(decision.path).toBe('claude-platform');
      expect(decision.useWebSearch).toBe(true);
      expect(decision.reason).toContain('explicitly requested');
    });

    it('routes to Claude Platform when query has web: prefix', () => {
      const decision = routeInvocation([0.9], false, true);
      expect(decision.path).toBe('claude-platform');
      expect(decision.useWebSearch).toBe(true);
    });

    it('uses configured threshold for fallback decision', () => {
      vi.stubEnv('WEB_SEARCH_FALLBACK_THRESHOLD', '0.5');
      // Score 0.4 is below 0.5 threshold
      const decision = routeInvocation([0.4], false, false);
      expect(decision.path).toBe('claude-platform');
    });
  });
});
