"use strict";
/**
 * Amazon Bedrock AgentCore Runtime Lambda Handler
 *
 * このLambda関数は、Bedrock Agentのイベント駆動実行を処理します。
 * EventBridgeからのイベントを受け取り、Bedrock Agentを呼び出します。
 *
 * @author Kiro AI
 * @date 2026-01-03
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const client_bedrock_agent_runtime_1 = require("@aws-sdk/client-bedrock-agent-runtime");
/**
 * 環境変数を取得
 */
function getEnvironmentVariables() {
    const env = {
        PROJECT_NAME: process.env.PROJECT_NAME || 'unknown',
        ENVIRONMENT: process.env.ENVIRONMENT || 'dev',
        BEDROCK_REGION: process.env.BEDROCK_REGION || 'ap-northeast-1',
        BEDROCK_AGENT_ID: process.env.BEDROCK_AGENT_ID,
        BEDROCK_AGENT_ALIAS_ID: process.env.BEDROCK_AGENT_ALIAS_ID,
    };
    console.log('環境変数:', {
        PROJECT_NAME: env.PROJECT_NAME,
        ENVIRONMENT: env.ENVIRONMENT,
        BEDROCK_REGION: env.BEDROCK_REGION,
        BEDROCK_AGENT_ID: env.BEDROCK_AGENT_ID ? '設定済み' : '未設定',
        BEDROCK_AGENT_ALIAS_ID: env.BEDROCK_AGENT_ALIAS_ID ? '設定済み' : '未設定',
    });
    return env;
}
/**
 * イベントからパラメータを抽出
 */
function extractParameters(event, env) {
    // EventBridgeイベントの場合
    const detail = event.detail || {};
    // パラメータ抽出（優先順位: イベント > 環境変数）
    const agentId = detail.agentId || event.agentId || env.BEDROCK_AGENT_ID;
    const agentAliasId = detail.agentAliasId || event.agentAliasId || env.BEDROCK_AGENT_ALIAS_ID;
    const sessionId = detail.sessionId || event.sessionId || `session-${Date.now()}`;
    const inputText = detail.inputText || event.inputText || '';
    const enableTrace = detail.enableTrace ?? event.enableTrace ?? false;
    const endSession = detail.endSession ?? event.endSession ?? false;
    // 必須パラメータの検証
    if (!agentId) {
        throw new Error('BEDROCK_AGENT_ID が設定されていません');
    }
    if (!agentAliasId) {
        throw new Error('BEDROCK_AGENT_ALIAS_ID が設定されていません');
    }
    if (!inputText) {
        throw new Error('inputText が指定されていません');
    }
    console.log('パラメータ:', {
        agentId,
        agentAliasId,
        sessionId,
        inputText: inputText.substring(0, 100) + (inputText.length > 100 ? '...' : ''),
        enableTrace,
        endSession,
    });
    return {
        agentId,
        agentAliasId,
        sessionId,
        inputText,
        enableTrace,
        endSession,
    };
}
/**
 * Bedrock Agent を呼び出し
 */
async function invokeBedrockAgent(client, params) {
    const startTime = Date.now();
    const input = {
        agentId: params.agentId,
        agentAliasId: params.agentAliasId,
        sessionId: params.sessionId,
        inputText: params.inputText,
        enableTrace: params.enableTrace,
        endSession: params.endSession,
    };
    console.log('Bedrock Agent呼び出し開始:', {
        agentId: params.agentId,
        agentAliasId: params.agentAliasId,
        sessionId: params.sessionId,
    });
    try {
        const command = new client_bedrock_agent_runtime_1.InvokeAgentCommand(input);
        const response = await client.send(command);
        // レスポンスストリームを処理
        let completion = '';
        const trace = [];
        if (response.completion) {
            for await (const event of response.completion) {
                // チャンクイベント
                if (event.chunk) {
                    const chunkBytes = event.chunk.bytes;
                    if (chunkBytes) {
                        const chunkText = new TextDecoder().decode(chunkBytes);
                        completion += chunkText;
                    }
                }
                // トレースイベント
                if (event.trace && params.enableTrace) {
                    trace.push(event.trace);
                }
            }
        }
        const executionTime = Date.now() - startTime;
        console.log('Bedrock Agent呼び出し完了:', {
            executionTime: `${executionTime}ms`,
            completionLength: completion.length,
            traceCount: trace.length,
        });
        return { completion, trace };
    }
    catch (error) {
        const executionTime = Date.now() - startTime;
        console.error('Bedrock Agent呼び出しエラー:', {
            executionTime: `${executionTime}ms`,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
/**
 * エラーレスポンスを生成
 */
function createErrorResponse(error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? error.stack : undefined;
    console.error('エラーレスポンス生成:', {
        error: errorMessage,
        details: errorDetails,
    });
    const errorResponse = {
        error: 'InternalServerError',
        message: errorMessage,
        details: errorDetails,
    };
    return {
        statusCode: 500,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorResponse),
    };
}
/**
 * 成功レスポンスを生成
 */
function createSuccessResponse(sessionId, completion, trace, metadata) {
    const successResponse = {
        sessionId,
        completion,
        trace: trace.length > 0 ? trace : undefined,
        metadata,
    };
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(successResponse),
    };
}
/**
 * Lambda ハンドラー
 */
async function handler(event) {
    const startTime = Date.now();
    console.log('Lambda関数開始:', {
        timestamp: new Date().toISOString(),
        event: JSON.stringify(event, null, 2),
    });
    try {
        // 環境変数取得
        const env = getEnvironmentVariables();
        // パラメータ抽出
        const params = extractParameters(event, env);
        // Bedrock Agent Runtime クライアント作成
        const client = new client_bedrock_agent_runtime_1.BedrockAgentRuntimeClient({
            region: env.BEDROCK_REGION,
        });
        // Bedrock Agent 呼び出し
        const { completion, trace } = await invokeBedrockAgent(client, params);
        // 成功レスポンス生成
        const executionTime = Date.now() - startTime;
        const response = createSuccessResponse(params.sessionId, completion, trace, {
            agentId: params.agentId,
            agentAliasId: params.agentAliasId,
            executionTime,
        });
        console.log('Lambda関数完了:', {
            timestamp: new Date().toISOString(),
            executionTime: `${executionTime}ms`,
            statusCode: response.statusCode,
        });
        return response;
    }
    catch (error) {
        const executionTime = Date.now() - startTime;
        console.error('Lambda関数エラー:', {
            timestamp: new Date().toISOString(),
            executionTime: `${executionTime}ms`,
            error: error instanceof Error ? error.message : String(error),
        });
        return createErrorResponse(error);
    }
}
//# sourceMappingURL=index.js.map