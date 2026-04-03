// Feature: oidc-ldap-permission-mapping, Property 1: OIDC CDKバリデーション
// Feature: oidc-ldap-permission-mapping, Property 14: IdP登録組み合わせ
/**
 * Property 1: OIDC CDKバリデーション
 * For any oidcProviderConfig where clientId or issuerUrl is missing,
 * DemoSecurityStack constructor throws validation error.
 * **Validates: Requirements 1.6**
 *
 * Property 14: IdP登録組み合わせ
 * For any combination of enableAdFederation and oidcProviderConfig,
 * correct IdP registration.
 * **Validates: Requirements 9.2, 9.3**
 */

import * as fc from 'fast-check';
import * as cdk from 'aws-cdk-lib';
import { DemoSecurityStack, DemoSecurityStackProps } from '../../lib/stacks/demo/demo-security-stack';

// ========================================
// Generators
// ========================================

const providerNameArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{2,15}$/);
const clientIdArb = fc.stringMatching(/^[a-z0-9]{10,30}$/);
const clientSecretArb = fc.stringMatching(/^[a-zA-Z0-9]{20,40}$/);
const issuerUrlArb = fc.constantFrom(
  'https://keycloak.example.com/realms/main',
  'https://company.okta.com',
  'https://login.microsoftonline.com/tenant-id/v2.0',
);

/** Generator for oidcProviderConfig with optional missing fields */
const oidcConfigWithMissingFieldsArb = fc.record({
  providerName: providerNameArb,
  clientId: fc.option(clientIdArb, { nil: '' }),
  clientSecret: clientSecretArb,
  issuerUrl: fc.option(issuerUrlArb, { nil: '' }),
}).filter(cfg => !cfg.clientId || !cfg.issuerUrl); // At least one missing

/** Generator for valid oidcProviderConfig */
const validOidcConfigArb = fc.record({
  providerName: providerNameArb,
  clientId: clientIdArb,
  clientSecret: clientSecretArb,
  issuerUrl: issuerUrlArb,
});

describe('Property 1: OIDC CDKバリデーション', () => {
  it('throws when clientId or issuerUrl is missing in oidcProviderConfig', async () => {
    await fc.assert(
      fc.property(oidcConfigWithMissingFieldsArb, (config) => {
        const app = new cdk.App();
        expect(() => {
          new DemoSecurityStack(app, `TestStack-${Math.random().toString(36).slice(2, 8)}`, {
            projectName: 'test',
            environment: 'test',
            oidcProviderConfig: config as any,
          });
        }).toThrow(/oidcProviderConfig requires clientId and issuerUrl/);
      }),
      { numRuns: 20 }
    );
  });

  it('does NOT throw when both clientId and issuerUrl are provided', async () => {
    await fc.assert(
      fc.property(validOidcConfigArb, (config) => {
        const app = new cdk.App();
        expect(() => {
          new DemoSecurityStack(app, `TestStack-${Math.random().toString(36).slice(2, 8)}`, {
            projectName: 'test',
            environment: 'test',
            oidcProviderConfig: config,
          });
        }).not.toThrow();
      }),
      { numRuns: 20 }
    );
  });
});

describe('Property 14: IdP登録組み合わせ', () => {
  it('enableAdFederation=false + oidcProviderConfig → OIDC IdP only', async () => {
    await fc.assert(
      fc.property(validOidcConfigArb, (oidcConfig) => {
        const app = new cdk.App();
        const stack = new DemoSecurityStack(app, `TestStack-${Math.random().toString(36).slice(2, 8)}`, {
          projectName: 'test',
          environment: 'test',
          enableAdFederation: false,
          oidcProviderConfig: oidcConfig,
        });

        // OIDC provider should be created
        expect(stack.oidcProvider).toBeDefined();
        // SAML provider should NOT be created
        expect(stack.samlProvider).toBeUndefined();
      }),
      { numRuns: 20 }
    );
  });

  it('enableAdFederation=true + oidcProviderConfig → both SAML and OIDC', async () => {
    await fc.assert(
      fc.property(validOidcConfigArb, (oidcConfig) => {
        const app = new cdk.App();
        const stack = new DemoSecurityStack(app, `TestStack-${Math.random().toString(36).slice(2, 8)}`, {
          projectName: 'test',
          environment: 'test',
          enableAdFederation: true,
          adType: 'self-managed',
          adEc2InstanceId: 'i-0123456789abcdef0',
          samlMetadataUrl: 'https://portal.sso.ap-northeast-1.amazonaws.com/saml/metadata/test',
          oidcProviderConfig: oidcConfig,
        });

        // Both providers should be created
        expect(stack.oidcProvider).toBeDefined();
        expect(stack.samlProvider).toBeDefined();
      }),
      { numRuns: 20 }
    );
  });

  it('enableAdFederation=true + no oidcProviderConfig → SAML only (existing behavior)', async () => {
    await fc.assert(
      fc.property(fc.constant(null), () => {
        const app = new cdk.App();
        const stack = new DemoSecurityStack(app, `TestStack-${Math.random().toString(36).slice(2, 8)}`, {
          projectName: 'test',
          environment: 'test',
          enableAdFederation: true,
          adType: 'self-managed',
          adEc2InstanceId: 'i-0123456789abcdef0',
          samlMetadataUrl: 'https://portal.sso.ap-northeast-1.amazonaws.com/saml/metadata/test',
          // no oidcProviderConfig
        });

        // SAML provider should be created
        expect(stack.samlProvider).toBeDefined();
        // OIDC provider should NOT be created
        expect(stack.oidcProvider).toBeUndefined();
      }),
      { numRuns: 20 }
    );
  });

  it('no federation at all → neither SAML nor OIDC', async () => {
    await fc.assert(
      fc.property(fc.constant(null), () => {
        const app = new cdk.App();
        const stack = new DemoSecurityStack(app, `TestStack-${Math.random().toString(36).slice(2, 8)}`, {
          projectName: 'test',
          environment: 'test',
          enableAdFederation: false,
          // no oidcProviderConfig
        });

        expect(stack.samlProvider).toBeUndefined();
        expect(stack.oidcProvider).toBeUndefined();
      }),
      { numRuns: 20 }
    );
  });
});
