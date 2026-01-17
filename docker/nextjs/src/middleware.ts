import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { sessionManager } from '@/lib/auth/session-manager';
import { CSRFMiddleware, CSRFProtection } from '@/lib/security/csrf-protection';
import { locales, defaultLocale } from '@/i18n/config';

// next-intlミドルウェアの作成
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: false // ユーザー選択を優先するため自動検出を無効化
});

// CSRF保護設定
const csrfMiddleware = new CSRFMiddleware({
  secret: process.env.CSRF_SECRET || 'your-csrf-secret-change-in-production-2024',
  allowedOrigins: [
    'https://d3p7l2uoh6npdr.cloudfront.net',
    'https://vlhac7yhlh624z7xuyb6sb4lxu0tnieh.lambda-url.ap-northeast-1.on.aws',
    'http://localhost:3000',
    'https://localhost:3000'
  ],
  exemptPaths: [
    '/api/auth/signin',
    '/api/health',
    '/api/status'
  ],
  cookieSecure: process.env.NODE_ENV === 'production'
});

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // URLからロケールを抽出（/[locale]/... の形式）
  const pathSegments = pathname.split('/').filter(Boolean);
  const urlLocale = pathSegments[0];
  
  console.log('[Middleware] リクエスト情報:', {
    pathname,
    urlLocale,
    method: request.method,
    hasSessionToken: !!request.cookies.get('session-token')?.value
  });
  
  // 静的ファイルや認証不要パスのリスト
  const publicPaths = [
    '/api/auth/signin',
    '/api/auth/signout',
    '/api/auth/csrf-token',
    '/api/locale', // ロケール設定API
    '/_next',
    '/favicon.ico',
    '/manifest.json',
    '/images'
  ];
  
  // 静的ファイルの場合は早期リターン
  if (publicPaths.some(path => pathname.startsWith(path))) {
    console.log(`[Middleware] 静的ファイル/APIパス検出: ${pathname} - 処理スキップ`);
    return NextResponse.next();
  }

  // manifest.jsonのロケール付きパスを処理
  if (pathname === '/ja/manifest.json' || pathname === '/en/manifest.json' ||
      pathname === '/zh-CN/manifest.json' || pathname === '/zh-TW/manifest.json' ||
      pathname === '/ko/manifest.json' || pathname === '/fr/manifest.json' ||
      pathname === '/de/manifest.json' || pathname === '/es/manifest.json') {
    // ロケールなしのmanifest.jsonにリライト
    const url = request.nextUrl.clone();
    url.pathname = '/manifest.json';
    return NextResponse.rewrite(url);
  }

  // /signin (ロケールなし) へのリクエストを /ja/signin にリダイレクト
  if (pathname === '/signin') {
    // Cookieからロケールを取得、なければデフォルトの'ja'を使用
    const localeCookie = request.cookies.get('NEXT_LOCALE')?.value;
    const locale = localeCookie && locales.includes(localeCookie as any) ? localeCookie : 'ja';
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/signin`;
    console.log(`[Middleware] /signin -> /${locale}/signin リダイレクト`);
    return NextResponse.redirect(url);
  }

  // ルートパスの場合は /ja/genai にリダイレクト（認証前）
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/ja/genai', request.url));
  }

  // サインインページかどうかを判定
  const isSigninPage = pathname.includes('/signin');
  
  // セッション検証（サインインページ以外のみ）
  const token = request.cookies.get('session-token')?.value;
  
  console.log(`[Middleware] 認証チェック: ${pathname}`, {
    isSigninPage,
    hasToken: !!token,
    tokenLength: token?.length || 0
  });
  
  if (isSigninPage) {
    // サインインページの場合
    if (token) {
      // トークンがある場合はJWT検証
      const sessionToken = await sessionManager.validateJWT(token);
      if (sessionToken) {
        // 認証済みユーザーがサインインページにアクセスした場合はメインページにリダイレクト
        const locale = urlLocale && locales.includes(urlLocale as any) ? urlLocale : 'ja';
        console.log(`[Middleware] 認証済みユーザーのサインインページアクセス - リダイレクト: ${pathname} -> /${locale}/genai`);
        return NextResponse.redirect(new URL(`/${locale}/genai`, request.url));
      }
    }
    // 未認証またはトークン無効の場合はサインインページを表示
    console.log(`[Middleware] サインインページ表示: ${pathname}`);
    return intlMiddleware(request);
  }
  
  // サインインページ以外の場合は認証が必要
  if (!token) {
    // トークンがない場合はサインインページにリダイレクト
    const locale = urlLocale && locales.includes(urlLocale as any) ? urlLocale : 'ja';
    console.log(`[Middleware] トークンなし - リダイレクト: ${pathname} -> /${locale}/signin`);
    return NextResponse.redirect(new URL(`/${locale}/signin`, request.url));
  }
  
  // JWT検証のみ (Edge Runtime互換 - DynamoDBアクセスなし)
  const sessionToken = await sessionManager.validateJWT(token);
  
  if (!sessionToken) {
    // JWT検証失敗の場合はサインインページにリダイレクト
    const locale = urlLocale && locales.includes(urlLocale as any) ? urlLocale : 'ja';
    console.log(`[Middleware] JWT検証失敗 - リダイレクト: ${pathname} -> /${locale}/signin`);
    return NextResponse.redirect(new URL(`/${locale}/signin`, request.url));
  }

  // CSRF保護検証（認証済みユーザーのみ）
  const csrfResult = await csrfMiddleware.validateRequest(request, sessionToken.sessionId);
  
  if (!csrfResult.valid) {
    console.warn(`🛡️ CSRF保護: リクエスト拒否 - ${csrfResult.error}`, {
      path: pathname,
      method: request.method,
      sessionId: sessionToken.sessionId
    });
    
    return CSRFProtection.createErrorResponse(csrfResult.error);
  }

  // next-intlミドルウェアを適用してレスポンス作成（ロケール処理）
  const response = intlMiddleware(request);

  // URLからロケールを抽出してカスタムヘッダーに追加
  // これにより、getRequestConfigでURLのロケールを取得できる
  if (urlLocale && locales.includes(urlLocale as any)) {
    response.headers.set('x-url-locale', urlLocale);
  }

  // 新しいCSRFトークンがある場合は設定
  if (csrfResult.newToken) {
    const cookieHeader = CSRFProtection.generateCookieHeader(
      csrfResult.newToken,
      process.env.NODE_ENV === 'production'
    );
    response.headers.set('Set-Cookie', cookieHeader);
  }

  console.log(`✅ ミドルウェア通過: ${pathname} (セッション: ${sessionToken.sessionId}, URLロケール: ${urlLocale || 'なし'})`);
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (public images)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
  ],
};
