"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigValidator = void 0;
class ConfigValidator {
    static validateEnvironmentConfig(config) {
        const errors = [];
        const warnings = [];
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
    static validateFsxIntegrationConfig(config) {
        const errors = [];
        const warnings = [];
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
    static validateFsxServerlessCompatibility(config) {
        const issues = [];
        const recommendations = [];
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
    static getFsxOptimizationSuggestions(config) {
        const suggestions = [];
        if (config.enabled) {
            suggestions.push('Consider enabling FSx caching for better performance');
            suggestions.push('Configure appropriate backup policies');
        }
        return suggestions;
    }
    static validateFsxCredentials(config, environment) {
        const errors = [];
        const warnings = [];
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
    static validateFsxNetworking(config, vpcConfig) {
        const errors = [];
        const warnings = [];
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
    static validateFsxPerformance(config, performanceConfig) {
        const errors = [];
        const warnings = [];
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
exports.ConfigValidator = ConfigValidator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLXZhbGlkYXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbmZpZy12YWxpZGF0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBY0EsTUFBYSxlQUFlO0lBQzFCLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxNQUF5QjtRQUN4RCxNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7UUFDNUIsTUFBTSxRQUFRLEdBQWEsRUFBRSxDQUFDO1FBRTlCLG1CQUFtQjtRQUNuQixJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3hCLE1BQU0sQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUMxQyxDQUFDO1FBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN4QixNQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDekMsQ0FBQztRQUVELE9BQU87WUFDTCxPQUFPLEVBQUUsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDO1lBQzVCLE1BQU07WUFDTixRQUFRO1NBQ1QsQ0FBQztJQUNKLENBQUM7SUFFRCxNQUFNLENBQUMsNEJBQTRCLENBQUMsTUFBNEI7UUFDOUQsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO1FBQzVCLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztRQUU5QixJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNuQixJQUFJLENBQUMsTUFBTSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUM1QixNQUFNLENBQUMsSUFBSSxDQUFDLGdFQUFnRSxDQUFDLENBQUM7WUFDaEYsQ0FBQztZQUVELElBQUksQ0FBQyxNQUFNLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztnQkFDL0IsUUFBUSxDQUFDLElBQUksQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDO1lBQzFELENBQUM7UUFDSCxDQUFDO1FBRUQsT0FBTztZQUNMLE9BQU8sRUFBRSxNQUFNLENBQUMsTUFBTSxLQUFL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cnQgeyBFbnZpcm9ubWVudENvbmZpZywgRnN4SW50ZWdyYXRpb25Db25maWcgfSBmcm9tICcuLi9pbnRlcmZhY2VzL2Vudmlyb25tZW50LWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmFsaWRhdGlvblJlc3VsdCB7XG4gIGlzVmFsaWQ6IGJvb2xlYW47XG4gIGVycm9yczogc3RyaW5nW107XG4gIHdhcm5pbmdzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb21wYXRpYmlsaXR5UmVzdWx0IHtcbiAgaXNDb21wYXRpYmxlOiBib29sZWFuO1xuICBpc3N1ZXM6IHN0cmluZ1tdO1xuICByZWNvbW1lbmRhdGlvbnM6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgY2xhc3MgQ29uZmlnVmFsaWRhdG9yIHtcbiAgc3RhdGljIHZhbGlkYXRlRW52aXJvbm1lbnRDb25maWcoY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZyk6IFZhbGlkYXRpb25SZXN1bHQge1xuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcblxuICAgIC8vIEJhc2ljIHZhbGlkYXRpb25cbiAgICBpZiAoIWNvbmZpZy5wcm9qZWN0TmFtZSkge1xuICAgICAgZXJyb3JzLnB1c2goJ1Byb2plY3QgbmFtZSBpcyByZXF1aXJlZCcpO1xuICAgIH1cblxuICAgIGlmICghY29uZmlnLmVudmlyb25tZW50KSB7XG4gICAgICBlcnJvcnMucHVzaCgnRW52aXJvbm1lbnQgaXMgcmVxdWlyZWQnKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgaXNWYWxpZDogZXJyb3JzLmxlbmd0aCA9PT0gMCxcbiAgICAgIGVycm9ycyxcbiAgICAgIHdhcm5pbmdzXG4gICAgfTtcbiAgfVxuXG4gIHN0YXRpYyB2YWxpZGF0ZUZzeEludGVncmF0aW9uQ29uZmlnKGNvbmZpZzogRnN4SW50ZWdyYXRpb25Db25maWcpOiBWYWxpZGF0aW9uUmVzdWx0IHtcbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG5cbiAgICBpZiAoY29uZmlnLmVuYWJsZWQpIHtcbiAgICAgIGlmICghY29uZmlnLmZzeEZpbGVTeXN0ZW1JZCkge1xuICAgICAgICBlcnJvcnMucHVzaCgnRlN4IGZpbGUgc3lzdGVtIElEIGlzIHJlcXVpcmVkIHdoZW4gRlN4IGludGVncmF0aW9uIGlzIGVuYWJsZWQnKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFjb25maWcub250YXBNYW5hZ2VtZW50TGlmKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goJ09OVEFQIG1hbmFnZW1lbnQgTElGIGlzIG5vdCBjb25maWd1cmVkJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlzVmFsaWQ6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgICBlcnJvcnMsXG4gICAgICB3YXJuaW5nc1xuICAgIH07XG4gIH1cblxuICBzdGF0aWMgdmFsaWRhdGVGc3hTZXJ2ZXJsZXNzQ29tcGF0aWJpbGl0eShjb25maWc6IEZzeEludGVncmF0aW9uQ29uZmlnKTogQ29tcGF0aWJpbGl0eVJlc3VsdCB7XG4gICAgY29uc3QgaXNzdWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHJlY29tbWVuZGF0aW9uczogc3RyaW5nW10gPSBbXTtcblxuICAgIGlmIChjb25maWcuZW5hYmxlZCAmJiAhY29uZmlnLmZzeEZpbGVTeXN0ZW1JZCkge1xuICAgICAgaXNzdWVzLnB1c2goJ0ZTeCBmaWxlIHN5c3RlbSBJRCBpcyByZXF1aXJlZCBmb3Igc2VydmVybGVzcyBjb21wYXRpYmlsaXR5Jyk7XG4gICAgICByZWNvbW1lbmRhdGlvbnMucHVzaCgnQ29uZmlndXJlIEZTeCBmaWxlIHN5c3RlbSBJRCBpbiB0aGUgZW52aXJvbm1lbnQgY29uZmlnJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlzQ29tcGF0aWJsZTogaXNzdWVzLmxlbmd0aCA9PT0gMCxcbiAgICAgIGlzc3VlcyxcbiAgICAgIHJlY29tbWVuZGF0aW9uc1xuICAgIH07XG4gIH1cblxuICBzdGF0aWMgZ2V0RnN4T3B0aW1pemF0aW9uU3VnZ2VzdGlvbnMoY29uZmlnOiBGc3hJbnRlZ3JhdGlvbkNvbmZpZyk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBzdWdnZXN0aW9uczogc3RyaW5nW10gPSBbXTtcblxuICAgIGlmIChjb25maWcuZW5hYmxlZCkge1xuICAgICAgc3VnZ2VzdGlvbnMucHVzaCgnQ29uc2lkZXIgZW5hYmxpbmcgRlN4IGNhY2hpbmcgZm9yIGJldHRlciBwZXJmb3JtYW5jZScpO1xuICAgICAgc3VnZ2VzdGlvbnMucHVzaCgnQ29uZmlndXJlIGFwcHJvcHJpYXRlIGJhY2t1cCBwb2xpY2llcycpO1xuICAgIH1cblxuICAgIHJldHVybiBzdWdnZXN0aW9ucztcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIHZhbGlkYXRlRnN4Q3JlZGVudGlhbHMoXG4gICAgY29uZmlnOiBGc3hJbnRlZ3JhdGlvbkNvbmZpZyxcbiAgICBlbnZpcm9ubWVudDogc3RyaW5nXG4gICk6IFZhbGlkYXRpb25SZXN1bHQge1xuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcblxuICAgIGlmIChjb25maWcuZW5hYmxlZCAmJiBjb25maWcuY3JlZGVudGlhbHMpIHtcbiAgICAgIGlmICghY29uZmlnLmNyZWRlbnRpYWxzLnVzZXJuYW1lKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdGU3ggdXNlcm5hbWUgaXMgcmVxdWlyZWQnKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFjb25maWcuY3JlZGVudGlhbHMucGFzc3dvcmQpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goJ0ZTeCBwYXNzd29yZCBpcyByZXF1aXJlZCcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBpc1ZhbGlkOiBlcnJvcnMubGVuZ3RoID09PSAwLFxuICAgICAgZXJyb3JzLFxuICAgICAgd2FybmluZ3NcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBzdGF0aWMgdmFsaWRhdGVGc3hOZXR3b3JraW5nKFxuICAgIGNvbmZpZzogRnN4SW50ZWdyYXRpb25Db25maWcsXG4gICAgdnBjQ29uZmlnOiBhbnlcbiAgKTogVmFsaWRhdGlvblJlc3VsdCB7XG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgaWYgKGNvbmZpZy5lbmFibGVkKSB7XG4gICAgICBpZiAoIXZwY0NvbmZpZykge1xuICAgICAgICBlcnJvcnMucHVzaCgnVlBDIGNvbmZpZ3VyYXRpb24gaXMgcmVxdWlyZWQgZm9yIEZTeCBpbnRlZ3JhdGlvbicpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBpc1ZhbGlkOiBlcnJvcnMubGVuZ3RoID09PSAwLFxuICAgICAgZXJyb3JzLFxuICAgICAgd2FybmluZ3NcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBzdGF0aWMgdmFsaWRhdGVGc3hQZXJmb3JtYW5jZShcbiAgICBjb25maWc6IEZzeEludGVncmF0aW9uQ29uZmlnLFxuICAgIHBlcmZvcm1hbmNlQ29uZmlnOiBhbnlcbiAgKTogVmFsaWRhdGlvblJlc3VsdCB7XG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgaWYgKGNvbmZpZy5lbmFibGVkKSB7XG4gICAgICBpZiAoIXBlcmZvcm1hbmNlQ29uZmlnKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goJ1BlcmZvcm1hbmNlIGNvbmZpZ3VyYXRpb24gbm90IHNwZWNpZmllZCwgdXNpbmcgZGVmYXVsdHMnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgaXNWYWxpZDogZXJyb3JzLmxlbmd0aCA9PT0gMCxcbiAgICAgIGVycm9ycyxcbiAgICAgIHdhcm5pbmdzXG4gICAgfTtcbiAgfVxufVxuIl19