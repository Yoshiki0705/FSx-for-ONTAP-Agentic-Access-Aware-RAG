import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';
import { locales, defaultLocale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocaleを試みる
  let validLocale = await requestLocale;
  
  // requestLocaleがundefinedの場合、headersからURLパスを取得
  if (!validLocale) {
    const headersList = await headers();
    
    // Lambda Web Adapterが設定する可能性のあるヘッダーを確認
    const forwardedUri = headersList.get('x-forwarded-uri');
    const originalUrl = headersList.get('x-original-url');
    const requestUri = headersList.get('x-request-uri');
    
    console.log('[i18n/request] Headers確認:', {
      forwardedUri,
      originalUrl,
      requestUri,
      allHeaders: Array.from(headersList.entries()).map(([k, v]) => `${k}: ${v}`)
    });
    
    // URLからロケールを抽出
    const uri = forwardedUri || originalUrl || requestUri || '';
    const pathSegments = uri.split('/').filter(Boolean);
    const urlLocale = pathSegments[0];
    
    if (urlLocale && locales.includes(urlLocale as any)) {
      validLocale = urlLocale;
      console.log(`[i18n/request] HeadersからURLロケールを取得: ${urlLocale}`);
    } else {
      validLocale = defaultLocale;
      console.log(`[i18n/request] URLロケールが見つからない、デフォルトを使用: ${defaultLocale}`);
    }
  } else {
    console.log(`[i18n/request] requestLocaleから取得: ${validLocale}`);
  }
  
  // ロケールの有効性を検証
  if (!locales.includes(validLocale as any)) {
    console.warn(`[i18n/request] Invalid locale: ${validLocale}, falling back to ${defaultLocale}`);
    
    return {
      locale: defaultLocale,
      messages: (await import(`../messages/${defaultLocale}.json`)).default
    };
  }

  try {
    // 翻訳ファイルの動的インポート
    // Lambda環境では../messages/が正しいパス
    const messages = (await import(`../messages/${validLocale}.json`)).default;
    
    console.log(`[i18n/request] ロケール確定: ${validLocale}, メッセージ数: ${Object.keys(messages).length}`);
    
    return {
      locale: validLocale,
      messages
    };
  } catch (error) {
    console.error(`[i18n/request] Failed to load messages for locale: ${validLocale}`, error);
    
    // フォールバック処理
    return {
      locale: defaultLocale,
      messages: (await import(`../messages/${defaultLocale}.json`)).default
    };
  }
});
