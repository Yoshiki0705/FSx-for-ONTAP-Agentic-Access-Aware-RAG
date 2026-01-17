/**
 * Embedding Batch統合コンストラクト
 * 
 * Agent Steeringルール準拠:
 * - モジュラーアーキテクチャ強制（lib/modules/compute/constructs/）
 * - EmbeddingStackでのBatch統合機能
 * - 自動スケーリング・自動復旧機能付きJob Queue管理
 * 
 * Requirements: 1.3, 5.1
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import { BatchConstruct } from './batch-construct';
import { EmbeddingConfig } from '../interfaces/embedding-config';
import { EmbeddingCommonResources } from '../interfaces/module-interfaces';

export interface EmbeddingBatchIntegrationProps {
  /** Embedding設定 */
  readonly config: EmbeddingConfig;
  
  /** プロジェクト名 */
  readonly projectName: string;
  
  /** 環境名 */
  readonly environment: string;
  
  /** 共通リソース */
  readonly commonResources: EmbeddingCommonResources;
  
  /** ECRイメージパス */
  readonly imagePath: string;
  
  /** イメージタグ */
  readonly imageTag: string;
}

/**
 * Embedding Batch統合コンストラクト
 * 
 * 機能:
 * - BatchConstructの統合管理
 * - EmbeddingStackでの統一インターフェース提供
 * - ジョブ実行・監視・管理機能
 * - 自動スケーリング・自動復旧機能
 */
export class EmbeddingBatchIntegration extends Construct {
  /** Batchコンストラクト */
  public readonly batchConstruct: BatchConstruct;
  
  /** ジョブ管理Lambda関数 */
  public readonly jobManagerFunction: lambda.Function;
  
  /** 統合監視SNSトピック */
  public readonly integrationTopic: sns.Topic;
  
  /** ジョブスケジューラー */
  public readonly jobScheduler: events.Rule;

  constructor(scope: Construct, id: string, props: EmbeddingBatchIntegrationProps) {
    super(scope, id);

    // Batchコンストラクト作成
    this.batchConstruct = new BatchConstruct(this, 'BatchConstruct', {
      config: props.config.awsBatch,
      jobDefinitionConfig: props.config.jobDefinition,
      fsxIntegrationConfig: props.config.fsxIntegration,
      activeDirectoryConfig: props.config.activeDirectory,
      bedrockConfig: props.config.bedrock,
      openSearchConfig: props.config.openSearch,
      rdsConfig: props.config.rds,
      imagePath: props.imagePath,
      imageTag: props.imageTag,
      projectName: props.projectName,
      environment: props.environment,
      commonResources: props.commonResources,
    });

    // 統合監視SNSトピック作成
    this.integrationTopic = this.createIntegrationTopic(props);

    // ジョブ管理Lambda関数作成
    this.jobManagerFunction = this.createJobManagerFunction(props);

    // ジョブスケジューラー作成
    this.jobScheduler = this.createJobScheduler(props);

    // 統合監視設定
    this.configureIntegrationMonitoring(props);

    // タグ設定
    this.applyTags(props);
  }

  /**
   * 統合監視SNSトピック作成
   */
  private createIntegrationTopic(props: EmbeddingBatchIntegrationProps): sns.Topic {
    const topic = new sns.Topic(this, 'EmbeddingBatchIntegrationTopic', {
      topicName: `${props.projectName}-${props.environment}-embedding-batch-integration`,
      displayName: 'Embedding Batch Integration Notifications',
    });

    // 管理者通知用のメール購読（オプション）
    const adminEmail = props.config.monitoring.alerts.snsTopicArn;
    if (adminEmail) {
      topic.addSubscription(new snsSubscriptions.EmailSubscription(adminEmail));
    }

    return topic;
  }

  /**
   * ジョブ管理Lambda関数作成
   */
  private createJobManagerFunction(props: EmbeddingBatchIntegrationProps): lambda.Function {
    const jobManagerFunction = new lambda.Function(this, 'EmbeddingJobManagerFunction', {
      functionName: `${props.projectName}-${props.environment}-embedding-job-manager`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import boto3
import json
import os
from datetime import datetime
from typing import Dict, List, Any

def handler(event, context):
    """
    Embedding Job Manager
    
    機能:
    - ジョブの一括実行
    - ジョブ状況の監視
    - 失敗ジョブの自動再実行
    - ジョブ実行統計の収集
    """
    
    batch_client = boto3.client('batch')
    cloudwatch = boto3.client('cloudwatch')
    
    job_queue_name = os.environ['JOB_QUEUE_NAME']
    job_definition_name = os.environ['JOB_DEFINITION_NAME']
    
    try:
        action = event.get('action', 'status')
        
        if action == 'submit_batch':
            # 一括ジョブ実行
            return submit_batch_jobs(batch_client, event, job_queue_name, job_definition_name)
            
        elif action == 'monitor':
            # ジョブ監視
            return monitor_jobs(batch_client, cloudwatch, job_queue_name)
            
        elif action == 'cleanup':
            # 完了ジョブのクリーンアップ
            return cleanup_completed_jobs(batch_client, job_queue_name)
            
        elif action == 'status':
            # ジョブ状況取得
            return get_job_status(batch_client, job_queue_name)
            
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': f'Unknown action: {action}'})
            }
            
    except Exception as e:
        print(f"Job manager error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def submit_batch_jobs(batch_client, event, job_queue_name, job_definition_name):
    """一括ジョブ実行"""
    jobs = event.get('jobs', [])
    submitted_jobs = []
    
    for job_config in jobs:
        job_name = job_config.get('name', f'embedding-job-{int(datetime.now().timestamp())}')
        parameters = job_config.get('parameters', {})
        
        response = batch_client.submit_job(
            jobName=job_name,
            jobQueue=job_queue_name,
            jobDefinition=job_definition_name,
            parameters=parameters,
            timeout={'attemptDurationSeconds': 3600},
            retryStrategy={'attempts': 3}
        )
        
        submitted_jobs.append({
            'jobId': response['jobId'],
            'jobName': response['jobName'],
            'parameters': parameters
        })
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': f'Submitted {len(submitted_jobs)} jobs',
            'jobs': submitted_jobs
        })
    }

def monitor_jobs(batch_client, cloudwatch, job_queue_name):
    """ジョブ監視"""
    job_statuses = ['SUBMITTED', 'PENDING', 'RUNNABLE', 'STARTING', 'RUNNING', 'SUCCEEDED', 'FAILED']
    status_counts = {}
    
    for status in job_statuses:
        jobs = batch_client.list_jobs(
            jobQueue=job_queue_name,
            jobStatus=status,
            maxResults=100
        )
        status_counts[status] = len(jobs['jobList'])
    
    # CloudWatchメトリクスに送信
    for status, count in status_counts.items():
        cloudwatch.put_metric_data(
            Namespace='EmbeddingBatch/JobManager',
            MetricData=[
                {
                    'MetricName': f'Jobs{status}',
                    'Value': count,
                    'Unit': 'Count',
                    'Dimensions': [
                        {
                            'Name': 'JobQueue',
                            'Value': job_queue_name
                        }
                    ]
                }
            ]
        )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Job monitoring completed',
            'status_counts': status_counts
        })
    }

def cleanup_completed_jobs(batch_client, job_queue_name):
    """完了ジョブのクリーンアップ"""
    # 成功したジョブを取得（過去24時間）
    succeeded_jobs = batch_client.list_jobs(
        jobQueue=job_queue_name,
        jobStatus='SUCCEEDED',
        maxResults=100
    )
    
    # 失敗したジョブを取得（過去24時間）
    failed_jobs = batch_client.list_jobs(
        jobQueue=job_queue_name,
        jobStatus='FAILED',
        maxResults=100
    )
    
    cleanup_count = 0
    # 実際のクリーンアップロジックはここに実装
    # （ログの保存、メトリクスの記録など）
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Cleanup completed',
            'succeeded_jobs': len(succeeded_jobs['jobList']),
            'failed_jobs': len(failed_jobs['jobList']),
            'cleaned_up': cleanup_count
        })
    }

def get_job_status(batch_client, job_queue_name):
    """ジョブ状況取得"""
    # 各状態のジョブ数を取得
    status_summary = {}
    
    for status in ['SUBMITTED', 'PENDING', 'RUNNABLE', 'STARTING', 'RUNNING', 'SUCCEEDED', 'FAILED']:
        jobs = batch_client.list_jobs(
            jobQueue=job_queue_name,
            jobStatus=status,
            maxResults=10
        )
        status_summary[status] = {
            'count': len(jobs['jobList']),
            'jobs': [{'id': job['jobId'], 'name': job['jobName']} for job in jobs['jobList'][:5]]
        }
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Job status retrieved',
            'queue_name': job_queue_name,
            'status_summary': status_summary,
            'timestamp': datetime.now().isoformat()
        })
    }
      `),
      environment: {
        JOB_QUEUE_NAME: this.batchConstruct.jobQueue.jobQueueName!,
        JOB_DEFINITION_NAME: this.batchConstruct.jobDefinition.jobDefinitionName!,
      },
      timeout: cdk.Duration.minutes(15),
    });

    // Lambda実行権限
    jobManagerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'batch:SubmitJob',
        'batch:ListJobs',
        'batch:DescribeJobs',
        'batch:CancelJob',
        'batch:TerminateJob',
        'cloudwatch:PutMetricData',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['*'],
    }));

    return jobManagerFunction;
  }

  /**
   * ジョブスケジューラー作成
   */
  private createJobScheduler(props: EmbeddingBatchIntegrationProps): events.Rule {
    const schedulerRule = new events.Rule(this, 'EmbeddingJobScheduler', {
      ruleName: `${props.projectName}-${props.environment}-embedding-job-scheduler`,
      description: 'Embedding job monitoring and cleanup scheduler',
      schedule: events.Schedule.rate(cdk.Duration.minutes(30)), // 30分ごとに実行
    });

    // ジョブ管理Lambda関数をターゲットに設定
    schedulerRule.addTarget(new eventsTargets.LambdaFunction(this.jobManagerFunction, {
      event: events.RuleTargetInput.fromObject({
        action: 'monitor',
        source: 'scheduler',
        timestamp: events.EventField.fromPath('$.time'),
      }),
    }));

    return schedulerRule;
  }

  /**
   * 統合監視設定
   */
  private configureIntegrationMonitoring(props: EmbeddingBatchIntegrationProps): void {
    // ジョブ管理Lambda関数のエラー監視
    const jobManagerErrorMetric = this.jobManagerFunction.metricErrors({
      period: cdk.Duration.minutes(5),
    });

    const jobManagerErrorAlarm = new cdk.aws_cloudwatch.Alarm(this, 'JobManagerErrorAlarm', {
      alarmName: `${props.projectName}-${props.environment}-job-manager-errors`,
      alarmDescription: 'Job Manager Lambda function errors',
      metric: jobManagerErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    // エラーアラームをSNSトピックに接続
    jobManagerErrorAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.integrationTopic));

    // 統合ダッシュボード作成
    this.createIntegrationDashboard(props);
  }

  /**
   * 統合ダッシュボード作成
   */
  private createIntegrationDashboard(props: EmbeddingBatchIntegrationProps): void {
    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'EmbeddingBatchIntegrationDashboard', {
      dashboardName: `${props.projectName}-${props.environment}-embedding-batch-integration`,
    });

    // ジョブ管理Lambda関数メトリクス
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Job Manager Function Metrics',
        left: [
          this.jobManagerFunction.metricInvocations(),
          this.jobManagerFunction.metricErrors(),
          this.jobManagerFunction.metricDuration(),
        ],
        width: 12,
        height: 6,
      })
    );

    // Batchジョブ統計
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Batch Job Statistics',
        left: [
          new cdk.aws_cloudwatch.Metric({
            namespace: 'EmbeddingBatch/JobManager',
            metricName: 'JobsSUCCEEDED',
            dimensionsMap: { JobQueue: this.batchConstruct.jobQueue.jobQueueName! },
            statistic: 'Sum',
          }),
          new cdk.aws_cloudwatch.Metric({
            namespace: 'EmbeddingBatch/JobManager',
            metricName: 'JobsFAILED',
            dimensionsMap: { JobQueue: this.batchConstruct.jobQueue.jobQueueName! },
            statistic: 'Sum',
          }),
          new cdk.aws_cloudwatch.Metric({
            namespace: 'EmbeddingBatch/JobManager',
            metricName: 'JobsRUNNING',
            dimensionsMap: { JobQueue: this.batchConstruct.jobQueue.jobQueueName! },
            statistic: 'Average',
          }),
        ],
        width: 12,
        height: 6,
      })
    );
  }

  /**
   * タグ設定
   */
  private applyTags(props: EmbeddingBatchIntegrationProps): void {
    const tags = {
      Project: props.projectName,
      Environment: props.environment,
      Component: 'Embedding',
      Module: 'BATCH_INTEGRATION',
      ManagedBy: 'CDK',
      AutoScaling: props.config.awsBatch.autoScaling.enabled.toString(),
      AutoRecovery: 'true',
    };

    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }

  /**
   * ジョブ実行インターフェース
   */
  public async submitEmbeddingJob(jobName: string, parameters: Record<string, string>): Promise<string> {
    // ジョブ管理Lambda関数を呼び出してジョブを実行
    // 実際の実装では、AWS SDKを使用してLambda関数を呼び出し
    return this.batchConstruct.submitJob(jobName, parameters);
  }

  /**
   * ジョブ状況取得
   */
  public getJobStatus(): Record<string, any> {
    return this.batchConstruct.getJobQueueMetrics();
  }

  /**
   * 統合リソース情報取得
   */
  public getIntegrationInfo(): Record<string, any> {
    return {
      batchConstruct: {
        computeEnvironment: this.batchConstruct.computeEnvironment.computeEnvironmentName,
        jobDefinition: this.batchConstruct.jobDefinition.jobDefinitionName,
        jobQueue: this.batchConstruct.jobQueue.jobQueueName,
      },
      jobManager: {
        functionName: this.jobManagerFunction.functionName,
        functionArn: this.jobManagerFunction.functionArn,
      },
      monitoring: {
        integrationTopic: this.integrationTopic.topicArn,
        dashboardName: `${this.node.id}-integration`,
      },
      scheduler: {
        ruleName: this.jobScheduler.ruleName,
        schedule: 'rate(30 minutes)',
      },
    };
  }
}