/**
 * The catalog rules against a recorded Tokyo response (tokyo-2026-11-15.json).
 *
 * What these pin: tiers pick the newest ACTIVE model of their family from the API's own
 * dates, retired models are replaced, the profile with the fewest destination regions is
 * chosen unless `global` is preferred, and a blocked model is not offered as ready.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import fixture from './tokyo-2026-11-15.json';
import {
  buildCatalog,
  familyMatcher,
  resolveRequested,
  resolveTiers,
  statusFromAvailability,
  type AvailabilityInput,
  type FoundationModelInput,
  type InferenceProfileInput,
} from '@/lib/model-catalog/select';
import { DEFAULT_TIER_FAMILIES } from '@/lib/model-catalog';

const models = fixture.models as FoundationModelInput[];
const profiles = fixture.profiles as InferenceProfileInput[];
const none = new Map<string, AvailabilityInput>();
const tokyo = (preference: 'nearest' | 'global' = 'nearest', availability = none) =>
  buildCatalog(models, profiles, availability, { region: 'ap-northeast-1', preference });

describe('tiers by newness only (preference global)', () => {
  it('pick the newest ACTIVE model of each family by startOfLifeTime', () => {
    const tiers = resolveTiers(tokyo(), DEFAULT_TIER_FAMILIES);
    expect(tiers.light?.baseModelId).toBe('anthropic.claude-haiku-5-5');
    expect(tiers.standard?.baseModelId).toBe('anthropic.claude-sonnet-5-5');
    expect(tiers.heavy?.baseModelId).toBe('anthropic.claude-opus-5-5');
    expect(tiers.fallback?.baseModelId).toBe('amazon.nova-2-lite-v1:0');
    expect(tiers.voice?.baseModelId).toBe('amazon.nova-2-5-sonic');
  });

  it('agree with the dates for any family in the fixture', () => {
    // Independent of the hand-picked expectations above: for every provider prefix,
    // the tier is the ACTIVE chat model with the latest date.
    const catalog = tokyo();
    const prefixes = [...new Set(catalog.map((e) => e.baseModelId.split('-')[0]))];
    fc.assert(
      fc.property(fc.constantFrom(...prefixes), (prefix) => {
        const pattern = `${prefix}*`;
        const picked = resolveTiers(catalog, { ...DEFAULT_TIER_FAMILIES, light: pattern, fallback: 'none' }).light;
        const candidates = catalog.filter(
          (e) => e.chat && e.lifecycleStatus === 'ACTIVE' && familyMatcher(pattern).test(e.baseModelId),
        );
        if (candidates.length === 0) return;
        const latest = Math.max(...candidates.map((e) => Date.parse(e.startOfLifeTime!)));
        expect(Date.parse(picked!.startOfLifeTime!)).toBe(latest);
      }),
      { numRuns: 100 },
    );
  });

  it('fall back to the fallback family when a family has nothing ready', () => {
    const tiers = resolveTiers(tokyo(), { ...DEFAULT_TIER_FAMILIES, heavy: 'nobody.*' });
    expect(tiers.heavy?.baseModelId).toBe('amazon.nova-2-lite-v1:0');
  });

  it('skip a model that needs a request', () => {
    const blocked = new Map([['anthropic.claude-sonnet-5-5', { agreementStatus: 'PENDING' }]]);
    const tiers = resolveTiers(tokyo('nearest', blocked), DEFAULT_TIER_FAMILIES);
    expect(tiers.standard?.baseModelId).toBe('anthropic.claude-sonnet-5');
  });
});

describe('tiers that keep processing in bounded Regions (the default, preference nearest)', () => {
  const tiers = resolveTiers(tokyo(), DEFAULT_TIER_FAMILIES, true);

  it('take the newest model with a jp/apac or on-demand route over a newer global-only one', () => {
    // Sonnet 5.5 and 5 have only global profiles in Tokyo; Sonnet 4.6 has jp.
    expect(tiers.standard?.invokeId).toBe('jp.anthropic.claude-sonnet-4-6');
    expect(tiers.light?.invokeId).toBe('jp.anthropic.claude-haiku-5-5');
    expect(tiers.heavy?.invokeId).toBe('jp.anthropic.claude-opus-5-5');
    expect(tiers.fallback?.invokeId).toBe('jp.amazon.nova-2-lite-v1:0');
    expect(tiers.voice?.invokeId).toBe('amazon.nova-2-5-sonic');
  });

  it('never pick a global model while the family has a bounded one', () => {
    const catalog = tokyo();
    for (const pattern of Object.values(DEFAULT_TIER_FAMILIES)) {
      const re = familyMatcher(pattern);
      const bounded = catalog.some((e) => e.lifecycleStatus === 'ACTIVE' && e.scope !== 'global' && re.test(e.baseModelId));
      const picked = resolveTiers(catalog, { ...DEFAULT_TIER_FAMILIES, light: pattern }, true).light;
      if (bounded && picked && re.test(picked.baseModelId)) expect(picked.scope, pattern).not.toBe('global');
    }
  });

  it('still resolve a family that only has global models', () => {
    const t = resolveTiers(tokyo(), { ...DEFAULT_TIER_FAMILIES, light: 'anthropic.claude-sonnet-5*', fallback: 'none' }, true);
    expect(t.light?.invokeId).toBe('global.anthropic.claude-sonnet-5-5');
  });

  it('replace a retired model with the bounded model of its family', () => {
    const r = resolveRequested(tokyo(), 'anthropic.claude-sonnet-4-5-20250929-v1:0', DEFAULT_TIER_FAMILIES, true);
    expect(r.invokeId).toBe('jp.anthropic.claude-sonnet-4-6');
    expect(resolveRequested(tokyo(), 'tier:standard', DEFAULT_TIER_FAMILIES, true).invokeId).toBe('jp.anthropic.claude-sonnet-4-6');
  });
});

describe('profiles', () => {
  it('prefer the fewest destination regions: jp before global', () => {
    const haiku = tokyo().find((e) => e.baseModelId === 'anthropic.claude-haiku-5-5')!;
    expect(haiku.invokeId).toBe('jp.anthropic.claude-haiku-5-5');
    expect(haiku.scope).toBe('geo');
    expect(haiku.destinationRegions).toEqual(['ap-northeast-1', 'ap-northeast-3']);
  });

  it('use global when it is the only profile, and say so', () => {
    const sonnet = tokyo().find((e) => e.baseModelId === 'anthropic.claude-sonnet-5-5')!;
    expect(sonnet.invokeId).toBe('global.anthropic.claude-sonnet-5-5');
    expect(sonnet.scope).toBe('global');
    expect(sonnet.destinationRegions).toBeNull();
  });

  it('call on-demand models in the region', () => {
    const qwen = tokyo().find((e) => e.baseModelId === 'qwen.qwen3-32b-v1:0')!;
    expect(qwen.invokeId).toBe('qwen.qwen3-32b-v1:0');
    expect(qwen.scope).toBe('in-region');
  });

  it('prefer global when configured, and keep the nearest where there is no global', () => {
    const catalog = tokyo('global');
    expect(catalog.find((e) => e.baseModelId === 'anthropic.claude-haiku-5-5')!.invokeId).toBe(
      'global.anthropic.claude-haiku-5-5',
    );
    expect(catalog.find((e) => e.baseModelId === 'qwen.qwen3-32b-v1:0')!.invokeId).toBe('qwen.qwen3-32b-v1:0');
  });

  it('never return an ID the region does not list', () => {
    const ids = new Set([...models.map((m) => m.modelId), ...profiles.map((p) => p.inferenceProfileId)]);
    for (const preference of ['nearest', 'global'] as const) {
      for (const e of tokyo(preference)) expect(ids.has(e.invokeId), e.invokeId).toBe(true);
    }
  });
});

describe('chat selector', () => {
  it('leaves out speech and rerank models', () => {
    const chat = tokyo().filter((e) => e.chat).map((e) => e.baseModelId);
    expect(chat).not.toContain('amazon.nova-2-5-sonic');
    expect(chat).not.toContain('amazon.nova-2-sonic-v1:0');
    expect(chat).not.toContain('cohere.rerank-v3-5:0');
    expect(chat).not.toContain('amazon.rerank-v1:0');
    expect(chat).toContain('anthropic.claude-sonnet-5-5');
  });
});

describe('availability', () => {
  it('treats agreement NOT_AVAILABLE as callable (observed: such models answer)', () => {
    expect(statusFromAvailability({ agreementStatus: 'NOT_AVAILABLE', authorizationStatus: 'AUTHORIZED' }).status).toBe('ready');
  });

  it('marks the documented blocking states', () => {
    expect(statusFromAvailability({ agreementStatus: 'PENDING' }).status).toBe('needs-request');
    expect(statusFromAvailability({ agreementStatus: 'ERROR' }).status).toBe('needs-request');
    expect(statusFromAvailability({ entitlementAvailability: 'NOT_AVAILABLE' }).status).toBe('needs-request');
    expect(statusFromAvailability({ authorizationStatus: 'NOT_AUTHORIZED' }).status).toBe('unavailable');
    expect(statusFromAvailability({ regionAvailability: 'NOT_AVAILABLE' }).status).toBe('unavailable');
  });
});

describe('resolving a request', () => {
  const catalog = tokyo();
  const resolve = (id?: string) => resolveRequested(catalog, id, DEFAULT_TIER_FAMILIES);

  it('maps a base ID to its profile', () => {
    expect(resolve('anthropic.claude-haiku-4-5-20251001-v1:0').invokeId).toBe('jp.anthropic.claude-haiku-4-5-20251001-v1:0');
  });

  it('honours an explicit profile choice', () => {
    expect(resolve('global.anthropic.claude-haiku-4-5-20251001-v1:0').invokeId).toBe(
      'global.anthropic.claude-haiku-4-5-20251001-v1:0',
    );
  });

  it('replaces a LEGACY model with the newest of its family', () => {
    const r = resolve('anthropic.claude-sonnet-4-5-20250929-v1:0');
    expect(r.invokeId).toBe('global.anthropic.claude-sonnet-5-5');
    expect(r.substitutedFor).toBe('anthropic.claude-sonnet-4-5-20250929-v1:0');
  });

  it('replaces an ID the region no longer lists, profile prefix included', () => {
    expect(resolve('apac.anthropic.claude-3-5-sonnet-20241022-v2:0').invokeId).toBe('global.anthropic.claude-sonnet-5-5');
    expect(resolve('amazon.nova-sonic-v1:0').invokeId).toBe('amazon.nova-2-5-sonic');
  });

  it('uses the standard tier when nothing is requested', () => {
    expect(resolve(undefined).invokeId).toBe('global.anthropic.claude-sonnet-5-5');
  });

  it('passes an unknown model of no family through, for Bedrock to reject', () => {
    expect(resolve('example.unknown-model').invokeId).toBe('example.unknown-model');
  });
});
