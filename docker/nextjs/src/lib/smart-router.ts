/**
 * SmartRouter — クエリルーティングモジュール
 *
 * クエリの複雑度分類に基づいて、軽量モデルまたは高性能モデルを
 * 自動選択するルーティングエンジン。
 * Smart Routing OFF時や手動オーバーライド時は分類を行わず、
 * 指定されたモデルをそのまま返す。
 *
 * @version 1.0.0
 */

import { RoutingDecision, SmartRouterConfig } from '@/types/smart-routing';
import { classifyQuery } from '@/lib/complexity-classifier';

/** デフォルトのSmartRouter設定 */
export const DEFAULT_SMART_ROUTER_CONFIG: SmartRouterConfig = {
  lightweightModelId: 'anthropic.claude-haiku-4-5-20251001-v1:0',
  powerfulModelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
};

/**
 * クエリをルーティングし、使用するモデルを決定する。
 *
 * @param query - ユーザーのクエリテキスト
 * @param isSmartRoutingEnabled - Smart Routingが有効かどうか
 * @param isAutoMode - 自動選択モードかどうか
 * @param manualModelId - 手動選択されたモデルID
 * @param config - SmartRouter設定（軽量/高性能モデルID）
 * @returns RoutingDecision — 選択モデル、分類結果、ルーティング理由
 */
export function routeQuery(
  query: string,
  isSmartRoutingEnabled: boolean,
  isAutoMode: boolean,
  manualModelId: string,
  config: SmartRouterConfig
): RoutingDecision {
  // Smart Routing OFF or manual override → use manual model
  if (!isSmartRoutingEnabled || !isAutoMode) {
    const reason = !isSmartRoutingEnabled
      ? 'Smart Routing is disabled. Using manually selected model.'
      : 'Manual override active. Using manually selected model.';

    console.log(
      `[SmartRouter] Manual selection — model: ${manualModelId}, reason: ${reason}`
    );

    return {
      modelId: manualModelId,
      classification: null,
      isAutoRouted: false,
      reason,
    };
  }

  // Smart Routing ON + auto mode → classify and route
  const classification = classifyQuery(query);

  const modelId =
    classification.classification === 'simple'
      ? config.lightweightModelId
      : config.powerfulModelId;

  const reason =
    classification.classification === 'simple'
      ? `Query classified as simple (confidence: ${classification.confidence.toFixed(2)}). Using lightweight model.`
      : `Query classified as complex (confidence: ${classification.confidence.toFixed(2)}). Using powerful model.`;

  console.log(
    `[SmartRouter] Auto-routed — model: ${modelId}, classification: ${classification.classification}, confidence: ${classification.confidence.toFixed(2)}`
  );

  return {
    modelId,
    classification,
    isAutoRouted: true,
    reason,
  };
}
