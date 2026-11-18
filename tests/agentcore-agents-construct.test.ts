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

describe('enableAwsDocsTool (docs/mcp-external-tool-selection.md)', () => {
  const off = aiStack({ enableAgent: true }).template;
  const on = aiStack({ enableAgent: true, enableAwsDocsTool: true }).template;
  const gatewayTargets = (t: Template) => Object.values(t.findResources('AWS::BedrockAgentCore::GatewayTarget')) as any[];
  const docsTarget = () => gatewayTargets(on).find((r) => r.Properties.Name === 'aws-docs');

  it('is off by default: one runtime, one target, no documentation setting', () => {
    off.resourceCountIs('AWS::BedrockAgentCore::Runtime', 1);
    off.resourceCountIs('AWS::BedrockAgentCore::GatewayTarget', 1);
    expect(JSON.stringify(off.toJSON())).not.toContain('aws-docs');
    expect(JSON.stringify(off.toJSON())).not.toContain('AwsDocumentation');
  });

  it('adds a second runtime that speaks MCP, and an MCP server target on the same Gateway', () => {
    on.resourceCountIs('AWS::BedrockAgentCore::Runtime', 2);
    on.hasResourceProperties('AWS::BedrockAgentCore::Runtime', { ProtocolConfiguration: 'MCP', AgentRuntimeName: Match.stringLikeRegexp('aws_docs$') });
    on.resourceCountIs('AWS::BedrockAgentCore::GatewayTarget', 2);
    expect(docsTarget().Properties.TargetConfiguration.Mcp.McpServer.Endpoint).toBeDefined();
  });

  it('calls the runtime with IAM (SigV4), not without authorization and not with a stored key', () => {
    const providers = docsTarget().Properties.CredentialProviderConfigurations;
    expect(providers).toHaveLength(1);
    expect(providers[0].CredentialProviderType).toBe('GATEWAY_IAM_ROLE');
    expect(JSON.stringify(providers)).toContain('bedrock-agentcore');
    expect(JSON.stringify(docsTarget())).not.toMatch(/ApiKey|OAuth/i);
  });

  it('fixes the tool definitions in the Gateway: exactly the three allowed tools', () => {
    const payload = JSON.parse(docsTarget().Properties.TargetConfiguration.Mcp.McpServer.McpToolSchema.InlinePayload);
    expect(payload.tools.map((t: { name: string }) => t.name)).toEqual(['search_documentation', 'read_documentation', 'read_sections']);
  });

  it('lets only the Gateway role invoke the documentation runtime', () => {
    // Every policy statement that can invoke a runtime and names the documentation runtime.
    const granted: string[] = [];
    for (const [id, r] of Object.entries<any>(on.findResources('AWS::IAM::Policy'))) {
      for (const st of [].concat(r.Properties.PolicyDocument.Statement)) {
        const actions: string[] = [].concat(st.Action);
        if (actions.some((a) => /InvokeAgentRuntime/.test(a)) && JSON.stringify(st.Resource).includes('AwsDocsRuntime')) {
          granted.push(`${id} -> ${JSON.stringify(r.Properties.Roles)}`);
        }
      }
    }
    expect(granted).toHaveLength(1);
    expect(granted[0]).toMatch(/ToolsGateway.*ToolsGatewayServiceRole/);
    // Neither runtime sets a JWT authorizer, so both accept only IAM callers.
    for (const r of Object.values<any>(on.findResources('AWS::BedrockAgentCore::Runtime'))) {
      expect(r.Properties.AuthorizerConfiguration).toBeUndefined();
    }
  });

  it('tells the agent runtime the target prefix and seeds the default agent with the tool', () => {
    on.hasResourceProperties('AWS::BedrockAgentCore::Runtime', { EnvironmentVariables: Match.objectLike({ AWS_DOCS_TOOL_PREFIX: 'aws-docs___' }) });
    expect(JSON.stringify(on.toJSON())).toContain('AwsDocumentation');
  });

  it('requires Agent mode on AgentCore', () => {
    expect(() => aiStack({ enableAwsDocsTool: true })).toThrow(/enableAwsDocsTool requires enableAgent=true/);
    expect(() => aiStack({ enableAgent: true, agentBackend: 'bedrock-agents', enableAwsDocsTool: true })).toThrow(/agentBackend=agentcore/);
  });
});
