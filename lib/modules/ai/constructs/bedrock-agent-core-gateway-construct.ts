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
import * as s3 from 'aws-cdk-lib/aws-s3';

/**
 * REST API変換設定
 */
export interface RestApiConversionConfig {
  /**
   * OpenAPI仕様ファイルのS3キー
   * バケット名はgatewaySpecsBucketから取得
   */
  readonly openApiSpecKey?: string;

  /**
   * API Gateway統合設定
   */
  readonly apiGatewayIntegration?: {
    /**
     * API Gateway REST APIのID
     */
    readonly apiId?: string;

    /**
     * API Gatewayのステージ名
     */
    readonly stageName?: string;

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
   * 空の場合はLambda Converter機能を無効化
   */
  readonly functionArns?: string[];

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
  readonly serverEndpoint?: string;

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
      readonly clientId?: string;

      /**
       * クライアントシークレット（Secrets Manager ARN）
       */
      readonly clientSecretArn?: string;

      /**
       * トークンエンドポイント
       */
      readonly tokenEndpoint?: string;
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
   * Gateway Specs S3バケット（DataStackから参照）
   * IaC化: CloudFormation Importから動的に取得
   */
  readonly gatewaySpecsBucket?: s3.IBucket;
  
  /**
   * FSx for ONTAP File System ID（DataStackから参照）
   * IaC化: CloudFormation Importから動的に取得
   */
  readonly fsxFileSystemId?: string;

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
      console.log('ℹ️  Gateway Constructは無効化されています');
      return;
    }

    // KMS暗号化キーの作成または取得
    this.encryptionKey = props.encryptionKey ?? this.createEncryptionKey(props);

    // IAM実行ロールの作成
    this.executionRole = this.createExecutionRole(props);

    // CloudWatch Logsロググループの作成
    this.logGroup = this.createLogGroup(props);

    // REST API変換機能の実装（条件付き）
    if (props.restApiConversion && props.gatewaySpecsBucket) {
      console.log('🔄 REST API Converter作成中...');
      this.restApiConverterFunction = this.createRestApiConverterFunction(props);
      console.log('✅ REST API Converter作成完了');
    } else if (props.restApiConversion) {
      console.warn('⚠️  REST API変換が有効ですが、gatewaySpecsBucketが提供されていません');
    }

    // Lambda関数変換機能の実装（条件付き）
    if (props.lambdaFunctionConversion && 
        props.lambdaFunctionConversion.functionArns && 
        props.lambdaFunctionConversion.functionArns.length > 0) {
      console.log('🔄 Lambda Function Converter作成中...');
      this.lambdaConverterFunction = this.createLambdaConverterFunction(props);
      console.log('✅ Lambda Function Converter作成完了');
    } else if (props.lambdaFunctionConversion) {
      console.log('ℹ️  Lambda Function Converterは無効化されています（functionArnsが空）');
    }

    // MCPサーバー統合機能の実装（条件付き）
    if (props.mcpServerIntegration && props.mcpServerIntegration.serverEndpoint) {
      console.log('🔄 MCP Server Integration作成中...');
      this.mcpIntegrationFunction = this.createMcpIntegrationFunction(props);
      console.log('✅ MCP Server Integration作成完了');
    } else if (props.mcpServerIntegration) {
      console.warn('⚠️  MCP Server統合が有効ですが、serverEndpointが提供されていません');
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
    const key = new kms.Key(this, 'EncryptionKey', {
      description: `Encryption key for ${props.projectName}-${props.environment} Bedrock AgentCore Gateway`,
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    
    // CloudWatch Logsに KMS key使用権限を付与
    key.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal(`logs.${cdk.Stack.of(this).region}.amazonaws.com`)],
      actions: [
        'kms:Encrypt',
        'kms:Decrypt',
        'kms:ReEncrypt*',
        'kms:GenerateDataKey*',
        'kms:CreateGrant',
        'kms:DescribeKey',
      ],
      resources: ['*'],
      conditions: {
        ArnLike: {
          'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/bedrock-agent-core/gateway/${props.projectName}-${props.environment}`,
        },
      },
    }));
    
    return key;
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

    // Lambda権限の追加（Lambda関数変換が有効で、functionArnsが提供されている場合のみ）
    if (props.lambdaFunctionConversion?.functionArns && 
        props.lambdaFunctionConversion.functionArns.length > 0) {
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

    // Secrets Manager権限の追加（MCPサーバー統合が有効で、secretArnsが提供されている場合のみ）
    if (props.mcpServerIntegration?.authentication) {
      const secretArns: string[] = [];
      
      if (props.mcpServerIntegration.authentication.apiKeySecretArn) {
        secretArns.push(props.mcpServerIntegration.authentication.apiKeySecretArn);
      }
      
      if (props.mcpServerIntegration.authentication.oauth2Config?.clientSecretArn) {
        secretArns.push(props.mcpServerIntegration.authentication.oauth2Config.clientSecretArn);
      }
      
      // secretArnsが存在する場合のみポリシーを追加
      if (secretArns.length > 0) {
        role.addToPolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'secretsmanager:GetSecretValue',
          ],
          resources: secretArns,
        }));
      }
    }

    return role;
  }

  /**
   * CloudWatch Logsロググループを作成
   */
  private createLogGroup(props: BedrockAgentCoreGatewayConstructProps): logs.LogGroup {
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/bedrock-agent-core/gateway/${props.projectName}-${props.environment}`,
      retention: props.logRetentionDays ?? logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // KMS暗号化を無効化（CloudWatch Logsとの互換性問題を回避）
      // encryptionKey: this.encryptionKey,
    });
    
    return logGroup;
  }

  /**
   * REST API変換Lambda関数を作成（IaC版）
   */
  private createRestApiConverterFunction(props: BedrockAgentCoreGatewayConstructProps): lambda.Function {
    if (!props.restApiConversion || !props.gatewaySpecsBucket) {
      throw new Error('REST API変換設定またはgatewaySpecsBucketが指定されていません');
    }

    const config = props.restApiConversion;

    // 環境変数の準備（完全動的）
    const environment: { [key: string]: string } = {
      PROJECT_NAME: props.projectName,
      ENVIRONMENT: props.environment,
      GATEWAY_SPECS_BUCKET: props.gatewaySpecsBucket.bucketName,
      OPENAPI_SPEC_KEY: config.openApiSpecKey || 'openapi/sample-openapi.yaml',
    };

    // FSx File System ID（オプション）
    if (props.fsxFileSystemId) {
      environment.FSX_FILE_SYSTEM_ID = props.fsxFileSystemId;
    }

    // API Gateway統合設定（オプション）
    if (config.apiGatewayIntegration) {
      if (config.apiGatewayIntegration.apiId) {
        environment.API_GATEWAY_ID = config.apiGatewayIntegration.apiId;
      }
      if (config.apiGatewayIntegration.stageName) {
        environment.API_GATEWAY_STAGE = config.apiGatewayIntegration.stageName;
      }
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

    // S3読み取り権限の追加（Gateway Specs Bucket）
    props.gatewaySpecsBucket.grantRead(fn);

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

    // Lambda関数メタデータ取得権限の追加（functionArnsが提供されている場合のみ）
    if (config.functionArns && config.functionArns.length > 0) {
      fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'lambda:GetFunction',
          'lambda:GetFunctionConfiguration',
          'lambda:ListTags',
        ],
        resources: config.functionArns,
      }));
    }

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

    // MCPサーバーエンドポイント（オプション）
    if (config.serverEndpoint) {
      environment.MCP_SERVER_ENDPOINT = config.serverEndpoint;
    }

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
