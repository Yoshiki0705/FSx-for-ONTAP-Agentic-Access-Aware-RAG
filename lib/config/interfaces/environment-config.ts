/**
 * 環境設定インターフェース
 */

import { NamingConfig } from './naming-config';

export interface EnvironmentConfig {
  projectName?: string;
  environment: string;
  region: string;
  project: ProjectConfig;
  networking: NetworkingConfig;
  security: SecurityConfig;
  storage: StorageConfig;
  database: DatabaseConfig;
  embedding: EmbeddingConfig;
  api: ApiConfig;
  ai: AiConfig;
  bedrockAgent?: BedrockAgentConfig; // Bedrock Agent設定（オプション）
  monitoring: MonitoringConfig;
  enterprise: EnterpriseConfig;
  features: FeatureFlags;
  tags: TagsConfig;
  naming?: NamingConfig; // 命名設定（オプション）
}

export interface ProjectConfig {
  name: string;
  version: string;
  description: string;
}

export interface NetworkingConfig {
  vpcCidr: string;
  availabilityZones: number;
  natGateways: {
    enabled: boolean;
    count: number;
  };
  enableVpcFlowLogs: boolean;
  enableDnsHostnames: boolean;
  enableDnsSupport: boolean;
}

export interface SecurityConfig {
  enableWaf: boolean;
  enableGuardDuty: boolean;
  enableConfig: boolean;
  enableCloudTrail: boolean;
  kmsKeyRotation: boolean;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
}

export interface StorageConfig {
  s3: S3Config;
  fsx?: any; // 新しいFsx設定（オプション）
  fsxOntap: FsxOntapConfig;
  tags?: Record<string, string>;
}

export interface S3BucketConfig {
  enabled?: boolean;
  bucketName?: string;
  encryption?: boolean;
  versioning?: boolean;
}

export interface S3Config {
  encryption?: any;
  versioning?: boolean;
  lifecycle?: any;
  publicAccess?: any;
  enableVersioning?: boolean;
  enableLifecyclePolicy?: boolean;
  transitionToIADays?: number;
  transitionToGlacierDays?: number;
  expirationDays?: number;
  documents?: S3BucketConfig;
  backup?: S3BucketConfig;
  embeddings?: S3BucketConfig;
}

export interface FsxOntapConfig {
  enabled: boolean;
  storageCapacity: number;
  throughputCapacity: number;
  deploymentType: string;
  automaticBackupRetentionDays: number;
  volumes?: any;
  activeDirectory?: {
    enabled: boolean;
    domainName?: string;
    dnsIps?: string[];
  };
}

export interface DatabaseConfig {
  dynamodb: DynamoDbConfig;
  opensearch: OpenSearchConfig;
}

export interface DynamoDbConfig {
  billingMode: string;
  pointInTimeRecovery: boolean;
  enableStreams: boolean;
  streamViewType: string;
}

export interface OpenSearchConfig {
  instanceType: string;
  instanceCount: number;
  dedicatedMasterEnabled: boolean;
  masterInstanceCount: number;
  ebsEnabled: boolean;
  volumeType: string;
  volumeSize: number;
  encryptionAtRest: boolean;
}

export interface EmbeddingConfig {
  lambda: LambdaConfig;
  batch: BatchConfig;
  ecs: EcsConfig;
}

export interface LambdaConfig {
  runtime: string;
  timeout: number;
  memorySize: number;
  enableXRayTracing: boolean;
  enableDeadLetterQueue: boolean;
}

export interface BatchConfig {
  enabled: boolean;
  computeEnvironmentType: string;
  instanceTypes: string[];
  minvCpus: number;
  maxvCpus: number;
  desiredvCpus: number;
}

export interface EcsConfig {
  enabled: boolean;
  instanceType: string;
  minCapacity: number;
  maxCapacity: number;
  desiredCapacity: number;
  enableManagedInstance: boolean;
}

export interface ApiConfig {
  throttling: {
    rateLimit: number;
    burstLimit: number;
  };
  cors: {
    enabled: boolean;
    allowOrigins: string[];
    allowMethods: string[];
    allowHeaders: string[];
  };
  authentication: {
    cognitoEnabled: boolean;
    apiKeyRequired: boolean;
  };
}

export interface AiConfig {
  bedrock: {
    enabled: boolean;
    models: string[];
    maxTokens: number;
    temperature: number;
  };
  embedding: {
    model: string;
    dimensions: number;
    batchSize: number;
  };
}

export interface BedrockAgentConfig {
  enabled: boolean;
  foundationModel: string;
  knowledgeBaseId: string;
  documentSearchLambdaArn: string;
}

export interface MonitoringConfig {
  enableDetailedMonitoring: boolean;
  logRetentionDays: number;
  enableAlarms: boolean;
  alarmNotificationEmail: string;
  enableDashboard: boolean;
  enableXRayTracing: boolean;
}

export interface EnterpriseConfig {
  enableAccessControl: boolean;
  enableAuditLogging: boolean;
  enableBIAnalytics: boolean;
  enableMultiTenant: boolean;
  dataRetentionDays: number;
}

export interface FeatureFlags {
  enableNetworking: boolean;
  enableSecurity: boolean;
  enableStorage: boolean;
  enableDatabase: boolean;
  enableEmbedding: boolean;
  enableAPI: boolean;
  enableAI: boolean;
  enableMonitoring: boolean;
  enableEnterprise: boolean;
}

export interface TagsConfig {
  Environment: string;
  Project: string;
  Owner: string;
  CostCenter: string;
  Backup: string;
  Monitoring: string;
  Compliance: string;
  DataClassification: string;
  Region: string;
  Timezone: string;
  ComplianceFramework: string;
  // 本番環境用追加タグ（オプション）
  BusinessCriticality?: string;
  DisasterRecovery?: string;
  SecurityLevel?: string;
  EncryptionRequired?: string;
  AuditRequired?: string;
  PerformanceLevel?: string;
  AvailabilityTarget?: string;
  RPO?: string;
  RTO?: string;
}
// ✅ Added missing interfaces
export interface FsxIntegrationConfig {
  enabled: boolean;
  fsxFileSystemId?: string;
  ontapManagementLif?: string;
  credentials?: {
    username: string;
    password: string;
  };
}

export interface AgentCoreIntegrationConfig {
  enabled: boolean;
  agentId?: string;
  agentAliasId?: string;
  knowledgeBaseId?: string;
  region?: string;
}

// ✅ Updated AgentCoreIntegrationConfig with all required properties
export interface AgentCoreIntegrationConfig {
  enabled: boolean;
  agentId?: string;
  agentAliasId?: string;
  knowledgeBaseId?: string;
  region?: string;
  projectName?: string;
  environment?: string;
  
  // Agent Core specific configuration
  agentCore?: {
    monitoring?: {
      enabled: boolean;
    };
    runtime?: {
      lambda?: {
        functionName?: string;
        timeout?: number;
        memorySize?: number;
      };
    };
  };
  
  // User preferences configuration
  userPreferences?: {
    enabled: boolean;
  };
  
  // Hybrid architecture configuration
  hybridArchitecture?: {
    enabled: boolean;
  };
}

