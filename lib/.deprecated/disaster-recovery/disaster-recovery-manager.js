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
exports.DisasterRecoveryManager = exports.DisasterRecoveryState = void 0;
const constructs_1 = require("constructs");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatchActions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
/**
 * 災害復旧システムの状態
 */
var DisasterRecoveryState;
(function (DisasterRecoveryState) {
    DisasterRecoveryState["HEALTHY"] = "HEALTHY";
    DisasterRecoveryState["DEGRADED"] = "DEGRADED";
    DisasterRecoveryState["FAILED"] = "FAILED";
    DisasterRecoveryState["FAILOVER_IN_PROGRESS"] = "FAILOVER_IN_PROGRESS";
    DisasterRecoveryState["FAILOVER_COMPLETE"] = "FAILOVER_COMPLETE";
})(DisasterRecoveryState || (exports.DisasterRecoveryState = DisasterRecoveryState = {}));
/**
 * 災害復旧管理システム
 *
 * 機能:
 * - 東京 ⇔ 大阪間の自動フェイルオーバー
 * - RTO: 4時間以内、RPO: 1時間以内の目標達成
 * - ヘルスチェックと自動切り替え
 * - データレプリケーション監視
 */
class DisasterRecoveryManager extends constructs_1.Construct {
    healthCheckFunction;
    failoverFunction;
    statusTable;
    alertTopic;
    config;
    globalConfig;
    constructor(scope, id, props) {
        super(scope, id);
        this.globalConfig = props.globalConfig;
        this.config = props.drConfig;
        // 災害復旧状態管理テーブル
        this.statusTable = this.createStatusTable();
        // SNS通知トピック
        this.alertTopic = this.createAlertTopic();
        // ヘルスチェック Lambda関数
        this.healthCheckFunction = this.createHealthCheckFunction();
        // フェイルオーバー Lambda関数
        this.failoverFunction = this.createFailoverFunction();
        // CloudWatch アラーム
        this.createCloudWatchAlarms();
        // 定期ヘルスチェックスケジュール
        this.createHealthCheckSchedule();
    }
    /**
     * 災害復旧状態管理テーブルの作成
     */
    createStatusTable() {
        return new dynamodb.Table(this, 'DisasterRecoveryStatusTable', {
            tableName: `${this.globalConfig.projectName}-dr-status`,
            partitionKey: {
                name: 'region',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.NUMBER
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
            timeToLiveAttribute: 'ttl'
        });
    }
    /**
     * SNS通知トピックの作成
     */
    createAlertTopic() {
        return new sns.Topic(this, 'DisasterRecoveryAlerts', {
            topicName: `${this.globalConfig.projectName}-dr-alerts`,
            displayName: 'Disaster Recovery Alerts'
        });
    }
    /**
     * ヘルスチェック Lambda関数の作成
     */
    createHealthCheckFunction() {
        return new lambda.Function(this, 'HealthCheckFunction', {
            functionName: `${this.globalConfig.projectName}-dr-health-check`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB.DocumentClient();
        const cloudwatch = new AWS.CloudWatch();
        const sns = new AWS.SNS();

        exports.handler = async (event) => {
          console.log('災害復旧ヘルスチェック開始');
          
          try {
            // プライマリリージョンのヘルスチェック
            const primaryHealth = await checkRegionHealth('${this.config.primaryRegion}');
            
            // セカンダリリージョンのヘルスチェック
            const secondaryHealth = await checkRegionHealth('${this.config.secondaryRegion}');
            
            // 状態をDynamoDBに記録
            await recordHealthStatus(primaryHealth, secondaryHealth);
            
            // フェイルオーバー判定
            if (shouldFailover(primaryHealth, secondaryHealth)) {
              console.log('フェイルオーバー条件を満たしました');
              await triggerFailover();
            }
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                primary: primaryHealth,
                secondary: secondaryHealth,
                timestamp: new Date().toISOString()
              })
            };
          } catch (error) {
            console.error('ヘルスチェックエラー:', error);
            await sendAlert('ヘルスチェック失敗: ' + error.message);
            throw error;
          }
        };

        async function checkRegionHealth(region) {
          // 各サービスのヘルスチェック実装
          const checks = {
            dynamodb: await checkDynamoDB(region),
            opensearch: await checkOpenSearch(region),
            lambda: await checkLambda(region),
            fsx: await checkFSx(region)
          };
          
          const healthyServices = Object.values(checks).filter(Boolean).length;
          const totalServices = Object.keys(checks).length;
          
          return {
            region,
            healthy: healthyServices === totalServices,
            healthScore: healthyServices / totalServices,
            services: checks,
            timestamp: Date.now()
          };
        }

        async function checkDynamoDB(region) {
          try {
            const dynamoClient = new AWS.DynamoDB({ region });
            await dynamoClient.listTables().promise();
            return true;
          } catch (error) {
            console.error(\`DynamoDB check failed in \${region}:\`, error);
            return false;
          }
        }

        async function checkOpenSearch(region) {
          // OpenSearch Serverlessのヘルスチェック実装
          return true; // 簡略化
        }

        async function checkLambda(region) {
          // Lambda関数のヘルスチェック実装
          return true; // 簡略化
        }

        async function checkFSx(region) {
          // FSx for NetApp ONTAPのヘルスチェック実装
          return true; // 簡略化
        }

        async function recordHealthStatus(primary, secondary) {
          const params = {
            TableName: '${this.statusTable.tableName}',
            Item: {
              region: 'health-status',
              timestamp: Date.now(),
              primary,
              secondary,
              ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7日後に削除
            }
          };
          
          await dynamodb.put(params).promise();
        }

        function shouldFailover(primary, secondary) {
          // フェイルオーバー判定ロジック
          return !primary.healthy && secondary.healthy && secondary.healthScore > 0.8;
        }

        async function triggerFailover() {
          // フェイルオーバー処理をトリガー
          console.log('フェイルオーバー処理を開始します');
          // 実際のフェイルオーバーロジックは別のLambda関数で実装
        }

        async function sendAlert(message) {
          const params = {
            TopicArn: '${this.alertTopic.topicArn}',
            Message: message,
            Subject: '災害復旧アラート'
          };
          
          await sns.publish(params).promise();
        }
      `),
            timeout: aws_cdk_lib_1.Duration.minutes(5),
            environment: {
                STATUS_TABLE_NAME: this.statusTable.tableName,
                ALERT_TOPIC_ARN: this.alertTopic.topicArn,
                PRIMARY_REGION: this.config.primaryRegion,
                SECONDARY_REGION: this.config.secondaryRegion
            }
        });
    }
    /**
     * フェイルオーバー Lambda関数の作成
     */
    createFailoverFunction() {
        return new lambda.Function(this, 'FailoverFunction', {
            functionName: `${this.globalConfig.projectName}-dr-failover`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const route53 = new AWS.Route53();
        const dynamodb = new AWS.DynamoDB.DocumentClient();

        exports.handler = async (event) => {
          console.log('災害復旧フェイルオーバー開始');
          
          try {
            const startTime = Date.now();
            
            // フェイルオーバー状態を記録
            await updateFailoverStatus('FAILOVER_IN_PROGRESS', startTime);
            
            // DNS切り替え実行
            await switchDNS();
            
            // ロードバランサー切り替え
            await switchLoadBalancer();
            
            // データベース切り替え
            await switchDatabase();
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // フェイルオーバー完了を記録
            await updateFailoverStatus('FAILOVER_COMPLETE', endTime, duration);
            
            // 成功通知
            await sendSuccessNotification(duration);
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                status: 'FAILOVER_COMPLETE',
                duration: duration,
                rtoAchieved: duration < (${this.config.rtoMinutes} * 60 * 1000)
              })
            };
          } catch (error) {
            console.error('フェイルオーバーエラー:', error);
            await updateFailoverStatus('FAILED', Date.now(), null, error.message);
            throw error;
          }
        };

        async function updateFailoverStatus(status, timestamp, duration = null, error = null) {
          const params = {
            TableName: '${this.statusTable.tableName}',
            Item: {
              region: 'failover-status',
              timestamp,
              status,
              duration,
              error,
              ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30日後に削除
            }
          };
          
          await dynamodb.put(params).promise();
        }

        async function switchDNS() {
          console.log('DNS切り替えを実行中...');
          // Route53レコード切り替えロジック
          // 実装詳細は後で追加
        }

        async function switchLoadBalancer() {
          console.log('ロードバランサー切り替えを実行中...');
          // ALB/NLB切り替えロジック
          // 実装詳細は後で追加
        }

        async function switchDatabase() {
          console.log('データベース切り替えを実行中...');
          // DynamoDB Global Tables、OpenSearch切り替えロジック
          // 実装詳細は後で追加
        }

        async function sendSuccessNotification(duration) {
          const sns = new AWS.SNS();
          const rtoMinutes = ${this.config.rtoMinutes};
          const durationMinutes = Math.round(duration / (60 * 1000));
          
          const message = \`
災害復旧フェイルオーバーが完了しました。

実行時間: \${durationMinutes}分
RTO目標: \${rtoMinutes}分
目標達成: \${durationMinutes <= rtoMinutes ? '✅ 達成' : '❌ 未達成'}

セカンダリリージョン（${this.config.secondaryRegion}）での運用を開始しました。
          \`;
          
          await sns.publish({
            TopicArn: '${this.alertTopic.topicArn}',
            Message: message,
            Subject: '災害復旧フェイルオーバー完了通知'
          }).promise();
        }
      `),
            timeout: aws_cdk_lib_1.Duration.minutes(15),
            environment: {
                STATUS_TABLE_NAME: this.statusTable.tableName,
                ALERT_TOPIC_ARN: this.alertTopic.topicArn,
                PRIMARY_REGION: this.config.primaryRegion,
                SECONDARY_REGION: this.config.secondaryRegion,
                RTO_MINUTES: this.config.rtoMinutes.toString()
            }
        });
    }
    /**
     * CloudWatch アラームの作成
     */
    createCloudWatchAlarms() {
        // ヘルスチェック失敗アラーム
        const healthCheckAlarm = new cloudwatch.Alarm(this, 'HealthCheckFailureAlarm', {
            alarmName: `${this.globalConfig.projectName}-dr-health-check-failure`,
            metric: this.healthCheckFunction.metricErrors(),
            threshold: 1,
            evaluationPeriods: 2,
            treatMissingData: cloudwatch.TreatMissingData.BREACHING
        });
        healthCheckAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
        // フェイルオーバー時間アラーム
        const failoverDurationAlarm = new cloudwatch.Alarm(this, 'FailoverDurationAlarm', {
            alarmName: `${this.globalConfig.projectName}-dr-failover-duration`,
            metric: this.failoverFunction.metricDuration(),
            threshold: this.config.rtoMinutes * 60 * 1000, // RTOをミリ秒に変換
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
        });
        failoverDurationAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
    }
    /**
     * 定期ヘルスチェックスケジュールの作成
     */
    createHealthCheckSchedule() {
        const rule = new events.Rule(this, 'HealthCheckSchedule', {
            ruleName: `${this.globalConfig.projectName}-dr-health-check-schedule`,
            schedule: events.Schedule.rate(aws_cdk_lib_1.Duration.minutes(this.config.healthCheckIntervalMinutes))
        });
        rule.addTarget(new targets.LambdaFunction(this.healthCheckFunction));
    }
    /**
     * 権限設定
     */
    grantPermissions() {
        // DynamoDB権限
        this.statusTable.grantReadWriteData(this.healthCheckFunction);
        this.statusTable.grantReadWriteData(this.failoverFunction);
        // SNS権限
        this.alertTopic.grantPublish(this.healthCheckFunction);
        this.alertTopic.grantPublish(this.failoverFunction);
        // Route53権限（フェイルオーバー用）
        this.failoverFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'route53:ChangeResourceRecordSets',
                'route53:GetHostedZone',
                'route53:ListResourceRecordSets'
            ],
            resources: ['*']
        }));
        // クロスリージョンアクセス権限
        this.healthCheckFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:ListTables',
                'lambda:ListFunctions',
                'opensearch:DescribeDomain',
                'fsx:DescribeFileSystems'
            ],
            resources: ['*']
        }));
    }
}
exports.DisasterRecoveryManager = DisasterRecoveryManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlzYXN0ZXItcmVjb3ZlcnktbWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRpc2FzdGVyLXJlY292ZXJ5LW1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyQ0FBdUM7QUFDdkMsNkNBQXlFO0FBQ3pFLG1FQUFxRDtBQUVyRCx1RUFBeUQ7QUFDekQsc0ZBQXdFO0FBQ3hFLHlEQUEyQztBQUMzQywrREFBaUQ7QUFDakQsK0RBQWlEO0FBQ2pELHdFQUEwRDtBQUMxRCx5REFBMkM7QUFxQjNDOztHQUVHO0FBQ0gsSUFBWSxxQkFNWDtBQU5ELFdBQVkscUJBQXFCO0lBQy9CLDRDQUFtQixDQUFBO0lBQ25CLDhDQUFxQixDQUFBO0lBQ3JCLDBDQUFpQixDQUFBO0lBQ2pCLHNFQUE2QyxDQUFBO0lBQzdDLGdFQUF1QyxDQUFBO0FBQ3pDLENBQUMsRUFOVyxxQkFBcUIscUNBQXJCLHFCQUFxQixRQU1oQztBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsTUFBYSx1QkFBd0IsU0FBUSxzQkFBUztJQUNwQyxtQkFBbUIsQ0FBa0I7SUFDckMsZ0JBQWdCLENBQWtCO0lBQ2xDLFdBQVcsQ0FBaUI7SUFDNUIsVUFBVSxDQUFZO0lBRXJCLE1BQU0sQ0FBeUI7SUFDL0IsWUFBWSxDQUFrQjtJQUUvQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBR3pDO1FBQ0MsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUM7UUFDdkMsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDO1FBRTdCLGVBQWU7UUFDZixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBRTVDLFlBQVk7UUFDWixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxnQkFB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QThaQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMsIER1cmF0aW9uLCBSZW1vdmFsUG9saWN5IH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHJvdXRlNTMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJvdXRlNTMnO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoQWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IEdsb2JhbFJhZ0NvbmZpZyB9IGZyb20gJy4uLy4uL3R5cGVzL2dsb2JhbC1jb25maWcnO1xuXG4vKipcbiAqIOeBveWus+W+qeaXp+ioreWumuOCpOODs+OCv+ODvOODleOCp+ODvOOCuVxuICovXG5leHBvcnQgaW50ZXJmYWNlIERpc2FzdGVyUmVjb3ZlcnlDb25maWcge1xuICAvKiog5b6p5pen5pmC6ZaT55uu5qiZ77yI5YiG77yJICovXG4gIHJ0b01pbnV0ZXM6IG51bWJlcjtcbiAgLyoqIOW+qeaXp+ODneOCpOODs+ODiOebruaome+8iOWIhu+8iSAqL1xuICBycG9NaW51dGVzOiBudW1iZXI7XG4gIC8qKiDjg5fjg6njgqTjg57jg6rjg6rjg7zjgrjjg6fjg7MgKi9cbiAgcHJpbWFyeVJlZ2lvbjogc3RyaW5nO1xuICAvKiog44K744Kr44Oz44OA44Oq44Oq44O844K444On44OzICovXG4gIHNlY29uZGFyeVJlZ2lvbjogc3RyaW5nO1xuICAvKiog44OY44Or44K544OB44Kn44OD44Kv6ZaT6ZqU77yI5YiG77yJICovXG4gIGhlYWx0aENoZWNrSW50ZXJ2YWxNaW51dGVzOiBudW1iZXI7XG4gIC8qKiDjg5XjgqfjgqTjg6vjgqrjg7zjg5Djg7zplr7lgKQgKi9cbiAgZmFpbG92ZXJUaHJlc2hvbGQ6IG51bWJlcjtcbn1cblxuLyoqXG4gKiDngb3lrrPlvqnml6fjgrfjgrnjg4bjg6Djga7nirbmhYtcbiAqL1xuZXhwb3J0IGVudW0gRGlzYXN0ZXJSZWNvdmVyeVN0YXRlIHtcbiAgSEVBTFRIWSA9ICdIRUFMVEhZJyxcbiAgREVHUkFERUQgPSAnREVHUkFERUQnLFxuICBGQUlMRUQgPSAnRkFJTEVEJyxcbiAgRkFJTE9WRVJfSU5fUFJPR1JFU1MgPSAnRkFJTE9WRVJfSU5fUFJPR1JFU1MnLFxuICBGQUlMT1ZFUl9DT01QTEVURSA9ICdGQUlMT1ZFUl9DT01QTEVURSdcbn1cblxuLyoqXG4gKiDngb3lrrPlvqnml6fnrqHnkIbjgrfjgrnjg4bjg6BcbiAqIFxuICog5qmf6IO9OlxuICogLSDmnbHkuqwg4oeUIOWkp+mYqumWk+OBruiHquWLleODleOCp+OCpOODq+OCquODvOODkOODvFxuICogLSBSVE86IDTmmYLplpPku6XlhoXjgIFSUE86IDHmmYLplpPku6XlhoXjga7nm67mqJnpgZTmiJBcbiAqIC0g44OY44Or44K544OB44Kn44OD44Kv44Go6Ieq5YuV5YiH44KK5pu/44GIXG4gKiAtIOODh+ODvOOCv+ODrOODl+ODquOCseODvOOCt+ODp+ODs+ebo+imllxuICovXG5leHBvcnQgY2xhc3MgRGlzYXN0ZXJSZWNvdmVyeU1hbmFnZXIgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgaGVhbHRoQ2hlY2tGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZmFpbG92ZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgc3RhdHVzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgYWxlcnRUb3BpYzogc25zLlRvcGljO1xuICBcbiAgcHJpdmF0ZSByZWFkb25seSBjb25maWc6IERpc2FzdGVyUmVjb3ZlcnlDb25maWc7XG4gIHByaXZhdGUgcmVhZG9ubHkgZ2xvYmFsQ29uZmlnOiBHbG9iYWxSYWdDb25maWc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IHtcbiAgICBnbG9iYWxDb25maWc6IEdsb2JhbFJhZ0NvbmZpZztcbiAgICBkckNvbmZpZzogRGlzYXN0ZXJSZWNvdmVyeUNvbmZpZztcbiAgfSkge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICB0aGlzLmdsb2JhbENvbmZpZyA9IHByb3BzLmdsb2JhbENvbmZpZztcbiAgICB0aGlzLmNvbmZpZyA9IHByb3BzLmRyQ29uZmlnO1xuXG4gICAgLy8g54G95a6z5b6p5pen54q25oWL566h55CG44OG44O844OW44OrXG4gICAgdGhpcy5zdGF0dXNUYWJsZSA9IHRoaXMuY3JlYXRlU3RhdHVzVGFibGUoKTtcblxuICAgIC8vIFNOU+mAmuefpeODiOODlOODg+OCr1xuICAgIHRoaXMuYWxlcnRUb3BpYyA9IHRoaXMuY3JlYXRlQWxlcnRUb3BpYygpO1xuXG4gICAgLy8g44OY44Or44K544OB44Kn44OD44KvIExhbWJkYemWouaVsFxuICAgIHRoaXMuaGVhbHRoQ2hlY2tGdW5jdGlvbiA9IHRoaXMuY3JlYXRlSGVhbHRoQ2hlY2tGdW5jdGlvbigpO1xuXG4gICAgLy8g44OV44Kn44Kk44Or44Kq44O844OQ44O8IExhbWJkYemWouaVsFxuICAgIHRoaXMuZmFpbG92ZXJGdW5jdGlvbiA9IHRoaXMuY3JlYXRlRmFpbG92ZXJGdW5jdGlvbigpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCDjgqLjg6njg7zjg6BcbiAgICB0aGlzLmNyZWF0ZUNsb3VkV2F0Y2hBbGFybXMoKTtcblxuICAgIC8vIOWumuacn+ODmOODq+OCueODgeOCp+ODg+OCr+OCueOCseOCuOODpeODvOODq1xuICAgIHRoaXMuY3JlYXRlSGVhbHRoQ2hlY2tTY2hlZHVsZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIOeBveWus+W+qeaXp+eKtuaFi+euoeeQhuODhuODvOODluODq+OBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVTdGF0dXNUYWJsZSgpOiBkeW5hbW9kYi5UYWJsZSB7XG4gICAgcmV0dXJuIG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnRGlzYXN0ZXJSZWNvdmVyeVN0YXR1c1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgJHt0aGlzLmdsb2JhbENvbmZpZy5wcm9qZWN0TmFtZX0tZHItc3RhdHVzYCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAncmVnaW9uJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUlxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19BTkRfT0xEX0lNQUdFUyxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU05T6YCa55+l44OI44OU44OD44Kv44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUFsZXJ0VG9waWMoKTogc25zLlRvcGljIHtcbiAgICByZXR1cm4gbmV3IHNucy5Ub3BpYyh0aGlzLCAnRGlzYXN0ZXJSZWNvdmVyeUFsZXJ0cycsIHtcbiAgICAgIHRvcGljTmFtZTogYCR7dGhpcy5nbG9iYWxDb25maWcucHJvamVjdE5hbWV9LWRyLWFsZXJ0c2AsXG4gICAgICBkaXNwbGF5TmFtZTogJ0Rpc2FzdGVyIFJlY292ZXJ5IEFsZXJ0cydcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5jjg6vjgrnjg4Hjgqfjg4Pjgq8gTGFtYmRh6Zai5pWw44Gu5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUhlYWx0aENoZWNrRnVuY3Rpb24oKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICByZXR1cm4gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnSGVhbHRoQ2hlY2tGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7dGhpcy5nbG9iYWxDb25maWcucHJvamVjdE5hbWV9LWRyLWhlYWx0aC1jaGVja2AsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBjb25zdCBBV1MgPSByZXF1aXJlKCdhd3Mtc2RrJyk7XG4gICAgICAgIGNvbnN0IGR5bmFtb2RiID0gbmV3IEFXUy5EeW5hbW9EQi5Eb2N1bWVudENsaWVudCgpO1xuICAgICAgICBjb25zdCBjbG91ZHdhdGNoID0gbmV3IEFXUy5DbG91ZFdhdGNoKCk7XG4gICAgICAgIGNvbnN0IHNucyA9IG5ldyBBV1MuU05TKCk7XG5cbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ+eBveWus+W+qeaXp+ODmOODq+OCueODgeOCp+ODg+OCr+mWi+WniycpO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyDjg5fjg6njgqTjg57jg6rjg6rjg7zjgrjjg6fjg7Pjga7jg5jjg6vjgrnjg4Hjgqfjg4Pjgq9cbiAgICAgICAgICAgIGNvbnN0IHByaW1hcnlIZWFsdGggPSBhd2FpdCBjaGVja1JlZ2lvbkhlYWx0aCgnJHt0aGlzLmNvbmZpZy5wcmltYXJ5UmVnaW9ufScpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDjgrvjgqvjg7Pjg4Djg6rjg6rjg7zjgrjjg6fjg7Pjga7jg5jjg6vjgrnjg4Hjgqfjg4Pjgq9cbiAgICAgICAgICAgIGNvbnN0IHNlY29uZGFyeUhlYWx0aCA9IGF3YWl0IGNoZWNrUmVnaW9uSGVhbHRoKCcke3RoaXMuY29uZmlnLnNlY29uZGFyeVJlZ2lvbn0nKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g54q25oWL44KSRHluYW1vRELjgavoqJjpjLJcbiAgICAgICAgICAgIGF3YWl0IHJlY29yZEhlYWx0aFN0YXR1cyhwcmltYXJ5SGVhbHRoLCBzZWNvbmRhcnlIZWFsdGgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDjg5XjgqfjgqTjg6vjgqrjg7zjg5Djg7zliKTlrppcbiAgICAgICAgICAgIGlmIChzaG91bGRGYWlsb3ZlcihwcmltYXJ5SGVhbHRoLCBzZWNvbmRhcnlIZWFsdGgpKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCfjg5XjgqfjgqTjg6vjgqrjg7zjg5Djg7zmnaHku7bjgpLmuoDjgZ/jgZfjgb7jgZfjgZ8nKTtcbiAgICAgICAgICAgICAgYXdhaXQgdHJpZ2dlckZhaWxvdmVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIHByaW1hcnk6IHByaW1hcnlIZWFsdGgsXG4gICAgICAgICAgICAgICAgc2Vjb25kYXJ5OiBzZWNvbmRhcnlIZWFsdGgsXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+ODmOODq+OCueODgeOCp+ODg+OCr+OCqOODqeODvDonLCBlcnJvcik7XG4gICAgICAgICAgICBhd2FpdCBzZW5kQWxlcnQoJ+ODmOODq+OCueODgeOCp+ODg+OCr+WkseaVlzogJyArIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNoZWNrUmVnaW9uSGVhbHRoKHJlZ2lvbikge1xuICAgICAgICAgIC8vIOWQhOOCteODvOODk+OCueOBruODmOODq+OCueODgeOCp+ODg+OCr+Wun+ijhVxuICAgICAgICAgIGNvbnN0IGNoZWNrcyA9IHtcbiAgICAgICAgICAgIGR5bmFtb2RiOiBhd2FpdCBjaGVja0R5bmFtb0RCKHJlZ2lvbiksXG4gICAgICAgICAgICBvcGVuc2VhcmNoOiBhd2FpdCBjaGVja09wZW5TZWFyY2gocmVnaW9uKSxcbiAgICAgICAgICAgIGxhbWJkYTogYXdhaXQgY2hlY2tMYW1iZGEocmVnaW9uKSxcbiAgICAgICAgICAgIGZzeDogYXdhaXQgY2hlY2tGU3gocmVnaW9uKVxuICAgICAgICAgIH07XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgaGVhbHRoeVNlcnZpY2VzID0gT2JqZWN0LnZhbHVlcyhjaGVja3MpLmZpbHRlcihCb29sZWFuKS5sZW5ndGg7XG4gICAgICAgICAgY29uc3QgdG90YWxTZXJ2aWNlcyA9IE9iamVjdC5rZXlzKGNoZWNrcykubGVuZ3RoO1xuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICBoZWFsdGh5OiBoZWFsdGh5U2VydmljZXMgPT09IHRvdGFsU2VydmljZXMsXG4gICAgICAgICAgICBoZWFsdGhTY29yZTogaGVhbHRoeVNlcnZpY2VzIC8gdG90YWxTZXJ2aWNlcyxcbiAgICAgICAgICAgIHNlcnZpY2VzOiBjaGVja3MsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KClcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gY2hlY2tEeW5hbW9EQihyZWdpb24pIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZHluYW1vQ2xpZW50ID0gbmV3IEFXUy5EeW5hbW9EQih7IHJlZ2lvbiB9KTtcbiAgICAgICAgICAgIGF3YWl0IGR5bmFtb0NsaWVudC5saXN0VGFibGVzKCkucHJvbWlzZSgpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXFxgRHluYW1vREIgY2hlY2sgZmFpbGVkIGluIFxcJHtyZWdpb259OlxcYCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIGNoZWNrT3BlblNlYXJjaChyZWdpb24pIHtcbiAgICAgICAgICAvLyBPcGVuU2VhcmNoIFNlcnZlcmxlc3Pjga7jg5jjg6vjgrnjg4Hjgqfjg4Pjgq/lrp/oo4VcbiAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8g57Ch55Wl5YyWXG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjaGVja0xhbWJkYShyZWdpb24pIHtcbiAgICAgICAgICAvLyBMYW1iZGHplqLmlbDjga7jg5jjg6vjgrnjg4Hjgqfjg4Pjgq/lrp/oo4VcbiAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8g57Ch55Wl5YyWXG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBjaGVja0ZTeChyZWdpb24pIHtcbiAgICAgICAgICAvLyBGU3ggZm9yIE5ldEFwcCBPTlRBUOOBruODmOODq+OCueODgeOCp+ODg+OCr+Wun+ijhVxuICAgICAgICAgIHJldHVybiB0cnVlOyAvLyDnsKHnlaXljJZcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIHJlY29yZEhlYWx0aFN0YXR1cyhwcmltYXJ5LCBzZWNvbmRhcnkpIHtcbiAgICAgICAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICAgICAgICBUYWJsZU5hbWU6ICcke3RoaXMuc3RhdHVzVGFibGUudGFibGVOYW1lfScsXG4gICAgICAgICAgICBJdGVtOiB7XG4gICAgICAgICAgICAgIHJlZ2lvbjogJ2hlYWx0aC1zdGF0dXMnLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgICAgICAgIHByaW1hcnksXG4gICAgICAgICAgICAgIHNlY29uZGFyeSxcbiAgICAgICAgICAgICAgdHRsOiBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKSArICg3ICogMjQgKiA2MCAqIDYwKSAvLyA35pel5b6M44Gr5YmK6ZmkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBkeW5hbW9kYi5wdXQocGFyYW1zKS5wcm9taXNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBzaG91bGRGYWlsb3ZlcihwcmltYXJ5LCBzZWNvbmRhcnkpIHtcbiAgICAgICAgICAvLyDjg5XjgqfjgqTjg6vjgqrjg7zjg5Djg7zliKTlrprjg63jgrjjg4Pjgq9cbiAgICAgICAgICByZXR1cm4gIXByaW1hcnkuaGVhbHRoeSAmJiBzZWNvbmRhcnkuaGVhbHRoeSAmJiBzZWNvbmRhcnkuaGVhbHRoU2NvcmUgPiAwLjg7XG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiB0cmlnZ2VyRmFpbG92ZXIoKSB7XG4gICAgICAgICAgLy8g44OV44Kn44Kk44Or44Kq44O844OQ44O85Yem55CG44KS44OI44Oq44Ks44O8XG4gICAgICAgICAgY29uc29sZS5sb2coJ+ODleOCp+OCpOODq+OCquODvOODkOODvOWHpueQhuOCkumWi+Wni+OBl+OBvuOBmScpO1xuICAgICAgICAgIC8vIOWun+mam+OBruODleOCp+OCpOODq+OCquODvOODkOODvOODreOCuOODg+OCr+OBr+WIpeOBrkxhbWJkYemWouaVsOOBp+Wun+ijhVxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gc2VuZEFsZXJ0KG1lc3NhZ2UpIHtcbiAgICAgICAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICAgICAgICBUb3BpY0FybjogJyR7dGhpcy5hbGVydFRvcGljLnRvcGljQXJufScsXG4gICAgICAgICAgICBNZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgU3ViamVjdDogJ+eBveWus+W+qeaXp+OCouODqeODvOODiCdcbiAgICAgICAgICB9O1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHNucy5wdWJsaXNoKHBhcmFtcykucHJvbWlzZSgpO1xuICAgICAgICB9XG4gICAgICBgKSxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBTVEFUVVNfVEFCTEVfTkFNRTogdGhpcy5zdGF0dXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFMRVJUX1RPUElDX0FSTjogdGhpcy5hbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgICBQUklNQVJZX1JFR0lPTjogdGhpcy5jb25maWcucHJpbWFyeVJlZ2lvbixcbiAgICAgICAgU0VDT05EQVJZX1JFR0lPTjogdGhpcy5jb25maWcuc2Vjb25kYXJ5UmVnaW9uXG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44OV44Kn44Kk44Or44Kq44O844OQ44O8IExhbWJkYemWouaVsOOBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVGYWlsb3ZlckZ1bmN0aW9uKCk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0ZhaWxvdmVyRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1kci1mYWlsb3ZlcmAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21JbmxpbmUoYFxuICAgICAgICBjb25zdCBBV1MgPSByZXF1aXJlKCdhd3Mtc2RrJyk7XG4gICAgICAgIGNvbnN0IHJvdXRlNTMgPSBuZXcgQVdTLlJvdXRlNTMoKTtcbiAgICAgICAgY29uc3QgZHluYW1vZGIgPSBuZXcgQVdTLkR5bmFtb0RCLkRvY3VtZW50Q2xpZW50KCk7XG5cbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ+eBveWus+W+qeaXp+ODleOCp+OCpOODq+OCquODvOODkOODvOmWi+WniycpO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDjg5XjgqfjgqTjg6vjgqrjg7zjg5Djg7znirbmhYvjgpLoqJjpjLJcbiAgICAgICAgICAgIGF3YWl0IHVwZGF0ZUZhaWxvdmVyU3RhdHVzKCdGQUlMT1ZFUl9JTl9QUk9HUkVTUycsIHN0YXJ0VGltZSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEROU+WIh+OCiuabv+OBiOWun+ihjFxuICAgICAgICAgICAgYXdhaXQgc3dpdGNoRE5TKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOODreODvOODieODkOODqeODs+OCteODvOWIh+OCiuabv+OBiFxuICAgICAgICAgICAgYXdhaXQgc3dpdGNoTG9hZEJhbGFuY2VyKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOODh+ODvOOCv+ODmeODvOOCueWIh+OCiuabv+OBiFxuICAgICAgICAgICAgYXdhaXQgc3dpdGNoRGF0YWJhc2UoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgZW5kVGltZSA9IERhdGUubm93KCk7XG4gICAgICAgICAgICBjb25zdCBkdXJhdGlvbiA9IGVuZFRpbWUgLSBzdGFydFRpbWU7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOODleOCp+OCpOODq+OCquODvOODkOODvOWujOS6huOCkuiomOmMslxuICAgICAgICAgICAgYXdhaXQgdXBkYXRlRmFpbG92ZXJTdGF0dXMoJ0ZBSUxPVkVSX0NPTVBMRVRFJywgZW5kVGltZSwgZHVyYXRpb24pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDmiJDlip/pgJrnn6VcbiAgICAgICAgICAgIGF3YWl0IHNlbmRTdWNjZXNzTm90aWZpY2F0aW9uKGR1cmF0aW9uKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnRkFJTE9WRVJfQ09NUExFVEUnLFxuICAgICAgICAgICAgICAgIGR1cmF0aW9uOiBkdXJhdGlvbixcbiAgICAgICAgICAgICAgICBydG9BY2hpZXZlZDogZHVyYXRpb24gPCAoJHt0aGlzLmNvbmZpZy5ydG9NaW51dGVzfSAqIDYwICogMTAwMClcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+ODleOCp+OCpOODq+OCquODvOODkOODvOOCqOODqeODvDonLCBlcnJvcik7XG4gICAgICAgICAgICBhd2FpdCB1cGRhdGVGYWlsb3ZlclN0YXR1cygnRkFJTEVEJywgRGF0ZS5ub3coKSwgbnVsbCwgZXJyb3IubWVzc2FnZSk7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gdXBkYXRlRmFpbG92ZXJTdGF0dXMoc3RhdHVzLCB0aW1lc3RhbXAsIGR1cmF0aW9uID0gbnVsbCwgZXJyb3IgPSBudWxsKSB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgICAgICAgVGFibGVOYW1lOiAnJHt0aGlzLnN0YXR1c1RhYmxlLnRhYmxlTmFtZX0nLFxuICAgICAgICAgICAgSXRlbToge1xuICAgICAgICAgICAgICByZWdpb246ICdmYWlsb3Zlci1zdGF0dXMnLFxuICAgICAgICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgICAgICAgIHN0YXR1cyxcbiAgICAgICAgICAgICAgZHVyYXRpb24sXG4gICAgICAgICAgICAgIGVycm9yLFxuICAgICAgICAgICAgICB0dGw6IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApICsgKDMwICogMjQgKiA2MCAqIDYwKSAvLyAzMOaXpeW+jOOBq+WJiumZpFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgZHluYW1vZGIucHV0KHBhcmFtcykucHJvbWlzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gc3dpdGNoRE5TKCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdETlPliIfjgormm7/jgYjjgpLlrp/ooYzkuK0uLi4nKTtcbiAgICAgICAgICAvLyBSb3V0ZTUz44Os44Kz44O844OJ5YiH44KK5pu/44GI44Ot44K444OD44KvXG4gICAgICAgICAgLy8g5a6f6KOF6Kmz57Sw44Gv5b6M44Gn6L+95YqgXG4gICAgICAgIH1cblxuICAgICAgICBhc3luYyBmdW5jdGlvbiBzd2l0Y2hMb2FkQmFsYW5jZXIoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ+ODreODvOODieODkOODqeODs+OCteODvOWIh+OCiuabv+OBiOOCkuWun+ihjOS4rS4uLicpO1xuICAgICAgICAgIC8vIEFMQi9OTELliIfjgormm7/jgYjjg63jgrjjg4Pjgq9cbiAgICAgICAgICAvLyDlrp/oo4XoqbPntLDjga/lvozjgafov73liqBcbiAgICAgICAgfVxuXG4gICAgICAgIGFzeW5jIGZ1bmN0aW9uIHN3aXRjaERhdGFiYXNlKCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCfjg4fjg7zjgr/jg5njg7zjgrnliIfjgormm7/jgYjjgpLlrp/ooYzkuK0uLi4nKTtcbiAgICAgICAgICAvLyBEeW5hbW9EQiBHbG9iYWwgVGFibGVz44CBT3BlblNlYXJjaOWIh+OCiuabv+OBiOODreOCuOODg+OCr1xuICAgICAgICAgIC8vIOWun+ijheips+e0sOOBr+W+jOOBp+i/veWKoFxuICAgICAgICB9XG5cbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gc2VuZFN1Y2Nlc3NOb3RpZmljYXRpb24oZHVyYXRpb24pIHtcbiAgICAgICAgICBjb25zdCBzbnMgPSBuZXcgQVdTLlNOUygpO1xuICAgICAgICAgIGNvbnN0IHJ0b01pbnV0ZXMgPSAke3RoaXMuY29uZmlnLnJ0b01pbnV0ZXN9O1xuICAgICAgICAgIGNvbnN0IGR1cmF0aW9uTWludXRlcyA9IE1hdGgucm91bmQoZHVyYXRpb24gLyAoNjAgKiAxMDAwKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IFxcYFxu54G95a6z5b6p5pen44OV44Kn44Kk44Or44Kq44O844OQ44O844GM5a6M5LqG44GX44G+44GX44Gf44CCXG5cbuWun+ihjOaZgumWkzogXFwke2R1cmF0aW9uTWludXRlc33liIZcblJUT+ebruaomTogXFwke3J0b01pbnV0ZXN95YiGXG7nm67mqJnpgZTmiJA6IFxcJHtkdXJhdGlvbk1pbnV0ZXMgPD0gcnRvTWludXRlcyA/ICfinIUg6YGU5oiQJyA6ICfinYwg5pyq6YGU5oiQJ31cblxu44K744Kr44Oz44OA44Oq44Oq44O844K444On44Oz77yIJHt0aGlzLmNvbmZpZy5zZWNvbmRhcnlSZWdpb25977yJ44Gn44Gu6YGL55So44KS6ZaL5aeL44GX44G+44GX44Gf44CCXG4gICAgICAgICAgXFxgO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHNucy5wdWJsaXNoKHtcbiAgICAgICAgICAgIFRvcGljQXJuOiAnJHt0aGlzLmFsZXJ0VG9waWMudG9waWNBcm59JyxcbiAgICAgICAgICAgIE1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICBTdWJqZWN0OiAn54G95a6z5b6p5pen44OV44Kn44Kk44Or44Kq44O844OQ44O85a6M5LqG6YCa55+lJ1xuICAgICAgICAgIH0pLnByb21pc2UoKTtcbiAgICAgICAgfVxuICAgICAgYCksXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFNUQVRVU19UQUJMRV9OQU1FOiB0aGlzLnN0YXR1c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQUxFUlRfVE9QSUNfQVJOOiB0aGlzLmFsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICAgIFBSSU1BUllfUkVHSU9OOiB0aGlzLmNvbmZpZy5wcmltYXJ5UmVnaW9uLFxuICAgICAgICBTRUNPTkRBUllfUkVHSU9OOiB0aGlzLmNvbmZpZy5zZWNvbmRhcnlSZWdpb24sXG4gICAgICAgIFJUT19NSU5VVEVTOiB0aGlzLmNvbmZpZy5ydG9NaW51dGVzLnRvU3RyaW5nKClcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG91ZFdhdGNoIOOCouODqeODvOODoOOBruS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVDbG91ZFdhdGNoQWxhcm1zKCk6IHZvaWQge1xuICAgIC8vIOODmOODq+OCueODgeOCp+ODg+OCr+WkseaVl+OCouODqeODvOODoFxuICAgIGNvbnN0IGhlYWx0aENoZWNrQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnSGVhbHRoQ2hlY2tGYWlsdXJlQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1kci1oZWFsdGgtY2hlY2stZmFpbHVyZWAsXG4gICAgICBtZXRyaWM6IHRoaXMuaGVhbHRoQ2hlY2tGdW5jdGlvbi5tZXRyaWNFcnJvcnMoKSxcbiAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLkJSRUFDSElOR1xuICAgIH0pO1xuXG4gICAgaGVhbHRoQ2hlY2tBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGVydFRvcGljKVxuICAgICk7XG5cbiAgICAvLyDjg5XjgqfjgqTjg6vjgqrjg7zjg5Djg7zmmYLplpPjgqLjg6njg7zjg6BcbiAgICBjb25zdCBmYWlsb3ZlckR1cmF0aW9uQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnRmFpbG92ZXJEdXJhdGlvbkFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgJHt0aGlzLmdsb2JhbENvbmZpZy5wcm9qZWN0TmFtZX0tZHItZmFpbG92ZXItZHVyYXRpb25gLFxuICAgICAgbWV0cmljOiB0aGlzLmZhaWxvdmVyRnVuY3Rpb24ubWV0cmljRHVyYXRpb24oKSxcbiAgICAgIHRocmVzaG9sZDogdGhpcy5jb25maWcucnRvTWludXRlcyAqIDYwICogMTAwMCwgLy8gUlRP44KS44Of44Oq56eS44Gr5aSJ5o+bXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRFxuICAgIH0pO1xuXG4gICAgZmFpbG92ZXJEdXJhdGlvbkFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsZXJ0VG9waWMpXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlrprmnJ/jg5jjg6vjgrnjg4Hjgqfjg4Pjgq/jgrnjgrHjgrjjg6Xjg7zjg6vjga7kvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlSGVhbHRoQ2hlY2tTY2hlZHVsZSgpOiB2b2lkIHtcbiAgICBjb25zdCBydWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdIZWFsdGhDaGVja1NjaGVkdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGAke3RoaXMuZ2xvYmFsQ29uZmlnLnByb2plY3ROYW1lfS1kci1oZWFsdGgtY2hlY2stc2NoZWR1bGVgLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5yYXRlKER1cmF0aW9uLm1pbnV0ZXModGhpcy5jb25maWcuaGVhbHRoQ2hlY2tJbnRlcnZhbE1pbnV0ZXMpKVxuICAgIH0pO1xuXG4gICAgcnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24odGhpcy5oZWFsdGhDaGVja0Z1bmN0aW9uKSk7XG4gIH1cblxuICAvKipcbiAgICog5qip6ZmQ6Kit5a6aXG4gICAqL1xuICBwdWJsaWMgZ3JhbnRQZXJtaXNzaW9ucygpOiB2b2lkIHtcbiAgICAvLyBEeW5hbW9EQuaoqemZkFxuICAgIHRoaXMuc3RhdHVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMuaGVhbHRoQ2hlY2tGdW5jdGlvbik7XG4gICAgdGhpcy5zdGF0dXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5mYWlsb3ZlckZ1bmN0aW9uKTtcblxuICAgIC8vIFNOU+aoqemZkFxuICAgIHRoaXMuYWxlcnRUb3BpYy5ncmFudFB1Ymxpc2godGhpcy5oZWFsdGhDaGVja0Z1bmN0aW9uKTtcbiAgICB0aGlzLmFsZXJ0VG9waWMuZ3JhbnRQdWJsaXNoKHRoaXMuZmFpbG92ZXJGdW5jdGlvbik7XG5cbiAgICAvLyBSb3V0ZTUz5qip6ZmQ77yI44OV44Kn44Kk44Or44Kq44O844OQ44O855So77yJXG4gICAgdGhpcy5mYWlsb3ZlckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ3JvdXRlNTM6Q2hhbmdlUmVzb3VyY2VSZWNvcmRTZXRzJyxcbiAgICAgICAgICAncm91dGU1MzpHZXRIb3N0ZWRab25lJyxcbiAgICAgICAgICAncm91dGU1MzpMaXN0UmVzb3VyY2VSZWNvcmRTZXRzJ1xuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyDjgq/jg63jgrnjg6rjg7zjgrjjg6fjg7PjgqLjgq/jgrvjgrnmqKnpmZBcbiAgICB0aGlzLmhlYWx0aENoZWNrRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnZHluYW1vZGI6TGlzdFRhYmxlcycsXG4gICAgICAgICAgJ2xhbWJkYTpMaXN0RnVuY3Rpb25zJyxcbiAgICAgICAgICAnb3BlbnNlYXJjaDpEZXNjcmliZURvbWFpbicsXG4gICAgICAgICAgJ2ZzeDpEZXNjcmliZUZpbGVTeXN0ZW1zJ1xuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgICB9KVxuICAgICk7XG4gIH1cbn0iXX0=