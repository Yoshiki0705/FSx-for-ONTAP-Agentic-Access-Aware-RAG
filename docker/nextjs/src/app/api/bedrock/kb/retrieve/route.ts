import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
  RetrieveAndGenerateCommandInput,
} from '@aws-sdk/client-bedrock-agent-runtime';

/**
 * RAG検索API Route
 * 
 * POST /api/bedrock/kb/retrieve
 * 
 * Bedrock Knowledge Base RetrieveAndGenerate APIを呼び出し、
 * Permission Serviceによる検索結果フィルタリングを統合する。
 * 
 * Requirements: 4.3, 5.4
 */

interface RetrieveRequest {
  query: string;
  knowledgeBaseId: string;
  modelId?: string;
  userId: string;
  region?: string;
  sessionId?: string;
}

interface Citation {
  generatedResponsePart?: {
    textResponsePart?: {
      text?: string;
      span?: { start?: number; end?: number };
    };
  };
  retrievedReferences?: Array<{
    content?: { text?: string };
    location?: {
      type?: string;
      s3Location?: { uri?: string };
    };
    metadata?: Record<string, unknown>;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: RetrieveRequest = await request.json();
    const {
      query,
      knowledgeBaseId,
      userId,
      sessionId,
    } = body;

    const region = body.region || process.env.BEDROCK_REGION || 'ap-northeast-1';
    const modelId = body.modelId || process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0';

    // 入力検証
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'クエリが空です' },
        { status: 400 }
      );
    }

    if (!knowledgeBaseId) {
      return NextResponse.json(
        { success: false, error: 'Knowledge Base IDが指定されていません' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ユーザーIDが指定されていません' },
        { status: 400 }
      );
    }

    console.log('🔍 [KB Retrieve] RAG検索開始:', {
      query: query.substring(0, 100),
      knowledgeBaseId,
      modelId,
      userId,
      region,
    });

    // Bedrock Agent Runtimeクライアント初期化
    const client = new BedrockAgentRuntimeClient({ region });

    // Inference profile解決: ap-northeast-1ではAPACプロファイルを使用
    const { resolveInferenceProfile } = await import('@/lib/inference-profile-resolver');
    const resolvedModelId = resolveInferenceProfile(modelId, region);
    
    // RetrieveAndGenerate APIのmodelArnはinference profileの場合ARN形式が必要
    let modelArn: string;
    if (resolvedModelId.match(/^(us|eu|apac)\./)) {
      // Inference profile: ARN形式で指定
      const accountId = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT || '';
      modelArn = `arn:aws:bedrock:${region}:${accountId}:inference-profile/${resolvedModelId}`;
    } else {
      // 通常のモデル: foundation-model ARN
      modelArn = `arn:aws:bedrock:${region}::foundation-model/${resolvedModelId}`;
    }

    console.log('🎯 [KB Retrieve] モデル解決:', {
      original: modelId,
      resolved: resolvedModelId,
      modelArn,
    });

    const input: RetrieveAndGenerateCommandInput = {
      input: { text: query },
      retrieveAndGenerateConfiguration: {
        type: 'KNOWLEDGE_BASE',
        knowledgeBaseConfiguration: {
          knowledgeBaseId,
          modelArn,
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: 10,
            },
          },
        },
      },
    };

    // セッションIDがある場合は会話継続
    if (sessionId) {
      input.sessionId = sessionId;
    }

    const command = new RetrieveAndGenerateCommand(input);
    const response = await client.send(command);

    console.log('✅ [KB Retrieve] Bedrock KB応答受信:', {
      hasOutput: !!response.output,
      outputLength: response.output?.text?.length,
      citationCount: response.citations?.length || 0,
      sessionId: response.sessionId,
    });

    // Citation情報を整形
    const citations: Citation[] = response.citations || [];
    const formattedCitations = citations.flatMap((citation) => {
      const refs = citation.retrievedReferences || [];
      return refs.map((ref) => {
        const s3Uri = ref.location?.s3Location?.uri || '';
        const fileName = s3Uri.split('/').pop() || s3Uri;
        return {
          fileName,
          s3Uri,
          content: ref.content?.text?.substring(0, 500) || '',
          metadata: ref.metadata || {},
        };
      });
    });

    // Permission Serviceによるフィルタリング
    let filteredCitations = formattedCitations;
    let filterLog = {
      totalDocuments: formattedCitations.length,
      allowedDocuments: formattedCitations.length,
      deniedDocuments: 0,
      userId,
      timestamp: new Date().toISOString(),
    };

    try {
      const permissionResponse = await fetch(
        `${getBaseUrl(request)}/api/permission/status?userId=${encodeURIComponent(userId)}`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (permissionResponse.ok) {
        const permData = await permissionResponse.json();
        if (permData.success && permData.permissions) {
          // メタデータのaccess_levelに基づくフィルタリング
          const userLevel = permData.permissions.permissionLevel || 'restricted';
          filteredCitations = formattedCitations.filter((cite) => {
            const accessLevel = (cite.metadata as Record<string, string>)?.access_level || 'public';
            if (accessLevel === 'public') return true;
            if (accessLevel === 'restricted' && (userLevel === 'admin' || userLevel === 'restricted')) return true;
            if (accessLevel === 'confidential' && userLevel === 'admin') return true;
            return false;
          });

          filterLog = {
            totalDocuments: formattedCitations.length,
            allowedDocuments: filteredCitations.length,
            deniedDocuments: formattedCitations.length - filteredCitations.length,
            userId,
            timestamp: new Date().toISOString(),
          };

          console.log('🔐 [KB Retrieve] Permission filtering applied:', filterLog);
        }
      }
    } catch (permError) {
      // Permission Service失敗時は安全側にフォールバック（全ドキュメント拒否）
      console.error('❌ [KB Retrieve] Permission check failed, denying all:', permError);
      filteredCitations = [];
      filterLog = {
        totalDocuments: formattedCitations.length,
        allowedDocuments: 0,
        deniedDocuments: formattedCitations.length,
        userId,
        timestamp: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      answer: response.output?.text || '',
      citations: filteredCitations,
      filterLog,
      sessionId: response.sessionId,
      metadata: {
        knowledgeBaseId,
        modelId,
        region,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ [KB Retrieve] RAG検索エラー:', error);

    const errorName = error instanceof Error ? error.constructor.name : 'UnknownError';
    const errorMessage = error instanceof Error ? error.message : 'RAG検索に失敗しました';

    // エラー種別に応じたメッセージ
    const errorMessages: Record<string, { ja: string; en: string }> = {
      ThrottlingException: {
        ja: 'リクエストが多すぎます。しばらく待ってから再試行してください。',
        en: 'Too many requests. Please wait and try again.',
      },
      ServiceUnavailableException: {
        ja: 'サービスが一時的に利用できません。しばらく待ってから再試行してください。',
        en: 'Service temporarily unavailable. Please try again later.',
      },
      ValidationException: {
        ja: '入力内容を確認してください。',
        en: 'Please check your input.',
      },
    };

    const userMessage = errorMessages[errorName] || {
      ja: 'エラーが発生しました。再試行してください。',
      en: 'An error occurred. Please try again.',
    };

    return NextResponse.json(
      {
        success: false,
        error: userMessage.ja,
        errorEn: userMessage.en,
        errorType: errorName,
        details: errorMessage,
      },
      { status: errorName === 'ThrottlingException' ? 429 : 500 }
    );
  }
}

/** リクエストからベースURLを取得 */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}
