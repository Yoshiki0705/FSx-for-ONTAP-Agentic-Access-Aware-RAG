/**
 * CDK Assertion Tests for DemoWebSearchGatewayStack
 *
 * Web Search Gateway は us-east-1 専用（VERIFIED: Web Search Tool は us-east-1 のみ対応）。
 * crossRegionReferences パターンで ap-northeast-1 の WebApp に gatewayUrl を渡す。
 *
 * @see docs/investigations/agentcore-web-search-integration.md — §4, §9.1, §10
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import {
  DemoWebSearchGatewayStack,
  DemoWebSearchGatewayStackProps,
} from '../lib/stacks/demo/demo-web-search-gateway-stack';

function createStack(propsOverride?: Partial<DemoWebSearchGatewayStackProps>): {
  stack: DemoWebSearchGatewayStack;
  template: Template;
} {
  const app = new cdk.App();
  const defaultProps: DemoWebSearchGatewayStackProps = {
    projectName: 'test-project',
    environment: 'test',
    env: { account: '123456789012', region: 'us-east-1' },
    crossRegionReferences: true,
    ...propsOverride,
  };

  const stack = new DemoWebSearchGatewayStack(app, 'TestWebSearchGatewayStack', defaultProps);
  return { stack, template: Template.fromStack(stack) };
}

describe('DemoWebSearchGatewayStack', () => {
  describe('Region', () => {
    test('is deployed to us-east-1 (Web Search Tool region constraint)', () => {
      const { stack } = createStack();
      expect(stack.region).toBe('us-east-1');
    });
  });

  describe('IAM Role', () => {
    test('creates Gateway role with bedrock-agentcore trust', () => {
      const { template } = createStack();
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'test-project-test-web-search-gateway-role',
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Principal: { Service: 'bedrock-agentcore.amazonaws.com' },
              Condition: {
                StringEquals: Match.objectLike({
                  'aws:SourceAccount': Match.anyValue(),
                }),
              },
            }),
          ]),
        }),
      });
    });

    test('grants Web Search tool invocation in inline policy', () => {
      const { template } = createStack();
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'test-project-test-web-search-gateway-role',
        Policies: Match.arrayWith([
          Match.objectLike({
            PolicyDocument: Match.objectLike({
              Statement: Match.arrayWith([
                Match.objectLike({
                  Sid: 'WebSearchToolAccess',
                  Action: 'bedrock-agentcore:InvokeWebSearchTool',
                }),
              ]),
            }),
          }),
        ]),
      });
    });
  });

  describe('AgentCore Gateway (AwsCustomResource)', () => {
    // Custom::AWS `Create` is an Fn::Join (embeds role/gateway ARN tokens),
    // so literal parameter values are asserted against the stringified template.
    test('creates a Gateway custom resource via createGateway', () => {
      const { template } = createStack();
      const json = JSON.stringify(template.toJSON());
      expect(json).toContain('createGateway');
      expect(json).toContain('deleteGateway');
    });

    test('Gateway uses MCP protocol and AWS_IAM auth', () => {
      const { template } = createStack();
      const json = JSON.stringify(template.toJSON());
      // Parameters are nested JSON inside an Fn::Join, so quotes are escaped —
      // assert on the literal tokens rather than quote-delimited pairs.
      expect(json).toContain('protocolType');
      expect(json).toContain('MCP');
      expect(json).toContain('authorizerType');
      expect(json).toContain('AWS_IAM');
    });

    test('Gateway custom resource policy can pass the gateway role', () => {
      const { template } = createStack();
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'iam:PassRole',
            }),
          ]),
        }),
      });
    });
  });

  describe('Web Search Target (AwsCustomResource)', () => {
    test('creates a target with the verified web-search connector shape', () => {
      const { template } = createStack();
      // §9.1 VERIFIED: connector.source.connectorId = "web-search"
      // Nested JSON inside Fn::Join — assert literal tokens (escaped quotes).
      const json = JSON.stringify(template.toJSON());
      expect(json).toContain('connectorId');
      expect(json).toContain('web-search');
      expect(json).toContain('createGatewayTarget');
    });

    test('target uses GATEWAY_IAM_ROLE credential provider', () => {
      const { template } = createStack();
      const json = JSON.stringify(template.toJSON());
      expect(json).toContain('GATEWAY_IAM_ROLE');
    });
  });

  describe('CloudFormation Outputs', () => {
    test('exports Gateway URL for cross-region reference', () => {
      const { template } = createStack();
      template.hasOutput('WebSearchGatewayUrl', {
        Export: { Name: 'test-project-test-WebSearchGatewayUrl' },
      });
    });

    test('exports Gateway ID', () => {
      const { template } = createStack();
      template.hasOutput('WebSearchGatewayId', {
        Export: { Name: 'test-project-test-WebSearchGatewayId' },
      });
    });

    test('exposes gatewayUrl and gatewayId as stack properties', () => {
      const { stack } = createStack();
      expect(stack.gatewayUrl).toBeDefined();
      expect(stack.gatewayId).toBeDefined();
    });
  });
});
