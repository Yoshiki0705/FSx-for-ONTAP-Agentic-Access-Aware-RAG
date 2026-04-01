/**
 * CloudWatch Embedded Metric Format (EMF) ヘルパー
 *
 * enableMonitoring=true 時は EMF 形式で stdout に出力。
 * enableMonitoring=false 時は no-op（パフォーマンス影響なし）。
 *
 * 名前空間: PermissionAwareRAG/AdvancedFeatures
 */

const NAMESPACE = 'PermissionAwareRAG/AdvancedFeatures';

export interface MetricsLogger {
  putMetric(name: string, value: number, unit?: string): void;
  setDimension(key: string, value: string): void;
  flush(): void;
}

interface MetricEntry {
  name: string;
  value: number;
  unit: string;
}

class EmfMetricsLogger implements MetricsLogger {
  private dimensions: Record<string, string> = {};
  private metrics: MetricEntry[] = [];

  putMetric(name: string, value: number, unit = 'None'): void {
    this.metrics.push({ name, value, unit });
  }

  setDimension(key: string, value: string): void {
    this.dimensions[key] = value || 'unknown';
  }

  flush(): void {
    if (this.metrics.length === 0) return;
    try {
      // 空文字列ディメンション値を 'unknown' にフォールバック
      const safeDims: Record<string, string> = {};
      for (const [k, v] of Object.entries(this.dimensions)) {
        safeDims[k] = v || 'unknown';
      }

      const emf: Record<string, unknown> = {
        _aws: {
          Timestamp: Date.now(),
          CloudWatchMetrics: [{
            Namespace: NAMESPACE,
            Dimensions: Object.keys(safeDims).length > 0 ? [Object.keys(safeDims)] : [],
            Metrics: this.metrics.map(m => ({ Name: m.name, Unit: m.unit })),
          }],
        },
        ...safeDims,
      };

      for (const m of this.metrics) {
        emf[m.name] = m.value;
      }

      process.stdout.write(JSON.stringify(emf) + '\n');
    } catch {
      // stdout書き込み失敗は握りつぶし、アプリケーション処理を継続
    }
    this.metrics = [];
    this.dimensions = {};
  }
}

class NoopMetricsLogger implements MetricsLogger {
  putMetric(): void { /* no-op */ }
  setDimension(): void { /* no-op */ }
  flush(): void { /* no-op */ }
}

/**
 * MetricsLoggerを作成する。
 * @param enabled true: EMF出力、false: no-op
 */
export function createMetricsLogger(enabled: boolean): MetricsLogger {
  return enabled ? new EmfMetricsLogger() : new NoopMetricsLogger();
}
