/**
 * Amazon Bedrock AgentCore Code Interpreter Construct
 *
 * Pythonコードを安全なサンドボックス環境で実行する機能を提供します。
 *
 * 主要機能:
 * - セッション管理（開始、停止）
 * - コード実行（Python）
 * - ファイル操作（書き込み、読み込み、削除、一覧）
 * - ターミナルコマンド実行
 * - FSx for ONTAP統合（オプション）
 *
 * @author Kiro AI
 * @date 2026-01-04
 */
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
/**
 * Code Interpreter Construct設定インターフェース
 */
export interface BedrockAgentCoreCodeInterpreterConstructProps {
    /**
     * 機能の有効化フラグ
     */
    readonly enabled: boolean;
    /**
     * プロジェクト名
     */
    readonly projectName: string;
    /**
     * 環境名（prod, dev等）
     */
    readonly environment: string;
    /**
     * VPC設定（オプション）
     */
    readonly vpc?: ec2.IVpc;
    /**
     * セキュリティグループ（オプション）
     */
    readonly securityGroup?: ec2.ISecurityGroup;
    /**
     * FSx for ONTAP S3 Access Point ARN（オプション）
     * 指定された場合、ファイル操作でFSx for ONTAPを使用
     */
    readonly fsxS3AccessPointArn?: string;
    /**
     * KMS暗号化キー（オプション）
     */
    readonly encryptionKey?: kms.IKey;
    /**
     * Lambda関数設定（オプション）
     */
    readonly lambdaConfig?: {
        /**
         * メモリサイズ（MB）
         * @default 2048
         */
        memorySize?: number;
        /**
         * タイムアウト（秒）
         * @default 300
         */
        timeout?: number;
        /**
         * Ephemeral Storage（MB）
         * @default 2048
         */
        ephemeralStorageSize?: number;
        /**
         * Reserved Concurrency
         * @default undefined（無制限）
         */
        reservedConcurrentExecutions?: number;
    };
    /**
     * サンドボックス設定（オプション）
     */
    readonly sandboxConfig?: {
        /**
         * Python実行タイムアウト（秒）
         * @default 60
         */
        executionTimeout?: number;
        /**
         * メモリ制限（MB）
         * @default 512
         */
        memoryLimit?: number;
        /**
         * 許可されるPythonパッケージ
         * @default ['numpy', 'pandas', 'matplotlib', 'scipy']
         */
        allowedPackages?: string[];
        /**
         * ネットワークアクセス許可
         * @default false
         */
        allowNetworkAccess?: boolean;
    };
    /**
     * セッション設定（オプション）
     */
    readonly sessionConfig?: {
        /**
         * セッションタイムアウト（秒）
         * @default 3600
         */
        sessionTimeout?: number;
        /**
         * 最大同時セッション数
         * @default 10
         */
        maxConcurrentSessions?: number;
    };
}
/**
 * Amazon Bedrock AgentCore Code Interpreter Construct
 *
 * Pythonコードを安全なサンドボックス環境で実行する機能を提供します。
 */
export declare class BedrockAgentCoreCodeInterpreterConstruct extends Construct {
    /**
     * Code Interpreter Lambda関数
     */
    readonly interpreterFunction?: lambda.Function;
    /**
     * KMS暗号化キー
     */
    readonly encryptionKey?: kms.Key;
    /**
     * IAM実行ロール
     */
    readonly executionRole?: iam.Role;
    constructor(scope: Construct, id: string, props: BedrockAgentCoreCodeInterpreterConstructProps);
    /**
     * KMS暗号化キーを作成
     */
    private createEncryptionKey;
    /**
     * IAM実行ロールを作成
     */
    private createExecutionRole;
    /**
     * Code Interpreter Lambda関数を作成
     */
    private createInterpreterFunction;
    /**
     * タグを適用
     */
    private applyTags;
}
