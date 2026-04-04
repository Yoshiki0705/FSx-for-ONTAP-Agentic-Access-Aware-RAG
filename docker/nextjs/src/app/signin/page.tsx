'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /signin フォールバックページ
 * ロケール付きサインインページ (/ja/signin, /en/signin 等) にリダイレクトする。
 * ブラウザの言語設定から最適なロケールを判定する。
 */
const SUPPORTED_LOCALES = ['ja', 'en', 'ko', 'zh-CN', 'zh-TW', 'fr', 'de', 'es'];
const DEFAULT_LOCALE = 'ja';

function detectLocale(): string {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const langs = navigator.languages || [navigator.language];
  for (const lang of langs) {
    const normalized = lang.toLowerCase();
    // Exact match
    const exact = SUPPORTED_LOCALES.find(l => l.toLowerCase() === normalized);
    if (exact) return exact;
    // Prefix match (e.g. "en-US" → "en")
    const prefix = normalized.split('-')[0];
    const prefixMatch = SUPPORTED_LOCALES.find(l => l.toLowerCase().startsWith(prefix));
    if (prefixMatch) return prefixMatch;
  }
  return DEFAULT_LOCALE;
}

export default function SignInFallback() {
  const router = useRouter();

  useEffect(() => {
    const locale = detectLocale();
    router.replace(`/${locale}/signin`);
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="w-6 h-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
    </div>
  );
}
