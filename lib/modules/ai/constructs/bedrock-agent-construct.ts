/**
 * Bedrock Agentコンストラクト
 * 権限認識型RAGシステムのためのBedrock Agent統合
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';

export interface BedrockAgentConstructProps {
  /**
   * Bedrock Agentを有効化するか
   * @default false
   */
  enabled?: boolean;

  /**
   * プロジェクト名
   */
  projectName: string;

  /**
   * 環境名
   */
  environment: string;

  /**
   * Agent名
   */
  agentName: string;

  /**
   * Agent説明
   */
  agentDescription?: string;

  /**
   * 基盤モデルID
   * @default anthropic.claude-3-5-sonnet-20240620-v1:0
   */
  foundationModel?: string;

  /**
   * Agent Instruction（プロンプト）
   */
  instruction: string;

  /**
   * Knowledge Base ARN（オプション）
   */
  knowledgeBaseArn?: string;

  /**
   * Action Groups（オプション）
   */
  actionGroups?: BedrockAgentActionGroup[];

  /**
   * アイドルセッションタイムアウト（秒）
   * @default 600
   */
  idleSessionTTLInSeconds?: number;

  /**
   * Guardrail ARN（オプション - Phase 5）
   * SecurityStackから取得したGuardrail ARNを指定
   */
  guardrailArn?: string;

  /**
   * Guardrail Version（オプション - Phase 5）
   * @default DRAFT
   */
  guardrailVersion?: string;
}

export interface BedrockAgentActionGroup {
  /**
   * Action Group名
   */
  actionGroupName: string;

  /**
   * Action Group説明
   */
  description?: string;

  /**
   * Lambda関数ARN
   */
  actionGroupExecutor: string;

  /**
   * OpenAPI 3.0スキーマ（S3パスまたはインラインスキーマ）
   */
  apiSchema: {
    /**
     * S3バケット名
     */
    s3BucketName?: string;

    /**
     * S3オブジェクトキー
     */
    s3ObjectKey?: string;

    /**
     * インラインスキーマ（JSON文字列）
     */
    payload?: string;
  };
}

export class BedrockAgentConstruct extends Construct {
  /**
   * Bedrock Agent
   */
  public readonly agent?: bedrock.CfnAgent;

  /**
   * Agent Alias
   */
  public readonly agentAlias?: bedrock.CfnAgentAlias;

  /**
   * Agent IAMロール
   */
  public readonly agentRole?: iam.Role;

  /**
   * Agent ARN
   */
  public readonly agentArn?: string;

  /**
   * Agent Alias ARN
   */
  public readonly agentAliasArn?: string;

  constructor(scope: Construct, id: string, props: BedrockAgentConstructProps) {
    super(scope, id);

    // enabledフラグがfalseの場合、何も作成しない
    if (!props.enabled) {
      return;
    }

    // Agent IAMロール作成
    this.agentRole = this.createAgentRole(props);

    // Bedrock Agent作成
    this.agent = this.createAgent(props);

    // Agent Alias作成
    this.agentAlias = this.createAgentAlias(props);

    // ARN設定
    this.agentArn = this.agent.attrAgentArn;
    this.agentAliasArn = this.agentAlias.attrAgentAliasArn;

    // CloudFormation出力
    new cdk.CfnOutput(this, 'AgentArn', {
      value: this.agentArn,
      description: 'Bedrock Agent ARN',
      exportName: `${props.projectName}-${props.environment}-agent-arn`,
    });

    new cdk.CfnOutput(this, 'AgentAliasArn', {
      value: this.agentAliasArn,
      description: 'Bedrock Agent Alias ARN',
      exportName: `${props.projectName}-${props.environment}-agent-alias-arn`,
    });
  }

  /**
   * Agent IAMロール作成
   */
  private createAgentRole(props: BedrockAgentConstructProps): iam.Role {
    const role = new iam.Role(this, 'AgentRole', {
      roleName: `${props.projectName}-${props.environment}-bedrock-agent-role`,
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'IAM role for Bedrock Agent',
    });

    // Bedrock基本権限
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: [
          `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/${
            props.foundationModel || 'anthropic.claude-3-5-sonnet-20240620-v1:0'
          }`,
        ],
      })
    );

    // Bedrock Agent Runtime権限（今回の修正で追加）
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock-agent-runtime:InvokeAgent',
          'bedrock-agent-runtime:Retrieve',
        ],
        resources: ['*'], // Agent ARNは作成後に決まるため、ワイルドカードを使用
      })
    );

    // Bedrock Agent管理権限（Agent Info API用 - 2025-12-12修正）
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          // Agent情報取得に必要な権限（bedrock名前空間）
          'bedrock:GetAgent',
          'bedrock:ListAgentAliases',
          'bedrock:GetAgentAlias',
            'bedrock:UpdateAgent',
            'bedrock:PrepareAgent',
          // 従来のbedrock-agent権限も維持（互換性のため）
          'bedrock-agent:GetAgent',
          'bedrock-agent:ListAgents',
          'bedrock-agent:UpdateAgent',
          'bedrock-agent:PrepareAgent',
        ],
        resources: ['*'],
      })
    );

    // IAM PassRole権限（Bedrock Agent更新時に必要）
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'iam:PassRole',
        ],
        resources: [
          `arn:aws:iam::${Stack.of(this).account}:role/*bedrock-agent-role*`,
        ],
      })
    );

    // Knowledge Base権限（指定されている場合）
    if (props.knowledgeBaseArn) {
      role.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['bedrock:Retrieve', 'bedrock:RetrieveAndGenerate'],
          resources: [props.knowledgeBaseArn],
        })
      );
    }

    // Action Groups Lambda実行権限（指定されている場合）
    if (props.actionGroups && props.actionGroups.length > 0) {
      const lambdaArns = props.actionGroups.map((ag) => ag.actionGroupExecutor);
      role.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: lambdaArns,
        })
      );
    }

    return role;
  }

  /**
   * Bedrock Agent作成
   */
  private createAgent(props: BedrockAgentConstructProps): bedrock.CfnAgent {
    const agentConfig: any = {
      agentName: props.agentName,
      agentResourceRoleArn: this.agentRole!.roleArn,
      foundationModel: props.foundationModel || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      instruction: props.instruction,
      description: props.agentDescription,
      idleSessionTtlInSeconds: props.idleSessionTTLInSeconds || 600,
    };

    // Guardrails設定（Phase 5 - SecurityStackから取得）
    if (props.guardrailArn) {
      agentConfig.guardrailConfiguration = {
        guardrailIdentifier: props.guardrailArn,
        guardrailVersion: props.guardrailVersion || 'DRAFT',
      };
    }

    const agent = new bedrock.CfnAgent(this, 'Agent', agentConfig);

    // Knowledge Base関連付け（指定されている場合）
    if (props.knowledgeBaseArn) {
      agent.knowledgeBases = [
        {
          knowledgeBaseId: this.extractKnowledgeBaseId(props.knowledgeBaseArn),
          description: 'Permission-aware RAG Knowledge Base',
          knowledgeBaseState: 'ENABLED',
        },
      ];
    }

    // Action Groups設定（指定されている場合）
    if (props.actionGroups && props.actionGroups.length > 0) {
      agent.actionGroups = props.actionGroups.map((ag) => ({
        actionGroupName: ag.actionGroupName,
        description: ag.description,
        actionGroupExecutor: {
          lambda: ag.actionGroupExecutor,
        },
        apiSchema: ag.apiSchema.s3BucketName
          ? {
              s3: {
                s3BucketName: ag.apiSchema.s3BucketName,
                s3ObjectKey: ag.apiSchema.s3ObjectKey,
              },
            }
          : {
              payload: ag.apiSchema.payload,
            },
      }));
    }

    return agent;
  }

  /**
   * Agent Alias作成
   */
  private createAgentAlias(props: BedrockAgentConstructProps): bedrock.CfnAgentAlias {
    return new bedrock.CfnAgentAlias(this, 'AgentAlias', {
      agentId: this.agent!.attrAgentId,
      agentAliasName: `${props.environment}-alias`,
      description: `${props.environment} environment alias`,
    });
  }

  /**
   * Knowledge Base ARNからIDを抽出
   */
  private extractKnowledgeBaseId(arn: string): string {
    // ARN形式: arn:aws:bedrock:{region}:{account}:knowledge-base/{id}
    const parts = arn.split('/');
    return parts[parts.length - 1];
  }
}
