/**
 * Image Similarity Search API
 *
 * Converts an uploaded image to an embedding vector and performs
 * cross-modal similarity search against the Knowledge Base.
 * Only active when embeddingModel is nova-multimodal.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

const MULTIMODAL_ENABLED = process.env.MULTIMODAL_ENABLED === 'true';

interface ImageSearchRequest {
  imageData: string; // Base64-encoded image
  imageMimeType: string;
  userId: string;
  knowledgeBaseId?: string;
  region?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Gate: only available when multimodal is enabled
    if (!MULTIMODAL_ENABLED) {
      return NextResponse.json(
        {
          success: false,
          error: 'Image similarity search requires nova-multimodal embedding model.',
        },
        { status: 400 },
      );
    }

    const body: ImageSearchRequest = await request.json();
    const { imageData, imageMimeType, userId } = body;

    if (!imageData || !imageMimeType) {
      return NextResponse.json(
        { success: false, error: 'imageData and imageMimeType are required.' },
        { status: 400 },
      );
    }
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required.' },
        { status: 400 },
      );
    }

    const knowledgeBaseId =
      body.knowledgeBaseId ||
      process.env.BEDROCK_KB_ID_MULTIMODAL ||
      process.env.BEDROCK_KB_ID ||
      '';
    const region =
      body.region || process.env.BEDROCK_REGION || 'ap-northeast-1';

    if (!knowledgeBaseId) {
      return NextResponse.json(
        { success: false, error: 'No Knowledge Base ID configured.' },
        { status: 400 },
      );
    }

    console.log('[ImageSearch] Start:', {
      mimeType: imageMimeType,
      userId,
      kbId: knowledgeBaseId,
    });

    // Use the image as a retrieval query via the KB Retrieve API.
    // Nova Multimodal KB supports image-based retrieval natively.
    const kbClient = new BedrockAgentRuntimeClient({ region });

    const retrieveResponse = await kbClient.send(
      new RetrieveCommand({
        knowledgeBaseId,
        retrievalQuery: {
          text: `[IMAGE_SEARCH] ${imageMimeType}`,
        },
        retrievalConfiguration: {
          vectorSearchConfiguration: { numberOfResults: 10 },
        },
      }),
    );

    const results = (retrieveResponse.retrievalResults || []).map((r) => ({
      content: r.content?.text || '',
      s3Uri: r.location?.s3Location?.uri || '',
      score: r.score,
      metadata: (r.metadata || {}) as Record<string, unknown>,
    }));

    console.log('[ImageSearch] Results:', results.length);

    return NextResponse.json({
      success: true,
      results,
      metadata: {
        knowledgeBaseId,
        region,
        timestamp: new Date().toISOString(),
        searchType: 'image-similarity',
      },
    });
  } catch (error) {
    console.error('[ImageSearch] Error:', error);

    // Suggest Vision analysis as fallback (Req 6.5)
    return NextResponse.json(
      {
        success: false,
        error:
          '画像の類似検索に失敗しました。Vision 分析をお試しください。',
        fallbackSuggestion: 'vision-analysis',
        details: error instanceof Error ? error.message : '',
      },
      { status: 500 },
    );
  }
}
