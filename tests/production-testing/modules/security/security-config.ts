/**
 * セキュリティテスト設定
 * 
 * 実本番環境でのセキュリティテストに関する設定を管理
 * HTTPS暗号化、WAF防御、攻撃耐性、セキュリティ監視のテスト設定
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

/**
 * HTTPS暗号化テスト設定
 */
export interface HttpsEncryptionTestConfig {
  // CloudFront設定
  cloudFrontDistribution: {
    domainName: string;
    distributionId: string;
    originDomainName: string;
  };
  
  // TLS証明書設定
  tlsCertificate: {
    certificateArn: string;
    expectedSubject: string;
    minimumTlsVersion: string;
    supportedProtocols: string[];
  };
  
  // セキュリティヘッダー設定
  securityHeaders: {
    strictTransportSecurity: {
      enabled: boolean;
      maxAge: number;
      includeSubdomains: boolean;
    };
    contentSecurityPolicy: {
      enabled: boolean;
      directives: Record<string, string>;
    };
    xFrameOptions: {
      enabled: boolean;
      value: string;
    };
    xContentTypeOptions: {
      enabled: boolean;
      value: string;
    };
    referrerPolicy: {
      enabled: boolean;
      value: string;
    };
  };
  
  // テスト設定
  testEndpoints: string[];
  httpRedirectTest: boolean;
  mixedContentTest: boolean;
  certificateValidityTest: boolean;
}

/**
 * 攻撃耐性テスト設定
 */
export interface AttackResistanceTestConfig {
  // WAF設定
  wafConfiguration: {
    webAclId: string;
    webAclName: string;
    associatedResources: string[];
    ruleGroups: string[];
  };
  
  // SQLインジェクション攻撃テスト
  sqlInjectionTests: {
    enabled: boolean;
    testPayloads: string[];
    targetEndpoints: string[];
    expectedBlockResponse: number;
  };
  
  // XSS攻撃テスト
  xssTests: {
    enabled: boolean;
    testPayloads: string[];
    targetEndpoints: string[];
    expectedBlockResponse: number;
  };
  
  // 不正APIアクセステスト
  unauthorizedApiTests: {
    enabled: boolean;
    testEndpoints: string[];
    invalidTokens: string[];
    expectedResponse: number;
  };
  
  // セッションハイジャック攻撃テスト
  sessionHijackingTests: {
    enabled: boolean;
    testScenarios: string[];
    sessionTokenPatterns: string[];
    expectedBehavior: string;
  };
  
  // レート制限テスト
  rateLimitTests: {
    enabled: boolean;
    requestsPerMinute: number;
    burstLimit: number;
    testDuration: number;
    expectedThrottling: boolean;
  };
}

/**
 * セキュリティ監視テスト設定
 */
export interface SecurityMonitoringTestConfig {
  // CloudTrail設定
  cloudTrail: {
    trailName: string;
    s3BucketName: string;
    logGroupName: string;
    eventCategories: string[];
  };
  
  // 異常アクセスパターン検出
  anomalyDetection: {
    enabled: boolean;
    monitoringPeriod: number;
    thresholds: {
      requestsPerMinute: number;
      uniqueIpCount: number;
      errorRate: number;
      suspiciousPatterns: string[];
    };
  };
  
  // セキュリティアラート
  securityAlerts: {
    enabled: boolean;
    alertTypes: string[];
    notificationTargets: string[];
    severityLevels: string[];
  };
  
  // ログ分析設定
  logAnalysis: {
    enabled: boolean;
    analysisPatterns: string[];
    retentionPeriod: number;
    realTimeAnalysis: boolean;
  };
}

/**
 * 本番環境セキュリティテスト設定
 */
export const productionSecurityConfig = {
  // HTTPS暗号化テスト設定
  httpsEncryption: {
    cloudFrontDistribution: {
      domainName: process.env.CLOUDFRONT_DOMAIN_NAME || 'example.cloudfront.net',
      distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID || '',
      originDomainName: process.env.ORIGIN_DOMAIN_NAME || ''
    },
    
    tlsCertificate: {
      certificateArn: process.env.TLS_CERTIFICATE_ARN || '',
      expectedSubject: process.env.CERTIFICATE_SUBJECT || '*.example.com',
      minimumTlsVersion: 'TLSv1.2',
      supportedProtocols: ['TLSv1.2', 'TLSv1.3']
    },
    
    securityHeaders: {
      strictTransportSecurity: {
        enabled: true,
        maxAge: 31536000, // 1年
        includeSubdomains: true
      },
      contentSecurityPolicy: {
        enabled: true,
        directives: {
          'default-src': "'self'",
          'script-src': "'self' 'unsafe-inline'",
          'style-src': "'self' 'unsafe-inline'",
          'img-src': "'self' data: https:",
          'connect-src': "'self' https:",
          'font-src': "'self'",
          'object-src': "'none'",
          'media-src': "'self'",
          'frame-src': "'none'"
        }
      },
      xFrameOptions: {
        enabled: true,
        value: 'DENY'
      },
      xContentTypeOptions: {
        enabled: true,
        value: 'nosniff'
      },
      referrerPolicy: {
        enabled: true,
        value: 'strict-origin-when-cross-origin'
      }
    },
    
    testEndpoints: [
      '/',
      '/api/health',
      '/api/auth/login',
      '/api/chat',
      '/static/css/main.css',
      '/static/js/main.js'
    ],
    httpRedirectTest: true,
    mixedContentTest: true,
    certificateValidityTest: true
  } as HttpsEncryptionTestConfig,
  
  // 攻撃耐性テスト設定
  attackResistance: {
    wafConfiguration: {
      webAclId: process.env.WAF_WEB_ACL_ID || '',
      webAclName: process.env.WAF_WEB_ACL_NAME || 'ChatbotUIWAF',
      associatedResources: [
        process.env.CLOUDFRONT_DISTRIBUTION_ARN || ''
      ],
      ruleGroups: [
        'AWSManagedRulesCommonRuleSet',
        'AWSManagedRulesKnownBadInputsRuleSet',
        'AWSManagedRulesSQLiRuleSet',
        'AWSManagedRulesLinuxRuleSet'
      ]
    },
    
    sqlInjectionTests: {
      enabled: true,
      testPayloads: [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "1' AND (SELECT COUNT(*) FROM users) > 0 --",
        "admin'/**/OR/**/1=1#"
      ],
      targetEndpoints: [
        '/api/chat',
        '/api/search',
        '/api/documents'
      ],
      expectedBlockResponse: 403
    },
    
    xssTests: {
      enabled: true,
      testPayloads: [
        "<script>alert('XSS')</script>",
        "javascript:alert('XSS')",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "';alert('XSS');//"
      ],
      targetEndpoints: [
        '/api/chat',
        '/api/feedback',
        '/api/user/profile'
      ],
      expectedBlockResponse: 403
    },
    
    unauthorizedApiTests: {
      enabled: true,
      testEndpoints: [
        '/api/admin/users',
        '/api/admin/settings',
        '/api/documents/private',
        '/api/analytics/data'
      ],
      invalidTokens: [
        'invalid_token',
        'expired_token_12345',
        '',
        'Bearer malformed.token.here'
      ],
      expectedResponse: 401
    },
    
    sessionHijackingTests: {
      enabled: true,
      testScenarios: [
        'session_fixation',
        'session_replay',
        'cross_site_session_transfer'
      ],
      sessionTokenPatterns: [
        'stolen_session_token',
        'replayed_session_token',
        'cross_origin_session_token'
      ],
      expectedBehavior: 'reject_and_invalidate'
    },
    
    rateLimitTests: {
      enabled: true,
      requestsPerMinute: 100,
      burstLimit: 20,
      testDuration: 60000, // 1分
      expectedThrottling: true
    }
  } as AttackResistanceTestConfig,
  
  // セキュリティ監視テスト設定
  securityMonitoring: {
    cloudTrail: {
      trailName: process.env.CLOUDTRAIL_NAME || 'ChatbotUISecurityTrail',
      s3BucketName: process.env.CLOUDTRAIL_S3_BUCKET || '',
      logGroupName: process.env.CLOUDTRAIL_LOG_GROUP || '/aws/cloudtrail/security',
      eventCategories: [
        'Management',
        'Data',
        'Insight'
      ]
    },
    
    anomalyDetection: {
      enabled: true,
      monitoringPeriod: 300000, // 5分
      thresholds: {
        requestsPerMinute: 1000,
        uniqueIpCount: 100,
        errorRate: 0.05, // 5%
        suspiciousPatterns: [
          'rapid_sequential_requests',
          'multiple_failed_auth_attempts',
          'unusual_geographic_access',
          'suspicious_user_agent_patterns'
        ]
      }
    },
    
    securityAlerts: {
      enabled: true,
      alertTypes: [
        'waf_block_event',
        'authentication_failure',
        'unauthorized_access_attempt',
        'suspicious_activity_detected',
        'security_policy_violation'
      ],
      notificationTargets: [
        process.env.SECURITY_SNS_TOPIC || '',
        process.env.SECURITY_EMAIL || 'security@example.com'
      ],
      severityLevels: [
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL'
      ]
    },
    
    logAnalysis: {
      enabled: true,
      analysisPatterns: [
        'failed_authentication_patterns',
        'blocked_request_patterns',
        'error_rate_spikes',
        'geographic_anomalies',
        'time_based_anomalies'
      ],
      retentionPeriod: 2592000000, // 30日
      realTimeAnalysis: true
    }
  } as SecurityMonitoringTestConfig,
  
  // 全般設定
  general: {
    testTimeout: 300000, // 5分
    maxRetries: 3,
    retryDelay: 5000, // 5秒
    parallelExecution: false, // セキュリティテストは順次実行
    emergencyStopEnabled: true,
    detailedLogging: true,
    
    // テスト実行順序
    executionOrder: [
      'https_encryption',
      'attack_resistance',
      'security_monitoring'
    ],
    
    // 必須テスト（スキップ不可）
    mandatoryTests: [
      'https_redirect_test',
      'tls_certificate_validation',
      'security_headers_validation',
      'sql_injection_protection',
      'xss_protection',
      'unauthorized_access_protection'
    ],
    
    // 本番環境制約
    productionConstraints: {
      readOnlyMode: true,
      noDataModification: true,
      noResourceCreation: true,
      limitedTestDuration: true,
      maxConcurrentTests: 1
    }
  }
};

/**
 * ステージング環境セキュリティテスト設定
 */
export const stagingSecurityConfig = {
  ...productionSecurityConfig,
  
  // ステージング環境では並列実行可能
  general: {
    ...productionSecurityConfig.general,
    parallelExecution: true,
    maxConcurrentTests: 3,
    testTimeout: 600000, // 10分
    
    // ステージング環境制約（本番より緩い）
    productionConstraints: {
      readOnlyMode: false,
      noDataModification: false,
      noResourceCreation: true,
      limitedTestDuration: false,
      maxConcurrentTests: 3
    }
  },
  
  // より積極的な攻撃テスト
  attackResistance: {
    ...productionSecurityConfig.attackResistance,
    rateLimitTests: {
      ...productionSecurityConfig.attackResistance.rateLimitTests,
      requestsPerMinute: 200,
      testDuration: 120000 // 2分
    }
  }
};

/**
 * 開発環境セキュリティテスト設定
 */
export const developmentSecurityConfig = {
  ...productionSecurityConfig,
  
  // 開発環境では基本的なセキュリティテストのみ
  general: {
    ...productionSecurityConfig.general,
    parallelExecution: true,
    maxConcurrentTests: 5,
    testTimeout: 180000, // 3分
    
    // 必須テストを最小限に
    mandatoryTests: [
      'https_redirect_test',
      'tls_certificate_validation',
      'basic_security_headers'
    ],
    
    // 開発環境制約（最も緩い）
    productionConstraints: {
      readOnlyMode: false,
      noDataModification: false,
      noResourceCreation: false,
      limitedTestDuration: false,
      maxConcurrentTests: 5
    }
  },
  
  // 軽量な攻撃テスト
  attackResistance: {
    ...productionSecurityConfig.attackResistance,
    sqlInjectionTests: {
      ...productionSecurityConfig.attackResistance.sqlInjectionTests,
      testPayloads: productionSecurityConfig.attackResistance.sqlInjectionTests.testPayloads.slice(0, 2)
    },
    xssTests: {
      ...productionSecurityConfig.attackResistance.xssTests,
      testPayloads: productionSecurityConfig.attackResistance.xssTests.testPayloads.slice(0, 2)
    },
    rateLimitTests: {
      ...productionSecurityConfig.attackResistance.rateLimitTests,
      enabled: false // 開発環境ではレート制限テストをスキップ
    }
  }
};

/**
 * 環境に応じた設定の取得
 */
export function getSecurityConfig(environment: string) {
  switch (environment.toLowerCase()) {
    case 'production':
    case 'prod':
      return productionSecurityConfig;
    case 'staging':
    case 'stage':
      return stagingSecurityConfig;
    case 'development':
    case 'dev':
      return developmentSecurityConfig;
    default:
      console.warn(`未知の環境: ${environment}. 開発環境設定を使用します。`);
      return developmentSecurityConfig;
  }
}

/**
 * セキュリティ設定の検証
 */
export function validateSecurityConfig(config: any): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // CloudFront設定の検証
  if (!config.httpsEncryption?.cloudFrontDistribution?.domainName) {
    errors.push('CloudFrontドメイン名が設定されていません');
  }

  // WAF設定の検証
  if (!config.attackResistance?.wafConfiguration?.webAclId) {
    errors.push('WAF WebACL IDが設定されていません');
  }

  // CloudTrail設定の検証
  if (!config.securityMonitoring?.cloudTrail?.trailName) {
    warnings.push('CloudTrail名が設定されていません');
  }

  // テストエンドポイントの検証
  if (!config.httpsEncryption?.testEndpoints?.length) {
    warnings.push('HTTPSテスト用エンドポイントが設定されていません');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// エンドツーエンド暗号化テスト設定を追加
productionSecurityConfig.general.executionOrder.push('end_to_end_encryption', 'authentication_authorization');
stagingSecurityConfig.general.executionOrder.push('end_to_end_encryption', 'authentication_authorization');
developmentSecurityConfig.general.executionOrder.push('end_to_end_encryption', 'authentication_authorization');

export default {
  productionSecurityConfig,
  stagingSecurityConfig,
  developmentSecurityConfig,
  getSecurityConfig,
  validateSecurityConfig
};