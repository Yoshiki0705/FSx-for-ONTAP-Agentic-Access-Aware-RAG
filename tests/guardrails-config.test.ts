/**
 * CDK Assertion Tests: Guardrails Configuration
 *
 * Tests for guardrailsConfig parameter handling in DemoAIStack.
 * Validates backward compatibility, custom config, and disabled state.
 */
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { buildGuardrailProps, GuardrailsConfig } from '../lib/stacks/demo/demo-ai-stack';

describe('buildGuardrailProps', () => {
  test('returns default config when guardrailsConfig is undefined', () => {
    const result = buildGuardrailProps(undefined);

    // Default: all categories HIGH, PROMPT_ATTACK output NONE
    const filters = result.contentPolicyConfig.filtersConfig as any[];
    expect(filters).toHaveLength(6);
    expect(filters.find((f: any) => f.type === 'SEXUAL')).toEqual({
      type: 'SEXUAL', inputStrength: 'HIGH', outputStrength: 'HIGH',
    });
    expect(filters.find((f: any) => f.type === 'PROMPT_ATTACK')).toEqual({
      type: 'PROMPT_ATTACK', inputStrength: 'HIGH', outputStrength: 'NONE',
    });

    // Default PII
    const pii = result.sensitiveInformationPolicyConfig.piiEntitiesConfig as any[];
    expect(pii).toHaveLength(5);
    expect(pii.find((p: any) => p.type === 'EMAIL')).toEqual({ type: 'EMAIL', action: 'ANONYMIZE' });
    expect(pii.find((p: any) => p.type === 'CREDIT_DEBIT_CARD_NUMBER')).toEqual({ type: 'CREDIT_DEBIT_CARD_NUMBER', action: 'BLOCK' });

    // No topic policy or contextual grounding by default
    expect(result.topicPolicyConfig).toBeUndefined();
    expect(result.contextualGroundingPolicyConfig).toBeUndefined();
  });

  test('applies custom contentFilters', () => {
    const config: GuardrailsConfig = {
      contentFilters: [
        { type: 'SEXUAL', inputStrength: 'LOW', outputStrength: 'MEDIUM' },
        { type: 'VIOLENCE', inputStrength: 'NONE', outputStrength: 'HIGH' },
      ],
    };
    const result = buildGuardrailProps(config);
    const filters = result.contentPolicyConfig.filtersConfig as any[];
    expect(filters).toHaveLength(2);
    expect(filters[0]).toEqual({ type: 'SEXUAL', inputStrength: 'LOW', outputStrength: 'MEDIUM' });
    expect(filters[1]).toEqual({ type: 'VIOLENCE', inputStrength: 'NONE', outputStrength: 'HIGH' });
  });

  test('applies custom piiConfig', () => {
    const config: GuardrailsConfig = {
      piiConfig: [
        { type: 'EMAIL', action: 'BLOCK' },
        { type: 'PHONE', action: 'ANONYMIZE' },
      ],
    };
    const result = buildGuardrailProps(config);
    const pii = result.sensitiveInformationPolicyConfig.piiEntitiesConfig as any[];
    expect(pii).toHaveLength(2);
    expect(pii[0]).toEqual({ type: 'EMAIL', action: 'BLOCK' });
  });

  test('adds topicPolicies when configured', () => {
    const config: GuardrailsConfig = {
      topicPolicies: [
        { name: 'CompetitorInfo', definition: 'Block competitor info', examples: ['Compare with X'], action: 'BLOCK' },
      ],
    };
    const result = buildGuardrailProps(config);
    expect(result.topicPolicyConfig).toBeDefined();
    const topics = (result.topicPolicyConfig as any).topicsConfig;
    expect(topics).toHaveLength(1);
    expect(topics[0].name).toBe('CompetitorInfo');
    expect(topics[0].type).toBe('DENY');
    expect(topics[0].examples).toEqual(['Compare with X']);
  });

  test('adds contextualGrounding when enabled', () => {
    const config: GuardrailsConfig = {
      contextualGrounding: true,
      groundingThreshold: 0.8,
      relevanceThreshold: 0.6,
    };
    const result = buildGuardrailProps(config);
    expect(result.contextualGroundingPolicyConfig).toBeDefined();
    const filters = (result.contextualGroundingPolicyConfig as any).filtersConfig;
    expect(filters).toHaveLength(2);
    expect(filters[0]).toEqual({ type: 'GROUNDING', threshold: 0.8 });
    expect(filters[1]).toEqual({ type: 'RELEVANCE', threshold: 0.6 });
  });

  test('uses default thresholds (0.7) for contextualGrounding', () => {
    const config: GuardrailsConfig = { contextualGrounding: true };
    const result = buildGuardrailProps(config);
    const filters = (result.contextualGroundingPolicyConfig as any).filtersConfig;
    expect(filters[0].threshold).toBe(0.7);
    expect(filters[1].threshold).toBe(0.7);
  });

  test('omits topicPolicies when empty array', () => {
    const config: GuardrailsConfig = { topicPolicies: [] };
    const result = buildGuardrailProps(config);
    expect(result.topicPolicyConfig).toBeUndefined();
  });
});
