"use strict";
/**
 * FSx統合スタック
 *
 * FSx for ONTAPとサーバレスアーキテクチャの統合機能を提供します。
 * 設定ファイルのfeatureFlagsで機能の有効化/無効化を制御します。
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
exports.FsxIntegrationStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const stepfunctions = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const fsx_serverless_integration_1 = require("../../modules/integration/constructs/fsx-serverless-integration");
/**
 * FSx統合スタック
 *
 * 機能フラグによる制御:
 * - enableFsxIntegration: FSx統合機能全体の有効化
 * - enableFsxServerlessWorkflows: Step Functionsワークフローの有効化
 * - enableFsxEventDriven: EventBridgeイベント駆動処理の有効化
 * - enableFsxBatchProcessing: SQS/SNSバッチ処理の有効化
 */
class FsxIntegrationStack extends cdk.Stack {
    /**
     * FSx統合コンストラクト
     */
    fsxIntegration;
    /**
     * Step Functions ステートマシン
     */
    stateMachines = [];
    /**
     * EventBridge カスタムバス
     */
    eventBus;
    /**
     * SQS キュー
     */
    queues = [];
    /**
     * SNS トピック
     */
    topics = [];
    /**
     * Lambda 関数
     */
    functions = [];
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config, projectName, environment, vpc, privateSubnetIds } = props;
        // FSx統合機能が無効化されている場合はスキップ
        if (!config.features.enableFsxIntegration) {
            console.log('⏭️  FSx Integration機能が無効化されています');
            return;
        }
        console.log('🔗 FSx Integration Stack初期化開始...');
        console.log(`📝 スタック名: ${id}`);
        console.log(`🏷️ FSx統合機能: ${config.features.enableFsxIntegration ? 'Enabled' : 'Disabled'}`);
        // FSx統合設定の構築
        const fsxIntegrationConfig = this.buildFsxIntegrationConfig(config, privateSubnetIds);
        // FSx統合コンストラクトの作成
        if (config.features.enableFsxIntegration) {
            console.log('🗄️ FSx統合コンストラクト作成開始...');
            this.fsxIntegration = new fsx_serverless_integration_1.FsxServerlessIntegrationConstruct(this, 'FsxIntegration', {
                projectName,
                environment,
                fsx: fsxIntegrationConfig.fsx,
                serverless: fsxIntegrationConfig.serverless,
                vpc,
                tags: config.tags
            });
            console.log('✅ FSx統合コンストラクト作成完了');
        }
        // Step Functions ワークフローの作成
        if (config.features.enableFsxServerlessWorkflows) {
            this.createStepFunctionsWorkflows(fsxIntegrationConfig, projectName, environment);
        }
        // EventBridge イベント駆動処理の作成
        if (config.features.enableFsxEventDriven) {
            this.createEventDrivenProcessing(fsxIntegrationConfig, projectName, environment);
        }
        // SQS/SNS バッチ処理の作成
        if (config.features.enableFsxBatchProcessing) {
            this.createBatchProcessing(fsxIntegrationConfig, projectName, environment);
        }
        // Lambda 関数の作成
        this.createLambdaFunctions(fsxIntegrationConfig, vpc, projectName, environment);
        // CloudWatch ログとモニタリング
        this.setupMonitoring(config, projectName, environment);
        // スタック出力の作成
        this.createStackOutputs(projectName, environment);
        console.log('✅ FSx Integration Stack初期化完了');
    }
    /**
     * FSx統合設定の構築
     */
    buildFsxIntegrationConfig(config, privateSubnetIds) {
        return {
            projectName: config.project.name,
            environment: config.environment,
            region: config.region,
            accountId: this.account,
            tags: config.tags,
            fsx: {
                enabled: config.storage.fsxOntap.enabled,
                fileSystems: [
                    {
                        enabled: true,
                        name: `${config.project.name}-${config.environment}-ontap-fs`,
                        storageCapacity: config.storage.fsxOntap.storageCapacity,
                        throughputCapacity: config.storage.fsxOntap.throughputCapacity,
                        deploymentType: config.storage.fsxOntap.deploymentType,
                        storageEfficiency: true,
                        backup: {
                            enabled: true,
                            retentionDays: config.storage.fsxOntap.automaticBackupRetentionDays,
                            dailyAutomaticBackupStartTime: '03:00'
                        },
                        encryption: {
                            enabled: config.security.encryptionAtRest,
                            kmsKeyId: ''
                        },
                        network: {
                            subnetIds: privateSubnetIds.slice(0, 1), // 単一AZの場合は1つのサブネット
                            securityGroupIds: [], // セキュリティグループは後で設定
                            routeTableIds: []
                        }
                    }
                ],
                storageVirtualMachines: [
                    {
                        enabled: true,
                        name: `${config.project.name}-${config.environment}-svm`,
                        rootVolumeSecurityStyle: 'UNIX',
                        activeDirectoryConfiguration: {
                            enabled: false
                        }
                    }
                ],
                volumes: [
                    {
                        enabled: true,
                        name: `${config.project.name}-${config.environment}-data-volume`,
                        sizeInMegabytes: 10240,
                        securityStyle: 'UNIX',
                        ontapVolumeType: 'RW',
                        junctionPath: '/data'
                    }
                ]
            },
            serverless: {
                enabled: true,
                stepFunctions: {
                    enabled: config.features.enableFsxServerlessWorkflows || false,
                    workflows: [
                        {
                            enabled: true,
                            name: `${config.project.name}-${config.environment}-data-processing`,
                            purpose: 'Process FSx data with serverless workflow',
                            role: {
                                permissions: [
                                    'lambda:InvokeFunction',
                                    'fsx:DescribeFileSystems',
                                    's3:GetObject',
                                    's3:PutObject'
                                ]
                            }
                        }
                    ],
                    execution: {
                        timeout: 900,
                        retryAttempts: 3
                    }
                },
                eventBridge: {
                    enabled: config.features.enableFsxEventDriven || false,
                    rules: [
                        {
                            enabled: true,
                            name: `${config.project.name}-${config.environment}-fsx-events`,
                            eventPattern: {
                                source: ['fsx.filesystem'],
                                'detail-type': ['File System State Change']
                            }
                        }
                    ]
                },
                sqs: {
                    enabled: config.features.enableFsxBatchProcessing || false,
                    queues: [
                        {
                            enabled: true,
                            name: `${config.project.name}-${config.environment}-processing-queue`,
                            configuration: {
                                visibilityTimeoutSeconds: 300,
                                messageRetentionPeriod: 1209600,
                                maxReceiveCount: 3
                            }
                        }
                    ]
                },
                sns: {
                    enabled: config.features.enableFsxBatchProcessing || false,
                    topics: [
                        {
                            enabled: true,
                            name: `${config.project.name}-${config.environment}-notifications`,
                            subscriptions: [
                                {
                                    enabled: true,
                                    protocol: 'email',
                                    endpoint: config.monitoring.alarmNotificationEmail
                                }
                            ]
                        }
                    ]
                },
                lambda: {
                    functions: [
                        {
                            enabled: true,
                            name: `${config.project.name}-${config.environment}-fsx-processor`,
                            runtime: 'python3.9',
                            timeout: 300,
                            memorySize: 512,
                            vpc: {
                                enabled: true
                            },
                            fileSystem: {
                                enabled: true
                            },
                            role: {
                                permissions: [
                                    'fsx:DescribeFileSystems',
                                    'dynamodb:GetItem',
                                    'dynamodb:PutItem',
                                    's3:GetObject',
                                    's3:PutObject'
                                ]
                            }
                        }
                    ]
                },
                monitoring: {
                    cloudWatch: {
                        enabled: config.monitoring.enableDetailedMonitoring,
                        logRetentionDays: config.monitoring.logRetentionDays
                    },
                    xray: {
                        enabled: config.monitoring.enableXRayTracing
                    }
                }
            }
        };
    }
    /**
     * Step Functions ワークフローの作成
     */
    createStepFunctionsWorkflows(fsxConfig, projectName, environment) {
        console.log('🔄 Step Functions ワークフロー作成開始...');
        if (!fsxConfig.serverless.stepFunctions.enabled) {
            console.log('⏭️  Step Functions機能が無効化されています');
            return;
        }
        // データ処理ワークフローの定義
        const startState = new stepfunctions.Pass(this, 'StartProcessing', {
            comment: 'FSx Data Processing Workflow Start',
            result: stepfunctions.Result.fromObject({
                message: 'Processing started',
                timestamp: stepfunctions.JsonPath.stringAt('$$.State.EnteredTime')
            })
        });
        const processState = new stepfunctions.Pass(this, 'ProcessData', {
            comment: 'Process FSx data',
            result: stepfunctions.Result.fromObject({
                status: 'processing',
                data: stepfunctions.JsonPath.stringAt('$.input')
            })
        });
        const completeState = new stepfunctions.Pass(this, 'Complete', {
            comment: 'Processing complete',
            result: stepfunctions.Result.fromObject({
                status: 'completed',
                timestamp: stepfunctions.JsonPath.stringAt('$$.State.EnteredTime')
            })
        });
        // ワークフロー定義の構築
        const definition = startState
            .next(processState)
            .next(completeState);
        // ステートマシンの作成
        const stateMachine = new stepfunctions.StateMachine(this, 'DataProcessingWorkflow', {
            stateMachineName: `${projectName}-${environment}-fsx-data-processing`,
            definition: definition,
            timeout: cdk.Duration.seconds(fsxConfig.serverless.stepFunctions.execution.timeout),
            logs: {
                destination: new logs.LogGroup(this, 'WorkflowLogGroup', {
                    logGroupName: `/aws/stepfunctions/${projectName}-${environment}-fsx-workflow`,
                    retention: logs.RetentionDays.ONE_WEEK
                }),
                level: stepfunctions.LogLevel.ALL
            }
        });
        this.stateMachines.push(stateMachine);
        console.log('✅ Step Functions ワークフロー作成完了');
    }
    /**
     * EventBridge イベント駆動処理の作成
     */
    createEventDrivenProcessing(fsxConfig, projectName, environment) {
        console.log('📡 EventBridge イベント駆動処理作成開始...');
        if (!fsxConfig.serverless.eventBridge.enabled) {
            console.log('⏭️  EventBridge機能が無効化されています');
            return;
        }
        // カスタムイベントバスの作成
        const eventBus = new events.EventBus(this, 'FsxEventBus', {
            eventBusName: `${projectName}-${environment}-fsx-events`
        });
        // readonlyプロパティに代入するため、型アサーションを使用
        this.eventBus = eventBus;
        console.log('✅ EventBridge イベント駆動処理作成完了');
    }
    /**
     * SQS/SNS バッチ処理の作成
     */
    createBatchProcessing(fsxConfig, projectName, environment) {
        console.log('📦 SQS/SNS バッチ処理作成開始...');
        if (!fsxConfig.serverless.sqs.enabled && !fsxConfig.serverless.sns.enabled) {
            console.log('⏭️  SQS/SNS機能が無効化されています');
            return;
        }
        // SQS キューの作成
        if (fsxConfig.serverless.sqs.enabled) {
            fsxConfig.serverless.sqs.queues.forEach((queueConfig, index) => {
                if (!queueConfig.enabled)
                    return;
                const queue = new sqs.Queue(this, `ProcessingQueue${index}`, {
                    queueName: queueConfig.name,
                    visibilityTimeout: cdk.Duration.seconds(queueConfig.configuration.visibilityTimeoutSeconds),
                    retentionPeriod: cdk.Duration.seconds(queueConfig.configuration.messageRetentionPeriod),
                    deadLetterQueue: {
                        queue: new sqs.Queue(this, `ProcessingDLQ${index}`, {
                            queueName: `${queueConfig.name}-dlq`
                        }),
                        maxReceiveCount: queueConfig.configuration.maxReceiveCount
                    }
                });
                this.queues.push(queue);
            });
        }
        // SNS トピックの作成
        if (fsxConfig.serverless.sns.enabled) {
            fsxConfig.serverless.sns.topics.forEach((topicConfig, index) => {
                if (!topicConfig.enabled)
                    return;
                const topic = new sns.Topic(this, `NotificationTopic${index}`, {
                    topicName: topicConfig.name,
                    displayName: `FSx Integration Notifications - ${environment}`
                });
                this.topics.push(topic);
            });
        }
        console.log('✅ SQS/SNS バッチ処理作成完了');
    }
    /**
     * Lambda 関数の作成
     */
    createLambdaFunctions(fsxConfig, vpc, projectName, environment) {
        console.log('⚡ Lambda 関数作成開始...');
        fsxConfig.serverless.lambda.functions.forEach((funcConfig, index) => {
            if (!funcConfig.enabled)
                return;
            // Lambda実行ロールの作成
            const role = new iam.Role(this, `LambdaRole${index}`, {
                assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
                managedPolicies: [
                    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
                ],
                inlinePolicies: {
                    FsxAccess: new iam.PolicyDocument({
                        statements: funcConfig.role.permissions.map((permission) => new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [permission],
                            resources: ['*']
                        }))
                    })
                }
            });
            // Lambda関数の作成（64文字制限対応）
            const shortFunctionName = `${projectName.substring(0, 15)}-${environment}-${funcConfig.name.substring(0, 20)}`;
            const lambdaFunction = new lambda.Function(this, `Function${index}`, {
                functionName: shortFunctionName,
                runtime: lambda.Runtime.PYTHON_3_9,
                handler: 'index.handler',
                code: lambda.Code.fromInline(`
import json
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    FSx統合Lambda関数
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    # FSxファイルシステム情報の取得
    fsx_client = boto3.client('fsx')
    
    try:
        # ファイルシステム一覧の取得
        response = fsx_client.describe_file_systems()
        file_systems = response.get('FileSystems', [])
        
        logger.info(f"Found {len(file_systems)} FSx file systems")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'FSx integration function executed successfully',
                'fileSystems': len(file_systems),
                'event': event
            })
        }
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }
        `),
                timeout: cdk.Duration.seconds(funcConfig.timeout),
                memorySize: funcConfig.memorySize,
                role: role,
                vpc: funcConfig.vpc.enabled ? vpc : undefined,
                tracing: fsxConfig.serverless.monitoring.xray.enabled ?
                    lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
                environment: {
                    PROJECT_NAME: projectName,
                    ENVIRONMENT: environment,
                    LOG_LEVEL: 'INFO'
                }
            });
            this.functions.push(lambdaFunction);
        });
        console.log('✅ Lambda 関数作成完了');
    }
    /**
     * CloudWatch ログとモニタリングの設定
     */
    setupMonitoring(config, projectName, environment) {
        if (!config.monitoring.enableDetailedMonitoring) {
            console.log('⏭️  詳細モニタリングが無効化されています');
            return;
        }
        console.log('📊 CloudWatch モニタリング設定開始...');
        // FSx統合用ロググループの作成
        new logs.LogGroup(this, 'FsxIntegrationLogGroup', {
            logGroupName: `/aws/fsx-integration/${projectName}-${environment}`,
            retention: logs.RetentionDays.ONE_WEEK
        });
        console.log('✅ CloudWatch モニタリング設定完了');
    }
    /**
     * スタック出力の作成
     */
    createStackOutputs(projectName, environment) {
        console.log('📤 FSx Integration Stack出力値作成開始...');
        // FSx統合コンストラクトの出力
        if (this.fsxIntegration) {
            new cdk.CfnOutput(this, 'FsxIntegrationEnabled', {
                value: 'true',
                description: 'FSx Integration feature is enabled'
            });
        }
        // Step Functions ステートマシンの出力
        this.stateMachines.forEach((stateMachine, index) => {
            new cdk.CfnOutput(this, `StateMachine${index}Arn`, {
                value: stateMachine.stateMachineArn,
                description: `Step Functions State Machine ${index} ARN`
            });
        });
        // EventBridge カスタムバスの出力
        if (this.eventBus) {
            new cdk.CfnOutput(this, 'EventBusArn', {
                value: this.eventBus.eventBusArn,
                description: 'FSx Integration EventBridge Custom Bus ARN'
            });
        }
        // Lambda 関数の出力
        this.functions.forEach((func, index) => {
            new cdk.CfnOutput(this, `Function${index}Arn`, {
                value: func.functionArn,
                description: `FSx Integration Lambda Function ${index} ARN`
            });
        });
        console.log('📤 FSx Integration Stack出力値作成完了');
    }
}
exports.FsxIntegrationStack = FsxIntegrationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnN4LWludGVncmF0aW9uLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZnN4LWludGVncmF0aW9uLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFFbkMsNkVBQStEO0FBQy9ELCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MsMkRBQTZDO0FBRzdDLGdIQUFvSDtBQWtDcEg7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFhLG1CQUFvQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2hEOztPQUVHO0lBQ2EsY0FBYyxDQUFxQztJQUVuRTs7T0FFRztJQUNhLGFBQWEsR0FBaUMsRUFBRSxDQUFDO0lBRWpFOztPQUVHO0lBQ2EsUUFBUSxDQUFtQjtJQUUzQzs7T0FFRztJQUNhLE1BQU0sR0FBZ0IsRUFBRSxDQUFDO0lBRXpDOztPQUVHO0lBQ2EsTUFBTSxHQUFnQixFQUFFLENBQUM7SUFFekM7O09BRUc7SUFDYSxTQUFTLEdBQXNCLEVBQUUsQ0FBQztJQUVsRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQStCO1FBQ3ZFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxHQUFHLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFMUUsMEJBQTBCO1FBQzFCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1lBQy9DLE9BQU87UUFDVCxDQUFDO1FBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO1FBQ2hELE9BQU8s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RSxFQUFFO1lBQ2pELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxLQUFLLEtBQUssRUFBRTtnQkFDakQsS0FBSyxFQUFFLFlBQVksQ0FBQyxlQUFlO2dCQUNuQyxXQUFXLEVBQUUsZ0NBQWdDLEtBQUssTUFBTTthQUN6RCxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztRQUVILHdCQUF3QjtRQUN4QixJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNsQixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtnQkFDckMsS0FBSyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVztnQkFDaEMsV0FBVyxFQUFFLDRDQUE0QzthQUMxRCxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsZUFBZTtRQUNmLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ3JDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxLQUFLLEtBQUssRUFBRTtnQkFDN0MsS0FBSyxFQUFFLElBQUksQ0FBQyxXQUFXO2dCQUN2QixXQUFXLEVBQUUsbUNBQW1DLEtBQUssTUFBTTthQUM1RCxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxHQUFHLENBQUMsaUNBQWlDLENBQUMsQ0FBQztJQUNqRCxDQUFDO0NBQ0Y7QUFoakJELGtEQWdqQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZTeOe1seWQiOOCueOCv+ODg+OCr1xuICogXG4gKiBGU3ggZm9yIE9OVEFQ44Go44K144O844OQ44Os44K544Ki44O844Kt44OG44Kv44OB44Oj44Gu57Wx5ZCI5qmf6IO944KS5o+Q5L6b44GX44G+44GZ44CCXG4gKiDoqK3lrprjg5XjgqHjgqTjg6vjga5mZWF0dXJlRmxhZ3PjgafmqZ/og73jga7mnInlirnljJYv54Sh5Yq55YyW44KS5Yi25b6h44GX44G+44GZ44CCXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIHN0ZXBmdW5jdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zcXMnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vLi4vY29uZmlnL2ludGVyZmFjZXMvZW52aXJvbm1lbnQtY29uZmlnJztcbmltcG9ydCB7IEZzeFNlcnZlcmxlc3NJbnRlZ3JhdGlvbkNvbnN0cnVjdCB9IGZyb20gJy4uLy4uL21vZHVsZXMvaW50ZWdyYXRpb24vY29uc3RydWN0cy9mc3gtc2VydmVybGVzcy1pbnRlZ3JhdGlvbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRnN4SW50ZWdyYXRpb25TdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICAvKipcbiAgICog55Kw5aKD6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBjb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xuXG4gIC8qKlxuICAgKiDjg5fjg63jgrjjgqfjgq/jg4jlkI1cbiAgICovXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOeSsOWig+WQjVxuICAgKi9cbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcblxuICAvKipcbiAgICogVlBD77yITmV0d29ya2luZ1N0YWNr44GL44KJ5Y+W5b6X77yJXG4gICAqL1xuICByZWFkb25seSB2cGM6IGVjMi5JVnBjO1xuXG4gIC8qKlxuICAgKiDjg5fjg6njgqTjg5njg7zjg4jjgrXjg5bjg43jg4Pjg4hJRO+8iERhdGFTdGFja+OBi+OCieWPluW+l++8iVxuICAgKi9cbiAgcmVhZG9ubHkgcHJpdmF0ZVN1Ym5ldElkczogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIOOCu+OCreODpeODquODhuOCo+OCueOCv+ODg+OCr++8iFNlY3VyaXR5U3RhY2vjgYvjgonlj5blvpfjgIHjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICovXG4gIHJlYWRvbmx5IHNlY3VyaXR5U3RhY2s/OiBhbnk7XG59XG5cbi8qKlxuICogRlN457Wx5ZCI44K544K/44OD44KvXG4gKiBcbiAqIOapn+iDveODleODqeOCsOOBq+OCiOOCi+WItuW+oTpcbiAqIC0gZW5hYmxlRnN4SW50ZWdyYXRpb246IEZTeOe1seWQiOapn+iDveWFqOS9k+OBruacieWKueWMllxuICogLSBlbmFibGVGc3hTZXJ2ZXJsZXNzV29ya2Zsb3dzOiBTdGVwIEZ1bmN0aW9uc+ODr+ODvOOCr+ODleODreODvOOBruacieWKueWMllxuICogLSBlbmFibGVGc3hFdmVudERyaXZlbjogRXZlbnRCcmlkZ2XjgqTjg5njg7Pjg4jpp4bli5Xlh6bnkIbjga7mnInlirnljJZcbiAqIC0gZW5hYmxlRnN4QmF0Y2hQcm9jZXNzaW5nOiBTUVMvU05T44OQ44OD44OB5Yem55CG44Gu5pyJ5Yq55YyWXG4gKi9cbmV4cG9ydCBjbGFzcyBGc3hJbnRlZ3JhdGlvblN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgLyoqXG4gICAqIEZTeOe1seWQiOOCs+ODs+OCueODiOODqeOCr+ODiFxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGZzeEludGVncmF0aW9uPzogRnN4U2VydmVybGVzc0ludGVncmF0aW9uQ29uc3RydWN0O1xuXG4gIC8qKlxuICAgKiBTdGVwIEZ1bmN0aW9ucyDjgrnjg4bjg7zjg4jjg57jgrfjg7NcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBzdGF0ZU1hY2hpbmVzOiBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZVtdID0gW107XG5cbiAgLyoqXG4gICAqIEV2ZW50QnJpZGdlIOOCq+OCueOCv+ODoOODkOOCuVxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGV2ZW50QnVzPzogZXZlbnRzLkV2ZW50QnVzO1xuXG4gIC8qKlxuICAgKiBTUVMg44Kt44Ol44O8XG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgcXVldWVzOiBzcXMuUXVldWVbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBTTlMg44OI44OU44OD44KvXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgdG9waWNzOiBzbnMuVG9waWNbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBMYW1iZGEg6Zai5pWwXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZnVuY3Rpb25zOiBsYW1iZGEuRnVuY3Rpb25bXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBGc3hJbnRlZ3JhdGlvblN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgY29uZmlnLCBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQsIHZwYywgcHJpdmF0ZVN1Ym5ldElkcyB9ID0gcHJvcHM7XG5cbiAgICAvLyBGU3jntbHlkIjmqZ/og73jgYznhKHlirnljJbjgZXjgozjgabjgYTjgovloLTlkIjjga/jgrnjgq3jg4Pjg5dcbiAgICBpZiAoIWNvbmZpZy5mZWF0dXJlcy5lbmFibGVGc3hJbnRlZ3JhdGlvbikge1xuICAgICAgY29uc29sZS5sb2coJ+KPre+4jyAgRlN4IEludGVncmF0aW9u5qmf6IO944GM54Sh5Yq55YyW44GV44KM44Gm44GE44G+44GZJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ/CflJcgRlN4IEludGVncmF0aW9uIFN0YWNr5Yid5pyf5YyW6ZaL5aeLLi4uJyk7XG4gICAgY29uc29sZS5sb2coYPCfk50g44K544K/44OD44Kv5ZCNOiAke2lkfWApO1xuICAgIGNvbnNvbGUubG9nKGDwn4+377iPIEZTeOe1seWQiOapn+iDvTogJHtjb25maWcuZmVhdHVyZXMuZW5hYmxlRnN4SW50ZWdyYXRpb24gPyAnRW5hYmxlZCcgOiAnRGlzYWJsZWQnfWApO1xuXG4gICAgLy8gRlN457Wx5ZCI6Kit5a6a44Gu5qeL56+JXG4gICAgY29uc3QgZnN4SW50ZWdyYXRpb25Db25maWcgPSB0aGlzLmJ1aWxkRnN4SW50ZWdyYXRpb25Db25maWcoY29uZmlnLCBwcml2YXRlU3VibmV0SWRzKTtcblxuICAgIC8vIEZTeOe1seWQiOOCs+ODs+OCueODiOODqeOCr+ODiOOBruS9nOaIkFxuICAgIGlmIChjb25maWcuZmVhdHVyZXMuZW5hYmxlRnN4SW50ZWdyYXRpb24pIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5eE77iPIEZTeOe1seWQiOOCs+ODs+OCueODiOODqeOCr+ODiOS9nOaIkOmWi+Wniy4uLicpO1xuICAgICAgXG4gICAgICB0aGlzLmZzeEludGVncmF0aW9uID0gbmV3IEZzeFNlcnZlcmxlc3NJbnRlZ3JhdGlvbkNvbnN0cnVjdCh0aGlzLCAnRnN4SW50ZWdyYXRpb24nLCB7XG4gICAgICAgIHByb2plY3ROYW1lLFxuICAgICAgICBlbnZpcm9ubWVudCxcbiAgICAgICAgZnN4OiBmc3hJbnRlZ3JhdGlvbkNvbmZpZy5mc3ghLFxuICAgICAgICBzZXJ2ZXJsZXNzOiBmc3hJbnRlZ3JhdGlvbkNvbmZpZy5zZXJ2ZXJsZXNzISxcbiAgICAgICAgdnBjLFxuICAgICAgICB0YWdzOiBjb25maWcudGFncyBhcyB1bmtub3duIGFzIHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH1cbiAgICAgIH0pO1xuXG4gICAgICBjb25zb2xlLmxvZygn4pyFIEZTeOe1seWQiOOCs+ODs+OCueODiOODqeOCr+ODiOS9nOaIkOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIFN0ZXAgRnVuY3Rpb25zIOODr+ODvOOCr+ODleODreODvOOBruS9nOaIkFxuICAgIGlmIChjb25maWcuZmVhdHVyZXMuZW5hYmxlRnN4U2VydmVybGVzc1dvcmtmbG93cykge1xuICAgICAgdGhpcy5jcmVhdGVTdGVwRnVuY3Rpb25zV29ya2Zsb3dzKGZzeEludGVncmF0aW9uQ29uZmlnLCBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQpO1xuICAgIH1cblxuICAgIC8vIEV2ZW50QnJpZGdlIOOCpOODmeODs+ODiOmnhuWLleWHpueQhuOBruS9nOaIkFxuICAgIGlmIChjb25maWcuZmVhdHVyZXMuZW5hYmxlRnN4RXZlbnREcml2ZW4pIHtcbiAgICAgIHRoaXMuY3JlYXRlRXZlbnREcml2ZW5Qcm9jZXNzaW5nKGZzeEludGVncmF0aW9uQ29uZmlnLCBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQpO1xuICAgIH1cblxuICAgIC8vIFNRUy9TTlMg44OQ44OD44OB5Yem55CG44Gu5L2c5oiQXG4gICAgaWYgKGNvbmZpZy5mZWF0dXJlcy5lbmFibGVGc3hCYXRjaFByb2Nlc3NpbmcpIHtcbiAgICAgIHRoaXMuY3JlYXRlQmF0Y2hQcm9jZXNzaW5nKGZzeEludGVncmF0aW9uQ29uZmlnLCBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQpO1xuICAgIH1cblxuICAgIC8vIExhbWJkYSDplqLmlbDjga7kvZzmiJBcbiAgICB0aGlzLmNyZWF0ZUxhbWJkYUZ1bmN0aW9ucyhmc3hJbnRlZ3JhdGlvbkNvbmZpZywgdnBjLCBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCDjg63jgrDjgajjg6Ljg4vjgr/jg6rjg7PjgrBcbiAgICB0aGlzLnNldHVwTW9uaXRvcmluZyhjb25maWcsIHByb2plY3ROYW1lLCBlbnZpcm9ubWVudCk7XG5cbiAgICAvLyDjgrnjgr/jg4Pjgq/lh7rlipvjga7kvZzmiJBcbiAgICB0aGlzLmNyZWF0ZVN0YWNrT3V0cHV0cyhwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBGU3ggSW50ZWdyYXRpb24gU3RhY2vliJ3mnJ/ljJblrozkuoYnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGU3jntbHlkIjoqK3lrprjga7mp4vnr4lcbiAgICovXG4gIHByaXZhdGUgYnVpbGRGc3hJbnRlZ3JhdGlvbkNvbmZpZyhjb25maWc6IEVudmlyb25tZW50Q29uZmlnLCBwcml2YXRlU3VibmV0SWRzOiBzdHJpbmdbXSkge1xuICAgIHJldHVybiB7XG4gICAgICBwcm9qZWN0TmFtZTogY29uZmlnLnByb2plY3QubmFtZSxcbiAgICAgIGVudmlyb25tZW50OiBjb25maWcuZW52aXJvbm1lbnQsXG4gICAgICByZWdpb246IGNvbmZpZy5yZWdpb24sXG4gICAgICBhY2NvdW50SWQ6IHRoaXMuYWNjb3VudCxcbiAgICAgIHRhZ3M6IGNvbmZpZy50YWdzIGFzIHVua25vd24gYXMgeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSxcbiAgICAgIGZzeDoge1xuICAgICAgICBlbmFibGVkOiBjb25maWcuc3RvcmFnZS5mc3hPbnRhcC5lbmFibGVkLFxuICAgICAgICBmaWxlU3lzdGVtczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBuYW1lOiBgJHtjb25maWcucHJvamVjdC5uYW1lfS0ke2NvbmZpZy5lbnZpcm9ubWVudH0tb250YXAtZnNgLFxuICAgICAgICAgICAgc3RvcmFnZUNhcGFjaXR5OiBjb25maWcuc3RvcmFnZS5mc3hPbnRhcC5zdG9yYWdlQ2FwYWNpdHksXG4gICAgICAgICAgICB0aHJvdWdocHV0Q2FwYWNpdHk6IGNvbmZpZy5zdG9yYWdlLmZzeE9udGFwLnRocm91Z2hwdXRDYXBhY2l0eSxcbiAgICAgICAgICAgIGRlcGxveW1lbnRUeXBlOiBjb25maWcuc3RvcmFnZS5mc3hPbnRhcC5kZXBsb3ltZW50VHlwZSBhcyAnU0lOR0xFX0FaXzEnIHwgJ01VTFRJX0FaXzEnLFxuICAgICAgICAgICAgc3RvcmFnZUVmZmljaWVuY3k6IHRydWUsXG4gICAgICAgICAgICBiYWNrdXA6IHtcbiAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgcmV0ZW50aW9uRGF5czogY29uZmlnLnN0b3JhZ2UuZnN4T250YXAuYXV0b21hdGljQmFja3VwUmV0ZW50aW9uRGF5cyxcbiAgICAgICAgICAgICAgZGFpbHlBdXRvbWF0aWNCYWNrdXBTdGFydFRpbWU6ICcwMzowMCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbmNyeXB0aW9uOiB7XG4gICAgICAgICAgICAgIGVuYWJsZWQ6IGNvbmZpZy5zZWN1cml0eS5lbmNyeXB0aW9uQXRSZXN0LFxuICAgICAgICAgICAgICBrbXNLZXlJZDogJydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBuZXR3b3JrOiB7XG4gICAgICAgICAgICAgIHN1Ym5ldElkczogcHJpdmF0ZVN1Ym5ldElkcy5zbGljZSgwLCAxKSwgLy8g5Y2Y5LiAQVrjga7loLTlkIjjga8x44Gk44Gu44K144OW44ON44OD44OIXG4gICAgICAgICAgICAgIHNlY3VyaXR5R3JvdXBJZHM6IFtdLCAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5fjga/lvozjgafoqK3lrppcbiAgICAgICAgICAgICAgcm91dGVUYWJsZUlkczogW11cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIF0sXG4gICAgICAgIHN0b3JhZ2VWaXJ0dWFsTWFjaGluZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbmFtZTogYCR7Y29uZmlnLnByb2plY3QubmFtZX0tJHtjb25maWcuZW52aXJvbm1lbnR9LXN2bWAsXG4gICAgICAgICAgICByb290Vm9sdW1lU2VjdXJpdHlTdHlsZTogJ1VOSVgnIGFzIGNvbnN0LFxuICAgICAgICAgICAgYWN0aXZlRGlyZWN0b3J5Q29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICBlbmFibGVkOiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgXSxcbiAgICAgICAgdm9sdW1lczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBuYW1lOiBgJHtjb25maWcucHJvamVjdC5uYW1lfS0ke2NvbmZpZy5lbnZpcm9ubWVudH0tZGF0YS12b2x1bWVgLFxuICAgICAgICAgICAgc2l6ZUluTWVnYWJ5dGVzOiAxMDI0MCxcbiAgICAgICAgICAgIHNlY3VyaXR5U3R5bGU6ICdVTklYJyBhcyBjb25zdCxcbiAgICAgICAgICAgIG9udGFwVm9sdW1lVHlwZTogJ1JXJyBhcyBjb25zdCxcbiAgICAgICAgICAgIGp1bmN0aW9uUGF0aDogJy9kYXRhJ1xuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIHNlcnZlcmxlc3M6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgc3RlcEZ1bmN0aW9uczoge1xuICAgICAgICAgIGVuYWJsZWQ6IGNvbmZpZy5mZWF0dXJlcy5lbmFibGVGc3hTZXJ2ZXJsZXNzV29ya2Zsb3dzIHx8IGZhbHNlLFxuICAgICAgICAgIHdvcmtmbG93czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICBuYW1lOiBgJHtjb25maWcucHJvamVjdC5uYW1lfS0ke2NvbmZpZy5lbnZpcm9ubWVudH0tZGF0YS1wcm9jZXNzaW5nYCxcbiAgICAgICAgICAgICAgcHVycG9zZTogJ1Byb2Nlc3MgRlN4IGRhdGEgd2l0aCBzZXJ2ZXJsZXNzIHdvcmtmbG93JyxcbiAgICAgICAgICAgICAgcm9sZToge1xuICAgICAgICAgICAgICAgIHBlcm1pc3Npb25zOiBbXG4gICAgICAgICAgICAgICAgICAnbGFtYmRhOkludm9rZUZ1bmN0aW9uJyxcbiAgICAgICAgICAgICAgICAgICdmc3g6RGVzY3JpYmVGaWxlU3lzdGVtcycsXG4gICAgICAgICAgICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICdzMzpQdXRPYmplY3QnXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgXSxcbiAgICAgICAgICBleGVjdXRpb246IHtcbiAgICAgICAgICAgIHRpbWVvdXQ6IDkwMCxcbiAgICAgICAgICAgIHJldHJ5QXR0ZW1wdHM6IDNcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGV2ZW50QnJpZGdlOiB7XG4gICAgICAgICAgZW5hYmxlZDogY29uZmlnLmZlYXR1cmVzLmVuYWJsZUZzeEV2ZW50RHJpdmVuIHx8IGZhbHNlLFxuICAgICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIG5hbWU6IGAke2NvbmZpZy5wcm9qZWN0Lm5hbWV9LSR7Y29uZmlnLmVudmlyb25tZW50fS1mc3gtZXZlbnRzYCxcbiAgICAgICAgICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgICAgICAgICAgc291cmNlOiBbJ2ZzeC5maWxlc3lzdGVtJ10sXG4gICAgICAgICAgICAgICAgJ2RldGFpbC10eXBlJzogWydGaWxlIFN5c3RlbSBTdGF0ZSBDaGFuZ2UnXVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9LFxuICAgICAgICBzcXM6IHtcbiAgICAgICAgICBlbmFibGVkOiBjb25maWcuZmVhdHVyZXMuZW5hYmxlRnN4QmF0Y2hQcm9jZXNzaW5nIHx8IGZhbHNlLFxuICAgICAgICAgIHF1ZXVlczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICBuYW1lOiBgJHtjb25maWcucHJvamVjdC5uYW1lfS0ke2NvbmZpZy5lbnZpcm9ubWVudH0tcHJvY2Vzc2luZy1xdWV1ZWAsXG4gICAgICAgICAgICAgIGNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgICB2aXNpYmlsaXR5VGltZW91dFNlY29uZHM6IDMwMCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlUmV0ZW50aW9uUGVyaW9kOiAxMjA5NjAwLFxuICAgICAgICAgICAgICAgIG1heFJlY2VpdmVDb3VudDogM1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9LFxuICAgICAgICBzbnM6IHtcbiAgICAgICAgICBlbmFibGVkOiBjb25maWcuZmVhdHVyZXMuZW5hYmxlRnN4QmF0Y2hQcm9jZXNzaW5nIHx8IGZhbHNlLFxuICAgICAgICAgIHRvcGljczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICBuYW1lOiBgJHtjb25maWcucHJvamVjdC5uYW1lfS0ke2NvbmZpZy5lbnZpcm9ubWVudH0tbm90aWZpY2F0aW9uc2AsXG4gICAgICAgICAgICAgIHN1YnNjcmlwdGlvbnM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgcHJvdG9jb2w6ICdlbWFpbCcsXG4gICAgICAgICAgICAgICAgICBlbmRwb2ludDogY29uZmlnLm1vbml0b3JpbmcuYWxhcm1Ob3RpZmljYXRpb25FbWFpbFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICAgIF1cbiAgICAgICAgfSxcbiAgICAgICAgbGFtYmRhOiB7XG4gICAgICAgICAgZnVuY3Rpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgIG5hbWU6IGAke2NvbmZpZy5wcm9qZWN0Lm5hbWV9LSR7Y29uZmlnLmVudmlyb25tZW50fS1mc3gtcHJvY2Vzc29yYCxcbiAgICAgICAgICAgICAgcnVudGltZTogJ3B5dGhvbjMuOScsXG4gICAgICAgICAgICAgIHRpbWVvdXQ6IDMwMCxcbiAgICAgICAgICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgICAgICAgICB2cGM6IHtcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGZpbGVTeXN0ZW06IHtcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHJvbGU6IHtcbiAgICAgICAgICAgICAgICBwZXJtaXNzaW9uczogW1xuICAgICAgICAgICAgICAgICAgJ2ZzeDpEZXNjcmliZUZpbGVTeXN0ZW1zJyxcbiAgICAgICAgICAgICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJyxcbiAgICAgICAgICAgICAgICAgICdkeW5hbW9kYjpQdXRJdGVtJyxcbiAgICAgICAgICAgICAgICAgICdzMzpHZXRPYmplY3QnLFxuICAgICAgICAgICAgICAgICAgJ3MzOlB1dE9iamVjdCdcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH0sXG4gICAgICAgIG1vbml0b3Jpbmc6IHtcbiAgICAgICAgICBjbG91ZFdhdGNoOiB7XG4gICAgICAgICAgICBlbmFibGVkOiBjb25maWcubW9uaXRvcmluZy5lbmFibGVEZXRhaWxlZE1vbml0b3JpbmcsXG4gICAgICAgICAgICBsb2dSZXRlbnRpb25EYXlzOiBjb25maWcubW9uaXRvcmluZy5sb2dSZXRlbnRpb25EYXlzXG4gICAgICAgICAgfSxcbiAgICAgICAgICB4cmF5OiB7XG4gICAgICAgICAgICBlbmFibGVkOiBjb25maWcubW9uaXRvcmluZy5lbmFibGVYUmF5VHJhY2luZ1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogU3RlcCBGdW5jdGlvbnMg44Ov44O844Kv44OV44Ot44O844Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVN0ZXBGdW5jdGlvbnNXb3JrZmxvd3MoXG4gICAgZnN4Q29uZmlnOiBhbnksXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nXG4gICk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKCfwn5SEIFN0ZXAgRnVuY3Rpb25zIOODr+ODvOOCr+ODleODreODvOS9nOaIkOmWi+Wniy4uLicpO1xuXG4gICAgaWYgKCFmc3hDb25maWcuc2VydmVybGVzcy5zdGVwRnVuY3Rpb25zLmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfij63vuI8gIFN0ZXAgRnVuY3Rpb25z5qmf6IO944GM54Sh5Yq55YyW44GV44KM44Gm44GE44G+44GZJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8g44OH44O844K/5Yem55CG44Ov44O844Kv44OV44Ot44O844Gu5a6a576pXG4gICAgY29uc3Qgc3RhcnRTdGF0ZSA9IG5ldyBzdGVwZnVuY3Rpb25zLlBhc3ModGhpcywgJ1N0YXJ0UHJvY2Vzc2luZycsIHtcbiAgICAgIGNvbW1lbnQ6ICdGU3ggRGF0YSBQcm9jZXNzaW5nIFdvcmtmbG93IFN0YXJ0JyxcbiAgICAgIHJlc3VsdDogc3RlcGZ1bmN0aW9ucy5SZXN1bHQuZnJvbU9iamVjdCh7XG4gICAgICAgIG1lc3NhZ2U6ICdQcm9jZXNzaW5nIHN0YXJ0ZWQnLFxuICAgICAgICB0aW1lc3RhbXA6IHN0ZXBmdW5jdGlvbnMuSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJylcbiAgICAgIH0pXG4gICAgfSk7XG5cbiAgICBjb25zdCBwcm9jZXNzU3RhdGUgPSBuZXcgc3RlcGZ1bmN0aW9ucy5QYXNzKHRoaXMsICdQcm9jZXNzRGF0YScsIHtcbiAgICAgIGNvbW1lbnQ6ICdQcm9jZXNzIEZTeCBkYXRhJyxcbiAgICAgIHJlc3VsdDogc3RlcGZ1bmN0aW9ucy5SZXN1bHQuZnJvbU9iamVjdCh7XG4gICAgICAgIHN0YXR1czogJ3Byb2Nlc3NpbmcnLFxuICAgICAgICBkYXRhOiBzdGVwZnVuY3Rpb25zLkpzb25QYXRoLnN0cmluZ0F0KCckLmlucHV0JylcbiAgICAgIH0pXG4gICAgfSk7XG5cbiAgICBjb25zdCBjb21wbGV0ZVN0YXRlID0gbmV3IHN0ZXBmdW5jdGlvbnMuUGFzcyh0aGlzLCAnQ29tcGxldGUnLCB7XG4gICAgICBjb21tZW50OiAnUHJvY2Vzc2luZyBjb21wbGV0ZScsXG4gICAgICByZXN1bHQ6IHN0ZXBmdW5jdGlvbnMuUmVzdWx0LmZyb21PYmplY3Qoe1xuICAgICAgICBzdGF0dXM6ICdjb21wbGV0ZWQnLFxuICAgICAgICB0aW1lc3RhbXA6IHN0ZXBmdW5jdGlvbnMuSnNvblBhdGguc3RyaW5nQXQoJyQkLlN0YXRlLkVudGVyZWRUaW1lJylcbiAgICAgIH0pXG4gICAgfSk7XG5cbiAgICAvLyDjg6/jg7zjgq/jg5Xjg63jg7zlrprnvqnjga7mp4vnr4lcbiAgICBjb25zdCBkZWZpbml0aW9uID0gc3RhcnRTdGF0ZVxuICAgICAgLm5leHQocHJvY2Vzc1N0YXRlKVxuICAgICAgLm5leHQoY29tcGxldGVTdGF0ZSk7XG5cbiAgICAvLyDjgrnjg4bjg7zjg4jjg57jgrfjg7Pjga7kvZzmiJBcbiAgICBjb25zdCBzdGF0ZU1hY2hpbmUgPSBuZXcgc3RlcGZ1bmN0aW9ucy5TdGF0ZU1hY2hpbmUodGhpcywgJ0RhdGFQcm9jZXNzaW5nV29ya2Zsb3cnLCB7XG4gICAgICBzdGF0ZU1hY2hpbmVOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZnN4LWRhdGEtcHJvY2Vzc2luZ2AsXG4gICAgICBkZWZpbml0aW9uOiBkZWZpbml0aW9uLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoZnN4Q29uZmlnLnNlcnZlcmxlc3Muc3RlcEZ1bmN0aW9ucy5leGVjdXRpb24udGltZW91dCksXG4gICAgICBsb2dzOiB7XG4gICAgICAgIGRlc3RpbmF0aW9uOiBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnV29ya2Zsb3dMb2dHcm91cCcsIHtcbiAgICAgICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL3N0ZXBmdW5jdGlvbnMvJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZnN4LXdvcmtmbG93YCxcbiAgICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFS1xuICAgICAgICB9KSxcbiAgICAgICAgbGV2ZWw6IHN0ZXBmdW5jdGlvbnMuTG9nTGV2ZWwuQUxMXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnN0YXRlTWFjaGluZXMucHVzaChzdGF0ZU1hY2hpbmUpO1xuICAgIGNvbnNvbGUubG9nKCfinIUgU3RlcCBGdW5jdGlvbnMg44Ov44O844Kv44OV44Ot44O85L2c5oiQ5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICogRXZlbnRCcmlkZ2Ug44Kk44OZ44Oz44OI6aeG5YuV5Yem55CG44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUV2ZW50RHJpdmVuUHJvY2Vzc2luZyhcbiAgICBmc3hDb25maWc6IGFueSxcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLFxuICAgIGVudmlyb25tZW50OiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/Cfk6EgRXZlbnRCcmlkZ2Ug44Kk44OZ44Oz44OI6aeG5YuV5Yem55CG5L2c5oiQ6ZaL5aeLLi4uJyk7XG5cbiAgICBpZiAoIWZzeENvbmZpZy5zZXJ2ZXJsZXNzLmV2ZW50QnJpZGdlLmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfij63vuI8gIEV2ZW50QnJpZGdl5qmf6IO944GM54Sh5Yq55YyW44GV44KM44Gm44GE44G+44GZJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8g44Kr44K544K/44Og44Kk44OZ44Oz44OI44OQ44K544Gu5L2c5oiQXG4gICAgY29uc3QgZXZlbnRCdXMgPSBuZXcgZXZlbnRzLkV2ZW50QnVzKHRoaXMsICdGc3hFdmVudEJ1cycsIHtcbiAgICAgIGV2ZW50QnVzTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWZzeC1ldmVudHNgXG4gICAgfSk7XG5cbiAgICAvLyByZWFkb25seeODl+ODreODkeODhuOCo+OBq+S7o+WFpeOBmeOCi+OBn+OCgeOAgeWei+OCouOCteODvOOCt+ODp+ODs+OCkuS9v+eUqFxuICAgICh0aGlzIGFzIGFueSkuZXZlbnRCdXMgPSBldmVudEJ1cztcblxuICAgIGNvbnNvbGUubG9nKCfinIUgRXZlbnRCcmlkZ2Ug44Kk44OZ44Oz44OI6aeG5YuV5Yem55CG5L2c5oiQ5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICogU1FTL1NOUyDjg5Djg4Pjg4Hlh6bnkIbjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQmF0Y2hQcm9jZXNzaW5nKFxuICAgIGZzeENvbmZpZzogYW55LFxuICAgIHByb2plY3ROYW1lOiBzdHJpbmcsXG4gICAgZW52aXJvbm1lbnQ6IHN0cmluZ1xuICApOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZygn8J+TpiBTUVMvU05TIOODkOODg+ODgeWHpueQhuS9nOaIkOmWi+Wniy4uLicpO1xuXG4gICAgaWYgKCFmc3hDb25maWcuc2VydmVybGVzcy5zcXMuZW5hYmxlZCAmJiAhZnN4Q29uZmlnLnNlcnZlcmxlc3Muc25zLmVuYWJsZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfij63vuI8gIFNRUy9TTlPmqZ/og73jgYznhKHlirnljJbjgZXjgozjgabjgYTjgb7jgZknKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTUVMg44Kt44Ol44O844Gu5L2c5oiQXG4gICAgaWYgKGZzeENvbmZpZy5zZXJ2ZXJsZXNzLnNxcy5lbmFibGVkKSB7XG4gICAgICBmc3hDb25maWcuc2VydmVybGVzcy5zcXMucXVldWVzLmZvckVhY2goKHF1ZXVlQ29uZmlnOiBhbnksIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgaWYgKCFxdWV1ZUNvbmZpZy5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgcXVldWUgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsIGBQcm9jZXNzaW5nUXVldWUke2luZGV4fWAsIHtcbiAgICAgICAgICBxdWV1ZU5hbWU6IHF1ZXVlQ29uZmlnLm5hbWUsXG4gICAgICAgICAgdmlzaWJpbGl0eVRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKHF1ZXVlQ29uZmlnLmNvbmZpZ3VyYXRpb24udmlzaWJpbGl0eVRpbWVvdXRTZWNvbmRzKSxcbiAgICAgICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5zZWNvbmRzKHF1ZXVlQ29uZmlnLmNvbmZpZ3VyYXRpb24ubWVzc2FnZVJldGVudGlvblBlcmlvZCksXG4gICAgICAgICAgZGVhZExldHRlclF1ZXVlOiB7XG4gICAgICAgICAgICBxdWV1ZTogbmV3IHNxcy5RdWV1ZSh0aGlzLCBgUHJvY2Vzc2luZ0RMUSR7aW5kZXh9YCwge1xuICAgICAgICAgICAgICBxdWV1ZU5hbWU6IGAke3F1ZXVlQ29uZmlnLm5hbWV9LWRscWBcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbWF4UmVjZWl2ZUNvdW50OiBxdWV1ZUNvbmZpZy5jb25maWd1cmF0aW9uLm1heFJlY2VpdmVDb3VudFxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5xdWV1ZXMucHVzaChxdWV1ZSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBTTlMg44OI44OU44OD44Kv44Gu5L2c5oiQXG4gICAgaWYgKGZzeENvbmZpZy5zZXJ2ZXJsZXNzLnNucy5lbmFibGVkKSB7XG4gICAgICBmc3hDb25maWcuc2VydmVybGVzcy5zbnMudG9waWNzLmZvckVhY2goKHRvcGljQ29uZmlnOiBhbnksIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgaWYgKCF0b3BpY0NvbmZpZy5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgdG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsIGBOb3RpZmljYXRpb25Ub3BpYyR7aW5kZXh9YCwge1xuICAgICAgICAgIHRvcGljTmFtZTogdG9waWNDb25maWcubmFtZSxcbiAgICAgICAgICBkaXNwbGF5TmFtZTogYEZTeCBJbnRlZ3JhdGlvbiBOb3RpZmljYXRpb25zIC0gJHtlbnZpcm9ubWVudH1gXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMudG9waWNzLnB1c2godG9waWMpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ+KchSBTUVMvU05TIOODkOODg+ODgeWHpueQhuS9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIExhbWJkYSDplqLmlbDjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhRnVuY3Rpb25zKFxuICAgIGZzeENvbmZpZzogYW55LFxuICAgIHZwYzogZWMyLklWcGMsXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nXG4gICk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKCfimqEgTGFtYmRhIOmWouaVsOS9nOaIkOmWi+Wniy4uLicpO1xuXG4gICAgZnN4Q29uZmlnLnNlcnZlcmxlc3MubGFtYmRhLmZ1bmN0aW9ucy5mb3JFYWNoKChmdW5jQ29uZmlnOiBhbnksIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgIGlmICghZnVuY0NvbmZpZy5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgIC8vIExhbWJkYeWun+ihjOODreODvOODq+OBruS9nOaIkFxuICAgICAgY29uc3Qgcm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBgTGFtYmRhUm9sZSR7aW5kZXh9YCwge1xuICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhVlBDQWNjZXNzRXhlY3V0aW9uUm9sZScpXG4gICAgICAgIF0sXG4gICAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgICAgRnN4QWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICAgIHN0YXRlbWVudHM6IGZ1bmNDb25maWcucm9sZS5wZXJtaXNzaW9ucy5tYXAoKHBlcm1pc3Npb246IHN0cmluZykgPT4gXG4gICAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgYWN0aW9uczogW3Blcm1pc3Npb25dLFxuICAgICAgICAgICAgICAgIHJlc291cmNlczogWycqJ11cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gTGFtYmRh6Zai5pWw44Gu5L2c5oiQ77yINjTmloflrZfliLbpmZDlr77lv5zvvIlcbiAgICAgIGNvbnN0IHNob3J0RnVuY3Rpb25OYW1lID0gYCR7cHJvamVjdE5hbWUuc3Vic3RyaW5nKDAsIDE1KX0tJHtlbnZpcm9ubWVudH0tJHtmdW5jQ29uZmlnLm5hbWUuc3Vic3RyaW5nKDAsIDIwKX1gO1xuICAgICAgY29uc3QgbGFtYmRhRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIGBGdW5jdGlvbiR7aW5kZXh9YCwge1xuICAgICAgICBmdW5jdGlvbk5hbWU6IHNob3J0RnVuY3Rpb25OYW1lLFxuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM185LFxuICAgICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuaW1wb3J0IGpzb25cbmltcG9ydCBib3RvM1xuaW1wb3J0IGxvZ2dpbmdcblxubG9nZ2VyID0gbG9nZ2luZy5nZXRMb2dnZXIoKVxubG9nZ2VyLnNldExldmVsKGxvZ2dpbmcuSU5GTylcblxuZGVmIGhhbmRsZXIoZXZlbnQsIGNvbnRleHQpOlxuICAgIFwiXCJcIlxuICAgIEZTeOe1seWQiExhbWJkYemWouaVsFxuICAgIFwiXCJcIlxuICAgIGxvZ2dlci5pbmZvKGZcIlJlY2VpdmVkIGV2ZW50OiB7anNvbi5kdW1wcyhldmVudCl9XCIpXG4gICAgXG4gICAgIyBGU3jjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6Dmg4XloLHjga7lj5blvpdcbiAgICBmc3hfY2xpZW50ID0gYm90bzMuY2xpZW50KCdmc3gnKVxuICAgIFxuICAgIHRyeTpcbiAgICAgICAgIyDjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6DkuIDopqfjga7lj5blvpdcbiAgICAgICAgcmVzcG9uc2UgPSBmc3hfY2xpZW50LmRlc2NyaWJlX2ZpbGVfc3lzdGVtcygpXG4gICAgICAgIGZpbGVfc3lzdGVtcyA9IHJlc3BvbnNlLmdldCgnRmlsZVN5c3RlbXMnLCBbXSlcbiAgICAgICAgXG4gICAgICAgIGxvZ2dlci5pbmZvKGZcIkZvdW5kIHtsZW4oZmlsZV9zeXN0ZW1zKX0gRlN4IGZpbGUgc3lzdGVtc1wiKVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICdzdGF0dXNDb2RlJzogMjAwLFxuICAgICAgICAgICAgJ2JvZHknOiBqc29uLmR1bXBzKHtcbiAgICAgICAgICAgICAgICAnbWVzc2FnZSc6ICdGU3ggaW50ZWdyYXRpb24gZnVuY3Rpb24gZXhlY3V0ZWQgc3VjY2Vzc2Z1bGx5JyxcbiAgICAgICAgICAgICAgICAnZmlsZVN5c3RlbXMnOiBsZW4oZmlsZV9zeXN0ZW1zKSxcbiAgICAgICAgICAgICAgICAnZXZlbnQnOiBldmVudFxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZTpcbiAgICAgICAgbG9nZ2VyLmVycm9yKGZcIkVycm9yOiB7c3RyKGUpfVwiKVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgJ3N0YXR1c0NvZGUnOiA1MDAsXG4gICAgICAgICAgICAnYm9keSc6IGpzb24uZHVtcHMoe1xuICAgICAgICAgICAgICAgICdlcnJvcic6IHN0cihlKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBgKSxcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoZnVuY0NvbmZpZy50aW1lb3V0KSxcbiAgICAgICAgbWVtb3J5U2l6ZTogZnVuY0NvbmZpZy5tZW1vcnlTaXplLFxuICAgICAgICByb2xlOiByb2xlLFxuICAgICAgICB2cGM6IGZ1bmNDb25maWcudnBjLmVuYWJsZWQgPyB2cGMgOiB1bmRlZmluZWQsXG4gICAgICAgIHRyYWNpbmc6IGZzeENvbmZpZy5zZXJ2ZXJsZXNzLm1vbml0b3JpbmcueHJheS5lbmFibGVkID8gXG4gICAgICAgICAgbGFtYmRhLlRyYWNpbmcuQUNUSVZFIDogbGFtYmRhLlRyYWNpbmcuRElTQUJMRUQsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgUFJPSkVDVF9OQU1FOiBwcm9qZWN0TmFtZSxcbiAgICAgICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICAgICAgTE9HX0xFVkVMOiAnSU5GTydcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuZnVuY3Rpb25zLnB1c2gobGFtYmRhRnVuY3Rpb24pO1xuICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBMYW1iZGEg6Zai5pWw5L2c5oiQ5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICogQ2xvdWRXYXRjaCDjg63jgrDjgajjg6Ljg4vjgr/jg6rjg7PjgrDjga7oqK3lrppcbiAgICovXG4gIHByaXZhdGUgc2V0dXBNb25pdG9yaW5nKFxuICAgIGNvbmZpZzogRW52aXJvbm1lbnRDb25maWcsXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nXG4gICk6IHZvaWQge1xuICAgIGlmICghY29uZmlnLm1vbml0b3JpbmcuZW5hYmxlRGV0YWlsZWRNb25pdG9yaW5nKSB7XG4gICAgICBjb25zb2xlLmxvZygn4o+t77iPICDoqbPntLDjg6Ljg4vjgr/jg6rjg7PjgrDjgYznhKHlirnljJbjgZXjgozjgabjgYTjgb7jgZknKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygn8J+TiiBDbG91ZFdhdGNoIOODouODi+OCv+ODquODs+OCsOioreWumumWi+Wniy4uLicpO1xuXG4gICAgLy8gRlN457Wx5ZCI55So44Ot44Kw44Kw44Or44O844OX44Gu5L2c5oiQXG4gICAgbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0ZzeEludGVncmF0aW9uTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2ZzeC1pbnRlZ3JhdGlvbi8ke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fWAsXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFS1xuICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBDbG91ZFdhdGNoIOODouODi+OCv+ODquODs+OCsOioreWumuWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCueOCv+ODg+OCr+WHuuWKm+OBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVTdGFja091dHB1dHMocHJvamVjdE5hbWU6IHN0cmluZywgZW52aXJvbm1lbnQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKCfwn5OkIEZTeCBJbnRlZ3JhdGlvbiBTdGFja+WHuuWKm+WApOS9nOaIkOmWi+Wniy4uLicpO1xuXG4gICAgLy8gRlN457Wx5ZCI44Kz44Oz44K544OI44Op44Kv44OI44Gu5Ye65YqbXG4gICAgaWYgKHRoaXMuZnN4SW50ZWdyYXRpb24pIHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGc3hJbnRlZ3JhdGlvbkVuYWJsZWQnLCB7XG4gICAgICAgIHZhbHVlOiAndHJ1ZScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRlN4IEludGVncmF0aW9uIGZlYXR1cmUgaXMgZW5hYmxlZCdcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFN0ZXAgRnVuY3Rpb25zIOOCueODhuODvOODiOODnuOCt+ODs+OBruWHuuWKm1xuICAgIHRoaXMuc3RhdGVNYWNoaW5lcy5mb3JFYWNoKChzdGF0ZU1hY2hpbmUsIGluZGV4KSA9PiB7XG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgU3RhdGVNYWNoaW5lJHtpbmRleH1Bcm5gLCB7XG4gICAgICAgIHZhbHVlOiBzdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFN0ZXAgRnVuY3Rpb25zIFN0YXRlIE1hY2hpbmUgJHtpbmRleH0gQVJOYFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICAvLyBFdmVudEJyaWRnZSDjgqvjgrnjgr/jg6Djg5Djgrnjga7lh7rliptcbiAgICBpZiAodGhpcy5ldmVudEJ1cykge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0V2ZW50QnVzQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5ldmVudEJ1cy5ldmVudEJ1c0FybixcbiAgICAgICAgZGVzY3JpcHRpb246ICdGU3ggSW50ZWdyYXRpb24gRXZlbnRCcmlkZ2UgQ3VzdG9tIEJ1cyBBUk4nXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBMYW1iZGEg6Zai5pWw44Gu5Ye65YqbXG4gICAgdGhpcy5mdW5jdGlvbnMuZm9yRWFjaCgoZnVuYywgaW5kZXgpID0+IHtcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGBGdW5jdGlvbiR7aW5kZXh9QXJuYCwge1xuICAgICAgICB2YWx1ZTogZnVuYy5mdW5jdGlvbkFybixcbiAgICAgICAgZGVzY3JpcHRpb246IGBGU3ggSW50ZWdyYXRpb24gTGFtYmRhIEZ1bmN0aW9uICR7aW5kZXh9IEFSTmBcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coJ/Cfk6QgRlN4IEludGVncmF0aW9uIFN0YWNr5Ye65Yqb5YCk5L2c5oiQ5a6M5LqGJyk7XG4gIH1cbn0iXX0=