'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check, AlertCircle, Loader2, Bot, Settings, Database, Zap } from 'lucide-react';
import { AgentModelSelector } from './AgentModelSelector';
import { useBedrockConfig } from '@/hooks';
import { useTranslations, useLocale } from 'next-intl';

/**
 * AgentCreationWizard コンポーネント
 * 
 * Bedrock Agent作成のための4ステップウィザード
 * - Step 1: 基本設定（名前、説明）
 * - Step 2: Foundation Model選択（既存のAgentModelSelectorを活用）
 * - Step 3: Knowledge Base選択・設定
 * - Step 4: Action Group設定（オプション）
 * 
 * Requirements: 28.1, 28.2, 28.3
 */

interface AgentCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (agentId: string) => void;
}

// ✅ Fix: Move WIZARD_STEPS outside component to prevent re-creation
const WIZARD_STEPS_CONFIG = [
  {
    id: 1,
    titleKey: 'basicSettings',
    descriptionKey: 'basicSettingsDesc',
    icon: Bot
  },
  {
    id: 2,
    titleKey: 'foundationModel',
    descriptionKey: 'foundationModelDesc',
    icon: Settings
  },
  {
    id: 3,
    titleKey: 'knowledgeBase',
    descriptionKey: 'knowledgeBaseDesc',
    icon: Database
  },
  {
    id: 4,
    titleKey: 'actionGroups',
    descriptionKey: 'actionGroupsDesc',
    icon: Zap
  }
];

interface AgentConfig {
  name: string;
  description: string;
  foundationModel: string;
  knowledgeBaseIds: string[];
  actionGroups: ActionGroupConfig[];
  instructions: string;
}

interface ActionGroupConfig {
  name: string;
  description: string;
  functionSchema?: any;
}

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  status: string;
}

export function AgentCreationWizard({ isOpen, onClose, onSuccess }: AgentCreationWizardProps) {
  const t = useTranslations('agent.wizard');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  
  // State管理
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoadingKB, setIsLoadingKB] = useState(false);
  
  // Agent設定
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    name: '',
    description: '',
    foundationModel: '',
    knowledgeBaseIds: [],
    actionGroups: [],
    instructions: ''
  });

  const { config: bedrockConfig } = useBedrockConfig();

  // ✅ Fix: Memoize WIZARD_STEPS to prevent infinite re-rendering
  const WIZARD_STEPS = useMemo(() => {
    return WIZARD_STEPS_CONFIG.map(step => ({
      id: step.id,
      title: t(step.titleKey as any) || step.titleKey,
      description: t(step.descriptionKey as any) || step.descriptionKey,
      icon: step.icon
    }));
  }, [t]); // Only depend on t, not on the entire config

  // ✅ Fix: Add debug logging with reduced frequency
  useEffect(() => {
    if (isOpen) {
      console.log('[AgentCreationWizard] Opened', {
        currentStep,
        hasBedrockConfig: !!bedrockConfig,
        locale,
        foundationModel: agentConfig.foundationModel
      });
    }
  }, [isOpen]); // Only log when isOpen changes

  // Knowledge Base一覧取得
  const fetchKnowledgeBases = useCallback(async () => {
    // ✅ Fix: bedrockConfigのnullチェック
    if (!bedrockConfig?.region) {
      console.log('[AgentCreationWizard] bedrockConfig.region is not available yet');
      return;
    }
    
    setIsLoadingKB(true);
    try {
      console.log('[AgentCreationWizard] Fetching knowledge bases for region:', bedrockConfig.region);
      const response = await fetch(`/api/bedrock/knowledge-bases?region=${bedrockConfig.region}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('[AgentCreationWizard] Knowledge bases loaded:', data.knowledgeBases?.length || 0);
        setKnowledgeBases(data.knowledgeBases || []);
      } else {
        console.error('[AgentCreationWizard] Knowledge Base取得エラー:', data.error);
      }
    } catch (err) {
      console.error('[AgentCreationWizard] Knowledge Base取得エラー:', err);
    } finally {
      setIsLoadingKB(false);
    }
  }, [bedrockConfig?.region]);

  // Knowledge Base取得（Step 3に到達時）
  useEffect(() => {
    if (currentStep === 3 && knowledgeBases.length === 0) {
      fetchKnowledgeBases();
    }
  }, [currentStep, knowledgeBases.length, fetchKnowledgeBases]);

  // ステップ検証
  const validateStep = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        return agentConfig.name.trim().length >= 3 && agentConfig.description.trim().length >= 10;
      case 2:
        return agentConfig.foundationModel.length > 0;
      case 3:
        return true; // Knowledge Baseは任意
      case 4:
        return true; // Action Groupsは任意
      default:
        return false;
    }
  }, [agentConfig]);

  // 次のステップへ
  const handleNext = useCallback(() => {
    console.log('[AgentCreationWizard] handleNext called', { currentStep, isValid: validateStep(currentStep) });
    if (validateStep(currentStep) && currentStep < 4) {
      setCurrentStep(currentStep + 1);
      setError(null);
    }
  }, [currentStep, validateStep]);

  // 前のステップへ
  const handlePrevious = useCallback(() => {
    console.log('[AgentCreationWizard] handlePrevious called', { currentStep });
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  }, [currentStep]);

  // Agent作成実行
  const handleCreateAgent = useCallback(async () => {
    if (!validateStep(4)) return;

    console.log('[AgentCreationWizard] Creating agent', { agentConfig, region: bedrockConfig?.region });
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/bedrock/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          agentName: agentConfig.name,
          description: agentConfig.description,
          foundationModel: agentConfig.foundationModel,
          instruction: agentConfig.instructions,
          knowledgeBaseIds: agentConfig.knowledgeBaseIds,
          actionGroups: agentConfig.actionGroups,
          region: bedrockConfig?.region || 'ap-northeast-1'
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('[AgentCreationWizard] Agent created successfully', { agentId: data.agentId });
        onSuccess?.(data.agentId);
        onClose();
      } else {
        console.error('[AgentCreationWizard] Agent creation failed', { error: data.error });
        setError(data.error || t('createError'));
      }
    } catch (err) {
      console.error('[AgentCreationWizard] Agent creation error', err);
      setError(err instanceof Error ? err.message : t('createError'));
    } finally {
      setIsCreating(false);
    }
  }, [agentConfig, bedrockConfig?.region, validateStep, onSuccess, onClose, t]);

  // モーダルが閉じられた時のリセット
  useEffect(() => {
    if (!isOpen) {
      console.log('[AgentCreationWizard] Closed, resetting state');
      setCurrentStep(1);
      setError(null);
      setAgentConfig({
        name: '',
        description: '',
        foundationModel: '',
        knowledgeBaseIds: [],
        actionGroups: [],
        instructions: ''
      });
    }
  }, [isOpen]);

  // ✅ Fix: bedrockConfigがnullの場合の早期リターン
  if (!isOpen) return null;

  if (isOpen && !bedrockConfig) {
    console.log('[AgentCreationWizard] Waiting for bedrockConfig...');
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-gray-900 dark:text-white">Loading configuration...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('title')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('stepProgress', { current: currentStep, total: WIZARD_STEPS.length })}: {WIZARD_STEPS[currentStep - 1]?.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={isCreating}
            >
              ✕
            </button>
          </div>
        </div>

        {/* プログレスバー */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center space-x-4">
            {WIZARD_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index + 1 < currentStep;
              const isCurrent = index + 1 === currentStep;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors
                    ${isCompleted 
                      ? 'bg-green-500 border-green-500 text-white' 
                      : isCurrent 
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                    }
                  `}>
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>
                  
                  {index < WIZARD_STEPS.length - 1 && (
                    <div className={`
                      w-12 h-0.5 mx-2 transition-colors
                      ${isCompleted ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* コンテンツエリア */}
        <div className="px-6 py-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-800 dark:text-red-300">{error}</span>
              </div>
            </div>
          )}

          {/* Step 1: 基本設定 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('agentName')} *
                </label>
                <input
                  type="text"
                  value={agentConfig.name}
                  onChange={(e) => setAgentConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('agentNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('agentNameHint')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('description')} *
                </label>
                <textarea
                  value={agentConfig.description}
                  onChange={(e) => setAgentConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('descriptionPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('descriptionHint')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('systemInstructions')}
                </label>
                <textarea
                  value={agentConfig.instructions}
                  onChange={(e) => setAgentConfig(prev => ({ ...prev, instructions: e.target.value }))}
                  placeholder={t('systemInstructionsPlaceholder')}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('systemInstructionsHint')}
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Foundation Model選択 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t('foundationModel')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('foundationModelDesc')}
                </p>
              </div>

              {/* ✅ Fix: AgentModelSelectorを正しく設定 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <AgentModelSelector
                  agentId="temp-creation-wizard"
                  currentModelId={agentConfig.foundationModel || undefined}
                  onModelChange={(modelId) => {
                    console.log('[AgentCreationWizard] Model changed:', modelId);
                    setAgentConfig(prev => ({ ...prev, foundationModel: modelId }));
                  }}
                  showAdvancedFilters={true}
                  showModelList={true}  // ✅ Fix: Enable model list display
                  locale={locale}
                />
              </div>

              {agentConfig.foundationModel && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-800 dark:text-green-300">
                      {t('modelSelected')}: {agentConfig.foundationModel}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Knowledge Base選択 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t('knowledgeBase')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('knowledgeBaseDesc')}
                </p>
              </div>

              {isLoadingKB ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    {t('loadingKnowledgeBases')}
                  </span>
                </div>
              ) : knowledgeBases.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('noKnowledgeBases')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {knowledgeBases && Array.isArray(knowledgeBases) && knowledgeBases.map((kb) => (
                    <label key={kb.id} className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agentConfig.knowledgeBaseIds.includes(kb.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAgentConfig(prev => ({
                              ...prev,
                              knowledgeBaseIds: [...prev.knowledgeBaseIds, kb.id]
                            }));
                          } else {
                            setAgentConfig(prev => ({
                              ...prev,
                              knowledgeBaseIds: prev.knowledgeBaseIds.filter(id => id !== kb.id)
                            }));
                          }
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {kb.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {kb.description}
                        </div>
                        <div className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                          kb.status === 'ACTIVE' 
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                            : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                        }`}>
                          {kb.status}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Action Groups設定 */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t('actionGroups')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('actionGroupsDesc')}
                </p>
              </div>

              <div className="text-center py-8">
                <Zap className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('actionGroupsComingSoon')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {t('basicFeaturesOnly')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1 || isCreating}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{tCommon('back')}</span>
            </button>

            <div className="flex items-center space-x-3">
              {currentStep < 4 ? (
                <button
                  onClick={handleNext}
                  disabled={!validateStep(currentStep) || isCreating}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-lg disabled:cursor-not-allowed"
                >
                  <span>{tCommon('next')}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleCreateAgent}
                  disabled={!validateStep(4) || isCreating}
                  className="flex items-center space-x-2 px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 rounded-lg disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('creating')}</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4" />
                      <span>{t('createAgent')}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
