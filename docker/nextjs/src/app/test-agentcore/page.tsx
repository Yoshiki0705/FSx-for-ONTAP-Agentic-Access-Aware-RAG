/**
 * AgentCore統合テストページ（認証なし）
 */

'use client';

import React, { useState } from 'react';
import { AgentCoreSettings } from '@/components/settings/AgentCoreSettings';

export default function TestAgentCorePage() {
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTestLambdaInvoke = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/agentcore/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          functionName: 'TokyoRegion-permission-aware-rag-dev-AgentCore-Runtime-V2-NoAPI',
          payload: {
            httpMethod: 'POST',
            rawPath: '/agentcore',
            body: JSON.stringify({
              message: 'Hello from Browser UI Test',
              timestamp: new Date().toISOString()
            })
          }
        })
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAgentCoreAPI = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/agentcore/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Browser UI Integration Test',
          testMode: true,
          timestamp: new Date().toISOString()
        })
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            AgentCore統合テスト
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            AgentCore統合v2のブラウザUIテスト（認証なし）
          </p>
        </div>

        {/* テストボタン */}
        <div className="mb-8 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Lambda直接呼び出しテスト
            </h2>
            <div className="space-y-4">
              <button
                onClick={handleTestLambdaInvoke}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'テスト実行中...' : 'Lambda直接呼び出しテスト'}
              </button>
              
              <button
                onClick={handleTestAgentCoreAPI}
                disabled={isLoading}
                className="ml-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'テスト実行中...' : 'AgentCore統合テスト'}
              </button>
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
                <div className={`text-sm ${
                  testResult.success 
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  <strong>ステータス:</strong> {testResult.success ? '成功' : '失敗'}
                </div>
                <pre className="mt-2 text-xs overflow-auto">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* AgentCore設定UI */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            AgentCore設定UI（デモ）
          </h2>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>注意:</strong> 認証なしのため、設定の保存はできません。UIの動作確認のみ可能です。
            </p>
          </div>
          {/* <AgentCoreSettings /> */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <p className="text-gray-600 dark:text-gray-400">
              AgentCore設定UIは認証が必要です。ログイン後にアクセスしてください。
            </p>
          </div>
        </div>

        {/* 機能説明 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-4">
            AgentCore統合v2の特徴
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
            <li>• <strong>API Gateway無効化:</strong> タイムアウト制約を回避</li>
            <li>• <strong>Lambda直接呼び出し:</strong> AWS SDKによる直接統合</li>
            <li>• <strong>ハイブリッドアーキテクチャ:</strong> Next.js UI + AgentCore Runtime</li>
            <li>• <strong>責任分離:</strong> UI処理とAI処理の明確な分離</li>
            <li>• <strong>フォールバック機能:</strong> 既存Bedrock APIへの自動切り替え</li>
            <li>• <strong>設定永続化:</strong> DynamoDBによるユーザー設定管理</li>
          </ul>
        </div>
      </div>
    </div>
  );
}