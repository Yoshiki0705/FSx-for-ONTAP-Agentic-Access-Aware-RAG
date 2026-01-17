import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { EnterpriseConfig } from '../interfaces/enterprise-config';

export interface EnterpriseConstructProps {
  config: EnterpriseConfig;
}

export class EnterpriseConstruct extends Construct {
  constructor(scope: Construct, id: string, props: EnterpriseConstructProps) {
    super(scope, id);
    // 最小限の実装 - 実際の機能は別途実装
    console.log('EnterpriseConstruct initialized (stub)');
  }
}
