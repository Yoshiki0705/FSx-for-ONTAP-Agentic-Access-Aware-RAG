/**
 * Amazon Bedrock AgentCore Browser Construct
 *
 * Headless Chromeによるブラウザ自動化機能を提供します。
 *
 * 主要機能:
 * - Headless Chrome統合（Puppeteer）
 * - Webスクレイピング（Cheerio）
 * - スクリーンショット撮影
 * - FSx for ONTAP + S3 Access Points統合
 *
 * @author Kiro AI
 * @date 2026-01-04
 */
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
/**
 * Browser Construct設定インターフェース
 */
export interface BedrockAgentCoreBrowserConstructProps {
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
     * スクリーンショット保存用S3バケット（オプション）
     */
    readonly screenshotBucket?: s3.IBucket;
    /**
     * FSx for ONTAP S3 Access Point ARN（オプション）
     * 指定された場合、S3バケットの代わりにFSx for ONTAPを使用
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
     * スクリーンショット設定（オプション）
     */
    readonly screenshotConfig?: {
        /**
         * 画像フォーマット
         * @default 'png'
         */
        format?: 'png' | 'jpeg' | 'webp';
        /**
         * 保存期間（日）
         * @default 7
         */
        retentionDays?: number;
        /**
         * サムネイル生成
         * @default true
         */
        generateThumbnail?: boolean;
    };
    /**
     * Webスクレイピング設定（オプション）
     */
    readonly scrapingConfig?: {
        /**
         * レート制限（リクエスト/分/ドメイン）
         * @default 10
         */
        rateLimit?: number;
        /**
         * robots.txt尊重
         * @default true
         */
        respectRobotsTxt?: boolean;
        /**
         * ユーザーエージェント
         * @default 'BedrockAgentCore-Browser/1.0'
         */
        userAgent?: string;
    };
}
/**
 * Amazon Bedrock AgentCore Browser Construct
 *
 * Headless Chromeによるブラウザ自動化機能を提供します。
 */
export declare class BedrockAgentCoreBrowserConstruct extends Construct {
    /**
     * Browser Lambda関数
     */
    readonly browserFunction?: lambda.Function;
    /**
     * スクリーンショット保存用S3バケット
     */
    readonly screenshotBucket?: s3.Bucket;
    /**
     * KMS暗号化キー
     */
    readonly encryptionKey?: kms.Key;
    /**
     * IAM実行ロール
     */
    readonly executionRole?: iam.Role;
    constructor(scope: Construct, id: string, props: BedrockAgentCoreBrowserConstructProps);
    /**
     * KMS暗号化キーを作成
     */
    private createEncryptionKey;
    /**
     * スクリーンショット保存用S3バケットを作成
     */
    private createScreenshotBucket;
    /**
     * IAM実行ロールを作成
     */
    private createExecutionRole;
    /**
     * Browser Lambda関数を作成
     */
    private createBrowserFunction;
    /**
     * タグを適用
     */
    private applyTags;
}
