import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
export declare class ImportedVpcStack extends cdk.Stack {
    readonly vpc: ec2.IVpc;
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
