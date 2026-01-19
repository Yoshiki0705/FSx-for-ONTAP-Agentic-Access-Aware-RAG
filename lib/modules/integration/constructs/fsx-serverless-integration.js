"use strict";
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
exports.FsxServerlessIntegrationConstruct = void 0;
const constructs_1 = require("constructs");
const fsx = __importStar(require("aws-cdk-lib/aws-fsx"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const lambdaEventSources = __importStar(require("aws-cdk-lib/aws-lambda-event-sources"));
const stepfunctions = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const sfnTasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const snsSubscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const aws_cdk_lib_1 = require("aws-cdk-lib");
/**
 * FSx-Serverless統合コンストラクト
 */
class FsxServerlessIntegrationConstruct extends constructs_1.Construct {
    /**
     * FSx for ONTAPファイルシステム
     */
    fileSystems = [];
    /**
     * Lambda関数
     */
    lambdaFunctions = [];
    /**
     * Step Functions ステートマシン
     */
    stateMachines = [];
    /**
     * SQSキュー
     */
    queues = [];
    /**
     * SNSトピック
     */
    topics = [];
    /**
     * EventBridgeルール
     */
    eventRules = [];
    constructor(scope, id, props) {
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
    createFsxResources(props) {
        props.fsx.fileSystems.forEach((fsConfig, index) => {
            if (!fsConfig.enabled)
                return;
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
                if (!svmConfig.enabled)
                    return;
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
                    if (!volumeConfig.enabled)
                        return;
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
    createServerlessResources(props) {
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
    createSnsTopics(props) {
        props.serverless.sns.topics.forEach((topicConfig, index) => {
            if (!topicConfig.enabled)
                return;
            const topic = new sns.Topic(this, `Topic${index}`, {
                topicName: `${props.projectName}-${props.environment}-${topicConfig.name}`,
                displayName: `${props.projectName} ${props.environment} ${topicConfig.name}`,
            });
            // サブスクリプションの追加
            topicConfig.subscriptions.forEach((subConfig, subIndex) => {
                if (!subConfig.enabled)
                    return;
                if (subConfig.protocol === 'email') {
                    topic.addSubscription(new snsSubscriptions.EmailSubscription(subConfig.endpoint));
                }
                else if (subConfig.protocol === 'sms') {
                    topic.addSubscription(new snsSubscriptions.SmsSubscription(subConfig.endpoint));
                }
            });
            this.topics.push(topic);
        });
    }
    /**
     * SQSキューの作成
     */
    createSqsQueues(props) {
        props.serverless.sqs.queues.forEach((queueConfig, index) => {
            if (!queueConfig.enabled)
                return;
            const queue = new sqs.Queue(this, `Queue${index}`, {
                queueName: `${props.projectName}-${props.environment}-${queueConfig.name}`,
                visibilityTimeout: aws_cdk_lib_1.Duration.seconds(queueConfig.configuration.visibilityTimeoutSeconds),
                retentionPeriod: aws_cdk_lib_1.Duration.seconds(queueConfig.configuration.messageRetentionPeriod),
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
    createLambdaFunctions(props) {
        props.serverless.lambda.functions.forEach((funcConfig, index) => {
            if (!funcConfig.enabled)
                return;
            // IAMロールの作成
            const role = new iam.Role(this, `LambdaRole${index}`, {
                assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
                managedPolicies: [
                    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                ],
            });
            // VPC設定の場合はVPC実行ポリシーを追加
            if (funcConfig.vpc.enabled) {
                role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'));
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
                timeout: aws_cdk_lib_1.Duration.seconds(funcConfig.timeout),
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
    createStepFunctions(props) {
        props.serverless.stepFunctions.workflows.forEach((workflowConfig, index) => {
            if (!workflowConfig.enabled)
                return;
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
                timeout: aws_cdk_lib_1.Duration.seconds(props.serverless.stepFunctions.execution.timeout),
                logs: {
                    destination: new logs.LogGroup(this, `StepFunctionsLogGroup${index}`, {
                        logGroupName: `/aws/stepfunctions/${props.projectName}-${props.environment}-${workflowConfig.name}`,
                        retention: this.getLogRetention(props.serverless.monitoring.cloudWatch.logRetentionDays),
                        removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
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
    createWorkflowDefinition(props, index) {
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
    createEventBridgeRules(props) {
        props.serverless.eventBridge.rules.forEach((ruleConfig, index) => {
            if (!ruleConfig.enabled)
                return;
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
    setupIntegration(props) {
        // Lambda関数とSQSキューの統合
        this.lambdaFunctions.forEach((func, funcIndex) => {
            this.queues.forEach((queue, queueIndex) => {
                // SQSイベントソースの追加
                func.addEventSource(new lambdaEventSources.SqsEventSource(queue, {
                    batchSize: 10,
                    maxBatchingWindow: aws_cdk_lib_1.Duration.seconds(5),
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
    setupMonitoring(props) {
        if (!props.serverless.monitoring.cloudWatch.enabled)
            return;
        // CloudWatchアラームの作成
        this.lambdaFunctions.forEach((func, index) => {
            // エラー率アラーム
            new cloudwatch.Alarm(this, `LambdaErrorAlarm${index}`, {
                alarmName: `${props.projectName}-${props.environment}-lambda-errors-${index}`,
                metric: func.metricErrors({
                    period: aws_cdk_lib_1.Duration.minutes(5),
                }),
                threshold: 5,
                evaluationPeriods: 2,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            // 実行時間アラーム
            new cloudwatch.Alarm(this, `LambdaDurationAlarm${index}`, {
                alarmName: `${props.projectName}-${props.environment}-lambda-duration-${index}`,
                metric: func.metricDuration({
                    period: aws_cdk_lib_1.Duration.minutes(5),
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
                    period: aws_cdk_lib_1.Duration.minutes(5),
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
    applyTags(tags) {
        if (!tags)
            return;
        Object.entries(tags).forEach(([key, value]) => {
            // CDKのTagsを使用してリソースにタグを適用
            // 注意: 個別のリソースに対してタグを適用する場合は、
            // 各リソースのtagsプロパティを使用する必要があります
        });
    }
    /**
     * Lambda Runtimeの取得
     */
    getLambdaRuntime(runtimeString) {
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
    getLogRetention(days) {
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
exports.FsxServerlessIntegrationConstruct = FsxServerlessIntegrationConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnN4LXNlcnZlcmxlc3MtaW50ZWdyYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJmc3gtc2VydmVybGVzcy1pbnRlZ3JhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7OztHQVlHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDJDQUF1QztBQUN2Qyx5REFBMkM7QUFDM0MsK0RBQWlEO0FBQ2pELHlGQUEyRTtBQUMzRSw2RUFBK0Q7QUFDL0QsOEVBQWdFO0FBQ2hFLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFDMUQseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQyxvRkFBc0U7QUFDdEUseURBQTJDO0FBRTNDLDJEQUE2QztBQUM3Qyx1RUFBeUQ7QUFDekQsNkNBQXNEO0FBNEp0RDs7R0FFRztBQUNILE1BQWEsaUNBQWtDLFNBQVEsc0JBQVM7SUFDOUQ7O09BRUc7SUFDYSxXQUFXLEdBQXdCLEVBQUUsQ0FBQztJQUV0RDs7T0FFRztJQUNhLGVBQWUsR0FBc0IsRUFBRSxDQUFDO0lBRXhEOztPQUVHO0lBQ2EsYUFBYSxHQUFpQyxFQUFFLENBQUM7SUFFakU7O09BRUc7SUFDYSxNQUFNLEdBQWdCLEVBQUUsQ0FBQztJQUV6Qzs7T0FFRztJQUNhLE1BQU0sR0FBZ0IsRUFBRSxDQUFDO0lBRXpDOztPQUVHO0lBQ2EsVUFBVSxHQUFrQixFQUFFLENBQUM7SUFFL0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFvQztRQUM1RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLHVCQUF1QjtRQUN2QixJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdEIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pDLENBQUM7UUFFRCxvQkFBb0I7UUFDcEIsSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzdC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LE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDO1lBQ3BDLEtBQUssWUFBWTtnQkFDZixPQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDO1lBQ3BDO2dCQUNFLE9BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7UUFDckMsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNLLGVBQWUsQ0FBQyxJQUFZO1FBQ2xDLFFBQVEsSUFBSSxFQUFFLENBQUM7WUFDYixLQUFLLENBQUM7Z0JBQ0osT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQztZQUNwQyxLQUFLLENBQUM7Z0JBQ0osT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQztZQUN2QyxLQUFLLENBQUM7Z0JBQ0osT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQztZQUN0QyxLQUFLLENBQUM7Z0JBQ0osT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQztZQUNyQyxLQUFLLEVBQUU7Z0JBQ0wsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQztZQUN0QyxLQUFLLEVBQUU7Z0JBQ0wsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQztZQUN0QyxLQUFLLEVBQUU7Z0JBQ0wsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQztZQUN2QyxLQUFLLEVBQUU7Z0JBQ0wsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQztZQUN6QztnQkFDRSxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDO1FBQ3ZDLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFybEJELDhFQXFsQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZTeCBmb3IgT05UQVAg44GoIFNlcnZlcmxlc3Mg44Ki44O844Kt44OG44Kv44OB44Oj44Gu57Wx5ZCI44Kz44Oz44K544OI44Op44Kv44OIXG4gKiBcbiAqIOOBk+OBruOCs+ODs+OCueODiOODqeOCr+ODiOOBr+OAgUFtYXpvbiBGU3ggZm9yIE5ldEFwcCBPTlRBUCDjgaggQVdTIFNlcnZlcmxlc3Mg44K144O844OT44K5XG4gKiDvvIhMYW1iZGHjgIFTdGVwIEZ1bmN0aW9uc+OAgUV2ZW50QnJpZGdl44CBU1FT44CBU05T77yJ44KS57Wx5ZCI44GX44CBXG4gKiDpq5jmgKfog73jgarjg5XjgqHjgqTjg6vlh6bnkIbjg5HjgqTjg5fjg6njgqTjg7PjgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqIFxuICog5rOo5oSPOiBBUEkgR2F0ZXdheeOBr+OCv+OCpOODoOOCouOCpuODiOWItue0hOOBq+OCiOOCiuS9v+eUqOOBm+OBmuOAgUxhbWJkYSBXZWIgQWRhcHRlcuOCkuS9v+eUqFxuICogXG4gKiBAYXV0aG9yIEtpcm8gQUlcbiAqIEBkYXRlIDIwMjYtMDEtMDhcbiAqIEB2ZXJzaW9uIDEuMC4wXG4gKi9cblxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBmc3ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWZzeCc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBsYW1iZGFFdmVudFNvdXJjZXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ldmVudC1zb3VyY2VzJztcbmltcG9ydCAqIGFzIHN0ZXBmdW5jdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgc2ZuVGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zcXMnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc25zU3Vic2NyaXB0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zLXN1YnNjcmlwdGlvbnMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCB7IER1cmF0aW9uLCBSZW1vdmFsUG9saWN5IH0gZnJvbSAnYXdzLWNkay1saWInO1xuXG4vKipcbiAqIEZTeC1TZXJ2ZXJsZXNz57Wx5ZCI44Kz44Oz44K544OI44Op44Kv44OI44Gu44OX44Ot44OR44OG44KjXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRnN4U2VydmVybGVzc0ludGVncmF0aW9uUHJvcHMge1xuICAvKipcbiAgICogRlN4IGZvciBPTlRBUOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgZnN4OiB7XG4gICAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcbiAgICByZWFkb25seSBmaWxlU3lzdGVtczogQXJyYXk8e1xuICAgICAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcbiAgICAgIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcbiAgICAgIHJlYWRvbmx5IHN0b3JhZ2VDYXBhY2l0eTogbnVtYmVyO1xuICAgICAgcmVhZG9ubHkgdGhyb3VnaHB1dENhcGFjaXR5OiBudW1iZXI7XG4gICAgICByZWFkb25seSBkZXBsb3ltZW50VHlwZTogJ1NJTkdMRV9BWl8xJyB8ICdNVUxUSV9BWl8xJztcbiAgICAgIHJlYWRvbmx5IHN0b3JhZ2VFZmZpY2llbmN5OiBib29sZWFuO1xuICAgICAgcmVhZG9ubHkgYmFja3VwOiB7XG4gICAgICAgIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG4gICAgICAgIHJlYWRvbmx5IHJldGVudGlvbkRheXM6IG51bWJlcjtcbiAgICAgICAgcmVhZG9ubHkgZGFpbHlBdXRvbWF0aWNCYWNrdXBTdGFydFRpbWU6IHN0cmluZztcbiAgICAgIH07XG4gICAgICByZWFkb25seSBlbmNyeXB0aW9uOiB7XG4gICAgICAgIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG4gICAgICAgIHJlYWRvbmx5IGttc0tleUlkPzogc3RyaW5nO1xuICAgICAgfTtcbiAgICAgIHJlYWRvbmx5IG5ldHdvcms6IHtcbiAgICAgICAgcmVhZG9ubHkgc3VibmV0SWRzOiBzdHJpbmdbXTtcbiAgICAgICAgcmVhZG9ubHkgc2VjdXJpdHlHcm91cElkczogc3RyaW5nW107XG4gICAgICAgIHJlYWRvbmx5IHJvdXRlVGFibGVJZHM6IHN0cmluZ1tdO1xuICAgICAgfTtcbiAgICB9PjtcbiAgICByZWFkb25seSBzdG9yYWdlVmlydHVhbE1hY2hpbmVzOiBBcnJheTx7XG4gICAgICByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuICAgICAgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuICAgICAgcmVhZG9ubHkgcm9vdFZvbHVtZVNlY3VyaXR5U3R5bGU6ICdVTklYJyB8ICdOVEZTJyB8ICdNSVhFRCc7XG4gICAgICByZWFkb25seSBhY3RpdmVEaXJlY3RvcnlDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG4gICAgICB9O1xuICAgIH0+O1xuICAgIHJlYWRvbmx5IHZvbHVtZXM6IEFycmF5PHtcbiAgICAgIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG4gICAgICByZWFkb25seSBuYW1lOiBzdHJpbmc7XG4gICAgICByZWFkb25seSBzaXplSW5NZWdhYnl0ZXM6IG51bWJlcjtcbiAgICAgIHJlYWRvbmx5IHNlY3VyaXR5U3R5bGU6ICdVTklYJyB8ICdOVEZTJyB8ICdNSVhFRCc7XG4gICAgICByZWFkb25seSBvbnRhcFZvbHVtZVR5cGU6ICdSVycgfCAnRFAnO1xuICAgICAgcmVhZG9ubHkganVuY3Rpb25QYXRoOiBzdHJpbmc7XG4gICAgfT47XG4gIH07XG5cbiAgLyoqXG4gICAqIFNlcnZlcmxlc3PoqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IHNlcnZlcmxlc3M6IHtcbiAgICByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuICAgIHJlYWRvbmx5IHN0ZXBGdW5jdGlvbnM6IHtcbiAgICAgIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG4gICAgICByZWFkb25seSB3b3JrZmxvd3M6IEFycmF5PHtcbiAgICAgICAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcbiAgICAgICAgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuICAgICAgICByZWFkb25seSBwdXJwb3NlOiBzdHJpbmc7XG4gICAgICAgIHJlYWRvbmx5IHJvbGU6IHtcbiAgICAgICAgICByZWFkb25seSBwZXJtaXNzaW9uczogc3RyaW5nW107XG4gICAgICAgIH07XG4gICAgICB9PjtcbiAgICAgIHJlYWRvbmx5IGV4ZWN1dGlvbjoge1xuICAgICAgICByZWFkb25seSB0aW1lb3V0OiBudW1iZXI7XG4gICAgICAgIHJlYWRvbmx5IHJldHJ5QXR0ZW1wdHM6IG51bWJlcjtcbiAgICAgIH07XG4gICAgfTtcbiAgICByZWFkb25seSBldmVudEJyaWRnZToge1xuICAgICAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcbiAgICAgIHJlYWRvbmx5IHJ1bGVzOiBBcnJheTx7XG4gICAgICAgIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG4gICAgICAgIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcbiAgICAgICAgcmVhZG9ubHkgZXZlbnRQYXR0ZXJuPzogYW55O1xuICAgICAgICByZWFkb25seSBzY2hlZHVsZT86IHtcbiAgICAgICAgICByZWFkb25seSBleHByZXNzaW9uOiBzdHJpbmc7XG4gICAgICAgIH07XG4gICAgICB9PjtcbiAgICB9O1xuICAgIHJlYWRvbmx5IHNxczoge1xuICAgICAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcbiAgICAgIHJlYWRvbmx5IHF1ZXVlczogQXJyYXk8e1xuICAgICAgICByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuICAgICAgICByZWFkb25seSBuYW1lOiBzdHJpbmc7XG4gICAgICAgIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICByZWFkb25seSB2aXNpYmlsaXR5VGltZW91dFNlY29uZHM6IG51bWJlcjtcbiAgICAgICAgICByZWFkb25seSBtZXNzYWdlUmV0ZW50aW9uUGVyaW9kOiBudW1iZXI7XG4gICAgICAgICAgcmVhZG9ubHkgbWF4UmVjZWl2ZUNvdW50OiBudW1iZXI7XG4gICAgICAgIH07XG4gICAgICB9PjtcbiAgICB9O1xuICAgIHJlYWRvbmx5IHNuczoge1xuICAgICAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcbiAgICAgIHJlYWRvbmx5IHRvcGljczogQXJyYXk8e1xuICAgICAgICByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuICAgICAgICByZWFkb25seSBuYW1lOiBzdHJpbmc7XG4gICAgICAgIHJlYWRvbmx5IHN1YnNjcmlwdGlvbnM6IEFycmF5PHtcbiAgICAgICAgICByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuICAgICAgICAgIHJlYWRvbmx5IHByb3RvY29sOiBzdHJpbmc7XG4gICAgICAgICAgcmVhZG9ubHkgZW5kcG9pbnQ6IHN0cmluZztcbiAgICAgICAgfT47XG4gICAgICB9PjtcbiAgICB9O1xuICAgIHJlYWRvbmx5IGxhbWJkYToge1xuICAgICAgcmVhZG9ubHkgZnVuY3Rpb25zOiBBcnJheTx7XG4gICAgICAgIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG4gICAgICAgIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcbiAgICAgICAgcmVhZG9ubHkgcnVudGltZTogc3RyaW5nO1xuICAgICAgICByZWFkb25seSB0aW1lb3V0OiBudW1iZXI7XG4gICAgICAgIHJlYWRvbmx5IG1lbW9yeVNpemU6IG51bWJlcjtcbiAgICAgICAgcmVhZG9ubHkgdnBjOiB7XG4gICAgICAgICAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZG9ubHkgZmlsZVN5c3RlbToge1xuICAgICAgICAgIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG4gICAgICAgIH07XG4gICAgICAgIHJlYWRvbmx5IHJvbGU6IHtcbiAgICAgICAgICByZWFkb25seSBwZXJtaXNzaW9uczogc3RyaW5nW107XG4gICAgICAgIH07XG4gICAgICB9PjtcbiAgICB9O1xuICAgIHJlYWRvbmx5IG1vbml0b3Jpbmc6IHtcbiAgICAgIHJlYWRvbmx5IGNsb3VkV2F0Y2g6IHtcbiAgICAgICAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcbiAgICAgICAgcmVhZG9ubHkgbG9nUmV0ZW50aW9uRGF5czogbnVtYmVyO1xuICAgICAgfTtcbiAgICAgIHJlYWRvbmx5IHhyYXk6IHtcbiAgICAgICAgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcbiAgICAgIH07XG4gICAgfTtcbiAgfTtcblxuICAvKipcbiAgICogVlBD6Kit5a6aXG4gICAqL1xuICByZWFkb25seSB2cGM6IGVjMi5JVnBjO1xuXG4gIC8qKlxuICAgKiDnkrDlooPlkI1cbiAgICovXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOODl+ODreOCuOOCp+OCr+ODiOWQjVxuICAgKi9cbiAgcmVhZG9ubHkgcHJvamVjdE5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICog44K/44KwXG4gICAqL1xuICByZWFkb25seSB0YWdzPzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuLyoqXG4gKiBGU3gtU2VydmVybGVzc+e1seWQiOOCs+ODs+OCueODiOODqeOCr+ODiFxuICovXG5leHBvcnQgY2xhc3MgRnN4U2VydmVybGVzc0ludGVncmF0aW9uQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgLyoqXG4gICAqIEZTeCBmb3IgT05UQVDjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6BcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBmaWxlU3lzdGVtczogZnN4LkNmbkZpbGVTeXN0ZW1bXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbBcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBsYW1iZGFGdW5jdGlvbnM6IGxhbWJkYS5GdW5jdGlvbltdID0gW107XG5cbiAgLyoqXG4gICAqIFN0ZXAgRnVuY3Rpb25zIOOCueODhuODvOODiOODnuOCt+ODs1xuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHN0YXRlTWFjaGluZXM6IHN0ZXBmdW5jdGlvbnMuU3RhdGVNYWNoaW5lW10gPSBbXTtcblxuICAvKipcbiAgICogU1FT44Kt44Ol44O8XG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgcXVldWVzOiBzcXMuUXVldWVbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBTTlPjg4jjg5Tjg4Pjgq9cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSB0b3BpY3M6IHNucy5Ub3BpY1tdID0gW107XG5cbiAgLyoqXG4gICAqIEV2ZW50QnJpZGdl44Or44O844OrXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZXZlbnRSdWxlczogZXZlbnRzLlJ1bGVbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBGc3hTZXJ2ZXJsZXNzSW50ZWdyYXRpb25Qcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBGU3ggZm9yIE9OVEFQ44Oq44K944O844K544Gu5L2c5oiQXG4gICAgaWYgKHByb3BzLmZzeC5lbmFibGVkKSB7XG4gICAgICB0aGlzLmNyZWF0ZUZzeFJlc291cmNlcyhwcm9wcyk7XG4gICAgfVxuXG4gICAgLy8gU2VydmVybGVzc+ODquOCveODvOOCueOBruS9nOaIkFxuICAgIGlmIChwcm9wcy5zZXJ2ZXJsZXNzLmVuYWJsZWQpIHtcbiAgICAgIHRoaXMuY3JlYXRlU2VydmVybGVzc1Jlc291cmNlcyhwcm9wcyk7XG4gICAgfVxuXG4gICAgLy8g57Wx5ZCI44Gu6Kit5a6aXG4gICAgdGhpcy5zZXR1cEludGVncmF0aW9uKHByb3BzKTtcblxuICAgIC8vIOODouODi+OCv+ODquODs+OCsOOBruioreWumlxuICAgIHRoaXMuc2V0dXBNb25pdG9yaW5nKHByb3BzKTtcblxuICAgIC8vIOOCv+OCsOOBrumBqeeUqFxuICAgIHRoaXMuYXBwbHlUYWdzKHByb3BzLnRhZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZTeCBmb3IgT05UQVDjg6rjgr3jg7zjgrnjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRnN4UmVzb3VyY2VzKHByb3BzOiBGc3hTZXJ2ZXJsZXNzSW50ZWdyYXRpb25Qcm9wcyk6IHZvaWQge1xuICAgIHByb3BzLmZzeC5maWxlU3lzdGVtcy5mb3JFYWNoKChmc0NvbmZpZywgaW5kZXgpID0+IHtcbiAgICAgIGlmICghZnNDb25maWcuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICBjb25zdCBmaWxlU3lzdGVtID0gbmV3IGZzeC5DZm5GaWxlU3lzdGVtKHRoaXMsIGBGaWxlU3lzdGVtJHtpbmRleH1gLCB7XG4gICAgICAgIGZpbGVTeXN0ZW1UeXBlOiAnT05UQVAnLFxuICAgICAgICBzdG9yYWdlQ2FwYWNpdHk6IGZzQ29uZmlnLnN0b3JhZ2VDYXBhY2l0eSxcbiAgICAgICAgc3VibmV0SWRzOiBmc0NvbmZpZy5uZXR3b3JrLnN1Ym5ldElkcyxcbiAgICAgICAgb250YXBDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgZGVwbG95bWVudFR5cGU6IGZzQ29uZmlnLmRlcGxveW1lbnRUeXBlLFxuICAgICAgICAgIHRocm91Z2hwdXRDYXBhY2l0eTogZnNDb25maWcudGhyb3VnaHB1dENhcGFjaXR5LFxuICAgICAgICAgIHByZWZlcnJlZFN1Ym5ldElkOiBmc0NvbmZpZy5uZXR3b3JrLnN1Ym5ldElkc1swXSxcbiAgICAgICAgICByb3V0ZVRhYmxlSWRzOiBmc0NvbmZpZy5uZXR3b3JrLnJvdXRlVGFibGVJZHMsXG4gICAgICAgICAgYXV0b21hdGljQmFja3VwUmV0ZW50aW9uRGF5czogZnNDb25maWcuYmFja3VwLmVuYWJsZWQgPyBmc0NvbmZpZy5iYWNrdXAucmV0ZW50aW9uRGF5cyA6IDAsXG4gICAgICAgICAgZGFpbHlBdXRvbWF0aWNCYWNrdXBTdGFydFRpbWU6IGZzQ29uZmlnLmJhY2t1cC5lbmFibGVkID8gZnNDb25maWcuYmFja3VwLmRhaWx5QXV0b21hdGljQmFja3VwU3RhcnRUaW1lIDogdW5kZWZpbmVkLFxuICAgICAgICAgIGRpc2tJb3BzQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgbW9kZTogJ0FVVE9NQVRJQycsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB3ZWVrbHlNYWludGVuYW5jZVN0YXJ0VGltZTogJzc6MDk6MDAnLFxuICAgICAgICB9LFxuICAgICAgICBzZWN1cml0eUdyb3VwSWRzOiBmc0NvbmZpZy5uZXR3b3JrLnNlY3VyaXR5R3JvdXBJZHMsXG4gICAgICAgIGttc0tleUlkOiBmc0NvbmZpZy5lbmNyeXB0aW9uLmVuYWJsZWQgPyBmc0NvbmZpZy5lbmNyeXB0aW9uLmttc0tleUlkIDogdW5kZWZpbmVkLFxuICAgICAgICB0YWdzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAga2V5OiAnTmFtZScsXG4gICAgICAgICAgICB2YWx1ZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LSR7ZnNDb25maWcubmFtZX1gLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAga2V5OiAnRW52aXJvbm1lbnQnLFxuICAgICAgICAgICAgdmFsdWU6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAga2V5OiAnUHJvamVjdCcsXG4gICAgICAgICAgICB2YWx1ZTogcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLmZpbGVTeXN0ZW1zLnB1c2goZmlsZVN5c3RlbSk7XG5cbiAgICAgIC8vIFN0b3JhZ2UgVmlydHVhbCBNYWNoaW5lIChTVk0pIOOBruS9nOaIkFxuICAgICAgcHJvcHMuZnN4LnN0b3JhZ2VWaXJ0dWFsTWFjaGluZXMuZm9yRWFjaCgoc3ZtQ29uZmlnLCBzdm1JbmRleCkgPT4ge1xuICAgICAgICBpZiAoIXN2bUNvbmZpZy5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3Qgc3ZtID0gbmV3IGZzeC5DZm5TdG9yYWdlVmlydHVhbE1hY2hpbmUodGhpcywgYFNWTSR7aW5kZXh9LSR7c3ZtSW5kZXh9YCwge1xuICAgICAgICAgIGZpbGVTeXN0ZW1JZDogZmlsZVN5c3RlbS5yZWYsXG4gICAgICAgICAgbmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LSR7c3ZtQ29uZmlnLm5hbWV9YCxcbiAgICAgICAgICByb290Vm9sdW1lU2VjdXJpdHlTdHlsZTogc3ZtQ29uZmlnLnJvb3RWb2x1bWVTZWN1cml0eVN0eWxlLFxuICAgICAgICAgIHRhZ3M6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAga2V5OiAnTmFtZScsXG4gICAgICAgICAgICAgIHZhbHVlOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tJHtzdm1Db25maWcubmFtZX1gLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAga2V5OiAnRW52aXJvbm1lbnQnLFxuICAgICAgICAgICAgICB2YWx1ZTogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIOODnOODquODpeODvOODoOOBruS9nOaIkFxuICAgICAgICBwcm9wcy5mc3gudm9sdW1lcy5mb3JFYWNoKCh2b2x1bWVDb25maWcsIHZvbHVtZUluZGV4KSA9PiB7XG4gICAgICAgICAgaWYgKCF2b2x1bWVDb25maWcuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgICAgbmV3IGZzeC5DZm5Wb2x1bWUodGhpcywgYFZvbHVtZSR7aW5kZXh9LSR7c3ZtSW5kZXh9LSR7dm9sdW1lSW5kZXh9YCwge1xuICAgICAgICAgICAgbmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LSR7dm9sdW1lQ29uZmlnLm5hbWV9YCxcbiAgICAgICAgICAgIG9udGFwQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICBzdG9yYWdlVmlydHVhbE1hY2hpbmVJZDogc3ZtLnJlZixcbiAgICAgICAgICAgICAgc2l6ZUluTWVnYWJ5dGVzOiB2b2x1bWVDb25maWcuc2l6ZUluTWVnYWJ5dGVzLnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgIHNlY3VyaXR5U3R5bGU6IHZvbHVtZUNvbmZpZy5zZWN1cml0eVN0eWxlLFxuICAgICAgICAgICAgICBvbnRhcFZvbHVtZVR5cGU6IHZvbHVtZUNvbmZpZy5vbnRhcFZvbHVtZVR5cGUsXG4gICAgICAgICAgICAgIGp1bmN0aW9uUGF0aDogdm9sdW1lQ29uZmlnLmp1bmN0aW9uUGF0aCxcbiAgICAgICAgICAgICAgc3RvcmFnZUVmZmljaWVuY3lFbmFibGVkOiAndHJ1ZScsXG4gICAgICAgICAgICAgIHRpZXJpbmdQb2xpY3k6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnQVVUTycsXG4gICAgICAgICAgICAgICAgY29vbGluZ1BlcmlvZDogMzEsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGFnczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAga2V5OiAnTmFtZScsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS0ke3ZvbHVtZUNvbmZpZy5uYW1lfWAsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBrZXk6ICdFbnZpcm9ubWVudCcsXG4gICAgICAgICAgICAgICAgdmFsdWU6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXJ2ZXJsZXNz44Oq44K944O844K544Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVNlcnZlcmxlc3NSZXNvdXJjZXMocHJvcHM6IEZzeFNlcnZlcmxlc3NJbnRlZ3JhdGlvblByb3BzKTogdm9pZCB7XG4gICAgLy8gU05T44OI44OU44OD44Kv44Gu5L2c5oiQXG4gICAgaWYgKHByb3BzLnNlcnZlcmxlc3Muc25zLmVuYWJsZWQpIHtcbiAgICAgIHRoaXMuY3JlYXRlU25zVG9waWNzKHByb3BzKTtcbiAgICB9XG5cbiAgICAvLyBTUVPjgq3jg6Xjg7zjga7kvZzmiJBcbiAgICBpZiAocHJvcHMuc2VydmVybGVzcy5zcXMuZW5hYmxlZCkge1xuICAgICAgdGhpcy5jcmVhdGVTcXNRdWV1ZXMocHJvcHMpO1xuICAgIH1cblxuICAgIC8vIExhbWJkYemWouaVsOOBruS9nOaIkFxuICAgIHRoaXMuY3JlYXRlTGFtYmRhRnVuY3Rpb25zKHByb3BzKTtcblxuICAgIC8vIFN0ZXAgRnVuY3Rpb25z44Gu5L2c5oiQXG4gICAgaWYgKHByb3BzLnNlcnZlcmxlc3Muc3RlcEZ1bmN0aW9ucy5lbmFibGVkKSB7XG4gICAgICB0aGlzLmNyZWF0ZVN0ZXBGdW5jdGlvbnMocHJvcHMpO1xuICAgIH1cblxuICAgIC8vIEV2ZW50QnJpZGdl44Or44O844Or44Gu5L2c5oiQXG4gICAgaWYgKHByb3BzLnNlcnZlcmxlc3MuZXZlbnRCcmlkZ2UuZW5hYmxlZCkge1xuICAgICAgdGhpcy5jcmVhdGVFdmVudEJyaWRnZVJ1bGVzKHByb3BzKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU05T44OI44OU44OD44Kv44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVNuc1RvcGljcyhwcm9wczogRnN4U2VydmVybGVzc0ludGVncmF0aW9uUHJvcHMpOiB2b2lkIHtcbiAgICBwcm9wcy5zZXJ2ZXJsZXNzLnNucy50b3BpY3MuZm9yRWFjaCgodG9waWNDb25maWcsIGluZGV4KSA9PiB7XG4gICAgICBpZiAoIXRvcGljQ29uZmlnLmVuYWJsZWQpIHJldHVybjtcblxuICAgICAgY29uc3QgdG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsIGBUb3BpYyR7aW5kZXh9YCwge1xuICAgICAgICB0b3BpY05hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS0ke3RvcGljQ29uZmlnLm5hbWV9YCxcbiAgICAgICAgZGlzcGxheU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfSAke3Byb3BzLmVudmlyb25tZW50fSAke3RvcGljQ29uZmlnLm5hbWV9YCxcbiAgICAgIH0pO1xuXG4gICAgICAvLyDjgrXjg5bjgrnjgq/jg6rjg5fjgrfjg6fjg7Pjga7ov73liqBcbiAgICAgIHRvcGljQ29uZmlnLnN1YnNjcmlwdGlvbnMuZm9yRWFjaCgoc3ViQ29uZmlnLCBzdWJJbmRleCkgPT4ge1xuICAgICAgICBpZiAoIXN1YkNvbmZpZy5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHN1YkNvbmZpZy5wcm90b2NvbCA9PT0gJ2VtYWlsJykge1xuICAgICAgICAgIHRvcGljLmFkZFN1YnNjcmlwdGlvbihuZXcgc25zU3Vic2NyaXB0aW9ucy5FbWFpbFN1YnNjcmlwdGlvbihzdWJDb25maWcuZW5kcG9pbnQpKTtcbiAgICAgICAgfSBlbHNlIGlmIChzdWJDb25maWcucHJvdG9jb2wgPT09ICdzbXMnKSB7XG4gICAgICAgICAgdG9waWMuYWRkU3Vic2NyaXB0aW9uKG5ldyBzbnNTdWJzY3JpcHRpb25zLlNtc1N1YnNjcmlwdGlvbihzdWJDb25maWcuZW5kcG9pbnQpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudG9waWNzLnB1c2godG9waWMpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNRU+OCreODpeODvOOBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVTcXNRdWV1ZXMocHJvcHM6IEZzeFNlcnZlcmxlc3NJbnRlZ3JhdGlvblByb3BzKTogdm9pZCB7XG4gICAgcHJvcHMuc2VydmVybGVzcy5zcXMucXVldWVzLmZvckVhY2goKHF1ZXVlQ29uZmlnLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKCFxdWV1ZUNvbmZpZy5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgIGNvbnN0IHF1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCBgUXVldWUke2luZGV4fWAsIHtcbiAgICAgICAgcXVldWVOYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tJHtxdWV1ZUNvbmZpZy5uYW1lfWAsXG4gICAgICAgIHZpc2liaWxpdHlUaW1lb3V0OiBEdXJhdGlvbi5zZWNvbmRzKHF1ZXVlQ29uZmlnLmNvbmZpZ3VyYXRpb24udmlzaWJpbGl0eVRpbWVvdXRTZWNvbmRzKSxcbiAgICAgICAgcmV0ZW50aW9uUGVyaW9kOiBEdXJhdGlvbi5zZWNvbmRzKHF1ZXVlQ29uZmlnLmNvbmZpZ3VyYXRpb24ubWVzc2FnZVJldGVudGlvblBlcmlvZCksXG4gICAgICAgIGRlYWRMZXR0ZXJRdWV1ZToge1xuICAgICAgICAgIHF1ZXVlOiBuZXcgc3FzLlF1ZXVlKHRoaXMsIGBETFEke2luZGV4fWAsIHtcbiAgICAgICAgICAgIHF1ZXVlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LSR7cXVldWVDb25maWcubmFtZX0tZGxxYCxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBtYXhSZWNlaXZlQ291bnQ6IHF1ZXVlQ29uZmlnLmNvbmZpZ3VyYXRpb24ubWF4UmVjZWl2ZUNvdW50LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMucXVldWVzLnB1c2gocXVldWUpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIExhbWJkYemWouaVsOOBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVMYW1iZGFGdW5jdGlvbnMocHJvcHM6IEZzeFNlcnZlcmxlc3NJbnRlZ3JhdGlvblByb3BzKTogdm9pZCB7XG4gICAgcHJvcHMuc2VydmVybGVzcy5sYW1iZGEuZnVuY3Rpb25zLmZvckVhY2goKGZ1bmNDb25maWcsIGluZGV4KSA9PiB7XG4gICAgICBpZiAoIWZ1bmNDb25maWcuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAvLyBJQU3jg63jg7zjg6vjga7kvZzmiJBcbiAgICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgYExhbWJkYVJvbGUke2luZGV4fWAsIHtcbiAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgICBdLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIFZQQ+ioreWumuOBruWgtOWQiOOBr1ZQQ+Wun+ihjOODneODquOCt+ODvOOCkui/veWKoFxuICAgICAgaWYgKGZ1bmNDb25maWcudnBjLmVuYWJsZWQpIHtcbiAgICAgICAgcm9sZS5hZGRNYW5hZ2VkUG9saWN5KFxuICAgICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYVZQQ0FjY2Vzc0V4ZWN1dGlvblJvbGUnKVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyDjgqvjgrnjgr/jg6DmqKnpmZDjga7ov73liqBcbiAgICAgIGlmIChmdW5jQ29uZmlnLnJvbGUucGVybWlzc2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBhY3Rpb25zOiBmdW5jQ29uZmlnLnJvbGUucGVybWlzc2lvbnMsXG4gICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgfSkpO1xuICAgICAgfVxuXG4gICAgICAvLyBMYW1iZGHplqLmlbDjga7kvZzmiJDvvIg2NOaWh+Wtl+WItumZkOWvvuW/nO+8iVxuICAgICAgY29uc3Qgc2hvcnRGdW5jdGlvbk5hbWUgPSBgJHtwcm9wcy5wcm9qZWN0TmFtZS5zdWJzdHJpbmcoMCwgMTUpfS0ke3Byb3BzLmVudmlyb25tZW50fS0ke2Z1bmNDb25maWcubmFtZS5zdWJzdHJpbmcoMCwgMjApfWA7XG4gICAgICBjb25zdCBsYW1iZGFGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgYEZ1bmN0aW9uJHtpbmRleH1gLCB7XG4gICAgICAgIGZ1bmN0aW9uTmFtZTogc2hvcnRGdW5jdGlvbk5hbWUsXG4gICAgICAgIHJ1bnRpbWU6IHRoaXMuZ2V0TGFtYmRhUnVudGltZShmdW5jQ29uZmlnLnJ1bnRpbWUpLFxuICAgICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuaW1wb3J0IGpzb25cbmltcG9ydCBib3RvM1xuaW1wb3J0IGxvZ2dpbmdcbmltcG9ydCBvc1xuXG5sb2dnZXIgPSBsb2dnaW5nLmdldExvZ2dlcigpXG5sb2dnZXIuc2V0TGV2ZWwobG9nZ2luZy5JTkZPKVxuXG5kZWYgaGFuZGxlcihldmVudCwgY29udGV4dCk6XG4gICAgXCJcIlwiXG4gICAgRlN4LVNlcnZlcmxlc3PntbHlkIhMYW1iZGHplqLmlbBcbiAgICBMYW1iZGEgV2ViIEFkYXB0ZXLntYznlLHjgadIVFRQ44Oq44Kv44Ko44K544OI44KS5Yem55CGXG4gICAgXCJcIlwiXG4gICAgbG9nZ2VyLmluZm8oZlwiUmVjZWl2ZWQgZXZlbnQ6IHtqc29uLmR1bXBzKGV2ZW50KX1cIilcbiAgICBcbiAgICB0cnk6XG4gICAgICAgICMgRlN444OV44Kh44Kk44Or44K344K544OG44Og44Gu5oOF5aCx44KS5Y+W5b6XXG4gICAgICAgIGZzeF9jbGllbnQgPSBib3RvMy5jbGllbnQoJ2ZzeCcpXG4gICAgICAgIFxuICAgICAgICAjIEhUVFDjg6rjgq/jgqjjgrnjg4jjga7lh6bnkIbvvIhMYW1iZGEgV2ViIEFkYXB0ZXLlvaLlvI/vvIlcbiAgICAgICAgaHR0cF9tZXRob2QgPSBldmVudC5nZXQoJ3JlcXVlc3RDb250ZXh0Jywge30pLmdldCgnaHR0cCcsIHt9KS5nZXQoJ21ldGhvZCcsICdHRVQnKVxuICAgICAgICBwYXRoID0gZXZlbnQuZ2V0KCdyYXdQYXRoJywgJy8nKVxuICAgICAgICBcbiAgICAgICAgIyDjg5jjg6vjgrnjg4Hjgqfjg4Pjgq/jgqjjg7Pjg4njg53jgqTjg7Pjg4hcbiAgICAgICAgaWYgcGF0aCA9PSAnL2hlYWx0aCc6XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICdzdGF0dXNDb2RlJzogMjAwLFxuICAgICAgICAgICAgICAgICdoZWFkZXJzJzogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxuICAgICAgICAgICAgICAgICdib2R5JzoganNvbi5kdW1wcyh7XG4gICAgICAgICAgICAgICAgICAgICdzdGF0dXMnOiAnaGVhbHRoeScsXG4gICAgICAgICAgICAgICAgICAgICdzZXJ2aWNlJzogJ2ZzeC1zZXJ2ZXJsZXNzLWludGVncmF0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgJ3RpbWVzdGFtcCc6IGNvbnRleHQuYXdzX3JlcXVlc3RfaWRcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgIyBGU3jjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6Dmg4XloLHjgqjjg7Pjg4njg53jgqTjg7Pjg4hcbiAgICAgICAgaWYgcGF0aCA9PSAnL2ZzeC9pbmZvJzpcbiAgICAgICAgICAgIGZpbGVfc3lzdGVtcyA9IGZzeF9jbGllbnQuZGVzY3JpYmVfZmlsZV9zeXN0ZW1zKClcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgJ3N0YXR1c0NvZGUnOiAyMDAsXG4gICAgICAgICAgICAgICAgJ2hlYWRlcnMnOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHtcbiAgICAgICAgICAgICAgICAgICAgJ2ZpbGVTeXN0ZW1zJzogZmlsZV9zeXN0ZW1zLmdldCgnRmlsZVN5c3RlbXMnLCBbXSksXG4gICAgICAgICAgICAgICAgICAgICdjb3VudCc6IGxlbihmaWxlX3N5c3RlbXMuZ2V0KCdGaWxlU3lzdGVtcycsIFtdKSlcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgIyDjg4fjg5Xjgqnjg6vjg4jjg6zjgrnjg53jg7PjgrlcbiAgICAgICAgcmVzdWx0ID0ge1xuICAgICAgICAgICAgJ3N0YXR1c0NvZGUnOiAyMDAsXG4gICAgICAgICAgICAnaGVhZGVycyc6IHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSxcbiAgICAgICAgICAgICdib2R5JzoganNvbi5kdW1wcyh7XG4gICAgICAgICAgICAgICAgJ21lc3NhZ2UnOiAnRlN4LVNlcnZlcmxlc3MgaW50ZWdyYXRpb24gc3VjY2Vzc2Z1bCcsXG4gICAgICAgICAgICAgICAgJ21ldGhvZCc6IGh0dHBfbWV0aG9kLFxuICAgICAgICAgICAgICAgICdwYXRoJzogcGF0aCxcbiAgICAgICAgICAgICAgICAncmVxdWVzdElkJzogY29udGV4dC5hd3NfcmVxdWVzdF9pZFxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbG9nZ2VyLmluZm8oZlwiUHJvY2Vzc2luZyBjb21wbGV0ZWQ6IHtyZXN1bHR9XCIpXG4gICAgICAgIHJldHVybiByZXN1bHRcbiAgICAgICAgXG4gICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOlxuICAgICAgICBsb2dnZXIuZXJyb3IoZlwiRXJyb3IgcHJvY2Vzc2luZyBldmVudDoge3N0cihlKX1cIilcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICdzdGF0dXNDb2RlJzogNTAwLFxuICAgICAgICAgICAgJ2hlYWRlcnMnOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoe1xuICAgICAgICAgICAgICAgICdlcnJvcic6IHN0cihlKSxcbiAgICAgICAgICAgICAgICAncmVxdWVzdElkJzogY29udGV4dC5hd3NfcmVxdWVzdF9pZFxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBgKSxcbiAgICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcyhmdW5jQ29uZmlnLnRpbWVvdXQpLFxuICAgICAgICBtZW1vcnlTaXplOiBmdW5jQ29uZmlnLm1lbW9yeVNpemUsXG4gICAgICAgIHJvbGU6IHJvbGUsXG4gICAgICAgIHZwYzogZnVuY0NvbmZpZy52cGMuZW5hYmxlZCA/IHByb3BzLnZwYyA6IHVuZGVmaW5lZCxcbiAgICAgICAgdHJhY2luZzogcHJvcHMuc2VydmVybGVzcy5tb25pdG9yaW5nLnhyYXkuZW5hYmxlZCA/IGxhbWJkYS5UcmFjaW5nLkFDVElWRSA6IGxhbWJkYS5UcmFjaW5nLkRJU0FCTEVELFxuICAgICAgICBsb2dSZXRlbnRpb246IHByb3BzLnNlcnZlcmxlc3MubW9uaXRvcmluZy5jbG91ZFdhdGNoLmVuYWJsZWQgXG4gICAgICAgICAgPyB0aGlzLmdldExvZ1JldGVudGlvbihwcm9wcy5zZXJ2ZXJsZXNzLm1vbml0b3JpbmcuY2xvdWRXYXRjaC5sb2dSZXRlbnRpb25EYXlzKVxuICAgICAgICAgIDogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIC8vIExhbWJkYSBXZWIgQWRhcHRlcueSsOWig+WkieaVsFxuICAgICAgICAgIEFXU19MV0FfSU5WT0tFX01PREU6ICdidWZmZXJlZCcsXG4gICAgICAgICAgQVdTX0xXQV9QT1JUOiAnMzAwMCcsXG4gICAgICAgICAgQVdTX0xXQV9SRUFESU5FU1NfQ0hFQ0tfUEFUSDogJy9oZWFsdGgnLFxuICAgICAgICAgIC8vIEZTeOmWoumAo+eSsOWig+WkieaVsFxuICAgICAgICAgIEZTWF9SRUdJT046IHByb3BzLnZwYy5lbnY/LnJlZ2lvbiB8fCAnYXAtbm9ydGhlYXN0LTEnLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEZTeOODleOCoeOCpOODq+OCt+OCueODhuODoOODnuOCpuODs+ODiOioreWumu+8iFZQQ+WGheOBruWgtOWQiO+8iVxuICAgICAgaWYgKGZ1bmNDb25maWcudnBjLmVuYWJsZWQgJiYgZnVuY0NvbmZpZy5maWxlU3lzdGVtLmVuYWJsZWQgJiYgdGhpcy5maWxlU3lzdGVtcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIEVGUyBBY2Nlc3MgUG9pbnTjga7ku6Pjgo/jgorjgatGU3ggZm9yIE9OVEFQ44Gu44Oe44Km44Oz44OI6Kit5a6aXG4gICAgICAgIC8vIOazqOaEjzogTGFtYmRh6Zai5pWw44Gn44GuRlN4IGZvciBPTlRBUOODnuOCpuODs+ODiOOBr+OAgUVGU+OBqOOBr+eVsOOBquOCi+ioreWumuOBjOW/heimgVxuICAgICAgICBsYW1iZGFGdW5jdGlvbi5hZGRFbnZpcm9ubWVudCgnRlNYX0ZJTEVfU1lTVEVNX0lEJywgdGhpcy5maWxlU3lzdGVtc1swXS5yZWYpO1xuICAgICAgICBsYW1iZGFGdW5jdGlvbi5hZGRFbnZpcm9ubWVudCgnRlNYX01PVU5UX1BBVEgnLCAnL21udC9mc3gnKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5sYW1iZGFGdW5jdGlvbnMucHVzaChsYW1iZGFGdW5jdGlvbik7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU3RlcCBGdW5jdGlvbnPjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU3RlcEZ1bmN0aW9ucyhwcm9wczogRnN4U2VydmVybGVzc0ludGVncmF0aW9uUHJvcHMpOiB2b2lkIHtcbiAgICBwcm9wcy5zZXJ2ZXJsZXNzLnN0ZXBGdW5jdGlvbnMud29ya2Zsb3dzLmZvckVhY2goKHdvcmtmbG93Q29uZmlnLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKCF3b3JrZmxvd0NvbmZpZy5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgIC8vIFN0ZXAgRnVuY3Rpb25z55So44GuSUFN44Ot44O844OrXG4gICAgICBjb25zdCByb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIGBTdGVwRnVuY3Rpb25zUm9sZSR7aW5kZXh9YCwge1xuICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnc3RhdGVzLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyDmqKnpmZDjga7ov73liqBcbiAgICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiB3b3JrZmxvd0NvbmZpZy5yb2xlLnBlcm1pc3Npb25zLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgfSkpO1xuXG4gICAgICAvLyDjg6/jg7zjgq/jg5Xjg63jg7zlrprnvqnjga7kvZzmiJBcbiAgICAgIGNvbnN0IGRlZmluaXRpb24gPSB0aGlzLmNyZWF0ZVdvcmtmbG93RGVmaW5pdGlvbihwcm9wcywgaW5kZXgpO1xuXG4gICAgICBjb25zdCBzdGF0ZU1hY2hpbmUgPSBuZXcgc3RlcGZ1bmN0aW9ucy5TdGF0ZU1hY2hpbmUodGhpcywgYFN0YXRlTWFjaGluZSR7aW5kZXh9YCwge1xuICAgICAgICBzdGF0ZU1hY2hpbmVOYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tJHt3b3JrZmxvd0NvbmZpZy5uYW1lfWAsXG4gICAgICAgIGRlZmluaXRpb246IGRlZmluaXRpb24sXG4gICAgICAgIHJvbGU6IHJvbGUsXG4gICAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMocHJvcHMuc2VydmVybGVzcy5zdGVwRnVuY3Rpb25zLmV4ZWN1dGlvbi50aW1lb3V0KSxcbiAgICAgICAgbG9nczoge1xuICAgICAgICAgIGRlc3RpbmF0aW9uOiBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCBgU3RlcEZ1bmN0aW9uc0xvZ0dyb3VwJHtpbmRleH1gLCB7XG4gICAgICAgICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL3N0ZXBmdW5jdGlvbnMvJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tJHt3b3JrZmxvd0NvbmZpZy5uYW1lfWAsXG4gICAgICAgICAgICByZXRlbnRpb246IHRoaXMuZ2V0TG9nUmV0ZW50aW9uKHByb3BzLnNlcnZlcmxlc3MubW9uaXRvcmluZy5jbG91ZFdhdGNoLmxvZ1JldGVudGlvbkRheXMpLFxuICAgICAgICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIGxldmVsOiBzdGVwZnVuY3Rpb25zLkxvZ0xldmVsLkFMTCxcbiAgICAgICAgfSxcbiAgICAgICAgdHJhY2luZ0VuYWJsZWQ6IHByb3BzLnNlcnZlcmxlc3MubW9uaXRvcmluZy54cmF5LmVuYWJsZWQsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5zdGF0ZU1hY2hpbmVzLnB1c2goc3RhdGVNYWNoaW5lKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6/jg7zjgq/jg5Xjg63jg7zlrprnvqnjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlV29ya2Zsb3dEZWZpbml0aW9uKHByb3BzOiBGc3hTZXJ2ZXJsZXNzSW50ZWdyYXRpb25Qcm9wcywgaW5kZXg6IG51bWJlcik6IHN0ZXBmdW5jdGlvbnMuSUNoYWluYWJsZSB7XG4gICAgY29uc3Qgc3RhcnRTdGF0ZSA9IG5ldyBzdGVwZnVuY3Rpb25zLlBhc3ModGhpcywgYFN0YXJ0U3RhdGUke2luZGV4fWAsIHtcbiAgICAgIGNvbW1lbnQ6ICdGU3gtU2VydmVybGVzc+e1seWQiOODr+ODvOOCr+ODleODreODvOOBrumWi+WniycsXG4gICAgICByZXN1bHQ6IHN0ZXBmdW5jdGlvbnMuUmVzdWx0LmZyb21PYmplY3Qoe1xuICAgICAgICBtZXNzYWdlOiAnV29ya2Zsb3cgc3RhcnRlZCcsXG4gICAgICAgIHRpbWVzdGFtcDogc3RlcGZ1bmN0aW9ucy5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRh6Zai5pWw44GM5a2Y5Zyo44GZ44KL5aC05ZCI44Gv5ZG844Gz5Ye644GX44K/44K544Kv44KS6L+95YqgXG4gICAgaWYgKHRoaXMubGFtYmRhRnVuY3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGxhbWJkYVRhc2sgPSBuZXcgc2ZuVGFza3MuTGFtYmRhSW52b2tlKHRoaXMsIGBMYW1iZGFUYXNrJHtpbmRleH1gLCB7XG4gICAgICAgIGxhbWJkYUZ1bmN0aW9uOiB0aGlzLmxhbWJkYUZ1bmN0aW9uc1swXSxcbiAgICAgICAgY29tbWVudDogJ0ZTeOODh+ODvOOCv+WHpueQhkxhbWJkYemWouaVsOOBruWun+ihjCcsXG4gICAgICAgIHJldHJ5T25TZXJ2aWNlRXhjZXB0aW9uczogdHJ1ZSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBlbmRTdGF0ZSA9IG5ldyBzdGVwZnVuY3Rpb25zLlBhc3ModGhpcywgYEVuZFN0YXRlJHtpbmRleH1gLCB7XG4gICAgICAgIGNvbW1lbnQ6ICfjg6/jg7zjgq/jg5Xjg63jg7zlrozkuoYnLFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBzdGFydFN0YXRlLm5leHQobGFtYmRhVGFzaykubmV4dChlbmRTdGF0ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXJ0U3RhdGU7XG4gIH1cblxuICAvKipcbiAgICogRXZlbnRCcmlkZ2Xjg6vjg7zjg6vjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRXZlbnRCcmlkZ2VSdWxlcyhwcm9wczogRnN4U2VydmVybGVzc0ludGVncmF0aW9uUHJvcHMpOiB2b2lkIHtcbiAgICBwcm9wcy5zZXJ2ZXJsZXNzLmV2ZW50QnJpZGdlLnJ1bGVzLmZvckVhY2goKHJ1bGVDb25maWcsIGluZGV4KSA9PiB7XG4gICAgICBpZiAoIXJ1bGVDb25maWcuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICBjb25zdCBydWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsIGBFdmVudFJ1bGUke2luZGV4fWAsIHtcbiAgICAgICAgcnVsZU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS0ke3J1bGVDb25maWcubmFtZX1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogYEZTeC1TZXJ2ZXJsZXNz57Wx5ZCI44Kk44OZ44Oz44OI44Or44O844OrOiAke3J1bGVDb25maWcubmFtZX1gLFxuICAgICAgICBldmVudFBhdHRlcm46IHJ1bGVDb25maWcuZXZlbnRQYXR0ZXJuLFxuICAgICAgICBzY2hlZHVsZTogcnVsZUNvbmZpZy5zY2hlZHVsZSA/IGV2ZW50cy5TY2hlZHVsZS5leHByZXNzaW9uKHJ1bGVDb25maWcuc2NoZWR1bGUuZXhwcmVzc2lvbikgOiB1bmRlZmluZWQsXG4gICAgICB9KTtcblxuICAgICAgLy8g44K/44O844Ky44OD44OI44Gu6L+95YqgXG4gICAgICBpZiAodGhpcy5zdGF0ZU1hY2hpbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuU2ZuU3RhdGVNYWNoaW5lKHRoaXMuc3RhdGVNYWNoaW5lc1swXSkpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5sYW1iZGFGdW5jdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICBydWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLmxhbWJkYUZ1bmN0aW9uc1swXSkpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5xdWV1ZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBydWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5TcXNRdWV1ZSh0aGlzLnF1ZXVlc1swXSkpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmV2ZW50UnVsZXMucHVzaChydWxlKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDntbHlkIjjga7oqK3lrppcbiAgICovXG4gIHByaXZhdGUgc2V0dXBJbnRlZ3JhdGlvbihwcm9wczogRnN4U2VydmVybGVzc0ludGVncmF0aW9uUHJvcHMpOiB2b2lkIHtcbiAgICAvLyBMYW1iZGHplqLmlbDjgahTUVPjgq3jg6Xjg7zjga7ntbHlkIhcbiAgICB0aGlzLmxhbWJkYUZ1bmN0aW9ucy5mb3JFYWNoKChmdW5jLCBmdW5jSW5kZXgpID0+IHtcbiAgICAgIHRoaXMucXVldWVzLmZvckVhY2goKHF1ZXVlLCBxdWV1ZUluZGV4KSA9PiB7XG4gICAgICAgIC8vIFNRU+OCpOODmeODs+ODiOOCveODvOOCueOBrui/veWKoFxuICAgICAgICBmdW5jLmFkZEV2ZW50U291cmNlKG5ldyBsYW1iZGFFdmVudFNvdXJjZXMuU3FzRXZlbnRTb3VyY2UocXVldWUsIHtcbiAgICAgICAgICBiYXRjaFNpemU6IDEwLFxuICAgICAgICAgIG1heEJhdGNoaW5nV2luZG93OiBEdXJhdGlvbi5zZWNvbmRzKDUpLFxuICAgICAgICB9KSk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIFNOU+ODiOODlOODg+OCr+OBqExhbWJkYemWouaVsOOBrue1seWQiFxuICAgIHRoaXMudG9waWNzLmZvckVhY2goKHRvcGljLCB0b3BpY0luZGV4KSA9PiB7XG4gICAgICB0aGlzLmxhbWJkYUZ1bmN0aW9ucy5mb3JFYWNoKChmdW5jLCBmdW5jSW5kZXgpID0+IHtcbiAgICAgICAgdG9waWMuYWRkU3Vic2NyaXB0aW9uKG5ldyBzbnNTdWJzY3JpcHRpb25zLkxhbWJkYVN1YnNjcmlwdGlvbihmdW5jKSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6Ljg4vjgr/jg6rjg7PjgrDjga7oqK3lrppcbiAgICovXG4gIHByaXZhdGUgc2V0dXBNb25pdG9yaW5nKHByb3BzOiBGc3hTZXJ2ZXJsZXNzSW50ZWdyYXRpb25Qcm9wcyk6IHZvaWQge1xuICAgIGlmICghcHJvcHMuc2VydmVybGVzcy5tb25pdG9yaW5nLmNsb3VkV2F0Y2guZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgLy8gQ2xvdWRXYXRjaOOCouODqeODvOODoOOBruS9nOaIkFxuICAgIHRoaXMubGFtYmRhRnVuY3Rpb25zLmZvckVhY2goKGZ1bmMsIGluZGV4KSA9PiB7XG4gICAgICAvLyDjgqjjg6njg7znjofjgqLjg6njg7zjg6BcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIGBMYW1iZGFFcnJvckFsYXJtJHtpbmRleH1gLCB7XG4gICAgICAgIGFsYXJtTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWxhbWJkYS1lcnJvcnMtJHtpbmRleH1gLFxuICAgICAgICBtZXRyaWM6IGZ1bmMubWV0cmljRXJyb3JzKHtcbiAgICAgICAgICBwZXJpb2Q6IER1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDUsXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pO1xuXG4gICAgICAvLyDlrp/ooYzmmYLplpPjgqLjg6njg7zjg6BcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIGBMYW1iZGFEdXJhdGlvbkFsYXJtJHtpbmRleH1gLCB7XG4gICAgICAgIGFsYXJtTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWxhbWJkYS1kdXJhdGlvbi0ke2luZGV4fWAsXG4gICAgICAgIG1ldHJpYzogZnVuYy5tZXRyaWNEdXJhdGlvbih7XG4gICAgICAgICAgcGVyaW9kOiBEdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiBmdW5jLnRpbWVvdXQ/LnRvU2Vjb25kcygpID8gZnVuYy50aW1lb3V0LnRvU2Vjb25kcygpICogMC44IDogMjQwLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMyxcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIFN0ZXAgRnVuY3Rpb25z44Gu44Oi44OL44K/44Oq44Oz44KwXG4gICAgdGhpcy5zdGF0ZU1hY2hpbmVzLmZvckVhY2goKHNtLCBpbmRleCkgPT4ge1xuICAgICAgbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgYFN0ZXBGdW5jdGlvbnNGYWlsZWRBbGFybSR7aW5kZXh9YCwge1xuICAgICAgICBhbGFybU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1zdGVwZnVuY3Rpb25zLWZhaWxlZC0ke2luZGV4fWAsXG4gICAgICAgIG1ldHJpYzogc20ubWV0cmljRmFpbGVkKHtcbiAgICAgICAgICBwZXJpb2Q6IER1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDEsXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCv+OCsOOBrumBqeeUqFxuICAgKi9cbiAgcHJpdmF0ZSBhcHBseVRhZ3ModGFncz86IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0pOiB2b2lkIHtcbiAgICBpZiAoIXRhZ3MpIHJldHVybjtcblxuICAgIE9iamVjdC5lbnRyaWVzKHRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgLy8gQ0RL44GuVGFnc+OCkuS9v+eUqOOBl+OBpuODquOCveODvOOCueOBq+OCv+OCsOOCkumBqeeUqFxuICAgICAgLy8g5rOo5oSPOiDlgIvliKXjga7jg6rjgr3jg7zjgrnjgavlr77jgZfjgabjgr/jgrDjgpLpgannlKjjgZnjgovloLTlkIjjga/jgIFcbiAgICAgIC8vIOWQhOODquOCveODvOOCueOBrnRhZ3Pjg5fjg63jg5Hjg4bjgqPjgpLkvb/nlKjjgZnjgovlv4XopoHjgYzjgYLjgorjgb7jgZlcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMYW1iZGEgUnVudGltZeOBruWPluW+l1xuICAgKi9cbiAgcHJpdmF0ZSBnZXRMYW1iZGFSdW50aW1lKHJ1bnRpbWVTdHJpbmc6IHN0cmluZyk6IGxhbWJkYS5SdW50aW1lIHtcbiAgICBzd2l0Y2ggKHJ1bnRpbWVTdHJpbmcpIHtcbiAgICAgIGNhc2UgJ3B5dGhvbjMuOSc6XG4gICAgICAgIHJldHVybiBsYW1iZGEuUnVudGltZS5QWVRIT05fM185O1xuICAgICAgY2FzZSAncHl0aG9uMy4xMCc6XG4gICAgICAgIHJldHVybiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMDtcbiAgICAgIGNhc2UgJ3B5dGhvbjMuMTEnOlxuICAgICAgICByZXR1cm4gbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTE7XG4gICAgICBjYXNlICdub2RlanMxOC54JzpcbiAgICAgICAgcmV0dXJuIGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YO1xuICAgICAgY2FzZSAnbm9kZWpzMjAueCc6XG4gICAgICAgIHJldHVybiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWDtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBsYW1iZGEuUnVudGltZS5QWVRIT05fM185O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg63jgrDkv53mjIHmnJ/plpPjga7lj5blvpdcbiAgICovXG4gIHByaXZhdGUgZ2V0TG9nUmV0ZW50aW9uKGRheXM6IG51bWJlcik6IGxvZ3MuUmV0ZW50aW9uRGF5cyB7XG4gICAgc3dpdGNoIChkYXlzKSB7XG4gICAgICBjYXNlIDE6XG4gICAgICAgIHJldHVybiBsb2dzLlJldGVudGlvbkRheXMuT05FX0RBWTtcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgcmV0dXJuIGxvZ3MuUmV0ZW50aW9uRGF5cy5USFJFRV9EQVlTO1xuICAgICAgY2FzZSA1OlxuICAgICAgICByZXR1cm4gbG9ncy5SZXRlbnRpb25EYXlzLkZJVkVfREFZUztcbiAgICAgIGNhc2UgNzpcbiAgICAgICAgcmV0dXJuIGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSztcbiAgICAgIGNhc2UgMTQ6XG4gICAgICAgIHJldHVybiBsb2dzLlJldGVudGlvbkRheXMuVFdPX1dFRUtTO1xuICAgICAgY2FzZSAzMDpcbiAgICAgICAgcmV0dXJuIGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEg7XG4gICAgICBjYXNlIDYwOlxuICAgICAgICByZXR1cm4gbG9ncy5SZXRlbnRpb25EYXlzLlRXT19NT05USFM7XG4gICAgICBjYXNlIDkwOlxuICAgICAgICByZXR1cm4gbG9ncy5SZXRlbnRpb25EYXlzLlRIUkVFX01PTlRIUztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUs7XG4gICAgfVxuICB9XG59Il19