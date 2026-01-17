/**
 * SecurityStack - 統合セキュリティスタック（モジュラーアーキテクチャ対応）
 *
 * 機能:
 * - 統合セキュリティコンストラクトによる一元管理
 * - KMS・WAF・GuardDuty・CloudTrail・IAMの統合
 * - Agent Steering準拠命名規則対応
 * - 個別スタックデプロイ完全対応
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityConstruct } from '../../modules/security/constructs/security-construct';
import { BedrockGuardrailsConstruct } from '../../modules/security/constructs/bedrock-guardrails-construct';
import { GuardrailPresetType } from '../../modules/security/config/guardrails-presets';
import { BedrockAgentCoreIdentityConstruct } from '../../modules/ai/constructs/bedrock-agent-core-identity-construct';
import { BedrockAgentCorePolicyConstruct } from '../../modules/ai/constructs/bedrock-agent-core-policy-construct';
import { AgentCoreConfig } from '../../../types/agentcore-config';
export interface SecurityStackProps extends cdk.StackProps {
    readonly config: any;
    readonly namingGenerator?: any;
    readonly projectName: string;
    readonly environment: string;
    readonly useBedrockGuardrails?: boolean;
    readonly guardrailPreset?: GuardrailPresetType;
    readonly agentCore?: AgentCoreConfig;
}
/**
 * 統合セキュリティスタック（モジュラーアーキテクチャ対応）
 *
 * 統合セキュリティコンストラクトによる一元管理
 * 個別スタックデプロイ完全対応
 */
export declare class SecurityStack extends cdk.Stack {
    /** 統合セキュリティコンストラクト */
    readonly security: SecurityConstruct;
    /** KMSキー（他スタックからの参照用） */
    readonly kmsKey: cdk.aws_kms.Key;
    /** WAF WebACL ARN（他スタックからの参照用） */
    readonly wafWebAclArn?: string;
    /** Bedrock Guardrails（Phase 5 - エンタープライズオプション） */
    readonly bedrockGuardrails?: BedrockGuardrailsConstruct;
    readonly guardrailArn?: string;
    readonly guardrailId?: string;
    /** Phase 4: AgentCore Constructs（オプション） */
    agentCoreIdentity?: BedrockAgentCoreIdentityConstruct;
    agentCorePolicy?: BedrockAgentCorePolicyConstruct;
    constructor(scope: Construct, id: string, props: SecurityStackProps);
    /**
     * Bedrock Guardrails作成（Phase 5 - エンタープライズオプション）
     */
    private createBedrockGuardrails;
    /**
     * スタック出力作成（個別デプロイ対応）
     */
    private createOutputs;
    /**
     * スタックタグ設定（Agent Steering準拠）
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
