export type ComplianceRegulation = 'GDPR' | 'HIPAA' | 'SOX' | 'PCI-DSS' | 'ISO27001' | 'SOC2' | 'FISC';

export interface GlobalRagConfig {
  projectName: string;
  environment: string;
  region: string;
  regionPrefix?: string;
  version: string;
  monitoring: {
    enabled: boolean;
    metricsRetentionDays: number;
    alertingEnabled: boolean;
  };
  security: {
    enabled: boolean;
    threatDetectionEnabled: boolean;
    auditingEnabled: boolean;
  };
  embedding?: {
    enabled: boolean;
    model?: string;
    dimensions?: number;
    [key: string]: any;
  };
  features?: {
    agentCore?: {
      enabled: boolean;
      runtime?: boolean;
      gateway?: boolean;
      memory?: boolean;
      identity?: boolean;
      browser?: boolean;
      codeInterpreter?: boolean;
      observability?: boolean;
      evaluations?: boolean;
      policy?: boolean;
    };
    [key: string]: any;
  };
  compliance?: {
    enabled: boolean;
    gdprEnabled?: boolean;
    hipaaEnabled?: boolean;
    regulations?: ComplianceRegulation[];
    dataProtection?: {
      encryptionAtRest: boolean;
      encryptionInTransit: boolean;
      dataClassification: boolean;
      accessLogging: boolean;
      dataRetention: {
        defaultRetentionDays: number;
        personalDataRetentionDays: number;
        logRetentionDays: number;
        backupRetentionDays: number;
      };
    };
    auditLogging?: boolean;
    [key: string]: any;
  };
}
