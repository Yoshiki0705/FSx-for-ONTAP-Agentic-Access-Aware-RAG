/**
 * Bedrock Agent 動的コンストラクト
 * モデル設定の動的変更に対応した次世代Bedrock Agentコンストラクト
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';
import { BedrockModelConfig } from '../../../config/bedrock-model-config';

export interface BedrockAgentDynamicConstructProps {
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
   * Agent Instruction（プロンプト）
   */
  instruction: string;

  /**
   * 使用ケース（モデル選択に影響）
   */
  useCase?: 'chat' | 'generation' | 'costEffective' | 'multimodal';

  /**
   * モデル要件
   */
  modelRequirements?: {
    onDemand?: boolean;
    streaming?: boolean;
    crossRegion?: boolean;
    inputModalities?: string[];
  };

  /**
   * 動的モデル選択を有効化するか
   * @default true
   */
  enableDynamicModelSelection?: boolean;

  /**
   * モデル設定の自動更新を有効化するか
   * @default true
   */
  enableAutoUpdate?: boolean;

  /**
   * 外部設定ファイルのパス（オプション）
   */
  configFilePath?: string;

  /**
   * Parameter Store設定プレフィックス（オプション）
   */
  parameterStorePrefix?: string;

  /**
   * Knowledge Base ARN（オプション）
   */
  knowledgeBaseArn?: string;

  /**
   * Action Groups（オプション）
   */
  actionGroups?: BedrockAgentActionGroup[];

  /**
   * カスタムモデル設定（オプション）
   */
  customModelConfig?: {
    providers?: any[];
    families?: any[];
    regions?: any[];
  };
}

export interface BedrockAgentActionGroup {
  actionGroupName: string;
  description?: string;
  actionGroupExecutor: string;
  apiSchema: {
    s3BucketName?: string;
    s3ObjectKey?: string;
    payload?: string;
  };
}

export class BedrockAgentDynamicConstruct extends Construct {
  /**
   * Bedrock Agent
   */
  public readonly agent: bedrock.CfnAgent;

  /**
   * Agent Alias
   */
  public readonly agentAlias: bedrock.CfnAgentAlias;

  /**
   * Agent IAMロール
   */
  public readonly agentRole: iam.Role;

  /**
   * 選択されたモデルID
   */
  public readonly selectedModel: string;

  /**
   * モデル設定管理
   */
  private readonly modelConfig: BedrockModelConfig;

  /**
   * モデル更新Lambda関数
   */
  public modelUpdateFunction?: lambda.Function;

  /**
   * 設定監視Lambda関数
   */
  public configWatcherFunction?: lambda.Function;

  constructor(scope: Construct, id: string, props: BedrockAgentDynamicConstructProps) {
    super(scope, id);

    // モデル設定管理の初期化
    this.modelConfig = BedrockModelConfig.getInstance();

    // カスタム設定の適用
    if (props.customModelConfig) {
      this.applyCustomConfig(props.customModelConfig);
    }

    // 外部設定の読み込み
    if (props.configFilePath) {
      this.modelConfig.loadFromFile(props.configFilePath);
    }

    // 最適なモデルを選択
    this.selectedModel = this.selectOptimalModel(props);

    // Agent IAMロール作成
    this.agentRole = this.createDynamicAgentRole(props);

    // Bedrock Agent作成
    this.agent = this.createDynamicAgent(props);

    // Agent Alias作成
    this.agentAlias = this.createDynamicAgentAlias(props);

    // 動的更新機能の設定
    if (props.enableAutoUpdate) {
      this.setupAutoUpdate(props);
    }

    // Parameter Store設定の作成
    this.createParameterStoreConfig(props);

    // CloudFormation出力
    this.createOutputs(props);
  }

  /**
   * 最適なモデルを選択
   */
  private selectOptimalModel(props: BedrockAgentDynamicConstructProps): string {
    const region = cdk.Stack.of(this).region;
    const useCase = props.useCase || 'chat';
    const requirements = props.modelRequirements || {
      onDemand: true,
      streaming: true,
    };

    const optimalModel = this.modelConfig.getOptimalModel(region, useCase, requirements);
    
    if (!optimalModel) {
      // フォールバック: 安全なデフォルトモデル
      console.warn(`リージョン ${region} で要件を満たすモデルが見つかりません。デフォルトモデルを使用します。`);
      return 'anthropic.claude-3-haiku-20240307-v1:0';
    }

    return optimalModel;
  }

  /**
   * カスタム設定の適用
   */
  private applyCustomConfig(customConfig: any): void {
    // カスタムプロバイダーの追加
    if (customConfig.providers) {
      customConfig.providers.forEach((provider: any) => {
        this.modelConfig.addProvider(provider.name, provider);
      });
    }

    // カスタムモデルファミリーの追加
    if (customConfig.families) {
      customConfig.families.forEach((family: any) => {
        this.modelConfig.addModelFamily(family.name, family);
      });
    }
  }

  /**
   * 動的Agent IAMロール作成
   */
  private createDynamicAgentRole(props: BedrockAgentDynamicConstructProps): iam.Role {
    const role = new iam.Role(this, 'DynamicAgentRole', {
      roleName: `${props.projectName}-${props.environment}-bedrock-agent-dynamic-role`,
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Dynamic IAM role for Bedrock Agent with adaptive permissions',
    });

    // 基本的なBedrock権限（全モデル対応）
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
          'bedrock:ListFoundationModels',
          'bedrock:GetFoundationModel',
        ],
        resources: ['*'], // 動的モデル対応のため全モデルを許可
      })
    );

    // Bedrock Agent Runtime権限（Agent Info API用 - 2025-12-12修正）
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeAgent', // 2025-12-12修正: bedrock:InvokeAgent権限追加
          'bedrock-agent-runtime:InvokeAgent',
          'bedrock-agent-runtime:Retrieve',
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

    // Parameter Store読み取り権限（動的設定用）
    if (props.parameterStorePrefix) {
      role.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ssm:GetParameter',
            'ssm:GetParameters',
            'ssm:GetParametersByPath',
          ],
          resources: [
            `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${props.parameterStorePrefix}/*`,
          ],
        })
      );
    }

    // CloudWatch Logs権限
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    return role;
  }

  /**
   * 動的Bedrock Agent作成
   */
  private createDynamicAgent(props: BedrockAgentDynamicConstructProps): bedrock.CfnAgent {
    const agentConfig: any = {
      agentName: props.agentName,
      agentResourceRoleArn: this.agentRole.roleArn,
      foundationModel: this.selectedModel,
      instruction: props.instruction,
      description: props.agentDescription || `Dynamic Bedrock Agent - Model: ${this.selectedModel}`,
      idleSessionTtlInSeconds: 600,
      testAliasTags: {
        Environment: props.environment,
        ModelSelection: 'dynamic',
        SelectedModel: this.selectedModel,
        UseCase: props.useCase || 'chat',
        LastUpdated: new Date().toISOString(),
      },
    };

    const agent = new bedrock.CfnAgent(this, 'DynamicAgent', agentConfig);

    // Knowledge Base関連付け
    if (props.knowledgeBaseArn) {
      agent.knowledgeBases = [
        {
          knowledgeBaseId: this.extractKnowledgeBaseId(props.knowledgeBaseArn),
          description: 'Dynamic Knowledge Base Integration',
          knowledgeBaseState: 'ENABLED',
        },
      ];
    }

    // Action Groups設定
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
   * 動的Agent Alias作成
   */
  private createDynamicAgentAlias(props: BedrockAgentDynamicConstructProps): bedrock.CfnAgentAlias {
    return new bedrock.CfnAgentAlias(this, 'DynamicAgentAlias', {
      agentId: this.agent.attrAgentId,
      agentAliasName: `${props.environment}-dynamic-alias`,
      description: `Dynamic ${props.environment} environment alias - Auto-updating model selection`,
      tags: {
        Environment: props.environment,
        ModelSelection: 'dynamic',
        SelectedModel: this.selectedModel,
        UseCase: props.useCase || 'chat',
        LastUpdated: new Date().toISOString(),
        AutoUpdate: props.enableAutoUpdate ? 'enabled' : 'disabled',
      },
    });
  }

  /**
   * 自動更新機能の設定
   */
  private setupAutoUpdate(props: BedrockAgentDynamicConstructProps): void {
    // モデル更新Lambda関数
    this.modelUpdateFunction = new lambda.Function(this, 'ModelUpdateFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import boto3
import json
import logging
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    try:
        bedrock_agent = boto3.client('bedrock-agent')
        ssm = boto3.client('ssm')
        
        agent_id = os.environ['AGENT_ID']
        parameter_prefix = os.environ.get('PARAMETER_PREFIX', '/bedrock-agent/config')
        
        # Parameter Storeから最新の設定を取得
        try:
            response = ssm.get_parameters_by_path(
                Path=parameter_prefix,
                Recursive=True
            )
            
            config = {}
            for param in response['Parameters']:
                key = param['Name'].split('/')[-1]
                config[key] = param['Value']
            
            # 新しいモデルIDを取得
            new_model_id = config.get('selected_model')
            if not new_model_id:
                logger.warning('No model ID found in configuration')
                return {'Status': 'SKIPPED', 'Reason': 'No model configuration found'}
            
            # 現在のAgent設定を取得
            current_agent = bedrock_agent.get_agent(agentId=agent_id)
            current_model = current_agent['agent']['foundationModel']
            
            # モデルが変更されている場合のみ更新
            if current_model != new_model_id:
                logger.info(f'Updating agent model from {current_model} to {new_model_id}')
                
                # Agent設定を更新
                bedrock_agent.update_agent(
                    agentId=agent_id,
                    foundationModel=new_model_id,
                    agentName=current_agent['agent']['agentName'],
                    instruction=current_agent['agent']['instruction'],
                    agentResourceRoleArn=current_agent['agent']['agentResourceRoleArn']
                )
                
                # Agent準備
                bedrock_agent.prepare_agent(agentId=agent_id)
                
                logger.info(f'Agent {agent_id} updated successfully')
                return {
                    'Status': 'SUCCESS',
                    'PreviousModel': current_model,
                    'NewModel': new_model_id,
                    'AgentId': agent_id
                }
            else:
                logger.info('No model update needed')
                return {'Status': 'NO_CHANGE', 'CurrentModel': current_model}
                
        except Exception as e:
            logger.error(f'Error reading configuration: {str(e)}')
            return {'Status': 'FAILED', 'Reason': f'Configuration error: {str(e)}'}
            
    except Exception as e:
        logger.error(f'Error updating agent: {str(e)}')
        return {'Status': 'FAILED', 'Reason': str(e)}
      `),
      timeout: cdk.Duration.minutes(5),
      environment: {
        AGENT_ID: this.agent.attrAgentId,
        PARAMETER_PREFIX: props.parameterStorePrefix || '/bedrock-agent/config',
      },
      description: 'Lambda function for dynamic Bedrock Agent model updates',
    });

    // Lambda関数の権限
    this.modelUpdateFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock-agent:GetAgent',
          'bedrock-agent:UpdateAgent',
          'bedrock-agent:PrepareAgent',
        ],
        resources: [this.agent.attrAgentArn],
      })
    );

    if (props.parameterStorePrefix) {
      this.modelUpdateFunction.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ssm:GetParameter',
            'ssm:GetParameters',
            'ssm:GetParametersByPath',
          ],
          resources: [
            `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${props.parameterStorePrefix}/*`,
          ],
        })
      );
    }

    // 設定監視Lambda関数（Parameter Store変更を監視）
    this.configWatcherFunction = new lambda.Function(this, 'ConfigWatcherFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import boto3
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    try:
        lambda_client = boto3.client('lambda')
        
        # Parameter Store変更イベントを処理
        for record in event.get('Records', []):
            if record.get('eventSource') == 'aws:ssm':
                parameter_name = record['eventSourceARN'].split('/')[-1]
                logger.info(f'Parameter {parameter_name} changed, triggering model update')
                
                # モデル更新Lambda関数を呼び出し
                lambda_client.invoke(
                    FunctionName=os.environ['MODEL_UPDATE_FUNCTION'],
                    InvocationType='Event'
                )
                
        return {'Status': 'SUCCESS'}
    except Exception as e:
        logger.error(f'Error in config watcher: {str(e)}')
        return {'Status': 'FAILED', 'Reason': str(e)}
      `),
      timeout: cdk.Duration.minutes(2),
      environment: {
        MODEL_UPDATE_FUNCTION: this.modelUpdateFunction.functionName,
      },
      description: 'Lambda function for monitoring configuration changes',
    });

    // 設定監視Lambda関数の権限
    this.configWatcherFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [this.modelUpdateFunction.functionArn],
      })
    );

    // EventBridge Rule（定期的なモデル最適化チェック）
    const optimizationRule = new events.Rule(this, 'ModelOptimizationRule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(24)), // 24時間ごと
      description: 'Daily model optimization check',
    });

    optimizationRule.addTarget(new targets.LambdaFunction(this.modelUpdateFunction));
  }

  /**
   * Parameter Store設定の作成
   */
  private createParameterStoreConfig(props: BedrockAgentDynamicConstructProps): void {
    const prefix = props.parameterStorePrefix || '/bedrock-agent/config';

    // 選択されたモデル
    new ssm.StringParameter(this, 'SelectedModelParameter', {
      parameterName: `${prefix}/selected_model`,
      stringValue: this.selectedModel,
      description: 'Currently selected Bedrock model',
    });

    // 使用ケース
    new ssm.StringParameter(this, 'UseCaseParameter', {
      parameterName: `${prefix}/use_case`,
      stringValue: props.useCase || 'chat',
      description: 'Current use case for model selection',
    });

    // モデル要件
    new ssm.StringParameter(this, 'ModelRequirementsParameter', {
      parameterName: `${prefix}/model_requirements`,
      stringValue: JSON.stringify(props.modelRequirements || {}),
      description: 'Model requirements configuration',
    });

    // 最終更新日時
    new ssm.StringParameter(this, 'LastUpdatedParameter', {
      parameterName: `${prefix}/last_updated`,
      stringValue: new Date().toISOString(),
      description: 'Last configuration update timestamp',
    });
  }

  /**
   * CloudFormation出力作成
   */
  private createOutputs(props: BedrockAgentDynamicConstructProps): void {
    new cdk.CfnOutput(this, 'DynamicAgentArn', {
      value: this.agent.attrAgentArn,
      description: 'Dynamic Bedrock Agent ARN',
      exportName: `${props.projectName}-${props.environment}-dynamic-agent-arn`,
    });

    new cdk.CfnOutput(this, 'DynamicAgentAliasArn', {
      value: this.agentAlias.attrAgentAliasArn,
      description: 'Dynamic Bedrock Agent Alias ARN',
      exportName: `${props.projectName}-${props.environment}-dynamic-agent-alias-arn`,
    });

    new cdk.CfnOutput(this, 'SelectedFoundationModel', {
      value: this.selectedModel,
      description: 'Dynamically selected Foundation Model ID',
      exportName: `${props.projectName}-${props.environment}-selected-model`,
    });

    if (this.modelUpdateFunction) {
      new cdk.CfnOutput(this, 'ModelUpdateFunctionArn', {
        value: this.modelUpdateFunction.functionArn,
        description: 'Model Update Function ARN',
        exportName: `${props.projectName}-${props.environment}-model-update-function-arn`,
      });
    }

    // Parameter Store設定パス
    new cdk.CfnOutput(this, 'ParameterStorePrefix', {
      value: props.parameterStorePrefix || '/bedrock-agent/config',
      description: 'Parameter Store configuration prefix',
      exportName: `${props.projectName}-${props.environment}-parameter-prefix`,
    });
  }

  /**
   * Knowledge Base ARNからIDを抽出
   */
  private extractKnowledgeBaseId(arn: string): string {
    const parts = arn.split('/');
    return parts[parts.length - 1];
  }

  /**
   * 新しいモデルを動的に追加
   */
  public addNewModel(familyName: string, modelVersion: any): void {
    this.modelConfig.addModelVersion(familyName, modelVersion);
  }

  /**
   * モデルを非推奨に設定
   */
  public deprecateModel(modelId: string, replacementModel?: string): void {
    this.modelConfig.deprecateModel(modelId, replacementModel);
  }

  /**
   * Lambda関数にBedrock Agent権限を付与するヘルパーメソッド
   */
  public grantInvokeToLambda(lambdaFunction: lambda.Function): void {
    lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeAgent', // 2025-12-12修正: bedrock:InvokeAgent権限追加
          'bedrock-agent-runtime:InvokeAgent',
          'bedrock-agent-runtime:Retrieve',
          // Agent情報取得に必要な権限（bedrock名前空間）
          'bedrock:GetAgent',
          'bedrock:ListAgentAliases',
          'bedrock:GetAgentAlias',
            'bedrock:UpdateAgent',
            'bedrock:PrepareAgent',
          // 従来のbedrock-agent権限も維持（互換性のため）
          'bedrock-agent:GetAgent',
          'bedrock-agent:ListAgents',
        ],
        resources: [
          this.agent.attrAgentArn,
          this.agentAlias.attrAgentAliasArn,
        ],
      })
    );

    // 動的モデル対応のため全モデルへのアクセス権限
    lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
          'bedrock:ListFoundationModels',
          'bedrock:GetFoundationModel',
        ],
        resources: ['*'],
      })
    );
  }
}