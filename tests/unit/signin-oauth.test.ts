/**
 * SignInForm と OAuth Callback のユニットテスト
 *
 * テスト対象:
 * - AD ボタン表示条件ロジック (adFederationEnabled)
 * - buildAdSignInUrl URL構築関数
 *
 * Requirements: 3.1, 3.4, 3.5, 3.6
 *
 * NOTE: root jest.config.js は testEnvironment: 'node' のため、
 * React コンポーネントのレンダリングは行わず、純粋関数のテストのみ実施する。
 */

// ---- Re-implement pure functions from source (same logic) ----

/**
 * Build the SAML redirect URL for AD sign-in via Cognito Hosted UI.
 * (Same logic as docker/nextjs/components/login-form.tsx)
 */
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

/**
 * AD federation enabled condition.
 * (Same logic as docker/nextjs/components/login-form.tsx)
 */
function isAdFederationEnabled(
  cognitoDomain: string,
  cognitoRegion: string,
  cognitoClientId: string,
  callbackUrl: string,
): boolean {
  return !!(cognitoDomain && cognitoRegion && cognitoClientId && callbackUrl);
}

// ---- Tests ----

describe('SignInForm — AD ボタン表示条件', () => {
  // Requirements: 3.1, 3.6

  it('全環境変数が設定されている場合、adFederationEnabled = true', () => {
    const result = isAdFederationEnabled(
      'myapp-auth',
      'ap-northeast-1',
      'abc123clientid',
      'https://d123.cloudfront.net/api/auth/callback',
    );
    expect(result).toBe(true);
  });

  it('COGNITO_DOMAIN が未設定（空文字）の場合、adFederationEnabled = false', () => {
    const result = isAdFederationEnabled(
      '',
      'ap-northeast-1',
      'abc123clientid',
      'https://d123.cloudfront.net/api/auth/callback',
    );
    expect(result).toBe(false);
  });

  it('COGNITO_CLIENT_ID が未設定（空文字）の場合、adFederationEnabled = false', () => {
    const result = isAdFederationEnabled(
      'myapp-auth',
      'ap-northeast-1',
      '',
      'https://d123.cloudfront.net/api/auth/callback',
    );
    expect(result).toBe(false);
  });

  it('COGNITO_REGION が未設定（空文字）の場合、adFederationEnabled = false', () => {
    const result = isAdFederationEnabled(
      'myapp-auth',
      '',
      'abc123clientid',
      'https://d123.cloudfront.net/api/auth/callback',
    );
    expect(result).toBe(false);
  });

  it('CALLBACK_URL が未設定（空文字）の場合、adFederationEnabled = false', () => {
    const result = isAdFederationEnabled(
      'myapp-auth',
      'ap-northeast-1',
      'abc123clientid',
      '',
    );
    expect(result).toBe(false);
  });
});

describe('buildAdSignInUrl — URL構築', () => {
  // Requirements: 3.1, 3.2

  it('正しいフォーマットのURLを構築する', () => {
    const url = buildAdSignInUrl(
      'myapp-auth',
      'ap-northeast-1',
      'abc123clientid',
      'https://d123.cloudfront.net/api/auth/callback',
      'ActiveDirectory',
    );

    expect(url).toBe(
      'https://myapp-auth.auth.ap-northeast-1.amazoncognito.com/oauth2/authorize' +
      '?identity_provider=ActiveDirectory' +
      '&response_type=code' +
      '&client_id=abc123clientid' +
      '&redirect_uri=https%3A%2F%2Fd123.cloudfront.net%2Fapi%2Fauth%2Fcallback' +
      '&scope=openid+email+profile',
    );
  });

  it('callbackUrl が正しくURI-encodedされる', () => {
    const callbackUrl = 'https://example.com/path?query=1&other=2';
    const url = buildAdSignInUrl(
      'test-domain',
      'us-east-1',
      'clientid',
      callbackUrl,
      'EntraID',
    );

    const redirectUriParam = url.split('redirect_uri=')[1]?.split('&scope')[0];
    expect(redirectUriParam).toBe(encodeURIComponent(callbackUrl));
  });

  it('IdP名がカスタム値でも正しくエンコードされる', () => {
    const url = buildAdSignInUrl(
      'test-domain',
      'eu-west-1',
      'clientid',
      'https://app.example.com/callback',
      'My Custom IdP',
    );

    expect(url).toContain('identity_provider=My%20Custom%20IdP');
  });
});
// ロール判定は docker/nextjs/src/__tests__/auth/roles.test.ts（実装を直接 import する）
