import { NextRequest, NextResponse } from 'next/server';
import { BedrockAgentClient, ListKnowledgeBasesCommand } from '@aws-sdk/client-bedrock-agent';

/**
 * Knowledge Base一覧取得API
 * 
 * GET /api/bedrock/knowledge-bases?region=ap-northeast-1
 * 
 * 指定されたリージョンのKnowledge Base一覧を取得します
 * 
 * Requirements: 28.3
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'ap-northeast-1';

    console.log('🔍 [KnowledgeBases] Knowledge Base一覧取得開始:', { region });

    // Bedrock Agentクライアント初期化
    const bedrockAgentClient = new BedrockAgentClient({
      region: region,
    });

    // Knowledge Base一覧取得
    const listCommand = new ListKnowledgeBasesCommand({
      maxResults: 50, // 最大50件
    });

    const response = await bedrockAgentClient.send(listCommand);
    
    // レスポンス整形
    const knowledgeBases = (response.knowledgeBaseSummaries || []).map(kb => ({
      id: kb.knowledgeBaseId,
      name: kb.name,
      description: kb.description || '',
      status: kb.status,
    }));

    console.log(`✅ [KnowledgeBases] ${knowledgeBases.length}件のKnowledge Baseを取得`);

    return NextResponse.json({
      success: true,
      knowledgeBases: knowledgeBases,
      count: knowledgeBases.length,
      region: region
    });

  } catch (error) {
    console.error('❌ [KnowledgeBases] Knowledge Base一覧取得エラー:', error);
    
    // エラーレスポンス
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Knowledge Base一覧の取得に失敗しました',
      knowledgeBases: [],
      count: 0,
      details: {
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
      }
    }, { status: 500 });
  }
}