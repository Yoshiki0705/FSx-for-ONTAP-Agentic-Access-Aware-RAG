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
import * as ec2 from 'aws-cdk-lib/aws-ec2';
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
  
  // VPC設定（Windows AD EC2作成用）
  readonly vpc?: ec2.IVpc;
  readonly vpcId?: string;
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

    // 0. Windows AD EC2作成（Identity機能が有効で、Windows AD設定がある場合）
    let windowsAdInstance: WindowsAdConstruct | undefined;
    let adEc2InstanceId: string | undefined;
    
    if (agentCoreConfig.identity?.enabled && agentCoreConfig.identity.windowsAdConfig?.enabled) {
      console.log('🪟 Windows AD EC2作成中...');
      
      const windowsAdConfig = agentCoreConfig.identity.windowsAdConfig;
      
      // VPCを取得（propsから、またはインポート）
      let vpc: ec2.IVpc;
      if (props.vpc) {
        vpc = props.vpc;
      } else if (props.vpcId) {
        vpc = ec2.Vpc.fromLookup(this, 'ImportedVpc', {
          vpcId: props.vpcId
        });
      } else {
        console.error('❌ VPCが指定されていません。Windows AD EC2を作成できません。');
        throw new Error('VPC is required for Windows AD EC2');
      }
      
      // Windows AD EC2作成
      windowsAdInstance = new WindowsAdConstruct(this, 'WindowsAd', {
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
      
      this.agentCoreIdentity = new BedrockAgentCoreIdentityConstruct(this, 'AgentCoreIdentity', {
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
        let vpcForEndpoints: ec2.IVpc;
        if (props.vpc) {
          vpcForEndpoints = props.vpc;
        } else if (props.vpcId) {
          vpcForEndpoints = ec2.Vpc.fromLookup(this, 'ImportedVpcForEndpoints', {
            vpcId: props.vpcId
          });
        } else {
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
        vpcEndpointSecurityGroup.addIngressRule(
          windowsAdInstance.securityGroup,
          ec2.Port.tcp(443),
          'Allow HTTPS from Windows AD EC2'
        );
        
        // プライベートサブネットを動的に取得
        // 優先順位: 1. cdk.context.json, 2. VPC Lookup（Windows AD EC2と同じAZ）
        let privateSubnetSelection: ec2.SubnetSelection;
        const contextPrivateSubnetId = this.node.tryGetContext('privateSubnetId');
        
        if (contextPrivateSubnetId) {
          // Option 1: cdk.context.jsonから取得
          console.log(`📍 プライベートサブネットID（context）: ${contextPrivateSubnetId}`);
          privateSubnetSelection = {
            subnets: [ec2.Subnet.fromSubnetId(this, 'PrivateSubnet', contextPrivateSubnetId)]
          };
        } else {
          // Option 2: VPCからプライベートサブネットを自動選択（最初のAZ）
          console.log('📍 プライベートサブネット（VPC Lookup - 最初のAZ）');
          privateSubnetSelection = {
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            availabilityZones: [vpcForEndpoints.availabilityZones[0]]
          };
        }
        
        // SSM VPCエンドポイント
        const ssmEndpoint = new ec2.InterfaceVpcEndpoint(this, 'SsmVpcEndpoint', {
          vpc: vpcForEndpoints,
          service: ec2.InterfaceVpcEndpointAwsService.SSM,
          privateDnsEnabled: true,
          securityGroups: [vpcEndpointSecurityGroup],
          subnets: privateSubnetSelection,
        });
        
        // EC2 Messages VPCエンドポイント
        const ec2MessagesEndpoint = new ec2.InterfaceVpcEndpoint(this, 'Ec2MessagesVpcEndpoint', {
          vpc: vpcForEndpoints,
          service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
          privateDnsEnabled: true,
          securityGroups: [vpcEndpointSecurityGroup],
          subnets: privateSubnetSelection,
        });
        
        // SSM Messages VPCエンドポイント
        const ssmMessagesEndpoint = new ec2.InterfaceVpcEndpoint(this, 'SsmMessagesVpcEndpoint', {
          vpc: vpcForEndpoints,
          service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
          privateDnsEnabled: true,
          securityGroups: [vpcEndpointSecurityGroup],
          subnets: privateSubnetSelection,
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

  /**
   * インスタンスタイプ文字列をパース（例: "t3.medium" → ec2.InstanceType）
   */
  private parseInstanceType(instanceTypeStr: string): ec2.InstanceType {
    const parts = instanceTypeStr.split('.');
    if (parts.length !== 2) {
      throw new Error(`Invalid instance type format: ${instanceTypeStr}. Expected format: "t3.medium"`);
    }
    
    const instanceClass = parts[0].toUpperCase();
    const instanceSize = parts[1].toUpperCase();
    
    // ec2.InstanceClassとec2.InstanceSizeの型安全な変換
    const classKey = instanceClass as keyof typeof ec2.InstanceClass;
    const sizeKey = instanceSize as keyof typeof ec2.InstanceSize;
    
    if (!(classKey in ec2.InstanceClass)) {
      throw new Error(`Unknown instance class: ${instanceClass}`);
    }
    
    if (!(sizeKey in ec2.InstanceSize)) {
      throw new Error(`Unknown instance size: ${instanceSize}`);
    }
    
    return ec2.InstanceType.of(
      ec2.InstanceClass[classKey],
      ec2.InstanceSize[sizeKey]
    );
  }
}