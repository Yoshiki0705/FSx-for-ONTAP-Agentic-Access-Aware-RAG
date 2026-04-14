/**
 * Feature: episodic-memory, Property 9: i18n 完全性
 *
 * 任意の 8 言語ロケール（ja, en, ko, zh-CN, zh-TW, fr, de, es）に対して、
 * agentcore.episodes 名前空間の全翻訳キーが存在し空文字列でない値を持つ。
 *
 * **Validates: Requirements 10.1**
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import ja from '../../messages/ja.json';
import en from '../../messages/en.json';
import ko from '../../messages/ko.json';
import zhCN from '../../messages/zh-CN.json';
import zhTW from '../../messages/zh-TW.json';
import fr from '../../messages/fr.json';
import de from '../../messages/de.json';
import es from '../../messages/es.json';

const SUPPORTED_LOCALES = ['ja', 'en', 'ko', 'zh-CN', 'zh-TW', 'fr', 'de', 'es'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const EPISODE_KEYS = [
  'agentcore.episodes.tab',
  'agentcore.episodes.search',
  'agentcore.episodes.noEpisodes',
  'agentcore.episodes.noResults',
  'agentcore.episodes.goal',
  'agentcore.episodes.steps',
  'agentcore.episodes.actions',
  'agentcore.episodes.outcome',
  'agentcore.episodes.reflection',
  'agentcore.episodes.statusSuccess',
  'agentcore.episodes.statusPartial',
  'agentcore.episodes.statusFailure',
  'agentcore.episodes.deleteConfirm',
  'agentcore.episodes.deleteError',
  'agentcore.episodes.fetchError',
  'agentcore.episodes.referenceBadge',
  'agentcore.episodes.stepCount',
  'agentcore.episodes.refreshButton',
] as const;

const messagesMap: Record<Locale, Record<string, unknown>> = {
  ja,
  en,
  ko,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
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

describe('Feature: episodic-memory, Property 9: i18n 完全性', () => {
  it('全 8 ロケール × 全エピソードキーで翻訳が空でない文字列に解決される', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SUPPORTED_LOCALES),
        fc.constantFrom(...EPISODE_KEYS),
        (locale, key) => {
          const messages = messagesMap[locale];
          const value = resolveKey(messages, key);

          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect((value as string).length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});
