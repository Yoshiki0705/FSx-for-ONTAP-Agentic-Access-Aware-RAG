import { StackProps } from 'aws-cdk-lib';

export interface NetworkConfig {
  vpcCidr?: string;
  subnetCidrMask?: number;
  availabilityZones?: string[];
  existingVpc?: boolean;
  vpcId?: string;
  cidr?: string;
  maxAzs?: number;
  publicSubnet?: any;
  natSubnet?: any;
  isolatedSubnet?: any;
  cidrMask?: number;
}

export interface AdConfig {
  domainName?: string;
  adminPassword?: string;
  adAdminPassword?: string;
  adDomainName?: string;
  existingAd?: boolean;
  adDnsIps?: string[];
  serviceAccountUserName?: string;
  serviceAccountPassword?: string;
  svmNetBiosName?: string;
  adOu?: string;
  fileSystemAdministratorsGroup?: string;
}

export interface FsxConfig {
  storageCapacity?: number;
  throughputCapacity?: number;
  deploymentType?: string;
  fsxAdminPassword?: string;
  adConfig?: AdConfig;
}

export interface ChatAppConfig {
  enabled?: boolean;
  containerPort?: number;
  cpu?: number;
  memory?: number;
  subnets?: any[];
  lambdaVpcId?: string;
  lambdaVpcSubnets?: any[];
  imagePath?: string;
  tag?: string;
  albFargateServiceProps?: any;
}

export interface DatabaseConfig {
  engine?: string;
  instanceClass?: string;
  allocatedStorage?: number;
  userAccessTable?: string;
  partitionKey?: any;
}

export interface VectorConfig {
  indexName?: string;
  dimension?: number;
}

// Stack Props interfaces
export interface CopmuteStackProps extends StackProps {
  projectName?: string;
  environment?: string;
}

export interface WebAppStackProps extends StackProps {
  projectName?: string;
  environment?: string;
}

export interface NetworkOnlyProps extends StackProps {
  projectName?: string;
  environment?: string;
}

export interface EmbeddingServerProps extends StackProps {
  projectName?: string;
  environment?: string;
  vpc?: any;
  config?: any;
  vectorDB?: any;
  database?: any;
}

export interface LambdaWebAdapterProps extends StackProps {
  projectName?: string;
  environment?: string;
  vpc?: any;
  wafAttrArn?: string;
  edgeFnVersion?: any;
  imagePath?: string;
  tag?: string;
}

export interface VectorDBProps extends StackProps {
  projectName?: string;
  environment?: string;
  vector?: any;
  collectionName?: string;
  config?: any;
}

export interface AdProps extends StackProps {
  adConfig?: AdConfig;
  subnetIds?: string[];
}

export interface FSxNProps extends StackProps {
  subnetIds?: string[];
  deploymentType?: string;
  fsxAdminPassword?: string;
  storageCapacity?: number;
  throughputCapacity?: number;
  adConfig?: AdConfig;
}

export interface ApiProps extends StackProps {
  imagePath?: string;
  tag?: string;
}

export interface ChatAppProps extends StackProps {
  imagePath?: string;
  tag?: string;
  albFargateServiceProps?: any;
}

// === Embedding Server Architecture Upgrade - 拡張設定インターフェース ===
/**
 * FSx for NetApp ONTAP Embedding Server Architecture Upgrade
 * 複数アーキテクチャパターン対応の設定インターフェース定義
 */

/**
 * アーキテクチャパターンの種類
 */
export type EmbeddingArchitecturePattern = 
  | 'ec2-ondemand'    // 現在構成（EC2オンデマンド24/7稼働）
  | 'ec2-spot'        // EC2 Spot + EventBridge（90%コスト削減）
  | 'aws-batch'       // AWS Batch + EventBridge（フルマネージド）
  | 'ecs-ec2';        // ECS on EC2 + EventBridge（ECS統合管理）

/**
 * FSx ONTAP マウント設定
 */
export interface FSxMountConfig {
  /** ファイルシステムID */
  fileSystemId: string;
  /** SVM ID */
  svmId: string;
  /** ボリューム設定 */
  volumes: {
    /** ドキュメントボリューム（SMB/CIFS） */
    documents: {
      path: string;
      protocol: 'SMB' | 'NFS';
      mountPoint: string;
    };
    /** 埋め込みボリューム（NFS） */
    embeddings: {
      path: string;
      protocol: 'NFS';
      mountPoint: string;
    };
    /** インデックスボリューム（NFS） */
    index: {
      path: string;
      protocol: 'NFS';
      mountPoint: string;
    };
  };
}

/**
 * EC2 Spot インスタンス設定
 */
export interface SpotInstanceConfig {
  /** 最大価格（USD/時間） */
  maxPrice?: string;
  /** インスタンスタイプのリスト */
  instanceTypes: string[];
  /** 複数AZ配置 */
  availabilityZones: string[];
  /** 中断時の自動再試行回数 */
  maxRetries?: number;
  /** 処理完了後の自動終了 */
  autoTerminate?: boolean;
}

/**
 * AWS Batch 設定
 */
export interface BatchConfig {
  /** 最大vCPU数 */
  maxvCpus: number;
  /** 最小vCPU数 */
  minvCpus?: number;
  /** 希望vCPU数 */
  desiredvCpus?: number;
  /** リトライ回数 */
  retryAttempts: number;
  /** ジョブタイムアウト（秒） */
  jobTimeoutSeconds?: number;
  /** コンピュート環境タイプ */
  computeEnvironmentType?: 'MANAGED' | 'UNMANAGED';
  /** インスタンスタイプ */
  instanceTypes?: string[];
  /** Spot価格使用フラグ */
  useSpotInstances?: boolean;
}

/**
 * ECS on EC2 設定
 */
export interface EcsConfig {
  /** 希望タスク数 */
  desiredCount: number;
  /** CPU単位（1024 = 1 vCPU） */
  cpu: number;
  /** メモリ（MB） */
  memory: number;
  /** 最大タスク数 */
  maxCapacity?: number;
  /** 最小タスク数 */
  minCapacity?: number;
  /** Auto Scaling設定 */
  autoScaling?: {
    targetCpuUtilization: number;
    targetMemoryUtilization: number;
    scaleOutCooldown?: number;
    scaleInCooldown?: number;
  };
  /** プラットフォームバージョン */
  platformVersion?: string;
}

/**
 * 処理制限設定
 */
export interface ProcessingLimits {
  /** 最大ファイル数 */
  maxFiles: number;
  /** 最大フォルダー数 */
  maxFolders: number;
  /** 最大データサイズ（GB） */
  maxDataSizeGB: number;
  /** バッチサイズ（ファイル/バッチ） */
  batchSize: number;
  /** 並列処理数 */
  maxParallelJobs: number;
  /** メモリ使用量制限（MB） */
  memoryLimitMB?: number;
  /** ディスク容量制限（GB） */
  diskLimitGB?: number;
}

/**
 * SQLite UPSERT Manager 統合設定
 */
export interface SqliteUpsertConfig {
  /** リトライ設定 */
  retryConfig: {
    maxRetries: number;
    backoffMs: number;
    exponentialBackoff?: boolean;
  };
  /** トランザクション設定 */
  transactionConfig: {
    batchSize: number;
    timeoutMs: number;
  };
  /** 監視設定 */
  monitoringConfig: {
    enableMetrics: boolean;
    enableDetailedLogs: boolean;
    metricsNamespace?: string;
  };
}

/**
 * 監視・アラート設定
 */
export interface MonitoringConfig {
  /** CloudWatch設定 */
  cloudWatch: {
    namespace: string;
    metrics: string[];
    retentionDays?: number;
  };
  /** アラート設定 */
  alerts: {
    jobFailureThreshold: number;
    executionTimeThresholdMinutes: number;
    errorRateThreshold: number;
    snsTopicArn?: string;
  };
  /** ダッシュボード設定 */
  dashboard?: {
    enabled: boolean;
    name?: string;
    widgets?: string[];
  };
}

/**
 * コスト分析設定
 */
export interface CostAnalysisConfig {
  /** コスト追跡有効化 */
  enabled: boolean;
  /** レポート生成頻度 */
  reportFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  /** コスト比較ベースライン */
  baselineCostPattern?: EmbeddingArchitecturePattern;
  /** 予算アラート設定 */
  budgetAlerts?: {
    monthlyBudgetUSD: number;
    alertThresholds: number[]; // パーセンテージ
  };
}

/**
 * 段階的移行設定
 */
export interface MigrationConfig {
  /** 並行稼働期間（日） */
  parallelRunDays: number;
  /** カナリアデプロイメント設定 */
  canaryDeployment: {
    enabled: boolean;
    trafficSplitPercentages: number[]; // 例: [5, 15, 50, 100]
    evaluationPeriodMinutes: number;
    autoRollbackEnabled: boolean;
  };
  /** 検証設定 */
  validation: {
    enableResultComparison: boolean;
    samplePercentage: number;
    toleranceThreshold: number;
  };
}

/**
 * 拡張されたEmbedding設定インターフェース
 * 複数アーキテクチャパターンに対応
 */
export interface ExtendedEmbeddingConfig {
  /** アーキテクチャパターン選択 */
  pattern: EmbeddingArchitecturePattern;
  
  /** 共通設定 */
  schedule: string; // cron式（例: "0 2 * * *"）
  dockerImage: string;
  
  /** FSx ONTAP統合設定 */
  fsxMountConfig: FSxMountConfig;
  
  /** 処理制限設定 */
  processingLimits: ProcessingLimits;
  
  /** SQLite UPSERT Manager統合設定 */
  sqliteConfig: SqliteUpsertConfig;
  
  /** 監視・アラート設定 */
  monitoringConfig: MonitoringConfig;
  
  /** コスト分析設定 */
  costAnalysisConfig?: CostAnalysisConfig;
  
  /** 段階的移行設定 */
  migrationConfig?: MigrationConfig;
  
  /** パターン固有設定 */
  spotConfig?: SpotInstanceConfig;
  batchConfig?: BatchConfig;
  ecsConfig?: EcsConfig;
  
  /** 既存設定との互換性 */
  cifsdataVolName?: string;
  ragdbVolPath?: string;
  batchSize?: number;
  concurrency?: number;
  model?: string;
}

/**
 * 設定検証ユーティリティクラス
 */
export class EmbeddingConfigValidator {
  /**
   * 拡張Embedding設定の妥当性を検証
   * @param config 検証対象の設定
   * @returns エラーメッセージの配列（空の場合は妥当）
   */
  static validateExtendedEmbeddingConfig(config: ExtendedEmbeddingConfig): string[] {
    const errors: string[] = [];
    
    // 基本設定の検証
    if (!config.pattern) {
      errors.push('アーキテクチャパターンの指定が必要です');
    }
    
    if (!config.schedule) {
      errors.push('スケジュール（cron式）の指定が必要です');
    } else if (!this.isValidCronExpression(config.schedule)) {
      errors.push('無効なcron式です: ' + config.schedule);
    }
    
    if (!config.dockerImage) {
      errors.push('Dockerイメージの指定が必要です');
    }
    
    // FSx設定の検証
    if (!config.fsxMountConfig) {
      errors.push('FSx ONTAP マウント設定が必要です');
    } else {
      errors.push(...this.validateFsxMountConfig(config.fsxMountConfig));
    }
    
    // 処理制限の検証
    if (!config.processingLimits) {
      errors.push('処理制限設定が必要です');
    } else {
      errors.push(...this.validateProcessingLimits(config.processingLimits));
    }
    
    // パターン固有設定の検証
    switch (config.pattern) {
      case 'ec2-spot':
        if (!config.spotConfig) {
          errors.push('EC2 SpotパターンにはspotConfigが必要です');
        } else {
          errors.push(...this.validateSpotConfig(config.spotConfig));
        }
        break;
      case 'aws-batch':
        if (!config.batchConfig) {
          errors.push('AWS BatchパターンにはbatchConfigが必要です');
        } else {
          errors.push(...this.validateBatchConfig(config.batchConfig));
        }
        break;
      case 'ecs-ec2':
        if (!config.ecsConfig) {
          errors.push('ECS on EC2パターンにはecsConfigが必要です');
        } else {
          errors.push(...this.validateEcsConfig(config.ecsConfig));
        }
        break;
    }
    
    return errors;
  }
  
  /**
   * cron式の妥当性を検証
   */
  private static isValidCronExpression(cron: string): boolean {
    // 基本的なcron式の検証（5フィールド形式）
    const cronRegex = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([012]?\d|3[01])) (\*|([0]?\d|1[0-2])) (\*|([0-6]))$/;
    return cronRegex.test(cron);
  }
  
  /**
   * FSxマウント設定の検証
   */
  private static validateFsxMountConfig(config: FSxMountConfig): string[] {
    const errors: string[] = [];
    
    if (!config.fileSystemId) {
      errors.push('FSx ファイルシステムIDが必要です');
    }
    
    if (!config.svmId) {
      errors.push('SVM IDが必要です');
    }
    
    if (!config.volumes) {
      errors.push('ボリューム設定が必要です');
    } else {
      if (!config.volumes.documents) {
        errors.push('ドキュメントボリューム設定が必要です');
      }
      if (!config.volumes.embeddings) {
        errors.push('埋め込みボリューム設定が必要です');
      }
      if (!config.volumes.index) {
        errors.push('インデックスボリューム設定が必要です');
      }
    }
    
    return errors;
  }
  
  /**
   * 処理制限設定の検証
   */
  private static validateProcessingLimits(config: ProcessingLimits): string[] {
    const errors: string[] = [];
    
    if (config.maxFiles <= 0) {
      errors.push('最大ファイル数は1以上である必要があります');
    }
    
    if (config.maxFolders <= 0) {
      errors.push('最大フォルダー数は1以上である必要があります');
    }
    
    if (config.maxDataSizeGB <= 0) {
      errors.push('最大データサイズは1GB以上である必要があります');
    }
    
    if (config.batchSize <= 0) {
      errors.push('バッチサイズは1以上である必要があります');
    }
    
    if (config.maxParallelJobs <= 0) {
      errors.push('並列処理数は1以上である必要があります');
    }
    
    return errors;
  }
  
  /**
   * Spot設定の検証
   */
  private static validateSpotConfig(config: SpotInstanceConfig): string[] {
    const errors: string[] = [];
    
    if (!config.instanceTypes || config.instanceTypes.length === 0) {
      errors.push('インスタンスタイプの指定が必要です');
    }
    
    if (!config.availabilityZones || config.availabilityZones.length === 0) {
      errors.push('アベイラビリティゾーンの指定が必要です');
    }
    
    if (config.maxPrice && parseFloat(config.maxPrice) <= 0) {
      errors.push('最大価格は0より大きい値である必要があります');
    }
    
    return errors;
  }
  
  /**
   * Batch設定の検証
   */
  private static validateBatchConfig(config: BatchConfig): string[] {
    const errors: string[] = [];
    
    if (config.maxvCpus <= 0) {
      errors.push('最大vCPU数は1以上である必要があります');
    }
    
    if (config.minvCpus && config.minvCpus < 0) {
      errors.push('最小vCPU数は0以上である必要があります');
    }
    
    if (config.retryAttempts < 0) {
      errors.push('リトライ回数は0以上である必要があります');
    }
    
    return errors;
  }
  
  /**
   * ECS設定の検証
   */
  private static validateEcsConfig(config: EcsConfig): string[] {
    const errors: string[] = [];
    
    if (config.desiredCount <= 0) {
      errors.push('希望タスク数は1以上である必要があります');
    }
    
    if (config.cpu <= 0) {
      errors.push('CPU設定は1以上である必要があります');
    }
    
    if (config.memory <= 0) {
      errors.push('メモリ設定は1以上である必要があります');
    }
    
    return errors;
  }
}

/**
 * デフォルト設定値
 */
export const DEFAULT_EXTENDED_EMBEDDING_CONFIG: Partial<ExtendedEmbeddingConfig> = {
  pattern: 'ec2-ondemand',
  schedule: '0 2 * * *', // 毎日午前2時
  processingLimits: {
    maxFiles: 10000,
    maxFolders: 1000,
    maxDataSizeGB: 100,
    batchSize: 1000,
    maxParallelJobs: 10,
    memoryLimitMB: 8192,
    diskLimitGB: 50
  },
  sqliteConfig: {
    retryConfig: {
      maxRetries: 3,
      backoffMs: 1000,
      exponentialBackoff: true
    },
    transactionConfig: {
      batchSize: 100,
      timeoutMs: 30000
    },
    monitoringConfig: {
      enableMetrics: true,
      enableDetailedLogs: true,
      metricsNamespace: 'FSxONTAP/EmbeddingServer'
    }
  },
  monitoringConfig: {
    cloudWatch: {
      namespace: 'FSxONTAP/EmbeddingServer',
      metrics: ['JobDuration', 'FilesProcessed', 'ErrorRate', 'CostPerJob'],
      retentionDays: 30
    },
    alerts: {
      jobFailureThreshold: 3,
      executionTimeThresholdMinutes: 120,
      errorRateThreshold: 0.05
    },
    dashboard: {
      enabled: true,
      name: 'EmbeddingServerDashboard'
    }
  },
  costAnalysisConfig: {
    enabled: true,
    reportFrequency: 'MONTHLY',
    baselineCostPattern: 'ec2-ondemand'
  }
};

/**
 * 型ガード関数群
 */
export function isExtendedEmbeddingConfig(obj: any): obj is ExtendedEmbeddingConfig {
  return obj && 
         typeof obj.pattern === 'string' && 
         typeof obj.schedule === 'string' &&
         typeof obj.dockerImage === 'string';
}

export function hasSpotConfig(config: ExtendedEmbeddingConfig): config is ExtendedEmbeddingConfig & { spotConfig: SpotInstanceConfig } {
  return config.pattern === 'ec2-spot' && config.spotConfig !== undefined;
}

export function hasBatchConfig(config: ExtendedEmbeddingConfig): config is ExtendedEmbeddingConfig & { batchConfig: BatchConfig } {
  return config.pattern === 'aws-batch' && config.batchConfig !== undefined;
}

export function hasEcsConfig(config: ExtendedEmbeddingConfig): config is ExtendedEmbeddingConfig & { ecsConfig: EcsConfig } {
  return config.pattern === 'ecs-ec2' && config.ecsConfig !== undefined;
}

// === 環境変数パーサーとコンフィグマネージャー ===
/**
 * FSx for NetApp ONTAP Embedding Server Architecture Upgrade
 * 環境変数パーサーとコンフィグマネージャー実装
 */

