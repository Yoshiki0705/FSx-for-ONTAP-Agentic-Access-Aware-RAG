/**
 * Amazon Bedrock AgentCore Memory Construct
 *
 * このConstructは、Bedrock AgentのMemory機能を提供します。
 *
 * 重要: AgentCore Memoryは完全なフルマネージドサービスです。
 * Memory Resourceを作成するだけで、AWSが以下を自動的に管理します：
 * - ストレージ（DynamoDB、OpenSearch Serverless、FSx for ONTAP）
 * - ベクトル化（Bedrock Embeddings）
 * - メモリ抽出（短期→長期メモリの自動変換）
 *
 * 主要機能:
 * - Memory Resource作成（CfnMemory）
 * - 3つのMemory Strategies設定（Semantic、Summary、User Preference）
 * - KMS暗号化設定（オプション）
 * - IAM Role設定（オプション）
 *
 * @author Kiro AI
 * @date 2026-01-03
 * @version 2.0.0 - AgentCore Memory APIベースに完全書き換え
 */
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
/**
 * Memory Strategy設定
 */
export interface MemoryStrategyConfig {
    /**
     * Semantic Memory（意味的長期記憶）の有効化
     * デフォルト: true
     */
    readonly enableSemantic?: boolean;
    /**
     * Summary Memory（要約記憶）の有効化
     * デフォルト: true
     */
    readonly enableSummary?: boolean;
    /**
     * User Preference Memory（ユーザー嗜好記憶）の有効化
     * デフォルト: true
     */
    readonly enableUserPreference?: boolean;
    /**
     * Semantic Memoryのnamespaces
     * デフォルト: ['default']
     */
    readonly semanticNamespaces?: string[];
    /**
     * Summary Memoryのnamespaces
     * デフォルト: ['default']
     */
    readonly summaryNamespaces?: string[];
    /**
     * User Preference Memoryのnamespaces
     * デフォルト: ['default']
     */
    readonly userPreferenceNamespaces?: string[];
}
/**
 * KMS暗号化設定
 */
export interface KmsConfig {
    /**
     * KMS Key ARN（既存のKMS Keyを使用する場合）
     */
    readonly keyArn?: string;
    /**
     * KMS Key Aliasプレフィックス
     */
    readonly keyAliasPrefix?: string;
}
/**
 * Memory Construct プロパティ
 */
export interface BedrockAgentCoreMemoryConstructProps {
    /**
     * Memory機能の有効化フラグ
     */
    readonly enabled: boolean;
    /**
     * プロジェクト名
     */
    readonly projectName: string;
    /**
     * 環境名（dev, staging, prod）
     */
    readonly environment: string;
    /**
     * イベント有効期限（日数）
     * デフォルト: 90日
     *
     * 短期メモリ（イベント）の保持期間を指定します。
     * この期間を過ぎたイベントは自動的に削除されます。
     */
    readonly eventExpiryDuration?: number;
    /**
     * Memory Strategy設定
     */
    readonly memoryStrategy?: MemoryStrategyConfig;
    /**
     * KMS暗号化設定
     */
    readonly kms?: KmsConfig;
    /**
     * Memory実行ロールARN（既存のロールを使用する場合）
     *
     * 指定しない場合、自動的に新しいロールが作成されます。
     */
    readonly memoryExecutionRoleArn?: string;
    /**
     * タグ
     */
    readonly tags?: {
        [key: string]: string;
    };
}
/**
 * Amazon Bedrock AgentCore Memory Construct
 *
 * Bedrock AgentのMemory機能を提供します。
 *
 * 使用方法:
 * ```typescript
 * const memory = new BedrockAgentCoreMemoryConstruct(this, 'Memory', {
 *   enabled: true,
 *   projectName: 'my-project',
 *   environment: 'prod',
 *   eventExpiryDuration: 90,
 * });
 *
 * // Memory Resource ARNを取得
 * const memoryArn = memory.memoryResourceArn;
 *
 * // Memory Resource IDを取得
 * const memoryId = memory.memoryResourceId;
 * ```
 *
 * アプリケーション側での使用例:
 * ```typescript
 * import { BedrockAgentCoreClient, WriteEventCommand } from '@aws-sdk/client-bedrock-agent-core';
 *
 * const client = new BedrockAgentCoreClient({ region: 'ap-northeast-1' });
 *
 * // イベント書き込み（短期メモリ）
 * await client.send(new WriteEventCommand({
 *   memoryId: 'memory-resource-id',
 *   actorId: 'user-123',
 *   sessionId: 'session-456',
 *   content: { text: 'こんにちは', role: 'USER' },
 * }));
 *
 * // 長期メモリ検索
 * await client.send(new SearchLongTermMemoriesCommand({
 *   memoryId: 'memory-resource-id',
 *   actorId: 'user-123',
 *   query: '検索クエリ',
 *   topK: 5,
 * }));
 * ```
 */
export declare class BedrockAgentCoreMemoryConstruct extends Construct {
    /**
     * Memory Resource ARN
     */
    readonly memoryResourceArn: string;
    /**
     * Memory Resource ID
     */
    readonly memoryResourceId: string;
    /**
     * KMS暗号化キー
     */
    readonly kmsKey?: kms.IKey;
    /**
     * Memory実行ロール
     */
    readonly executionRole?: iam.IRole;
    constructor(scope: Construct, id: string, props: BedrockAgentCoreMemoryConstructProps);
    /**
     * リージョンプレフィックスを取得
     */
    private getRegionPrefix;
    /**
     * Memory実行ロールを作成
     */
    private createExecutionRole;
    /**
     * Memory Strategiesを構築
     */
    private buildMemoryStrategies;
}
