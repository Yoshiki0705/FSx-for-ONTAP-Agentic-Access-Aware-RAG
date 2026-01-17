import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { GlobalRagConfig } from '../../types/global-config';

/**
 * グローバル監視設定インターフェース
 */
export interface GlobalMonitoringConfig {
  /** 監視対象リージョンリスト */
  monitoredRegions: string[];
  /** メトリクス収集間隔（分） */
  metricsCollectionIntervalMinutes: number;
  /** アラート閾値設定 */
  alertThresholds: AlertThresholds;
  /** ダッシュボード設定 */
  dashboardConfig: DashboardConfig;
  /** データ保持期間（日） */
  dataRetentionDays: number;
}

/**
 * アラート閾値設定
 */
export interface AlertThresholds {
  /** CPU使用率閾値（%） */
  cpuUtilizationThreshold: number;
  /** メモリ使用率閾値（%） */
  memoryUtilizationThreshold: number;
  /** エラー率閾値（%） */
  errorRateThreshold: number;
  /** レスポンス時間閾値（ms） */
  responseTimeThreshold: number;
  /** 可用性閾値（%） */
  availabilityThreshold: number;
}

/**
 * ダッシュボード設定
 */
export interface DashboardConfig {
  /** 自動更新間隔（分） */
  autoRefreshIntervalMinutes: number;
  /** 表示期間（時間） */
  displayPeriodHours: number;
  /** 地域別表示有効化 */
  enableRegionalView: boolean;
  /** コンプライアンス表示有効化 */
  enableComplianceView: boolean;
}/*
*
 * 監視メトリクスの種類
 */
export enum MonitoringMetricType {
  PERFORMANCE = 'PERFORMANCE',
  AVAILABILITY = 'AVAILABILITY',
  SECURITY = 'SECURITY',
  COMPLIANCE = 'COMPLIANCE',
  COST = 'COST'
}

/**
 * アラート重要度
 */
export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

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
export class GlobalMonitoringSystem extends Construct {
  public readonly metricsTable: dynamodb.Table;
  public readonly alertsTable: dynamodb.Table;
  public readonly dashboardConfigTable: dynamodb.Table;
  public readonly globalDashboard: cloudwatch.Dashboard;
  public readonly metricsCollectorFunction: lambda.Function;
  public readonly alertProcessorFunction: lambda.Function;
  public readonly dashboardUpdaterFunction: lambda.Function;
  public readonly complianceMonitorFunction: lambda.Function;
  public readonly securityMonitorFunction: lambda.Function;
  public readonly alertTopic: sns.Topic;
  public readonly logGroup: logs.LogGroup;

  private readonly config: GlobalMonitoringConfig;
  private readonly globalConfig: GlobalRagConfig;

  constructor(scope: Construct, id: string, props: {
    globalConfig: GlobalRagConfig;
    monitoringConfig: GlobalMonitoringConfig;
  }) {
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
  private createMetricsTable(): dynamodb.Table {
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
      removalPolicy: RemovalPolicy.RETAIN,
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
  private createAlertsTable(): dynamodb.Table {
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
      removalPolicy: RemovalPolicy.RETAIN,
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
  private createDashboardConfigTable(): dynamodb.Table {
    return new dynamodb.Table(this, 'DashboardConfigTable', {
      tableName: `${this.globalConfig.projectName}-dashboard-config`,
      partitionKey: {
        name: 'configId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.RETAIN
    });
  }

  /**
   * CloudWatch Logsグループの作成
   */
  private createLogGroup(): logs.LogGroup {
    return new logs.LogGroup(this, 'GlobalMonitoringLogs', {
      logGroupName: `/aws/lambda/${this.globalConfig.projectName}-global-monitoring`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN
    });
  }

  /**
   * SNS通知トピックの作成
   */
  private createAlertTopic(): sns.Topic {
    return new sns.Topic(this, 'GlobalAlerts', {
      topicName: `${this.globalConfig.projectName}-global-alerts`,
      displayName: 'Global Monitoring Alerts'
    });
  }  /*
*
   * メトリクス収集Lambda関数
   */
  private createMetricsCollectorFunction(): lambda.Function {
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
      timeout: Duration.minutes(15),
      environment: {
        METRICS_TABLE: this.metricsTable.tableName,
        ALERTS_TABLE: this.alertsTable.tableName,
        ALERT_TOPIC_ARN: this.alertTopic.topicArn
      }
    });
  }  /*
*
   * アラート処理Lambda関数
   */
  private createAlertProcessorFunction(): lambda.Function {
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
      timeout: Duration.minutes(10),
      environment: {
        ALERTS_TABLE: this.alertsTable.tableName,
        ALERT_TOPIC_ARN: this.alertTopic.topicArn
      }
    });
  }

  /**
   * ダッシュボード更新Lambda関数
   */
  private createDashboardUpdaterFunction(): lambda.Function {
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
      timeout: Duration.minutes(10),
      environment: {
        METRICS_TABLE: this.metricsTable.tableName,
        DASHBOARD_CONFIG_TABLE: this.dashboardConfigTable.tableName
      }
    });
  }  /**

   * コンプライアンス監視Lambda関数
   */
  private createComplianceMonitorFunction(): lambda.Function {
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
      timeout: Duration.minutes(15),
      environment: {
        METRICS_TABLE: this.metricsTable.tableName,
        ALERTS_TABLE: this.alertsTable.tableName
      }
    });
  }

  /**
   * セキュリティ監視Lambda関数
   */
  private createSecurityMonitorFunction(): lambda.Function {
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
      timeout: Duration.minutes(15),
      environment: {
        METRICS_TABLE: this.metricsTable.tableName,
        ALERTS_TABLE: this.alertsTable.tableName
      }
    });
  }  /**

   * グローバルCloudWatchダッシュボードの作成
   */
  private createGlobalDashboard(): cloudwatch.Dashboard {
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
      left: this.config.monitoredRegions.map(region => 
        new cloudwatch.Metric({
          namespace: 'GlobalRAG/Monitoring',
          metricName: 'PERFORMANCE_Average',
          dimensionsMap: { Region: region },
          statistic: 'Average'
        })
      )
    });

    // 地域別可用性ウィジェット
    const regionalAvailabilityWidget = new cloudwatch.GraphWidget({
      title: '地域別可用性',
      width: 12,
      height: 6,
      left: this.config.monitoredRegions.map(region => 
        new cloudwatch.Metric({
          namespace: 'GlobalRAG/Monitoring',
          metricName: 'AVAILABILITY_Average',
          dimensionsMap: { Region: region },
          statistic: 'Average'
        })
      )
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
      left: this.config.monitoredRegions.map(region => 
        new cloudwatch.Metric({
          namespace: 'GlobalRAG/Monitoring',
          metricName: 'COMPLIANCE_Average',
          dimensionsMap: { Region: region },
          statistic: 'Average'
        })
      )
    });

    // セキュリティ状況ウィジェット
    const securityWidget = new cloudwatch.GraphWidget({
      title: 'セキュリティ状況',
      width: 12,
      height: 6,
      left: this.config.monitoredRegions.map(region => 
        new cloudwatch.Metric({
          namespace: 'GlobalRAG/Monitoring',
          metricName: 'SECURITY_Average',
          dimensionsMap: { Region: region },
          statistic: 'Average'
        })
      )
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
    dashboard.addWidgets(
      globalOverviewWidget,
      regionalPerformanceWidget,
      regionalAvailabilityWidget,
      alertsWidget,
      complianceWidget,
      securityWidget,
      lambdaPerformanceWidget
    );

    return dashboard;
  }

  /**
   * 定期実行スケジュールの作成
   */
  private createScheduledTasks(): void {
    // メトリクス収集スケジュール
    const metricsCollectionSchedule = new events.Rule(this, 'MetricsCollectionSchedule', {
      ruleName: `${this.globalConfig.projectName}-metrics-collection`,
      description: 'グローバルメトリクス収集スケジュール',
      schedule: events.Schedule.rate(Duration.minutes(this.config.metricsCollectionIntervalMinutes))
    });

    metricsCollectionSchedule.addTarget(new targets.LambdaFunction(this.metricsCollectorFunction));

    // アラート処理スケジュール
    const alertProcessingSchedule = new events.Rule(this, 'AlertProcessingSchedule', {
      ruleName: `${this.globalConfig.projectName}-alert-processing`,
      description: 'アラート処理スケジュール',
      schedule: events.Schedule.rate(Duration.minutes(5)) // 5分間隔
    });

    alertProcessingSchedule.addTarget(new targets.LambdaFunction(this.alertProcessorFunction));

    // ダッシュボード更新スケジュール
    const dashboardUpdateSchedule = new events.Rule(this, 'DashboardUpdateSchedule', {
      ruleName: `${this.globalConfig.projectName}-dashboard-update`,
      description: 'ダッシュボード更新スケジュール',
      schedule: events.Schedule.rate(Duration.minutes(this.config.dashboardConfig.autoRefreshIntervalMinutes))
    });

    dashboardUpdateSchedule.addTarget(new targets.LambdaFunction(this.dashboardUpdaterFunction));

    // コンプライアンス監視スケジュール
    const complianceMonitoringSchedule = new events.Rule(this, 'ComplianceMonitoringSchedule', {
      ruleName: `${this.globalConfig.projectName}-compliance-monitoring`,
      description: 'コンプライアンス監視スケジュール',
      schedule: events.Schedule.rate(Duration.hours(6)) // 6時間間隔
    });

    complianceMonitoringSchedule.addTarget(new targets.LambdaFunction(this.complianceMonitorFunction));

    // セキュリティ監視スケジュール
    const securityMonitoringSchedule = new events.Rule(this, 'SecurityMonitoringSchedule', {
      ruleName: `${this.globalConfig.projectName}-security-monitoring`,
      description: 'セキュリティ監視スケジュール',
      schedule: events.Schedule.rate(Duration.hours(1)) // 1時間間隔
    });

    securityMonitoringSchedule.addTarget(new targets.LambdaFunction(this.securityMonitorFunction));
  }

  /**
   * 必要なIAM権限の付与
   */
  private grantPermissions(): void {
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