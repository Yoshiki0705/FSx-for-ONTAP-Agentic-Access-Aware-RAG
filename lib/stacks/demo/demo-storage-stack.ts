/**
 * DemoStorageStack
 * 
 * FSx for ONTAP（SINGLE_AZ_1）とデータ同期用S3バケットを作成する。
 * cdk destroy --all で安全に削除可能（RemovalPolicy.DESTROY）。
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as fsx from 'aws-cdk-lib/aws-fsx';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DemoStorageStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.IVpc;
  privateSubnets: ec2.ISubnet[];
  fsxSg: ec2.ISecurityGroup;
}

export class DemoStorageStack extends cdk.Stack {
  /** FSx for ONTAP ファイルシステム */
  public readonly fileSystem: fsx.CfnFileSystem;
  /** データ同期用S3バケット */
  public readonly dataBucket: s3.Bucket;
  /** 権限キャッシュDynamoDBテーブル */
  public readonly permissionCacheTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DemoStorageStackProps) {
    super(scope, id, props);

    const { projectName, environment, vpc, privateSubnets, fsxSg } = props;
    const prefix = `${projectName}-${environment}`;

    // FSx for ONTAP（SINGLE_AZ_1）
    this.fileSystem = new fsx.CfnFileSystem(this, 'OntapFs', {
      fileSystemType: 'ONTAP',
      storageCapacity: 1024,
      subnetIds: [privateSubnets[0].subnetId],
      securityGroupIds: [fsxSg.securityGroupId],
      ontapConfiguration: {
        deploymentType: 'SINGLE_AZ_1',
        throughputCapacity: 128,
        automaticBackupRetentionDays: 0,
      },
      tags: [
        { key: 'Name', value: `${prefix}-ontap` },
        { key: 'Project', value: projectName },
        { key: 'Environment', value: environment },
      ],
    });

    // データ同期用S3バケット（Bedrock KBデータソース）
    this.dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: `${prefix}-kb-data-${cdk.Aws.ACCOUNT_ID}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
    });

    // 権限キャッシュDynamoDBテーブル（TTL: 5分）
    this.permissionCacheTable = new dynamodb.Table(this, 'PermissionCacheTable', {
      tableName: `${prefix}-permission-cache`,
      partitionKey: { name: 'cacheKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    // CloudFormation出力
    new cdk.CfnOutput(this, 'FileSystemId', {
      value: this.fileSystem.ref,
      exportName: `${prefix}-FileSystemId`,
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: this.dataBucket.bucketName,
      exportName: `${prefix}-DataBucketName`,
    });

    new cdk.CfnOutput(this, 'DataBucketArn', {
      value: this.dataBucket.bucketArn,
      exportName: `${prefix}-DataBucketArn`,
    });

    new cdk.CfnOutput(this, 'PermissionCacheTableName', {
      value: this.permissionCacheTable.tableName,
      exportName: `${prefix}-PermissionCacheTableName`,
    });

    cdk.Tags.of(this).add('Project', projectName);
    cdk.Tags.of(this).add('Environment', environment);
  }
}
