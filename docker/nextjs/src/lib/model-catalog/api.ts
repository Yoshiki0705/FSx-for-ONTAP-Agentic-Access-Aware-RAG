/**
 * The model shape the API routes return. One shape for `/api/bedrock/region-info`,
 * `/api/bedrock/models` and `/api/bedrock/agent-models`, so every selector reads the
 * same fields. Both `id`/`name` and `modelId`/`modelName` are present because callers
 * written against either name exist.
 *
 * `id` is the ID to call (the profile when one is used). `baseModelId` is the model.
 */
import type { CatalogEntry, Tier } from './select';
import { generateModelConfig } from '@/config/model-pattern-detector';

export interface ApiModel {
  id: string;
  modelId: string;
  baseModelId: string;
  name: string;
  modelName: string;
  provider: string;
  providerName: string;
  description: string;
  category: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  inputModalities: string[];
  outputModalities: string[];
  responseStreamingSupported: boolean;
  startOfLifeTime: string | null;
  /** ready / needs-request (show 「申請が必要」, not selectable) / unavailable. */
  status: CatalogEntry['status'];
  available: boolean;
  reason?: string;
  /** in-region / geo / global: where the call is processed. */
  scope: CatalogEntry['scope'];
  destinationRegions: string[] | null;
}

export function toApiModel(e: CatalogEntry): ApiModel {
  const config = generateModelConfig(e.baseModelId, e.name, e.provider);
  return {
    id: e.invokeId,
    modelId: e.invokeId,
    baseModelId: e.baseModelId,
    name: e.name,
    modelName: e.name,
    provider: config.provider,
    providerName: e.provider,
    description: config.description,
    category: config.category,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    topP: config.topP,
    inputModalities: e.inputModalities,
    outputModalities: e.outputModalities,
    responseStreamingSupported: e.streaming,
    startOfLifeTime: e.startOfLifeTime,
    status: e.status,
    available: e.status === 'ready',
    reason: e.reason,
    scope: e.scope,
    destinationRegions: e.destinationRegions,
  };
}

/** Chat-capable, ACTIVE models: what the chat, KB and agent selectors offer. */
export function chatModels(catalog: CatalogEntry[]): ApiModel[] {
  return catalog.filter((e) => e.chat && e.lifecycleStatus === 'ACTIVE').map(toApiModel);
}

export function tierIds(tiers: Record<Tier, CatalogEntry | undefined>): Record<Tier, string | null> {
  return {
    light: tiers.light?.invokeId ?? null,
    standard: tiers.standard?.invokeId ?? null,
    heavy: tiers.heavy?.invokeId ?? null,
    fallback: tiers.fallback?.invokeId ?? null,
    voice: tiers.voice?.invokeId ?? null,
  };
}
