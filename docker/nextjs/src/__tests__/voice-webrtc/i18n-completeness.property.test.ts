/**
 * Property 9: i18n 翻訳キーの完全性
 * 任意の WebRTC 固有翻訳キーに対して 8 言語すべてに非空の翻訳値が存在することを検証。
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import en from '@/messages/en.json';
import ja from '@/messages/ja.json';
import ko from '@/messages/ko.json';
import zhCN from '@/messages/zh-CN.json';
import zhTW from '@/messages/zh-TW.json';
import fr from '@/messages/fr.json';
import de from '@/messages/de.json';
import es from '@/messages/es.json';

const LOCALES = { en, ja, ko, 'zh-CN': zhCN, 'zh-TW': zhTW, fr, de, es };
const LOCALE_NAMES = Object.keys(LOCALES) as Array<keyof typeof LOCALES>;

const WEBRTC_KEYS = [
  'connecting',
  'connected',
  'disconnected',
  'fallbackNotice',
  'fallbackReason',
  'qualityWarning',
  'modeSwitch',
  'modeWebrtc',
  'modeRest',
  'reconnecting',
  'manualReconnect',
  'silenceTimeout',
  'turnRelay',
] as const;

function getWebRTCTranslation(locale: Record<string, any>, key: string): string | undefined {
  return locale?.chat?.voice?.webrtc?.[key];
}

describe('Property 9: i18n translation key completeness', () => {
  it('all WebRTC keys should exist in all 8 locales with non-empty values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...WEBRTC_KEYS),
        fc.constantFrom(...LOCALE_NAMES),
        (key, localeName) => {
          const locale = LOCALES[localeName];
          const value = getWebRTCTranslation(locale, key);

          // Value must exist and be non-empty
          expect(value).toBeDefined();
          expect(typeof value).toBe('string');
          expect((value as string).length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('all 8 locales should have the complete set of WebRTC keys', () => {
    for (const localeName of LOCALE_NAMES) {
      const locale = LOCALES[localeName];
      for (const key of WEBRTC_KEYS) {
        const value = getWebRTCTranslation(locale, key);
        expect(value, `Missing key "${key}" in locale "${localeName}"`).toBeDefined();
        expect(typeof value).toBe('string');
        expect((value as string).trim().length, `Empty value for "${key}" in "${localeName}"`).toBeGreaterThan(0);
      }
    }
  });
});
