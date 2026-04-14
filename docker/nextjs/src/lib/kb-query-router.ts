/**
 * KBQueryRouter — Route queries to the appropriate Knowledge Base.
 *
 * In Single KB mode (replace) every query goes to the primary KB.
 * In Dual KB mode (dual) the router picks the text-only or multimodal KB
 * based on query characteristics and an optional user toggle.
 *
 * Requirements: 13.2, 13.3
 */

import type {
  KBRouterConfig,
  RouteDecision,
  ActiveKBType,
} from '@/types/multimodal';

export class KBQueryRouter {
  private config: KBRouterConfig;

  constructor(config: KBRouterConfig) {
    this.config = config;
  }

  /**
   * Determine which KB should handle the query.
   *
   * @param query          - The user's text query
   * @param hasImageAttachment - Whether the request includes an image
   * @param userToggle     - Explicit user preference (Dual KB mode only)
   */
  route(
    query: string,
    hasImageAttachment: boolean,
    userToggle?: ActiveKBType,
  ): RouteDecision {
    const { mode, textKbId, multimodalKbId } = this.config;

    // Single KB mode — always route to the primary KB (textKbId is the
    // single KB regardless of which embedding model was chosen).
    if (mode !== 'dual') {
      return { targetKbId: textKbId, reason: 'single-kb' };
    }

    // Dual KB mode — honour explicit user toggle first
    if (userToggle === 'text') {
      return { targetKbId: textKbId, reason: 'user-toggle' };
    }
    if (userToggle === 'multimodal') {
      return { targetKbId: multimodalKbId, reason: 'user-toggle' };
    }

    // Auto-route: image attachment → multimodal KB
    if (hasImageAttachment) {
      return { targetKbId: multimodalKbId, reason: 'image-query' };
    }

    // Default for text-only queries in dual mode → text KB
    return { targetKbId: textKbId, reason: 'text-only-query' };
  }
}

/**
 * Build a KBRouterConfig from environment variables.
 * Falls back gracefully when env vars are missing.
 */
export function buildRouterConfigFromEnv(): KBRouterConfig {
  const dualMode = process.env.DUAL_KB_MODE === 'true';
  const primaryKbId = process.env.BEDROCK_KB_ID || '';

  return {
    textKbId: dualMode
      ? process.env.BEDROCK_KB_ID_TEXT || primaryKbId
      : primaryKbId,
    multimodalKbId: dualMode
      ? process.env.BEDROCK_KB_ID_MULTIMODAL || primaryKbId
      : primaryKbId,
    mode: dualMode ? 'dual' : 'replace',
  };
}
