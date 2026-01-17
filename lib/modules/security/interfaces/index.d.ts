/**
 * Security Module Interfaces
 * セキュリティモジュール インターフェース定義
 */
export interface SecurityConfig {
    waf: WafConfig;
    cognito: CognitoConfig;
    encryption: EncryptionConfig;
    compliance: ComplianceConfig;
}
export interface WafConfig {
    enabled: boolean;
    scope: 'REGIONAL' | 'CLOUDFRONT';
    rules: WafRuleConfig[];
    defaultAction: 'ALLOW' | 'BLOCK';
}
export interface WafRuleConfig {
    name: string;
    priority: number;
    action: 'ALLOW' | 'BLOCK' | 'COUNT';
    statement: any;
}
export interface CognitoConfig {
    userPool: UserPoolConfig;
    identityPool?: IdentityPoolConfig;
    domain?: string;
}
export interface UserPoolConfig {
    signInAliases: ('email' | 'phone' | 'username')[];
    autoVerify: ('email' | 'phone')[];
    passwordPolicy: PasswordPolicyConfig;
    mfa?: 'OFF' | 'OPTIONAL' | 'REQUIRED';
}
export interface PasswordPolicyConfig {
    minLength: number;
    requireLowercase: boolean;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
}
export interface IdentityPoolConfig {
    allowUnauthenticatedIdentities: boolean;
    cognitoIdentityProviders: string[];
}
export interface EncryptionConfig {
    kmsKeyRotation: boolean;
    s3Encryption: 'AES256' | 'aws:kms';
    dynamoDbEncryption: boolean;
    rdsEncryption: boolean;
}
export interface ComplianceConfig {
    region: string;
    regulations: ('GDPR' | 'SOX' | 'LGPD' | 'PDPA' | 'CCPA' | 'HIPAA')[];
    dataResidency: string;
    auditLogging: boolean;
}
