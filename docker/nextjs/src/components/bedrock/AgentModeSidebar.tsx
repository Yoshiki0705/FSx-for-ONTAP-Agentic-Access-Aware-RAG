'use client';

import { useEffect } from 'react';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { RegionSelector } from '../bedrock/RegionSelector';
import { ModelSelector } from '../bedrock/ModelSelector';
import { AgentInfoSection } from '../bedrock/AgentInfoSection';
import { AgentFeaturesSection } from '../bedrock/AgentFeaturesSection';
import { useAgentInfo } from '../../hooks/useAgentInfo';
import { useBedrockConfig } from '../../hooks/useBedrockConfig';
import { useAgentInfoNormalization } from '../../hooks/useAgentInfoNormalization';
import { useAgentStore } from '../../store/useAgentStore';

interface AgentModeSidebarProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  onCreateAgent: () => void;
  locale: string;
}

export function AgentModeSidebar({ 
  selectedModelId, 
  onModelChange, 
  onCreateAgent,
  locale
}: AgentModeSidebarProps) {
  const t = useCustomTranslations(locale);
  const { config, isLoading: isConfigLoading } = useBedrockConfig();
  const { selectedAgentId } = useAgentStore();
  
  // 選択されたAgent IDを使用（優先順位: Store > Config）
  const effectiveAgentId = selectedAgentId || config?.agentId || '';
  
  const { agentInfo, isLoading: isAgentLoading } = useAgentInfo({
    agentId: effectiveAgentId,
    enabled: !!effectiveAgentId
  });

  // Agent情報の型変換（null を undefined に変換）
  const rawAgentInfo = agentInfo ? {
    agentId: agentInfo.agentId,
    aliasName: agentInfo.aliasName ?? null,  // null も許容
    aliasId: agentInfo.aliasId ?? undefined,
    version: agentInfo.version,
    status: agentInfo.status || agentInfo.agentStatus,
    foundationModel: agentInfo.foundationModel,
    createdAt: agentInfo.createdAt,
    updatedAt: agentInfo.lastUpdated
  } : null;

  // Agent情報の正規化処理（カスタムフック使用）
  const {
    normalizedAgentInfo,
    validationResult,
    isValid,
    errorMessage,
    warningMessages,
    processingTime
  } = useAgentInfoNormalization(rawAgentInfo);

  // デバッグ情報の出力（開発環境のみ）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && rawAgentInfo) {
      console.debug('AgentModeSidebar - Agent情報正規化結果:', {
        raw: rawAgentInfo,
        normalized: normalizedAgentInfo,
        validation: validationResult,
        isValid,
        errorMessage,
        warningMessages,
        processingTime: `${processingTime.toFixed(2)}ms`
      });
    }
  }, [rawAgentInfo, normalizedAgentInfo, validationResult, isValid, errorMessage, warningMessages, processingTime]);

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="space-y-6 p-4">
      {/* Agent Information */}
      <AgentInfoSection 
        agentInfo={normalizedAgentInfo}
      />

      {/* エラー・警告表示 */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="text-sm text-red-800">
            <strong>エラー:</strong> {errorMessage}
          </div>
        </div>
      )}

      {warningMessages.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="text-sm text-yellow-800">
            <strong>警告:</strong>
            <ul className="mt-1 list-disc list-inside">
              {warningMessages.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Region Selection */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">
          {t('region.title')}
        </h3>
        <RegionSelector locale={locale} />
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <ModelSelector
          selectedModelId={selectedModelId}
          onModelChange={onModelChange}
          showAdvancedFilters={true}
          mode="agent"
        />
      </div>

      {/* Agent Features */}
      <AgentFeaturesSection locale={locale} />

      {/* ワークフロー選択 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          🔧 ワークフロー
        </h3>
        <div className="space-y-1">
          {[
            { icon: '📊', label: '財務レポート分析', prompt: '最新の財務レポートを分析して、売上状況と投資計画をまとめてください。' },
            { icon: '📝', label: 'プロジェクト進捗確認', prompt: 'プロジェクト計画の進捗状況を確認し、主要マイルストーンと技術的課題を教えてください。' },
            { icon: '🔍', label: 'ドキュメント横断検索', prompt: '社内ドキュメントを横断的に検索し、主要な情報をまとめてください。' },
            { icon: '📋', label: '人事ポリシー確認', prompt: '人事ポリシーの内容を確認し、リモートワーク制度と休暇制度について教えてください。' },
          ].map((wf, i) => (
            <button
              key={i}
              onClick={() => {
                // ワークフロー選択時にチャット入力欄にプロンプトを設定
                const event = new CustomEvent('agent-workflow-selected', {
                  detail: { prompt: wf.prompt, label: wf.label },
                  bubbles: true,
                });
                window.dispatchEvent(event);
              }}
              className="w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 transition-colors flex items-center space-x-2"
            >
              <span>{wf.icon}</span>
              <span>{wf.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat History Settings */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">
          {t('chat.chatHistory')}
        </h3>
        <div className="space-y-2 text-xs">
          <label className="flex items-center space-x-2">
            <input type="checkbox" className="rounded" />
            <span>{t('chat.saveHistory')}</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" className="rounded" />
            <span>{t('chat.autoTitleGeneration')}</span>
          </label>
          <div className="text-gray-600">
            {t('sidebar.agentMode')} {t('chat.sessionActive')}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
