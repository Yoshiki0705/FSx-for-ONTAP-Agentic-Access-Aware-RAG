/**
 * Cognito AD Federation プロパティベーステスト
 *
 * Feature: cognito-ad-federation
 * テストフレームワーク: fast-check + aws-cdk-lib/assertions
 * 各プロパティテストは最低100回のイテレーションで実行
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as fc from 'fast-check';
import { DemoSecurityStack, DemoSecurityStackProps, AdType } from '../../lib/stacks/demo/demo-security-stack';

// ========================================
// ヘルパー: テスト用SecurityStackを生成
// ========================================

function createTestSecurityStack(overrides: Partial<DemoSecurityStackProps> = {}) {
  const app = new cdk.App();

  // VPCが必要な場合のダミーVPCスタック
  const vpcStack = new cdk.Stack(app, 'VpcStack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  const vpc = new ec2.Vpc(vpcStack, 'Vpc');

  const props: DemoSecurityStackProps = {
    projectName: 'testproj',
    environment: 'dev',
    env: { account: '123456789012', region: 'ap-northeast-1' },
    vpc,
    ...overrides,
  };

  const stack = new DemoSecurityStack(app, 'TestSecurity', props);
  const template = Template.fromStack(stack);
  return { app, stack, template };
}

// ========================================
// Property 1: CDK条件付きリソース作成（両ADパターン）
// ========================================

describe('Property 1: CDK条件付きリソース作成（両ADパターン）', () => {
  // Feature: cognito-ad-federation, Property 1: CDK条件付きリソース作成
  // **Validates: Requirements 1.1, 1.5, 4.1, 4.2**

  it('enableAdFederation=true + managed AD + adDirectoryId → SAML IdP/Cognito Domain/OAuth設定が作成される', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'x')),
        (directoryId) => {
          const { template } = createTestSecurityStack({
            enableAdFederation: true,
            adType: 'managed',
            adDirectoryId: directoryId,
            adDomainName: 'test.local',
            cloudFrontUrl: 'https://d123.cloudfront.net',
          });

          const resources = template.toJSON().Resources;

          // SAML IdPが存在すること
          const samlIdPs = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::Cognito::UserPoolIdentityProvider'
              && r.Properties?.ProviderType === 'SAML'
          );
          expect(samlIdPs.length).toBe(1);

          // SAML IdPのメタデータURLがportal.sso形式であること
          const samlIdP = samlIdPs[0] as any;
          const metadataUrl = samlIdP.Properties?.ProviderDetails?.MetadataURL;
          expect(metadataUrl).toBeDefined();
          expect(typeof metadataUrl === 'string'
            ? metadataUrl.includes('portal.sso')
            : JSON.stringify(metadataUrl).includes('portal.sso')
          ).toBe(true);

          // Cognito Domainが存在すること
          const domains = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::Cognito::UserPoolDomain'
          );
          expect(domains.length).toBe(1);

          // UserPoolClientにOAuth設定があること
          template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
            AllowedOAuthFlows: Match.arrayWith(['code']),
            AllowedOAuthScopes: Match.arrayWith(['openid', 'email', 'profile']),
            GenerateSecret: true,
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('enableAdFederation=true + self-managed AD + samlMetadataUrl → SAML IdP/Cognito Domain/OAuth設定が作成される', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (metadataUrl) => {
          const { template } = createTestSecurityStack({
            enableAdFederation: true,
            adType: 'self-managed',
            adEc2InstanceId: 'i-0123456789abcdef0',
            samlMetadataUrl: metadataUrl,
            cloudFrontUrl: 'https://d123.cloudfront.net',
          });

          const resources = template.toJSON().Resources;

          // SAML IdPが存在すること
          const samlIdPs = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::Cognito::UserPoolIdentityProvider'
              && r.Properties?.ProviderType === 'SAML'
          );
          expect(samlIdPs.length).toBe(1);

          // SAML IdPのメタデータURLがユーザー指定URLであること
          const samlIdP = samlIdPs[0] as any;
          const actualMetadataUrl = samlIdP.Properties?.ProviderDetails?.MetadataURL;
          expect(actualMetadataUrl).toBe(metadataUrl);

          // Cognito Domainが存在すること
          const domains = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::Cognito::UserPoolDomain'
          );
          expect(domains.length).toBe(1);

          // UserPoolClientにOAuth設定があること
          template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
            AllowedOAuthFlows: Match.arrayWith(['code']),
            GenerateSecret: true,
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('enableAdFederation=false → SAML IdP/Cognito Domain/OAuth設定が作成されない', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('managed' as AdType, 'self-managed' as AdType, 'none' as AdType),
        (adType) => {
          // enableAdFederation=false の場合、adTypeに関わらずフェデレーションリソースは作成されない
          // ただしadType != 'none'の場合はAD Sync Lambda用の必須パラメータが必要
          const extraProps: Partial<DemoSecurityStackProps> = {};
          if (adType === 'managed') {
            extraProps.adDirectoryId = 'd-1234567890';
            extraProps.adDomainName = 'test.local';
          } else if (adType === 'self-managed') {
            extraProps.adEc2InstanceId = 'i-0123456789abcdef0';
          }

          const { template } = createTestSecurityStack({
            enableAdFederation: false,
            adType,
            ...extraProps,
          });

          const resources = template.toJSON().Resources;

          // SAML IdPが存在しないこと
          const samlIdPs = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::Cognito::UserPoolIdentityProvider'
          );
          expect(samlIdPs.length).toBe(0);

          // Cognito Domainが存在しないこと
          const domains = Object.values(resources).filter(
            (r: any) => r.Type === 'AWS::Cognito::UserPoolDomain'
          );
          expect(domains.length).toBe(0);

          // UserPoolClientにOAuth設定がないこと（generateSecret=false）
          template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
            GenerateSecret: false,
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('enableAdFederation=true + managed AD + adDirectoryId欠落 → エラーがスローされる', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined),
        () => {
          expect(() => {
            createTestSecurityStack({
              enableAdFederation: true,
              adType: 'managed',
              adDirectoryId: undefined,
            });
          }).toThrow(/adDirectoryId/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('enableAdFederation=true + self-managed AD + samlMetadataUrl欠落 → エラーがスローされる', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined),
        () => {
          expect(() => {
            createTestSecurityStack({
              enableAdFederation: true,
              adType: 'self-managed',
              adEc2InstanceId: 'i-0123456789abcdef0',
              samlMetadataUrl: undefined,
            });
          }).toThrow(/samlMetadataUrl/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('enableAdFederation=true + self-managed AD + adEc2InstanceId欠落 → エラーがスローされる', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined),
        () => {
          expect(() => {
            createTestSecurityStack({
              enableAdFederation: true,
              adType: 'self-managed',
              adEc2InstanceId: undefined,
              samlMetadataUrl: 'https://login.microsoftonline.com/metadata',
            });
          }).toThrow(/adEc2InstanceId/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
