/**
 * OpenSearch Domainスタック
 * 
 * 通常のOpenSearchクラスター（非Serverless）をデプロイ
 * Titan Multimodal Embedding用に最適化
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { OpenSearchDomainConstruct } from '../modules/database/constructs/opensearch-domain-construct';
import { getOpenSearchDomainConfig } from '../modules/database/configs/opensearch-domain-config';

export interface OpenSearchDomainStackProps extends cdk.StackProps {
  /** 環境名 */
  readonly environment: string;
  
  /** プロジェクト名 */
  readonly projectName: string;
  
  /** VPC使用フラグ */
  readonly useVpc?: boolean;
  
  /** 既存VPC ID */
  readonly existingVpcId?: string;
  
  /** KMS暗号化有効化 */
  readonly enableKmsEncryption?: boolean;
  
  /** カスタム設定上書き */
  readonly customConfig?: Partial<any>;
  
  /** タグ */
  readonly tags?: Record<string, string>;
}

export class OpenSearchDomainStack extends cdk.Stack {
  public readonly openSearchConstruct: OpenSearchDomainConstruct;
  public readonly vpc?: ec2.IVpc;
  public readonly kmsKey?: kms.Key;

  constructor(scope: Construct, id: string, props: OpenSearchDomainStackProps) {
    super(scope, id, props);

    // 基本設定取得
    const baseConfig = getOpenSearchDomainConfig(props.environment, props.projectName);

    // VPC設定
    if (props.useVpc) {
      this.vpc = this.setupVpc(props.existingVpcId);
    }

    // KMS暗号化設定
    if (props.enableKmsEncryption) {
      this.kmsKey = this.createKmsKey();
    }

    // OpenSearchドメイン設定
    const openSearchConfig = {
      ...baseConfig,
      domainName: this.generateDomainName(props.projectName, props.environment),
      networkConfig: {
        ...baseConfig.networkConfig,
        vpcEnabled: props.useVpc || baseConfig.networkConfig.vpcEnabled,
        vpc: this.vpc || baseConfig.networkConfig.vpc,
        subnets: this.vpc ? this.vpc.privateSubnets : baseConfig.networkConfig.subnets,
      },
      securityConfig: {
        ...baseConfig.securityConfig,
        kmsKey: this.kmsKey || baseConfig.securityConfig.kmsKey,
      },
      tags: {
        ...baseConfig.tags,
        ...props.tags,
        ProjectName: props.projectName,
        StackName: this.stackName,
      },
      // カスタム設定の上書き
      ...props.customConfig,
    };

    // OpenSearchドメイン作成
    this.openSearchConstruct = new OpenSearchDomainConstruct(
      this,
      'OpenSearchDomain',
      openSearchConfig
    );

    // CloudFormation出力
    this.createOutputs();

    // スタックレベルタグ
    this.applyStackTags(props);
  }

  /**
   * VPC設定
   */
  private setupVpc(existingVpcId?: string): ec2.IVpc {
    if (existingVpcId) {
      // 既存VPCを使用
      return ec2.Vpc.fromLookup(this, 'ExistingVpc', {
        vpcId: existingVpcId,
      });
    } else {
      // 新しいVPCを作成
      return new ec2.Vpc(this, 'OpenSearchVpc', {
        maxAzs: 3,
        natGateways: 1,
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'Public',
            subnetType: ec2.SubnetType.PUBLIC,
          },
          {
            cidrMask: 24,
            name: 'Private',
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          },
        ],
        enableDnsHostnames: true,
        enableDnsSupport: true,
      });
    }
  }

  /**
   * KMSキー作成
   */
  private createKmsKey(): kms.Key {
    return new kms.Key(this, 'OpenSearchKmsKey', {
      description: 'KMS key for OpenSearch domain encryption',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  /**
   * ドメイン名生成（28文字以内）
   * Agent Steering命名規則準拠
   */
  private generateDomainName(projectName: string, environment: string): string {
    // External Vector DB用の短縮名
    const baseName = `${projectName}-${environment}-vectordb`;
    const maxLength = 28;
    
    // 長すぎる場合は短縮
    if (baseName.length > maxLength) {
      const availableLength = maxLength;
      return baseName.substring(0, availableLength);
    }
    
    return baseName;
  }

  /**
   * CloudFormation出力作成
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'OpenSearchDomainArn', {
      value: this.openSearchConstruct.outputs.domainArn,
      description: 'OpenSearch domain ARN',
      exportName: `${this.stackName}-DomainArn`,
    });

    new cdk.CfnOutput(this, 'OpenSearchDomainEndpoint', {
      value: this.openSearchConstruct.outputs.domainEndpoint,
      description: 'OpenSearch domain endpoint',
      exportName: `${this.stackName}-DomainEndpoint`,
    });

    new cdk.CfnOutput(this, 'OpenSearchKibanaEndpoint', {
      value: this.openSearchConstruct.outputs.kibanaEndpoint,
      description: 'OpenSearch Kibana endpoint',
      exportName: `${this.stackName}-KibanaEndpoint`,
    });

    new cdk.CfnOutput(this, 'OpenSearchDomainName', {
      value: this.openSearchConstruct.outputs.domainName,
      description: 'OpenSearch domain name',
      exportName: `${this.stackName}-DomainName`,
    });

    if (this.openSearchConstruct.outputs.securityGroupId) {
      new cdk.CfnOutput(this, 'OpenSearchSecurityGroupId', {
        value: this.openSearchConstruct.outputs.securityGroupId,
        description: 'OpenSearch security group ID',
        exportName: `${this.stackName}-SecurityGroupId`,
      });
    }

    if (this.vpc) {
      new cdk.CfnOutput(this, 'VpcId', {
        value: this.vpc.vpcId,
        description: 'VPC ID',
        exportName: `${this.stackName}-VpcId`,
      });
    }

    if (this.kmsKey) {
      new cdk.CfnOutput(this, 'KmsKeyId', {
        value: this.kmsKey.keyId,
        description: 'KMS key ID',
        exportName: `${this.stackName}-KmsKeyId`,
      });
    }

    // Titan Multimodal Embeddingインデックステンプレート出力
    new cdk.CfnOutput(this, 'MultimodalIndexTemplate', {
      value: this.openSearchConstruct.createMultimodalIndexTemplate(),
      description: 'Titan Multimodal Embedding index template (JSON)',
    });
  }

  /**
   * スタックレベルタグ適用
   */
  private applyStackTags(props: OpenSearchDomainStackProps): void {
    const defaultTags = {
      Environment: props.environment,
      ProjectName: props.projectName,
      Component: 'OpenSearch',
      Purpose: 'MultimodalEmbedding',
      ManagedBy: 'CDK',
      CostCenter: props.environment === 'prod' ? 'Production' : 'Development',
    };

    const allTags = { ...defaultTags, ...props.tags };

    Object.entries(allTags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}