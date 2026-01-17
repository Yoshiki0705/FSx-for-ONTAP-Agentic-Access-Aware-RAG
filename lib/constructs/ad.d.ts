/**
 * Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */
import { Construct } from "constructs";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import { CfnMicrosoftAD } from "aws-cdk-lib/aws-directoryservice";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
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
export declare class Ad extends Construct {
    readonly microsoftAd?: CfnMicrosoftAD;
    readonly adAdminSecret: Secret;
    constructor(scope: Construct, id: string, props: AdProps);
}
export {};
