import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { BatchComputeEnvironment } from '../../modules/embedding/batch-compute';

/**
 * Batch Stack Configuration
 */
export interface BatchStackProps extends cdk.StackProps {
  /** プロジェクト名 */
  projectName: string;
  /** 環境名 */
  environment: string;
  /** VPC ID（既存VPCを使用） */
  vpcId?: string;
  /** 最小vCPU数 */
  minvCpus?: number;
  /** 最大vCPU数 */
  maxvCpus?: number;
  /** 希望vCPU数 */
  desiredvCpus?: number;
  /** コンテナイメージURI */
  containerImageUri?: string;
}

/**
 * AWS Batch Stack
 * 
 * SQLite Embedding処理用のBatch環境を構築
 * 
 * 主な機能:
 * - AWS Batch Compute Environment
 * - Job Queue
 * - Job Definition
 * - IAM Roles
 */
export class BatchStack extends cdk.Stack {
  public readonly batchEnvironment: BatchComputeEnvironment;

  constructor(scope: Construct, id: string, props: BatchStackProps) {
    super(scope, id, props);

    // 既存VPCの取得
    const vpc = props.vpcId
      ? ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: props.vpcId })
      : ec2.Vpc.fromLookup(this, 'Vpc', { isDefault: false });

    // セキュリティグループの作成
    const securityGroup = new ec2.SecurityGroup(this, 'BatchSecurityGroup', {
      vpc,
      securityGroupName: `${props.projectName}-${props.environment}-batch-sg`,
      description: 'Security group for AWS Batch compute environment',
      allowAllOutbound: true,
    });

    // Batch環境の作成
    this.batchEnvironment = new BatchComputeEnvironment(this, 'BatchEnvironment', {
      projectName: props.projectName,
      environment: props.environment,
      vpc,
      securityGroup,
      minvCpus: props.minvCpus,
      maxvCpus: props.maxvCpus,
      desiredvCpus: props.desiredvCpus,
      containerImageUri: props.containerImageUri,
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'StackName', {
      value: this.stackName,
      description: 'Batch Stack Name',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'VPC ID',
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: securityGroup.securityGroupId,
      description: 'Security Group ID',
    });
  }
}
