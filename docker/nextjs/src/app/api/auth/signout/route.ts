import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/auth/session-manager';
import { CSRFMiddleware } from '@/lib/security/csrf-protection';

const CSRF_SECRET = process.env.CSRF_SECRET || 'your-csrf-secret-change-in-production-2024';

// CSRFMiddleware インスタンス
const csrfMiddleware = new CSRFMiddleware({
  secret: CSRF_SECRET,
  allowedOrigins: [
    process.env.NEXTAUTH_URL || 'http://localhost:3000',
    'https://d2qis0fup16szb.cloudfront.net',
    'https://c4q5uoglmsqxq7kkxhonq6k22u0cscnl.lambda-url.ap-northeast-1.on.aws'
  ]
});

export async function POST(request: NextRequest) {
  try {
    // CSRF保護の検証
    const csrfValidation = await csrfMiddleware.validateRequest(request);
    if (!csrfValidation.valid) {
      console.warn('[Auth] CSRF検証失敗:', csrfValidation.error);
      return NextResponse.json(
        { error: 'セキュリティ検証に失敗しました' },
        { status: 403 }
      );
    }

    const session = await sessionManager.getSessionFromCookies();
    
    if (session) {
      await sessionManager.deleteSession(session.sessionId);
      console.log(`[Auth] ユーザー ${session.user.username} がサインアウトしました`);
    }

    const response = NextResponse.json({ success: true });
    sessionManager.clearSessionCookie(response);
    
    return response;
  } catch (error) {
    console.error('[Auth] サインアウトエラー:', error);
    return NextResponse.json(
      { error: 'サインアウトに失敗しました' },
      { status: 500 }
    );
  }
}
