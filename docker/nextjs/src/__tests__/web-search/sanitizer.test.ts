/**
 * Web Search Sanitizer — Unit Tests
 *
 * Tests cover:
 * 1. PII removal (emails, AWS account IDs, SIDs)
 * 2. Internal content removal (quoted text, file paths)
 * 3. Private IP removal
 * 4. Domain blocklist checking
 * 5. Web search fallback threshold
 */
import { describe, it, expect } from 'vitest';
import {
  sanitizeWebSearchQuery,
  isDomainBlocked,
  shouldFallbackToWebSearch,
} from '@/lib/web-search/sanitizer';

describe('sanitizeWebSearchQuery', () => {
  it('removes AWS Account IDs (12 digits)', () => {
    const result = sanitizeWebSearchQuery('Check account 178625946981 for S3 access');
    expect(result).not.toContain('178625946981');
    expect(result).toContain('Check account');
  });

  it('removes email addresses', () => {
    const result = sanitizeWebSearchQuery('Contact admin@example.com for access');
    expect(result).not.toContain('admin@example.com');
  });

  it('removes SID patterns', () => {
    const result = sanitizeWebSearchQuery('User has SID S-1-5-21-1234567890-1234567890-1234567890-1001');
    expect(result).not.toContain('S-1-5-21');
  });

  it('removes UID/GID references', () => {
    const result = sanitizeWebSearchQuery('Check UID:1001 and GID:2000 permissions');
    expect(result).not.toContain('UID:1001');
    expect(result).not.toContain('GID:2000');
  });

  it('removes Japanese quoted content', () => {
    const result = sanitizeWebSearchQuery('「機密文書の内容がここに書かれている」を検索');
    expect(result).not.toContain('機密文書');
    expect(result).toContain('を検索');
  });

  it('removes long English quoted content (50+ chars)', () => {
    const longQuote = '"This is a very long internal document content that should be removed from search queries because it is confidential"';
    const result = sanitizeWebSearchQuery(`Search for ${longQuote} related topics`);
    expect(result).not.toContain('confidential');
  });

  it('preserves short English quoted content', () => {
    const result = sanitizeWebSearchQuery('What is "Amazon S3"?');
    expect(result).toContain('"Amazon S3"');
  });

  it('removes private IP addresses (10.x)', () => {
    const result = sanitizeWebSearchQuery('Access server at 10.0.1.25 for files');
    expect(result).not.toContain('10.0.1.25');
  });

  it('removes private IP addresses (172.16-31.x)', () => {
    const result = sanitizeWebSearchQuery('VPN endpoint 172.16.0.1 is down');
    expect(result).not.toContain('172.16.0.1');
  });

  it('removes private IP addresses (192.168.x)', () => {
    const result = sanitizeWebSearchQuery('Printer at 192.168.1.100');
    expect(result).not.toContain('192.168.1.100');
  });

  it('removes UNC paths', () => {
    const result = sanitizeWebSearchQuery('File at \\\\server01\\share\\confidential\\report.pdf');
    expect(result).not.toContain('\\\\server01');
  });

  it('removes Unix internal paths', () => {
    const result = sanitizeWebSearchQuery('Log at /var/log/app/error.log shows issue');
    expect(result).not.toContain('/var/log');
  });

  it('normalizes whitespace', () => {
    const result = sanitizeWebSearchQuery('  multiple   spaces    here  ');
    expect(result).toBe('multiple spaces here');
  });

  it('handles empty string', () => {
    expect(sanitizeWebSearchQuery('')).toBe('');
  });

  it('preserves normal search queries', () => {
    const query = 'How to configure Amazon Bedrock Knowledge Base with S3';
    expect(sanitizeWebSearchQuery(query)).toBe(query);
  });
});

describe('isDomainBlocked', () => {
  it('blocks internal domains', () => {
    expect(isDomainBlocked('https://wiki.internal.company.com/page')).toBe(true);
  });

  it('blocks corp domains', () => {
    expect(isDomainBlocked('https://portal.corp.example.com')).toBe(true);
  });

  it('blocks .local domains', () => {
    expect(isDomainBlocked('https://server.local/resource')).toBe(true);
  });

  it('allows public domains', () => {
    expect(isDomainBlocked('https://docs.aws.amazon.com/bedrock/')).toBe(false);
  });

  it('allows custom domains', () => {
    expect(isDomainBlocked('https://example.com/page')).toBe(false);
  });

  it('blocks invalid URLs (safety)', () => {
    expect(isDomainBlocked('not-a-valid-url')).toBe(true);
  });

  it('uses custom blocklist', () => {
    expect(isDomainBlocked('https://competitor.com/page', ['competitor.com'])).toBe(true);
    expect(isDomainBlocked('https://allowed.com/page', ['competitor.com'])).toBe(false);
  });
});

describe('shouldFallbackToWebSearch', () => {
  it('returns true when no results', () => {
    expect(shouldFallbackToWebSearch([])).toBe(true);
  });

  it('returns true when all scores below threshold', () => {
    expect(shouldFallbackToWebSearch([0.1, 0.2, 0.15], 0.3)).toBe(true);
  });

  it('returns false when any score above threshold', () => {
    expect(shouldFallbackToWebSearch([0.1, 0.5, 0.2], 0.3)).toBe(false);
  });

  it('returns false when score equals threshold', () => {
    expect(shouldFallbackToWebSearch([0.3], 0.3)).toBe(false);
  });

  it('uses default threshold of 0.3', () => {
    expect(shouldFallbackToWebSearch([0.29])).toBe(true);
    expect(shouldFallbackToWebSearch([0.31])).toBe(false);
  });
});
