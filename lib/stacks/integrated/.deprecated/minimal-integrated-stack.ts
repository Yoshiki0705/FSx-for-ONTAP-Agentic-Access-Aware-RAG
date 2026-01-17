/**
 * 最小統合スタック
 * 
 * セキュリティとネットワーキングのみの最小構成
 * スタック間参照の問題を回避し、段階的な実装を可能にする
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityConstruct } from '../../modules/security/constructs/security-construct';
import { NetworkingConstruct } from '../../modules/networking/constructs/networking-construct';
import { SecurityConfig } from '../../modules/security/interfaces/security-config';
import { NetworkingConfig } from '../../modules/networking/interfaces/networking-config';

export interface MinimalIntegratedStackProps extends cdk.StackProps {
  projectName: string;
  environment: 'dev' | 'staging' | 'prod' | 'test';
}

export class MinimalIntegratedStack extends cdk.Stack {
  public readonly securityConstruct: SecurityConstruct;
  public readonly networkingConstruct: NetworkingConstruct;
  public readonly kmsKey: cdk.aws_kms.Key;
  public readonly vpc: cdk.aws_ec2.Vpc;

  constructor(scope: Construct, id: string, props: MinimalIntegratedStackProps) {
    super(scope, id, props);

    const { projectName, environment } = props;

    // 1. セキュリティコンストラクト
    const securityConfig: SecurityConfig = {
      kms: {
        enableKeyRotation: true,
        keySpec: 'SYMMETRIC_DEFAULT',
        keyUsage: 'ENCRYPT_DECRYPT',
      },
      waf: {
        enabled: true,
        scope: 'REGIONAL',
        rules: {
          enableAWSManagedRules: true,
          enableRateLimiting: true,
          rateLimit: 2000,
          enableGeoBlocking: false,
          blockedCountries: [],
        },
      },
      cloudTrail: {
        enabled: true,
        s3BucketName: `${projectName}-${environment}-cloudtrail`,
        includeGlobalServiceEvents: true,
        isMultiRegionTrail: true,
        enableLogFileValidation: true,
      },
      tags: {
        SecurityLevel: 'High',
        EncryptionRequired: true,
        ComplianceFramework: 'SOC2',
        DataClassification: 'Confidential',
      },
    };

    this.securityConstruct = new SecurityConstruct(this, 'Security', {
      config: securityConfig,
      projectName,
      environment,
    });

    this.kmsKey = this.securityConstruct.kmsKey;

    // 2. ネットワーキングコンストラクト
    const networkingConfig: NetworkingConfig = {
      vpcCidr: '10.0.0.0/16',
      maxAzs: 3,
      enablePublicSubnets: true,
      enablePrivateSubnets: true,
      enableIsolatedSubnets: true,
      enableNatGateway: true,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      enableFlowLogs: true,
      vpcEndpoints: {
        s3: true,
        dynamodb: true,
        lambda: true,
        opensearch: true,
      },
      securityGroups: {
        web: true,
        api: true,
        database: true,
        lambda: true,
      },
    };

    this.networkingConstruct = new NetworkingConstruct(this, 'Networking', {
      config: networkingConfig,
      projectName,
      environment,
    });

    this.vpc = this.networkingConstruct.vpc;

    // CloudFormation出力
    this.createOutputs();

    // スタックレベルのタグ設定
    this.applyStackTags(projectName, environment);
  }

  /**
   * CloudFormation出力の作成
   */
  private createOutputs(): void {
    // セキュリティ出力
    new cdk.CfnOutput(this, 'KmsKeyId', {
      value: this.kmsKey.keyId,
      description: 'KMS Key ID',
      exportName: `${this.stackName}-KmsKeyId`,
    });

    new cdk.CfnOutput(this, 'KmsKeyArn', {
      value: this.kmsKey.keyArn,
      description: 'KMS Key ARN',
      exportName: `${this.stackName}-KmsKeyArn`,
    });

    if (this.securityConstruct.wafWebAcl) {
      new cdk.CfnOutput(this, 'WafWebAclArn', {
        value: this.securityConstruct.wafWebAcl.attrArn,
        description: 'WAF WebACL ARN',
        exportName: `${this.stackName}-WafWebAclArn`,
      });
    }

    // ネットワーキング出力
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${this.stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'VpcCidr', {
      value: this.vpc.vpcCidrBlock,
      description: 'VPC CIDR Block',
      exportName: `${this.stackName}-VpcCidr`,
    });

    // サブネット出力
    this.networkingConstruct.publicSubnets.forEach((subnet, index) => {
      new cdk.CfnOutput(this, `PublicSubnet${index + 1}Id`, {
        value: subnet.subnetId,
        description: `Public Subnet ${index + 1} ID`,
        exportName: `${this.stackName}-PublicSubnet${index + 1}Id`,
      });
    });

    this.networkingConstruct.privateSubnets.forEach((subnet, index) => {
      new cdk.CfnOutput(this, `PrivateSubnet${index + 1}Id`, {
        value: subnet.subnetId,
        description: `Private Subnet ${index + 1} ID`,
        exportName: `${this.stackName}-PrivateSubnet${index + 1}Id`,
      });
    });

    // アベイラビリティゾーン
    new cdk.CfnOutput(this, 'AvailabilityZones', {
      value: this.vpc.availabilityZones.join(','),
      description: 'Availability Zones',
      exportName: `${this.stackName}-AvailabilityZones`,
    });
  }

  /**
   * スタックレベルのタグ設定
   */
  private applyStackTags(projectName: string, environment: string): void {
    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Stack', 'MinimalIntegratedStack');
    cdk.Tags.of(this).add('Component', 'Infrastructure');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('Architecture', 'Minimal');
    cdk.Tags.of(this).add('CostCenter', `${projectName}-${environment}-minimal`);
  }

  /**
   * システム情報の取得
   */
  public getSystemInfo() {
    return {
      stackName: this.stackName,
      region: this.region,
      account: this.account,
      components: {
        security: true,
        networking: true,
      },
      resources: {
        kmsKey: this.kmsKey.keyArn,
        vpc: this.vpc.vpcId,
        wafWebAcl: this.securityConstruct.wafWebAcl?.attrArn || null,
      },
    };
  }

  /**
   * セキュリティリソースの取得
   */
  public getSecurityResources() {
    return {
      kmsKey: this.kmsKey,
      wafWebAcl: this.securityConstruct.wafWebAcl,
      securityConstruct: this.securityConstruct,
    };
  }

  /**
   * ネットワークリソースの取得
   */
  public getNetworkResources() {
    return {
      vpc: this.vpc,
      publicSubnets: this.networkingConstruct.publicSubnets,
      privateSubnets: this.networkingConstruct.privateSubnets,
      isolatedSubnets: this.networkingConstruct.isolatedSubnets,
      securityGroups: this.networkingConstruct.securityGroups,
      networkingConstruct: this.networkingConstruct,
    };
  }
}