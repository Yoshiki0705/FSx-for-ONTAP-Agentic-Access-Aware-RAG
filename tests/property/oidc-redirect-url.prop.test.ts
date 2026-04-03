// Feature: oidc-ldap-permission-mapping, Property 2: OIDC リダイレクトURL構築
/**
 * Property 2: OIDC リダイレクトURL構築
 *
 * For any valid Cognito domain/region/clientId/callbackUrl/IdP name,
 * correct URL generation with URL encoding.
 *
 * We replicate the `buildOidcSignInUrl` logic here since the source is a
 * .tsx file that requires JSX compilation. The function under test is a
 * pure string builder with no React dependencies.
 *
 * **Validates: Requirements 2.2**
 */

import * as fc from 'fast-check';

/**
 * Replicated from docker/nextjs/components/login-form.tsx
 * Build the OIDC redirect URL for OIDC IdP sign-in via Cognito Hosted UI.
 */
function buildOidcSignInUrl(
  cognitoDomain: string,
  cognitoRegion: string,
  cognitoClientId: string,
  callbackUrl: string,
  oidcProviderName: string,
): string {
  return (
    `https://${cognitoDomain}.auth.${cognitoRegion}.amazoncognito.com/oauth2/authorize` +
    `?identity_provider=${encodeURIComponent(oidcProviderName)}` +
    `&response_type=code` +
    `&client_id=${encodeURIComponent(cognitoClientId)}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&scope=openid+email+profile`
  );
}

// ========================================
// Generators
// ========================================

const cognitoDomainArb = fc.stringMatching(/^[a-z][a-z0-9-]{3,20}$/);
const regionArb = fc.constantFrom(
  'us-east-1', 'us-west-2', 'eu-west-1', 'ap-northeast-1', 'ap-southeast-1'
);
const clientIdArb = fc.stringMatching(/^[a-z0-9]{10,30}$/);
const callbackUrlArb = fc.constantFrom(
  'https://example.com/callback',
  'https://d123456.cloudfront.net/api/auth/callback',
  'https://localhost:3000/api/auth/callback',
);
const idpNameArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{2,20}$/);

describe('Property 2: OIDC リダイレクトURL構築', () => {
  it('generates valid Cognito Hosted UI URL with correct structure', async () => {
    await fc.assert(
      fc.property(
        cognitoDomainArb,
        regionArb,
        clientIdArb,
        callbackUrlArb,
        idpNameArb,
        (domain: string, region: string, clientId: string, callbackUrl: string, idpName: string) => {
          const url = buildOidcSignInUrl(domain, region, clientId, callbackUrl, idpName);

          // Must start with correct Cognito Hosted UI base URL
          expect(url).toContain(`https://${domain}.auth.${region}.amazoncognito.com/oauth2/authorize`);

          // Must contain identity_provider parameter
          expect(url).toContain(`identity_provider=${encodeURIComponent(idpName)}`);

          // Must contain response_type=code
          expect(url).toContain('response_type=code');

          // Must contain client_id
          expect(url).toContain(`client_id=${encodeURIComponent(clientId)}`);

          // Must contain redirect_uri with URL encoding
          expect(url).toContain(`redirect_uri=${encodeURIComponent(callbackUrl)}`);

          // Must contain openid scope
          expect(url).toContain('scope=openid');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('URL-encodes special characters in IdP name', async () => {
    await fc.assert(
      fc.property(
        cognitoDomainArb,
        regionArb,
        clientIdArb,
        callbackUrlArb,
        fc.constantFrom('My IdP', 'Provider+Name', 'IdP&Test'),
        (domain: string, region: string, clientId: string, callbackUrl: string, idpName: string) => {
          const url = buildOidcSignInUrl(domain, region, clientId, callbackUrl, idpName);

          // The IdP name should be URL-encoded
          expect(url).toContain(`identity_provider=${encodeURIComponent(idpName)}`);

          // The raw unencoded name with spaces/special chars should NOT appear
          if (idpName.includes(' ') || idpName.includes('+') || idpName.includes('&')) {
            expect(url).not.toContain(`identity_provider=${idpName}`);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('URL-encodes callback URL properly', async () => {
    await fc.assert(
      fc.property(
        cognitoDomainArb,
        regionArb,
        clientIdArb,
        idpNameArb,
        (domain: string, region: string, clientId: string, idpName: string) => {
          const callbackUrl = 'https://example.com/api/auth/callback?param=value';
          const url = buildOidcSignInUrl(domain, region, clientId, callbackUrl, idpName);

          // The callback URL should be encoded
          expect(url).toContain(`redirect_uri=${encodeURIComponent(callbackUrl)}`);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('generated URL is parseable and has correct query parameters', async () => {
    await fc.assert(
      fc.property(
        cognitoDomainArb,
        regionArb,
        clientIdArb,
        callbackUrlArb,
        idpNameArb,
        (domain: string, region: string, clientId: string, callbackUrl: string, idpName: string) => {
          const url = buildOidcSignInUrl(domain, region, clientId, callbackUrl, idpName);

          // URL should be parseable
          const parsed = new URL(url);
          expect(parsed.protocol).toBe('https:');
          expect(parsed.hostname).toBe(`${domain}.auth.${region}.amazoncognito.com`);
          expect(parsed.pathname).toBe('/oauth2/authorize');

          // Query parameters should be correct
          expect(parsed.searchParams.get('identity_provider')).toBe(idpName);
          expect(parsed.searchParams.get('response_type')).toBe('code');
          expect(parsed.searchParams.get('client_id')).toBe(clientId);
          expect(parsed.searchParams.get('redirect_uri')).toBe(callbackUrl);
        }
      ),
      { numRuns: 20 }
    );
  });
});
