/**
 * パフォーマンステスト用設定
 *
 * 権限制御システムの負荷テスト・パフォーマンステスト設定
 */
export interface PerformanceTestConfig {
    /** テスト環境識別 */
    testEnvironment: boolean;
    /** 負荷テスト設定 */
    loadTestConfig: {
        maxConcurrentUsers: number;
        requestsPerSecond: number;
        testDurationSeconds: number;
    };
    /** メトリクス収集 */
    metricsCollection: {
        enabled: boolean;
        detailedMetrics: boolean;
        customMetrics: string[];
    };
    /** パフォーマンス閾値 */
    performanceThresholds: {
        maxResponseTimeMs: number;
        maxMemoryUsageMB: number;
        maxCpuUsagePercent: number;
    };
}
export declare const PerformanceTestAdvancedPermissionConfig: any;
