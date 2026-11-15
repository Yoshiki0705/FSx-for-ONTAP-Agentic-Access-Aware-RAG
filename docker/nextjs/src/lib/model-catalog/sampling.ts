/**
 * Sampling parameters (temperature, top_p, top_k) that a model accepts, learned from the
 * model's own error, not from a table.
 *
 * Models now change without a code change (see ./index.ts), and newer models reject
 * parameters older ones took. Observed 2026-11-15 in ap-northeast-1:
 *   - Claude Haiku 5.5: "`temperature` is deprecated for this model."
 *   - Claude Sonnet 4.6: "`temperature` and `top_p` cannot both be specified for this
 *     model. Please use only one."
 * A per-model list of what each accepts would be one more thing to maintain by hand. So a
 * call that the model rejects for a named sampling parameter is retried once without it,
 * and the omission is remembered for that model for the life of the process.
 */

export interface Sampling {
  temperature?: number;
  topP?: number;
  topK?: number;
}

type Key = keyof Sampling;

const NAMES: Record<string, Key> = {
  temperature: 'temperature',
  top_p: 'topP',
  topp: 'topP',
  top_k: 'topK',
  topk: 'topK',
};

const omitted = new Map<string, Set<Key>>();

/** For tests. */
export function resetSamplingMemory(): void {
  omitted.clear();
}

/** `s` without the parameters `modelId` is known to reject. */
export function samplingFor(modelId: string, s: Sampling): Sampling {
  const drop = omitted.get(modelId);
  if (!drop) return { ...s };
  const out: Sampling = {};
  for (const [k, v] of Object.entries(s) as [Key, number | undefined][]) {
    if (!drop.has(k) && v !== undefined) out[k] = v;
  }
  return out;
}

/** The parameters an error says the model rejects, or [] when it says nothing about them. */
export function rejectedBy(error: unknown): Key[] {
  const e = error as { name?: string; message?: string } | undefined;
  const message = e?.message ?? '';
  if (e?.name !== 'ValidationException' && !/ValidationException/.test(message)) return [];
  const named = [...message.matchAll(/`([A-Za-z_]+)`/g)]
    .map((m) => NAMES[m[1].toLowerCase()])
    .filter((k): k is Key => Boolean(k));
  if (named.length === 0) return [];
  // "cannot both be specified ... use only one": keep temperature, drop the others.
  if (/cannot both be specified|only one/i.test(message)) {
    return named.filter((k) => k !== 'temperature');
  }
  if (/deprecated|not supported|unsupported|no longer|not allowed|not permitted|is not valid|invalid/i.test(message)) {
    return named;
  }
  return [];
}

/** Records what `error` says `modelId` rejects. True when something new was learned. */
export function learnFromError(modelId: string, error: unknown): boolean {
  const keys = rejectedBy(error);
  if (keys.length === 0) return false;
  const set = omitted.get(modelId) ?? new Set<Key>();
  const before = set.size;
  keys.forEach((k) => set.add(k));
  omitted.set(modelId, set);
  return set.size > before;
}

/**
 * Calls `call` with the sampling `modelId` accepts. When the model rejects a named
 * parameter, retries without it (at most once per parameter). Other errors pass through.
 */
export async function withSampling<T>(
  modelId: string,
  sampling: Sampling,
  call: (s: Sampling) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await call(samplingFor(modelId, sampling));
    } catch (error) {
      if (!learnFromError(modelId, error)) throw error;
      console.warn(`[Sampling] ${modelId} rejected ${rejectedBy(error).join(', ')}; retrying without it`);
    }
  }
  return call(samplingFor(modelId, sampling));
}

/** The Anthropic Messages body fields for `s` (`top_p`, `top_k`). */
export function messagesSampling(s: Sampling): Record<string, number> {
  const out: Record<string, number> = {};
  if (s.temperature !== undefined) out.temperature = s.temperature;
  if (s.topP !== undefined) out.top_p = s.topP;
  if (s.topK !== undefined) out.top_k = s.topK;
  return out;
}
