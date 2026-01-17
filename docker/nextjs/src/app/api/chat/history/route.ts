/**
 * チャット履歴API（統合版）
 * GET: 履歴取得
 * POST: 履歴保存
 * DELETE: 履歴削除
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  QueryCommand, 
  PutCommand, 
  DeleteCommand 
} from '@aws-sdk/lib-dynamodb';
import { sessionManager } from '@/lib/auth/session-manager';

// Dynamic Server Usage対応
export const dynamic = 'force-dynamic';

// DynamoDBクライアント初期化
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// GET: チャット履歴取得
export async function GET(request: NextRequest) {
  try {
    // セッション検証
    const session = await sessionManager.getSessionFromCookies();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      );
    }

    const userId = session.userId;
    const tableName = process.env.DYNAMODB_CHAT_HISTORY_TABLE;

    if (!tableName) {
      console.error('❌ DYNAMODB_CHAT_HISTORY_TABLE環境変数が設定されていません');
      return NextResponse.json(
        { success: false, error: 'サーバー設定エラー' },
        { status: 500 }
      );
    }

    console.log('📖 [API] チャット履歴取得開始:', userId);

    // DynamoDBからクエリ
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // 新しい順
      Limit: 50,
    });

    const result = await docClient.send(command);

    console.log('✅ [API] チャット履歴取得成功:', result.Items?.length || 0);

    return NextResponse.json({
      success: true,
      sessions: result.Items || [],
      count: result.Items?.length || 0,
    });
  } catch (error: any) {
    console.error('❌ [API] チャット履歴取得エラー:', error);
    return NextResponse.json(
      { success: false, error: 'チャット履歴の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST: チャット履歴保存
export async function POST(request: NextRequest) {
  try {
    // セッション検証
    const session = await sessionManager.getSessionFromCookies();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      );
    }

    const userId = session.userId;
    const body = await request.json();
    const { sessionId, title, messages, createdAt, updatedAt, mode } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionIdは必須です' },
        { status: 400 }
      );
    }

    const tableName = process.env.DYNAMODB_CHAT_HISTORY_TABLE;
    if (!tableName) {
      console.error('❌ DYNAMODB_CHAT_HISTORY_TABLE環境変数が設定されていません');
      return NextResponse.json(
        { success: false, error: 'サーバー設定エラー' },
        { status: 500 }
      );
    }

    console.log('💾 [API] チャット履歴保存開始:', { sessionId, userId });

    // DynamoDBに保存
    const command = new PutCommand({
      TableName: tableName,
      Item: {
        userId,
        sessionId,
        title: title || '新しいチャット',
        messages: messages || [],
        mode: mode || 'agent',
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: updatedAt || new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90日
      },
    });

    await docClient.send(command);

    console.log('✅ [API] チャット履歴保存成功:', sessionId);

    return NextResponse.json({
      success: true,
      message: 'チャット履歴を保存しました',
      sessionId,
    });
  } catch (error: any) {
    console.error('❌ [API] チャット履歴保存エラー:', error);
    return NextResponse.json(
      { success: false, error: 'チャット履歴の保存に失敗しました' },
      { status: 500 }
    );
  }
}

// DELETE: チャット履歴削除
export async function DELETE(request: NextRequest) {
  try {
    // セッション検証
    const session = await sessionManager.getSessionFromCookies();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      );
    }

    const userId = session.userId;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionIdは必須です' },
        { status: 400 }
      );
    }

    const tableName = process.env.DYNAMODB_CHAT_HISTORY_TABLE;
    if (!tableName) {
      console.error('❌ DYNAMODB_CHAT_HISTORY_TABLE環境変数が設定されていません');
      return NextResponse.json(
        { success: false, error: 'サーバー設定エラー' },
        { status: 500 }
      );
    }

    console.log('🗑️ [API] チャット履歴削除開始:', { sessionId, userId });

    // DynamoDBから削除
    const command = new DeleteCommand({
      TableName: tableName,
      Key: {
        userId,
        sessionId,
      },
    });

    await docClient.send(command);

    console.log('✅ [API] チャット履歴削除成功:', sessionId);

    return NextResponse.json({
      success: true,
      message: 'チャット履歴を削除しました',
      sessionId,
    });
  } catch (error: any) {
    console.error('❌ [API] チャット履歴削除エラー:', error);
    return NextResponse.json(
      { success: false, error: 'チャット履歴の削除に失敗しました' },
      { status: 500 }
    );
  }
}
