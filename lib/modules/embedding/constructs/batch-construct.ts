/**
 * AWS Batch Construct
 * 
 * Agent Steeringルール準拠:
 * - モジュラーアーキテクチャ強制（lib/modules/compute/constructs/）
 * - 単一障害点排除とメンテナンス負荷軽減を最重要視
 * - Multi-AZ 構成でのマネージド EC2 環境
 * 
 * Requirements: 1.1, 1.2, 1.3, 5.1
 */

import * as cdk from 'aws-cdk-lib';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import { EmbeddingBatchConfig, EmbeddingJobDefinitionConfig, EmbeddingFsxIntegrationConfig, EmbeddingActiveDirectoryConfig, EmbeddingBedrockConfig, EmbeddingOpenSearchIntegrationConfig, EmbeddingRdsConfig } from '../interfaces/embedding-config';
import { EmbeddingModuleInterface, EmbeddingCommonResources } from '../interfaces/module-interfaces';

export interface BatchConstructProps {
  /** Batch設定 */
  readonly config: EmbeddingBatchConfig;
  
  /** Job Definition設定 */
  readonly jobDefinitionConfig: EmbeddingJobDefinitionConfig;
  
  /** FSx統合設定 */
  readonly fsxIntegrationConfig: EmbeddingFsxIntegrationConfig;
  
  /** Active Directory設定 */
  readonly activeDirectoryConfig: EmbeddingActiveDirectoryConfig;
  
  /** Bedrock設定 */
  readonly bedrockConfig: EmbeddingBedrockConfig;
  
  /** OpenSearch設定 */
  readonly openSearchConfig: EmbeddingOpenSearchIntegrationConfig;
  
  /** RDS設定（オプション） */
  readonly rdsConfig?: EmbeddingRdsConfig;
  
  /** ECRイメージパス */
  readonly imagePath: string;
  
  /** イメージタグ */
  readonly imageTag: string;
  
  /** プロジェクト名 */
  readonly projectName: string;
  
  /** 環境名 */
  readonly environment: string;
  
  /** 共通リソース */
  readonly commonResources: EmbeddingCommonResources;
  
  /** 統一命名規則ジェネレーター */
  readonly namingGenerator?: any;
}

/**
 * AWS Batch Construct
 * 
 * 機能:
 * - Multi-AZ構成でのマネージドEC2環境
 * - 自動スケーリング設定（minvCpus: 0, maxvCpus: 1000）
 * - インスタンスタイプ設定（m5.large, m5.xlarge）
 * - FSx for NetApp ONTAP統合
 */
export class BatchConstruct extends Construct implements EmbeddingModuleInterface {
  /** モジュール名 */
  public readonly moduleName = 'AWS_BATCH';
  
  /** モジュール有効化状態 */
  public readonly enabled: boolean;
  
  /** 共通リソース参照 */
  public readonly commonResources: EmbeddingCommonResources;
  
  /** Batchコンピュート環境 */
  public readonly computeEnvironment: batch.CfnComputeEnvironment;
  
  /** Batchジョブ定義 */
  public readonly jobDefinition: batch.CfnJobDefinition;
  
  /** Batchジョブキュー */
  public readonly jobQueue: batch.CfnJobQueue;
  
  /** 起動テンプレート */
  public readonly launchTemplate: ec2.LaunchTemplate;
  
  /** サービスロール */
  public readonly serviceRole: iam.Role;
  
  /** インスタンスロール */
  public readonly instanceRole: iam.Role;
  
  /** ジョブロール */
  public readonly jobRole: iam.Role;
  
  /** ロググループ */
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: BatchConstructProps) {
    super(scope, id);

    this.enabled = props.config.enabled;
    this.commonResources = props.commonResources;

    if (!this.enabled) {
      return;
    }

    // ロググループ作成
    this.logGroup = this.createLogGroup(props);

    // IAMロール作成
    this.serviceRole = this.createServiceRole(props);
    this.instanceRole = this.createInstanceRole(props);
    this.jobRole = this.createJobRole(props);

    // 起動テンプレート作成
    this.launchTemplate = this.createLaunchTemplate(props);

    // コンピュート環境作成
    this.computeEnvironment = this.createComputeEnvironment(props);

    // ジョブ定義作成
    this.jobDefinition = this.createJobDefinition(props);

    // ジョブキュー作成
    this.jobQueue = this.createJobQueue(props);

    // タグ設定
    this.applyTags(props);
  }

  /**
   * ロググループ作成
   */
  private createLogGroup(props: BatchConstructProps): logs.LogGroup {
    const logGroupName = `/aws/batch/${props.config.computeEnvironment.namePrefix}`;
    
    return new logs.LogGroup(this, 'BatchLogGroup', {
      logGroupName,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  /**
   * Batchサービスロール作成
   */
  private createServiceRole(props: BatchConstructProps): iam.Role {
    const role = new iam.Role(this, 'BatchServiceRole', {
      roleName: `${props.config.computeEnvironment.namePrefix}-service-role`,
      assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
      ],
    });

    // 追加権限: ECS管理
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecs:CreateCluster',
        'ecs:DeregisterContainerInstance',
        'ecs:DescribeClusters',
        'ecs:DescribeContainerInstances',
        'ecs:DescribeTaskDefinition',
        'ecs:DescribeTasks',
        'ecs:ListClusters',
        'ecs:ListContainerInstances',
        'ecs:ListTaskDefinitionFamilies',
        'ecs:ListTaskDefinitions',
        'ecs:ListTasks',
        'ecs:RegisterTaskDefinition',
        'ecs:RunTask',
        'ecs:StartTask',
        'ecs:StopTask',
        'ecs:SubmitContainerStateChange',
        'ecs:SubmitTaskStateChange',
      ],
      resources: ['*'],
    }));

    return role;
  }

  /**
   * Batchインスタンスロール作成
   */
  private createInstanceRole(props: BatchConstructProps): iam.Role {
    const role = new iam.Role(this, 'BatchInstanceRole', {
      roleName: `${props.config.computeEnvironment.namePrefix}-instance-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'),
      ],
    });

    // FSx for NetApp ONTAPアクセス権限
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'fsx:DescribeFileSystems',
        'fsx:DescribeVolumes',
        'fsx:DescribeSnapshots',
      ],
      resources: [
        `arn:aws:fsx:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:file-system/${props.config.jobDefinition.fsxMount.fileSystemId}`,
      ],
    }));

    // CloudWatch Logs権限
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogStreams',
      ],
      resources: [this.logGroup.logGroupArn],
    }));

    return role;
  }

  /**
   * Batchジョブロール作成
   */
  private createJobRole(props: BatchConstructProps): iam.Role {
    const role = new iam.Role(this, 'BatchJobRole', {
      roleName: `${props.config.jobDefinition.namePrefix}-job-role`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // OpenSearch Serverlessアクセス権限
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:APIAccessAll',
      ],
      resources: ['*'], // OpenSearch Serverlessコレクション
    }));

    // FSxアクセス権限
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'fsx:DescribeFileSystems',
        'fsx:DescribeVolumes',
      ],
      resources: [
        `arn:aws:fsx:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:file-system/${props.config.jobDefinition.fsxMount.fileSystemId}`,
      ],
    }));

    // CloudWatch Logs権限
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [this.logGroup.logGroupArn],
    }));

    // Bedrock権限
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:GetFoundationModel',
        'bedrock:InvokeModel',
      ],
      resources: [
        `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/*`,
        'arn:aws:bedrock:us-east-1::foundation-model/*',
      ],
    }));

    // ECR権限
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:BatchGetImage',
        'ecr:GetDownloadUrlForLayer',
        'ecr:GetAuthorizationToken',
      ],
      resources: ['*'],
    }));

    // Secrets Manager権限
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: ['*'], // Active Directory パスワードシークレット
    }));

    return role;
  }

  /**
   * 起動テンプレート作成
   */
  private createLaunchTemplate(props: BatchConstructProps): ec2.LaunchTemplate {
    // FSxマウント用のUserDataスクリプト
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'yum update -y',
      '',
      '# FSx for NetApp ONTAPマウント設定',
      `FSX_FILE_SYSTEM_ID="${props.config.jobDefinition.fsxMount.fileSystemId}"`,
      `MOUNT_POINT="${props.config.jobDefinition.fsxMount.mountPoint}"`,
      'FSX_DNS_NAME="${FSX_FILE_SYSTEM_ID}.fsx.${AWS_DEFAULT_REGION}.amazonaws.com"',
      '',
      'mkdir -p ${MOUNT_POINT}',
      '',
      '# SMB/CIFSマウント（読み取り専用）',
      'if [ "${props.config.jobDefinition.fsxMount.readOnly}" = "true" ]; then',
      '  mount -t cifs //${FSX_DNS_NAME}/share ${MOUNT_POINT} -o ro,guest,uid=1000,gid=1000,iocharset=utf8',
      'else',
      '  mount -t cifs //${FSX_DNS_NAME}/share ${MOUNT_POINT} -o guest,uid=1000,gid=1000,iocharset=utf8',
      'fi',
      '',
      '# マウント確認',
      'if mountpoint -q ${MOUNT_POINT}; then',
      '  echo "FSx mount successful: ${MOUNT_POINT}"',
      'else',
      '  echo "FSx mount failed: ${MOUNT_POINT}"',
      '  exit 1',
      'fi',
      '',
      '# ECS Agentの設定',
      'echo ECS_CLUSTER=${props.config.computeEnvironment.namePrefix}-cluster >> /etc/ecs/ecs.config',
      'echo ECS_ENABLE_LOGGING=true >> /etc/ecs/ecs.config',
      `echo ECS_LOG_LEVEL=info >> /etc/ecs/ecs.config`,
      '',
      '# CloudWatch Agentインストール・設定',
      'wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm',
      'rpm -U ./amazon-cloudwatch-agent.rpm',
      '',
      '# ECS Agentの起動',
      'start ecs',
    );

    return new ec2.LaunchTemplate(this, 'BatchLaunchTemplate', {
      launchTemplateName: `${props.config.computeEnvironment.namePrefix}-lt`,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      userData,
      role: this.instanceRole,
      securityGroup: this.commonResources.securityGroups.commonSecurityGroup,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(30, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });
  }

  /**
   * Batchコンピュート環境作成
   */
  private createComputeEnvironment(props: BatchConstructProps): batch.CfnComputeEnvironment {
    const computeEnvironment = new batch.CfnComputeEnvironment(this, 'BatchComputeEnvironment', {
      computeEnvironmentName: `${props.config.computeEnvironment.namePrefix}-env`,
      type: props.config.computeEnvironment.type,
      state: 'ENABLED',
      serviceRole: this.serviceRole.roleArn,
      computeResources: {
        type: props.config.computeEnvironment.useSpotInstances ? 'EC2' : 'EC2',
        minvCpus: props.config.computeEnvironment.minvCpus,
        maxvCpus: props.config.computeEnvironment.maxvCpus,
        desiredvCpus: props.config.computeEnvironment.desiredvCpus || 0,
        instanceTypes: props.config.computeEnvironment.instanceTypes,
        
        // Multi-AZ配置のためのサブネット設定
        subnets: this.commonResources.vpc.privateSubnets.map(subnet => subnet.subnetId),
        
        // セキュリティグループ設定
        securityGroupIds: [this.commonResources.securityGroups.commonSecurityGroup.securityGroupId],
        
        // インスタンスロール設定
        instanceRole: `arn:aws:iam::${cdk.Stack.of(this).account}:instance-profile/${this.instanceRole.roleName}`,
        
        // 起動テンプレート設定
        launchTemplate: {
          launchTemplateId: this.launchTemplate.launchTemplateId,
          version: '$Latest',
        },
        
        // スポットインスタンス設定
        ...(props.config.computeEnvironment.useSpotInstances && {
          spotIamFleetRequestRole: `arn:aws:iam::${cdk.Stack.of(this).account}:role/aws-ec2-spot-fleet-tagging-role`,
          bidPercentage: props.config.computeEnvironment.spotBidPercentage,
        }),
        
        // タグ設定
        tags: {
          Name: `${props.config.computeEnvironment.namePrefix}-instance`,
          Project: props.projectName,
          Environment: props.environment,
          Component: 'Embedding',
          Module: 'AWS_BATCH',
          ManagedBy: 'CDK',
        },
      },
    });

    // インスタンスプロファイル作成
    new iam.CfnInstanceProfile(this, 'BatchInstanceProfile', {
      instanceProfileName: this.instanceRole.roleName,
      roles: [this.instanceRole.roleName],
    });

    return computeEnvironment;
  }

  /**
   * Batchジョブ定義作成
   */
  private createJobDefinition(props: BatchConstructProps): batch.CfnJobDefinition {
    // 環境変数設定
    const environment = this.createJobEnvironmentVariables(props);

    return new batch.CfnJobDefinition(this, 'BatchJobDefinition', {
      jobDefinitionName: props.jobDefinitionConfig.jobDefinitionName,
      type: 'container',
      platformCapabilities: props.jobDefinitionConfig.platformCapabilities,
      containerProperties: {
        image: `${cdk.Stack.of(this).account}.dkr.ecr.${cdk.Stack.of(this).region}.amazonaws.com/${props.imagePath}/embed:${props.imageTag}`,
        vcpus: props.jobDefinitionConfig.cpu,
        memory: props.jobDefinitionConfig.memoryMiB,
        jobRoleArn: this.jobRole.roleArn,
        
        // 環境変数設定
        environment: Object.entries(environment).map(([name, value]) => ({
          name,
          value,
        })),
        
        // FSxマウントポイント設定
        mountPoints: [
          {
            sourceVolume: 'fsx-data-volume',
            containerPath: '/opt/netapp/ai/data',
            readOnly: false,
          },
          {
            sourceVolume: 'fsx-db-volume',
            containerPath: '/opt/netapp/ai/db',
            readOnly: false,
          },
        ],
        
        // ボリューム設定
        volumes: [
          {
            name: 'fsx-data-volume',
            host: {
              sourcePath: '/mnt/fsx/data',
            },
          },
          {
            name: 'fsx-db-volume',
            host: {
              sourcePath: '/mnt/fsx/db',
            },
          },
        ],
        
        // ログ設定
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': this.logGroup.logGroupName,
            'awslogs-region': cdk.Stack.of(this).region,
            'awslogs-stream-prefix': 'embedding-job',
          },
        },
        
        // リソース要件
        resourceRequirements: [
          {
            type: 'VCPU',
            value: props.jobDefinitionConfig.cpu.toString(),
          },
          {
            type: 'MEMORY',
            value: props.jobDefinitionConfig.memoryMiB.toString(),
          },
        ],
        
        // セキュリティ設定
        readonlyRootFilesystem: false, // FSxマウントのため読み書き可能
        privileged: false,
        user: 'root', // FSxマウントのため
      },
      
      // タイムアウト設定
      timeout: {
        attemptDurationSeconds: props.jobDefinitionConfig.timeoutHours * 3600,
      },
      
      // 再試行戦略
      retryStrategy: {
        attempts: props.jobDefinitionConfig.retryAttempts,
      },
    });
  }

  /**
   * Job環境変数作成
   */
  private createJobEnvironmentVariables(props: BatchConstructProps): Record<string, string> {
    const baseEnvironment: Record<string, string> = {
      ENV_REGION: cdk.Stack.of(this).region,
      AWS_DEFAULT_REGION: cdk.Stack.of(this).region,
      // FSx設定
      FSX_ID: props.fsxIntegrationConfig.fileSystemId || "fs-default",
      SVM_REF: props.fsxIntegrationConfig.svmRef || "svm-default",
      SVM_ID: props.fsxIntegrationConfig.svmId || "svm-default-id",
      CIFSDATA_VOL_NAME: props.fsxIntegrationConfig.cifsdataVolName || "smb_share",
      RAGDB_VOL_PATH: props.fsxIntegrationConfig.ragdbVolPath || "/smb_share/ragdb",
      // Active Directory設定
      AD_DOMAIN: props.activeDirectoryConfig.domain,
      AD_USERNAME: props.activeDirectoryConfig.username,
      // Bedrock設定
      BEDROCK_REGION: props.bedrockConfig.region || cdk.Stack.of(this).region,
      BEDROCK_MODEL_ID: props.bedrockConfig.modelId,
    };

    // OpenSearch Serverless設定
    if (props.openSearchConfig.collectionName) {
      baseEnvironment.ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME = 
        props.openSearchConfig.collectionName;
    }

    // RDS設定（OpenSearchの代替）
    if (props.rdsConfig?.secretName) {
      baseEnvironment.ENV_RDS_SECRETS_NAME = props.rdsConfig.secretName;
      baseEnvironment.ENV_SECRETS_ARN = props.rdsConfig.secretArn;
      baseEnvironment.ENV_RDS_ARN = props.rdsConfig.clusterArn;
    }

    return baseEnvironment;
  }

  /**
   * Batchジョブキュー作成
   */
  private createJobQueue(props: BatchConstructProps): batch.CfnJobQueue {
    const jobQueue = new batch.CfnJobQueue(this, 'BatchJobQueue', {
      jobQueueName: `${props.config.jobQueue.namePrefix}-queue`,
      state: props.config.jobQueue.state,
      priority: props.config.jobQueue.priority,
      computeEnvironmentOrder: [
        {
          order: 1,
          computeEnvironment: this.computeEnvironment.ref,
        },
      ],
      tags: {
        Name: `${props.config.jobQueue.namePrefix}-queue`,
        Project: props.projectName,
        Environment: props.environment,
        Component: 'Embedding',
        Module: 'AWS_BATCH',
        ManagedBy: 'CDK',
        AutoScaling: props.config.autoScaling.enabled.toString(),
      },
    });

    // 自動スケーリング設定
    if (props.config.autoScaling.enabled) {
      this.configureJobQueueAutoScaling(props, jobQueue);
    }

    // 自動復旧機能設定
    this.configureJobQueueAutoRecovery(props, jobQueue);

    return jobQueue;
  }

  /**
   * Job Queue自動スケーリング設定
   */
  private configureJobQueueAutoScaling(props: BatchConstructProps, jobQueue: batch.CfnJobQueue): void {
    // CloudWatchメトリクス作成
    const queueSizeMetric = new cdk.aws_cloudwatch.Metric({
      namespace: 'AWS/Batch',
      metricName: 'SubmittedJobs',
      dimensionsMap: {
        JobQueue: jobQueue.jobQueueName!,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const runningJobsMetric = new cdk.aws_cloudwatch.Metric({
      namespace: 'AWS/Batch',
      metricName: 'RunnableJobs',
      dimensionsMap: {
        JobQueue: jobQueue.jobQueueName!,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // スケールアウトアラーム
    const scaleOutAlarm = new cdk.aws_cloudwatch.Alarm(this, 'BatchScaleOutAlarm', {
      alarmName: `${props.config.jobQueue.namePrefix}-scale-out`,
      alarmDescription: 'Batch Job Queue scale out alarm',
      metric: queueSizeMetric,
      threshold: 5, // キューに5つ以上のジョブがある場合
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // スケールインアラーム
    const scaleInAlarm = new cdk.aws_cloudwatch.Alarm(this, 'BatchScaleInAlarm', {
      alarmName: `${props.config.jobQueue.namePrefix}-scale-in`,
      alarmDescription: 'Batch Job Queue scale in alarm',
      metric: runningJobsMetric,
      threshold: 1, // 実行中のジョブが1つ以下の場合
      evaluationPeriods: 3,
      datapointsToAlarm: 3,
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.BREACHING,
    });

    // Lambda関数でスケーリング処理
    const scalingFunction = new cdk.aws_lambda.Function(this, 'BatchScalingFunction', {
      functionName: `${props.config.jobQueue.namePrefix}-scaling`,
      runtime: cdk.aws_lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: cdk.aws_lambda.Code.fromInline(`
import boto3
import json
import os

def handler(event, context):
    batch_client = boto3.client('batch')
    compute_env_name = os.environ['COMPUTE_ENVIRONMENT_NAME']
    
    # CloudWatchアラームからの通知を処理
    message = json.loads(event['Records'][0]['Sns']['Message'])
    alarm_name = message['AlarmName']
    new_state = message['NewStateValue']
    
    if 'scale-out' in alarm_name and new_state == 'ALARM':
        # スケールアウト処理
        response = batch_client.update_compute_environment(
            computeEnvironment=compute_env_name,
            computeResources={
                'desiredvCpus': min(
                    int(os.environ.get('MAX_VCPUS', '1000')),
                    int(os.environ.get('CURRENT_VCPUS', '0')) + 100
                )
            }
        )
        print(f"Scaled out: {response}")
        
    elif 'scale-in' in alarm_name and new_state == 'ALARM':
        # スケールイン処理
        response = batch_client.update_compute_environment(
            computeEnvironment=compute_env_name,
            computeResources={
                'desiredvCpus': max(
                    int(os.environ.get('MIN_VCPUS', '0')),
                    int(os.environ.get('CURRENT_VCPUS', '0')) - 50
                )
            }
        )
        print(f"Scaled in: {response}")
    
    return {
        'statusCode': 200,
        'body': json.dumps('Scaling completed')
    }
      `),
      environment: {
        COMPUTE_ENVIRONMENT_NAME: this.computeEnvironment.computeEnvironmentName!,
        MAX_VCPUS: props.config.computeEnvironment.maxvCpus.toString(),
        MIN_VCPUS: props.config.computeEnvironment.minvCpus.toString(),
      },
      timeout: cdk.Duration.minutes(5),
    });

    // Lambda実行権限
    scalingFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'batch:UpdateComputeEnvironment',
        'batch:DescribeComputeEnvironments',
      ],
      resources: [this.computeEnvironment.attrComputeEnvironmentArn],
    }));

    // SNSトピック作成
    const scalingTopic = new cdk.aws_sns.Topic(this, 'BatchScalingTopic', {
      topicName: `${props.config.jobQueue.namePrefix}-scaling-topic`,
      displayName: 'Batch Auto Scaling Notifications',
    });

    // Lambda関数をSNSトピックにサブスクライブ
    scalingTopic.addSubscription(new cdk.aws_sns_subscriptions.LambdaSubscription(scalingFunction));

    // アラームをSNSトピックに接続
    scaleOutAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(scalingTopic));
    scaleInAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(scalingTopic));
  }

  /**
   * Job Queue自動復旧機能設定
   */
  private configureJobQueueAutoRecovery(props: BatchConstructProps, jobQueue: batch.CfnJobQueue): void {
    // 失敗ジョブ監視メトリクス
    const failedJobsMetric = new cdk.aws_cloudwatch.Metric({
      namespace: 'AWS/Batch',
      metricName: 'FailedJobs',
      dimensionsMap: {
        JobQueue: jobQueue.jobQueueName!,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // 失敗ジョブアラーム
    const failedJobsAlarm = new cdk.aws_cloudwatch.Alarm(this, 'BatchFailedJobsAlarm', {
      alarmName: `${props.config.jobQueue.namePrefix}-failed-jobs`,
      alarmDescription: 'Batch Job failures alarm',
      metric: failedJobsMetric,
      threshold: 3, // 5分間に3つ以上のジョブが失敗した場合
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // 自動復旧Lambda関数
    const recoveryFunction = new cdk.aws_lambda.Function(this, 'BatchRecoveryFunction', {
      functionName: `${props.config.jobQueue.namePrefix}-recovery`,
      runtime: cdk.aws_lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: cdk.aws_lambda.Code.fromInline(`
import boto3
import json
import os
from datetime import datetime, timedelta

def handler(event, context):
    batch_client = boto3.client('batch')
    logs_client = boto3.client('logs')
    
    job_queue_name = os.environ['JOB_QUEUE_NAME']
    compute_env_name = os.environ['COMPUTE_ENVIRONMENT_NAME']
    
    try:
        # 失敗したジョブを取得
        failed_jobs = batch_client.list_jobs(
            jobQueue=job_queue_name,
            jobStatus='FAILED',
            maxResults=10
        )
        
        recovery_actions = []
        
        for job in failed_jobs['jobList']:
            job_id = job['jobId']
            job_name = job['jobName']
            
            # ジョブの詳細情報を取得
            job_detail = batch_client.describe_jobs(jobs=[job_id])
            job_info = job_detail['jobs'][0]
            
            # 失敗理由を分析
            status_reason = job_info.get('statusReason', '')
            
            if 'Host EC2' in status_reason or 'Spot' in status_reason:
                # インスタンス関連の問題 - コンピュート環境をリフレッシュ
                recovery_actions.append({
                    'action': 'refresh_compute_environment',
                    'reason': 'Instance failure detected',
                    'job_id': job_id
                })
                
            elif 'OutOfMemory' in status_reason or 'OOMKilled' in status_reason:
                # メモリ不足 - より大きなインスタンスタイプを推奨
                recovery_actions.append({
                    'action': 'recommend_larger_instance',
                    'reason': 'Memory exhaustion detected',
                    'job_id': job_id
                })
                
            elif 'Task failed' in status_reason:
                # タスク失敗 - ジョブを再実行
                recovery_actions.append({
                    'action': 'retry_job',
                    'reason': 'Task failure detected',
                    'job_id': job_id,
                    'job_name': job_name
                })
        
        # 復旧アクションを実行
        for action in recovery_actions:
            if action['action'] == 'refresh_compute_environment':
                # コンピュート環境の更新（強制リフレッシュ）
                batch_client.update_compute_environment(
                    computeEnvironment=compute_env_name,
                    state='DISABLED'
                )
                # 少し待ってから再有効化
                import time
                time.sleep(30)
                batch_client.update_compute_environment(
                    computeEnvironment=compute_env_name,
                    state='ENABLED'
                )
                print(f"Refreshed compute environment for job {action['job_id']}")
                
            elif action['action'] == 'retry_job':
                # 失敗したジョブを再実行（新しいジョブとして）
                original_job = batch_client.describe_jobs(jobs=[action['job_id']])['jobs'][0]
                
                retry_job = batch_client.submit_job(
                    jobName=f"{action['job_name']}-retry-{int(datetime.now().timestamp())}",
                    jobQueue=job_queue_name,
                    jobDefinition=original_job['jobDefinitionArn'],
                    parameters=original_job.get('parameters', {}),
                    timeout=original_job.get('timeout', {}),
                    retryStrategy={'attempts': 1}  # 再試行は1回のみ
                )
                print(f"Retried job {action['job_id']} as {retry_job['jobId']}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Recovery actions completed',
                'actions_taken': len(recovery_actions),
                'details': recovery_actions
            })
        }
        
    except Exception as e:
        print(f"Recovery failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
      `),
      environment: {
        JOB_QUEUE_NAME: jobQueue.jobQueueName!,
        COMPUTE_ENVIRONMENT_NAME: this.computeEnvironment.computeEnvironmentName!,
      },
      timeout: cdk.Duration.minutes(10),
    });

    // Lambda実行権限
    recoveryFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'batch:ListJobs',
        'batch:DescribeJobs',
        'batch:SubmitJob',
        'batch:UpdateComputeEnvironment',
        'batch:DescribeComputeEnvironments',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogGroups',
        'logs:DescribeLogStreams',
      ],
      resources: ['*'],
    }));

    // SNSトピック作成
    const recoveryTopic = new cdk.aws_sns.Topic(this, 'BatchRecoveryTopic', {
      topicName: `${props.config.jobQueue.namePrefix}-recovery-topic`,
      displayName: 'Batch Auto Recovery Notifications',
    });

    // Lambda関数をSNSトピックにサブスクライブ
    recoveryTopic.addSubscription(new cdk.aws_sns_subscriptions.LambdaSubscription(recoveryFunction));

    // 失敗アラームを復旧トピックに接続
    failedJobsAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(recoveryTopic));

    // 復旧状況ダッシュボード作成
    this.createRecoveryDashboard(props, jobQueue, failedJobsAlarm);
  }

  /**
   * 復旧状況ダッシュボード作成
   */
  private createRecoveryDashboard(props: BatchConstructProps, jobQueue: batch.CfnJobQueue, failedJobsAlarm: cdk.aws_cloudwatch.Alarm): void {
    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'BatchRecoveryDashboard', {
      dashboardName: `${props.config.jobQueue.namePrefix}-recovery-dashboard`,
    });

    // ジョブ状況ウィジェット
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Batch Job Status',
        left: [
          new cdk.aws_cloudwatch.Metric({
            namespace: 'AWS/Batch',
            metricName: 'SubmittedJobs',
            dimensionsMap: { JobQueue: jobQueue.jobQueueName! },
            statistic: 'Sum',
          }),
          new cdk.aws_cloudwatch.Metric({
            namespace: 'AWS/Batch',
            metricName: 'RunnableJobs',
            dimensionsMap: { JobQueue: jobQueue.jobQueueName! },
            statistic: 'Sum',
          }),
          new cdk.aws_cloudwatch.Metric({
            namespace: 'AWS/Batch',
            metricName: 'RunningJobs',
            dimensionsMap: { JobQueue: jobQueue.jobQueueName! },
            statistic: 'Sum',
          }),
          new cdk.aws_cloudwatch.Metric({
            namespace: 'AWS/Batch',
            metricName: 'FailedJobs',
            dimensionsMap: { JobQueue: jobQueue.jobQueueName! },
            statistic: 'Sum',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // コンピュート環境リソース使用状況
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Compute Environment Resources',
        left: [
          new cdk.aws_cloudwatch.Metric({
            namespace: 'AWS/Batch',
            metricName: 'RunningOnDemandCapacity',
            dimensionsMap: { ComputeEnvironment: this.computeEnvironment.computeEnvironmentName! },
            statistic: 'Average',
          }),
          new cdk.aws_cloudwatch.Metric({
            namespace: 'AWS/Batch',
            metricName: 'RunningSpotCapacity',
            dimensionsMap: { ComputeEnvironment: this.computeEnvironment.computeEnvironmentName! },
            statistic: 'Average',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // アラーム状況ウィジェット
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.AlarmWidget({
        title: 'Recovery Alarms',
        alarm: failedJobsAlarm,
        width: 12,
        height: 4,
      })
    );
  }

  /**
   * タグ設定
   */
  private applyTags(props: BatchConstructProps): void {
    const tags = {
      Project: props.projectName,
      Environment: props.environment,
      Component: 'Embedding',
      Module: 'AWS_BATCH',
      ManagedBy: 'CDK',
      MultiAZ: props.config.computeEnvironment.multiAz.toString(),
      AutoScaling: props.config.autoScaling.enabled.toString(),
    };

    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }

  /**
   * モジュール固有リソース取得
   */
  public get moduleResources() {
    return {
      batch: {
        computeEnvironment: this.computeEnvironment,
        jobDefinition: this.jobDefinition,
        jobQueue: this.jobQueue,
        launchTemplate: this.launchTemplate,
      },
    };
  }

  /**
   * モジュール依存関係取得
   */
  public get dependencies() {
    return {
      requiredModules: ['VPC', 'SECURITY_GROUP', 'IAM'],
      optionalModules: ['MONITORING', 'LOGGING'],
      requiredResources: {
        requiresVpc: true,
        requiresSecurityGroup: true,
        requiresIamRole: true,
        requiresStorage: true,
        requiresLogging: true,
      },
      providedResources: {
        providesCompute: true,
        providesStorage: false,
        providesNetwork: false,
        providesMonitoring: false,
      },
    };
  }

  /**
   * ジョブ実行メソッド
   */
  public submitJob(jobName: string, parameters?: Record<string, string>): string {
    // 実際の実装では、AWS SDKを使用してジョブを投入
    // ここではジョブIDのプレースホルダーを返す
    return `${jobName}-${Date.now()}`;
  }

  /**
   * Job Queue状態管理
   */
  public enableJobQueue(): void {
    // Job Queueを有効化
    // 実際の実装では、AWS SDKを使用してJob Queueの状態を変更
    console.log(`Enabling job queue: ${this.jobQueue.jobQueueName}`);
  }

  public disableJobQueue(): void {
    // Job Queueを無効化
    // 実際の実装では、AWS SDKを使用してJob Queueの状態を変更
    console.log(`Disabling job queue: ${this.jobQueue.jobQueueName}`);
  }

  /**
   * Job Queue優先度変更
   */
  public updateJobQueuePriority(newPriority: number): void {
    // Job Queueの優先度を変更
    // 実際の実装では、AWS SDKを使用してJob Queueの優先度を変更
    console.log(`Updating job queue priority to: ${newPriority}`);
  }

  /**
   * Job Queue監視メトリクス取得
   */
  public getJobQueueMetrics(): Record<string, any> {
    return {
      queueName: this.jobQueue.jobQueueName,
      computeEnvironment: this.computeEnvironment.computeEnvironmentName,
      autoScalingEnabled: true,
      autoRecoveryEnabled: true,
      dashboardUrl: `https://console.aws.amazon.com/cloudwatch/home#dashboards:name=${this.jobQueue.jobQueueName}-recovery-dashboard`,
    };
  }

  /**
   * Auto Scaling設定
   */
  public configureAutoScaling(props: BatchConstructProps): void {
    if (!props.config.autoScaling.enabled) {
      return;
    }

    // CloudWatchメトリクスベースの自動スケーリング設定
    // 実際の実装では、Application Auto Scalingを使用
    console.log('Auto Scaling configuration:', {
      scaleOutThreshold: props.config.autoScaling.scaleOutThreshold,
      scaleInThreshold: props.config.autoScaling.scaleInThreshold,
      cooldownPeriod: props.config.autoScaling.cooldownPeriod,
    });
  }
}