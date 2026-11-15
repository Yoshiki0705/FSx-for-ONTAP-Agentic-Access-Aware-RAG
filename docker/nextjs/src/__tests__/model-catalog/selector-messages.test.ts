/**
 * Every message key the model selectors use exists in each locale the app loads.
 *
 * The app loads `src/messages/<locale>.json` (src/i18n/request.ts). `docker/nextjs/messages/`
 * is an older copy that nothing loads at run time; keys added only there showed up on the
 * deployed screen as the raw key (`model.selector.scopeGlobal`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');
const LOCALES = ['ja', 'en', 'ko', 'zh-CN', 'zh-TW', 'fr', 'de', 'es'];
const COMPONENTS: Array<[string, string]> = [
  ['components/bedrock/ModelSelector.tsx', 'model.selector'],
  ['components/bedrock/AvailableModelsList.tsx', 'model.selector'],
  ['components/bedrock/UnavailableModelsList.tsx', 'model.selector'],
  ['components/model/CatalogModelOptions.tsx', 'model.catalog'],
];

function keysUsed(file: string): string[] {
  const src = readFileSync(join(SRC, file), 'utf8');
  const literal = [...src.matchAll(/\bt\('([A-Za-z.]+)'\)/g)].map((m) => m[1]);
  // `t(\`tier.${tier}\`)` in CatalogModelOptions
  const tiers = /t\(`tier\.\$\{tier\}`\)/.test(src) ? ['tier.light', 'tier.standard', 'tier.heavy'] : [];
  return [...new Set([...literal, ...tiers])];
}

function lookup(messages: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), messages);
}

describe('model selector messages', () => {
  for (const [file, ns] of COMPONENTS) {
    it(`${file} has every key in every locale`, () => {
      const keys = keysUsed(file);
      expect(keys.length).toBeGreaterThan(0);
      for (const locale of LOCALES) {
        const messages = JSON.parse(readFileSync(join(SRC, 'messages', `${locale}.json`), 'utf8'));
        const missing = keys.filter((k) => typeof lookup(messages, `${ns}.${k}`) !== 'string');
        expect(missing, `${locale}: ${ns}`).toEqual([]);
      }
    });
  }
});
