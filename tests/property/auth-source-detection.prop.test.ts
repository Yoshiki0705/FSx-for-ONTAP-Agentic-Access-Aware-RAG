// Feature: oidc-ldap-permission-mapping, Property 3: 認証ソース判別
/**
 * Property 3: 認証ソース判別
 *
 * For any CognitoPostAuthEvent, correct auth source detection:
 * - identities containing SAML provider → 'saml'
 * - identities containing OIDC provider → 'oidc'
 * - no identities / empty / invalid → 'direct'
 *
 * **Validates: Requirements 4.3**
 */

import * as fc from 'fast-check';
import { detectAuthSource, AuthSource } from '../../lambda/agent-core-ad-sync/index';

// ========================================
// Generators
// ========================================

function makeCognitoEvent(identitiesAttr?: string) {
  return {
    version: '1',
    triggerSource: 'PostAuthentication_Authentication' as const,
    region: 'ap-northeast-1',
    userPoolId: 'ap-northeast-1_TestPool',
    userName: 'testuser',
    callerContext: { awsSdkVersion: '3.0.0', clientId: 'client-id' },
    request: {
      userAttributes: {
        email: 'test@example.com',
        sub: 'sub-123',
        ...(identitiesAttr !== undefined ? { identities: identitiesAttr } : {}),
      },
    },
    response: {},
  };
}

/** Generator for SAML identity objects */
const samlIdentityArb = fc.record({
  providerType: fc.constant('SAML'),
  providerName: fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{2,20}$/),
  userId: fc.uuid(),
}).map(id => JSON.stringify([id]));

/** Generator for OIDC identity objects */
const oidcIdentityArb = fc.record({
  providerType: fc.constant('OIDC'),
  providerName: fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{2,20}$/),
  userId: fc.uuid(),
}).map(id => JSON.stringify([id]));

/** Generator for events with no identities (direct auth) */
const directEventArb = fc.constantFrom(
  undefined,       // no identities attribute at all
  '',              // empty string
  '[]',            // empty array
  'invalid-json',  // invalid JSON
  '{}',            // not an array
  'null',          // null string
);

describe('Property 3: 認証ソース判別', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('SAML identities → returns "saml"', async () => {
    await fc.assert(
      fc.property(samlIdentityArb, (identities: string) => {
        const event = makeCognitoEvent(identities);
        const result = detectAuthSource(event);
        expect(result).toBe('saml');
      }),
      { numRuns: 20 }
    );
  });

  it('OIDC identities → returns "oidc"', async () => {
    await fc.assert(
      fc.property(oidcIdentityArb, (identities: string) => {
        const event = makeCognitoEvent(identities);
        const result = detectAuthSource(event);
        expect(result).toBe('oidc');
      }),
      { numRuns: 20 }
    );
  });

  it('no/empty/invalid identities → returns "direct"', async () => {
    await fc.assert(
      fc.property(directEventArb, (identities: string | undefined) => {
        const event = makeCognitoEvent(identities);
        const result = detectAuthSource(event);
        expect(result).toBe('direct');
      }),
      { numRuns: 20 }
    );
  });

  it('mixed identities with both SAML and OIDC → SAML takes precedence', async () => {
    await fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{2,10}$/),
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{2,10}$/),
        (samlName: string, oidcName: string) => {
          const identities = JSON.stringify([
            { providerType: 'OIDC', providerName: oidcName, userId: 'u1' },
            { providerType: 'SAML', providerName: samlName, userId: 'u2' },
          ]);
          const event = makeCognitoEvent(identities);
          const result = detectAuthSource(event);
          // SAML is checked first in the implementation
          expect(result).toBe('saml');
        }
      ),
      { numRuns: 20 }
    );
  });
});
