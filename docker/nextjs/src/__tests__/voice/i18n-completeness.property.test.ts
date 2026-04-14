/**
 * Property 4: i18n 翻訳キーの完全性
 * 任意の音声チャット関連翻訳キーに対して、8 言語すべてのロケールファイルに
 * 非空の翻訳値が存在することを検証。
 *
 * **Validates: Requirements 9.1**
 */
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

const LOCALES = { ja, en, ko, 'zh-CN': zhCN, 'zh-TW': zhTW, fr, de, es } as Record<string, any>;
const LOCALE_NAMES = Object.keys(LOCALES);

const VOICE_KEYS = [
  'startRecording', 'stopRecording', 'recording', 'processing',
  'playback', 'pause', 'resume', 'stop', 'volumeControl',
  'waveformInput', 'waveformOutput', 'micPermissionDenied',
  'connectionFailed', 'recognitionFailed', 'apiError', 'noResults',
  'fallbackToText', 'shortcut', 'silenceTimeout',
];

describe('Property 4: i18n Translation Key Completeness', () => {
  it('every voice key should exist in all 8 locales with non-empty values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VOICE_KEYS),
        fc.constantFrom(...LOCALE_NAMES),
        (key: string, locale: string) => {
          const messages = LOCALES[locale];
          const voiceSection = messages?.chat?.voice;

          expect(voiceSection).toBeDefined();
          expect(voiceSection[key]).toBeDefined();
          expect(typeof voiceSection[key]).toBe('string');
          expect(voiceSection[key].length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('all 8 locales should have the same set of voice keys', () => {
    const referenceKeys = Object.keys(LOCALES['en'].chat.voice).sort();

    for (const locale of LOCALE_NAMES) {
      const localeKeys = Object.keys(LOCALES[locale].chat.voice).sort();
      expect(localeKeys).toEqual(referenceKeys);
    }
  });

  it('no voice translation value should be empty string', () => {
    for (const locale of LOCALE_NAMES) {
      const voiceSection = LOCALES[locale].chat.voice;
      for (const key of VOICE_KEYS) {
        expect(voiceSection[key], `${locale}.chat.voice.${key} should not be empty`).toBeTruthy();
      }
    }
  });
});
