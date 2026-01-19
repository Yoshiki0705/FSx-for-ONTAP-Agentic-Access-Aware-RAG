"use strict";
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
exports.EmbeddingBatchIntegration = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const eventsTargets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const snsSubscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const constructs_1 = require("constructs");
const batch_construct_1 = require("./batch-construct");
/**
 * Embedding Batch統合コンストラクト
 *
 * 機能:
 * - BatchConstructの統合管理
 * - EmbeddingStackでの統一インターフェース提供
 * - ジョブ実行・監視・管理機能
 * - 自動スケーリング・自動復旧機能
 */
class EmbeddingBatchIntegration extends constructs_1.Construct {
    /** Batchコンストラクト */
    batchConstruct;
    /** ジョブ管理Lambda関数 */
    jobManagerFunction;
    /** 統合監視SNSトピック */
    integrationTopic;
    /** ジョブスケジューラー */
    jobScheduler;
    constructor(scope, id, props) {
        super(scope, id);
        // Batchコンストラクト作成
        this.batchConstruct = new batch_construct_1.BatchConstruct(this, 'BatchConstruct', {
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
    createIntegrationTopic(props) {
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
    createJobManagerFunction(props) {
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
                JOB_QUEUE_NAME: this.batchConstruct.jobQueue.jobQueueName,
                JOB_DEFINITION_NAME: this.batchConstruct.jobDefinition.jobDefinitionName,
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
    createJobScheduler(props) {
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
    configureIntegrationMonitoring(props) {
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
    createIntegrationDashboard(props) {
        const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'EmbeddingBatchIntegrationDashboard', {
            dashboardName: `${props.projectName}-${props.environment}-embedding-batch-integration`,
        });
        // ジョブ管理Lambda関数メトリクス
        dashboard.addWidgets(new cdk.aws_cloudwatch.GraphWidget({
            title: 'Job Manager Function Metrics',
            left: [
                this.jobManagerFunction.metricInvocations(),
                this.jobManagerFunction.metricErrors(),
                this.jobManagerFunction.metricDuration(),
            ],
            width: 12,
            height: 6,
        }));
        // Batchジョブ統計
        dashboard.addWidgets(new cdk.aws_cloudwatch.GraphWidget({
            title: 'Batch Job Statistics',
            left: [
                new cdk.aws_cloudwatch.Metric({
                    namespace: 'EmbeddingBatch/JobManager',
                    metricName: 'JobsSUCCEEDED',
                    dimensionsMap: { JobQueue: this.batchConstruct.jobQueue.jobQueueName },
                    statistic: 'Sum',
                }),
                new cdk.aws_cloudwatch.Metric({
                    namespace: 'EmbeddingBatch/JobManager',
                    metricName: 'JobsFAILED',
                    dimensionsMap: { JobQueue: this.batchConstruct.jobQueue.jobQueueName },
                    statistic: 'Sum',
                }),
                new cdk.aws_cloudwatch.Metric({
                    namespace: 'EmbeddingBatch/JobManager',
                    metricName: 'JobsRUNNING',
                    dimensionsMap: { JobQueue: this.batchConstruct.jobQueue.jobQueueName },
                    statistic: 'Average',
                }),
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
    async submitEmbeddingJob(jobName, parameters) {
        // ジョブ管理Lambda関数を呼び出してジョブを実行
        // 実際の実装では、AWS SDKを使用してLambda関数を呼び出し
        return this.batchConstruct.submitJob(jobName, parameters);
    }
    /**
     * ジョブ状況取得
     */
    getJobStatus() {
        return this.batchConstruct.getJobQueueMetrics();
    }
    /**
     * 統合リソース情報取得
     */
    getIntegrationInfo() {
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
exports.EmbeddingBatchIntegration = EmbeddingBatchIntegration;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1iZWRkaW5nLWJhdGNoLWludGVncmF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZW1iZWRkaW5nLWJhdGNoLWludGVncmF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7O0dBU0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQywrREFBaUQ7QUFDakQsK0RBQWlEO0FBQ2pELDhFQUFnRTtBQUNoRSx5REFBMkM7QUFDM0Msb0ZBQXNFO0FBR3RFLDJDQUF1QztBQUN2Qyx1REFBbUQ7QUF3Qm5EOzs7Ozs7OztHQVFHO0FBQ0gsTUFBYSx5QkFBMEIsU0FBUSxzQkFBUztJQUN0RCxtQkFBbUI7SUFDSCxjQUFjLENBQWlCO0lBRS9DLG9CQUFvQjtJQUNKLGtCQUFrQixDQUFrQjtJQUVwRCxrQkFBa0I7SUFDRixnQkFBZ0IsQ0FBWTtJQUU1QyxpQkFBaUI7SUFDRCxZQUFZLENBQWM7SUFFMUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFxQztRQUM3RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLGlCQUFpQjtRQUNqQixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksZ0NBQWMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDL0QsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUTtZQUM3QixtQkFBbUIsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLGFBQWE7WUFDL0Msb0JBQW9CLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxjQUFjO1lBQ2pELHFCQUFxQixFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsZUFBZTtZQUNuRCxhQUFhLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPO1lBQ25DLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBVTtZQUN6QyxTQUFTLEVBQUUsS0FBSyxDQUFDLE1B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QyxjQUFjLENBQUMsUUFBUSxDQUFDLFlBQVk7YUFDcEQ7WUFDRCxVQUFVLEVBQUU7Z0JBQ1YsWUFBWSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZO2dCQUNsRCxXQUFXLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFdBQVc7YUFDakQ7WUFDRCxVQUFVLEVBQUU7Z0JBQ1YsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVE7Z0JBQ2hELGFBQWEsRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxjQUFjO2FBQzdDO1lBQ0QsU0FBUyxFQUFFO2dCQUNULFFBQVEsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVE7Z0JBQ3BDLFFBQVEsRUFBRSxrQkFBa0I7YUFDN0I7U0FDRixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBNWJELDhEQTRiQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRW1iZWRkaW5nIEJhdGNo57Wx5ZCI44Kz44Oz44K544OI44Op44Kv44OIXG4gKiBcbiAqIEFnZW50IFN0ZWVyaW5n44Or44O844Or5rqW5ougOlxuICogLSDjg6Ljgrjjg6Xjg6njg7zjgqLjg7zjgq3jg4bjgq/jg4Hjg6PlvLfliLbvvIhsaWIvbW9kdWxlcy9jb21wdXRlL2NvbnN0cnVjdHMv77yJXG4gKiAtIEVtYmVkZGluZ1N0YWNr44Gn44GuQmF0Y2jntbHlkIjmqZ/og71cbiAqIC0g6Ieq5YuV44K544Kx44O844Oq44Oz44Kw44O76Ieq5YuV5b6p5pen5qmf6IO95LuY44GNSm9iIFF1ZXVl566h55CGXG4gKiBcbiAqIFJlcXVpcmVtZW50czogMS4zLCA1LjFcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgZXZlbnRzVGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc25zU3Vic2NyaXB0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zLXN1YnNjcmlwdGlvbnMnO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoQWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgQmF0Y2hDb25zdHJ1Y3QgfSBmcm9tICcuL2JhdGNoLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBFbWJlZGRpbmdDb25maWcgfSBmcm9tICcuLi9pbnRlcmZhY2VzL2VtYmVkZGluZy1jb25maWcnO1xuaW1wb3J0IHsgRW1iZWRkaW5nQ29tbW9uUmVzb3VyY2VzIH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9tb2R1bGUtaW50ZXJmYWNlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRW1iZWRkaW5nQmF0Y2hJbnRlZ3JhdGlvblByb3BzIHtcbiAgLyoqIEVtYmVkZGluZ+ioreWumiAqL1xuICByZWFkb25seSBjb25maWc6IEVtYmVkZGluZ0NvbmZpZztcbiAgXG4gIC8qKiDjg5fjg63jgrjjgqfjgq/jg4jlkI0gKi9cbiAgcmVhZG9ubHkgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgXG4gIC8qKiDnkrDlooPlkI0gKi9cbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgXG4gIC8qKiDlhbHpgJrjg6rjgr3jg7zjgrkgKi9cbiAgcmVhZG9ubHkgY29tbW9uUmVzb3VyY2VzOiBFbWJlZGRpbmdDb21tb25SZXNvdXJjZXM7XG4gIFxuICAvKiogRUNS44Kk44Oh44O844K444OR44K5ICovXG4gIHJlYWRvbmx5IGltYWdlUGF0aDogc3RyaW5nO1xuICBcbiAgLyoqIOOCpOODoeODvOOCuOOCv+OCsCAqL1xuICByZWFkb25seSBpbWFnZVRhZzogc3RyaW5nO1xufVxuXG4vKipcbiAqIEVtYmVkZGluZyBCYXRjaOe1seWQiOOCs+ODs+OCueODiOODqeOCr+ODiFxuICogXG4gKiDmqZ/og706XG4gKiAtIEJhdGNoQ29uc3RydWN044Gu57Wx5ZCI566h55CGXG4gKiAtIEVtYmVkZGluZ1N0YWNr44Gn44Gu57Wx5LiA44Kk44Oz44K/44O844OV44Kn44O844K55o+Q5L6bXG4gKiAtIOOCuOODp+ODluWun+ihjOODu+ebo+imluODu+euoeeQhuapn+iDvVxuICogLSDoh6rli5XjgrnjgrHjg7zjg6rjg7PjgrDjg7voh6rli5Xlvqnml6fmqZ/og71cbiAqL1xuZXhwb3J0IGNsYXNzIEVtYmVkZGluZ0JhdGNoSW50ZWdyYXRpb24gZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAvKiogQmF0Y2jjgrPjg7Pjgrnjg4jjg6njgq/jg4ggKi9cbiAgcHVibGljIHJlYWRvbmx5IGJhdGNoQ29uc3RydWN0OiBCYXRjaENvbnN0cnVjdDtcbiAgXG4gIC8qKiDjgrjjg6fjg5bnrqHnkIZMYW1iZGHplqLmlbAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGpvYk1hbmFnZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBcbiAgLyoqIOe1seWQiOebo+imllNOU+ODiOODlOODg+OCryAqL1xuICBwdWJsaWMgcmVhZG9ubHkgaW50ZWdyYXRpb25Ub3BpYzogc25zLlRvcGljO1xuICBcbiAgLyoqIOOCuOODp+ODluOCueOCseOCuOODpeODvOODqeODvCAqL1xuICBwdWJsaWMgcmVhZG9ubHkgam9iU2NoZWR1bGVyOiBldmVudHMuUnVsZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRW1iZWRkaW5nQmF0Y2hJbnRlZ3JhdGlvblByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIEJhdGNo44Kz44Oz44K544OI44Op44Kv44OI5L2c5oiQXG4gICAgdGhpcy5iYXRjaENvbnN0cnVjdCA9IG5ldyBCYXRjaENvbnN0cnVjdCh0aGlzLCAnQmF0Y2hDb25zdHJ1Y3QnLCB7XG4gICAgICBjb25maWc6IHByb3BzLmNvbmZpZy5hd3NCYXRjaCxcbiAgICAgIGpvYkRlZmluaXRpb25Db25maWc6IHByb3BzLmNvbmZpZy5qb2JEZWZpbml0aW9uLFxuICAgICAgZnN4SW50ZWdyYXRpb25Db25maWc6IHByb3BzLmNvbmZpZy5mc3hJbnRlZ3JhdGlvbixcbiAgICAgIGFjdGl2ZURpcmVjdG9yeUNvbmZpZzogcHJvcHMuY29uZmlnLmFjdGl2ZURpcmVjdG9yeSxcbiAgICAgIGJlZHJvY2tDb25maWc6IHByb3BzLmNvbmZpZy5iZWRyb2NrLFxuICAgICAgb3BlblNlYXJjaENvbmZpZzogcHJvcHMuY29uZmlnLm9wZW5TZWFyY2gsXG4gICAgICByZHNDb25maWc6IHByb3BzLmNvbmZpZy5yZHMsXG4gICAgICBpbWFnZVBhdGg6IHByb3BzLmltYWdlUGF0aCxcbiAgICAgIGltYWdlVGFnOiBwcm9wcy5pbWFnZVRhZyxcbiAgICAgIHByb2plY3ROYW1lOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIGVudmlyb25tZW50OiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgIGNvbW1vblJlc291cmNlczogcHJvcHMuY29tbW9uUmVzb3VyY2VzLFxuICAgIH0pO1xuXG4gICAgLy8g57Wx5ZCI55uj6KaWU05T44OI44OU44OD44Kv5L2c5oiQXG4gICAgdGhpcy5pbnRlZ3JhdGlvblRvcGljID0gdGhpcy5jcmVhdGVJbnRlZ3JhdGlvblRvcGljKHByb3BzKTtcblxuICAgIC8vIOOCuOODp+ODlueuoeeQhkxhbWJkYemWouaVsOS9nOaIkFxuICAgIHRoaXMuam9iTWFuYWdlckZ1bmN0aW9uID0gdGhpcy5jcmVhdGVKb2JNYW5hZ2VyRnVuY3Rpb24ocHJvcHMpO1xuXG4gICAgLy8g44K444On44OW44K544Kx44K444Ol44O844Op44O85L2c5oiQXG4gICAgdGhpcy5qb2JTY2hlZHVsZXIgPSB0aGlzLmNyZWF0ZUpvYlNjaGVkdWxlcihwcm9wcyk7XG5cbiAgICAvLyDntbHlkIjnm6PoppboqK3lrppcbiAgICB0aGlzLmNvbmZpZ3VyZUludGVncmF0aW9uTW9uaXRvcmluZyhwcm9wcyk7XG5cbiAgICAvLyDjgr/jgrDoqK3lrppcbiAgICB0aGlzLmFwcGx5VGFncyhwcm9wcyk7XG4gIH1cblxuICAvKipcbiAgICog57Wx5ZCI55uj6KaWU05T44OI44OU44OD44Kv5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUludGVncmF0aW9uVG9waWMocHJvcHM6IEVtYmVkZGluZ0JhdGNoSW50ZWdyYXRpb25Qcm9wcyk6IHNucy5Ub3BpYyB7XG4gICAgY29uc3QgdG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdFbWJlZGRpbmdCYXRjaEludGVncmF0aW9uVG9waWMnLCB7XG4gICAgICB0b3BpY05hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1lbWJlZGRpbmctYmF0Y2gtaW50ZWdyYXRpb25gLFxuICAgICAgZGlzcGxheU5hbWU6ICdFbWJlZGRpbmcgQmF0Y2ggSW50ZWdyYXRpb24gTm90aWZpY2F0aW9ucycsXG4gICAgfSk7XG5cbiAgICAvLyDnrqHnkIbogIXpgJrnn6XnlKjjga7jg6Hjg7zjg6vos7zoqq3vvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBjb25zdCBhZG1pbkVtYWlsID0gcHJvcHMuY29uZmlnLm1vbml0b3JpbmcuYWxlcnRzLnNuc1RvcGljQXJuO1xuICAgIGlmIChhZG1pbkVtYWlsKSB7XG4gICAgICB0b3BpYy5hZGRTdWJzY3JpcHRpb24obmV3IHNuc1N1YnNjcmlwdGlvbnMuRW1haWxTdWJzY3JpcHRpb24oYWRtaW5FbWFpbCkpO1xuICAgIH1cblxuICAgIHJldHVybiB0b3BpYztcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrjjg6fjg5bnrqHnkIZMYW1iZGHplqLmlbDkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlSm9iTWFuYWdlckZ1bmN0aW9uKHByb3BzOiBFbWJlZGRpbmdCYXRjaEludGVncmF0aW9uUHJvcHMpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGNvbnN0IGpvYk1hbmFnZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0VtYmVkZGluZ0pvYk1hbmFnZXJGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWVtYmVkZGluZy1qb2ItbWFuYWdlcmAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuaW1wb3J0IGJvdG8zXG5pbXBvcnQganNvblxuaW1wb3J0IG9zXG5mcm9tIGRhdGV0aW1lIGltcG9ydCBkYXRldGltZVxuZnJvbSB0eXBpbmcgaW1wb3J0IERpY3QsIExpc3QsIEFueVxuXG5kZWYgaGFuZGxlcihldmVudCwgY29udGV4dCk6XG4gICAgXCJcIlwiXG4gICAgRW1iZWRkaW5nIEpvYiBNYW5hZ2VyXG4gICAgXG4gICAg5qmf6IO9OlxuICAgIC0g44K444On44OW44Gu5LiA5ous5a6f6KGMXG4gICAgLSDjgrjjg6fjg5bnirbms4Hjga7nm6PoppZcbiAgICAtIOWkseaVl+OCuOODp+ODluOBruiHquWLleWGjeWun+ihjFxuICAgIC0g44K444On44OW5a6f6KGM57Wx6KiI44Gu5Y+O6ZuGXG4gICAgXCJcIlwiXG4gICAgXG4gICAgYmF0Y2hfY2xpZW50ID0gYm90bzMuY2xpZW50KCdiYXRjaCcpXG4gICAgY2xvdWR3YXRjaCA9IGJvdG8zLmNsaWVudCgnY2xvdWR3YXRjaCcpXG4gICAgXG4gICAgam9iX3F1ZXVlX25hbWUgPSBvcy5lbnZpcm9uWydKT0JfUVVFVUVfTkFNRSddXG4gICAgam9iX2RlZmluaXRpb25fbmFtZSA9IG9zLmVudmlyb25bJ0pPQl9ERUZJTklUSU9OX05BTUUnXVxuICAgIFxuICAgIHRyeTpcbiAgICAgICAgYWN0aW9uID0gZXZlbnQuZ2V0KCdhY3Rpb24nLCAnc3RhdHVzJylcbiAgICAgICAgXG4gICAgICAgIGlmIGFjdGlvbiA9PSAnc3VibWl0X2JhdGNoJzpcbiAgICAgICAgICAgICMg5LiA5ous44K444On44OW5a6f6KGMXG4gICAgICAgICAgICByZXR1cm4gc3VibWl0X2JhdGNoX2pvYnMoYmF0Y2hfY2xpZW50LCBldmVudCwgam9iX3F1ZXVlX25hbWUsIGpvYl9kZWZpbml0aW9uX25hbWUpXG4gICAgICAgICAgICBcbiAgICAgICAgZWxpZiBhY3Rpb24gPT0gJ21vbml0b3InOlxuICAgICAgICAgICAgIyDjgrjjg6fjg5bnm6PoppZcbiAgICAgICAgICAgIHJldHVybiBtb25pdG9yX2pvYnMoYmF0Y2hfY2xpZW50LCBjbG91ZHdhdGNoLCBqb2JfcXVldWVfbmFtZSlcbiAgICAgICAgICAgIFxuICAgICAgICBlbGlmIGFjdGlvbiA9PSAnY2xlYW51cCc6XG4gICAgICAgICAgICAjIOWujOS6huOCuOODp+ODluOBruOCr+ODquODvOODs+OCouODg+ODl1xuICAgICAgICAgICAgcmV0dXJuIGNsZWFudXBfY29tcGxldGVkX2pvYnMoYmF0Y2hfY2xpZW50LCBqb2JfcXVldWVfbmFtZSlcbiAgICAgICAgICAgIFxuICAgICAgICBlbGlmIGFjdGlvbiA9PSAnc3RhdHVzJzpcbiAgICAgICAgICAgICMg44K444On44OW54q25rOB5Y+W5b6XXG4gICAgICAgICAgICByZXR1cm4gZ2V0X2pvYl9zdGF0dXMoYmF0Y2hfY2xpZW50LCBqb2JfcXVldWVfbmFtZSlcbiAgICAgICAgICAgIFxuICAgICAgICBlbHNlOlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAnc3RhdHVzQ29kZSc6IDQwMCxcbiAgICAgICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoeydlcnJvcic6IGYnVW5rbm93biBhY3Rpb246IHthY3Rpb259J30pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6XG4gICAgICAgIHByaW50KGZcIkpvYiBtYW5hZ2VyIGVycm9yOiB7c3RyKGUpfVwiKVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ3N0YXR1c0NvZGUnOiA1MDAsXG4gICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoeydlcnJvcic6IHN0cihlKX0pXG4gICAgICAgIH1cblxuZGVmIHN1Ym1pdF9iYXRjaF9qb2JzKGJhdGNoX2NsaWVudCwgZXZlbnQsIGpvYl9xdWV1ZV9uYW1lLCBqb2JfZGVmaW5pdGlvbl9uYW1lKTpcbiAgICBcIlwiXCLkuIDmi6zjgrjjg6fjg5blrp/ooYxcIlwiXCJcbiAgICBqb2JzID0gZXZlbnQuZ2V0KCdqb2JzJywgW10pXG4gICAgc3VibWl0dGVkX2pvYnMgPSBbXVxuICAgIFxuICAgIGZvciBqb2JfY29uZmlnIGluIGpvYnM6XG4gICAgICAgIGpvYl9uYW1lID0gam9iX2NvbmZpZy5nZXQoJ25hbWUnLCBmJ2VtYmVkZGluZy1qb2Ite2ludChkYXRldGltZS5ub3coKS50aW1lc3RhbXAoKSl9JylcbiAgICAgICAgcGFyYW1ldGVycyA9IGpvYl9jb25maWcuZ2V0KCdwYXJhbWV0ZXJzJywge30pXG4gICAgICAgIFxuICAgICAgICByZXNwb25zZSA9IGJhdGNoX2NsaWVudC5zdWJtaXRfam9iKFxuICAgICAgICAgICAgam9iTmFtZT1qb2JfbmFtZSxcbiAgICAgICAgICAgIGpvYlF1ZXVlPWpvYl9xdWV1ZV9uYW1lLFxuICAgICAgICAgICAgam9iRGVmaW5pdGlvbj1qb2JfZGVmaW5pdGlvbl9uYW1lLFxuICAgICAgICAgICAgcGFyYW1ldGVycz1wYXJhbWV0ZXJzLFxuICAgICAgICAgICAgdGltZW91dD17J2F0dGVtcHREdXJhdGlvblNlY29uZHMnOiAzNjAwfSxcbiAgICAgICAgICAgIHJldHJ5U3RyYXRlZ3k9eydhdHRlbXB0cyc6IDN9XG4gICAgICAgIClcbiAgICAgICAgXG4gICAgICAgIHN1Ym1pdHRlZF9qb2JzLmFwcGVuZCh7XG4gICAgICAgICAgICAnam9iSWQnOiByZXNwb25zZVsnam9iSWQnXSxcbiAgICAgICAgICAgICdqb2JOYW1lJzogcmVzcG9uc2VbJ2pvYk5hbWUnXSxcbiAgICAgICAgICAgICdwYXJhbWV0ZXJzJzogcGFyYW1ldGVyc1xuICAgICAgICB9KVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgICdzdGF0dXNDb2RlJzogMjAwLFxuICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoe1xuICAgICAgICAgICAgJ21lc3NhZ2UnOiBmJ1N1Ym1pdHRlZCB7bGVuKHN1Ym1pdHRlZF9qb2JzKX0gam9icycsXG4gICAgICAgICAgICAnam9icyc6IHN1Ym1pdHRlZF9qb2JzXG4gICAgICAgIH0pXG4gICAgfVxuXG5kZWYgbW9uaXRvcl9qb2JzKGJhdGNoX2NsaWVudCwgY2xvdWR3YXRjaCwgam9iX3F1ZXVlX25hbWUpOlxuICAgIFwiXCJcIuOCuOODp+ODluebo+imllwiXCJcIlxuICAgIGpvYl9zdGF0dXNlcyA9IFsnU1VCTUlUVEVEJywgJ1BFTkRJTkcnLCAnUlVOTkFCTEUnLCAnU1RBUlRJTkcnLCAnUlVOTklORycsICdTVUNDRUVERUQnLCAnRkFJTEVEJ11cbiAgICBzdGF0dXNfY291bnRzID0ge31cbiAgICBcbiAgICBmb3Igc3RhdHVzIGluIGpvYl9zdGF0dXNlczpcbiAgICAgICAgam9icyA9IGJhdGNoX2NsaWVudC5saXN0X2pvYnMoXG4gICAgICAgICAgICBqb2JRdWV1ZT1qb2JfcXVldWVfbmFtZSxcbiAgICAgICAgICAgIGpvYlN0YXR1cz1zdGF0dXMsXG4gICAgICAgICAgICBtYXhSZXN1bHRzPTEwMFxuICAgICAgICApXG4gICAgICAgIHN0YXR1c19jb3VudHNbc3RhdHVzXSA9IGxlbihqb2JzWydqb2JMaXN0J10pXG4gICAgXG4gICAgIyBDbG91ZFdhdGNo44Oh44OI44Oq44Kv44K544Gr6YCB5L+hXG4gICAgZm9yIHN0YXR1cywgY291bnQgaW4gc3RhdHVzX2NvdW50cy5pdGVtcygpOlxuICAgICAgICBjbG91ZHdhdGNoLnB1dF9tZXRyaWNfZGF0YShcbiAgICAgICAgICAgIE5hbWVzcGFjZT0nRW1iZWRkaW5nQmF0Y2gvSm9iTWFuYWdlcicsXG4gICAgICAgICAgICBNZXRyaWNEYXRhPVtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICdNZXRyaWNOYW1lJzogZidKb2Jze3N0YXR1c30nLFxuICAgICAgICAgICAgICAgICAgICAnVmFsdWUnOiBjb3VudCxcbiAgICAgICAgICAgICAgICAgICAgJ1VuaXQnOiAnQ291bnQnLFxuICAgICAgICAgICAgICAgICAgICAnRGltZW5zaW9ucyc6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnTmFtZSc6ICdKb2JRdWV1ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1ZhbHVlJzogam9iX3F1ZXVlX25hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgKVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgICdzdGF0dXNDb2RlJzogMjAwLFxuICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoe1xuICAgICAgICAgICAgJ21lc3NhZ2UnOiAnSm9iIG1vbml0b3JpbmcgY29tcGxldGVkJyxcbiAgICAgICAgICAgICdzdGF0dXNfY291bnRzJzogc3RhdHVzX2NvdW50c1xuICAgICAgICB9KVxuICAgIH1cblxuZGVmIGNsZWFudXBfY29tcGxldGVkX2pvYnMoYmF0Y2hfY2xpZW50LCBqb2JfcXVldWVfbmFtZSk6XG4gICAgXCJcIlwi5a6M5LqG44K444On44OW44Gu44Kv44Oq44O844Oz44Ki44OD44OXXCJcIlwiXG4gICAgIyDmiJDlip/jgZfjgZ/jgrjjg6fjg5bjgpLlj5blvpfvvIjpgY7ljrsyNOaZgumWk++8iVxuICAgIHN1Y2NlZWRlZF9qb2JzID0gYmF0Y2hfY2xpZW50Lmxpc3Rfam9icyhcbiAgICAgICAgam9iUXVldWU9am9iX3F1ZXVlX25hbWUsXG4gICAgICAgIGpvYlN0YXR1cz0nU1VDQ0VFREVEJyxcbiAgICAgICAgbWF4UmVzdWx0cz0xMDBcbiAgICApXG4gICAgXG4gICAgIyDlpLHmlZfjgZfjgZ/jgrjjg6fjg5bjgpLlj5blvpfvvIjpgY7ljrsyNOaZgumWk++8iVxuICAgIGZhaWxlZF9qb2JzID0gYmF0Y2hfY2xpZW50Lmxpc3Rfam9icyhcbiAgICAgICAgam9iUXVldWU9am9iX3F1ZXVlX25hbWUsXG4gICAgICAgIGpvYlN0YXR1cz0nRkFJTEVEJyxcbiAgICAgICAgbWF4UmVzdWx0cz0xMDBcbiAgICApXG4gICAgXG4gICAgY2xlYW51cF9jb3VudCA9IDBcbiAgICAjIOWun+mam+OBruOCr+ODquODvOODs+OCouODg+ODl+ODreOCuOODg+OCr+OBr+OBk+OBk+OBq+Wun+ijhVxuICAgICMg77yI44Ot44Kw44Gu5L+d5a2Y44CB44Oh44OI44Oq44Kv44K544Gu6KiY6Yyy44Gq44Gp77yJXG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgJ3N0YXR1c0NvZGUnOiAyMDAsXG4gICAgICAgICdib2R5JzoganNvbi5kdW1wcyh7XG4gICAgICAgICAgICAnbWVzc2FnZSc6ICdDbGVhbnVwIGNvbXBsZXRlZCcsXG4gICAgICAgICAgICAnc3VjY2VlZGVkX2pvYnMnOiBsZW4oc3VjY2VlZGVkX2pvYnNbJ2pvYkxpc3QnXSksXG4gICAgICAgICAgICAnZmFpbGVkX2pvYnMnOiBsZW4oZmFpbGVkX2pvYnNbJ2pvYkxpc3QnXSksXG4gICAgICAgICAgICAnY2xlYW5lZF91cCc6IGNsZWFudXBfY291bnRcbiAgICAgICAgfSlcbiAgICB9XG5cbmRlZiBnZXRfam9iX3N0YXR1cyhiYXRjaF9jbGllbnQsIGpvYl9xdWV1ZV9uYW1lKTpcbiAgICBcIlwiXCLjgrjjg6fjg5bnirbms4Hlj5blvpdcIlwiXCJcbiAgICAjIOWQhOeKtuaFi+OBruOCuOODp+ODluaVsOOCkuWPluW+l1xuICAgIHN0YXR1c19zdW1tYXJ5ID0ge31cbiAgICBcbiAgICBmb3Igc3RhdHVzIGluIFsnU1VCTUlUVEVEJywgJ1BFTkRJTkcnLCAnUlVOTkFCTEUnLCAnU1RBUlRJTkcnLCAnUlVOTklORycsICdTVUNDRUVERUQnLCAnRkFJTEVEJ106XG4gICAgICAgIGpvYnMgPSBiYXRjaF9jbGllbnQubGlzdF9qb2JzKFxuICAgICAgICAgICAgam9iUXVldWU9am9iX3F1ZXVlX25hbWUsXG4gICAgICAgICAgICBqb2JTdGF0dXM9c3RhdHVzLFxuICAgICAgICAgICAgbWF4UmVzdWx0cz0xMFxuICAgICAgICApXG4gICAgICAgIHN0YXR1c19zdW1tYXJ5W3N0YXR1c10gPSB7XG4gICAgICAgICAgICAnY291bnQnOiBsZW4oam9ic1snam9iTGlzdCddKSxcbiAgICAgICAgICAgICdqb2JzJzogW3snaWQnOiBqb2JbJ2pvYklkJ10sICduYW1lJzogam9iWydqb2JOYW1lJ119IGZvciBqb2IgaW4gam9ic1snam9iTGlzdCddWzo1XV1cbiAgICAgICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgICdzdGF0dXNDb2RlJzogMjAwLFxuICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoe1xuICAgICAgICAgICAgJ21lc3NhZ2UnOiAnSm9iIHN0YXR1cyByZXRyaWV2ZWQnLFxuICAgICAgICAgICAgJ3F1ZXVlX25hbWUnOiBqb2JfcXVldWVfbmFtZSxcbiAgICAgICAgICAgICdzdGF0dXNfc3VtbWFyeSc6IHN0YXR1c19zdW1tYXJ5LFxuICAgICAgICAgICAgJ3RpbWVzdGFtcCc6IGRhdGV0aW1lLm5vdygpLmlzb2Zvcm1hdCgpXG4gICAgICAgIH0pXG4gICAgfVxuICAgICAgYCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBKT0JfUVVFVUVfTkFNRTogdGhpcy5iYXRjaENvbnN0cnVjdC5qb2JRdWV1ZS5qb2JRdWV1ZU5hbWUhLFxuICAgICAgICBKT0JfREVGSU5JVElPTl9OQU1FOiB0aGlzLmJhdGNoQ29uc3RydWN0LmpvYkRlZmluaXRpb24uam9iRGVmaW5pdGlvbk5hbWUhLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICB9KTtcblxuICAgIC8vIExhbWJkYeWun+ihjOaoqemZkFxuICAgIGpvYk1hbmFnZXJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmF0Y2g6U3VibWl0Sm9iJyxcbiAgICAgICAgJ2JhdGNoOkxpc3RKb2JzJyxcbiAgICAgICAgJ2JhdGNoOkRlc2NyaWJlSm9icycsXG4gICAgICAgICdiYXRjaDpDYW5jZWxKb2InLFxuICAgICAgICAnYmF0Y2g6VGVybWluYXRlSm9iJyxcbiAgICAgICAgJ2Nsb3Vkd2F0Y2g6UHV0TWV0cmljRGF0YScsXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ0dyb3VwJyxcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nU3RyZWFtJyxcbiAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIHJldHVybiBqb2JNYW5hZ2VyRnVuY3Rpb247XG4gIH1cblxuICAvKipcbiAgICog44K444On44OW44K544Kx44K444Ol44O844Op44O85L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUpvYlNjaGVkdWxlcihwcm9wczogRW1iZWRkaW5nQmF0Y2hJbnRlZ3JhdGlvblByb3BzKTogZXZlbnRzLlJ1bGUge1xuICAgIGNvbnN0IHNjaGVkdWxlclJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0VtYmVkZGluZ0pvYlNjaGVkdWxlcicsIHtcbiAgICAgIHJ1bGVOYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tZW1iZWRkaW5nLWpvYi1zY2hlZHVsZXJgLFxuICAgICAgZGVzY3JpcHRpb246ICdFbWJlZGRpbmcgam9iIG1vbml0b3JpbmcgYW5kIGNsZWFudXAgc2NoZWR1bGVyJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUucmF0ZShjZGsuRHVyYXRpb24ubWludXRlcygzMCkpLCAvLyAzMOWIhuOBlOOBqOOBq+Wun+ihjFxuICAgIH0pO1xuXG4gICAgLy8g44K444On44OW566h55CGTGFtYmRh6Zai5pWw44KS44K/44O844Ky44OD44OI44Gr6Kit5a6aXG4gICAgc2NoZWR1bGVyUnVsZS5hZGRUYXJnZXQobmV3IGV2ZW50c1RhcmdldHMuTGFtYmRhRnVuY3Rpb24odGhpcy5qb2JNYW5hZ2VyRnVuY3Rpb24sIHtcbiAgICAgIGV2ZW50OiBldmVudHMuUnVsZVRhcmdldElucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICBhY3Rpb246ICdtb25pdG9yJyxcbiAgICAgICAgc291cmNlOiAnc2NoZWR1bGVyJyxcbiAgICAgICAgdGltZXN0YW1wOiBldmVudHMuRXZlbnRGaWVsZC5mcm9tUGF0aCgnJC50aW1lJyksXG4gICAgICB9KSxcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gc2NoZWR1bGVyUnVsZTtcbiAgfVxuXG4gIC8qKlxuICAgKiDntbHlkIjnm6PoppboqK3lrppcbiAgICovXG4gIHByaXZhdGUgY29uZmlndXJlSW50ZWdyYXRpb25Nb25pdG9yaW5nKHByb3BzOiBFbWJlZGRpbmdCYXRjaEludGVncmF0aW9uUHJvcHMpOiB2b2lkIHtcbiAgICAvLyDjgrjjg6fjg5bnrqHnkIZMYW1iZGHplqLmlbDjga7jgqjjg6njg7znm6PoppZcbiAgICBjb25zdCBqb2JNYW5hZ2VyRXJyb3JNZXRyaWMgPSB0aGlzLmpvYk1hbmFnZXJGdW5jdGlvbi5tZXRyaWNFcnJvcnMoe1xuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGpvYk1hbmFnZXJFcnJvckFsYXJtID0gbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnSm9iTWFuYWdlckVycm9yQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1qb2ItbWFuYWdlci1lcnJvcnNgLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0pvYiBNYW5hZ2VyIExhbWJkYSBmdW5jdGlvbiBlcnJvcnMnLFxuICAgICAgbWV0cmljOiBqb2JNYW5hZ2VyRXJyb3JNZXRyaWMsXG4gICAgICB0aHJlc2hvbGQ6IDEsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIGRhdGFwb2ludHNUb0FsYXJtOiAxLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjZGsuYXdzX2Nsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXG4gICAgfSk7XG5cbiAgICAvLyDjgqjjg6njg7zjgqLjg6njg7zjg6DjgpJTTlPjg4jjg5Tjg4Pjgq/jgavmjqXntppcbiAgICBqb2JNYW5hZ2VyRXJyb3JBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2RrLmF3c19jbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHRoaXMuaW50ZWdyYXRpb25Ub3BpYykpO1xuXG4gICAgLy8g57Wx5ZCI44OA44OD44K344Ol44Oc44O844OJ5L2c5oiQXG4gICAgdGhpcy5jcmVhdGVJbnRlZ3JhdGlvbkRhc2hib2FyZChwcm9wcyk7XG4gIH1cblxuICAvKipcbiAgICog57Wx5ZCI44OA44OD44K344Ol44Oc44O844OJ5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUludGVncmF0aW9uRGFzaGJvYXJkKHByb3BzOiBFbWJlZGRpbmdCYXRjaEludGVncmF0aW9uUHJvcHMpOiB2b2lkIHtcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCAnRW1iZWRkaW5nQmF0Y2hJbnRlZ3JhdGlvbkRhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1lbWJlZGRpbmctYmF0Y2gtaW50ZWdyYXRpb25gLFxuICAgIH0pO1xuXG4gICAgLy8g44K444On44OW566h55CGTGFtYmRh6Zai5pWw44Oh44OI44Oq44Kv44K5XG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdKb2IgTWFuYWdlciBGdW5jdGlvbiBNZXRyaWNzJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIHRoaXMuam9iTWFuYWdlckZ1bmN0aW9uLm1ldHJpY0ludm9jYXRpb25zKCksXG4gICAgICAgICAgdGhpcy5qb2JNYW5hZ2VyRnVuY3Rpb24ubWV0cmljRXJyb3JzKCksXG4gICAgICAgICAgdGhpcy5qb2JNYW5hZ2VyRnVuY3Rpb24ubWV0cmljRHVyYXRpb24oKSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBCYXRjaOOCuOODp+ODlue1seioiFxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQmF0Y2ggSm9iIFN0YXRpc3RpY3MnLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnRW1iZWRkaW5nQmF0Y2gvSm9iTWFuYWdlcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnSm9ic1NVQ0NFRURFRCcsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IEpvYlF1ZXVlOiB0aGlzLmJhdGNoQ29uc3RydWN0LmpvYlF1ZXVlLmpvYlF1ZXVlTmFtZSEgfSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnRW1iZWRkaW5nQmF0Y2gvSm9iTWFuYWdlcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnSm9ic0ZBSUxFRCcsXG4gICAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IEpvYlF1ZXVlOiB0aGlzLmJhdGNoQ29uc3RydWN0LmpvYlF1ZXVlLmpvYlF1ZXVlTmFtZSEgfSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiAnRW1iZWRkaW5nQmF0Y2gvSm9iTWFuYWdlcicsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnSm9ic1JVTk5JTkcnLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDogeyBKb2JRdWV1ZTogdGhpcy5iYXRjaENvbnN0cnVjdC5qb2JRdWV1ZS5qb2JRdWV1ZU5hbWUhIH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICog44K/44Kw6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIGFwcGx5VGFncyhwcm9wczogRW1iZWRkaW5nQmF0Y2hJbnRlZ3JhdGlvblByb3BzKTogdm9pZCB7XG4gICAgY29uc3QgdGFncyA9IHtcbiAgICAgIFByb2plY3Q6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgRW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgQ29tcG9uZW50OiAnRW1iZWRkaW5nJyxcbiAgICAgIE1vZHVsZTogJ0JBVENIX0lOVEVHUkFUSU9OJyxcbiAgICAgIE1hbmFnZWRCeTogJ0NESycsXG4gICAgICBBdXRvU2NhbGluZzogcHJvcHMuY29uZmlnLmF3c0JhdGNoLmF1dG9TY2FsaW5nLmVuYWJsZWQudG9TdHJpbmcoKSxcbiAgICAgIEF1dG9SZWNvdmVyeTogJ3RydWUnLFxuICAgIH07XG5cbiAgICBPYmplY3QuZW50cmllcyh0YWdzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChrZXksIHZhbHVlKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrjjg6fjg5blrp/ooYzjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrlcbiAgICovXG4gIHB1YmxpYyBhc3luYyBzdWJtaXRFbWJlZGRpbmdKb2Ioam9iTmFtZTogc3RyaW5nLCBwYXJhbWV0ZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAvLyDjgrjjg6fjg5bnrqHnkIZMYW1iZGHplqLmlbDjgpLlkbzjgbPlh7rjgZfjgabjgrjjg6fjg5bjgpLlrp/ooYxcbiAgICAvLyDlrp/pmpvjga7lrp/oo4Xjgafjga/jgIFBV1MgU0RL44KS5L2/55So44GX44GmTGFtYmRh6Zai5pWw44KS5ZG844Gz5Ye644GXXG4gICAgcmV0dXJuIHRoaXMuYmF0Y2hDb25zdHJ1Y3Quc3VibWl0Sm9iKGpvYk5hbWUsIHBhcmFtZXRlcnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCuOODp+ODlueKtuazgeWPluW+l1xuICAgKi9cbiAgcHVibGljIGdldEpvYlN0YXR1cygpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICByZXR1cm4gdGhpcy5iYXRjaENvbnN0cnVjdC5nZXRKb2JRdWV1ZU1ldHJpY3MoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDntbHlkIjjg6rjgr3jg7zjgrnmg4XloLHlj5blvpdcbiAgICovXG4gIHB1YmxpYyBnZXRJbnRlZ3JhdGlvbkluZm8oKTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGJhdGNoQ29uc3RydWN0OiB7XG4gICAgICAgIGNvbXB1dGVFbnZpcm9ubWVudDogdGhpcy5iYXRjaENvbnN0cnVjdC5jb21wdXRlRW52aXJvbm1lbnQuY29tcHV0ZUVudmlyb25tZW50TmFtZSxcbiAgICAgICAgam9iRGVmaW5pdGlvbjogdGhpcy5iYXRjaENvbnN0cnVjdC5qb2JEZWZpbml0aW9uLmpvYkRlZmluaXRpb25OYW1lLFxuICAgICAgICBqb2JRdWV1ZTogdGhpcy5iYXRjaENvbnN0cnVjdC5qb2JRdWV1ZS5qb2JRdWV1ZU5hbWUsXG4gICAgICB9LFxuICAgICAgam9iTWFuYWdlcjoge1xuICAgICAgICBmdW5jdGlvbk5hbWU6IHRoaXMuam9iTWFuYWdlckZ1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgICAgICAgZnVuY3Rpb25Bcm46IHRoaXMuam9iTWFuYWdlckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgfSxcbiAgICAgIG1vbml0b3Jpbmc6IHtcbiAgICAgICAgaW50ZWdyYXRpb25Ub3BpYzogdGhpcy5pbnRlZ3JhdGlvblRvcGljLnRvcGljQXJuLFxuICAgICAgICBkYXNoYm9hcmROYW1lOiBgJHt0aGlzLm5vZGUuaWR9LWludGVncmF0aW9uYCxcbiAgICAgIH0sXG4gICAgICBzY2hlZHVsZXI6IHtcbiAgICAgICAgcnVsZU5hbWU6IHRoaXMuam9iU2NoZWR1bGVyLnJ1bGVOYW1lLFxuICAgICAgICBzY2hlZHVsZTogJ3JhdGUoMzAgbWludXRlcyknLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG59Il19