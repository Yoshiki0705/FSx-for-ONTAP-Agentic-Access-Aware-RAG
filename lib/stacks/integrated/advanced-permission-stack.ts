/**
 * AdvancedPermissionStack - 高度権限制御統合スタック
 * 
 * 機能:
 * - 時間ベース制限、地理的制限、動的権限の統合管理
 * - 高度権限フィルタリングエンジンのデプロイ
 * - 権限キャッシュ・監査ログシステムの構築
 * - 既存セキュリティスタックとの連携
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

// 高度権限制御コンストラクト
import { AdvancedPermissionFilterEngine } from '../../modules/enterprise/constructs/advanced-permission-filter-engine';

// 設定インターフェース
import { PermissionFilterConfig } from '../../modules/enterprise/interfaces/permission-config';
import { getAdvancedPermissionConfig } from '../../modules/enterprise/configs/advanced-permission-config';

// CloudWatch Actions インポート
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';

export interface AdvancedPermissionStackProps extends cdk.StackProps {
  /** プロジェクト設定 */
  readonly config: any;
  
  /** 環境名 */
  readonly environment: string;
  
  /** OpenSearchドメインエンドポイント */
  readonly opensearchEndpoint: string;
  
  /** セキュリティスタックからのKMSキー */
  readonly kmsKeyArn?: string;
  
  /** 既存VPCの参照 */
  readonly vpcId?: string;
  
  /** 命名ジェネレーター */
  readonly namingGenerator?: any;
}

/**
 * 高度権限制御統合スタック
 * 
 * エンタープライズグレードの権限制御システムを統合管理
 */
export class AdvancedPermissionStack extends cdk.Stack {
  /** 高度権限フィルタリングエンジン */
  public permissionEngine: AdvancedPermissionFilterEngine;
  
  /** 権限設定テーブル */
  public permissionConfigTable: dynamodb.Table;
  
  /** ユーザープロファイルテーブル */
  public userProfileTable: dynamodb.Table;
  
  /** 監査ログテーブル */
  public auditLogTable: dynamodb.Table;
  
  /** 権限管理API Lambda */
  public permissionManagementApi: lambda.Function;
  
  /** 監視・アラート用SNSトピック */
  public alertTopic: sns.Topic;
  
  /** CloudWatchダッシュボード */
  public monitoringDashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: AdvancedPermissionStackProps) {
    super(scope, id, props);

    console.log('🔐 AdvancedPermissionStack初期化開始...');
    console.log('📝 スタック名:', id);
    console.log('🌍 環境:', props.environment);

    // 環境別権限設定取得
    const permissionConfig = getAdvancedPermissionConfig(props.environment);

    // DynamoDBテーブル作成
    this.createDynamoDBTables(props);

    // 高度権限フィルタリングエンジン作成
    this.permissionEngine = new AdvancedPermissionFilterEngine(this, 'PermissionEngine', {
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
  private createDynamoDBTables(props: AdvancedPermissionStackProps): void {
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
  private createPermissionManagementApi(
    props: AdvancedPermissionStackProps, 
    permissionConfig: PermissionFilterConfig
  ): void {
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
  private createMonitoringSystem(props: AdvancedPermissionStackProps): void {
    console.log('📊 監視・アラートシステム作成開始...');

    // SNSトピック作成
    this.alertTopic = new sns.Topic(this, 'PermissionAlertTopic', {
      topicName: `${props.config.project.name}-${props.environment}-permission-alerts`,
      displayName: 'Advanced Permission Control Alerts'
    });

    // メール通知設定（環境変数から取得）
    const alertEmail = process.env.SECURITY_ALERT_EMAIL;
    if (alertEmail) {
      this.alertTopic.addSubscription(
        new subscriptions.EmailSubscription(alertEmail)
      );
    }

    // CloudWatchアラーム作成
    this.createCloudWatchAlarms();

    console.log('✅ 監視・アラートシステム作成完了');
  }

  /**
   * CloudWatchアラーム作成
   */
  private createCloudWatchAlarms(): void {
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

    filterFunctionErrorAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alertTopic)
    );

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

    filterFunctionDurationAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alertTopic)
    );

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

    dynamoReadThrottleAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alertTopic)
    );

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

    suspiciousAccessAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(this.alertTopic)
    );
  }

  /**
   * CloudWatchダッシュボード作成
   */
  private createDashboard(props: AdvancedPermissionStackProps): void {
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
  private createOutputs(): void {
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
  private addStackTags(): void {
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
  private getPermissionManagementApiCode(): string {
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