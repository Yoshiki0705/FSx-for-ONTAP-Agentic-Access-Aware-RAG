"use strict";
/**
 * Amazon Bedrock AgentCore Observability Construct
 *
 * このConstructは、Bedrock Agentの監視・トレーシング・デバッグ機能を提供します。
 * X-Ray統合、CloudWatch統合、エラー追跡を統合します。
 *
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
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
exports.BedrockAgentCoreObservabilityConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatch_actions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const xray = __importStar(require("aws-cdk-lib/aws-xray"));
const constructs_1 = require("constructs");
/**
 * Amazon Bedrock AgentCore Observability Construct
 *
 * Bedrock Agentの監視・トレーシング・デバッグ機能を提供するConstruct。
 * X-Ray統合、CloudWatch統合、エラー追跡を統合します。
 */
class BedrockAgentCoreObservabilityConstruct extends constructs_1.Construct {
    /**
     * KMS暗号化キー
     */
    kmsKey;
    /**
     * X-Ray Group
     */
    xrayGroup;
    /**
     * X-Ray Sampling Rule
     */
    xraySamplingRule;
    /**
     * CloudWatchダッシュボード
     */
    dashboard;
    /**
     * ログロググループ
     */
    logGroup;
    /**
     * エラー率アラーム
     */
    errorRateAlarm;
    /**
     * レイテンシアラーム
     */
    latencyAlarm;
    /**
     * スループットアラーム
     */
    throughputAlarm;
    /**
     * トークン使用量アラーム
     */
    tokenUsageAlarm;
    /**
     * メトリクスフィルター（エラーパターン）
     */
    errorPatternFilter;
    /**
     * メトリクスフィルター（警告パターン）
     */
    warningPatternFilter;
    /**
     * メトリクスフィルター（パフォーマンス低下）
     */
    performanceDegradationFilter;
    constructor(scope, id, props) {
        super(scope, id);
        // 機能が無効化されている場合は何もしない
        if (!props.enabled) {
            // ダミーのログロググループを作成（必須プロパティのため）
            this.logGroup = new logs.LogGroup(this, 'DummyLogGroup', {
                logGroupName: `/aws/bedrock/agent-core/${props.projectName}/${props.environment}/observability-disabled`,
                retention: logs.RetentionDays.ONE_DAY,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            return;
        }
        // KMS暗号化キーの作成または参照
        if (props.kmsConfig?.enabled !== false) {
            if (props.kmsConfig?.kmsKeyArn) {
                this.kmsKey = kms.Key.fromKeyArn(this, 'KmsKey', props.kmsConfig.kmsKeyArn);
            }
            else {
                this.kmsKey = new kms.Key(this, 'KmsKey', {
                    description: `KMS key for ${props.projectName} ${props.environment} AgentCore Observability`,
                    enableKeyRotation: true,
                    removalPolicy: cdk.RemovalPolicy.RETAIN,
                });
            }
        }
        // ログロググループの作成
        const logRetentionDays = props.errorTrackingConfig?.logRetentionDays || 30;
        this.logGroup = new logs.LogGroup(this, 'LogGroup', {
            logGroupName: `/aws/bedrock/agent-core/${props.projectName}/${props.environment}/observability`,
            retention: this.getLogRetention(logRetentionDays),
            encryptionKey: this.kmsKey,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // X-Ray統合
        if (props.xrayConfig?.enabled !== false) {
            this.createXRayIntegration(props);
        }
        // CloudWatch統合
        if (props.cloudwatchConfig?.enabled !== false) {
            this.createCloudWatchIntegration(props);
        }
        // タグ付け
        if (props.tags) {
            Object.entries(props.tags).forEach(([key, value]) => {
                cdk.Tags.of(this).add(key, value);
            });
        }
        // デフォルトタグ
        cdk.Tags.of(this).add('Project', props.projectName);
        cdk.Tags.of(this).add('Environment', props.environment);
        cdk.Tags.of(this).add('Component', 'AgentCore-Observability');
    }
    /**
     * X-Ray統合を作成
     */
    createXRayIntegration(props) {
        const groupName = props.xrayConfig?.groupName ||
            `${props.projectName}-${props.environment}-agent-core`;
        const filterExpression = props.xrayConfig?.filterExpression ||
            'service("agent-core")';
        // X-Ray Group作成
        this.xrayGroup = new xray.CfnGroup(this, 'XRayGroup', {
            groupName,
            filterExpression,
        });
        // カスタムサンプリングルール作成
        if (props.xrayConfig?.customSamplingRule !== false) {
            this.createXRaySamplingRule(props);
        }
    }
    /**
     * X-Rayサンプリングルールを作成
     */
    createXRaySamplingRule(props) {
        const samplingRate = props.xrayConfig?.samplingRate || 0.1;
        const priority = props.xrayConfig?.samplingRulePriority || 1000;
        this.xraySamplingRule = new xray.CfnSamplingRule(this, 'XRaySamplingRule', {
            samplingRule: {
                ruleName: `${props.projectName}-${props.environment}-agent-core-sampling`,
                priority,
                fixedRate: samplingRate,
                reservoirSize: 1,
                serviceName: 'agent-core',
                serviceType: '*',
                host: '*',
                httpMethod: '*',
                urlPath: '*',
                version: 1,
                resourceArn: '*',
                attributes: {},
            },
        });
    }
    /**
     * Lambda関数にX-Rayトレーシングを有効化
     *
     * @param lambdaFunction - トレーシングを有効化するLambda関数
     * @param detailedTracing - 詳細トレーシングを有効化（デフォルト: true）
     * @returns Lambda関数（チェーン可能）
     */
    enableXRayForLambda(lambdaFunction, detailedTracing = true) {
        // X-Ray統合が無効の場合は何もしない
        if (!this.xrayGroup) {
            return lambdaFunction;
        }
        // Lambda関数にX-Ray権限を付与
        lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'xray:PutTraceSegments',
                'xray:PutTelemetryRecords',
            ],
            resources: ['*'],
        }));
        // 環境変数を追加
        lambdaFunction.addEnvironment('AWS_XRAY_TRACING_NAME', 'agent-core');
        lambdaFunction.addEnvironment('AWS_XRAY_CONTEXT_MISSING', 'LOG_ERROR');
        if (detailedTracing) {
            lambdaFunction.addEnvironment('AWS_XRAY_DEBUG_MODE', 'TRUE');
        }
        return lambdaFunction;
    }
    /**
     * 複数のLambda関数にX-Rayトレーシングを一括有効化
     *
     * @param lambdaFunctions - トレーシングを有効化するLambda関数の配列
     * @param detailedTracing - 詳細トレーシングを有効化（デフォルト: true）
     */
    enableXRayForLambdas(lambdaFunctions, detailedTracing = true) {
        lambdaFunctions.forEach(fn => this.enableXRayForLambda(fn, detailedTracing));
    }
    /**
     * カスタムセグメント追加用の環境変数を設定
     *
     * Lambda関数内でカスタムセグメントを追加するための設定を行います。
     *
     * @param lambdaFunction - 設定対象のLambda関数
     * @param segmentName - カスタムセグメント名
     */
    addCustomSegmentConfig(lambdaFunction, segmentName) {
        lambdaFunction.addEnvironment('XRAY_CUSTOM_SEGMENT_NAME', segmentName);
        lambdaFunction.addEnvironment('XRAY_GROUP_NAME', this.xrayGroup?.groupName || '');
    }
    /**
     * CloudWatch統合を作成
     */
    createCloudWatchIntegration(props) {
        const namespace = props.cloudwatchConfig?.namespace || 'AWS/Bedrock/AgentCore';
        // メトリクスフィルター作成
        if (props.cloudwatchConfig?.metricFilters) {
            this.createMetricFilters(props, namespace);
        }
        // ダッシュボード作成
        if (props.cloudwatchConfig?.createDashboard !== false) {
            const dashboardName = props.cloudwatchConfig?.dashboardName ||
                `${props.projectName}-${props.environment}-agent-core-observability`;
            this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
                dashboardName,
            });
            // メトリクスウィジェット追加
            this.addDashboardWidgets(props, namespace);
        }
        // アラーム作成
        if (props.cloudwatchConfig?.alarms) {
            this.createAlarms(props, namespace);
        }
    }
    /**
     * メトリクスフィルターを作成
     */
    createMetricFilters(props, namespace) {
        // エラーパターンフィルター
        if (props.cloudwatchConfig?.metricFilters?.errorPatterns !== false) {
            this.errorPatternFilter = new logs.MetricFilter(this, 'ErrorPatternFilter', {
                logGroup: this.logGroup,
                metricNamespace: namespace,
                metricName: 'ErrorCount',
                filterPattern: logs.FilterPattern.anyTerm('ERROR', 'Error', 'error', 'Exception', 'exception'),
                metricValue: '1',
                defaultValue: 0,
            });
        }
        // 警告パターンフィルター
        if (props.cloudwatchConfig?.metricFilters?.warningPatterns !== false) {
            this.warningPatternFilter = new logs.MetricFilter(this, 'WarningPatternFilter', {
                logGroup: this.logGroup,
                metricNamespace: namespace,
                metricName: 'WarningCount',
                filterPattern: logs.FilterPattern.anyTerm('WARN', 'Warning', 'warning'),
                metricValue: '1',
                defaultValue: 0,
            });
        }
        // パフォーマンス低下パターンフィルター
        if (props.cloudwatchConfig?.metricFilters?.performanceDegradation !== false) {
            this.performanceDegradationFilter = new logs.MetricFilter(this, 'PerformanceDegradationFilter', {
                logGroup: this.logGroup,
                metricNamespace: namespace,
                metricName: 'SlowExecutionCount',
                filterPattern: logs.FilterPattern.anyTerm('slow', 'timeout', 'degraded', 'throttled'),
                metricValue: '1',
                defaultValue: 0,
            });
        }
    }
    /**
     * ダッシュボードウィジェットを追加
     */
    addDashboardWidgets(props, namespace) {
        if (!this.dashboard)
            return;
        const customMetrics = props.cloudwatchConfig?.customMetrics;
        // エラー率ウィジェット
        if (customMetrics?.errorRate !== false) {
            this.dashboard.addWidgets(new cloudwatch.GraphWidget({
                title: 'Error Rate',
                left: [
                    new cloudwatch.Metric({
                        namespace,
                        metricName: 'ErrorRate',
                        statistic: 'Average',
                        period: cdk.Duration.minutes(5),
                    }),
                    new cloudwatch.Metric({
                        namespace,
                        metricName: 'ErrorCount',
                        statistic: 'Sum',
                        period: cdk.Duration.minutes(5),
                    }),
                ],
                width: 12,
            }));
        }
        // レイテンシウィジェット
        if (customMetrics?.executionLatency !== false) {
            this.dashboard.addWidgets(new cloudwatch.GraphWidget({
                title: 'Execution Latency',
                left: [
                    new cloudwatch.Metric({
                        namespace,
                        metricName: 'Latency',
                        statistic: 'Average',
                        period: cdk.Duration.minutes(5),
                        label: 'Average',
                    }),
                    new cloudwatch.Metric({
                        namespace,
                        metricName: 'Latency',
                        statistic: 'p99',
                        period: cdk.Duration.minutes(5),
                        label: 'P99',
                    }),
                ],
                width: 12,
            }));
        }
        // スループットウィジェット
        if (customMetrics?.throughput !== false) {
            this.dashboard.addWidgets(new cloudwatch.GraphWidget({
                title: 'Throughput',
                left: [
                    new cloudwatch.Metric({
                        namespace,
                        metricName: 'Throughput',
                        statistic: 'Sum',
                        period: cdk.Duration.minutes(5),
                    }),
                ],
                width: 12,
            }));
        }
        // トークン使用量ウィジェット
        if (customMetrics?.tokenUsage !== false) {
            this.dashboard.addWidgets(new cloudwatch.GraphWidget({
                title: 'Token Usage',
                left: [
                    new cloudwatch.Metric({
                        namespace,
                        metricName: 'InputTokens',
                        statistic: 'Sum',
                        period: cdk.Duration.minutes(5),
                        label: 'Input Tokens',
                    }),
                    new cloudwatch.Metric({
                        namespace,
                        metricName: 'OutputTokens',
                        statistic: 'Sum',
                        period: cdk.Duration.minutes(5),
                        label: 'Output Tokens',
                    }),
                ],
                width: 12,
            }));
        }
        // コスト追跡ウィジェット
        if (customMetrics?.costTracking !== false) {
            this.dashboard.addWidgets(new cloudwatch.GraphWidget({
                title: 'Estimated Cost',
                left: [
                    new cloudwatch.Metric({
                        namespace,
                        metricName: 'EstimatedCost',
                        statistic: 'Sum',
                        period: cdk.Duration.hours(1),
                    }),
                ],
                width: 12,
            }));
        }
        // X-Rayトレースウィジェット
        this.dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'X-Ray Traces',
            left: [
                new cloudwatch.Metric({
                    namespace: 'AWS/XRay',
                    metricName: 'TraceCount',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                }),
            ],
            width: 12,
        }));
        // 警告・パフォーマンス低下ウィジェット
        this.dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Warnings & Performance Issues',
            left: [
                new cloudwatch.Metric({
                    namespace,
                    metricName: 'WarningCount',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Warnings',
                }),
                new cloudwatch.Metric({
                    namespace,
                    metricName: 'SlowExecutionCount',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                    label: 'Slow Executions',
                }),
            ],
            width: 12,
        }));
    }
    /**
     * アラームを作成
     */
    createAlarms(props, namespace) {
        const alarmConfig = props.cloudwatchConfig?.alarms;
        if (!alarmConfig)
            return;
        // エラー率アラーム
        const errorRateThreshold = alarmConfig.errorRateThreshold || 5;
        this.errorRateAlarm = new cloudwatch.Alarm(this, 'ErrorRateAlarm', {
            alarmName: `${props.projectName}-${props.environment}-agent-core-error-rate`,
            alarmDescription: `Error rate exceeded ${errorRateThreshold}%`,
            metric: new cloudwatch.Metric({
                namespace,
                metricName: 'ErrorRate',
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
            }),
            threshold: errorRateThreshold,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        });
        // レイテンシアラーム
        const latencyThreshold = alarmConfig.latencyThreshold || 3000;
        this.latencyAlarm = new cloudwatch.Alarm(this, 'LatencyAlarm', {
            alarmName: `${props.projectName}-${props.environment}-agent-core-latency`,
            alarmDescription: `Latency exceeded ${latencyThreshold}ms`,
            metric: new cloudwatch.Metric({
                namespace,
                metricName: 'Latency',
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
            }),
            threshold: latencyThreshold,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        });
        // スループットアラーム
        if (alarmConfig.throughputThreshold) {
            this.throughputAlarm = new cloudwatch.Alarm(this, 'ThroughputAlarm', {
                alarmName: `${props.projectName}-${props.environment}-agent-core-throughput`,
                alarmDescription: `Throughput dropped below ${alarmConfig.throughputThreshold}`,
                metric: new cloudwatch.Metric({
                    namespace,
                    metricName: 'Throughput',
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(5),
                }),
                threshold: alarmConfig.throughputThreshold,
                evaluationPeriods: 2,
                comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
            });
        }
        // トークン使用量アラーム
        if (alarmConfig.tokenUsageThreshold) {
            this.tokenUsageAlarm = new cloudwatch.Alarm(this, 'TokenUsageAlarm', {
                alarmName: `${props.projectName}-${props.environment}-agent-core-token-usage`,
                alarmDescription: `Token usage exceeded ${alarmConfig.tokenUsageThreshold}`,
                metric: new cloudwatch.Metric({
                    namespace,
                    metricName: 'TotalTokens',
                    statistic: 'Sum',
                    period: cdk.Duration.hours(1),
                }),
                threshold: alarmConfig.tokenUsageThreshold,
                evaluationPeriods: 1,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            });
        }
        // SNS通知設定
        if (alarmConfig.snsTopicArn) {
            const snsTopic = sns.Topic.fromTopicArn(this, 'SnsTopic', alarmConfig.snsTopicArn);
            this.errorRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
            this.latencyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
            if (this.throughputAlarm) {
                this.throughputAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
            }
            if (this.tokenUsageAlarm) {
                this.tokenUsageAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
            }
        }
    }
    /**
     * ログ保持期間を取得
     */
    getLogRetention(days) {
        const retentionMap = {
            1: logs.RetentionDays.ONE_DAY,
            3: logs.RetentionDays.THREE_DAYS,
            5: logs.RetentionDays.FIVE_DAYS,
            7: logs.RetentionDays.ONE_WEEK,
            14: logs.RetentionDays.TWO_WEEKS,
            30: logs.RetentionDays.ONE_MONTH,
            60: logs.RetentionDays.TWO_MONTHS,
            90: logs.RetentionDays.THREE_MONTHS,
            120: logs.RetentionDays.FOUR_MONTHS,
            150: logs.RetentionDays.FIVE_MONTHS,
            180: logs.RetentionDays.SIX_MONTHS,
            365: logs.RetentionDays.ONE_YEAR,
            400: logs.RetentionDays.THIRTEEN_MONTHS,
            545: logs.RetentionDays.EIGHTEEN_MONTHS,
            731: logs.RetentionDays.TWO_YEARS,
            1827: logs.RetentionDays.FIVE_YEARS,
            3653: logs.RetentionDays.TEN_YEARS,
        };
        return retentionMap[days] || logs.RetentionDays.ONE_MONTH;
    }
    /**
     * Lambda関数にカスタムメトリクス送信の環境変数を設定
     *
     * @param lambdaFunction - 設定対象のLambda関数
     * @param namespace - CloudWatchメトリクスの名前空間
     */
    addMetricsConfig(lambdaFunction, namespace) {
        const metricsNamespace = namespace || 'AWS/Bedrock/AgentCore';
        lambdaFunction.addEnvironment('CLOUDWATCH_METRICS_NAMESPACE', metricsNamespace);
        lambdaFunction.addEnvironment('METRICS_ENABLED', 'true');
        // CloudWatch権限を付与
        lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['cloudwatch:PutMetricData'],
            resources: ['*'],
        }));
    }
    /**
     * Lambda関数にログ集約の環境変数を設定
     *
     * @param lambdaFunction - 設定対象のLambda関数
     */
    addLoggingConfig(lambdaFunction) {
        lambdaFunction.addEnvironment('LOG_GROUP_NAME', this.logGroup.logGroupName);
        lambdaFunction.addEnvironment('LOG_LEVEL', 'INFO');
        // CloudWatch Logs権限を付与
        this.logGroup.grantWrite(lambdaFunction);
    }
    /**
     * 複数のLambda関数に監視設定を一括適用
     *
     * @param lambdaFunctions - 設定対象のLambda関数の配列
     * @param options - 設定オプション
     */
    configureObservabilityForLambdas(lambdaFunctions, options) {
        const opts = {
            enableXRay: true,
            enableMetrics: true,
            enableLogging: true,
            ...options,
        };
        lambdaFunctions.forEach(fn => {
            if (opts.enableXRay) {
                this.enableXRayForLambda(fn);
            }
            if (opts.enableMetrics) {
                this.addMetricsConfig(fn, opts.namespace);
            }
            if (opts.enableLogging) {
                this.addLoggingConfig(fn);
            }
        });
    }
    /**
     * Lambda関数にエラー追跡設定を追加
     *
     * @param lambdaFunction - 設定対象のLambda関数
     */
    addErrorTrackingConfig(lambdaFunction) {
        // エラー追跡環境変数を設定
        lambdaFunction.addEnvironment('ERROR_TRACKING_ENABLED', 'true');
        lambdaFunction.addEnvironment('ERROR_PATTERN_ANALYSIS', 'true');
        lambdaFunction.addEnvironment('RCA_ENABLED', 'true');
        // ログロググループ名を設定
        lambdaFunction.addEnvironment('ERROR_LOG_GROUP', this.logGroup.logGroupName);
    }
    /**
     * エラー通知用のSNSトピックを設定
     *
     * @param snsTopicArn - SNSトピックARN
     * @returns SNSトピック
     */
    configureErrorNotifications(snsTopicArn) {
        const snsTopic = sns.Topic.fromTopicArn(this, 'ErrorNotificationTopic', snsTopicArn);
        // 全てのアラームにSNS通知を追加
        if (this.errorRateAlarm) {
            this.errorRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
        }
        if (this.latencyAlarm) {
            this.latencyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
        }
        if (this.throughputAlarm) {
            this.throughputAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
        }
        if (this.tokenUsageAlarm) {
            this.tokenUsageAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
        }
        return snsTopic;
    }
    /**
     * エラー追跡用のメトリクスフィルターを取得
     *
     * @returns エラー追跡用のメトリクスフィルターの配列
     */
    getErrorTrackingFilters() {
        const filters = [];
        if (this.errorPatternFilter) {
            filters.push(this.errorPatternFilter);
        }
        if (this.warningPatternFilter) {
            filters.push(this.warningPatternFilter);
        }
        if (this.performanceDegradationFilter) {
            filters.push(this.performanceDegradationFilter);
        }
        return filters;
    }
}
exports.BedrockAgentCoreObservabilityConstruct = BedrockAgentCoreObservabilityConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLW9ic2VydmFiaWxpdHktY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmVkcm9jay1hZ2VudC1jb3JlLW9ic2VydmFiaWxpdHktY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7O0dBU0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCx1RkFBeUU7QUFDekUseURBQTJDO0FBQzNDLHlEQUEyQztBQUUzQywyREFBNkM7QUFDN0MseURBQTJDO0FBQzNDLDJEQUE2QztBQUM3QywyQ0FBdUM7QUFnUXZDOzs7OztHQUtHO0FBQ0gsTUFBYSxzQ0FBdUMsU0FBUSxzQkFBUztJQUNuRTs7T0FFRztJQUNhLE1BQU0sQ0FBWTtJQUVsQzs7T0FFRztJQUNJLFNBQVMsQ0FBaUI7SUFFakM7O09BRUc7SUFDSSxnQkFBZ0IsQ0FBd0I7SUFFL0M7O09BRUc7SUFDSSxTQUFTLENBQXdCO0lBRXhDOztPQUVHO0lBQ2EsUUFBUSxDQUFnQjtJQUV4Qzs7T0FFRztJQUNJLGNBQWMsQ0FBb0I7SUFFekM7O09BRUc7SUFDSSxZQUFZLENBQW9CO0lBRXZDOztPQUVHO0lBQ0ksZUFBZSxDQUFvQjtJQUUxQzs7T0FFRztJQUNJLGVBQWUsQ0FBb0I7SUFFMUM7O09BRUc7SUFDSSxrQkFBa0IsQ0FBcUI7SUFFOUM7O09BRUc7SUFDSSxvQkFBb0IsQ0FBcUI7SUFFaEQ7O09BRUc7SUFDSSw0QkFBNEIsQ0FBcUI7SUFFeEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFrRDtRQUMxRixLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLHNCQUFzQjtRQUN0QixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ25CLDhCQUE4QjtZQUM5QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksSUFBSSxDQUFD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QztDQUNGO0FBM3RCRCx3RkEydEJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBbWF6b24gQmVkcm9jayBBZ2VudENvcmUgT2JzZXJ2YWJpbGl0eSBDb25zdHJ1Y3RcbiAqIFxuICog44GT44GuQ29uc3RydWN044Gv44CBQmVkcm9jayBBZ2VudOOBruebo+imluODu+ODiOODrOODvOOCt+ODs+OCsOODu+ODh+ODkOODg+OCsOapn+iDveOCkuaPkOS+m+OBl+OBvuOBmeOAglxuICogWC1SYXnntbHlkIjjgIFDbG91ZFdhdGNo57Wx5ZCI44CB44Ko44Op44O86L+96Leh44KS57Wx5ZCI44GX44G+44GZ44CCXG4gKiBcbiAqIEBhdXRob3IgS2lybyBBSVxuICogQGRhdGUgMjAyNi0wMS0wNFxuICogQHZlcnNpb24gMS4wLjBcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoX2FjdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBrbXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWttcyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHhyYXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLXhyYXknO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbi8qKlxuICogWC1SYXnoqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBYUmF5Q29uZmlnIHtcbiAgLyoqXG4gICAqIFgtUmF557Wx5ZCI44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOOCteODs+ODl+ODquODs+OCsOODrOODvOODiO+8iDAuMC0xLjDvvIlcbiAgICogQGRlZmF1bHQgMC4xXG4gICAqL1xuICByZWFkb25seSBzYW1wbGluZ1JhdGU/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFgtUmF5IEdyb3Vw5ZCNXG4gICAqIEBkZWZhdWx0IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1hZ2VudC1jb3JlYFxuICAgKi9cbiAgcmVhZG9ubHkgZ3JvdXBOYW1lPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDjg5XjgqPjg6vjgr/jg7zlvI9cbiAgICogQGRlZmF1bHQgJ3NlcnZpY2UoXCJhZ2VudC1jb3JlXCIpJ1xuICAgKi9cbiAgcmVhZG9ubHkgZmlsdGVyRXhwcmVzc2lvbj86IHN0cmluZztcblxuICAvKipcbiAgICog6Kmz57Sw44OI44Os44O844K344Oz44Kw44KS5pyJ5Yq55YyWXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGRldGFpbGVkVHJhY2luZz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOOCq+OCueOCv+ODoOOCteODs+ODl+ODquODs+OCsOODq+ODvOODq+OCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBjdXN0b21TYW1wbGluZ1J1bGU/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDjgrXjg7Pjg5fjg6rjg7PjgrDjg6vjg7zjg6vlhKrlhYjluqZcbiAgICogQGRlZmF1bHQgMTAwMFxuICAgKi9cbiAgcmVhZG9ubHkgc2FtcGxpbmdSdWxlUHJpb3JpdHk/OiBudW1iZXI7XG59XG5cbi8qKlxuICogQ2xvdWRXYXRjaOioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENsb3VkV2F0Y2hDb25maWcge1xuICAvKipcbiAgICogQ2xvdWRXYXRjaOe1seWQiOOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDjgqvjgrnjgr/jg6Djg6Hjg4jjg6rjgq/jgrnjga7lkI3liY3nqbrplpNcbiAgICogQGRlZmF1bHQgJ0FXUy9CZWRyb2NrL0FnZW50Q29yZSdcbiAgICovXG4gIHJlYWRvbmx5IG5hbWVzcGFjZT86IHN0cmluZztcblxuICAvKipcbiAgICog44OA44OD44K344Ol44Oc44O844OJ6Ieq5YuV55Sf5oiQXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIHJlYWRvbmx5IGNyZWF0ZURhc2hib2FyZD86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOODgOODg+OCt+ODpeODnOODvOODieWQjVxuICAgKiBAZGVmYXVsdCBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tYWdlbnQtY29yZS1vYnNlcnZhYmlsaXR5YFxuICAgKi9cbiAgcmVhZG9ubHkgZGFzaGJvYXJkTmFtZT86IHN0cmluZztcblxuICAvKipcbiAgICog44Kr44K544K/44Og44Oh44OI44Oq44Kv44K55a6a576pXG4gICAqL1xuICByZWFkb25seSBjdXN0b21NZXRyaWNzPzoge1xuICAgIC8qKlxuICAgICAqIOOCqOODvOOCuOOCp+ODs+ODiOWun+ihjOODrOOCpOODhuODs+OCt+OCkui/vei3oVxuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICByZWFkb25seSBleGVjdXRpb25MYXRlbmN5PzogYm9vbGVhbjtcblxuICAgIC8qKlxuICAgICAqIOOCqOODqeODvOeOh+OCkui/vei3oVxuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICByZWFkb25seSBlcnJvclJhdGU/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog44K544Or44O844OX44OD44OI44KS6L+96LehXG4gICAgICogQGRlZmF1bHQgdHJ1ZVxuICAgICAqL1xuICAgIHJlYWRvbmx5IHRocm91Z2hwdXQ/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog44OI44O844Kv44Oz5L2/55So6YeP44KS6L+96LehXG4gICAgICogQGRlZmF1bHQgdHJ1ZVxuICAgICAqL1xuICAgIHJlYWRvbmx5IHRva2VuVXNhZ2U/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog44Kz44K544OI6L+96LehXG4gICAgICogQGRlZmF1bHQgdHJ1ZVxuICAgICAqL1xuICAgIHJlYWRvbmx5IGNvc3RUcmFja2luZz86IGJvb2xlYW47XG4gIH07XG5cbiAgLyoqXG4gICAqIOODoeODiOODquOCr+OCueODleOCo+ODq+OCv+ODvOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgbWV0cmljRmlsdGVycz86IHtcbiAgICAvKipcbiAgICAgKiDjgqjjg6njg7zjg5Hjgr/jg7zjg7Pjg5XjgqPjg6vjgr/jg7xcbiAgICAgKiBAZGVmYXVsdCB0cnVlXG4gICAgICovXG4gICAgcmVhZG9ubHkgZXJyb3JQYXR0ZXJucz86IGJvb2xlYW47XG5cbiAgICAvKipcbiAgICAgKiDorablkYrjg5Hjgr/jg7zjg7Pjg5XjgqPjg6vjgr/jg7xcbiAgICAgKiBAZGVmYXVsdCB0cnVlXG4gICAgICovXG4gICAgcmVhZG9ubHkgd2FybmluZ1BhdHRlcm5zPzogYm9vbGVhbjtcblxuICAgIC8qKlxuICAgICAqIOODkeODleOCqeODvOODnuODs+OCueS9juS4i+ODkeOCv+ODvOODs+ODleOCo+ODq+OCv+ODvFxuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICByZWFkb25seSBwZXJmb3JtYW5jZURlZ3JhZGF0aW9uPzogYm9vbGVhbjtcbiAgfTtcblxuICAvKipcbiAgICog44Ki44Op44O844Og6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBhbGFybXM/OiB7XG4gICAgLyoqXG4gICAgICog44Ko44Op44O8546H44Ki44Op44O844Og6Za+5YCk77yIJe+8iVxuICAgICAqIEBkZWZhdWx0IDVcbiAgICAgKi9cbiAgICByZWFkb25seSBlcnJvclJhdGVUaHJlc2hvbGQ/OiBudW1iZXI7XG5cbiAgICAvKipcbiAgICAgKiDjg6zjgqTjg4bjg7PjgrfjgqLjg6njg7zjg6Dplr7lgKTvvIjjg5/jg6rnp5LvvIlcbiAgICAgKiBAZGVmYXVsdCAzMDAwXG4gICAgICovXG4gICAgcmVhZG9ubHkgbGF0ZW5jeVRocmVzaG9sZD86IG51bWJlcjtcblxuICAgIC8qKlxuICAgICAqIOOCueODq+ODvOODl+ODg+ODiOS9juS4i+OCouODqeODvOODoOmWvuWApFxuICAgICAqIEBkZWZhdWx0IDEwXG4gICAgICovXG4gICAgcmVhZG9ubHkgdGhyb3VnaHB1dFRocmVzaG9sZD86IG51bWJlcjtcblxuICAgIC8qKlxuICAgICAqIOODiOODvOOCr+ODs+S9v+eUqOmHj+OCouODqeODvOODoOmWvuWApFxuICAgICAqIEBkZWZhdWx0IDEwMDAwMFxuICAgICAqL1xuICAgIHJlYWRvbmx5IHRva2VuVXNhZ2VUaHJlc2hvbGQ/OiBudW1iZXI7XG5cbiAgICAvKipcbiAgICAgKiBTTlPjg4jjg5Tjg4Pjgq9BUk7vvIjjgqLjg6njg7zjg4jpgJrnn6XlhYjvvIlcbiAgICAgKi9cbiAgICByZWFkb25seSBzbnNUb3BpY0Fybj86IHN0cmluZztcbiAgfTtcbn1cblxuLyoqXG4gKiDjgqjjg6njg7zov73ot6HoqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBFcnJvclRyYWNraW5nQ29uZmlnIHtcbiAgLyoqXG4gICAqIOOCqOODqeODvOi/vei3oeOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDjg63jgrDkv53mjIHmnJ/plpPvvIjml6XmlbDvvIlcbiAgICogQGRlZmF1bHQgMzBcbiAgICovXG4gIHJlYWRvbmx5IGxvZ1JldGVudGlvbkRheXM/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIOOCqOODqeODvOODkeOCv+ODvOODs+WIhuaekOOCkuacieWKueWMllxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBwYXR0ZXJuQW5hbHlzaXM/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDmoLnmnKzljp/lm6DliIbmnpDvvIhSQ0HvvInjgpLmnInlirnljJZcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgcmVhZG9ubHkgcm9vdENhdXNlQW5hbHlzaXM/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEJlZHJvY2tBZ2VudENvcmVPYnNlcnZhYmlsaXR5Q29uc3RydWN044Gu44OX44Ot44OR44OG44KjXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQmVkcm9ja0FnZW50Q29yZU9ic2VydmFiaWxpdHlDb25zdHJ1Y3RQcm9wcyB7XG4gIC8qKlxuICAgKiBPYnNlcnZhYmlsaXR55qmf6IO944KS5pyJ5Yq55YyW44GZ44KL44GL44Gp44GG44GLXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiDjg5fjg63jgrjjgqfjgq/jg4jlkI1cbiAgICovXG4gIHJlYWRvbmx5IHByb2plY3ROYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOeSsOWig+WQje+8iGRldiwgc3RhZ2luZywgcHJvZOetie+8iVxuICAgKi9cbiAgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IHN0cmluZztcblxuICAvKipcbiAgICogWC1SYXnoqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IHhyYXlDb25maWc/OiBYUmF5Q29uZmlnO1xuXG4gIC8qKlxuICAgKiBDbG91ZFdhdGNo6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBjbG91ZHdhdGNoQ29uZmlnPzogQ2xvdWRXYXRjaENvbmZpZztcblxuICAvKipcbiAgICog44Ko44Op44O86L+96Leh6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBlcnJvclRyYWNraW5nQ29uZmlnPzogRXJyb3JUcmFja2luZ0NvbmZpZztcblxuICAvKipcbiAgICogS01T5pqX5Y+35YyW6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBrbXNDb25maWc/OiB7XG4gICAgLyoqXG4gICAgICogS01T5pqX5Y+35YyW44KS5pyJ5Yq55YyWXG4gICAgICogQGRlZmF1bHQgdHJ1ZVxuICAgICAqL1xuICAgIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG5cbiAgICAvKipcbiAgICAgKiDml6LlrZjjga5LTVPjgq3jg7xBUk7vvIjmjIflrprjgZfjgarjgYTloLTlkIjjga/mlrDopo/kvZzmiJDvvIlcbiAgICAgKi9cbiAgICByZWFkb25seSBrbXNLZXlBcm4/OiBzdHJpbmc7XG4gIH07XG5cbiAgLyoqXG4gICAqIOOCv+OCsFxuICAgKi9cbiAgcmVhZG9ubHkgdGFncz86IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH07XG59XG5cbi8qKlxuICogQW1hem9uIEJlZHJvY2sgQWdlbnRDb3JlIE9ic2VydmFiaWxpdHkgQ29uc3RydWN0XG4gKiBcbiAqIEJlZHJvY2sgQWdlbnTjga7nm6Poppbjg7vjg4jjg6zjg7zjgrfjg7PjgrDjg7vjg4fjg5Djg4PjgrDmqZ/og73jgpLmj5DkvpvjgZnjgotDb25zdHJ1Y3TjgIJcbiAqIFgtUmF557Wx5ZCI44CBQ2xvdWRXYXRjaOe1seWQiOOAgeOCqOODqeODvOi/vei3oeOCkue1seWQiOOBl+OBvuOBmeOAglxuICovXG5leHBvcnQgY2xhc3MgQmVkcm9ja0FnZW50Q29yZU9ic2VydmFiaWxpdHlDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAvKipcbiAgICogS01T5pqX5Y+35YyW44Kt44O8XG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkga21zS2V5Pzoga21zLklLZXk7XG5cbiAgLyoqXG4gICAqIFgtUmF5IEdyb3VwXG4gICAqL1xuICBwdWJsaWMgeHJheUdyb3VwPzogeHJheS5DZm5Hcm91cDtcblxuICAvKipcbiAgICogWC1SYXkgU2FtcGxpbmcgUnVsZVxuICAgKi9cbiAgcHVibGljIHhyYXlTYW1wbGluZ1J1bGU/OiB4cmF5LkNmblNhbXBsaW5nUnVsZTtcblxuICAvKipcbiAgICogQ2xvdWRXYXRjaOODgOODg+OCt+ODpeODnOODvOODiVxuICAgKi9cbiAgcHVibGljIGRhc2hib2FyZD86IGNsb3Vkd2F0Y2guRGFzaGJvYXJkO1xuXG4gIC8qKlxuICAgKiDjg63jgrDjg63jgrDjgrDjg6vjg7zjg5dcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBsb2dHcm91cDogbG9ncy5Mb2dHcm91cDtcblxuICAvKipcbiAgICog44Ko44Op44O8546H44Ki44Op44O844OgXG4gICAqL1xuICBwdWJsaWMgZXJyb3JSYXRlQWxhcm0/OiBjbG91ZHdhdGNoLkFsYXJtO1xuXG4gIC8qKlxuICAgKiDjg6zjgqTjg4bjg7PjgrfjgqLjg6njg7zjg6BcbiAgICovXG4gIHB1YmxpYyBsYXRlbmN5QWxhcm0/OiBjbG91ZHdhdGNoLkFsYXJtO1xuXG4gIC8qKlxuICAgKiDjgrnjg6vjg7zjg5fjg4Pjg4jjgqLjg6njg7zjg6BcbiAgICovXG4gIHB1YmxpYyB0aHJvdWdocHV0QWxhcm0/OiBjbG91ZHdhdGNoLkFsYXJtO1xuXG4gIC8qKlxuICAgKiDjg4jjg7zjgq/jg7Pkvb/nlKjph4/jgqLjg6njg7zjg6BcbiAgICovXG4gIHB1YmxpYyB0b2tlblVzYWdlQWxhcm0/OiBjbG91ZHdhdGNoLkFsYXJtO1xuXG4gIC8qKlxuICAgKiDjg6Hjg4jjg6rjgq/jgrnjg5XjgqPjg6vjgr/jg7zvvIjjgqjjg6njg7zjg5Hjgr/jg7zjg7PvvIlcbiAgICovXG4gIHB1YmxpYyBlcnJvclBhdHRlcm5GaWx0ZXI/OiBsb2dzLk1ldHJpY0ZpbHRlcjtcblxuICAvKipcbiAgICog44Oh44OI44Oq44Kv44K544OV44Kj44Or44K/44O877yI6K2m5ZGK44OR44K/44O844Oz77yJXG4gICAqL1xuICBwdWJsaWMgd2FybmluZ1BhdHRlcm5GaWx0ZXI/OiBsb2dzLk1ldHJpY0ZpbHRlcjtcblxuICAvKipcbiAgICog44Oh44OI44Oq44Kv44K544OV44Kj44Or44K/44O877yI44OR44OV44Kp44O844Oe44Oz44K55L2O5LiL77yJXG4gICAqL1xuICBwdWJsaWMgcGVyZm9ybWFuY2VEZWdyYWRhdGlvbkZpbHRlcj86IGxvZ3MuTWV0cmljRmlsdGVyO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlT2JzZXJ2YWJpbGl0eUNvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIOapn+iDveOBjOeEoeWKueWMluOBleOCjOOBpuOBhOOCi+WgtOWQiOOBr+S9leOCguOBl+OBquOBhFxuICAgIGlmICghcHJvcHMuZW5hYmxlZCkge1xuICAgICAgLy8g44OA44Of44O844Gu44Ot44Kw44Ot44Kw44Kw44Or44O844OX44KS5L2c5oiQ77yI5b+F6aCI44OX44Ot44OR44OG44Kj44Gu44Gf44KB77yJXG4gICAgICB0aGlzLmxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0R1bW15TG9nR3JvdXAnLCB7XG4gICAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvYmVkcm9jay9hZ2VudC1jb3JlLyR7cHJvcHMucHJvamVjdE5hbWV9LyR7cHJvcHMuZW52aXJvbm1lbnR9L29ic2VydmFiaWxpdHktZGlzYWJsZWRgLFxuICAgICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfREFZLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gS01T5pqX5Y+35YyW44Kt44O844Gu5L2c5oiQ44G+44Gf44Gv5Y+C54WnXG4gICAgaWYgKHByb3BzLmttc0NvbmZpZz8uZW5hYmxlZCAhPT0gZmFsc2UpIHtcbiAgICAgIGlmIChwcm9wcy5rbXNDb25maWc/Lmttc0tleUFybikge1xuICAgICAgICB0aGlzLmttc0tleSA9IGttcy5LZXkuZnJvbUtleUFybih0aGlzLCAnS21zS2V5JywgcHJvcHMua21zQ29uZmlnLmttc0tleUFybik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmttc0tleSA9IG5ldyBrbXMuS2V5KHRoaXMsICdLbXNLZXknLCB7XG4gICAgICAgICAgZGVzY3JpcHRpb246IGBLTVMga2V5IGZvciAke3Byb3BzLnByb2plY3ROYW1lfSAke3Byb3BzLmVudmlyb25tZW50fSBBZ2VudENvcmUgT2JzZXJ2YWJpbGl0eWAsXG4gICAgICAgICAgZW5hYmxlS2V5Um90YXRpb246IHRydWUsXG4gICAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDjg63jgrDjg63jgrDjgrDjg6vjg7zjg5fjga7kvZzmiJBcbiAgICBjb25zdCBsb2dSZXRlbnRpb25EYXlzID0gcHJvcHMuZXJyb3JUcmFja2luZ0NvbmZpZz8ubG9nUmV0ZW50aW9uRGF5cyB8fCAzMDtcbiAgICB0aGlzLmxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0xvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9iZWRyb2NrL2FnZW50LWNvcmUvJHtwcm9wcy5wcm9qZWN0TmFtZX0vJHtwcm9wcy5lbnZpcm9ubWVudH0vb2JzZXJ2YWJpbGl0eWAsXG4gICAgICByZXRlbnRpb246IHRoaXMuZ2V0TG9nUmV0ZW50aW9uKGxvZ1JldGVudGlvbkRheXMpLFxuICAgICAgZW5jcnlwdGlvbktleTogdGhpcy5rbXNLZXksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgfSk7XG5cbiAgICAvLyBYLVJheee1seWQiFxuICAgIGlmIChwcm9wcy54cmF5Q29uZmlnPy5lbmFibGVkICE9PSBmYWxzZSkge1xuICAgICAgdGhpcy5jcmVhdGVYUmF5SW50ZWdyYXRpb24ocHJvcHMpO1xuICAgIH1cblxuICAgIC8vIENsb3VkV2F0Y2jntbHlkIhcbiAgICBpZiAocHJvcHMuY2xvdWR3YXRjaENvbmZpZz8uZW5hYmxlZCAhPT0gZmFsc2UpIHtcbiAgICAgIHRoaXMuY3JlYXRlQ2xvdWRXYXRjaEludGVncmF0aW9uKHByb3BzKTtcbiAgICB9XG5cbiAgICAvLyDjgr/jgrDku5jjgZFcbiAgICBpZiAocHJvcHMudGFncykge1xuICAgICAgT2JqZWN0LmVudHJpZXMocHJvcHMudGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChrZXksIHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIOODh+ODleOCqeODq+ODiOOCv+OCsFxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsIHByb3BzLnByb2plY3ROYW1lKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52aXJvbm1lbnQpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29tcG9uZW50JywgJ0FnZW50Q29yZS1PYnNlcnZhYmlsaXR5Jyk7XG4gIH1cblxuICAvKipcbiAgICogWC1SYXnntbHlkIjjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlWFJheUludGVncmF0aW9uKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlT2JzZXJ2YWJpbGl0eUNvbnN0cnVjdFByb3BzKTogdm9pZCB7XG4gICAgY29uc3QgZ3JvdXBOYW1lID0gcHJvcHMueHJheUNvbmZpZz8uZ3JvdXBOYW1lIHx8IFxuICAgICAgYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWFnZW50LWNvcmVgO1xuICAgIGNvbnN0IGZpbHRlckV4cHJlc3Npb24gPSBwcm9wcy54cmF5Q29uZmlnPy5maWx0ZXJFeHByZXNzaW9uIHx8IFxuICAgICAgJ3NlcnZpY2UoXCJhZ2VudC1jb3JlXCIpJztcblxuICAgIC8vIFgtUmF5IEdyb3Vw5L2c5oiQXG4gICAgdGhpcy54cmF5R3JvdXAgPSBuZXcgeHJheS5DZm5Hcm91cCh0aGlzLCAnWFJheUdyb3VwJywge1xuICAgICAgZ3JvdXBOYW1lLFxuICAgICAgZmlsdGVyRXhwcmVzc2lvbixcbiAgICB9KTtcblxuICAgIC8vIOOCq+OCueOCv+ODoOOCteODs+ODl+ODquODs+OCsOODq+ODvOODq+S9nOaIkFxuICAgIGlmIChwcm9wcy54cmF5Q29uZmlnPy5jdXN0b21TYW1wbGluZ1J1bGUgIT09IGZhbHNlKSB7XG4gICAgICB0aGlzLmNyZWF0ZVhSYXlTYW1wbGluZ1J1bGUocHJvcHMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBYLVJheeOCteODs+ODl+ODquODs+OCsOODq+ODvOODq+OCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVYUmF5U2FtcGxpbmdSdWxlKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlT2JzZXJ2YWJpbGl0eUNvbnN0cnVjdFByb3BzKTogdm9pZCB7XG4gICAgY29uc3Qgc2FtcGxpbmdSYXRlID0gcHJvcHMueHJheUNvbmZpZz8uc2FtcGxpbmdSYXRlIHx8IDAuMTtcbiAgICBjb25zdCBwcmlvcml0eSA9IHByb3BzLnhyYXlDb25maWc/LnNhbXBsaW5nUnVsZVByaW9yaXR5IHx8IDEwMDA7XG5cbiAgICB0aGlzLnhyYXlTYW1wbGluZ1J1bGUgPSBuZXcgeHJheS5DZm5TYW1wbGluZ1J1bGUodGhpcywgJ1hSYXlTYW1wbGluZ1J1bGUnLCB7XG4gICAgICBzYW1wbGluZ1J1bGU6IHtcbiAgICAgICAgcnVsZU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1hZ2VudC1jb3JlLXNhbXBsaW5nYCxcbiAgICAgICAgcHJpb3JpdHksXG4gICAgICAgIGZpeGVkUmF0ZTogc2FtcGxpbmdSYXRlLFxuICAgICAgICByZXNlcnZvaXJTaXplOiAxLFxuICAgICAgICBzZXJ2aWNlTmFtZTogJ2FnZW50LWNvcmUnLFxuICAgICAgICBzZXJ2aWNlVHlwZTogJyonLFxuICAgICAgICBob3N0OiAnKicsXG4gICAgICAgIGh0dHBNZXRob2Q6ICcqJyxcbiAgICAgICAgdXJsUGF0aDogJyonLFxuICAgICAgICB2ZXJzaW9uOiAxLFxuICAgICAgICByZXNvdXJjZUFybjogJyonLFxuICAgICAgICBhdHRyaWJ1dGVzOiB7fSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44GrWC1SYXnjg4jjg6zjg7zjgrfjg7PjgrDjgpLmnInlirnljJZcbiAgICogXG4gICAqIEBwYXJhbSBsYW1iZGFGdW5jdGlvbiAtIOODiOODrOODvOOCt+ODs+OCsOOCkuacieWKueWMluOBmeOCi0xhbWJkYemWouaVsFxuICAgKiBAcGFyYW0gZGV0YWlsZWRUcmFjaW5nIC0g6Kmz57Sw44OI44Os44O844K344Oz44Kw44KS5pyJ5Yq55YyW77yI44OH44OV44Kp44Or44OIOiB0cnVl77yJXG4gICAqIEByZXR1cm5zIExhbWJkYemWouaVsO+8iOODgeOCp+ODvOODs+WPr+iDve+8iVxuICAgKi9cbiAgcHVibGljIGVuYWJsZVhSYXlGb3JMYW1iZGEoXG4gICAgbGFtYmRhRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbixcbiAgICBkZXRhaWxlZFRyYWNpbmc6IGJvb2xlYW4gPSB0cnVlXG4gICk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgLy8gWC1SYXnntbHlkIjjgYznhKHlirnjga7loLTlkIjjga/kvZXjgoLjgZfjgarjgYRcbiAgICBpZiAoIXRoaXMueHJheUdyb3VwKSB7XG4gICAgICByZXR1cm4gbGFtYmRhRnVuY3Rpb247XG4gICAgfVxuXG4gICAgLy8gTGFtYmRh6Zai5pWw44GrWC1SYXnmqKnpmZDjgpLku5jkuI5cbiAgICBsYW1iZGFGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICd4cmF5OlB1dFRyYWNlU2VnbWVudHMnLFxuICAgICAgICAgICd4cmF5OlB1dFRlbGVtZXRyeVJlY29yZHMnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8g55Kw5aKD5aSJ5pWw44KS6L+95YqgXG4gICAgbGFtYmRhRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoJ0FXU19YUkFZX1RSQUNJTkdfTkFNRScsICdhZ2VudC1jb3JlJyk7XG4gICAgbGFtYmRhRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoJ0FXU19YUkFZX0NPTlRFWFRfTUlTU0lORycsICdMT0dfRVJST1InKTtcblxuICAgIGlmIChkZXRhaWxlZFRyYWNpbmcpIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uLmFkZEVudmlyb25tZW50KCdBV1NfWFJBWV9ERUJVR19NT0RFJywgJ1RSVUUnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbGFtYmRhRnVuY3Rpb247XG4gIH1cblxuICAvKipcbiAgICog6KSH5pWw44GuTGFtYmRh6Zai5pWw44GrWC1SYXnjg4jjg6zjg7zjgrfjg7PjgrDjgpLkuIDmi6zmnInlirnljJZcbiAgICogXG4gICAqIEBwYXJhbSBsYW1iZGFGdW5jdGlvbnMgLSDjg4jjg6zjg7zjgrfjg7PjgrDjgpLmnInlirnljJbjgZnjgotMYW1iZGHplqLmlbDjga7phY3liJdcbiAgICogQHBhcmFtIGRldGFpbGVkVHJhY2luZyAtIOips+e0sOODiOODrOODvOOCt+ODs+OCsOOCkuacieWKueWMlu+8iOODh+ODleOCqeODq+ODiDogdHJ1Ze+8iVxuICAgKi9cbiAgcHVibGljIGVuYWJsZVhSYXlGb3JMYW1iZGFzKFxuICAgIGxhbWJkYUZ1bmN0aW9uczogbGFtYmRhLkZ1bmN0aW9uW10sXG4gICAgZGV0YWlsZWRUcmFjaW5nOiBib29sZWFuID0gdHJ1ZVxuICApOiB2b2lkIHtcbiAgICBsYW1iZGFGdW5jdGlvbnMuZm9yRWFjaChmbiA9PiB0aGlzLmVuYWJsZVhSYXlGb3JMYW1iZGEoZm4sIGRldGFpbGVkVHJhY2luZykpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCq+OCueOCv+ODoOOCu+OCsOODoeODs+ODiOi/veWKoOeUqOOBrueSsOWig+WkieaVsOOCkuioreWumlxuICAgKiBcbiAgICogTGFtYmRh6Zai5pWw5YaF44Gn44Kr44K544K/44Og44K744Kw44Oh44Oz44OI44KS6L+95Yqg44GZ44KL44Gf44KB44Gu6Kit5a6a44KS6KGM44GE44G+44GZ44CCXG4gICAqIFxuICAgKiBAcGFyYW0gbGFtYmRhRnVuY3Rpb24gLSDoqK3lrprlr77osaHjga5MYW1iZGHplqLmlbBcbiAgICogQHBhcmFtIHNlZ21lbnROYW1lIC0g44Kr44K544K/44Og44K744Kw44Oh44Oz44OI5ZCNXG4gICAqL1xuICBwdWJsaWMgYWRkQ3VzdG9tU2VnbWVudENvbmZpZyhcbiAgICBsYW1iZGFGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uLFxuICAgIHNlZ21lbnROYW1lOiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgbGFtYmRhRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoJ1hSQVlfQ1VTVE9NX1NFR01FTlRfTkFNRScsIHNlZ21lbnROYW1lKTtcbiAgICBsYW1iZGFGdW5jdGlvbi5hZGRFbnZpcm9ubWVudCgnWFJBWV9HUk9VUF9OQU1FJywgdGhpcy54cmF5R3JvdXA/Lmdyb3VwTmFtZSB8fCAnJyk7XG4gIH1cblxuICAvKipcbiAgICogQ2xvdWRXYXRjaOe1seWQiOOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVDbG91ZFdhdGNoSW50ZWdyYXRpb24ocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVPYnNlcnZhYmlsaXR5Q29uc3RydWN0UHJvcHMpOiB2b2lkIHtcbiAgICBjb25zdCBuYW1lc3BhY2UgPSBwcm9wcy5jbG91ZHdhdGNoQ29uZmlnPy5uYW1lc3BhY2UgfHwgJ0FXUy9CZWRyb2NrL0FnZW50Q29yZSc7XG5cbiAgICAvLyDjg6Hjg4jjg6rjgq/jgrnjg5XjgqPjg6vjgr/jg7zkvZzmiJBcbiAgICBpZiAocHJvcHMuY2xvdWR3YXRjaENvbmZpZz8ubWV0cmljRmlsdGVycykge1xuICAgICAgdGhpcy5jcmVhdGVNZXRyaWNGaWx0ZXJzKHByb3BzLCBuYW1lc3BhY2UpO1xuICAgIH1cblxuICAgIC8vIOODgOODg+OCt+ODpeODnOODvOODieS9nOaIkFxuICAgIGlmIChwcm9wcy5jbG91ZHdhdGNoQ29uZmlnPy5jcmVhdGVEYXNoYm9hcmQgIT09IGZhbHNlKSB7XG4gICAgICBjb25zdCBkYXNoYm9hcmROYW1lID0gcHJvcHMuY2xvdWR3YXRjaENvbmZpZz8uZGFzaGJvYXJkTmFtZSB8fCBcbiAgICAgICAgYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWFnZW50LWNvcmUtb2JzZXJ2YWJpbGl0eWA7XG5cbiAgICAgIHRoaXMuZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdEYXNoYm9hcmQnLCB7XG4gICAgICAgIGRhc2hib2FyZE5hbWUsXG4gICAgICB9KTtcblxuICAgICAgLy8g44Oh44OI44Oq44Kv44K544Km44Kj44K444Kn44OD44OI6L+95YqgXG4gICAgICB0aGlzLmFkZERhc2hib2FyZFdpZGdldHMocHJvcHMsIG5hbWVzcGFjZSk7XG4gICAgfVxuXG4gICAgLy8g44Ki44Op44O844Og5L2c5oiQXG4gICAgaWYgKHByb3BzLmNsb3Vkd2F0Y2hDb25maWc/LmFsYXJtcykge1xuICAgICAgdGhpcy5jcmVhdGVBbGFybXMocHJvcHMsIG5hbWVzcGFjZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODoeODiOODquOCr+OCueODleOCo+ODq+OCv+ODvOOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVNZXRyaWNGaWx0ZXJzKFxuICAgIHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlT2JzZXJ2YWJpbGl0eUNvbnN0cnVjdFByb3BzLFxuICAgIG5hbWVzcGFjZTogc3RyaW5nXG4gICk6IHZvaWQge1xuICAgIC8vIOOCqOODqeODvOODkeOCv+ODvOODs+ODleOCo+ODq+OCv+ODvFxuICAgIGlmIChwcm9wcy5jbG91ZHdhdGNoQ29uZmlnPy5tZXRyaWNGaWx0ZXJzPy5lcnJvclBhdHRlcm5zICE9PSBmYWxzZSkge1xuICAgICAgdGhpcy5lcnJvclBhdHRlcm5GaWx0ZXIgPSBuZXcgbG9ncy5NZXRyaWNGaWx0ZXIodGhpcywgJ0Vycm9yUGF0dGVybkZpbHRlcicsIHtcbiAgICAgICAgbG9nR3JvdXA6IHRoaXMubG9nR3JvdXAsXG4gICAgICAgIG1ldHJpY05hbWVzcGFjZTogbmFtZXNwYWNlLFxuICAgICAgICBtZXRyaWNOYW1lOiAnRXJyb3JDb3VudCcsXG4gICAgICAgIGZpbHRlclBhdHRlcm46IGxvZ3MuRmlsdGVyUGF0dGVybi5hbnlUZXJtKCdFUlJPUicsICdFcnJvcicsICdlcnJvcicsICdFeGNlcHRpb24nLCAnZXhjZXB0aW9uJyksXG4gICAgICAgIG1ldHJpY1ZhbHVlOiAnMScsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogMCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIOitpuWRiuODkeOCv+ODvOODs+ODleOCo+ODq+OCv+ODvFxuICAgIGlmIChwcm9wcy5jbG91ZHdhdGNoQ29uZmlnPy5tZXRyaWNGaWx0ZXJzPy53YXJuaW5nUGF0dGVybnMgIT09IGZhbHNlKSB7XG4gICAgICB0aGlzLndhcm5pbmdQYXR0ZXJuRmlsdGVyID0gbmV3IGxvZ3MuTWV0cmljRmlsdGVyKHRoaXMsICdXYXJuaW5nUGF0dGVybkZpbHRlcicsIHtcbiAgICAgICAgbG9nR3JvdXA6IHRoaXMubG9nR3JvdXAsXG4gICAgICAgIG1ldHJpY05hbWVzcGFjZTogbmFtZXNwYWNlLFxuICAgICAgICBtZXRyaWNOYW1lOiAnV2FybmluZ0NvdW50JyxcbiAgICAgICAgZmlsdGVyUGF0dGVybjogbG9ncy5GaWx0ZXJQYXR0ZXJuLmFueVRlcm0oJ1dBUk4nLCAnV2FybmluZycsICd3YXJuaW5nJyksXG4gICAgICAgIG1ldHJpY1ZhbHVlOiAnMScsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogMCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIOODkeODleOCqeODvOODnuODs+OCueS9juS4i+ODkeOCv+ODvOODs+ODleOCo+ODq+OCv+ODvFxuICAgIGlmIChwcm9wcy5jbG91ZHdhdGNoQ29uZmlnPy5tZXRyaWNGaWx0ZXJzPy5wZXJmb3JtYW5jZURlZ3JhZGF0aW9uICE9PSBmYWxzZSkge1xuICAgICAgdGhpcy5wZXJmb3JtYW5jZURlZ3JhZGF0aW9uRmlsdGVyID0gbmV3IGxvZ3MuTWV0cmljRmlsdGVyKHRoaXMsICdQZXJmb3JtYW5jZURlZ3JhZGF0aW9uRmlsdGVyJywge1xuICAgICAgICBsb2dHcm91cDogdGhpcy5sb2dHcm91cCxcbiAgICAgICAgbWV0cmljTmFtZXNwYWNlOiBuYW1lc3BhY2UsXG4gICAgICAgIG1ldHJpY05hbWU6ICdTbG93RXhlY3V0aW9uQ291bnQnLFxuICAgICAgICBmaWx0ZXJQYXR0ZXJuOiBsb2dzLkZpbHRlclBhdHRlcm4uYW55VGVybSgnc2xvdycsICd0aW1lb3V0JywgJ2RlZ3JhZGVkJywgJ3Rocm90dGxlZCcpLFxuICAgICAgICBtZXRyaWNWYWx1ZTogJzEnLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IDAsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OA44OD44K344Ol44Oc44O844OJ44Km44Kj44K444Kn44OD44OI44KS6L+95YqgXG4gICAqL1xuICBwcml2YXRlIGFkZERhc2hib2FyZFdpZGdldHMoXG4gICAgcHJvcHM6IEJlZHJvY2tBZ2VudENvcmVPYnNlcnZhYmlsaXR5Q29uc3RydWN0UHJvcHMsXG4gICAgbmFtZXNwYWNlOiBzdHJpbmdcbiAgKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmRhc2hib2FyZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgY3VzdG9tTWV0cmljcyA9IHByb3BzLmNsb3Vkd2F0Y2hDb25maWc/LmN1c3RvbU1ldHJpY3M7XG5cbiAgICAvLyDjgqjjg6njg7znjofjgqbjgqPjgrjjgqfjg4Pjg4hcbiAgICBpZiAoY3VzdG9tTWV0cmljcz8uZXJyb3JSYXRlICE9PSBmYWxzZSkge1xuICAgICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgIHRpdGxlOiAnRXJyb3IgUmF0ZScsXG4gICAgICAgICAgbGVmdDogW1xuICAgICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICAgICAgICBtZXRyaWNOYW1lOiAnRXJyb3JSYXRlJyxcbiAgICAgICAgICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ0Vycm9yQ291bnQnLFxuICAgICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIOODrOOCpOODhuODs+OCt+OCpuOCo+OCuOOCp+ODg+ODiFxuICAgIGlmIChjdXN0b21NZXRyaWNzPy5leGVjdXRpb25MYXRlbmN5ICE9PSBmYWxzZSkge1xuICAgICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgIHRpdGxlOiAnRXhlY3V0aW9uIExhdGVuY3knLFxuICAgICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ0xhdGVuY3knLFxuICAgICAgICAgICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgICAgbGFiZWw6ICdBdmVyYWdlJyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICAgICAgICBtZXRyaWNOYW1lOiAnTGF0ZW5jeScsXG4gICAgICAgICAgICAgIHN0YXRpc3RpYzogJ3A5OScsXG4gICAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICAgIGxhYmVsOiAnUDk5JyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyDjgrnjg6vjg7zjg5fjg4Pjg4jjgqbjgqPjgrjjgqfjg4Pjg4hcbiAgICBpZiAoY3VzdG9tTWV0cmljcz8udGhyb3VnaHB1dCAhPT0gZmFsc2UpIHtcbiAgICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogJ1Rocm91Z2hwdXQnLFxuICAgICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ1Rocm91Z2hwdXQnLFxuICAgICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIOODiOODvOOCr+ODs+S9v+eUqOmHj+OCpuOCo+OCuOOCp+ODg+ODiFxuICAgIGlmIChjdXN0b21NZXRyaWNzPy50b2tlblVzYWdlICE9PSBmYWxzZSkge1xuICAgICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICAgIHRpdGxlOiAnVG9rZW4gVXNhZ2UnLFxuICAgICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICAgICAgbWV0cmljTmFtZTogJ0lucHV0VG9rZW5zJyxcbiAgICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgICAgbGFiZWw6ICdJbnB1dCBUb2tlbnMnLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgICAgICAgIG1ldHJpY05hbWU6ICdPdXRwdXRUb2tlbnMnLFxuICAgICAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgICBsYWJlbDogJ091dHB1dCBUb2tlbnMnLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIOOCs+OCueODiOi/vei3oeOCpuOCo+OCuOOCp+ODg+ODiFxuICAgIGlmIChjdXN0b21NZXRyaWNzPy5jb3N0VHJhY2tpbmcgIT09IGZhbHNlKSB7XG4gICAgICB0aGlzLmRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgICAgdGl0bGU6ICdFc3RpbWF0ZWQgQ29zdCcsXG4gICAgICAgICAgbGVmdDogW1xuICAgICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICAgICAgICBtZXRyaWNOYW1lOiAnRXN0aW1hdGVkQ29zdCcsXG4gICAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFgtUmF544OI44Os44O844K544Km44Kj44K444Kn44OD44OIXG4gICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdYLVJheSBUcmFjZXMnLFxuICAgICAgICBsZWZ0OiBbXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9YUmF5JyxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdUcmFjZUNvdW50JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyDorablkYrjg7vjg5Hjg5Xjgqnjg7zjg57jg7PjgrnkvY7kuIvjgqbjgqPjgrjjgqfjg4Pjg4hcbiAgICB0aGlzLmRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1dhcm5pbmdzICYgUGVyZm9ybWFuY2UgSXNzdWVzJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnV2FybmluZ0NvdW50JyxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICAgICAgbGFiZWw6ICdXYXJuaW5ncycsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdTbG93RXhlY3V0aW9uQ291bnQnLFxuICAgICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgICBsYWJlbDogJ1Nsb3cgRXhlY3V0aW9ucycsXG4gICAgICAgICAgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqLjg6njg7zjg6DjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQWxhcm1zKFxuICAgIHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlT2JzZXJ2YWJpbGl0eUNvbnN0cnVjdFByb3BzLFxuICAgIG5hbWVzcGFjZTogc3RyaW5nXG4gICk6IHZvaWQge1xuICAgIGNvbnN0IGFsYXJtQ29uZmlnID0gcHJvcHMuY2xvdWR3YXRjaENvbmZpZz8uYWxhcm1zO1xuICAgIGlmICghYWxhcm1Db25maWcpIHJldHVybjtcblxuICAgIC8vIOOCqOODqeODvOeOh+OCouODqeODvOODoFxuICAgIGNvbnN0IGVycm9yUmF0ZVRocmVzaG9sZCA9IGFsYXJtQ29uZmlnLmVycm9yUmF0ZVRocmVzaG9sZCB8fCA1O1xuICAgIHRoaXMuZXJyb3JSYXRlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnRXJyb3JSYXRlQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1hZ2VudC1jb3JlLWVycm9yLXJhdGVgLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogYEVycm9yIHJhdGUgZXhjZWVkZWQgJHtlcnJvclJhdGVUaHJlc2hvbGR9JWAsXG4gICAgICBtZXRyaWM6IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZSxcbiAgICAgICAgbWV0cmljTmFtZTogJ0Vycm9yUmF0ZScsXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IGVycm9yUmF0ZVRocmVzaG9sZCxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgIH0pO1xuXG4gICAgLy8g44Os44Kk44OG44Oz44K344Ki44Op44O844OgXG4gICAgY29uc3QgbGF0ZW5jeVRocmVzaG9sZCA9IGFsYXJtQ29uZmlnLmxhdGVuY3lUaHJlc2hvbGQgfHwgMzAwMDtcbiAgICB0aGlzLmxhdGVuY3lBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdMYXRlbmN5QWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1hZ2VudC1jb3JlLWxhdGVuY3lgLFxuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogYExhdGVuY3kgZXhjZWVkZWQgJHtsYXRlbmN5VGhyZXNob2xkfW1zYCxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlLFxuICAgICAgICBtZXRyaWNOYW1lOiAnTGF0ZW5jeScsXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IGxhdGVuY3lUaHJlc2hvbGQsXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICB9KTtcblxuICAgIC8vIOOCueODq+ODvOODl+ODg+ODiOOCouODqeODvOODoFxuICAgIGlmIChhbGFybUNvbmZpZy50aHJvdWdocHV0VGhyZXNob2xkKSB7XG4gICAgICB0aGlzLnRocm91Z2hwdXRBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdUaHJvdWdocHV0QWxhcm0nLCB7XG4gICAgICAgIGFsYXJtTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWFnZW50LWNvcmUtdGhyb3VnaHB1dGAsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246IGBUaHJvdWdocHV0IGRyb3BwZWQgYmVsb3cgJHthbGFybUNvbmZpZy50aHJvdWdocHV0VGhyZXNob2xkfWAsXG4gICAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ1Rocm91Z2hwdXQnLFxuICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSksXG4gICAgICAgIHRocmVzaG9sZDogYWxhcm1Db25maWcudGhyb3VnaHB1dFRocmVzaG9sZCxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuTEVTU19USEFOX1RIUkVTSE9MRCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIOODiOODvOOCr+ODs+S9v+eUqOmHj+OCouODqeODvOODoFxuICAgIGlmIChhbGFybUNvbmZpZy50b2tlblVzYWdlVGhyZXNob2xkKSB7XG4gICAgICB0aGlzLnRva2VuVXNhZ2VBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdUb2tlblVzYWdlQWxhcm0nLCB7XG4gICAgICAgIGFsYXJtTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWFnZW50LWNvcmUtdG9rZW4tdXNhZ2VgLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBgVG9rZW4gdXNhZ2UgZXhjZWVkZWQgJHthbGFybUNvbmZpZy50b2tlblVzYWdlVGhyZXNob2xkfWAsXG4gICAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2UsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ1RvdGFsVG9rZW5zJyxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgICB9KSxcbiAgICAgICAgdGhyZXNob2xkOiBhbGFybUNvbmZpZy50b2tlblVzYWdlVGhyZXNob2xkLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gU05T6YCa55+l6Kit5a6aXG4gICAgaWYgKGFsYXJtQ29uZmlnLnNuc1RvcGljQXJuKSB7XG4gICAgICBjb25zdCBzbnNUb3BpYyA9IHNucy5Ub3BpYy5mcm9tVG9waWNBcm4odGhpcywgJ1Nuc1RvcGljJywgYWxhcm1Db25maWcuc25zVG9waWNBcm4pO1xuICAgICAgdGhpcy5lcnJvclJhdGVBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbihzbnNUb3BpYykpO1xuICAgICAgdGhpcy5sYXRlbmN5QWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24oc25zVG9waWMpKTtcbiAgICAgIFxuICAgICAgaWYgKHRoaXMudGhyb3VnaHB1dEFsYXJtKSB7XG4gICAgICAgIHRoaXMudGhyb3VnaHB1dEFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHNuc1RvcGljKSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmICh0aGlzLnRva2VuVXNhZ2VBbGFybSkge1xuICAgICAgICB0aGlzLnRva2VuVXNhZ2VBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbihzbnNUb3BpYykpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg63jgrDkv53mjIHmnJ/plpPjgpLlj5blvpdcbiAgICovXG4gIHByaXZhdGUgZ2V0TG9nUmV0ZW50aW9uKGRheXM6IG51bWJlcik6IGxvZ3MuUmV0ZW50aW9uRGF5cyB7XG4gICAgY29uc3QgcmV0ZW50aW9uTWFwOiB7IFtrZXk6IG51bWJlcl06IGxvZ3MuUmV0ZW50aW9uRGF5cyB9ID0ge1xuICAgICAgMTogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9EQVksXG4gICAgICAzOiBsb2dzLlJldGVudGlvbkRheXMuVEhSRUVfREFZUyxcbiAgICAgIDU6IGxvZ3MuUmV0ZW50aW9uRGF5cy5GSVZFX0RBWVMsXG4gICAgICA3OiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICAxNDogbG9ncy5SZXRlbnRpb25EYXlzLlRXT19XRUVLUyxcbiAgICAgIDMwOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgNjA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5UV09fTU9OVEhTLFxuICAgICAgOTA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5USFJFRV9NT05USFMsXG4gICAgICAxMjA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5GT1VSX01PTlRIUyxcbiAgICAgIDE1MDogbG9ncy5SZXRlbnRpb25EYXlzLkZJVkVfTU9OVEhTLFxuICAgICAgMTgwOiBsb2dzLlJldGVudGlvbkRheXMuU0lYX01PTlRIUyxcbiAgICAgIDM2NTogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9ZRUFSLFxuICAgICAgNDAwOiBsb2dzLlJldGVudGlvbkRheXMuVEhJUlRFRU5fTU9OVEhTLFxuICAgICAgNTQ1OiBsb2dzLlJldGVudGlvbkRheXMuRUlHSFRFRU5fTU9OVEhTLFxuICAgICAgNzMxOiBsb2dzLlJldGVudGlvbkRheXMuVFdPX1lFQVJTLFxuICAgICAgMTgyNzogbG9ncy5SZXRlbnRpb25EYXlzLkZJVkVfWUVBUlMsXG4gICAgICAzNjUzOiBsb2dzLlJldGVudGlvbkRheXMuVEVOX1lFQVJTLFxuICAgIH07XG5cbiAgICByZXR1cm4gcmV0ZW50aW9uTWFwW2RheXNdIHx8IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEg7XG4gIH1cblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44Gr44Kr44K544K/44Og44Oh44OI44Oq44Kv44K56YCB5L+h44Gu55Kw5aKD5aSJ5pWw44KS6Kit5a6aXG4gICAqIFxuICAgKiBAcGFyYW0gbGFtYmRhRnVuY3Rpb24gLSDoqK3lrprlr77osaHjga5MYW1iZGHplqLmlbBcbiAgICogQHBhcmFtIG5hbWVzcGFjZSAtIENsb3VkV2F0Y2jjg6Hjg4jjg6rjgq/jgrnjga7lkI3liY3nqbrplpNcbiAgICovXG4gIHB1YmxpYyBhZGRNZXRyaWNzQ29uZmlnKFxuICAgIGxhbWJkYUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24sXG4gICAgbmFtZXNwYWNlPzogc3RyaW5nXG4gICk6IHZvaWQge1xuICAgIGNvbnN0IG1ldHJpY3NOYW1lc3BhY2UgPSBuYW1lc3BhY2UgfHwgJ0FXUy9CZWRyb2NrL0FnZW50Q29yZSc7XG4gICAgbGFtYmRhRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoJ0NMT1VEV0FUQ0hfTUVUUklDU19OQU1FU1BBQ0UnLCBtZXRyaWNzTmFtZXNwYWNlKTtcbiAgICBsYW1iZGFGdW5jdGlvbi5hZGRFbnZpcm9ubWVudCgnTUVUUklDU19FTkFCTEVEJywgJ3RydWUnKTtcbiAgICBcbiAgICAvLyBDbG91ZFdhdGNo5qip6ZmQ44KS5LuY5LiOXG4gICAgbGFtYmRhRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFsnY2xvdWR3YXRjaDpQdXRNZXRyaWNEYXRhJ10sXG4gICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44Gr44Ot44Kw6ZuG57SE44Gu55Kw5aKD5aSJ5pWw44KS6Kit5a6aXG4gICAqIFxuICAgKiBAcGFyYW0gbGFtYmRhRnVuY3Rpb24gLSDoqK3lrprlr77osaHjga5MYW1iZGHplqLmlbBcbiAgICovXG4gIHB1YmxpYyBhZGRMb2dnaW5nQ29uZmlnKGxhbWJkYUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24pOiB2b2lkIHtcbiAgICBsYW1iZGFGdW5jdGlvbi5hZGRFbnZpcm9ubWVudCgnTE9HX0dST1VQX05BTUUnLCB0aGlzLmxvZ0dyb3VwLmxvZ0dyb3VwTmFtZSk7XG4gICAgbGFtYmRhRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoJ0xPR19MRVZFTCcsICdJTkZPJyk7XG4gICAgXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2dz5qip6ZmQ44KS5LuY5LiOXG4gICAgdGhpcy5sb2dHcm91cC5ncmFudFdyaXRlKGxhbWJkYUZ1bmN0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDopIfmlbDjga5MYW1iZGHplqLmlbDjgavnm6PoppboqK3lrprjgpLkuIDmi6zpgannlKhcbiAgICogXG4gICAqIEBwYXJhbSBsYW1iZGFGdW5jdGlvbnMgLSDoqK3lrprlr77osaHjga5MYW1iZGHplqLmlbDjga7phY3liJdcbiAgICogQHBhcmFtIG9wdGlvbnMgLSDoqK3lrprjgqrjg5fjgrfjg6fjg7NcbiAgICovXG4gIHB1YmxpYyBjb25maWd1cmVPYnNlcnZhYmlsaXR5Rm9yTGFtYmRhcyhcbiAgICBsYW1iZGFGdW5jdGlvbnM6IGxhbWJkYS5GdW5jdGlvbltdLFxuICAgIG9wdGlvbnM/OiB7XG4gICAgICBlbmFibGVYUmF5PzogYm9vbGVhbjtcbiAgICAgIGVuYWJsZU1ldHJpY3M/OiBib29sZWFuO1xuICAgICAgZW5hYmxlTG9nZ2luZz86IGJvb2xlYW47XG4gICAgICBuYW1lc3BhY2U/OiBzdHJpbmc7XG4gICAgfVxuICApOiB2b2lkIHtcbiAgICBjb25zdCBvcHRzID0ge1xuICAgICAgZW5hYmxlWFJheTogdHJ1ZSxcbiAgICAgIGVuYWJsZU1ldHJpY3M6IHRydWUsXG4gICAgICBlbmFibGVMb2dnaW5nOiB0cnVlLFxuICAgICAgLi4ub3B0aW9ucyxcbiAgICB9O1xuXG4gICAgbGFtYmRhRnVuY3Rpb25zLmZvckVhY2goZm4gPT4ge1xuICAgICAgaWYgKG9wdHMuZW5hYmxlWFJheSkge1xuICAgICAgICB0aGlzLmVuYWJsZVhSYXlGb3JMYW1iZGEoZm4pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAob3B0cy5lbmFibGVNZXRyaWNzKSB7XG4gICAgICAgIHRoaXMuYWRkTWV0cmljc0NvbmZpZyhmbiwgb3B0cy5uYW1lc3BhY2UpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAob3B0cy5lbmFibGVMb2dnaW5nKSB7XG4gICAgICAgIHRoaXMuYWRkTG9nZ2luZ0NvbmZpZyhmbik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw44Gr44Ko44Op44O86L+96Leh6Kit5a6a44KS6L+95YqgXG4gICAqIFxuICAgKiBAcGFyYW0gbGFtYmRhRnVuY3Rpb24gLSDoqK3lrprlr77osaHjga5MYW1iZGHplqLmlbBcbiAgICovXG4gIHB1YmxpYyBhZGRFcnJvclRyYWNraW5nQ29uZmlnKGxhbWJkYUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24pOiB2b2lkIHtcbiAgICAvLyDjgqjjg6njg7zov73ot6HnkrDlooPlpInmlbDjgpLoqK3lrppcbiAgICBsYW1iZGFGdW5jdGlvbi5hZGRFbnZpcm9ubWVudCgnRVJST1JfVFJBQ0tJTkdfRU5BQkxFRCcsICd0cnVlJyk7XG4gICAgbGFtYmRhRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoJ0VSUk9SX1BBVFRFUk5fQU5BTFlTSVMnLCAndHJ1ZScpO1xuICAgIGxhbWJkYUZ1bmN0aW9uLmFkZEVudmlyb25tZW50KCdSQ0FfRU5BQkxFRCcsICd0cnVlJyk7XG4gICAgXG4gICAgLy8g44Ot44Kw44Ot44Kw44Kw44Or44O844OX5ZCN44KS6Kit5a6aXG4gICAgbGFtYmRhRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoJ0VSUk9SX0xPR19HUk9VUCcsIHRoaXMubG9nR3JvdXAubG9nR3JvdXBOYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqjjg6njg7zpgJrnn6XnlKjjga5TTlPjg4jjg5Tjg4Pjgq/jgpLoqK3lrppcbiAgICogXG4gICAqIEBwYXJhbSBzbnNUb3BpY0FybiAtIFNOU+ODiOODlOODg+OCr0FSTlxuICAgKiBAcmV0dXJucyBTTlPjg4jjg5Tjg4Pjgq9cbiAgICovXG4gIHB1YmxpYyBjb25maWd1cmVFcnJvck5vdGlmaWNhdGlvbnMoc25zVG9waWNBcm46IHN0cmluZyk6IHNucy5JVG9waWMge1xuICAgIGNvbnN0IHNuc1RvcGljID0gc25zLlRvcGljLmZyb21Ub3BpY0Fybih0aGlzLCAnRXJyb3JOb3RpZmljYXRpb25Ub3BpYycsIHNuc1RvcGljQXJuKTtcbiAgICBcbiAgICAvLyDlhajjgabjga7jgqLjg6njg7zjg6DjgatTTlPpgJrnn6XjgpLov73liqBcbiAgICBpZiAodGhpcy5lcnJvclJhdGVBbGFybSkge1xuICAgICAgdGhpcy5lcnJvclJhdGVBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbihzbnNUb3BpYykpO1xuICAgIH1cbiAgICBcbiAgICBpZiAodGhpcy5sYXRlbmN5QWxhcm0pIHtcbiAgICAgIHRoaXMubGF0ZW5jeUFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKHNuc1RvcGljKSk7XG4gICAgfVxuICAgIFxuICAgIGlmICh0aGlzLnRocm91Z2hwdXRBbGFybSkge1xuICAgICAgdGhpcy50aHJvdWdocHV0QWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24oc25zVG9waWMpKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKHRoaXMudG9rZW5Vc2FnZUFsYXJtKSB7XG4gICAgICB0aGlzLnRva2VuVXNhZ2VBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbihzbnNUb3BpYykpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc25zVG9waWM7XG4gIH1cblxuICAvKipcbiAgICog44Ko44Op44O86L+96Leh55So44Gu44Oh44OI44Oq44Kv44K544OV44Kj44Or44K/44O844KS5Y+W5b6XXG4gICAqIFxuICAgKiBAcmV0dXJucyDjgqjjg6njg7zov73ot6HnlKjjga7jg6Hjg4jjg6rjgq/jgrnjg5XjgqPjg6vjgr/jg7zjga7phY3liJdcbiAgICovXG4gIHB1YmxpYyBnZXRFcnJvclRyYWNraW5nRmlsdGVycygpOiBsb2dzLk1ldHJpY0ZpbHRlcltdIHtcbiAgICBjb25zdCBmaWx0ZXJzOiBsb2dzLk1ldHJpY0ZpbHRlcltdID0gW107XG4gICAgXG4gICAgaWYgKHRoaXMuZXJyb3JQYXR0ZXJuRmlsdGVyKSB7XG4gICAgICBmaWx0ZXJzLnB1c2godGhpcy5lcnJvclBhdHRlcm5GaWx0ZXIpO1xuICAgIH1cbiAgICBcbiAgICBpZiAodGhpcy53YXJuaW5nUGF0dGVybkZpbHRlcikge1xuICAgICAgZmlsdGVycy5wdXNoKHRoaXMud2FybmluZ1BhdHRlcm5GaWx0ZXIpO1xuICAgIH1cbiAgICBcbiAgICBpZiAodGhpcy5wZXJmb3JtYW5jZURlZ3JhZGF0aW9uRmlsdGVyKSB7XG4gICAgICBmaWx0ZXJzLnB1c2godGhpcy5wZXJmb3JtYW5jZURlZ3JhZGF0aW9uRmlsdGVyKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGZpbHRlcnM7XG4gIH1cbn1cbiJdfQ==