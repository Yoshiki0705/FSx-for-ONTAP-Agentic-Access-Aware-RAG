/**
 * 本番環境テスト設定管理
 * 
 * AWS東京リージョン本番環境への安全な接続設定を管理
 * 全てのテストは実本番リソースを使用し、読み取り専用モードで実行
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// 本番環境設定の読み込み
dotenv.config({ path: path.join(process.cwd(), '.env.production') });

/**
 * 本番環境設定インターフェース
 */
export interface ProductionConfig {
  // AWS基本設定
  region: 'ap-northeast-1';
  environment: 'production';
  awsProfile: string;
  
  // 安全性制約
  safetyMode: boolean;
  readOnlyMode: boolean;
  emergencyStopEnabled: boolean;
  
  // 実本番リソース設定
  resources: ProductionResources;
  
  // テスト実行設定
  execution: ExecutionConfig;
  
  // 監視設定
  monitoring: MonitoringConfig;
}

/**
 * 実本番リソース設定
 */
export interface ProductionResources {
  // フロントエンド
  cloudFrontDistribution: string;
  lambdaWebAdapter: string;
  
  // 認証・セキュリティ
  cognitoUserPool: string;
  cognitoClientId: string;
  wafWebAcl: string;
  
  // AI・RAG
  bedrockModels: string[];
  openSearchDomain: string;
  openSearchIndex: string;
  
  // データ・ストレージ
  dynamoDBTables: {
    sessions: string;
    users: string;
    documents: string;
  };
  fsxFileSystem: string;
  s3Buckets: {
    documents: string;
    embeddings: string;
  };
  
  // 監視・ログ
  cloudWatchLogGroups: string[];
  xrayServiceMap: string;
}

/**
 * テスト実行設定
 */
export interface ExecutionConfig {
  maxConcurrentTests: number;
  testTimeout: number;
  retryCount: number;
  failFast: boolean;
  maxTestDuration: number;
}

/**
 * 監視設定
 */
export interface MonitoringConfig {
  enableRealTimeMonitoring: boolean;
  metricsCollectionInterval: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    resourceUtilization: number;
  };
}

/**
 * 本番環境設定の作成
 */
export function createProductionConfig(): ProductionConfig {
  // 必須環境変数の検証
  const requiredEnvVars = [
    'AWS_REGION',
    'AWS_PROFILE',
    'PROD_CLOUDFRONT_DISTRIBUTION',
    'PROD_COGNITO_USER_POOL',
    'PROD_COGNITO_CLIENT_ID',
    'PROD_OPENSEARCH_DOMAIN',
    'PROD_DYNAMODB_SESSION_TABLE',
    'PROD_FSX_FILE_SYSTEM'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`必須環境変数が設定されていません: ${missingVars.join(', ')}`);
  }

  return {
    region: 'ap-northeast-1',
    environment: 'production',
    awsProfile: process.env.AWS_PROFILE!,
    
    // 安全性制約（必須）
    safetyMode: true,
    readOnlyMode: true,
    emergencyStopEnabled: true,
    
    resources: {
      // フロントエンド
      cloudFrontDistribution: process.env.PROD_CLOUDFRONT_DISTRIBUTION!,
      lambdaWebAdapter: process.env.PROD_LAMBDA_WEB_ADAPTER || '',
      
      // 認証・セキュリティ
      cognitoUserPool: process.env.PROD_COGNITO_USER_POOL!,
      cognitoClientId: process.env.PROD_COGNITO_CLIENT_ID!,
      wafWebAcl: process.env.PROD_WAF_WEB_ACL || '',
      
      // AI・RAG
      bedrockModels: [
        'amazon.nova-lite-v1:0',
        'amazon.nova-micro-v1:0',
        'anthropic.claude-3-haiku-20240307-v1:0'
      ],
      openSearchDomain: process.env.PROD_OPENSEARCH_DOMAIN!,
      openSearchIndex: process.env.PROD_OPENSEARCH_INDEX || 'documents',
      
      // データ・ストレージ
      dynamoDBTables: {
        sessions: process.env.PROD_DYNAMODB_SESSION_TABLE!,
        users: process.env.PROD_DYNAMODB_USER_TABLE || '',
        documents: process.env.PROD_DYNAMODB_DOCUMENT_TABLE || ''
      },
      fsxFileSystem: process.env.PROD_FSX_FILE_SYSTEM!,
      s3Buckets: {
        documents: process.env.PROD_S3_DOCUMENTS_BUCKET || '',
        embeddings: process.env.PROD_S3_EMBEDDINGS_BUCKET || ''
      },
      
      // 監視・ログ
      cloudWatchLogGroups: [
        '/aws/lambda/prod-rag-api',
        '/aws/lambda/prod-rag-embedding',
        '/aws/apigateway/prod-rag-api'
      ],
      xrayServiceMap: process.env.PROD_XRAY_SERVICE_MAP || ''
    },
    
    execution: {
      maxConcurrentTests: 5,
      testTimeout: 300000, // 5分
      retryCount: 2,
      failFast: false,
      maxTestDuration: 3600000 // 1時間
    },
    
    monitoring: {
      enableRealTimeMonitoring: true,
      metricsCollectionInterval: 30000, // 30秒
      alertThresholds: {
        errorRate: 0.05, // 5%
        responseTime: 5000, // 5秒
        resourceUtilization: 0.8 // 80%
      }
    }
  };
}

/**
 * 設定の検証
 */
export function validateProductionConfig(config: ProductionConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 基本設定の検証
  if (config.region !== 'ap-northeast-1') {
    errors.push('リージョンは ap-northeast-1 である必要があります');
  }

  if (config.environment !== 'production') {
    errors.push('環境は production である必要があります');
  }

  // 安全性制約の検証
  if (!config.safetyMode) {
    errors.push('本番環境テストでは safetyMode は必須です');
  }

  if (!config.readOnlyMode) {
    errors.push('本番環境テストでは readOnlyMode は必須です');
  }

  if (!config.emergencyStopEnabled) {
    errors.push('本番環境テストでは emergencyStopEnabled は必須です');
  }

  // リソース設定の検証
  if (!config.resources.cloudFrontDistribution) {
    errors.push('CloudFront Distribution IDが設定されていません');
  }

  if (!config.resources.cognitoUserPool) {
    errors.push('Cognito User Pool IDが設定されていません');
  }

  if (!config.resources.openSearchDomain) {
    errors.push('OpenSearch Domain名が設定されていません');
  }

  if (!config.resources.dynamoDBTables.sessions) {
    errors.push('DynamoDB Session Table名が設定されていません');
  }

  if (!config.resources.fsxFileSystem) {
    errors.push('FSx File System IDが設定されていません');
  }

  // 実行設定の検証
  if (config.execution.maxConcurrentTests > 10) {
    warnings.push('同時実行テスト数が多すぎます。本番環境への負荷を考慮してください');
  }

  if (config.execution.testTimeout < 30000) {
    warnings.push('テストタイムアウトが短すぎる可能性があります');
  }

  console.log(`🔍 本番環境設定検証完了: エラー ${errors.length}件, 警告 ${warnings.length}件`);

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * デフォルト本番環境設定
 */
export const defaultProductionConfig = createProductionConfig();

export default defaultProductionConfig;