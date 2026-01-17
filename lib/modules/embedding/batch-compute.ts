import * as cdk from 'aws-cdk-lib';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * AWS Batch環境の設定
 */
export interface BatchComputeConfig {
  /** プロジェクト名 */
  projectName: string;
  /** 環境名 */
  environment: string;
  /** VPC */
  vpc: ec2.IVpc;
  /** セキュリティグループ */
  securityGroup: ec2.ISecurityGroup;
  /** サブネットID（明示的指定） */
  subnetIds?: string[];
  /** 最小vCPU数 */
  minvCpus?: number;
  /** 最大vCPU数 */
  maxvCpus?: number;
  /** 希望vCPU数 */
  desiredvCpus?: number;
  /** インスタンスタイプ */
  instanceTypes?: ec2.InstanceType[];
  /** コンテナイメージURI */
  containerImageUri?: string;
}

/**
 * AWS Batch Compute Environment Construct
 * 
 * SQLite Embedding処理用のBatch環境を構築
 */
export class BatchComputeEnvironment extends Construct {
  public readonly computeEnvironment: batch.CfnComputeEnvironment;
  public readonly jobQueue: batch.CfnJobQueue;
  public readonly jobDefinition: batch.CfnJobDefinition;
  public readonly batchServiceRole: iam.Role;
  public readonly instanceRole: iam.Role;

  constructor(scope: Construct, id: string, config: BatchComputeConfig) {
    super(scope, id);

    // デフォルト値
    const minvCpus = config.minvCpus ?? 0;
    const maxvCpus = config.maxvCpus ?? 10;
    const desiredvCpus = config.desiredvCpus ?? 0;
    const instanceTypes = config.instanceTypes ?? [
      ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
      ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.XLARGE),
    ];

    // Batch Service Role
    this.batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
      roleName: `${config.projectName}-${config.environment}-batch-service-role`,
      assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
      ],
    });

    // EC2 Instance Role
    this.instanceRole = new iam.Role(this, 'InstanceRole', {
      roleName: `${config.projectName}-${config.environment}-batch-instance-role`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('ec2.amazonaws.com'),
        new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'),
      ],
    });

    // Bedrockアクセス権限を追加
    this.instanceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: ['*'],
    }));

    // Instance Profile
    const instanceProfile = new iam.CfnInstanceProfile(this, 'InstanceProfile', {
      instanceProfileName: `${config.projectName}-${config.environment}-batch-instance-profile`,
      roles: [this.instanceRole.roleName],
    });

    // サブネットの決定（明示的指定がある場合はそれを使用、なければVPCから取得）
    const subnets = config.subnetIds ?? config.vpc.privateSubnets.map(subnet => subnet.subnetId);

    // Compute Environment
    this.computeEnvironment = new batch.CfnComputeEnvironment(this, 'ComputeEnvironment', {
      computeEnvironmentName: `${config.projectName}-${config.environment}-batch-compute-env`,
      type: 'MANAGED',
      state: 'ENABLED',
      serviceRole: this.batchServiceRole.roleArn,
      computeResources: {
        type: 'EC2',
        minvCpus,
        maxvCpus,
        desiredvCpus,
        instanceTypes: instanceTypes.map(t => t.toString()),
        subnets,
        securityGroupIds: [config.securityGroup.securityGroupId],
        instanceRole: instanceProfile.attrArn,
      },
    });

    // Job Queue
    this.jobQueue = new batch.CfnJobQueue(this, 'JobQueue', {
      jobQueueName: `${config.projectName}-${config.environment}-batch-job-queue`,
      state: 'ENABLED',
      priority: 1,
      computeEnvironmentOrder: [{
        order: 1,
        computeEnvironment: this.computeEnvironment.ref,
      }],
    });

    // Job Definition
    this.jobDefinition = new batch.CfnJobDefinition(this, 'JobDefinition', {
      jobDefinitionName: `${config.projectName}-${config.environment}-batch-job-definition`,
      type: 'container',
      containerProperties: {
        image: config.containerImageUri ?? 'amazonlinux:2',
        vcpus: 1,
        memory: 2048,
        jobRoleArn: this.instanceRole.roleArn,
        command: ['echo', 'Hello from Batch job'],
        environment: [
          {
            name: 'BEDROCK_MODEL_ID',
            value: 'us.amazon.nova-pro-v1:0',
          },
          {
            name: 'BEDROCK_REGION',
            value: 'us-east-1',
          },
        ],
      },
    });

    // 依存関係の設定
    this.jobQueue.addDependency(this.computeEnvironment);
    this.jobDefinition.addDependency(this.jobQueue);

    // タグの追加
    cdk.Tags.of(this).add('Project', config.projectName);
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('Component', 'Batch');

    // Outputs
    new cdk.CfnOutput(this, 'ComputeEnvironmentName', {
      value: this.computeEnvironment.computeEnvironmentName!,
      description: 'Batch Compute Environment Name',
    });

    new cdk.CfnOutput(this, 'JobQueueName', {
      value: this.jobQueue.jobQueueName!,
      description: 'Batch Job Queue Name',
    });

    new cdk.CfnOutput(this, 'JobDefinitionArn', {
      value: this.jobDefinition.ref,
      description: 'Batch Job Definition ARN',
    });
  }
}
