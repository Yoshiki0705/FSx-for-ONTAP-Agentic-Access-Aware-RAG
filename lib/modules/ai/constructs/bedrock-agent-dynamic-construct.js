"use strict";
/**
 * Bedrock Agent 動的コンストラクト
 * モデル設定の動的変更に対応した次世代Bedrock Agentコンストラクト
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockAgentDynamicConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const constructs_1 = require("constructs");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const bedrock_model_config_1 = require("../../../config/bedrock-model-config");
class BedrockAgentDynamicConstruct extends constructs_1.Construct {
    /**
     * Bedrock Agent
     */
    agent;
    /**
     * Agent Alias
     */
    agentAlias;
    /**
     * Agent IAMロール
     */
    agentRole;
    /**
     * 選択されたモデルID
     */
    selectedModel;
    /**
     * モデル設定管理
     */
    modelConfig;
    /**
     * モデル更新Lambda関数
     */
    modelUpdateFunction;
    /**
     * 設定監視Lambda関数
     */
    configWatcherFunction;
    constructor(scope, id, props) {
        super(scope, id);
        // モデル設定管理の初期化
        this.modelConfig = bedrock_model_config_1.BedrockModelConfig.getInstance();
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
    selectOptimalModel(props) {
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
    applyCustomConfig(customConfig) {
        // カスタムプロバイダーの追加
        if (customConfig.providers) {
            customConfig.providers.forEach((provider) => {
                this.modelConfig.addProvider(provider.name, provider);
            });
        }
        // カスタムモデルファミリーの追加
        if (customConfig.families) {
            customConfig.families.forEach((family) => {
                this.modelConfig.addModelFamily(family.name, family);
            });
        }
    }
    /**
     * 動的Agent IAMロール作成
     */
    createDynamicAgentRole(props) {
        const role = new iam.Role(this, 'DynamicAgentRole', {
            roleName: `${props.projectName}-${props.environment}-bedrock-agent-dynamic-role`,
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            description: 'Dynamic IAM role for Bedrock Agent with adaptive permissions',
        });
        // 基本的なBedrock権限（全モデル対応）
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
                'bedrock:ListFoundationModels',
                'bedrock:GetFoundationModel',
            ],
            resources: ['*'], // 動的モデル対応のため全モデルを許可
        }));
        // Bedrock Agent Runtime権限（Agent Info API用 - 2025-12-12修正）
        role.addToPolicy(new iam.PolicyStatement({
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
        }));
        // IAM PassRole権限（Bedrock Agent更新時に必要）
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'iam:PassRole',
            ],
            resources: [
                `arn:aws:iam::${aws_cdk_lib_1.Stack.of(this).account}:role/*bedrock-agent-role*`,
            ],
        }));
        // Parameter Store読み取り権限（動的設定用）
        if (props.parameterStorePrefix) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'ssm:GetParameter',
                    'ssm:GetParameters',
                    'ssm:GetParametersByPath',
                ],
                resources: [
                    `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${props.parameterStorePrefix}/*`,
                ],
            }));
        }
        // CloudWatch Logs権限
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
            ],
            resources: ['*'],
        }));
        return role;
    }
    /**
     * 動的Bedrock Agent作成
     */
    createDynamicAgent(props) {
        const agentConfig = {
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
    createDynamicAgentAlias(props) {
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
    setupAutoUpdate(props) {
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
        this.modelUpdateFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock-agent:GetAgent',
                'bedrock-agent:UpdateAgent',
                'bedrock-agent:PrepareAgent',
            ],
            resources: [this.agent.attrAgentArn],
        }));
        if (props.parameterStorePrefix) {
            this.modelUpdateFunction.addToRolePolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'ssm:GetParameter',
                    'ssm:GetParameters',
                    'ssm:GetParametersByPath',
                ],
                resources: [
                    `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${props.parameterStorePrefix}/*`,
                ],
            }));
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
        this.configWatcherFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['lambda:InvokeFunction'],
            resources: [this.modelUpdateFunction.functionArn],
        }));
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
    createParameterStoreConfig(props) {
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
    createOutputs(props) {
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
    extractKnowledgeBaseId(arn) {
        const parts = arn.split('/');
        return parts[parts.length - 1];
    }
    /**
     * 新しいモデルを動的に追加
     */
    addNewModel(familyName, modelVersion) {
        this.modelConfig.addModelVersion(familyName, modelVersion);
    }
    /**
     * モデルを非推奨に設定
     */
    deprecateModel(modelId, replacementModel) {
        this.modelConfig.deprecateModel(modelId, replacementModel);
    }
    /**
     * Lambda関数にBedrock Agent権限を付与するヘルパーメソッド
     */
    grantInvokeToLambda(lambdaFunction) {
        lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
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
        }));
        // 動的モデル対応のため全モデルへのアクセス権限
        lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
                'bedrock:ListFoundationModels',
                'bedrock:GetFoundationModel',
            ],
            resources: ['*'],
        }));
    }
}
exports.BedrockAgentDynamicConstruct = BedrockAgentDynamicConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1keW5hbWljLWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2stYWdlbnQtZHluYW1pYy1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMseURBQTJDO0FBQzNDLGlFQUFtRDtBQUNuRCwrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFDMUQsMkNBQXVDO0FBQ3ZDLDZDQUFvQztBQUNwQywrRUFBMEU7QUFnRzFFLE1BQWEsNEJBQTZCLFNBQVEsc0JBQVM7SUFDekQ7O09BRUc7SUFDYSxLQUFLLENBQW1CO0lBRXhDOztPQUVHO0lBQ2EsVUFBVSxDQUF3QjtJQUVsRDs7T0FFRztJQUNhLFNBQVMsQ0FBVztJQUVwQzs7T0FFRztJQUNhLGFBQWEsQ0FBUztJQUV0Qzs7T0FFRztJQUNjLFdBQVcsQ0FBcUI7SUFFakQ7O09BRUc7SUFDSSxtQkFBbUIsQ0FBbUI7SUFFN0M7O09BRUc7SUFDSSxxQkFBcUIsQ0FBbUI7SUFFL0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF3QztRQUNoRixLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLGNBQWM7UUFDZCxJQUFJLENBQUMsV0FBVyxHQUFHLHlDQUFrQixDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRXBELFlBQVk7UUFDWixJQUFJLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzVCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNsRCxDQUFDO1FBRUQsWUFBWTtRQUNaLElBQUksS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3pCLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FB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SUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZO2dCQUN2QixJQUFJLENBQUMsVUFBVSxDQUFDLGlCQUFpQjthQUNsQztTQUNGLENBQUMsQ0FDSCxDQUFDO1FBRUYseUJBQXlCO1FBQ3pCLGNBQWMsQ0FBQyxlQUFlLENBQzVCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxxQkFBcUI7Z0JBQ3JCLHVDQUF1QztnQkFDdkMsOEJBQThCO2dCQUM5Qiw0QkFBNEI7YUFDN0I7WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0NBQ0Y7QUF6bEJELG9FQXlsQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEJlZHJvY2sgQWdlbnQg5YuV55qE44Kz44Oz44K544OI44Op44Kv44OIXG4gKiDjg6Ljg4fjg6voqK3lrprjga7li5XnmoTlpInmm7Tjgavlr77lv5zjgZfjgZ/mrKHkuJbku6NCZWRyb2NrIEFnZW5044Kz44Oz44K544OI44Op44Kv44OIXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGJlZHJvY2sgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJlZHJvY2snO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgc3NtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zc20nO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBTdGFjayB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IEJlZHJvY2tNb2RlbENvbmZpZyB9IGZyb20gJy4uLy4uLy4uL2NvbmZpZy9iZWRyb2NrLW1vZGVsLWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdFByb3BzIHtcbiAgLyoqXG4gICAqIOODl+ODreOCuOOCp+OCr+ODiOWQjVxuICAgKi9cbiAgcHJvamVjdE5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICog55Kw5aKD5ZCNXG4gICAqL1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBZ2VudOWQjVxuICAgKi9cbiAgYWdlbnROYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEFnZW506Kqs5piOXG4gICAqL1xuICBhZ2VudERlc2NyaXB0aW9uPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBZ2VudCBJbnN0cnVjdGlvbu+8iOODl+ODreODs+ODl+ODiO+8iVxuICAgKi9cbiAgaW5zdHJ1Y3Rpb246IHN0cmluZztcblxuICAvKipcbiAgICog5L2/55So44Kx44O844K577yI44Oi44OH44Or6YG45oqe44Gr5b2x6Z+/77yJXG4gICAqL1xuICB1c2VDYXNlPzogJ2NoYXQnIHwgJ2dlbmVyYXRpb24nIHwgJ2Nvc3RFZmZlY3RpdmUnIHwgJ211bHRpbW9kYWwnO1xuXG4gIC8qKlxuICAgKiDjg6Ljg4fjg6vopoHku7ZcbiAgICovXG4gIG1vZGVsUmVxdWlyZW1lbnRzPzoge1xuICAgIG9uRGVtYW5kPzogYm9vbGVhbjtcbiAgICBzdHJlYW1pbmc/OiBib29sZWFuO1xuICAgIGNyb3NzUmVnaW9uPzogYm9vbGVhbjtcbiAgICBpbnB1dE1vZGFsaXRpZXM/OiBzdHJpbmdbXTtcbiAgfTtcblxuICAvKipcbiAgICog5YuV55qE44Oi44OH44Or6YG45oqe44KS5pyJ5Yq55YyW44GZ44KL44GLXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIGVuYWJsZUR5bmFtaWNNb2RlbFNlbGVjdGlvbj86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOODouODh+ODq+ioreWumuOBruiHquWLleabtOaWsOOCkuacieWKueWMluOBmeOCi+OBi1xuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICBlbmFibGVBdXRvVXBkYXRlPzogYm9vbGVhbjtcblxuICAvKipcbiAgICog5aSW6YOo6Kit5a6a44OV44Kh44Kk44Or44Gu44OR44K577yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICBjb25maWdGaWxlUGF0aD86IHN0cmluZztcblxuICAvKipcbiAgICogUGFyYW1ldGVyIFN0b3Jl6Kit5a6a44OX44Os44OV44Kj44OD44Kv44K577yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICBwYXJhbWV0ZXJTdG9yZVByZWZpeD86IHN0cmluZztcblxuICAvKipcbiAgICogS25vd2xlZGdlIEJhc2UgQVJO77yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICBrbm93bGVkZ2VCYXNlQXJuPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBY3Rpb24gR3JvdXBz77yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICBhY3Rpb25Hcm91cHM/OiBCZWRyb2NrQWdlbnRBY3Rpb25Hcm91cFtdO1xuXG4gIC8qKlxuICAgKiDjgqvjgrnjgr/jg6Djg6Ljg4fjg6voqK3lrprvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICovXG4gIGN1c3RvbU1vZGVsQ29uZmlnPzoge1xuICAgIHByb3ZpZGVycz86IGFueVtdO1xuICAgIGZhbWlsaWVzPzogYW55W107XG4gICAgcmVnaW9ucz86IGFueVtdO1xuICB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJlZHJvY2tBZ2VudEFjdGlvbkdyb3VwIHtcbiAgYWN0aW9uR3JvdXBOYW1lOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICBhY3Rpb25Hcm91cEV4ZWN1dG9yOiBzdHJpbmc7XG4gIGFwaVNjaGVtYToge1xuICAgIHMzQnVja2V0TmFtZT86IHN0cmluZztcbiAgICBzM09iamVjdEtleT86IHN0cmluZztcbiAgICBwYXlsb2FkPzogc3RyaW5nO1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIC8qKlxuICAgKiBCZWRyb2NrIEFnZW50XG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYWdlbnQ6IGJlZHJvY2suQ2ZuQWdlbnQ7XG5cbiAgLyoqXG4gICAqIEFnZW50IEFsaWFzXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYWdlbnRBbGlhczogYmVkcm9jay5DZm5BZ2VudEFsaWFzO1xuXG4gIC8qKlxuICAgKiBBZ2VudCBJQU3jg63jg7zjg6tcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBhZ2VudFJvbGU6IGlhbS5Sb2xlO1xuXG4gIC8qKlxuICAgKiDpgbjmip7jgZXjgozjgZ/jg6Ljg4fjg6tJRFxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHNlbGVjdGVkTW9kZWw6IHN0cmluZztcblxuICAvKipcbiAgICog44Oi44OH44Or6Kit5a6a566h55CGXG4gICAqL1xuICBwcml2YXRlIHJlYWRvbmx5IG1vZGVsQ29uZmlnOiBCZWRyb2NrTW9kZWxDb25maWc7XG5cbiAgLyoqXG4gICAqIOODouODh+ODq+abtOaWsExhbWJkYemWouaVsFxuICAgKi9cbiAgcHVibGljIG1vZGVsVXBkYXRlRnVuY3Rpb24/OiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgLyoqXG4gICAqIOioreWumuebo+imlkxhbWJkYemWouaVsFxuICAgKi9cbiAgcHVibGljIGNvbmZpZ1dhdGNoZXJGdW5jdGlvbj86IGxhbWJkYS5GdW5jdGlvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIOODouODh+ODq+ioreWumueuoeeQhuOBruWIneacn+WMllxuICAgIHRoaXMubW9kZWxDb25maWcgPSBCZWRyb2NrTW9kZWxDb25maWcuZ2V0SW5zdGFuY2UoKTtcblxuICAgIC8vIOOCq+OCueOCv+ODoOioreWumuOBrumBqeeUqFxuICAgIGlmIChwcm9wcy5jdXN0b21Nb2RlbENvbmZpZykge1xuICAgICAgdGhpcy5hcHBseUN1c3RvbUNvbmZpZyhwcm9wcy5jdXN0b21Nb2RlbENvbmZpZyk7XG4gICAgfVxuXG4gICAgLy8g5aSW6YOo6Kit5a6a44Gu6Kqt44G/6L6844G/XG4gICAgaWYgKHByb3BzLmNvbmZpZ0ZpbGVQYXRoKSB7XG4gICAgICB0aGlzLm1vZGVsQ29uZmlnLmxvYWRGcm9tRmlsZShwcm9wcy5jb25maWdGaWxlUGF0aCk7XG4gICAgfVxuXG4gICAgLy8g5pyA6YGp44Gq44Oi44OH44Or44KS6YG45oqeXG4gICAgdGhpcy5zZWxlY3RlZE1vZGVsID0gdGhpcy5zZWxlY3RPcHRpbWFsTW9kZWwocHJvcHMpO1xuXG4gICAgLy8gQWdlbnQgSUFN44Ot44O844Or5L2c5oiQXG4gICAgdGhpcy5hZ2VudFJvbGUgPSB0aGlzLmNyZWF0ZUR5bmFtaWNBZ2VudFJvbGUocHJvcHMpO1xuXG4gICAgLy8gQmVkcm9jayBBZ2VudOS9nOaIkFxuICAgIHRoaXMuYWdlbnQgPSB0aGlzLmNyZWF0ZUR5bmFtaWNBZ2VudChwcm9wcyk7XG5cbiAgICAvLyBBZ2VudCBBbGlhc+S9nOaIkFxuICAgIHRoaXMuYWdlbnRBbGlhcyA9IHRoaXMuY3JlYXRlRHluYW1pY0FnZW50QWxpYXMocHJvcHMpO1xuXG4gICAgLy8g5YuV55qE5pu05paw5qmf6IO944Gu6Kit5a6aXG4gICAgaWYgKHByb3BzLmVuYWJsZUF1dG9VcGRhdGUpIHtcbiAgICAgIHRoaXMuc2V0dXBBdXRvVXBkYXRlKHByb3BzKTtcbiAgICB9XG5cbiAgICAvLyBQYXJhbWV0ZXIgU3RvcmXoqK3lrprjga7kvZzmiJBcbiAgICB0aGlzLmNyZWF0ZVBhcmFtZXRlclN0b3JlQ29uZmlnKHByb3BzKTtcblxuICAgIC8vIENsb3VkRm9ybWF0aW9u5Ye65YqbXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKHByb3BzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmnIDpganjgarjg6Ljg4fjg6vjgpLpgbjmip5cbiAgICovXG4gIHByaXZhdGUgc2VsZWN0T3B0aW1hbE1vZGVsKHByb3BzOiBCZWRyb2NrQWdlbnREeW5hbWljQ29uc3RydWN0UHJvcHMpOiBzdHJpbmcge1xuICAgIGNvbnN0IHJlZ2lvbiA9IGNkay5TdGFjay5vZih0aGlzKS5yZWdpb247XG4gICAgY29uc3QgdXNlQ2FzZSA9IHByb3BzLnVzZUNhc2UgfHwgJ2NoYXQnO1xuICAgIGNvbnN0IHJlcXVpcmVtZW50cyA9IHByb3BzLm1vZGVsUmVxdWlyZW1lbnRzIHx8IHtcbiAgICAgIG9uRGVtYW5kOiB0cnVlLFxuICAgICAgc3RyZWFtaW5nOiB0cnVlLFxuICAgIH07XG5cbiAgICBjb25zdCBvcHRpbWFsTW9kZWwgPSB0aGlzLm1vZGVsQ29uZmlnLmdldE9wdGltYWxNb2RlbChyZWdpb24sIHVzZUNhc2UsIHJlcXVpcmVtZW50cyk7XG4gICAgXG4gICAgaWYgKCFvcHRpbWFsTW9kZWwpIHtcbiAgICAgIC8vIOODleOCqeODvOODq+ODkOODg+OCrzog5a6J5YWo44Gq44OH44OV44Kp44Or44OI44Oi44OH44OrXG4gICAgICBjb25zb2xlLndhcm4oYOODquODvOOCuOODp+ODsyAke3JlZ2lvbn0g44Gn6KaB5Lu244KS5rqA44Gf44GZ44Oi44OH44Or44GM6KaL44Gk44GL44KK44G+44Gb44KT44CC44OH44OV44Kp44Or44OI44Oi44OH44Or44KS5L2/55So44GX44G+44GZ44CCYCk7XG4gICAgICByZXR1cm4gJ2FudGhyb3BpYy5jbGF1ZGUtMy1oYWlrdS0yMDI0MDMwNy12MTowJztcbiAgICB9XG5cbiAgICByZXR1cm4gb3B0aW1hbE1vZGVsO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCq+OCueOCv+ODoOioreWumuOBrumBqeeUqFxuICAgKi9cbiAgcHJpdmF0ZSBhcHBseUN1c3RvbUNvbmZpZyhjdXN0b21Db25maWc6IGFueSk6IHZvaWQge1xuICAgIC8vIOOCq+OCueOCv+ODoOODl+ODreODkOOCpOODgOODvOOBrui/veWKoFxuICAgIGlmIChjdXN0b21Db25maWcucHJvdmlkZXJzKSB7XG4gICAgICBjdXN0b21Db25maWcucHJvdmlkZXJzLmZvckVhY2goKHByb3ZpZGVyOiBhbnkpID0+IHtcbiAgICAgICAgdGhpcy5tb2RlbENvbmZpZy5hZGRQcm92aWRlcihwcm92aWRlci5uYW1lLCBwcm92aWRlcik7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjgqvjgrnjgr/jg6Djg6Ljg4fjg6vjg5XjgqHjg5/jg6rjg7zjga7ov73liqBcbiAgICBpZiAoY3VzdG9tQ29uZmlnLmZhbWlsaWVzKSB7XG4gICAgICBjdXN0b21Db25maWcuZmFtaWxpZXMuZm9yRWFjaCgoZmFtaWx5OiBhbnkpID0+IHtcbiAgICAgICAgdGhpcy5tb2RlbENvbmZpZy5hZGRNb2RlbEZhbWlseShmYW1pbHkubmFtZSwgZmFtaWx5KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDli5XnmoRBZ2VudCBJQU3jg63jg7zjg6vkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRHluYW1pY0FnZW50Um9sZShwcm9wczogQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdFByb3BzKTogaWFtLlJvbGUge1xuICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0R5bmFtaWNBZ2VudFJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWJlZHJvY2stYWdlbnQtZHluYW1pYy1yb2xlYCxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1pYyBJQU0gcm9sZSBmb3IgQmVkcm9jayBBZ2VudCB3aXRoIGFkYXB0aXZlIHBlcm1pc3Npb25zJyxcbiAgICB9KTtcblxuICAgIC8vIOWfuuacrOeahOOBqkJlZHJvY2vmqKnpmZDvvIjlhajjg6Ljg4fjg6vlr77lv5zvvIlcbiAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nLFxuICAgICAgICAgICdiZWRyb2NrOkxpc3RGb3VuZGF0aW9uTW9kZWxzJyxcbiAgICAgICAgICAnYmVkcm9jazpHZXRGb3VuZGF0aW9uTW9kZWwnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLCAvLyDli5XnmoTjg6Ljg4fjg6vlr77lv5zjga7jgZ/jgoHlhajjg6Ljg4fjg6vjgpLoqLHlj69cbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEJlZHJvY2sgQWdlbnQgUnVudGltZeaoqemZkO+8iEFnZW50IEluZm8gQVBJ55SoIC0gMjAyNS0xMi0xMuS/ruato++8iVxuICAgIHJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdiZWRyb2NrOkludm9rZUFnZW50JywgLy8gMjAyNS0xMi0xMuS/ruatozogYmVkcm9jazpJbnZva2VBZ2VudOaoqemZkOi/veWKoFxuICAgICAgICAgICdiZWRyb2NrLWFnZW50LXJ1bnRpbWU6SW52b2tlQWdlbnQnLFxuICAgICAgICAgICdiZWRyb2NrLWFnZW50LXJ1bnRpbWU6UmV0cmlldmUnLFxuICAgICAgICAgIC8vIEFnZW505oOF5aCx5Y+W5b6X44Gr5b+F6KaB44Gq5qip6ZmQ77yIYmVkcm9ja+WQjeWJjeepuumWk++8iVxuICAgICAgICAgICdiZWRyb2NrOkdldEFnZW50JyxcbiAgICAgICAgICAnYmVkcm9jazpMaXN0QWdlbnRBbGlhc2VzJyxcbiAgICAgICAgICAnYmVkcm9jazpHZXRBZ2VudEFsaWFzJyxcbiAgICAgICAgICAgICdiZWRyb2NrOlVwZGF0ZUFnZW50JyxcbiAgICAgICAgICAgICdiZWRyb2NrOlByZXBhcmVBZ2VudCcsXG4gICAgICAgICAgLy8g5b6T5p2l44GuYmVkcm9jay1hZ2VudOaoqemZkOOCgue2reaMge+8iOS6kuaPm+aAp+OBruOBn+OCge+8iVxuICAgICAgICAgICdiZWRyb2NrLWFnZW50OkdldEFnZW50JyxcbiAgICAgICAgICAnYmVkcm9jay1hZ2VudDpMaXN0QWdlbnRzJyxcbiAgICAgICAgICAnYmVkcm9jay1hZ2VudDpVcGRhdGVBZ2VudCcsXG4gICAgICAgICAgJ2JlZHJvY2stYWdlbnQ6UHJlcGFyZUFnZW50JyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIElBTSBQYXNzUm9sZeaoqemZkO+8iEJlZHJvY2sgQWdlbnTmm7TmlrDmmYLjgavlv4XopoHvvIlcbiAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnaWFtOlBhc3NSb2xlJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6aWFtOjoke1N0YWNrLm9mKHRoaXMpLmFjY291bnR9OnJvbGUvKmJlZHJvY2stYWdlbnQtcm9sZSpgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gUGFyYW1ldGVyIFN0b3Jl6Kqt44G/5Y+W44KK5qip6ZmQ77yI5YuV55qE6Kit5a6a55So77yJXG4gICAgaWYgKHByb3BzLnBhcmFtZXRlclN0b3JlUHJlZml4KSB7XG4gICAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICdzc206R2V0UGFyYW1ldGVyJyxcbiAgICAgICAgICAgICdzc206R2V0UGFyYW1ldGVycycsXG4gICAgICAgICAgICAnc3NtOkdldFBhcmFtZXRlcnNCeVBhdGgnLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICBgYXJuOmF3czpzc206JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fTpwYXJhbWV0ZXIke3Byb3BzLnBhcmFtZXRlclN0b3JlUHJlZml4fS8qYCxcbiAgICAgICAgICBdLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZFdhdGNoIExvZ3PmqKnpmZBcbiAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nU3RyZWFtJyxcbiAgICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgcmV0dXJuIHJvbGU7XG4gIH1cblxuICAvKipcbiAgICog5YuV55qEQmVkcm9jayBBZ2VudOS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVEeW5hbWljQWdlbnQocHJvcHM6IEJlZHJvY2tBZ2VudER5bmFtaWNDb25zdHJ1Y3RQcm9wcyk6IGJlZHJvY2suQ2ZuQWdlbnQge1xuICAgIGNvbnN0IGFnZW50Q29uZmlnOiBhbnkgPSB7XG4gICAgICBhZ2VudE5hbWU6IHByb3BzLmFnZW50TmFtZSxcbiAgICAgIGFnZW50UmVzb3VyY2VSb2xlQXJuOiB0aGlzLmFnZW50Um9sZS5yb2xlQXJuLFxuICAgICAgZm91bmRhdGlvbk1vZGVsOiB0aGlzLnNlbGVjdGVkTW9kZWwsXG4gICAgICBpbnN0cnVjdGlvbjogcHJvcHMuaW5zdHJ1Y3Rpb24sXG4gICAgICBkZXNjcmlwdGlvbjogcHJvcHMuYWdlbnREZXNjcmlwdGlvbiB8fCBgRHluYW1pYyBCZWRyb2NrIEFnZW50IC0gTW9kZWw6ICR7dGhpcy5zZWxlY3RlZE1vZGVsfWAsXG4gICAgICBpZGxlU2Vzc2lvblR0bEluU2Vjb25kczogNjAwLFxuICAgICAgdGVzdEFsaWFzVGFnczoge1xuICAgICAgICBFbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIE1vZGVsU2VsZWN0aW9uOiAnZHluYW1pYycsXG4gICAgICAgIFNlbGVjdGVkTW9kZWw6IHRoaXMuc2VsZWN0ZWRNb2RlbCxcbiAgICAgICAgVXNlQ2FzZTogcHJvcHMudXNlQ2FzZSB8fCAnY2hhdCcsXG4gICAgICAgIExhc3RVcGRhdGVkOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICB9LFxuICAgIH07XG5cbiAgICBjb25zdCBhZ2VudCA9IG5ldyBiZWRyb2NrLkNmbkFnZW50KHRoaXMsICdEeW5hbWljQWdlbnQnLCBhZ2VudENvbmZpZyk7XG5cbiAgICAvLyBLbm93bGVkZ2UgQmFzZemWoumAo+S7mOOBkVxuICAgIGlmIChwcm9wcy5rbm93bGVkZ2VCYXNlQXJuKSB7XG4gICAgICBhZ2VudC5rbm93bGVkZ2VCYXNlcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgIGtub3dsZWRnZUJhc2VJZDogdGhpcy5leHRyYWN0S25vd2xlZGdlQmFzZUlkKHByb3BzLmtub3dsZWRnZUJhc2VBcm4pLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1pYyBLbm93bGVkZ2UgQmFzZSBJbnRlZ3JhdGlvbicsXG4gICAgICAgICAga25vd2xlZGdlQmFzZVN0YXRlOiAnRU5BQkxFRCcsXG4gICAgICAgIH0sXG4gICAgICBdO1xuICAgIH1cblxuICAgIC8vIEFjdGlvbiBHcm91cHPoqK3lrppcbiAgICBpZiAocHJvcHMuYWN0aW9uR3JvdXBzICYmIHByb3BzLmFjdGlvbkdyb3Vwcy5sZW5ndGggPiAwKSB7XG4gICAgICBhZ2VudC5hY3Rpb25Hcm91cHMgPSBwcm9wcy5hY3Rpb25Hcm91cHMubWFwKChhZykgPT4gKHtcbiAgICAgICAgYWN0aW9uR3JvdXBOYW1lOiBhZy5hY3Rpb25Hcm91cE5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBhZy5kZXNjcmlwdGlvbixcbiAgICAgICAgYWN0aW9uR3JvdXBFeGVjdXRvcjoge1xuICAgICAgICAgIGxhbWJkYTogYWcuYWN0aW9uR3JvdXBFeGVjdXRvcixcbiAgICAgICAgfSxcbiAgICAgICAgYXBpU2NoZW1hOiBhZy5hcGlTY2hlbWEuczNCdWNrZXROYW1lXG4gICAgICAgICAgPyB7XG4gICAgICAgICAgICAgIHMzOiB7XG4gICAgICAgICAgICAgICAgczNCdWNrZXROYW1lOiBhZy5hcGlTY2hlbWEuczNCdWNrZXROYW1lLFxuICAgICAgICAgICAgICAgIHMzT2JqZWN0S2V5OiBhZy5hcGlTY2hlbWEuczNPYmplY3RLZXksXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XG4gICAgICAgICAgOiB7XG4gICAgICAgICAgICAgIHBheWxvYWQ6IGFnLmFwaVNjaGVtYS5wYXlsb2FkLFxuICAgICAgICAgICAgfSxcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYWdlbnQ7XG4gIH1cblxuICAvKipcbiAgICog5YuV55qEQWdlbnQgQWxpYXPkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRHluYW1pY0FnZW50QWxpYXMocHJvcHM6IEJlZHJvY2tBZ2VudER5bmFtaWNDb25zdHJ1Y3RQcm9wcyk6IGJlZHJvY2suQ2ZuQWdlbnRBbGlhcyB7XG4gICAgcmV0dXJuIG5ldyBiZWRyb2NrLkNmbkFnZW50QWxpYXModGhpcywgJ0R5bmFtaWNBZ2VudEFsaWFzJywge1xuICAgICAgYWdlbnRJZDogdGhpcy5hZ2VudC5hdHRyQWdlbnRJZCxcbiAgICAgIGFnZW50QWxpYXNOYW1lOiBgJHtwcm9wcy5lbnZpcm9ubWVudH0tZHluYW1pYy1hbGlhc2AsXG4gICAgICBkZXNjcmlwdGlvbjogYER5bmFtaWMgJHtwcm9wcy5lbnZpcm9ubWVudH0gZW52aXJvbm1lbnQgYWxpYXMgLSBBdXRvLXVwZGF0aW5nIG1vZGVsIHNlbGVjdGlvbmAsXG4gICAgICB0YWdzOiB7XG4gICAgICAgIEVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgTW9kZWxTZWxlY3Rpb246ICdkeW5hbWljJyxcbiAgICAgICAgU2VsZWN0ZWRNb2RlbDogdGhpcy5zZWxlY3RlZE1vZGVsLFxuICAgICAgICBVc2VDYXNlOiBwcm9wcy51c2VDYXNlIHx8ICdjaGF0JyxcbiAgICAgICAgTGFzdFVwZGF0ZWQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgQXV0b1VwZGF0ZTogcHJvcHMuZW5hYmxlQXV0b1VwZGF0ZSA/ICdlbmFibGVkJyA6ICdkaXNhYmxlZCcsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOiHquWLleabtOaWsOapn+iDveOBruioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBzZXR1cEF1dG9VcGRhdGUocHJvcHM6IEJlZHJvY2tBZ2VudER5bmFtaWNDb25zdHJ1Y3RQcm9wcyk6IHZvaWQge1xuICAgIC8vIOODouODh+ODq+abtOaWsExhbWJkYemWouaVsFxuICAgIHRoaXMubW9kZWxVcGRhdGVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ01vZGVsVXBkYXRlRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuaW1wb3J0IGJvdG8zXG5pbXBvcnQganNvblxuaW1wb3J0IGxvZ2dpbmdcbmltcG9ydCBvc1xuXG5sb2dnZXIgPSBsb2dnaW5nLmdldExvZ2dlcigpXG5sb2dnZXIuc2V0TGV2ZWwobG9nZ2luZy5JTkZPKVxuXG5kZWYgaGFuZGxlcihldmVudCwgY29udGV4dCk6XG4gICAgdHJ5OlxuICAgICAgICBiZWRyb2NrX2FnZW50ID0gYm90bzMuY2xpZW50KCdiZWRyb2NrLWFnZW50JylcbiAgICAgICAgc3NtID0gYm90bzMuY2xpZW50KCdzc20nKVxuICAgICAgICBcbiAgICAgICAgYWdlbnRfaWQgPSBvcy5lbnZpcm9uWydBR0VOVF9JRCddXG4gICAgICAgIHBhcmFtZXRlcl9wcmVmaXggPSBvcy5lbnZpcm9uLmdldCgnUEFSQU1FVEVSX1BSRUZJWCcsICcvYmVkcm9jay1hZ2VudC9jb25maWcnKVxuICAgICAgICBcbiAgICAgICAgIyBQYXJhbWV0ZXIgU3RvcmXjgYvjgonmnIDmlrDjga7oqK3lrprjgpLlj5blvpdcbiAgICAgICAgdHJ5OlxuICAgICAgICAgICAgcmVzcG9uc2UgPSBzc20uZ2V0X3BhcmFtZXRlcnNfYnlfcGF0aChcbiAgICAgICAgICAgICAgICBQYXRoPXBhcmFtZXRlcl9wcmVmaXgsXG4gICAgICAgICAgICAgICAgUmVjdXJzaXZlPVRydWVcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uZmlnID0ge31cbiAgICAgICAgICAgIGZvciBwYXJhbSBpbiByZXNwb25zZVsnUGFyYW1ldGVycyddOlxuICAgICAgICAgICAgICAgIGtleSA9IHBhcmFtWydOYW1lJ10uc3BsaXQoJy8nKVstMV1cbiAgICAgICAgICAgICAgICBjb25maWdba2V5XSA9IHBhcmFtWydWYWx1ZSddXG4gICAgICAgICAgICBcbiAgICAgICAgICAgICMg5paw44GX44GE44Oi44OH44OrSUTjgpLlj5blvpdcbiAgICAgICAgICAgIG5ld19tb2RlbF9pZCA9IGNvbmZpZy5nZXQoJ3NlbGVjdGVkX21vZGVsJylcbiAgICAgICAgICAgIGlmIG5vdCBuZXdfbW9kZWxfaWQ6XG4gICAgICAgICAgICAgICAgbG9nZ2VyLndhcm5pbmcoJ05vIG1vZGVsIElEIGZvdW5kIGluIGNvbmZpZ3VyYXRpb24nKVxuICAgICAgICAgICAgICAgIHJldHVybiB7J1N0YXR1cyc6ICdTS0lQUEVEJywgJ1JlYXNvbic6ICdObyBtb2RlbCBjb25maWd1cmF0aW9uIGZvdW5kJ31cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgIyDnj77lnKjjga5BZ2VudOioreWumuOCkuWPluW+l1xuICAgICAgICAgICAgY3VycmVudF9hZ2VudCA9IGJlZHJvY2tfYWdlbnQuZ2V0X2FnZW50KGFnZW50SWQ9YWdlbnRfaWQpXG4gICAgICAgICAgICBjdXJyZW50X21vZGVsID0gY3VycmVudF9hZ2VudFsnYWdlbnQnXVsnZm91bmRhdGlvbk1vZGVsJ11cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgIyDjg6Ljg4fjg6vjgYzlpInmm7TjgZXjgozjgabjgYTjgovloLTlkIjjga7jgb/mm7TmlrBcbiAgICAgICAgICAgIGlmIGN1cnJlbnRfbW9kZWwgIT0gbmV3X21vZGVsX2lkOlxuICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKGYnVXBkYXRpbmcgYWdlbnQgbW9kZWwgZnJvbSB7Y3VycmVudF9tb2RlbH0gdG8ge25ld19tb2RlbF9pZH0nKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICMgQWdlbnToqK3lrprjgpLmm7TmlrBcbiAgICAgICAgICAgICAgICBiZWRyb2NrX2FnZW50LnVwZGF0ZV9hZ2VudChcbiAgICAgICAgICAgICAgICAgICAgYWdlbnRJZD1hZ2VudF9pZCxcbiAgICAgICAgICAgICAgICAgICAgZm91bmRhdGlvbk1vZGVsPW5ld19tb2RlbF9pZCxcbiAgICAgICAgICAgICAgICAgICAgYWdlbnROYW1lPWN1cnJlbnRfYWdlbnRbJ2FnZW50J11bJ2FnZW50TmFtZSddLFxuICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbj1jdXJyZW50X2FnZW50WydhZ2VudCddWydpbnN0cnVjdGlvbiddLFxuICAgICAgICAgICAgICAgICAgICBhZ2VudFJlc291cmNlUm9sZUFybj1jdXJyZW50X2FnZW50WydhZ2VudCddWydhZ2VudFJlc291cmNlUm9sZUFybiddXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICMgQWdlbnTmupblgplcbiAgICAgICAgICAgICAgICBiZWRyb2NrX2FnZW50LnByZXBhcmVfYWdlbnQoYWdlbnRJZD1hZ2VudF9pZClcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsb2dnZXIuaW5mbyhmJ0FnZW50IHthZ2VudF9pZH0gdXBkYXRlZCBzdWNjZXNzZnVsbHknKVxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICdTdGF0dXMnOiAnU1VDQ0VTUycsXG4gICAgICAgICAgICAgICAgICAgICdQcmV2aW91c01vZGVsJzogY3VycmVudF9tb2RlbCxcbiAgICAgICAgICAgICAgICAgICAgJ05ld01vZGVsJzogbmV3X21vZGVsX2lkLFxuICAgICAgICAgICAgICAgICAgICAnQWdlbnRJZCc6IGFnZW50X2lkXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZTpcbiAgICAgICAgICAgICAgICBsb2dnZXIuaW5mbygnTm8gbW9kZWwgdXBkYXRlIG5lZWRlZCcpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsnU3RhdHVzJzogJ05PX0NIQU5HRScsICdDdXJyZW50TW9kZWwnOiBjdXJyZW50X21vZGVsfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoZidFcnJvciByZWFkaW5nIGNvbmZpZ3VyYXRpb246IHtzdHIoZSl9JylcbiAgICAgICAgICAgIHJldHVybiB7J1N0YXR1cyc6ICdGQUlMRUQnLCAnUmVhc29uJzogZidDb25maWd1cmF0aW9uIGVycm9yOiB7c3RyKGUpfSd9XG4gICAgICAgICAgICBcbiAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgIGxvZ2dlci5lcnJvcihmJ0Vycm9yIHVwZGF0aW5nIGFnZW50OiB7c3RyKGUpfScpXG4gICAgICAgIHJldHVybiB7J1N0YXR1cyc6ICdGQUlMRUQnLCAnUmVhc29uJzogc3RyKGUpfVxuICAgICAgYCksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEFHRU5UX0lEOiB0aGlzLmFnZW50LmF0dHJBZ2VudElkLFxuICAgICAgICBQQVJBTUVURVJfUFJFRklYOiBwcm9wcy5wYXJhbWV0ZXJTdG9yZVByZWZpeCB8fCAnL2JlZHJvY2stYWdlbnQvY29uZmlnJyxcbiAgICAgIH0sXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBmdW5jdGlvbiBmb3IgZHluYW1pYyBCZWRyb2NrIEFnZW50IG1vZGVsIHVwZGF0ZXMnLFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRh6Zai5pWw44Gu5qip6ZmQXG4gICAgdGhpcy5tb2RlbFVwZGF0ZUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2JlZHJvY2stYWdlbnQ6R2V0QWdlbnQnLFxuICAgICAgICAgICdiZWRyb2NrLWFnZW50OlVwZGF0ZUFnZW50JyxcbiAgICAgICAgICAnYmVkcm9jay1hZ2VudDpQcmVwYXJlQWdlbnQnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFt0aGlzLmFnZW50LmF0dHJBZ2VudEFybl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBpZiAocHJvcHMucGFyYW1ldGVyU3RvcmVQcmVmaXgpIHtcbiAgICAgIHRoaXMubW9kZWxVcGRhdGVGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXInLFxuICAgICAgICAgICAgJ3NzbTpHZXRQYXJhbWV0ZXJzJyxcbiAgICAgICAgICAgICdzc206R2V0UGFyYW1ldGVyc0J5UGF0aCcsXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgIGBhcm46YXdzOnNzbToke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OnBhcmFtZXRlciR7cHJvcHMucGFyYW1ldGVyU3RvcmVQcmVmaXh9LypgLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIOioreWumuebo+imlkxhbWJkYemWouaVsO+8iFBhcmFtZXRlciBTdG9yZeWkieabtOOCkuebo+imlu+8iVxuICAgIHRoaXMuY29uZmlnV2F0Y2hlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ29uZmlnV2F0Y2hlckZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbmltcG9ydCBib3RvM1xuaW1wb3J0IGpzb25cbmltcG9ydCBsb2dnaW5nXG5cbmxvZ2dlciA9IGxvZ2dpbmcuZ2V0TG9nZ2VyKClcbmxvZ2dlci5zZXRMZXZlbChsb2dnaW5nLklORk8pXG5cbmRlZiBoYW5kbGVyKGV2ZW50LCBjb250ZXh0KTpcbiAgICB0cnk6XG4gICAgICAgIGxhbWJkYV9jbGllbnQgPSBib3RvMy5jbGllbnQoJ2xhbWJkYScpXG4gICAgICAgIFxuICAgICAgICAjIFBhcmFtZXRlciBTdG9yZeWkieabtOOCpOODmeODs+ODiOOCkuWHpueQhlxuICAgICAgICBmb3IgcmVjb3JkIGluIGV2ZW50LmdldCgnUmVjb3JkcycsIFtdKTpcbiAgICAgICAgICAgIGlmIHJlY29yZC5nZXQoJ2V2ZW50U291cmNlJykgPT0gJ2F3czpzc20nOlxuICAgICAgICAgICAgICAgIHBhcmFtZXRlcl9uYW1lID0gcmVjb3JkWydldmVudFNvdXJjZUFSTiddLnNwbGl0KCcvJylbLTFdXG4gICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oZidQYXJhbWV0ZXIge3BhcmFtZXRlcl9uYW1lfSBjaGFuZ2VkLCB0cmlnZ2VyaW5nIG1vZGVsIHVwZGF0ZScpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgIyDjg6Ljg4fjg6vmm7TmlrBMYW1iZGHplqLmlbDjgpLlkbzjgbPlh7rjgZdcbiAgICAgICAgICAgICAgICBsYW1iZGFfY2xpZW50Lmludm9rZShcbiAgICAgICAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lPW9zLmVudmlyb25bJ01PREVMX1VQREFURV9GVU5DVElPTiddLFxuICAgICAgICAgICAgICAgICAgICBJbnZvY2F0aW9uVHlwZT0nRXZlbnQnXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICByZXR1cm4geydTdGF0dXMnOiAnU1VDQ0VTUyd9XG4gICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOlxuICAgICAgICBsb2dnZXIuZXJyb3IoZidFcnJvciBpbiBjb25maWcgd2F0Y2hlcjoge3N0cihlKX0nKVxuICAgICAgICByZXR1cm4geydTdGF0dXMnOiAnRkFJTEVEJywgJ1JlYXNvbic6IHN0cihlKX1cbiAgICAgIGApLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMiksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBNT0RFTF9VUERBVEVfRlVOQ1RJT046IHRoaXMubW9kZWxVcGRhdGVGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICB9LFxuICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgZnVuY3Rpb24gZm9yIG1vbml0b3JpbmcgY29uZmlndXJhdGlvbiBjaGFuZ2VzJyxcbiAgICB9KTtcblxuICAgIC8vIOioreWumuebo+imlkxhbWJkYemWouaVsOOBruaoqemZkFxuICAgIHRoaXMuY29uZmlnV2F0Y2hlckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbJ2xhbWJkYTpJbnZva2VGdW5jdGlvbiddLFxuICAgICAgICByZXNvdXJjZXM6IFt0aGlzLm1vZGVsVXBkYXRlRnVuY3Rpb24uZnVuY3Rpb25Bcm5dLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gRXZlbnRCcmlkZ2UgUnVsZe+8iOWumuacn+eahOOBquODouODh+ODq+acgOmBqeWMluODgeOCp+ODg+OCr++8iVxuICAgIGNvbnN0IG9wdGltaXphdGlvblJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ01vZGVsT3B0aW1pemF0aW9uUnVsZScsIHtcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUucmF0ZShjZGsuRHVyYXRpb24uaG91cnMoMjQpKSwgLy8gMjTmmYLplpPjgZTjgahcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGFpbHkgbW9kZWwgb3B0aW1pemF0aW9uIGNoZWNrJyxcbiAgICB9KTtcblxuICAgIG9wdGltaXphdGlvblJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHRoaXMubW9kZWxVcGRhdGVGdW5jdGlvbikpO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcmFtZXRlciBTdG9yZeioreWumuOBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVQYXJhbWV0ZXJTdG9yZUNvbmZpZyhwcm9wczogQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdFByb3BzKTogdm9pZCB7XG4gICAgY29uc3QgcHJlZml4ID0gcHJvcHMucGFyYW1ldGVyU3RvcmVQcmVmaXggfHwgJy9iZWRyb2NrLWFnZW50L2NvbmZpZyc7XG5cbiAgICAvLyDpgbjmip7jgZXjgozjgZ/jg6Ljg4fjg6tcbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnU2VsZWN0ZWRNb2RlbFBhcmFtZXRlcicsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAke3ByZWZpeH0vc2VsZWN0ZWRfbW9kZWxgLFxuICAgICAgc3RyaW5nVmFsdWU6IHRoaXMuc2VsZWN0ZWRNb2RlbCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3VycmVudGx5IHNlbGVjdGVkIEJlZHJvY2sgbW9kZWwnLFxuICAgIH0pO1xuXG4gICAgLy8g5L2/55So44Kx44O844K5XG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1VzZUNhc2VQYXJhbWV0ZXInLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgJHtwcmVmaXh9L3VzZV9jYXNlYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiBwcm9wcy51c2VDYXNlIHx8ICdjaGF0JyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3VycmVudCB1c2UgY2FzZSBmb3IgbW9kZWwgc2VsZWN0aW9uJyxcbiAgICB9KTtcblxuICAgIC8vIOODouODh+ODq+imgeS7tlxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdNb2RlbFJlcXVpcmVtZW50c1BhcmFtZXRlcicsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAke3ByZWZpeH0vbW9kZWxfcmVxdWlyZW1lbnRzYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiBKU09OLnN0cmluZ2lmeShwcm9wcy5tb2RlbFJlcXVpcmVtZW50cyB8fCB7fSksXG4gICAgICBkZXNjcmlwdGlvbjogJ01vZGVsIHJlcXVpcmVtZW50cyBjb25maWd1cmF0aW9uJyxcbiAgICB9KTtcblxuICAgIC8vIOacgOe1guabtOaWsOaXpeaZglxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdMYXN0VXBkYXRlZFBhcmFtZXRlcicsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAke3ByZWZpeH0vbGFzdF91cGRhdGVkYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhc3QgY29uZmlndXJhdGlvbiB1cGRhdGUgdGltZXN0YW1wJyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG91ZEZvcm1hdGlvbuWHuuWKm+S9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKHByb3BzOiBCZWRyb2NrQWdlbnREeW5hbWljQ29uc3RydWN0UHJvcHMpOiB2b2lkIHtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRHluYW1pY0FnZW50QXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuYWdlbnQuYXR0ckFnZW50QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbWljIEJlZHJvY2sgQWdlbnQgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1keW5hbWljLWFnZW50LWFybmAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRHluYW1pY0FnZW50QWxpYXNBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hZ2VudEFsaWFzLmF0dHJBZ2VudEFsaWFzQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbWljIEJlZHJvY2sgQWdlbnQgQWxpYXMgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1keW5hbWljLWFnZW50LWFsaWFzLWFybmAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VsZWN0ZWRGb3VuZGF0aW9uTW9kZWwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zZWxlY3RlZE1vZGVsLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbWljYWxseSBzZWxlY3RlZCBGb3VuZGF0aW9uIE1vZGVsIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1zZWxlY3RlZC1tb2RlbGAsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5tb2RlbFVwZGF0ZUZ1bmN0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTW9kZWxVcGRhdGVGdW5jdGlvbkFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMubW9kZWxVcGRhdGVGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdNb2RlbCBVcGRhdGUgRnVuY3Rpb24gQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LW1vZGVsLXVwZGF0ZS1mdW5jdGlvbi1hcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gUGFyYW1ldGVyIFN0b3Jl6Kit5a6a44OR44K5XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1BhcmFtZXRlclN0b3JlUHJlZml4Jywge1xuICAgICAgdmFsdWU6IHByb3BzLnBhcmFtZXRlclN0b3JlUHJlZml4IHx8ICcvYmVkcm9jay1hZ2VudC9jb25maWcnLFxuICAgICAgZGVzY3JpcHRpb246ICdQYXJhbWV0ZXIgU3RvcmUgY29uZmlndXJhdGlvbiBwcmVmaXgnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXBhcmFtZXRlci1wcmVmaXhgLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEtub3dsZWRnZSBCYXNlIEFSTuOBi+OCiUlE44KS5oq95Ye6XG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RLbm93bGVkZ2VCYXNlSWQoYXJuOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHBhcnRzID0gYXJuLnNwbGl0KCcvJyk7XG4gICAgcmV0dXJuIHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdO1xuICB9XG5cbiAgLyoqXG4gICAqIOaWsOOBl+OBhOODouODh+ODq+OCkuWLleeahOOBq+i/veWKoFxuICAgKi9cbiAgcHVibGljIGFkZE5ld01vZGVsKGZhbWlseU5hbWU6IHN0cmluZywgbW9kZWxWZXJzaW9uOiBhbnkpOiB2b2lkIHtcbiAgICB0aGlzLm1vZGVsQ29uZmlnLmFkZE1vZGVsVmVyc2lvbihmYW1pbHlOYW1lLCBtb2RlbFZlcnNpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIOODouODh+ODq+OCkumdnuaOqOWlqOOBq+ioreWumlxuICAgKi9cbiAgcHVibGljIGRlcHJlY2F0ZU1vZGVsKG1vZGVsSWQ6IHN0cmluZywgcmVwbGFjZW1lbnRNb2RlbD86IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMubW9kZWxDb25maWcuZGVwcmVjYXRlTW9kZWwobW9kZWxJZCwgcmVwbGFjZW1lbnRNb2RlbCk7XG4gIH1cblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44GrQmVkcm9jayBBZ2VudOaoqemZkOOCkuS7mOS4juOBmeOCi+ODmOODq+ODkeODvOODoeOCveODg+ODiVxuICAgKi9cbiAgcHVibGljIGdyYW50SW52b2tlVG9MYW1iZGEobGFtYmRhRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbik6IHZvaWQge1xuICAgIGxhbWJkYUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2JlZHJvY2s6SW52b2tlQWdlbnQnLCAvLyAyMDI1LTEyLTEy5L+u5q2jOiBiZWRyb2NrOkludm9rZUFnZW505qip6ZmQ6L+95YqgXG4gICAgICAgICAgJ2JlZHJvY2stYWdlbnQtcnVudGltZTpJbnZva2VBZ2VudCcsXG4gICAgICAgICAgJ2JlZHJvY2stYWdlbnQtcnVudGltZTpSZXRyaWV2ZScsXG4gICAgICAgICAgLy8gQWdlbnTmg4XloLHlj5blvpfjgavlv4XopoHjgarmqKnpmZDvvIhiZWRyb2Nr5ZCN5YmN56m66ZaT77yJXG4gICAgICAgICAgJ2JlZHJvY2s6R2V0QWdlbnQnLFxuICAgICAgICAgICdiZWRyb2NrOkxpc3RBZ2VudEFsaWFzZXMnLFxuICAgICAgICAgICdiZWRyb2NrOkdldEFnZW50QWxpYXMnLFxuICAgICAgICAgICAgJ2JlZHJvY2s6VXBkYXRlQWdlbnQnLFxuICAgICAgICAgICAgJ2JlZHJvY2s6UHJlcGFyZUFnZW50JyxcbiAgICAgICAgICAvLyDlvpPmnaXjga5iZWRyb2NrLWFnZW505qip6ZmQ44KC57at5oyB77yI5LqS5o+b5oCn44Gu44Gf44KB77yJXG4gICAgICAgICAgJ2JlZHJvY2stYWdlbnQ6R2V0QWdlbnQnLFxuICAgICAgICAgICdiZWRyb2NrLWFnZW50Okxpc3RBZ2VudHMnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICB0aGlzLmFnZW50LmF0dHJBZ2VudEFybixcbiAgICAgICAgICB0aGlzLmFnZW50QWxpYXMuYXR0ckFnZW50QWxpYXNBcm4sXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyDli5XnmoTjg6Ljg4fjg6vlr77lv5zjga7jgZ/jgoHlhajjg6Ljg4fjg6vjgbjjga7jgqLjgq/jgrvjgrnmqKnpmZBcbiAgICBsYW1iZGFGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJyxcbiAgICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbScsXG4gICAgICAgICAgJ2JlZHJvY2s6TGlzdEZvdW5kYXRpb25Nb2RlbHMnLFxuICAgICAgICAgICdiZWRyb2NrOkdldEZvdW5kYXRpb25Nb2RlbCcsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICB9KVxuICAgICk7XG4gIH1cbn0iXX0=