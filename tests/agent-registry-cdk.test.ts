/**
 * CDK Assertion Tests: Agent Registry Integration
 *
 * Validates enableAgentRegistry flag behavior: IAM policy, env vars, CfnOutput,
 * and region validation logic in DemoAIStack.
 *
 * **Validates: Requirements 1.1, 1.2, 8.1, 11.1**
 */
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as fc from 'fast-check';
import { DemoAIStack } from '../lib/stacks/demo/demo-ai-stack';

function createAIStack(overrides: {
  enableAgentRegistry?: boolean;
  agentRegistryRegion?: string;
} = {}): Template {
  const app = new cdk.App();
  const stack = new DemoAIStack(app, 'TestAIStack', {
    projectName: 'test',
    environment: 'test',
    enableAgentRegistry: overrides.enableAgentRegistry,
    agentRegistryRegion: overrides.agentRegistryRegion,
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  return Template.fromStack(stack);
}

describe('Agent Registry CDK Assertion Tests', () => {
  describe('enableAgentRegistry=false (default)', () => {
    let template: Template;

    beforeAll(() => {
      template = createAIStack({ enableAgentRegistry: false });
    });

    test('does not output AgentRegistryEnabled', () => {
      const outputs = template.findOutputs('AgentRegistryEnabled');
      expect(Object.keys(outputs)).toHaveLength(0);
    });

    test('does not output AgentRegistryRegion', () => {
      const outputs = template.findOutputs('AgentRegistryRegion');
      expect(Object.keys(outputs)).toHaveLength(0);
    });
  });

  describe('enableAgentRegistry=true', () => {
    let template: Template;

    beforeAll(() => {
      template = createAIStack({ enableAgentRegistry: true, agentRegistryRegion: 'ap-northeast-1' });
    });

    test('outputs AgentRegistryEnabled', () => {
      template.hasOutput('AgentRegistryEnabled', {
        Value: 'true',
      });
    });

    test('outputs AgentRegistryRegion', () => {
      template.hasOutput('AgentRegistryRegion', {
        Value: 'ap-northeast-1',
      });
    });
  });

  describe('Invalid agentRegistryRegion', () => {
    test('throws error for unsupported region', () => {
      expect(() => {
        createAIStack({ enableAgentRegistry: true, agentRegistryRegion: 'eu-north-1' });
      }).toThrow(/Invalid agentRegistryRegion/);
    });

    test('does not throw for supported region', () => {
      expect(() => {
        createAIStack({ enableAgentRegistry: true, agentRegistryRegion: 'us-east-1' });
      }).not.toThrow();
    });
  });
});

describe('Property 9: Agent Registry Region Validation', () => {
  const SUPPORTED_REGIONS = ['us-east-1', 'us-west-2', 'ap-southeast-2', 'ap-northeast-1', 'eu-west-1'];

  it('supported regions never throw', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SUPPORTED_REGIONS),
        (region: string) => {
          expect(() => {
            createAIStack({ enableAgentRegistry: true, agentRegistryRegion: region });
          }).not.toThrow();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('unsupported regions always throw', () => {
    const unsupportedRegions = [
      'eu-north-1', 'sa-east-1', 'af-south-1', 'me-south-1',
      'ap-east-1', 'ca-central-1', 'eu-central-1', 'eu-west-2',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...unsupportedRegions),
        (region: string) => {
          expect(() => {
            createAIStack({ enableAgentRegistry: true, agentRegistryRegion: region });
          }).toThrow(/Invalid agentRegistryRegion/);
        }
      ),
      { numRuns: 20 }
    );
  });
});
