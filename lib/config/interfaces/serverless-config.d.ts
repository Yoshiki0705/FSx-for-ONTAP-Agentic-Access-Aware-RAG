/**
 * サーバレス統合設定インターフェース
 * アカウント非依存・オプション方式対応
 */
export interface ServerlessConfig {
    enabled: boolean;
    stepFunctions: StepFunctionsConfig;
    eventBridge: EventBridgeConfig;
    sqs: SQSConfig;
    sns: SNSConfig;
    lambda: ServerlessLambdaConfig;
    monitoring: ServerlessMonitoringConfig;
    errorHandling: ServerlessErrorHandlingConfig;
    costOptimization: ServerlessCostOptimizationConfig;
}
export interface StepFunctionsConfig {
    enabled: boolean;
    workflows: StepFunctionsWorkflowConfig[];
    execution: {
        timeout: number;
        retryAttempts: number;
        backoffRate: number;
    };
    logging: {
        enabled: boolean;
        level: 'ALL' | 'ERROR' | 'FATAL' | 'OFF';
        includeExecutionData: boolean;
        destinations: StepFunctionsLogDestination[];
    };
    tracing: {
        enabled: boolean;
    };
}
export interface StepFunctionsWorkflowConfig {
    name: string;
    purpose: 'chat-processing' | 'data-archiving' | 'performance-optimization' | 'export-processing' | 'memory-management';
    enabled: boolean;
    definition: {
        autoGenerate: boolean;
        customDefinition?: any;
    };
    role: {
        autoCreate: boolean;
        existingRoleArn?: string;
        permissions: string[];
    };
    tags?: Record<string, string>;
}
export interface StepFunctionsLogDestination {
    type: 'CloudWatchLogs' | 'S3';
    destination: string;
}
export interface EventBridgeConfig {
    enabled: boolean;
    customEventBus: {
        enabled: boolean;
        name?: string;
        description?: string;
    };
    rules: EventBridgeRuleConfig[];
    schedules: EventBridgeScheduleConfig[];
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
    eventPattern: {
        source: string[];
        detailType: string[];
        detail?: any;
    };
    targets: EventBridgeTargetConfig[];
    schedule?: {
        expression: string;
        timezone?: string;
    };
}
export interface EventBridgeTargetConfig {
    type: 'Lambda' | 'SQS' | 'SNS' | 'StepFunctions' | 'KinesisStream';
    arn?: string;
    autoCreate: boolean;
    inputTransformer?: {
        inputPathsMap?: Record<string, string>;
        inputTemplate: string;
    };
    retryPolicy?: {
        maximumRetryAttempts: number;
        maximumEventAge: number;
    };
    deadLetterQueue?: {
        enabled: boolean;
        arn?: string;
    };
}
export interface EventBridgeScheduleConfig {
    name: string;
    purpose: 'cost-analysis' | 'performance-optimization' | 'backup' | 'cleanup' | 'reporting';
    enabled: boolean;
    schedule: {
        expression: string;
        timezone?: string;
        flexibleTimeWindow?: {
            mode: 'OFF' | 'FLEXIBLE';
            maximumWindowInMinutes?: number;
        };
    };
    target: EventBridgeTargetConfig;
}
export interface SQSConfig {
    enabled: boolean;
    queues: SQSQueueConfig[];
    deadLetterQueues: SQSDeadLetterQueueConfig[];
    monitoring: {
        enabled: boolean;
        alarmOnOldestMessage: boolean;
        alarmOnQueueDepth: boolean;
        maxMessageAge: number;
        maxQueueDepth: number;
    };
}
export interface SQSQueueConfig {
    name: string;
    purpose: 'chat-processing' | 'export-processing' | 'memory-indexing' | 'performance-analysis' | 'error-handling';
    enabled: boolean;
    configuration: {
        visibilityTimeoutSeconds: number;
        messageRetentionPeriod: number;
        maxReceiveCount?: number;
        receiveMessageWaitTimeSeconds?: number;
        delaySeconds?: number;
    };
    fifo?: {
        enabled: boolean;
        contentBasedDeduplication: boolean;
        deduplicationScope?: 'messageGroup' | 'queue';
        fifoThroughputLimit?: 'perQueue' | 'perMessageGroupId';
    };
    encryption: {
        enabled: boolean;
        kmsKeyId?: string;
        kmsMasterKeyId?: string;
    };
    deadLetterQueue?: {
        enabled: boolean;
        targetArn?: string;
        maxReceiveCount: number;
    };
}
export interface SQSDeadLetterQueueConfig {
    name: string;
    enabled: boolean;
    configuration: {
        messageRetentionPeriod: number;
        visibilityTimeoutSeconds: number;
    };
    encryption: {
        enabled: boolean;
        kmsKeyId?: string;
    };
    alarms: {
        enabled: boolean;
        thresholds: {
            messageCount: number;
            messageAge: number;
        };
    };
}
export interface SNSConfig {
    enabled: boolean;
    topics: SNSTopicConfig[];
    notifications: SNSNotificationConfig;
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
    configuration: {
        displayName?: string;
        kmsMasterKeyId?: string;
        fifoTopic?: boolean;
        contentBasedDeduplication?: boolean;
    };
    subscriptions: SNSSubscriptionConfig[];
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
    filterPolicy?: any;
    deliveryPolicy?: {
        healthyRetryPolicy?: any;
    };
    confirmationRequired: boolean;
}
export interface SNSNotificationConfig {
    systemNotifications: {
        enabled: boolean;
        topics: string[];
    };
    errorNotifications: {
        enabled: boolean;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        topics: string[];
    };
    performanceNotifications: {
        enabled: boolean;
        thresholds: {
            latency: number;
            throughput: number;
            errorRate: number;
        };
        topics: string[];
    };
}
export interface ServerlessLambdaConfig {
    common: {
        runtime: string;
        timeout: number;
        memorySize: number;
        enableXRayTracing: boolean;
        enableDeadLetterQueue: boolean;
        reservedConcurrency?: number;
        provisionedConcurrency?: number;
    };
    functions: ServerlessLambdaFunctionConfig[];
    layers: ServerlessLambdaLayerConfig[];
    environment: {
        autoInject: boolean;
        variables: Record<string, string>;
    };
}
export interface ServerlessLambdaFunctionConfig {
    name: string;
    purpose: 'chat-processor' | 'export-processor' | 'memory-indexer' | 'performance-optimizer' | 'cost-analyzer';
    enabled: boolean;
    runtime?: string;
    timeout?: number;
    memorySize?: number;
    triggers: ServerlessLambdaTriggerConfig[];
    environment?: Record<string, string>;
    vpc?: {
        enabled: boolean;
        subnetIds?: string[];
        securityGroupIds?: string[];
    };
    fileSystem?: {
        enabled: boolean;
        arn?: string;
        localMountPath: string;
    };
}
export interface ServerlessLambdaTriggerConfig {
    type: 'SQS' | 'EventBridge' | 'S3' | 'DynamoDB' | 'API Gateway' | 'Schedule';
    source?: string;
    autoCreate: boolean;
    batchSize?: number;
    maxBatchingWindowInSeconds?: number;
    filterCriteria?: any;
    onFailure?: {
        destination?: string;
    };
}
export interface ServerlessLambdaLayerConfig {
    name: string;
    purpose: 'common-utilities' | 'aws-sdk' | 'monitoring' | 'security';
    enabled: boolean;
    compatibleRuntimes: string[];
    description?: string;
    content: {
        autoPackage: boolean;
        sourcePath?: string;
        s3Bucket?: string;
        s3Key?: string;
    };
}
export interface ServerlessMonitoringConfig {
    cloudWatch: {
        enabled: boolean;
        customMetrics: boolean;
        dashboardEnabled: boolean;
        logInsights: boolean;
    };
    xray: {
        enabled: boolean;
        tracingConfig: 'Active' | 'PassThrough';
        samplingRate?: number;
    };
    alarms: ServerlessAlarmConfig[];
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
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
export interface ServerlessErrorHandlingConfig {
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
    retry: {
        enabled: boolean;
        maxAttempts: number;
        backoffMultiplier: number;
        maxBackoffSeconds: number;
    };
    circuitBreaker: {
        enabled: boolean;
        failureThreshold: number;
        recoveryTimeout: number;
    };
}
export interface ServerlessCostOptimizationConfig {
    costMonitoring: {
        enabled: boolean;
        budgetAlerts: boolean;
        monthlyBudget?: number;
    };
    autoOptimization: {
        enabled: boolean;
        rightSizing: boolean;
        concurrencyOptimization: boolean;
        scheduleOptimization: boolean;
    };
    usageAnalysis: {
        enabled: boolean;
        reportingEnabled: boolean;
        recommendationsEnabled: boolean;
    };
}
export declare const ServerlessPresets: {
    development: Partial<ServerlessConfig>;
    production: Partial<ServerlessConfig>;
};
