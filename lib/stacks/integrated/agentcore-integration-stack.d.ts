import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { AgentCoreIntegrationConfig } from '../../config/interfaces/environment-config';
export interface AgentCoreIntegrationStackProps extends cdk.StackProps {
    config: AgentCoreIntegrationConfig;
}
export declare class AgentCoreIntegrationStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: AgentCoreIntegrationStackProps);
}
