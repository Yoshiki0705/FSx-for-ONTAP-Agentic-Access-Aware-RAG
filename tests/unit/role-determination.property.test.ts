/**
 * IDトークンベースのロール判定 プロパティベーステスト
 *
 * Feature: cognito-ad-federation, Property 6: IDトークンベースのロール判定
 * **Validates: Requirements 3.5**
 */

import * as fc from 'fast-check';

// Re-implement determineRole here (same logic as callback/route.ts)
// to test independently of Next.js runtime
function determineRole(payload: Record<string, unknown>): string {
  const customRole = payload['custom:role'] as string | undefined;
  if (customRole === 'admin') return 'administrator';

  const adGroups = payload['custom:ad_groups'] as string | undefined;
  if (adGroups) {
    const groups = adGroups.split(',').map((g) => g.trim().toLowerCase());
    if (groups.some((g) => g.includes('admin'))) return 'administrator';
  }

  return 'user';
}

describe('Property 6: IDトークンベースのロール判定', () => {
  // Feature: cognito-ad-federation, Property 6
  // **Validates: Requirements 3.5**

  it('custom:role === "admin" の場合は常に "administrator" を返す', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: fc.emailAddress(),
          sub: fc.uuid(),
          'custom:role': fc.constant('admin'),
          'custom:ad_groups': fc.option(fc.string()),
        }),
        (payload) => {
          expect(determineRole(payload as Record<string, unknown>)).toBe('administrator');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('custom:ad_groups に admin を含むグループがある場合は "administrator" を返す', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{2,15}$/), { minLength: 0, maxLength: 3 }),
          fc.constantFrom('Domain Admins', 'AdminGroup', 'IT-admin-team', 'ADMIN'),
          fc.array(fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{2,15}$/), { minLength: 0, maxLength: 3 }),
        ),
        ([before, adminGroup, after]) => {
          const groups = [...before, adminGroup, ...after].join(',');
          const payload = {
            email: 'user@example.com',
            sub: 'test-sub',
            'custom:ad_groups': groups,
          };
          expect(determineRole(payload)).toBe('administrator');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('custom:role !== "admin" かつ ad_groups に admin を含まない場合は "user" を返す', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: fc.emailAddress(),
          sub: fc.uuid(),
          'custom:role': fc.option(
            fc.string().filter(s => s !== 'admin'),
          ),
          'custom:ad_groups': fc.option(
            fc.array(
              fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{2,15}$/).filter(s => !s.toLowerCase().includes('admin')),
              { minLength: 1, maxLength: 5 },
            ).map(groups => groups.join(',')),
          ),
        }),
        (payload) => {
          const p: Record<string, unknown> = { email: payload.email, sub: payload.sub };
          if (payload['custom:role'] !== null) p['custom:role'] = payload['custom:role'];
          if (payload['custom:ad_groups'] !== null) p['custom:ad_groups'] = payload['custom:ad_groups'];
          expect(determineRole(p)).toBe('user');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('属性が空のペイロードでは "user" を返す', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: fc.emailAddress(),
          sub: fc.uuid(),
        }),
        (payload) => {
          expect(determineRole(payload)).toBe('user');
        }
      ),
      { numRuns: 100 }
    );
  });
});
