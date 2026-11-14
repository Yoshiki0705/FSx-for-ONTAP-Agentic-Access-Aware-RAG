import { describe, it, expect } from 'vitest';
import { buildCitationDisplayInfo } from '@/lib/citations/document-name-resolver';

const badge = (sids: unknown) =>
  buildCitationDisplayInfo('s3://alias/industry-packs/legal/nda.md', { allowed_group_sids: sids }, 'ja').permissionBadge;

describe('citation permission badge', () => {
  it('labels Everyone documents as open to all', () => {
    expect(badge(['S-1-1-0'])).toBe('全員アクセス可');
    // The live Knowledge Base returned a JSON string; the first version of this fix missed it.
    expect(badge('["S-1-1-0"]')).toBe('全員アクセス可');
    // Shape seen from Retrieve on S3 Vectors (2026-11-14): array elements wrapped in literal quotes.
    expect(badge(['"S-1-1-0"'])).toBe('全員アクセス可');
    expect(badge(['"S-1-5-21-000-000-000-4100"', '"S-1-5-21-000-000-000-512"'])).toBe('制限付き');
  });
  it('labels Domain Admins alone as admin-only', () => {
    expect(badge(['S-1-5-21-000-000-000-512'])).toBe('管理者のみ');
  });
  it('labels a department plus Domain Admins as restricted, not admin-only', () => {
    expect(badge(['S-1-5-21-000-000-000-4100', 'S-1-5-21-000-000-000-512'])).toBe('制限付き');
    expect(badge('S-1-5-21-000-000-000-4100,S-1-5-21-000-000-000-512')).toBe('制限付き');
    expect(badge('["S-1-5-21-000-000-000-4100","S-1-5-21-000-000-000-512"]')).toBe('制限付き');
    expect(badge('["S-1-5-21-000-000-000-512"]')).toBe('管理者のみ');
  });
});
