import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { AgentCoreIntegrationConfig } from '../../config/interfaces/environment-config';

export interface AgentCoreIntegrationStackV2Props extends cdk.StackProps {
  config: AgentCoreIntegrationConfig;
}

export class AgentCoreIntegrationStackV2 extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AgentCoreIntegrationStackV2Props) {
    super(scope, id, props);

    console.log('🚧 AgentCoreIntegrationStackV2: Temporarily disabled for deployment');
    
    // Add a simple output to indicate the stack is disabled
    new cdk.CfnOutput(this, 'AgentCoreV2Status', {
      value: 'Temporarily disabled',
      description: 'AgentCore V2 integration status'
    });
  }
}
