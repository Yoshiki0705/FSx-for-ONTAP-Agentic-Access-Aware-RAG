/**
 * ユーザー設定管理API - 機能復旧用
 * 
 * 機能:
 * - テーマ・言語・リージョン設定の永続化
 * - DynamoDB統合
 * - セッション認証
 * - CSRF保護
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { jwtVerify } from 'jose';
import { CSRFMiddleware } from '@/lib/security/csrf-protection';
import { DEFAULT_PREFERENCE_MODEL, DEFAULT_REGION } from '@/config/model-defaults';

// DynamoDBクライアント初期化
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USER_PREFERENCES_TABLE_NAME = process.env.USER_PREFERENCES_TABLE_NAME || 'permission-aware-rag-user-preferences';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-2024';
const CSRF_SECRET = process.env.CSRF_SECRET || 'your-csrf-secret-change-in-production-2024';

// 動的にallowedOriginsを構築（環境変数から取得）
const getAllowedOrigins = (): string[] => {
  const origins = [
    process.env.NEXTAUTH_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'https://localhost:3000'
  ];

  // CloudFront URL（環境変数から取得）
  if (process.env.CLOUDFRONT_URL) {
    origins.push(process.env.CLOUDFRONT_URL);
  }

  // Lambda Function URL（環境変数から取得）
  if (process.env.LAMBDA_FUNCTION_URL) {
    origins.push(process.env.LAMBDA_FUNCTION_URL);
  }

  return origins;
};

// CSRFMiddleware インスタンス
const csrfMiddleware = new CSRFMiddleware({
  secret: CSRF_SECRET,
  allowedOrigins: getAllowedOrigins()
});

interface UserPreferences {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  language: 'ja' | 'en' | 'ko' | 'zh-CN' | 'zh-TW' | 'es' | 'fr' | 'de';
  region: string;
  modelPreferences: {
    defaultModel?: string;
    preferredProvider?: string;
    autoSelectModel?: boolean;
  };
  uiPreferences: {
    sidebarCollapsed?: boolean;
    fontSize?: 'small' | 'medium' | 'large';
    animationsEnabled?: boolean;
    soundEnabled?: boolean;
  };
  chatPreferences: {
    autoSave?: boolean;
    showTimestamps?: boolean;
    codeHighlighting?: boolean;
    messageActions?: boolean;
  };
  notificationPreferences: {
    desktopNotifications?: boolean;
    soundAlerts?: boolean;
    volumeLevel?: number;
  };
  privacyPreferences: {
    dataRetentionDays?: number;
    analyticsEnabled?: boolean;
    crashReportingEnabled?: boolean;
  };
  updatedAt: string;
  createdAt: string;
}

/**
 * 認証ヘルパー関数
 */
async function authenticateRequest(request: NextRequest): Promise<{ userId: string; username: string } | null> {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return null;
    }

    const jwtSecret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, jwtSecret);
    
    return {
      userId: payload.userId as string,
      username: payload.username as string
    };
  } catch (error) {
    return null;
  }
}

/**
 * デフォルト設定取得
 */
function getDefaultPreferences(userId: string): UserPreferences {
  const now = new Date().toISOString();
  
  return {
    userId,
    theme: 'system',
    language: 'ja',
    region: DEFAULT_REGION,
    modelPreferences: {
      defaultModel: DEFAULT_PREFERENCE_MODEL,
      preferredProvider: 'anthropic',
      autoSelectModel: true
    },
    uiPreferences: {
      sidebarCollapsed: false,
      fontSize: 'medium',
      animationsEnabled: true,
      soundEnabled: true
    },
    chatPreferences: {
      autoSave: true,
      showTimestamps: true,
      codeHighlighting: true,
      messageActions: true
    },
    notificationPreferences: {
      desktopNotifications: false,
      soundAlerts: true,
      volumeLevel: 0.5
    },
    privacyPreferences: {
      dataRetentionDays: 90,
      analyticsEnabled: true,
      crashReportingEnabled: true
    },
    createdAt: now,
    updatedAt: now
  };
}

/**
 * ユーザー設定取得 (GET)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId } = auth;

    // DynamoDBから設定取得
    const result = await docClient.send(new GetCommand({
      TableName: USER_PREFERENCES_TABLE_NAME,
      Key: { userId }
    }));

    let preferences: UserPreferences;

    if (!result.Item) {
      // 設定が存在しない場合、デフォルト設定を作成
      preferences = getDefaultPreferences(userId);
      
      await docClient.send(new PutCommand({
        TableName: USER_PREFERENCES_TABLE_NAME,
        Item: preferences
      }));

      console.log(`✅ デフォルト設定作成: ${userId}`);
    } else {
      preferences = result.Item as UserPreferences;
      console.log(`✅ 設定取得成功: ${userId}`);
    }

    return NextResponse.json({
      success: true,
      preferences
    });

  } catch (error) {
    console.error('❌ 設定取得エラー:', error);
    return NextResponse.json(
      { error: 'Failed to get preferences' },
      { status: 500 }
    );
  }
}

/**
 * ユーザー設定更新 (PUT)
 */
export async function PUT(request: NextRequest) {
  try {
    // CSRF保護の検証
    const csrfValidation = await csrfMiddleware.validateRequest(request);
    if (!csrfValidation.valid) {
      console.warn('[Preferences] CSRF検証失敗:', csrfValidation.error);
      return NextResponse.json(
        { error: 'セキュリティ検証に失敗しました' },
        { status: 403 }
      );
    }

    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId } = auth;
    const body = await request.json();

    // 現在の設定を取得
    const result = await docClient.send(new GetCommand({
      TableName: USER_PREFERENCES_TABLE_NAME,
      Key: { userId }
    }));

    let currentPreferences: UserPreferences;

    if (!result.Item) {
      // 設定が存在しない場合、デフォルト設定を使用
      currentPreferences = getDefaultPreferences(userId);
    } else {
      currentPreferences = result.Item as UserPreferences;
    }

    // 設定をマージ
    const updatedPreferences: UserPreferences = {
      ...currentPreferences,
      ...body,
      userId, // userIdは変更不可
      updatedAt: new Date().toISOString()
    };

    // 設定値の検証
    if (updatedPreferences.theme && !['light', 'dark', 'system'].includes(updatedPreferences.theme)) {
      return NextResponse.json(
        { error: 'Invalid theme value' },
        { status: 400 }
      );
    }

    if (updatedPreferences.language && !['ja', 'en', 'ko', 'zh-CN', 'zh-TW', 'es', 'fr', 'de'].includes(updatedPreferences.language)) {
      return NextResponse.json(
        { error: 'Invalid language value' },
        { status: 400 }
      );
    }

    // DynamoDBに保存
    await docClient.send(new PutCommand({
      TableName: USER_PREFERENCES_TABLE_NAME,
      Item: updatedPreferences
    }));

    console.log(`✅ 設定更新成功: ${userId}`);

    return NextResponse.json({
      success: true,
      preferences: updatedPreferences
    });

  } catch (error) {
    console.error('❌ 設定更新エラー:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

/**
 * 特定設定項目の更新 (PATCH)
 */
export async function PATCH(request: NextRequest) {
  try {
    // CSRF保護の検証
    const csrfValidation = await csrfMiddleware.validateRequest(request);
    if (!csrfValidation.valid) {
      console.warn('[Preferences] CSRF検証失敗:', csrfValidation.error);
      return NextResponse.json(
        { error: 'セキュリティ検証に失敗しました' },
        { status: 403 }
      );
    }

    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId } = auth;
    const body = await request.json();
    const { category, key, value } = body;

    if (!category || !key || value === undefined) {
      return NextResponse.json(
        { error: 'category, key, and value are required' },
        { status: 400 }
      );
    }

    // 有効なカテゴリチェック
    const validCategories = ['modelPreferences', 'uiPreferences', 'chatPreferences', 'notificationPreferences', 'privacyPreferences'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    // DynamoDB更新
    await docClient.send(new UpdateCommand({
      TableName: USER_PREFERENCES_TABLE_NAME,
      Key: { userId },
      UpdateExpression: `SET ${category}.#key = :value, updatedAt = :now`,
      ExpressionAttributeNames: {
        '#key': key
      },
      ExpressionAttributeValues: {
        ':value': value,
        ':now': new Date().toISOString()
      }
    }));

    console.log(`✅ 設定項目更新成功: ${userId} - ${category}.${key}`);

    return NextResponse.json({
      success: true,
      message: 'Preference updated successfully'
    });

  } catch (error) {
    console.error('❌ 設定項目更新エラー:', error);
    return NextResponse.json(
      { error: 'Failed to update preference' },
      { status: 500 }
    );
  }
}

/**
 * ユーザー設定削除 (DELETE)
 */
export async function DELETE(request: NextRequest) {
  try {
    // CSRF保護の検証
    const csrfValidation = await csrfMiddleware.validateRequest(request);
    if (!csrfValidation.valid) {
      console.warn('[Preferences] CSRF検証失敗:', csrfValidation.error);
      return NextResponse.json(
        { error: 'セキュリティ検証に失敗しました' },
        { status: 403 }
      );
    }

    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId } = auth;

    // DynamoDBから設定削除
    await docClient.send(new DeleteCommand({
      TableName: USER_PREFERENCES_TABLE_NAME,
      Key: { userId }
    }));

    console.log(`✅ 設定削除成功: ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Preferences deleted successfully'
    });

  } catch (error) {
    console.error('❌ 設定削除エラー:', error);
    return NextResponse.json(
      { error: 'Failed to delete preferences' },
      { status: 500 }
    );
  }
}