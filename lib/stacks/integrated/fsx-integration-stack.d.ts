/**
 * FSx統合スタック
 *
 * FSx for ONTAPとサーバレスアーキテクチャの統合機能を提供します。
 * 設定ファイルのfeatureFlagsで機能の有効化/無効化を制御します。
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as events from 'aws-cdk-lib/aws-events';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/interfaces/environment-config';
import { FsxServerlessIntegrationConstruct } from '../../modules/integration/constructs/fsx-serverless-integration';
export interface FsxIntegrationStackProps extends cdk.StackProps {
    /**
     * 環境設定
     */
    readonly config: EnvironmentConfig;
    /**
     * プロジェクト名
     */
    readonly projectName: string;
    /**
     * 環境名
     */
    readonly environment: string;
    /**
     * VPC（NetworkingStackから取得）
     */
    readonly vpc: ec2.IVpc;
    /**
     * プライベートサブネットID（DataStackから取得）
     */
    readonly privateSubnetIds: string[];
    /**
     * セキュリティスタック（SecurityStackから取得、オプション）
     */
    readonly securityStack?: any;
}
/**
 * FSx統合スタック
 *
 * 機能フラグによる制御:
 * - enableFsxIntegration: FSx統合機能全体の有効化
 * - enableFsxServerlessWorkflows: Step Functionsワークフローの有効化
 * - enableFsxEventDriven: EventBridgeイベント駆動処理の有効化
 * - enableFsxBatchProcessing: SQS/SNSバッチ処理の有効化
 */
export declare class FsxIntegrationStack extends cdk.Stack {
    /**
     * FSx統合コンストラクト
     */
    readonly fsxIntegration?: FsxServerlessIntegrationConstruct;
    /**
     * Step Functions ステートマシン
     */
    readonly stateMachines: stepfunctions.StateMachine[];
    /**
     * EventBridge カスタムバス
     */
    readonly eventBus?: events.EventBus;
    /**
     * SQS キュー
     */
    readonly queues: sqs.Queue[];
    /**
     * SNS トピック
     */
    readonly topics: sns.Topic[];
    /**
     * Lambda 関数
     */
    readonly functions: lambda.Function[];
    constructor(scope: Construct, id: string, props: FsxIntegrationStackProps);
    /**
     * FSx統合設定の構築
     */
    private buildFsxIntegrationConfig;
    /**
     * Step Functions ワークフローの作成
     */
    private createStepFunctionsWorkflows;
    /**
     * EventBridge イベント駆動処理の作成
     */
    private createEventDrivenProcessing;
    /**
     * SQS/SNS バッチ処理の作成
     */
    private createBatchProcessing;
    /**
     * Lambda 関数の作成
     */
    private createLambdaFunctions;
    /**
     * CloudWatch ログとモニタリングの設定
     */
    private setupMonitoring;
    /**
     * スタック出力の作成
     */
    private createStackOutputs;
}
