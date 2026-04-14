// Feature: agent-registry-integration, Property 7: i18n Translation Completeness
// Validates: Requirements 9.1, 11.7

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import ja from '@/messages/ja.json';
import en from '@/messages/en.json';
import ko from '@/messages/ko.json';
import zhCN from '@/messages/zh-CN.json';
import zhTW from '@/messages/zh-TW.json';
import fr from '@/messages/fr.json';
import de from '@/messages/de.json';
import es from '@/messages/es.json';

const LOCALES: Record<string, any> = { ja, en, ko, 'zh-CN': zhCN, 'zh-TW': zhTW, fr, de, es };

// Get all registry keys from the Japanese locale (source of truth)
const REGISTRY_KEYS = Object.keys(
  (ja as any).agentDirectory?.registry ?? {}
);

describe('Property 7: i18n Translation Completeness', () => {
  it('all registry keys exist in all 8 locales with non-empty values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(LOCALES)),
        fc.constantFrom(...REGISTRY_KEYS),
        (locale, key) => {
          const messages = LOCALES[locale];
          const value = messages?.agentDirectory?.registry?.[key];
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('has at least 10 registry translation keys', () => {
    expect(REGISTRY_KEYS.length).toBeGreaterThanOrEqual(10);
  });
});
