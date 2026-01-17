/**
 * サインインフォームコンポーネント
 * 認証フォームとテストアカウント情報を担当
 */

import { useState } from 'react';

interface SignInFormProps {
  onSubmit: (username: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string;
}

export default function SignInForm({ onSubmit, isLoading, error }: SignInFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(username, password);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <FormHeader />
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <UsernameField 
          value={username}
          onChange={setUsername}
          disabled={isLoading}
        />
        
        <PasswordField 
          value={password}
          onChange={setPassword}
          disabled={isLoading}
        />
        
        <ErrorDisplay error={error} />
        
        <SubmitButton isLoading={isLoading} />
      </form>

      <Footer />
    </div>
  );
}

function FormHeader() {
  return (
    <div className="text-center mb-8">
      <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-xl flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">RAG Chatbot</h1>
      <p className="text-gray-600">Permission-aware RAG System with FSx ONTAP</p>
    </div>
  );
}

interface InputFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

function UsernameField({ value, onChange, disabled }: InputFieldProps) {
  return (
    <div>
      <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
        ユーザー名
      </label>
      <input
        id="username"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        placeholder="ユーザー名を入力"
        disabled={disabled}
        required
      />
    </div>
  );
}

function PasswordField({ value, onChange, disabled }: InputFieldProps) {
  return (
    <div>
      <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
        パスワード
      </label>
      <input
        id="password"
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        placeholder="パスワードを入力"
        disabled={disabled}
        required
      />
    </div>
  );
}

function ErrorDisplay({ error }: { error: string }) {
  if (!error) return null;

  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      <div className="flex items-center">
        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {error}
      </div>
    </div>
  );
}

function SubmitButton({ isLoading }: { isLoading: boolean }) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <LoadingSpinner />
          サインイン中...
        </div>
      ) : (
        'サインイン'
      )}
    </button>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}



function Footer() {
  return (
    <div className="mt-6 text-center">
      <p className="text-xs text-gray-500">
        Powered by Amazon FSx for NetApp ONTAP & Amazon Bedrock
      </p>
    </div>
  );
}