/**
 * OpenSearch Multimodal Embedding設定
 * 
 * 環境別の最適化された設定を提供
 */

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { OpenSearchMultimodalConfig } from '../constructs/opensearch-multimodal-construct';

/**
 * 開発環境用設定
 */
export const developmentConfig: OpenSearchMultimodalConfig = {
  domainName: 'multimodal-dev',
  environment: 'dev',
  
  collectionConfig: {
    type: 'VECTORSEARCH',
    description: 'Development environment for multimodal embedding testing',
  },
  
  networkConfig: {
    vpcEnabled: false,
  },
  
  securityConfig: {
    encryptionAtRest: true,
    nodeToNodeEncryption: true,
    enforceHttps: true,
    fineGrainedAccessControl: false,
  },
  
  monitoringConfig: {
    logsEnabled: true,
    slowLogsEnabled: false,
    appLogsEnabled: true,
    indexSlowLogsEnabled: false,
  },
  
  backupConfig: {
    automatedSnapshotStartHour: 3,
  },
  
  tags: {
    CostCenter: 'Development',
    Purpose: 'MultimodalEmbeddingTesting',
  },
};

/**
 * ステージング環境用設定
 */
export const stagingConfig: OpenSearchMultimodalConfig = {
  domainName: 'multimodal-staging',
  environment: 'staging',
  
  collectionConfig: {
    type: 'VECTORSEARCH',
    description: 'Staging environment for multimodal embedding validation',
  },
  
  networkConfig: {
    vpcEnabled: true,
    // VPC, subnets, securityGroupsは実行時に設定
  },
  
  securityConfig: {
    encryptionAtRest: true,
    nodeToNodeEncryption: true,
    enforceHttps: true,
    fineGrainedAccessControl: true,
  },
  
  monitoringConfig: {
    logsEnabled: true,
    slowLogsEnabled: true,
    appLogsEnabled: true,
    indexSlowLogsEnabled: true,
  },
  
  backupConfig: {
    automatedSnapshotStartHour: 2,
  },
  
  tags: {
    CostCenter: 'Staging',
    Purpose: 'MultimodalEmbeddingTesting',
    DataClassification: 'Internal',
  },
};

/**
 * 本番環境用設定
 */
export const productionConfig: OpenSearchMultimodalConfig = {
  domainName: 'multimodal-prod',
  environment: 'prod',
  
  collectionConfig: {
    type: 'VECTORSEARCH',
    description: 'Production environment for multimodal embedding search',
  },
  
  networkConfig: {
    vpcEnabled: true,
    // VPC, subnets, securityGroupsは実行時に設定
  },
  
  securityConfig: {
    encryptionAtRest: true,
    nodeToNodeEncryption: true,
    enforceHttps: true,
    fineGrainedAccessControl: true,
  },
  
  monitoringConfig: {
    logsEnabled: true,
    slowLogsEnabled: true,
    appLogsEnabled: true,
    indexSlowLogsEnabled: true,
  },
  
  backupConfig: {
    automatedSnapshotStartHour: 1,
  },
  
  tags: {
    CostCenter: 'Production',
    Purpose: 'MultimodalEmbeddingProduction',
    DataClassification: 'Confidential',
    BackupRequired: 'true',
    MonitoringLevel: 'Enhanced',
  },
};

/**
 * 高性能環境用設定（大量データ処理用）
 */
export const highPerformanceConfig: OpenSearchMultimodalConfig = {
  domainName: 'multimodal-perf',
  environment: 'prod',
  
  collectionConfig: {
    type: 'VECTORSEARCH',
    description: 'High-performance environment for large-scale multimodal embedding processing',
  },
  
  networkConfig: {
    vpcEnabled: true,
    // VPC, subnets, securityGroupsは実行時に設定
  },
  
  securityConfig: {
    encryptionAtRest: true,
    nodeToNodeEncryption: true,
    enforceHttps: true,
    fineGrainedAccessControl: true,
  },
  
  monitoringConfig: {
    logsEnabled: true,
    slowLogsEnabled: true,
    appLogsEnabled: true,
    indexSlowLogsEnabled: true,
  },
  
  backupConfig: {
    automatedSnapshotStartHour: 0,
  },
  
  tags: {
    CostCenter: 'Production',
    Purpose: 'MultimodalEmbeddingHighPerformance',
    DataClassification: 'Confidential',
    BackupRequired: 'true',
    MonitoringLevel: 'Enhanced',
    PerformanceTier: 'High',
  },
};

/**
 * 環境に応じた設定取得
 */
export function getOpenSearchMultimodalConfig(
  environment: string,
  performanceTier?: 'standard' | 'high'
): OpenSearchMultimodalConfig {
  switch (environment.toLowerCase()) {
    case 'dev':
    case 'development':
      return developmentConfig;
    
    case 'staging':
    case 'stage':
      return stagingConfig;
    
    case 'prod':
    case 'production':
      if (performanceTier === 'high') {
        return highPerformanceConfig;
      }
      return productionConfig;
    
    default:
      throw new Error(`未対応の環境: ${environment}`);
  }
}

/**
 * コスト最適化設定
 */
export const costOptimizedConfig: Partial<OpenSearchMultimodalConfig> = {
  collectionConfig: {
    type: 'VECTORSEARCH',
    description: 'Cost-optimized multimodal embedding collection',
  },
  
  monitoringConfig: {
    logsEnabled: false,
    slowLogsEnabled: false,
    appLogsEnabled: false,
    indexSlowLogsEnabled: false,
  },
};

/**
 * パフォーマンス最適化設定
 */
export const performanceOptimizedConfig: Partial<OpenSearchMultimodalConfig> = {
  collectionConfig: {
    type: 'VECTORSEARCH',
    description: 'Performance-optimized multimodal embedding collection',
  },
  
  monitoringConfig: {
    logsEnabled: true,
    slowLogsEnabled: true,
    appLogsEnabled: true,
    indexSlowLogsEnabled: true,
  },
};

/**
 * セキュリティ強化設定
 */
export const securityEnhancedConfig: Partial<OpenSearchMultimodalConfig> = {
  securityConfig: {
    encryptionAtRest: true,
    nodeToNodeEncryption: true,
    enforceHttps: true,
    fineGrainedAccessControl: true,
  },
  
  networkConfig: {
    vpcEnabled: true,
    // 専用VPC、プライベートサブネット、厳格なセキュリティグループ
  },
  
  monitoringConfig: {
    logsEnabled: true,
    slowLogsEnabled: true,
    appLogsEnabled: true,
    indexSlowLogsEnabled: true,
  },
};