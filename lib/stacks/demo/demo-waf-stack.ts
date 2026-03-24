/**
 * DemoWafStack
 * 
 * CloudFront用WAFv2 WebACLをus-east-1に作成する。
 * CloudFrontスコープのWAFはus-east-1にデプロイする必要がある。
 * 
 * ルール構成:
 *   - レートリミット（3000 req/5min per IP）
 *   - AWS IP Reputation List
 *   - AWS Common Rule Set（OWASP準拠）
 *   - AWS Known Bad Inputs
 *   - AWS SQLi Rule Set
 *   - IPアドレス許可リスト（オプション）
 */

import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface DemoWafStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  /** 許可するIPアドレスのCIDRリスト（例: ['203.0.113.0/24']）。空の場合はIPフィルタなし */
  allowedIps?: string[];
}

export class DemoWafStack extends cdk.Stack {
  /** WAF WebACL ARN（CloudFrontに関連付ける） */
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: DemoWafStackProps) {
    super(scope, id, props);

    const { projectName, environment, allowedIps = [] } = props;
    const prefix = `${projectName}-${environment}`;

    // WAFルール定義
    const rules: wafv2.CfnWebACL.RuleProperty[] = [
      // 1. レートリミット
      {
        name: 'RateLimit',
        priority: 100,
        statement: {
          rateBasedStatement: { limit: 3000, aggregateKeyType: 'IP' },
        },
        action: { block: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${prefix}-rate-limit`,
        },
      },
      // 2. AWS IP Reputation List
      {
        name: 'AWSIPReputationList',
        priority: 200,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesAmazonIpReputationList',
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${prefix}-ip-reputation`,
        },
      },
      // 3. AWS Common Rule Set（OWASP Core Rule Set準拠）
      {
        name: 'AWSCommonRuleSet',
        priority: 300,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesCommonRuleSet',
            excludedRules: [
              { name: 'GenericRFI_BODY' },
              { name: 'SizeRestrictions_BODY' },
              { name: 'CrossSiteScripting_BODY' },
            ],
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${prefix}-common-rules`,
        },
      },
      // 4. AWS Known Bad Inputs
      {
        name: 'AWSKnownBadInputs',
        priority: 400,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${prefix}-known-bad-inputs`,
        },
      },
      // 5. AWS SQLi Rule Set
      {
        name: 'AWSSQLiRuleSet',
        priority: 500,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesSQLiRuleSet',
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${prefix}-sqli-rules`,
        },
      },
    ];

    // IPアドレス許可リストが指定されている場合、IPフィルタルールを追加
    if (allowedIps.length > 0) {
      const ipSet = new wafv2.CfnIPSet(this, 'AllowedIpSet', {
        name: `${prefix}-allowed-ips`,
        scope: 'CLOUDFRONT',
        ipAddressVersion: 'IPV4',
        addresses: allowedIps,
        description: 'Allowed IP addresses for CloudFront access',
      });

      rules.push({
        name: 'IPAllowList',
        priority: 600,
        statement: {
          notStatement: {
            statement: {
              ipSetReferenceStatement: { arn: ipSet.attrArn },
            },
          },
        },
        action: {
          block: {
            customResponse: {
              responseCode: 403,
              customResponseBodyKey: 'AccessDenied',
            },
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: `${prefix}-ip-allowlist`,
        },
      });
    }

    // WAF WebACL
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: `${prefix}-cloudfront-waf`,
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      customResponseBodies: {
        AccessDenied: {
          contentType: 'TEXT_HTML',
          content: '<div>Access denied</div>',
        },
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${prefix}-waf`,
        sampledRequestsEnabled: true,
      },
      rules,
    });

    this.webAclArn = webAcl.attrArn;

    // CloudFormation出力
    new cdk.CfnOutput(this, 'WebAclArn', {
      value: webAcl.attrArn,
      exportName: `${prefix}-WebAclArn`,
    });

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
  }
}
