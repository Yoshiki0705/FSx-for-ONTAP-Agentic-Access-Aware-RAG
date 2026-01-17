"use strict";
/**
 * 高度な権限フィルタリングエンジン
 *
 * 時間ベース制限、地理的制限、動的権限を統合した
 * エンタープライズグレードの権限制御システム
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
exports.AdvancedPermissionFilterEngine = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
class AdvancedPermissionFilterEngine extends constructs_1.Construct {
    /** 権限フィルタリングLambda関数 */
    permissionFilterFunction;
    /** 時間ベース制限チェック関数 */
    timeBasedCheckFunction;
    /** 地理的制限チェック関数 */
    geographicCheckFunction;
    /** 動的権限更新関数 */
    dynamicPermissionUpdateFunction;
    /** 権限キャッシュテーブル */
    permissionCacheTable;
    /** 監査ログテーブル */
    auditLogTable;
    constructor(scope, id, props) {
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
            schedule: events.Schedule.rate(cdk.Duration.minutes(Math.floor(props.filterConfig.dynamicPermissionConfig.refreshIntervalSeconds / 60)))
        });
        permissionUpdateRule.addTarget(new targets.LambdaFunction(this.dynamicPermissionUpdateFunction));
    }
    getPermissionFilterCode() {
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
    getTimeBasedCheckCode() {
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
    getGeographicCheckCode() {
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
    getDynamicPermissionUpdateCode() {
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
exports.AdvancedPermissionFilterEngine = AdvancedPermissionFilterEngine;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWR2YW5jZWQtcGVybWlzc2lvbi1maWx0ZXItZW5naW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWR2YW5jZWQtcGVybWlzc2lvbi1maWx0ZXItZW5naW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUMzQyxtRUFBcUQ7QUFDckQsK0RBQWlEO0FBQ2pELHdFQUEwRDtBQUMxRCwyREFBNkM7QUFDN0MsMkNBQXVDO0FBcUN2QyxNQUFhLDhCQUErQixTQUFRLHNCQUFTO0lBQzNELHdCQUF3QjtJQUNSLHdCQUF3QixDQUFrQjtJQUUxRCxvQkFBb0I7SUFDSixzQkFBc0IsQ0FBa0I7SUFFeEQsa0JBQWtCO0lBQ0YsdUJBQXVCLENBQWtCO0lBRXpELGVBQWU7SUFDQywrQkFBK0IsQ0FBa0I7SUFFakUsa0JBQWtCO0lBQ0Ysb0JBQW9CLENBQWlCO0lBRXJELGVBQWU7SUFDQyxhQUFhLENBQWlCO0lBRTlDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMEM7UUFDbEYsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixnQkFBZ0I7UUFDaEIsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDM0UsU0FBUyxFQUFFLEdBQUcsS0FBSyxDQUFDLG1CQUFtQixRQUFRO1lBQy9DLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxZQUFZO2dCQUNsQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsbUJBQW1CLEVBQUUsS0FB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QUVPLHNCQUFzQjtRQUM1QixPQUFPOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7S0FxUU4sQ0FBQztJQUNKLENBQUM7SUFFTyw4QkFBOEI7UUFDcEMsT0FBTzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztLQTZQTixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBM25DRCx3RUEybkNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDpq5jluqbjgarmqKnpmZDjg5XjgqPjg6vjgr/jg6rjg7PjgrDjgqjjg7Pjgrjjg7NcbiAqIFxuICog5pmC6ZaT44OZ44O844K55Yi26ZmQ44CB5Zyw55CG55qE5Yi26ZmQ44CB5YuV55qE5qip6ZmQ44KS57Wx5ZCI44GX44GfXG4gKiDjgqjjg7Pjgr/jg7zjg5fjg6njgqTjgrrjgrDjg6zjg7zjg4njga7mqKnpmZDliLblvqHjgrfjgrnjg4bjg6BcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQge1xuICBVc2VyUGVybWlzc2lvbixcbiAgRG9jdW1lbnRQZXJtaXNzaW9uLFxuICBQZXJtaXNzaW9uRmlsdGVyQ29uZmlnLFxuICBUaW1lQmFzZWRSZXN0cmljdGlvbixcbiAgQWR2YW5jZWRHZW9ncmFwaGljUmVzdHJpY3Rpb24sXG4gIER5bmFtaWNQZXJtaXNzaW9uQ29uZmlnLFxuICBBY2Nlc3NDb250cm9sUmVzdWx0XG59IGZyb20gJy4uL2ludGVyZmFjZXMvcGVybWlzc2lvbi1jb25maWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFkdmFuY2VkUGVybWlzc2lvbkZpbHRlckVuZ2luZVByb3BzIHtcbiAgLyoqIOaoqemZkOODleOCo+ODq+OCv+ODvOioreWumiAqL1xuICByZWFkb25seSBmaWx0ZXJDb25maWc6IFBlcm1pc3Npb25GaWx0ZXJDb25maWc7XG4gIFxuICAvKiogT3BlblNlYXJjaOODieODoeOCpOODs+OCqOODs+ODieODneOCpOODs+ODiCAqL1xuICByZWFkb25seSBvcGVuc2VhcmNoRW5kcG9pbnQ6IHN0cmluZztcbiAgXG4gIC8qKiBEeW5hbW9EQuODhuODvOODluODq+WQjSAqL1xuICByZWFkb25seSBwZXJtaXNzaW9uVGFibGVOYW1lOiBzdHJpbmc7XG4gIFxuICAvKiog55uj5p+744Ot44Kw44OG44O844OW44Or5ZCNICovXG4gIHJlYWRvbmx5IGF1ZGl0TG9nVGFibGVOYW1lOiBzdHJpbmc7XG4gIFxuICAvKiog5Zyw55CG55qE5L2N572u5oOF5aCxQVBJ6Kit5a6aICovXG4gIHJlYWRvbmx5IGdlb0xvY2F0aW9uQXBpPzoge1xuICAgIHJlYWRvbmx5IGVuZHBvaW50OiBzdHJpbmc7XG4gICAgcmVhZG9ubHkgYXBpS2V5OiBzdHJpbmc7XG4gIH07XG4gIFxuICAvKiog44OX44Ot44K444Kn44Kv44OI566h55CGQVBJ6Kit5a6aICovXG4gIHJlYWRvbmx5IHByb2plY3RNYW5hZ2VtZW50QXBpPzoge1xuICAgIHJlYWRvbmx5IGVuZHBvaW50OiBzdHJpbmc7XG4gICAgcmVhZG9ubHkgYXBpS2V5OiBzdHJpbmc7XG4gIH07XG59XG5cbmV4cG9ydCBjbGFzcyBBZHZhbmNlZFBlcm1pc3Npb25GaWx0ZXJFbmdpbmUgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAvKiog5qip6ZmQ44OV44Kj44Or44K/44Oq44Oz44KwTGFtYmRh6Zai5pWwICovXG4gIHB1YmxpYyByZWFkb25seSBwZXJtaXNzaW9uRmlsdGVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgXG4gIC8qKiDmmYLplpPjg5njg7zjgrnliLbpmZDjg4Hjgqfjg4Pjgq/plqLmlbAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHRpbWVCYXNlZENoZWNrRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgXG4gIC8qKiDlnLDnkIbnmoTliLbpmZDjg4Hjgqfjg4Pjgq/plqLmlbAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGdlb2dyYXBoaWNDaGVja0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIFxuICAvKiog5YuV55qE5qip6ZmQ5pu05paw6Zai5pWwICovXG4gIHB1YmxpYyByZWFkb25seSBkeW5hbWljUGVybWlzc2lvblVwZGF0ZUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIFxuICAvKiog5qip6ZmQ44Kt44Oj44OD44K344Ol44OG44O844OW44OrICovXG4gIHB1YmxpYyByZWFkb25seSBwZXJtaXNzaW9uQ2FjaGVUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIFxuICAvKiog55uj5p+744Ot44Kw44OG44O844OW44OrICovXG4gIHB1YmxpYyByZWFkb25seSBhdWRpdExvZ1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQWR2YW5jZWRQZXJtaXNzaW9uRmlsdGVyRW5naW5lUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8g5qip6ZmQ44Kt44Oj44OD44K344Ol44OG44O844OW44Or5L2c5oiQXG4gICAgdGhpcy5wZXJtaXNzaW9uQ2FjaGVUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUGVybWlzc2lvbkNhY2hlVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke3Byb3BzLnBlcm1pc3Npb25UYWJsZU5hbWV9LWNhY2hlYCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXNlcklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdyZXNvdXJjZUlkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiAndHRsJyxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgIH0pO1xuXG4gICAgLy8g55uj5p+744Ot44Kw44OG44O844OW44Or5L2c5oiQXG4gICAgdGhpcy5hdWRpdExvZ1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBdWRpdExvZ1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBwcm9wcy5hdWRpdExvZ1RhYmxlTmFtZSxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXNlcklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgIH0pO1xuXG4gICAgLy8gR1NJIGZvciBhdWRpdCBsb2cgcXVlcmllc1xuICAgIHRoaXMuYXVkaXRMb2dUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdBY3Rpb25JbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2FjdGlvbicsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAndGltZXN0YW1wJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExhbWJkYeWun+ihjOODreODvOODq+S9nOaIkO+8iOacgOWwj+aoqemZkOOBruWOn+WJh++8iVxuICAgIGNvbnN0IGxhbWJkYUV4ZWN1dGlvblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0xhbWJkYUV4ZWN1dGlvblJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKVxuICAgICAgXSxcbiAgICAgIGRlc2NyaXB0aW9uOiAn6auY5bqm44Gq5qip6ZmQ44OV44Kj44Or44K/44Oq44Oz44Kw44Ko44Oz44K444Oz55SoTGFtYmRh5a6f6KGM44Ot44O844OrJyxcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgIER5bmFtb0RCQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6UHV0SXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlVwZGF0ZUl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpEZWxldGVJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6UXVlcnknLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpTY2FuJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6QmF0Y2hHZXRJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6QmF0Y2hXcml0ZUl0ZW0nXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIHRoaXMucGVybWlzc2lvbkNhY2hlVGFibGUudGFibGVBcm4sXG4gICAgICAgICAgICAgICAgdGhpcy5hdWRpdExvZ1RhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgICAgICAgIGAke3RoaXMucGVybWlzc2lvbkNhY2hlVGFibGUudGFibGVBcm59L2luZGV4LypgLFxuICAgICAgICAgICAgICAgIGAke3RoaXMuYXVkaXRMb2dUYWJsZS50YWJsZUFybn0vaW5kZXgvKmBcbiAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICBdXG4gICAgICAgIH0pLFxuICAgICAgICBPcGVuU2VhcmNoQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdlczpFU0h0dHBHZXQnLFxuICAgICAgICAgICAgICAgICdlczpFU0h0dHBQb3N0J1xuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czplczoke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OmRvbWFpbi8qYF0sXG4gICAgICAgICAgICAgIGNvbmRpdGlvbnM6IHtcbiAgICAgICAgICAgICAgICAnU3RyaW5nRXF1YWxzJzoge1xuICAgICAgICAgICAgICAgICAgJ2VzOmluZGV4JzogWyd0aXRhbi1tdWx0aW1vZGFsLWVtYmVkZGluZ3MnXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICBdXG4gICAgICAgIH0pLFxuICAgICAgICBMYW1iZGFJbnZva2VBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbJ2xhbWJkYTpJbnZva2VGdW5jdGlvbiddLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOmF3czpsYW1iZGE6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fTpmdW5jdGlvbjoqLXRpbWUtYmFzZWQtY2hlY2tgLFxuICAgICAgICAgICAgICAgIGBhcm46YXdzOmxhbWJkYToke2Nkay5TdGFjay5vZih0aGlzKS5yZWdpb259OiR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9OmZ1bmN0aW9uOiotZ2VvZ3JhcGhpYy1jaGVja2AsXG4gICAgICAgICAgICAgICAgYGFybjphd3M6bGFtYmRhOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtjZGsuU3RhY2sub2YodGhpcykuYWNjb3VudH06ZnVuY3Rpb246Ki1keW5hbWljLXBlcm1pc3Npb24tdXBkYXRlYFxuICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIF1cbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIOODoeOCpOODs+aoqemZkOODleOCo+ODq+OCv+ODquODs+OCsOmWouaVsFxuICAgIHRoaXMucGVybWlzc2lvbkZpbHRlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUGVybWlzc2lvbkZpbHRlckZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKHRoaXMuZ2V0UGVybWlzc2lvbkZpbHRlckNvZGUoKSksXG4gICAgICByb2xlOiBsYW1iZGFFeGVjdXRpb25Sb2xlLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDEwMCwgLy8g5ZCM5pmC5a6f6KGM5pWw5Yi26ZmQXG4gICAgICBkZWFkTGV0dGVyUXVldWU6IG5ldyBsYW1iZGEuRGVhZExldHRlclF1ZXVlKHtcbiAgICAgICAgcXVldWU6IG5ldyBjZGsuYXdzX3Nxcy5RdWV1ZSh0aGlzLCAnUGVybWlzc2lvbkZpbHRlckRMUScsIHtcbiAgICAgICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KVxuICAgICAgICB9KVxuICAgICAgfSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBPUEVOU0VBUkNIX0VORFBPSU5UOiBwcm9wcy5vcGVuc2VhcmNoRW5kcG9pbnQsXG4gICAgICAgIFBFUk1JU1NJT05fQ0FDSEVfVEFCTEU6IHRoaXMucGVybWlzc2lvbkNhY2hlVGFibGUudGFibGVOYW1lLFxuICAgICAgICBBVURJVF9MT0dfVEFCTEU6IHRoaXMuYXVkaXRMb2dUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEZJTFRFUl9DT05GSUc6IEpTT04uc3RyaW5naWZ5KHByb3BzLmZpbHRlckNvbmZpZyksXG4gICAgICAgIFRJTUVfQkFTRURfQ0hFQ0tfRlVOQ1RJT046IHRoaXMudGltZUJhc2VkQ2hlY2tGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICAgIEdFT0dSQVBISUNfQ0hFQ0tfRlVOQ1RJT046IHRoaXMuZ2VvZ3JhcGhpY0NoZWNrRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgICBEWU5BTUlDX1BFUk1JU1NJT05fVVBEQVRFX0ZVTkNUSU9OOiB0aGlzLmR5bmFtaWNQZXJtaXNzaW9uVXBkYXRlRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgICBHRU9fTE9DQVRJT05fQVBJX0VORFBPSU5UOiBwcm9wcy5nZW9Mb2NhdGlvbkFwaT8uZW5kcG9pbnQgfHwgJycsXG4gICAgICAgIFBST0pFQ1RfTUFOQUdFTUVOVF9BUElfRU5EUE9JTlQ6IHByb3BzLnByb2plY3RNYW5hZ2VtZW50QXBpPy5lbmRwb2ludCB8fCAnJyxcbiAgICAgICAgLy8g44K744Kt44Ol44Oq44OG44KjOiBBUEnjgq3jg7zjga/liKXpgJRTZWN1cmVTdHJpbmdQYXJhbWV0ZXLjgafnrqHnkIZcbiAgICAgICAgTk9ERV9PUFRJT05TOiAnLS1lbmFibGUtc291cmNlLW1hcHMnXG4gICAgICB9LFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRIXG4gICAgfSk7XG5cbiAgICAvLyDmmYLplpPjg5njg7zjgrnliLbpmZDjg4Hjgqfjg4Pjgq/plqLmlbBcbiAgICB0aGlzLnRpbWVCYXNlZENoZWNrRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdUaW1lQmFzZWRDaGVja0Z1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKHRoaXMuZ2V0VGltZUJhc2VkQ2hlY2tDb2RlKCkpLFxuICAgICAgcm9sZTogbGFtYmRhRXhlY3V0aW9uUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFBFUk1JU1NJT05fQ0FDSEVfVEFCTEU6IHRoaXMucGVybWlzc2lvbkNhY2hlVGFibGUudGFibGVOYW1lLFxuICAgICAgICBUSU1FX1JFU1RSSUNUSU9OX0NPTkZJRzogSlNPTi5zdHJpbmdpZnkocHJvcHMuZmlsdGVyQ29uZmlnLnRpbWVCYXNlZFJlc3RyaWN0aW9uKVxuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USFxuICAgIH0pO1xuXG4gICAgLy8g5Zyw55CG55qE5Yi26ZmQ44OB44Kn44OD44Kv6Zai5pWwXG4gICAgdGhpcy5nZW9ncmFwaGljQ2hlY2tGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dlb2dyYXBoaWNDaGVja0Z1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKHRoaXMuZ2V0R2VvZ3JhcGhpY0NoZWNrQ29kZSgpKSxcbiAgICAgIHJvbGU6IGxhbWJkYUV4ZWN1dGlvblJvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxNSksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBQRVJNSVNTSU9OX0NBQ0hFX1RBQkxFOiB0aGlzLnBlcm1pc3Npb25DYWNoZVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgR0VPX1JFU1RSSUNUSU9OX0NPTkZJRzogSlNPTi5zdHJpbmdpZnkocHJvcHMuZmlsdGVyQ29uZmlnLmFkdmFuY2VkR2VvZ3JhcGhpY1Jlc3RyaWN0aW9uKSxcbiAgICAgICAgR0VPX0xPQ0FUSU9OX0FQSV9FTkRQT0lOVDogcHJvcHMuZ2VvTG9jYXRpb25BcGk/LmVuZHBvaW50IHx8ICcnLFxuICAgICAgICBHRU9fTE9DQVRJT05fQVBJX0tFWTogcHJvcHMuZ2VvTG9jYXRpb25BcGk/LmFwaUtleSB8fCAnJ1xuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USFxuICAgIH0pO1xuXG4gICAgLy8g5YuV55qE5qip6ZmQ5pu05paw6Zai5pWwXG4gICAgdGhpcy5keW5hbWljUGVybWlzc2lvblVwZGF0ZUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRHluYW1pY1Blcm1pc3Npb25VcGRhdGVGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZSh0aGlzLmdldER5bmFtaWNQZXJtaXNzaW9uVXBkYXRlQ29kZSgpKSxcbiAgICAgIHJvbGU6IGxhbWJkYUV4ZWN1dGlvblJvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUEVSTUlTU0lPTl9DQUNIRV9UQUJMRTogdGhpcy5wZXJtaXNzaW9uQ2FjaGVUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIERZTkFNSUNfUEVSTUlTU0lPTl9DT05GSUc6IEpTT04uc3RyaW5naWZ5KHByb3BzLmZpbHRlckNvbmZpZy5keW5hbWljUGVybWlzc2lvbkNvbmZpZyksXG4gICAgICAgIFBST0pFQ1RfTUFOQUdFTUVOVF9BUElfRU5EUE9JTlQ6IHByb3BzLnByb2plY3RNYW5hZ2VtZW50QXBpPy5lbmRwb2ludCB8fCAnJyxcbiAgICAgICAgUFJPSkVDVF9NQU5BR0VNRU5UX0FQSV9LRVk6IHByb3BzLnByb2plY3RNYW5hZ2VtZW50QXBpPy5hcGlLZXkgfHwgJydcbiAgICAgIH0sXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEhcbiAgICB9KTtcblxuICAgIC8vIOWLleeahOaoqemZkOabtOaWsOOCueOCseOCuOODpeODvOODq1xuICAgIGNvbnN0IHBlcm1pc3Npb25VcGRhdGVSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdQZXJtaXNzaW9uVXBkYXRlUnVsZScsIHtcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUucmF0ZShjZGsuRHVyYXRpb24ubWludXRlcyhcbiAgICAgICAgTWF0aC5mbG9vcihwcm9wcy5maWx0ZXJDb25maWcuZHluYW1pY1Blcm1pc3Npb25Db25maWcucmVmcmVzaEludGVydmFsU2Vjb25kcyAvIDYwKVxuICAgICAgKSlcbiAgICB9KTtcblxuICAgIHBlcm1pc3Npb25VcGRhdGVSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLmR5bmFtaWNQZXJtaXNzaW9uVXBkYXRlRnVuY3Rpb24pKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UGVybWlzc2lvbkZpbHRlckNvZGUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYFxuY29uc3QgeyBEeW5hbW9EQkNsaWVudCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJyk7XG5jb25zdCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIEdldENvbW1hbmQsIFB1dENvbW1hbmQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2xpYi1keW5hbW9kYicpO1xuY29uc3QgeyBMYW1iZGFDbGllbnQsIEludm9rZUNvbW1hbmQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2NsaWVudC1sYW1iZGEnKTtcbmNvbnN0IGh0dHBzID0gcmVxdWlyZSgnaHR0cHMnKTtcbmNvbnN0IHsgQ2xpZW50IH0gPSByZXF1aXJlKCdAb3BlbnNlYXJjaC1wcm9qZWN0L29wZW5zZWFyY2gnKTtcbmNvbnN0IHsgQXdzU2lndjRTaWduZXIgfSA9IHJlcXVpcmUoJ0BvcGVuc2VhcmNoLXByb2plY3Qvb3BlbnNlYXJjaC9hd3MnKTtcbmNvbnN0IHsgZGVmYXVsdFByb3ZpZGVyIH0gPSByZXF1aXJlKCdAYXdzLXNkay9jcmVkZW50aWFsLXByb3ZpZGVyLW5vZGUnKTtcblxuLy8gQVdTIFNESyB2M+OBuOOBruenu+ihjFxuY29uc3QgZHluYW1vQ2xpZW50ID0gbmV3IER5bmFtb0RCQ2xpZW50KHsgcmVnaW9uOiBwcm9jZXNzLmVudi5BV1NfUkVHSU9OIH0pO1xuY29uc3QgZHluYW1vZGIgPSBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LmZyb20oZHluYW1vQ2xpZW50KTtcbmNvbnN0IGxhbWJkYUNsaWVudCA9IG5ldyBMYW1iZGFDbGllbnQoeyByZWdpb246IHByb2Nlc3MuZW52LkFXU19SRUdJT04gfSk7XG5cbmV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICBjb25zb2xlLmxvZygn8J+UkCDpq5jluqbjgarmqKnpmZDjg5XjgqPjg6vjgr/jg6rjg7PjgrDplovlp4s6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcbiAgXG4gIC8vIOWFpeWKm+WApOaknOiovFxuICBpZiAoIWV2ZW50LnVzZXJJZCB8fCAhZXZlbnQucXVlcnkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZXJyb3I6ICdCYWQgUmVxdWVzdCcsXG4gICAgICAgIG1lc3NhZ2U6ICd1c2VySWQg44GoIHF1ZXJ5IOOBr+W/hemgiOODkeODqeODoeODvOOCv+OBp+OBmSdcbiAgICAgIH0pXG4gICAgfTtcbiAgfVxuICBcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHVzZXJJZCwgcXVlcnksIGlwQWRkcmVzcywgdXNlckFnZW50LCBzZXNzaW9uSWQgfSA9IGV2ZW50O1xuICAgIGNvbnN0IGZpbHRlckNvbmZpZyA9IEpTT04ucGFyc2UocHJvY2Vzcy5lbnYuRklMVEVSX0NPTkZJRyk7XG4gICAgXG4gICAgLy8g55uj5p+744Ot44Kw6KiY6YyyXG4gICAgYXdhaXQgcmVjb3JkQXVkaXRMb2coe1xuICAgICAgdXNlcklkLFxuICAgICAgc2Vzc2lvbklkLFxuICAgICAgaXBBZGRyZXNzLFxuICAgICAgdXNlckFnZW50LFxuICAgICAgYWN0aW9uOiAncGVybWlzc2lvbl9maWx0ZXJfcmVxdWVzdCcsXG4gICAgICByZXNvdXJjZTogJ29wZW5zZWFyY2hfcXVlcnknLFxuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9KTtcbiAgICBcbiAgICAvLyAxLiDmmYLplpPjg5njg7zjgrnliLbpmZDjg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCB0aW1lQ2hlY2tSZXN1bHQgPSBhd2FpdCBjaGVja1RpbWVCYXNlZFJlc3RyaWN0aW9uKHVzZXJJZCk7XG4gICAgaWYgKCF0aW1lQ2hlY2tSZXN1bHQuYWxsb3dlZCkge1xuICAgICAgcmV0dXJuIGNyZWF0ZUFjY2Vzc0RlbmllZFJlc3BvbnNlKCfmmYLplpPjg5njg7zjgrnliLbpmZAnLCB0aW1lQ2hlY2tSZXN1bHQucmVhc29uKTtcbiAgICB9XG4gICAgXG4gICAgLy8gMi4g5Zyw55CG55qE5Yi26ZmQ44OB44Kn44OD44KvXG4gICAgY29uc3QgZ2VvQ2hlY2tSZXN1bHQgPSBhd2FpdCBjaGVja0dlb2dyYXBoaWNSZXN0cmljdGlvbih1c2VySWQsIGlwQWRkcmVzcyk7XG4gICAgaWYgKCFnZW9DaGVja1Jlc3VsdC5hbGxvd2VkKSB7XG4gICAgICByZXR1cm4gY3JlYXRlQWNjZXNzRGVuaWVkUmVzcG9uc2UoJ+WcsOeQhueahOWItumZkCcsIGdlb0NoZWNrUmVzdWx0LnJlYXNvbik7XG4gICAgfVxuICAgIFxuICAgIC8vIDMuIOWLleeahOaoqemZkOODgeOCp+ODg+OCr1xuICAgIGNvbnN0IGR5bmFtaWNQZXJtaXNzaW9ucyA9IGF3YWl0IGdldER5bmFtaWNQZXJtaXNzaW9ucyh1c2VySWQpO1xuICAgIFxuICAgIC8vIDQuIOaoqemZkOODleOCo+ODq+OCv+ODvOeUn+aIkFxuICAgIGNvbnN0IHBlcm1pc3Npb25GaWx0ZXIgPSBhd2FpdCBnZW5lcmF0ZUFkdmFuY2VkUGVybWlzc2lvbkZpbHRlcih1c2VySWQsIGR5bmFtaWNQZXJtaXNzaW9ucyk7XG4gICAgXG4gICAgLy8gNS4gT3BlblNlYXJjaOaknOe0ouWun+ihjFxuICAgIGNvbnN0IHNlYXJjaFJlc3VsdCA9IGF3YWl0IGV4ZWN1dGVGaWx0ZXJlZFNlYXJjaChxdWVyeSwgcGVybWlzc2lvbkZpbHRlcik7XG4gICAgXG4gICAgLy8gNi4g57WQ5p6c55uj5p+744Ot44Kw6KiY6YyyXG4gICAgYXdhaXQgcmVjb3JkQXVkaXRMb2coe1xuICAgICAgdXNlcklkLFxuICAgICAgc2Vzc2lvbklkLFxuICAgICAgaXBBZGRyZXNzLFxuICAgICAgdXNlckFnZW50LFxuICAgICAgYWN0aW9uOiAnc2VhcmNoX2V4ZWN1dGVkJyxcbiAgICAgIHJlc291cmNlOiAnb3BlbnNlYXJjaF9yZXN1bHRzJyxcbiAgICAgIHJlc3VsdDogJ2FsbG93JyxcbiAgICAgIGZpbHRlcmVkQ291bnQ6IHNlYXJjaFJlc3VsdC5oaXRzLnRvdGFsLnZhbHVlLFxuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICByZXN1bHRzOiBzZWFyY2hSZXN1bHQsXG4gICAgICAgIGFwcGxpZWRGaWx0ZXJzOiBwZXJtaXNzaW9uRmlsdGVyLFxuICAgICAgICBhY2Nlc3NJbmZvOiB7XG4gICAgICAgICAgdGltZVJlc3RyaWN0aW9uOiB0aW1lQ2hlY2tSZXN1bHQsXG4gICAgICAgICAgZ2VvZ3JhcGhpY1Jlc3RyaWN0aW9uOiBnZW9DaGVja1Jlc3VsdCxcbiAgICAgICAgICBkeW5hbWljUGVybWlzc2lvbnM6IGR5bmFtaWNQZXJtaXNzaW9uc1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH07XG4gICAgXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcign5qip6ZmQ44OV44Kj44Or44K/44Oq44Oz44Kw44Ko44Op44O8OicsIGVycm9yKTtcbiAgICBcbiAgICBhd2FpdCByZWNvcmRBdWRpdExvZyh7XG4gICAgICB1c2VySWQ6IGV2ZW50LnVzZXJJZCxcbiAgICAgIHNlc3Npb25JZDogZXZlbnQuc2Vzc2lvbklkLFxuICAgICAgaXBBZGRyZXNzOiBldmVudC5pcEFkZHJlc3MsXG4gICAgICB1c2VyQWdlbnQ6IGV2ZW50LnVzZXJBZ2VudCxcbiAgICAgIGFjdGlvbjogJ3Blcm1pc3Npb25fZmlsdGVyX2Vycm9yJyxcbiAgICAgIHJlc291cmNlOiAnc3lzdGVtJyxcbiAgICAgIHJlc3VsdDogJ2Vycm9yJyxcbiAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlLFxuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogNTAwLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InLFxuICAgICAgICBtZXNzYWdlOiAn5qip6ZmQ44OV44Kj44Or44K/44Oq44Oz44Kw5Yem55CG5Lit44Gr44Ko44Op44O844GM55m655Sf44GX44G+44GX44GfJ1xuICAgICAgfSlcbiAgICB9O1xuICB9XG59O1xuXG5hc3luYyBmdW5jdGlvbiBjaGVja1RpbWVCYXNlZFJlc3RyaWN0aW9uKHVzZXJJZCkge1xuICB0cnkge1xuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgSW52b2tlQ29tbWFuZCh7XG4gICAgICBGdW5jdGlvbk5hbWU6IHByb2Nlc3MuZW52LlRJTUVfQkFTRURfQ0hFQ0tfRlVOQ1RJT04sXG4gICAgICBQYXlsb2FkOiBKU09OLnN0cmluZ2lmeSh7IHVzZXJJZCB9KVxuICAgIH0pO1xuICAgIFxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGxhbWJkYUNsaWVudC5zZW5kKGNvbW1hbmQpO1xuICAgIGNvbnN0IHBheWxvYWQgPSBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUocmVzdWx0LlBheWxvYWQpO1xuICAgIHJldHVybiBKU09OLnBhcnNlKHBheWxvYWQpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+aZgumWk+ODmeODvOOCueWItumZkOODgeOCp+ODg+OCr+OCqOODqeODvDonLCBlcnJvcik7XG4gICAgcmV0dXJuIHsgYWxsb3dlZDogZmFsc2UsIHJlYXNvbjogJ+aZgumWk+ODmeODvOOCueWItumZkOODgeOCp+ODg+OCr+WkseaVlycgfTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjaGVja0dlb2dyYXBoaWNSZXN0cmljdGlvbih1c2VySWQsIGlwQWRkcmVzcykge1xuICBjb25zdCBsYW1iZGEgPSBuZXcgQVdTLkxhbWJkYSgpO1xuICBcbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBsYW1iZGEuaW52b2tlKHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogcHJvY2Vzcy5lbnYuR0VPR1JBUEhJQ19DSEVDS19GVU5DVElPTixcbiAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KHsgdXNlcklkLCBpcEFkZHJlc3MgfSlcbiAgICB9KS5wcm9taXNlKCk7XG4gICAgXG4gICAgcmV0dXJuIEpTT04ucGFyc2UocmVzdWx0LlBheWxvYWQpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+WcsOeQhueahOWItumZkOODgeOCp+ODg+OCr+OCqOODqeODvDonLCBlcnJvcik7XG4gICAgcmV0dXJuIHsgYWxsb3dlZDogZmFsc2UsIHJlYXNvbjogJ+WcsOeQhueahOWItumZkOODgeOCp+ODg+OCr+WkseaVlycgfTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXREeW5hbWljUGVybWlzc2lvbnModXNlcklkKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBHZXRDb21tYW5kKHtcbiAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuUEVSTUlTU0lPTl9DQUNIRV9UQUJMRSxcbiAgICAgIEtleToge1xuICAgICAgICB1c2VySWQ6IHVzZXJJZCxcbiAgICAgICAgcmVzb3VyY2VJZDogJ2R5bmFtaWNfcGVybWlzc2lvbnMnXG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZHluYW1vZGIuc2VuZChjb21tYW5kKTtcbiAgICBcbiAgICBpZiAocmVzdWx0Lkl0ZW0gJiYgcmVzdWx0Lkl0ZW0udHRsID4gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCkpIHtcbiAgICAgIHJldHVybiByZXN1bHQuSXRlbS5wZXJtaXNzaW9ucztcbiAgICB9XG4gICAgXG4gICAgLy8g44Kt44Oj44OD44K344Ol44Gr44Gq44GE5aC05ZCI44Gv5YuV55qE5qip6ZmQ5pu05paw6Zai5pWw44KS5ZG844Gz5Ye644GXXG4gICAgY29uc3QgaW52b2tlQ29tbWFuZCA9IG5ldyBJbnZva2VDb21tYW5kKHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogcHJvY2Vzcy5lbnYuRFlOQU1JQ19QRVJNSVNTSU9OX1VQREFURV9GVU5DVElPTixcbiAgICAgIFBheWxvYWQ6IEpTT04uc3RyaW5naWZ5KHsgdXNlcklkIH0pXG4gICAgfSk7XG4gICAgXG4gICAgY29uc3QgdXBkYXRlUmVzdWx0ID0gYXdhaXQgbGFtYmRhQ2xpZW50LnNlbmQoaW52b2tlQ29tbWFuZCk7XG4gICAgY29uc3QgcGF5bG9hZCA9IG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZSh1cGRhdGVSZXN1bHQuUGF5bG9hZCk7XG4gICAgY29uc3QgdXBkYXRlZFBlcm1pc3Npb25zID0gSlNPTi5wYXJzZShwYXlsb2FkKTtcbiAgICByZXR1cm4gdXBkYXRlZFBlcm1pc3Npb25zLnBlcm1pc3Npb25zIHx8IHt9O1xuICAgIFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+WLleeahOaoqemZkOWPluW+l+OCqOODqeODvDonLCBlcnJvcik7XG4gICAgcmV0dXJuIHt9O1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlQWR2YW5jZWRQZXJtaXNzaW9uRmlsdGVyKHVzZXJJZCwgZHluYW1pY1Blcm1pc3Npb25zKSB7XG4gIC8vIOWfuuacrOaoqemZkOODleOCo+ODq+OCv+ODvFxuICBjb25zdCBiYXNlRmlsdGVyID0ge1xuICAgIGJvb2w6IHtcbiAgICAgIG11c3Q6IFtcbiAgICAgICAge1xuICAgICAgICAgIHRlcm1zOiB7XG4gICAgICAgICAgICB1c2VyX3Blcm1pc3Npb25zOiBbdXNlcklkLCAncHVibGljJywgJ2FsbCddXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICBdXG4gICAgfVxuICB9O1xuICBcbiAgLy8g5YuV55qE5qip6ZmQ44Gu6L+95YqgXG4gIGlmIChkeW5hbWljUGVybWlzc2lvbnMucHJvamVjdHMgJiYgZHluYW1pY1Blcm1pc3Npb25zLnByb2plY3RzLmxlbmd0aCA+IDApIHtcbiAgICBiYXNlRmlsdGVyLmJvb2wubXVzdC5wdXNoKHtcbiAgICAgIHRlcm1zOiB7XG4gICAgICAgIHByb2plY3RzOiBkeW5hbWljUGVybWlzc2lvbnMucHJvamVjdHNcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBcbiAgaWYgKGR5bmFtaWNQZXJtaXNzaW9ucy5vcmdhbml6YXRpb25zICYmIGR5bmFtaWNQZXJtaXNzaW9ucy5vcmdhbml6YXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICBiYXNlRmlsdGVyLmJvb2wubXVzdC5wdXNoKHtcbiAgICAgIHRlcm1zOiB7XG4gICAgICAgIGFsbG93ZWRfb3JnYW5pemF0aW9uczogZHluYW1pY1Blcm1pc3Npb25zLm9yZ2FuaXphdGlvbnNcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBcbiAgaWYgKGR5bmFtaWNQZXJtaXNzaW9ucy5kYXRhQ2xhc3NpZmljYXRpb25zICYmIGR5bmFtaWNQZXJtaXNzaW9ucy5kYXRhQ2xhc3NpZmljYXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICBiYXNlRmlsdGVyLmJvb2wubXVzdC5wdXNoKHtcbiAgICAgIHRlcm1zOiB7XG4gICAgICAgIGRhdGFfY2xhc3NpZmljYXRpb246IGR5bmFtaWNQZXJtaXNzaW9ucy5kYXRhQ2xhc3NpZmljYXRpb25zXG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgXG4gIHJldHVybiBiYXNlRmlsdGVyO1xufVxuXG5hc3luYyBmdW5jdGlvbiBleGVjdXRlRmlsdGVyZWRTZWFyY2gocXVlcnksIHBlcm1pc3Npb25GaWx0ZXIpIHtcbiAgY29uc3QgY2xpZW50ID0gbmV3IENsaWVudCh7XG4gICAgLi4uQXdzU2lndjRTaWduZXIoe1xuICAgICAgcmVnaW9uOiBwcm9jZXNzLmVudi5BV1NfUkVHSU9OLFxuICAgICAgc2VydmljZTogJ2VzJyxcbiAgICAgIGdldENyZWRlbnRpYWxzOiAoKSA9PiBkZWZhdWx0UHJvdmlkZXIoKSgpXG4gICAgfSksXG4gICAgbm9kZTogXFxgaHR0cHM6Ly9cXCR7cHJvY2Vzcy5lbnYuT1BFTlNFQVJDSF9FTkRQT0lOVH1cXGBcbiAgfSk7XG4gIFxuICBjb25zdCBzZWFyY2hRdWVyeSA9IHtcbiAgICBpbmRleDogJ3RpdGFuLW11bHRpbW9kYWwtZW1iZWRkaW5ncycsXG4gICAgYm9keToge1xuICAgICAgc2l6ZTogMjAsXG4gICAgICBxdWVyeToge1xuICAgICAgICBib29sOiB7XG4gICAgICAgICAgbXVzdDogW3F1ZXJ5XSxcbiAgICAgICAgICBmaWx0ZXI6IFtwZXJtaXNzaW9uRmlsdGVyXVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjbGllbnQuc2VhcmNoKHNlYXJjaFF1ZXJ5KTtcbiAgcmV0dXJuIHJlc3BvbnNlLmJvZHk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlY29yZEF1ZGl0TG9nKGxvZ0RhdGEpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBjb21tYW5kID0gbmV3IFB1dENvbW1hbmQoe1xuICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5BVURJVF9MT0dfVEFCTEUsXG4gICAgICBJdGVtOiB7XG4gICAgICAgIC4uLmxvZ0RhdGEsXG4gICAgICAgIHR0bDogTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCkgKyAoOTAgKiAyNCAqIDYwICogNjApIC8vIDkw5pel5L+d5oyBXG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgYXdhaXQgZHluYW1vZGIuc2VuZChjb21tYW5kKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCfnm6Pmn7vjg63jgrDoqJjpjLLjgqjjg6njg7w6JywgZXJyb3IpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUFjY2Vzc0RlbmllZFJlc3BvbnNlKHJlc3RyaWN0aW9uVHlwZSwgcmVhc29uKSB7XG4gIHJldHVybiB7XG4gICAgc3RhdHVzQ29kZTogNDAzLFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZXJyb3I6ICdBY2Nlc3MgRGVuaWVkJyxcbiAgICAgIHJlc3RyaWN0aW9uVHlwZSxcbiAgICAgIHJlYXNvbixcbiAgICAgIG1lc3NhZ2U6ICfjgqLjgq/jgrvjgrnjgYzmi5LlkKbjgZXjgozjgb7jgZfjgZ8nXG4gICAgfSlcbiAgfTtcbn1cbiAgICBgO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRUaW1lQmFzZWRDaGVja0NvZGUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYFxuY29uc3QgeyBEeW5hbW9EQkNsaWVudCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJyk7XG5jb25zdCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIEdldENvbW1hbmQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2xpYi1keW5hbW9kYicpO1xuXG5jb25zdCBkeW5hbW9DbGllbnQgPSBuZXcgRHluYW1vREJDbGllbnQoeyByZWdpb246IHByb2Nlc3MuZW52LkFXU19SRUdJT04gfSk7XG5jb25zdCBkeW5hbW9kYiA9IER5bmFtb0RCRG9jdW1lbnRDbGllbnQuZnJvbShkeW5hbW9DbGllbnQpO1xuXG5leHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgY29uc29sZS5sb2coJ+KPsCDmmYLplpPjg5njg7zjgrnliLbpmZDjg4Hjgqfjg4Pjgq/plovlp4s6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcbiAgXG4gIHRyeSB7XG4gICAgY29uc3QgeyB1c2VySWQgfSA9IGV2ZW50O1xuICAgIGNvbnN0IHRpbWVSZXN0cmljdGlvbkNvbmZpZyA9IEpTT04ucGFyc2UocHJvY2Vzcy5lbnYuVElNRV9SRVNUUklDVElPTl9DT05GSUcpO1xuICAgIFxuICAgIGlmICghdGltZVJlc3RyaWN0aW9uQ29uZmlnLmVuYWJsZWQpIHtcbiAgICAgIHJldHVybiB7IGFsbG93ZWQ6IHRydWUsIHJlYXNvbjogJ+aZgumWk+ODmeODvOOCueWItumZkOOBr+eEoeWKuScgfTtcbiAgICB9XG4gICAgXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCBjdXJyZW50SG91ciA9IG5vdy5nZXRIb3VycygpO1xuICAgIGNvbnN0IGN1cnJlbnREYXkgPSBub3cuZ2V0RGF5KCk7IC8vIDA95pel5puc5pelLCAxPeaciOabnOaXpSwgLi4uLCA2PeWcn+abnOaXpVxuICAgIGNvbnN0IGN1cnJlbnREYXRlID0gbm93LnRvSVNPU3RyaW5nKCkuc3BsaXQoJ1QnKVswXTsgLy8gWVlZWS1NTS1ERFxuICAgIFxuICAgIC8vIOe3iuaApeOCouOCr+OCu+OCueODpuODvOOCtuODvOODgeOCp+ODg+OCr1xuICAgIGlmICh0aW1lUmVzdHJpY3Rpb25Db25maWcuZW1lcmdlbmN5QWNjZXNzVXNlcnMuaW5jbHVkZXModXNlcklkKSkge1xuICAgICAgcmV0dXJuIHsgXG4gICAgICAgIGFsbG93ZWQ6IHRydWUsIFxuICAgICAgICByZWFzb246ICfnt4rmgKXjgqLjgq/jgrvjgrnjg6bjg7zjgrbjg7wnLFxuICAgICAgICBhY2Nlc3NUeXBlOiAnZW1lcmdlbmN5J1xuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgLy8g44Om44O844K244O844Gu5b256IG344Os44OZ44Or5Y+W5b6XXG4gICAgY29uc3QgdXNlclJvbGUgPSBhd2FpdCBnZXRVc2VyUm9sZSh1c2VySWQpO1xuICAgIFxuICAgIC8vIOaZgumWk+WkluOCouOCr+OCu+OCueioseWPr+W9ueiBt+ODgeOCp+ODg+OCr1xuICAgIGlmICh0aW1lUmVzdHJpY3Rpb25Db25maWcuYWZ0ZXJIb3Vyc1JvbGVzLmluY2x1ZGVzKHVzZXJSb2xlKSkge1xuICAgICAgcmV0dXJuIHsgXG4gICAgICAgIGFsbG93ZWQ6IHRydWUsIFxuICAgICAgICByZWFzb246ICfmmYLplpPlpJbjgqLjgq/jgrvjgrnoqLHlj6/lvbnogbcnLFxuICAgICAgICBhY2Nlc3NUeXBlOiAnYWZ0ZXJfaG91cnNfcm9sZScsXG4gICAgICAgIHVzZXJSb2xlXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDnpZ3ml6Xjg4Hjgqfjg4Pjgq9cbiAgICBpZiAodGltZVJlc3RyaWN0aW9uQ29uZmlnLmhvbGlkYXlzICYmIFxuICAgICAgICB0aW1lUmVzdHJpY3Rpb25Db25maWcuaG9saWRheXMuZGF0ZXMuaW5jbHVkZXMoY3VycmVudERhdGUpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBhbGxvd2VkOiB0aW1lUmVzdHJpY3Rpb25Db25maWcuaG9saWRheXMuYWxsb3dBY2Nlc3MsXG4gICAgICAgIHJlYXNvbjogdGltZVJlc3RyaWN0aW9uQ29uZmlnLmhvbGlkYXlzLmFsbG93QWNjZXNzID8gXG4gICAgICAgICAgJ+elneaXpeOCouOCr+OCu+OCueioseWPrycgOiAn56Wd5pel44Gu44Gf44KB44Ki44Kv44K744K55ouS5ZCmJyxcbiAgICAgICAgYWNjZXNzVHlwZTogJ2hvbGlkYXknXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDllrbmpa3ml6Xjg4Hjgqfjg4Pjgq9cbiAgICBpZiAoIXRpbWVSZXN0cmljdGlvbkNvbmZpZy5idXNpbmVzc0hvdXJzLmJ1c2luZXNzRGF5cy5pbmNsdWRlcyhjdXJyZW50RGF5KSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYWxsb3dlZDogZmFsc2UsXG4gICAgICAgIHJlYXNvbjogJ+WWtualreaXpeWkluOBruOBn+OCgeOCouOCr+OCu+OCueaLkuWQpicsXG4gICAgICAgIGFjY2Vzc1R5cGU6ICdub25fYnVzaW5lc3NfZGF5JyxcbiAgICAgICAgY3VycmVudERheSxcbiAgICAgICAgYnVzaW5lc3NEYXlzOiB0aW1lUmVzdHJpY3Rpb25Db25maWcuYnVzaW5lc3NIb3Vycy5idXNpbmVzc0RheXNcbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIC8vIOWWtualreaZgumWk+ODgeOCp+ODg+OCr1xuICAgIGNvbnN0IHsgc3RhcnRIb3VyLCBlbmRIb3VyIH0gPSB0aW1lUmVzdHJpY3Rpb25Db25maWcuYnVzaW5lc3NIb3VycztcbiAgICBcbiAgICBpZiAoY3VycmVudEhvdXIgPCBzdGFydEhvdXIgfHwgY3VycmVudEhvdXIgPj0gZW5kSG91cikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYWxsb3dlZDogZmFsc2UsXG4gICAgICAgIHJlYXNvbjogJ+WWtualreaZgumWk+WkluOBruOBn+OCgeOCouOCr+OCu+OCueaLkuWQpicsXG4gICAgICAgIGFjY2Vzc1R5cGU6ICdvdXRzaWRlX2J1c2luZXNzX2hvdXJzJyxcbiAgICAgICAgY3VycmVudEhvdXIsXG4gICAgICAgIGJ1c2luZXNzSG91cnM6IHsgc3RhcnRIb3VyLCBlbmRIb3VyIH1cbiAgICAgIH07XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBhbGxvd2VkOiB0cnVlLFxuICAgICAgcmVhc29uOiAn5Za25qWt5pmC6ZaT5YaF44Ki44Kv44K744K5JyxcbiAgICAgIGFjY2Vzc1R5cGU6ICdidXNpbmVzc19ob3VycycsXG4gICAgICBjdXJyZW50SG91cixcbiAgICAgIGN1cnJlbnREYXlcbiAgICB9O1xuICAgIFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+aZgumWk+ODmeODvOOCueWItumZkOODgeOCp+ODg+OCr+OCqOODqeODvDonLCBlcnJvcik7XG4gICAgcmV0dXJuIHtcbiAgICAgIGFsbG93ZWQ6IGZhbHNlLFxuICAgICAgcmVhc29uOiAn5pmC6ZaT44OZ44O844K55Yi26ZmQ44OB44Kn44OD44Kv5Yem55CG44Ko44Op44O8JyxcbiAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlXG4gICAgfTtcbiAgfVxufTtcblxuYXN5bmMgZnVuY3Rpb24gZ2V0VXNlclJvbGUodXNlcklkKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBHZXRDb21tYW5kKHtcbiAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuUEVSTUlTU0lPTl9DQUNIRV9UQUJMRSxcbiAgICAgIEtleToge1xuICAgICAgICB1c2VySWQ6IHVzZXJJZCxcbiAgICAgICAgcmVzb3VyY2VJZDogJ3VzZXJfcHJvZmlsZSdcbiAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5zZW5kKGNvbW1hbmQpO1xuICAgIHJldHVybiByZXN1bHQuSXRlbT8ucm9sZUxldmVsIHx8ICdndWVzdCc7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcign44Om44O844K244O85b256IG35Y+W5b6X44Ko44Op44O8OicsIGVycm9yKTtcbiAgICByZXR1cm4gJ2d1ZXN0JztcbiAgfVxufVxuICAgIGA7XG4gIH1cblxuICBwcml2YXRlIGdldEdlb2dyYXBoaWNDaGVja0NvZGUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYFxuY29uc3QgQVdTID0gcmVxdWlyZSgnYXdzLXNkaycpO1xuY29uc3QgaHR0cHMgPSByZXF1aXJlKCdodHRwcycpO1xuY29uc3QgZHluYW1vZGIgPSBuZXcgQVdTLkR5bmFtb0RCLkRvY3VtZW50Q2xpZW50KCk7XG5cbmV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICBjb25zb2xlLmxvZygn8J+MjSDlnLDnkIbnmoTliLbpmZDjg4Hjgqfjg4Pjgq/plovlp4s6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcbiAgXG4gIHRyeSB7XG4gICAgY29uc3QgeyB1c2VySWQsIGlwQWRkcmVzcyB9ID0gZXZlbnQ7XG4gICAgY29uc3QgZ2VvUmVzdHJpY3Rpb25Db25maWcgPSBKU09OLnBhcnNlKHByb2Nlc3MuZW52LkdFT19SRVNUUklDVElPTl9DT05GSUcpO1xuICAgIFxuICAgIGlmICghZ2VvUmVzdHJpY3Rpb25Db25maWcuZW5hYmxlZCkge1xuICAgICAgcmV0dXJuIHsgYWxsb3dlZDogdHJ1ZSwgcmVhc29uOiAn5Zyw55CG55qE5Yi26ZmQ44Gv54Sh5Yq5JyB9O1xuICAgIH1cbiAgICBcbiAgICAvLyDkvovlpJbjg6bjg7zjgrbjg7zjg4Hjgqfjg4Pjgq9cbiAgICBpZiAoZ2VvUmVzdHJpY3Rpb25Db25maWcuZXhlbXB0VXNlcnMuaW5jbHVkZXModXNlcklkKSkge1xuICAgICAgcmV0dXJuIHsgXG4gICAgICAgIGFsbG93ZWQ6IHRydWUsIFxuICAgICAgICByZWFzb246ICflnLDnkIbnmoTliLbpmZDkvovlpJbjg6bjg7zjgrbjg7wnLFxuICAgICAgICBhY2Nlc3NUeXBlOiAnZXhlbXB0X3VzZXInXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyBJUOOCouODieODrOOCueOBruWcsOeQhueahOS9jee9ruaDheWgseWPluW+l1xuICAgIGNvbnN0IGdlb0xvY2F0aW9uID0gYXdhaXQgZ2V0R2VvTG9jYXRpb24oaXBBZGRyZXNzKTtcbiAgICBcbiAgICBpZiAoIWdlb0xvY2F0aW9uKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBhbGxvd2VkOiBmYWxzZSxcbiAgICAgICAgcmVhc29uOiAn5Zyw55CG55qE5L2N572u5oOF5aCx44Gu5Y+W5b6X44Gr5aSx5pWXJyxcbiAgICAgICAgYWNjZXNzVHlwZTogJ2dlb19sb29rdXBfZmFpbGVkJ1xuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgLy8gVlBO5qSc5Ye6XG4gICAgaWYgKGdlb1Jlc3RyaWN0aW9uQ29uZmlnLnZwbkRldGVjdGlvbi5lbmFibGVkKSB7XG4gICAgICBjb25zdCB2cG5EZXRlY3RlZCA9IGF3YWl0IGRldGVjdFZQTihpcEFkZHJlc3MpO1xuICAgICAgXG4gICAgICBpZiAodnBuRGV0ZWN0ZWQgJiYgIWdlb1Jlc3RyaWN0aW9uQ29uZmlnLnZwbkRldGVjdGlvbi5hbGxvd2VkVnBuVXNlcnMuaW5jbHVkZXModXNlcklkKSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGFsbG93ZWQ6IGZhbHNlLFxuICAgICAgICAgIHJlYXNvbjogJ1ZQTuS9v+eUqOOBjOaknOWHuuOBleOCjOOBvuOBl+OBnycsXG4gICAgICAgICAgYWNjZXNzVHlwZTogJ3Zwbl9kZXRlY3RlZCcsXG4gICAgICAgICAgZ2VvTG9jYXRpb25cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g5Zu95a625Yi26ZmQ44OB44Kn44OD44KvXG4gICAgaWYgKGdlb1Jlc3RyaWN0aW9uQ29uZmlnLmFsbG93ZWRDb3VudHJpZXMubGVuZ3RoID4gMCAmJiBcbiAgICAgICAgIWdlb1Jlc3RyaWN0aW9uQ29uZmlnLmFsbG93ZWRDb3VudHJpZXMuaW5jbHVkZXMoZ2VvTG9jYXRpb24uY291bnRyeUNvZGUpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBhbGxvd2VkOiBmYWxzZSxcbiAgICAgICAgcmVhc29uOiAn6Kix5Y+v44GV44KM44Gm44GE44Gq44GE5Zu944GL44KJ44Gu44Ki44Kv44K744K5JyxcbiAgICAgICAgYWNjZXNzVHlwZTogJ2NvdW50cnlfcmVzdHJpY3RlZCcsXG4gICAgICAgIGdlb0xvY2F0aW9uLFxuICAgICAgICBhbGxvd2VkQ291bnRyaWVzOiBnZW9SZXN0cmljdGlvbkNvbmZpZy5hbGxvd2VkQ291bnRyaWVzXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICAvLyBJUOODrOODs+OCuOODgeOCp+ODg+OCr1xuICAgIGlmIChnZW9SZXN0cmljdGlvbkNvbmZpZy5hbGxvd2VkSXBSYW5nZXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgaXBBbGxvd2VkID0gY2hlY2tJcEluUmFuZ2VzKGlwQWRkcmVzcywgZ2VvUmVzdHJpY3Rpb25Db25maWcuYWxsb3dlZElwUmFuZ2VzKTtcbiAgICAgIFxuICAgICAgaWYgKCFpcEFsbG93ZWQpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBhbGxvd2VkOiBmYWxzZSxcbiAgICAgICAgICByZWFzb246ICfoqLHlj6/jgZXjgozjgabjgYTjgarjgYRJUOODrOODs+OCuOOBi+OCieOBruOCouOCr+OCu+OCuScsXG4gICAgICAgICAgYWNjZXNzVHlwZTogJ2lwX3JhbmdlX3Jlc3RyaWN0ZWQnLFxuICAgICAgICAgIGlwQWRkcmVzcyxcbiAgICAgICAgICBhbGxvd2VkSXBSYW5nZXM6IGdlb1Jlc3RyaWN0aW9uQ29uZmlnLmFsbG93ZWRJcFJhbmdlc1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDjg6rjgrnjgq/jg5njg7zjgrnoqo3oqLxcbiAgICBpZiAoZ2VvUmVzdHJpY3Rpb25Db25maWcucmlza0Jhc2VkQXV0aC5lbmFibGVkKSB7XG4gICAgICBjb25zdCByaXNrQXNzZXNzbWVudCA9IGF3YWl0IGFzc2Vzc0xvY2F0aW9uUmlzayh1c2VySWQsIGdlb0xvY2F0aW9uKTtcbiAgICAgIFxuICAgICAgaWYgKHJpc2tBc3Nlc3NtZW50LnJpc2tMZXZlbCA9PT0gJ2hpZ2gnKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgYWxsb3dlZDogZmFsc2UsXG4gICAgICAgICAgcmVhc29uOiAn55Ww5bi444Gq5aC05omA44GL44KJ44Gu44Ki44Kv44K744K544GM5qSc5Ye644GV44KM44G+44GX44GfJyxcbiAgICAgICAgICBhY2Nlc3NUeXBlOiAnaGlnaF9yaXNrX2xvY2F0aW9uJyxcbiAgICAgICAgICByaXNrQXNzZXNzbWVudCxcbiAgICAgICAgICByZXF1aXJlQWRkaXRpb25hbEF1dGg6IGdlb1Jlc3RyaWN0aW9uQ29uZmlnLnJpc2tCYXNlZEF1dGgucmVxdWlyZUFkZGl0aW9uYWxBdXRoXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBhbGxvd2VkOiB0cnVlLFxuICAgICAgcmVhc29uOiAn5Zyw55CG55qE5Yi26ZmQ44OB44Kn44OD44Kv6YCa6YGOJyxcbiAgICAgIGFjY2Vzc1R5cGU6ICdnZW9fYWxsb3dlZCcsXG4gICAgICBnZW9Mb2NhdGlvblxuICAgIH07XG4gICAgXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcign5Zyw55CG55qE5Yi26ZmQ44OB44Kn44OD44Kv44Ko44Op44O8OicsIGVycm9yKTtcbiAgICByZXR1cm4ge1xuICAgICAgYWxsb3dlZDogZmFsc2UsXG4gICAgICByZWFzb246ICflnLDnkIbnmoTliLbpmZDjg4Hjgqfjg4Pjgq/lh6bnkIbjgqjjg6njg7wnLFxuICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2VcbiAgICB9O1xuICB9XG59O1xuXG5hc3luYyBmdW5jdGlvbiBnZXRHZW9Mb2NhdGlvbihpcEFkZHJlc3MpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBpZiAoIXByb2Nlc3MuZW52LkdFT19MT0NBVElPTl9BUElfRU5EUE9JTlQpIHtcbiAgICAgIC8vIOODleOCqeODvOODq+ODkOODg+OCrzog57Ch5piT55qE44Gq5Zyw55CG55qE5L2N572u5Yik5a6aXG4gICAgICByZXNvbHZlKHtcbiAgICAgICAgY291bnRyeUNvZGU6ICdKUCcsXG4gICAgICAgIGNvdW50cnk6ICdKYXBhbicsXG4gICAgICAgIHJlZ2lvbjogJ1Rva3lvJyxcbiAgICAgICAgY2l0eTogJ1Rva3lvJyxcbiAgICAgICAgc291cmNlOiAnZmFsbGJhY2snXG4gICAgICB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIGhvc3RuYW1lOiBwcm9jZXNzLmVudi5HRU9fTE9DQVRJT05fQVBJX0VORFBPSU5ULFxuICAgICAgcGF0aDogXFxgL2pzb24vXFwke2lwQWRkcmVzc31cXGAsXG4gICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQXV0aG9yaXphdGlvbic6IFxcYEJlYXJlciBcXCR7cHJvY2Vzcy5lbnYuR0VPX0xPQ0FUSU9OX0FQSV9LRVl9XFxgXG4gICAgICB9XG4gICAgfTtcbiAgICBcbiAgICBjb25zdCByZXEgPSBodHRwcy5yZXF1ZXN0KG9wdGlvbnMsIChyZXMpID0+IHtcbiAgICAgIGxldCBkYXRhID0gJyc7XG4gICAgICBcbiAgICAgIHJlcy5vbignZGF0YScsIChjaHVuaykgPT4ge1xuICAgICAgICBkYXRhICs9IGNodW5rO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIHJlcy5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGdlb0RhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgIHJlc29sdmUoe1xuICAgICAgICAgICAgY291bnRyeUNvZGU6IGdlb0RhdGEuY291bnRyeV9jb2RlLFxuICAgICAgICAgICAgY291bnRyeTogZ2VvRGF0YS5jb3VudHJ5X25hbWUsXG4gICAgICAgICAgICByZWdpb246IGdlb0RhdGEucmVnaW9uX25hbWUsXG4gICAgICAgICAgICBjaXR5OiBnZW9EYXRhLmNpdHksXG4gICAgICAgICAgICBzb3VyY2U6ICdhcGknXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgXG4gICAgcmVxLm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xuICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICB9KTtcbiAgICBcbiAgICByZXEuc2V0VGltZW91dCg1MDAwLCAoKSA9PiB7XG4gICAgICByZXEuZGVzdHJveSgpO1xuICAgICAgcmVqZWN0KG5ldyBFcnJvcignR2VvIGxvY2F0aW9uIEFQSSB0aW1lb3V0JykpO1xuICAgIH0pO1xuICAgIFxuICAgIHJlcS5lbmQoKTtcbiAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRldGVjdFZQTihpcEFkZHJlc3MpIHtcbiAgLy8g57Ch5piTVlBO5qSc5Ye644Ot44K444OD44KvXG4gIC8vIOWun+mam+OBruWun+ijheOBp+OBr+WwgueUqOOBrlZQTuaknOWHukFQSeOCkuS9v+eUqFxuICBjb25zdCB2cG5JbmRpY2F0b3JzID0gW1xuICAgICcxMC4nLCAnMTcyLjE2LicsICcxOTIuMTY4LicsIC8vIOODl+ODqeOCpOODmeODvOODiElQ44Os44Oz44K4XG4gICAgJzEyNy4wLjAuMScgLy8g44Ot44O844Kr44Or44Ob44K544OIXG4gIF07XG4gIFxuICByZXR1cm4gdnBuSW5kaWNhdG9ycy5zb21lKGluZGljYXRvciA9PiBpcEFkZHJlc3Muc3RhcnRzV2l0aChpbmRpY2F0b3IpKTtcbn1cblxuZnVuY3Rpb24gY2hlY2tJcEluUmFuZ2VzKGlwQWRkcmVzcywgYWxsb3dlZFJhbmdlcykge1xuICAvLyDnsKHmmJNDSURS56+E5Zuy44OB44Kn44OD44KvXG4gIC8vIOWun+mam+OBruWun+ijheOBp+OBr+OCiOOCiuWOs+WvhuOBqkNJRFLoqIjnrpfjgpLooYzjgYZcbiAgZm9yIChjb25zdCByYW5nZSBvZiBhbGxvd2VkUmFuZ2VzKSB7XG4gICAgaWYgKHJhbmdlLmluY2x1ZGVzKCcvJykpIHtcbiAgICAgIGNvbnN0IFtuZXR3b3JrLCBwcmVmaXhdID0gcmFuZ2Uuc3BsaXQoJy8nKTtcbiAgICAgIC8vIOewoeaYk+ODgeOCp+ODg+OCrzog44ON44OD44OI44Ov44O844Kv6YOo5YiG44Gu5LiA6Ie056K66KqNXG4gICAgICBpZiAoaXBBZGRyZXNzLnN0YXJ0c1dpdGgobmV0d29yay5zcGxpdCgnLicpLnNsaWNlKDAsIHBhcnNlSW50KHByZWZpeCkgLyA4KS5qb2luKCcuJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaXBBZGRyZXNzID09PSByYW5nZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIHJldHVybiBmYWxzZTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYXNzZXNzTG9jYXRpb25SaXNrKHVzZXJJZCwgZ2VvTG9jYXRpb24pIHtcbiAgdHJ5IHtcbiAgICAvLyDjg6bjg7zjgrbjg7zjga7pgY7ljrvjga7jgqLjgq/jgrvjgrnlsaXmrbTjgpLlj5blvpdcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5xdWVyeSh7XG4gICAgICBUYWJsZU5hbWU6IHByb2Nlc3MuZW52LlBFUk1JU1NJT05fQ0FDSEVfVEFCTEUsXG4gICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAndXNlcklkID0gOnVzZXJJZCcsXG4gICAgICBGaWx0ZXJFeHByZXNzaW9uOiAnYmVnaW5zX3dpdGgocmVzb3VyY2VJZCwgOnByZWZpeCknLFxuICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICAnOnVzZXJJZCc6IHVzZXJJZCxcbiAgICAgICAgJzpwcmVmaXgnOiAnYWNjZXNzX2hpc3RvcnlfJ1xuICAgICAgfSxcbiAgICAgIExpbWl0OiAxMCxcbiAgICAgIFNjYW5JbmRleEZvcndhcmQ6IGZhbHNlXG4gICAgfSkucHJvbWlzZSgpO1xuICAgIFxuICAgIGNvbnN0IGFjY2Vzc0hpc3RvcnkgPSByZXN1bHQuSXRlbXMgfHwgW107XG4gICAgXG4gICAgLy8g6YCa5bi444Gu44Ki44Kv44K744K55aC05omA44Go44Gu5q+U6LyDXG4gICAgY29uc3QgdXN1YWxMb2NhdGlvbnMgPSBhY2Nlc3NIaXN0b3J5XG4gICAgICAubWFwKGl0ZW0gPT4gaXRlbS5nZW9Mb2NhdGlvbilcbiAgICAgIC5maWx0ZXIobG9jID0+IGxvYyAmJiBsb2MuY291bnRyeUNvZGUpO1xuICAgIFxuICAgIGNvbnN0IHVzdWFsQ291bnRyaWVzID0gWy4uLm5ldyBTZXQodXN1YWxMb2NhdGlvbnMubWFwKGxvYyA9PiBsb2MuY291bnRyeUNvZGUpKV07XG4gICAgXG4gICAgbGV0IHJpc2tMZXZlbCA9ICdsb3cnO1xuICAgIGxldCByaXNrRmFjdG9ycyA9IFtdO1xuICAgIFxuICAgIC8vIOaWsOOBl+OBhOWbveOBi+OCieOBruOCouOCr+OCu+OCuVxuICAgIGlmICghdXN1YWxDb3VudHJpZXMuaW5jbHVkZXMoZ2VvTG9jYXRpb24uY291bnRyeUNvZGUpKSB7XG4gICAgICByaXNrTGV2ZWwgPSAnbWVkaXVtJztcbiAgICAgIHJpc2tGYWN0b3JzLnB1c2goJ25ld19jb3VudHJ5Jyk7XG4gICAgfVxuICAgIFxuICAgIC8vIOOCouOCr+OCu+OCueWxpeattOOBjOWwkeOBquOBhFxuICAgIGlmIChhY2Nlc3NIaXN0b3J5Lmxlbmd0aCA8IDMpIHtcbiAgICAgIHJpc2tMZXZlbCA9ICdtZWRpdW0nO1xuICAgICAgcmlza0ZhY3RvcnMucHVzaCgnbGltaXRlZF9oaXN0b3J5Jyk7XG4gICAgfVxuICAgIFxuICAgIC8vIOmrmOODquOCueOCr+WbveWutuOBi+OCieOBruOCouOCr+OCu+OCue+8iOS+i++8iVxuICAgIGNvbnN0IGhpZ2hSaXNrQ291bnRyaWVzID0gWydDTicsICdSVScsICdLUCddOyAvLyDkvovnpLpcbiAgICBpZiAoaGlnaFJpc2tDb3VudHJpZXMuaW5jbHVkZXMoZ2VvTG9jYXRpb24uY291bnRyeUNvZGUpKSB7XG4gICAgICByaXNrTGV2ZWwgPSAnaGlnaCc7XG4gICAgICByaXNrRmFjdG9ycy5wdXNoKCdoaWdoX3Jpc2tfY291bnRyeScpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgcmlza0xldmVsLFxuICAgICAgcmlza0ZhY3RvcnMsXG4gICAgICB1c3VhbENvdW50cmllcyxcbiAgICAgIGN1cnJlbnRMb2NhdGlvbjogZ2VvTG9jYXRpb25cbiAgICB9O1xuICAgIFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+ODquOCueOCr+ipleS+oeOCqOODqeODvDonLCBlcnJvcik7XG4gICAgcmV0dXJuIHtcbiAgICAgIHJpc2tMZXZlbDogJ21lZGl1bScsXG4gICAgICByaXNrRmFjdG9yczogWydhc3Nlc3NtZW50X2Vycm9yJ10sXG4gICAgICBlcnJvcjogZXJyb3IubWVzc2FnZVxuICAgIH07XG4gIH1cbn1cbiAgICBgO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXREeW5hbWljUGVybWlzc2lvblVwZGF0ZUNvZGUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYFxuY29uc3QgQVdTID0gcmVxdWlyZSgnYXdzLXNkaycpO1xuY29uc3QgaHR0cHMgPSByZXF1aXJlKCdodHRwcycpO1xuY29uc3QgZHluYW1vZGIgPSBuZXcgQVdTLkR5bmFtb0RCLkRvY3VtZW50Q2xpZW50KCk7XG5cbmV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICBjb25zb2xlLmxvZygn8J+UhCDli5XnmoTmqKnpmZDmm7TmlrDplovlp4s6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcbiAgXG4gIHRyeSB7XG4gICAgY29uc3QgeyB1c2VySWQgfSA9IGV2ZW50O1xuICAgIGNvbnN0IGR5bmFtaWNDb25maWcgPSBKU09OLnBhcnNlKHByb2Nlc3MuZW52LkRZTkFNSUNfUEVSTUlTU0lPTl9DT05GSUcpO1xuICAgIFxuICAgIGlmICghZHluYW1pY0NvbmZpZy5lbmFibGVkKSB7XG4gICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiAn5YuV55qE5qip6ZmQ44Gv54Sh5Yq5JyB9O1xuICAgIH1cbiAgICBcbiAgICBsZXQgdXBkYXRlZFBlcm1pc3Npb25zID0ge1xuICAgICAgcHJvamVjdHM6IFtdLFxuICAgICAgb3JnYW5pemF0aW9uczogW10sXG4gICAgICBkZXBhcnRtZW50czogW10sXG4gICAgICBkYXRhQ2xhc3NpZmljYXRpb25zOiBbXSxcbiAgICAgIHRlbXBvcmFyeUFjY2VzczogW10sXG4gICAgICBsYXN0VXBkYXRlZDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgfTtcbiAgICBcbiAgICAvLyAxLiDjg5fjg63jgrjjgqfjgq/jg4jjg5njg7zjgrnjgqLjgq/jgrvjgrnmm7TmlrBcbiAgICBpZiAoZHluYW1pY0NvbmZpZy5wcm9qZWN0QmFzZWRBY2Nlc3MuZW5hYmxlZCkge1xuICAgICAgY29uc3QgcHJvamVjdFBlcm1pc3Npb25zID0gYXdhaXQgdXBkYXRlUHJvamVjdEJhc2VkUGVybWlzc2lvbnModXNlcklkLCBkeW5hbWljQ29uZmlnLnByb2plY3RCYXNlZEFjY2Vzcyk7XG4gICAgICB1cGRhdGVkUGVybWlzc2lvbnMucHJvamVjdHMgPSBwcm9qZWN0UGVybWlzc2lvbnMucHJvamVjdHM7XG4gICAgICB1cGRhdGVkUGVybWlzc2lvbnMub3JnYW5pemF0aW9ucy5wdXNoKC4uLnByb2plY3RQZXJtaXNzaW9ucy5vcmdhbml6YXRpb25zKTtcbiAgICB9XG4gICAgXG4gICAgLy8gMi4g57WE57mU6ZqO5bGk44OZ44O844K55qip6ZmQ5pu05pawXG4gICAgaWYgKGR5bmFtaWNDb25maWcub3JnYW5pemF0aW9uYWxIaWVyYXJjaHkuZW5hYmxlZCkge1xuICAgICAgY29uc3QgaGllcmFyY2h5UGVybWlzc2lvbnMgPSBhd2FpdCB1cGRhdGVIaWVyYXJjaHlQZXJtaXNzaW9ucyh1c2VySWQsIGR5bmFtaWNDb25maWcub3JnYW5pemF0aW9uYWxIaWVyYXJjaHkpO1xuICAgICAgdXBkYXRlZFBlcm1pc3Npb25zLmRlcGFydG1lbnRzLnB1c2goLi4uaGllcmFyY2h5UGVybWlzc2lvbnMuZGVwYXJ0bWVudHMpO1xuICAgICAgdXBkYXRlZFBlcm1pc3Npb25zLmRhdGFDbGFzc2lmaWNhdGlvbnMucHVzaCguLi5oaWVyYXJjaHlQZXJtaXNzaW9ucy5kYXRhQ2xhc3NpZmljYXRpb25zKTtcbiAgICB9XG4gICAgXG4gICAgLy8gMy4g5LiA5pmC55qE5qip6ZmQ5pu05pawXG4gICAgaWYgKGR5bmFtaWNDb25maWcudGVtcG9yYXJ5QWNjZXNzLmVuYWJsZWQpIHtcbiAgICAgIGNvbnN0IHRlbXBvcmFyeVBlcm1pc3Npb25zID0gYXdhaXQgdXBkYXRlVGVtcG9yYXJ5UGVybWlzc2lvbnModXNlcklkLCBkeW5hbWljQ29uZmlnLnRlbXBvcmFyeUFjY2Vzcyk7XG4gICAgICB1cGRhdGVkUGVybWlzc2lvbnMudGVtcG9yYXJ5QWNjZXNzID0gdGVtcG9yYXJ5UGVybWlzc2lvbnM7XG4gICAgfVxuICAgIFxuICAgIC8vIDQuIOaoqemZkOOBrumHjeikh+mZpOWOu+OBqOato+imj+WMllxuICAgIHVwZGF0ZWRQZXJtaXNzaW9ucyA9IG5vcm1hbGl6ZVBlcm1pc3Npb25zKHVwZGF0ZWRQZXJtaXNzaW9ucyk7XG4gICAgXG4gICAgLy8gNS4g44Kt44Oj44OD44K344Ol44Gr5L+d5a2YXG4gICAgYXdhaXQgZHluYW1vZGIucHV0KHtcbiAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuUEVSTUlTU0lPTl9DQUNIRV9UQUJMRSxcbiAgICAgIEl0ZW06IHtcbiAgICAgICAgdXNlcklkOiB1c2VySWQsXG4gICAgICAgIHJlc291cmNlSWQ6ICdkeW5hbWljX3Blcm1pc3Npb25zJyxcbiAgICAgICAgcGVybWlzc2lvbnM6IHVwZGF0ZWRQZXJtaXNzaW9ucyxcbiAgICAgICAgdHRsOiBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKSArIGR5bmFtaWNDb25maWcucmVmcmVzaEludGVydmFsU2Vjb25kcyxcbiAgICAgICAgdXBkYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgIH1cbiAgICB9KS5wcm9taXNlKCk7XG4gICAgXG4gICAgY29uc29sZS5sb2coXFxg4pyFIFxcJHt1c2VySWR944Gu5YuV55qE5qip6ZmQ5pu05paw5a6M5LqGOiwgSlNPTi5zdHJpbmdpZnkodXBkYXRlZFBlcm1pc3Npb25zLCBudWxsLCAyKVxcYCk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBwZXJtaXNzaW9uczogdXBkYXRlZFBlcm1pc3Npb25zLFxuICAgICAgbWVzc2FnZTogJ+WLleeahOaoqemZkOabtOaWsOWujOS6hidcbiAgICB9O1xuICAgIFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+WLleeahOaoqemZkOabtOaWsOOCqOODqeODvDonLCBlcnJvcik7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgICBtZXNzYWdlOiAn5YuV55qE5qip6ZmQ5pu05paw44Gr5aSx5pWX44GX44G+44GX44GfJ1xuICAgIH07XG4gIH1cbn07XG5cbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVByb2plY3RCYXNlZFBlcm1pc3Npb25zKHVzZXJJZCwgcHJvamVjdENvbmZpZykge1xuICB0cnkge1xuICAgIGxldCB1c2VyUHJvamVjdHMgPSBbXTtcbiAgICBsZXQgb3JnYW5pemF0aW9ucyA9IFtdO1xuICAgIFxuICAgIGlmIChwcm9qZWN0Q29uZmlnLnByb2plY3RNZW1iZXJzaGlwQXBpKSB7XG4gICAgICAvLyDlpJbpg6hBUEnjgYvjgonjg5fjg63jgrjjgqfjgq/jg4jlj4LliqDmg4XloLHjgpLlj5blvpdcbiAgICAgIGNvbnN0IHByb2plY3REYXRhID0gYXdhaXQgY2FsbFByb2plY3RNZW1iZXJzaGlwQXBpKHVzZXJJZCwgcHJvamVjdENvbmZpZy5wcm9qZWN0TWVtYmVyc2hpcEFwaSk7XG4gICAgICB1c2VyUHJvamVjdHMgPSBwcm9qZWN0RGF0YS5wcm9qZWN0cyB8fCBbXTtcbiAgICAgIG9yZ2FuaXphdGlvbnMgPSBwcm9qZWN0RGF0YS5vcmdhbml6YXRpb25zIHx8IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyDjgq3jg6Pjg4Pjgrfjg6XjgYvjgonjg5fjg63jgrjjgqfjgq/jg4jmg4XloLHjgpLlj5blvpdcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtb2RiLmdldCh7XG4gICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuUEVSTUlTU0lPTl9DQUNIRV9UQUJMRSxcbiAgICAgICAgS2V5OiB7XG4gICAgICAgICAgdXNlcklkOiB1c2VySWQsXG4gICAgICAgICAgcmVzb3VyY2VJZDogJ3VzZXJfcHJvamVjdHMnXG4gICAgICAgIH1cbiAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdC5JdGVtKSB7XG4gICAgICAgIHVzZXJQcm9qZWN0cyA9IHJlc3VsdC5JdGVtLnByb2plY3RzIHx8IFtdO1xuICAgICAgICBvcmdhbml6YXRpb25zID0gcmVzdWx0Lkl0ZW0ub3JnYW5pemF0aW9ucyB8fCBbXTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8g44OX44Ot44K444Kn44Kv44OI5qip6ZmQ44Oe44OD44OU44Oz44Kw44Gu6YGp55SoXG4gICAgY29uc3QgbWFwcGVkUGVybWlzc2lvbnMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IHByb2plY3Qgb2YgdXNlclByb2plY3RzKSB7XG4gICAgICBpZiAocHJvamVjdENvbmZpZy5wcm9qZWN0UGVybWlzc2lvbnNbcHJvamVjdF0pIHtcbiAgICAgICAgbWFwcGVkUGVybWlzc2lvbnMucHVzaCguLi5wcm9qZWN0Q29uZmlnLnByb2plY3RQZXJtaXNzaW9uc1twcm9qZWN0XSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBwcm9qZWN0czogdXNlclByb2plY3RzLFxuICAgICAgb3JnYW5pemF0aW9uczogWy4uLm5ldyBTZXQob3JnYW5pemF0aW9ucyldLFxuICAgICAgbWFwcGVkUGVybWlzc2lvbnM6IFsuLi5uZXcgU2V0KG1hcHBlZFBlcm1pc3Npb25zKV1cbiAgICB9O1xuICAgIFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+ODl+ODreOCuOOCp+OCr+ODiOODmeODvOOCueaoqemZkOabtOaWsOOCqOODqeODvDonLCBlcnJvcik7XG4gICAgcmV0dXJuIHsgcHJvamVjdHM6IFtdLCBvcmdhbml6YXRpb25zOiBbXSwgbWFwcGVkUGVybWlzc2lvbnM6IFtdIH07XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlSGllcmFyY2h5UGVybWlzc2lvbnModXNlcklkLCBoaWVyYXJjaHlDb25maWcpIHtcbiAgdHJ5IHtcbiAgICAvLyDjg6bjg7zjgrbjg7zjga7ntYTnuZTpmo7lsaTmg4XloLHjgpLlj5blvpdcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5nZXQoe1xuICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5QRVJNSVNTSU9OX0NBQ0hFX1RBQkxFLFxuICAgICAgS2V5OiB7XG4gICAgICAgIHVzZXJJZDogdXNlcklkLFxuICAgICAgICByZXNvdXJjZUlkOiAndXNlcl9oaWVyYXJjaHknXG4gICAgICB9XG4gICAgfSkucHJvbWlzZSgpO1xuICAgIFxuICAgIGlmICghcmVzdWx0Lkl0ZW0pIHtcbiAgICAgIHJldHVybiB7IGRlcGFydG1lbnRzOiBbXSwgZGF0YUNsYXNzaWZpY2F0aW9uczogW10gfTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgdXNlckhpZXJhcmNoeSA9IHJlc3VsdC5JdGVtLmhpZXJhcmNoeTtcbiAgICBsZXQgZGVwYXJ0bWVudHMgPSBbdXNlckhpZXJhcmNoeS5kZXBhcnRtZW50XTtcbiAgICBsZXQgZGF0YUNsYXNzaWZpY2F0aW9ucyA9IFt1c2VySGllcmFyY2h5LmRhdGFDbGFzc2lmaWNhdGlvbkxldmVsXTtcbiAgICBcbiAgICAvLyDntpnmib/mqKnpmZDjga7pgannlKhcbiAgICBpZiAoaGllcmFyY2h5Q29uZmlnLmluaGVyaXRlZFBlcm1pc3Npb25zKSB7XG4gICAgICBjb25zdCBwYXJlbnREZXBhcnRtZW50cyA9IGhpZXJhcmNoeUNvbmZpZy5oaWVyYXJjaHlbdXNlckhpZXJhcmNoeS5kZXBhcnRtZW50XSB8fCBbXTtcbiAgICAgIGRlcGFydG1lbnRzLnB1c2goLi4ucGFyZW50RGVwYXJ0bWVudHMpO1xuICAgICAgXG4gICAgICAvLyDjg4fjg7zjgr/liIbpoZ7jg6zjg5njg6vjga7ntpnmib9cbiAgICAgIGNvbnN0IGNsYXNzaWZpY2F0aW9uSGllcmFyY2h5ID0ge1xuICAgICAgICAncmVzdHJpY3RlZCc6IFsncmVzdHJpY3RlZCcsICdjb25maWRlbnRpYWwnLCAnaW50ZXJuYWwnLCAncHVibGljJ10sXG4gICAgICAgICdjb25maWRlbnRpYWwnOiBbJ2NvbmZpZGVudGlhbCcsICdpbnRlcm5hbCcsICdwdWJsaWMnXSxcbiAgICAgICAgJ2ludGVybmFsJzogWydpbnRlcm5hbCcsICdwdWJsaWMnXSxcbiAgICAgICAgJ3B1YmxpYyc6IFsncHVibGljJ11cbiAgICAgIH07XG4gICAgICBcbiAgICAgIGNvbnN0IGluaGVyaXRlZENsYXNzaWZpY2F0aW9ucyA9IGNsYXNzaWZpY2F0aW9uSGllcmFyY2h5W3VzZXJIaWVyYXJjaHkuZGF0YUNsYXNzaWZpY2F0aW9uTGV2ZWxdIHx8IFsncHVibGljJ107XG4gICAgICBkYXRhQ2xhc3NpZmljYXRpb25zLnB1c2goLi4uaW5oZXJpdGVkQ2xhc3NpZmljYXRpb25zKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIGRlcGFydG1lbnRzOiBbLi4ubmV3IFNldChkZXBhcnRtZW50cyldLFxuICAgICAgZGF0YUNsYXNzaWZpY2F0aW9uczogWy4uLm5ldyBTZXQoZGF0YUNsYXNzaWZpY2F0aW9ucyldXG4gICAgfTtcbiAgICBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCfpmo7lsaTmqKnpmZDmm7TmlrDjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgIHJldHVybiB7IGRlcGFydG1lbnRzOiBbXSwgZGF0YUNsYXNzaWZpY2F0aW9uczogW10gfTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVUZW1wb3JhcnlQZXJtaXNzaW9ucyh1c2VySWQsIHRlbXBvcmFyeUNvbmZpZykge1xuICB0cnkge1xuICAgIC8vIOS4gOaZgueahOaoqemZkOOBruWPluW+l1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtb2RiLnF1ZXJ5KHtcbiAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuUEVSTUlTU0lPTl9DQUNIRV9UQUJMRSxcbiAgICAgIEtleUNvbmRpdGlvbkV4cHJlc3Npb246ICd1c2VySWQgPSA6dXNlcklkJyxcbiAgICAgIEZpbHRlckV4cHJlc3Npb246ICdiZWdpbnNfd2l0aChyZXNvdXJjZUlkLCA6cHJlZml4KSBBTkQgZXhwaXJlc0F0ID4gOm5vdycsXG4gICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6dXNlcklkJzogdXNlcklkLFxuICAgICAgICAnOnByZWZpeCc6ICd0ZW1wX2FjY2Vzc18nLFxuICAgICAgICAnOm5vdyc6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgfVxuICAgIH0pLnByb21pc2UoKTtcbiAgICBcbiAgICBjb25zdCBhY3RpdmVUZW1wb3JhcnlQZXJtaXNzaW9ucyA9IHJlc3VsdC5JdGVtcyB8fCBbXTtcbiAgICBcbiAgICByZXR1cm4gYWN0aXZlVGVtcG9yYXJ5UGVybWlzc2lvbnMubWFwKGl0ZW0gPT4gKHtcbiAgICAgIHJlc291cmNlSWQ6IGl0ZW0ucmVzb3VyY2VJZCxcbiAgICAgIHBlcm1pc3Npb25zOiBpdGVtLnBlcm1pc3Npb25zLFxuICAgICAgZXhwaXJlc0F0OiBpdGVtLmV4cGlyZXNBdCxcbiAgICAgIGdyYW50ZWRCeTogaXRlbS5ncmFudGVkQnksXG4gICAgICByZWFzb246IGl0ZW0ucmVhc29uXG4gICAgfSkpO1xuICAgIFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+S4gOaZgueahOaoqemZkOabtOaWsOOCqOODqeODvDonLCBlcnJvcik7XG4gICAgcmV0dXJuIFtdO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNhbGxQcm9qZWN0TWVtYmVyc2hpcEFwaSh1c2VySWQsIGFwaUNvbmZpZykge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICBob3N0bmFtZTogYXBpQ29uZmlnLmVuZHBvaW50LFxuICAgICAgcGF0aDogXFxgL2FwaS91c2Vycy9cXCR7dXNlcklkfS9wcm9qZWN0c1xcYCxcbiAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdBdXRob3JpemF0aW9uJzogXFxgQmVhcmVyIFxcJHthcGlDb25maWcuYXBpS2V5fVxcYCxcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgfVxuICAgIH07XG4gICAgXG4gICAgY29uc3QgcmVxID0gaHR0cHMucmVxdWVzdChvcHRpb25zLCAocmVzKSA9PiB7XG4gICAgICBsZXQgZGF0YSA9ICcnO1xuICAgICAgXG4gICAgICByZXMub24oJ2RhdGEnLCAoY2h1bmspID0+IHtcbiAgICAgICAgZGF0YSArPSBjaHVuaztcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICByZXMub24oJ2VuZCcsICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBwcm9qZWN0RGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgcmVzb2x2ZShwcm9qZWN0RGF0YSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgXG4gICAgcmVxLm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xuICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICB9KTtcbiAgICBcbiAgICByZXEuc2V0VGltZW91dCgxMDAwMCwgKCkgPT4ge1xuICAgICAgcmVxLmRlc3Ryb3koKTtcbiAgICAgIHJlamVjdChuZXcgRXJyb3IoJ1Byb2plY3QgbWVtYmVyc2hpcCBBUEkgdGltZW91dCcpKTtcbiAgICB9KTtcbiAgICBcbiAgICByZXEuZW5kKCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVQZXJtaXNzaW9ucyhwZXJtaXNzaW9ucykge1xuICByZXR1cm4ge1xuICAgIHByb2plY3RzOiBbLi4ubmV3IFNldChwZXJtaXNzaW9ucy5wcm9qZWN0cyldLFxuICAgIG9yZ2FuaXphdGlvbnM6IFsuLi5uZXcgU2V0KHBlcm1pc3Npb25zLm9yZ2FuaXphdGlvbnMpXSxcbiAgICBkZXBhcnRtZW50czogWy4uLm5ldyBTZXQocGVybWlzc2lvbnMuZGVwYXJ0bWVudHMpXSxcbiAgICBkYXRhQ2xhc3NpZmljYXRpb25zOiBbLi4ubmV3IFNldChwZXJtaXNzaW9ucy5kYXRhQ2xhc3NpZmljYXRpb25zKV0sXG4gICAgdGVtcG9yYXJ5QWNjZXNzOiBwZXJtaXNzaW9ucy50ZW1wb3JhcnlBY2Nlc3MsXG4gICAgbGFzdFVwZGF0ZWQ6IHBlcm1pc3Npb25zLmxhc3RVcGRhdGVkXG4gIH07XG59XG4gICAgYDtcbiAgfVxufSJdfQ==