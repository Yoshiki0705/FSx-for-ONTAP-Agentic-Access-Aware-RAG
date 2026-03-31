/**
 * DemoNetworkingStack
 * 
 * デモ環境用VPC・サブネット・セキュリティグループを作成する。
 * cdk destroy --all で安全に削除可能。
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface DemoNetworkingStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  /** VPCエンドポイントを有効化するか（デフォルト: false） */
  enableVpcEndpoints?: boolean;
}

export class DemoNetworkingStack extends cdk.Stack {
  /** デモ環境VPC */
  public readonly vpc: ec2.Vpc;
  /** プライベートサブネット（FSx, Lambda配置用） */
  public readonly privateSubnets: ec2.ISubnet[];
  /** パブリックサブネット */
  public readonly publicSubnets: ec2.ISubnet[];
  /** Lambda用セキュリティグループ */
  public readonly lambdaSg: ec2.SecurityGroup;
  /** FSx用セキュリティグループ */
  public readonly fsxSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DemoNetworkingStackProps) {
    super(scope, id, props);

    const { projectName, environment, enableVpcEndpoints } = props;
    const prefix = `${projectName}-${environment}`;

    // VPC（2 AZ、Public + Private サブネット）
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${prefix}-vpc`,
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    this.privateSubnets = this.vpc.privateSubnets;
    this.publicSubnets = this.vpc.publicSubnets;

    // Lambda用セキュリティグループ
    this.lambdaSg = new ec2.SecurityGroup(this, 'LambdaSg', {
      vpc: this.vpc,
      securityGroupName: `${prefix}-lambda-sg`,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // FSx ONTAP用セキュリティグループ
    // allowAllOutbound: true — FSxはADドメインコントローラーへの
    // アウトバウンド通信（DNS/53, Kerberos/88, LDAP/389, SMB/445, RPC/135, 
    // LDAPS/636, Kerberos-pwd/464, Ephemeral/1024-65535）が必要
    this.fsxSg = new ec2.SecurityGroup(this, 'FsxSg', {
      vpc: this.vpc,
      securityGroupName: `${prefix}-fsx-sg`,
      description: 'Security group for FSx for ONTAP',
      allowAllOutbound: true,
    });

    // NFS (2049) - VPC内からのみ許可
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(2049),
      'NFS from VPC',
    );

    // ONTAP REST API (443) - VPC内からのみ許可
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      'ONTAP REST API from VPC',
    );

    // CIFS/SMB (445) - VPC内からのみ許可（AD連携時に必要）
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(445),
      'CIFS/SMB from VPC',
    );

    // DNS (53 TCP/UDP) - AD連携時に必要
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(53),
      'DNS TCP from VPC',
    );
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.udp(53),
      'DNS UDP from VPC',
    );

    // Kerberos (88 TCP/UDP) - AD認証に必要
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(88),
      'Kerberos TCP from VPC',
    );
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.udp(88),
      'Kerberos UDP from VPC',
    );

    // LDAP (389 TCP/UDP) - AD連携に必要
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(389),
      'LDAP TCP from VPC',
    );
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.udp(389),
      'LDAP UDP from VPC',
    );

    // LDAPS (636) - AD連携に必要（セキュアLDAP）
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(636),
      'LDAPS from VPC',
    );

    // RPC (135) - AD連携に必要（エンドポイントマッパー）
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(135),
      'RPC Endpoint Mapper from VPC',
    );

    // Kerberos password change (464 TCP/UDP) - AD連携に必要
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(464),
      'Kerberos password change TCP from VPC',
    );
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.udp(464),
      'Kerberos password change UDP from VPC',
    );

    // Global Catalog (3268-3269) - AD連携に必要
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcpRange(3268, 3269),
      'Global Catalog from VPC',
    );

    // Ephemeral/RPC dynamic ports (1024-65535) - AD連携に必要
    this.fsxSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcpRange(1024, 65535),
      'Ephemeral/RPC dynamic ports from VPC',
    );

    // Lambda → FSx 通信許可
    this.fsxSg.addIngressRule(
      this.lambdaSg,
      ec2.Port.tcp(2049),
      'NFS from Lambda',
    );

    // ========================================
    // VPCエンドポイント（オプション）
    // ========================================
    // NAT Gateway経由のインターネットアクセスを減らし、
    // AWSサービスへのプライベート接続を確立する。
    if (enableVpcEndpoints) {
      // Gateway Endpoints（無料）
      this.vpc.addGatewayEndpoint('S3Endpoint', {
        service: ec2.GatewayVpcEndpointAwsService.S3,
      });
      this.vpc.addGatewayEndpoint('DynamoDbEndpoint', {
        service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      });

      // Interface Endpoints（有料、セキュリティ要件に応じて有効化）
      const interfaceEndpointSg = new ec2.SecurityGroup(this, 'VpceInterfaceSg', {
        vpc: this.vpc,
        securityGroupName: `${prefix}-vpce-sg`,
        description: 'Security group for VPC Interface Endpoints',
        allowAllOutbound: true,
      });
      interfaceEndpointSg.addIngressRule(
        ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
        ec2.Port.tcp(443),
        'HTTPS from VPC',
      );

      // Bedrock Runtime
      this.vpc.addInterfaceEndpoint('BedrockRuntimeEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
        securityGroups: [interfaceEndpointSg],
        privateDnsEnabled: true,
      });

      // Bedrock Agent Runtime
      this.vpc.addInterfaceEndpoint('BedrockAgentRuntimeEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_AGENT_RUNTIME,
        securityGroups: [interfaceEndpointSg],
        privateDnsEnabled: true,
      });

      // SSM（Session Manager / AD Sync Lambda用）
      this.vpc.addInterfaceEndpoint('SsmEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM,
        securityGroups: [interfaceEndpointSg],
        privateDnsEnabled: true,
      });
      this.vpc.addInterfaceEndpoint('SsmMessagesEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
        securityGroups: [interfaceEndpointSg],
        privateDnsEnabled: true,
      });

      // Secrets Manager
      this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        securityGroups: [interfaceEndpointSg],
        privateDnsEnabled: true,
      });

      // CloudWatch Logs（Lambda ログ出力用）
      this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
        securityGroups: [interfaceEndpointSg],
        privateDnsEnabled: true,
      });
    }

    // CloudFormation出力
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: `${prefix}-VpcId`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.privateSubnets.map(s => s.subnetId).join(','),
      exportName: `${prefix}-PrivateSubnetIds`,
    });

    new cdk.CfnOutput(this, 'LambdaSgId', {
      value: this.lambdaSg.securityGroupId,
      exportName: `${prefix}-LambdaSgId`,
    });

    new cdk.CfnOutput(this, 'FsxSgId', {
      value: this.fsxSg.securityGroupId,
      exportName: `${prefix}-FsxSgId`,
    });

    // タグ付け
    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
  }
}
