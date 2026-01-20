"use strict";
/**
 * MCP Server Integration for Bedrock Agent Gateway
 *
 * このLambda関数は、MCPサーバーと統合してBedrock Agent Toolに変換します。
 * WebSocket接続を使用してMCP Tool定義を取得し、Bedrock Agent Tool定義を生成します。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
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
    const WS_CONNECTION_TIMEOUT = parseInt(process.env.WS_CONNECTION_TIMEOUT || '30', 10);
    const MAX_RETRY_ATTEMPTS = parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10);
    const RETRY_INTERVAL = parseInt(process.env.RETRY_INTERVAL || '1000', 10);
    return {
        AWS_REGION,
        PROJECT_NAME,
        ENVIRONMENT,
        WS_CONNECTION_TIMEOUT,
        MAX_RETRY_ATTEMPTS,
        RETRY_INTERVAL,
    };
}
// ================================================================================
// Secrets Manager統合
// ================================================================================
/**
 * Secrets Managerからシークレットを取得
 */
async function getSecret(secretsClient, secretArn) {
    try {
        const command = new client_secrets_manager_1.GetSecretValueCommand({
            SecretId: secretArn,
        });
        const response = await secretsClient.send(command);
        if (response.SecretString) {
            return response.SecretString;
        }
        throw new Error('SecretStringが見つかりません');
    }
    catch (error) {
        console.error('Secrets Managerからのシークレット取得に失敗しました:', error);
        throw new Error(`シークレット取得に失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// ================================================================================
// OAuth2トークン取得
// ================================================================================
/**
 * OAuth2アクセストークンを取得
 */
async function getOAuth2Token(secretsClient, oauth2Config) {
    try {
        // クライアントシークレットを取得
        const clientSecret = await getSecret(secretsClient, oauth2Config.clientSecretArn);
        // トークンエンドポイントにリクエスト
        const response = await fetch(oauth2Config.tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: oauth2Config.clientId,
                client_secret: clientSecret,
            }),
        });
        if (!response.ok) {
            throw new Error(`OAuth2トークン取得に失敗: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.access_token;
    }
    catch (error) {
        console.error('OAuth2トークン取得に失敗しました:', error);
        throw new Error(`OAuth2トークン取得に失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// ================================================================================
// MCPサーバー接続
// ================================================================================
/**
 * MCPサーバーに接続してTool定義を取得
 *
 * 注意: Lambda環境ではWebSocketの直接使用が制限されているため、
 * HTTP/HTTPSエンドポイント経由でMCP Tool定義を取得します。
 */
async function fetchMcpTools(event, secretsClient, env) {
    try {
        // 認証ヘッダーの準備
        const headers = {
            'Content-Type': 'application/json',
        };
        // 認証設定
        if (event.authenticationType === 'API_KEY' && event.apiKeySecretArn) {
            const apiKey = await getSecret(secretsClient, event.apiKeySecretArn);
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        else if (event.authenticationType === 'OAUTH2' && event.oauth2Config) {
            const accessToken = await getOAuth2Token(secretsClient, event.oauth2Config);
            headers['Authorization'] = `Bearer ${accessToken}`;
        }
        // MCPサーバーにリクエスト
        console.log(`MCPサーバーに接続中: ${event.serverEndpoint}`);
        const response = await fetch(`${event.serverEndpoint}/tools`, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(env.WS_CONNECTION_TIMEOUT * 1000),
        });
        if (!response.ok) {
            throw new Error(`MCPサーバーからのレスポンスエラー: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (data.type === 'error') {
            throw new Error(`MCPサーバーエラー: ${data.error}`);
        }
        if (!data.tools || data.tools.length === 0) {
            console.warn('MCPサーバーからTool定義が取得できませんでした');
            return [];
        }
        console.log(`MCPサーバーから${data.tools.length}個のTool定義を取得しました`);
        return data.tools;
    }
    catch (error) {
        console.error('MCPサーバーへの接続に失敗しました:', error);
        throw new Error(`MCPサーバー接続に失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// ================================================================================
// Tool名フィルター
// ================================================================================
/**
 * Tool名フィルターを適用
 */
function filterToolsByName(tools, filterPattern) {
    if (!filterPattern) {
        return tools;
    }
    try {
        const regex = new RegExp(filterPattern);
        return tools.filter(tool => regex.test(tool.name));
    }
    catch (error) {
        console.warn('Tool名フィルターの正規表現が無効です:', error);
        return tools;
    }
}
// ================================================================================
// Tool名生成
// ================================================================================
/**
 * MCP Tool名からBedrock Agent Tool名を生成
 */
function generateToolName(mcpToolName, prefix) {
    // プレフィックスを追加
    const nameWithPrefix = prefix ? `${prefix}${mcpToolName}` : mcpToolName;
    // キャメルケースに変換
    return nameWithPrefix
        .split(/[-_.]/)
        .map((part, index) => {
        if (index === 0) {
            return part.toLowerCase();
        }
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
        .join('');
}
// ================================================================================
// Input Schema生成
// ================================================================================
/**
 * MCP Tool定義からInput Schemaを生成
 */
function generateInputSchema(mcpTool) {
    // MCP Tool定義にInput Schemaが含まれている場合はそれを使用
    if (mcpTool.inputSchema) {
        return mcpTool.inputSchema;
    }
    // パラメータからInput Schemaを生成
    if (mcpTool.parameters && mcpTool.parameters.length > 0) {
        const properties = {};
        const required = [];
        mcpTool.parameters.forEach(param => {
            properties[param.name] = {
                type: param.type || 'string',
                description: param.description || `Parameter: ${param.name}`,
            };
            if (param.required) {
                required.push(param.name);
            }
        });
        return {
            type: 'object',
            properties,
            required,
        };
    }
    // デフォルトのInput Schema
    return {
        type: 'object',
        properties: {
            input: {
                type: 'object',
                description: 'MCP Tool への入力パラメータ',
                additionalProperties: true,
            },
        },
        required: [],
    };
}
// ================================================================================
// Tool定義変換
// ================================================================================
/**
 * MCP Tool定義をBedrock Agent Tool定義に変換
 */
function convertMcpToolToBedrockTool(mcpTool, toolNamePrefix) {
    const toolName = generateToolName(mcpTool.name, toolNamePrefix);
    const description = mcpTool.description || `MCP Tool: ${mcpTool.name}`;
    const inputSchema = generateInputSchema(mcpTool);
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
function createSuccessResponse(toolDefinitions, mcpToolsCount, filteredToolsCount) {
    return {
        success: true,
        toolDefinitions,
        statistics: {
            mcpToolsCount,
            bedrockToolsCount: toolDefinitions.length,
            filteredToolsCount,
        },
    };
}
// ================================================================================
// Lambda Handler
// ================================================================================
/**
 * Lambda Handler
 */
async function handler(event) {
    console.log('MCP Server Integration開始:', JSON.stringify(event, null, 2));
    try {
        // 環境変数を取得
        const env = getEnvironmentVariables();
        console.log('環境変数:', env);
        // 入力検証
        if (!event.serverEndpoint) {
            return createErrorResponse('INVALID_INPUT', 'serverEndpointは必須です');
        }
        // Secrets Manager Clientを初期化
        const secretsClient = new client_secrets_manager_1.SecretsManagerClient({ region: env.AWS_REGION });
        // MCPサーバーからTool定義を取得
        console.log('MCPサーバーからTool定義を取得中...');
        const mcpTools = await fetchMcpTools(event, secretsClient, env);
        if (mcpTools.length === 0) {
            return createSuccessResponse([], 0, 0);
        }
        // Tool名フィルターを適用
        const filteredTools = filterToolsByName(mcpTools, event.toolNameFilter);
        const filteredCount = mcpTools.length - filteredTools.length;
        if (filteredCount > 0) {
            console.log(`${filteredCount}個のToolがフィルターで除外されました`);
        }
        // Bedrock Agent Tool定義に変換
        console.log('Bedrock Agent Tool定義に変換中...');
        const toolDefinitions = filteredTools.map(mcpTool => convertMcpToolToBedrockTool(mcpTool, event.toolNamePrefix));
        console.log(`${toolDefinitions.length}個のBedrock Agent Tool定義を生成しました`);
        // 成功レスポンスを返す
        return createSuccessResponse(toolDefinitions, mcpTools.length, filteredCount);
    }
    catch (error) {
        console.error('MCP Server Integration エラー:', error);
        if (error instanceof Error) {
            return createErrorResponse('INTEGRATION_ERROR', error.message);
        }
        return createErrorResponse('UNKNOWN_ERROR', 'Unknown error occurred');
    }
}
//# sourceMappingURL=index.js.map