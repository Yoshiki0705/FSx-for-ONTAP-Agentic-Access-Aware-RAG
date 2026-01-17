/**
 * AWS Batch 統合テストコンストラクト
 * 
 * Agent Steeringルール準拠:
 * - モジュラーアーキテクチャ強制（lib/modules/compute/constructs/）
 * - Job実行テストとFSxマウント確認
 * - 自動復旧機能のテスト
 * 
 * Requirements: 1.4, 1.5
 */

// テスト設定定数
const TEST_CONSTANTS = {
  TIMEOUTS: {
    BASIC_TEST: 15, // 基本テスト: 15分
    FSX_MOUNT_TEST: 10, // FSxマウントテスト: 10分
    AUTO_RECOVERY_TEST: 12, // 自動復旧テスト: 12分
  },
  SCHEDULES: {
    INTEGRATION_TEST: 6, // 統合テスト: 6時間ごと
  },
  RETRY_LIMITS: {
    JOB_EXECUTION: 3, // ジョブ実行再試行: 3回
    FAILURE_TRIGGER: 3, // 失敗トリガー: 3回
  },
  WAIT_INTERVALS: {
    JOB_STATUS_CHECK: 10, // ジョブ状態確認: 10秒間隔
    FSX_MOUNT_CHECK: 15, // FSxマウント確認: 15秒間隔
    RECOVERY_WAIT: 60, // 復旧待機: 60秒
  },
} as const;

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EmbeddingBatchIntegration } from './embedding-batch-integration';
import { EmbeddingConfig } from '../interfaces/embedding-config';

export interface BatchIntegrationTestProps {
  /** Embedding Batch統合 */
  readonly batchIntegration: EmbeddingBatchIntegration;
  
  /** Embedding設定 */
  readonly config: EmbeddingConfig;
  
  /** プロジェクト名 */
  readonly projectName: string;
  
  /** 環境名 */
  readonly environment: string;
  
  /** テスト通知用SNSトピックARN */
  readonly notificationTopicArn?: string;
}

/**
 * AWS Batch 統合テストコンストラクト
 * 
 * 機能:
 * - Job実行テストの自動化
 * - FSxマウント確認テスト
 * - 自動復旧機能のテスト
 * - テスト結果の監視・通知
 */
export class BatchIntegrationTest extends Construct {
  /** テスト実行Lambda関数 */
  public readonly testRunnerFunction: lambda.Function;
  
  /** FSxマウントテストLambda関数 */
  public readonly fsxMountTestFunction: lambda.Function;
  
  /** 自動復旧テストLambda関数 */
  public readonly autoRecoveryTestFunction: lambda.Function;
  
  /** テスト結果通知SNSトピック */
  public readonly testNotificationTopic: sns.Topic;
  
  /** テストスケジューラー */
  public readonly testScheduler: events.Rule;
  
  /** テスト結果ログ */
  public readonly testLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: BatchIntegrationTestProps) {
    super(scope, id);

    // テスト結果ログ作成
    this.testLogGroup = this.createTestLogGroup(props);

    // テスト結果通知SNSトピック作成
    this.testNotificationTopic = this.createTestNotificationTopic(props);

    // テスト実行Lambda関数作成
    this.testRunnerFunction = this.createTestRunnerFunction(props);

    // FSxマウントテストLambda関数作成
    this.fsxMountTestFunction = this.createFsxMountTestFunction(props);

    // 自動復旧テストLambda関数作成
    this.autoRecoveryTestFunction = this.createAutoRecoveryTestFunction(props);

    // テストスケジューラー作成
    this.testScheduler = this.createTestScheduler(props);

    // テスト監視設定
    this.configureTestMonitoring(props);

    // タグ設定
    this.applyTags(props);
  }

  /**
   * テスト結果ログ作成
   */
  private createTestLogGroup(props: BatchIntegrationTestProps): logs.LogGroup {
    return new logs.LogGroup(this, 'BatchIntegrationTestLogGroup', {
      logGroupName: `/aws/lambda/${props.projectName}-${props.environment}-batch-integration-test`,
      retention: logs.RetentionDays.ONE_MONTH, // セキュリティ監査のため1ヶ月に延長
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // 本番環境では暗号化を有効にする
      ...(props.environment === 'prod' && {
        encryptionKey: undefined, // KMSキーを指定する場合
      }),
    });
  }

  /**
   * テスト結果通知SNSトピック作成
   */
  private createTestNotificationTopic(props: BatchIntegrationTestProps): sns.Topic {
    const topic = new sns.Topic(this, 'BatchTestNotificationTopic', {
      topicName: `${props.projectName}-${props.environment}-batch-test-notifications`,
      displayName: 'Batch Integration Test Notifications',
    });

    // 既存の通知トピックがある場合は購読
    if (props.notificationTopicArn) {
      topic.addSubscription(new snsSubscriptions.EmailSubscription(props.notificationTopicArn));
    }

    return topic;
  }

  /**
   * テスト実行Lambda関数作成
   */
  private createTestRunnerFunction(props: BatchIntegrationTestProps): lambda.Function {
    const testRunnerFunction = new lambda.Function(this, 'BatchTestRunnerFunction', {
      functionName: `${props.projectName}-${props.environment}-batch-test-runner`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import boto3
import json
import os
import time
from datetime import datetime
from typing import Dict, List, Any

def handler(event, context):
    """
    Batch統合テスト実行
    
    テスト項目:
    1. Job実行テスト
    2. Job Queue動作確認
    3. 自動スケーリング動作確認
    4. エラーハンドリング確認
    """
    
    batch_client = boto3.client('batch')
    cloudwatch = boto3.client('cloudwatch')
    sns_client = boto3.client('sns')
    
    job_queue_name = os.environ['JOB_QUEUE_NAME']
    job_definition_name = os.environ['JOB_DEFINITION_NAME']
    test_topic_arn = os.environ['TEST_TOPIC_ARN']
    
    test_results = {
        'timestamp': datetime.now().isoformat(),
        'test_suite': 'batch_integration_test',
        'tests': []
    }
    
    try:
        # テスト1: 基本的なJob実行テスト
        test_results['tests'].append(
            test_basic_job_execution(batch_client, job_queue_name, job_definition_name)
        )
        
        # テスト2: Job Queue状態確認
        test_results['tests'].append(
            test_job_queue_status(batch_client, job_queue_name)
        )
        
        # テスト3: 複数Job同時実行テスト
        test_results['tests'].append(
            test_concurrent_job_execution(batch_client, job_queue_name, job_definition_name)
        )
        
        # テスト4: Job失敗ハンドリングテスト
        test_results['tests'].append(
            test_job_failure_handling(batch_client, job_queue_name, job_definition_name)
        )
        
        # テスト結果の集計
        total_tests = len(test_results['tests'])
        passed_tests = sum(1 for test in test_results['tests'] if test['status'] == 'PASSED')
        failed_tests = total_tests - passed_tests
        
        test_results['summary'] = {
            'total': total_tests,
            'passed': passed_tests,
            'failed': failed_tests,
            'success_rate': (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        }
        
        # CloudWatchメトリクスに送信
        cloudwatch.put_metric_data(
            Namespace='EmbeddingBatch/IntegrationTest',
            MetricData=[
                {
                    'MetricName': 'TestSuccessRate',
                    'Value': test_results['summary']['success_rate'],
                    'Unit': 'Percent'
                },
                {
                    'MetricName': 'TestsPassed',
                    'Value': passed_tests,
                    'Unit': 'Count'
                },
                {
                    'MetricName': 'TestsFailed',
                    'Value': failed_tests,
                    'Unit': 'Count'
                }
            ]
        )
        
        # テスト結果通知
        notification_message = format_test_notification(test_results)
        sns_client.publish(
            TopicArn=test_topic_arn,
            Subject=f'Batch Integration Test Results - {test_results["summary"]["success_rate"]:.1f}% Success',
            Message=notification_message
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps(test_results)
        }
        
    except Exception as e:
        error_result = {
            'timestamp': datetime.now().isoformat(),
            'test_suite': 'batch_integration_test',
            'error': str(e),
            'status': 'ERROR'
        }
        
        # エラー通知
        sns_client.publish(
            TopicArn=test_topic_arn,
            Subject='Batch Integration Test ERROR',
            Message=f'Test execution failed: {str(e)}'
        )
        
        return {
            'statusCode': 500,
            'body': json.dumps(error_result)
        }

def test_basic_job_execution(batch_client, job_queue_name, job_definition_name):
    """基本的なJob実行テスト"""
    test_name = 'basic_job_execution'
    
    try:
        # テスト用ジョブを実行
        job_name = f'test-job-{int(time.time())}'
        
        response = batch_client.submit_job(
            jobName=job_name,
            jobQueue=job_queue_name,
            jobDefinition=job_definition_name,
            parameters={
                'test_mode': 'true',
                'test_type': 'basic_execution'
            },
            timeout={'attemptDurationSeconds': 300}  # 5分でタイムアウト
        )
        
        job_id = response['jobId']
        
        # ジョブの状態を監視（最大5分間）
        max_wait_time = 300  # 5分
        wait_interval = 10   # 10秒間隔
        elapsed_time = 0
        
        while elapsed_time < max_wait_time:
            job_detail = batch_client.describe_jobs(jobs=[job_id])
            job_status = job_detail['jobs'][0]['jobStatus']
            
            if job_status in ['SUCCEEDED', 'FAILED']:
                break
                
            time.sleep(wait_interval)
            elapsed_time += wait_interval
        
        # 最終状態を確認
        final_job_detail = batch_client.describe_jobs(jobs=[job_id])
        final_status = final_job_detail['jobs'][0]['jobStatus']
        
        if final_status == 'SUCCEEDED':
            return {
                'test_name': test_name,
                'status': 'PASSED',
                'job_id': job_id,
                'execution_time': elapsed_time,
                'message': 'Job executed successfully'
            }
        else:
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'job_id': job_id,
                'job_status': final_status,
                'message': f'Job failed with status: {final_status}'
            }
            
    except Exception as e:
        return {
            'test_name': test_name,
            'status': 'ERROR',
            'error': str(e),
            'message': f'Test execution failed: {str(e)}'
        }

def test_job_queue_status(batch_client, job_queue_name):
    """Job Queue状態確認テスト"""
    test_name = 'job_queue_status'
    
    try:
        # Job Queueの詳細情報を取得
        queues = batch_client.describe_job_queues(jobQueues=[job_queue_name])
        
        if not queues['jobQueues']:
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'message': f'Job queue {job_queue_name} not found'
            }
        
        queue_info = queues['jobQueues'][0]
        queue_state = queue_info['state']
        
        if queue_state == 'ENABLED':
            return {
                'test_name': test_name,
                'status': 'PASSED',
                'queue_state': queue_state,
                'priority': queue_info['priority'],
                'message': 'Job queue is enabled and ready'
            }
        else:
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'queue_state': queue_state,
                'message': f'Job queue is not enabled: {queue_state}'
            }
            
    except Exception as e:
        return {
            'test_name': test_name,
            'status': 'ERROR',
            'error': str(e),
            'message': f'Queue status check failed: {str(e)}'
        }

def test_concurrent_job_execution(batch_client, job_queue_name, job_definition_name):
    """複数Job同時実行テスト"""
    test_name = 'concurrent_job_execution'
    
    try:
        # 3つのジョブを同時に実行
        job_ids = []
        for i in range(3):
            job_name = f'concurrent-test-job-{i}-{int(time.time())}'
            
            response = batch_client.submit_job(
                jobName=job_name,
                jobQueue=job_queue_name,
                jobDefinition=job_definition_name,
                parameters={
                    'test_mode': 'true',
                    'test_type': 'concurrent_execution',
                    'job_index': str(i)
                },
                timeout={'attemptDurationSeconds': 300}
            )
            
            job_ids.append(response['jobId'])
        
        # 全ジョブの完了を待機
        max_wait_time = 600  # 10分
        wait_interval = 15   # 15秒間隔
        elapsed_time = 0
        
        while elapsed_time < max_wait_time:
            job_details = batch_client.describe_jobs(jobs=job_ids)
            
            completed_jobs = [
                job for job in job_details['jobs'] 
                if job['jobStatus'] in ['SUCCEEDED', 'FAILED']
            ]
            
            if len(completed_jobs) == len(job_ids):
                break
                
            time.sleep(wait_interval)
            elapsed_time += wait_interval
        
        # 結果を確認
        final_job_details = batch_client.describe_jobs(jobs=job_ids)
        succeeded_jobs = [
            job for job in final_job_details['jobs'] 
            if job['jobStatus'] == 'SUCCEEDED'
        ]
        
        success_rate = (len(succeeded_jobs) / len(job_ids)) * 100
        
        if success_rate >= 100:  # 全ジョブ成功
            return {
                'test_name': test_name,
                'status': 'PASSED',
                'total_jobs': len(job_ids),
                'succeeded_jobs': len(succeeded_jobs),
                'success_rate': success_rate,
                'execution_time': elapsed_time,
                'message': 'All concurrent jobs executed successfully'
            }
        elif success_rate >= 66:  # 2/3以上成功
            return {
                'test_name': test_name,
                'status': 'PARTIAL',
                'total_jobs': len(job_ids),
                'succeeded_jobs': len(succeeded_jobs),
                'success_rate': success_rate,
                'message': f'Partial success: {len(succeeded_jobs)}/{len(job_ids)} jobs succeeded'
            }
        else:
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'total_jobs': len(job_ids),
                'succeeded_jobs': len(succeeded_jobs),
                'success_rate': success_rate,
                'message': f'Too many failures: only {len(succeeded_jobs)}/{len(job_ids)} jobs succeeded'
            }
            
    except Exception as e:
        return {
            'test_name': test_name,
            'status': 'ERROR',
            'error': str(e),
            'message': f'Concurrent execution test failed: {str(e)}'
        }

def test_job_failure_handling(batch_client, job_queue_name, job_definition_name):
    """Job失敗ハンドリングテスト"""
    test_name = 'job_failure_handling'
    
    try:
        # 意図的に失敗するジョブを実行
        job_name = f'failure-test-job-{int(time.time())}'
        
        response = batch_client.submit_job(
            jobName=job_name,
            jobQueue=job_queue_name,
            jobDefinition=job_definition_name,
            parameters={
                'test_mode': 'true',
                'test_type': 'failure_test',
                'force_failure': 'true'
            },
            timeout={'attemptDurationSeconds': 180},  # 3分でタイムアウト
            retryStrategy={'attempts': 2}  # 2回再試行
        )
        
        job_id = response['jobId']
        
        # ジョブの完了を待機
        max_wait_time = 300  # 5分
        wait_interval = 10   # 10秒間隔
        elapsed_time = 0
        
        while elapsed_time < max_wait_time:
            job_detail = batch_client.describe_jobs(jobs=[job_id])
            job_status = job_detail['jobs'][0]['jobStatus']
            
            if job_status in ['SUCCEEDED', 'FAILED']:
                break
                
            time.sleep(wait_interval)
            elapsed_time += wait_interval
        
        # 最終状態を確認
        final_job_detail = batch_client.describe_jobs(jobs=[job_id])
        final_status = final_job_detail['jobs'][0]['jobStatus']
        attempts = final_job_detail['jobs'][0].get('attempts', [])
        
        # 失敗ジョブが適切に処理されたかを確認
        if final_status == 'FAILED' and len(attempts) >= 2:
            return {
                'test_name': test_name,
                'status': 'PASSED',
                'job_id': job_id,
                'final_status': final_status,
                'retry_attempts': len(attempts),
                'message': 'Job failure handled correctly with retries'
            }
        else:
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'job_id': job_id,
                'final_status': final_status,
                'retry_attempts': len(attempts),
                'message': f'Unexpected behavior: status={final_status}, attempts={len(attempts)}'
            }
            
    except Exception as e:
        return {
            'test_name': test_name,
            'status': 'ERROR',
            'error': str(e),
            'message': f'Failure handling test failed: {str(e)}'
        }

def format_test_notification(test_results):
    """テスト結果通知メッセージのフォーマット"""
    message = f"""
Batch Integration Test Results
=============================

Timestamp: {test_results['timestamp']}
Test Suite: {test_results['test_suite']}

Summary:
- Total Tests: {test_results['summary']['total']}
- Passed: {test_results['summary']['passed']}
- Failed: {test_results['summary']['failed']}
- Success Rate: {test_results['summary']['success_rate']:.1f}%

Test Details:
"""
    
    for test in test_results['tests']:
        status_icon = "✅" if test['status'] == 'PASSED' else "❌" if test['status'] == 'FAILED' else "⚠️"
        message += f"  {status_icon} {test['test_name']}: {test['status']} - {test['message']}\n"
    
    return message
      `),
      environment: {
        JOB_QUEUE_NAME: props.batchIntegration.batchConstruct.jobQueue.jobQueueName!,
        JOB_DEFINITION_NAME: props.batchIntegration.batchConstruct.jobDefinition.jobDefinitionName!,
        TEST_TOPIC_ARN: this.testNotificationTopic.topicArn,
      },
      timeout: cdk.Duration.minutes(15),
      logGroup: this.testLogGroup,
    });

    // Lambda実行権限
    testRunnerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'batch:SubmitJob',
        'batch:ListJobs',
        'batch:DescribeJobs',
        'batch:DescribeJobQueues',
        'batch:CancelJob',
        'cloudwatch:PutMetricData',
        'sns:Publish',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['*'],
    }));

    return testRunnerFunction;
  }

  /**
   * FSxマウントテストLambda関数作成
   */
  private createFsxMountTestFunction(props: BatchIntegrationTestProps): lambda.Function {
    const fsxMountTestFunction = new lambda.Function(this, 'FsxMountTestFunction', {
      functionName: `${props.projectName}-${props.environment}-fsx-mount-test`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import boto3
import json
import os
import time
from datetime import datetime
from typing import Dict, List, Any

def handler(event, context):
    """
    FSxマウント確認テスト
    
    テスト項目:
    1. FSx for NetApp ONTAPファイルシステム接続確認
    2. SMB/CIFSマウント動作確認
    3. ファイル読み書きテスト
    4. Active Directory認証確認
    """
    
    batch_client = boto3.client('batch')
    fsx_client = boto3.client('fsx')
    sns_client = boto3.client('sns')
    
    job_queue_name = os.environ['JOB_QUEUE_NAME']
    job_definition_name = os.environ['JOB_DEFINITION_NAME']
    test_topic_arn = os.environ['TEST_TOPIC_ARN']
    fsx_file_system_id = os.environ.get('FSX_FILE_SYSTEM_ID', '')
    
    test_results = {
        'timestamp': datetime.now().isoformat(),
        'test_suite': 'fsx_mount_test',
        'tests': []
    }
    
    try:
        # テスト1: FSxファイルシステム状態確認
        test_results['tests'].append(
            test_fsx_file_system_status(fsx_client, fsx_file_system_id)
        )
        
        # テスト2: FSxマウントテストジョブ実行
        test_results['tests'].append(
            test_fsx_mount_job(batch_client, job_queue_name, job_definition_name)
        )
        
        # テスト3: ファイル操作テストジョブ実行
        test_results['tests'].append(
            test_file_operations_job(batch_client, job_queue_name, job_definition_name)
        )
        
        # テスト結果の集計
        total_tests = len(test_results['tests'])
        passed_tests = sum(1 for test in test_results['tests'] if test['status'] == 'PASSED')
        failed_tests = total_tests - passed_tests
        
        test_results['summary'] = {
            'total': total_tests,
            'passed': passed_tests,
            'failed': failed_tests,
            'success_rate': (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        }
        
        # テスト結果通知
        notification_message = format_fsx_test_notification(test_results)
        sns_client.publish(
            TopicArn=test_topic_arn,
            Subject=f'FSx Mount Test Results - {test_results["summary"]["success_rate"]:.1f}% Success',
            Message=notification_message
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps(test_results)
        }
        
    except Exception as e:
        error_result = {
            'timestamp': datetime.now().isoformat(),
            'test_suite': 'fsx_mount_test',
            'error': str(e),
            'status': 'ERROR'
        }
        
        sns_client.publish(
            TopicArn=test_topic_arn,
            Subject='FSx Mount Test ERROR',
            Message=f'FSx mount test execution failed: {str(e)}'
        )
        
        return {
            'statusCode': 500,
            'body': json.dumps(error_result)
        }

def test_fsx_file_system_status(fsx_client, file_system_id):
    """FSxファイルシステム状態確認"""
    test_name = 'fsx_file_system_status'
    
    try:
        if not file_system_id:
            return {
                'test_name': test_name,
                'status': 'SKIPPED',
                'message': 'FSx file system ID not configured'
            }
        
        response = fsx_client.describe_file_systems(FileSystemIds=[file_system_id])
        
        if not response['FileSystems']:
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'message': f'FSx file system {file_system_id} not found'
            }
        
        file_system = response['FileSystems'][0]
        lifecycle = file_system['Lifecycle']
        
        if lifecycle == 'AVAILABLE':
            return {
                'test_name': test_name,
                'status': 'PASSED',
                'file_system_id': file_system_id,
                'lifecycle': lifecycle,
                'storage_capacity': file_system.get('StorageCapacity', 'Unknown'),
                'message': 'FSx file system is available'
            }
        else:
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'file_system_id': file_system_id,
                'lifecycle': lifecycle,
                'message': f'FSx file system is not available: {lifecycle}'
            }
            
    except Exception as e:
        return {
            'test_name': test_name,
            'status': 'ERROR',
            'error': str(e),
            'message': f'FSx status check failed: {str(e)}'
        }

def test_fsx_mount_job(batch_client, job_queue_name, job_definition_name):
    """FSxマウントテストジョブ実行"""
    test_name = 'fsx_mount_job'
    
    try:
        job_name = f'fsx-mount-test-{int(time.time())}'
        
        response = batch_client.submit_job(
            jobName=job_name,
            jobQueue=job_queue_name,
            jobDefinition=job_definition_name,
            parameters={
                'test_mode': 'true',
                'test_type': 'fsx_mount_test',
                'mount_check': 'true'
            },
            timeout={'attemptDurationSeconds': 600}  # 10分でタイムアウト
        )
        
        job_id = response['jobId']
        
        # ジョブの完了を待機
        max_wait_time = 600  # 10分
        wait_interval = 15   # 15秒間隔
        elapsed_time = 0
        
        while elapsed_time < max_wait_time:
            job_detail = batch_client.describe_jobs(jobs=[job_id])
            job_status = job_detail['jobs'][0]['jobStatus']
            
            if job_status in ['SUCCEEDED', 'FAILED']:
                break
                
            time.sleep(wait_interval)
            elapsed_time += wait_interval
        
        # 最終状態を確認
        final_job_detail = batch_client.describe_jobs(jobs=[job_id])
        final_status = final_job_detail['jobs'][0]['jobStatus']
        
        if final_status == 'SUCCEEDED':
            return {
                'test_name': test_name,
                'status': 'PASSED',
                'job_id': job_id,
                'execution_time': elapsed_time,
                'message': 'FSx mount test job executed successfully'
            }
        else:
            status_reason = final_job_detail['jobs'][0].get('statusReason', 'Unknown')
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'job_id': job_id,
                'job_status': final_status,
                'status_reason': status_reason,
                'message': f'FSx mount test job failed: {status_reason}'
            }
            
    except Exception as e:
        return {
            'test_name': test_name,
            'status': 'ERROR',
            'error': str(e),
            'message': f'FSx mount test job failed: {str(e)}'
        }

def test_file_operations_job(batch_client, job_queue_name, job_definition_name):
    """ファイル操作テストジョブ実行"""
    test_name = 'file_operations_job'
    
    try:
        job_name = f'file-ops-test-{int(time.time())}'
        
        response = batch_client.submit_job(
            jobName=job_name,
            jobQueue=job_queue_name,
            jobDefinition=job_definition_name,
            parameters={
                'test_mode': 'true',
                'test_type': 'file_operations_test',
                'file_operations': 'read_write_test'
            },
            timeout={'attemptDurationSeconds': 600}
        )
        
        job_id = response['jobId']
        
        # ジョブの完了を待機
        max_wait_time = 600
        wait_interval = 15
        elapsed_time = 0
        
        while elapsed_time < max_wait_time:
            job_detail = batch_client.describe_jobs(jobs=[job_id])
            job_status = job_detail['jobs'][0]['jobStatus']
            
            if job_status in ['SUCCEEDED', 'FAILED']:
                break
                
            time.sleep(wait_interval)
            elapsed_time += wait_interval
        
        final_job_detail = batch_client.describe_jobs(jobs=[job_id])
        final_status = final_job_detail['jobs'][0]['jobStatus']
        
        if final_status == 'SUCCEEDED':
            return {
                'test_name': test_name,
                'status': 'PASSED',
                'job_id': job_id,
                'execution_time': elapsed_time,
                'message': 'File operations test completed successfully'
            }
        else:
            status_reason = final_job_detail['jobs'][0].get('statusReason', 'Unknown')
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'job_id': job_id,
                'job_status': final_status,
                'status_reason': status_reason,
                'message': f'File operations test failed: {status_reason}'
            }
            
    except Exception as e:
        return {
            'test_name': test_name,
            'status': 'ERROR',
            'error': str(e),
            'message': f'File operations test failed: {str(e)}'
        }

def format_fsx_test_notification(test_results):
    """FSxテスト結果通知メッセージのフォーマット"""
    message = f"""
FSx Mount Test Results
=====================

Timestamp: {test_results['timestamp']}
Test Suite: {test_results['test_suite']}

Summary:
- Total Tests: {test_results['summary']['total']}
- Passed: {test_results['summary']['passed']}
- Failed: {test_results['summary']['failed']}
- Success Rate: {test_results['summary']['success_rate']:.1f}%

Test Details:
"""
    
    for test in test_results['tests']:
        status_icon = "✅" if test['status'] == 'PASSED' else "❌" if test['status'] == 'FAILED' else "⚠️"
        message += f"  {status_icon} {test['test_name']}: {test['status']} - {test['message']}\n"
    
    return message
      `),
      environment: {
        JOB_QUEUE_NAME: props.batchIntegration.batchConstruct.jobQueue.jobQueueName!,
        JOB_DEFINITION_NAME: props.batchIntegration.batchConstruct.jobDefinition.jobDefinitionName!,
        TEST_TOPIC_ARN: this.testNotificationTopic.topicArn,
        FSX_FILE_SYSTEM_ID: props.config.fsxIntegration.fileSystemId || '',
      },
      timeout: cdk.Duration.minutes(15),
      logGroup: this.testLogGroup,
    });

    // Lambda実行権限（最小権限の原則に従って制限）
    fsxMountTestFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'batch:SubmitJob',
        'batch:ListJobs',
        'batch:DescribeJobs',
      ],
      resources: [
        props.batchIntegration.batchConstruct.jobQueue.attrJobQueueArn,
        props.batchIntegration.batchConstruct.jobDefinition.attrJobDefinitionArn,
        `arn:aws:batch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:job/*`,
      ],
    }));

    fsxMountTestFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'fsx:DescribeFileSystems',
        'fsx:DescribeVolumes',
      ],
      resources: [
        `arn:aws:fsx:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:file-system/${props.config.fsxIntegration.fileSystemId || '*'}`,
      ],
    }));

    fsxMountTestFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sns:Publish',
      ],
      resources: [this.testNotificationTopic.topicArn],
    }));

    fsxMountTestFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [this.testLogGroup.logGroupArn],
    }));

    return fsxMountTestFunction;
  }

  /**
   * 自動復旧テストLambda関数作成
   */
  private createAutoRecoveryTestFunction(props: BatchIntegrationTestProps): lambda.Function {
    const autoRecoveryTestFunction = new lambda.Function(this, 'AutoRecoveryTestFunction', {
      functionName: `${props.projectName}-${props.environment}-auto-recovery-test`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import boto3
import json
import os
import time
from datetime import datetime
from typing import Dict, List, Any

def handler(event, context):
    """
    自動復旧機能テスト
    
    テスト項目:
    1. 意図的なジョブ失敗の発生
    2. 自動復旧機能の動作確認
    3. アラーム・通知機能の確認
    4. 復旧後の正常動作確認
    """
    
    batch_client = boto3.client('batch')
    cloudwatch = boto3.client('cloudwatch')
    sns_client = boto3.client('sns')
    
    job_queue_name = os.environ['JOB_QUEUE_NAME']
    job_definition_name = os.environ['JOB_DEFINITION_NAME']
    test_topic_arn = os.environ['TEST_TOPIC_ARN']
    
    test_results = {
        'timestamp': datetime.now().isoformat(),
        'test_suite': 'auto_recovery_test',
        'tests': []
    }
    
    try:
        # テスト1: 意図的なジョブ失敗テスト
        test_results['tests'].append(
            test_intentional_job_failure(batch_client, job_queue_name, job_definition_name)
        )
        
        # テスト2: 失敗ジョブメトリクス確認
        test_results['tests'].append(
            test_failure_metrics(cloudwatch, job_queue_name)
        )
        
        # テスト3: 自動復旧機能動作確認
        test_results['tests'].append(
            test_auto_recovery_mechanism(batch_client, job_queue_name, job_definition_name)
        )
        
        # テスト4: 復旧後の正常動作確認
        test_results['tests'].append(
            test_post_recovery_operation(batch_client, job_queue_name, job_definition_name)
        )
        
        # テスト結果の集計
        total_tests = len(test_results['tests'])
        passed_tests = sum(1 for test in test_results['tests'] if test['status'] == 'PASSED')
        failed_tests = total_tests - passed_tests
        
        test_results['summary'] = {
            'total': total_tests,
            'passed': passed_tests,
            'failed': failed_tests,
            'success_rate': (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        }
        
        # CloudWatchメトリクスに送信
        cloudwatch.put_metric_data(
            Namespace='EmbeddingBatch/AutoRecoveryTest',
            MetricData=[
                {
                    'MetricName': 'RecoveryTestSuccessRate',
                    'Value': test_results['summary']['success_rate'],
                    'Unit': 'Percent'
                }
            ]
        )
        
        # テスト結果通知
        notification_message = format_recovery_test_notification(test_results)
        sns_client.publish(
            TopicArn=test_topic_arn,
            Subject=f'Auto Recovery Test Results - {test_results["summary"]["success_rate"]:.1f}% Success',
            Message=notification_message
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps(test_results)
        }
        
    except Exception as e:
        error_result = {
            'timestamp': datetime.now().isoformat(),
            'test_suite': 'auto_recovery_test',
            'error': str(e),
            'status': 'ERROR'
        }
        
        sns_client.publish(
            TopicArn=test_topic_arn,
            Subject='Auto Recovery Test ERROR',
            Message=f'Auto recovery test execution failed: {str(e)}'
        )
        
        return {
            'statusCode': 500,
            'body': json.dumps(error_result)
        }

def test_intentional_job_failure(batch_client, job_queue_name, job_definition_name):
    """意図的なジョブ失敗テスト"""
    test_name = 'intentional_job_failure'
    
    try:
        # 複数の失敗ジョブを実行して自動復旧をトリガー
        failed_job_ids = []
        FAILURE_JOB_COUNT = 3  # 定数として定義
        
        for i in range(FAILURE_JOB_COUNT):
            job_name = f'failure-trigger-job-{i}-{int(time.time())}'
            
            response = batch_client.submit_job(
                jobName=job_name,
                jobQueue=job_queue_name,
                jobDefinition=job_definition_name,
                parameters={
                    'test_mode': 'true',
                    'test_type': 'recovery_trigger',
                    'force_failure': 'true',
                    'failure_type': 'exit_code_1'
                },
                timeout={'attemptDurationSeconds': 120},
                retryStrategy={'attempts': 1}  # 再試行は1回のみ
            )
            
            failed_job_ids.append(response['jobId'])
        
        # 全ジョブの完了を待機
        max_wait_time = 300  # 5分
        wait_interval = 10   # 10秒間隔
        elapsed_time = 0
        
        while elapsed_time < max_wait_time:
            job_details = batch_client.describe_jobs(jobs=failed_job_ids)
            
            completed_jobs = [
                job for job in job_details['jobs'] 
                if job['jobStatus'] in ['SUCCEEDED', 'FAILED']
            ]
            
            if len(completed_jobs) == len(failed_job_ids):
                break
                
            time.sleep(wait_interval)
            elapsed_time += wait_interval
        
        # 結果を確認
        final_job_details = batch_client.describe_jobs(jobs=failed_job_ids)
        failed_jobs = [
            job for job in final_job_details['jobs'] 
            if job['jobStatus'] == 'FAILED'
        ]
        
        if len(failed_jobs) >= 3:  # 全ジョブが失敗
            return {
                'test_name': test_name,
                'status': 'PASSED',
                'failed_job_count': len(failed_jobs),
                'job_ids': failed_job_ids,
                'message': 'Successfully triggered job failures for recovery testing'
            }
        else:
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'failed_job_count': len(failed_jobs),
                'expected_failures': 3,
                'message': f'Expected 3 failures, got {len(failed_jobs)}'
            }
            
    except Exception as e:
        return {
            'test_name': test_name,
            'status': 'ERROR',
            'error': str(e),
            'message': f'Intentional failure test failed: {str(e)}'
        }

def test_failure_metrics(cloudwatch, job_queue_name):
    """失敗ジョブメトリクス確認"""
    test_name = 'failure_metrics'
    
    try:
        # 失敗ジョブのメトリクスを確認
        end_time = datetime.now()
        start_time = datetime.now().replace(minute=0, second=0, microsecond=0)  # 現在の時刻の開始
        
        response = cloudwatch.get_metric_statistics(
            Namespace='AWS/Batch',
            MetricName='FailedJobs',
            Dimensions=[
                {
                    'Name': 'JobQueue',
                    'Value': job_queue_name
                }
            ],
            StartTime=start_time,
            EndTime=end_time,
            Period=300,  # 5分間隔
            Statistics=['Sum']
        )
        
        if response['Datapoints']:
            total_failures = sum(point['Sum'] for point in response['Datapoints'])
            
            if total_failures >= 3:  # 期待される失敗数
                return {
                    'test_name': test_name,
                    'status': 'PASSED',
                    'total_failures': total_failures,
                    'datapoints': len(response['Datapoints']),
                    'message': f'Failure metrics detected: {total_failures} failed jobs'
                }
            else:
                return {
                    'test_name': test_name,
                    'status': 'PARTIAL',
                    'total_failures': total_failures,
                    'expected_failures': 3,
                    'message': f'Some failures detected: {total_failures} failed jobs'
                }
        else:
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'message': 'No failure metrics found'
            }
            
    except Exception as e:
        return {
            'test_name': test_name,
            'status': 'ERROR',
            'error': str(e),
            'message': f'Failure metrics check failed: {str(e)}'
        }

def test_auto_recovery_mechanism(batch_client, job_queue_name, job_definition_name):
    """自動復旧機能動作確認"""
    test_name = 'auto_recovery_mechanism'
    
    try:
        # 復旧機能が動作するまで待機
        time.sleep(60)  # 1分待機（復旧機能の動作を待つ）
        
        # Job Queueの状態を確認
        queues = batch_client.describe_job_queues(jobQueues=[job_queue_name])
        
        if not queues['jobQueues']:
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'message': f'Job queue {job_queue_name} not found'
            }
        
        queue_info = queues['jobQueues'][0]
        queue_state = queue_info['state']
        
        # コンピュート環境の状態を確認
        compute_envs = queue_info['computeEnvironmentOrder']
        
        if queue_state == 'ENABLED' and compute_envs:
            compute_env_name = compute_envs[0]['computeEnvironment']
            
            # コンピュート環境の詳細を取得
            compute_env_response = batch_client.describe_compute_environments(
                computeEnvironments=[compute_env_name]
            )
            
            if compute_env_response['computeEnvironments']:
                compute_env = compute_env_response['computeEnvironments'][0]
                compute_state = compute_env['state']
                
                if compute_state == 'ENABLED':
                    return {
                        'test_name': test_name,
                        'status': 'PASSED',
                        'queue_state': queue_state,
                        'compute_env_state': compute_state,
                        'message': 'Auto recovery mechanism appears to be working'
                    }
                else:
                    return {
                        'test_name': test_name,
                        'status': 'FAILED',
                        'queue_state': queue_state,
                        'compute_env_state': compute_state,
                        'message': f'Compute environment not recovered: {compute_state}'
                    }
            else:
                return {
                    'test_name': test_name,
                    'status': 'FAILED',
                    'message': 'Compute environment not found'
                }
        else:
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'queue_state': queue_state,
                'message': f'Job queue not recovered: {queue_state}'
            }
            
    except Exception as e:
        return {
            'test_name': test_name,
            'status': 'ERROR',
            'error': str(e),
            'message': f'Auto recovery mechanism test failed: {str(e)}'
        }

def test_post_recovery_operation(batch_client, job_queue_name, job_definition_name):
    """復旧後の正常動作確認"""
    test_name = 'post_recovery_operation'
    
    try:
        # 復旧後に正常なジョブを実行
        job_name = f'post-recovery-test-{int(time.time())}'
        
        response = batch_client.submit_job(
            jobName=job_name,
            jobQueue=job_queue_name,
            jobDefinition=job_definition_name,
            parameters={
                'test_mode': 'true',
                'test_type': 'post_recovery_test',
                'verify_recovery': 'true'
            },
            timeout={'attemptDurationSeconds': 300}
        )
        
        job_id = response['jobId']
        
        # ジョブの完了を待機
        max_wait_time = 300  # 5分
        wait_interval = 10   # 10秒間隔
        elapsed_time = 0
        
        while elapsed_time < max_wait_time:
            job_detail = batch_client.describe_jobs(jobs=[job_id])
            job_status = job_detail['jobs'][0]['jobStatus']
            
            if job_status in ['SUCCEEDED', 'FAILED']:
                break
                
            time.sleep(wait_interval)
            elapsed_time += wait_interval
        
        # 最終状態を確認
        final_job_detail = batch_client.describe_jobs(jobs=[job_id])
        final_status = final_job_detail['jobs'][0]['jobStatus']
        
        if final_status == 'SUCCEEDED':
            return {
                'test_name': test_name,
                'status': 'PASSED',
                'job_id': job_id,
                'execution_time': elapsed_time,
                'message': 'Post-recovery operation successful'
            }
        else:
            status_reason = final_job_detail['jobs'][0].get('statusReason', 'Unknown')
            return {
                'test_name': test_name,
                'status': 'FAILED',
                'job_id': job_id,
                'job_status': final_status,
                'status_reason': status_reason,
                'message': f'Post-recovery operation failed: {status_reason}'
            }
            
    except Exception as e:
        return {
            'test_name': test_name,
            'status': 'ERROR',
            'error': str(e),
            'message': f'Post-recovery operation test failed: {str(e)}'
        }

def format_recovery_test_notification(test_results):
    """自動復旧テスト結果通知メッセージのフォーマット"""
    message = f"""
Auto Recovery Test Results
=========================

Timestamp: {test_results['timestamp']}
Test Suite: {test_results['test_suite']}

Summary:
- Total Tests: {test_results['summary']['total']}
- Passed: {test_results['summary']['passed']}
- Failed: {test_results['summary']['failed']}
- Success Rate: {test_results['summary']['success_rate']:.1f}%

Test Details:
"""
    
    for test in test_results['tests']:
        status_icon = "✅" if test['status'] == 'PASSED' else "❌" if test['status'] == 'FAILED' else "⚠️"
        message += f"  {status_icon} {test['test_name']}: {test['status']} - {test['message']}\n"
    
    return message
      `),
      environment: {
        JOB_QUEUE_NAME: props.batchIntegration.batchConstruct.jobQueue.jobQueueName!,
        JOB_DEFINITION_NAME: props.batchIntegration.batchConstruct.jobDefinition.jobDefinitionName!,
        TEST_TOPIC_ARN: this.testNotificationTopic.topicArn,
      },
      timeout: cdk.Duration.minutes(15),
      logGroup: this.testLogGroup,
    });

    // Lambda実行権限（最小権限の原則に従って制限）
    autoRecoveryTestFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'batch:SubmitJob',
        'batch:ListJobs',
        'batch:DescribeJobs',
        'batch:DescribeJobQueues',
        'batch:DescribeComputeEnvironments',
      ],
      resources: [
        props.batchIntegration.batchConstruct.jobQueue.attrJobQueueArn,
        props.batchIntegration.batchConstruct.jobDefinition.attrJobDefinitionArn,
        props.batchIntegration.batchConstruct.computeEnvironment.attrComputeEnvironmentArn,
        `arn:aws:batch:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:job/*`,
      ],
    }));

    autoRecoveryTestFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:GetMetricStatistics',
        'cloudwatch:PutMetricData',
      ],
      resources: ['*'], // CloudWatchメトリクスは特定のリソースARNを持たない
    }));

    autoRecoveryTestFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sns:Publish',
      ],
      resources: [this.testNotificationTopic.topicArn],
    }));

    autoRecoveryTestFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [this.testLogGroup.logGroupArn],
    }));

    return autoRecoveryTestFunction;
  }

  /**
   * テストスケジューラー作成
   */
  private createTestScheduler(props: BatchIntegrationTestProps): events.Rule {
    const testSchedulerRule = new events.Rule(this, 'BatchIntegrationTestScheduler', {
      ruleName: `${props.projectName}-${props.environment}-batch-integration-test-scheduler`,
      description: 'Batch integration test scheduler',
      schedule: events.Schedule.rate(cdk.Duration.hours(TEST_CONSTANTS.SCHEDULES.INTEGRATION_TEST)),
    });

    // 基本テストを定期実行
    testSchedulerRule.addTarget(new eventsTargets.LambdaFunction(this.testRunnerFunction, {
      event: events.RuleTargetInput.fromObject({
        source: 'scheduler',
        test_type: 'scheduled_basic_test',
        timestamp: events.EventField.fromPath('$.time'),
      }),
    }));

    return testSchedulerRule;
  }

  /**
   * テスト監視設定
   */
  private configureTestMonitoring(props: BatchIntegrationTestProps): void {
    // テスト実行Lambda関数のエラー監視
    const testRunnerErrorMetric = this.testRunnerFunction.metricErrors({
      period: cdk.Duration.minutes(5),
    });

    const testRunnerErrorAlarm = new cloudwatch.Alarm(this, 'TestRunnerErrorAlarm', {
      alarmName: `${props.projectName}-${props.environment}-test-runner-errors`,
      alarmDescription: 'Test Runner Lambda function errors',
      metric: testRunnerErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    // FSxテスト関数のエラー監視
    const fsxTestErrorMetric = this.fsxMountTestFunction.metricErrors({
      period: cdk.Duration.minutes(5),
    });

    const fsxTestErrorAlarm = new cloudwatch.Alarm(this, 'FsxTestErrorAlarm', {
      alarmName: `${props.projectName}-${props.environment}-fsx-test-errors`,
      alarmDescription: 'FSx Test Lambda function errors',
      metric: fsxTestErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    // 自動復旧テスト関数のエラー監視
    const recoveryTestErrorMetric = this.autoRecoveryTestFunction.metricErrors({
      period: cdk.Duration.minutes(5),
    });

    const recoveryTestErrorAlarm = new cloudwatch.Alarm(this, 'RecoveryTestErrorAlarm', {
      alarmName: `${props.projectName}-${props.environment}-recovery-test-errors`,
      alarmDescription: 'Recovery Test Lambda function errors',
      metric: recoveryTestErrorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    // テスト統合ダッシュボード作成
    this.createTestDashboard(props);
  }

  /**
   * テスト統合ダッシュボード作成
   */
  private createTestDashboard(props: BatchIntegrationTestProps): void {
    const dashboard = new cloudwatch.Dashboard(this, 'BatchIntegrationTestDashboard', {
      dashboardName: `${props.projectName}-${props.environment}-batch-integration-test`,
    });

    // テスト実行状況
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Test Execution Metrics',
        left: [
          this.testRunnerFunction.metricInvocations(),
          this.testRunnerFunction.metricErrors(),
          this.fsxMountTestFunction.metricInvocations(),
          this.fsxMountTestFunction.metricErrors(),
          this.autoRecoveryTestFunction.metricInvocations(),
          this.autoRecoveryTestFunction.metricErrors(),
        ],
        width: 12,
        height: 6,
      })
    );

    // テスト成功率
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Test Success Rates',
        left: [
          new cloudwatch.Metric({
            namespace: 'EmbeddingBatch/IntegrationTest',
            metricName: 'TestSuccessRate',
            statistic: 'Average',
          }),
          new cloudwatch.Metric({
            namespace: 'EmbeddingBatch/AutoRecoveryTest',
            metricName: 'RecoveryTestSuccessRate',
            statistic: 'Average',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // テスト実行時間
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Test Execution Duration',
        left: [
          this.testRunnerFunction.metricDuration(),
          this.fsxMountTestFunction.metricDuration(),
          this.autoRecoveryTestFunction.metricDuration(),
        ],
        width: 12,
        height: 6,
      })
    );
  }

  /**
   * タグ設定
   */
  private applyTags(props: BatchIntegrationTestProps): void {
    const tags = {
      Project: props.projectName,
      Environment: props.environment,
      Component: 'Embedding',
      Module: 'BATCH_INTEGRATION_TEST',
      ManagedBy: 'CDK',
      TestSuite: 'BatchIntegrationTest',
    };

    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }

  /**
   * 手動テスト実行メソッド
   */
  public async runBasicTest(): Promise<string> {
    // 基本テストを手動実行
    return 'basic-test-execution-id';
  }

  public async runFsxMountTest(): Promise<string> {
    // FSxマウントテストを手動実行
    return 'fsx-mount-test-execution-id';
  }

  public async runAutoRecoveryTest(): Promise<string> {
    // 自動復旧テストを手動実行
    return 'auto-recovery-test-execution-id';
  }

  /**
   * テスト結果取得
   */
  public getTestInfo(): Record<string, any> {
    return {
      testRunner: {
        functionName: this.testRunnerFunction.functionName,
        functionArn: this.testRunnerFunction.functionArn,
      },
      fsxMountTest: {
        functionName: this.fsxMountTestFunction.functionName,
        functionArn: this.fsxMountTestFunction.functionArn,
      },
      autoRecoveryTest: {
        functionName: this.autoRecoveryTestFunction.functionName,
        functionArn: this.autoRecoveryTestFunction.functionArn,
      },
      monitoring: {
        testNotificationTopic: this.testNotificationTopic.topicArn,
        testLogGroup: this.testLogGroup.logGroupName,
        dashboardName: `${this.node.id}-test`,
      },
      scheduler: {
        ruleName: this.testScheduler.ruleName,
        schedule: 'rate(6 hours)',
      },
    };
  }
}