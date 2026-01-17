/**
 * 動的Bedrock Agentスタックの使用例
 * 新しいプロバイダーやモデルの追加に対応した実装例
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BedrockAgentDynamicConstruct } from '../../modules/ai/constructs/bedrock-agent-dynamic-construct';

export interface DynamicBedrockAgentStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
}

export class DynamicBedrockAgentStack extends cdk.Stack {
  public readonly bedrockAgent: BedrockAgentDynamicConstruct;

  constructor(scope: Construct, id: string, props: DynamicBedrockAgentStackProps) {
    super(scope, id, props);

    // 基本的な動的Bedrock Agent
    this.bedrockAgent = new BedrockAgentDynamicConstruct(this, 'DynamicBedrockAgent', {
      projectName: props.projectName,
      environment: props.environment,
      agentName: `${props.projectName}-dynamic-agent`,
      agentDescription: 'Dynamic Bedrock Agent with automatic model selection and updates',
      instruction: `You are a helpful AI assistant with dynamic model capabilities. 
        You can adapt to use the most appropriate model based on the task requirements.
        Always provide accurate and helpful responses while being concise and clear.`,
      
      // 使用ケース指定（モデル選択に影響）
      useCase: 'chat',
      
      // モデル要件
      modelRequirements: {
        onDemand: true,
        streaming: true,
        crossRegion: false,
        inputModalities: ['Text'],
      },
      
      // 動的機能の有効化
      enableDynamicModelSelection: true,
      enableAutoUpdate: true,
      
      // 外部設定ファイルの指定
      configFilePath: './lib/config/model-configs/bedrock-models.json',
      
      // Parameter Store設定
      parameterStorePrefix: `/bedrock-agent/${props.environment}/config`,
    });

    // 使用例1: マルチモーダル対応Agent
    const multimodalAgent = new BedrockAgentDynamicConstruct(this, 'MultimodalAgent', {
      projectName: props.projectName,
      environment: props.environment,
      agentName: `${props.projectName}-multimodal-agent`,
      agentDescription: 'Multimodal Bedrock Agent for image and text processing',
      instruction: `You are a multimodal AI assistant capable of processing both text and images.
        Analyze images when provided and respond with detailed descriptions and insights.`,
      
      useCase: 'multimodal',
      modelRequirements: {
        onDemand: true,
        streaming: true,
        inputModalities: ['Text', 'Image'],
      },
      
      enableDynamicModelSelection: true,
      enableAutoUpdate: true,
      configFilePath: './lib/config/model-configs/bedrock-models.json',
      parameterStorePrefix: `/bedrock-agent/${props.environment}/multimodal/config`,
    });

    // 使用例2: コスト重視Agent
    const costEffectiveAgent = new BedrockAgentDynamicConstruct(this, 'CostEffectiveAgent', {
      projectName: props.projectName,
      environment: props.environment,
      agentName: `${props.projectName}-cost-effective-agent`,
      agentDescription: 'Cost-effective Bedrock Agent optimized for high-volume usage',
      instruction: `You are a cost-effective AI assistant optimized for high-volume interactions.
        Provide concise, accurate responses while maintaining quality.`,
      
      useCase: 'costEffective',
      modelRequirements: {
        onDemand: true,
        streaming: false, // ストリーミング不要でコスト削減
      },
      
      enableDynamicModelSelection: true,
      enableAutoUpdate: true,
      configFilePath: './lib/config/model-configs/bedrock-models.json',
      parameterStorePrefix: `/bedrock-agent/${props.environment}/cost-effective/config`,
    });

    // 使用例3: カスタムプロバイダー対応Agent
    const customProviderAgent = new BedrockAgentDynamicConstruct(this, 'CustomProviderAgent', {
      projectName: props.projectName,
      environment: props.environment,
      agentName: `${props.projectName}-custom-provider-agent`,
      agentDescription: 'Bedrock Agent with custom provider support',
      instruction: `You are an AI assistant with access to multiple model providers.
        Adapt your responses based on the capabilities of the selected model.`,
      
      useCase: 'generation',
      enableDynamicModelSelection: true,
      enableAutoUpdate: true,
      
      // カスタムモデル設定
      customModelConfig: {
        providers: [
          {
            name: 'mistral',
            namingPattern: 'mistral.{model-name}-{version}',
            defaultRegions: ['us-east-1', 'eu-west-1'],
            supportedFeatures: {
              onDemand: true,
              provisioned: false,
              streaming: true,
              crossRegion: false,
            },
          },
        ],
        families: [
          {
            name: 'mistral-large',
            provider: 'mistral',
            defaultModel: 'mistral.mistral-large-2402-v1:0',
            models: [
              {
                modelId: 'mistral.mistral-large-2402-v1:0',
                version: 'v1',
                releaseDate: '2024-02-26',
                status: 'stable',
                supportedRegions: ['us-east-1', 'eu-west-1'],
                features: {
                  onDemand: true,
                  provisioned: false,
                  streaming: true,
                  crossRegion: false,
                  multimodal: false,
                },
                inputModalities: ['Text'],
                outputModalities: ['Text'],
              },
            ],
          },
        ],
      },
      
      parameterStorePrefix: `/bedrock-agent/${props.environment}/custom/config`,
    });

    // CloudFormation出力
    new cdk.CfnOutput(this, 'DynamicAgentArn', {
      value: this.bedrockAgent.agent.attrAgentArn,
      description: 'Dynamic Bedrock Agent ARN',
      exportName: `${props.projectName}-${props.environment}-dynamic-agent-arn`,
    });

    new cdk.CfnOutput(this, 'MultimodalAgentArn', {
      value: multimodalAgent.agent.attrAgentArn,
      description: 'Multimodal Bedrock Agent ARN',
      exportName: `${props.projectName}-${props.environment}-multimodal-agent-arn`,
    });

    new cdk.CfnOutput(this, 'CostEffectiveAgentArn', {
      value: costEffectiveAgent.agent.attrAgentArn,
      description: 'Cost-effective Bedrock Agent ARN',
      exportName: `${props.projectName}-${props.environment}-cost-effective-agent-arn`,
    });

    new cdk.CfnOutput(this, 'CustomProviderAgentArn', {
      value: customProviderAgent.agent.attrAgentArn,
      description: 'Custom Provider Bedrock Agent ARN',
      exportName: `${props.projectName}-${props.environment}-custom-provider-agent-arn`,
    });
  }

  /**
   * 新しいモデルを動的に追加する例
   */
  public addNewModel(familyName: string, modelVersion: any): void {
    this.bedrockAgent.addNewModel(familyName, modelVersion);
  }

  /**
   * モデルを非推奨に設定する例
   */
  public deprecateModel(modelId: string, replacementModel?: string): void {
    this.bedrockAgent.deprecateModel(modelId, replacementModel);
  }
}