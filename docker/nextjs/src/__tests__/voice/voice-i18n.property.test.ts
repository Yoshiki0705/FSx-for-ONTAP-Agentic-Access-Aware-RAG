/**
 * Voice Chat i18n Property Test
 *
 * Property 4: All chat.voice.* keys exist in 8 locales with non-empty values
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

const LOCALES: Record<string, any> = { ja, en, ko, 'zh-CN': zhCN, 'zh-TW': zhTW, fr, de, es };
const LOCALE_NAMES = Object.keys(LOCALES);

const VOICE_KEYS = [
  'startRecording', 'stopRecording', 'recording', 'processing',
  'playback', 'pause', 'resume', 'stop', 'volumeControl',
  'waveformInput', 'waveformOutput', 'micPermissionDenied',
  'connectionFailed', 'recognitionFailed', 'apiError', 'noResults',
  'fallbackToText', 'shortcut', 'silenceTimeout',
];

describe('Property 4: Voice i18n key completeness', () => {
  it('every chat.voice key exists in all 8 locales with non-empty string value', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VOICE_KEYS),
        fc.constantFrom(...LOCALE_NAMES),
        (key: string, locale: string) => {
          const voiceSection = LOCALES[locale]?.chat?.voice;
          expect(voiceSection).toBeDefined();
          expect(voiceSection[key]).toBeDefined();
          expect(typeof voiceSection[key]).toBe('string');
          expect(voiceSection[key].length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('all 8 locales have the same set of voice keys', () => {
    const referenceKeys = Object.keys(LOCALES['en'].chat.voice).sort();
    for (const locale of LOCALE_NAMES) {
      const localeKeys = Object.keys(LOCALES[locale].chat.voice).sort();
      expect(localeKeys).toEqual(referenceKeys);
    }
  });
});
