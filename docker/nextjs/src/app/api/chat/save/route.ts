/**
 * チャット履歴保存API
 * DynamoDBにチャットセッションを保存
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// DynamoDBクライアントの初期化
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userId, title, messages, createdAt, updatedAt } = body;

    // 必須パラメータの検証
    if (!sessionId || !userId) {
      return NextResponse.json(
        { success: false, error: 'sessionIdとuserIdは必須です' },
        { status: 400 }
      );
    }

    const tableName = process.env.CHAT_HISTORY_TABLE_NAME;
    if (!tableName) {
      console.error('❌ CHAT_HISTORY_TABLE_NAME環境変数が設定されていません');
      return NextResponse.json(
        { success: false, error: 'サーバー設定エラー' },
        { status: 500 }
      );
    }

    console.log('💾 [API] チャット履歴保存開始:', { sessionId, userId, messageCount: messages?.length });

    // DynamoDBに保存
    const command = new PutCommand({
      TableName: tableName,
      Item: {
        userId,
        sessionId,
        title: title || '新しいチャット',
        messages: messages || [],
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: updatedAt || new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90日後に自動削除
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
      {
        success: false,
        error: 'チャット履歴の保存に失敗しました',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
