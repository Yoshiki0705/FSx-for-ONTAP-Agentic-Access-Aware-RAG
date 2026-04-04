'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, User, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/useAuthStore';
import { useCSRFToken } from '@/hooks/useCSRFToken';

/** 認証オプションセクション — ランタイムでAPI経由で設定を取得 */
function AuthOptionsSection({ locale }: { locale: string }) {
  const t = useTranslations('signin');
  const [authConfig, setAuthConfig] = useState<{
    cognitoDomain?: string;
    cognitoRegion?: string;
    cognitoClientId?: string;
    callbackUrl?: string;
    idpName?: string;
    oidcProviderName?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/ad-config')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.enabled) setAuthConfig(data);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="mt-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-3">
          <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
          <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
        </div>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-500 dark:text-gray-400">
              {t('orDivider')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!authConfig?.cognitoDomain) return null;

  const buildSignInUrl = (providerName: string) =>
    `https://${authConfig.cognitoDomain}.auth.${authConfig.cognitoRegion}.amazoncognito.com/oauth2/authorize` +
    `?identity_provider=${encodeURIComponent(providerName)}` +
    `&response_type=code` +
    `&client_id=${encodeURIComponent(authConfig.cognitoClientId || '')}` +
    `&redirect_uri=${encodeURIComponent(authConfig.callbackUrl || '')}` +
    `&scope=openid+email+profile`;

  const hasAd = !!authConfig.idpName;
  const hasOidc = !!authConfig.oidcProviderName;

  if (!hasAd && !hasOidc) return null;

  return (
    <div className="mt-6 space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-3">
        {hasAd && (
          <>
            <button
              type="button"
              onClick={() => { window.location.href = buildSignInUrl(authConfig.idpName || 'ActiveDirectory'); }}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Shield className="h-4 w-4 mr-2" />
              {t('adSignIn')}
            </button>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              {t('adSignInDesc')}
            </p>
          </>
        )}
        {hasOidc && (
          <>
            <button
              type="button"
              onClick={() => { window.location.href = buildSignInUrl(authConfig.oidcProviderName!); }}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              <LogIn className="h-4 w-4 mr-2" />
              {t('oidcSignIn', { provider: authConfig.oidcProviderName })}
            </button>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              {t('oidcSignInDesc', { provider: authConfig.oidcProviderName })}
            </p>
          </>
        )}
      </div>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-500 dark:text-gray-400">
            {t('orDivider')}
          </span>
        </div>
      </div>
    </div>
  );
}

interface SignInPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function SignInPage({ params }: SignInPageProps) {
  const { locale } = use(params);
  const t = useTranslations('signin');
  const router = useRouter();
  const { signIn, isLoading, isAuthenticated } = useAuthStore();
  const { token: csrfToken, isLoading: csrfLoading } = useCSRFToken();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      router.push(`/${locale}/genai`);
    }
  }, [isAuthenticated, locale, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError(t('errorEmpty'));
      return;
    }

    if (!csrfToken) {
      setError(t('errorCsrf'));
      return;
    }

    try {
      const success = await signIn(username, password, csrfToken);
      
      if (success) {
        router.push(`/${locale}/genai`);
      } else {
        setError(t('errorInvalid'));
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError(t('errorGeneral'));
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* 左側: NetApp画像 (デスクトップのみ表示) */}
      <div 
        className="relative hidden bg-muted lg:block lg:w-1/2"
        style={{
          backgroundImage: 'url(/images/main-image.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />

      {/* 右側: サインインフォーム */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-md w-full space-y-8">
          {/* ヘッダー */}
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center">
              <LogIn className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-gray-100">
              🔷 {t('title')}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('subtitle')}
            </p>
          </div>

          {/* Federation認証ボタン */}
          {typeof window !== 'undefined' && (
            <AuthOptionsSection locale={locale} />
          )}

          {/* サインインフォーム */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('username')}
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('usernamePlaceholder')}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('password')}
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || csrfLoading || !csrfToken}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>{t('signingIn')}</span>
                  </div>
                ) : csrfLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>{t('preparing')}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <LogIn className="h-4 w-4" />
                    <span>{t('signInButton')}</span>
                  </div>
                )}
              </button>
            </div>
          </form>

          {/* フッター */}
          <div className="text-center text-xs text-gray-500 dark:text-gray-400">
            <p>{t('footer')}</p>
            <p>{t('poweredBy')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
