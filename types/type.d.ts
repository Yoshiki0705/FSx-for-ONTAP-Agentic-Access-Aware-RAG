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
/**
 * FSx for NetApp ONTAP Embedding Server Architecture Upgrade
 * 複数アーキテクチャパターン対応の設定インターフェース定義
 */
/**
 * アーキテクチャパターンの種類
 */
export type EmbeddingArchitecturePattern = 'ec2-ondemand' | 'ec2-spot' | 'aws-batch' | 'ecs-ec2';
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
        alertThresholds: number[];
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
        trafficSplitPercentages: number[];
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
    schedule: string;
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
export declare class EmbeddingConfigValidator {
    /**
     * 拡張Embedding設定の妥当性を検証
     * @param config 検証対象の設定
     * @returns エラーメッセージの配列（空の場合は妥当）
     */
    static validateExtendedEmbeddingConfig(config: ExtendedEmbeddingConfig): string[];
    /**
     * cron式の妥当性を検証
     */
    private static isValidCronExpression;
    /**
     * FSxマウント設定の検証
     */
    private static validateFsxMountConfig;
    /**
     * 処理制限設定の検証
     */
    private static validateProcessingLimits;
    /**
     * Spot設定の検証
     */
    private static validateSpotConfig;
    /**
     * Batch設定の検証
     */
    private static validateBatchConfig;
    /**
     * ECS設定の検証
     */
    private static validateEcsConfig;
}
/**
 * デフォルト設定値
 */
export declare const DEFAULT_EXTENDED_EMBEDDING_CONFIG: Partial<ExtendedEmbeddingConfig>;
/**
 * 型ガード関数群
 */
export declare function isExtendedEmbeddingConfig(obj: any): obj is ExtendedEmbeddingConfig;
export declare function hasSpotConfig(config: ExtendedEmbeddingConfig): config is ExtendedEmbeddingConfig & {
    spotConfig: SpotInstanceConfig;
};
export declare function hasBatchConfig(config: ExtendedEmbeddingConfig): config is ExtendedEmbeddingConfig & {
    batchConfig: BatchConfig;
};
export declare function hasEcsConfig(config: ExtendedEmbeddingConfig): config is ExtendedEmbeddingConfig & {
    ecsConfig: EcsConfig;
};
/**
 * FSx for NetApp ONTAP Embedding Server Architecture Upgrade
 * 環境変数パーサーとコンフィグマネージャー実装
 */
