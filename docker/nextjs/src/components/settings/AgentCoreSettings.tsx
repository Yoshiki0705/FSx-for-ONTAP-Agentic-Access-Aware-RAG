/**
 * AgentCore設定UI
 * 
 * AgentCore機能の有効化/無効化と詳細設定を管理
 */

'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAgentCore } from '@/hooks/useAgentCore';

interface AgentCoreSettingsProps {
  className?: string;
}

export function AgentCoreSettings({ className = '' }: AgentCoreSettingsProps) {
  const t = useTranslations('settings');
  const { state, toggleEnabled, updateSettings, checkHealth, isAvailable, canFallback } = useAgentCore();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState(state.settings);

  // 設定変更ハンドラー
  const handleSettingChange = async (key: string, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);

    if (state.settings.autoSave) {
      setIsSaving(true);
      try {
        await updateSettings({ [key]: value });
      } catch (error) {
        console.error('Failed to save setting:', error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // 手動保存
  const handleManualSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(localSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // ヘルスチェック実行
  const handleHealthCheck = async () => {
    await checkHealth();
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                AgentCore統合
              </h3>
              <div className={`w-2 h-2 rounded-full ${
                isAvailable ? 'bg-green-500' : 
                state.settings.enabled ? 'bg-yellow-500' : 'bg-gray-400'
              }`} />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {isAvailable ? '利用可能' : 
               state.settings.enabled ? 'ヘルスチェック中' : '無効'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* 有効/無効切り替え */}
            <button
              onClick={toggleEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                state.settings.enabled 
                  ? 'bg-blue-600' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  state.settings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            
            {/* 詳細設定展開ボタン */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className={`w-5 h-5 transform transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* ステータス情報 */}
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <p>AI処理をAgentCore Runtimeに委譲し、UI/UX処理をNext.jsで管理します。</p>
          {state.lastError && (
            <p className="mt-1 text-red-600 dark:text-red-400">
              エラー: {state.lastError}
            </p>
          )}
        </div>
      </div>

      {/* 詳細設定 */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* APIエンドポイント */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              APIエンドポイント
            </label>
            <input
              type="text"
              value={localSettings.apiEndpoint}
              onChange={(e) => handleSettingChange('apiEndpoint', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="/api/agentcore"
            />
          </div>

          {/* タイムアウト */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              タイムアウト (ミリ秒)
            </label>
            <input
              type="number"
              min="1000"
              max="300000"
              step="1000"
              value={localSettings.timeout}
              onChange={(e) => handleSettingChange('timeout', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* リトライ回数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              リトライ回数
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={localSettings.retryAttempts}
              onChange={(e) => handleSettingChange('retryAttempts', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* フォールバック設定 */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="fallback"
              checked={localSettings.fallbackToBedrockDirect}
              onChange={(e) => handleSettingChange('fallbackToBedrockDirect', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded 
                         focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 
                         focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="fallback" className="text-sm text-gray-700 dark:text-gray-300">
              Bedrock直接呼び出しへのフォールバックを有効にする
            </label>
          </div>

          {/* 自動保存設定 */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoSave"
              checked={localSettings.autoSave}
              onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded 
                         focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 
                         focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="autoSave" className="text-sm text-gray-700 dark:text-gray-300">
              設定変更を自動保存する
            </label>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              {/* ヘルスチェックボタン */}
              <button
                onClick={handleHealthCheck}
                disabled={!state.settings.enabled}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                           rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ヘルスチェック
              </button>

              {/* ステータス表示 */}
              <span className={`text-xs px-2 py-1 rounded-full ${
                isAvailable 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : state.settings.enabled
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}>
                {isAvailable ? '正常' : 
                 state.settings.enabled ? '確認中' : '無効'}
              </span>
            </div>

            {/* 手動保存ボタン */}
            {!state.settings.autoSave && (
              <button
                onClick={handleManualSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? '保存中...' : '設定を保存'}
              </button>
            )}
          </div>

          {/* 機能説明 */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
              AgentCore統合について
            </h4>
            <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <li>• <strong>責任分離</strong>: UI/UX処理はNext.js、AI処理はAgentCore Runtime</li>
              <li>• <strong>フォールバック</strong>: AgentCore障害時は既存のBedrock APIを使用</li>
              <li>• <strong>段階的導入</strong>: 既存機能に影響を与えずに新機能を追加</li>
              <li>• <strong>設定永続化</strong>: ユーザー設定はDynamoDBに保存</li>
            </ul>
          </div>
        </div>
      )}

      {/* 処理中インジケーター */}
      {state.isProcessing && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-400">処理中...</span>
          </div>
        </div>
      )}
    </div>
  );
}