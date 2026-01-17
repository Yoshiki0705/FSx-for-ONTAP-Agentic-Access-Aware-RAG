/**
 * セキュリティリソースファクトリー
 * 
 * セキュリティリソースの作成を抽象化し、テスト容易性を向上させます
 */

import * as kms from 'aws-cdk-lib/aws-kms';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { SecurityConfig } from '../interfaces/security-config';

/**
 * セキュリティリソースファクトリーインターフェース
 */
export interface ISecurityResourceFactory {
  createKmsKey(scope: Construct, id: string, config: SecurityConfig['kms'], projectName: string, environment: string): kms.Key;
  createWafWebAcl(scope: Construct, id: string, config: SecurityConfig['waf'], projectName: string, environment: string): wafv2.CfnWebACL;
  createCloudTrailBucket(scope: Construct, id: string, bucketName: string, kmsKey: kms.Key, environment: string): s3.Bucket;
}

/**
 * デフォルトセキュリティリソースファクトリー
 */
export class DefaultSecurityResourceFactory implements ISecurityResourceFactory {
  createKmsKey(scope: Construct, id: string, config: SecurityConfig['kms'], projectName: string, environment: string): kms.Key {
    // KMS Key作成ロジック（元のcreateKmsKeyメソッドから移動）
    throw new Error('実装が必要です');
  }

  createWafWebAcl(scope: Construct, id: string, config: SecurityConfig['waf'], projectName: string, environment: string): wafv2.CfnWebACL {
    // WAF WebACL作成ロジック（元のcreateWafWebAclメソッドから移動）
    throw new Error('実装が必要です');
  }

  createCloudTrailBucket(scope: Construct, id: string, bucketName: string, kmsKey: kms.Key, environment: string): s3.Bucket {
    // CloudTrail S3バケット作成ロジック（元のcreateCloudTrailメソッドから移動）
    throw new Error('実装が必要です');
  }
}