/**
 * Embedding Configuration Interfaces
 * AI/ML Embeddingモジュール用の設定インターフェース
 */

/**
 * Embedding Environment Configuration
 */
export interface EmbeddingEnvironmentConfig {
  readonly type: 'MANAGED' | 'UNMANAGED';
  readonly state: 'ENABLED' | 'DISABLED';
  readonly serviceRole: string;
  readonly instanceTypes: string[];
  readonly minvCpus: number;
  readonly maxvCpus: number;
  readonly desiredvCpus: number;
  readonly spotIamFleetRequestRole?: string;
  readonly enableSpotInstances?: boolean;
}

/**
 * Embedding Job Queue Configuration
 */
export interface EmbeddingJobQueueConfig {
  readonly state: 'ENABLED' | 'DISABLED';
  readonly priority: number;
  readonly schedulingPriority?: number;
}

/**
 * Embedding Job Definition Configuration
 */
export interface EmbeddingJobDefinitionConfig {
  readonly type: 'container' | 'multinode';
  readonly platformCapabilities: string[];
  readonly jobRoleArn: string;
  readonly executionRoleArn: string;
  readonly containerProperties: {
    readonly image: string;
    readonly vcpus: number;
    readonly memory: number;
    readonly jobRoleArn: string;
  };
  readonly retryStrategy: {
    readonly attempts: number;
  };
  readonly timeout: {
    readonly attemptDurationSeconds: number;
  };
}

/**
 * Bedrock Model Configuration
 */
export interface BedrockModelConfig {
  readonly region: string;
  readonly embeddingModel: string;
  readonly textModel?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

/**
 * FSx for ONTAP Configuration
 */
export interface FsxConfig {
  readonly create: boolean;
  readonly fileSystemId?: string;
  readonly svmId?: string;
  readonly volumeId?: string;
  readonly mountPath?: string;
  readonly dnsName?: string;
  readonly nfsEndpoint?: string;
  readonly cifsEndpoint?: string;
  readonly cifsShareName?: string;
}

/**
 * VPC Configuration
 */
export interface VpcConfig {
  readonly create: boolean;
  readonly vpcId?: string;
  readonly privateSubnetIds?: string[];
  readonly publicSubnetIds?: string[];
  readonly availabilityZones?: string[];
  readonly cidrBlock?: string;
}

/**
 * S3 Configuration
 */
export interface S3Config {
  readonly create: boolean;
  readonly bucketName?: string;
  readonly enableVersioning?: boolean;
  readonly enableEncryption?: boolean;
  readonly lifecycleRules?: any[];
}

/**
 * DynamoDB Configuration
 */
export interface DynamoDbConfig {
  readonly create: boolean;
  readonly tableName?: string;
  readonly partitionKey?: string;
  readonly sortKey?: string;
  readonly billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED';
  readonly readCapacity?: number;
  readonly writeCapacity?: number;
}

/**
 * Monitoring Configuration
 */
export interface MonitoringConfig {
  readonly enableCloudWatch: boolean;
  readonly logRetentionDays: number;
  readonly enableXRay: boolean;
  readonly alerting: {
    readonly enableAlerts: boolean;
    readonly emailEndpoints: string[];
    readonly slackWebhookUrl?: string;
    readonly snsTopicArn?: string;
  };
}

/**
 * Security Configuration
 */
export interface SecurityConfig {
  readonly enableEncryption: boolean;
  readonly kmsKeyId?: string;
  readonly enableVpcEndpoints: boolean;
  readonly restrictedIpRanges?: string[];
}

/**
 * Windows Load Test Configuration
 */
export interface WindowsLoadTestConfig {
  readonly enabled: boolean;
  readonly instanceType?: string;
  readonly keyPairName: string;
  readonly enableDetailedMonitoring?: boolean;
  readonly enableBastion?: boolean;
}

/**
 * Scheduled Execution Configuration
 */
export interface ScheduledExecutionConfig {
  readonly enabled: boolean;
  readonly scheduleExpression?: string;
  readonly timezone?: string;
  readonly description?: string;
}

/**
 * Main Embedding Configuration
 */
export interface EmbeddingConfig {
  readonly projectName: string;
  readonly environment: string;
  readonly region: string;
  readonly vpc: VpcConfig;
  readonly fsx: FsxConfig;
  readonly bedrock: BedrockModelConfig;
  readonly batch: {
    readonly embeddingEnvironment: EmbeddingEnvironmentConfig;
    readonly jobQueue: EmbeddingJobQueueConfig;
    readonly jobDefinition: EmbeddingJobDefinitionConfig;
  };
  readonly s3?: S3Config;
  readonly dynamodb?: DynamoDbConfig;
  readonly monitoring?: MonitoringConfig;
  readonly security?: SecurityConfig;
  readonly windowsLoadTest?: WindowsLoadTestConfig;
  readonly scheduledExecution?: ScheduledExecutionConfig;
  readonly tags?: Record<string, string>;
}

/**
 * Embedding OpenSearch Integration Configuration
 */
export interface EmbeddingOpenSearchIntegrationConfig {
  readonly enabled: boolean;
  readonly domainName?: string;
  readonly instanceType?: string;
  readonly instanceCount?: number;
  readonly dedicatedMasterEnabled?: boolean;
  readonly masterInstanceType?: string;
  readonly masterInstanceCount?: number;
  readonly ebsEnabled?: boolean;
  readonly volumeType?: string;
  readonly volumeSize?: number;
  readonly encryptionAtRestEnabled?: boolean;
  readonly nodeToNodeEncryptionEnabled?: boolean;
  readonly enforceHttps?: boolean;
}

/**
 * Embedding RDS Configuration
 */
export interface EmbeddingRdsConfig {
  readonly enabled: boolean;
  readonly engine?: string;
  readonly engineVersion?: string;
  readonly instanceClass?: string;
  readonly allocatedStorage?: number;
  readonly storageType?: string;
  readonly storageEncrypted?: boolean;
  readonly multiAz?: boolean;
  readonly backupRetentionPeriod?: number;
  readonly deletionProtection?: boolean;
}

/**
 * Embedding Stack Properties
 */
export interface EmbeddingStackProps {
  readonly config: EmbeddingConfig;
  readonly enableWindowsLoadTest?: boolean;
  readonly enableScheduledExecution?: boolean;
  readonly enableOpenSearchIntegration?: boolean;
  readonly enableRdsIntegration?: boolean;
  readonly openSearchConfig?: EmbeddingOpenSearchIntegrationConfig;
  readonly rdsConfig?: EmbeddingRdsConfig;
}