/**
 * Agent mode on AgentCore (agentBackend=agentcore, the default) vs. Bedrock Agents.
 *
 * Pins the resources that make the AgentCore path work and keep its permission boundary:
 * the Gateway accepts only IAM callers, its one tool is the bundled permission search,
 * only the Runtime role may invoke the Gateway, and no Agents Classic resource is created.
 */
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { DemoAIStack } from '../lib/stacks/demo/demo-ai-stack';

function aiStack(props: Record<string, unknown>) {
  const app = new cdk.App();
  const stack = new DemoAIStack(app, 'TestAI', {
    projectName: 'testproj',
    environment: 'dev',
    userAccessTableName: 'test-user-access',
    userAccessTableArn: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/test-user-access',
    env: { account: '123456789012', region: 'ap-northeast-1' },
    ...props,
  } as any);
  return { stack, template: Template.fromStack(stack) };
}

describe('agentBackend=agentcore (default)', () => {
  const { stack, template } = aiStack({ enableAgent: true, enableMultiAgent: true });

  it('creates a Runtime, an IAM-authenticated Gateway with one Lambda target, and no Agents Classic', () => {
    template.resourceCountIs('AWS::BedrockAgentCore::Runtime', 1);
    template.resourceCountIs('AWS::BedrockAgentCore::GatewayTarget', 1);
    template.hasResourceProperties('AWS::BedrockAgentCore::Gateway', {
      Name: 'testproj-dev-agent-tools',
      AuthorizerType: 'AWS_IAM',
    });
    template.resourceCountIs('AWS::Bedrock::Agent', 0);
    template.resourceCountIs('AWS::Bedrock::AgentAlias', 0);
  });

  it('exposes only the permission-aware search tool, with the user as a required argument', () => {
    template.hasResourceProperties('AWS::BedrockAgentCore::GatewayTarget', {
      Name: 'permission-search',
      TargetConfiguration: {
        Mcp: {
          Lambda: {
            ToolSchema: {
              InlinePayload: [
                Match.objectLike({ Name: 'permission_aware_search', InputSchema: Match.objectLike({ Required: ['query', 'userId'] }) }),
              ],
            },
          },
        },
      },
    });
  });

  it('bundles the search Lambda with the knowledge base and user-access table it filters with', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'testproj-dev-agent-permission-search',
      Environment: { Variables: Match.objectLike({ USER_ACCESS_TABLE_NAME: 'test-user-access', KNOWLEDGE_BASE_ID: Match.anyValue() }) },
    });
  });

  it('passes the Gateway URL and the tool name to the Runtime', () => {
    template.hasResourceProperties('AWS::BedrockAgentCore::Runtime', {
      EnvironmentVariables: Match.objectLike({
        AGENT_TOOLS_GATEWAY_URL: Match.anyValue(),
        SEARCH_TOOL_NAME: 'permission-search___permission_aware_search',
      }),
    });
  });

  it('lets the Runtime role invoke the Gateway', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([Match.objectLike({ Action: 'bedrock-agentcore:InvokeGateway' })]),
      },
    });
  });

  it('creates the definitions and team tables and seeds a default agent and team', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', { TableName: 'testproj-dev-agent-definitions' });
    template.hasResourceProperties('AWS::DynamoDB::Table', { TableName: 'testproj-dev-agent-teams' });
    template.resourceCountIs('Custom::AWS', 2);
    expect(stack.agentRuntimeArn).toBeDefined();
    expect(stack.agentDefinitionsTableName).toBeDefined();
    expect(stack.agentTeamTableName).toBeDefined();
  });
});

describe('agentBackend=bedrock-agents', () => {
  it('keeps the Agents Classic resources and creates no AgentCore Runtime', () => {
    const { template } = aiStack({ enableAgent: true, agentBackend: 'bedrock-agents' });
    template.resourceCountIs('AWS::BedrockAgentCore::Runtime', 0);
    expect(Object.keys(template.findResources('AWS::Bedrock::Agent')).length).toBeGreaterThanOrEqual(1);
  });

  it('rejects an unknown backend at synth time', () => {
    expect(() => aiStack({ enableAgent: true, agentBackend: 'agents' })).toThrow(/Invalid agentBackend/);
  });
});

describe('without enableAgent', () => {
  it('creates neither backend', () => {
    const { template } = aiStack({ enableAgent: false });
    template.resourceCountIs('AWS::BedrockAgentCore::Runtime', 0);
    template.resourceCountIs('AWS::Bedrock::Agent', 0);
  });
});
