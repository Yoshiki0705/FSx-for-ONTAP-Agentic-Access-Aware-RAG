/**
 * Bedrock Agent Action Group: Permission-aware KB Search
 * 
 * Bedrock AgentのAction Groupとして動作し、KB Retrieve APIで文書検索後、
 * ユーザーのSID情報に基づいてフィルタリングした結果を返す。
 * 
 * データフロー:
 *   Agent → Action Group Lambda → KB Retrieve API → SIDフィルタリング → 結果返却 → Agent
 */

import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const KB_ID = process.env.KNOWLEDGE_BASE_ID || '';
const USER_ACCESS_TABLE = process.env.USER_ACCESS_TABLE_NAME || '';

const dynamoClient = new DynamoDBClient({ region: REGION });
const kbClient = new BedrockAgentRuntimeClient({ region: REGION });

interface AgentEvent {
  messageVersion: string;
  agent: { name: string; id: string; alias: string; version: string };
  inputText: string;
  sessionId: string;
  actionGroup: string;
  apiPath: string;
  httpMethod: string;
  parameters: Array<{ name: string; type: string; value: string }>;
  requestBody?: { content: Record<string, Array<{ name: string; type: string; value: string }>> };
  sessionAttributes: Record<string, string>;
  promptSessionAttributes: Record<string, string>;
}

interface AgentResponse {
  messageVersion: string;
  response: {
    actionGroup: string;
    apiPath: string;
    httpMethod: string;
    httpStatusCode: number;
    responseBody: Record<string, { body: string }>;
  };
  sessionAttributes?: Record<string, string>;
  promptSessionAttributes?: Record<string, string>;
}

/** ユーザーSID取得 */
async function getUserSIDs(userId: string): Promise<string[]> {
  if (!USER_ACCESS_TABLE || !userId) return [];
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: USER_ACCESS_TABLE,
      Key: { userId: { S: userId } },
    }));
    if (!result.Item) return [];
    const item = unmarshall(result.Item);
    const sids: string[] = [];
    if (item.userSID) sids.push(item.userSID);
    if (Array.isArray(item.groupSIDs)) sids.push(...item.groupSIDs);
    return sids;
  } catch (e) {
    console.error('SID取得エラー:', e);
    return [];
  }
}

/** SIDマッチング */
function checkAccess(userSIDs: string[], docSIDs: string[]): boolean {
  if (!Array.isArray(docSIDs) || docSIDs.length === 0) return false;
  return userSIDs.some(sid => docSIDs.includes(sid));
}

/** パラメータ取得 */
function getParam(event: AgentEvent, name: string): string {
  // parametersから取得
  const p = event.parameters?.find(p => p.name === name);
  if (p?.value) return p.value;
  // requestBodyから取得
  if (event.requestBody?.content) {
    for (const fields of Object.values(event.requestBody.content)) {
      const f = fields.find(f => f.name === name);
      if (f?.value) return f.value;
    }
  }
  return '';
}

/** Lambda Handler */
export const handler = async (event: AgentEvent): Promise<AgentResponse> => {
  console.log('[PermSearch] Event:', JSON.stringify(event));

  try {
    const query = getParam(event, 'query');
    const maxResults = parseInt(getParam(event, 'maxResults') || '5', 10);
    // userIdはsessionAttributesまたはpromptSessionAttributesから取得
    const userId = event.sessionAttributes?.userId
      || event.promptSessionAttributes?.userId
      || event.sessionId?.split('-')[1] // session-userId-timestamp形式からuserIdを抽出
      || '';

    console.log(`[PermSearch] query="${query}", userId="${userId}", maxResults=${maxResults}`);

    if (!query) {
      return makeResponse(event, 400, { error: 'queryパラメータが必要です', results: [], count: 0 });
    }

    // Step 1: KB Retrieve API
    if (!KB_ID) {
      return makeResponse(event, 500, { error: 'KNOWLEDGE_BASE_ID未設定', results: [], count: 0 });
    }

    const retrieveResp = await kbClient.send(new RetrieveCommand({
      knowledgeBaseId: KB_ID,
      retrievalQuery: { text: query },
      retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: Math.min(maxResults * 2, 20) } },
    }));
    const results = retrieveResp.retrievalResults || [];
    console.log(`[PermSearch] KB results: ${results.length}`);

    // Step 2: SIDフィルタリング
    const userSIDs = await getUserSIDs(userId);
    console.log(`[PermSearch] User SIDs: ${userSIDs.length} (${userId})`);

    if (userSIDs.length === 0) {
      // SID未取得 → 安全側フォールバック（全拒否）
      return makeResponse(event, 200, {
        results: [],
        count: 0,
        message: 'ユーザーのアクセス権限情報が見つかりませんでした。',
        filterMethod: 'DENY_ALL',
      });
    }

    const allowed: any[] = [];
    for (const r of results) {
      const meta = (r.metadata || {}) as Record<string, any>;
      const s3Uri = r.location?.s3Location?.uri || '';
      const fileName = s3Uri.split('/').pop() || s3Uri;
      let docSIDs: string[] = [];
      const raw = meta?.allowed_group_sids ?? meta?.metadataAttributes?.allowed_group_sids;
      if (Array.isArray(raw)) docSIDs = raw;
      else if (typeof raw === 'string') { try { docSIDs = JSON.parse(raw); } catch { docSIDs = [raw]; } }

      if (checkAccess(userSIDs, docSIDs)) {
        allowed.push({
          documentId: fileName,
          title: fileName,
          content: r.content?.text || '',
          score: r.score || 0,
          source: s3Uri,
          accessLevel: meta?.access_level || 'unknown',
        });
      }
    }

    // maxResultsに制限
    const limited = allowed.slice(0, maxResults);

    console.log(`[PermSearch] Allowed: ${allowed.length}/${results.length}, returned: ${limited.length}`);

    return makeResponse(event, 200, {
      results: limited,
      count: limited.length,
      message: limited.length > 0
        ? `${limited.length}件のアクセス可能な文書が見つかりました。`
        : 'アクセス権限のある文書が見つかりませんでした。',
      filterMethod: 'SID_MATCHING',
      totalSearched: results.length,
      totalAllowed: allowed.length,
    });
  } catch (error) {
    console.error('[PermSearch] Error:', error);
    return makeResponse(event, 500, {
      error: error instanceof Error ? error.message : 'Unknown error',
      results: [],
      count: 0,
    });
  }
};

function makeResponse(event: AgentEvent, status: number, body: any): AgentResponse {
  return {
    messageVersion: '1.0',
    response: {
      actionGroup: event.actionGroup,
      apiPath: event.apiPath,
      httpMethod: event.httpMethod,
      httpStatusCode: status,
      responseBody: { 'application/json': { body: JSON.stringify(body) } },
    },
  };
}
