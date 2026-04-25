import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Property-Based Test: モデルフォールバックの正確性 (Property 3)
 *
 * Feature: ui-ux-optimization, Property 3: モデルフォールバックの正確性
 *
 * 任意のモデルIDと任意のモード遷移（KB→Agent、Agent→KB）に対して、
 * resolveModelForMode の結果は以下を満たすこと:
 * - 返されるモデルIDは常にターゲットモードの利用可能モデルリストに含まれる
 * - 現在のモデルがターゲットモードで利用可能な場合、didFallback は false で、モデルIDは変更されない
 * - 現在のモデルがターゲットモードで利用不可の場合、didFallback は true で、デフォルトモデルが返される
 *
 * **Validates: Requirements 5.5**
 */

import * as fc from 'fast-check';
import { resolveModelForMode, ChatMode } from '../../utils/modelCompatibility';

// Feature: ui-ux-optimization, Property 3: モデルフォールバックの正確性
describe('Feature: ui-ux-optimization, Property 3: モデルフォールバックの正確性', () => {
  it('返されるモデルIDは常にターゲットモードのモデルリストに含まれる', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.constantFrom<ChatMode>('kb', 'single-agent', 'multi-agent'),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
        (
          currentModelId: string,
          targetMode: ChatMode,
          kbModels: string[],
          agentModels: string[],
        ) => {
          const defaultKbModel = kbModels[0];
          const defaultAgentModel = agentModels[0];

          const result = resolveModelForMode(
            currentModelId,
            targetMode,
            kbModels,
            agentModels,
            defaultKbModel,
            defaultAgentModel,
          );

          const targetList = targetMode === 'kb' ? kbModels : agentModels;
          expect(targetList).toContain(result.modelId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('現在のモデルがターゲットリストに含まれる場合、didFallback は false でモデルIDは変更されない', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ChatMode>('kb', 'single-agent', 'multi-agent'),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
        (
          targetMode: ChatMode,
          kbModels: string[],
          agentModels: string[],
        ) => {
          const targetList = targetMode === 'kb' ? kbModels : agentModels;
          // Pick a model that IS in the target list
          const currentModelId = targetList[0];
          const defaultKbModel = kbModels[0];
          const defaultAgentModel = agentModels[0];

          const result = resolveModelForMode(
            currentModelId,
            targetMode,
            kbModels,
            agentModels,
            defaultKbModel,
            defaultAgentModel,
          );

          expect(result.didFallback).toBe(false);
          expect(result.modelId).toBe(currentModelId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('現在のモデルがターゲットリストに含まれない場合、didFallback は true でデフォルトモデルが返される', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.constantFrom<ChatMode>('kb', 'single-agent', 'multi-agent'),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
        (
          currentModelId: string,
          targetMode: ChatMode,
          kbModels: string[],
          agentModels: string[],
        ) => {
          const targetList = targetMode === 'kb' ? kbModels : agentModels;
          // Pre-condition: currentModelId is NOT in the target list
          fc.pre(!targetList.includes(currentModelId));

          const defaultKbModel = kbModels[0];
          const defaultAgentModel = agentModels[0];

          const result = resolveModelForMode(
            currentModelId,
            targetMode,
            kbModels,
            agentModels,
            defaultKbModel,
            defaultAgentModel,
          );

          const expectedDefault = targetMode === 'kb' ? defaultKbModel : defaultAgentModel;
          expect(result.didFallback).toBe(true);
          expect(result.modelId).toBe(expectedDefault);
        },
      ),
      { numRuns: 100 },
    );
  });
});
