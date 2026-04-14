/**
 * Property 1: guardrailsConfig → CfnGuardrail マッピングの忠実性
 *
 * Feature: guardrails-org-safeguards, Property 1: guardrailsConfig → CfnGuardrail mapping fidelity
 *
 * **Validates: Requirements 1.5, 1.6, 1.7**
 *
 * For any valid guardrailsConfig object (arbitrary combination of contentFilters,
 * topicPolicies, piiConfig), buildGuardrailProps must produce CfnGuardrail properties
 * that accurately reflect all specified filter strengths, topic definitions, and PII entity settings.
 */
import * as fc from 'fast-check';
import {
  buildGuardrailProps,
  GuardrailsConfig,
  FilterStrength,
  ContentFilterConfig,
  TopicPolicyConfig,
  PiiEntityConfig,
} from '../../lib/stacks/demo/demo-ai-stack';

// --- Generators ---

const filterStrengthArb: fc.Arbitrary<FilterStrength> = fc.constantFrom('NONE', 'LOW', 'MEDIUM', 'HIGH');

const contentFilterTypeArb = fc.constantFrom(
  'SEXUAL' as const, 'VIOLENCE' as const, 'HATE' as const,
  'INSULTS' as const, 'MISCONDUCT' as const, 'PROMPT_ATTACK' as const,
);

const contentFilterArb: fc.Arbitrary<ContentFilterConfig> = fc.record({
  type: contentFilterTypeArb,
  inputStrength: filterStrengthArb,
  outputStrength: filterStrengthArb,
});

const topicPolicyArb: fc.Arbitrary<TopicPolicyConfig> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  definition: fc.string({ minLength: 1, maxLength: 200 }),
  examples: fc.option(
    fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
    { nil: undefined },
  ),
  action: fc.constant('BLOCK' as const),
});

const piiTypeArb = fc.constantFrom(
  'EMAIL', 'PHONE', 'NAME', 'US_SOCIAL_SECURITY_NUMBER', 'CREDIT_DEBIT_CARD_NUMBER',
);

const piiEntityArb: fc.Arbitrary<PiiEntityConfig> = fc.record({
  type: piiTypeArb,
  action: fc.constantFrom('BLOCK' as const, 'ANONYMIZE' as const),
});

const guardrailsConfigArb: fc.Arbitrary<GuardrailsConfig> = fc.record({
  contentFilters: fc.option(
    fc.array(contentFilterArb, { minLength: 1, maxLength: 6 }),
    { nil: undefined },
  ),
  topicPolicies: fc.option(
    fc.array(topicPolicyArb, { minLength: 0, maxLength: 3 }),
    { nil: undefined },
  ),
  piiConfig: fc.option(
    fc.array(piiEntityArb, { minLength: 1, maxLength: 5 }),
    { nil: undefined },
  ),
  contextualGrounding: fc.option(fc.boolean(), { nil: undefined }),
  groundingThreshold: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
  relevanceThreshold: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
});

describe('Property 1: guardrailsConfig → CfnGuardrail mapping fidelity', () => {
  // --- Property-based tests ---

  it('preserves all content filter strengths from input config (Req 1.5)', () => {
    fc.assert(
      fc.property(guardrailsConfigArb, (config) => {
        const result = buildGuardrailProps(config);
        const outputFilters = result.contentPolicyConfig.filtersConfig as any[];

        if (config.contentFilters) {
          expect(outputFilters).toHaveLength(config.contentFilters.length);
          for (let i = 0; i < config.contentFilters.length; i++) {
            expect(outputFilters[i].type).toBe(config.contentFilters[i].type);
            expect(outputFilters[i].inputStrength).toBe(config.contentFilters[i].inputStrength);
            expect(outputFilters[i].outputStrength).toBe(config.contentFilters[i].outputStrength);
          }
        } else {
          // Default: 6 categories
          expect(outputFilters).toHaveLength(6);
          for (const f of outputFilters) {
            if (f.type === 'PROMPT_ATTACK') {
              expect(f.inputStrength).toBe('HIGH');
              expect(f.outputStrength).toBe('NONE');
            } else {
              expect(f.inputStrength).toBe('HIGH');
              expect(f.outputStrength).toBe('HIGH');
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('preserves all PII entity configs from input (Req 1.7)', () => {
    fc.assert(
      fc.property(guardrailsConfigArb, (config) => {
        const result = buildGuardrailProps(config);
        const outputPii = result.sensitiveInformationPolicyConfig.piiEntitiesConfig as any[];

        if (config.piiConfig) {
          expect(outputPii).toHaveLength(config.piiConfig.length);
          for (let i = 0; i < config.piiConfig.length; i++) {
            expect(outputPii[i].type).toBe(config.piiConfig[i].type);
            expect(outputPii[i].action).toBe(config.piiConfig[i].action);
          }
        } else {
          // Default: 5 PII entities
          expect(outputPii).toHaveLength(5);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('preserves all topic policy definitions from input (Req 1.6)', () => {
    fc.assert(
      fc.property(guardrailsConfigArb, (config) => {
        const result = buildGuardrailProps(config);

        if (config.topicPolicies && config.topicPolicies.length > 0) {
          expect(result.topicPolicyConfig).toBeDefined();
          const topics = (result.topicPolicyConfig as any).topicsConfig;
          expect(topics).toHaveLength(config.topicPolicies.length);
          for (let i = 0; i < config.topicPolicies.length; i++) {
            expect(topics[i].name).toBe(config.topicPolicies[i].name);
            expect(topics[i].definition).toBe(config.topicPolicies[i].definition);
            expect(topics[i].type).toBe('DENY');
          }
        } else {
          expect(result.topicPolicyConfig).toBeUndefined();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('correctly maps contextualGrounding settings', () => {
    fc.assert(
      fc.property(guardrailsConfigArb, (config) => {
        const result = buildGuardrailProps(config);

        if (config.contextualGrounding) {
          expect(result.contextualGroundingPolicyConfig).toBeDefined();
          const filters = (result.contextualGroundingPolicyConfig as any).filtersConfig;
          expect(filters).toHaveLength(2);
          const grounding = filters.find((f: any) => f.type === 'GROUNDING');
          const relevance = filters.find((f: any) => f.type === 'RELEVANCE');
          expect(grounding).toBeDefined();
          expect(relevance).toBeDefined();
          expect(grounding.threshold).toBe(config.groundingThreshold ?? 0.7);
          expect(relevance.threshold).toBe(config.relevanceThreshold ?? 0.7);
        } else {
          expect(result.contextualGroundingPolicyConfig).toBeUndefined();
        }
      }),
      { numRuns: 100 },
    );
  });

  // --- Unit tests for edge cases ---

  it('returns default config when called with undefined', () => {
    const result = buildGuardrailProps(undefined);
    const filters = result.contentPolicyConfig.filtersConfig as any[];
    expect(filters).toHaveLength(6);
    const pii = result.sensitiveInformationPolicyConfig.piiEntitiesConfig as any[];
    expect(pii).toHaveLength(5);
    expect(result.topicPolicyConfig).toBeUndefined();
    expect(result.contextualGroundingPolicyConfig).toBeUndefined();
  });

  it('returns default config when called with empty object', () => {
    const result = buildGuardrailProps({});
    const filters = result.contentPolicyConfig.filtersConfig as any[];
    expect(filters).toHaveLength(6);
    const pii = result.sensitiveInformationPolicyConfig.piiEntitiesConfig as any[];
    expect(pii).toHaveLength(5);
  });

  it('topic examples are included when provided', () => {
    const result = buildGuardrailProps({
      topicPolicies: [
        { name: 'Test', definition: 'Test def', examples: ['ex1', 'ex2'], action: 'BLOCK' },
      ],
    });
    const topics = (result.topicPolicyConfig as any).topicsConfig;
    expect(topics[0].examples).toEqual(['ex1', 'ex2']);
  });

  it('topic examples are omitted when not provided', () => {
    const result = buildGuardrailProps({
      topicPolicies: [
        { name: 'Test', definition: 'Test def', action: 'BLOCK' },
      ],
    });
    const topics = (result.topicPolicyConfig as any).topicsConfig;
    expect(topics[0].examples).toBeUndefined();
  });

  it('contextualGrounding uses default thresholds (0.7) when not specified', () => {
    const result = buildGuardrailProps({ contextualGrounding: true });
    const filters = (result.contextualGroundingPolicyConfig as any).filtersConfig;
    const grounding = filters.find((f: any) => f.type === 'GROUNDING');
    const relevance = filters.find((f: any) => f.type === 'RELEVANCE');
    expect(grounding.threshold).toBe(0.7);
    expect(relevance.threshold).toBe(0.7);
  });
});
