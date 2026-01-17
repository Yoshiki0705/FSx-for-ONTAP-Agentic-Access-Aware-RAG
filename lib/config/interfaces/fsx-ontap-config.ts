/**
 * FSx for ONTAP設定インターフェース
 * アカウント非依存・オプション方式対応
 */

export interface FSxONTAPConfig {
  // 基本設定
  enabled: boolean;
  
  // ファイルシステム設定
  fileSystem: FSxONTAPFileSystemConfig;
  
  // S3 Access Points設定
  s3AccessPoints: FSxONTAPS3AccessPointsConfig;
  
  // 階層化ストレージ設定
  tiering: FSxONTAPTieringConfig;
  
  // パフォーマンス設定
  performance: FSxONTAPPerformanceConfig;
  
  // 監視設定
  monitoring: FSxONTAPMonitoringConfig;
  
  // セキュリティ設定
  security: FSxONTAPSecurityConfig;
  
  // バックアップ設定
  backup: FSxONTAPBackupConfig;
  
  // ネットワーク設定
  networking: FSxONTAPNetworkingConfig;
  
  // コスト最適化設定
  costOptimization: FSxONTAPCostOptimizationConfig;
}

export interface FSxONTAPFileSystemConfig {
  // 基本設定
  storageCapacity: number; // GB単位
  throughputCapacity: number; // MB/s単位
  deploymentType: 'SINGLE_AZ_1' | 'SINGLE_AZ_2' | 'MULTI_AZ_1' | 'MULTI_AZ_2';
  
  // 可用性設定
  preferredSubnetId?: string; // 自動検出可能
  routeTableIds?: string[]; // 自動検出可能
  
  // 自動設定オプション
  autoDetectNetworking: boolean; // VPC/サブネット自動検出
  autoConfigureRouting: boolean; // ルーティング自動設定
  
  // スケーリング設定
  autoScaling: {
    enabled: boolean;
    minCapacity: number;
    maxCapacity: number;
    targetUtilization: number; // パーセンテージ
  };
}

export interface FSxONTAPS3AccessPointsConfig {
  enabled: boolean;
  
  // Access Point設定
  accessPoints: FSxONTAPAccessPointConfig[];
  
  // 自動設定
  autoCreateAccessPoints: boolean;
  accessPointNamingPattern: string; // 例: "${projectName}-${environment}-${purpose}"
  
  // セキュリティ設定
  publicAccessBlock: {
    blockPublicAcls: boolean;
    blockPublicPolicy: boolean;
    ignorePublicAcls: boolean;
    restrictPublicBuckets: boolean;
  };
}

export interface FSxONTAPAccessPointConfig {
  name: string;
  purpose: 'chat-history' | 'exports' | 'memory' | 'analytics' | 'backup';
  policy?: any; // 自動生成可能
  vpcConfiguration?: {
    vpcId?: string; // 自動検出可能
    policyStatus?: 'Enabled' | 'Disabled';
  };
}

export interface FSxONTAPTieringConfig {
  enabled: boolean;
  
  // 階層化ポリシー
  policies: FSxONTAPTieringPolicyConfig[];
  
  // 自動階層化設定
  autoTiering: {
    enabled: boolean;
    coolingPeriod: number; // 日数
    tieringMode: 'AUTO' | 'SNAPSHOT_ONLY' | 'ALL';
  };
  
  // ライフサイクル管理
  lifecycle: {
    enabled: boolean;
    rules: FSxONTAPLifecycleRuleConfig[];
  };
}

export interface FSxONTAPTieringPolicyConfig {
  name: string;
  path: string;
  coolingPeriod: number;
  tieringMode: 'AUTO' | 'SNAPSHOT_ONLY' | 'ALL';
  minFileSize?: number; // バイト単位
}

export interface FSxONTAPLifecycleRuleConfig {
  id: string;
  status: 'Enabled' | 'Disabled';
  filter?: {
    prefix?: string;
    tags?: Record<string, string>;
  };
  transitions: {
    days: number;
    storageClass: 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
  }[];
  expiration?: {
    days: number;
  };
}

export interface FSxONTAPPerformanceConfig {
  // パフォーマンス監視
  monitoring: {
    enabled: boolean;
    metricsCollection: boolean;
    detailedMonitoring: boolean;
  };
  
  // 自動最適化
  autoOptimization: {
    enabled: boolean;
    throughputOptimization: boolean;
    storageOptimization: boolean;
    performanceMode: 'BALANCED' | 'PERFORMANCE' | 'COST_OPTIMIZED';
  };
  
  // キャッシュ設定
  cache: {
    enabled: boolean;
    size: number; // GB単位
    type: 'READ' | 'WRITE' | 'READ_WRITE';
  };
}

export interface FSxONTAPMonitoringConfig {
  // CloudWatch統合
  cloudWatch: {
    enabled: boolean;
    customMetrics: boolean;
    dashboardEnabled: boolean;
    alarmEnabled: boolean;
  };
  
  // アラーム設定
  alarms: FSxONTAPAlarmConfig[];
  
  // ログ設定
  logging: {
    enabled: boolean;
    logGroups: string[];
    retentionDays: number;
  };
}

export interface FSxONTAPAlarmConfig {
  name: string;
  metricName: string;
  threshold: number;
  comparisonOperator: 'GreaterThanThreshold' | 'LessThanThreshold' | 'GreaterThanOrEqualToThreshold' | 'LessThanOrEqualToThreshold';
  evaluationPeriods: number;
  treatMissingData: 'breaching' | 'notBreaching' | 'ignore' | 'missing';
  actions: {
    sns?: string; // SNS Topic ARN
    lambda?: string; // Lambda Function ARN
    autoScaling?: boolean;
  };
}

export interface FSxONTAPSecurityConfig {
  // 暗号化設定
  encryption: {
    atRest: boolean;
    inTransit: boolean;
    kmsKeyId?: string; // 自動生成可能
  };
  
  // アクセス制御
  accessControl: {
    iamRoles: string[]; // 自動生成可能
    securityGroups: string[]; // 自動生成可能
    nacls: string[]; // 自動生成可能
  };
  
  // Active Directory統合
  activeDirectory?: {
    enabled: boolean;
    domainName?: string;
    dnsIps?: string[];
    organizationalUnitDistinguishedName?: string;
    fileSystemAdministratorsGroup?: string;
  };
}

export interface FSxONTAPBackupConfig {
  // 自動バックアップ
  automaticBackup: {
    enabled: boolean;
    retentionDays: number;
    startTime: string; // HH:MM形式
    copyTagsToBackups: boolean;
  };
  
  // 手動バックアップ
  manualBackup: {
    enabled: boolean;
    retentionDays: number;
    copyTagsToBackups: boolean;
  };
  
  // クロスリージョンバックアップ
  crossRegionBackup?: {
    enabled: boolean;
    destinationRegion: string;
    retentionDays: number;
  };
}

export interface FSxONTAPNetworkingConfig {
  // VPC設定
  vpc: {
    autoDetect: boolean;
    vpcId?: string;
    subnetIds?: string[];
    securityGroupIds?: string[];
  };
  
  // DNS設定
  dns: {
    autoConfigureDns: boolean;
    dnsName?: string;
  };
  
  // ルーティング設定
  routing: {
    autoConfigureRouting: boolean;
    routeTableIds?: string[];
  };
}

export interface FSxONTAPCostOptimizationConfig {
  // コスト監視
  costMonitoring: {
    enabled: boolean;
    budgetAlerts: boolean;
    monthlyBudget?: number;
  };
  
  // 自動最適化
  autoOptimization: {
    enabled: boolean;
    storageOptimization: boolean;
    performanceOptimization: boolean;
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
export const FSxONTAPPresets = {
  // 開発環境用（コスト重視）
  development: {
    enabled: true,
    fileSystem: {
      storageCapacity: 1024,
      throughputCapacity: 128,
      deploymentType: 'SINGLE_AZ_1' as const,
      autoDetectNetworking: true,
      autoConfigureRouting: true,
      autoScaling: {
        enabled: false,
        minCapacity: 1024,
        maxCapacity: 2048,
        targetUtilization: 80
      }
    },
    s3AccessPoints: {
      enabled: true,
      autoCreateAccessPoints: true,
      accessPointNamingPattern: "${projectName}-${environment}-${purpose}",
      accessPoints: [
        { name: 'chat-history', purpose: 'chat-history' as const },
        { name: 'exports', purpose: 'exports' as const }
      ],
      publicAccessBlock: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true
      }
    },
    tiering: {
      enabled: true,
      autoTiering: {
        enabled: true,
        coolingPeriod: 31,
        tieringMode: 'AUTO' as const
      },
      policies: [],
      lifecycle: {
        enabled: true,
        rules: [
          {
            id: 'DevelopmentLifecycle',
            status: 'Enabled' as const,
            transitions: [
              { days: 30, storageClass: 'STANDARD_IA' as const },
              { days: 90, storageClass: 'GLACIER' as const }
            ]
          }
        ]
      }
    },
    performance: {
      monitoring: {
        enabled: true,
        metricsCollection: true,
        detailedMonitoring: false
      },
      autoOptimization: {
        enabled: true,
        throughputOptimization: false,
        storageOptimization: true,
        performanceMode: 'COST_OPTIMIZED' as const
      },
      cache: {
        enabled: false,
        size: 0,
        type: 'READ' as const
      }
    }
  } as Partial<FSxONTAPConfig>,

  // 本番環境用（パフォーマンス重視）
  production: {
    enabled: true,
    fileSystem: {
      storageCapacity: 4096,
      throughputCapacity: 512,
      deploymentType: 'MULTI_AZ_1' as const,
      autoDetectNetworking: true,
      autoConfigureRouting: true,
      autoScaling: {
        enabled: true,
        minCapacity: 4096,
        maxCapacity: 16384,
        targetUtilization: 70
      }
    },
    s3AccessPoints: {
      enabled: true,
      autoCreateAccessPoints: true,
      accessPointNamingPattern: "${projectName}-${environment}-${purpose}",
      accessPoints: [
        { name: 'chat-history', purpose: 'chat-history' as const },
        { name: 'exports', purpose: 'exports' as const },
        { name: 'memory', purpose: 'memory' as const },
        { name: 'analytics', purpose: 'analytics' as const },
        { name: 'backup', purpose: 'backup' as const }
      ],
      publicAccessBlock: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true
      }
    },
    tiering: {
      enabled: true,
      autoTiering: {
        enabled: true,
        coolingPeriod: 7,
        tieringMode: 'AUTO' as const
      },
      policies: [],
      lifecycle: {
        enabled: true,
        rules: [
          {
            id: 'ProductionLifecycle',
            status: 'Enabled' as const,
            transitions: [
              { days: 30, storageClass: 'STANDARD_IA' as const },
              { days: 90, storageClass: 'GLACIER' as const },
              { days: 365, storageClass: 'DEEP_ARCHIVE' as const }
            ]
          }
        ]
      }
    },
    performance: {
      monitoring: {
        enabled: true,
        metricsCollection: true,
        detailedMonitoring: true
      },
      autoOptimization: {
        enabled: true,
        throughputOptimization: true,
        storageOptimization: true,
        performanceMode: 'PERFORMANCE' as const
      },
      cache: {
        enabled: true,
        size: 1024,
        type: 'READ_WRITE' as const
      }
    }
  } as Partial<FSxONTAPConfig>
};