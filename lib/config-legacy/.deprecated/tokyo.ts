/**
 * Tokyo Region Configuration
 * 東京リージョン設定（メインリージョン）
 */

import { GlobalRagConfig } from '../../types/global-config';

export const tokyoConfig: GlobalRagConfig = {
  projectName: 'rag-tokyo',
  environment: 'prod',
  region: 'ap-northeast-1',
  
  features: {
    networking: {
      vpc: true,
      loadBalancer: true,
      cdn: true,
      customDomain: 'rag.example.com'
    },
    security: {
      waf: true,
      cognito: true,
      encryption: true,
      compliance: true
    },
    storage: {
      fsx: true,
      s3: true,
      backup: true,
      lifecycle: true
    },
    database: {
      dynamodb: true,
      opensearch: true,
      rds: true,
      migration: true
    },
    compute: {
      lambda: true,
      ecs: true,
      scaling: true
    },
    api: {
      restApi: true,
      graphql: true,
      websocket: true,
      frontend: true
    },
    ai: {
      bedrock: true,
      embedding: true,
      rag: true,
      modelManagement: true
    },
    monitoring: {
      cloudwatch: true,
      xray: true,
      alarms: true,
      dashboards: true
    },
    enterprise: {
      multiTenant: true,
      billing: true,
      compliance: true,
      governance: true
    }
  },
  
  regionalSettings: {
    primaryRegion: 'ap-northeast-1',
    secondaryRegion: 'ap-northeast-3',
    supportedRegions: ['ap-northeast-1', 'ap-northeast-3'],
    dataResidency: 'japan',
    timezone: 'Asia/Tokyo'
  },
  
  disasterRecovery: {
    enabled: true,
    primaryRegion: 'ap-northeast-1',
    secondaryRegion: 'ap-northeast-3',
    rto: 4, // 4 hours
    rpo: 1, // 1 hour
    replicationServices: ['dynamodb', 'fsx', 'opensearch', 's3']
  },
  
  compliance: {
    regulations: ['FISC'],
    dataProtection: {
      encryptionAtRest: true,
      encryptionInTransit: true,
      dataClassification: true,
      accessLogging: true,
      dataRetention: {
        defaultRetentionDays: 2555, // 7 years for financial data
        personalDataRetentionDays: 1095, // 3 years
        logRetentionDays: 365,
        backupRetentionDays: 2555
      }
    },
    auditLogging: true
  }
};