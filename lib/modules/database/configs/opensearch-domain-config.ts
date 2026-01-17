/**
 * OpenSearch Domain設定
 * 
 * 環境別のOpenSearchドメイン設定を提供
 */

import * as ec2 from 'aws-cdk-lib/aws-ec2';

/**
 * 開発環境用OpenSearch設定
 */
export function getDevOpenSearchConfig(projectName: string = 'permission-aware-rag') {
  return {
    domainName: `${projectName}-dev-vectordb`,
    environment: 'dev',
    
    instanceConfig: {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      instanceCount: 1,
      dedicatedMasterEnabled: false,
    },
    
    storageConfig: {
      volumeType: ec2.EbsDeviceVolumeType.GP3,
      volumeSize: 20,
      throughput: 125,
    },
    
    networkConfig: {
      vpcEnabled: false, // 開発環境では簡単のためVPCなし
    },
    
    securityConfig: {
      encryptionAtRest: true,
      nodeToNodeEncryption: true,
      enforceHttps: true,
      fineGrainedAccessControl: false, // 開発環境では無効
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
    
    indexConfig: {
      numberOfShards: 2,
      numberOfReplicas: 0, // 開発環境では0
    },
    
    tags: {
      Environment: 'dev',
      Purpose: 'MultimodalEmbedding',
      CostCenter: 'Development',
    },
  };
}

/**
 * ステージング環境用OpenSearch設定
 */
export function getStagingOpenSearchConfig(projectName: string = 'permission-aware-rag') {
  return {
    domainName: `${projectName}-staging-vectordb`,
    environment: 'staging',
    
    instanceConfig: {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      instanceCount: 2,
      dedicatedMasterEnabled: false,
    },
    
    storageConfig: {
      volumeType: ec2.EbsDeviceVolumeType.GP3,
      volumeSize: 50,
      throughput: 250,
    },
    
    networkConfig: {
      vpcEnabled: true,
    },
    
    securityConfig: {
      encryptionAtRest: true,
      nodeToNodeEncryption: true,
      enforceHttps: true,
      fineGrainedAccessControl: true,
      masterUserName: 'admin',
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
    
    indexConfig: {
      numberOfShards: 2,
      numberOfReplicas: 1,
    },
    
    tags: {
      Environment: 'staging',
      Purpose: 'MultimodalEmbedding',
      CostCenter: 'Development',
    },
  };
}

/**
 * 本番環境用OpenSearch設定
 */
export function getProdOpenSearchConfig(projectName: string = 'permission-aware-rag') {
  return {
    domainName: `${projectName}-prod-vectordb`,
    environment: 'prod',
    
    instanceConfig: {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.LARGE),
      instanceCount: 3,
      dedicatedMasterEnabled: true,
      masterInstanceType: ec2.InstanceType.of(ec2.InstanceClass.C6G, ec2.InstanceSize.MEDIUM),
      masterInstanceCount: 3,
    },
    
    storageConfig: {
      volumeType: ec2.EbsDeviceVolumeType.GP3,
      volumeSize: 100,
      throughput: 500,
      iops: 3000,
    },
    
    networkConfig: {
      vpcEnabled: true,
    },
    
    securityConfig: {
      encryptionAtRest: true,
      nodeToNodeEncryption: true,
      enforceHttps: true,
      fineGrainedAccessControl: true,
      masterUserName: 'admin',
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
    
    indexConfig: {
      numberOfShards: 3,
      numberOfReplicas: 2,
    },
    
    tags: {
      Environment: 'prod',
      Purpose: 'MultimodalEmbedding',
      CostCenter: 'Production',
    },
  };
}

/**
 * 環境に応じた設定取得
 */
export function getOpenSearchDomainConfig(
  environment: string,
  projectName: string = 'permission-aware-rag'
) {
  switch (environment.toLowerCase()) {
    case 'dev':
    case 'development':
      return getDevOpenSearchConfig(projectName);
    
    case 'staging':
    case 'stage':
      return getStagingOpenSearchConfig(projectName);
    
    case 'prod':
    case 'production':
      return getProdOpenSearchConfig(projectName);
    
    default:
      throw new Error(`未対応の環境: ${environment}`);
  }
}