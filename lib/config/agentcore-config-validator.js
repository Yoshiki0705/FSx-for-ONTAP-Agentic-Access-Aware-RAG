"use strict";
/**
 * AgentCore設定バリデーター
 *
 * cdk.context.jsonのagentCore設定をバリデーションします。
 * 設定値の範囲チェック、必須項目チェック、論理的整合性チェックを実施します。
 *
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentCoreConfigValidator = void 0;
/**
 * AgentCore設定バリデータークラス
 */
class AgentCoreConfigValidator {
    /**
     * AgentCore設定をバリデーション
     *
     * @param config AgentCore設定
     * @returns バリデーション結果
     */
    static validate(config) {
        const errors = [];
        const warnings = [];
        // AgentCore全体が無効化されている場合は、個別設定をチェックしない
        if (config.enabled === false) {
            return { valid: true, errors, warnings };
        }
        // Runtime設定のバリデーション
        if (config.runtime?.enabled) {
            this.validateRuntime(config.runtime, errors, warnings);
        }
        // Gateway設定のバリデーション
        if (config.gateway?.enabled) {
            this.validateGateway(config.gateway, errors, warnings);
        }
        // Memory設定のバリデーション
        if (config.memory?.enabled) {
            this.validateMemory(config.memory, errors, warnings);
        }
        // Identity設定のバリデーション
        if (config.identity?.enabled) {
            this.validateIdentity(config.identity, errors, warnings);
        }
        // Browser設定のバリデーション
        if (config.browser?.enabled) {
            this.validateBrowser(config.browser, errors, warnings);
        }
        // Code Interpreter設定のバリデーション
        if (config.codeInterpreter?.enabled) {
            this.validateCodeInterpreter(config.codeInterpreter, errors, warnings);
        }
        // Observability設定のバリデーション
        if (config.observability?.enabled) {
            this.validateObservability(config.observability, errors, warnings);
        }
        // Evaluations設定のバリデーション
        if (config.evaluations?.enabled) {
            this.validateEvaluations(config.evaluations, errors, warnings);
        }
        // Policy設定のバリデーション
        if (config.policy?.enabled) {
            this.validatePolicy(config.policy, errors, warnings);
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * Runtime設定のバリデーション
     */
    static validateRuntime(config, errors, warnings) {
        const lambdaConfig = config.lambdaConfig;
        if (lambdaConfig) {
            // タイムアウトのチェック
            if (lambdaConfig.timeout !== undefined) {
                if (lambdaConfig.timeout < 1 || lambdaConfig.timeout > 900) {
                    errors.push('Runtime Lambda timeout must be between 1 and 900 seconds');
                }
                if (lambdaConfig.timeout > 300) {
                    warnings.push('Runtime Lambda timeout > 300 seconds may increase costs');
                }
            }
            // メモリサイズのチェック
            if (lambdaConfig.memorySize !== undefined) {
                if (lambdaConfig.memorySize < 128 || lambdaConfig.memorySize > 10240) {
                    errors.push('Runtime Lambda memorySize must be between 128 and 10240 MB');
                }
                if (lambdaConfig.memorySize % 64 !== 0) {
                    errors.push('Runtime Lambda memorySize must be a multiple of 64 MB');
                }
            }
            // Reserved Concurrencyのチェック
            if (lambdaConfig.reservedConcurrentExecutions !== undefined) {
                if (lambdaConfig.reservedConcurrentExecutions < 0) {
                    errors.push('Runtime Lambda reservedConcurrentExecutions must be >= 0');
                }
            }
            // Provisioned Concurrencyのチェック
            if (lambdaConfig.provisionedConcurrentExecutions !== undefined) {
                if (lambdaConfig.provisionedConcurrentExecutions < 0) {
                    errors.push('Runtime Lambda provisionedConcurrentExecutions must be >= 0');
                }
                if (lambdaConfig.provisionedConcurrentExecutions > 0) {
                    warnings.push('Runtime Lambda provisionedConcurrentExecutions will incur additional costs');
                }
            }
        }
        // EventBridge設定のチェック
        const eventBridgeConfig = config.eventBridgeConfig;
        if (eventBridgeConfig?.enabled && eventBridgeConfig.scheduleExpression) {
            const expr = eventBridgeConfig.scheduleExpression;
            if (!expr.startsWith('rate(') && !expr.startsWith('cron(')) {
                errors.push('Runtime EventBridge scheduleExpression must start with "rate(" or "cron("');
            }
        }
    }
    /**
     * Gateway設定のバリデーション
     */
    static validateGateway(config, errors, warnings) {
        // REST API変換設定のチェック
        const restApiConfig = config.restApiConversionConfig;
        if (restApiConfig?.openApiSpecPath) {
            const path = restApiConfig.openApiSpecPath;
            if (!path.startsWith('s3://') && !path.startsWith('./') && !path.startsWith('/')) {
                errors.push('Gateway openApiSpecPath must be S3 URI (s3://...) or local path (./... or /...)');
            }
        }
        // Lambda関数変換設定のチェック
        const lambdaConfig = config.lambdaFunctionConversionConfig;
        if (lambdaConfig?.functionArns) {
            if (!Array.isArray(lambdaConfig.functionArns)) {
                errors.push('Gateway functionArns must be an array');
            }
            else if (lambdaConfig.functionArns.length === 0) {
                warnings.push('Gateway functionArns is empty - no Lambda functions will be converted');
            }
            else {
                lambdaConfig.functionArns.forEach((arn, index) => {
                    if (!arn.startsWith('arn:aws:lambda:')) {
                        errors.push(`Gateway functionArns[${index}] is not a valid Lambda ARN: ${arn}`);
                    }
                });
            }
        }
        // MCPサーバー統合設定のチェック
        const mcpConfig = config.mcpServerIntegrationConfig;
        if (mcpConfig?.serverEndpoints) {
            if (!Array.isArray(mcpConfig.serverEndpoints)) {
                errors.push('Gateway serverEndpoints must be an array');
            }
            else {
                mcpConfig.serverEndpoints.forEach((endpoint, index) => {
                    if (!endpoint.name) {
                        errors.push(`Gateway serverEndpoints[${index}] must have a name`);
                    }
                    if (!endpoint.endpoint) {
                        errors.push(`Gateway serverEndpoints[${index}] must have an endpoint URL`);
                    }
                    else if (!endpoint.endpoint.startsWith('http://') && !endpoint.endpoint.startsWith('https://')) {
                        errors.push(`Gateway serverEndpoints[${index}] endpoint must be HTTP or HTTPS URL`);
                    }
                    if (!endpoint.authType || !['API_KEY', 'OAUTH2', 'NONE'].includes(endpoint.authType)) {
                        errors.push(`Gateway serverEndpoints[${index}] authType must be API_KEY, OAUTH2, or NONE`);
                    }
                });
            }
        }
    }
    /**
     * Memory設定のバリデーション
     */
    static validateMemory(config, errors, warnings) {
        const strategies = config.memoryStrategyConfig;
        if (strategies) {
            // 少なくとも1つのストラテジーが有効化されているかチェック
            const hasEnabledStrategy = strategies.enableSemantic ||
                strategies.enableSummary ||
                strategies.enableUserPreference;
            if (!hasEnabledStrategy) {
                errors.push('Memory must have at least one strategy enabled (Semantic, Summary, or UserPreference)');
            }
            // Namespacesのチェック
            if (strategies.semanticNamespaces && !Array.isArray(strategies.semanticNamespaces)) {
                errors.push('Memory semanticNamespaces must be an array');
            }
            if (strategies.summaryNamespaces && !Array.isArray(strategies.summaryNamespaces)) {
                errors.push('Memory summaryNamespaces must be an array');
            }
            if (strategies.userPreferenceNamespaces && !Array.isArray(strategies.userPreferenceNamespaces)) {
                errors.push('Memory userPreferenceNamespaces must be an array');
            }
        }
        // KMS設定のチェック
        const kmsConfig = config.kmsConfig;
        if (kmsConfig?.keyArn) {
            if (!kmsConfig.keyArn.startsWith('arn:aws:kms:')) {
                errors.push('Memory KMS keyArn must be a valid KMS Key ARN');
            }
        }
    }
    /**
     * Identity設定のバリデーション
     */
    static validateIdentity(config, errors, warnings) {
        // DynamoDB設定のチェック
        const dynamoDbConfig = config.dynamoDbConfig;
        if (dynamoDbConfig) {
            if (dynamoDbConfig.readCapacity !== undefined) {
                if (dynamoDbConfig.readCapacity < 1) {
                    errors.push('Identity DynamoDB readCapacity must be >= 1');
                }
            }
            if (dynamoDbConfig.writeCapacity !== undefined) {
                if (dynamoDbConfig.writeCapacity < 1) {
                    errors.push('Identity DynamoDB writeCapacity must be >= 1');
                }
            }
        }
        // RBAC設定のチェック
        const rbacConfig = config.rbacConfig;
        if (rbacConfig?.defaultRole) {
            if (!['Admin', 'User', 'ReadOnly'].includes(rbacConfig.defaultRole)) {
                errors.push('Identity RBAC defaultRole must be Admin, User, or ReadOnly');
            }
        }
        if (rbacConfig?.customRoles) {
            if (!Array.isArray(rbacConfig.customRoles)) {
                errors.push('Identity RBAC customRoles must be an array');
            }
            else {
                rbacConfig.customRoles.forEach((role, index) => {
                    if (!role.name) {
                        errors.push(`Identity RBAC customRoles[${index}] must have a name`);
                    }
                    if (!role.permissions || !Array.isArray(role.permissions)) {
                        errors.push(`Identity RBAC customRoles[${index}] must have a permissions array`);
                    }
                });
            }
        }
    }
    /**
     * Browser設定のバリデーション
     */
    static validateBrowser(config, errors, warnings) {
        // ストレージ設定のチェック
        const storageConfig = config.storageConfig;
        if (storageConfig) {
            if (!storageConfig.bucketName && !storageConfig.fsxS3AccessPointArn) {
                warnings.push('Browser storage: neither bucketName nor fsxS3AccessPointArn is specified - default bucket will be created');
            }
            if (storageConfig.fsxS3AccessPointArn) {
                if (!storageConfig.fsxS3AccessPointArn.startsWith('arn:aws:s3:')) {
                    errors.push('Browser fsxS3AccessPointArn must be a valid S3 Access Point ARN');
                }
            }
        }
        // Puppeteer設定のチェック
        const puppeteerConfig = config.puppeteerConfig;
        if (puppeteerConfig) {
            if (puppeteerConfig.timeout !== undefined) {
                if (puppeteerConfig.timeout < 1000 || puppeteerConfig.timeout > 300000) {
                    errors.push('Browser Puppeteer timeout must be between 1000 and 300000 ms (1-300 seconds)');
                }
            }
            if (puppeteerConfig.defaultViewport) {
                const viewport = puppeteerConfig.defaultViewport;
                if (viewport.width < 100 || viewport.width > 3840) {
                    errors.push('Browser Puppeteer viewport width must be between 100 and 3840 pixels');
                }
                if (viewport.height < 100 || viewport.height > 2160) {
                    errors.push('Browser Puppeteer viewport height must be between 100 and 2160 pixels');
                }
            }
        }
    }
    /**
     * Code Interpreter設定のバリデーション
     */
    static validateCodeInterpreter(config, errors, warnings) {
        // 実行設定のチェック
        const executionConfig = config.executionConfig;
        if (executionConfig) {
            if (executionConfig.timeout !== undefined) {
                if (executionConfig.timeout < 1 || executionConfig.timeout > 300) {
                    errors.push('Code Interpreter timeout must be between 1 and 300 seconds');
                }
            }
            if (executionConfig.maxConcurrentSessions !== undefined) {
                if (executionConfig.maxConcurrentSessions < 1) {
                    errors.push('Code Interpreter maxConcurrentSessions must be >= 1');
                }
                if (executionConfig.maxConcurrentSessions > 100) {
                    warnings.push('Code Interpreter maxConcurrentSessions > 100 may cause resource exhaustion');
                }
            }
            if (executionConfig.allowedLanguages) {
                if (!Array.isArray(executionConfig.allowedLanguages)) {
                    errors.push('Code Interpreter allowedLanguages must be an array');
                }
                else if (executionConfig.allowedLanguages.length === 0) {
                    errors.push('Code Interpreter allowedLanguages must not be empty');
                }
            }
        }
        // パッケージ管理設定のチェック
        const packageConfig = config.packageManagementConfig;
        if (packageConfig) {
            if (packageConfig.allowedPackages && !Array.isArray(packageConfig.allowedPackages)) {
                errors.push('Code Interpreter allowedPackages must be an array');
            }
            if (packageConfig.packageWhitelist) {
                warnings.push('Code Interpreter packageWhitelist is deprecated - use allowedPackages instead');
            }
        }
    }
    /**
     * Observability設定のバリデーション
     */
    static validateObservability(config, errors, warnings) {
        // X-Ray設定のチェック
        const xrayConfig = config.xrayConfig;
        if (xrayConfig) {
            if (xrayConfig.samplingRate !== undefined) {
                if (xrayConfig.samplingRate < 0 || xrayConfig.samplingRate > 1) {
                    errors.push('Observability X-Ray samplingRate must be between 0.0 and 1.0');
                }
                if (xrayConfig.samplingRate < 0.01) {
                    warnings.push('Observability X-Ray samplingRate < 0.01 may miss important traces');
                }
            }
        }
        // CloudWatch設定のチェック
        const cloudWatchConfig = config.cloudWatchConfig;
        if (cloudWatchConfig) {
            if (cloudWatchConfig.logRetentionDays !== undefined) {
                if (cloudWatchConfig.logRetentionDays < 1) {
                    errors.push('Observability CloudWatch logRetentionDays must be >= 1');
                }
            }
            if (cloudWatchConfig.alarmEmail) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(cloudWatchConfig.alarmEmail)) {
                    errors.push('Observability CloudWatch alarmEmail must be a valid email address');
                }
            }
        }
        // エラー追跡設定のチェック
        const errorTrackingConfig = config.errorTrackingConfig;
        if (errorTrackingConfig) {
            if (errorTrackingConfig.errorThreshold !== undefined) {
                if (errorTrackingConfig.errorThreshold < 1) {
                    errors.push('Observability errorThreshold must be >= 1');
                }
            }
        }
    }
    /**
     * Evaluations設定のバリデーション
     */
    static validateEvaluations(config, errors, warnings) {
        // 品質メトリクス設定のチェック
        const qualityMetricsConfig = config.qualityMetricsConfig;
        if (qualityMetricsConfig) {
            if (qualityMetricsConfig.enabledMetrics) {
                if (!Array.isArray(qualityMetricsConfig.enabledMetrics)) {
                    errors.push('Evaluations enabledMetrics must be an array');
                }
                else if (qualityMetricsConfig.enabledMetrics.length === 0) {
                    warnings.push('Evaluations enabledMetrics is empty - no metrics will be evaluated');
                }
            }
            if (qualityMetricsConfig.evaluationFrequency) {
                if (!['realtime', 'hourly', 'daily'].includes(qualityMetricsConfig.evaluationFrequency)) {
                    errors.push('Evaluations evaluationFrequency must be realtime, hourly, or daily');
                }
            }
        }
        // A/Bテスト設定のチェック
        const abTestConfig = config.abTestConfig;
        if (abTestConfig) {
            if (abTestConfig.minSampleSize !== undefined) {
                if (abTestConfig.minSampleSize < 10) {
                    errors.push('Evaluations A/B test minSampleSize must be >= 10');
                }
            }
            if (abTestConfig.confidenceLevel !== undefined) {
                if (abTestConfig.confidenceLevel < 0.5 || abTestConfig.confidenceLevel > 0.99) {
                    errors.push('Evaluations A/B test confidenceLevel must be between 0.5 and 0.99');
                }
            }
        }
        // パフォーマンス評価設定のチェック
        const performanceConfig = config.performanceEvaluationConfig;
        if (performanceConfig) {
            if (performanceConfig.latencyThreshold !== undefined) {
                if (performanceConfig.latencyThreshold < 100) {
                    errors.push('Evaluations latencyThreshold must be >= 100 ms');
                }
            }
            if (performanceConfig.throughputThreshold !== undefined) {
                if (performanceConfig.throughputThreshold < 1) {
                    errors.push('Evaluations throughputThreshold must be >= 1 req/s');
                }
            }
            if (performanceConfig.costThreshold !== undefined) {
                if (performanceConfig.costThreshold < 0.01) {
                    errors.push('Evaluations costThreshold must be >= 0.01 USD');
                }
            }
        }
    }
    /**
     * Policy設定のバリデーション
     */
    static validatePolicy(config, errors, warnings) {
        // 自然言語ポリシー設定のチェック
        const naturalLanguageConfig = config.naturalLanguagePolicyConfig;
        if (naturalLanguageConfig?.defaultPolicyTemplate) {
            const validTemplates = ['standard', 'strict', 'permissive'];
            if (!validTemplates.includes(naturalLanguageConfig.defaultPolicyTemplate)) {
                warnings.push(`Policy defaultPolicyTemplate '${naturalLanguageConfig.defaultPolicyTemplate}' is not a standard template (standard, strict, permissive)`);
            }
        }
        // Cedar統合設定のチェック（特にバリデーション不要）
        // enableFormalVerificationとenableConflictDetectionはboolean値なので型チェックのみ
    }
}
exports.AgentCoreConfigValidator = AgentCoreConfigValidator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRjb3JlLWNvbmZpZy12YWxpZGF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhZ2VudGNvcmUtY29uZmlnLXZhbGlkYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7OztHQVNHOzs7QUF3Qkg7O0dBRUc7QUFDSCxNQUFhLHdCQUF3QjtJQUNuQzs7Ozs7T0FLRztJQUNILE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBdUI7UUFDckMsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO1FBQzVCLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztRQUU5Qix1Q0FBdUM7UUFDdkMsSUFBSSxNQUFNLENBQUMsT0FBTyxLQUFLLEtBQUssRUFBRSxDQUFDO1lBQzdCLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQztRQUMzQyxDQUFDO1FBRUQsb0JBQW9CO1FBQ3BCLElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsQ0FBQztZQUM1QixJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3pELENBQUM7UUFFRCxvQkFBb0I7UUFDcEIsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDO1lBQzVCLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDekQsQ0FBQztRQUVELG1CQUFtQjtRQUNuQixJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBRUQscUJBQXFCO1FBQ3JCLElBQUksTUFBTSxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FB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SSxFQUFFLENBQUM7b0JBQzNDLE1BQU0sQ0FBQyxJQUFJLENBQUMsK0NBQStDLENBQUMsQ0FBQztnQkFDL0QsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssTUFBTSxDQUFDLGNBQWMsQ0FDM0IsTUFBVyxFQUNYLE1BQWdCLEVBQ2hCLFFBQWtCO1FBRWxCLGtCQUFrQjtRQUNsQixNQUFNLHFCQUFxQixHQUFHLE1BQU0sQ0FBQywyQkFBMkIsQ0FBQztRQUNqRSxJQUFJLHFCQUFxQixFQUFFLHFCQUFxQixFQUFFLENBQUM7WUFDakQsTUFBTSxjQUFjLEdBQUcsQ0FBQyxVQUFVLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQzVELElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLHFCQUFxQixDQUFDLHFCQUFxQixDQUFDLEVBQUUsQ0FBQztnQkFDMUUsUUFBUSxDQUFDLElBQUksQ0FBQyxpQ0FBaUMscUJBQXFCLENBQUMscUJBQXFCLDZEQUE2RCxDQUFDLENBQUM7WUFDM0osQ0FBQztRQUNILENBQUM7UUFFRCw4QkFBOEI7UUFDOUIsc0VBQXNFO0lBQ3hFLENBQUM7Q0FDRjtBQXJlRCw0REFxZUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFnZW50Q29yZeioreWumuODkOODquODh+ODvOOCv+ODvFxuICogXG4gKiBjZGsuY29udGV4dC5qc29u44GuYWdlbnRDb3Jl6Kit5a6a44KS44OQ44Oq44OH44O844K344On44Oz44GX44G+44GZ44CCXG4gKiDoqK3lrprlgKTjga7nr4Tlm7Ljg4Hjgqfjg4Pjgq/jgIHlv4XpoIjpoIXnm67jg4Hjgqfjg4Pjgq/jgIHoq5bnkIbnmoTmlbTlkIjmgKfjg4Hjgqfjg4Pjgq/jgpLlrp/mlr3jgZfjgb7jgZnjgIJcbiAqIFxuICogQGF1dGhvciBLaXJvIEFJXG4gKiBAZGF0ZSAyMDI2LTAxLTA0XG4gKiBAdmVyc2lvbiAxLjAuMFxuICovXG5cbmltcG9ydCB7IEFnZW50Q29yZUNvbmZpZyB9IGZyb20gJy4uLy4uL3R5cGVzL2FnZW50Y29yZS1jb25maWcnO1xuXG4vKipcbiAqIOODkOODquODh+ODvOOCt+ODp+ODs+e1kOaenFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFZhbGlkYXRpb25SZXN1bHQge1xuICAvKipcbiAgICog44OQ44Oq44OH44O844K344On44Oz5oiQ5Yqf44OV44Op44KwXG4gICAqL1xuICByZWFkb25seSB2YWxpZDogYm9vbGVhbjtcblxuICAvKipcbiAgICog44Ko44Op44O844Oh44OD44K744O844K444Oq44K544OIXG4gICAqL1xuICByZWFkb25seSBlcnJvcnM6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiDorablkYrjg6Hjg4Pjgrvjg7zjgrjjg6rjgrnjg4hcbiAgICovXG4gIHJlYWRvbmx5IHdhcm5pbmdzOiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiBBZ2VudENvcmXoqK3lrprjg5Djg6rjg4fjg7zjgr/jg7zjgq/jg6njgrlcbiAqL1xuZXhwb3J0IGNsYXNzIEFnZW50Q29yZUNvbmZpZ1ZhbGlkYXRvciB7XG4gIC8qKlxuICAgKiBBZ2VudENvcmXoqK3lrprjgpLjg5Djg6rjg4fjg7zjgrfjg6fjg7NcbiAgICogXG4gICAqIEBwYXJhbSBjb25maWcgQWdlbnRDb3Jl6Kit5a6aXG4gICAqIEByZXR1cm5zIOODkOODquODh+ODvOOCt+ODp+ODs+e1kOaenFxuICAgKi9cbiAgc3RhdGljIHZhbGlkYXRlKGNvbmZpZzogQWdlbnRDb3JlQ29uZmlnKTogVmFsaWRhdGlvblJlc3VsdCB7XG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8gQWdlbnRDb3Jl5YWo5L2T44GM54Sh5Yq55YyW44GV44KM44Gm44GE44KL5aC05ZCI44Gv44CB5YCL5Yil6Kit5a6a44KS44OB44Kn44OD44Kv44GX44Gq44GEXG4gICAgaWYgKGNvbmZpZy5lbmFibGVkID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuIHsgdmFsaWQ6IHRydWUsIGVycm9ycywgd2FybmluZ3MgfTtcbiAgICB9XG5cbiAgICAvLyBSdW50aW1l6Kit5a6a44Gu44OQ44Oq44OH44O844K344On44OzXG4gICAgaWYgKGNvbmZpZy5ydW50aW1lPy5lbmFibGVkKSB7XG4gICAgICB0aGlzLnZhbGlkYXRlUnVudGltZShjb25maWcucnVudGltZSwgZXJyb3JzLCB3YXJuaW5ncyk7XG4gICAgfVxuXG4gICAgLy8gR2F0ZXdheeioreWumuOBruODkOODquODh+ODvOOCt+ODp+ODs1xuICAgIGlmIChjb25maWcuZ2F0ZXdheT8uZW5hYmxlZCkge1xuICAgICAgdGhpcy52YWxpZGF0ZUdhdGV3YXkoY29uZmlnLmdhdGV3YXksIGVycm9ycywgd2FybmluZ3MpO1xuICAgIH1cblxuICAgIC8vIE1lbW9yeeioreWumuOBruODkOODquODh+ODvOOCt+ODp+ODs1xuICAgIGlmIChjb25maWcubWVtb3J5Py5lbmFibGVkKSB7XG4gICAgICB0aGlzLnZhbGlkYXRlTWVtb3J5KGNvbmZpZy5tZW1vcnksIGVycm9ycywgd2FybmluZ3MpO1xuICAgIH1cblxuICAgIC8vIElkZW50aXR56Kit5a6a44Gu44OQ44Oq44OH44O844K344On44OzXG4gICAgaWYgKGNvbmZpZy5pZGVudGl0eT8uZW5hYmxlZCkge1xuICAgICAgdGhpcy52YWxpZGF0ZUlkZW50aXR5KGNvbmZpZy5pZGVudGl0eSwgZXJyb3JzLCB3YXJuaW5ncyk7XG4gICAgfVxuXG4gICAgLy8gQnJvd3NlcuioreWumuOBruODkOODquODh+ODvOOCt+ODp+ODs1xuICAgIGlmIChjb25maWcuYnJvd3Nlcj8uZW5hYmxlZCkge1xuICAgICAgdGhpcy52YWxpZGF0ZUJyb3dzZXIoY29uZmlnLmJyb3dzZXIsIGVycm9ycywgd2FybmluZ3MpO1xuICAgIH1cblxuICAgIC8vIENvZGUgSW50ZXJwcmV0ZXLoqK3lrprjga7jg5Djg6rjg4fjg7zjgrfjg6fjg7NcbiAgICBpZiAoY29uZmlnLmNvZGVJbnRlcnByZXRlcj8uZW5hYmxlZCkge1xuICAgICAgdGhpcy52YWxpZGF0ZUNvZGVJbnRlcnByZXRlcihjb25maWcuY29kZUludGVycHJldGVyLCBlcnJvcnMsIHdhcm5pbmdzKTtcbiAgICB9XG5cbiAgICAvLyBPYnNlcnZhYmlsaXR56Kit5a6a44Gu44OQ44Oq44OH44O844K344On44OzXG4gICAgaWYgKGNvbmZpZy5vYnNlcnZhYmlsaXR5Py5lbmFibGVkKSB7XG4gICAgICB0aGlzLnZhbGlkYXRlT2JzZXJ2YWJpbGl0eShjb25maWcub2JzZXJ2YWJpbGl0eSwgZXJyb3JzLCB3YXJuaW5ncyk7XG4gICAgfVxuXG4gICAgLy8gRXZhbHVhdGlvbnPoqK3lrprjga7jg5Djg6rjg4fjg7zjgrfjg6fjg7NcbiAgICBpZiAoY29uZmlnLmV2YWx1YXRpb25zPy5lbmFibGVkKSB7XG4gICAgICB0aGlzLnZhbGlkYXRlRXZhbHVhdGlvbnMoY29uZmlnLmV2YWx1YXRpb25zLCBlcnJvcnMsIHdhcm5pbmdzKTtcbiAgICB9XG5cbiAgICAvLyBQb2xpY3noqK3lrprjga7jg5Djg6rjg4fjg7zjgrfjg6fjg7NcbiAgICBpZiAoY29uZmlnLnBvbGljeT8uZW5hYmxlZCkge1xuICAgICAgdGhpcy52YWxpZGF0ZVBvbGljeShjb25maWcucG9saWN5LCBlcnJvcnMsIHdhcm5pbmdzKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgdmFsaWQ6IGVycm9ycy5sZW5ndGggPT09IDAsXG4gICAgICBlcnJvcnMsXG4gICAgICB3YXJuaW5ncyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJ1bnRpbWXoqK3lrprjga7jg5Djg6rjg4fjg7zjgrfjg6fjg7NcbiAgICovXG4gIHByaXZhdGUgc3RhdGljIHZhbGlkYXRlUnVudGltZShcbiAgICBjb25maWc6IGFueSxcbiAgICBlcnJvcnM6IHN0cmluZ1tdLFxuICAgIHdhcm5pbmdzOiBzdHJpbmdbXVxuICApOiB2b2lkIHtcbiAgICBjb25zdCBsYW1iZGFDb25maWcgPSBjb25maWcubGFtYmRhQ29uZmlnO1xuICAgIGlmIChsYW1iZGFDb25maWcpIHtcbiAgICAgIC8vIOOCv+OCpOODoOOCouOCpuODiOOBruODgeOCp+ODg+OCr1xuICAgICAgaWYgKGxhbWJkYUNvbmZpZy50aW1lb3V0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKGxhbWJkYUNvbmZpZy50aW1lb3V0IDwgMSB8fCBsYW1iZGFDb25maWcudGltZW91dCA+IDkwMCkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKCdSdW50aW1lIExhbWJkYSB0aW1lb3V0IG11c3QgYmUgYmV0d2VlbiAxIGFuZCA5MDAgc2Vjb25kcycpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChsYW1iZGFDb25maWcudGltZW91dCA+IDMwMCkge1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2goJ1J1bnRpbWUgTGFtYmRhIHRpbWVvdXQgPiAzMDAgc2Vjb25kcyBtYXkgaW5jcmVhc2UgY29zdHMnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyDjg6Hjg6Ljg6rjgrXjgqTjgrrjga7jg4Hjgqfjg4Pjgq9cbiAgICAgIGlmIChsYW1iZGFDb25maWcubWVtb3J5U2l6ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChsYW1iZGFDb25maWcubWVtb3J5U2l6ZSA8IDEyOCB8fCBsYW1iZGFDb25maWcubWVtb3J5U2l6ZSA+IDEwMjQwKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goJ1J1bnRpbWUgTGFtYmRhIG1lbW9yeVNpemUgbXVzdCBiZSBiZXR3ZWVuIDEyOCBhbmQgMTAyNDAgTUInKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGFtYmRhQ29uZmlnLm1lbW9yeVNpemUgJSA2NCAhPT0gMCkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKCdSdW50aW1lIExhbWJkYSBtZW1vcnlTaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA2NCBNQicpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFJlc2VydmVkIENvbmN1cnJlbmN544Gu44OB44Kn44OD44KvXG4gICAgICBpZiAobGFtYmRhQ29uZmlnLnJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAobGFtYmRhQ29uZmlnLnJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnMgPCAwKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goJ1J1bnRpbWUgTGFtYmRhIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnMgbXVzdCBiZSA+PSAwJyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gUHJvdmlzaW9uZWQgQ29uY3VycmVuY3njga7jg4Hjgqfjg4Pjgq9cbiAgICAgIGlmIChsYW1iZGFDb25maWcucHJvdmlzaW9uZWRDb25jdXJyZW50RXhlY3V0aW9ucyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChsYW1iZGFDb25maWcucHJvdmlzaW9uZWRDb25jdXJyZW50RXhlY3V0aW9ucyA8IDApIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCgnUnVudGltZSBMYW1iZGEgcHJvdmlzaW9uZWRDb25jdXJyZW50RXhlY3V0aW9ucyBtdXN0IGJlID49IDAnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGFtYmRhQ29uZmlnLnByb3Zpc2lvbmVkQ29uY3VycmVudEV4ZWN1dGlvbnMgPiAwKSB7XG4gICAgICAgICAgd2FybmluZ3MucHVzaCgnUnVudGltZSBMYW1iZGEgcHJvdmlzaW9uZWRDb25jdXJyZW50RXhlY3V0aW9ucyB3aWxsIGluY3VyIGFkZGl0aW9uYWwgY29zdHMnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEV2ZW50QnJpZGdl6Kit5a6a44Gu44OB44Kn44OD44KvXG4gICAgY29uc3QgZXZlbnRCcmlkZ2VDb25maWcgPSBjb25maWcuZXZlbnRCcmlkZ2VDb25maWc7XG4gICAgaWYgKGV2ZW50QnJpZGdlQ29uZmlnPy5lbmFibGVkICYmIGV2ZW50QnJpZGdlQ29uZmlnLnNjaGVkdWxlRXhwcmVzc2lvbikge1xuICAgICAgY29uc3QgZXhwciA9IGV2ZW50QnJpZGdlQ29uZmlnLnNjaGVkdWxlRXhwcmVzc2lvbjtcbiAgICAgIGlmICghZXhwci5zdGFydHNXaXRoKCdyYXRlKCcpICYmICFleHByLnN0YXJ0c1dpdGgoJ2Nyb24oJykpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goJ1J1bnRpbWUgRXZlbnRCcmlkZ2Ugc2NoZWR1bGVFeHByZXNzaW9uIG11c3Qgc3RhcnQgd2l0aCBcInJhdGUoXCIgb3IgXCJjcm9uKFwiJyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdhdGV3YXnoqK3lrprjga7jg5Djg6rjg4fjg7zjgrfjg6fjg7NcbiAgICovXG4gIHByaXZhdGUgc3RhdGljIHZhbGlkYXRlR2F0ZXdheShcbiAgICBjb25maWc6IGFueSxcbiAgICBlcnJvcnM6IHN0cmluZ1tdLFxuICAgIHdhcm5pbmdzOiBzdHJpbmdbXVxuICApOiB2b2lkIHtcbiAgICAvLyBSRVNUIEFQSeWkieaPm+ioreWumuOBruODgeOCp+ODg+OCr1xuICAgIGNvbnN0IHJlc3RBcGlDb25maWcgPSBjb25maWcucmVzdEFwaUNvbnZlcnNpb25Db25maWc7XG4gICAgaWYgKHJlc3RBcGlDb25maWc/Lm9wZW5BcGlTcGVjUGF0aCkge1xuICAgICAgY29uc3QgcGF0aCA9IHJlc3RBcGlDb25maWcub3BlbkFwaVNwZWNQYXRoO1xuICAgICAgaWYgKCFwYXRoLnN0YXJ0c1dpdGgoJ3MzOi8vJykgJiYgIXBhdGguc3RhcnRzV2l0aCgnLi8nKSAmJiAhcGF0aC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goJ0dhdGV3YXkgb3BlbkFwaVNwZWNQYXRoIG11c3QgYmUgUzMgVVJJIChzMzovLy4uLikgb3IgbG9jYWwgcGF0aCAoLi8uLi4gb3IgLy4uLiknKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBMYW1iZGHplqLmlbDlpInmj5voqK3lrprjga7jg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCBsYW1iZGFDb25maWcgPSBjb25maWcubGFtYmRhRnVuY3Rpb25Db252ZXJzaW9uQ29uZmlnO1xuICAgIGlmIChsYW1iZGFDb25maWc/LmZ1bmN0aW9uQXJucykge1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGxhbWJkYUNvbmZpZy5mdW5jdGlvbkFybnMpKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdHYXRld2F5IGZ1bmN0aW9uQXJucyBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gICAgICB9IGVsc2UgaWYgKGxhbWJkYUNvbmZpZy5mdW5jdGlvbkFybnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goJ0dhdGV3YXkgZnVuY3Rpb25Bcm5zIGlzIGVtcHR5IC0gbm8gTGFtYmRhIGZ1bmN0aW9ucyB3aWxsIGJlIGNvbnZlcnRlZCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGFtYmRhQ29uZmlnLmZ1bmN0aW9uQXJucy5mb3JFYWNoKChhcm46IHN0cmluZywgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgIGlmICghYXJuLnN0YXJ0c1dpdGgoJ2Fybjphd3M6bGFtYmRhOicpKSB7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChgR2F0ZXdheSBmdW5jdGlvbkFybnNbJHtpbmRleH1dIGlzIG5vdCBhIHZhbGlkIExhbWJkYSBBUk46ICR7YXJufWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTUNQ44K144O844OQ44O857Wx5ZCI6Kit5a6a44Gu44OB44Kn44OD44KvXG4gICAgY29uc3QgbWNwQ29uZmlnID0gY29uZmlnLm1jcFNlcnZlckludGVncmF0aW9uQ29uZmlnO1xuICAgIGlmIChtY3BDb25maWc/LnNlcnZlckVuZHBvaW50cykge1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG1jcENvbmZpZy5zZXJ2ZXJFbmRwb2ludHMpKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdHYXRld2F5IHNlcnZlckVuZHBvaW50cyBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtY3BDb25maWcuc2VydmVyRW5kcG9pbnRzLmZvckVhY2goKGVuZHBvaW50OiBhbnksIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICBpZiAoIWVuZHBvaW50Lm5hbWUpIHtcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKGBHYXRld2F5IHNlcnZlckVuZHBvaW50c1ske2luZGV4fV0gbXVzdCBoYXZlIGEgbmFtZWApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIWVuZHBvaW50LmVuZHBvaW50KSB7XG4gICAgICAgICAgICBlcnJvcnMucHVzaChgR2F0ZXdheSBzZXJ2ZXJFbmRwb2ludHNbJHtpbmRleH1dIG11c3QgaGF2ZSBhbiBlbmRwb2ludCBVUkxgKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKCFlbmRwb2ludC5lbmRwb2ludC5zdGFydHNXaXRoKCdodHRwOi8vJykgJiYgIWVuZHBvaW50LmVuZHBvaW50LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykpIHtcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKGBHYXRld2F5IHNlcnZlckVuZHBvaW50c1ske2luZGV4fV0gZW5kcG9pbnQgbXVzdCBiZSBIVFRQIG9yIEhUVFBTIFVSTGApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIWVuZHBvaW50LmF1dGhUeXBlIHx8ICFbJ0FQSV9LRVknLCAnT0FVVEgyJywgJ05PTkUnXS5pbmNsdWRlcyhlbmRwb2ludC5hdXRoVHlwZSkpIHtcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKGBHYXRld2F5IHNlcnZlckVuZHBvaW50c1ske2luZGV4fV0gYXV0aFR5cGUgbXVzdCBiZSBBUElfS0VZLCBPQVVUSDIsIG9yIE5PTkVgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNZW1vcnnoqK3lrprjga7jg5Djg6rjg4fjg7zjgrfjg6fjg7NcbiAgICovXG4gIHByaXZhdGUgc3RhdGljIHZhbGlkYXRlTWVtb3J5KFxuICAgIGNvbmZpZzogYW55LFxuICAgIGVycm9yczogc3RyaW5nW10sXG4gICAgd2FybmluZ3M6IHN0cmluZ1tdXG4gICk6IHZvaWQge1xuICAgIGNvbnN0IHN0cmF0ZWdpZXMgPSBjb25maWcubWVtb3J5U3RyYXRlZ3lDb25maWc7XG4gICAgaWYgKHN0cmF0ZWdpZXMpIHtcbiAgICAgIC8vIOWwkeOBquOBj+OBqOOCgjHjgaTjga7jgrnjg4jjg6njg4bjgrjjg7zjgYzmnInlirnljJbjgZXjgozjgabjgYTjgovjgYvjg4Hjgqfjg4Pjgq9cbiAgICAgIGNvbnN0IGhhc0VuYWJsZWRTdHJhdGVneSA9XG4gICAgICAgIHN0cmF0ZWdpZXMuZW5hYmxlU2VtYW50aWMgfHxcbiAgICAgICAgc3RyYXRlZ2llcy5lbmFibGVTdW1tYXJ5IHx8XG4gICAgICAgIHN0cmF0ZWdpZXMuZW5hYmxlVXNlclByZWZlcmVuY2U7XG5cbiAgICAgIGlmICghaGFzRW5hYmxlZFN0cmF0ZWd5KSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdNZW1vcnkgbXVzdCBoYXZlIGF0IGxlYXN0IG9uZSBzdHJhdGVneSBlbmFibGVkIChTZW1hbnRpYywgU3VtbWFyeSwgb3IgVXNlclByZWZlcmVuY2UpJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIE5hbWVzcGFjZXPjga7jg4Hjgqfjg4Pjgq9cbiAgICAgIGlmIChzdHJhdGVnaWVzLnNlbWFudGljTmFtZXNwYWNlcyAmJiAhQXJyYXkuaXNBcnJheShzdHJhdGVnaWVzLnNlbWFudGljTmFtZXNwYWNlcykpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goJ01lbW9yeSBzZW1hbnRpY05hbWVzcGFjZXMgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgfVxuICAgICAgaWYgKHN0cmF0ZWdpZXMuc3VtbWFyeU5hbWVzcGFjZXMgJiYgIUFycmF5LmlzQXJyYXkoc3RyYXRlZ2llcy5zdW1tYXJ5TmFtZXNwYWNlcykpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goJ01lbW9yeSBzdW1tYXJ5TmFtZXNwYWNlcyBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gICAgICB9XG4gICAgICBpZiAoc3RyYXRlZ2llcy51c2VyUHJlZmVyZW5jZU5hbWVzcGFjZXMgJiYgIUFycmF5LmlzQXJyYXkoc3RyYXRlZ2llcy51c2VyUHJlZmVyZW5jZU5hbWVzcGFjZXMpKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdNZW1vcnkgdXNlclByZWZlcmVuY2VOYW1lc3BhY2VzIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBLTVPoqK3lrprjga7jg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCBrbXNDb25maWcgPSBjb25maWcua21zQ29uZmlnO1xuICAgIGlmIChrbXNDb25maWc/LmtleUFybikge1xuICAgICAgaWYgKCFrbXNDb25maWcua2V5QXJuLnN0YXJ0c1dpdGgoJ2Fybjphd3M6a21zOicpKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdNZW1vcnkgS01TIGtleUFybiBtdXN0IGJlIGEgdmFsaWQgS01TIEtleSBBUk4nKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSWRlbnRpdHnoqK3lrprjga7jg5Djg6rjg4fjg7zjgrfjg6fjg7NcbiAgICovXG4gIHByaXZhdGUgc3RhdGljIHZhbGlkYXRlSWRlbnRpdHkoXG4gICAgY29uZmlnOiBhbnksXG4gICAgZXJyb3JzOiBzdHJpbmdbXSxcbiAgICB3YXJuaW5nczogc3RyaW5nW11cbiAgKTogdm9pZCB7XG4gICAgLy8gRHluYW1vRELoqK3lrprjga7jg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCBkeW5hbW9EYkNvbmZpZyA9IGNvbmZpZy5keW5hbW9EYkNvbmZpZztcbiAgICBpZiAoZHluYW1vRGJDb25maWcpIHtcbiAgICAgIGlmIChkeW5hbW9EYkNvbmZpZy5yZWFkQ2FwYWNpdHkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoZHluYW1vRGJDb25maWcucmVhZENhcGFjaXR5IDwgMSkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKCdJZGVudGl0eSBEeW5hbW9EQiByZWFkQ2FwYWNpdHkgbXVzdCBiZSA+PSAxJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChkeW5hbW9EYkNvbmZpZy53cml0ZUNhcGFjaXR5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKGR5bmFtb0RiQ29uZmlnLndyaXRlQ2FwYWNpdHkgPCAxKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goJ0lkZW50aXR5IER5bmFtb0RCIHdyaXRlQ2FwYWNpdHkgbXVzdCBiZSA+PSAxJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSQkFD6Kit5a6a44Gu44OB44Kn44OD44KvXG4gICAgY29uc3QgcmJhY0NvbmZpZyA9IGNvbmZpZy5yYmFjQ29uZmlnO1xuICAgIGlmIChyYmFjQ29uZmlnPy5kZWZhdWx0Um9sZSkge1xuICAgICAgaWYgKCFbJ0FkbWluJywgJ1VzZXInLCAnUmVhZE9ubHknXS5pbmNsdWRlcyhyYmFjQ29uZmlnLmRlZmF1bHRSb2xlKSkge1xuICAgICAgICBlcnJvcnMucHVzaCgnSWRlbnRpdHkgUkJBQyBkZWZhdWx0Um9sZSBtdXN0IGJlIEFkbWluLCBVc2VyLCBvciBSZWFkT25seScpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChyYmFjQ29uZmlnPy5jdXN0b21Sb2xlcykge1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHJiYWNDb25maWcuY3VzdG9tUm9sZXMpKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdJZGVudGl0eSBSQkFDIGN1c3RvbVJvbGVzIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJiYWNDb25maWcuY3VzdG9tUm9sZXMuZm9yRWFjaCgocm9sZTogYW55LCBpbmRleDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgaWYgKCFyb2xlLm5hbWUpIHtcbiAgICAgICAgICAgIGVycm9ycy5wdXNoKGBJZGVudGl0eSBSQkFDIGN1c3RvbVJvbGVzWyR7aW5kZXh9XSBtdXN0IGhhdmUgYSBuYW1lYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghcm9sZS5wZXJtaXNzaW9ucyB8fCAhQXJyYXkuaXNBcnJheShyb2xlLnBlcm1pc3Npb25zKSkge1xuICAgICAgICAgICAgZXJyb3JzLnB1c2goYElkZW50aXR5IFJCQUMgY3VzdG9tUm9sZXNbJHtpbmRleH1dIG11c3QgaGF2ZSBhIHBlcm1pc3Npb25zIGFycmF5YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQnJvd3NlcuioreWumuOBruODkOODquODh+ODvOOCt+ODp+ODs1xuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgdmFsaWRhdGVCcm93c2VyKFxuICAgIGNvbmZpZzogYW55LFxuICAgIGVycm9yczogc3RyaW5nW10sXG4gICAgd2FybmluZ3M6IHN0cmluZ1tdXG4gICk6IHZvaWQge1xuICAgIC8vIOOCueODiOODrOODvOOCuOioreWumuOBruODgeOCp+ODg+OCr1xuICAgIGNvbnN0IHN0b3JhZ2VDb25maWcgPSBjb25maWcuc3RvcmFnZUNvbmZpZztcbiAgICBpZiAoc3RvcmFnZUNvbmZpZykge1xuICAgICAgaWYgKCFzdG9yYWdlQ29uZmlnLmJ1Y2tldE5hbWUgJiYgIXN0b3JhZ2VDb25maWcuZnN4UzNBY2Nlc3NQb2ludEFybikge1xuICAgICAgICB3YXJuaW5ncy5wdXNoKCdCcm93c2VyIHN0b3JhZ2U6IG5laXRoZXIgYnVja2V0TmFtZSBub3IgZnN4UzNBY2Nlc3NQb2ludEFybiBpcyBzcGVjaWZpZWQgLSBkZWZhdWx0IGJ1Y2tldCB3aWxsIGJlIGNyZWF0ZWQnKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdG9yYWdlQ29uZmlnLmZzeFMzQWNjZXNzUG9pbnRBcm4pIHtcbiAgICAgICAgaWYgKCFzdG9yYWdlQ29uZmlnLmZzeFMzQWNjZXNzUG9pbnRBcm4uc3RhcnRzV2l0aCgnYXJuOmF3czpzMzonKSkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKCdCcm93c2VyIGZzeFMzQWNjZXNzUG9pbnRBcm4gbXVzdCBiZSBhIHZhbGlkIFMzIEFjY2VzcyBQb2ludCBBUk4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFB1cHBldGVlcuioreWumuOBruODgeOCp+ODg+OCr1xuICAgIGNvbnN0IHB1cHBldGVlckNvbmZpZyA9IGNvbmZpZy5wdXBwZXRlZXJDb25maWc7XG4gICAgaWYgKHB1cHBldGVlckNvbmZpZykge1xuICAgICAgaWYgKHB1cHBldGVlckNvbmZpZy50aW1lb3V0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHB1cHBldGVlckNvbmZpZy50aW1lb3V0IDwgMTAwMCB8fCBwdXBwZXRlZXJDb25maWcudGltZW91dCA+IDMwMDAwMCkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKCdCcm93c2VyIFB1cHBldGVlciB0aW1lb3V0IG11c3QgYmUgYmV0d2VlbiAxMDAwIGFuZCAzMDAwMDAgbXMgKDEtMzAwIHNlY29uZHMpJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChwdXBwZXRlZXJDb25maWcuZGVmYXVsdFZpZXdwb3J0KSB7XG4gICAgICAgIGNvbnN0IHZpZXdwb3J0ID0gcHVwcGV0ZWVyQ29uZmlnLmRlZmF1bHRWaWV3cG9ydDtcbiAgICAgICAgaWYgKHZpZXdwb3J0LndpZHRoIDwgMTAwIHx8IHZpZXdwb3J0LndpZHRoID4gMzg0MCkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKCdCcm93c2VyIFB1cHBldGVlciB2aWV3cG9ydCB3aWR0aCBtdXN0IGJlIGJldHdlZW4gMTAwIGFuZCAzODQwIHBpeGVscycpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh2aWV3cG9ydC5oZWlnaHQgPCAxMDAgfHwgdmlld3BvcnQuaGVpZ2h0ID4gMjE2MCkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKCdCcm93c2VyIFB1cHBldGVlciB2aWV3cG9ydCBoZWlnaHQgbXVzdCBiZSBiZXR3ZWVuIDEwMCBhbmQgMjE2MCBwaXhlbHMnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDb2RlIEludGVycHJldGVy6Kit5a6a44Gu44OQ44Oq44OH44O844K344On44OzXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyB2YWxpZGF0ZUNvZGVJbnRlcnByZXRlcihcbiAgICBjb25maWc6IGFueSxcbiAgICBlcnJvcnM6IHN0cmluZ1tdLFxuICAgIHdhcm5pbmdzOiBzdHJpbmdbXVxuICApOiB2b2lkIHtcbiAgICAvLyDlrp/ooYzoqK3lrprjga7jg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCBleGVjdXRpb25Db25maWcgPSBjb25maWcuZXhlY3V0aW9uQ29uZmlnO1xuICAgIGlmIChleGVjdXRpb25Db25maWcpIHtcbiAgICAgIGlmIChleGVjdXRpb25Db25maWcudGltZW91dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChleGVjdXRpb25Db25maWcudGltZW91dCA8IDEgfHwgZXhlY3V0aW9uQ29uZmlnLnRpbWVvdXQgPiAzMDApIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCgnQ29kZSBJbnRlcnByZXRlciB0aW1lb3V0IG11c3QgYmUgYmV0d2VlbiAxIGFuZCAzMDAgc2Vjb25kcycpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZXhlY3V0aW9uQ29uZmlnLm1heENvbmN1cnJlbnRTZXNzaW9ucyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChleGVjdXRpb25Db25maWcubWF4Q29uY3VycmVudFNlc3Npb25zIDwgMSkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKCdDb2RlIEludGVycHJldGVyIG1heENvbmN1cnJlbnRTZXNzaW9ucyBtdXN0IGJlID49IDEnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXhlY3V0aW9uQ29uZmlnLm1heENvbmN1cnJlbnRTZXNzaW9ucyA+IDEwMCkge1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2goJ0NvZGUgSW50ZXJwcmV0ZXIgbWF4Q29uY3VycmVudFNlc3Npb25zID4gMTAwIG1heSBjYXVzZSByZXNvdXJjZSBleGhhdXN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChleGVjdXRpb25Db25maWcuYWxsb3dlZExhbmd1YWdlcykge1xuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoZXhlY3V0aW9uQ29uZmlnLmFsbG93ZWRMYW5ndWFnZXMpKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goJ0NvZGUgSW50ZXJwcmV0ZXIgYWxsb3dlZExhbmd1YWdlcyBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gICAgICAgIH0gZWxzZSBpZiAoZXhlY3V0aW9uQ29uZmlnLmFsbG93ZWRMYW5ndWFnZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goJ0NvZGUgSW50ZXJwcmV0ZXIgYWxsb3dlZExhbmd1YWdlcyBtdXN0IG5vdCBiZSBlbXB0eScpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g44OR44OD44Kx44O844K4566h55CG6Kit5a6a44Gu44OB44Kn44OD44KvXG4gICAgY29uc3QgcGFja2FnZUNvbmZpZyA9IGNvbmZpZy5wYWNrYWdlTWFuYWdlbWVudENvbmZpZztcbiAgICBpZiAocGFja2FnZUNvbmZpZykge1xuICAgICAgaWYgKHBhY2thZ2VDb25maWcuYWxsb3dlZFBhY2thZ2VzICYmICFBcnJheS5pc0FycmF5KHBhY2thZ2VDb25maWcuYWxsb3dlZFBhY2thZ2VzKSkge1xuICAgICAgICBlcnJvcnMucHVzaCgnQ29kZSBJbnRlcnByZXRlciBhbGxvd2VkUGFja2FnZXMgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgfVxuICAgICAgaWYgKHBhY2thZ2VDb25maWcucGFja2FnZVdoaXRlbGlzdCkge1xuICAgICAgICB3YXJuaW5ncy5wdXNoKCdDb2RlIEludGVycHJldGVyIHBhY2thZ2VXaGl0ZWxpc3QgaXMgZGVwcmVjYXRlZCAtIHVzZSBhbGxvd2VkUGFja2FnZXMgaW5zdGVhZCcpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBPYnNlcnZhYmlsaXR56Kit5a6a44Gu44OQ44Oq44OH44O844K344On44OzXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyB2YWxpZGF0ZU9ic2VydmFiaWxpdHkoXG4gICAgY29uZmlnOiBhbnksXG4gICAgZXJyb3JzOiBzdHJpbmdbXSxcbiAgICB3YXJuaW5nczogc3RyaW5nW11cbiAgKTogdm9pZCB7XG4gICAgLy8gWC1SYXnoqK3lrprjga7jg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCB4cmF5Q29uZmlnID0gY29uZmlnLnhyYXlDb25maWc7XG4gICAgaWYgKHhyYXlDb25maWcpIHtcbiAgICAgIGlmICh4cmF5Q29uZmlnLnNhbXBsaW5nUmF0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh4cmF5Q29uZmlnLnNhbXBsaW5nUmF0ZSA8IDAgfHwgeHJheUNvbmZpZy5zYW1wbGluZ1JhdGUgPiAxKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goJ09ic2VydmFiaWxpdHkgWC1SYXkgc2FtcGxpbmdSYXRlIG11c3QgYmUgYmV0d2VlbiAwLjAgYW5kIDEuMCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh4cmF5Q29uZmlnLnNhbXBsaW5nUmF0ZSA8IDAuMDEpIHtcbiAgICAgICAgICB3YXJuaW5ncy5wdXNoKCdPYnNlcnZhYmlsaXR5IFgtUmF5IHNhbXBsaW5nUmF0ZSA8IDAuMDEgbWF5IG1pc3MgaW1wb3J0YW50IHRyYWNlcycpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRXYXRjaOioreWumuOBruODgeOCp+ODg+OCr1xuICAgIGNvbnN0IGNsb3VkV2F0Y2hDb25maWcgPSBjb25maWcuY2xvdWRXYXRjaENvbmZpZztcbiAgICBpZiAoY2xvdWRXYXRjaENvbmZpZykge1xuICAgICAgaWYgKGNsb3VkV2F0Y2hDb25maWcubG9nUmV0ZW50aW9uRGF5cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChjbG91ZFdhdGNoQ29uZmlnLmxvZ1JldGVudGlvbkRheXMgPCAxKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goJ09ic2VydmFiaWxpdHkgQ2xvdWRXYXRjaCBsb2dSZXRlbnRpb25EYXlzIG11c3QgYmUgPj0gMScpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoY2xvdWRXYXRjaENvbmZpZy5hbGFybUVtYWlsKSB7XG4gICAgICAgIGNvbnN0IGVtYWlsUmVnZXggPSAvXlteXFxzQF0rQFteXFxzQF0rXFwuW15cXHNAXSskLztcbiAgICAgICAgaWYgKCFlbWFpbFJlZ2V4LnRlc3QoY2xvdWRXYXRjaENvbmZpZy5hbGFybUVtYWlsKSkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKCdPYnNlcnZhYmlsaXR5IENsb3VkV2F0Y2ggYWxhcm1FbWFpbCBtdXN0IGJlIGEgdmFsaWQgZW1haWwgYWRkcmVzcycpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g44Ko44Op44O86L+96Leh6Kit5a6a44Gu44OB44Kn44OD44KvXG4gICAgY29uc3QgZXJyb3JUcmFja2luZ0NvbmZpZyA9IGNvbmZpZy5lcnJvclRyYWNraW5nQ29uZmlnO1xuICAgIGlmIChlcnJvclRyYWNraW5nQ29uZmlnKSB7XG4gICAgICBpZiAoZXJyb3JUcmFja2luZ0NvbmZpZy5lcnJvclRocmVzaG9sZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChlcnJvclRyYWNraW5nQ29uZmlnLmVycm9yVGhyZXNob2xkIDwgMSkge1xuICAgICAgICAgIGVycm9ycy5wdXNoKCdPYnNlcnZhYmlsaXR5IGVycm9yVGhyZXNob2xkIG11c3QgYmUgPj0gMScpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV2YWx1YXRpb25z6Kit5a6a44Gu44OQ44Oq44OH44O844K344On44OzXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyB2YWxpZGF0ZUV2YWx1YXRpb25zKFxuICAgIGNvbmZpZzogYW55LFxuICAgIGVycm9yczogc3RyaW5nW10sXG4gICAgd2FybmluZ3M6IHN0cmluZ1tdXG4gICk6IHZvaWQge1xuICAgIC8vIOWTgeizquODoeODiOODquOCr+OCueioreWumuOBruODgeOCp+ODg+OCr1xuICAgIGNvbnN0IHF1YWxpdHlNZXRyaWNzQ29uZmlnID0gY29uZmlnLnF1YWxpdHlNZXRyaWNzQ29uZmlnO1xuICAgIGlmIChxdWFsaXR5TWV0cmljc0NvbmZpZykge1xuICAgICAgaWYgKHF1YWxpdHlNZXRyaWNzQ29uZmlnLmVuYWJsZWRNZXRyaWNzKSB7XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShxdWFsaXR5TWV0cmljc0NvbmZpZy5lbmFibGVkTWV0cmljcykpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCgnRXZhbHVhdGlvbnMgZW5hYmxlZE1ldHJpY3MgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICB9IGVsc2UgaWYgKHF1YWxpdHlNZXRyaWNzQ29uZmlnLmVuYWJsZWRNZXRyaWNzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHdhcm5pbmdzLnB1c2goJ0V2YWx1YXRpb25zIGVuYWJsZWRNZXRyaWNzIGlzIGVtcHR5IC0gbm8gbWV0cmljcyB3aWxsIGJlIGV2YWx1YXRlZCcpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocXVhbGl0eU1ldHJpY3NDb25maWcuZXZhbHVhdGlvbkZyZXF1ZW5jeSkge1xuICAgICAgICBpZiAoIVsncmVhbHRpbWUnLCAnaG91cmx5JywgJ2RhaWx5J10uaW5jbHVkZXMocXVhbGl0eU1ldHJpY3NDb25maWcuZXZhbHVhdGlvbkZyZXF1ZW5jeSkpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCgnRXZhbHVhdGlvbnMgZXZhbHVhdGlvbkZyZXF1ZW5jeSBtdXN0IGJlIHJlYWx0aW1lLCBob3VybHksIG9yIGRhaWx5Jyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBL0Ljg4bjgrnjg4joqK3lrprjga7jg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCBhYlRlc3RDb25maWcgPSBjb25maWcuYWJUZXN0Q29uZmlnO1xuICAgIGlmIChhYlRlc3RDb25maWcpIHtcbiAgICAgIGlmIChhYlRlc3RDb25maWcubWluU2FtcGxlU2l6ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChhYlRlc3RDb25maWcubWluU2FtcGxlU2l6ZSA8IDEwKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goJ0V2YWx1YXRpb25zIEEvQiB0ZXN0IG1pblNhbXBsZVNpemUgbXVzdCBiZSA+PSAxMCcpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoYWJUZXN0Q29uZmlnLmNvbmZpZGVuY2VMZXZlbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChhYlRlc3RDb25maWcuY29uZmlkZW5jZUxldmVsIDwgMC41IHx8IGFiVGVzdENvbmZpZy5jb25maWRlbmNlTGV2ZWwgPiAwLjk5KSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goJ0V2YWx1YXRpb25zIEEvQiB0ZXN0IGNvbmZpZGVuY2VMZXZlbCBtdXN0IGJlIGJldHdlZW4gMC41IGFuZCAwLjk5Jyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnoqZXkvqHoqK3lrprjga7jg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCBwZXJmb3JtYW5jZUNvbmZpZyA9IGNvbmZpZy5wZXJmb3JtYW5jZUV2YWx1YXRpb25Db25maWc7XG4gICAgaWYgKHBlcmZvcm1hbmNlQ29uZmlnKSB7XG4gICAgICBpZiAocGVyZm9ybWFuY2VDb25maWcubGF0ZW5jeVRocmVzaG9sZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChwZXJmb3JtYW5jZUNvbmZpZy5sYXRlbmN5VGhyZXNob2xkIDwgMTAwKSB7XG4gICAgICAgICAgZXJyb3JzLnB1c2goJ0V2YWx1YXRpb25zIGxhdGVuY3lUaHJlc2hvbGQgbXVzdCBiZSA+PSAxMDAgbXMnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHBlcmZvcm1hbmNlQ29uZmlnLnRocm91Z2hwdXRUaHJlc2hvbGQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAocGVyZm9ybWFuY2VDb25maWcudGhyb3VnaHB1dFRocmVzaG9sZCA8IDEpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCgnRXZhbHVhdGlvbnMgdGhyb3VnaHB1dFRocmVzaG9sZCBtdXN0IGJlID49IDEgcmVxL3MnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHBlcmZvcm1hbmNlQ29uZmlnLmNvc3RUaHJlc2hvbGQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAocGVyZm9ybWFuY2VDb25maWcuY29zdFRocmVzaG9sZCA8IDAuMDEpIHtcbiAgICAgICAgICBlcnJvcnMucHVzaCgnRXZhbHVhdGlvbnMgY29zdFRocmVzaG9sZCBtdXN0IGJlID49IDAuMDEgVVNEJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUG9saWN56Kit5a6a44Gu44OQ44Oq44OH44O844K344On44OzXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyB2YWxpZGF0ZVBvbGljeShcbiAgICBjb25maWc6IGFueSxcbiAgICBlcnJvcnM6IHN0cmluZ1tdLFxuICAgIHdhcm5pbmdzOiBzdHJpbmdbXVxuICApOiB2b2lkIHtcbiAgICAvLyDoh6rnhLboqIDoqp7jg53jg6rjgrfjg7zoqK3lrprjga7jg4Hjgqfjg4Pjgq9cbiAgICBjb25zdCBuYXR1cmFsTGFuZ3VhZ2VDb25maWcgPSBjb25maWcubmF0dXJhbExhbmd1YWdlUG9saWN5Q29uZmlnO1xuICAgIGlmIChuYXR1cmFsTGFuZ3VhZ2VDb25maWc/LmRlZmF1bHRQb2xpY3lUZW1wbGF0ZSkge1xuICAgICAgY29uc3QgdmFsaWRUZW1wbGF0ZXMgPSBbJ3N0YW5kYXJkJywgJ3N0cmljdCcsICdwZXJtaXNzaXZlJ107XG4gICAgICBpZiAoIXZhbGlkVGVtcGxhdGVzLmluY2x1ZGVzKG5hdHVyYWxMYW5ndWFnZUNvbmZpZy5kZWZhdWx0UG9saWN5VGVtcGxhdGUpKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goYFBvbGljeSBkZWZhdWx0UG9saWN5VGVtcGxhdGUgJyR7bmF0dXJhbExhbmd1YWdlQ29uZmlnLmRlZmF1bHRQb2xpY3lUZW1wbGF0ZX0nIGlzIG5vdCBhIHN0YW5kYXJkIHRlbXBsYXRlIChzdGFuZGFyZCwgc3RyaWN0LCBwZXJtaXNzaXZlKWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENlZGFy57Wx5ZCI6Kit5a6a44Gu44OB44Kn44OD44Kv77yI54m544Gr44OQ44Oq44OH44O844K344On44Oz5LiN6KaB77yJXG4gICAgLy8gZW5hYmxlRm9ybWFsVmVyaWZpY2F0aW9u44GoZW5hYmxlQ29uZmxpY3REZXRlY3Rpb27jga9ib29sZWFu5YCk44Gq44Gu44Gn5Z6L44OB44Kn44OD44Kv44Gu44G/XG4gIH1cbn1cbiJdfQ==