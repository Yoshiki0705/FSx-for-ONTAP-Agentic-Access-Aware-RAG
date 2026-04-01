/**
 * Property-based tests for i18n completeness
 *
 * Uses fast-check and Jest to verify that all translation keys
 * for imageUpload, kbSelector, and smartRouting namespaces
 * exist in all 8 locale files.
 *
 * Runs at least 10 iterations.
 */

import * as fc from 'fast-check';
import ja from '@/messages/ja.json';
import en from '@/messages/en.json';
import ko from '@/messages/ko.json';
import zhCN from '@/messages/zh-CN.json';
import zhTW from '@/messages/zh-TW.json';
import fr from '@/messages/fr.json';
import de from '@/messages/de.json';
import es from '@/messages/es.json';

// All 8 locale files with their names
const LOCALES: Record<string, Record<string, unknown>> = {
  ja,
  en,
  ko,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  fr,
  de,
  es,
};

const LOCALE_NAMES = Object.keys(LOCALES);

// Expected keys per namespace (from design doc)
const EXPECTED_IMAGE_UPLOAD_KEYS = [
  'dropzone',
  'selectFile',
  'preview',
  'remove',
  'uploadedImage',
  'invalidFormat',
  'fileTooLarge',
  'analyzing',
  'analysisUsed',
];

const EXPECTED_KB_SELECTOR_KEYS = [
  'title',
  'selectKB',
  'connected',
  'noKBConnected',
  'dataSources',
  'status',
  'loadError',
  'retry',
];

const EXPECTED_SMART_ROUTING_KEYS = [
  'title',
  'enabled',
  'disabled',
  'auto',
  'manual',
  'lightweight',
  'powerful',
  'simple',
  'complex',
  'confidence',
  'modelUsed',
  'autoRouted',
  'manualOverride',
];

// Helper: get a namespace object from a locale
function getNamespace(
  locale: Record<string, unknown>,
  ns: string
): Record<string, unknown> | undefined {
  return locale[ns] as Record<string, unknown> | undefined;
}

// Feature: advanced-rag-features, Property 34: Translation keys exist in all 8 locale files
// **Validates: Requirements 15.1, 15.2, 15.4**
describe('Property 34: Translation keys exist in all 8 locale files', () => {
  it('every expected imageUpload key exists in all 8 locales', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LOCALE_NAMES),
        fc.constantFrom(...EXPECTED_IMAGE_UPLOAD_KEYS),
        (localeName: string, key: string) => {
          const locale = LOCALES[localeName];
          const ns = getNamespace(locale, 'imageUpload');

          expect(ns).toBeDefined();
          expect(ns).toHaveProperty(key);

          // Value must be a non-empty string
          const value = (ns as Record<string, unknown>)[key];
          expect(typeof value).toBe('string');
          expect((value as string).length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('every expected kbSelector key exists in all 8 locales', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LOCALE_NAMES),
        fc.constantFrom(...EXPECTED_KB_SELECTOR_KEYS),
        (localeName: string, key: string) => {
          const locale = LOCALES[localeName];
          const ns = getNamespace(locale, 'kbSelector');

          expect(ns).toBeDefined();
          expect(ns).toHaveProperty(key);

          // Value must be a non-empty string or object (status is an object)
          const value = (ns as Record<string, unknown>)[key];
          if (key === 'status') {
            expect(typeof value).toBe('object');
            expect(value).not.toBeNull();
          } else {
            expect(typeof value).toBe('string');
            expect((value as string).length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('every expected smartRouting key exists in all 8 locales', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LOCALE_NAMES),
        fc.constantFrom(...EXPECTED_SMART_ROUTING_KEYS),
        (localeName: string, key: string) => {
          const locale = LOCALES[localeName];
          const ns = getNamespace(locale, 'smartRouting');

          expect(ns).toBeDefined();
          expect(ns).toHaveProperty(key);

          // Value must be a non-empty string
          const value = (ns as Record<string, unknown>)[key];
          expect(typeof value).toBe('string');
          expect((value as string).length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('all 3 namespaces exist in every randomly selected locale', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LOCALE_NAMES),
        (localeName: string) => {
          const locale = LOCALES[localeName];

          // All 3 namespaces must exist
          expect(locale).toHaveProperty('imageUpload');
          expect(locale).toHaveProperty('kbSelector');
          expect(locale).toHaveProperty('smartRouting');

          const imageUpload = getNamespace(locale, 'imageUpload')!;
          const kbSelector = getNamespace(locale, 'kbSelector')!;
          const smartRouting = getNamespace(locale, 'smartRouting')!;

          // Verify all expected keys exist in each namespace
          for (const key of EXPECTED_IMAGE_UPLOAD_KEYS) {
            expect(imageUpload).toHaveProperty(key);
          }
          for (const key of EXPECTED_KB_SELECTOR_KEYS) {
            expect(kbSelector).toHaveProperty(key);
          }
          for (const key of EXPECTED_SMART_ROUTING_KEYS) {
            expect(smartRouting).toHaveProperty(key);
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
