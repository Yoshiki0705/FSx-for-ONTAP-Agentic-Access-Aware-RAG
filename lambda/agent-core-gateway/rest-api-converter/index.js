"use strict";
/**
 * REST API Converter Lambda Function
 *
 * OpenAPI仕様をパースし、Bedrock Agent Tool定義に変換します。
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const client_s3_1 = require("@aws-sdk/client-s3");
const yaml = __importStar(require("js-yaml"));
// AWS SDK クライアント
const s3Client = new client_s3_1.S3Client({});
/**
 * 環境変数を取得
 */
function getEnvironmentVariables() {
    const projectName = process.env.PROJECT_NAME;
    const environment = process.env.ENVIRONMENT;
    const gatewaySpecsBucket = process.env.GATEWAY_SPECS_BUCKET;
    const openApiSpecKey = process.env.OPENAPI_SPEC_KEY;
    if (!projectName || !environment || !gatewaySpecsBucket || !openApiSpecKey) {
        throw new Error('必須環境変数が設定されていません: PROJECT_NAME, ENVIRONMENT, GATEWAY_SPECS_BUCKET, OPENAPI_SPEC_KEY');
    }
    return {
        PROJECT_NAME: projectName,
        ENVIRONMENT: environment,
        GATEWAY_SPECS_BUCKET: gatewaySpecsBucket,
        OPENAPI_SPEC_KEY: openApiSpecKey,
        FSX_FILE_SYSTEM_ID: process.env.FSX_FILE_SYSTEM_ID,
        API_GATEWAY_ID: process.env.API_GATEWAY_ID,
        API_GATEWAY_STAGE: process.env.API_GATEWAY_STAGE,
        AUTH_TYPE: process.env.AUTH_TYPE,
        AUTO_GENERATE_TOOLS: process.env.AUTO_GENERATE_TOOLS,
        TOOL_NAME_PREFIX: process.env.TOOL_NAME_PREFIX,
        EXCLUDE_PATTERNS: process.env.EXCLUDE_PATTERNS,
    };
}
/**
 * OpenAPI仕様を読み込む
 *
 * S3バケットから直接アクセスします。
 */
async function loadOpenApiSpec(bucketName, specKey) {
    console.log(`OpenAPI仕様を読み込み中: s3://${bucketName}/${specKey}`);
    // S3から取得
    const command = new client_s3_1.GetObjectCommand({
        Bucket: bucketName,
        Key: specKey,
    });
    const response = await s3Client.send(command);
    if (!response.Body) {
        throw new Error(`S3オブジェクトが見つかりません: s3://${bucketName}/${specKey}`);
    }
    const bodyString = await response.Body.transformToString();
    // YAML または JSON をパース
    if (specKey.endsWith('.yaml') || specKey.endsWith('.yml')) {
        return yaml.load(bodyString);
    }
    else {
        return JSON.parse(bodyString);
    }
}
/**
 * OpenAPI仕様をBedrock Agent Tool定義に変換
 */
function convertOpenApiToToolDefinitions(spec, options) {
    console.log('OpenAPI仕様をBedrock Agent Tool定義に変換中...');
    const toolDefinitions = [];
    const excludeRegexes = (options.excludePatterns || []).map(pattern => new RegExp(pattern));
    // 各パスを処理
    for (const [path, pathItem] of Object.entries(spec.paths)) {
        // 除外パターンにマッチする場合はスキップ
        if (excludeRegexes.some(regex => regex.test(path))) {
            console.log(`パスを除外: ${path}`);
            continue;
        }
        // 各HTTPメソッドを処理
        for (const [method, operation] of Object.entries(pathItem)) {
            if (!['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
                continue;
            }
            const toolName = generateToolName(operation.operationId || `${method}_${path}`, options.toolNamePrefix);
            const toolDefinition = {
                name: toolName,
                description: operation.description || operation.summary || `${method.toUpperCase()} ${path}`,
                inputSchema: generateInputSchema(operation),
                apiEndpoint: {
                    method: method.toUpperCase(),
                    path: path,
                    apiGatewayId: options.apiGatewayId,
                    stage: options.apiGatewayStage,
                },
            };
            toolDefinitions.push(toolDefinition);
            console.log(`Tool定義を生成: ${toolName}`);
        }
    }
    console.log(`合計 ${toolDefinitions.length} 個のTool定義を生成しました`);
    return toolDefinitions;
}
/**
 * Tool名を生成
 */
function generateToolName(operationId, prefix) {
    // operationIdをキャメルケースに変換
    let toolName = operationId
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    // プレフィックスを追加
    if (prefix) {
        toolName = `${prefix}_${toolName}`;
    }
    return toolName;
}
/**
 * Input Schemaを生成
 */
function generateInputSchema(operation) {
    const properties = {};
    const required = [];
    // パラメータを処理
    if (operation.parameters) {
        for (const param of operation.parameters) {
            properties[param.name] = {
                type: param.schema.type || 'string',
                description: param.description,
                ...(param.schema.enum && { enum: param.schema.enum }),
            };
            if (param.required) {
                required.push(param.name);
            }
        }
    }
    // Request Bodyを処理
    if (operation.requestBody) {
        const content = operation.requestBody.content['application/json'];
        if (content && content.schema) {
            // Request Bodyのスキーマをプロパティに追加
            if (content.schema.properties) {
                Object.assign(properties, content.schema.properties);
            }
            // 必須フィールドを追加
            if (content.schema.required) {
                required.push(...content.schema.required);
            }
        }
    }
    return {
        type: 'object',
        properties,
        ...(required.length > 0 && { required }),
    };
}
/**
 * エラーレスポンスを生成
 */
function createErrorResponse(error) {
    console.error('エラーが発生しました:', error);
    return {
        success: false,
        message: 'REST API変換に失敗しました',
        error: error.message,
    };
}
/**
 * 成功レスポンスを生成
 */
function createSuccessResponse(toolDefinitions) {
    return {
        success: true,
        message: `${toolDefinitions.length} 個のTool定義を生成しました`,
        toolDefinitions,
    };
}
/**
 * Lambda ハンドラー
 */
async function handler(event) {
    console.log('REST API Converter Lambda開始');
    console.log('イベント:', JSON.stringify(event, null, 2));
    try {
        // 環境変数を取得
        const env = getEnvironmentVariables();
        // OpenAPI仕様キーを決定
        const specKey = event.openApiSpecPath
            ? event.openApiSpecPath.replace(/^s3:\/\/[^\/]+\//, '') // S3 URIからキーを抽出
            : env.OPENAPI_SPEC_KEY;
        // OpenAPI仕様を読み込む（S3バケットから直接）
        const spec = await loadOpenApiSpec(env.GATEWAY_SPECS_BUCKET, specKey);
        // 変換オプションを決定
        const conversionOptions = {
            toolNamePrefix: event.conversionOptions?.toolNamePrefix || env.TOOL_NAME_PREFIX,
            excludePatterns: event.conversionOptions?.excludePatterns ||
                (env.EXCLUDE_PATTERNS ? JSON.parse(env.EXCLUDE_PATTERNS) : []),
            apiGatewayId: event.apiGatewayId || env.API_GATEWAY_ID,
            apiGatewayStage: event.apiGatewayStage || env.API_GATEWAY_STAGE,
        };
        // OpenAPI仕様をBedrock Agent Tool定義に変換
        const toolDefinitions = convertOpenApiToToolDefinitions(spec, conversionOptions);
        // 成功レスポンスを返す
        return createSuccessResponse(toolDefinitions);
    }
    catch (error) {
        // エラーレスポンスを返す
        return createErrorResponse(error);
    }
}
//# sourceMappingURL=index.js.map