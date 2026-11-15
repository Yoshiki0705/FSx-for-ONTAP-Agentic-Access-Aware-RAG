/**
 * SmartRouter — クエリルーティングモジュール
 *
 * クエリの複雑度分類に基づいて、軽量モデル・高性能モデル・重量モデルを
 * 自動選択する3層ルーティングエンジン。
 * Smart Routing OFF時や手動オーバーライド時は分類を行わず、
 * 指定されたモデルをそのまま返す。
 *
 * @version 2.0.0
 */

import { RoutingDecision, SmartRouterConfig } from '@/types/smart-routing';
import { classifyQuery } from '@/lib/complexity-classifier';

/**
 * ルーティング決定後にCloudWatch EMFメトリクスを出力する。
 *
 * RoutingTierディメンション付きの `RoutingCount` メトリクスを
 * Embedded Metric Format (EMF) で console.log に出力する。
 * CloudWatch Logs エージェントがこのJSON構造を検出し、
 * 自動的にCloudWatchメトリクスとして発行する。
 *
 * @param decision - ルーティング判断結果
 */
export function emitRoutingMetric(decision: RoutingDecision): void {
  const tier = decision.classification?.classification ?? 'manual';

  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: 'SmartRouting',
            Dimensions: [['RoutingTier']],
            Metrics: [{ Name: 'RoutingCount', Unit: 'Count' }],
          },
        ],
      },
      RoutingTier: tier,
      RoutingCount: 1,
    })
  );
}

/**
 * デフォルトのSmartRouter設定
 *
 * Tier tokens, not model IDs: the server resolves each to the newest model of the tier's
 * family (src/lib/model-catalog), so a new release is used without changing this file.
 */
export const DEFAULT_SMART_ROUTER_CONFIG: SmartRouterConfig = {
  lightweightModelId: 'tier:light',
  powerfulModelId: 'tier:standard',
  heavyModelId: 'tier:heavy',
  contextSizeThreshold: 4000,
};

/**
 * クエリをルーティングし、使用するモデルを決定する。
 *
 * @param query - ユーザーのクエリテキスト
 * @param isSmartRoutingEnabled - Smart Routingが有効かどうか
 * @param isAutoMode - 自動選択モードかどうか
 * @param manualModelId - 手動選択されたモデルID
 * @param config - SmartRouter設定（軽量/高性能/重量モデルID）
 * @param contextSize - コンテキストの文字数（オプション、デフォルト0）
 * @returns RoutingDecision — 選択モデル、分類結果、ルーティング理由
 */
export function routeQuery(
  query: string,
  isSmartRoutingEnabled: boolean,
  isAutoMode: boolean,
  manualModelId: string,
  config: SmartRouterConfig,
  contextSize: number = 0
): RoutingDecision {
  // Smart Routing OFF or manual override → use manual model
  if (!isSmartRoutingEnabled || !isAutoMode) {
    const reason = !isSmartRoutingEnabled
      ? 'Smart Routing is disabled. Using manually selected model.'
      : 'Manual override active. Using manually selected model.';

    console.log(
      `[SmartRouter] Manual selection — model: ${manualModelId}, reason: ${reason}`
    );

    const decision: RoutingDecision = {
      modelId: manualModelId,
      classification: null,
      isAutoRouted: false,
      reason,
    };

    emitRoutingMetric(decision);

    return decision;
  }

  // Smart Routing ON + auto mode → classify and route
  const threshold = config.contextSizeThreshold ?? 4000;
  const classification = classifyQuery(query, contextSize, threshold);

  let modelId: string;
  let reason: string;

  switch (classification.classification) {
    case 'full-context': {
      // Use heavyModelId, fall back to powerfulModelId if not configured
      modelId = config.heavyModelId ?? config.powerfulModelId;
      reason = `Query classified as full-context (confidence: ${classification.confidence.toFixed(2)}). Using heavy model.`;
      break;
    }
    case 'complex': {
      modelId = config.powerfulModelId;
      reason = `Query classified as complex (confidence: ${classification.confidence.toFixed(2)}). Using powerful model.`;
      break;
    }
    default: {
      modelId = config.lightweightModelId;
      reason = `Query classified as simple (confidence: ${classification.confidence.toFixed(2)}). Using lightweight model.`;
      break;
    }
  }

  console.log(
    `[SmartRouter] Auto-routed — model: ${modelId}, classification: ${classification.classification}, confidence: ${classification.confidence.toFixed(2)}`
  );

  const decision: RoutingDecision = {
    modelId,
    classification,
    isAutoRouted: true,
    reason,
  };

  emitRoutingMetric(decision);

  return decision;
}
