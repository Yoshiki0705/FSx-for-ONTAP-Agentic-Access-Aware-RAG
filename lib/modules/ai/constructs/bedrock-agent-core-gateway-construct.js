"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockAgentCoreGatewayConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const constructs_1 = require("constructs");
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
/**
 * Bedrock AgentCore Gateway Construct
 *
 * 既存のAPI/Lambda関数/MCPサーバーをBedrock Agent互換ツールに自動変換します。
 */
class BedrockAgentCoreGatewayConstruct extends constructs_1.Construct {
    /**
     * Gateway機能が有効かどうか
     */
    enabled;
    /**
     * REST API変換Lambda関数
     */
    restApiConverterFunction;
    /**
     * Lambda関数変換Lambda関数
     */
    lambdaConverterFunction;
    /**
     * MCPサーバー統合Lambda関数
     */
    mcpIntegrationFunction;
    /**
     * KMS暗号化キー
     */
    encryptionKey;
    /**
     * IAM実行ロール
     */
    executionRole;
    /**
     * CloudWatch Logs ロググループ
     */
    logGroup;
    constructor(scope, id, props) {
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
        }
        else if (props.restApiConversion) {
            console.warn('⚠️  REST API変換が有効ですが、gatewaySpecsBucketが提供されていません');
        }
        // Lambda関数変換機能の実装（条件付き）
        if (props.lambdaFunctionConversion &&
            props.lambdaFunctionConversion.functionArns &&
            props.lambdaFunctionConversion.functionArns.length > 0) {
            console.log('🔄 Lambda Function Converter作成中...');
            this.lambdaConverterFunction = this.createLambdaConverterFunction(props);
            console.log('✅ Lambda Function Converter作成完了');
        }
        else if (props.lambdaFunctionConversion) {
            console.log('ℹ️  Lambda Function Converterは無効化されています（functionArnsが空）');
        }
        // MCPサーバー統合機能の実装（条件付き）
        if (props.mcpServerIntegration && props.mcpServerIntegration.serverEndpoint) {
            console.log('🔄 MCP Server Integration作成中...');
            this.mcpIntegrationFunction = this.createMcpIntegrationFunction(props);
            console.log('✅ MCP Server Integration作成完了');
        }
        else if (props.mcpServerIntegration) {
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
    createEncryptionKey(props) {
        return new kms.Key(this, 'EncryptionKey', {
            description: `Encryption key for ${props.projectName}-${props.environment} Bedrock AgentCore Gateway`,
            enableKeyRotation: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
    }
    /**
     * IAM実行ロールを作成
     */
    createExecutionRole(props) {
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
    createLogGroup(props) {
        return new logs.LogGroup(this, 'LogGroup', {
            logGroupName: `/aws/bedrock-agent-core/gateway/${props.projectName}-${props.environment}`,
            retention: props.logRetentionDays ?? logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            encryptionKey: this.encryptionKey,
        });
    }
    /**
     * REST API変換Lambda関数を作成（IaC版）
     */
    createRestApiConverterFunction(props) {
        if (!props.restApiConversion || !props.gatewaySpecsBucket) {
            throw new Error('REST API変換設定またはgatewaySpecsBucketが指定されていません');
        }
        const config = props.restApiConversion;
        // 環境変数の準備（完全動的）
        const environment = {
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
    createLambdaConverterFunction(props) {
        if (!props.lambdaFunctionConversion) {
            throw new Error('Lambda関数変換設定が指定されていません');
        }
        const config = props.lambdaFunctionConversion;
        // 環境変数の準備
        const environment = {
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
    createMcpIntegrationFunction(props) {
        if (!props.mcpServerIntegration) {
            throw new Error('MCPサーバー統合設定が指定されていません');
        }
        const config = props.mcpServerIntegration;
        // 環境変数の準備
        const environment = {
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
            const secretArns = [];
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
exports.BedrockAgentCoreGatewayConstruct = BedrockAgentCoreGatewayConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLWdhdGV3YXktY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmVkcm9jay1hZ2VudC1jb3JlLWdhdGV3YXktY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7O0dBWUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLDJDQUF1QztBQUN2QywrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLDJEQUE2QztBQUM3Qyx5REFBMkM7QUFvUTNDOzs7O0dBSUc7QUFDSCxNQUFhLGdDQUFpQyxTQUFRLHNCQUFTO0lBQzdEOztPQUVHO0lBQ2EsT0FBTyxDQUFVO0lBRWpDOztPQUVHO0lBQ2Esd0JBQXdCLENBQW1CO0lBRTNEOztPQUVHO0lBQ2EsdUJBQXVCLENBQW1CO0lBRTFEOztPQUVHO0lBQ2Esc0JBQXNCLENBQW1CO0lBRXpEOztPQUVHO0lBQ2EsYUFBYSxDQUFXO0lBRXhDOztPQUVHO0lBQ2EsYUFBYSxDQUFXO0lBRXhDOztPQUVHO0lBQ2EsUUFBUSxDQUFnQjtJQUV4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTRDO1FBQ3BGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsY0FBYztRQUNkLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUM7UUFFckMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsQixtQkFBbUI7WUFDbkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1lBQy9DLE9BQU87UUFDVCxDQUFDO1FBRUQsbUJBQW1CO1FBQ25CLElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFNUUsY0FBYztRQUNkLElBQUks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LE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsVUFBVSxFQUFFLEdBQUc7WUFDZixRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDdkIsV0FBVyxFQUFFLDhCQUE4QixLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQyxXQUFXLDRCQUE0QjtTQUM5RyxDQUFDLENBQUM7UUFFSCxxQ0FBcUM7UUFDckMsSUFBSSxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDMUIsTUFBTSxVQUFVLEdBQWEsRUFBRSxDQUFDO1lBRWhDLElBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDMUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3pELENBQUM7WUFFRCxJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBRSxDQUFDO2dCQUN4RCxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3RFLENBQUM7WUFFRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQzFCLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO29CQUN6QyxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO29CQUN4QixPQUFPLEVBQUU7d0JBQ1AsK0JBQStCO3FCQUNoQztvQkFDRCxTQUFTLEVBQUUsVUFBVTtpQkFDdEIsQ0FBQyxDQUFDLENBQUM7WUFDTixDQUFDO1FBQ0gsQ0FBQztRQUVELE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztDQUNGO0FBcGJELDRFQW9iQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQW1hem9uIEJlZHJvY2sgQWdlbnRDb3JlIEdhdGV3YXkgQ29uc3RydWN0XG4gKiBcbiAqIOOBk+OBrkNvbnN0cnVjdOOBr+OAgeaXouWtmOOBrkFQSS9MYW1iZGHplqLmlbAvTUNQ44K144O844OQ44O844KSQmVkcm9jayBBZ2VudOS6kuaPm+ODhOODvOODq+OBq+iHquWLleWkieaPm+OBl+OBvuOBmeOAglxuICogXG4gKiDkuLvopoHmqZ/og706XG4gKiAtIFJFU1QgQVBJIOKGkiBCZWRyb2NrIEFnZW50IFRvb2zlpInmj5tcbiAqIC0gTGFtYmRh6Zai5pWwIOKGkiBCZWRyb2NrIEFnZW50IFRvb2zlpInmj5tcbiAqIC0gTUNQ44K144O844OQ44O857Wx5ZCIXG4gKiBcbiAqIEBhdXRob3IgS2lybyBBSVxuICogQGRhdGUgMjAyNi0wMS0wM1xuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMga21zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1rbXMnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcblxuLyoqXG4gKiBSRVNUIEFQSeWkieaPm+ioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFJlc3RBcGlDb252ZXJzaW9uQ29uZmlnIHtcbiAgLyoqXG4gICAqIE9wZW5BUEnku5Xmp5jjg5XjgqHjgqTjg6vjga5TM+OCreODvFxuICAgKiDjg5DjgrHjg4Pjg4jlkI3jga9nYXRld2F5U3BlY3NCdWNrZXTjgYvjgonlj5blvpdcbiAgICovXG4gIHJlYWRvbmx5IG9wZW5BcGlTcGVjS2V5Pzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBUEkgR2F0ZXdheee1seWQiOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgYXBpR2F0ZXdheUludGVncmF0aW9uPzoge1xuICAgIC8qKlxuICAgICAqIEFQSSBHYXRld2F5IFJFU1QgQVBJ44GuSURcbiAgICAgKi9cbiAgICByZWFkb25seSBhcGlJZD86IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIEFQSSBHYXRld2F544Gu44K544OG44O844K45ZCNXG4gICAgICovXG4gICAgcmVhZG9ubHkgc3RhZ2VOYW1lPzogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICog6KqN6Ki844K/44Kk44OX77yISUFNLCBDT0dOSVRPLCBBUElfS0VZLCBOT05F77yJXG4gICAgICovXG4gICAgcmVhZG9ubHkgYXV0aFR5cGU/OiAnSUFNJyB8ICdDT0dOSVRPJyB8ICdBUElfS0VZJyB8ICdOT05FJztcbiAgfTtcblxuICAvKipcbiAgICog5aSJ5o+b44Kq44OX44K344On44OzXG4gICAqL1xuICByZWFkb25seSBjb252ZXJzaW9uT3B0aW9ucz86IHtcbiAgICAvKipcbiAgICAgKiDoh6rli5XnmoTjgatCZWRyb2NrIEFnZW50IFRvb2zlrprnvqnjgpLnlJ/miJDjgZnjgovjgYtcbiAgICAgKi9cbiAgICByZWFkb25seSBhdXRvR2VuZXJhdGVUb29sRGVmaW5pdGlvbnM/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog44Kr44K544K/44Og44OE44O844Or5ZCN44OX44Os44OV44Kj44OD44Kv44K5XG4gICAgICovXG4gICAgcmVhZG9ubHkgdG9vbE5hbWVQcmVmaXg/OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiDpmaTlpJbjgZnjgovjgqjjg7Pjg4njg53jgqTjg7Pjg4jjga7jg5Hjgr/jg7zjg7PvvIjmraPopo/ooajnj77vvIlcbiAgICAgKi9cbiAgICByZWFkb25seSBleGNsdWRlUGF0dGVybnM/OiBzdHJpbmdbXTtcbiAgfTtcbn1cblxuLyoqXG4gKiBMYW1iZGHplqLmlbDlpInmj5voqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBMYW1iZGFGdW5jdGlvbkNvbnZlcnNpb25Db25maWcge1xuICAvKipcbiAgICog5aSJ5o+b5a++6LGh44GuTGFtYmRh6Zai5pWwQVJO44Oq44K544OIXG4gICAqIOepuuOBruWgtOWQiOOBr0xhbWJkYSBDb252ZXJ0ZXLmqZ/og73jgpLnhKHlirnljJZcbiAgICovXG4gIHJlYWRvbmx5IGZ1bmN0aW9uQXJucz86IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDjga7jg6Hjgr/jg4fjg7zjgr/lj5blvpfmlrnms5VcbiAgICovXG4gIHJlYWRvbmx5IG1ldGFkYXRhU291cmNlPzoge1xuICAgIC8qKlxuICAgICAqIOmWouaVsOOBruOCv+OCsOOBi+OCieODoeOCv+ODh+ODvOOCv+OCkuWPluW+l+OBmeOCi+OBi1xuICAgICAqL1xuICAgIHJlYWRvbmx5IHVzZVRhZ3M/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog6Zai5pWw44Gu55Kw5aKD5aSJ5pWw44GL44KJ44Oh44K/44OH44O844K/44KS5Y+W5b6X44GZ44KL44GLXG4gICAgICovXG4gICAgcmVhZG9ubHkgdXNlRW52aXJvbm1lbnRWYXJpYWJsZXM/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog44Kr44K544K/44Og44Oh44K/44OH44O844K/44OX44Ot44OQ44Kk44OA44O877yITGFtYmRh6Zai5pWwQVJO77yJXG4gICAgICovXG4gICAgcmVhZG9ubHkgY3VzdG9tTWV0YWRhdGFQcm92aWRlcj86IHN0cmluZztcbiAgfTtcblxuICAvKipcbiAgICog5aSJ5o+b44Kq44OX44K344On44OzXG4gICAqL1xuICByZWFkb25seSBjb252ZXJzaW9uT3B0aW9ucz86IHtcbiAgICAvKipcbiAgICAgKiDoh6rli5XnmoTjgatCZWRyb2NrIEFnZW50IFRvb2zlrprnvqnjgpLnlJ/miJDjgZnjgovjgYtcbiAgICAgKi9cbiAgICByZWFkb25seSBhdXRvR2VuZXJhdGVUb29sRGVmaW5pdGlvbnM/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog44Kr44K544K/44Og44OE44O844Or5ZCN44OX44Os44OV44Kj44OD44Kv44K5XG4gICAgICovXG4gICAgcmVhZG9ubHkgdG9vbE5hbWVQcmVmaXg/OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiDjgr/jgqTjg6DjgqLjgqbjg4joqK3lrprvvIjnp5LvvIlcbiAgICAgKi9cbiAgICByZWFkb25seSB0aW1lb3V0PzogbnVtYmVyO1xuICB9O1xufVxuXG4vKipcbiAqIE1DUOOCteODvOODkOODvOe1seWQiOioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIE1jcFNlcnZlckludGVncmF0aW9uQ29uZmlnIHtcbiAgLyoqXG4gICAqIE1DUOOCteODvOODkOODvOOBruOCqOODs+ODieODneOCpOODs+ODiFVSTFxuICAgKi9cbiAgcmVhZG9ubHkgc2VydmVyRW5kcG9pbnQ/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIE1DUOOCteODvOODkOODvOOBruiqjeiovOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgYXV0aGVudGljYXRpb24/OiB7XG4gICAgLyoqXG4gICAgICog6KqN6Ki844K/44Kk44OX77yIQVBJX0tFWSwgT0FVVEgyLCBOT05F77yJXG4gICAgICovXG4gICAgcmVhZG9ubHkgdHlwZTogJ0FQSV9LRVknIHwgJ09BVVRIMicgfCAnTk9ORSc7XG5cbiAgICAvKipcbiAgICAgKiBBUEnjgq3jg7zvvIhTZWNyZXRzIE1hbmFnZXIgQVJO77yJXG4gICAgICovXG4gICAgcmVhZG9ubHkgYXBpS2V5U2VjcmV0QXJuPzogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogT0F1dGgy6Kit5a6aXG4gICAgICovXG4gICAgcmVhZG9ubHkgb2F1dGgyQ29uZmlnPzoge1xuICAgICAgLyoqXG4gICAgICAgKiDjgq/jg6njgqTjgqLjg7Pjg4hJRFxuICAgICAgICovXG4gICAgICByZWFkb25seSBjbGllbnRJZD86IHN0cmluZztcblxuICAgICAgLyoqXG4gICAgICAgKiDjgq/jg6njgqTjgqLjg7Pjg4jjgrfjg7zjgq/jg6zjg4Pjg4jvvIhTZWNyZXRzIE1hbmFnZXIgQVJO77yJXG4gICAgICAgKi9cbiAgICAgIHJlYWRvbmx5IGNsaWVudFNlY3JldEFybj86IHN0cmluZztcblxuICAgICAgLyoqXG4gICAgICAgKiDjg4jjg7zjgq/jg7Pjgqjjg7Pjg4njg53jgqTjg7Pjg4hcbiAgICAgICAqL1xuICAgICAgcmVhZG9ubHkgdG9rZW5FbmRwb2ludD86IHN0cmluZztcbiAgICB9O1xuICB9O1xuXG4gIC8qKlxuICAgKiBXZWJTb2NrZXTntbHlkIjoqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IHdlYlNvY2tldENvbmZpZz86IHtcbiAgICAvKipcbiAgICAgKiBXZWJTb2NrZXTmjqXntprjgr/jgqTjg6DjgqLjgqbjg4jvvIjnp5LvvIlcbiAgICAgKi9cbiAgICByZWFkb25seSBjb25uZWN0aW9uVGltZW91dD86IG51bWJlcjtcblxuICAgIC8qKlxuICAgICAqIOWGjeaOpee2muioreWumlxuICAgICAqL1xuICAgIHJlYWRvbmx5IHJlY29ubmVjdENvbmZpZz86IHtcbiAgICAgIC8qKlxuICAgICAgICog5pyA5aSn5YaN5o6l57aa6Kmm6KGM5Zue5pWwXG4gICAgICAgKi9cbiAgICAgIHJlYWRvbmx5IG1heFJldHJpZXM/OiBudW1iZXI7XG5cbiAgICAgIC8qKlxuICAgICAgICog5YaN5o6l57aa6ZaT6ZqU77yI44Of44Oq56eS77yJXG4gICAgICAgKi9cbiAgICAgIHJlYWRvbmx5IHJldHJ5SW50ZXJ2YWw/OiBudW1iZXI7XG4gICAgfTtcbiAgfTtcblxuICAvKipcbiAgICog5aSJ5o+b44Kq44OX44K344On44OzXG4gICAqL1xuICByZWFkb25seSBjb252ZXJzaW9uT3B0aW9ucz86IHtcbiAgICAvKipcbiAgICAgKiDoh6rli5XnmoTjgatCZWRyb2NrIEFnZW50IFRvb2zlrprnvqnjgpLnlJ/miJDjgZnjgovjgYtcbiAgICAgKi9cbiAgICByZWFkb25seSBhdXRvR2VuZXJhdGVUb29sRGVmaW5pdGlvbnM/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog44Kr44K544K/44Og44OE44O844Or5ZCN44OX44Os44OV44Kj44OD44Kv44K5XG4gICAgICovXG4gICAgcmVhZG9ubHkgdG9vbE5hbWVQcmVmaXg/OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiDlj5blvpfjgZnjgovjg4Tjg7zjg6vlrprnvqnjga7jg5XjgqPjg6vjgr/jg7zvvIjmraPopo/ooajnj77vvIlcbiAgICAgKi9cbiAgICByZWFkb25seSB0b29sTmFtZUZpbHRlcj86IHN0cmluZztcbiAgfTtcbn1cblxuLyoqXG4gKiBCZWRyb2NrIEFnZW50Q29yZSBHYXRld2F5IENvbnN0cnVjdCDjg5fjg63jg5Hjg4bjgqNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCZWRyb2NrQWdlbnRDb3JlR2F0ZXdheUNvbnN0cnVjdFByb3BzIHtcbiAgLyoqXG4gICAqIEdhdGV3YXnmqZ/og73jgpLmnInlirnljJbjgZnjgovjgYtcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgcmVhZG9ubHkgZW5hYmxlZD86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOODl+ODreOCuOOCp+OCr+ODiOWQjVxuICAgKi9cbiAgcmVhZG9ubHkgcHJvamVjdE5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICog55Kw5aKD5ZCN77yIZGV2LCBzdGFnaW5nLCBwcm9k562J77yJXG4gICAqL1xuICByZWFkb25seSBlbnZpcm9ubWVudDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBHYXRld2F5IFNwZWNzIFMz44OQ44Kx44OD44OI77yIRGF0YVN0YWNr44GL44KJ5Y+C54Wn77yJXG4gICAqIElhQ+WMljogQ2xvdWRGb3JtYXRpb24gSW1wb3J044GL44KJ5YuV55qE44Gr5Y+W5b6XXG4gICAqL1xuICByZWFkb25seSBnYXRld2F5U3BlY3NCdWNrZXQ/OiBzMy5JQnVja2V0O1xuICBcbiAgLyoqXG4gICAqIEZTeCBmb3IgT05UQVAgRmlsZSBTeXN0ZW0gSUTvvIhEYXRhU3RhY2vjgYvjgonlj4LnhafvvIlcbiAgICogSWFD5YyWOiBDbG91ZEZvcm1hdGlvbiBJbXBvcnTjgYvjgonli5XnmoTjgavlj5blvpdcbiAgICovXG4gIHJlYWRvbmx5IGZzeEZpbGVTeXN0ZW1JZD86IHN0cmluZztcblxuICAvKipcbiAgICogUkVTVCBBUEnlpInmj5voqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IHJlc3RBcGlDb252ZXJzaW9uPzogUmVzdEFwaUNvbnZlcnNpb25Db25maWc7XG5cbiAgLyoqXG4gICAqIExhbWJkYemWouaVsOWkieaPm+ioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgbGFtYmRhRnVuY3Rpb25Db252ZXJzaW9uPzogTGFtYmRhRnVuY3Rpb25Db252ZXJzaW9uQ29uZmlnO1xuXG4gIC8qKlxuICAgKiBNQ1DjgrXjg7zjg5Djg7zntbHlkIjoqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IG1jcFNlcnZlckludGVncmF0aW9uPzogTWNwU2VydmVySW50ZWdyYXRpb25Db25maWc7XG5cbiAgLyoqXG4gICAqIEtNU+aal+WPt+WMluOCreODvO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgKiDmjIflrprjgZfjgarjgYTloLTlkIjjga/oh6rli5XnlJ/miJDjgZXjgozjgotcbiAgICovXG4gIHJlYWRvbmx5IGVuY3J5cHRpb25LZXk/OiBrbXMuSUtleTtcblxuICAvKipcbiAgICog44Ot44Kw5L+d5oyB5pyf6ZaT77yI5pel5pWw77yJXG4gICAqIEBkZWZhdWx0IDdcbiAgICovXG4gIHJlYWRvbmx5IGxvZ1JldGVudGlvbkRheXM/OiBsb2dzLlJldGVudGlvbkRheXM7XG5cbiAgLyoqXG4gICAqIOOCv+OCsFxuICAgKi9cbiAgcmVhZG9ubHkgdGFncz86IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH07XG59XG5cbi8qKlxuICogQmVkcm9jayBBZ2VudENvcmUgR2F0ZXdheSBDb25zdHJ1Y3RcbiAqIFxuICog5pei5a2Y44GuQVBJL0xhbWJkYemWouaVsC9NQ1DjgrXjg7zjg5Djg7zjgpJCZWRyb2NrIEFnZW505LqS5o+b44OE44O844Or44Gr6Ieq5YuV5aSJ5o+b44GX44G+44GZ44CCXG4gKi9cbmV4cG9ydCBjbGFzcyBCZWRyb2NrQWdlbnRDb3JlR2F0ZXdheUNvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIC8qKlxuICAgKiBHYXRld2F55qmf6IO944GM5pyJ5Yq544GL44Gp44GG44GLXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbjtcblxuICAvKipcbiAgICogUkVTVCBBUEnlpInmj5tMYW1iZGHplqLmlbBcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSByZXN0QXBpQ29udmVydGVyRnVuY3Rpb24/OiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgLyoqXG4gICAqIExhbWJkYemWouaVsOWkieaPm0xhbWJkYemWouaVsFxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGxhbWJkYUNvbnZlcnRlckZ1bmN0aW9uPzogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIC8qKlxuICAgKiBNQ1DjgrXjg7zjg5Djg7zntbHlkIhMYW1iZGHplqLmlbBcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBtY3BJbnRlZ3JhdGlvbkZ1bmN0aW9uPzogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIC8qKlxuICAgKiBLTVPmmpflj7fljJbjgq3jg7xcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBlbmNyeXB0aW9uS2V5OiBrbXMuSUtleTtcblxuICAvKipcbiAgICogSUFN5a6f6KGM44Ot44O844OrXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZXhlY3V0aW9uUm9sZTogaWFtLlJvbGU7XG5cbiAgLyoqXG4gICAqIENsb3VkV2F0Y2ggTG9ncyDjg63jgrDjgrDjg6vjg7zjg5dcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBsb2dHcm91cDogbG9ncy5Mb2dHcm91cDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQmVkcm9ja0FnZW50Q29yZUdhdGV3YXlDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyDmnInlirnljJbjg5Xjg6njgrDjga7jg4Hjgqfjg4Pjgq9cbiAgICB0aGlzLmVuYWJsZWQgPSBwcm9wcy5lbmFibGVkID8/IHRydWU7XG5cbiAgICBpZiAoIXRoaXMuZW5hYmxlZCkge1xuICAgICAgLy8g54Sh5Yq55YyW44GV44KM44Gm44GE44KL5aC05ZCI44Gv5L2V44KC44GX44Gq44GEXG4gICAgICBjb25zb2xlLmxvZygn4oS577iPICBHYXRld2F5IENvbnN0cnVjdOOBr+eEoeWKueWMluOBleOCjOOBpuOBhOOBvuOBmScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEtNU+aal+WPt+WMluOCreODvOOBruS9nOaIkOOBvuOBn+OBr+WPluW+l1xuICAgIHRoaXMuZW5jcnlwdGlvbktleSA9IHByb3BzLmVuY3J5cHRpb25LZXkgPz8gdGhpcy5jcmVhdGVFbmNyeXB0aW9uS2V5KHByb3BzKTtcblxuICAgIC8vIElBTeWun+ihjOODreODvOODq+OBruS9nOaIkFxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZSA9IHRoaXMuY3JlYXRlRXhlY3V0aW9uUm9sZShwcm9wcyk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIExvZ3Pjg63jgrDjgrDjg6vjg7zjg5fjga7kvZzmiJBcbiAgICB0aGlzLmxvZ0dyb3VwID0gdGhpcy5jcmVhdGVMb2dHcm91cChwcm9wcyk7XG5cbiAgICAvLyBSRVNUIEFQSeWkieaPm+apn+iDveOBruWun+ijhe+8iOadoeS7tuS7mOOBje+8iVxuICAgIGlmIChwcm9wcy5yZXN0QXBpQ29udmVyc2lvbiAmJiBwcm9wcy5nYXRld2F5U3BlY3NCdWNrZXQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5SEIFJFU1QgQVBJIENvbnZlcnRlcuS9nOaIkOS4rS4uLicpO1xuICAgICAgdGhpcy5yZXN0QXBpQ29udmVydGVyRnVuY3Rpb24gPSB0aGlzLmNyZWF0ZVJlc3RBcGlDb252ZXJ0ZXJGdW5jdGlvbihwcm9wcyk7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIFJFU1QgQVBJIENvbnZlcnRlcuS9nOaIkOWujOS6hicpO1xuICAgIH0gZWxzZSBpZiAocHJvcHMucmVzdEFwaUNvbnZlcnNpb24pIHtcbiAgICAgIGNvbnNvbGUud2Fybign4pqg77iPICBSRVNUIEFQSeWkieaPm+OBjOacieWKueOBp+OBmeOBjOOAgWdhdGV3YXlTcGVjc0J1Y2tldOOBjOaPkOS+m+OBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIC8vIExhbWJkYemWouaVsOWkieaPm+apn+iDveOBruWun+ijhe+8iOadoeS7tuS7mOOBje+8iVxuICAgIGlmIChwcm9wcy5sYW1iZGFGdW5jdGlvbkNvbnZlcnNpb24gJiYgXG4gICAgICAgIHByb3BzLmxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbi5mdW5jdGlvbkFybnMgJiYgXG4gICAgICAgIHByb3BzLmxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbi5mdW5jdGlvbkFybnMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc29sZS5sb2coJ/CflIQgTGFtYmRhIEZ1bmN0aW9uIENvbnZlcnRlcuS9nOaIkOS4rS4uLicpO1xuICAgICAgdGhpcy5sYW1iZGFDb252ZXJ0ZXJGdW5jdGlvbiA9IHRoaXMuY3JlYXRlTGFtYmRhQ29udmVydGVyRnVuY3Rpb24ocHJvcHMpO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBMYW1iZGEgRnVuY3Rpb24gQ29udmVydGVy5L2c5oiQ5a6M5LqGJyk7XG4gICAgfSBlbHNlIGlmIChwcm9wcy5sYW1iZGFGdW5jdGlvbkNvbnZlcnNpb24pIHtcbiAgICAgIGNvbnNvbGUubG9nKCfihLnvuI8gIExhbWJkYSBGdW5jdGlvbiBDb252ZXJ0ZXLjga/nhKHlirnljJbjgZXjgozjgabjgYTjgb7jgZnvvIhmdW5jdGlvbkFybnPjgYznqbrvvIknKTtcbiAgICB9XG5cbiAgICAvLyBNQ1DjgrXjg7zjg5Djg7zntbHlkIjmqZ/og73jga7lrp/oo4XvvIjmnaHku7bku5jjgY3vvIlcbiAgICBpZiAocHJvcHMubWNwU2VydmVySW50ZWdyYXRpb24gJiYgcHJvcHMubWNwU2VydmVySW50ZWdyYXRpb24uc2VydmVyRW5kcG9pbnQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCfwn5SEIE1DUCBTZXJ2ZXIgSW50ZWdyYXRpb27kvZzmiJDkuK0uLi4nKTtcbiAgICAgIHRoaXMubWNwSW50ZWdyYXRpb25GdW5jdGlvbiA9IHRoaXMuY3JlYXRlTWNwSW50ZWdyYXRpb25GdW5jdGlvbihwcm9wcyk7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIE1DUCBTZXJ2ZXIgSW50ZWdyYXRpb27kvZzmiJDlrozkuoYnKTtcbiAgICB9IGVsc2UgaWYgKHByb3BzLm1jcFNlcnZlckludGVncmF0aW9uKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ+KaoO+4jyAgTUNQIFNlcnZlcue1seWQiOOBjOacieWKueOBp+OBmeOBjOOAgXNlcnZlckVuZHBvaW5044GM5o+Q5L6b44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgfVxuXG4gICAgLy8g44K/44Kw44Gu6YGp55SoXG4gICAgaWYgKHByb3BzLnRhZ3MpIHtcbiAgICAgIE9iamVjdC5lbnRyaWVzKHByb3BzLnRhZ3MpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoa2V5LCB2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjg4fjg5Xjgqnjg6vjg4jjgr/jgrDjga7ov73liqBcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0NvbXBvbmVudCcsICdCZWRyb2NrQWdlbnRDb3JlR2F0ZXdheScpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsIHByb3BzLnByb2plY3ROYW1lKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52aXJvbm1lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEtNU+aal+WPt+WMluOCreODvOOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVFbmNyeXB0aW9uS2V5KHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlR2F0ZXdheUNvbnN0cnVjdFByb3BzKToga21zLktleSB7XG4gICAgcmV0dXJuIG5ldyBrbXMuS2V5KHRoaXMsICdFbmNyeXB0aW9uS2V5Jywge1xuICAgICAgZGVzY3JpcHRpb246IGBFbmNyeXB0aW9uIGtleSBmb3IgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0gQmVkcm9jayBBZ2VudENvcmUgR2F0ZXdheWAsXG4gICAgICBlbmFibGVLZXlSb3RhdGlvbjogdHJ1ZSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJQU3lrp/ooYzjg63jg7zjg6vjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRXhlY3V0aW9uUm9sZShwcm9wczogQmVkcm9ja0FnZW50Q29yZUdhdGV3YXlDb25zdHJ1Y3RQcm9wcyk6IGlhbS5Sb2xlIHtcbiAgICBjb25zdCByb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdFeGVjdXRpb25Sb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogYEV4ZWN1dGlvbiByb2xlIGZvciAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fSBCZWRyb2NrIEFnZW50Q29yZSBHYXRld2F5YCxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBLTVPmqKnpmZDjga7ov73liqBcbiAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2ttczpEZWNyeXB0JyxcbiAgICAgICAgJ2ttczpFbmNyeXB0JyxcbiAgICAgICAgJ2ttczpHZW5lcmF0ZURhdGFLZXknLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW3RoaXMuZW5jcnlwdGlvbktleS5rZXlBcm5dLFxuICAgIH0pKTtcblxuICAgIC8vIEJlZHJvY2vmqKnpmZDjga7ov73liqBcbiAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlQWdlbnQnLFxuICAgICAgICAnYmVkcm9jazpHZXRBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrOkxpc3RBZ2VudHMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgLy8gQVBJIEdhdGV3YXnmqKnpmZDjga7ov73liqDvvIhSRVNUIEFQSeWkieaPm+OBjOacieWKueOBquWgtOWQiO+8iVxuICAgIGlmIChwcm9wcy5yZXN0QXBpQ29udmVyc2lvbikge1xuICAgICAgcm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdhcGlnYXRld2F5OkdFVCcsXG4gICAgICAgICAgJ2FwaWdhdGV3YXk6UE9TVCcsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgLy8gTGFtYmRh5qip6ZmQ44Gu6L+95Yqg77yITGFtYmRh6Zai5pWw5aSJ5o+b44GM5pyJ5Yq544Gq5aC05ZCI77yJXG4gICAgaWYgKHByb3BzLmxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbikge1xuICAgICAgcm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdsYW1iZGE6R2V0RnVuY3Rpb24nLFxuICAgICAgICAgICdsYW1iZGE6R2V0RnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgICAnbGFtYmRhOkludm9rZUZ1bmN0aW9uJyxcbiAgICAgICAgICAnbGFtYmRhOkxpc3RUYWdzJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBwcm9wcy5sYW1iZGFGdW5jdGlvbkNvbnZlcnNpb24uZnVuY3Rpb25Bcm5zLFxuICAgICAgfSkpO1xuICAgIH1cblxuICAgIC8vIFNlY3JldHMgTWFuYWdlcuaoqemZkOOBrui/veWKoO+8iE1DUOOCteODvOODkOODvOe1seWQiOOBjOacieWKueOBquWgtOWQiO+8iVxuICAgIGlmIChwcm9wcy5tY3BTZXJ2ZXJJbnRlZ3JhdGlvbj8uYXV0aGVudGljYXRpb24pIHtcbiAgICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnc2VjcmV0c21hbmFnZXI6R2V0U2VjcmV0VmFsdWUnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBwcm9wcy5tY3BTZXJ2ZXJJbnRlZ3JhdGlvbi5hdXRoZW50aWNhdGlvbi5hcGlLZXlTZWNyZXRBcm4gfHwgJyonLFxuICAgICAgICAgIHByb3BzLm1jcFNlcnZlckludGVncmF0aW9uLmF1dGhlbnRpY2F0aW9uLm9hdXRoMkNvbmZpZz8uY2xpZW50U2VjcmV0QXJuIHx8ICcqJyxcbiAgICAgICAgXS5maWx0ZXIoYXJuID0+IGFybiAhPT0gJyonKSxcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcm9sZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG91ZFdhdGNoIExvZ3Pjg63jgrDjgrDjg6vjg7zjg5fjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTG9nR3JvdXAocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0UHJvcHMpOiBsb2dzLkxvZ0dyb3VwIHtcbiAgICByZXR1cm4gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0xvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9iZWRyb2NrLWFnZW50LWNvcmUvZ2F0ZXdheS8ke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICByZXRlbnRpb246IHByb3BzLmxvZ1JldGVudGlvbkRheXMgPz8gbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGVuY3J5cHRpb25LZXk6IHRoaXMuZW5jcnlwdGlvbktleSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSRVNUIEFQSeWkieaPm0xhbWJkYemWouaVsOOCkuS9nOaIkO+8iElhQ+eJiO+8iVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVSZXN0QXBpQ29udmVydGVyRnVuY3Rpb24ocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0UHJvcHMpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghcHJvcHMucmVzdEFwaUNvbnZlcnNpb24gfHwgIXByb3BzLmdhdGV3YXlTcGVjc0J1Y2tldCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdSRVNUIEFQSeWkieaPm+ioreWumuOBvuOBn+OBr2dhdGV3YXlTcGVjc0J1Y2tldOOBjOaMh+WumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbmZpZyA9IHByb3BzLnJlc3RBcGlDb252ZXJzaW9uO1xuXG4gICAgLy8g55Kw5aKD5aSJ5pWw44Gu5rqW5YKZ77yI5a6M5YWo5YuV55qE77yJXG4gICAgY29uc3QgZW52aXJvbm1lbnQ6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG4gICAgICBQUk9KRUNUX05BTUU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgR0FURVdBWV9TUEVDU19CVUNLRVQ6IHByb3BzLmdhdGV3YXlTcGVjc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgT1BFTkFQSV9TUEVDX0tFWTogY29uZmlnLm9wZW5BcGlTcGVjS2V5IHx8ICdvcGVuYXBpL3NhbXBsZS1vcGVuYXBpLnlhbWwnLFxuICAgIH07XG5cbiAgICAvLyBGU3ggRmlsZSBTeXN0ZW0gSUTvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBpZiAocHJvcHMuZnN4RmlsZVN5c3RlbUlkKSB7XG4gICAgICBlbnZpcm9ubWVudC5GU1hfRklMRV9TWVNURU1fSUQgPSBwcm9wcy5mc3hGaWxlU3lzdGVtSWQ7XG4gICAgfVxuXG4gICAgLy8gQVBJIEdhdGV3YXnntbHlkIjoqK3lrprvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBpZiAoY29uZmlnLmFwaUdhdGV3YXlJbnRlZ3JhdGlvbikge1xuICAgICAgaWYgKGNvbmZpZy5hcGlHYXRld2F5SW50ZWdyYXRpb24uYXBpSWQpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuQVBJX0dBVEVXQVlfSUQgPSBjb25maWcuYXBpR2F0ZXdheUludGVncmF0aW9uLmFwaUlkO1xuICAgICAgfVxuICAgICAgaWYgKGNvbmZpZy5hcGlHYXRld2F5SW50ZWdyYXRpb24uc3RhZ2VOYW1lKSB7XG4gICAgICAgIGVudmlyb25tZW50LkFQSV9HQVRFV0FZX1NUQUdFID0gY29uZmlnLmFwaUdhdGV3YXlJbnRlZ3JhdGlvbi5zdGFnZU5hbWU7XG4gICAgICB9XG4gICAgICBpZiAoY29uZmlnLmFwaUdhdGV3YXlJbnRlZ3JhdGlvbi5hdXRoVHlwZSkge1xuICAgICAgICBlbnZpcm9ubWVudC5BVVRIX1RZUEUgPSBjb25maWcuYXBpR2F0ZXdheUludGVncmF0aW9uLmF1dGhUeXBlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOWkieaPm+OCquODl+OCt+ODp+ODs1xuICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMpIHtcbiAgICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMuYXV0b0dlbmVyYXRlVG9vbERlZmluaXRpb25zICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuQVVUT19HRU5FUkFURV9UT09MUyA9IFN0cmluZyhjb25maWcuY29udmVyc2lvbk9wdGlvbnMuYXV0b0dlbmVyYXRlVG9vbERlZmluaXRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMudG9vbE5hbWVQcmVmaXgpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuVE9PTF9OQU1FX1BSRUZJWCA9IGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy50b29sTmFtZVByZWZpeDtcbiAgICAgIH1cbiAgICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMuZXhjbHVkZVBhdHRlcm5zKSB7XG4gICAgICAgIGVudmlyb25tZW50LkVYQ0xVREVfUEFUVEVSTlMgPSBKU09OLnN0cmluZ2lmeShjb25maWcuY29udmVyc2lvbk9wdGlvbnMuZXhjbHVkZVBhdHRlcm5zKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBMYW1iZGHplqLmlbDjga7kvZzmiJBcbiAgICBjb25zdCBmbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1Jlc3RBcGlDb252ZXJ0ZXJGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvYWdlbnQtY29yZS1nYXRld2F5L3Jlc3QtYXBpLWNvbnZlcnRlcicpLFxuICAgICAgcm9sZTogdGhpcy5leGVjdXRpb25Sb2xlLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsb2dHcm91cDogdGhpcy5sb2dHcm91cCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgUkVTVCBBUEkgQ29udmVydGVyIGZvciAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fSBCZWRyb2NrIEFnZW50Q29yZSBHYXRld2F5YCxcbiAgICB9KTtcblxuICAgIC8vIFMz6Kqt44G/5Y+W44KK5qip6ZmQ44Gu6L+95Yqg77yIR2F0ZXdheSBTcGVjcyBCdWNrZXTvvIlcbiAgICBwcm9wcy5nYXRld2F5U3BlY3NCdWNrZXQuZ3JhbnRSZWFkKGZuKTtcblxuICAgIHJldHVybiBmbjtcbiAgfVxuXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDlpInmj5tMYW1iZGHplqLmlbDjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlTGFtYmRhQ29udmVydGVyRnVuY3Rpb24ocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0UHJvcHMpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghcHJvcHMubGFtYmRhRnVuY3Rpb25Db252ZXJzaW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0xhbWJkYemWouaVsOWkieaPm+ioreWumuOBjOaMh+WumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbmZpZyA9IHByb3BzLmxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbjtcblxuICAgIC8vIOeSsOWig+WkieaVsOOBrua6luWCmVxuICAgIGNvbnN0IGVudmlyb25tZW50OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9ID0ge1xuICAgICAgUFJPSkVDVF9OQU1FOiBwcm9wcy5wcm9qZWN0TmFtZSxcbiAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICB9O1xuXG4gICAgLy8g44Oh44K/44OH44O844K/44K944O844K56Kit5a6aXG4gICAgaWYgKGNvbmZpZy5tZXRhZGF0YVNvdXJjZSkge1xuICAgICAgaWYgKGNvbmZpZy5tZXRhZGF0YVNvdXJjZS51c2VUYWdzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuVVNFX1RBR1MgPSBTdHJpbmcoY29uZmlnLm1ldGFkYXRhU291cmNlLnVzZVRhZ3MpO1xuICAgICAgfVxuICAgICAgaWYgKGNvbmZpZy5tZXRhZGF0YVNvdXJjZS51c2VFbnZpcm9ubWVudFZhcmlhYmxlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGVudmlyb25tZW50LlVTRV9FTlZfVkFSUyA9IFN0cmluZyhjb25maWcubWV0YWRhdGFTb3VyY2UudXNlRW52aXJvbm1lbnRWYXJpYWJsZXMpO1xuICAgICAgfVxuICAgICAgaWYgKGNvbmZpZy5tZXRhZGF0YVNvdXJjZS5jdXN0b21NZXRhZGF0YVByb3ZpZGVyKSB7XG4gICAgICAgIGVudmlyb25tZW50LkNVU1RPTV9NRVRBREFUQV9QUk9WSURFUiA9IGNvbmZpZy5tZXRhZGF0YVNvdXJjZS5jdXN0b21NZXRhZGF0YVByb3ZpZGVyO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOWkieaPm+OCquODl+OCt+ODp+ODs1xuICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMpIHtcbiAgICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMuYXV0b0dlbmVyYXRlVG9vbERlZmluaXRpb25zICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuQVVUT19HRU5FUkFURV9UT09MUyA9IFN0cmluZyhjb25maWcuY29udmVyc2lvbk9wdGlvbnMuYXV0b0dlbmVyYXRlVG9vbERlZmluaXRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMudG9vbE5hbWVQcmVmaXgpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuVE9PTF9OQU1FX1BSRUZJWCA9IGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy50b29sTmFtZVByZWZpeDtcbiAgICAgIH1cbiAgICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMudGltZW91dCkge1xuICAgICAgICBlbnZpcm9ubWVudC5DT05WRVJTSU9OX1RJTUVPVVQgPSBTdHJpbmcoY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLnRpbWVvdXQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIExhbWJkYemWouaVsOOBruS9nOaIkFxuICAgIGNvbnN0IGZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTGFtYmRhQ29udmVydGVyRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2FnZW50LWNvcmUtZ2F0ZXdheS9sYW1iZGEtZnVuY3Rpb24tY29udmVydGVyJyksXG4gICAgICByb2xlOiB0aGlzLmV4ZWN1dGlvblJvbGUsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucz8udGltZW91dCB8fCA2MCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsb2dHcm91cDogdGhpcy5sb2dHcm91cCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgTGFtYmRhIEZ1bmN0aW9uIENvbnZlcnRlciBmb3IgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0gQmVkcm9jayBBZ2VudENvcmUgR2F0ZXdheWAsXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGHplqLmlbDjg6Hjgr/jg4fjg7zjgr/lj5blvpfmqKnpmZDjga7ov73liqDvvIhmdW5jdGlvbkFybnPjgYzmj5DkvpvjgZXjgozjgabjgYTjgovloLTlkIjjga7jgb/vvIlcbiAgICBpZiAoY29uZmlnLmZ1bmN0aW9uQXJucyAmJiBjb25maWcuZnVuY3Rpb25Bcm5zLmxlbmd0aCA+IDApIHtcbiAgICAgIGZuLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdsYW1iZGE6R2V0RnVuY3Rpb24nLFxuICAgICAgICAgICdsYW1iZGE6R2V0RnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgICAnbGFtYmRhOkxpc3RUYWdzJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBjb25maWcuZnVuY3Rpb25Bcm5zLFxuICAgICAgfSkpO1xuICAgIH1cblxuICAgIC8vIExhbWJkYemWouaVsOWRvOOBs+WHuuOBl+aoqemZkOOBrui/veWKoO+8iOOCq+OCueOCv+ODoOODoeOCv+ODh+ODvOOCv+ODl+ODreODkOOCpOODgOODvOOBjOOBguOCi+WgtOWQiO+8iVxuICAgIGlmIChjb25maWcubWV0YWRhdGFTb3VyY2U/LmN1c3RvbU1ldGFkYXRhUHJvdmlkZXIpIHtcbiAgICAgIGZuLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdsYW1iZGE6SW52b2tlRnVuY3Rpb24nLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtjb25maWcubWV0YWRhdGFTb3VyY2UuY3VzdG9tTWV0YWRhdGFQcm92aWRlcl0sXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgLyoqXG4gICAqIE1DUOOCteODvOODkOODvOe1seWQiExhbWJkYemWouaVsOOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVNY3BJbnRlZ3JhdGlvbkZ1bmN0aW9uKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlR2F0ZXdheUNvbnN0cnVjdFByb3BzKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBpZiAoIXByb3BzLm1jcFNlcnZlckludGVncmF0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01DUOOCteODvOODkOODvOe1seWQiOioreWumuOBjOaMh+WumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbmZpZyA9IHByb3BzLm1jcFNlcnZlckludGVncmF0aW9uO1xuXG4gICAgLy8g55Kw5aKD5aSJ5pWw44Gu5rqW5YKZXG4gICAgY29uc3QgZW52aXJvbm1lbnQ6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG4gICAgICBQUk9KRUNUX05BTUU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgIH07XG5cbiAgICAvLyBNQ1DjgrXjg7zjg5Djg7zjgqjjg7Pjg4njg53jgqTjg7Pjg4jvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICBpZiAoY29uZmlnLnNlcnZlckVuZHBvaW50KSB7XG4gICAgICBlbnZpcm9ubWVudC5NQ1BfU0VSVkVSX0VORFBPSU5UID0gY29uZmlnLnNlcnZlckVuZHBvaW50O1xuICAgIH1cblxuICAgIC8vIFdlYlNvY2tldOe1seWQiOioreWumlxuICAgIGlmIChjb25maWcud2ViU29ja2V0Q29uZmlnKSB7XG4gICAgICBpZiAoY29uZmlnLndlYlNvY2tldENvbmZpZy5jb25uZWN0aW9uVGltZW91dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGVudmlyb25tZW50LldTX0NPTk5FQ1RJT05fVElNRU9VVCA9IFN0cmluZyhjb25maWcud2ViU29ja2V0Q29uZmlnLmNvbm5lY3Rpb25UaW1lb3V0KTtcbiAgICAgIH1cbiAgICAgIGlmIChjb25maWcud2ViU29ja2V0Q29uZmlnLnJlY29ubmVjdENvbmZpZykge1xuICAgICAgICBpZiAoY29uZmlnLndlYlNvY2tldENvbmZpZy5yZWNvbm5lY3RDb25maWcubWF4UmV0cmllcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZW52aXJvbm1lbnQuTUFYX1JFVFJZX0FUVEVNUFRTID0gU3RyaW5nKGNvbmZpZy53ZWJTb2NrZXRDb25maWcucmVjb25uZWN0Q29uZmlnLm1heFJldHJpZXMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb25maWcud2ViU29ja2V0Q29uZmlnLnJlY29ubmVjdENvbmZpZy5yZXRyeUludGVydmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBlbnZpcm9ubWVudC5SRVRSWV9JTlRFUlZBTCA9IFN0cmluZyhjb25maWcud2ViU29ja2V0Q29uZmlnLnJlY29ubmVjdENvbmZpZy5yZXRyeUludGVydmFsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOWkieaPm+OCquODl+OCt+ODp+ODs1xuICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMpIHtcbiAgICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMuYXV0b0dlbmVyYXRlVG9vbERlZmluaXRpb25zICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuQVVUT19HRU5FUkFURV9UT09MUyA9IFN0cmluZyhjb25maWcuY29udmVyc2lvbk9wdGlvbnMuYXV0b0dlbmVyYXRlVG9vbERlZmluaXRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMudG9vbE5hbWVQcmVmaXgpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuVE9PTF9OQU1FX1BSRUZJWCA9IGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy50b29sTmFtZVByZWZpeDtcbiAgICAgIH1cbiAgICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMudG9vbE5hbWVGaWx0ZXIpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuVE9PTF9OQU1FX0ZJTFRFUiA9IGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy50b29sTmFtZUZpbHRlcjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBMYW1iZGHplqLmlbDjga7kvZzmiJBcbiAgICBjb25zdCBmbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ01jcEludGVncmF0aW9uRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhL2FnZW50LWNvcmUtZ2F0ZXdheS9tY3Atc2VydmVyLWludGVncmF0aW9uJyksXG4gICAgICByb2xlOiB0aGlzLmV4ZWN1dGlvblJvbGUsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGxvZ0dyb3VwOiB0aGlzLmxvZ0dyb3VwLFxuICAgICAgZGVzY3JpcHRpb246IGBNQ1AgU2VydmVyIEludGVncmF0aW9uIGZvciAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fSBCZWRyb2NrIEFnZW50Q29yZSBHYXRld2F5YCxcbiAgICB9KTtcblxuICAgIC8vIFNlY3JldHMgTWFuYWdlcuiqreOBv+WPluOCiuaoqemZkOOBrui/veWKoO+8iOiqjeiovOOBjOacieWKueOBquWgtOWQiO+8iVxuICAgIGlmIChjb25maWcuYXV0aGVudGljYXRpb24pIHtcbiAgICAgIGNvbnN0IHNlY3JldEFybnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgIGlmIChjb25maWcuYXV0aGVudGljYXRpb24uYXBpS2V5U2VjcmV0QXJuKSB7XG4gICAgICAgIHNlY3JldEFybnMucHVzaChjb25maWcuYXV0aGVudGljYXRpb24uYXBpS2V5U2VjcmV0QXJuKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbmZpZy5hdXRoZW50aWNhdGlvbi5vYXV0aDJDb25maWc/LmNsaWVudFNlY3JldEFybikge1xuICAgICAgICBzZWNyZXRBcm5zLnB1c2goY29uZmlnLmF1dGhlbnRpY2F0aW9uLm9hdXRoMkNvbmZpZy5jbGllbnRTZWNyZXRBcm4pO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2VjcmV0QXJucy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZuLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICdzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZScsXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IHNlY3JldEFybnMsXG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZm47XG4gIH1cbn1cbiJdfQ==