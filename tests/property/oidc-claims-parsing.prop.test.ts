// Feature: oidc-ldap-permission-mapping, Property 15: OIDCグループクレーム解析
/**
 * Property 15: OIDCグループクレーム解析
 *
 * For any OIDC token and groupClaimName, correct group extraction
 * from `custom:{claimName}` or `{claimName}` attributes.
 *
 * **Validates: Requirements 8.1, 8.2**
 */

import * as fc from 'fast-check';
import { parseOidcClaims } from '../../lambda/agent-core-ad-sync/index';

// ========================================
// Helpers
// ========================================

function makeCognitoEvent(attrs: Record<string, string | undefined>) {
  return {
    version: '1',
    triggerSource: 'PostAuthentication_Authentication' as const,
    region: 'ap-northeast-1',
    userPoolId: 'ap-northeast-1_TestPool',
    userName: 'testuser',
    callerContext: { awsSdkVersion: '3.0.0', clientId: 'client-id' },
    request: {
      userAttributes: {
        email: attrs.email || 'test@example.com',
        sub: 'sub-123',
        ...attrs,
      },
    },
    response: {},
  };
}

/** Generator for group name strings */
const groupNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{1,30}$/);

/** Generator for group claim name */
const claimNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{1,20}$/);

describe('Property 15: OIDCグループクレーム解析', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('extracts groups from custom:{claimName} as JSON array', async () => {
    await fc.assert(
      fc.property(
        fc.array(groupNameArb, { minLength: 1, maxLength: 5 }),
        claimNameArb,
        (groups: string[], claimName: string) => {
          const event = makeCognitoEvent({
            [`custom:${claimName}`]: JSON.stringify(groups),
          });
          const result = parseOidcClaims(event, claimName);
          expect(result.groups).toEqual(groups);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('extracts groups from {claimName} when custom: prefix is absent', async () => {
    await fc.assert(
      fc.property(
        fc.array(groupNameArb, { minLength: 1, maxLength: 5 }),
        claimNameArb,
        (groups: string[], claimName: string) => {
          const event = makeCognitoEvent({
            [claimName]: JSON.stringify(groups),
          });
          const result = parseOidcClaims(event, claimName);
          expect(result.groups).toEqual(groups);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('parses comma-separated groups when JSON parse fails', async () => {
    await fc.assert(
      fc.property(
        fc.array(groupNameArb, { minLength: 1, maxLength: 5 }),
        claimNameArb,
        (groups: string[], claimName: string) => {
          const csvGroups = groups.join(',');
          const event = makeCognitoEvent({
            [`custom:${claimName}`]: csvGroups,
          });
          const result = parseOidcClaims(event, claimName);
          expect(result.groups).toEqual(groups);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('returns empty groups when claim is missing', async () => {
    await fc.assert(
      fc.property(claimNameArb, (claimName: string) => {
        const event = makeCognitoEvent({});
        const result = parseOidcClaims(event, claimName);
        expect(result.groups).toEqual([]);
      }),
      { numRuns: 20 }
    );
  });

  it('uses default "groups" claim name when not specified', async () => {
    await fc.assert(
      fc.property(
        fc.array(groupNameArb, { minLength: 1, maxLength: 5 }),
        (groups: string[]) => {
          const event = makeCognitoEvent({
            'custom:groups': JSON.stringify(groups),
          });
          // Call without explicit claimName — defaults to 'groups'
          const result = parseOidcClaims(event);
          expect(result.groups).toEqual(groups);
        }
      ),
      { numRuns: 20 }
    );
  });
});
