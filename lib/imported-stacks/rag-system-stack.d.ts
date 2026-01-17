import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
export interface RagSystemStackProps extends cdk.StackProps {
    vpc?: ec2.IVpc;
}
export declare class RagSystemStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: RagSystemStackProps);
}
