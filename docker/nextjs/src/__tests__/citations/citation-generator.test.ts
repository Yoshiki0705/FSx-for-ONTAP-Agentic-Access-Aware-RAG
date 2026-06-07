/**
 * Citation Generator — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  generateCitations,
  insertCitationMarkers,
  appendCitationList,
  buildCitedResponse,
  type RetrieveResult,
} from '@/lib/citations/citation-generator';

describe('generateCitations', () => {
  it('generates citations from retrieve results', () => {
    const results: RetrieveResult[] = [
      { fileName: 'report.pdf', content: 'Some content here', sourceUri: 's3://bucket/report.pdf', score: 0.9 },
      { fileName: 'guide.md', content: 'Guide content', sourceUri: 's3://bucket/guide.md', score: 0.7 },
    ];

    const citations = generateCitations(results);
    expect(citations).toHaveLength(2);
    expect(citations[0].index).toBe(1);
    expect(citations[0].sourceName).toBe('report.pdf');
    expect(citations[0].boundaryType).toBe('verified');
    expect(citations[0].permissionVerified).toBe(true);
    expect(citations[1].index).toBe(2);
  });

  it('deduplicates same-document chunks', () => {
    const results: RetrieveResult[] = [
      { fileName: 'report.pdf', content: 'Chunk 1', score: 0.9 },
      { fileName: 'report.pdf', content: 'Chunk 2', score: 0.8 },
      { fileName: 'guide.md', content: 'Guide', score: 0.7 },
    ];

    const citations = generateCitations(results);
    expect(citations).toHaveLength(2);
    expect(citations[0].excerpt).toBe('Chunk 1'); // First chunk preserved
  });

  it('assigns reference boundary for web sources', () => {
    const results: RetrieveResult[] = [
      { fileName: 'AWS Docs', content: 'Web content', sourceType: 'web', score: 0.5 },
    ];

    const citations = generateCitations(results);
    expect(citations[0].boundaryType).toBe('reference');
    expect(citations[0].permissionVerified).toBe(false);
  });

  it('handles empty results', () => {
    expect(generateCitations([])).toHaveLength(0);
  });

  it('truncates excerpt to 200 characters', () => {
    const longContent = 'A'.repeat(500);
    const results: RetrieveResult[] = [
      { fileName: 'long.pdf', content: longContent, score: 0.9 },
    ];

    const citations = generateCitations(results);
    expect(citations[0].excerpt).toHaveLength(200);
  });
});

describe('insertCitationMarkers', () => {
  it('inserts markers where document name appears', () => {
    const text = 'According to report.pdf, the data shows...';
    const citations = [{ index: 1, sourceName: 'report.pdf', sourceType: 'kb' as const, boundaryType: 'verified' as const, excerpt: '', relevanceScore: 0.9, permissionVerified: true }];

    const result = insertCitationMarkers(text, citations);
    expect(result).toContain('report.pdf [1]');
  });

  it('handles text without document names gracefully', () => {
    const text = 'The analysis shows positive results.';
    const citations = [{ index: 1, sourceName: 'report.pdf', sourceType: 'kb' as const, boundaryType: 'verified' as const, excerpt: '', relevanceScore: 0.9, permissionVerified: true }];

    const result = insertCitationMarkers(text, citations);
    expect(result).toBe(text); // No change
  });

  it('handles special regex characters in file names', () => {
    const text = 'Found in file (v2.0).pdf section.';
    const citations = [{ index: 1, sourceName: '(v2.0).pdf', sourceType: 'kb' as const, boundaryType: 'verified' as const, excerpt: '', relevanceScore: 0.9, permissionVerified: true }];

    const result = insertCitationMarkers(text, citations);
    expect(result).toContain('(v2.0).pdf [1]');
  });
});

describe('appendCitationList', () => {
  it('appends sources list at the end', () => {
    const text = 'Response text here.';
    const citations = [
      { index: 1, sourceName: 'report.pdf', sourceType: 'kb' as const, boundaryType: 'verified' as const, excerpt: '', relevanceScore: 0.9, permissionVerified: true },
      { index: 2, sourceName: 'AWS Docs', sourceType: 'web' as const, boundaryType: 'reference' as const, excerpt: '', relevanceScore: 0.5, permissionVerified: false },
    ];

    const result = appendCitationList(text, citations);
    expect(result).toContain('**Sources:**');
    expect(result).toContain('[1] 🔒 report.pdf');
    expect(result).toContain('[2] 🌐 AWS Docs');
  });

  it('returns original text when no citations', () => {
    expect(appendCitationList('Hello', [])).toBe('Hello');
  });
});

describe('buildCitedResponse', () => {
  it('builds complete response with citations', () => {
    const results: RetrieveResult[] = [
      { fileName: 'doc.pdf', content: 'Content', score: 0.8 },
    ];

    const response = buildCitedResponse('Answer text', results, 'anthropic.claude-sonnet-4-6');
    expect(response.citations).toHaveLength(1);
    expect(response.boundaryTypes).toEqual(['verified']);
    expect(response.modelId).toBe('anthropic.claude-sonnet-4-6');
    expect(response.text).toContain('**Sources:**');
  });
});
