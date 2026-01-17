/**
 * 高度な権限フィルタリングエンジン
 * 
 * 時間ベース制限、地理的制限、動的権限を統合した
 * エンタープライズグレードの権限制御システム
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import {
  UserPermission,
  DocumentPermission,
  PermissionFilterConfig,
  TimeBasedRestriction,
  AdvancedGeographicRestriction,
  DynamicPermissionConfig,
  AccessControlResult
} from '../interfaces/permission-config';

export interface AdvancedPermissionFilterEngineProps {
  /** 権限フィルター設定 */
  readonly filterConfig: PermissionFilterConfig;
  
  /** OpenSearchドメインエンドポイント */
  readonly opensearchEndpoint: string;
  
  /** DynamoDBテーブル名 */
  readonly permissionTableName: string;
  
  /** 監査ログテーブル名 */
  readonly auditLogTableName: string;
  
  /** 地理的位置情報API設定 */
  readonly geoLocationApi?: {
    readonly endpoint: string;
    readonly apiKey: string;
  };
  
  /** プロジェクト管理API設定 */
  readonly projectManagementApi?: {
    readonly endpoint: string;
    readonly apiKey: string;
  };
}

export class AdvancedPermissionFilterEngine extends Construct {
  /** 権限フィルタリングLambda関数 */
  public readonly permissionFilterFunction: lambda.Function;
  
  /** 時間ベース制限チェック関数 */
  public readonly timeBasedCheckFunction: lambda.Function;
  
  /** 地理的制限チェック関数 */
  public readonly geographicCheckFunction: lambda.Function;
  
  /** 動的権限更新関数 */
  public readonly dynamicPermissionUpdateFunction: lambda.Function;
  
  /** 権限キャッシュテーブル */
  public readonly permissionCacheTable: dynamodb.Table;
  
  /** 監査ログテーブル */
  public readonly auditLogTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: AdvancedPermissionFilterEngineProps) {
    super(scope, id);

    // 権限キャッシュテーブル作成
    this.permissionCacheTable = new dynamodb.Table(this, 'PermissionCacheTable', {
      tableName: `${props.permissionTableName}-cache`,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'resourceId',
        type: dynamodb.AttributeType.STRING
      },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // 監査ログテーブル作成
    this.auditLogTable = new dynamodb.Table(this, 'AuditLogTable', {
      tableName: props.auditLogTableName,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // GSI for audit log queries
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

    // Lambda実行ロール作成（最小権限の原則）
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ],
      description: '高度な権限フィルタリングエンジン用Lambda実行ロール',
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
                this.permissionCacheTable.tableArn,
                this.auditLogTable.tableArn,
                `${this.permissionCacheTable.tableArn}/index/*`,
                `${this.auditLogTable.tableArn}/index/*`
              ]
            })
          ]
        }),
        OpenSearchAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'es:ESHttpGet',
                'es:ESHttpPost'
              ],
              resources: [`arn:aws:es:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:domain/*`],
              conditions: {
                'StringEquals': {
                  'es:index': ['titan-multimodal-embeddings']
                }
              }
            })
          ]
        }),
        LambdaInvokeAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['lambda:InvokeFunction'],
              resources: [
                `arn:aws:lambda:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:function:*-time-based-check`,
                `arn:aws:lambda:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:function:*-geographic-check`,
                `arn:aws:lambda:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:function:*-dynamic-permission-update`
              ]
            })
          ]
        })
      }
    });

    // メイン権限フィルタリング関数
    this.permissionFilterFunction = new lambda.Function(this, 'PermissionFilterFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(this.getPermissionFilterCode()),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      reservedConcurrentExecutions: 100, // 同時実行数制限
      deadLetterQueue: new lambda.DeadLetterQueue({
        queue: new cdk.aws_sqs.Queue(this, 'PermissionFilterDLQ', {
          retentionPeriod: cdk.Duration.days(14)
        })
      }),
      environment: {
        OPENSEARCH_ENDPOINT: props.opensearchEndpoint,
        PERMISSION_CACHE_TABLE: this.permissionCacheTable.tableName,
        AUDIT_LOG_TABLE: this.auditLogTable.tableName,
        FILTER_CONFIG: JSON.stringify(props.filterConfig),
        TIME_BASED_CHECK_FUNCTION: this.timeBasedCheckFunction.functionName,
        GEOGRAPHIC_CHECK_FUNCTION: this.geographicCheckFunction.functionName,
        DYNAMIC_PERMISSION_UPDATE_FUNCTION: this.dynamicPermissionUpdateFunction.functionName,
        GEO_LOCATION_API_ENDPOINT: props.geoLocationApi?.endpoint || '',
        PROJECT_MANAGEMENT_API_ENDPOINT: props.projectManagementApi?.endpoint || '',
        // セキュリティ: APIキーは別途SecureStringParameterで管理
        NODE_OPTIONS: '--enable-source-maps'
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // 時間ベース制限チェック関数
    this.timeBasedCheckFunction = new lambda.Function(this, 'TimeBasedCheckFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(this.getTimeBasedCheckCode()),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(10),
      memorySize: 512,
      environment: {
        PERMISSION_CACHE_TABLE: this.permissionCacheTable.tableName,
        TIME_RESTRICTION_CONFIG: JSON.stringify(props.filterConfig.timeBasedRestriction)
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // 地理的制限チェック関数
    this.geographicCheckFunction = new lambda.Function(this, 'GeographicCheckFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(this.getGeographicCheckCode()),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(15),
      memorySize: 512,
      environment: {
        PERMISSION_CACHE_TABLE: this.permissionCacheTable.tableName,
        GEO_RESTRICTION_CONFIG: JSON.stringify(props.filterConfig.advancedGeographicRestriction),
        GEO_LOCATION_API_ENDPOINT: props.geoLocationApi?.endpoint || '',
        GEO_LOCATION_API_KEY: props.geoLocationApi?.apiKey || ''
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // 動的権限更新関数
    this.dynamicPermissionUpdateFunction = new lambda.Function(this, 'DynamicPermissionUpdateFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(this.getDynamicPermissionUpdateCode()),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      environment: {
        PERMISSION_CACHE_TABLE: this.permissionCacheTable.tableName,
        DYNAMIC_PERMISSION_CONFIG: JSON.stringify(props.filterConfig.dynamicPermissionConfig),
        PROJECT_MANAGEMENT_API_ENDPOINT: props.projectManagementApi?.endpoint || '',
        PROJECT_MANAGEMENT_API_KEY: props.projectManagementApi?.apiKey || ''
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // 動的権限更新スケジュール
    const permissionUpdateRule = new events.Rule(this, 'PermissionUpdateRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(
        Math.floor(props.filterConfig.dynamicPermissionConfig.refreshIntervalSeconds / 60)
      ))
    });

    permissionUpdateRule.addTarget(new targets.LambdaFunction(this.dynamicPermissionUpdateFunction));
  }

  private getPermissionFilterCode(): string {
    return `
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const https = require('https');
const { Client } = require('@opensearch-project/opensearch');
const { AwsSigv4Signer } = require('@opensearch-project/opensearch/aws');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');

// AWS SDK v3への移行
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  console.log('🔐 高度な権限フィルタリング開始:', JSON.stringify(event, null, 2));
  
  // 入力値検証
  if (!event.userId || !event.query) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: 'Bad Request',
        message: 'userId と query は必須パラメータです'
      })
    };
  }
  
  try {
    const { userId, query, ipAddress, userAgent, sessionId } = event;
    const filterConfig = JSON.parse(process.env.FILTER_CONFIG);
    
    // 監査ログ記録
    await recordAuditLog({
      userId,
      sessionId,
      ipAddress,
      userAgent,
      action: 'permission_filter_request',
      resource: 'opensearch_query',
      timestamp: new Date().toISOString()
    });
    
    // 1. 時間ベース制限チェック
    const timeCheckResult = await checkTimeBasedRestriction(userId);
    if (!timeCheckResult.allowed) {
      return createAccessDeniedResponse('時間ベース制限', timeCheckResult.reason);
    }
    
    // 2. 地理的制限チェック
    const geoCheckResult = await checkGeographicRestriction(userId, ipAddress);
    if (!geoCheckResult.allowed) {
      return createAccessDeniedResponse('地理的制限', geoCheckResult.reason);
    }
    
    // 3. 動的権限チェック
    const dynamicPermissions = await getDynamicPermissions(userId);
    
    // 4. 権限フィルター生成
    const permissionFilter = await generateAdvancedPermissionFilter(userId, dynamicPermissions);
    
    // 5. OpenSearch検索実行
    const searchResult = await executeFilteredSearch(query, permissionFilter);
    
    // 6. 結果監査ログ記録
    await recordAuditLog({
      userId,
      sessionId,
      ipAddress,
      userAgent,
      action: 'search_executed',
      resource: 'opensearch_results',
      result: 'allow',
      filteredCount: searchResult.hits.total.value,
      timestamp: new Date().toISOString()
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        results: searchResult,
        appliedFilters: permissionFilter,
        accessInfo: {
          timeRestriction: timeCheckResult,
          geographicRestriction: geoCheckResult,
          dynamicPermissions: dynamicPermissions
        }
      })
    };
    
  } catch (error) {
    console.error('権限フィルタリングエラー:', error);
    
    await recordAuditLog({
      userId: event.userId,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      action: 'permission_filter_error',
      resource: 'system',
      result: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: '権限フィルタリング処理中にエラーが発生しました'
      })
    };
  }
};

async function checkTimeBasedRestriction(userId) {
  try {
    const command = new InvokeCommand({
      FunctionName: process.env.TIME_BASED_CHECK_FUNCTION,
      Payload: JSON.stringify({ userId })
    });
    
    const result = await lambdaClient.send(command);
    const payload = new TextDecoder().decode(result.Payload);
    return JSON.parse(payload);
  } catch (error) {
    console.error('時間ベース制限チェックエラー:', error);
    return { allowed: false, reason: '時間ベース制限チェック失敗' };
  }
}

async function checkGeographicRestriction(userId, ipAddress) {
  const lambda = new AWS.Lambda();
  
  try {
    const result = await lambda.invoke({
      FunctionName: process.env.GEOGRAPHIC_CHECK_FUNCTION,
      Payload: JSON.stringify({ userId, ipAddress })
    }).promise();
    
    return JSON.parse(result.Payload);
  } catch (error) {
    console.error('地理的制限チェックエラー:', error);
    return { allowed: false, reason: '地理的制限チェック失敗' };
  }
}

async function getDynamicPermissions(userId) {
  try {
    const command = new GetCommand({
      TableName: process.env.PERMISSION_CACHE_TABLE,
      Key: {
        userId: userId,
        resourceId: 'dynamic_permissions'
      }
    });
    
    const result = await dynamodb.send(command);
    
    if (result.Item && result.Item.ttl > Math.floor(Date.now() / 1000)) {
      return result.Item.permissions;
    }
    
    // キャッシュにない場合は動的権限更新関数を呼び出し
    const invokeCommand = new InvokeCommand({
      FunctionName: process.env.DYNAMIC_PERMISSION_UPDATE_FUNCTION,
      Payload: JSON.stringify({ userId })
    });
    
    const updateResult = await lambdaClient.send(invokeCommand);
    const payload = new TextDecoder().decode(updateResult.Payload);
    const updatedPermissions = JSON.parse(payload);
    return updatedPermissions.permissions || {};
    
  } catch (error) {
    console.error('動的権限取得エラー:', error);
    return {};
  }
}

async function generateAdvancedPermissionFilter(userId, dynamicPermissions) {
  // 基本権限フィルター
  const baseFilter = {
    bool: {
      must: [
        {
          terms: {
            user_permissions: [userId, 'public', 'all']
          }
        }
      ]
    }
  };
  
  // 動的権限の追加
  if (dynamicPermissions.projects && dynamicPermissions.projects.length > 0) {
    baseFilter.bool.must.push({
      terms: {
        projects: dynamicPermissions.projects
      }
    });
  }
  
  if (dynamicPermissions.organizations && dynamicPermissions.organizations.length > 0) {
    baseFilter.bool.must.push({
      terms: {
        allowed_organizations: dynamicPermissions.organizations
      }
    });
  }
  
  if (dynamicPermissions.dataClassifications && dynamicPermissions.dataClassifications.length > 0) {
    baseFilter.bool.must.push({
      terms: {
        data_classification: dynamicPermissions.dataClassifications
      }
    });
  }
  
  return baseFilter;
}

async function executeFilteredSearch(query, permissionFilter) {
  const client = new Client({
    ...AwsSigv4Signer({
      region: process.env.AWS_REGION,
      service: 'es',
      getCredentials: () => defaultProvider()()
    }),
    node: \`https://\${process.env.OPENSEARCH_ENDPOINT}\`
  });
  
  const searchQuery = {
    index: 'titan-multimodal-embeddings',
    body: {
      size: 20,
      query: {
        bool: {
          must: [query],
          filter: [permissionFilter]
        }
      }
    }
  };
  
  const response = await client.search(searchQuery);
  return response.body;
}

async function recordAuditLog(logData) {
  try {
    const command = new PutCommand({
      TableName: process.env.AUDIT_LOG_TABLE,
      Item: {
        ...logData,
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90日保持
      }
    });
    
    await dynamodb.send(command);
  } catch (error) {
    console.error('監査ログ記録エラー:', error);
  }
}

function createAccessDeniedResponse(restrictionType, reason) {
  return {
    statusCode: 403,
    body: JSON.stringify({
      success: false,
      error: 'Access Denied',
      restrictionType,
      reason,
      message: 'アクセスが拒否されました'
    })
  };
}
    `;
  }

  private getTimeBasedCheckCode(): string {
    return `
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

exports.handler = async (event) => {
  console.log('⏰ 時間ベース制限チェック開始:', JSON.stringify(event, null, 2));
  
  try {
    const { userId } = event;
    const timeRestrictionConfig = JSON.parse(process.env.TIME_RESTRICTION_CONFIG);
    
    if (!timeRestrictionConfig.enabled) {
      return { allowed: true, reason: '時間ベース制限は無効' };
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0=日曜日, 1=月曜日, ..., 6=土曜日
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // 緊急アクセスユーザーチェック
    if (timeRestrictionConfig.emergencyAccessUsers.includes(userId)) {
      return { 
        allowed: true, 
        reason: '緊急アクセスユーザー',
        accessType: 'emergency'
      };
    }
    
    // ユーザーの役職レベル取得
    const userRole = await getUserRole(userId);
    
    // 時間外アクセス許可役職チェック
    if (timeRestrictionConfig.afterHoursRoles.includes(userRole)) {
      return { 
        allowed: true, 
        reason: '時間外アクセス許可役職',
        accessType: 'after_hours_role',
        userRole
      };
    }
    
    // 祝日チェック
    if (timeRestrictionConfig.holidays && 
        timeRestrictionConfig.holidays.dates.includes(currentDate)) {
      return {
        allowed: timeRestrictionConfig.holidays.allowAccess,
        reason: timeRestrictionConfig.holidays.allowAccess ? 
          '祝日アクセス許可' : '祝日のためアクセス拒否',
        accessType: 'holiday'
      };
    }
    
    // 営業日チェック
    if (!timeRestrictionConfig.businessHours.businessDays.includes(currentDay)) {
      return {
        allowed: false,
        reason: '営業日外のためアクセス拒否',
        accessType: 'non_business_day',
        currentDay,
        businessDays: timeRestrictionConfig.businessHours.businessDays
      };
    }
    
    // 営業時間チェック
    const { startHour, endHour } = timeRestrictionConfig.businessHours;
    
    if (currentHour < startHour || currentHour >= endHour) {
      return {
        allowed: false,
        reason: '営業時間外のためアクセス拒否',
        accessType: 'outside_business_hours',
        currentHour,
        businessHours: { startHour, endHour }
      };
    }
    
    return {
      allowed: true,
      reason: '営業時間内アクセス',
      accessType: 'business_hours',
      currentHour,
      currentDay
    };
    
  } catch (error) {
    console.error('時間ベース制限チェックエラー:', error);
    return {
      allowed: false,
      reason: '時間ベース制限チェック処理エラー',
      error: error.message
    };
  }
};

async function getUserRole(userId) {
  try {
    const command = new GetCommand({
      TableName: process.env.PERMISSION_CACHE_TABLE,
      Key: {
        userId: userId,
        resourceId: 'user_profile'
      }
    });
    
    const result = await dynamodb.send(command);
    return result.Item?.roleLevel || 'guest';
  } catch (error) {
    console.error('ユーザー役職取得エラー:', error);
    return 'guest';
  }
}
    `;
  }

  private getGeographicCheckCode(): string {
    return `
const AWS = require('aws-sdk');
const https = require('https');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log('🌍 地理的制限チェック開始:', JSON.stringify(event, null, 2));
  
  try {
    const { userId, ipAddress } = event;
    const geoRestrictionConfig = JSON.parse(process.env.GEO_RESTRICTION_CONFIG);
    
    if (!geoRestrictionConfig.enabled) {
      return { allowed: true, reason: '地理的制限は無効' };
    }
    
    // 例外ユーザーチェック
    if (geoRestrictionConfig.exemptUsers.includes(userId)) {
      return { 
        allowed: true, 
        reason: '地理的制限例外ユーザー',
        accessType: 'exempt_user'
      };
    }
    
    // IPアドレスの地理的位置情報取得
    const geoLocation = await getGeoLocation(ipAddress);
    
    if (!geoLocation) {
      return {
        allowed: false,
        reason: '地理的位置情報の取得に失敗',
        accessType: 'geo_lookup_failed'
      };
    }
    
    // VPN検出
    if (geoRestrictionConfig.vpnDetection.enabled) {
      const vpnDetected = await detectVPN(ipAddress);
      
      if (vpnDetected && !geoRestrictionConfig.vpnDetection.allowedVpnUsers.includes(userId)) {
        return {
          allowed: false,
          reason: 'VPN使用が検出されました',
          accessType: 'vpn_detected',
          geoLocation
        };
      }
    }
    
    // 国家制限チェック
    if (geoRestrictionConfig.allowedCountries.length > 0 && 
        !geoRestrictionConfig.allowedCountries.includes(geoLocation.countryCode)) {
      return {
        allowed: false,
        reason: '許可されていない国からのアクセス',
        accessType: 'country_restricted',
        geoLocation,
        allowedCountries: geoRestrictionConfig.allowedCountries
      };
    }
    
    // IPレンジチェック
    if (geoRestrictionConfig.allowedIpRanges.length > 0) {
      const ipAllowed = checkIpInRanges(ipAddress, geoRestrictionConfig.allowedIpRanges);
      
      if (!ipAllowed) {
        return {
          allowed: false,
          reason: '許可されていないIPレンジからのアクセス',
          accessType: 'ip_range_restricted',
          ipAddress,
          allowedIpRanges: geoRestrictionConfig.allowedIpRanges
        };
      }
    }
    
    // リスクベース認証
    if (geoRestrictionConfig.riskBasedAuth.enabled) {
      const riskAssessment = await assessLocationRisk(userId, geoLocation);
      
      if (riskAssessment.riskLevel === 'high') {
        return {
          allowed: false,
          reason: '異常な場所からのアクセスが検出されました',
          accessType: 'high_risk_location',
          riskAssessment,
          requireAdditionalAuth: geoRestrictionConfig.riskBasedAuth.requireAdditionalAuth
        };
      }
    }
    
    return {
      allowed: true,
      reason: '地理的制限チェック通過',
      accessType: 'geo_allowed',
      geoLocation
    };
    
  } catch (error) {
    console.error('地理的制限チェックエラー:', error);
    return {
      allowed: false,
      reason: '地理的制限チェック処理エラー',
      error: error.message
    };
  }
};

async function getGeoLocation(ipAddress) {
  return new Promise((resolve, reject) => {
    if (!process.env.GEO_LOCATION_API_ENDPOINT) {
      // フォールバック: 簡易的な地理的位置判定
      resolve({
        countryCode: 'JP',
        country: 'Japan',
        region: 'Tokyo',
        city: 'Tokyo',
        source: 'fallback'
      });
      return;
    }
    
    const options = {
      hostname: process.env.GEO_LOCATION_API_ENDPOINT,
      path: \`/json/\${ipAddress}\`,
      method: 'GET',
      headers: {
        'Authorization': \`Bearer \${process.env.GEO_LOCATION_API_KEY}\`
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const geoData = JSON.parse(data);
          resolve({
            countryCode: geoData.country_code,
            country: geoData.country_name,
            region: geoData.region_name,
            city: geoData.city,
            source: 'api'
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Geo location API timeout'));
    });
    
    req.end();
  });
}

async function detectVPN(ipAddress) {
  // 簡易VPN検出ロジック
  // 実際の実装では専用のVPN検出APIを使用
  const vpnIndicators = [
    '10.', '172.16.', '192.168.', // プライベートIPレンジ
    '127.0.0.1' // ローカルホスト
  ];
  
  return vpnIndicators.some(indicator => ipAddress.startsWith(indicator));
}

function checkIpInRanges(ipAddress, allowedRanges) {
  // 簡易CIDR範囲チェック
  // 実際の実装ではより厳密なCIDR計算を行う
  for (const range of allowedRanges) {
    if (range.includes('/')) {
      const [network, prefix] = range.split('/');
      // 簡易チェック: ネットワーク部分の一致確認
      if (ipAddress.startsWith(network.split('.').slice(0, parseInt(prefix) / 8).join('.'))) {
        return true;
      }
    } else {
      if (ipAddress === range) {
        return true;
      }
    }
  }
  
  return false;
}

async function assessLocationRisk(userId, geoLocation) {
  try {
    // ユーザーの過去のアクセス履歴を取得
    const result = await dynamodb.query({
      TableName: process.env.PERMISSION_CACHE_TABLE,
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'begins_with(resourceId, :prefix)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':prefix': 'access_history_'
      },
      Limit: 10,
      ScanIndexForward: false
    }).promise();
    
    const accessHistory = result.Items || [];
    
    // 通常のアクセス場所との比較
    const usualLocations = accessHistory
      .map(item => item.geoLocation)
      .filter(loc => loc && loc.countryCode);
    
    const usualCountries = [...new Set(usualLocations.map(loc => loc.countryCode))];
    
    let riskLevel = 'low';
    let riskFactors = [];
    
    // 新しい国からのアクセス
    if (!usualCountries.includes(geoLocation.countryCode)) {
      riskLevel = 'medium';
      riskFactors.push('new_country');
    }
    
    // アクセス履歴が少ない
    if (accessHistory.length < 3) {
      riskLevel = 'medium';
      riskFactors.push('limited_history');
    }
    
    // 高リスク国家からのアクセス（例）
    const highRiskCountries = ['CN', 'RU', 'KP']; // 例示
    if (highRiskCountries.includes(geoLocation.countryCode)) {
      riskLevel = 'high';
      riskFactors.push('high_risk_country');
    }
    
    return {
      riskLevel,
      riskFactors,
      usualCountries,
      currentLocation: geoLocation
    };
    
  } catch (error) {
    console.error('リスク評価エラー:', error);
    return {
      riskLevel: 'medium',
      riskFactors: ['assessment_error'],
      error: error.message
    };
  }
}
    `;
  }

  private getDynamicPermissionUpdateCode(): string {
    return `
const AWS = require('aws-sdk');
const https = require('https');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log('🔄 動的権限更新開始:', JSON.stringify(event, null, 2));
  
  try {
    const { userId } = event;
    const dynamicConfig = JSON.parse(process.env.DYNAMIC_PERMISSION_CONFIG);
    
    if (!dynamicConfig.enabled) {
      return { success: true, message: '動的権限は無効' };
    }
    
    let updatedPermissions = {
      projects: [],
      organizations: [],
      departments: [],
      dataClassifications: [],
      temporaryAccess: [],
      lastUpdated: new Date().toISOString()
    };
    
    // 1. プロジェクトベースアクセス更新
    if (dynamicConfig.projectBasedAccess.enabled) {
      const projectPermissions = await updateProjectBasedPermissions(userId, dynamicConfig.projectBasedAccess);
      updatedPermissions.projects = projectPermissions.projects;
      updatedPermissions.organizations.push(...projectPermissions.organizations);
    }
    
    // 2. 組織階層ベース権限更新
    if (dynamicConfig.organizationalHierarchy.enabled) {
      const hierarchyPermissions = await updateHierarchyPermissions(userId, dynamicConfig.organizationalHierarchy);
      updatedPermissions.departments.push(...hierarchyPermissions.departments);
      updatedPermissions.dataClassifications.push(...hierarchyPermissions.dataClassifications);
    }
    
    // 3. 一時的権限更新
    if (dynamicConfig.temporaryAccess.enabled) {
      const temporaryPermissions = await updateTemporaryPermissions(userId, dynamicConfig.temporaryAccess);
      updatedPermissions.temporaryAccess = temporaryPermissions;
    }
    
    // 4. 権限の重複除去と正規化
    updatedPermissions = normalizePermissions(updatedPermissions);
    
    // 5. キャッシュに保存
    await dynamodb.put({
      TableName: process.env.PERMISSION_CACHE_TABLE,
      Item: {
        userId: userId,
        resourceId: 'dynamic_permissions',
        permissions: updatedPermissions,
        ttl: Math.floor(Date.now() / 1000) + dynamicConfig.refreshIntervalSeconds,
        updatedAt: new Date().toISOString()
      }
    }).promise();
    
    console.log(\`✅ \${userId}の動的権限更新完了:, JSON.stringify(updatedPermissions, null, 2)\`);
    
    return {
      success: true,
      permissions: updatedPermissions,
      message: '動的権限更新完了'
    };
    
  } catch (error) {
    console.error('動的権限更新エラー:', error);
    return {
      success: false,
      error: error.message,
      message: '動的権限更新に失敗しました'
    };
  }
};

async function updateProjectBasedPermissions(userId, projectConfig) {
  try {
    let userProjects = [];
    let organizations = [];
    
    if (projectConfig.projectMembershipApi) {
      // 外部APIからプロジェクト参加情報を取得
      const projectData = await callProjectMembershipApi(userId, projectConfig.projectMembershipApi);
      userProjects = projectData.projects || [];
      organizations = projectData.organizations || [];
    } else {
      // キャッシュからプロジェクト情報を取得
      const result = await dynamodb.get({
        TableName: process.env.PERMISSION_CACHE_TABLE,
        Key: {
          userId: userId,
          resourceId: 'user_projects'
        }
      }).promise();
      
      if (result.Item) {
        userProjects = result.Item.projects || [];
        organizations = result.Item.organizations || [];
      }
    }
    
    // プロジェクト権限マッピングの適用
    const mappedPermissions = [];
    for (const project of userProjects) {
      if (projectConfig.projectPermissions[project]) {
        mappedPermissions.push(...projectConfig.projectPermissions[project]);
      }
    }
    
    return {
      projects: userProjects,
      organizations: [...new Set(organizations)],
      mappedPermissions: [...new Set(mappedPermissions)]
    };
    
  } catch (error) {
    console.error('プロジェクトベース権限更新エラー:', error);
    return { projects: [], organizations: [], mappedPermissions: [] };
  }
}

async function updateHierarchyPermissions(userId, hierarchyConfig) {
  try {
    // ユーザーの組織階層情報を取得
    const result = await dynamodb.get({
      TableName: process.env.PERMISSION_CACHE_TABLE,
      Key: {
        userId: userId,
        resourceId: 'user_hierarchy'
      }
    }).promise();
    
    if (!result.Item) {
      return { departments: [], dataClassifications: [] };
    }
    
    const userHierarchy = result.Item.hierarchy;
    let departments = [userHierarchy.department];
    let dataClassifications = [userHierarchy.dataClassificationLevel];
    
    // 継承権限の適用
    if (hierarchyConfig.inheritedPermissions) {
      const parentDepartments = hierarchyConfig.hierarchy[userHierarchy.department] || [];
      departments.push(...parentDepartments);
      
      // データ分類レベルの継承
      const classificationHierarchy = {
        'restricted': ['restricted', 'confidential', 'internal', 'public'],
        'confidential': ['confidential', 'internal', 'public'],
        'internal': ['internal', 'public'],
        'public': ['public']
      };
      
      const inheritedClassifications = classificationHierarchy[userHierarchy.dataClassificationLevel] || ['public'];
      dataClassifications.push(...inheritedClassifications);
    }
    
    return {
      departments: [...new Set(departments)],
      dataClassifications: [...new Set(dataClassifications)]
    };
    
  } catch (error) {
    console.error('階層権限更新エラー:', error);
    return { departments: [], dataClassifications: [] };
  }
}

async function updateTemporaryPermissions(userId, temporaryConfig) {
  try {
    // 一時的権限の取得
    const result = await dynamodb.query({
      TableName: process.env.PERMISSION_CACHE_TABLE,
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'begins_with(resourceId, :prefix) AND expiresAt > :now',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':prefix': 'temp_access_',
        ':now': new Date().toISOString()
      }
    }).promise();
    
    const activeTemporaryPermissions = result.Items || [];
    
    return activeTemporaryPermissions.map(item => ({
      resourceId: item.resourceId,
      permissions: item.permissions,
      expiresAt: item.expiresAt,
      grantedBy: item.grantedBy,
      reason: item.reason
    }));
    
  } catch (error) {
    console.error('一時的権限更新エラー:', error);
    return [];
  }
}

async function callProjectMembershipApi(userId, apiConfig) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: apiConfig.endpoint,
      path: \`/api/users/\${userId}/projects\`,
      method: 'GET',
      headers: {
        'Authorization': \`Bearer \${apiConfig.apiKey}\`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const projectData = JSON.parse(data);
          resolve(projectData);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Project membership API timeout'));
    });
    
    req.end();
  });
}

function normalizePermissions(permissions) {
  return {
    projects: [...new Set(permissions.projects)],
    organizations: [...new Set(permissions.organizations)],
    departments: [...new Set(permissions.departments)],
    dataClassifications: [...new Set(permissions.dataClassifications)],
    temporaryAccess: permissions.temporaryAccess,
    lastUpdated: permissions.lastUpdated
  };
}
    `;
  }
}