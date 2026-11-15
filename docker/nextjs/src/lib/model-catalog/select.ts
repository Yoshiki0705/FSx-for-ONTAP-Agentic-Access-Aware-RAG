/**
 * Builds the model catalog from what Bedrock reports. Pure: no AWS calls, so the rules
 * are testable on recorded responses (`src/__tests__/model-catalog/`).
 *
 * Nothing here names a model. Which models exist, which are retired, how each is
 * called and which is newest all come from the API:
 *
 *   ListFoundationModels     lifecycle status (ACTIVE / LEGACY), startOfLifeTime,
 *                            inferenceTypesSupported, modalities
 *   ListInferenceProfiles    the profiles callable from the region, and the regions
 *                            each one routes to
 *   GetFoundationModelAvailability   whether the account may call the model
 *
 * Tiers (light / standard / heavy) are configured as family patterns, not IDs, and
 * resolve to the newest ACTIVE model of the family, so a new release is picked up and a
 * retired one dropped with no change here.
 */

export type ModelStatus = 'ready' | 'needs-request' | 'unavailable';
/** in-region: on-demand in the region. geo: a profile bounded to listed regions. global: any region. */
export type ProcessingScope = 'in-region' | 'geo' | 'global';
export type ProfilePreference = 'nearest' | 'global';
export type Tier = 'light' | 'standard' | 'heavy' | 'fallback' | 'voice';

export interface FoundationModelInput {
  modelId: string;
  modelName?: string;
  providerName?: string;
  inputModalities?: string[];
  outputModalities?: string[];
  inferenceTypesSupported?: string[];
  responseStreamingSupported?: boolean;
  lifecycleStatus?: string;
  startOfLifeTime?: string;
}

export interface InferenceProfileInput {
  inferenceProfileId: string;
  status?: string;
  /** Model ARNs: `arn:aws:bedrock:<region>::foundation-model/<id>`. An empty region means any region. */
  modelArns: string[];
}

export interface AvailabilityInput {
  agreementStatus?: string;
  authorizationStatus?: string;
  entitlementAvailability?: string;
  regionAvailability?: string;
}

export interface CatalogEntry {
  /** The foundation model ID (`anthropic.claude-sonnet-4-6`). */
  baseModelId: string;
  /** The ID to pass to Converse / InvokeModel in this region. */
  invokeId: string;
  name: string;
  provider: string;
  scope: ProcessingScope;
  /** Regions the call can be processed in; null when global. */
  destinationRegions: string[] | null;
  /** Every profile in the region that serves this model, so an explicit choice still resolves. */
  profileIds: string[];
  startOfLifeTime: string | null;
  lifecycleStatus: string;
  inputModalities: string[];
  outputModalities: string[];
  streaming: boolean;
  /** Usable in the chat-style selectors (text in, text out, Converse-shaped). */
  chat: boolean;
  status: ModelStatus;
  /** Why the model is not ready, for the screen. */
  reason?: string;
}

export interface CatalogOptions {
  region: string;
  preference: ProfilePreference;
}

const GLOBAL = Number.POSITIVE_INFINITY;

function regionOfArn(arn: string): string {
  return arn.split(':')[3] ?? '';
}

function baseIdOfArn(arn: string): string {
  const i = arn.indexOf('foundation-model/');
  return i >= 0 ? arn.slice(i + 'foundation-model/'.length) : '';
}

/** Regions a profile routes to; Infinity when one of its ARNs carries no region (global). */
function breadth(profile: InferenceProfileInput): { size: number; regions: string[] | null } {
  const regions = profile.modelArns.map(regionOfArn);
  if (regions.some((r) => r === '')) return { size: GLOBAL, regions: null };
  const unique = [...new Set(regions)].sort();
  return { size: unique.length, regions: unique };
}

/**
 * Models that answer text but are not chat models. Rerank models return scores, and a
 * speech-output model needs the bidirectional stream; neither works through Converse.
 * There is no API attribute for this, so it is the one rule written by hand, and it
 * names a kind of model, not a model.
 */
function isChatModel(m: FoundationModelInput): boolean {
  const input = m.inputModalities ?? [];
  const output = m.outputModalities ?? [];
  if (!input.includes('TEXT') || !output.includes('TEXT')) return false;
  if (output.includes('SPEECH')) return false;
  return !/(^|[.-])rerank([.-]|$)/.test(m.modelId);
}

/**
 * Maps the availability response to a status. `agreementAvailability: NOT_AVAILABLE` is
 * deliberately not treated as blocked: Opus 4.8 and Haiku 5.5 report it and answer
 * Converse calls (verified 2026-11-15 / ap-northeast-1, and the status stayed the same
 * after the calls). The documented blocking states are PENDING and ERROR.
 */
export function statusFromAvailability(a: AvailabilityInput | undefined): { status: ModelStatus; reason?: string } {
  if (!a) return { status: 'ready' };
  if (a.authorizationStatus === 'NOT_AUTHORIZED') return { status: 'unavailable', reason: 'not-authorized' };
  if (a.regionAvailability === 'NOT_AVAILABLE') return { status: 'unavailable', reason: 'region' };
  if (a.entitlementAvailability === 'NOT_AVAILABLE') return { status: 'needs-request', reason: 'entitlement' };
  if (a.agreementStatus === 'PENDING') return { status: 'needs-request', reason: 'agreement-pending' };
  if (a.agreementStatus === 'ERROR') return { status: 'needs-request', reason: 'agreement-error' };
  return { status: 'ready' };
}

export function buildCatalog(
  models: FoundationModelInput[],
  profiles: InferenceProfileInput[],
  availability: Map<string, AvailabilityInput>,
  options: CatalogOptions,
): CatalogEntry[] {
  const byBase = new Map<string, InferenceProfileInput[]>();
  for (const p of profiles) {
    if (p.status && p.status !== 'ACTIVE') continue;
    const base = baseIdOfArn(p.modelArns[0] ?? '');
    if (!base) continue;
    byBase.set(base, [...(byBase.get(base) ?? []), p]);
  }
  const entries: CatalogEntry[] = [];
  for (const m of models) {
    const onDemand = (m.inferenceTypesSupported ?? []).includes('ON_DEMAND');
    const candidates: { id: string; size: number; regions: string[] | null }[] = [];
    if (onDemand) candidates.push({ id: m.modelId, size: 1, regions: [options.region] });
    for (const p of byBase.get(m.modelId) ?? []) {
      const b = breadth(p);
      candidates.push({ id: p.inferenceProfileId, size: b.size, regions: b.regions });
    }
    if (candidates.length === 0) continue; // nothing in this region can call it
    // nearest: the fewest destination regions (on-demand, then jp, then apac, then global).
    // global: a global profile when there is one, else the nearest.
    candidates.sort((a, b) => a.size - b.size || a.id.localeCompare(b.id));
    const chosen =
      options.preference === 'global'
        ? candidates.find((c) => c.size === GLOBAL) ?? candidates[0]
        : candidates[0];
    const { status, reason } = statusFromAvailability(availability.get(m.modelId));
    entries.push({
      baseModelId: m.modelId,
      invokeId: chosen.id,
      name: m.modelName || m.modelId,
      provider: m.providerName || m.modelId.split('.')[0],
      scope: chosen.size === GLOBAL ? 'global' : chosen.id === m.modelId ? 'in-region' : 'geo',
      destinationRegions: chosen.regions,
      profileIds: candidates.filter((c) => c.id !== m.modelId).map((c) => c.id),
      startOfLifeTime: m.startOfLifeTime ?? null,
      lifecycleStatus: m.lifecycleStatus ?? 'ACTIVE',
      inputModalities: m.inputModalities ?? [],
      outputModalities: m.outputModalities ?? [],
      streaming: Boolean(m.responseStreamingSupported),
      chat: isChatModel(m),
      status,
      reason,
    });
  }
  return entries.sort(newestFirst);
}

function newestFirst(a: CatalogEntry, b: CatalogEntry): number {
  const ta = a.startOfLifeTime ? Date.parse(a.startOfLifeTime) : 0;
  const tb = b.startOfLifeTime ? Date.parse(b.startOfLifeTime) : 0;
  return tb - ta || b.baseModelId.localeCompare(a.baseModelId);
}

/** `anthropic.claude-sonnet-*` → a regex over the whole base model ID. */
export function familyMatcher(pattern: string): RegExp {
  const escaped = pattern
    .trim()
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`);
}

/**
 * The newest ACTIVE, ready model of the family, or undefined.
 *
 * With `preferBounded`, models processed in bounded Regions (on demand in the Region, or
 * a geography profile such as `jp.`) come before any model that is only callable through
 * a `global.` profile, even a newer one. In Tokyo that keeps processing in Japan when the
 * family has such a model; a family with only global models still resolves.
 */
export function newestOfFamily(
  catalog: CatalogEntry[],
  pattern: string,
  accept: (e: CatalogEntry) => boolean = (e) => e.chat,
  preferBounded = false,
): CatalogEntry | undefined {
  const re = familyMatcher(pattern);
  const candidates = catalog
    .filter((e) => e.lifecycleStatus === 'ACTIVE' && e.status === 'ready' && accept(e) && re.test(e.baseModelId))
    .sort(newestFirst);
  return (preferBounded ? candidates.find((e) => e.scope !== 'global') : undefined) ?? candidates[0];
}

export type TierFamilies = Record<Tier, string>;

/**
 * Each tier's model: the newest of its family, then the newest of the fallback family,
 * then the newest ready chat model. Voice has no chat fallback: a text model cannot
 * stand in for a speech model.
 */
export function resolveTiers(
  catalog: CatalogEntry[],
  families: TierFamilies,
  preferBounded = false,
): Record<Tier, CatalogEntry | undefined> {
  const ready = catalog.filter((e) => e.chat && e.lifecycleStatus === 'ACTIVE' && e.status === 'ready');
  const anyChat = (preferBounded ? ready.find((e) => e.scope !== 'global') : undefined) ?? ready[0];
  const fallback = newestOfFamily(catalog, families.fallback, undefined, preferBounded) ?? anyChat;
  const pick = (t: Exclude<Tier, 'voice' | 'fallback'>) =>
    newestOfFamily(catalog, families[t], undefined, preferBounded) ?? fallback;
  return {
    light: pick('light'),
    standard: pick('standard'),
    heavy: pick('heavy'),
    fallback,
    voice: newestOfFamily(catalog, families.voice, (e) => e.outputModalities.includes('SPEECH'), preferBounded),
  };
}

/**
 * `tier:light` / `tier:standard` / `tier:heavy` / `tier:fallback` / `tier:voice`: what a
 * client sends when it means a tier rather than a model (Smart Routing does). The server
 * resolves it, so the browser holds no model ID.
 */
export const TIER_TOKEN_PREFIX = 'tier:';
const TIERS: readonly Tier[] = ['light', 'standard', 'heavy', 'fallback', 'voice'];
export function tierOfToken(id: string): Tier | undefined {
  if (!id.startsWith(TIER_TOKEN_PREFIX)) return undefined;
  const t = id.slice(TIER_TOKEN_PREFIX.length) as Tier;
  return TIERS.includes(t) ? t : undefined;
}

export interface Resolution {
  invokeId: string;
  entry?: CatalogEntry;
  /** Set when the requested model was retired or unknown and another was substituted. */
  substitutedFor?: string;
}

/**
 * The ID to call for what a client or a stored definition asked for.
 *
 * Accepts a base ID or any profile ID the region serves. A retired (LEGACY) or unknown
 * model is replaced by the newest model of the tier whose family it belongs to, so a
 * saved preference or agent definition keeps working after a model is retired.
 */
export function resolveRequested(
  catalog: CatalogEntry[],
  requested: string | undefined,
  families: TierFamilies,
  preferBounded = false,
): Resolution {
  const tiers = resolveTiers(catalog, families, preferBounded);
  const standard = tiers.standard;
  if (!requested) {
    return standard ? { invokeId: standard.invokeId, entry: standard } : { invokeId: '' };
  }
  const tier = tierOfToken(requested);
  if (tier) {
    const t = tiers[tier];
    return t ? { invokeId: t.invokeId, entry: t } : { invokeId: '' };
  }
  const hit = catalog.find(
    (e) => e.baseModelId === requested || e.invokeId === requested || e.profileIds.includes(requested),
  );
  if (hit && hit.lifecycleStatus === 'ACTIVE') {
    // An explicit profile choice is honoured; a base ID gets the configured preference.
    const invokeId = hit.baseModelId === requested ? hit.invokeId : requested;
    return { invokeId, entry: hit };
  }
  const base = hit?.baseModelId ?? stripProfilePrefix(catalog, requested);
  for (const t of ['light', 'standard', 'heavy', 'fallback', 'voice'] as const) {
    if (familyMatcher(families[t]).test(base) && tiers[t]) {
      return { invokeId: tiers[t]!.invokeId, entry: tiers[t], substitutedFor: requested };
    }
  }
  if (hit) return { invokeId: hit.invokeId, entry: hit }; // LEGACY outside every family: still callable until end of life
  return { invokeId: requested };
}

/**
 * `jp.anthropic.x` → `anthropic.x`. A first segment that is not a provider prefix of any
 * model in the region is taken as a profile prefix, so a profile that no longer exists
 * (an old `apac.` ID in a saved preference) still maps to its model's family.
 */
function stripProfilePrefix(catalog: CatalogEntry[], id: string): string {
  const providers = new Set(catalog.map((e) => e.baseModelId.split('.')[0]));
  const [head, ...rest] = id.split('.');
  return !providers.has(head) && rest.length > 1 ? rest.join('.') : id;
}
