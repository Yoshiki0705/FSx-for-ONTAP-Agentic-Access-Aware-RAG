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
            const secretArns = [];
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
    createLogGroup(props) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLWdhdGV3YXktY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmVkcm9jay1hZ2VudC1jb3JlLWdhdGV3YXktY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7O0dBWUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLDJDQUF1QztBQUN2QywrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLDJEQUE2QztBQUM3Qyx5REFBMkM7QUFvUTNDOzs7O0dBSUc7QUFDSCxNQUFhLGdDQUFpQyxTQUFRLHNCQUFTO0lBQzdEOztPQUVHO0lBQ2EsT0FBTyxDQUFVO0lBRWpDOztPQUVHO0lBQ2Esd0JBQXdCLENBQW1CO0lBRTNEOztPQUVHO0lBQ2EsdUJBQXVCLENBQW1CO0lBRTFEOztPQUVHO0lBQ2Esc0JBQXNCLENBQW1CO0lBRXpEOztPQUVHO0lBQ2EsYUFBYSxDQUFXO0lBRXhDOztPQUVHO0lBQ2EsYUFBYSxDQUFXO0lBRXhDOztPQUVHO0lBQ2EsUUFBUSxDQUFnQjtJQUV4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTRDO1FBQ3BGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsY0FBYztRQUNkLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUM7UUFFckMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsQixtQkFBbUI7WUFDbkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1lBQy9DLE9BQU87UUFDVCxDQUFDO1FBRUQsbUJBQW1CO1FBQ25CLElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFNUUsY0FBYztRQUNkLElBQUks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YTtZQUN4QixXQUFXO1lBQ1gsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxVQUFVLEVBQUUsR0FBRztZQUNmLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN2QixXQUFXLEVBQUUsOEJBQThCLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLFdBQVcsNEJBQTRCO1NBQzlHLENBQUMsQ0FBQztRQUVILHFDQUFxQztRQUNyQyxJQUFJLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUMxQixNQUFNLFVBQVUsR0FBYSxFQUFFLENBQUM7WUFFaEMsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUMxQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDekQsQ0FBQztZQUVELElBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsZUFBZSxFQUFFLENBQUM7Z0JBQ3hELFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDdEUsQ0FBQztZQUVELElBQUksVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDMUIsRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7b0JBQ3pDLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7b0JBQ3hCLE9BQU8sRUFBRTt3QkFDUCwrQkFBK0I7cUJBQ2hDO29CQUNELFNBQVMsRUFBRSxVQUFVO2lCQUN0QixDQUFDLENBQUMsQ0FBQztZQUNOLENBQUM7UUFDSCxDQUFDO1FBRUQsT0FBTyxFQUFFLENBQUM7SUFDWixDQUFDO0NBQ0Y7QUF4ZEQsNEVBd2RDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBbWF6b24gQmVkcm9jayBBZ2VudENvcmUgR2F0ZXdheSBDb25zdHJ1Y3RcbiAqIFxuICog44GT44GuQ29uc3RydWN044Gv44CB5pei5a2Y44GuQVBJL0xhbWJkYemWouaVsC9NQ1DjgrXjg7zjg5Djg7zjgpJCZWRyb2NrIEFnZW505LqS5o+b44OE44O844Or44Gr6Ieq5YuV5aSJ5o+b44GX44G+44GZ44CCXG4gKiBcbiAqIOS4u+imgeapn+iDvTpcbiAqIC0gUkVTVCBBUEkg4oaSIEJlZHJvY2sgQWdlbnQgVG9vbOWkieaPm1xuICogLSBMYW1iZGHplqLmlbAg4oaSIEJlZHJvY2sgQWdlbnQgVG9vbOWkieaPm1xuICogLSBNQ1DjgrXjg7zjg5Djg7zntbHlkIhcbiAqIFxuICogQGF1dGhvciBLaXJvIEFJXG4gKiBAZGF0ZSAyMDI2LTAxLTAzXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBrbXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWttcyc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuXG4vKipcbiAqIFJFU1QgQVBJ5aSJ5o+b6Kit5a6aXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVzdEFwaUNvbnZlcnNpb25Db25maWcge1xuICAvKipcbiAgICogT3BlbkFQSeS7leanmOODleOCoeOCpOODq+OBrlMz44Kt44O8XG4gICAqIOODkOOCseODg+ODiOWQjeOBr2dhdGV3YXlTcGVjc0J1Y2tldOOBi+OCieWPluW+l1xuICAgKi9cbiAgcmVhZG9ubHkgb3BlbkFwaVNwZWNLZXk/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEFQSSBHYXRld2F557Wx5ZCI6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBhcGlHYXRld2F5SW50ZWdyYXRpb24/OiB7XG4gICAgLyoqXG4gICAgICogQVBJIEdhdGV3YXkgUkVTVCBBUEnjga5JRFxuICAgICAqL1xuICAgIHJlYWRvbmx5IGFwaUlkPzogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogQVBJIEdhdGV3YXnjga7jgrnjg4bjg7zjgrjlkI1cbiAgICAgKi9cbiAgICByZWFkb25seSBzdGFnZU5hbWU/OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiDoqo3oqLzjgr/jgqTjg5fvvIhJQU0sIENPR05JVE8sIEFQSV9LRVksIE5PTkXvvIlcbiAgICAgKi9cbiAgICByZWFkb25seSBhdXRoVHlwZT86ICdJQU0nIHwgJ0NPR05JVE8nIHwgJ0FQSV9LRVknIHwgJ05PTkUnO1xuICB9O1xuXG4gIC8qKlxuICAgKiDlpInmj5vjgqrjg5fjgrfjg6fjg7NcbiAgICovXG4gIHJlYWRvbmx5IGNvbnZlcnNpb25PcHRpb25zPzoge1xuICAgIC8qKlxuICAgICAqIOiHquWLleeahOOBq0JlZHJvY2sgQWdlbnQgVG9vbOWumue+qeOCkueUn+aIkOOBmeOCi+OBi1xuICAgICAqL1xuICAgIHJlYWRvbmx5IGF1dG9HZW5lcmF0ZVRvb2xEZWZpbml0aW9ucz86IGJvb2xlYW47XG5cbiAgICAvKipcbiAgICAgKiDjgqvjgrnjgr/jg6Djg4Tjg7zjg6vlkI3jg5fjg6zjg5XjgqPjg4Pjgq/jgrlcbiAgICAgKi9cbiAgICByZWFkb25seSB0b29sTmFtZVByZWZpeD86IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIOmZpOWkluOBmeOCi+OCqOODs+ODieODneOCpOODs+ODiOOBruODkeOCv+ODvOODs++8iOato+imj+ihqOePvu+8iVxuICAgICAqL1xuICAgIHJlYWRvbmx5IGV4Y2x1ZGVQYXR0ZXJucz86IHN0cmluZ1tdO1xuICB9O1xufVxuXG4vKipcbiAqIExhbWJkYemWouaVsOWkieaPm+ioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIExhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbkNvbmZpZyB7XG4gIC8qKlxuICAgKiDlpInmj5vlr77osaHjga5MYW1iZGHplqLmlbBBUk7jg6rjgrnjg4hcbiAgICog56m644Gu5aC05ZCI44GvTGFtYmRhIENvbnZlcnRlcuapn+iDveOCkueEoeWKueWMllxuICAgKi9cbiAgcmVhZG9ubHkgZnVuY3Rpb25Bcm5zPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIExhbWJkYemWouaVsOOBruODoeOCv+ODh+ODvOOCv+WPluW+l+aWueazlVxuICAgKi9cbiAgcmVhZG9ubHkgbWV0YWRhdGFTb3VyY2U/OiB7XG4gICAgLyoqXG4gICAgICog6Zai5pWw44Gu44K/44Kw44GL44KJ44Oh44K/44OH44O844K/44KS5Y+W5b6X44GZ44KL44GLXG4gICAgICovXG4gICAgcmVhZG9ubHkgdXNlVGFncz86IGJvb2xlYW47XG5cbiAgICAvKipcbiAgICAgKiDplqLmlbDjga7nkrDlooPlpInmlbDjgYvjgonjg6Hjgr/jg4fjg7zjgr/jgpLlj5blvpfjgZnjgovjgYtcbiAgICAgKi9cbiAgICByZWFkb25seSB1c2VFbnZpcm9ubWVudFZhcmlhYmxlcz86IGJvb2xlYW47XG5cbiAgICAvKipcbiAgICAgKiDjgqvjgrnjgr/jg6Djg6Hjgr/jg4fjg7zjgr/jg5fjg63jg5DjgqTjg4Djg7zvvIhMYW1iZGHplqLmlbBBUk7vvIlcbiAgICAgKi9cbiAgICByZWFkb25seSBjdXN0b21NZXRhZGF0YVByb3ZpZGVyPzogc3RyaW5nO1xuICB9O1xuXG4gIC8qKlxuICAgKiDlpInmj5vjgqrjg5fjgrfjg6fjg7NcbiAgICovXG4gIHJlYWRvbmx5IGNvbnZlcnNpb25PcHRpb25zPzoge1xuICAgIC8qKlxuICAgICAqIOiHquWLleeahOOBq0JlZHJvY2sgQWdlbnQgVG9vbOWumue+qeOCkueUn+aIkOOBmeOCi+OBi1xuICAgICAqL1xuICAgIHJlYWRvbmx5IGF1dG9HZW5lcmF0ZVRvb2xEZWZpbml0aW9ucz86IGJvb2xlYW47XG5cbiAgICAvKipcbiAgICAgKiDjgqvjgrnjgr/jg6Djg4Tjg7zjg6vlkI3jg5fjg6zjg5XjgqPjg4Pjgq/jgrlcbiAgICAgKi9cbiAgICByZWFkb25seSB0b29sTmFtZVByZWZpeD86IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIOOCv+OCpOODoOOCouOCpuODiOioreWumu+8iOenku+8iVxuICAgICAqL1xuICAgIHJlYWRvbmx5IHRpbWVvdXQ/OiBudW1iZXI7XG4gIH07XG59XG5cbi8qKlxuICogTUNQ44K144O844OQ44O857Wx5ZCI6Kit5a6aXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTWNwU2VydmVySW50ZWdyYXRpb25Db25maWcge1xuICAvKipcbiAgICogTUNQ44K144O844OQ44O844Gu44Ko44Oz44OJ44Od44Kk44Oz44OIVVJMXG4gICAqL1xuICByZWFkb25seSBzZXJ2ZXJFbmRwb2ludD86IHN0cmluZztcblxuICAvKipcbiAgICogTUNQ44K144O844OQ44O844Gu6KqN6Ki86Kit5a6aXG4gICAqL1xuICByZWFkb25seSBhdXRoZW50aWNhdGlvbj86IHtcbiAgICAvKipcbiAgICAgKiDoqo3oqLzjgr/jgqTjg5fvvIhBUElfS0VZLCBPQVVUSDIsIE5PTkXvvIlcbiAgICAgKi9cbiAgICByZWFkb25seSB0eXBlOiAnQVBJX0tFWScgfCAnT0FVVEgyJyB8ICdOT05FJztcblxuICAgIC8qKlxuICAgICAqIEFQSeOCreODvO+8iFNlY3JldHMgTWFuYWdlciBBUk7vvIlcbiAgICAgKi9cbiAgICByZWFkb25seSBhcGlLZXlTZWNyZXRBcm4/OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBPQXV0aDLoqK3lrppcbiAgICAgKi9cbiAgICByZWFkb25seSBvYXV0aDJDb25maWc/OiB7XG4gICAgICAvKipcbiAgICAgICAqIOOCr+ODqeOCpOOCouODs+ODiElEXG4gICAgICAgKi9cbiAgICAgIHJlYWRvbmx5IGNsaWVudElkPzogc3RyaW5nO1xuXG4gICAgICAvKipcbiAgICAgICAqIOOCr+ODqeOCpOOCouODs+ODiOOCt+ODvOOCr+ODrOODg+ODiO+8iFNlY3JldHMgTWFuYWdlciBBUk7vvIlcbiAgICAgICAqL1xuICAgICAgcmVhZG9ubHkgY2xpZW50U2VjcmV0QXJuPzogc3RyaW5nO1xuXG4gICAgICAvKipcbiAgICAgICAqIOODiOODvOOCr+ODs+OCqOODs+ODieODneOCpOODs+ODiFxuICAgICAgICovXG4gICAgICByZWFkb25seSB0b2tlbkVuZHBvaW50Pzogc3RyaW5nO1xuICAgIH07XG4gIH07XG5cbiAgLyoqXG4gICAqIFdlYlNvY2tldOe1seWQiOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgd2ViU29ja2V0Q29uZmlnPzoge1xuICAgIC8qKlxuICAgICAqIFdlYlNvY2tldOaOpee2muOCv+OCpOODoOOCouOCpuODiO+8iOenku+8iVxuICAgICAqL1xuICAgIHJlYWRvbmx5IGNvbm5lY3Rpb25UaW1lb3V0PzogbnVtYmVyO1xuXG4gICAgLyoqXG4gICAgICog5YaN5o6l57aa6Kit5a6aXG4gICAgICovXG4gICAgcmVhZG9ubHkgcmVjb25uZWN0Q29uZmlnPzoge1xuICAgICAgLyoqXG4gICAgICAgKiDmnIDlpKflho3mjqXntproqabooYzlm57mlbBcbiAgICAgICAqL1xuICAgICAgcmVhZG9ubHkgbWF4UmV0cmllcz86IG51bWJlcjtcblxuICAgICAgLyoqXG4gICAgICAgKiDlho3mjqXntprplpPpmpTvvIjjg5/jg6rnp5LvvIlcbiAgICAgICAqL1xuICAgICAgcmVhZG9ubHkgcmV0cnlJbnRlcnZhbD86IG51bWJlcjtcbiAgICB9O1xuICB9O1xuXG4gIC8qKlxuICAgKiDlpInmj5vjgqrjg5fjgrfjg6fjg7NcbiAgICovXG4gIHJlYWRvbmx5IGNvbnZlcnNpb25PcHRpb25zPzoge1xuICAgIC8qKlxuICAgICAqIOiHquWLleeahOOBq0JlZHJvY2sgQWdlbnQgVG9vbOWumue+qeOCkueUn+aIkOOBmeOCi+OBi1xuICAgICAqL1xuICAgIHJlYWRvbmx5IGF1dG9HZW5lcmF0ZVRvb2xEZWZpbml0aW9ucz86IGJvb2xlYW47XG5cbiAgICAvKipcbiAgICAgKiDjgqvjgrnjgr/jg6Djg4Tjg7zjg6vlkI3jg5fjg6zjg5XjgqPjg4Pjgq/jgrlcbiAgICAgKi9cbiAgICByZWFkb25seSB0b29sTmFtZVByZWZpeD86IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIOWPluW+l+OBmeOCi+ODhOODvOODq+Wumue+qeOBruODleOCo+ODq+OCv+ODvO+8iOato+imj+ihqOePvu+8iVxuICAgICAqL1xuICAgIHJlYWRvbmx5IHRvb2xOYW1lRmlsdGVyPzogc3RyaW5nO1xuICB9O1xufVxuXG4vKipcbiAqIEJlZHJvY2sgQWdlbnRDb3JlIEdhdGV3YXkgQ29uc3RydWN0IOODl+ODreODkeODhuOCo1xuICovXG5leHBvcnQgaW50ZXJmYWNlIEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0UHJvcHMge1xuICAvKipcbiAgICogR2F0ZXdheeapn+iDveOCkuacieWKueWMluOBmeOCi+OBi1xuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBlbmFibGVkPzogYm9vbGVhbjtcblxuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5ZCNXG4gICAqL1xuICByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDnkrDlooPlkI3vvIhkZXYsIHN0YWdpbmcsIHByb2TnrYnvvIlcbiAgICovXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEdhdGV3YXkgU3BlY3MgUzPjg5DjgrHjg4Pjg4jvvIhEYXRhU3RhY2vjgYvjgonlj4LnhafvvIlcbiAgICogSWFD5YyWOiBDbG91ZEZvcm1hdGlvbiBJbXBvcnTjgYvjgonli5XnmoTjgavlj5blvpdcbiAgICovXG4gIHJlYWRvbmx5IGdhdGV3YXlTcGVjc0J1Y2tldD86IHMzLklCdWNrZXQ7XG4gIFxuICAvKipcbiAgICogRlN4IGZvciBPTlRBUCBGaWxlIFN5c3RlbSBJRO+8iERhdGFTdGFja+OBi+OCieWPgueFp++8iVxuICAgKiBJYUPljJY6IENsb3VkRm9ybWF0aW9uIEltcG9ydOOBi+OCieWLleeahOOBq+WPluW+l1xuICAgKi9cbiAgcmVhZG9ubHkgZnN4RmlsZVN5c3RlbUlkPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBSRVNUIEFQSeWkieaPm+ioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgcmVzdEFwaUNvbnZlcnNpb24/OiBSZXN0QXBpQ29udmVyc2lvbkNvbmZpZztcblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw5aSJ5o+b6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBsYW1iZGFGdW5jdGlvbkNvbnZlcnNpb24/OiBMYW1iZGFGdW5jdGlvbkNvbnZlcnNpb25Db25maWc7XG5cbiAgLyoqXG4gICAqIE1DUOOCteODvOODkOODvOe1seWQiOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgbWNwU2VydmVySW50ZWdyYXRpb24/OiBNY3BTZXJ2ZXJJbnRlZ3JhdGlvbkNvbmZpZztcblxuICAvKipcbiAgICogS01T5pqX5Y+35YyW44Kt44O877yI44Kq44OX44K344On44Oz77yJXG4gICAqIOaMh+WumuOBl+OBquOBhOWgtOWQiOOBr+iHquWLleeUn+aIkOOBleOCjOOCi1xuICAgKi9cbiAgcmVhZG9ubHkgZW5jcnlwdGlvbktleT86IGttcy5JS2V5O1xuXG4gIC8qKlxuICAgKiDjg63jgrDkv53mjIHmnJ/plpPvvIjml6XmlbDvvIlcbiAgICogQGRlZmF1bHQgN1xuICAgKi9cbiAgcmVhZG9ubHkgbG9nUmV0ZW50aW9uRGF5cz86IGxvZ3MuUmV0ZW50aW9uRGF5cztcblxuICAvKipcbiAgICog44K/44KwXG4gICAqL1xuICByZWFkb25seSB0YWdzPzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuLyoqXG4gKiBCZWRyb2NrIEFnZW50Q29yZSBHYXRld2F5IENvbnN0cnVjdFxuICogXG4gKiDml6LlrZjjga5BUEkvTGFtYmRh6Zai5pWwL01DUOOCteODvOODkOODvOOCkkJlZHJvY2sgQWdlbnTkupLmj5vjg4Tjg7zjg6vjgavoh6rli5XlpInmj5vjgZfjgb7jgZnjgIJcbiAqL1xuZXhwb3J0IGNsYXNzIEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgLyoqXG4gICAqIEdhdGV3YXnmqZ/og73jgYzmnInlirnjgYvjganjgYbjgYtcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBlbmFibGVkOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBSRVNUIEFQSeWkieaPm0xhbWJkYemWouaVsFxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHJlc3RBcGlDb252ZXJ0ZXJGdW5jdGlvbj86IGxhbWJkYS5GdW5jdGlvbjtcblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw5aSJ5o+bTGFtYmRh6Zai5pWwXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgbGFtYmRhQ29udmVydGVyRnVuY3Rpb24/OiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgLyoqXG4gICAqIE1DUOOCteODvOODkOODvOe1seWQiExhbWJkYemWouaVsFxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IG1jcEludGVncmF0aW9uRnVuY3Rpb24/OiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgLyoqXG4gICAqIEtNU+aal+WPt+WMluOCreODvFxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGVuY3J5cHRpb25LZXk6IGttcy5JS2V5O1xuXG4gIC8qKlxuICAgKiBJQU3lrp/ooYzjg63jg7zjg6tcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBleGVjdXRpb25Sb2xlOiBpYW0uUm9sZTtcblxuICAvKipcbiAgICogQ2xvdWRXYXRjaCBMb2dzIOODreOCsOOCsOODq+ODvOODl1xuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGxvZ0dyb3VwOiBsb2dzLkxvZ0dyb3VwO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlR2F0ZXdheUNvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIOacieWKueWMluODleODqeOCsOOBruODgeOCp+ODg+OCr1xuICAgIHRoaXMuZW5hYmxlZCA9IHByb3BzLmVuYWJsZWQgPz8gdHJ1ZTtcblxuICAgIGlmICghdGhpcy5lbmFibGVkKSB7XG4gICAgICAvLyDnhKHlirnljJbjgZXjgozjgabjgYTjgovloLTlkIjjga/kvZXjgoLjgZfjgarjgYRcbiAgICAgIGNvbnNvbGUubG9nKCfihLnvuI8gIEdhdGV3YXkgQ29uc3RydWN044Gv54Sh5Yq55YyW44GV44KM44Gm44GE44G+44GZJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gS01T5pqX5Y+35YyW44Kt44O844Gu5L2c5oiQ44G+44Gf44Gv5Y+W5b6XXG4gICAgdGhpcy5lbmNyeXB0aW9uS2V5ID0gcHJvcHMuZW5jcnlwdGlvbktleSA/PyB0aGlzLmNyZWF0ZUVuY3J5cHRpb25LZXkocHJvcHMpO1xuXG4gICAgLy8gSUFN5a6f6KGM44Ot44O844Or44Gu5L2c5oiQXG4gICAgdGhpcy5leGVjdXRpb25Sb2xlID0gdGhpcy5jcmVhdGVFeGVjdXRpb25Sb2xlKHByb3BzKTtcblxuICAgIC8vIENsb3VkV2F0Y2ggTG9nc+ODreOCsOOCsOODq+ODvOODl+OBruS9nOaIkFxuICAgIHRoaXMubG9nR3JvdXAgPSB0aGlzLmNyZWF0ZUxvZ0dyb3VwKHByb3BzKTtcblxuICAgIC8vIFJFU1QgQVBJ5aSJ5o+b5qmf6IO944Gu5a6f6KOF77yI5p2h5Lu25LuY44GN77yJXG4gICAgaWYgKHByb3BzLnJlc3RBcGlDb252ZXJzaW9uICYmIHByb3BzLmdhdGV3YXlTcGVjc0J1Y2tldCkge1xuICAgICAgY29uc29sZS5sb2coJ/CflIQgUkVTVCBBUEkgQ29udmVydGVy5L2c5oiQ5LitLi4uJyk7XG4gICAgICB0aGlzLnJlc3RBcGlDb252ZXJ0ZXJGdW5jdGlvbiA9IHRoaXMuY3JlYXRlUmVzdEFwaUNvbnZlcnRlckZ1bmN0aW9uKHByb3BzKTtcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgUkVTVCBBUEkgQ29udmVydGVy5L2c5oiQ5a6M5LqGJyk7XG4gICAgfSBlbHNlIGlmIChwcm9wcy5yZXN0QXBpQ29udmVyc2lvbikge1xuICAgICAgY29uc29sZS53YXJuKCfimqDvuI8gIFJFU1QgQVBJ5aSJ5o+b44GM5pyJ5Yq544Gn44GZ44GM44CBZ2F0ZXdheVNwZWNzQnVja2V044GM5o+Q5L6b44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgfVxuXG4gICAgLy8gTGFtYmRh6Zai5pWw5aSJ5o+b5qmf6IO944Gu5a6f6KOF77yI5p2h5Lu25LuY44GN77yJXG4gICAgaWYgKHByb3BzLmxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbiAmJiBcbiAgICAgICAgcHJvcHMubGFtYmRhRnVuY3Rpb25Db252ZXJzaW9uLmZ1bmN0aW9uQXJucyAmJiBcbiAgICAgICAgcHJvcHMubGFtYmRhRnVuY3Rpb25Db252ZXJzaW9uLmZ1bmN0aW9uQXJucy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zb2xlLmxvZygn8J+UhCBMYW1iZGEgRnVuY3Rpb24gQ29udmVydGVy5L2c5oiQ5LitLi4uJyk7XG4gICAgICB0aGlzLmxhbWJkYUNvbnZlcnRlckZ1bmN0aW9uID0gdGhpcy5jcmVhdGVMYW1iZGFDb252ZXJ0ZXJGdW5jdGlvbihwcm9wcyk7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIExhbWJkYSBGdW5jdGlvbiBDb252ZXJ0ZXLkvZzmiJDlrozkuoYnKTtcbiAgICB9IGVsc2UgaWYgKHByb3BzLmxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbikge1xuICAgICAgY29uc29sZS5sb2coJ+KEue+4jyAgTGFtYmRhIEZ1bmN0aW9uIENvbnZlcnRlcuOBr+eEoeWKueWMluOBleOCjOOBpuOBhOOBvuOBme+8iGZ1bmN0aW9uQXJuc+OBjOepuu+8iScpO1xuICAgIH1cblxuICAgIC8vIE1DUOOCteODvOODkOODvOe1seWQiOapn+iDveOBruWun+ijhe+8iOadoeS7tuS7mOOBje+8iVxuICAgIGlmIChwcm9wcy5tY3BTZXJ2ZXJJbnRlZ3JhdGlvbiAmJiBwcm9wcy5tY3BTZXJ2ZXJJbnRlZ3JhdGlvbi5zZXJ2ZXJFbmRwb2ludCkge1xuICAgICAgY29uc29sZS5sb2coJ/CflIQgTUNQIFNlcnZlciBJbnRlZ3JhdGlvbuS9nOaIkOS4rS4uLicpO1xuICAgICAgdGhpcy5tY3BJbnRlZ3JhdGlvbkZ1bmN0aW9uID0gdGhpcy5jcmVhdGVNY3BJbnRlZ3JhdGlvbkZ1bmN0aW9uKHByb3BzKTtcbiAgICAgIGNvbnNvbGUubG9nKCfinIUgTUNQIFNlcnZlciBJbnRlZ3JhdGlvbuS9nOaIkOWujOS6hicpO1xuICAgIH0gZWxzZSBpZiAocHJvcHMubWNwU2VydmVySW50ZWdyYXRpb24pIHtcbiAgICAgIGNvbnNvbGUud2Fybign4pqg77iPICBNQ1AgU2VydmVy57Wx5ZCI44GM5pyJ5Yq544Gn44GZ44GM44CBc2VydmVyRW5kcG9pbnTjgYzmj5DkvpvjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG5cbiAgICAvLyDjgr/jgrDjga7pgannlKhcbiAgICBpZiAocHJvcHMudGFncykge1xuICAgICAgT2JqZWN0LmVudHJpZXMocHJvcHMudGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChrZXksIHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIOODh+ODleOCqeODq+ODiOOCv+OCsOOBrui/veWKoFxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29tcG9uZW50JywgJ0JlZHJvY2tBZ2VudENvcmVHYXRld2F5Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgcHJvcHMucHJvamVjdE5hbWUpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG4gIH1cblxuICAvKipcbiAgICogS01T5pqX5Y+35YyW44Kt44O844KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUVuY3J5cHRpb25LZXkocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0UHJvcHMpOiBrbXMuS2V5IHtcbiAgICBjb25zdCBrZXkgPSBuZXcga21zLktleSh0aGlzLCAnRW5jcnlwdGlvbktleScsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiBgRW5jcnlwdGlvbiBrZXkgZm9yICR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9IEJlZHJvY2sgQWdlbnRDb3JlIEdhdGV3YXlgLFxuICAgICAgZW5hYmxlS2V5Um90YXRpb246IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2dz44GrIEtNUyBrZXnkvb/nlKjmqKnpmZDjgpLku5jkuI5cbiAgICBrZXkuYWRkVG9SZXNvdXJjZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKGBsb2dzLiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn0uYW1hem9uYXdzLmNvbWApXSxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2ttczpFbmNyeXB0JyxcbiAgICAgICAgJ2ttczpEZWNyeXB0JyxcbiAgICAgICAgJ2ttczpSZUVuY3J5cHQqJyxcbiAgICAgICAgJ2ttczpHZW5lcmF0ZURhdGFLZXkqJyxcbiAgICAgICAgJ2ttczpDcmVhdGVHcmFudCcsXG4gICAgICAgICdrbXM6RGVzY3JpYmVLZXknLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgIEFybkxpa2U6IHtcbiAgICAgICAgICAna21zOkVuY3J5cHRpb25Db250ZXh0OmF3czpsb2dzOmFybic6IGBhcm46YXdzOmxvZ3M6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fTpsb2ctZ3JvdXA6L2F3cy9iZWRyb2NrLWFnZW50LWNvcmUvZ2F0ZXdheS8ke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pKTtcbiAgICBcbiAgICByZXR1cm4ga2V5O1xuICB9XG5cbiAgLyoqXG4gICAqIElBTeWun+ihjOODreODvOODq+OCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVFeGVjdXRpb25Sb2xlKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlR2F0ZXdheUNvbnN0cnVjdFByb3BzKTogaWFtLlJvbGUge1xuICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0V4ZWN1dGlvblJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgRXhlY3V0aW9uIHJvbGUgZm9yICR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9IEJlZHJvY2sgQWdlbnRDb3JlIEdhdGV3YXlgLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEtNU+aoqemZkOOBrui/veWKoFxuICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAna21zOkRlY3J5cHQnLFxuICAgICAgICAna21zOkVuY3J5cHQnLFxuICAgICAgICAna21zOkdlbmVyYXRlRGF0YUtleScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbdGhpcy5lbmNyeXB0aW9uS2V5LmtleUFybl0sXG4gICAgfSkpO1xuXG4gICAgLy8gQmVkcm9ja+aoqemZkOOBrui/veWKoFxuICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrOkdldEFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEFnZW50cycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheeaoqemZkOOBrui/veWKoO+8iFJFU1QgQVBJ5aSJ5o+b44GM5pyJ5Yq544Gq5aC05ZCI77yJXG4gICAgaWYgKHByb3BzLnJlc3RBcGlDb252ZXJzaW9uKSB7XG4gICAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2FwaWdhdGV3YXk6R0VUJyxcbiAgICAgICAgICAnYXBpZ2F0ZXdheTpQT1NUJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICAvLyBMYW1iZGHmqKnpmZDjga7ov73liqDvvIhMYW1iZGHplqLmlbDlpInmj5vjgYzmnInlirnjgafjgIFmdW5jdGlvbkFybnPjgYzmj5DkvpvjgZXjgozjgabjgYTjgovloLTlkIjjga7jgb/vvIlcbiAgICBpZiAocHJvcHMubGFtYmRhRnVuY3Rpb25Db252ZXJzaW9uPy5mdW5jdGlvbkFybnMgJiYgXG4gICAgICAgIHByb3BzLmxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbi5mdW5jdGlvbkFybnMubGVuZ3RoID4gMCkge1xuICAgICAgcm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdsYW1iZGE6R2V0RnVuY3Rpb24nLFxuICAgICAgICAgICdsYW1iZGE6R2V0RnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgICAnbGFtYmRhOkludm9rZUZ1bmN0aW9uJyxcbiAgICAgICAgICAnbGFtYmRhOkxpc3RUYWdzJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBwcm9wcy5sYW1iZGFGdW5jdGlvbkNvbnZlcnNpb24uZnVuY3Rpb25Bcm5zLFxuICAgICAgfSkpO1xuICAgIH1cblxuICAgIC8vIFNlY3JldHMgTWFuYWdlcuaoqemZkOOBrui/veWKoO+8iE1DUOOCteODvOODkOODvOe1seWQiOOBjOacieWKueOBp+OAgXNlY3JldEFybnPjgYzmj5DkvpvjgZXjgozjgabjgYTjgovloLTlkIjjga7jgb/vvIlcbiAgICBpZiAocHJvcHMubWNwU2VydmVySW50ZWdyYXRpb24/LmF1dGhlbnRpY2F0aW9uKSB7XG4gICAgICBjb25zdCBzZWNyZXRBcm5zOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgXG4gICAgICBpZiAocHJvcHMubWNwU2VydmVySW50ZWdyYXRpb24uYXV0aGVudGljYXRpb24uYXBpS2V5U2VjcmV0QXJuKSB7XG4gICAgICAgIHNlY3JldEFybnMucHVzaChwcm9wcy5tY3BTZXJ2ZXJJbnRlZ3JhdGlvbi5hdXRoZW50aWNhdGlvbi5hcGlLZXlTZWNyZXRBcm4pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAocHJvcHMubWNwU2VydmVySW50ZWdyYXRpb24uYXV0aGVudGljYXRpb24ub2F1dGgyQ29uZmlnPy5jbGllbnRTZWNyZXRBcm4pIHtcbiAgICAgICAgc2VjcmV0QXJucy5wdXNoKHByb3BzLm1jcFNlcnZlckludGVncmF0aW9uLmF1dGhlbnRpY2F0aW9uLm9hdXRoMkNvbmZpZy5jbGllbnRTZWNyZXRBcm4pO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBzZWNyZXRBcm5z44GM5a2Y5Zyo44GZ44KL5aC05ZCI44Gu44G/44Od44Oq44K344O844KS6L+95YqgXG4gICAgICBpZiAoc2VjcmV0QXJucy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAnc2VjcmV0c21hbmFnZXI6R2V0U2VjcmV0VmFsdWUnLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVzb3VyY2VzOiBzZWNyZXRBcm5zLFxuICAgICAgICB9KSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJvbGU7XG4gIH1cblxuICAvKipcbiAgICogQ2xvdWRXYXRjaCBMb2dz44Ot44Kw44Kw44Or44O844OX44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUxvZ0dyb3VwKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlR2F0ZXdheUNvbnN0cnVjdFByb3BzKTogbG9ncy5Mb2dHcm91cCB7XG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2JlZHJvY2stYWdlbnQtY29yZS9nYXRld2F5LyR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIHJldGVudGlvbjogcHJvcHMubG9nUmV0ZW50aW9uRGF5cyA/PyBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgLy8gS01T5pqX5Y+35YyW44KS54Sh5Yq55YyW77yIQ2xvdWRXYXRjaCBMb2dz44Go44Gu5LqS5o+b5oCn5ZWP6aGM44KS5Zue6YG/77yJXG4gICAgICAvLyBlbmNyeXB0aW9uS2V5OiB0aGlzLmVuY3J5cHRpb25LZXksXG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIGxvZ0dyb3VwO1xuICB9XG5cbiAgLyoqXG4gICAqIFJFU1QgQVBJ5aSJ5o+bTGFtYmRh6Zai5pWw44KS5L2c5oiQ77yISWFD54mI77yJXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVJlc3RBcGlDb252ZXJ0ZXJGdW5jdGlvbihwcm9wczogQmVkcm9ja0FnZW50Q29yZUdhdGV3YXlDb25zdHJ1Y3RQcm9wcyk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgaWYgKCFwcm9wcy5yZXN0QXBpQ29udmVyc2lvbiB8fCAhcHJvcHMuZ2F0ZXdheVNwZWNzQnVja2V0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JFU1QgQVBJ5aSJ5o+b6Kit5a6a44G+44Gf44GvZ2F0ZXdheVNwZWNzQnVja2V044GM5oyH5a6a44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgfVxuXG4gICAgY29uc3QgY29uZmlnID0gcHJvcHMucmVzdEFwaUNvbnZlcnNpb247XG5cbiAgICAvLyDnkrDlooPlpInmlbDjga7mupblgpnvvIjlrozlhajli5XnmoTvvIlcbiAgICBjb25zdCBlbnZpcm9ubWVudDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHtcbiAgICAgIFBST0pFQ1RfTkFNRTogcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICBFTlZJUk9OTUVOVDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICBHQVRFV0FZX1NQRUNTX0JVQ0tFVDogcHJvcHMuZ2F0ZXdheVNwZWNzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBPUEVOQVBJX1NQRUNfS0VZOiBjb25maWcub3BlbkFwaVNwZWNLZXkgfHwgJ29wZW5hcGkvc2FtcGxlLW9wZW5hcGkueWFtbCcsXG4gICAgfTtcblxuICAgIC8vIEZTeCBGaWxlIFN5c3RlbSBJRO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgIGlmIChwcm9wcy5mc3hGaWxlU3lzdGVtSWQpIHtcbiAgICAgIGVudmlyb25tZW50LkZTWF9GSUxFX1NZU1RFTV9JRCA9IHByb3BzLmZzeEZpbGVTeXN0ZW1JZDtcbiAgICB9XG5cbiAgICAvLyBBUEkgR2F0ZXdheee1seWQiOioreWumu+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgIGlmIChjb25maWcuYXBpR2F0ZXdheUludGVncmF0aW9uKSB7XG4gICAgICBpZiAoY29uZmlnLmFwaUdhdGV3YXlJbnRlZ3JhdGlvbi5hcGlJZCkge1xuICAgICAgICBlbnZpcm9ubWVudC5BUElfR0FURVdBWV9JRCA9IGNvbmZpZy5hcGlHYXRld2F5SW50ZWdyYXRpb24uYXBpSWQ7XG4gICAgICB9XG4gICAgICBpZiAoY29uZmlnLmFwaUdhdGV3YXlJbnRlZ3JhdGlvbi5zdGFnZU5hbWUpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuQVBJX0dBVEVXQVlfU1RBR0UgPSBjb25maWcuYXBpR2F0ZXdheUludGVncmF0aW9uLnN0YWdlTmFtZTtcbiAgICAgIH1cbiAgICAgIGlmIChjb25maWcuYXBpR2F0ZXdheUludGVncmF0aW9uLmF1dGhUeXBlKSB7XG4gICAgICAgIGVudmlyb25tZW50LkFVVEhfVFlQRSA9IGNvbmZpZy5hcGlHYXRld2F5SW50ZWdyYXRpb24uYXV0aFR5cGU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g5aSJ5o+b44Kq44OX44K344On44OzXG4gICAgaWYgKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucykge1xuICAgICAgaWYgKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy5hdXRvR2VuZXJhdGVUb29sRGVmaW5pdGlvbnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBlbnZpcm9ubWVudC5BVVRPX0dFTkVSQVRFX1RPT0xTID0gU3RyaW5nKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy5hdXRvR2VuZXJhdGVUb29sRGVmaW5pdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy50b29sTmFtZVByZWZpeCkge1xuICAgICAgICBlbnZpcm9ubWVudC5UT09MX05BTUVfUFJFRklYID0gY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLnRvb2xOYW1lUHJlZml4O1xuICAgICAgfVxuICAgICAgaWYgKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy5leGNsdWRlUGF0dGVybnMpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuRVhDTFVERV9QQVRURVJOUyA9IEpTT04uc3RyaW5naWZ5KGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy5leGNsdWRlUGF0dGVybnMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIExhbWJkYemWouaVsOOBruS9nOaIkFxuICAgIGNvbnN0IGZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUmVzdEFwaUNvbnZlcnRlckZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hZ2VudC1jb3JlLWdhdGV3YXkvcmVzdC1hcGktY29udmVydGVyJyksXG4gICAgICByb2xlOiB0aGlzLmV4ZWN1dGlvblJvbGUsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGxvZ0dyb3VwOiB0aGlzLmxvZ0dyb3VwLFxuICAgICAgZGVzY3JpcHRpb246IGBSRVNUIEFQSSBDb252ZXJ0ZXIgZm9yICR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9IEJlZHJvY2sgQWdlbnRDb3JlIEdhdGV3YXlgLFxuICAgIH0pO1xuXG4gICAgLy8gUzPoqq3jgb/lj5bjgormqKnpmZDjga7ov73liqDvvIhHYXRld2F5IFNwZWNzIEJ1Y2tldO+8iVxuICAgIHByb3BzLmdhdGV3YXlTcGVjc0J1Y2tldC5ncmFudFJlYWQoZm4pO1xuXG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgLyoqXG4gICAqIExhbWJkYemWouaVsOWkieaPm0xhbWJkYemWouaVsOOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVMYW1iZGFDb252ZXJ0ZXJGdW5jdGlvbihwcm9wczogQmVkcm9ja0FnZW50Q29yZUdhdGV3YXlDb25zdHJ1Y3RQcm9wcyk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgaWYgKCFwcm9wcy5sYW1iZGFGdW5jdGlvbkNvbnZlcnNpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTGFtYmRh6Zai5pWw5aSJ5o+b6Kit5a6a44GM5oyH5a6a44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgfVxuXG4gICAgY29uc3QgY29uZmlnID0gcHJvcHMubGFtYmRhRnVuY3Rpb25Db252ZXJzaW9uO1xuXG4gICAgLy8g55Kw5aKD5aSJ5pWw44Gu5rqW5YKZXG4gICAgY29uc3QgZW52aXJvbm1lbnQ6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG4gICAgICBQUk9KRUNUX05BTUU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgIH07XG5cbiAgICAvLyDjg6Hjgr/jg4fjg7zjgr/jgr3jg7zjgrnoqK3lrppcbiAgICBpZiAoY29uZmlnLm1ldGFkYXRhU291cmNlKSB7XG4gICAgICBpZiAoY29uZmlnLm1ldGFkYXRhU291cmNlLnVzZVRhZ3MgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBlbnZpcm9ubWVudC5VU0VfVEFHUyA9IFN0cmluZyhjb25maWcubWV0YWRhdGFTb3VyY2UudXNlVGFncyk7XG4gICAgICB9XG4gICAgICBpZiAoY29uZmlnLm1ldGFkYXRhU291cmNlLnVzZUVudmlyb25tZW50VmFyaWFibGVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuVVNFX0VOVl9WQVJTID0gU3RyaW5nKGNvbmZpZy5tZXRhZGF0YVNvdXJjZS51c2VFbnZpcm9ubWVudFZhcmlhYmxlcyk7XG4gICAgICB9XG4gICAgICBpZiAoY29uZmlnLm1ldGFkYXRhU291cmNlLmN1c3RvbU1ldGFkYXRhUHJvdmlkZXIpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuQ1VTVE9NX01FVEFEQVRBX1BST1ZJREVSID0gY29uZmlnLm1ldGFkYXRhU291cmNlLmN1c3RvbU1ldGFkYXRhUHJvdmlkZXI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g5aSJ5o+b44Kq44OX44K344On44OzXG4gICAgaWYgKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucykge1xuICAgICAgaWYgKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy5hdXRvR2VuZXJhdGVUb29sRGVmaW5pdGlvbnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBlbnZpcm9ubWVudC5BVVRPX0dFTkVSQVRFX1RPT0xTID0gU3RyaW5nKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy5hdXRvR2VuZXJhdGVUb29sRGVmaW5pdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy50b29sTmFtZVByZWZpeCkge1xuICAgICAgICBlbnZpcm9ubWVudC5UT09MX05BTUVfUFJFRklYID0gY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLnRvb2xOYW1lUHJlZml4O1xuICAgICAgfVxuICAgICAgaWYgKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy50aW1lb3V0KSB7XG4gICAgICAgIGVudmlyb25tZW50LkNPTlZFUlNJT05fVElNRU9VVCA9IFN0cmluZyhjb25maWcuY29udmVyc2lvbk9wdGlvbnMudGltZW91dCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTGFtYmRh6Zai5pWw44Gu5L2c5oiQXG4gICAgY29uc3QgZm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdMYW1iZGFDb252ZXJ0ZXJGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvYWdlbnQtY29yZS1nYXRld2F5L2xhbWJkYS1mdW5jdGlvbi1jb252ZXJ0ZXInKSxcbiAgICAgIHJvbGU6IHRoaXMuZXhlY3V0aW9uUm9sZSxcbiAgICAgIGVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoY29uZmlnLmNvbnZlcnNpb25PcHRpb25zPy50aW1lb3V0IHx8IDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGxvZ0dyb3VwOiB0aGlzLmxvZ0dyb3VwLFxuICAgICAgZGVzY3JpcHRpb246IGBMYW1iZGEgRnVuY3Rpb24gQ29udmVydGVyIGZvciAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fSBCZWRyb2NrIEFnZW50Q29yZSBHYXRld2F5YCxcbiAgICB9KTtcblxuICAgIC8vIExhbWJkYemWouaVsOODoeOCv+ODh+ODvOOCv+WPluW+l+aoqemZkOOBrui/veWKoO+8iGZ1bmN0aW9uQXJuc+OBjOaPkOS+m+OBleOCjOOBpuOBhOOCi+WgtOWQiOOBruOBv++8iVxuICAgIGlmIChjb25maWcuZnVuY3Rpb25Bcm5zICYmIGNvbmZpZy5mdW5jdGlvbkFybnMubGVuZ3RoID4gMCkge1xuICAgICAgZm4uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2xhbWJkYTpHZXRGdW5jdGlvbicsXG4gICAgICAgICAgJ2xhbWJkYTpHZXRGdW5jdGlvbkNvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICdsYW1iZGE6TGlzdFRhZ3MnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IGNvbmZpZy5mdW5jdGlvbkFybnMsXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgLy8gTGFtYmRh6Zai5pWw5ZG844Gz5Ye644GX5qip6ZmQ44Gu6L+95Yqg77yI44Kr44K544K/44Og44Oh44K/44OH44O844K/44OX44Ot44OQ44Kk44OA44O844GM44GC44KL5aC05ZCI77yJXG4gICAgaWYgKGNvbmZpZy5tZXRhZGF0YVNvdXJjZT8uY3VzdG9tTWV0YWRhdGFQcm92aWRlcikge1xuICAgICAgZm4uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2xhbWJkYTpJbnZva2VGdW5jdGlvbicsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW2NvbmZpZy5tZXRhZGF0YVNvdXJjZS5jdXN0b21NZXRhZGF0YVByb3ZpZGVyXSxcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZm47XG4gIH1cblxuICAvKipcbiAgICogTUNQ44K144O844OQ44O857Wx5ZCITGFtYmRh6Zai5pWw44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU1jcEludGVncmF0aW9uRnVuY3Rpb24ocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0UHJvcHMpOiBsYW1iZGEuRnVuY3Rpb24ge1xuICAgIGlmICghcHJvcHMubWNwU2VydmVySW50ZWdyYXRpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTUNQ44K144O844OQ44O857Wx5ZCI6Kit5a6a44GM5oyH5a6a44GV44KM44Gm44GE44G+44Gb44KTJyk7XG4gICAgfVxuXG4gICAgY29uc3QgY29uZmlnID0gcHJvcHMubWNwU2VydmVySW50ZWdyYXRpb247XG5cbiAgICAvLyDnkrDlooPlpInmlbDjga7mupblgplcbiAgICBjb25zdCBlbnZpcm9ubWVudDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHtcbiAgICAgIFBST0pFQ1RfTkFNRTogcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICBFTlZJUk9OTUVOVDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgfTtcblxuICAgIC8vIE1DUOOCteODvOODkOODvOOCqOODs+ODieODneOCpOODs+ODiO+8iOOCquODl+OCt+ODp+ODs++8iVxuICAgIGlmIChjb25maWcuc2VydmVyRW5kcG9pbnQpIHtcbiAgICAgIGVudmlyb25tZW50Lk1DUF9TRVJWRVJfRU5EUE9JTlQgPSBjb25maWcuc2VydmVyRW5kcG9pbnQ7XG4gICAgfVxuXG4gICAgLy8gV2ViU29ja2V057Wx5ZCI6Kit5a6aXG4gICAgaWYgKGNvbmZpZy53ZWJTb2NrZXRDb25maWcpIHtcbiAgICAgIGlmIChjb25maWcud2ViU29ja2V0Q29uZmlnLmNvbm5lY3Rpb25UaW1lb3V0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuV1NfQ09OTkVDVElPTl9USU1FT1VUID0gU3RyaW5nKGNvbmZpZy53ZWJTb2NrZXRDb25maWcuY29ubmVjdGlvblRpbWVvdXQpO1xuICAgICAgfVxuICAgICAgaWYgKGNvbmZpZy53ZWJTb2NrZXRDb25maWcucmVjb25uZWN0Q29uZmlnKSB7XG4gICAgICAgIGlmIChjb25maWcud2ViU29ja2V0Q29uZmlnLnJlY29ubmVjdENvbmZpZy5tYXhSZXRyaWVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBlbnZpcm9ubWVudC5NQVhfUkVUUllfQVRURU1QVFMgPSBTdHJpbmcoY29uZmlnLndlYlNvY2tldENvbmZpZy5yZWNvbm5lY3RDb25maWcubWF4UmV0cmllcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbmZpZy53ZWJTb2NrZXRDb25maWcucmVjb25uZWN0Q29uZmlnLnJldHJ5SW50ZXJ2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGVudmlyb25tZW50LlJFVFJZX0lOVEVSVkFMID0gU3RyaW5nKGNvbmZpZy53ZWJTb2NrZXRDb25maWcucmVjb25uZWN0Q29uZmlnLnJldHJ5SW50ZXJ2YWwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g5aSJ5o+b44Kq44OX44K344On44OzXG4gICAgaWYgKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucykge1xuICAgICAgaWYgKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy5hdXRvR2VuZXJhdGVUb29sRGVmaW5pdGlvbnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBlbnZpcm9ubWVudC5BVVRPX0dFTkVSQVRFX1RPT0xTID0gU3RyaW5nKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy5hdXRvR2VuZXJhdGVUb29sRGVmaW5pdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy50b29sTmFtZVByZWZpeCkge1xuICAgICAgICBlbnZpcm9ubWVudC5UT09MX05BTUVfUFJFRklYID0gY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLnRvb2xOYW1lUHJlZml4O1xuICAgICAgfVxuICAgICAgaWYgKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy50b29sTmFtZUZpbHRlcikge1xuICAgICAgICBlbnZpcm9ubWVudC5UT09MX05BTUVfRklMVEVSID0gY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLnRvb2xOYW1lRmlsdGVyO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIExhbWJkYemWouaVsOOBruS9nOaIkFxuICAgIGNvbnN0IGZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTWNwSW50ZWdyYXRpb25GdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvYWdlbnQtY29yZS1nYXRld2F5L21jcC1zZXJ2ZXItaW50ZWdyYXRpb24nKSxcbiAgICAgIHJvbGU6IHRoaXMuZXhlY3V0aW9uUm9sZSxcbiAgICAgIGVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgbG9nR3JvdXA6IHRoaXMubG9nR3JvdXAsXG4gICAgICBkZXNjcmlwdGlvbjogYE1DUCBTZXJ2ZXIgSW50ZWdyYXRpb24gZm9yICR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9IEJlZHJvY2sgQWdlbnRDb3JlIEdhdGV3YXlgLFxuICAgIH0pO1xuXG4gICAgLy8gU2VjcmV0cyBNYW5hZ2Vy6Kqt44G/5Y+W44KK5qip6ZmQ44Gu6L+95Yqg77yI6KqN6Ki844GM5pyJ5Yq544Gq5aC05ZCI77yJXG4gICAgaWYgKGNvbmZpZy5hdXRoZW50aWNhdGlvbikge1xuICAgICAgY29uc3Qgc2VjcmV0QXJuczogc3RyaW5nW10gPSBbXTtcblxuICAgICAgaWYgKGNvbmZpZy5hdXRoZW50aWNhdGlvbi5hcGlLZXlTZWNyZXRBcm4pIHtcbiAgICAgICAgc2VjcmV0QXJucy5wdXNoKGNvbmZpZy5hdXRoZW50aWNhdGlvbi5hcGlLZXlTZWNyZXRBcm4pO1xuICAgICAgfVxuXG4gICAgICBpZiAoY29uZmlnLmF1dGhlbnRpY2F0aW9uLm9hdXRoMkNvbmZpZz8uY2xpZW50U2VjcmV0QXJuKSB7XG4gICAgICAgIHNlY3JldEFybnMucHVzaChjb25maWcuYXV0aGVudGljYXRpb24ub2F1dGgyQ29uZmlnLmNsaWVudFNlY3JldEFybik7XG4gICAgICB9XG5cbiAgICAgIGlmIChzZWNyZXRBcm5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZm4uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgJ3NlY3JldHNtYW5hZ2VyOkdldFNlY3JldFZhbHVlJyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlc291cmNlczogc2VjcmV0QXJucyxcbiAgICAgICAgfSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmbjtcbiAgfVxufVxuIl19