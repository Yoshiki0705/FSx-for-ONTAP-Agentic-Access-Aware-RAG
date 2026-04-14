/**
 * Feature: multimodal-rag-search, Property 9: Registry 次元数ルックアップ
 *
 * 任意の有効なモデルキーに対して、EmbeddingModelRegistry.resolve() が返す
 * dimensions 値は、そのモデルの Bedrock API 仕様で定義された正しい次元数と一致する。
 *
 * **Validates: Requirements 2.4**
 */

import * as fc from 'fast-check';
import { EmbeddingModelRegistry } from '../../lib/config/embedding-model-registry';

/** Bedrock API 仕様に基づく正しい次元数マッピング */
const EXPECTED_DIMENSIONS: Record<string, number> = {
  'titan-text-v2': 1024,
  'nova-multimodal': 1024,
};

describe('Property 9: Registry Dimensions Lookup', () => {
  const validKeys = EmbeddingModelRegistry.getValidKeys();

  it('resolve() returns correct dimensions for all valid model keys', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validKeys),
        (key) => {
          const model = EmbeddingModelRegistry.resolve(key);
          expect(model.dimensions).toBe(EXPECTED_DIMENSIONS[key]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all models have positive integer dimensions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validKeys),
        (key) => {
          const model = EmbeddingModelRegistry.resolve(key);
          expect(Number.isInteger(model.dimensions)).toBe(true);
          expect(model.dimensions).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
