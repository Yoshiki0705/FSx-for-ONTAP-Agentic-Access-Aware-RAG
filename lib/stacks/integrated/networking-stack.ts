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
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { NetworkingConstruct } from '../../modules/networking';
import { NetworkingConfig } from '../../modules/networking';

// Windows AD Construct
import { WindowsAdConstruct } from '../../modules/security/constructs/windows-ad-construct';

// タグ設定
import { TaggingStrategy, PermissionAwareRAGTags } from '../../config/tagging-config';

/**
 * Windows AD設定
 */
export interface WindowsAdConfig {
  /** Windows AD機能を有効化するかどうか */
  enabled: boolean;
  /** Active Directory Domain Name */
  domainName: string;
  /** AD EC2インスタンスタイプ */
  instanceType?: ec2.InstanceType;
  /** AD EC2のSSH Key Name（nullの場合はSSM Session Managerを使用） */
  keyName?: string | null;
}

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
  /** Windows AD設定（オプション） */
  windowsAdConfig?: WindowsAdConfig;
  /** 既存VPCをインポートする場合のVPC ID（オプション） */
  existingVpcId?: string;
  /** 既存VPCをインポートする場合のVPC CIDR（オプション） */
  existingVpcCidr?: string;
}

export class NetworkingStack extends cdk.Stack {
  public readonly networkingConstruct: NetworkingConstruct;
  public readonly vpc: cdk.aws_ec2.Vpc;
  public readonly publicSubnets: cdk.aws_ec2.ISubnet[];
  public readonly privateSubnets: cdk.aws_ec2.ISubnet[];
  public readonly isolatedSubnets: cdk.aws_ec2.ISubnet[];
  public readonly securityGroups: { [key: string]: cdk.aws_ec2.SecurityGroup };
  
  /** Windows AD EC2（オプション） */
  public readonly windowsAd?: WindowsAdConstruct;

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

      // 既存VPCをインポートする場合
      if (props.existingVpcId) {
        console.log(`🔄 既存VPCをインポート中: ${props.existingVpcId}`);
        
        // VPC情報を取得（cdk.context.jsonから）
        const vpcInfo = this.node.tryGetContext(`vpc-provider:account=${this.account}:filter.vpc-id=${props.existingVpcId}:region=${this.region}:returnAsymmetricSubnets=true`);
        
        if (!vpcInfo) {
          throw new Error(`VPC情報が見つかりません: ${props.existingVpcId}. cdk.context.jsonを確認してください。`);
        }

        // VPCをインポート
        this.vpc = ec2.Vpc.fromVpcAttributes(this, 'ImportedVpc', {
          vpcId: props.existingVpcId,
          availabilityZones: vpcInfo.availabilityZones.length > 0 
            ? vpcInfo.availabilityZones 
            : ['ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d'],
          publicSubnetIds: vpcInfo.subnetGroups.find((g: any) => g.type === 'Public')?.subnets.map((s: any) => s.subnetId) || [],
          privateSubnetIds: vpcInfo.subnetGroups.find((g: any) => g.type === 'Private')?.subnets.map((s: any) => s.subnetId) || [],
          isolatedSubnetIds: vpcInfo.subnetGroups.find((g: any) => g.type === 'Isolated')?.subnets.map((s: any) => s.subnetId) || [],
        });

        // サブネット参照を設定
        const publicSubnetGroup = vpcInfo.subnetGroups.find((g: any) => g.type === 'Public');
        const privateSubnetGroup = vpcInfo.subnetGroups.find((g: any) => g.type === 'Private');
        const isolatedSubnetGroup = vpcInfo.subnetGroups.find((g: any) => g.type === 'Isolated');

        this.publicSubnets = publicSubnetGroup?.subnets.map((s: any) => 
          ec2.Subnet.fromSubnetAttributes(this, `PublicSubnet-${s.subnetId}`, {
            subnetId: s.subnetId,
            availabilityZone: s.availabilityZone,
            routeTableId: s.routeTableId,
          })
        ) || [];

        this.privateSubnets = privateSubnetGroup?.subnets.map((s: any) => 
          ec2.Subnet.fromSubnetAttributes(this, `PrivateSubnet-${s.subnetId}`, {
            subnetId: s.subnetId,
            availabilityZone: s.availabilityZone,
            routeTableId: s.routeTableId,
          })
        ) || [];

        this.isolatedSubnets = isolatedSubnetGroup?.subnets.map((s: any) => 
          ec2.Subnet.fromSubnetAttributes(this, `IsolatedSubnet-${s.subnetId}`, {
            subnetId: s.subnetId,
            availabilityZone: s.availabilityZone,
            routeTableId: s.routeTableId,
          })
        ) || [];

        // Security Groupsを作成（既存VPCに新規作成、名前の重複を動的に回避）
        this.securityGroups = this.createSecurityGroupsForImportedVpc(config);

        console.log(`✅ 既存VPCインポート完了: ${props.existingVpcId}`);
        console.log(`   - Public Subnets: ${this.publicSubnets.length}個`);
        console.log(`   - Private Subnets: ${this.privateSubnets.length}個`);
        console.log(`   - Isolated Subnets: ${this.isolatedSubnets.length}個`);
      } else {
        // 新規VPCを作成する場合（既存の動作）
        console.log('🆕 新規VPCを作成中...');
        
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
        
        console.log('✅ 新規VPC作成完了');
      }

      // Windows AD EC2作成（オプション）
      if (props.windowsAdConfig?.enabled) {
        console.log('🪟 Windows AD EC2作成中...');
        
        this.windowsAd = new WindowsAdConstruct(this, 'WindowsAd', {
          vpc: this.vpc,
          privateSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
          projectName: props.projectName,
          environment: props.environment,
          domainName: props.windowsAdConfig.domainName,
          instanceType: props.windowsAdConfig.instanceType,
          keyName: props.windowsAdConfig.keyName,
        });
        
        console.log('✅ Windows AD EC2作成完了');
        console.log(`   - Instance ID: ${this.windowsAd.instanceId}`);
        console.log(`   - Domain Name: ${props.windowsAdConfig.domainName}`);
      }

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

    // Windows AD情報（存在する場合のみ）
    if (this.windowsAd) {
      new cdk.CfnOutput(this, 'WindowsAdInstanceId', {
        value: this.windowsAd.instanceId,
        description: 'Windows AD EC2 Instance ID',
        exportName: `${this.stackName}-WindowsAdInstanceId`,
      });

      new cdk.CfnOutput(this, 'WindowsAdSecurityGroupId', {
        value: this.windowsAd.securityGroup.securityGroupId,
        description: 'Windows AD Security Group ID',
        exportName: `${this.stackName}-WindowsAdSecurityGroupId`,
      });

      new cdk.CfnOutput(this, 'WindowsAdAdminPasswordSecretArn', {
        value: this.windowsAd.adminPasswordSecret.secretArn,
        description: 'Windows AD Admin Password Secret ARN',
        exportName: `${this.stackName}-WindowsAdAdminPasswordSecretArn`,
      });
    }
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
   * 既存VPC用のSecurity Groupsを作成（名前の重複を動的に回避）
   */
  private createSecurityGroupsForImportedVpc(config: NetworkingConfig): { [key: string]: cdk.aws_ec2.SecurityGroup } {
    const securityGroups: { [key: string]: cdk.aws_ec2.SecurityGroup } = {};
    const timestamp = Date.now().toString().slice(-6); // 最後の6桁のタイムスタンプ

    if (config.securityGroups?.web) {
      securityGroups['web'] = new ec2.SecurityGroup(this, 'WebSecurityGroup', {
        vpc: this.vpc,
        securityGroupName: `${this.stackName}-web-sg-${timestamp}`,
        description: 'Security Group for Web tier (imported VPC)',
        allowAllOutbound: true,
      });
      securityGroups['web'].addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(443),
        'Allow HTTPS from anywhere'
      );
      securityGroups['web'].addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(80),
        'Allow HTTP from anywhere'
      );
    }

    if (config.securityGroups?.api) {
      securityGroups['api'] = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
        vpc: this.vpc,
        securityGroupName: `${this.stackName}-api-sg-${timestamp}`,
        description: 'Security Group for API tier (imported VPC)',
        allowAllOutbound: true,
      });
      if (securityGroups['web']) {
        securityGroups['api'].addIngressRule(
          securityGroups['web'],
          ec2.Port.tcp(443),
          'Allow HTTPS from Web tier'
        );
      }
    }

    if (config.securityGroups?.database) {
      securityGroups['database'] = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
        vpc: this.vpc,
        securityGroupName: `${this.stackName}-db-sg-${timestamp}`,
        description: 'Security Group for Database tier (imported VPC)',
        allowAllOutbound: false,
      });
      if (securityGroups['api']) {
        securityGroups['database'].addIngressRule(
          securityGroups['api'],
          ec2.Port.tcp(3306),
          'Allow MySQL from API tier'
        );
        securityGroups['database'].addIngressRule(
          securityGroups['api'],
          ec2.Port.tcp(5432),
          'Allow PostgreSQL from API tier'
        );
      }
    }

    if (config.securityGroups?.lambda) {
      securityGroups['lambda'] = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
        vpc: this.vpc,
        securityGroupName: `${this.stackName}-lambda-sg-${timestamp}`,
        description: 'Security Group for Lambda functions (imported VPC)',
        allowAllOutbound: true,
      });
    }

    console.log(`✅ Security Groups作成完了（タイムスタンプ: ${timestamp}）`);
    return securityGroups;
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