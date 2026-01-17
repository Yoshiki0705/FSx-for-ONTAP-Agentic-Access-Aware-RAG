"use strict";
/**
 * 環境設定バリデーター
 *
 * FSx for ONTAP と Serverless 統合システムの設定をバリデーションします。
 *
 * @author Kiro AI
 * @date 2026-01-08
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigValidator = void 0;
/**
 * 設定バリデータークラス
 */
class ConfigValidator {
    /**
     * 環境設定をバリデーション
     *
     * @param config 環境設定
     * @returns バリデーション結果
     */
    static validateEnvironmentConfig(config) {
        const errors = [];
        const warnings = [];
        // 基本設定のバリデーション
        this.validateBasicConfig(config, errors, warnings);
        // FSx設定のバリデーション
        if (config.storage?.fsxOntap?.enabled) {
            this.validateFsxOntapConfig(config.storage.fsxOntap, errors, warnings);
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * FSx統合設定をバリデーション
     *
     * @param config FSx統合設定
     * @returns バリデーション結果
     */
    static validateFsxIntegrationConfig(config) {
        const errors = [];
        const warnings = [];
        // 基本設定のバリデーション
        this.validateFsxIntegrationBasicConfig(config, errors, warnings);
        // FSx設定のバリデーション
        if (config.fsx?.enabled) {
            this.validateFsxConfig(config.fsx, errors, warnings);
        }
        // Serverless設定のバリデーション
        if (config.serverless?.enabled) {
            this.validateServerlessConfig(config.serverless, errors, warnings);
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * 互換性チェック
     *
     * @param config 環境設定
     * @returns 互換性チェック結果
     */
    static validateCompatibility(config) {
        const errors = [];
        const warnings = [];
        // リージョン互換性チェック
        this.checkRegionCompatibility(config, errors, warnings);
        return {
            isCompatible: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * FSx-Serverless互換性チェック
     *
     * @param config FSx統合設定
     * @returns 互換性チェック結果
     */
    static validateFsxServerlessCompatibility(config) {
        const errors = [];
        const warnings = [];
        // FSxとServerlessの互換性チェック
        if (config.fsx?.enabled && config.serverless?.enabled) {
            this.checkFsxServerlessCompatibility(config, errors, warnings);
        }
        // リージョン互換性チェック
        this.checkFsxIntegrationRegionCompatibility(config, errors, warnings);
        return {
            isCompatible: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * 最適化提案の取得
     *
     * @param config 環境設定
     * @returns 最適化提案リスト
     */
    static getOptimizationSuggestions(config) {
        const suggestions = [];
        // FSx最適化提案
        if (config.storage?.fsxOntap?.enabled) {
            this.getFsxOntapOptimizationSuggestions(config.storage.fsxOntap, suggestions);
        }
        return suggestions;
    }
    /**
     * FSx統合最適化提案の取得
     *
     * @param config FSx統合設定
     * @returns 最適化提案リスト
     */
    static getFsxOptimizationSuggestions(config) {
        const suggestions = [];
        // FSx最適化提案
        if (config.fsx?.enabled) {
            this.getFsxIntegrationOptimizationSuggestions(config.fsx, suggestions);
        }
        // Serverless最適化提案
        if (config.serverless?.enabled) {
            this.getServerlessOptimizationSuggestions(config.serverless, suggestions);
        }
        return suggestions;
    }
    /**
     * 基本設定のバリデーション
     */
    static validateBasicConfig(config, errors, warnings) {
        // 環境名チェック
        if (!config.environment) {
            errors.push('Environment is required');
        }
        else if (!['development', 'staging', 'production', 'dev', 'prod'].includes(config.environment)) {
            warnings.push('Environment should be one of: development, staging, production');
        }
        // リージョンチェック
        if (!config.region) {
            errors.push('Region is required');
        }
        else if (!config.region.match(/^[a-z]{2}-[a-z]+-\d+$/)) {
            errors.push('Region format is invalid (expected: us-east-1, ap-northeast-1, etc.)');
        }
        // プロジェクト設定チェック
        if (!config.project?.name) {
            errors.push('Project name is required');
        }
        else if (!/^[a-z0-9-]+$/.test(config.project.name)) {
            errors.push('Project name must contain only lowercase letters, numbers, and hyphens');
        }
    }
    /**
     * FSx統合基本設定のバリデーション
     */
    static validateFsxIntegrationBasicConfig(config, errors, warnings) {
        // プロジェクト名チェック
        if (!config.projectName) {
            errors.push('Project name is required');
        }
        else if (!/^[a-z0-9-]+$/.test(config.projectName)) {
            errors.push('Project name must contain only lowercase letters, numbers, and hyphens');
        }
        // 環境名チェック
        if (!config.environment) {
            errors.push('Environment is required');
        }
        else if (!['development', 'staging', 'production'].includes(config.environment)) {
            warnings.push('Environment should be one of: development, staging, production');
        }
        // リージョンチェック
        if (!config.region) {
            errors.push('Region is required');
        }
        else if (!config.region.match(/^[a-z]{2}-[a-z]+-\d+$/)) {
            errors.push('Region format is invalid (expected: us-east-1, ap-northeast-1, etc.)');
        }
        // アカウントIDチェック
        if (!config.accountId) {
            errors.push('Account ID is required');
        }
        else if (config.accountId === 'REPLACE_WITH_YOUR_ACCOUNT_ID') {
            errors.push('Account ID must be replaced with actual AWS account ID');
        }
        else if (!/^\d{12}$/.test(config.accountId)) {
            errors.push('Account ID must be a 12-digit number');
        }
    }
    /**
     * FSx ONTAP設定のバリデーション（既存システム用）
     */
    static validateFsxOntapConfig(fsxConfig, errors, warnings) {
        // ストレージ容量チェック
        if (!fsxConfig.storageCapacity || fsxConfig.storageCapacity < 1024) {
            errors.push('FSx ONTAP: Storage capacity must be at least 1024 GB');
        }
        // スループット容量チェック
        if (!fsxConfig.throughputCapacity || fsxConfig.throughputCapacity < 128) {
            errors.push('FSx ONTAP: Throughput capacity must be at least 128 MB/s');
        }
        // デプロイメントタイプチェック
        if (!['SINGLE_AZ_1', 'MULTI_AZ_1'].includes(fsxConfig.deploymentType)) {
            errors.push('FSx ONTAP: Deployment type must be SINGLE_AZ_1 or MULTI_AZ_1');
        }
    }
    /**
     * FSx設定のバリデーション（統合システム用）
     */
    static validateFsxConfig(fsxConfig, errors, warnings) {
        // ファイルシステム設定チェック
        if (!fsxConfig.fileSystems || fsxConfig.fileSystems.length === 0) {
            errors.push('At least one FSx file system must be configured');
            return;
        }
        fsxConfig.fileSystems.forEach((fs, index) => {
            if (!fs.enabled)
                return;
            // ストレージ容量チェック
            if (!fs.storageCapacity || fs.storageCapacity < 1024) {
                errors.push(`File system ${index}: Storage capacity must be at least 1024 GB`);
            }
            // スループット容量チェック
            if (!fs.throughputCapacity || fs.throughputCapacity < 128) {
                errors.push(`File system ${index}: Throughput capacity must be at least 128 MB/s`);
            }
            // デプロイメントタイプチェック
            if (!['SINGLE_AZ_1', 'MULTI_AZ_1'].includes(fs.deploymentType)) {
                errors.push(`File system ${index}: Deployment type must be SINGLE_AZ_1 or MULTI_AZ_1`);
            }
            // 本番環境でのSINGLE_AZ警告
            if (fs.deploymentType === 'SINGLE_AZ_1') {
                warnings.push(`File system ${index}: Consider using MULTI_AZ_1 for production environments`);
            }
            // ネットワーク設定チェック
            if (!fs.network?.subnetIds || fs.network.subnetIds.length === 0) {
                errors.push(`File system ${index}: At least one subnet ID is required`);
            }
            if (!fs.network?.securityGroupIds || fs.network.securityGroupIds.length === 0) {
                errors.push(`File system ${index}: At least one security group ID is required`);
            }
            // プレースホルダーチェック
            fs.network?.subnetIds?.forEach((subnetId, subIndex) => {
                if (subnetId.includes('REPLACE_WITH')) {
                    errors.push(`File system ${index}, subnet ${subIndex}: Subnet ID must be replaced with actual value`);
                }
            });
        });
        // ボリューム設定チェック
        if (fsxConfig.volumes) {
            fsxConfig.volumes.forEach((volume, index) => {
                if (!volume.enabled)
                    return;
                if (!volume.sizeInMegabytes || volume.sizeInMegabytes < 1024) {
                    errors.push(`Volume ${index}: Size must be at least 1024 MB`);
                }
                if (!['UNIX', 'NTFS', 'MIXED'].includes(volume.securityStyle)) {
                    errors.push(`Volume ${index}: Security style must be UNIX, NTFS, or MIXED`);
                }
            });
        }
    }
    /**
     * Serverless設定のバリデーション
     */
    static validateServerlessConfig(serverlessConfig, errors, warnings) {
        // Lambda関数設定チェック
        if (serverlessConfig.lambda?.functions) {
            serverlessConfig.lambda.functions.forEach((func, index) => {
                if (!func.enabled)
                    return;
                // タイムアウトチェック
                if (func.timeout > 900) {
                    errors.push(`Lambda function ${index}: Timeout cannot exceed 900 seconds`);
                }
                // メモリサイズチェック
                if (func.memorySize < 128 || func.memorySize > 10240) {
                    errors.push(`Lambda function ${index}: Memory size must be between 128 and 10240 MB`);
                }
                if (func.memorySize % 64 !== 0) {
                    errors.push(`Lambda function ${index}: Memory size must be a multiple of 64 MB`);
                }
                // 高メモリ使用量の警告
                if (func.memorySize > 3008) {
                    warnings.push(`Lambda function ${index}: High memory allocation may increase costs`);
                }
            });
        }
        // Step Functions設定チェック
        if (serverlessConfig.stepFunctions?.enabled) {
            if (serverlessConfig.stepFunctions.execution?.timeout > 31536000) {
                errors.push('Step Functions execution timeout cannot exceed 1 year (31536000 seconds)');
            }
        }
        // SQS設定チェック
        if (serverlessConfig.sqs?.queues) {
            serverlessConfig.sqs.queues.forEach((queue, index) => {
                if (!queue.enabled)
                    return;
                const config = queue.configuration;
                if (config.visibilityTimeoutSeconds > 43200) {
                    errors.push(`SQS queue ${index}: Visibility timeout cannot exceed 43200 seconds`);
                }
                if (config.messageRetentionPeriod > 1209600) {
                    errors.push(`SQS queue ${index}: Message retention period cannot exceed 1209600 seconds`);
                }
            });
        }
    }
    /**
     * FSxとServerlessの互換性チェック
     */
    static checkFsxServerlessCompatibility(config, errors, warnings) {
        // VPC設定の整合性チェック
        const fsxSubnets = config.fsx?.fileSystems
            ?.filter(fs => fs.enabled)
            ?.flatMap(fs => fs.network?.subnetIds || []) || [];
        const lambdaVpcEnabled = config.serverless?.lambda?.functions
            ?.some(func => func.enabled && func.vpc?.enabled) || false;
        if (fsxSubnets.length > 0 && lambdaVpcEnabled) {
            // Lambda関数がVPC内にあり、FSxファイルシステムが存在する場合
            // 同じVPC内にある必要があることを警告
            warnings.push('Ensure Lambda functions and FSx file systems are in the same VPC for optimal performance');
        }
        // ファイルシステムマウント設定チェック
        const fsxMountEnabled = config.serverless?.lambda?.functions
            ?.some(func => func.enabled && func.fileSystem?.enabled) || false;
        if (fsxMountEnabled && fsxSubnets.length === 0) {
            errors.push('Lambda functions with file system mounting require FSx file systems to be configured');
        }
    }
    /**
     * リージョン互換性チェック
     */
    static checkRegionCompatibility(config, errors, warnings) {
        const region = config.region;
        // FSx for ONTAP対応リージョンチェック
        const fsxSupportedRegions = [
            'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
            'eu-west-1', 'eu-west-2', 'eu-central-1',
            'ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2'
        ];
        if (config.storage?.fsxOntap?.enabled && !fsxSupportedRegions.includes(region)) {
            warnings.push(`FSx for ONTAP may not be available in region ${region}. Please verify regional availability.`);
        }
        // 東京リージョン（ap-northeast-1）の最適化提案
        if (region === 'ap-northeast-1') {
            warnings.push('Consider using Multi-AZ deployment for production workloads in Tokyo region for better availability');
        }
    }
    /**
     * FSx統合リージョン互換性チェック
     */
    static checkFsxIntegrationRegionCompatibility(config, errors, warnings) {
        const region = config.region;
        // FSx for ONTAP対応リージョンチェック
        const fsxSupportedRegions = [
            'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
            'eu-west-1', 'eu-west-2', 'eu-central-1',
            'ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2'
        ];
        if (config.fsx?.enabled && !fsxSupportedRegions.includes(region)) {
            warnings.push(`FSx for ONTAP may not be available in region ${region}. Please verify regional availability.`);
        }
        // 東京リージョン（ap-northeast-1）の最適化提案
        if (region === 'ap-northeast-1') {
            warnings.push('Consider using Multi-AZ deployment for production workloads in Tokyo region for better availability');
        }
    }
    /**
     * FSx ONTAP最適化提案（既存システム用）
     */
    static getFsxOntapOptimizationSuggestions(fsxConfig, suggestions) {
        // バックアップ設定提案
        if (fsxConfig.automaticBackupRetentionDays === 0) {
            suggestions.push('Enable automatic backups for data protection');
        }
        // スループット最適化提案
        if (fsxConfig.storageCapacity > 10240 && fsxConfig.throughputCapacity < 512) {
            suggestions.push('Consider increasing throughput capacity for large storage volumes');
        }
    }
    /**
     * FSx統合最適化提案
     */
    static getFsxIntegrationOptimizationSuggestions(fsxConfig, suggestions) {
        fsxConfig.fileSystems?.forEach((fs, index) => {
            if (!fs.enabled)
                return;
            // ストレージ効率化提案
            if (!fs.storageEfficiency) {
                suggestions.push(`File system ${index}: Enable storage efficiency for cost optimization`);
            }
            // バックアップ設定提案
            if (!fs.backup?.enabled) {
                suggestions.push(`File system ${index}: Enable automatic backups for data protection`);
            }
            // 暗号化提案
            if (!fs.encryption?.enabled) {
                suggestions.push(`File system ${index}: Enable encryption for security compliance`);
            }
            // スループット最適化提案
            if (fs.storageCapacity > 10240 && fs.throughputCapacity < 512) {
                suggestions.push(`File system ${index}: Consider increasing throughput capacity for large storage volumes`);
            }
        });
    }
    /**
     * Serverless最適化提案
     */
    static getServerlessOptimizationSuggestions(serverlessConfig, suggestions) {
        // Lambda最適化提案
        serverlessConfig.lambda?.functions?.forEach((func, index) => {
            if (!func.enabled)
                return;
            // メモリとタイムアウトの最適化
            if (func.memorySize === 128 && func.timeout > 30) {
                suggestions.push(`Lambda function ${index}: Consider increasing memory size for better performance with long timeouts`);
            }
            // VPC設定の最適化
            if (func.vpc?.enabled && !func.fileSystem?.enabled) {
                suggestions.push(`Lambda function ${index}: VPC configuration may increase cold start time. Consider if VPC is necessary.`);
            }
        });
        // モニタリング提案
        if (!serverlessConfig.monitoring?.xray?.enabled) {
            suggestions.push('Enable X-Ray tracing for better observability and debugging');
        }
        if (!serverlessConfig.monitoring?.cloudWatch?.enabled) {
            suggestions.push('Enable CloudWatch monitoring for operational insights');
        }
    }
}
exports.ConfigValidator = ConfigValidator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLXZhbGlkYXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbmZpZy12YWxpZGF0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7OztHQVFHOzs7QUE0Q0g7O0dBRUc7QUFDSCxNQUFhLGVBQWU7SUFDMUI7Ozs7O09BS0c7SUFDSCxNQUFNLENBQUMseUJBQXlCLENBQUMsTUFBeUI7UUFDeEQsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO1FBQzVCLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztRQUU5QixlQUFlO1FBQ2YsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFbkQsZ0JBQWdCO1FBQ2hCLElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLENBQUM7WUFDdEMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN6RSxDQUFDO1FBRUQsT0FBTztZQUNMLE9BQU8sRUFBRSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUM7WUFDNUIsTUFBTTtZQUNOLFFBQVE7U0FDVCxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsTUFBTSxDQUFDLDRCQUE0QixDQUFDLE1BQTRCO1FBQzlELE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztRQUM1QixNQUFNLFFBQVEsR0FBYSxFQUFFLENBQUM7UUFFOUIsZUFBZTtRQUNmLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRWpFLGdCQUFnQjtRQUNoQixJQUFJLE1BQU0sQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLFFB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VyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsS0FBSyw2RUFBNkUsQ0FBQyxDQUFDO1lBQzFILENBQUM7WUFFRCxZQUFZO1lBQ1osSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsT0FBTyxFQUFFLENBQUM7Z0JBQ25ELFdBQVcsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEtBQUssaUZBQWlGLENBQUMsQ0FBQztZQUM5SCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxXQUFXO1FBQ1gsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7WUFDaEQsV0FBVyxDQUFDLElBQUksQ0FBQyw2REFBNkQsQ0FBQyxDQUFDO1FBQ2xGLENBQUM7UUFFRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsQ0FBQztZQUN0RCxXQUFXLENBQUMsSUFBSSxDQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFDNUUsQ0FBQztJQUNILENBQUM7Q0FDRjtBQS9nQkQsMENBK2dCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog55Kw5aKD6Kit5a6a44OQ44Oq44OH44O844K/44O8XG4gKiBcbiAqIEZTeCBmb3IgT05UQVAg44GoIFNlcnZlcmxlc3Mg57Wx5ZCI44K344K544OG44Og44Gu6Kit5a6a44KS44OQ44Oq44OH44O844K344On44Oz44GX44G+44GZ44CCXG4gKiBcbiAqIEBhdXRob3IgS2lybyBBSVxuICogQGRhdGUgMjAyNi0wMS0wOFxuICogQHZlcnNpb24gMS4wLjBcbiAqL1xuXG5pbXBvcnQgeyBFbnZpcm9ubWVudENvbmZpZywgRnN4SW50ZWdyYXRpb25Db25maWcgfSBmcm9tICcuLi9pbnRlcmZhY2VzL2Vudmlyb25tZW50LWNvbmZpZyc7XG5cbi8qKlxuICog44OQ44Oq44OH44O844K344On44Oz57WQ5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVmFsaWRhdGlvblJlc3VsdCB7XG4gIC8qKlxuICAgKiDjg5Djg6rjg4fjg7zjgrfjg6fjg7PmiJDlip/jg5Xjg6njgrBcbiAgICovXG4gIHJlYWRvbmx5IGlzVmFsaWQ6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOOCqOODqeODvOODoeODg+OCu+ODvOOCuOODquOCueODiFxuICAgKi9cbiAgcmVhZG9ubHkgZXJyb3JzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICog6K2m5ZGK44Oh44OD44K744O844K444Oq44K544OIXG4gICAqL1xuICByZWFkb25seSB3YXJuaW5nczogc3RyaW5nW107XG59XG5cbi8qKlxuICog5LqS5o+b5oCn44OB44Kn44OD44Kv57WQ5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGF0aWJpbGl0eVJlc3VsdCB7XG4gIC8qKlxuICAgKiDkupLmj5vmgKfjg4Hjgqfjg4Pjgq/miJDlip/jg5Xjg6njgrBcbiAgICovXG4gIHJlYWRvbmx5IGlzQ29tcGF0aWJsZTogYm9vbGVhbjtcblxuICAvKipcbiAgICog6K2m5ZGK44Oh44OD44K744O844K444Oq44K544OIXG4gICAqL1xuICByZWFkb25seSB3YXJuaW5nczogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIOOCqOODqeODvOODoeODg+OCu+ODvOOCuOODquOCueODiFxuICAgKi9cbiAgcmVhZG9ubHkgZXJyb3JzOiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiDoqK3lrprjg5Djg6rjg4fjg7zjgr/jg7zjgq/jg6njgrlcbiAqL1xuZXhwb3J0IGNsYXNzIENvbmZpZ1ZhbGlkYXRvciB7XG4gIC8qKlxuICAgKiDnkrDlooPoqK3lrprjgpLjg5Djg6rjg4fjg7zjgrfjg6fjg7NcbiAgICogXG4gICAqIEBwYXJhbSBjb25maWcg55Kw5aKD6Kit5a6aXG4gICAqIEByZXR1cm5zIOODkOODquODh+ODvOOCt+ODp+ODs+e1kOaenFxuICAgKi9cbiAgc3RhdGljIHZhbGlkYXRlRW52aXJvbm1lbnRDb25maWcoY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZyk6IFZhbGlkYXRpb25SZXN1bHQge1xuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcblxuICAgIC8vIOWfuuacrOioreWumuOBruODkOODquODh+ODvOOCt+ODp+ODs1xuICAgIHRoaXMudmFsaWRhdGVCYXNpY0NvbmZpZyhjb25maWcsIGVycm9ycywgd2FybmluZ3MpO1xuXG4gICAgLy8gRlN46Kit5a6a44Gu44OQ44Oq44OH44O844K344On44OzXG4gICAgaWYgKGNvbmZpZy5zdG9yYWdlPy5mc3hPbnRhcD8uZW5hYmxlZCkge1xuICAgICAgdGhpcy52YWxpZGF0ZUZzeE9udGFwQ29uZmlnKGNvbmZpZy5zdG9yYWdlLmZzeE9udGFwLCBlcnJvcnMsIHdhcm5pbmdzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgaXNWYWxpZDogZXJyb3JzLmxlbmd0aCA9PT0gMCxcbiAgICAgIGVycm9ycyxcbiAgICAgIHdhcm5pbmdzLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRlN457Wx5ZCI6Kit5a6a44KS44OQ44Oq44OH44O844K344On44OzXG4gICAqIFxuICAgKiBAcGFyYW0gY29uZmlnIEZTeOe1seWQiOioreWumlxuICAgKiBAcmV0dXJucyDjg5Djg6rjg4fjg7zjgrfjg6fjg7PntZDmnpxcbiAgICovXG4gIHN0YXRpYyB2YWxpZGF0ZUZzeEludGVncmF0aW9uQ29uZmlnKGNvbmZpZzogRnN4SW50ZWdyYXRpb25Db25maWcpOiBWYWxpZGF0aW9uUmVzdWx0IHtcbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG5cbiAgICAvLyDln7rmnKzoqK3lrprjga7jg5Djg6rjg4fjg7zjgrfjg6fjg7NcbiAgICB0aGlzLnZhbGlkYXRlRnN4SW50ZWdyYXRpb25CYXNpY0NvbmZpZyhjb25maWcsIGVycm9ycywgd2FybmluZ3MpO1xuXG4gICAgLy8gRlN46Kit5a6a44Gu44OQ44Oq44OH44O844K344On44OzXG4gICAgaWYgKGNvbmZpZy5mc3g/LmVuYWJsZWQpIHtcbiAgICAgIHRoaXMudmFsaWRhdGVGc3hDb25maWcoY29uZmlnLmZzeCwgZXJyb3JzLCB3YXJuaW5ncyk7XG4gICAgfVxuXG4gICAgLy8gU2VydmVybGVzc+ioreWumuOBruODkOODquODh+ODvOOCt+ODp+ODs1xuICAgIGlmIChjb25maWcuc2VydmVybGVzcz8uZW5hYmxlZCkge1xuICAgICAgdGhpcy52YWxpZGF0ZVNlcnZlcmxlc3NDb25maWcoY29uZmlnLnNlcnZlcmxlc3MsIGVycm9ycywgd2FybmluZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBpc1ZhbGlkOiBlcnJvcnMubGVuZ3RoID09PSAwLFxuICAgICAgZXJyb3JzLFxuICAgICAgd2FybmluZ3MsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDkupLmj5vmgKfjg4Hjgqfjg4Pjgq9cbiAgICogXG4gICAqIEBwYXJhbSBjb25maWcg55Kw5aKD6Kit5a6aXG4gICAqIEByZXR1cm5zIOS6kuaPm+aAp+ODgeOCp+ODg+OCr+e1kOaenFxuICAgKi9cbiAgc3RhdGljIHZhbGlkYXRlQ29tcGF0aWJpbGl0eShjb25maWc6IEVudmlyb25tZW50Q29uZmlnKTogQ29tcGF0aWJpbGl0eVJlc3VsdCB7XG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8g44Oq44O844K444On44Oz5LqS5o+b5oCn44OB44Kn44OD44KvXG4gICAgdGhpcy5jaGVja1JlZ2lvbkNvbXBhdGliaWxpdHkoY29uZmlnLCBlcnJvcnMsIHdhcm5pbmdzKTtcblxuICAgIHJldHVybiB7XG4gICAgICBpc0NvbXBhdGlibGU6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgICBlcnJvcnMsXG4gICAgICB3YXJuaW5ncyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEZTeC1TZXJ2ZXJsZXNz5LqS5o+b5oCn44OB44Kn44OD44KvXG4gICAqIFxuICAgKiBAcGFyYW0gY29uZmlnIEZTeOe1seWQiOioreWumlxuICAgKiBAcmV0dXJucyDkupLmj5vmgKfjg4Hjgqfjg4Pjgq/ntZDmnpxcbiAgICovXG4gIHN0YXRpYyB2YWxpZGF0ZUZzeFNlcnZlcmxlc3NDb21wYXRpYmlsaXR5KGNvbmZpZzogRnN4SW50ZWdyYXRpb25Db25maWcpOiBDb21wYXRpYmlsaXR5UmVzdWx0IHtcbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG5cbiAgICAvLyBGU3jjgahTZXJ2ZXJsZXNz44Gu5LqS5o+b5oCn44OB44Kn44OD44KvXG4gICAgaWYgKGNvbmZpZy5mc3g/LmVuYWJsZWQgJiYgY29uZmlnLnNlcnZlcmxlc3M/LmVuYWJsZWQpIHtcbiAgICAgIHRoaXMuY2hlY2tGc3hTZXJ2ZXJsZXNzQ29tcGF0aWJpbGl0eShjb25maWcsIGVycm9ycywgd2FybmluZ3MpO1xuICAgIH1cblxuICAgIC8vIOODquODvOOCuOODp+ODs+S6kuaPm+aAp+ODgeOCp+ODg+OCr1xuICAgIHRoaXMuY2hlY2tGc3hJbnRlZ3JhdGlvblJlZ2lvbkNvbXBhdGliaWxpdHkoY29uZmlnLCBlcnJvcnMsIHdhcm5pbmdzKTtcblxuICAgIHJldHVybiB7XG4gICAgICBpc0NvbXBhdGlibGU6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgICBlcnJvcnMsXG4gICAgICB3YXJuaW5ncyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOacgOmBqeWMluaPkOahiOOBruWPluW+l1xuICAgKiBcbiAgICogQHBhcmFtIGNvbmZpZyDnkrDlooPoqK3lrppcbiAgICogQHJldHVybnMg5pyA6YGp5YyW5o+Q5qGI44Oq44K544OIXG4gICAqL1xuICBzdGF0aWMgZ2V0T3B0aW1pemF0aW9uU3VnZ2VzdGlvbnMoY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZyk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBzdWdnZXN0aW9uczogc3RyaW5nW10gPSBbXTtcblxuICAgIC8vIEZTeOacgOmBqeWMluaPkOahiFxuICAgIGlmIChjb25maWcuc3RvcmFnZT8uZnN4T250YXA/LmVuYWJsZWQpIHtcbiAgICAgIHRoaXMuZ2V0RnN4T250YXBPcHRpbWl6YXRpb25TdWdnZXN0aW9ucyhjb25maWcuc3RvcmFnZS5mc3hPbnRhcCwgc3VnZ2VzdGlvbnMpO1xuICAgIH1cblxuICAgIHJldHVybiBzdWdnZXN0aW9ucztcbiAgfVxuXG4gIC8qKlxuICAgKiBGU3jntbHlkIjmnIDpganljJbmj5DmoYjjga7lj5blvpdcbiAgICogXG4gICAqIEBwYXJhbSBjb25maWcgRlN457Wx5ZCI6Kit5a6aXG4gICAqIEByZXR1cm5zIOacgOmBqeWMluaPkOahiOODquOCueODiFxuICAgKi9cbiAgc3RhdGljIGdldEZzeE9wdGltaXphdGlvblN1Z2dlc3Rpb25zKGNvbmZpZzogRnN4SW50ZWdyYXRpb25Db25maWcpOiBzdHJpbmdbXSB7XG4gICAgY29uc3Qgc3VnZ2VzdGlvbnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAvLyBGU3jmnIDpganljJbmj5DmoYhcbiAgICBpZiAoY29uZmlnLmZzeD8uZW5hYmxlZCkge1xuICAgICAgdGhpcy5nZXRGc3hJbnRlZ3JhdGlvbk9wdGltaXphdGlvblN1Z2dlc3Rpb25zKGNvbmZpZy5mc3gsIHN1Z2dlc3Rpb25zKTtcbiAgICB9XG5cbiAgICAvLyBTZXJ2ZXJsZXNz5pyA6YGp5YyW5o+Q5qGIXG4gICAgaWYgKGNvbmZpZy5zZXJ2ZXJsZXNzPy5lbmFibGVkKSB7XG4gICAgICB0aGlzLmdldFNlcnZlcmxlc3NPcHRpbWl6YXRpb25TdWdnZXN0aW9ucyhjb25maWcuc2VydmVybGVzcywgc3VnZ2VzdGlvbnMpO1xuICAgIH1cblxuICAgIHJldHVybiBzdWdnZXN0aW9ucztcbiAgfVxuXG4gIC8qKlxuICAgKiDln7rmnKzoqK3lrprjga7jg5Djg6rjg4fjg7zjgrfjg6fjg7NcbiAgICovXG4gIHByaXZhdGUgc3RhdGljIHZhbGlkYXRlQmFzaWNDb25maWcoXG4gICAgY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZyxcbiAgICBlcnJvcnM6IHN0cmluZ1tdLFxuICAgIHdhcm5pbmdzOiBzdHJpbmdbXVxuICApOiB2b2lkIHtcbiAgICAvLyDnkrDlooPlkI3jg4Hjgqfjg4Pjgq9cbiAgICBpZiAoIWNvbmZpZy5lbnZpcm9ubWVudCkge1xuICAgICAgZXJyb3JzLnB1c2goJ0Vudmlyb25tZW50IGlzIHJlcXVpcmVkJyk7XG4gICAgfSBlbHNlIGlmICghWydkZXZlbG9wbWVudCcsICdzdGFnaW5nJywgJ3Byb2R1Y3Rpb24nLCAnZGV2JywgJ3Byb2QnXS5pbmNsdWRlcyhjb25maWcuZW52aXJvbm1lbnQpKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKCdFbnZpcm9ubWVudCBzaG91bGQgYmUgb25lIG9mOiBkZXZlbG9wbWVudCwgc3RhZ2luZywgcHJvZHVjdGlvbicpO1xuICAgIH1cblxuICAgIC8vIOODquODvOOCuOODp+ODs+ODgeOCp+ODg+OCr1xuICAgIGlmICghY29uZmlnLnJlZ2lvbikge1xuICAgICAgZXJyb3JzLnB1c2goJ1JlZ2lvbiBpcyByZXF1aXJlZCcpO1xuICAgIH0gZWxzZSBpZiAoIWNvbmZpZy5yZWdpb24ubWF0Y2goL15bYS16XXsyfS1bYS16XSstXFxkKyQvKSkge1xuICAgICAgZXJyb3JzLnB1c2goJ1JlZ2lvbiBmb3JtYXQgaXMgaW52YWxpZCAoZXhwZWN0ZWQ6IHVzLWVhc3QtMSwgYXAtbm9ydGhlYXN0LTEsIGV0Yy4pJyk7XG4gICAgfVxuXG4gICAgLy8g44OX44Ot44K444Kn44Kv44OI6Kit5a6a44OB44Kn44OD44KvXG4gICAgaWYgKCFjb25maWcucHJvamVjdD8ubmFtZSkge1xuICAgICAgZXJyb3JzLnB1c2goJ1Byb2plY3QgbmFtZSBpcyByZXF1aXJlZCcpO1xuICAgIH0gZWxzZSBpZiAoIS9eW2EtejAtOS1dKyQvLnRlc3QoY29uZmlnLnByb2plY3QubmFtZSkpIHtcbiAgICAgIGVycm9ycy5wdXNoKCdQcm9qZWN0IG5hbWUgbXVzdCBjb250YWluIG9ubHkgbG93ZXJjYXNlIGxldHRlcnMsIG51bWJlcnMsIGFuZCBoeXBoZW5zJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZTeOe1seWQiOWfuuacrOioreWumuOBruODkOODquODh+ODvOOCt+ODp+ODs1xuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgdmFsaWRhdGVGc3hJbnRlZ3JhdGlvbkJhc2ljQ29uZmlnKFxuICAgIGNvbmZpZzogRnN4SW50ZWdyYXRpb25Db25maWcsXG4gICAgZXJyb3JzOiBzdHJpbmdbXSxcbiAgICB3YXJuaW5nczogc3RyaW5nW11cbiAgKTogdm9pZCB7XG4gICAgLy8g44OX44Ot44K444Kn44Kv44OI5ZCN44OB44Kn44OD44KvXG4gICAgaWYgKCFjb25maWcucHJvamVjdE5hbWUpIHtcbiAgICAgIGVycm9ycy5wdXNoKCdQcm9qZWN0IG5hbWUgaXMgcmVxdWlyZWQnKTtcbiAgICB9IGVsc2UgaWYgKCEvXlthLXowLTktXSskLy50ZXN0KGNvbmZpZy5wcm9qZWN0TmFtZSkpIHtcbiAgICAgIGVycm9ycy5wdXNoKCdQcm9qZWN0IG5hbWUgbXVzdCBjb250YWluIG9ubHkgbG93ZXJjYXNlIGxldHRlcnMsIG51bWJlcnMsIGFuZCBoeXBoZW5zJyk7XG4gICAgfVxuXG4gICAgLy8g55Kw5aKD5ZCN44OB44Kn44OD44KvXG4gICAgaWYgKCFjb25maWcuZW52aXJvbm1lbnQpIHtcbiAgICAgIGVycm9ycy5wdXNoKCdFbnZpcm9ubWVudCBpcyByZXF1aXJlZCcpO1xuICAgIH0gZWxzZSBpZiAoIVsnZGV2ZWxvcG1lbnQnLCAnc3RhZ2luZycsICdwcm9kdWN0aW9uJ10uaW5jbHVkZXMoY29uZmlnLmVudmlyb25tZW50KSkge1xuICAgICAgd2FybmluZ3MucHVzaCgnRW52aXJvbm1lbnQgc2hvdWxkIGJlIG9uZSBvZjogZGV2ZWxvcG1lbnQsIHN0YWdpbmcsIHByb2R1Y3Rpb24nKTtcbiAgICB9XG5cbiAgICAvLyDjg6rjg7zjgrjjg6fjg7Pjg4Hjgqfjg4Pjgq9cbiAgICBpZiAoIWNvbmZpZy5yZWdpb24pIHtcbiAgICAgIGVycm9ycy5wdXNoKCdSZWdpb24gaXMgcmVxdWlyZWQnKTtcbiAgICB9IGVsc2UgaWYgKCFjb25maWcucmVnaW9uLm1hdGNoKC9eW2Etel17Mn0tW2Etel0rLVxcZCskLykpIHtcbiAgICAgIGVycm9ycy5wdXNoKCdSZWdpb24gZm9ybWF0IGlzIGludmFsaWQgKGV4cGVjdGVkOiB1cy1lYXN0LTEsIGFwLW5vcnRoZWFzdC0xLCBldGMuKScpO1xuICAgIH1cblxuICAgIC8vIOOCouOCq+OCpuODs+ODiElE44OB44Kn44OD44KvXG4gICAgaWYgKCFjb25maWcuYWNjb3VudElkKSB7XG4gICAgICBlcnJvcnMucHVzaCgnQWNjb3VudCBJRCBpcyByZXF1aXJlZCcpO1xuICAgIH0gZWxzZSBpZiAoY29uZmlnLmFjY291bnRJZCA9PT0gJ1JFUExBQ0VfV0lUSF9ZT1VSX0FDQ09VTlRfSUQnKSB7XG4gICAgICBlcnJvcnMucHVzaCgnQWNjb3VudCBJRCBtdXN0IGJlIHJlcGxhY2VkIHdpdGggYWN0dWFsIEFXUyBhY2NvdW50IElEJyk7XG4gICAgfSBlbHNlIGlmICghL15cXGR7MTJ9JC8udGVzdChjb25maWcuYWNjb3VudElkKSkge1xuICAgICAgZXJyb3JzLnB1c2goJ0FjY291bnQgSUQgbXVzdCBiZSBhIDEyLWRpZ2l0IG51bWJlcicpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGU3ggT05UQVDoqK3lrprjga7jg5Djg6rjg4fjg7zjgrfjg6fjg7PvvIjml6LlrZjjgrfjgrnjg4bjg6DnlKjvvIlcbiAgICovXG4gIHByaXZhdGUgc3RhdGljIHZhbGlkYXRlRnN4T250YXBDb25maWcoXG4gICAgZnN4Q29uZmlnOiBhbnksXG4gICAgZXJyb3JzOiBzdHJpbmdbXSxcbiAgICB3YXJuaW5nczogc3RyaW5nW11cbiAgKTogdm9pZCB7XG4gICAgLy8g44K544OI44Os44O844K45a656YeP44OB44Kn44OD44KvXG4gICAgaWYgKCFmc3hDb25maWcuc3RvcmFnZUNhcGFjaXR5IHx8IGZzeENvbmZpZy5zdG9yYWdlQ2FwYWNpdHkgPCAxMDI0KSB7XG4gICAgICBlcnJvcnMucHVzaCgnRlN4IE9OVEFQOiBTdG9yYWdlIGNhcGFjaXR5IG11c3QgYmUgYXQgbGVhc3QgMTAyNCBHQicpO1xuICAgIH1cblxuICAgIC8vIOOCueODq+ODvOODl+ODg+ODiOWuuemHj+ODgeOCp+ODg+OCr1xuICAgIGlmICghZnN4Q29uZmlnLnRocm91Z2hwdXRDYXBhY2l0eSB8fCBmc3hDb25maWcudGhyb3VnaHB1dENhcGFjaXR5IDwgMTI4KSB7XG4gICAgICBlcnJvcnMucHVzaCgnRlN4IE9OVEFQOiBUaHJvdWdocHV0IGNhcGFjaXR5IG11c3QgYmUgYXQgbGVhc3QgMTI4IE1CL3MnKTtcbiAgICB9XG5cbiAgICAvLyDjg4fjg5fjg63jgqTjg6Hjg7Pjg4jjgr/jgqTjg5fjg4Hjgqfjg4Pjgq9cbiAgICBpZiAoIVsnU0lOR0xFX0FaXzEnLCAnTVVMVElfQVpfMSddLmluY2x1ZGVzKGZzeENvbmZpZy5kZXBsb3ltZW50VHlwZSkpIHtcbiAgICAgIGVycm9ycy5wdXNoKCdGU3ggT05UQVA6IERlcGxveW1lbnQgdHlwZSBtdXN0IGJlIFNJTkdMRV9BWl8xIG9yIE1VTFRJX0FaXzEnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRlN46Kit5a6a44Gu44OQ44Oq44OH44O844K344On44Oz77yI57Wx5ZCI44K344K544OG44Og55So77yJXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyB2YWxpZGF0ZUZzeENvbmZpZyhcbiAgICBmc3hDb25maWc6IGFueSxcbiAgICBlcnJvcnM6IHN0cmluZ1tdLFxuICAgIHdhcm5pbmdzOiBzdHJpbmdbXVxuICApOiB2b2lkIHtcbiAgICAvLyDjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6DoqK3lrprjg4Hjgqfjg4Pjgq9cbiAgICBpZiAoIWZzeENvbmZpZy5maWxlU3lzdGVtcyB8fCBmc3hDb25maWcuZmlsZVN5c3RlbXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBlcnJvcnMucHVzaCgnQXQgbGVhc3Qgb25lIEZTeCBmaWxlIHN5c3RlbSBtdXN0IGJlIGNvbmZpZ3VyZWQnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmc3hDb25maWcuZmlsZVN5c3RlbXMuZm9yRWFjaCgoZnM6IGFueSwgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgaWYgKCFmcy5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgIC8vIOOCueODiOODrOODvOOCuOWuuemHj+ODgeOCp+ODg+OCr1xuICAgICAgaWYgKCFmcy5zdG9yYWdlQ2FwYWNpdHkgfHwgZnMuc3RvcmFnZUNhcGFjaXR5IDwgMTAyNCkge1xuICAgICAgICBlcnJvcnMucHVzaChgRmlsZSBzeXN0ZW0gJHtpbmRleH06IFN0b3JhZ2UgY2FwYWNpdHkgbXVzdCBiZSBhdCBsZWFzdCAxMDI0IEdCYCk7XG4gICAgICB9XG5cbiAgICAgIC8vIOOCueODq+ODvOODl+ODg+ODiOWuuemHj+ODgeOCp+ODg+OCr1xuICAgICAgaWYgKCFmcy50aHJvdWdocHV0Q2FwYWNpdHkgfHwgZnMudGhyb3VnaHB1dENhcGFjaXR5IDwgMTI4KSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGBGaWxlIHN5c3RlbSAke2luZGV4fTogVGhyb3VnaHB1dCBjYXBhY2l0eSBtdXN0IGJlIGF0IGxlYXN0IDEyOCBNQi9zYCk7XG4gICAgICB9XG5cbiAgICAgIC8vIOODh+ODl+ODreOCpOODoeODs+ODiOOCv+OCpOODl+ODgeOCp+ODg+OCr1xuICAgICAgaWYgKCFbJ1NJTkdMRV9BWl8xJywgJ01VTFRJX0FaXzEnXS5pbmNsdWRlcyhmcy5kZXBsb3ltZW50VHlwZSkpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goYEZpbGUgc3lzdGVtICR7aW5kZXh9OiBEZXBsb3ltZW50IHR5cGUgbXVzdCBiZSBTSU5HTEVfQVpfMSBvciBNVUxUSV9BWl8xYCk7XG4gICAgICB9XG5cbiAgICAgIC8vIOacrOeVqueSsOWig+OBp+OBrlNJTkdMRV9BWuitpuWRilxuICAgICAgaWYgKGZzLmRlcGxveW1lbnRUeXBlID09PSAnU0lOR0xFX0FaXzEnKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goYEZpbGUgc3lzdGVtICR7aW5kZXh9OiBDb25zaWRlciB1c2luZyBNVUxUSV9BWl8xIGZvciBwcm9kdWN0aW9uIGVudmlyb25tZW50c2ApO1xuICAgICAgfVxuXG4gICAgICAvLyDjg43jg4Pjg4jjg6/jg7zjgq/oqK3lrprjg4Hjgqfjg4Pjgq9cbiAgICAgIGlmICghZnMubmV0d29yaz8uc3VibmV0SWRzIHx8IGZzLm5ldHdvcmsuc3VibmV0SWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBlcnJvcnMucHVzaChgRmlsZSBzeXN0ZW0gJHtpbmRleH06IEF0IGxlYXN0IG9uZSBzdWJuZXQgSUQgaXMgcmVxdWlyZWRgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFmcy5uZXR3b3JrPy5zZWN1cml0eUdyb3VwSWRzIHx8IGZzLm5ldHdvcmsuc2VjdXJpdHlHcm91cElkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgZXJyb3JzLnB1c2goYEZpbGUgc3lzdGVtICR7aW5kZXh9OiBBdCBsZWFzdCBvbmUgc2VjdXJpdHkgZ3JvdXAgSUQgaXMgcmVxdWlyZWRgKTtcbiAgICAgIH1cblxuICAgICAgLy8g44OX44Os44O844K544Ob44Or44OA44O844OB44Kn44OD44KvXG4gICAgICBmcy5uZXR3b3JrPy5zdWJuZXRJZHM/LmZvckVhY2goKHN1Ym5ldElkOiBzdHJpbmcsIHN1YkluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgaWYgKHN1Ym5ldElkLmluY2x1ZGVzKCdSRVBMQUNFX1dJVEgnKSkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKGBGaWxlIHN5c3RlbSAke2luZGV4fSwgc3VibmV0ICR7c3ViSW5kZXh9OiBTdWJuZXQgSUQgbXVzdCBiZSByZXBsYWNlZCB3aXRoIGFjdHVhbCB2YWx1ZWApO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIOODnOODquODpeODvOODoOioreWumuODgeOCp+ODg+OCr1xuICAgIGlmIChmc3hDb25maWcudm9sdW1lcykge1xuICAgICAgZnN4Q29uZmlnLnZvbHVtZXMuZm9yRWFjaCgodm9sdW1lOiBhbnksIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgaWYgKCF2b2x1bWUuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICghdm9sdW1lLnNpemVJbk1lZ2FieXRlcyB8fCB2b2x1bWUuc2l6ZUluTWVnYWJ5dGVzIDwgMTAyNCkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKGBWb2x1bWUgJHtpbmRleH06IFNpemUgbXVzdCBiZSBhdCBsZWFzdCAxMDI0IE1CYCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIVsnVU5JWCcsICdOVEZTJywgJ01JWEVEJ10uaW5jbHVkZXModm9sdW1lLnNlY3VyaXR5U3R5bGUpKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goYFZvbHVtZSAke2luZGV4fTogU2VjdXJpdHkgc3R5bGUgbXVzdCBiZSBVTklYLCBOVEZTLCBvciBNSVhFRGApO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2VydmVybGVzc+ioreWumuOBruODkOODquODh+ODvOOCt+ODp+ODs1xuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgdmFsaWRhdGVTZXJ2ZXJsZXNzQ29uZmlnKFxuICAgIHNlcnZlcmxlc3NDb25maWc6IGFueSxcbiAgICBlcnJvcnM6IHN0cmluZ1tdLFxuICAgIHdhcm5pbmdzOiBzdHJpbmdbXVxuICApOiB2b2lkIHtcbiAgICAvLyBMYW1iZGHplqLmlbDoqK3lrprjg4Hjgqfjg4Pjgq9cbiAgICBpZiAoc2VydmVybGVzc0NvbmZpZy5sYW1iZGE/LmZ1bmN0aW9ucykge1xuICAgICAgc2VydmVybGVzc0NvbmZpZy5sYW1iZGEuZnVuY3Rpb25zLmZvckVhY2goKGZ1bmM6IGFueSwgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICBpZiAoIWZ1bmMuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIC8vIOOCv+OCpOODoOOCouOCpuODiOODgeOCp+ODg+OCr1xuICAgICAgICBpZiAoZnVuYy50aW1lb3V0ID4gOTAwKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goYExhbWJkYSBmdW5jdGlvbiAke2luZGV4fTogVGltZW91dCBjYW5ub3QgZXhjZWVkIDkwMCBzZWNvbmRzYCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyDjg6Hjg6Ljg6rjgrXjgqTjgrrjg4Hjgqfjg4Pjgq9cbiAgICAgICAgaWYgKGZ1bmMubWVtb3J5U2l6ZSA8IDEyOCB8fCBmdW5jLm1lbW9yeVNpemUgPiAxMDI0MCkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKGBMYW1iZGEgZnVuY3Rpb24gJHtpbmRleH06IE1lbW9yeSBzaXplIG11c3QgYmUgYmV0d2VlbiAxMjggYW5kIDEwMjQwIE1CYCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZnVuYy5tZW1vcnlTaXplICUgNjQgIT09IDApIHtcbiAgICAgICAgICBlcnJvcnMucHVzaChgTGFtYmRhIGZ1bmN0aW9uICR7aW5kZXh9OiBNZW1vcnkgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNjQgTUJgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOmrmOODoeODouODquS9v+eUqOmHj+OBruitpuWRilxuICAgICAgICBpZiAoZnVuYy5tZW1vcnlTaXplID4gMzAwOCkge1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2goYExhbWJkYSBmdW5jdGlvbiAke2luZGV4fTogSGlnaCBtZW1vcnkgYWxsb2NhdGlvbiBtYXkgaW5jcmVhc2UgY29zdHNgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gU3RlcCBGdW5jdGlvbnPoqK3lrprjg4Hjgqfjg4Pjgq9cbiAgICBpZiAoc2VydmVybGVzc0NvbmZpZy5zdGVwRnVuY3Rpb25zPy5lbmFibGVkKSB7XG4gICAgICBpZiAoc2VydmVybGVzc0NvbmZpZy5zdGVwRnVuY3Rpb25zLmV4ZWN1dGlvbj8udGltZW91dCA+IDMxNTM2MDAwKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdTdGVwIEZ1bmN0aW9ucyBleGVjdXRpb24gdGltZW91dCBjYW5ub3QgZXhjZWVkIDEgeWVhciAoMzE1MzYwMDAgc2Vjb25kcyknKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTUVPoqK3lrprjg4Hjgqfjg4Pjgq9cbiAgICBpZiAoc2VydmVybGVzc0NvbmZpZy5zcXM/LnF1ZXVlcykge1xuICAgICAgc2VydmVybGVzc0NvbmZpZy5zcXMucXVldWVzLmZvckVhY2goKHF1ZXVlOiBhbnksIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgaWYgKCFxdWV1ZS5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgY29uZmlnID0gcXVldWUuY29uZmlndXJhdGlvbjtcbiAgICAgICAgaWYgKGNvbmZpZy52aXNpYmlsaXR5VGltZW91dFNlY29uZHMgPiA0MzIwMCkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKGBTUVMgcXVldWUgJHtpbmRleH06IFZpc2liaWxpdHkgdGltZW91dCBjYW5ub3QgZXhjZWVkIDQzMjAwIHNlY29uZHNgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25maWcubWVzc2FnZVJldGVudGlvblBlcmlvZCA+IDEyMDk2MDApIHtcbiAgICAgICAgICBlcnJvcnMucHVzaChgU1FTIHF1ZXVlICR7aW5kZXh9OiBNZXNzYWdlIHJldGVudGlvbiBwZXJpb2QgY2Fubm90IGV4Y2VlZCAxMjA5NjAwIHNlY29uZHNgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZTeOOBqFNlcnZlcmxlc3Pjga7kupLmj5vmgKfjg4Hjgqfjg4Pjgq9cbiAgICovXG4gIHByaXZhdGUgc3RhdGljIGNoZWNrRnN4U2VydmVybGVzc0NvbXBhdGliaWxpdHkoXG4gICAgY29uZmlnOiBGc3hJbnRlZ3JhdGlvbkNvbmZpZyxcbiAgICBlcnJvcnM6IHN0cmluZ1tdLFxuICAgIHdhcm5pbmdzOiBzdHJpbmdbXVxuICApOiB2b2lkIHtcbiAgICAvLyBWUEPoqK3lrprjga7mlbTlkIjmgKfjg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCBmc3hTdWJuZXRzID0gY29uZmlnLmZzeD8uZmlsZVN5c3RlbXNcbiAgICAgID8uZmlsdGVyKGZzID0+IGZzLmVuYWJsZWQpXG4gICAgICA/LmZsYXRNYXAoZnMgPT4gZnMubmV0d29yaz8uc3VibmV0SWRzIHx8IFtdKSB8fCBbXTtcblxuICAgIGNvbnN0IGxhbWJkYVZwY0VuYWJsZWQgPSBjb25maWcuc2VydmVybGVzcz8ubGFtYmRhPy5mdW5jdGlvbnNcbiAgICAgID8uc29tZShmdW5jID0+IGZ1bmMuZW5hYmxlZCAmJiBmdW5jLnZwYz8uZW5hYmxlZCkgfHwgZmFsc2U7XG5cbiAgICBpZiAoZnN4U3VibmV0cy5sZW5ndGggPiAwICYmIGxhbWJkYVZwY0VuYWJsZWQpIHtcbiAgICAgIC8vIExhbWJkYemWouaVsOOBjFZQQ+WGheOBq+OBguOCiuOAgUZTeOODleOCoeOCpOODq+OCt+OCueODhuODoOOBjOWtmOWcqOOBmeOCi+WgtOWQiFxuICAgICAgLy8g5ZCM44GYVlBD5YaF44Gr44GC44KL5b+F6KaB44GM44GC44KL44GT44Go44KS6K2m5ZGKXG4gICAgICB3YXJuaW5ncy5wdXNoKCdFbnN1cmUgTGFtYmRhIGZ1bmN0aW9ucyBhbmQgRlN4IGZpbGUgc3lzdGVtcyBhcmUgaW4gdGhlIHNhbWUgVlBDIGZvciBvcHRpbWFsIHBlcmZvcm1hbmNlJyk7XG4gICAgfVxuXG4gICAgLy8g44OV44Kh44Kk44Or44K344K544OG44Og44Oe44Km44Oz44OI6Kit5a6a44OB44Kn44OD44KvXG4gICAgY29uc3QgZnN4TW91bnRFbmFibGVkID0gY29uZmlnLnNlcnZlcmxlc3M/LmxhbWJkYT8uZnVuY3Rpb25zXG4gICAgICA/LnNvbWUoZnVuYyA9PiBmdW5jLmVuYWJsZWQgJiYgZnVuYy5maWxlU3lzdGVtPy5lbmFibGVkKSB8fCBmYWxzZTtcblxuICAgIGlmIChmc3hNb3VudEVuYWJsZWQgJiYgZnN4U3VibmV0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIGVycm9ycy5wdXNoKCdMYW1iZGEgZnVuY3Rpb25zIHdpdGggZmlsZSBzeXN0ZW0gbW91bnRpbmcgcmVxdWlyZSBGU3ggZmlsZSBzeXN0ZW1zIHRvIGJlIGNvbmZpZ3VyZWQnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Oq44O844K444On44Oz5LqS5o+b5oCn44OB44Kn44OD44KvXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyBjaGVja1JlZ2lvbkNvbXBhdGliaWxpdHkoXG4gICAgY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZyxcbiAgICBlcnJvcnM6IHN0cmluZ1tdLFxuICAgIHdhcm5pbmdzOiBzdHJpbmdbXVxuICApOiB2b2lkIHtcbiAgICBjb25zdCByZWdpb24gPSBjb25maWcucmVnaW9uO1xuXG4gICAgLy8gRlN4IGZvciBPTlRBUOWvvuW/nOODquODvOOCuOODp+ODs+ODgeOCp+ODg+OCr1xuICAgIGNvbnN0IGZzeFN1cHBvcnRlZFJlZ2lvbnMgPSBbXG4gICAgICAndXMtZWFzdC0xJywgJ3VzLWVhc3QtMicsICd1cy13ZXN0LTEnLCAndXMtd2VzdC0yJyxcbiAgICAgICdldS13ZXN0LTEnLCAnZXUtd2VzdC0yJywgJ2V1LWNlbnRyYWwtMScsXG4gICAgICAnYXAtbm9ydGhlYXN0LTEnLCAnYXAtc291dGhlYXN0LTEnLCAnYXAtc291dGhlYXN0LTInXG4gICAgXTtcblxuICAgIGlmIChjb25maWcuc3RvcmFnZT8uZnN4T250YXA/LmVuYWJsZWQgJiYgIWZzeFN1cHBvcnRlZFJlZ2lvbnMuaW5jbHVkZXMocmVnaW9uKSkge1xuICAgICAgd2FybmluZ3MucHVzaChgRlN4IGZvciBPTlRBUCBtYXkgbm90IGJlIGF2YWlsYWJsZSBpbiByZWdpb24gJHtyZWdpb259LiBQbGVhc2UgdmVyaWZ5IHJlZ2lvbmFsIGF2YWlsYWJpbGl0eS5gKTtcbiAgICB9XG5cbiAgICAvLyDmnbHkuqzjg6rjg7zjgrjjg6fjg7PvvIhhcC1ub3J0aGVhc3QtMe+8ieOBruacgOmBqeWMluaPkOahiFxuICAgIGlmIChyZWdpb24gPT09ICdhcC1ub3J0aGVhc3QtMScpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goJ0NvbnNpZGVyIHVzaW5nIE11bHRpLUFaIGRlcGxveW1lbnQgZm9yIHByb2R1Y3Rpb24gd29ya2xvYWRzIGluIFRva3lvIHJlZ2lvbiBmb3IgYmV0dGVyIGF2YWlsYWJpbGl0eScpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGU3jntbHlkIjjg6rjg7zjgrjjg6fjg7PkupLmj5vmgKfjg4Hjgqfjg4Pjgq9cbiAgICovXG4gIHByaXZhdGUgc3RhdGljIGNoZWNrRnN4SW50ZWdyYXRpb25SZWdpb25Db21wYXRpYmlsaXR5KFxuICAgIGNvbmZpZzogRnN4SW50ZWdyYXRpb25Db25maWcsXG4gICAgZXJyb3JzOiBzdHJpbmdbXSxcbiAgICB3YXJuaW5nczogc3RyaW5nW11cbiAgKTogdm9pZCB7XG4gICAgY29uc3QgcmVnaW9uID0gY29uZmlnLnJlZ2lvbjtcblxuICAgIC8vIEZTeCBmb3IgT05UQVDlr77lv5zjg6rjg7zjgrjjg6fjg7Pjg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCBmc3hTdXBwb3J0ZWRSZWdpb25zID0gW1xuICAgICAgJ3VzLWVhc3QtMScsICd1cy1lYXN0LTInLCAndXMtd2VzdC0xJywgJ3VzLXdlc3QtMicsXG4gICAgICAnZXUtd2VzdC0xJywgJ2V1LXdlc3QtMicsICdldS1jZW50cmFsLTEnLFxuICAgICAgJ2FwLW5vcnRoZWFzdC0xJywgJ2FwLXNvdXRoZWFzdC0xJywgJ2FwLXNvdXRoZWFzdC0yJ1xuICAgIF07XG5cbiAgICBpZiAoY29uZmlnLmZzeD8uZW5hYmxlZCAmJiAhZnN4U3VwcG9ydGVkUmVnaW9ucy5pbmNsdWRlcyhyZWdpb24pKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKGBGU3ggZm9yIE9OVEFQIG1heSBub3QgYmUgYXZhaWxhYmxlIGluIHJlZ2lvbiAke3JlZ2lvbn0uIFBsZWFzZSB2ZXJpZnkgcmVnaW9uYWwgYXZhaWxhYmlsaXR5LmApO1xuICAgIH1cblxuICAgIC8vIOadseS6rOODquODvOOCuOODp+ODs++8iGFwLW5vcnRoZWFzdC0x77yJ44Gu5pyA6YGp5YyW5o+Q5qGIXG4gICAgaWYgKHJlZ2lvbiA9PT0gJ2FwLW5vcnRoZWFzdC0xJykge1xuICAgICAgd2FybmluZ3MucHVzaCgnQ29uc2lkZXIgdXNpbmcgTXVsdGktQVogZGVwbG95bWVudCBmb3IgcHJvZHVjdGlvbiB3b3JrbG9hZHMgaW4gVG9reW8gcmVnaW9uIGZvciBiZXR0ZXIgYXZhaWxhYmlsaXR5Jyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZTeCBPTlRBUOacgOmBqeWMluaPkOahiO+8iOaXouWtmOOCt+OCueODhuODoOeUqO+8iVxuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgZ2V0RnN4T250YXBPcHRpbWl6YXRpb25TdWdnZXN0aW9ucyhcbiAgICBmc3hDb25maWc6IGFueSxcbiAgICBzdWdnZXN0aW9uczogc3RyaW5nW11cbiAgKTogdm9pZCB7XG4gICAgLy8g44OQ44OD44Kv44Ki44OD44OX6Kit5a6a5o+Q5qGIXG4gICAgaWYgKGZzeENvbmZpZy5hdXRvbWF0aWNCYWNrdXBSZXRlbnRpb25EYXlzID09PSAwKSB7XG4gICAgICBzdWdnZXN0aW9ucy5wdXNoKCdFbmFibGUgYXV0b21hdGljIGJhY2t1cHMgZm9yIGRhdGEgcHJvdGVjdGlvbicpO1xuICAgIH1cblxuICAgIC8vIOOCueODq+ODvOODl+ODg+ODiOacgOmBqeWMluaPkOahiFxuICAgIGlmIChmc3hDb25maWcuc3RvcmFnZUNhcGFjaXR5ID4gMTAyNDAgJiYgZnN4Q29uZmlnLnRocm91Z2hwdXRDYXBhY2l0eSA8IDUxMikge1xuICAgICAgc3VnZ2VzdGlvbnMucHVzaCgnQ29uc2lkZXIgaW5jcmVhc2luZyB0aHJvdWdocHV0IGNhcGFjaXR5IGZvciBsYXJnZSBzdG9yYWdlIHZvbHVtZXMnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRlN457Wx5ZCI5pyA6YGp5YyW5o+Q5qGIXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyBnZXRGc3hJbnRlZ3JhdGlvbk9wdGltaXphdGlvblN1Z2dlc3Rpb25zKFxuICAgIGZzeENvbmZpZzogYW55LFxuICAgIHN1Z2dlc3Rpb25zOiBzdHJpbmdbXVxuICApOiB2b2lkIHtcbiAgICBmc3hDb25maWcuZmlsZVN5c3RlbXM/LmZvckVhY2goKGZzOiBhbnksIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgIGlmICghZnMuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAvLyDjgrnjg4jjg6zjg7zjgrjlirnnjofljJbmj5DmoYhcbiAgICAgIGlmICghZnMuc3RvcmFnZUVmZmljaWVuY3kpIHtcbiAgICAgICAgc3VnZ2VzdGlvbnMucHVzaChgRmlsZSBzeXN0ZW0gJHtpbmRleH06IEVuYWJsZSBzdG9yYWdlIGVmZmljaWVuY3kgZm9yIGNvc3Qgb3B0aW1pemF0aW9uYCk7XG4gICAgICB9XG5cbiAgICAgIC8vIOODkOODg+OCr+OCouODg+ODl+ioreWumuaPkOahiFxuICAgICAgaWYgKCFmcy5iYWNrdXA/LmVuYWJsZWQpIHtcbiAgICAgICAgc3VnZ2VzdGlvbnMucHVzaChgRmlsZSBzeXN0ZW0gJHtpbmRleH06IEVuYWJsZSBhdXRvbWF0aWMgYmFja3VwcyBmb3IgZGF0YSBwcm90ZWN0aW9uYCk7XG4gICAgICB9XG5cbiAgICAgIC8vIOaal+WPt+WMluaPkOahiFxuICAgICAgaWYgKCFmcy5lbmNyeXB0aW9uPy5lbmFibGVkKSB7XG4gICAgICAgIHN1Z2dlc3Rpb25zLnB1c2goYEZpbGUgc3lzdGVtICR7aW5kZXh9OiBFbmFibGUgZW5jcnlwdGlvbiBmb3Igc2VjdXJpdHkgY29tcGxpYW5jZWApO1xuICAgICAgfVxuXG4gICAgICAvLyDjgrnjg6vjg7zjg5fjg4Pjg4jmnIDpganljJbmj5DmoYhcbiAgICAgIGlmIChmcy5zdG9yYWdlQ2FwYWNpdHkgPiAxMDI0MCAmJiBmcy50aHJvdWdocHV0Q2FwYWNpdHkgPCA1MTIpIHtcbiAgICAgICAgc3VnZ2VzdGlvbnMucHVzaChgRmlsZSBzeXN0ZW0gJHtpbmRleH06IENvbnNpZGVyIGluY3JlYXNpbmcgdGhyb3VnaHB1dCBjYXBhY2l0eSBmb3IgbGFyZ2Ugc3RvcmFnZSB2b2x1bWVzYCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU2VydmVybGVzc+acgOmBqeWMluaPkOahiFxuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgZ2V0U2VydmVybGVzc09wdGltaXphdGlvblN1Z2dlc3Rpb25zKFxuICAgIHNlcnZlcmxlc3NDb25maWc6IGFueSxcbiAgICBzdWdnZXN0aW9uczogc3RyaW5nW11cbiAgKTogdm9pZCB7XG4gICAgLy8gTGFtYmRh5pyA6YGp5YyW5o+Q5qGIXG4gICAgc2VydmVybGVzc0NvbmZpZy5sYW1iZGE/LmZ1bmN0aW9ucz8uZm9yRWFjaCgoZnVuYzogYW55LCBpbmRleDogbnVtYmVyKSA9PiB7XG4gICAgICBpZiAoIWZ1bmMuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAvLyDjg6Hjg6Ljg6rjgajjgr/jgqTjg6DjgqLjgqbjg4jjga7mnIDpganljJZcbiAgICAgIGlmIChmdW5jLm1lbW9yeVNpemUgPT09IDEyOCAmJiBmdW5jLnRpbWVvdXQgPiAzMCkge1xuICAgICAgICBzdWdnZXN0aW9ucy5wdXNoKGBMYW1iZGEgZnVuY3Rpb24gJHtpbmRleH06IENvbnNpZGVyIGluY3JlYXNpbmcgbWVtb3J5IHNpemUgZm9yIGJldHRlciBwZXJmb3JtYW5jZSB3aXRoIGxvbmcgdGltZW91dHNgKTtcbiAgICAgIH1cblxuICAgICAgLy8gVlBD6Kit5a6a44Gu5pyA6YGp5YyWXG4gICAgICBpZiAoZnVuYy52cGM/LmVuYWJsZWQgJiYgIWZ1bmMuZmlsZVN5c3RlbT8uZW5hYmxlZCkge1xuICAgICAgICBzdWdnZXN0aW9ucy5wdXNoKGBMYW1iZGEgZnVuY3Rpb24gJHtpbmRleH06IFZQQyBjb25maWd1cmF0aW9uIG1heSBpbmNyZWFzZSBjb2xkIHN0YXJ0IHRpbWUuIENvbnNpZGVyIGlmIFZQQyBpcyBuZWNlc3NhcnkuYCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyDjg6Ljg4vjgr/jg6rjg7PjgrDmj5DmoYhcbiAgICBpZiAoIXNlcnZlcmxlc3NDb25maWcubW9uaXRvcmluZz8ueHJheT8uZW5hYmxlZCkge1xuICAgICAgc3VnZ2VzdGlvbnMucHVzaCgnRW5hYmxlIFgtUmF5IHRyYWNpbmcgZm9yIGJldHRlciBvYnNlcnZhYmlsaXR5IGFuZCBkZWJ1Z2dpbmcnKTtcbiAgICB9XG5cbiAgICBpZiAoIXNlcnZlcmxlc3NDb25maWcubW9uaXRvcmluZz8uY2xvdWRXYXRjaD8uZW5hYmxlZCkge1xuICAgICAgc3VnZ2VzdGlvbnMucHVzaCgnRW5hYmxlIENsb3VkV2F0Y2ggbW9uaXRvcmluZyBmb3Igb3BlcmF0aW9uYWwgaW5zaWdodHMnKTtcbiAgICB9XG4gIH1cbn0iXX0=