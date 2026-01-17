/**
 * Frankfurt Region Configuration
 * フランクフルトリージョン設定（EU地域）
 */

import { GlobalRagConfig } from '../../types/global-config';

export const frankfurtConfig: GlobalRagConfig = {
  projectName: 'rag-frankfurt',
  environment: 'prod',
  region: 'eu-central-1',
  
  features: {
    networking: {
      vpc: true,
      loadBalancer: true,
      cdn: true,
      customDomain: 'rag-eu.example.com'
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
    primaryRegion: 'eu-central-1',
    supportedRegions: ['eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3'],
    dataResidency: 'eu',
    timezone: 'Europe/Berlin'
  },
  
  compliance: {
    regulations: ['GDPR', 'BDSG'],
    dataProtection: {
      encryptionAtRest: true,
      encryptionInTransit: true,
      dataClassification: true,
      accessLogging: true,
      dataRetention: {
        defaultRetentionDays: 1095, // 3 years
        personalDataRetentionDays: 1095,
        logRetentionDays: 365,
        backupRetentionDays: 1095
      }
    },
    auditLogging: true,
    gdprCompliance: {
      dpiaRequired: true,
      rightToErasure: true,
      dataPortability: true,
      consentManagement: true,
      dataProcessingRecords: true
    }
  }
};