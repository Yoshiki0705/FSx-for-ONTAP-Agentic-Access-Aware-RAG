import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { EnvironmentConfig } from '../../config/interfaces/environment-config';
export interface FsxIntegrationStackProps extends cdk.StackProps {
    config: EnvironmentConfig;
    vpcId?: string;
    privateSubnetIds?: string[];
}
export declare class FsxIntegrationStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: FsxIntegrationStackProps);
}
