/**
 * Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import {
  IVpc,
  Vpc,
  SubnetType,
  IpAddresses,
} from "aws-cdk-lib/aws-ec2";
import { NetworkConfig } from "../../config";

export class Network extends Construct {
  public readonly vpc: Vpc | IVpc;

  constructor(scope: Construct, id: string, props: NetworkConfig) {
    super(scope, id);

    if (props.existingVpc && props.vpcId) {
      // 既存VPCを参照
      console.log(`Using existing VPC: ${props.vpcId}`);
      this.vpc = Vpc.fromLookup(this, "ExistingVpc", {
        vpcId: props.vpcId,
      });
    } else {
      // 新しいVPCを作成
      console.log("Creating new VPC");
      this.vpc = new Vpc(this, "Vpc", {
        ipAddresses: IpAddresses.cidr(props.cidr),
        maxAzs: props.maxAzs,
        subnetConfiguration: [
          ...(props.publicSubnet
            ? [
                {
                  cidrMask: props.subnetCidrMask,
                  name: "Public",
                  subnetType: SubnetType.PUBLIC,
                },
              ]
            : []),
          ...(props.natSubnet
            ? [
                {
                  cidrMask: props.subnetCidrMask,
                  name: "Private",
                  subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                },
              ]
            : []),
          ...(props.isolatedSubnet
            ? [
                {
                  cidrMask: props.subnetCidrMask,
                  name: "Isolated",
                  subnetType: SubnetType.PRIVATE_ISOLATED,
                },
              ]
            : []),
        ],
      });
    }
  }
}
