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
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
// 統合セキュリティコンストラクト（モジュラーアーキテクチャ）
const security_construct_1 = require("../../modules/security/constructs/security-construct");
const windows_ad_construct_1 = require("../../modules/security/constructs/windows-ad-construct");
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
        // 注: GuardDuty Detectorの作成を無効化したため、出力もコメントアウト
        /*
        if (this.security.guardDutyDetector) {
          new cdk.CfnOutput(this, 'GuardDutyDetectorId', {
            value: this.security.guardDutyDetector.attrId,
            description: 'GuardDuty Detector ID',
            exportName: `${this.stackName}-GuardDutyDetectorId`,
          });
        }
        */
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
        // 0. Windows AD EC2作成（Identity機能が有効で、Windows AD設定がある場合）
        let windowsAdInstance;
        let adEc2InstanceId;
        if (agentCoreConfig.identity?.enabled && agentCoreConfig.identity.windowsAdConfig?.enabled) {
            console.log('🪟 Windows AD EC2作成中...');
            const windowsAdConfig = agentCoreConfig.identity.windowsAdConfig;
            // VPCを取得（propsから、またはインポート）
            let vpc;
            if (props.vpc) {
                vpc = props.vpc;
            }
            else if (props.vpcId) {
                vpc = ec2.Vpc.fromLookup(this, 'ImportedVpc', {
                    vpcId: props.vpcId
                });
            }
            else {
                console.error('❌ VPCが指定されていません。Windows AD EC2を作成できません。');
                throw new Error('VPC is required for Windows AD EC2');
            }
            // Windows AD EC2作成
            windowsAdInstance = new windows_ad_construct_1.WindowsAdConstruct(this, 'WindowsAd', {
                vpc: vpc,
                projectName: props.projectName,
                environment: props.environment,
                domainName: windowsAdConfig.domainName || 'permission-aware-rag.local',
                instanceType: windowsAdConfig.instanceType
                    ? this.parseInstanceType(windowsAdConfig.instanceType)
                    : undefined,
                keyName: windowsAdConfig.keyName || undefined
            });
            adEc2InstanceId = windowsAdInstance.instanceId;
            console.log('✅ Windows AD EC2作成完了');
            console.log(`   - Instance ID: ${adEc2InstanceId}`);
            console.log(`   - Domain Name: ${windowsAdConfig.domainName || 'permission-aware-rag.local'}`);
        }
        // 1. Identity Construct（認証・認可）
        if (agentCoreConfig.identity?.enabled) {
            console.log('🔐 Identity Construct作成中...');
            const adSyncConfig = agentCoreConfig.identity.adSyncConfig;
            // AD EC2インスタンスIDを取得（上で作成したインスタンス、propsから、または設定から）
            const finalAdEc2InstanceId = adEc2InstanceId ||
                props.windowsAdInstanceId ||
                props.config.adEc2InstanceId ||
                adSyncConfig?.adEc2InstanceId;
            if (!finalAdEc2InstanceId && adSyncConfig?.adSyncEnabled) {
                console.warn('⚠️ AD EC2インスタンスIDが指定されていないため、AD Sync機能は無効化されます');
            }
            this.agentCoreIdentity = new bedrock_agent_core_identity_construct_1.BedrockAgentCoreIdentityConstruct(this, 'AgentCoreIdentity', {
                enabled: true,
                projectName: props.projectName,
                environment: props.environment,
                adSyncEnabled: adSyncConfig?.adSyncEnabled ?? false,
                adEc2InstanceId: finalAdEc2InstanceId,
                identityTableName: adSyncConfig?.identityTableName,
                sidCacheTtl: adSyncConfig?.sidCacheTtl ?? 86400, // 24時間
                ssmTimeout: adSyncConfig?.ssmTimeout ?? 30,
                vpcConfig: agentCoreConfig.identity.windowsAdConfig?.vpcConfig
            });
            console.log('✅ Identity Construct作成完了');
            console.log(`   - Identity Table: ${this.agentCoreIdentity.identityTable.tableName}`);
            if (this.agentCoreIdentity.adSyncFunction) {
                console.log(`   - AD Sync Function: ${this.agentCoreIdentity.adSyncFunction.functionName}`);
            }
            // Windows AD EC2が作成された場合、SSM Run Command権限を付与
            if (windowsAdInstance && this.agentCoreIdentity.adSyncFunction) {
                windowsAdInstance.grantSsmRunCommand(this.agentCoreIdentity.lambdaRole);
                console.log('✅ AD Sync Lambda に SSM Run Command 権限を付与');
            }
            // VPCエンドポイント作成（SSM接続用）
            if (windowsAdInstance) {
                console.log('🔌 SSM用VPCエンドポイント作成中...');
                // VPCを取得（propsから、またはインポート）
                let vpcForEndpoints;
                if (props.vpc) {
                    vpcForEndpoints = props.vpc;
                }
                else if (props.vpcId) {
                    vpcForEndpoints = ec2.Vpc.fromLookup(this, 'ImportedVpcForEndpoints', {
                        vpcId: props.vpcId
                    });
                }
                else {
                    console.error('❌ VPCが指定されていません。VPCエンドポイントを作成できません。');
                    throw new Error('VPC is required for VPC Endpoints');
                }
                // セキュリティグループ作成（VPCエンドポイント用）
                const vpcEndpointSecurityGroup = new ec2.SecurityGroup(this, 'VpcEndpointSecurityGroup', {
                    vpc: vpcForEndpoints,
                    description: 'Security group for SSM VPC Endpoints',
                    allowAllOutbound: true,
                });
                // Windows AD EC2からのHTTPS接続を許可
                vpcEndpointSecurityGroup.addIngressRule(windowsAdInstance.securityGroup, ec2.Port.tcp(443), 'Allow HTTPS from Windows AD EC2');
                // プライベートサブネットを明示的に指定（subnet-0a84a16a1641e970f）
                const privateSubnet = ec2.Subnet.fromSubnetId(this, 'PrivateSubnet', 'subnet-0a84a16a1641e970f');
                // SSM VPCエンドポイント
                const ssmEndpoint = new ec2.InterfaceVpcEndpoint(this, 'SsmVpcEndpoint', {
                    vpc: vpcForEndpoints,
                    service: ec2.InterfaceVpcEndpointAwsService.SSM,
                    privateDnsEnabled: true,
                    securityGroups: [vpcEndpointSecurityGroup],
                    subnets: { subnets: [privateSubnet] },
                });
                // EC2 Messages VPCエンドポイント
                const ec2MessagesEndpoint = new ec2.InterfaceVpcEndpoint(this, 'Ec2MessagesVpcEndpoint', {
                    vpc: vpcForEndpoints,
                    service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
                    privateDnsEnabled: true,
                    securityGroups: [vpcEndpointSecurityGroup],
                    subnets: { subnets: [privateSubnet] },
                });
                // SSM Messages VPCエンドポイント
                const ssmMessagesEndpoint = new ec2.InterfaceVpcEndpoint(this, 'SsmMessagesVpcEndpoint', {
                    vpc: vpcForEndpoints,
                    service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
                    privateDnsEnabled: true,
                    securityGroups: [vpcEndpointSecurityGroup],
                    subnets: { subnets: [privateSubnet] },
                });
                console.log('✅ SSM用VPCエンドポイント作成完了');
                // CloudFormation Outputs
                new cdk.CfnOutput(this, 'SsmVpcEndpointId', {
                    value: ssmEndpoint.vpcEndpointId,
                    description: 'SSM VPC Endpoint ID',
                    exportName: `${this.stackName}-SsmVpcEndpointId`,
                });
                new cdk.CfnOutput(this, 'Ec2MessagesVpcEndpointId', {
                    value: ec2MessagesEndpoint.vpcEndpointId,
                    description: 'EC2 Messages VPC Endpoint ID',
                    exportName: `${this.stackName}-Ec2MessagesVpcEndpointId`,
                });
                new cdk.CfnOutput(this, 'SsmMessagesVpcEndpointId', {
                    value: ssmMessagesEndpoint.vpcEndpointId,
                    description: 'SSM Messages VPC Endpoint ID',
                    exportName: `${this.stackName}-SsmMessagesVpcEndpointId`,
                });
            }
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
        if (this.agentCoreIdentity?.adSyncFunction) {
            new cdk.CfnOutput(this, 'AgentCoreAdSyncFunctionArn', {
                value: this.agentCoreIdentity.adSyncFunction.functionArn,
                description: 'AgentCore AD Sync Lambda Function ARN',
                exportName: `${this.stackName}-AgentCoreAdSyncFunctionArn`,
            });
            new cdk.CfnOutput(this, 'AgentCoreAdSyncFunctionName', {
                value: this.agentCoreIdentity.adSyncFunction.functionName,
                description: 'AgentCore AD Sync Lambda Function Name',
                exportName: `${this.stackName}-AgentCoreAdSyncFunctionName`,
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
    /**
     * インスタンスタイプ文字列をパース（例: "t3.medium" → ec2.InstanceType）
     */
    parseInstanceType(instanceTypeStr) {
        const parts = instanceTypeStr.split('.');
        if (parts.length !== 2) {
            throw new Error(`Invalid instance type format: ${instanceTypeStr}. Expected format: "t3.medium"`);
        }
        const instanceClass = parts[0].toUpperCase();
        const instanceSize = parts[1].toUpperCase();
        // ec2.InstanceClassとec2.InstanceSizeの型安全な変換
        const classKey = instanceClass;
        const sizeKey = instanceSize;
        if (!(classKey in ec2.InstanceClass)) {
            throw new Error(`Unknown instance class: ${instanceClass}`);
        }
        if (!(sizeKey in ec2.InstanceSize)) {
            throw new Error(`Unknown instance size: ${instanceSize}`);
        }
        return ec2.InstanceType.of(ec2.InstanceClass[classKey], ec2.InstanceSize[sizeKey]);
    }
}
exports.SecurityStack = SecurityStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZWN1cml0eS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFJM0MsZ0NBQWdDO0FBQ2hDLDZGQUF5RjtBQUV6RixpR0FBNEY7QUFLNUYsa0JBQWtCO0FBQ2xCLHlGQUEyRztBQUUzRyxPQUFPO0FBQ1AsZ0VBQXNGO0FBRXRGLGtDQUFrQztBQUNsQyw2SEFBc0g7QUFDdEgseUhBQWtIO0FBd0JsSDs7Ozs7R0FLRztBQUNILE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFDLHNCQUFzQjtJQUNOLFFBQVEsQ0FBb0I7SUFFNUMseUJBQXlCO0lBQ1QsTUFBTSxDQUFrQjtJQUV4QyxrQ0FBa0M7SUFDbEIsWUFBWSxDQUFVO0lBRXRDLGtEQUFrRDtJQUNsQyxpQkFBaUIsQ0FBOEI7SUFDL0MsWUFBWSxDQUFVO0lBQ3RCLFdBQVcsQ0FBVTtJQUVyQywyQ0FBMkM7SUFDcEMsaUJBQWlCLENBQXFDO0lBQ3RELGVBQWUsQ0FBbUM7SUFFekQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF5QjtRQUNqRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixPQUFPLENBQUMsR0FBRyxDQUFDLDBCQUEwQixDQUFDLENBQUM7UUFDeEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDN0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsRUFBRSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTNFLGFBQWE7UUFDYixNQUFNLGFBQWEsR0FBRyx1Q0FBc0IsQ0FBQyxp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QztRQUVELElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztZQUNuQyxNQUFNLElBQUksS0FBSyxDQUFDLDBCQUEwQixZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBQzVELENBQUM7UUFFRCxPQUFPLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUN4QixHQUFHLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxFQUMzQixHQUFHLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUMxQixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBL2VELHNDQStlQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU2VjdXJpdHlTdGFjayAtIOe1seWQiOOCu+OCreODpeODquODhuOCo+OCueOCv+ODg+OCr++8iOODouOCuOODpeODqeODvOOCouODvOOCreODhuOCr+ODgeODo+WvvuW/nO+8iVxuICogXG4gKiDmqZ/og706XG4gKiAtIOe1seWQiOOCu+OCreODpeODquODhuOCo+OCs+ODs+OCueODiOODqeOCr+ODiOOBq+OCiOOCi+S4gOWFg+euoeeQhlxuICogLSBLTVPjg7tXQUbjg7tHdWFyZER1dHnjg7tDbG91ZFRyYWls44O7SUFN44Gu57Wx5ZCIXG4gKiAtIEFnZW50IFN0ZWVyaW5n5rqW5oug5ZG95ZCN6KaP5YmH5a++5b+cXG4gKiAtIOWAi+WIpeOCueOCv+ODg+OCr+ODh+ODl+ODreOCpOWujOWFqOWvvuW/nFxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBrbXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWttcyc7XG5pbXBvcnQgKiBhcyB3YWZ2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtd2FmdjInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbi8vIOe1seWQiOOCu+OCreODpeODquODhuOCo+OCs+ODs+OCueODiOODqeOCr+ODiO+8iOODouOCuOODpeODqeODvOOCouODvOOCreODhuOCr+ODgeODo++8iVxuaW1wb3J0IHsgU2VjdXJpdHlDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL3NlY3VyaXR5L2NvbnN0cnVjdHMvc2VjdXJpdHktY29uc3RydWN0JztcbmltcG9ydCB7IEJlZHJvY2tHdWFyZHJhaWxzQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9zZWN1cml0eS9jb25zdHJ1Y3RzL2JlZHJvY2stZ3VhcmRyYWlscy1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgV2luZG93c0FkQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9zZWN1cml0eS9jb25zdHJ1Y3RzL3dpbmRvd3MtYWQtY29uc3RydWN0JztcblxuLy8g44Kk44Oz44K/44O844OV44Kn44O844K5XG5pbXBvcnQgeyBTZWN1cml0eUNvbmZpZyB9IGZyb20gJy4uLy4uL21vZHVsZXMvc2VjdXJpdHkvaW50ZXJmYWNlcy9zZWN1cml0eS1jb25maWcnO1xuXG4vLyBHdWFyZHJhaWxz44OX44Oq44K744OD44OIXG5pbXBvcnQgeyBnZXRHdWFyZHJhaWxQcmVzZXQsIEd1YXJkcmFpbFByZXNldFR5cGUgfSBmcm9tICcuLi8uLi9tb2R1bGVzL3NlY3VyaXR5L2NvbmZpZy9ndWFyZHJhaWxzLXByZXNldHMnO1xuXG4vLyDjgr/jgrDoqK3lrppcbmltcG9ydCB7IFRhZ2dpbmdTdHJhdGVneSwgUGVybWlzc2lvbkF3YXJlUkFHVGFncyB9IGZyb20gJy4uLy4uL2NvbmZpZy90YWdnaW5nLWNvbmZpZyc7XG5cbi8vIFBoYXNlIDQ6IEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCIXG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRDb3JlSWRlbnRpdHlDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi9tb2R1bGVzL2FpL2NvbnN0cnVjdHMvYmVkcm9jay1hZ2VudC1jb3JlLWlkZW50aXR5LWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBCZWRyb2NrQWdlbnRDb3JlUG9saWN5Q29uc3RydWN0IH0gZnJvbSAnLi4vLi4vbW9kdWxlcy9haS9jb25zdHJ1Y3RzL2JlZHJvY2stYWdlbnQtY29yZS1wb2xpY3ktY29uc3RydWN0JztcbmltcG9ydCB7IEFnZW50Q29yZUNvbmZpZyB9IGZyb20gJy4uLy4uLy4uL3R5cGVzL2FnZW50Y29yZS1jb25maWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNlY3VyaXR5U3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgcmVhZG9ubHkgY29uZmlnOiBhbnk7IC8vIOe1seWQiOioreWumuOCquODluOCuOOCp+OCr+ODiFxuICByZWFkb25seSBuYW1pbmdHZW5lcmF0b3I/OiBhbnk7IC8vIEFnZW50IFN0ZWVyaW5n5rqW5oug5ZG95ZCN44K444Kn44ON44Os44O844K/44O877yI44Kq44OX44K344On44Oz77yJXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7IC8vIOODl+ODreOCuOOCp+OCr+ODiOWQje+8iOOCs+OCueODiOmFjeW4g+eUqO+8iVxuICByZWFkb25seSBlbnZpcm9ubWVudDogc3RyaW5nOyAvLyDnkrDlooPlkI3vvIjjgrPjgrnjg4jphY3luIPnlKjvvIlcbiAgXG4gIC8vIEJlZHJvY2sgR3VhcmRyYWlsc+ioreWumu+8iFBoYXNlIDUgLSDjgqjjg7Pjgr/jg7zjg5fjg6njgqTjgrrjgqrjg5fjgrfjg6fjg7PvvIlcbiAgcmVhZG9ubHkgdXNlQmVkcm9ja0d1YXJkcmFpbHM/OiBib29sZWFuOyAvLyBHdWFyZHJhaWxz5pyJ5Yq55YyW44OV44Op44KwXG4gIHJlYWRvbmx5IGd1YXJkcmFpbFByZXNldD86IEd1YXJkcmFpbFByZXNldFR5cGU7IC8vIOODl+ODquOCu+ODg+ODiOOCv+OCpOODl1xuICBcbiAgLy8gUGhhc2UgNDogQWdlbnRDb3Jl6Kit5a6aXG4gIHJlYWRvbmx5IGFnZW50Q29yZT86IEFnZW50Q29yZUNvbmZpZztcbiAgXG4gIC8vIFdpbmRvd3MgQUQgSW5zdGFuY2UgSUTvvIhOZXR3b3JraW5nU3RhY2vjgYvjgonlj5fjgZHlj5bjgovvvIlcbiAgcmVhZG9ubHkgd2luZG93c0FkSW5zdGFuY2VJZD86IHN0cmluZztcbiAgXG4gIC8vIFZQQ+ioreWumu+8iFdpbmRvd3MgQUQgRUMy5L2c5oiQ55So77yJXG4gIHJlYWRvbmx5IHZwYz86IGVjMi5JVnBjO1xuICByZWFkb25seSB2cGNJZD86IHN0cmluZztcbn1cblxuLyoqXG4gKiDntbHlkIjjgrvjgq3jg6Xjg6rjg4bjgqPjgrnjgr/jg4Pjgq/vvIjjg6Ljgrjjg6Xjg6njg7zjgqLjg7zjgq3jg4bjgq/jg4Hjg6Plr77lv5zvvIlcbiAqIFxuICog57Wx5ZCI44K744Kt44Ol44Oq44OG44Kj44Kz44Oz44K544OI44Op44Kv44OI44Gr44KI44KL5LiA5YWD566h55CGXG4gKiDlgIvliKXjgrnjgr/jg4Pjgq/jg4fjg5fjg63jgqTlrozlhajlr77lv5xcbiAqL1xuZXhwb3J0IGNsYXNzIFNlY3VyaXR5U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICAvKiog57Wx5ZCI44K744Kt44Ol44Oq44OG44Kj44Kz44Oz44K544OI44Op44Kv44OIICovXG4gIHB1YmxpYyByZWFkb25seSBzZWN1cml0eTogU2VjdXJpdHlDb25zdHJ1Y3Q7XG4gIFxuICAvKiogS01T44Kt44O877yI5LuW44K544K/44OD44Kv44GL44KJ44Gu5Y+C54Wn55So77yJICovXG4gIHB1YmxpYyByZWFkb25seSBrbXNLZXk6IGNkay5hd3Nfa21zLktleTtcbiAgXG4gIC8qKiBXQUYgV2ViQUNMIEFSTu+8iOS7luOCueOCv+ODg+OCr+OBi+OCieOBruWPgueFp+eUqO+8iSAqL1xuICBwdWJsaWMgcmVhZG9ubHkgd2FmV2ViQWNsQXJuPzogc3RyaW5nO1xuICBcbiAgLyoqIEJlZHJvY2sgR3VhcmRyYWlsc++8iFBoYXNlIDUgLSDjgqjjg7Pjgr/jg7zjg5fjg6njgqTjgrrjgqrjg5fjgrfjg6fjg7PvvIkgKi9cbiAgcHVibGljIHJlYWRvbmx5IGJlZHJvY2tHdWFyZHJhaWxzPzogQmVkcm9ja0d1YXJkcmFpbHNDb25zdHJ1Y3Q7XG4gIHB1YmxpYyByZWFkb25seSBndWFyZHJhaWxBcm4/OiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBndWFyZHJhaWxJZD86IHN0cmluZztcbiAgXG4gIC8qKiBQaGFzZSA0OiBBZ2VudENvcmUgQ29uc3RydWN0c++8iOOCquODl+OCt+ODp+ODs++8iSAqL1xuICBwdWJsaWMgYWdlbnRDb3JlSWRlbnRpdHk/OiBCZWRyb2NrQWdlbnRDb3JlSWRlbnRpdHlDb25zdHJ1Y3Q7XG4gIHB1YmxpYyBhZ2VudENvcmVQb2xpY3k/OiBCZWRyb2NrQWdlbnRDb3JlUG9saWN5Q29uc3RydWN0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTZWN1cml0eVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnNvbGUubG9nKCfwn5SSIFNlY3VyaXR5U3RhY2vliJ3mnJ/ljJbplovlp4suLi4nKTtcbiAgICBjb25zb2xlLmxvZygn8J+TnSDjgrnjgr/jg4Pjgq/lkI06JywgaWQpO1xuICAgIGNvbnNvbGUubG9nKCfwn4+377iPIEFnZW50IFN0ZWVyaW5n5rqW5ougOicsIHByb3BzLm5hbWluZ0dlbmVyYXRvciA/ICdZZXMnIDogJ05vJyk7XG5cbiAgICAvLyDjgrPjgrnjg4jphY3luIPjgr/jgrDjga7pgannlKhcbiAgICBjb25zdCB0YWdnaW5nQ29uZmlnID0gUGVybWlzc2lvbkF3YXJlUkFHVGFncy5nZXRTdGFuZGFyZENvbmZpZyhcbiAgICAgIHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgcHJvcHMuZW52aXJvbm1lbnQgYXMgXCJkZXZcIiB8IFwic3RhZ2luZ1wiIHwgXCJwcm9kXCJcbiAgICApO1xuICAgIFRhZ2dpbmdTdHJhdGVneS5hcHBseVRhZ3NUb1N0YWNrKHRoaXMsIHRhZ2dpbmdDb25maWcpO1xuXG4gICAgLy8g6Kit5a6a5qeL6YCg44Gu5aSJ5o+b77yIdG9reW9Qcm9kdWN0aW9uQ29uZmln5b2i5byPIOKGkiBTZWN1cml0eUNvbnN0cnVjdOW9ouW8j++8iVxuICAgIGNvbnN0IHNlY3VyaXR5Q29uZmlnOiBTZWN1cml0eUNvbmZpZyA9IHtcbiAgICAgIGlhbToge1xuICAgICAgICBlbmZvcmNlU3Ryb25nUGFzc3dvcmRzOiB0cnVlLFxuICAgICAgICBtZmFSZXF1aXJlZDogZmFsc2UsXG4gICAgICAgIHNlc3Npb25UaW1lb3V0OiAzNjAwXG4gICAgICB9LFxuICAgICAga21zOiB7XG4gICAgICAgIGtleVJvdGF0aW9uOiBwcm9wcy5jb25maWcuc2VjdXJpdHk/Lmttc0tleVJvdGF0aW9uID8/IHRydWUsXG4gICAgICAgIGtleVNwZWM6IGttcy5LZXlTcGVjLlNZTU1FVFJJQ19ERUZBVUxULFxuICAgICAgICBrZXlVc2FnZToga21zLktleVVzYWdlLkVOQ1JZUFRfREVDUllQVCxcbiAgICAgICAgYWxpYXM6IGBhbGlhcy8ke3Byb3BzLmNvbmZpZy5wcm9qZWN0Lm5hbWV9LSR7cHJvcHMuY29uZmlnLmVudmlyb25tZW50fWAsXG4gICAgICAgIHBlbmRpbmdXaW5kb3c6IDMwXG4gICAgICB9LFxuICAgICAgd2FmOiB7XG4gICAgICAgIGVuYWJsZWQ6IHByb3BzLmNvbmZpZy5zZWN1cml0eT8uZW5hYmxlV2FmID8/IGZhbHNlLFxuICAgICAgICBzY29wZTogJ1JFR0lPTkFMJyxcbiAgICAgICAgcnVsZXM6IHtcbiAgICAgICAgICBhd3NNYW5hZ2VkUnVsZXM6IHRydWUsXG4gICAgICAgICAgcmF0ZUxpbWl0aW5nOiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBndWFyZER1dHk6IHtcbiAgICAgICAgZW5hYmxlZDogcHJvcHMuY29uZmlnLnNlY3VyaXR5Py5lbmFibGVHdWFyZER1dHkgPz8gZmFsc2UsXG4gICAgICAgIGZpbmRpbmdQdWJsaXNoaW5nRnJlcXVlbmN5OiAnU0lYX0hPVVJTJ1xuICAgICAgfSxcbiAgICAgIGNvbXBsaWFuY2U6IHtcbiAgICAgICAgYXVkaXRMb2dnaW5nOiB0cnVlLFxuICAgICAgICBmaXNjQ29tcGxpYW5jZTogZmFsc2UsXG4gICAgICAgIHBlcnNvbmFsSW5mb1Byb3RlY3Rpb246IHRydWVcbiAgICAgIH0sXG4gICAgICBtb25pdG9yaW5nOiB7XG4gICAgICAgIGNsb3VkVHJhaWw6IHByb3BzLmNvbmZpZy5zZWN1cml0eT8uZW5hYmxlQ2xvdWRUcmFpbCA/PyBmYWxzZSxcbiAgICAgICAgY29uZmlnOiBwcm9wcy5jb25maWcuc2VjdXJpdHk/LmVuYWJsZUNvbmZpZyA/PyBmYWxzZVxuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyDntbHlkIjjgrvjgq3jg6Xjg6rjg4bjgqPjgrPjg7Pjgrnjg4jjg6njgq/jg4jkvZzmiJBcbiAgICB0aGlzLnNlY3VyaXR5ID0gbmV3IFNlY3VyaXR5Q29uc3RydWN0KHRoaXMsICdTZWN1cml0eScsIHtcbiAgICAgIGNvbmZpZzogc2VjdXJpdHlDb25maWcsXG4gICAgICBwcm9qZWN0TmFtZTogcHJvcHMuY29uZmlnLnByb2plY3QubmFtZSxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5jb25maWcuZW52aXJvbm1lbnQsXG4gICAgICBuYW1pbmdHZW5lcmF0b3I6IHByb3BzLm5hbWluZ0dlbmVyYXRvcixcbiAgICB9KTtcblxuICAgIC8vIOS7luOCueOCv+ODg+OCr+OBi+OCieOBruWPgueFp+eUqOODl+ODreODkeODhuOCo+ioreWumlxuICAgIHRoaXMua21zS2V5ID0gdGhpcy5zZWN1cml0eS5rbXNLZXk7XG4gICAgdGhpcy53YWZXZWJBY2xBcm4gPSB0aGlzLnNlY3VyaXR5LndhZldlYkFjbD8uYXR0ckFybjtcblxuICAgIC8vIEJlZHJvY2sgR3VhcmRyYWlsc+e1seWQiO+8iFBoYXNlIDUgLSDjgqjjg7Pjgr/jg7zjg5fjg6njgqTjgrrjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBjb25zdCB1c2VCZWRyb2NrR3VhcmRyYWlscyA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCd1c2VCZWRyb2NrR3VhcmRyYWlscycpID8/IHByb3BzLnVzZUJlZHJvY2tHdWFyZHJhaWxzID8/IGZhbHNlO1xuICAgIGlmICh1c2VCZWRyb2NrR3VhcmRyYWlscykge1xuICAgICAgY29uc29sZS5sb2coJ/Cfm6HvuI8gQmVkcm9jayBHdWFyZHJhaWxz5pyJ5Yq55YyWLi4uJyk7XG4gICAgICB0aGlzLmJlZHJvY2tHdWFyZHJhaWxzID0gdGhpcy5jcmVhdGVCZWRyb2NrR3VhcmRyYWlscyhwcm9wcyk7XG4gICAgICB0aGlzLmd1YXJkcmFpbEFybiA9IHRoaXMuYmVkcm9ja0d1YXJkcmFpbHMuZ3VhcmRyYWlsQXJuO1xuICAgICAgdGhpcy5ndWFyZHJhaWxJZCA9IHRoaXMuYmVkcm9ja0d1YXJkcmFpbHMuZ3VhcmRyYWlsSWQ7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIEJlZHJvY2sgR3VhcmRyYWlsc+S9nOaIkOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIFBoYXNlIDQ6IEFnZW50Q29yZSBDb25zdHJ1Y3Rz57Wx5ZCI77yI44Kq44OX44K344On44Oz77yJXG4gICAgaWYgKHByb3BzLmFnZW50Q29yZSB8fCBwcm9wcy5jb25maWcuYWdlbnRDb3JlKSB7XG4gICAgICBjb25zb2xlLmxvZygnJyk7XG4gICAgICBjb25zb2xlLmxvZygnPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgICAgY29uc29sZS5sb2coJ/CfmoAgQWdlbnRDb3JlIENvbnN0cnVjdHPntbHlkIjplovlp4suLi4nKTtcbiAgICAgIGNvbnNvbGUubG9nKCc9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Jyk7XG4gICAgICBcbiAgICAgIHRoaXMuaW50ZWdyYXRlQWdlbnRDb3JlQ29uc3RydWN0cyhwcm9wcyk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgQWdlbnRDb3JlIENvbnN0cnVjdHPntbHlkIjlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyDjgrnjgr/jg4Pjgq/lh7rliptcbiAgICB0aGlzLmNyZWF0ZU91dHB1dHMoKTtcblxuICAgIC8vIOOCv+OCsOioreWumlxuICAgIHRoaXMuYWRkU3RhY2tUYWdzKCk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIFNlY3VyaXR5U3RhY2vliJ3mnJ/ljJblrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCZWRyb2NrIEd1YXJkcmFpbHPkvZzmiJDvvIhQaGFzZSA1IC0g44Ko44Oz44K/44O844OX44Op44Kk44K644Kq44OX44K344On44Oz77yJXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUJlZHJvY2tHdWFyZHJhaWxzKHByb3BzOiBTZWN1cml0eVN0YWNrUHJvcHMpOiBCZWRyb2NrR3VhcmRyYWlsc0NvbnN0cnVjdCB7XG4gICAgY29uc3QgcHJlc2V0VHlwZSA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdndWFyZHJhaWxQcmVzZXQnKSA/PyBwcm9wcy5ndWFyZHJhaWxQcmVzZXQgPz8gJ3N0YW5kYXJkJztcbiAgICBjb25zdCBwcmVzZXQgPSBnZXRHdWFyZHJhaWxQcmVzZXQocHJlc2V0VHlwZSk7XG5cbiAgICAvLyDinIUgVGVtcG9yYXJpbHkgY29tbWVudGVkIG91dCBmb3IgZGVwbG95bWVudFxuICAgIGNvbnNvbGUubG9nKFwiQmVkcm9ja0d1YXJkcmFpbHNDb25zdHJ1Y3Q6IFRlbXBvcmFyaWx5IGRpc2FibGVkXCIpO1xuICAgIHJldHVybiBudWxsIGFzIGFueTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgr/jg4Pjgq/lh7rlipvkvZzmiJDvvIjlgIvliKXjg4fjg5fjg63jgqTlr77lv5zvvIlcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlT3V0cHV0cygpOiB2b2lkIHtcbiAgICAvLyBLTVPjgq3jg7zlh7rlipvvvIjku5bjgrnjgr/jg4Pjgq/jgYvjgonjga7lj4LnhafnlKjvvIlcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnS21zS2V5SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zZWN1cml0eS5rbXNLZXkua2V5SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IEtNUyBLZXkgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUttc0tleUlkYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdLbXNLZXlBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zZWN1cml0eS5rbXNLZXkua2V5QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBLTVMgS2V5IEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tS21zS2V5QXJuYCxcbiAgICB9KTtcblxuICAgIC8vIFdBRiBXZWJBQ0zlh7rlipvvvIjlrZjlnKjjgZnjgovloLTlkIjjga7jgb/vvIlcbiAgICBpZiAodGhpcy5zZWN1cml0eS53YWZXZWJBY2wpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXYWZXZWJBY2xJZCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuc2VjdXJpdHkud2FmV2ViQWNsLmF0dHJJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdXQUYgV2ViIEFDTCBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1XYWZXZWJBY2xJZGAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dhZldlYkFjbEFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuc2VjdXJpdHkud2FmV2ViQWNsLmF0dHJBcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnV0FGIFdlYiBBQ0wgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVdhZldlYkFjbEFybmAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBHdWFyZER1dHnlh7rlipvvvIjlrZjlnKjjgZnjgovloLTlkIjjga7jgb/vvIlcbiAgICAvLyDms6g6IEd1YXJkRHV0eSBEZXRlY3RvcuOBruS9nOaIkOOCkueEoeWKueWMluOBl+OBn+OBn+OCgeOAgeWHuuWKm+OCguOCs+ODoeODs+ODiOOCouOCpuODiFxuICAgIC8qXG4gICAgaWYgKHRoaXMuc2VjdXJpdHkuZ3VhcmREdXR5RGV0ZWN0b3IpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdHdWFyZER1dHlEZXRlY3RvcklkJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5zZWN1cml0eS5ndWFyZER1dHlEZXRlY3Rvci5hdHRySWQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnR3VhcmREdXR5IERldGVjdG9yIElEJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUd1YXJkRHV0eURldGVjdG9ySWRgLFxuICAgICAgfSk7XG4gICAgfVxuICAgICovXG5cbiAgICAvLyBDbG91ZFRyYWls5Ye65Yqb77yI5a2Y5Zyo44GZ44KL5aC05ZCI44Gu44G/77yJXG4gICAgaWYgKHRoaXMuc2VjdXJpdHkuY2xvdWRUcmFpbCkge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkVHJhaWxBcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLnNlY3VyaXR5LmNsb3VkVHJhaWwudHJhaWxBcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRUcmFpbCBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQ2xvdWRUcmFpbEFybmAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBCZWRyb2NrIEd1YXJkcmFpbHPlh7rlipvvvIjlrZjlnKjjgZnjgovloLTlkIjjga7jgb/vvIlcbiAgICBpZiAodGhpcy5iZWRyb2NrR3VhcmRyYWlscykge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0d1YXJkcmFpbEFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYmVkcm9ja0d1YXJkcmFpbHMuZ3VhcmRyYWlsQXJuISxcbiAgICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEd1YXJkcmFpbCBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tR3VhcmRyYWlsQXJuYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR3VhcmRyYWlsSWQnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmJlZHJvY2tHdWFyZHJhaWxzLmd1YXJkcmFpbElkISxcbiAgICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEd1YXJkcmFpbCBJRCcsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1HdWFyZHJhaWxJZGAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0d1YXJkcmFpbFZlcnNpb24nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmJlZHJvY2tHdWFyZHJhaWxzLmd1YXJkcmFpbFZlcnNpb24hLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgR3VhcmRyYWlsIFZlcnNpb24nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tR3VhcmRyYWlsVmVyc2lvbmAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygn8J+TpCBTZWN1cml0eVN0YWNr5Ye65Yqb5YCk5L2c5oiQ5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICog44K544K/44OD44Kv44K/44Kw6Kit5a6a77yIQWdlbnQgU3RlZXJpbmfmupbmi6DvvIlcbiAgICovXG4gIHByaXZhdGUgYWRkU3RhY2tUYWdzKCk6IHZvaWQge1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnTW9kdWxlJywgJ1NlY3VyaXR5Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTdGFja1R5cGUnLCAnSW50ZWdyYXRlZCcpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQXJjaGl0ZWN0dXJlJywgJ01vZHVsYXInKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ01hbmFnZWRCeScsICdDREsnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1NlY3VyaXR5Q29tcGxpYW5jZScsICdFbmFibGVkJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdJbmRpdmlkdWFsRGVwbG95U3VwcG9ydCcsICdZZXMnKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZygn8J+Pt++4jyBTZWN1cml0eVN0YWNr44K/44Kw6Kit5a6a5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICogQWdlbnRDb3JlIENvbnN0cnVjdHPntbHlkIjvvIhQaGFzZSA077yJXG4gICAqL1xuICBwcml2YXRlIGludGVncmF0ZUFnZW50Q29yZUNvbnN0cnVjdHMocHJvcHM6IFNlY3VyaXR5U3RhY2tQcm9wcyk6IHZvaWQge1xuICAgIGNvbnN0IGFnZW50Q29yZUNvbmZpZyA9IHByb3BzLmFnZW50Q29yZSB8fCBwcm9wcy5jb25maWcuYWdlbnRDb3JlO1xuICAgIGlmICghYWdlbnRDb3JlQ29uZmlnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gMC4gV2luZG93cyBBRCBFQzLkvZzmiJDvvIhJZGVudGl0eeapn+iDveOBjOacieWKueOBp+OAgVdpbmRvd3MgQUToqK3lrprjgYzjgYLjgovloLTlkIjvvIlcbiAgICBsZXQgd2luZG93c0FkSW5zdGFuY2U6IFdpbmRvd3NBZENvbnN0cnVjdCB8IHVuZGVmaW5lZDtcbiAgICBsZXQgYWRFYzJJbnN0YW5jZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgXG4gICAgaWYgKGFnZW50Q29yZUNvbmZpZy5pZGVudGl0eT8uZW5hYmxlZCAmJiBhZ2VudENvcmVDb25maWcuaWRlbnRpdHkud2luZG93c0FkQ29uZmlnPy5lbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+qnyBXaW5kb3dzIEFEIEVDMuS9nOaIkOS4rS4uLicpO1xuICAgICAgXG4gICAgICBjb25zdCB3aW5kb3dzQWRDb25maWcgPSBhZ2VudENvcmVDb25maWcuaWRlbnRpdHkud2luZG93c0FkQ29uZmlnO1xuICAgICAgXG4gICAgICAvLyBWUEPjgpLlj5blvpfvvIhwcm9wc+OBi+OCieOAgeOBvuOBn+OBr+OCpOODs+ODneODvOODiO+8iVxuICAgICAgbGV0IHZwYzogZWMyLklWcGM7XG4gICAgICBpZiAocHJvcHMudnBjKSB7XG4gICAgICAgIHZwYyA9IHByb3BzLnZwYztcbiAgICAgIH0gZWxzZSBpZiAocHJvcHMudnBjSWQpIHtcbiAgICAgICAgdnBjID0gZWMyLlZwYy5mcm9tTG9va3VwKHRoaXMsICdJbXBvcnRlZFZwYycsIHtcbiAgICAgICAgICB2cGNJZDogcHJvcHMudnBjSWRcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKCfinYwgVlBD44GM5oyH5a6a44GV44KM44Gm44GE44G+44Gb44KT44CCV2luZG93cyBBRCBFQzLjgpLkvZzmiJDjgafjgY3jgb7jgZvjgpPjgIInKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdWUEMgaXMgcmVxdWlyZWQgZm9yIFdpbmRvd3MgQUQgRUMyJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFdpbmRvd3MgQUQgRUMy5L2c5oiQXG4gICAgICB3aW5kb3dzQWRJbnN0YW5jZSA9IG5ldyBXaW5kb3dzQWRDb25zdHJ1Y3QodGhpcywgJ1dpbmRvd3NBZCcsIHtcbiAgICAgICAgdnBjOiB2cGMsXG4gICAgICAgIHByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICBkb21haW5OYW1lOiB3aW5kb3dzQWRDb25maWcuZG9tYWluTmFtZSB8fCAncGVybWlzc2lvbi1hd2FyZS1yYWcubG9jYWwnLFxuICAgICAgICBpbnN0YW5jZVR5cGU6IHdpbmRvd3NBZENvbmZpZy5pbnN0YW5jZVR5cGUgXG4gICAgICAgICAgPyB0aGlzLnBhcnNlSW5zdGFuY2VUeXBlKHdpbmRvd3NBZENvbmZpZy5pbnN0YW5jZVR5cGUpXG4gICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgIGtleU5hbWU6IHdpbmRvd3NBZENvbmZpZy5rZXlOYW1lIHx8IHVuZGVmaW5lZFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGFkRWMySW5zdGFuY2VJZCA9IHdpbmRvd3NBZEluc3RhbmNlLmluc3RhbmNlSWQ7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgV2luZG93cyBBRCBFQzLkvZzmiJDlrozkuoYnKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAtIEluc3RhbmNlIElEOiAke2FkRWMySW5zdGFuY2VJZH1gKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAtIERvbWFpbiBOYW1lOiAke3dpbmRvd3NBZENvbmZpZy5kb21haW5OYW1lIHx8ICdwZXJtaXNzaW9uLWF3YXJlLXJhZy5sb2NhbCd9YCk7XG4gICAgfVxuXG4gICAgLy8gMS4gSWRlbnRpdHkgQ29uc3RydWN077yI6KqN6Ki844O76KqN5Y+v77yJXG4gICAgaWYgKGFnZW50Q29yZUNvbmZpZy5pZGVudGl0eT8uZW5hYmxlZCkge1xuICAgICAgY29uc29sZS5sb2coJ/CflJAgSWRlbnRpdHkgQ29uc3RydWN05L2c5oiQ5LitLi4uJyk7XG4gICAgICBcbiAgICAgIGNvbnN0IGFkU3luY0NvbmZpZyA9IGFnZW50Q29yZUNvbmZpZy5pZGVudGl0eS5hZFN5bmNDb25maWc7XG4gICAgICBcbiAgICAgIC8vIEFEIEVDMuOCpOODs+OCueOCv+ODs+OCuUlE44KS5Y+W5b6X77yI5LiK44Gn5L2c5oiQ44GX44Gf44Kk44Oz44K544K/44Oz44K544CBcHJvcHPjgYvjgonjgIHjgb7jgZ/jga/oqK3lrprjgYvjgonvvIlcbiAgICAgIGNvbnN0IGZpbmFsQWRFYzJJbnN0YW5jZUlkID0gYWRFYzJJbnN0YW5jZUlkIHx8IFxuICAgICAgICBwcm9wcy53aW5kb3dzQWRJbnN0YW5jZUlkIHx8IFxuICAgICAgICBwcm9wcy5jb25maWcuYWRFYzJJbnN0YW5jZUlkIHx8IFxuICAgICAgICBhZFN5bmNDb25maWc/LmFkRWMySW5zdGFuY2VJZDtcbiAgICAgIFxuICAgICAgaWYgKCFmaW5hbEFkRWMySW5zdGFuY2VJZCAmJiBhZFN5bmNDb25maWc/LmFkU3luY0VuYWJsZWQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCfimqDvuI8gQUQgRUMy44Kk44Oz44K544K/44Oz44K5SUTjgYzmjIflrprjgZXjgozjgabjgYTjgarjgYTjgZ/jgoHjgIFBRCBTeW5j5qmf6IO944Gv54Sh5Yq55YyW44GV44KM44G+44GZJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHRoaXMuYWdlbnRDb3JlSWRlbnRpdHkgPSBuZXcgQmVkcm9ja0FnZW50Q29yZUlkZW50aXR5Q29uc3RydWN0KHRoaXMsICdBZ2VudENvcmVJZGVudGl0eScsIHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgcHJvamVjdE5hbWU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIGFkU3luY0VuYWJsZWQ6IGFkU3luY0NvbmZpZz8uYWRTeW5jRW5hYmxlZCA/PyBmYWxzZSxcbiAgICAgICAgYWRFYzJJbnN0YW5jZUlkOiBmaW5hbEFkRWMySW5zdGFuY2VJZCxcbiAgICAgICAgaWRlbnRpdHlUYWJsZU5hbWU6IGFkU3luY0NvbmZpZz8uaWRlbnRpdHlUYWJsZU5hbWUsXG4gICAgICAgIHNpZENhY2hlVHRsOiBhZFN5bmNDb25maWc/LnNpZENhY2hlVHRsID8/IDg2NDAwLCAvLyAyNOaZgumWk1xuICAgICAgICBzc21UaW1lb3V0OiBhZFN5bmNDb25maWc/LnNzbVRpbWVvdXQgPz8gMzAsXG4gICAgICAgIHZwY0NvbmZpZzogYWdlbnRDb3JlQ29uZmlnLmlkZW50aXR5LndpbmRvd3NBZENvbmZpZz8udnBjQ29uZmlnXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coJ+KchSBJZGVudGl0eSBDb25zdHJ1Y3TkvZzmiJDlrozkuoYnKTtcbiAgICAgIGNvbnNvbGUubG9nKGAgICAtIElkZW50aXR5IFRhYmxlOiAke3RoaXMuYWdlbnRDb3JlSWRlbnRpdHkuaWRlbnRpdHlUYWJsZS50YWJsZU5hbWV9YCk7XG4gICAgICBpZiAodGhpcy5hZ2VudENvcmVJZGVudGl0eS5hZFN5bmNGdW5jdGlvbikge1xuICAgICAgICBjb25zb2xlLmxvZyhgICAgLSBBRCBTeW5jIEZ1bmN0aW9uOiAke3RoaXMuYWdlbnRDb3JlSWRlbnRpdHkuYWRTeW5jRnVuY3Rpb24uZnVuY3Rpb25OYW1lfWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBXaW5kb3dzIEFEIEVDMuOBjOS9nOaIkOOBleOCjOOBn+WgtOWQiOOAgVNTTSBSdW4gQ29tbWFuZOaoqemZkOOCkuS7mOS4jlxuICAgICAgaWYgKHdpbmRvd3NBZEluc3RhbmNlICYmIHRoaXMuYWdlbnRDb3JlSWRlbnRpdHkuYWRTeW5jRnVuY3Rpb24pIHtcbiAgICAgICAgd2luZG93c0FkSW5zdGFuY2UuZ3JhbnRTc21SdW5Db21tYW5kKHRoaXMuYWdlbnRDb3JlSWRlbnRpdHkubGFtYmRhUm9sZSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCfinIUgQUQgU3luYyBMYW1iZGEg44GrIFNTTSBSdW4gQ29tbWFuZCDmqKnpmZDjgpLku5jkuI4nKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gVlBD44Ko44Oz44OJ44Od44Kk44Oz44OI5L2c5oiQ77yIU1NN5o6l57aa55So77yJXG4gICAgICBpZiAod2luZG93c0FkSW5zdGFuY2UpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ/CflIwgU1NN55SoVlBD44Ko44Oz44OJ44Od44Kk44Oz44OI5L2c5oiQ5LitLi4uJyk7XG4gICAgICAgIFxuICAgICAgICAvLyBWUEPjgpLlj5blvpfvvIhwcm9wc+OBi+OCieOAgeOBvuOBn+OBr+OCpOODs+ODneODvOODiO+8iVxuICAgICAgICBsZXQgdnBjRm9yRW5kcG9pbnRzOiBlYzIuSVZwYztcbiAgICAgICAgaWYgKHByb3BzLnZwYykge1xuICAgICAgICAgIHZwY0ZvckVuZHBvaW50cyA9IHByb3BzLnZwYztcbiAgICAgICAgfSBlbHNlIGlmIChwcm9wcy52cGNJZCkge1xuICAgICAgICAgIHZwY0ZvckVuZHBvaW50cyA9IGVjMi5WcGMuZnJvbUxvb2t1cCh0aGlzLCAnSW1wb3J0ZWRWcGNGb3JFbmRwb2ludHMnLCB7XG4gICAgICAgICAgICB2cGNJZDogcHJvcHMudnBjSWRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCfinYwgVlBD44GM5oyH5a6a44GV44KM44Gm44GE44G+44Gb44KT44CCVlBD44Ko44Oz44OJ44Od44Kk44Oz44OI44KS5L2c5oiQ44Gn44GN44G+44Gb44KT44CCJyk7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdWUEMgaXMgcmVxdWlyZWQgZm9yIFZQQyBFbmRwb2ludHMnKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OX5L2c5oiQ77yIVlBD44Ko44Oz44OJ44Od44Kk44Oz44OI55So77yJXG4gICAgICAgIGNvbnN0IHZwY0VuZHBvaW50U2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnVnBjRW5kcG9pbnRTZWN1cml0eUdyb3VwJywge1xuICAgICAgICAgIHZwYzogdnBjRm9yRW5kcG9pbnRzLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIFNTTSBWUEMgRW5kcG9pbnRzJyxcbiAgICAgICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIFdpbmRvd3MgQUQgRUMy44GL44KJ44GuSFRUUFPmjqXntprjgpLoqLHlj69cbiAgICAgICAgdnBjRW5kcG9pbnRTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgICAgIHdpbmRvd3NBZEluc3RhbmNlLnNlY3VyaXR5R3JvdXAsXG4gICAgICAgICAgZWMyLlBvcnQudGNwKDQ0MyksXG4gICAgICAgICAgJ0FsbG93IEhUVFBTIGZyb20gV2luZG93cyBBRCBFQzInXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICAvLyDjg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4jjgpLmmI7npLrnmoTjgavmjIflrprvvIhzdWJuZXQtMGE4NGExNmExNjQxZTk3MGbvvIlcbiAgICAgICAgY29uc3QgcHJpdmF0ZVN1Ym5ldCA9IGVjMi5TdWJuZXQuZnJvbVN1Ym5ldElkKHRoaXMsICdQcml2YXRlU3VibmV0JywgJ3N1Ym5ldC0wYTg0YTE2YTE2NDFlOTcwZicpO1xuICAgICAgICBcbiAgICAgICAgLy8gU1NNIFZQQ+OCqOODs+ODieODneOCpOODs+ODiFxuICAgICAgICBjb25zdCBzc21FbmRwb2ludCA9IG5ldyBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnQodGhpcywgJ1NzbVZwY0VuZHBvaW50Jywge1xuICAgICAgICAgIHZwYzogdnBjRm9yRW5kcG9pbnRzLFxuICAgICAgICAgIHNlcnZpY2U6IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludEF3c1NlcnZpY2UuU1NNLFxuICAgICAgICAgIHByaXZhdGVEbnNFbmFibGVkOiB0cnVlLFxuICAgICAgICAgIHNlY3VyaXR5R3JvdXBzOiBbdnBjRW5kcG9pbnRTZWN1cml0eUdyb3VwXSxcbiAgICAgICAgICBzdWJuZXRzOiB7IHN1Ym5ldHM6IFtwcml2YXRlU3VibmV0XSB9LFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIEVDMiBNZXNzYWdlcyBWUEPjgqjjg7Pjg4njg53jgqTjg7Pjg4hcbiAgICAgICAgY29uc3QgZWMyTWVzc2FnZXNFbmRwb2ludCA9IG5ldyBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnQodGhpcywgJ0VjMk1lc3NhZ2VzVnBjRW5kcG9pbnQnLCB7XG4gICAgICAgICAgdnBjOiB2cGNGb3JFbmRwb2ludHMsXG4gICAgICAgICAgc2VydmljZTogZWMyLkludGVyZmFjZVZwY0VuZHBvaW50QXdzU2VydmljZS5FQzJfTUVTU0FHRVMsXG4gICAgICAgICAgcHJpdmF0ZURuc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgc2VjdXJpdHlHcm91cHM6IFt2cGNFbmRwb2ludFNlY3VyaXR5R3JvdXBdLFxuICAgICAgICAgIHN1Ym5ldHM6IHsgc3VibmV0czogW3ByaXZhdGVTdWJuZXRdIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgLy8gU1NNIE1lc3NhZ2VzIFZQQ+OCqOODs+ODieODneOCpOODs+ODiFxuICAgICAgICBjb25zdCBzc21NZXNzYWdlc0VuZHBvaW50ID0gbmV3IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludCh0aGlzLCAnU3NtTWVzc2FnZXNWcGNFbmRwb2ludCcsIHtcbiAgICAgICAgICB2cGM6IHZwY0ZvckVuZHBvaW50cyxcbiAgICAgICAgICBzZXJ2aWNlOiBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnRBd3NTZXJ2aWNlLlNTTV9NRVNTQUdFUyxcbiAgICAgICAgICBwcml2YXRlRG5zRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBzZWN1cml0eUdyb3VwczogW3ZwY0VuZHBvaW50U2VjdXJpdHlHcm91cF0sXG4gICAgICAgICAgc3VibmV0czogeyBzdWJuZXRzOiBbcHJpdmF0ZVN1Ym5ldF0gfSxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZygn4pyFIFNTTeeUqFZQQ+OCqOODs+ODieODneOCpOODs+ODiOS9nOaIkOWujOS6hicpO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xuICAgICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU3NtVnBjRW5kcG9pbnRJZCcsIHtcbiAgICAgICAgICB2YWx1ZTogc3NtRW5kcG9pbnQudnBjRW5kcG9pbnRJZCxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ1NTTSBWUEMgRW5kcG9pbnQgSUQnLFxuICAgICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Tc21WcGNFbmRwb2ludElkYCxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRWMyTWVzc2FnZXNWcGNFbmRwb2ludElkJywge1xuICAgICAgICAgIHZhbHVlOiBlYzJNZXNzYWdlc0VuZHBvaW50LnZwY0VuZHBvaW50SWQsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdFQzIgTWVzc2FnZXMgVlBDIEVuZHBvaW50IElEJyxcbiAgICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRWMyTWVzc2FnZXNWcGNFbmRwb2ludElkYCxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU3NtTWVzc2FnZXNWcGNFbmRwb2ludElkJywge1xuICAgICAgICAgIHZhbHVlOiBzc21NZXNzYWdlc0VuZHBvaW50LnZwY0VuZHBvaW50SWQsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdTU00gTWVzc2FnZXMgVlBDIEVuZHBvaW50IElEJyxcbiAgICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tU3NtTWVzc2FnZXNWcGNFbmRwb2ludElkYCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gMi4gUG9saWN5IENvbnN0cnVjdO+8iOODneODquOCt+ODvOeuoeeQhu+8iVxuICAgIGlmIChhZ2VudENvcmVDb25maWcucG9saWN5Py5lbmFibGVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+TnCBQb2xpY3kgQ29uc3RydWN05L2c5oiQ5LitLi4uJyk7XG4gICAgICB0aGlzLmFnZW50Q29yZVBvbGljeSA9IG5ldyBCZWRyb2NrQWdlbnRDb3JlUG9saWN5Q29uc3RydWN0KHRoaXMsICdBZ2VudENvcmVQb2xpY3knLCB7XG4gICAgICAgIGVudmlyb25tZW50OiB7IEVOVjogcHJvcHMuZW52aXJvbm1lbnQgfSxcbiAgICAgICAgLi4uKGFnZW50Q29yZUNvbmZpZy5wb2xpY3kgYXMgYW55KSxcbiAgICAgICAgLi4uKHRoaXMua21zS2V5ID8geyBlbmNyeXB0aW9uS2V5OiB0aGlzLmttc0tleSB9IDoge30pLFxuICAgICAgfSk7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIFBvbGljeSBDb25zdHJ1Y3TkvZzmiJDlrozkuoYnKTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZEZvcm1hdGlvbiBPdXRwdXRzXG4gICAgdGhpcy5jcmVhdGVBZ2VudENvcmVPdXRwdXRzKCk7XG4gIH1cblxuICAvKipcbiAgICogQWdlbnRDb3JlIENsb3VkRm9ybWF0aW9uIE91dHB1dHPjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQWdlbnRDb3JlT3V0cHV0cygpOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZygn8J+TpCBBZ2VudENvcmUgT3V0cHV0c+S9nOaIkOS4rS4uLicpO1xuXG4gICAgLy8gSWRlbnRpdHkgT3V0cHV0c1xuICAgIGlmICh0aGlzLmFnZW50Q29yZUlkZW50aXR5Py5pZGVudGl0eVRhYmxlKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlSWRlbnRpdHlUYWJsZU5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFnZW50Q29yZUlkZW50aXR5LmlkZW50aXR5VGFibGUudGFibGVOYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBJZGVudGl0eSBEeW5hbW9EQiBUYWJsZSBOYW1lJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZUlkZW50aXR5VGFibGVOYW1lYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlSWRlbnRpdHlUYWJsZUFybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlSWRlbnRpdHkuaWRlbnRpdHlUYWJsZS50YWJsZUFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgSWRlbnRpdHkgRHluYW1vREIgVGFibGUgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZUlkZW50aXR5VGFibGVBcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlSWRlbnRpdHk/LmFkU3luY0Z1bmN0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlQWRTeW5jRnVuY3Rpb25Bcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFnZW50Q29yZUlkZW50aXR5LmFkU3luY0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBBRCBTeW5jIExhbWJkYSBGdW5jdGlvbiBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlQWRTeW5jRnVuY3Rpb25Bcm5gLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudENvcmVBZFN5bmNGdW5jdGlvbk5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFnZW50Q29yZUlkZW50aXR5LmFkU3luY0Z1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgQUQgU3luYyBMYW1iZGEgRnVuY3Rpb24gTmFtZScsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BZ2VudENvcmVBZFN5bmNGdW5jdGlvbk5hbWVgLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gUG9saWN5IE91dHB1dHNcbiAgICBpZiAodGhpcy5hZ2VudENvcmVQb2xpY3k/LmF1ZGl0TG9nVGFibGUpIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudENvcmVQb2xpY3lBdWRpdExvZ1RhYmxlTmFtZScsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlUG9saWN5LmF1ZGl0TG9nVGFibGUudGFibGVOYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBQb2xpY3kgQXVkaXQgTG9nIFRhYmxlIE5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlUG9saWN5QXVkaXRMb2dUYWJsZU5hbWVgLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudENvcmVQb2xpY3lBdWRpdExvZ1RhYmxlQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVQb2xpY3kuYXVkaXRMb2dUYWJsZS50YWJsZUFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgUG9saWN5IEF1ZGl0IExvZyBUYWJsZSBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlUG9saWN5QXVkaXRMb2dUYWJsZUFybmAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5hZ2VudENvcmVQb2xpY3k/LnBvbGljeUZ1bmN0aW9uKSB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlUG9saWN5RnVuY3Rpb25Bcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFnZW50Q29yZVBvbGljeS5wb2xpY3lGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgUG9saWN5IExhbWJkYSBGdW5jdGlvbiBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlUG9saWN5RnVuY3Rpb25Bcm5gLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ+KchSBBZ2VudENvcmUgT3V0cHV0c+S9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCpOODs+OCueOCv+ODs+OCueOCv+OCpOODl+aWh+Wtl+WIl+OCkuODkeODvOOCue+8iOS+izogXCJ0My5tZWRpdW1cIiDihpIgZWMyLkluc3RhbmNlVHlwZe+8iVxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZUluc3RhbmNlVHlwZShpbnN0YW5jZVR5cGVTdHI6IHN0cmluZyk6IGVjMi5JbnN0YW5jZVR5cGUge1xuICAgIGNvbnN0IHBhcnRzID0gaW5zdGFuY2VUeXBlU3RyLnNwbGl0KCcuJyk7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGluc3RhbmNlIHR5cGUgZm9ybWF0OiAke2luc3RhbmNlVHlwZVN0cn0uIEV4cGVjdGVkIGZvcm1hdDogXCJ0My5tZWRpdW1cImApO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBpbnN0YW5jZUNsYXNzID0gcGFydHNbMF0udG9VcHBlckNhc2UoKTtcbiAgICBjb25zdCBpbnN0YW5jZVNpemUgPSBwYXJ0c1sxXS50b1VwcGVyQ2FzZSgpO1xuICAgIFxuICAgIC8vIGVjMi5JbnN0YW5jZUNsYXNz44GoZWMyLkluc3RhbmNlU2l6ZeOBruWei+WuieWFqOOBquWkieaPm1xuICAgIGNvbnN0IGNsYXNzS2V5ID0gaW5zdGFuY2VDbGFzcyBhcyBrZXlvZiB0eXBlb2YgZWMyLkluc3RhbmNlQ2xhc3M7XG4gICAgY29uc3Qgc2l6ZUtleSA9IGluc3RhbmNlU2l6ZSBhcyBrZXlvZiB0eXBlb2YgZWMyLkluc3RhbmNlU2l6ZTtcbiAgICBcbiAgICBpZiAoIShjbGFzc0tleSBpbiBlYzIuSW5zdGFuY2VDbGFzcykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBpbnN0YW5jZSBjbGFzczogJHtpbnN0YW5jZUNsYXNzfWApO1xuICAgIH1cbiAgICBcbiAgICBpZiAoIShzaXplS2V5IGluIGVjMi5JbnN0YW5jZVNpemUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gaW5zdGFuY2Ugc2l6ZTogJHtpbnN0YW5jZVNpemV9YCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBlYzIuSW5zdGFuY2VUeXBlLm9mKFxuICAgICAgZWMyLkluc3RhbmNlQ2xhc3NbY2xhc3NLZXldLFxuICAgICAgZWMyLkluc3RhbmNlU2l6ZVtzaXplS2V5XVxuICAgICk7XG4gIH1cbn0iXX0=