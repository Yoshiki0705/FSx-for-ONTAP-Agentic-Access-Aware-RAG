/**
 * Property-Based Test: i18n 翻訳キー完全性 (P7)
 *
 * Feature: multimodal-rag-search, Property 7: i18n 翻訳キー完全性
 *
 * For any multimodal translation key (`chat.multimodal.*` namespace)
 * and for any supported locale (ja, en, zh-CN, zh-TW, ko, fr, de, es),
 * the translation resolves to a non-empty string.
 *
 * **Validates: Requirements 10.1**
 */

import * as fc from 'fast-check';

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

const MULTIMODAL_KEYS = [
  'chat.multimodal.mediaText',
  'chat.multimodal.mediaImage',
  'chat.multimodal.mediaVideo',
  'chat.multimodal.mediaAudio',
  'chat.multimodal.filterAll',
  'chat.multimodal.filterText',
  'chat.multimodal.filterImage',
  'chat.multimodal.filterVideo',
  'chat.multimodal.filterAudio',
  'chat.multimodal.similaritySearch',
  'chat.multimodal.visionAnalysis',
  'chat.multimodal.embeddingModel',
  'chat.multimodal.multimodalBadge',
  'chat.multimodal.textOnlyBadge',
  'chat.multimodal.supportedTypes',
  'chat.multimodal.cdkRedeployNote',
  'chat.multimodal.dualKbText',
  'chat.multimodal.dualKbMultimodal',
  'chat.multimodal.fallbackMessage',
  'chat.multimodal.noAccessibleResults',
  'chat.multimodal.imageSearchFailed',
  'chat.multimodal.imageSearchFallback',
] as const;
type MultimodalKey = (typeof MULTIMODAL_KEYS)[number];

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

describe('Feature: multimodal-rag-search, Property 7: i18n 翻訳キー完全性', () => {
  it('chat.multimodal.* の全キーが 8 ロケール全てに空でない値で存在する', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...MULTIMODAL_KEYS),
        fc.constantFrom(...SUPPORTED_LOCALES),
        (key: MultimodalKey, locale: Locale) => {
          const messages = messagesMap[locale];
          const value = resolveKey(messages, key);

          // Value must exist
          expect(value).toBeDefined();
          // Value must be a string
          expect(typeof value).toBe('string');
          // Value must be non-empty
          expect((value as string).length).toBeGreaterThan(0);
          // Value must not be whitespace-only
          expect((value as string).trim().length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});
