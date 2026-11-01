/**
 * CDK Assertion Tests for DemoSfnToolsGatewayStack
 *
 * Step Functions ワークフローを AgentCore Gateway 経由でツール化する専用スタック。
 * 既定は読み取り専用、書き込みは opt-in + Cedar 限定、Gateway は KB から分離。
 *
 * @see lib/stacks/demo/demo-sfn-tools-gateway-stack.ts
 * @see .private/design/stepfunctions-agentcore-gateway-integration.ja.md
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import {
  DemoSfnToolsGatewayStack,
  DemoSfnToolsGatewayStackProps,
} from '../lib/stacks/demo/demo-sfn-tools-gateway-stack';

const FAILOVER_ARN =
  'arn:aws:states:ap-northeast-1:123456789012:stateMachine:fsxn-ops-snapmirror-failover';
const FAILBACK_ARN =
  'arn:aws:states:ap-northeast-1:123456789012:stateMachine:fsxn-ops-snapmirror-failback';

function createStack(propsOverride?: Partial<DemoSfnToolsGatewayStackProps>): {
  stack: DemoSfnToolsGatewayStack;
  template: Template;
} {
  const app = new cdk.App();
  const defaultProps: DemoSfnToolsGatewayStackProps = {
    projectName: 'test-project',
    environment: 'test',
    workflows: [
      { name: 'snapmirrorFailover', stateMachineArn: FAILOVER_ARN },
      { name: 'snapmirrorFailback', stateMachineArn: FAILBACK_ARN },
    ],
    env: { account: '123456789012', region: 'ap-northeast-1' },
    ...propsOverride,
  };
  const stack = new DemoSfnToolsGatewayStack(app, 'TestSfnToolsGatewayStack', defaultProps);
  return { stack, template: Template.fromStack(stack) };
}

describe('DemoSfnToolsGatewayStack', () => {
  describe('Input validation', () => {
    test('throws when no workflows are provided', () => {
      const app = new cdk.App();
      expect(
        () =>
          new DemoSfnToolsGatewayStack(app, 'Empty', {
            projectName: 'p',
            environment: 'e',
            workflows: [],
            env: { account: '123456789012', region: 'ap-northeast-1' },
          }),
      ).toThrow(/at least one workflow/);
    });
  });

  describe('Gateway', () => {
    test('creates an MCP / AWS_IAM gateway (L1 CfnGateway)', () => {
      const { template } = createStack();
      template.hasResourceProperties('AWS::BedrockAgentCore::Gateway', {
        Name: 'test-project-test-sfn-gateway',
        ProtocolType: 'MCP',
        AuthorizerType: 'AWS_IAM',
      });
    });

    test('does NOT create a Policy Engine when write ops are disabled', () => {
      const { template } = createStack();
      template.resourceCountIs('AWS::BedrockAgentCore::PolicyEngine', 0);
    });
  });

  describe('Gateway service role', () => {
    test('trusts bedrock-agentcore with SourceAccount condition', () => {
      const { template } = createStack();
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'test-project-test-sfn-gateway-role',
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Principal: { Service: 'bedrock-agentcore.amazonaws.com' },
              Condition: {
                StringEquals: Match.objectLike({ 'aws:SourceAccount': Match.anyValue() }),
              },
            }),
          ]),
        }),
      });
    });

    test('grants read-only Step Functions actions scoped to the state machine ARNs', () => {
      const { template } = createStack();
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'test-project-test-sfn-gateway-role',
        Policies: Match.arrayWith([
          Match.objectLike({
            PolicyDocument: Match.objectLike({
              Statement: Match.arrayWith([
                Match.objectLike({
                  Sid: 'SfnReadStateMachine',
                  Action: ['states:DescribeStateMachine', 'states:ListExecutions'],
                  Resource: Match.arrayWith([FAILOVER_ARN, FAILBACK_ARN]),
                }),
                Match.objectLike({
                  Sid: 'SfnReadExecution',
                  Action: ['states:DescribeExecution', 'states:GetExecutionHistory'],
                }),
              ]),
            }),
          }),
        ]),
      });
    });

    test('does NOT grant StartExecution / StopExecution when write ops are disabled', () => {
      const { template } = createStack();
      const json = JSON.stringify(template.toJSON());
      expect(json).not.toContain('states:StartExecution');
      expect(json).not.toContain('states:StopExecution');
    });
  });

  describe('Gateway targets (one per workflow)', () => {
    test('creates one target per workflow using the states connector', () => {
      const { template } = createStack();
      template.resourceCountIs('AWS::BedrockAgentCore::GatewayTarget', 2);
      template.hasResourceProperties('AWS::BedrockAgentCore::GatewayTarget', {
        Name: 'snapmirrorFailover',
        TargetConfiguration: Match.objectLike({
          Mcp: Match.objectLike({
            Connector: Match.objectLike({
              Source: { ConnectorId: 'states' },
            }),
          }),
        }),
        CredentialProviderConfigurations: Match.arrayWith([
          Match.objectLike({ CredentialProviderType: 'GATEWAY_IAM_ROLE' }),
        ]),
      });
    });

    test('pins the state machine ARN on read operations and omits write ops by default', () => {
      const { template } = createStack();
      // Inspect the target's connector configurations directly (not the whole
      // template string — the cdk-nag suppression reason mentions StopExecution).
      const targets = template.findResources('AWS::BedrockAgentCore::GatewayTarget');
      const failover = Object.values(targets).find(
        (r) => r.Properties?.Name === 'snapmirrorFailover',
      );
      expect(failover).toBeDefined();
      const configs: Array<{ Name: string; ParameterValues?: { stateMachineArn?: string } }> =
        failover!.Properties.TargetConfiguration.Mcp.Connector.Configurations;
      const opNames = configs.map((c) => c.Name);

      // Read ops exposed
      expect(opNames).toEqual(
        expect.arrayContaining([
          'DescribeStateMachine',
          'ListExecutions',
          'DescribeExecution',
          'GetExecutionHistory',
        ]),
      );
      // Pinnable read ops carry the state machine ARN; execution-ARN ops do not
      const describeSm = configs.find((c) => c.Name === 'DescribeStateMachine');
      expect(describeSm?.ParameterValues?.stateMachineArn).toBe(FAILOVER_ARN);
      const describeExec = configs.find((c) => c.Name === 'DescribeExecution');
      expect(describeExec?.ParameterValues).toBeUndefined();

      // Write ops are NOT in the exposed operations by default
      expect(opNames).not.toContain('StartExecution');
      expect(opNames).not.toContain('StopExecution');
    });
  });

  describe('Write ops opt-in + Cedar gating', () => {
    test('creates a Policy Engine when write ops are enabled', () => {
      const { template } = createStack({
        enableWriteOps: true,
        writeOpsRolePattern: 'snapmirror-operator',
      });
      template.resourceCountIs('AWS::BedrockAgentCore::PolicyEngine', 1);
    });

    test('exposes StartExecution / StopExecution and grants the IAM actions', () => {
      const { template } = createStack({
        enableWriteOps: true,
        writeOpsRolePattern: 'snapmirror-operator',
      });
      const json = JSON.stringify(template.toJSON());
      expect(json).toContain('StartExecution');
      expect(json).toContain('StopExecution');
      expect(json).toContain('states:StartExecution');
      expect(json).toContain('states:StopExecution');
    });

    test('creates Cedar policies restricting write ops to the operator role', () => {
      const { template } = createStack({
        enableWriteOps: true,
        writeOpsRolePattern: 'snapmirror-operator',
      });
      const json = JSON.stringify(template.toJSON());
      // A forbid policy that is lifted only for the operator role
      expect(json).toContain('snapmirror-operator');
      expect(json).toContain('snapmirrorFailover___StartExecution');
      expect(json).toContain('snapmirrorFailover___StopExecution');
      // allow baseline + 2 write ops × 2 workflows = at least 6 policies
      const policies = Object.values(template.toJSON().Resources as Record<string, { Type: string }>)
        .filter((r) => r.Type === 'AWS::BedrockAgentCore::Policy');
      expect(policies.length).toBeGreaterThanOrEqual(6);
    });

    test('when no role pattern is given, the forbid has no unless clause (deny all writes)', () => {
      const { template } = createStack({ enableWriteOps: true });
      const json = JSON.stringify(template.toJSON());
      // forbid is present but there is no "unless { principal.id like ... }" lift
      expect(json).toContain('snapmirrorFailover___StartExecution');
      expect(json).not.toContain('unless { principal.id like');
    });
  });

  describe('Outputs', () => {
    test('exports Gateway URL, ID, ARN and reports the operation scope', () => {
      const { template } = createStack();
      template.hasOutput('SfnGatewayUrl', {
        Export: { Name: 'test-project-test-SfnGatewayUrl' },
      });
      template.hasOutput('SfnGatewayId', {
        Export: { Name: 'test-project-test-SfnGatewayId' },
      });
      template.hasOutput('SfnGatewayMode', {
        Value: 'read-only',
      });
    });

    test('mode output reflects write-enabled state', () => {
      const { template } = createStack({ enableWriteOps: true, policyEngineMode: 'LOG_ONLY' });
      template.hasOutput('SfnGatewayMode', {
        Value: 'write-enabled (LOG_ONLY)',
      });
    });
  });
});
