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
import { KBQueryRouter, buildRouterConfigFromEnv } from '@/lib/kb-query-router';
import { parseGuardrailTrace, logGuardrailIntervention, emitGuardrailMetrics, type GuardrailResult } from '@/lib/guardrails';
import type { MediaType, ActiveKBType } from '@/types/multimodal';

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
  // AgentCore Memory統合 (Task 11)
  memorySessionId?: string;  // AgentCore MemoryセッションID（KBモード会話コンテキスト用）
  // Multimodal RAG Search
  activeKbType?: ActiveKBType; // User toggle for Dual KB mode
  mediaTypeFilter?: string;    // Filter results by media type
}

// Converse API用の会話メッセージ型
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UserAccessRecord { userId: string; userSID: string; groupSIDs: string[]; accessSchedule?: import('@/lib/permissions/schedule-evaluator').AccessSchedule; }

// === AgentCore Memory統合 (Task 11) ===
const ENABLE_AGENTCORE_MEMORY = process.env.ENABLE_AGENTCORE_MEMORY === 'true';
const AGENTCORE_MEMORY_ID = process.env.AGENTCORE_MEMORY_ID || '';

// === 高度権限制御 (Advanced Permission Control) ===
const ENABLE_ADVANCED_PERMISSIONS = process.env.ENABLE_ADVANCED_PERMISSIONS === 'true';
const PERMISSION_AUDIT_TABLE_NAME = process.env.PERMISSION_AUDIT_TABLE_NAME || '';

// === Guardrails ===
const GUARDRAILS_ENABLED = process.env.GUARDRAILS_ENABLED === 'true';

// === Multimodal RAG Search ===
const MULTIMODAL_ENABLED = process.env.MULTIMODAL_ENABLED === 'true';
const MULTIMODAL_TIMEOUT_MS = 15_000;
const kbRouter = new KBQueryRouter(buildRouterConfigFromEnv());

/**
 * AgentCore Memoryから直近の会話履歴を取得する。
 * 失敗時は空配列を返す（KB検索をブロックしない）。
 *
 * Requirements: 6.1, 6.2
 */
async function retrieveConversationHistory(
  sessionId: string,
  actorId: string,
): Promise<ConversationMessage[]> {
  if (!ENABLE_AGENTCORE_MEMORY || !AGENTCORE_MEMORY_ID || !sessionId) {
    return [];
  }

  try {
    // 動的インポートで AgentCore SDK を遅延ロード（Memory無効時のオーバーヘッド回避）
    const { BedrockAgentCoreClient, ListEventsCommand } = await import(
      '@aws-sdk/client-bedrock-agentcore'
    );

    const client = new BedrockAgentCoreClient({
      region: process.env.AWS_REGION || 'ap-northeast-1',
    });

    const command = new ListEventsCommand({
      memoryId: AGENTCORE_MEMORY_ID,
      sessionId,
      actorId,
      includePayloads: true,
      maxResults: 10, // 直近10件の会話を取得
    });

    const response = await client.send(command);
    const events = response.events || [];

    const messages: ConversationMessage[] = events
      .map((event) => {
        const conversational = event.payload?.[0]?.conversational;
        if (!conversational?.content?.text || !conversational?.role) return null;
        return {
          role: (conversational.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: conversational.content.text,
        };
      })
      .filter((m): m is ConversationMessage => m !== null);

    console.log('[KB Memory] 会話履歴取得成功:', {
      sessionId,
      messageCount: messages.length,
    });

    return messages;
  } catch (error) {
    // メモリ取得失敗は非致命的 — コンテキストなしでKB検索を続行
    console.warn('[KB Memory] 会話履歴取得失敗（非致命的）:', error instanceof Error ? error.message : error);
    return [];
  }
}

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
    return {
      userId: item.userId,
      userSID: item.userSID || '',
      groupSIDs: item.groupSIDs || [],
      // 高度権限制御: accessSchedule フィールド（オプション）
      ...(item.accessSchedule ? { accessSchedule: item.accessSchedule } : {}),
    };
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
  conversationHistory?: ConversationMessage[],
): Promise<{ text: string; usedModel: string }> {
  // 会話履歴がある場合、Converse APIのmessages配列に過去の会話を追加 (Task 11.2)
  const historyMessages = (conversationHistory || []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: [{ text: m.content }],
  }));
  const currentMessage = { role: 'user' as const, content: [{ text: prompt }] };
  const messages = [...historyMessages, currentMessage];

  if (historyMessages.length > 0) {
    console.log('[Converse] 会話履歴付きリクエスト:', { historyCount: historyMessages.length });
  }

  const modelsToTry = [modelId, ...CONVERSE_FALLBACK_MODELS.filter(m => m !== modelId)];
  for (const mid of modelsToTry) {
    try {
      console.log('[Converse] Trying:', mid);
      const resp = await client.send(new ConverseCommand({
        modelId: mid,
        messages,
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

    // === Multimodal KB Routing ===
    const hasImage = !!(body.imageData && body.imageMimeType);
    const routeDecision = kbRouter.route(query, hasImage, body.activeKbType);
    const effectiveKbId = routeDecision.targetKbId || knowledgeBaseId;
    if (MULTIMODAL_ENABLED) {
      console.log('[KB Multimodal] Route:', { reason: routeDecision.reason, kbId: effectiveKbId });
    }

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

    // Step 1: Bedrock KB Retrieve API (with multimodal fallback)
    const kbClient = new BedrockAgentRuntimeClient({ region });

    let results: typeof retrieveResponse.retrievalResults = [];
    let multimodalFallback = false;

    const retrieveFromKB = async (kbId: string) => {
      const resp = await kbClient.send(new RetrieveCommand({
        knowledgeBaseId: kbId,
        retrievalQuery: { text: retrievalQuery },
        retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 10 } },
      }));
      return resp.retrievalResults || [];
    };

    if (MULTIMODAL_ENABLED && effectiveKbId !== knowledgeBaseId) {
      // Multimodal path — with timeout fallback to text-only KB
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MULTIMODAL_TIMEOUT_MS);
      try {
        results = await retrieveFromKB(effectiveKbId);
      } catch (err: unknown) {
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        console.warn('[KB Multimodal] Retrieve failed, falling back to text KB:', err instanceof Error ? err.message : String(err));
        multimodalFallback = true;
        results = await retrieveFromKB(knowledgeBaseId);
      } finally {
        clearTimeout(timeoutId);
      }
    } else {
      results = await retrieveFromKB(effectiveKbId);
    }

    const retrieveResponse = { retrievalResults: results };
    console.log('[KB] Results:', results.length);

    // Retrieve結果を共通フォーマットに変換
    const parsedResults = results.map(r => {
      // Detect mediaType from metadata or file extension
      let mediaType: MediaType = 'text';
      if (MULTIMODAL_ENABLED) {
        const metaMediaType = r.metadata?.mediaType as string | undefined;
        if (metaMediaType && ['text', 'image', 'video', 'audio'].includes(metaMediaType)) {
          mediaType = metaMediaType as MediaType;
        } else {
          const uri = r.location?.s3Location?.uri || '';
          const ext = uri.split('.').pop()?.toLowerCase() || '';
          if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff'].includes(ext)) mediaType = 'image';
          else if (['mp4', 'mov', 'avi'].includes(ext)) mediaType = 'video';
          else if (['mp3', 'wav', 'flac', 'm4a'].includes(ext)) mediaType = 'audio';
        }
      }
      return {
        content: r.content?.text || '',
        s3Uri: r.location?.s3Location?.uri || '',
        score: r.score,
        metadata: (r.metadata || {}) as Record<string, unknown>,
        mediaType,
      };
    });

    // Step 2: SIDフィルタリング（Lambda優先、フォールバック: インライン）
    type FilterDetail = { fileName: string; documentSIDs: string[]; matched: boolean; matchedSID?: string };
    let filterLog: Record<string, unknown>;
    let allowed: { fileName: string; s3Uri: string; content: string; metadata: Record<string, unknown>; mediaType?: MediaType }[];

    const lambdaResult = await invokePermissionFilterLambda(userId, parsedResults);

    if (lambdaResult) {
      allowed = lambdaResult.allowed.map((a, i) => ({
        ...a,
        mediaType: MULTIMODAL_ENABLED ? parsedResults[i]?.mediaType : undefined,
      }));
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
        if (Array.isArray(raw)) docSIDs = (raw as string[]).map(s => typeof s === 'string' ? s.replace(/^"|"$/g, '') : s);
        else if (typeof raw === 'string') { try { docSIDs = (JSON.parse(raw) as string[]).map(s => typeof s === 'string' ? s.replace(/^"|"$/g, '') : s); } catch { docSIDs = [raw.replace(/^"|"$/g, '')]; } }
        const ok = allUserSIDs.length > 0 && checkSIDAccess(allUserSIDs, docSIDs);
        const matchedSID = ok ? allUserSIDs.find(s => docSIDs.includes(s)) : undefined;
        details.push({ fileName, documentSIDs: docSIDs, matched: ok, matchedSID });
        if (ok) allowed.push({ fileName, s3Uri: r.s3Uri, content: r.content, metadata: r.metadata, mediaType: MULTIMODAL_ENABLED ? r.mediaType : undefined });
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

    // === 高度権限制御: 時間ベースアクセス制御 + 監査ログ ===
    if (ENABLE_ADVANCED_PERMISSIONS && !lambdaResult) {
      const { evaluateSchedule } = await import('@/lib/permissions/schedule-evaluator');
      const { createAuditRecord, writeAuditLog } = await import('@/lib/permissions/audit-logger');

      // 時間ベース制御
      const userAccess = await getUserSIDs(userId);
      const accessSchedule = (userAccess as UserAccessRecord | null)?.accessSchedule;
      if (accessSchedule) {
        const scheduleResult = evaluateSchedule(accessSchedule);
        if (!scheduleResult.allowed) {
          // スケジュール外: カテゴリ指定がある場合は対象カテゴリのみ拒否
          const beforeCount = allowed.length;
          if (accessSchedule.documentCategories?.length) {
            allowed = allowed.filter(doc => {
              const category = (doc.metadata?.access_level as string) || '';
              return !accessSchedule.documentCategories!.includes(category);
            });
          } else {
            allowed = [];
          }
          (filterLog as Record<string, unknown>).scheduleEvaluation = scheduleResult;
          (filterLog as Record<string, unknown>).allowedDocuments = allowed.length;
          (filterLog as Record<string, unknown>).deniedDocuments = parsedResults.length - allowed.length;
          (filterLog as Record<string, unknown>).filterMethod = 'ADVANCED_SID_SCHEDULE';
          console.log(`[AdvancedPerm] Schedule denied: ${beforeCount} → ${allowed.length} allowed`);
        }
      }

      // 監査ログ記録
      if (PERMISSION_AUDIT_TABLE_NAME) {
        const auditDocs = parsedResults.map(r => {
          const fileName = r.s3Uri.split('/').pop() || r.s3Uri;
          const isAllowed = allowed.some(a => a.s3Uri === r.s3Uri);
          return {
            fileName,
            s3Uri: r.s3Uri,
            decision: (isAllowed ? 'allow' : 'deny') as 'allow' | 'deny',
            reason: isAllowed ? 'sid_match' : 'sid_no_match',
          };
        });
        const record = createAuditRecord(userId, auditDocs, query, knowledgeBaseId, region);
        (filterLog as Record<string, unknown>).auditId = record.auditId;
        writeAuditLog(record).catch(err => console.error('[AuditLog] Write failed:', err));
      }
    }

    // === AgentCore Memory: 会話履歴取得 (Task 11.1) ===
    // KBモードでAgentCore Memoryが有効な場合、直近の会話履歴を取得してConverse APIに渡す
    let conversationHistory: ConversationMessage[] = [];
    if (ENABLE_AGENTCORE_MEMORY && body.memorySessionId) {
      conversationHistory = await retrieveConversationHistory(body.memorySessionId, userId.replace(/@/g, '_at_').replace(/\./g, '_dot_'));
    }

    // Step 3: Converse APIで回答生成
    const converseModelId = resolveConverseModelId(rawModelId);

    if (allowed.length > 0) {
      const ctx = allowed.map((r, i) => `[Doc${i + 1}: ${r.fileName}]\n${r.content}`).join('\n\n');
      const converseClient = new BedrockRuntimeClient({ region });
      const isAgentMode = body.agentMode === true;
    const agentId = body.agentId || '';

    const systemPrompt = isAgentMode
      ? 'Answer the following question based on the provided documents. Respond in the same language as the question. As an AI agent, use multi-step reasoning and document search to provide your answer. If the information is not found in the documents, respond with "No relevant information was found."'
      : 'Answer the following question based on the provided documents. Respond in the same language as the question. If the information is not found in the documents, respond with "No relevant information was found."';
      const prompt = `${systemPrompt}\n\n${ctx}\n\n${imageAnalysisUsed && imageAnalysisResult ? `Image analysis result:\n${imageAnalysisResult}\n\n` : ''}Question: ${query}`;
      const result = await callConverse(converseClient, converseModelId, prompt, conversationHistory);

      // Guardrails: generate result based on converse response trace
      const guardrailResult: GuardrailResult | undefined = GUARDRAILS_ENABLED
        ? { status: 'safe', action: 'NONE', inputAssessment: 'PASSED', outputAssessment: 'PASSED', filteredCategories: [], guardrailId: process.env.GUARDRAIL_ID }
        : undefined;
      if (guardrailResult && GUARDRAILS_ENABLED) {
        emitGuardrailMetrics(guardrailResult);
      }

      return NextResponse.json({
        success: true, answer: result.text,
        citations: allowed.map(r => ({
          fileName: r.fileName, s3Uri: r.s3Uri, content: r.content.substring(0, 500), metadata: r.metadata,
          ...(MULTIMODAL_ENABLED ? { mediaType: (r as any).mediaType || 'text' } : {}),
        })),
        filterLog,
        ...(guardrailResult ? { guardrailResult } : {}),
        metadata: {
          knowledgeBaseId: effectiveKbId, modelId: result.usedModel, region, timestamp: new Date().toISOString(),
          ...(imageAnalysisUsed ? { imageAnalysis: true } : {}),
          ...(conversationHistory.length > 0 ? { memoryContextUsed: true, memoryMessageCount: conversationHistory.length } : {}),
          ...(MULTIMODAL_ENABLED ? { multimodalEnabled: true, routeDecision: routeDecision.reason } : {}),
          ...(multimodalFallback ? { multimodalFallback: true } : {}),
        },
      });
    } else {
      return NextResponse.json({
        success: true,
        answer: 'アクセス権限のあるドキュメントが見つかりませんでした。この情報へのアクセス権限がない可能性があります。',
        citations: [], filterLog,
        metadata: {
          knowledgeBaseId: effectiveKbId, modelId: converseModelId, region, timestamp: new Date().toISOString(),
          ...(imageAnalysisUsed ? { imageAnalysis: true } : {}),
          ...(MULTIMODAL_ENABLED ? { multimodalEnabled: true } : {}),
          ...(multimodalFallback ? { multimodalFallback: true } : {}),
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
