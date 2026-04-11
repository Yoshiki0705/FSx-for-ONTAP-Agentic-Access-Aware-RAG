/**
 * i18n Smoke Test: 全8言語ファイルの翻訳キー存在検証
 *
 * Feature: ui-ux-optimization
 *
 * 全8言語（ja, en, de, es, fr, ko, zh-CN, zh-TW）のメッセージファイルに
 * 新規UIコンポーネントで必要な翻訳キーが存在し、非空文字列であることを検証する。
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 */

import ja from '../../messages/ja.json';
import en from '../../messages/en.json';
import de from '../../messages/de.json';
import es from '../../messages/es.json';
import fr from '../../messages/fr.json';
import ko from '../../messages/ko.json';
import zhCN from '../../messages/zh-CN.json';
import zhTW from '../../messages/zh-TW.json';

const locales: Record<string, Record<string, unknown>> = {
  ja,
  en,
  de,
  es,
  fr,
  ko,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
};

/** Required translation keys grouped by component */
const requiredKeys: Record<string, string[]> = {
  modeToggle: ['kb', 'singleAgent', 'multiAgent', 'label'],
  agentSelector: ['placeholder', 'label', 'noAgents'],
  overflowMenu: ['label'],
  userMenu: ['agentDirectory', 'signOut'],
  modelIndicator: ['label', 'fallbackNotice'],
};

/**
 * Safely access a nested value from a JSON object.
 */
function getNestedValue(obj: Record<string, unknown>, section: string, key: string): unknown {
  const sectionObj = obj[section];
  if (sectionObj && typeof sectionObj === 'object' && !Array.isArray(sectionObj)) {
    return (sectionObj as Record<string, unknown>)[key];
  }
  return undefined;
}

describe('i18n smoke test: 全8言語の翻訳キー存在検証', () => {
  const localeNames = Object.keys(locales);

  it('should have all 8 locale files loaded', () => {
    expect(localeNames).toHaveLength(8);
    expect(localeNames).toEqual(
      expect.arrayContaining(['ja', 'en', 'de', 'es', 'fr', 'ko', 'zh-CN', 'zh-TW'])
    );
  });

  describe.each(localeNames)('locale: %s', (locale) => {
    const messages = locales[locale];

    for (const [section, keys] of Object.entries(requiredKeys)) {
      describe(`${section}`, () => {
        it.each(keys)(`should have non-empty "%s" key`, (key) => {
          const value = getNestedValue(messages, section, key);
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect((value as string).length).toBeGreaterThan(0);
        });
      });
    }
  });
});
