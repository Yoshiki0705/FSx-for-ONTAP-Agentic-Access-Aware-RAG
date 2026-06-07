/**
 * Document Name Resolver — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { resolveDocumentName, resolveDocumentDisplay } from '@/lib/citations/document-name-resolver';

describe('resolveDocumentName', () => {
  it('resolves UUID-based ESG report path', () => {
    const result = resolveDocumentName(
      'reports/esg/2026-06-06/5578ceee-ac4d-4bb7-a431-d82afed79f04.json'
    );
    expect(result).toBe('ESGレポート (2026-06-06)');
  });

  it('resolves UUID-based grants report', () => {
    const result = resolveDocumentName(
      'reports/grants/2026-06-06/08dc29bb-ed5c-42da-a66e-c9d1e6abc97d.json'
    );
    expect(result).toBe('助成金レポート (2026-06-06)');
  });

  it('resolves non-UUID upload filename', () => {
    const result = resolveDocumentName('uploads/demo-user/test-doc.txt');
    expect(result).toBe('test-doc');
  });

  it('resolves full S3 URI', () => {
    const result = resolveDocumentName(
      's3://v4testkbsync-f4uup1usns9zk3abn7qo413kcgzgrapn1a-ext-s3alias/reports/esg/2026-06-06/98a24b22-2bbd-482c-a0c0-58f84b792d48.json'
    );
    expect(result).toBe('ESGレポート (2026-06-06)');
  });

  it('uses English labels when locale is en', () => {
    const result = resolveDocumentName(
      'reports/transportation/2026-06-06/4ae2ecf8-db2f-4e1f-82da-e2b2e48e5851.json',
      'en'
    );
    expect(result).toBe('Transportation Report (2026-06-06)');
  });

  it('preserves non-UUID filenames', () => {
    const result = resolveDocumentName('policies/security/access-control.md');
    expect(result).toBe('access-control');
  });

  it('handles unknown category with UUID', () => {
    const result = resolveDocumentName(
      'unknown/2026-01-01/abc12345-1234-5678-9abc-def012345678.json'
    );
    expect(result).toBe('2026-01-01 (2026-01-01)');
  });

  it('handles plain filename', () => {
    const result = resolveDocumentName('document.pdf');
    expect(result).toBe('document.pdf');
  });
});

describe('resolveDocumentDisplay', () => {
  it('returns both displayName and fullPath', () => {
    const result = resolveDocumentDisplay(
      'reports/esg/2026-06-06/5578ceee-ac4d-4bb7-a431-d82afed79f04.json'
    );
    expect(result.displayName).toBe('ESGレポート (2026-06-06)');
    expect(result.fullPath).toBe('reports/esg/2026-06-06/5578ceee-ac4d-4bb7-a431-d82afed79f04.json');
  });
});
