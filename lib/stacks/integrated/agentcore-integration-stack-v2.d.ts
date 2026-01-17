/**
 * AgentCore統合スタック v2
 * Task 3.2: ハイブリッドアーキテクチャ統合
 *
 * AWS_REGION問題を回避した新しい実装
 * Fresh AgentCore Stackをベースに既存設定インターフェースと統合
 */
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { AgentCoreIntegrationConfig } from '../../config/interfaces/environment-config';
export interface AgentCoreIntegrationStackV2Props extends StackProps {
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
 * AgentCore統合スタック v2
 *
 * AWS_REGION問題を回避した実装:
 * - Fresh AgentCore Stackをベースに構築
 * - 既存の設定インターフェースとの互換性を保持
 * - 機能フラグによる制御をサポート
 *
 * 責任分離アーキテクチャを実現:
 * - Next.js: UI/UX処理、認証、設定管理
 * - AgentCore Runtime: AI処理、推論、モデル呼び出し
 * - API Gateway: 疎結合統合
 */
export declare class AgentCoreIntegrationStackV2 extends Stack {
    readonly agentCoreRuntimeFunction?: Function;
    readonly userPreferencesTable?: Table;
    readonly agentCoreApi?: RestApi;
    readonly hybridEventBus?: EventBus;
    readonly monitoringTopic?: Topic;
    private readonly config;
    private readonly featureFlags;
    constructor(scope: Construct, id: string, props: AgentCoreIntegrationStackV2Props);
    /**
     * ユーザー設定永続化インフラストラクチャ
     */
    private createUserPreferencesInfrastructure;
    /**
     * AgentCore Runtime作成
     * Fresh AgentCore Stackベースの実装（AWS_REGION問題を回避）
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
