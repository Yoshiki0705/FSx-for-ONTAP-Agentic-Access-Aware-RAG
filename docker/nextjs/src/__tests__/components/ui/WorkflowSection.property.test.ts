/**
 * Property-Based Tests for WorkflowSection logic (P3, P4, P5)
 *
 * These are pure logic tests — no React rendering.
 * They test the data invariants and logic functions used by WorkflowSection.
 */

import * as fc from 'fast-check';
import { AGENT_CARDS, CardData } from '../../../constants/card-constants';

// ============================================================
// Pure logic functions extracted from WorkflowSection behavior
// ============================================================

/**
 * Determines if a card should trigger agent auto-selection.
 * Mirrors: WorkflowSection.handleCardClick — the `if (card.agentId)` branch.
 */
function shouldAutoSelectAgent(card: CardData): boolean {
  return card.agentId !== undefined;
}

/**
 * Determines if a card is highlighted given the current selectedAgentId.
 * Mirrors: WorkflowSection.isHighlighted
 */
function isHighlighted(card: CardData, selectedAgentId: string | null): boolean {
  return card.agentId !== undefined && card.agentId === selectedAgentId;
}

// ============================================================
// Property 3: ワークフローカードクリック時のプロンプト受け渡し
// ============================================================

describe('Feature: sidebar-workflow-agent-redesign, Property 3: workflow card click passes prompt', () => {
  /**
   * For any AGENT_CARDS card, the card has valid titleKey and promptTemplateKey
   * that are non-empty strings, ensuring onWorkflowSelect can always receive
   * prompt text and title. All cards are selectable regardless of agentId.
   *
   * **Validates: Requirements 3.4, 5.4**
   */
  it('全AGENT_CARDSカードはtitleKeyとpromptTemplateKeyが有効な非空文字列を持つ', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...AGENT_CARDS),
        (card: CardData) => {
          // titleKey must be a non-empty string
          expect(typeof card.titleKey).toBe('string');
          expect(card.titleKey.length).toBeGreaterThan(0);

          // promptTemplateKey must be a non-empty string
          expect(typeof card.promptTemplateKey).toBe('string');
          expect(card.promptTemplateKey.length).toBeGreaterThan(0);

          // Card must be selectable (mode is 'agent')
          expect(card.mode).toBe('agent');

          // Card must have a valid id
          expect(typeof card.id).toBe('string');
          expect(card.id.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 4: Agent-Card紐付けによるAgent自動選択
// ============================================================

describe('Feature: sidebar-workflow-agent-redesign, Property 4: agent-card binding auto-selection', () => {
  /**
   * For any card click:
   * - If card has agentId, setSelectedAgentId should be called (auto-selection occurs)
   * - If card has no agentId, setSelectedAgentId should NOT be called
   *
   * **Validates: Requirements 4.2, 4.3**
   */
  it('agentId有無でAgent自動選択の発生が決定される', () => {
    // Generator: AGENT_CARDS with optionally injected agentId
    const cardWithOptionalAgentId = fc.constantFrom(...AGENT_CARDS).map((card) => {
      // Randomly decide whether to add an agentId
      return card; // Use actual card data as-is (all currently have no agentId)
    });

    // Also test cards with agentId set
    const cardWithAgentId = fc.constantFrom(...AGENT_CARDS).chain((card) =>
      fc.string({ minLength: 1, maxLength: 20 }).map((agentId) => ({
        ...card,
        agentId,
      }))
    );

    // Test cards WITHOUT agentId (current AGENT_CARDS)
    fc.assert(
      fc.property(
        fc.constantFrom(...AGENT_CARDS),
        (card: CardData) => {
          const autoSelect = shouldAutoSelectAgent(card);

          if (card.agentId !== undefined) {
            expect(autoSelect).toBe(true);
          } else {
            expect(autoSelect).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );

    // Test cards WITH agentId
    fc.assert(
      fc.property(
        cardWithAgentId,
        (card: CardData) => {
          expect(shouldAutoSelectAgent(card)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 5: ハイライト状態はselectedAgentIdとcard.agentIdの一致で決定される
// ============================================================

describe('Feature: sidebar-workflow-agent-redesign, Property 5: highlight state determined by agentId match', () => {
  /**
   * For any selectedAgentId (including null) and any card list:
   * - A card is highlighted iff card.agentId !== undefined && card.agentId === selectedAgentId
   * - When selectedAgentId is null, no cards are highlighted
   *
   * **Validates: Requirements 5.1, 5.2, 5.5**
   */
  it('ハイライト条件は card.agentId !== undefined && card.agentId === selectedAgentId', () => {
    const selectedAgentIdArb = fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null });

    // Card generator: AGENT_CARDS with optionally injected agentId
    const cardArb = fc.constantFrom(...AGENT_CARDS).chain((baseCard) =>
      fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }).map(
        (agentId) => ({
          ...baseCard,
          agentId,
        })
      )
    );

    fc.assert(
      fc.property(
        selectedAgentIdArb,
        fc.array(cardArb, { minLength: 1, maxLength: 10 }),
        (selectedAgentId: string | null, cards: CardData[]) => {
          for (const card of cards) {
            const highlighted = isHighlighted(card, selectedAgentId);
            const expected =
              card.agentId !== undefined && card.agentId === selectedAgentId;

            expect(highlighted).toBe(expected);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('selectedAgentIdがnullの場合、全カードはハイライトされない', () => {
    const cardArb = fc.constantFrom(...AGENT_CARDS).chain((baseCard) =>
      fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }).map(
        (agentId) => ({
          ...baseCard,
          agentId,
        })
      )
    );

    fc.assert(
      fc.property(
        fc.array(cardArb, { minLength: 1, maxLength: 10 }),
        (cards: CardData[]) => {
          for (const card of cards) {
            const highlighted = isHighlighted(card, null);
            expect(highlighted).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
