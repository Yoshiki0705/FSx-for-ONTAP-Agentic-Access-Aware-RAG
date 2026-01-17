/**
 * OpenSearch Multimodal Embeddingスタック
 * 
 * Titan Multimodal Embedding用に最適化されたOpenSearchクラスターをデプロイ
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { OpenSearchMultimodalConstruct } from '../modules/database/constructs/opensearch-multimodal-construct';
import { getOpenSearchMultimodalConfig } from '../modules/database/configs/opensearch-multimodal-config';

export interface OpenSearchMultimodalStackProps extends cdk.StackProps {
  /** 環境名 */
  readonly environment: string;
  
  /** プロジェクト名 */
  readonly projectName: string;
  
  /** パフォーマンスティア */
  readonly performanceTier?: 'standard' | 'high';
  
  /** VPC使用フラグ */
  readonly useVpc?: boolean;
  
  /** 既存VPC ID */
  readonly existingVpcId?: string;
  
  /** KMS暗号化有効化 */
  readonly enableKmsEncryption?: boolean;
  
  /** タグ */
  readonly tags?: Record<string, string>;
}

export class OpenSearchMultimodalStack extends cdk.Stack {
  public readonly openSearchConstruct: OpenSearchMultimodalConstruct;
  public readonly vpc?: ec2.IVpc;
  public readonly kmsKey?: kms.Key;

  constructor(scope: Construct, id: string, props: OpenSearchMultimodalStackProps) {
    super(scope, id, props);

    // 基本設定取得
    const baseConfig = getOpenSearchMultimodalConfig(props.environment, props.performanceTier);

    // VPC設定
    if (props.useVpc) {
      this.vpc = this.setupVpc(props.existingVpcId);
    }

    // KMS暗号化設定
    if (props.enableKmsEncryption) {
      this.kmsKey = this.createKmsKey();
    }

    // OpenSearchクラスター設定
    const openSearchConfig = {
      ...baseConfig,
      domainName: this.generateDomainName(props.projectName, props.environment),
      networkConfig: {
        ...baseConfig.networkConfig,
        vpcEnabled: props.useVpc || false,
        vpc: this.vpc,
        subnets: this.vpc ? this.vpc.privateSubnets : undefined,
      },
      securityConfig: {
        ...baseConfig.securityConfig,
        kmsKey: this.kmsKey,
      },
      tags: {
        ...baseConfig.tags,
        ...props.tags,
        ProjectName: props.projectName,
        StackName: this.stackName,
      },
    };

    // OpenSearchクラスター作成
    this.openSearchConstruct = new OpenSearchMultimodalConstruct(
      this,
      'OpenSearchMultimodal',
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
      description: 'KMS key for OpenSearch multimodal embedding encryption',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  /**
   * ドメイン名生成（28文字以内）
   */
  private generateDomainName(projectName: string, environment: string): string {
    const baseName = `${projectName}-${environment}`;
    const suffix = '-search';
    const maxLength = 28;
    
    // 長すぎる場合は短縮
    if (baseName.length + suffix.length > maxLength) {
      const availableLength = maxLength - suffix.length;
      const shortBaseName = baseName.substring(0, availableLength);
      return shortBaseName + suffix;
    }
    
    return baseName + suffix;
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
      value: this.openSearchConstruct.createMultimodalIndex(),
      description: 'Titan Multimodal Embedding index template (JSON)',
    });
  }

  /**
   * スタックレベルタグ適用
   */
  private applyStackTags(props: OpenSearchMultimodalStackProps): void {
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

  /**
   * インデックス作成用のLambda関数作成（オプション）
   */
  public createIndexSetupFunction(): void {
    // 将来的にインデックス自動作成用のLambda関数を追加可能
    // 現在はマニュアル作成を想定
  }
}