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
export function buildPermissionApiEnvironment(
  config: PermissionApiEnvConfig
): Record<string, string> {
  const env: Record<string, string> = {
    // DynamoDB設定
    USER_ACCESS_TABLE_NAME: config.userAccessTableName,
    PERMISSION_CACHE_TABLE_NAME: config.permissionCacheTableName,
    
    // FSx for ONTAP設定
    FSX_MANAGEMENT_ENDPOINT: config.fsxManagementEndpoint,
    
    // Secrets Manager設定
    ONTAP_CREDENTIALS_SECRET_NAME: config.ontapCredentialsSecretName,
    
    // AWS設定
    AWS_REGION: config.awsRegion,
    
    // タイムアウト設定（デフォルト値）
    REQUEST_TIMEOUT: (config.requestTimeout || 30000).toString(),
    ONTAP_API_TIMEOUT: (config.ontapApiTimeout || 10000).toString(),
    SSM_COMMAND_TIMEOUT: (config.ssmCommandTimeout || 60000).toString(),
    
    // キャッシュ設定（デフォルト: 5分）
    CACHE_TTL_SECONDS: (config.cacheTtlSeconds || 300).toString(),
    
    // ログレベル（デフォルト: INFO）
    LOG_LEVEL: config.logLevel || 'INFO',
  };

  // オプション設定
  if (config.fsxVolumeUuid) {
    env.FSX_VOLUME_UUID = config.fsxVolumeUuid;
  }

  if (config.fsxVolumeName) {
    env.FSX_VOLUME_NAME = config.fsxVolumeName;
  }

  if (config.adEc2InstanceId) {
    env.AD_EC2_INSTANCE_ID = config.adEc2InstanceId;
  }

  return env;
}

/**
 * CDKリソースから環境変数設定を構築
 * 
 * @param stack - CDK Stack
 * @param props - リソースプロパティ
 * @returns 環境変数設定
 */
export function buildPermissionApiEnvFromResources(
  stack: Stack,
  props: {
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
  }
): Record<string, string> {
  const config: PermissionApiEnvConfig = {
    userAccessTableName: props.userAccessTable.tableName,
    permissionCacheTableName: props.permissionCacheTable.tableName,
    fsxManagementEndpoint: props.fsxManagementEndpoint,
    ontapCredentialsSecretName: props.ontapCredentialsSecret.secretName,
    awsRegion: stack.region,
    fsxVolumeUuid: props.fsxVolumeUuid,
    fsxVolumeName: props.fsxVolumeName,
    adEc2InstanceId: props.adEc2Instance?.instanceId,
    requestTimeout: props.requestTimeout,
    cacheTtlSeconds: props.cacheTtlSeconds,
    logLevel: props.logLevel,
  };

  return buildPermissionApiEnvironment(config);
}

/**
 * 環境変数の検証
 * 
 * @param env - 環境変数オブジェクト
 * @throws Error - 必須環境変数が不足している場合
 */
export function validatePermissionApiEnvironment(
  env: Record<string, string>
): void {
  const requiredVars = [
    'USER_ACCESS_TABLE_NAME',
    'PERMISSION_CACHE_TABLE_NAME',
    'FSX_MANAGEMENT_ENDPOINT',
    'ONTAP_CREDENTIALS_SECRET_NAME',
    'AWS_REGION',
  ];

  const missingVars = requiredVars.filter(varName => !env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `必須環境変数が不足しています: ${missingVars.join(', ')}`
    );
  }

  // FSxボリューム設定の検証（UUIDまたは名前のいずれかが必要）
  if (!env.FSX_VOLUME_UUID && !env.FSX_VOLUME_NAME) {
    console.warn(
      '警告: FSX_VOLUME_UUIDまたはFSX_VOLUME_NAMEのいずれかを設定することを推奨します'
    );
  }

  // タイムアウト値の検証
  const timeoutVars = ['REQUEST_TIMEOUT', 'ONTAP_API_TIMEOUT', 'SSM_COMMAND_TIMEOUT'];
  timeoutVars.forEach(varName => {
    const value = parseInt(env[varName] || '0', 10);
    if (value <= 0 || value > 900000) { // 最大15分
      throw new Error(
        `${varName}の値が不正です: ${env[varName]} (1-900000の範囲で指定してください)`
      );
    }
  });

  // キャッシュTTLの検証
  const cacheTtl = parseInt(env.CACHE_TTL_SECONDS || '0', 10);
  if (cacheTtl < 0 || cacheTtl > 3600) { // 最大1時間
    throw new Error(
      `CACHE_TTL_SECONDSの値が不正です: ${env.CACHE_TTL_SECONDS} (0-3600の範囲で指定してください)`
    );
  }
}

/**
 * デフォルト環境変数設定を取得
 * 
 * @param region - AWSリージョン
 * @returns デフォルト設定
 */
export function getDefaultPermissionApiEnvConfig(
  region: string
): Partial<PermissionApiEnvConfig> {
  return {
    awsRegion: region,
    requestTimeout: 30000,      // 30秒
    ontapApiTimeout: 10000,     // 10秒
    ssmCommandTimeout: 60000,   // 60秒
    cacheTtlSeconds: 300,       // 5分
    logLevel: 'INFO',
  };
}

/**
 * 環境別設定を取得
 * 
 * @param environment - 環境名（dev, staging, prod）
 * @returns 環境別設定
 */
export function getEnvironmentSpecificConfig(
  environment: 'dev' | 'staging' | 'prod'
): Partial<PermissionApiEnvConfig> {
  switch (environment) {
    case 'dev':
      return {
        requestTimeout: 60000,    // 開発環境は長めに設定
        cacheTtlSeconds: 60,      // キャッシュは短めに設定
        logLevel: 'DEBUG',
      };

    case 'staging':
      return {
        requestTimeout: 45000,
        cacheTtlSeconds: 180,     // 3分
        logLevel: 'INFO',
      };

    case 'prod':
      return {
        requestTimeout: 30000,
        cacheTtlSeconds: 300,     // 5分
        logLevel: 'WARN',
      };

    default:
      return getDefaultPermissionApiEnvConfig('us-east-1');
  }
}
