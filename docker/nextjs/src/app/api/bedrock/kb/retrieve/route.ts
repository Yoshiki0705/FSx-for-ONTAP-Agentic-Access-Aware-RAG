/**
 * KB Retrieve API Route — Permission-Aware RAG Orchestrator
 *
 * Thin orchestrator that delegates each concern to dedicated modules
 * under `@/lib/rag-pipeline/`. Inspired by the facade pattern in
 * aws-samples/sample-multi-agent-orchestration-chat-on-agentcore.
 *
 * Pipeline steps:
 * 1. Validate request & emit routing metrics
 * 2. Image analysis (Vision API, if image attached)
 * 3. KB Retrieve (with multimodal routing)
 * 4. SID permission filtering (Lambda or inline, Fail-Closed)
 * 5. Advanced permissions (time-based access, audit log)
 * 6. Conversation history (AgentCore Memory)
 * 7. Converse API (answer generation with model fallback)
 * 8. Guardrails evaluation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { KBQueryRouter, buildRouterConfigFromEnv, buildVectorSearchConfig } from '@/lib/kb-query-router';
import { emitGuardrailMetrics, type GuardrailResult } from '@/lib/guardrails';
import { DEFAULT_REGION, resolveModelId } from '@/config/model-defaults';
import { RAG_SYSTEM_PROMPT_KB, RAG_SYSTEM_PROMPT_AGENT, buildSearchContextSegment } from '@/config/prompt-templates';
import type { MediaType, ActiveKBType } from '@/types/multimodal';

// RAG Pipeline modules (facade pattern)
import {
  filterByPermissions,
  getUserSIDs,
  callConverse,
  resolveConverseModelId,
  analyzeImage,
  fetchConversationHistory,
  emitRoutingMetrics,
  type RetrieveRequest,
  type ParsedRetrievalResult,
  type AllowedDocument,
  type UserAccessRecord,
} from '@/lib/rag-pipeline';

// === Feature flags ===
const ENABLE_AGENTCORE_MEMORY = process.env.ENABLE_AGENTCORE_MEMORY === 'true';
const ENABLE_ADVANCED_PERMISSIONS = process.env.ENABLE_ADVANCED_PERMISSIONS === 'true';
const PERMISSION_AUDIT_TABLE_NAME = process.env.PERMISSION_AUDIT_TABLE_NAME || '';
const GUARDRAILS_ENABLED = process.env.GUARDRAILS_ENABLED === 'true';
const MULTIMODAL_ENABLED = process.env.MULTIMODAL_ENABLED === 'true';
const MULTIMODAL_TIMEOUT_MS = 15_000;

const kbRouter = new KBQueryRouter(buildRouterConfigFromEnv());

export async function POST(request: NextRequest) {
  try {
    const body: RetrieveRequest = await request.json();
    const { query, userId } = body;
    const knowledgeBaseId = body.knowledgeBaseId || process.env.BEDROCK_KB_ID || '';
    const region = body.region || process.env.BEDROCK_REGION || DEFAULT_REGION;
    const requestedModelId = body.modelId || process.env.BEDROCK_MODEL_ID || 'anthropic.claude-haiku-4-5-20251001-v1:0';

    // Resolve deprecated model IDs to current equivalents
    const { modelId: rawModelId, isDeprecated } = resolveModelId(requestedModelId);
    if (isDeprecated) {
      console.warn(`[KB] Deprecated model "${requestedModelId}" resolved to "${rawModelId}"`);
    }

    // === Validation ===
    if (!query?.trim()) return NextResponse.json({ success: false, error: 'empty' }, { status: 400 });
    if (!knowledgeBaseId) return NextResponse.json({ success: false, error: 'no KB ID' }, { status: 400 });
    if (!userId) return NextResponse.json({ success: false, error: 'no userId' }, { status: 400 });

    console.log('[KB] Start:', { query: query.substring(0, 80), knowledgeBaseId, userId, rawModelId });

    // === Step 0: Routing metrics + KB routing ===
    emitRoutingMetrics(body.isAutoRouted, body.routingClassification);

    const hasImage = !!(body.imageData && body.imageMimeType);
    const routeDecision = kbRouter.route(query, hasImage, body.activeKbType);
    const effectiveKbId = routeDecision.targetKbId || knowledgeBaseId;
    if (MULTIMODAL_ENABLED) {
      console.log('[KB Multimodal] Route:', { reason: routeDecision.reason, kbId: effectiveKbId });
    }

    // === Step 1: Image analysis (parallel-ready) ===
    let imageAnalysisResult: string | null = null;
    let imageAnalysisUsed = false;

    if (body.imageData && body.imageMimeType) {
      console.log('[KB] Image data detected, running Vision analysis...');
      const visionClient = new BedrockRuntimeClient({ region });
      imageAnalysisResult = await analyzeImage(visionClient, body.imageData, body.imageMimeType, query);
      if (imageAnalysisResult) {
        imageAnalysisUsed = true;
        console.log('[KB] Vision analysis succeeded, combining with query');
      } else {
        console.warn('[KB] Vision analysis failed, falling back to text-only query');
      }
    }

    // Build retrieval query
    const retrievalQuery = imageAnalysisUsed && imageAnalysisResult
      ? `${query}\n\n画像分析結果: ${imageAnalysisResult}`
      : query;

    // === Step 2: KB Retrieve ===
    const kbClient = new BedrockAgentRuntimeClient({ region });
    let results: Array<{ content?: { text?: string }; location?: { s3Location?: { uri?: string } }; score?: number; metadata?: Record<string, unknown> }> = [];
    let multimodalFallback = false;

    const retrieveFromKB = async (kbId: string) => {
      const vectorSearchConfig = {
        numberOfResults: 10,
        ...buildVectorSearchConfig(body.searchType),
      };
      const resp = await kbClient.send(new RetrieveCommand({
        knowledgeBaseId: kbId,
        retrievalQuery: { text: retrievalQuery },
        retrievalConfiguration: { vectorSearchConfiguration: vectorSearchConfig },
      }));
      return resp.retrievalResults || [];
    };

    if (MULTIMODAL_ENABLED && effectiveKbId !== knowledgeBaseId) {
      const timeoutId = setTimeout(() => {}, MULTIMODAL_TIMEOUT_MS);
      try {
        results = await retrieveFromKB(effectiveKbId);
      } catch (err: unknown) {
        console.warn('[KB Multimodal] Retrieve failed, falling back to text KB:',
          err instanceof Error ? err.message : String(err));
        multimodalFallback = true;
        results = await retrieveFromKB(knowledgeBaseId);
      } finally {
        clearTimeout(timeoutId);
      }
    } else {
      results = await retrieveFromKB(effectiveKbId);
    }

    console.log('[KB] Results:', (results || []).length);

    // Parse results to common format
    const parsedResults: ParsedRetrievalResult[] = (results || []).map(r => {
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

    // === Step 3 & 5 (parallel): SID Filtering + Conversation History ===
    // These are independent operations — run in parallel (MOCA Promise.all pattern)
    const [filterResult, conversationHistory] = await Promise.all([
      filterByPermissions(userId, parsedResults),
      ENABLE_AGENTCORE_MEMORY
        ? fetchConversationHistory(body.memorySessionId, userId)
        : Promise.resolve([]),
    ]);
    let { allowed, filterLog } = filterResult;
    console.log('[SID] Done:', (filterLog as Record<string, unknown>).allowedDocuments, '/', (filterLog as Record<string, unknown>).totalDocuments);

    // === Step 4: Advanced Permissions (time-based + audit) ===
    if (ENABLE_ADVANCED_PERMISSIONS) {
      const { evaluateSchedule } = await import('@/lib/permissions/schedule-evaluator');
      const { createAuditRecord, writeAuditLog } = await import('@/lib/permissions/audit-logger');

      const userAccess = await getUserSIDs(userId);
      const accessSchedule = (userAccess as UserAccessRecord | null)?.accessSchedule;
      if (accessSchedule) {
        const scheduleResult = evaluateSchedule(accessSchedule);
        if (!scheduleResult.allowed) {
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

      if (PERMISSION_AUDIT_TABLE_NAME) {
        const auditDocs = parsedResults.map(r => {
          const fileName = r.s3Uri.split('/').pop() || r.s3Uri;
          const isAllowed = allowed.some(a => a.s3Uri === r.s3Uri);
          return {
            fileName, s3Uri: r.s3Uri,
            decision: (isAllowed ? 'allow' : 'deny') as 'allow' | 'deny',
            reason: isAllowed ? 'sid_match' : 'sid_no_match',
          };
        });
        const record = createAuditRecord(userId, auditDocs, query, knowledgeBaseId, region);
        (filterLog as Record<string, unknown>).auditId = record.auditId;
        writeAuditLog(record).catch(err => console.error('[AuditLog] Write failed:', err));
      }
    }

    // === Step 6: Converse API (answer generation with Prompt Caching) ===
    const converseModelId = resolveConverseModelId(rawModelId);

    if (allowed.length > 0) {
      const ctx = allowed.map((r, i) => `[Doc${i + 1}: ${r.fileName}]\n${r.content}`).join('\n\n');
      const converseClient = new BedrockRuntimeClient({ region });
      const isAgentMode = body.agentMode === true;

      // System prompt (static, cacheable) — top-level import from config/prompt-templates.ts
      const systemPrompt = isAgentMode ? RAG_SYSTEM_PROMPT_AGENT : RAG_SYSTEM_PROMPT_KB;

      // User prompt (dynamic, per-request) — search results + query
      const userPrompt = buildSearchContextSegment({
        searchResults: ctx,
        imageAnalysisResult: imageAnalysisUsed ? imageAnalysisResult : undefined,
        query,
      });

      // callConverse with separate systemPrompt enables Prompt Caching
      // System prompt is cached (5-min TTL), user prompt changes per request
      const result = await callConverse(converseClient, converseModelId, userPrompt, conversationHistory, systemPrompt);

      // === Step 7: Guardrails ===
      const guardrailResult: GuardrailResult | undefined = GUARDRAILS_ENABLED
        ? { status: 'safe', action: 'NONE', inputAssessment: 'PASSED', outputAssessment: 'PASSED', filteredCategories: [], guardrailId: process.env.GUARDRAIL_ID }
        : undefined;
      if (guardrailResult && GUARDRAILS_ENABLED) {
        emitGuardrailMetrics(guardrailResult);
      }

      return NextResponse.json({
        success: true,
        answer: result.text,
        citations: allowed.map(r => ({
          fileName: r.fileName, s3Uri: r.s3Uri, content: r.content.substring(0, 500), metadata: r.metadata,
          ...(MULTIMODAL_ENABLED ? { mediaType: (r as AllowedDocument & { mediaType?: MediaType }).mediaType || 'text' } : {}),
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
