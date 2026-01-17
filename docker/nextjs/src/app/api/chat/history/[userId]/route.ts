/**
 * チャット履歴読み込みAPI
 * DynamoDBからユーザーのチャットセッション一覧を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

// DynamoDBクライアントの初期化
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userIdは必須です' },
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

    console.log('📖 [API] チャット履歴読み込み開始:', userId);

    // DynamoDBからクエリ
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // 新しい順にソート
      Limit: 50, // 最大50セッション
    });

    const result = await docClient.send(command);

    console.log('✅ [API] チャット履歴読み込み成功:', result.Items?.length || 0, 'セッション');

    return NextResponse.json({
      success: true,
      sessions: result.Items || [],
      count: result.Items?.length || 0,
    });
  } catch (error: any) {
    console.error('❌ [API] チャット履歴読み込みエラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'チャット履歴の読み込みに失敗しました',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
