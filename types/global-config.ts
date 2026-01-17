export interface GlobalRagConfig {
  projectName: string;
  environment: string;
  region: string;
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
}
