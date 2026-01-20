"use strict";
/**
 * Lambda Function Converter for Bedrock Agent Gateway
 *
 * このLambda関数は、既存のLambda関数をBedrock Agent Toolに変換します。
 * Lambda関数のメタデータを取得し、Bedrock Agent Tool定義を生成します。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const client_lambda_1 = require("@aws-sdk/client-lambda");
// ================================================================================
// 環境変数取得
// ================================================================================
/**
 * 環境変数を取得
 */
function getEnvironmentVariables() {
    const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
    const PROJECT_NAME = process.env.PROJECT_NAME || 'bedrock-agent-core';
    const ENVIRONMENT = process.env.ENVIRONMENT || 'development';
    return {
        AWS_REGION,
        PROJECT_NAME,
        ENVIRONMENT,
    };
}
// ================================================================================
// Lambda関数メタデータ取得
// ================================================================================
/**
 * Lambda関数のメタデータを取得
 */
async function getLambdaFunctionMetadata(lambdaClient, functionName) {
    try {
        // 関数の設定を取得
        const configCommand = new client_lambda_1.GetFunctionConfigurationCommand({
            FunctionName: functionName,
        });
        const configResponse = await lambdaClient.send(configCommand);
        // 関数の詳細を取得
        const functionCommand = new client_lambda_1.GetFunctionCommand({
            FunctionName: functionName,
        });
        const functionResponse = await lambdaClient.send(functionCommand);
        // タグを取得
        let tags = {};
        if (functionResponse.Configuration?.FunctionArn) {
            try {
                const tagsCommand = new client_lambda_1.ListTagsCommand({
                    Resource: functionResponse.Configuration.FunctionArn,
                });
                const tagsResponse = await lambdaClient.send(tagsCommand);
                tags = tagsResponse.Tags || {};
            }
            catch (error) {
                console.warn('タグの取得に失敗しました:', error);
            }
        }
        return {
            functionName: configResponse.FunctionName || functionName,
            functionArn: configResponse.FunctionArn || '',
            description: configResponse.Description,
            environment: configResponse.Environment?.Variables,
            tags,
            runtime: configResponse.Runtime,
            memorySize: configResponse.MemorySize,
            timeout: configResponse.Timeout,
        };
    }
    catch (error) {
        console.error('Lambda関数メタデータの取得に失敗しました:', error);
        throw new Error(`Lambda関数メタデータの取得に失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// ================================================================================
// Tool名生成
// ================================================================================
/**
 * Lambda関数名からTool名を生成
 */
function generateToolName(functionName, customToolName) {
    if (customToolName) {
        return customToolName;
    }
    // Lambda関数名をキャメルケースに変換
    // 例: "my-lambda-function" -> "myLambdaFunction"
    return functionName
        .split(/[-_]/)
        .map((part, index) => {
        if (index === 0) {
            return part.toLowerCase();
        }
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
        .join('');
}
// ================================================================================
// Tool説明生成
// ================================================================================
/**
 * Lambda関数からTool説明を生成
 */
function generateToolDescription(metadata, customDescription) {
    if (customDescription) {
        return customDescription;
    }
    if (metadata.description) {
        return metadata.description;
    }
    // デフォルトの説明を生成
    return `Lambda関数 ${metadata.functionName} を実行します。`;
}
// ================================================================================
// Input Schema生成
// ================================================================================
/**
 * Lambda関数からInput Schemaを生成
 */
function generateInputSchema(metadata, method, manualSchema) {
    if (method === 'manual' && manualSchema) {
        return manualSchema;
    }
    if (method === 'tags' && metadata.tags) {
        // タグからInput Schemaを生成
        const schema = parseSchemaFromTags(metadata.tags);
        if (schema) {
            return schema;
        }
    }
    // 自動生成（デフォルト）
    return {
        type: 'object',
        properties: {
            input: {
                type: 'object',
                description: 'Lambda関数への入力パラメータ',
                additionalProperties: true,
            },
        },
        required: [],
    };
}
/**
 * タグからInput Schemaをパース
 */
function parseSchemaFromTags(tags) {
    try {
        // タグ "InputSchema" からJSONをパース
        if (tags.InputSchema) {
            return JSON.parse(tags.InputSchema);
        }
        // タグ "input-schema" からJSONをパース
        if (tags['input-schema']) {
            return JSON.parse(tags['input-schema']);
        }
        return null;
    }
    catch (error) {
        console.warn('タグからInput Schemaのパースに失敗しました:', error);
        return null;
    }
}
// ================================================================================
// Tool定義生成
// ================================================================================
/**
 * Bedrock Agent Tool定義を生成
 */
function generateToolDefinition(metadata, event) {
    const toolName = generateToolName(metadata.functionName, event.toolName);
    const description = generateToolDescription(metadata, event.description);
    const inputSchema = generateInputSchema(metadata, event.schemaGenerationMethod || 'auto', event.inputSchema);
    return {
        name: toolName,
        description,
        inputSchema: {
            json: inputSchema,
        },
    };
}
// ================================================================================
// レスポンス生成
// ================================================================================
/**
 * エラーレスポンスを生成
 */
function createErrorResponse(errorCode, errorMessage) {
    return {
        success: false,
        error: errorMessage,
        errorCode,
    };
}
/**
 * 成功レスポンスを生成
 */
function createSuccessResponse(toolDefinition) {
    return {
        success: true,
        toolDefinition,
    };
}
// ================================================================================
// Lambda Handler
// ================================================================================
/**
 * Lambda Handler
 */
async function handler(event) {
    console.log('Lambda Function Converter開始:', JSON.stringify(event, null, 2));
    try {
        // 環境変数を取得
        const env = getEnvironmentVariables();
        console.log('環境変数:', env);
        // 入力検証
        if (!event.functionName) {
            return createErrorResponse('INVALID_INPUT', 'functionNameは必須です');
        }
        // Lambda Clientを初期化
        const lambdaClient = new client_lambda_1.LambdaClient({ region: env.AWS_REGION });
        // Lambda関数メタデータを取得
        console.log(`Lambda関数メタデータを取得中: ${event.functionName}`);
        const metadata = await getLambdaFunctionMetadata(lambdaClient, event.functionName);
        console.log('Lambda関数メタデータ:', JSON.stringify(metadata, null, 2));
        // Tool定義を生成
        console.log('Tool定義を生成中...');
        const toolDefinition = generateToolDefinition(metadata, event);
        console.log('Tool定義:', JSON.stringify(toolDefinition, null, 2));
        // 成功レスポンスを返す
        return createSuccessResponse(toolDefinition);
    }
    catch (error) {
        console.error('Lambda Function Converter エラー:', error);
        if (error instanceof Error) {
            return createErrorResponse('CONVERSION_ERROR', error.message);
        }
        return createErrorResponse('UNKNOWN_ERROR', 'Unknown error occurred');
    }
}
//# sourceMappingURL=index.js.map