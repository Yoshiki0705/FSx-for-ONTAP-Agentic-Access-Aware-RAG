/**
 * Property-Based Test: 拡張フィールド未設定時の後方互換性 (P7)
 *
 * Feature: sidebar-workflow-agent-redesign, Property 7: backward compatibility of extended fields
 *
 * For any CardData object:
 * - When workflowType is undefined, it should be treated as 'single'
 * - When agentId is undefined, no Agent auto-selection should occur
 * - When steps is undefined, prompt template direct input should be the fallback behavior
 *
 * **Validates: Requirements 9.1, 9.2, 9.3**
 */

import * as fc from 'fast-check';
import {
  KB_CARDS,
  AGENT_CARDS,
  ALL_CARDS,
  CardData,
} from '../../constants/card-constants';

// Helper: resolve effective workflowType (undefined → 'single')
function resolveWorkflowType(card: CardData): 'single' | 'multi' {
  return card.workflowType ?? 'single';
}

// Helper: determine if Agent auto-selection should occur
function shouldAutoSelectAgent(card: CardData): boolean {
  return card.agentId !== undefined;
}

// Helper: determine if prompt template direct input is the fallback
function shouldUsePromptTemplateFallback(card: CardData): boolean {
  return card.steps === undefined || card.steps.length === 0;
}

describe('Feature: sidebar-workflow-agent-redesign, Property 7: backward compatibility of extended fields', () => {
  // Generator for arbitrary CardData objects with optional extended fields
  const cardDataArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 30 }),
    icon: fc.string({ minLength: 1, maxLength: 5 }),
    titleKey: fc.string({ minLength: 1, maxLength: 50 }),
    descriptionKey: fc.string({ minLength: 1, maxLength: 50 }),
    promptTemplateKey: fc.string({ minLength: 1, maxLength: 50 }),
    category: fc.string({ minLength: 1, maxLength: 20 }),
    mode: fc.constantFrom('kb' as const, 'agent' as const),
    // Extended fields: sometimes present, sometimes undefined
    agentId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    workflowType: fc.option(
      fc.constantFrom('single' as const, 'multi' as const),
      { nil: undefined }
    ),
    steps: fc.option(
      fc.array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          titleKey: fc.string({ minLength: 1, maxLength: 50 }),
          descriptionKey: fc.string({ minLength: 1, maxLength: 50 }),
          order: fc.nat({ max: 100 }),
          status: fc.option(
            fc.constantFrom(
              'pending' as const,
              'active' as const,
              'completed' as const,
              'error' as const
            ),
            { nil: undefined }
          ),
        }),
        { minLength: 0, maxLength: 5 }
      ),
      { nil: undefined }
    ),
  });

  it('workflowType未設定時はsingleとして扱われる', () => {
    fc.assert(
      fc.property(cardDataArb, (card) => {
        const effectiveType = resolveWorkflowType(card);

        if (card.workflowType === undefined) {
          // When workflowType is undefined, it defaults to 'single'
          expect(effectiveType).toBe('single');
        } else {
          // When workflowType is explicitly set, it should be preserved
          expect(effectiveType).toBe(card.workflowType);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('agentId未設定時はAgent自動選択が行われない', () => {
    fc.assert(
      fc.property(cardDataArb, (card) => {
        const autoSelect = shouldAutoSelectAgent(card);

        if (card.agentId === undefined) {
          // When agentId is undefined, no auto-selection should occur
          expect(autoSelect).toBe(false);
        } else {
          // When agentId is set, auto-selection should occur
          expect(autoSelect).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('steps未設定時はプロンプトテンプレート直接入力にフォールバックする', () => {
    fc.assert(
      fc.property(cardDataArb, (card) => {
        const useFallback = shouldUsePromptTemplateFallback(card);

        if (card.steps === undefined || card.steps.length === 0) {
          // When steps is undefined or empty, fallback to prompt template direct input
          expect(useFallback).toBe(true);
        } else {
          // When steps are defined and non-empty, no fallback
          expect(useFallback).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Verify actual card data: all existing cards have backward-compatible behavior
  describe('既存カードデータの後方互換性検証', () => {
    it('全KB_CARDSはagentId未設定でAgent自動選択なし', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...KB_CARDS),
          (card) => {
            expect(card.agentId).toBeUndefined();
            expect(shouldAutoSelectAgent(card)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('全KB_CARDSはworkflowTypeがsingleとして扱われる', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...KB_CARDS),
          (card) => {
            expect(card.workflowType).toBeUndefined();
            expect(resolveWorkflowType(card)).toBe('single');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('全KB_CARDSはsteps未設定でプロンプトテンプレート直接入力にフォールバック', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...KB_CARDS),
          (card) => {
            expect(card.steps).toBeUndefined();
            expect(shouldUsePromptTemplateFallback(card)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('全AGENT_CARDSはagentId未設定でAgent自動選択なし', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...AGENT_CARDS),
          (card) => {
            expect(card.agentId).toBeUndefined();
            expect(shouldAutoSelectAgent(card)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('全AGENT_CARDSはworkflowTypeがsingleとして扱われる', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...AGENT_CARDS),
          (card) => {
            expect(card.workflowType).toBeUndefined();
            expect(resolveWorkflowType(card)).toBe('single');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('全AGENT_CARDSはsteps未設定でプロンプトテンプレート直接入力にフォールバック', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...AGENT_CARDS),
          (card) => {
            expect(card.steps).toBeUndefined();
            expect(shouldUsePromptTemplateFallback(card)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('全ALL_CARDSは拡張フィールド未設定で後方互換性を維持', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_CARDS),
          (card) => {
            // All existing cards should have no extended fields set
            expect(resolveWorkflowType(card)).toBe('single');
            expect(shouldAutoSelectAgent(card)).toBe(false);
            expect(shouldUsePromptTemplateFallback(card)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
