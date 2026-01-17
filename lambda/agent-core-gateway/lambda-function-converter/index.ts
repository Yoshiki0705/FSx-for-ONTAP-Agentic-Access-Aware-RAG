/**
 * Lambda Function Converter for Bedrock Agent Gateway
 * 
 * このLambda関数は、既存のLambda関数をBedrock Agent Toolに変換します。
 * Lambda関数のメタデータを取得し、Bedrock Agent Tool定義を生成します。
 */

import { 
  LambdaClient, 
  GetFunctionCommand, 
  GetFunctionConfigurationCommand,
  ListTagsCommand 
} from '@aws-sdk/client-lambda';

// ================================================================================
// 型定義
// ================================================================================

/**
 * Lambda Function Converter Event
 */
export interface LambdaFunctionConverterEvent {
  /** Lambda関数名またはARN */
  functionName: string;
  /** Tool名（オプション、指定しない場合は関数名から生成） */
  toolName?: string;
  /** Tool説明（オプション、指定しない場合は関数の説明から生成） */
  description?: string;
  /** Input Schemaの生成方法 */
  schemaGenerationMethod?: 'auto' | 'tags' | 'manual';
  /** 手動で指定するInput Schema（schemaGenerationMethod='manual'の場合） */
  inputSchema?: Record<string, any>;
}

/**
 * Lambda Function Converter Response
 */
export interface LambdaFunctionConverterResponse {
  /** 成功フラグ */
  success: boolean;
  /** 生成されたTool定義 */
  toolDefinition?: ToolDefinition;
  /** エラーメッセージ */
  error?: string;
  /** エラーコード */
  errorCode?: string;
}

/**
 * Bedrock Agent Tool定義
 */
export interface ToolDefinition {
  /** Tool名 */
  name: string;
  /** Tool説明 */
  description: string;
  /** Input Schema */
  inputSchema: {
    json: Record<string, any>;
  };
}

/**
 * Lambda関数メタデータ
 */
interface LambdaFunctionMetadata {
  /** 関数名 */
  functionName: string;
  /** 関数ARN */
  functionArn: string;
  /** 関数の説明 */
  description?: string;
  /** 環境変数 */
  environment?: Record<string, string>;
  /** タグ */
  tags?: Record<string, string>;
  /** ランタイム */
  runtime?: string;
  /** メモリサイズ */
  memorySize?: number;
  /** タイムアウト */
  timeout?: number;
}

/**
 * 環境変数
 */
interface EnvironmentVariables {
  /** AWSリージョン */
  AWS_REGION: string;
  /** プロジェクト名 */
  PROJECT_NAME: string;
  /** 環境名 */
  ENVIRONMENT: string;
}

// ================================================================================
// 環境変数取得
// ================================================================================

/**
 * 環境変数を取得
 */
function getEnvironmentVariables(): EnvironmentVariables {
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
async function getLambdaFunctionMetadata(
  lambdaClient: LambdaClient,
  functionName: string
): Promise<LambdaFunctionMetadata> {
  try {
    // 関数の設定を取得
    const configCommand = new GetFunctionConfigurationCommand({
      FunctionName: functionName,
    });
    const configResponse = await lambdaClient.send(configCommand);

    // 関数の詳細を取得
    const functionCommand = new GetFunctionCommand({
      FunctionName: functionName,
    });
    const functionResponse = await lambdaClient.send(functionCommand);

    // タグを取得
    let tags: Record<string, string> = {};
    if (functionResponse.Configuration?.FunctionArn) {
      try {
        const tagsCommand = new ListTagsCommand({
          Resource: functionResponse.Configuration.FunctionArn,
        });
        const tagsResponse = await lambdaClient.send(tagsCommand);
        tags = tagsResponse.Tags || {};
      } catch (error) {
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
  } catch (error) {
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
function generateToolName(functionName: string, customToolName?: string): string {
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
function generateToolDescription(
  metadata: LambdaFunctionMetadata,
  customDescription?: string
): string {
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
function generateInputSchema(
  metadata: LambdaFunctionMetadata,
  method: 'auto' | 'tags' | 'manual',
  manualSchema?: Record<string, any>
): Record<string, any> {
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
function parseSchemaFromTags(tags: Record<string, string>): Record<string, any> | null {
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
  } catch (error) {
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
function generateToolDefinition(
  metadata: LambdaFunctionMetadata,
  event: LambdaFunctionConverterEvent
): ToolDefinition {
  const toolName = generateToolName(metadata.functionName, event.toolName);
  const description = generateToolDescription(metadata, event.description);
  const inputSchema = generateInputSchema(
    metadata,
    event.schemaGenerationMethod || 'auto',
    event.inputSchema
  );

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
function createErrorResponse(errorCode: string, errorMessage: string): LambdaFunctionConverterResponse {
  return {
    success: false,
    error: errorMessage,
    errorCode,
  };
}

/**
 * 成功レスポンスを生成
 */
function createSuccessResponse(toolDefinition: ToolDefinition): LambdaFunctionConverterResponse {
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
export async function handler(event: LambdaFunctionConverterEvent): Promise<LambdaFunctionConverterResponse> {
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
    const lambdaClient = new LambdaClient({ region: env.AWS_REGION });

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
  } catch (error) {
    console.error('Lambda Function Converter エラー:', error);

    if (error instanceof Error) {
      return createErrorResponse('CONVERSION_ERROR', error.message);
    }

    return createErrorResponse('UNKNOWN_ERROR', 'Unknown error occurred');
  }
}
