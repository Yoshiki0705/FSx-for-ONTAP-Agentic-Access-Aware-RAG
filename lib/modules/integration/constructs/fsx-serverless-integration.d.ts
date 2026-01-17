/**
 * FSx for ONTAP と Serverless アーキテクチャの統合コンストラクト
 *
 * このコンストラクトは、Amazon FSx for NetApp ONTAP と AWS Serverless サービス
 * （Lambda、Step Functions、EventBridge、SQS、SNS）を統合し、
 * 高性能なファイル処理パイプラインを提供します。
 *
 * 注意: API Gatewayはタイムアウト制約により使用せず、Lambda Web Adapterを使用
 *
 * @author Kiro AI
 * @date 2026-01-08
 * @version 1.0.0
 */
import { Construct } from 'constructs';
import * as fsx from 'aws-cdk-lib/aws-fsx';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as events from 'aws-cdk-lib/aws-events';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
/**
 * FSx-Serverless統合コンストラクトのプロパティ
 */
export interface FsxServerlessIntegrationProps {
    /**
     * FSx for ONTAP設定
     */
    readonly fsx: {
        readonly enabled: boolean;
        readonly fileSystems: Array<{
            readonly enabled: boolean;
            readonly name: string;
            readonly storageCapacity: number;
            readonly throughputCapacity: number;
            readonly deploymentType: 'SINGLE_AZ_1' | 'MULTI_AZ_1';
            readonly storageEfficiency: boolean;
            readonly backup: {
                readonly enabled: boolean;
                readonly retentionDays: number;
                readonly dailyAutomaticBackupStartTime: string;
            };
            readonly encryption: {
                readonly enabled: boolean;
                readonly kmsKeyId?: string;
            };
            readonly network: {
                readonly subnetIds: string[];
                readonly securityGroupIds: string[];
                readonly routeTableIds: string[];
            };
        }>;
        readonly storageVirtualMachines: Array<{
            readonly enabled: boolean;
            readonly name: string;
            readonly rootVolumeSecurityStyle: 'UNIX' | 'NTFS' | 'MIXED';
            readonly activeDirectoryConfiguration: {
                readonly enabled: boolean;
            };
        }>;
        readonly volumes: Array<{
            readonly enabled: boolean;
            readonly name: string;
            readonly sizeInMegabytes: number;
            readonly securityStyle: 'UNIX' | 'NTFS' | 'MIXED';
            readonly ontapVolumeType: 'RW' | 'DP';
            readonly junctionPath: string;
        }>;
    };
    /**
     * Serverless設定
     */
    readonly serverless: {
        readonly enabled: boolean;
        readonly stepFunctions: {
            readonly enabled: boolean;
            readonly workflows: Array<{
                readonly enabled: boolean;
                readonly name: string;
                readonly purpose: string;
                readonly role: {
                    readonly permissions: string[];
                };
            }>;
            readonly execution: {
                readonly timeout: number;
                readonly retryAttempts: number;
            };
        };
        readonly eventBridge: {
            readonly enabled: boolean;
            readonly rules: Array<{
                readonly enabled: boolean;
                readonly name: string;
                readonly eventPattern?: any;
                readonly schedule?: {
                    readonly expression: string;
                };
            }>;
        };
        readonly sqs: {
            readonly enabled: boolean;
            readonly queues: Array<{
                readonly enabled: boolean;
                readonly name: string;
                readonly configuration: {
                    readonly visibilityTimeoutSeconds: number;
                    readonly messageRetentionPeriod: number;
                    readonly maxReceiveCount: number;
                };
            }>;
        };
        readonly sns: {
            readonly enabled: boolean;
            readonly topics: Array<{
                readonly enabled: boolean;
                readonly name: string;
                readonly subscriptions: Array<{
                    readonly enabled: boolean;
                    readonly protocol: string;
                    readonly endpoint: string;
                }>;
            }>;
        };
        readonly lambda: {
            readonly functions: Array<{
                readonly enabled: boolean;
                readonly name: string;
                readonly runtime: string;
                readonly timeout: number;
                readonly memorySize: number;
                readonly vpc: {
                    readonly enabled: boolean;
                };
                readonly fileSystem: {
                    readonly enabled: boolean;
                };
                readonly role: {
                    readonly permissions: string[];
                };
            }>;
        };
        readonly monitoring: {
            readonly cloudWatch: {
                readonly enabled: boolean;
                readonly logRetentionDays: number;
            };
            readonly xray: {
                readonly enabled: boolean;
            };
        };
    };
    /**
     * VPC設定
     */
    readonly vpc: ec2.IVpc;
    /**
     * 環境名
     */
    readonly environment: string;
    /**
     * プロジェクト名
     */
    readonly projectName: string;
    /**
     * タグ
     */
    readonly tags?: {
        [key: string]: string;
    };
}
/**
 * FSx-Serverless統合コンストラクト
 */
export declare class FsxServerlessIntegrationConstruct extends Construct {
    /**
     * FSx for ONTAPファイルシステム
     */
    readonly fileSystems: fsx.CfnFileSystem[];
    /**
     * Lambda関数
     */
    readonly lambdaFunctions: lambda.Function[];
    /**
     * Step Functions ステートマシン
     */
    readonly stateMachines: stepfunctions.StateMachine[];
    /**
     * SQSキュー
     */
    readonly queues: sqs.Queue[];
    /**
     * SNSトピック
     */
    readonly topics: sns.Topic[];
    /**
     * EventBridgeルール
     */
    readonly eventRules: events.Rule[];
    constructor(scope: Construct, id: string, props: FsxServerlessIntegrationProps);
    /**
     * FSx for ONTAPリソースの作成
     */
    private createFsxResources;
    /**
     * Serverlessリソースの作成
     */
    private createServerlessResources;
    /**
     * SNSトピックの作成
     */
    private createSnsTopics;
    /**
     * SQSキューの作成
     */
    private createSqsQueues;
    /**
     * Lambda関数の作成
     */
    private createLambdaFunctions;
    /**
     * Step Functionsの作成
     */
    private createStepFunctions;
    /**
     * ワークフロー定義の作成
     */
    private createWorkflowDefinition;
    /**
     * EventBridgeルールの作成
     */
    private createEventBridgeRules;
    /**
     * 統合の設定
     */
    private setupIntegration;
    /**
     * モニタリングの設定
     */
    private setupMonitoring;
    /**
     * タグの適用
     */
    private applyTags;
    /**
     * Lambda Runtimeの取得
     */
    private getLambdaRuntime;
    /**
     * ログ保持期間の取得
     */
    private getLogRetention;
}
