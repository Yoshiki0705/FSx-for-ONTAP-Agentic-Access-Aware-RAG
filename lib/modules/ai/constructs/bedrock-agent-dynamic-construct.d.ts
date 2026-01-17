/**
 * Bedrock Agent 動的コンストラクト
 * モデル設定の動的変更に対応した次世代Bedrock Agentコンストラクト
 */
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
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
export declare class BedrockAgentDynamicConstruct extends Construct {
    /**
     * Bedrock Agent
     */
    readonly agent: bedrock.CfnAgent;
    /**
     * Agent Alias
     */
    readonly agentAlias: bedrock.CfnAgentAlias;
    /**
     * Agent IAMロール
     */
    readonly agentRole: iam.Role;
    /**
     * 選択されたモデルID
     */
    readonly selectedModel: string;
    /**
     * モデル設定管理
     */
    private readonly modelConfig;
    /**
     * モデル更新Lambda関数
     */
    modelUpdateFunction?: lambda.Function;
    /**
     * 設定監視Lambda関数
     */
    configWatcherFunction?: lambda.Function;
    constructor(scope: Construct, id: string, props: BedrockAgentDynamicConstructProps);
    /**
     * 最適なモデルを選択
     */
    private selectOptimalModel;
    /**
     * カスタム設定の適用
     */
    private applyCustomConfig;
    /**
     * 動的Agent IAMロール作成
     */
    private createDynamicAgentRole;
    /**
     * 動的Bedrock Agent作成
     */
    private createDynamicAgent;
    /**
     * 動的Agent Alias作成
     */
    private createDynamicAgentAlias;
    /**
     * 自動更新機能の設定
     */
    private setupAutoUpdate;
    /**
     * Parameter Store設定の作成
     */
    private createParameterStoreConfig;
    /**
     * CloudFormation出力作成
     */
    private createOutputs;
    /**
     * Knowledge Base ARNからIDを抽出
     */
    private extractKnowledgeBaseId;
    /**
     * 新しいモデルを動的に追加
     */
    addNewModel(familyName: string, modelVersion: any): void;
    /**
     * モデルを非推奨に設定
     */
    deprecateModel(modelId: string, replacementModel?: string): void;
    /**
     * Lambda関数にBedrock Agent権限を付与するヘルパーメソッド
     */
    grantInvokeToLambda(lambdaFunction: lambda.Function): void;
}
