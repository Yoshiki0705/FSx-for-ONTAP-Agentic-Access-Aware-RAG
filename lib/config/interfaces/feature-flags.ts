export interface FeatureFlags {
  // Core features
  enableAdvancedSecurity?: boolean;
  enableMultiRegion?: boolean;
  enableCostOptimization?: boolean;
  
  // FSx Integration features
  enableFsxIntegration?: boolean;
  enableFsxServerlessWorkflows?: boolean;
  enableFsxEventDriven?: boolean;
  enableFsxBatchProcessing?: boolean;
  
  // Agent features
  enableAgentCore?: boolean;
  enableBedrockAgent?: boolean;
  
  // Monitoring features
  enableDetailedMonitoring?: boolean;
  enableXRayTracing?: boolean;
  
  // Development features
  enableDebugMode?: boolean;
  enableTestMode?: boolean;
}
