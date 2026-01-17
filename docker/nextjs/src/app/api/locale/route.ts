import { NextRequest, NextResponse } from 'next/server';
import { locales } from '@/i18n/config';

/**
 * ロケール設定API
 * 
 * Phase 12/15 Feature Restoration:
 * - LanguageSwitcherからのロケール変更リクエストを処理
 * - Cookieに言語設定を保存
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locale } = body;

    // ロケールのバリデーション
    if (!locale || !locales.includes(locale)) {
      return NextResponse.json(
        { success: false, error: 'Invalid locale' },
        { status: 400 }
      );
    }

    console.log(`[API /api/locale] ロケール設定: ${locale}`);

    // レスポンスを作成してCookieを設定
    const response = NextResponse.json({ success: true, locale });
    
    // Cookieを設定（1年間有効）
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60, // 1年
      sameSite: 'lax',
      httpOnly: false, // クライアントサイドからも読み取り可能
    });

    console.log(`[API /api/locale] Cookie設定完了: NEXT_LOCALE=${locale}`);

    return response;
  } catch (error) {
    console.error('[API /api/locale] エラー:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
