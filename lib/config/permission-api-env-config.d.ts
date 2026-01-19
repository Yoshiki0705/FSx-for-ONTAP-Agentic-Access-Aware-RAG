/**
 * Permission API Lambda関数の環境変数設定
 *
 * FSx ONTAP Hybrid Permission APIで使用する環境変数を定義
 * Validates: Requirements 1.1, 2.2, 4.1
 */
import { Stack } from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
/**
 * Permission API環境変数の設定インターフェース
 */
export interface PermissionApiEnvConfig {
    /** DynamoDBテーブル名 */
    userAccessTableName: string;
    permissionCacheTableName: string;
    /** FSx for ONTAP設定 */
    fsxManagementEndpoint: string;
    fsxVolumeUuid?: string;
    fsxVolumeName?: string;
    /** Secrets Manager設定 */
    ontapCredentialsSecretName: string;
    /** Active Directory EC2設定 */
    adEc2InstanceId?: string;
    /** タイムアウト設定（ミリ秒） */
    requestTimeout?: number;
    ontapApiTimeout?: number;
    ssmCommandTimeout?: number;
    /** キャッシュ設定 */
    cacheTtlSeconds?: number;
    /** リージョン設定 */
    awsRegion: string;
    /** ログレベル */
    logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}
/**
 * Permission API環境変数を生成
 *
 * @param config - 環境変数設定
 * @returns Lambda関数用の環境変数オブジェクト
 */
export declare function buildPermissionApiEnvironment(config: PermissionApiEnvConfig): Record<string, string>;
/**
 * CDKリソースから環境変数設定を構築
 *
 * @param stack - CDK Stack
 * @param props - リソースプロパティ
 * @returns 環境変数設定
 */
export declare function buildPermissionApiEnvFromResources(stack: Stack, props: {
    userAccessTable: dynamodb.ITable;
    permissionCacheTable: dynamodb.ITable;
    fsxManagementEndpoint: string;
    ontapCredentialsSecret: secretsmanager.ISecret;
    fsxVolumeUuid?: string;
    fsxVolumeName?: string;
    adEc2Instance?: ec2.IInstance;
    requestTimeout?: number;
    cacheTtlSeconds?: number;
    logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}): Record<string, string>;
/**
 * 環境変数の検証
 *
 * @param env - 環境変数オブジェクト
 * @throws Error - 必須環境変数が不足している場合
 */
export declare function validatePermissionApiEnvironment(env: Record<string, string>): void;
/**
 * デフォルト環境変数設定を取得
 *
 * @param region - AWSリージョン
 * @returns デフォルト設定
 */
export declare function getDefaultPermissionApiEnvConfig(region: string): Partial<PermissionApiEnvConfig>;
/**
 * 環境別設定を取得
 *
 * @param environment - 環境名（dev, staging, prod）
 * @returns 環境別設定
 */
export declare function getEnvironmentSpecificConfig(environment: 'dev' | 'staging' | 'prod'): Partial<PermissionApiEnvConfig>;
