'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { RegionSelector } from '../bedrock/RegionSelector';
import { ModelSelector } from '../bedrock/ModelSelector';
import { AgentInfoSection } from '../bedrock/AgentInfoSection';
import { AgentFeaturesSection } from '../bedrock/AgentFeaturesSection';
import { CollapsiblePanel } from '@/components/ui/CollapsiblePanel';
import { WorkflowSection } from '@/components/ui/WorkflowSection';
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
  locale,
}: AgentModeSidebarProps) {
  const t = useCustomTranslations(locale);
  const tSidebar = useTranslations('sidebar');
  const { config, isLoading: isConfigLoading } = useBedrockConfig();
  const { selectedAgentId } = useAgentStore();

  const effectiveAgentId = selectedAgentId || config?.agentId || '';

  const { agentInfo, isLoading: isAgentLoading } = useAgentInfo({
    agentId: effectiveAgentId,
    enabled: !!effectiveAgentId,
  });

  const rawAgentInfo = agentInfo
    ? {
        agentId: agentInfo.agentId,
        aliasName: agentInfo.aliasName ?? null,
        aliasId: agentInfo.aliasId ?? undefined,
        version: agentInfo.version,
        status: agentInfo.status || agentInfo.agentStatus,
        foundationModel: agentInfo.foundationModel,
        createdAt: agentInfo.createdAt,
        updatedAt: agentInfo.lastUpdated,
      }
    : null;

  const {
    normalizedAgentInfo,
    validationResult,
    isValid,
    errorMessage,
    warningMessages,
    processingTime,
  } = useAgentInfoNormalization(rawAgentInfo);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && rawAgentInfo) {
      console.debug('AgentModeSidebar - Agent情報正規化結果:', {
        raw: rawAgentInfo,
        normalized: normalizedAgentInfo,
        validation: validationResult,
        isValid,
        errorMessage,
        warningMessages,
        processingTime: `${processingTime.toFixed(2)}ms`,
      });
    }
  }, [rawAgentInfo, normalizedAgentInfo, validationResult, isValid, errorMessage, warningMessages, processingTime]);

  const handleWorkflowSelect = (prompt: string, label: string, agentId?: string) => {
    // WorkflowSection fires agent-workflow-selected CustomEvent internally
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* 1. Agent Information */}
      <div className="p-4 space-y-4">
        <AgentInfoSection agentInfo={normalizedAgentInfo} />

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 dark:bg-red-900/20 dark:border-red-800">
            <div className="text-sm text-red-800 dark:text-red-300">
              <strong>エラー:</strong> {errorMessage}
            </div>
          </div>
        )}

        {warningMessages.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 dark:bg-yellow-900/20 dark:border-yellow-800">
            <div className="text-sm text-yellow-800 dark:text-yellow-300">
              <strong>警告:</strong>
              <ul className="mt-1 list-disc list-inside">
                {warningMessages.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 2. WorkflowSection */}
      <div className="px-4 pb-4">
        <WorkflowSection
          locale={locale}
          selectedAgentId={selectedAgentId}
          onWorkflowSelect={handleWorkflowSelect}
        />
      </div>

      {/* 3. CollapsiblePanel */}
      <CollapsiblePanel
        title={tSidebar('systemSettings')}
        icon="⚙️"
        storageKey="system-settings"
        defaultExpanded={false}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('region.title')}
            </h3>
            <RegionSelector />
          </div>

          <div className="space-y-2">
            <ModelSelector
              selectedModelId={selectedModelId}
              onModelChange={onModelChange}
              showAdvancedFilters={true}
              mode="agent"
            />
          </div>

          <AgentFeaturesSection locale={locale} />

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('chat.chatHistory')}
            </h3>
            <div className="space-y-2 text-xs">
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-gray-700 dark:text-gray-300">{t('chat.saveHistory')}</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-gray-700 dark:text-gray-300">{t('chat.autoTitleGeneration')}</span>
              </label>
              <div className="text-gray-600 dark:text-gray-400">
                {t('sidebar.agentMode')} {t('chat.sessionActive')}
              </div>
            </div>
          </div>
        </div>
      </CollapsiblePanel>
    </div>
  );
}
