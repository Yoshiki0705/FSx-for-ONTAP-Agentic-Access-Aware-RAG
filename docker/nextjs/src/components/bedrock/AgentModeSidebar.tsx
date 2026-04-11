'use client';

import { useTranslations } from 'next-intl';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { RegionSelector } from '../bedrock/RegionSelector';
import { ModelSelector } from '../bedrock/ModelSelector';
import { AgentInfoSection } from '../bedrock/AgentInfoSection';
import { AgentFeaturesSection } from '../bedrock/AgentFeaturesSection';
import { CollapsiblePanel } from '@/components/ui/CollapsiblePanel';
import { useAgentInfo } from '../../hooks/useAgentInfo';
import { useBedrockConfig } from '../../hooks/useBedrockConfig';
import { useAgentInfoNormalization } from '../../hooks/useAgentInfoNormalization';
import { useAgentStore } from '../../store/useAgentStore';
import { useChatStore } from '../../store/useChatStore';

interface AgentModeSidebarProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  onCreateAgent: () => void;
  locale: string;
  // UI/UX最適化: Task 8.1で追加されたprops（互換性のためオプション）
  isOpen?: boolean;
  onClose?: () => void;
  onNewChat?: () => void;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  userDirectories?: any;
}

export function AgentModeSidebar({
  selectedModelId,
  onModelChange,
  onCreateAgent: _onCreateAgent,
  locale,
  userRole,
  userDirectories,
}: AgentModeSidebarProps) {
  const t = useCustomTranslations(locale);
  const tSidebar = useTranslations('sidebar');
  const tPermissions = useTranslations('permissions');
  const { config } = useBedrockConfig();
  const { selectedAgentId } = useAgentStore();
  const { saveHistory, setSaveHistory } = useChatStore();
  const effectiveAgentId = selectedAgentId || config?.agentId || '';

  const { agentInfo } = useAgentInfo({
    agentId: effectiveAgentId,
    enabled: !!effectiveAgentId,
  });

  const rawAgentInfo = agentInfo ? {
    agentId: agentInfo.agentId,
    aliasName: agentInfo.aliasName ?? null,
    aliasId: agentInfo.aliasId ?? undefined,
    version: agentInfo.version,
    status: agentInfo.status || agentInfo.agentStatus,
    foundationModel: agentInfo.foundationModel,
    createdAt: agentInfo.createdAt,
    updatedAt: agentInfo.lastUpdated,
  } : null;

  const { normalizedAgentInfo, errorMessage, warningMessages } =
    useAgentInfoNormalization(rawAgentInfo);

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Workflow Info (Agent details) */}
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
                {warningMessages.map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* アクセス権限セクション */}
      {userDirectories && (
        <div className="px-4 pb-3">
          <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{tSidebar('accessPermissions')}</h3>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-3 text-xs space-y-2">
            {userDirectories.accessibleDirectories && (
              <div className="text-gray-600 dark:text-gray-400">
                <div>📁 {tPermissions('directories', { count: userDirectories.accessibleDirectories.length })}</div>
                {userDirectories.accessibleDirectories.length > 0 && (
                  <div className="mt-1 ml-4 text-gray-500 dark:text-gray-500">
                    {userDirectories.accessibleDirectories.join(', ')}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center space-x-3 mt-1">
              <span className={userDirectories.permissions?.read ? 'text-green-600' : 'text-red-600'}>
                {userDirectories.permissions?.read ? '✅' : '❌'} {tPermissions('read')}
              </span>
              <span className={userDirectories.permissions?.write ? 'text-green-600' : 'text-red-600'}>
                {userDirectories.permissions?.write ? '✅' : '❌'} {tPermissions('write')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* チャット履歴設定（独立セクション） */}
      <div className="px-4 pb-3">
        <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chat.chatHistory')}</h3>
        <button
          onClick={() => setSaveHistory(!saveHistory)}
          className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
            saveHistory
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700 font-medium'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <span className="text-base">{saveHistory ? '💾' : '🚫'}</span>
            <div className="flex-1">
              <div className="font-medium">{saveHistory ? tSidebar('historySaving') : tSidebar('historyDisabled')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {saveHistory ? tSidebar('autoSave') : tSidebar('sessionOnly')}
              </div>
            </div>
            {saveHistory && <span className="text-green-600 dark:text-green-400">✓</span>}
          </div>
        </button>
      </div>

      {/* System Settings (collapsible) */}
      <CollapsiblePanel
        title={tSidebar('systemSettings')}
        icon="⚙️"
        storageKey="system-settings"
        defaultExpanded={false}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('region.title')}</h3>
            <RegionSelector />
          </div>
          <div className="space-y-2">
            <ModelSelector selectedModelId={selectedModelId} onModelChange={onModelChange} showAdvancedFilters={true} mode="agent" />
          </div>
          <AgentFeaturesSection locale={locale} />
        </div>
      </CollapsiblePanel>
    </div>
  );
}
