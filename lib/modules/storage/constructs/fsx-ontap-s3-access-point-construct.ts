/**
 * FSx for ONTAP + S3 Access Points統合Construct
 * 
 * 目的:
 * - FSx for ONTAPボリュームへのS3 API経由アクセスを提供
 * - Lambda環境でのNFS/SMBマウント制限を解決
 * - Memory/Browser/Code Interpreter/Evaluations/Policy機能で共通使用
 * 
 * 機能:
 * - S3 Access Point作成
 * - VPCエンドポイント作成
 * - IAMポリシー設定
 * - Lambda関数へのアクセス権限付与
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * FSx for ONTAP + S3 Access Points Construct Props
 */
export interface FsxOntapS3AccessPointConstructProps {
  /**
   * FSx for ONTAPファイルシステムID
   */
  readonly fsxFileSystemId: string;
  
  /**
   * FSx for ONTAPボリュームパス
   * 例: '/memory-volume', '/browser-volume', '/code-interpreter-volume'
   */
  readonly volumePath: string;
  
  /**
   * 用途（機能名）
   * 例: 'memory', 'browser', 'code-interpreter', 'evaluations', 'policy'
   */
  readonly purpose: string;
  
  /**
   * VPC
   */
  readonly vpc: ec2.IVpc;
  
  /**
   * プライベートサブネット
   */
  readonly privateSubnets: ec2.ISubnet[];
  
  /**
   * プロジェクト名
   */
  readonly projectName: string;
  
  /**
   * 環境名
   */
  readonly environment: string;
  
  /**
   * KMSキー（オプション）
   */
  readonly kmsKey?: any;
}

/**
 * FSx for ONTAP + S3 Access Points Construct
 * 
 * このConstructは、FSx for ONTAPボリュームへのS3 API経由アクセスを提供します。
 * Lambda環境ではNFS/SMBマウントができないため、S3 Access Pointsを使用します。
 */
export class FsxOntapS3AccessPointConstruct extends Construct {
  /**
   * S3 Access Point ARN
   */
  public readonly accessPointArn: string;
  
  /**
   * S3 Access Point名
   */
  public readonly accessPointName: string;
  
  /**
   * VPCエンドポイント
   */
  public readonly vpcEndpoint: ec2.IVpcEndpoint;
  
  /**
   * IAMポリシー
   */
  public readonly accessPolicy: iam.PolicyStatement;
  
  constructor(scope: Construct, id: string, props: FsxOntapS3AccessPointConstructProps) {
    super(scope, id);
    
    // S3 Access Point名を生成
    this.accessPointName = `${props.projectName}-${props.environment}-${props.purpose}-access-point`;
    
    // VPCエンドポイント作成（S3 Gateway Endpoint）
    this.vpcEndpoint = new ec2.GatewayVpcEndpoint(this, 'S3VpcEndpoint', {
      vpc: props.vpc,
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [
        {
          subnets: props.privateSubnets,
        },
      ],
    });
    
    // S3 Access Point ARNを生成
    // 注意: 実際のS3 Access Pointは、FSx for ONTAPのS3 Access Points機能を使用して作成されます
    // ここでは、ARNのプレースホルダーを生成します
    // 実際のARNは、FSx for ONTAP管理コンソールまたはAWS CLIで取得する必要があります
    this.accessPointArn = `arn:aws:s3:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:accesspoint/${this.accessPointName}`;
    
    // IAMポリシーステートメント作成
    this.accessPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
        's3:GetObjectVersion',
        's3:GetObjectAttributes',
        's3:PutObjectAcl',
      ],
      resources: [
        this.accessPointArn,
        `${this.accessPointArn}/*`,
      ],
    });
    
    // CloudFormation出力
    new cdk.CfnOutput(this, 'AccessPointArn', {
      value: this.accessPointArn,
      description: `S3 Access Point ARN for ${props.purpose}`,
      exportName: `${props.projectName}-${props.environment}-${props.purpose}-AccessPointArn`,
    });
    
    new cdk.CfnOutput(this, 'AccessPointName', {
      value: this.accessPointName,
      description: `S3 Access Point Name for ${props.purpose}`,
      exportName: `${props.projectName}-${props.environment}-${props.purpose}-AccessPointName`,
    });
    
    new cdk.CfnOutput(this, 'VpcEndpointId', {
      value: this.vpcEndpoint.vpcEndpointId,
      description: `VPC Endpoint ID for S3 Access Point (${props.purpose})`,
      exportName: `${props.projectName}-${props.environment}-${props.purpose}-VpcEndpointId`,
    });
    
    // タグ付け
    cdk.Tags.of(this).add('Purpose', props.purpose);
    cdk.Tags.of(this).add('FsxFileSystemId', props.fsxFileSystemId);
    cdk.Tags.of(this).add('VolumePath', props.volumePath);
  }
  
  /**
   * Lambda関数にアクセス権限を付与
   * 
   * @param lambdaFunction Lambda関数
   */
  public grantReadWrite(lambdaFunction: lambda.IFunction): void {
    lambdaFunction.addToRolePolicy(this.accessPolicy);
  }
  
  /**
   * Lambda関数に読み取り専用権限を付与
   * 
   * @param lambdaFunction Lambda関数
   */
  public grantRead(lambdaFunction: lambda.IFunction): void {
    const readOnlyPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:ListBucket',
        's3:GetObjectVersion',
        's3:GetObjectAttributes',
      ],
      resources: [
        this.accessPointArn,
        `${this.accessPointArn}/*`,
      ],
    });
    
    lambdaFunction.addToRolePolicy(readOnlyPolicy);
  }
  
  /**
   * Lambda関数に書き込み専用権限を付与
   * 
   * @param lambdaFunction Lambda関数
   */
  public grantWrite(lambdaFunction: lambda.IFunction): void {
    const writeOnlyPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:PutObject',
        's3:DeleteObject',
        's3:PutObjectAcl',
      ],
      resources: [
        this.accessPointArn,
        `${this.accessPointArn}/*`,
      ],
    });
    
    lambdaFunction.addToRolePolicy(writeOnlyPolicy);
  }
}
