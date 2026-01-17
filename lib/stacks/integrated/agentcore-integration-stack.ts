import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { AgentCoreIntegrationConfig } from '../../config/interfaces/environment-config';

export interface AgentCoreIntegrationStackProps extends cdk.StackProps {
  config: AgentCoreIntegrationConfig;
}

export class AgentCoreIntegrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AgentCoreIntegrationStackProps) {
    super(scope, id, props);

    console.log('🚧 AgentCoreIntegrationStack: Temporarily disabled for deployment');
    
    // Add a simple output to indicate the stack is disabled
    new cdk.CfnOutput(this, 'AgentCoreStatus', {
      value: 'Temporarily disabled',
      description: 'AgentCore integration status'
    });
  }
}
