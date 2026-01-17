import { NextResponse } from "next/server";
import { sessionManager } from '@/lib/auth/session-manager';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    console.log(`[SignIn API] サインイン試行: ${username}`);
    
    // シンプルな認証チェック（元の実装に合わせて後で AWS Cognito に置き換え可能）
    const validUsers = ['testuser', 'admin'];
    const validTestUsers = Array.from({length: 50}, (_, i) => `testuser${i}`);
    const allValidUsers = [...validUsers, ...validTestUsers];
    
    if (allValidUsers.includes(username) && password === 'password') {
      // セッション作成（JWTトークン生成）
      const user = {
        username,
        role: username === 'admin' ? 'administrator' : 'user',
        permissions: username === 'admin' 
          ? ['read', 'write', 'delete', 'admin', 'agent:create', 'model:all']
          : ['read', 'model:claude-haiku']
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
        error: "ユーザー名またはパスワードが正しくありません"
      }, { status: 401 });
    }
  } catch (error) {
    console.error('[SignIn API] エラー:', error);
    return NextResponse.json({ 
      success: false,
      error: "サーバーエラーが発生しました"
    }, { status: 500 });
  }
}
