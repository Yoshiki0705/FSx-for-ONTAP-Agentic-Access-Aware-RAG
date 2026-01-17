/**
 * セッション管理API - 機能復旧用
 * 
 * 機能:
 * - セッション作成・取得・更新・削除
 * - JWT認証との統合
 * - DynamoDB永続化
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { SignJWT, jwtVerify } from 'jose';
import { v4 as uuidv4 } from 'uuid';

// DynamoDBクライアント初期化
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SESSION_TABLE_NAME = process.env.SESSION_TABLE_NAME || 'permission-aware-rag-sessions';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

interface SessionData {
  sessionId: string;
  userId: string;
  username: string;
  email?: string;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: number;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    loginMethod?: string;
  };
}

/**
 * セッション作成 (POST)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, username, email, metadata } = body;

    if (!userId || !username) {
      return NextResponse.json(
        { error: 'userId and username are required' },
        { status: 400 }
      );
    }

    // セッションID生成
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7日後

    // セッションデータ作成
    const sessionData: SessionData = {
      sessionId,
      userId,
      username,
      email,
      createdAt: now.toISOString(),
      lastAccessedAt: now.toISOString(),
      expiresAt,
      metadata: {
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
        loginMethod: metadata?.loginMethod || 'password',
        ...metadata
      }
    };

    // DynamoDBに保存
    await docClient.send(new PutCommand({
      TableName: SESSION_TABLE_NAME,
      Item: sessionData
    }));

    // JWTトークン生成（joseライブラリ使用）
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT({ 
      sessionId, 
      userId, 
      username,
      email 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    console.log(`✅ セッション作成成功: ${sessionId} (ユーザー: ${username})`);

    return NextResponse.json({
      success: true,
      sessionId,
      token,
      expiresAt: sessionData.expiresAt,
      user: {
        userId,
        username,
        email
      }
    });

  } catch (error) {
    console.error('❌ セッション作成エラー:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

/**
 * セッション取得 (GET)
 * JWT検証のみ（DynamoDBアクセス不要）
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
    const cookieToken = request.cookies.get('session-token')?.value;

    // トークンの優先順位: Authorizationヘッダー > Cookie
    const token = authHeader || cookieToken;

    if (!token) {
      console.error('[SessionAPI] トークンが見つかりません');
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 401 }
      );
    }

    // JWT検証
    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      
      const sessionId = payload.sessionId as string;
      const userId = payload.userId as string;
      const username = payload.username as string || userId;
      const email = payload.email as string;
      
      console.log(`[SessionAPI] JWT検証成功: sessionId=${sessionId}, userId=${userId}, username=${username}`);

      // JWTペイロードからセッション情報を返す（DynamoDBアクセス不要）
      return NextResponse.json({
        success: true,
        session: {
          sessionId,
          userId,
          username,
          email,
          createdAt: new Date(payload.iat! * 1000).toISOString(),
          lastAccessedAt: new Date().toISOString(),
          expiresAt: new Date(payload.exp! * 1000).toISOString()
        }
      });

    } catch (jwtError: any) {
      console.error('[SessionAPI] JWT検証エラー:', {
        error: jwtError,
        errorName: jwtError.name,
        errorMessage: jwtError.message
      });
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('❌ セッション取得エラー:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

/**
 * セッション更新 (PUT)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, metadata } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // セッション存在確認
    const result = await docClient.send(new GetCommand({
      TableName: SESSION_TABLE_NAME,
      Key: { sessionId }
    }));

    if (!result.Item) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // セッション更新
    let updateExpression = 'SET lastAccessedAt = :lastAccessedAt';
    const expressionAttributeValues: any = {
      ':lastAccessedAt': new Date().toISOString()
    };

    if (metadata) {
      updateExpression += ', metadata = :metadata';
      expressionAttributeValues[':metadata'] = metadata;
    }

    await docClient.send(new UpdateCommand({
      TableName: SESSION_TABLE_NAME,
      Key: { sessionId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues
    }));

    console.log(`✅ セッション更新成功: ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'Session updated successfully'
    });

  } catch (error) {
    console.error('❌ セッション更新エラー:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

/**
 * セッション削除 (DELETE)
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // セッション削除
    await docClient.send(new DeleteCommand({
      TableName: SESSION_TABLE_NAME,
      Key: { sessionId }
    }));

    console.log(`✅ セッション削除成功: ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('❌ セッション削除エラー:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
