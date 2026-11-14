/**
 * AgentCore agents — agent mode and multi-agent mode on Amazon Bedrock AgentCore.
 *
 * Replaces the Amazon Bedrock Agents (Agents Classic) resources for `agentBackend=agentcore`
 * (the default). One generic agent runs on AgentCore Runtime; the agents and teams users
 * create on screen are definitions in DynamoDB that the web app loads and sends with each
 * invocation, so creating an agent is a table write rather than a resource that takes
 * minutes to prepare.
 *
 *   WebApp Lambda ──InvokeAgentRuntime──▶ AgentCore Runtime (docker/agentcore-agent, Strands)
 *                                              │ SigV4 (execution role)
 *                                              ▼
 *                                   agent-tools Gateway (AWS_IAM, MCP)
 *                                              │ Lambda target
 *                                              ▼
 *                     permission-search Lambda (KB Retrieve + the web app's sid-filter)
 *
 * The Gateway is separate from the one `enableAgentCoreGateway` creates, as the Step
 * Functions tools Gateway is: that Gateway runs a request interceptor and a policy engine
 * whose contract the agent tool does not need, and the permission check lives in the
 * tool itself (fail-closed), so the boundary does not depend on Gateway configuration.
 */
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface AgentCoreAgentsProps {
  /** `${projectName}-${environment}` */
  readonly prefix: string;
  readonly knowledgeBaseId: string;
  readonly userAccessTableName?: string;
  readonly userAccessTableArn?: string;
  /** Also create the team table and a default team. */
  readonly enableMultiAgent?: boolean;
  /** Model for the seeded agents (inference profile or model ID). */
  readonly defaultModelId?: string;
}

/** Name of the Gateway target; with the tool name it forms `<target>___<tool>`. */
export const SEARCH_TARGET_NAME = 'permission-search';
export const SEARCH_TOOL_NAME = 'permission_aware_search';
export const DEFAULT_AGENT_ID = 'rag-default';
export const DEFAULT_TEAM_ID = 'rag-default-team';
const DEFAULT_MODEL = 'jp.anthropic.claude-haiku-4-5-20251001-v1:0';

export class AgentCoreAgentsConstruct extends Construct {
  public readonly runtime: agentcore.Runtime;
  public readonly definitionsTable: dynamodb.Table;
  public readonly teamTable?: dynamodb.Table;
  public readonly gateway: agentcore.Gateway;
  public readonly searchFunction: lambdaNodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: AgentCoreAgentsProps) {
    super(scope, id);
    const { prefix } = props;
    const model = props.defaultModelId || DEFAULT_MODEL;

    // --- Definitions ---------------------------------------------------------------
    this.definitionsTable = new dynamodb.Table(this, 'AgentDefinitions', {
      tableName: `${prefix}-agent-definitions`,
      partitionKey: { name: 'agentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    if (props.enableMultiAgent) {
      this.teamTable = new dynamodb.Table(this, 'AgentTeams', {
        tableName: `${prefix}-agent-teams`,
        partitionKey: { name: 'teamId', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    }

    // --- Permission-aware search tool ------------------------------------------
    // Bundles docker/nextjs/src/lib/rag-pipeline/sid-filter.ts, the web app's filter.
    this.searchFunction = new lambdaNodejs.NodejsFunction(this, 'PermissionSearch', {
      functionName: `${prefix}-agent-permission-search`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, '../../lambda/agent-tools/permission-search/index.ts'),
      handler: 'handler',
      bundling: { externalModules: ['@aws-sdk/*'], target: 'node22' },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        KNOWLEDGE_BASE_ID: props.knowledgeBaseId,
        USER_ACCESS_TABLE_NAME: props.userAccessTableName || '',
      },
    });
    this.searchFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:Retrieve'],
      resources: [`arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:knowledge-base/${props.knowledgeBaseId}`],
    }));
    if (props.userAccessTableArn) {
      this.searchFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['dynamodb:GetItem'],
        resources: [props.userAccessTableArn],
      }));
    }

    // --- Gateway: the tool, reachable only with IAM --------------------------------
    this.gateway = new agentcore.Gateway(this, 'ToolsGateway', {
      gatewayName: `${prefix}-agent-tools`,
      description: 'Tools for the permission-aware RAG agents on AgentCore Runtime',
      authorizerConfiguration: agentcore.GatewayAuthorizer.usingAwsIam(),
    });
    this.gateway.addLambdaTarget('PermissionSearchTarget', {
      gatewayTargetName: SEARCH_TARGET_NAME,
      description: 'Knowledge Base search filtered by the signed-in user\'s SIDs',
      lambdaFunction: this.searchFunction,
      toolSchema: agentcore.ToolSchema.fromInline([
        {
          name: SEARCH_TOOL_NAME,
          description: 'Search the documents the given user may read. Documents without trusted permission metadata are excluded.',
          inputSchema: {
            type: agentcore.SchemaDefinitionType.OBJECT,
            properties: {
              query: { type: agentcore.SchemaDefinitionType.STRING, description: 'Search text' },
              maxResults: { type: agentcore.SchemaDefinitionType.INTEGER, description: 'Documents to return (1 to 10)' },
              userId: { type: agentcore.SchemaDefinitionType.STRING, description: 'Signed-in user, set by the agent code' },
            },
            required: ['query', 'userId'],
          },
        },
      ]),
    });

    // --- Runtime ---------------------------------------------------------------
    this.runtime = new agentcore.Runtime(this, 'Runtime', {
      // [a-zA-Z][a-zA-Z0-9_]{0,47}
      runtimeName: `${prefix.replace(/[^a-zA-Z0-9]/g, '_')}_agents`.slice(0, 48),
      description: 'Permission-aware RAG agents (Strands) for agent and multi-agent mode',
      agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
        path.join(__dirname, '../../docker/agentcore-agent'),
        { platform: Platform.LINUX_ARM64 },
      ),
      environmentVariables: {
        AGENT_TOOLS_GATEWAY_URL: this.gateway.gatewayUrl!,
        SEARCH_TOOL_NAME: `${SEARCH_TARGET_NAME}___${SEARCH_TOOL_NAME}`,
      },
    });
    this.runtime.role.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: [
        'arn:aws:bedrock:*::foundation-model/*',
        // Cross-region inference profiles (jp.*, apac.*, global.*) resolve to models in other regions.
        'arn:aws:bedrock:*:*:inference-profile/*',
      ],
    }));
    this.gateway.grantInvoke(this.runtime.role);

    // --- Seed: one agent, and one team when multi-agent mode is on -----------------
    this.seed('SeedDefaultAgent', this.definitionsTable, {
      agentId: { S: DEFAULT_AGENT_ID },
      agentName: { S: 'Permission-aware RAG Agent' },
      description: { S: 'Answers from the documents the signed-in user may read, with citations' },
      instruction: { S: 'You help employees find and understand company documents. Search before answering, and answer concisely.' },
      foundationModel: { S: model },
      tools: { L: [{ S: 'PermissionAwareSearch' }] },
      knowledgeBaseIds: { L: [{ S: props.knowledgeBaseId }] },
      agentStatus: { S: 'PREPARED' },
      source: { S: 'cdk' },
    });
    if (this.teamTable) {
      const collaborator = (name: string, role: string, instruction: string) => ({
        M: {
          agentId: { S: `${DEFAULT_TEAM_ID}-${role}` },
          agentAliasId: { S: '' },
          agentName: { S: name },
          role: { S: role },
          foundationModel: { S: model },
          toolProfiles: { L: [{ S: 'kb-retrieve' }] },
          trustLevel: { S: 'user-safe' },
          dataBoundary: { S: 'permission-scoped' },
          instruction: { S: instruction },
        },
      });
      this.seed('SeedDefaultTeam', this.teamTable, {
        teamId: { S: DEFAULT_TEAM_ID },
        teamName: { S: 'Permission-aware RAG Team' },
        description: { S: 'Retrieval, analysis and writing specialists coordinated by a supervisor' },
        supervisorAgentId: { S: 'agentcore-supervisor' },
        supervisorAliasId: { S: '' },
        routingMode: { S: 'supervisor' },
        autoRouting: { BOOL: false },
        collaborators: {
          L: [
            collaborator('Retrieval Agent', 'retrieval', 'Find the documents relevant to the request and summarize what each says, with file names.'),
            collaborator('Analysis Agent', 'analysis', 'Compare and analyze the facts found in the documents. Point out gaps and conflicts.'),
            collaborator('Output Agent', 'output', 'Write the final answer in a clear structure with the cited file names.'),
          ],
        },
        createdAt: { S: '2026-11-14T00:00:00.000Z' },
        updatedAt: { S: '2026-11-14T00:00:00.000Z' },
      });
    }

    // --- Outputs -----------------------------------------------------------------
    new cdk.CfnOutput(this, 'AgentRuntimeArn', { value: this.runtime.agentRuntimeArn, description: 'AgentCore Runtime ARN for agent mode' });
    new cdk.CfnOutput(this, 'AgentDefinitionsTableName', { value: this.definitionsTable.tableName, description: 'Agent definitions (DynamoDB)' });
    new cdk.CfnOutput(this, 'AgentToolsGatewayUrl', { value: this.gateway.gatewayUrl!, description: 'agent-tools Gateway URL (AWS_IAM)' });

    // --- cdk-nag -----------------------------------------------------------------
    NagSuppressions.addResourceSuppressions(this.searchFunction, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AWSLambdaBasicExecutionRole is the standard managed policy for CloudWatch Logs.',
        appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
      },
    ], true);
    NagSuppressions.addResourceSuppressions(this.runtime.role, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Agents choose their model per definition, including cross-region inference profiles whose target regions are not known at synth time. Runtime logging and X-Ray need log-group and trace wildcards (granted by the L2).',
        appliesTo: [
          'Resource::arn:aws:bedrock:*::foundation-model/*',
          'Resource::arn:aws:bedrock:*:*:inference-profile/*',
          { regex: '/^Resource::.*$/g' },
          { regex: '/^Action::.*$/g' },
        ],
      },
    ], true);
    NagSuppressions.addResourceSuppressions(this.gateway, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The Gateway role invokes its one Lambda target; the L2 grants the function ARN and its versions.',
        appliesTo: [{ regex: '/^Resource::.*:\\*$/g' }],
      },
    ], true);
  }

  /** Put one item at deploy time. Deleting the stack deletes the table, so no onDelete. */
  private seed(id: string, table: dynamodb.Table, item: Record<string, unknown>): void {
    const putItem: cr.AwsSdkCall = {
      service: 'DynamoDB',
      action: 'putItem',
      parameters: { TableName: table.tableName, Item: item },
      physicalResourceId: cr.PhysicalResourceId.of(`${table.node.path}-${id}`),
    };
    const resource = new cr.AwsCustomResource(this, id, {
      onCreate: putItem,
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({ resources: [table.tableArn] }),
      installLatestAwsSdk: false,
    });
    NagSuppressions.addResourceSuppressions(resource, [
      { id: 'AwsSolutions-IAM4', reason: 'AwsCustomResource provider uses the standard Lambda basic execution role.' },
      { id: 'AwsSolutions-L1', reason: 'AwsCustomResource provider runtime is managed by CDK.' },
    ], true);
  }
}
