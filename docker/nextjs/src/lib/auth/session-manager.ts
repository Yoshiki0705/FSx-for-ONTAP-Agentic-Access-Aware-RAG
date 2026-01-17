import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export interface User {
  username: string;
  role: string;
  permissions: string[];
}

export interface Session {
  sessionId: string;
  userId: string;
  user: User;
  loginTime: string;
  expiresAt: string;
  lastActivity: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionToken {
  sessionId: string;
  userId: string;
  exp: number;
  iat: number;
}

class SessionManager {
  private dynamoClient: DynamoDBDocumentClient;
  private tableName: string;
  private jwtSecret: Uint8Array;
  private cookieName = 'session-token';
  private sessionTimeout = 24 * 60 * 60 * 1000; // 24時間

  constructor() {
    // DynamoDBClientの初期化を遅延実行に変更 (Edge Runtime互換性のため)
    // 実際のDynamoDBアクセス時に初期化される
    this.dynamoClient = null as any; // 遅延初期化
    this.tableName = process.env.SESSION_TABLE_NAME || 'permission-aware-rag-sessions';
    this.jwtSecret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
    );
    
    console.log('[SessionManager] 初期化完了 (DynamoDBは遅延初期化):', {
      tableName: this.tableName,
      region: process.env.AWS_REGION || 'ap-northeast-1'
    });
  }

  // DynamoDBクライアントの遅延初期化 (Node.js Runtimeでのみ使用)
  private getDynamoClient(): DynamoDBDocumentClient {
    if (!this.dynamoClient) {
      const client = new DynamoDBClient({
        region: process.env.AWS_REGION || 'ap-northeast-1'
      });
      this.dynamoClient = DynamoDBDocumentClient.from(client);
      console.log('[SessionManager] DynamoDBクライアント初期化完了');
    }
    return this.dynamoClient;
  }

  // セッション作成
  async createSession(user: User, request?: NextRequest): Promise<{ session: Session; token: string }> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTimeout);

    const session: Session = {
      sessionId,
      userId: user.username,
      user,
      loginTime: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastActivity: now.toISOString(),
      ipAddress: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip') || 'unknown',
      userAgent: request?.headers.get('user-agent') || 'unknown'
    };

    // DynamoDBに保存 (遅延初期化されたクライアントを使用)
    const dynamoClient = this.getDynamoClient();
    await dynamoClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        ...session,
        ttl: Math.floor(expiresAt.getTime() / 1000) // DynamoDB TTL
      }
    }));

    // JWTトークン生成
    const token = await new SignJWT({
      sessionId,
      userId: user.username,
      username: user.username // ✅ usernameを追加
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(this.jwtSecret);

    return { session, token };
  }

  // JWT検証のみ (Edge Runtime互換 - Middleware用)
  async validateJWT(token: string): Promise<SessionToken | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      const sessionToken = payload as unknown as SessionToken;
      
      console.log('[SessionManager] JWT検証成功:', {
        sessionId: sessionToken.sessionId,
        userId: sessionToken.userId
      });
      
      return sessionToken;
    } catch (error: any) {
      console.warn('[SessionManager] JWT検証失敗:', error.message);
      return null;
    }
  }

  // セッション検証 (完全検証 - Node.js Runtime用)
  async validateSession(token: string): Promise<Session | null> {
    try {
      // まずJWT検証
      const sessionToken = await this.validateJWT(token);
      if (!sessionToken) {
        return null;
      }

      console.log('[SessionManager] DynamoDBセッション検証開始:', {
        sessionId: sessionToken.sessionId,
        userId: sessionToken.userId
      });

      // DynamoDBからセッション取得 (遅延初期化されたクライアントを使用)
      try {
        const dynamoClient = this.getDynamoClient();
        const result = await dynamoClient.send(new GetCommand({
          TableName: this.tableName,
          Key: { sessionId: sessionToken.sessionId }
        }));

        if (!result.Item) {
          console.warn('[SessionManager] セッションが見つかりません:', sessionToken.sessionId);
          return null;
        }

        const session = result.Item as Session;

        // セッション有効期限チェック
        const now = new Date();
        const expiresAt = new Date(session.expiresAt);
        
        if (now >= expiresAt) {
          console.log('[SessionManager] セッション期限切れ:', sessionToken.sessionId);
          await this.deleteSession(session.sessionId);
          return null;
        }

        // 最終アクティビティ更新
        await this.updateLastActivity(session.sessionId);

        console.log('[SessionManager] セッション検証成功:', {
          sessionId: session.sessionId,
          userId: session.userId
        });

        return session;
      } catch (dynamoError: any) {
        console.error('[SessionManager] DynamoDB アクセスエラー:', {
          error: dynamoError,
          errorName: dynamoError.name,
          errorMessage: dynamoError.message,
          sessionId: sessionToken.sessionId,
          tableName: this.tableName,
          region: process.env.AWS_REGION || 'ap-northeast-1'
        });
        
        // 認証情報エラーの場合は詳細ログ
        if (dynamoError.name === 'CredentialsProviderError' || dynamoError.message?.includes('Credential')) {
          console.error('[SessionManager] AWS認証情報エラー。Lambda実行ロールを確認してください。');
        }
        
        throw dynamoError;
      }
    } catch (error: any) {
      console.error('[SessionManager] セッション検証エラー:', {
        error: error,
        errorName: error.name,
        errorMessage: error.message
      });
      return null;
    }
  }

  // セッション削除
  async deleteSession(sessionId: string): Promise<void> {
    const dynamoClient = this.getDynamoClient();
    await dynamoClient.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { sessionId }
    }));
  }

  // 最終アクティビティ更新
  async updateLastActivity(sessionId: string): Promise<void> {
    const dynamoClient = this.getDynamoClient();
    await dynamoClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { sessionId },
      UpdateExpression: 'SET lastActivity = :now',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString()
      }
    }));
  }

  // Cookieからセッション取得 (Next.js 15: async cookies())
  async getSessionFromCookies(): Promise<Session | null> {
    try {
      const cookieStore = await cookies(); // ✅ Next.js 15: async
      const token = cookieStore.get(this.cookieName)?.value;
      
      if (!token) {
        return null;
      }

      return await this.validateSession(token);
    } catch (error) {
      console.error('[SessionManager] Cookie読み込みエラー:', error);
      return null;
    }
  }

  // Cookieにセッション設定
  setSessionCookie(response: NextResponse, token: string): void {
    const expiresAt = new Date(Date.now() + this.sessionTimeout);
    
    response.cookies.set(this.cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    });
  }

  // Cookieからセッション削除
  clearSessionCookie(response: NextResponse): void {
    response.cookies.delete(this.cookieName);
  }

  // セッションID生成
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // ユーザー認証（デモ実装）
  async authenticateUser(username: string, password: string): Promise<User | null> {
    // デモユーザー（本番環境では適切な認証システムに置き換え）
    const demoUsers: Record<string, { password: string; role: string; permissions: string[] }> = {
      admin: {
        password: 'admin123',
        role: 'administrator',
        permissions: ['read', 'write', 'delete', 'admin', 'agent:create', 'model:all']
      },
      developer: {
        password: 'dev123',
        role: 'developer',
        permissions: ['read', 'write', 'agent:create', 'model:claude', 'model:nova']
      },
      user: {
        password: 'user123',
        role: 'user',
        permissions: ['read', 'model:claude-haiku']
      }
    };

    const userConfig = demoUsers[username];
    if (!userConfig || userConfig.password !== password) {
      return null;
    }

    return {
      username,
      role: userConfig.role,
      permissions: userConfig.permissions
    };
  }

  // Debug method for JWT validation
  async debugValidateJWT(token: string): Promise<any> {
    try {
      console.log('[SessionManager] JWT Debug - Token length:', token?.length || 0);
      console.log('[SessionManager] JWT Debug - Token prefix:', token?.substring(0, 20) + '...');
      
      const { payload } = await jwtVerify(token, this.jwtSecret);
      console.log('[SessionManager] JWT Debug - Payload:', payload);
      
      return payload;
    } catch (error: any) {
      console.error('[SessionManager] JWT Debug - Error:', {
        name: error.name,
        message: error.message,
        code: error.code
      });
      return null;
    }
  }
}

export const sessionManager = new SessionManager();
