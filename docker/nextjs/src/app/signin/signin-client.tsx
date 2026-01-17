'use client';

import { useState } from 'react';
import { useSignIn } from '../../hooks/useSignIn';

/**
 * サインインクライアントコンポーネント
 */
export default function SignInClient() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { isLoading, error, signIn } = useSignIn();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn(username, password);
  };

  return (
    <div className="min-h-screen flex">
      <BrandImageSection />
      <SignInFormSection
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

/**
 * ブランド画像セクション - GitHubオリジナルに準拠したシンプルな実装
 */
function BrandImageSection() {
  return (
    <div className="relative hidden bg-muted lg:block lg:w-1/2">
      <img
        src="/images/main-image.jpg"
        alt="NetApp building with Intelligent Data Infrastructure signage"
        className="w-full h-full object-cover"
        style={{ objectFit: 'cover' }}
      />
    </div>
  );
}

/**
 * サインインフォームセクション
 */
interface SignInFormSectionProps {
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: string;
}

function SignInFormSection({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  isLoading,
  error
}: SignInFormSectionProps) {
  return (
    <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">サインイン</h2>
          <p className="mt-2 text-gray-600">Permission-aware RAG System</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <FormField
            id="username"
            label="ユーザー名"
            type="text"
            value={username}
            onChange={onUsernameChange}
            placeholder="ユーザー名を入力"
            disabled={isLoading}
            required
          />

          <FormField
            id="password"
            label="パスワード"
            type="password"
            value={password}
            onChange={onPasswordChange}
            placeholder="パスワードを入力"
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
            {isLoading ? 'サインイン中...' : 'サインイン'}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * 再利用可能なフォームフィールドコンポーネント
 */
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