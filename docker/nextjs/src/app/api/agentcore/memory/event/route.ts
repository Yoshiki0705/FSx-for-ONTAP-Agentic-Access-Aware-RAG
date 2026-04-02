/**
 * AgentCore Memory イベント管理API
 *
 * POST: イベント記録（CreateEvent API、conversational payload）
 * GET:  メモリ取得（ListEvents + RetrieveMemoryRecords）
 *
 * 認証: Cognito JWT（sessionManager経由）
 * actorId = Cognito userId
 *
 * Requirements: 1.3, 2.4, 3.1, 3.2
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentCoreClient,
  CreateEventCommand,
  ListEventsCommand,
  RetrieveMemoryRecordsCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import { sessionManager } from '@/lib/auth/session-manager';
import { authenticateRequest } from '@/lib/agentcore/auth';
import { updateSessionMetadata } from '@/lib/agentcore/session-metadata';

export const dynamic = 'force-dynamic';

// 環境変数
const MEMORY_ID = process.env.AGENTCORE_MEMORY_ID || '';
const ENABLE_AGENTCORE_MEMORY = process.env.ENABLE_AGENTCORE_MEMORY === 'true';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';

// BedrockAgentCoreClient の遅延初期化
let agentCoreClient: BedrockAgentCoreClient | null = null;

function getAgentCoreClient(): BedrockAgentCoreClient {
  if (!agentCoreClient) {
    agentCoreClient = new BedrockAgentCoreClient({ region: AWS_REGION });
  }
  return agentCoreClient;
}

/**
 * 認証は @/lib/agentcore/auth の共通モジュールを使用
 * （Cookie JWT検証のみ、DynamoDBアクセスなし）
 */

/**
 * POST /api/agentcore/memory/event
 * イベント記録（CreateEvent API）
 *
 * Body:
 *   sessionId: string — セッションID
 *   event: {
 *     type: 'USER_MESSAGE' | 'ASSISTANT_MESSAGE'
 *     content: string — メッセージ内容
 *     timestamp?: number — タイムスタンプ
 *     metadata?: Record<string, string>
 *   }
 *
 * AgentCore Memory の CreateEvent に conversational payload を送信する。
 * フロントエンドの AgentCoreMemoryProvider.addMessage() から呼び出される。
 */
export async function POST(request: NextRequest) {
  // Feature flag チェック
  if (!ENABLE_AGENTCORE_MEMORY) {
    return NextResponse.json(
      { success: false, error: 'AgentCore Memory is not enabled' },
      { status: 501 }
    );
  }

  try {
    // 認証
    const auth = await authenticateRequest();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sessionId, event: eventData } = body;

    if (!sessionId || !eventData?.content) {
      return NextResponse.json(
        { success: false, error: 'sessionId and event.content are required' },
        { status: 400 }
      );
    }

    const actorId = auth.userId;

    // event.type から AgentCore の role にマッピング
    const role = eventData.type === 'USER_MESSAGE' ? 'USER' : 'ASSISTANT';

    console.log('[AgentCore Event] イベント記録:', {
      sessionId,
      actorId,
      role,
      contentLength: eventData.content.length,
    });

    const client = getAgentCoreClient();

    // メタデータの構築
    const metadata: Record<string, { stringValue: string }> = {};
    if (eventData.metadata?.messageId) {
      metadata['messageId'] = { stringValue: eventData.metadata.messageId };
    }

    const command = new CreateEventCommand({
      memoryId: MEMORY_ID,
      actorId,
      sessionId,
      eventTimestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
      payload: [
        {
          conversational: {
            content: { text: eventData.content },
            role,
          },
        },
      ],
      ...(Object.keys(metadata).length > 0 && { metadata }),
    });

    const response = await client.send(command);

    console.log('[AgentCore Event] イベント記録成功:', {
      eventId: response.event?.eventId,
      sessionId: response.event?.sessionId,
    });

    // セッションメタデータを更新（messageCount + updatedAt）
    try {
      await updateSessionMetadata(actorId, sessionId, {
        messageCount: (eventData.metadata?.currentMessageCount ?? 0) + 1,
      });
    } catch (metadataError) {
      // メタデータ更新失敗は非致命的
      console.warn('[AgentCore Event] メタデータ更新失敗（非致命的）:', metadataError);
    }

    return NextResponse.json({
      success: true,
      event: {
        eventId: response.event?.eventId,
        sessionId: response.event?.sessionId,
        actorId: response.event?.actorId,
        timestamp: response.event?.eventTimestamp?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[AgentCore Event] イベント記録エラー:', error);

    // ステートレスフォールバック: API失敗時もフロントエンドが動作を継続できるレスポンス
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create event',
        fallback: true,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agentcore/memory/event
 * メモリ取得（ListEvents + RetrieveMemoryRecords）
 *
 * Query params:
 *   sessionId: string — セッションID（必須）
 *   k: number — 取得件数（デフォルト: 50）
 *
 * 短期メモリ（ListEvents）と長期メモリ（RetrieveMemoryRecords）の両方を取得し、
 * フロントエンドの AgentCoreMemoryProvider.getMessages() に返す。
 */
export async function GET(request: NextRequest) {
  // Feature flag チェック
  if (!ENABLE_AGENTCORE_MEMORY) {
    return NextResponse.json(
      { success: false, error: 'AgentCore Memory is not enabled' },
      { status: 501 }
    );
  }

  try {
    // 認証
    const auth = await authenticateRequest();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const k = parseInt(searchParams.get('k') || '50', 10);

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const actorId = auth.userId;
    const client = getAgentCoreClient();

    console.log('[AgentCore Event] メモリ取得:', { sessionId, actorId, k });

    // 短期メモリ: ListEvents でセッション内の会話イベントを取得
    const listCommand = new ListEventsCommand({
      memoryId: MEMORY_ID,
      sessionId,
      actorId,
      includePayloads: true,
      maxResults: k,
    });

    const listResponse = await client.send(listCommand);
    const rawEvents = listResponse.events || [];

    // イベントをフロントエンド形式に変換
    const events = rawEvents.map((event) => {
      const conversational = event.payload?.[0]?.conversational;
      const role = conversational?.role;
      const content = conversational?.content?.text || '';

      return {
        id: event.eventId,
        sessionId: event.sessionId,
        type: role === 'USER' ? 'USER_MESSAGE' : 'ASSISTANT_MESSAGE',
        content,
        role: role === 'USER' ? 'user' : 'assistant',
        timestamp: event.eventTimestamp?.getTime() || Date.now(),
        metadata: event.metadata,
      };
    });

    // 長期メモリ: RetrieveMemoryRecords で関連する長期メモリを取得
    let longTermMemories: any[] = [];
    try {
      // 直近のユーザーメッセージを検索クエリとして使用
      const lastUserEvent = rawEvents
        .filter((e) => e.payload?.[0]?.conversational?.role === 'USER')
        .pop();
      const searchQuery = lastUserEvent?.payload?.[0]?.conversational?.content?.text;

      if (searchQuery) {
        const retrieveCommand = new RetrieveMemoryRecordsCommand({
          memoryId: MEMORY_ID,
          namespace: actorId,
          searchCriteria: {
            searchQuery,
            topK: 5,
          },
          maxResults: 5,
        });

        const retrieveResponse = await client.send(retrieveCommand);
        longTermMemories = (retrieveResponse.memoryRecordSummaries || []).map((record) => ({
          id: record.memoryRecordId,
          content: record.content?.text || '',
          strategyId: record.memoryStrategyId,
          score: record.score,
          createdAt: record.createdAt?.toISOString(),
        }));
      }
    } catch (memoryError) {
      // 長期メモリ取得失敗は非致命的 — 短期メモリのみで続行
      console.warn('[AgentCore Event] 長期メモリ取得失敗（非致命的）:', memoryError);
    }

    console.log('[AgentCore Event] メモリ取得成功:', {
      eventCount: events.length,
      longTermMemoryCount: longTermMemories.length,
    });

    return NextResponse.json({
      success: true,
      events,
      longTermMemories,
      sessionId,
      total: events.length,
    });
  } catch (error: any) {
    console.error('[AgentCore Event] メモリ取得エラー:', error);

    // ステートレスフォールバック: 空のイベントリストを返してフロントエンドが動作を継続
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to retrieve events',
        fallback: true,
        events: [],
        longTermMemories: [],
      },
      { status: 500 }
    );
  }
}
