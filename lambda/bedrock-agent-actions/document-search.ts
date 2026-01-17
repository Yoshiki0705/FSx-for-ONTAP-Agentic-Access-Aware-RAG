/**
 * Bedrock Agent Action Group: Document Search
 * 権限認識型文書検索Lambda関数
 */

import { Handler } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { OpenSearchClient, SearchCommand } from '@aws-sdk/client-opensearch';

// 環境変数
const USER_PERMISSIONS_TABLE = process.env.USER_PERMISSIONS_TABLE || '';
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT || '';
const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX || 'documents';

// AWSクライアント
const dynamoDbClient = new DynamoDBClient({});
const openSearchClient = new OpenSearchClient({});

/**
 * Bedrock Agent Actionイベント
 */
interface BedrockAgentEvent {
  messageVersion: string;
  agent: {
    name: string;
    id: string;
    alias: string;
    version: string;
  };
  inputText: string;
  sessionId: string;
  actionGroup: string;
  apiPath: string;
  httpMethod: string;
  parameters: Array<{
    name: string;
    type: string;
    value: string;
  }>;
  requestBody?: {
    content: {
      [key: string]: Array<{
        name: string;
        type: string;
        value: string;
      }>;
    };
  };
  sessionAttributes: {
    [key: string]: string;
  };
  promptSessionAttributes: {
    [key: string]: string;
  };
}

/**
 * Bedrock Agent Actionレスポンス
 */
interface BedrockAgentResponse {
  messageVersion: string;
  response: {
    actionGroup: string;
    apiPath: string;
    httpMethod: string;
    httpStatusCode: number;
    responseBody: {
      [key: string]: {
        body: string;
      };
    };
  };
  sessionAttributes?: {
    [key: string]: string;
  };
  promptSessionAttributes?: {
    [key: string]: string;
  };
}

/**
 * 文書検索結果
 */
interface DocumentSearchResult {
  documentId: string;
  title: string;
  content: string;
  score: number;
  lastModified: string;
  permissions: string[];
}

/**
 * Lambda Handler
 */
export const handler: Handler<BedrockAgentEvent, BedrockAgentResponse> = async (event) => {
  console.log('Bedrock Agent Event:', JSON.stringify(event, null, 2));

  try {
    // パラメータ抽出
    const query = getParameter(event, 'query');
    const maxResults = parseInt(getParameter(event, 'maxResults') || '5', 10);
    const userId = event.sessionAttributes.userId || 'anonymous';

    // ユーザー権限取得
    const userPermissions = await getUserPermissions(userId);
    console.log(`User ${userId} permissions:`, userPermissions);

    // 文書検索（権限フィルタ付き）
    const searchResults = await searchDocuments(query, userPermissions, maxResults);
    console.log(`Found ${searchResults.length} documents`);

    // レスポンス生成
    return createSuccessResponse(event, searchResults);
  } catch (error) {
    console.error('Error in document search:', error);
    return createErrorResponse(event, error as Error);
  }
};

/**
 * パラメータ取得
 */
function getParameter(event: BedrockAgentEvent, name: string): string {
  const param = event.parameters.find((p) => p.name === name);
  return param?.value || '';
}

/**
 * ユーザー権限取得
 */
async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const response = await dynamoDbClient.send(
      new GetItemCommand({
        TableName: USER_PERMISSIONS_TABLE,
        Key: {
          userId: { S: userId },
        },
      })
    );

    if (!response.Item || !response.Item.permissions) {
      console.log(`No permissions found for user ${userId}, using default`);
      return ['public'];
    }

    // DynamoDB形式からJavaScript配列に変換
    const permissions = response.Item.permissions.SS || response.Item.permissions.L?.map((item) => item.S || '') || [];
    return permissions;
  } catch (error) {
    console.error('Error getting user permissions:', error);
    // エラー時はpublicのみ許可
    return ['public'];
  }
}

/**
 * 文書検索（権限フィルタ付き）
 */
async function searchDocuments(
  query: string,
  userPermissions: string[],
  maxResults: number
): Promise<DocumentSearchResult[]> {
  try {
    // OpenSearch検索クエリ構築
    const searchQuery = {
      index: OPENSEARCH_INDEX,
      body: {
        size: maxResults,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: query,
                  fields: ['title^2', 'content'],
                  type: 'best_fields',
                  fuzziness: 'AUTO',
                },
              },
            ],
            filter: [
              {
                terms: {
                  permissions: userPermissions,
                },
              },
            ],
          },
        },
        _source: ['documentId', 'title', 'content', 'lastModified', 'permissions'],
        highlight: {
          fields: {
            content: {
              fragment_size: 150,
              number_of_fragments: 3,
            },
          },
        },
      },
    };

    // OpenSearch検索実行
    const response = await openSearchClient.send(
      new SearchCommand({
        ...searchQuery,
      } as any)
    );

    // 検索結果を変換
    const hits = (response as any).hits?.hits || [];
    return hits.map((hit: any) => ({
      documentId: hit._source.documentId,
      title: hit._source.title,
      content: hit.highlight?.content?.[0] || hit._source.content.substring(0, 300),
      score: hit._score,
      lastModified: hit._source.lastModified,
      permissions: hit._source.permissions,
    }));
  } catch (error) {
    console.error('Error searching documents:', error);
    throw new Error('文書検索中にエラーが発生しました');
  }
}

/**
 * 成功レスポンス生成
 */
function createSuccessResponse(event: BedrockAgentEvent, results: DocumentSearchResult[]): BedrockAgentResponse {
  return {
    messageVersion: '1.0',
    response: {
      actionGroup: event.actionGroup,
      apiPath: event.apiPath,
      httpMethod: event.httpMethod,
      httpStatusCode: 200,
      responseBody: {
        'application/json': {
          body: JSON.stringify({
            results: results,
            count: results.length,
            message: results.length > 0 ? '検索が成功しました' : 'アクセス可能な文書が見つかりませんでした',
          }),
        },
      },
    },
  };
}

/**
 * エラーレスポンス生成
 */
function createErrorResponse(event: BedrockAgentEvent, error: Error): BedrockAgentResponse {
  return {
    messageVersion: '1.0',
    response: {
      actionGroup: event.actionGroup,
      apiPath: event.apiPath,
      httpMethod: event.httpMethod,
      httpStatusCode: 500,
      responseBody: {
        'application/json': {
          body: JSON.stringify({
            error: error.message,
            message: '文書検索中にエラーが発生しました',
          }),
        },
      },
    },
  };
}
