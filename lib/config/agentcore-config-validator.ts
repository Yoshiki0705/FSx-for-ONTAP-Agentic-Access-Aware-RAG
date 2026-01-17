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

import { AgentCoreConfig } from '../../types/agentcore-config';

/**
 * バリデーション結果
 */
export interface ValidationResult {
  /**
   * バリデーション成功フラグ
   */
  readonly valid: boolean;

  /**
   * エラーメッセージリスト
   */
  readonly errors: string[];

  /**
   * 警告メッセージリスト
   */
  readonly warnings: string[];
}

/**
 * AgentCore設定バリデータークラス
 */
export class AgentCoreConfigValidator {
  /**
   * AgentCore設定をバリデーション
   * 
   * @param config AgentCore設定
   * @returns バリデーション結果
   */
  static validate(config: AgentCoreConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

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
  private static validateRuntime(
    config: any,
    errors: string[],
    warnings: string[]
  ): void {
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
  private static validateGateway(
    config: any,
    errors: string[],
    warnings: string[]
  ): void {
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
      } else if (lambdaConfig.functionArns.length === 0) {
        warnings.push('Gateway functionArns is empty - no Lambda functions will be converted');
      } else {
        lambdaConfig.functionArns.forEach((arn: string, index: number) => {
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
      } else {
        mcpConfig.serverEndpoints.forEach((endpoint: any, index: number) => {
          if (!endpoint.name) {
            errors.push(`Gateway serverEndpoints[${index}] must have a name`);
          }
          if (!endpoint.endpoint) {
            errors.push(`Gateway serverEndpoints[${index}] must have an endpoint URL`);
          } else if (!endpoint.endpoint.startsWith('http://') && !endpoint.endpoint.startsWith('https://')) {
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
  private static validateMemory(
    config: any,
    errors: string[],
    warnings: string[]
  ): void {
    const strategies = config.memoryStrategyConfig;
    if (strategies) {
      // 少なくとも1つのストラテジーが有効化されているかチェック
      const hasEnabledStrategy =
        strategies.enableSemantic ||
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
  private static validateIdentity(
    config: any,
    errors: string[],
    warnings: string[]
  ): void {
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
      } else {
        rbacConfig.customRoles.forEach((role: any, index: number) => {
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
  private static validateBrowser(
    config: any,
    errors: string[],
    warnings: string[]
  ): void {
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
  private static validateCodeInterpreter(
    config: any,
    errors: string[],
    warnings: string[]
  ): void {
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
        } else if (executionConfig.allowedLanguages.length === 0) {
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
  private static validateObservability(
    config: any,
    errors: string[],
    warnings: string[]
  ): void {
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
  private static validateEvaluations(
    config: any,
    errors: string[],
    warnings: string[]
  ): void {
    // 品質メトリクス設定のチェック
    const qualityMetricsConfig = config.qualityMetricsConfig;
    if (qualityMetricsConfig) {
      if (qualityMetricsConfig.enabledMetrics) {
        if (!Array.isArray(qualityMetricsConfig.enabledMetrics)) {
          errors.push('Evaluations enabledMetrics must be an array');
        } else if (qualityMetricsConfig.enabledMetrics.length === 0) {
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
  private static validatePolicy(
    config: any,
    errors: string[],
    warnings: string[]
  ): void {
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
