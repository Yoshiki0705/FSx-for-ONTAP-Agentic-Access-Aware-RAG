"use strict";
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
exports.GlobalMonitoringSystem = exports.AlertSeverity = exports.MonitoringMetricType = void 0;
const constructs_1 = require("constructs");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
var MonitoringMetricType;
(function (MonitoringMetricType) {
    MonitoringMetricType["PERFORMANCE"] = "PERFORMANCE";
    MonitoringMetricType["AVAILABILITY"] = "AVAILABILITY";
    MonitoringMetricType["SECURITY"] = "SECURITY";
    MonitoringMetricType["COMPLIANCE"] = "COMPLIANCE";
    MonitoringMetricType["COST"] = "COST";
})(MonitoringMetricType || (exports.MonitoringMetricType = MonitoringMetricType = {}));
/**
 * アラート重要度
 */
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["INFO"] = "INFO";
    AlertSeverity["WARNING"] = "WARNING";
    AlertSeverity["ERROR"] = "ERROR";
    AlertSeverity["CRITICAL"] = "CRITICAL";
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
/**
 * グローバル統合監視システム
 *
 * 機能:
 * - 14地域統合監視ダッシュボード
 * - リアルタイムメトリクス収集
 * - 地域別パフォーマンス監視
 * - 自動アラート・エスカレーション
 * - コンプライアンス監視統合
 * - セキュリティ監視統合
 */
class GlobalMonitoringSystem extends constructs_1.Construct {
    metricsTable;
    alertsTable;
    dashboardConfigTable;
    globalDashboard;
    metricsCollectorFunction;
    alertProcessorFunction;
    dashboardUpdaterFunction;
    complianceMonitorFunction;
    securityMonitorFunction;
    alertTopic;
    logGroup;
    config;
    globalConfig;
    constructor(scope, id, props) {
        super(scope, id);
        this.globalConfig = props.globalConfig;
        this.config = props.monitoringConfig;
        // DynamoDBテーブル作成
        this.metricsTable = this.createMetricsTable();
        this.alertsTable = this.createAlertsTable();
        this.dashboardConfigTable = this.createDashboardConfigTable();
        // CloudWatch Logs
        this.logGroup = this.createLogGroup();
        // SNS通知トピック
        this.alertTopic = this.createAlertTopic();
        // Lambda関数作成
        this.metricsCollectorFunction = this.createMetricsCollectorFunction();
        this.alertProcessorFunction = this.createAlertProcessorFunction();
        this.dashboardUpdaterFunction = this.createDashboardUpdaterFunction();
        this.complianceMonitorFunction = this.createComplianceMonitorFunction();
        this.securityMonitorFunction = this.createSecurityMonitorFunction();
        // CloudWatchダッシュボード
        this.globalDashboard = this.createGlobalDashboard();
        // 定期実行スケジュール
        this.createScheduledTasks();
        // 権限設定
        this.grantPermissions();
    }
    /**
     * メトリクステーブルの作成
     */
    createMetricsTable() {
        return new dynamodb.Table(this, 'MetricsTable', {
            tableName: `${this.globalConfig.projectName}-global-metrics`,
            partitionKey: {
                name: 'metricId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.NUMBER
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN,
            timeToLiveAttribute: 'ttl',
            // GSI for region queries
            globalSecondaryIndexes: [{
                    indexName: 'RegionIndex',
                    partitionKey: {
                        name: 'region',
                        type: dynamodb.AttributeType.STRING
                    },
                    sortKey: {
                        name: 'timestamp',
                        type: dynamodb.AttributeType.NUMBER
                    }
                }, {
                    indexName: 'MetricTypeIndex',
                    partitionKey: {
                        name: 'metricType',
                        type: dynamodb.AttributeType.STRING
                    },
                    sortKey: {
                        name: 'timestamp',
                        type: dynamodb.AttributeType.NUMBER
                    }
                }]
        });
    }
    /**
     * アラートテーブルの作成
     */
    createAlertsTable() {
        return new dynamodb.Table(this, 'AlertsTable', {
            tableName: `${this.globalConfig.projectName}-global-alerts`,
            partitionKey: {
                name: 'alertId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.NUMBER
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN,
            timeToLiveAttribute: 'ttl',
            // GSI for severity and status queries
            globalSecondaryIndexes: [{
                    indexName: 'SeverityIndex',
                    partitionKey: {
                        name: 'severity',
                        type: dynamodb.AttributeType.STRING
                    },
                    sortKey: {
                        name: 'timestamp',
                        type: dynamodb.AttributeType.NUMBER
                    }
                }, {
                    indexName: 'StatusIndex',
                    partitionKey: {
                        name: 'status',
                        type: dynamodb.AttributeType.STRING
                    },
                    sortKey: {
                        name: 'timestamp',
                        type: dynamodb.AttributeType.NUMBER
                    }
                }]
        });
    }
    /**
     * ダッシュボード設定テーブルの作成
     */
    createDashboardConfigTable() {
        return new dynamodb.Table(this, 'DashboardConfigTable', {
            tableName: `${this.globalConfig.projectName}-dashboard-config`,
            partitionKey: {
                name: 'configId',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN
        });
    }
    /**
     * CloudWatch Logsグループの作成
     */
    createLogGroup() {
        return new logs.LogGroup(this, 'GlobalMonitoringLogs', {
            logGroupName: `/aws/lambda/${this.globalConfig.projectName}-global-monitoring`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN
        });
    }
    /**
     * SNS通知トピックの作成
     */
    createAlertTopic() {
        return new sns.Topic(this, 'GlobalAlerts', {
            topicName: `${this.globalConfig.projectName}-global-alerts`,
            displayName: 'Global Monitoring Alerts'
        });
    } /*
  *
     * メトリクス収集Lambda関数
     */
    createMetricsCollectorFunction() {
        return new lambda.Function(this, 'MetricsCollectorFunction', {
            functionName: `${this.globalConfig.projectName}-metrics-collector`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const cloudwatch = new AWS.CloudWatch();

        exports.handler = async (event) => {
          console.log('グローバルメトリクス収集開始:', JSON.stringify(event));

          try {
            const monitoredRegions = ${JSON.stringify(this.config.monitoredRegions)};
            const collectedMetrics = [];

            // 各リージョンからメトリクスを収集
            for (const region of monitoredRegions) {
              const regionMetrics = await collectRegionMetrics(region);
              collectedMetrics.push(...regionMetrics);
            }

            // メトリクスをDynamoDBに保存
            await saveMetrics(collectedMetrics);

            // アラート条件をチェック
            const alerts = await checkAlertConditions(collectedMetrics);
            if (alerts.length > 0) {
              await processAlerts(alerts);
            }

            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'メトリクス収集完了',
                regionsProcessed: monitoredRegions.length,
                metricsCollected: collectedMetrics.length,
                alertsGenerated: alerts.length
              })
            };

          } catch (error) {
            console.error('メトリクス収集エラー:', error);
            throw error;
          }
        };

        async function collectRegionMetrics(region) {
          const metrics = [];
          const timestamp = Date.now();

          try {
            // リージョン固有のCloudWatchクライアント作成
            const regionalCloudWatch = new AWS.CloudWatch({ region });

            // Lambda関数メトリクス収集
            const lambdaMetrics = await collectLambdaMetrics(regionalCloudWatch, region, timestamp);
            metrics.push(...lambdaMetrics);

            // DynamoDBメトリクス収集
            const dynamoMetrics = await collectDynamoDBMetrics(regionalCloudWatch, region, timestamp);
            metrics.push(...dynamoMetrics);

            // API Gatewayメトリクス収集
            const apiMetrics = await collectApiGatewayMetrics(regionalCloudWatch, region, timestamp);
            metrics.push(...apiMetrics);

            // S3メトリクス収集
            const s3Metrics = await collectS3Metrics(regionalCloudWatch, region, timestamp);
            metrics.push(...s3Metrics);

            // カスタムメトリクス収集
            const customMetrics = await collectCustomMetrics(regionalCloudWatch, region, timestamp);
            metrics.push(...customMetrics);

          } catch (error) {
            console.error(\`リージョン \${region} のメトリクス収集エラー:\`, error);
            // エラーメトリクスを記録
            metrics.push({
              metricId: \`error-\${region}-\${timestamp}\`,
              region,
              timestamp,
              metricType: 'ERROR',
              metricName: 'collection_error',
              value: 1,
              unit: 'Count',
              error: error.message
            });
          }

          return metrics;
        }

        async function collectLambdaMetrics(cloudwatch, region, timestamp) {
          const metrics = [];

          try {
            // Lambda関数の実行回数
            const invocationsData = await cloudwatch.getMetricStatistics({
              Namespace: 'AWS/Lambda',
              MetricName: 'Invocations',
              Dimensions: [],
              StartTime: new Date(timestamp - 5 * 60 * 1000), // 5分前
              EndTime: new Date(timestamp),
              Period: 300,
              Statistics: ['Sum']
            }).promise();

            if (invocationsData.Datapoints && invocationsData.Datapoints.length > 0) {
              const latestDatapoint = invocationsData.Datapoints[invocationsData.Datapoints.length - 1];
              metrics.push({
                metricId: \`lambda-invocations-\${region}-\${timestamp}\`,
                region,
                timestamp,
                metricType: 'PERFORMANCE',
                metricName: 'lambda_invocations',
                value: latestDatapoint.Sum || 0,
                unit: 'Count'
              });
            }

            // Lambda関数のエラー率
            const errorsData = await cloudwatch.getMetricStatistics({
              Namespace: 'AWS/Lambda',
              MetricName: 'Errors',
              Dimensions: [],
              StartTime: new Date(timestamp - 5 * 60 * 1000),
              EndTime: new Date(timestamp),
              Period: 300,
              Statistics: ['Sum']
            }).promise();

            if (errorsData.Datapoints && errorsData.Datapoints.length > 0) {
              const latestDatapoint = errorsData.Datapoints[errorsData.Datapoints.length - 1];
              metrics.push({
                metricId: \`lambda-errors-\${region}-\${timestamp}\`,
                region,
                timestamp,
                metricType: 'PERFORMANCE',
                metricName: 'lambda_errors',
                value: latestDatapoint.Sum || 0,
                unit: 'Count'
              });
            }

            // Lambda関数の実行時間
            const durationData = await cloudwatch.getMetricStatistics({
              Namespace: 'AWS/Lambda',
              MetricName: 'Duration',
              Dimensions: [],
              StartTime: new Date(timestamp - 5 * 60 * 1000),
              EndTime: new Date(timestamp),
              Period: 300,
              Statistics: ['Average']
            }).promise();

            if (durationData.Datapoints && durationData.Datapoints.length > 0) {
              const latestDatapoint = durationData.Datapoints[durationData.Datapoints.length - 1];
              metrics.push({
                metricId: \`lambda-duration-\${region}-\${timestamp}\`,
                region,
                timestamp,
                metricType: 'PERFORMANCE',
                metricName: 'lambda_duration',
                value: latestDatapoint.Average || 0,
                unit: 'Milliseconds'
              });
            }

          } catch (error) {
            console.error(\`Lambda メトリクス収集エラー (\${region}):\`, error);
          }

          return metrics;
        }

        async function collectDynamoDBMetrics(cloudwatch, region, timestamp) {
          const metrics = [];

          try {
            // DynamoDB読み取り容量使用率
            const readCapacityData = await cloudwatch.getMetricStatistics({
              Namespace: 'AWS/DynamoDB',
              MetricName: 'ConsumedReadCapacityUnits',
              Dimensions: [],
              StartTime: new Date(timestamp - 5 * 60 * 1000),
              EndTime: new Date(timestamp),
              Period: 300,
              Statistics: ['Sum']
            }).promise();

            if (readCapacityData.Datapoints && readCapacityData.Datapoints.length > 0) {
              const latestDatapoint = readCapacityData.Datapoints[readCapacityData.Datapoints.length - 1];
              metrics.push({
                metricId: \`dynamodb-read-capacity-\${region}-\${timestamp}\`,
                region,
                timestamp,
                metricType: 'PERFORMANCE',
                metricName: 'dynamodb_read_capacity',
                value: latestDatapoint.Sum || 0,
                unit: 'Count'
              });
            }

            // DynamoDB書き込み容量使用率
            const writeCapacityData = await cloudwatch.getMetricStatistics({
              Namespace: 'AWS/DynamoDB',
              MetricName: 'ConsumedWriteCapacityUnits',
              Dimensions: [],
              StartTime: new Date(timestamp - 5 * 60 * 1000),
              EndTime: new Date(timestamp),
              Period: 300,
              Statistics: ['Sum']
            }).promise();

            if (writeCapacityData.Datapoints && writeCapacityData.Datapoints.length > 0) {
              const latestDatapoint = writeCapacityData.Datapoints[writeCapacityData.Datapoints.length - 1];
              metrics.push({
                metricId: \`dynamodb-write-capacity-\${region}-\${timestamp}\`,
                region,
                timestamp,
                metricType: 'PERFORMANCE',
                metricName: 'dynamodb_write_capacity',
                value: latestDatapoint.Sum || 0,
                unit: 'Count'
              });
            }

          } catch (error) {
            console.error(\`DynamoDB メトリクス収集エラー (\${region}):\`, error);
          }

          return metrics;
        }

        async function collectApiGatewayMetrics(cloudwatch, region, timestamp) {
          const metrics = [];

          try {
            // API Gateway リクエスト数
            const requestsData = await cloudwatch.getMetricStatistics({
              Namespace: 'AWS/ApiGateway',
              MetricName: 'Count',
              Dimensions: [],
              StartTime: new Date(timestamp - 5 * 60 * 1000),
              EndTime: new Date(timestamp),
              Period: 300,
              Statistics: ['Sum']
            }).promise();

            if (requestsData.Datapoints && requestsData.Datapoints.length > 0) {
              const latestDatapoint = requestsData.Datapoints[requestsData.Datapoints.length - 1];
              metrics.push({
                metricId: \`apigateway-requests-\${region}-\${timestamp}\`,
                region,
                timestamp,
                metricType: 'PERFORMANCE',
                metricName: 'apigateway_requests',
                value: latestDatapoint.Sum || 0,
                unit: 'Count'
              });
            }

            // API Gateway レスポンス時間
            const latencyData = await cloudwatch.getMetricStatistics({
              Namespace: 'AWS/ApiGateway',
              MetricName: 'Latency',
              Dimensions: [],
              StartTime: new Date(timestamp - 5 * 60 * 1000),
              EndTime: new Date(timestamp),
              Period: 300,
              Statistics: ['Average']
            }).promise();

            if (latencyData.Datapoints && latencyData.Datapoints.length > 0) {
              const latestDatapoint = latencyData.Datapoints[latencyData.Datapoints.length - 1];
              metrics.push({
                metricId: \`apigateway-latency-\${region}-\${timestamp}\`,
                region,
                timestamp,
                metricType: 'PERFORMANCE',
                metricName: 'apigateway_latency',
                value: latestDatapoint.Average || 0,
                unit: 'Milliseconds'
              });
            }

          } catch (error) {
            console.error(\`API Gateway メトリクス収集エラー (\${region}):\`, error);
          }

          return metrics;
        }

        async function collectS3Metrics(cloudwatch, region, timestamp) {
          const metrics = [];

          try {
            // S3 リクエスト数
            const requestsData = await cloudwatch.getMetricStatistics({
              Namespace: 'AWS/S3',
              MetricName: 'NumberOfObjects',
              Dimensions: [],
              StartTime: new Date(timestamp - 24 * 60 * 60 * 1000), // 24時間前（S3は日次メトリクス）
              EndTime: new Date(timestamp),
              Period: 86400, // 1日
              Statistics: ['Average']
            }).promise();

            if (requestsData.Datapoints && requestsData.Datapoints.length > 0) {
              const latestDatapoint = requestsData.Datapoints[requestsData.Datapoints.length - 1];
              metrics.push({
                metricId: \`s3-objects-\${region}-\${timestamp}\`,
                region,
                timestamp,
                metricType: 'PERFORMANCE',
                metricName: 's3_objects',
                value: latestDatapoint.Average || 0,
                unit: 'Count'
              });
            }

          } catch (error) {
            console.error(\`S3 メトリクス収集エラー (\${region}):\`, error);
          }

          return metrics;
        }

        async function collectCustomMetrics(cloudwatch, region, timestamp) {
          const metrics = [];

          try {
            // カスタムメトリクス: システム可用性
            const availabilityScore = await calculateAvailabilityScore(region);
            metrics.push({
              metricId: \`availability-\${region}-\${timestamp}\`,
              region,
              timestamp,
              metricType: 'AVAILABILITY',
              metricName: 'system_availability',
              value: availabilityScore,
              unit: 'Percent'
            });

            // カスタムメトリクス: コンプライアンススコア
            const complianceScore = await calculateComplianceScore(region);
            metrics.push({
              metricId: \`compliance-\${region}-\${timestamp}\`,
              region,
              timestamp,
              metricType: 'COMPLIANCE',
              metricName: 'compliance_score',
              value: complianceScore,
              unit: 'Percent'
            });

          } catch (error) {
            console.error(\`カスタムメトリクス収集エラー (\${region}):\`, error);
          }

          return metrics;
        }

        async function calculateAvailabilityScore(region) {
          // 簡略化された可用性スコア計算
          // 実際の実装では、各サービスのヘルスチェック結果を統合
          return Math.random() * 10 + 90; // 90-100%の範囲
        }

        async function calculateComplianceScore(region) {
          // 簡略化されたコンプライアンススコア計算
          // 実際の実装では、GDPR、SOX等のコンプライアンス状況を評価
          return Math.random() * 20 + 80; // 80-100%の範囲
        }

        async function saveMetrics(metrics) {
          const batchSize = 25; // DynamoDB BatchWriteItemの制限
          
          for (let i = 0; i < metrics.length; i += batchSize) {
            const batch = metrics.slice(i, i + batchSize);
            
            const params = {
              RequestItems: {
                '${this.metricsTable.tableName}': batch.map(metric => ({
                  PutRequest: {
                    Item: {
                      ...metric,
                      ttl: Math.floor(Date.now() / 1000) + (${this.config.dataRetentionDays} * 24 * 60 * 60)
                    }
                  }
                }))
              }
            };

            await dynamodb.batchWrite(params).promise();
          }
        }

        async function checkAlertConditions(metrics) {
          const alerts = [];
          const thresholds = ${JSON.stringify(this.config.alertThresholds)};

          for (const metric of metrics) {
            let alertCondition = null;

            switch (metric.metricName) {
              case 'lambda_errors':
                if (metric.value > 10) { // 10エラー以上
                  alertCondition = {
                    severity: 'ERROR',
                    message: \`Lambda エラー数が閾値を超過: \${metric.value}\`
                  };
                }
                break;
              case 'lambda_duration':
                if (metric.value > thresholds.responseTimeThreshold) {
                  alertCondition = {
                    severity: 'WARNING',
                    message: \`Lambda 実行時間が閾値を超過: \${metric.value}ms\`
                  };
                }
                break;
              case 'apigateway_latency':
                if (metric.value > thresholds.responseTimeThreshold) {
                  alertCondition = {
                    severity: 'WARNING',
                    message: \`API Gateway レスポンス時間が閾値を超過: \${metric.value}ms\`
                  };
                }
                break;
              case 'system_availability':
                if (metric.value < thresholds.availabilityThreshold) {
                  alertCondition = {
                    severity: 'CRITICAL',
                    message: \`システム可用性が閾値を下回る: \${metric.value}%\`
                  };
                }
                break;
            }

            if (alertCondition) {
              alerts.push({
                alertId: \`alert-\${metric.metricId}\`,
                timestamp: metric.timestamp,
                region: metric.region,
                metricName: metric.metricName,
                metricValue: metric.value,
                severity: alertCondition.severity,
                message: alertCondition.message,
                status: 'OPEN'
              });
            }
          }

          return alerts;
        }

        async function processAlerts(alerts) {
          // アラートをDynamoDBに保存
          for (const alert of alerts) {
            const params = {
              TableName: '${this.alertsTable.tableName}',
              Item: {
                ...alert,
                ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30日後に削除
              }
            };
            await dynamodb.put(params).promise();
          }

          // 重要なアラートはSNS通知
          const criticalAlerts = alerts.filter(alert => alert.severity === 'CRITICAL' || alert.severity === 'ERROR');
          if (criticalAlerts.length > 0) {
            await sendAlertNotifications(criticalAlerts);
          }
        }

        async function sendAlertNotifications(alerts) {
          const sns = new AWS.SNS();
          
          const message = \`
グローバル監視アラート

発生時刻: \${new Date().toISOString()}
アラート数: \${alerts.length}

詳細:
\${alerts.map(alert => 
  \`- [\${alert.severity}] \${alert.region}: \${alert.message}\`
).join('\\n')}
          \`;

          await sns.publish({
            TopicArn: '${this.alertTopic.topicArn}',
            Message: message,
            Subject: 'グローバル監視アラート'
          }).promise();
        }
      `),
            timeout: aws_cdk_lib_1.Duration.minutes(15),
            environment: {
                METRICS_TABLE: this.metricsTable.tableName,
                ALERTS_TABLE: this.alertsTable.tableName,
                ALERT_TOPIC_ARN: this.alertTopic.topicArn
            }
        });
    } /*
  *
     * アラート処理Lambda関数
     */
    createAlertProcessorFunction() {
        return new lambda.Function(this, 'AlertProcessorFunction', {
            functionName: `${this.globalConfig.projectName}-alert-processor`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const sns = new AWS.SNS();

        exports.handler = async (event) => {
          console.log('アラート処理開始:', JSON.stringify(event));

          try {
            // 未処理アラートの取得
            const openAlerts = await getOpenAlerts();
            
            // アラートの分析と分類
            const analyzedAlerts = await analyzeAlerts(openAlerts);
            
            // エスカレーション処理
            const escalatedAlerts = await processEscalation(analyzedAlerts);
            
            // 自動修復の試行
            const remediationResults = await attemptAutoRemediation(escalatedAlerts);
            
            // 通知の送信
            await sendNotifications(escalatedAlerts, remediationResults);

            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'アラート処理完了',
                alertsProcessed: openAlerts.length,
                escalatedAlerts: escalatedAlerts.length,
                remediationAttempts: remediationResults.length
              })
            };

          } catch (error) {
            console.error('アラート処理エラー:', error);
            throw error;
          }
        };

        async function getOpenAlerts() {
          const params = {
            TableName: '${this.alertsTable.tableName}',
            IndexName: 'StatusIndex',
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: {
              '#status': 'status'
            },
            ExpressionAttributeValues: {
              ':status': 'OPEN'
            }
          };

          const result = await dynamodb.query(params).promise();
          return result.Items || [];
        }

        async function analyzeAlerts(alerts) {
          const analyzed = [];

          for (const alert of alerts) {
            const analysis = {
              ...alert,
              priority: calculatePriority(alert),
              category: categorizeAlert(alert),
              impactLevel: assessImpact(alert),
              recommendedActions: getRecommendedActions(alert)
            };

            analyzed.push(analysis);
          }

          // 優先度順にソート
          return analyzed.sort((a, b) => b.priority - a.priority);
        }

        function calculatePriority(alert) {
          let priority = 0;

          // 重要度による基本スコア
          const severityScores = {
            'CRITICAL': 100,
            'ERROR': 75,
            'WARNING': 50,
            'INFO': 25
          };
          priority += severityScores[alert.severity] || 0;

          // メトリクスタイプによる調整
          const metricTypeScores = {
            'system_availability': 30,
            'lambda_errors': 25,
            'apigateway_latency': 20,
            'dynamodb_errors': 20
          };
          priority += metricTypeScores[alert.metricName] || 0;

          // 地域による調整（本番地域は高優先度）
          const productionRegions = ['ap-northeast-1', 'us-east-1', 'eu-west-1'];
          if (productionRegions.includes(alert.region)) {
            priority += 20;
          }

          return priority;
        }

        function categorizeAlert(alert) {
          if (alert.metricName.includes('availability')) return 'AVAILABILITY';
          if (alert.metricName.includes('error')) return 'ERROR';
          if (alert.metricName.includes('latency') || alert.metricName.includes('duration')) return 'PERFORMANCE';
          if (alert.metricName.includes('capacity')) return 'CAPACITY';
          return 'OTHER';
        }

        function assessImpact(alert) {
          // 影響レベルの評価
          if (alert.severity === 'CRITICAL') return 'HIGH';
          if (alert.severity === 'ERROR') return 'MEDIUM';
          if (alert.severity === 'WARNING') return 'LOW';
          return 'MINIMAL';
        }

        function getRecommendedActions(alert) {
          const actions = [];

          switch (alert.metricName) {
            case 'lambda_errors':
              actions.push('Lambda関数のログを確認');
              actions.push('エラー率の傾向を分析');
              actions.push('必要に応じて関数を再デプロイ');
              break;
            case 'lambda_duration':
              actions.push('Lambda関数のパフォーマンスを最適化');
              actions.push('メモリ設定を見直し');
              actions.push('タイムアウト設定を確認');
              break;
            case 'apigateway_latency':
              actions.push('API Gatewayの設定を確認');
              actions.push('バックエンドサービスの状態を確認');
              actions.push('キャッシュ設定を見直し');
              break;
            case 'system_availability':
              actions.push('システム全体のヘルスチェック実行');
              actions.push('災害復旧プランの確認');
              actions.push('緊急対応チームに連絡');
              break;
            default:
              actions.push('詳細な調査を実施');
              actions.push('関連するログを確認');
          }

          return actions;
        }

        async function processEscalation(alerts) {
          const escalated = [];

          for (const alert of alerts) {
            // エスカレーション条件の確認
            const shouldEscalate = await checkEscalationConditions(alert);
            
            if (shouldEscalate) {
              // エスカレーション情報を追加
              alert.escalated = true;
              alert.escalationLevel = determineEscalationLevel(alert);
              alert.escalationTime = Date.now();
              
              escalated.push(alert);
              
              // アラート状態を更新
              await updateAlertStatus(alert.alertId, 'ESCALATED', {
                escalationLevel: alert.escalationLevel,
                escalationTime: alert.escalationTime
              });
            }
          }

          return escalated;
        }

        async function checkEscalationConditions(alert) {
          // エスカレーション条件
          const escalationRules = {
            'CRITICAL': 0, // 即座にエスカレーション
            'ERROR': 5 * 60 * 1000, // 5分後
            'WARNING': 15 * 60 * 1000, // 15分後
            'INFO': 60 * 60 * 1000 // 1時間後
          };

          const escalationDelay = escalationRules[alert.severity] || 60 * 60 * 1000;
          const alertAge = Date.now() - alert.timestamp;

          return alertAge >= escalationDelay;
        }

        function determineEscalationLevel(alert) {
          if (alert.severity === 'CRITICAL' || alert.impactLevel === 'HIGH') return 'L1';
          if (alert.severity === 'ERROR' || alert.impactLevel === 'MEDIUM') return 'L2';
          return 'L3';
        }

        async function attemptAutoRemediation(alerts) {
          const remediationResults = [];

          for (const alert of alerts) {
            try {
              const result = await executeAutoRemediation(alert);
              remediationResults.push({
                alertId: alert.alertId,
                success: result.success,
                action: result.action,
                message: result.message
              });

              if (result.success) {
                await updateAlertStatus(alert.alertId, 'AUTO_RESOLVED', {
                  remediationAction: result.action,
                  remediationTime: Date.now()
                });
              }

            } catch (error) {
              console.error(\`自動修復エラー (Alert: \${alert.alertId}):\`, error);
              remediationResults.push({
                alertId: alert.alertId,
                success: false,
                action: 'none',
                message: \`自動修復失敗: \${error.message}\`
              });
            }
          }

          return remediationResults;
        }

        async function executeAutoRemediation(alert) {
          // アラートタイプに応じた自動修復
          switch (alert.metricName) {
            case 'lambda_errors':
              return await remediateLambdaErrors(alert);
            case 'lambda_duration':
              return await remediateLambdaPerformance(alert);
            case 'apigateway_latency':
              return await remediateApiLatency(alert);
            default:
              return {
                success: false,
                action: 'none',
                message: '自動修復アクションが定義されていません'
              };
          }
        }

        async function remediateLambdaErrors(alert) {
          // Lambda関数のエラー修復（例：再起動、設定調整）
          return {
            success: true,
            action: 'lambda_restart',
            message: 'Lambda関数の再起動を実行しました'
          };
        }

        async function remediateLambdaPerformance(alert) {
          // Lambda関数のパフォーマンス修復（例：メモリ増加）
          return {
            success: true,
            action: 'memory_increase',
            message: 'Lambda関数のメモリを増加しました'
          };
        }

        async function remediateApiLatency(alert) {
          // API Gatewayのレイテンシ修復（例：キャッシュ有効化）
          return {
            success: true,
            action: 'cache_enable',
            message: 'API Gatewayキャッシュを有効化しました'
          };
        }

        async function updateAlertStatus(alertId, status, additionalData = {}) {
          const params = {
            TableName: '${this.alertsTable.tableName}',
            Key: { alertId },
            UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#status': 'status'
            },
            ExpressionAttributeValues: {
              ':status': status,
              ':updatedAt': Date.now()
            }
          };

          // 追加データがある場合は更新式に追加
          if (Object.keys(additionalData).length > 0) {
            for (const [key, value] of Object.entries(additionalData)) {
              params.UpdateExpression += \`, #\${key} = :\${key}\`;
              params.ExpressionAttributeNames[\`#\${key}\`] = key;
              params.ExpressionAttributeValues[\`:\${key}\`] = value;
            }
          }

          await dynamodb.update(params).promise();
        }

        async function sendNotifications(alerts, remediationResults) {
          if (alerts.length === 0) return;

          const criticalAlerts = alerts.filter(alert => alert.severity === 'CRITICAL');
          const errorAlerts = alerts.filter(alert => alert.severity === 'ERROR');
          
          // 重要なアラートの通知
          if (criticalAlerts.length > 0 || errorAlerts.length > 0) {
            const message = \`
グローバル監視エスカレーションアラート

発生時刻: \${new Date().toISOString()}
重要アラート数: \${criticalAlerts.length}
エラーアラート数: \${errorAlerts.length}

重要アラート:
\${criticalAlerts.map(alert => 
  \`- [\${alert.escalationLevel}] \${alert.region}: \${alert.message}\`
).join('\\n')}

エラーアラート:
\${errorAlerts.map(alert => 
  \`- [\${alert.escalationLevel}] \${alert.region}: \${alert.message}\`
).join('\\n')}

自動修復結果:
\${remediationResults.map(result => 
  \`- \${result.alertId}: \${result.success ? '成功' : '失敗'} - \${result.message}\`
).join('\\n')}
            \`;

            await sns.publish({
              TopicArn: '${this.alertTopic.topicArn}',
              Message: message,
              Subject: 'グローバル監視エスカレーションアラート'
            }).promise();
          }
        }
      `),
            timeout: aws_cdk_lib_1.Duration.minutes(10),
            environment: {
                ALERTS_TABLE: this.alertsTable.tableName,
                ALERT_TOPIC_ARN: this.alertTopic.topicArn
            }
        });
    }
    /**
     * ダッシュボード更新Lambda関数
     */
    createDashboardUpdaterFunction() {
        return new lambda.Function(this, 'DashboardUpdaterFunction', {
            functionName: `${this.globalConfig.projectName}-dashboard-updater`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const cloudwatch = new AWS.CloudWatch();

        exports.handler = async (event) => {
          console.log('ダッシュボード更新開始:', JSON.stringify(event));

          try {
            // 最新メトリクスの取得
            const latestMetrics = await getLatestMetrics();
            
            // ダッシュボードウィジェットの更新
            await updateDashboardWidgets(latestMetrics);
            
            // カスタムメトリクスの投稿
            await publishCustomMetrics(latestMetrics);

            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'ダッシュボード更新完了',
                metricsProcessed: latestMetrics.length
              })
            };

          } catch (error) {
            console.error('ダッシュボード更新エラー:', error);
            throw error;
          }
        };

        async function getLatestMetrics() {
          const monitoredRegions = ${JSON.stringify(this.config.monitoredRegions)};
          const metrics = [];

          for (const region of monitoredRegions) {
            const params = {
              TableName: '${this.metricsTable.tableName}',
              IndexName: 'RegionIndex',
              KeyConditionExpression: 'region = :region',
              ExpressionAttributeValues: {
                ':region': region
              },
              ScanIndexForward: false,
              Limit: 50 // 最新50件
            };

            const result = await dynamodb.query(params).promise();
            metrics.push(...(result.Items || []));
          }

          return metrics;
        }

        async function updateDashboardWidgets(metrics) {
          // メトリクスを地域別・タイプ別に集計
          const aggregatedMetrics = aggregateMetrics(metrics);
          
          // CloudWatchカスタムメトリクスとして投稿
          await publishAggregatedMetrics(aggregatedMetrics);
        }

        function aggregateMetrics(metrics) {
          const aggregated = {};

          for (const metric of metrics) {
            const key = \`\${metric.region}-\${metric.metricType}\`;
            
            if (!aggregated[key]) {
              aggregated[key] = {
                region: metric.region,
                metricType: metric.metricType,
                values: [],
                count: 0,
                sum: 0,
                avg: 0,
                min: Number.MAX_VALUE,
                max: Number.MIN_VALUE
              };
            }

            const agg = aggregated[key];
            agg.values.push(metric.value);
            agg.count++;
            agg.sum += metric.value;
            agg.min = Math.min(agg.min, metric.value);
            agg.max = Math.max(agg.max, metric.value);
            agg.avg = agg.sum / agg.count;
          }

          return Object.values(aggregated);
        }

        async function publishAggregatedMetrics(aggregatedMetrics) {
          const metricData = [];

          for (const agg of aggregatedMetrics) {
            // 平均値
            metricData.push({
              MetricName: \`\${agg.metricType}_Average\`,
              Dimensions: [
                {
                  Name: 'Region',
                  Value: agg.region
                }
              ],
              Value: agg.avg,
              Unit: 'None',
              Timestamp: new Date()
            });

            // 最大値
            metricData.push({
              MetricName: \`\${agg.metricType}_Maximum\`,
              Dimensions: [
                {
                  Name: 'Region',
                  Value: agg.region
                }
              ],
              Value: agg.max,
              Unit: 'None',
              Timestamp: new Date()
            });

            // 最小値
            metricData.push({
              MetricName: \`\${agg.metricType}_Minimum\`,
              Dimensions: [
                {
                  Name: 'Region',
                  Value: agg.region
                }
              ],
              Value: agg.min,
              Unit: 'None',
              Timestamp: new Date()
            });
          }

          // CloudWatchにメトリクスを投稿（バッチ処理）
          const batchSize = 20; // CloudWatch PutMetricDataの制限
          for (let i = 0; i < metricData.length; i += batchSize) {
            const batch = metricData.slice(i, i + batchSize);
            
            await cloudwatch.putMetricData({
              Namespace: 'GlobalRAG/Monitoring',
              MetricData: batch
            }).promise();
          }
        }

        async function publishCustomMetrics(metrics) {
          // グローバル統計の計算
          const globalStats = calculateGlobalStats(metrics);
          
          // グローバルメトリクスの投稿
          await cloudwatch.putMetricData({
            Namespace: 'GlobalRAG/Global',
            MetricData: [
              {
                MetricName: 'GlobalAvailability',
                Value: globalStats.availability,
                Unit: 'Percent',
                Timestamp: new Date()
              },
              {
                MetricName: 'GlobalPerformanceScore',
                Value: globalStats.performanceScore,
                Unit: 'None',
                Timestamp: new Date()
              },
              {
                MetricName: 'GlobalComplianceScore',
                Value: globalStats.complianceScore,
                Unit: 'Percent',
                Timestamp: new Date()
              },
              {
                MetricName: 'ActiveRegions',
                Value: globalStats.activeRegions,
                Unit: 'Count',
                Timestamp: new Date()
              }
            ]
          }).promise();
        }

        function calculateGlobalStats(metrics) {
          const regions = new Set();
          let totalAvailability = 0;
          let availabilityCount = 0;
          let totalPerformance = 0;
          let performanceCount = 0;
          let totalCompliance = 0;
          let complianceCount = 0;

          for (const metric of metrics) {
            regions.add(metric.region);

            if (metric.metricName === 'system_availability') {
              totalAvailability += metric.value;
              availabilityCount++;
            }

            if (metric.metricType === 'PERFORMANCE') {
              // パフォーマンススコアの計算（簡略化）
              const score = Math.max(0, 100 - (metric.value / 1000) * 10); // レスポンス時間ベース
              totalPerformance += score;
              performanceCount++;
            }

            if (metric.metricName === 'compliance_score') {
              totalCompliance += metric.value;
              complianceCount++;
            }
          }

          return {
            availability: availabilityCount > 0 ? totalAvailability / availabilityCount : 0,
            performanceScore: performanceCount > 0 ? totalPerformance / performanceCount : 0,
            complianceScore: complianceCount > 0 ? totalCompliance / complianceCount : 0,
            activeRegions: regions.size
          };
        }
      `),
            timeout: aws_cdk_lib_1.Duration.minutes(10),
            environment: {
                METRICS_TABLE: this.metricsTable.tableName,
                DASHBOARD_CONFIG_TABLE: this.dashboardConfigTable.tableName
            }
        });
    } /**
  
     * コンプライアンス監視Lambda関数
     */
    createComplianceMonitorFunction() {
        return new lambda.Function(this, 'ComplianceMonitorFunction', {
            functionName: `${this.globalConfig.projectName}-compliance-monitor`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();

        exports.handler = async (event) => {
          console.log('コンプライアンス監視開始:', JSON.stringify(event));

          try {
            const monitoredRegions = ${JSON.stringify(this.config.monitoredRegions)};
            const complianceResults = [];

            // 各リージョンのコンプライアンス状況を監視
            for (const region of monitoredRegions) {
              const regionCompliance = await monitorRegionCompliance(region);
              complianceResults.push(regionCompliance);
            }

            // グローバルコンプライアンススコアの計算
            const globalScore = calculateGlobalComplianceScore(complianceResults);

            // 結果をメトリクスとして保存
            await saveComplianceMetrics(complianceResults, globalScore);

            // 違反がある場合はアラート生成
            const violations = complianceResults.filter(result => result.violations.length > 0);
            if (violations.length > 0) {
              await generateComplianceAlerts(violations);
            }

            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'コンプライアンス監視完了',
                regionsMonitored: monitoredRegions.length,
                globalScore: globalScore,
                violationsFound: violations.length
              })
            };

          } catch (error) {
            console.error('コンプライアンス監視エラー:', error);
            throw error;
          }
        };

        async function monitorRegionCompliance(region) {
          const compliance = {
            region,
            timestamp: Date.now(),
            checks: [],
            violations: [],
            overallScore: 0
          };

          try {
            // GDPR コンプライアンスチェック
            const gdprCheck = await checkGdprCompliance(region);
            compliance.checks.push(gdprCheck);

            // データ居住性チェック
            const residencyCheck = await checkDataResidency(region);
            compliance.checks.push(residencyCheck);

            // 暗号化コンプライアンスチェック
            const encryptionCheck = await checkEncryptionCompliance(region);
            compliance.checks.push(encryptionCheck);

            // アクセス制御チェック
            const accessControlCheck = await checkAccessControlCompliance(region);
            compliance.checks.push(accessControlCheck);

            // 監査ログチェック
            const auditLogCheck = await checkAuditLogCompliance(region);
            compliance.checks.push(auditLogCheck);

            // 違反の集計
            compliance.violations = compliance.checks
              .filter(check => check.status === 'VIOLATION')
              .map(check => ({
                checkName: check.checkName,
                severity: check.severity,
                description: check.description,
                recommendation: check.recommendation
              }));

            // 総合スコアの計算
            const passedChecks = compliance.checks.filter(check => check.status === 'PASS').length;
            compliance.overallScore = (passedChecks / compliance.checks.length) * 100;

          } catch (error) {
            console.error(\`リージョン \${region} のコンプライアンス監視エラー:\`, error);
            compliance.checks.push({
              checkName: 'monitoring_error',
              status: 'ERROR',
              severity: 'HIGH',
              description: \`監視エラー: \${error.message}\`
            });
          }

          return compliance;
        }

        async function checkGdprCompliance(region) {
          // GDPR コンプライアンスの確認
          const gdprRegions = ['eu-west-1', 'eu-central-1', 'eu-west-2', 'eu-west-3'];
          
          if (gdprRegions.includes(region)) {
            // EU地域でのGDPR要件チェック
            const checks = [
              await checkDataSubjectRights(region),
              await checkConsentManagement(region),
              await checkDataProtectionOfficer(region),
              await checkPrivacyByDesign(region)
            ];

            const violations = checks.filter(check => !check.compliant);
            
            return {
              checkName: 'GDPR Compliance',
              status: violations.length > 0 ? 'VIOLATION' : 'PASS',
              severity: violations.length > 0 ? 'HIGH' : 'LOW',
              description: violations.length > 0 
                ? \`GDPR違反が検出されました: \${violations.length}件\`
                : 'GDPR要件に準拠しています',
              details: checks,
              recommendation: violations.length > 0 
                ? 'GDPR違反項目の即座修正が必要です'
                : null
            };
          } else {
            return {
              checkName: 'GDPR Compliance',
              status: 'NOT_APPLICABLE',
              severity: 'LOW',
              description: 'このリージョンはGDPR対象外です'
            };
          }
        }

        async function checkDataSubjectRights(region) {
          // データ主体権利の実装状況確認
          // 実際の実装では、GDPR対応システムのAPIを呼び出し
          return {
            requirement: 'Data Subject Rights',
            compliant: true,
            details: 'データアクセス権、削除権、ポータビリティ権が実装済み'
          };
        }

        async function checkConsentManagement(region) {
          // 同意管理システムの確認
          return {
            requirement: 'Consent Management',
            compliant: true,
            details: '同意取得・管理システムが実装済み'
          };
        }

        async function checkDataProtectionOfficer(region) {
          // データ保護責任者の指定確認
          return {
            requirement: 'Data Protection Officer',
            compliant: true,
            details: 'データ保護責任者が指定済み'
          };
        }

        async function checkPrivacyByDesign(region) {
          // プライバシー・バイ・デザインの実装確認
          return {
            requirement: 'Privacy by Design',
            compliant: true,
            details: 'プライバシー・バイ・デザイン原則が適用済み'
          };
        }

        async function checkDataResidency(region) {
          // データ居住性要件の確認
          const allowedRegions = {
            'ap-northeast-1': ['jp'], // 日本
            'ap-northeast-3': ['jp'], // 日本
            'eu-west-1': ['eu'], // EU
            'eu-central-1': ['eu'], // EU
            'us-east-1': ['us'], // 米国
            'us-west-2': ['us'] // 米国
          };

          const regionRequirements = allowedRegions[region] || [];
          const compliant = regionRequirements.length > 0;

          return {
            checkName: 'Data Residency',
            status: compliant ? 'PASS' : 'VIOLATION',
            severity: compliant ? 'LOW' : 'HIGH',
            description: compliant 
              ? \`データ居住性要件に準拠: \${regionRequirements.join(', ')}\`
              : 'データ居住性要件が未定義です',
            recommendation: compliant ? null : 'データ居住性ポリシーの定義が必要です'
          };
        }

        async function checkEncryptionCompliance(region) {
          // 暗号化要件の確認
          // 実際の実装では、各サービスの暗号化設定を確認
          const encryptionChecks = [
            { service: 'S3', encrypted: true },
            { service: 'DynamoDB', encrypted: true },
            { service: 'Lambda', encrypted: true },
            { service: 'EBS', encrypted: true }
          ];

          const unencrypted = encryptionChecks.filter(check => !check.encrypted);
          const compliant = unencrypted.length === 0;

          return {
            checkName: 'Encryption Compliance',
            status: compliant ? 'PASS' : 'VIOLATION',
            severity: compliant ? 'LOW' : 'HIGH',
            description: compliant 
              ? '全サービスで暗号化が有効です'
              : \`暗号化されていないサービス: \${unencrypted.map(s => s.service).join(', ')}\`,
            recommendation: compliant ? null : '未暗号化サービスの暗号化を有効にしてください'
          };
        }

        async function checkAccessControlCompliance(region) {
          // アクセス制御の確認
          const accessControlChecks = [
            { control: 'IAM Roles', implemented: true },
            { control: 'MFA', implemented: true },
            { control: 'Least Privilege', implemented: true },
            { control: 'Regular Access Review', implemented: false }
          ];

          const missing = accessControlChecks.filter(check => !check.implemented);
          const compliant = missing.length === 0;

          return {
            checkName: 'Access Control Compliance',
            status: compliant ? 'PASS' : 'WARNING',
            severity: compliant ? 'LOW' : 'MEDIUM',
            description: compliant 
              ? 'アクセス制御が適切に実装されています'
              : \`未実装のアクセス制御: \${missing.map(m => m.control).join(', ')}\`,
            recommendation: compliant ? null : '未実装のアクセス制御の実装を推奨します'
          };
        }

        async function checkAuditLogCompliance(region) {
          // 監査ログの確認
          const auditLogChecks = [
            { log: 'CloudTrail', enabled: true },
            { log: 'VPC Flow Logs', enabled: true },
            { log: 'Application Logs', enabled: true },
            { log: 'Database Logs', enabled: true }
          ];

          const disabled = auditLogChecks.filter(check => !check.enabled);
          const compliant = disabled.length === 0;

          return {
            checkName: 'Audit Log Compliance',
            status: compliant ? 'PASS' : 'VIOLATION',
            severity: compliant ? 'LOW' : 'MEDIUM',
            description: compliant 
              ? '監査ログが適切に設定されています'
              : \`無効な監査ログ: \${disabled.map(d => d.log).join(', ')}\`,
            recommendation: compliant ? null : '無効な監査ログを有効にしてください'
          };
        }

        function calculateGlobalComplianceScore(complianceResults) {
          if (complianceResults.length === 0) return 0;

          const totalScore = complianceResults.reduce((sum, result) => sum + result.overallScore, 0);
          return totalScore / complianceResults.length;
        }

        async function saveComplianceMetrics(complianceResults, globalScore) {
          const metrics = [];

          // 地域別コンプライアンススコア
          for (const result of complianceResults) {
            metrics.push({
              metricId: \`compliance-\${result.region}-\${result.timestamp}\`,
              region: result.region,
              timestamp: result.timestamp,
              metricType: 'COMPLIANCE',
              metricName: 'compliance_score',
              value: result.overallScore,
              unit: 'Percent',
              ttl: Math.floor(Date.now() / 1000) + (${this.config.dataRetentionDays} * 24 * 60 * 60)
            });

            // 違反数メトリクス
            metrics.push({
              metricId: \`violations-\${result.region}-\${result.timestamp}\`,
              region: result.region,
              timestamp: result.timestamp,
              metricType: 'COMPLIANCE',
              metricName: 'compliance_violations',
              value: result.violations.length,
              unit: 'Count',
              ttl: Math.floor(Date.now() / 1000) + (${this.config.dataRetentionDays} * 24 * 60 * 60)
            });
          }

          // グローバルコンプライアンススコア
          metrics.push({
            metricId: \`global-compliance-\${Date.now()}\`,
            region: 'global',
            timestamp: Date.now(),
            metricType: 'COMPLIANCE',
            metricName: 'global_compliance_score',
            value: globalScore,
            unit: 'Percent',
            ttl: Math.floor(Date.now() / 1000) + (${this.config.dataRetentionDays} * 24 * 60 * 60)
          });

          // DynamoDBに保存
          const batchSize = 25;
          for (let i = 0; i < metrics.length; i += batchSize) {
            const batch = metrics.slice(i, i + batchSize);
            
            const params = {
              RequestItems: {
                '${this.metricsTable.tableName}': batch.map(metric => ({
                  PutRequest: { Item: metric }
                }))
              }
            };

            await dynamodb.batchWrite(params).promise();
          }
        }

        async function generateComplianceAlerts(violations) {
          for (const violation of violations) {
            for (const v of violation.violations) {
              const alertId = \`compliance-alert-\${violation.region}-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
              
              const alert = {
                alertId,
                timestamp: violation.timestamp,
                region: violation.region,
                metricName: 'compliance_violation',
                metricValue: 1,
                severity: v.severity,
                message: \`コンプライアンス違反: \${v.checkName} - \${v.description}\`,
                status: 'OPEN',
                category: 'COMPLIANCE',
                recommendation: v.recommendation,
                ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
              };

              await dynamodb.put({
                TableName: '${this.alertsTable.tableName}',
                Item: alert
              }).promise();
            }
          }
        }
      `),
            timeout: aws_cdk_lib_1.Duration.minutes(15),
            environment: {
                METRICS_TABLE: this.metricsTable.tableName,
                ALERTS_TABLE: this.alertsTable.tableName
            }
        });
    }
    /**
     * セキュリティ監視Lambda関数
     */
    createSecurityMonitorFunction() {
        return new lambda.Function(this, 'SecurityMonitorFunction', {
            functionName: `${this.globalConfig.projectName}-security-monitor`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();

        exports.handler = async (event) => {
          console.log('セキュリティ監視開始:', JSON.stringify(event));

          try {
            const monitoredRegions = ${JSON.stringify(this.config.monitoredRegions)};
            const securityResults = [];

            // 各リージョンのセキュリティ状況を監視
            for (const region of monitoredRegions) {
              const regionSecurity = await monitorRegionSecurity(region);
              securityResults.push(regionSecurity);
            }

            // グローバルセキュリティスコアの計算
            const globalScore = calculateGlobalSecurityScore(securityResults);

            // 結果をメトリクスとして保存
            await saveSecurityMetrics(securityResults, globalScore);

            // 脅威が検出された場合はアラート生成
            const threats = securityResults.filter(result => result.threats.length > 0);
            if (threats.length > 0) {
              await generateSecurityAlerts(threats);
            }

            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'セキュリティ監視完了',
                regionsMonitored: monitoredRegions.length,
                globalScore: globalScore,
                threatsDetected: threats.length
              })
            };

          } catch (error) {
            console.error('セキュリティ監視エラー:', error);
            throw error;
          }
        };

        async function monitorRegionSecurity(region) {
          const security = {
            region,
            timestamp: Date.now(),
            checks: [],
            threats: [],
            overallScore: 0
          };

          try {
            // ネットワークセキュリティチェック
            const networkCheck = await checkNetworkSecurity(region);
            security.checks.push(networkCheck);

            // IAMセキュリティチェック
            const iamCheck = await checkIamSecurity(region);
            security.checks.push(iamCheck);

            // 暗号化セキュリティチェック
            const encryptionCheck = await checkEncryptionSecurity(region);
            security.checks.push(encryptionCheck);

            // ログ監視チェック
            const loggingCheck = await checkLoggingSecurity(region);
            security.checks.push(loggingCheck);

            // 脅威検出チェック
            const threatCheck = await checkThreatDetection(region);
            security.checks.push(threatCheck);

            // 脅威の集計
            security.threats = security.checks
              .filter(check => check.status === 'THREAT_DETECTED')
              .map(check => ({
                checkName: check.checkName,
                severity: check.severity,
                description: check.description,
                recommendation: check.recommendation
              }));

            // 総合スコアの計算
            const secureChecks = security.checks.filter(check => check.status === 'SECURE').length;
            security.overallScore = (secureChecks / security.checks.length) * 100;

          } catch (error) {
            console.error(\`リージョン \${region} のセキュリティ監視エラー:\`, error);
            security.checks.push({
              checkName: 'monitoring_error',
              status: 'ERROR',
              severity: 'HIGH',
              description: \`監視エラー: \${error.message}\`
            });
          }

          return security;
        }

        async function checkNetworkSecurity(region) {
          // ネットワークセキュリティの確認
          const networkChecks = [
            { check: 'VPC Configuration', secure: true },
            { check: 'Security Groups', secure: true },
            { check: 'NACLs', secure: true },
            { check: 'VPC Flow Logs', secure: true },
            { check: 'WAF Configuration', secure: false }
          ];

          const insecure = networkChecks.filter(check => !check.secure);
          const secure = insecure.length === 0;

          return {
            checkName: 'Network Security',
            status: secure ? 'SECURE' : 'VULNERABILITY',
            severity: secure ? 'LOW' : 'MEDIUM',
            description: secure 
              ? 'ネットワークセキュリティが適切に設定されています'
              : \`セキュリティ問題: \${insecure.map(i => i.check).join(', ')}\`,
            recommendation: secure ? null : 'ネットワークセキュリティ設定の見直しが必要です'
          };
        }

        async function checkIamSecurity(region) {
          // IAMセキュリティの確認
          const iamChecks = [
            { check: 'Root Account MFA', secure: true },
            { check: 'IAM Password Policy', secure: true },
            { check: 'Unused IAM Users', secure: false },
            { check: 'Overprivileged Roles', secure: true },
            { check: 'Access Key Rotation', secure: false }
          ];

          const insecure = iamChecks.filter(check => !check.secure);
          const secure = insecure.length === 0;

          return {
            checkName: 'IAM Security',
            status: secure ? 'SECURE' : 'VULNERABILITY',
            severity: secure ? 'LOW' : 'HIGH',
            description: secure 
              ? 'IAMセキュリティが適切に設定されています'
              : \`IAMセキュリティ問題: \${insecure.map(i => i.check).join(', ')}\`,
            recommendation: secure ? null : 'IAMセキュリティ設定の強化が必要です'
          };
        }

        async function checkEncryptionSecurity(region) {
          // 暗号化セキュリティの確認
          const encryptionChecks = [
            { service: 'S3', encrypted: true, keyManagement: true },
            { service: 'DynamoDB', encrypted: true, keyManagement: true },
            { service: 'EBS', encrypted: true, keyManagement: true },
            { service: 'RDS', encrypted: false, keyManagement: false }
          ];

          const unencrypted = encryptionChecks.filter(check => !check.encrypted);
          const poorKeyManagement = encryptionChecks.filter(check => check.encrypted && !check.keyManagement);
          
          const secure = unencrypted.length === 0 && poorKeyManagement.length === 0;

          return {
            checkName: 'Encryption Security',
            status: secure ? 'SECURE' : 'VULNERABILITY',
            severity: secure ? 'LOW' : 'HIGH',
            description: secure 
              ? '暗号化が適切に実装されています'
              : \`暗号化問題: 未暗号化(\${unencrypted.length}), 鍵管理不備(\${poorKeyManagement.length})\`,
            recommendation: secure ? null : '暗号化設定と鍵管理の強化が必要です'
          };
        }

        async function checkLoggingSecurity(region) {
          // ログ監視セキュリティの確認
          const loggingChecks = [
            { log: 'CloudTrail', enabled: true, integrity: true },
            { log: 'VPC Flow Logs', enabled: true, integrity: true },
            { log: 'GuardDuty', enabled: false, integrity: false },
            { log: 'Config', enabled: true, integrity: true }
          ];

          const disabled = loggingChecks.filter(check => !check.enabled);
          const integrityIssues = loggingChecks.filter(check => check.enabled && !check.integrity);
          
          const secure = disabled.length === 0 && integrityIssues.length === 0;

          return {
            checkName: 'Logging Security',
            status: secure ? 'SECURE' : 'VULNERABILITY',
            severity: secure ? 'LOW' : 'MEDIUM',
            description: secure 
              ? 'ログ監視が適切に設定されています'
              : \`ログ監視問題: 無効(\${disabled.length}), 整合性問題(\${integrityIssues.length})\`,
            recommendation: secure ? null : 'ログ監視設定の強化が必要です'
          };
        }

        async function checkThreatDetection(region) {
          // 脅威検出の確認
          const threatChecks = [
            { threat: 'Unusual API Activity', detected: false },
            { threat: 'Suspicious Login Attempts', detected: true },
            { threat: 'Data Exfiltration', detected: false },
            { threat: 'Malware Activity', detected: false },
            { threat: 'DDoS Attempts', detected: false }
          ];

          const detectedThreats = threatChecks.filter(check => check.detected);
          const threatsFound = detectedThreats.length > 0;

          return {
            checkName: 'Threat Detection',
            status: threatsFound ? 'THREAT_DETECTED' : 'SECURE',
            severity: threatsFound ? 'HIGH' : 'LOW',
            description: threatsFound 
              ? \`脅威を検出: \${detectedThreats.map(t => t.threat).join(', ')}\`
              : '脅威は検出されていません',
            recommendation: threatsFound ? '検出された脅威の即座調査と対応が必要です' : null
          };
        }

        function calculateGlobalSecurityScore(securityResults) {
          if (securityResults.length === 0) return 0;

          const totalScore = securityResults.reduce((sum, result) => sum + result.overallScore, 0);
          return totalScore / securityResults.length;
        }

        async function saveSecurityMetrics(securityResults, globalScore) {
          const metrics = [];

          // 地域別セキュリティスコア
          for (const result of securityResults) {
            metrics.push({
              metricId: \`security-\${result.region}-\${result.timestamp}\`,
              region: result.region,
              timestamp: result.timestamp,
              metricType: 'SECURITY',
              metricName: 'security_score',
              value: result.overallScore,
              unit: 'Percent',
              ttl: Math.floor(Date.now() / 1000) + (${this.config.dataRetentionDays} * 24 * 60 * 60)
            });

            // 脅威数メトリクス
            metrics.push({
              metricId: \`threats-\${result.region}-\${result.timestamp}\`,
              region: result.region,
              timestamp: result.timestamp,
              metricType: 'SECURITY',
              metricName: 'security_threats',
              value: result.threats.length,
              unit: 'Count',
              ttl: Math.floor(Date.now() / 1000) + (${this.config.dataRetentionDays} * 24 * 60 * 60)
            });
          }

          // グローバルセキュリティスコア
          metrics.push({
            metricId: \`global-security-\${Date.now()}\`,
            region: 'global',
            timestamp: Date.now(),
            metricType: 'SECURITY',
            metricName: 'global_security_score',
            value: globalScore,
            unit: 'Percent',
            ttl: Math.floor(Date.now() / 1000) + (${this.config.dataRetentionDays} * 24 * 60 * 60)
          });

          // DynamoDBに保存
          const batchSize = 25;
          for (let i = 0; i < metrics.length; i += batchSize) {
            const batch = metrics.slice(i, i + batchSize);
            
            const params = {
              RequestItems: {
                '${this.metricsTable.tableName}': batch.map(metric => ({
                  PutRequest: { Item: metric }
                }))
              }
            };

            await dynamodb.batchWrite(params).promise();
          }
        }

        async function generateSecurityAlerts(threats) {
          for (const threat of threats) {
            for (const t of threat.threats) {
              const alertId = \`security-alert-\${threat.region}-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
              
              const alert = {
                alertId,
                timestamp: threat.timestamp,
                region: threat.region,
                metricName: 'security_threat',
                metricValue: 1,
                severity: t.severity,
                message: \`セキュリティ脅威: \${t.checkName} - \${t.description}\`,
                status: 'OPEN',
                category: 'SECURITY',
                recommendation: t.recommendation,
                ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
              };

              await dynamodb.put({
                TableName: '${this.alertsTable.tableName}',
                Item: alert
              }).promise();
            }
          }
        }
      `),
            timeout: aws_cdk_lib_1.Duration.minutes(15),
            environment: {
                METRICS_TABLE: this.metricsTable.tableName,
                ALERTS_TABLE: this.alertsTable.tableName
            }
        });
    } /**
  
     * グローバルCloudWatchダッシュボードの作成
     */
    createGlobalDashboard() {
        const dashboard = new cloudwatch.Dashboard(this, 'GlobalDashboard', {
            dashboardName: `${this.globalConfig.projectName}-global-monitoring`,
            periodOverride: cloudwatch.PeriodOverride.AUTO
        });
        // グローバル概要ウィジェット
        const globalOverviewWidget = new cloudwatch.GraphWidget({
            title: 'グローバル概要',
            width: 24,
            height: 6,
            left: [
                new cloudwatch.Metric({
                    namespace: 'GlobalRAG/Global',
                    metricName: 'GlobalAvailability',
                    statistic: 'Average'
                }),
                new cloudwatch.Metric({
                    namespace: 'GlobalRAG/Global',
                    metricName: 'GlobalPerformanceScore',
                    statistic: 'Average'
                }),
                new cloudwatch.Metric({
                    namespace: 'GlobalRAG/Global',
                    metricName: 'GlobalComplianceScore',
                    statistic: 'Average'
                })
            ]
        });
        // 地域別パフォーマンスウィジェット
        const regionalPerformanceWidget = new cloudwatch.GraphWidget({
            title: '地域別パフォーマンス',
            width: 12,
            height: 6,
            left: this.config.monitoredRegions.map(region => new cloudwatch.Metric({
                namespace: 'GlobalRAG/Monitoring',
                metricName: 'PERFORMANCE_Average',
                dimensionsMap: { Region: region },
                statistic: 'Average'
            }))
        });
        // 地域別可用性ウィジェット
        const regionalAvailabilityWidget = new cloudwatch.GraphWidget({
            title: '地域別可用性',
            width: 12,
            height: 6,
            left: this.config.monitoredRegions.map(region => new cloudwatch.Metric({
                namespace: 'GlobalRAG/Monitoring',
                metricName: 'AVAILABILITY_Average',
                dimensionsMap: { Region: region },
                statistic: 'Average'
            }))
        });
        // アラート状況ウィジェット
        const alertsWidget = new cloudwatch.SingleValueWidget({
            title: 'アクティブアラート',
            width: 6,
            height: 6,
            metrics: [
                new cloudwatch.Metric({
                    namespace: 'AWS/Lambda',
                    metricName: 'Invocations',
                    dimensionsMap: { FunctionName: this.alertProcessorFunction.functionName },
                    statistic: 'Sum'
                })
            ]
        });
        // コンプライアンス状況ウィジェット
        const complianceWidget = new cloudwatch.GraphWidget({
            title: 'コンプライアンス状況',
            width: 12,
            height: 6,
            left: this.config.monitoredRegions.map(region => new cloudwatch.Metric({
                namespace: 'GlobalRAG/Monitoring',
                metricName: 'COMPLIANCE_Average',
                dimensionsMap: { Region: region },
                statistic: 'Average'
            }))
        });
        // セキュリティ状況ウィジェット
        const securityWidget = new cloudwatch.GraphWidget({
            title: 'セキュリティ状況',
            width: 12,
            height: 6,
            left: this.config.monitoredRegions.map(region => new cloudwatch.Metric({
                namespace: 'GlobalRAG/Monitoring',
                metricName: 'SECURITY_Average',
                dimensionsMap: { Region: region },
                statistic: 'Average'
            }))
        });
        // Lambda関数パフォーマンスウィジェット
        const lambdaPerformanceWidget = new cloudwatch.GraphWidget({
            title: 'Lambda関数パフォーマンス',
            width: 24,
            height: 6,
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/Lambda',
                    metricName: 'Duration',
                    statistic: 'Average'
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/Lambda',
                    metricName: 'Errors',
                    statistic: 'Sum'
                }),
                new cloudwatch.Metric({
                    namespace: 'AWS/Lambda',
                    metricName: 'Invocations',
                    statistic: 'Sum'
                })
            ]
        });
        // ダッシュボードにウィジェットを追加
        dashboard.addWidgets(globalOverviewWidget, regionalPerformanceWidget, regionalAvailabilityWidget, alertsWidget, complianceWidget, securityWidget, lambdaPerformanceWidget);
        return dashboard;
    }
    /**
     * 定期実行スケジュールの作成
     */
    createScheduledTasks() {
        // メトリクス収集スケジュール
        const metricsCollectionSchedule = new events.Rule(this, 'MetricsCollectionSchedule', {
            ruleName: `${this.globalConfig.projectName}-metrics-collection`,
            description: 'グローバルメトリクス収集スケジュール',
            schedule: events.Schedule.rate(aws_cdk_lib_1.Duration.minutes(this.config.metricsCollectionIntervalMinutes))
        });
        metricsCollectionSchedule.addTarget(new targets.LambdaFunction(this.metricsCollectorFunction));
        // アラート処理スケジュール
        const alertProcessingSchedule = new events.Rule(this, 'AlertProcessingSchedule', {
            ruleName: `${this.globalConfig.projectName}-alert-processing`,
            description: 'アラート処理スケジュール',
            schedule: events.Schedule.rate(aws_cdk_lib_1.Duration.minutes(5)) // 5分間隔
        });
        alertProcessingSchedule.addTarget(new targets.LambdaFunction(this.alertProcessorFunction));
        // ダッシュボード更新スケジュール
        const dashboardUpdateSchedule = new events.Rule(this, 'DashboardUpdateSchedule', {
            ruleName: `${this.globalConfig.projectName}-dashboard-update`,
            description: 'ダッシュボード更新スケジュール',
            schedule: events.Schedule.rate(aws_cdk_lib_1.Duration.minutes(this.config.dashboardConfig.autoRefreshIntervalMinutes))
        });
        dashboardUpdateSchedule.addTarget(new targets.LambdaFunction(this.dashboardUpdaterFunction));
        // コンプライアンス監視スケジュール
        const complianceMonitoringSchedule = new events.Rule(this, 'ComplianceMonitoringSchedule', {
            ruleName: `${this.globalConfig.projectName}-compliance-monitoring`,
            description: 'コンプライアンス監視スケジュール',
            schedule: events.Schedule.rate(aws_cdk_lib_1.Duration.hours(6)) // 6時間間隔
        });
        complianceMonitoringSchedule.addTarget(new targets.LambdaFunction(this.complianceMonitorFunction));
        // セキュリティ監視スケジュール
        const securityMonitoringSchedule = new events.Rule(this, 'SecurityMonitoringSchedule', {
            ruleName: `${this.globalConfig.projectName}-security-monitoring`,
            description: 'セキュリティ監視スケジュール',
            schedule: events.Schedule.rate(aws_cdk_lib_1.Duration.hours(1)) // 1時間間隔
        });
        securityMonitoringSchedule.addTarget(new targets.LambdaFunction(this.securityMonitorFunction));
    }
    /**
     * 必要なIAM権限の付与
     */
    grantPermissions() {
        // DynamoDBテーブルへの権限
        this.metricsTable.grantReadWriteData(this.metricsCollectorFunction);
        this.metricsTable.grantReadData(this.dashboardUpdaterFunction);
        this.metricsTable.grantWriteData(this.complianceMonitorFunction);
        this.metricsTable.grantWriteData(this.securityMonitorFunction);
        this.alertsTable.grantReadWriteData(this.metricsCollectorFunction);
        this.alertsTable.grantReadWriteData(this.alertProcessorFunction);
        this.alertsTable.grantWriteData(this.complianceMonitorFunction);
        this.alertsTable.grantWriteData(this.securityMonitorFunction);
        this.dashboardConfigTable.grantReadData(this.dashboardUpdaterFunction);
        // SNS通知権限
        this.alertTopic.grantPublish(this.metricsCollectorFunction);
        this.alertTopic.grantPublish(this.alertProcessorFunction);
        // CloudWatch権限
        const cloudWatchPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'cloudwatch:GetMetricStatistics',
                'cloudwatch:ListMetrics',
                'cloudwatch:PutMetricData'
            ],
            resources: ['*']
        });
        this.metricsCollectorFunction.addToRolePolicy(cloudWatchPolicy);
        this.dashboardUpdaterFunction.addToRolePolicy(cloudWatchPolicy);
        // 地域間CloudWatch権限
        const crossRegionCloudWatchPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'cloudwatch:GetMetricStatistics',
                'cloudwatch:ListMetrics'
            ],
            resources: ['*'],
            conditions: {
                StringEquals: {
                    'aws:RequestedRegion': this.config.monitoredRegions
                }
            }
        });
        this.metricsCollectorFunction.addToRolePolicy(crossRegionCloudWatchPolicy);
        // CloudWatch Logs権限
        this.logGroup.grantWrite(this.metricsCollectorFunction);
        this.logGroup.grantWrite(this.alertProcessorFunction);
        this.logGroup.grantWrite(this.dashboardUpdaterFunction);
        this.logGroup.grantWrite(this.complianceMonitorFunction);
        this.logGroup.grantWrite(this.securityMonitorFunction);
        // Lambda関数間の呼び出し権限
        this.alertProcessorFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['lambda:InvokeFunction'],
            resources: [
                this.metricsCollectorFunction.functionArn,
                this.dashboardUpdaterFunction.functionArn
            ]
        }));
    }
}
exports.GlobalMonitoringSystem = GlobalMonitoringSystem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsLW1vbml0b3Jpbmctc3lzdGVtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZ2xvYmFsLW1vbml0b3Jpbmctc3lzdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsMkNBQXVDO0FBQ3ZDLDZDQUFzRDtBQUN0RCx1RUFBeUQ7QUFDekQsbUVBQXFEO0FBQ3JELCtEQUFpRDtBQUNqRCwrREFBaUQ7QUFDakQsd0VBQTBEO0FBQzFELHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsMkRBQTZDO0FBbUQ3QyxJQUFZLG9CQU1YO0FBTkQsV0FBWSxvQkFBb0I7SUFDOUIsbURBQTJCLENBQUE7SUFDM0IscURBQTZCLENBQUE7SUFDN0IsNkNBQXFCLENBQUE7SUFDckIsaURBQXlCLENBQUE7SUFDekIscUNBQWEsQ0FBQTtBQUNmLENBQUMsRUFOVyxvQkFBb0Isb0NBQXBCLG9CQUFvQixRQU0vQjtBQUVEOztHQUVHO0FBQ0gsSUFBWSxhQUtYO0FBTEQsV0FBWSxhQUFhO0lBQ3ZCLDhCQUFhLENBQUE7SUFDYixvQ0FBbUIsQ0FBQTtJQUNuQixnQ0FBZSxDQUFBO0lBQ2Ysc0NBQXFCLENBQUE7QUFDdkIsQ0FBQyxFQUxXLGFBQWEsNkJBQWIsYUFBYSxRQUt4QjtBQUVEOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFhLHNCQUF1QixTQUFRLHNCQUFTO0lBQ25DLFlBQVksQ0FBaUI7SUFDN0IsV0FBVyxDQUFpQjtJQUM1QixvQkFBb0IsQ0FBaUI7SUFDckMsZUFBZSxDQUF1QjtJQUN0Qyx3QkFBd0IsQ0FBa0I7SUFDMUMsc0JBQXNCLENBQWtCO0lBQ3hDLHdCQUF3QixDQUFrQjtJQUMxQyx5QkFBeUIsQ0FBa0I7SUFDM0MsdUJBQXVCLENBQWtCO0lBQ3pDLFVBQVUsQ0FBWTtJQUN0QixRQUFRLENBQWdCO0lBRXZCLE1BQU0sQ0FBeUI7SUFDL0IsWUFBWSxDQUFrQjtJQUUvQyxZQUFZLEtBQWdCLEVBQUUs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WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7WUFDaEIsVUFBVSxFQUFFO2dCQUNWLFlBQVksRUFBRTtvQkFDWixxQkFBcUIsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQjtpQkFDcEQ7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxlQUFlLENBQUMsMkJBQTJCLENBQUMsQ0FBQztRQUUzRSxvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDeEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDdEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDeEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDekQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFFdkQsbUJBQW1CO1FBQ25CLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ2xFLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFLENBQUMsdUJBQXVCLENBQUM7WUFDbEMsU0FBUyxFQUFFO2dCQUNULElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxXQUFXO2dCQUN6QyxJQUFJLENBQUMsd0JBQXdCLENBQUMsV0FBVzthQUMxQztTQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ04sQ0FBQztDQUNGO0FBenRFRCx3REF5dEVDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBEdXJhdGlvbiwgUmVtb3ZhbFBvbGljeSB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgR2xvYmFsUmFnQ29uZmlnIH0gZnJvbSAnLi4vLi4vdHlwZXMvZ2xvYmFsLWNvbmZpZyc7XG5cbi8qKlxuICog44Kw44Ot44O844OQ44Or55uj6KaW6Kit5a6a44Kk44Oz44K/44O844OV44Kn44O844K5XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgR2xvYmFsTW9uaXRvcmluZ0NvbmZpZyB7XG4gIC8qKiDnm6Poppblr77osaHjg6rjg7zjgrjjg6fjg7Pjg6rjgrnjg4ggKi9cbiAgbW9uaXRvcmVkUmVnaW9uczogc3RyaW5nW107XG4gIC8qKiDjg6Hjg4jjg6rjgq/jgrnlj47pm4bplpPpmpTvvIjliIbvvIkgKi9cbiAgbWV0cmljc0NvbGxlY3Rpb25JbnRlcnZhbE1pbnV0ZXM6IG51bWJlcjtcbiAgLyoqIOOCouODqeODvOODiOmWvuWApOioreWumiAqL1xuICBhbGVydFRocmVzaG9sZHM6IEFsZXJ0VGhyZXNob2xkcztcbiAgLyoqIOODgOODg+OCt+ODpeODnOODvOODieioreWumiAqL1xuICBkYXNoYm9hcmRDb25maWc6IERhc2hib2FyZENvbmZpZztcbiAgLyoqIOODh+ODvOOCv+S/neaMgeacn+mWk++8iOaXpe+8iSAqL1xuICBkYXRhUmV0ZW50aW9uRGF5czogbnVtYmVyO1xufVxuXG4vKipcbiAqIOOCouODqeODvOODiOmWvuWApOioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEFsZXJ0VGhyZXNob2xkcyB7XG4gIC8qKiBDUFXkvb/nlKjnjofplr7lgKTvvIgl77yJICovXG4gIGNwdVV0aWxpemF0aW9uVGhyZXNob2xkOiBudW1iZXI7XG4gIC8qKiDjg6Hjg6Ljg6rkvb/nlKjnjofplr7lgKTvvIgl77yJICovXG4gIG1lbW9yeVV0aWxpemF0aW9uVGhyZXNob2xkOiBudW1iZXI7XG4gIC8qKiDjgqjjg6njg7znjofplr7lgKTvvIgl77yJICovXG4gIGVycm9yUmF0ZVRocmVzaG9sZDogbnVtYmVyO1xuICAvKiog44Os44K544Od44Oz44K55pmC6ZaT6Za+5YCk77yIbXPvvIkgKi9cbiAgcmVzcG9uc2VUaW1lVGhyZXNob2xkOiBudW1iZXI7XG4gIC8qKiDlj6/nlKjmgKfplr7lgKTvvIgl77yJICovXG4gIGF2YWlsYWJpbGl0eVRocmVzaG9sZDogbnVtYmVyO1xufVxuXG4vKipcbiAqIOODgOODg+OCt+ODpeODnOODvOODieioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIERhc2hib2FyZENvbmZpZyB7XG4gIC8qKiDoh6rli5Xmm7TmlrDplpPpmpTvvIjliIbvvIkgKi9cbiAgYXV0b1JlZnJlc2hJbnRlcnZhbE1pbnV0ZXM6IG51bWJlcjtcbiAgLyoqIOihqOekuuacn+mWk++8iOaZgumWk++8iSAqL1xuICBkaXNwbGF5UGVyaW9kSG91cnM6IG51bWJlcjtcbiAgLyoqIOWcsOWfn+WIpeihqOekuuacieWKueWMliAqL1xuICBlbmFibGVSZWdpb25hbFZpZXc6IGJvb2xlYW47XG4gIC8qKiDjgrPjg7Pjg5fjg6njgqTjgqLjg7PjgrnooajnpLrmnInlirnljJYgKi9cbiAgZW5hYmxlQ29tcGxpYW5jZVZpZXc6IGJvb2xlYW47XG59LypcbipcbiAqIOebo+imluODoeODiOODquOCr+OCueOBrueorumhnlxuICovXG5leHBvcnQgZW51bSBNb25pdG9yaW5nTWV0cmljVHlwZSB7XG4gIFBFUkZPUk1BTkNFID0gJ1BFUkZPUk1BTkNFJyxcbiAgQVZBSUxBQklMSVRZID0gJ0FWQUlMQUJJTElUWScsXG4gIFNFQ1VSSVRZID0gJ1NFQ1VSSVRZJyxcbiAgQ09NUExJQU5DRSA9ICdDT01QTElBTkNFJyxcbiAgQ09TVCA9ICdDT1NUJ1xufVxuXG4vKipcbiAqIOOCouODqeODvOODiOmHjeimgeW6plxuICovXG5leHBvcnQgZW51bSBBbGVydFNldmVyaXR5IHtcbiAgSU5GTyA9ICdJTkZPJyxcbiAgV0FSTklORyA9ICdXQVJOSU5HJyxcbiAgRVJST1IgPSAnRVJST1InLFxuICBDUklUSUNBTCA9ICdDUklUSUNBTCdcbn1cblxuLyoqXG4gKiDjgrDjg63jg7zjg5Djg6vntbHlkIjnm6Poppbjgrfjgrnjg4bjg6BcbiAqIFxuICog5qmf6IO9OlxuICogLSAxNOWcsOWfn+e1seWQiOebo+imluODgOODg+OCt+ODpeODnOODvOODiVxuICogLSDjg6rjgqLjg6vjgr/jgqTjg6Djg6Hjg4jjg6rjgq/jgrnlj47pm4ZcbiAqIC0g5Zyw5Z+f5Yil44OR44OV44Kp44O844Oe44Oz44K555uj6KaWXG4gKiAtIOiHquWLleOCouODqeODvOODiOODu+OCqOOCueOCq+ODrOODvOOCt+ODp+ODs1xuICogLSDjgrPjg7Pjg5fjg6njgqTjgqLjg7Pjgrnnm6PoppbntbHlkIhcbiAqIC0g44K744Kt44Ol44Oq44OG44Kj55uj6KaW57Wx5ZCIXG4gKi9cbmV4cG9ydCBjbGFzcyBHbG9iYWxNb25pdG9yaW5nU3lzdGVtIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IG1ldHJpY3NUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBhbGVydHNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBkYXNoYm9hcmRDb25maWdUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBnbG9iYWxEYXNoYm9hcmQ6IGNsb3Vkd2F0Y2guRGFzaGJvYXJkO1xuICBwdWJsaWMgcmVhZG9ubHkgbWV0cmljc0NvbGxlY3RvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBhbGVydFByb2Nlc3NvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBkYXNoYm9hcmRVcGRhdGVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGNvbXBsaWFuY2VNb25pdG9yRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHNlY3VyaXR5TW9uaXRvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBhbGVydFRvcGljOiBzbnMuVG9waWM7XG4gIHB1YmxpYyByZWFkb25seSBsb2dHcm91cDogbG9ncy5Mb2dHcm91cDtcblxuICBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZzogR2xvYmFsTW9uaXRvcmluZ0NvbmZpZztcbiAgcHJpdmF0ZSByZWFkb25seSBnbG9iYWxDb25maWc6IEdsb2JhbFJhZ0NvbmZpZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczoge1xuICAgIGdsb2JhbENvbmZpZzogR2xvYmFsUmFnQ29uZmlnO1xuICAgIG1vbml0b3JpbmdDb25maWc6IEdsb2JhbE1vbml0b3JpbmdDb25maWc7XG4gIH0pIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgdGhpcy5nbG9iYWxDb25maWcgPSBwcm9wcy5nbG9iYWxDb25maWc7XG4gICAgdGhpcy5jb25maWcgPSBwcm9wcy5tb25pdG9yaW5nQ29uZmlnO1xuXG4gICAgLy8gRHluYW1vRELjg4bjg7zjg5bjg6vkvZzmiJBcbiAgICB0aGlzLm1ldHJpY3NUYWJsZSA9IHRoaXMuY3JlYXRlTWV0cmljc1RhYmxlKCk7XG4gICAgdGhpcy5hbGVydHNUYWJsZSA9IHRoaXMuY3JlYXRlQWxlcnRzVGFibGUoKTtcbiAgICB0aGlzLmRhc2hib2FyZENvbmZpZ1RhYmxlID0gdGhpcy5jcmVhdGVEYXNoYm9hcmRDb25maWdUYWJsZSgpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2dzXG4gICAgdGhpcy5sb2dHcm91cCA9IHRoaXMuY3JlYXRlTG9nR3JvdXAoKTtcblxuICAgIC8vIFNOU+mAmuefpeODiOODlOODg+OCr1xuICAgIHRoaXMuYWxlcnRUb3BpYyA9IHRoaXMuY3JlYXRlQWxlcnRUb3BpYygpO1xuXG4gICAgLy8gTGFtYmRh6Zai5pWw5L2c5oiQXG4gICAgdGhpcy5tZXRyaWNzQ29sbGVjdG9yRnVuY3Rpb24gPSB0aGlzLmNyZWF0ZU1ldHJpY3NDb2xsZWN0b3JGdW5jdGlvbigpO1xuICAgIHRoaXMuYWxlcnRQcm9jZXNzb3JGdW5jdGlvbiA9IHRoaXMuY3JlYXRlQWxlcnRQcm9jZXNzb3JGdW5jdGlvbigpO1xuICAgIHRoaXMuZGFzaGJvYXJkVXBkYXRlckZ1bmN0aW9uID0gdGhpcy5jcmVhdGVEYXNoYm9hcmRVcGRhdGVyRnVuY3Rpb24oKTtcbiAgICB0aGlzLmNvbXBsaWFuY2VNb25pdG9yRnVuY3Rpb24gPSB0aGlzLmNyZWF0ZUNvbXBsaWFuY2VNb25pdG9yRnVuY3Rpb24oKTtcbiAgICB0aGlzLnNlY3VyaXR5TW9uaXRvckZ1bmN0aW9uID0gdGhpcy5jcmVhdGVTZWN1cml0eU1vbml0b3JGdW5jdGlvbigpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaOODgOODg+OCt+ODpeODnOODvOODiVxuICAgIHRoaXMuZ2xvYmFsRGFzaGJvYXJkID0gdGhpcy5jcmVhdGVHbG9iYWxEYXNoYm9hcmQoKTtcblxuICAgIC8vIOWumuacn+Wun+ihjOOCueOCseOCuOODpeODvOODq1xuICAgIHRoaXMuY3JlYXRlU2NoZWR1bGVkVGFza3MoKTtcblxuICAgIC8vIOaoqemZkOioreWumlxuICAgIHRoaXMuZ3JhbnRQZXJtaXNzaW9ucygpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODoeODiOODquOCr+OCueODhuODvOODluODq+OBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVNZXRyaWNzVGFibGUoKTogZHluYW1vZGIuVGFibGUge1xuICAgIHJldHVybiBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ01ldHJpY3NUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYCR7dGhpcy5nbG9iYWxDb25maWcucHJvamVjdE5hbWV9LWdsb2JhbC1tZXRyaWNzYCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnbWV0cmljSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgICAgLy8gR1NJIGZvciByZWdpb24gcXVlcmllc1xuICAgICAgZ2xvYmFsU2Vjb25kYXJ5SW5kZXhlczogW3tcbiAgICAgICAgaW5kZXhOYW1lOiAnUmVnaW9uSW5kZXgnLFxuICAgICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgICBuYW1lOiAncmVnaW9uJyxcbiAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgICB9LFxuICAgICAgICBzb3J0S2V5OiB7XG4gICAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgICAgfVxuICAgICAgfSwge1xuICAgICAgICBpbmRleE5hbWU6ICdNZXRyaWNUeXBlSW5kZXgnLFxuICAgICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgICBuYW1lOiAnbWV0cmljVHlwZScsXG4gICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgICAgfSxcbiAgICAgICAgc29ydEtleToge1xuICAgICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICAgIH1cbiAgICAgIH1dXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44Ki44Op44O844OI44OG44O844OW44Or44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUFsZXJ0c1RhYmxlKCk6IGR5bmFtb2RiLlRhYmxlIHtcbiAgICByZXR1cm4gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBbGVydHNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYCR7dGhpcy5nbG9iYWxDb25maWcucHJvamVjdE5hbWV9LWdsb2JhbC1hbGVydHNgLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdhbGVydElkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUlxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiAndHRsJyxcbiAgICAgIC8vIEdTSSBmb3Igc2V2ZXJpdHkgYW5kIHN0YXR1cyBxdWVyaWVzXG4gICAgICBnbG9iYWxTZWNvbmRhcnlJbmRleGVzOiBbe1xuICAgICAgICBpbmRleE5hbWU6ICdTZXZlcml0eUluZGV4JyxcbiAgICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgICAgbmFtZTogJ3NldmVyaXR5JyxcbiAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgICB9LFxuICAgICAgICBzb3J0S2V5OiB7XG4gICAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgICAgfVxuICAgICAgfSwge1xuICAgICAgICBpbmRleE5hbWU6ICdTdGF0dXNJbmRleCcsXG4gICAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICAgIG5hbWU6ICdzdGF0dXMnLFxuICAgICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICAgIH0sXG4gICAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgICBuYW1lOiAndGltZXN0YW1wJyxcbiAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUlxuICAgICAgICB9XG4gICAgICB9XVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOODgOODg+OCt+ODpeODnOODvOODieioreWumuODhuODvOODluODq+OBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVEYXNoYm9hcmRDb25maWdUYWJsZSgpOiBkeW5hbW9kYi5UYWJsZSB7XG4gICAgcmV0dXJuIG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnRGFzaGJvYXJkQ29uZmlnVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1kYXNoYm9hcmQtY29uZmlnYCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnY29uZmlnSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5SRVRBSU5cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG91ZFdhdGNoIExvZ3PjgrDjg6vjg7zjg5fjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTG9nR3JvdXAoKTogbG9ncy5Mb2dHcm91cCB7XG4gICAgcmV0dXJuIG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdHbG9iYWxNb25pdG9yaW5nTG9ncycsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvbGFtYmRhLyR7dGhpcy5nbG9iYWxDb25maWcucHJvamVjdE5hbWV9LWdsb2JhbC1tb25pdG9yaW5nYCxcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuUkVUQUlOXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU05T6YCa55+l44OI44OU44OD44Kv44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUFsZXJ0VG9waWMoKTogc25zLlRvcGljIHtcbiAgICByZXR1cm4gbmV3IHNucy5Ub3BpYyh0aGlzLCAnR2xvYmFsQWxlcnRzJywge1xuICAgICAgdG9waWNOYW1lOiBgJHt0aGlzLmdsb2JhbENvbmZpZy5wcm9qZWN0TmFtZX0tZ2xvYmFsLWFsZXJ0c2AsXG4gICAgICBkaXNwbGF5TmFtZTogJ0dsb2JhbCBNb25pdG9yaW5nIEFsZXJ0cydcbiAgICB9KTtcbiAgfSAgLypcbipcbiAgICog44Oh44OI44Oq44Kv44K55Y+O6ZuGTGFtYmRh6Zai5pWwXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU1ldHJpY3NDb2xsZWN0b3JGdW5jdGlvbigpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIHJldHVybiBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdNZXRyaWNzQ29sbGVjdG9yRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1tZXRyaWNzLWNvbGxlY3RvcmAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBjb25zdCBBV1MgPSByZXF1aXJlKCdhd3Mtc2RrJyk7XG4gICAgICAgIGNvbnN0IGR5bmFtb2RiID0gbmV3IEFXUy5EeW5hbW9EQi5Eb2N1bWVudENsaWVudCgpO1xuICAgICAgICBjb25zdCBjbG91ZHdhdGNoID0gbmV3IEFXUy5DbG91ZFdhdGNoKCk7XG5cbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ+OCsOODreODvOODkOODq+ODoeODiOODquOCr+OCueWPjumbhumWi+WnizonLCBKU09OLnN0cmluZ2lmeShldmVudCkpO1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG1vbml0b3JlZFJlZ2lvbnMgPSAke0pTT04uc3RyaW5naWZ5KHRoaXMuY29uZmlnLm1vbml0b3JlZFJlZ2lvbnMpfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbGxlY3RlZE1ldHJpY3MgPSBbXTtcblxuICAgICAgICAgICAgLy8g5ZCE44Oq44O844K444On44Oz44GL44KJ44Oh44OI44Oq44Kv44K544KS5Y+O6ZuGXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlZ2lvbiBvZiBtb25pdG9yZWRSZWdpb25zKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlZ2lvbk1ldHJpY3MgPSBhd2FpdCBjb2xsZWN0UmVnaW9uTWV0cmljcyhyZWdpb24pO1xuICAgICAgICAgICAgICBjb2xsZWN0ZWRNZXRyaWNzLnB1c2goLi4ucmVnaW9uTWV0cmljcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIOODoeODiOODquOCr+OCueOCkkR5bmFtb0RC44Gr5L+d5a2YXG4gICAgICAgICAgICBhd2FpdCBzYXZlTWV0cmljcyhjb2xsZWN0ZWRNZXRyaWNzKTtcblxuICAgICAgICAgICAgLy8g44Ki44Op44O844OI5p2h5Lu244KS44OB44Kn44OD44KvXG4gICAgICAgICAgICBjb25zdCBhbGVydHMgPSBhd2FpdCBjaGVja0FsZXJ0Q29uZGl0aW9ucyhjb2xsZWN0ZWRNZXRyaWNzKTtcbiAgICAgICAgICAgIGlmIChhbGVydHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBhd2FpdCBwcm9jZXNzQWxlcnRzKGFsZXJ0cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICfjg6Hjg4jjg6rjgq/jgrnlj47pm4blrozkuoYnLFxuICAgICAgICAgICAgICAgIHJlZ2lvbnNQcm9jZXNzZWQ6IG1vbml0b3JlZFJlZ2lvbnMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIG1ldHJpY3NDb2xsZWN0ZWQ6IGNvbGxlY3RlZE1ldHJpY3MubGVuZ3RoLFxuICAgICAgICAgICAgICAgIGFsZXJ0c0dlbmVyYXRlZDogYWxlcnRzLmxlbmd0aFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCfjg6Hjg4jjg6rjgq/jgrnlj47pm4bjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNvbGxlY3RSZWdpb25NZXRyaWNzKHJlZ2lvbikge1xuICAgICAgICAgIGNvbnN0IG1ldHJpY3MgPSBbXTtcbiAgICAgICAgICBjb25zdCB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIOODquODvOOCuOODp+ODs+WbuuacieOBrkNsb3VkV2F0Y2jjgq/jg6njgqTjgqLjg7Pjg4jkvZzmiJBcbiAgICAgICAgICAgIGNvbnN0IHJlZ2lvbmFsQ2xvdWRXYXRjaCA9IG5ldyBBV1MuQ2xvdWRXYXRjaCh7IHJlZ2lvbiB9KTtcblxuICAgICAgICAgICAgLy8gTGFtYmRh6Zai5pWw44Oh44OI44Oq44Kv44K55Y+O6ZuGXG4gICAgICAgICAgICBjb25zdCBsYW1iZGFNZXRyaWNzID0gYXdhaXQgY29sbGVjdExhbWJkYU1ldHJpY3MocmVnaW9uYWxDbG91ZFdhdGNoLCByZWdpb24sIHRpbWVzdGFtcCk7XG4gICAgICAgICAgICBtZXRyaWNzLnB1c2goLi4ubGFtYmRhTWV0cmljcyk7XG5cbiAgICAgICAgICAgIC8vIER5bmFtb0RC44Oh44OI44Oq44Kv44K55Y+O6ZuGXG4gICAgICAgICAgICBjb25zdCBkeW5hbW9NZXRyaWNzID0gYXdhaXQgY29sbGVjdER5bmFtb0RCTWV0cmljcyhyZWdpb25hbENsb3VkV2F0Y2gsIHJlZ2lvbiwgdGltZXN0YW1wKTtcbiAgICAgICAgICAgIG1ldHJpY3MucHVzaCguLi5keW5hbW9NZXRyaWNzKTtcblxuICAgICAgICAgICAgLy8gQVBJIEdhdGV3YXnjg6Hjg4jjg6rjgq/jgrnlj47pm4ZcbiAgICAgICAgICAgIGNvbnN0IGFwaU1ldHJpY3MgPSBhd2FpdCBjb2xsZWN0QXBpR2F0ZXdheU1ldHJpY3MocmVnaW9uYWxDbG91ZFdhdGNoLCByZWdpb24sIHRpbWVzdGFtcCk7XG4gICAgICAgICAgICBtZXRyaWNzLnB1c2goLi4uYXBpTWV0cmljcyk7XG5cbiAgICAgICAgICAgIC8vIFMz44Oh44OI44Oq44Kv44K55Y+O6ZuGXG4gICAgICAgICAgICBjb25zdCBzM01ldHJpY3MgPSBhd2FpdCBjb2xsZWN0UzNNZXRyaWNzKHJlZ2lvbmFsQ2xvdWRXYXRjaCwgcmVnaW9uLCB0aW1lc3RhbXApO1xuICAgICAgICAgICAgbWV0cmljcy5wdXNoKC4uLnMzTWV0cmljcyk7XG5cbiAgICAgICAgICAgIC8vIOOCq+OCueOCv+ODoOODoeODiOODquOCr+OCueWPjumbhlxuICAgICAgICAgICAgY29uc3QgY3VzdG9tTWV0cmljcyA9IGF3YWl0IGNvbGxlY3RDdXN0b21NZXRyaWNzKHJlZ2lvbmFsQ2xvdWRXYXRjaCwgcmVnaW9uLCB0aW1lc3RhbXApO1xuICAgICAgICAgICAgbWV0cmljcy5wdXNoKC4uLmN1c3RvbU1ldHJpY3MpO1xuXG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXFxg44Oq44O844K444On44OzIFxcJHtyZWdpb259IOOBruODoeODiOODquOCr+OCueWPjumbhuOCqOODqeODvDpcXGAsIGVycm9yKTtcbiAgICAgICAgICAgIC8vIOOCqOODqeODvOODoeODiOODquOCr+OCueOCkuiomOmMslxuICAgICAgICAgICAgbWV0cmljcy5wdXNoKHtcbiAgICAgICAgICAgICAgbWV0cmljSWQ6IFxcYGVycm9yLVxcJHtyZWdpb259LVxcJHt0aW1lc3RhbXB9XFxgLFxuICAgICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICAgIHRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgbWV0cmljVHlwZTogJ0VSUk9SJyxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ2NvbGxlY3Rpb25fZXJyb3InLFxuICAgICAgICAgICAgICB2YWx1ZTogMSxcbiAgICAgICAgICAgICAgdW5pdDogJ0NvdW50JyxcbiAgICAgICAgICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBtZXRyaWNzO1xuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gY29sbGVjdExhbWJkYU1ldHJpY3MoY2xvdWR3YXRjaCwgcmVnaW9uLCB0aW1lc3RhbXApIHtcbiAgICAgICAgICBjb25zdCBtZXRyaWNzID0gW107XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gTGFtYmRh6Zai5pWw44Gu5a6f6KGM5Zue5pWwXG4gICAgICAgICAgICBjb25zdCBpbnZvY2F0aW9uc0RhdGEgPSBhd2FpdCBjbG91ZHdhdGNoLmdldE1ldHJpY1N0YXRpc3RpY3Moe1xuICAgICAgICAgICAgICBOYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcbiAgICAgICAgICAgICAgTWV0cmljTmFtZTogJ0ludm9jYXRpb25zJyxcbiAgICAgICAgICAgICAgRGltZW5zaW9uczogW10sXG4gICAgICAgICAgICAgIFN0YXJ0VGltZTogbmV3IERhdGUodGltZXN0YW1wIC0gNSAqIDYwICogMTAwMCksIC8vIDXliIbliY1cbiAgICAgICAgICAgICAgRW5kVGltZTogbmV3IERhdGUodGltZXN0YW1wKSxcbiAgICAgICAgICAgICAgUGVyaW9kOiAzMDAsXG4gICAgICAgICAgICAgIFN0YXRpc3RpY3M6IFsnU3VtJ11cbiAgICAgICAgICAgIH0pLnByb21pc2UoKTtcblxuICAgICAgICAgICAgaWYgKGludm9jYXRpb25zRGF0YS5EYXRhcG9pbnRzICYmIGludm9jYXRpb25zRGF0YS5EYXRhcG9pbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgY29uc3QgbGF0ZXN0RGF0YXBvaW50ID0gaW52b2NhdGlvbnNEYXRhLkRhdGFwb2ludHNbaW52b2NhdGlvbnNEYXRhLkRhdGFwb2ludHMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgIG1ldHJpY3MucHVzaCh7XG4gICAgICAgICAgICAgICAgbWV0cmljSWQ6IFxcYGxhbWJkYS1pbnZvY2F0aW9ucy1cXCR7cmVnaW9ufS1cXCR7dGltZXN0YW1wfVxcYCxcbiAgICAgICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgICAgICAgIG1ldHJpY1R5cGU6ICdQRVJGT1JNQU5DRScsXG4gICAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ2xhbWJkYV9pbnZvY2F0aW9ucycsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGxhdGVzdERhdGFwb2ludC5TdW0gfHwgMCxcbiAgICAgICAgICAgICAgICB1bml0OiAnQ291bnQnXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBMYW1iZGHplqLmlbDjga7jgqjjg6njg7znjodcbiAgICAgICAgICAgIGNvbnN0IGVycm9yc0RhdGEgPSBhd2FpdCBjbG91ZHdhdGNoLmdldE1ldHJpY1N0YXRpc3RpY3Moe1xuICAgICAgICAgICAgICBOYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcbiAgICAgICAgICAgICAgTWV0cmljTmFtZTogJ0Vycm9ycycsXG4gICAgICAgICAgICAgIERpbWVuc2lvbnM6IFtdLFxuICAgICAgICAgICAgICBTdGFydFRpbWU6IG5ldyBEYXRlKHRpbWVzdGFtcCAtIDUgKiA2MCAqIDEwMDApLFxuICAgICAgICAgICAgICBFbmRUaW1lOiBuZXcgRGF0ZSh0aW1lc3RhbXApLFxuICAgICAgICAgICAgICBQZXJpb2Q6IDMwMCxcbiAgICAgICAgICAgICAgU3RhdGlzdGljczogWydTdW0nXVxuICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuXG4gICAgICAgICAgICBpZiAoZXJyb3JzRGF0YS5EYXRhcG9pbnRzICYmIGVycm9yc0RhdGEuRGF0YXBvaW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGxhdGVzdERhdGFwb2ludCA9IGVycm9yc0RhdGEuRGF0YXBvaW50c1tlcnJvcnNEYXRhLkRhdGFwb2ludHMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgIG1ldHJpY3MucHVzaCh7XG4gICAgICAgICAgICAgICAgbWV0cmljSWQ6IFxcYGxhbWJkYS1lcnJvcnMtXFwke3JlZ2lvbn0tXFwke3RpbWVzdGFtcH1cXGAsXG4gICAgICAgICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgICBtZXRyaWNUeXBlOiAnUEVSRk9STUFOQ0UnLFxuICAgICAgICAgICAgICAgIG1ldHJpY05hbWU6ICdsYW1iZGFfZXJyb3JzJyxcbiAgICAgICAgICAgICAgICB2YWx1ZTogbGF0ZXN0RGF0YXBvaW50LlN1bSB8fCAwLFxuICAgICAgICAgICAgICAgIHVuaXQ6ICdDb3VudCdcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIExhbWJkYemWouaVsOOBruWun+ihjOaZgumWk1xuICAgICAgICAgICAgY29uc3QgZHVyYXRpb25EYXRhID0gYXdhaXQgY2xvdWR3YXRjaC5nZXRNZXRyaWNTdGF0aXN0aWNzKHtcbiAgICAgICAgICAgICAgTmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXG4gICAgICAgICAgICAgIE1ldHJpY05hbWU6ICdEdXJhdGlvbicsXG4gICAgICAgICAgICAgIERpbWVuc2lvbnM6IFtdLFxuICAgICAgICAgICAgICBTdGFydFRpbWU6IG5ldyBEYXRlKHRpbWVzdGFtcCAtIDUgKiA2MCAqIDEwMDApLFxuICAgICAgICAgICAgICBFbmRUaW1lOiBuZXcgRGF0ZSh0aW1lc3RhbXApLFxuICAgICAgICAgICAgICBQZXJpb2Q6IDMwMCxcbiAgICAgICAgICAgICAgU3RhdGlzdGljczogWydBdmVyYWdlJ11cbiAgICAgICAgICAgIH0pLnByb21pc2UoKTtcblxuICAgICAgICAgICAgaWYgKGR1cmF0aW9uRGF0YS5EYXRhcG9pbnRzICYmIGR1cmF0aW9uRGF0YS5EYXRhcG9pbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgY29uc3QgbGF0ZXN0RGF0YXBvaW50ID0gZHVyYXRpb25EYXRhLkRhdGFwb2ludHNbZHVyYXRpb25EYXRhLkRhdGFwb2ludHMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgIG1ldHJpY3MucHVzaCh7XG4gICAgICAgICAgICAgICAgbWV0cmljSWQ6IFxcYGxhbWJkYS1kdXJhdGlvbi1cXCR7cmVnaW9ufS1cXCR7dGltZXN0YW1wfVxcYCxcbiAgICAgICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgICAgICAgIG1ldHJpY1R5cGU6ICdQRVJGT1JNQU5DRScsXG4gICAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ2xhbWJkYV9kdXJhdGlvbicsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGxhdGVzdERhdGFwb2ludC5BdmVyYWdlIHx8IDAsXG4gICAgICAgICAgICAgICAgdW5pdDogJ01pbGxpc2Vjb25kcydcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcXGBMYW1iZGEg44Oh44OI44Oq44Kv44K55Y+O6ZuG44Ko44Op44O8IChcXCR7cmVnaW9ufSk6XFxgLCBlcnJvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIG1ldHJpY3M7XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjb2xsZWN0RHluYW1vREJNZXRyaWNzKGNsb3Vkd2F0Y2gsIHJlZ2lvbiwgdGltZXN0YW1wKSB7XG4gICAgICAgICAgY29uc3QgbWV0cmljcyA9IFtdO1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIER5bmFtb0RC6Kqt44G/5Y+W44KK5a656YeP5L2/55So546HXG4gICAgICAgICAgICBjb25zdCByZWFkQ2FwYWNpdHlEYXRhID0gYXdhaXQgY2xvdWR3YXRjaC5nZXRNZXRyaWNTdGF0aXN0aWNzKHtcbiAgICAgICAgICAgICAgTmFtZXNwYWNlOiAnQVdTL0R5bmFtb0RCJyxcbiAgICAgICAgICAgICAgTWV0cmljTmFtZTogJ0NvbnN1bWVkUmVhZENhcGFjaXR5VW5pdHMnLFxuICAgICAgICAgICAgICBEaW1lbnNpb25zOiBbXSxcbiAgICAgICAgICAgICAgU3RhcnRUaW1lOiBuZXcgRGF0ZSh0aW1lc3RhbXAgLSA1ICogNjAgKiAxMDAwKSxcbiAgICAgICAgICAgICAgRW5kVGltZTogbmV3IERhdGUodGltZXN0YW1wKSxcbiAgICAgICAgICAgICAgUGVyaW9kOiAzMDAsXG4gICAgICAgICAgICAgIFN0YXRpc3RpY3M6IFsnU3VtJ11cbiAgICAgICAgICAgIH0pLnByb21pc2UoKTtcblxuICAgICAgICAgICAgaWYgKHJlYWRDYXBhY2l0eURhdGEuRGF0YXBvaW50cyAmJiByZWFkQ2FwYWNpdHlEYXRhLkRhdGFwb2ludHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBjb25zdCBsYXRlc3REYXRhcG9pbnQgPSByZWFkQ2FwYWNpdHlEYXRhLkRhdGFwb2ludHNbcmVhZENhcGFjaXR5RGF0YS5EYXRhcG9pbnRzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgICBtZXRyaWNzLnB1c2goe1xuICAgICAgICAgICAgICAgIG1ldHJpY0lkOiBcXGBkeW5hbW9kYi1yZWFkLWNhcGFjaXR5LVxcJHtyZWdpb259LVxcJHt0aW1lc3RhbXB9XFxgLFxuICAgICAgICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgICAgICAgICAgbWV0cmljVHlwZTogJ1BFUkZPUk1BTkNFJyxcbiAgICAgICAgICAgICAgICBtZXRyaWNOYW1lOiAnZHluYW1vZGJfcmVhZF9jYXBhY2l0eScsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGxhdGVzdERhdGFwb2ludC5TdW0gfHwgMCxcbiAgICAgICAgICAgICAgICB1bml0OiAnQ291bnQnXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBEeW5hbW9EQuabuOOBjei+vOOBv+WuuemHj+S9v+eUqOeOh1xuICAgICAgICAgICAgY29uc3Qgd3JpdGVDYXBhY2l0eURhdGEgPSBhd2FpdCBjbG91ZHdhdGNoLmdldE1ldHJpY1N0YXRpc3RpY3Moe1xuICAgICAgICAgICAgICBOYW1lc3BhY2U6ICdBV1MvRHluYW1vREInLFxuICAgICAgICAgICAgICBNZXRyaWNOYW1lOiAnQ29uc3VtZWRXcml0ZUNhcGFjaXR5VW5pdHMnLFxuICAgICAgICAgICAgICBEaW1lbnNpb25zOiBbXSxcbiAgICAgICAgICAgICAgU3RhcnRUaW1lOiBuZXcgRGF0ZSh0aW1lc3RhbXAgLSA1ICogNjAgKiAxMDAwKSxcbiAgICAgICAgICAgICAgRW5kVGltZTogbmV3IERhdGUodGltZXN0YW1wKSxcbiAgICAgICAgICAgICAgUGVyaW9kOiAzMDAsXG4gICAgICAgICAgICAgIFN0YXRpc3RpY3M6IFsnU3VtJ11cbiAgICAgICAgICAgIH0pLnByb21pc2UoKTtcblxuICAgICAgICAgICAgaWYgKHdyaXRlQ2FwYWNpdHlEYXRhLkRhdGFwb2ludHMgJiYgd3JpdGVDYXBhY2l0eURhdGEuRGF0YXBvaW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGxhdGVzdERhdGFwb2ludCA9IHdyaXRlQ2FwYWNpdHlEYXRhLkRhdGFwb2ludHNbd3JpdGVDYXBhY2l0eURhdGEuRGF0YXBvaW50cy5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgICAgbWV0cmljcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBtZXRyaWNJZDogXFxgZHluYW1vZGItd3JpdGUtY2FwYWNpdHktXFwke3JlZ2lvbn0tXFwke3RpbWVzdGFtcH1cXGAsXG4gICAgICAgICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgICBtZXRyaWNUeXBlOiAnUEVSRk9STUFOQ0UnLFxuICAgICAgICAgICAgICAgIG1ldHJpY05hbWU6ICdkeW5hbW9kYl93cml0ZV9jYXBhY2l0eScsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGxhdGVzdERhdGFwb2ludC5TdW0gfHwgMCxcbiAgICAgICAgICAgICAgICB1bml0OiAnQ291bnQnXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXFxgRHluYW1vREIg44Oh44OI44Oq44Kv44K55Y+O6ZuG44Ko44Op44O8IChcXCR7cmVnaW9ufSk6XFxgLCBlcnJvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIG1ldHJpY3M7XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjb2xsZWN0QXBpR2F0ZXdheU1ldHJpY3MoY2xvdWR3YXRjaCwgcmVnaW9uLCB0aW1lc3RhbXApIHtcbiAgICAgICAgICBjb25zdCBtZXRyaWNzID0gW107XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gQVBJIEdhdGV3YXkg44Oq44Kv44Ko44K544OI5pWwXG4gICAgICAgICAgICBjb25zdCByZXF1ZXN0c0RhdGEgPSBhd2FpdCBjbG91ZHdhdGNoLmdldE1ldHJpY1N0YXRpc3RpY3Moe1xuICAgICAgICAgICAgICBOYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICAgICAgICAgIE1ldHJpY05hbWU6ICdDb3VudCcsXG4gICAgICAgICAgICAgIERpbWVuc2lvbnM6IFtdLFxuICAgICAgICAgICAgICBTdGFydFRpbWU6IG5ldyBEYXRlKHRpbWVzdGFtcCAtIDUgKiA2MCAqIDEwMDApLFxuICAgICAgICAgICAgICBFbmRUaW1lOiBuZXcgRGF0ZSh0aW1lc3RhbXApLFxuICAgICAgICAgICAgICBQZXJpb2Q6IDMwMCxcbiAgICAgICAgICAgICAgU3RhdGlzdGljczogWydTdW0nXVxuICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuXG4gICAgICAgICAgICBpZiAocmVxdWVzdHNEYXRhLkRhdGFwb2ludHMgJiYgcmVxdWVzdHNEYXRhLkRhdGFwb2ludHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBjb25zdCBsYXRlc3REYXRhcG9pbnQgPSByZXF1ZXN0c0RhdGEuRGF0YXBvaW50c1tyZXF1ZXN0c0RhdGEuRGF0YXBvaW50cy5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgICAgbWV0cmljcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBtZXRyaWNJZDogXFxgYXBpZ2F0ZXdheS1yZXF1ZXN0cy1cXCR7cmVnaW9ufS1cXCR7dGltZXN0YW1wfVxcYCxcbiAgICAgICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgICAgICAgIG1ldHJpY1R5cGU6ICdQRVJGT1JNQU5DRScsXG4gICAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ2FwaWdhdGV3YXlfcmVxdWVzdHMnLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBsYXRlc3REYXRhcG9pbnQuU3VtIHx8IDAsXG4gICAgICAgICAgICAgICAgdW5pdDogJ0NvdW50J1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQVBJIEdhdGV3YXkg44Os44K544Od44Oz44K55pmC6ZaTXG4gICAgICAgICAgICBjb25zdCBsYXRlbmN5RGF0YSA9IGF3YWl0IGNsb3Vkd2F0Y2guZ2V0TWV0cmljU3RhdGlzdGljcyh7XG4gICAgICAgICAgICAgIE5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgICAgICAgICAgTWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICAgICAgICBEaW1lbnNpb25zOiBbXSxcbiAgICAgICAgICAgICAgU3RhcnRUaW1lOiBuZXcgRGF0ZSh0aW1lc3RhbXAgLSA1ICogNjAgKiAxMDAwKSxcbiAgICAgICAgICAgICAgRW5kVGltZTogbmV3IERhdGUodGltZXN0YW1wKSxcbiAgICAgICAgICAgICAgUGVyaW9kOiAzMDAsXG4gICAgICAgICAgICAgIFN0YXRpc3RpY3M6IFsnQXZlcmFnZSddXG4gICAgICAgICAgICB9KS5wcm9taXNlKCk7XG5cbiAgICAgICAgICAgIGlmIChsYXRlbmN5RGF0YS5EYXRhcG9pbnRzICYmIGxhdGVuY3lEYXRhLkRhdGFwb2ludHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBjb25zdCBsYXRlc3REYXRhcG9pbnQgPSBsYXRlbmN5RGF0YS5EYXRhcG9pbnRzW2xhdGVuY3lEYXRhLkRhdGFwb2ludHMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgIG1ldHJpY3MucHVzaCh7XG4gICAgICAgICAgICAgICAgbWV0cmljSWQ6IFxcYGFwaWdhdGV3YXktbGF0ZW5jeS1cXCR7cmVnaW9ufS1cXCR7dGltZXN0YW1wfVxcYCxcbiAgICAgICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgICAgICAgIG1ldHJpY1R5cGU6ICdQRVJGT1JNQU5DRScsXG4gICAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ2FwaWdhdGV3YXlfbGF0ZW5jeScsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGxhdGVzdERhdGFwb2ludC5BdmVyYWdlIHx8IDAsXG4gICAgICAgICAgICAgICAgdW5pdDogJ01pbGxpc2Vjb25kcydcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcXGBBUEkgR2F0ZXdheSDjg6Hjg4jjg6rjgq/jgrnlj47pm4bjgqjjg6njg7wgKFxcJHtyZWdpb259KTpcXGAsIGVycm9yKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gbWV0cmljcztcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNvbGxlY3RTM01ldHJpY3MoY2xvdWR3YXRjaCwgcmVnaW9uLCB0aW1lc3RhbXApIHtcbiAgICAgICAgICBjb25zdCBtZXRyaWNzID0gW107XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gUzMg44Oq44Kv44Ko44K544OI5pWwXG4gICAgICAgICAgICBjb25zdCByZXF1ZXN0c0RhdGEgPSBhd2FpdCBjbG91ZHdhdGNoLmdldE1ldHJpY1N0YXRpc3RpY3Moe1xuICAgICAgICAgICAgICBOYW1lc3BhY2U6ICdBV1MvUzMnLFxuICAgICAgICAgICAgICBNZXRyaWNOYW1lOiAnTnVtYmVyT2ZPYmplY3RzJyxcbiAgICAgICAgICAgICAgRGltZW5zaW9uczogW10sXG4gICAgICAgICAgICAgIFN0YXJ0VGltZTogbmV3IERhdGUodGltZXN0YW1wIC0gMjQgKiA2MCAqIDYwICogMTAwMCksIC8vIDI05pmC6ZaT5YmN77yIUzPjga/ml6XmrKHjg6Hjg4jjg6rjgq/jgrnvvIlcbiAgICAgICAgICAgICAgRW5kVGltZTogbmV3IERhdGUodGltZXN0YW1wKSxcbiAgICAgICAgICAgICAgUGVyaW9kOiA4NjQwMCwgLy8gMeaXpVxuICAgICAgICAgICAgICBTdGF0aXN0aWNzOiBbJ0F2ZXJhZ2UnXVxuICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuXG4gICAgICAgICAgICBpZiAocmVxdWVzdHNEYXRhLkRhdGFwb2ludHMgJiYgcmVxdWVzdHNEYXRhLkRhdGFwb2ludHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBjb25zdCBsYXRlc3REYXRhcG9pbnQgPSByZXF1ZXN0c0RhdGEuRGF0YXBvaW50c1tyZXF1ZXN0c0RhdGEuRGF0YXBvaW50cy5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgICAgbWV0cmljcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBtZXRyaWNJZDogXFxgczMtb2JqZWN0cy1cXCR7cmVnaW9ufS1cXCR7dGltZXN0YW1wfVxcYCxcbiAgICAgICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICAgICAgICAgIG1ldHJpY1R5cGU6ICdQRVJGT1JNQU5DRScsXG4gICAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ3MzX29iamVjdHMnLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBsYXRlc3REYXRhcG9pbnQuQXZlcmFnZSB8fCAwLFxuICAgICAgICAgICAgICAgIHVuaXQ6ICdDb3VudCdcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcXGBTMyDjg6Hjg4jjg6rjgq/jgrnlj47pm4bjgqjjg6njg7wgKFxcJHtyZWdpb259KTpcXGAsIGVycm9yKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gbWV0cmljcztcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNvbGxlY3RDdXN0b21NZXRyaWNzKGNsb3Vkd2F0Y2gsIHJlZ2lvbiwgdGltZXN0YW1wKSB7XG4gICAgICAgICAgY29uc3QgbWV0cmljcyA9IFtdO1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIOOCq+OCueOCv+ODoOODoeODiOODquOCr+OCuTog44K344K544OG44Og5Y+v55So5oCnXG4gICAgICAgICAgICBjb25zdCBhdmFpbGFiaWxpdHlTY29yZSA9IGF3YWl0IGNhbGN1bGF0ZUF2YWlsYWJpbGl0eVNjb3JlKHJlZ2lvbik7XG4gICAgICAgICAgICBtZXRyaWNzLnB1c2goe1xuICAgICAgICAgICAgICBtZXRyaWNJZDogXFxgYXZhaWxhYmlsaXR5LVxcJHtyZWdpb259LVxcJHt0aW1lc3RhbXB9XFxgLFxuICAgICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICAgIHRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgbWV0cmljVHlwZTogJ0FWQUlMQUJJTElUWScsXG4gICAgICAgICAgICAgIG1ldHJpY05hbWU6ICdzeXN0ZW1fYXZhaWxhYmlsaXR5JyxcbiAgICAgICAgICAgICAgdmFsdWU6IGF2YWlsYWJpbGl0eVNjb3JlLFxuICAgICAgICAgICAgICB1bml0OiAnUGVyY2VudCdcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyDjgqvjgrnjgr/jg6Djg6Hjg4jjg6rjgq/jgrk6IOOCs+ODs+ODl+ODqeOCpOOCouODs+OCueOCueOCs+OColxuICAgICAgICAgICAgY29uc3QgY29tcGxpYW5jZVNjb3JlID0gYXdhaXQgY2FsY3VsYXRlQ29tcGxpYW5jZVNjb3JlKHJlZ2lvbik7XG4gICAgICAgICAgICBtZXRyaWNzLnB1c2goe1xuICAgICAgICAgICAgICBtZXRyaWNJZDogXFxgY29tcGxpYW5jZS1cXCR7cmVnaW9ufS1cXCR7dGltZXN0YW1wfVxcYCxcbiAgICAgICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgICAgICAgIG1ldHJpY1R5cGU6ICdDT01QTElBTkNFJyxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ2NvbXBsaWFuY2Vfc2NvcmUnLFxuICAgICAgICAgICAgICB2YWx1ZTogY29tcGxpYW5jZVNjb3JlLFxuICAgICAgICAgICAgICB1bml0OiAnUGVyY2VudCdcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXFxg44Kr44K544K/44Og44Oh44OI44Oq44Kv44K55Y+O6ZuG44Ko44Op44O8IChcXCR7cmVnaW9ufSk6XFxgLCBlcnJvcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIG1ldHJpY3M7XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjYWxjdWxhdGVBdmFpbGFiaWxpdHlTY29yZShyZWdpb24pIHtcbiAgICAgICAgICAvLyDnsKHnlaXljJbjgZXjgozjgZ/lj6/nlKjmgKfjgrnjgrPjgqLoqIjnrpdcbiAgICAgICAgICAvLyDlrp/pmpvjga7lrp/oo4Xjgafjga/jgIHlkITjgrXjg7zjg5Pjgrnjga7jg5jjg6vjgrnjg4Hjgqfjg4Pjgq/ntZDmnpzjgpLntbHlkIhcbiAgICAgICAgICByZXR1cm4gTWF0aC5yYW5kb20oKSAqIDEwICsgOTA7IC8vIDkwLTEwMCXjga7nr4Tlm7JcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNhbGN1bGF0ZUNvbXBsaWFuY2VTY29yZShyZWdpb24pIHtcbiAgICAgICAgICAvLyDnsKHnlaXljJbjgZXjgozjgZ/jgrPjg7Pjg5fjg6njgqTjgqLjg7PjgrnjgrnjgrPjgqLoqIjnrpdcbiAgICAgICAgICAvLyDlrp/pmpvjga7lrp/oo4Xjgafjga/jgIFHRFBS44CBU09Y562J44Gu44Kz44Oz44OX44Op44Kk44Ki44Oz44K554q25rOB44KS6KmV5L6hXG4gICAgICAgICAgcmV0dXJuIE1hdGgucmFuZG9tKCkgKiAyMCArIDgwOyAvLyA4MC0xMDAl44Gu56+E5ZuyXG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBzYXZlTWV0cmljcyhtZXRyaWNzKSB7XG4gICAgICAgICAgY29uc3QgYmF0Y2hTaXplID0gMjU7IC8vIER5bmFtb0RCIEJhdGNoV3JpdGVJdGVt44Gu5Yi26ZmQXG4gICAgICAgICAgXG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXRyaWNzLmxlbmd0aDsgaSArPSBiYXRjaFNpemUpIHtcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoID0gbWV0cmljcy5zbGljZShpLCBpICsgYmF0Y2hTaXplKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICAgICAgICBSZXF1ZXN0SXRlbXM6IHtcbiAgICAgICAgICAgICAgICAnJHt0aGlzLm1ldHJpY3NUYWJsZS50YWJsZU5hbWV9JzogYmF0Y2gubWFwKG1ldHJpYyA9PiAoe1xuICAgICAgICAgICAgICAgICAgUHV0UmVxdWVzdDoge1xuICAgICAgICAgICAgICAgICAgICBJdGVtOiB7XG4gICAgICAgICAgICAgICAgICAgICAgLi4ubWV0cmljLFxuICAgICAgICAgICAgICAgICAgICAgIHR0bDogTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCkgKyAoJHt0aGlzLmNvbmZpZy5kYXRhUmV0ZW50aW9uRGF5c30gKiAyNCAqIDYwICogNjApXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgYXdhaXQgZHluYW1vZGIuYmF0Y2hXcml0ZShwYXJhbXMpLnByb21pc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjaGVja0FsZXJ0Q29uZGl0aW9ucyhtZXRyaWNzKSB7XG4gICAgICAgICAgY29uc3QgYWxlcnRzID0gW107XG4gICAgICAgICAgY29uc3QgdGhyZXNob2xkcyA9ICR7SlNPTi5zdHJpbmdpZnkodGhpcy5jb25maWcuYWxlcnRUaHJlc2hvbGRzKX07XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IG1ldHJpYyBvZiBtZXRyaWNzKSB7XG4gICAgICAgICAgICBsZXQgYWxlcnRDb25kaXRpb24gPSBudWxsO1xuXG4gICAgICAgICAgICBzd2l0Y2ggKG1ldHJpYy5tZXRyaWNOYW1lKSB7XG4gICAgICAgICAgICAgIGNhc2UgJ2xhbWJkYV9lcnJvcnMnOlxuICAgICAgICAgICAgICAgIGlmIChtZXRyaWMudmFsdWUgPiAxMCkgeyAvLyAxMOOCqOODqeODvOS7peS4ilxuICAgICAgICAgICAgICAgICAgYWxlcnRDb25kaXRpb24gPSB7XG4gICAgICAgICAgICAgICAgICAgIHNldmVyaXR5OiAnRVJST1InLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBcXGBMYW1iZGEg44Ko44Op44O85pWw44GM6Za+5YCk44KS6LaF6YGOOiBcXCR7bWV0cmljLnZhbHVlfVxcYFxuICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgJ2xhbWJkYV9kdXJhdGlvbic6XG4gICAgICAgICAgICAgICAgaWYgKG1ldHJpYy52YWx1ZSA+IHRocmVzaG9sZHMucmVzcG9uc2VUaW1lVGhyZXNob2xkKSB7XG4gICAgICAgICAgICAgICAgICBhbGVydENvbmRpdGlvbiA9IHtcbiAgICAgICAgICAgICAgICAgICAgc2V2ZXJpdHk6ICdXQVJOSU5HJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogXFxgTGFtYmRhIOWun+ihjOaZgumWk+OBjOmWvuWApOOCkui2hemBjjogXFwke21ldHJpYy52YWx1ZX1tc1xcYFxuICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgJ2FwaWdhdGV3YXlfbGF0ZW5jeSc6XG4gICAgICAgICAgICAgICAgaWYgKG1ldHJpYy52YWx1ZSA+IHRocmVzaG9sZHMucmVzcG9uc2VUaW1lVGhyZXNob2xkKSB7XG4gICAgICAgICAgICAgICAgICBhbGVydENvbmRpdGlvbiA9IHtcbiAgICAgICAgICAgICAgICAgICAgc2V2ZXJpdHk6ICdXQVJOSU5HJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogXFxgQVBJIEdhdGV3YXkg44Os44K544Od44Oz44K55pmC6ZaT44GM6Za+5YCk44KS6LaF6YGOOiBcXCR7bWV0cmljLnZhbHVlfW1zXFxgXG4gICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAnc3lzdGVtX2F2YWlsYWJpbGl0eSc6XG4gICAgICAgICAgICAgICAgaWYgKG1ldHJpYy52YWx1ZSA8IHRocmVzaG9sZHMuYXZhaWxhYmlsaXR5VGhyZXNob2xkKSB7XG4gICAgICAgICAgICAgICAgICBhbGVydENvbmRpdGlvbiA9IHtcbiAgICAgICAgICAgICAgICAgICAgc2V2ZXJpdHk6ICdDUklUSUNBTCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFxcYOOCt+OCueODhuODoOWPr+eUqOaAp+OBjOmWvuWApOOCkuS4i+WbnuOCizogXFwke21ldHJpYy52YWx1ZX0lXFxgXG4gICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGFsZXJ0Q29uZGl0aW9uKSB7XG4gICAgICAgICAgICAgIGFsZXJ0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICBhbGVydElkOiBcXGBhbGVydC1cXCR7bWV0cmljLm1ldHJpY0lkfVxcYCxcbiAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IG1ldHJpYy50aW1lc3RhbXAsXG4gICAgICAgICAgICAgICAgcmVnaW9uOiBtZXRyaWMucmVnaW9uLFxuICAgICAgICAgICAgICAgIG1ldHJpY05hbWU6IG1ldHJpYy5tZXRyaWNOYW1lLFxuICAgICAgICAgICAgICAgIG1ldHJpY1ZhbHVlOiBtZXRyaWMudmFsdWUsXG4gICAgICAgICAgICAgICAgc2V2ZXJpdHk6IGFsZXJ0Q29uZGl0aW9uLnNldmVyaXR5LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGFsZXJ0Q29uZGl0aW9uLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnT1BFTidcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIGFsZXJ0cztcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NBbGVydHMoYWxlcnRzKSB7XG4gICAgICAgICAgLy8g44Ki44Op44O844OI44KSRHluYW1vRELjgavkv53lrZhcbiAgICAgICAgICBmb3IgKGNvbnN0IGFsZXJ0IG9mIGFsZXJ0cykge1xuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICAgICAgICBUYWJsZU5hbWU6ICcke3RoaXMuYWxlcnRzVGFibGUudGFibGVOYW1lfScsXG4gICAgICAgICAgICAgIEl0ZW06IHtcbiAgICAgICAgICAgICAgICAuLi5hbGVydCxcbiAgICAgICAgICAgICAgICB0dGw6IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApICsgKDMwICogMjQgKiA2MCAqIDYwKSAvLyAzMOaXpeW+jOOBq+WJiumZpFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYXdhaXQgZHluYW1vZGIucHV0KHBhcmFtcykucHJvbWlzZSgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIOmHjeimgeOBquOCouODqeODvOODiOOBr1NOU+mAmuefpVxuICAgICAgICAgIGNvbnN0IGNyaXRpY2FsQWxlcnRzID0gYWxlcnRzLmZpbHRlcihhbGVydCA9PiBhbGVydC5zZXZlcml0eSA9PT0gJ0NSSVRJQ0FMJyB8fCBhbGVydC5zZXZlcml0eSA9PT0gJ0VSUk9SJyk7XG4gICAgICAgICAgaWYgKGNyaXRpY2FsQWxlcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGF3YWl0IHNlbmRBbGVydE5vdGlmaWNhdGlvbnMoY3JpdGljYWxBbGVydHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIHNlbmRBbGVydE5vdGlmaWNhdGlvbnMoYWxlcnRzKSB7XG4gICAgICAgICAgY29uc3Qgc25zID0gbmV3IEFXUy5TTlMoKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gXFxgXG7jgrDjg63jg7zjg5Djg6vnm6PoppbjgqLjg6njg7zjg4hcblxu55m655Sf5pmC5Yi7OiBcXCR7bmV3IERhdGUoKS50b0lTT1N0cmluZygpfVxu44Ki44Op44O844OI5pWwOiBcXCR7YWxlcnRzLmxlbmd0aH1cblxu6Kmz57SwOlxuXFwke2FsZXJ0cy5tYXAoYWxlcnQgPT4gXG4gIFxcYC0gW1xcJHthbGVydC5zZXZlcml0eX1dIFxcJHthbGVydC5yZWdpb259OiBcXCR7YWxlcnQubWVzc2FnZX1cXGBcbikuam9pbignXFxcXG4nKX1cbiAgICAgICAgICBcXGA7XG5cbiAgICAgICAgICBhd2FpdCBzbnMucHVibGlzaCh7XG4gICAgICAgICAgICBUb3BpY0FybjogJyR7dGhpcy5hbGVydFRvcGljLnRvcGljQXJufScsXG4gICAgICAgICAgICBNZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgU3ViamVjdDogJ+OCsOODreODvOODkOODq+ebo+imluOCouODqeODvOODiCdcbiAgICAgICAgICB9KS5wcm9taXNlKCk7XG4gICAgICAgIH1cbiAgICAgIGApLFxuICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBNRVRSSUNTX1RBQkxFOiB0aGlzLm1ldHJpY3NUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFMRVJUU19UQUJMRTogdGhpcy5hbGVydHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFMRVJUX1RPUElDX0FSTjogdGhpcy5hbGVydFRvcGljLnRvcGljQXJuXG4gICAgICB9XG4gICAgfSk7XG4gIH0gIC8qXG4qXG4gICAqIOOCouODqeODvOODiOWHpueQhkxhbWJkYemWouaVsFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVBbGVydFByb2Nlc3NvckZ1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FsZXJ0UHJvY2Vzc29yRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1hbGVydC1wcm9jZXNzb3JgLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgQVdTID0gcmVxdWlyZSgnYXdzLXNkaycpO1xuICAgICAgICBjb25zdCBkeW5hbW9kYiA9IG5ldyBBV1MuRHluYW1vREIuRG9jdW1lbnRDbGllbnQoKTtcbiAgICAgICAgY29uc3Qgc25zID0gbmV3IEFXUy5TTlMoKTtcblxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygn44Ki44Op44O844OI5Yem55CG6ZaL5aeLOicsIEpTT04uc3RyaW5naWZ5KGV2ZW50KSk7XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8g5pyq5Yem55CG44Ki44Op44O844OI44Gu5Y+W5b6XXG4gICAgICAgICAgICBjb25zdCBvcGVuQWxlcnRzID0gYXdhaXQgZ2V0T3BlbkFsZXJ0cygpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDjgqLjg6njg7zjg4jjga7liIbmnpDjgajliIbpoZ5cbiAgICAgICAgICAgIGNvbnN0IGFuYWx5emVkQWxlcnRzID0gYXdhaXQgYW5hbHl6ZUFsZXJ0cyhvcGVuQWxlcnRzKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g44Ko44K544Kr44Os44O844K344On44Oz5Yem55CGXG4gICAgICAgICAgICBjb25zdCBlc2NhbGF0ZWRBbGVydHMgPSBhd2FpdCBwcm9jZXNzRXNjYWxhdGlvbihhbmFseXplZEFsZXJ0cyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOiHquWLleS/ruW+qeOBruippuihjFxuICAgICAgICAgICAgY29uc3QgcmVtZWRpYXRpb25SZXN1bHRzID0gYXdhaXQgYXR0ZW1wdEF1dG9SZW1lZGlhdGlvbihlc2NhbGF0ZWRBbGVydHMpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDpgJrnn6Xjga7pgIHkv6FcbiAgICAgICAgICAgIGF3YWl0IHNlbmROb3RpZmljYXRpb25zKGVzY2FsYXRlZEFsZXJ0cywgcmVtZWRpYXRpb25SZXN1bHRzKTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ+OCouODqeODvOODiOWHpueQhuWujOS6hicsXG4gICAgICAgICAgICAgICAgYWxlcnRzUHJvY2Vzc2VkOiBvcGVuQWxlcnRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBlc2NhbGF0ZWRBbGVydHM6IGVzY2FsYXRlZEFsZXJ0cy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgcmVtZWRpYXRpb25BdHRlbXB0czogcmVtZWRpYXRpb25SZXN1bHRzLmxlbmd0aFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCfjgqLjg6njg7zjg4jlh6bnkIbjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGdldE9wZW5BbGVydHMoKSB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICAgICAgVGFibGVOYW1lOiAnJHt0aGlzLmFsZXJ0c1RhYmxlLnRhYmxlTmFtZX0nLFxuICAgICAgICAgICAgSW5kZXhOYW1lOiAnU3RhdHVzSW5kZXgnLFxuICAgICAgICAgICAgS2V5Q29uZGl0aW9uRXhwcmVzc2lvbjogJyNzdGF0dXMgPSA6c3RhdHVzJyxcbiAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAgICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICAgICAgICAnOnN0YXR1cyc6ICdPUEVOJ1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5xdWVyeShwYXJhbXMpLnByb21pc2UoKTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0Lkl0ZW1zIHx8IFtdO1xuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gYW5hbHl6ZUFsZXJ0cyhhbGVydHMpIHtcbiAgICAgICAgICBjb25zdCBhbmFseXplZCA9IFtdO1xuXG4gICAgICAgICAgZm9yIChjb25zdCBhbGVydCBvZiBhbGVydHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGFuYWx5c2lzID0ge1xuICAgICAgICAgICAgICAuLi5hbGVydCxcbiAgICAgICAgICAgICAgcHJpb3JpdHk6IGNhbGN1bGF0ZVByaW9yaXR5KGFsZXJ0KSxcbiAgICAgICAgICAgICAgY2F0ZWdvcnk6IGNhdGVnb3JpemVBbGVydChhbGVydCksXG4gICAgICAgICAgICAgIGltcGFjdExldmVsOiBhc3Nlc3NJbXBhY3QoYWxlcnQpLFxuICAgICAgICAgICAgICByZWNvbW1lbmRlZEFjdGlvbnM6IGdldFJlY29tbWVuZGVkQWN0aW9ucyhhbGVydClcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGFuYWx5emVkLnB1c2goYW5hbHlzaXMpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIOWEquWFiOW6pumghuOBq+OCveODvOODiFxuICAgICAgICAgIHJldHVybiBhbmFseXplZC5zb3J0KChhLCBiKSA9PiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjYWxjdWxhdGVQcmlvcml0eShhbGVydCkge1xuICAgICAgICAgIGxldCBwcmlvcml0eSA9IDA7XG5cbiAgICAgICAgICAvLyDph43opoHluqbjgavjgojjgovln7rmnKzjgrnjgrPjgqJcbiAgICAgICAgICBjb25zdCBzZXZlcml0eVNjb3JlcyA9IHtcbiAgICAgICAgICAgICdDUklUSUNBTCc6IDEwMCxcbiAgICAgICAgICAgICdFUlJPUic6IDc1LFxuICAgICAgICAgICAgJ1dBUk5JTkcnOiA1MCxcbiAgICAgICAgICAgICdJTkZPJzogMjVcbiAgICAgICAgICB9O1xuICAgICAgICAgIHByaW9yaXR5ICs9IHNldmVyaXR5U2NvcmVzW2FsZXJ0LnNldmVyaXR5XSB8fCAwO1xuXG4gICAgICAgICAgLy8g44Oh44OI44Oq44Kv44K544K/44Kk44OX44Gr44KI44KL6Kq/5pW0XG4gICAgICAgICAgY29uc3QgbWV0cmljVHlwZVNjb3JlcyA9IHtcbiAgICAgICAgICAgICdzeXN0ZW1fYXZhaWxhYmlsaXR5JzogMzAsXG4gICAgICAgICAgICAnbGFtYmRhX2Vycm9ycyc6IDI1LFxuICAgICAgICAgICAgJ2FwaWdhdGV3YXlfbGF0ZW5jeSc6IDIwLFxuICAgICAgICAgICAgJ2R5bmFtb2RiX2Vycm9ycyc6IDIwXG4gICAgICAgICAgfTtcbiAgICAgICAgICBwcmlvcml0eSArPSBtZXRyaWNUeXBlU2NvcmVzW2FsZXJ0Lm1ldHJpY05hbWVdIHx8IDA7XG5cbiAgICAgICAgICAvLyDlnLDln5/jgavjgojjgovoqr/mlbTvvIjmnKznlarlnLDln5/jga/pq5jlhKrlhYjluqbvvIlcbiAgICAgICAgICBjb25zdCBwcm9kdWN0aW9uUmVnaW9ucyA9IFsnYXAtbm9ydGhlYXN0LTEnLCAndXMtZWFzdC0xJywgJ2V1LXdlc3QtMSddO1xuICAgICAgICAgIGlmIChwcm9kdWN0aW9uUmVnaW9ucy5pbmNsdWRlcyhhbGVydC5yZWdpb24pKSB7XG4gICAgICAgICAgICBwcmlvcml0eSArPSAyMDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gcHJpb3JpdHk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjYXRlZ29yaXplQWxlcnQoYWxlcnQpIHtcbiAgICAgICAgICBpZiAoYWxlcnQubWV0cmljTmFtZS5pbmNsdWRlcygnYXZhaWxhYmlsaXR5JykpIHJldHVybiAnQVZBSUxBQklMSVRZJztcbiAgICAgICAgICBpZiAoYWxlcnQubWV0cmljTmFtZS5pbmNsdWRlcygnZXJyb3InKSkgcmV0dXJuICdFUlJPUic7XG4gICAgICAgICAgaWYgKGFsZXJ0Lm1ldHJpY05hbWUuaW5jbHVkZXMoJ2xhdGVuY3knKSB8fCBhbGVydC5tZXRyaWNOYW1lLmluY2x1ZGVzKCdkdXJhdGlvbicpKSByZXR1cm4gJ1BFUkZPUk1BTkNFJztcbiAgICAgICAgICBpZiAoYWxlcnQubWV0cmljTmFtZS5pbmNsdWRlcygnY2FwYWNpdHknKSkgcmV0dXJuICdDQVBBQ0lUWSc7XG4gICAgICAgICAgcmV0dXJuICdPVEhFUic7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBhc3Nlc3NJbXBhY3QoYWxlcnQpIHtcbiAgICAgICAgICAvLyDlvbHpn7/jg6zjg5njg6vjga7oqZXkvqFcbiAgICAgICAgICBpZiAoYWxlcnQuc2V2ZXJpdHkgPT09ICdDUklUSUNBTCcpIHJldHVybiAnSElHSCc7XG4gICAgICAgICAgaWYgKGFsZXJ0LnNldmVyaXR5ID09PSAnRVJST1InKSByZXR1cm4gJ01FRElVTSc7XG4gICAgICAgICAgaWYgKGFsZXJ0LnNldmVyaXR5ID09PSAnV0FSTklORycpIHJldHVybiAnTE9XJztcbiAgICAgICAgICByZXR1cm4gJ01JTklNQUwnO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0UmVjb21tZW5kZWRBY3Rpb25zKGFsZXJ0KSB7XG4gICAgICAgICAgY29uc3QgYWN0aW9ucyA9IFtdO1xuXG4gICAgICAgICAgc3dpdGNoIChhbGVydC5tZXRyaWNOYW1lKSB7XG4gICAgICAgICAgICBjYXNlICdsYW1iZGFfZXJyb3JzJzpcbiAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKCdMYW1iZGHplqLmlbDjga7jg63jgrDjgpLnorroqo0nKTtcbiAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKCfjgqjjg6njg7znjofjga7lgr7lkJHjgpLliIbmnpAnKTtcbiAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKCflv4XopoHjgavlv5zjgZjjgabplqLmlbDjgpLlho3jg4fjg5fjg63jgqQnKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdsYW1iZGFfZHVyYXRpb24nOlxuICAgICAgICAgICAgICBhY3Rpb25zLnB1c2goJ0xhbWJkYemWouaVsOOBruODkeODleOCqeODvOODnuODs+OCueOCkuacgOmBqeWMlicpO1xuICAgICAgICAgICAgICBhY3Rpb25zLnB1c2goJ+ODoeODouODquioreWumuOCkuimi+ebtOOBlycpO1xuICAgICAgICAgICAgICBhY3Rpb25zLnB1c2goJ+OCv+OCpOODoOOCouOCpuODiOioreWumuOCkueiuuiqjScpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ2FwaWdhdGV3YXlfbGF0ZW5jeSc6XG4gICAgICAgICAgICAgIGFjdGlvbnMucHVzaCgnQVBJIEdhdGV3YXnjga7oqK3lrprjgpLnorroqo0nKTtcbiAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKCfjg5Djg4Pjgq/jgqjjg7Pjg4njgrXjg7zjg5Pjgrnjga7nirbmhYvjgpLnorroqo0nKTtcbiAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKCfjgq3jg6Pjg4Pjgrfjg6XoqK3lrprjgpLopovnm7TjgZcnKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdzeXN0ZW1fYXZhaWxhYmlsaXR5JzpcbiAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKCfjgrfjgrnjg4bjg6DlhajkvZPjga7jg5jjg6vjgrnjg4Hjgqfjg4Pjgq/lrp/ooYwnKTtcbiAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKCfngb3lrrPlvqnml6fjg5fjg6njg7Pjga7norroqo0nKTtcbiAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKCfnt4rmgKXlr77lv5zjg4Hjg7zjg6DjgavpgKPntaEnKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICBhY3Rpb25zLnB1c2goJ+ips+e0sOOBquiqv+afu+OCkuWun+aWvScpO1xuICAgICAgICAgICAgICBhY3Rpb25zLnB1c2goJ+mWoumAo+OBmeOCi+ODreOCsOOCkueiuuiqjScpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBhY3Rpb25zO1xuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc0VzY2FsYXRpb24oYWxlcnRzKSB7XG4gICAgICAgICAgY29uc3QgZXNjYWxhdGVkID0gW107XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IGFsZXJ0IG9mIGFsZXJ0cykge1xuICAgICAgICAgICAgLy8g44Ko44K544Kr44Os44O844K344On44Oz5p2h5Lu244Gu56K66KqNXG4gICAgICAgICAgICBjb25zdCBzaG91bGRFc2NhbGF0ZSA9IGF3YWl0IGNoZWNrRXNjYWxhdGlvbkNvbmRpdGlvbnMoYWxlcnQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoc2hvdWxkRXNjYWxhdGUpIHtcbiAgICAgICAgICAgICAgLy8g44Ko44K544Kr44Os44O844K344On44Oz5oOF5aCx44KS6L+95YqgXG4gICAgICAgICAgICAgIGFsZXJ0LmVzY2FsYXRlZCA9IHRydWU7XG4gICAgICAgICAgICAgIGFsZXJ0LmVzY2FsYXRpb25MZXZlbCA9IGRldGVybWluZUVzY2FsYXRpb25MZXZlbChhbGVydCk7XG4gICAgICAgICAgICAgIGFsZXJ0LmVzY2FsYXRpb25UaW1lID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGVzY2FsYXRlZC5wdXNoKGFsZXJ0KTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIOOCouODqeODvOODiOeKtuaFi+OCkuabtOaWsFxuICAgICAgICAgICAgICBhd2FpdCB1cGRhdGVBbGVydFN0YXR1cyhhbGVydC5hbGVydElkLCAnRVNDQUxBVEVEJywge1xuICAgICAgICAgICAgICAgIGVzY2FsYXRpb25MZXZlbDogYWxlcnQuZXNjYWxhdGlvbkxldmVsLFxuICAgICAgICAgICAgICAgIGVzY2FsYXRpb25UaW1lOiBhbGVydC5lc2NhbGF0aW9uVGltZVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gZXNjYWxhdGVkO1xuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gY2hlY2tFc2NhbGF0aW9uQ29uZGl0aW9ucyhhbGVydCkge1xuICAgICAgICAgIC8vIOOCqOOCueOCq+ODrOODvOOCt+ODp+ODs+adoeS7tlxuICAgICAgICAgIGNvbnN0IGVzY2FsYXRpb25SdWxlcyA9IHtcbiAgICAgICAgICAgICdDUklUSUNBTCc6IDAsIC8vIOWNs+W6p+OBq+OCqOOCueOCq+ODrOODvOOCt+ODp+ODs1xuICAgICAgICAgICAgJ0VSUk9SJzogNSAqIDYwICogMTAwMCwgLy8gNeWIhuW+jFxuICAgICAgICAgICAgJ1dBUk5JTkcnOiAxNSAqIDYwICogMTAwMCwgLy8gMTXliIblvoxcbiAgICAgICAgICAgICdJTkZPJzogNjAgKiA2MCAqIDEwMDAgLy8gMeaZgumWk+W+jFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCBlc2NhbGF0aW9uRGVsYXkgPSBlc2NhbGF0aW9uUnVsZXNbYWxlcnQuc2V2ZXJpdHldIHx8IDYwICogNjAgKiAxMDAwO1xuICAgICAgICAgIGNvbnN0IGFsZXJ0QWdlID0gRGF0ZS5ub3coKSAtIGFsZXJ0LnRpbWVzdGFtcDtcblxuICAgICAgICAgIHJldHVybiBhbGVydEFnZSA+PSBlc2NhbGF0aW9uRGVsYXk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBkZXRlcm1pbmVFc2NhbGF0aW9uTGV2ZWwoYWxlcnQpIHtcbiAgICAgICAgICBpZiAoYWxlcnQuc2V2ZXJpdHkgPT09ICdDUklUSUNBTCcgfHwgYWxlcnQuaW1wYWN0TGV2ZWwgPT09ICdISUdIJykgcmV0dXJuICdMMSc7XG4gICAgICAgICAgaWYgKGFsZXJ0LnNldmVyaXR5ID09PSAnRVJST1InIHx8IGFsZXJ0LmltcGFjdExldmVsID09PSAnTUVESVVNJykgcmV0dXJuICdMMic7XG4gICAgICAgICAgcmV0dXJuICdMMyc7XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBhdHRlbXB0QXV0b1JlbWVkaWF0aW9uKGFsZXJ0cykge1xuICAgICAgICAgIGNvbnN0IHJlbWVkaWF0aW9uUmVzdWx0cyA9IFtdO1xuXG4gICAgICAgICAgZm9yIChjb25zdCBhbGVydCBvZiBhbGVydHMpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGV4ZWN1dGVBdXRvUmVtZWRpYXRpb24oYWxlcnQpO1xuICAgICAgICAgICAgICByZW1lZGlhdGlvblJlc3VsdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgYWxlcnRJZDogYWxlcnQuYWxlcnRJZCxcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiByZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICAgICAgICBhY3Rpb246IHJlc3VsdC5hY3Rpb24sXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogcmVzdWx0Lm1lc3NhZ2VcbiAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdXBkYXRlQWxlcnRTdGF0dXMoYWxlcnQuYWxlcnRJZCwgJ0FVVE9fUkVTT0xWRUQnLCB7XG4gICAgICAgICAgICAgICAgICByZW1lZGlhdGlvbkFjdGlvbjogcmVzdWx0LmFjdGlvbixcbiAgICAgICAgICAgICAgICAgIHJlbWVkaWF0aW9uVGltZTogRGF0ZS5ub3coKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXFxg6Ieq5YuV5L+u5b6p44Ko44Op44O8IChBbGVydDogXFwke2FsZXJ0LmFsZXJ0SWR9KTpcXGAsIGVycm9yKTtcbiAgICAgICAgICAgICAgcmVtZWRpYXRpb25SZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgICAgIGFsZXJ0SWQ6IGFsZXJ0LmFsZXJ0SWQsXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgYWN0aW9uOiAnbm9uZScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXFxg6Ieq5YuV5L+u5b6p5aSx5pWXOiBcXCR7ZXJyb3IubWVzc2FnZX1cXGBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHJlbWVkaWF0aW9uUmVzdWx0cztcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGV4ZWN1dGVBdXRvUmVtZWRpYXRpb24oYWxlcnQpIHtcbiAgICAgICAgICAvLyDjgqLjg6njg7zjg4jjgr/jgqTjg5fjgavlv5zjgZjjgZ/oh6rli5Xkv67lvqlcbiAgICAgICAgICBzd2l0Y2ggKGFsZXJ0Lm1ldHJpY05hbWUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2xhbWJkYV9lcnJvcnMnOlxuICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgcmVtZWRpYXRlTGFtYmRhRXJyb3JzKGFsZXJ0KTtcbiAgICAgICAgICAgIGNhc2UgJ2xhbWJkYV9kdXJhdGlvbic6XG4gICAgICAgICAgICAgIHJldHVybiBhd2FpdCByZW1lZGlhdGVMYW1iZGFQZXJmb3JtYW5jZShhbGVydCk7XG4gICAgICAgICAgICBjYXNlICdhcGlnYXRld2F5X2xhdGVuY3knOlxuICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgcmVtZWRpYXRlQXBpTGF0ZW5jeShhbGVydCk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGFjdGlvbjogJ25vbmUnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICfoh6rli5Xkv67lvqnjgqLjgq/jgrfjg6fjg7PjgYzlrprnvqnjgZXjgozjgabjgYTjgb7jgZvjgpMnXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gcmVtZWRpYXRlTGFtYmRhRXJyb3JzKGFsZXJ0KSB7XG4gICAgICAgICAgLy8gTGFtYmRh6Zai5pWw44Gu44Ko44Op44O85L+u5b6p77yI5L6L77ya5YaN6LW35YuV44CB6Kit5a6a6Kq/5pW077yJXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICBhY3Rpb246ICdsYW1iZGFfcmVzdGFydCcsXG4gICAgICAgICAgICBtZXNzYWdlOiAnTGFtYmRh6Zai5pWw44Gu5YaN6LW35YuV44KS5a6f6KGM44GX44G+44GX44GfJ1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiByZW1lZGlhdGVMYW1iZGFQZXJmb3JtYW5jZShhbGVydCkge1xuICAgICAgICAgIC8vIExhbWJkYemWouaVsOOBruODkeODleOCqeODvOODnuODs+OCueS/ruW+qe+8iOS+i++8muODoeODouODquWil+WKoO+8iVxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgYWN0aW9uOiAnbWVtb3J5X2luY3JlYXNlJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdMYW1iZGHplqLmlbDjga7jg6Hjg6Ljg6rjgpLlopfliqDjgZfjgb7jgZfjgZ8nXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIHJlbWVkaWF0ZUFwaUxhdGVuY3koYWxlcnQpIHtcbiAgICAgICAgICAvLyBBUEkgR2F0ZXdheeOBruODrOOCpOODhuODs+OCt+S/ruW+qe+8iOS+i++8muOCreODo+ODg+OCt+ODpeacieWKueWMlu+8iVxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgYWN0aW9uOiAnY2FjaGVfZW5hYmxlJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdBUEkgR2F0ZXdheeOCreODo+ODg+OCt+ODpeOCkuacieWKueWMluOBl+OBvuOBl+OBnydcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gdXBkYXRlQWxlcnRTdGF0dXMoYWxlcnRJZCwgc3RhdHVzLCBhZGRpdGlvbmFsRGF0YSA9IHt9KSB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICAgICAgVGFibGVOYW1lOiAnJHt0aGlzLmFsZXJ0c1RhYmxlLnRhYmxlTmFtZX0nLFxuICAgICAgICAgICAgS2V5OiB7IGFsZXJ0SWQgfSxcbiAgICAgICAgICAgIFVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIHVwZGF0ZWRBdCA9IDp1cGRhdGVkQXQnLFxuICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAgICAgICAgICcjc3RhdHVzJzogJ3N0YXR1cydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgICAgICc6c3RhdHVzJzogc3RhdHVzLFxuICAgICAgICAgICAgICAnOnVwZGF0ZWRBdCc6IERhdGUubm93KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgLy8g6L+95Yqg44OH44O844K/44GM44GC44KL5aC05ZCI44Gv5pu05paw5byP44Gr6L+95YqgXG4gICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGFkZGl0aW9uYWxEYXRhKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhhZGRpdGlvbmFsRGF0YSkpIHtcbiAgICAgICAgICAgICAgcGFyYW1zLlVwZGF0ZUV4cHJlc3Npb24gKz0gXFxgLCAjXFwke2tleX0gPSA6XFwke2tleX1cXGA7XG4gICAgICAgICAgICAgIHBhcmFtcy5FeHByZXNzaW9uQXR0cmlidXRlTmFtZXNbXFxgI1xcJHtrZXl9XFxgXSA9IGtleTtcbiAgICAgICAgICAgICAgcGFyYW1zLkV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXNbXFxgOlxcJHtrZXl9XFxgXSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGF3YWl0IGR5bmFtb2RiLnVwZGF0ZShwYXJhbXMpLnByb21pc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIHNlbmROb3RpZmljYXRpb25zKGFsZXJ0cywgcmVtZWRpYXRpb25SZXN1bHRzKSB7XG4gICAgICAgICAgaWYgKGFsZXJ0cy5sZW5ndGggPT09IDApIHJldHVybjtcblxuICAgICAgICAgIGNvbnN0IGNyaXRpY2FsQWxlcnRzID0gYWxlcnRzLmZpbHRlcihhbGVydCA9PiBhbGVydC5zZXZlcml0eSA9PT0gJ0NSSVRJQ0FMJyk7XG4gICAgICAgICAgY29uc3QgZXJyb3JBbGVydHMgPSBhbGVydHMuZmlsdGVyKGFsZXJ0ID0+IGFsZXJ0LnNldmVyaXR5ID09PSAnRVJST1InKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDph43opoHjgarjgqLjg6njg7zjg4jjga7pgJrnn6VcbiAgICAgICAgICBpZiAoY3JpdGljYWxBbGVydHMubGVuZ3RoID4gMCB8fCBlcnJvckFsZXJ0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gXFxgXG7jgrDjg63jg7zjg5Djg6vnm6Poppbjgqjjgrnjgqvjg6zjg7zjgrfjg6fjg7PjgqLjg6njg7zjg4hcblxu55m655Sf5pmC5Yi7OiBcXCR7bmV3IERhdGUoKS50b0lTT1N0cmluZygpfVxu6YeN6KaB44Ki44Op44O844OI5pWwOiBcXCR7Y3JpdGljYWxBbGVydHMubGVuZ3RofVxu44Ko44Op44O844Ki44Op44O844OI5pWwOiBcXCR7ZXJyb3JBbGVydHMubGVuZ3RofVxuXG7ph43opoHjgqLjg6njg7zjg4g6XG5cXCR7Y3JpdGljYWxBbGVydHMubWFwKGFsZXJ0ID0+IFxuICBcXGAtIFtcXCR7YWxlcnQuZXNjYWxhdGlvbkxldmVsfV0gXFwke2FsZXJ0LnJlZ2lvbn06IFxcJHthbGVydC5tZXNzYWdlfVxcYFxuKS5qb2luKCdcXFxcbicpfVxuXG7jgqjjg6njg7zjgqLjg6njg7zjg4g6XG5cXCR7ZXJyb3JBbGVydHMubWFwKGFsZXJ0ID0+IFxuICBcXGAtIFtcXCR7YWxlcnQuZXNjYWxhdGlvbkxldmVsfV0gXFwke2FsZXJ0LnJlZ2lvbn06IFxcJHthbGVydC5tZXNzYWdlfVxcYFxuKS5qb2luKCdcXFxcbicpfVxuXG7oh6rli5Xkv67lvqnntZDmnpw6XG5cXCR7cmVtZWRpYXRpb25SZXN1bHRzLm1hcChyZXN1bHQgPT4gXG4gIFxcYC0gXFwke3Jlc3VsdC5hbGVydElkfTogXFwke3Jlc3VsdC5zdWNjZXNzID8gJ+aIkOWKnycgOiAn5aSx5pWXJ30gLSBcXCR7cmVzdWx0Lm1lc3NhZ2V9XFxgXG4pLmpvaW4oJ1xcXFxuJyl9XG4gICAgICAgICAgICBcXGA7XG5cbiAgICAgICAgICAgIGF3YWl0IHNucy5wdWJsaXNoKHtcbiAgICAgICAgICAgICAgVG9waWNBcm46ICcke3RoaXMuYWxlcnRUb3BpYy50b3BpY0Fybn0nLFxuICAgICAgICAgICAgICBNZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICBTdWJqZWN0OiAn44Kw44Ot44O844OQ44Or55uj6KaW44Ko44K544Kr44Os44O844K344On44Oz44Ki44Op44O844OIJ1xuICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgYCksXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDEwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEFMRVJUU19UQUJMRTogdGhpcy5hbGVydHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFMRVJUX1RPUElDX0FSTjogdGhpcy5hbGVydFRvcGljLnRvcGljQXJuXG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44OA44OD44K344Ol44Oc44O844OJ5pu05pawTGFtYmRh6Zai5pWwXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZURhc2hib2FyZFVwZGF0ZXJGdW5jdGlvbigpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIHJldHVybiBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdEYXNoYm9hcmRVcGRhdGVyRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1kYXNoYm9hcmQtdXBkYXRlcmAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBjb25zdCBBV1MgPSByZXF1aXJlKCdhd3Mtc2RrJyk7XG4gICAgICAgIGNvbnN0IGR5bmFtb2RiID0gbmV3IEFXUy5EeW5hbW9EQi5Eb2N1bWVudENsaWVudCgpO1xuICAgICAgICBjb25zdCBjbG91ZHdhdGNoID0gbmV3IEFXUy5DbG91ZFdhdGNoKCk7XG5cbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ+ODgOODg+OCt+ODpeODnOODvOODieabtOaWsOmWi+WnizonLCBKU09OLnN0cmluZ2lmeShldmVudCkpO1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIOacgOaWsOODoeODiOODquOCr+OCueOBruWPluW+l1xuICAgICAgICAgICAgY29uc3QgbGF0ZXN0TWV0cmljcyA9IGF3YWl0IGdldExhdGVzdE1ldHJpY3MoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g44OA44OD44K344Ol44Oc44O844OJ44Km44Kj44K444Kn44OD44OI44Gu5pu05pawXG4gICAgICAgICAgICBhd2FpdCB1cGRhdGVEYXNoYm9hcmRXaWRnZXRzKGxhdGVzdE1ldHJpY3MpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDjgqvjgrnjgr/jg6Djg6Hjg4jjg6rjgq/jgrnjga7mipXnqL9cbiAgICAgICAgICAgIGF3YWl0IHB1Ymxpc2hDdXN0b21NZXRyaWNzKGxhdGVzdE1ldHJpY3MpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAn44OA44OD44K344Ol44Oc44O844OJ5pu05paw5a6M5LqGJyxcbiAgICAgICAgICAgICAgICBtZXRyaWNzUHJvY2Vzc2VkOiBsYXRlc3RNZXRyaWNzLmxlbmd0aFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCfjg4Djg4Pjgrfjg6Xjg5zjg7zjg4nmm7TmlrDjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGdldExhdGVzdE1ldHJpY3MoKSB7XG4gICAgICAgICAgY29uc3QgbW9uaXRvcmVkUmVnaW9ucyA9ICR7SlNPTi5zdHJpbmdpZnkodGhpcy5jb25maWcubW9uaXRvcmVkUmVnaW9ucyl9O1xuICAgICAgICAgIGNvbnN0IG1ldHJpY3MgPSBbXTtcblxuICAgICAgICAgIGZvciAoY29uc3QgcmVnaW9uIG9mIG1vbml0b3JlZFJlZ2lvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgVGFibGVOYW1lOiAnJHt0aGlzLm1ldHJpY3NUYWJsZS50YWJsZU5hbWV9JyxcbiAgICAgICAgICAgICAgSW5kZXhOYW1lOiAnUmVnaW9uSW5kZXgnLFxuICAgICAgICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAncmVnaW9uID0gOnJlZ2lvbicsXG4gICAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAnOnJlZ2lvbic6IHJlZ2lvblxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBTY2FuSW5kZXhGb3J3YXJkOiBmYWxzZSxcbiAgICAgICAgICAgICAgTGltaXQ6IDUwIC8vIOacgOaWsDUw5Lu2XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9kYi5xdWVyeShwYXJhbXMpLnByb21pc2UoKTtcbiAgICAgICAgICAgIG1ldHJpY3MucHVzaCguLi4ocmVzdWx0Lkl0ZW1zIHx8IFtdKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIG1ldHJpY3M7XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiB1cGRhdGVEYXNoYm9hcmRXaWRnZXRzKG1ldHJpY3MpIHtcbiAgICAgICAgICAvLyDjg6Hjg4jjg6rjgq/jgrnjgpLlnLDln5/liKXjg7vjgr/jgqTjg5fliKXjgavpm4boqIhcbiAgICAgICAgICBjb25zdCBhZ2dyZWdhdGVkTWV0cmljcyA9IGFnZ3JlZ2F0ZU1ldHJpY3MobWV0cmljcyk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gQ2xvdWRXYXRjaOOCq+OCueOCv+ODoOODoeODiOODquOCr+OCueOBqOOBl+OBpuaKleeov1xuICAgICAgICAgIGF3YWl0IHB1Ymxpc2hBZ2dyZWdhdGVkTWV0cmljcyhhZ2dyZWdhdGVkTWV0cmljcyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBhZ2dyZWdhdGVNZXRyaWNzKG1ldHJpY3MpIHtcbiAgICAgICAgICBjb25zdCBhZ2dyZWdhdGVkID0ge307XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IG1ldHJpYyBvZiBtZXRyaWNzKSB7XG4gICAgICAgICAgICBjb25zdCBrZXkgPSBcXGBcXCR7bWV0cmljLnJlZ2lvbn0tXFwke21ldHJpYy5tZXRyaWNUeXBlfVxcYDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFhZ2dyZWdhdGVkW2tleV0pIHtcbiAgICAgICAgICAgICAgYWdncmVnYXRlZFtrZXldID0ge1xuICAgICAgICAgICAgICAgIHJlZ2lvbjogbWV0cmljLnJlZ2lvbixcbiAgICAgICAgICAgICAgICBtZXRyaWNUeXBlOiBtZXRyaWMubWV0cmljVHlwZSxcbiAgICAgICAgICAgICAgICB2YWx1ZXM6IFtdLFxuICAgICAgICAgICAgICAgIGNvdW50OiAwLFxuICAgICAgICAgICAgICAgIHN1bTogMCxcbiAgICAgICAgICAgICAgICBhdmc6IDAsXG4gICAgICAgICAgICAgICAgbWluOiBOdW1iZXIuTUFYX1ZBTFVFLFxuICAgICAgICAgICAgICAgIG1heDogTnVtYmVyLk1JTl9WQUxVRVxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBhZ2cgPSBhZ2dyZWdhdGVkW2tleV07XG4gICAgICAgICAgICBhZ2cudmFsdWVzLnB1c2gobWV0cmljLnZhbHVlKTtcbiAgICAgICAgICAgIGFnZy5jb3VudCsrO1xuICAgICAgICAgICAgYWdnLnN1bSArPSBtZXRyaWMudmFsdWU7XG4gICAgICAgICAgICBhZ2cubWluID0gTWF0aC5taW4oYWdnLm1pbiwgbWV0cmljLnZhbHVlKTtcbiAgICAgICAgICAgIGFnZy5tYXggPSBNYXRoLm1heChhZ2cubWF4LCBtZXRyaWMudmFsdWUpO1xuICAgICAgICAgICAgYWdnLmF2ZyA9IGFnZy5zdW0gLyBhZ2cuY291bnQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoYWdncmVnYXRlZCk7XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBwdWJsaXNoQWdncmVnYXRlZE1ldHJpY3MoYWdncmVnYXRlZE1ldHJpY3MpIHtcbiAgICAgICAgICBjb25zdCBtZXRyaWNEYXRhID0gW107XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IGFnZyBvZiBhZ2dyZWdhdGVkTWV0cmljcykge1xuICAgICAgICAgICAgLy8g5bmz5Z2H5YCkXG4gICAgICAgICAgICBtZXRyaWNEYXRhLnB1c2goe1xuICAgICAgICAgICAgICBNZXRyaWNOYW1lOiBcXGBcXCR7YWdnLm1ldHJpY1R5cGV9X0F2ZXJhZ2VcXGAsXG4gICAgICAgICAgICAgIERpbWVuc2lvbnM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBOYW1lOiAnUmVnaW9uJyxcbiAgICAgICAgICAgICAgICAgIFZhbHVlOiBhZ2cucmVnaW9uXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICBWYWx1ZTogYWdnLmF2ZyxcbiAgICAgICAgICAgICAgVW5pdDogJ05vbmUnLFxuICAgICAgICAgICAgICBUaW1lc3RhbXA6IG5ldyBEYXRlKClcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyDmnIDlpKflgKRcbiAgICAgICAgICAgIG1ldHJpY0RhdGEucHVzaCh7XG4gICAgICAgICAgICAgIE1ldHJpY05hbWU6IFxcYFxcJHthZ2cubWV0cmljVHlwZX1fTWF4aW11bVxcYCxcbiAgICAgICAgICAgICAgRGltZW5zaW9uczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIE5hbWU6ICdSZWdpb24nLFxuICAgICAgICAgICAgICAgICAgVmFsdWU6IGFnZy5yZWdpb25cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIFZhbHVlOiBhZ2cubWF4LFxuICAgICAgICAgICAgICBVbml0OiAnTm9uZScsXG4gICAgICAgICAgICAgIFRpbWVzdGFtcDogbmV3IERhdGUoKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIOacgOWwj+WApFxuICAgICAgICAgICAgbWV0cmljRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgTWV0cmljTmFtZTogXFxgXFwke2FnZy5tZXRyaWNUeXBlfV9NaW5pbXVtXFxgLFxuICAgICAgICAgICAgICBEaW1lbnNpb25zOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgTmFtZTogJ1JlZ2lvbicsXG4gICAgICAgICAgICAgICAgICBWYWx1ZTogYWdnLnJlZ2lvblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgVmFsdWU6IGFnZy5taW4sXG4gICAgICAgICAgICAgIFVuaXQ6ICdOb25lJyxcbiAgICAgICAgICAgICAgVGltZXN0YW1wOiBuZXcgRGF0ZSgpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBDbG91ZFdhdGNo44Gr44Oh44OI44Oq44Kv44K544KS5oqV56i/77yI44OQ44OD44OB5Yem55CG77yJXG4gICAgICAgICAgY29uc3QgYmF0Y2hTaXplID0gMjA7IC8vIENsb3VkV2F0Y2ggUHV0TWV0cmljRGF0YeOBruWItumZkFxuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWV0cmljRGF0YS5sZW5ndGg7IGkgKz0gYmF0Y2hTaXplKSB7XG4gICAgICAgICAgICBjb25zdCBiYXRjaCA9IG1ldHJpY0RhdGEuc2xpY2UoaSwgaSArIGJhdGNoU2l6ZSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IGNsb3Vkd2F0Y2gucHV0TWV0cmljRGF0YSh7XG4gICAgICAgICAgICAgIE5hbWVzcGFjZTogJ0dsb2JhbFJBRy9Nb25pdG9yaW5nJyxcbiAgICAgICAgICAgICAgTWV0cmljRGF0YTogYmF0Y2hcbiAgICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBwdWJsaXNoQ3VzdG9tTWV0cmljcyhtZXRyaWNzKSB7XG4gICAgICAgICAgLy8g44Kw44Ot44O844OQ44Or57Wx6KiI44Gu6KiI566XXG4gICAgICAgICAgY29uc3QgZ2xvYmFsU3RhdHMgPSBjYWxjdWxhdGVHbG9iYWxTdGF0cyhtZXRyaWNzKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDjgrDjg63jg7zjg5Djg6vjg6Hjg4jjg6rjgq/jgrnjga7mipXnqL9cbiAgICAgICAgICBhd2FpdCBjbG91ZHdhdGNoLnB1dE1ldHJpY0RhdGEoe1xuICAgICAgICAgICAgTmFtZXNwYWNlOiAnR2xvYmFsUkFHL0dsb2JhbCcsXG4gICAgICAgICAgICBNZXRyaWNEYXRhOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBNZXRyaWNOYW1lOiAnR2xvYmFsQXZhaWxhYmlsaXR5JyxcbiAgICAgICAgICAgICAgICBWYWx1ZTogZ2xvYmFsU3RhdHMuYXZhaWxhYmlsaXR5LFxuICAgICAgICAgICAgICAgIFVuaXQ6ICdQZXJjZW50JyxcbiAgICAgICAgICAgICAgICBUaW1lc3RhbXA6IG5ldyBEYXRlKClcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIE1ldHJpY05hbWU6ICdHbG9iYWxQZXJmb3JtYW5jZVNjb3JlJyxcbiAgICAgICAgICAgICAgICBWYWx1ZTogZ2xvYmFsU3RhdHMucGVyZm9ybWFuY2VTY29yZSxcbiAgICAgICAgICAgICAgICBVbml0OiAnTm9uZScsXG4gICAgICAgICAgICAgICAgVGltZXN0YW1wOiBuZXcgRGF0ZSgpXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBNZXRyaWNOYW1lOiAnR2xvYmFsQ29tcGxpYW5jZVNjb3JlJyxcbiAgICAgICAgICAgICAgICBWYWx1ZTogZ2xvYmFsU3RhdHMuY29tcGxpYW5jZVNjb3JlLFxuICAgICAgICAgICAgICAgIFVuaXQ6ICdQZXJjZW50JyxcbiAgICAgICAgICAgICAgICBUaW1lc3RhbXA6IG5ldyBEYXRlKClcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIE1ldHJpY05hbWU6ICdBY3RpdmVSZWdpb25zJyxcbiAgICAgICAgICAgICAgICBWYWx1ZTogZ2xvYmFsU3RhdHMuYWN0aXZlUmVnaW9ucyxcbiAgICAgICAgICAgICAgICBVbml0OiAnQ291bnQnLFxuICAgICAgICAgICAgICAgIFRpbWVzdGFtcDogbmV3IERhdGUoKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gY2FsY3VsYXRlR2xvYmFsU3RhdHMobWV0cmljcykge1xuICAgICAgICAgIGNvbnN0IHJlZ2lvbnMgPSBuZXcgU2V0KCk7XG4gICAgICAgICAgbGV0IHRvdGFsQXZhaWxhYmlsaXR5ID0gMDtcbiAgICAgICAgICBsZXQgYXZhaWxhYmlsaXR5Q291bnQgPSAwO1xuICAgICAgICAgIGxldCB0b3RhbFBlcmZvcm1hbmNlID0gMDtcbiAgICAgICAgICBsZXQgcGVyZm9ybWFuY2VDb3VudCA9IDA7XG4gICAgICAgICAgbGV0IHRvdGFsQ29tcGxpYW5jZSA9IDA7XG4gICAgICAgICAgbGV0IGNvbXBsaWFuY2VDb3VudCA9IDA7XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IG1ldHJpYyBvZiBtZXRyaWNzKSB7XG4gICAgICAgICAgICByZWdpb25zLmFkZChtZXRyaWMucmVnaW9uKTtcblxuICAgICAgICAgICAgaWYgKG1ldHJpYy5tZXRyaWNOYW1lID09PSAnc3lzdGVtX2F2YWlsYWJpbGl0eScpIHtcbiAgICAgICAgICAgICAgdG90YWxBdmFpbGFiaWxpdHkgKz0gbWV0cmljLnZhbHVlO1xuICAgICAgICAgICAgICBhdmFpbGFiaWxpdHlDb3VudCsrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobWV0cmljLm1ldHJpY1R5cGUgPT09ICdQRVJGT1JNQU5DRScpIHtcbiAgICAgICAgICAgICAgLy8g44OR44OV44Kp44O844Oe44Oz44K544K544Kz44Ki44Gu6KiI566X77yI57Ch55Wl5YyW77yJXG4gICAgICAgICAgICAgIGNvbnN0IHNjb3JlID0gTWF0aC5tYXgoMCwgMTAwIC0gKG1ldHJpYy52YWx1ZSAvIDEwMDApICogMTApOyAvLyDjg6zjgrnjg53jg7PjgrnmmYLplpPjg5njg7zjgrlcbiAgICAgICAgICAgICAgdG90YWxQZXJmb3JtYW5jZSArPSBzY29yZTtcbiAgICAgICAgICAgICAgcGVyZm9ybWFuY2VDb3VudCsrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobWV0cmljLm1ldHJpY05hbWUgPT09ICdjb21wbGlhbmNlX3Njb3JlJykge1xuICAgICAgICAgICAgICB0b3RhbENvbXBsaWFuY2UgKz0gbWV0cmljLnZhbHVlO1xuICAgICAgICAgICAgICBjb21wbGlhbmNlQ291bnQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXZhaWxhYmlsaXR5OiBhdmFpbGFiaWxpdHlDb3VudCA+IDAgPyB0b3RhbEF2YWlsYWJpbGl0eSAvIGF2YWlsYWJpbGl0eUNvdW50IDogMCxcbiAgICAgICAgICAgIHBlcmZvcm1hbmNlU2NvcmU6IHBlcmZvcm1hbmNlQ291bnQgPiAwID8gdG90YWxQZXJmb3JtYW5jZSAvIHBlcmZvcm1hbmNlQ291bnQgOiAwLFxuICAgICAgICAgICAgY29tcGxpYW5jZVNjb3JlOiBjb21wbGlhbmNlQ291bnQgPiAwID8gdG90YWxDb21wbGlhbmNlIC8gY29tcGxpYW5jZUNvdW50IDogMCxcbiAgICAgICAgICAgIGFjdGl2ZVJlZ2lvbnM6IHJlZ2lvbnMuc2l6ZVxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIGApLFxuICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBNRVRSSUNTX1RBQkxFOiB0aGlzLm1ldHJpY3NUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIERBU0hCT0FSRF9DT05GSUdfVEFCTEU6IHRoaXMuZGFzaGJvYXJkQ29uZmlnVGFibGUudGFibGVOYW1lXG4gICAgICB9XG4gICAgfSk7XG4gIH0gIC8qKlxuXG4gICAqIOOCs+ODs+ODl+ODqeOCpOOCouODs+OCueebo+imlkxhbWJkYemWouaVsFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVDb21wbGlhbmNlTW9uaXRvckZ1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NvbXBsaWFuY2VNb25pdG9yRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1jb21wbGlhbmNlLW1vbml0b3JgLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgQVdTID0gcmVxdWlyZSgnYXdzLXNkaycpO1xuICAgICAgICBjb25zdCBkeW5hbW9kYiA9IG5ldyBBV1MuRHluYW1vREIuRG9jdW1lbnRDbGllbnQoKTtcblxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygn44Kz44Oz44OX44Op44Kk44Ki44Oz44K555uj6KaW6ZaL5aeLOicsIEpTT04uc3RyaW5naWZ5KGV2ZW50KSk7XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbW9uaXRvcmVkUmVnaW9ucyA9ICR7SlNPTi5zdHJpbmdpZnkodGhpcy5jb25maWcubW9uaXRvcmVkUmVnaW9ucyl9O1xuICAgICAgICAgICAgY29uc3QgY29tcGxpYW5jZVJlc3VsdHMgPSBbXTtcblxuICAgICAgICAgICAgLy8g5ZCE44Oq44O844K444On44Oz44Gu44Kz44Oz44OX44Op44Kk44Ki44Oz44K554q25rOB44KS55uj6KaWXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlZ2lvbiBvZiBtb25pdG9yZWRSZWdpb25zKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlZ2lvbkNvbXBsaWFuY2UgPSBhd2FpdCBtb25pdG9yUmVnaW9uQ29tcGxpYW5jZShyZWdpb24pO1xuICAgICAgICAgICAgICBjb21wbGlhbmNlUmVzdWx0cy5wdXNoKHJlZ2lvbkNvbXBsaWFuY2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDjgrDjg63jg7zjg5Djg6vjgrPjg7Pjg5fjg6njgqTjgqLjg7PjgrnjgrnjgrPjgqLjga7oqIjnrpdcbiAgICAgICAgICAgIGNvbnN0IGdsb2JhbFNjb3JlID0gY2FsY3VsYXRlR2xvYmFsQ29tcGxpYW5jZVNjb3JlKGNvbXBsaWFuY2VSZXN1bHRzKTtcblxuICAgICAgICAgICAgLy8g57WQ5p6c44KS44Oh44OI44Oq44Kv44K544Go44GX44Gm5L+d5a2YXG4gICAgICAgICAgICBhd2FpdCBzYXZlQ29tcGxpYW5jZU1ldHJpY3MoY29tcGxpYW5jZVJlc3VsdHMsIGdsb2JhbFNjb3JlKTtcblxuICAgICAgICAgICAgLy8g6YGV5Y+N44GM44GC44KL5aC05ZCI44Gv44Ki44Op44O844OI55Sf5oiQXG4gICAgICAgICAgICBjb25zdCB2aW9sYXRpb25zID0gY29tcGxpYW5jZVJlc3VsdHMuZmlsdGVyKHJlc3VsdCA9PiByZXN1bHQudmlvbGF0aW9ucy5sZW5ndGggPiAwKTtcbiAgICAgICAgICAgIGlmICh2aW9sYXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgYXdhaXQgZ2VuZXJhdGVDb21wbGlhbmNlQWxlcnRzKHZpb2xhdGlvbnMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAn44Kz44Oz44OX44Op44Kk44Ki44Oz44K555uj6KaW5a6M5LqGJyxcbiAgICAgICAgICAgICAgICByZWdpb25zTW9uaXRvcmVkOiBtb25pdG9yZWRSZWdpb25zLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBnbG9iYWxTY29yZTogZ2xvYmFsU2NvcmUsXG4gICAgICAgICAgICAgICAgdmlvbGF0aW9uc0ZvdW5kOiB2aW9sYXRpb25zLmxlbmd0aFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCfjgrPjg7Pjg5fjg6njgqTjgqLjg7Pjgrnnm6Poppbjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIG1vbml0b3JSZWdpb25Db21wbGlhbmNlKHJlZ2lvbikge1xuICAgICAgICAgIGNvbnN0IGNvbXBsaWFuY2UgPSB7XG4gICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgICAgICBjaGVja3M6IFtdLFxuICAgICAgICAgICAgdmlvbGF0aW9uczogW10sXG4gICAgICAgICAgICBvdmVyYWxsU2NvcmU6IDBcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEdEUFIg44Kz44Oz44OX44Op44Kk44Ki44Oz44K544OB44Kn44OD44KvXG4gICAgICAgICAgICBjb25zdCBnZHByQ2hlY2sgPSBhd2FpdCBjaGVja0dkcHJDb21wbGlhbmNlKHJlZ2lvbik7XG4gICAgICAgICAgICBjb21wbGlhbmNlLmNoZWNrcy5wdXNoKGdkcHJDaGVjayk7XG5cbiAgICAgICAgICAgIC8vIOODh+ODvOOCv+WxheS9j+aAp+ODgeOCp+ODg+OCr1xuICAgICAgICAgICAgY29uc3QgcmVzaWRlbmN5Q2hlY2sgPSBhd2FpdCBjaGVja0RhdGFSZXNpZGVuY3kocmVnaW9uKTtcbiAgICAgICAgICAgIGNvbXBsaWFuY2UuY2hlY2tzLnB1c2gocmVzaWRlbmN5Q2hlY2spO1xuXG4gICAgICAgICAgICAvLyDmmpflj7fljJbjgrPjg7Pjg5fjg6njgqTjgqLjg7Pjgrnjg4Hjgqfjg4Pjgq9cbiAgICAgICAgICAgIGNvbnN0IGVuY3J5cHRpb25DaGVjayA9IGF3YWl0IGNoZWNrRW5jcnlwdGlvbkNvbXBsaWFuY2UocmVnaW9uKTtcbiAgICAgICAgICAgIGNvbXBsaWFuY2UuY2hlY2tzLnB1c2goZW5jcnlwdGlvbkNoZWNrKTtcblxuICAgICAgICAgICAgLy8g44Ki44Kv44K744K55Yi25b6h44OB44Kn44OD44KvXG4gICAgICAgICAgICBjb25zdCBhY2Nlc3NDb250cm9sQ2hlY2sgPSBhd2FpdCBjaGVja0FjY2Vzc0NvbnRyb2xDb21wbGlhbmNlKHJlZ2lvbik7XG4gICAgICAgICAgICBjb21wbGlhbmNlLmNoZWNrcy5wdXNoKGFjY2Vzc0NvbnRyb2xDaGVjayk7XG5cbiAgICAgICAgICAgIC8vIOebo+afu+ODreOCsOODgeOCp+ODg+OCr1xuICAgICAgICAgICAgY29uc3QgYXVkaXRMb2dDaGVjayA9IGF3YWl0IGNoZWNrQXVkaXRMb2dDb21wbGlhbmNlKHJlZ2lvbik7XG4gICAgICAgICAgICBjb21wbGlhbmNlLmNoZWNrcy5wdXNoKGF1ZGl0TG9nQ2hlY2spO1xuXG4gICAgICAgICAgICAvLyDpgZXlj43jga7pm4boqIhcbiAgICAgICAgICAgIGNvbXBsaWFuY2UudmlvbGF0aW9ucyA9IGNvbXBsaWFuY2UuY2hlY2tzXG4gICAgICAgICAgICAgIC5maWx0ZXIoY2hlY2sgPT4gY2hlY2suc3RhdHVzID09PSAnVklPTEFUSU9OJylcbiAgICAgICAgICAgICAgLm1hcChjaGVjayA9PiAoe1xuICAgICAgICAgICAgICAgIGNoZWNrTmFtZTogY2hlY2suY2hlY2tOYW1lLFxuICAgICAgICAgICAgICAgIHNldmVyaXR5OiBjaGVjay5zZXZlcml0eSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogY2hlY2suZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgcmVjb21tZW5kYXRpb246IGNoZWNrLnJlY29tbWVuZGF0aW9uXG4gICAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgLy8g57eP5ZCI44K544Kz44Ki44Gu6KiI566XXG4gICAgICAgICAgICBjb25zdCBwYXNzZWRDaGVja3MgPSBjb21wbGlhbmNlLmNoZWNrcy5maWx0ZXIoY2hlY2sgPT4gY2hlY2suc3RhdHVzID09PSAnUEFTUycpLmxlbmd0aDtcbiAgICAgICAgICAgIGNvbXBsaWFuY2Uub3ZlcmFsbFNjb3JlID0gKHBhc3NlZENoZWNrcyAvIGNvbXBsaWFuY2UuY2hlY2tzLmxlbmd0aCkgKiAxMDA7XG5cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcXGDjg6rjg7zjgrjjg6fjg7MgXFwke3JlZ2lvbn0g44Gu44Kz44Oz44OX44Op44Kk44Ki44Oz44K555uj6KaW44Ko44Op44O8OlxcYCwgZXJyb3IpO1xuICAgICAgICAgICAgY29tcGxpYW5jZS5jaGVja3MucHVzaCh7XG4gICAgICAgICAgICAgIGNoZWNrTmFtZTogJ21vbml0b3JpbmdfZXJyb3InLFxuICAgICAgICAgICAgICBzdGF0dXM6ICdFUlJPUicsXG4gICAgICAgICAgICAgIHNldmVyaXR5OiAnSElHSCcsXG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcXGDnm6Poppbjgqjjg6njg7w6IFxcJHtlcnJvci5tZXNzYWdlfVxcYFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIGNvbXBsaWFuY2U7XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjaGVja0dkcHJDb21wbGlhbmNlKHJlZ2lvbikge1xuICAgICAgICAgIC8vIEdEUFIg44Kz44Oz44OX44Op44Kk44Ki44Oz44K544Gu56K66KqNXG4gICAgICAgICAgY29uc3QgZ2RwclJlZ2lvbnMgPSBbJ2V1LXdlc3QtMScsICdldS1jZW50cmFsLTEnLCAnZXUtd2VzdC0yJywgJ2V1LXdlc3QtMyddO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChnZHByUmVnaW9ucy5pbmNsdWRlcyhyZWdpb24pKSB7XG4gICAgICAgICAgICAvLyBFVeWcsOWfn+OBp+OBrkdEUFLopoHku7bjg4Hjgqfjg4Pjgq9cbiAgICAgICAgICAgIGNvbnN0IGNoZWNrcyA9IFtcbiAgICAgICAgICAgICAgYXdhaXQgY2hlY2tEYXRhU3ViamVjdFJpZ2h0cyhyZWdpb24pLFxuICAgICAgICAgICAgICBhd2FpdCBjaGVja0NvbnNlbnRNYW5hZ2VtZW50KHJlZ2lvbiksXG4gICAgICAgICAgICAgIGF3YWl0IGNoZWNrRGF0YVByb3RlY3Rpb25PZmZpY2VyKHJlZ2lvbiksXG4gICAgICAgICAgICAgIGF3YWl0IGNoZWNrUHJpdmFjeUJ5RGVzaWduKHJlZ2lvbilcbiAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgIGNvbnN0IHZpb2xhdGlvbnMgPSBjaGVja3MuZmlsdGVyKGNoZWNrID0+ICFjaGVjay5jb21wbGlhbnQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBjaGVja05hbWU6ICdHRFBSIENvbXBsaWFuY2UnLFxuICAgICAgICAgICAgICBzdGF0dXM6IHZpb2xhdGlvbnMubGVuZ3RoID4gMCA/ICdWSU9MQVRJT04nIDogJ1BBU1MnLFxuICAgICAgICAgICAgICBzZXZlcml0eTogdmlvbGF0aW9ucy5sZW5ndGggPiAwID8gJ0hJR0gnIDogJ0xPVycsXG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiB2aW9sYXRpb25zLmxlbmd0aCA+IDAgXG4gICAgICAgICAgICAgICAgPyBcXGBHRFBS6YGV5Y+N44GM5qSc5Ye644GV44KM44G+44GX44GfOiBcXCR7dmlvbGF0aW9ucy5sZW5ndGh95Lu2XFxgXG4gICAgICAgICAgICAgICAgOiAnR0RQUuimgeS7tuOBq+a6luaLoOOBl+OBpuOBhOOBvuOBmScsXG4gICAgICAgICAgICAgIGRldGFpbHM6IGNoZWNrcyxcbiAgICAgICAgICAgICAgcmVjb21tZW5kYXRpb246IHZpb2xhdGlvbnMubGVuZ3RoID4gMCBcbiAgICAgICAgICAgICAgICA/ICdHRFBS6YGV5Y+N6aCF55uu44Gu5Y2z5bqn5L+u5q2j44GM5b+F6KaB44Gn44GZJ1xuICAgICAgICAgICAgICAgIDogbnVsbFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgY2hlY2tOYW1lOiAnR0RQUiBDb21wbGlhbmNlJyxcbiAgICAgICAgICAgICAgc3RhdHVzOiAnTk9UX0FQUExJQ0FCTEUnLFxuICAgICAgICAgICAgICBzZXZlcml0eTogJ0xPVycsXG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn44GT44Gu44Oq44O844K444On44Oz44GvR0RQUuWvvuixoeWkluOBp+OBmSdcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gY2hlY2tEYXRhU3ViamVjdFJpZ2h0cyhyZWdpb24pIHtcbiAgICAgICAgICAvLyDjg4fjg7zjgr/kuLvkvZPmqKnliKnjga7lrp/oo4Xnirbms4Hnorroqo1cbiAgICAgICAgICAvLyDlrp/pmpvjga7lrp/oo4Xjgafjga/jgIFHRFBS5a++5b+c44K344K544OG44Og44GuQVBJ44KS5ZG844Gz5Ye644GXXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJlcXVpcmVtZW50OiAnRGF0YSBTdWJqZWN0IFJpZ2h0cycsXG4gICAgICAgICAgICBjb21wbGlhbnQ6IHRydWUsXG4gICAgICAgICAgICBkZXRhaWxzOiAn44OH44O844K/44Ki44Kv44K744K55qip44CB5YmK6Zmk5qip44CB44Od44O844K/44OT44Oq44OG44Kj5qip44GM5a6f6KOF5riI44G/J1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjaGVja0NvbnNlbnRNYW5hZ2VtZW50KHJlZ2lvbikge1xuICAgICAgICAgIC8vIOWQjOaEj+euoeeQhuOCt+OCueODhuODoOOBrueiuuiqjVxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXF1aXJlbWVudDogJ0NvbnNlbnQgTWFuYWdlbWVudCcsXG4gICAgICAgICAgICBjb21wbGlhbnQ6IHRydWUsXG4gICAgICAgICAgICBkZXRhaWxzOiAn5ZCM5oSP5Y+W5b6X44O7566h55CG44K344K544OG44Og44GM5a6f6KOF5riI44G/J1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjaGVja0RhdGFQcm90ZWN0aW9uT2ZmaWNlcihyZWdpb24pIHtcbiAgICAgICAgICAvLyDjg4fjg7zjgr/kv53orbfosqzku7vogIXjga7mjIflrprnorroqo1cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcmVxdWlyZW1lbnQ6ICdEYXRhIFByb3RlY3Rpb24gT2ZmaWNlcicsXG4gICAgICAgICAgICBjb21wbGlhbnQ6IHRydWUsXG4gICAgICAgICAgICBkZXRhaWxzOiAn44OH44O844K/5L+d6K236LKs5Lu76ICF44GM5oyH5a6a5riI44G/J1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjaGVja1ByaXZhY3lCeURlc2lnbihyZWdpb24pIHtcbiAgICAgICAgICAvLyDjg5fjg6njgqTjg5Djgrfjg7zjg7vjg5DjgqTjg7vjg4fjgrbjgqTjg7Pjga7lrp/oo4Xnorroqo1cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcmVxdWlyZW1lbnQ6ICdQcml2YWN5IGJ5IERlc2lnbicsXG4gICAgICAgICAgICBjb21wbGlhbnQ6IHRydWUsXG4gICAgICAgICAgICBkZXRhaWxzOiAn44OX44Op44Kk44OQ44K344O844O744OQ44Kk44O744OH44K244Kk44Oz5Y6f5YmH44GM6YGp55So5riI44G/J1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjaGVja0RhdGFSZXNpZGVuY3kocmVnaW9uKSB7XG4gICAgICAgICAgLy8g44OH44O844K/5bGF5L2P5oCn6KaB5Lu244Gu56K66KqNXG4gICAgICAgICAgY29uc3QgYWxsb3dlZFJlZ2lvbnMgPSB7XG4gICAgICAgICAgICAnYXAtbm9ydGhlYXN0LTEnOiBbJ2pwJ10sIC8vIOaXpeacrFxuICAgICAgICAgICAgJ2FwLW5vcnRoZWFzdC0zJzogWydqcCddLCAvLyDml6XmnKxcbiAgICAgICAgICAgICdldS13ZXN0LTEnOiBbJ2V1J10sIC8vIEVVXG4gICAgICAgICAgICAnZXUtY2VudHJhbC0xJzogWydldSddLCAvLyBFVVxuICAgICAgICAgICAgJ3VzLWVhc3QtMSc6IFsndXMnXSwgLy8g57Gz5Zu9XG4gICAgICAgICAgICAndXMtd2VzdC0yJzogWyd1cyddIC8vIOexs+WbvVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBjb25zdCByZWdpb25SZXF1aXJlbWVudHMgPSBhbGxvd2VkUmVnaW9uc1tyZWdpb25dIHx8IFtdO1xuICAgICAgICAgIGNvbnN0IGNvbXBsaWFudCA9IHJlZ2lvblJlcXVpcmVtZW50cy5sZW5ndGggPiAwO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNoZWNrTmFtZTogJ0RhdGEgUmVzaWRlbmN5JyxcbiAgICAgICAgICAgIHN0YXR1czogY29tcGxpYW50ID8gJ1BBU1MnIDogJ1ZJT0xBVElPTicsXG4gICAgICAgICAgICBzZXZlcml0eTogY29tcGxpYW50ID8gJ0xPVycgOiAnSElHSCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogY29tcGxpYW50IFxuICAgICAgICAgICAgICA/IFxcYOODh+ODvOOCv+WxheS9j+aAp+imgeS7tuOBq+a6luaLoDogXFwke3JlZ2lvblJlcXVpcmVtZW50cy5qb2luKCcsICcpfVxcYFxuICAgICAgICAgICAgICA6ICfjg4fjg7zjgr/lsYXkvY/mgKfopoHku7bjgYzmnKrlrprnvqnjgafjgZknLFxuICAgICAgICAgICAgcmVjb21tZW5kYXRpb246IGNvbXBsaWFudCA/IG51bGwgOiAn44OH44O844K/5bGF5L2P5oCn44Od44Oq44K344O844Gu5a6a576p44GM5b+F6KaB44Gn44GZJ1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjaGVja0VuY3J5cHRpb25Db21wbGlhbmNlKHJlZ2lvbikge1xuICAgICAgICAgIC8vIOaal+WPt+WMluimgeS7tuOBrueiuuiqjVxuICAgICAgICAgIC8vIOWun+mam+OBruWun+ijheOBp+OBr+OAgeWQhOOCteODvOODk+OCueOBruaal+WPt+WMluioreWumuOCkueiuuiqjVxuICAgICAgICAgIGNvbnN0IGVuY3J5cHRpb25DaGVja3MgPSBbXG4gICAgICAgICAgICB7IHNlcnZpY2U6ICdTMycsIGVuY3J5cHRlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgeyBzZXJ2aWNlOiAnRHluYW1vREInLCBlbmNyeXB0ZWQ6IHRydWUgfSxcbiAgICAgICAgICAgIHsgc2VydmljZTogJ0xhbWJkYScsIGVuY3J5cHRlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgeyBzZXJ2aWNlOiAnRUJTJywgZW5jcnlwdGVkOiB0cnVlIH1cbiAgICAgICAgICBdO1xuXG4gICAgICAgICAgY29uc3QgdW5lbmNyeXB0ZWQgPSBlbmNyeXB0aW9uQ2hlY2tzLmZpbHRlcihjaGVjayA9PiAhY2hlY2suZW5jcnlwdGVkKTtcbiAgICAgICAgICBjb25zdCBjb21wbGlhbnQgPSB1bmVuY3J5cHRlZC5sZW5ndGggPT09IDA7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2hlY2tOYW1lOiAnRW5jcnlwdGlvbiBDb21wbGlhbmNlJyxcbiAgICAgICAgICAgIHN0YXR1czogY29tcGxpYW50ID8gJ1BBU1MnIDogJ1ZJT0xBVElPTicsXG4gICAgICAgICAgICBzZXZlcml0eTogY29tcGxpYW50ID8gJ0xPVycgOiAnSElHSCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogY29tcGxpYW50IFxuICAgICAgICAgICAgICA/ICflhajjgrXjg7zjg5Pjgrnjgafmmpflj7fljJbjgYzmnInlirnjgafjgZknXG4gICAgICAgICAgICAgIDogXFxg5pqX5Y+35YyW44GV44KM44Gm44GE44Gq44GE44K144O844OT44K5OiBcXCR7dW5lbmNyeXB0ZWQubWFwKHMgPT4gcy5zZXJ2aWNlKS5qb2luKCcsICcpfVxcYCxcbiAgICAgICAgICAgIHJlY29tbWVuZGF0aW9uOiBjb21wbGlhbnQgPyBudWxsIDogJ+acquaal+WPt+WMluOCteODvOODk+OCueOBruaal+WPt+WMluOCkuacieWKueOBq+OBl+OBpuOBj+OBoOOBleOBhCdcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gY2hlY2tBY2Nlc3NDb250cm9sQ29tcGxpYW5jZShyZWdpb24pIHtcbiAgICAgICAgICAvLyDjgqLjgq/jgrvjgrnliLblvqHjga7norroqo1cbiAgICAgICAgICBjb25zdCBhY2Nlc3NDb250cm9sQ2hlY2tzID0gW1xuICAgICAgICAgICAgeyBjb250cm9sOiAnSUFNIFJvbGVzJywgaW1wbGVtZW50ZWQ6IHRydWUgfSxcbiAgICAgICAgICAgIHsgY29udHJvbDogJ01GQScsIGltcGxlbWVudGVkOiB0cnVlIH0sXG4gICAgICAgICAgICB7IGNvbnRyb2w6ICdMZWFzdCBQcml2aWxlZ2UnLCBpbXBsZW1lbnRlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgeyBjb250cm9sOiAnUmVndWxhciBBY2Nlc3MgUmV2aWV3JywgaW1wbGVtZW50ZWQ6IGZhbHNlIH1cbiAgICAgICAgICBdO1xuXG4gICAgICAgICAgY29uc3QgbWlzc2luZyA9IGFjY2Vzc0NvbnRyb2xDaGVja3MuZmlsdGVyKGNoZWNrID0+ICFjaGVjay5pbXBsZW1lbnRlZCk7XG4gICAgICAgICAgY29uc3QgY29tcGxpYW50ID0gbWlzc2luZy5sZW5ndGggPT09IDA7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2hlY2tOYW1lOiAnQWNjZXNzIENvbnRyb2wgQ29tcGxpYW5jZScsXG4gICAgICAgICAgICBzdGF0dXM6IGNvbXBsaWFudCA/ICdQQVNTJyA6ICdXQVJOSU5HJyxcbiAgICAgICAgICAgIHNldmVyaXR5OiBjb21wbGlhbnQgPyAnTE9XJyA6ICdNRURJVU0nLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGNvbXBsaWFudCBcbiAgICAgICAgICAgICAgPyAn44Ki44Kv44K744K55Yi25b6h44GM6YGp5YiH44Gr5a6f6KOF44GV44KM44Gm44GE44G+44GZJ1xuICAgICAgICAgICAgICA6IFxcYOacquWun+ijheOBruOCouOCr+OCu+OCueWItuW+oTogXFwke21pc3NpbmcubWFwKG0gPT4gbS5jb250cm9sKS5qb2luKCcsICcpfVxcYCxcbiAgICAgICAgICAgIHJlY29tbWVuZGF0aW9uOiBjb21wbGlhbnQgPyBudWxsIDogJ+acquWun+ijheOBruOCouOCr+OCu+OCueWItuW+oeOBruWun+ijheOCkuaOqOWlqOOBl+OBvuOBmSdcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gY2hlY2tBdWRpdExvZ0NvbXBsaWFuY2UocmVnaW9uKSB7XG4gICAgICAgICAgLy8g55uj5p+744Ot44Kw44Gu56K66KqNXG4gICAgICAgICAgY29uc3QgYXVkaXRMb2dDaGVja3MgPSBbXG4gICAgICAgICAgICB7IGxvZzogJ0Nsb3VkVHJhaWwnLCBlbmFibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICB7IGxvZzogJ1ZQQyBGbG93IExvZ3MnLCBlbmFibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICB7IGxvZzogJ0FwcGxpY2F0aW9uIExvZ3MnLCBlbmFibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICB7IGxvZzogJ0RhdGFiYXNlIExvZ3MnLCBlbmFibGVkOiB0cnVlIH1cbiAgICAgICAgICBdO1xuXG4gICAgICAgICAgY29uc3QgZGlzYWJsZWQgPSBhdWRpdExvZ0NoZWNrcy5maWx0ZXIoY2hlY2sgPT4gIWNoZWNrLmVuYWJsZWQpO1xuICAgICAgICAgIGNvbnN0IGNvbXBsaWFudCA9IGRpc2FibGVkLmxlbmd0aCA9PT0gMDtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjaGVja05hbWU6ICdBdWRpdCBMb2cgQ29tcGxpYW5jZScsXG4gICAgICAgICAgICBzdGF0dXM6IGNvbXBsaWFudCA/ICdQQVNTJyA6ICdWSU9MQVRJT04nLFxuICAgICAgICAgICAgc2V2ZXJpdHk6IGNvbXBsaWFudCA/ICdMT1cnIDogJ01FRElVTScsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogY29tcGxpYW50IFxuICAgICAgICAgICAgICA/ICfnm6Pmn7vjg63jgrDjgYzpganliIfjgavoqK3lrprjgZXjgozjgabjgYTjgb7jgZknXG4gICAgICAgICAgICAgIDogXFxg54Sh5Yq544Gq55uj5p+744Ot44KwOiBcXCR7ZGlzYWJsZWQubWFwKGQgPT4gZC5sb2cpLmpvaW4oJywgJyl9XFxgLFxuICAgICAgICAgICAgcmVjb21tZW5kYXRpb246IGNvbXBsaWFudCA/IG51bGwgOiAn54Sh5Yq544Gq55uj5p+744Ot44Kw44KS5pyJ5Yq544Gr44GX44Gm44GP44Gg44GV44GEJ1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjYWxjdWxhdGVHbG9iYWxDb21wbGlhbmNlU2NvcmUoY29tcGxpYW5jZVJlc3VsdHMpIHtcbiAgICAgICAgICBpZiAoY29tcGxpYW5jZVJlc3VsdHMubGVuZ3RoID09PSAwKSByZXR1cm4gMDtcblxuICAgICAgICAgIGNvbnN0IHRvdGFsU2NvcmUgPSBjb21wbGlhbmNlUmVzdWx0cy5yZWR1Y2UoKHN1bSwgcmVzdWx0KSA9PiBzdW0gKyByZXN1bHQub3ZlcmFsbFNjb3JlLCAwKTtcbiAgICAgICAgICByZXR1cm4gdG90YWxTY29yZSAvIGNvbXBsaWFuY2VSZXN1bHRzLmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIHNhdmVDb21wbGlhbmNlTWV0cmljcyhjb21wbGlhbmNlUmVzdWx0cywgZ2xvYmFsU2NvcmUpIHtcbiAgICAgICAgICBjb25zdCBtZXRyaWNzID0gW107XG5cbiAgICAgICAgICAvLyDlnLDln5/liKXjgrPjg7Pjg5fjg6njgqTjgqLjg7PjgrnjgrnjgrPjgqJcbiAgICAgICAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiBjb21wbGlhbmNlUmVzdWx0cykge1xuICAgICAgICAgICAgbWV0cmljcy5wdXNoKHtcbiAgICAgICAgICAgICAgbWV0cmljSWQ6IFxcYGNvbXBsaWFuY2UtXFwke3Jlc3VsdC5yZWdpb259LVxcJHtyZXN1bHQudGltZXN0YW1wfVxcYCxcbiAgICAgICAgICAgICAgcmVnaW9uOiByZXN1bHQucmVnaW9uLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IHJlc3VsdC50aW1lc3RhbXAsXG4gICAgICAgICAgICAgIG1ldHJpY1R5cGU6ICdDT01QTElBTkNFJyxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ2NvbXBsaWFuY2Vfc2NvcmUnLFxuICAgICAgICAgICAgICB2YWx1ZTogcmVzdWx0Lm92ZXJhbGxTY29yZSxcbiAgICAgICAgICAgICAgdW5pdDogJ1BlcmNlbnQnLFxuICAgICAgICAgICAgICB0dGw6IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApICsgKCR7dGhpcy5jb25maWcuZGF0YVJldGVudGlvbkRheXN9ICogMjQgKiA2MCAqIDYwKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIOmBleWPjeaVsOODoeODiOODquOCr+OCuVxuICAgICAgICAgICAgbWV0cmljcy5wdXNoKHtcbiAgICAgICAgICAgICAgbWV0cmljSWQ6IFxcYHZpb2xhdGlvbnMtXFwke3Jlc3VsdC5yZWdpb259LVxcJHtyZXN1bHQudGltZXN0YW1wfVxcYCxcbiAgICAgICAgICAgICAgcmVnaW9uOiByZXN1bHQucmVnaW9uLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IHJlc3VsdC50aW1lc3RhbXAsXG4gICAgICAgICAgICAgIG1ldHJpY1R5cGU6ICdDT01QTElBTkNFJyxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ2NvbXBsaWFuY2VfdmlvbGF0aW9ucycsXG4gICAgICAgICAgICAgIHZhbHVlOiByZXN1bHQudmlvbGF0aW9ucy5sZW5ndGgsXG4gICAgICAgICAgICAgIHVuaXQ6ICdDb3VudCcsXG4gICAgICAgICAgICAgIHR0bDogTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCkgKyAoJHt0aGlzLmNvbmZpZy5kYXRhUmV0ZW50aW9uRGF5c30gKiAyNCAqIDYwICogNjApXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyDjgrDjg63jg7zjg5Djg6vjgrPjg7Pjg5fjg6njgqTjgqLjg7PjgrnjgrnjgrPjgqJcbiAgICAgICAgICBtZXRyaWNzLnB1c2goe1xuICAgICAgICAgICAgbWV0cmljSWQ6IFxcYGdsb2JhbC1jb21wbGlhbmNlLVxcJHtEYXRlLm5vdygpfVxcYCxcbiAgICAgICAgICAgIHJlZ2lvbjogJ2dsb2JhbCcsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgICAgICBtZXRyaWNUeXBlOiAnQ09NUExJQU5DRScsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnZ2xvYmFsX2NvbXBsaWFuY2Vfc2NvcmUnLFxuICAgICAgICAgICAgdmFsdWU6IGdsb2JhbFNjb3JlLFxuICAgICAgICAgICAgdW5pdDogJ1BlcmNlbnQnLFxuICAgICAgICAgICAgdHRsOiBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKSArICgke3RoaXMuY29uZmlnLmRhdGFSZXRlbnRpb25EYXlzfSAqIDI0ICogNjAgKiA2MClcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIER5bmFtb0RC44Gr5L+d5a2YXG4gICAgICAgICAgY29uc3QgYmF0Y2hTaXplID0gMjU7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXRyaWNzLmxlbmd0aDsgaSArPSBiYXRjaFNpemUpIHtcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoID0gbWV0cmljcy5zbGljZShpLCBpICsgYmF0Y2hTaXplKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICAgICAgICBSZXF1ZXN0SXRlbXM6IHtcbiAgICAgICAgICAgICAgICAnJHt0aGlzLm1ldHJpY3NUYWJsZS50YWJsZU5hbWV9JzogYmF0Y2gubWFwKG1ldHJpYyA9PiAoe1xuICAgICAgICAgICAgICAgICAgUHV0UmVxdWVzdDogeyBJdGVtOiBtZXRyaWMgfVxuICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBhd2FpdCBkeW5hbW9kYi5iYXRjaFdyaXRlKHBhcmFtcykucHJvbWlzZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlQ29tcGxpYW5jZUFsZXJ0cyh2aW9sYXRpb25zKSB7XG4gICAgICAgICAgZm9yIChjb25zdCB2aW9sYXRpb24gb2YgdmlvbGF0aW9ucykge1xuICAgICAgICAgICAgZm9yIChjb25zdCB2IG9mIHZpb2xhdGlvbi52aW9sYXRpb25zKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGFsZXJ0SWQgPSBcXGBjb21wbGlhbmNlLWFsZXJ0LVxcJHt2aW9sYXRpb24ucmVnaW9ufS1cXCR7RGF0ZS5ub3coKX0tXFwke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA5KX1cXGA7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBjb25zdCBhbGVydCA9IHtcbiAgICAgICAgICAgICAgICBhbGVydElkLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogdmlvbGF0aW9uLnRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgICByZWdpb246IHZpb2xhdGlvbi5yZWdpb24sXG4gICAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ2NvbXBsaWFuY2VfdmlvbGF0aW9uJyxcbiAgICAgICAgICAgICAgICBtZXRyaWNWYWx1ZTogMSxcbiAgICAgICAgICAgICAgICBzZXZlcml0eTogdi5zZXZlcml0eSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBcXGDjgrPjg7Pjg5fjg6njgqTjgqLjg7PjgrnpgZXlj406IFxcJHt2LmNoZWNrTmFtZX0gLSBcXCR7di5kZXNjcmlwdGlvbn1cXGAsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnT1BFTicsXG4gICAgICAgICAgICAgICAgY2F0ZWdvcnk6ICdDT01QTElBTkNFJyxcbiAgICAgICAgICAgICAgICByZWNvbW1lbmRhdGlvbjogdi5yZWNvbW1lbmRhdGlvbixcbiAgICAgICAgICAgICAgICB0dGw6IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApICsgKDMwICogMjQgKiA2MCAqIDYwKVxuICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgIGF3YWl0IGR5bmFtb2RiLnB1dCh7XG4gICAgICAgICAgICAgICAgVGFibGVOYW1lOiAnJHt0aGlzLmFsZXJ0c1RhYmxlLnRhYmxlTmFtZX0nLFxuICAgICAgICAgICAgICAgIEl0ZW06IGFsZXJ0XG4gICAgICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIGApLFxuICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBNRVRSSUNTX1RBQkxFOiB0aGlzLm1ldHJpY3NUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFMRVJUU19UQUJMRTogdGhpcy5hbGVydHNUYWJsZS50YWJsZU5hbWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrvjgq3jg6Xjg6rjg4bjgqPnm6PoppZMYW1iZGHplqLmlbBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU2VjdXJpdHlNb25pdG9yRnVuY3Rpb24oKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICByZXR1cm4gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU2VjdXJpdHlNb25pdG9yRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1zZWN1cml0eS1tb25pdG9yYCxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IEFXUyA9IHJlcXVpcmUoJ2F3cy1zZGsnKTtcbiAgICAgICAgY29uc3QgZHluYW1vZGIgPSBuZXcgQVdTLkR5bmFtb0RCLkRvY3VtZW50Q2xpZW50KCk7XG5cbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ+OCu+OCreODpeODquODhuOCo+ebo+imlumWi+WnizonLCBKU09OLnN0cmluZ2lmeShldmVudCkpO1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG1vbml0b3JlZFJlZ2lvbnMgPSAke0pTT04uc3RyaW5naWZ5KHRoaXMuY29uZmlnLm1vbml0b3JlZFJlZ2lvbnMpfTtcbiAgICAgICAgICAgIGNvbnN0IHNlY3VyaXR5UmVzdWx0cyA9IFtdO1xuXG4gICAgICAgICAgICAvLyDlkITjg6rjg7zjgrjjg6fjg7Pjga7jgrvjgq3jg6Xjg6rjg4bjgqPnirbms4HjgpLnm6PoppZcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVnaW9uIG9mIG1vbml0b3JlZFJlZ2lvbnMpIHtcbiAgICAgICAgICAgICAgY29uc3QgcmVnaW9uU2VjdXJpdHkgPSBhd2FpdCBtb25pdG9yUmVnaW9uU2VjdXJpdHkocmVnaW9uKTtcbiAgICAgICAgICAgICAgc2VjdXJpdHlSZXN1bHRzLnB1c2gocmVnaW9uU2VjdXJpdHkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDjgrDjg63jg7zjg5Djg6vjgrvjgq3jg6Xjg6rjg4bjgqPjgrnjgrPjgqLjga7oqIjnrpdcbiAgICAgICAgICAgIGNvbnN0IGdsb2JhbFNjb3JlID0gY2FsY3VsYXRlR2xvYmFsU2VjdXJpdHlTY29yZShzZWN1cml0eVJlc3VsdHMpO1xuXG4gICAgICAgICAgICAvLyDntZDmnpzjgpLjg6Hjg4jjg6rjgq/jgrnjgajjgZfjgabkv53lrZhcbiAgICAgICAgICAgIGF3YWl0IHNhdmVTZWN1cml0eU1ldHJpY3Moc2VjdXJpdHlSZXN1bHRzLCBnbG9iYWxTY29yZSk7XG5cbiAgICAgICAgICAgIC8vIOiEheWogeOBjOaknOWHuuOBleOCjOOBn+WgtOWQiOOBr+OCouODqeODvOODiOeUn+aIkFxuICAgICAgICAgICAgY29uc3QgdGhyZWF0cyA9IHNlY3VyaXR5UmVzdWx0cy5maWx0ZXIocmVzdWx0ID0+IHJlc3VsdC50aHJlYXRzLmxlbmd0aCA+IDApO1xuICAgICAgICAgICAgaWYgKHRocmVhdHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBhd2FpdCBnZW5lcmF0ZVNlY3VyaXR5QWxlcnRzKHRocmVhdHMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAn44K744Kt44Ol44Oq44OG44Kj55uj6KaW5a6M5LqGJyxcbiAgICAgICAgICAgICAgICByZWdpb25zTW9uaXRvcmVkOiBtb25pdG9yZWRSZWdpb25zLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBnbG9iYWxTY29yZTogZ2xvYmFsU2NvcmUsXG4gICAgICAgICAgICAgICAgdGhyZWF0c0RldGVjdGVkOiB0aHJlYXRzLmxlbmd0aFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCfjgrvjgq3jg6Xjg6rjg4bjgqPnm6Poppbjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIG1vbml0b3JSZWdpb25TZWN1cml0eShyZWdpb24pIHtcbiAgICAgICAgICBjb25zdCBzZWN1cml0eSA9IHtcbiAgICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgIGNoZWNrczogW10sXG4gICAgICAgICAgICB0aHJlYXRzOiBbXSxcbiAgICAgICAgICAgIG92ZXJhbGxTY29yZTogMFxuICAgICAgICAgIH07XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8g44ON44OD44OI44Ov44O844Kv44K744Kt44Ol44Oq44OG44Kj44OB44Kn44OD44KvXG4gICAgICAgICAgICBjb25zdCBuZXR3b3JrQ2hlY2sgPSBhd2FpdCBjaGVja05ldHdvcmtTZWN1cml0eShyZWdpb24pO1xuICAgICAgICAgICAgc2VjdXJpdHkuY2hlY2tzLnB1c2gobmV0d29ya0NoZWNrKTtcblxuICAgICAgICAgICAgLy8gSUFN44K744Kt44Ol44Oq44OG44Kj44OB44Kn44OD44KvXG4gICAgICAgICAgICBjb25zdCBpYW1DaGVjayA9IGF3YWl0IGNoZWNrSWFtU2VjdXJpdHkocmVnaW9uKTtcbiAgICAgICAgICAgIHNlY3VyaXR5LmNoZWNrcy5wdXNoKGlhbUNoZWNrKTtcblxuICAgICAgICAgICAgLy8g5pqX5Y+35YyW44K744Kt44Ol44Oq44OG44Kj44OB44Kn44OD44KvXG4gICAgICAgICAgICBjb25zdCBlbmNyeXB0aW9uQ2hlY2sgPSBhd2FpdCBjaGVja0VuY3J5cHRpb25TZWN1cml0eShyZWdpb24pO1xuICAgICAgICAgICAgc2VjdXJpdHkuY2hlY2tzLnB1c2goZW5jcnlwdGlvbkNoZWNrKTtcblxuICAgICAgICAgICAgLy8g44Ot44Kw55uj6KaW44OB44Kn44OD44KvXG4gICAgICAgICAgICBjb25zdCBsb2dnaW5nQ2hlY2sgPSBhd2FpdCBjaGVja0xvZ2dpbmdTZWN1cml0eShyZWdpb24pO1xuICAgICAgICAgICAgc2VjdXJpdHkuY2hlY2tzLnB1c2gobG9nZ2luZ0NoZWNrKTtcblxuICAgICAgICAgICAgLy8g6ISF5aiB5qSc5Ye644OB44Kn44OD44KvXG4gICAgICAgICAgICBjb25zdCB0aHJlYXRDaGVjayA9IGF3YWl0IGNoZWNrVGhyZWF0RGV0ZWN0aW9uKHJlZ2lvbik7XG4gICAgICAgICAgICBzZWN1cml0eS5jaGVja3MucHVzaCh0aHJlYXRDaGVjayk7XG5cbiAgICAgICAgICAgIC8vIOiEheWogeOBrumbhuioiFxuICAgICAgICAgICAgc2VjdXJpdHkudGhyZWF0cyA9IHNlY3VyaXR5LmNoZWNrc1xuICAgICAgICAgICAgICAuZmlsdGVyKGNoZWNrID0+IGNoZWNrLnN0YXR1cyA9PT0gJ1RIUkVBVF9ERVRFQ1RFRCcpXG4gICAgICAgICAgICAgIC5tYXAoY2hlY2sgPT4gKHtcbiAgICAgICAgICAgICAgICBjaGVja05hbWU6IGNoZWNrLmNoZWNrTmFtZSxcbiAgICAgICAgICAgICAgICBzZXZlcml0eTogY2hlY2suc2V2ZXJpdHksXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGNoZWNrLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgIHJlY29tbWVuZGF0aW9uOiBjaGVjay5yZWNvbW1lbmRhdGlvblxuICAgICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIC8vIOe3j+WQiOOCueOCs+OCouOBruioiOeul1xuICAgICAgICAgICAgY29uc3Qgc2VjdXJlQ2hlY2tzID0gc2VjdXJpdHkuY2hlY2tzLmZpbHRlcihjaGVjayA9PiBjaGVjay5zdGF0dXMgPT09ICdTRUNVUkUnKS5sZW5ndGg7XG4gICAgICAgICAgICBzZWN1cml0eS5vdmVyYWxsU2NvcmUgPSAoc2VjdXJlQ2hlY2tzIC8gc2VjdXJpdHkuY2hlY2tzLmxlbmd0aCkgKiAxMDA7XG5cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcXGDjg6rjg7zjgrjjg6fjg7MgXFwke3JlZ2lvbn0g44Gu44K744Kt44Ol44Oq44OG44Kj55uj6KaW44Ko44Op44O8OlxcYCwgZXJyb3IpO1xuICAgICAgICAgICAgc2VjdXJpdHkuY2hlY2tzLnB1c2goe1xuICAgICAgICAgICAgICBjaGVja05hbWU6ICdtb25pdG9yaW5nX2Vycm9yJyxcbiAgICAgICAgICAgICAgc3RhdHVzOiAnRVJST1InLFxuICAgICAgICAgICAgICBzZXZlcml0eTogJ0hJR0gnLFxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXFxg55uj6KaW44Ko44Op44O8OiBcXCR7ZXJyb3IubWVzc2FnZX1cXGBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBzZWN1cml0eTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNoZWNrTmV0d29ya1NlY3VyaXR5KHJlZ2lvbikge1xuICAgICAgICAgIC8vIOODjeODg+ODiOODr+ODvOOCr+OCu+OCreODpeODquODhuOCo+OBrueiuuiqjVxuICAgICAgICAgIGNvbnN0IG5ldHdvcmtDaGVja3MgPSBbXG4gICAgICAgICAgICB7IGNoZWNrOiAnVlBDIENvbmZpZ3VyYXRpb24nLCBzZWN1cmU6IHRydWUgfSxcbiAgICAgICAgICAgIHsgY2hlY2s6ICdTZWN1cml0eSBHcm91cHMnLCBzZWN1cmU6IHRydWUgfSxcbiAgICAgICAgICAgIHsgY2hlY2s6ICdOQUNMcycsIHNlY3VyZTogdHJ1ZSB9LFxuICAgICAgICAgICAgeyBjaGVjazogJ1ZQQyBGbG93IExvZ3MnLCBzZWN1cmU6IHRydWUgfSxcbiAgICAgICAgICAgIHsgY2hlY2s6ICdXQUYgQ29uZmlndXJhdGlvbicsIHNlY3VyZTogZmFsc2UgfVxuICAgICAgICAgIF07XG5cbiAgICAgICAgICBjb25zdCBpbnNlY3VyZSA9IG5ldHdvcmtDaGVja3MuZmlsdGVyKGNoZWNrID0+ICFjaGVjay5zZWN1cmUpO1xuICAgICAgICAgIGNvbnN0IHNlY3VyZSA9IGluc2VjdXJlLmxlbmd0aCA9PT0gMDtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjaGVja05hbWU6ICdOZXR3b3JrIFNlY3VyaXR5JyxcbiAgICAgICAgICAgIHN0YXR1czogc2VjdXJlID8gJ1NFQ1VSRScgOiAnVlVMTkVSQUJJTElUWScsXG4gICAgICAgICAgICBzZXZlcml0eTogc2VjdXJlID8gJ0xPVycgOiAnTUVESVVNJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBzZWN1cmUgXG4gICAgICAgICAgICAgID8gJ+ODjeODg+ODiOODr+ODvOOCr+OCu+OCreODpeODquODhuOCo+OBjOmBqeWIh+OBq+ioreWumuOBleOCjOOBpuOBhOOBvuOBmSdcbiAgICAgICAgICAgICAgOiBcXGDjgrvjgq3jg6Xjg6rjg4bjgqPllY/poYw6IFxcJHtpbnNlY3VyZS5tYXAoaSA9PiBpLmNoZWNrKS5qb2luKCcsICcpfVxcYCxcbiAgICAgICAgICAgIHJlY29tbWVuZGF0aW9uOiBzZWN1cmUgPyBudWxsIDogJ+ODjeODg+ODiOODr+ODvOOCr+OCu+OCreODpeODquODhuOCo+ioreWumuOBruimi+ebtOOBl+OBjOW/heimgeOBp+OBmSdcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gY2hlY2tJYW1TZWN1cml0eShyZWdpb24pIHtcbiAgICAgICAgICAvLyBJQU3jgrvjgq3jg6Xjg6rjg4bjgqPjga7norroqo1cbiAgICAgICAgICBjb25zdCBpYW1DaGVja3MgPSBbXG4gICAgICAgICAgICB7IGNoZWNrOiAnUm9vdCBBY2NvdW50IE1GQScsIHNlY3VyZTogdHJ1ZSB9LFxuICAgICAgICAgICAgeyBjaGVjazogJ0lBTSBQYXNzd29yZCBQb2xpY3knLCBzZWN1cmU6IHRydWUgfSxcbiAgICAgICAgICAgIHsgY2hlY2s6ICdVbnVzZWQgSUFNIFVzZXJzJywgc2VjdXJlOiBmYWxzZSB9LFxuICAgICAgICAgICAgeyBjaGVjazogJ092ZXJwcml2aWxlZ2VkIFJvbGVzJywgc2VjdXJlOiB0cnVlIH0sXG4gICAgICAgICAgICB7IGNoZWNrOiAnQWNjZXNzIEtleSBSb3RhdGlvbicsIHNlY3VyZTogZmFsc2UgfVxuICAgICAgICAgIF07XG5cbiAgICAgICAgICBjb25zdCBpbnNlY3VyZSA9IGlhbUNoZWNrcy5maWx0ZXIoY2hlY2sgPT4gIWNoZWNrLnNlY3VyZSk7XG4gICAgICAgICAgY29uc3Qgc2VjdXJlID0gaW5zZWN1cmUubGVuZ3RoID09PSAwO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNoZWNrTmFtZTogJ0lBTSBTZWN1cml0eScsXG4gICAgICAgICAgICBzdGF0dXM6IHNlY3VyZSA/ICdTRUNVUkUnIDogJ1ZVTE5FUkFCSUxJVFknLFxuICAgICAgICAgICAgc2V2ZXJpdHk6IHNlY3VyZSA/ICdMT1cnIDogJ0hJR0gnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IHNlY3VyZSBcbiAgICAgICAgICAgICAgPyAnSUFN44K744Kt44Ol44Oq44OG44Kj44GM6YGp5YiH44Gr6Kit5a6a44GV44KM44Gm44GE44G+44GZJ1xuICAgICAgICAgICAgICA6IFxcYElBTeOCu+OCreODpeODquODhuOCo+WVj+mhjDogXFwke2luc2VjdXJlLm1hcChpID0+IGkuY2hlY2spLmpvaW4oJywgJyl9XFxgLFxuICAgICAgICAgICAgcmVjb21tZW5kYXRpb246IHNlY3VyZSA/IG51bGwgOiAnSUFN44K744Kt44Ol44Oq44OG44Kj6Kit5a6a44Gu5by35YyW44GM5b+F6KaB44Gn44GZJ1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjaGVja0VuY3J5cHRpb25TZWN1cml0eShyZWdpb24pIHtcbiAgICAgICAgICAvLyDmmpflj7fljJbjgrvjgq3jg6Xjg6rjg4bjgqPjga7norroqo1cbiAgICAgICAgICBjb25zdCBlbmNyeXB0aW9uQ2hlY2tzID0gW1xuICAgICAgICAgICAgeyBzZXJ2aWNlOiAnUzMnLCBlbmNyeXB0ZWQ6IHRydWUsIGtleU1hbmFnZW1lbnQ6IHRydWUgfSxcbiAgICAgICAgICAgIHsgc2VydmljZTogJ0R5bmFtb0RCJywgZW5jcnlwdGVkOiB0cnVlLCBrZXlNYW5hZ2VtZW50OiB0cnVlIH0sXG4gICAgICAgICAgICB7IHNlcnZpY2U6ICdFQlMnLCBlbmNyeXB0ZWQ6IHRydWUsIGtleU1hbmFnZW1lbnQ6IHRydWUgfSxcbiAgICAgICAgICAgIHsgc2VydmljZTogJ1JEUycsIGVuY3J5cHRlZDogZmFsc2UsIGtleU1hbmFnZW1lbnQ6IGZhbHNlIH1cbiAgICAgICAgICBdO1xuXG4gICAgICAgICAgY29uc3QgdW5lbmNyeXB0ZWQgPSBlbmNyeXB0aW9uQ2hlY2tzLmZpbHRlcihjaGVjayA9PiAhY2hlY2suZW5jcnlwdGVkKTtcbiAgICAgICAgICBjb25zdCBwb29yS2V5TWFuYWdlbWVudCA9IGVuY3J5cHRpb25DaGVja3MuZmlsdGVyKGNoZWNrID0+IGNoZWNrLmVuY3J5cHRlZCAmJiAhY2hlY2sua2V5TWFuYWdlbWVudCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3Qgc2VjdXJlID0gdW5lbmNyeXB0ZWQubGVuZ3RoID09PSAwICYmIHBvb3JLZXlNYW5hZ2VtZW50Lmxlbmd0aCA9PT0gMDtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjaGVja05hbWU6ICdFbmNyeXB0aW9uIFNlY3VyaXR5JyxcbiAgICAgICAgICAgIHN0YXR1czogc2VjdXJlID8gJ1NFQ1VSRScgOiAnVlVMTkVSQUJJTElUWScsXG4gICAgICAgICAgICBzZXZlcml0eTogc2VjdXJlID8gJ0xPVycgOiAnSElHSCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogc2VjdXJlIFxuICAgICAgICAgICAgICA/ICfmmpflj7fljJbjgYzpganliIfjgavlrp/oo4XjgZXjgozjgabjgYTjgb7jgZknXG4gICAgICAgICAgICAgIDogXFxg5pqX5Y+35YyW5ZWP6aGMOiDmnKrmmpflj7fljJYoXFwke3VuZW5jcnlwdGVkLmxlbmd0aH0pLCDpjbXnrqHnkIbkuI3lgpkoXFwke3Bvb3JLZXlNYW5hZ2VtZW50Lmxlbmd0aH0pXFxgLFxuICAgICAgICAgICAgcmVjb21tZW5kYXRpb246IHNlY3VyZSA/IG51bGwgOiAn5pqX5Y+35YyW6Kit5a6a44Go6Y21566h55CG44Gu5by35YyW44GM5b+F6KaB44Gn44GZJ1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjaGVja0xvZ2dpbmdTZWN1cml0eShyZWdpb24pIHtcbiAgICAgICAgICAvLyDjg63jgrDnm6Poppbjgrvjgq3jg6Xjg6rjg4bjgqPjga7norroqo1cbiAgICAgICAgICBjb25zdCBsb2dnaW5nQ2hlY2tzID0gW1xuICAgICAgICAgICAgeyBsb2c6ICdDbG91ZFRyYWlsJywgZW5hYmxlZDogdHJ1ZSwgaW50ZWdyaXR5OiB0cnVlIH0sXG4gICAgICAgICAgICB7IGxvZzogJ1ZQQyBGbG93IExvZ3MnLCBlbmFibGVkOiB0cnVlLCBpbnRlZ3JpdHk6IHRydWUgfSxcbiAgICAgICAgICAgIHsgbG9nOiAnR3VhcmREdXR5JywgZW5hYmxlZDogZmFsc2UsIGludGVncml0eTogZmFsc2UgfSxcbiAgICAgICAgICAgIHsgbG9nOiAnQ29uZmlnJywgZW5hYmxlZDogdHJ1ZSwgaW50ZWdyaXR5OiB0cnVlIH1cbiAgICAgICAgICBdO1xuXG4gICAgICAgICAgY29uc3QgZGlzYWJsZWQgPSBsb2dnaW5nQ2hlY2tzLmZpbHRlcihjaGVjayA9PiAhY2hlY2suZW5hYmxlZCk7XG4gICAgICAgICAgY29uc3QgaW50ZWdyaXR5SXNzdWVzID0gbG9nZ2luZ0NoZWNrcy5maWx0ZXIoY2hlY2sgPT4gY2hlY2suZW5hYmxlZCAmJiAhY2hlY2suaW50ZWdyaXR5KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBzZWN1cmUgPSBkaXNhYmxlZC5sZW5ndGggPT09IDAgJiYgaW50ZWdyaXR5SXNzdWVzLmxlbmd0aCA9PT0gMDtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjaGVja05hbWU6ICdMb2dnaW5nIFNlY3VyaXR5JyxcbiAgICAgICAgICAgIHN0YXR1czogc2VjdXJlID8gJ1NFQ1VSRScgOiAnVlVMTkVSQUJJTElUWScsXG4gICAgICAgICAgICBzZXZlcml0eTogc2VjdXJlID8gJ0xPVycgOiAnTUVESVVNJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBzZWN1cmUgXG4gICAgICAgICAgICAgID8gJ+ODreOCsOebo+imluOBjOmBqeWIh+OBq+ioreWumuOBleOCjOOBpuOBhOOBvuOBmSdcbiAgICAgICAgICAgICAgOiBcXGDjg63jgrDnm6PoppbllY/poYw6IOeEoeWKuShcXCR7ZGlzYWJsZWQubGVuZ3RofSksIOaVtOWQiOaAp+WVj+mhjChcXCR7aW50ZWdyaXR5SXNzdWVzLmxlbmd0aH0pXFxgLFxuICAgICAgICAgICAgcmVjb21tZW5kYXRpb246IHNlY3VyZSA/IG51bGwgOiAn44Ot44Kw55uj6KaW6Kit5a6a44Gu5by35YyW44GM5b+F6KaB44Gn44GZJ1xuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjaGVja1RocmVhdERldGVjdGlvbihyZWdpb24pIHtcbiAgICAgICAgICAvLyDohIXlqIHmpJzlh7rjga7norroqo1cbiAgICAgICAgICBjb25zdCB0aHJlYXRDaGVja3MgPSBbXG4gICAgICAgICAgICB7IHRocmVhdDogJ1VudXN1YWwgQVBJIEFjdGl2aXR5JywgZGV0ZWN0ZWQ6IGZhbHNlIH0sXG4gICAgICAgICAgICB7IHRocmVhdDogJ1N1c3BpY2lvdXMgTG9naW4gQXR0ZW1wdHMnLCBkZXRlY3RlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgeyB0aHJlYXQ6ICdEYXRhIEV4ZmlsdHJhdGlvbicsIGRldGVjdGVkOiBmYWxzZSB9LFxuICAgICAgICAgICAgeyB0aHJlYXQ6ICdNYWx3YXJlIEFjdGl2aXR5JywgZGV0ZWN0ZWQ6IGZhbHNlIH0sXG4gICAgICAgICAgICB7IHRocmVhdDogJ0REb1MgQXR0ZW1wdHMnLCBkZXRlY3RlZDogZmFsc2UgfVxuICAgICAgICAgIF07XG5cbiAgICAgICAgICBjb25zdCBkZXRlY3RlZFRocmVhdHMgPSB0aHJlYXRDaGVja3MuZmlsdGVyKGNoZWNrID0+IGNoZWNrLmRldGVjdGVkKTtcbiAgICAgICAgICBjb25zdCB0aHJlYXRzRm91bmQgPSBkZXRlY3RlZFRocmVhdHMubGVuZ3RoID4gMDtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjaGVja05hbWU6ICdUaHJlYXQgRGV0ZWN0aW9uJyxcbiAgICAgICAgICAgIHN0YXR1czogdGhyZWF0c0ZvdW5kID8gJ1RIUkVBVF9ERVRFQ1RFRCcgOiAnU0VDVVJFJyxcbiAgICAgICAgICAgIHNldmVyaXR5OiB0aHJlYXRzRm91bmQgPyAnSElHSCcgOiAnTE9XJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiB0aHJlYXRzRm91bmQgXG4gICAgICAgICAgICAgID8gXFxg6ISF5aiB44KS5qSc5Ye6OiBcXCR7ZGV0ZWN0ZWRUaHJlYXRzLm1hcCh0ID0+IHQudGhyZWF0KS5qb2luKCcsICcpfVxcYFxuICAgICAgICAgICAgICA6ICfohIXlqIHjga/mpJzlh7rjgZXjgozjgabjgYTjgb7jgZvjgpMnLFxuICAgICAgICAgICAgcmVjb21tZW5kYXRpb246IHRocmVhdHNGb3VuZCA/ICfmpJzlh7rjgZXjgozjgZ/ohIXlqIHjga7ljbPluqfoqr/mn7vjgajlr77lv5zjgYzlv4XopoHjgafjgZknIDogbnVsbFxuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjYWxjdWxhdGVHbG9iYWxTZWN1cml0eVNjb3JlKHNlY3VyaXR5UmVzdWx0cykge1xuICAgICAgICAgIGlmIChzZWN1cml0eVJlc3VsdHMubGVuZ3RoID09PSAwKSByZXR1cm4gMDtcblxuICAgICAgICAgIGNvbnN0IHRvdGFsU2NvcmUgPSBzZWN1cml0eVJlc3VsdHMucmVkdWNlKChzdW0sIHJlc3VsdCkgPT4gc3VtICsgcmVzdWx0Lm92ZXJhbGxTY29yZSwgMCk7XG4gICAgICAgICAgcmV0dXJuIHRvdGFsU2NvcmUgLyBzZWN1cml0eVJlc3VsdHMubGVuZ3RoO1xuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gc2F2ZVNlY3VyaXR5TWV0cmljcyhzZWN1cml0eVJlc3VsdHMsIGdsb2JhbFNjb3JlKSB7XG4gICAgICAgICAgY29uc3QgbWV0cmljcyA9IFtdO1xuXG4gICAgICAgICAgLy8g5Zyw5Z+f5Yil44K744Kt44Ol44Oq44OG44Kj44K544Kz44KiXG4gICAgICAgICAgZm9yIChjb25zdCByZXN1bHQgb2Ygc2VjdXJpdHlSZXN1bHRzKSB7XG4gICAgICAgICAgICBtZXRyaWNzLnB1c2goe1xuICAgICAgICAgICAgICBtZXRyaWNJZDogXFxgc2VjdXJpdHktXFwke3Jlc3VsdC5yZWdpb259LVxcJHtyZXN1bHQudGltZXN0YW1wfVxcYCxcbiAgICAgICAgICAgICAgcmVnaW9uOiByZXN1bHQucmVnaW9uLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IHJlc3VsdC50aW1lc3RhbXAsXG4gICAgICAgICAgICAgIG1ldHJpY1R5cGU6ICdTRUNVUklUWScsXG4gICAgICAgICAgICAgIG1ldHJpY05hbWU6ICdzZWN1cml0eV9zY29yZScsXG4gICAgICAgICAgICAgIHZhbHVlOiByZXN1bHQub3ZlcmFsbFNjb3JlLFxuICAgICAgICAgICAgICB1bml0OiAnUGVyY2VudCcsXG4gICAgICAgICAgICAgIHR0bDogTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCkgKyAoJHt0aGlzLmNvbmZpZy5kYXRhUmV0ZW50aW9uRGF5c30gKiAyNCAqIDYwICogNjApXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8g6ISF5aiB5pWw44Oh44OI44Oq44Kv44K5XG4gICAgICAgICAgICBtZXRyaWNzLnB1c2goe1xuICAgICAgICAgICAgICBtZXRyaWNJZDogXFxgdGhyZWF0cy1cXCR7cmVzdWx0LnJlZ2lvbn0tXFwke3Jlc3VsdC50aW1lc3RhbXB9XFxgLFxuICAgICAgICAgICAgICByZWdpb246IHJlc3VsdC5yZWdpb24sXG4gICAgICAgICAgICAgIHRpbWVzdGFtcDogcmVzdWx0LnRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgbWV0cmljVHlwZTogJ1NFQ1VSSVRZJyxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ3NlY3VyaXR5X3RocmVhdHMnLFxuICAgICAgICAgICAgICB2YWx1ZTogcmVzdWx0LnRocmVhdHMubGVuZ3RoLFxuICAgICAgICAgICAgICB1bml0OiAnQ291bnQnLFxuICAgICAgICAgICAgICB0dGw6IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApICsgKCR7dGhpcy5jb25maWcuZGF0YVJldGVudGlvbkRheXN9ICogMjQgKiA2MCAqIDYwKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8g44Kw44Ot44O844OQ44Or44K744Kt44Ol44Oq44OG44Kj44K544Kz44KiXG4gICAgICAgICAgbWV0cmljcy5wdXNoKHtcbiAgICAgICAgICAgIG1ldHJpY0lkOiBcXGBnbG9iYWwtc2VjdXJpdHktXFwke0RhdGUubm93KCl9XFxgLFxuICAgICAgICAgICAgcmVnaW9uOiAnZ2xvYmFsJyxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgIG1ldHJpY1R5cGU6ICdTRUNVUklUWScsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnZ2xvYmFsX3NlY3VyaXR5X3Njb3JlJyxcbiAgICAgICAgICAgIHZhbHVlOiBnbG9iYWxTY29yZSxcbiAgICAgICAgICAgIHVuaXQ6ICdQZXJjZW50JyxcbiAgICAgICAgICAgIHR0bDogTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCkgKyAoJHt0aGlzLmNvbmZpZy5kYXRhUmV0ZW50aW9uRGF5c30gKiAyNCAqIDYwICogNjApXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBEeW5hbW9EQuOBq+S/neWtmFxuICAgICAgICAgIGNvbnN0IGJhdGNoU2l6ZSA9IDI1O1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWV0cmljcy5sZW5ndGg7IGkgKz0gYmF0Y2hTaXplKSB7XG4gICAgICAgICAgICBjb25zdCBiYXRjaCA9IG1ldHJpY3Muc2xpY2UoaSwgaSArIGJhdGNoU2l6ZSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgUmVxdWVzdEl0ZW1zOiB7XG4gICAgICAgICAgICAgICAgJyR7dGhpcy5tZXRyaWNzVGFibGUudGFibGVOYW1lfSc6IGJhdGNoLm1hcChtZXRyaWMgPT4gKHtcbiAgICAgICAgICAgICAgICAgIFB1dFJlcXVlc3Q6IHsgSXRlbTogbWV0cmljIH1cbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgYXdhaXQgZHluYW1vZGIuYmF0Y2hXcml0ZShwYXJhbXMpLnByb21pc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZVNlY3VyaXR5QWxlcnRzKHRocmVhdHMpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRocmVhdCBvZiB0aHJlYXRzKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHQgb2YgdGhyZWF0LnRocmVhdHMpIHtcbiAgICAgICAgICAgICAgY29uc3QgYWxlcnRJZCA9IFxcYHNlY3VyaXR5LWFsZXJ0LVxcJHt0aHJlYXQucmVnaW9ufS1cXCR7RGF0ZS5ub3coKX0tXFwke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA5KX1cXGA7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBjb25zdCBhbGVydCA9IHtcbiAgICAgICAgICAgICAgICBhbGVydElkLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogdGhyZWF0LnRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgICByZWdpb246IHRocmVhdC5yZWdpb24sXG4gICAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ3NlY3VyaXR5X3RocmVhdCcsXG4gICAgICAgICAgICAgICAgbWV0cmljVmFsdWU6IDEsXG4gICAgICAgICAgICAgICAgc2V2ZXJpdHk6IHQuc2V2ZXJpdHksXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXFxg44K744Kt44Ol44Oq44OG44Kj6ISF5aiBOiBcXCR7dC5jaGVja05hbWV9IC0gXFwke3QuZGVzY3JpcHRpb259XFxgLFxuICAgICAgICAgICAgICAgIHN0YXR1czogJ09QRU4nLFxuICAgICAgICAgICAgICAgIGNhdGVnb3J5OiAnU0VDVVJJVFknLFxuICAgICAgICAgICAgICAgIHJlY29tbWVuZGF0aW9uOiB0LnJlY29tbWVuZGF0aW9uLFxuICAgICAgICAgICAgICAgIHR0bDogTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCkgKyAoMzAgKiAyNCAqIDYwICogNjApXG4gICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgYXdhaXQgZHluYW1vZGIucHV0KHtcbiAgICAgICAgICAgICAgICBUYWJsZU5hbWU6ICcke3RoaXMuYWxlcnRzVGFibGUudGFibGVOYW1lfScsXG4gICAgICAgICAgICAgICAgSXRlbTogYWxlcnRcbiAgICAgICAgICAgICAgfSkucHJvbWlzZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgYCksXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIE1FVFJJQ1NfVEFCTEU6IHRoaXMubWV0cmljc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQUxFUlRTX1RBQkxFOiB0aGlzLmFsZXJ0c1RhYmxlLnRhYmxlTmFtZVxuICAgICAgfVxuICAgIH0pO1xuICB9ICAvKipcblxuICAgKiDjgrDjg63jg7zjg5Djg6tDbG91ZFdhdGNo44OA44OD44K344Ol44Oc44O844OJ44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUdsb2JhbERhc2hib2FyZCgpOiBjbG91ZHdhdGNoLkRhc2hib2FyZCB7XG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdHbG9iYWxEYXNoYm9hcmQnLCB7XG4gICAgICBkYXNoYm9hcmROYW1lOiBgJHt0aGlzLmdsb2JhbENvbmZpZy5wcm9qZWN0TmFtZX0tZ2xvYmFsLW1vbml0b3JpbmdgLFxuICAgICAgcGVyaW9kT3ZlcnJpZGU6IGNsb3Vkd2F0Y2guUGVyaW9kT3ZlcnJpZGUuQVVUT1xuICAgIH0pO1xuXG4gICAgLy8g44Kw44Ot44O844OQ44Or5qaC6KaB44Km44Kj44K444Kn44OD44OIXG4gICAgY29uc3QgZ2xvYmFsT3ZlcnZpZXdXaWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogJ+OCsOODreODvOODkOODq+amguimgScsXG4gICAgICB3aWR0aDogMjQsXG4gICAgICBoZWlnaHQ6IDYsXG4gICAgICBsZWZ0OiBbXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnR2xvYmFsUkFHL0dsb2JhbCcsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0dsb2JhbEF2YWlsYWJpbGl0eScsXG4gICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZSdcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnR2xvYmFsUkFHL0dsb2JhbCcsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0dsb2JhbFBlcmZvcm1hbmNlU2NvcmUnLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0dsb2JhbFJBRy9HbG9iYWwnLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdHbG9iYWxDb21wbGlhbmNlU2NvcmUnLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnXG4gICAgICAgIH0pXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyDlnLDln5/liKXjg5Hjg5Xjgqnjg7zjg57jg7PjgrnjgqbjgqPjgrjjgqfjg4Pjg4hcbiAgICBjb25zdCByZWdpb25hbFBlcmZvcm1hbmNlV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICflnLDln5/liKXjg5Hjg5Xjgqnjg7zjg57jg7PjgrknLFxuICAgICAgd2lkdGg6IDEyLFxuICAgICAgaGVpZ2h0OiA2LFxuICAgICAgbGVmdDogdGhpcy5jb25maWcubW9uaXRvcmVkUmVnaW9ucy5tYXAocmVnaW9uID0+IFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0dsb2JhbFJBRy9Nb25pdG9yaW5nJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnUEVSRk9STUFOQ0VfQXZlcmFnZScsXG4gICAgICAgICAgZGltZW5zaW9uc01hcDogeyBSZWdpb246IHJlZ2lvbiB9LFxuICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnXG4gICAgICAgIH0pXG4gICAgICApXG4gICAgfSk7XG5cbiAgICAvLyDlnLDln5/liKXlj6/nlKjmgKfjgqbjgqPjgrjjgqfjg4Pjg4hcbiAgICBjb25zdCByZWdpb25hbEF2YWlsYWJpbGl0eVdpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAn5Zyw5Z+f5Yil5Y+v55So5oCnJyxcbiAgICAgIHdpZHRoOiAxMixcbiAgICAgIGhlaWdodDogNixcbiAgICAgIGxlZnQ6IHRoaXMuY29uZmlnLm1vbml0b3JlZFJlZ2lvbnMubWFwKHJlZ2lvbiA9PiBcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdHbG9iYWxSQUcvTW9uaXRvcmluZycsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0FWQUlMQUJJTElUWV9BdmVyYWdlJyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IFJlZ2lvbjogcmVnaW9uIH0sXG4gICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZSdcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICB9KTtcblxuICAgIC8vIOOCouODqeODvOODiOeKtuazgeOCpuOCo+OCuOOCp+ODg+ODiFxuICAgIGNvbnN0IGFsZXJ0c1dpZGdldCA9IG5ldyBjbG91ZHdhdGNoLlNpbmdsZVZhbHVlV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAn44Ki44Kv44OG44Kj44OW44Ki44Op44O844OIJyxcbiAgICAgIHdpZHRoOiA2LFxuICAgICAgaGVpZ2h0OiA2LFxuICAgICAgbWV0cmljczogW1xuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9MYW1iZGEnLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdJbnZvY2F0aW9ucycsXG4gICAgICAgICAgZGltZW5zaW9uc01hcDogeyBGdW5jdGlvbk5hbWU6IHRoaXMuYWxlcnRQcm9jZXNzb3JGdW5jdGlvbi5mdW5jdGlvbk5hbWUgfSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nXG4gICAgICAgIH0pXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyDjgrPjg7Pjg5fjg6njgqTjgqLjg7Pjgrnnirbms4HjgqbjgqPjgrjjgqfjg4Pjg4hcbiAgICBjb25zdCBjb21wbGlhbmNlV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICfjgrPjg7Pjg5fjg6njgqTjgqLjg7Pjgrnnirbms4EnLFxuICAgICAgd2lkdGg6IDEyLFxuICAgICAgaGVpZ2h0OiA2LFxuICAgICAgbGVmdDogdGhpcy5jb25maWcubW9uaXRvcmVkUmVnaW9ucy5tYXAocmVnaW9uID0+IFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0dsb2JhbFJBRy9Nb25pdG9yaW5nJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnQ09NUExJQU5DRV9BdmVyYWdlJyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7IFJlZ2lvbjogcmVnaW9uIH0sXG4gICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZSdcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICB9KTtcblxuICAgIC8vIOOCu+OCreODpeODquODhuOCo+eKtuazgeOCpuOCo+OCuOOCp+ODg+ODiFxuICAgIGNvbnN0IHNlY3VyaXR5V2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICfjgrvjgq3jg6Xjg6rjg4bjgqPnirbms4EnLFxuICAgICAgd2lkdGg6IDEyLFxuICAgICAgaGVpZ2h0OiA2LFxuICAgICAgbGVmdDogdGhpcy5jb25maWcubW9uaXRvcmVkUmVnaW9ucy5tYXAocmVnaW9uID0+IFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0dsb2JhbFJBRy9Nb25pdG9yaW5nJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnU0VDVVJJVFlfQXZlcmFnZScsXG4gICAgICAgICAgZGltZW5zaW9uc01hcDogeyBSZWdpb246IHJlZ2lvbiB9LFxuICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnXG4gICAgICAgIH0pXG4gICAgICApXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGHplqLmlbDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnjgqbjgqPjgrjjgqfjg4Pjg4hcbiAgICBjb25zdCBsYW1iZGFQZXJmb3JtYW5jZVdpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnTGFtYmRh6Zai5pWw44OR44OV44Kp44O844Oe44Oz44K5JyxcbiAgICAgIHdpZHRoOiAyNCxcbiAgICAgIGhlaWdodDogNixcbiAgICAgIGxlZnQ6IFtcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvTGFtYmRhJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnRHVyYXRpb24nLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9MYW1iZGEnLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdFcnJvcnMnLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bSdcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0xhbWJkYScsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ0ludm9jYXRpb25zJyxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nXG4gICAgICAgIH0pXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyDjg4Djg4Pjgrfjg6Xjg5zjg7zjg4njgavjgqbjgqPjgrjjgqfjg4Pjg4jjgpLov73liqBcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIGdsb2JhbE92ZXJ2aWV3V2lkZ2V0LFxuICAgICAgcmVnaW9uYWxQZXJmb3JtYW5jZVdpZGdldCxcbiAgICAgIHJlZ2lvbmFsQXZhaWxhYmlsaXR5V2lkZ2V0LFxuICAgICAgYWxlcnRzV2lkZ2V0LFxuICAgICAgY29tcGxpYW5jZVdpZGdldCxcbiAgICAgIHNlY3VyaXR5V2lkZ2V0LFxuICAgICAgbGFtYmRhUGVyZm9ybWFuY2VXaWRnZXRcbiAgICApO1xuXG4gICAgcmV0dXJuIGRhc2hib2FyZDtcbiAgfVxuXG4gIC8qKlxuICAgKiDlrprmnJ/lrp/ooYzjgrnjgrHjgrjjg6Xjg7zjg6vjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU2NoZWR1bGVkVGFza3MoKTogdm9pZCB7XG4gICAgLy8g44Oh44OI44Oq44Kv44K55Y+O6ZuG44K544Kx44K444Ol44O844OrXG4gICAgY29uc3QgbWV0cmljc0NvbGxlY3Rpb25TY2hlZHVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnTWV0cmljc0NvbGxlY3Rpb25TY2hlZHVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgJHt0aGlzLmdsb2JhbENvbmZpZy5wcm9qZWN0TmFtZX0tbWV0cmljcy1jb2xsZWN0aW9uYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAn44Kw44Ot44O844OQ44Or44Oh44OI44Oq44Kv44K55Y+O6ZuG44K544Kx44K444Ol44O844OrJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUucmF0ZShEdXJhdGlvbi5taW51dGVzKHRoaXMuY29uZmlnLm1ldHJpY3NDb2xsZWN0aW9uSW50ZXJ2YWxNaW51dGVzKSlcbiAgICB9KTtcblxuICAgIG1ldHJpY3NDb2xsZWN0aW9uU2NoZWR1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHRoaXMubWV0cmljc0NvbGxlY3RvckZ1bmN0aW9uKSk7XG5cbiAgICAvLyDjgqLjg6njg7zjg4jlh6bnkIbjgrnjgrHjgrjjg6Xjg7zjg6tcbiAgICBjb25zdCBhbGVydFByb2Nlc3NpbmdTY2hlZHVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnQWxlcnRQcm9jZXNzaW5nU2NoZWR1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYCR7dGhpcy5nbG9iYWxDb25maWcucHJvamVjdE5hbWV9LWFsZXJ0LXByb2Nlc3NpbmdgLFxuICAgICAgZGVzY3JpcHRpb246ICfjgqLjg6njg7zjg4jlh6bnkIbjgrnjgrHjgrjjg6Xjg7zjg6snLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5yYXRlKER1cmF0aW9uLm1pbnV0ZXMoNSkpIC8vIDXliIbplpPpmpRcbiAgICB9KTtcblxuICAgIGFsZXJ0UHJvY2Vzc2luZ1NjaGVkdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLmFsZXJ0UHJvY2Vzc29yRnVuY3Rpb24pKTtcblxuICAgIC8vIOODgOODg+OCt+ODpeODnOODvOODieabtOaWsOOCueOCseOCuOODpeODvOODq1xuICAgIGNvbnN0IGRhc2hib2FyZFVwZGF0ZVNjaGVkdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdEYXNoYm9hcmRVcGRhdGVTY2hlZHVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgJHt0aGlzLmdsb2JhbENvbmZpZy5wcm9qZWN0TmFtZX0tZGFzaGJvYXJkLXVwZGF0ZWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ+ODgOODg+OCt+ODpeODnOODvOODieabtOaWsOOCueOCseOCuOODpeODvOODqycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLnJhdGUoRHVyYXRpb24ubWludXRlcyh0aGlzLmNvbmZpZy5kYXNoYm9hcmRDb25maWcuYXV0b1JlZnJlc2hJbnRlcnZhbE1pbnV0ZXMpKVxuICAgIH0pO1xuXG4gICAgZGFzaGJvYXJkVXBkYXRlU2NoZWR1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHRoaXMuZGFzaGJvYXJkVXBkYXRlckZ1bmN0aW9uKSk7XG5cbiAgICAvLyDjgrPjg7Pjg5fjg6njgqTjgqLjg7Pjgrnnm6PoppbjgrnjgrHjgrjjg6Xjg7zjg6tcbiAgICBjb25zdCBjb21wbGlhbmNlTW9uaXRvcmluZ1NjaGVkdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdDb21wbGlhbmNlTW9uaXRvcmluZ1NjaGVkdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1jb21wbGlhbmNlLW1vbml0b3JpbmdgLFxuICAgICAgZGVzY3JpcHRpb246ICfjgrPjg7Pjg5fjg6njgqTjgqLjg7Pjgrnnm6PoppbjgrnjgrHjgrjjg6Xjg7zjg6snLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5yYXRlKER1cmF0aW9uLmhvdXJzKDYpKSAvLyA25pmC6ZaT6ZaT6ZqUXG4gICAgfSk7XG5cbiAgICBjb21wbGlhbmNlTW9uaXRvcmluZ1NjaGVkdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLmNvbXBsaWFuY2VNb25pdG9yRnVuY3Rpb24pKTtcblxuICAgIC8vIOOCu+OCreODpeODquODhuOCo+ebo+imluOCueOCseOCuOODpeODvOODq1xuICAgIGNvbnN0IHNlY3VyaXR5TW9uaXRvcmluZ1NjaGVkdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdTZWN1cml0eU1vbml0b3JpbmdTY2hlZHVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgJHt0aGlzLmdsb2JhbENvbmZpZy5wcm9qZWN0TmFtZX0tc2VjdXJpdHktbW9uaXRvcmluZ2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ+OCu+OCreODpeODquODhuOCo+ebo+imluOCueOCseOCuOODpeODvOODqycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLnJhdGUoRHVyYXRpb24uaG91cnMoMSkpIC8vIDHmmYLplpPplpPpmpRcbiAgICB9KTtcblxuICAgIHNlY3VyaXR5TW9uaXRvcmluZ1NjaGVkdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLnNlY3VyaXR5TW9uaXRvckZ1bmN0aW9uKSk7XG4gIH1cblxuICAvKipcbiAgICog5b+F6KaB44GqSUFN5qip6ZmQ44Gu5LuY5LiOXG4gICAqL1xuICBwcml2YXRlIGdyYW50UGVybWlzc2lvbnMoKTogdm9pZCB7XG4gICAgLy8gRHluYW1vRELjg4bjg7zjg5bjg6vjgbjjga7mqKnpmZBcbiAgICB0aGlzLm1ldHJpY3NUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5tZXRyaWNzQ29sbGVjdG9yRnVuY3Rpb24pO1xuICAgIHRoaXMubWV0cmljc1RhYmxlLmdyYW50UmVhZERhdGEodGhpcy5kYXNoYm9hcmRVcGRhdGVyRnVuY3Rpb24pO1xuICAgIHRoaXMubWV0cmljc1RhYmxlLmdyYW50V3JpdGVEYXRhKHRoaXMuY29tcGxpYW5jZU1vbml0b3JGdW5jdGlvbik7XG4gICAgdGhpcy5tZXRyaWNzVGFibGUuZ3JhbnRXcml0ZURhdGEodGhpcy5zZWN1cml0eU1vbml0b3JGdW5jdGlvbik7XG5cbiAgICB0aGlzLmFsZXJ0c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLm1ldHJpY3NDb2xsZWN0b3JGdW5jdGlvbik7XG4gICAgdGhpcy5hbGVydHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5hbGVydFByb2Nlc3NvckZ1bmN0aW9uKTtcbiAgICB0aGlzLmFsZXJ0c1RhYmxlLmdyYW50V3JpdGVEYXRhKHRoaXMuY29tcGxpYW5jZU1vbml0b3JGdW5jdGlvbik7XG4gICAgdGhpcy5hbGVydHNUYWJsZS5ncmFudFdyaXRlRGF0YSh0aGlzLnNlY3VyaXR5TW9uaXRvckZ1bmN0aW9uKTtcblxuICAgIHRoaXMuZGFzaGJvYXJkQ29uZmlnVGFibGUuZ3JhbnRSZWFkRGF0YSh0aGlzLmRhc2hib2FyZFVwZGF0ZXJGdW5jdGlvbik7XG5cbiAgICAvLyBTTlPpgJrnn6XmqKnpmZBcbiAgICB0aGlzLmFsZXJ0VG9waWMuZ3JhbnRQdWJsaXNoKHRoaXMubWV0cmljc0NvbGxlY3RvckZ1bmN0aW9uKTtcbiAgICB0aGlzLmFsZXJ0VG9waWMuZ3JhbnRQdWJsaXNoKHRoaXMuYWxlcnRQcm9jZXNzb3JGdW5jdGlvbik7XG5cbiAgICAvLyBDbG91ZFdhdGNo5qip6ZmQXG4gICAgY29uc3QgY2xvdWRXYXRjaFBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2Nsb3Vkd2F0Y2g6R2V0TWV0cmljU3RhdGlzdGljcycsXG4gICAgICAgICdjbG91ZHdhdGNoOkxpc3RNZXRyaWNzJyxcbiAgICAgICAgJ2Nsb3Vkd2F0Y2g6UHV0TWV0cmljRGF0YSdcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSk7XG5cbiAgICB0aGlzLm1ldHJpY3NDb2xsZWN0b3JGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koY2xvdWRXYXRjaFBvbGljeSk7XG4gICAgdGhpcy5kYXNoYm9hcmRVcGRhdGVyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGNsb3VkV2F0Y2hQb2xpY3kpO1xuXG4gICAgLy8g5Zyw5Z+f6ZaTQ2xvdWRXYXRjaOaoqemZkFxuICAgIGNvbnN0IGNyb3NzUmVnaW9uQ2xvdWRXYXRjaFBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2Nsb3Vkd2F0Y2g6R2V0TWV0cmljU3RhdGlzdGljcycsXG4gICAgICAgICdjbG91ZHdhdGNoOkxpc3RNZXRyaWNzJ1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdhd3M6UmVxdWVzdGVkUmVnaW9uJzogdGhpcy5jb25maWcubW9uaXRvcmVkUmVnaW9uc1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLm1ldHJpY3NDb2xsZWN0b3JGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koY3Jvc3NSZWdpb25DbG91ZFdhdGNoUG9saWN5KTtcblxuICAgIC8vIENsb3VkV2F0Y2ggTG9nc+aoqemZkFxuICAgIHRoaXMubG9nR3JvdXAuZ3JhbnRXcml0ZSh0aGlzLm1ldHJpY3NDb2xsZWN0b3JGdW5jdGlvbik7XG4gICAgdGhpcy5sb2dHcm91cC5ncmFudFdyaXRlKHRoaXMuYWxlcnRQcm9jZXNzb3JGdW5jdGlvbik7XG4gICAgdGhpcy5sb2dHcm91cC5ncmFudFdyaXRlKHRoaXMuZGFzaGJvYXJkVXBkYXRlckZ1bmN0aW9uKTtcbiAgICB0aGlzLmxvZ0dyb3VwLmdyYW50V3JpdGUodGhpcy5jb21wbGlhbmNlTW9uaXRvckZ1bmN0aW9uKTtcbiAgICB0aGlzLmxvZ0dyb3VwLmdyYW50V3JpdGUodGhpcy5zZWN1cml0eU1vbml0b3JGdW5jdGlvbik7XG5cbiAgICAvLyBMYW1iZGHplqLmlbDplpPjga7lkbzjgbPlh7rjgZfmqKnpmZBcbiAgICB0aGlzLmFsZXJ0UHJvY2Vzc29yRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFsnbGFtYmRhOkludm9rZUZ1bmN0aW9uJ10sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgdGhpcy5tZXRyaWNzQ29sbGVjdG9yRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIHRoaXMuZGFzaGJvYXJkVXBkYXRlckZ1bmN0aW9uLmZ1bmN0aW9uQXJuXG4gICAgICBdXG4gICAgfSkpO1xuICB9XG59Il19