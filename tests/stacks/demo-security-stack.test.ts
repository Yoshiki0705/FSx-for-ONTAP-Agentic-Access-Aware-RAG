/**
 * SecurityStack CDK ユニットテスト
 *
 * テスト対象: lib/stacks/demo/demo-security-stack.ts
 * テストケース:
 *   1. Managed ADフェデレーション有効時のテンプレートスナップショット
 *   2. Self-managed ADフェデレーション有効時のテンプレートスナップショット
 *   3. フェデレーション無効時のテンプレートスナップショット（後方互換性）
 *   4. Post-Authentication Trigger接続の検証（Managed AD）
 *   5. Post-Authentication Trigger接続の検証（Self-managed AD）
 *   6. CDKバリデーションエラー（必須パラメータ欠落時）
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 2.1
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { DemoSecurityStack, DemoSecurityStackProps } from '../../lib/stacks/demo/demo-security-stack';

// ========================================
// ヘルパー: テスト用SecurityStackを生成
// ========================================

function createTestSecurityStack(overrides: Partial<DemoSecurityStackProps> = {}) {
  const app = new cdk.App();
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
// 1. Managed ADフェデレーション有効時 — スナップショットテスト
// Validates: Requirements 1.1, 1.2, 1.3, 1.5
// ========================================

describe('Managed AD federation enabled - snapshot', () => {
  it('テンプレートスナップショットが一致する', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: true,
      adType: 'managed',
      adDirectoryId: 'd-1234567890',
      adDomainName: 'corp.example.com',
      cloudFrontUrl: 'https://d111111abcdef8.cloudfront.net',
    });

    expect(template.toJSON()).toMatchSnapshot();
  });
});

// ========================================
// 2. Self-managed ADフェデレーション有効時 — スナップショットテスト
// Validates: Requirements 1.1, 1.2, 1.3, 1.5
// ========================================

describe('Self-managed AD federation enabled - snapshot', () => {
  it('テンプレートスナップショットが一致する', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: true,
      adType: 'self-managed',
      adEc2InstanceId: 'i-0123456789abcdef0',
      samlMetadataUrl: 'https://login.microsoftonline.com/tenant-id/federationmetadata/2007-06/federationmetadata.xml',
      cloudFrontUrl: 'https://d222222abcdef8.cloudfront.net',
    });

    expect(template.toJSON()).toMatchSnapshot();
  });
});

// ========================================
// 3. フェデレーション無効時 — スナップショットテスト（後方互換性）
// Validates: Requirements 1.5
// ========================================

describe('Federation disabled - snapshot (backward compatibility)', () => {
  it('テンプレートスナップショットが一致する（SAML IdP/Cognito Domain/OAuthなし）', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: false,
    });

    const resources = template.toJSON().Resources;

    // SAML IdPが存在しないこと
    const samlIdPs = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::Cognito::UserPoolIdentityProvider'
    );
    expect(samlIdPs).toHaveLength(0);

    // Cognito Domainが存在しないこと
    const domains = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::Cognito::UserPoolDomain'
    );
    expect(domains).toHaveLength(0);

    // UserPoolClientにOAuth設定がないこと（generateSecret=false）
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
    });

    expect(template.toJSON()).toMatchSnapshot();
  });
});


// ========================================
// 4. Post-Authentication Trigger接続の検証（Managed AD）
// Validates: Requirements 2.1
// ========================================

describe('Post-Authentication Trigger connection (managed AD)', () => {
  it('UserPoolにPostAuthentication Lambda Triggerが設定される', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: true,
      adType: 'managed',
      adDirectoryId: 'd-1234567890',
      adDomainName: 'corp.example.com',
      cloudFrontUrl: 'https://d111111abcdef8.cloudfront.net',
    });

    // UserPoolにLambdaConfig.PostAuthenticationが設定されていること
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      LambdaConfig: {
        PostAuthentication: Match.anyValue(),
      },
    });
  });
});

// ========================================
// 5. Post-Authentication Trigger接続の検証（Self-managed AD）
// Validates: Requirements 2.1
// ========================================

describe('Post-Authentication Trigger connection (self-managed AD)', () => {
  it('UserPoolにPostAuthentication Lambda Triggerが設定される', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: true,
      adType: 'self-managed',
      adEc2InstanceId: 'i-0123456789abcdef0',
      samlMetadataUrl: 'https://login.microsoftonline.com/tenant-id/federationmetadata/2007-06/federationmetadata.xml',
      cloudFrontUrl: 'https://d222222abcdef8.cloudfront.net',
    });

    // UserPoolにLambdaConfig.PostAuthenticationが設定されていること
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      LambdaConfig: {
        PostAuthentication: Match.anyValue(),
      },
    });
  });
});

// ========================================
// 6. CDKバリデーションエラー（必須パラメータ欠落時）
// Validates: Requirements 1.1, 1.5
// ========================================

describe('CDK validation errors (missing required parameters)', () => {
  it('enableAdFederation=true + managed + adDirectoryId欠落 → エラー', () => {
    expect(() => {
      createTestSecurityStack({
        enableAdFederation: true,
        adType: 'managed',
        adDirectoryId: undefined,
      });
    }).toThrow(/adDirectoryId/);
  });

  it('enableAdFederation=true + self-managed + adEc2InstanceId欠落 → エラー', () => {
    expect(() => {
      createTestSecurityStack({
        enableAdFederation: true,
        adType: 'self-managed',
        adEc2InstanceId: undefined,
        samlMetadataUrl: 'https://login.microsoftonline.com/metadata',
      });
    }).toThrow(/adEc2InstanceId/);
  });

  it('enableAdFederation=true + self-managed + samlMetadataUrl欠落 → エラー', () => {
    expect(() => {
      createTestSecurityStack({
        enableAdFederation: true,
        adType: 'self-managed',
        adEc2InstanceId: 'i-0123456789abcdef0',
        samlMetadataUrl: undefined,
      });
    }).toThrow(/samlMetadataUrl/);
  });
});
