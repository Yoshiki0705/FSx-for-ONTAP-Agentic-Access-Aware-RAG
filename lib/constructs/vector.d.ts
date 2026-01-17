import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { CfnCollection } from "aws-cdk-lib/aws-opensearchserverless";
import { DatabaseCluster } from "aws-cdk-lib/aws-rds";
import { ISubnet } from "aws-cdk-lib/aws-ec2";
import { VectorConfig } from "../../types/type";
interface VpcConfig {
    vpc: cdk.aws_ec2.IVpc;
    subnets: ISubnet[];
}
interface VectorDBProps extends VectorConfig {
    roles: string[];
    vpcConfig: VpcConfig | null;
    vector: string;
}
export declare class VectorDB extends Construct {
    readonly db: CfnCollection | DatabaseCluster;
    constructor(scope: Construct, id: string, props: VectorDBProps);
}
export {};
