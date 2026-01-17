/**
 * SecurityConfig アダプター
 * 
 * EnvironmentConfigのsecurity設定をSecurityConfigインターフェースに変換
 * 本番環境に必要な完全なセキュリティ設定を提供
 */

import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { SecurityConfig } from '../../modules/security/interfaces/security-config';

/**
 * EnvironmentConfigからSecurityConfigを生成（完全実装）
 */
export function adaptSecurityConfig(envConfig: any): SecurityConfig {
  const security = envConfig.security || {};
  
  return {
    // IAM設定
    iam: {
      enforceStrongPasswords: true,
      mfaRequired: true,
      sessionTimeout: 3600,
      passwordPolicy: {
        minimumLength: 14,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        preventReuse: 24,
        maxAge: 90
      },
      accessAnalyzer: true
    },
    
    // KMS設定
    kms: {
      keyRotation: security.kmsKeyRotation ?? true,
      keySpec: 'SYMMETRIC_DEFAULT' as any,
      keyUsage: 'ENCRYPT_DECRYPT' as any,
      pendingWindow: 30,
      multiRegion: false,
      alias: `alias/${envConfig.naming?.projectName || 'permission-aware-rag'}-key`
    },
    
    // WAF設定
    waf: {
      enabled: security.enableWaf ?? true,
      scope: 'REGIONAL',
      rules: {
        awsManagedRules: true,
        rateLimiting: true,
        geoBlocking: [],
        ipAllowList: [],
        ipBlockList: [],
        sqlInjectionProtection: true,
        xssProtection: true
      },
      logging: {
        enabled: true,
        destination: 'cloudwatch',
        retentionDays: 90
      },
      metrics: true
    },
    
    // GuardDuty設定
    guardDuty: {
      enabled: security.enableGuardDuty ?? true,
      findingPublishingFrequency: 'FIFTEEN_MINUTES',
      s3Protection: true,
      kubernetesProtection: true,
      malwareProtection: true
    },
    

    // コンプライアンス設定
    compliance: {
      fiscCompliance: true,
      personalInfoProtection: true,
      gdprCompliance: true,
      soxCompliance: false,
      hipaaCompliance: false,
      auditLogging: true,
      dataClassification: true,
      accessControls: true
    },
    
    // 監視設定
    monitoring: {
      cloudTrail: security.enableCloudTrail ?? true,
      config: security.enableConfig ?? true,
      securityHub: true,
      inspector: false
    }
  };
}
