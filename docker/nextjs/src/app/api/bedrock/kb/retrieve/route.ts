import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  RetrieveCommandInput,
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

/**
 * RAG検索API — Retrieve API + SIDフィルタリング + Converse API（2段階方式）
 */

interface RetrieveRequest {
  query: string;
  knowledgeBaseId?: string;
  modelId?: string;
  userId: string;
  region?: string;
}

interface UserAccessRecord {
  userId: string;
  userSID: string;
  groupSIDs: string[];
}

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.BEDROCK_REGION || 'ap-northeast-1',
});

async function getUserSIDs(userId: string): Promise<UserAccessRecord | null> {
  const tableName = process.env.USER_ACCESS_TABLE_NAME;
  if (!tableName) return null;
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: tableName,
      Key: { userId: { S: userId } },
    }));
    if (!result.Item) return null;
    const item = unmarshall(result.Item);
    return {
      userId: item.userId,
      userSID: item.userSID || '',
      groupSIDs: item.groupSIDs || [],
    };
  } catch {
    return null;
  }
}

function checkSIDAccess(userSIDs: string[], docSIDs: string[]): boolean {
  if (!Array.isArray(docSIDs) || docSIDs.length === 0) return false;
  return userSIDs.some(sid => docSIDs.includes(sid));
}

export async function POST(request: NextRequest) {
  try {
    const body: RetrieveRequest = await request.json();
    const { query, userId } = body;
    const knowledgeBaseId = body.knowledgeBaseId || process.env.BEDROCK_KB_ID || '';
    const region = body.region || process.env.BEDROCK_REGION || 'ap-northeast-1';
    const rawModelId = body.modelId || process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
    const baseModelId = rawModelId.replace(/^(apac|us|eu)\./i, '');

    if (!query?.trim()) return NextResponse.json({ success: false, error: 'クエリが空です' }, { status: 400 });
    if (!knowledgeBaseId) return NextResponse.json({ success: false, error: 'KB ID未設定' }, { status: 400 });
    if (!userId) return NextResponse.json({ success: false, error: 'ユーザーID未指定' }, { status: 400 });

    console.log('🔍 [KB] Retrieve API開始:', { query: query.substring(0, 80), knowledgeBaseId, userId });

    // Step 1: ユーザーSID取得
    const userAccess = await getUserSIDs(userId);
    const allUserSIDs: string[] = [];
    if (userAccess) {
      if (userAccess.userSID) allUserSIDs.push(userAccess.userSID);
      if (Array.isArray(userAccess.groupSIDs)) allUserSIDs.push(...userAccess.groupSIDs);
    }
    console.log('🔑 [SID] ユーザーSIDs:', allUserSIDs);

    // Step 2: Bedrock KB Retrieve API
    const kbClient = new BedrockAgentRuntimeClient({ region });
    const retrieveInput: RetrieveCommandInput = {
      knowledgeBaseId,
      retrievalQuery: { text: query },
      retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 10 } },
    };
    const retrieveResponse = await kbClient.send(new RetrieveCommand(retrieveInput));
    const results = retrieveResponse.retrievalResults || [];
    console.log('✅ [KB] 検索結果:', results.length, '件');

    // Step 3: SIDフィルタリング
    type FilterDetail = { fileName: string; documentSIDs: string[]; matched: boolean; matchedSID?: string };
    const details: FilterDetail[] = [];
    const allowed: { fileName: string; s3Uri: string; content: string; metadata: Record<string, unknown> }[] = [];

    for (const r of results) {
      const s3Uri = r.location?.s3Location?.uri || '';
      const fileName = s3Uri.split('/').pop() || s3Uri;
      const content = r.content?.text || '';
      const meta = (r.metadata || {}) as Record<string, unknown>;

      let docSIDs: string[] = [];
      const raw = meta?.allowed_group_sids ?? (meta?.metadataAttributes as Record<string, unknown>)?.allowed_group_sids;
      if (Array.isArray(raw)) docSIDs = raw as string[];
      else if (typeof raw === 'string') { try { docSIDs = JSON.parse(raw); } catch { docSIDs = [raw]; } }

      console.log('🔍 [SID] ' + fileName + ': metaKeys=' + JSON.stringify(Object.keys(meta)) + ', docSIDs=' + JSON.stringify(docSIDs));

      const ok = allUserSIDs.length > 0 && checkSIDAccess(allUserSIDs, docSIDs);
      const matchedSID = ok ? allUserSIDs.find(s => docSIDs.includes(s)) : undefined;
      details.push({ fileName, documentSIDs: docSIDs, matched: ok, matchedSID });
      console.log('🔐 [SID] ' + fileName + ': ' + (ok ? '✅ ALLOW' : '❌ DENY'));
      if (ok) allowed.push({ fileName, s3Uri, content, metadata: meta });
    }

    const filterLog = {
      totalDocuments: results.length,
      allowedDocuments: allowed.length,
      deniedDocuments: results.length - allowed.length,
      userId, userSIDs: allUserSIDs,
      filterMethod: allUserSIDs.length > 0 ? 'SID_MATCHING' : 'DENY_ALL',
      details,
      timestamp: new Date().toISOString(),
    };
    console.log('🔐 [SID] 完了:', JSON.stringify({ total: results.length, allowed: allowed.length }));

    // Step 4: Converse APIで回答生成
    let answer = '';
    if (allowed.length > 0) {
      const ctx = allowed.map((r, i) => '[Doc' + (i+1) + ': ' + r.fileName + ']\n' + r.content).join('\n\n');
      const converseClient = new BedrockRuntimeClient({ region });
      const modelId = baseModelId.startsWith('anthropic.') || baseModelId.startsWith('amazon.') ? baseModelId : 'anthropic.claude-3-haiku-20240307-v1:0';
      const resp = await converseClient.send(new ConverseCommand({
        modelId,
        messages: [{ role: 'user', content: [{ text: '以下のドキュメントを参照して質問に日本語で回答してください。ドキュメントに記載のない情報は「該当する情報が見つかりませんでした」と回答してください。\n\n' + ctx + '\n\n質問: ' + query }] }],
        inferenceConfig: { maxTokens: 2000, temperature: 0.1 },
      }));
      const outputContent = resp.output?.message?.content?.[0];
      answer = (outputContent && 'text' in outputContent) ? (outputContent.text || '') : '';
      console.log('✅ [Converse] 回答生成:', answer.length, '文字');
    } else {
      answer = 'アクセス権限のあるドキュメントが見つかりませんでした。この情報へのアクセス権限がない可能性があります。';
    }

    return NextResponse.json({
      success: true, answer,
      citations: allowed.map(r => ({ fileName: r.fileName, s3Uri: r.s3Uri, content: r.content.substring(0, 500), metadata: r.metadata })),
      filterLog,
      metadata: { knowledgeBaseId, modelId: baseModelId, region, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('❌ [KB] エラー:', error);
    return NextResponse.json(
      { success: false, error: 'エラーが発生しました。再試行してください。', details: error instanceof Error ? error.message : '' },
      { status: 500 },
    );
  }
}
