/**
 * Server-side model catalog: what the region can call, how, and which model each tier
 * uses. See `select.ts` for the rules; this file fetches, caches and configures them.
 *
 * Configuration (environment, set by the CDK stack from context):
 *   MODEL_FAMILY_LIGHT / _STANDARD / _HEAVY / _FALLBACK / _VOICE   family patterns
 *   MODEL_PROFILE_PREFERENCE   `nearest` (default) or `global`
 *   MODEL_CATALOG_TTL_SECONDS  cache lifetime, default 3600
 *
 * Server only: it calls Bedrock control-plane APIs with the Lambda role.
 */
import {
  BedrockClient,
  GetFoundationModelAvailabilityCommand,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
  type InferenceProfileSummary,
} from '@aws-sdk/client-bedrock';
import {
  buildCatalog,
  resolveRequested,
  resolveTiers,
  type AvailabilityInput,
  type CatalogEntry,
  type FoundationModelInput,
  type InferenceProfileInput,
  type ProfilePreference,
  type Resolution,
  type Tier,
  type TierFamilies,
} from './select';

export type { CatalogEntry, Resolution, Tier, TierFamilies, ProfilePreference } from './select';

/** Family patterns used when the stack sets none. The only model names in the app. */
export const DEFAULT_TIER_FAMILIES: TierFamilies = {
  light: 'anthropic.claude-*haiku*',
  standard: 'anthropic.claude-*sonnet*',
  heavy: 'anthropic.claude-*opus*',
  fallback: 'amazon.nova-*lite*',
  voice: 'amazon.nova-*sonic*',
};

export function tierFamilies(env: NodeJS.ProcessEnv = process.env): TierFamilies {
  return {
    light: env.MODEL_FAMILY_LIGHT || DEFAULT_TIER_FAMILIES.light,
    standard: env.MODEL_FAMILY_STANDARD || DEFAULT_TIER_FAMILIES.standard,
    heavy: env.MODEL_FAMILY_HEAVY || DEFAULT_TIER_FAMILIES.heavy,
    fallback: env.MODEL_FAMILY_FALLBACK || DEFAULT_TIER_FAMILIES.fallback,
    voice: env.MODEL_FAMILY_VOICE || DEFAULT_TIER_FAMILIES.voice,
  };
}

export function profilePreference(env: NodeJS.ProcessEnv = process.env): ProfilePreference {
  return env.MODEL_PROFILE_PREFERENCE === 'global' ? 'global' : 'nearest';
}

export function defaultRegion(env: NodeJS.ProcessEnv = process.env): string {
  return env.BEDROCK_REGION || env.AWS_REGION || 'ap-northeast-1';
}

function ttlMs(): number {
  const s = Number(process.env.MODEL_CATALOG_TTL_SECONDS);
  return (Number.isFinite(s) && s > 0 ? s : 3600) * 1000;
}

interface CacheSlot {
  at: number;
  catalog?: CatalogEntry[];
  inflight?: Promise<CatalogEntry[]>;
}
const cache = new Map<string, CacheSlot>();
/** Models a call was denied for, by region: base model ID → expiry. */
const denied = new Map<string, Map<string, number>>();

/** For tests. */
export function resetModelCatalogCache(): void {
  cache.clear();
  denied.clear();
}

async function listModels(client: BedrockClient): Promise<FoundationModelInput[]> {
  const out = await client.send(new ListFoundationModelsCommand({ byOutputModality: 'TEXT' }));
  // Speech models report TEXT as one output too, so the voice tier is in this list.
  return (out.modelSummaries ?? []).map((m) => ({
    modelId: m.modelId ?? '',
    modelName: m.modelName,
    providerName: m.providerName,
    inputModalities: m.inputModalities,
    outputModalities: m.outputModalities,
    inferenceTypesSupported: m.inferenceTypesSupported,
    responseStreamingSupported: m.responseStreamingSupported,
    lifecycleStatus: m.modelLifecycle?.status,
    startOfLifeTime: m.modelLifecycle?.startOfLifeTime?.toISOString?.() ?? undefined,
  }));
}

async function listProfiles(client: BedrockClient): Promise<InferenceProfileInput[]> {
  const all: InferenceProfileSummary[] = [];
  let nextToken: string | undefined;
  do {
    const out = await client.send(
      new ListInferenceProfilesCommand({ typeEquals: 'SYSTEM_DEFINED', maxResults: 1000, nextToken }),
    );
    all.push(...(out.inferenceProfileSummaries ?? []));
    nextToken = out.nextToken;
  } while (nextToken);
  return all.map((p) => ({
    inferenceProfileId: p.inferenceProfileId ?? '',
    status: p.status,
    modelArns: (p.models ?? []).map((m) => m.modelArn ?? ''),
  }));
}

/**
 * One call per ACTIVE model, a few at a time. A failure (missing permission, throttling)
 * leaves the model without an entry, which counts as ready: hiding every model because
 * this one API is denied would take the app down for a reason unrelated to the models.
 */
async function listAvailability(client: BedrockClient, ids: string[]): Promise<Map<string, AvailabilityInput>> {
  const result = new Map<string, AvailabilityInput>();
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        const a = await client.send(new GetFoundationModelAvailabilityCommand({ modelId: id }));
        result.set(id, {
          agreementStatus: a.agreementAvailability?.status,
          authorizationStatus: a.authorizationStatus,
          entitlementAvailability: a.entitlementAvailability,
          regionAvailability: a.regionAvailability,
        });
      } catch {
        // unknown: treated as ready (see above)
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return result;
}

async function fetchCatalog(region: string, preference: ProfilePreference): Promise<CatalogEntry[]> {
  const client = new BedrockClient({ region });
  const [models, profiles] = await Promise.all([listModels(client), listProfiles(client)]);
  const active = models.filter((m) => m.lifecycleStatus !== 'LEGACY').map((m) => m.modelId);
  const availability = await listAvailability(client, active);
  return buildCatalog(models, profiles, availability, { region, preference });
}

function applyDenied(region: string, catalog: CatalogEntry[]): CatalogEntry[] {
  const marks = denied.get(region);
  if (!marks || marks.size === 0) return catalog;
  const now = Date.now();
  return catalog.map((e) => {
    const until = marks.get(e.baseModelId);
    if (!until) return e;
    if (until < now) {
      marks.delete(e.baseModelId);
      return e;
    }
    return { ...e, status: 'needs-request', reason: 'access-denied' };
  });
}

/** The region's catalog, newest first. Serves a stale copy when a refresh fails. */
export async function getModelCatalog(region = defaultRegion()): Promise<CatalogEntry[]> {
  const preference = profilePreference();
  const key = `${region}|${preference}`;
  const slot = cache.get(key);
  if (slot?.catalog && Date.now() - slot.at < ttlMs()) return applyDenied(region, slot.catalog);
  if (slot?.inflight) return applyDenied(region, await slot.inflight);
  const inflight = fetchCatalog(region, preference);
  cache.set(key, { at: slot?.at ?? 0, catalog: slot?.catalog, inflight });
  try {
    const catalog = await inflight;
    cache.set(key, { at: Date.now(), catalog });
    return applyDenied(region, catalog);
  } catch (error) {
    if (slot?.catalog) {
      console.warn('[ModelCatalog] refresh failed, serving the previous catalog:', error);
      cache.set(key, { at: slot.at, catalog: slot.catalog });
      return applyDenied(region, slot.catalog);
    }
    cache.delete(key);
    throw error;
  }
}

export async function getTierModels(region = defaultRegion()): Promise<Record<Tier, CatalogEntry | undefined>> {
  return resolveTiers(await getModelCatalog(region), tierFamilies());
}

/** The ID to call for a tier. Empty when the region has no usable model at all. */
export async function modelForTier(tier: Tier, region = defaultRegion()): Promise<string> {
  try {
    return (await getTierModels(region))[tier]?.invokeId ?? '';
  } catch (error) {
    console.warn(`[ModelCatalog] catalog unavailable, no model for tier "${tier}":`, error);
    return '';
  }
}

/**
 * The ID to call for a requested model (base ID, profile ID, retired ID, or nothing).
 * Falls back to the request itself when the catalog cannot be read, so a Bedrock
 * control-plane outage does not stop calls that would have worked.
 */
export async function resolveModelForInvoke(requested: string | undefined, region = defaultRegion()): Promise<Resolution> {
  try {
    const resolution = resolveRequested(await getModelCatalog(region), requested, tierFamilies());
    if (resolution.substitutedFor) {
      console.warn(`[ModelCatalog] "${resolution.substitutedFor}" is retired or unknown here; using "${resolution.invokeId}"`);
    }
    return resolution;
  } catch (error) {
    console.warn('[ModelCatalog] catalog unavailable, calling the requested model as is:', error);
    return { invokeId: requested ?? '' };
  }
}

/**
 * Records a denied call so the selectors show the model as needing a request for the
 * next hour. Only errors that say access is missing count; a throttle or a bad request
 * says nothing about the model.
 */
export function reportModelInvokeError(region: string, invokeId: string, error: unknown): void {
  const e = error as { name?: string; message?: string } | undefined;
  if (e?.name !== 'AccessDeniedException') return;
  if (!/model|agreement|use case|subscri|access/i.test(e.message ?? '')) return;
  const slot = [...cache.entries()].find(([k]) => k.startsWith(`${region}|`))?.[1];
  const entry = slot?.catalog?.find((c) => c.invokeId === invokeId || c.baseModelId === invokeId || c.profileIds.includes(invokeId));
  const base = entry?.baseModelId ?? invokeId;
  const marks = denied.get(region) ?? new Map<string, number>();
  marks.set(base, Date.now() + ttlMs());
  denied.set(region, marks);
}
