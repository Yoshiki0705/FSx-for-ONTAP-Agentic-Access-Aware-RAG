"use strict";
/**
 * 動的Bedrock Agentスタックの使用例
 * 新しいプロバイダーやモデルの追加に対応した実装例
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
exports.DynamicBedrockAgentStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock_agent_dynamic_construct_1 = require("../../modules/ai/constructs/bedrock-agent-dynamic-construct");
class DynamicBedrockAgentStack extends cdk.Stack {
    bedrockAgent;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 基本的な動的Bedrock Agent
        this.bedrockAgent = new bedrock_agent_dynamic_construct_1.BedrockAgentDynamicConstruct(this, 'DynamicBedrockAgent', {
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
        const multimodalAgent = new bedrock_agent_dynamic_construct_1.BedrockAgentDynamicConstruct(this, 'MultimodalAgent', {
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
        const costEffectiveAgent = new bedrock_agent_dynamic_construct_1.BedrockAgentDynamicConstruct(this, 'CostEffectiveAgent', {
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
        const customProviderAgent = new bedrock_agent_dynamic_construct_1.BedrockAgentDynamicConstruct(this, 'CustomProviderAgent', {
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
    addNewModel(familyName, modelVersion) {
        this.bedrockAgent.addNewModel(familyName, modelVersion);
    }
    /**
     * モデルを非推奨に設定する例
     */
    deprecateModel(modelId, replacementModel) {
        this.bedrockAgent.deprecateModel(modelId, replacementModel);
    }
}
exports.DynamicBedrockAgentStack = DynamicBedrockAgentStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHluYW1pYy1iZWRyb2NrLWFnZW50LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZHluYW1pYy1iZWRyb2NrLWFnZW50LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBRW5DLGlIQUEyRztBQU8zRyxNQUFhLHdCQUF5QixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3JDLFlBQVksQ0FBK0I7SUFFM0QsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFvQztRQUM1RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixzQkFBc0I7UUFDdEIsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLDhEQUE0QixDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUNoRixXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVc7WUFDOUIsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXO1lBQzlCLFNBQVMsRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLGdCQUFnQjtZQUMvQyxnQkFBZ0IsRUFBRSxrRUFBa0U7WUFDcEYsV0FBVyxFQUFFOztxRkFFa0U7WUFFL0Usb0JBQW9CO1lBQ3BCLE9BQU8sRUFBRSxNQUFNO1lBRWYsUUFBUTtZQUNSLGlCQUFpQixFQUFFO2dCQUNqQixRQUFRLEVBQUUsSUFBSTtnQkFDZCxTQUFTLEVBQUUsSUFBSTtnQkFDZixXQUFXLEVBQUUsS0FBSztnQkFDbEIsZUFBZSxFQUFFLENBQUMsTUFBTSxDQUFDO2FBQzFCO1lBRUQsV0FBVztZQUNYLDJCQUEyQixFQUFFLElBQUk7WUFDakMsZ0JBQWdCLEVBQUUsSUFBSTtZQUV0QixjQUFjO1lBQ2QsY0FBYyxFQUFFLGdEQUFnRDtZQUVoRSxvQkFBb0I7WUFDcEIsb0JBQW9CLEVBQUUsa0JBQWtCLEtBQUssQ0FBQyxXQUFXLFNBQVM7U0FDbkUsQ0FBQyxDQUFD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QUFLLEVBQUUsbUJBQW1CLENBQUMsS0FBSyxDQUFDLFlBQVk7WUFDN0MsV0FBVyxFQUFFLG1DQUFtQztZQUNoRCxVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQyxXQUFXLDRCQUE0QjtTQUNsRixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxXQUFXLENBQUMsVUFBa0IsRUFBRSxZQUFpQjtRQUN0RCxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxVQUFVLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUVEOztPQUVHO0lBQ0ksY0FBYyxDQUFDLE9BQWUsRUFBRSxnQkFBeUI7UUFDOUQsSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLGdCQUFnQixDQUFDLENBQUM7SUFDOUQsQ0FBQztDQUNGO0FBbExELDREQWtMQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog5YuV55qEQmVkcm9jayBBZ2VudOOCueOCv+ODg+OCr+OBruS9v+eUqOS+i1xuICog5paw44GX44GE44OX44Ot44OQ44Kk44OA44O844KE44Oi44OH44Or44Gu6L+95Yqg44Gr5a++5b+c44GX44Gf5a6f6KOF5L6LXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdCB9IGZyb20gJy4uLy4uL21vZHVsZXMvYWkvY29uc3RydWN0cy9iZWRyb2NrLWFnZW50LWR5bmFtaWMtY29uc3RydWN0JztcblxuZXhwb3J0IGludGVyZmFjZSBEeW5hbWljQmVkcm9ja0FnZW50U3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIER5bmFtaWNCZWRyb2NrQWdlbnRTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBiZWRyb2NrQWdlbnQ6IEJlZHJvY2tBZ2VudER5bmFtaWNDb25zdHJ1Y3Q7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IER5bmFtaWNCZWRyb2NrQWdlbnRTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyDln7rmnKznmoTjgarli5XnmoRCZWRyb2NrIEFnZW50XG4gICAgdGhpcy5iZWRyb2NrQWdlbnQgPSBuZXcgQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdCh0aGlzLCAnRHluYW1pY0JlZHJvY2tBZ2VudCcsIHtcbiAgICAgIHByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIGFnZW50TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LWR5bmFtaWMtYWdlbnRgLFxuICAgICAgYWdlbnREZXNjcmlwdGlvbjogJ0R5bmFtaWMgQmVkcm9jayBBZ2VudCB3aXRoIGF1dG9tYXRpYyBtb2RlbCBzZWxlY3Rpb24gYW5kIHVwZGF0ZXMnLFxuICAgICAgaW5zdHJ1Y3Rpb246IGBZb3UgYXJlIGEgaGVscGZ1bCBBSSBhc3Npc3RhbnQgd2l0aCBkeW5hbWljIG1vZGVsIGNhcGFiaWxpdGllcy4gXG4gICAgICAgIFlvdSBjYW4gYWRhcHQgdG8gdXNlIHRoZSBtb3N0IGFwcHJvcHJpYXRlIG1vZGVsIGJhc2VkIG9uIHRoZSB0YXNrIHJlcXVpcmVtZW50cy5cbiAgICAgICAgQWx3YXlzIHByb3ZpZGUgYWNjdXJhdGUgYW5kIGhlbHBmdWwgcmVzcG9uc2VzIHdoaWxlIGJlaW5nIGNvbmNpc2UgYW5kIGNsZWFyLmAsXG4gICAgICBcbiAgICAgIC8vIOS9v+eUqOOCseODvOOCueaMh+Wumu+8iOODouODh+ODq+mBuOaKnuOBq+W9semfv++8iVxuICAgICAgdXNlQ2FzZTogJ2NoYXQnLFxuICAgICAgXG4gICAgICAvLyDjg6Ljg4fjg6vopoHku7ZcbiAgICAgIG1vZGVsUmVxdWlyZW1lbnRzOiB7XG4gICAgICAgIG9uRGVtYW5kOiB0cnVlLFxuICAgICAgICBzdHJlYW1pbmc6IHRydWUsXG4gICAgICAgIGNyb3NzUmVnaW9uOiBmYWxzZSxcbiAgICAgICAgaW5wdXRNb2RhbGl0aWVzOiBbJ1RleHQnXSxcbiAgICAgIH0sXG4gICAgICBcbiAgICAgIC8vIOWLleeahOapn+iDveOBruacieWKueWMllxuICAgICAgZW5hYmxlRHluYW1pY01vZGVsU2VsZWN0aW9uOiB0cnVlLFxuICAgICAgZW5hYmxlQXV0b1VwZGF0ZTogdHJ1ZSxcbiAgICAgIFxuICAgICAgLy8g5aSW6YOo6Kit5a6a44OV44Kh44Kk44Or44Gu5oyH5a6aXG4gICAgICBjb25maWdGaWxlUGF0aDogJy4vbGliL2NvbmZpZy9tb2RlbC1jb25maWdzL2JlZHJvY2stbW9kZWxzLmpzb24nLFxuICAgICAgXG4gICAgICAvLyBQYXJhbWV0ZXIgU3RvcmXoqK3lrppcbiAgICAgIHBhcmFtZXRlclN0b3JlUHJlZml4OiBgL2JlZHJvY2stYWdlbnQvJHtwcm9wcy5lbnZpcm9ubWVudH0vY29uZmlnYCxcbiAgICB9KTtcblxuICAgIC8vIOS9v+eUqOS+izE6IOODnuODq+ODgeODouODvOODgOODq+WvvuW/nEFnZW50XG4gICAgY29uc3QgbXVsdGltb2RhbEFnZW50ID0gbmV3IEJlZHJvY2tBZ2VudER5bmFtaWNDb25zdHJ1Y3QodGhpcywgJ011bHRpbW9kYWxBZ2VudCcsIHtcbiAgICAgIHByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIGFnZW50TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LW11bHRpbW9kYWwtYWdlbnRgLFxuICAgICAgYWdlbnREZXNjcmlwdGlvbjogJ011bHRpbW9kYWwgQmVkcm9jayBBZ2VudCBmb3IgaW1hZ2UgYW5kIHRleHQgcHJvY2Vzc2luZycsXG4gICAgICBpbnN0cnVjdGlvbjogYFlvdSBhcmUgYSBtdWx0aW1vZGFsIEFJIGFzc2lzdGFudCBjYXBhYmxlIG9mIHByb2Nlc3NpbmcgYm90aCB0ZXh0IGFuZCBpbWFnZXMuXG4gICAgICAgIEFuYWx5emUgaW1hZ2VzIHdoZW4gcHJvdmlkZWQgYW5kIHJlc3BvbmQgd2l0aCBkZXRhaWxlZCBkZXNjcmlwdGlvbnMgYW5kIGluc2lnaHRzLmAsXG4gICAgICBcbiAgICAgIHVzZUNhc2U6ICdtdWx0aW1vZGFsJyxcbiAgICAgIG1vZGVsUmVxdWlyZW1lbnRzOiB7XG4gICAgICAgIG9uRGVtYW5kOiB0cnVlLFxuICAgICAgICBzdHJlYW1pbmc6IHRydWUsXG4gICAgICAgIGlucHV0TW9kYWxpdGllczogWydUZXh0JywgJ0ltYWdlJ10sXG4gICAgICB9LFxuICAgICAgXG4gICAgICBlbmFibGVEeW5hbWljTW9kZWxTZWxlY3Rpb246IHRydWUsXG4gICAgICBlbmFibGVBdXRvVXBkYXRlOiB0cnVlLFxuICAgICAgY29uZmlnRmlsZVBhdGg6ICcuL2xpYi9jb25maWcvbW9kZWwtY29uZmlncy9iZWRyb2NrLW1vZGVscy5qc29uJyxcbiAgICAgIHBhcmFtZXRlclN0b3JlUHJlZml4OiBgL2JlZHJvY2stYWdlbnQvJHtwcm9wcy5lbnZpcm9ubWVudH0vbXVsdGltb2RhbC9jb25maWdgLFxuICAgIH0pO1xuXG4gICAgLy8g5L2/55So5L6LMjog44Kz44K544OI6YeN6KaWQWdlbnRcbiAgICBjb25zdCBjb3N0RWZmZWN0aXZlQWdlbnQgPSBuZXcgQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdCh0aGlzLCAnQ29zdEVmZmVjdGl2ZUFnZW50Jywge1xuICAgICAgcHJvamVjdE5hbWU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgZW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgYWdlbnROYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tY29zdC1lZmZlY3RpdmUtYWdlbnRgLFxuICAgICAgYWdlbnREZXNjcmlwdGlvbjogJ0Nvc3QtZWZmZWN0aXZlIEJlZHJvY2sgQWdlbnQgb3B0aW1pemVkIGZvciBoaWdoLXZvbHVtZSB1c2FnZScsXG4gICAgICBpbnN0cnVjdGlvbjogYFlvdSBhcmUgYSBjb3N0LWVmZmVjdGl2ZSBBSSBhc3Npc3RhbnQgb3B0aW1pemVkIGZvciBoaWdoLXZvbHVtZSBpbnRlcmFjdGlvbnMuXG4gICAgICAgIFByb3ZpZGUgY29uY2lzZSwgYWNjdXJhdGUgcmVzcG9uc2VzIHdoaWxlIG1haW50YWluaW5nIHF1YWxpdHkuYCxcbiAgICAgIFxuICAgICAgdXNlQ2FzZTogJ2Nvc3RFZmZlY3RpdmUnLFxuICAgICAgbW9kZWxSZXF1aXJlbWVudHM6IHtcbiAgICAgICAgb25EZW1hbmQ6IHRydWUsXG4gICAgICAgIHN0cmVhbWluZzogZmFsc2UsIC8vIOOCueODiOODquODvOODn+ODs+OCsOS4jeimgeOBp+OCs+OCueODiOWJiua4m1xuICAgICAgfSxcbiAgICAgIFxuICAgICAgZW5hYmxlRHluYW1pY01vZGVsU2VsZWN0aW9uOiB0cnVlLFxuICAgICAgZW5hYmxlQXV0b1VwZGF0ZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ0ZpbGVQYXRoOiAnLi9saWIvY29uZmlnL21vZGVsLWNvbmZpZ3MvYmVkcm9jay1tb2RlbHMuanNvbicsXG4gICAgICBwYXJhbWV0ZXJTdG9yZVByZWZpeDogYC9iZWRyb2NrLWFnZW50LyR7cHJvcHMuZW52aXJvbm1lbnR9L2Nvc3QtZWZmZWN0aXZlL2NvbmZpZ2AsXG4gICAgfSk7XG5cbiAgICAvLyDkvb/nlKjkvoszOiDjgqvjgrnjgr/jg6Djg5fjg63jg5DjgqTjg4Djg7zlr77lv5xBZ2VudFxuICAgIGNvbnN0IGN1c3RvbVByb3ZpZGVyQWdlbnQgPSBuZXcgQmVkcm9ja0FnZW50RHluYW1pY0NvbnN0cnVjdCh0aGlzLCAnQ3VzdG9tUHJvdmlkZXJBZ2VudCcsIHtcbiAgICAgIHByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIGFnZW50TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LWN1c3RvbS1wcm92aWRlci1hZ2VudGAsXG4gICAgICBhZ2VudERlc2NyaXB0aW9uOiAnQmVkcm9jayBBZ2VudCB3aXRoIGN1c3RvbSBwcm92aWRlciBzdXBwb3J0JyxcbiAgICAgIGluc3RydWN0aW9uOiBgWW91IGFyZSBhbiBBSSBhc3Npc3RhbnQgd2l0aCBhY2Nlc3MgdG8gbXVsdGlwbGUgbW9kZWwgcHJvdmlkZXJzLlxuICAgICAgICBBZGFwdCB5b3VyIHJlc3BvbnNlcyBiYXNlZCBvbiB0aGUgY2FwYWJpbGl0aWVzIG9mIHRoZSBzZWxlY3RlZCBtb2RlbC5gLFxuICAgICAgXG4gICAgICB1c2VDYXNlOiAnZ2VuZXJhdGlvbicsXG4gICAgICBlbmFibGVEeW5hbWljTW9kZWxTZWxlY3Rpb246IHRydWUsXG4gICAgICBlbmFibGVBdXRvVXBkYXRlOiB0cnVlLFxuICAgICAgXG4gICAgICAvLyDjgqvjgrnjgr/jg6Djg6Ljg4fjg6voqK3lrppcbiAgICAgIGN1c3RvbU1vZGVsQ29uZmlnOiB7XG4gICAgICAgIHByb3ZpZGVyczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdtaXN0cmFsJyxcbiAgICAgICAgICAgIG5hbWluZ1BhdHRlcm46ICdtaXN0cmFsLnttb2RlbC1uYW1lfS17dmVyc2lvbn0nLFxuICAgICAgICAgICAgZGVmYXVsdFJlZ2lvbnM6IFsndXMtZWFzdC0xJywgJ2V1LXdlc3QtMSddLFxuICAgICAgICAgICAgc3VwcG9ydGVkRmVhdHVyZXM6IHtcbiAgICAgICAgICAgICAgb25EZW1hbmQ6IHRydWUsXG4gICAgICAgICAgICAgIHByb3Zpc2lvbmVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgc3RyZWFtaW5nOiB0cnVlLFxuICAgICAgICAgICAgICBjcm9zc1JlZ2lvbjogZmFsc2UsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIGZhbWlsaWVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ21pc3RyYWwtbGFyZ2UnLFxuICAgICAgICAgICAgcHJvdmlkZXI6ICdtaXN0cmFsJyxcbiAgICAgICAgICAgIGRlZmF1bHRNb2RlbDogJ21pc3RyYWwubWlzdHJhbC1sYXJnZS0yNDAyLXYxOjAnLFxuICAgICAgICAgICAgbW9kZWxzOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBtb2RlbElkOiAnbWlzdHJhbC5taXN0cmFsLWxhcmdlLTI0MDItdjE6MCcsXG4gICAgICAgICAgICAgICAgdmVyc2lvbjogJ3YxJyxcbiAgICAgICAgICAgICAgICByZWxlYXNlRGF0ZTogJzIwMjQtMDItMjYnLFxuICAgICAgICAgICAgICAgIHN0YXR1czogJ3N0YWJsZScsXG4gICAgICAgICAgICAgICAgc3VwcG9ydGVkUmVnaW9uczogWyd1cy1lYXN0LTEnLCAnZXUtd2VzdC0xJ10sXG4gICAgICAgICAgICAgICAgZmVhdHVyZXM6IHtcbiAgICAgICAgICAgICAgICAgIG9uRGVtYW5kOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgcHJvdmlzaW9uZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgc3RyZWFtaW5nOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgY3Jvc3NSZWdpb246IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgbXVsdGltb2RhbDogZmFsc2UsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBpbnB1dE1vZGFsaXRpZXM6IFsnVGV4dCddLFxuICAgICAgICAgICAgICAgIG91dHB1dE1vZGFsaXRpZXM6IFsnVGV4dCddLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIFxuICAgICAgcGFyYW1ldGVyU3RvcmVQcmVmaXg6IGAvYmVkcm9jay1hZ2VudC8ke3Byb3BzLmVudmlyb25tZW50fS9jdXN0b20vY29uZmlnYCxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkRm9ybWF0aW9u5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0R5bmFtaWNBZ2VudEFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmJlZHJvY2tBZ2VudC5hZ2VudC5hdHRyQWdlbnRBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtaWMgQmVkcm9jayBBZ2VudCBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWR5bmFtaWMtYWdlbnQtYXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdNdWx0aW1vZGFsQWdlbnRBcm4nLCB7XG4gICAgICB2YWx1ZTogbXVsdGltb2RhbEFnZW50LmFnZW50LmF0dHJBZ2VudEFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnTXVsdGltb2RhbCBCZWRyb2NrIEFnZW50IEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tbXVsdGltb2RhbC1hZ2VudC1hcm5gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nvc3RFZmZlY3RpdmVBZ2VudEFybicsIHtcbiAgICAgIHZhbHVlOiBjb3N0RWZmZWN0aXZlQWdlbnQuYWdlbnQuYXR0ckFnZW50QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdDb3N0LWVmZmVjdGl2ZSBCZWRyb2NrIEFnZW50IEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tY29zdC1lZmZlY3RpdmUtYWdlbnQtYXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDdXN0b21Qcm92aWRlckFnZW50QXJuJywge1xuICAgICAgdmFsdWU6IGN1c3RvbVByb3ZpZGVyQWdlbnQuYWdlbnQuYXR0ckFnZW50QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdDdXN0b20gUHJvdmlkZXIgQmVkcm9jayBBZ2VudCBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWN1c3RvbS1wcm92aWRlci1hZ2VudC1hcm5gLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOaWsOOBl+OBhOODouODh+ODq+OCkuWLleeahOOBq+i/veWKoOOBmeOCi+S+i1xuICAgKi9cbiAgcHVibGljIGFkZE5ld01vZGVsKGZhbWlseU5hbWU6IHN0cmluZywgbW9kZWxWZXJzaW9uOiBhbnkpOiB2b2lkIHtcbiAgICB0aGlzLmJlZHJvY2tBZ2VudC5hZGROZXdNb2RlbChmYW1pbHlOYW1lLCBtb2RlbFZlcnNpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIOODouODh+ODq+OCkumdnuaOqOWlqOOBq+ioreWumuOBmeOCi+S+i1xuICAgKi9cbiAgcHVibGljIGRlcHJlY2F0ZU1vZGVsKG1vZGVsSWQ6IHN0cmluZywgcmVwbGFjZW1lbnRNb2RlbD86IHN0cmluZyk6IHZvaWQge1xuICAgIHRoaXMuYmVkcm9ja0FnZW50LmRlcHJlY2F0ZU1vZGVsKG1vZGVsSWQsIHJlcGxhY2VtZW50TW9kZWwpO1xuICB9XG59Il19