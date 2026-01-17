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
     * REST API変換Lambda関数を作成
     */
    createRestApiConverterFunction(props) {
        if (!props.restApiConversion) {
            throw new Error('REST API変換設定が指定されていません');
        }
        const config = props.restApiConversion;
        // 環境変数の準備
        const environment = {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb3JlLWdhdGV3YXktY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmVkcm9jay1hZ2VudC1jb3JlLWdhdGV3YXktY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7O0dBWUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLDJDQUF1QztBQUN2QywrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLDJEQUE2QztBQUM3Qyx5REFBMkM7QUFxUDNDOzs7O0dBSUc7QUFDSCxNQUFhLGdDQUFpQyxTQUFRLHNCQUFTO0lBQzdEOztPQUVHO0lBQ2EsT0FBTyxDQUFVO0lBRWpDOztPQUVHO0lBQ2Esd0JBQXdCLENBQW1CO0lBRTNEOztPQUVHO0lBQ2EsdUJBQXVCLENBQW1CO0lBRTFEOztPQUVHO0lBQ2Esc0JBQXNCLENBQW1CO0lBRXpEOztPQUVHO0lBQ2EsYUFBYSxDQUFXO0lBRXhDOztPQUVHO0lBQ2EsYUFBYSxDQUFXO0lBRXhDOztPQUVHO0lBQ2EsUUFBUSxDQUFnQjtJQUV4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTRDO1FBQ3BGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsY0FBYztRQUNkLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUM7UUFFckMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsQixtQkFBbUI7WUFDbkIsT0FBTztRQUNULENBQUM7UUFFRCxtQkFBbUI7UUFDbkIsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU1RSxjQUFjO1FBQ2QsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxD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LGFBQWE7WUFDeEIsV0FBVztZQUNYLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsVUFBVSxFQUFFLEdBQUc7WUFDZixRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDdkIsV0FBVyxFQUFFLDhCQUE4QixLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQyxXQUFXLDRCQUE0QjtTQUM5RyxDQUFDLENBQUM7UUFFSCxxQ0FBcUM7UUFDckMsSUFBSSxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDMUIsTUFBTSxVQUFVLEdBQWEsRUFBRSxDQUFDO1lBRWhDLElBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDMUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3pELENBQUM7WUFFRCxJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBRSxDQUFDO2dCQUN4RCxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3RFLENBQUM7WUFFRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQzFCLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO29CQUN6QyxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO29CQUN4QixPQUFPLEVBQUU7d0JBQ1AsK0JBQStCO3FCQUNoQztvQkFDRCxTQUFTLEVBQUUsVUFBVTtpQkFDdEIsQ0FBQyxDQUFDLENBQUM7WUFDTixDQUFDO1FBQ0gsQ0FBQztRQUVELE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztDQUNGO0FBamFELDRFQWlhQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQW1hem9uIEJlZHJvY2sgQWdlbnRDb3JlIEdhdGV3YXkgQ29uc3RydWN0XG4gKiBcbiAqIOOBk+OBrkNvbnN0cnVjdOOBr+OAgeaXouWtmOOBrkFQSS9MYW1iZGHplqLmlbAvTUNQ44K144O844OQ44O844KSQmVkcm9jayBBZ2VudOS6kuaPm+ODhOODvOODq+OBq+iHquWLleWkieaPm+OBl+OBvuOBmeOAglxuICogXG4gKiDkuLvopoHmqZ/og706XG4gKiAtIFJFU1QgQVBJIOKGkiBCZWRyb2NrIEFnZW50IFRvb2zlpInmj5tcbiAqIC0gTGFtYmRh6Zai5pWwIOKGkiBCZWRyb2NrIEFnZW50IFRvb2zlpInmj5tcbiAqIC0gTUNQ44K144O844OQ44O857Wx5ZCIXG4gKiBcbiAqIEBhdXRob3IgS2lybyBBSVxuICogQGRhdGUgMjAyNi0wMS0wM1xuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMga21zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1rbXMnO1xuXG4vKipcbiAqIFJFU1QgQVBJ5aSJ5o+b6Kit5a6aXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVzdEFwaUNvbnZlcnNpb25Db25maWcge1xuICAvKipcbiAgICogT3BlbkFQSeS7leanmOODleOCoeOCpOODq+OBruODkeOCue+8iFMzIFVSSeOBvuOBn+OBr+ODreODvOOCq+ODq+ODkeOCue+8iVxuICAgKi9cbiAgcmVhZG9ubHkgb3BlbkFwaVNwZWNQYXRoOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEFQSSBHYXRld2F557Wx5ZCI6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBhcGlHYXRld2F5SW50ZWdyYXRpb24/OiB7XG4gICAgLyoqXG4gICAgICogQVBJIEdhdGV3YXkgUkVTVCBBUEnjga5JRFxuICAgICAqL1xuICAgIHJlYWRvbmx5IGFwaUlkOiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBBUEkgR2F0ZXdheeOBruOCueODhuODvOOCuOWQjVxuICAgICAqL1xuICAgIHJlYWRvbmx5IHN0YWdlTmFtZTogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICog6KqN6Ki844K/44Kk44OX77yISUFNLCBDT0dOSVRPLCBBUElfS0VZLCBOT05F77yJXG4gICAgICovXG4gICAgcmVhZG9ubHkgYXV0aFR5cGU/OiAnSUFNJyB8ICdDT0dOSVRPJyB8ICdBUElfS0VZJyB8ICdOT05FJztcbiAgfTtcblxuICAvKipcbiAgICog5aSJ5o+b44Kq44OX44K344On44OzXG4gICAqL1xuICByZWFkb25seSBjb252ZXJzaW9uT3B0aW9ucz86IHtcbiAgICAvKipcbiAgICAgKiDoh6rli5XnmoTjgatCZWRyb2NrIEFnZW50IFRvb2zlrprnvqnjgpLnlJ/miJDjgZnjgovjgYtcbiAgICAgKi9cbiAgICByZWFkb25seSBhdXRvR2VuZXJhdGVUb29sRGVmaW5pdGlvbnM/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog44Kr44K544K/44Og44OE44O844Or5ZCN44OX44Os44OV44Kj44OD44Kv44K5XG4gICAgICovXG4gICAgcmVhZG9ubHkgdG9vbE5hbWVQcmVmaXg/OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiDpmaTlpJbjgZnjgovjgqjjg7Pjg4njg53jgqTjg7Pjg4jjga7jg5Hjgr/jg7zjg7PvvIjmraPopo/ooajnj77vvIlcbiAgICAgKi9cbiAgICByZWFkb25seSBleGNsdWRlUGF0dGVybnM/OiBzdHJpbmdbXTtcbiAgfTtcbn1cblxuLyoqXG4gKiBMYW1iZGHplqLmlbDlpInmj5voqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBMYW1iZGFGdW5jdGlvbkNvbnZlcnNpb25Db25maWcge1xuICAvKipcbiAgICog5aSJ5o+b5a++6LGh44GuTGFtYmRh6Zai5pWwQVJO44Oq44K544OIXG4gICAqL1xuICByZWFkb25seSBmdW5jdGlvbkFybnM6IHN0cmluZ1tdO1xuXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDjga7jg6Hjgr/jg4fjg7zjgr/lj5blvpfmlrnms5VcbiAgICovXG4gIHJlYWRvbmx5IG1ldGFkYXRhU291cmNlPzoge1xuICAgIC8qKlxuICAgICAqIOmWouaVsOOBruOCv+OCsOOBi+OCieODoeOCv+ODh+ODvOOCv+OCkuWPluW+l+OBmeOCi+OBi1xuICAgICAqL1xuICAgIHJlYWRvbmx5IHVzZVRhZ3M/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog6Zai5pWw44Gu55Kw5aKD5aSJ5pWw44GL44KJ44Oh44K/44OH44O844K/44KS5Y+W5b6X44GZ44KL44GLXG4gICAgICovXG4gICAgcmVhZG9ubHkgdXNlRW52aXJvbm1lbnRWYXJpYWJsZXM/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog44Kr44K544K/44Og44Oh44K/44OH44O844K/44OX44Ot44OQ44Kk44OA44O877yITGFtYmRh6Zai5pWwQVJO77yJXG4gICAgICovXG4gICAgcmVhZG9ubHkgY3VzdG9tTWV0YWRhdGFQcm92aWRlcj86IHN0cmluZztcbiAgfTtcblxuICAvKipcbiAgICog5aSJ5o+b44Kq44OX44K344On44OzXG4gICAqL1xuICByZWFkb25seSBjb252ZXJzaW9uT3B0aW9ucz86IHtcbiAgICAvKipcbiAgICAgKiDoh6rli5XnmoTjgatCZWRyb2NrIEFnZW50IFRvb2zlrprnvqnjgpLnlJ/miJDjgZnjgovjgYtcbiAgICAgKi9cbiAgICByZWFkb25seSBhdXRvR2VuZXJhdGVUb29sRGVmaW5pdGlvbnM/OiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICog44Kr44K544K/44Og44OE44O844Or5ZCN44OX44Os44OV44Kj44OD44Kv44K5XG4gICAgICovXG4gICAgcmVhZG9ubHkgdG9vbE5hbWVQcmVmaXg/OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiDjgr/jgqTjg6DjgqLjgqbjg4joqK3lrprvvIjnp5LvvIlcbiAgICAgKi9cbiAgICByZWFkb25seSB0aW1lb3V0PzogbnVtYmVyO1xuICB9O1xufVxuXG4vKipcbiAqIE1DUOOCteODvOODkOODvOe1seWQiOioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIE1jcFNlcnZlckludGVncmF0aW9uQ29uZmlnIHtcbiAgLyoqXG4gICAqIE1DUOOCteODvOODkOODvOOBruOCqOODs+ODieODneOCpOODs+ODiFVSTFxuICAgKi9cbiAgcmVhZG9ubHkgc2VydmVyRW5kcG9pbnQ6IHN0cmluZztcblxuICAvKipcbiAgICogTUNQ44K144O844OQ44O844Gu6KqN6Ki86Kit5a6aXG4gICAqL1xuICByZWFkb25seSBhdXRoZW50aWNhdGlvbj86IHtcbiAgICAvKipcbiAgICAgKiDoqo3oqLzjgr/jgqTjg5fvvIhBUElfS0VZLCBPQVVUSDIsIE5PTkXvvIlcbiAgICAgKi9cbiAgICByZWFkb25seSB0eXBlOiAnQVBJX0tFWScgfCAnT0FVVEgyJyB8ICdOT05FJztcblxuICAgIC8qKlxuICAgICAqIEFQSeOCreODvO+8iFNlY3JldHMgTWFuYWdlciBBUk7vvIlcbiAgICAgKi9cbiAgICByZWFkb25seSBhcGlLZXlTZWNyZXRBcm4/OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiBPQXV0aDLoqK3lrppcbiAgICAgKi9cbiAgICByZWFkb25seSBvYXV0aDJDb25maWc/OiB7XG4gICAgICAvKipcbiAgICAgICAqIOOCr+ODqeOCpOOCouODs+ODiElEXG4gICAgICAgKi9cbiAgICAgIHJlYWRvbmx5IGNsaWVudElkOiBzdHJpbmc7XG5cbiAgICAgIC8qKlxuICAgICAgICog44Kv44Op44Kk44Ki44Oz44OI44K344O844Kv44Os44OD44OI77yIU2VjcmV0cyBNYW5hZ2VyIEFSTu+8iVxuICAgICAgICovXG4gICAgICByZWFkb25seSBjbGllbnRTZWNyZXRBcm46IHN0cmluZztcblxuICAgICAgLyoqXG4gICAgICAgKiDjg4jjg7zjgq/jg7Pjgqjjg7Pjg4njg53jgqTjg7Pjg4hcbiAgICAgICAqL1xuICAgICAgcmVhZG9ubHkgdG9rZW5FbmRwb2ludDogc3RyaW5nO1xuICAgIH07XG4gIH07XG5cbiAgLyoqXG4gICAqIFdlYlNvY2tldOe1seWQiOioreWumlxuICAgKi9cbiAgcmVhZG9ubHkgd2ViU29ja2V0Q29uZmlnPzoge1xuICAgIC8qKlxuICAgICAqIFdlYlNvY2tldOaOpee2muOCv+OCpOODoOOCouOCpuODiO+8iOenku+8iVxuICAgICAqL1xuICAgIHJlYWRvbmx5IGNvbm5lY3Rpb25UaW1lb3V0PzogbnVtYmVyO1xuXG4gICAgLyoqXG4gICAgICog5YaN5o6l57aa6Kit5a6aXG4gICAgICovXG4gICAgcmVhZG9ubHkgcmVjb25uZWN0Q29uZmlnPzoge1xuICAgICAgLyoqXG4gICAgICAgKiDmnIDlpKflho3mjqXntproqabooYzlm57mlbBcbiAgICAgICAqL1xuICAgICAgcmVhZG9ubHkgbWF4UmV0cmllcz86IG51bWJlcjtcblxuICAgICAgLyoqXG4gICAgICAgKiDlho3mjqXntprplpPpmpTvvIjjg5/jg6rnp5LvvIlcbiAgICAgICAqL1xuICAgICAgcmVhZG9ubHkgcmV0cnlJbnRlcnZhbD86IG51bWJlcjtcbiAgICB9O1xuICB9O1xuXG4gIC8qKlxuICAgKiDlpInmj5vjgqrjg5fjgrfjg6fjg7NcbiAgICovXG4gIHJlYWRvbmx5IGNvbnZlcnNpb25PcHRpb25zPzoge1xuICAgIC8qKlxuICAgICAqIOiHquWLleeahOOBq0JlZHJvY2sgQWdlbnQgVG9vbOWumue+qeOCkueUn+aIkOOBmeOCi+OBi1xuICAgICAqL1xuICAgIHJlYWRvbmx5IGF1dG9HZW5lcmF0ZVRvb2xEZWZpbml0aW9ucz86IGJvb2xlYW47XG5cbiAgICAvKipcbiAgICAgKiDjgqvjgrnjgr/jg6Djg4Tjg7zjg6vlkI3jg5fjg6zjg5XjgqPjg4Pjgq/jgrlcbiAgICAgKi9cbiAgICByZWFkb25seSB0b29sTmFtZVByZWZpeD86IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIOWPluW+l+OBmeOCi+ODhOODvOODq+Wumue+qeOBruODleOCo+ODq+OCv+ODvO+8iOato+imj+ihqOePvu+8iVxuICAgICAqL1xuICAgIHJlYWRvbmx5IHRvb2xOYW1lRmlsdGVyPzogc3RyaW5nO1xuICB9O1xufVxuXG4vKipcbiAqIEJlZHJvY2sgQWdlbnRDb3JlIEdhdGV3YXkgQ29uc3RydWN0IOODl+ODreODkeODhuOCo1xuICovXG5leHBvcnQgaW50ZXJmYWNlIEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0UHJvcHMge1xuICAvKipcbiAgICogR2F0ZXdheeapn+iDveOCkuacieWKueWMluOBmeOCi+OBi1xuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICByZWFkb25seSBlbmFibGVkPzogYm9vbGVhbjtcblxuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5ZCNXG4gICAqL1xuICByZWFkb25seSBwcm9qZWN0TmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDnkrDlooPlkI3vvIhkZXYsIHN0YWdpbmcsIHByb2TnrYnvvIlcbiAgICovXG4gIHJlYWRvbmx5IGVudmlyb25tZW50OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFJFU1QgQVBJ5aSJ5o+b6Kit5a6aXG4gICAqL1xuICByZWFkb25seSByZXN0QXBpQ29udmVyc2lvbj86IFJlc3RBcGlDb252ZXJzaW9uQ29uZmlnO1xuXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDlpInmj5voqK3lrppcbiAgICovXG4gIHJlYWRvbmx5IGxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbj86IExhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbkNvbmZpZztcblxuICAvKipcbiAgICogTUNQ44K144O844OQ44O857Wx5ZCI6Kit5a6aXG4gICAqL1xuICByZWFkb25seSBtY3BTZXJ2ZXJJbnRlZ3JhdGlvbj86IE1jcFNlcnZlckludGVncmF0aW9uQ29uZmlnO1xuXG4gIC8qKlxuICAgKiBLTVPmmpflj7fljJbjgq3jg7zvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICog5oyH5a6a44GX44Gq44GE5aC05ZCI44Gv6Ieq5YuV55Sf5oiQ44GV44KM44KLXG4gICAqL1xuICByZWFkb25seSBlbmNyeXB0aW9uS2V5Pzoga21zLklLZXk7XG5cbiAgLyoqXG4gICAqIOODreOCsOS/neaMgeacn+mWk++8iOaXpeaVsO+8iVxuICAgKiBAZGVmYXVsdCA3XG4gICAqL1xuICByZWFkb25seSBsb2dSZXRlbnRpb25EYXlzPzogbG9ncy5SZXRlbnRpb25EYXlzO1xuXG4gIC8qKlxuICAgKiDjgr/jgrBcbiAgICovXG4gIHJlYWRvbmx5IHRhZ3M/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xufVxuXG4vKipcbiAqIEJlZHJvY2sgQWdlbnRDb3JlIEdhdGV3YXkgQ29uc3RydWN0XG4gKiBcbiAqIOaXouWtmOOBrkFQSS9MYW1iZGHplqLmlbAvTUNQ44K144O844OQ44O844KSQmVkcm9jayBBZ2VudOS6kuaPm+ODhOODvOODq+OBq+iHquWLleWkieaPm+OBl+OBvuOBmeOAglxuICovXG5leHBvcnQgY2xhc3MgQmVkcm9ja0FnZW50Q29yZUdhdGV3YXlDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAvKipcbiAgICogR2F0ZXdheeapn+iDveOBjOacieWKueOBi+OBqeOBhuOBi1xuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGVuYWJsZWQ6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFJFU1QgQVBJ5aSJ5o+bTGFtYmRh6Zai5pWwXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgcmVzdEFwaUNvbnZlcnRlckZ1bmN0aW9uPzogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIC8qKlxuICAgKiBMYW1iZGHplqLmlbDlpInmj5tMYW1iZGHplqLmlbBcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBsYW1iZGFDb252ZXJ0ZXJGdW5jdGlvbj86IGxhbWJkYS5GdW5jdGlvbjtcblxuICAvKipcbiAgICogTUNQ44K144O844OQ44O857Wx5ZCITGFtYmRh6Zai5pWwXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgbWNwSW50ZWdyYXRpb25GdW5jdGlvbj86IGxhbWJkYS5GdW5jdGlvbjtcblxuICAvKipcbiAgICogS01T5pqX5Y+35YyW44Kt44O8XG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZW5jcnlwdGlvbktleToga21zLklLZXk7XG5cbiAgLyoqXG4gICAqIElBTeWun+ihjOODreODvOODq1xuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGV4ZWN1dGlvblJvbGU6IGlhbS5Sb2xlO1xuXG4gIC8qKlxuICAgKiBDbG91ZFdhdGNoIExvZ3Mg44Ot44Kw44Kw44Or44O844OXXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgbG9nR3JvdXA6IGxvZ3MuTG9nR3JvdXA7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0UHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8g5pyJ5Yq55YyW44OV44Op44Kw44Gu44OB44Kn44OD44KvXG4gICAgdGhpcy5lbmFibGVkID0gcHJvcHMuZW5hYmxlZCA/PyB0cnVlO1xuXG4gICAgaWYgKCF0aGlzLmVuYWJsZWQpIHtcbiAgICAgIC8vIOeEoeWKueWMluOBleOCjOOBpuOBhOOCi+WgtOWQiOOBr+S9leOCguOBl+OBquOBhFxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEtNU+aal+WPt+WMluOCreODvOOBruS9nOaIkOOBvuOBn+OBr+WPluW+l1xuICAgIHRoaXMuZW5jcnlwdGlvbktleSA9IHByb3BzLmVuY3J5cHRpb25LZXkgPz8gdGhpcy5jcmVhdGVFbmNyeXB0aW9uS2V5KHByb3BzKTtcblxuICAgIC8vIElBTeWun+ihjOODreODvOODq+OBruS9nOaIkFxuICAgIHRoaXMuZXhlY3V0aW9uUm9sZSA9IHRoaXMuY3JlYXRlRXhlY3V0aW9uUm9sZShwcm9wcyk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIExvZ3Pjg63jgrDjgrDjg6vjg7zjg5fjga7kvZzmiJBcbiAgICB0aGlzLmxvZ0dyb3VwID0gdGhpcy5jcmVhdGVMb2dHcm91cChwcm9wcyk7XG5cbiAgICAvLyBSRVNUIEFQSeWkieaPm+apn+iDveOBruWun+ijhVxuICAgIGlmIChwcm9wcy5yZXN0QXBpQ29udmVyc2lvbikge1xuICAgICAgdGhpcy5yZXN0QXBpQ29udmVydGVyRnVuY3Rpb24gPSB0aGlzLmNyZWF0ZVJlc3RBcGlDb252ZXJ0ZXJGdW5jdGlvbihwcm9wcyk7XG4gICAgfVxuXG4gICAgLy8gTGFtYmRh6Zai5pWw5aSJ5o+b5qmf6IO944Gu5a6f6KOFXG4gICAgaWYgKHByb3BzLmxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbikge1xuICAgICAgdGhpcy5sYW1iZGFDb252ZXJ0ZXJGdW5jdGlvbiA9IHRoaXMuY3JlYXRlTGFtYmRhQ29udmVydGVyRnVuY3Rpb24ocHJvcHMpO1xuICAgIH1cblxuICAgIC8vIE1DUOOCteODvOODkOODvOe1seWQiOapn+iDveOBruWun+ijhVxuICAgIGlmIChwcm9wcy5tY3BTZXJ2ZXJJbnRlZ3JhdGlvbikge1xuICAgICAgdGhpcy5tY3BJbnRlZ3JhdGlvbkZ1bmN0aW9uID0gdGhpcy5jcmVhdGVNY3BJbnRlZ3JhdGlvbkZ1bmN0aW9uKHByb3BzKTtcbiAgICB9XG5cbiAgICAvLyDjgr/jgrDjga7pgannlKhcbiAgICBpZiAocHJvcHMudGFncykge1xuICAgICAgT2JqZWN0LmVudHJpZXMocHJvcHMudGFncykuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZChrZXksIHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIOODh+ODleOCqeODq+ODiOOCv+OCsOOBrui/veWKoFxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29tcG9uZW50JywgJ0JlZHJvY2tBZ2VudENvcmVHYXRld2F5Jyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgcHJvcHMucHJvamVjdE5hbWUpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG4gIH1cblxuICAvKipcbiAgICogS01T5pqX5Y+35YyW44Kt44O844KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUVuY3J5cHRpb25LZXkocHJvcHM6IEJlZHJvY2tBZ2VudENvcmVHYXRld2F5Q29uc3RydWN0UHJvcHMpOiBrbXMuS2V5IHtcbiAgICByZXR1cm4gbmV3IGttcy5LZXkodGhpcywgJ0VuY3J5cHRpb25LZXknLCB7XG4gICAgICBkZXNjcmlwdGlvbjogYEVuY3J5cHRpb24ga2V5IGZvciAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fSBCZWRyb2NrIEFnZW50Q29yZSBHYXRld2F5YCxcbiAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIElBTeWun+ihjOODreODvOODq+OCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVFeGVjdXRpb25Sb2xlKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlR2F0ZXdheUNvbnN0cnVjdFByb3BzKTogaWFtLlJvbGUge1xuICAgIGNvbnN0IHJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0V4ZWN1dGlvblJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgRXhlY3V0aW9uIHJvbGUgZm9yICR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9IEJlZHJvY2sgQWdlbnRDb3JlIEdhdGV3YXlgLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEtNU+aoqemZkOOBrui/veWKoFxuICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAna21zOkRlY3J5cHQnLFxuICAgICAgICAna21zOkVuY3J5cHQnLFxuICAgICAgICAna21zOkdlbmVyYXRlRGF0YUtleScsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbdGhpcy5lbmNyeXB0aW9uS2V5LmtleUFybl0sXG4gICAgfSkpO1xuXG4gICAgLy8gQmVkcm9ja+aoqemZkOOBrui/veWKoFxuICAgIHJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrOkdldEFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2s6TGlzdEFnZW50cycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheeaoqemZkOOBrui/veWKoO+8iFJFU1QgQVBJ5aSJ5o+b44GM5pyJ5Yq544Gq5aC05ZCI77yJXG4gICAgaWYgKHByb3BzLnJlc3RBcGlDb252ZXJzaW9uKSB7XG4gICAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2FwaWdhdGV3YXk6R0VUJyxcbiAgICAgICAgICAnYXBpZ2F0ZXdheTpQT1NUJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICAvLyBMYW1iZGHmqKnpmZDjga7ov73liqDvvIhMYW1iZGHplqLmlbDlpInmj5vjgYzmnInlirnjgarloLTlkIjvvIlcbiAgICBpZiAocHJvcHMubGFtYmRhRnVuY3Rpb25Db252ZXJzaW9uKSB7XG4gICAgICByb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2xhbWJkYTpHZXRGdW5jdGlvbicsXG4gICAgICAgICAgJ2xhbWJkYTpHZXRGdW5jdGlvbkNvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICdsYW1iZGE6SW52b2tlRnVuY3Rpb24nLFxuICAgICAgICAgICdsYW1iZGE6TGlzdFRhZ3MnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IHByb3BzLmxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbi5mdW5jdGlvbkFybnMsXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgLy8gU2VjcmV0cyBNYW5hZ2Vy5qip6ZmQ44Gu6L+95Yqg77yITUNQ44K144O844OQ44O857Wx5ZCI44GM5pyJ5Yq544Gq5aC05ZCI77yJXG4gICAgaWYgKHByb3BzLm1jcFNlcnZlckludGVncmF0aW9uPy5hdXRoZW50aWNhdGlvbikge1xuICAgICAgcm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZScsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIHByb3BzLm1jcFNlcnZlckludGVncmF0aW9uLmF1dGhlbnRpY2F0aW9uLmFwaUtleVNlY3JldEFybiB8fCAnKicsXG4gICAgICAgICAgcHJvcHMubWNwU2VydmVySW50ZWdyYXRpb24uYXV0aGVudGljYXRpb24ub2F1dGgyQ29uZmlnPy5jbGllbnRTZWNyZXRBcm4gfHwgJyonLFxuICAgICAgICBdLmZpbHRlcihhcm4gPT4gYXJuICE9PSAnKicpLFxuICAgICAgfSkpO1xuICAgIH1cblxuICAgIHJldHVybiByb2xlO1xuICB9XG5cbiAgLyoqXG4gICAqIENsb3VkV2F0Y2ggTG9nc+ODreOCsOOCsOODq+ODvOODl+OCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVMb2dHcm91cChwcm9wczogQmVkcm9ja0FnZW50Q29yZUdhdGV3YXlDb25zdHJ1Y3RQcm9wcyk6IGxvZ3MuTG9nR3JvdXAge1xuICAgIHJldHVybiBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2JlZHJvY2stYWdlbnQtY29yZS9nYXRld2F5LyR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIHJldGVudGlvbjogcHJvcHMubG9nUmV0ZW50aW9uRGF5cyA/PyBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgZW5jcnlwdGlvbktleTogdGhpcy5lbmNyeXB0aW9uS2V5LFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJFU1QgQVBJ5aSJ5o+bTGFtYmRh6Zai5pWw44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVJlc3RBcGlDb252ZXJ0ZXJGdW5jdGlvbihwcm9wczogQmVkcm9ja0FnZW50Q29yZUdhdGV3YXlDb25zdHJ1Y3RQcm9wcyk6IGxhbWJkYS5GdW5jdGlvbiB7XG4gICAgaWYgKCFwcm9wcy5yZXN0QXBpQ29udmVyc2lvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdSRVNUIEFQSeWkieaPm+ioreWumuOBjOaMh+WumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbmZpZyA9IHByb3BzLnJlc3RBcGlDb252ZXJzaW9uO1xuXG4gICAgLy8g55Kw5aKD5aSJ5pWw44Gu5rqW5YKZXG4gICAgY29uc3QgZW52aXJvbm1lbnQ6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG4gICAgICBQUk9KRUNUX05BTUU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgT1BFTkFQSV9TUEVDX1BBVEg6IGNvbmZpZy5vcGVuQXBpU3BlY1BhdGgsXG4gICAgfTtcblxuICAgIC8vIEFQSSBHYXRld2F557Wx5ZCI6Kit5a6aXG4gICAgaWYgKGNvbmZpZy5hcGlHYXRld2F5SW50ZWdyYXRpb24pIHtcbiAgICAgIGVudmlyb25tZW50LkFQSV9HQVRFV0FZX0lEID0gY29uZmlnLmFwaUdhdGV3YXlJbnRlZ3JhdGlvbi5hcGlJZDtcbiAgICAgIGVudmlyb25tZW50LkFQSV9HQVRFV0FZX1NUQUdFID0gY29uZmlnLmFwaUdhdGV3YXlJbnRlZ3JhdGlvbi5zdGFnZU5hbWU7XG4gICAgICBpZiAoY29uZmlnLmFwaUdhdGV3YXlJbnRlZ3JhdGlvbi5hdXRoVHlwZSkge1xuICAgICAgICBlbnZpcm9ubWVudC5BVVRIX1RZUEUgPSBjb25maWcuYXBpR2F0ZXdheUludGVncmF0aW9uLmF1dGhUeXBlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOWkieaPm+OCquODl+OCt+ODp+ODs1xuICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMpIHtcbiAgICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMuYXV0b0dlbmVyYXRlVG9vbERlZmluaXRpb25zICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuQVVUT19HRU5FUkFURV9UT09MUyA9IFN0cmluZyhjb25maWcuY29udmVyc2lvbk9wdGlvbnMuYXV0b0dlbmVyYXRlVG9vbERlZmluaXRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMudG9vbE5hbWVQcmVmaXgpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuVE9PTF9OQU1FX1BSRUZJWCA9IGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy50b29sTmFtZVByZWZpeDtcbiAgICAgIH1cbiAgICAgIGlmIChjb25maWcuY29udmVyc2lvbk9wdGlvbnMuZXhjbHVkZVBhdHRlcm5zKSB7XG4gICAgICAgIGVudmlyb25tZW50LkVYQ0xVREVfUEFUVEVSTlMgPSBKU09OLnN0cmluZ2lmeShjb25maWcuY29udmVyc2lvbk9wdGlvbnMuZXhjbHVkZVBhdHRlcm5zKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBMYW1iZGHplqLmlbDjga7kvZzmiJBcbiAgICBjb25zdCBmbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1Jlc3RBcGlDb252ZXJ0ZXJGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEvYWdlbnQtY29yZS1nYXRld2F5L3Jlc3QtYXBpLWNvbnZlcnRlcicpLFxuICAgICAgcm9sZTogdGhpcy5leGVjdXRpb25Sb2xlLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsb2dHcm91cDogdGhpcy5sb2dHcm91cCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgUkVTVCBBUEkgQ29udmVydGVyIGZvciAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fSBCZWRyb2NrIEFnZW50Q29yZSBHYXRld2F5YCxcbiAgICB9KTtcblxuICAgIC8vIFMz6Kqt44G/5Y+W44KK5qip6ZmQ44Gu6L+95Yqg77yIT3BlbkFQSeS7leanmOOBjFMz44Gr44GC44KL5aC05ZCI77yJXG4gICAgaWYgKGNvbmZpZy5vcGVuQXBpU3BlY1BhdGguc3RhcnRzV2l0aCgnczM6Ly8nKSkge1xuICAgICAgY29uc3QgbWF0Y2ggPSBjb25maWcub3BlbkFwaVNwZWNQYXRoLm1hdGNoKC9eczM6XFwvXFwvKFteXFwvXSspXFwvLyk7XG4gICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgY29uc3QgYnVja2V0TmFtZSA9IG1hdGNoWzFdO1xuICAgICAgICBmbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgICAgICdzMzpHZXRPYmplY3RWZXJzaW9uJyxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOnMzOjo6JHtidWNrZXROYW1lfS8qYF0sXG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZm47XG4gIH1cblxuICAvKipcbiAgICogTGFtYmRh6Zai5pWw5aSJ5o+bTGFtYmRh6Zai5pWw44KS5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUxhbWJkYUNvbnZlcnRlckZ1bmN0aW9uKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlR2F0ZXdheUNvbnN0cnVjdFByb3BzKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBpZiAoIXByb3BzLmxhbWJkYUZ1bmN0aW9uQ29udmVyc2lvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdMYW1iZGHplqLmlbDlpInmj5voqK3lrprjgYzmjIflrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb25maWcgPSBwcm9wcy5sYW1iZGFGdW5jdGlvbkNvbnZlcnNpb247XG5cbiAgICAvLyDnkrDlooPlpInmlbDjga7mupblgplcbiAgICBjb25zdCBlbnZpcm9ubWVudDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHtcbiAgICAgIFBST0pFQ1RfTkFNRTogcHJvcHMucHJvamVjdE5hbWUsXG4gICAgICBFTlZJUk9OTUVOVDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgfTtcblxuICAgIC8vIOODoeOCv+ODh+ODvOOCv+OCveODvOOCueioreWumlxuICAgIGlmIChjb25maWcubWV0YWRhdGFTb3VyY2UpIHtcbiAgICAgIGlmIChjb25maWcubWV0YWRhdGFTb3VyY2UudXNlVGFncyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGVudmlyb25tZW50LlVTRV9UQUdTID0gU3RyaW5nKGNvbmZpZy5tZXRhZGF0YVNvdXJjZS51c2VUYWdzKTtcbiAgICAgIH1cbiAgICAgIGlmIChjb25maWcubWV0YWRhdGFTb3VyY2UudXNlRW52aXJvbm1lbnRWYXJpYWJsZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBlbnZpcm9ubWVudC5VU0VfRU5WX1ZBUlMgPSBTdHJpbmcoY29uZmlnLm1ldGFkYXRhU291cmNlLnVzZUVudmlyb25tZW50VmFyaWFibGVzKTtcbiAgICAgIH1cbiAgICAgIGlmIChjb25maWcubWV0YWRhdGFTb3VyY2UuY3VzdG9tTWV0YWRhdGFQcm92aWRlcikge1xuICAgICAgICBlbnZpcm9ubWVudC5DVVNUT01fTUVUQURBVEFfUFJPVklERVIgPSBjb25maWcubWV0YWRhdGFTb3VyY2UuY3VzdG9tTWV0YWRhdGFQcm92aWRlcjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDlpInmj5vjgqrjg5fjgrfjg6fjg7NcbiAgICBpZiAoY29uZmlnLmNvbnZlcnNpb25PcHRpb25zKSB7XG4gICAgICBpZiAoY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLmF1dG9HZW5lcmF0ZVRvb2xEZWZpbml0aW9ucyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGVudmlyb25tZW50LkFVVE9fR0VORVJBVEVfVE9PTFMgPSBTdHJpbmcoY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLmF1dG9HZW5lcmF0ZVRvb2xEZWZpbml0aW9ucyk7XG4gICAgICB9XG4gICAgICBpZiAoY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLnRvb2xOYW1lUHJlZml4KSB7XG4gICAgICAgIGVudmlyb25tZW50LlRPT0xfTkFNRV9QUkVGSVggPSBjb25maWcuY29udmVyc2lvbk9wdGlvbnMudG9vbE5hbWVQcmVmaXg7XG4gICAgICB9XG4gICAgICBpZiAoY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLnRpbWVvdXQpIHtcbiAgICAgICAgZW52aXJvbm1lbnQuQ09OVkVSU0lPTl9USU1FT1VUID0gU3RyaW5nKGNvbmZpZy5jb252ZXJzaW9uT3B0aW9ucy50aW1lb3V0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBMYW1iZGHplqLmlbDjga7kvZzmiJBcbiAgICBjb25zdCBmbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xhbWJkYUNvbnZlcnRlckZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hZ2VudC1jb3JlLWdhdGV3YXkvbGFtYmRhLWZ1bmN0aW9uLWNvbnZlcnRlcicpLFxuICAgICAgcm9sZTogdGhpcy5leGVjdXRpb25Sb2xlLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyhjb25maWcuY29udmVyc2lvbk9wdGlvbnM/LnRpbWVvdXQgfHwgNjApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgbG9nR3JvdXA6IHRoaXMubG9nR3JvdXAsXG4gICAgICBkZXNjcmlwdGlvbjogYExhbWJkYSBGdW5jdGlvbiBDb252ZXJ0ZXIgZm9yICR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9IEJlZHJvY2sgQWdlbnRDb3JlIEdhdGV3YXlgLFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRh6Zai5pWw44Oh44K/44OH44O844K/5Y+W5b6X5qip6ZmQ44Gu6L+95YqgXG4gICAgZm4uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2xhbWJkYTpHZXRGdW5jdGlvbicsXG4gICAgICAgICdsYW1iZGE6R2V0RnVuY3Rpb25Db25maWd1cmF0aW9uJyxcbiAgICAgICAgJ2xhbWJkYTpMaXN0VGFncycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBjb25maWcuZnVuY3Rpb25Bcm5zLFxuICAgIH0pKTtcblxuICAgIC8vIExhbWJkYemWouaVsOWRvOOBs+WHuuOBl+aoqemZkOOBrui/veWKoO+8iOOCq+OCueOCv+ODoOODoeOCv+ODh+ODvOOCv+ODl+ODreODkOOCpOODgOODvOOBjOOBguOCi+WgtOWQiO+8iVxuICAgIGlmIChjb25maWcubWV0YWRhdGFTb3VyY2U/LmN1c3RvbU1ldGFkYXRhUHJvdmlkZXIpIHtcbiAgICAgIGZuLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdsYW1iZGE6SW52b2tlRnVuY3Rpb24nLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtjb25maWcubWV0YWRhdGFTb3VyY2UuY3VzdG9tTWV0YWRhdGFQcm92aWRlcl0sXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgLyoqXG4gICAqIE1DUOOCteODvOODkOODvOe1seWQiExhbWJkYemWouaVsOOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVNY3BJbnRlZ3JhdGlvbkZ1bmN0aW9uKHByb3BzOiBCZWRyb2NrQWdlbnRDb3JlR2F0ZXdheUNvbnN0cnVjdFByb3BzKTogbGFtYmRhLkZ1bmN0aW9uIHtcbiAgICBpZiAoIXByb3BzLm1jcFNlcnZlckludGVncmF0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01DUOOCteODvOODkOODvOe1seWQiOioreWumuOBjOaMh+WumuOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbmZpZyA9IHByb3BzLm1jcFNlcnZlckludGVncmF0aW9uO1xuXG4gICAgLy8g55Kw5aKD5aSJ5pWw44Gu5rqW5YKZXG4gICAgY29uc3QgZW52aXJvbm1lbnQ6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG4gICAgICBQUk9KRUNUX05BTUU6IHByb3BzLnByb2plY3ROYW1lLFxuICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgIH07XG5cbiAgICAvLyBXZWJTb2NrZXTntbHlkIjoqK3lrppcbiAgICBpZiAoY29uZmlnLndlYlNvY2tldENvbmZpZykge1xuICAgICAgaWYgKGNvbmZpZy53ZWJTb2NrZXRDb25maWcuY29ubmVjdGlvblRpbWVvdXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBlbnZpcm9ubWVudC5XU19DT05ORUNUSU9OX1RJTUVPVVQgPSBTdHJpbmcoY29uZmlnLndlYlNvY2tldENvbmZpZy5jb25uZWN0aW9uVGltZW91dCk7XG4gICAgICB9XG4gICAgICBpZiAoY29uZmlnLndlYlNvY2tldENvbmZpZy5yZWNvbm5lY3RDb25maWcpIHtcbiAgICAgICAgaWYgKGNvbmZpZy53ZWJTb2NrZXRDb25maWcucmVjb25uZWN0Q29uZmlnLm1heFJldHJpZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGVudmlyb25tZW50Lk1BWF9SRVRSWV9BVFRFTVBUUyA9IFN0cmluZyhjb25maWcud2ViU29ja2V0Q29uZmlnLnJlY29ubmVjdENvbmZpZy5tYXhSZXRyaWVzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29uZmlnLndlYlNvY2tldENvbmZpZy5yZWNvbm5lY3RDb25maWcucmV0cnlJbnRlcnZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZW52aXJvbm1lbnQuUkVUUllfSU5URVJWQUwgPSBTdHJpbmcoY29uZmlnLndlYlNvY2tldENvbmZpZy5yZWNvbm5lY3RDb25maWcucmV0cnlJbnRlcnZhbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDlpInmj5vjgqrjg5fjgrfjg6fjg7NcbiAgICBpZiAoY29uZmlnLmNvbnZlcnNpb25PcHRpb25zKSB7XG4gICAgICBpZiAoY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLmF1dG9HZW5lcmF0ZVRvb2xEZWZpbml0aW9ucyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGVudmlyb25tZW50LkFVVE9fR0VORVJBVEVfVE9PTFMgPSBTdHJpbmcoY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLmF1dG9HZW5lcmF0ZVRvb2xEZWZpbml0aW9ucyk7XG4gICAgICB9XG4gICAgICBpZiAoY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLnRvb2xOYW1lUHJlZml4KSB7XG4gICAgICAgIGVudmlyb25tZW50LlRPT0xfTkFNRV9QUkVGSVggPSBjb25maWcuY29udmVyc2lvbk9wdGlvbnMudG9vbE5hbWVQcmVmaXg7XG4gICAgICB9XG4gICAgICBpZiAoY29uZmlnLmNvbnZlcnNpb25PcHRpb25zLnRvb2xOYW1lRmlsdGVyKSB7XG4gICAgICAgIGVudmlyb25tZW50LlRPT0xfTkFNRV9GSUxURVIgPSBjb25maWcuY29udmVyc2lvbk9wdGlvbnMudG9vbE5hbWVGaWx0ZXI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTGFtYmRh6Zai5pWw44Gu5L2c5oiQXG4gICAgY29uc3QgZm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdNY3BJbnRlZ3JhdGlvbkZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS9hZ2VudC1jb3JlLWdhdGV3YXkvbWNwLXNlcnZlci1pbnRlZ3JhdGlvbicpLFxuICAgICAgcm9sZTogdGhpcy5leGVjdXRpb25Sb2xlLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsb2dHcm91cDogdGhpcy5sb2dHcm91cCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgTUNQIFNlcnZlciBJbnRlZ3JhdGlvbiBmb3IgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0gQmVkcm9jayBBZ2VudENvcmUgR2F0ZXdheWAsXG4gICAgfSk7XG5cbiAgICAvLyBTZWNyZXRzIE1hbmFnZXLoqq3jgb/lj5bjgormqKnpmZDjga7ov73liqDvvIjoqo3oqLzjgYzmnInlirnjgarloLTlkIjvvIlcbiAgICBpZiAoY29uZmlnLmF1dGhlbnRpY2F0aW9uKSB7XG4gICAgICBjb25zdCBzZWNyZXRBcm5zOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICBpZiAoY29uZmlnLmF1dGhlbnRpY2F0aW9uLmFwaUtleVNlY3JldEFybikge1xuICAgICAgICBzZWNyZXRBcm5zLnB1c2goY29uZmlnLmF1dGhlbnRpY2F0aW9uLmFwaUtleVNlY3JldEFybik7XG4gICAgICB9XG5cbiAgICAgIGlmIChjb25maWcuYXV0aGVudGljYXRpb24ub2F1dGgyQ29uZmlnPy5jbGllbnRTZWNyZXRBcm4pIHtcbiAgICAgICAgc2VjcmV0QXJucy5wdXNoKGNvbmZpZy5hdXRoZW50aWNhdGlvbi5vYXV0aDJDb25maWcuY2xpZW50U2VjcmV0QXJuKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNlY3JldEFybnMubGVuZ3RoID4gMCkge1xuICAgICAgICBmbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAnc2VjcmV0c21hbmFnZXI6R2V0U2VjcmV0VmFsdWUnLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVzb3VyY2VzOiBzZWNyZXRBcm5zLFxuICAgICAgICB9KSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZuO1xuICB9XG59XG4iXX0=