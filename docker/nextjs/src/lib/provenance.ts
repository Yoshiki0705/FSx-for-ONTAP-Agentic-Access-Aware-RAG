/**
 * Provenance Logger Integration (R-2, #7)
 *
 * RAG回答の根拠情報を非同期でProvenance Logger Lambdaに送信する。
 * Fire-and-forget: 失敗してもRAG応答には影響しない。
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

export interface ProvenanceEvent {
  userId: string;
  query: string;
  responseId: string;
  modelId: string;
  routingTier?: string;
  citations: Array<{
    documentKey: string;
    chunkIndex?: number;
    relevanceScore?: number;
    permissionCheck: 'ALLOWED' | 'DENIED';
    matchedSids?: string[];
  }>;
  suppressedDocuments?: Array<{
    documentKey: string;
    reason: string;
    requiredSids?: string[];
  }>;
  totalTokens?: number;
  responseTimeMs?: number;
}

/**
 * 非同期でProvenance Loggerを呼び出す（fire-and-forget）。
 * 失敗してもエラーを投げない。
 */
export async function logProvenance(event: ProvenanceEvent): Promise<void> {
  const functionName = process.env.PROVENANCE_FUNCTION_NAME;
  if (!functionName) {
    // Lambda未設定時はローカルログのみ
    console.log('[Provenance]', JSON.stringify({
      userId: event.userId,
      responseId: event.responseId,
      citationCount: event.citations.length,
      suppressedCount: event.suppressedDocuments?.length || 0,
    }));
    return;
  }

  try {
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // 非同期（fire-and-forget）
      Payload: Buffer.from(JSON.stringify(event)),
    });

    await lambdaClient.send(command);
  } catch (error) {
    // Fire-and-forget: ログのみ、エラーは伝播しない
    console.warn('[Provenance] Failed to invoke logger:', error);
  }
}
