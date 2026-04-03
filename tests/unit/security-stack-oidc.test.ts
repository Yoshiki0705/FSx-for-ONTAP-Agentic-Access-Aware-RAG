/**
 * DemoSecurityStack OIDC拡張 ユニットテスト
 *
 * テスト対象: lib/stacks/demo/demo-security-stack.ts (OIDC IdP登録ロジック)
 *
 * テストケース:
 *   1. OIDC IdP登録時のCloudFormationテンプレート検証
 *   2. SAML + OIDC ハイブリッド構成のテンプレート検証
 *   3. OIDC-only構成（enableAdFederation=false）の検証
 *   4. OIDC バリデーションエラー（clientId / issuerUrl 欠損）
 *   5. 後方互換性: OIDC未指定時は既存動作を維持
 *
 * Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 9.2, 9.3
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
// 1. OIDC IdP登録 — CloudFormationテンプレート検証
// Validates: Requirements 1.1, 1.4
// ========================================

describe('OIDC IdP registration', () => {
  it('oidcProviderConfig指定時にUserPoolIdentityProviderOidcリソースが作成される', () => {
    const { template } = createTestSecurityStack({
      oidcProviderConfig: {
        providerName: 'Keycloak',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        issuerUrl: 'https://keycloak.example.com/realms/main',
      },
      cloudFrontUrl: 'https://d111111abcdef8.cloudfront.net',
    });

    // OIDC IdPリソースが作成されること
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderName: 'Keycloak',
      ProviderType: 'OIDC',
      ProviderDetails: Match.objectLike({
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        oidc_issuer: 'https://keycloak.example.com/realms/main',
        authorize_scopes: 'openid email profile',
      }),
    });
  });

  it('OIDC IdP登録時にemail属性マッピングが設定される', () => {
    const { template } = createTestSecurityStack({
      oidcProviderConfig: {
        providerName: 'Okta',
        clientId: 'okta-client-id',
        clientSecret: 'okta-secret',
        issuerUrl: 'https://company.okta.com',
      },
    });

    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderType: 'OIDC',
      AttributeMapping: Match.objectLike({
        email: 'email',
      }),
    });
  });

  it('OIDC IdP登録時にCognito Domainが作成される', () => {
    const { template } = createTestSecurityStack({
      oidcProviderConfig: {
        providerName: 'Keycloak',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        issuerUrl: 'https://keycloak.example.com/realms/main',
      },
    });

    template.hasResourceProperties('AWS::Cognito::UserPoolDomain', {
      Domain: 'testproj-dev-auth',
    });
  });
});

// ========================================
// 2. OIDC-only構成（enableAdFederation=false）
// Validates: Requirements 9.2
// ========================================

describe('OIDC-only configuration (enableAdFederation=false)', () => {
  it('SAML IdPが作成されずOIDC IdPのみ作成される', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: false,
      oidcProviderConfig: {
        providerName: 'Keycloak',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        issuerUrl: 'https://keycloak.example.com/realms/main',
      },
    });

    const resources = template.toJSON().Resources;

    // OIDC IdPが存在すること
    const oidcIdPs = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::Cognito::UserPoolIdentityProvider' && r.Properties?.ProviderType === 'OIDC'
    );
    expect(oidcIdPs).toHaveLength(1);

    // SAML IdPが存在しないこと
    const samlIdPs = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::Cognito::UserPoolIdentityProvider' && r.Properties?.ProviderType === 'SAML'
    );
    expect(samlIdPs).toHaveLength(0);
  });

  it('User Pool ClientにOIDC IdPがサポートプロバイダーとして設定される', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: false,
      oidcProviderConfig: {
        providerName: 'Keycloak',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        issuerUrl: 'https://keycloak.example.com/realms/main',
      },
      cloudFrontUrl: 'https://d111111abcdef8.cloudfront.net',
    });

    // COGNITO + OIDC Ref = 2 providers
    const resources = template.toJSON().Resources;
    const client = Object.values(resources).find(
      (r: any) => r.Type === 'AWS::Cognito::UserPoolClient'
    ) as any;
    const providers = client.Properties.SupportedIdentityProviders;
    expect(providers).toHaveLength(2);
    expect(providers).toContain('COGNITO');
    // OIDC provider is a Ref token
    const refProviders = providers.filter((p: any) => typeof p === 'object' && p.Ref);
    expect(refProviders).toHaveLength(1);
  });

  it('User Pool ClientにOAuth設定が含まれる', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: false,
      oidcProviderConfig: {
        providerName: 'Keycloak',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        issuerUrl: 'https://keycloak.example.com/realms/main',
      },
      cloudFrontUrl: 'https://d111111abcdef8.cloudfront.net',
    });

    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: ['code'],
      AllowedOAuthScopes: Match.arrayWith(['openid', 'email', 'profile']),
      CallbackURLs: ['https://d111111abcdef8.cloudfront.net/api/auth/callback'],
      LogoutURLs: ['https://d111111abcdef8.cloudfront.net/signin'],
    });
  });
});

// ========================================
// 3. SAML + OIDC ハイブリッド構成
// Validates: Requirements 1.5, 9.3
// ========================================

describe('SAML + OIDC hybrid configuration', () => {
  it('SAML IdPとOIDC IdPの両方が作成される', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: true,
      adType: 'managed',
      adDirectoryId: 'd-1234567890',
      cloudFrontUrl: 'https://d111111abcdef8.cloudfront.net',
      oidcProviderConfig: {
        providerName: 'Okta',
        clientId: 'okta-client-id',
        clientSecret: 'okta-secret',
        issuerUrl: 'https://company.okta.com',
      },
    });

    const resources = template.toJSON().Resources;

    // SAML IdPが存在すること
    const samlIdPs = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::Cognito::UserPoolIdentityProvider' && r.Properties?.ProviderType === 'SAML'
    );
    expect(samlIdPs).toHaveLength(1);

    // OIDC IdPが存在すること
    const oidcIdPs = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::Cognito::UserPoolIdentityProvider' && r.Properties?.ProviderType === 'OIDC'
    );
    expect(oidcIdPs).toHaveLength(1);
  });

  it('User Pool Clientに SAML + OIDC 両方がサポートプロバイダーとして設定される', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: true,
      adType: 'managed',
      adDirectoryId: 'd-1234567890',
      cloudFrontUrl: 'https://d111111abcdef8.cloudfront.net',
      oidcProviderConfig: {
        providerName: 'Okta',
        clientId: 'okta-client-id',
        clientSecret: 'okta-secret',
        issuerUrl: 'https://company.okta.com',
      },
    });

    // COGNITO + SAML Ref + OIDC Ref = 3 providers
    const resources = template.toJSON().Resources;
    const client = Object.values(resources).find(
      (r: any) => r.Type === 'AWS::Cognito::UserPoolClient'
    ) as any;
    const providers = client.Properties.SupportedIdentityProviders;
    expect(providers).toHaveLength(3);
    expect(providers).toContain('COGNITO');
    // SAML and OIDC providers are Ref tokens (objects)
    const refProviders = providers.filter((p: any) => typeof p === 'object' && p.Ref);
    expect(refProviders).toHaveLength(2);
  });

  it('Cognito Domainが1つだけ作成される', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: true,
      adType: 'managed',
      adDirectoryId: 'd-1234567890',
      cloudFrontUrl: 'https://d111111abcdef8.cloudfront.net',
      oidcProviderConfig: {
        providerName: 'Okta',
        clientId: 'okta-client-id',
        clientSecret: 'okta-secret',
        issuerUrl: 'https://company.okta.com',
      },
    });

    template.resourceCountIs('AWS::Cognito::UserPoolDomain', 1);
  });
});

// ========================================
// 4. OIDC バリデーションエラー
// Validates: Requirements 1.6
// ========================================

describe('OIDC validation errors', () => {
  it('oidcProviderConfig.clientId欠損時にエラーがスローされる', () => {
    expect(() => {
      createTestSecurityStack({
        oidcProviderConfig: {
          providerName: 'Keycloak',
          clientId: '',  // 空文字 = falsy
          clientSecret: 'test-secret',
          issuerUrl: 'https://keycloak.example.com/realms/main',
        },
      });
    }).toThrow(/clientId.*issuerUrl/);
  });

  it('oidcProviderConfig.issuerUrl欠損時にエラーがスローされる', () => {
    expect(() => {
      createTestSecurityStack({
        oidcProviderConfig: {
          providerName: 'Keycloak',
          clientId: 'test-client-id',
          clientSecret: 'test-secret',
          issuerUrl: '',  // 空文字 = falsy
        },
      });
    }).toThrow(/clientId.*issuerUrl/);
  });
});

// ========================================
// 5. 後方互換性: OIDC未指定時は既存動作を維持
// Validates: Requirements 9.2
// ========================================

describe('Backward compatibility (no OIDC config)', () => {
  it('oidcProviderConfig未指定時にOIDC IdPが作成されない', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: false,
    });

    const resources = template.toJSON().Resources;
    const oidcIdPs = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::Cognito::UserPoolIdentityProvider' && r.Properties?.ProviderType === 'OIDC'
    );
    expect(oidcIdPs).toHaveLength(0);
  });

  it('SAML-only構成が変更されない', () => {
    const { template } = createTestSecurityStack({
      enableAdFederation: true,
      adType: 'managed',
      adDirectoryId: 'd-1234567890',
      cloudFrontUrl: 'https://d111111abcdef8.cloudfront.net',
    });

    // SAML IdPのみ存在
    const resources = template.toJSON().Resources;
    const samlIdPs = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::Cognito::UserPoolIdentityProvider' && r.Properties?.ProviderType === 'SAML'
    );
    expect(samlIdPs).toHaveLength(1);

    const oidcIdPs = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::Cognito::UserPoolIdentityProvider' && r.Properties?.ProviderType === 'OIDC'
    );
    expect(oidcIdPs).toHaveLength(0);

    // User Pool ClientにSAMLプロバイダーのみ（COGNITO + SAML = 2つ）
    const resources2 = template.toJSON().Resources;
    const client = Object.values(resources2).find(
      (r: any) => r.Type === 'AWS::Cognito::UserPoolClient'
    ) as any;
    expect(client.Properties.SupportedIdentityProviders).toHaveLength(2);
    expect(client.Properties.SupportedIdentityProviders).toContain('COGNITO');
  });

  it('stack.oidcProvider が undefined', () => {
    const { stack } = createTestSecurityStack({
      enableAdFederation: false,
    });

    expect(stack.oidcProvider).toBeUndefined();
  });
});

// ========================================
// 6. OIDC構成時のstack公開プロパティ検証
// ========================================

describe('OIDC stack public properties', () => {
  it('stack.oidcProvider が設定される', () => {
    const { stack } = createTestSecurityStack({
      oidcProviderConfig: {
        providerName: 'Keycloak',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        issuerUrl: 'https://keycloak.example.com/realms/main',
      },
    });

    expect(stack.oidcProvider).toBeDefined();
  });

  it('stack.cognitoDomainUrl が設定される（OIDC-only）', () => {
    const { stack } = createTestSecurityStack({
      oidcProviderConfig: {
        providerName: 'Keycloak',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        issuerUrl: 'https://keycloak.example.com/realms/main',
      },
    });

    expect(stack.cognitoDomainUrl).toBeDefined();
  });
});


// ========================================
// 7. LDAP設定時のLambda VPC配置とIAM権限
// Validates: Requirements 9.4, 9.5
// ========================================

describe('LDAP config — Lambda VPC placement and IAM permissions', () => {
  const ldapConfig = {
    ldapUrl: 'ldaps://ldap.example.com:636',
    baseDn: 'dc=example,dc=com',
    bindDn: 'cn=readonly,dc=example,dc=com',
    bindPasswordSecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:ldap-bind-password-AbCdEf',
    userSearchFilter: '(mail={email})',
    groupSearchFilter: '(member={dn})',
  };

  it('ldapConfig指定 + adType=none でIdentity Sync Lambdaが作成される', () => {
    const { template, stack } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
    });

    // Lambda関数が作成されること
    expect(stack.adSyncFunction).toBeDefined();
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-identity-sync',
      Runtime: 'nodejs22.x',
      Handler: 'index.handler',
    });
  });

  it('ldapConfig指定時にLambdaがVPC内に配置される', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
    });

    // Lambda関数にVpcConfig（SubnetIds, SecurityGroupIds）が設定されること
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-identity-sync',
      VpcConfig: Match.objectLike({
        SubnetIds: Match.anyValue(),
        SecurityGroupIds: Match.anyValue(),
      }),
    });
  });

  it('ldapConfig指定時にSecrets Manager読み取り権限が付与される', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
    });

    // IAMポリシーにsecretsmanager:GetSecretValueが含まれること
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'secretsmanager:GetSecretValue',
            Effect: 'Allow',
            Resource: ldapConfig.bindPasswordSecretArn,
          }),
        ]),
      }),
    });
  });

  it('ldapConfig指定時にLDAPポート(389/636)のアウトバウンドルールが設定される', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
    });

    // セキュリティグループにLDAPポートのアウトバウンドルールが含まれること
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Security group for Identity Sync Lambda (LDAP connectivity)',
      SecurityGroupEgress: Match.arrayWith([
        Match.objectLike({
          IpProtocol: 'tcp',
          FromPort: 389,
          ToPort: 389,
          CidrIp: '0.0.0.0/0',
          Description: 'Allow LDAP outbound (port 389)',
        }),
        Match.objectLike({
          IpProtocol: 'tcp',
          FromPort: 636,
          ToPort: 636,
          CidrIp: '0.0.0.0/0',
          Description: 'Allow LDAPS outbound (port 636)',
        }),
      ]),
    });
  });

  it('ldapConfig指定時にHTTPS(443)のアウトバウンドルールが設定される', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
    });

    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Security group for Identity Sync Lambda (LDAP connectivity)',
      SecurityGroupEgress: Match.arrayWith([
        Match.objectLike({
          IpProtocol: 'tcp',
          FromPort: 443,
          ToPort: 443,
          CidrIp: '0.0.0.0/0',
        }),
      ]),
    });
  });

  it('ldapConfig + adType=managed の場合、既存AD Sync LambdaにSecrets Manager権限が追加される', () => {
    const { template, stack } = createTestSecurityStack({
      adType: 'managed',
      adDirectoryId: 'd-1234567890',
      ldapConfig,
    });

    // AD Sync Lambdaが作成されること（createAdSyncLambda経由）
    expect(stack.adSyncFunction).toBeDefined();

    // Secrets Manager権限が付与されること
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'secretsmanager:GetSecretValue',
            Effect: 'Allow',
            Resource: ldapConfig.bindPasswordSecretArn,
          }),
        ]),
      }),
    });
  });

  it('ldapConfig未指定時にIdentity Sync Lambdaが作成されない（adType=none）', () => {
    const { template, stack } = createTestSecurityStack({
      adType: 'none',
    });

    expect(stack.adSyncFunction).toBeUndefined();

    // Lambda関数が存在しないこと
    const resources = template.toJSON().Resources;
    const lambdaFunctions = Object.values(resources).filter(
      (r: any) => r.Type === 'AWS::Lambda::Function'
    );
    expect(lambdaFunctions).toHaveLength(0);
  });

  it('ldapConfig指定 + vpc未指定時にエラーがスローされる', () => {
    const app = new cdk.App();
    expect(() => {
      new DemoSecurityStack(app, 'TestNoVpc', {
        projectName: 'testproj',
        environment: 'dev',
        env: { account: '123456789012', region: 'ap-northeast-1' },
        adType: 'none',
        // vpc is not provided
        ldapConfig,
      });
    }).toThrow(/ldapConfig requires vpc/);
  });
});


// ========================================
// 8. OIDC/LDAP設定の環境変数検証
// Validates: Requirements 10.1, 10.2
// ========================================

describe('OIDC/LDAP environment variables on Lambda', () => {
  const ldapConfig = {
    ldapUrl: 'ldaps://ldap.example.com:636',
    baseDn: 'dc=example,dc=com',
    bindDn: 'cn=readonly,dc=example,dc=com',
    bindPasswordSecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:ldap-bind-password-AbCdEf',
    userSearchFilter: '(mail={email})',
    groupSearchFilter: '(member={dn})',
  };

  it('ldapConfig指定時にLDAP環境変数がLambdaに設定される（Identity Sync Lambda）', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-identity-sync',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          LDAP_URL: 'ldaps://ldap.example.com:636',
          LDAP_BASE_DN: 'dc=example,dc=com',
          LDAP_BIND_DN: 'cn=readonly,dc=example,dc=com',
          LDAP_BIND_PASSWORD_SECRET_ARN: ldapConfig.bindPasswordSecretArn,
          LDAP_USER_SEARCH_FILTER: '(mail={email})',
          LDAP_GROUP_SEARCH_FILTER: '(member={dn})',
        }),
      }),
    });
  });

  it('LDAP環境変数にプレーンテキストパスワードが含まれない（ARN参照のみ）', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
    });

    const resources = template.toJSON().Resources;
    const lambdaFn = Object.values(resources).find(
      (r: any) => r.Type === 'AWS::Lambda::Function' && r.Properties?.FunctionName === 'testproj-dev-identity-sync'
    ) as any;

    const envVars = lambdaFn.Properties.Environment.Variables;

    // LDAP_BIND_PASSWORD_SECRET_ARN はARN形式であること
    expect(envVars.LDAP_BIND_PASSWORD_SECRET_ARN).toMatch(/^arn:aws:secretsmanager:/);

    // プレーンテキストパスワード環境変数が存在しないこと
    expect(envVars.LDAP_BIND_PASSWORD).toBeUndefined();
    expect(envVars.LDAP_PASSWORD).toBeUndefined();
  });

  it('oidcProviderConfig指定時にOIDC_GROUP_CLAIM_NAMEが設定される', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
      oidcProviderConfig: {
        providerName: 'Keycloak',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        issuerUrl: 'https://keycloak.example.com/realms/main',
        groupClaimName: 'custom_groups',
      },
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-identity-sync',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          OIDC_GROUP_CLAIM_NAME: 'custom_groups',
        }),
      }),
    });
  });

  it('groupClaimName未指定時にデフォルト値 "groups" が設定される', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
      oidcProviderConfig: {
        providerName: 'Keycloak',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        issuerUrl: 'https://keycloak.example.com/realms/main',
        // groupClaimName not specified
      },
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-identity-sync',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          OIDC_GROUP_CLAIM_NAME: 'groups',
        }),
      }),
    });
  });

  it('permissionMappingStrategy が環境変数に設定される', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
      permissionMappingStrategy: 'hybrid',
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-identity-sync',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          PERMISSION_MAPPING_STRATEGY: 'hybrid',
        }),
      }),
    });
  });

  it('permissionMappingStrategy未指定時にデフォルト値 "sid-only" が設定される', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-identity-sync',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          PERMISSION_MAPPING_STRATEGY: 'sid-only',
        }),
      }),
    });
  });

  it('ontapNameMappingEnabled が環境変数に設定される', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
      ontapNameMappingEnabled: true,
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-identity-sync',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          ONTAP_NAME_MAPPING_ENABLED: 'true',
        }),
      }),
    });
  });

  it('ontapNameMappingEnabled未指定時にデフォルト値 "false" が設定される', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig,
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-identity-sync',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          ONTAP_NAME_MAPPING_ENABLED: 'false',
        }),
      }),
    });
  });

  it('ldapConfig + adType=managed の場合、AD Sync LambdaにもLDAP環境変数が設定される', () => {
    const { template } = createTestSecurityStack({
      adType: 'managed',
      adDirectoryId: 'd-1234567890',
      ldapConfig,
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-ad-sync',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          LDAP_URL: 'ldaps://ldap.example.com:636',
          LDAP_BASE_DN: 'dc=example,dc=com',
          LDAP_BIND_DN: 'cn=readonly,dc=example,dc=com',
          LDAP_BIND_PASSWORD_SECRET_ARN: ldapConfig.bindPasswordSecretArn,
          LDAP_USER_SEARCH_FILTER: '(mail={email})',
          LDAP_GROUP_SEARCH_FILTER: '(member={dn})',
          PERMISSION_MAPPING_STRATEGY: 'sid-only',
          ONTAP_NAME_MAPPING_ENABLED: 'false',
        }),
      }),
    });
  });

  it('LDAP userSearchFilter/groupSearchFilter未指定時にデフォルト値が設定される', () => {
    const { template } = createTestSecurityStack({
      adType: 'none',
      ldapConfig: {
        ldapUrl: 'ldap://ldap.example.com:389',
        baseDn: 'dc=test,dc=com',
        bindDn: 'cn=admin,dc=test,dc=com',
        bindPasswordSecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:test-pwd-XyZ123',
        // userSearchFilter and groupSearchFilter not specified
      },
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-identity-sync',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          LDAP_USER_SEARCH_FILTER: '(mail={email})',
          LDAP_GROUP_SEARCH_FILTER: '(member={dn})',
        }),
      }),
    });
  });
});
