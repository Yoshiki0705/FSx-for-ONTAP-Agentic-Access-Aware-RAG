import * as cdk from "aws-cdk-lib";
import { CfnWebACL, CfnWebACLAssociation, CfnWebACLAssociationProps } from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
export interface WafRule {
    name: string;
    rule: CfnWebACL.RuleProperty;
}
export declare class RegionalWaf extends Construct {
    readonly webAcl: CfnWebACL;
    constructor(scope: Construct, id: string, props: {
        webACLResourceArn?: string;
        extraRules?: Array<WafRule>;
        allowedIps: Array<string>;
    });
}
export declare class WAF extends CfnWebACL {
    constructor(scope: Construct, id: string, ipset: cdk.aws_wafv2.CfnIPSet | null, distScope: string, extraRules?: Array<WafRule>);
}
export declare class WebACLAssociation extends CfnWebACLAssociation {
    constructor(scope: Construct, id: string, props: CfnWebACLAssociationProps);
}
