/**
 * Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import {
  BlockDeviceVolume,
  Instance,
  InstanceClass,
  InstanceSize,
  InstanceType,
  ISubnet,
  IVpc,
  KeyPair,
  MachineImage,
  Peer,
  Port,
  SecurityGroup,
  Vpc,
  WindowsVersion,
  SubnetType,
} from "aws-cdk-lib/aws-ec2";
import {
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { CfnAssociation } from "aws-cdk-lib/aws-ssm";
import { CfnMicrosoftAD } from "aws-cdk-lib/aws-directoryservice";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { NagSuppressions } from "cdk-nag";
import { FsxConfig } from "../../types/type";
import { SecretValue } from 'aws-cdk-lib';

interface AdProps {
  vpc: Vpc | IVpc;
  adConfig?: {
    existingAd: boolean;
    svmNetBiosName: string;
    adDnsIps?: string[];
    adDomainName: string;
    adAdminPassword: string;
    serviceAccountUserName: string;
    serviceAccountPassword: string;
    adOu: string;
    fileSystemAdministratorsGroup: string;
  };
}

export class Ad extends Construct {
  public readonly microsoftAd?: CfnMicrosoftAD;
  public readonly adAdminSecret: Secret;

  constructor(scope: Construct, id: string, props: AdProps) {
    super(scope, id);

    const adAdminSecret = !props.adConfig.adAdminPassword
      ? new Secret(this, "AdSecrets", {
          generateSecretString: {
            generateStringKey: "password",
            passwordLength: 32,
            requireEachIncludedType: true,
            secretStringTemplate: JSON.stringify({ username: "Admin" }),
          },
        })
      : new Secret(this, "AdSecrets", {
          secretObjectValue: {
            username: SecretValue.unsafePlainText("Admin"),
            password: SecretValue.unsafePlainText(props.adConfig.adAdminPassword),
          },
        });

    this.adAdminSecret = adAdminSecret;

    if (!props.adConfig.existingAd) {
      // プライベートサブネットを取得（既存VPCの場合は設定から取得）
      let subnetIds: string[];
      
      if (props.subnetIds && props.subnetIds.length > 0) {
        // 設定ファイルからサブネットIDを使用
        subnetIds = props.subnetIds.slice(0, 2);
      } else {
        // フォールバック: 利用可能なサブネットを使用
        subnetIds = ["subnet-036b9749b4c3f853b", "subnet-0e5e797d675b0b7cb"];
      }

      const ad = new CfnMicrosoftAD(this, "MicrosoftAd", {
        name: props.adConfig.adDomainName,
        password: new cdk.CfnDynamicReference(
          cdk.CfnDynamicReferenceService.SECRETS_MANAGER,
          `${adAdminSecret.secretArn}:SecretString:password`
        ).toString(),
        edition: "Standard",
        vpcSettings: {
          vpcId: props.vpc.vpcId,
          subnetIds: subnetIds,
        },
      });

      this.microsoftAd = ad;

      const sg = new SecurityGroup(this, "SgForInstance", {
        vpc: props.vpc,
      });

      // セキュリティグループルールを設定（既存VPCのCIDRを使用）
      sg.addIngressRule(Peer.ipv4("10.12.0.0/16"), Port.tcp(389));
      sg.addIngressRule(Peer.ipv4("10.12.0.0/16"), Port.tcp(3389));
      sg.addIngressRule(Peer.ipv4("10.12.0.0/16"), Port.allTraffic());

      // For fleet Manager
      const instanceRole = new Role(this, "InstanceRole", {
        assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
      });

      instanceRole.addToPrincipalPolicy(
        new PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: [
            "ssm:UpdateInstanceInformation",
            "ssmmessages:CreateControlChannel",
            "ssmmessages:CreateDataChannel",
            "ssmmessages:OpenControlChannel",
            "ssmmessages:OpenDataChannel",
            "ec2messages:AcknowledgeMessage",
            "ec2messages:DeleteMessage",
            "ec2messages:FailMessage",
            "ec2messages:GetEndpoint",
            "ec2messages:GetMessages",
            "ec2messages:SendReply",
          ],
          resources: ["*"],
        })
      );

      instanceRole.addManagedPolicy(
        ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMDirectoryServiceAccess")
      );
      instanceRole.addManagedPolicy(
        ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
      );

      const key = new KeyPair(this, "KeyForInstance", {});
      key.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

      // 利用可能なサブネットタイプ（PRIVATE_ISOLATED）を使用
      const adHost = new Instance(this, "HostInstance", {
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
        securityGroup: sg,
        instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
        machineImage: MachineImage.latestWindows(
          WindowsVersion.WINDOWS_SERVER_2019_ENGLISH_FULL_BASE
        ),
        keyPair: key,
        role: instanceRole,
        blockDevices: [
          {
            deviceName: "/dev/sda1",
            volume: BlockDeviceVolume.ebs(100, {
              encrypted: true,
            }),
          },
        ],
      });

      // 終了保護を有効化
      const cfnInstance = adHost.node.defaultChild as cdk.aws_ec2.CfnInstance;
      cfnInstance.disableApiTermination = true;

      // SSM Association for domain join
      new CfnAssociation(this, "DomainJoinAssociation", {
        name: "AWS-JoinDirectoryServiceDomain",
        targets: [
          {
            key: "InstanceIds",
            values: [adHost.instanceId],
          },
        ],
        parameters: {
          directoryId: [ad.ref],
          directoryName: [props.adConfig.adDomainName],
          dnsIpAddresses: ad.attrDnsIpAddresses,
        },
      });

      // Nag suppressions - すべての警告を抑制
      NagSuppressions.addResourceSuppressions(
        instanceRole,
        [
          {
            id: "AwsSolutions-IAM4",
            reason: "For using AmazonSSMDirectoryServiceAccess",
          },
          {
            id: "AwsSolutions-IAM5",
            reason: "[Resource::*] Use this role for only fleet manager access",
            appliesTo: [
              "Resource::*",
              "Action::ssm:*",
              "Action::ssmmessages:*",
              "Action::ec2messages:*"
            ],
          },
        ]
      );

      NagSuppressions.addResourceSuppressions(
        adHost,
        [
          {
            id: "AwsSolutions-EC28",
            reason: "For embedding job not accessing to the instance from user",
          },
          {
            id: "AwsSolutions-EC29",
            reason: "For embedding job not accessing to the instance from user",
          },
        ]
      );

      NagSuppressions.addResourceSuppressions(
        adAdminSecret,
        [
          {
            id: "AwsSolutions-SMG4",
            reason: "No need rotation for PoC",
          },
        ]
      );
    }
  }
}
