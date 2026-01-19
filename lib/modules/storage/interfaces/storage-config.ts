/**
 * ストレージモジュール設定インターフェース
 * 
 * 機能:
 * - S3・FSx設定の型定義
 * - バックアップ・ライフサイクル・レプリケーション設定
 * - パフォーマンス・セキュリティ設定
 */

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as fsx from 'aws-cdk-lib/aws-fsx';

/**
 * S3バケット個別設定（environment-config.ts互換性のため）
 */
export interface S3BucketConfig {
  enabled?: boolean;
  bucketName?: string;
  encryption?: boolean;
  versioning?: boolean;
}

/**
 * S3設定
 */
export interface S3Config {
  /** 暗号化設定 */
  readonly encryption: S3EncryptionConfig;
  
  /** バージョニング有効化 */
  readonly versioning: boolean;
  
  /** ライフサイクル設定 */
  readonly lifecycle: S3LifecycleConfig;
  
  /** クロスリージョンレプリケーション */
  readonly crossRegionReplication?: S3ReplicationConfig;
  
  /** アクセスログ */
  readonly accessLogging?: S3AccessLoggingConfig;
  
  /** 通知設定 */
  readonly notifications?: S3NotificationConfig;
  
  /** パブリックアクセス設定 */
  readonly publicAccess?: S3PublicAccessConfig;
  
  /** カスタムバケット */
  readonly customBuckets?: S3CustomBucket[];
  
  /** ドキュメントバケット設定（environment-config.ts互換性のため） */
  readonly documents?: S3BucketConfig;
  
  /** バックアップバケット設定（environment-config.ts互換性のため） */
  readonly backup?: S3BucketConfig;
  
  /** 埋め込みバケット設定（environment-config.ts互換性のため） */
  readonly embeddings?: S3BucketConfig;
}

/**
 * S3暗号化設定
 */
export interface S3EncryptionConfig {
  /** 暗号化有効化 */
  readonly enabled: boolean;
  
  /** KMS管理暗号化 */
  readonly kmsManaged: boolean;
  
  /** カスタムKMSキーARN */
  readonly customKmsKeyArn?: string;
  
  /** バケットキー使用 */
  readonly bucketKeyEnabled?: boolean;
}

/**
 * S3ライフサイクル設定
 */
export interface S3LifecycleConfig {
  /** ライフサイクル有効化 */
  readonly enabled: boolean;
  
  /** IA移行日数 */
  readonly transitionToIA?: number;
  
  /** Glacier移行日数 */
  readonly transitionToGlacier?: number;
  
  /** Deep Archive移行日数 */
  readonly transitionToDeepArchive?: number;
  
  /** 削除日数 */
  readonly deleteAfter?: number;
  
  /** 不完全マルチパートアップロード削除日数 */
  readonly abortIncompleteMultipartUpload?: number;
  
  /** カスタムルール */
  readonly customRules?: S3LifecycleRule[];
}

/**
 * S3ライフサイクルルール
 */
export interface S3LifecycleRule {
  /** ルール名 */
  readonly ruleName: string;
  
  /** プレフィックス */
  readonly prefix?: string;
  
  /** タグフィルター */
  readonly tagFilters?: Record<string, string>;
  
  /** 移行設定 */
  readonly transitions: S3LifecycleTransition[];
  
  /** 削除設定 */
  readonly expiration?: number;
}

/**
 * S3ライフサイクル移行設定
 */
export interface S3LifecycleTransition {
  /** 移行日数 */
  readonly days: number;
  
  /** ストレージクラス */
  readonly storageClass: s3.StorageClass;
}

/**
 * S3レプリケーション設定
 */
export interface S3ReplicationConfig {
  /** レプリケーション有効化 */
  readonly enabled: boolean;
  
  /** 送信先リージョン */
  readonly destinationRegion: string;
  
  /** 送信先バケット名 */
  readonly destinationBucketName?: string;
  
  /** レプリケーションロールARN */
  readonly replicationRoleArn?: string;
  
  /** プレフィックスフィルター */
  readonly prefixFilter?: string;
  
  /** ストレージクラス */
  readonly storageClass?: s3.StorageClass;
}

/**
 * S3アクセスログ設定
 */
export interface S3AccessLoggingConfig {
  /** アクセスログ有効化 */
  readonly enabled: boolean;
  
  /** ログバケット名 */
  readonly logBucketName?: string;
  
  /** ログプレフィックス */
  readonly logPrefix?: string;
}

/**
 * S3通知設定
 */
export interface S3NotificationConfig {
  /** Lambda通知 */
  readonly lambda?: S3LambdaNotification[];
  
  /** SNS通知 */
  readonly sns?: S3SnsNotification[];
  
  /** SQS通知 */
  readonly sqs?: S3SqsNotification[];
}

/**
 * S3 Lambda通知設定
 */
export interface S3LambdaNotification {
  /** Lambda関数ARN */
  readonly functionArn: string;
  
  /** イベントタイプ */
  readonly events: s3.EventType[];
  
  /** フィルター */
  readonly filters?: s3.NotificationKeyFilter[];
}

/**
 * S3 SNS通知設定
 */
export interface S3SnsNotification {
  /** SNSトピックARN */
  readonly topicArn: string;
  
  /** イベントタイプ */
  readonly events: s3.EventType[];
  
  /** フィルター */
  readonly filters?: s3.NotificationKeyFilter[];
}

/**
 * S3 SQS通知設定
 */
export interface S3SqsNotification {
  /** SQSキューARN */
  readonly queueArn: string;
  
  /** イベントタイプ */
  readonly events: s3.EventType[];
  
  /** フィルター */
  readonly filters?: s3.NotificationKeyFilter[];
}

/**
 * S3パブリックアクセス設定
 */
export interface S3PublicAccessConfig {
  /** パブリック読み取りアクセス拒否 */
  readonly blockPublicRead: boolean;
  
  /** パブリック書き込みアクセス拒否 */
  readonly blockPublicWrite: boolean;
  
  /** パブリックACL拒否 */
  readonly blockPublicAcls: boolean;
  
  /** パブリックポリシー拒否 */
  readonly restrictPublicBuckets: boolean;
}

/**
 * S3カスタムバケット
 */
export interface S3CustomBucket {
  /** バケット名 */
  readonly bucketName: string;
  
  /** 用途 */
  readonly purpose: string;
  
  /** 暗号化設定 */
  readonly encryption?: S3EncryptionConfig;
  
  /** バージョニング */
  readonly versioning?: boolean;
  
  /** ライフサイクル設定 */
  readonly lifecycle?: S3LifecycleConfig;
  
  /** CORS設定 */
  readonly cors?: s3.CorsRule[];
}

/**
 * FSx for ONTAP S3 Access Point設定
 */
export interface FsxOntapS3AccessPointConfig {
  /** S3 Access Point有効化 */
  readonly enabled: boolean;
  
  /** 
   * S3 Access Point名（オプション）
   * 指定しない場合は自動生成: {projectName}-{environment}-gateway-specs-ap
   */
  readonly name?: string;
  
  /** ファイルシステムユーザーID設定 */
  readonly fileSystemIdentity: {
    /** ユーザータイプ: UNIX or WINDOWS */
    readonly type: 'UNIX' | 'WINDOWS';
    
    /** UNIXユーザー設定（type='UNIX'の場合） */
    readonly unixUser?: {
      /** UNIXユーザー名（例: 'ec2-user', 'root'） */
      readonly name: string;
    };
    
    /** Windowsユーザー設定（type='WINDOWS'の場合） */
    readonly windowsUser?: {
      /** Windowsユーザー名（例: 'Administrator'） */
      readonly name: string;
    };
  };
  
  /** ネットワーク設定（オプション） */
  readonly networkConfiguration?: {
    /** VPC制限を有効化するか */
    readonly vpcRestricted: boolean;
    
    /** VPC ID（vpcRestricted=trueの場合は必須） */
    readonly vpcId?: string;
  };
  
  /** IAMポリシー設定（オプション） */
  readonly iamPolicy?: {
    /** IAMポリシーを有効化するか */
    readonly enabled: boolean;
    
    /** 許可するIAMプリンシパル（IAM Role ARNs） */
    readonly allowedPrincipals?: string[];
    
    /** 許可するS3アクション（例: ['s3:GetObject', 's3:ListBucket']） */
    readonly allowedActions?: string[];
  };
}

/**
 * FSx設定
 */
export interface FsxConfig {
  /** FSx有効化 */
  readonly enabled: boolean;
  
  /** ファイルシステムタイプ */
  readonly fileSystemType: 'ONTAP' | 'WINDOWS' | 'OPENZFS';
  
  /** ストレージ容量（GB） */
  readonly storageCapacity: number;
  
  /** スループット容量（MB/s） */
  readonly throughputCapacity: number;
  
  /** マルチAZ展開 */
  readonly multiAz?: boolean;
  
  /** バックアップ設定 */
  readonly backup?: FsxBackupConfig;
  
  /** ONTAP固有設定 */
  readonly ontapConfig?: FsxOntapConfig;
  
  /** S3 Access Point設定（FSx for ONTAP専用） */
  readonly s3AccessPoint?: FsxOntapS3AccessPointConfig;
  
  // storage-construct.ts互換性のための追加プロパティ
  /** 自動バックアップ保持期間（日） */
  readonly automaticBackupRetentionDays?: number;
  
  /** バックアップ無効化確認フラグ */
  readonly disableBackupConfirmed?: boolean;
  
  /** デプロイメントタイプ */
  readonly deploymentType?: 'SINGLE_AZ_1' | 'MULTI_AZ_1';
  
  /** 優先サブネットID */
  readonly preferredSubnetId?: string;
  
  /** ルートテーブルID */
  readonly routeTableIds?: string[];
  
  /** 日次自動バックアップ開始時刻 */
  readonly dailyAutomaticBackupStartTime?: string;
  
  /** 週次メンテナンス開始時刻 */
  readonly weeklyMaintenanceStartTime?: string;
  
  /** ディスクIOPS設定 */
  readonly diskIopsConfiguration?: any;
  
  /** ファイルシステム名 */
  readonly fileSystemName?: string;
  
  /** SVM設定 */
  readonly svm?: {
    name?: string;
    rootVolumeSecurityStyle?: string;
    activeDirectoryConfiguration?: any;
  };
  
  /** ボリューム設定 */
  readonly volumes?: {
    data?: {
      enabled: boolean;
      name?: string;
      junctionPath?: string;
      sizeInMegabytes?: number;
      storageEfficiencyEnabled?: boolean;
      securityStyle?: string;
    };
    database?: {
      enabled: boolean;
      name?: string;
      junctionPath?: string;
      sizeInMegabytes?: number;
      storageEfficiencyEnabled?: boolean;
      securityStyle?: string;
    };
  };
}

/**
 * FSxバックアップ設定
 */
export interface FsxBackupConfig {
  /** 自動バックアップ有効化 */
  readonly automaticBackup: boolean;
  
  /** 
   * バックアップ保持期間（日）
   * デフォルト: 0（自動バックアップ無効）
   * 範囲: 0-90日
   * 注意: 0に設定すると自動バックアップが無効化されます
   */
  readonly retentionDays?: number;
  
  /** 
   * バックアップウィンドウ（HH:MM形式）
   * 例: "01:00"
   * 注意: retentionDaysが0の場合は無視されます
   */
  readonly backupWindow?: string;
  
  /** 
   * メンテナンスウィンドウ（d:HH:MM形式）
   * 例: "1:01:00"（月曜日の午前1時）
   */
  readonly maintenanceWindow?: string;
  
  /**
   * 本番環境でのバックアップ無効化確認フラグ
   * 本番環境でretentionDays=0を設定する場合、このフラグをtrueにする必要があります
   */
  readonly disableBackupConfirmed?: boolean;
}

/**
 * FSx ONTAP設定
 */
export interface FsxOntapConfig {
  /** デプロイメントタイプ */
  readonly deploymentType: 'MULTI_AZ_1' | 'SINGLE_AZ_1';
  
  /** 優先サブネット */
  readonly preferredSubnetId?: string;
  
  /** ルートボリューム設定 */
  readonly rootVolumeConfig?: FsxOntapVolumeConfig;
  
  /** SVM設定 */
  readonly svmConfig?: FsxOntapSvmConfig[];
}

/**
 * FSx ONTAPボリューム設定
 */
export interface FsxOntapVolumeConfig {
  /** ボリューム名 */
  readonly volumeName: string;
  
  /** サイズ（GB） */
  readonly sizeInGb: number;
  
  /** セキュリティスタイル */
  readonly securityStyle: 'UNIX' | 'NTFS' | 'MIXED';
  
  /** ストレージ効率化 */
  readonly storageEfficiencyEnabled?: boolean;
}

/**
 * FSx ONTAP SVM設定
 */
export interface FsxOntapSvmConfig {
  /** SVM名 */
  readonly svmName: string;
  
  /** ルートボリューム設定 */
  readonly rootVolumeConfig: FsxOntapVolumeConfig;
  
  /** Active Directory設定 */
  readonly activeDirectoryConfig?: FsxActiveDirectoryConfig;
}

/**
 * FSx Active Directory設定
 */
export interface FsxActiveDirectoryConfig {
  /** ドメイン名 */
  readonly domainName: string;
  
  /** DNS IP */
  readonly dnsIps: string[];
  
  /** 管理者ユーザー名 */
  readonly adminUsername: string;
  
  /** 管理者パスワード */
  readonly adminPassword: string;
}


/**
 * ストレージ統合設定
 * 
 * アーキテクチャ原則:
 * - FSx for ONTAPを主要ストレージとして使用
 * - S3 Access Points経由でFSx for ONTAPにアクセス
 * - S3は最小限の使用（CloudFrontログ、バックアップ等）
 * - EFSは使用しない（FSx for ONTAPに統合）
 */
export interface StorageConfig {
  /** S3設定（オプション - FSx for ONTAP + S3 Access Pointsを推奨） */
  readonly s3?: S3Config;
  
  /** FSx設定 */
  readonly fsx: FsxConfig;
  
  /** FSx ONTAP設定（environment-config.ts互換性のため） */
  readonly fsxOntap?: FsxConfig;
  
  /** Gateway Construct用S3バケット設定 */
  readonly gateway?: {
    /**
     * Gateway機能を有効化するか
     * @default false
     */
    readonly enabled?: boolean;
    
    /**
     * OpenAPI仕様ファイルのデプロイ設定
     * @default true
     */
    readonly deploySpecs?: boolean;
    
    /**
     * バケット名プレフィックス（オプション）
     * 指定しない場合は {projectName}-{environment}-gateway-specs
     */
    readonly bucketNamePrefix?: string;
  };
  
  /** バックアップ設定 */
  readonly backup?: StorageBackupConfig;
  
  /** 監視設定 */
  readonly monitoring?: StorageMonitoringConfig;
  
  /** コスト最適化 */
  readonly costOptimization?: StorageCostOptimizationConfig;
  
  /** タグ設定 */
  readonly tags?: Record<string, string>;
}

/**
 * ストレージバックアップ設定
 */
export interface StorageBackupConfig {
  /** AWS Backup有効化 */
  readonly awsBackup: boolean;
  
  /** バックアップ計画 */
  readonly backupPlans?: StorageBackupPlan[];
  
  /** クロスリージョンバックアップ */
  readonly crossRegionBackup?: boolean;
}

/**
 * ストレージバックアップ計画
 */
export interface StorageBackupPlan {
  /** 計画名 */
  readonly planName: string;
  
  /** バックアップルール */
  readonly rules: StorageBackupRule[];
  
  /** 対象リソース */
  readonly resources: string[];
}

/**
 * ストレージバックアップルール
 */
export interface StorageBackupRule {
  /** ルール名 */
  readonly ruleName: string;
  
  /** スケジュール */
  readonly schedule: string;
  
  /** 保持期間（日） */
  readonly retentionDays: number;
  
  /** コールドストレージ移行日数 */
  readonly moveToColdStorageAfterDays?: number;
}

/**
 * ストレージ監視設定
 */
export interface StorageMonitoringConfig {
  /** CloudWatchメトリクス */
  readonly cloudWatchMetrics: boolean;
  
  /** アラート設定 */
  readonly alerts?: StorageAlertConfig[];
  
  /** コスト監視 */
  readonly costMonitoring?: boolean;
}

/**
 * ストレージアラート設定
 */
export interface StorageAlertConfig {
  /** メトリクス名 */
  readonly metricName: string;
  
  /** 閾値 */
  readonly threshold: number;
  
  /** 比較演算子 */
  readonly comparisonOperator: string;
  
  /** 通知先 */
  readonly notificationTargets: string[];
}

/**
 * ストレージコスト最適化設定
 */
export interface StorageCostOptimizationConfig {
  /** インテリジェント階層化 */
  readonly intelligentTiering: boolean;
  
  /** 使用量分析 */
  readonly usageAnalytics?: boolean;
  
  /** 推奨事項 */
  readonly recommendations?: boolean;
}
/**
 * ストレージコンストラクト出力
 */
export interface StorageOutputs {
  /** ドキュメントバケット */
  readonly documentsBucket?: s3.IBucket;
  readonly documentsBucketName?: string;
  readonly documentsBucketArn?: string;
  
  /** バックアップバケット */
  readonly backupBucket?: s3.IBucket;
  readonly backupBucketName?: string;
  readonly backupBucketArn?: string;
  
  /** 埋め込みバケット */
  readonly embeddingsBucket?: s3.IBucket;
  readonly embeddingsBucketName?: string;
  readonly embeddingsBucketArn?: string;
  
  /** S3バケット（data-stack.ts互換性） */
  readonly s3Buckets?: {
    documents?: s3.IBucket;
    backup?: s3.IBucket;
    embeddings?: s3.IBucket;
  };
  
  /** FSxファイルシステム */
  readonly fsxFileSystem?: fsx.CfnFileSystem;
  readonly fsxFileSystemId?: string;
  readonly fsxFileSystemArn?: string;
  readonly fsxFileSystemDnsName?: string;
  
  /** FSx SVM */
  readonly fsxSvm?: fsx.CfnStorageVirtualMachine;
  readonly fsxSvmId?: string;
  
  /** FSxデータボリューム */
  readonly fsxDataVolume?: fsx.CfnVolume;
  readonly fsxDataVolumeId?: string;
  
  /** FSxデータベースボリューム */
  readonly fsxDatabaseVolume?: fsx.CfnVolume;
  readonly fsxDatabaseVolumeId?: string;
  
  /** FSx Gateway Specsボリューム */
  readonly fsxGatewayVolume?: fsx.CfnVolume;
  readonly fsxGatewayVolumeId?: string;
  
  /** FSx S3 Access Point */
  readonly fsxS3AccessPoint?: fsx.CfnS3AccessPointAttachment;
  readonly fsxS3AccessPointArn?: string;
  readonly fsxS3AccessPointAlias?: string;
  readonly fsxS3AccessPointName?: string;
  
}
