/**
 * Property-Based Test: 翻訳キー完全性 (P2)
 *
 * Feature: sidebar-workflow-agent-redesign, Property 2: translation key completeness
 *
 * For any new translation key (`sidebar.systemSettings`, `sidebar.workflow`)
 * and for any supported locale (ja, en, zh-CN, zh-TW, ko, fr, de, es),
 * the translation resolves to a non-empty string.
 *
 * **Validates: Requirements 1.6, 3.5**
 */

import * as fc from 'fast-check';

// Import actual translation JSON files for all 8 locales
import ja from '../../messages/ja.json';
import en from '../../messages/en.json';
import zhCN from '../../messages/zh-CN.json';
import zhTW from '../../messages/zh-TW.json';
import ko from '../../messages/ko.json';
import fr from '../../messages/fr.json';
import de from '../../messages/de.json';
import es from '../../messages/es.json';

const SUPPORTED_LOCALES = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'fr', 'de', 'es'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const SIDEBAR_KEYS = ['sidebar.systemSettings', 'sidebar.workflow'] as const;
type SidebarKey = (typeof SIDEBAR_KEYS)[number];

const messagesMap: Record<Locale, Record<string, unknown>> = {
  ja,
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ko,
  fr,
  de,
  es,
};

/**
 * Resolve a dot-separated key from a nested JSON object.
 */
function resolveKey(messages: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = messages;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

describe('Feature: sidebar-workflow-agent-redesign, Property 2: translation key completeness', () => {
  it('全新規翻訳キー × 全8ロケールで翻訳が空でない文字列に解決される', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SIDEBAR_KEYS),
        fc.constantFrom(...SUPPORTED_LOCALES),
        (key: SidebarKey, locale: Locale) => {
          const messages = messagesMap[locale];
          const value = resolveKey(messages, key);

          // Value must be a string
          expect(typeof value).toBe('string');
          // Value must be non-empty
          expect((value as string).length).toBeGreaterThan(0);
          // Value must not be whitespace-only
          expect((value as string).trim().length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
