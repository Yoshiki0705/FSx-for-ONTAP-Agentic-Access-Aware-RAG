/**
 * Property 1: guardrailsConfig → CfnGuardrail マッピングの忠実性
 *
 * Feature: guardrails-org-safeguards, Property 1: guardrailsConfig → CfnGuardrail mapping fidelity
 *
 * **Validates: Requirements 1.5, 1.6, 1.7**
 */
import * as fc from 'fast-check';
import {
  buildGuardrailProps,
  GuardrailsConfig,
  FilterStrength,
  ContentFilterConfig,
  TopicPolicyConfig,
  PiiEntityConfig,
} from '../lib/stacks/demo/demo-ai-stack';

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
  examples: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 3 }), { nil: undefined }),
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
  contentFilters: fc.option(fc.array(contentFilterArb, { minLength: 1, maxLength: 6 }), { nil: undefined }),
  topicPolicies: fc.option(fc.array(topicPolicyArb, { minLength: 0, maxLength: 3 }), { nil: undefined }),
  piiConfig: fc.option(fc.array(piiEntityArb, { minLength: 1, maxLength: 5 }), { nil: undefined }),
  contextualGrounding: fc.option(fc.boolean(), { nil: undefined }),
  groundingThreshold: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
  relevanceThreshold: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
});

describe('Property 1: guardrailsConfig → CfnGuardrail mapping fidelity', () => {
  it('preserves all content filter strengths from input config', () => {
    fc.assert(
      fc.property(guardrailsConfigArb, (config) => {
        const result = buildGuardrailProps(config);
        const outputFilters = result.contentPolicyConfig.filtersConfig as any[];

        if (config.contentFilters) {
          // Custom filters: each input filter must appear in output with exact strengths (by index)
          expect(outputFilters).toHaveLength(config.contentFilters.length);
          for (let i = 0; i < config.contentFilters.length; i++) {
            expect(outputFilters[i].type).toBe(config.contentFilters[i].type);
            expect(outputFilters[i].inputStrength).toBe(config.contentFilters[i].inputStrength);
            expect(outputFilters[i].outputStrength).toBe(config.contentFilters[i].outputStrength);
          }
        } else {
          // Default: 6 categories, all HIGH (PROMPT_ATTACK output NONE)
          expect(outputFilters).toHaveLength(6);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('preserves all PII entity configs from input', () => {
    fc.assert(
      fc.property(guardrailsConfigArb, (config) => {
        const result = buildGuardrailProps(config);
        const outputPii = result.sensitiveInformationPolicyConfig.piiEntitiesConfig as any[];

        if (config.piiConfig) {
          expect(outputPii).toHaveLength(config.piiConfig.length);
          // Verify each output entry matches the corresponding input entry by index
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

  it('preserves all topic policy definitions from input', () => {
    fc.assert(
      fc.property(guardrailsConfigArb, (config) => {
        const result = buildGuardrailProps(config);

        if (config.topicPolicies && config.topicPolicies.length > 0) {
          expect(result.topicPolicyConfig).toBeDefined();
          const topics = (result.topicPolicyConfig as any).topicsConfig;
          expect(topics).toHaveLength(config.topicPolicies.length);
          for (const inputTopic of config.topicPolicies) {
            const match = topics.find((t: any) => t.name === inputTopic.name);
            expect(match).toBeDefined();
            expect(match.definition).toBe(inputTopic.definition);
            expect(match.type).toBe('DENY');
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
          expect(grounding.threshold).toBe(config.groundingThreshold ?? 0.7);
          expect(relevance.threshold).toBe(config.relevanceThreshold ?? 0.7);
        } else {
          expect(result.contextualGroundingPolicyConfig).toBeUndefined();
        }
      }),
      { numRuns: 100 },
    );
  });
});
