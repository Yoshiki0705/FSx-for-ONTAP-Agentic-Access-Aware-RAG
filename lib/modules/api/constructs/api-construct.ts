import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { ApiConfig } from '../interfaces/api-config';

export interface ApiConstructProps {
  config: ApiConfig;
}

export class ApiConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);
    // 最小限の実装 - 実際の機能は別途実装
    console.log('ApiConstruct initialized (stub)');
  }
}
