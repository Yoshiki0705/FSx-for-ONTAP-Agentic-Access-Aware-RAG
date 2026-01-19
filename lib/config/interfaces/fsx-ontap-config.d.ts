/**
 * FSx for ONTAP設定インターフェース
 * アカウント非依存・オプション方式対応
 */
export interface FSxONTAPConfig {
    enabled: boolean;
    fileSystem: FSxONTAPFileSystemConfig;
    s3AccessPoints: FSxONTAPS3AccessPointsConfig;
    tiering: FSxONTAPTieringConfig;
    performance: FSxONTAPPerformanceConfig;
    monitoring: FSxONTAPMonitoringConfig;
    security: FSxONTAPSecurityConfig;
    backup: FSxONTAPBackupConfig;
    networking: FSxONTAPNetworkingConfig;
    costOptimization: FSxONTAPCostOptimizationConfig;
}
export interface FSxONTAPFileSystemConfig {
    storageCapacity: number;
    throughputCapacity: number;
    deploymentType: 'SINGLE_AZ_1' | 'SINGLE_AZ_2' | 'MULTI_AZ_1' | 'MULTI_AZ_2';
    preferredSubnetId?: string;
    routeTableIds?: string[];
    autoDetectNetworking: boolean;
    autoConfigureRouting: boolean;
    autoScaling: {
        enabled: boolean;
        minCapacity: number;
        maxCapacity: number;
        targetUtilization: number;
    };
}
export interface FSxONTAPS3AccessPointsConfig {
    enabled: boolean;
    accessPoints: FSxONTAPAccessPointConfig[];
    autoCreateAccessPoints: boolean;
    accessPointNamingPattern: string;
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
    policy?: any;
    vpcConfiguration?: {
        vpcId?: string;
        policyStatus?: 'Enabled' | 'Disabled';
    };
}
export interface FSxONTAPTieringConfig {
    enabled: boolean;
    policies: FSxONTAPTieringPolicyConfig[];
    autoTiering: {
        enabled: boolean;
        coolingPeriod: number;
        tieringMode: 'AUTO' | 'SNAPSHOT_ONLY' | 'ALL';
    };
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
    minFileSize?: number;
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
    monitoring: {
        enabled: boolean;
        metricsCollection: boolean;
        detailedMonitoring: boolean;
    };
    autoOptimization: {
        enabled: boolean;
        throughputOptimization: boolean;
        storageOptimization: boolean;
        performanceMode: 'BALANCED' | 'PERFORMANCE' | 'COST_OPTIMIZED';
    };
    cache: {
        enabled: boolean;
        size: number;
        type: 'READ' | 'WRITE' | 'READ_WRITE';
    };
}
export interface FSxONTAPMonitoringConfig {
    cloudWatch: {
        enabled: boolean;
        customMetrics: boolean;
        dashboardEnabled: boolean;
        alarmEnabled: boolean;
    };
    alarms: FSxONTAPAlarmConfig[];
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
        sns?: string;
        lambda?: string;
        autoScaling?: boolean;
    };
}
export interface FSxONTAPSecurityConfig {
    encryption: {
        atRest: boolean;
        inTransit: boolean;
        kmsKeyId?: string;
    };
    accessControl: {
        iamRoles: string[];
        securityGroups: string[];
        nacls: string[];
    };
    activeDirectory?: {
        enabled: boolean;
        domainName?: string;
        dnsIps?: string[];
        organizationalUnitDistinguishedName?: string;
        fileSystemAdministratorsGroup?: string;
    };
}
export interface FSxONTAPBackupConfig {
    automaticBackup: {
        enabled: boolean;
        retentionDays: number;
        startTime: string;
        copyTagsToBackups: boolean;
    };
    manualBackup: {
        enabled: boolean;
        retentionDays: number;
        copyTagsToBackups: boolean;
    };
    crossRegionBackup?: {
        enabled: boolean;
        destinationRegion: string;
        retentionDays: number;
    };
}
export interface FSxONTAPNetworkingConfig {
    vpc: {
        autoDetect: boolean;
        vpcId?: string;
        subnetIds?: string[];
        securityGroupIds?: string[];
    };
    dns: {
        autoConfigureDns: boolean;
        dnsName?: string;
    };
    routing: {
        autoConfigureRouting: boolean;
        routeTableIds?: string[];
    };
}
export interface FSxONTAPCostOptimizationConfig {
    costMonitoring: {
        enabled: boolean;
        budgetAlerts: boolean;
        monthlyBudget?: number;
    };
    autoOptimization: {
        enabled: boolean;
        storageOptimization: boolean;
        performanceOptimization: boolean;
        scheduleOptimization: boolean;
    };
    usageAnalysis: {
        enabled: boolean;
        reportingEnabled: boolean;
        recommendationsEnabled: boolean;
    };
}
export declare const FSxONTAPPresets: {
    development: Partial<FSxONTAPConfig>;
    production: Partial<FSxONTAPConfig>;
};
