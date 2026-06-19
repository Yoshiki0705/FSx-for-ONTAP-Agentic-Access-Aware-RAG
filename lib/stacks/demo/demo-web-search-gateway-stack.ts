/**
 * DemoWebSearchGatewayStack
 *
 * AgentCore Web Search Gateway を us-east-1 にデプロイする。
 * Web Search Tool は us-east-1 のみ対応（VERIFIED: AWS 公式ドキュメントに明記）。
 *
 * WafStack と同じ crossRegionReferences パターンを使用し、
 * ap-northeast-1 の WebApp スタックが Gateway URL を参照できるようにする。
 *
 * 構成:
 *   - IAM Role (bedrock-agentcore.amazonaws.com trust)
 *   - AgentCore Gateway (MCP protocol, IAM auth)
 *   - Web Search target (connector: web-search)
 *
 * 有効化条件:
 *   - enableWebSearch=true AND enableAgentCoreGateway=true
 *
 * @see docs/investigations/agentcore-web-search-integration.md — §4, §9.1, §10
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface DemoWebSearchGatewayStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
}

export class DemoWebSearchGatewayStack extends cdk.Stack {
  /** Gateway URL — cross-region reference として WebApp スタックに渡す */
  public readonly gatewayUrl: string;
  /** Gateway ID */
  public readonly gatewayId: string;

  constructor(scope: Construct, id: string, props: DemoWebSearchGatewayStackProps) {
    super(scope, id, props);

    const { projectName, environment } = props;
    const prefix = `${projectName}-${environment}`;

    // ─── IAM Role ─────────────────────────────────────────────────────────────
    const gatewayRole = new iam.Role(this, 'GatewayRole', {
      roleName: `${prefix}-web-search-gateway-role`,
      description: 'AgentCore Gateway service role for Web Search (us-east-1)',
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: {
          StringEquals: {
            'aws:SourceAccount': cdk.Aws.ACCOUNT_ID,
          },
        },
      }),
      inlinePolicies: {
        WebSearchGatewayPolicy: new iam.PolicyDocument({
          statements: [
            // Allow Gateway to invoke its own targets
            new iam.PolicyStatement({
              sid: 'InvokeGatewayTargets',
              actions: ['bedrock-agentcore:InvokeGatewayTarget'],
              resources: [
                `arn:aws:bedrock-agentcore:us-east-1:${cdk.Aws.ACCOUNT_ID}:gateway/*/target/*`,
              ],
            }),
            // Allow Web Search tool invocations
            new iam.PolicyStatement({
              sid: 'WebSearchToolAccess',
              actions: ['bedrock-agentcore:InvokeWebSearchTool'],
              resources: ['*'],
            }),
            // CloudWatch Logs
            new iam.PolicyStatement({
              sid: 'GatewayLogging',
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: [
                `arn:aws:logs:us-east-1:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/bedrock-agentcore/gateway/*`,
              ],
            }),
          ],
        }),
      },
    });

    // ─── AgentCore Gateway ─────────────────────────────────────────────────────
    // NOTE: AgentCore Gateway は L1 (CfnGateway) 未提供のため AwsCustomResource で作成。
    // §9.1 で VERIFIED 済みの API 形状を使用。
    const gateway = new cr.AwsCustomResource(this, 'Gateway', {
      onCreate: {
        service: 'BedrockAgentCoreControl',
        action: 'createGateway',
        parameters: {
          name: `${prefix}-web-search`,
          roleArn: gatewayRole.roleArn,
          protocolType: 'MCP',
          authorizerType: 'AWS_IAM',
          description: `Web Search Gateway (${environment}) — Permission-aware RAG project`,
        },
        physicalResourceId: cr.PhysicalResourceId.fromResponse('gatewayId'),
      },
      onUpdate: {
        service: 'BedrockAgentCoreControl',
        action: 'updateGateway',
        parameters: {
          gatewayIdentifier: new cr.PhysicalResourceIdReference(),
          name: `${prefix}-web-search`,
          roleArn: gatewayRole.roleArn,
          protocolType: 'MCP',
          authorizerType: 'AWS_IAM',
          description: `Web Search Gateway (${environment}) — Permission-aware RAG project`,
        },
        physicalResourceId: cr.PhysicalResourceId.fromResponse('gatewayId'),
      },
      onDelete: {
        service: 'BedrockAgentCoreControl',
        action: 'deleteGateway',
        parameters: {
          gatewayIdentifier: new cr.PhysicalResourceIdReference(),
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: [
            'bedrock-agentcore:CreateGateway',
            'bedrock-agentcore:UpdateGateway',
            'bedrock-agentcore:DeleteGateway',
            'bedrock-agentcore:GetGateway',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: [gatewayRole.roleArn],
        }),
      ]),
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const gatewayId = gateway.getResponseField('gatewayId');
    const gatewayUrl = gateway.getResponseField('gatewayUrl');

    // ─── Web Search Target ─────────────────────────────────────────────────────
    // §9.1 VERIFIED: connector 形状を使用
    // connector.source.connectorId: "web-search"
    const webSearchTarget = new cr.AwsCustomResource(this, 'WebSearchTarget', {
      onCreate: {
        service: 'BedrockAgentCoreControl',
        action: 'createGatewayTarget',
        parameters: {
          gatewayIdentifier: gatewayId,
          name: `${prefix}-web-search-tool`,
          description: 'Web Search — Ground agent responses in current, cited web knowledge',
          targetConfiguration: {
            mcp: {
              connector: {
                source: { connectorId: 'web-search' },
                configurations: [{ name: 'WebSearch', parameterValues: {} }],
              },
            },
          },
          credentialProviderConfigurations: [
            { credentialProviderType: 'GATEWAY_IAM_ROLE' },
          ],
        },
        physicalResourceId: cr.PhysicalResourceId.fromResponse('targetId'),
      },
      onDelete: {
        service: 'BedrockAgentCoreControl',
        action: 'deleteGatewayTarget',
        parameters: {
          gatewayIdentifier: gatewayId,
          targetId: new cr.PhysicalResourceIdReference(),
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: [
            'bedrock-agentcore:CreateGatewayTarget',
            'bedrock-agentcore:DeleteGatewayTarget',
            'bedrock-agentcore:GetGatewayTarget',
          ],
          resources: ['*'],
        }),
      ]),
      logRetention: logs.RetentionDays.ONE_WEEK,
    });
    webSearchTarget.node.addDependency(gateway);

    // ─── Outputs ───────────────────────────────────────────────────────────────
    this.gatewayId = gatewayId;
    this.gatewayUrl = gatewayUrl;

    new cdk.CfnOutput(this, 'WebSearchGatewayId', {
      value: gatewayId,
      description: 'AgentCore Web Search Gateway ID (us-east-1)',
      exportName: `${prefix}-WebSearchGatewayId`,
    });

    new cdk.CfnOutput(this, 'WebSearchGatewayUrl', {
      value: gatewayUrl,
      description: 'AgentCore Web Search Gateway URL (us-east-1) — set as WEB_SEARCH_GATEWAY_URL',
      exportName: `${prefix}-WebSearchGatewayUrl`,
    });

    new cdk.CfnOutput(this, 'WebSearchTargetId', {
      value: webSearchTarget.getResponseField('targetId'),
      description: 'Web Search target ID',
    });

    new cdk.CfnOutput(this, 'WebSearchGatewayRoleArn', {
      value: gatewayRole.roleArn,
      description: 'Gateway IAM Role ARN',
    });

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
  }
}
