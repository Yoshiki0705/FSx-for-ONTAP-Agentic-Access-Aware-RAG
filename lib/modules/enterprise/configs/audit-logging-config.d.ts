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
export declare const DefaultAuditLoggingConfig: AuditLoggingConfig;
