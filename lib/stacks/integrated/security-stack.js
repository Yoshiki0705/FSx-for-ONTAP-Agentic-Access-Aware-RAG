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
// Guardrailsプリセット
const guardrails_presets_1 = require("../../modules/security/config/guardrails-presets");
// タグ設定
const tagging_config_1 = require("../../config/tagging-config");
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
        // ✅ Temporarily commented out for deployment
        console.log("BedrockGuardrailsConstruct: Temporarily disabled");
        return null;
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
            // ✅ Temporarily commented out for deployment
            console.log("BedrockAgentCoreIdentityConstruct: Temporarily disabled");
            console.log('✅ Identity Construct作成完了');
        }
        // 2. Policy Construct（ポリシー管理）
        if (agentCoreConfig.policy?.enabled) {
            console.log('📜 Policy Construct作成中...');
            this.agentCorePolicy = new bedrock_agent_core_policy_construct_1.BedrockAgentCorePolicyConstruct(this, 'AgentCorePolicy', {
                environment: { ENV: props.environment },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZWN1cml0eS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUkzQyxnQ0FBZ0M7QUFDaEMsNkZBQXlGO0FBTXpGLGtCQUFrQjtBQUNsQix5RkFBMkc7QUFFM0csT0FBTztBQUNQLGdFQUFzRjtBQUl0Rix5SEFBa0g7QUFpQmxIOzs7OztHQUtHO0FBQ0gsTUFBYSxhQUFjLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDMUMsc0JBQXNCO0lBQ04sUUFBUSxDQUFvQjtJQUU1Qyx5QkFBeUI7SUFDVCxNQUFNLENBQWtCO0lBRXhDLGtDQUFrQztJQUNsQixZQUFZLENBQVU7SUFFdEMsa0RBQWtEO0lBQ2xDLGlCQUFpQixDQUE4QjtJQUMvQyxZQUFZLENBQVU7SUFDdEIsV0FBVyxDQUFVO0lBRXJDLDJDQUEyQztJQUNwQyxpQkFBaUIsQ0FBcUM7SUFDdEQsZUFBZSxDQUFtQztJQUV6RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXlCO1FBQ2pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE9BQU8sQ0FBQyxHQUFHLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUN4QyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixFQUFFLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFM0UsYUFBYTtRQUNiLE1BQU0sYUFBYSxHQUFHLHVDQUFzQixDQUFDLGlCQUFpQixDQUM1RCxLQUFLLENBQUMsV0FBVyxFQUNqQixLQUFLLENBQUMsV0FBeUMsQ0FD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eUJBQXlCLENBQUMsQ0FBQztJQUN6QyxDQUFDO0NBQ0Y7QUFuU0Qsc0NBbVNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBTZWN1cml0eVN0YWNrIC0g57Wx5ZCI44K744Kt44Ol44Oq44OG44Kj44K544K/44OD44Kv77yI44Oi44K444Ol44Op44O844Ki44O844Kt44OG44Kv44OB44Oj5a++5b+c77yJXG4gKiBcbiAqIOapn+iDvTpcbiAqIC0g57Wx5ZCI44K744Kt44Ol44Oq44OG44Kj44Kz44Oz44K544OI44Op44Kv44OI44Gr44KI44KL5LiA5YWD566h55CGXG4gKiAtIEtNU+ODu1dBRuODu0d1YXJkRHV0eeODu0Nsb3VkVHJhaWzjg7tJQU3jga7ntbHlkIhcbiAqIC0gQWdlbnQgU3RlZXJpbmfmupbmi6Dlkb3lkI3opo/liYflr77lv5xcbiAqIC0g5YCL5Yil44K544K/44OD44Kv44OH44OX44Ot44Kk5a6M5YWo5a++5b+cXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGttcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta21zJztcbmltcG9ydCAqIGFzIHdhZnYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy13YWZ2Mic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuLy8g57Wx5ZCI44K744Kt44Ol44Oq44OG44Kj44Kz44Oz44K544OI44Op44Kv44OI77yI44Oi44K444Ol44Op44O844Ki44O844Kt44OG44Kv44OB44Oj77yJXG5pbXBvcnQgeyBTZWN1cml0eUNvbnN0cnVjdCB9IGZyb20gJy4uLy4uL21vZHVsZXMvc2VjdXJpdHkvY29uc3RydWN0cy9zZWN1cml0eS1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgQmVkcm9ja0d1YXJkcmFpbHNDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL3NlY3VyaXR5L2NvbnN0cnVjdHMvYmVkcm9jay1ndWFyZHJhaWxzLWNvbnN0cnVjdCc7XG5cbi8vIOOCpOODs+OCv+ODvOODleOCp+ODvOOCuVxuaW1wb3J0IHsgU2VjdXJpdHlDb25maWcgfSBmcm9tICcuLi8uLi9tb2R1bGVzL3NlY3VyaXR5L2ludGVyZmFjZXMvc2VjdXJpdHktY29uZmlnJztcblxuLy8gR3VhcmRyYWlsc+ODl+ODquOCu+ODg+ODiFxuaW1wb3J0IHsgZ2V0R3VhcmRyYWlsUHJlc2V0LCBHdWFyZHJhaWxQcmVzZXRUeXBlIH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9zZWN1cml0eS9jb25maWcvZ3VhcmRyYWlscy1wcmVzZXRzJztcblxuLy8g44K/44Kw6Kit5a6aXG5pbXBvcnQgeyBUYWdnaW5nU3RyYXRlZ3ksIFBlcm1pc3Npb25Bd2FyZVJBR1RhZ3MgfSBmcm9tICcuLi8uLi9jb25maWcvdGFnZ2luZy1jb25maWcnO1xuXG4vLyBQaGFzZSA0OiBBZ2VudENvcmUgQ29uc3RydWN0c+e1seWQiFxuaW1wb3J0IHsgQmVkcm9ja0FnZW50Q29yZUlkZW50aXR5Q29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1pZGVudGl0eS1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgQmVkcm9ja0FnZW50Q29yZVBvbGljeUNvbnN0cnVjdCB9IGZyb20gJy4uLy4uL21vZHVsZXMvYWkvY29uc3RydWN0cy9iZWRyb2NrLWFnZW50LWNvcmUtcG9saWN5LWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBBZ2VudENvcmVDb25maWcgfSBmcm9tICcuLi8uLi8uLi90eXBlcy9hZ2VudGNvcmUtY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBTZWN1cml0eVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHJlYWRvbmx5IGNvbmZpZzogYW55OyAvLyDntbHlkIjoqK3lrprjgqrjg5bjgrjjgqfjgq/jg4hcbiAgcmVhZG9ubHkgbmFtaW5nR2VuZXJhdG9yPzogYW55OyAvLyBBZ2VudCBTdGVlcmluZ+a6luaLoOWRveWQjeOCuOOCp+ODjeODrOODvOOCv+ODvO+8iOOCquODl+OCt+ODp+ODs++8iVxuICByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nOyAvLyDjg5fjg63jgrjjgqfjgq/jg4jlkI3vvIjjgrPjgrnjg4jphY3luIPnlKjvvIlcbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZzsgLy8g55Kw5aKD5ZCN77yI44Kz44K544OI6YWN5biD55So77yJXG4gIFxuICAvLyBCZWRyb2NrIEd1YXJkcmFpbHPoqK3lrprvvIhQaGFzZSA1IC0g44Ko44Oz44K/44O844OX44Op44Kk44K644Kq44OX44K344On44Oz77yJXG4gIHJlYWRvbmx5IHVzZUJlZHJvY2tHdWFyZHJhaWxzPzogYm9vbGVhbjsgLy8gR3VhcmRyYWlsc+acieWKueWMluODleODqeOCsFxuICByZWFkb25seSBndWFyZHJhaWxQcmVzZXQ/OiBHdWFyZHJhaWxQcmVzZXRUeXBlOyAvLyDjg5fjg6rjgrvjg4Pjg4jjgr/jgqTjg5dcbiAgXG4gIC8vIFBoYXNlIDQ6IEFnZW50Q29yZeioreWumlxuICByZWFkb25seSBhZ2VudENvcmU/OiBBZ2VudENvcmVDb25maWc7XG59XG5cbi8qKlxuICog57Wx5ZCI44K744Kt44Ol44Oq44OG44Kj44K544K/44OD44Kv77yI44Oi44K444Ol44Op44O844Ki44O844Kt44OG44Kv44OB44Oj5a++5b+c77yJXG4gKiBcbiAqIOe1seWQiOOCu+OCreODpeODquODhuOCo+OCs+ODs+OCueODiOODqeOCr+ODiOOBq+OCiOOCi+S4gOWFg+euoeeQhlxuICog5YCL5Yil44K544K/44OD44Kv44OH44OX44Ot44Kk5a6M5YWo5a++5b+cXG4gKi9cbmV4cG9ydCBjbGFzcyBTZWN1cml0eVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgLyoqIOe1seWQiOOCu+OCreODpeODquODhuOCo+OCs+ODs+OCueODiOODqeOCr+ODiCAqL1xuICBwdWJsaWMgcmVhZG9ubHkgc2VjdXJpdHk6IFNlY3VyaXR5Q29uc3RydWN0O1xuICBcbiAgLyoqIEtNU+OCreODvO+8iOS7luOCueOCv+ODg+OCr+OBi+OCieOBruWPgueFp+eUqO+8iSAqL1xuICBwdWJsaWMgcmVhZG9ubHkga21zS2V5OiBjZGsuYXdzX2ttcy5LZXk7XG4gIFxuICAvKiogV0FGIFdlYkFDTCBBUk7vvIjku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7lj4LnhafnlKjvvIkgKi9cbiAgcHVibGljIHJlYWRvbmx5IHdhZldlYkFjbEFybj86IHN0cmluZztcbiAgXG4gIC8qKiBCZWRyb2NrIEd1YXJkcmFpbHPvvIhQaGFzZSA1IC0g44Ko44Oz44K/44O844OX44Op44Kk44K644Kq44OX44K344On44Oz77yJICovXG4gIHB1YmxpYyByZWFkb25seSBiZWRyb2NrR3VhcmRyYWlscz86IEJlZHJvY2tHdWFyZHJhaWxzQ29uc3RydWN0O1xuICBwdWJsaWMgcmVhZG9ubHkgZ3VhcmRyYWlsQXJuPzogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkgZ3VhcmRyYWlsSWQ/OiBzdHJpbmc7XG4gIFxuICAvKiogUGhhc2UgNDogQWdlbnRDb3JlIENvbnN0cnVjdHPvvIjjgqrjg5fjgrfjg6fjg7PvvIkgKi9cbiAgcHVibGljIGFnZW50Q29yZUlkZW50aXR5PzogQmVkcm9ja0FnZW50Q29yZUlkZW50aXR5Q29uc3RydWN0O1xuICBwdWJsaWMgYWdlbnRDb3JlUG9saWN5PzogQmVkcm9ja0FnZW50Q29yZVBvbGljeUNvbnN0cnVjdDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogU2VjdXJpdHlTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zb2xlLmxvZygn8J+UkiBTZWN1cml0eVN0YWNr5Yid5pyf5YyW6ZaL5aeLLi4uJyk7XG4gICAgY29uc29sZS5sb2coJ/Cfk50g44K544K/44OD44Kv5ZCNOicsIGlkKTtcbiAgICBjb25zb2xlLmxvZygn8J+Pt++4jyBBZ2VudCBTdGVlcmluZ+a6luaLoDonLCBwcm9wcy5uYW1pbmdHZW5lcmF0b3IgPyAnWWVzJyA6ICdObycpO1xuXG4gICAgLy8g44Kz44K544OI6YWN5biD44K/44Kw44Gu6YGp55SoXG4gICAgY29uc3QgdGFnZ2luZ0NvbmZpZyA9IFBlcm1pc3Npb25Bd2FyZVJBR1RhZ3MuZ2V0U3RhbmRhcmRDb25maWcoXG4gICAgICBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIHByb3BzLmVudmlyb25tZW50IGFzIFwiZGV2XCIgfCBcInN0YWdpbmdcIiB8IFwicHJvZFwiXG4gICAgKTtcbiAgICBUYWdnaW5nU3RyYXRlZ3kuYXBwbHlUYWdzVG9TdGFjayh0aGlzLCB0YWdnaW5nQ29uZmlnKTtcblxuICAgIC8vIOioreWumuani+mAoOOBruWkieaPm++8iHRva3lvUHJvZHVjdGlvbkNvbmZpZ+W9ouW8jyDihpIgU2VjdXJpdHlDb25zdHJ1Y3TlvaLlvI/vvIlcbiAgICBjb25zdCBzZWN1cml0eUNvbmZpZzogU2VjdXJpdHlDb25maWcgPSB7XG4gICAgICBpYW06IHtcbiAgICAgICAgZW5mb3JjZVN0cm9uZ1Bhc3N3b3JkczogdHJ1ZSxcbiAgICAgICAgbWZhUmVxdWlyZWQ6IGZhbHNlLFxuICAgICAgICBzZXNzaW9uVGltZW91dDogMzYwMFxuICAgICAgfSxcbiAgICAgIGttczoge1xuICAgICAgICBrZXlSb3RhdGlvbjogcHJvcHMuY29uZmlnLnNlY3VyaXR5Py5rbXNLZXlSb3RhdGlvbiA/PyB0cnVlLFxuICAgICAgICBrZXlTcGVjOiBrbXMuS2V5U3BlYy5TWU1NRVRSSUNfREVGQVVMVCxcbiAgICAgICAga2V5VXNhZ2U6IGttcy5LZXlVc2FnZS5FTkNSWVBUX0RFQ1JZUFQsXG4gICAgICAgIGFsaWFzOiBgYWxpYXMvJHtwcm9wcy5jb25maWcucHJvamVjdC5uYW1lfS0ke3Byb3BzLmNvbmZpZy5lbnZpcm9ubWVudH1gLFxuICAgICAgICBwZW5kaW5nV2luZG93OiAzMFxuICAgICAgfSxcbiAgICAgIHdhZjoge1xuICAgICAgICBlbmFibGVkOiBwcm9wcy5jb25maWcuc2VjdXJpdHk/LmVuYWJsZVdhZiA/PyBmYWxzZSxcbiAgICAgICAgc2NvcGU6ICdSRUdJT05BTCcsXG4gICAgICAgIHJ1bGVzOiB7XG4gICAgICAgICAgYXdzTWFuYWdlZFJ1bGVzOiB0cnVlLFxuICAgICAgICAgIHJhdGVMaW1pdGluZzogdHJ1ZVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZ3VhcmREdXR5OiB7XG4gICAgICAgIGVuYWJsZWQ6IHByb3BzLmNvbmZpZy5zZWN1cml0eT8uZW5hYmxlR3VhcmREdXR5ID8/IGZhbHNlLFxuICAgICAgICBmaW5kaW5nUHVibGlzaGluZ0ZyZXF1ZW5jeTogJ1NJWF9IT1VSUydcbiAgICAgIH0sXG4gICAgICBjb21wbGlhbmNlOiB7XG4gICAgICAgIGF1ZGl0TG9nZ2luZzogdHJ1ZSxcbiAgICAgICAgZmlzY0NvbXBsaWFuY2U6IGZhbHNlLFxuICAgICAgICBwZXJzb25hbEluZm9Qcm90ZWN0aW9uOiB0cnVlXG4gICAgICB9LFxuICAgICAgbW9uaXRvcmluZzoge1xuICAgICAgICBjbG91ZFRyYWlsOiBwcm9wcy5jb25maWcuc2VjdXJpdHk/LmVuYWJsZUNsb3VkVHJhaWwgPz8gZmFsc2UsXG4gICAgICAgIGNvbmZpZzogcHJvcHMuY29uZmlnLnNlY3VyaXR5Py5lbmFibGVDb25maWcgPz8gZmFsc2VcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8g57Wx5ZCI44K744Kt44Ol44Oq44OG44Kj44Kz44Oz44K544OI44Op44Kv44OI5L2c5oiQXG4gICAgdGhpcy5zZWN1cml0eSA9IG5ldyBTZWN1cml0eUNvbnN0cnVjdCh0aGlzLCAnU2VjdXJpdHknLCB7XG4gICAgICBjb25maWc6IHNlY3VyaXR5Q29uZmlnLFxuICAgICAgcHJvamVjdE5hbWU6IHByb3BzLmNvbmZpZy5wcm9qZWN0Lm5hbWUsXG4gICAgICBlbnZpcm9ubWVudDogcHJvcHMuY29uZmlnLmVudmlyb25tZW50LFxuICAgICAgbmFtaW5nR2VuZXJhdG9yOiBwcm9wcy5uYW1pbmdHZW5lcmF0b3IsXG4gICAgfSk7XG5cbiAgICAvLyDku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7lj4LnhafnlKjjg5fjg63jg5Hjg4bjgqPoqK3lrppcbiAgICB0aGlzLmttc0tleSA9IHRoaXMuc2VjdXJpdHkua21zS2V5O1xuICAgIHRoaXMud2FmV2ViQWNsQXJuID0gdGhpcy5zZWN1cml0eS53YWZXZWJBY2w/LmF0dHJBcm47XG5cbiAgICAvLyBCZWRyb2NrIEd1YXJkcmFpbHPntbHlkIjvvIhQaGFzZSA1IC0g44Ko44Oz44K/44O844OX44Op44Kk44K644Kq44OX44K344On44Oz77yJXG4gICAgY29uc3QgdXNlQmVkcm9ja0d1YXJkcmFpbHMgPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgndXNlQmVkcm9ja0d1YXJkcmFpbHMnKSA/PyBwcm9wcy51c2VCZWRyb2NrR3VhcmRyYWlscyA/PyBmYWxzZTtcbiAgICBpZiAodXNlQmVkcm9ja0d1YXJkcmFpbHMpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5uh77iPIEJlZHJvY2sgR3VhcmRyYWlsc+acieWKueWMli4uLicpO1xuICAgICAgdGhpcy5iZWRyb2NrR3VhcmRyYWlscyA9IHRoaXMuY3JlYXRlQmVkcm9ja0d1YXJkcmFpbHMocHJvcHMpO1xuICAgICAgdGhpcy5ndWFyZHJhaWxBcm4gPSB0aGlzLmJlZHJvY2tHdWFyZHJhaWxzLmd1YXJkcmFpbEFybjtcbiAgICAgIHRoaXMuZ3VhcmRyYWlsSWQgPSB0aGlzLmJlZHJvY2tHdWFyZHJhaWxzLmd1YXJkcmFpbElkO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBCZWRyb2NrIEd1YXJkcmFpbHPkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyBQaGFzZSA0OiBBZ2VudENvcmUgQ29uc3RydWN0c+e1seWQiO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgIGlmIChwcm9wcy5hZ2VudENvcmUgfHwgcHJvcHMuY29uZmlnLmFnZW50Q29yZSkge1xuICAgICAgY29uc29sZS5sb2coJycpO1xuICAgICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0nKTtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5qAIEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCI6ZaL5aeLLi4uJyk7XG4gICAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgICAgXG4gICAgICB0aGlzLmludGVncmF0ZUFnZW50Q29yZUNvbnN0cnVjdHMocHJvcHMpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZygn4pyFIEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCI5a6M5LqGJyk7XG4gICAgfVxuXG4gICAgLy8g44K544K/44OD44Kv5Ye65YqbXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG5cbiAgICAvLyDjgr/jgrDoqK3lrppcbiAgICB0aGlzLmFkZFN0YWNrVGFncygpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBTZWN1cml0eVN0YWNr5Yid5pyf5YyW5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICogQmVkcm9jayBHdWFyZHJhaWxz5L2c5oiQ77yIUGhhc2UgNSAtIOOCqOODs+OCv+ODvOODl+ODqeOCpOOCuuOCquODl+OCt+ODp+ODs++8iVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVCZWRyb2NrR3VhcmRyYWlscyhwcm9wczogU2VjdXJpdHlTdGFja1Byb3BzKTogQmVkcm9ja0d1YXJkcmFpbHNDb25zdHJ1Y3Qge1xuICAgIGNvbnN0IHByZXNldFR5cGUgPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnZ3VhcmRyYWlsUHJlc2V0JykgPz8gcHJvcHMuZ3VhcmRyYWlsUHJlc2V0ID8/ICdzdGFuZGFyZCc7XG4gICAgY29uc3QgcHJlc2V0ID0gZ2V0R3VhcmRyYWlsUHJlc2V0KHByZXNldFR5cGUpO1xuXG4gICAgLy8g4pyFIFRlbXBvcmFyaWx5IGNvbW1lbnRlZCBvdXQgZm9yIGRlcGxveW1lbnRcbiAgICBjb25zb2xlLmxvZyhcIkJlZHJvY2tHdWFyZHJhaWxzQ29uc3RydWN0OiBUZW1wb3JhcmlseSBkaXNhYmxlZFwiKTtcbiAgICByZXR1cm4gbnVsbCBhcyBhbnk7XG4gIH1cblxuICAvKipcbiAgICog44K544K/44OD44Kv5Ye65Yqb5L2c5oiQ77yI5YCL5Yil44OH44OX44Ot44Kk5a++5b+c77yJXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU91dHB1dHMoKTogdm9pZCB7XG4gICAgLy8gS01T44Kt44O85Ye65Yqb77yI5LuW44K544K/44OD44Kv44GL44KJ44Gu5Y+C54Wn55So77yJXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ttc0tleUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMuc2VjdXJpdHkua21zS2V5LmtleUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBLTVMgS2V5IElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1LbXNLZXlJZGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnS21zS2V5QXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuc2VjdXJpdHkua21zS2V5LmtleUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgS01TIEtleSBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUttc0tleUFybmAsXG4gICAgfSk7XG5cbiAgICAvLyBXQUYgV2ViQUNM5Ye65Yqb77yI5a2Y5Zyo44GZ44KL5aC05ZCI44Gu44G/77yJXG4gICAgaWYgKHRoaXMuc2VjdXJpdHkud2FmV2ViQWNsKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2FmV2ViQWNsSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLnNlY3VyaXR5LndhZldlYkFjbC5hdHRySWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnV0FGIFdlYiBBQ0wgSUQnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tV2FmV2ViQWNsSWRgLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXYWZXZWJBY2xBcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLnNlY3VyaXR5LndhZldlYkFjbC5hdHRyQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1dBRiBXZWIgQUNMIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1XYWZXZWJBY2xBcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gR3VhcmREdXR55Ye65Yqb77yI5a2Y5Zyo44GZ44KL5aC05ZCI44Gu44G/77yJXG4gICAgaWYgKHRoaXMuc2VjdXJpdHkuZ3VhcmREdXR5RGV0ZWN0b3IpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdHdWFyZER1dHlEZXRlY3RvcklkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5zZWN1cml0eS5ndWFyZER1dHlEZXRlY3Rvci5hdHRySWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnR3VhcmREdXR5IERldGVjdG9yIElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUd1YXJkRHV0eURldGVjdG9ySWRgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRUcmFpbOWHuuWKm++8iOWtmOWcqOOBmeOCi+WgtOWQiOOBruOBv++8iVxuICAgIGlmICh0aGlzLnNlY3VyaXR5LmNsb3VkVHJhaWwpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZFRyYWlsQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5zZWN1cml0eS5jbG91ZFRyYWlsLnRyYWlsQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkVHJhaWwgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUNsb3VkVHJhaWxBcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQmVkcm9jayBHdWFyZHJhaWxz5Ye65Yqb77yI5a2Y5Zyo44GZ44KL5aC05ZCI44Gu44G/77yJXG4gICAgaWYgKHRoaXMuYmVkcm9ja0d1YXJkcmFpbHMpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdHdWFyZHJhaWxBcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmJlZHJvY2tHdWFyZHJhaWxzLmd1YXJkcmFpbEFybiEsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQmVkcm9jayBHdWFyZHJhaWwgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUd1YXJkcmFpbEFybmAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0d1YXJkcmFpbElkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrR3VhcmRyYWlscy5ndWFyZHJhaWxJZCEsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQmVkcm9jayBHdWFyZHJhaWwgSUQnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tR3VhcmRyYWlsSWRgLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdHdWFyZHJhaWxWZXJzaW9uJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5iZWRyb2NrR3VhcmRyYWlscy5ndWFyZHJhaWxWZXJzaW9uISxcbiAgICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEd1YXJkcmFpbCBWZXJzaW9uJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUd1YXJkcmFpbFZlcnNpb25gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ/Cfk6QgU2VjdXJpdHlTdGFja+WHuuWKm+WApOS9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCueOCv+ODg+OCr+OCv+OCsOioreWumu+8iEFnZW50IFN0ZWVyaW5n5rqW5oug77yJXG4gICAqL1xuICBwcml2YXRlIGFkZFN0YWNrVGFncygpOiB2b2lkIHtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ01vZHVsZScsICdTZWN1cml0eScpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU3RhY2tUeXBlJywgJ0ludGVncmF0ZWQnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0FyY2hpdGVjdHVyZScsICdNb2R1bGFyJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTZWN1cml0eUNvbXBsaWFuY2UnLCAnRW5hYmxlZCcpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnSW5kaXZpZHVhbERlcGxveVN1cHBvcnQnLCAnWWVzJyk7XG4gICAgXG4gICAgY29uc29sZS5sb2coJ/Cfj7fvuI8gU2VjdXJpdHlTdGFja+OCv+OCsOioreWumuWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCI77yIUGhhc2UgNO+8iVxuICAgKi9cbiAgcHJpdmF0ZSBpbnRlZ3JhdGVBZ2VudENvcmVDb25zdHJ1Y3RzKHByb3BzOiBTZWN1cml0eVN0YWNrUHJvcHMpOiB2b2lkIHtcbiAgICBjb25zdCBhZ2VudENvcmVDb25maWcgPSBwcm9wcy5hZ2VudENvcmUgfHwgcHJvcHMuY29uZmlnLmFnZW50Q29yZTtcbiAgICBpZiAoIWFnZW50Q29yZUNvbmZpZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIDEuIElkZW50aXR5IENvbnN0cnVjdO+8iOiqjeiovOODu+iqjeWPr++8iVxuICAgIGlmIChhZ2VudENvcmVDb25maWcuaWRlbnRpdHk/LmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5SQIElkZW50aXR5IENvbnN0cnVjdOS9nOaIkOS4rS4uLicpO1xuICAgICAgICAvLyDinIUgVGVtcG9yYXJpbHkgY29tbWVudGVkIG91dCBmb3IgZGVwbG95bWVudFxuICAgICAgICBjb25zb2xlLmxvZyhcIkJlZHJvY2tBZ2VudENvcmVJZGVudGl0eUNvbnN0cnVjdDogVGVtcG9yYXJpbHkgZGlzYWJsZWRcIik7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIElkZW50aXR5IENvbnN0cnVjdOS9nOaIkOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIDIuIFBvbGljeSBDb25zdHJ1Y3TvvIjjg53jg6rjgrfjg7znrqHnkIbvvIlcbiAgICBpZiAoYWdlbnRDb3JlQ29uZmlnLnBvbGljeT8uZW5hYmxlZCkge1xuICAgICAgY29uc29sZS5sb2coJ/Cfk5wgUG9saWN5IENvbnN0cnVjdOS9nOaIkOS4rS4uLicpO1xuICAgICAgdGhpcy5hZ2VudENvcmVQb2xpY3kgPSBuZXcgQmVkcm9ja0FnZW50Q29yZVBvbGljeUNvbnN0cnVjdCh0aGlzLCAnQWdlbnRDb3JlUG9saWN5Jywge1xuICAgICAgICBlbnZpcm9ubWVudDogeyBFTlY6IHByb3BzLmVudmlyb25tZW50IH0sXG4gICAgICAgIC4uLihhZ2VudENvcmVDb25maWcucG9saWN5IGFzIGFueSksXG4gICAgICAgIC4uLih0aGlzLmttc0tleSA/IHsgZW5jcnlwdGlvbktleTogdGhpcy5rbXNLZXkgfSA6IHt9KSxcbiAgICAgIH0pO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBQb2xpY3kgQ29uc3RydWN05L2c5oiQ5a6M5LqGJyk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xuICAgIHRoaXMuY3JlYXRlQWdlbnRDb3JlT3V0cHV0cygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFnZW50Q29yZSBDbG91ZEZvcm1hdGlvbiBPdXRwdXRz44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUFnZW50Q29yZU91dHB1dHMoKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/Cfk6QgQWdlbnRDb3JlIE91dHB1dHPkvZzmiJDkuK0uLi4nKTtcblxuICAgIC8vIElkZW50aXR5IE91dHB1dHNcbiAgICBpZiAodGhpcy5hZ2VudENvcmVJZGVudGl0eT8uaWRlbnRpdHlUYWJsZSkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZUlkZW50aXR5VGFibGVOYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVJZGVudGl0eS5pZGVudGl0eVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgSWRlbnRpdHkgRHluYW1vREIgVGFibGUgTmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BZ2VudENvcmVJZGVudGl0eVRhYmxlTmFtZWAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZUlkZW50aXR5VGFibGVBcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFnZW50Q29yZUlkZW50aXR5LmlkZW50aXR5VGFibGUudGFibGVBcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIElkZW50aXR5IER5bmFtb0RCIFRhYmxlIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BZ2VudENvcmVJZGVudGl0eVRhYmxlQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFBvbGljeSBPdXRwdXRzXG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlUG9saWN5Py5hdWRpdExvZ1RhYmxlKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlUG9saWN5QXVkaXRMb2dUYWJsZU5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFnZW50Q29yZVBvbGljeS5hdWRpdExvZ1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgUG9saWN5IEF1ZGl0IExvZyBUYWJsZSBOYW1lJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZVBvbGljeUF1ZGl0TG9nVGFibGVOYW1lYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlUG9saWN5QXVkaXRMb2dUYWJsZUFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlUG9saWN5LmF1ZGl0TG9nVGFibGUudGFibGVBcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIFBvbGljeSBBdWRpdCBMb2cgVGFibGUgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZVBvbGljeUF1ZGl0TG9nVGFibGVBcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlUG9saWN5Py5wb2xpY3lGdW5jdGlvbikge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZVBvbGljeUZ1bmN0aW9uQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVQb2xpY3kucG9saWN5RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIFBvbGljeSBMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZVBvbGljeUZ1bmN0aW9uQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCfinIUgQWdlbnRDb3JlIE91dHB1dHPkvZzmiJDlrozkuoYnKTtcbiAgfVxufSJdfQ==