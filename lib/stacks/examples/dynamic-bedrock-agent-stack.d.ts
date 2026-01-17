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
export declare class DynamicBedrockAgentStack extends cdk.Stack {
    readonly bedrockAgent: BedrockAgentDynamicConstruct;
    constructor(scope: Construct, id: string, props: DynamicBedrockAgentStackProps);
    /**
     * 新しいモデルを動的に追加する例
     */
    addNewModel(familyName: string, modelVersion: any): void;
    /**
     * モデルを非推奨に設定する例
     */
    deprecateModel(modelId: string, replacementModel?: string): void;
}
