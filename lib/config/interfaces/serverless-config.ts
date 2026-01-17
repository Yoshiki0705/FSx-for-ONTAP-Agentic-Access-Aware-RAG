/**
 * サーバレス統合設定インターフェース
 * アカウント非依存・オプション方式対応
 */

export interface ServerlessConfig {
  // 基本設定
  enabled: boolean;
  
  // Step Functions設定
  stepFunctions: StepFunctionsConfig;
  
  // EventBridge設定
  eventBridge: EventBridgeConfig;
  
  // SQS設定
  sqs: SQSConfig;
  
  // SNS設定
  sns: SNSConfig;
  
  // Lambda統合設定
  lambda: ServerlessLambdaConfig;
  
  // 監視設定
  monitoring: ServerlessMonitoringConfig;
  
  // エラーハンドリング設定
  errorHandling: ServerlessErrorHandlingConfig;
  
  // コスト最適化設定
  costOptimization: ServerlessCostOptimizationConfig;
}

export interface StepFunctionsConfig {
  enabled: boolean;
  
  // ワークフロー設定
  workflows: StepFunctionsWorkflowConfig[];
  
  // 実行設定
  execution: {
    timeout: number; // 秒単位
    retryAttempts: number;
    backoffRate: number;
  };
  
  // ログ設定
  logging: {
    enabled: boolean;
    level: 'ALL' | 'ERROR' | 'FATAL' | 'OFF';
    includeExecutionData: boolean;
    destinations: StepFunctionsLogDestination[];
  };
  
  // X-Ray設定
  tracing: {
    enabled: boolean;
  };
}

export interface StepFunctionsWorkflowConfig {
  name: string;
  purpose: 'chat-processing' | 'data-archiving' | 'performance-optimization' | 'export-processing' | 'memory-management';
  enabled: boolean;
  
  // 定義設定
  definition: {
    autoGenerate: boolean; // 自動生成するか
    customDefinition?: any; // カスタム定義
  };
  
  // IAM設定
  role: {
    autoCreate: boolean;
    existingRoleArn?: string;
    permissions: string[]; // 必要な権限リスト
  };
  
  // タグ設定
  tags?: Record<string, string>;
}

export interface StepFunctionsLogDestination {
  type: 'CloudWatchLogs' | 'S3';
  destination: string; // Log Group ARN or S3 Bucket ARN
}

export interface EventBridgeConfig {
  enabled: boolean;
  
  // カスタムイベントバス
  customEventBus: {
    enabled: boolean;
    name?: string; // 自動生成可能
    description?: string;
  };
  
  // イベントルール
  rules: EventBridgeRuleConfig[];
  
  // スケジュール設定
  schedules: EventBridgeScheduleConfig[];
  
  // アーカイブ設定
  archive: {
    enabled: boolean;
    retentionDays: number;
    eventPattern?: any;
  };
}

export interface EventBridgeRuleConfig {
  name: string;
  purpose: 'chat-events' | 'performance-events' | 'cost-events' | 'security-events' | 'backup-events';
  enabled: boolean;
  
  // イベントパターン
  eventPattern: {
    source: string[];
    detailType: string[];
    detail?: any;
  };
  
  // ターゲット設定
  targets: EventBridgeTargetConfig[];
  
  // スケジュール設定（オプション）
  schedule?: {
    expression: string; // cron or rate expression
    timezone?: string;
  };
}

export interface EventBridgeTargetConfig {
  type: 'Lambda' | 'SQS' | 'SNS' | 'StepFunctions' | 'KinesisStream';
  arn?: string; // 自動生成可能
  autoCreate: boolean;
  
  // 入力変換
  inputTransformer?: {
    inputPathsMap?: Record<string, string>;
    inputTemplate: string;
  };
  
  // 再試行設定
  retryPolicy?: {
    maximumRetryAttempts: number;
    maximumEventAge: number;
  };
  
  // デッドレターキュー
  deadLetterQueue?: {
    enabled: boolean;
    arn?: string; // 自動生成可能
  };
}

export interface EventBridgeScheduleConfig {
  name: string;
  purpose: 'cost-analysis' | 'performance-optimization' | 'backup' | 'cleanup' | 'reporting';
  enabled: boolean;
  
  // スケジュール設定
  schedule: {
    expression: string;
    timezone?: string;
    flexibleTimeWindow?: {
      mode: 'OFF' | 'FLEXIBLE';
      maximumWindowInMinutes?: number;
    };
  };
  
  // ターゲット設定
  target: EventBridgeTargetConfig;
}

export interface SQSConfig {
  enabled: boolean;
  
  // キュー設定
  queues: SQSQueueConfig[];
  
  // デッドレターキュー設定
  deadLetterQueues: SQSDeadLetterQueueConfig[];
  
  // 監視設定
  monitoring: {
    enabled: boolean;
    alarmOnOldestMessage: boolean;
    alarmOnQueueDepth: boolean;
    maxMessageAge: number; // 秒単位
    maxQueueDepth: number;
  };
}

export interface SQSQueueConfig {
  name: string;
  purpose: 'chat-processing' | 'export-processing' | 'memory-indexing' | 'performance-analysis' | 'error-handling';
  enabled: boolean;
  
  // キュー設定
  configuration: {
    visibilityTimeoutSeconds: number;
    messageRetentionPeriod: number; // 秒単位
    maxReceiveCount?: number;
    receiveMessageWaitTimeSeconds?: number;
    delaySeconds?: number;
  };
  
  // FIFO設定
  fifo?: {
    enabled: boolean;
    contentBasedDeduplication: boolean;
    deduplicationScope?: 'messageGroup' | 'queue';
    fifoThroughputLimit?: 'perQueue' | 'perMessageGroupId';
  };
  
  // 暗号化設定
  encryption: {
    enabled: boolean;
    kmsKeyId?: string; // 自動生成可能
    kmsMasterKeyId?: string;
  };
  
  // デッドレターキュー設定
  deadLetterQueue?: {
    enabled: boolean;
    targetArn?: string; // 自動生成可能
    maxReceiveCount: number;
  };
}

export interface SQSDeadLetterQueueConfig {
  name: string;
  enabled: boolean;
  
  // 設定
  configuration: {
    messageRetentionPeriod: number; // 秒単位（最大14日）
    visibilityTimeoutSeconds: number;
  };
  
  // 暗号化設定
  encryption: {
    enabled: boolean;
    kmsKeyId?: string;
  };
  
  // アラーム設定
  alarms: {
    enabled: boolean;
    thresholds: {
      messageCount: number;
      messageAge: number; // 秒単位
    };
  };
}

export interface SNSConfig {
  enabled: boolean;
  
  // トピック設定
  topics: SNSTopicConfig[];
  
  // 通知設定
  notifications: SNSNotificationConfig;
  
  // 監視設定
  monitoring: {
    enabled: boolean;
    deliveryStatusLogging: boolean;
    successSampleRate?: number;
  };
}

export interface SNSTopicConfig {
  name: string;
  purpose: 'system-notifications' | 'error-alerts' | 'performance-alerts' | 'cost-alerts' | 'security-alerts';
  enabled: boolean;
  
  // トピック設定
  configuration: {
    displayName?: string;
    kmsMasterKeyId?: string; // 自動生成可能
    fifoTopic?: boolean;
    contentBasedDeduplication?: boolean;
  };
  
  // サブスクリプション設定
  subscriptions: SNSSubscriptionConfig[];
  
  // 配信ポリシー
  deliveryPolicy?: {
    healthyRetryPolicy?: {
      minDelayTarget?: number;
      maxDelayTarget?: number;
      numRetries?: number;
      numMaxDelayRetries?: number;
      backoffFunction?: 'linear' | 'arithmetic' | 'geometric' | 'exponential';
    };
  };
}

export interface SNSSubscriptionConfig {
  protocol: 'email' | 'sms' | 'lambda' | 'sqs' | 'http' | 'https';
  endpoint: string;
  enabled: boolean;
  
  // フィルターポリシー
  filterPolicy?: any;
  
  // 配信設定
  deliveryPolicy?: {
    healthyRetryPolicy?: any;
  };
  
  // 確認設定
  confirmationRequired: boolean;
}

export interface SNSNotificationConfig {
  // システム通知
  systemNotifications: {
    enabled: boolean;
    topics: string[]; // トピック名のリスト
  };
  
  // エラー通知
  errorNotifications: {
    enabled: boolean;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    topics: string[];
  };
  
  // パフォーマンス通知
  performanceNotifications: {
    enabled: boolean;
    thresholds: {
      latency: number; // ミリ秒
      throughput: number; // リクエスト/秒
      errorRate: number; // パーセンテージ
    };
    topics: string[];
  };
}

export interface ServerlessLambdaConfig {
  // 共通設定
  common: {
    runtime: string;
    timeout: number; // 秒単位
    memorySize: number; // MB単位
    enableXRayTracing: boolean;
    enableDeadLetterQueue: boolean;
    reservedConcurrency?: number;
    provisionedConcurrency?: number;
  };
  
  // 関数別設定
  functions: ServerlessLambdaFunctionConfig[];
  
  // レイヤー設定
  layers: ServerlessLambdaLayerConfig[];
  
  // 環境変数設定
  environment: {
    autoInject: boolean; // 共通環境変数の自動注入
    variables: Record<string, string>;
  };
}

export interface ServerlessLambdaFunctionConfig {
  name: string;
  purpose: 'chat-processor' | 'export-processor' | 'memory-indexer' | 'performance-optimizer' | 'cost-analyzer';
  enabled: boolean;
  
  // 実行設定
  runtime?: string; // 未指定時は共通設定を使用
  timeout?: number;
  memorySize?: number;
  
  // トリガー設定
  triggers: ServerlessLambdaTriggerConfig[];
  
  // 環境変数
  environment?: Record<string, string>;
  
  // VPC設定
  vpc?: {
    enabled: boolean;
    subnetIds?: string[]; // 自動検出可能
    securityGroupIds?: string[]; // 自動生成可能
  };
  
  // ファイルシステム設定
  fileSystem?: {
    enabled: boolean;
    arn?: string; // FSx for ONTAP ARN
    localMountPath: string;
  };
}

export interface ServerlessLambdaTriggerConfig {
  type: 'SQS' | 'EventBridge' | 'S3' | 'DynamoDB' | 'API Gateway' | 'Schedule';
  source?: string; // ARN or name
  autoCreate: boolean;
  
  // バッチ設定（SQS/DynamoDB用）
  batchSize?: number;
  maxBatchingWindowInSeconds?: number;
  
  // フィルター設定
  filterCriteria?: any;
  
  // エラーハンドリング
  onFailure?: {
    destination?: string; // SQS/SNS ARN
  };
}

export interface ServerlessLambdaLayerConfig {
  name: string;
  purpose: 'common-utilities' | 'aws-sdk' | 'monitoring' | 'security';
  enabled: boolean;
  
  // レイヤー設定
  compatibleRuntimes: string[];
  description?: string;
  
  // コンテンツ設定
  content: {
    autoPackage: boolean; // 自動パッケージング
    sourcePath?: string; // ソースコードパス
    s3Bucket?: string;
    s3Key?: string;
  };
}

export interface ServerlessMonitoringConfig {
  // CloudWatch統合
  cloudWatch: {
    enabled: boolean;
    customMetrics: boolean;
    dashboardEnabled: boolean;
    logInsights: boolean;
  };
  
  // X-Ray設定
  xray: {
    enabled: boolean;
    tracingConfig: 'Active' | 'PassThrough';
    samplingRate?: number;
  };
  
  // アラーム設定
  alarms: ServerlessAlarmConfig[];
  
  // ダッシュボード設定
  dashboard: {
    enabled: boolean;
    widgets: ServerlessDashboardWidgetConfig[];
  };
}

export interface ServerlessAlarmConfig {
  name: string;
  type: 'Lambda' | 'StepFunctions' | 'SQS' | 'SNS' | 'EventBridge';
  metricName: string;
  threshold: number;
  comparisonOperator: string;
  evaluationPeriods: number;
  
  // アクション設定
  actions: {
    sns?: string[];
    autoScaling?: boolean;
    lambda?: string;
  };
}

export interface ServerlessDashboardWidgetConfig {
  type: 'metric' | 'log' | 'text';
  title: string;
  metrics?: string[];
  logGroups?: string[];
  content?: string;
  
  // 位置設定
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ServerlessErrorHandlingConfig {
  // グローバルエラーハンドリング
  global: {
    enabled: boolean;
    deadLetterQueue: {
      enabled: boolean;
      retentionDays: number;
    };
    errorNotification: {
      enabled: boolean;
      snsTopics: string[];
    };
  };
  
  // 再試行設定
  retry: {
    enabled: boolean;
    maxAttempts: number;
    backoffMultiplier: number;
    maxBackoffSeconds: number;
  };
  
  // サーキットブレーカー
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
  };
}

export interface ServerlessCostOptimizationConfig {
  // コスト監視
  costMonitoring: {
    enabled: boolean;
    budgetAlerts: boolean;
    monthlyBudget?: number;
  };
  
  // 自動最適化
  autoOptimization: {
    enabled: boolean;
    rightSizing: boolean;
    concurrencyOptimization: boolean;
    scheduleOptimization: boolean;
  };
  
  // 使用量分析
  usageAnalysis: {
    enabled: boolean;
    reportingEnabled: boolean;
    recommendationsEnabled: boolean;
  };
}

// プリセット設定
export const ServerlessPresets = {
  // 開発環境用（コスト重視）
  development: {
    enabled: true,
    stepFunctions: {
      enabled: true,
      workflows: [
        {
          name: 'chat-processing-dev',
          purpose: 'chat-processing' as const,
          enabled: true,
          definition: { autoGenerate: true },
          role: { autoCreate: true, permissions: ['lambda:InvokeFunction', 'sns:Publish'] }
        }
      ],
      execution: {
        timeout: 300,
        retryAttempts: 2,
        backoffRate: 2.0
      },
      logging: {
        enabled: true,
        level: 'ERROR' as const,
        includeExecutionData: false,
        destinations: []
      },
      tracing: { enabled: false }
    },
    lambda: {
      common: {
        runtime: 'nodejs18.x',
        timeout: 30,
        memorySize: 256,
        enableXRayTracing: false,
        enableDeadLetterQueue: true
      },
      functions: [],
      layers: [],
      environment: {
        autoInject: true,
        variables: {}
      }
    }
  } as Partial<ServerlessConfig>,

  // 本番環境用（パフォーマンス重視）
  production: {
    enabled: true,
    stepFunctions: {
      enabled: true,
      workflows: [
        {
          name: 'chat-processing-prod',
          purpose: 'chat-processing' as const,
          enabled: true,
          definition: { autoGenerate: true },
          role: { autoCreate: true, permissions: ['lambda:InvokeFunction', 'sns:Publish', 's3:GetObject', 's3:PutObject'] }
        },
        {
          name: 'data-archiving-prod',
          purpose: 'data-archiving' as const,
          enabled: true,
          definition: { autoGenerate: true },
          role: { autoCreate: true, permissions: ['lambda:InvokeFunction', 's3:*', 'fsx:*'] }
        }
      ],
      execution: {
        timeout: 900,
        retryAttempts: 3,
        backoffRate: 2.0
      },
      logging: {
        enabled: true,
        level: 'ALL' as const,
        includeExecutionData: true,
        destinations: []
      },
      tracing: { enabled: true }
    },
    lambda: {
      common: {
        runtime: 'nodejs18.x',
        timeout: 300,
        memorySize: 1024,
        enableXRayTracing: true,
        enableDeadLetterQueue: true,
        reservedConcurrency: 100
      },
      functions: [],
      layers: [],
      environment: {
        autoInject: true,
        variables: {}
      }
    }
  } as Partial<ServerlessConfig>
};