import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class ImportedVpcStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 既存のVPCをインポート用に定義
    // 実際のインポート時にはCDK importコマンドで既存リソースを取り込む
    this.vpc = new ec2.Vpc(this, "ImportedVpc", {
      cidr: "10.0.0.0/16",
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // 出力
    new cdk.CfnOutput(this, "VpcId", {
      value: this.vpc.vpcId,
      description: "Imported VPC ID",
      exportName: `${this.stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, "VpcCidr", {
      value: this.vpc.vpcCidrBlock,
      description: "Imported VPC CIDR block",
      exportName: `${this.stackName}-VpcCidr`,
    });
  }
}