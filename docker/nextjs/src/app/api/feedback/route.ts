/**
 * Feedback API Route (K-4, #11)
 *
 * ユーザーフィードバック（👍/👎）を収集し、feedback-collector Lambda に転送する。
 */

import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { responseId, rating, comment, query, modelId, routingTier } = body;

    // Validation
    if (!rating || !['positive', 'negative'].includes(rating)) {
      return NextResponse.json(
        { error: 'rating must be "positive" or "negative"' },
        { status: 400 }
      );
    }

    // Get userId from session cookie
    const userId = request.cookies.get('userEmail')?.value || 'anonymous';

    const feedbackFunctionName = process.env.FEEDBACK_FUNCTION_NAME;
    if (!feedbackFunctionName) {
      // Fallback: log locally if Lambda not configured
      console.log('[Feedback]', JSON.stringify({ userId, rating, responseId, query: query?.slice(0, 50) }));
      return NextResponse.json({ success: true, feedbackId: 'local-' + Date.now() });
    }

    // Invoke feedback-collector Lambda
    const payload = {
      userId,
      responseId: responseId || '',
      rating,
      comment: comment || '',
      query: query || '',
      modelId: modelId || '',
      routingTier: routingTier || '',
    };

    const command = new InvokeCommand({
      FunctionName: feedbackFunctionName,
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    const response = await lambdaClient.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Payload));

    return NextResponse.json({
      success: true,
      feedbackId: result.feedbackId || 'submitted',
    });
  } catch (error) {
    console.error('[Feedback API Error]', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
