import { EnvironmentConfig, FsxIntegrationConfig } from '../interfaces/environment-config';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompatibilityResult {
  isCompatible: boolean;
  issues: string[];
  recommendations: string[];
}

export class ConfigValidator {
  static validateEnvironmentConfig(config: EnvironmentConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!config.projectName) {
      errors.push('Project name is required');
    }

    if (!config.environment) {
      errors.push('Environment is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateFsxIntegrationConfig(config: FsxIntegrationConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.enabled) {
      if (!config.fsxFileSystemId) {
        errors.push('FSx file system ID is required when FSx integration is enabled');
      }

      if (!config.ontapManagementLif) {
        warnings.push('ONTAP management LIF is not configured');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateFsxServerlessCompatibility(config: FsxIntegrationConfig): CompatibilityResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (config.enabled && !config.fsxFileSystemId) {
      issues.push('FSx file system ID is required for serverless compatibility');
      recommendations.push('Configure FSx file system ID in the environment config');
    }

    return {
      isCompatible: issues.length === 0,
      issues,
      recommendations
    };
  }

  static getFsxOptimizationSuggestions(config: FsxIntegrationConfig): string[] {
    const suggestions: string[] = [];

    if (config.enabled) {
      suggestions.push('Consider enabling FSx caching for better performance');
      suggestions.push('Configure appropriate backup policies');
    }

    return suggestions;
  }

  private static validateFsxCredentials(
    config: FsxIntegrationConfig,
    environment: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.enabled && config.credentials) {
      if (!config.credentials.username) {
        errors.push('FSx username is required');
      }

      if (!config.credentials.password) {
        errors.push('FSx password is required');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static validateFsxNetworking(
    config: FsxIntegrationConfig,
    vpcConfig: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.enabled) {
      if (!vpcConfig) {
        errors.push('VPC configuration is required for FSx integration');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static validateFsxPerformance(
    config: FsxIntegrationConfig,
    performanceConfig: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.enabled) {
      if (!performanceConfig) {
        warnings.push('Performance configuration not specified, using defaults');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
