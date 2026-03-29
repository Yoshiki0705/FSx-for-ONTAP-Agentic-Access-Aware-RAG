/**
 * Property test for translation key completeness
 * Feature: agent-directory-ui, Property 13: Translation keys exist in all locale files
 * Validates: Requirements 8.2
 */

import * as fc from 'fast-check';
import { locales } from '@/i18n/config';

// Load all locale message files
const messagesByLocale: Record<string, any> = {};
for (const locale of locales) {
  try {
    // Use relative path from test file location to messages directory
    messagesByLocale[locale] = require(`../../../messages/${locale}.json`);
  } catch {
    // Will be caught by tests
    messagesByLocale[locale] = null;
  }
}

// Expected agentDirectory keys (flat + nested)
const EXPECTED_FLAT_KEYS = [
  'title', 'searchPlaceholder', 'categoryAll', 'noAgentsFound',
  'createFromTemplate', 'templateSection', 'confirmCreate', 'confirmDelete',
  'useInChat', 'editAgent', 'deleteAgent', 'agentDetail',
  'systemPrompt', 'actionGroups', 'createdAt', 'updatedAt',
  'version', 'model', 'status', 'saving', 'creating', 'deleting',
  'saveSuccess', 'createSuccess', 'deleteSuccess',
  'saveError', 'createError', 'deleteError', 'loadError',
  'retry', 'nameRequired', 'close', 'cancel', 'save',
];

const EXPECTED_PROGRESS_KEYS = ['creating', 'preparing', 'creatingAlias', 'completed'];
const EXPECTED_NAV_KEYS = ['cards', 'agents', 'chat'];
const EXPECTED_STATUS_KEYS = [
  'PREPARED', 'CREATING', 'PREPARING', 'FAILED',
  'NOT_PREPARED', 'DELETING', 'VERSIONING', 'UPDATING',
];

/**
 * Helper: get nested value from object by dot-separated path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

// --- Property 13: Translation keys exist in all locale files ---

describe('Feature: agent-directory-ui, Property 13: Translation keys exist in all locale files', () => {
  it('agentDirectory namespace exists in all 8 locale files', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...(locales as unknown as string[])),
        (locale) => {
          const messages = messagesByLocale[locale];
          expect(messages).not.toBeNull();
          expect(messages.agentDirectory).toBeDefined();
          expect(typeof messages.agentDirectory).toBe('object');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all flat keys exist in every locale', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...(locales as unknown as string[])),
        fc.constantFrom(...EXPECTED_FLAT_KEYS),
        (locale, key) => {
          const messages = messagesByLocale[locale];
          const value = messages?.agentDirectory?.[key];
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('all progress keys exist in every locale', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...(locales as unknown as string[])),
        fc.constantFrom(...EXPECTED_PROGRESS_KEYS),
        (locale, key) => {
          const value = messagesByLocale[locale]?.agentDirectory?.progress?.[key];
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all nav keys exist in every locale', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...(locales as unknown as string[])),
        fc.constantFrom(...EXPECTED_NAV_KEYS),
        (locale, key) => {
          const value = messagesByLocale[locale]?.agentDirectory?.nav?.[key];
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all statusLabels keys exist in every locale', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...(locales as unknown as string[])),
        fc.constantFrom(...EXPECTED_STATUS_KEYS),
        (locale, key) => {
          const value = messagesByLocale[locale]?.agentDirectory?.statusLabels?.[key];
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('key count is consistent across all locales', () => {
    const referenceLang = 'en';
    const referenceKeys = Object.keys(messagesByLocale[referenceLang]?.agentDirectory || {});

    fc.assert(
      fc.property(
        fc.constantFrom(...(locales as unknown as string[])),
        (locale) => {
          const keys = Object.keys(messagesByLocale[locale]?.agentDirectory || {});
          expect(keys.length).toBe(referenceKeys.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
