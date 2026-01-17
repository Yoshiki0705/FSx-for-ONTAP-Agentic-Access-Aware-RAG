/**
 * AgentCore統合テストページ（認証付き）
 * Phase 5: Task 5.1 - 認証付きブラウザUIテスト
 * Next.js 15互換性対応: Client Component で use() hook使用
 */

'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useAuthStore } from '@/store/useAuthStore';
import { AgentCoreSettings } from '@/components/settings/AgentCoreSettings';
import { useAgentCore } from '@/hooks/useAgentCore';

// Next.js 15: params は Promise になった
interface AgentCoreTestPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function AgentCoreTestPage({ params }: AgentCoreTestPageProps) {
  // Next.js 15: Client Component では use() hook を使用
  const { locale } = use(params);
  
  const router = useRouter();
  const t = useTranslations('agentcore');
  const currentLocale = useLocale();
  
  const { isAuthenticated, session, checkSession } = useAuthStore();
  const { state, processInput, isAvailable } = useAgentCore();
  
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // 認証チェック
  useEffect(() => {
    const checkAuth = async () => {
      if (!sessionChecked) {
        await checkSession();
        setSessionChecked(true);
      }
      
      if (sessionChecked && !isAuthenticated) {
        router.push(`/${locale}/signin`);
      }
    };
    
    checkAuth();
  }, [isAuthenticated, sessionChecked, checkSession, router, locale]);

  // AgentCore呼び出しテスト
  const handleAgentCoreTest = async () => {
    if (!testMessage.trim()) {
      alert('テストメッセージを入力してください');
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const result = await processInput(testMessage, {
        includeContext: true,
        maxTokens: 1000,
        temperature: 0.7
      });
      
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Lambda直接呼び出しテスト
  const handleLambdaDirectTest = async (environment: 'dev' | 'prod') => {
    setIsLoading(true);
    setTestResult(null);

    const functionName = environment === 'dev' 
      ? 'TokyoRegion-permission-aware-rag-dev-AgentCore-V2'
      : 'TokyoRegion-permission-aware-rag-prod-AgentCore-V2';

    try {
      const response = await fetch('/api/agentcore/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          functionName,
          payload: {
            httpMethod: 'POST',
            rawPath: '/agentcore',
            body: JSON.stringify({
              message: testMessage || 'Hello from Authenticated User Test',
              timestamp: new Date().toISOString(),
              user: session?.user.username,
              environment
            })
          }
        })
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 認証チェック中の表示
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">認証状態を確認中...</p>
        </div>
      </div>
    );
  }

  // 未認証の場合（リダイレクト前の表示）
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">認証が必要です。サインインページにリダイレクトします...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                AgentCore統合テスト（認証付き）
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Phase 5: Task 5.1 - 認証付きブラウザUIテスト
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ログインユーザー: <span className="font-medium">{session?.user.username}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                セッション期限: {session?.expiresAt ? new Date(session.expiresAt).toLocaleString(currentLocale) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左側: AgentCore設定 */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                AgentCore設定
              </h2>
              <AgentCoreSettings />
            </div>

            {/* ユーザー情報 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                認証情報
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">ユーザー名:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{session?.user.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">ロール:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{session?.user.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">ログイン時刻:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {session?.loginTime ? new Date(session.loginTime).toLocaleString(currentLocale) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">最終アクティビティ:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {session?.lastActivity ? new Date(session.lastActivity).toLocaleString(currentLocale) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 右側: テスト実行 */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                機能テスト
              </h2>
              
              {/* テストメッセージ入力 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  テストメッセージ
                </h3>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="AgentCoreに送信するテストメッセージを入力してください..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* テストボタン */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  テスト実行
                </h3>
                <div className="space-y-3">
                  {/* AgentCore統合テスト */}
                  <button
                    onClick={handleAgentCoreTest}
                    disabled={isLoading || !state.settings.enabled}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'テスト実行中...' : 'AgentCore統合テスト'}
                  </button>

                  {/* Lambda直接呼び出しテスト */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleLambdaDirectTest('dev')}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? '実行中...' : '開発環境Lambda'}
                    </button>
                    <button
                      onClick={() => handleLambdaDirectTest('prod')}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? '実行中...' : '本番環境Lambda'}
                    </button>
                  </div>
                </div>

                {/* ステータス表示 */}
                <div className="mt-4 flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      isAvailable ? 'bg-green-500' : 
                      state.settings.enabled ? 'bg-yellow-500' : 'bg-gray-400'
                    }`} />
                    <span className="text-gray-600 dark:text-gray-400">
                      AgentCore: {isAvailable ? '利用可能' : 
                                 state.settings.enabled ? '確認中' : '無効'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-gray-600 dark:text-gray-400">
                      認証: 有効
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* テスト結果 */}
            {testResult && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  テスト結果
                </h3>
                <div className={`p-4 rounded-md ${
                  testResult.success 
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <div className={`text-sm mb-2 ${
                    testResult.success 
                      ? 'text-green-800 dark:text-green-200'
                      : 'text-red-800 dark:text-red-200'
                  }`}>
                    <strong>ステータス:</strong> {testResult.success ? '成功' : '失敗'}
                  </div>
                  <pre className="text-xs overflow-auto max-h-96 bg-gray-100 dark:bg-gray-700 p-3 rounded">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 機能説明 */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-4">
            認証付きAgentCore統合テストについて
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800 dark:text-blue-300">
            <div>
              <h4 className="font-medium mb-2">テスト項目</h4>
              <ul className="space-y-1">
                <li>• 認証システムとの統合確認</li>
                <li>• AgentCore設定UIの動作確認</li>
                <li>• Lambda直接呼び出しの動作確認</li>
                <li>• ユーザーセッション管理の確認</li>
                <li>• エラーハンドリングの確認</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">検証ポイント</h4>
              <ul className="space-y-1">
                <li>• ログインユーザーのみアクセス可能</li>
                <li>• ユーザー情報の正確な表示</li>
                <li>• AgentCore機能の有効化/無効化</li>
                <li>• 開発・本番環境への接続</li>
                <li>• レスポンスの正確性</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
