/**
 * Feature: multimodal-rag-search, Property 4: モデル別最小権限 IAM ポリシー
 *
 * 任意の有効な embeddingModel パラメータ値に対して、
 * KBConfigStrategy.buildIamStatements() が生成する IAM ポリシーステートメントは、
 * そのモデルの EmbeddingModelDefinition で定義された機能に必要な最小限のアクションのみを含む。
 * modalities が ['text'] のみのモデルでは BDA Parser 関連権限が含まれない。
 *
 * **Validates: Requirements 8.4**
 */

import * as fc from 'fast-check';
import { EmbeddingModelRegistry } from '../../lib/config/embedding-model-registry';
import { KBConfigStrategy } from '../../lib/config/kb-config-strategy';

const BDA_ACTIONS = [
  'bedrock:InvokeDataAutomationAsync',
  'bedrock:GetDataAutomationStatus',
];

/** Extract all actions from an array of PolicyStatements */
function extractActions(statements: any[]): string[] {
  const actions: string[] = [];
  for (const s of statements) {
    const json = s.toJSON();
    const action = json.Action;
    if (Array.isArray(action)) {
      actions.push(...action);
    } else if (typeof action === 'string') {
      actions.push(action);
    }
  }
  return actions;
}

describe('Property 4: Minimum Privilege IAM Policy', () => {
  const validKeys = EmbeddingModelRegistry.getValidKeys();

  it('text-only models do NOT include BDA Parser permissions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validKeys),
        (key) => {
          const model = EmbeddingModelRegistry.resolve(key);
          if (model.modalities.length === 1 && model.modalities[0] === 'text') {
            const strategy = new KBConfigStrategy(model, 'us-east-1', '123456789012');
            const statements = strategy.buildIamStatements();
            const allActions = extractActions(statements);
            for (const bdaAction of BDA_ACTIONS) {
              expect(allActions).not.toContain(bdaAction);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('multimodal models with requiresBdaParser=true include BDA Parser permissions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validKeys),
        (key) => {
          const model = EmbeddingModelRegistry.resolve(key);
          if (model.requiresBdaParser) {
            const strategy = new KBConfigStrategy(model, 'us-east-1', '123456789012');
            const statements = strategy.buildIamStatements();
            const allActions = extractActions(statements);
            for (const bdaAction of BDA_ACTIONS) {
              expect(allActions).toContain(bdaAction);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all models include bedrock:InvokeModel for their specific model', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validKeys),
        (key) => {
          const model = EmbeddingModelRegistry.resolve(key);
          const strategy = new KBConfigStrategy(model, 'us-east-1', '123456789012');
          const statements = strategy.buildIamStatements();
          const allActions = extractActions(statements);
          expect(allActions).toContain('bedrock:InvokeModel');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('text-only models produce exactly 1 IAM statement (InvokeModel only)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validKeys),
        (key) => {
          const model = EmbeddingModelRegistry.resolve(key);
          if (!model.requiresBdaParser) {
            const strategy = new KBConfigStrategy(model, 'us-east-1', '123456789012');
            const statements = strategy.buildIamStatements();
            expect(statements).toHaveLength(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('BDA-required models produce exactly 2 IAM statements', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validKeys),
        (key) => {
          const model = EmbeddingModelRegistry.resolve(key);
          if (model.requiresBdaParser) {
            const strategy = new KBConfigStrategy(model, 'us-east-1', '123456789012');
            const statements = strategy.buildIamStatements();
            expect(statements).toHaveLength(2);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
