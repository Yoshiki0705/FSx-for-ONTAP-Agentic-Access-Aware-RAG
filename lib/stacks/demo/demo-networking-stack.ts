/**
 * DemoNetworkingStack
 * 
 * デモ環境用VPC・サブネット・セキュリティグループを作成する。
 * cdk destroy --all で安全に削除可能。
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface DemoNetworkingStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  /** VPCエンドポイントを有効化するか（デフォルト: false） */
  enableVpcEndpoints?: boolean;
  /**
   * 既存VPCのID。指定すると新規VPCを作らず既存VPCを参照する。
   * 指定時は existingPrivateSubnetIds / existingAvailabilityZones / existingVpcCidr も必須。
   * NAT GatewayやVPCエンドポイントは既存VPCのものを使う（このスタックでは作らない）。
   */
  existingVpcId?: string;
  /** 既存VPCを使うときのプライベートサブネットID（別AZ2本以上） */
  existingPrivateSubnetIds?: string[];
  /** 既存VPCを使うときの、existingPrivateSubnetIds に対応するAZ */
  existingAvailabilityZones?: string[];
  /** 既存VPCのCIDR（existingVpcId 指定時は必須。FSx SG の ingress に使う） */
  existingVpcCidr?: string;
}

export class DemoNetworkingStack extends cdk.Stack {
  /** デモ環境VPC（新規作成または既存参照） */
  public readonly vpc: ec2.IVpc;
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

    const {
      projectName, environment, enableVpcEndpoints,
      existingVpcId, existingPrivateSubnetIds, existingAvailabilityZones, existingVpcCidr,
    } = props;
    const prefix = `${projectName}-${environment}`;

    // 新規作成分岐でのみ使う具体型のローカル変数。
    // addGatewayEndpoint / addInterfaceEndpoint は ec2.Vpc 固有で IVpc には無いため、
    // EP 作成はこのローカル変数に対して呼ぶ（import した IVpc には呼べない）。
    let newVpc: ec2.Vpc | undefined;

    if (existingVpcId) {
      // 既存VPC参照分岐。NAT・サブネット・Flow Log は既存VPCのものを使う（ここでは作らない）。
      // fromVpcAttributes でサブネットとAZを明示指定する。既存VPCのサブネットは
      // aws-cdk:subnet-type タグを持たないことが多く、fromLookup + subnetType selection では
      // "no Private subnet groups" で synth が落ちる。明示指定でタグ非依存にする。
      if (!existingPrivateSubnetIds || existingPrivateSubnetIds.length < 2) {
        throw new Error(
          'existingVpcId を指定する場合は existingPrivateSubnetIds に別AZ2本以上を指定してください。',
        );
      }
      if (!existingAvailabilityZones || existingAvailabilityZones.length !== existingPrivateSubnetIds.length) {
        throw new Error(
          'existingAvailabilityZones は existingPrivateSubnetIds と同数（同順）で指定してください。',
        );
      }

      // FSx SG の ingress が vpc.vpcCidrBlock を参照する。fromVpcAttributes に CIDR を
      // 渡さないと、参照時点で CDK が "vpcCidrBlock was not supplied" の例外を投げる。
      // 原因が分かりにくいので、ここで明示エラーにして早期に止める。
      if (!existingVpcCidr) {
        throw new Error(
          'existingVpcId を指定する場合は existingVpcCidr（既存VPCのCIDR、例: 10.0.0.0/16）も指定してください。',
        );
      }

      this.vpc = ec2.Vpc.fromVpcAttributes(this, 'Vpc', {
        vpcId: existingVpcId,
        availabilityZones: existingAvailabilityZones,
        privateSubnetIds: existingPrivateSubnetIds,
        vpcCidrBlock: existingVpcCidr,
      });

      this.privateSubnets = existingPrivateSubnetIds.map((id, i) =>
        ec2.Subnet.fromSubnetAttributes(this, `ImportedPrivateSubnet${i}`, {
          subnetId: id,
          availabilityZone: existingAvailabilityZones[i],
        }),
      );
      this.publicSubnets = [];

      if (enableVpcEndpoints) {
        // 既存VPCには既存のEPがある前提。重複作成は衝突を招くのでスキップする。
        cdk.Annotations.of(this).addWarning(
          'existingVpcId 指定時は enableVpcEndpoints を無視します（既存VPCのエンドポイントを使用）。',
        );
      }
    } else {
      // 新規作成分岐（従来どおり: 2 AZ、Public + Private、NAT 1本、Flow Log）
      newVpc = new ec2.Vpc(this, 'Vpc', {
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
        flowLogs: {
          'VpcFlowLog': {
            destination: ec2.FlowLogDestination.toCloudWatchLogs(),
            trafficType: ec2.FlowLogTrafficType.ALL,
          },
        },
      });

      this.vpc = newVpc;
      this.privateSubnets = newVpc.privateSubnets;
      this.publicSubnets = newVpc.publicSubnets;
    }

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
    // VPCエンドポイント（オプション、新規作成VPCのみ）
    // ========================================
    // NAT Gateway経由のインターネットアクセスを減らし、
    // AWSサービスへのプライベート接続を確立する。
    // addGatewayEndpoint / addInterfaceEndpoint は ec2.Vpc 固有のため、
    // 新規作成分岐のローカル変数 newVpc に対して呼ぶ。既存VPC参照時は newVpc が
    // undefined で、EP は既存VPCのものを使う（ここでは作らない）。
    if (enableVpcEndpoints && newVpc) {
      // Gateway Endpoints（無料）
      newVpc.addGatewayEndpoint('S3Endpoint', {
        service: ec2.GatewayVpcEndpointAwsService.S3,
      });
      newVpc.addGatewayEndpoint('DynamoDbEndpoint', {
        service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      });

      // Interface Endpoints（有料、セキュリティ要件に応じて有効化）
      const interfaceEndpointSg = new ec2.SecurityGroup(this, 'VpceInterfaceSg', {
        vpc: newVpc,
        securityGroupName: `${prefix}-vpce-sg`,
        description: 'Security group for VPC Interface Endpoints',
        allowAllOutbound: true,
      });
      interfaceEndpointSg.addIngressRule(
        ec2.Peer.ipv4(newVpc.vpcCidrBlock),
        ec2.Port.tcp(443),
        'HTTPS from VPC',
      );

      // Bedrock Runtime
      newVpc.addInterfaceEndpoint('BedrockRuntimeEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
        securityGroups: [interfaceEndpointSg],
        privateDnsEnabled: true,
      });

      // Bedrock Agent Runtime
      newVpc.addInterfaceEndpoint('BedrockAgentRuntimeEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_AGENT_RUNTIME,
        securityGroups: [interfaceEndpointSg],
        privateDnsEnabled: true,
      });

      // SSM（Session Manager / AD Sync Lambda用）
      newVpc.addInterfaceEndpoint('SsmEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM,
        securityGroups: [interfaceEndpointSg],
        privateDnsEnabled: true,
      });
      newVpc.addInterfaceEndpoint('SsmMessagesEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
        securityGroups: [interfaceEndpointSg],
        privateDnsEnabled: true,
      });

      // Secrets Manager
      newVpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        securityGroups: [interfaceEndpointSg],
        privateDnsEnabled: true,
      });

      // CloudWatch Logs（Lambda ログ出力用）
      newVpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
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

    // ========================================
    // cdk-nag suppressions
    // ========================================
    NagSuppressions.addResourceSuppressions(this.fsxSg, [
      {
        id: 'AwsSolutions-EC23',
        reason: 'FSx SG ingress uses VPC CIDR (Fn::GetAtt intrinsic), which cdk-nag cannot validate statically. Access is restricted to VPC-internal traffic only.',
      },
    ]);
    // CdkNagValidationFailure for EC23 — intrinsic function reference
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'CdkNagValidationFailure',
        reason: 'Security group rules reference VPC CIDR via Fn::GetAtt intrinsic function. Cannot be statically validated by cdk-nag but access is properly scoped to VPC CIDR.',
      },
    ]);
  }
}
