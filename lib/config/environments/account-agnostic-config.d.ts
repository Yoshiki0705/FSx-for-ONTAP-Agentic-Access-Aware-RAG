/**
 * アカウント非依存設定
 * どのAWSアカウントでも再現可能な設定を提供
 */
import { EnvironmentConfig } from '../interfaces/environment-config';
/**
 * 基本設定テンプレート
 * アカウントIDやリージョンに依存しない設定
 */
export declare const BaseAccountAgnosticConfig: Partial<EnvironmentConfig>;
/**
 * 環境別設定テンプレート
 */
export declare const EnvironmentTemplates: {
    development: EnvironmentConfig;
    staging: EnvironmentConfig;
    production: EnvironmentConfig;
};
/**
 * 機能別オプション設定
 * ユーザーが個別に有効化/無効化できる機能の設定
 */
export declare const FeatureOptions: {
    fsxOntapIntegration: {
        minimal: {
            enabled: boolean;
            fileSystem: {
                storageCapacity: number;
                throughputCapacity: number;
                deploymentType: "SINGLE_AZ_1";
                autoDetectNetworking: boolean;
                autoConfigureRouting: boolean;
                autoScaling: {
                    enabled: boolean;
                    minCapacity: number;
                    maxCapacity: number;
                    targetUtilization: number;
                };
            };
            s3AccessPoints: {
                enabled: boolean;
                autoCreateAccessPoints: boolean;
                accessPointNamingPattern: string;
                accessPoints: {
                    name: string;
                    purpose: "chat-history";
                }[];
            };
            tiering: {
                enabled: boolean;
            };
            performance: {
                monitoring: {
                    enabled: boolean;
                    metricsCollection: boolean;
                    detailedMonitoring: boolean;
                };
                autoOptimization: {
                    enabled: boolean;
                    throughputOptimization: boolean;
                    storageOptimization: boolean;
                    performanceMode: "COST_OPTIMIZED";
                };
                cache: {
                    enabled: boolean;
                    size: number;
                    type: "READ";
                };
            };
        };
        standard: {
            enabled: boolean;
            fileSystem?: import("../interfaces/fsx-ontap-config").FSxONTAPFileSystemConfig;
            s3AccessPoints?: import("../interfaces/fsx-ontap-config").FSxONTAPS3AccessPointsConfig;
            tiering?: import("../interfaces/fsx-ontap-config").FSxONTAPTieringConfig;
            performance?: import("../interfaces/fsx-ontap-config").FSxONTAPPerformanceConfig;
            monitoring?: import("../interfaces/fsx-ontap-config").FSxONTAPMonitoringConfig;
            security?: import("../interfaces/fsx-ontap-config").FSxONTAPSecurityConfig;
            backup?: import("../interfaces/fsx-ontap-config").FSxONTAPBackupConfig;
            networking?: import("../interfaces/fsx-ontap-config").FSxONTAPNetworkingConfig;
            costOptimization?: import("../interfaces/fsx-ontap-config").FSxONTAPCostOptimizationConfig;
        };
        advanced: {
            enabled: boolean;
            fileSystem?: import("../interfaces/fsx-ontap-config").FSxONTAPFileSystemConfig;
            s3AccessPoints?: import("../interfaces/fsx-ontap-config").FSxONTAPS3AccessPointsConfig;
            tiering?: import("../interfaces/fsx-ontap-config").FSxONTAPTieringConfig;
            performance?: import("../interfaces/fsx-ontap-config").FSxONTAPPerformanceConfig;
            monitoring?: import("../interfaces/fsx-ontap-config").FSxONTAPMonitoringConfig;
            security?: import("../interfaces/fsx-ontap-config").FSxONTAPSecurityConfig;
            backup?: import("../interfaces/fsx-ontap-config").FSxONTAPBackupConfig;
            networking?: import("../interfaces/fsx-ontap-config").FSxONTAPNetworkingConfig;
            costOptimization?: import("../interfaces/fsx-ontap-config").FSxONTAPCostOptimizationConfig;
        };
    };
    serverlessIntegration: {
        minimal: {
            enabled: boolean;
            stepFunctions: {
                enabled: boolean;
            };
            eventBridge: {
                enabled: boolean;
                customEventBus: {
                    enabled: boolean;
                };
                rules: any[];
                schedules: any[];
            };
            sqs: {
                enabled: boolean;
                queues: {
                    name: string;
                    purpose: "chat-processing";
                    enabled: boolean;
                    configuration: {
                        visibilityTimeoutSeconds: number;
                        messageRetentionPeriod: number;
                        maxReceiveCount: number;
                    };
                    encryption: {
                        enabled: boolean;
                    };
                }[];
            };
            sns: {
                enabled: boolean;
            };
            lambda: {
                common: {
                    runtime: string;
                    timeout: number;
                    memorySize: number;
                    enableXRayTracing: boolean;
                    enableDeadLetterQueue: boolean;
                };
                functions: any[];
                layers: any[];
                environment: {
                    autoInject: boolean;
                    variables: {};
                };
            };
        };
        standard: {
            enabled: boolean;
            stepFunctions?: import("../interfaces/serverless-config").StepFunctionsConfig;
            eventBridge?: import("../interfaces/serverless-config").EventBridgeConfig;
            sqs?: import("../interfaces/serverless-config").SQSConfig;
            sns?: import("../interfaces/serverless-config").SNSConfig;
            lambda?: import("../interfaces/serverless-config").ServerlessLambdaConfig;
            monitoring?: import("../interfaces/serverless-config").ServerlessMonitoringConfig;
            errorHandling?: import("../interfaces/serverless-config").ServerlessErrorHandlingConfig;
            costOptimization?: import("../interfaces/serverless-config").ServerlessCostOptimizationConfig;
        };
        advanced: {
            enabled: boolean;
            stepFunctions?: import("../interfaces/serverless-config").StepFunctionsConfig;
            eventBridge?: import("../interfaces/serverless-config").EventBridgeConfig;
            sqs?: import("../interfaces/serverless-config").SQSConfig;
            sns?: import("../interfaces/serverless-config").SNSConfig;
            lambda?: import("../interfaces/serverless-config").ServerlessLambdaConfig;
            monitoring?: import("../interfaces/serverless-config").ServerlessMonitoringConfig;
            errorHandling?: import("../interfaces/serverless-config").ServerlessErrorHandlingConfig;
            costOptimization?: import("../interfaces/serverless-config").ServerlessCostOptimizationConfig;
        };
    };
    performanceOptimization: {
        disabled: {
            enabled: boolean;
        };
        basic: {
            enabled: boolean;
            monitoring: boolean;
            autoOptimization: boolean;
            caching: boolean;
        };
        advanced: {
            enabled: boolean;
            monitoring: boolean;
            autoOptimization: boolean;
            caching: boolean;
            predictiveScaling: boolean;
        };
    };
    costOptimization: {
        disabled: {
            enabled: boolean;
        };
        basic: {
            enabled: boolean;
            monitoring: boolean;
            budgetAlerts: boolean;
            lifecyclePolicies: boolean;
            rightSizing: boolean;
        };
        advanced: {
            enabled: boolean;
            monitoring: boolean;
            budgetAlerts: boolean;
            lifecyclePolicies: boolean;
            rightSizing: boolean;
            predictiveOptimization: boolean;
            automatedOptimization: boolean;
        };
    };
};
/**
 * 設定バリデーション関数
 */
export declare function validateAccountAgnosticConfig(config: Partial<EnvironmentConfig>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
};
/**
 * 設定マージ関数
 * ベース設定にカスタム設定をマージする
 */
export declare function mergeConfigurations(baseConfig: Partial<EnvironmentConfig>, customConfig: Partial<EnvironmentConfig>): EnvironmentConfig;
/**
 * 環境設定ファクトリー関数
 */
export declare function createEnvironmentConfig(environment: 'development' | 'staging' | 'production', region: string, customOptions?: {
    fsxOntapLevel?: 'disabled' | 'minimal' | 'standard' | 'advanced';
    serverlessLevel?: 'disabled' | 'minimal' | 'standard' | 'advanced';
    performanceLevel?: 'disabled' | 'basic' | 'advanced';
    costOptimizationLevel?: 'disabled' | 'basic' | 'advanced';
    customConfig?: Partial<EnvironmentConfig>;
}): EnvironmentConfig;
