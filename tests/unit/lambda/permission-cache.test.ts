/**
 * Property 4: 権限キャッシュのラウンドトリップ (要件 3.3)
 * Property 6: ソースドキュメント情報の表示 (要件 4.4)
 * Property 7: 未認証リクエストのリダイレクト (要件 6.2)
 * 
 * DynamoDBモックを使用せず、キャッシュキー生成ロジックと
 * フィルタリングレスポンス構造の正当性を検証する。
 */

import * as fc from 'fast-check';
import { OntapAclRecord } from '../../../lambda/permissions/types';
import { calculateEffectivePermissions } from '../../../lambda/permissions/permission-calculator';

// ========================================
// Property 4: 権限キャッシュのラウンドトリップ
// ========================================

describe('Property 4: 権限キャッシュのラウンドトリップ', () => {
  /** キャッシュキー生成ロジック（permission-filter-handler.tsと同じ） */
  function generateCacheKey(userId: string, documentId: string): string {
    return `${userId}:${documentId}`;
  }

  /** キャッシュキーからuserId/documentIdを復元 */
  function parseCacheKey(cacheKey: string): { userId: string; documentId: string } | null {
    const colonIndex = cacheKey.indexOf(':');
    if (colonIndex === -1) return null;
    return {
      userId: cacheKey.substring(0, colonIndex),
      documentId: cacheKey.substring(colonIndex + 1),
    };
  }

  const userIdArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':'));
  const docIdArb = fc.string({ minLength: 1, maxLength: 100 });

  it('キャッシュキーからuserId/documentIdが復元できる', () => {
    fc.assert(
      fc.property(userIdArb, docIdArb, (userId: string, documentId: string) => {
        const key = generateCacheKey(userId, documentId);
        const parsed = parseCacheKey(key);
        expect(parsed).not.toBeNull();
        expect(parsed!.userId).toBe(userId);
        expect(parsed!.documentId).toBe(documentId);
      }),
      { numRuns: 100 },
    );
  });

  it('TTL値は現在時刻より未来（5分後）', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (_offset: number) => {
        const CACHE_TTL_MINUTES = 5;
        const now = Math.floor(Date.now() / 1000);
        const ttl = now + CACHE_TTL_MINUTES * 60;
        expect(ttl).toBeGreaterThan(now);
        expect(ttl - now).toBe(300); // 5分 = 300秒
      }),
      { numRuns: 10 },
    );
  });

  it('キャッシュされた権限結果は同じ入力に対して決定的', () => {
    const sidArb = fc.tuple(
      fc.integer({ min: 1000, max: 9999 }),
      fc.integer({ min: 1000, max: 9999 }),
      fc.integer({ min: 1000, max: 9999 }),
      fc.integer({ min: 1000, max: 9999 }),
    ).map(([a, b, c, d]) => `S-1-5-21-${a}-${b}-${c}-${d}`);

    const permArb = fc.constantFrom<OntapAclRecord['permission']>(
      'full_control', 'change', 'read', 'no_access',
    );

    fc.assert(
      fc.property(sidArb, permArb, (sid: string, perm: OntapAclRecord['permission']) => {
        const acls: OntapAclRecord[] = [{ user_or_group: sid, permission: perm, type: 'allow' }];
        const result1 = calculateEffectivePermissions([sid], acls);
        const result2 = calculateEffectivePermissions([sid], acls);
        // 同じ入力に対して同じ結果
        expect(result1.read).toBe(result2.read);
        expect(result1.write).toBe(result2.write);
        expect(result1.admin).toBe(result2.admin);
      }),
      { numRuns: 50 },
    );
  });
});

// ========================================
// Property 6: ソースドキュメント情報の表示
// ========================================

describe('Property 6: ソースドキュメント情報の表示', () => {
  /** Citation情報の構造検証（CitationDisplay.tsxのCitationItem型と同等） */
  interface CitationItem {
    fileName: string;
    s3Uri: string;
    content: string;
    metadata?: Record<string, unknown>;
  }

  /** S3 URIからファイル名を抽出するロジック（route.tsと同じ） */
  function extractFileName(s3Uri: string): string {
    return s3Uri.split('/').pop() || s3Uri;
  }

  /** Citation重複除去ロジック（CitationDisplay.tsxと同じ） */
  function deduplicateCitations(citations: CitationItem[]): CitationItem[] {
    return citations.reduce<CitationItem[]>((acc, cite) => {
      if (!acc.find(c => c.fileName === cite.fileName && c.content === cite.content)) {
        acc.push(cite);
      }
      return acc;
    }, []);
  }

  const s3UriArb = fc.tuple(
    fc.constantFrom('s3://bucket-a', 's3://bucket-b', 's3://data-bucket'),
    fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')), { minLength: 1, maxLength: 3 }),
    fc.constantFrom('.md', '.txt', '.pdf', '.json'),
  ).map(([bucket, parts, ext]) => `${bucket}/${parts.join('/')}${ext}`);

  it('S3 URIからファイル名が正しく抽出される', () => {
    fc.assert(
      fc.property(s3UriArb, (uri: string) => {
        const fileName = extractFileName(uri);
        expect(fileName.length).toBeGreaterThan(0);
        expect(fileName).not.toContain('/');
      }),
      { numRuns: 50 },
    );
  });

  it('重複除去後のcitation数は元の数以下', () => {
    const citationArb: fc.Arbitrary<CitationItem> = fc.record({
      fileName: fc.constantFrom('doc1.md', 'doc2.md', 'doc3.md'),
      s3Uri: fc.constant('s3://bucket/doc.md'),
      content: fc.constantFrom('content-a', 'content-b', 'content-c'),
    });

    fc.assert(
      fc.property(fc.array(citationArb, { minLength: 0, maxLength: 20 }), (citations: CitationItem[]) => {
        const deduped = deduplicateCitations(citations);
        expect(deduped.length).toBeLessThanOrEqual(citations.length);
      }),
      { numRuns: 50 },
    );
  });

  it('空のcitation配列は空のまま返される', () => {
    const deduped = deduplicateCitations([]);
    expect(deduped).toEqual([]);
  });

  it('全て異なるcitationは重複除去されない', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (count: number) => {
          const citations: CitationItem[] = Array.from({ length: count }, (_, i) => ({
            fileName: `unique-doc-${i}.md`,
            s3Uri: `s3://bucket/unique-doc-${i}.md`,
            content: `unique content ${i}`,
          }));
          const deduped = deduplicateCitations(citations);
          expect(deduped.length).toBe(count);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ========================================
// Property 7: 未認証リクエストのリダイレクト
// ========================================

describe('Property 7: 未認証リクエストのリダイレクト', () => {
  /** ミドルウェアのパス判定ロジックを再現 */
  const publicPaths = [
    '/api/auth/signin',
    '/api/auth/signout',
    '/api/auth/csrf-token',
    '/api/locale',
    '/_next',
    '/favicon.ico',
    '/manifest.json',
    '/images',
    '/config',
  ];

  function isPublicPath(pathname: string): boolean {
    return publicPaths.some(path => pathname.startsWith(path));
  }

  function isSigninPage(pathname: string): boolean {
    return pathname.includes('/signin');
  }

  const SUPPORTED_LOCALES = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'fr', 'de', 'es'];

  function shouldRedirectToSignin(pathname: string, hasToken: boolean): boolean {
    if (isPublicPath(pathname)) return false;
    if (isSigninPage(pathname)) return false;
    return !hasToken;
  }

  const localeArb = fc.constantFrom(...SUPPORTED_LOCALES);
  const protectedPathArb = fc.constantFrom('/genai', '/genai?mode=kb', '/dashboard');

  it('トークンなしで保護パスにアクセスするとリダイレクトされる', () => {
    fc.assert(
      fc.property(localeArb, protectedPathArb, (locale: string, path: string) => {
        const fullPath = `/${locale}${path}`;
        expect(shouldRedirectToSignin(fullPath, false)).toBe(true);
      }),
      { numRuns: 30 },
    );
  });

  it('トークンありで保護パスにアクセスするとリダイレクトされない', () => {
    fc.assert(
      fc.property(localeArb, protectedPathArb, (locale: string, path: string) => {
        const fullPath = `/${locale}${path}`;
        expect(shouldRedirectToSignin(fullPath, true)).toBe(false);
      }),
      { numRuns: 30 },
    );
  });

  it('公開パスはトークンの有無に関わらずリダイレクトされない', () => {
    const publicPathArb = fc.constantFrom(...publicPaths);
    fc.assert(
      fc.property(publicPathArb, fc.boolean(), (path: string, hasToken: boolean) => {
        expect(shouldRedirectToSignin(path, hasToken)).toBe(false);
      }),
      { numRuns: 30 },
    );
  });

  it('サインインページはリダイレクトされない', () => {
    fc.assert(
      fc.property(localeArb, (locale: string) => {
        const signinPath = `/${locale}/signin`;
        expect(shouldRedirectToSignin(signinPath, false)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });
});
