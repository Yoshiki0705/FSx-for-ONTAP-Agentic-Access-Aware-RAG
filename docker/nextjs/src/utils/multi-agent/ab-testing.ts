/**
 * A/B Test Traffic Split Logic
 *
 * Routes requests to control or experiment version based on the configured
 * traffic split percentage (`abTestTrafficSplit`).
 *
 * Validates: Requirements 17.3, 17.4
 */

import type { ABTestConfig } from '@/types/multi-agent';

// ===== Traffic Split =====

export interface ABTestRoutingResult {
  /** Which version was selected */
  selectedVersion: string;
  /** Whether this request goes to the experiment version */
  isExperiment: boolean;
  /** The random value used for the split decision (0-100) */
  splitValue: number;
  /** The configured split percentage */
  splitPercent: number;
}

/**
 * Determine which A/B test version to route a request to.
 *
 * Uses a random value (0-100) compared against `trafficSplitPercent`:
 * - value < splitPercent → experiment version
 * - value >= splitPercent → control version
 *
 * @param config - A/B test configuration
 * @param randomValue - Optional override for the random value (0-100), for testing
 * @returns Routing result with selected version and metadata
 */
export function routeABTestTraffic(
  config: ABTestConfig,
  randomValue?: number,
): ABTestRoutingResult {
  if (!config.enabled) {
    return {
      selectedVersion: config.controlVersion,
      isExperiment: false,
      splitValue: 0,
      splitPercent: config.trafficSplitPercent,
    };
  }

  const splitValue = randomValue ?? Math.random() * 100;
  const isExperiment = splitValue < config.trafficSplitPercent;

  return {
    selectedVersion: isExperiment ? config.experimentVersion : config.controlVersion,
    isExperiment,
    splitValue,
    splitPercent: config.trafficSplitPercent,
  };
}

/**
 * Create a default A/B test config.
 *
 * @param controlVersion - Control version label (default: "v1.0")
 * @param experimentVersion - Experiment version label (default: "v1.1-experiment")
 * @param trafficSplitPercent - Percentage of traffic to experiment (default: 50)
 * @returns ABTestConfig
 */
export function createDefaultABTestConfig(
  controlVersion = 'v1.0',
  experimentVersion = 'v1.1-experiment',
  trafficSplitPercent = 50,
): ABTestConfig {
  return {
    enabled: false,
    trafficSplitPercent: Math.max(0, Math.min(100, trafficSplitPercent)),
    controlVersion,
    experimentVersion,
  };
}
