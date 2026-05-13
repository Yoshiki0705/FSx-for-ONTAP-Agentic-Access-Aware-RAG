/**
 * Property 1: voiceChatMode パラメータバリデーション
 * 任意の文字列値に対して、voiceChatMode パラメータのバリデーション関数は
 * "rest" と "webrtc" のみを有効値として受け入れる。
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { VoiceChatMode } from '@/types/voice';

function validateVoiceChatMode(value: string): { valid: boolean; mode: VoiceChatMode } {
  const validModes: VoiceChatMode[] = ['rest', 'webrtc'];
  if (validModes.includes(value as VoiceChatMode)) {
    return { valid: true, mode: value as VoiceChatMode };
  }
  return { valid: false, mode: 'rest' }; // default fallback
}

describe('Property 1: voiceChatMode parameter validation', () => {
  it('should accept only "rest" and "webrtc" as valid values', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (input) => {
        const result = validateVoiceChatMode(input);
        if (input === 'rest' || input === 'webrtc') {
          expect(result.valid).toBe(true);
          expect(result.mode).toBe(input);
        } else {
          expect(result.valid).toBe(false);
          expect(result.mode).toBe('rest'); // default
        }
      }),
      { numRuns: 200 }
    );
  });

  it('should always return "rest" as default for empty/undefined input', () => {
    const result = validateVoiceChatMode('');
    expect(result.valid).toBe(false);
    expect(result.mode).toBe('rest');
  });
});
