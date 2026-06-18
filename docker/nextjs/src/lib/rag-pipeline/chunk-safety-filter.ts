/**
 * RAG Pipeline — Chunk Safety Filter (Inline Guardrail Checks)
 *
 * AWS Summit NY 2026 の InvokeGuardrailChecks API 思想に基づく、チャンク単位の
 * インライン安全性チェック。本実装は GA 済みの ApplyGuardrail API を用いる
 * （InvokeGuardrailChecks 専用 SDK コマンドが利用可能になれば置換可能）。
 *
 * パイプライン位置: KB Retrieve → SID Filter → **Chunk Safety Filter** → Converse API
 *
 * 機能:
 * - チャンク単位でプロンプトインジェクション / PII / 有害コンテンツを検出
 * - GUARDRAIL_ID 指定時: ApplyGuardrail API（detect 相当）でスコア評価
 * - GUARDRAIL_ID 未指定時: 多言語ヒューリスティック（best-effort、セキュリティ保証ではない）
 * - Fail-Open: API エラー/タイムアウト時はチャンクを通過（可用性優先）
 * - タイムアウト + 並列度制限で RAG レイテンシ影響を抑制
 *
 * セキュリティ上の注意:
 *   本フィルタは多層防御の一層であり、唯一の防御ではない。Permission-aware RAG の
 *   SID フィルタ（fail-closed）と併用すること。ヒューリスティックフォールバックは
 *   取りこぼしがある前提で扱う。
 *
 * @see https://aws.amazon.com/blogs/machine-learning/safeguard-your-agentic-ai-applications-with-the-amazon-bedrock-guardrails-invokeguardrailchecks-api/
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-use-independent-api.html
 */

import {
  BedrockRuntimeClient,
  ApplyGuardrailCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { AllowedDocument } from './types';

// ─── Configuration ─────────────────────────────────────────

/** チャンク安全性フィルタ有効化フラグ */
const CHUNK_SAFETY_ENABLED = process.env.ENABLE_CHUNK_SAFETY_FILTER === 'true';

/** チャンク安全性チェック全体のタイムアウト (ms) */
const CHUNK_SAFETY_TIMEOUT_MS = parseInt(process.env.CHUNK_SAFETY_TIMEOUT_MS || '3000', 10);

/** 安全性スコア閾値 (0.0-1.0)。このスコア未満のチャンクを除外。 */
const SAFETY_SCORE_THRESHOLD = parseFloat(process.env.CHUNK_SAFETY_THRESHOLD || '0.7');

/** 同時に評価するチャンク数の上限（Bedrock スロットリング回避） */
const CHUNK_SAFETY_CONCURRENCY = parseInt(process.env.CHUNK_SAFETY_CONCURRENCY || '3', 10);

/** ApplyGuardrail に渡すテキストの最大文字数（API 制限） */
const MAX_GUARDRAIL_TEXT_LENGTH = 10_000;

/** Guardrail ID（指定時は ApplyGuardrail を使用。未指定時はヒューリスティック） */
const GUARDRAIL_ID = process.env.GUARDRAIL_ID || '';
const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION || 'DRAFT';

// ─── Types ─────────────────────────────────────────────────

export interface ChunkSafetyResult {
  /** フィルタリング後の安全なチャンク */
  safeChunks: AllowedDocument[];
  /** 除外されたチャンク数 */
  blockedCount: number;
  /** チェック詳細（監査ログ用） */
  details: ChunkSafetyDetail[];
  /** 処理時間 (ms) */
  latencyMs: number;
  /** フィルタ方法 */
  method: ChunkSafetyMethod;
}

export type ChunkSafetyMethod =
  | 'GUARDRAIL_API'   // ApplyGuardrail API でチェック
  | 'HEURISTIC'       // GUARDRAIL_ID 未設定時の多言語ヒューリスティック
  | 'SKIP_DISABLED'   // フィルタ無効
  | 'SKIP_ERROR';     // エラー/タイムアウトで Fail-Open

export interface ChunkSafetyDetail {
  fileName: string;
  /** 安全性スコア (0.0-1.0, 1.0 = 完全に安全) */
  safetyScore: number;
  /** 検出されたカテゴリ */
  detectedCategories: string[];
  /** 通過/ブロック */
  decision: 'PASS' | 'BLOCKED';
}

interface ChunkEvaluation {
  safetyScore: number;
  detectedCategories: string[];
}

// ─── Main Function ─────────────────────────────────────────

/**
 * Permission-filtered チャンクに対してインライン安全性チェックを実行する。
 *
 * - ENABLE_CHUNK_SAFETY_FILTER=true 時のみ実行
 * - GUARDRAIL_ID 設定時は ApplyGuardrail、未設定時はヒューリスティック
 * - スコアが閾値未満のチャンクを除外
 * - タイムアウト/エラー時は Fail-Open（全チャンク通過）
 *
 * @param chunks SID フィルタ済みの許可チャンク
 * @param region AWS リージョン
 * @returns 安全性フィルタ結果
 */
export async function filterByChunkSafety(
  chunks: AllowedDocument[],
  region: string,
): Promise<ChunkSafetyResult> {
  const startTime = Date.now();

  // Feature flag チェック
  if (!CHUNK_SAFETY_ENABLED) {
    return passthrough(chunks, 'SKIP_DISABLED', 0);
  }

  // チャンクが空なら即リターン
  if (chunks.length === 0) {
    return {
      safeChunks: [],
      blockedCount: 0,
      details: [],
      latencyMs: 0,
      method: GUARDRAIL_ID ? 'GUARDRAIL_API' : 'HEURISTIC',
    };
  }

  const method: ChunkSafetyMethod = GUARDRAIL_ID ? 'GUARDRAIL_API' : 'HEURISTIC';

  try {
    // GUARDRAIL_API モードのみ Bedrock クライアントを生成
    const client = GUARDRAIL_ID ? new BedrockRuntimeClient({ region }) : null;

    // 並列度を制限してチャンクを評価（全体タイムアウト付き）
    const evalPromise = evaluateChunksWithConcurrency(client, chunks, CHUNK_SAFETY_CONCURRENCY);
    const checkResults = await Promise.race([
      evalPromise,
      timeoutPromise(CHUNK_SAFETY_TIMEOUT_MS),
    ]);

    // タイムアウト時は Fail-Open
    if (checkResults === null) {
      console.warn('[ChunkSafety] Timeout — passing all chunks (Fail-Open)');
      emitChunkSafetyMetrics('timeout', chunks.length, 0, Date.now() - startTime);
      return passthrough(chunks, 'SKIP_ERROR', Date.now() - startTime);
    }

    // フィルタリング
    const safeChunks: AllowedDocument[] = [];
    const details: ChunkSafetyDetail[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const result = checkResults[i];
      const decision: 'PASS' | 'BLOCKED' =
        result.safetyScore >= SAFETY_SCORE_THRESHOLD ? 'PASS' : 'BLOCKED';
      details.push({
        fileName: chunks[i].fileName,
        safetyScore: result.safetyScore,
        detectedCategories: result.detectedCategories,
        decision,
      });

      if (decision === 'PASS') {
        safeChunks.push(chunks[i]);
      } else {
        // privacy: ブロックされたチャンク本文はログに残さない（カテゴリのみ）
        console.log(`[ChunkSafety] Blocked: ${chunks[i].fileName} (score: ${result.safetyScore}, categories: ${result.detectedCategories.join(',')})`);
      }
    }

    const blockedCount = chunks.length - safeChunks.length;
    const latencyMs = Date.now() - startTime;
    emitChunkSafetyMetrics('success', safeChunks.length, blockedCount, latencyMs);

    if (blockedCount > 0) {
      console.log(`[ChunkSafety] Filtered: ${blockedCount}/${chunks.length} chunks blocked (method: ${method})`);
    }

    return { safeChunks, blockedCount, details, latencyMs, method };
  } catch (error) {
    // Fail-Open: エラー時は全チャンク通過
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[ChunkSafety] Error — passing all chunks (Fail-Open):', errMsg);
    emitChunkSafetyMetrics('error', chunks.length, 0, Date.now() - startTime);
    return passthrough(chunks, 'SKIP_ERROR', Date.now() - startTime);
  }
}

// ─── Internal Functions ────────────────────────────────────

/** 全チャンク通過の結果を生成（Fail-Open / 無効時） */
function passthrough(
  chunks: AllowedDocument[],
  method: ChunkSafetyMethod,
  latencyMs: number,
): ChunkSafetyResult {
  return {
    safeChunks: chunks,
    blockedCount: 0,
    details: [],
    latencyMs,
    method,
  };
}

/**
 * 並列度を制限してチャンクを順次バッチ評価する。
 * Bedrock の ApplyGuardrail スロットリングを避けつつ、結果順序を保つ。
 */
async function evaluateChunksWithConcurrency(
  client: BedrockRuntimeClient | null,
  chunks: AllowedDocument[],
  concurrency: number,
): Promise<ChunkEvaluation[]> {
  const results: ChunkEvaluation[] = new Array(chunks.length);
  const batchSize = Math.max(1, concurrency);

  for (let start = 0; start < chunks.length; start += batchSize) {
    const batch = chunks.slice(start, start + batchSize);
    const batchResults = await Promise.all(
      batch.map(chunk => evaluateChunk(client, chunk)),
    );
    for (let j = 0; j < batchResults.length; j++) {
      results[start + j] = batchResults[j];
    }
  }

  return results;
}

/**
 * 単一チャンクを評価する。
 * - client が null（GUARDRAIL_ID 未設定）の場合はヒューリスティック
 * - それ以外は ApplyGuardrail API
 */
async function evaluateChunk(
  client: BedrockRuntimeClient | null,
  chunk: AllowedDocument,
): Promise<ChunkEvaluation> {
  if (!client) {
    return evaluateChunkHeuristic(chunk);
  }

  try {
    // ApplyGuardrail: source='INPUT' を使用。
    // 取得チャンクはこの後 LLM のプロンプト（入力）にコンテキストとして注入されるため、
    // プロンプトインジェクション（PROMPT_ATTACK）検出は INPUT 側フィルタで評価する必要がある。
    // OUTPUT を指定すると PROMPT_ATTACK フィルタが発火しない。
    const applyCommand = new ApplyGuardrailCommand({
      guardrailIdentifier: GUARDRAIL_ID,
      guardrailVersion: GUARDRAIL_VERSION,
      source: 'INPUT',
      content: [
        {
          text: {
            text: chunk.content.substring(0, MAX_GUARDRAIL_TEXT_LENGTH),
          },
        },
      ],
    });

    const response = await client.send(applyCommand);
    const action = response.action || 'NONE';
    const detectedCategories = extractDetectedCategories(response);

    // スコア: NONE=1.0（安全） / GUARDRAIL_INTERVENED=0.0（危険）
    const safetyScore = action === 'NONE' ? 1.0 : 0.0;
    return { safetyScore, detectedCategories };
  } catch (error) {
    // 個別チャンクのエラーは Fail-Open（スコア 1.0 = 通過）
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[ChunkSafety] Chunk eval error (${chunk.fileName}): ${errMsg.substring(0, 100)}`);
    return { safetyScore: 1.0, detectedCategories: [] };
  }
}

/**
 * ApplyGuardrail レスポンスから検出カテゴリを抽出する。
 */
function extractDetectedCategories(response: {
  assessments?: Array<Record<string, any>>;
}): string[] {
  const detectedCategories: string[] = [];
  if (!response.assessments || !Array.isArray(response.assessments)) {
    return detectedCategories;
  }

  for (const assessment of response.assessments) {
    // Content policy（PROMPT_ATTACK 等を含む）
    for (const filter of assessment.contentPolicy?.filters ?? []) {
      if (filter.action === 'BLOCKED') {
        detectedCategories.push(filter.type || 'CONTENT');
      }
    }
    // Sensitive information policy (PII)
    for (const pii of assessment.sensitiveInformationPolicy?.piiEntities ?? []) {
      if (pii.action === 'BLOCKED' || pii.action === 'ANONYMIZED') {
        detectedCategories.push(`PII:${pii.type || 'UNKNOWN'}`);
      }
    }
    // Word policy
    for (const word of assessment.wordPolicy?.customWords ?? []) {
      if (word.action === 'BLOCKED') {
        detectedCategories.push('CUSTOM_WORD');
      }
    }
  }

  return [...new Set(detectedCategories)];
}

/** プロンプトインジェクション検出パターン（多言語）。best-effort。 */
const INJECTION_PATTERNS: RegExp[] = [
  // English — verb + bounded gap + target noun (handles "ignore all previous instructions")
  /\bignore\b[\s\S]{0,30}?(instructions?|prompts?|rules?|directions?)/i,
  /\bdisregard\b[\s\S]{0,30}?(instructions?|prompts?|rules?|directions?)/i,
  /\bforget\b[\s\S]{0,30}?(instructions?|everything|rules?|context|prompts?)/i,
  /\boverride\b[\s\S]{0,30}?(instructions?|rules?|policies?|prompts?)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /new\s+instructions?\s*[:：]/i,
  /system\s*prompt\s*[:：]/i,
  /\[\s*system\s*\]/i,
  // 日本語
  /(以前|上記|これまで|前|先)の?(指示|命令|プロンプト|ルール)[\s\S]{0,8}(無視|忘れ|破棄|上書き)/,
  /(指示|命令|ルール|ポリシー)[\s\S]{0,4}(無視して|忘れて|上書き)/,
  /あなたは(今|これから)[\s\S]{0,12}(です|になりました|として振る舞)/,
  /システムプロンプト\s*[:：]/,
  // 中文（簡体/繁体）
  /(忽略|无视|無視|忘记|忘記)[\s\S]{0,8}(指令|指示|提示|规则|規則)/,
  /(你现在是|你現在是|你扮演)/,
  // 한국어
  /(이전|위의|모든)[\s\S]{0,6}(지시|명령|규칙)[\s\S]{0,8}(무시|잊어)/,
];

/** PII 検出パターン（基本形）。best-effort。 */
const PII_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, type: 'SSN' },
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/, type: 'CREDIT_CARD' },
];

/**
 * ヒューリスティックベースのチャンク安全性評価。
 * GUARDRAIL_ID 未設定時のフォールバック。
 *
 * ⚠️ これは best-effort であり、セキュリティ保証ではない。
 *   本格的なコンテンツ安全性には GUARDRAIL_ID を設定し ApplyGuardrail を使うこと。
 */
export function evaluateChunkHeuristic(chunk: AllowedDocument): ChunkEvaluation {
  const content = chunk.content;
  const detectedCategories: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      detectedCategories.push('PROMPT_INJECTION');
      break;
    }
  }

  for (const { pattern, type } of PII_PATTERNS) {
    if (pattern.test(content)) {
      detectedCategories.push(`PII:${type}`);
    }
  }

  // Score: injection=0.3（除外）, PII=0.5, clean=1.0
  let safetyScore = 1.0;
  if (detectedCategories.includes('PROMPT_INJECTION')) {
    safetyScore = 0.3;
  } else if (detectedCategories.some(c => c.startsWith('PII:'))) {
    safetyScore = 0.5;
  }

  return { safetyScore, detectedCategories };
}

/** タイムアウト Promise。指定時間後に null を返す。 */
function timeoutPromise(ms: number): Promise<null> {
  return new Promise(resolve => setTimeout(() => resolve(null), ms));
}

// ─── Metrics ───────────────────────────────────────────────

/** チャンク安全性フィルタの CloudWatch EMF メトリクス。 */
function emitChunkSafetyMetrics(
  outcome: 'success' | 'timeout' | 'error',
  passedCount: number,
  blockedCount: number,
  latencyMs: number,
): void {
  console.log(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{
        Namespace: 'PermissionAwareRAG/ChunkSafety',
        Dimensions: [['Outcome']],
        Metrics: [
          { Name: 'ChunksChecked', Unit: 'Count' },
          { Name: 'ChunksPassed', Unit: 'Count' },
          { Name: 'ChunksBlocked', Unit: 'Count' },
          { Name: 'CheckLatency', Unit: 'Milliseconds' },
        ],
      }],
    },
    Outcome: outcome,
    ChunksChecked: passedCount + blockedCount,
    ChunksPassed: passedCount,
    ChunksBlocked: blockedCount,
    CheckLatency: latencyMs,
  }));
}
