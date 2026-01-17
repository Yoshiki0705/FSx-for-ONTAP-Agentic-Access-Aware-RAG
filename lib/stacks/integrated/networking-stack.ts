/**
 * 統合ネットワーキングスタック
 * 
 * モジュラーアーキテクチャに基づくネットワーク基盤統合管理
 * - VPC・サブネット構成
 * - インターネットゲートウェイ・NATゲートウェイ
 * - セキュリティグループ・NACL
 * - VPCエンドポイント
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkingConstruct } from '../../modules/networking';
import { NetworkingConfig } from '../../modules/networking';

// タグ設定
import { TaggingStrategy, PermissionAwareRAGTags } from '../../config/tagging-config';

/**
 * NetworkingStack のプロパティ
 */
export interface NetworkingStackProps extends cdk.StackProps {
  /** ネットワーキング設定 */
  config: NetworkingConfig;
  /** プロジェクト名（50文字以内） */
  projectName: string;
  /** 環境名（dev/staging/prod/test） */
  environment: 'dev' | 'staging' | 'prod' | 'test';
}

export class NetworkingStack extends cdk.Stack {
  public readonly networkingConstruct: NetworkingConstruct;
  public readonly vpc: cdk.aws_ec2.Vpc;
  public readonly publicSubnets: cdk.aws_ec2.ISubnet[];
  public readonly privateSubnets: cdk.aws_ec2.ISubnet[];
  public readonly isolatedSubnets: cdk.aws_ec2.ISubnet[];
  public readonly securityGroups: { [key: string]: cdk.aws_ec2.SecurityGroup };

  constructor(scope: Construct, id: string, props: NetworkingStackProps) {
    super(scope, id, props);

    // コスト配布タグの適用
    const taggingConfig = PermissionAwareRAGTags.getStandardConfig(
      props.projectName,
      (props.environment === 'test' ? 'dev' : props.environment) as 'dev' | 'staging' | 'prod'
    );
    TaggingStrategy.applyTagsToStack(this, taggingConfig);

    try {
      // 入力値の検証
      this.validateProps(props);

      const { config, projectName, environment } = props;

      // ネットワーキングコンストラクト作成
      this.networkingConstruct = new NetworkingConstruct(this, 'NetworkingConstruct', {
        config,
        projectName,
        environment,
      });

      // 主要リソースの参照を設定
      this.vpc = this.networkingConstruct.vpc;
      this.publicSubnets = this.networkingConstruct.publicSubnets;
      this.privateSubnets = this.networkingConstruct.privateSubnets;
      this.isolatedSubnets = this.networkingConstruct.isolatedSubnets;
      this.securityGroups = this.networkingConstruct.securityGroups;

      // CloudFormation出力
      this.createOutputs();

      // スタックレベルのタグ設定
      this.applyStackTags(projectName, environment);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`NetworkingStack初期化エラー: ${errorMessage}`);
    }
  }

  /**
   * プロパティの検証
   */
  private validateProps(props: NetworkingStackProps): void {
    const { config, projectName, environment } = props;

    if (!projectName || projectName.trim().length === 0) {
      throw new Error('プロジェクト名が設定されていません');
    }

    if (!environment || environment.trim().length === 0) {
      throw new Error('環境名が設定されていません');
    }

    if (!config) {
      throw new Error('ネットワーキング設定が設定されていません');
    }

    // プロジェクト名の長さ制限（AWS リソース名制限を考慮）
    if (projectName.length > 50) {
      throw new Error('プロジェクト名は50文字以内で設定してください');
    }

    // 環境名の検証
    const validEnvironments = ['dev', 'staging', 'prod', 'test'];
    if (!validEnvironments.includes(environment)) {
      throw new Error(`環境名は次のいずれかを指定してください: ${validEnvironments.join(', ')}`);
    }
  }

  /**
   * CloudFormation出力の作成
   */
  private createOutputs(): void {
    // VPC情報
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

    new cdk.CfnOutput(this, 'VpcAvailabilityZones', {
      value: cdk.Fn.join(',', this.vpc.availabilityZones),
      description: 'VPC Availability Zones',
      exportName: `${this.stackName}-AvailabilityZones`,
    });

    // サブネット情報
    this.publicSubnets.forEach((subnet, index) => {
      new cdk.CfnOutput(this, `PublicSubnet${index + 1}Id`, {
        value: subnet.subnetId,
        description: `Public Subnet ${index + 1} ID`,
        exportName: `${this.stackName}-PublicSubnet${index + 1}Id`,
      });
    });

    this.privateSubnets.forEach((subnet, index) => {
      new cdk.CfnOutput(this, `PrivateSubnet${index + 1}Id`, {
        value: subnet.subnetId,
        description: `Private Subnet ${index + 1} ID`,
        exportName: `${this.stackName}-PrivateSubnet${index + 1}Id`,
      });
    });

    this.isolatedSubnets.forEach((subnet, index) => {
      new cdk.CfnOutput(this, `IsolatedSubnet${index + 1}Id`, {
        value: subnet.subnetId,
        description: `Isolated Subnet ${index + 1} ID`,
        exportName: `${this.stackName}-IsolatedSubnet${index + 1}Id`,
      });
    });

    // セキュリティグループ情報
    Object.entries(this.securityGroups).forEach(([name, sg]) => {
      new cdk.CfnOutput(this, `SecurityGroup${name}Id`, {
        value: sg.securityGroupId,
        description: `Security Group ${name} ID`,
        exportName: `${this.stackName}-SecurityGroup${name}Id`,
      });
    });
  }

  /**
   * スタックレベルのタグ設定
   */
  private applyStackTags(projectName: string, environment: string): void {
    // タグ値のサニタイズ（セキュリティ対策）
    const sanitizedProjectName = this.sanitizeTagValue(projectName);
    const sanitizedEnvironment = this.sanitizeTagValue(environment);
    
    cdk.Tags.of(this).add('Project', sanitizedProjectName);
    cdk.Tags.of(this).add('Environment', sanitizedEnvironment);
    cdk.Tags.of(this).add('Stack', 'NetworkingStack');
    cdk.Tags.of(this).add('Component', 'Infrastructure');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('CostCenter', `${sanitizedProjectName}-${sanitizedEnvironment}-networking`);
    cdk.Tags.of(this).add('CreatedAt', new Date().toISOString().split('T')[0]);
  }

  /**
   * タグ値のサニタイズ
   */
  private sanitizeTagValue(value: string): string {
    // 不正な文字を除去し、長さを制限
    return value
      .replace(/[<>\"'&]/g, '') // XSS対策
      .substring(0, 256) // AWS タグ値の最大長制限
      .trim();
  }

  /**
   * 他のスタックで使用するためのネットワーク情報を取得
   */
  public getNetworkingInfo(): {
    vpc: cdk.aws_ec2.Vpc;
    publicSubnets: cdk.aws_ec2.ISubnet[];
    privateSubnets: cdk.aws_ec2.ISubnet[];
    isolatedSubnets: cdk.aws_ec2.ISubnet[];
    securityGroups: { [key: string]: cdk.aws_ec2.SecurityGroup };
    availabilityZones: string[];
  } {
    return {
      vpc: this.vpc,
      publicSubnets: this.publicSubnets,
      privateSubnets: this.privateSubnets,
      isolatedSubnets: this.isolatedSubnets,
      securityGroups: this.securityGroups,
      availabilityZones: this.vpc.availabilityZones,
    };
  }

  /**
   * 特定のセキュリティグループを取得
   */
  public getSecurityGroup(name: string): cdk.aws_ec2.SecurityGroup | undefined {
    return this.securityGroups[name];
  }

  /**
   * VPCエンドポイント情報を取得
   */
  public getVpcEndpoints(): { [key: string]: cdk.aws_ec2.InterfaceVpcEndpoint | cdk.aws_ec2.GatewayVpcEndpoint } {
    return this.networkingConstruct.vpcEndpoints || {};
  }
}