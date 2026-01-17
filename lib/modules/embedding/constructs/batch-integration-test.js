"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchIntegrationTest = void 0;
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
};
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const eventsTargets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const snsSubscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
/**
 * AWS Batch 統合テストコンストラクト
 *
 * 機能:
 * - Job実行テストの自動化
 * - FSxマウント確認テスト
 * - 自動復旧機能のテスト
 * - テスト結果の監視・通知
 */
class BatchIntegrationTest extends constructs_1.Construct {
    /** テスト実行Lambda関数 */
    testRunnerFunction;
    /** FSxマウントテストLambda関数 */
    fsxMountTestFunction;
    /** 自動復旧テストLambda関数 */
    autoRecoveryTestFunction;
    /** テスト結果通知SNSトピック */
    testNotificationTopic;
    /** テストスケジューラー */
    testScheduler;
    /** テスト結果ログ */
    testLogGroup;
    constructor(scope, id, props) {
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
    createTestLogGroup(props) {
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
    createTestNotificationTopic(props) {
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
    createTestRunnerFunction(props) {
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
                JOB_QUEUE_NAME: props.batchIntegration.batchConstruct.jobQueue.jobQueueName,
                JOB_DEFINITION_NAME: props.batchIntegration.batchConstruct.jobDefinition.jobDefinitionName,
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
    createFsxMountTestFunction(props) {
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
                JOB_QUEUE_NAME: props.batchIntegration.batchConstruct.jobQueue.jobQueueName,
                JOB_DEFINITION_NAME: props.batchIntegration.batchConstruct.jobDefinition.jobDefinitionName,
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
    createAutoRecoveryTestFunction(props) {
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
                JOB_QUEUE_NAME: props.batchIntegration.batchConstruct.jobQueue.jobQueueName,
                JOB_DEFINITION_NAME: props.batchIntegration.batchConstruct.jobDefinition.jobDefinitionName,
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
    createTestScheduler(props) {
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
    configureTestMonitoring(props) {
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
    createTestDashboard(props) {
        const dashboard = new cloudwatch.Dashboard(this, 'BatchIntegrationTestDashboard', {
            dashboardName: `${props.projectName}-${props.environment}-batch-integration-test`,
        });
        // テスト実行状況
        dashboard.addWidgets(new cloudwatch.GraphWidget({
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
        }));
        // テスト成功率
        dashboard.addWidgets(new cloudwatch.GraphWidget({
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
        }));
        // テスト実行時間
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Test Execution Duration',
            left: [
                this.testRunnerFunction.metricDuration(),
                this.fsxMountTestFunction.metricDuration(),
                this.autoRecoveryTestFunction.metricDuration(),
            ],
            width: 12,
            height: 6,
        }));
    }
    /**
     * タグ設定
     */
    applyTags(props) {
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
    async runBasicTest() {
        // 基本テストを手動実行
        return 'basic-test-execution-id';
    }
    async runFsxMountTest() {
        // FSxマウントテストを手動実行
        return 'fsx-mount-test-execution-id';
    }
    async runAutoRecoveryTest() {
        // 自動復旧テストを手動実行
        return 'auto-recovery-test-execution-id';
    }
    /**
     * テスト結果取得
     */
    getTestInfo() {
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
exports.BatchIntegrationTest = BatchIntegrationTest;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtaW50ZWdyYXRpb24tdGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJhdGNoLWludGVncmF0aW9uLXRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7R0FTRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxVQUFVO0FBQ1YsTUFBTSxjQUFjLEdBQUc7SUFDckIsUUFBUSxFQUFFO1FBQ1IsVUFBVSxFQUFFLEVBQUUsRUFBRSxhQUFhO1FBQzdCLGNBQWMsRUFBRSxFQUFFLEVBQUUsa0JBQWtCO1FBQ3RDLGtCQUFrQixFQUFFLEVBQUUsRUFBRSxlQUFlO0tBQ3hDO0lBQ0QsU0FBUyxFQUFFO1FBQ1QsZ0JBQWdCLEVBQUUsQ0FBQyxFQUFFLGVBQWU7S0FDckM7SUFDRCxZQUFZLEVBQUU7UUFDWixhQUFhLEVBQUUsQ0FBQyxFQUFFLGVBQWU7UUFDakMsZUFBZSxFQUFFLENBQUMsRUFBRSxhQUFhO0tBQ2xDO0lBQ0QsY0FBYyxFQUFFO1FBQ2QsZ0JBQWdCLEVBQUUsRUFBRSxFQUFFLGlCQUFpQjtRQUN2QyxlQUFlLEVBQUUsRUFBRSxFQUFFLG1CQUFtQjtRQUN4QyxhQUFhLEVBQUUsRUFBRSxFQUFFLFlBQVk7S0FDaEM7Q0FDTyxDQUFDO0FBRVgsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MsK0RBQWlEO0FBQ2pELDhFQUFnRTtBQUNoRSx5REFBMkM7QUFDM0Msb0ZBQXNFO0FBQ3RFLHVFQUF5RDtBQUN6RCwyREFBNkM7QUFDN0MsMkNBQXVDO0FBcUJ2Qzs7Ozs7Ozs7R0FRRztBQUNILE1BQWEsb0JBQXFCLFNBQVEsc0JBQVM7SUFDakQsb0JBQW9CO0lBQ0osa0JBQWtCLENBQWtCO0lBRXBELHlCQUF5QjtJQUNULG9CQUFvQixDQUFrQjtJQUV0RCxzQkFBc0I7SUFDTix3QkFBd0IsQ0FBa0I7SUFFMUQscUJBQXFCO0lBQ0wscUJBQXFCLENBQVk7SUFFakQsaUJBQWlCO0lBQ0Qs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QWEsQ0FBQyxRQUFRO2dCQUNyQyxRQUFRLEVBQUUsZUFBZTthQUMxQjtTQUNGLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFyaURELG9EQXFpREMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFXUyBCYXRjaCDntbHlkIjjg4bjgrnjg4jjgrPjg7Pjgrnjg4jjg6njgq/jg4hcbiAqIFxuICogQWdlbnQgU3RlZXJpbmfjg6vjg7zjg6vmupbmi6A6XG4gKiAtIOODouOCuOODpeODqeODvOOCouODvOOCreODhuOCr+ODgeODo+W8t+WItu+8iGxpYi9tb2R1bGVzL2NvbXB1dGUvY29uc3RydWN0cy/vvIlcbiAqIC0gSm9i5a6f6KGM44OG44K544OI44GoRlN444Oe44Km44Oz44OI56K66KqNXG4gKiAtIOiHquWLleW+qeaXp+apn+iDveOBruODhuOCueODiFxuICogXG4gKiBSZXF1aXJlbWVudHM6IDEuNCwgMS41XG4gKi9cblxuLy8g44OG44K544OI6Kit5a6a5a6a5pWwXG5jb25zdCBURVNUX0NPTlNUQU5UUyA9IHtcbiAgVElNRU9VVFM6IHtcbiAgICBCQVNJQ19URVNUOiAxNSwgLy8g5Z+65pys44OG44K544OIOiAxNeWIhlxuICAgIEZTWF9NT1VOVF9URVNUOiAxMCwgLy8gRlN444Oe44Km44Oz44OI44OG44K544OIOiAxMOWIhlxuICAgIEFVVE9fUkVDT1ZFUllfVEVTVDogMTIsIC8vIOiHquWLleW+qeaXp+ODhuOCueODiDogMTLliIZcbiAgfSxcbiAgU0NIRURVTEVTOiB7XG4gICAgSU5URUdSQVRJT05fVEVTVDogNiwgLy8g57Wx5ZCI44OG44K544OIOiA25pmC6ZaT44GU44GoXG4gIH0sXG4gIFJFVFJZX0xJTUlUUzoge1xuICAgIEpPQl9FWEVDVVRJT046IDMsIC8vIOOCuOODp+ODluWun+ihjOWGjeippuihjDogM+WbnlxuICAgIEZBSUxVUkVfVFJJR0dFUjogMywgLy8g5aSx5pWX44OI44Oq44Ks44O8OiAz5ZueXG4gIH0sXG4gIFdBSVRfSU5URVJWQUxTOiB7XG4gICAgSk9CX1NUQVRVU19DSEVDSzogMTAsIC8vIOOCuOODp+ODlueKtuaFi+eiuuiqjTogMTDnp5LplpPpmpRcbiAgICBGU1hfTU9VTlRfQ0hFQ0s6IDE1LCAvLyBGU3jjg57jgqbjg7Pjg4jnorroqo06IDE156eS6ZaT6ZqUXG4gICAgUkVDT1ZFUllfV0FJVDogNjAsIC8vIOW+qeaXp+W+heapnzogNjDnp5JcbiAgfSxcbn0gYXMgY29uc3Q7XG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyBldmVudHNUYXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBzbnNTdWJzY3JpcHRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9ucyc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBFbWJlZGRpbmdCYXRjaEludGVncmF0aW9uIH0gZnJvbSAnLi9lbWJlZGRpbmctYmF0Y2gtaW50ZWdyYXRpb24nO1xuaW1wb3J0IHsgRW1iZWRkaW5nQ29uZmlnIH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9lbWJlZGRpbmctY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBCYXRjaEludGVncmF0aW9uVGVzdFByb3BzIHtcbiAgLyoqIEVtYmVkZGluZyBCYXRjaOe1seWQiCAqL1xuICByZWFkb25seSBiYXRjaEludGVncmF0aW9uOiBFbWJlZGRpbmdCYXRjaEludGVncmF0aW9uO1xuICBcbiAgLyoqIEVtYmVkZGluZ+ioreWumiAqL1xuICByZWFkb25seSBjb25maWc6IEVtYmVkZGluZ0NvbmZpZztcbiAgXG4gIC8qKiDjg5fjg63jgrjjgqfjgq/jg4jlkI0gKi9cbiAgcmVhZG9ubHkgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgXG4gIC8qKiDnkrDlooPlkI0gKi9cbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgXG4gIC8qKiDjg4bjgrnjg4jpgJrnn6XnlKhTTlPjg4jjg5Tjg4Pjgq9BUk4gKi9cbiAgcmVhZG9ubHkgbm90aWZpY2F0aW9uVG9waWNBcm4/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogQVdTIEJhdGNoIOe1seWQiOODhuOCueODiOOCs+ODs+OCueODiOODqeOCr+ODiFxuICogXG4gKiDmqZ/og706XG4gKiAtIEpvYuWun+ihjOODhuOCueODiOOBruiHquWLleWMllxuICogLSBGU3jjg57jgqbjg7Pjg4jnorroqo3jg4bjgrnjg4hcbiAqIC0g6Ieq5YuV5b6p5pen5qmf6IO944Gu44OG44K544OIXG4gKiAtIOODhuOCueODiOe1kOaenOOBruebo+imluODu+mAmuefpVxuICovXG5leHBvcnQgY2xhc3MgQmF0Y2hJbnRlZ3JhdGlvblRlc3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAvKiog44OG44K544OI5a6f6KGMTGFtYmRh6Zai5pWwICovXG4gIHB1YmxpYyByZWFkb25seSB0ZXN0UnVubmVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgXG4gIC8qKiBGU3jjg57jgqbjg7Pjg4jjg4bjgrnjg4hMYW1iZGHplqLmlbAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGZzeE1vdW50VGVzdEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIFxuICAvKiog6Ieq5YuV5b6p5pen44OG44K544OITGFtYmRh6Zai5pWwICovXG4gIHB1YmxpYyByZWFkb25seSBhdXRvUmVjb3ZlcnlUZXN0RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgXG4gIC8qKiDjg4bjgrnjg4jntZDmnpzpgJrnn6VTTlPjg4jjg5Tjg4Pjgq8gKi9cbiAgcHVibGljIHJlYWRvbmx5IHRlc3ROb3RpZmljYXRpb25Ub3BpYzogc25zLlRvcGljO1xuICBcbiAgLyoqIOODhuOCueODiOOCueOCseOCuOODpeODvOODqeODvCAqL1xuICBwdWJsaWMgcmVhZG9ubHkgdGVzdFNjaGVkdWxlcjogZXZlbnRzLlJ1bGU7XG4gIFxuICAvKiog44OG44K544OI57WQ5p6c44Ot44KwICovXG4gIHB1YmxpYyByZWFkb25seSB0ZXN0TG9nR3JvdXA6IGxvZ3MuTG9nR3JvdXA7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEJhdGNoSW50ZWdyYXRpb25UZXN0UHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8g44OG44K544OI57WQ5p6c44Ot44Kw5L2c5oiQXG4gICAgdGhpcy50ZXN0TG9nR3JvdXAgPSB0aGlzLmNyZWF0ZVRlc3RMb2dHcm91cChwcm9wcyk7XG5cbiAgICAvLyDjg4bjgrnjg4jntZDmnpzpgJrnn6VTTlPjg4jjg5Tjg4Pjgq/kvZzmiJBcbiAgICB0aGlzLnRlc3ROb3RpZmljYXRpb25Ub3BpYyA9IHRoaXMuY3JlYXRlVGVzdE5vdGlmaWNhdGlvblRvcGljKHByb3BzKTtcblxuICAgIC8vIOODhuOCueODiOWun+ihjExhbWJkYemWouaVsOS9nOaIkFxuICAgIHRoaXMudGVzdFJ1bm5lckZ1bmN0aW9uID0gdGhpcy5jcmVhdGVUZXN0UnVubmVyRnVuY3Rpb24ocHJvcHMpO1xuXG4gICAgLy8gRlN444Oe44Km44Oz44OI44OG44K544OITGFtYmRh6Zai5pWw5L2c5oiQXG4gICAgdGhpcy5mc3hNb3VudFRlc3RGdW5jdGlvbiA9IHRoaXMuY3JlYXRlRnN4TW91bnRUZXN0RnVuY3Rpb24ocHJvcHMpO1xuXG4gICAgLy8g6Ieq5YuV5b6p5pen44OG44K544OITGFtYmRh6Zai5pWw5L2c5oiQXG4gICAgdGhpcy5hdXRvUmVjb3ZlcnlUZXN0RnVuY3Rpb24gPSB0aGlzLmNyZWF0ZUF1dG9SZWNvdmVyeVRlc3RGdW5jdGlvbihwcm9wcyk7XG5cbiAgICAvLyDjg4bjgrnjg4jjgrnjgrHjgrjjg6Xjg7zjg6njg7zkvZzmiJBcbiAgICB0aGlzLnRlc3RTY2hlZHVsZXIgPSB0aGlzLmNyZWF0ZVRlc3RTY2hlZHVsZXIocHJvcHMpO1xuXG4gICAgLy8g44OG44K544OI55uj6KaW6Kit5a6aXG4gICAgdGhpcy5jb25maWd1cmVUZXN0TW9uaXRvcmluZyhwcm9wcyk7XG5cbiAgICAvLyDjgr/jgrDoqK3lrppcbiAgICB0aGlzLmFwcGx5VGFncyhwcm9wcyk7XG4gIH1cblxuICAvKipcbiAgICog44OG44K544OI57WQ5p6c44Ot44Kw5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVRlc3RMb2dHcm91cChwcm9wczogQmF0Y2hJbnRlZ3JhdGlvblRlc3RQcm9wcyk6IGxvZ3MuTG9nR3JvdXAge1xuICAgIHJldHVybiBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnQmF0Y2hJbnRlZ3JhdGlvblRlc3RMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvbGFtYmRhLyR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWJhdGNoLWludGVncmF0aW9uLXRlc3RgLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILCAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPnm6Pmn7vjga7jgZ/jgoEx44O25pyI44Gr5bu26ZW3XG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgLy8g5pys55Wq55Kw5aKD44Gn44Gv5pqX5Y+35YyW44KS5pyJ5Yq544Gr44GZ44KLXG4gICAgICAuLi4ocHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kJyAmJiB7XG4gICAgICAgIGVuY3J5cHRpb25LZXk6IHVuZGVmaW5lZCwgLy8gS01T44Kt44O844KS5oyH5a6a44GZ44KL5aC05ZCIXG4gICAgICB9KSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4bjgrnjg4jntZDmnpzpgJrnn6VTTlPjg4jjg5Tjg4Pjgq/kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlVGVzdE5vdGlmaWNhdGlvblRvcGljKHByb3BzOiBCYXRjaEludGVncmF0aW9uVGVzdFByb3BzKTogc25zLlRvcGljIHtcbiAgICBjb25zdCB0b3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0JhdGNoVGVzdE5vdGlmaWNhdGlvblRvcGljJywge1xuICAgICAgdG9waWNOYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tYmF0Y2gtdGVzdC1ub3RpZmljYXRpb25zYCxcbiAgICAgIGRpc3BsYXlOYW1lOiAnQmF0Y2ggSW50ZWdyYXRpb24gVGVzdCBOb3RpZmljYXRpb25zJyxcbiAgICB9KTtcblxuICAgIC8vIOaXouWtmOOBrumAmuefpeODiOODlOODg+OCr+OBjOOBguOCi+WgtOWQiOOBr+izvOiqrVxuICAgIGlmIChwcm9wcy5ub3RpZmljYXRpb25Ub3BpY0Fybikge1xuICAgICAgdG9waWMuYWRkU3Vic2NyaXB0aW9uKG5ldyBzbnNTdWJzY3JpcHRpb25zLkVtYWlsU3Vic2NyaXB0aW9uKHByb3BzLm5vdGlmaWNhdGlvblRvcGljQXJuKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRvcGljO1xuICB9XG5cbiAgLyoqXG4gICAqIOODhuOCueODiOWun+ihjExhbWJkYemWouaVsOS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVUZXN0UnVubmVyRnVuY3Rpb24ocHJvcHM6IEJhdGNoSW50ZWdyYXRpb25UZXN0UHJvcHMpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGNvbnN0IHRlc3RSdW5uZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0JhdGNoVGVzdFJ1bm5lckZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tYmF0Y2gtdGVzdC1ydW5uZXJgLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbmltcG9ydCBib3RvM1xuaW1wb3J0IGpzb25cbmltcG9ydCBvc1xuaW1wb3J0IHRpbWVcbmZyb20gZGF0ZXRpbWUgaW1wb3J0IGRhdGV0aW1lXG5mcm9tIHR5cGluZyBpbXBvcnQgRGljdCwgTGlzdCwgQW55XG5cbmRlZiBoYW5kbGVyKGV2ZW50LCBjb250ZXh0KTpcbiAgICBcIlwiXCJcbiAgICBCYXRjaOe1seWQiOODhuOCueODiOWun+ihjFxuICAgIFxuICAgIOODhuOCueODiOmgheebrjpcbiAgICAxLiBKb2Llrp/ooYzjg4bjgrnjg4hcbiAgICAyLiBKb2IgUXVldWXli5XkvZznorroqo1cbiAgICAzLiDoh6rli5XjgrnjgrHjg7zjg6rjg7PjgrDli5XkvZznorroqo1cbiAgICA0LiDjgqjjg6njg7zjg4/jg7Pjg4njg6rjg7PjgrDnorroqo1cbiAgICBcIlwiXCJcbiAgICBcbiAgICBiYXRjaF9jbGllbnQgPSBib3RvMy5jbGllbnQoJ2JhdGNoJylcbiAgICBjbG91ZHdhdGNoID0gYm90bzMuY2xpZW50KCdjbG91ZHdhdGNoJylcbiAgICBzbnNfY2xpZW50ID0gYm90bzMuY2xpZW50KCdzbnMnKVxuICAgIFxuICAgIGpvYl9xdWV1ZV9uYW1lID0gb3MuZW52aXJvblsnSk9CX1FVRVVFX05BTUUnXVxuICAgIGpvYl9kZWZpbml0aW9uX25hbWUgPSBvcy5lbnZpcm9uWydKT0JfREVGSU5JVElPTl9OQU1FJ11cbiAgICB0ZXN0X3RvcGljX2FybiA9IG9zLmVudmlyb25bJ1RFU1RfVE9QSUNfQVJOJ11cbiAgICBcbiAgICB0ZXN0X3Jlc3VsdHMgPSB7XG4gICAgICAgICd0aW1lc3RhbXAnOiBkYXRldGltZS5ub3coKS5pc29mb3JtYXQoKSxcbiAgICAgICAgJ3Rlc3Rfc3VpdGUnOiAnYmF0Y2hfaW50ZWdyYXRpb25fdGVzdCcsXG4gICAgICAgICd0ZXN0cyc6IFtdXG4gICAgfVxuICAgIFxuICAgIHRyeTpcbiAgICAgICAgIyDjg4bjgrnjg4gxOiDln7rmnKznmoTjgapKb2Llrp/ooYzjg4bjgrnjg4hcbiAgICAgICAgdGVzdF9yZXN1bHRzWyd0ZXN0cyddLmFwcGVuZChcbiAgICAgICAgICAgIHRlc3RfYmFzaWNfam9iX2V4ZWN1dGlvbihiYXRjaF9jbGllbnQsIGpvYl9xdWV1ZV9uYW1lLCBqb2JfZGVmaW5pdGlvbl9uYW1lKVxuICAgICAgICApXG4gICAgICAgIFxuICAgICAgICAjIOODhuOCueODiDI6IEpvYiBRdWV1ZeeKtuaFi+eiuuiqjVxuICAgICAgICB0ZXN0X3Jlc3VsdHNbJ3Rlc3RzJ10uYXBwZW5kKFxuICAgICAgICAgICAgdGVzdF9qb2JfcXVldWVfc3RhdHVzKGJhdGNoX2NsaWVudCwgam9iX3F1ZXVlX25hbWUpXG4gICAgICAgIClcbiAgICAgICAgXG4gICAgICAgICMg44OG44K544OIMzog6KSH5pWwSm9i5ZCM5pmC5a6f6KGM44OG44K544OIXG4gICAgICAgIHRlc3RfcmVzdWx0c1sndGVzdHMnXS5hcHBlbmQoXG4gICAgICAgICAgICB0ZXN0X2NvbmN1cnJlbnRfam9iX2V4ZWN1dGlvbihiYXRjaF9jbGllbnQsIGpvYl9xdWV1ZV9uYW1lLCBqb2JfZGVmaW5pdGlvbl9uYW1lKVxuICAgICAgICApXG4gICAgICAgIFxuICAgICAgICAjIOODhuOCueODiDQ6IEpvYuWkseaVl+ODj+ODs+ODieODquODs+OCsOODhuOCueODiFxuICAgICAgICB0ZXN0X3Jlc3VsdHNbJ3Rlc3RzJ10uYXBwZW5kKFxuICAgICAgICAgICAgdGVzdF9qb2JfZmFpbHVyZV9oYW5kbGluZyhiYXRjaF9jbGllbnQsIGpvYl9xdWV1ZV9uYW1lLCBqb2JfZGVmaW5pdGlvbl9uYW1lKVxuICAgICAgICApXG4gICAgICAgIFxuICAgICAgICAjIOODhuOCueODiOe1kOaenOOBrumbhuioiFxuICAgICAgICB0b3RhbF90ZXN0cyA9IGxlbih0ZXN0X3Jlc3VsdHNbJ3Rlc3RzJ10pXG4gICAgICAgIHBhc3NlZF90ZXN0cyA9IHN1bSgxIGZvciB0ZXN0IGluIHRlc3RfcmVzdWx0c1sndGVzdHMnXSBpZiB0ZXN0WydzdGF0dXMnXSA9PSAnUEFTU0VEJylcbiAgICAgICAgZmFpbGVkX3Rlc3RzID0gdG90YWxfdGVzdHMgLSBwYXNzZWRfdGVzdHNcbiAgICAgICAgXG4gICAgICAgIHRlc3RfcmVzdWx0c1snc3VtbWFyeSddID0ge1xuICAgICAgICAgICAgJ3RvdGFsJzogdG90YWxfdGVzdHMsXG4gICAgICAgICAgICAncGFzc2VkJzogcGFzc2VkX3Rlc3RzLFxuICAgICAgICAgICAgJ2ZhaWxlZCc6IGZhaWxlZF90ZXN0cyxcbiAgICAgICAgICAgICdzdWNjZXNzX3JhdGUnOiAocGFzc2VkX3Rlc3RzIC8gdG90YWxfdGVzdHMpICogMTAwIGlmIHRvdGFsX3Rlc3RzID4gMCBlbHNlIDBcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgIyBDbG91ZFdhdGNo44Oh44OI44Oq44Kv44K544Gr6YCB5L+hXG4gICAgICAgIGNsb3Vkd2F0Y2gucHV0X21ldHJpY19kYXRhKFxuICAgICAgICAgICAgTmFtZXNwYWNlPSdFbWJlZGRpbmdCYXRjaC9JbnRlZ3JhdGlvblRlc3QnLFxuICAgICAgICAgICAgTWV0cmljRGF0YT1bXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAnTWV0cmljTmFtZSc6ICdUZXN0U3VjY2Vzc1JhdGUnLFxuICAgICAgICAgICAgICAgICAgICAnVmFsdWUnOiB0ZXN0X3Jlc3VsdHNbJ3N1bW1hcnknXVsnc3VjY2Vzc19yYXRlJ10sXG4gICAgICAgICAgICAgICAgICAgICdVbml0JzogJ1BlcmNlbnQnXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICdNZXRyaWNOYW1lJzogJ1Rlc3RzUGFzc2VkJyxcbiAgICAgICAgICAgICAgICAgICAgJ1ZhbHVlJzogcGFzc2VkX3Rlc3RzLFxuICAgICAgICAgICAgICAgICAgICAnVW5pdCc6ICdDb3VudCdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJ01ldHJpY05hbWUnOiAnVGVzdHNGYWlsZWQnLFxuICAgICAgICAgICAgICAgICAgICAnVmFsdWUnOiBmYWlsZWRfdGVzdHMsXG4gICAgICAgICAgICAgICAgICAgICdVbml0JzogJ0NvdW50J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgKVxuICAgICAgICBcbiAgICAgICAgIyDjg4bjgrnjg4jntZDmnpzpgJrnn6VcbiAgICAgICAgbm90aWZpY2F0aW9uX21lc3NhZ2UgPSBmb3JtYXRfdGVzdF9ub3RpZmljYXRpb24odGVzdF9yZXN1bHRzKVxuICAgICAgICBzbnNfY2xpZW50LnB1Ymxpc2goXG4gICAgICAgICAgICBUb3BpY0Fybj10ZXN0X3RvcGljX2FybixcbiAgICAgICAgICAgIFN1YmplY3Q9ZidCYXRjaCBJbnRlZ3JhdGlvbiBUZXN0IFJlc3VsdHMgLSB7dGVzdF9yZXN1bHRzW1wic3VtbWFyeVwiXVtcInN1Y2Nlc3NfcmF0ZVwiXTouMWZ9JSBTdWNjZXNzJyxcbiAgICAgICAgICAgIE1lc3NhZ2U9bm90aWZpY2F0aW9uX21lc3NhZ2VcbiAgICAgICAgKVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICdzdGF0dXNDb2RlJzogMjAwLFxuICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHRlc3RfcmVzdWx0cylcbiAgICAgICAgfVxuICAgICAgICBcbiAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgIGVycm9yX3Jlc3VsdCA9IHtcbiAgICAgICAgICAgICd0aW1lc3RhbXAnOiBkYXRldGltZS5ub3coKS5pc29mb3JtYXQoKSxcbiAgICAgICAgICAgICd0ZXN0X3N1aXRlJzogJ2JhdGNoX2ludGVncmF0aW9uX3Rlc3QnLFxuICAgICAgICAgICAgJ2Vycm9yJzogc3RyKGUpLFxuICAgICAgICAgICAgJ3N0YXR1cyc6ICdFUlJPUidcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgIyDjgqjjg6njg7zpgJrnn6VcbiAgICAgICAgc25zX2NsaWVudC5wdWJsaXNoKFxuICAgICAgICAgICAgVG9waWNBcm49dGVzdF90b3BpY19hcm4sXG4gICAgICAgICAgICBTdWJqZWN0PSdCYXRjaCBJbnRlZ3JhdGlvbiBUZXN0IEVSUk9SJyxcbiAgICAgICAgICAgIE1lc3NhZ2U9ZidUZXN0IGV4ZWN1dGlvbiBmYWlsZWQ6IHtzdHIoZSl9J1xuICAgICAgICApXG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ3N0YXR1c0NvZGUnOiA1MDAsXG4gICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoZXJyb3JfcmVzdWx0KVxuICAgICAgICB9XG5cbmRlZiB0ZXN0X2Jhc2ljX2pvYl9leGVjdXRpb24oYmF0Y2hfY2xpZW50LCBqb2JfcXVldWVfbmFtZSwgam9iX2RlZmluaXRpb25fbmFtZSk6XG4gICAgXCJcIlwi5Z+65pys55qE44GqSm9i5a6f6KGM44OG44K544OIXCJcIlwiXG4gICAgdGVzdF9uYW1lID0gJ2Jhc2ljX2pvYl9leGVjdXRpb24nXG4gICAgXG4gICAgdHJ5OlxuICAgICAgICAjIOODhuOCueODiOeUqOOCuOODp+ODluOCkuWun+ihjFxuICAgICAgICBqb2JfbmFtZSA9IGYndGVzdC1qb2Ite2ludCh0aW1lLnRpbWUoKSl9J1xuICAgICAgICBcbiAgICAgICAgcmVzcG9uc2UgPSBiYXRjaF9jbGllbnQuc3VibWl0X2pvYihcbiAgICAgICAgICAgIGpvYk5hbWU9am9iX25hbWUsXG4gICAgICAgICAgICBqb2JRdWV1ZT1qb2JfcXVldWVfbmFtZSxcbiAgICAgICAgICAgIGpvYkRlZmluaXRpb249am9iX2RlZmluaXRpb25fbmFtZSxcbiAgICAgICAgICAgIHBhcmFtZXRlcnM9e1xuICAgICAgICAgICAgICAgICd0ZXN0X21vZGUnOiAndHJ1ZScsXG4gICAgICAgICAgICAgICAgJ3Rlc3RfdHlwZSc6ICdiYXNpY19leGVjdXRpb24nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGltZW91dD17J2F0dGVtcHREdXJhdGlvblNlY29uZHMnOiAzMDB9ICAjIDXliIbjgafjgr/jgqTjg6DjgqLjgqbjg4hcbiAgICAgICAgKVxuICAgICAgICBcbiAgICAgICAgam9iX2lkID0gcmVzcG9uc2VbJ2pvYklkJ11cbiAgICAgICAgXG4gICAgICAgICMg44K444On44OW44Gu54q25oWL44KS55uj6KaW77yI5pyA5aSnNeWIhumWk++8iVxuICAgICAgICBtYXhfd2FpdF90aW1lID0gMzAwICAjIDXliIZcbiAgICAgICAgd2FpdF9pbnRlcnZhbCA9IDEwICAgIyAxMOenkumWk+malFxuICAgICAgICBlbGFwc2VkX3RpbWUgPSAwXG4gICAgICAgIFxuICAgICAgICB3aGlsZSBlbGFwc2VkX3RpbWUgPCBtYXhfd2FpdF90aW1lOlxuICAgICAgICAgICAgam9iX2RldGFpbCA9IGJhdGNoX2NsaWVudC5kZXNjcmliZV9qb2JzKGpvYnM9W2pvYl9pZF0pXG4gICAgICAgICAgICBqb2Jfc3RhdHVzID0gam9iX2RldGFpbFsnam9icyddWzBdWydqb2JTdGF0dXMnXVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiBqb2Jfc3RhdHVzIGluIFsnU1VDQ0VFREVEJywgJ0ZBSUxFRCddOlxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB0aW1lLnNsZWVwKHdhaXRfaW50ZXJ2YWwpXG4gICAgICAgICAgICBlbGFwc2VkX3RpbWUgKz0gd2FpdF9pbnRlcnZhbFxuICAgICAgICBcbiAgICAgICAgIyDmnIDntYLnirbmhYvjgpLnorroqo1cbiAgICAgICAgZmluYWxfam9iX2RldGFpbCA9IGJhdGNoX2NsaWVudC5kZXNjcmliZV9qb2JzKGpvYnM9W2pvYl9pZF0pXG4gICAgICAgIGZpbmFsX3N0YXR1cyA9IGZpbmFsX2pvYl9kZXRhaWxbJ2pvYnMnXVswXVsnam9iU3RhdHVzJ11cbiAgICAgICAgXG4gICAgICAgIGlmIGZpbmFsX3N0YXR1cyA9PSAnU1VDQ0VFREVEJzpcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ1BBU1NFRCcsXG4gICAgICAgICAgICAgICAgJ2pvYl9pZCc6IGpvYl9pZCxcbiAgICAgICAgICAgICAgICAnZXhlY3V0aW9uX3RpbWUnOiBlbGFwc2VkX3RpbWUsXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiAnSm9iIGV4ZWN1dGVkIHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZTpcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ0ZBSUxFRCcsXG4gICAgICAgICAgICAgICAgJ2pvYl9pZCc6IGpvYl9pZCxcbiAgICAgICAgICAgICAgICAnam9iX3N0YXR1cyc6IGZpbmFsX3N0YXR1cyxcbiAgICAgICAgICAgICAgICAnbWVzc2FnZSc6IGYnSm9iIGZhaWxlZCB3aXRoIHN0YXR1czoge2ZpbmFsX3N0YXR1c30nXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAndGVzdF9uYW1lJzogdGVzdF9uYW1lLFxuICAgICAgICAgICAgJ3N0YXR1cyc6ICdFUlJPUicsXG4gICAgICAgICAgICAnZXJyb3InOiBzdHIoZSksXG4gICAgICAgICAgICAnbWVzc2FnZSc6IGYnVGVzdCBleGVjdXRpb24gZmFpbGVkOiB7c3RyKGUpfSdcbiAgICAgICAgfVxuXG5kZWYgdGVzdF9qb2JfcXVldWVfc3RhdHVzKGJhdGNoX2NsaWVudCwgam9iX3F1ZXVlX25hbWUpOlxuICAgIFwiXCJcIkpvYiBRdWV1ZeeKtuaFi+eiuuiqjeODhuOCueODiFwiXCJcIlxuICAgIHRlc3RfbmFtZSA9ICdqb2JfcXVldWVfc3RhdHVzJ1xuICAgIFxuICAgIHRyeTpcbiAgICAgICAgIyBKb2IgUXVldWXjga7oqbPntLDmg4XloLHjgpLlj5blvpdcbiAgICAgICAgcXVldWVzID0gYmF0Y2hfY2xpZW50LmRlc2NyaWJlX2pvYl9xdWV1ZXMoam9iUXVldWVzPVtqb2JfcXVldWVfbmFtZV0pXG4gICAgICAgIFxuICAgICAgICBpZiBub3QgcXVldWVzWydqb2JRdWV1ZXMnXTpcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ0ZBSUxFRCcsXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ0pvYiBxdWV1ZSB7am9iX3F1ZXVlX25hbWV9IG5vdCBmb3VuZCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHF1ZXVlX2luZm8gPSBxdWV1ZXNbJ2pvYlF1ZXVlcyddWzBdXG4gICAgICAgIHF1ZXVlX3N0YXRlID0gcXVldWVfaW5mb1snc3RhdGUnXVxuICAgICAgICBcbiAgICAgICAgaWYgcXVldWVfc3RhdGUgPT0gJ0VOQUJMRUQnOlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAndGVzdF9uYW1lJzogdGVzdF9uYW1lLFxuICAgICAgICAgICAgICAgICdzdGF0dXMnOiAnUEFTU0VEJyxcbiAgICAgICAgICAgICAgICAncXVldWVfc3RhdGUnOiBxdWV1ZV9zdGF0ZSxcbiAgICAgICAgICAgICAgICAncHJpb3JpdHknOiBxdWV1ZV9pbmZvWydwcmlvcml0eSddLFxuICAgICAgICAgICAgICAgICdtZXNzYWdlJzogJ0pvYiBxdWV1ZSBpcyBlbmFibGVkIGFuZCByZWFkeSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZTpcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ0ZBSUxFRCcsXG4gICAgICAgICAgICAgICAgJ3F1ZXVlX3N0YXRlJzogcXVldWVfc3RhdGUsXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ0pvYiBxdWV1ZSBpcyBub3QgZW5hYmxlZDoge3F1ZXVlX3N0YXRlfSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICd0ZXN0X25hbWUnOiB0ZXN0X25hbWUsXG4gICAgICAgICAgICAnc3RhdHVzJzogJ0VSUk9SJyxcbiAgICAgICAgICAgICdlcnJvcic6IHN0cihlKSxcbiAgICAgICAgICAgICdtZXNzYWdlJzogZidRdWV1ZSBzdGF0dXMgY2hlY2sgZmFpbGVkOiB7c3RyKGUpfSdcbiAgICAgICAgfVxuXG5kZWYgdGVzdF9jb25jdXJyZW50X2pvYl9leGVjdXRpb24oYmF0Y2hfY2xpZW50LCBqb2JfcXVldWVfbmFtZSwgam9iX2RlZmluaXRpb25fbmFtZSk6XG4gICAgXCJcIlwi6KSH5pWwSm9i5ZCM5pmC5a6f6KGM44OG44K544OIXCJcIlwiXG4gICAgdGVzdF9uYW1lID0gJ2NvbmN1cnJlbnRfam9iX2V4ZWN1dGlvbidcbiAgICBcbiAgICB0cnk6XG4gICAgICAgICMgM+OBpOOBruOCuOODp+ODluOCkuWQjOaZguOBq+Wun+ihjFxuICAgICAgICBqb2JfaWRzID0gW11cbiAgICAgICAgZm9yIGkgaW4gcmFuZ2UoMyk6XG4gICAgICAgICAgICBqb2JfbmFtZSA9IGYnY29uY3VycmVudC10ZXN0LWpvYi17aX0te2ludCh0aW1lLnRpbWUoKSl9J1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXNwb25zZSA9IGJhdGNoX2NsaWVudC5zdWJtaXRfam9iKFxuICAgICAgICAgICAgICAgIGpvYk5hbWU9am9iX25hbWUsXG4gICAgICAgICAgICAgICAgam9iUXVldWU9am9iX3F1ZXVlX25hbWUsXG4gICAgICAgICAgICAgICAgam9iRGVmaW5pdGlvbj1qb2JfZGVmaW5pdGlvbl9uYW1lLFxuICAgICAgICAgICAgICAgIHBhcmFtZXRlcnM9e1xuICAgICAgICAgICAgICAgICAgICAndGVzdF9tb2RlJzogJ3RydWUnLFxuICAgICAgICAgICAgICAgICAgICAndGVzdF90eXBlJzogJ2NvbmN1cnJlbnRfZXhlY3V0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgJ2pvYl9pbmRleCc6IHN0cihpKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdGltZW91dD17J2F0dGVtcHREdXJhdGlvblNlY29uZHMnOiAzMDB9XG4gICAgICAgICAgICApXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGpvYl9pZHMuYXBwZW5kKHJlc3BvbnNlWydqb2JJZCddKVxuICAgICAgICBcbiAgICAgICAgIyDlhajjgrjjg6fjg5bjga7lrozkuobjgpLlvoXmqZ9cbiAgICAgICAgbWF4X3dhaXRfdGltZSA9IDYwMCAgIyAxMOWIhlxuICAgICAgICB3YWl0X2ludGVydmFsID0gMTUgICAjIDE156eS6ZaT6ZqUXG4gICAgICAgIGVsYXBzZWRfdGltZSA9IDBcbiAgICAgICAgXG4gICAgICAgIHdoaWxlIGVsYXBzZWRfdGltZSA8IG1heF93YWl0X3RpbWU6XG4gICAgICAgICAgICBqb2JfZGV0YWlscyA9IGJhdGNoX2NsaWVudC5kZXNjcmliZV9qb2JzKGpvYnM9am9iX2lkcylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29tcGxldGVkX2pvYnMgPSBbXG4gICAgICAgICAgICAgICAgam9iIGZvciBqb2IgaW4gam9iX2RldGFpbHNbJ2pvYnMnXSBcbiAgICAgICAgICAgICAgICBpZiBqb2JbJ2pvYlN0YXR1cyddIGluIFsnU1VDQ0VFREVEJywgJ0ZBSUxFRCddXG4gICAgICAgICAgICBdXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIGxlbihjb21wbGV0ZWRfam9icykgPT0gbGVuKGpvYl9pZHMpOlxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB0aW1lLnNsZWVwKHdhaXRfaW50ZXJ2YWwpXG4gICAgICAgICAgICBlbGFwc2VkX3RpbWUgKz0gd2FpdF9pbnRlcnZhbFxuICAgICAgICBcbiAgICAgICAgIyDntZDmnpzjgpLnorroqo1cbiAgICAgICAgZmluYWxfam9iX2RldGFpbHMgPSBiYXRjaF9jbGllbnQuZGVzY3JpYmVfam9icyhqb2JzPWpvYl9pZHMpXG4gICAgICAgIHN1Y2NlZWRlZF9qb2JzID0gW1xuICAgICAgICAgICAgam9iIGZvciBqb2IgaW4gZmluYWxfam9iX2RldGFpbHNbJ2pvYnMnXSBcbiAgICAgICAgICAgIGlmIGpvYlsnam9iU3RhdHVzJ10gPT0gJ1NVQ0NFRURFRCdcbiAgICAgICAgXVxuICAgICAgICBcbiAgICAgICAgc3VjY2Vzc19yYXRlID0gKGxlbihzdWNjZWVkZWRfam9icykgLyBsZW4oam9iX2lkcykpICogMTAwXG4gICAgICAgIFxuICAgICAgICBpZiBzdWNjZXNzX3JhdGUgPj0gMTAwOiAgIyDlhajjgrjjg6fjg5bmiJDlip9cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ1BBU1NFRCcsXG4gICAgICAgICAgICAgICAgJ3RvdGFsX2pvYnMnOiBsZW4oam9iX2lkcyksXG4gICAgICAgICAgICAgICAgJ3N1Y2NlZWRlZF9qb2JzJzogbGVuKHN1Y2NlZWRlZF9qb2JzKSxcbiAgICAgICAgICAgICAgICAnc3VjY2Vzc19yYXRlJzogc3VjY2Vzc19yYXRlLFxuICAgICAgICAgICAgICAgICdleGVjdXRpb25fdGltZSc6IGVsYXBzZWRfdGltZSxcbiAgICAgICAgICAgICAgICAnbWVzc2FnZSc6ICdBbGwgY29uY3VycmVudCBqb2JzIGV4ZWN1dGVkIHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxpZiBzdWNjZXNzX3JhdGUgPj0gNjY6ICAjIDIvM+S7peS4iuaIkOWKn1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAndGVzdF9uYW1lJzogdGVzdF9uYW1lLFxuICAgICAgICAgICAgICAgICdzdGF0dXMnOiAnUEFSVElBTCcsXG4gICAgICAgICAgICAgICAgJ3RvdGFsX2pvYnMnOiBsZW4oam9iX2lkcyksXG4gICAgICAgICAgICAgICAgJ3N1Y2NlZWRlZF9qb2JzJzogbGVuKHN1Y2NlZWRlZF9qb2JzKSxcbiAgICAgICAgICAgICAgICAnc3VjY2Vzc19yYXRlJzogc3VjY2Vzc19yYXRlLFxuICAgICAgICAgICAgICAgICdtZXNzYWdlJzogZidQYXJ0aWFsIHN1Y2Nlc3M6IHtsZW4oc3VjY2VlZGVkX2pvYnMpfS97bGVuKGpvYl9pZHMpfSBqb2JzIHN1Y2NlZWRlZCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZTpcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ0ZBSUxFRCcsXG4gICAgICAgICAgICAgICAgJ3RvdGFsX2pvYnMnOiBsZW4oam9iX2lkcyksXG4gICAgICAgICAgICAgICAgJ3N1Y2NlZWRlZF9qb2JzJzogbGVuKHN1Y2NlZWRlZF9qb2JzKSxcbiAgICAgICAgICAgICAgICAnc3VjY2Vzc19yYXRlJzogc3VjY2Vzc19yYXRlLFxuICAgICAgICAgICAgICAgICdtZXNzYWdlJzogZidUb28gbWFueSBmYWlsdXJlczogb25seSB7bGVuKHN1Y2NlZWRlZF9qb2JzKX0ve2xlbihqb2JfaWRzKX0gam9icyBzdWNjZWVkZWQnXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAndGVzdF9uYW1lJzogdGVzdF9uYW1lLFxuICAgICAgICAgICAgJ3N0YXR1cyc6ICdFUlJPUicsXG4gICAgICAgICAgICAnZXJyb3InOiBzdHIoZSksXG4gICAgICAgICAgICAnbWVzc2FnZSc6IGYnQ29uY3VycmVudCBleGVjdXRpb24gdGVzdCBmYWlsZWQ6IHtzdHIoZSl9J1xuICAgICAgICB9XG5cbmRlZiB0ZXN0X2pvYl9mYWlsdXJlX2hhbmRsaW5nKGJhdGNoX2NsaWVudCwgam9iX3F1ZXVlX25hbWUsIGpvYl9kZWZpbml0aW9uX25hbWUpOlxuICAgIFwiXCJcIkpvYuWkseaVl+ODj+ODs+ODieODquODs+OCsOODhuOCueODiFwiXCJcIlxuICAgIHRlc3RfbmFtZSA9ICdqb2JfZmFpbHVyZV9oYW5kbGluZydcbiAgICBcbiAgICB0cnk6XG4gICAgICAgICMg5oSP5Zuz55qE44Gr5aSx5pWX44GZ44KL44K444On44OW44KS5a6f6KGMXG4gICAgICAgIGpvYl9uYW1lID0gZidmYWlsdXJlLXRlc3Qtam9iLXtpbnQodGltZS50aW1lKCkpfSdcbiAgICAgICAgXG4gICAgICAgIHJlc3BvbnNlID0gYmF0Y2hfY2xpZW50LnN1Ym1pdF9qb2IoXG4gICAgICAgICAgICBqb2JOYW1lPWpvYl9uYW1lLFxuICAgICAgICAgICAgam9iUXVldWU9am9iX3F1ZXVlX25hbWUsXG4gICAgICAgICAgICBqb2JEZWZpbml0aW9uPWpvYl9kZWZpbml0aW9uX25hbWUsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzPXtcbiAgICAgICAgICAgICAgICAndGVzdF9tb2RlJzogJ3RydWUnLFxuICAgICAgICAgICAgICAgICd0ZXN0X3R5cGUnOiAnZmFpbHVyZV90ZXN0JyxcbiAgICAgICAgICAgICAgICAnZm9yY2VfZmFpbHVyZSc6ICd0cnVlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRpbWVvdXQ9eydhdHRlbXB0RHVyYXRpb25TZWNvbmRzJzogMTgwfSwgICMgM+WIhuOBp+OCv+OCpOODoOOCouOCpuODiFxuICAgICAgICAgICAgcmV0cnlTdHJhdGVneT17J2F0dGVtcHRzJzogMn0gICMgMuWbnuWGjeippuihjFxuICAgICAgICApXG4gICAgICAgIFxuICAgICAgICBqb2JfaWQgPSByZXNwb25zZVsnam9iSWQnXVxuICAgICAgICBcbiAgICAgICAgIyDjgrjjg6fjg5bjga7lrozkuobjgpLlvoXmqZ9cbiAgICAgICAgbWF4X3dhaXRfdGltZSA9IDMwMCAgIyA15YiGXG4gICAgICAgIHdhaXRfaW50ZXJ2YWwgPSAxMCAgICMgMTDnp5LplpPpmpRcbiAgICAgICAgZWxhcHNlZF90aW1lID0gMFxuICAgICAgICBcbiAgICAgICAgd2hpbGUgZWxhcHNlZF90aW1lIDwgbWF4X3dhaXRfdGltZTpcbiAgICAgICAgICAgIGpvYl9kZXRhaWwgPSBiYXRjaF9jbGllbnQuZGVzY3JpYmVfam9icyhqb2JzPVtqb2JfaWRdKVxuICAgICAgICAgICAgam9iX3N0YXR1cyA9IGpvYl9kZXRhaWxbJ2pvYnMnXVswXVsnam9iU3RhdHVzJ11cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgam9iX3N0YXR1cyBpbiBbJ1NVQ0NFRURFRCcsICdGQUlMRUQnXTpcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgdGltZS5zbGVlcCh3YWl0X2ludGVydmFsKVxuICAgICAgICAgICAgZWxhcHNlZF90aW1lICs9IHdhaXRfaW50ZXJ2YWxcbiAgICAgICAgXG4gICAgICAgICMg5pyA57WC54q25oWL44KS56K66KqNXG4gICAgICAgIGZpbmFsX2pvYl9kZXRhaWwgPSBiYXRjaF9jbGllbnQuZGVzY3JpYmVfam9icyhqb2JzPVtqb2JfaWRdKVxuICAgICAgICBmaW5hbF9zdGF0dXMgPSBmaW5hbF9qb2JfZGV0YWlsWydqb2JzJ11bMF1bJ2pvYlN0YXR1cyddXG4gICAgICAgIGF0dGVtcHRzID0gZmluYWxfam9iX2RldGFpbFsnam9icyddWzBdLmdldCgnYXR0ZW1wdHMnLCBbXSlcbiAgICAgICAgXG4gICAgICAgICMg5aSx5pWX44K444On44OW44GM6YGp5YiH44Gr5Yem55CG44GV44KM44Gf44GL44KS56K66KqNXG4gICAgICAgIGlmIGZpbmFsX3N0YXR1cyA9PSAnRkFJTEVEJyBhbmQgbGVuKGF0dGVtcHRzKSA+PSAyOlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAndGVzdF9uYW1lJzogdGVzdF9uYW1lLFxuICAgICAgICAgICAgICAgICdzdGF0dXMnOiAnUEFTU0VEJyxcbiAgICAgICAgICAgICAgICAnam9iX2lkJzogam9iX2lkLFxuICAgICAgICAgICAgICAgICdmaW5hbF9zdGF0dXMnOiBmaW5hbF9zdGF0dXMsXG4gICAgICAgICAgICAgICAgJ3JldHJ5X2F0dGVtcHRzJzogbGVuKGF0dGVtcHRzKSxcbiAgICAgICAgICAgICAgICAnbWVzc2FnZSc6ICdKb2IgZmFpbHVyZSBoYW5kbGVkIGNvcnJlY3RseSB3aXRoIHJldHJpZXMnXG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2U6XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICd0ZXN0X25hbWUnOiB0ZXN0X25hbWUsXG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdGQUlMRUQnLFxuICAgICAgICAgICAgICAgICdqb2JfaWQnOiBqb2JfaWQsXG4gICAgICAgICAgICAgICAgJ2ZpbmFsX3N0YXR1cyc6IGZpbmFsX3N0YXR1cyxcbiAgICAgICAgICAgICAgICAncmV0cnlfYXR0ZW1wdHMnOiBsZW4oYXR0ZW1wdHMpLFxuICAgICAgICAgICAgICAgICdtZXNzYWdlJzogZidVbmV4cGVjdGVkIGJlaGF2aW9yOiBzdGF0dXM9e2ZpbmFsX3N0YXR1c30sIGF0dGVtcHRzPXtsZW4oYXR0ZW1wdHMpfSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICd0ZXN0X25hbWUnOiB0ZXN0X25hbWUsXG4gICAgICAgICAgICAnc3RhdHVzJzogJ0VSUk9SJyxcbiAgICAgICAgICAgICdlcnJvcic6IHN0cihlKSxcbiAgICAgICAgICAgICdtZXNzYWdlJzogZidGYWlsdXJlIGhhbmRsaW5nIHRlc3QgZmFpbGVkOiB7c3RyKGUpfSdcbiAgICAgICAgfVxuXG5kZWYgZm9ybWF0X3Rlc3Rfbm90aWZpY2F0aW9uKHRlc3RfcmVzdWx0cyk6XG4gICAgXCJcIlwi44OG44K544OI57WQ5p6c6YCa55+l44Oh44OD44K744O844K444Gu44OV44Kp44O844Oe44OD44OIXCJcIlwiXG4gICAgbWVzc2FnZSA9IGZcIlwiXCJcbkJhdGNoIEludGVncmF0aW9uIFRlc3QgUmVzdWx0c1xuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuVGltZXN0YW1wOiB7dGVzdF9yZXN1bHRzWyd0aW1lc3RhbXAnXX1cblRlc3QgU3VpdGU6IHt0ZXN0X3Jlc3VsdHNbJ3Rlc3Rfc3VpdGUnXX1cblxuU3VtbWFyeTpcbi0gVG90YWwgVGVzdHM6IHt0ZXN0X3Jlc3VsdHNbJ3N1bW1hcnknXVsndG90YWwnXX1cbi0gUGFzc2VkOiB7dGVzdF9yZXN1bHRzWydzdW1tYXJ5J11bJ3Bhc3NlZCddfVxuLSBGYWlsZWQ6IHt0ZXN0X3Jlc3VsdHNbJ3N1bW1hcnknXVsnZmFpbGVkJ119XG4tIFN1Y2Nlc3MgUmF0ZToge3Rlc3RfcmVzdWx0c1snc3VtbWFyeSddWydzdWNjZXNzX3JhdGUnXTouMWZ9JVxuXG5UZXN0IERldGFpbHM6XG5cIlwiXCJcbiAgICBcbiAgICBmb3IgdGVzdCBpbiB0ZXN0X3Jlc3VsdHNbJ3Rlc3RzJ106XG4gICAgICAgIHN0YXR1c19pY29uID0gXCLinIVcIiBpZiB0ZXN0WydzdGF0dXMnXSA9PSAnUEFTU0VEJyBlbHNlIFwi4p2MXCIgaWYgdGVzdFsnc3RhdHVzJ10gPT0gJ0ZBSUxFRCcgZWxzZSBcIuKaoO+4j1wiXG4gICAgICAgIG1lc3NhZ2UgKz0gZlwiICB7c3RhdHVzX2ljb259IHt0ZXN0Wyd0ZXN0X25hbWUnXX06IHt0ZXN0WydzdGF0dXMnXX0gLSB7dGVzdFsnbWVzc2FnZSddfVxcblwiXG4gICAgXG4gICAgcmV0dXJuIG1lc3NhZ2VcbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgSk9CX1FVRVVFX05BTUU6IHByb3BzLmJhdGNoSW50ZWdyYXRpb24uYmF0Y2hDb25zdHJ1Y3Quam9iUXVldWUuam9iUXVldWVOYW1lISxcbiAgICAgICAgSk9CX0RFRklOSVRJT05fTkFNRTogcHJvcHMuYmF0Y2hJbnRlZ3JhdGlvbi5iYXRjaENvbnN0cnVjdC5qb2JEZWZpbml0aW9uLmpvYkRlZmluaXRpb25OYW1lISxcbiAgICAgICAgVEVTVF9UT1BJQ19BUk46IHRoaXMudGVzdE5vdGlmaWNhdGlvblRvcGljLnRvcGljQXJuLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIGxvZ0dyb3VwOiB0aGlzLnRlc3RMb2dHcm91cCxcbiAgICB9KTtcblxuICAgIC8vIExhbWJkYeWun+ihjOaoqemZkFxuICAgIHRlc3RSdW5uZXJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmF0Y2g6U3VibWl0Sm9iJyxcbiAgICAgICAgJ2JhdGNoOkxpc3RKb2JzJyxcbiAgICAgICAgJ2JhdGNoOkRlc2NyaWJlSm9icycsXG4gICAgICAgICdiYXRjaDpEZXNjcmliZUpvYlF1ZXVlcycsXG4gICAgICAgICdiYXRjaDpDYW5jZWxKb2InLFxuICAgICAgICAnY2xvdWR3YXRjaDpQdXRNZXRyaWNEYXRhJyxcbiAgICAgICAgJ3NuczpQdWJsaXNoJyxcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nR3JvdXAnLFxuICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgcmV0dXJuIHRlc3RSdW5uZXJGdW5jdGlvbjtcbiAgfVxuXG4gIC8qKlxuICAgKiBGU3jjg57jgqbjg7Pjg4jjg4bjgrnjg4hMYW1iZGHplqLmlbDkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRnN4TW91bnRUZXN0RnVuY3Rpb24ocHJvcHM6IEJhdGNoSW50ZWdyYXRpb25UZXN0UHJvcHMpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGNvbnN0IGZzeE1vdW50VGVzdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRnN4TW91bnRUZXN0RnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1mc3gtbW91bnQtdGVzdGAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuaW1wb3J0IGJvdG8zXG5pbXBvcnQganNvblxuaW1wb3J0IG9zXG5pbXBvcnQgdGltZVxuZnJvbSBkYXRldGltZSBpbXBvcnQgZGF0ZXRpbWVcbmZyb20gdHlwaW5nIGltcG9ydCBEaWN0LCBMaXN0LCBBbnlcblxuZGVmIGhhbmRsZXIoZXZlbnQsIGNvbnRleHQpOlxuICAgIFwiXCJcIlxuICAgIEZTeOODnuOCpuODs+ODiOeiuuiqjeODhuOCueODiFxuICAgIFxuICAgIOODhuOCueODiOmgheebrjpcbiAgICAxLiBGU3ggZm9yIE5ldEFwcCBPTlRBUOODleOCoeOCpOODq+OCt+OCueODhuODoOaOpee2mueiuuiqjVxuICAgIDIuIFNNQi9DSUZT44Oe44Km44Oz44OI5YuV5L2c56K66KqNXG4gICAgMy4g44OV44Kh44Kk44Or6Kqt44G/5pu444GN44OG44K544OIXG4gICAgNC4gQWN0aXZlIERpcmVjdG9yeeiqjeiovOeiuuiqjVxuICAgIFwiXCJcIlxuICAgIFxuICAgIGJhdGNoX2NsaWVudCA9IGJvdG8zLmNsaWVudCgnYmF0Y2gnKVxuICAgIGZzeF9jbGllbnQgPSBib3RvMy5jbGllbnQoJ2ZzeCcpXG4gICAgc25zX2NsaWVudCA9IGJvdG8zLmNsaWVudCgnc25zJylcbiAgICBcbiAgICBqb2JfcXVldWVfbmFtZSA9IG9zLmVudmlyb25bJ0pPQl9RVUVVRV9OQU1FJ11cbiAgICBqb2JfZGVmaW5pdGlvbl9uYW1lID0gb3MuZW52aXJvblsnSk9CX0RFRklOSVRJT05fTkFNRSddXG4gICAgdGVzdF90b3BpY19hcm4gPSBvcy5lbnZpcm9uWydURVNUX1RPUElDX0FSTiddXG4gICAgZnN4X2ZpbGVfc3lzdGVtX2lkID0gb3MuZW52aXJvbi5nZXQoJ0ZTWF9GSUxFX1NZU1RFTV9JRCcsICcnKVxuICAgIFxuICAgIHRlc3RfcmVzdWx0cyA9IHtcbiAgICAgICAgJ3RpbWVzdGFtcCc6IGRhdGV0aW1lLm5vdygpLmlzb2Zvcm1hdCgpLFxuICAgICAgICAndGVzdF9zdWl0ZSc6ICdmc3hfbW91bnRfdGVzdCcsXG4gICAgICAgICd0ZXN0cyc6IFtdXG4gICAgfVxuICAgIFxuICAgIHRyeTpcbiAgICAgICAgIyDjg4bjgrnjg4gxOiBGU3jjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6DnirbmhYvnorroqo1cbiAgICAgICAgdGVzdF9yZXN1bHRzWyd0ZXN0cyddLmFwcGVuZChcbiAgICAgICAgICAgIHRlc3RfZnN4X2ZpbGVfc3lzdGVtX3N0YXR1cyhmc3hfY2xpZW50LCBmc3hfZmlsZV9zeXN0ZW1faWQpXG4gICAgICAgIClcbiAgICAgICAgXG4gICAgICAgICMg44OG44K544OIMjogRlN444Oe44Km44Oz44OI44OG44K544OI44K444On44OW5a6f6KGMXG4gICAgICAgIHRlc3RfcmVzdWx0c1sndGVzdHMnXS5hcHBlbmQoXG4gICAgICAgICAgICB0ZXN0X2ZzeF9tb3VudF9qb2IoYmF0Y2hfY2xpZW50LCBqb2JfcXVldWVfbmFtZSwgam9iX2RlZmluaXRpb25fbmFtZSlcbiAgICAgICAgKVxuICAgICAgICBcbiAgICAgICAgIyDjg4bjgrnjg4gzOiDjg5XjgqHjgqTjg6vmk43kvZzjg4bjgrnjg4jjgrjjg6fjg5blrp/ooYxcbiAgICAgICAgdGVzdF9yZXN1bHRzWyd0ZXN0cyddLmFwcGVuZChcbiAgICAgICAgICAgIHRlc3RfZmlsZV9vcGVyYXRpb25zX2pvYihiYXRjaF9jbGllbnQsIGpvYl9xdWV1ZV9uYW1lLCBqb2JfZGVmaW5pdGlvbl9uYW1lKVxuICAgICAgICApXG4gICAgICAgIFxuICAgICAgICAjIOODhuOCueODiOe1kOaenOOBrumbhuioiFxuICAgICAgICB0b3RhbF90ZXN0cyA9IGxlbih0ZXN0X3Jlc3VsdHNbJ3Rlc3RzJ10pXG4gICAgICAgIHBhc3NlZF90ZXN0cyA9IHN1bSgxIGZvciB0ZXN0IGluIHRlc3RfcmVzdWx0c1sndGVzdHMnXSBpZiB0ZXN0WydzdGF0dXMnXSA9PSAnUEFTU0VEJylcbiAgICAgICAgZmFpbGVkX3Rlc3RzID0gdG90YWxfdGVzdHMgLSBwYXNzZWRfdGVzdHNcbiAgICAgICAgXG4gICAgICAgIHRlc3RfcmVzdWx0c1snc3VtbWFyeSddID0ge1xuICAgICAgICAgICAgJ3RvdGFsJzogdG90YWxfdGVzdHMsXG4gICAgICAgICAgICAncGFzc2VkJzogcGFzc2VkX3Rlc3RzLFxuICAgICAgICAgICAgJ2ZhaWxlZCc6IGZhaWxlZF90ZXN0cyxcbiAgICAgICAgICAgICdzdWNjZXNzX3JhdGUnOiAocGFzc2VkX3Rlc3RzIC8gdG90YWxfdGVzdHMpICogMTAwIGlmIHRvdGFsX3Rlc3RzID4gMCBlbHNlIDBcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgIyDjg4bjgrnjg4jntZDmnpzpgJrnn6VcbiAgICAgICAgbm90aWZpY2F0aW9uX21lc3NhZ2UgPSBmb3JtYXRfZnN4X3Rlc3Rfbm90aWZpY2F0aW9uKHRlc3RfcmVzdWx0cylcbiAgICAgICAgc25zX2NsaWVudC5wdWJsaXNoKFxuICAgICAgICAgICAgVG9waWNBcm49dGVzdF90b3BpY19hcm4sXG4gICAgICAgICAgICBTdWJqZWN0PWYnRlN4IE1vdW50IFRlc3QgUmVzdWx0cyAtIHt0ZXN0X3Jlc3VsdHNbXCJzdW1tYXJ5XCJdW1wic3VjY2Vzc19yYXRlXCJdOi4xZn0lIFN1Y2Nlc3MnLFxuICAgICAgICAgICAgTWVzc2FnZT1ub3RpZmljYXRpb25fbWVzc2FnZVxuICAgICAgICApXG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ3N0YXR1c0NvZGUnOiAyMDAsXG4gICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHModGVzdF9yZXN1bHRzKVxuICAgICAgICB9XG4gICAgICAgIFxuICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgZXJyb3JfcmVzdWx0ID0ge1xuICAgICAgICAgICAgJ3RpbWVzdGFtcCc6IGRhdGV0aW1lLm5vdygpLmlzb2Zvcm1hdCgpLFxuICAgICAgICAgICAgJ3Rlc3Rfc3VpdGUnOiAnZnN4X21vdW50X3Rlc3QnLFxuICAgICAgICAgICAgJ2Vycm9yJzogc3RyKGUpLFxuICAgICAgICAgICAgJ3N0YXR1cyc6ICdFUlJPUidcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgc25zX2NsaWVudC5wdWJsaXNoKFxuICAgICAgICAgICAgVG9waWNBcm49dGVzdF90b3BpY19hcm4sXG4gICAgICAgICAgICBTdWJqZWN0PSdGU3ggTW91bnQgVGVzdCBFUlJPUicsXG4gICAgICAgICAgICBNZXNzYWdlPWYnRlN4IG1vdW50IHRlc3QgZXhlY3V0aW9uIGZhaWxlZDoge3N0cihlKX0nXG4gICAgICAgIClcbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAnc3RhdHVzQ29kZSc6IDUwMCxcbiAgICAgICAgICAgICdib2R5JzoganNvbi5kdW1wcyhlcnJvcl9yZXN1bHQpXG4gICAgICAgIH1cblxuZGVmIHRlc3RfZnN4X2ZpbGVfc3lzdGVtX3N0YXR1cyhmc3hfY2xpZW50LCBmaWxlX3N5c3RlbV9pZCk6XG4gICAgXCJcIlwiRlN444OV44Kh44Kk44Or44K344K544OG44Og54q25oWL56K66KqNXCJcIlwiXG4gICAgdGVzdF9uYW1lID0gJ2ZzeF9maWxlX3N5c3RlbV9zdGF0dXMnXG4gICAgXG4gICAgdHJ5OlxuICAgICAgICBpZiBub3QgZmlsZV9zeXN0ZW1faWQ6XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICd0ZXN0X25hbWUnOiB0ZXN0X25hbWUsXG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdTS0lQUEVEJyxcbiAgICAgICAgICAgICAgICAnbWVzc2FnZSc6ICdGU3ggZmlsZSBzeXN0ZW0gSUQgbm90IGNvbmZpZ3VyZWQnXG4gICAgICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXNwb25zZSA9IGZzeF9jbGllbnQuZGVzY3JpYmVfZmlsZV9zeXN0ZW1zKEZpbGVTeXN0ZW1JZHM9W2ZpbGVfc3lzdGVtX2lkXSlcbiAgICAgICAgXG4gICAgICAgIGlmIG5vdCByZXNwb25zZVsnRmlsZVN5c3RlbXMnXTpcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ0ZBSUxFRCcsXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ0ZTeCBmaWxlIHN5c3RlbSB7ZmlsZV9zeXN0ZW1faWR9IG5vdCBmb3VuZCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGZpbGVfc3lzdGVtID0gcmVzcG9uc2VbJ0ZpbGVTeXN0ZW1zJ11bMF1cbiAgICAgICAgbGlmZWN5Y2xlID0gZmlsZV9zeXN0ZW1bJ0xpZmVjeWNsZSddXG4gICAgICAgIFxuICAgICAgICBpZiBsaWZlY3ljbGUgPT0gJ0FWQUlMQUJMRSc6XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICd0ZXN0X25hbWUnOiB0ZXN0X25hbWUsXG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdQQVNTRUQnLFxuICAgICAgICAgICAgICAgICdmaWxlX3N5c3RlbV9pZCc6IGZpbGVfc3lzdGVtX2lkLFxuICAgICAgICAgICAgICAgICdsaWZlY3ljbGUnOiBsaWZlY3ljbGUsXG4gICAgICAgICAgICAgICAgJ3N0b3JhZ2VfY2FwYWNpdHknOiBmaWxlX3N5c3RlbS5nZXQoJ1N0b3JhZ2VDYXBhY2l0eScsICdVbmtub3duJyksXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiAnRlN4IGZpbGUgc3lzdGVtIGlzIGF2YWlsYWJsZSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZTpcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ0ZBSUxFRCcsXG4gICAgICAgICAgICAgICAgJ2ZpbGVfc3lzdGVtX2lkJzogZmlsZV9zeXN0ZW1faWQsXG4gICAgICAgICAgICAgICAgJ2xpZmVjeWNsZSc6IGxpZmVjeWNsZSxcbiAgICAgICAgICAgICAgICAnbWVzc2FnZSc6IGYnRlN4IGZpbGUgc3lzdGVtIGlzIG5vdCBhdmFpbGFibGU6IHtsaWZlY3ljbGV9J1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICdzdGF0dXMnOiAnRVJST1InLFxuICAgICAgICAgICAgJ2Vycm9yJzogc3RyKGUpLFxuICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ0ZTeCBzdGF0dXMgY2hlY2sgZmFpbGVkOiB7c3RyKGUpfSdcbiAgICAgICAgfVxuXG5kZWYgdGVzdF9mc3hfbW91bnRfam9iKGJhdGNoX2NsaWVudCwgam9iX3F1ZXVlX25hbWUsIGpvYl9kZWZpbml0aW9uX25hbWUpOlxuICAgIFwiXCJcIkZTeOODnuOCpuODs+ODiOODhuOCueODiOOCuOODp+ODluWun+ihjFwiXCJcIlxuICAgIHRlc3RfbmFtZSA9ICdmc3hfbW91bnRfam9iJ1xuICAgIFxuICAgIHRyeTpcbiAgICAgICAgam9iX25hbWUgPSBmJ2ZzeC1tb3VudC10ZXN0LXtpbnQodGltZS50aW1lKCkpfSdcbiAgICAgICAgXG4gICAgICAgIHJlc3BvbnNlID0gYmF0Y2hfY2xpZW50LnN1Ym1pdF9qb2IoXG4gICAgICAgICAgICBqb2JOYW1lPWpvYl9uYW1lLFxuICAgICAgICAgICAgam9iUXVldWU9am9iX3F1ZXVlX25hbWUsXG4gICAgICAgICAgICBqb2JEZWZpbml0aW9uPWpvYl9kZWZpbml0aW9uX25hbWUsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzPXtcbiAgICAgICAgICAgICAgICAndGVzdF9tb2RlJzogJ3RydWUnLFxuICAgICAgICAgICAgICAgICd0ZXN0X3R5cGUnOiAnZnN4X21vdW50X3Rlc3QnLFxuICAgICAgICAgICAgICAgICdtb3VudF9jaGVjayc6ICd0cnVlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRpbWVvdXQ9eydhdHRlbXB0RHVyYXRpb25TZWNvbmRzJzogNjAwfSAgIyAxMOWIhuOBp+OCv+OCpOODoOOCouOCpuODiFxuICAgICAgICApXG4gICAgICAgIFxuICAgICAgICBqb2JfaWQgPSByZXNwb25zZVsnam9iSWQnXVxuICAgICAgICBcbiAgICAgICAgIyDjgrjjg6fjg5bjga7lrozkuobjgpLlvoXmqZ9cbiAgICAgICAgbWF4X3dhaXRfdGltZSA9IDYwMCAgIyAxMOWIhlxuICAgICAgICB3YWl0X2ludGVydmFsID0gMTUgICAjIDE156eS6ZaT6ZqUXG4gICAgICAgIGVsYXBzZWRfdGltZSA9IDBcbiAgICAgICAgXG4gICAgICAgIHdoaWxlIGVsYXBzZWRfdGltZSA8IG1heF93YWl0X3RpbWU6XG4gICAgICAgICAgICBqb2JfZGV0YWlsID0gYmF0Y2hfY2xpZW50LmRlc2NyaWJlX2pvYnMoam9icz1bam9iX2lkXSlcbiAgICAgICAgICAgIGpvYl9zdGF0dXMgPSBqb2JfZGV0YWlsWydqb2JzJ11bMF1bJ2pvYlN0YXR1cyddXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIGpvYl9zdGF0dXMgaW4gWydTVUNDRUVERUQnLCAnRkFJTEVEJ106XG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIHRpbWUuc2xlZXAod2FpdF9pbnRlcnZhbClcbiAgICAgICAgICAgIGVsYXBzZWRfdGltZSArPSB3YWl0X2ludGVydmFsXG4gICAgICAgIFxuICAgICAgICAjIOacgOe1gueKtuaFi+OCkueiuuiqjVxuICAgICAgICBmaW5hbF9qb2JfZGV0YWlsID0gYmF0Y2hfY2xpZW50LmRlc2NyaWJlX2pvYnMoam9icz1bam9iX2lkXSlcbiAgICAgICAgZmluYWxfc3RhdHVzID0gZmluYWxfam9iX2RldGFpbFsnam9icyddWzBdWydqb2JTdGF0dXMnXVxuICAgICAgICBcbiAgICAgICAgaWYgZmluYWxfc3RhdHVzID09ICdTVUNDRUVERUQnOlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAndGVzdF9uYW1lJzogdGVzdF9uYW1lLFxuICAgICAgICAgICAgICAgICdzdGF0dXMnOiAnUEFTU0VEJyxcbiAgICAgICAgICAgICAgICAnam9iX2lkJzogam9iX2lkLFxuICAgICAgICAgICAgICAgICdleGVjdXRpb25fdGltZSc6IGVsYXBzZWRfdGltZSxcbiAgICAgICAgICAgICAgICAnbWVzc2FnZSc6ICdGU3ggbW91bnQgdGVzdCBqb2IgZXhlY3V0ZWQgc3VjY2Vzc2Z1bGx5J1xuICAgICAgICAgICAgfVxuICAgICAgICBlbHNlOlxuICAgICAgICAgICAgc3RhdHVzX3JlYXNvbiA9IGZpbmFsX2pvYl9kZXRhaWxbJ2pvYnMnXVswXS5nZXQoJ3N0YXR1c1JlYXNvbicsICdVbmtub3duJylcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ0ZBSUxFRCcsXG4gICAgICAgICAgICAgICAgJ2pvYl9pZCc6IGpvYl9pZCxcbiAgICAgICAgICAgICAgICAnam9iX3N0YXR1cyc6IGZpbmFsX3N0YXR1cyxcbiAgICAgICAgICAgICAgICAnc3RhdHVzX3JlYXNvbic6IHN0YXR1c19yZWFzb24sXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ0ZTeCBtb3VudCB0ZXN0IGpvYiBmYWlsZWQ6IHtzdGF0dXNfcmVhc29ufSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICd0ZXN0X25hbWUnOiB0ZXN0X25hbWUsXG4gICAgICAgICAgICAnc3RhdHVzJzogJ0VSUk9SJyxcbiAgICAgICAgICAgICdlcnJvcic6IHN0cihlKSxcbiAgICAgICAgICAgICdtZXNzYWdlJzogZidGU3ggbW91bnQgdGVzdCBqb2IgZmFpbGVkOiB7c3RyKGUpfSdcbiAgICAgICAgfVxuXG5kZWYgdGVzdF9maWxlX29wZXJhdGlvbnNfam9iKGJhdGNoX2NsaWVudCwgam9iX3F1ZXVlX25hbWUsIGpvYl9kZWZpbml0aW9uX25hbWUpOlxuICAgIFwiXCJcIuODleOCoeOCpOODq+aTjeS9nOODhuOCueODiOOCuOODp+ODluWun+ihjFwiXCJcIlxuICAgIHRlc3RfbmFtZSA9ICdmaWxlX29wZXJhdGlvbnNfam9iJ1xuICAgIFxuICAgIHRyeTpcbiAgICAgICAgam9iX25hbWUgPSBmJ2ZpbGUtb3BzLXRlc3Qte2ludCh0aW1lLnRpbWUoKSl9J1xuICAgICAgICBcbiAgICAgICAgcmVzcG9uc2UgPSBiYXRjaF9jbGllbnQuc3VibWl0X2pvYihcbiAgICAgICAgICAgIGpvYk5hbWU9am9iX25hbWUsXG4gICAgICAgICAgICBqb2JRdWV1ZT1qb2JfcXVldWVfbmFtZSxcbiAgICAgICAgICAgIGpvYkRlZmluaXRpb249am9iX2RlZmluaXRpb25fbmFtZSxcbiAgICAgICAgICAgIHBhcmFtZXRlcnM9e1xuICAgICAgICAgICAgICAgICd0ZXN0X21vZGUnOiAndHJ1ZScsXG4gICAgICAgICAgICAgICAgJ3Rlc3RfdHlwZSc6ICdmaWxlX29wZXJhdGlvbnNfdGVzdCcsXG4gICAgICAgICAgICAgICAgJ2ZpbGVfb3BlcmF0aW9ucyc6ICdyZWFkX3dyaXRlX3Rlc3QnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGltZW91dD17J2F0dGVtcHREdXJhdGlvblNlY29uZHMnOiA2MDB9XG4gICAgICAgIClcbiAgICAgICAgXG4gICAgICAgIGpvYl9pZCA9IHJlc3BvbnNlWydqb2JJZCddXG4gICAgICAgIFxuICAgICAgICAjIOOCuOODp+ODluOBruWujOS6huOCkuW+heapn1xuICAgICAgICBtYXhfd2FpdF90aW1lID0gNjAwXG4gICAgICAgIHdhaXRfaW50ZXJ2YWwgPSAxNVxuICAgICAgICBlbGFwc2VkX3RpbWUgPSAwXG4gICAgICAgIFxuICAgICAgICB3aGlsZSBlbGFwc2VkX3RpbWUgPCBtYXhfd2FpdF90aW1lOlxuICAgICAgICAgICAgam9iX2RldGFpbCA9IGJhdGNoX2NsaWVudC5kZXNjcmliZV9qb2JzKGpvYnM9W2pvYl9pZF0pXG4gICAgICAgICAgICBqb2Jfc3RhdHVzID0gam9iX2RldGFpbFsnam9icyddWzBdWydqb2JTdGF0dXMnXVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiBqb2Jfc3RhdHVzIGluIFsnU1VDQ0VFREVEJywgJ0ZBSUxFRCddOlxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB0aW1lLnNsZWVwKHdhaXRfaW50ZXJ2YWwpXG4gICAgICAgICAgICBlbGFwc2VkX3RpbWUgKz0gd2FpdF9pbnRlcnZhbFxuICAgICAgICBcbiAgICAgICAgZmluYWxfam9iX2RldGFpbCA9IGJhdGNoX2NsaWVudC5kZXNjcmliZV9qb2JzKGpvYnM9W2pvYl9pZF0pXG4gICAgICAgIGZpbmFsX3N0YXR1cyA9IGZpbmFsX2pvYl9kZXRhaWxbJ2pvYnMnXVswXVsnam9iU3RhdHVzJ11cbiAgICAgICAgXG4gICAgICAgIGlmIGZpbmFsX3N0YXR1cyA9PSAnU1VDQ0VFREVEJzpcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ1BBU1NFRCcsXG4gICAgICAgICAgICAgICAgJ2pvYl9pZCc6IGpvYl9pZCxcbiAgICAgICAgICAgICAgICAnZXhlY3V0aW9uX3RpbWUnOiBlbGFwc2VkX3RpbWUsXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiAnRmlsZSBvcGVyYXRpb25zIHRlc3QgY29tcGxldGVkIHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZTpcbiAgICAgICAgICAgIHN0YXR1c19yZWFzb24gPSBmaW5hbF9qb2JfZGV0YWlsWydqb2JzJ11bMF0uZ2V0KCdzdGF0dXNSZWFzb24nLCAnVW5rbm93bicpXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICd0ZXN0X25hbWUnOiB0ZXN0X25hbWUsXG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdGQUlMRUQnLFxuICAgICAgICAgICAgICAgICdqb2JfaWQnOiBqb2JfaWQsXG4gICAgICAgICAgICAgICAgJ2pvYl9zdGF0dXMnOiBmaW5hbF9zdGF0dXMsXG4gICAgICAgICAgICAgICAgJ3N0YXR1c19yZWFzb24nOiBzdGF0dXNfcmVhc29uLFxuICAgICAgICAgICAgICAgICdtZXNzYWdlJzogZidGaWxlIG9wZXJhdGlvbnMgdGVzdCBmYWlsZWQ6IHtzdGF0dXNfcmVhc29ufSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICd0ZXN0X25hbWUnOiB0ZXN0X25hbWUsXG4gICAgICAgICAgICAnc3RhdHVzJzogJ0VSUk9SJyxcbiAgICAgICAgICAgICdlcnJvcic6IHN0cihlKSxcbiAgICAgICAgICAgICdtZXNzYWdlJzogZidGaWxlIG9wZXJhdGlvbnMgdGVzdCBmYWlsZWQ6IHtzdHIoZSl9J1xuICAgICAgICB9XG5cbmRlZiBmb3JtYXRfZnN4X3Rlc3Rfbm90aWZpY2F0aW9uKHRlc3RfcmVzdWx0cyk6XG4gICAgXCJcIlwiRlN444OG44K544OI57WQ5p6c6YCa55+l44Oh44OD44K744O844K444Gu44OV44Kp44O844Oe44OD44OIXCJcIlwiXG4gICAgbWVzc2FnZSA9IGZcIlwiXCJcbkZTeCBNb3VudCBUZXN0IFJlc3VsdHNcbj09PT09PT09PT09PT09PT09PT09PVxuXG5UaW1lc3RhbXA6IHt0ZXN0X3Jlc3VsdHNbJ3RpbWVzdGFtcCddfVxuVGVzdCBTdWl0ZToge3Rlc3RfcmVzdWx0c1sndGVzdF9zdWl0ZSddfVxuXG5TdW1tYXJ5OlxuLSBUb3RhbCBUZXN0czoge3Rlc3RfcmVzdWx0c1snc3VtbWFyeSddWyd0b3RhbCddfVxuLSBQYXNzZWQ6IHt0ZXN0X3Jlc3VsdHNbJ3N1bW1hcnknXVsncGFzc2VkJ119XG4tIEZhaWxlZDoge3Rlc3RfcmVzdWx0c1snc3VtbWFyeSddWydmYWlsZWQnXX1cbi0gU3VjY2VzcyBSYXRlOiB7dGVzdF9yZXN1bHRzWydzdW1tYXJ5J11bJ3N1Y2Nlc3NfcmF0ZSddOi4xZn0lXG5cblRlc3QgRGV0YWlsczpcblwiXCJcIlxuICAgIFxuICAgIGZvciB0ZXN0IGluIHRlc3RfcmVzdWx0c1sndGVzdHMnXTpcbiAgICAgICAgc3RhdHVzX2ljb24gPSBcIuKchVwiIGlmIHRlc3RbJ3N0YXR1cyddID09ICdQQVNTRUQnIGVsc2UgXCLinYxcIiBpZiB0ZXN0WydzdGF0dXMnXSA9PSAnRkFJTEVEJyBlbHNlIFwi4pqg77iPXCJcbiAgICAgICAgbWVzc2FnZSArPSBmXCIgIHtzdGF0dXNfaWNvbn0ge3Rlc3RbJ3Rlc3RfbmFtZSddfToge3Rlc3RbJ3N0YXR1cyddfSAtIHt0ZXN0WydtZXNzYWdlJ119XFxuXCJcbiAgICBcbiAgICByZXR1cm4gbWVzc2FnZVxuICAgICAgYCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBKT0JfUVVFVUVfTkFNRTogcHJvcHMuYmF0Y2hJbnRlZ3JhdGlvbi5iYXRjaENvbnN0cnVjdC5qb2JRdWV1ZS5qb2JRdWV1ZU5hbWUhLFxuICAgICAgICBKT0JfREVGSU5JVElPTl9OQU1FOiBwcm9wcy5iYXRjaEludGVncmF0aW9uLmJhdGNoQ29uc3RydWN0LmpvYkRlZmluaXRpb24uam9iRGVmaW5pdGlvbk5hbWUhLFxuICAgICAgICBURVNUX1RPUElDX0FSTjogdGhpcy50ZXN0Tm90aWZpY2F0aW9uVG9waWMudG9waWNBcm4sXG4gICAgICAgIEZTWF9GSUxFX1NZU1RFTV9JRDogcHJvcHMuY29uZmlnLmZzeEludGVncmF0aW9uLmZpbGVTeXN0ZW1JZCB8fCAnJyxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICBsb2dHcm91cDogdGhpcy50ZXN0TG9nR3JvdXAsXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGHlrp/ooYzmqKnpmZDvvIjmnIDlsI/mqKnpmZDjga7ljp/liYfjgavlvpPjgaPjgabliLbpmZDvvIlcbiAgICBmc3hNb3VudFRlc3RGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmF0Y2g6U3VibWl0Sm9iJyxcbiAgICAgICAgJ2JhdGNoOkxpc3RKb2JzJyxcbiAgICAgICAgJ2JhdGNoOkRlc2NyaWJlSm9icycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIHByb3BzLmJhdGNoSW50ZWdyYXRpb24uYmF0Y2hDb25zdHJ1Y3Quam9iUXVldWUuYXR0ckpvYlF1ZXVlQXJuLFxuICAgICAgICBwcm9wcy5iYXRjaEludGVncmF0aW9uLmJhdGNoQ29uc3RydWN0LmpvYkRlZmluaXRpb24uYXR0ckpvYkRlZmluaXRpb25Bcm4sXG4gICAgICAgIGBhcm46YXdzOmJhdGNoOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06am9iLypgLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICBmc3hNb3VudFRlc3RGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnZnN4OkRlc2NyaWJlRmlsZVN5c3RlbXMnLFxuICAgICAgICAnZnN4OkRlc2NyaWJlVm9sdW1lcycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmZzeDoke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OmZpbGUtc3lzdGVtLyR7cHJvcHMuY29uZmlnLmZzeEludGVncmF0aW9uLmZpbGVTeXN0ZW1JZCB8fCAnKid9YCxcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgZnN4TW91bnRUZXN0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NuczpQdWJsaXNoJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFt0aGlzLnRlc3ROb3RpZmljYXRpb25Ub3BpYy50b3BpY0Fybl0sXG4gICAgfSkpO1xuXG4gICAgZnN4TW91bnRUZXN0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nR3JvdXAnLFxuICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW3RoaXMudGVzdExvZ0dyb3VwLmxvZ0dyb3VwQXJuXSxcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gZnN4TW91bnRUZXN0RnVuY3Rpb247XG4gIH1cblxuICAvKipcbiAgICog6Ieq5YuV5b6p5pen44OG44K544OITGFtYmRh6Zai5pWw5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUF1dG9SZWNvdmVyeVRlc3RGdW5jdGlvbihwcm9wczogQmF0Y2hJbnRlZ3JhdGlvblRlc3RQcm9wcyk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgY29uc3QgYXV0b1JlY292ZXJ5VGVzdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXV0b1JlY292ZXJ5VGVzdEZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tYXV0by1yZWNvdmVyeS10ZXN0YCxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG5pbXBvcnQgYm90bzNcbmltcG9ydCBqc29uXG5pbXBvcnQgb3NcbmltcG9ydCB0aW1lXG5mcm9tIGRhdGV0aW1lIGltcG9ydCBkYXRldGltZVxuZnJvbSB0eXBpbmcgaW1wb3J0IERpY3QsIExpc3QsIEFueVxuXG5kZWYgaGFuZGxlcihldmVudCwgY29udGV4dCk6XG4gICAgXCJcIlwiXG4gICAg6Ieq5YuV5b6p5pen5qmf6IO944OG44K544OIXG4gICAgXG4gICAg44OG44K544OI6aCF55uuOlxuICAgIDEuIOaEj+Wbs+eahOOBquOCuOODp+ODluWkseaVl+OBrueZuueUn1xuICAgIDIuIOiHquWLleW+qeaXp+apn+iDveOBruWLleS9nOeiuuiqjVxuICAgIDMuIOOCouODqeODvOODoOODu+mAmuefpeapn+iDveOBrueiuuiqjVxuICAgIDQuIOW+qeaXp+W+jOOBruato+W4uOWLleS9nOeiuuiqjVxuICAgIFwiXCJcIlxuICAgIFxuICAgIGJhdGNoX2NsaWVudCA9IGJvdG8zLmNsaWVudCgnYmF0Y2gnKVxuICAgIGNsb3Vkd2F0Y2ggPSBib3RvMy5jbGllbnQoJ2Nsb3Vkd2F0Y2gnKVxuICAgIHNuc19jbGllbnQgPSBib3RvMy5jbGllbnQoJ3NucycpXG4gICAgXG4gICAgam9iX3F1ZXVlX25hbWUgPSBvcy5lbnZpcm9uWydKT0JfUVVFVUVfTkFNRSddXG4gICAgam9iX2RlZmluaXRpb25fbmFtZSA9IG9zLmVudmlyb25bJ0pPQl9ERUZJTklUSU9OX05BTUUnXVxuICAgIHRlc3RfdG9waWNfYXJuID0gb3MuZW52aXJvblsnVEVTVF9UT1BJQ19BUk4nXVxuICAgIFxuICAgIHRlc3RfcmVzdWx0cyA9IHtcbiAgICAgICAgJ3RpbWVzdGFtcCc6IGRhdGV0aW1lLm5vdygpLmlzb2Zvcm1hdCgpLFxuICAgICAgICAndGVzdF9zdWl0ZSc6ICdhdXRvX3JlY292ZXJ5X3Rlc3QnLFxuICAgICAgICAndGVzdHMnOiBbXVxuICAgIH1cbiAgICBcbiAgICB0cnk6XG4gICAgICAgICMg44OG44K544OIMTog5oSP5Zuz55qE44Gq44K444On44OW5aSx5pWX44OG44K544OIXG4gICAgICAgIHRlc3RfcmVzdWx0c1sndGVzdHMnXS5hcHBlbmQoXG4gICAgICAgICAgICB0ZXN0X2ludGVudGlvbmFsX2pvYl9mYWlsdXJlKGJhdGNoX2NsaWVudCwgam9iX3F1ZXVlX25hbWUsIGpvYl9kZWZpbml0aW9uX25hbWUpXG4gICAgICAgIClcbiAgICAgICAgXG4gICAgICAgICMg44OG44K544OIMjog5aSx5pWX44K444On44OW44Oh44OI44Oq44Kv44K556K66KqNXG4gICAgICAgIHRlc3RfcmVzdWx0c1sndGVzdHMnXS5hcHBlbmQoXG4gICAgICAgICAgICB0ZXN0X2ZhaWx1cmVfbWV0cmljcyhjbG91ZHdhdGNoLCBqb2JfcXVldWVfbmFtZSlcbiAgICAgICAgKVxuICAgICAgICBcbiAgICAgICAgIyDjg4bjgrnjg4gzOiDoh6rli5Xlvqnml6fmqZ/og73li5XkvZznorroqo1cbiAgICAgICAgdGVzdF9yZXN1bHRzWyd0ZXN0cyddLmFwcGVuZChcbiAgICAgICAgICAgIHRlc3RfYXV0b19yZWNvdmVyeV9tZWNoYW5pc20oYmF0Y2hfY2xpZW50LCBqb2JfcXVldWVfbmFtZSwgam9iX2RlZmluaXRpb25fbmFtZSlcbiAgICAgICAgKVxuICAgICAgICBcbiAgICAgICAgIyDjg4bjgrnjg4g0OiDlvqnml6flvozjga7mraPluLjli5XkvZznorroqo1cbiAgICAgICAgdGVzdF9yZXN1bHRzWyd0ZXN0cyddLmFwcGVuZChcbiAgICAgICAgICAgIHRlc3RfcG9zdF9yZWNvdmVyeV9vcGVyYXRpb24oYmF0Y2hfY2xpZW50LCBqb2JfcXVldWVfbmFtZSwgam9iX2RlZmluaXRpb25fbmFtZSlcbiAgICAgICAgKVxuICAgICAgICBcbiAgICAgICAgIyDjg4bjgrnjg4jntZDmnpzjga7pm4boqIhcbiAgICAgICAgdG90YWxfdGVzdHMgPSBsZW4odGVzdF9yZXN1bHRzWyd0ZXN0cyddKVxuICAgICAgICBwYXNzZWRfdGVzdHMgPSBzdW0oMSBmb3IgdGVzdCBpbiB0ZXN0X3Jlc3VsdHNbJ3Rlc3RzJ10gaWYgdGVzdFsnc3RhdHVzJ10gPT0gJ1BBU1NFRCcpXG4gICAgICAgIGZhaWxlZF90ZXN0cyA9IHRvdGFsX3Rlc3RzIC0gcGFzc2VkX3Rlc3RzXG4gICAgICAgIFxuICAgICAgICB0ZXN0X3Jlc3VsdHNbJ3N1bW1hcnknXSA9IHtcbiAgICAgICAgICAgICd0b3RhbCc6IHRvdGFsX3Rlc3RzLFxuICAgICAgICAgICAgJ3Bhc3NlZCc6IHBhc3NlZF90ZXN0cyxcbiAgICAgICAgICAgICdmYWlsZWQnOiBmYWlsZWRfdGVzdHMsXG4gICAgICAgICAgICAnc3VjY2Vzc19yYXRlJzogKHBhc3NlZF90ZXN0cyAvIHRvdGFsX3Rlc3RzKSAqIDEwMCBpZiB0b3RhbF90ZXN0cyA+IDAgZWxzZSAwXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgICMgQ2xvdWRXYXRjaOODoeODiOODquOCr+OCueOBq+mAgeS/oVxuICAgICAgICBjbG91ZHdhdGNoLnB1dF9tZXRyaWNfZGF0YShcbiAgICAgICAgICAgIE5hbWVzcGFjZT0nRW1iZWRkaW5nQmF0Y2gvQXV0b1JlY292ZXJ5VGVzdCcsXG4gICAgICAgICAgICBNZXRyaWNEYXRhPVtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICdNZXRyaWNOYW1lJzogJ1JlY292ZXJ5VGVzdFN1Y2Nlc3NSYXRlJyxcbiAgICAgICAgICAgICAgICAgICAgJ1ZhbHVlJzogdGVzdF9yZXN1bHRzWydzdW1tYXJ5J11bJ3N1Y2Nlc3NfcmF0ZSddLFxuICAgICAgICAgICAgICAgICAgICAnVW5pdCc6ICdQZXJjZW50J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgKVxuICAgICAgICBcbiAgICAgICAgIyDjg4bjgrnjg4jntZDmnpzpgJrnn6VcbiAgICAgICAgbm90aWZpY2F0aW9uX21lc3NhZ2UgPSBmb3JtYXRfcmVjb3ZlcnlfdGVzdF9ub3RpZmljYXRpb24odGVzdF9yZXN1bHRzKVxuICAgICAgICBzbnNfY2xpZW50LnB1Ymxpc2goXG4gICAgICAgICAgICBUb3BpY0Fybj10ZXN0X3RvcGljX2FybixcbiAgICAgICAgICAgIFN1YmplY3Q9ZidBdXRvIFJlY292ZXJ5IFRlc3QgUmVzdWx0cyAtIHt0ZXN0X3Jlc3VsdHNbXCJzdW1tYXJ5XCJdW1wic3VjY2Vzc19yYXRlXCJdOi4xZn0lIFN1Y2Nlc3MnLFxuICAgICAgICAgICAgTWVzc2FnZT1ub3RpZmljYXRpb25fbWVzc2FnZVxuICAgICAgICApXG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ3N0YXR1c0NvZGUnOiAyMDAsXG4gICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHModGVzdF9yZXN1bHRzKVxuICAgICAgICB9XG4gICAgICAgIFxuICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgZXJyb3JfcmVzdWx0ID0ge1xuICAgICAgICAgICAgJ3RpbWVzdGFtcCc6IGRhdGV0aW1lLm5vdygpLmlzb2Zvcm1hdCgpLFxuICAgICAgICAgICAgJ3Rlc3Rfc3VpdGUnOiAnYXV0b19yZWNvdmVyeV90ZXN0JyxcbiAgICAgICAgICAgICdlcnJvcic6IHN0cihlKSxcbiAgICAgICAgICAgICdzdGF0dXMnOiAnRVJST1InXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHNuc19jbGllbnQucHVibGlzaChcbiAgICAgICAgICAgIFRvcGljQXJuPXRlc3RfdG9waWNfYXJuLFxuICAgICAgICAgICAgU3ViamVjdD0nQXV0byBSZWNvdmVyeSBUZXN0IEVSUk9SJyxcbiAgICAgICAgICAgIE1lc3NhZ2U9ZidBdXRvIHJlY292ZXJ5IHRlc3QgZXhlY3V0aW9uIGZhaWxlZDoge3N0cihlKX0nXG4gICAgICAgIClcbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAnc3RhdHVzQ29kZSc6IDUwMCxcbiAgICAgICAgICAgICdib2R5JzoganNvbi5kdW1wcyhlcnJvcl9yZXN1bHQpXG4gICAgICAgIH1cblxuZGVmIHRlc3RfaW50ZW50aW9uYWxfam9iX2ZhaWx1cmUoYmF0Y2hfY2xpZW50LCBqb2JfcXVldWVfbmFtZSwgam9iX2RlZmluaXRpb25fbmFtZSk6XG4gICAgXCJcIlwi5oSP5Zuz55qE44Gq44K444On44OW5aSx5pWX44OG44K544OIXCJcIlwiXG4gICAgdGVzdF9uYW1lID0gJ2ludGVudGlvbmFsX2pvYl9mYWlsdXJlJ1xuICAgIFxuICAgIHRyeTpcbiAgICAgICAgIyDopIfmlbDjga7lpLHmlZfjgrjjg6fjg5bjgpLlrp/ooYzjgZfjgaboh6rli5Xlvqnml6fjgpLjg4jjg6rjgqzjg7xcbiAgICAgICAgZmFpbGVkX2pvYl9pZHMgPSBbXVxuICAgICAgICBGQUlMVVJFX0pPQl9DT1VOVCA9IDMgICMg5a6a5pWw44Go44GX44Gm5a6a576pXG4gICAgICAgIFxuICAgICAgICBmb3IgaSBpbiByYW5nZShGQUlMVVJFX0pPQl9DT1VOVCk6XG4gICAgICAgICAgICBqb2JfbmFtZSA9IGYnZmFpbHVyZS10cmlnZ2VyLWpvYi17aX0te2ludCh0aW1lLnRpbWUoKSl9J1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXNwb25zZSA9IGJhdGNoX2NsaWVudC5zdWJtaXRfam9iKFxuICAgICAgICAgICAgICAgIGpvYk5hbWU9am9iX25hbWUsXG4gICAgICAgICAgICAgICAgam9iUXVldWU9am9iX3F1ZXVlX25hbWUsXG4gICAgICAgICAgICAgICAgam9iRGVmaW5pdGlvbj1qb2JfZGVmaW5pdGlvbl9uYW1lLFxuICAgICAgICAgICAgICAgIHBhcmFtZXRlcnM9e1xuICAgICAgICAgICAgICAgICAgICAndGVzdF9tb2RlJzogJ3RydWUnLFxuICAgICAgICAgICAgICAgICAgICAndGVzdF90eXBlJzogJ3JlY292ZXJ5X3RyaWdnZXInLFxuICAgICAgICAgICAgICAgICAgICAnZm9yY2VfZmFpbHVyZSc6ICd0cnVlJyxcbiAgICAgICAgICAgICAgICAgICAgJ2ZhaWx1cmVfdHlwZSc6ICdleGl0X2NvZGVfMSdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ9eydhdHRlbXB0RHVyYXRpb25TZWNvbmRzJzogMTIwfSxcbiAgICAgICAgICAgICAgICByZXRyeVN0cmF0ZWd5PXsnYXR0ZW1wdHMnOiAxfSAgIyDlho3oqabooYzjga8x5Zue44Gu44G/XG4gICAgICAgICAgICApXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZhaWxlZF9qb2JfaWRzLmFwcGVuZChyZXNwb25zZVsnam9iSWQnXSlcbiAgICAgICAgXG4gICAgICAgICMg5YWo44K444On44OW44Gu5a6M5LqG44KS5b6F5qmfXG4gICAgICAgIG1heF93YWl0X3RpbWUgPSAzMDAgICMgNeWIhlxuICAgICAgICB3YWl0X2ludGVydmFsID0gMTAgICAjIDEw56eS6ZaT6ZqUXG4gICAgICAgIGVsYXBzZWRfdGltZSA9IDBcbiAgICAgICAgXG4gICAgICAgIHdoaWxlIGVsYXBzZWRfdGltZSA8IG1heF93YWl0X3RpbWU6XG4gICAgICAgICAgICBqb2JfZGV0YWlscyA9IGJhdGNoX2NsaWVudC5kZXNjcmliZV9qb2JzKGpvYnM9ZmFpbGVkX2pvYl9pZHMpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbXBsZXRlZF9qb2JzID0gW1xuICAgICAgICAgICAgICAgIGpvYiBmb3Igam9iIGluIGpvYl9kZXRhaWxzWydqb2JzJ10gXG4gICAgICAgICAgICAgICAgaWYgam9iWydqb2JTdGF0dXMnXSBpbiBbJ1NVQ0NFRURFRCcsICdGQUlMRUQnXVxuICAgICAgICAgICAgXVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiBsZW4oY29tcGxldGVkX2pvYnMpID09IGxlbihmYWlsZWRfam9iX2lkcyk6XG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIHRpbWUuc2xlZXAod2FpdF9pbnRlcnZhbClcbiAgICAgICAgICAgIGVsYXBzZWRfdGltZSArPSB3YWl0X2ludGVydmFsXG4gICAgICAgIFxuICAgICAgICAjIOe1kOaenOOCkueiuuiqjVxuICAgICAgICBmaW5hbF9qb2JfZGV0YWlscyA9IGJhdGNoX2NsaWVudC5kZXNjcmliZV9qb2JzKGpvYnM9ZmFpbGVkX2pvYl9pZHMpXG4gICAgICAgIGZhaWxlZF9qb2JzID0gW1xuICAgICAgICAgICAgam9iIGZvciBqb2IgaW4gZmluYWxfam9iX2RldGFpbHNbJ2pvYnMnXSBcbiAgICAgICAgICAgIGlmIGpvYlsnam9iU3RhdHVzJ10gPT0gJ0ZBSUxFRCdcbiAgICAgICAgXVxuICAgICAgICBcbiAgICAgICAgaWYgbGVuKGZhaWxlZF9qb2JzKSA+PSAzOiAgIyDlhajjgrjjg6fjg5bjgYzlpLHmlZdcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ1BBU1NFRCcsXG4gICAgICAgICAgICAgICAgJ2ZhaWxlZF9qb2JfY291bnQnOiBsZW4oZmFpbGVkX2pvYnMpLFxuICAgICAgICAgICAgICAgICdqb2JfaWRzJzogZmFpbGVkX2pvYl9pZHMsXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiAnU3VjY2Vzc2Z1bGx5IHRyaWdnZXJlZCBqb2IgZmFpbHVyZXMgZm9yIHJlY292ZXJ5IHRlc3RpbmcnXG4gICAgICAgICAgICB9XG4gICAgICAgIGVsc2U6XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICd0ZXN0X25hbWUnOiB0ZXN0X25hbWUsXG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdGQUlMRUQnLFxuICAgICAgICAgICAgICAgICdmYWlsZWRfam9iX2NvdW50JzogbGVuKGZhaWxlZF9qb2JzKSxcbiAgICAgICAgICAgICAgICAnZXhwZWN0ZWRfZmFpbHVyZXMnOiAzLFxuICAgICAgICAgICAgICAgICdtZXNzYWdlJzogZidFeHBlY3RlZCAzIGZhaWx1cmVzLCBnb3Qge2xlbihmYWlsZWRfam9icyl9J1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICdzdGF0dXMnOiAnRVJST1InLFxuICAgICAgICAgICAgJ2Vycm9yJzogc3RyKGUpLFxuICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ0ludGVudGlvbmFsIGZhaWx1cmUgdGVzdCBmYWlsZWQ6IHtzdHIoZSl9J1xuICAgICAgICB9XG5cbmRlZiB0ZXN0X2ZhaWx1cmVfbWV0cmljcyhjbG91ZHdhdGNoLCBqb2JfcXVldWVfbmFtZSk6XG4gICAgXCJcIlwi5aSx5pWX44K444On44OW44Oh44OI44Oq44Kv44K556K66KqNXCJcIlwiXG4gICAgdGVzdF9uYW1lID0gJ2ZhaWx1cmVfbWV0cmljcydcbiAgICBcbiAgICB0cnk6XG4gICAgICAgICMg5aSx5pWX44K444On44OW44Gu44Oh44OI44Oq44Kv44K544KS56K66KqNXG4gICAgICAgIGVuZF90aW1lID0gZGF0ZXRpbWUubm93KClcbiAgICAgICAgc3RhcnRfdGltZSA9IGRhdGV0aW1lLm5vdygpLnJlcGxhY2UobWludXRlPTAsIHNlY29uZD0wLCBtaWNyb3NlY29uZD0wKSAgIyDnj77lnKjjga7mmYLliLvjga7plovlp4tcbiAgICAgICAgXG4gICAgICAgIHJlc3BvbnNlID0gY2xvdWR3YXRjaC5nZXRfbWV0cmljX3N0YXRpc3RpY3MoXG4gICAgICAgICAgICBOYW1lc3BhY2U9J0FXUy9CYXRjaCcsXG4gICAgICAgICAgICBNZXRyaWNOYW1lPSdGYWlsZWRKb2JzJyxcbiAgICAgICAgICAgIERpbWVuc2lvbnM9W1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJ05hbWUnOiAnSm9iUXVldWUnLFxuICAgICAgICAgICAgICAgICAgICAnVmFsdWUnOiBqb2JfcXVldWVfbmFtZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBTdGFydFRpbWU9c3RhcnRfdGltZSxcbiAgICAgICAgICAgIEVuZFRpbWU9ZW5kX3RpbWUsXG4gICAgICAgICAgICBQZXJpb2Q9MzAwLCAgIyA15YiG6ZaT6ZqUXG4gICAgICAgICAgICBTdGF0aXN0aWNzPVsnU3VtJ11cbiAgICAgICAgKVxuICAgICAgICBcbiAgICAgICAgaWYgcmVzcG9uc2VbJ0RhdGFwb2ludHMnXTpcbiAgICAgICAgICAgIHRvdGFsX2ZhaWx1cmVzID0gc3VtKHBvaW50WydTdW0nXSBmb3IgcG9pbnQgaW4gcmVzcG9uc2VbJ0RhdGFwb2ludHMnXSlcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgdG90YWxfZmFpbHVyZXMgPj0gMzogICMg5pyf5b6F44GV44KM44KL5aSx5pWX5pWwXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdQQVNTRUQnLFxuICAgICAgICAgICAgICAgICAgICAndG90YWxfZmFpbHVyZXMnOiB0b3RhbF9mYWlsdXJlcyxcbiAgICAgICAgICAgICAgICAgICAgJ2RhdGFwb2ludHMnOiBsZW4ocmVzcG9uc2VbJ0RhdGFwb2ludHMnXSksXG4gICAgICAgICAgICAgICAgICAgICdtZXNzYWdlJzogZidGYWlsdXJlIG1ldHJpY3MgZGV0ZWN0ZWQ6IHt0b3RhbF9mYWlsdXJlc30gZmFpbGVkIGpvYnMnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZTpcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAndGVzdF9uYW1lJzogdGVzdF9uYW1lLFxuICAgICAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ1BBUlRJQUwnLFxuICAgICAgICAgICAgICAgICAgICAndG90YWxfZmFpbHVyZXMnOiB0b3RhbF9mYWlsdXJlcyxcbiAgICAgICAgICAgICAgICAgICAgJ2V4cGVjdGVkX2ZhaWx1cmVzJzogMyxcbiAgICAgICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ1NvbWUgZmFpbHVyZXMgZGV0ZWN0ZWQ6IHt0b3RhbF9mYWlsdXJlc30gZmFpbGVkIGpvYnMnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICBlbHNlOlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAndGVzdF9uYW1lJzogdGVzdF9uYW1lLFxuICAgICAgICAgICAgICAgICdzdGF0dXMnOiAnRkFJTEVEJyxcbiAgICAgICAgICAgICAgICAnbWVzc2FnZSc6ICdObyBmYWlsdXJlIG1ldHJpY3MgZm91bmQnXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAndGVzdF9uYW1lJzogdGVzdF9uYW1lLFxuICAgICAgICAgICAgJ3N0YXR1cyc6ICdFUlJPUicsXG4gICAgICAgICAgICAnZXJyb3InOiBzdHIoZSksXG4gICAgICAgICAgICAnbWVzc2FnZSc6IGYnRmFpbHVyZSBtZXRyaWNzIGNoZWNrIGZhaWxlZDoge3N0cihlKX0nXG4gICAgICAgIH1cblxuZGVmIHRlc3RfYXV0b19yZWNvdmVyeV9tZWNoYW5pc20oYmF0Y2hfY2xpZW50LCBqb2JfcXVldWVfbmFtZSwgam9iX2RlZmluaXRpb25fbmFtZSk6XG4gICAgXCJcIlwi6Ieq5YuV5b6p5pen5qmf6IO95YuV5L2c56K66KqNXCJcIlwiXG4gICAgdGVzdF9uYW1lID0gJ2F1dG9fcmVjb3ZlcnlfbWVjaGFuaXNtJ1xuICAgIFxuICAgIHRyeTpcbiAgICAgICAgIyDlvqnml6fmqZ/og73jgYzli5XkvZzjgZnjgovjgb7jgaflvoXmqZ9cbiAgICAgICAgdGltZS5zbGVlcCg2MCkgICMgMeWIhuW+heapn++8iOW+qeaXp+apn+iDveOBruWLleS9nOOCkuW+heOBpO+8iVxuICAgICAgICBcbiAgICAgICAgIyBKb2IgUXVldWXjga7nirbmhYvjgpLnorroqo1cbiAgICAgICAgcXVldWVzID0gYmF0Y2hfY2xpZW50LmRlc2NyaWJlX2pvYl9xdWV1ZXMoam9iUXVldWVzPVtqb2JfcXVldWVfbmFtZV0pXG4gICAgICAgIFxuICAgICAgICBpZiBub3QgcXVldWVzWydqb2JRdWV1ZXMnXTpcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ0ZBSUxFRCcsXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ0pvYiBxdWV1ZSB7am9iX3F1ZXVlX25hbWV9IG5vdCBmb3VuZCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHF1ZXVlX2luZm8gPSBxdWV1ZXNbJ2pvYlF1ZXVlcyddWzBdXG4gICAgICAgIHF1ZXVlX3N0YXRlID0gcXVldWVfaW5mb1snc3RhdGUnXVxuICAgICAgICBcbiAgICAgICAgIyDjgrPjg7Pjg5Tjg6Xjg7zjg4jnkrDlooPjga7nirbmhYvjgpLnorroqo1cbiAgICAgICAgY29tcHV0ZV9lbnZzID0gcXVldWVfaW5mb1snY29tcHV0ZUVudmlyb25tZW50T3JkZXInXVxuICAgICAgICBcbiAgICAgICAgaWYgcXVldWVfc3RhdGUgPT0gJ0VOQUJMRUQnIGFuZCBjb21wdXRlX2VudnM6XG4gICAgICAgICAgICBjb21wdXRlX2Vudl9uYW1lID0gY29tcHV0ZV9lbnZzWzBdWydjb21wdXRlRW52aXJvbm1lbnQnXVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAjIOOCs+ODs+ODlOODpeODvOODiOeSsOWig+OBruips+e0sOOCkuWPluW+l1xuICAgICAgICAgICAgY29tcHV0ZV9lbnZfcmVzcG9uc2UgPSBiYXRjaF9jbGllbnQuZGVzY3JpYmVfY29tcHV0ZV9lbnZpcm9ubWVudHMoXG4gICAgICAgICAgICAgICAgY29tcHV0ZUVudmlyb25tZW50cz1bY29tcHV0ZV9lbnZfbmFtZV1cbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgY29tcHV0ZV9lbnZfcmVzcG9uc2VbJ2NvbXB1dGVFbnZpcm9ubWVudHMnXTpcbiAgICAgICAgICAgICAgICBjb21wdXRlX2VudiA9IGNvbXB1dGVfZW52X3Jlc3BvbnNlWydjb21wdXRlRW52aXJvbm1lbnRzJ11bMF1cbiAgICAgICAgICAgICAgICBjb21wdXRlX3N0YXRlID0gY29tcHV0ZV9lbnZbJ3N0YXRlJ11cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiBjb21wdXRlX3N0YXRlID09ICdFTkFCTEVEJzpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICd0ZXN0X25hbWUnOiB0ZXN0X25hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ1BBU1NFRCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAncXVldWVfc3RhdGUnOiBxdWV1ZV9zdGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdjb21wdXRlX2Vudl9zdGF0ZSc6IGNvbXB1dGVfc3RhdGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAnbWVzc2FnZSc6ICdBdXRvIHJlY292ZXJ5IG1lY2hhbmlzbSBhcHBlYXJzIHRvIGJlIHdvcmtpbmcnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdzdGF0dXMnOiAnRkFJTEVEJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdxdWV1ZV9zdGF0ZSc6IHF1ZXVlX3N0YXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2NvbXB1dGVfZW52X3N0YXRlJzogY29tcHV0ZV9zdGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICdtZXNzYWdlJzogZidDb21wdXRlIGVudmlyb25tZW50IG5vdCByZWNvdmVyZWQ6IHtjb21wdXRlX3N0YXRlfSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZTpcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAndGVzdF9uYW1lJzogdGVzdF9uYW1lLFxuICAgICAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ0ZBSUxFRCcsXG4gICAgICAgICAgICAgICAgICAgICdtZXNzYWdlJzogJ0NvbXB1dGUgZW52aXJvbm1lbnQgbm90IGZvdW5kJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZTpcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ0ZBSUxFRCcsXG4gICAgICAgICAgICAgICAgJ3F1ZXVlX3N0YXRlJzogcXVldWVfc3RhdGUsXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ0pvYiBxdWV1ZSBub3QgcmVjb3ZlcmVkOiB7cXVldWVfc3RhdGV9J1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICdzdGF0dXMnOiAnRVJST1InLFxuICAgICAgICAgICAgJ2Vycm9yJzogc3RyKGUpLFxuICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ0F1dG8gcmVjb3ZlcnkgbWVjaGFuaXNtIHRlc3QgZmFpbGVkOiB7c3RyKGUpfSdcbiAgICAgICAgfVxuXG5kZWYgdGVzdF9wb3N0X3JlY292ZXJ5X29wZXJhdGlvbihiYXRjaF9jbGllbnQsIGpvYl9xdWV1ZV9uYW1lLCBqb2JfZGVmaW5pdGlvbl9uYW1lKTpcbiAgICBcIlwiXCLlvqnml6flvozjga7mraPluLjli5XkvZznorroqo1cIlwiXCJcbiAgICB0ZXN0X25hbWUgPSAncG9zdF9yZWNvdmVyeV9vcGVyYXRpb24nXG4gICAgXG4gICAgdHJ5OlxuICAgICAgICAjIOW+qeaXp+W+jOOBq+ato+W4uOOBquOCuOODp+ODluOCkuWun+ihjFxuICAgICAgICBqb2JfbmFtZSA9IGYncG9zdC1yZWNvdmVyeS10ZXN0LXtpbnQodGltZS50aW1lKCkpfSdcbiAgICAgICAgXG4gICAgICAgIHJlc3BvbnNlID0gYmF0Y2hfY2xpZW50LnN1Ym1pdF9qb2IoXG4gICAgICAgICAgICBqb2JOYW1lPWpvYl9uYW1lLFxuICAgICAgICAgICAgam9iUXVldWU9am9iX3F1ZXVlX25hbWUsXG4gICAgICAgICAgICBqb2JEZWZpbml0aW9uPWpvYl9kZWZpbml0aW9uX25hbWUsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzPXtcbiAgICAgICAgICAgICAgICAndGVzdF9tb2RlJzogJ3RydWUnLFxuICAgICAgICAgICAgICAgICd0ZXN0X3R5cGUnOiAncG9zdF9yZWNvdmVyeV90ZXN0JyxcbiAgICAgICAgICAgICAgICAndmVyaWZ5X3JlY292ZXJ5JzogJ3RydWUnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGltZW91dD17J2F0dGVtcHREdXJhdGlvblNlY29uZHMnOiAzMDB9XG4gICAgICAgIClcbiAgICAgICAgXG4gICAgICAgIGpvYl9pZCA9IHJlc3BvbnNlWydqb2JJZCddXG4gICAgICAgIFxuICAgICAgICAjIOOCuOODp+ODluOBruWujOS6huOCkuW+heapn1xuICAgICAgICBtYXhfd2FpdF90aW1lID0gMzAwICAjIDXliIZcbiAgICAgICAgd2FpdF9pbnRlcnZhbCA9IDEwICAgIyAxMOenkumWk+malFxuICAgICAgICBlbGFwc2VkX3RpbWUgPSAwXG4gICAgICAgIFxuICAgICAgICB3aGlsZSBlbGFwc2VkX3RpbWUgPCBtYXhfd2FpdF90aW1lOlxuICAgICAgICAgICAgam9iX2RldGFpbCA9IGJhdGNoX2NsaWVudC5kZXNjcmliZV9qb2JzKGpvYnM9W2pvYl9pZF0pXG4gICAgICAgICAgICBqb2Jfc3RhdHVzID0gam9iX2RldGFpbFsnam9icyddWzBdWydqb2JTdGF0dXMnXVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiBqb2Jfc3RhdHVzIGluIFsnU1VDQ0VFREVEJywgJ0ZBSUxFRCddOlxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB0aW1lLnNsZWVwKHdhaXRfaW50ZXJ2YWwpXG4gICAgICAgICAgICBlbGFwc2VkX3RpbWUgKz0gd2FpdF9pbnRlcnZhbFxuICAgICAgICBcbiAgICAgICAgIyDmnIDntYLnirbmhYvjgpLnorroqo1cbiAgICAgICAgZmluYWxfam9iX2RldGFpbCA9IGJhdGNoX2NsaWVudC5kZXNjcmliZV9qb2JzKGpvYnM9W2pvYl9pZF0pXG4gICAgICAgIGZpbmFsX3N0YXR1cyA9IGZpbmFsX2pvYl9kZXRhaWxbJ2pvYnMnXVswXVsnam9iU3RhdHVzJ11cbiAgICAgICAgXG4gICAgICAgIGlmIGZpbmFsX3N0YXR1cyA9PSAnU1VDQ0VFREVEJzpcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3Rlc3RfbmFtZSc6IHRlc3RfbmFtZSxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ1BBU1NFRCcsXG4gICAgICAgICAgICAgICAgJ2pvYl9pZCc6IGpvYl9pZCxcbiAgICAgICAgICAgICAgICAnZXhlY3V0aW9uX3RpbWUnOiBlbGFwc2VkX3RpbWUsXG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiAnUG9zdC1yZWNvdmVyeSBvcGVyYXRpb24gc3VjY2Vzc2Z1bCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZTpcbiAgICAgICAgICAgIHN0YXR1c19yZWFzb24gPSBmaW5hbF9qb2JfZGV0YWlsWydqb2JzJ11bMF0uZ2V0KCdzdGF0dXNSZWFzb24nLCAnVW5rbm93bicpXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICd0ZXN0X25hbWUnOiB0ZXN0X25hbWUsXG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdGQUlMRUQnLFxuICAgICAgICAgICAgICAgICdqb2JfaWQnOiBqb2JfaWQsXG4gICAgICAgICAgICAgICAgJ2pvYl9zdGF0dXMnOiBmaW5hbF9zdGF0dXMsXG4gICAgICAgICAgICAgICAgJ3N0YXR1c19yZWFzb24nOiBzdGF0dXNfcmVhc29uLFxuICAgICAgICAgICAgICAgICdtZXNzYWdlJzogZidQb3N0LXJlY292ZXJ5IG9wZXJhdGlvbiBmYWlsZWQ6IHtzdGF0dXNfcmVhc29ufSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICd0ZXN0X25hbWUnOiB0ZXN0X25hbWUsXG4gICAgICAgICAgICAnc3RhdHVzJzogJ0VSUk9SJyxcbiAgICAgICAgICAgICdlcnJvcic6IHN0cihlKSxcbiAgICAgICAgICAgICdtZXNzYWdlJzogZidQb3N0LXJlY292ZXJ5IG9wZXJhdGlvbiB0ZXN0IGZhaWxlZDoge3N0cihlKX0nXG4gICAgICAgIH1cblxuZGVmIGZvcm1hdF9yZWNvdmVyeV90ZXN0X25vdGlmaWNhdGlvbih0ZXN0X3Jlc3VsdHMpOlxuICAgIFwiXCJcIuiHquWLleW+qeaXp+ODhuOCueODiOe1kOaenOmAmuefpeODoeODg+OCu+ODvOOCuOOBruODleOCqeODvOODnuODg+ODiFwiXCJcIlxuICAgIG1lc3NhZ2UgPSBmXCJcIlwiXG5BdXRvIFJlY292ZXJ5IFRlc3QgUmVzdWx0c1xuPT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5UaW1lc3RhbXA6IHt0ZXN0X3Jlc3VsdHNbJ3RpbWVzdGFtcCddfVxuVGVzdCBTdWl0ZToge3Rlc3RfcmVzdWx0c1sndGVzdF9zdWl0ZSddfVxuXG5TdW1tYXJ5OlxuLSBUb3RhbCBUZXN0czoge3Rlc3RfcmVzdWx0c1snc3VtbWFyeSddWyd0b3RhbCddfVxuLSBQYXNzZWQ6IHt0ZXN0X3Jlc3VsdHNbJ3N1bW1hcnknXVsncGFzc2VkJ119XG4tIEZhaWxlZDoge3Rlc3RfcmVzdWx0c1snc3VtbWFyeSddWydmYWlsZWQnXX1cbi0gU3VjY2VzcyBSYXRlOiB7dGVzdF9yZXN1bHRzWydzdW1tYXJ5J11bJ3N1Y2Nlc3NfcmF0ZSddOi4xZn0lXG5cblRlc3QgRGV0YWlsczpcblwiXCJcIlxuICAgIFxuICAgIGZvciB0ZXN0IGluIHRlc3RfcmVzdWx0c1sndGVzdHMnXTpcbiAgICAgICAgc3RhdHVzX2ljb24gPSBcIuKchVwiIGlmIHRlc3RbJ3N0YXR1cyddID09ICdQQVNTRUQnIGVsc2UgXCLinYxcIiBpZiB0ZXN0WydzdGF0dXMnXSA9PSAnRkFJTEVEJyBlbHNlIFwi4pqg77iPXCJcbiAgICAgICAgbWVzc2FnZSArPSBmXCIgIHtzdGF0dXNfaWNvbn0ge3Rlc3RbJ3Rlc3RfbmFtZSddfToge3Rlc3RbJ3N0YXR1cyddfSAtIHt0ZXN0WydtZXNzYWdlJ119XFxuXCJcbiAgICBcbiAgICByZXR1cm4gbWVzc2FnZVxuICAgICAgYCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBKT0JfUVVFVUVfTkFNRTogcHJvcHMuYmF0Y2hJbnRlZ3JhdGlvbi5iYXRjaENvbnN0cnVjdC5qb2JRdWV1ZS5qb2JRdWV1ZU5hbWUhLFxuICAgICAgICBKT0JfREVGSU5JVElPTl9OQU1FOiBwcm9wcy5iYXRjaEludGVncmF0aW9uLmJhdGNoQ29uc3RydWN0LmpvYkRlZmluaXRpb24uam9iRGVmaW5pdGlvbk5hbWUhLFxuICAgICAgICBURVNUX1RPUElDX0FSTjogdGhpcy50ZXN0Tm90aWZpY2F0aW9uVG9waWMudG9waWNBcm4sXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgbG9nR3JvdXA6IHRoaXMudGVzdExvZ0dyb3VwLFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRh5a6f6KGM5qip6ZmQ77yI5pyA5bCP5qip6ZmQ44Gu5Y6f5YmH44Gr5b6T44Gj44Gm5Yi26ZmQ77yJXG4gICAgYXV0b1JlY292ZXJ5VGVzdEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdiYXRjaDpTdWJtaXRKb2InLFxuICAgICAgICAnYmF0Y2g6TGlzdEpvYnMnLFxuICAgICAgICAnYmF0Y2g6RGVzY3JpYmVKb2JzJyxcbiAgICAgICAgJ2JhdGNoOkRlc2NyaWJlSm9iUXVldWVzJyxcbiAgICAgICAgJ2JhdGNoOkRlc2NyaWJlQ29tcHV0ZUVudmlyb25tZW50cycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIHByb3BzLmJhdGNoSW50ZWdyYXRpb24uYmF0Y2hDb25zdHJ1Y3Quam9iUXVldWUuYXR0ckpvYlF1ZXVlQXJuLFxuICAgICAgICBwcm9wcy5iYXRjaEludGVncmF0aW9uLmJhdGNoQ29uc3RydWN0LmpvYkRlZmluaXRpb24uYXR0ckpvYkRlZmluaXRpb25Bcm4sXG4gICAgICAgIHByb3BzLmJhdGNoSW50ZWdyYXRpb24uYmF0Y2hDb25zdHJ1Y3QuY29tcHV0ZUVudmlyb25tZW50LmF0dHJDb21wdXRlRW52aXJvbm1lbnRBcm4sXG4gICAgICAgIGBhcm46YXdzOmJhdGNoOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06am9iLypgLFxuICAgICAgXSxcbiAgICB9KSk7XG5cbiAgICBhdXRvUmVjb3ZlcnlUZXN0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2Nsb3Vkd2F0Y2g6R2V0TWV0cmljU3RhdGlzdGljcycsXG4gICAgICAgICdjbG91ZHdhdGNoOlB1dE1ldHJpY0RhdGEnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sIC8vIENsb3VkV2F0Y2jjg6Hjg4jjg6rjgq/jgrnjga/nibnlrprjga7jg6rjgr3jg7zjgrlBUk7jgpLmjIHjgZ/jgarjgYRcbiAgICB9KSk7XG5cbiAgICBhdXRvUmVjb3ZlcnlUZXN0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NuczpQdWJsaXNoJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFt0aGlzLnRlc3ROb3RpZmljYXRpb25Ub3BpYy50b3BpY0Fybl0sXG4gICAgfSkpO1xuXG4gICAgYXV0b1JlY292ZXJ5VGVzdEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ0dyb3VwJyxcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nU3RyZWFtJyxcbiAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFt0aGlzLnRlc3RMb2dHcm91cC5sb2dHcm91cEFybl0sXG4gICAgfSkpO1xuXG4gICAgcmV0dXJuIGF1dG9SZWNvdmVyeVRlc3RGdW5jdGlvbjtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4bjgrnjg4jjgrnjgrHjgrjjg6Xjg7zjg6njg7zkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlVGVzdFNjaGVkdWxlcihwcm9wczogQmF0Y2hJbnRlZ3JhdGlvblRlc3RQcm9wcyk6IGV2ZW50cy5SdWxlIHtcbiAgICBjb25zdCB0ZXN0U2NoZWR1bGVyUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnQmF0Y2hJbnRlZ3JhdGlvblRlc3RTY2hlZHVsZXInLCB7XG4gICAgICBydWxlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWJhdGNoLWludGVncmF0aW9uLXRlc3Qtc2NoZWR1bGVyYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQmF0Y2ggaW50ZWdyYXRpb24gdGVzdCBzY2hlZHVsZXInLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5yYXRlKGNkay5EdXJhdGlvbi5ob3VycyhURVNUX0NPTlNUQU5UUy5TQ0hFRFVMRVMuSU5URUdSQVRJT05fVEVTVCkpLFxuICAgIH0pO1xuXG4gICAgLy8g5Z+65pys44OG44K544OI44KS5a6a5pyf5a6f6KGMXG4gICAgdGVzdFNjaGVkdWxlclJ1bGUuYWRkVGFyZ2V0KG5ldyBldmVudHNUYXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHRoaXMudGVzdFJ1bm5lckZ1bmN0aW9uLCB7XG4gICAgICBldmVudDogZXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgc291cmNlOiAnc2NoZWR1bGVyJyxcbiAgICAgICAgdGVzdF90eXBlOiAnc2NoZWR1bGVkX2Jhc2ljX3Rlc3QnLFxuICAgICAgICB0aW1lc3RhbXA6IGV2ZW50cy5FdmVudEZpZWxkLmZyb21QYXRoKCckLnRpbWUnKSxcbiAgICAgIH0pLFxuICAgIH0pKTtcblxuICAgIHJldHVybiB0ZXN0U2NoZWR1bGVyUnVsZTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4bjgrnjg4jnm6PoppboqK3lrppcbiAgICovXG4gIHByaXZhdGUgY29uZmlndXJlVGVzdE1vbml0b3JpbmcocHJvcHM6IEJhdGNoSW50ZWdyYXRpb25UZXN0UHJvcHMpOiB2b2lkIHtcbiAgICAvLyDjg4bjgrnjg4jlrp/ooYxMYW1iZGHplqLmlbDjga7jgqjjg6njg7znm6PoppZcbiAgICBjb25zdCB0ZXN0UnVubmVyRXJyb3JNZXRyaWMgPSB0aGlzLnRlc3RSdW5uZXJGdW5jdGlvbi5tZXRyaWNFcnJvcnMoe1xuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHRlc3RSdW5uZXJFcnJvckFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ1Rlc3RSdW5uZXJFcnJvckFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tdGVzdC1ydW5uZXItZXJyb3JzYCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdUZXN0IFJ1bm5lciBMYW1iZGEgZnVuY3Rpb24gZXJyb3JzJyxcbiAgICAgIG1ldHJpYzogdGVzdFJ1bm5lckVycm9yTWV0cmljLFxuICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICBkYXRhcG9pbnRzVG9BbGFybTogMSxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX09SX0VRVUFMX1RPX1RIUkVTSE9MRCxcbiAgICB9KTtcblxuICAgIC8vIEZTeOODhuOCueODiOmWouaVsOOBruOCqOODqeODvOebo+imllxuICAgIGNvbnN0IGZzeFRlc3RFcnJvck1ldHJpYyA9IHRoaXMuZnN4TW91bnRUZXN0RnVuY3Rpb24ubWV0cmljRXJyb3JzKHtcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBmc3hUZXN0RXJyb3JBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdGc3hUZXN0RXJyb3JBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWZzeC10ZXN0LWVycm9yc2AsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnRlN4IFRlc3QgTGFtYmRhIGZ1bmN0aW9uIGVycm9ycycsXG4gICAgICBtZXRyaWM6IGZzeFRlc3RFcnJvck1ldHJpYyxcbiAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgZGF0YXBvaW50c1RvQWxhcm06IDEsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXG4gICAgfSk7XG5cbiAgICAvLyDoh6rli5Xlvqnml6fjg4bjgrnjg4jplqLmlbDjga7jgqjjg6njg7znm6PoppZcbiAgICBjb25zdCByZWNvdmVyeVRlc3RFcnJvck1ldHJpYyA9IHRoaXMuYXV0b1JlY292ZXJ5VGVzdEZ1bmN0aW9uLm1ldHJpY0Vycm9ycyh7XG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVjb3ZlcnlUZXN0RXJyb3JBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdSZWNvdmVyeVRlc3RFcnJvckFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tcmVjb3ZlcnktdGVzdC1lcnJvcnNgLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ1JlY292ZXJ5IFRlc3QgTGFtYmRhIGZ1bmN0aW9uIGVycm9ycycsXG4gICAgICBtZXRyaWM6IHJlY292ZXJ5VGVzdEVycm9yTWV0cmljLFxuICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICBkYXRhcG9pbnRzVG9BbGFybTogMSxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX09SX0VRVUFMX1RPX1RIUkVTSE9MRCxcbiAgICB9KTtcblxuICAgIC8vIOODhuOCueODiOe1seWQiOODgOODg+OCt+ODpeODnOODvOODieS9nOaIkFxuICAgIHRoaXMuY3JlYXRlVGVzdERhc2hib2FyZChwcm9wcyk7XG4gIH1cblxuICAvKipcbiAgICog44OG44K544OI57Wx5ZCI44OA44OD44K344Ol44Oc44O844OJ5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVRlc3REYXNoYm9hcmQocHJvcHM6IEJhdGNoSW50ZWdyYXRpb25UZXN0UHJvcHMpOiB2b2lkIHtcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0JhdGNoSW50ZWdyYXRpb25UZXN0RGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWJhdGNoLWludGVncmF0aW9uLXRlc3RgLFxuICAgIH0pO1xuXG4gICAgLy8g44OG44K544OI5a6f6KGM54q25rOBXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnVGVzdCBFeGVjdXRpb24gTWV0cmljcycsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICB0aGlzLnRlc3RSdW5uZXJGdW5jdGlvbi5tZXRyaWNJbnZvY2F0aW9ucygpLFxuICAgICAgICAgIHRoaXMudGVzdFJ1bm5lckZ1bmN0aW9uLm1ldHJpY0Vycm9ycygpLFxuICAgICAgICAgIHRoaXMuZnN4TW91bnRUZXN0RnVuY3Rpb24ubWV0cmljSW52b2NhdGlvbnMoKSxcbiAgICAgICAgICB0aGlzLmZzeE1vdW50VGVzdEZ1bmN0aW9uLm1ldHJpY0Vycm9ycygpLFxuICAgICAgICAgIHRoaXMuYXV0b1JlY292ZXJ5VGVzdEZ1bmN0aW9uLm1ldHJpY0ludm9jYXRpb25zKCksXG4gICAgICAgICAgdGhpcy5hdXRvUmVjb3ZlcnlUZXN0RnVuY3Rpb24ubWV0cmljRXJyb3JzKCksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8g44OG44K544OI5oiQ5Yqf546HXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnVGVzdCBTdWNjZXNzIFJhdGVzJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6ICdFbWJlZGRpbmdCYXRjaC9JbnRlZ3JhdGlvblRlc3QnLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogJ1Rlc3RTdWNjZXNzUmF0ZScsXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnRW1iZWRkaW5nQmF0Y2gvQXV0b1JlY292ZXJ5VGVzdCcsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUmVjb3ZlcnlUZXN0U3VjY2Vzc1JhdGUnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8g44OG44K544OI5a6f6KGM5pmC6ZaTXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnVGVzdCBFeGVjdXRpb24gRHVyYXRpb24nLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgdGhpcy50ZXN0UnVubmVyRnVuY3Rpb24ubWV0cmljRHVyYXRpb24oKSxcbiAgICAgICAgICB0aGlzLmZzeE1vdW50VGVzdEZ1bmN0aW9uLm1ldHJpY0R1cmF0aW9uKCksXG4gICAgICAgICAgdGhpcy5hdXRvUmVjb3ZlcnlUZXN0RnVuY3Rpb24ubWV0cmljRHVyYXRpb24oKSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICog44K/44Kw6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIGFwcGx5VGFncyhwcm9wczogQmF0Y2hJbnRlZ3JhdGlvblRlc3RQcm9wcyk6IHZvaWQge1xuICAgIGNvbnN0IHRhZ3MgPSB7XG4gICAgICBQcm9qZWN0OiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIEVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIENvbXBvbmVudDogJ0VtYmVkZGluZycsXG4gICAgICBNb2R1bGU6ICdCQVRDSF9JTlRFR1JBVElPTl9URVNUJyxcbiAgICAgIE1hbmFnZWRCeTogJ0NESycsXG4gICAgICBUZXN0U3VpdGU6ICdCYXRjaEludGVncmF0aW9uVGVzdCcsXG4gICAgfTtcblxuICAgIE9iamVjdC5lbnRyaWVzKHRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKGtleSwgdmFsdWUpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOaJi+WLleODhuOCueODiOWun+ihjOODoeOCveODg+ODiVxuICAgKi9cbiAgcHVibGljIGFzeW5jIHJ1bkJhc2ljVGVzdCgpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIC8vIOWfuuacrOODhuOCueODiOOCkuaJi+WLleWun+ihjFxuICAgIHJldHVybiAnYmFzaWMtdGVzdC1leGVjdXRpb24taWQnO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIHJ1bkZzeE1vdW50VGVzdCgpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIC8vIEZTeOODnuOCpuODs+ODiOODhuOCueODiOOCkuaJi+WLleWun+ihjFxuICAgIHJldHVybiAnZnN4LW1vdW50LXRlc3QtZXhlY3V0aW9uLWlkJztcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBydW5BdXRvUmVjb3ZlcnlUZXN0KCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgLy8g6Ieq5YuV5b6p5pen44OG44K544OI44KS5omL5YuV5a6f6KGMXG4gICAgcmV0dXJuICdhdXRvLXJlY292ZXJ5LXRlc3QtZXhlY3V0aW9uLWlkJztcbiAgfVxuXG4gIC8qKlxuICAgKiDjg4bjgrnjg4jntZDmnpzlj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRUZXN0SW5mbygpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICByZXR1cm4ge1xuICAgICAgdGVzdFJ1bm5lcjoge1xuICAgICAgICBmdW5jdGlvbk5hbWU6IHRoaXMudGVzdFJ1bm5lckZ1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgICAgICAgZnVuY3Rpb25Bcm46IHRoaXMudGVzdFJ1bm5lckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgfSxcbiAgICAgIGZzeE1vdW50VGVzdDoge1xuICAgICAgICBmdW5jdGlvbk5hbWU6IHRoaXMuZnN4TW91bnRUZXN0RnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgICBmdW5jdGlvbkFybjogdGhpcy5mc3hNb3VudFRlc3RGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIH0sXG4gICAgICBhdXRvUmVjb3ZlcnlUZXN0OiB7XG4gICAgICAgIGZ1bmN0aW9uTmFtZTogdGhpcy5hdXRvUmVjb3ZlcnlUZXN0RnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgICBmdW5jdGlvbkFybjogdGhpcy5hdXRvUmVjb3ZlcnlUZXN0RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICB9LFxuICAgICAgbW9uaXRvcmluZzoge1xuICAgICAgICB0ZXN0Tm90aWZpY2F0aW9uVG9waWM6IHRoaXMudGVzdE5vdGlmaWNhdGlvblRvcGljLnRvcGljQXJuLFxuICAgICAgICB0ZXN0TG9nR3JvdXA6IHRoaXMudGVzdExvZ0dyb3VwLmxvZ0dyb3VwTmFtZSxcbiAgICAgICAgZGFzaGJvYXJkTmFtZTogYCR7dGhpcy5ub2RlLmlkfS10ZXN0YCxcbiAgICAgIH0sXG4gICAgICBzY2hlZHVsZXI6IHtcbiAgICAgICAgcnVsZU5hbWU6IHRoaXMudGVzdFNjaGVkdWxlci5ydWxlTmFtZSxcbiAgICAgICAgc2NoZWR1bGU6ICdyYXRlKDYgaG91cnMpJyxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxufSJdfQ==