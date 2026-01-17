/**
 * REST API Converter Lambda Function
 * 
 * OpenAPI仕様をパースし、Bedrock Agent Tool定義に変換します。
 * 
 * @author Kiro AI
 * @date 2026-01-03
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as yaml from 'js-yaml';

/**
 * 環境変数
 */
interface EnvironmentVariables {
  PROJECT_NAME: string;
  ENVIRONMENT: string;
  OPENAPI_SPEC_PATH: string;
  FSX_ONTAP_ACCESS_POINT_ARN: string;  // FSx for ONTAP + S3 Access Points統合
  API_GATEWAY_ID?: string;
  API_GATEWAY_STAGE?: string;
  AUTH_TYPE?: string;
  AUTO_GENERATE_TOOLS?: string;
  TOOL_NAME_PREFIX?: string;
  EXCLUDE_PATTERNS?: string;
}

/**
 * Lambda イベント
 */
interface RestApiConverterEvent {
  openApiSpecPath?: string;
  apiGatewayId?: string;
  apiGatewayStage?: string;
  authType?: 'IAM' | 'COGNITO' | 'API_KEY' | 'NONE';
  conversionOptions?: {
    autoGenerateToolDefinitions?: boolean;
    toolNamePrefix?: string;
    excludePatterns?: string[];
  };
}

/**
 * Lambda レスポンス
 */
interface RestApiConverterResponse {
  success: boolean;
  message: string;
  toolDefinitions?: ToolDefinition[];
  error?: string;
}

/**
 * Bedrock Agent Tool定義
 */
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  apiEndpoint: {
    method: string;
    path: string;
    apiGatewayId?: string;
    stage?: string;
  };
}

/**
 * OpenAPI仕様
 */
interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, Record<string, PathItem>>;
  components?: {
    schemas?: Record<string, any>;
  };
}

/**
 * OpenAPI Path Item
 */
interface PathItem {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
}

/**
 * OpenAPI Parameter
 */
interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema: any;
}

/**
 * OpenAPI Request Body
 */
interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, {
    schema: any;
  }>;
}

/**
 * OpenAPI Response
 */
interface Response {
  description: string;
  content?: Record<string, {
    schema: any;
  }>;
}

// AWS SDK クライアント
const s3Client = new S3Client({});

/**
 * 環境変数を取得
 */
function getEnvironmentVariables(): EnvironmentVariables {
  const projectName = process.env.PROJECT_NAME;
  const environment = process.env.ENVIRONMENT;
  const openApiSpecPath = process.env.OPENAPI_SPEC_PATH;
  const fsxOntapAccessPointArn = process.env.FSX_ONTAP_ACCESS_POINT_ARN;

  if (!projectName || !environment || !openApiSpecPath || !fsxOntapAccessPointArn) {
    throw new Error('必須環境変数が設定されていません: PROJECT_NAME, ENVIRONMENT, OPENAPI_SPEC_PATH, FSX_ONTAP_ACCESS_POINT_ARN');
  }

  return {
    PROJECT_NAME: projectName,
    ENVIRONMENT: environment,
    OPENAPI_SPEC_PATH: openApiSpecPath,
    FSX_ONTAP_ACCESS_POINT_ARN: fsxOntapAccessPointArn,
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
 * FSx for ONTAP + S3 Access Points経由でアクセスします。
 * S3バケットへの直接アクセスは行いません。
 */
async function loadOpenApiSpec(
  specPath: string,
  fsxOntapAccessPointArn: string
): Promise<OpenApiSpec> {
  console.log(`OpenAPI仕様を読み込み中: ${specPath}`);
  console.log(`FSx for ONTAP Access Point ARN: ${fsxOntapAccessPointArn}`);

  // S3 Access Point ARN経由でアクセス
  if (specPath.startsWith('s3://')) {
    // S3 URIからキーを抽出
    const match = specPath.match(/^s3:\/\/[^\/]+\/(.+)$/);
    if (!match) {
      throw new Error(`無効なS3 URI: ${specPath}`);
    }

    const key = match[1];

    // FSx for ONTAP + S3 Access Points経由でアクセス
    const command = new GetObjectCommand({
      Bucket: fsxOntapAccessPointArn,  // S3 Access Point ARNを使用
      Key: key,
    });
    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error(`S3オブジェクトが見つかりません: ${specPath}`);
    }

    const bodyString = await response.Body.transformToString();

    // YAML または JSON をパース
    if (key.endsWith('.yaml') || key.endsWith('.yml')) {
      return yaml.load(bodyString) as OpenApiSpec;
    } else {
      return JSON.parse(bodyString) as OpenApiSpec;
    }
  }

  // ローカルファイルの場合（Lambda環境では使用不可）
  throw new Error('ローカルファイルパスはサポートされていません。S3 URIを使用してください。');
}

/**
 * OpenAPI仕様をBedrock Agent Tool定義に変換
 */
function convertOpenApiToToolDefinitions(
  spec: OpenApiSpec,
  options: {
    toolNamePrefix?: string;
    excludePatterns?: string[];
    apiGatewayId?: string;
    apiGatewayStage?: string;
  }
): ToolDefinition[] {
  console.log('OpenAPI仕様をBedrock Agent Tool定義に変換中...');

  const toolDefinitions: ToolDefinition[] = [];
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

      const toolName = generateToolName(
        operation.operationId || `${method}_${path}`,
        options.toolNamePrefix
      );

      const toolDefinition: ToolDefinition = {
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
function generateToolName(operationId: string, prefix?: string): string {
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
function generateInputSchema(operation: PathItem): {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
} {
  const properties: Record<string, any> = {};
  const required: string[] = [];

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
function createErrorResponse(error: Error): RestApiConverterResponse {
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
function createSuccessResponse(toolDefinitions: ToolDefinition[]): RestApiConverterResponse {
  return {
    success: true,
    message: `${toolDefinitions.length} 個のTool定義を生成しました`,
    toolDefinitions,
  };
}

/**
 * Lambda ハンドラー
 */
export async function handler(event: RestApiConverterEvent): Promise<RestApiConverterResponse> {
  console.log('REST API Converter Lambda開始');
  console.log('イベント:', JSON.stringify(event, null, 2));

  try {
    // 環境変数を取得
    const env = getEnvironmentVariables();

    // OpenAPI仕様パスを決定
    const specPath = event.openApiSpecPath || env.OPENAPI_SPEC_PATH;

    // OpenAPI仕様を読み込む（FSx for ONTAP + S3 Access Points経由）
    const spec = await loadOpenApiSpec(specPath, env.FSX_ONTAP_ACCESS_POINT_ARN);

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

  } catch (error) {
    // エラーレスポンスを返す
    return createErrorResponse(error as Error);
  }
}
