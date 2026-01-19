import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { Instance, ISubnet } from "aws-cdk-lib/aws-ec2";
import { Role } from "aws-cdk-lib/aws-iam";
import { CfnMicrosoftAD } from "aws-cdk-lib/aws-directoryservice";
import { CfnCollection } from "aws-cdk-lib/aws-opensearchserverless";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { DatabaseCluster } from "aws-cdk-lib/aws-rds";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { CfnStorageVirtualMachine, CfnVolume } from "aws-cdk-lib/aws-fsx";
interface VpcConfig {
    vpc: cdk.aws_ec2.IVpc;
    subnets: ISubnet[];
}
interface EmbeddingServerProps extends cdk.StackProps {
    vpcConfig: VpcConfig;
    vector: CfnCollection | DatabaseCluster;
    adSecret: ISecret;
    adUserName: string;
    adDomain: string;
    role: Role;
    imagePath: string;
    tag: string;
    adAdminSecret: Secret;
    cifsVol?: CfnVolume;
    ragdbVol?: CfnVolume;
    svm?: CfnStorageVirtualMachine;
    fsxAdminSecret?: Secret;
    serviceAccountSecret?: Secret;
    embeddingConfig?: {
        cifsdataVolName?: string;
        ragdbVolPath?: string;
    };
}
export declare class EmbeddingServer extends Construct {
    readonly microsoftAd: CfnMicrosoftAD;
    readonly instance: Instance;
    constructor(scope: Construct, id: string, props: EmbeddingServerProps);
}
export {};
