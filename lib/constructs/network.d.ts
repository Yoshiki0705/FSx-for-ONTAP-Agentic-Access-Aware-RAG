/**
 * Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
import { Construct } from "constructs";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import { NetworkConfig } from "../../config";
export declare class Network extends Construct {
    readonly vpc: Vpc | IVpc;
    constructor(scope: Construct, id: string, props: NetworkConfig);
}
