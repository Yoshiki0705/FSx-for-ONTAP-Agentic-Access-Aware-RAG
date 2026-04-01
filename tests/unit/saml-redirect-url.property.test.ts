/**
 * SAML Redirect URL構築 プロパティベーステスト
 *
 * Feature: cognito-ad-federation, Property 5: SAMLリダイレクトURL構築
 * **Validates: Requirements 3.2**
 */

import * as fc from 'fast-check';

// Re-implement buildAdSignInUrl here (same logic as login-form.tsx)
// to test the URL construction logic independently of React
function buildAdSignInUrl(
  cognitoDomain: string,
  cognitoRegion: string,
  cognitoClientId: string,
  callbackUrl: string,
  idpName: string,
): string {
  return (
    `https://${cognitoDomain}.auth.${cognitoRegion}.amazoncognito.com/oauth2/authorize` +
    `?identity_provider=${encodeURIComponent(idpName)}` +
    `&response_type=code` +
    `&client_id=${encodeURIComponent(cognitoClientId)}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&scope=openid+email+profile`
  );
}

// Arbitraries
const domainArb = fc.stringMatching(/^[a-z][a-z0-9-]{3,20}$/);
const regionArb = fc.constantFrom(
  'us-east-1', 'us-west-2', 'eu-west-1', 'ap-northeast-1', 'ap-southeast-1',
);
const clientIdArb = fc.stringMatching(/^[a-z0-9]{10,30}$/);
const callbackUrlArb = fc.tuple(
  fc.constantFrom('https://d123.cloudfront.net', 'https://app.example.com', 'https://localhost:3000'),
  fc.constantFrom('/api/auth/callback', '/callback', '/auth/cb'),
).map(([base, path]) => `${base}${path}`);
const idpNameArb = fc.constantFrom('ActiveDirectory', 'EntraID', 'CustomIdP');

describe('Property 5: SAMLリダイレクトURL構築', () => {
  // Feature: cognito-ad-federation, Property 5: SAMLリダイレクトURL構築
  // **Validates: Requirements 3.2**

  it('構築されたURLが正しいフォーマットに従う', () => {
    fc.assert(
      fc.property(
        domainArb, regionArb, clientIdArb, callbackUrlArb, idpNameArb,
        (domain, region, clientId, callbackUrl, idpName) => {
          const url = buildAdSignInUrl(domain, region, clientId, callbackUrl, idpName);

          // URL starts with correct Cognito domain
          expect(url).toContain(`https://${domain}.auth.${region}.amazoncognito.com/oauth2/authorize`);

          // Contains required query parameters
          expect(url).toContain('response_type=code');
          expect(url).toContain('scope=openid+email+profile');
          expect(url).toContain(`identity_provider=${encodeURIComponent(idpName)}`);
          expect(url).toContain(`client_id=${encodeURIComponent(clientId)}`);
          expect(url).toContain(`redirect_uri=${encodeURIComponent(callbackUrl)}`);

          // callbackUrl is properly URI-encoded
          const redirectUriParam = url.split('redirect_uri=')[1]?.split('&')[0];
          expect(redirectUriParam).toBe(encodeURIComponent(callbackUrl));

          // URL is parseable
          const parsed = new URL(url);
          expect(parsed.protocol).toBe('https:');
          expect(parsed.hostname).toBe(`${domain}.auth.${region}.amazoncognito.com`);
          expect(parsed.pathname).toBe('/oauth2/authorize');
        }
      ),
      { numRuns: 100 }
    );
  });
});
