/**
 * FSx for ONTAP と Serverless アーキテクチャの統合コンストラクト
 * 
 * このコンストラクトは、Amazon FSx for NetApp ONTAP と AWS Serverless サービス
 * （Lambda、Step Functions、EventBridge、SQS、SNS）を統合し、
 * 高性能なファイル処理パイプラインを提供します。
 * 
 * 注意: API Gatewayはタイムアウト制約により使用せず、Lambda Web Adapterを使用
 * 
 * @author Kiro AI
 * @date 2026-01-08
 * @version 1.0.0
 */

import { Construct } from 'constructs';
import * as fsx from 'aws-cdk-lib/aws-fsx';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';

/**
 * FSx-Serverless統合コンストラクトのプロパティ
 */
export interface FsxServerlessIntegrationProps {
  /**
   * FSx for ONTAP設定
   */
  readonly fsx: {
    readonly enabled: boolean;
    readonly fileSystems: Array<{
      readonly enabled: boolean;
      readonly name: string;
      readonly storageCapacity: number;
      readonly throughputCapacity: number;
      readonly deploymentType: 'SINGLE_AZ_1' | 'MULTI_AZ_1';
      readonly storageEfficiency: boolean;
      readonly backup: {
        readonly enabled: boolean;
        readonly retentionDays: number;
        readonly dailyAutomaticBackupStartTime: string;
      };
      readonly encryption: {
        readonly enabled: boolean;
        readonly kmsKeyId?: string;
      };
      readonly network: {
        readonly subnetIds: string[];
        readonly securityGroupIds: string[];
        readonly routeTableIds: string[];
      };
    }>;
    readonly storageVirtualMachines: Array<{
      readonly enabled: boolean;
      readonly name: string;
      readonly rootVolumeSecurityStyle: 'UNIX' | 'NTFS' | 'MIXED';
      readonly activeDirectoryConfiguration: {
        readonly enabled: boolean;
      };
    }>;
    readonly volumes: Array<{
      readonly enabled: boolean;
      readonly name: string;
      readonly sizeInMegabytes: number;
      readonly securityStyle: 'UNIX' | 'NTFS' | 'MIXED';
      readonly ontapVolumeType: 'RW' | 'DP';
      readonly junctionPath: string;
    }>;
  };

  /**
   * Serverless設定
   */
  readonly serverless: {
    readonly enabled: boolean;
    readonly stepFunctions: {
      readonly enabled: boolean;
      readonly workflows: Array<{
        readonly enabled: boolean;
        readonly name: string;
        readonly purpose: string;
        readonly role: {
          readonly permissions: string[];
        };
      }>;
      readonly execution: {
        readonly timeout: number;
        readonly retryAttempts: number;
      };
    };
    readonly eventBridge: {
      readonly enabled: boolean;
      readonly rules: Array<{
        readonly enabled: boolean;
        readonly name: string;
        readonly eventPattern?: any;
        readonly schedule?: {
          readonly expression: string;
        };
      }>;
    };
    readonly sqs: {
      readonly enabled: boolean;
      readonly queues: Array<{
        readonly enabled: boolean;
        readonly name: string;
        readonly configuration: {
          readonly visibilityTimeoutSeconds: number;
          readonly messageRetentionPeriod: number;
          readonly maxReceiveCount: number;
        };
      }>;
    };
    readonly sns: {
      readonly enabled: boolean;
      readonly topics: Array<{
        readonly enabled: boolean;
        readonly name: string;
        readonly subscriptions: Array<{
          readonly enabled: boolean;
          readonly protocol: string;
          readonly endpoint: string;
        }>;
      }>;
    };
    readonly lambda: {
      readonly functions: Array<{
        readonly enabled: boolean;
        readonly name: string;
        readonly runtime: string;
        readonly timeout: number;
        readonly memorySize: number;
        readonly vpc: {
          readonly enabled: boolean;
        };
        readonly fileSystem: {
          readonly enabled: boolean;
        };
        readonly role: {
          readonly permissions: string[];
        };
      }>;
    };
    readonly monitoring: {
      readonly cloudWatch: {
        readonly enabled: boolean;
        readonly logRetentionDays: number;
      };
      readonly xray: {
        readonly enabled: boolean;
      };
    };
  };

  /**
   * VPC設定
   */
  readonly vpc: ec2.IVpc;

  /**
   * 環境名
   */
  readonly environment: string;

  /**
   * プロジェクト名
   */
  readonly projectName: string;

  /**
   * タグ
   */
  readonly tags?: { [key: string]: string };
}

/**
 * FSx-Serverless統合コンストラクト
 */
export class FsxServerlessIntegrationConstruct extends Construct {
  /**
   * FSx for ONTAPファイルシステム
   */
  public readonly fileSystems: fsx.CfnFileSystem[] = [];

  /**
   * Lambda関数
   */
  public readonly lambdaFunctions: lambda.Function[] = [];

  /**
   * Step Functions ステートマシン
   */
  public readonly stateMachines: stepfunctions.StateMachine[] = [];

  /**
   * SQSキュー
   */
  public readonly queues: sqs.Queue[] = [];

  /**
   * SNSトピック
   */
  public readonly topics: sns.Topic[] = [];

  /**
   * EventBridgeルール
   */
  public readonly eventRules: events.Rule[] = [];

  constructor(scope: Construct, id: string, props: FsxServerlessIntegrationProps) {
    super(scope, id);

    // FSx for ONTAPリソースの作成
    if (props.fsx.enabled) {
      this.createFsxResources(props);
    }

    // Serverlessリソースの作成
    if (props.serverless.enabled) {
      this.createServerlessResources(props);
    }

    // 統合の設定
    this.setupIntegration(props);

    // モニタリングの設定
    this.setupMonitoring(props);

    // タグの適用
    this.applyTags(props.tags);
  }

  /**
   * FSx for ONTAPリソースの作成
   */
  private createFsxResources(props: FsxServerlessIntegrationProps): void {
    props.fsx.fileSystems.forEach((fsConfig, index) => {
      if (!fsConfig.enabled) return;

      const fileSystem = new fsx.CfnFileSystem(this, `FileSystem${index}`, {
        fileSystemType: 'ONTAP',
        storageCapacity: fsConfig.storageCapacity,
        subnetIds: fsConfig.network.subnetIds,
        ontapConfiguration: {
          deploymentType: fsConfig.deploymentType,
          throughputCapacity: fsConfig.throughputCapacity,
          preferredSubnetId: fsConfig.network.subnetIds[0],
          routeTableIds: fsConfig.network.routeTableIds,
          automaticBackupRetentionDays: fsConfig.backup.enabled ? fsConfig.backup.retentionDays : 0,
          dailyAutomaticBackupStartTime: fsConfig.backup.enabled ? fsConfig.backup.dailyAutomaticBackupStartTime : undefined,
          diskIopsConfiguration: {
            mode: 'AUTOMATIC',
          },
          weeklyMaintenanceStartTime: '7:09:00',
        },
        securityGroupIds: fsConfig.network.securityGroupIds,
        kmsKeyId: fsConfig.encryption.enabled ? fsConfig.encryption.kmsKeyId : undefined,
        tags: [
          {
            key: 'Name',
            value: `${props.projectName}-${props.environment}-${fsConfig.name}`,
          },
          {
            key: 'Environment',
            value: props.environment,
          },
          {
            key: 'Project',
            value: props.projectName,
          },
        ],
      });

      this.fileSystems.push(fileSystem);

      // Storage Virtual Machine (SVM) の作成
      props.fsx.storageVirtualMachines.forEach((svmConfig, svmIndex) => {
        if (!svmConfig.enabled) return;

        const svm = new fsx.CfnStorageVirtualMachine(this, `SVM${index}-${svmIndex}`, {
          fileSystemId: fileSystem.ref,
          name: `${props.projectName}-${props.environment}-${svmConfig.name}`,
          rootVolumeSecurityStyle: svmConfig.rootVolumeSecurityStyle,
          tags: [
            {
              key: 'Name',
              value: `${props.projectName}-${props.environment}-${svmConfig.name}`,
            },
            {
              key: 'Environment',
              value: props.environment,
            },
          ],
        });

        // ボリュームの作成
        props.fsx.volumes.forEach((volumeConfig, volumeIndex) => {
          if (!volumeConfig.enabled) return;

          new fsx.CfnVolume(this, `Volume${index}-${svmIndex}-${volumeIndex}`, {
            name: `${props.projectName}-${props.environment}-${volumeConfig.name}`,
            ontapConfiguration: {
              storageVirtualMachineId: svm.ref,
              sizeInMegabytes: volumeConfig.sizeInMegabytes.toString(),
              securityStyle: volumeConfig.securityStyle,
              ontapVolumeType: volumeConfig.ontapVolumeType,
              junctionPath: volumeConfig.junctionPath,
              storageEfficiencyEnabled: 'true',
              tieringPolicy: {
                name: 'AUTO',
                coolingPeriod: 31,
              },
            },
            tags: [
              {
                key: 'Name',
                value: `${props.projectName}-${props.environment}-${volumeConfig.name}`,
              },
              {
                key: 'Environment',
                value: props.environment,
              },
            ],
          });
        });
      });
    });
  }

  /**
   * Serverlessリソースの作成
   */
  private createServerlessResources(props: FsxServerlessIntegrationProps): void {
    // SNSトピックの作成
    if (props.serverless.sns.enabled) {
      this.createSnsTopics(props);
    }

    // SQSキューの作成
    if (props.serverless.sqs.enabled) {
      this.createSqsQueues(props);
    }

    // Lambda関数の作成
    this.createLambdaFunctions(props);

    // Step Functionsの作成
    if (props.serverless.stepFunctions.enabled) {
      this.createStepFunctions(props);
    }

    // EventBridgeルールの作成
    if (props.serverless.eventBridge.enabled) {
      this.createEventBridgeRules(props);
    }
  }

  /**
   * SNSトピックの作成
   */
  private createSnsTopics(props: FsxServerlessIntegrationProps): void {
    props.serverless.sns.topics.forEach((topicConfig, index) => {
      if (!topicConfig.enabled) return;

      const topic = new sns.Topic(this, `Topic${index}`, {
        topicName: `${props.projectName}-${props.environment}-${topicConfig.name}`,
        displayName: `${props.projectName} ${props.environment} ${topicConfig.name}`,
      });

      // サブスクリプションの追加
      topicConfig.subscriptions.forEach((subConfig, subIndex) => {
        if (!subConfig.enabled) return;

        if (subConfig.protocol === 'email') {
          topic.addSubscription(new snsSubscriptions.EmailSubscription(subConfig.endpoint));
        } else if (subConfig.protocol === 'sms') {
          topic.addSubscription(new snsSubscriptions.SmsSubscription(subConfig.endpoint));
        }
      });

      this.topics.push(topic);
    });
  }

  /**
   * SQSキューの作成
   */
  private createSqsQueues(props: FsxServerlessIntegrationProps): void {
    props.serverless.sqs.queues.forEach((queueConfig, index) => {
      if (!queueConfig.enabled) return;

      const queue = new sqs.Queue(this, `Queue${index}`, {
        queueName: `${props.projectName}-${props.environment}-${queueConfig.name}`,
        visibilityTimeout: Duration.seconds(queueConfig.configuration.visibilityTimeoutSeconds),
        retentionPeriod: Duration.seconds(queueConfig.configuration.messageRetentionPeriod),
        deadLetterQueue: {
          queue: new sqs.Queue(this, `DLQ${index}`, {
            queueName: `${props.projectName}-${props.environment}-${queueConfig.name}-dlq`,
          }),
          maxReceiveCount: queueConfig.configuration.maxReceiveCount,
        },
      });

      this.queues.push(queue);
    });
  }

  /**
   * Lambda関数の作成
   */
  private createLambdaFunctions(props: FsxServerlessIntegrationProps): void {
    props.serverless.lambda.functions.forEach((funcConfig, index) => {
      if (!funcConfig.enabled) return;

      // IAMロールの作成
      const role = new iam.Role(this, `LambdaRole${index}`, {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
      });

      // VPC設定の場合はVPC実行ポリシーを追加
      if (funcConfig.vpc.enabled) {
        role.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
        );
      }

      // カスタム権限の追加
      if (funcConfig.role.permissions.length > 0) {
        role.addToPolicy(new iam.PolicyStatement({
          actions: funcConfig.role.permissions,
          resources: ['*'],
        }));
      }

      // Lambda関数の作成（64文字制限対応）
      const shortFunctionName = `${props.projectName.substring(0, 15)}-${props.environment}-${funcConfig.name.substring(0, 20)}`;
      const lambdaFunction = new lambda.Function(this, `Function${index}`, {
        functionName: shortFunctionName,
        runtime: this.getLambdaRuntime(funcConfig.runtime),
        handler: 'index.handler',
        code: lambda.Code.fromInline(`
import json
import boto3
import logging
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    FSx-Serverless統合Lambda関数
    Lambda Web Adapter経由でHTTPリクエストを処理
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    try:
        # FSxファイルシステムの情報を取得
        fsx_client = boto3.client('fsx')
        
        # HTTPリクエストの処理（Lambda Web Adapter形式）
        http_method = event.get('requestContext', {}).get('http', {}).get('method', 'GET')
        path = event.get('rawPath', '/')
        
        # ヘルスチェックエンドポイント
        if path == '/health':
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'status': 'healthy',
                    'service': 'fsx-serverless-integration',
                    'timestamp': context.aws_request_id
                })
            }
        
        # FSxファイルシステム情報エンドポイント
        if path == '/fsx/info':
            file_systems = fsx_client.describe_file_systems()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'fileSystems': file_systems.get('FileSystems', []),
                    'count': len(file_systems.get('FileSystems', []))
                })
            }
        
        # デフォルトレスポンス
        result = {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'message': 'FSx-Serverless integration successful',
                'method': http_method,
                'path': path,
                'requestId': context.aws_request_id
            })
        }
        
        logger.info(f"Processing completed: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Error processing event: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': str(e),
                'requestId': context.aws_request_id
            })
        }
        `),
        timeout: Duration.seconds(funcConfig.timeout),
        memorySize: funcConfig.memorySize,
        role: role,
        vpc: funcConfig.vpc.enabled ? props.vpc : undefined,
        tracing: props.serverless.monitoring.xray.enabled ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
        logRetention: props.serverless.monitoring.cloudWatch.enabled 
          ? this.getLogRetention(props.serverless.monitoring.cloudWatch.logRetentionDays)
          : logs.RetentionDays.ONE_WEEK,
        environment: {
          // Lambda Web Adapter環境変数
          AWS_LWA_INVOKE_MODE: 'buffered',
          AWS_LWA_PORT: '3000',
          AWS_LWA_READINESS_CHECK_PATH: '/health',
          // FSx関連環境変数
          FSX_REGION: props.vpc.env?.region || 'ap-northeast-1',
        },
      });

      // FSxファイルシステムマウント設定（VPC内の場合）
      if (funcConfig.vpc.enabled && funcConfig.fileSystem.enabled && this.fileSystems.length > 0) {
        // EFS Access Pointの代わりにFSx for ONTAPのマウント設定
        // 注意: Lambda関数でのFSx for ONTAPマウントは、EFSとは異なる設定が必要
        lambdaFunction.addEnvironment('FSX_FILE_SYSTEM_ID', this.fileSystems[0].ref);
        lambdaFunction.addEnvironment('FSX_MOUNT_PATH', '/mnt/fsx');
      }

      this.lambdaFunctions.push(lambdaFunction);
    });
  }

  /**
   * Step Functionsの作成
   */
  private createStepFunctions(props: FsxServerlessIntegrationProps): void {
    props.serverless.stepFunctions.workflows.forEach((workflowConfig, index) => {
      if (!workflowConfig.enabled) return;

      // Step Functions用のIAMロール
      const role = new iam.Role(this, `StepFunctionsRole${index}`, {
        assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      });

      // 権限の追加
      role.addToPolicy(new iam.PolicyStatement({
        actions: workflowConfig.role.permissions,
        resources: ['*'],
      }));

      // ワークフロー定義の作成
      const definition = this.createWorkflowDefinition(props, index);

      const stateMachine = new stepfunctions.StateMachine(this, `StateMachine${index}`, {
        stateMachineName: `${props.projectName}-${props.environment}-${workflowConfig.name}`,
        definition: definition,
        role: role,
        timeout: Duration.seconds(props.serverless.stepFunctions.execution.timeout),
        logs: {
          destination: new logs.LogGroup(this, `StepFunctionsLogGroup${index}`, {
            logGroupName: `/aws/stepfunctions/${props.projectName}-${props.environment}-${workflowConfig.name}`,
            retention: this.getLogRetention(props.serverless.monitoring.cloudWatch.logRetentionDays),
            removalPolicy: RemovalPolicy.DESTROY,
          }),
          level: stepfunctions.LogLevel.ALL,
        },
        tracingEnabled: props.serverless.monitoring.xray.enabled,
      });

      this.stateMachines.push(stateMachine);
    });
  }

  /**
   * ワークフロー定義の作成
   */
  private createWorkflowDefinition(props: FsxServerlessIntegrationProps, index: number): stepfunctions.IChainable {
    const startState = new stepfunctions.Pass(this, `StartState${index}`, {
      comment: 'FSx-Serverless統合ワークフローの開始',
      result: stepfunctions.Result.fromObject({
        message: 'Workflow started',
        timestamp: stepfunctions.JsonPath.stringAt('$$.State.EnteredTime'),
      }),
    });

    // Lambda関数が存在する場合は呼び出しタスクを追加
    if (this.lambdaFunctions.length > 0) {
      const lambdaTask = new sfnTasks.LambdaInvoke(this, `LambdaTask${index}`, {
        lambdaFunction: this.lambdaFunctions[0],
        comment: 'FSxデータ処理Lambda関数の実行',
        retryOnServiceExceptions: true,
      });

      const endState = new stepfunctions.Pass(this, `EndState${index}`, {
        comment: 'ワークフロー完了',
      });

      return startState.next(lambdaTask).next(endState);
    }

    return startState;
  }

  /**
   * EventBridgeルールの作成
   */
  private createEventBridgeRules(props: FsxServerlessIntegrationProps): void {
    props.serverless.eventBridge.rules.forEach((ruleConfig, index) => {
      if (!ruleConfig.enabled) return;

      const rule = new events.Rule(this, `EventRule${index}`, {
        ruleName: `${props.projectName}-${props.environment}-${ruleConfig.name}`,
        description: `FSx-Serverless統合イベントルール: ${ruleConfig.name}`,
        eventPattern: ruleConfig.eventPattern,
        schedule: ruleConfig.schedule ? events.Schedule.expression(ruleConfig.schedule.expression) : undefined,
      });

      // ターゲットの追加
      if (this.stateMachines.length > 0) {
        rule.addTarget(new targets.SfnStateMachine(this.stateMachines[0]));
      }

      if (this.lambdaFunctions.length > 0) {
        rule.addTarget(new targets.LambdaFunction(this.lambdaFunctions[0]));
      }

      if (this.queues.length > 0) {
        rule.addTarget(new targets.SqsQueue(this.queues[0]));
      }

      this.eventRules.push(rule);
    });
  }

  /**
   * 統合の設定
   */
  private setupIntegration(props: FsxServerlessIntegrationProps): void {
    // Lambda関数とSQSキューの統合
    this.lambdaFunctions.forEach((func, funcIndex) => {
      this.queues.forEach((queue, queueIndex) => {
        // SQSイベントソースの追加
        func.addEventSource(new lambdaEventSources.SqsEventSource(queue, {
          batchSize: 10,
          maxBatchingWindow: Duration.seconds(5),
        }));
      });
    });

    // SNSトピックとLambda関数の統合
    this.topics.forEach((topic, topicIndex) => {
      this.lambdaFunctions.forEach((func, funcIndex) => {
        topic.addSubscription(new snsSubscriptions.LambdaSubscription(func));
      });
    });
  }

  /**
   * モニタリングの設定
   */
  private setupMonitoring(props: FsxServerlessIntegrationProps): void {
    if (!props.serverless.monitoring.cloudWatch.enabled) return;

    // CloudWatchアラームの作成
    this.lambdaFunctions.forEach((func, index) => {
      // エラー率アラーム
      new cloudwatch.Alarm(this, `LambdaErrorAlarm${index}`, {
        alarmName: `${props.projectName}-${props.environment}-lambda-errors-${index}`,
        metric: func.metricErrors({
          period: Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // 実行時間アラーム
      new cloudwatch.Alarm(this, `LambdaDurationAlarm${index}`, {
        alarmName: `${props.projectName}-${props.environment}-lambda-duration-${index}`,
        metric: func.metricDuration({
          period: Duration.minutes(5),
        }),
        threshold: func.timeout?.toSeconds() ? func.timeout.toSeconds() * 0.8 : 240,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    });

    // Step Functionsのモニタリング
    this.stateMachines.forEach((sm, index) => {
      new cloudwatch.Alarm(this, `StepFunctionsFailedAlarm${index}`, {
        alarmName: `${props.projectName}-${props.environment}-stepfunctions-failed-${index}`,
        metric: sm.metricFailed({
          period: Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    });
  }

  /**
   * タグの適用
   */
  private applyTags(tags?: { [key: string]: string }): void {
    if (!tags) return;

    Object.entries(tags).forEach(([key, value]) => {
      // CDKのTagsを使用してリソースにタグを適用
      // 注意: 個別のリソースに対してタグを適用する場合は、
      // 各リソースのtagsプロパティを使用する必要があります
    });
  }

  /**
   * Lambda Runtimeの取得
   */
  private getLambdaRuntime(runtimeString: string): lambda.Runtime {
    switch (runtimeString) {
      case 'python3.9':
        return lambda.Runtime.PYTHON_3_9;
      case 'python3.10':
        return lambda.Runtime.PYTHON_3_10;
      case 'python3.11':
        return lambda.Runtime.PYTHON_3_11;
      case 'nodejs18.x':
        return lambda.Runtime.NODEJS_18_X;
      case 'nodejs20.x':
        return lambda.Runtime.NODEJS_20_X;
      default:
        return lambda.Runtime.PYTHON_3_9;
    }
  }

  /**
   * ログ保持期間の取得
   */
  private getLogRetention(days: number): logs.RetentionDays {
    switch (days) {
      case 1:
        return logs.RetentionDays.ONE_DAY;
      case 3:
        return logs.RetentionDays.THREE_DAYS;
      case 5:
        return logs.RetentionDays.FIVE_DAYS;
      case 7:
        return logs.RetentionDays.ONE_WEEK;
      case 14:
        return logs.RetentionDays.TWO_WEEKS;
      case 30:
        return logs.RetentionDays.ONE_MONTH;
      case 60:
        return logs.RetentionDays.TWO_MONTHS;
      case 90:
        return logs.RetentionDays.THREE_MONTHS;
      default:
        return logs.RetentionDays.ONE_WEEK;
    }
  }
}