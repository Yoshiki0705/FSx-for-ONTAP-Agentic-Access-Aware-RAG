/**
 * Feature: multimodal-rag-search, Property 1: Registry パラメータバリデーション
 *
 * 任意の文字列に対して、EmbeddingModelRegistry.resolve() は有効なキーの場合のみ
 * EmbeddingModelDefinition を返し、それ以外のすべての文字列に対してバリデーションエラーをスローする。
 * multimodalKbMode パラメータは replace と dual のみを受け付ける。
 * モデルが指定リージョンで利用不可の場合、validate() はエラーを返す。
 *
 * **Validates: Requirements 1.1, 1.4, 11.4, 13.1, 13.7**
 */

import * as fc from 'fast-check';
import {
  EmbeddingModelRegistry,
  VALID_KB_MODES,
} from '../../lib/config/embedding-model-registry';

describe('Property 1: Registry Parameter Validation', () => {
  const validKeys = EmbeddingModelRegistry.getValidKeys();

  it('resolve() returns EmbeddingModelDefinition for all valid keys', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validKeys),
        (key) => {
          const model = EmbeddingModelRegistry.resolve(key);
          expect(model).toBeDefined();
          expect(model.paramKey).toBe(key);
          expect(model.modelId).toBeTruthy();
          expect(model.dimensions).toBeGreaterThan(0);
          expect(model.modalities.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('resolve() throws for any string not in valid keys', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter(
          (s) => !validKeys.includes(s),
        ),
        (invalidKey) => {
          expect(() => EmbeddingModelRegistry.resolve(invalidKey)).toThrow(
            /Invalid embeddingModel/,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('validate() throws for valid key in unsupported region', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validKeys),
        fc.string({ minLength: 1, maxLength: 30 }).filter(
          (r) => {
            const model = EmbeddingModelRegistry.resolve(
              validKeys[0],
            );
            // Generate regions not in any model's available regions
            return !['us-east-1', 'us-west-2', 'ap-northeast-1', 'eu-west-1', 'ap-southeast-1', 'eu-central-1'].includes(r);
          },
        ),
        (key, region) => {
          const model = EmbeddingModelRegistry.resolve(key);
          if (!model.availableRegions.includes(region)) {
            expect(() => EmbeddingModelRegistry.validate(key, region)).toThrow(
              /not available in region/,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('validate() succeeds for valid key in supported region', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validKeys),
        (key) => {
          const model = EmbeddingModelRegistry.resolve(key);
          const region = model.availableRegions[0];
          expect(() => EmbeddingModelRegistry.validate(key, region)).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('validateKbMode() accepts only replace and dual', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_KB_MODES),
        (mode) => {
          expect(() => EmbeddingModelRegistry.validateKbMode(mode)).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('validateKbMode() throws for any string not in valid modes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 30 }).filter(
          (s) => !(VALID_KB_MODES as readonly string[]).includes(s),
        ),
        (invalidMode) => {
          expect(() => EmbeddingModelRegistry.validateKbMode(invalidMode)).toThrow(
            /Invalid multimodalKbMode/,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
