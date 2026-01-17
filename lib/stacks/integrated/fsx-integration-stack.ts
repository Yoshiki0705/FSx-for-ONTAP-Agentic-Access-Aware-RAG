import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { EnvironmentConfig } from '../../config/interfaces/environment-config';

export interface FsxIntegrationStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpcId?: string;
  privateSubnetIds?: string[];
}

export class FsxIntegrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FsxIntegrationStackProps) {
    super(scope, id, props);

    console.log('🚧 FsxIntegrationStack: Temporarily disabled for deployment');
    
    // Add a simple output to indicate the stack is disabled
    new cdk.CfnOutput(this, 'FsxIntegrationStatus', {
      value: 'Temporarily disabled',
      description: 'FSx integration status'
    });
  }
}
