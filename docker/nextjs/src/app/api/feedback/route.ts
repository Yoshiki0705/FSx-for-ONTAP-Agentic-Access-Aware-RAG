/**
 * POST /api/feedback — a thumbs up or down on one answer.
 *
 * The collector Lambda stores it. This route never reports success unless the Lambda did:
 * with no collector configured it answers 503, and a Lambda error or a non-200 answer from
 * the Lambda is passed on as 400 (input refused) or 502 (not saved). The user comes from the
 * signed-in session, not from a cookie the browser can set.
 */
import { NextRequest, NextResponse } from 'next/server';
import { InvokeCommand } from '@aws-sdk/client-lambda';
import { sessionUserId } from '@/lib/agent-backend';
import { docIdsOf } from '@/lib/feedback/doc-id';
import { feedbackLambda } from '@/lib/feedback/lambda-client';

const RESPONSE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export async function POST(request: NextRequest) {
  const functionName = process.env.FEEDBACK_FUNCTION_NAME;
  if (!functionName) {
    return NextResponse.json({ success: false, error: 'feedback_disabled' }, { status: 503 });
  }
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'invalid JSON' }, { status: 400 });
  }
  if (body.rating !== 'positive' && body.rating !== 'negative') {
    return NextResponse.json({ success: false, error: 'rating must be "positive" or "negative"' }, { status: 400 });
  }
  if (typeof body.responseId !== 'string' || !RESPONSE_ID.test(body.responseId)) {
    return NextResponse.json({ success: false, error: 'responseId must match [A-Za-z0-9_-]{1,64}' }, { status: 400 });
  }

  const payload = {
    userId,
    responseId: body.responseId,
    rating: body.rating,
    comment: text(body.comment, 1000),
    query: text(body.query, 500),
    // A tier name (`tier:light`) names a choice, not a model, so it is not stored.
    modelId: text(body.modelId, 128).startsWith('tier:') ? '' : text(body.modelId, 128),
    routingTier: text(body.routingTier, 128),
    // The browser sends the S3 URIs of the citations it showed; only their hashes are kept.
    sourceDocIds: docIdsOf(body.sourcePaths),
  };

  try {
    const out = (await feedbackLambda().send(
      new InvokeCommand({ FunctionName: functionName, InvocationType: 'RequestResponse', Payload: Buffer.from(JSON.stringify(payload)) }),
    )) as { FunctionError?: string; Payload?: Uint8Array };
    if (out.FunctionError) {
      console.error(JSON.stringify({ event: 'feedback_function_error', error: out.FunctionError }));
      return NextResponse.json({ success: false, error: 'feedback could not be saved' }, { status: 502 });
    }
    const result = JSON.parse(new TextDecoder().decode(out.Payload)) as { statusCode?: number; feedbackId?: string; error?: string };
    if (result.statusCode === 200 && result.feedbackId) {
      return NextResponse.json({ success: true, feedbackId: result.feedbackId });
    }
    if (result.statusCode === 400) {
      return NextResponse.json({ success: false, error: String(result.error || 'invalid feedback').slice(0, 200) }, { status: 400 });
    }
    console.error(JSON.stringify({ event: 'feedback_not_saved', statusCode: result.statusCode }));
    return NextResponse.json({ success: false, error: 'feedback could not be saved' }, { status: 502 });
  } catch (error) {
    console.error(JSON.stringify({ event: 'feedback_invoke_failed', error: error instanceof Error ? error.name : 'unknown' }));
    return NextResponse.json({ success: false, error: 'feedback could not be saved' }, { status: 502 });
  }
}
