import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { createMetricsLogger } from '@/lib/monitoring/metrics';

interface RetrieveRequest {
  query: string;
  knowledgeBaseId?: string;
  modelId?: string;
  userId: string;
  region?: string;
  agentMode?: boolean;
  agentId?: string;
  imageData?: string;        // Base64エンコード画像データ
  imageMimeType?: string;    // image/jpeg, image/png, image/gif, image/webp
  // Smart Routing メトリクス用（フロントエンドから送信）
  isAutoRouted?: boolean;    // Smart Routingによる自動選択かどうか
  routingClassification?: 'simple' | 'complex'; // クエリ複雑度分類結果
}

interface UserAccessRecord { userId: string; userSID: string; groupSIDs: string[]; }

const PERMISSION_FILTER_LAMBDA_ARN = process.env.PERMISSION_FILTER_LAMBDA_ARN || '';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.BEDROCK_REGION || 'ap-northeast-1',
});

const lambdaClient = PERMISSION_FILTER_LAMBDA_ARN
  ? new LambdaClient({ region: process.env.AWS_REGION || process.env.BEDROCK_REGION || 'ap-northeast-1' })
  : null;

async function getUserSIDs(userId: string): Promise<UserAccessRecord | null> {
  const tableName = process.env.USER_ACCESS_TABLE_NAME;
  if (!tableName) return null;
  try {
    const result = await dynamoClient.send(new GetItemCommand({
      TableName: tableName, Key: { userId: { S: userId } },
    }));
    if (!result.Item) return null;
    const item = unmarshall(result.Item);
    return { userId: item.userId, userSID: item.userSID || '', groupSIDs: item.groupSIDs || [] };
  } catch { return null; }
}

function checkSIDAccess(userSIDs: string[], docSIDs: string[]): boolean {
  if (!Array.isArray(docSIDs) || docSIDs.length === 0) return false;
  return userSIDs.some(sid => docSIDs.includes(sid));
}

const ON_DEMAND_BLOCKED = new Set([
  'amazon.nova-pro-v1:0', 'amazon.nova-micro-v1:0', 'amazon.nova-2-lite-v1:0',
  'nvidia.nemotron-super-3-120b',
]);

function resolveConverseModelId(rawModelId: string): string {
  if (/^(apac|us|eu)\./i.test(rawModelId)) return rawModelId;
  if (ON_DEMAND_BLOCKED.has(rawModelId)) return 'anthropic.claude-3-haiku-20240307-v1:0';
  return rawModelId;
}

const CONVERSE_FALLBACK_MODELS = [
  'apac.amazon.nova-lite-v1:0',
  'anthropic.claude-3-haiku-20240307-v1:0',
];

async function callConverse(
  client: BedrockRuntimeClient,
  modelId: string,
  prompt: string,
): Promise<{ text: string; usedModel: string }> {
  const modelsToTry = [modelId, ...CONVERSE_FALLBACK_MODELS.filter(m => m !== modelId)];
  for (const mid of modelsToTry) {
    try {
      console.log('[Converse] Trying:', mid);
      const resp = await client.send(new ConverseCommand({
        modelId: mid,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 2000, temperature: 0.1 },
      }));
      const outputContent = resp.output?.message?.content?.[0];
      const text = (outputContent && 'text' in outputContent) ? (outputContent.text || '') : '';
      return { text, usedModel: mid };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isRetryable = errMsg.includes('Legacy') ||
        errMsg.includes('ResourceNotFoundException') ||
        errMsg.includes('on-demand throughput') ||
        errMsg.includes('ValidationException');
      console.warn('[Converse] Failed:', mid, '-', errMsg.substring(0, 150));
      if (!isRetryable) throw err;
    }
  }
  throw new Error('All Converse models failed');
}

// Vision-capable model for image analysis
const VISION_MODEL_ID = 'anthropic.claude-haiku-4-5-20251001-v1:0';
const VISION_TIMEOUT_MS = 15_000;

/**
 * Vision対応Converse API呼び出し — 画像+テキストのマルチモーダルメッセージを送信
 * 30秒タイムアウト付き。失敗時はnullを返す（呼び出し元でフォールバック処理）。
 */
async function callVisionConverse(
  client: BedrockRuntimeClient,
  imageBase64: string,
  imageMimeType: string,
  query: string,
): Promise<string | null> {
  const metrics = createMetricsLogger(process.env.ENABLE_MONITORING === 'true');
  metrics.setDimension('Operation', 'vision');
  metrics.putMetric('VisionApiInvocations', 1, 'Count');
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const format = imageMimeType.split('/')[1] as 'jpeg' | 'png' | 'gif' | 'webp';
    console.log('[Vision] Calling Converse API with image, model:', VISION_MODEL_ID, 'format:', format);

    const resp = await client.send(
      new ConverseCommand({
        modelId: VISION_MODEL_ID,
        messages: [{
          role: 'user',
          content: [
            { image: { format, source: { bytes: Buffer.from(imageBase64, 'base64') } } },
            { text: `画像を分析してください。ユーザーの質問: ${query}` },
          ],
        }],
        inferenceConfig: { maxTokens: 2000, temperature: 0.1 },
      }),
      { abortSignal: controller.signal },
    );

    const outputContent = resp.output?.message?.content?.[0];
    const text = (outputContent && 'text' in outputContent) ? (outputContent.text || '') : '';
    console.log('[Vision] Analysis complete, result length:', text.length);
    metrics.putMetric('VisionApiLatency', Date.now() - startTime, 'Milliseconds');
    metrics.flush();
    return text;
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    if (isTimeout) {
      metrics.putMetric('VisionApiTimeouts', 1, 'Count');
    }
    metrics.putMetric('VisionApiFallbacks', 1, 'Count');
    metrics.putMetric('VisionApiLatency', Date.now() - startTime, 'Milliseconds');
    metrics.flush();
    console.error('[Vision] Failed:', err instanceof Error ? err.message : String(err));
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Permission Filter Lambdaを呼び出してSIDフィルタリングを実行 */
async function invokePermissionFilterLambda(
  userId: string,
  parsedResults: { content: string; s3Uri: string; score?: number; metadata: Record<string, unknown> }[],
): Promise<{
  allowed: { fileName: string; s3Uri: string; content: string; metadata: Record<string, unknown> }[];
  filterLog: Record<string, unknown>;
} | null> {
  if (!lambdaClient || !PERMISSION_FILTER_LAMBDA_ARN) return null;
  try {
    const resp = await lambdaClient.send(new InvokeCommand({
      FunctionName: PERMISSION_FILTER_LAMBDA_ARN,
      Payload: Buffer.from(JSON.stringify({
        userId,
        retrievalResults: parsedResults.map(r => ({ content: r.content, s3Uri: r.s3Uri, score: r.score, metadata: r.metadata })),
      })),
    }));
    if (resp.FunctionError) { console.error('[PermFilter Lambda] Error:', resp.FunctionError); return null; }
    const result = JSON.parse(new TextDecoder().decode(resp.Payload));
    console.log(`[PermFilter Lambda] ${result.allowedDocuments}/${result.totalDocuments} allowed`);
    return {
      allowed: result.allowed || [],
      filterLog: {
        totalDocuments: result.totalDocuments, allowedDocuments: result.allowedDocuments,
        deniedDocuments: result.deniedDocuments, userId: result.userId, userSIDs: result.userSIDs,
        filterMethod: result.filterMethod, details: result.filterLog,
        timestamp: new Date().toISOString(), source: 'lambda',
      },
    };
  } catch (error) {
    console.error('[PermFilter Lambda] Invocation failed, falling back to inline:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RetrieveRequest = await request.json();
    const { query, userId } = body;
    const knowledgeBaseId = body.knowledgeBaseId || process.env.BEDROCK_KB_ID || '';
    const region = body.region || process.env.BEDROCK_REGION || 'ap-northeast-1';
    const rawModelId = body.modelId || process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

    if (!query?.trim()) return NextResponse.json({ success: false, error: 'empty' }, { status: 400 });
    if (!knowledgeBaseId) return NextResponse.json({ success: false, error: 'no KB ID' }, { status: 400 });
    if (!userId) return NextResponse.json({ success: false, error: 'no userId' }, { status: 400 });

    console.log('[KB] Start:', { query: query.substring(0, 80), knowledgeBaseId, userId, rawModelId });

    // Smart Routing メトリクス出力
    const monitoringEnabled = process.env.ENABLE_MONITORING === 'true';
    if (monitoringEnabled && body.isAutoRouted !== undefined) {
      const routingMetrics = createMetricsLogger(true);
      routingMetrics.setDimension('Operation', 'routing');
      if (body.isAutoRouted) {
        routingMetrics.putMetric('SmartRoutingAutoSelect', 1, 'Count');
        if (body.routingClassification === 'simple') {
          routingMetrics.putMetric('SmartRoutingSimple', 1, 'Count');
        } else if (body.routingClassification === 'complex') {
          routingMetrics.putMetric('SmartRoutingComplex', 1, 'Count');
        }
      } else {
        routingMetrics.putMetric('SmartRoutingManualOverride', 1, 'Count');
      }
      routingMetrics.flush();
    }

    // Step 0: Image analysis (when imageData is present)
    let imageAnalysisResult: string | null = null;
    let imageAnalysisUsed = false;
    const imageData = body.imageData;
    const imageMimeType = body.imageMimeType;

    if (imageData && imageMimeType) {
      console.log('[KB] Image data detected, running Vision analysis...');
      const visionClient = new BedrockRuntimeClient({ region });
      imageAnalysisResult = await callVisionConverse(visionClient, imageData, imageMimeType, query);
      if (imageAnalysisResult) {
        imageAnalysisUsed = true;
        console.log('[KB] Vision analysis succeeded, combining with query');
      } else {
        console.warn('[KB] Vision analysis failed, falling back to text-only query');
      }
    }

    // Build the retrieval query — combine with image analysis if available
    const retrievalQuery = imageAnalysisUsed && imageAnalysisResult
      ? `${query}\n\n画像分析結果: ${imageAnalysisResult}`
      : query;

    // Step 1: Bedrock KB Retrieve API
    const kbClient = new BedrockAgentRuntimeClient({ region });
    const retrieveResponse = await kbClient.send(new RetrieveCommand({
      knowledgeBaseId,
      retrievalQuery: { text: retrievalQuery },
      retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 10 } },
    }));
    const results = retrieveResponse.retrievalResults || [];
    console.log('[KB] Results:', results.length);

    // Retrieve結果を共通フォーマットに変換
    const parsedResults = results.map(r => ({
      content: r.content?.text || '',
      s3Uri: r.location?.s3Location?.uri || '',
      score: r.score,
      metadata: (r.metadata || {}) as Record<string, unknown>,
    }));

    // Step 2: SIDフィルタリング（Lambda優先、フォールバック: インライン）
    type FilterDetail = { fileName: string; documentSIDs: string[]; matched: boolean; matchedSID?: string };
    let filterLog: Record<string, unknown>;
    let allowed: { fileName: string; s3Uri: string; content: string; metadata: Record<string, unknown> }[];

    const lambdaResult = await invokePermissionFilterLambda(userId, parsedResults);

    if (lambdaResult) {
      allowed = lambdaResult.allowed;
      filterLog = lambdaResult.filterLog;
    } else {
      // フォールバック: インラインSIDフィルタリング
      const userAccess = await getUserSIDs(userId);
      const allUserSIDs: string[] = [];
      if (userAccess) {
        if (userAccess.userSID) allUserSIDs.push(userAccess.userSID);
        if (Array.isArray(userAccess.groupSIDs)) allUserSIDs.push(...userAccess.groupSIDs);
      }
      const details: FilterDetail[] = [];
      allowed = [];
      for (const r of parsedResults) {
        const fileName = r.s3Uri.split('/').pop() || r.s3Uri;
        let docSIDs: string[] = [];
        const raw = r.metadata?.allowed_group_sids ?? (r.metadata?.metadataAttributes as Record<string, unknown>)?.allowed_group_sids;
        if (Array.isArray(raw)) docSIDs = raw as string[];
        else if (typeof raw === 'string') { try { docSIDs = JSON.parse(raw); } catch { docSIDs = [raw]; } }
        const ok = allUserSIDs.length > 0 && checkSIDAccess(allUserSIDs, docSIDs);
        const matchedSID = ok ? allUserSIDs.find(s => docSIDs.includes(s)) : undefined;
        details.push({ fileName, documentSIDs: docSIDs, matched: ok, matchedSID });
        if (ok) allowed.push({ fileName, s3Uri: r.s3Uri, content: r.content, metadata: r.metadata });
      }
      filterLog = {
        totalDocuments: results.length, allowedDocuments: allowed.length,
        deniedDocuments: results.length - allowed.length,
        userId, userSIDs: allUserSIDs,
        filterMethod: allUserSIDs.length > 0 ? 'SID_MATCHING' : 'DENY_ALL',
        details, timestamp: new Date().toISOString(), source: 'inline',
      };
    }

    console.log('[SID] Done:', (filterLog as Record<string, unknown>).allowedDocuments, '/', (filterLog as Record<string, unknown>).totalDocuments);

    // Step 3: Converse APIで回答生成
    const converseModelId = resolveConverseModelId(rawModelId);

    if (allowed.length > 0) {
      const ctx = allowed.map((r, i) => `[Doc${i + 1}: ${r.fileName}]\n${r.content}`).join('\n\n');
      const converseClient = new BedrockRuntimeClient({ region });
      const isAgentMode = body.agentMode === true;
    const agentId = body.agentId || '';

    const systemPrompt = isAgentMode
      ? '以下のドキュメントを参照して質問に日本語で回答してください。あなたはAIエージェントとして、多段階推論と文書検索を活用して回答します。ドキュメントに記載のない情報は「該当する情報が見つかりませんでした」と回答してください。'
      : '以下のドキュメントを参照して質問に日本語で回答してください。ドキュメントに記載のない情報は「該当する情報が見つかりませんでした」と回答してください。';
      const prompt = `${systemPrompt}\n\n${ctx}\n\n${imageAnalysisUsed && imageAnalysisResult ? `画像分析結果:\n${imageAnalysisResult}\n\n` : ''}質問: ${query}`;
      const result = await callConverse(converseClient, converseModelId, prompt);
      return NextResponse.json({
        success: true, answer: result.text,
        citations: allowed.map(r => ({ fileName: r.fileName, s3Uri: r.s3Uri, content: r.content.substring(0, 500), metadata: r.metadata })),
        filterLog,
        metadata: {
          knowledgeBaseId, modelId: result.usedModel, region, timestamp: new Date().toISOString(),
          ...(imageAnalysisUsed ? { imageAnalysis: true } : {}),
        },
      });
    } else {
      return NextResponse.json({
        success: true,
        answer: 'アクセス権限のあるドキュメントが見つかりませんでした。この情報へのアクセス権限がない可能性があります。',
        citations: [], filterLog,
        metadata: {
          knowledgeBaseId, modelId: converseModelId, region, timestamp: new Date().toISOString(),
          ...(imageAnalysisUsed ? { imageAnalysis: true } : {}),
        },
      });
    }
  } catch (error) {
    console.error('[KB] Error:', error);
    return NextResponse.json(
      { success: false, error: 'エラーが発生しました。再試行してください。', details: error instanceof Error ? error.message : '' },
      { status: 500 },
    );
  }
}
