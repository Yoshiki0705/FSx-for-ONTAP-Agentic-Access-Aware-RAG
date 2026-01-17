/**
 * Virginia Region Configuration
 * バージニア地域設定（US East 1）
 */

import { GlobalRagConfig } from '../../types/global-config';
// ComplianceMapperは後で実装予定のため、一時的に直接設定
import { ComplianceRegulation } from '../../types/global-config';

export const virginiaConfig: GlobalRagConfig = {
  projectName: 'global-rag',
  environment: 'dev',
  region: 'us-east-1',
  
  regionalSettings: {
    primaryRegion: 'us-east-1',
    supportedRegions: ['us-east-1', 'us-west-2', 'us-east-2'],
    dataResidency: 'us',
    timezone: 'America/New_York'
  },
  
  features: {
    networking: {
      vpc: true,
      loadBalancer: true,
      cdn: true,
      customDomain: undefined
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
      rds: false,
      migration: true
    },
    compute: {
      lambda: true,
      ecs: false,
      scaling: true
    },
    api: {
      restApi: true,
      graphql: false,
      websocket: false,
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
      multiTenant: false,
      billing: false,
      compliance: true,
      governance: true
    }
  },
  
  compliance: {
    regulations: ['SOX', 'HIPAA'] as ComplianceRegulation[],
    dataProtection: {
      encryptionAtRest: true,
      encryptionInTransit: true,
      dataClassification: true,
      accessLogging: true,
      dataRetention: {
        defaultRetentionDays: 2555, // 7 years for SOX
        personalDataRetentionDays: 2190, // 6 years for HIPAA
        logRetentionDays: 365,
        backupRetentionDays: 2555
      }
    },
    auditLogging: true
  }
};