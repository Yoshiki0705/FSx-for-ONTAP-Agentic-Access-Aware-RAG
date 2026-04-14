/**
 * Property 5: 無音検出による自動録音停止
 * 任意の音声ストリームにおいて、連続する振幅がすべて無音閾値以下の場合、
 * isSilent が true を返すことを検証。
 *
 * **Validates: Requirements 13.1**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isSilent } from '@/types/voice';

describe('Property 5: Silence Detection', () => {
  const THRESHOLD = 0.01;
  const FROUND_THRESHOLD = Math.fround(THRESHOLD);
  const NEG_FROUND_THRESHOLD = Math.fround(-THRESHOLD);

  it('all-silent amplitudes should be detected as silent', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: NEG_FROUND_THRESHOLD, max: FROUND_THRESHOLD, noNaN: true }), { minLength: 1, maxLength: 1000 }),
        (amplitudes: number[]) => {
          expect(isSilent(amplitudes, THRESHOLD)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('amplitudes with at least one value above threshold should not be silent', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: NEG_FROUND_THRESHOLD, max: FROUND_THRESHOLD, noNaN: true }), { minLength: 0, maxLength: 100 }),
        fc.float({ min: Math.fround(THRESHOLD + 0.002), max: Math.fround(1.0), noNaN: true }),
        fc.array(fc.float({ min: NEG_FROUND_THRESHOLD, max: FROUND_THRESHOLD, noNaN: true }), { minLength: 0, maxLength: 100 }),
        (before: number[], loud: number, after: number[]) => {
          const amplitudes = [...before, loud, ...after];
          expect(isSilent(amplitudes, THRESHOLD)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('empty amplitudes array should be considered silent', () => {
    expect(isSilent([], THRESHOLD)).toBe(true);
  });

  it('zero amplitudes should always be silent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        (length: number) => {
          const amplitudes = new Array(length).fill(0);
          expect(isSilent(amplitudes, THRESHOLD)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
