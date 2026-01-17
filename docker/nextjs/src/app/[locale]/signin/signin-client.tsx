'use client';

import { useState } from 'react';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';
import { useCSRFToken } from '@/hooks/useCSRFToken';
import { SignInImage } from '@/components/signin-image';
import { type Locale } from '@/i18n/config';

interface SignInClientProps {
  locale: Locale;
}

export function SignInClient({ locale }: SignInClientProps) {
  const t = useCustomTranslations(locale);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { token: csrfToken, isLoading: csrfLoading, error: csrfError } = useCSRFToken();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!csrfToken) {
      setError('セキュリティトークンが利用できません');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 認証成功時の処理
        window.location.href = `/${locale}/genai`;
      } else {
        setError(data.error || t('auth.signInError') || 'Sign in failed');
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError(t('auth.signInError') || 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  // CSRF トークンの読み込み中
  if (csrfLoading) {
    return <LoadingScreen message="セキュリティ初期化中..." />;
  }

  // CSRF エラー
  if (csrfError) {
    return <ErrorScreen error={`セキュリティ初期化エラー: ${csrfError}`} />;
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <SignInImage />
      <SignInFormSection
        locale={locale}
        username={username}
        password={password}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}

interface SignInFormSectionProps {
  locale: Locale;
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: string;
}

function SignInFormSection({
  locale,
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  isLoading,
  error
}: SignInFormSectionProps) {
  const t = useCustomTranslations(locale);

  return (
    <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50 h-full">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {t('auth.signInButton') || 'Sign In'}
          </h2>
          <p className="mt-2 text-gray-600">
            {t('common.appName') || 'Permission-aware RAG System'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <FormField
            id="username"
            label={t('auth.username') || 'Username'}
            type="text"
            value={username}
            onChange={onUsernameChange}
            placeholder={t('auth.username') || 'Username'}
            disabled={isLoading}
            required
          />

          <FormField
            id="password"
            label={t('auth.password') || 'Password'}
            type="password"
            value={password}
            onChange={onPasswordChange}
            placeholder={t('auth.password') || 'Password'}
            disabled={isLoading}
            required
          />

          {error && (
            <div className="text-red-600 text-sm text-center" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (t('common.loading') || 'Loading...') : (t('auth.signInButton') || 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

function FormField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-800 placeholder-gray-400 bg-gray-50 focus:bg-white"
        placeholder={placeholder}
        disabled={disabled}
        required={required}
      />
    </div>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-xl flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">RAG Chatbot</h2>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error }: { error: string }) {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-600 rounded-xl flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">RAG Chatbot</h2>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          再試行
        </button>
      </div>
    </div>
  );
}
