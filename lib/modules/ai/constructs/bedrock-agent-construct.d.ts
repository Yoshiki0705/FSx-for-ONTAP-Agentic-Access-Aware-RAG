/**
 * Bedrock Agentコンストラクト
 * 権限認識型RAGシステムのためのBedrock Agent統合
 */
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';
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
export declare class BedrockAgentConstruct extends Construct {
    /**
     * Bedrock Agent
     */
    readonly agent?: bedrock.CfnAgent;
    /**
     * Agent Alias
     */
    readonly agentAlias?: bedrock.CfnAgentAlias;
    /**
     * Agent IAMロール
     */
    readonly agentRole?: iam.Role;
    /**
     * Agent ARN
     */
    readonly agentArn?: string;
    /**
     * Agent Alias ARN
     */
    readonly agentAliasArn?: string;
    constructor(scope: Construct, id: string, props: BedrockAgentConstructProps);
    /**
     * Agent IAMロール作成
     */
    private createAgentRole;
    /**
     * Bedrock Agent作成
     */
    private createAgent;
    /**
     * Agent Alias作成
     */
    private createAgentAlias;
    /**
     * Knowledge Base ARNからIDを抽出
     */
    private extractKnowledgeBaseId;
}
