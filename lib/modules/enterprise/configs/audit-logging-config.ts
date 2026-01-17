/**
 * 監査ログ設定
 * 
 * 権限制御システムの監査ログ設定
 */

export interface AuditLoggingConfig {
  /** 監査ログ有効化 */
  enabled: boolean;
  
  /** ログレベル */
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  
  /** ログ出力先 */
  destinations: {
    cloudWatch: boolean;
    s3: boolean;
    elasticsearch: boolean;
  };
  
  /** 機密情報マスキング */
  sensitiveDataMasking: {
    enabled: boolean;
    maskPatterns: string[];
  };
  
  /** ログ保持期間 */
  retentionDays: number;
  
  /** リアルタイム監視 */
  realTimeMonitoring: {
    enabled: boolean;
    alertThresholds: {
      failedAccessAttempts: number;
      suspiciousIpAccess: number;
      afterHoursAccess: number;
    };
  };
}

export const DefaultAuditLoggingConfig: AuditLoggingConfig = {
  enabled: true,
  logLevel: 'INFO',
  destinations: {
    cloudWatch: true,
    s3: true,
    elasticsearch: false
  },
  sensitiveDataMasking: {
    enabled: true,
    maskPatterns: [
      'password',
      'token',
      'key',
      'secret',
      'credential'
    ]
  },
  retentionDays: 2555, // 7年間（法的要件対応）
  realTimeMonitoring: {
    enabled: true,
    alertThresholds: {
      failedAccessAttempts: 5,
      suspiciousIpAccess: 3,
      afterHoursAccess: 10
    }
  }
};