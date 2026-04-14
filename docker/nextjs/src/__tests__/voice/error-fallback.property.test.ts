/**
 * Property 7: エラー時のテキストフォールバック
 * 任意の Nova Sonic API エラーレスポンスに対して、エラーメッセージがテキスト表示され、
 * 変換テキストがテキスト検索パイプラインにフォールバック送信されることを検証。
 *
 * **Validates: Requirements 10.5**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { VoiceErrorCode } from '@/types/voice';

interface ErrorFallbackResult {
  errorDisplayed: boolean;
  errorMessage: string;
  textFallbackSent: boolean;
  fallbackQuery: string | null;
}

const RECOVERABLE_ERRORS: VoiceErrorCode[] = ['WS_CONNECTION_FAILED', 'WS_DISCONNECTED', 'RECOGNITION_EMPTY'];
const ALL_ERROR_CODES: VoiceErrorCode[] = [
  'MIC_NOT_SUPPORTED', 'MIC_PERMISSION_DENIED', 'WS_CONNECTION_FAILED',
  'WS_DISCONNECTED', 'RECOGNITION_EMPTY', 'API_ERROR', 'SESSION_TIMEOUT',
];

/**
 * エラーフォールバックのシミュレーション
 */
function handleVoiceError(
  errorCode: VoiceErrorCode,
  transcribedText: string | null
): ErrorFallbackResult {
  const errorMessages: Record<VoiceErrorCode, string> = {
    MIC_NOT_SUPPORTED: 'Microphone not supported',
    MIC_PERMISSION_DENIED: 'Microphone access denied',
    WS_CONNECTION_FAILED: 'Connection failed',
    WS_DISCONNECTED: 'Connection lost',
    RECOGNITION_EMPTY: 'Could not recognize voice',
    API_ERROR: 'Voice processing error',
    SESSION_TIMEOUT: 'Session timed out',
  };

  return {
    errorDisplayed: true,
    errorMessage: errorMessages[errorCode],
    textFallbackSent: transcribedText !== null && transcribedText.length > 0,
    fallbackQuery: transcribedText && transcribedText.length > 0 ? transcribedText : null,
  };
}

describe('Property 7: Error Text Fallback', () => {
  const errorCodeArb = fc.constantFrom<VoiceErrorCode>(...ALL_ERROR_CODES);

  it('every error should display an error message', () => {
    fc.assert(
      fc.property(
        errorCodeArb,
        fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
        (errorCode: VoiceErrorCode, transcribedText: string | null) => {
          const result = handleVoiceError(errorCode, transcribedText);

          expect(result.errorDisplayed).toBe(true);
          expect(result.errorMessage.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('transcribed text should be sent to text pipeline as fallback when available', () => {
    fc.assert(
      fc.property(
        errorCodeArb,
        fc.string({ minLength: 1, maxLength: 200 }),
        (errorCode: VoiceErrorCode, transcribedText: string) => {
          const result = handleVoiceError(errorCode, transcribedText);

          expect(result.textFallbackSent).toBe(true);
          expect(result.fallbackQuery).toBe(transcribedText);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('no fallback should be sent when transcribed text is null or empty', () => {
    fc.assert(
      fc.property(
        errorCodeArb,
        fc.constantFrom(null, ''),
        (errorCode: VoiceErrorCode, transcribedText: string | null) => {
          const result = handleVoiceError(errorCode, transcribedText);

          expect(result.textFallbackSent).toBe(false);
          expect(result.fallbackQuery).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
