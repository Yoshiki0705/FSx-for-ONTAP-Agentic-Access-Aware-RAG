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
 * GPT-5.5 モデルID（手動選択専用、自動ルーティング対象外）
 *
 * NOTE: OpenAI models on Amazon Bedrock are available in limited preview.
 * The exact model ID, Region availability, inference profile, and access
 * status may vary by account. Verify in your AWS account before enabling.
 * See: https://aws.amazon.com/bedrock/
 */
export const GPT_5_5_MODEL_ID = 'openai.gpt-5-5';

/** デフォルトのSmartRouter設定 */
export const DEFAULT_SMART_ROUTER_CONFIG: SmartRouterConfig = {
  lightweightModelId: 'anthropic.claude-haiku-4-5-20251001-v1:0',
  powerfulModelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  heavyModelId: 'anthropic.claude-opus-4-0-20250514-v1:0',
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
