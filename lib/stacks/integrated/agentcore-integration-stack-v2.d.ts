import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { AgentCoreIntegrationConfig } from '../../config/interfaces/environment-config';
export interface AgentCoreIntegrationStackV2Props extends cdk.StackProps {
    config: AgentCoreIntegrationConfig;
}
export declare class AgentCoreIntegrationStackV2 extends cdk.Stack {
    constructor(scope: Construct, id: string, props: AgentCoreIntegrationStackV2Props);
}
