import { Construct } from 'constructs';
import { EnterpriseConfig } from '../interfaces/enterprise-config';
export interface EnterpriseConstructProps {
    config: EnterpriseConfig;
}
export declare class EnterpriseConstruct extends Construct {
    constructor(scope: Construct, id: string, props: EnterpriseConstructProps);
}
