import { NextResponse } from "next/server";
import { sessionManager } from '@/lib/auth/session-manager';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    console.log(`[SignIn API] サインイン試行: ${username}`);
    
    // 有効なユーザーとパスワード（config/users.jsonに基づく）
    const validUsers = [
      'admin',
      'testuser',
      'user1',
      'user2',
      'manager1',
      'developer1',
      'analyst1',
      'testuser_new',
      'demo_user'
    ];
    
    // デフォルトパスワード
    const defaultPassword = 'TestUser123!';
    
    if (validUsers.includes(username) && password === defaultPassword) {
      // ユーザーロールの決定
      let role = 'user';
      let permissions = ['read', 'model:claude-haiku'];
      
      if (username === 'admin') {
        role = 'administrator';
        permissions = ['read', 'write', 'delete', 'admin', 'agent:create', 'model:all'];
      } else if (username === 'manager1' || username === 'testuser_new') {
        role = 'manager';
        permissions = ['read', 'write', 'model:claude-sonnet', 'team_management'];
      } else if (username === 'developer1' || username === 'demo_user') {
        role = 'developer';
        permissions = ['read', 'write', 'model:claude-sonnet', 'code_access', 'api_access'];
      } else if (username === 'analyst1') {
        role = 'analyst';
        permissions = ['read', 'model:claude-sonnet', 'data_analysis', 'report_generation'];
      }
      
      // セッション作成（JWTトークン生成）
      const user = {
        username,
        role,
        permissions
      };
      
      const session = await sessionManager.createSession(user);
      
      console.log(`[SignIn API] セッション作成成功: ${username} (セッションID: ${session.session.sessionId})`);
      
      // レスポンス作成
      const response = NextResponse.json({ 
        success: true,
        message: "Sign-in successful",
        user: {
          username,
          role: user.role
        }
      }, { status: 200 });
      
      // JWTトークンをCookieに設定（middlewareが期待する名前: session-token）
      response.cookies.set('session-token', session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24時間
        path: '/'
      });
      
      console.log(`✅ サインイン成功: ${username} (セッションID: ${session.session.sessionId})`);
      
      return response;
    } else {
      console.log(`❌ サインイン失敗: ${username} - 認証情報が正しくありません`);
      return NextResponse.json({ 
        success: false,
        error: "Username or password is incorrect"
      }, { status: 401 });
    }
  } catch (error) {
    console.error('[SignIn API] エラー:', error);
    return NextResponse.json({ 
      success: false,
      error: "Server error occurred"
    }, { status: 500 });
  }
}
