/**
 * APIモジュール設定インターフェース
 * 
 * 機能:
 * - API Gateway・Cognito・CloudFront設定の型定義
 * - 認証・認可・CDN設定
 * - スロットリング・キャッシュ・監視設定
 */

import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';

/**
 * API Gateway設定
 */
export interface ApiGatewayConfig {
  /** APIタイプ */
  readonly type: 'REST' | 'HTTP' | 'WEBSOCKET';
  
  /** エンドポイントタイプ */
  readonly endpointType: apigateway.EndpointType;
  
  /** スロットリング設定 */
  readonly throttling: ApiGatewayThrottlingConfig;
  
  /** CORS設定 */
  readonly cors?: ApiGatewayCorsConfig;
  
  /** 認証設定 */
  readonly authentication?: ApiGatewayAuthConfig;
  
  /** WAF設定 */
  readonly waf?: ApiGatewayWafConfig;
  
  /** ログ設定 */
  readonly logging?: ApiGatewayLoggingConfig;
  
  /** キャッシュ設定 */
  readonly caching?: ApiGatewayCachingConfig;
  
  /** カスタムドメイン */
  readonly customDomain?: ApiGatewayCustomDomainConfig;
  
  /** リソース設定 */
  readonly resources?: ApiGatewayResourceConfig[];
}

/**
 * API Gatewayスロットリング設定
 */
export interface ApiGatewayThrottlingConfig {
  /** レート制限（リクエスト/秒） */
  readonly rateLimit: number;
  
  /** バースト制限 */
  readonly burstLimit: number;
  
  /** メソッド別制限 */
  readonly methodThrottling?: ApiGatewayMethodThrottling[];
}

/**
 * API Gatewayメソッド別スロットリング
 */
export interface ApiGatewayMethodThrottling {
  /** リソースパス */
  readonly resourcePath: string;
  
  /** HTTPメソッド */
  readonly httpMethod: string;
  
  /** レート制限 */
  readonly rateLimit: number;
  
  /** バースト制限 */
  readonly burstLimit: number;
}/**

 * API Gateway CORS設定
 */
export interface ApiGatewayCorsConfig {
  /** CORS有効化 */
  readonly enabled: boolean;
  
  /** 許可オリジン */
  readonly allowOrigins: string[];
  
  /** 許可メソッド */
  readonly allowMethods?: string[];
  
  /** 許可ヘッダー */
  readonly allowHeaders?: string[];
  
  /** 公開ヘッダー */
  readonly exposeHeaders?: string[];
  
  /** 認証情報許可 */
  readonly allowCredentials?: boolean;
  
  /** プリフライトキャッシュ時間 */
  readonly maxAge?: number;
}

/**
 * API Gateway認証設定
 */
export interface ApiGatewayAuthConfig {
  /** デフォルト認証タイプ */
  readonly defaultAuthType: 'COGNITO' | 'IAM' | 'LAMBDA' | 'NONE';
  
  /** Cognito認証設定 */
  readonly cognitoAuth?: ApiGatewayCognitoAuthConfig;
  
  /** Lambda認証設定 */
  readonly lambdaAuth?: ApiGatewayLambdaAuthConfig;
  
  /** APIキー設定 */
  readonly apiKeys?: ApiGatewayApiKeyConfig;
}

/**
 * API Gateway Cognito認証設定
 */
export interface ApiGatewayCognitoAuthConfig {
  /** ユーザープールARN */
  readonly userPoolArn: string;
  
  /** スコープ */
  readonly scopes?: string[];
}

/**
 * API Gateway Lambda認証設定
 */
export interface ApiGatewayLambdaAuthConfig {
  /** Lambda関数ARN */
  readonly functionArn: string;
  
  /** 結果キャッシュTTL */
  readonly resultTtlInSeconds?: number;
  
  /** ID ソース */
  readonly identitySource?: string;
}

/**
 * API Gateway APIキー設定
 */
export interface ApiGatewayApiKeyConfig {
  /** APIキー有効化 */
  readonly enabled: boolean;
  
  /** 使用量プラン */
  readonly usagePlans?: ApiGatewayUsagePlan[];
}

/**
 * API Gateway使用量プラン
 */
export interface ApiGatewayUsagePlan {
  /** プラン名 */
  readonly planName: string;
  
  /** 説明 */
  readonly description?: string;
  
  /** スロットリング */
  readonly throttling?: ApiGatewayThrottlingConfig;
  
  /** クォータ */
  readonly quota?: ApiGatewayQuotaConfig;
}

/**
 * API Gatewayクォータ設定
 */
export interface ApiGatewayQuotaConfig {
  /** 制限数 */
  readonly limit: number;
  
  /** 期間 */
  readonly period: 'DAY' | 'WEEK' | 'MONTH';
  
  /** オフセット */
  readonly offset?: number;
}

/**
 * API Gateway WAF設定
 */
export interface ApiGatewayWafConfig {
  /** WAF有効化 */
  readonly enabled: boolean;
  
  /** Web ACL ARN */
  readonly webAclArn?: string;
}

/**
 * API Gatewayログ設定
 */
export interface ApiGatewayLoggingConfig {
  /** アクセスログ有効化 */
  readonly accessLogging: boolean;
  
  /** 実行ログ有効化 */
  readonly executionLogging?: boolean;
  
  /** ログレベル */
  readonly logLevel?: 'ERROR' | 'INFO' | 'OFF';
  
  /** データトレース */
  readonly dataTrace?: boolean;
  
  /** ログ保持期間（日） */
  readonly retentionDays?: number;
}

/**
 * API Gatewayキャッシュ設定
 */
export interface ApiGatewayCachingConfig {
  /** キャッシュ有効化 */
  readonly enabled: boolean;
  
  /** キャッシュサイズ */
  readonly cacheClusterSize?: string;
  
  /** TTL（秒） */
  readonly ttlInSeconds?: number;
  
  /** キャッシュキー */
  readonly cacheKeyParameters?: string[];
}

/**
 * API Gatewayカスタムドメイン設定
 */
export interface ApiGatewayCustomDomainConfig {
  /** ドメイン名 */
  readonly domainName: string;
  
  /** 証明書ARN */
  readonly certificateArn: string;
  
  /** セキュリティポリシー */
  readonly securityPolicy?: string;
  
  /** エンドポイント設定 */
  readonly endpointConfiguration?: apigateway.EndpointConfiguration;
}

/**
 * API Gatewayリソース設定
 */
export interface ApiGatewayResourceConfig {
  /** リソースパス */
  readonly path: string;
  
  /** メソッド設定 */
  readonly methods: ApiGatewayMethodConfig[];
}

/**
 * API Gatewayメソッド設定
 */
export interface ApiGatewayMethodConfig {
  /** HTTPメソッド */
  readonly httpMethod: string;
  
  /** 統合設定 */
  readonly integration: ApiGatewayIntegrationConfig;
  
  /** 認証設定 */
  readonly authorization?: ApiGatewayMethodAuthConfig;
  
  /** リクエスト検証 */
  readonly requestValidation?: ApiGatewayRequestValidationConfig;
}

/**
 * API Gateway統合設定
 */
export interface ApiGatewayIntegrationConfig {
  /** 統合タイプ */
  readonly type: 'LAMBDA' | 'HTTP' | 'AWS' | 'MOCK';
  
  /** 統合URI */
  readonly uri?: string;
  
  /** HTTPメソッド */
  readonly httpMethod?: string;
  
  /** リクエストテンプレート */
  readonly requestTemplates?: Record<string, string>;
  
  /** レスポンステンプレート */
  readonly responseTemplates?: Record<string, string>;
}

/**
 * API Gatewayメソッド認証設定
 */
export interface ApiGatewayMethodAuthConfig {
  /** 認証タイプ */
  readonly authType: 'COGNITO' | 'IAM' | 'LAMBDA' | 'NONE';
  
  /** 認証スコープ */
  readonly authScopes?: string[];
}

/**
 * API Gatewayリクエスト検証設定
 */
export interface ApiGatewayRequestValidationConfig {
  /** ボディ検証 */
  readonly validateRequestBody?: boolean;
  
  /** パラメータ検証 */
  readonly validateRequestParameters?: boolean;
  
  /** スキーマ */
  readonly requestSchema?: Record<string, any>;
}/*
*
 * Cognito設定
 */
export interface CognitoConfig {
  /** ユーザープール設定 */
  readonly userPool: CognitoUserPoolConfig;
  
  /** アイデンティティプール設定 */
  readonly identityPool: CognitoIdentityPoolConfig;
  
  /** フェデレーション設定 */
  readonly federation?: CognitoFederationConfig;
  
  /** カスタム属性 */
  readonly customAttributes?: CognitoCustomAttribute[];
}

/**
 * Cognitoユーザープール設定
 */
export interface CognitoUserPoolConfig {
  /** MFA設定 */
  readonly mfaConfiguration: cognito.Mfa;
  
  /** パスワードポリシー */
  readonly passwordPolicy: CognitoPasswordPolicy;
  
  /** サインアップ設定 */
  readonly signUp?: CognitoSignUpConfig;
  
  /** サインイン設定 */
  readonly signIn?: CognitoSignInConfig;
  
  /** アカウント復旧設定 */
  readonly accountRecovery?: CognitoAccountRecoveryConfig;
  
  /** デバイス設定 */
  readonly deviceConfiguration?: CognitoDeviceConfig;
  
  /** Lambda トリガー */
  readonly lambdaTriggers?: CognitoLambdaTriggers;
}

/**
 * Cognitoパスワードポリシー
 */
export interface CognitoPasswordPolicy {
  /** 最小長 */
  readonly minimumLength: number;
  
  /** 大文字必須 */
  readonly requireUppercase: boolean;
  
  /** 小文字必須 */
  readonly requireLowercase: boolean;
  
  /** 数字必須 */
  readonly requireNumbers: boolean;
  
  /** 記号必須 */
  readonly requireSymbols: boolean;
  
  /** 一時パスワード有効期限（日） */
  readonly tempPasswordValidityDays?: number;
}

/**
 * Cognitoサインアップ設定
 */
export interface CognitoSignUpConfig {
  /** セルフサインアップ許可 */
  readonly selfSignUpEnabled: boolean;
  
  /** 管理者作成のみ */
  readonly adminCreateUserOnly?: boolean;
  
  /** 招待メッセージ */
  readonly inviteMessage?: CognitoInviteMessageConfig;
  
  /** 検証設定 */
  readonly verification?: CognitoVerificationConfig;
}

/**
 * Cognito招待メッセージ設定
 */
export interface CognitoInviteMessageConfig {
  /** SMSメッセージ */
  readonly smsMessage?: string;
  
  /** Eメールメッセージ */
  readonly emailMessage?: string;
  
  /** Eメール件名 */
  readonly emailSubject?: string;
}

/**
 * Cognito検証設定
 */
export interface CognitoVerificationConfig {
  /** Eメール検証 */
  readonly emailVerification?: boolean;
  
  /** SMS検証 */
  readonly smsVerification?: boolean;
  
  /** 検証メッセージ */
  readonly verificationMessage?: CognitoVerificationMessageConfig;
}

/**
 * Cognito検証メッセージ設定
 */
export interface CognitoVerificationMessageConfig {
  /** SMSメッセージ */
  readonly smsMessage?: string;
  
  /** Eメールメッセージ */
  readonly emailMessage?: string;
  
  /** Eメール件名 */
  readonly emailSubject?: string;
}

/**
 * Cognitoサインイン設定
 */
export interface CognitoSignInConfig {
  /** サインイン属性 */
  readonly signInAttributes?: cognito.SignInAliases;
  
  /** ケース非依存 */
  readonly caseSensitive?: boolean;
}

/**
 * Cognitoアカウント復旧設定
 */
export interface CognitoAccountRecoveryConfig {
  /** Eメール復旧 */
  readonly emailRecovery?: boolean;
  
  /** SMS復旧 */
  readonly smsRecovery?: boolean;
}

/**
 * Cognitoデバイス設定
 */
export interface CognitoDeviceConfig {
  /** デバイス記憶 */
  
  /** デバイス追跡 */
  readonly deviceTracking?: boolean;
}

/**
 * Cognito Lambdaトリガー
 */
export interface CognitoLambdaTriggers {
  /** プリサインアップ */
  readonly preSignUp?: string;
  
  /** ポストサインアップ */
  readonly postConfirmation?: string;
  
  /** プリ認証 */
  readonly preAuthentication?: string;
  
  /** ポスト認証 */
  readonly postAuthentication?: string;
  
  /** カスタムメッセージ */
  readonly customMessage?: string;
}

/**
 * Cognitoアイデンティティプール設定
 */
export interface CognitoIdentityPoolConfig {
  /** 未認証ID許可 */
  readonly allowUnauthenticatedIdentities: boolean;
  
  /** 認証プロバイダー */
  readonly authenticationProviders?: CognitoAuthenticationProviders;
  
  /** ロールマッピング */
  readonly roleMappings?: CognitoRoleMapping[];
}

/**
 * Cognito認証プロバイダー
 */
export interface CognitoAuthenticationProviders {
  /** Cognitoプロバイダー */
  readonly cognito?: CognitoCognitoProvider[];
  
  /** SAMLプロバイダー */
  readonly saml?: CognitoSamlProvider[];
  
  /** OpenIDプロバイダー */
  readonly openId?: CognitoOpenIdProvider[];
}

/**
 * Cognito Cognitoプロバイダー
 */
export interface CognitoCognitoProvider {
  /** ユーザープールID */
  readonly userPoolId: string;
  
  /** クライアントID */
  readonly clientId: string;
}

/**
 * Cognito SAMLプロバイダー
 */
export interface CognitoSamlProvider {
  /** プロバイダー名 */
  readonly providerName: string;
  
  /** メタデータURL */
  readonly metadataUrl?: string;
  
  /** メタデータファイル */
  readonly metadataFile?: string;
}

/**
 * Cognito OpenIDプロバイダー
 */
export interface CognitoOpenIdProvider {
  /** プロバイダー名 */
  readonly providerName: string;
  
  /** クライアントID */
  readonly clientId: string;
  
  /** 発行者URL */
  readonly issuerUrl: string;
}

/**
 * Cognitoロールマッピング
 */
export interface CognitoRoleMapping {
  /** プロバイダー名 */
  readonly providerName: string;
  
  /** マッピングタイプ */
  readonly mappingType: 'Token' | 'Rules';
  
  /** 認証ロール */
  readonly authenticatedRole?: string;
  
  /** 未認証ロール */
  readonly unauthenticatedRole?: string;
  
  /** ルール */
  readonly rules?: CognitoMappingRule[];
}

/**
 * Cognitoマッピングルール
 */
export interface CognitoMappingRule {
  /** クレーム */
  readonly claim: string;
  
  /** マッチタイプ */
  readonly matchType: 'Equals' | 'Contains' | 'StartsWith' | 'NotEqual';
  
  /** 値 */
  readonly value: string;
  
  /** ロールARN */
  readonly roleArn: string;
}

/**
 * Cognitoフェデレーション設定
 */
export interface CognitoFederationConfig {
  /** SAML設定 */
  readonly saml?: CognitoSamlConfig;
  
  /** OIDC設定 */
  readonly oidc?: CognitoOidcConfig;
  
  /** ソーシャルログイン */
  readonly social?: CognitoSocialConfig;
}

/**
 * Cognito SAML設定
 */
export interface CognitoSamlConfig {
  /** プロバイダー名 */
  readonly providerName: string;
  
  /** メタデータURL */
  readonly metadataUrl: string;
  
  /** 属性マッピング */
  readonly attributeMapping?: Record<string, string>;
}

/**
 * Cognito OIDC設定
 */
export interface CognitoOidcConfig {
  /** プロバイダー名 */
  readonly providerName: string;
  
  /** クライアントID */
  readonly clientId: string;
  
  /** クライアントシークレット */
  readonly clientSecret: string;
  
  /** 発行者URL */
  readonly issuerUrl: string;
  
  /** 属性マッピング */
  readonly attributeMapping?: Record<string, string>;
}

/**
 * Cognitoソーシャルログイン設定
 */
export interface CognitoSocialConfig {
  /** Google設定 */
  readonly google?: CognitoGoogleConfig;
  
  /** Facebook設定 */
  readonly facebook?: CognitoFacebookConfig;
  
  /** Amazon設定 */
  readonly amazon?: CognitoAmazonConfig;
}

/**
 * Cognito Google設定
 */
export interface CognitoGoogleConfig {
  /** クライアントID */
  readonly clientId: string;
  
  /** クライアントシークレット */
  readonly clientSecret: string;
  
  /** スコープ */
  readonly scopes?: string[];
}

/**
 * Cognito Facebook設定
 */
export interface CognitoFacebookConfig {
  /** アプリID */
  readonly appId: string;
  
  /** アプリシークレット */
  readonly appSecret: string;
  
  /** スコープ */
  readonly scopes?: string[];
}

/**
 * Cognito Amazon設定
 */
export interface CognitoAmazonConfig {
  /** クライアントID */
  readonly clientId: string;
  
  /** クライアントシークレット */
  readonly clientSecret: string;
  
  /** スコープ */
  readonly scopes?: string[];
}

/**
 * Cognitoカスタム属性
 */
export interface CognitoCustomAttribute {
  /** 属性名 */
  readonly name: string;
  
  /** データタイプ */
  readonly dataType: 'String' | 'Number' | 'DateTime' | 'Boolean';
  
  /** 必須 */
  readonly required?: boolean;
  
  /** 変更可能 */
  readonly mutable?: boolean;
  
  /** 制約 */
  readonly constraints?: CognitoAttributeConstraints;
}

/**
 * Cognito属性制約
 */
export interface CognitoAttributeConstraints {
  /** 最小長 */
  readonly minLength?: number;
  
  /** 最大長 */
  readonly maxLength?: number;
  
  /** 最小値 */
  readonly minValue?: number;
  
  /** 最大値 */
  readonly maxValue?: number;
}/**
 * Cl
oudFront設定
 */
export interface CloudFrontConfig {
  /** CloudFront有効化 */
  readonly enabled: boolean;
  
  /** 価格クラス */
  readonly priceClass: cloudfront.PriceClass;
  
  /** 地理的制限 */
  readonly geoRestriction?: CloudFrontGeoRestrictionConfig;
  
  /** オリジン設定 */
  readonly origins?: CloudFrontOriginConfig[];
  
  /** ビヘイビア設定 */
  readonly behaviors?: CloudFrontBehaviorConfig[];
  
  /** WAF設定 */
  readonly waf?: CloudFrontWafConfig;
  
  /** SSL証明書設定 */
  readonly certificate?: CloudFrontCertificateConfig;
  
  /** ログ設定 */
  readonly logging?: CloudFrontLoggingConfig;
  
  /** エラーページ設定 */
  readonly errorPages?: CloudFrontErrorPageConfig[];
}

/**
 * CloudFront地理的制限設定
 */
export interface CloudFrontGeoRestrictionConfig {
  /** 制限タイプ */
  readonly restrictionType: 'whitelist' | 'blacklist' | 'none';
  
  /** 対象国コード */
  readonly locations?: string[];
}

/**
 * CloudFrontオリジン設定
 */
export interface CloudFrontOriginConfig {
  /** オリジンID */
  readonly originId: string;
  
  /** ドメイン名 */
  readonly domainName: string;
  
  /** オリジンパス */
  readonly originPath?: string;
  
  /** カスタムヘッダー */
  readonly customHeaders?: CloudFrontCustomHeader[];
  
  /** S3オリジン設定 */
  readonly s3OriginConfig?: CloudFrontS3OriginConfig;
  
  /** カスタムオリジン設定 */
  readonly customOriginConfig?: CloudFrontCustomOriginConfig;
}

/**
 * CloudFrontカスタムヘッダー
 */
export interface CloudFrontCustomHeader {
  /** ヘッダー名 */
  readonly headerName: string;
  
  /** ヘッダー値 */
  readonly headerValue: string;
}

/**
 * CloudFront S3オリジン設定
 */
export interface CloudFrontS3OriginConfig {
  /** OAI使用 */
  readonly useOriginAccessIdentity: boolean;
  
  /** OAI ID */
  readonly originAccessIdentityId?: string;
}

/**
 * CloudFrontカスタムオリジン設定
 */
export interface CloudFrontCustomOriginConfig {
  /** HTTPポート */
  readonly httpPort?: number;
  
  /** HTTPSポート */
  readonly httpsPort?: number;
  
  /** プロトコルポリシー */
  readonly originProtocolPolicy: 'http-only' | 'https-only' | 'match-viewer';
  
  /** SSL プロトコル */
  readonly originSslProtocols?: string[];
  
  /** タイムアウト */
  readonly originReadTimeout?: number;
  
  /** キープアライブタイムアウト */
  readonly originKeepaliveTimeout?: number;
}

/**
 * CloudFrontビヘイビア設定
 */
export interface CloudFrontBehaviorConfig {
  /** パスパターン */
  readonly pathPattern: string;
  
  /** ターゲットオリジンID */
  readonly targetOriginId: string;
  
  /** ビューアープロトコルポリシー */
  readonly viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy;
  
  /** 許可メソッド */
  readonly allowedMethods?: cloudfront.AllowedMethods;
  
  /** キャッシュメソッド */
  readonly cachedMethods?: cloudfront.CachedMethods;
  
  /** キャッシュポリシー */
  readonly cachePolicy?: CloudFrontCachePolicyConfig;
  
  /** オリジンリクエストポリシー */
  readonly originRequestPolicy?: CloudFrontOriginRequestPolicyConfig;
  
  /** レスポンスヘッダーポリシー */
  readonly responseHeadersPolicy?: CloudFrontResponseHeadersPolicyConfig;
}

/**
 * CloudFrontキャッシュポリシー設定
 */
export interface CloudFrontCachePolicyConfig {
  /** ポリシー名 */
  readonly policyName?: string;
  
  /** デフォルトTTL */
  readonly defaultTtl?: number;
  
  /** 最大TTL */
  readonly maxTtl?: number;
  
  /** 最小TTL */
  readonly minTtl?: number;
  
  /** キャッシュキー設定 */
  readonly cacheKeyPolicy?: CloudFrontCacheKeyPolicy;
}

/**
 * CloudFrontキャッシュキーポリシー
 */
export interface CloudFrontCacheKeyPolicy {
  /** ヘッダー */
  readonly headers?: CloudFrontCacheKeyHeaders;
  
  /** クエリ文字列 */
  readonly queryStrings?: CloudFrontCacheKeyQueryStrings;
  
  /** Cookie */
  readonly cookies?: CloudFrontCacheKeyCookies;
}

/**
 * CloudFrontキャッシュキーヘッダー
 */
export interface CloudFrontCacheKeyHeaders {
  /** ビヘイビア */
  readonly behavior: 'none' | 'whitelist' | 'allViewer' | 'allViewerAndWhitelistCloudFront';
  
  /** ヘッダー名 */
  readonly headers?: string[];
}

/**
 * CloudFrontキャッシュキークエリ文字列
 */
export interface CloudFrontCacheKeyQueryStrings {
  /** ビヘイビア */
  readonly behavior: 'none' | 'whitelist' | 'blacklist' | 'all';
  
  /** クエリ文字列 */
  readonly queryStrings?: string[];
}

/**
 * CloudFrontキャッシュキーCookie
 */
export interface CloudFrontCacheKeyCookies {
  /** ビヘイビア */
  readonly behavior: 'none' | 'whitelist' | 'blacklist' | 'all';
  
  /** Cookie名 */
  readonly cookies?: string[];
}

/**
 * CloudFrontオリジンリクエストポリシー設定
 */
export interface CloudFrontOriginRequestPolicyConfig {
  /** ポリシー名 */
  readonly policyName?: string;
  
  /** ヘッダー設定 */
  readonly headers?: CloudFrontOriginRequestHeaders;
  
  /** クエリ文字列設定 */
  readonly queryStrings?: CloudFrontOriginRequestQueryStrings;
  
  /** Cookie設定 */
  readonly cookies?: CloudFrontOriginRequestCookies;
}

/**
 * CloudFrontオリジンリクエストヘッダー
 */
export interface CloudFrontOriginRequestHeaders {
  /** ビヘイビア */
  readonly behavior: 'none' | 'whitelist' | 'allViewer' | 'allViewerAndWhitelistCloudFront';
  
  /** ヘッダー名 */
  readonly headers?: string[];
}

/**
 * CloudFrontオリジンリクエストクエリ文字列
 */
export interface CloudFrontOriginRequestQueryStrings {
  /** ビヘイビア */
  readonly behavior: 'none' | 'whitelist' | 'all';
  
  /** クエリ文字列 */
  readonly queryStrings?: string[];
}

/**
 * CloudFrontオリジンリクエストCookie
 */
export interface CloudFrontOriginRequestCookies {
  /** ビヘイビア */
  readonly behavior: 'none' | 'whitelist' | 'all';
  
  /** Cookie名 */
  readonly cookies?: string[];
}

/**
 * CloudFrontレスポンスヘッダーポリシー設定
 */
export interface CloudFrontResponseHeadersPolicyConfig {
  /** ポリシー名 */
  readonly policyName?: string;
  
  /** セキュリティヘッダー */
  readonly securityHeaders?: CloudFrontSecurityHeaders;
  
  /** カスタムヘッダー */
  readonly customHeaders?: CloudFrontCustomResponseHeader[];
  
  /** CORS設定 */
  readonly cors?: CloudFrontCorsConfig;
}

/**
 * CloudFrontセキュリティヘッダー
 */
export interface CloudFrontSecurityHeaders {
  /** Content Type Options */
  readonly contentTypeOptions?: boolean;
  
  /** Frame Options */
  readonly frameOptions?: CloudFrontFrameOptions;
  
  /** Referrer Policy */
  readonly referrerPolicy?: CloudFrontReferrerPolicy;
  
  /** Strict Transport Security */
  readonly strictTransportSecurity?: CloudFrontStrictTransportSecurity;
}

/**
 * CloudFrontフレームオプション
 */
export interface CloudFrontFrameOptions {
  /** フレームオプション */
  readonly frameOption: 'DENY' | 'SAMEORIGIN';
  
  /** 上書き */
  readonly override: boolean;
}

/**
 * CloudFrontリファラーポリシー
 */
export interface CloudFrontReferrerPolicy {
  /** リファラーポリシー */
  readonly referrerPolicy: string;
  
  /** 上書き */
  readonly override: boolean;
}

/**
 * CloudFront Strict Transport Security
 */
export interface CloudFrontStrictTransportSecurity {
  /** 最大年齢 */
  readonly maxAgeSeconds: number;
  
  /** サブドメイン含む */
  readonly includeSubdomains?: boolean;
  
  /** プリロード */
  readonly preload?: boolean;
  
  /** 上書き */
  readonly override: boolean;
}

/**
 * CloudFrontカスタムレスポンスヘッダー
 */
export interface CloudFrontCustomResponseHeader {
  /** ヘッダー名 */
  readonly headerName: string;
  
  /** ヘッダー値 */
  readonly headerValue: string;
  
  /** 上書き */
  readonly override: boolean;
}

/**
 * CloudFront CORS設定
 */
export interface CloudFrontCorsConfig {
  /** アクセス制御許可オリジン */
  readonly accessControlAllowOrigins: string[];
  
  /** アクセス制御許可ヘッダー */
  readonly accessControlAllowHeaders?: string[];
  
  /** アクセス制御許可メソッド */
  readonly accessControlAllowMethods?: string[];
  
  /** アクセス制御公開ヘッダー */
  readonly accessControlExposeHeaders?: string[];
  
  /** アクセス制御最大年齢 */
  readonly accessControlMaxAgeSeconds?: number;
  
  /** アクセス制御認証情報許可 */
  readonly accessControlAllowCredentials?: boolean;
  
  /** オリジン上書き */
  readonly originOverride: boolean;
}

/**
 * CloudFront WAF設定
 */
export interface CloudFrontWafConfig {
  /** WAF有効化 */
  readonly enabled: boolean;
  
  /** Web ACL ARN */
  readonly webAclArn?: string;
}

/**
 * CloudFront証明書設定
 */
export interface CloudFrontCertificateConfig {
  /** 証明書ARN */
  readonly certificateArn: string;
  
  /** SSL サポートメソッド */
  readonly sslSupportMethod?: cloudfront.SSLMethod;
  
  /** 最小プロトコルバージョン */
  readonly minimumProtocolVersion?: cloudfront.SecurityPolicyProtocol;
}

/**
 * CloudFrontログ設定
 */
export interface CloudFrontLoggingConfig {
  /** ログ有効化 */
  readonly enabled: boolean;
  
  /** ログバケット */
  readonly logBucket?: string;
  
  /** ログプレフィックス */
  readonly logPrefix?: string;
  
  /** Cookie含む */
  readonly includeCookies?: boolean;
}

/**
 * CloudFrontエラーページ設定
 */
export interface CloudFrontErrorPageConfig {
  /** エラーコード */
  readonly errorCode: number;
  
  /** レスポンスコード */
  readonly responseCode?: number;
  
  /** レスポンスページパス */
  readonly responsePagePath?: string;
  
  /** エラーキャッシュ最小TTL */
  readonly errorCachingMinTtl?: number;
}

/**
 * API統合設定
 */
export interface ApiConfig {
  /** API Gateway設定 */
  readonly apiGateway: ApiGatewayConfig;
  
  /** Cognito設定 */
  readonly cognito: CognitoConfig;
  
  /** CloudFront設定 */
  readonly cloudFront: CloudFrontConfig;
  
  /** 監視設定 */
  readonly monitoring?: ApiMonitoringConfig;
  
  /** セキュリティ設定 */
  readonly security?: ApiSecurityConfig;
}

/**
 * API監視設定
 */
export interface ApiMonitoringConfig {
  /** CloudWatchメトリクス */
  readonly cloudWatchMetrics: boolean;
  
  /** X-Rayトレーシング */
  readonly xrayTracing?: boolean;
  
  /** アラート設定 */
  readonly alerts?: ApiAlertConfig[];
}

/**
 * APIアラート設定
 */
export interface ApiAlertConfig {
  /** メトリクス名 */
  readonly metricName: string;
  
  /** 閾値 */
  readonly threshold: number;
  
  /** 比較演算子 */
  readonly comparisonOperator: string;
  
  /** 通知先 */
  readonly notificationTargets: string[];
}

/**
 * APIセキュリティ設定
 */
export interface ApiSecurityConfig {
  /** DDoS保護 */
  readonly ddosProtection: boolean;
  
  /** レート制限 */
  readonly rateLimiting?: boolean;
  
  /** IP許可リスト */
  readonly ipWhitelist?: string[];
  
  /** セキュリティヘッダー */
  readonly securityHeaders?: boolean;
}