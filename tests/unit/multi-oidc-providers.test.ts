/**
 * Unit tests for multi-OIDC provider support in login-form.tsx
 *
 * Since login-form.tsx is a React component (.tsx), we replicate the pure
 * logic functions here for testing (same pattern as existing tests).
 *
 * Validates: Requirements 11.4, 11.7
 */

// ========================================
// Replicated from docker/nextjs/components/login-form.tsx
// ========================================

interface OidcProviderEntry {
  name: string;
  displayName?: string;
}

function parseOidcProviders(envValue: string): OidcProviderEntry[] {
  if (!envValue) return [];
  try {
    const parsed = JSON.parse(envValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: unknown): p is OidcProviderEntry =>
        typeof p === 'object' && p !== null && typeof (p as OidcProviderEntry).name === 'string'
    );
  } catch {
    return [];
  }
}

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
// Tests
// ========================================

describe('parseOidcProviders', () => {
  it('returns empty array for empty string', () => {
    expect(parseOidcProviders('')).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseOidcProviders('not-json')).toEqual([]);
  });

  it('returns empty array for non-array JSON', () => {
    expect(parseOidcProviders('{"name":"Okta"}')).toEqual([]);
  });

  it('parses single provider', () => {
    const input = JSON.stringify([{ name: 'Okta' }]);
    expect(parseOidcProviders(input)).toEqual([{ name: 'Okta' }]);
  });

  it('parses multiple providers', () => {
    const input = JSON.stringify([
      { name: 'Okta', displayName: 'Okta SSO' },
      { name: 'Keycloak', displayName: 'Keycloak IdP' },
    ]);
    const result = parseOidcProviders(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Okta', displayName: 'Okta SSO' });
    expect(result[1]).toEqual({ name: 'Keycloak', displayName: 'Keycloak IdP' });
  });

  it('parses provider without displayName', () => {
    const input = JSON.stringify([{ name: 'EntraID' }]);
    const result = parseOidcProviders(input);
    expect(result).toEqual([{ name: 'EntraID' }]);
    expect(result[0].displayName).toBeUndefined();
  });

  it('filters out entries without name field', () => {
    const input = JSON.stringify([
      { name: 'Okta' },
      { displayName: 'No Name' },
      { name: 'Keycloak' },
      null,
      42,
    ]);
    const result = parseOidcProviders(input);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Okta');
    expect(result[1].name).toBe('Keycloak');
  });

  it('filters out entries where name is not a string', () => {
    const input = JSON.stringify([
      { name: 123 },
      { name: 'Valid' },
    ]);
    const result = parseOidcProviders(input);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Valid');
  });
});

describe('Multi-OIDC provider precedence logic', () => {
  // Replicate the precedence logic from LoginForm
  function resolveOidcMode(
    oidcProvidersEnv: string,
    oidcProviderNameEnv: string,
    cognitoDomain: string,
    cognitoRegion: string,
    cognitoClientId: string,
    callbackUrl: string,
  ) {
    const oidcProviders = parseOidcProviders(oidcProvidersEnv);
    const cognitoReady = !!(cognitoDomain && cognitoRegion && cognitoClientId && callbackUrl);
    const multiOidcEnabled = !!(oidcProviders.length > 0 && cognitoReady);
    const singleOidcEnabled = !!(!multiOidcEnabled && oidcProviderNameEnv && cognitoReady);
    return { multiOidcEnabled, singleOidcEnabled, oidcProviders };
  }

  const cognitoArgs = ['my-domain', 'us-east-1', 'client123', 'https://example.com/callback'] as const;

  it('multi-provider mode when NEXT_PUBLIC_OIDC_PROVIDERS is set', () => {
    const providersJson = JSON.stringify([{ name: 'Okta' }, { name: 'Keycloak' }]);
    const result = resolveOidcMode(providersJson, '', ...cognitoArgs);
    expect(result.multiOidcEnabled).toBe(true);
    expect(result.singleOidcEnabled).toBe(false);
    expect(result.oidcProviders).toHaveLength(2);
  });

  it('single-provider mode when only NEXT_PUBLIC_OIDC_PROVIDER_NAME is set', () => {
    const result = resolveOidcMode('', 'Okta', ...cognitoArgs);
    expect(result.multiOidcEnabled).toBe(false);
    expect(result.singleOidcEnabled).toBe(true);
  });

  it('multi-provider takes precedence when both are set', () => {
    const providersJson = JSON.stringify([{ name: 'Okta' }]);
    const result = resolveOidcMode(providersJson, 'Keycloak', ...cognitoArgs);
    expect(result.multiOidcEnabled).toBe(true);
    expect(result.singleOidcEnabled).toBe(false);
    expect(result.oidcProviders[0].name).toBe('Okta');
  });

  it('neither mode when no OIDC env vars are set', () => {
    const result = resolveOidcMode('', '', ...cognitoArgs);
    expect(result.multiOidcEnabled).toBe(false);
    expect(result.singleOidcEnabled).toBe(false);
  });

  it('neither mode when Cognito config is incomplete', () => {
    const providersJson = JSON.stringify([{ name: 'Okta' }]);
    const result = resolveOidcMode(providersJson, 'Okta', '', '', '', '');
    expect(result.multiOidcEnabled).toBe(false);
    expect(result.singleOidcEnabled).toBe(false);
  });
});

describe('Multi-OIDC URL generation', () => {
  it('generates correct URL for each provider in multi-provider mode', () => {
    const providers: OidcProviderEntry[] = [
      { name: 'Okta', displayName: 'Okta SSO' },
      { name: 'Keycloak', displayName: 'Keycloak IdP' },
    ];

    for (const provider of providers) {
      const url = buildOidcSignInUrl('my-domain', 'us-east-1', 'client123', 'https://example.com/callback', provider.name);
      expect(url).toContain(`identity_provider=${encodeURIComponent(provider.name)}`);
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid');
    }
  });

  it('button label uses displayName when available, falls back to name', () => {
    const withDisplayName: OidcProviderEntry = { name: 'Okta', displayName: 'Okta SSO' };
    const withoutDisplayName: OidcProviderEntry = { name: 'Keycloak' };

    expect(withDisplayName.displayName || withDisplayName.name).toBe('Okta SSO');
    expect(withoutDisplayName.displayName || withoutDisplayName.name).toBe('Keycloak');
  });
});
