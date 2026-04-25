import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Property-Based Test: テキスト省略の正確性 (Property 2)
 *
 * Feature: ui-ux-optimization, Property 2: テキスト省略の正確性
 *
 * 任意の文字列と任意の正の最大長 maxLength に対して、truncateText(text, maxLength) の結果は:
 * - 結果の文字数が maxLength + 3 以下（"..." の3文字を含む）
 * - 元の文字列が maxLength 以下なら結果は元の文字列と同一
 * - 元の文字列が maxLength を超える場合、結果は text.slice(0, maxLength) + "..."
 *
 * **Validates: Requirements 5.1, 8.5**
 */

import * as fc from 'fast-check';
import { truncateText } from '../../utils/truncateText';

// Feature: ui-ux-optimization, Property 2: テキスト省略の正確性
describe('Feature: ui-ux-optimization, Property 2: テキスト省略の正確性', () => {
  it('結果の文字数が常に maxLength + 3 以下である', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: 1, max: 100 }),
        (text: string, maxLength: number) => {
          const result = truncateText(text, maxLength);
          expect(result.length).toBeLessThanOrEqual(maxLength + 3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('元の文字列が maxLength 以下の場合、結果は元の文字列と同一', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: 1, max: 100 }),
        (text: string, maxLength: number) => {
          fc.pre(text.length <= maxLength);
          const result = truncateText(text, maxLength);
          expect(result).toBe(text);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('元の文字列が maxLength を超える場合、結果は text.slice(0, maxLength) + "..."', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: 1, max: 100 }),
        (text: string, maxLength: number) => {
          fc.pre(text.length > maxLength);
          const result = truncateText(text, maxLength);
          expect(result).toBe(text.slice(0, maxLength) + '...');
        }
      ),
      { numRuns: 100 }
    );
  });
});
