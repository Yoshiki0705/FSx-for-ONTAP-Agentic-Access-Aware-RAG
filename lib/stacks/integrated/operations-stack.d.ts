/**
 * OperationsStack - 統合運用・エンタープライズスタック（モジュラーアーキテクチャ対応）
 *
 * 機能:
 * - 統合監視・エンタープライズコンストラクトによる一元管理
 * - CloudWatch・X-Ray・SNS・BI・組織管理の統合
 * - Agent Steering準拠命名規則対応
 * - 個別スタックデプロイ完全対応
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MonitoringConstruct } from '../../modules/monitoring/constructs/monitoring-construct';
import { EnterpriseConstruct } from '../../modules/enterprise/constructs/enterprise-construct';
import { SecurityStack } from './security-stack';
import { DataStack } from './data-stack';
import { EmbeddingStack } from './embedding-stack';
import { WebAppStack } from './webapp-stack';
import { BedrockAgentCoreObservabilityConstruct } from '../../modules/ai/constructs/bedrock-agent-core-observability-construct';
import { BedrockAgentCoreEvaluationsConstruct } from '../../modules/ai/constructs/bedrock-agent-core-evaluations-construct';
import { AgentCoreConfig } from '../../../types/agentcore-config';
export interface OperationsStackProps extends cdk.StackProps {
    readonly config: any;
    readonly securityStack?: SecurityStack;
    readonly dataStack?: DataStack;
    readonly embeddingStack?: EmbeddingStack;
    readonly webAppStack?: WebAppStack;
    readonly namingGenerator?: any;
    readonly projectName: string;
    readonly environment: string;
    readonly agentCore?: AgentCoreConfig;
}
/**
 * 統合運用・エンタープライズスタック（モジュラーアーキテクチャ対応）
 *
 * 統合監視・エンタープライズコンストラクトによる一元管理
 * 個別スタックデプロイ完全対応
 */
export declare class OperationsStack extends cdk.Stack {
    /** 統合監視コンストラクト */
    readonly monitoring: MonitoringConstruct;
    /** 統合エンタープライズコンストラクト */
    readonly enterprise: EnterpriseConstruct;
    /** CloudWatchダッシュボードURL（他スタックからの参照用） */
    readonly dashboardUrl?: string;
    /** SNSトピックARN（他スタックからの参照用） */
    readonly snsTopicArns: {
        [key: string]: string;
    };
    /** Phase 4: AgentCore Constructs（オプション） */
    agentCoreObservability?: BedrockAgentCoreObservabilityConstruct;
    agentCoreEvaluations?: BedrockAgentCoreEvaluationsConstruct;
    constructor(scope: Construct, id: string, props: OperationsStackProps);
    /**
     * 他スタックからの参照用プロパティ設定
     */
    private setupCrossStackReferences;
    /**
     * スタック出力作成（個別デプロイ対応）
     */
    private createOutputs;
    /**
     * スタックタグ設定（統一されたタグ戦略使用）
     */
    private addStackTags;
    /**
     * AgentCore Constructs統合（Phase 4）
     */
    private integrateAgentCoreConstructs;
    /**
     * AgentCore CloudFormation Outputsを作成
     */
    private createAgentCoreOutputs;
}
