/**
 * Amazon Bedrock AgentCore Gateway Construct
 * 
 * このConstructは、既存のAPI/Lambda関数/MCPサーバーをBedrock Agent互換ツールに自動変換します。
 * 
 * 主要機能:
 * - REST API → Bedrock Agent Tool変換
 * - Lambda関数 → Bedrock Agent Tool変換
 * - MCPサーバー統合
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as kms from 'aws-cdk-lib/aws-kms';

/**
 * REST API変換設定
 */
export interface RestApiConversionConfig {
  /**
   * OpenAPI仕様ファイルのパス（S3 URIまたはローカルパス）
   */
  readonly openApiSpecPath: string;

  /**
   * API Gateway統合設定
   */
  readonly apiGatewayIntegration?: {
    /**
     * API Gateway REST APIのID
     */
    readonly apiId: string;

    /**
     * API Gatewayのステージ名
     */
    readonly stageName: string;

    /**
     * 認証タイプ（IAM, COGNITO, API_KEY, NONE）
     */
    readonly authType?: 'IAM' | 'COGNITO' | 'API_KEY' | 'NONE';
  };

  /**
   * 変換オプション
   */
  readonly conversionOptions?: {
    /**
     * 自動的にBedrock Agent Tool定義を生成するか
     */
    readonly autoGenerateToolDefinitions?: boolean;

    /**
     * カスタムツール名プレフィックス
     */
    readonly toolNamePrefix?: string;

    /**
     * 除外するエンドポイントのパターン（正規表現）
     */
    readonly excludePatterns?: string[];
  };
}

/**
 * Lambda関数変換設定
 */
export interface LambdaFunctionConversionConfig {
  /**
   * 変換対象のLambda関数ARNリスト
   */
  readonly functionArns: string[];

  /**
   * Lambda関数のメタデータ取得方法
   */
  readonly metadataSource?: {
    /**
     * 関数のタグからメタデータを取得するか
     */
    readonly useTags?: boolean;

    /**
     * 関数の環境変数からメタデータを取得するか
     */
    readonly useEnvironmentVariables?: boolean;

    /**
     * カスタムメタデータプロバイダー（Lambda関数ARN）
     */
    readonly customMetadataProvider?: string;
  };

  /**
   * 変換オプション
   */
  readonly conversionOptions?: {
    /**
     * 自動的にBedrock Agent Tool定義を生成するか
     */
    readonly autoGenerateToolDefinitions?: boolean;

    /**
     * カスタムツール名プレフィックス
     */
    readonly toolNamePrefix?: string;

    /**
     * タイムアウト設定（秒）
     */
    readonly timeout?: number;
  };
}

/**
 * MCPサーバー統合設定
 */
export interface McpServerIntegrationConfig {
  /**
   * MCPサーバーのエンドポイントURL
   */
  readonly serverEndpoint: string;

  /**
   * MCPサーバーの認証設定
   */
  readonly authentication?: {
    /**
     * 認証タイプ（API_KEY, OAUTH2, NONE）
     */
    readonly type: 'API_KEY' | 'OAUTH2' | 'NONE';

    /**
     * APIキー（Secrets Manager ARN）
     */
    readonly apiKeySecretArn?: string;

    /**
     * OAuth2設定
     */
    readonly oauth2Config?: {
      /**
       * クライアントID
       */
      readonly clientId: string;

      /**
       * クライアントシークレット（Secrets Manager ARN）
       */
      readonly clientSecretArn: string;

      /**
       * トークンエンドポイント
       */
      readonly tokenEndpoint: string;
    };
  };

  /**
   * WebSocket統合設定
   */
  readonly webSocketConfig?: {
    /**
     * WebSocket接続タイムアウト（秒）
     */
    readonly connectionTimeout?: number;

    /**
     * 再接続設定
     */
    readonly reconnectConfig?: {
      /**
       * 最大再接続試行回数
       */
      readonly maxRetries?: number;

      /**
       * 再接続間隔（ミリ秒）
       */
      readonly retryInterval?: number;
    };
  };

  /**
   * 変換オプション
   */
  readonly conversionOptions?: {
    /**
     * 自動的にBedrock Agent Tool定義を生成するか
     */
    readonly autoGenerateToolDefinitions?: boolean;

    /**
     * カスタムツール名プレフィックス
     */
    readonly toolNamePrefix?: string;

    /**
     * 取得するツール定義のフィルター（正規表現）
     */
    readonly toolNameFilter?: string;
  };
}

/**
 * Bedrock AgentCore Gateway Construct プロパティ
 */
export interface BedrockAgentCoreGatewayConstructProps {
  /**
   * Gateway機能を有効化するか
   * @default true
   */
  readonly enabled?: boolean;

  /**
   * プロジェクト名
   */
  readonly projectName: string;

  /**
   * 環境名（dev, staging, prod等）
   */
  readonly environment: string;

  /**
   * REST API変換設定
   */
  readonly restApiConversion?: RestApiConversionConfig;

  /**
   * Lambda関数変換設定
   */
  readonly lambdaFunctionConversion?: LambdaFunctionConversionConfig;

  /**
   * MCPサーバー統合設定
   */
  readonly mcpServerIntegration?: McpServerIntegrationConfig;

  /**
   * KMS暗号化キー（オプション）
   * 指定しない場合は自動生成される
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * ログ保持期間（日数）
   * @default 7
   */
  readonly logRetentionDays?: logs.RetentionDays;

  /**
   * タグ
   */
  readonly tags?: { [key: string]: string };
}

/**
 * Bedrock AgentCore Gateway Construct
 * 
 * 既存のAPI/Lambda関数/MCPサーバーをBedrock Agent互換ツールに自動変換します。
 */
export class BedrockAgentCoreGatewayConstruct extends Construct {
  /**
   * Gateway機能が有効かどうか
   */
  public readonly enabled: boolean;

  /**
   * REST API変換Lambda関数
   */
  public readonly restApiConverterFunction?: lambda.Function;

  /**
   * Lambda関数変換Lambda関数
   */
  public readonly lambdaConverterFunction?: lambda.Function;

  /**
   * MCPサーバー統合Lambda関数
   */
  public readonly mcpIntegrationFunction?: lambda.Function;

  /**
   * KMS暗号化キー
   */
  public readonly encryptionKey: kms.IKey;

  /**
   * IAM実行ロール
   */
  public readonly executionRole: iam.Role;

  /**
   * CloudWatch Logs ロググループ
   */
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: BedrockAgentCoreGatewayConstructProps) {
    super(scope, id);

    // 有効化フラグのチェック
    this.enabled = props.enabled ?? true;

    if (!this.enabled) {
      // 無効化されている場合は何もしない
      return;
    }

    // KMS暗号化キーの作成または取得
    this.encryptionKey = props.encryptionKey ?? this.createEncryptionKey(props);

    // IAM実行ロールの作成
    this.executionRole = this.createExecutionRole(props);

    // CloudWatch Logsロググループの作成
    this.logGroup = this.createLogGroup(props);

    // REST API変換機能の実装
    if (props.restApiConversion) {
      this.restApiConverterFunction = this.createRestApiConverterFunction(props);
    }

    // Lambda関数変換機能の実装
    if (props.lambdaFunctionConversion) {
      this.lambdaConverterFunction = this.createLambdaConverterFunction(props);
    }

    // MCPサーバー統合機能の実装
    if (props.mcpServerIntegration) {
      this.mcpIntegrationFunction = this.createMcpIntegrationFunction(props);
    }

    // タグの適用
    if (props.tags) {
      Object.entries(props.tags).forEach(([key, value]) => {
        cdk.Tags.of(this).add(key, value);
      });
    }

    // デフォルトタグの追加
    cdk.Tags.of(this).add('Component', 'BedrockAgentCoreGateway');
    cdk.Tags.of(this).add('Project', props.projectName);
    cdk.Tags.of(this).add('Environment', props.environment);
  }

  /**
   * KMS暗号化キーを作成
   */
  private createEncryptionKey(props: BedrockAgentCoreGatewayConstructProps): kms.Key {
    return new kms.Key(this, 'EncryptionKey', {
      description: `Encryption key for ${props.projectName}-${props.environment} Bedrock AgentCore Gateway`,
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }

  /**
   * IAM実行ロールを作成
   */
  private createExecutionRole(props: BedrockAgentCoreGatewayConstructProps): iam.Role {
    const role = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: `Execution role for ${props.projectName}-${props.environment} Bedrock AgentCore Gateway`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // KMS権限の追加
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'kms:Decrypt',
        'kms:Encrypt',
        'kms:GenerateDataKey',
      ],
      resources: [this.encryptionKey.keyArn],
    }));

    // Bedrock権限の追加
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeAgent',
        'bedrock:GetAgent',
        'bedrock:ListAgents',
      ],
      resources: ['*'],
    }));

    // API Gateway権限の追加（REST API変換が有効な場合）
    if (props.restApiConversion) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'apigateway:GET',
          'apigateway:POST',
        ],
        resources: ['*'],
      }));
    }

    // Lambda権限の追加（Lambda関数変換が有効な場合）
    if (props.lambdaFunctionConversion) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'lambda:GetFunction',
          'lambda:GetFunctionConfiguration',
          'lambda:InvokeFunction',
          'lambda:ListTags',
        ],
        resources: props.lambdaFunctionConversion.functionArns,
      }));
    }

    // Secrets Manager権限の追加（MCPサーバー統合が有効な場合）
    if (props.mcpServerIntegration?.authentication) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'secretsmanager:GetSecretValue',
        ],
        resources: [
          props.mcpServerIntegration.authentication.apiKeySecretArn || '*',
          props.mcpServerIntegration.authentication.oauth2Config?.clientSecretArn || '*',
        ].filter(arn => arn !== '*'),
      }));
    }

    return role;
  }

  /**
   * CloudWatch Logsロググループを作成
   */
  private createLogGroup(props: BedrockAgentCoreGatewayConstructProps): logs.LogGroup {
    return new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/bedrock-agent-core/gateway/${props.projectName}-${props.environment}`,
      retention: props.logRetentionDays ?? logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryptionKey: this.encryptionKey,
    });
  }

  /**
   * REST API変換Lambda関数を作成
   */
  private createRestApiConverterFunction(props: BedrockAgentCoreGatewayConstructProps): lambda.Function {
    if (!props.restApiConversion) {
      throw new Error('REST API変換設定が指定されていません');
    }

    const config = props.restApiConversion;

    // 環境変数の準備
    const environment: { [key: string]: string } = {
      PROJECT_NAME: props.projectName,
      ENVIRONMENT: props.environment,
      OPENAPI_SPEC_PATH: config.openApiSpecPath,
    };

    // API Gateway統合設定
    if (config.apiGatewayIntegration) {
      environment.API_GATEWAY_ID = config.apiGatewayIntegration.apiId;
      environment.API_GATEWAY_STAGE = config.apiGatewayIntegration.stageName;
      if (config.apiGatewayIntegration.authType) {
        environment.AUTH_TYPE = config.apiGatewayIntegration.authType;
      }
    }

    // 変換オプション
    if (config.conversionOptions) {
      if (config.conversionOptions.autoGenerateToolDefinitions !== undefined) {
        environment.AUTO_GENERATE_TOOLS = String(config.conversionOptions.autoGenerateToolDefinitions);
      }
      if (config.conversionOptions.toolNamePrefix) {
        environment.TOOL_NAME_PREFIX = config.conversionOptions.toolNamePrefix;
      }
      if (config.conversionOptions.excludePatterns) {
        environment.EXCLUDE_PATTERNS = JSON.stringify(config.conversionOptions.excludePatterns);
      }
    }

    // Lambda関数の作成
    const fn = new lambda.Function(this, 'RestApiConverterFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/agent-core-gateway/rest-api-converter'),
      role: this.executionRole,
      environment,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      logGroup: this.logGroup,
      description: `REST API Converter for ${props.projectName}-${props.environment} Bedrock AgentCore Gateway`,
    });

    // S3読み取り権限の追加（OpenAPI仕様がS3にある場合）
    if (config.openApiSpecPath.startsWith('s3://')) {
      const match = config.openApiSpecPath.match(/^s3:\/\/([^\/]+)\//);
      if (match) {
        const bucketName = match[1];
        fn.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:GetObjectVersion',
          ],
          resources: [`arn:aws:s3:::${bucketName}/*`],
        }));
      }
    }

    return fn;
  }

  /**
   * Lambda関数変換Lambda関数を作成
   */
  private createLambdaConverterFunction(props: BedrockAgentCoreGatewayConstructProps): lambda.Function {
    if (!props.lambdaFunctionConversion) {
      throw new Error('Lambda関数変換設定が指定されていません');
    }

    const config = props.lambdaFunctionConversion;

    // 環境変数の準備
    const environment: { [key: string]: string } = {
      PROJECT_NAME: props.projectName,
      ENVIRONMENT: props.environment,
    };

    // メタデータソース設定
    if (config.metadataSource) {
      if (config.metadataSource.useTags !== undefined) {
        environment.USE_TAGS = String(config.metadataSource.useTags);
      }
      if (config.metadataSource.useEnvironmentVariables !== undefined) {
        environment.USE_ENV_VARS = String(config.metadataSource.useEnvironmentVariables);
      }
      if (config.metadataSource.customMetadataProvider) {
        environment.CUSTOM_METADATA_PROVIDER = config.metadataSource.customMetadataProvider;
      }
    }

    // 変換オプション
    if (config.conversionOptions) {
      if (config.conversionOptions.autoGenerateToolDefinitions !== undefined) {
        environment.AUTO_GENERATE_TOOLS = String(config.conversionOptions.autoGenerateToolDefinitions);
      }
      if (config.conversionOptions.toolNamePrefix) {
        environment.TOOL_NAME_PREFIX = config.conversionOptions.toolNamePrefix;
      }
      if (config.conversionOptions.timeout) {
        environment.CONVERSION_TIMEOUT = String(config.conversionOptions.timeout);
      }
    }

    // Lambda関数の作成
    const fn = new lambda.Function(this, 'LambdaConverterFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/agent-core-gateway/lambda-function-converter'),
      role: this.executionRole,
      environment,
      timeout: cdk.Duration.seconds(config.conversionOptions?.timeout || 60),
      memorySize: 512,
      logGroup: this.logGroup,
      description: `Lambda Function Converter for ${props.projectName}-${props.environment} Bedrock AgentCore Gateway`,
    });

    // Lambda関数メタデータ取得権限の追加
    fn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:GetFunction',
        'lambda:GetFunctionConfiguration',
        'lambda:ListTags',
      ],
      resources: config.functionArns,
    }));

    // Lambda関数呼び出し権限の追加（カスタムメタデータプロバイダーがある場合）
    if (config.metadataSource?.customMetadataProvider) {
      fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'lambda:InvokeFunction',
        ],
        resources: [config.metadataSource.customMetadataProvider],
      }));
    }

    return fn;
  }

  /**
   * MCPサーバー統合Lambda関数を作成
   */
  private createMcpIntegrationFunction(props: BedrockAgentCoreGatewayConstructProps): lambda.Function {
    if (!props.mcpServerIntegration) {
      throw new Error('MCPサーバー統合設定が指定されていません');
    }

    const config = props.mcpServerIntegration;

    // 環境変数の準備
    const environment: { [key: string]: string } = {
      PROJECT_NAME: props.projectName,
      ENVIRONMENT: props.environment,
    };

    // WebSocket統合設定
    if (config.webSocketConfig) {
      if (config.webSocketConfig.connectionTimeout !== undefined) {
        environment.WS_CONNECTION_TIMEOUT = String(config.webSocketConfig.connectionTimeout);
      }
      if (config.webSocketConfig.reconnectConfig) {
        if (config.webSocketConfig.reconnectConfig.maxRetries !== undefined) {
          environment.MAX_RETRY_ATTEMPTS = String(config.webSocketConfig.reconnectConfig.maxRetries);
        }
        if (config.webSocketConfig.reconnectConfig.retryInterval !== undefined) {
          environment.RETRY_INTERVAL = String(config.webSocketConfig.reconnectConfig.retryInterval);
        }
      }
    }

    // 変換オプション
    if (config.conversionOptions) {
      if (config.conversionOptions.autoGenerateToolDefinitions !== undefined) {
        environment.AUTO_GENERATE_TOOLS = String(config.conversionOptions.autoGenerateToolDefinitions);
      }
      if (config.conversionOptions.toolNamePrefix) {
        environment.TOOL_NAME_PREFIX = config.conversionOptions.toolNamePrefix;
      }
      if (config.conversionOptions.toolNameFilter) {
        environment.TOOL_NAME_FILTER = config.conversionOptions.toolNameFilter;
      }
    }

    // Lambda関数の作成
    const fn = new lambda.Function(this, 'McpIntegrationFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/agent-core-gateway/mcp-server-integration'),
      role: this.executionRole,
      environment,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      logGroup: this.logGroup,
      description: `MCP Server Integration for ${props.projectName}-${props.environment} Bedrock AgentCore Gateway`,
    });

    // Secrets Manager読み取り権限の追加（認証が有効な場合）
    if (config.authentication) {
      const secretArns: string[] = [];

      if (config.authentication.apiKeySecretArn) {
        secretArns.push(config.authentication.apiKeySecretArn);
      }

      if (config.authentication.oauth2Config?.clientSecretArn) {
        secretArns.push(config.authentication.oauth2Config.clientSecretArn);
      }

      if (secretArns.length > 0) {
        fn.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'secretsmanager:GetSecretValue',
          ],
          resources: secretArns,
        }));
      }
    }

    return fn;
  }
}
