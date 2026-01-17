/**
 * AgentCore統合スタック
 * Task 3.2: ハイブリッドアーキテクチャ統合
 *
 * 機能フラグによる有効化/無効化をサポート
 * アカウント非依存で再現可能な実装
 */
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { AgentCoreIntegrationConfig } from '../../config/interfaces/environment-config';
export interface AgentCoreIntegrationStackProps extends StackProps {
    /**
     * 統合設定
     */
    readonly config: AgentCoreIntegrationConfig;
    /**
     * 機能フラグ
     */
    readonly featureFlags: {
        readonly enableAgentCoreIntegration: boolean;
        readonly enableHybridArchitecture: boolean;
        readonly enableUserPreferences: boolean;
    };
    /**
     * 既存リソース参照
     */
    readonly existingResources?: {
        readonly vpcId?: string;
        readonly subnetIds?: string[];
        readonly securityGroupIds?: string[];
    };
}
/**
 * AgentCore統合スタック
 *
 * 責任分離アーキテクチャを実現:
 * - Next.js: UI/UX処理、認証、設定管理
 * - AgentCore Runtime: AI処理、推論、モデル呼び出し
 * - API Gateway: 疎結合統合
 */
export declare class AgentCoreIntegrationStack extends Stack {
    readonly agentCoreRuntimeFunction?: Function;
    readonly userPreferencesTable?: Table;
    readonly agentCoreApi?: RestApi;
    readonly hybridEventBus?: EventBus;
    readonly monitoringTopic?: Topic;
    private readonly config;
    private readonly featureFlags;
    constructor(scope: Construct, id: string, props: AgentCoreIntegrationStackProps);
    /**
     * ユーザー設定永続化インフラストラクチャ
     */
    private createUserPreferencesInfrastructure;
    /**
     * AgentCore Runtime作成
     */
    private createAgentCoreRuntime;
    /**
     * ハイブリッドアーキテクチャ統合
     */
    private createHybridArchitecture;
    /**
     * 監視・アラートインフラストラクチャ
     */
    private createMonitoringInfrastructure;
    /**
     * CloudFormation Outputs
     */
    private createOutputs;
}
