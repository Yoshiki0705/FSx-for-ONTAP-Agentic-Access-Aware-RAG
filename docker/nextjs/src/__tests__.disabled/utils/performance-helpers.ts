/**
 * パフォーマンステスト用ヘルパー関数
 * 
 * 機能:
 * - レンダリング時間測定
 * - メモリ使用量監視
 * - パフォーマンス閾値チェック
 */

/**
 * レンダリング時間測定ヘルパー
 */
export const measureRenderTime = async (renderFn: () => void): Promise<number> => {
  const startTime = performance.now();
  renderFn();
  const endTime = performance.now();
  return endTime - startTime;
};

/**
 * パフォーマンス閾値チェック
 */
export const expectRenderTimeWithin = (actualTime: number, maxTime: number = 100) => {
  expect(actualTime).toBeLessThan(maxTime);
};

/**
 * メモリ使用量監視（開発環境用）
 */
export const measureMemoryUsage = (): number => {
  if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
    return (window.performance as any).memory.usedJSHeapSize;
  }
  return 0;
};

/**
 * 大量データ生成ヘルパー
 */
export const generateLargeDataSet = (size: number = 1000) => {
  return Array.from({ length: size }, (_, index) => ({
    id: `item-${index}`,
    name: `Test Item ${index}`,
    description: `Description for item ${index}`.repeat(10)
  }));
};

/**
 * パフォーマンステスト用の設定
 */
export const PERFORMANCE_THRESHOLDS = {
  RENDER_TIME_MS: 100,
  MEMORY_LEAK_THRESHOLD: 1024 * 1024, // 1MB
  MAX_RERENDERS: 5
} as const;