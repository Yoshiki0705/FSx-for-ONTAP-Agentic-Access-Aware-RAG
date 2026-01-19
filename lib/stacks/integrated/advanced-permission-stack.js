"use strict";
/**
 * AdvancedPermissionStack - 高度権限制御統合スタック
 *
 * 機能:
 * - 時間ベース制限、地理的制限、動的権限の統合管理
 * - 高度権限フィルタリングエンジンのデプロイ
 * - 権限キャッシュ・監査ログシステムの構築
 * - 既存セキュリティスタックとの連携
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
exports.AdvancedPermissionStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const subscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
// 高度権限制御コンストラクト
const advanced_permission_filter_engine_1 = require("../../modules/enterprise/constructs/advanced-permission-filter-engine");
const advanced_permission_config_1 = require("../../modules/enterprise/configs/advanced-permission-config");
// CloudWatch Actions インポート
const cloudwatchActions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
/**
 * 高度権限制御統合スタック
 *
 * エンタープライズグレードの権限制御システムを統合管理
 */
class AdvancedPermissionStack extends cdk.Stack {
    /** 高度権限フィルタリングエンジン */
    permissionEngine;
    /** 権限設定テーブル */
    permissionConfigTable;
    /** ユーザープロファイルテーブル */
    userProfileTable;
    /** 監査ログテーブル */
    auditLogTable;
    /** 権限管理API Lambda */
    permissionManagementApi;
    /** 監視・アラート用SNSトピック */
    alertTopic;
    /** CloudWatchダッシュボード */
    monitoringDashboard;
    constructor(scope, id, props) {
        super(scope, id, props);
        console.log('🔐 AdvancedPermissionStack初期化開始...');
        console.log('📝 スタック名:', id);
        console.log('🌍 環境:', props.environment);
        // 環境別権限設定取得
        const permissionConfig = (0, advanced_permission_config_1.getAdvancedPermissionConfig)(props.environment);
        // DynamoDBテーブル作成
        this.createDynamoDBTables(props);
        // 高度権限フィルタリングエンジン作成
        this.permissionEngine = new advanced_permission_filter_engine_1.AdvancedPermissionFilterEngine(this, 'PermissionEngine', {
            filterConfig: permissionConfig,
            opensearchEndpoint: props.opensearchEndpoint,
            permissionTableName: this.permissionConfigTable.tableName,
            auditLogTableName: this.auditLogTable.tableName,
            geoLocationApi: {
                endpoint: process.env.GEO_LOCATION_API_ENDPOINT || 'api.ipgeolocation.io',
                apiKey: process.env.GEO_LOCATION_API_KEY || ''
            },
            projectManagementApi: {
                endpoint: process.env.PROJECT_MANAGEMENT_API_ENDPOINT || 'api.projectmanagement.internal',
                apiKey: process.env.PROJECT_MANAGEMENT_API_KEY || ''
            }
        });
        // 権限管理API作成
        this.createPermissionManagementApi(props, permissionConfig);
        // 監視・アラートシステム作成
        this.createMonitoringSystem(props);
        // CloudWatchダッシュボード作成
        this.createDashboard(props);
        // スタック出力作成
        this.createOutputs();
        // タグ設定
        this.addStackTags();
        console.log('✅ AdvancedPermissionStack初期化完了');
    }
    /**
     * DynamoDBテーブル作成
     */
    createDynamoDBTables(props) {
        console.log('🗄️ DynamoDBテーブル作成開始...');
        // 権限設定テーブル
        this.permissionConfigTable = new dynamodb.Table(this, 'PermissionConfigTable', {
            tableName: `${props.config.project.name}-${props.environment}-permission-config`,
            partitionKey: {
                name: 'configType',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'configId',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
            encryption: props.kmsKeyArn ?
                dynamodb.TableEncryption.CUSTOMER_MANAGED :
                dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        // ユーザープロファイルテーブル
        this.userProfileTable = new dynamodb.Table(this, 'UserProfileTable', {
            tableName: `${props.config.project.name}-${props.environment}-user-profiles`,
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
            encryption: props.kmsKeyArn ?
                dynamodb.TableEncryption.CUSTOMER_MANAGED :
                dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        // GSI for organization queries
        this.userProfileTable.addGlobalSecondaryIndex({
            indexName: 'OrganizationIndex',
            partitionKey: {
                name: 'organization',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'department',
                type: dynamodb.AttributeType.STRING
            }
        });
        // 監査ログテーブル
        this.auditLogTable = new dynamodb.Table(this, 'AuditLogTable', {
            tableName: `${props.config.project.name}-${props.environment}-audit-logs`,
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.STRING
            },
            timeToLiveAttribute: 'ttl',
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
            encryption: props.kmsKeyArn ?
                dynamodb.TableEncryption.CUSTOMER_MANAGED :
                dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        // GSI for audit queries
        this.auditLogTable.addGlobalSecondaryIndex({
            indexName: 'ActionIndex',
            partitionKey: {
                name: 'action',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.STRING
            }
        });
        this.auditLogTable.addGlobalSecondaryIndex({
            indexName: 'ResourceIndex',
            partitionKey: {
                name: 'resource',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.STRING
            }
        });
        console.log('✅ DynamoDBテーブル作成完了');
    }
    /**
     * 権限管理API作成
     */
    createPermissionManagementApi(props, permissionConfig) {
        console.log('🔧 権限管理API作成開始...');
        // Lambda実行ロール
        const apiExecutionRole = new iam.Role(this, 'PermissionApiExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ],
            inlinePolicies: {
                DynamoDBAccess: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'dynamodb:GetItem',
                                'dynamodb:PutItem',
                                'dynamodb:UpdateItem',
                                'dynamodb:DeleteItem',
                                'dynamodb:Query',
                                'dynamodb:Scan',
                                'dynamodb:BatchGetItem',
                                'dynamodb:BatchWriteItem'
                            ],
                            resources: [
                                this.permissionConfigTable.tableArn,
                                this.userProfileTable.tableArn,
                                this.auditLogTable.tableArn,
                                `${this.permissionConfigTable.tableArn}/index/*`,
                                `${this.userProfileTable.tableArn}/index/*`,
                                `${this.auditLogTable.tableArn}/index/*`
                            ]
                        })
                    ]
                }),
                LambdaInvokeAccess: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: ['lambda:InvokeFunction'],
                            resources: [
                                this.permissionEngine.permissionFilterFunction.functionArn,
                                this.permissionEngine.timeBasedCheckFunction.functionArn,
                                this.permissionEngine.geographicCheckFunction.functionArn,
                                this.permissionEngine.dynamicPermissionUpdateFunction.functionArn
                            ]
                        })
                    ]
                })
            }
        });
        // 権限管理API Lambda関数
        this.permissionManagementApi = new lambda.Function(this, 'PermissionManagementApi', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(this.getPermissionManagementApiCode()),
            role: apiExecutionRole,
            timeout: cdk.Duration.seconds(30),
            memorySize: 1024,
            environment: {
                PERMISSION_CONFIG_TABLE: this.permissionConfigTable.tableName,
                USER_PROFILE_TABLE: this.userProfileTable.tableName,
                AUDIT_LOG_TABLE: this.auditLogTable.tableName,
                PERMISSION_FILTER_FUNCTION: this.permissionEngine.permissionFilterFunction.functionName,
                ENVIRONMENT: props.environment,
                PROJECT_NAME: props.config.project.name
            },
            logRetention: logs.RetentionDays.ONE_MONTH
        });
        console.log('✅ 権限管理API作成完了');
    }
    /**
     * 監視・アラートシステム作成
     */
    createMonitoringSystem(props) {
        console.log('📊 監視・アラートシステム作成開始...');
        // SNSトピック作成
        this.alertTopic = new sns.Topic(this, 'PermissionAlertTopic', {
            topicName: `${props.config.project.name}-${props.environment}-permission-alerts`,
            displayName: 'Advanced Permission Control Alerts'
        });
        // メール通知設定（環境変数から取得）
        const alertEmail = process.env.SECURITY_ALERT_EMAIL;
        if (alertEmail) {
            this.alertTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));
        }
        // CloudWatchアラーム作成
        this.createCloudWatchAlarms();
        console.log('✅ 監視・アラートシステム作成完了');
    }
    /**
     * CloudWatchアラーム作成
     */
    createCloudWatchAlarms() {
        // 権限フィルタリング関数のエラー率アラーム
        const filterFunctionErrorAlarm = new cloudwatch.Alarm(this, 'PermissionFilterErrorAlarm', {
            alarmName: `${this.stackName}-PermissionFilter-ErrorRate`,
            alarmDescription: '権限フィルタリング関数のエラー率が高い',
            metric: this.permissionEngine.permissionFilterFunction.metricErrors({
                period: cdk.Duration.minutes(5)
            }),
            threshold: 10,
            evaluationPeriods: 2,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });
        filterFunctionErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
        // 権限フィルタリング関数の実行時間アラーム
        const filterFunctionDurationAlarm = new cloudwatch.Alarm(this, 'PermissionFilterDurationAlarm', {
            alarmName: `${this.stackName}-PermissionFilter-Duration`,
            alarmDescription: '権限フィルタリング関数の実行時間が長い',
            metric: this.permissionEngine.permissionFilterFunction.metricDuration({
                period: cdk.Duration.minutes(5)
            }),
            threshold: 25000, // 25秒
            evaluationPeriods: 3,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });
        filterFunctionDurationAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
        // DynamoDB読み取りスロットリングアラーム
        const dynamoReadThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoReadThrottleAlarm', {
            alarmName: `${this.stackName}-DynamoDB-ReadThrottle`,
            alarmDescription: 'DynamoDB読み取りスロットリングが発生',
            metric: this.auditLogTable.metricUserErrors({
                period: cdk.Duration.minutes(5)
            }),
            threshold: 5,
            evaluationPeriods: 2,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });
        dynamoReadThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
        // 異常なアクセス試行アラーム（カスタムメトリクス）
        const suspiciousAccessAlarm = new cloudwatch.Alarm(this, 'SuspiciousAccessAlarm', {
            alarmName: `${this.stackName}-SuspiciousAccess`,
            alarmDescription: '異常なアクセス試行が検出されました',
            metric: new cloudwatch.Metric({
                namespace: 'AdvancedPermissionControl',
                metricName: 'SuspiciousAccessAttempts',
                dimensionsMap: {
                    Environment: this.node.tryGetContext('environment') || 'unknown'
                },
                period: cdk.Duration.minutes(5),
                statistic: 'Sum'
            }),
            threshold: 20,
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });
        suspiciousAccessAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
    }
    /**
     * CloudWatchダッシュボード作成
     */
    createDashboard(props) {
        console.log('📈 CloudWatchダッシュボード作成開始...');
        this.monitoringDashboard = new cloudwatch.Dashboard(this, 'PermissionControlDashboard', {
            dashboardName: `${props.config.project.name}-${props.environment}-permission-control`,
            widgets: [
                [
                    // 権限フィルタリング関数メトリクス
                    new cloudwatch.GraphWidget({
                        title: '権限フィルタリング関数 - 実行回数',
                        left: [this.permissionEngine.permissionFilterFunction.metricInvocations()],
                        width: 12,
                        height: 6
                    }),
                    new cloudwatch.GraphWidget({
                        title: '権限フィルタリング関数 - エラー率',
                        left: [this.permissionEngine.permissionFilterFunction.metricErrors()],
                        width: 12,
                        height: 6
                    })
                ],
                [
                    // DynamoDBメトリクス
                    new cloudwatch.GraphWidget({
                        title: 'DynamoDB - 読み取り容量',
                        left: [
                            this.permissionConfigTable.metricConsumedReadCapacityUnits(),
                            this.userProfileTable.metricConsumedReadCapacityUnits(),
                            this.auditLogTable.metricConsumedReadCapacityUnits()
                        ],
                        width: 12,
                        height: 6
                    }),
                    new cloudwatch.GraphWidget({
                        title: 'DynamoDB - 書き込み容量',
                        left: [
                            this.permissionConfigTable.metricConsumedWriteCapacityUnits(),
                            this.userProfileTable.metricConsumedWriteCapacityUnits(),
                            this.auditLogTable.metricConsumedWriteCapacityUnits()
                        ],
                        width: 12,
                        height: 6
                    })
                ],
                [
                    // カスタムメトリクス
                    new cloudwatch.SingleValueWidget({
                        title: '今日のアクセス試行数',
                        metrics: [
                            new cloudwatch.Metric({
                                namespace: 'AdvancedPermissionControl',
                                metricName: 'AccessAttempts',
                                statistic: 'Sum',
                                period: cdk.Duration.hours(24)
                            })
                        ],
                        width: 6,
                        height: 6
                    }),
                    new cloudwatch.SingleValueWidget({
                        title: '今日の拒否されたアクセス',
                        metrics: [
                            new cloudwatch.Metric({
                                namespace: 'AdvancedPermissionControl',
                                metricName: 'AccessDenied',
                                statistic: 'Sum',
                                period: cdk.Duration.hours(24)
                            })
                        ],
                        width: 6,
                        height: 6
                    }),
                    new cloudwatch.SingleValueWidget({
                        title: 'アクティブユーザー数',
                        metrics: [
                            new cloudwatch.Metric({
                                namespace: 'AdvancedPermissionControl',
                                metricName: 'ActiveUsers',
                                statistic: 'Maximum',
                                period: cdk.Duration.hours(1)
                            })
                        ],
                        width: 6,
                        height: 6
                    }),
                    new cloudwatch.SingleValueWidget({
                        title: '異常アクセス検出数',
                        metrics: [
                            new cloudwatch.Metric({
                                namespace: 'AdvancedPermissionControl',
                                metricName: 'SuspiciousAccessAttempts',
                                statistic: 'Sum',
                                period: cdk.Duration.hours(24)
                            })
                        ],
                        width: 6,
                        height: 6
                    })
                ]
            ]
        });
        console.log('✅ CloudWatchダッシュボード作成完了');
    }
    /**
     * スタック出力作成
     */
    createOutputs() {
        // 権限フィルタリング関数ARN
        new cdk.CfnOutput(this, 'PermissionFilterFunctionArn', {
            value: this.permissionEngine.permissionFilterFunction.functionArn,
            description: 'Permission Filter Function ARN',
            exportName: `${this.stackName}-PermissionFilterFunctionArn`
        });
        // 権限管理API ARN
        new cdk.CfnOutput(this, 'PermissionManagementApiArn', {
            value: this.permissionManagementApi.functionArn,
            description: 'Permission Management API ARN',
            exportName: `${this.stackName}-PermissionManagementApiArn`
        });
        // DynamoDBテーブル名
        new cdk.CfnOutput(this, 'PermissionConfigTableName', {
            value: this.permissionConfigTable.tableName,
            description: 'Permission Config Table Name',
            exportName: `${this.stackName}-PermissionConfigTableName`
        });
        new cdk.CfnOutput(this, 'UserProfileTableName', {
            value: this.userProfileTable.tableName,
            description: 'User Profile Table Name',
            exportName: `${this.stackName}-UserProfileTableName`
        });
        new cdk.CfnOutput(this, 'AuditLogTableName', {
            value: this.auditLogTable.tableName,
            description: 'Audit Log Table Name',
            exportName: `${this.stackName}-AuditLogTableName`
        });
        // SNSトピックARN
        new cdk.CfnOutput(this, 'AlertTopicArn', {
            value: this.alertTopic.topicArn,
            description: 'Permission Alert Topic ARN',
            exportName: `${this.stackName}-AlertTopicArn`
        });
        // ダッシュボードURL
        new cdk.CfnOutput(this, 'DashboardUrl', {
            value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.monitoringDashboard.dashboardName}`,
            description: 'CloudWatch Dashboard URL',
            exportName: `${this.stackName}-DashboardUrl`
        });
        console.log('📤 AdvancedPermissionStack出力値作成完了');
    }
    /**
     * スタックタグ設定
     */
    addStackTags() {
        cdk.Tags.of(this).add('Module', 'AdvancedPermissionControl');
        cdk.Tags.of(this).add('StackType', 'Integrated');
        cdk.Tags.of(this).add('Architecture', 'Modular');
        cdk.Tags.of(this).add('ManagedBy', 'CDK');
        cdk.Tags.of(this).add('SecurityLevel', 'Enterprise');
        cdk.Tags.of(this).add('PermissionControl', 'Advanced');
        cdk.Tags.of(this).add('MonitoringEnabled', 'Yes');
        console.log('🏷️ AdvancedPermissionStackタグ設定完了');
    }
    /**
     * 権限管理API Lambda関数コード
     */
    getPermissionManagementApiCode() {
        return `
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

exports.handler = async (event) => {
  console.log('🔐 権限管理API呼び出し:', JSON.stringify(event, null, 2));
  
  try {
    const { httpMethod, path, body, headers, queryStringParameters } = event;
    const requestBody = body ? JSON.parse(body) : {};
    
    // CORS設定
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    };
    
    // OPTIONSリクエスト処理
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'CORS preflight' })
      };
    }
    
    // ルーティング
    let response;
    
    if (path === '/permissions/user' && httpMethod === 'GET') {
      response = await getUserPermissions(queryStringParameters?.userId);
    } else if (path === '/permissions/user' && httpMethod === 'PUT') {
      response = await updateUserPermissions(requestBody);
    } else if (path === '/permissions/check' && httpMethod === 'POST') {
      response = await checkPermissions(requestBody);
    } else if (path === '/permissions/audit' && httpMethod === 'GET') {
      response = await getAuditLogs(queryStringParameters);
    } else if (path === '/permissions/temporary' && httpMethod === 'POST') {
      response = await grantTemporaryAccess(requestBody);
    } else {
      response = {
        statusCode: 404,
        body: JSON.stringify({ error: 'Not Found', message: 'エンドポイントが見つかりません' })
      };
    }
    
    return {
      ...response,
      headers: { ...corsHeaders, ...response.headers }
    };
    
  } catch (error) {
    console.error('権限管理APIエラー:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: '権限管理API処理中にエラーが発生しました',
        details: error.message
      })
    };
  }
};

async function getUserPermissions(userId) {
  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Bad Request', message: 'ユーザーIDが必要です' })
    };
  }
  
  try {
    const result = await dynamodb.get({
      TableName: process.env.USER_PROFILE_TABLE,
      Key: { userId }
    }).promise();
    
    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Not Found', message: 'ユーザーが見つかりません' })
      };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        user: result.Item
      })
    };
    
  } catch (error) {
    console.error('ユーザー権限取得エラー:', error);
    throw error;
  }
}

async function updateUserPermissions(requestBody) {
  const { userId, permissions } = requestBody;
  
  if (!userId || !permissions) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Bad Request', message: 'ユーザーIDと権限情報が必要です' })
    };
  }
  
  try {
    const updateParams = {
      TableName: process.env.USER_PROFILE_TABLE,
      Key: { userId },
      UpdateExpression: 'SET #permissions = :permissions, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#permissions': 'permissions',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':permissions': permissions,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamodb.update(updateParams).promise();
    
    // 監査ログ記録
    await recordAuditLog({
      userId,
      action: 'update_user_permissions',
      resource: 'user_profile',
      details: { updatedPermissions: permissions },
      timestamp: new Date().toISOString()
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'ユーザー権限が更新されました',
        user: result.Attributes
      })
    };
    
  } catch (error) {
    console.error('ユーザー権限更新エラー:', error);
    throw error;
  }
}

async function checkPermissions(requestBody) {
  const { userId, query, ipAddress, userAgent, sessionId } = requestBody;
  
  if (!userId || !query) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Bad Request', message: 'ユーザーIDとクエリが必要です' })
    };
  }
  
  try {
    // 権限フィルタリング関数を呼び出し
    const filterResult = await lambda.invoke({
      FunctionName: process.env.PERMISSION_FILTER_FUNCTION,
      Payload: JSON.stringify({
        userId,
        query,
        ipAddress,
        userAgent,
        sessionId
      })
    }).promise();
    
    const filterResponse = JSON.parse(filterResult.Payload);
    
    return {
      statusCode: filterResponse.statusCode || 200,
      body: filterResponse.body || JSON.stringify(filterResponse)
    };
    
  } catch (error) {
    console.error('権限チェックエラー:', error);
    throw error;
  }
}

async function getAuditLogs(queryParams) {
  const { userId, startDate, endDate, action, limit = 50 } = queryParams || {};
  
  try {
    let queryExpression = {
      TableName: process.env.AUDIT_LOG_TABLE,
      Limit: parseInt(limit)
    };
    
    if (userId) {
      queryExpression.KeyConditionExpression = 'userId = :userId';
      queryExpression.ExpressionAttributeValues = { ':userId': userId };
      
      if (startDate && endDate) {
        queryExpression.KeyConditionExpression += ' AND #timestamp BETWEEN :startDate AND :endDate';
        queryExpression.ExpressionAttributeNames = { '#timestamp': 'timestamp' };
        queryExpression.ExpressionAttributeValues[':startDate'] = startDate;
        queryExpression.ExpressionAttributeValues[':endDate'] = endDate;
      }
    } else if (action) {
      queryExpression.IndexName = 'ActionIndex';
      queryExpression.KeyConditionExpression = 'action = :action';
      queryExpression.ExpressionAttributeValues = { ':action': action };
    } else {
      // 全体スキャン（制限付き）
      queryExpression = {
        TableName: process.env.AUDIT_LOG_TABLE,
        Limit: parseInt(limit)
      };
      
      const result = await dynamodb.scan(queryExpression).promise();
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          logs: result.Items,
          count: result.Items.length
        })
      };
    }
    
    const result = await dynamodb.query(queryExpression).promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        logs: result.Items,
        count: result.Items.length
      })
    };
    
  } catch (error) {
    console.error('監査ログ取得エラー:', error);
    throw error;
  }
}

async function grantTemporaryAccess(requestBody) {
  const { userId, resourceId, durationHours, reason, grantedBy } = requestBody;
  
  if (!userId || !resourceId || !durationHours || !reason || !grantedBy) {
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: 'Bad Request', 
        message: 'ユーザーID、リソースID、期間、理由、承認者が必要です' 
      })
    };
  }
  
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (durationHours * 60 * 60 * 1000));
    
    const tempAccessItem = {
      userId,
      resourceId: \`temp_access_\${resourceId}\`,
      permissions: ['temporary_access'],
      grantedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      durationHours,
      reason,
      grantedBy,
      status: 'active',
      ttl: Math.floor(expiresAt.getTime() / 1000)
    };
    
    await dynamodb.put({
      TableName: process.env.PERMISSION_CONFIG_TABLE,
      Item: {
        configType: 'temporary_access',
        configId: \`\${userId}_\${resourceId}_\${now.getTime()}\`,
        ...tempAccessItem
      }
    }).promise();
    
    // 監査ログ記録
    await recordAuditLog({
      userId,
      action: 'grant_temporary_access',
      resource: resourceId,
      details: {
        durationHours,
        reason,
        grantedBy,
        expiresAt: expiresAt.toISOString()
      },
      timestamp: now.toISOString()
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: '一時的アクセス権限が付与されました',
        temporaryAccess: tempAccessItem
      })
    };
    
  } catch (error) {
    console.error('一時的アクセス付与エラー:', error);
    throw error;
  }
}

async function recordAuditLog(logData) {
  try {
    await dynamodb.put({
      TableName: process.env.AUDIT_LOG_TABLE,
      Item: {
        ...logData,
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90日保持
      }
    }).promise();
  } catch (error) {
    console.error('監査ログ記録エラー:', error);
  }
}
    `;
    }
}
exports.AdvancedPermissionStack = AdvancedPermissionStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWR2YW5jZWQtcGVybWlzc2lvbi1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFkdmFuY2VkLXBlcm1pc3Npb24tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyxtRUFBcUQ7QUFDckQsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUUzQywyREFBNkM7QUFDN0MsdUVBQXlEO0FBQ3pELHlEQUEyQztBQUMzQyxpRkFBbUU7QUFHbkUsZ0JBQWdCO0FBQ2hCLDZIQUF1SDtBQUl2SCw0R0FBMEc7QUFFMUcsMkJBQTJCO0FBQzNCLHNGQUF3RTtBQXNCeEU7Ozs7R0FJRztBQUNILE1BQWEsdUJBQXdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDcEQsc0JBQXNCO0lBQ2YsZ0JBQWdCLENBQWlDO0lBRXhELGVBQWU7SUFDUixxQkFBcUIsQ0FBaUI7SUFFN0MscUJBQXFCO0lBQ2QsZ0JBQWdCLENBQWlCO0lBRXhDLGVBQWU7SUFDUixhQUFhLENBQWlCO0lBRXJDLHFCQUFxQjtJQUNkLHVCQUF1QixDQUFrQjtJQUVoRCxzQkFBc0I7SUFDZixVQUFVLENBQVk7SUFFN0Isd0JBQXdCO0lBQ2pCLG1CQUFtQixDQUF1QjtJQUVqRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQW1DO1FBQzNFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0NBQW9DLENBQUMsQ0FBQztRQUNsRCxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFekMsWUFBWTtRQUNaLE1BQU0sZ0JBQWdCLEdBQUcsSUFBQSx3REFBMkIsRUFBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFeEUsaUJBQWlCO1FBQ2pCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVqQyxvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksa0VBQThCLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ25GLFlBQVksRUFBRSxnQkFBZ0I7WUFDOUIsa0JBQWtCLEVBQUUsS0FBSyxDQUFDLGtCQUFrQjtZQUM1QyxtQkFBbUIsRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsU0FBUztZQUN6RCxpQkFBaUIsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVM7WUFDL0MsY0FBYyxFQUFFO2dCQUNkLFFBQVEsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLHlCQUF5QixJQUFJLHNCQUFzQjtnQkFDekUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLElBQUksRUFBRTthQUMvQztZQUNELG9CQUFvQixFQUFFO2dCQUNwQixRQUFRLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQywrQkFBK0IsSUFBSSxnQ0FBZ0M7Z0JBQ3pGLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLDBCQUEwQixJQUFJLEVBQUU7YUFDckQ7U0FDRixDQUFDLENBQUM7UUFFSCxZQUFZO1FBQ1osSUFBSSxDQUFDLDZCQUE2QixDQUFDLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTVELGdCQUFnQjtRQUNoQixJQUFJLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFbkMsc0JBQXNCO1FBQ3RCLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFNUIsV0FBVztRQUNYLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUVyQixPQUFPO1FBQ1AsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBRXBCLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxvQkFBb0IsQ0FBQyxLQUFtQztRQUM5RCxPQUFPLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFFdkMsV0FBVztRQUNYLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQzdFLFNBQVMsRUFBRSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsV0FBVyxvQkFBb0I7WUFDaEYsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxZQUFZO2dCQUNsQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxVQUFVO2dCQUNoQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxtQkFBbUIsRUFBRSxJQUFJO1lBQ3pCLFVBQVUsRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzNCLFFBQVEsQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDM0MsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXO1lBQ3RDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsaUJBQWlCO1FBQ2pCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ25FLFNBQVMsRUFBRSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsV0FBVyxnQkFBZ0I7WUFDNUUsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxRQUFRO2dCQUNkLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELG1CQUFtQixFQUFFLElBQUk7WUFDekIsVUFBVSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDM0IsUUFBUSxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUMzQyxRQUFRLENBQUMsZUFBZSxDQUFDLFdBQVc7WUFDdEMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCwrQkFBK0I7UUFDL0IsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDO1lBQzVDLFNBQVMsRUFBRSxtQkFBbUI7WUFDOUIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxjQUFjO2dCQUNwQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxZQUFZO2dCQUNsQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsV0FBVztRQUNYLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDN0QsU0FBUyxFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxXQUFXLGFBQWE7WUFDekUsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxRQUFRO2dCQUNkLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxtQkFBbUIsRUFBRSxLQUFLO1lBQzFCLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsbUJBQW1CLEVBQUUsSUFBSTtZQUN6QixVQUFVLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUMzQixRQUFRLENBQUMsZUFBZSxDQUFDLGdCQUFnQixDQUFDLENBQUM7Z0JBQzNDLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVztZQUN0QyxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUVILHdCQUF3QjtRQUN4QixJQUFJLENBQUMsYUFBYSxDQUFDLHVCQUF1QixDQUFDO1lBQ3pDLFNBQVMsRUFBRSxhQUFhO1lBQ3hCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQztZQUN6QyxTQUFTLEVBQUUsZUFBZTtZQUMxQixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVEOztPQUVHO0lBQ0ssNkJBQTZCLENBQ25DLEtBQW1DLEVBQ25DLGdCQUF3QztRQUV4QyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFFakMsY0FBYztRQUNkLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSw0QkFBNEIsRUFBRTtZQUN4RSxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUM7WUFDM0QsZUFBZSxFQUFFO2dCQUNmLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsMENBQTBDLENBQUM7YUFDdkY7WUFDRCxjQUFjLEVBQUU7Z0JBQ2QsY0FBYyxFQUFFLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQztvQkFDckMsVUFBVSxFQUFFO3dCQUNWLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQzs0QkFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSzs0QkFDeEIsT0FBTyxFQUFFO2dDQUNQLGtCQUFrQjtnQ0FDbEIsa0JBQWtCO2dDQUNsQixxQkFBcUI7Z0NBQ3JCLHFCQUFxQjtnQ0FDckIsZ0JBQWdCO2dDQUNoQixlQUFlO2dDQUNmLHVCQUF1QjtnQ0FDdkIseUJBQXlCOzZCQUMxQjs0QkFDRCxTQUFTLEVBQUU7Z0NBQ1QsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVE7Z0NBQ25DLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRO2dDQUM5QixJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVE7Z0NBQzNCLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsVUFBVTtnQ0FDaEQsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxVQUFVO2dDQUMzQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxVQUFVOzZCQUN6Qzt5QkFDRixDQUFDO3FCQUNIO2lCQUNGLENBQUM7Z0JBQ0Ysa0JBQWtCLEVBQUUsSUFBSSxHQUFHLENBQUMsY0FBYyxDQUFDO29CQUN6QyxVQUFVLEVBQUU7d0JBQ1YsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDOzRCQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLOzRCQUN4QixPQUFPLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQzs0QkFDbEMsU0FBUyxFQUFFO2dDQUNULElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyx3QkFBd0IsQ0FBQyxXQUFXO2dDQUMxRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUMsV0FBVztnQ0FDeEQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHVCQUF1QixDQUFDLFdBQVc7Z0NBQ3pELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQywrQkFBK0IsQ0FBQyxXQUFXOzZCQUNsRTt5QkFDRixDQUFDO3FCQUNIO2lCQUNGLENBQUM7YUFDSDtTQUNGLENBQUMsQ0FBQztRQUVILG1CQUFtQjtRQUNuQixJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUNsRixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsOEJBQThCLEVBQUUsQ0FBQztZQUNuRSxJQUFJLEVBQUUsZ0JBQWdCO1lBQ3RCLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsVUFBVSxFQUFFLElBQUk7WUFDaEIsV0FBVyxFQUFFO2dCQUNYLHVCQUF1QixFQUFFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTO2dCQUM3RCxrQkFBa0IsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUztnQkFDbkQsZUFBZSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUztnQkFDN0MsMEJBQTBCLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHdCQUF3QixDQUFDLFlBQVk7Z0JBQ3ZGLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVztnQkFDOUIsWUFBWSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUk7YUFDeEM7WUFDRCxZQUFZLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTO1NBQzNDLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVEOztPQUVHO0lBQ0ssc0JBQXNCLENBQUMsS0FBbUM7UUFDaEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBRXJDLFlBQVk7UUFDWixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDNUQsU0FBUyxFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxXQUFXLG9CQUFvQjtZQUNoRixXQUFXLEVBQUUsb0NBQW9DO1NBQ2xELENBQUMsQ0FBQztRQUVILG9CQUFvQjtRQUNwQixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDO1FBQ3BELElBQUksVUFBVSxFQUFFLENBQUM7WUFDZixJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FDN0IsSUFBSSxhQUFhLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLENBQ2hELENBQUM7UUFDSixDQUFDO1FBRUQsbUJBQW1CO1FBQ25CLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1FBRTlCLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7O09BRUc7SUFDSyxzQkFBc0I7UUFDNUIsdUJBQXVCO1FBQ3ZCLE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSw0QkFBNEIsRUFBRTtZQUN4RixTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyw2QkFBNkI7WUFDekQsZ0JBQWdCLEVBQUUscUJBQXFCO1lBQ3ZDLE1BQU0sRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsd0JBQXdCLENBQUMsWUFBWSxDQUFDO2dCQUNsRSxNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2hDLENBQUM7WUFDRixTQUFTLEVBQUUsRUFBRTtZQUNiLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLGFBQWE7U0FDNUQsQ0FBQyxDQUFDO1FBRUgsd0JBQXdCLENBQUMsY0FBYyxDQUNyQyxJQUFJLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQ2pELENBQUM7UUFFRix1QkFBdUI7UUFDdkIsTUFBTSwyQkFBMkIsR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLCtCQUErQixFQUFFO1lBQzlGLFNBQVMsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLDRCQUE0QjtZQUN4RCxnQkFBZ0IsRUFBRSxxQkFBcUI7WUFDdkMsTUFBTSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyx3QkFBd0IsQ0FBQyxjQUFjLENBQUM7Z0JBQ3BFLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7YUFDaEMsQ0FBQztZQUNGLFNBQVMsRUFBRSxLQUFLLEVBQUUsTUFBTTtZQUN4QixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhO1NBQzVELENBQUMsQ0FBQztRQUVILDJCQUEyQixDQUFDLGNBQWMsQ0FDeEMsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUNqRCxDQUFDO1FBRUYsMEJBQTBCO1FBQzFCLE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUNwRixTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyx3QkFBd0I7WUFDcEQsZ0JBQWdCLEVBQUUsd0JBQXdCO1lBQzFDLE1BQU0sRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDO2dCQUMxQyxNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2hDLENBQUM7WUFDRixTQUFTLEVBQUUsQ0FBQztZQUNaLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLGFBQWE7U0FDNUQsQ0FBQyxDQUFDO1FBRUgsdUJBQXVCLENBQUMsY0FBYyxDQUNwQyxJQUFJLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQ2pELENBQUM7UUFFRiwyQkFBMkI7UUFDM0IsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQ2hGLFNBQVMsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLG1CQUFtQjtZQUMvQyxnQkFBZ0IsRUFBRSxtQkFBbUI7WUFDckMsTUFBTSxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsU0FBUyxFQUFFLDJCQUEyQjtnQkFDdEMsVUFBVSxFQUFFLDBCQUEwQjtnQkFDdEMsYUFBYSxFQUFFO29CQUNiLFdBQVcsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsSUFBSSxTQUFTO2lCQUNqRTtnQkFDRCxNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUMvQixTQUFTLEVBQUUsS0FBSzthQUNqQixDQUFDO1lBQ0YsU0FBUyxFQUFFLEVBQUU7WUFDYixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhO1NBQzVELENBQUMsQ0FBQztRQUVILHFCQUFxQixDQUFDLGNBQWMsQ0FDbEMsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUNqRCxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0ssZUFBZSxDQUFDLEtBQW1DO1FBQ3pELE9BQU8sQ0FBQyxHQUFHLENBQUMsNkJBQTZCLENBQUMsQ0FBQztRQUUzQyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSw0QkFBNEIsRUFBRTtZQUN0RixhQUFhLEVBQUUsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLFdBQVcscUJBQXFCO1lBQ3JGLE9BQU8sRUFBRTtnQkFDUDtvQkFDRSxtQkFBbUI7b0JBQ25CLElBQUksVUFBVSxDQUFDLFdBQVcsQ0FBQzt3QkFDekIsS0FBSyxFQUFFLG9CQUFvQjt3QkFDM0IsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHdCQUF3QixDQUFDLGlCQUFpQixFQUFFLENBQUM7d0JBQzFFLEtBQUssRUFBRSxFQUFFO3dCQUNULE1BQU0sRUFBRSxDQUFDO3FCQUNWLENBQUM7b0JBQ0YsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDO3dCQUN6QixLQUFLLEVBQUUsb0JBQW9CO3dCQUMzQixJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsd0JBQXdCLENBQUMsWUFBWSxFQUFFLENBQUM7d0JBQ3JFLEtBQUssRUFBRSxFQUFFO3dCQUNULE1BQU0sRUFBRSxDQUFDO3FCQUNWLENBQUM7aUJBQ0g7Z0JBQ0Q7b0JBQ0UsZ0JBQWdCO29CQUNoQixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7d0JBQ3pCLEtBQUssRUFBRSxtQkFBbUI7d0JBQzFCLElBQUksRUFBRTs0QkFDSixJQUFJLENBQUMscUJBQXFCLENBQUMsK0JBQStCLEVBQUU7NEJBQzVELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQywrQkFBK0IsRUFBRTs0QkFDdkQsSUFBSSxDQUFDLGFBQWEsQ0FBQywrQkFBK0IsRUFBRTt5QkFDckQ7d0JBQ0QsS0FBSyxFQUFFLEVBQUU7d0JBQ1QsTUFBTSxFQUFFLENBQUM7cUJBQ1YsQ0FBQztvQkFDRixJQUFJLFVBQVUsQ0FBQyxXQUFXLENBQUM7d0JBQ3pCLEtBQUssRUFBRSxtQkFBbUI7d0JBQzFCLElBQUksRUFBRTs0QkFDSixJQUFJLENBQUMscUJBQXFCLENBQUMsZ0NBQWdDLEVBQUU7NEJBQzdELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxnQ0FBZ0MsRUFBRTs0QkFDeEQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxnQ0FBZ0MsRUFBRTt5QkFDdEQ7d0JBQ0QsS0FBSyxFQUFFLEVBQUU7d0JBQ1QsTUFBTSxFQUFFLENBQUM7cUJBQ1YsQ0FBQztpQkFDSDtnQkFDRDtvQkFDRSxZQUFZO29CQUNaLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDO3dCQUMvQixLQUFLLEVBQUUsWUFBWTt3QkFDbkIsT0FBTyxFQUFFOzRCQUNQLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQ0FDcEIsU0FBUyxFQUFFLDJCQUEyQjtnQ0FDdEMsVUFBVSxFQUFFLGdCQUFnQjtnQ0FDNUIsU0FBUyxFQUFFLEtBQUs7Z0NBQ2hCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7NkJBQy9CLENBQUM7eUJBQ0g7d0JBQ0QsS0FBSyxFQUFFLENBQUM7d0JBQ1IsTUFBTSxFQUFFLENBQUM7cUJBQ1YsQ0FBQztvQkFDRixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQzt3QkFDL0IsS0FBSyxFQUFFLGNBQWM7d0JBQ3JCLE9BQU8sRUFBRTs0QkFDUCxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0NBQ3BCLFNBQVMsRUFBRSwyQkFBMkI7Z0NBQ3RDLFVBQVUsRUFBRSxjQUFjO2dDQUMxQixTQUFTLEVBQUUsS0FBSztnQ0FDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQzs2QkFDL0IsQ0FBQzt5QkFDSDt3QkFDRCxLQUFLLEVBQUUsQ0FBQzt3QkFDUixNQUFNLEVBQUUsQ0FBQztxQkFDVixDQUFDO29CQUNGLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDO3dCQUMvQixLQUFLLEVBQUUsWUFBWTt3QkFDbkIsT0FBTyxFQUFFOzRCQUNQLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQztnQ0FDcEIsU0FBUyxFQUFFLDJCQUEyQjtnQ0FDdEMsVUFBVSxFQUFFLGFBQWE7Z0NBQ3pCLFNBQVMsRUFBRSxTQUFTO2dDQUNwQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDOzZCQUM5QixDQUFDO3lCQUNIO3dCQUNELEtBQUssRUFBRSxDQUFDO3dCQUNSLE1BQU0sRUFBRSxDQUFDO3FCQUNWLENBQUM7b0JBQ0YsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUM7d0JBQy9CLEtBQUssRUFBRSxXQUFXO3dCQUNsQixPQUFPLEVBQUU7NEJBQ1AsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDO2dDQUNwQixTQUFTLEVBQUUsMkJBQTJCO2dDQUN0QyxVQUFVLEVBQUUsMEJBQTBCO2dDQUN0QyxTQUFTLEVBQUUsS0FBSztnQ0FDaEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQzs2QkFDL0IsQ0FBQzt5QkFDSDt3QkFDRCxLQUFLLEVBQUUsQ0FBQzt3QkFDUixNQUFNLEVBQUUsQ0FBQztxQkFDVixDQUFDO2lCQUNIO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxPQUFPLENBQUMsR0FBRyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ0ssYUFBYTtRQUNuQixpQkFBaUI7UUFDakIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRTtZQUNyRCxLQUFLLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHdCQUF3QixDQUFDLFdBQVc7WUFDakUsV0FBVyxFQUFFLGdDQUFnQztZQUM3QyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyw4QkFBOEI7U0FDNUQsQ0FBQyxDQUFDO1FBRUgsY0FBYztRQUNkLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsNEJBQTRCLEVBQUU7WUFDcEQsS0FBSyxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXO1lBQy9DLFdBQVcsRUFBRSwrQkFBK0I7WUFDNUMsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsNkJBQTZCO1NBQzNELENBQUMsQ0FBQztRQUVILGdCQUFnQjtRQUNoQixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDJCQUEyQixFQUFFO1lBQ25ELEtBQUssRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsU0FBUztZQUMzQyxXQUFXLEVBQUUsOEJBQThCO1lBQzNDLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLDRCQUE0QjtTQUMxRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzlDLEtBQUssRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUztZQUN0QyxXQUFXLEVBQUUseUJBQXlCO1lBQ3RDLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLHVCQUF1QjtTQUNyRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVM7WUFDbkMsV0FBVyxFQUFFLHNCQUFzQjtZQUNuQyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxvQkFBb0I7U0FDbEQsQ0FBQyxDQUFDO1FBRUgsYUFBYTtRQUNiLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVE7WUFDL0IsV0FBVyxFQUFFLDRCQUE0QjtZQUN6QyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxnQkFBZ0I7U0FDOUMsQ0FBQyxDQUFDO1FBRUgsYUFBYTtRQUNiLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSxXQUFXLElBQUksQ0FBQyxNQUFNLGtEQUFrRCxJQUFJLENBQUMsTUFBTSxvQkFBb0IsSUFBSSxDQUFDLG1CQUFtQixDQUFDLGFBQWEsRUFBRTtZQUN0SixXQUFXLEVBQUUsMEJBQTBCO1lBQ3ZDLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLGVBQWU7U0FDN0MsQ0FBQyxDQUFDO1FBRUgsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFRDs7T0FFRztJQUNLLFlBQVk7UUFDbEIsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSwyQkFBMkIsQ0FBQyxDQUFDO1FBQzdELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDakQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUNqRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDckQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUVsRCxPQUFPLENBQUMsR0FBRyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVEOztPQUVHO0lBQ0ssOEJBQThCO1FBQ3BDLE9BQU87Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7S0E4VU4sQ0FBQztJQUNKLENBQUM7Q0FDRjtBQXAyQkQsMERBbzJCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQWR2YW5jZWRQZXJtaXNzaW9uU3RhY2sgLSDpq5jluqbmqKnpmZDliLblvqHntbHlkIjjgrnjgr/jg4Pjgq9cbiAqIFxuICog5qmf6IO9OlxuICogLSDmmYLplpPjg5njg7zjgrnliLbpmZDjgIHlnLDnkIbnmoTliLbpmZDjgIHli5XnmoTmqKnpmZDjga7ntbHlkIjnrqHnkIZcbiAqIC0g6auY5bqm5qip6ZmQ44OV44Kj44Or44K/44Oq44Oz44Kw44Ko44Oz44K444Oz44Gu44OH44OX44Ot44KkXG4gKiAtIOaoqemZkOOCreODo+ODg+OCt+ODpeODu+ebo+afu+ODreOCsOOCt+OCueODhuODoOOBruani+eviVxuICogLSDml6LlrZjjgrvjgq3jg6Xjg6rjg4bjgqPjgrnjgr/jg4Pjgq/jgajjga7pgKPmkLpcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcblxuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHN1YnNjcmlwdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG4vLyDpq5jluqbmqKnpmZDliLblvqHjgrPjg7Pjgrnjg4jjg6njgq/jg4hcbmltcG9ydCB7IEFkdmFuY2VkUGVybWlzc2lvbkZpbHRlckVuZ2luZSB9IGZyb20gJy4uLy4uL21vZHVsZXMvZW50ZXJwcmlzZS9jb25zdHJ1Y3RzL2FkdmFuY2VkLXBlcm1pc3Npb24tZmlsdGVyLWVuZ2luZSc7XG5cbi8vIOioreWumuOCpOODs+OCv+ODvOODleOCp+ODvOOCuVxuaW1wb3J0IHsgUGVybWlzc2lvbkZpbHRlckNvbmZpZyB9IGZyb20gJy4uLy4uL21vZHVsZXMvZW50ZXJwcmlzZS9pbnRlcmZhY2VzL3Blcm1pc3Npb24tY29uZmlnJztcbmltcG9ydCB7IGdldEFkdmFuY2VkUGVybWlzc2lvbkNvbmZpZyB9IGZyb20gJy4uLy4uL21vZHVsZXMvZW50ZXJwcmlzZS9jb25maWdzL2FkdmFuY2VkLXBlcm1pc3Npb24tY29uZmlnJztcblxuLy8gQ2xvdWRXYXRjaCBBY3Rpb25zIOOCpOODs+ODneODvOODiFxuaW1wb3J0ICogYXMgY2xvdWR3YXRjaEFjdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gtYWN0aW9ucyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQWR2YW5jZWRQZXJtaXNzaW9uU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgLyoqIOODl+ODreOCuOOCp+OCr+ODiOioreWumiAqL1xuICByZWFkb25seSBjb25maWc6IGFueTtcbiAgXG4gIC8qKiDnkrDlooPlkI0gKi9cbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgXG4gIC8qKiBPcGVuU2VhcmNo44OJ44Oh44Kk44Oz44Ko44Oz44OJ44Od44Kk44Oz44OIICovXG4gIHJlYWRvbmx5IG9wZW5zZWFyY2hFbmRwb2ludDogc3RyaW5nO1xuICBcbiAgLyoqIOOCu+OCreODpeODquODhuOCo+OCueOCv+ODg+OCr+OBi+OCieOBrktNU+OCreODvCAqL1xuICByZWFkb25seSBrbXNLZXlBcm4/OiBzdHJpbmc7XG4gIFxuICAvKiog5pei5a2YVlBD44Gu5Y+C54WnICovXG4gIHJlYWRvbmx5IHZwY0lkPzogc3RyaW5nO1xuICBcbiAgLyoqIOWRveWQjeOCuOOCp+ODjeODrOODvOOCv+ODvCAqL1xuICByZWFkb25seSBuYW1pbmdHZW5lcmF0b3I/OiBhbnk7XG59XG5cbi8qKlxuICog6auY5bqm5qip6ZmQ5Yi25b6h57Wx5ZCI44K544K/44OD44KvXG4gKiBcbiAqIOOCqOODs+OCv+ODvOODl+ODqeOCpOOCuuOCsOODrOODvOODieOBruaoqemZkOWItuW+oeOCt+OCueODhuODoOOCkue1seWQiOeuoeeQhlxuICovXG5leHBvcnQgY2xhc3MgQWR2YW5jZWRQZXJtaXNzaW9uU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICAvKiog6auY5bqm5qip6ZmQ44OV44Kj44Or44K/44Oq44Oz44Kw44Ko44Oz44K444OzICovXG4gIHB1YmxpYyBwZXJtaXNzaW9uRW5naW5lOiBBZHZhbmNlZFBlcm1pc3Npb25GaWx0ZXJFbmdpbmU7XG4gIFxuICAvKiog5qip6ZmQ6Kit5a6a44OG44O844OW44OrICovXG4gIHB1YmxpYyBwZXJtaXNzaW9uQ29uZmlnVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBcbiAgLyoqIOODpuODvOOCtuODvOODl+ODreODleOCoeOCpOODq+ODhuODvOODluODqyAqL1xuICBwdWJsaWMgdXNlclByb2ZpbGVUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIFxuICAvKiog55uj5p+744Ot44Kw44OG44O844OW44OrICovXG4gIHB1YmxpYyBhdWRpdExvZ1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgXG4gIC8qKiDmqKnpmZDnrqHnkIZBUEkgTGFtYmRhICovXG4gIHB1YmxpYyBwZXJtaXNzaW9uTWFuYWdlbWVudEFwaTogbGFtYmRhLkZ1bmN0aW9uO1xuICBcbiAgLyoqIOebo+imluODu+OCouODqeODvOODiOeUqFNOU+ODiOODlOODg+OCryAqL1xuICBwdWJsaWMgYWxlcnRUb3BpYzogc25zLlRvcGljO1xuICBcbiAgLyoqIENsb3VkV2F0Y2jjg4Djg4Pjgrfjg6Xjg5zjg7zjg4kgKi9cbiAgcHVibGljIG1vbml0b3JpbmdEYXNoYm9hcmQ6IGNsb3Vkd2F0Y2guRGFzaGJvYXJkO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBZHZhbmNlZFBlcm1pc3Npb25TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zb2xlLmxvZygn8J+UkCBBZHZhbmNlZFBlcm1pc3Npb25TdGFja+WIneacn+WMlumWi+Wniy4uLicpO1xuICAgIGNvbnNvbGUubG9nKCfwn5OdIOOCueOCv+ODg+OCr+WQjTonLCBpZCk7XG4gICAgY29uc29sZS5sb2coJ/CfjI0g55Kw5aKDOicsIHByb3BzLmVudmlyb25tZW50KTtcblxuICAgIC8vIOeSsOWig+WIpeaoqemZkOioreWumuWPluW+l1xuICAgIGNvbnN0IHBlcm1pc3Npb25Db25maWcgPSBnZXRBZHZhbmNlZFBlcm1pc3Npb25Db25maWcocHJvcHMuZW52aXJvbm1lbnQpO1xuXG4gICAgLy8gRHluYW1vRELjg4bjg7zjg5bjg6vkvZzmiJBcbiAgICB0aGlzLmNyZWF0ZUR5bmFtb0RCVGFibGVzKHByb3BzKTtcblxuICAgIC8vIOmrmOW6puaoqemZkOODleOCo+ODq+OCv+ODquODs+OCsOOCqOODs+OCuOODs+S9nOaIkFxuICAgIHRoaXMucGVybWlzc2lvbkVuZ2luZSA9IG5ldyBBZHZhbmNlZFBlcm1pc3Npb25GaWx0ZXJFbmdpbmUodGhpcywgJ1Blcm1pc3Npb25FbmdpbmUnLCB7XG4gICAgICBmaWx0ZXJDb25maWc6IHBlcm1pc3Npb25Db25maWcsXG4gICAgICBvcGVuc2VhcmNoRW5kcG9pbnQ6IHByb3BzLm9wZW5zZWFyY2hFbmRwb2ludCxcbiAgICAgIHBlcm1pc3Npb25UYWJsZU5hbWU6IHRoaXMucGVybWlzc2lvbkNvbmZpZ1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGF1ZGl0TG9nVGFibGVOYW1lOiB0aGlzLmF1ZGl0TG9nVGFibGUudGFibGVOYW1lLFxuICAgICAgZ2VvTG9jYXRpb25BcGk6IHtcbiAgICAgICAgZW5kcG9pbnQ6IHByb2Nlc3MuZW52LkdFT19MT0NBVElPTl9BUElfRU5EUE9JTlQgfHwgJ2FwaS5pcGdlb2xvY2F0aW9uLmlvJyxcbiAgICAgICAgYXBpS2V5OiBwcm9jZXNzLmVudi5HRU9fTE9DQVRJT05fQVBJX0tFWSB8fCAnJ1xuICAgICAgfSxcbiAgICAgIHByb2plY3RNYW5hZ2VtZW50QXBpOiB7XG4gICAgICAgIGVuZHBvaW50OiBwcm9jZXNzLmVudi5QUk9KRUNUX01BTkFHRU1FTlRfQVBJX0VORFBPSU5UIHx8ICdhcGkucHJvamVjdG1hbmFnZW1lbnQuaW50ZXJuYWwnLFxuICAgICAgICBhcGlLZXk6IHByb2Nlc3MuZW52LlBST0pFQ1RfTUFOQUdFTUVOVF9BUElfS0VZIHx8ICcnXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyDmqKnpmZDnrqHnkIZBUEnkvZzmiJBcbiAgICB0aGlzLmNyZWF0ZVBlcm1pc3Npb25NYW5hZ2VtZW50QXBpKHByb3BzLCBwZXJtaXNzaW9uQ29uZmlnKTtcblxuICAgIC8vIOebo+imluODu+OCouODqeODvOODiOOCt+OCueODhuODoOS9nOaIkFxuICAgIHRoaXMuY3JlYXRlTW9uaXRvcmluZ1N5c3RlbShwcm9wcyk7XG5cbiAgICAvLyBDbG91ZFdhdGNo44OA44OD44K344Ol44Oc44O844OJ5L2c5oiQXG4gICAgdGhpcy5jcmVhdGVEYXNoYm9hcmQocHJvcHMpO1xuXG4gICAgLy8g44K544K/44OD44Kv5Ye65Yqb5L2c5oiQXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG5cbiAgICAvLyDjgr/jgrDoqK3lrppcbiAgICB0aGlzLmFkZFN0YWNrVGFncygpO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBBZHZhbmNlZFBlcm1pc3Npb25TdGFja+WIneacn+WMluWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIER5bmFtb0RC44OG44O844OW44Or5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUR5bmFtb0RCVGFibGVzKHByb3BzOiBBZHZhbmNlZFBlcm1pc3Npb25TdGFja1Byb3BzKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/Cfl4TvuI8gRHluYW1vRELjg4bjg7zjg5bjg6vkvZzmiJDplovlp4suLi4nKTtcblxuICAgIC8vIOaoqemZkOioreWumuODhuODvOODluODq1xuICAgIHRoaXMucGVybWlzc2lvbkNvbmZpZ1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdQZXJtaXNzaW9uQ29uZmlnVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke3Byb3BzLmNvbmZpZy5wcm9qZWN0Lm5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXBlcm1pc3Npb24tY29uZmlnYCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnY29uZmlnVHlwZScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnY29uZmlnSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgZW5jcnlwdGlvbjogcHJvcHMua21zS2V5QXJuID8gXG4gICAgICAgIGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5DVVNUT01FUl9NQU5BR0VEIDogXG4gICAgICAgIGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1lcbiAgICB9KTtcblxuICAgIC8vIOODpuODvOOCtuODvOODl+ODreODleOCoeOCpOODq+ODhuODvOODluODq1xuICAgIHRoaXMudXNlclByb2ZpbGVUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVXNlclByb2ZpbGVUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYCR7cHJvcHMuY29uZmlnLnByb2plY3QubmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tdXNlci1wcm9maWxlc2AsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3VzZXJJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWUsXG4gICAgICBlbmNyeXB0aW9uOiBwcm9wcy5rbXNLZXlBcm4gPyBcbiAgICAgICAgZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkNVU1RPTUVSX01BTkFHRUQgOiBcbiAgICAgICAgZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgIH0pO1xuXG4gICAgLy8gR1NJIGZvciBvcmdhbml6YXRpb24gcXVlcmllc1xuICAgIHRoaXMudXNlclByb2ZpbGVUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdPcmdhbml6YXRpb25JbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ29yZ2FuaXphdGlvbicsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnZGVwYXJ0bWVudCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyDnm6Pmn7vjg63jgrDjg4bjg7zjg5bjg6tcbiAgICB0aGlzLmF1ZGl0TG9nVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0F1ZGl0TG9nVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke3Byb3BzLmNvbmZpZy5wcm9qZWN0Lm5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWF1ZGl0LWxvZ3NgLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICd1c2VySWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCcsXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgIGVuY3J5cHRpb246IHByb3BzLmttc0tleUFybiA/IFxuICAgICAgICBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQ1VTVE9NRVJfTUFOQUdFRCA6IFxuICAgICAgICBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZXG4gICAgfSk7XG5cbiAgICAvLyBHU0kgZm9yIGF1ZGl0IHF1ZXJpZXNcbiAgICB0aGlzLmF1ZGl0TG9nVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnQWN0aW9uSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdhY3Rpb24nLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLmF1ZGl0TG9nVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnUmVzb3VyY2VJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3Jlc291cmNlJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc29sZS5sb2coJ+KchSBEeW5hbW9EQuODhuODvOODluODq+S9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOaoqemZkOeuoeeQhkFQSeS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVQZXJtaXNzaW9uTWFuYWdlbWVudEFwaShcbiAgICBwcm9wczogQWR2YW5jZWRQZXJtaXNzaW9uU3RhY2tQcm9wcywgXG4gICAgcGVybWlzc2lvbkNvbmZpZzogUGVybWlzc2lvbkZpbHRlckNvbmZpZ1xuICApOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZygn8J+UpyDmqKnpmZDnrqHnkIZBUEnkvZzmiJDplovlp4suLi4nKTtcblxuICAgIC8vIExhbWJkYeWun+ihjOODreODvOODq1xuICAgIGNvbnN0IGFwaUV4ZWN1dGlvblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1Blcm1pc3Npb25BcGlFeGVjdXRpb25Sb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJylcbiAgICAgIF0sXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xuICAgICAgICBEeW5hbW9EQkFjY2VzczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6R2V0SXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlB1dEl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpVcGRhdGVJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6RGVsZXRlSXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlF1ZXJ5JyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6U2NhbicsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkJhdGNoR2V0SXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkJhdGNoV3JpdGVJdGVtJ1xuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICB0aGlzLnBlcm1pc3Npb25Db25maWdUYWJsZS50YWJsZUFybixcbiAgICAgICAgICAgICAgICB0aGlzLnVzZXJQcm9maWxlVGFibGUudGFibGVBcm4sXG4gICAgICAgICAgICAgICAgdGhpcy5hdWRpdExvZ1RhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgICAgICAgIGAke3RoaXMucGVybWlzc2lvbkNvbmZpZ1RhYmxlLnRhYmxlQXJufS9pbmRleC8qYCxcbiAgICAgICAgICAgICAgICBgJHt0aGlzLnVzZXJQcm9maWxlVGFibGUudGFibGVBcm59L2luZGV4LypgLFxuICAgICAgICAgICAgICAgIGAke3RoaXMuYXVkaXRMb2dUYWJsZS50YWJsZUFybn0vaW5kZXgvKmBcbiAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICBdXG4gICAgICAgIH0pLFxuICAgICAgICBMYW1iZGFJbnZva2VBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbJ2xhbWJkYTpJbnZva2VGdW5jdGlvbiddLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICB0aGlzLnBlcm1pc3Npb25FbmdpbmUucGVybWlzc2lvbkZpbHRlckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICAgICAgICAgIHRoaXMucGVybWlzc2lvbkVuZ2luZS50aW1lQmFzZWRDaGVja0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICAgICAgICAgIHRoaXMucGVybWlzc2lvbkVuZ2luZS5nZW9ncmFwaGljQ2hlY2tGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgICAgICAgICB0aGlzLnBlcm1pc3Npb25FbmdpbmUuZHluYW1pY1Blcm1pc3Npb25VcGRhdGVGdW5jdGlvbi5mdW5jdGlvbkFyblxuICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIOaoqemZkOeuoeeQhkFQSSBMYW1iZGHplqLmlbBcbiAgICB0aGlzLnBlcm1pc3Npb25NYW5hZ2VtZW50QXBpID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUGVybWlzc2lvbk1hbmFnZW1lbnRBcGknLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUodGhpcy5nZXRQZXJtaXNzaW9uTWFuYWdlbWVudEFwaUNvZGUoKSksXG4gICAgICByb2xlOiBhcGlFeGVjdXRpb25Sb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFBFUk1JU1NJT05fQ09ORklHX1RBQkxFOiB0aGlzLnBlcm1pc3Npb25Db25maWdUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFVTRVJfUFJPRklMRV9UQUJMRTogdGhpcy51c2VyUHJvZmlsZVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQVVESVRfTE9HX1RBQkxFOiB0aGlzLmF1ZGl0TG9nVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQRVJNSVNTSU9OX0ZJTFRFUl9GVU5DVElPTjogdGhpcy5wZXJtaXNzaW9uRW5naW5lLnBlcm1pc3Npb25GaWx0ZXJGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgUFJPSkVDVF9OQU1FOiBwcm9wcy5jb25maWcucHJvamVjdC5uYW1lXG4gICAgICB9LFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRIXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIOaoqemZkOeuoeeQhkFQSeS9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOebo+imluODu+OCouODqeODvOODiOOCt+OCueODhuODoOS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVNb25pdG9yaW5nU3lzdGVtKHByb3BzOiBBZHZhbmNlZFBlcm1pc3Npb25TdGFja1Byb3BzKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/Cfk4og55uj6KaW44O744Ki44Op44O844OI44K344K544OG44Og5L2c5oiQ6ZaL5aeLLi4uJyk7XG5cbiAgICAvLyBTTlPjg4jjg5Tjg4Pjgq/kvZzmiJBcbiAgICB0aGlzLmFsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdQZXJtaXNzaW9uQWxlcnRUb3BpYycsIHtcbiAgICAgIHRvcGljTmFtZTogYCR7cHJvcHMuY29uZmlnLnByb2plY3QubmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tcGVybWlzc2lvbi1hbGVydHNgLFxuICAgICAgZGlzcGxheU5hbWU6ICdBZHZhbmNlZCBQZXJtaXNzaW9uIENvbnRyb2wgQWxlcnRzJ1xuICAgIH0pO1xuXG4gICAgLy8g44Oh44O844Or6YCa55+l6Kit5a6a77yI55Kw5aKD5aSJ5pWw44GL44KJ5Y+W5b6X77yJXG4gICAgY29uc3QgYWxlcnRFbWFpbCA9IHByb2Nlc3MuZW52LlNFQ1VSSVRZX0FMRVJUX0VNQUlMO1xuICAgIGlmIChhbGVydEVtYWlsKSB7XG4gICAgICB0aGlzLmFsZXJ0VG9waWMuYWRkU3Vic2NyaXB0aW9uKFxuICAgICAgICBuZXcgc3Vic2NyaXB0aW9ucy5FbWFpbFN1YnNjcmlwdGlvbihhbGVydEVtYWlsKVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZFdhdGNo44Ki44Op44O844Og5L2c5oiQXG4gICAgdGhpcy5jcmVhdGVDbG91ZFdhdGNoQWxhcm1zKCk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIOebo+imluODu+OCouODqeODvOODiOOCt+OCueODhuODoOS9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIENsb3VkV2F0Y2jjgqLjg6njg7zjg6DkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQ2xvdWRXYXRjaEFsYXJtcygpOiB2b2lkIHtcbiAgICAvLyDmqKnpmZDjg5XjgqPjg6vjgr/jg6rjg7PjgrDplqLmlbDjga7jgqjjg6njg7znjofjgqLjg6njg7zjg6BcbiAgICBjb25zdCBmaWx0ZXJGdW5jdGlvbkVycm9yQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnUGVybWlzc2lvbkZpbHRlckVycm9yQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1QZXJtaXNzaW9uRmlsdGVyLUVycm9yUmF0ZWAsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAn5qip6ZmQ44OV44Kj44Or44K/44Oq44Oz44Kw6Zai5pWw44Gu44Ko44Op44O8546H44GM6auY44GEJyxcbiAgICAgIG1ldHJpYzogdGhpcy5wZXJtaXNzaW9uRW5naW5lLnBlcm1pc3Npb25GaWx0ZXJGdW5jdGlvbi5tZXRyaWNFcnJvcnMoe1xuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogMTAsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HXG4gICAgfSk7XG5cbiAgICBmaWx0ZXJGdW5jdGlvbkVycm9yQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxlcnRUb3BpYylcbiAgICApO1xuXG4gICAgLy8g5qip6ZmQ44OV44Kj44Or44K/44Oq44Oz44Kw6Zai5pWw44Gu5a6f6KGM5pmC6ZaT44Ki44Op44O844OgXG4gICAgY29uc3QgZmlsdGVyRnVuY3Rpb25EdXJhdGlvbkFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ1Blcm1pc3Npb25GaWx0ZXJEdXJhdGlvbkFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tUGVybWlzc2lvbkZpbHRlci1EdXJhdGlvbmAsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAn5qip6ZmQ44OV44Kj44Or44K/44Oq44Oz44Kw6Zai5pWw44Gu5a6f6KGM5pmC6ZaT44GM6ZW344GEJyxcbiAgICAgIG1ldHJpYzogdGhpcy5wZXJtaXNzaW9uRW5naW5lLnBlcm1pc3Npb25GaWx0ZXJGdW5jdGlvbi5tZXRyaWNEdXJhdGlvbih7XG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSlcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAyNTAwMCwgLy8gMjXnp5JcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAzLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkdcbiAgICB9KTtcblxuICAgIGZpbHRlckZ1bmN0aW9uRHVyYXRpb25BbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGVydFRvcGljKVxuICAgICk7XG5cbiAgICAvLyBEeW5hbW9EQuiqreOBv+WPluOCiuOCueODreODg+ODiOODquODs+OCsOOCouODqeODvOODoFxuICAgIGNvbnN0IGR5bmFtb1JlYWRUaHJvdHRsZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0R5bmFtb1JlYWRUaHJvdHRsZUFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRHluYW1vREItUmVhZFRocm90dGxlYCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdEeW5hbW9EQuiqreOBv+WPluOCiuOCueODreODg+ODiOODquODs+OCsOOBjOeZuueUnycsXG4gICAgICBtZXRyaWM6IHRoaXMuYXVkaXRMb2dUYWJsZS5tZXRyaWNVc2VyRXJyb3JzKHtcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KVxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDUsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HXG4gICAgfSk7XG5cbiAgICBkeW5hbW9SZWFkVGhyb3R0bGVBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGVydFRvcGljKVxuICAgICk7XG5cbiAgICAvLyDnlbDluLjjgarjgqLjgq/jgrvjgrnoqabooYzjgqLjg6njg7zjg6DvvIjjgqvjgrnjgr/jg6Djg6Hjg4jjg6rjgq/jgrnvvIlcbiAgICBjb25zdCBzdXNwaWNpb3VzQWNjZXNzQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnU3VzcGljaW91c0FjY2Vzc0FsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tU3VzcGljaW91c0FjY2Vzc2AsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAn55Ww5bi444Gq44Ki44Kv44K744K56Kmm6KGM44GM5qSc5Ye644GV44KM44G+44GX44GfJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQWR2YW5jZWRQZXJtaXNzaW9uQ29udHJvbCcsXG4gICAgICAgIG1ldHJpY05hbWU6ICdTdXNwaWNpb3VzQWNjZXNzQXR0ZW1wdHMnLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgRW52aXJvbm1lbnQ6IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdlbnZpcm9ubWVudCcpIHx8ICd1bmtub3duJ1xuICAgICAgICB9LFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICBzdGF0aXN0aWM6ICdTdW0nXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogMjAsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HXG4gICAgfSk7XG5cbiAgICBzdXNwaWNpb3VzQWNjZXNzQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxlcnRUb3BpYylcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIENsb3VkV2F0Y2jjg4Djg4Pjgrfjg6Xjg5zjg7zjg4nkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRGFzaGJvYXJkKHByb3BzOiBBZHZhbmNlZFBlcm1pc3Npb25TdGFja1Byb3BzKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/Cfk4ggQ2xvdWRXYXRjaOODgOODg+OCt+ODpeODnOODvOODieS9nOaIkOmWi+Wniy4uLicpO1xuXG4gICAgdGhpcy5tb25pdG9yaW5nRGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdQZXJtaXNzaW9uQ29udHJvbERhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6IGAke3Byb3BzLmNvbmZpZy5wcm9qZWN0Lm5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LXBlcm1pc3Npb24tY29udHJvbGAsXG4gICAgICB3aWRnZXRzOiBbXG4gICAgICAgIFtcbiAgICAgICAgICAvLyDmqKnpmZDjg5XjgqPjg6vjgr/jg6rjg7PjgrDplqLmlbDjg6Hjg4jjg6rjgq/jgrlcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgICB0aXRsZTogJ+aoqemZkOODleOCo+ODq+OCv+ODquODs+OCsOmWouaVsCAtIOWun+ihjOWbnuaVsCcsXG4gICAgICAgICAgICBsZWZ0OiBbdGhpcy5wZXJtaXNzaW9uRW5naW5lLnBlcm1pc3Npb25GaWx0ZXJGdW5jdGlvbi5tZXRyaWNJbnZvY2F0aW9ucygpXSxcbiAgICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICAgIGhlaWdodDogNlxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAn5qip6ZmQ44OV44Kj44Or44K/44Oq44Oz44Kw6Zai5pWwIC0g44Ko44Op44O8546HJyxcbiAgICAgICAgICAgIGxlZnQ6IFt0aGlzLnBlcm1pc3Npb25FbmdpbmUucGVybWlzc2lvbkZpbHRlckZ1bmN0aW9uLm1ldHJpY0Vycm9ycygpXSxcbiAgICAgICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgICAgIGhlaWdodDogNlxuICAgICAgICAgIH0pXG4gICAgICAgIF0sXG4gICAgICAgIFtcbiAgICAgICAgICAvLyBEeW5hbW9EQuODoeODiOODquOCr+OCuVxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAnRHluYW1vREIgLSDoqq3jgb/lj5bjgorlrrnph48nLFxuICAgICAgICAgICAgbGVmdDogW1xuICAgICAgICAgICAgICB0aGlzLnBlcm1pc3Npb25Db25maWdUYWJsZS5tZXRyaWNDb25zdW1lZFJlYWRDYXBhY2l0eVVuaXRzKCksXG4gICAgICAgICAgICAgIHRoaXMudXNlclByb2ZpbGVUYWJsZS5tZXRyaWNDb25zdW1lZFJlYWRDYXBhY2l0eVVuaXRzKCksXG4gICAgICAgICAgICAgIHRoaXMuYXVkaXRMb2dUYWJsZS5tZXRyaWNDb25zdW1lZFJlYWRDYXBhY2l0eVVuaXRzKClcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgICAgICBoZWlnaHQ6IDZcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgICB0aXRsZTogJ0R5bmFtb0RCIC0g5pu444GN6L6844G/5a656YePJyxcbiAgICAgICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICAgICAgdGhpcy5wZXJtaXNzaW9uQ29uZmlnVGFibGUubWV0cmljQ29uc3VtZWRXcml0ZUNhcGFjaXR5VW5pdHMoKSxcbiAgICAgICAgICAgICAgdGhpcy51c2VyUHJvZmlsZVRhYmxlLm1ldHJpY0NvbnN1bWVkV3JpdGVDYXBhY2l0eVVuaXRzKCksXG4gICAgICAgICAgICAgIHRoaXMuYXVkaXRMb2dUYWJsZS5tZXRyaWNDb25zdW1lZFdyaXRlQ2FwYWNpdHlVbml0cygpXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICAgICAgaGVpZ2h0OiA2XG4gICAgICAgICAgfSlcbiAgICAgICAgXSxcbiAgICAgICAgW1xuICAgICAgICAgIC8vIOOCq+OCueOCv+ODoOODoeODiOODquOCr+OCuVxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLlNpbmdsZVZhbHVlV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAn5LuK5pel44Gu44Ki44Kv44K744K56Kmm6KGM5pWwJyxcbiAgICAgICAgICAgIG1ldHJpY3M6IFtcbiAgICAgICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgICAgICBuYW1lc3BhY2U6ICdBZHZhbmNlZFBlcm1pc3Npb25Db250cm9sJyxcbiAgICAgICAgICAgICAgICBtZXRyaWNOYW1lOiAnQWNjZXNzQXR0ZW1wdHMnLFxuICAgICAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24uaG91cnMoMjQpXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgd2lkdGg6IDYsXG4gICAgICAgICAgICBoZWlnaHQ6IDZcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5TaW5nbGVWYWx1ZVdpZGdldCh7XG4gICAgICAgICAgICB0aXRsZTogJ+S7iuaXpeOBruaLkuWQpuOBleOCjOOBn+OCouOCr+OCu+OCuScsXG4gICAgICAgICAgICBtZXRyaWNzOiBbXG4gICAgICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICAgICAgbmFtZXNwYWNlOiAnQWR2YW5jZWRQZXJtaXNzaW9uQ29udHJvbCcsXG4gICAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ0FjY2Vzc0RlbmllZCcsXG4gICAgICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygyNClcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB3aWR0aDogNixcbiAgICAgICAgICAgIGhlaWdodDogNlxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLlNpbmdsZVZhbHVlV2lkZ2V0KHtcbiAgICAgICAgICAgIHRpdGxlOiAn44Ki44Kv44OG44Kj44OW44Om44O844K244O85pWwJyxcbiAgICAgICAgICAgIG1ldHJpY3M6IFtcbiAgICAgICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgICAgICBuYW1lc3BhY2U6ICdBZHZhbmNlZFBlcm1pc3Npb25Db250cm9sJyxcbiAgICAgICAgICAgICAgICBtZXRyaWNOYW1lOiAnQWN0aXZlVXNlcnMnLFxuICAgICAgICAgICAgICAgIHN0YXRpc3RpYzogJ01heGltdW0nLFxuICAgICAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgd2lkdGg6IDYsXG4gICAgICAgICAgICBoZWlnaHQ6IDZcbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5TaW5nbGVWYWx1ZVdpZGdldCh7XG4gICAgICAgICAgICB0aXRsZTogJ+eVsOW4uOOCouOCr+OCu+OCueaknOWHuuaVsCcsXG4gICAgICAgICAgICBtZXRyaWNzOiBbXG4gICAgICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICAgICAgbmFtZXNwYWNlOiAnQWR2YW5jZWRQZXJtaXNzaW9uQ29udHJvbCcsXG4gICAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ1N1c3BpY2lvdXNBY2Nlc3NBdHRlbXB0cycsXG4gICAgICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygyNClcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB3aWR0aDogNixcbiAgICAgICAgICAgIGhlaWdodDogNlxuICAgICAgICAgIH0pXG4gICAgICAgIF1cbiAgICAgIF1cbiAgICB9KTtcblxuICAgIGNvbnNvbGUubG9nKCfinIUgQ2xvdWRXYXRjaOODgOODg+OCt+ODpeODnOODvOODieS9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCueOCv+ODg+OCr+WHuuWKm+S9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCk6IHZvaWQge1xuICAgIC8vIOaoqemZkOODleOCo+ODq+OCv+ODquODs+OCsOmWouaVsEFSTlxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQZXJtaXNzaW9uRmlsdGVyRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5wZXJtaXNzaW9uRW5naW5lLnBlcm1pc3Npb25GaWx0ZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGVybWlzc2lvbiBGaWx0ZXIgRnVuY3Rpb24gQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1QZXJtaXNzaW9uRmlsdGVyRnVuY3Rpb25Bcm5gXG4gICAgfSk7XG5cbiAgICAvLyDmqKnpmZDnrqHnkIZBUEkgQVJOXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Blcm1pc3Npb25NYW5hZ2VtZW50QXBpQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMucGVybWlzc2lvbk1hbmFnZW1lbnRBcGkuZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24gTWFuYWdlbWVudCBBUEkgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1QZXJtaXNzaW9uTWFuYWdlbWVudEFwaUFybmBcbiAgICB9KTtcblxuICAgIC8vIER5bmFtb0RC44OG44O844OW44Or5ZCNXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Blcm1pc3Npb25Db25maWdUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5wZXJtaXNzaW9uQ29uZmlnVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdQZXJtaXNzaW9uIENvbmZpZyBUYWJsZSBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1QZXJtaXNzaW9uQ29uZmlnVGFibGVOYW1lYFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQcm9maWxlVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclByb2ZpbGVUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgUHJvZmlsZSBUYWJsZSBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Vc2VyUHJvZmlsZVRhYmxlTmFtZWBcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBdWRpdExvZ1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmF1ZGl0TG9nVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdBdWRpdCBMb2cgVGFibGUgTmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQXVkaXRMb2dUYWJsZU5hbWVgXG4gICAgfSk7XG5cbiAgICAvLyBTTlPjg4jjg5Tjg4Pjgq9BUk5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWxlcnRUb3BpY0FybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1Blcm1pc3Npb24gQWxlcnQgVG9waWMgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BbGVydFRvcGljQXJuYFxuICAgIH0pO1xuXG4gICAgLy8g44OA44OD44K344Ol44Oc44O844OJVVJMXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rhc2hib2FyZFVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke3RoaXMucmVnaW9ufS5jb25zb2xlLmF3cy5hbWF6b24uY29tL2Nsb3Vkd2F0Y2gvaG9tZT9yZWdpb249JHt0aGlzLnJlZ2lvbn0jZGFzaGJvYXJkczpuYW1lPSR7dGhpcy5tb25pdG9yaW5nRGFzaGJvYXJkLmRhc2hib2FyZE5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRXYXRjaCBEYXNoYm9hcmQgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1EYXNoYm9hcmRVcmxgXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygn8J+TpCBBZHZhbmNlZFBlcm1pc3Npb25TdGFja+WHuuWKm+WApOS9nOaIkOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCueOCv+ODg+OCr+OCv+OCsOioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBhZGRTdGFja1RhZ3MoKTogdm9pZCB7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNb2R1bGUnLCAnQWR2YW5jZWRQZXJtaXNzaW9uQ29udHJvbCcpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU3RhY2tUeXBlJywgJ0ludGVncmF0ZWQnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0FyY2hpdGVjdHVyZScsICdNb2R1bGFyJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNYW5hZ2VkQnknLCAnQ0RLJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTZWN1cml0eUxldmVsJywgJ0VudGVycHJpc2UnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Blcm1pc3Npb25Db250cm9sJywgJ0FkdmFuY2VkJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNb25pdG9yaW5nRW5hYmxlZCcsICdZZXMnKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZygn8J+Pt++4jyBBZHZhbmNlZFBlcm1pc3Npb25TdGFja+OCv+OCsOioreWumuWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOaoqemZkOeuoeeQhkFQSSBMYW1iZGHplqLmlbDjgrPjg7zjg4lcbiAgICovXG4gIHByaXZhdGUgZ2V0UGVybWlzc2lvbk1hbmFnZW1lbnRBcGlDb2RlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBcbmNvbnN0IEFXUyA9IHJlcXVpcmUoJ2F3cy1zZGsnKTtcbmNvbnN0IGR5bmFtb2RiID0gbmV3IEFXUy5EeW5hbW9EQi5Eb2N1bWVudENsaWVudCgpO1xuY29uc3QgbGFtYmRhID0gbmV3IEFXUy5MYW1iZGEoKTtcblxuZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gIGNvbnNvbGUubG9nKCfwn5SQIOaoqemZkOeuoeeQhkFQSeWRvOOBs+WHuuOBlzonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICBcbiAgdHJ5IHtcbiAgICBjb25zdCB7IGh0dHBNZXRob2QsIHBhdGgsIGJvZHksIGhlYWRlcnMsIHF1ZXJ5U3RyaW5nUGFyYW1ldGVycyB9ID0gZXZlbnQ7XG4gICAgY29uc3QgcmVxdWVzdEJvZHkgPSBib2R5ID8gSlNPTi5wYXJzZShib2R5KSA6IHt9O1xuICAgIFxuICAgIC8vIENPUlPoqK3lrppcbiAgICBjb25zdCBjb3JzSGVhZGVycyA9IHtcbiAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6ICdDb250ZW50LVR5cGUsWC1BbXotRGF0ZSxBdXRob3JpemF0aW9uLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbicsXG4gICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6ICdHRVQsUE9TVCxQVVQsREVMRVRFLE9QVElPTlMnXG4gICAgfTtcbiAgICBcbiAgICAvLyBPUFRJT05T44Oq44Kv44Ko44K544OI5Yem55CGXG4gICAgaWYgKGh0dHBNZXRob2QgPT09ICdPUFRJT05TJykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBtZXNzYWdlOiAnQ09SUyBwcmVmbGlnaHQnIH0pXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDjg6vjg7zjg4bjgqPjg7PjgrBcbiAgICBsZXQgcmVzcG9uc2U7XG4gICAgXG4gICAgaWYgKHBhdGggPT09ICcvcGVybWlzc2lvbnMvdXNlcicgJiYgaHR0cE1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgIHJlc3BvbnNlID0gYXdhaXQgZ2V0VXNlclBlcm1pc3Npb25zKHF1ZXJ5U3RyaW5nUGFyYW1ldGVycz8udXNlcklkKTtcbiAgICB9IGVsc2UgaWYgKHBhdGggPT09ICcvcGVybWlzc2lvbnMvdXNlcicgJiYgaHR0cE1ldGhvZCA9PT0gJ1BVVCcpIHtcbiAgICAgIHJlc3BvbnNlID0gYXdhaXQgdXBkYXRlVXNlclBlcm1pc3Npb25zKHJlcXVlc3RCb2R5KTtcbiAgICB9IGVsc2UgaWYgKHBhdGggPT09ICcvcGVybWlzc2lvbnMvY2hlY2snICYmIGh0dHBNZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgcmVzcG9uc2UgPSBhd2FpdCBjaGVja1Blcm1pc3Npb25zKHJlcXVlc3RCb2R5KTtcbiAgICB9IGVsc2UgaWYgKHBhdGggPT09ICcvcGVybWlzc2lvbnMvYXVkaXQnICYmIGh0dHBNZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICByZXNwb25zZSA9IGF3YWl0IGdldEF1ZGl0TG9ncyhxdWVyeVN0cmluZ1BhcmFtZXRlcnMpO1xuICAgIH0gZWxzZSBpZiAocGF0aCA9PT0gJy9wZXJtaXNzaW9ucy90ZW1wb3JhcnknICYmIGh0dHBNZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgcmVzcG9uc2UgPSBhd2FpdCBncmFudFRlbXBvcmFyeUFjY2VzcyhyZXF1ZXN0Qm9keSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3BvbnNlID0ge1xuICAgICAgICBzdGF0dXNDb2RlOiA0MDQsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdOb3QgRm91bmQnLCBtZXNzYWdlOiAn44Ko44Oz44OJ44Od44Kk44Oz44OI44GM6KaL44Gk44GL44KK44G+44Gb44KTJyB9KVxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLnJlc3BvbnNlLFxuICAgICAgaGVhZGVyczogeyAuLi5jb3JzSGVhZGVycywgLi4ucmVzcG9uc2UuaGVhZGVycyB9XG4gICAgfTtcbiAgICBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCfmqKnpmZDnrqHnkIZBUEnjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGVycm9yOiAnSW50ZXJuYWwgU2VydmVyIEVycm9yJyxcbiAgICAgICAgbWVzc2FnZTogJ+aoqemZkOeuoeeQhkFQSeWHpueQhuS4reOBq+OCqOODqeODvOOBjOeZuueUn+OBl+OBvuOBl+OBnycsXG4gICAgICAgIGRldGFpbHM6IGVycm9yLm1lc3NhZ2VcbiAgICAgIH0pXG4gICAgfTtcbiAgfVxufTtcblxuYXN5bmMgZnVuY3Rpb24gZ2V0VXNlclBlcm1pc3Npb25zKHVzZXJJZCkge1xuICBpZiAoIXVzZXJJZCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiA0MDAsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnQmFkIFJlcXVlc3QnLCBtZXNzYWdlOiAn44Om44O844K244O8SUTjgYzlv4XopoHjgafjgZknIH0pXG4gICAgfTtcbiAgfVxuICBcbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5nZXQoe1xuICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5VU0VSX1BST0ZJTEVfVEFCTEUsXG4gICAgICBLZXk6IHsgdXNlcklkIH1cbiAgICB9KS5wcm9taXNlKCk7XG4gICAgXG4gICAgaWYgKCFyZXN1bHQuSXRlbSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogNDA0LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnTm90IEZvdW5kJywgbWVzc2FnZTogJ+ODpuODvOOCtuODvOOBjOimi+OBpOOBi+OCiuOBvuOBm+OCkycgfSlcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIHVzZXI6IHJlc3VsdC5JdGVtXG4gICAgICB9KVxuICAgIH07XG4gICAgXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcign44Om44O844K244O85qip6ZmQ5Y+W5b6X44Ko44Op44O8OicsIGVycm9yKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVVc2VyUGVybWlzc2lvbnMocmVxdWVzdEJvZHkpIHtcbiAgY29uc3QgeyB1c2VySWQsIHBlcm1pc3Npb25zIH0gPSByZXF1ZXN0Qm9keTtcbiAgXG4gIGlmICghdXNlcklkIHx8ICFwZXJtaXNzaW9ucykge1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiA0MDAsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnQmFkIFJlcXVlc3QnLCBtZXNzYWdlOiAn44Om44O844K244O8SUTjgajmqKnpmZDmg4XloLHjgYzlv4XopoHjgafjgZknIH0pXG4gICAgfTtcbiAgfVxuICBcbiAgdHJ5IHtcbiAgICBjb25zdCB1cGRhdGVQYXJhbXMgPSB7XG4gICAgICBUYWJsZU5hbWU6IHByb2Nlc3MuZW52LlVTRVJfUFJPRklMRV9UQUJMRSxcbiAgICAgIEtleTogeyB1c2VySWQgfSxcbiAgICAgIFVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3Blcm1pc3Npb25zID0gOnBlcm1pc3Npb25zLCAjdXBkYXRlZEF0ID0gOnVwZGF0ZWRBdCcsXG4gICAgICBFeHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgJyNwZXJtaXNzaW9ucyc6ICdwZXJtaXNzaW9ucycsXG4gICAgICAgICcjdXBkYXRlZEF0JzogJ3VwZGF0ZWRBdCdcbiAgICAgIH0sXG4gICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6cGVybWlzc2lvbnMnOiBwZXJtaXNzaW9ucyxcbiAgICAgICAgJzp1cGRhdGVkQXQnOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgIH0sXG4gICAgICBSZXR1cm5WYWx1ZXM6ICdBTExfTkVXJ1xuICAgIH07XG4gICAgXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZHluYW1vZGIudXBkYXRlKHVwZGF0ZVBhcmFtcykucHJvbWlzZSgpO1xuICAgIFxuICAgIC8vIOebo+afu+ODreOCsOiomOmMslxuICAgIGF3YWl0IHJlY29yZEF1ZGl0TG9nKHtcbiAgICAgIHVzZXJJZCxcbiAgICAgIGFjdGlvbjogJ3VwZGF0ZV91c2VyX3Blcm1pc3Npb25zJyxcbiAgICAgIHJlc291cmNlOiAndXNlcl9wcm9maWxlJyxcbiAgICAgIGRldGFpbHM6IHsgdXBkYXRlZFBlcm1pc3Npb25zOiBwZXJtaXNzaW9ucyB9LFxuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiAn44Om44O844K244O85qip6ZmQ44GM5pu05paw44GV44KM44G+44GX44GfJyxcbiAgICAgICAgdXNlcjogcmVzdWx0LkF0dHJpYnV0ZXNcbiAgICAgIH0pXG4gICAgfTtcbiAgICBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCfjg6bjg7zjgrbjg7zmqKnpmZDmm7TmlrDjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrUGVybWlzc2lvbnMocmVxdWVzdEJvZHkpIHtcbiAgY29uc3QgeyB1c2VySWQsIHF1ZXJ5LCBpcEFkZHJlc3MsIHVzZXJBZ2VudCwgc2Vzc2lvbklkIH0gPSByZXF1ZXN0Qm9keTtcbiAgXG4gIGlmICghdXNlcklkIHx8ICFxdWVyeSkge1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiA0MDAsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnQmFkIFJlcXVlc3QnLCBtZXNzYWdlOiAn44Om44O844K244O8SUTjgajjgq/jgqjjg6rjgYzlv4XopoHjgafjgZknIH0pXG4gICAgfTtcbiAgfVxuICBcbiAgdHJ5IHtcbiAgICAvLyDmqKnpmZDjg5XjgqPjg6vjgr/jg6rjg7PjgrDplqLmlbDjgpLlkbzjgbPlh7rjgZdcbiAgICBjb25zdCBmaWx0ZXJSZXN1bHQgPSBhd2FpdCBsYW1iZGEuaW52b2tlKHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogcHJvY2Vzcy5lbnYuUEVSTUlTU0lPTl9GSUxURVJfRlVOQ1RJT04sXG4gICAgICBQYXlsb2FkOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgcXVlcnksXG4gICAgICAgIGlwQWRkcmVzcyxcbiAgICAgICAgdXNlckFnZW50LFxuICAgICAgICBzZXNzaW9uSWRcbiAgICAgIH0pXG4gICAgfSkucHJvbWlzZSgpO1xuICAgIFxuICAgIGNvbnN0IGZpbHRlclJlc3BvbnNlID0gSlNPTi5wYXJzZShmaWx0ZXJSZXN1bHQuUGF5bG9hZCk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IGZpbHRlclJlc3BvbnNlLnN0YXR1c0NvZGUgfHwgMjAwLFxuICAgICAgYm9keTogZmlsdGVyUmVzcG9uc2UuYm9keSB8fCBKU09OLnN0cmluZ2lmeShmaWx0ZXJSZXNwb25zZSlcbiAgICB9O1xuICAgIFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+aoqemZkOODgeOCp+ODg+OCr+OCqOODqeODvDonLCBlcnJvcik7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0QXVkaXRMb2dzKHF1ZXJ5UGFyYW1zKSB7XG4gIGNvbnN0IHsgdXNlcklkLCBzdGFydERhdGUsIGVuZERhdGUsIGFjdGlvbiwgbGltaXQgPSA1MCB9ID0gcXVlcnlQYXJhbXMgfHwge307XG4gIFxuICB0cnkge1xuICAgIGxldCBxdWVyeUV4cHJlc3Npb24gPSB7XG4gICAgICBUYWJsZU5hbWU6IHByb2Nlc3MuZW52LkFVRElUX0xPR19UQUJMRSxcbiAgICAgIExpbWl0OiBwYXJzZUludChsaW1pdClcbiAgICB9O1xuICAgIFxuICAgIGlmICh1c2VySWQpIHtcbiAgICAgIHF1ZXJ5RXhwcmVzc2lvbi5LZXlDb25kaXRpb25FeHByZXNzaW9uID0gJ3VzZXJJZCA9IDp1c2VySWQnO1xuICAgICAgcXVlcnlFeHByZXNzaW9uLkV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXMgPSB7ICc6dXNlcklkJzogdXNlcklkIH07XG4gICAgICBcbiAgICAgIGlmIChzdGFydERhdGUgJiYgZW5kRGF0ZSkge1xuICAgICAgICBxdWVyeUV4cHJlc3Npb24uS2V5Q29uZGl0aW9uRXhwcmVzc2lvbiArPSAnIEFORCAjdGltZXN0YW1wIEJFVFdFRU4gOnN0YXJ0RGF0ZSBBTkQgOmVuZERhdGUnO1xuICAgICAgICBxdWVyeUV4cHJlc3Npb24uRXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzID0geyAnI3RpbWVzdGFtcCc6ICd0aW1lc3RhbXAnIH07XG4gICAgICAgIHF1ZXJ5RXhwcmVzc2lvbi5FeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzWyc6c3RhcnREYXRlJ10gPSBzdGFydERhdGU7XG4gICAgICAgIHF1ZXJ5RXhwcmVzc2lvbi5FeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzWyc6ZW5kRGF0ZSddID0gZW5kRGF0ZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFjdGlvbikge1xuICAgICAgcXVlcnlFeHByZXNzaW9uLkluZGV4TmFtZSA9ICdBY3Rpb25JbmRleCc7XG4gICAgICBxdWVyeUV4cHJlc3Npb24uS2V5Q29uZGl0aW9uRXhwcmVzc2lvbiA9ICdhY3Rpb24gPSA6YWN0aW9uJztcbiAgICAgIHF1ZXJ5RXhwcmVzc2lvbi5FeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzID0geyAnOmFjdGlvbic6IGFjdGlvbiB9O1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyDlhajkvZPjgrnjgq3jg6Pjg7PvvIjliLbpmZDku5jjgY3vvIlcbiAgICAgIHF1ZXJ5RXhwcmVzc2lvbiA9IHtcbiAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5BVURJVF9MT0dfVEFCTEUsXG4gICAgICAgIExpbWl0OiBwYXJzZUludChsaW1pdClcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtb2RiLnNjYW4ocXVlcnlFeHByZXNzaW9uKS5wcm9taXNlKCk7XG4gICAgICBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgbG9nczogcmVzdWx0Lkl0ZW1zLFxuICAgICAgICAgIGNvdW50OiByZXN1bHQuSXRlbXMubGVuZ3RoXG4gICAgICAgIH0pXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5xdWVyeShxdWVyeUV4cHJlc3Npb24pLnByb21pc2UoKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBsb2dzOiByZXN1bHQuSXRlbXMsXG4gICAgICAgIGNvdW50OiByZXN1bHQuSXRlbXMubGVuZ3RoXG4gICAgICB9KVxuICAgIH07XG4gICAgXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcign55uj5p+744Ot44Kw5Y+W5b6X44Ko44Op44O8OicsIGVycm9yKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBncmFudFRlbXBvcmFyeUFjY2VzcyhyZXF1ZXN0Qm9keSkge1xuICBjb25zdCB7IHVzZXJJZCwgcmVzb3VyY2VJZCwgZHVyYXRpb25Ib3VycywgcmVhc29uLCBncmFudGVkQnkgfSA9IHJlcXVlc3RCb2R5O1xuICBcbiAgaWYgKCF1c2VySWQgfHwgIXJlc291cmNlSWQgfHwgIWR1cmF0aW9uSG91cnMgfHwgIXJlYXNvbiB8fCAhZ3JhbnRlZEJ5KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDQwMCxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgIGVycm9yOiAnQmFkIFJlcXVlc3QnLCBcbiAgICAgICAgbWVzc2FnZTogJ+ODpuODvOOCtuODvElE44CB44Oq44K944O844K5SUTjgIHmnJ/plpPjgIHnkIbnlLHjgIHmib/oqo3ogIXjgYzlv4XopoHjgafjgZknIFxuICAgICAgfSlcbiAgICB9O1xuICB9XG4gIFxuICB0cnkge1xuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgZXhwaXJlc0F0ID0gbmV3IERhdGUobm93LmdldFRpbWUoKSArIChkdXJhdGlvbkhvdXJzICogNjAgKiA2MCAqIDEwMDApKTtcbiAgICBcbiAgICBjb25zdCB0ZW1wQWNjZXNzSXRlbSA9IHtcbiAgICAgIHVzZXJJZCxcbiAgICAgIHJlc291cmNlSWQ6IFxcYHRlbXBfYWNjZXNzX1xcJHtyZXNvdXJjZUlkfVxcYCxcbiAgICAgIHBlcm1pc3Npb25zOiBbJ3RlbXBvcmFyeV9hY2Nlc3MnXSxcbiAgICAgIGdyYW50ZWRBdDogbm93LnRvSVNPU3RyaW5nKCksXG4gICAgICBleHBpcmVzQXQ6IGV4cGlyZXNBdC50b0lTT1N0cmluZygpLFxuICAgICAgZHVyYXRpb25Ib3VycyxcbiAgICAgIHJlYXNvbixcbiAgICAgIGdyYW50ZWRCeSxcbiAgICAgIHN0YXR1czogJ2FjdGl2ZScsXG4gICAgICB0dGw6IE1hdGguZmxvb3IoZXhwaXJlc0F0LmdldFRpbWUoKSAvIDEwMDApXG4gICAgfTtcbiAgICBcbiAgICBhd2FpdCBkeW5hbW9kYi5wdXQoe1xuICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5QRVJNSVNTSU9OX0NPTkZJR19UQUJMRSxcbiAgICAgIEl0ZW06IHtcbiAgICAgICAgY29uZmlnVHlwZTogJ3RlbXBvcmFyeV9hY2Nlc3MnLFxuICAgICAgICBjb25maWdJZDogXFxgXFwke3VzZXJJZH1fXFwke3Jlc291cmNlSWR9X1xcJHtub3cuZ2V0VGltZSgpfVxcYCxcbiAgICAgICAgLi4udGVtcEFjY2Vzc0l0ZW1cbiAgICAgIH1cbiAgICB9KS5wcm9taXNlKCk7XG4gICAgXG4gICAgLy8g55uj5p+744Ot44Kw6KiY6YyyXG4gICAgYXdhaXQgcmVjb3JkQXVkaXRMb2coe1xuICAgICAgdXNlcklkLFxuICAgICAgYWN0aW9uOiAnZ3JhbnRfdGVtcG9yYXJ5X2FjY2VzcycsXG4gICAgICByZXNvdXJjZTogcmVzb3VyY2VJZCxcbiAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgZHVyYXRpb25Ib3VycyxcbiAgICAgICAgcmVhc29uLFxuICAgICAgICBncmFudGVkQnksXG4gICAgICAgIGV4cGlyZXNBdDogZXhwaXJlc0F0LnRvSVNPU3RyaW5nKClcbiAgICAgIH0sXG4gICAgICB0aW1lc3RhbXA6IG5vdy50b0lTT1N0cmluZygpXG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgbWVzc2FnZTogJ+S4gOaZgueahOOCouOCr+OCu+OCueaoqemZkOOBjOS7mOS4juOBleOCjOOBvuOBl+OBnycsXG4gICAgICAgIHRlbXBvcmFyeUFjY2VzczogdGVtcEFjY2Vzc0l0ZW1cbiAgICAgIH0pXG4gICAgfTtcbiAgICBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCfkuIDmmYLnmoTjgqLjgq/jgrvjgrnku5jkuI7jgqjjg6njg7w6JywgZXJyb3IpO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlY29yZEF1ZGl0TG9nKGxvZ0RhdGEpIHtcbiAgdHJ5IHtcbiAgICBhd2FpdCBkeW5hbW9kYi5wdXQoe1xuICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5BVURJVF9MT0dfVEFCTEUsXG4gICAgICBJdGVtOiB7XG4gICAgICAgIC4uLmxvZ0RhdGEsXG4gICAgICAgIHR0bDogTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCkgKyAoOTAgKiAyNCAqIDYwICogNjApIC8vIDkw5pel5L+d5oyBXG4gICAgICB9XG4gICAgfSkucHJvbWlzZSgpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+ebo+afu+ODreOCsOiomOmMsuOCqOODqeODvDonLCBlcnJvcik7XG4gIH1cbn1cbiAgICBgO1xuICB9XG59Il19