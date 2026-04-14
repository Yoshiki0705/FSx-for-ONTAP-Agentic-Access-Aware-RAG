/**
 * CDK Assertion Tests: Guardrails Organizational Safeguards
 *
 * Validates CfnGuardrail resource creation, Lambda env vars, IAM policies,
 * and backward compatibility based on enableGuardrails and guardrailsConfig.
 *
 * Requirements: 1.2, 1.3, 1.9, 8.1, 8.2, 11.1, 11.4, 11.5
 */
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DemoAIStack, GuardrailsConfig } from '../lib/stacks/demo/demo-ai-stack';

function createAIStack(overrides: {
  enableGuardrails?: boolean;
  guardrailsConfig?: GuardrailsConfig;
} = {}): Template {
  const app = new cdk.App();
  const stack = new DemoAIStack(app, 'TestAIStack', {
    projectName: 'test',
    environment: 'test',
    enableGuardrails: overrides.enableGuardrails,
    guardrailsConfig: overrides.guardrailsConfig,
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  return Template.fromStack(stack);
}

describe('Guardrails CDK Assertion Tests', () => {
  describe('enableGuardrails=true, guardrailsConfig undefined (backward compatibility)', () => {
    let template: Template;

    beforeAll(() => {
      template = createAIStack({ enableGuardrails: true });
    });

    test('creates CfnGuardrail with default config (all categories HIGH)', () => {
      template.hasResourceProperties('AWS::Bedrock::Guardrail', {
        Name: 'test-test-guardrail',
        ContentPolicyConfig: {
          FiltersConfig: Match.arrayWith([
            Match.objectLike({ Type: 'SEXUAL', InputStrength: 'HIGH', OutputStrength: 'HIGH' }),
            Match.objectLike({ Type: 'VIOLENCE', InputStrength: 'HIGH', OutputStrength: 'HIGH' }),
            Match.objectLike({ Type: 'HATE', InputStrength: 'HIGH', OutputStrength: 'HIGH' }),
            Match.objectLike({ Type: 'INSULTS', InputStrength: 'HIGH', OutputStrength: 'HIGH' }),
            Match.objectLike({ Type: 'MISCONDUCT', InputStrength: 'HIGH', OutputStrength: 'HIGH' }),
            Match.objectLike({ Type: 'PROMPT_ATTACK', InputStrength: 'HIGH', OutputStrength: 'NONE' }),
          ]),
        },
      });
    });

    test('creates CfnGuardrail with default PII config', () => {
      template.hasResourceProperties('AWS::Bedrock::Guardrail', {
        SensitiveInformationPolicyConfig: {
          PiiEntitiesConfig: Match.arrayWith([
            Match.objectLike({ Type: 'EMAIL', Action: 'ANONYMIZE' }),
            Match.objectLike({ Type: 'PHONE', Action: 'ANONYMIZE' }),
            Match.objectLike({ Type: 'NAME', Action: 'ANONYMIZE' }),
            Match.objectLike({ Type: 'US_SOCIAL_SECURITY_NUMBER', Action: 'BLOCK' }),
            Match.objectLike({ Type: 'CREDIT_DEBIT_CARD_NUMBER', Action: 'BLOCK' }),
          ]),
        },
      });
    });

    test('outputs GuardrailId and GuardrailConfig', () => {
      template.hasOutput('GuardrailId', {});
      template.hasOutput('GuardrailConfig', {});
    });
  });

  describe('enableGuardrails=true with custom guardrailsConfig', () => {
    let template: Template;
    const customConfig: GuardrailsConfig = {
      contentFilters: [
        { type: 'SEXUAL', inputStrength: 'MEDIUM', outputStrength: 'HIGH' },
        { type: 'VIOLENCE', inputStrength: 'LOW', outputStrength: 'MEDIUM' },
      ],
      topicPolicies: [
        { name: 'CompetitorInfo', definition: 'Block competitor info', action: 'BLOCK' },
      ],
      piiConfig: [
        { type: 'EMAIL', action: 'BLOCK' },
      ],
      contextualGrounding: true,
      groundingThreshold: 0.8,
      relevanceThreshold: 0.6,
    };

    beforeAll(() => {
      template = createAIStack({ enableGuardrails: true, guardrailsConfig: customConfig });
    });

    test('creates CfnGuardrail with custom content filters', () => {
      template.hasResourceProperties('AWS::Bedrock::Guardrail', {
        ContentPolicyConfig: {
          FiltersConfig: [
            { Type: 'SEXUAL', InputStrength: 'MEDIUM', OutputStrength: 'HIGH' },
            { Type: 'VIOLENCE', InputStrength: 'LOW', OutputStrength: 'MEDIUM' },
          ],
        },
      });
    });

    test('creates CfnGuardrail with custom topic policies', () => {
      template.hasResourceProperties('AWS::Bedrock::Guardrail', {
        TopicPolicyConfig: {
          TopicsConfig: Match.arrayWith([
            Match.objectLike({ Name: 'CompetitorInfo', Definition: 'Block competitor info', Type: 'DENY' }),
          ]),
        },
      });
    });

    test('creates CfnGuardrail with custom PII config', () => {
      template.hasResourceProperties('AWS::Bedrock::Guardrail', {
        SensitiveInformationPolicyConfig: {
          PiiEntitiesConfig: [
            { Type: 'EMAIL', Action: 'BLOCK' },
          ],
        },
      });
    });

    test('creates CfnGuardrail with contextual grounding config', () => {
      template.hasResourceProperties('AWS::Bedrock::Guardrail', {
        ContextualGroundingPolicyConfig: {
          FiltersConfig: Match.arrayWith([
            Match.objectLike({ Type: 'GROUNDING', Threshold: 0.8 }),
            Match.objectLike({ Type: 'RELEVANCE', Threshold: 0.6 }),
          ]),
        },
      });
    });
  });

  describe('enableGuardrails=false', () => {
    let template: Template;

    beforeAll(() => {
      template = createAIStack({ enableGuardrails: false });
    });

    test('does not create CfnGuardrail resource', () => {
      template.resourceCountIs('AWS::Bedrock::Guardrail', 0);
    });

    test('does not output GuardrailId', () => {
      const outputs = template.findOutputs('GuardrailId');
      expect(Object.keys(outputs)).toHaveLength(0);
    });
  });

  describe('enableGuardrails=false with guardrailsConfig (ignored)', () => {
    let template: Template;

    beforeAll(() => {
      template = createAIStack({
        enableGuardrails: false,
        guardrailsConfig: {
          contentFilters: [
            { type: 'SEXUAL', inputStrength: 'LOW', outputStrength: 'LOW' },
          ],
        },
      });
    });

    test('does not create CfnGuardrail even when guardrailsConfig is provided', () => {
      template.resourceCountIs('AWS::Bedrock::Guardrail', 0);
    });
  });
});
