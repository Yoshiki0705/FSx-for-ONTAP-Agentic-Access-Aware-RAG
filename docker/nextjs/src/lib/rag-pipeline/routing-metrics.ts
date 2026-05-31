/**
 * RAG Pipeline — Routing Metrics
 *
 * Emits CloudWatch EMF metrics for Smart Routing decisions.
 * Tracks auto-routed vs manual override, and classification distribution.
 */

import { createMetricsLogger } from '@/lib/monitoring/metrics';

/**
 * Emit Smart Routing metrics to CloudWatch EMF.
 *
 * @param isAutoRouted - Whether the model was auto-selected by Smart Routing
 * @param classification - Query complexity classification (simple/complex)
 */
export function emitRoutingMetrics(
  isAutoRouted: boolean | undefined,
  classification: 'simple' | 'complex' | undefined,
): void {
  const monitoringEnabled = process.env.ENABLE_MONITORING === 'true';
  if (!monitoringEnabled || isAutoRouted === undefined) return;

  const metrics = createMetricsLogger(true);
  metrics.setDimension('Operation', 'routing');

  if (isAutoRouted) {
    metrics.putMetric('SmartRoutingAutoSelect', 1, 'Count');
    if (classification === 'simple') {
      metrics.putMetric('SmartRoutingSimple', 1, 'Count');
    } else if (classification === 'complex') {
      metrics.putMetric('SmartRoutingComplex', 1, 'Count');
    }
  } else {
    metrics.putMetric('SmartRoutingManualOverride', 1, 'Count');
  }

  metrics.flush();
}
