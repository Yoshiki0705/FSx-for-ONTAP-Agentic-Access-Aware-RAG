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

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as xray from 'aws-cdk-lib/aws-xray';
import { Construct } from 'constructs';

/**
 * X-Ray設定
 */
export interface XRayConfig {
  /**
   * X-Ray統合を有効化
   * @default true
   */
  readonly enabled: boolean;

  /**
   * サンプリングレート（0.0-1.0）
   * @default 0.1
   */
  readonly samplingRate?: number;

  /**
   * X-Ray Group名
   * @default `${projectName}-${environment}-agent-core`
   */
  readonly groupName?: string;

  /**
   * フィルター式
   * @default 'service("agent-core")'
   */
  readonly filterExpression?: string;

  /**
   * 詳細トレーシングを有効化
   * @default true
   */
  readonly detailedTracing?: boolean;

  /**
   * カスタムサンプリングルールを有効化
   * @default true
   */
  readonly customSamplingRule?: boolean;

  /**
   * サンプリングルール優先度
   * @default 1000
   */
  readonly samplingRulePriority?: number;
}

/**
 * CloudWatch設定
 */
export interface CloudWatchConfig {
  /**
   * CloudWatch統合を有効化
   * @default true
   */
  readonly enabled: boolean;

  /**
   * カスタムメトリクスの名前空間
   * @default 'AWS/Bedrock/AgentCore'
   */
  readonly namespace?: string;

  /**
   * ダッシュボード自動生成
   * @default true
   */
  readonly createDashboard?: boolean;

  /**
   * ダッシュボード名
   * @default `${projectName}-${environment}-agent-core-observability`
   */
  readonly dashboardName?: string;

  /**
   * カスタムメトリクス定義
   */
  readonly customMetrics?: {
    /**
     * エージェント実行レイテンシを追跡
     * @default true
     */
    readonly executionLatency?: boolean;

    /**
     * エラー率を追跡
     * @default true
     */
    readonly errorRate?: boolean;

    /**
     * スループットを追跡
     * @default true
     */
    readonly throughput?: boolean;

    /**
     * トークン使用量を追跡
     * @default true
     */
    readonly tokenUsage?: boolean;

    /**
     * コスト追跡
     * @default true
     */
    readonly costTracking?: boolean;
  };

  /**
   * メトリクスフィルター設定
   */
  readonly metricFilters?: {
    /**
     * エラーパターンフィルター
     * @default true
     */
    readonly errorPatterns?: boolean;

    /**
     * 警告パターンフィルター
     * @default true
     */
    readonly warningPatterns?: boolean;

    /**
     * パフォーマンス低下パターンフィルター
     * @default true
     */
    readonly performanceDegradation?: boolean;
  };

  /**
   * アラーム設定
   */
  readonly alarms?: {
    /**
     * エラー率アラーム閾値（%）
     * @default 5
     */
    readonly errorRateThreshold?: number;

    /**
     * レイテンシアラーム閾値（ミリ秒）
     * @default 3000
     */
    readonly latencyThreshold?: number;

    /**
     * スループット低下アラーム閾値
     * @default 10
     */
    readonly throughputThreshold?: number;

    /**
     * トークン使用量アラーム閾値
     * @default 100000
     */
    readonly tokenUsageThreshold?: number;

    /**
     * SNSトピックARN（アラート通知先）
     */
    readonly snsTopicArn?: string;
  };
}

/**
 * エラー追跡設定
 */
export interface ErrorTrackingConfig {
  /**
   * エラー追跡を有効化
   * @default true
   */
  readonly enabled: boolean;

  /**
   * ログ保持期間（日数）
   * @default 30
   */
  readonly logRetentionDays?: number;

  /**
   * エラーパターン分析を有効化
   * @default true
   */
  readonly patternAnalysis?: boolean;

  /**
   * 根本原因分析（RCA）を有効化
   * @default true
   */
  readonly rootCauseAnalysis?: boolean;
}

/**
 * BedrockAgentCoreObservabilityConstructのプロパティ
 */
export interface BedrockAgentCoreObservabilityConstructProps {
  /**
   * Observability機能を有効化するかどうか
   * @default false
   */
  readonly enabled: boolean;

  /**
   * プロジェクト名
   */
  readonly projectName: string;

  /**
   * 環境名（dev, staging, prod等）
   */
  readonly environment: string;

  /**
   * X-Ray設定
   */
  readonly xrayConfig?: XRayConfig;

  /**
   * CloudWatch設定
   */
  readonly cloudwatchConfig?: CloudWatchConfig;

  /**
   * エラー追跡設定
   */
  readonly errorTrackingConfig?: ErrorTrackingConfig;

  /**
   * KMS暗号化設定
   */
  readonly kmsConfig?: {
    /**
     * KMS暗号化を有効化
     * @default true
     */
    readonly enabled: boolean;

    /**
     * 既存のKMSキーARN（指定しない場合は新規作成）
     */
    readonly kmsKeyArn?: string;
  };

  /**
   * タグ
   */
  readonly tags?: { [key: string]: string };
}

/**
 * Amazon Bedrock AgentCore Observability Construct
 * 
 * Bedrock Agentの監視・トレーシング・デバッグ機能を提供するConstruct。
 * X-Ray統合、CloudWatch統合、エラー追跡を統合します。
 */
export class BedrockAgentCoreObservabilityConstruct extends Construct {
  /**
   * KMS暗号化キー
   */
  public readonly kmsKey?: kms.IKey;

  /**
   * X-Ray Group
   */
  public xrayGroup?: xray.CfnGroup;

  /**
   * X-Ray Sampling Rule
   */
  public xraySamplingRule?: xray.CfnSamplingRule;

  /**
   * CloudWatchダッシュボード
   */
  public dashboard?: cloudwatch.Dashboard;

  /**
   * ログロググループ
   */
  public readonly logGroup: logs.LogGroup;

  /**
   * エラー率アラーム
   */
  public errorRateAlarm?: cloudwatch.Alarm;

  /**
   * レイテンシアラーム
   */
  public latencyAlarm?: cloudwatch.Alarm;

  /**
   * スループットアラーム
   */
  public throughputAlarm?: cloudwatch.Alarm;

  /**
   * トークン使用量アラーム
   */
  public tokenUsageAlarm?: cloudwatch.Alarm;

  /**
   * メトリクスフィルター（エラーパターン）
   */
  public errorPatternFilter?: logs.MetricFilter;

  /**
   * メトリクスフィルター（警告パターン）
   */
  public warningPatternFilter?: logs.MetricFilter;

  /**
   * メトリクスフィルター（パフォーマンス低下）
   */
  public performanceDegradationFilter?: logs.MetricFilter;

  constructor(scope: Construct, id: string, props: BedrockAgentCoreObservabilityConstructProps) {
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
      } else {
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
  private createXRayIntegration(props: BedrockAgentCoreObservabilityConstructProps): void {
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
  private createXRaySamplingRule(props: BedrockAgentCoreObservabilityConstructProps): void {
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
  public enableXRayForLambda(
    lambdaFunction: lambda.Function,
    detailedTracing: boolean = true
  ): lambda.Function {
    // X-Ray統合が無効の場合は何もしない
    if (!this.xrayGroup) {
      return lambdaFunction;
    }

    // Lambda関数にX-Ray権限を付与
    lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
        ],
        resources: ['*'],
      })
    );

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
  public enableXRayForLambdas(
    lambdaFunctions: lambda.Function[],
    detailedTracing: boolean = true
  ): void {
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
  public addCustomSegmentConfig(
    lambdaFunction: lambda.Function,
    segmentName: string
  ): void {
    lambdaFunction.addEnvironment('XRAY_CUSTOM_SEGMENT_NAME', segmentName);
    lambdaFunction.addEnvironment('XRAY_GROUP_NAME', this.xrayGroup?.groupName || '');
  }

  /**
   * CloudWatch統合を作成
   */
  private createCloudWatchIntegration(props: BedrockAgentCoreObservabilityConstructProps): void {
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
  private createMetricFilters(
    props: BedrockAgentCoreObservabilityConstructProps,
    namespace: string
  ): void {
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
  private addDashboardWidgets(
    props: BedrockAgentCoreObservabilityConstructProps,
    namespace: string
  ): void {
    if (!this.dashboard) return;

    const customMetrics = props.cloudwatchConfig?.customMetrics;

    // エラー率ウィジェット
    if (customMetrics?.errorRate !== false) {
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
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
        })
      );
    }

    // レイテンシウィジェット
    if (customMetrics?.executionLatency !== false) {
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
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
        })
      );
    }

    // スループットウィジェット
    if (customMetrics?.throughput !== false) {
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
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
        })
      );
    }

    // トークン使用量ウィジェット
    if (customMetrics?.tokenUsage !== false) {
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
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
        })
      );
    }

    // コスト追跡ウィジェット
    if (customMetrics?.costTracking !== false) {
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
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
        })
      );
    }

    // X-Rayトレースウィジェット
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      })
    );

    // 警告・パフォーマンス低下ウィジェット
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      })
    );
  }

  /**
   * アラームを作成
   */
  private createAlarms(
    props: BedrockAgentCoreObservabilityConstructProps,
    namespace: string
  ): void {
    const alarmConfig = props.cloudwatchConfig?.alarms;
    if (!alarmConfig) return;

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
  private getLogRetention(days: number): logs.RetentionDays {
    const retentionMap: { [key: number]: logs.RetentionDays } = {
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
  public addMetricsConfig(
    lambdaFunction: lambda.Function,
    namespace?: string
  ): void {
    const metricsNamespace = namespace || 'AWS/Bedrock/AgentCore';
    lambdaFunction.addEnvironment('CLOUDWATCH_METRICS_NAMESPACE', metricsNamespace);
    lambdaFunction.addEnvironment('METRICS_ENABLED', 'true');
    
    // CloudWatch権限を付与
    lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    );
  }

  /**
   * Lambda関数にログ集約の環境変数を設定
   * 
   * @param lambdaFunction - 設定対象のLambda関数
   */
  public addLoggingConfig(lambdaFunction: lambda.Function): void {
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
  public configureObservabilityForLambdas(
    lambdaFunctions: lambda.Function[],
    options?: {
      enableXRay?: boolean;
      enableMetrics?: boolean;
      enableLogging?: boolean;
      namespace?: string;
    }
  ): void {
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
  public addErrorTrackingConfig(lambdaFunction: lambda.Function): void {
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
  public configureErrorNotifications(snsTopicArn: string): sns.ITopic {
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
  public getErrorTrackingFilters(): logs.MetricFilter[] {
    const filters: logs.MetricFilter[] = [];
    
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
