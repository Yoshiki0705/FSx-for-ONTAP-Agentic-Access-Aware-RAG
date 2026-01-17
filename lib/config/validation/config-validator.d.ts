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
export declare class ConfigValidator {
    static validateEnvironmentConfig(config: EnvironmentConfig): ValidationResult;
    static validateFsxIntegrationConfig(config: FsxIntegrationConfig): ValidationResult;
    static validateFsxServerlessCompatibility(config: FsxIntegrationConfig): CompatibilityResult;
    static getFsxOptimizationSuggestions(config: FsxIntegrationConfig): string[];
    private static validateFsxCredentials;
    private static validateFsxNetworking;
    private static validateFsxPerformance;
}
