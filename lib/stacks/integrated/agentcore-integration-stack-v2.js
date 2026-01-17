"use strict";
/**
 * AgentCore統合スタック v2
 * Task 3.2: ハイブリッドアーキテクチャ統合
 *
 * AWS_REGION問題を回避した新しい実装
 * Fresh AgentCore Stackをベースに既存設定インターフェースと統合
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentCoreIntegrationStackV2 = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const aws_dynamodb_1 = require("aws-cdk-lib/aws-dynamodb");
const aws_apigateway_1 = require("aws-cdk-lib/aws-apigateway");
const aws_events_1 = require("aws-cdk-lib/aws-events");
const aws_events_targets_1 = require("aws-cdk-lib/aws-events-targets");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const aws_logs_1 = require("aws-cdk-lib/aws-logs");
const aws_cloudwatch_1 = require("aws-cdk-lib/aws-cloudwatch");
const aws_cloudwatch_actions_1 = require("aws-cdk-lib/aws-cloudwatch-actions");
const aws_sns_1 = require("aws-cdk-lib/aws-sns");
/**
 * AgentCore統合スタック v2
 *
 * AWS_REGION問題を回避した実装:
 * - Fresh AgentCore Stackをベースに構築
 * - 既存の設定インターフェースとの互換性を保持
 * - 機能フラグによる制御をサポート
 *
 * 責任分離アーキテクチャを実現:
 * - Next.js: UI/UX処理、認証、設定管理
 * - AgentCore Runtime: AI処理、推論、モデル呼び出し
 * - API Gateway: 疎結合統合
 */
class AgentCoreIntegrationStackV2 extends aws_cdk_lib_1.Stack {
    // パブリックプロパティ（他スタックから参照可能）
    agentCoreRuntimeFunction;
    userPreferencesTable;
    agentCoreApi;
    hybridEventBus;
    monitoringTopic;
    // プライベートプロパティ
    config;
    featureFlags;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.config = props.config;
        this.featureFlags = props.featureFlags;
        // 機能フラグチェック
        if (!this.featureFlags.enableAgentCoreIntegration) {
            console.log('[AgentCoreIntegrationStackV2] AgentCore統合が無効化されています');
            return;
        }
        console.log('[AgentCoreIntegrationStackV2] AgentCore統合スタック v2 初期化開始...');
        // 1. ユーザー設定永続化（最優先）
        if (this.featureFlags.enableUserPreferences) {
            this.createUserPreferencesInfrastructure();
        }
        // 2. AgentCore Runtime（コア機能）
        this.createAgentCoreRuntime();
        // 3. ハイブリッドアーキテクチャ統合
        if (this.featureFlags.enableHybridArchitecture) {
            this.createHybridArchitecture();
        }
        // 4. 監視・アラート
        if (this.config.agentCore?.monitoring?.enabled) {
            this.createMonitoringInfrastructure();
        }
        // 5. CloudFormation Outputs
        this.createOutputs();
        console.log('[AgentCoreIntegrationStackV2] AgentCore統合スタック v2 初期化完了');
    }
    /**
     * ユーザー設定永続化インフラストラクチャ
     */
    createUserPreferencesInfrastructure() {
        if (!this.config.userPreferences?.enabled)
            return;
        const preferencesConfig = this.config.userPreferences;
        // DynamoDB テーブル
        const userPreferencesTable = new aws_dynamodb_1.Table(this, 'UserPreferencesTable', {
            tableName: preferencesConfig.dynamodb.tableName,
            partitionKey: {
                name: 'userId',
                type: aws_dynamodb_1.AttributeType.STRING,
            },
            sortKey: {
                name: 'settingKey',
                type: aws_dynamodb_1.AttributeType.STRING,
            },
            billingMode: preferencesConfig.dynamodb.billingMode === 'PROVISIONED'
                ? aws_dynamodb_1.BillingMode.PROVISIONED
                : aws_dynamodb_1.BillingMode.PAY_PER_REQUEST,
            // プロビジョンドスループット（必要な場合）
            ...(preferencesConfig.dynamodb.billingMode === 'PROVISIONED' && preferencesConfig.dynamodb.provisionedThroughput ? {
                readCapacity: preferencesConfig.dynamodb.provisionedThroughput.readCapacityUnits,
                writeCapacity: preferencesConfig.dynamodb.provisionedThroughput.writeCapacityUnits,
            } : {}),
            // TTL設定
            timeToLiveAttribute: preferencesConfig.dynamodb.ttl.enabled
                ? preferencesConfig.dynamodb.ttl.attributeName
                : undefined,
            // 暗号化
            encryption: preferencesConfig.dynamodb.encryption.enabled
                ? aws_dynamodb_1.TableEncryption.CUSTOMER_MANAGED
                : aws_dynamodb_1.TableEncryption.AWS_MANAGED,
            // 削除保護
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.RETAIN,
        });
        // readonlyプロパティに代入するため、型アサーションを使用
        this.userPreferencesTable = userPreferencesTable;
        console.log(`[AgentCoreIntegrationStackV2] ユーザー設定テーブル作成: ${preferencesConfig.dynamodb.tableName}`);
    }
    /**
     * AgentCore Runtime作成
     * Fresh AgentCore Stackベースの実装（AWS_REGION問題を回避）
     */
    createAgentCoreRuntime() {
        console.log('[AgentCoreIntegrationStackV2] AgentCore Runtime作成開始...');
        // IAM Role
        const agentCoreRole = new aws_iam_1.Role(this, 'AgentCoreRuntimeRole', {
            assumedBy: new aws_iam_1.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // Bedrock アクセス権限
        agentCoreRole.addToPolicy(new aws_iam_1.PolicyStatement({
            effect: aws_iam_1.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
                'bedrock:GetFoundationModel',
                'bedrock:ListFoundationModels',
            ],
            resources: ['*'],
        }));
        // ユーザー設定テーブルアクセス権限
        if (this.userPreferencesTable) {
            this.userPreferencesTable.grantReadWriteData(agentCoreRole);
        }
        // Lambda Function（Fresh Stackベースの実装）
        const functionName = this.config.agentCore?.runtime?.lambda?.functionName ||
            `${this.config.projectName}-agentcore-runtime`;
        const agentCoreRuntimeFunction = new aws_lambda_1.Function(this, 'AgentCoreRuntimeFunction', {
            functionName: functionName,
            runtime: aws_lambda_1.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: aws_lambda_1.Code.fromInline(`
        // AgentCore Runtime Lambda Function v2
        // AWS_REGION問題を回避した実装
        exports.handler = async (event) => {
          console.log('AgentCore Runtime v2 Event:', JSON.stringify(event, null, 2));
          
          // ヘルスチェック応答
          if (event.httpMethod === 'GET' && (event.path === '/health' || event.rawPath === '/health')) {
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
              body: JSON.stringify({
                status: 'healthy',
                version: '2.0.0',
                timestamp: new Date().toISOString(),
                runtime: 'agentcore-v2'
              })
            };
          }
          
          // AgentCore処理エンドポイント
          if (event.httpMethod === 'POST' && (event.path === '/agentcore' || event.rawPath === '/agentcore')) {
            try {
              const requestBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
              
              // 基本的なAgentCore処理のプレースホルダー
              const response = {
                success: true,
                response: 'AgentCore Runtime v2 is operational',
                source: 'agentcore-v2',
                timestamp: new Date().toISOString(),
                request: requestBody,
                capabilities: [
                  'AI Processing',
                  'Model Inference', 
                  'Knowledge Base Query',
                  'Response Generation'
                ]
              };
              
              return {
                statusCode: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify(response)
              };
            } catch (error) {
              return {
                statusCode: 500,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                  success: false,
                  error: error.message,
                  timestamp: new Date().toISOString()
                })
              };
            }
          }
          
          // デフォルト応答
          return {
            statusCode: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              error: 'Not Found',
              message: 'AgentCore Runtime v2 - Endpoint not found',
              timestamp: new Date().toISOString()
            })
          };
        };
      `),
            timeout: aws_cdk_lib_1.Duration.seconds(this.config.agentCore?.runtime?.lambda?.timeout || 300),
            memorySize: this.config.agentCore?.runtime?.lambda?.memorySize || 1024,
            role: agentCoreRole,
            // 環境変数は設定しない（AWS_REGION問題を回避）
            architecture: aws_lambda_1.Architecture.ARM_64, // コスト最適化
        });
        // readonlyプロパティに代入するため、型アサーションを使用
        this.agentCoreRuntimeFunction = agentCoreRuntimeFunction;
        // CloudWatch Logs
        new aws_logs_1.LogGroup(this, 'AgentCoreRuntimeLogGroup', {
            logGroupName: `/aws/lambda/${agentCoreRuntimeFunction.functionName}`,
            retention: aws_logs_1.RetentionDays.ONE_WEEK,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        console.log(`[AgentCoreIntegrationStackV2] AgentCore Runtime作成完了: ${functionName}`);
    }
    /**
     * ハイブリッドアーキテクチャ統合
     */
    createHybridArchitecture() {
        if (!this.config.hybridArchitecture?.enabled)
            return;
        console.log('[AgentCoreIntegrationStackV2] ハイブリッドアーキテクチャ統合開始...');
        const hybridConfig = this.config.hybridArchitecture;
        // API Gateway（AgentCore Runtime用）- オプション
        if (hybridConfig.integration.apiGateway.enabled && this.agentCoreRuntimeFunction) {
            console.log('[AgentCoreIntegrationStackV2] API Gateway統合開始...');
            const agentCoreApi = new aws_apigateway_1.RestApi(this, 'AgentCoreApi', {
                restApiName: `${this.config.projectName}-agentcore-api-v2`,
                description: 'AgentCore Runtime API v2 for Hybrid Architecture',
                defaultCorsPreflightOptions: {
                    allowOrigins: aws_apigateway_1.Cors.ALL_ORIGINS,
                    allowMethods: aws_apigateway_1.Cors.ALL_METHODS,
                    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
                },
            });
            // readonlyプロパティに代入するため、型アサーションを使用
            this.agentCoreApi = agentCoreApi;
            // Lambda統合
            const agentCoreIntegration = new aws_apigateway_1.LambdaIntegration(this.agentCoreRuntimeFunction, {
                proxy: true,
                allowTestInvoke: true,
            });
            // ルート設定
            const agentCoreResource = agentCoreApi.root.addResource('agentcore');
            agentCoreResource.addMethod('POST', agentCoreIntegration);
            agentCoreResource.addMethod('GET', agentCoreIntegration); // ヘルスチェック用
            // ヘルスチェック専用エンドポイント
            const healthResource = agentCoreApi.root.addResource('health');
            healthResource.addMethod('GET', agentCoreIntegration);
            console.log('[AgentCoreIntegrationStackV2] API Gateway作成完了');
        }
        else {
            console.log('[AgentCoreIntegrationStackV2] API Gateway統合をスキップ（設定により無効化）');
        }
        // EventBridge（イベント駆動統合）
        if (hybridConfig.integration.eventBridge.enabled) {
            const hybridEventBus = new aws_events_1.EventBus(this, 'HybridEventBus', {
                eventBusName: hybridConfig.integration.eventBridge.customBus.name,
            });
            // readonlyプロパティに代入するため、型アサーションを使用
            this.hybridEventBus = hybridEventBus;
            // AgentCore処理完了イベントルール
            if (this.agentCoreRuntimeFunction) {
                new aws_events_1.Rule(this, 'AgentCoreProcessingRule', {
                    eventBus: hybridEventBus,
                    eventPattern: {
                        source: ['agentcore.runtime.v2'],
                        detailType: ['Processing Complete', 'Processing Failed'],
                    },
                    targets: [
                        new aws_events_targets_1.LambdaFunction(this.agentCoreRuntimeFunction, {
                            event: aws_events_1.RuleTargetInput.fromObject({
                                eventType: 'agentcore-event-v2',
                                timestamp: '$.time',
                                detail: '$.detail',
                            }),
                        }),
                    ],
                });
            }
            console.log('[AgentCoreIntegrationStackV2] EventBridge統合完了');
        }
    }
    /**
     * 監視・アラートインフラストラクチャ
     */
    createMonitoringInfrastructure() {
        if (!this.config.agentCore?.monitoring?.enabled)
            return;
        console.log('[AgentCoreIntegrationStackV2] 監視インフラストラクチャ作成開始...');
        // SNS Topic（アラート通知用）
        const monitoringTopic = new aws_sns_1.Topic(this, 'AgentCoreMonitoringTopic', {
            topicName: `${this.config.projectName}-agentcore-v2-${this.config.environment}-alerts`,
        });
        // readonlyプロパティに代入するため、型アサーションを使用
        this.monitoringTopic = monitoringTopic;
        // AgentCore Runtime監視
        if (this.agentCoreRuntimeFunction) {
            // エラー率アラーム
            const errorRateAlarm = new aws_cloudwatch_1.Alarm(this, 'AgentCoreErrorRateAlarm', {
                metric: this.agentCoreRuntimeFunction.metricErrors({
                    period: aws_cdk_lib_1.Duration.minutes(5),
                }),
                threshold: 5, // 5分間で5エラー以上
                evaluationPeriods: 2,
                comparisonOperator: aws_cloudwatch_1.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                alarmDescription: 'AgentCore Runtime v2 error rate is high',
            });
            errorRateAlarm.addAlarmAction(new aws_cloudwatch_actions_1.SnsAction(monitoringTopic));
            // レイテンシアラーム
            const latencyAlarm = new aws_cloudwatch_1.Alarm(this, 'AgentCoreLatencyAlarm', {
                metric: this.agentCoreRuntimeFunction.metricDuration({
                    period: aws_cdk_lib_1.Duration.minutes(5),
                }),
                threshold: 30000, // 30秒
                evaluationPeriods: 3,
                comparisonOperator: aws_cloudwatch_1.ComparisonOperator.GREATER_THAN_THRESHOLD,
                alarmDescription: 'AgentCore Runtime v2 latency is high',
            });
            latencyAlarm.addAlarmAction(new aws_cloudwatch_actions_1.SnsAction(monitoringTopic));
        }
        // ユーザー設定テーブル監視
        if (this.userPreferencesTable) {
            const readThrottleAlarm = new aws_cloudwatch_1.Alarm(this, 'PreferencesTableReadThrottleAlarm', {
                metric: new aws_cloudwatch_1.Metric({
                    namespace: 'AWS/DynamoDB',
                    metricName: 'ReadThrottledEvents',
                    dimensionsMap: {
                        TableName: this.userPreferencesTable.tableName,
                    },
                    period: aws_cdk_lib_1.Duration.minutes(5),
                }),
                threshold: 1,
                evaluationPeriods: 1,
                comparisonOperator: aws_cloudwatch_1.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                alarmDescription: 'User preferences table read throttling detected',
            });
            readThrottleAlarm.addAlarmAction(new aws_cloudwatch_actions_1.SnsAction(monitoringTopic));
        }
        console.log('[AgentCoreIntegrationStackV2] 監視インフラストラクチャ作成完了');
    }
    /**
     * CloudFormation Outputs
     */
    createOutputs() {
        // AgentCore Runtime Function ARN
        if (this.agentCoreRuntimeFunction) {
            new aws_cdk_lib_1.CfnOutput(this, 'AgentCoreRuntimeFunctionArn', {
                value: this.agentCoreRuntimeFunction.functionArn,
                description: 'AgentCore Runtime v2 Lambda Function ARN',
                exportName: `${this.stackName}-AgentCoreRuntimeFunctionArn`,
            });
            new aws_cdk_lib_1.CfnOutput(this, 'AgentCoreRuntimeFunctionName', {
                value: this.agentCoreRuntimeFunction.functionName,
                description: 'AgentCore Runtime v2 Lambda Function Name',
                exportName: `${this.stackName}-AgentCoreRuntimeFunctionName`,
            });
        }
        // ユーザー設定テーブル
        if (this.userPreferencesTable) {
            new aws_cdk_lib_1.CfnOutput(this, 'UserPreferencesTableName', {
                value: this.userPreferencesTable.tableName,
                description: 'User Preferences DynamoDB Table Name',
                exportName: `${this.stackName}-UserPreferencesTableName`,
            });
            new aws_cdk_lib_1.CfnOutput(this, 'UserPreferencesTableArn', {
                value: this.userPreferencesTable.tableArn,
                description: 'User Preferences DynamoDB Table ARN',
                exportName: `${this.stackName}-UserPreferencesTableArn`,
            });
        }
        // API Gateway
        if (this.agentCoreApi) {
            new aws_cdk_lib_1.CfnOutput(this, 'AgentCoreApiId', {
                value: this.agentCoreApi.restApiId,
                description: 'AgentCore API Gateway v2 ID',
                exportName: `${this.stackName}-AgentCoreApiId`,
            });
            new aws_cdk_lib_1.CfnOutput(this, 'AgentCoreApiUrl', {
                value: this.agentCoreApi.url,
                description: 'AgentCore API Gateway v2 URL',
                exportName: `${this.stackName}-AgentCoreApiUrl`,
            });
        }
        // EventBridge
        if (this.hybridEventBus) {
            new aws_cdk_lib_1.CfnOutput(this, 'HybridEventBusArn', {
                value: this.hybridEventBus.eventBusArn,
                description: 'Hybrid Architecture EventBridge Bus ARN',
                exportName: `${this.stackName}-HybridEventBusArn`,
            });
            new aws_cdk_lib_1.CfnOutput(this, 'HybridEventBusName', {
                value: this.hybridEventBus.eventBusName,
                description: 'Hybrid Architecture EventBridge Bus Name',
                exportName: `${this.stackName}-HybridEventBusName`,
            });
        }
        // 監視トピック
        if (this.monitoringTopic) {
            new aws_cdk_lib_1.CfnOutput(this, 'MonitoringTopicArn', {
                value: this.monitoringTopic.topicArn,
                description: 'AgentCore v2 Monitoring SNS Topic ARN',
                exportName: `${this.stackName}-MonitoringTopicArn`,
            });
        }
        // 機能フラグ状態
        new aws_cdk_lib_1.CfnOutput(this, 'FeatureFlagsStatus', {
            value: JSON.stringify({
                agentCoreIntegration: this.featureFlags.enableAgentCoreIntegration,
                hybridArchitecture: this.featureFlags.enableHybridArchitecture,
                userPreferences: this.featureFlags.enableUserPreferences,
                version: '2.0.0',
            }),
            description: 'AgentCore Integration v2 Feature Flags Status',
        });
        console.log('[AgentCoreIntegrationStackV2] CloudFormation Outputs作成完了');
    }
}
exports.AgentCoreIntegrationStackV2 = AgentCoreIntegrationStackV2;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRjb3JlLWludGVncmF0aW9uLXN0YWNrLXYyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWdlbnRjb3JlLWludGVncmF0aW9uLXN0YWNrLXYyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILDZDQUFvRjtBQUVwRix1REFBK0U7QUFDL0UsMkRBQThGO0FBQzlGLCtEQUE4RTtBQUM5RSx1REFBeUU7QUFDekUsdUVBQWdFO0FBQ2hFLGlEQUFxRztBQUNyRyxtREFBK0Q7QUFDL0QsK0RBQStFO0FBQy9FLCtFQUErRDtBQUMvRCxpREFBNEM7QUE0QjVDOzs7Ozs7Ozs7Ozs7R0FZRztBQUNILE1BQWEsMkJBQTRCLFNBQVEsbUJBQUs7SUFDcEQsMEJBQTBCO0lBQ1Ysd0JBQXdCLENBQVk7SUFDcEMsb0JBQW9CLENBQVM7SUFDN0IsWUFBWSxDQUFXO0lBQ3ZCLGNBQWMsQ0FBWTtJQUMxQixlQUFlLENBQVM7SUFFeEMsY0FBYztJQUNHLE1BQU0sQ0FBNkI7SUFDbkMsWUFBWSxDQUFtRDtJQUVoRixZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXVDO1FBQy9FLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztRQUMzQixJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUM7UUFFdkMsWUFBWTtRQUNaLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLDBCQUEwQixFQUFFLENBQUM7WUFDbEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO1lBQ25FLE9BQU87UUFDVCxDQUFDO1FBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQywyREFBMkQsQ0FBQyxDQUFDO1FBRXpFLG9CQUFvQjtRQUNwQixJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMscUJBQXFCLEVBQUUs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WSxDQUFDLHFCQUFxQjtnQkFDeEQsT0FBTyxFQUFFLE9BQU87YUFDakIsQ0FBQztZQUNGLFdBQVcsRUFBRSwrQ0FBK0M7U0FDN0QsQ0FBQyxDQUFDO1FBRUgsT0FBTyxDQUFDLEdBQUcsQ0FBQywwREFBMEQsQ0FBQyxDQUFDO0lBQzFFLENBQUM7Q0FDRjtBQTNkRCxrRUEyZEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFnZW50Q29yZee1seWQiOOCueOCv+ODg+OCryB2MlxuICogVGFzayAzLjI6IOODj+OCpOODluODquODg+ODieOCouODvOOCreODhuOCr+ODgeODo+e1seWQiFxuICogXG4gKiBBV1NfUkVHSU9O5ZWP6aGM44KS5Zue6YG/44GX44Gf5paw44GX44GE5a6f6KOFXG4gKiBGcmVzaCBBZ2VudENvcmUgU3RhY2vjgpLjg5njg7zjgrnjgavml6LlrZjoqK3lrprjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrnjgajntbHlkIhcbiAqL1xuXG5pbXBvcnQgeyBTdGFjaywgU3RhY2tQcm9wcywgQ2ZuT3V0cHV0LCBEdXJhdGlvbiwgUmVtb3ZhbFBvbGljeSB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRnVuY3Rpb24sIFJ1bnRpbWUsIENvZGUsIEFyY2hpdGVjdHVyZSB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgVGFibGUsIEF0dHJpYnV0ZVR5cGUsIEJpbGxpbmdNb2RlLCBUYWJsZUVuY3J5cHRpb24gfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0IHsgUmVzdEFwaSwgTGFtYmRhSW50ZWdyYXRpb24sIENvcnMgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgeyBFdmVudEJ1cywgUnVsZSwgUnVsZVRhcmdldElucHV0IH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgeyBMYW1iZGFGdW5jdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgeyBSb2xlLCBTZXJ2aWNlUHJpbmNpcGFsLCBQb2xpY3lTdGF0ZW1lbnQsIEVmZmVjdCwgTWFuYWdlZFBvbGljeSB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgTG9nR3JvdXAsIFJldGVudGlvbkRheXMgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBBbGFybSwgTWV0cmljLCBDb21wYXJpc29uT3BlcmF0b3IgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgeyBTbnNBY3Rpb24gfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcbmltcG9ydCB7IFRvcGljIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgeyBBZ2VudENvcmVJbnRlZ3JhdGlvbkNvbmZpZyB9IGZyb20gJy4uLy4uL2NvbmZpZy9pbnRlcmZhY2VzL2Vudmlyb25tZW50LWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQWdlbnRDb3JlSW50ZWdyYXRpb25TdGFja1YyUHJvcHMgZXh0ZW5kcyBTdGFja1Byb3BzIHtcbiAgLyoqXG4gICAqIOe1seWQiOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgY29uZmlnOiBBZ2VudENvcmVJbnRlZ3JhdGlvbkNvbmZpZztcblxuICAvKipcbiAgICog5qmf6IO944OV44Op44KwXG4gICAqL1xuICByZWFkb25seSBmZWF0dXJlRmxhZ3M6IHtcbiAgICByZWFkb25seSBlbmFibGVBZ2VudENvcmVJbnRlZ3JhdGlvbjogYm9vbGVhbjtcbiAgICByZWFkb25seSBlbmFibGVIeWJyaWRBcmNoaXRlY3R1cmU6IGJvb2xlYW47XG4gICAgcmVhZG9ubHkgZW5hYmxlVXNlclByZWZlcmVuY2VzOiBib29sZWFuO1xuICB9O1xuXG4gIC8qKlxuICAgKiDml6LlrZjjg6rjgr3jg7zjgrnlj4LnhadcbiAgICovXG4gIHJlYWRvbmx5IGV4aXN0aW5nUmVzb3VyY2VzPzoge1xuICAgIHJlYWRvbmx5IHZwY0lkPzogc3RyaW5nO1xuICAgIHJlYWRvbmx5IHN1Ym5ldElkcz86IHN0cmluZ1tdO1xuICAgIHJlYWRvbmx5IHNlY3VyaXR5R3JvdXBJZHM/OiBzdHJpbmdbXTtcbiAgfTtcbn1cblxuLyoqXG4gKiBBZ2VudENvcmXntbHlkIjjgrnjgr/jg4Pjgq8gdjJcbiAqIFxuICogQVdTX1JFR0lPTuWVj+mhjOOCkuWbnumBv+OBl+OBn+Wun+ijhTpcbiAqIC0gRnJlc2ggQWdlbnRDb3JlIFN0YWNr44KS44OZ44O844K544Gr5qeL56+JXG4gKiAtIOaXouWtmOOBruioreWumuOCpOODs+OCv+ODvOODleOCp+ODvOOCueOBqOOBruS6kuaPm+aAp+OCkuS/neaMgVxuICogLSDmqZ/og73jg5Xjg6njgrDjgavjgojjgovliLblvqHjgpLjgrXjg53jg7zjg4hcbiAqIFxuICog6LKs5Lu75YiG6Zui44Ki44O844Kt44OG44Kv44OB44Oj44KS5a6f54++OlxuICogLSBOZXh0LmpzOiBVSS9VWOWHpueQhuOAgeiqjeiovOOAgeioreWumueuoeeQhlxuICogLSBBZ2VudENvcmUgUnVudGltZTogQUnlh6bnkIbjgIHmjqjoq5bjgIHjg6Ljg4fjg6vlkbzjgbPlh7rjgZdcbiAqIC0gQVBJIEdhdGV3YXk6IOeWjue1kOWQiOe1seWQiFxuICovXG5leHBvcnQgY2xhc3MgQWdlbnRDb3JlSW50ZWdyYXRpb25TdGFja1YyIGV4dGVuZHMgU3RhY2sge1xuICAvLyDjg5Hjg5bjg6rjg4Pjgq/jg5fjg63jg5Hjg4bjgqPvvIjku5bjgrnjgr/jg4Pjgq/jgYvjgonlj4Lnhaflj6/og73vvIlcbiAgcHVibGljIHJlYWRvbmx5IGFnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbj86IEZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclByZWZlcmVuY2VzVGFibGU/OiBUYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IGFnZW50Q29yZUFwaT86IFJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSBoeWJyaWRFdmVudEJ1cz86IEV2ZW50QnVzO1xuICBwdWJsaWMgcmVhZG9ubHkgbW9uaXRvcmluZ1RvcGljPzogVG9waWM7XG5cbiAgLy8g44OX44Op44Kk44OZ44O844OI44OX44Ot44OR44OG44KjXG4gIHByaXZhdGUgcmVhZG9ubHkgY29uZmlnOiBBZ2VudENvcmVJbnRlZ3JhdGlvbkNvbmZpZztcbiAgcHJpdmF0ZSByZWFkb25seSBmZWF0dXJlRmxhZ3M6IEFnZW50Q29yZUludGVncmF0aW9uU3RhY2tWMlByb3BzWydmZWF0dXJlRmxhZ3MnXTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQWdlbnRDb3JlSW50ZWdyYXRpb25TdGFja1YyUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIHRoaXMuY29uZmlnID0gcHJvcHMuY29uZmlnO1xuICAgIHRoaXMuZmVhdHVyZUZsYWdzID0gcHJvcHMuZmVhdHVyZUZsYWdzO1xuXG4gICAgLy8g5qmf6IO944OV44Op44Kw44OB44Kn44OD44KvXG4gICAgaWYgKCF0aGlzLmZlYXR1cmVGbGFncy5lbmFibGVBZ2VudENvcmVJbnRlZ3JhdGlvbikge1xuICAgICAgY29uc29sZS5sb2coJ1tBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrVjJdIEFnZW50Q29yZee1seWQiOOBjOeEoeWKueWMluOBleOCjOOBpuOBhOOBvuOBmScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCdbQWdlbnRDb3JlSW50ZWdyYXRpb25TdGFja1YyXSBBZ2VudENvcmXntbHlkIjjgrnjgr/jg4Pjgq8gdjIg5Yid5pyf5YyW6ZaL5aeLLi4uJyk7XG5cbiAgICAvLyAxLiDjg6bjg7zjgrbjg7zoqK3lrprmsLjntprljJbvvIjmnIDlhKrlhYjvvIlcbiAgICBpZiAodGhpcy5mZWF0dXJlRmxhZ3MuZW5hYmxlVXNlclByZWZlcmVuY2VzKSB7XG4gICAgICB0aGlzLmNyZWF0ZVVzZXJQcmVmZXJlbmNlc0luZnJhc3RydWN0dXJlKCk7XG4gICAgfVxuXG4gICAgLy8gMi4gQWdlbnRDb3JlIFJ1bnRpbWXvvIjjgrPjgqLmqZ/og73vvIlcbiAgICB0aGlzLmNyZWF0ZUFnZW50Q29yZVJ1bnRpbWUoKTtcblxuICAgIC8vIDMuIOODj+OCpOODluODquODg+ODieOCouODvOOCreODhuOCr+ODgeODo+e1seWQiFxuICAgIGlmICh0aGlzLmZlYXR1cmVGbGFncy5lbmFibGVIeWJyaWRBcmNoaXRlY3R1cmUpIHtcbiAgICAgIHRoaXMuY3JlYXRlSHlicmlkQXJjaGl0ZWN0dXJlKCk7XG4gICAgfVxuXG4gICAgLy8gNC4g55uj6KaW44O744Ki44Op44O844OIXG4gICAgaWYgKHRoaXMuY29uZmlnLmFnZW50Q29yZT8ubW9uaXRvcmluZz8uZW5hYmxlZCkge1xuICAgICAgdGhpcy5jcmVhdGVNb25pdG9yaW5nSW5mcmFzdHJ1Y3R1cmUoKTtcbiAgICB9XG5cbiAgICAvLyA1LiBDbG91ZEZvcm1hdGlvbiBPdXRwdXRzXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKCk7XG5cbiAgICBjb25zb2xlLmxvZygnW0FnZW50Q29yZUludGVncmF0aW9uU3RhY2tWMl0gQWdlbnRDb3Jl57Wx5ZCI44K544K/44OD44KvIHYyIOWIneacn+WMluWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODpuODvOOCtuODvOioreWumuawuOe2muWMluOCpOODs+ODleODqeOCueODiOODqeOCr+ODgeODo1xuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVVc2VyUHJlZmVyZW5jZXNJbmZyYXN0cnVjdHVyZSgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY29uZmlnLnVzZXJQcmVmZXJlbmNlcz8uZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgcHJlZmVyZW5jZXNDb25maWcgPSB0aGlzLmNvbmZpZy51c2VyUHJlZmVyZW5jZXM7XG5cbiAgICAvLyBEeW5hbW9EQiDjg4bjg7zjg5bjg6tcbiAgICBjb25zdCB1c2VyUHJlZmVyZW5jZXNUYWJsZSA9IG5ldyBUYWJsZSh0aGlzLCAnVXNlclByZWZlcmVuY2VzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IHByZWZlcmVuY2VzQ29uZmlnLmR5bmFtb2RiLnRhYmxlTmFtZSxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXNlcklkJyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnc2V0dGluZ0tleScsXG4gICAgICAgIHR5cGU6IEF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBwcmVmZXJlbmNlc0NvbmZpZy5keW5hbW9kYi5iaWxsaW5nTW9kZSA9PT0gJ1BST1ZJU0lPTkVEJyBcbiAgICAgICAgPyBCaWxsaW5nTW9kZS5QUk9WSVNJT05FRCBcbiAgICAgICAgOiBCaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBcbiAgICAgIC8vIOODl+ODreODk+OCuOODp+ODs+ODieOCueODq+ODvOODl+ODg+ODiO+8iOW/heimgeOBquWgtOWQiO+8iVxuICAgICAgLi4uKHByZWZlcmVuY2VzQ29uZmlnLmR5bmFtb2RiLmJpbGxpbmdNb2RlID09PSAnUFJPVklTSU9ORUQnICYmIHByZWZlcmVuY2VzQ29uZmlnLmR5bmFtb2RiLnByb3Zpc2lvbmVkVGhyb3VnaHB1dCA/IHtcbiAgICAgICAgcmVhZENhcGFjaXR5OiBwcmVmZXJlbmNlc0NvbmZpZy5keW5hbW9kYi5wcm92aXNpb25lZFRocm91Z2hwdXQucmVhZENhcGFjaXR5VW5pdHMsXG4gICAgICAgIHdyaXRlQ2FwYWNpdHk6IHByZWZlcmVuY2VzQ29uZmlnLmR5bmFtb2RiLnByb3Zpc2lvbmVkVGhyb3VnaHB1dC53cml0ZUNhcGFjaXR5VW5pdHMsXG4gICAgICB9IDoge30pLFxuXG4gICAgICAvLyBUVEzoqK3lrppcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6IHByZWZlcmVuY2VzQ29uZmlnLmR5bmFtb2RiLnR0bC5lbmFibGVkIFxuICAgICAgICA/IHByZWZlcmVuY2VzQ29uZmlnLmR5bmFtb2RiLnR0bC5hdHRyaWJ1dGVOYW1lIFxuICAgICAgICA6IHVuZGVmaW5lZCxcblxuICAgICAgLy8g5pqX5Y+35YyWXG4gICAgICBlbmNyeXB0aW9uOiBwcmVmZXJlbmNlc0NvbmZpZy5keW5hbW9kYi5lbmNyeXB0aW9uLmVuYWJsZWRcbiAgICAgICAgPyBUYWJsZUVuY3J5cHRpb24uQ1VTVE9NRVJfTUFOQUdFRFxuICAgICAgICA6IFRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcblxuICAgICAgLy8g5YmK6Zmk5L+d6K23XG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcblxuICAgIC8vIHJlYWRvbmx544OX44Ot44OR44OG44Kj44Gr5Luj5YWl44GZ44KL44Gf44KB44CB5Z6L44Ki44K144O844K344On44Oz44KS5L2/55SoXG4gICAgKHRoaXMgYXMgYW55KS51c2VyUHJlZmVyZW5jZXNUYWJsZSA9IHVzZXJQcmVmZXJlbmNlc1RhYmxlO1xuXG4gICAgY29uc29sZS5sb2coYFtBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrVjJdIOODpuODvOOCtuODvOioreWumuODhuODvOODluODq+S9nOaIkDogJHtwcmVmZXJlbmNlc0NvbmZpZy5keW5hbW9kYi50YWJsZU5hbWV9YCk7XG4gIH1cblxuICAvKipcbiAgICogQWdlbnRDb3JlIFJ1bnRpbWXkvZzmiJBcbiAgICogRnJlc2ggQWdlbnRDb3JlIFN0YWNr44OZ44O844K544Gu5a6f6KOF77yIQVdTX1JFR0lPTuWVj+mhjOOCkuWbnumBv++8iVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVBZ2VudENvcmVSdW50aW1lKCk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKCdbQWdlbnRDb3JlSW50ZWdyYXRpb25TdGFja1YyXSBBZ2VudENvcmUgUnVudGltZeS9nOaIkOmWi+Wniy4uLicpO1xuXG4gICAgLy8gSUFNIFJvbGVcbiAgICBjb25zdCBhZ2VudENvcmVSb2xlID0gbmV3IFJvbGUodGhpcywgJ0FnZW50Q29yZVJ1bnRpbWVSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBNYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEJlZHJvY2sg44Ki44Kv44K744K55qip6ZmQXG4gICAgYWdlbnRDb3JlUm9sZS5hZGRUb1BvbGljeShuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcbiAgICAgICAgJ2JlZHJvY2s6R2V0Rm91bmRhdGlvbk1vZGVsJyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEZvdW5kYXRpb25Nb2RlbHMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgLy8g44Om44O844K244O86Kit5a6a44OG44O844OW44Or44Ki44Kv44K744K55qip6ZmQXG4gICAgaWYgKHRoaXMudXNlclByZWZlcmVuY2VzVGFibGUpIHtcbiAgICAgIHRoaXMudXNlclByZWZlcmVuY2VzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFnZW50Q29yZVJvbGUpO1xuICAgIH1cblxuICAgIC8vIExhbWJkYSBGdW5jdGlvbu+8iEZyZXNoIFN0YWNr44OZ44O844K544Gu5a6f6KOF77yJXG4gICAgY29uc3QgZnVuY3Rpb25OYW1lID0gdGhpcy5jb25maWcuYWdlbnRDb3JlPy5ydW50aW1lPy5sYW1iZGE/LmZ1bmN0aW9uTmFtZSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgIGAke3RoaXMuY29uZmlnLnByb2plY3ROYW1lfS1hZ2VudGNvcmUtcnVudGltZWA7XG4gICAgXG4gICAgY29uc3QgYWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uID0gbmV3IEZ1bmN0aW9uKHRoaXMsICdBZ2VudENvcmVSdW50aW1lRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGZ1bmN0aW9uTmFtZSxcbiAgICAgIHJ1bnRpbWU6IFJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBDb2RlLmZyb21JbmxpbmUoYFxuICAgICAgICAvLyBBZ2VudENvcmUgUnVudGltZSBMYW1iZGEgRnVuY3Rpb24gdjJcbiAgICAgICAgLy8gQVdTX1JFR0lPTuWVj+mhjOOCkuWbnumBv+OBl+OBn+Wun+ijhVxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZygnQWdlbnRDb3JlIFJ1bnRpbWUgdjIgRXZlbnQ6JywgSlNPTi5zdHJpbmdpZnkoZXZlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyDjg5jjg6vjgrnjg4Hjgqfjg4Pjgq/lv5znrZRcbiAgICAgICAgICBpZiAoZXZlbnQuaHR0cE1ldGhvZCA9PT0gJ0dFVCcgJiYgKGV2ZW50LnBhdGggPT09ICcvaGVhbHRoJyB8fCBldmVudC5yYXdQYXRoID09PSAnL2hlYWx0aCcpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdoZWFsdGh5JyxcbiAgICAgICAgICAgICAgICB2ZXJzaW9uOiAnMi4wLjAnLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHJ1bnRpbWU6ICdhZ2VudGNvcmUtdjInXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBBZ2VudENvcmXlh6bnkIbjgqjjg7Pjg4njg53jgqTjg7Pjg4hcbiAgICAgICAgICBpZiAoZXZlbnQuaHR0cE1ldGhvZCA9PT0gJ1BPU1QnICYmIChldmVudC5wYXRoID09PSAnL2FnZW50Y29yZScgfHwgZXZlbnQucmF3UGF0aCA9PT0gJy9hZ2VudGNvcmUnKSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdEJvZHkgPSB0eXBlb2YgZXZlbnQuYm9keSA9PT0gJ3N0cmluZycgPyBKU09OLnBhcnNlKGV2ZW50LmJvZHkpIDogZXZlbnQuYm9keTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIC8vIOWfuuacrOeahOOBqkFnZW50Q29yZeWHpueQhuOBruODl+ODrOODvOOCueODm+ODq+ODgOODvFxuICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIHJlc3BvbnNlOiAnQWdlbnRDb3JlIFJ1bnRpbWUgdjIgaXMgb3BlcmF0aW9uYWwnLFxuICAgICAgICAgICAgICAgIHNvdXJjZTogJ2FnZW50Y29yZS12MicsXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgcmVxdWVzdDogcmVxdWVzdEJvZHksXG4gICAgICAgICAgICAgICAgY2FwYWJpbGl0aWVzOiBbXG4gICAgICAgICAgICAgICAgICAnQUkgUHJvY2Vzc2luZycsXG4gICAgICAgICAgICAgICAgICAnTW9kZWwgSW5mZXJlbmNlJywgXG4gICAgICAgICAgICAgICAgICAnS25vd2xlZGdlIEJhc2UgUXVlcnknLFxuICAgICAgICAgICAgICAgICAgJ1Jlc3BvbnNlIEdlbmVyYXRpb24nXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXNwb25zZSlcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogNTAwLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICBlcnJvcjogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g44OH44OV44Kp44Or44OI5b+c562UXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IDQwNCxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgIGVycm9yOiAnTm90IEZvdW5kJyxcbiAgICAgICAgICAgICAgbWVzc2FnZTogJ0FnZW50Q29yZSBSdW50aW1lIHYyIC0gRW5kcG9pbnQgbm90IGZvdW5kJyxcbiAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfTtcbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcyh0aGlzLmNvbmZpZy5hZ2VudENvcmU/LnJ1bnRpbWU/LmxhbWJkYT8udGltZW91dCB8fCAzMDApLFxuICAgICAgbWVtb3J5U2l6ZTogdGhpcy5jb25maWcuYWdlbnRDb3JlPy5ydW50aW1lPy5sYW1iZGE/Lm1lbW9yeVNpemUgfHwgMTAyNCxcbiAgICAgIHJvbGU6IGFnZW50Q29yZVJvbGUsXG4gICAgICAvLyDnkrDlooPlpInmlbDjga/oqK3lrprjgZfjgarjgYTvvIhBV1NfUkVHSU9O5ZWP6aGM44KS5Zue6YG/77yJXG4gICAgICBhcmNoaXRlY3R1cmU6IEFyY2hpdGVjdHVyZS5BUk1fNjQsIC8vIOOCs+OCueODiOacgOmBqeWMllxuICAgIH0pO1xuXG4gICAgLy8gcmVhZG9ubHnjg5fjg63jg5Hjg4bjgqPjgavku6PlhaXjgZnjgovjgZ/jgoHjgIHlnovjgqLjgrXjg7zjgrfjg6fjg7PjgpLkvb/nlKhcbiAgICAodGhpcyBhcyBhbnkpLmFnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbiA9IGFnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbjtcblxuICAgIC8vIENsb3VkV2F0Y2ggTG9nc1xuICAgIG5ldyBMb2dHcm91cCh0aGlzLCAnQWdlbnRDb3JlUnVudGltZUxvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9sYW1iZGEvJHthZ2VudENvcmVSdW50aW1lRnVuY3Rpb24uZnVuY3Rpb25OYW1lfWAsXG4gICAgICByZXRlbnRpb246IFJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZyhgW0FnZW50Q29yZUludGVncmF0aW9uU3RhY2tWMl0gQWdlbnRDb3JlIFJ1bnRpbWXkvZzmiJDlrozkuoY6ICR7ZnVuY3Rpb25OYW1lfWApO1xuICB9XG5cbiAgLyoqXG4gICAqIOODj+OCpOODluODquODg+ODieOCouODvOOCreODhuOCr+ODgeODo+e1seWQiFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVIeWJyaWRBcmNoaXRlY3R1cmUoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmNvbmZpZy5oeWJyaWRBcmNoaXRlY3R1cmU/LmVuYWJsZWQpIHJldHVybjtcblxuICAgIGNvbnNvbGUubG9nKCdbQWdlbnRDb3JlSW50ZWdyYXRpb25TdGFja1YyXSDjg4/jgqTjg5bjg6rjg4Pjg4njgqLjg7zjgq3jg4bjgq/jg4Hjg6PntbHlkIjplovlp4suLi4nKTtcblxuICAgIGNvbnN0IGh5YnJpZENvbmZpZyA9IHRoaXMuY29uZmlnLmh5YnJpZEFyY2hpdGVjdHVyZTtcblxuICAgIC8vIEFQSSBHYXRld2F577yIQWdlbnRDb3JlIFJ1bnRpbWXnlKjvvIktIOOCquODl+OCt+ODp+ODs1xuICAgIGlmIChoeWJyaWRDb25maWcuaW50ZWdyYXRpb24uYXBpR2F0ZXdheS5lbmFibGVkICYmIHRoaXMuYWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uKSB7XG4gICAgICBjb25zb2xlLmxvZygnW0FnZW50Q29yZUludGVncmF0aW9uU3RhY2tWMl0gQVBJIEdhdGV3YXnntbHlkIjplovlp4suLi4nKTtcbiAgICAgIFxuICAgICAgY29uc3QgYWdlbnRDb3JlQXBpID0gbmV3IFJlc3RBcGkodGhpcywgJ0FnZW50Q29yZUFwaScsIHtcbiAgICAgICAgcmVzdEFwaU5hbWU6IGAke3RoaXMuY29uZmlnLnByb2plY3ROYW1lfS1hZ2VudGNvcmUtYXBpLXYyYCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgUnVudGltZSBBUEkgdjIgZm9yIEh5YnJpZCBBcmNoaXRlY3R1cmUnLFxuICAgICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgICBhbGxvd09yaWdpbnM6IENvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgICAgYWxsb3dNZXRob2RzOiBDb3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbicsICdYLVJlcXVlc3RlZC1XaXRoJ10sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gcmVhZG9ubHnjg5fjg63jg5Hjg4bjgqPjgavku6PlhaXjgZnjgovjgZ/jgoHjgIHlnovjgqLjgrXjg7zjgrfjg6fjg7PjgpLkvb/nlKhcbiAgICAgICh0aGlzIGFzIGFueSkuYWdlbnRDb3JlQXBpID0gYWdlbnRDb3JlQXBpO1xuXG4gICAgICAvLyBMYW1iZGHntbHlkIhcbiAgICAgIGNvbnN0IGFnZW50Q29yZUludGVncmF0aW9uID0gbmV3IExhbWJkYUludGVncmF0aW9uKHRoaXMuYWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uLCB7XG4gICAgICAgIHByb3h5OiB0cnVlLFxuICAgICAgICBhbGxvd1Rlc3RJbnZva2U6IHRydWUsXG4gICAgICB9KTtcblxuICAgICAgLy8g44Or44O844OI6Kit5a6aXG4gICAgICBjb25zdCBhZ2VudENvcmVSZXNvdXJjZSA9IGFnZW50Q29yZUFwaS5yb290LmFkZFJlc291cmNlKCdhZ2VudGNvcmUnKTtcbiAgICAgIGFnZW50Q29yZVJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGFnZW50Q29yZUludGVncmF0aW9uKTtcbiAgICAgIGFnZW50Q29yZVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgYWdlbnRDb3JlSW50ZWdyYXRpb24pOyAvLyDjg5jjg6vjgrnjg4Hjgqfjg4Pjgq/nlKhcblxuICAgICAgLy8g44OY44Or44K544OB44Kn44OD44Kv5bCC55So44Ko44Oz44OJ44Od44Kk44Oz44OIXG4gICAgICBjb25zdCBoZWFsdGhSZXNvdXJjZSA9IGFnZW50Q29yZUFwaS5yb290LmFkZFJlc291cmNlKCdoZWFsdGgnKTtcbiAgICAgIGhlYWx0aFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgYWdlbnRDb3JlSW50ZWdyYXRpb24pO1xuXG4gICAgICBjb25zb2xlLmxvZygnW0FnZW50Q29yZUludGVncmF0aW9uU3RhY2tWMl0gQVBJIEdhdGV3YXnkvZzmiJDlrozkuoYnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ1tBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrVjJdIEFQSSBHYXRld2F557Wx5ZCI44KS44K544Kt44OD44OX77yI6Kit5a6a44Gr44KI44KK54Sh5Yq55YyW77yJJyk7XG4gICAgfVxuXG4gICAgLy8gRXZlbnRCcmlkZ2XvvIjjgqTjg5njg7Pjg4jpp4bli5XntbHlkIjvvIlcbiAgICBpZiAoaHlicmlkQ29uZmlnLmludGVncmF0aW9uLmV2ZW50QnJpZGdlLmVuYWJsZWQpIHtcbiAgICAgIGNvbnN0IGh5YnJpZEV2ZW50QnVzID0gbmV3IEV2ZW50QnVzKHRoaXMsICdIeWJyaWRFdmVudEJ1cycsIHtcbiAgICAgICAgZXZlbnRCdXNOYW1lOiBoeWJyaWRDb25maWcuaW50ZWdyYXRpb24uZXZlbnRCcmlkZ2UuY3VzdG9tQnVzLm5hbWUsXG4gICAgICB9KTtcblxuICAgICAgLy8gcmVhZG9ubHnjg5fjg63jg5Hjg4bjgqPjgavku6PlhaXjgZnjgovjgZ/jgoHjgIHlnovjgqLjgrXjg7zjgrfjg6fjg7PjgpLkvb/nlKhcbiAgICAgICh0aGlzIGFzIGFueSkuaHlicmlkRXZlbnRCdXMgPSBoeWJyaWRFdmVudEJ1cztcblxuICAgICAgLy8gQWdlbnRDb3Jl5Yem55CG5a6M5LqG44Kk44OZ44Oz44OI44Or44O844OrXG4gICAgICBpZiAodGhpcy5hZ2VudENvcmVSdW50aW1lRnVuY3Rpb24pIHtcbiAgICAgICAgbmV3IFJ1bGUodGhpcywgJ0FnZW50Q29yZVByb2Nlc3NpbmdSdWxlJywge1xuICAgICAgICAgIGV2ZW50QnVzOiBoeWJyaWRFdmVudEJ1cyxcbiAgICAgICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgICAgIHNvdXJjZTogWydhZ2VudGNvcmUucnVudGltZS52MiddLFxuICAgICAgICAgICAgZGV0YWlsVHlwZTogWydQcm9jZXNzaW5nIENvbXBsZXRlJywgJ1Byb2Nlc3NpbmcgRmFpbGVkJ10sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB0YXJnZXRzOiBbXG4gICAgICAgICAgICBuZXcgTGFtYmRhRnVuY3Rpb24odGhpcy5hZ2VudENvcmVSdW50aW1lRnVuY3Rpb24sIHtcbiAgICAgICAgICAgICAgZXZlbnQ6IFJ1bGVUYXJnZXRJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgICAgICAgICBldmVudFR5cGU6ICdhZ2VudGNvcmUtZXZlbnQtdjInLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogJyQudGltZScsXG4gICAgICAgICAgICAgICAgZGV0YWlsOiAnJC5kZXRhaWwnLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZygnW0FnZW50Q29yZUludGVncmF0aW9uU3RhY2tWMl0gRXZlbnRCcmlkZ2XntbHlkIjlrozkuoYnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog55uj6KaW44O744Ki44Op44O844OI44Kk44Oz44OV44Op44K544OI44Op44Kv44OB44OjXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU1vbml0b3JpbmdJbmZyYXN0cnVjdHVyZSgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY29uZmlnLmFnZW50Q29yZT8ubW9uaXRvcmluZz8uZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgY29uc29sZS5sb2coJ1tBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrVjJdIOebo+imluOCpOODs+ODleODqeOCueODiOODqeOCr+ODgeODo+S9nOaIkOmWi+Wniy4uLicpO1xuXG4gICAgLy8gU05TIFRvcGlj77yI44Ki44Op44O844OI6YCa55+l55So77yJXG4gICAgY29uc3QgbW9uaXRvcmluZ1RvcGljID0gbmV3IFRvcGljKHRoaXMsICdBZ2VudENvcmVNb25pdG9yaW5nVG9waWMnLCB7XG4gICAgICB0b3BpY05hbWU6IGAke3RoaXMuY29uZmlnLnByb2plY3ROYW1lfS1hZ2VudGNvcmUtdjItJHt0aGlzLmNvbmZpZy5lbnZpcm9ubWVudH0tYWxlcnRzYCxcbiAgICB9KTtcblxuICAgIC8vIHJlYWRvbmx544OX44Ot44OR44OG44Kj44Gr5Luj5YWl44GZ44KL44Gf44KB44CB5Z6L44Ki44K144O844K344On44Oz44KS5L2/55SoXG4gICAgKHRoaXMgYXMgYW55KS5tb25pdG9yaW5nVG9waWMgPSBtb25pdG9yaW5nVG9waWM7XG5cbiAgICAvLyBBZ2VudENvcmUgUnVudGltZeebo+imllxuICAgIGlmICh0aGlzLmFnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbikge1xuICAgICAgLy8g44Ko44Op44O8546H44Ki44Op44O844OgXG4gICAgICBjb25zdCBlcnJvclJhdGVBbGFybSA9IG5ldyBBbGFybSh0aGlzLCAnQWdlbnRDb3JlRXJyb3JSYXRlQWxhcm0nLCB7XG4gICAgICAgIG1ldHJpYzogdGhpcy5hZ2VudENvcmVSdW50aW1lRnVuY3Rpb24ubWV0cmljRXJyb3JzKHtcbiAgICAgICAgICBwZXJpb2Q6IER1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDUsIC8vIDXliIbplpPjgac144Ko44Op44O85Lul5LiKXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6IENvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fT1JfRVFVQUxfVE9fVEhSRVNIT0xELFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIFJ1bnRpbWUgdjIgZXJyb3IgcmF0ZSBpcyBoaWdoJyxcbiAgICAgIH0pO1xuXG4gICAgICBlcnJvclJhdGVBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgU25zQWN0aW9uKG1vbml0b3JpbmdUb3BpYykpO1xuXG4gICAgICAvLyDjg6zjgqTjg4bjg7PjgrfjgqLjg6njg7zjg6BcbiAgICAgIGNvbnN0IGxhdGVuY3lBbGFybSA9IG5ldyBBbGFybSh0aGlzLCAnQWdlbnRDb3JlTGF0ZW5jeUFsYXJtJywge1xuICAgICAgICBtZXRyaWM6IHRoaXMuYWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uLm1ldHJpY0R1cmF0aW9uKHtcbiAgICAgICAgICBwZXJpb2Q6IER1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pLFxuICAgICAgICB0aHJlc2hvbGQ6IDMwMDAwLCAvLyAzMOenklxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMyxcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBDb21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBSdW50aW1lIHYyIGxhdGVuY3kgaXMgaGlnaCcsXG4gICAgICB9KTtcblxuICAgICAgbGF0ZW5jeUFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBTbnNBY3Rpb24obW9uaXRvcmluZ1RvcGljKSk7XG4gICAgfVxuXG4gICAgLy8g44Om44O844K244O86Kit5a6a44OG44O844OW44Or55uj6KaWXG4gICAgaWYgKHRoaXMudXNlclByZWZlcmVuY2VzVGFibGUpIHtcbiAgICAgIGNvbnN0IHJlYWRUaHJvdHRsZUFsYXJtID0gbmV3IEFsYXJtKHRoaXMsICdQcmVmZXJlbmNlc1RhYmxlUmVhZFRocm90dGxlQWxhcm0nLCB7XG4gICAgICAgIG1ldHJpYzogbmV3IE1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0R5bmFtb0RCJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnUmVhZFRocm90dGxlZEV2ZW50cycsXG4gICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgVGFibGVOYW1lOiB0aGlzLnVzZXJQcmVmZXJlbmNlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHBlcmlvZDogRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSksXG4gICAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdVc2VyIHByZWZlcmVuY2VzIHRhYmxlIHJlYWQgdGhyb3R0bGluZyBkZXRlY3RlZCcsXG4gICAgICB9KTtcblxuICAgICAgcmVhZFRocm90dGxlQWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IFNuc0FjdGlvbihtb25pdG9yaW5nVG9waWMpKTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygnW0FnZW50Q29yZUludGVncmF0aW9uU3RhY2tWMl0g55uj6KaW44Kk44Oz44OV44Op44K544OI44Op44Kv44OB44Oj5L2c5oiQ5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICogQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCk6IHZvaWQge1xuICAgIC8vIEFnZW50Q29yZSBSdW50aW1lIEZ1bmN0aW9uIEFSTlxuICAgIGlmICh0aGlzLmFnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbikge1xuICAgICAgbmV3IENmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVSdW50aW1lRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIFJ1bnRpbWUgdjIgTGFtYmRhIEZ1bmN0aW9uIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BZ2VudENvcmVSdW50aW1lRnVuY3Rpb25Bcm5gLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbk5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIFJ1bnRpbWUgdjIgTGFtYmRhIEZ1bmN0aW9uIE5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uTmFtZWAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjg6bjg7zjgrbjg7zoqK3lrprjg4bjg7zjg5bjg6tcbiAgICBpZiAodGhpcy51c2VyUHJlZmVyZW5jZXNUYWJsZSkge1xuICAgICAgbmV3IENmbk91dHB1dCh0aGlzLCAnVXNlclByZWZlcmVuY2VzVGFibGVOYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy51c2VyUHJlZmVyZW5jZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnVXNlciBQcmVmZXJlbmNlcyBEeW5hbW9EQiBUYWJsZSBOYW1lJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVVzZXJQcmVmZXJlbmNlc1RhYmxlTmFtZWAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IENmbk91dHB1dCh0aGlzLCAnVXNlclByZWZlcmVuY2VzVGFibGVBcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLnVzZXJQcmVmZXJlbmNlc1RhYmxlLnRhYmxlQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgUHJlZmVyZW5jZXMgRHluYW1vREIgVGFibGUgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVVzZXJQcmVmZXJlbmNlc1RhYmxlQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEFQSSBHYXRld2F5XG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlQXBpKSB7XG4gICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudENvcmVBcGlJZCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlQXBpLnJlc3RBcGlJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgQVBJIEdhdGV3YXkgdjIgSUQnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlQXBpSWRgLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZUFwaVVybCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlQXBpLnVybCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgQVBJIEdhdGV3YXkgdjIgVVJMJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZUFwaVVybGAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBFdmVudEJyaWRnZVxuICAgIGlmICh0aGlzLmh5YnJpZEV2ZW50QnVzKSB7XG4gICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdIeWJyaWRFdmVudEJ1c0FybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuaHlicmlkRXZlbnRCdXMuZXZlbnRCdXNBcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnSHlicmlkIEFyY2hpdGVjdHVyZSBFdmVudEJyaWRnZSBCdXMgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUh5YnJpZEV2ZW50QnVzQXJuYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdIeWJyaWRFdmVudEJ1c05hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmh5YnJpZEV2ZW50QnVzLmV2ZW50QnVzTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdIeWJyaWQgQXJjaGl0ZWN0dXJlIEV2ZW50QnJpZGdlIEJ1cyBOYW1lJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUh5YnJpZEV2ZW50QnVzTmFtZWAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDnm6Poppbjg4jjg5Tjg4Pjgq9cbiAgICBpZiAodGhpcy5tb25pdG9yaW5nVG9waWMpIHtcbiAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ01vbml0b3JpbmdUb3BpY0FybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMubW9uaXRvcmluZ1RvcGljLnRvcGljQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSB2MiBNb25pdG9yaW5nIFNOUyBUb3BpYyBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tTW9uaXRvcmluZ1RvcGljQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIOapn+iDveODleODqeOCsOeKtuaFi1xuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0ZlYXR1cmVGbGFnc1N0YXR1cycsIHtcbiAgICAgIHZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGFnZW50Q29yZUludGVncmF0aW9uOiB0aGlzLmZlYXR1cmVGbGFncy5lbmFibGVBZ2VudENvcmVJbnRlZ3JhdGlvbixcbiAgICAgICAgaHlicmlkQXJjaGl0ZWN0dXJlOiB0aGlzLmZlYXR1cmVGbGFncy5lbmFibGVIeWJyaWRBcmNoaXRlY3R1cmUsXG4gICAgICAgIHVzZXJQcmVmZXJlbmNlczogdGhpcy5mZWF0dXJlRmxhZ3MuZW5hYmxlVXNlclByZWZlcmVuY2VzLFxuICAgICAgICB2ZXJzaW9uOiAnMi4wLjAnLFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBJbnRlZ3JhdGlvbiB2MiBGZWF0dXJlIEZsYWdzIFN0YXR1cycsXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygnW0FnZW50Q29yZUludGVncmF0aW9uU3RhY2tWMl0gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c+S9nOaIkOWujOS6hicpO1xuICB9XG59Il19