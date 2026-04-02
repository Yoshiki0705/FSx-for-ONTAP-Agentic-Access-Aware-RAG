/**
 * AgentCore Memory セッション管理API
 *
 * POST: セッション作成（CreateEvent で暗黙的にセッション作成）
 * GET:  セッション取得（ListSessions / ListEvents）
 * DELETE: セッション削除（ListEvents + DeleteEvent）
 *
 * 認証: Cognito JWT（sessionManager経由）
 * actorId = Cognito userId
 *
 * Requirements: 3.1, 3.3, 3.4
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentCoreClient,
  CreateEventCommand,
  ListSessionsCommand,
  ListEventsCommand,
  DeleteEventCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import { sessionManager } from '@/lib/auth/session-manager';
import { authenticateRequest } from '@/lib/agentcore/auth';
import { saveSessionMetadata, getSessionList } from '@/lib/agentcore/session-metadata';
import { v4 as uuidv4 } from 'uuid';

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
 * POST /api/agentcore/memory/session
 * セッション作成
 *
 * AgentCore Memory にはセッション作成 API がないため、
 * CreateEvent で初期化イベントを送信してセッションを暗黙的に作成する。
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
    const { mode } = body;
    const sessionId = uuidv4();
    const actorId = auth.userId;

    console.log('[AgentCore Session] セッション作成:', { sessionId, actorId, mode });

    // CreateEvent で初期化イベントを送信してセッションを確立
    const client = getAgentCoreClient();
    const command = new CreateEventCommand({
      memoryId: MEMORY_ID,
      actorId,
      sessionId,
      eventTimestamp: new Date(),
      payload: [
        {
          conversational: {
            content: { text: `Session initialized (mode: ${mode || 'agent'})` },
            role: 'OTHER',
          },
        },
      ],
    });

    const response = await client.send(command);

    const finalSessionId = response.event?.sessionId || sessionId;

    console.log('[AgentCore Session] セッション作成成功:', {
      sessionId: finalSessionId,
      eventId: response.event?.eventId,
    });

    // セッションメタデータを DynamoDB に保存
    try {
      await saveSessionMetadata(actorId, finalSessionId, {
        mode: mode || 'agent',
        messageCount: 0,
      });
    } catch (metadataError) {
      // メタデータ保存失敗は非致命的 — セッション自体は作成済み
      console.warn('[AgentCore Session] メタデータ保存失敗（非致命的）:', metadataError);
    }

    return NextResponse.json({
      success: true,
      session: {
        sessionId: finalSessionId,
        actorId,
        mode: mode || 'agent',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[AgentCore Session] セッション作成エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create session' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agentcore/memory/session
 * セッション取得
 *
 * - sessionId パラメータあり: ListEvents でセッション内イベントを取得
 * - sessionId パラメータなし: ListSessions でユーザーのセッション一覧を取得
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
    const actorId = auth.userId;
    const client = getAgentCoreClient();

    if (sessionId) {
      // 特定セッションのイベントを取得
      console.log('[AgentCore Session] セッション取得:', { sessionId, actorId });

      const command = new ListEventsCommand({
        memoryId: MEMORY_ID,
        sessionId,
        actorId,
        includePayloads: true,
      });

      const response = await client.send(command);
      const events = response.events || [];

      // 最初のイベントの timestamp をセッション作成日時として使用
      const createdAt = events.length > 0
        ? events[0].eventTimestamp?.toISOString()
        : new Date().toISOString();

      return NextResponse.json({
        success: true,
        session: {
          sessionId,
          actorId,
          createdAt,
          eventCount: events.length,
        },
        events,
      });
    } else {
      // ユーザーのセッション一覧を取得（DynamoDB メタデータ + AgentCore ListSessions）
      console.log('[AgentCore Session] セッション一覧取得:', { actorId });

      // DynamoDB からセッションメタデータを取得
      let metadataSessions: any[] = [];
      try {
        const metadataList = await getSessionList(actorId);
        metadataSessions = metadataList.map((item) => ({
          sessionId: item.sessionId,
          title: item.title,
          mode: item.mode,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          messageCount: item.messageCount,
        }));
      } catch (metadataError) {
        console.warn('[AgentCore Session] メタデータ取得失敗（フォールバック）:', metadataError);
      }

      // AgentCore ListSessions も取得（メタデータにないセッションを補完）
      let agentCoreSessions: any[] = [];
      try {
        const command = new ListSessionsCommand({
          memoryId: MEMORY_ID,
          actorId,
        });
        const response = await client.send(command);
        agentCoreSessions = response.sessionSummaries || [];
      } catch (listError) {
        console.warn('[AgentCore Session] ListSessions 失敗（非致命的）:', listError);
      }

      // メタデータがある場合はそちらを優先、なければ AgentCore の結果を使用
      const sessions = metadataSessions.length > 0 ? metadataSessions : agentCoreSessions;

      return NextResponse.json({
        success: true,
        sessions,
      });
    }
  } catch (error: any) {
    console.error('[AgentCore Session] セッション取得エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agentcore/memory/session
 * セッション削除
 *
 * セッション内の全イベントを ListEvents で取得し、各イベントを DeleteEvent で削除する。
 */
export async function DELETE(request: NextRequest) {
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
    const actorId = auth.userId;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    console.log('[AgentCore Session] セッション削除:', { sessionId, actorId });

    const client = getAgentCoreClient();

    // セッション内の全イベントを取得
    const listCommand = new ListEventsCommand({
      memoryId: MEMORY_ID,
      sessionId,
      actorId,
    });

    const listResponse = await client.send(listCommand);
    const events = listResponse.events || [];

    // 各イベントを削除
    let deletedCount = 0;
    for (const event of events) {
      try {
        await client.send(
          new DeleteEventCommand({
            memoryId: MEMORY_ID,
            sessionId,
            actorId,
            eventId: event.eventId,
          })
        );
        deletedCount++;
      } catch (deleteError) {
        console.warn('[AgentCore Session] イベント削除失敗:', event.eventId, deleteError);
      }
    }

    console.log('[AgentCore Session] セッション削除完了:', {
      sessionId,
      totalEvents: events.length,
      deletedCount,
    });

    return NextResponse.json({
      success: true,
      sessionId,
      deletedEvents: deletedCount,
    });
  } catch (error: any) {
    console.error('[AgentCore Session] セッション削除エラー:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete session' },
      { status: 500 }
    );
  }
}
