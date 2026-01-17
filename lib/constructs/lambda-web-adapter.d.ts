import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { Function, IVersion } from "aws-cdk-lib/aws-lambda";
import { ISubnet } from "aws-cdk-lib/aws-ec2";
import { TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { CognitoParams } from "./auth";
import { ChatAppConfig } from "../../types/type";
interface VpcConfig {
    vpc: cdk.aws_ec2.IVpc;
    subnets: ISubnet[];
}
interface LambdaWebAdapterProps extends ChatAppConfig {
    wafAttrArn?: string;
    edgeFnVersion?: IVersion;
    db: TableV2;
    cognito: CognitoParams;
    vpcConfig: VpcConfig | null;
}
export declare class LambdaWebAdapter extends Construct {
    readonly lambda: Function;
    constructor(scope: Construct, id: string, props: LambdaWebAdapterProps);
}
export {};
