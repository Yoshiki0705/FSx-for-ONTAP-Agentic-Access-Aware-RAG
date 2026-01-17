import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as guardduty from 'aws-cdk-lib/aws-guardduty';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as iam from 'aws-cdk-lib/aws-iam';
import { SecurityConfig } from '../interfaces/security-config';

export interface SecurityConstructProps {
  config: SecurityConfig;
  projectName?: string;
  environment?: string;
  vpc?: any;
  privateSubnetIds?: string[];
  namingGenerator?: any;
}

export class SecurityConstruct extends Construct {
  public readonly kmsKey: kms.Key;
  public readonly wafWebAcl?: wafv2.CfnWebACL;
  public readonly guardDutyDetector?: guardduty.CfnDetector;
  public readonly cloudTrail?: cloudtrail.Trail;

  constructor(scope: Construct, id: string, props: SecurityConstructProps) {
    super(scope, id);
    
    const { config, projectName, environment } = props;
    
    // KMSキー作成（必須）
    this.kmsKey = new kms.Key(this, 'KmsKey', {
      enableKeyRotation: config.kms.keyRotation,
      description: `KMS key for ${projectName || 'permission-aware-rag'} ${environment || 'prod'}`,
      alias: config.kms.alias,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pendingWindow: cdk.Duration.days(config.kms.pendingWindow || 30)
    });
    
    // WAF WebACL作成（オプション）
    if (config.waf.enabled) {
      this.wafWebAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
        scope: 'REGIONAL',
        defaultAction: { allow: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `${projectName || 'rag'}-waf-metrics`,
          sampledRequestsEnabled: true
        },
        rules: [
          {
            name: 'AWS-AWSManagedRulesCommonRuleSet',
            priority: 1,
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesCommonRuleSet'
              }
            },
            overrideAction: { none: {} },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'AWSManagedRulesCommonRuleSetMetric',
              sampledRequestsEnabled: true
            }
          },
          {
            name: 'RateLimitRule',
            priority: 2,
            statement: {
              rateBasedStatement: {
                limit: 2000,
                aggregateKeyType: 'IP'
              }
            },
            action: { block: {} },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'RateLimitRuleMetric',
              sampledRequestsEnabled: true
            }
          }
        ]
      });
    }
    
    // GuardDuty Detector作成（オプション）
    // 注: GuardDutyは既にアカウントレベルで有効化されているため、
    // 新しいDetectorを作成せず、既存のDetectorを使用します。
    // AWSアカウントには1つのGuardDuty Detectorしか存在できません。
    // 既存Detector ID: febec3337a92143ed91b9956114465c9
    /*
    if (config.guardDuty.enabled) {
      this.guardDutyDetector = new guardduty.CfnDetector(this, 'GuardDutyDetector', {
        enable: true,
        findingPublishingFrequency: config.guardDuty.findingPublishingFrequency
      });
    }
    */
    
    console.log('SecurityConstruct initialized (complete)');
  }
}
