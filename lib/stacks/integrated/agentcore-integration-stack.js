"use strict";
/**
 * AgentCore統合スタック
 * Task 3.2: ハイブリッドアーキテクチャ統合
 *
 * 機能フラグによる有効化/無効化をサポート
 * アカウント非依存で再現可能な実装
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentCoreIntegrationStack = void 0;
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
 * AgentCore統合スタック
 *
 * 責任分離アーキテクチャを実現:
 * - Next.js: UI/UX処理、認証、設定管理
 * - AgentCore Runtime: AI処理、推論、モデル呼び出し
 * - API Gateway: 疎結合統合
 */
class AgentCoreIntegrationStack extends aws_cdk_lib_1.Stack {
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
            console.log('[AgentCoreIntegrationStack] AgentCore統合が無効化されています');
            return;
        }
        // 1. ユーザー設定永続化（最優先）
        if (this.featureFlags.enableUserPreferences) {
            this.createUserPreferencesInfrastructure();
        }
        // 2. AgentCore Runtime（コア機能）
        // 一時的にスキップ（AWS_REGION問題を回避）
        console.log('[AgentCoreIntegrationStack] AgentCore Runtime作成をスキップ（AWS_REGION問題のため）');
        // if (this.config.agentCore?.enabled) {
        //   this.createAgentCoreRuntime();
        // }
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
        console.log(`[AgentCoreIntegrationStack] ユーザー設定テーブル作成: ${preferencesConfig.dynamodb.tableName}`);
    }
    /**
     * AgentCore Runtime作成
     */
    createAgentCoreRuntime() {
        // 一時的にハードコード（AWS_REGION問題の切り分け）
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
        // Lambda Function
        const agentCoreRuntimeFunction = new aws_lambda_1.Function(this, 'AgentCoreRuntimeFunction', {
            functionName: `AgentCore-Runtime-${Date.now()}`, // 一時的にハードコード
            runtime: aws_lambda_1.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: aws_lambda_1.Code.fromInline(`
        // AgentCore Runtime Lambda Function
        // 実際の実装は別途デプロイ
        exports.handler = async (event) => {
          console.log('AgentCore Runtime Event:', JSON.stringify(event, null, 2));
          
          // 基本的なヘルスチェック応答
          if (event.httpMethod === 'GET' && event.path === '/health') {
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
              body: JSON.stringify({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
              })
            };
          }
          
          // AgentCore処理のプレースホルダー
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              response: 'AgentCore Runtime is not yet implemented',
              source: 'agentcore-placeholder',
              timestamp: new Date().toISOString()
            })
          };
        };
      `),
            timeout: aws_cdk_lib_1.Duration.seconds(300), // ハードコード
            memorySize: 1024, // ハードコード
            role: agentCoreRole,
            // environment プロパティを完全に削除
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
        console.log(`[AgentCoreIntegrationStack] AgentCore Runtime作成: ${agentCoreRuntimeFunction.functionName}`);
    }
    /**
     * ハイブリッドアーキテクチャ統合
     */
    createHybridArchitecture() {
        if (!this.config.hybridArchitecture?.enabled)
            return;
        const hybridConfig = this.config.hybridArchitecture;
        // API Gateway（AgentCore Runtime用）
        if (hybridConfig.integration.apiGateway.enabled && this.agentCoreRuntimeFunction) {
            const agentCoreApi = new aws_apigateway_1.RestApi(this, 'AgentCoreApi', {
                restApiName: `${this.config.projectName}-agentcore-api`,
                description: 'AgentCore Runtime API for Hybrid Architecture',
                defaultCorsPreflightOptions: {
                    allowOrigins: aws_apigateway_1.Cors.ALL_ORIGINS,
                    allowMethods: aws_apigateway_1.Cors.ALL_METHODS,
                    allowHeaders: ['Content-Type', 'Authorization'],
                },
            });
            // readonlyプロパティに代入するため、型アサーションを使用
            this.agentCoreApi = agentCoreApi;
            // Lambda統合
            const agentCoreIntegration = new aws_apigateway_1.LambdaIntegration(this.agentCoreRuntimeFunction);
            // ルート設定
            const agentCoreResource = agentCoreApi.root.addResource('agentcore');
            agentCoreResource.addMethod('POST', agentCoreIntegration);
            agentCoreResource.addMethod('GET', agentCoreIntegration); // ヘルスチェック用
            console.log('[AgentCoreIntegrationStack] API Gateway作成完了');
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
                        source: ['agentcore.runtime'],
                        detailType: ['Processing Complete', 'Processing Failed'],
                    },
                    targets: [
                        new aws_events_targets_1.LambdaFunction(this.agentCoreRuntimeFunction, {
                            event: aws_events_1.RuleTargetInput.fromObject({
                                eventType: 'agentcore-event',
                                timestamp: '$.time',
                                detail: '$.detail',
                            }),
                        }),
                    ],
                });
            }
            console.log('[AgentCoreIntegrationStack] EventBridge統合完了');
        }
    }
    /**
     * 監視・アラートインフラストラクチャ
     */
    createMonitoringInfrastructure() {
        if (!this.config.agentCore?.monitoring?.enabled)
            return;
        // SNS Topic（アラート通知用）
        const monitoringTopic = new aws_sns_1.Topic(this, 'AgentCoreMonitoringTopic', {
            topicName: `${this.config.projectName}-agentcore-alerts`,
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
                alarmDescription: 'AgentCore Runtime error rate is high',
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
                alarmDescription: 'AgentCore Runtime latency is high',
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
        console.log('[AgentCoreIntegrationStack] 監視インフラストラクチャ作成完了');
    }
    /**
     * CloudFormation Outputs
     */
    createOutputs() {
        // AgentCore Runtime Function ARN
        if (this.agentCoreRuntimeFunction) {
            new aws_cdk_lib_1.CfnOutput(this, 'AgentCoreRuntimeFunctionArn', {
                value: this.agentCoreRuntimeFunction.functionArn,
                description: 'AgentCore Runtime Lambda Function ARN',
                exportName: `${this.stackName}-AgentCoreRuntimeFunctionArn`,
            });
            new aws_cdk_lib_1.CfnOutput(this, 'AgentCoreRuntimeFunctionName', {
                value: this.agentCoreRuntimeFunction.functionName,
                description: 'AgentCore Runtime Lambda Function Name',
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
                description: 'AgentCore API Gateway ID',
                exportName: `${this.stackName}-AgentCoreApiId`,
            });
            new aws_cdk_lib_1.CfnOutput(this, 'AgentCoreApiUrl', {
                value: this.agentCoreApi.url,
                description: 'AgentCore API Gateway URL',
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
                description: 'AgentCore Monitoring SNS Topic ARN',
                exportName: `${this.stackName}-MonitoringTopicArn`,
            });
        }
        // 機能フラグ状態
        new aws_cdk_lib_1.CfnOutput(this, 'FeatureFlagsStatus', {
            value: JSON.stringify({
                agentCoreIntegration: this.featureFlags.enableAgentCoreIntegration,
                hybridArchitecture: this.featureFlags.enableHybridArchitecture,
                userPreferences: this.featureFlags.enableUserPreferences,
            }),
            description: 'AgentCore Integration Feature Flags Status',
        });
        console.log('[AgentCoreIntegrationStack] CloudFormation Outputs作成完了');
    }
}
exports.AgentCoreIntegrationStack = AgentCoreIntegrationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRjb3JlLWludGVncmF0aW9uLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWdlbnRjb3JlLWludGVncmF0aW9uLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7OztBQUVILDZDQUFvRjtBQUVwRix1REFBK0U7QUFDL0UsMkRBQThGO0FBQzlGLCtEQUE4RTtBQUM5RSx1REFBeUU7QUFDekUsdUVBQWdFO0FBQ2hFLGlEQUFxRztBQUNyRyxtREFBK0Q7QUFDL0QsK0RBQStFO0FBQy9FLCtFQUErRDtBQUMvRCxpREFBNEM7QUE0QjVDOzs7Ozs7O0dBT0c7QUFDSCxNQUFhLHlCQUEwQixTQUFRLG1CQUFLO0lBQ2xELDBCQUEwQjtJQUNWLHdCQUF3QixDQUFZO0lBQ3BDLG9CQUFvQixDQUFTO0lBQzdCLFlBQVksQ0FBVztJQUN2QixjQUFjLENBQVk7SUFDMUIsZUFBZSxDQUFTO0lBRXhDLGNBQWM7SUFDRyxNQUFNLENBQTZCO0lBQ25DLFlBQVksQ0FBaUQ7SUFFOUUsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFxQztRQUM3RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7UUFDM0IsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDO1FBRXZDLFlBQVk7UUFDWixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1lBQ2xELE9BQU8sQ0FBQyxHQUFHLENBQUMsbURBQW1ELENBQUMsQ0FBQztZQUNqRSxPQUFPO1FBQ1QsQ0FBQztRQUVELG9CQUFvQjtRQUNwQixJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUM1QyxJQUFJLENBQUMsbUNBQW1DLEVBQUUsQ0FBQztRQUM3QyxDQUFDO1FBRUQs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LHVCQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUNwQixvQkFBb0IsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLDBCQUEwQjtnQkFDbEUsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyx3QkFBd0I7Z0JBQzlELGVBQWUsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLHFCQUFxQjthQUN6RCxDQUFDO1lBQ0YsV0FBVyxFQUFFLDRDQUE0QztTQUMxRCxDQUFDLENBQUM7UUFFSCxPQUFPLENBQUMsR0FBRyxDQUFDLHdEQUF3RCxDQUFDLENBQUM7SUFDeEUsQ0FBQztDQUNGO0FBMVpELDhEQTBaQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQWdlbnRDb3Jl57Wx5ZCI44K544K/44OD44KvXG4gKiBUYXNrIDMuMjog44OP44Kk44OW44Oq44OD44OJ44Ki44O844Kt44OG44Kv44OB44Oj57Wx5ZCIXG4gKiBcbiAqIOapn+iDveODleODqeOCsOOBq+OCiOOCi+acieWKueWMli/nhKHlirnljJbjgpLjgrXjg53jg7zjg4hcbiAqIOOCouOCq+OCpuODs+ODiOmdnuS+neWtmOOBp+WGjeePvuWPr+iDveOBquWun+ijhVxuICovXG5cbmltcG9ydCB7IFN0YWNrLCBTdGFja1Byb3BzLCBDZm5PdXRwdXQsIER1cmF0aW9uLCBSZW1vdmFsUG9saWN5IH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBGdW5jdGlvbiwgUnVudGltZSwgQ29kZSwgQXJjaGl0ZWN0dXJlIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBUYWJsZSwgQXR0cmlidXRlVHlwZSwgQmlsbGluZ01vZGUsIFRhYmxlRW5jcnlwdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgeyBSZXN0QXBpLCBMYW1iZGFJbnRlZ3JhdGlvbiwgQ29ycyB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCB7IEV2ZW50QnVzLCBSdWxlLCBSdWxlVGFyZ2V0SW5wdXQgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCB7IExhbWJkYUZ1bmN0aW9uIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCB7IFJvbGUsIFNlcnZpY2VQcmluY2lwYWwsIFBvbGljeVN0YXRlbWVudCwgRWZmZWN0LCBNYW5hZ2VkUG9saWN5IH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBMb2dHcm91cCwgUmV0ZW50aW9uRGF5cyB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCB7IEFsYXJtLCBNZXRyaWMsIENvbXBhcmlzb25PcGVyYXRvciB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCB7IFNuc0FjdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnMnO1xuaW1wb3J0IHsgVG9waWMgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCB7IEFnZW50Q29yZUludGVncmF0aW9uQ29uZmlnIH0gZnJvbSAnLi4vLi4vY29uZmlnL2ludGVyZmFjZXMvZW52aXJvbm1lbnQtY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrUHJvcHMgZXh0ZW5kcyBTdGFja1Byb3BzIHtcbiAgLyoqXG4gICAqIOe1seWQiOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgY29uZmlnOiBBZ2VudENvcmVJbnRlZ3JhdGlvbkNvbmZpZztcblxuICAvKipcbiAgICog5qmf6IO944OV44Op44KwXG4gICAqL1xuICByZWFkb25seSBmZWF0dXJlRmxhZ3M6IHtcbiAgICByZWFkb25seSBlbmFibGVBZ2VudENvcmVJbnRlZ3JhdGlvbjogYm9vbGVhbjtcbiAgICByZWFkb25seSBlbmFibGVIeWJyaWRBcmNoaXRlY3R1cmU6IGJvb2xlYW47XG4gICAgcmVhZG9ubHkgZW5hYmxlVXNlclByZWZlcmVuY2VzOiBib29sZWFuO1xuICB9O1xuXG4gIC8qKlxuICAgKiDml6LlrZjjg6rjgr3jg7zjgrnlj4LnhadcbiAgICovXG4gIHJlYWRvbmx5IGV4aXN0aW5nUmVzb3VyY2VzPzoge1xuICAgIHJlYWRvbmx5IHZwY0lkPzogc3RyaW5nO1xuICAgIHJlYWRvbmx5IHN1Ym5ldElkcz86IHN0cmluZ1tdO1xuICAgIHJlYWRvbmx5IHNlY3VyaXR5R3JvdXBJZHM/OiBzdHJpbmdbXTtcbiAgfTtcbn1cblxuLyoqXG4gKiBBZ2VudENvcmXntbHlkIjjgrnjgr/jg4Pjgq9cbiAqIFxuICog6LKs5Lu75YiG6Zui44Ki44O844Kt44OG44Kv44OB44Oj44KS5a6f54++OlxuICogLSBOZXh0LmpzOiBVSS9VWOWHpueQhuOAgeiqjeiovOOAgeioreWumueuoeeQhlxuICogLSBBZ2VudENvcmUgUnVudGltZTogQUnlh6bnkIbjgIHmjqjoq5bjgIHjg6Ljg4fjg6vlkbzjgbPlh7rjgZdcbiAqIC0gQVBJIEdhdGV3YXk6IOeWjue1kOWQiOe1seWQiFxuICovXG5leHBvcnQgY2xhc3MgQWdlbnRDb3JlSW50ZWdyYXRpb25TdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgLy8g44OR44OW44Oq44OD44Kv44OX44Ot44OR44OG44Kj77yI5LuW44K544K/44OD44Kv44GL44KJ5Y+C54Wn5Y+v6IO977yJXG4gIHB1YmxpYyByZWFkb25seSBhZ2VudENvcmVSdW50aW1lRnVuY3Rpb24/OiBGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQcmVmZXJlbmNlc1RhYmxlPzogVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBhZ2VudENvcmVBcGk/OiBSZXN0QXBpO1xuICBwdWJsaWMgcmVhZG9ubHkgaHlicmlkRXZlbnRCdXM/OiBFdmVudEJ1cztcbiAgcHVibGljIHJlYWRvbmx5IG1vbml0b3JpbmdUb3BpYz86IFRvcGljO1xuXG4gIC8vIOODl+ODqeOCpOODmeODvOODiOODl+ODreODkeODhuOCo1xuICBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZzogQWdlbnRDb3JlSW50ZWdyYXRpb25Db25maWc7XG4gIHByaXZhdGUgcmVhZG9ubHkgZmVhdHVyZUZsYWdzOiBBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrUHJvcHNbJ2ZlYXR1cmVGbGFncyddO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIHRoaXMuY29uZmlnID0gcHJvcHMuY29uZmlnO1xuICAgIHRoaXMuZmVhdHVyZUZsYWdzID0gcHJvcHMuZmVhdHVyZUZsYWdzO1xuXG4gICAgLy8g5qmf6IO944OV44Op44Kw44OB44Kn44OD44KvXG4gICAgaWYgKCF0aGlzLmZlYXR1cmVGbGFncy5lbmFibGVBZ2VudENvcmVJbnRlZ3JhdGlvbikge1xuICAgICAgY29uc29sZS5sb2coJ1tBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrXSBBZ2VudENvcmXntbHlkIjjgYznhKHlirnljJbjgZXjgozjgabjgYTjgb7jgZknKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyAxLiDjg6bjg7zjgrbjg7zoqK3lrprmsLjntprljJbvvIjmnIDlhKrlhYjvvIlcbiAgICBpZiAodGhpcy5mZWF0dXJlRmxhZ3MuZW5hYmxlVXNlclByZWZlcmVuY2VzKSB7XG4gICAgICB0aGlzLmNyZWF0ZVVzZXJQcmVmZXJlbmNlc0luZnJhc3RydWN0dXJlKCk7XG4gICAgfVxuXG4gICAgLy8gMi4gQWdlbnRDb3JlIFJ1bnRpbWXvvIjjgrPjgqLmqZ/og73vvIlcbiAgICAvLyDkuIDmmYLnmoTjgavjgrnjgq3jg4Pjg5fvvIhBV1NfUkVHSU9O5ZWP6aGM44KS5Zue6YG/77yJXG4gICAgY29uc29sZS5sb2coJ1tBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrXSBBZ2VudENvcmUgUnVudGltZeS9nOaIkOOCkuOCueOCreODg+ODl++8iEFXU19SRUdJT07llY/poYzjga7jgZ/jgoHvvIknKTtcbiAgICAvLyBpZiAodGhpcy5jb25maWcuYWdlbnRDb3JlPy5lbmFibGVkKSB7XG4gICAgLy8gICB0aGlzLmNyZWF0ZUFnZW50Q29yZVJ1bnRpbWUoKTtcbiAgICAvLyB9XG5cbiAgICAvLyAzLiDjg4/jgqTjg5bjg6rjg4Pjg4njgqLjg7zjgq3jg4bjgq/jg4Hjg6PntbHlkIhcbiAgICBpZiAodGhpcy5mZWF0dXJlRmxhZ3MuZW5hYmxlSHlicmlkQXJjaGl0ZWN0dXJlKSB7XG4gICAgICB0aGlzLmNyZWF0ZUh5YnJpZEFyY2hpdGVjdHVyZSgpO1xuICAgIH1cblxuICAgIC8vIDQuIOebo+imluODu+OCouODqeODvOODiFxuICAgIGlmICh0aGlzLmNvbmZpZy5hZ2VudENvcmU/Lm1vbml0b3Jpbmc/LmVuYWJsZWQpIHtcbiAgICAgIHRoaXMuY3JlYXRlTW9uaXRvcmluZ0luZnJhc3RydWN0dXJlKCk7XG4gICAgfVxuXG4gICAgLy8gNS4gQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xuICAgIHRoaXMuY3JlYXRlT3V0cHV0cygpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODpuODvOOCtuODvOioreWumuawuOe2muWMluOCpOODs+ODleODqeOCueODiOODqeOCr+ODgeODo1xuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVVc2VyUHJlZmVyZW5jZXNJbmZyYXN0cnVjdHVyZSgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY29uZmlnLnVzZXJQcmVmZXJlbmNlcz8uZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgcHJlZmVyZW5jZXNDb25maWcgPSB0aGlzLmNvbmZpZy51c2VyUHJlZmVyZW5jZXM7XG5cbiAgICAvLyBEeW5hbW9EQiDjg4bjg7zjg5bjg6tcbiAgICBjb25zdCB1c2VyUHJlZmVyZW5jZXNUYWJsZSA9IG5ldyBUYWJsZSh0aGlzLCAnVXNlclByZWZlcmVuY2VzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IHByZWZlcmVuY2VzQ29uZmlnLmR5bmFtb2RiLnRhYmxlTmFtZSxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAndXNlcklkJyxcbiAgICAgICAgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnc2V0dGluZ0tleScsXG4gICAgICAgIHR5cGU6IEF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBwcmVmZXJlbmNlc0NvbmZpZy5keW5hbW9kYi5iaWxsaW5nTW9kZSA9PT0gJ1BST1ZJU0lPTkVEJyBcbiAgICAgICAgPyBCaWxsaW5nTW9kZS5QUk9WSVNJT05FRCBcbiAgICAgICAgOiBCaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBcbiAgICAgIC8vIOODl+ODreODk+OCuOODp+ODs+ODieOCueODq+ODvOODl+ODg+ODiO+8iOW/heimgeOBquWgtOWQiO+8iVxuICAgICAgLi4uKHByZWZlcmVuY2VzQ29uZmlnLmR5bmFtb2RiLmJpbGxpbmdNb2RlID09PSAnUFJPVklTSU9ORUQnICYmIHByZWZlcmVuY2VzQ29uZmlnLmR5bmFtb2RiLnByb3Zpc2lvbmVkVGhyb3VnaHB1dCA/IHtcbiAgICAgICAgcmVhZENhcGFjaXR5OiBwcmVmZXJlbmNlc0NvbmZpZy5keW5hbW9kYi5wcm92aXNpb25lZFRocm91Z2hwdXQucmVhZENhcGFjaXR5VW5pdHMsXG4gICAgICAgIHdyaXRlQ2FwYWNpdHk6IHByZWZlcmVuY2VzQ29uZmlnLmR5bmFtb2RiLnByb3Zpc2lvbmVkVGhyb3VnaHB1dC53cml0ZUNhcGFjaXR5VW5pdHMsXG4gICAgICB9IDoge30pLFxuXG4gICAgICAvLyBUVEzoqK3lrppcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6IHByZWZlcmVuY2VzQ29uZmlnLmR5bmFtb2RiLnR0bC5lbmFibGVkIFxuICAgICAgICA/IHByZWZlcmVuY2VzQ29uZmlnLmR5bmFtb2RiLnR0bC5hdHRyaWJ1dGVOYW1lIFxuICAgICAgICA6IHVuZGVmaW5lZCxcblxuICAgICAgLy8g5pqX5Y+35YyWXG4gICAgICBlbmNyeXB0aW9uOiBwcmVmZXJlbmNlc0NvbmZpZy5keW5hbW9kYi5lbmNyeXB0aW9uLmVuYWJsZWRcbiAgICAgICAgPyBUYWJsZUVuY3J5cHRpb24uQ1VTVE9NRVJfTUFOQUdFRFxuICAgICAgICA6IFRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcblxuICAgICAgLy8g5YmK6Zmk5L+d6K23XG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcblxuICAgIC8vIHJlYWRvbmx544OX44Ot44OR44OG44Kj44Gr5Luj5YWl44GZ44KL44Gf44KB44CB5Z6L44Ki44K144O844K344On44Oz44KS5L2/55SoXG4gICAgKHRoaXMgYXMgYW55KS51c2VyUHJlZmVyZW5jZXNUYWJsZSA9IHVzZXJQcmVmZXJlbmNlc1RhYmxlO1xuXG4gICAgY29uc29sZS5sb2coYFtBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrXSDjg6bjg7zjgrbjg7zoqK3lrprjg4bjg7zjg5bjg6vkvZzmiJA6ICR7cHJlZmVyZW5jZXNDb25maWcuZHluYW1vZGIudGFibGVOYW1lfWApO1xuICB9XG5cbiAgLyoqXG4gICAqIEFnZW50Q29yZSBSdW50aW1l5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUFnZW50Q29yZVJ1bnRpbWUoKTogdm9pZCB7XG4gICAgLy8g5LiA5pmC55qE44Gr44OP44O844OJ44Kz44O844OJ77yIQVdTX1JFR0lPTuWVj+mhjOOBruWIh+OCiuWIhuOBke+8iVxuICAgIFxuICAgIC8vIElBTSBSb2xlXG4gICAgY29uc3QgYWdlbnRDb3JlUm9sZSA9IG5ldyBSb2xlKHRoaXMsICdBZ2VudENvcmVSdW50aW1lUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IFNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBCZWRyb2NrIOOCouOCr+OCu+OCueaoqemZkFxuICAgIGFnZW50Q29yZVJvbGUuYWRkVG9Qb2xpY3kobmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IEVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbScsXG4gICAgICAgICdiZWRyb2NrOkdldEZvdW5kYXRpb25Nb2RlbCcsXG4gICAgICAgICdiZWRyb2NrOkxpc3RGb3VuZGF0aW9uTW9kZWxzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIC8vIOODpuODvOOCtuODvOioreWumuODhuODvOODluODq+OCouOCr+OCu+OCueaoqemZkFxuICAgIGlmICh0aGlzLnVzZXJQcmVmZXJlbmNlc1RhYmxlKSB7XG4gICAgICB0aGlzLnVzZXJQcmVmZXJlbmNlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhZ2VudENvcmVSb2xlKTtcbiAgICB9XG5cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb25cbiAgICBjb25zdCBhZ2VudENvcmVSdW50aW1lRnVuY3Rpb24gPSBuZXcgRnVuY3Rpb24odGhpcywgJ0FnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYEFnZW50Q29yZS1SdW50aW1lLSR7RGF0ZS5ub3coKX1gLCAvLyDkuIDmmYLnmoTjgavjg4/jg7zjg4njgrPjg7zjg4lcbiAgICAgIHJ1bnRpbWU6IFJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBDb2RlLmZyb21JbmxpbmUoYFxuICAgICAgICAvLyBBZ2VudENvcmUgUnVudGltZSBMYW1iZGEgRnVuY3Rpb25cbiAgICAgICAgLy8g5a6f6Zqb44Gu5a6f6KOF44Gv5Yil6YCU44OH44OX44Ot44KkXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdBZ2VudENvcmUgUnVudGltZSBFdmVudDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIOWfuuacrOeahOOBquODmOODq+OCueODgeOCp+ODg+OCr+W/nOetlFxuICAgICAgICAgIGlmIChldmVudC5odHRwTWV0aG9kID09PSAnR0VUJyAmJiBldmVudC5wYXRoID09PSAnL2hlYWx0aCcpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIHN0YXR1czogJ2hlYWx0aHknLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHZlcnNpb246ICcxLjAuMCdcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIEFnZW50Q29yZeWHpueQhuOBruODl+ODrOODvOOCueODm+ODq+ODgOODvFxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICByZXNwb25zZTogJ0FnZW50Q29yZSBSdW50aW1lIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQnLFxuICAgICAgICAgICAgICBzb3VyY2U6ICdhZ2VudGNvcmUtcGxhY2Vob2xkZXInLFxuICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5zZWNvbmRzKDMwMCksIC8vIOODj+ODvOODieOCs+ODvOODiVxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCwgLy8g44OP44O844OJ44Kz44O844OJXG4gICAgICByb2xlOiBhZ2VudENvcmVSb2xlLFxuICAgICAgLy8gZW52aXJvbm1lbnQg44OX44Ot44OR44OG44Kj44KS5a6M5YWo44Gr5YmK6ZmkXG4gICAgICBhcmNoaXRlY3R1cmU6IEFyY2hpdGVjdHVyZS5BUk1fNjQsIC8vIOOCs+OCueODiOacgOmBqeWMllxuICAgIH0pO1xuXG4gICAgLy8gcmVhZG9ubHnjg5fjg63jg5Hjg4bjgqPjgavku6PlhaXjgZnjgovjgZ/jgoHjgIHlnovjgqLjgrXjg7zjgrfjg6fjg7PjgpLkvb/nlKhcbiAgICAodGhpcyBhcyBhbnkpLmFnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbiA9IGFnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbjtcblxuICAgIC8vIENsb3VkV2F0Y2ggTG9nc1xuICAgIG5ldyBMb2dHcm91cCh0aGlzLCAnQWdlbnRDb3JlUnVudGltZUxvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9sYW1iZGEvJHthZ2VudENvcmVSdW50aW1lRnVuY3Rpb24uZnVuY3Rpb25OYW1lfWAsXG4gICAgICByZXRlbnRpb246IFJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZyhgW0FnZW50Q29yZUludGVncmF0aW9uU3RhY2tdIEFnZW50Q29yZSBSdW50aW1l5L2c5oiQOiAke2FnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbi5mdW5jdGlvbk5hbWV9YCk7XG4gIH1cblxuICAvKipcbiAgICog44OP44Kk44OW44Oq44OD44OJ44Ki44O844Kt44OG44Kv44OB44Oj57Wx5ZCIXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUh5YnJpZEFyY2hpdGVjdHVyZSgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY29uZmlnLmh5YnJpZEFyY2hpdGVjdHVyZT8uZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgaHlicmlkQ29uZmlnID0gdGhpcy5jb25maWcuaHlicmlkQXJjaGl0ZWN0dXJlO1xuXG4gICAgLy8gQVBJIEdhdGV3YXnvvIhBZ2VudENvcmUgUnVudGltZeeUqO+8iVxuICAgIGlmIChoeWJyaWRDb25maWcuaW50ZWdyYXRpb24uYXBpR2F0ZXdheS5lbmFibGVkICYmIHRoaXMuYWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uKSB7XG4gICAgICBjb25zdCBhZ2VudENvcmVBcGkgPSBuZXcgUmVzdEFwaSh0aGlzLCAnQWdlbnRDb3JlQXBpJywge1xuICAgICAgICByZXN0QXBpTmFtZTogYCR7dGhpcy5jb25maWcucHJvamVjdE5hbWV9LWFnZW50Y29yZS1hcGlgLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBSdW50aW1lIEFQSSBmb3IgSHlicmlkIEFyY2hpdGVjdHVyZScsXG4gICAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICAgIGFsbG93T3JpZ2luczogQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgICBhbGxvd01ldGhvZHM6IENvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJ10sXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8gcmVhZG9ubHnjg5fjg63jg5Hjg4bjgqPjgavku6PlhaXjgZnjgovjgZ/jgoHjgIHlnovjgqLjgrXjg7zjgrfjg6fjg7PjgpLkvb/nlKhcbiAgICAgICh0aGlzIGFzIGFueSkuYWdlbnRDb3JlQXBpID0gYWdlbnRDb3JlQXBpO1xuXG4gICAgICAvLyBMYW1iZGHntbHlkIhcbiAgICAgIGNvbnN0IGFnZW50Q29yZUludGVncmF0aW9uID0gbmV3IExhbWJkYUludGVncmF0aW9uKHRoaXMuYWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uKTtcblxuICAgICAgLy8g44Or44O844OI6Kit5a6aXG4gICAgICBjb25zdCBhZ2VudENvcmVSZXNvdXJjZSA9IGFnZW50Q29yZUFwaS5yb290LmFkZFJlc291cmNlKCdhZ2VudGNvcmUnKTtcbiAgICAgIGFnZW50Q29yZVJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGFnZW50Q29yZUludGVncmF0aW9uKTtcbiAgICAgIGFnZW50Q29yZVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgYWdlbnRDb3JlSW50ZWdyYXRpb24pOyAvLyDjg5jjg6vjgrnjg4Hjgqfjg4Pjgq/nlKhcblxuICAgICAgY29uc29sZS5sb2coJ1tBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrXSBBUEkgR2F0ZXdheeS9nOaIkOWujOS6hicpO1xuICAgIH1cblxuICAgIC8vIEV2ZW50QnJpZGdl77yI44Kk44OZ44Oz44OI6aeG5YuV57Wx5ZCI77yJXG4gICAgaWYgKGh5YnJpZENvbmZpZy5pbnRlZ3JhdGlvbi5ldmVudEJyaWRnZS5lbmFibGVkKSB7XG4gICAgICBjb25zdCBoeWJyaWRFdmVudEJ1cyA9IG5ldyBFdmVudEJ1cyh0aGlzLCAnSHlicmlkRXZlbnRCdXMnLCB7XG4gICAgICAgIGV2ZW50QnVzTmFtZTogaHlicmlkQ29uZmlnLmludGVncmF0aW9uLmV2ZW50QnJpZGdlLmN1c3RvbUJ1cy5uYW1lLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIHJlYWRvbmx544OX44Ot44OR44OG44Kj44Gr5Luj5YWl44GZ44KL44Gf44KB44CB5Z6L44Ki44K144O844K344On44Oz44KS5L2/55SoXG4gICAgICAodGhpcyBhcyBhbnkpLmh5YnJpZEV2ZW50QnVzID0gaHlicmlkRXZlbnRCdXM7XG5cbiAgICAgIC8vIEFnZW50Q29yZeWHpueQhuWujOS6huOCpOODmeODs+ODiOODq+ODvOODq1xuICAgICAgaWYgKHRoaXMuYWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uKSB7XG4gICAgICAgIG5ldyBSdWxlKHRoaXMsICdBZ2VudENvcmVQcm9jZXNzaW5nUnVsZScsIHtcbiAgICAgICAgICBldmVudEJ1czogaHlicmlkRXZlbnRCdXMsXG4gICAgICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgICAgICBzb3VyY2U6IFsnYWdlbnRjb3JlLnJ1bnRpbWUnXSxcbiAgICAgICAgICAgIGRldGFpbFR5cGU6IFsnUHJvY2Vzc2luZyBDb21wbGV0ZScsICdQcm9jZXNzaW5nIEZhaWxlZCddLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgdGFyZ2V0czogW1xuICAgICAgICAgICAgbmV3IExhbWJkYUZ1bmN0aW9uKHRoaXMuYWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uLCB7XG4gICAgICAgICAgICAgIGV2ZW50OiBSdWxlVGFyZ2V0SW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAgICAgICAgICAgZXZlbnRUeXBlOiAnYWdlbnRjb3JlLWV2ZW50JyxcbiAgICAgICAgICAgICAgICB0aW1lc3RhbXA6ICckLnRpbWUnLFxuICAgICAgICAgICAgICAgIGRldGFpbDogJyQuZGV0YWlsJyxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgY29uc29sZS5sb2coJ1tBZ2VudENvcmVJbnRlZ3JhdGlvblN0YWNrXSBFdmVudEJyaWRnZee1seWQiOWujOS6hicpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDnm6Poppbjg7vjgqLjg6njg7zjg4jjgqTjg7Pjg5Xjg6njgrnjg4jjg6njgq/jg4Hjg6NcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTW9uaXRvcmluZ0luZnJhc3RydWN0dXJlKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jb25maWcuYWdlbnRDb3JlPy5tb25pdG9yaW5nPy5lbmFibGVkKSByZXR1cm47XG5cbiAgICAvLyBTTlMgVG9waWPvvIjjgqLjg6njg7zjg4jpgJrnn6XnlKjvvIlcbiAgICBjb25zdCBtb25pdG9yaW5nVG9waWMgPSBuZXcgVG9waWModGhpcywgJ0FnZW50Q29yZU1vbml0b3JpbmdUb3BpYycsIHtcbiAgICAgIHRvcGljTmFtZTogYCR7dGhpcy5jb25maWcucHJvamVjdE5hbWV9LWFnZW50Y29yZS1hbGVydHNgLFxuICAgIH0pO1xuXG4gICAgLy8gcmVhZG9ubHnjg5fjg63jg5Hjg4bjgqPjgavku6PlhaXjgZnjgovjgZ/jgoHjgIHlnovjgqLjgrXjg7zjgrfjg6fjg7PjgpLkvb/nlKhcbiAgICAodGhpcyBhcyBhbnkpLm1vbml0b3JpbmdUb3BpYyA9IG1vbml0b3JpbmdUb3BpYztcblxuICAgIC8vIEFnZW50Q29yZSBSdW50aW1l55uj6KaWXG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uKSB7XG4gICAgICAvLyDjgqjjg6njg7znjofjgqLjg6njg7zjg6BcbiAgICAgIGNvbnN0IGVycm9yUmF0ZUFsYXJtID0gbmV3IEFsYXJtKHRoaXMsICdBZ2VudENvcmVFcnJvclJhdGVBbGFybScsIHtcbiAgICAgICAgbWV0cmljOiB0aGlzLmFnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbi5tZXRyaWNFcnJvcnMoe1xuICAgICAgICAgIHBlcmlvZDogRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSksXG4gICAgICAgIHRocmVzaG9sZDogNSwgLy8gNeWIhumWk+OBpzXjgqjjg6njg7zku6XkuIpcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBZ2VudENvcmUgUnVudGltZSBlcnJvciByYXRlIGlzIGhpZ2gnLFxuICAgICAgfSk7XG5cbiAgICAgIGVycm9yUmF0ZUFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBTbnNBY3Rpb24obW9uaXRvcmluZ1RvcGljKSk7XG5cbiAgICAgIC8vIOODrOOCpOODhuODs+OCt+OCouODqeODvOODoFxuICAgICAgY29uc3QgbGF0ZW5jeUFsYXJtID0gbmV3IEFsYXJtKHRoaXMsICdBZ2VudENvcmVMYXRlbmN5QWxhcm0nLCB7XG4gICAgICAgIG1ldHJpYzogdGhpcy5hZ2VudENvcmVSdW50aW1lRnVuY3Rpb24ubWV0cmljRHVyYXRpb24oe1xuICAgICAgICAgIHBlcmlvZDogRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSksXG4gICAgICAgIHRocmVzaG9sZDogMzAwMDAsIC8vIDMw56eSXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAzLFxuICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6IENvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIFJ1bnRpbWUgbGF0ZW5jeSBpcyBoaWdoJyxcbiAgICAgIH0pO1xuXG4gICAgICBsYXRlbmN5QWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IFNuc0FjdGlvbihtb25pdG9yaW5nVG9waWMpKTtcbiAgICB9XG5cbiAgICAvLyDjg6bjg7zjgrbjg7zoqK3lrprjg4bjg7zjg5bjg6vnm6PoppZcbiAgICBpZiAodGhpcy51c2VyUHJlZmVyZW5jZXNUYWJsZSkge1xuICAgICAgY29uc3QgcmVhZFRocm90dGxlQWxhcm0gPSBuZXcgQWxhcm0odGhpcywgJ1ByZWZlcmVuY2VzVGFibGVSZWFkVGhyb3R0bGVBbGFybScsIHtcbiAgICAgICAgbWV0cmljOiBuZXcgTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvRHluYW1vREInLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdSZWFkVGhyb3R0bGVkRXZlbnRzJyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICBUYWJsZU5hbWU6IHRoaXMudXNlclByZWZlcmVuY2VzVGFibGUudGFibGVOYW1lLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcGVyaW9kOiBEdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBDb21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX09SX0VRVUFMX1RPX1RIUkVTSE9MRCxcbiAgICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ1VzZXIgcHJlZmVyZW5jZXMgdGFibGUgcmVhZCB0aHJvdHRsaW5nIGRldGVjdGVkJyxcbiAgICAgIH0pO1xuXG4gICAgICByZWFkVGhyb3R0bGVBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgU25zQWN0aW9uKG1vbml0b3JpbmdUb3BpYykpO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCdbQWdlbnRDb3JlSW50ZWdyYXRpb25TdGFja10g55uj6KaW44Kk44Oz44OV44Op44K544OI44Op44Kv44OB44Oj5L2c5oiQ5a6M5LqGJyk7XG4gIH1cblxuICAvKipcbiAgICogQ2xvdWRGb3JtYXRpb24gT3V0cHV0c1xuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCk6IHZvaWQge1xuICAgIC8vIEFnZW50Q29yZSBSdW50aW1lIEZ1bmN0aW9uIEFSTlxuICAgIGlmICh0aGlzLmFnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbikge1xuICAgICAgbmV3IENmbk91dHB1dCh0aGlzLCAnQWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uQXJuJywge1xuICAgICAgICB2YWx1ZTogdGhpcy5hZ2VudENvcmVSdW50aW1lRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIFJ1bnRpbWUgTGFtYmRhIEZ1bmN0aW9uIEFSTicsXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BZ2VudENvcmVSdW50aW1lRnVuY3Rpb25Bcm5gLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbk5hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmFnZW50Q29yZVJ1bnRpbWVGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQWdlbnRDb3JlIFJ1bnRpbWUgTGFtYmRhIEZ1bmN0aW9uIE5hbWUnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlUnVudGltZUZ1bmN0aW9uTmFtZWAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjg6bjg7zjgrbjg7zoqK3lrprjg4bjg7zjg5bjg6tcbiAgICBpZiAodGhpcy51c2VyUHJlZmVyZW5jZXNUYWJsZSkge1xuICAgICAgbmV3IENmbk91dHB1dCh0aGlzLCAnVXNlclByZWZlcmVuY2VzVGFibGVOYW1lJywge1xuICAgICAgICB2YWx1ZTogdGhpcy51c2VyUHJlZmVyZW5jZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnVXNlciBQcmVmZXJlbmNlcyBEeW5hbW9EQiBUYWJsZSBOYW1lJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVVzZXJQcmVmZXJlbmNlc1RhYmxlTmFtZWAsXG4gICAgICB9KTtcblxuICAgICAgbmV3IENmbk91dHB1dCh0aGlzLCAnVXNlclByZWZlcmVuY2VzVGFibGVBcm4nLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLnVzZXJQcmVmZXJlbmNlc1RhYmxlLnRhYmxlQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgUHJlZmVyZW5jZXMgRHluYW1vREIgVGFibGUgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVVzZXJQcmVmZXJlbmNlc1RhYmxlQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEFQSSBHYXRld2F5XG4gICAgaWYgKHRoaXMuYWdlbnRDb3JlQXBpKSB7XG4gICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdBZ2VudENvcmVBcGlJZCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlQXBpLnJlc3RBcGlJZCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgQVBJIEdhdGV3YXkgSUQnLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWdlbnRDb3JlQXBpSWRgLFxuICAgICAgfSk7XG5cbiAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0FnZW50Q29yZUFwaVVybCcsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuYWdlbnRDb3JlQXBpLnVybCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZ2VudENvcmUgQVBJIEdhdGV3YXkgVVJMJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFnZW50Q29yZUFwaVVybGAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBFdmVudEJyaWRnZVxuICAgIGlmICh0aGlzLmh5YnJpZEV2ZW50QnVzKSB7XG4gICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdIeWJyaWRFdmVudEJ1c0FybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMuaHlicmlkRXZlbnRCdXMuZXZlbnRCdXNBcm4sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnSHlicmlkIEFyY2hpdGVjdHVyZSBFdmVudEJyaWRnZSBCdXMgQVJOJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUh5YnJpZEV2ZW50QnVzQXJuYCxcbiAgICAgIH0pO1xuXG4gICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdIeWJyaWRFdmVudEJ1c05hbWUnLCB7XG4gICAgICAgIHZhbHVlOiB0aGlzLmh5YnJpZEV2ZW50QnVzLmV2ZW50QnVzTmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246ICdIeWJyaWQgQXJjaGl0ZWN0dXJlIEV2ZW50QnJpZGdlIEJ1cyBOYW1lJyxcbiAgICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUh5YnJpZEV2ZW50QnVzTmFtZWAsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDnm6Poppbjg4jjg5Tjg4Pjgq9cbiAgICBpZiAodGhpcy5tb25pdG9yaW5nVG9waWMpIHtcbiAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ01vbml0b3JpbmdUb3BpY0FybicsIHtcbiAgICAgICAgdmFsdWU6IHRoaXMubW9uaXRvcmluZ1RvcGljLnRvcGljQXJuLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBNb25pdG9yaW5nIFNOUyBUb3BpYyBBUk4nLFxuICAgICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tTW9uaXRvcmluZ1RvcGljQXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIOapn+iDveODleODqeOCsOeKtuaFi1xuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0ZlYXR1cmVGbGFnc1N0YXR1cycsIHtcbiAgICAgIHZhbHVlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGFnZW50Q29yZUludGVncmF0aW9uOiB0aGlzLmZlYXR1cmVGbGFncy5lbmFibGVBZ2VudENvcmVJbnRlZ3JhdGlvbixcbiAgICAgICAgaHlicmlkQXJjaGl0ZWN0dXJlOiB0aGlzLmZlYXR1cmVGbGFncy5lbmFibGVIeWJyaWRBcmNoaXRlY3R1cmUsXG4gICAgICAgIHVzZXJQcmVmZXJlbmNlczogdGhpcy5mZWF0dXJlRmxhZ3MuZW5hYmxlVXNlclByZWZlcmVuY2VzLFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbjogJ0FnZW50Q29yZSBJbnRlZ3JhdGlvbiBGZWF0dXJlIEZsYWdzIFN0YXR1cycsXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygnW0FnZW50Q29yZUludGVncmF0aW9uU3RhY2tdIENsb3VkRm9ybWF0aW9uIE91dHB1dHPkvZzmiJDlrozkuoYnKTtcbiAgfVxufSJdfQ==