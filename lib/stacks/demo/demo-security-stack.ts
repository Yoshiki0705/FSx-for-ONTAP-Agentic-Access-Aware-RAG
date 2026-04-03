/**
 * DemoSecurityStack
 *
 * Cognito User Pool + オプションのAD Sync Lambda。
 *
 * AD Sync方式:
 *   - managed: AWS Managed AD / AD Connector（LDAP or SSM経由）
 *   - self-managed: セルフマネージドAD（SSM→Windows EC2→PowerShell）
 *   - none: AD Sync無効（手動SID登録）
 */

import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export type AdType = 'managed' | 'self-managed' | 'none';

export interface DemoSecurityStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  /** AD Sync方式（デフォルト: none） */
  adType?: AdType;
  /** Windows AD EC2インスタンスID（self-managed / managed+EC2 で必須） */
  adEc2InstanceId?: string;
  /** AWS Managed AD Directory ID（managed で使用） */
  adDirectoryId?: string;
  /** ADドメイン名（managed で使用） */
  adDomainName?: string;
  /** AD DNS IPs（managed で使用、カンマ区切り） */
  adDnsIps?: string;
  /** VPC（AD Sync Lambda用） */
  vpc?: ec2.IVpc;
  /** Lambda用セキュリティグループ */
  lambdaSg?: ec2.ISecurityGroup;
  /** ユーザーアクセスDynamoDBテーブル */
  userAccessTable?: dynamodb.ITable;
  /** SAMLフェデレーション有効化フラグ（デフォルト: false） */
  enableAdFederation?: boolean;
  /** CloudFront Distribution URL（コールバックURL用） */
  cloudFrontUrl?: string;
  /** セルフマネージドAD用: Entra IDフェデレーションメタデータURL */
  samlMetadataUrl?: string;

  /** OIDC IdP設定（オプション） */
  oidcProviderConfig?: {
    providerName: string;
    clientId: string;
    clientSecret: string;
    issuerUrl: string;
    attributeMapping?: Record<string, string>;
    groupClaimName?: string; // デフォルト: 'groups'
  };

  /** LDAP接続設定（オプション） */
  ldapConfig?: {
    ldapUrl: string;           // ldap:// or ldaps://
    baseDn: string;
    bindDn: string;
    bindPasswordSecretArn: string;
    userSearchFilter?: string;  // デフォルト: '(mail={email})'
    groupSearchFilter?: string; // デフォルト: '(member={dn})'
  };

  /** ONTAP name-mapping有効化フラグ */
  ontapNameMappingEnabled?: boolean;

  /** 権限マッピング戦略 */
  permissionMappingStrategy?: 'sid-only' | 'uid-gid' | 'hybrid';
}

export class DemoSecurityStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public adSyncFunction?: lambda.Function;
  public samlProvider?: cognito.UserPoolIdentityProviderSaml;
  public oidcProvider?: cognito.UserPoolIdentityProviderOidc;
  public cognitoDomainUrl?: string;
  public cognitoDomainPrefix?: string;

  constructor(scope: Construct, id: string, props: DemoSecurityStackProps) {
    super(scope, id, props);

    const { projectName, environment } = props;
    const prefix = `${projectName}-${environment}`;
    const adType = props.adType || 'none';

    // ========================================
    // CDKバリデーション（enableAdFederation=true の場合）
    // ========================================
    if (props.enableAdFederation) {
      if (adType === 'managed' && !props.adDirectoryId) {
        throw new Error(
          'enableAdFederation=true with adType=managed requires adDirectoryId. ' +
          'Please provide the AWS Managed AD Directory ID.',
        );
      }
      if (adType === 'self-managed') {
        if (!props.adEc2InstanceId) {
          throw new Error(
            'enableAdFederation=true with adType=self-managed requires adEc2InstanceId. ' +
            'Please provide the EC2 instance ID running Active Directory.',
          );
        }
        if (!props.samlMetadataUrl) {
          throw new Error(
            'enableAdFederation=true with adType=self-managed requires samlMetadataUrl. ' +
            'Please provide the Entra ID federation metadata URL.',
          );
        }
      }
    }

    // ========================================
    // CDKバリデーション（oidcProviderConfig の場合）
    // ========================================
    if (props.oidcProviderConfig) {
      if (!props.oidcProviderConfig.clientId || !props.oidcProviderConfig.issuerUrl) {
        throw new Error(
          'oidcProviderConfig requires clientId and issuerUrl. ' +
          'Please provide both the OIDC client ID and issuer URL.',
        );
      }
    }

    // ========================================
    // Cognito User Pool
    // ========================================
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${prefix}-user-pool`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
      // AD Federation用カスタム属性
      customAttributes: props.enableAdFederation ? {
        'ad_groups': new cognito.StringAttribute({ mutable: true }),
        'role': new cognito.StringAttribute({ mutable: true }),
      } : undefined,
      passwordPolicy: {
        minLength: 8, requireLowercase: true, requireUppercase: true,
        requireDigits: true, requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========================================
    // SAML IdP（enableAdFederation=true の場合）
    // ========================================
    if (props.enableAdFederation) {
      const attributeMapping: cognito.AttributeMapping = {
        email: cognito.ProviderAttribute.other(
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
        ),
        custom: {
          'custom:ad_groups': cognito.ProviderAttribute.other(
            'http://schemas.xmlsoap.org/claims/Group'
          ),
        },
      };

      if (adType === 'managed' && props.adDirectoryId) {
        // Managed AD: samlMetadataUrl指定時はそれを使用、未指定時はIAM Identity Center URL
        // 注意: IAM Identity Center URLを使用する場合は、事前にIAM Identity Centerで
        // Managed ADをIDソースとして設定し、SAMLアプリケーションを作成する必要がある
        const managedAdMetadataUrl = props.samlMetadataUrl
          || `https://portal.sso.${cdk.Aws.REGION}.amazonaws.com/saml/metadata/${props.adDirectoryId}`;
        this.samlProvider = new cognito.UserPoolIdentityProviderSaml(this, 'AdSamlIdP', {
          userPool: this.userPool,
          name: 'ActiveDirectory',
          metadata: cognito.UserPoolIdentityProviderSamlMetadata.url(managedAdMetadataUrl),
          attributeMapping,
        });
      } else if (adType === 'self-managed' && props.samlMetadataUrl) {
        // Self-managed AD: Entra IDフェデレーションメタデータURL
        const idpName = props.samlMetadataUrl ? 'EntraID' : 'ActiveDirectory';
        this.samlProvider = new cognito.UserPoolIdentityProviderSaml(this, 'AdSamlIdP', {
          userPool: this.userPool,
          name: idpName,
          metadata: cognito.UserPoolIdentityProviderSamlMetadata.url(props.samlMetadataUrl),
          attributeMapping,
        });
      }

      // ========================================
      // Cognito Domain（enableAdFederation=true の場合）
      // ========================================
      const domain = this.userPool.addDomain('CognitoDomain', {
        cognitoDomain: {
          domainPrefix: `${prefix}-auth`,
        },
      });
      this.cognitoDomainUrl = `${domain.domainName}.auth.${cdk.Aws.REGION}.amazoncognito.com`;
      this.cognitoDomainPrefix = `${prefix}-auth`;
    }

    // ========================================
    // OIDC IdP（oidcProviderConfig 指定時）
    // ========================================
    if (props.oidcProviderConfig) {
      this.oidcProvider = new cognito.UserPoolIdentityProviderOidc(this, 'OidcIdP', {
        userPool: this.userPool,
        name: props.oidcProviderConfig.providerName || 'OIDCProvider',
        clientId: props.oidcProviderConfig.clientId,
        clientSecret: props.oidcProviderConfig.clientSecret,
        issuerUrl: props.oidcProviderConfig.issuerUrl,
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: cognito.ProviderAttribute.other('email'),
        },
      });

      // OIDC有効時にCognito Domainがまだ作成されていない場合は作成
      if (!props.enableAdFederation) {
        const domain = this.userPool.addDomain('CognitoDomain', {
          cognitoDomain: {
            domainPrefix: `${prefix}-auth`,
          },
        });
        this.cognitoDomainUrl = `${domain.domainName}.auth.${cdk.Aws.REGION}.amazoncognito.com`;
        this.cognitoDomainPrefix = `${prefix}-auth`;
      }
    }

    // ========================================
    // Cognito User Pool Client
    // ========================================
    const hasSaml = !!(props.enableAdFederation && this.samlProvider);
    const hasOidc = !!this.oidcProvider;
    const hasFederation = hasSaml || hasOidc;
    const callbackUrl = props.cloudFrontUrl || 'https://localhost:3000';

    if (hasFederation) {
      // フェデレーション有効時: OAuth設定付きクライアント
      const supportedProviders: cognito.UserPoolClientIdentityProvider[] = [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ];

      if (hasSaml) {
        supportedProviders.push(
          cognito.UserPoolClientIdentityProvider.custom(this.samlProvider!.providerName),
        );
      }
      if (hasOidc) {
        supportedProviders.push(
          cognito.UserPoolClientIdentityProvider.custom(this.oidcProvider!.providerName),
        );
      }

      this.userPoolClient = this.userPool.addClient('WebAppClient', {
        userPoolClientName: `${prefix}-webapp-client`,
        authFlows: { userPassword: true, userSrp: true },
        generateSecret: true,
        oAuth: {
          flows: { authorizationCodeGrant: true },
          scopes: [
            cognito.OAuthScope.OPENID,
            cognito.OAuthScope.EMAIL,
            cognito.OAuthScope.PROFILE,
          ],
          callbackUrls: [`${callbackUrl}/api/auth/callback`],
          logoutUrls: [`${callbackUrl}/signin`],
        },
        supportedIdentityProviders: supportedProviders,
        preventUserExistenceErrors: true,
      });

      // IdPが先に作成されることを保証
      if (hasSaml) {
        this.userPoolClient.node.addDependency(this.samlProvider!);
      }
      if (hasOidc) {
        this.userPoolClient.node.addDependency(this.oidcProvider!);
      }
    } else {
      // フェデレーション無効時: 既存のUSER_PASSWORD_AUTH設定を維持
      this.userPoolClient = this.userPool.addClient('WebAppClient', {
        userPoolClientName: `${prefix}-webapp-client`,
        authFlows: { userPassword: true, userSrp: true },
        generateSecret: false,
        preventUserExistenceErrors: true,
      });
    }

    // ========================================
    // AD Sync Lambda（adType != 'none' の場合）
    // ========================================
    if (adType !== 'none') {
      this.createAdSyncLambda(prefix, adType, props);
    }

    // ========================================
    // Identity Sync Lambda（ldapConfig指定 or OIDC単独構成 + adType='none' の場合）
    // adType != 'none' の場合は createAdSyncLambda で既に作成済み
    // OIDC単独構成（ldapConfigなし）でもOIDCクレームベースのゼロタッチプロビジョニングに必要
    // ========================================
    if ((props.ldapConfig || props.oidcProviderConfig) && !this.adSyncFunction) {
      this.createIdentitySyncLambda(prefix, props);
    }

    // ========================================
    // LDAP設定時の追加権限・ネットワーク設定
    // ========================================
    if (props.ldapConfig && this.adSyncFunction) {
      this.configureLdapPermissions(props);
    }

    // ========================================
    // Post-Authentication + Post-Confirmation Trigger（フェデレーション有効時: SAML or OIDC）
    // PostAuthentication: 2回目以降のサインインで発火
    // PostConfirmation: 外部IdP経由の初回サインイン時に発火（OIDC/SAML）
    // ========================================
    const hasFederationTrigger = (props.enableAdFederation || !!props.oidcProviderConfig) && this.adSyncFunction;
    if (hasFederationTrigger) {
      this.userPool.addTrigger(
        cognito.UserPoolOperation.POST_AUTHENTICATION,
        this.adSyncFunction!,
      );
      this.userPool.addTrigger(
        cognito.UserPoolOperation.POST_CONFIRMATION,
        this.adSyncFunction!,
      );
    }

    // ========================================
    // CloudFormation出力
    // ========================================
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `${prefix}-UserPoolId`,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `${prefix}-UserPoolClientId`,
    });
    new cdk.CfnOutput(this, 'AdSyncMode', {
      value: adType,
      description: 'AD Sync mode: managed | self-managed | none',
    });

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
  }

  private createAdSyncLambda(prefix: string, adType: AdType, props: DemoSecurityStackProps): void {
    // バリデーション
    if (adType === 'self-managed' && !props.adEc2InstanceId) {
      throw new Error('adEc2InstanceId is required for self-managed AD');
    }
    if (adType === 'managed' && !props.adDirectoryId && !props.adDnsIps) {
      throw new Error('adDirectoryId or adDnsIps is required for managed AD');
    }

    const env: Record<string, string> = {
      AD_TYPE: adType,
      USER_ACCESS_TABLE_NAME: props.userAccessTable?.tableName || `${prefix}-user-access`,
      SSM_TIMEOUT: '60',
      SID_CACHE_TTL: '86400',
    };

    if (props.adEc2InstanceId) env.AD_EC2_INSTANCE_ID = props.adEc2InstanceId;
    if (props.adDirectoryId) env.AD_DIRECTORY_ID = props.adDirectoryId;
    if (props.adDomainName) env.AD_DOMAIN_NAME = props.adDomainName;
    if (props.adDnsIps) env.AD_DNS_IPS = props.adDnsIps;

    // OIDC/LDAP設定の環境変数
    if (props.oidcProviderConfig) {
      env.OIDC_GROUP_CLAIM_NAME = props.oidcProviderConfig.groupClaimName || 'groups';
    }
    env.PERMISSION_MAPPING_STRATEGY = props.permissionMappingStrategy || 'sid-only';
    env.ONTAP_NAME_MAPPING_ENABLED = String(props.ontapNameMappingEnabled || false);

    this.adSyncFunction = new lambda.Function(this, 'AdSyncFn', {
      functionName: `${prefix}-ad-sync`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/agent-core-ad-sync', {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash', '-c',
            'npx esbuild index.ts --bundle --platform=node --target=node22 --outfile=/asset-output/index.js --external:@aws-sdk/*',
          ],
          local: {
            tryBundle(outputDir: string) {
              try {
                const { execSync } = require('child_process');
                execSync(
                  `npx esbuild lambda/agent-core-ad-sync/index.ts --bundle --platform=node --target=node22 --outfile=${outputDir}/index.js --external:@aws-sdk/*`,
                  { stdio: 'inherit' },
                );
                return true;
              } catch {
                return false;
              }
            },
          },
        },
      }),
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      ...(props.vpc ? {
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: props.lambdaSg ? [props.lambdaSg] : undefined,
      } : {}),
      environment: env,
    });

    // SSM権限（self-managed / managed+EC2）
    if (props.adEc2InstanceId) {
      this.adSyncFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ssm:SendCommand', 'ssm:GetCommandInvocation'],
        resources: [
          `arn:aws:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:instance/${props.adEc2InstanceId}`,
          `arn:aws:ssm:${cdk.Aws.REGION}::document/AWS-RunPowerShellScript`,
        ],
      }));
    }

    // Directory Service権限（managed）
    if (adType === 'managed') {
      this.adSyncFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['ds:DescribeDirectories'],
        resources: ['*'],
      }));
    }

    // DynamoDB権限
    if (props.userAccessTable) {
      props.userAccessTable.grantReadWriteData(this.adSyncFunction);
    } else {
      this.adSyncFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['dynamodb:PutItem', 'dynamodb:GetItem'],
        resources: [`arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/${prefix}-user-access`],
      }));
    }

    new cdk.CfnOutput(this, 'AdSyncFunctionName', {
      value: this.adSyncFunction.functionName,
      description: `AD Sync Lambda (${adType} mode)`,
    });
  }

  /**
   * LDAP設定時にIdentity Sync Lambdaを作成（adType='none' の場合）
   * VPC内に配置し、DynamoDB権限を付与する。
   */
  private createIdentitySyncLambda(prefix: string, props: DemoSecurityStackProps): void {
    const hasLdapConfig = !!props.ldapConfig;

    // LDAP設定時はVPC必須
    if (hasLdapConfig && !props.vpc) {
      throw new Error(
        'ldapConfig requires vpc to be specified for Lambda VPC placement. ' +
        'Please provide a VPC for LDAP connectivity.',
      );
    }

    // VPC/セキュリティグループ設定（LDAP設定時のみ）
    let securityGroups: ec2.ISecurityGroup[] | undefined;
    if (hasLdapConfig && props.vpc) {
      const ldapSg = new ec2.SecurityGroup(this, 'LdapLambdaSg', {
        vpc: props.vpc,
        description: 'Security group for Identity Sync Lambda (LDAP connectivity)',
        allowAllOutbound: false,
      });

      ldapSg.addEgressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(389),
        'Allow LDAP outbound (port 389)',
      );

      ldapSg.addEgressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(636),
        'Allow LDAPS outbound (port 636)',
      );

      ldapSg.addEgressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(443),
        'Allow HTTPS outbound (Secrets Manager, DynamoDB)',
      );

      securityGroups = props.lambdaSg ? [props.lambdaSg, ldapSg] : [ldapSg];
    }

    const env: Record<string, string> = {
      AD_TYPE: 'none',
      USER_ACCESS_TABLE_NAME: props.userAccessTable?.tableName || `${prefix}-user-access`,
      SID_CACHE_TTL: '86400',
    };

    // OIDC/LDAP設定の環境変数
    if (props.oidcProviderConfig) {
      env.OIDC_GROUP_CLAIM_NAME = props.oidcProviderConfig.groupClaimName || 'groups';
    }
    env.PERMISSION_MAPPING_STRATEGY = props.permissionMappingStrategy || 'sid-only';
    env.ONTAP_NAME_MAPPING_ENABLED = String(props.ontapNameMappingEnabled || false);

    this.adSyncFunction = new lambda.Function(this, 'IdentitySyncFn', {
      functionName: `${prefix}-identity-sync`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/agent-core-ad-sync', {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash', '-c',
            'npx esbuild index.ts --bundle --platform=node --target=node22 --outfile=/asset-output/index.js --external:@aws-sdk/*',
          ],
          local: {
            tryBundle(outputDir: string) {
              try {
                const { execSync } = require('child_process');
                execSync(
                  `npx esbuild lambda/agent-core-ad-sync/index.ts --bundle --platform=node --target=node22 --outfile=${outputDir}/index.js --external:@aws-sdk/*`,
                  { stdio: 'inherit' },
                );
                return true;
              } catch {
                return false;
              }
            },
          },
        },
      }),
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      // VPC配置はLDAP設定時のみ（OIDC単独構成ではVPC不要）
      ...(hasLdapConfig && props.vpc ? {
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups,
      } : {}),
      environment: env,
    });

    // DynamoDB権限
    if (props.userAccessTable) {
      props.userAccessTable.grantReadWriteData(this.adSyncFunction);
    } else {
      this.adSyncFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['dynamodb:PutItem', 'dynamodb:GetItem'],
        resources: [`arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/${prefix}-user-access`],
      }));
    }

    new cdk.CfnOutput(this, 'IdentitySyncFunctionName', {
      value: this.adSyncFunction.functionName,
      description: `Identity Sync Lambda (${hasLdapConfig ? 'LDAP' : 'OIDC claims-only'} mode)`,
    });
  }

  /**
   * LDAP設定時の追加権限・ネットワーク設定
   * Secrets Manager読み取り権限とLDAPポートのアウトバウンドルールを設定する。
   */
  private configureLdapPermissions(props: DemoSecurityStackProps): void {
    if (!props.ldapConfig || !this.adSyncFunction) return;

    // Secrets Manager への読み取り権限を付与
    this.adSyncFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.ldapConfig.bindPasswordSecretArn],
    }));

    // LDAP接続情報を環境変数に設定（パスワードはARN参照のみ）
    this.adSyncFunction.addEnvironment('LDAP_URL', props.ldapConfig.ldapUrl);
    this.adSyncFunction.addEnvironment('LDAP_BASE_DN', props.ldapConfig.baseDn);
    this.adSyncFunction.addEnvironment('LDAP_BIND_DN', props.ldapConfig.bindDn);
    this.adSyncFunction.addEnvironment('LDAP_BIND_PASSWORD_SECRET_ARN', props.ldapConfig.bindPasswordSecretArn);
    this.adSyncFunction.addEnvironment('LDAP_USER_SEARCH_FILTER', props.ldapConfig.userSearchFilter || '(mail={email})');
    this.adSyncFunction.addEnvironment('LDAP_GROUP_SEARCH_FILTER', props.ldapConfig.groupSearchFilter || '(member={dn})');
  }
}
