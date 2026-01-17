/**
 * サインイン機能のカスタムフック（シンプル版）
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SignInState {
  isLoading: boolean;
  error: string;
}

interface SignInActions {
  signIn: (username: string, password: string) => Promise<void>;
}

export function useSignIn(): SignInState & SignInActions {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const signIn = useCallback(async (username: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      // 入力値検証
      if (!username?.trim() || !password?.trim()) {
        throw new Error('ユーザー名とパスワードを入力してください');
      }

      // 認証API呼び出し
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // セッション情報保存
        localStorage.setItem('user', JSON.stringify(result.user));
        
        // チャットページにリダイレクト
        router.push('/chatbot');
      } else {
        throw new Error(result.error || 'サインインに失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'サインインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return {
    isLoading,
    error,
    signIn
  };
}