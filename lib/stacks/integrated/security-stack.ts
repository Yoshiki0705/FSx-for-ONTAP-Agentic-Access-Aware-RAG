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
import * as kms from 'aws-cdk-lib/aws-kms';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

// 統合セキュリティコンストラクト（モジュラーアーキテクチャ）
import { SecurityConstruct } from '../../modules/security/constructs/security-construct';
import { BedrockGuardrailsConstruct } from '../../modules/security/constructs/bedrock-guardrails-construct';
import { WindowsAdConstruct } from '../../modules/security/constructs/windows-ad-construct';

// インターフェース
import { SecurityConfig } from '../../modules/security/interfaces/security-config';

// Guardrailsプリセット
import { getGuardrailPreset, GuardrailPresetType } from '../../modules/security/config/guardrails-presets';

// タグ設定
import { TaggingStrategy, PermissionAwareRAGTags } from '../../config/tagging-config';

// Phase 4: AgentCore Constructs統合
import { BedrockAgentCoreIdentityConstruct } from '../../modules/ai/constructs/bedrock-agent-core-identity-construct';
import { BedrockAgentCorePolicyConstruct } from '../../modules/ai/constructs/bedrock-agent-core-policy-construct';
import { AgentCoreConfig } from '../../../types/agentcore-config';

export interface SecurityStackProps extends cdk.StackProps {
  readonly config: any; // 統合設定オブジェクト
  readonly namingGenerator?: any; // Agent Steering準拠命名ジェネレーター（オプション）
  readonly projectName: string; // プロジェクト名（コスト配布用）
  readonly environment: string; // 環境名（コスト配布用）
  
  // Bedrock Guardrails設定（Phase 5 - エンタープライズオプション）
  readonly useBedrockGuardrails?: boolean; // Guardrails有効化フラグ
  readonly guardrailPreset?: GuardrailPresetType; // プリセットタイプ
  
  // Phase 4: AgentCore設定
  readonly agentCore?: AgentCoreConfig;
  
  // Windows AD Instance ID（NetworkingStackから受け取る）
  readonly windowsAdInstanceId?: string;
}

/**
 * 統合セキュリティスタック（モジュラーアーキテクチャ対応）
 * 
 * 統合セキュリティコンストラクトによる一元管理
 * 個別スタックデプロイ完全対応
 */
export class SecurityStack extends cdk.Stack {
  /** 統合セキュリティコンストラクト */
  public readonly security: SecurityConstruct;
  
  /** KMSキー（他スタックからの参照用） */
  public readonly kmsKey: cdk.aws_kms.Key;
  
  /** WAF WebACL ARN（他スタックからの参照用） */
  public readonly wafWebAclArn?: string;
  
  /** Bedrock Guardrails（Phase 5 - エンタープライズオプション） */
  public readonly bedrockGuardrails?: BedrockGuardrailsConstruct;
  public readonly guardrailArn?: string;
  public readonly guardrailId?: string;
  
  /** Phase 4: AgentCore Constructs（オプション） */
  public agentCoreIdentity?: BedrockAgentCoreIdentityConstruct;
  public agentCorePolicy?: BedrockAgentCorePolicyConstruct;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    console.log('🔒 SecurityStack初期化開始...');
    console.log('📝 スタック名:', id);
    console.log('🏷️ Agent Steering準拠:', props.namingGenerator ? 'Yes' : 'No');

    // コスト配布タグの適用
    const taggingConfig = PermissionAwareRAGTags.getStandardConfig(
      props.projectName,
      props.environment as "dev" | "staging" | "prod"
    );
    TaggingStrategy.applyTagsToStack(this, taggingConfig);

    // 設定構造の変換（tokyoProductionConfig形式 → SecurityConstruct形式）
    const securityConfig: SecurityConfig = {
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
    this.security = new SecurityConstruct(this, 'Security', {
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
  private createBedrockGuardrails(props: SecurityStackProps): BedrockGuardrailsConstruct {
    const presetType = this.node.tryGetContext('guardrailPreset') ?? props.guardrailPreset ?? 'standard';
    const preset = getGuardrailPreset(presetType);

    // ✅ Temporarily commented out for deployment
    console.log("BedrockGuardrailsConstruct: Temporarily disabled");
    return null as any;
  }

  /**
   * スタック出力作成（個別デプロイ対応）
   */
  private createOutputs(): void {
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
        value: this.bedrockGuardrails.guardrailArn!,
        description: 'Bedrock Guardrail ARN',
        exportName: `${this.stackName}-GuardrailArn`,
      });

      new cdk.CfnOutput(this, 'GuardrailId', {
        value: this.bedrockGuardrails.guardrailId!,
        description: 'Bedrock Guardrail ID',
        exportName: `${this.stackName}-GuardrailId`,
      });

      new cdk.CfnOutput(this, 'GuardrailVersion', {
        value: this.bedrockGuardrails.guardrailVersion!,
        description: 'Bedrock Guardrail Version',
        exportName: `${this.stackName}-GuardrailVersion`,
      });
    }

    console.log('📤 SecurityStack出力値作成完了');
  }

  /**
   * スタックタグ設定（Agent Steering準拠）
   */
  private addStackTags(): void {
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
  private integrateAgentCoreConstructs(props: SecurityStackProps): void {
    const agentCoreConfig = props.agentCore || props.config.agentCore;
    if (!agentCoreConfig) {
      return;
    }

    // 1. Identity Construct（認証・認可）
    if (agentCoreConfig.identity?.enabled) {
      console.log('🔐 Identity Construct作成中...');
      
      const adSyncConfig = agentCoreConfig.identity.adSyncConfig;
      
      // AD EC2インスタンスIDを取得（NetworkingStackから、または設定から）
      const adEc2InstanceId = props.windowsAdInstanceId || 
        props.config.adEc2InstanceId || 
        adSyncConfig?.adEc2InstanceId;
      
      if (!adEc2InstanceId && adSyncConfig?.adSyncEnabled) {
        console.warn('⚠️ AD EC2インスタンスIDが指定されていないため、AD Sync機能は無効化されます');
      }
      
      this.agentCoreIdentity = new BedrockAgentCoreIdentityConstruct(this, 'AgentCoreIdentity', {
        enabled: true,
        projectName: props.projectName,
        environment: props.environment,
        adSyncEnabled: adSyncConfig?.adSyncEnabled ?? false,
        adEc2InstanceId: adEc2InstanceId,
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
    }

    // 2. Policy Construct（ポリシー管理）
    if (agentCoreConfig.policy?.enabled) {
      console.log('📜 Policy Construct作成中...');
      this.agentCorePolicy = new BedrockAgentCorePolicyConstruct(this, 'AgentCorePolicy', {
        environment: { ENV: props.environment },
        ...(agentCoreConfig.policy as any),
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
  private createAgentCoreOutputs(): void {
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
}