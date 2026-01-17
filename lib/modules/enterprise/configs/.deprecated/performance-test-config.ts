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

export const PerformanceTestAdvancedPermissionConfig = {
  ...TokyoAdvancedPermissionConfig,
  
  /** テスト環境用の最適化 */
  cacheConfig: {
    ...TokyoAdvancedPermissionConfig.cacheConfig,
    ttlSeconds: 60, // テスト用に短縮
    maxEntries: 1000 // テスト用に削減
  },
  
  performanceConfig: {
    ...TokyoAdvancedPermissionConfig.performanceConfig,
    timeoutMs: 1000, // テスト用に短縮
    batchSize: 50 // テスト用に削減
  },
  
  /** テスト用の簡略化 */
  timeBasedRestriction: {
    ...TokyoAdvancedPermissionConfig.timeBasedRestriction,
    enabled: false // テスト時は無効化
  },
  
  advancedGeographicRestriction: {
    ...TokyoAdvancedPermissionConfig.advancedGeographicRestriction,
    enabled: false // テスト時は無効化
  }
};