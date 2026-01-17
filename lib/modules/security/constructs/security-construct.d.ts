import { Construct } from 'constructs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as guardduty from 'aws-cdk-lib/aws-guardduty';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import { SecurityConfig } from '../interfaces/security-config';
export interface SecurityConstructProps {
    config: SecurityConfig;
    projectName?: string;
    environment?: string;
    vpc?: any;
    privateSubnetIds?: string[];
    namingGenerator?: any;
}
export declare class SecurityConstruct extends Construct {
    readonly kmsKey: kms.Key;
    readonly wafWebAcl?: wafv2.CfnWebACL;
    readonly guardDutyDetector?: guardduty.CfnDetector;
    readonly cloudTrail?: cloudtrail.Trail;
    constructor(scope: Construct, id: string, props: SecurityConstructProps);
}
