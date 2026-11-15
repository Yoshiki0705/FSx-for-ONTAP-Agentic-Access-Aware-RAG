'use client';

/**
 * `<option>`s for a model `<select>`, from the server's model catalog
 * (`/api/bedrock/agent-models`, see src/lib/model-catalog).
 *
 * First the tiers (`tier:light` / `tier:standard` / `tier:heavy`), which resolve to the
 * newest model of their family every time the agent runs, then the region's ACTIVE
 * models newest first. A model that needs a request is listed but disabled. Nothing here
 * names a model, so a release or a retirement needs no change to this file.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export interface CatalogOption {
  id: string;
  name: string;
  status?: 'ready' | 'needs-request' | 'unavailable';
  scope?: 'in-region' | 'geo' | 'global';
}

interface CatalogState {
  models: CatalogOption[];
  tiers: Record<string, string | null>;
}

let shared: Promise<CatalogState> | null = null;

/** Fetched once per page load and shared by every selector on the page. */
function loadCatalog(): Promise<CatalogState> {
  shared ??= Promise.all([
    fetch('/api/bedrock/agent-models').then((r) => (r.ok ? r.json() : null)),
    fetch('/api/bedrock/models').then((r) => (r.ok ? r.json() : null)),
  ])
    .then(([agents, models]) => ({
      models: (agents?.models ?? []) as CatalogOption[],
      tiers: (models?.data?.tiers ?? {}) as Record<string, string | null>,
    }))
    .catch(() => {
      shared = null;
      return { models: [], tiers: {} };
    });
  return shared;
}

export function useCatalogModels(): CatalogState {
  const [state, setState] = useState<CatalogState>({ models: [], tiers: {} });
  useEffect(() => {
    let alive = true;
    loadCatalog().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** The default for a new agent: the light tier. */
export const DEFAULT_AGENT_MODEL = 'tier:light';

const TIER_OPTIONS = ['light', 'standard', 'heavy'] as const;

export function CatalogModelOptions({ current }: { current?: string }) {
  const t = useTranslations('model.catalog');
  const { models, tiers } = useCatalogModels();
  const nameOf = (id: string | null | undefined) => models.find((m) => m.id === id)?.name ?? id ?? '';
  const known = new Set([...TIER_OPTIONS.map((x) => `tier:${x}`), ...models.map((m) => m.id)]);
  return (
    <>
      {TIER_OPTIONS.map((tier) => (
        <option key={tier} value={`tier:${tier}`}>
          {t(`tier.${tier}`)}
          {tiers[tier] ? ` (${nameOf(tiers[tier])})` : ''}
        </option>
      ))}
      {models.map((m) => (
        <option key={m.id} value={m.id} disabled={m.status && m.status !== 'ready'}>
          {m.name}
          {m.scope === 'global' ? ' [global]' : ''}
          {m.status === 'needs-request' ? ` (${t('needsRequest')})` : ''}
          {m.status === 'unavailable' ? ` (${t('notAuthorized')})` : ''}
        </option>
      ))}
      {/* A stored model the catalog no longer lists (retired): still shown so the form keeps its value. */}
      {current && !known.has(current) && (
        <option value={current}>
          {current} ({t('retired')})
        </option>
      )}
    </>
  );
}
