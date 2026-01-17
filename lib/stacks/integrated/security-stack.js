"use strict";
/**
 * SecurityStack - 統合セキュリティスタック（モジュラーアーキテクチャ対応）
 *
 * 機能:
 * - 統合セキュリティコンストラクトによる一元管理
 * - KMS・WAF・GuardDuty・CloudTrail・IAMの統合
 * - Agent Steering準拠命名規則対応
 * - 個別スタックデプロイ完全対応
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
exports.SecurityStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
// 統合セキュリティコンストラクト（モジュラーアーキテクチャ）
const security_construct_1 = require("../../modules/security/constructs/security-construct");
const bedrock_guardrails_construct_1 = require("../../modules/security/constructs/bedrock-guardrails-construct");
// Guardrailsプリセット
const guardrails_presets_1 = require("../../modules/security/config/guardrails-presets");
// タグ設定
const tagging_config_1 = require("../../config/tagging-config");
// Phase 4: AgentCore Constructs統合
const bedrock_agent_core_identity_construct_1 = require("../../modules/ai/constructs/bedrock-agent-core-identity-construct");
const bedrock_agent_core_policy_construct_1 = require("../../modules/ai/constructs/bedrock-agent-core-policy-construct");
/**
 * 統合セキュリティスタック（モジュラーアーキテクチャ対応）
 *
 * 統合セキュリティコンストラクトによる一元管理
 * 個別スタックデプロイ完全対応
 */
class SecurityStack extends cdk.Stack {
    /** 統合セキュリティコンストラクト */
    security;
    /** KMSキー（他スタックからの参照用） */
    kmsKey;
    /** WAF WebACL ARN（他スタックからの参照用） */
    wafWebAclArn;
    /** Bedrock Guardrails（Phase 5 - エンタープライズオプション） */
    bedrockGuardrails;
    guardrailArn;
    guardrailId;
    /** Phase 4: AgentCore Constructs（オプション） */
    agentCoreIdentity;
    agentCorePolicy;
    constructor(scope, id, props) {
        super(scope, id, props);
        console.log('🔒 SecurityStack初期化開始...');
        console.log('📝 スタック名:', id);
        console.log('🏷️ Agent Steering準拠:', props.namingGenerator ? 'Yes' : 'No');
        // コスト配布タグの適用
        const taggingConfig = tagging_config_1.PermissionAwareRAGTags.getStandardConfig(props.projectName, props.environment);
        tagging_config_1.TaggingStrategy.applyTagsToStack(this, taggingConfig);
        // 設定構造の変換（tokyoProductionConfig形式 → SecurityConstruct形式）
        const securityConfig = {
            iam: {
                enforceStrongPasswords: true,
                mfaRequired: false,
                sessionTimeout: 3600
            },
            kms: {
                keyRotation: props.config.security?.kmsKeyRotation ?? true,
                keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
                keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
                alias: `alias/${props.config.project.name}-${props.config.environment}`,
                pendingWindow: 30
            },
            waf: {
                enabled: props.config.security?.enableWaf ?? false,
                scope: 'REGIONAL',
                rules: {
                    awsManagedRules: true,
                    rateLimiting: true
                }
            },
            guardDuty: {
                enabled: props.config.security?.enableGuardDuty ?? false,
                findingPublishingFrequency: 'SIX_HOURS'
            },
            compliance: {
                auditLogging: true,
                fiscCompliance: false,
                personalInfoProtection: true
            },
            monitoring: {
                cloudTrail: props.config.security?.enableCloudTrail ?? false,
                config: props.config.security?.enableConfig ?? false
            }
        };
        // 統合セキュリティコンストラクト作成
        this.security = new security_construct_1.SecurityConstruct(this, 'Security', {
            config: securityConfig,
            projectName: props.config.project.name,
            environment: props.config.environment,
            namingGenerator: props.namingGenerator,
        });
        // 他スタックからの参照用プロパティ設定
        this.kmsKey = this.security.kmsKey;
        this.wafWebAclArn = this.security.wafWebAcl?.attrArn;
        // Bedrock Guardrails統合（Phase 5 - エンタープライズオプション）
        const useBedrockGuardrails = this.node.tryGetContext('useBedrockGuardrails') ?? props.useBedrockGuardrails ?? false;
        if (useBedrockGuardrails) {
            console.log('🛡️ Bedrock Guardrails有効化...');
            this.bedrockGuardrails = this.createBedrockGuardrails(props);
            this.guardrailArn = this.bedrockGuardrails.guardrailArn;
            this.guardrailId = this.bedrockGuardrails.guardrailId;
            console.log('✅ Bedrock Guardrails作成完了');
        }
        // Phase 4: AgentCore Constructs統合（オプション）
        if (props.agentCore || props.config.agentCore) {
            console.log('');
            console.log('========================================');
            console.log('🚀 AgentCore Constructs統合開始...');
            console.log('========================================');
            this.integrateAgentCoreConstructs(props);
            console.log('✅ AgentCore Constructs統合完了');
        }
        // スタック出力
        this.createOutputs();
        // タグ設定
        this.addStackTags();
        console.log('✅ SecurityStack初期化完了');
    }
    /**
     * Bedrock Guardrails作成（Phase 5 - エンタープライズオプション）
     */
    createBedrockGuardrails(props) {
        const presetType = this.node.tryGetContext('guardrailPreset') ?? props.guardrailPreset ?? 'standard';
        const preset = (0, guardrails_presets_1.getGuardrailPreset)(presetType);
        return new bedrock_guardrails_construct_1.BedrockGuardrailsConstruct(this, 'BedrockGuardrails', {
            enabled: true,
            projectName: props.projectName,
            environment: props.environment,
            guardrailName: `${props.projectName}-${props.environment}-guardrails`,
            description: preset.description,
            contentPolicyConfig: preset.contentPolicyConfig,
            topicPolicyConfig: preset.topicPolicyConfig,
            sensitiveInformationPolicyConfig: preset.sensitiveInformationPolicyConfig,
            wordPolicyConfig: preset.wordPolicyConfig,
            blockedInputMessaging: preset.blockedInputMessaging,
            blockedOutputsMessaging: preset.blockedOutputsMessaging,
        });
    }
    /**
     * スタック出力作成（個別デプロイ対応）
     */
    createOutputs() {
        // KMSキー出力（他スタックからの参照用）
        new cdk.CfnOutput(this, 'KmsKeyId', {
            value: this.security.kmsKey.keyId,
            description: 'Security KMS Key ID',
            exportName: `${this.stackName}-KmsKeyId`,
        });
        new cdk.CfnOutput(this, 'KmsKeyArn', {
            value: this.security.kmsKey.keyArn,
            description: 'Security KMS Key ARN',
            exportName: `${this.stackName}-KmsKeyArn`,
        });
        // WAF WebACL出力（存在する場合のみ）
        if (this.security.wafWebAcl) {
            new cdk.CfnOutput(this, 'WafWebAclId', {
                value: this.security.wafWebAcl.attrId,
                description: 'WAF Web ACL ID',
                exportName: `${this.stackName}-WafWebAclId`,
            });
            new cdk.CfnOutput(this, 'WafWebAclArn', {
                value: this.security.wafWebAcl.attrArn,
                description: 'WAF Web ACL ARN',
                exportName: `${this.stackName}-WafWebAclArn`,
            });
        }
        // GuardDuty出力（存在する場合のみ）
        if (this.security.guardDutyDetector) {
            new cdk.CfnOutput(this, 'GuardDutyDetectorId', {
                value: this.security.guardDutyDetector.attrId,
                description: 'GuardDuty Detector ID',
                exportName: `${this.stackName}-GuardDutyDetectorId`,
            });
        }
        // CloudTrail出力（存在する場合のみ）
        if (this.security.cloudTrail) {
            new cdk.CfnOutput(this, 'CloudTrailArn', {
                value: this.security.cloudTrail.trailArn,
                description: 'CloudTrail ARN',
                exportName: `${this.stackName}-CloudTrailArn`,
            });
        }
        // Bedrock Guardrails出力（存在する場合のみ）
        if (this.bedrockGuardrails) {
            new cdk.CfnOutput(this, 'GuardrailArn', {
                value: this.bedrockGuardrails.guardrailArn,
                description: 'Bedrock Guardrail ARN',
                exportName: `${this.stackName}-GuardrailArn`,
            });
            new cdk.CfnOutput(this, 'GuardrailId', {
                value: this.bedrockGuardrails.guardrailId,
                description: 'Bedrock Guardrail ID',
                exportName: `${this.stackName}-GuardrailId`,
            });
            new cdk.CfnOutput(this, 'GuardrailVersion', {
                value: this.bedrockGuardrails.guardrailVersion,
                description: 'Bedrock Guardrail Version',
                exportName: `${this.stackName}-GuardrailVersion`,
            });
        }
        console.log('📤 SecurityStack出力値作成完了');
    }
    /**
     * スタックタグ設定（Agent Steering準拠）
     */
    addStackTags() {
        cdk.Tags.of(this).add('Module', 'Security');
        cdk.Tags.of(this).add('StackType', 'Integrated');
        cdk.Tags.of(this).add('Architecture', 'Modular');
        cdk.Tags.of(this).add('ManagedBy', 'CDK');
        cdk.Tags.of(this).add('SecurityCompliance', 'Enabled');
        cdk.Tags.of(this).add('IndividualDeploySupport', 'Yes');
        console.log('🏷️ SecurityStackタグ設定完了');
    }
    /**
     * AgentCore Constructs統合（Phase 4）
     */
    integrateAgentCoreConstructs(props) {
        const agentCoreConfig = props.agentCore || props.config.agentCore;
        if (!agentCoreConfig) {
            return;
        }
        // 1. Identity Construct（認証・認可）
        if (agentCoreConfig.identity?.enabled) {
            console.log('🔐 Identity Construct作成中...');
            this.agentCoreIdentity = new bedrock_agent_core_identity_construct_1.BedrockAgentCoreIdentityConstruct(this, 'AgentCoreIdentity', {
                enabled: true,
                projectName: props.projectName,
                environment: props.environment,
                dynamoDbConfig: agentCoreConfig.identity.dynamodbConfig,
                rbacConfig: agentCoreConfig.identity.rbacConfig,
                ...(this.kmsKey ? { encryptionKey: this.kmsKey } : {}),
            });
            console.log('✅ Identity Construct作成完了');
        }
        // 2. Policy Construct（ポリシー管理）
        if (agentCoreConfig.policy?.enabled) {
            console.log('📜 Policy Construct作成中...');
            this.agentCorePolicy = new bedrock_agent_core_policy_construct_1.BedrockAgentCorePolicyConstruct(this, 'AgentCorePolicy', {
                enabled: true,
                projectName: props.projectName,
                environment: props.environment,
                ...agentCoreConfig.policy,
                ...(this.kmsKey ? { encryptionKey: this.kmsKey } : {}),
            });
            console.log('✅ Policy Construct作成完了');
        }
        // CloudFormation Outputs
        this.createAgentCoreOutputs();
    }
    /**
     * AgentCore CloudFormation Outputsを作成
     */
    createAgentCoreOutputs() {
        console.log('📤 AgentCore Outputs作成中...');
        // Identity Outputs
        if (this.agentCoreIdentity?.identityTable) {
            new cdk.CfnOutput(this, 'AgentCoreIdentityTableName', {
                value: this.agentCoreIdentity.identityTable.tableName,
                description: 'AgentCore Identity DynamoDB Table Name',
                exportName: `${this.stackName}-AgentCoreIdentityTableName`,
            });
            new cdk.CfnOutput(this, 'AgentCoreIdentityTableArn', {
                value: this.agentCoreIdentity.identityTable.tableArn,
                description: 'AgentCore Identity DynamoDB Table ARN',
                exportName: `${this.stackName}-AgentCoreIdentityTableArn`,
            });
        }
        // Policy Outputs
        if (this.agentCorePolicy?.auditLogTable) {
            new cdk.CfnOutput(this, 'AgentCorePolicyAuditLogTableName', {
                value: this.agentCorePolicy.auditLogTable.tableName,
                description: 'AgentCore Policy Audit Log Table Name',
                exportName: `${this.stackName}-AgentCorePolicyAuditLogTableName`,
            });
            new cdk.CfnOutput(this, 'AgentCorePolicyAuditLogTableArn', {
                value: this.agentCorePolicy.auditLogTable.tableArn,
                description: 'AgentCore Policy Audit Log Table ARN',
                exportName: `${this.stackName}-AgentCorePolicyAuditLogTableArn`,
            });
        }
        if (this.agentCorePolicy?.policyFunction) {
            new cdk.CfnOutput(this, 'AgentCorePolicyFunctionArn', {
                value: this.agentCorePolicy.policyFunction.functionArn,
                description: 'AgentCore Policy Lambda Function ARN',
                exportName: `${this.stackName}-AgentCorePolicyFunctionArn`,
            });
        }
        console.log('✅ AgentCore Outputs作成完了');
    }
}
exports.SecurityStack = SecurityStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZWN1cml0eS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUkzQyxnQ0FBZ0M7QUFDaEMsNkZBQXlGO0FBQ3pGLGlIQUE0RztBQUs1RyxrQkFBa0I7QUFDbEIseUZBQTJHO0FBRTNHLE9BQU87QUFDUCxnRUFBc0Y7QUFFdEYsa0NBQWtDO0FBQ2xDLDZIQUFzSDtBQUN0SCx5SEFBa0g7QUFpQmxIOzs7OztHQUtHO0FBQ0gsTUFBYSxhQUFjLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDMUMsc0JBQXNCO0lBQ04sUUFBUSxDQUFvQjtJQUU1Qyx5QkFBeUI7SUFDVCxNQUFNLENBQWtCO0lBRXhDLGtDQUFrQztJQUNsQixZQUFZLENBQVU7SUFFdEMsa0RBQWtEO0lBQ2xDLGlCQUFpQixDQUE4QjtJQUMvQyxZQUFZLENBQVU7SUFDdEIsV0FBVyxDQUFVO0lBRXJDLDJDQUEyQztJQUNwQyxpQkFBaUIsQ0FBcUM7SUFDdEQsZUFBZSxDQUFtQztJQUV6RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXlCO1FBQ2pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE9BQU8sQ0FBQyxHQUFHLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUN4QyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixFQUFFLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFM0UsYUFBYTtRQUNiLE1BQU0sYUFBYSxHQUFHLHVDQUFzQixDQUFDLGlCQUFpQixDQUM1RCxL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LDRCQUE0QjthQUMxRCxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsaUJBQWlCO1FBQ2pCLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxhQUFhLEVBQUUsQ0FBQztZQUN4QyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtDQUFrQyxFQUFFO2dCQUMxRCxLQUFLLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsU0FBUztnQkFDbkQsV0FBVyxFQUFFLHVDQUF1QztnQkFDcEQsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsbUNBQW1DO2FBQ2pFLENBQUMsQ0FBQztZQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUNBQWlDLEVBQUU7Z0JBQ3pELEtBQUssRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLGFBQWEsQ0FBQyxRQUFRO2dCQUNsRCxXQUFXLEVBQUUsc0NBQXNDO2dCQUNuRCxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxrQ0FBa0M7YUFDaEUsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxjQUFjLEVBQUUsQ0FBQztZQUN6QyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO2dCQUNwRCxLQUFLLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsV0FBVztnQkFDdEQsV0FBVyxFQUFFLHNDQUFzQztnQkFDbkQsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsNkJBQTZCO2FBQzNELENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDekMsQ0FBQztDQUNGO0FBclRELHNDQXFUQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU2VjdXJpdHlTdGFjayAtIOe1seWQiOOCu+OCreODpeODquODhuOCo+OCueOCv+ODg+OCr++8iOODouOCuOODpeODqeODvOOCouODvOOCreODhuOCr+ODgeODo+WvvuW/nO+8iVxuICogXG4gKiDmqZ/og706XG4gKiAtIOe1seWQiOOCu+OCreODpeODquODhuOCo+OCs+ODs+OCueODiOODqeOCr+ODiOOBq+OCiOOCi+S4gOWFg+euoeeQhlxuICogLSBLTVPjg7tXQUbjg7tHdWFyZER1dHnjg7tDbG91ZFRyYWls44O7SUFN44Gu57Wx5ZCIXG4gKiAtIEFnZW50IFN0ZWVyaW5n5rqW5oug5ZG95ZCN6KaP5YmH5a++5b+cXG4gKiAtIOWAi+WIpeOCueOCv+ODg+OCr+ODh+ODl+ODreOCpOWujOWFqOWvvuW/nFxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBrbXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWttcyc7XG5pbXBvcnQgKiBhcyB3YWZ2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtd2FmdjInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbi8vIOe1seWQiOOCu+OCreODpeODquODhuOCo+OCs+ODs+OCueODiOODqeOCr+ODiO+8iOODouOCuOODpeODqeODvOOCouODvOOCreODhuOCr+ODgeODo++8iVxuaW1wb3J0IHsgU2VjdXJpdHlDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL3NlY3VyaXR5L2NvbnN0cnVjdHMvc2VjdXJpdHktY29uc3RydWN0JztcbmltcG9ydCB7IEJlZHJvY2tHdWFyZHJhaWxzQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9zZWN1cml0eS9jb25zdHJ1Y3RzL2JlZHJvY2stZ3VhcmRyYWlscy1jb25zdHJ1Y3QnO1xuXG4vLyDjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrlcbmltcG9ydCB7IFNlY3VyaXR5Q29uZmlnIH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9zZWN1cml0eS9pbnRlcmZhY2VzL3NlY3VyaXR5LWNvbmZpZyc7XG5cbi8vIEd1YXJkcmFpbHPjg5fjg6rjgrvjg4Pjg4hcbmltcG9ydCB7IGdldEd1YXJkcmFpbFByZXNldCwgR3VhcmRyYWlsUHJlc2V0VHlwZSB9IGZyb20gJy4uLy4uL21vZHVsZXMvc2VjdXJpdHkvY29uZmlnL2d1YXJkcmFpbHMtcHJlc2V0cyc7XG5cbi8vIOOCv+OCsOioreWumlxuaW1wb3J0IHsgVGFnZ2luZ1N0cmF0ZWd5LCBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzIH0gZnJvbSAnLi4vLi4vY29uZmlnL3RhZ2dpbmctY29uZmlnJztcblxuLy8gUGhhc2UgNDogQWdlbnRDb3JlIENvbnN0cnVjdHPntbHlkIhcbmltcG9ydCB7IEJlZHJvY2tBZ2VudENvcmVJZGVudGl0eUNvbnN0cnVjdCB9IGZyb20gJy4uLy4uL21vZHVsZXMvYWkvY29uc3RydWN0cy9iZWRyb2NrLWFnZW50LWNvcmUtaWRlbnRpdHktY29uc3RydWN0JztcbmltcG9ydCB7IEJlZHJvY2tBZ2VudENvcmVQb2xpY3lDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2FpL2NvbnN0cnVjdHMvYmVkcm9jay1hZ2VudC1jb3JlLXBvbGljeS1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgQWdlbnRDb3JlQ29uZmlnIH0gZnJvbSAnLi4vLi4vLi4vdHlwZXMvYWdlbnRjb3JlLWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VjdXJpdHlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICByZWFkb25seSBjb25maWc6IGFueTsgLy8g57Wx5ZCI6Kit5a6a44Kq44OW44K444Kn44Kv44OIXG4gIHJlYWRvbmx5IG5hbWluZ0dlbmVyYXRvcj86IGFueTsgLy8gQWdlbnQgU3RlZXJpbmfmupbmi6Dlkb3lkI3jgrjjgqfjg43jg6zjg7zjgr/jg7zvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgcmVhZG9ubHkgcHJvamVjdE5hbWU6IHN0cmluZzsgLy8g44OX44Ot44K444Kn44Kv44OI5ZCN77yI44Kz44K544OI6YWN5biD55So77yJXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7IC8vIOeSsOWig+WQje+8iOOCs+OCueODiOmFjeW4g+eUqO+8iVxuICBcbiAgLy8gQmVkcm9jayBHdWFyZHJhaWxz6Kit5a6a77yIUGhhc2UgNSAtIOOCqOODs+OCv+ODvOODl+ODqeOCpOOCuuOCquODl+OCt+ODp+ODs++8iVxuICByZWFkb25seSB1c2VCZWRyb2NrR3VhcmRyYWlscz86IGJvb2xlYW47IC8vIEd1YXJkcmFpbHPmnInlirnljJbjg5Xjg6njgrBcbiAgcmVhZG9ubHkgZ3VhcmRyYWlsUHJlc2V0PzogR3VhcmRyYWlsUHJlc2V0VHlwZTsgLy8g44OX44Oq44K744OD44OI44K/44Kk44OXXG4gIFxuICAvLyBQaGFzZSA0OiBBZ2VudENvcmXoqK3lrppcbiAgcmVhZG9ubHkgYWdlbnRDb3JlPzogQWdlbnRDb3JlQ29uZmlnO1xufVxuXG4vKipcbiAqIOe1seWQiOOCu+OCreODpeODquODhuOCo+OCueOCv+ODg+OCr++8iOODouOCuOODpeODqeODvOOCouODvOOCreODhuOCr+ODgeODo+WvvuW/nO+8iVxuICogXG4gKiDntbHlkIjjgrvjgq3jg6Xjg6rjg4bjgqPjgrPjg7Pjgrnjg4jjg6njgq/jg4jjgavjgojjgovkuIDlhYPnrqHnkIZcbiAqIOWAi+WIpeOCueOCv+ODg+OCr+ODh+ODl+ODreOCpOWujOWFqOWvvuW/nFxuICovXG5leHBvcnQgY2xhc3MgU2VjdXJpdHlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIC8qKiDntbHlkIjjgrvjgq3jg6Xjg6rjg4bjgqPjgrPjg7Pjgrnjg4jjg6njgq/jg4ggKi9cbiAgcHVibGljIHJlYWRvbmx5IHNlY3VyaXR5OiBTZWN1cml0eUNvbnN0cnVjdDtcbiAgXG4gIC8qKiBLTVPjgq3jg7zvvIjku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7lj4LnhafnlKjvvIkgKi9cbiAgcHVibGljIHJlYWRvbmx5IGttc0tleTogY2RrLmF3c19rbXMuS2V5O1xuICBcbiAgLyoqIFdBRiBXZWJBQ0wgQVJO77yI5LuW44K544K/44OD44Kv44GL44KJ44Gu5Y+C54Wn55So77yJICovXG4gIHB1YmxpYyByZWFkb25seSB3YWZXZWJBY2xBcm4/OiBzdHJpbmc7XG4gIFxuICAvKiogQmVkcm9jayBHdWFyZHJhaWxz77yIUGhhc2UgNSAtIOOCqOODs+OCv+ODvOODl+ODqeOCpOOCuuOCquODl+OCt+ODp+ODs++8iSAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYmVkcm9ja0d1YXJkcmFpbHM/OiBCZWRyb2NrR3VhcmRyYWlsc0NvbnN0cnVjdDtcbiAgcHVibGljIHJlYWRvbmx5IGd1YXJkcmFpbEFybj86IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IGd1YXJkcmFpbElkPzogc3RyaW5nO1xuICBcbiAgLyoqIFBoYXNlIDQ6IEFnZW50Q29yZSBDb25zdHJ1Y3Rz77yI44Kq44OX44K344On44Oz77yJICovXG4gIHB1YmxpYyBhZ2VudENvcmVJZGVudGl0eT86IEJlZHJvY2tBZ2VudENvcmVJZGVudGl0eUNvbnN0cnVjdDtcbiAgcHVibGljIGFnZW50Q29yZVBvbGljeT86IEJlZHJvY2tBZ2VudENvcmVQb2xpY3lDb25zdHJ1Y3Q7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFNlY3VyaXR5U3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc29sZS5sb2coJ/CflJIgU2VjdXJpdHlTdGFja+WIneacn+WMlumWi+Wniy4uLicpO1xuICAgIGNvbnNvbGUubG9nKCfwn5OdIOOCueOCv+ODg+OCr+WQjTonLCBpZCk7XG4gICAgY29uc29sZS5sb2coJ/Cfj7fvuI8gQWdlbnQgU3RlZXJpbmfmupbmi6A6JywgcHJvcHMubmFtaW5nR2VuZXJhdG9yID8gJ1llcycgOiAnTm8nKTtcblxuICAgIC8vIOOCs+OCueODiOmFjeW4g+OCv+OCsOOBrumBqeeUqFxuICAgIGNvbnN0IHRhZ2dpbmdDb25maWcgPSBQZXJtaXNzaW9uQXdhcmVSQUdUYWdzLmdldFN0YW5kYXJkQ29uZmlnKFxuICAgICAgcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICBwcm9wcy5lbnZpcm9ubWVudCBhcyBcImRldlwiIHwgXCJzdGFnaW5nXCIgfCBcInByb2RcIlxuICAgICk7XG4gICAgVGFnZ2luZ1N0cmF0ZWd5LmFwcGx5VGFnc1RvU3RhY2sodGhpcywgdGFnZ2luZ0NvbmZpZyk7XG5cbiAgICAvLyDoqK3lrprmp4vpgKDjga7lpInmj5vvvIh0b2t5b1Byb2R1Y3Rpb25Db25maWflvaLlvI8g4oaSIFNlY3VyaXR5Q29uc3RydWN05b2i5byP77yJXG4gICAgY29uc3Qgc2VjdXJpdHlDb25maWc6IFNlY3VyaXR5Q29uZmlnID0ge1xuICAgICAgaWFtOiB7XG4gICAgICAgIGVuZm9yY2VTdHJvbmdQYXNzd29yZHM6IHRydWUsXG4gICAgICAgIG1mYVJlcXVpcmVkOiBmYWxzZSxcbiAgICAgICAgc2Vzc2lvblRpbWVvdXQ6IDM2MDBcbiAgICAgIH0sXG4gICAgICBrbXM6IHtcbiAgICAgICAga2V5Um90YXRpb246IHByb3BzLmNvbmZpZy5zZWN1cml0eT8ua21zS2V5Um90YXRpb24gPz8gdHJ1ZSxcbiAgICAgICAga2V5U3BlYzoga21zLktleVNwZWMuU1lNTUVUUklDX0RFRkFVTFQsXG4gICAgICAgIGtleVVzYWdlOiBrbXMuS2V5VXNhZ2UuRU5DUllQVF9ERUNSWVBULFxuICAgICAgICBhbGlhczogYGFsaWFzLyR7cHJvcHMuY29uZmlnLnByb2plY3QubmFtZX0tJHtwcm9wcy5jb25maWcuZW52aXJvbm1lbnR9YCxcbiAgICAgICAgcGVuZGluZ1dpbmRvdzogMzBcbiAgICAgIH0sXG4gICAgICB3YWY6IHtcbiAgICAgICAgZW5hYmxlZDogcHJvcHMuY29uZmlnLnNlY3VyaXR5Py5lbmFibGVXYWYgPz8gZmFsc2UsXG4gICAgICAgIHNjb3BlOiAnUkVHSU9OQUwnLFxuICAgICAgICBydWxlczoge1xuICAgICAgICAgIGF3c01hbmFnZWRSdWxlczogdHJ1ZSxcbiAgICAgICAgICByYXRlTGltaXRpbmc6IHRydWVcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGd1YXJkRHV0eToge1xuICAgICAgICBlbmFibGVkOiBwcm9wcy5jb25maWcuc2VjdXJpdHk/LmVuYWJsZUd1YXJkRHV0eSA/PyBmYWxzZSxcbiAgICAgICAgZmluZGluZ1B1Ymxpc2hpbmdGcmVxdWVuY3k6ICdTSVhfSE9VUlMnXG4gICAgICB9LFxuICAgICAgY29tcGxpYW5jZToge1xuICAgICAgICBhdWRpdExvZ2dpbmc6IHRydWUsXG4gICAgICAgIGZpc2NDb21wbGlhbmNlOiBmYWxzZSxcbiAgICAgICAgcGVyc29uYWxJbmZvUHJvdGVjdGlvbjogdHJ1ZVxuICAgICAgfSxcbiAgICAgIG1vbml0b3Jpbmc6IHtcbiAgICAgICAgY2xvdWRUcmFpbDogcHJvcHMuY29uZmlnLnNlY3VyaXR5Py5lbmFibGVDbG91ZFRyYWlsID8/IGZhbHNlLFxuICAgICAgICBjb25maWc6IHByb3BzLmNvbmZpZy5zZWN1cml0eT8uZW5hYmxlQ29uZmlnID8/IGZhbHNlXG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIOe1seWQiOOCu+OCreODpeODquODhuOCo+OCs+ODs+OCueODiOODqeOCr+ODiOS9nOaIkFxuICAgIHRoaXMuc2VjdXJpdHkgPSBuZXcgU2VjdXJpdHlDb25zdHJ1Y3QodGhpcywgJ1NlY3VyaXR5Jywge1xuICAgICAgY29uZmlnOiBzZWN1cml0eUNvbmZpZyxcbiAgICAgIHByb2plY3ROYW1lOiBwcm9wcy5jb25maWcucHJvamVjdC5uYW1lLFxuICAgICAgZW52aXJvbm1lbnQ6IHByb3BzLmNvbmZpZy5lbnZpcm9ubWVudCxcbiAgICAgIG5hbWluZ0dlbmVyYXRvcjogcHJvcHMubmFtaW5nR2VuZXJhdG9yLFxuICAgIH0pO1xuXG4gICAgLy8g5LuW44K544K/44OD44Kv44GL44KJ44Gu5Y+C54Wn55So44OX44Ot44OR44OG44Kj6Kit5a6aXG4gICAgdGhpcy5rbXNLZXkgPSB0aGlzLnNlY3VyaXR5Lmttc0tleTtcbiAgICB0aGlzLndhZldlYkFjbEFybiA9IHRoaXMuc2VjdXJpdHkud2FmV2ViQWNsPy5hdHRyQXJuO1xuXG4gICAgLy8gQmVkcm9jayBHdWFyZHJhaWxz57Wx5ZCI77yIUGhhc2UgNSAtIOOCqOODs+OCv+ODvOODl+ODqeOCpOOCuuOCquODl+OCt+ODp+ODs++8iVxuICAgIGNvbnN0IHVzZUJlZHJvY2tHdWFyZHJhaWxzID0gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ3VzZUJlZHJvY2tHdWFyZHJhaWxzJykgPz8gcHJvcHMudXNlQmVkcm9ja0d1YXJkcmFpbHMgPz8gZmFsc2U7XG4gICAgaWYgKHVzZUJlZHJvY2tHdWFyZHJhaWxzKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+boe+4jyBCZWRyb2NrIEd1YXJkcmFpbHPmnInlirnljJYuLi4nKTtcbiAgICAgIHRoaXMuYmVkcm9ja0d1YXJkcmFpbHMgPSB0aGlzLmNyZWF0ZUJlZHJvY2tHdWFyZHJhaWxzKHByb3BzKTtcbiAgICAgIHRoaXMuZ3VhcmRyYWlsQXJuID0gdGhpcy5iZWRyb2NrR3VhcmRyYWlscy5ndWFyZHJhaWxBcm47XG4gICAgICB0aGlzLmd1YXJkcmFpbElkID0gdGhpcy5iZWRyb2NrR3VhcmRyYWlscy5ndWFyZHJhaWxJZDtcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgQmVkcm9jayBHdWFyZHJhaWxz5L2c5oiQ5a6M5LqGJyk7XG4gICAgfVxuXG4gICAgLy8gUGhhc2UgNDogQWdlbnRDb3JlIENvbnN0cnVjdHPntbHlkIjvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBpZiAocHJvcHMuYWdlbnRDb3JlIHx8IHByb3BzLmNvbmZpZy5hZ2VudENvcmUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCcnKTtcbiAgICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgICBjb25zb2xlLmxvZygn8J+agCBBZ2VudENvcmUgQ29uc3RydWN0c+e1seWQiOmWi+Wniy4uLicpO1xuICAgICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICAgIFxuICAgICAgdGhpcy5pbnRlZ3JhdGVBZ2VudENvcmVDb25zdHJ1Y3RzKHByb3BzKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coJ+KchSBBZ2VudENvcmUgQ29uc3RydWN0c+e1seWQiOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIOOCueOCv+ODg+OCr+WHuuWKm1xuICAgIHRoaXMuY3JlYXRlT3V0cHV0cygpO1xuXG4gICAgLy8g44K/44Kw6Kit5a6aXG4gICAgdGhpcy5hZGRTdGFja1RhZ3MoKTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUgU2VjdXJpdHlTdGFja+WIneacn+WMluWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJlZHJvY2sgR3VhcmRyYWlsc+S9nOaIkO+8iFBoYXNlIDUgLSDjgqjjg7Pjgr/jg7zjg5fjg6njgqTjgrrjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQmVkcm9ja0d1YXJkcmFpbHMocHJvcHM6IFNlY3VyaXR5U3RhY2tQcm9wcyk6IEJlZHJvY2tHdWFyZHJhaWxzQ29uc3RydWN0IHtcbiAgICBjb25zdCBwcmVzZXRUeXBlID0gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2d1YXJkcmFpbFByZXNldCcpID8/IHByb3BzLmd1YXJkcmFpbFByZXNldCA/PyAnc3RhbmRhcmQnO1xuICAgIGNvbnN0IHByZXNldCA9IGdldEd1YXJkcmFpbFByZXNldChwcmVzZXRUeXBlKTtcblxuICAgIHJldHVybiBuZXcgQmVkcm9ja0d1YXJkcmFpbHNDb25zdHJ1Y3QodGhpcywgJ0JlZHJvY2tHdWFyZHJhaWxzJywge1xuICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIHByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIGd1YXJkcmFpbE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1ndWFyZHJhaWxzYCxcbiAgICAgIGRlc2NyaXB0aW9uOiBwcmVzZXQuZGVzY3JpcHRpb24sXG4gICAgICBjb250ZW50UG9saWN5Q29uZmlnOiBwcmVzZXQuY29udGVudFBvbGljeUNvbmZpZyxcbiAgICAgIHRvcGljUG9saWN5Q29uZmlnOiBwcmVzZXQudG9waWNQb2xpY3lDb25maWcsXG4gICAgICBzZW5zaXRpdmVJbmZvcm1hdGlvblBvbGljeUNvbmZpZzogcHJlc2V0LnNlbnNpdGl2ZUluZm9ybWF0aW9uUG9saWN5Q29uZmlnLFxuICAgICAgd29yZFBvbGljeUNvbmZpZzogcHJlc2V0LndvcmRQb2xpY3lDb25maWcsXG4gICAgICBibG9ja2VkSW5wdXRNZXNzYWdpbmc6IHByZXNldC5ibG9ja2VkSW5wdXRNZXNzYWdpbmcsXG4gICAgICBibG9ja2VkT3V0cHV0c01lc3NhZ2luZzogcHJlc2V0LmJsb2NrZWRPdXRwdXRzTWVzc2FnaW5nLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCueOCv+ODg+OCr+WHuuWKm+S9nOaIkO+8iOWAi+WIpeODh+ODl+ODreOCpOWvvuW/nO+8iVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCk6IHZvaWQge1xuICAgIC8vIEtNU+OCreODvOWHuuWKm++8iOS7luOCueOCv+ODg+OCr+OBi+OCieOBruWPgueFp+eUqO+8iVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdLbXNLZXlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnNlY3VyaXR5Lmttc0tleS5rZXlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgS01TIEtleSBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tS21zS2V5SWRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ttc0tleUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnNlY3VyaXR5Lmttc0tleS5rZXlBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IEtNUyBLZXkgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1LbXNLZXlBcm5gLFxuICAgIH0pO1xuXG4gICAgLy8gV0FGIFdlYkFDTOWHuuWKm++8iOWtmOWcqOOBmeOCi+WgtOWQiOOBruOBv++8iVxuICAgIGlmICh0aGlzLnNlY3VyaXR5LndhZldlYkFjbCkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dhZldlYkFjbElkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5zZWN1cml0eS53YWZXZWJBY2wuYXR0cklkLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1dBRiBXZWIgQUNMIElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVdhZldlYkFjbElkYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2FmV2ViQWNsQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5zZWN1cml0eS53YWZXZWJBY2wuYXR0ckFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdXQUYgV2ViIEFDTCBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tV2FmV2ViQWNsQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEd1YXJkRHV0eeWHuuWKm++8iOWtmOWcqOOBmeOCi+WgtOWQiOOBruOBv++8iVxuICAgIGlmICh0aGlzLnNlY3VyaXR5Lmd1YXJkRHV0eURldGVjdG9yKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR3VhcmREdXR5RGV0ZWN0b3JJZCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuc2VjdXJpdHkuZ3VhcmREdXR5RGV0ZWN0b3IuYXR0cklkLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0d1YXJkRHV0eSBEZXRlY3RvciBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1HdWFyZER1dHlEZXRlY3RvcklkYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIENsb3VkVHJhaWzlh7rlipvvvIjlrZjlnKjjgZnjgovloLTlkIjjga7jgb/vvIlcbiAgICBpZiAodGhpcy5zZWN1cml0eS5jbG91ZFRyYWlsKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRUcmFpbEFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuc2VjdXJpdHkuY2xvdWRUcmFpbC50cmFpbEFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdDbG91ZFRyYWlsIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1DbG91ZFRyYWlsQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEJlZHJvY2sgR3VhcmRyYWlsc+WHuuWKm++8iOWtmOWcqOOBmeOCi+WgtOWQiOOBruOBv++8iVxuICAgIGlmICh0aGlzLmJlZHJvY2tHdWFyZHJhaWxzKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR3VhcmRyYWlsQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrR3VhcmRyYWlscy5ndWFyZHJhaWxBcm4hLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgR3VhcmRyYWlsIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1HdWFyZHJhaWxBcm5gLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdHdWFyZHJhaWxJZCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYmVkcm9ja0d1YXJkcmFpbHMuZ3VhcmRyYWlsSWQhLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgR3VhcmRyYWlsIElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUd1YXJkcmFpbElkYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR3VhcmRyYWlsVmVyc2lvbicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYmVkcm9ja0d1YXJkcmFpbHMuZ3VhcmRyYWlsVmVyc2lvbiEsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQmVkcm9jayBHdWFyZHJhaWwgVmVyc2lvbicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1HdWFyZHJhaWxWZXJzaW9uYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCfwn5OkIFNlY3VyaXR5U3RhY2vlh7rlipvlgKTkvZzmiJDlrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgr/jg4Pjgq/jgr/jgrDoqK3lrprvvIhBZ2VudCBTdGVlcmluZ+a6luaLoO+8iVxuICAgKi9cbiAgcHJpdmF0ZSBhZGRTdGFja1RhZ3MoKTogdm9pZCB7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNb2R1bGUnLCAnU2VjdXJpdHknKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1N0YWNrVHlwZScsICdJbnRlZ3JhdGVkJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdBcmNoaXRlY3R1cmUnLCAnTW9kdWxhcicpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnTWFuYWdlZEJ5JywgJ0NESycpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU2VjdXJpdHlDb21wbGlhbmNlJywgJ0VuYWJsZWQnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0luZGl2aWR1YWxEZXBsb3lTdXBwb3J0JywgJ1llcycpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCfwn4+377iPIFNlY3VyaXR5U3RhY2vjgr/jgrDoqK3lrprlrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZ2VudENvcmUgQ29uc3RydWN0c+e1seWQiO+8iFBoYXNlIDTvvIlcbiAgICovXG4gIHByaXZhdGUgaW50ZWdyYXRlQWdlbnRDb3JlQ29uc3RydWN0cyhwcm9wczogU2VjdXJpdHlTdGFja1Byb3BzKTogdm9pZCB7XG4gICAgY29uc3QgYWdlbnRDb3JlQ29uZmlnID0gcHJvcHMuYWdlbnRDb3JlIHx8IHByb3BzLmNvbmZpZy5hZ2VudENvcmU7XG4gICAgaWYgKCFhZ2VudENvcmVDb25maWcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyAxLiBJZGVudGl0eSBDb25zdHJ1Y3TvvIjoqo3oqLzjg7voqo3lj6/vvIlcbiAgICBpZiAoYWdlbnRDb3JlQ29uZmlnLmlkZW50aXR5Py5lbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+UkCBJZGVudGl0eSBDb25zdHJ1Y3TkvZzmiJDkuK0uLi4nKTtcbiAgICAgIHRoaXMuYWdlbnRDb3JlSWRlbnRpdHkgPSBuZXcgQmVkcm9ja0FnZW50Q29yZUlkZW50aXR5Q29uc3RydWN0KHRoaXMsICdBZ2VudENvcmVJZGVudGl0eScsIHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgcHJvamVjdE5hbWU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIGR5bmFtb0RiQ29uZmlnOiBhZ2VudENvcmVDb25maWcuaWRlbnRpdHkuZHluYW1vZGJDb25maWcgYXMgYW55LFxuICAgICAgICByYmFjQ29uZmlnOiBhZ2VudENvcmVDb25maWcuaWRlbnRpdHkucmJhY0NvbmZpZyBhcyBhbnksXG4gICAgICAgIC4uLih0aGlzLmttc0tleSA/IHsgZW5jcnlwdGlvbktleTogdGhpcy5rbXNLZXkgfSA6IHt9KSxcbiAgICAgIH0pO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBJZGVudGl0eSBDb25zdHJ1Y3TkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyAyLiBQb2xpY3kgQ29uc3RydWN077yI44Od44Oq44K344O8566h55CG77yJXG4gICAgaWYgKGFnZW50Q29yZUNvbmZpZy5wb2xpY3k/LmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5OcIFBvbGljeSBDb25zdHJ1Y3TkvZzmiJDkuK0uLi4nKTtcbiAgICAgIHRoaXMuYWdlbnRDb3JlUG9saWN5ID0gbmV3IEJlZHJvY2tBZ2VudENvcmVQb2xpY3lDb25zdHJ1Y3QodGhpcywgJ0FnZW50Q29yZVBvbGljeScsIHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgcHJvamVjdE5hbWU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIC4uLihhZ2VudENvcmVDb25maWcucG9saWN5IGFzIGFueSksXG4gICAgICAgIC4uLih0aGlzLmttc0tleSA/IHsgZW5jcnlwdGlvbktleTogdGhpcy5rbXNLZXkgfSA6IHt9KSxcbiAgICAgIH0pO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBQb2xpY3kgQ29uc3RydWN05L2c5oiQ5a6M5LqGJyk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xuICAgIHRoaXMuY3JlYXRlQWdlbnRDb3JlT3V0cHV0cygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFnZW50Q29yZSBDbG91ZEZvcm1hdGlvbiBPdXRwdXRz44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUFnZW50Q29yZU91dHB1dHMoKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/Cfk6QgQWdlbnRDb3JlIE91dHB1dHPkvZzmiJDkuK0uLi4nKTtcblxuICAgIC8vIElkZW50aXR5IE91dHB1dHNcbiAgICBpZiAodGhpcy5hZ2VudENvcmVJZGVudGl0eT8uaWRlbnRpdHlUYWJsZSkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZUlkZW50aXR5VGFibGVOYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVJZGVudGl0eS5pZGVudGl0eVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgSWRlbnRpdHkgRHluYW1vREIgVGFibGUgTmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BZ2VudENvcmVJZGVudGl0eVRhYmxlTmFtZWAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZUlkZW50aXR5VGFibGVBcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFnZW50Q29yZUlkZW50aXR5LmlkZW50aXR5VGFibGUudGFibGVBcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIElkZW50aXR5IER5bmFtb0RCIFRhYmxlIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BZ2VudENvcmVJZGVudGl0eVRhYmxlQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFBvbGljeSBPdXRwdXRzXG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlUG9saWN5Py5hdWRpdExvZ1RhYmxlKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlUG9saWN5QXVkaXRMb2dUYWJsZU5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFnZW50Q29yZVBvbGljeS5hdWRpdExvZ1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgUG9saWN5IEF1ZGl0IExvZyBUYWJsZSBOYW1lJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZVBvbGljeUF1ZGl0TG9nVGFibGVOYW1lYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlUG9saWN5QXVkaXRMb2dUYWJsZUFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlUG9saWN5LmF1ZGl0TG9nVGFibGUudGFibGVBcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIFBvbGljeSBBdWRpdCBMb2cgVGFibGUgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZVBvbGljeUF1ZGl0TG9nVGFibGVBcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlUG9saWN5Py5wb2xpY3lGdW5jdGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZVBvbGljeUZ1bmN0aW9uQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVQb2xpY3kucG9saWN5RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIFBvbGljeSBMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZVBvbGljeUZ1bmN0aW9uQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCfinIUgQWdlbnRDb3JlIE91dHB1dHPkvZzmiJDlrozkuoYnKTtcbiAgfVxufSJdfQ==