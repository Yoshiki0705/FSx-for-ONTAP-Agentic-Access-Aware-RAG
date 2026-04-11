/**
 * Model compatibility utilities for mode-switching fallback logic.
 *
 * When switching between KB and Agent modes, the currently selected model
 * may not be available in the target mode's model list. This module provides
 * the fallback resolution logic.
 */

/** Chat mode type representing the three available modes */
export type ChatMode = 'kb' | 'single-agent' | 'multi-agent';

/** Result of resolving a model for a target mode */
export interface ModelFallbackResult {
  /** The resolved model ID (either the current model or the fallback default) */
  modelId: string;
  /** Whether a fallback to the default model occurred */
  didFallback: boolean;
  /** The model ID before fallback (same as modelId if no fallback) */
  previousModelId: string;
}

/**
 * Resolves the appropriate model for a target chat mode.
 *
 * If the current model is available in the target mode's model list, it is kept.
 * Otherwise, the default model for that mode is returned as a fallback.
 *
 * @param currentModelId - The currently selected model ID
 * @param targetMode - The chat mode being switched to
 * @param kbModels - List of model IDs available in KB mode
 * @param agentModels - List of model IDs available in Agent modes
 * @param defaultKbModel - Default model ID for KB mode
 * @param defaultAgentModel - Default model ID for Agent modes
 * @returns The resolved model with fallback information
 */
export function resolveModelForMode(
  currentModelId: string,
  targetMode: ChatMode,
  kbModels: string[],
  agentModels: string[],
  defaultKbModel: string,
  defaultAgentModel: string,
): ModelFallbackResult {
  const isAgentMode = targetMode.includes('agent');
  const targetModels = isAgentMode ? agentModels : kbModels;
  const defaultModel = isAgentMode ? defaultAgentModel : defaultKbModel;

  if (targetModels.includes(currentModelId)) {
    return {
      modelId: currentModelId,
      didFallback: false,
      previousModelId: currentModelId,
    };
  }

  return {
    modelId: defaultModel,
    didFallback: true,
    previousModelId: currentModelId,
  };
}
